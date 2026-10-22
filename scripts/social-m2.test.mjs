// Protocol 8 — M2 of the room-run world (docs/design/online.md §4d): the room settles trades in memory and commits ONE
// Firestore transaction behind the result; it lays a dropped item on everyone's ground at once and escrows it behind;
// it reads a Keeper's budget from its save; and a party outlives a relog. Run against the room over HTTP with the
// REAL trade core (functions-game/src/trade-core.ts, bundled exactly as the deploy bundles it) over an in-memory store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocialServer } from './social-server.mjs';
import { memoryStore } from './social-identity.mjs';
import { load } from './world-sim-build.mjs';

const sim = load();
const C = sim.tradeCore;
const origin = 'http://127.0.0.1:4317';
const AREA = 'ember-isle';
const T0 = Date.now();

/** An item record as inventory-ops writes it, loose in the satchel. */
const record = (id, name, over = {}) => ({
  id, definitionId: `artifact:${id}`, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
  acquiredAt: new Date(T0 - 1000).toISOString(), revision: { hlc: T0 - 1000, deviceId: 'dev', sequence: 1 }, source: 'inventory',
  name, type: 'artifact', stats: { strikePower: 12 }, rollQuality: { strikePower: 0.6 }, itemLevel: 9, sellValue: 40, location: { kind: 'bag' }, ...over,
});
const inventory = records => ({ v: { version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: T0 - 500, legacyBackup: null, era: C.INVENTORY_ERA }, updatedAt: '' });
const economy = gold => ({ v: { version: C.ECONOMY_VERSION, goldEra: C.GOLD_ERA, gold, ops: [], origin: null, hlc: T0 - 500, applied: {}, cosmetics: [], totalGoldEarned: gold, runGoldEarned: gold }, updatedAt: '' });
const live = inv => inv.records.filter(r => !inv.tombstones.some(t => t.id === r.id && t.revision.hlc >= r.revision.hlc)).map(r => r.id);

/** A gate in front of the Db's commits: `hold()` parks every transaction at its commit until `release()`. */
function gated(db) {
  let held = null, open = () => {};
  return {
    hold() { held = new Promise(r => { open = r; }); },
    release() { open(); held = null; },
    db: { ...db, async run(fn) { if (held) await held; return db.run(fn); } },
  };
}

async function room(t, { store = memoryStore(), world = null, now = Date.now, escrowWaitMs = 1500 } = {}) {
  const db = C.memoryDb(store.docs);
  const g = gated(db);
  store.db = g.db;
  const r = createSocialServer({ publishMs: 5, now, store, core: sim, world, escrowWaitMs, verify: async token => { const m = /^tok-(\w+)-padding$/.exec(token); if (!m) throw Object.assign(new Error('bad'), { status: 401 }); return { uid: m[1], anonymous: false }; } });
  await new Promise(res => r.server.listen(0, '127.0.0.1', res));
  t.after(() => r.dispose());
  const base = `http://127.0.0.1:${r.server.address().port}`;
  const post = async (path, body, token, headers = {}) => {
    const res = await fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const join = async (name, uid, extra = {}) => {
    const r2 = await post('/join', { name, party: true, coop: true, trade: true, protocol: 8, character: 'c1', area: AREA, ...extra }, null, uid ? { Authorization: `Firebase tok-${uid}-padding` } : {});
    return { ...r2.body, status: r2.status };
  };
  const stream = async k => {
    const abort = new AbortController();
    t.after(() => abort.abort());
    const res = await fetch(`${base}/events`, { headers: { Origin: origin, Authorization: `Bearer ${k.token}` }, signal: abort.signal });
    const reader = res.body.getReader();
    let buffer = '';
    const seen = [];
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          buffer += new TextDecoder().decode(value);
          let split;
          while ((split = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, split); buffer = buffer.slice(split + 2);
            if (chunk.startsWith('data: ')) seen.push({ at: performance.now(), ...JSON.parse(chunk.slice(6)) });
          }
        }
      } catch { /* aborted */ }
    })();
    const all = type => seen.filter(e => e.type === type);
    const until = async (f, ms = 3000) => { const end = Date.now() + ms; for (;;) { const v = f(); if (v) return v; if (Date.now() > end) return null; await new Promise(r2 => setTimeout(r2, 5)); } };
    return { seen, all, until, close: () => abort.abort() };
  };
  return { r, base, post, join, stream, store, gate: g };
}
const at = (k, x, y, post) => post('/update', { x, y, facing: 1, animation: 'idle', zone: 'Ember Isle', area: AREA }, k.token);

