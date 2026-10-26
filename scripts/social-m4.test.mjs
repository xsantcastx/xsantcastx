// Protocol 10 — M4 of the room-run world (docs/design/online.md §4d "M4"). The room lays a Keeper's statuses on its
// creatures (legal for the skill and mark by the game's own data, with the room's durations and immunities), tells the
// Keeper which claims it refused and why, keeps the Keeper's life (bites cut here, death on the room's word), and — for
// a signed-in Keeper — pays its Hunting XP and hunt Gold itself in one Firestore transaction per batch, once per kill
// or pile. Run against the room's own modules (compiled from the sources exactly as the deploy bundles them) and the
// REAL trade core over an in-memory store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocialServer } from './social-server.mjs';
import { memoryStore } from './social-identity.mjs';
import { load } from './world-sim-build.mjs';

const sim = load();
const C = sim.tradeCore;
const { RoomWorld, statusLegal, statusSources, KeeperLife, clampGuard, guestGuard, creditRoom, creditPath, goldCap, XP_CAP, STATUS_CAP, CC_IMMUNE, LIFE } = sim;
const origin = 'http://127.0.0.1:4317';
const AREA = 'ember-isle';
const T0 = 1_800_000_000_000;
const OPEN = (() => {
  const w = new RoomWorld({ area: AREA, seed: 'probe', now: () => 0 });
  for (let r = 0; r < 200; r++) for (let c = -60; c < 60; c++) {
    const x = c * 16 + 8, y = r * 16 + 8;
    if (!w.world.safeAt(c, r) && [0, 1, 2, 3, 4].every(d => w.world.walkable(c + d, r)) && w.world.walkable(c, r + 1)) return { x, y };
  }
  throw new Error('no open ground');
})();
const world = (seed = 'm4', t = { now: T0 }, life = null) => new RoomWorld({ area: AREA, seed, now: () => t.now, boot: 'b4', ...(life ? { life } : {}) });
const mobOf = (w, id) => w.mobs.mobs.find(m => m.nid === id);

// ── Statuses ──
test('protocol 10: a status is legal only for a skill and mark that lay it (the game\'s own data)', () => {
  // Unmarked: Shield Bash stuns, the Watch Cry taunts, the snare roots, the Barbed Shot bleeds.
  assert.ok(statusLegal('shield-bash', null, 'stun'));
  assert.ok(statusLegal('watch-cry', null, 'taunt'));
  assert.ok(statusLegal('thornroot-snare', null, 'root'));
  assert.ok(statusLegal('barbed-shot', null, 'bleed'));
  // Marked: Kindling (Ember Bolt A2) burns, Dread (Ember Curse B3) fears, Concussion (Shield Bash A2) hushes, Unmaking
  // (Doom A3) and Banish the Bearer (Banish A3) strip, Pull of the Fire (Whirl A2) pulls, Firebreak (Flame Wall B2) slows.
  for (const [s, m, k] of [['ember-bolt', 'a2', 'burn'], ['ember-curse', 'b3', 'fear'], ['shield-bash', 'a2', 'hush'], ['doom', 'a3', 'strip'], ['banish', 'a3', 'strip'], ['whirl-of-cinders', 'a2', 'pull'], ['flame-wall', 'b2', 'slow'], ['blinding-flash', 'a2', 'blind']]) {
    assert.ok(statusLegal(s, m, k), `${s} ${m} ${k}`);
  }
  // Forged: a skill that lays nothing, the wrong mark, a made-up skill, a mark that lays something else.
  assert.equal(statusLegal('ember-bolt', null, 'stun'), false);
  assert.equal(statusLegal('ember-bolt', 'a1', 'burn'), false);
  assert.equal(statusLegal('shield-bash', null, 'fear'), false);
  assert.equal(statusLegal('god-hand', null, 'stun'), false);
  assert.equal(statusLegal('doom', 'a3', 'stun'), false);
  // Every source a client may name is legal (statusSources is the client's list).
  for (const k of ['stun', 'root', 'chill', 'fear', 'blind', 'hush', 'taunt', 'slow', 'pull', 'burn', 'bleed', 'strip']) {
    const list = statusSources(k);
    assert.ok(list.length > 0, k);
    for (const x of list) assert.ok(statusLegal(x.s, x.m ?? null, k), `${x.s} ${x.m} ${k}`);
  }
});

