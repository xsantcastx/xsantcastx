/**
 * market-protocol.spec.ts — the server's save edits, run through the client's
 * own merges.
 *
 * The market functions edit a player's cloud save (functions/src/market/
 * save-ops.ts) and then the client merges that document with whatever the
 * device holds. Those are two codebases agreeing on one protocol, and this is
 * the spec that holds them to it: every server edit below is fed through the
 * real `mergeInventoryLedgers` / `mergeEconomyLedgers`, in both argument orders,
 * against a stale local copy that never saw the edit.
 */
import {
  applyGoldOp,
  deliverInstance,
  escrowInstance,
  escrowStack,
  findListableInstance,
  grantStackTo,
  readEconomy,
  readInventory,
  reassertInventoryMarks,
  snapshotInstance,
} from '../../../../functions/src/market/save-ops';
import { INVENTORY_ERA } from '../rpg/inventory.model';
import {
  itemsFromLedger,
  mergeInventoryLedgers,
  stackQuantityOf,
} from '../rpg/inventory-ops';
import { applyOps, emptyLedger, mergeEconomyLedgers, type EconomyLedger } from '../economy/economy-ops';
import type { InventoryLedger } from '../rpg/inventory.model';

const NOW = Date.UTC(2026, 9, 12, 12);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function inventory(): InventoryLedger {
  return {
    version: 2,
    records: [
      {
        id: 'ring-1', definitionId: 'anchor-ring', kind: 'instance', category: 'artifacts', tags: ['artifact'],
        rarity: 'rare', soulbound: false, acquiredAt: new Date(NOW - 60_000).toISOString(),
        revision: { hlc: NOW - 60_000, deviceId: 'dev-a', sequence: 2 }, source: 'inventory',
        name: 'Rare Anchor Ring', type: 'artifact', stats: { magicFind: 12 }, sellValue: 900, location: { kind: 'bag' },
      },
      {
        id: 'stack:cinder-ore', definitionId: 'cinder-ore', kind: 'stack', category: 'materials',
        tags: ['material', 'cinder-ore'], soulbound: false, acquiredAt: new Date(NOW - 50_000).toISOString(),
        revision: { hlc: NOW - 50_000, deviceId: 'dev-a', sequence: 3 }, source: 'inventory',
        stackKey: 'cinder-ore', location: { kind: 'bag' },
      },
    ],
    tombstones: [],
    stackOps: [{
      id: 'g1', stackKey: 'cinder-ore', kind: 'grant', quantity: 40,
      hlc: NOW - 50_000, deviceId: 'dev-a', sequence: 3,
    }],
    goldFromSales: 0,
    sold: 0,
    hlc: NOW - 50_000,
    legacyBackup: null,
    era: INVENTORY_ERA,
  };
}

/** What the server reads: the stored envelope. */
function stored(v: unknown): Record<string, unknown> {
  return { v: clone(v), updatedAt: new Date(NOW).toISOString() };
}

function economyWithLog(gold: number): EconomyLedger {
  const origin = emptyLedger();
  const ops = [{ id: 'dev-a:1', deviceId: 'dev-a', seq: 1, kind: 'credit-gold' as const, amount: gold, hlc: NOW - 5000, wall: NOW - 5000 }];
  const state = applyOps(origin, ops).state;
  return { ...state, ops, origin, hlc: NOW - 5000 };
}

function economyLegacy(gold: number): EconomyLedger {
  return { ...emptyLedger(), gold };
}