async function trading(t, opts = {}) {
  const ctx = await room(t, opts);
  ctx.store.docs.set('users/u1/progress/inventory', inventory([record('s1', 'Ash Blade'), record('s2', 'Ember Charm')]));
  ctx.store.docs.set('users/u1/economy/state', economy(300));
  ctx.store.docs.set('users/u2/progress/inventory', inventory([record('r1', 'Tide Ring')]));
  ctx.store.docs.set('users/u2/economy/state', economy(20));
  const a = await ctx.join('Aster', 'u1'), b = await ctx.join('Bryn', 'u2');
  return { ...ctx, a, b };
}
const offerOf = (store, uid, id) => C.offerOf(store.docs.get(`users/${uid}/progress/inventory`).v.records.find(r => r.id === id));

/** Open a trade between a and b, put the offers in, both accept: the window at the confirm stage. */
async function toConfirm({ post, a, b, store }, offers) {
  const ask = await post('/trade/ask', { to: b.id }, a.token);
  const opened = await post('/trade/answer', { ask: ask.body.ask.id, accept: true }, b.token);
  const t = opened.body.trade;
  let rev = t.rev;
  for (const [k, uid, offer] of [[a, 'u1', offers.a], [b, 'u2', offers.b]]) {
    if (!offer) continue;
    rev = (await post('/trade/offer', { trade: t.id, items: offer.items.map(id => offerOf(store, uid, id)), gold: offer.gold }, k.token)).body.rev;
  }
  assert.equal((await post('/trade/accept', { trade: t.id, rev }, a.token)).status, 200);
  assert.equal((await post('/trade/accept', { trade: t.id, rev }, b.token)).status, 200);
  return { id: t.id, rev, room: t.room };
}

test('protocol 8: the room settles a trade at once from memory, then ONE commit moves both saves and the audit', async t => {
  const ctx = await trading(t);
  const { post, a, b, store, stream } = ctx;
  const sa = await stream(a), sb = await stream(b);
  const tr = await toConfirm(ctx, { a: { items: ['s1'], gold: 50 }, b: { items: ['r1'], gold: 0 } });
  assert.equal(tr.room, true, 'two protocol-8 Keepers: the room settles');
  // The window the Keepers see never carries a uid.
  assert.equal(JSON.stringify(sa.all('trade')).includes('u1'), false);
  assert.equal((await post('/trade/confirm', { trade: tr.id, rev: tr.rev }, a.token)).status, 200);
  const t0 = performance.now();
  const second = await post('/trade/confirm', { trade: tr.id, rev: tr.rev }, b.token);
  assert.equal(second.status, 200);
  // Settled: both windows close with what each receives, before the commit's answer.
  const endA = await sa.until(() => sa.all('trade-end').find(e => e.end.id === tr.id)), endB = await sb.until(() => sb.all('trade-end').find(e => e.end.id === tr.id));
  assert.equal(endA.end.outcome, 'done'); assert.equal(endA.end.settled, true);
  assert.deepEqual(endA.end.received, { items: [`t${C.hashId(`${tr.id}:r1`)}`], gold: 0 });
  assert.deepEqual(endB.end.received, { items: [`t${C.hashId(`${tr.id}:s1`)}`], gold: 50 });
  const commitA = await sa.until(() => sa.all('trade-commit').find(e => e.commit.id === tr.id));
  assert.equal(commitA.commit.ok, true);
  console.log(`# trade (local): settle ${(endA.at - t0).toFixed(1)} ms after the second Confirm was sent, commit ${(commitA.at - t0).toFixed(1)} ms`);
  const invA = store.docs.get('users/u1/progress/inventory').v, invB = store.docs.get('users/u2/progress/inventory').v;
  assert.ok(!live(invA).includes('s1') && live(invB).includes(`t${C.hashId(`${tr.id}:s1`)}`));
  assert.ok(!live(invB).includes('r1') && live(invA).includes(`t${C.hashId(`${tr.id}:r1`)}`));
  assert.equal(store.docs.get('users/u1/economy/state').v.gold, 250);
  assert.equal(store.docs.get('users/u2/economy/state').v.gold, 70);
  assert.equal(store.docs.get(`trades/${tr.id}`).status, 'done');
  assert.equal(store.docs.get(`trade-audit/trade-${tr.id}`).room, true);
  // The trade is over: nothing more can be said to it; its status is told from the commit.
  assert.equal((await post('/trade/accept', { trade: tr.id, rev: tr.rev }, a.token)).status, 404);
  assert.deepEqual((await post('/trade/status', { trade: tr.id }, b.token)).body, { status: 'done', received: endB.end.received });
  const health = await (await fetch(`${ctx.base}/health`)).json();
  assert.equal(health.protocol, 8);
  assert.equal(health.economy.committed, 1);
});

