/**
 * trade-merge.spec.ts — the interplay that makes trades dupe-proof: the server's writes (functions/src/trade-core.ts,
 * the real file, run here) against the client's own merges (inventory-ops mergeInventoryLedgers, economy-ops
 * mergeEconomyLedgers). A device that still holds its pre-trade copy — even one that touched the traded item since —
 * must end up with what the server decided, never with the item back or the Gold twice.
 */
import * as core from '../../../../functions/src/trade-core';
import { emptyLedger, mergeEconomyLedgers } from '../../shared/economy/economy-ops';
import { emptyInventoryLedger, itemToRecord, itemsFromLedger, mergeInventoryLedgers, recordToItem } from '../../shared/rpg/inventory-ops';
import type { InventoryLedger, OwnedItemInstance } from '../../shared/rpg/inventory.model';
import type { GameItem } from '../../shared/rpg/item.model';
import { canonical, offerItemOf } from './trade-items';

const T0 = Date.now();
const item = (id: string, over: Partial<GameItem> = {}): GameItem => ({
  id, name: `Blade ${id}`, type: 'artifact', rarity: 'rare', stats: { strikePower: 12 }, rollQuality: { strikePower: 0.62 }, itemLevel: 9,
  sellValue: 30, equipped: false, foundAt: new Date(T0 - 60000).toISOString(), soulbound: false, definitionId: `forge:${id}`, ...over,
});
function bag(items: GameItem[]): InventoryLedger {
  return { ...emptyInventoryLedger(), records: items.map(i => ({ ...itemToRecord(i), revision: { hlc: T0 - 1000, deviceId: 'dev', sequence: 1 } })), hlc: T0 - 1000 };
}
function purse(gold: number) { return { ...emptyLedger(), gold, hlc: T0 - 1000 }; }
const env = (v: unknown) => JSON.parse(JSON.stringify({ v, updatedAt: '' })) as Record<string, unknown>;

async function trade(a: InventoryLedger, b: InventoryLedger, aGold: number, bGold: number, give: { a: string[]; b: string[]; aGold: number; bGold: number }) {
  const db = core.memoryDb();
  db.docs.set('users/A/progress/inventory', env(a));
  db.docs.set('users/B/progress/inventory', env(b));
  db.docs.set('users/A/economy/state', env(purse(aGold)));
  db.docs.set('users/B/economy/state', env(purse(bGold)));
  db.docs.set('trades/t', { a: { uid: 'A', player: 'pa', name: 'Aster' }, b: { uid: 'B', player: 'pb', name: 'Bryn' }, status: 'open', openedAt: T0, expiresAt: T0 + 60000 });
  const offer = (l: InventoryLedger, ids: string[]) => ids.map(id => offerItemOf(itemsFromLedger(l).find(i => i.id === id)!));
  const terms = { a: { items: offer(a, give.a), gold: give.aGold }, b: { items: offer(b, give.b), gold: give.bGold } };
  await core.executeTrade(db, 'A', { trade: 't', character: 'c1', terms }, T0);
  const out = await core.executeTrade(db, 'B', { trade: 't', character: 'c1', terms }, T0 + 1);
  const v = (p: string) => (db.docs.get(p) as { v: unknown }).v;
  return { out, invA: v('users/A/progress/inventory'), invB: v('users/B/progress/inventory'), ecoA: v('users/A/economy/state'), ecoB: v('users/B/economy/state') };
}