test('protocol 10: the room lays a legal status with its own seconds and immunity; forged ones are refused', () => {
  const t = { now: T0 };
  const w = world('st', t);
  w.fxQuiet();
  w.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 20 });
  const id = w.fxLay('ash-wolf', OPEN.x + 40, OPEN.y, true), m = mobOf(w, id);
  // Forged: the wrong skill for the status, a made-up skill, an unknown creature.
  let r = w.statuses('a', [{ i: id, k: 'stun', s: 'ember-bolt', t: 20 }, { i: id, k: 'fear', s: 'god-hand', t: 20 }, { i: 'zz', k: 'stun', s: 'shield-bash', t: 20 }]);
  assert.deepEqual([r.landed, r.refused], [0, 3]);
  assert.deepEqual(r.no.map(n => n.why).sort(), ['gone', 'illegal']);
  assert.equal(m.stun ?? 0, 0);
  // Legal: Shield Bash's stun lands, at most STATUS_CAP seconds however long it asks for.
  r = w.statuses('a', [{ i: id, k: 'stun', s: 'shield-bash', t: 600 }]);
  assert.equal(r.landed, 1);
  assert.ok(Math.abs(m.stun - STATUS_CAP.stun) < 1e-6, `capped (${m.stun})`);
  // Held once: another stun is shaken off until that one is over and CC_IMMUNE more.
  r = w.statuses('a', [{ i: id, k: 'stun', s: 'shield-bash', t: 10 }]);
  assert.deepEqual(r.no, [{ i: id, why: 'immune' }]);
  for (let i = 0; i < (STATUS_CAP.stun + CC_IMMUNE) * 4 + 2; i++) w.tick(.25);
  assert.equal(w.statuses('a', [{ i: id, k: 'stun', s: 'shield-bash', t: 10 }]).landed, 1);
  // Every screen sees it: the snapshot carries the statuses (room-status ST_BIT).
  w.snapFor('a');
  assert.ok(w.stateOf(m).st & 1, 'stunned on the wire');
  // A taunt turns it on that Keeper; a burn ticks here, charged to that Keeper's budget, its kill that Keeper's.
  w.statuses('a', [{ i: id, k: 'taunt', s: 'watch-cry', t: 30 }]);
  assert.equal(m.tauntBy, 'a');
  r = w.statuses('a', [{ i: id, k: 'burn', s: 'ember-bolt', m: 'a2', t: 40, d: 1e6 }]);
  assert.equal(r.landed, 1);
  assert.ok(m.scorchDps <= (40 + 20 * 20) * 0.5 + 1e-6, `the burn's damage a second is inside the budget (${m.scorchDps})`);
  assert.equal(m.scorchBy, 'a');
  const hp = m.hp;
  for (let i = 0; i < 8; i++) w.tick(.25);
  assert.ok(m.hp < hp, 'the room ticked the burn');
  // From too far, by the room's record of where the Keeper stands.
  const id2 = w.fxLay('ash-wolf', OPEN.x + 30, OPEN.y + 10, true);
  w.keeper({ id: 'a', x: OPEN.x + 2000, y: OPEN.y, level: 20 });
  assert.deepEqual(w.statuses('a', [{ i: id2, k: 'root', s: 'thornroot-snare', t: 20 }]).no, [{ i: id2, why: 'far' }]);
});

test('protocol 10: a stun or a hush in a cast\'s tell cancels the cast (as on a screen)', () => {
  const w = world('tell');
  w.fxQuiet();
  w.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 30 });
  for (const [k, s, m] of [['stun', 'shield-bash', undefined], ['hush', 'corpse-burst', 'b3']]) {
    const id = w.fxLay('obsidian-golem', OPEN.x + 40, OPEN.y, true), g = mobOf(w, id);
    g.abCast = 0; g.tell = .8; g.aim = { x: OPEN.x, y: OPEN.y };
    assert.equal(w.statuses('a', [{ i: id, k, s, ...(m ? { m } : {}), t: 15 }]).landed, 1, k);
    assert.equal(g.abCast, undefined, `${k}: the cast is cancelled`);
    assert.equal(g.tell, 0);
  }
});