test('protocol 8: a refusal found by the precheck is told before anything settles; forged confirms and mixed clients', async t => {
  const ctx = await trading(t);
  const { post, a, b, store, stream, join } = ctx;
  const sa = await stream(a);
  const tr = await toConfirm(ctx, { a: { items: ['s1'], gold: 0 }, b: null });
  // Aster's save changes after both accepted (the blade tempered on another device): the settle refuses, nothing moved.
  store.docs.get('users/u1/progress/inventory').v.records.find(r => r.id === 's1').upgradeLevel = 3;
  // A stale revision is refused; a Keeper not in the trade is refused.
  assert.equal((await post('/trade/confirm', { trade: tr.id, rev: tr.rev - 1 }, a.token)).status, 409);
  const c = await join('Cora', 'u3');
  assert.equal((await post('/trade/confirm', { trade: tr.id, rev: tr.rev }, c.token)).status, 404);
  // The precheck read the save when both accepted (before the temper): it settles, and the commit — the truth — voids.
  await post('/trade/confirm', { trade: tr.id, rev: tr.rev }, a.token);
  await post('/trade/confirm', { trade: tr.id, rev: tr.rev }, b.token);
  const commit = await sa.until(() => sa.all('trade-commit').find(e => e.commit.id === tr.id));
  assert.equal(commit.commit.ok, false);
  assert.match(commit.commit.why, /changed/);
  assert.ok(live(store.docs.get('users/u1/progress/inventory').v).includes('s1'));
  assert.equal(store.docs.get(`trades/${tr.id}`).status, 'void');
  // A gift of Gold Aster does not hold: the precheck refuses before anything settles (no commit is tried).
  const tr2 = await toConfirm(ctx, { a: { items: [], gold: 9000 }, b: null });
  await post('/trade/confirm', { trade: tr2.id, rev: tr2.rev }, a.token);
  await post('/trade/confirm', { trade: tr2.id, rev: tr2.rev }, b.token);
  const end = await sa.until(() => sa.all('trade-end').find(e => e.end.id === tr2.id));
  assert.equal(end.end.outcome, 'void'); assert.match(end.end.why, /Gold/);
  assert.equal(sa.all('trade-commit').some(e => e.commit.id === tr2.id), false);
  // A protocol-7 Keeper on one side: the trade stays protocol 6's (the Function settles; the room only relays).
  const old = await join('Oskar', 'u4', { protocol: undefined, character: undefined });
  const ask = await post('/trade/ask', { to: old.id }, a.token);
  const mixed = (await post('/trade/answer', { ask: ask.body.ask.id, accept: true }, old.token)).body.trade;
  assert.equal(mixed.room, undefined);
});