describe('market protocol: server save edits survive the client merge', () => {
  it('an escrowed instance stays gone even against a later edit from an unsynced device', () => {
    const local = inventory();
    const server = readInventory(stored(local), false);
    const record = findListableInstance(server, 'ring-1', 'eq:anchor-ring:rare');
    const escrowed = escrowInstance(server, record, NOW).ledger;

    // A second device upgrades the ring an hour later without having synced.
    const stale = clone(local);
    const ring = stale.records[0] as InventoryLedger['records'][number] & { upgradeLevel?: number };
    ring.revision = { hlc: NOW + 3_600_000, deviceId: 'dev-b', sequence: 9 };
    ring.upgradeLevel = 1;

    for (const merged of [mergeInventoryLedgers(escrowed, stale), mergeInventoryLedgers(stale, escrowed)]) {
      expect(merged.records.some(r => r.id === 'ring-1')).toBeFalse();
      expect(itemsFromLedger(merged).some(i => i.id === 'ring-1')).toBeFalse();
    }
  });

  it('an escrowed stack debit is kept by the union of stack ops', () => {
    const local = inventory();
    const server = readInventory(stored(local), false);
    const after = escrowStack(server, 'cinder-ore', 30, 'mkt:escrow:o1', 1, NOW).ledger;
    expect(stackQuantityOf(mergeInventoryLedgers(after, local), 'cinder-ore')).toBe(10);
    expect(stackQuantityOf(mergeInventoryLedgers(local, after), 'cinder-ore')).toBe(10);
    // Merging twice does not debit twice.
    const twice = mergeInventoryLedgers(mergeInventoryLedgers(after, local), after);
    expect(stackQuantityOf(twice, 'cinder-ore')).toBe(10);
  });

  it('re-asserting after a "keep this device" overwrite restores the escrow exactly once', () => {
    const local = inventory();
    const server = readInventory(stored(local), false);
    const inst = escrowInstance(server, findListableInstance(server, 'ring-1', 'eq:anchor-ring:rare'), NOW);
    const stack = escrowStack(inst.ledger, 'cinder-ore', 30, 'mkt:escrow:o2', 1, NOW);
    const marks = [inst.mark, stack.mark];
    // The cloud copy is overwritten by the pre-market local save...
    const overwritten = readInventory(stored(local), false);
    const healed = reassertInventoryMarks(reassertInventoryMarks(overwritten, marks), marks);
    const merged = mergeInventoryLedgers(healed, local);
    expect(merged.records.some(r => r.id === 'ring-1')).toBeFalse();
    expect(stackQuantityOf(merged, 'cinder-ore')).toBe(10);
  });

  it('deliveries (a bought instance, a stack grant) are adopted and the roll travels intact', () => {
    const local = inventory();
    const server = readInventory(stored(local), false);
    const seller = { ...(local.records[0] as unknown as Record<string, unknown>), id: 'seller-ring', stats: { magicFind: 19, xpBonus: 3 } };
    const snap = snapshotInstance(seller);
    const delivered = deliverInstance(server, snap, 'mkt-o9-1', 1, NOW);
    expect(delivered).not.toBeNull();
    const granted = grantStackTo(delivered!, 'slag-fragment', 25, 'mkt:claim:o9-2', 2, NOW);
    expect(granted).not.toBeNull();
    const merged = mergeInventoryLedgers(local, granted!.ledger);
    const item = itemsFromLedger(merged).find(i => i.id === 'mkt-o9-1');
    expect(item?.stats).toEqual({ magicFind: 19, xpBonus: 3 });
    expect(item?.definitionId).toBe('anchor-ring');
    expect(stackQuantityOf(merged, 'slag-fragment')).toBe(25);
    expect(stackQuantityOf(merged, 'cinder-ore')).toBe(40);
  });

  for (const [label, make] of [['op-log', economyWithLog], ['legacy', economyLegacy]] as const) {
    it(`a Gold escrow debit merges to exactly one debit (${label} ledger)`, () => {
      const local = make(5_000);
      const server = readEconomy(stored(local));
      const spent = applyGoldOp(server, 'spend-gold', 1_200, 1, NOW).ledger;
      expect(mergeEconomyLedgers(spent, local).gold).toBe(3_800);
      expect(mergeEconomyLedgers(local, spent).gold).toBe(3_800);
      expect(mergeEconomyLedgers(mergeEconomyLedgers(spent, local), spent).gold).toBe(3_800);
    });

    it(`a Gold credit from collect merges to exactly one credit (${label} ledger)`, () => {
      const local = make(5_000);
      const server = readEconomy(stored(local));
      const credited = applyGoldOp(server, 'credit-gold', 700, 1, NOW).ledger;
      expect(mergeEconomyLedgers(credited, local).gold).toBe(5_700);
      expect(mergeEconomyLedgers(local, credited).gold).toBe(5_700);
    });
  }

  it('a client spend made concurrently with the escrow (later hlc) still leaves both debits', () => {
    const local = economyWithLog(5_000);
    const server = readEconomy(stored(local));
    const spent = applyGoldOp(server, 'spend-gold', 1_000, 1, NOW).ledger;
    const device = clone(local);
    device.ops = [...device.ops, { id: 'dev-a:2', deviceId: 'dev-a', seq: 2, kind: 'spend-gold', amount: 500, hlc: NOW + 10, wall: NOW + 10 }];
    device.gold = 4_500;
    expect(mergeEconomyLedgers(spent, device).gold).toBe(3_500);
  });
});