// ── The life the room keeps ──
test('protocol 10: the Keeper\'s life — bites cut by the guard, soaks and heals bounded, death after its grace, a wake', () => {
  const guard = { max: 200, defense: 0, resists: { fire: 50, cold: 0, lightning: 0, arcane: 0 }, level: 10 };
  // The declared guard never passes the ceiling.
  const g = clampGuard({ max: 9999, defense: 9999, resists: { fire: 100 } }, guard);
  assert.deepEqual([g.max, g.defense, g.resists.fire], [200, 0, 50]);
  assert.ok(guestGuard(5).max < guestGuard(50).max);
  const L = new KeeperLife(guard, 200);
  let now = 1000;
  // A fire bite through half its resist.
  assert.equal(L.bite(40, 'fire', 10, now), 20);
  assert.equal(L.hp, 180);
  // A status-only blow takes nothing.
  assert.equal(L.bite(1, 'physical', 10, now, true), 0);
  // A ward's soak: never more than the bites took in the window.
  assert.equal(L.claim({ q: 1, k: 'soak', n: 500 }, now).n, 20);
  assert.equal(L.hp, 200);
  // Heals in a fight: at most HEAL_SHARE of the most a second over the window; a forged potion is refused.
  L.bite(150, 'physical', 10, now);
  const healed = L.claim({ q: 2, k: 'heal', n: 10000 }, now).n;
  assert.ok(healed <= 200 * LIFE.healShare * LIFE.windowMs / 1000, `clipped (${healed})`);
  assert.equal(L.claim({ q: 3, k: 'potion', n: 5000, p: 'elixir-of-forever' }, now).ok, false);
  // A stale claim (already taken) is ignored.
  assert.equal(L.claim({ q: 2, k: 'heal', n: 50 }, now).why, 'stale');
  // Harm the room did not deal is always believed; at zero it is dying, and a soak in its grace lifts it.
  L.claim({ q: 4, k: 'hurt', n: L.hp + 30 }, now);
  assert.ok(L.hp <= 0);
  assert.equal(L.tick(now + 100), false, 'still in its grace');
  L.bite(60, 'physical', 10, now + 100);
  assert.ok(L.claim({ q: 5, k: 'soak', n: 60 }, now + 200).n > 0);
  // Down after its grace with nothing coming: bites and heals no longer move it; a wake stands it up whole.
  L.claim({ q: 6, k: 'hurt', n: 9999 }, now + 300);
  assert.equal(L.tick(now + 300 + LIFE.graceMs + 1), true);
  assert.equal(L.down, true);
  assert.equal(L.bite(50, 'physical', 10, now + 2000), 0);
  assert.equal(L.claim({ q: 7, k: 'heal', n: 50 }, now + 2000).ok, false);
  assert.equal(L.view().d, 1);
  assert.equal(L.claim({ q: 8, k: 'wake', n: 0 }, now + 3000).ok, true);
  assert.deepEqual([L.down, L.hp], [false, 200]);
  assert.equal(L.view().q, 8);
});

test('protocol 10: a room creature fells a Keeper on the room; everyone near sees it; it is hunted no more', () => {
  const t = { now: T0 };
  const lives = new Map([['a', new KeeperLife({ max: 30, defense: 0, resists: {}, level: 1 }, 30)]]);
  const w = world('death', t, id => lives.get(id) ?? null);
  w.fxQuiet();
  w.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 1 });
  w.keeper({ id: 'b', x: OPEN.x + 60, y: OPEN.y, level: 1 });
  const id = w.fxLay('ash-wolf', OPEN.x + 12, OPEN.y, false);
  assert.ok(id);
  let downAt = null;
  for (let i = 0; i < 400 && downAt === null; i++) {
    t.now += 50; w.tick(.05);
    if (lives.get('a').tick(t.now)) { w.downed('a'); downAt = i; }
  }
  assert.notEqual(downAt, null, 'the wolf felled the Keeper on the room');
  const sa = w.snapFor('a'), sb = w.snapFor('b');
  assert.ok(sa.ev.some(e => e.k === 'down' && e.to === 'a'), 'the fallen hears it');
  assert.ok(sb.ev.some(e => e.k === 'down' && e.to === 'a'), 'the Keeper beside it sees it');
  assert.equal(sa.me.d, 1);
  // Its life stays at zero: the room's creatures no longer strike it.
  const bites = lives.get('a').stats.bites;
  for (let i = 0; i < 40; i++) { t.now += 50; w.tick(.05); }
  assert.equal(lives.get('a').stats.bites, bites);
  assert.equal(w.snapFor('b').me, undefined, 'a Keeper whose life the room does not keep is sent none');
});