test('protocol 8: a crash between the settle and the commit — the commit is the truth, and only one outcome can win', async t => {
  const store = memoryStore();
  const ctx = await trading(t, { store });
  const { post, a, b, gate } = ctx;
  const tr = await toConfirm(ctx, { a: { items: ['s1'], gold: 40 }, b: null });
  await post('/trade/confirm', { trade: tr.id, rev: tr.rev }, a.token);
  // The commit is held at the store: the room settles in memory, then "crashes" (it is gone; its commit never lands).
  gate.hold();
  await post('/trade/confirm', { trade: tr.id, rev: tr.rev }, b.token);
  await new Promise(r => setTimeout(r, 30));
  assert.equal(store.docs.get(`trades/${tr.id}`).status, 'open', 'nothing committed yet');
  // A new room on the same store (the old one died): Bryn asks how it ended. Still open → voided in a transaction.
  const next = await room(t, { store: memoryStore(store.docs) });
  const bryn = await next.join('Bryn', 'u2');
  const asked = await next.post('/trade/status', { trade: tr.id }, bryn.token);
  assert.equal(asked.body.status, 'void');
  assert.match(asked.body.why, /interrupted/);
  // The old room's commit, released late, finds the trade void: nothing moves, Gold and items are conserved.
  gate.release();
  await new Promise(r => setTimeout(r, 50));
  assert.equal(store.docs.get(`trades/${tr.id}`).status, 'void');
  assert.ok(live(store.docs.get('users/u1/progress/inventory').v).includes('s1'));
  assert.equal(store.docs.get('users/u1/economy/state').v.gold + store.docs.get('users/u2/economy/state').v.gold, 320);
  // A stranger cannot ask about it.
  const c = await next.join('Cora', 'u3');
  assert.equal((await next.post('/trade/status', { trade: tr.id }, c.token)).status, 403);
});

test('protocol 8: a drop lies on everyone\'s ground at once; the escrow lands behind it; the first pick wins', async t => {
  const ctx = await trading(t);
  const { post, a, b, store, stream, join, gate } = ctx;
  await at(a, 100, 100, post); await at(b, 120, 100, post);
  const sa = await stream(a), sb = await stream(b);
  const item = offerOf(store, 'u1', 's2');
  // Hold the escrow: the drop must already be on Bryn's screen while it is still being written.
  gate.hold();
  const t0 = performance.now();
  const dropped = await post('/ground/drop', { area: AREA, x: 100, y: 106, item }, a.token);
  const rtt = performance.now() - t0;
  assert.equal(dropped.status, 201);
  const gid = C.groundId('u1', 's2');
  assert.equal(dropped.body.ground.id, gid);
  const seen = await sb.until(() => sb.all('ground').find(e => e.add?.some(g => g.id === gid)));
  assert.ok(seen, 'Bryn sees it before the escrow lands');
  assert.equal(seen.add[0].pending, true);
  assert.equal(store.docs.get(`ground-items/${gid}`), undefined);
  console.log(`# drop (local): the dropper's request ${rtt.toFixed(1)} ms; the other Keeper saw it ${(seen.at - t0).toFixed(1)} ms after the drop was sent`);
  // A protocol-6 client's /ground/take cannot clear a drop the room is still escrowing.
  assert.equal((await post('/ground/take', { area: AREA, id: gid }, b.token)).status, 200);
  assert.equal(sb.all('ground').some(e => e.gone?.includes(gid)), false);
  // Bryn reaches for it while it is still escrowing: the room holds the pick for the escrow.
  const pick = post('/ground/pick', { id: gid }, b.token);
  await new Promise(r => setTimeout(r, 20));
  const third = await join('Cora', 'u3');
  await at(third, 110, 100, post);
  assert.deepEqual((await post('/ground/pick', { id: gid }, third.token)).body, { ok: false, why: 'gone' });
  gate.release();
  const got = await pick;
  assert.equal(got.body.ok, true);
  assert.equal(got.body.item, C.pickedId(gid));
  assert.ok(await sa.until(() => sa.all('ground-note').find(e => e.note.kind === 'escrowed' && e.note.id === gid)));
  // Out of Aster's save (behind a tombstone nothing outranks), into Bryn's under a new id; off the ground.
  const invA = store.docs.get('users/u1/progress/inventory').v, invB = store.docs.get('users/u2/progress/inventory').v;
  assert.ok(!live(invA).includes('s2'));
  assert.ok(live(invB).includes(C.pickedId(gid)));
  assert.equal(store.docs.get(`ground-items/${gid}`), undefined);
  assert.ok(sa.all('ground').some(e => e.gone?.includes(gid)));
  // Picked again: gone. A guest can neither drop nor pick.
  assert.deepEqual((await post('/ground/pick', { id: gid }, a.token)).body, { ok: false, why: 'gone' });
  const guest = await join('Gale', null);
  assert.equal((await post('/ground/drop', { area: AREA, x: 0, y: 0, item }, guest.token)).status, 403);
  assert.equal((await post('/ground/pick', { id: gid }, guest.token)).status, 403);
});

