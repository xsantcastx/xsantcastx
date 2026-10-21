/**
 * trade-core.test.mjs — the server half of trading and ground drops (functions/src/trade-core.ts), run through Node's
 * type stripping: the atomic swap, refusal when an item changed, the double-pickup race, expiry going home, and Gold
 * and item conservation across any trade. The client half (the merge honouring these writes) is in karma:
 * src/app/play/trade/trade-merge.spec.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as core from '../functions/src/trade-core.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const T0 = 1_800_000_000_000;

/** An item record as inventory-ops writes it. */
function record(id, over = {}) {
  return {
    id, definitionId: `artifact:${id}`, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: new Date(T0 - 1000).toISOString(), revision: { hlc: T0 - 1000, deviceId: 'dev-a', sequence: 1 }, source: 'inventory',
    name: `Blade ${id}`, type: 'artifact', stats: { strikePower: 12, critChance: 3 }, rollQuality: { strikePower: 0.7 }, itemLevel: 14,
    sellValue: 40, econ: 3, location: { kind: 'bag' }, ...over,
  };
}
const inventory = (records, over = {}) => ({ v: { version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: T0 - 500, legacyBackup: null, era: core.INVENTORY_ERA, ...over }, updatedAt: '' });
const economy = (gold, over = {}) => ({ v: { version: core.ECONOMY_VERSION, goldEra: core.GOLD_ERA, gold, ops: [], origin: null, hlc: T0 - 500, applied: {}, cosmetics: [], totalGoldEarned: gold, runGoldEarned: gold, ...over }, updatedAt: '' });
const A = { uid: 'uidA', player: 'pa', name: 'Aster' }, B = { uid: 'uidB', player: 'pb', name: 'Bryn' };

function world({ aItems = ['s1', 's2'], bItems = ['r1'], aGold = 500, bGold = 50 } = {}) {
  const db = core.memoryDb();
  db.docs.set('users/uidA/progress/inventory', inventory(aItems.map(id => record(id))));
  db.docs.set('users/uidB/characters/kb2/progress/inventory', inventory(bItems.map(id => record(id, { revision: { hlc: T0 - 900, deviceId: 'dev-b', sequence: 1 } }))));
  db.docs.set('users/uidA/economy/state', economy(aGold));
  db.docs.set('users/uidB/characters/kb2/economy/state', economy(bGold));
  db.docs.set('trades/t1', { a: A, b: B, status: 'open', openedAt: T0, expiresAt: T0 + core.TRADE_TTL_MS });
  return db;
}
const invA = db => db.docs.get('users/uidA/progress/inventory').v;
const invB = db => db.docs.get('users/uidB/characters/kb2/progress/inventory').v;
const goldA = db => db.docs.get('users/uidA/economy/state').v.gold;
const goldB = db => db.docs.get('users/uidB/characters/kb2/economy/state').v.gold;
const offerOf = (db, side, id) => core.offerOf((side === 'a' ? invA(db) : invB(db)).records.find(r => r.id === id));
/** Live (untombstoned) item ids in a save. */
const live = inv => inv.records.filter(r => !inv.tombstones.some(t => t.id === r.id && t.revision.hlc >= r.revision.hlc)).map(r => r.id);

async function both(db, terms, now = T0 + 1000) {
  const first = await core.executeTrade(db, 'uidA', { trade: 't1', character: 'c1', terms }, now);
  const second = await core.executeTrade(db, 'uidB', { trade: 't1', character: 'kb2', terms }, now + 10);
  return { first, second };
}

test('constants match the client they mirror', () => {
  const read = p => readFileSync(`${ROOT}/${p}`, 'utf8');
  assert.match(read('src/app/shared/rpg/inventory.model.ts'), new RegExp(`export const INVENTORY_ERA = ${core.INVENTORY_ERA} as const;`));
  assert.match(read('src/app/shared/economy/economy-curve.ts'), new RegExp(`export const ECONOMY_VERSION = ${core.ECONOMY_VERSION};`));
  assert.match(read('src/app/shared/economy/economy-curve.ts'), new RegExp(`export const GOLD_ERA = ${core.GOLD_ERA};`));
  assert.match(read('src/app/shared/rpg/inventory-layout.ts'), new RegExp(`export const INSTANCE_RECORD_BUDGET = ${core.INSTANCE_RECORD_BUDGET};`));
});

