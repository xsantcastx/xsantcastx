/**
 * inventory-compaction.spec.ts — save compaction (docs/handoff/save-compaction.md): the packed cloud format, the
 * tombstone floor, folding a quiet device's stack ops, and the size guard — and that none of it costs the merge its
 * laws. The merge is checked as a join on random ledgers (commutative, associative, idempotent, packed or plain), and
 * a compacted save is merged against the stale copies an old device would still hold.
 */
import {
  boundTombstones,
  coerceInventoryLedger,
  compactInventoryLedger,
  emptyInventoryLedger,
  foldDormantDevices,
  inventoryCloudBytes,
  isPackedInventory,
  mergeInventoryLedgers,
  opIdHash,
  packInventory,
  stackQuantityOf,
  unpackInventory,
} from './inventory-ops';
import {
  INVENTORY_DORMANT_DEVICE_MS,
  INVENTORY_TOMBSTONE_RETAIN_MS,
  type InventoryLedger,
  type InventoryStackOp,
  type OwnedItemInstance,
  type OwnedItemRecord,
} from './inventory.model';

const T0 = 1_790_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function item(id: string, hlc: number, deviceId = 'dev-a', over: Partial<OwnedItemInstance> = {}): OwnedItemInstance {
  return {
    id, definitionId: `def-${id.split('-')[0]}`, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare',
    soulbound: false, acquiredAt: new Date(T0 - DAY).toISOString(), revision: { hlc, deviceId, sequence: 1 }, source: 'inventory',
    name: `Blade ${id}`, type: 'artifact', lore: 'Forged where the light gave out.', stats: { attackDamage: 12, critChance: 3.5 },
    rollQuality: { critChance: 0.4217, attackDamage: 0.9 }, itemLevel: 9, sellValue: 30, econ: 3, location: { kind: 'bag' },
    upgradeLevel: 0, ...over,
  };
}
const op = (id: string, stackKey: string, kind: 'grant' | 'consume', quantity: number, hlc: number, deviceId: string): InventoryStackOp =>
  ({ id, stackKey, kind, quantity, hlc, deviceId, sequence: 1 });
const ledger = (over: Partial<InventoryLedger> = {}): InventoryLedger => ({ ...emptyInventoryLedger(), ...over });
const KEYS = ['ore', 'herb', 'torch'];

/** What a player owns and what the merge has decided, independent of list order. */
function view(l: InventoryLedger): string {
  const sorted = <T>(xs: T[], key: (x: T) => string) => [...xs].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return JSON.stringify({
    records: sorted(l.records, r => r.id).map(r => [r.id, r.revision, r.kind === 'instance' ? r.location : r.stackKey]),
    tombstones: sorted(l.tombstones, t => t.id).map(t => [t.id, t.revision, t.deletedAt]),
    floor: l.tombFloor ?? 0,
    stacks: KEYS.map(k => stackQuantityOf(l, k)),
    folds: (l.stackFolds ?? []).map(f => [f.deviceId, f.upToHlc, f.net, f.ids]),
  });
}
/** Only what the player sees: their items and their stack counts. */
function owned(l: InventoryLedger): string {
  return JSON.stringify({ items: l.records.map(r => r.id).sort(), stacks: KEYS.map(k => stackQuantityOf(l, k)) });
}