test('protocol 8: an escrow waits for the dropper\'s save; a forged or unsynced drop goes back with a clear word', async t => {
  const ctx = await trading(t);
  const { post, a, store, stream } = ctx;
  await at(a, 100, 100, post);
  const sa = await stream(a);
  // Picked up a moment ago, not in the cloud yet: the room lays it, the escrow waits; the save arrives; it lands.
  const fresh = record('n1', 'Wisp Lantern');
  const dropped = await post('/ground/drop', { area: AREA, x: 100, y: 100, item: C.offerOf(fresh) }, a.token);
  assert.equal(dropped.status, 201);
  const gid = dropped.body.ground.id;
  await new Promise(r => setTimeout(r, 30));
  assert.equal(store.docs.get(`ground-items/${gid}`), undefined, 'not yet: the cloud save does not hold it');
  const inv = store.docs.get('users/u1/progress/inventory');
  inv.v.records.push(fresh);
  await post('/ground/synced', { id: gid }, a.token);
  assert.ok(await sa.until(() => sa.all('ground-note').find(e => e.note.kind === 'escrowed' && e.note.id === gid)));
  assert.ok(store.docs.get(`ground-items/${gid}`));
  // Bryn picks it up: the room answers after its one pickup transaction.
  const { b } = ctx;
  await at(b, 104, 100, post);
  const t0 = performance.now();
  const picked = await post('/ground/pick', { id: gid }, b.token);
  console.log(`# pick (local): ${(performance.now() - t0).toFixed(1)} ms round trip, ${picked.body.ms} ms in the room (the pickup transaction)`);
  assert.equal(picked.body.ok, true);
  // An item the save never held (a forged drop): it shows, then goes back — off everyone's ground, the dropper told.
  const forged = C.offerOf(record('zz', 'Crown of Lies'));
  const f = await post('/ground/drop', { area: AREA, x: 100, y: 100, item: forged }, a.token);
  await post('/ground/synced', { id: f.body.ground.id }, a.token);
  await new Promise(r => setTimeout(r, 700));
  await post('/ground/synced', { id: f.body.ground.id }, a.token);
  const back = await sa.until(() => sa.all('ground-note').find(e => e.note.kind === 'returned' && e.note.id === f.body.ground.id), 5000);
  assert.ok(back, 'the forged drop went back');
  assert.match(back.note.why, /no longer holds|holds/);
  assert.ok(sa.all('ground').some(e => e.gone?.includes(f.body.ground.id)));
  // A worn item cannot be dropped (refused by the escrow's own check, at once).
  store.docs.get('users/u1/progress/inventory').v.records.push(record('w1', 'Worn Hood', { location: { kind: 'equipped', slotId: 'head' } }));
  const w = await post('/ground/drop', { area: AREA, x: 100, y: 100, item: C.offerOf(record('w1', 'Worn Hood', { location: { kind: 'equipped', slotId: 'head' } })) }, a.token);
  const wb = await sa.until(() => sa.all('ground-note').find(e => e.note.kind === 'returned' && e.note.id === w.body.ground.id));
  assert.match(wb.note.why, /Vault|off your Keeper/);
});