test('the atomic swap: both confirm the same terms, items and Gold change hands in one transaction', async () => {
  const db = world();
  const terms = { a: { items: [offerOf(db, 'a', 's1')], gold: 120 }, b: { items: [offerOf(db, 'b', 'r1')], gold: 0 } };
  const { first, second } = await both(db, terms);
  assert.equal(first.status, 'waiting');
  assert.equal(second.status, 'done');
  // B received the sword under a new id; A's copy is gone behind a tombstone nothing can outrank.
  assert.deepEqual(second.received.items, [`t${core.hashId('t1:s1')}`]);
  assert.ok(!live(invA(db)).includes('s1'));
  assert.ok(live(invA(db)).includes(`t${core.hashId('t1:r1')}`));
  assert.ok(live(invB(db)).includes(`t${core.hashId('t1:s1')}`));
  assert.ok(!live(invB(db)).includes('r1'));
  assert.equal(invA(db).tombstones.find(t => t.id === 's1').revision.hlc, Number.MAX_SAFE_INTEGER);
  // The received record keeps the roll it was minted with (item-rolls-carry-a-frozen-grade).
  const got = invB(db).records.find(r => r.id === `t${core.hashId('t1:s1')}`);
  assert.deepEqual(got.rollQuality, { strikePower: 0.7 });
  assert.deepEqual(got.location, { kind: 'bag' });
  assert.equal(got.revision.deviceId, 'trade');
  assert.equal(invA(db).serverSeq, 1);
  assert.equal(invB(db).serverSeq, 1);
  assert.equal(goldA(db), 380);
  assert.equal(goldB(db), 170);
  // Gold moved as ops the merge replays exactly once; receiving is not "earning".
  const eb = db.docs.get('users/uidB/characters/kb2/economy/state').v;
  assert.deepEqual(eb.ops.map(o => [o.id, o.kind, o.amount]), [['trade:1', 'receive-gold', 120]]);
  assert.equal(eb.totalGoldEarned, 50);
  assert.equal(core.replayGold(eb), 170);
  assert.equal(core.replayGold(db.docs.get('users/uidA/economy/state').v), 380);
  // The first op froze the origin at the balance before it (no double move on the next merge).
  assert.equal(eb.origin.gold, 50);
  assert.equal(db.docs.get('trades/t1').status, 'done');
  assert.ok(db.docs.get('trade-audit/trade-t1'));
});

test('a retry after the swap reports it again and moves nothing twice', async () => {
  const db = world();
  const terms = { a: { items: [offerOf(db, 'a', 's1')], gold: 10 }, b: { items: [], gold: 0 } };
  await both(db, terms);
  const before = JSON.stringify([...db.docs]);
  const again = await core.executeTrade(db, 'uidA', { trade: 't1', character: 'c1', terms }, T0 + 5000);
  assert.equal(again.status, 'done');
  assert.deepEqual(again.received, { items: [], gold: 0 });
  assert.equal(JSON.stringify([...db.docs]), before);
});