// ── The room over HTTP: refusals, life, credit ──
async function room(t, { store = memoryStore(), db = null } = {}) {
  let time = T0;
  store.db = db ?? C.memoryDb(store.docs);
  const r = createSocialServer({
    publishMs: 5, now: () => time, store, core: sim,
    world: { sim, seed: 'room4', fx: true, timing: { tickMs: 0, sleepMs: 60000, askWaitMs: 1000, creditGapMs: 200, retryMs: 300 } },
    verify: async token => { const m = /^tok-(\w+)-padding$/.exec(token); if (!m) throw Object.assign(new Error('bad'), { status: 401 }); return { uid: m[1], anonymous: false }; },
  });
  await new Promise(res => r.server.listen(0, '127.0.0.1', res));
  t.after(() => r.dispose());
  const base = `http://127.0.0.1:${r.server.address().port}`;
  const post = async (path, body, token, headers = {}) => {
    const res = await fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const join = async (name, { uid = null, protocol = 10, hp = 100 } = {}) => {
    const r2 = await post('/join', { name, party: true, coop: true, trade: true, world: true, protocol, character: 'c1', hp, maxHp: hp }, null, uid ? { Authorization: `Firebase tok-${uid}-padding` } : {});
    return { ...r2.body, status: r2.status };
  };
  const move = (k, x, y) => post('/update', { x, y, facing: 1, animation: 'idle', zone: AREA, area: AREA, level: 20 }, k.token);
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
            if (chunk.startsWith('data: ')) seen.push(JSON.parse(chunk.slice(6)));
          }
        }
      } catch { /* aborted */ }
    })();
    const all = type => seen.filter(e => e.type === type);
    const until = async (f, ms = 3000) => { const end = Date.now() + ms; for (;;) { const v = f(); if (v) return v; if (Date.now() > end) return null; await new Promise(res2 => setTimeout(res2, 10)); } };
    return { seen, all, until };
  };
  const step = async (n = 1, ms = 50) => { for (let i = 0; i < n; i++) { time += ms; r.worldStep(ms); } await new Promise(res => setTimeout(res, 15)); };
  return { r, post, join, move, stream, step, store };
}
/** A signed-in Keeper's save: Hunting XP (level ~10), a purse, an Ember debt, its look. */
const save = (store, uid, { xp = 4000, gold = 100, debt = 0 } = {}) => {
  store.docs.set(`users/${uid}/progress/activity`, { v: { version: 1, era: 3, currentWork: null, progress: { version: 1, xpByDiscipline: { hunting: xp } }, operations: [], craftedBasaltEdge: false, emberGranted: false, miningAccepted: 0, foragingAccepted: 0, prospectingAccepted: 0, clarityElixirGranted: false }, updatedAt: '' });
  store.docs.set(`users/${uid}/economy/state`, { v: { version: C.ECONOMY_VERSION, goldEra: C.GOLD_ERA, gold, ops: [], origin: null, hlc: T0 - 500, applied: {}, cosmetics: [], totalGoldEarned: gold, runGoldEarned: gold }, updatedAt: '' });
  store.docs.set(`users/${uid}/progress/hearth`, { v: { version: 1, lit: [], wake: null, wakeAt: 0, debt, blessings: [], ledgerAt: 1, falls: debt ? 1 : 0 }, updatedAt: '' });
  store.docs.set(`users/${uid}/progress/keeper-look`, { v: { vocation: 'warlock', stats: { vit: 0, ene: 0, spi: 0, agi: 0 } }, updatedAt: '' });
};
const hunting = (store, uid) => store.docs.get(`users/${uid}/progress/activity`).v.progress.xpByDiscipline.hunting;
const purse = (store, uid) => store.docs.get(`users/${uid}/economy/state`).v.gold;

