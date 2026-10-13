/**
 * Per-device stack folds (inventory spec, Shipped: the compaction weakness).
 *
 * The old fold was one global watermark per stack: any device could fold any
 * op, so (1) an op a device had never seen, with an hlc under another device's
 * watermark, was discarded on merge — lost; and (2) a grant replayed after its
 * op was folded was not recognised and landed twice. Now each device folds
 * only its own ops, and a fold remembers the ids it folded.
 *
 * The property test runs two and three devices through random grants,
 * spends, replays, folds and syncs in random order and direction, and checks
 * every device's every total against the ground truth after every step.
 */
import {
  applyStackOp,
  compactStackOps,
  emptyInventoryLedger,
  ledgerKnowsOp,
  mergeInventoryLedgers,
  nextHlc,
  stackQuantityOf,
} from './inventory-ops';
import type { InventoryLedger, InventoryStackOp } from './inventory.model';

const KEYS = ['cinder-ore', 'ember-residue', 'torch'];

interface Device {
  id: string;
  ledger: InventoryLedger;
  /** Op ids this device's ledger has absorbed (written here or merged in). */
  known: Set<string>;
  /** Wall-clock skew, so hlc order disagrees with real order across devices. */
  skew: number;
}

interface Truth { key: string; delta: number }

function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** What `InventoryService.grantStack` / `consumeStacks` do to the ledger, minus Angular. */
function write(dev: Device, op: Omit<InventoryStackOp, 'hlc' | 'deviceId' | 'sequence'>, wall: number, live: number): boolean {
  if (ledgerKnowsOp(dev.ledger, op.id)) return false; // a replay: lands once
  const hlc = nextHlc(dev.ledger.hlc, wall + dev.skew);
  const next = { ...op, hlc, deviceId: dev.id, sequence: 1 };
  dev.ledger = compactStackOps({ ...dev.ledger, hlc, stackOps: applyStackOp(dev.ledger.stackOps, next) }, dev.id, live);
  dev.known.add(op.id);
  return true;
}

function sync(from: Device, to: Device, flip: boolean): void {
  to.ledger = flip ? mergeInventoryLedgers(to.ledger, from.ledger) : mergeInventoryLedgers(from.ledger, to.ledger);
  for (const id of from.known) to.known.add(id);
}

function expected(truth: Map<string, Truth>, known: Iterable<string>, key: string): number {
  let sum = 0;
  for (const id of known) {
    const row = truth.get(id);
    if (row?.key === key) sum += row.delta;
  }
  return Math.max(0, sum);
}

function device(id: string, skew: number): Device {
  return { id, ledger: emptyInventoryLedger(), known: new Set(), skew };
}