test('refused when an offered item changed after it was offered: nothing moves, the trade is void', async () => {
  const db = world();
  const terms = { a: { items: [offerOf(db, 'a', 's1')], gold: 0 }, b: { items: [offerOf(db, 'b', 'r1')], gold: 0 } };
  await core.executeTrade(db, 'uidA', { trade: 't1', character: 'c1', terms }, T0 + 1000);
  // Aster tempers the sword between confirming and Bryn's confirmation.
  const inv = db.docs.get('users/uidA/progress/inventory');
  inv.v.records[0] = { ...inv.v.records[0], upgradeLevel: 1, stats: { strikePower: 14, critChance: 3 } };
  const beforeA = JSON.stringify(invA(db)), beforeB = JSON.stringify(invB(db));
  const out = await core.executeTrade(db, 'uidB', { trade: 't1', character: 'kb2', terms }, T0 + 2000);
  assert.equal(out.status, 'void');
  assert.match(out.why, /changed/);
  assert.equal(JSON.stringify(invA(db)), beforeA);
  assert.equal(JSON.stringify(invB(db)), beforeB);
  assert.equal(db.docs.get('trades/t1').status, 'void');
});

test('refused when an item is gone, worn, soulbound or a starter tool; when the windows disagree; or for a stranger', async () => {
  for (const change of [
    r => ({ ...r, location: { kind: 'equipped', slotId: 'weapon' } }),
    r => ({ ...r, soulbound: true }),
    null,
  ]) {
    const db = world();
    const terms = { a: { items: [offerOf(db, 'a', 's1')], gold: 0 }, b: { items: [], gold: 0 } };
    const inv = db.docs.get('users/uidA/progress/inventory');
    inv.v.records[0] = change ? change(inv.v.records[0]) : inv.v.records[0];
    if (!change) inv.v.tombstones.push({ id: 's1', revision: { hlc: T0, deviceId: 'dev-a', sequence: 2 }, deletedAt: T0 });
    const { second } = await both(db, terms);
    assert.equal(second.status, 'void');
    assert.ok(live(invB(db)).length === 1);
  }
  const db = world({ aItems: ['starter-pickaxe:v1'] });
  const terms = { a: { items: [offerOf(db, 'a', 'starter-pickaxe:v1')], gold: 0 }, b: { items: [], gold: 0 } };
  assert.equal((await both(db, terms)).second.status, 'void');
  const db2 = world();
  const t1 = { a: { items: [offerOf(db2, 'a', 's1')], gold: 0 }, b: { items: [], gold: 0 } };
  await core.executeTrade(db2, 'uidA', { trade: 't1', character: 'c1', terms: t1 }, T0 + 1);
  const out = await core.executeTrade(db2, 'uidB', { trade: 't1', character: 'kb2', terms: { ...t1, a: { ...t1.a, gold: 5 } } }, T0 + 2);
  assert.equal(out.status, 'void');
  await assert.rejects(core.executeTrade(world(), 'uidC', { trade: 't1', character: 'c1', terms: t1 }, T0), e => e.status === 403);
});

test('a cancel after confirming stops a later confirmation from completing', async () => {
  const db = world();
  const terms = { a: { items: [offerOf(db, 'a', 's1')], gold: 0 }, b: { items: [], gold: 0 } };
  await core.executeTrade(db, 'uidA', { trade: 't1', character: 'c1', terms }, T0 + 1);
  assert.equal((await core.cancelTrade(db, 'uidA', { trade: 't1' }, T0 + 2)).status, 'void');
  const out = await core.executeTrade(db, 'uidB', { trade: 't1', character: 'kb2', terms }, T0 + 3);
  assert.equal(out.status, 'void');
  assert.ok(live(invA(db)).includes('s1'));
});

test('Gold is checked against the replay every device will run, not only the purse it shows', async () => {
  // The snapshot says 150 but the log only explains 50 (unexplained Gold the merge adds back): a 100 debit would be
  // skipped on replay — the receiver paid, the giver not. Refused.
  const db = world();
  db.docs.set('users/uidA/economy/state', economy(150, { origin: { gold: 20, applied: {}, cosmetics: [] }, ops: [{ id: 'dev-a:1', deviceId: 'dev-a', seq: 1, kind: 'credit-gold', amount: 30, hlc: T0 - 600, wall: 0 }] }));
  assert.equal(core.replayGold(db.docs.get('users/uidA/economy/state').v), 50);
  const terms = { a: { items: [], gold: 100 }, b: { items: [], gold: 0 } };
  const { second } = await both(db, terms);
  assert.equal(second.status, 'void');
  assert.match(second.why, /Gold/);
  assert.equal(goldB(db), 50);
});