/** A random device copy drawn from one shared pool of ids, revisions, tombstones, floors, ops and folds. */
function randomLedger(r: () => number): InventoryLedger {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const devices = ['dev-a', 'dev-b', 'dev-c'];
  const records: OwnedItemRecord[] = [];
  for (let i = 0; i < 12; i++) {
    if (r() < 0.5) continue;
    const loc = r() < 0.5 ? { kind: 'bag' as const } : { kind: 'explorer' as const, explorerId: pick(['vault:gear', 'vault:general-2']) };
    records.push(item(`it-${i}`, T0 + Math.floor(r() * 6) * 100, pick(devices), { location: loc }));
  }
  const tombstones = [];
  for (let i = 0; i < 12; i++) {
    if (r() < 0.75) continue;
    const hlc = T0 + Math.floor(r() * 6) * 100 + 50;
    tombstones.push({ id: `it-${i}`, revision: { hlc, deviceId: pick(devices), sequence: 2 }, deletedAt: hlc });
  }
  const stackOps: InventoryStackOp[] = [];
  for (let i = 0; i < 16; i++) {
    if (r() < 0.5) continue;
    stackOps.push(op(`op-${i}`, KEYS[i % 3], i % 4 === 3 ? 'consume' : 'grant', 1 + (i % 5), T0 + i * 10, devices[i % 3]));
  }
  const stackFolds = r() < 0.5 ? [] : [{
    deviceId: 'dev-a', upToHlc: T0 + Math.floor(r() * 4) * 30, net: { ore: Math.floor(r() * 9) }, ids: [opIdHash('op-0'), opIdHash('op-3')],
  }];
  // A floor is only ever raised by compaction, which leaves nothing alive at or below it (re-stamped or dead).
  const tombFloor = r() < 0.4 ? T0 + Math.floor(r() * 6) * 100 : 0;
  return ledger({
    records: records.filter(row => row.revision.hlc > tombFloor), tombstones, stackOps, ...(stackFolds.length ? { stackFolds } : {}),
    hlc: T0 + 1000, ...(tombFloor ? { tombFloor } : {}),
  });
}

describe('save compaction: the packed cloud format', () => {
  it('round-trips a ledger exactly, and the merges read it as the ledger it encodes', () => {
    const r = rng(7);
    for (let n = 0; n < 50; n++) {
      const l = randomLedger(r);
      const plain = JSON.parse(JSON.stringify(l));
      const packed = packInventory(plain) as Record<string, unknown>;
      expect(isPackedInventory(packed)).toBeTrue();
      expect(JSON.stringify(unpackInventory(JSON.parse(JSON.stringify(packed))))).toBe(JSON.stringify(unpackInventory(packed)));
      expect(view(coerceInventoryLedger(packed)!)).toBe(view(coerceInventoryLedger(plain)!));
    }
  });

  it('keeps stat maps in the order they were written (a card lists them in that order)', () => {
    const l = ledger({ records: [item('it-1', T0, 'dev-a', { stats: { critChance: 3, attackDamage: 9, life: 1 } })] });
    const back = coerceInventoryLedger(packInventory(JSON.parse(JSON.stringify(l))))!;
    expect(Object.keys((back.records[0] as OwnedItemInstance).stats)).toEqual(['critChance', 'attackDamage', 'life']);
  });

  it('is well under half the size of the v2 document for a vault of gear', () => {
    const records = Array.from({ length: 300 }, (_, i) => item(`it-${i}`, T0 + i, i % 2 ? 'aaaaaaaa-1111-2222-3333-444444444444' : 'bbbbbbbb-1111-2222-3333-444444444444',
      { location: { kind: 'explorer', explorerId: 'vault:general-2' } }));
    const l = ledger({ records });
    expect(inventoryCloudBytes(l)).toBeLessThan(JSON.stringify(l).length / 2);
  });
});

describe('save compaction: the merge stays a join', () => {
  it('is commutative, associative and idempotent on random ledgers, packed or plain', () => {
    const r = rng(42);
    for (let n = 0; n < 300; n++) {
      const a = randomLedger(r), b = randomLedger(r), c = randomLedger(r);
      const ab = mergeInventoryLedgers(a, b);
      expect(view(ab)).withContext(`commutative #${n}`).toBe(view(mergeInventoryLedgers(b, a)));
      expect(view(mergeInventoryLedgers(ab, c))).withContext(`associative #${n}`)
        .toBe(view(mergeInventoryLedgers(a, mergeInventoryLedgers(b, c))));
      expect(view(mergeInventoryLedgers(ab, ab))).withContext(`idempotent #${n}`).toBe(view(ab));
      const packed = packInventory(JSON.parse(JSON.stringify(a)));
      expect(view(mergeInventoryLedgers(packed, b))).withContext(`packed #${n}`).toBe(view(ab));
    }
  });

  it('never loses an item or a stack count to compaction, against any stale copy, in either order', () => {
    const r = rng(1234);
    for (let n = 0; n < 200; n++) {
      const a = randomLedger(r), stale = randomLedger(r);
      // Recent enough that only the cap, never age, could drop anything: compaction must not change what is owned.
      const compacted = compactInventoryLedger(a, 'dev-a', T0 + 2000);
      expect(owned(compacted)).withContext(`compact #${n}`).toBe(owned(a));
      const cloud = packInventory(JSON.parse(JSON.stringify(compacted)));
      expect(owned(mergeInventoryLedgers(cloud, stale))).withContext(`cloud×stale #${n}`).toBe(owned(mergeInventoryLedgers(a, stale)));
      expect(owned(mergeInventoryLedgers(stale, cloud))).withContext(`stale×cloud #${n}`).toBe(owned(mergeInventoryLedgers(stale, a)));
    }
  });
});