test('protocol 10: the room says which claims it refused and why; a protocol-9 client is answered as before', async t => {
  const { post, join, move, stream, step } = await room(t);
  const a = await join('Aster'), old = await join('Oskar', { protocol: 9 });
  await move(a, OPEN.x, OPEN.y); await move(old, OPEN.x + 20, OPEN.y);
  await stream(a); await stream(old);
  await step(3);
  const near = (await post('/world/fx', { quiet: true, lay: { type: 'ash-wolf', dx: 40, dy: 0, calm: true } }, a.token)).body.id;
  const far = (await post('/world/fx', { lay: { type: 'ash-wolf', dx: 390, dy: 0, calm: true } }, a.token)).body.id;
  await step(2);
  const r = await post('/coop/hits', { area: AREA, hits: [{ i: near, d: 5, el: 'physical' }, { i: far, d: 5, el: 'physical' }], st: [{ i: near, k: 'stun', s: 'ember-bolt', t: 10 }, { i: near, k: 'root', s: 'thornroot-snare', t: 10 }] }, a.token);
  assert.equal(r.status, 200, JSON.stringify([near, far, r.body]));
  assert.equal(r.body.landed, 1);
  assert.deepEqual(r.body.no, [{ i: far, why: 'far' }]);
  assert.equal(r.body.st.landed, 1);
  assert.deepEqual(r.body.st.no, [{ i: near, why: 'illegal' }]);
  // A status alone (no blow) is a claim too; a malformed one is refused whole.
  assert.equal((await post('/coop/hits', { area: AREA, hits: [], st: [{ i: near, k: 'taunt', s: 'watch-cry', t: 20 }] }, a.token)).body.st.landed, 1);
  assert.equal((await post('/coop/hits', { area: AREA, hits: [], st: [{ i: near, k: 'petrify', s: 'watch-cry', t: 20 }] }, a.token)).status, 400);
  // A protocol-9 client: its claims answered without the refusals; statuses not taken.
  const o = await post('/coop/hits', { area: AREA, hits: [{ i: far, d: 5, el: 'physical' }] }, old.token);
  assert.deepEqual(Object.keys(o.body).sort(), ['dmg', 'landed', 'ok', 'refused']);
  assert.equal((await post('/coop/hits', { area: AREA, hits: [{ i: near, d: 5, el: 'physical' }], st: [] }, old.token)).status, 400);
  assert.equal((await post('/world/life', { c: [] }, old.token)).status, 404);
});

test('protocol 10: two Keepers — one stuns, the creature stands for both; one falls on the room and both see it', async t => {
  const { r, post, join, move, stream, step } = await room(t);
  const a = await join('Aster', { hp: 40 }), b = await join('Bryn');
  assert.equal(a.life, true);
  assert.equal(a.credits, false, 'a guest is never paid by the room');
  await move(a, OPEN.x, OPEN.y); await move(b, OPEN.x + 30, OPEN.y);
  const sa = await stream(a), sb = await stream(b);
  await step(3);
  const wolf = (await post('/world/fx', { quiet: true, lay: { type: 'ash-wolf', dx: 60, dy: 0, calm: true } }, a.token)).body.id;
  await step(4);
  assert.equal((await post('/coop/hits', { area: AREA, hits: [], st: [{ i: wolf, k: 'stun', s: 'shield-bash', t: 20 }] }, a.token)).body.st.landed, 1);
  await step(4);
  for (const s of [sa, sb]) assert.ok(await s.until(() => s.all('coop-snap').some(e => e.mobs.some(m => m.i === wolf && (m.st ?? 0) & 1))), 'both see it stunned');
  // The guard declared (most life 40), then a pack of wolves on Aster: the room fells it; both streams see it fall.
  const life = await post('/world/life', { g: { m: 40, d: 0, r: [0, 0, 0, 0] }, c: [] }, a.token);
  assert.equal(life.body.me.m, 40);
  for (let i = 0; i < 3; i++) await post('/world/fx', { lay: { type: 'ash-wolf', dx: 10 + i * 4, dy: i * 6, calm: false } }, a.token);
  let down = null;
  for (let i = 0; i < 300 && !down; i++) { await step(1, 100); down = sb.all('coop-snap').flatMap(e => e.ev).find(e => e.k === 'down' && e.to === a.id); }
  assert.ok(down, 'Bryn saw Aster fall');
  assert.ok(await sa.until(() => sa.all('coop-snap').some(e => e.me?.d === 1)), 'Aster is told it is down');
  // Up again at a hearth: whole.
  const woke = await post('/world/life', { c: [{ q: 1, k: 'wake', n: 40 }] }, a.token);
  assert.deepEqual([woke.body.me.h, woke.body.me.d], [40, undefined]);
  assert.ok(r.rooms.health());
});