describe('trades speak the merge (trade-core × the client merges)', () => {
  it('the client builds the same offer the server reads off the saved record', () => {
    const i = item('s1', { upgradeLevel: 2, sockets: ['rune-ash', null], reforgeCount: 1 });
    const rec = itemToRecord(i);
    expect(canonical(offerItemOf(recordToItem(rec)))).toBe(core.canonical(core.offerOf(rec as unknown as Record<string, unknown>)));
    expect(core.sameItem(rec as unknown as Record<string, unknown>, offerItemOf(i) as core.OfferItem)).toBeTrue();
  });

  it('a stale device that still holds (and even re-equips) the traded item loses it on merge; the receiver keeps it', async () => {
    const a = bag([item('s1'), item('s2')]), b = bag([]);
    const r = await trade(a, b, 0, 0, { a: ['s1'], b: [], aGold: 0, bGold: 0 });
    expect(r.out.status).toBe('done');
    // Aster's other device: never pulled, and equipped the sword a minute after the trade.
    const stale = { ...a, records: a.records.map(x => x.id === 's1' ? { ...x, location: { kind: 'equipped' as const, slotId: 'weapon' as const }, revision: { hlc: T0 + 60000, deviceId: 'phone', sequence: 9 } } : x) };
    const merged = mergeInventoryLedgers(r.invA, stale);
    expect(itemsFromLedger(merged).map(i => i.id)).toEqual(['s2']);
    expect(itemsFromLedger(mergeInventoryLedgers(stale, r.invA)).map(i => i.id)).toEqual(['s2']);
    // The merge keeps the server's write count (the inventory rule's guard).
    expect(merged.serverSeq).toBe(1);
    // Bryn's stale copy (an empty bag) merged with the server's: the sword, once, with its frozen roll.
    const got = itemsFromLedger(mergeInventoryLedgers(b, r.invB));
    expect(got.length).toBe(1);
    expect(got[0].rollQuality).toEqual({ strikePower: 0.62 });
    expect((mergeInventoryLedgers(b, r.invB).records[0] as OwnedItemInstance).location).toEqual({ kind: 'bag' });
  });

  it('an item that comes back to its first owner arrives under a new id, so the old tombstone cannot eat it', async () => {
    const a = bag([item('s1')]);
    const first = await trade(a, bag([]), 0, 0, { a: ['s1'], b: [], aGold: 0, bGold: 0 });
    const bLedger = mergeInventoryLedgers(first.invB, bag([]));
    const back = await trade(mergeInventoryLedgers(first.invA, a), bLedger, 0, 0, { a: [], b: [itemsFromLedger(bLedger)[0].id], aGold: 0, bGold: 0 });
    expect(back.out.status).toBe('done');
    const home = mergeInventoryLedgers(back.invA, a);
    expect(itemsFromLedger(home).length).toBe(1);
    expect(itemsFromLedger(home)[0].name).toBe('Blade s1');
  });

  it('Gold: a stale purse merged with the server\'s lands on the traded balance, once, and receiving is not earning', async () => {
    const r = await trade(bag([]), bag([]), 500, 40, { a: [], b: [], aGold: 120, bGold: 0 });
    expect(r.out.status).toBe('done');
    const staleA = purse(500), staleB = purse(40);
    expect(mergeEconomyLedgers(r.ecoA, staleA).gold).toBe(380);
    expect(mergeEconomyLedgers(staleA, r.ecoA).gold).toBe(380);
    const b = mergeEconomyLedgers(r.ecoB, staleB);
    expect(b.gold).toBe(160);
    expect(b.totalGoldEarned).toBe(0);
    // Merged again (another device, another pull): still once.
    expect(mergeEconomyLedgers(b, r.ecoB).gold).toBe(160);
    expect(mergeEconomyLedgers(mergeEconomyLedgers(r.ecoA, staleA), r.ecoA).gold).toBe(380);
  });

  it('Gold: a device that spent locally before syncing still cannot spend the traded Gold twice', async () => {
    const r = await trade(bag([]), bag([]), 500, 0, { a: [], b: [], aGold: 400, bGold: 0 });
    // Aster's phone, offline, bought something for 300 after the trade (its op is later than the trade's).
    const phone = { ...purse(500), origin: { ...purse(500), ops: [], origin: null }, ops: [{ id: 'phone:1', deviceId: 'phone', seq: 1, kind: 'spend-gold' as const, amount: 300, hlc: T0 + 5000, wall: T0 + 5000 }], gold: 200 };
    const merged = mergeEconomyLedgers(r.ecoA, phone);
    // 500 − 400 (the trade) = 100: the phone's 300 cannot be afforded on replay and is skipped. Never negative, never 200.
    expect(merged.gold).toBe(100);
  });
});
