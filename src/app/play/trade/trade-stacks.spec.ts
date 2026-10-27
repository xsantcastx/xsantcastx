/**
 * trade-stacks.spec.ts — the trade window shows the WHOLE satchel, stacked, and a stack trades by amount
 * (owner 2026-10-27: "when trading, it's not showing my inventory complete", "all items are unstacked").
 *
 * The window read `snapshot.bag` (gear instances, one cell each): potions, fish, meals, logs, runes and materials —
 * satchel stacks — were missing, and a pile of identical Spellstones came apart. `satchelGroups` reads the satchel grid;
 * trade-core moves a stack as one consume op on the giver and one grant op on the taker (the real file, run here,
 * then merged the way a device merges).
 */
import * as core from '../../../../functions-game/src/trade-core';
import { emptyInventoryLedger, mergeInventoryLedgers, opIdHash, stackQuantityOf } from '../../shared/rpg/inventory-ops';
import { gridLayout } from '../../shared/rpg/inventory-grid';
import { QUEST_STACKS } from '../../shared/rpg/inventory-layout';
import type { InventoryLedger, OwnedItemInstance, OwnedItemStack } from '../../shared/rpg/inventory.model';
import { groupOffers, satchelGroups, stackOfferOf, type OfferItem } from './trade-items';

const T0 = Date.now();
const rev = { hlc: T0 - 1000, deviceId: 'dev', sequence: 1 };
function inst(id: string, definitionId: string, over: Partial<OwnedItemInstance> = {}): OwnedItemInstance {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: new Date(T0 - 1000).toISOString(), revision: rev, source: 'inventory',
    name: 'Spellstone', type: 'artifact', stats: {}, sellValue: 0, location: { kind: 'bag' }, ...over,
  };
}
const stackRec = (key: string): OwnedItemStack => ({
  id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
  acquiredAt: new Date(T0 - 1000).toISOString(), revision: rev, source: 'inventory', stackKey: key, location: { kind: 'bag' },
});
function satchel(records: OwnedItemInstance[], stacks: Record<string, number>): InventoryLedger {
  const keys = Object.keys(stacks);
  return {
    ...emptyInventoryLedger(), era: core.INVENTORY_ERA, hlc: T0 - 1000,
    records: [...records, ...keys.map(stackRec)],
    stackOps: keys.map((k, i) => ({ id: `g-${k}`, stackKey: k, kind: 'grant' as const, quantity: stacks[k], hlc: T0 - 1000, deviceId: 'dev', sequence: i + 1 })),
  };
}
const env = (v: unknown) => JSON.parse(JSON.stringify({ v, updatedAt: '' })) as Record<string, unknown>;
async function settle(a: InventoryLedger, b: InventoryLedger, terms: { a: OfferItem[]; b: OfferItem[] }) {
  const db = core.memoryDb();
  db.docs.set('users/A/progress/inventory', env(a));
  db.docs.set('users/B/progress/inventory', env(b));
  db.docs.set('trades/t', { a: { uid: 'A', player: 'pa', name: 'Aster' }, b: { uid: 'B', player: 'pb', name: 'Bryn' }, status: 'open', openedAt: T0, expiresAt: T0 + 60000 });
  const out = await core.settleTrade(db, { trade: 't', a: { uid: 'A', character: 'c1' }, b: { uid: 'B', character: 'c1' }, terms: { a: { items: terms.a, gold: 0 }, b: { items: terms.b, gold: 0 } } }, T0);
  const v = (p: string) => (db.docs.get(p) as { v: unknown }).v;
  return { out, invA: v('users/A/progress/inventory'), invB: v('users/B/progress/inventory') };
}