test('protocol 8: a party outlives a relog — offline members greyed, the lead handed over, back in on login; kicked or left is out', async t => {
  const ctx = await room(t);
  const { post, join, stream, store, r } = ctx;
  const a = await join('Aster', 'u1'), b = await join('Bryn', 'u2'), c = await join('Cora', 'u3');
  const sb = await stream(b);
  const inv = await post('/party/invite', { to: b.id }, a.token);
  await post('/party/accept', { invite: inv.body.invite.id }, b.token);
  const inv2 = await post('/party/invite', { to: c.id }, a.token);
  await post('/party/accept', { invite: inv2.body.invite.id }, c.token);
  const party = await sb.until(() => sb.all('party').find(e => e.party?.members.length === 3));
  const pid = party.party.id;
  await new Promise(res => setTimeout(res, 20));
  // Persisted by the room: the party and each member's pointer.
  assert.deepEqual(store.docs.get(`parties/${pid}`).members.map(m => m.key).sort(), ['u1', 'u2', 'u3']);
  assert.equal(store.docs.get('users/u2/social/party').party, pid);
  // Aster (the leader) logs out: still in the party, offline; the lead passes to Bryn.
  await post('/leave', {}, a.token);
  const after = await sb.until(() => sb.all('party').find(e => e.party?.offline?.some(o => o.name === 'Aster')));
  assert.deepEqual(after.party.members.sort(), [b.id, c.id].sort());
  assert.equal(after.party.leader, b.id);
  assert.ok(await sb.until(() => sb.all('party-note').find(e => e.note.kind === 'offline' && e.note.name === 'Aster')));
  // Aster logs back in: back in the same party at once (no invite), shown online again.
  const a2 = await join('Aster', 'u1');
  const sa2 = await stream(a2);
  const back = await sa2.until(() => sa2.all('party').find(e => e.party?.id === pid && e.party.members.includes(a2.id)));
  assert.ok(back, 'rejoined on login');
  assert.equal(back.party.offline.length, 0);
  assert.equal(back.party.leader, b.id, 'the lead stays handed over');
  // Cora logs out; the leader kicks her while she is offline: she does not come back.
  await post('/leave', {}, c.token);
  const greyed = await sb.until(() => sb.all('party').map(e => e.party).find(p => p?.offline?.some(o => o.name === 'Cora')));
  const coraRow = greyed.offline.find(o => o.name === 'Cora').id;
  assert.equal((await post('/party/kick', { member: coraRow }, b.token)).status, 200);
  await new Promise(res => setTimeout(res, 20));
  assert.equal(store.docs.get('users/u3/social/party').party, null);
  const c2 = await join('Cora', 'u3');
  await new Promise(res => setTimeout(res, 40));
  assert.equal([...r.sessions.values()].find(s => s.player.id === c2.id).party, null);
  // The room restarts (memory gone): Aster and Bryn log in to a new room on the same store — the party is restored.
  const next = await room(t, { store });
  const a3 = await next.join('Aster', 'u1');
  const sa3 = await next.stream(a3);
  const b3 = await next.join('Bryn', 'u2');
  const restored = await sa3.until(() => sa3.all('party').find(e => e.party?.id === pid && e.party.members.length === 2));
  assert.ok(restored, 'restored from the store');
  assert.deepEqual(restored.party.members.sort(), [a3.id, b3.id].sort());
  // Bryn leaves for good: under two, the party disbands; nobody's pointer leads back to it.
  await next.post('/party/leave', {}, b3.token);
  await new Promise(res => setTimeout(res, 30));
  assert.equal(store.docs.get(`parties/${pid}`), undefined);
  assert.equal(store.docs.get('users/u1/social/party').party, null);
  // A guest's place in a party ends with its session (nothing to come back to).
  const g1 = await next.join('Gale', null), h = await next.join('Hale', 'u5');
  const gi = await next.post('/party/invite', { to: g1.id }, h.token);
  await next.post('/party/accept', { invite: gi.body.invite.id }, g1.token);
  await next.post('/leave', {}, g1.token);
  await new Promise(res => setTimeout(res, 20));
  assert.equal([...next.r.sessions.values()].find(s => s.player.id === h.id).party, null);
});