describe('per-device stack folds', () => {
  it('property: random writes, replays, folds and syncs — every device always counts exactly what it has seen', () => {
    let runs = 0;
    for (let seed = 1; seed <= 48; seed++) {
      const r = rng(seed);
      const count = seed % 2 ? 2 : 3;
      const live = 2 + Math.floor(r() * 6); // fold early and often
      const devices = Array.from({ length: count }, (_, i) => device(`dev-${i}`, Math.floor(r() * 40) - 20));
      const truth = new Map<string, Truth>();
      let wall = 1000;
      let next = 0;

      for (let step = 0; step < 220; step++) {
        wall += 1 + Math.floor(r() * 3);
        const dev = devices[Math.floor(r() * devices.length)];
        const roll = r();
        const key = KEYS[Math.floor(r() * KEYS.length)];
        if (roll < 0.45) {
          const id = `g${seed}:${next++}`;
          const qty = 1 + Math.floor(r() * 5);
          truth.set(id, { key, delta: qty });
          write(dev, { id, stackKey: key, kind: 'grant', quantity: qty }, wall, live);
        } else if (roll < 0.6) {
          const have = stackQuantityOf(dev.ledger, key);
          if (have > 0) {
            const id = `c${seed}:${next++}`;
            const qty = 1 + Math.floor(r() * have);
            truth.set(id, { key, delta: -qty });
            write(dev, { id, stackKey: key, kind: 'consume', quantity: qty }, wall, live);
          }
        } else if (roll < 0.8) {
          // Replay something this device already has — retried, or re-settled after a sync.
          const ids = [...dev.known];
          if (ids.length) {
            const id = ids[Math.floor(r() * ids.length)];
            const row = truth.get(id)!;
            const before = stackQuantityOf(dev.ledger, row.key);
            const landed = write(dev, {
              id, stackKey: row.key, kind: row.delta > 0 ? 'grant' : 'consume', quantity: Math.abs(row.delta),
            }, wall, live);
            expect(landed).withContext(`seed ${seed} step ${step}: replay of ${id} was not recognised`).toBe(false);
            expect(stackQuantityOf(dev.ledger, row.key)).toBe(before);
          }
        } else {
          const other = devices[Math.floor(r() * devices.length)];
          if (other !== dev) sync(dev, other, r() < 0.5);
        }

        for (const d of devices) {
          for (const k of KEYS) {
            expect(stackQuantityOf(d.ledger, k))
              .withContext(`seed ${seed} step ${step} ${d.id} ${k}`)
              .toBe(expected(truth, d.known, k));
          }
        }
      }

      // Everyone syncs with everyone, in both directions: all converge on the truth.
      for (let round = 0; round < 2; round++) {
        for (const a of devices) for (const b of devices) if (a !== b) sync(a, b, round === 1);
      }
      for (const k of KEYS) {
        const want = expected(truth, truth.keys(), k);
        for (const d of devices) expect(stackQuantityOf(d.ledger, k)).withContext(`seed ${seed} final ${d.id} ${k}`).toBe(want);
      }
      // Folds kept the logs short: each device holds at most `live` of its own ops.
      for (const d of devices) {
        for (const owner of devices) {
          expect(d.ledger.stackOps.filter(op => op.deviceId === owner.id).length).toBeLessThanOrEqual(live);
        }
      }
      runs++;
    }
    expect(runs).toBe(48);
  });

  it('merge order does not matter, and merging twice changes nothing', () => {
    const r = rng(7);
    const a = device('a', 0);
    const b = device('b', 5);
    for (let i = 0; i < 40; i++) {
      write(r() < 0.5 ? a : b, { id: `x${i}`, stackKey: 'cinder-ore', kind: 'grant', quantity: 1 + (i % 3) }, 100 + i, 4);
    }
    const ab = mergeInventoryLedgers(a.ledger, b.ledger);
    const ba = mergeInventoryLedgers(b.ledger, a.ledger);
    expect(JSON.stringify(ab.stackFolds)).toBe(JSON.stringify(ba.stackFolds));
    expect(ab.stackOps.map(op => op.id)).toEqual(ba.stackOps.map(op => op.id));
    const again = mergeInventoryLedgers(ab, ba);
    expect(stackQuantityOf(again, 'cinder-ore')).toBe(stackQuantityOf(ab, 'cinder-ore'));
  });

  // Defect 1, as reported: a device that compacts must not erase an op it never saw.
  it('an op another device never saw survives that device folding past its hlc', () => {
    const fast = device('fast', 1_000);   // a clock far ahead: its fold watermark is high
    const slow = device('slow', 0);
    write(slow, { id: 'unseen', stackKey: 'cinder-ore', kind: 'grant', quantity: 9 }, 10, 4);
    for (let i = 0; i < 20; i++) write(fast, { id: `f${i}`, stackKey: 'cinder-ore', kind: 'grant', quantity: 1 }, 20 + i, 4);
    expect(fast.ledger.stackFolds?.[0].upToHlc).toBeGreaterThan(slow.ledger.stackOps[0].hlc);

    const merged = mergeInventoryLedgers(fast.ledger, slow.ledger);
    expect(stackQuantityOf(merged, 'cinder-ore')).toBe(29);
    expect(stackQuantityOf(mergeInventoryLedgers(slow.ledger, fast.ledger), 'cinder-ore')).toBe(29);
  });

  // Defect 2, as reported: a grant replayed after its op was compacted counts once.
  it('a grant replayed after its op was folded lands once, on any device', () => {
    const phone = device('phone', 0);
    const tablet = device('tablet', 0);
    write(phone, { id: 'expedition-7:ore', stackKey: 'cinder-ore', kind: 'grant', quantity: 12 }, 1, 4);
    for (let i = 0; i < 30; i++) write(phone, { id: `dig${i}`, stackKey: 'basalt-block', kind: 'grant', quantity: 1 }, 2 + i, 4);
    expect(phone.ledger.stackOps.some(op => op.id === 'expedition-7:ore')).toBe(false);
    expect(ledgerKnowsOp(phone.ledger, 'expedition-7:ore')).toBe(true);

    expect(write(phone, { id: 'expedition-7:ore', stackKey: 'cinder-ore', kind: 'grant', quantity: 12 }, 50, 4)).toBe(false);
    sync(phone, tablet, false);
    expect(write(tablet, { id: 'expedition-7:ore', stackKey: 'cinder-ore', kind: 'grant', quantity: 12 }, 60, 4)).toBe(false);
    expect(stackQuantityOf(phone.ledger, 'cinder-ore')).toBe(12);
    expect(stackQuantityOf(tablet.ledger, 'cinder-ore')).toBe(12);
  });

  it('the same grant settled on two devices before they synced counts once when one has folded it', () => {
    const phone = device('phone', 0);
    const tablet = device('tablet', 0);
    write(phone, { id: 'landing:ore', stackKey: 'cinder-ore', kind: 'grant', quantity: 5 }, 1, 4);
    for (let i = 0; i < 10; i++) write(phone, { id: `p${i}`, stackKey: 'torch', kind: 'grant', quantity: 1 }, 2 + i, 4);
    write(tablet, { id: 'landing:ore', stackKey: 'cinder-ore', kind: 'grant', quantity: 5 }, 3, 4);

    sync(phone, tablet, true);
    expect(stackQuantityOf(tablet.ledger, 'cinder-ore')).toBe(5);
    // And the tablet folding its own copy later does not count it again.
    for (let i = 0; i < 10; i++) write(tablet, { id: `t${i}`, stackKey: 'torch', kind: 'grant', quantity: 1 }, 20 + i, 4);
    sync(tablet, phone, false);
    expect(stackQuantityOf(phone.ledger, 'cinder-ore')).toBe(5);
    expect(stackQuantityOf(tablet.ledger, 'cinder-ore')).toBe(5);
  });

  it('reads a pre-fold save: global checkpoints become a legacy fold with the same totals', () => {
    const merged = mergeInventoryLedgers({
      version: 2, records: [], tombstones: [], goldFromSales: 0, sold: 0, hlc: 9, legacyBackup: null, era: 55,
      stackOps: [
        { id: 'old', stackKey: 'cinder-ore', kind: 'grant', quantity: 3, hlc: 4, deviceId: 'a', sequence: 1 },
        { id: 'new', stackKey: 'cinder-ore', kind: 'grant', quantity: 2, hlc: 8, deviceId: 'a', sequence: 1 },
      ],
      stackCheckpoints: [{ stackKey: 'cinder-ore', quantity: 10, upToHlc: 5 }],
    }, null);
    expect(stackQuantityOf(merged, 'cinder-ore')).toBe(12);
  });
});