test('conservation: across many random trades the Gold and the items of both players add up the same', async () => {
  let seed = 7;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const db = world({ aItems: ['a1', 'a2', 'a3', 'a4', 'a5'], bItems: ['b1', 'b2', 'b3'], aGold: 1000, bGold: 400 });
  const total = () => goldA(db) + goldB(db);
  const items = () => live(invA(db)).length + live(invB(db)).length;
  const gold0 = total(), items0 = items();
  let now = T0 + 1000, done = 0;
  for (let i = 0; i < 60; i++) {
    const id = `t${i}`;
    db.docs.set(`trades/${id}`, { a: A, b: B, status: 'open', openedAt: now, expiresAt: now + core.TRADE_TTL_MS });
    const pick = (inv, side) => live(inv).filter(() => rnd(3) === 0).slice(0, 3).map(x => core.offerOf(inv.records.find(r => r.id === x)));
    const terms = { a: { items: pick(invA(db), 'a'), gold: rnd(600) }, b: { items: pick(invB(db), 'b'), gold: rnd(300) } };
    // Sometimes one side's item changes after it was offered: that trade must void and change nothing.
    if (rnd(5) === 0 && terms.a.items.length) {
      const inv = db.docs.get('users/uidA/progress/inventory');
      const r = inv.v.records.find(x => x.id === terms.a.items[0].id); r.stats = { ...r.stats, strikePower: r.stats.strikePower + 1 };
    }
    await core.executeTrade(db, 'uidA', { trade: id, character: 'c1', terms }, now);
    const out = await core.executeTrade(db, 'uidB', { trade: id, character: 'kb2', terms }, now + 1);
    if (out.status === 'done') done++;
    assert.equal(total(), gold0, `Gold after trade ${i}`);
    assert.equal(items(), items0, `items after trade ${i}`);
    assert.equal(core.replayGold(db.docs.get('users/uidA/economy/state').v), goldA(db));
    assert.equal(core.replayGold(db.docs.get('users/uidB/characters/kb2/economy/state').v), goldB(db));
    now += 100;
  }
  assert.ok(done > 10, `some trades completed (${done})`);
});

test('ground: a drop escrows the item out of the save; a pickup moves it into the picker\'s', async () => {
  const db = world();
  const item = offerOf(db, 'a', 's2');
  const drop = await core.dropItem(db, 'uidA', { character: 'c1', area: 'ember-isle', item, x: 100.25, y: 200 }, T0);
  const gid = core.groundId('uidA', 's2');
  assert.equal(drop.ground.id, gid);
  assert.ok(!live(invA(db)).includes('s2'));
  assert.equal(db.docs.get(`ground-items/${gid}`).expiresAt, T0 + core.GROUND_TTL_MS);
  assert.equal(db.docs.get('ground/ember-isle').count, 1);
  // A retried drop finds its own ground item and writes nothing twice.
  assert.equal((await core.dropItem(db, 'uidA', { character: 'c1', area: 'ember-isle', item, x: 1, y: 1 }, T0 + 5)).ground.id, gid);
  assert.equal(db.docs.get('ground/ember-isle').count, 1);
  const got = await core.pickupItem(db, 'uidB', { character: 'kb2', ground: gid }, T0 + 1000);
  assert.equal(got.status, 'picked');
  assert.ok(live(invB(db)).includes(core.pickedId(gid)));
  assert.equal(db.docs.get(`ground-items/${gid}`), undefined);
  assert.equal(db.docs.get('ground/ember-isle').count, 0);
});