describe('the trade window lists the whole satchel, stacked', () => {
  const ledger = satchel(
    [inst('st-1', 'spellstone:hellfire-nova@1#0', { charges: 6 }), inst('st-2', 'spellstone:hellfire-nova@1#0', { charges: 6 }), inst('s1', 'astral-helm', { name: 'Ash Blade', stats: { defense: 3 } })],
    { 'minor-health-potion': 5, 'baked-ash-perch': 7, 'rune-ash': 3, ironwood: 30 },
  );

  it('every stack is one entry with its total, a pile of identical pieces one entry with every id', () => {
    const groups = satchelGroups(gridLayout(ledger).bag, [], []);
    const bySk = Object.fromEntries(groups.filter(g => g.sk).map(g => [g.sk, g.qty]));
    expect(bySk).toEqual({ 'minor-health-potion': 5, 'baked-ash-perch': 7, 'rune-ash': 3, ironwood: 30 });
    const stones = groups.find(g => g.ids.includes('st-1'));
    expect(stones?.ids.sort()).toEqual(['st-1', 'st-2']);
    expect(stones?.qty).toBe(2);
    expect(groups.filter(g => g.ids.includes('s1')).length).toBe(1);
    expect(groups.length).toBe(6);
  });

  it('a stack spread over several piles (60 fish at 20 a cell) is still one entry', () => {
    const groups = satchelGroups(gridLayout(satchel([], { 'baked-ash-perch': 60 })).bag, [], []);
    expect(gridLayout(satchel([], { 'baked-ash-perch': 60 })).bag.pieces.length).toBe(3);
    expect(groups).toEqual([{ sk: 'baked-ash-perch', ids: [], qty: 60 }]);
  });

  it('what is offered comes off (2 of 5 potions leaves ×3; one stone leaves ×1); a fully offered stack is gone', () => {
    const mine = [stackOfferOf('minor-health-potion', 'Minor Health Potion', 2), stackOfferOf('ironwood', 'Ironwood', 30), { id: 'st-2' } as OfferItem];
    const groups = satchelGroups(gridLayout(ledger).bag, [], mine);
    expect(groups.find(g => g.sk === 'minor-health-potion')?.qty).toBe(3);
    expect(groups.find(g => g.sk === 'ironwood')).toBeUndefined();
    expect(groups.find(g => g.ids.includes('st-1'))?.qty).toBe(1);
  });

  it('quest finds (no cell) are listed, marked, never left out; a drop on its way to the ground is', () => {
    const groups = satchelGroups(gridLayout(ledger).bag, [{ stackKey: 'worn-rod', quantity: 1 }], [], id => id === 's1');
    expect(groups.find(g => g.sk === 'worn-rod')).toEqual({ sk: 'worn-rod', ids: [], qty: 1, quest: true });
    expect(groups.some(g => g.ids.includes('s1'))).toBeFalse();
  });

  it('a window groups its offers the same way: a stack ×N, identical pieces ×N', () => {
    const blade = { id: 'a', def: 'd', name: 'Stone', type: 'artifact', rarity: 'rare', stats: {}, ch: 6 };
    const g = groupOffers([stackOfferOf('ironwood', 'Ironwood', 4), blade, { ...blade, id: 'b' }]);
    expect(g.map(x => [x.ids, x.qty])).toEqual([[['stack:ironwood'], 4], [['a', 'b'], 2]]);
  });
});

describe('a stack changes hands by amount (trade-core × the client merge)', () => {
  it('2 of 5 potions: the giver keeps 3, the taker (who never held one) gets 2; stale copies merge to the same', async () => {
    const a = satchel([], { 'minor-health-potion': 5 }), b = satchel([], {});
    const r = await settle(a, b, { a: [stackOfferOf('minor-health-potion', 'Minor Health Potion', 2)], b: [] });
    expect(r.out.status).toBe('done');
    for (const merged of [mergeInventoryLedgers(r.invA, a), mergeInventoryLedgers(a, r.invA)]) expect(stackQuantityOf(merged, 'minor-health-potion')).toBe(3);
    const got = mergeInventoryLedgers(b, r.invB);
    expect(stackQuantityOf(got, 'minor-health-potion')).toBe(2);
    expect(got.records.some(x => x.kind === 'stack' && x.stackKey === 'minor-health-potion')).toBeTrue();
    // The taker's grant is the id the window reports as received.
    const out = r.out;
    if (out.status === 'done') expect(got.stackOps.some(op => op.id === out.received.b.items[0])).toBeTrue();
  });

  it('both Keepers may offer the same kind of stack', async () => {
    const r = await settle(satchel([], { ironwood: 10 }), satchel([], { ironwood: 4 }), { a: [stackOfferOf('ironwood', 'Ironwood', 6)], b: [stackOfferOf('ironwood', 'Ironwood', 1)] });
    expect(r.out.status).toBe('done');
    expect(stackQuantityOf(mergeInventoryLedgers(r.invA, emptyInventoryLedger()), 'ironwood')).toBe(5);
    expect(stackQuantityOf(mergeInventoryLedgers(r.invB, emptyInventoryLedger()), 'ironwood')).toBe(9);
  });

  it('more than is held, a quest find, or a Vault key: refused, nothing moves', async () => {
    const short = await settle(satchel([], { ironwood: 3 }), satchel([], {}), { a: [stackOfferOf('ironwood', 'Ironwood', 4)], b: [] });
    expect(short.out.status).toBe('void');
    expect(stackQuantityOf(mergeInventoryLedgers(short.invA, emptyInventoryLedger()), 'ironwood')).toBe(3);
    const quest = await settle(satchel([], { 'worn-rod': 1 }), satchel([], {}), { a: [stackOfferOf('worn-rod', 'Worn Rod', 1)], b: [] });
    expect(quest.out.status).toBe('void');
    expect(() => core.parseOfferItem({ ...stackOfferOf('ironwood', 'Ironwood', 1), id: 'stack:v:general-1:ironwood', sk: 'v:general-1:ironwood' })).toThrow();
    expect(() => core.parseOfferItem({ ...stackOfferOf('ironwood', 'Ironwood', 1), id: 'x' })).toThrow();
    expect(() => core.parseOfferItem({ ...stackOfferOf('ironwood', 'Ironwood', 1), qty: 0 })).toThrow();
  });

  it('the server\'s copies of the client rules stay pinned: quest finds, the fold hash', () => {
    expect([...core.QUEST_STACK_KEYS].sort()).toEqual([...QUEST_STACKS].sort());
    for (const id of ['x', 'g-ironwood', 'tabc123', 'trade:9:stack:minor-health-potion']) expect(core.opIdHash(id)).toBe(opIdHash(id));
  });
});