test('protocol 8: the claim budget comes from the save — its real level and gear; guests stay conservative', async t => {
  const store = memoryStore();
  const ctx = await room(t, { store });
  const xp50 = 300000; // keeper-level.ts: level 50 needs ~298k Hunting XP
  store.docs.set('users/u1/progress/activity', { v: { version: 1, progress: { version: 1, xpByDiscipline: { hunting: xp50 } } }, updatedAt: '' });
  store.docs.set('users/u1/progress/keeper-look', { v: { vocation: 'warlock', made: true }, updatedAt: '' });
  store.docs.set('users/u1/progress/inventory', inventory([record('wand', 'Ash Wand', { location: { kind: 'equipped', slotId: 'weapon' }, stats: { spellDamage: 60, critChance: 10, castSpeed: 20 } })]));
  const a = await ctx.join('Aster', 'u1', { level: 3 });
  const g = await ctx.join('Gale', null, { level: 99 });
  const old = await ctx.join('Oskar', 'u2', { protocol: undefined, character: undefined, level: 12 });
  await new Promise(r => setTimeout(r, 30));
  const sess = id => [...ctx.r.sessions.values()].find(s => s.player.id === id);
  const k = sess(a.id);
  assert.equal(k.stats.level, sim.keeperBudget({ activity: store.docs.get('users/u1/progress/activity') }).level);
  assert.ok(k.stats.level >= 50, 'the save\'s level, not the level the presence claims (3)');
  assert.ok(k.stats.boost > 1.4);
  assert.equal(k.stats.dps, sim.budgetFor(k.stats.level, k.stats.boost));
  const keeper = ctx.r.rooms.keeperOf(k);
  assert.equal(keeper.dps, k.stats.dps);
  // A guest claiming level 99: the guest budget, capped.
  const guest = ctx.r.rooms.keeperOf(sess(g.id));
  assert.equal(guest.dps, sim.guestBudget(99));
  assert.equal(guest.dps, 40 + 20 * sim.GUEST_LEVEL_CAP);
  // A protocol-7 Keeper (no character named): the level budget as before (no dps: the gate's level formula).
  assert.equal(ctx.r.rooms.keeperOf(sess(old.id)).dps, undefined);
  // The budget beats the simulated Keeper's damage at every level, and a low save cannot claim a high one's.
  for (const L of [5, 10, 20, 30, 40, 60]) assert.ok(sim.budgetFor(L) >= 3 * sim.refDps(L));
  assert.ok(sim.budgetFor(5, 10) < sim.budgetFor(40));
});