test('the double-pickup race: two Keepers reach for one item at once, exactly one gets it', async () => {
  const db = world();
  db.docs.set('users/uidC/progress/inventory', inventory([]));
  await core.dropItem(db, 'uidA', { character: 'c1', area: 'ember-isle', item: offerOf(db, 'a', 's1'), x: 0, y: 0 }, T0);
  const gid = core.groundId('uidA', 's1');
  const [b, c] = await Promise.all([
    core.pickupItem(db, 'uidB', { character: 'kb2', ground: gid }, T0 + 10),
    core.pickupItem(db, 'uidC', { character: 'c1', ground: gid }, T0 + 10),
  ]);
  assert.deepEqual([b.status, c.status].sort(), ['gone', 'picked']);
  const held = [...live(invB(db)), ...live(db.docs.get('users/uidC/progress/inventory').v)].filter(id => id === core.pickedId(gid));
  assert.equal(held.length, 1);
  assert.equal(db.docs.get('ground/ember-isle').count, 0);
});

test('expiry: an item nobody takes goes home to its dropper (the sweep, and lazily on a late reach)', async () => {
  const db = world();
  await core.dropItem(db, 'uidA', { character: 'c1', area: 'ember-isle', item: offerOf(db, 'a', 's1'), x: 0, y: 0 }, T0);
  await core.dropItem(db, 'uidA', { character: 'c1', area: 'ember-isle', item: offerOf(db, 'a', 's2'), x: 0, y: 0 }, T0);
  const g1 = core.groundId('uidA', 's1'), g2 = core.groundId('uidA', 's2');
  const late = T0 + core.GROUND_TTL_MS + 1;
  // Lazy: Bryn reaches for g1 after its time — it goes home instead.
  const out = await core.pickupItem(db, 'uidB', { character: 'kb2', ground: g1 }, late);
  assert.equal(out.status, 'gone');
  assert.ok(live(invA(db)).includes(core.pickedId(g1)));
  assert.ok(!live(invB(db)).includes(core.pickedId(g1)));
  // The sweep takes the rest home.
  assert.equal(await core.returnExpired(db, late), 1);
  assert.ok(live(invA(db)).includes(core.pickedId(g2)));
  assert.equal(db.docs.get('ground/ember-isle').count, 0);
  assert.equal(await core.returnExpired(db, late), 0);
});

test('ground caps: per area, and a per-account drop rate', async () => {
  const ids = Array.from({ length: 12 }, (_, i) => `x${i}`);
  const db = world({ aItems: ids });
  for (let i = 0; i < core.GROUND_RATE_MAX; i++) await core.dropItem(db, 'uidA', { character: 'c1', area: 'a1', item: offerOf(db, 'a', ids[i]), x: 0, y: 0 }, T0 + i);
  await assert.rejects(core.dropItem(db, 'uidA', { character: 'c1', area: 'a1', item: offerOf(db, 'a', ids[10]), x: 0, y: 0 }, T0 + 20), e => e.code === 'slow-down');
  db.docs.set('ground/a2', { count: core.GROUND_AREA_MAX });
  await assert.rejects(core.dropItem(db, 'uidA', { character: 'c1', area: 'a2', item: offerOf(db, 'a', ids[10]), x: 0, y: 0 }, T0 + core.GROUND_RATE_WINDOW_MS + 1), e => e.code === 'area-full');
  // Still held (the refused drops moved nothing).
  assert.ok(live(invA(db)).includes(ids[10]));
});

test('handle(): refusals are words and statuses, never a crash', async () => {
  const db = world();
  assert.equal((await core.handle(db, 'execute', 'uidA', { trade: 'nope', character: 'c1', terms: { a: { items: [], gold: 0 }, b: { items: [], gold: 0 } } }, T0)).status, 404);
  assert.equal((await core.handle(db, 'execute', 'uidA', { trade: 't1', character: 'c1', terms: { a: { items: [{ id: '<x>' }], gold: 0 }, b: { items: [], gold: 0 } } }, T0)).status, 400);
  assert.equal((await core.handle(db, 'pickup', 'uidA', { character: 'c1', ground: 'g404' }, T0)).body.status, 'gone');
  assert.equal((await core.handle(db, 'nope', 'uidA', {}, T0)).status, 404);
});