describe('save compaction: the tombstone floor', () => {
  const now = T0 + 60 * DAY;
  // The cloud: the sword was deleted 40 days ago; the hammer lives.
  const cloud = ledger({
    records: [item('hammer-1', T0)],
    tombstones: [{ id: 'sword-1', revision: { hlc: T0 + 5, deviceId: 'dev-a', sequence: 2 }, deletedAt: T0 + 5 }],
    hlc: T0 + 5,
  });
  // A phone that slept through all of it: it still holds the sword, and the hammer.
  const phone = ledger({ records: [item('sword-1', T0), item('hammer-1', T0)], hlc: T0 });

  it('drops tombstones past the window and raises the floor to their time', () => {
    const bounded = boundTombstones(cloud, now);
    expect(bounded.tombstones).toEqual([]);
    expect(bounded.tombFloor).toBe(T0 + 5);
    expect(bounded.hlc).toBeGreaterThanOrEqual(T0 + 5);
    expect(boundTombstones(bounded, now)).toBe(bounded);
    // What it still holds at or below the floor is re-stamped just above it, so it outlives the floor everywhere.
    expect(bounded.records[0].revision).toEqual({ hlc: T0 + 6, deviceId: 'compaction', sequence: 1 });
  });

  it('a stale device cannot resurrect what a dropped tombstone killed — in either order, packed or not', () => {
    const bounded = boundTombstones(cloud, now);
    const packed = packInventory(JSON.parse(JSON.stringify(bounded)));
    for (const merged of [mergeInventoryLedgers(bounded, phone), mergeInventoryLedgers(phone, bounded), mergeInventoryLedgers(packed, phone), mergeInventoryLedgers(phone, packed)]) {
      expect(merged.records.map(r => r.id)).toEqual(['hammer-1']);
      expect(merged.tombFloor).toBe(T0 + 5);
    }
  });

  it('keeps what the phone found or moved after the floor, and what both sides hold', () => {
    const bounded = boundTombstones(cloud, now);
    const fresh = ledger({ records: [item('sword-1', T0), item('hammer-1', T0 + 9, 'dev-p'), item('axe-1', T0 + 6, 'dev-p')], hlc: T0 + 9 });
    const merged = mergeInventoryLedgers(fresh, bounded);
    expect(merged.records.map(r => r.id).sort()).toEqual(['axe-1', 'hammer-1']);
    expect(merged.records.find(r => r.id === 'hammer-1')!.revision.deviceId).toBe('dev-p');
  });

  it('a server tombstone (hlc = MAX) raises the floor only to the moment it was written', () => {
    const traded = ledger({
      records: [], hlc: T0,
      tombstones: [{ id: 'sword-1', revision: { hlc: Number.MAX_SAFE_INTEGER, deviceId: 'trade', sequence: 1 }, deletedAt: T0 + 5 }],
    });
    const bounded = boundTombstones(traded, now);
    expect(bounded.tombFloor).toBe(T0 + 5);
    const later = ledger({ records: [item('loot-1', T0 + 6, 'dev-p')] });
    expect(mergeInventoryLedgers(bounded, later).records.map(r => r.id)).toEqual(['loot-1']);
  });

  it('caps the count, oldest first, and the floor covers what the cap dropped', () => {
    const tombstones = Array.from({ length: 10 }, (_, i) => ({ id: `x-${i}`, revision: { hlc: T0 + i, deviceId: 'dev-a', sequence: 2 }, deletedAt: T0 + i }));
    const bounded = boundTombstones(ledger({ tombstones }), T0 + 20, 'dev-a', INVENTORY_TOMBSTONE_RETAIN_MS, 4);
    expect(bounded.tombstones.map(t => t.id)).toEqual(['x-6', 'x-7', 'x-8', 'x-9']);
    expect(bounded.tombFloor).toBe(T0 + 5);
  });
});