test('protocol 10: XP and Gold credited by the room — once, merge-safe, the debt first, capped, idempotent on retry', async t => {
  const store = memoryStore();
  const real = C.memoryDb(store.docs);
  // The first commit "loses its answer": it lands, then the room hears an error (and must not pay twice on retry).
  let lose = 1;
  const db = { ...real, async run(fn) { const v = await real.run(fn); if (lose > 0) { lose--; throw new Error('socket hang up'); } return v; } };
  const { r, post, join, move, stream, step } = await room(t, { store, db });
  save(store, 'u1', { xp: 4000, gold: 100, debt: 10 });
  const a = await join('Aster', { uid: 'u1' });
  assert.equal(a.credits, true);
  await move(a, OPEN.x, OPEN.y);
  const sa = await stream(a);
  await step(3);
  const wolf = (await post('/world/fx', { quiet: true, lay: { type: 'ash-wolf', dx: 40, dy: 0, calm: true } }, a.token)).body.id;
  await step(2);
  const w = r.rooms.worldOf(AREA), m = w.mobs.mobs.find(x => x.nid === wolf);
  // What the room pays the kill on (its life's XP, the sky's lift), as the room hands it to the credit.
  const paidOn = [], flush = w.flushKills.bind(w);
  w.flushKills = () => { const k = flush(); paidOn.push(...k); return k; };
  w.mobs.applyClaim(m, 1e9, a.id);
  await step(2);
  const kill = await sa.until(() => sa.all('coop-snap').flatMap(e => e.ev).find(e => e.k === 'kill' && e.i === wolf));
  assert.ok(kill?.cr, 'the kill carries its credit id');
  // The screen asks for its own number twice (a double send), far past the cap: paid once, at the cap.
  const xp0 = hunting(store, 'u1');
  for (let i = 0; i < 2; i++) assert.equal((await post('/world/credit', { c: [{ id: kill.cr, n: 999999 }] }, a.token)).status, 200);
  for (let i = 0; i < 20; i++) await step(1, 100);
  const paid = await sa.until(() => sa.all('world-credit').find(e => e.ok && e.ids.includes(kill.cr)));
  assert.ok(paid, 'the room paid the kill (its lost answer retried as the same batch)');
  // The debt took its share first (hearth-rules payDebt), the rest landed as ONE activity op of the room's.
  const act = store.docs.get('users/u1/progress/activity').v;
  const debtPaid = 10 - store.docs.get('users/u1/progress/hearth').v.debt, earned = hunting(store, 'u1') - xp0, gross = earned + debtPaid;
  const on = paidOn.find(k => k.id === kill.cr);
  const base = sim.fighterXp(on.hp, on.xpK, sim.keeperBudget({ activity: { v: { progress: { xpByDiscipline: { hunting: xp0 } } } } }).level, on.level);
  assert.ok(debtPaid > 0 && debtPaid === Math.min(10, Math.ceil(gross * 0.5)), `the debt first (${debtPaid} of ${gross})`);
  assert.ok(gross >= base && gross <= Math.ceil(base * XP_CAP) + 1, `capped (${gross}, base ${base})`);
  assert.equal(act.operations.filter(o => o.hlcRevision.deviceId === 'room').length, 1, 'one op (the lost answer was retried, not paid again)');
  // The activity ledger still reads as the client's merge reads it (coerce keeps the op and the totals).
  assert.ok(act.operations[0].id.startsWith('room:'));
  // A pile from the room's ground: the room pays its Gold (capped), the screen never does.
  const pile = w.groundList().find(g => g.coins > 0);
  await move(a, pile.x, pile.y);
  await step(1);
  const take = await post('/world/take', { id: pile.id }, a.token);
  assert.equal(take.body.ok, true);
  assert.equal(take.body.pays, true);
  const g0 = purse(store, 'u1');
  await post('/world/credit', { c: [{ id: pile.id, n: 10 ** 7 }] }, a.token);
  for (let i = 0; i < 20; i++) await step(1, 100);
  const gp = await sa.until(() => sa.all('world-credit').find(e => e.ok && e.ids.includes(pile.id)));
  assert.equal(gp.gold, goldCap(pile.coins));
  assert.equal(purse(store, 'u1') - g0, goldCap(pile.coins));
  const econ = store.docs.get('users/u1/economy/state').v;
  assert.equal(C.replayGold(econ), econ.gold, 'every device replays the same purse (one credit-gold op)');
  assert.equal(econ.ops.filter(o => o.kind === 'credit-gold').length, 1);
  // The same batch again at the store (a retried transaction): nothing more.
  const again = await creditRoom(real, { uid: 'u1', character: 'c1', batch: 'replay', area: AREA, items: [{ id: kill.cr, xp: 50 }, { id: pile.id, gold: 50 }] }, T0 + 1e6);
  assert.deepEqual([again.xp, again.gold, again.dup.length], [0, 0, 2]);
  assert.equal(purse(store, 'u1') - g0, goldCap(pile.coins));
  // The ring stays bounded (one small document).
  assert.ok(store.docs.get(creditPath('u1', 'c1')).done.length <= sim.RING);
});