test('protocol 8: the room\'s REST transactions — begin, read inside, one commit; an aborted commit runs again; values round-trip', async () => {
  const { firestoreStore, toValue, fromValue } = await import('./social-identity.mjs');
  const root = 'projects/proj/databases/(default)/documents';
  const docs = new Map();
  const put = (path, value) => docs.set(path, toValue(value).mapValue.fields);
  put('users/u1/progress/inventory', inventory([record('s1', 'Ash Blade')]));
  put('users/u1/economy/state', economy(300));
  put('users/u2/progress/inventory', inventory([]));
  put('users/u2/economy/state', economy(20));
  put('trades/t9', { a: { uid: 'u1', player: 'pa', name: 'Aster' }, b: { uid: 'u2', player: 'pb', name: 'Bryn' }, status: 'open', openedAt: T0, expiresAt: T0 + 600000 });
  const calls = [];
  let aborts = 1;
  const fetchFake = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ verb: url.split(':').pop(), body });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: `tx${calls.length}` });
    if (url.endsWith(':rollback')) return Response.json({});
    if (url.endsWith(':batchGet')) return Response.json(body.documents.map(name => { const f = docs.get(name.slice(root.length + 1)); return f ? { found: { name, fields: f } } : { missing: name }; }));
    if (url.endsWith(':commit')) {
      if (body.transaction && aborts-- > 0) return Response.json({ error: { status: 'ABORTED' } }, { status: 409 });
      for (const w of body.writes) { if (w.delete) docs.delete(w.delete.slice(root.length + 1)); else docs.set(w.update.name.slice(root.length + 1), w.update.fields); }
      return Response.json({ writeResults: [] });
    }
    return new Response('', { status: 404 });
  };
  const fs = firestoreStore({ projectId: 'proj', now: () => T0, token: async () => 'sa', fetch: fetchFake });
  const sword = C.offerOf(fromValue({ mapValue: { fields: docs.get('users/u1/progress/inventory') } }).v.records[0]);
  const out = await C.settleTrade(fs.db, { trade: 't9', a: { uid: 'u1', character: 'c1' }, b: { uid: 'u2', character: 'c1' }, terms: { a: { items: [sword], gold: 25 }, b: { items: [], gold: 0 } } }, T0 + 1000);
  assert.equal(out.status, 'done');
  // Begun twice (the first commit was aborted), every read inside a transaction, one commit that landed.
  assert.equal(calls.filter(c => c.verb === 'beginTransaction').length, 2);
  assert.ok(calls.filter(c => c.verb === 'batchGet').every(c => c.body.transaction));
  const landed = calls.filter(c => c.verb === 'commit').at(-1);
  assert.equal(landed.body.writes.length, 6, 'both inventories, both ledgers, the trade, the audit');
  const read = path => fromValue({ mapValue: { fields: docs.get(path) } });
  assert.equal(read('trades/t9').status, 'done');
  assert.equal(read('users/u1/economy/state').v.gold, 275);
  assert.equal(read('users/u2/economy/state').v.gold, 45);
  const invA = read('users/u1/progress/inventory').v;
  assert.equal(invA.tombstones[0].revision.hlc, Number.MAX_SAFE_INTEGER, 'a MAX tombstone survives the typed round trip');
  assert.deepEqual(read('users/u2/progress/inventory').v.records[0].rollQuality, { strikePower: 0.6 });
  // A Keeper's save in one request; the party pointer and document in one commit.
  calls.length = 0;
  await fs.readSave('u1', 'k2');
  assert.deepEqual(calls.map(c => c.verb), ['batchGet']);
  assert.deepEqual(calls[0].body.documents.map(d => d.slice(root.length + 1)), ['users/u1/characters/k2/progress/activity', 'users/u1/characters/k2/progress/keeper-look', 'users/u1/characters/k2/progress/inventory']);
  await fs.partyWrite('p1', { v: 1, leader: 'u1', members: [{ key: 'u1', name: 'Aster' }, { key: 'u2', name: 'Bryn' }], updatedAt: T0 }, { u1: 'p1', u2: 'p1' });
  assert.deepEqual(calls.at(-1).body.writes.map(w => w.update.name.slice(root.length + 1)), ['parties/p1', 'users/u1/social/party', 'users/u2/social/party']);
  assert.equal((await fs.partyRead('u2')).doc.members[1].name, 'Bryn');
});

test('toValue: a whole number past 2^53 goes as a double (Firestore refuses "6.9e+26" as an int64)', async () => {
  const { toValue } = await import('./social-identity.mjs');
  assert.deepEqual(toValue(6.931155932289466e26), { doubleValue: 6.931155932289466e26 });
  assert.deepEqual(toValue(2 ** 53 + 2), { doubleValue: 2 ** 53 + 2 });
  assert.deepEqual(toValue(42), { integerValue: '42' });
});