describe('save compaction: a quiet device\'s stack ops', () => {
  const old = T0 - INVENTORY_DORMANT_DEVICE_MS - DAY;
  const base = ledger({
    stackOps: [
      op('q1', 'ore', 'grant', 5, old, 'dev-q'), op('q2', 'ore', 'consume', 2, old + 1, 'dev-q'), op('q3', 'herb', 'grant', 4, old + 2, 'dev-q'),
      op('a1', 'ore', 'grant', 1, T0 - 10, 'dev-a'),
    ],
    hlc: T0,
  });

  it('folds them for it, keeping every count, and leaves its own and recent devices\' ops alone', () => {
    const folded = foldDormantDevices(base, 'dev-a', T0);
    expect(folded.stackOps.map(o => o.id)).toEqual(['a1']);
    expect(folded.stackFolds).toEqual([{ deviceId: 'dev-q', upToHlc: old + 2, net: { ore: 3, herb: 4 }, ids: ['q1', 'q2', 'q3'].map(opIdHash) }]);
    expect(KEYS.map(k => stackQuantityOf(folded, k))).toEqual(KEYS.map(k => stackQuantityOf(base, k)));
    expect(foldDormantDevices(base, 'dev-a', old + 3)).toBe(base);
  });

  it('the quiet device comes back with its old copy and new ops: nothing counted twice, nothing lost', () => {
    const folded = foldDormantDevices(base, 'dev-a', T0);
    const back = { ...base, stackOps: [...base.stackOps, op('q4', 'ore', 'grant', 10, T0 + 5, 'dev-q')] };
    for (const merged of [mergeInventoryLedgers(folded, back), mergeInventoryLedgers(back, folded)]) {
      expect(stackQuantityOf(merged, 'ore')).toBe(5 - 2 + 1 + 10);
      expect(stackQuantityOf(merged, 'herb')).toBe(4);
      expect(merged.stackOps.map(o => o.id).sort()).toEqual(['a1', 'q4']);
    }
  });
});

describe('save compaction: the size guard', () => {
  it('compacts hard past the guard and keeps every item and count', () => {
    const ops = Array.from({ length: 900 }, (_, i) => op(`g-${i}-${'x'.repeat(40)}`, KEYS[i % 3], 'grant', 1, T0 - 3 * DAY + i, `other-${i % 3}`));
    const tombstones = Array.from({ length: 1024 }, (_, i) => ({ id: `t-${i}-${'y'.repeat(30)}`, revision: { hlc: T0 - DAY + i, deviceId: 'dev-a', sequence: 2 }, deletedAt: T0 - DAY + i }));
    const records = Array.from({ length: 600 }, (_, i) => item(`it-${i}`, T0 - DAY, 'dev-a', { lore: `Unique lore ${i} `.repeat(20) }));
    const big = ledger({ records, stackOps: ops, tombstones, hlc: T0 });
    expect(inventoryCloudBytes(big)).toBeGreaterThan(400_000);
    const soft = compactInventoryLedger(big, 'dev-a', T0);
    const hard = compactInventoryLedger(big, 'dev-a', T0, { checkSize: true });
    expect(soft.stackOps.length).toBe(900);
    expect(hard.stackOps.length).toBe(0);
    expect(hard.tombstones.length).toBe(512);
    expect(inventoryCloudBytes(hard)).toBeLessThan(inventoryCloudBytes(soft));
    expect(owned(hard)).toBe(owned(big));
  });
});