test('protocol 10: a room that dies between a kill and its commit pays nothing twice; a guest\'s and a protocol-9 client\'s credit stays their own', async t => {
  const store = memoryStore();
  save(store, 'u2', { xp: 4000, gold: 0 });
  const real = C.memoryDb(store.docs);
  // The room "dies" mid-commit: its transaction lands at the store, and the room never hears back (nor steps again).
  let dead = false;
  const db = { ...real, async run(fn) { const v = await real.run(fn); if (!dead) { dead = true; return new Promise(() => {}); } return v; } };
  const first = await room(t, { store, db });
  const a = await first.join('Aster', { uid: 'u2' });
  await first.move(a, OPEN.x, OPEN.y);
  const sa = await first.stream(a);
  await first.step(3);
  const wolf = (await first.post('/world/fx', { quiet: true, lay: { type: 'ash-wolf', dx: 40, dy: 0, calm: true } }, a.token)).body.id;
  await first.step(2);
  const w = first.r.rooms.worldOf(AREA);
  w.mobs.applyClaim(w.mobs.mobs.find(x => x.nid === wolf), 1e9, a.id);
  await first.step(2);
  const kill = await sa.until(() => sa.all('coop-snap').flatMap(e => e.ev).find(e => e.k === 'kill' && e.i === wolf));
  const xp0 = hunting(store, 'u2');
  for (let i = 0; i < 15; i++) await first.step(1, 100);
  assert.equal(dead, true, 'the commit was made');
  const once = hunting(store, 'u2') - xp0;
  assert.ok(once > 0, 'it landed once');
  // A room that comes back and sends the same owed id again (under a new batch) pays nothing more: the ring holds it.
  const again = await creditRoom(real, { uid: 'u2', character: 'c1', batch: 'b.next.1', area: AREA, items: [{ id: kill.cr, xp: 500 }] }, T0 + 1e6);
  assert.deepEqual([again.xp, again.dup], [0, [kill.cr]]);
  assert.equal(hunting(store, 'u2') - xp0, once);
  // A save the client never wrote: kept and tried again, never paid twice. A purse not written yet keeps only the Gold.
  await assert.rejects(creditRoom(real, { uid: 'nobody', character: 'c1', batch: 'b.x.1', area: AREA, items: [{ id: 'k.x.9', xp: 5 }] }, T0), e => e.code === 'no-save');
  store.docs.delete('users/u2/economy/state');
  const part = await creditRoom(real, { uid: 'u2', character: 'c1', batch: 'b.x.2', area: AREA, items: [{ id: 'k.x.10', xp: 7 }, { id: 'td:surface:w.x.y.z', gold: 9 }] }, T0 + 2e6);
  assert.deepEqual([part.paid, part.kept, part.xp, part.gold], [['k.x.10'], ['td:surface:w.x.y.z'], 7, 0]);
  // A guest has no save: never owed by the room; a protocol-9 client pays itself (the room owes it nothing).
  const next = await room(t);
  const guest = await next.join('Gil');
  const old = await next.join('Oskar', { uid: 'u3', protocol: 9 });
  assert.equal(guest.credits, false);
  assert.equal(old.credits, undefined);
  assert.equal((await next.post('/world/credit', { c: [{ id: 'k.x.1', n: 5 }] }, old.token)).status, 404);
});
