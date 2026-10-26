// Protocol 7: the room-run world (docs/design/online.md "Phase 8: the room simulates"). The room runs the game's own
// creature simulation (src/app/play/world/room-world.ts, compiled here from the sources exactly as the deploy bundles
// it), streams it on the protocol-5 wire from '@room', weighs the Keepers' blows, rolls the loot once and owns the ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL, createSocialServer } from './social-server.mjs';
import { memoryStore } from './social-identity.mjs';
import { load } from './world-sim-build.mjs';

const sim = load();
const { RoomWorld, ROOM_HOST, WORLD_AREAS, OWN_MS, TAKE_REACH } = sim;
const origin = 'http://127.0.0.1:4317';
const AREA = 'ember-isle';
/** A spot in the open just outside the Seamworks (no town safety, walkable): found once from the real map. */
const OPEN = (() => {
  const w = new RoomWorld({ area: AREA, seed: 'probe', now: () => 0 });
  for (let r = 0; r < 200; r++) for (let c = -60; c < 60; c++) {
    const x = c * 16 + 8, y = r * 16 + 8;
    if (!w.world.safeAt(c, r) && [0, 1, 2, 3, 4].every(d => w.world.walkable(c + d, r)) && w.world.walkable(c, r + 1)) return { x, y };
  }
  throw new Error('no open ground');
})();

// ── The world alone (pure) ──
const world = (seed = 'seed-a', t = { now: 1_800_000_000_000 }) => new RoomWorld({ area: AREA, seed, now: () => t.now, boot: 'b1' });
const fingerprint = w => JSON.stringify({ mobs: w.mobs.mobs.map(m => [m.nid ?? '', m.key, m.def.id, Math.round(m.x * 10), Math.round(m.y * 10), Math.round(m.hp)]), ground: w.groundList().map(g => [g.id, g.x, g.y, g.coins, g.material ?? '', g.item?.definitionId ?? '', g.rune ?? '']) });

test('protocol 7: the world is the game\'s own (MobSystem, the island\'s spawn tables) and a seed replays it exactly', () => {
  assert.ok(PROTOCOL >= 7);
  assert.deepEqual([...WORLD_AREAS], [AREA]);
  const run = seed => {
    const w = world(seed);
    w.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 12 });
    w.keeper({ id: 'b', x: OPEN.x + 300, y: OPEN.y + 40, level: 12 });
    for (let i = 0; i < 80; i++) {
      w.tick(.05);
      // The same blows each run: every second, both Keepers strike whatever is nearest.
      if (i % 20 === 19) for (const id of ['a', 'b']) {
        const k = id === 'a' ? OPEN : { x: OPEN.x + 300, y: OPEN.y + 40 };
        const m = [...w.mobs.mobs].sort((p, q) => Math.hypot(p.x - k.x, p.y - k.y) - Math.hypot(q.x - k.x, q.y - k.y))[0];
        if (m) { w.snapFor(id); w.claims(id, [{ i: m.nid, d: 30, el: 'physical' }]); }
      }
    }
    return w;
  };
  const one = run('seed-a'), two = run('seed-a'), other = run('seed-b');
  assert.ok(one.mobs.mobs.length > 0, 'the island raised creatures round the Keepers');
  assert.equal(fingerprint(one), fingerprint(two), 'the same seed and intents play out the same');
  assert.notEqual(fingerprint(one), fingerprint(other), 'another seed is another world');
  // Each Keeper is sent the creatures near it, as a keyframe first, then deltas.
  const s1 = one.snapFor('a'), s2 = one.snapFor('a');
  assert.equal(s2.seq, s1.seq + 1);
  assert.ok(s2.mobs.length <= s1.mobs.length);
});

test('protocol 7: a kill rolls its loot once, here; its fighters own it first; first come wins; a full satchel hands it back', () => {
  const t = { now: 1_800_000_000_000 };
  const w = world('loot', t);
  w.fxQuiet();
  w.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 30 });
  w.keeper({ id: 'b', x: OPEN.x + 20, y: OPEN.y, level: 30 });
  const id = w.fxLay('ash-wolf', OPEN.x + 30, OPEN.y, true);
  const m = w.mobs.mobs.find(x => x.nid === id);
  w.snapFor('a'); w.snapFor('b');
  let n = 0;
  while (m.hp > 0 && n++ < 20) w.claims('a', [{ i: id, d: 60, el: 'physical' }]);
  assert.equal(w.mobs.mobs.includes(m), false, 'the wolf fell');
  assert.equal(w.stats.kills, 1);
  // Both Keepers hear the kill, naming who fought it.
  for (const k of ['a', 'b']) {
    const kill = w.snapFor(k).ev.find(e => e.k === 'kill');
    assert.ok(kill, `${k} hears the kill`);
    assert.deepEqual(kill.by, ['a']);
  }
  const ground = w.groundList();
  assert.ok(ground.length >= 1, 'it left at least its Gold pile');
  assert.ok(ground.every(g => g.m === id && g.own.join() === 'a' && g.free > 0 && g.free <= OWN_MS));
  const { add } = w.flushGround();
  assert.deepEqual(add.map(g => g.id).sort(), ground.map(g => g.id).sort(), 'the area is told once');
  const pile = ground.find(g => g.coins > 0);
  // Bryn did not fight it: refused while Aster's; Aster takes it; then it is gone for everyone.
  assert.deepEqual(w.take(pile.id, 'b'), { ok: false, why: 'owned' });
  const got = w.take(pile.id, 'a');
  assert.equal(got.ok, true);
  assert.equal(got.drop.coins, pile.coins);
  assert.deepEqual(w.take(pile.id, 'a'), { ok: false, why: 'gone' });
  assert.deepEqual(w.flushGround().gone, [pile.id]);
  // A satchel too full to hold it: it lies again, for its taker only to hand back.
  assert.equal(w.giveBack(pile.id, 'b'), false);
  assert.equal(w.giveBack(pile.id, 'a'), true);
  assert.ok(w.ground.has(pile.id));
  // After the owners' time anyone may take it.
  t.now += OWN_MS + 1;
  assert.equal(w.take(pile.id, 'b').ok, true);
});

test('protocol 7: forged intents are refused — far, unseen, over budget, unknown, out of reach', () => {
  const w = world('forge');
  w.fxQuiet();
  w.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 5 });
  const id = w.fxLay('ash-wolf', OPEN.x + 40, OPEN.y, true);
  const m = w.mobs.mobs.find(x => x.nid === id);
  const max = m.hp;
  // Unknown creature.
  assert.deepEqual(w.claims('a', [{ i: 'zz', d: 5, el: 'physical' }]), { landed: 0, refused: 1, dmg: 0 });
  // Not a Keeper in the area.
  assert.equal(w.claims('nobody', [{ i: id, d: 5, el: 'physical' }]).landed, 0);
  // Over the level's budget: a level 5 Keeper deals at most (40 + 20×5) × 3 s in the window, whatever it claims.
  const r = w.claims('a', [{ i: id, d: 100000, el: 'physical' }]);
  assert.equal(r.landed, 1);
  assert.ok(r.dmg <= 420 && r.dmg > 0, `clipped to the budget (${r.dmg} of ${max})`);
  // The budget is spent for this window: the next blow is refused until it rolls on.
  const id3 = w.fxLay('ash-wolf', OPEN.x + 30, OPEN.y + 10, true);
  assert.equal(w.claims('a', [{ i: id3, d: 5, el: 'physical' }]).landed, 0);
  for (let i = 0; i < 14; i++) w.tick(.25);
  assert.equal(w.claims('a', [{ i: id3, d: 5, el: 'physical' }]).landed, 1);
  // From far away (the room's own record of where the Keeper stands, not the claim's word).
  w.keeper({ id: 'a', x: OPEN.x + 2000, y: OPEN.y, level: 5 });
  const before = w.stats.refusedFar;
  assert.equal(w.claims('a', [{ i: id3, d: 5, el: 'physical' }]).landed, 0);
  assert.equal(w.stats.refusedFar, before + 1);
  // Through a wall: find two open tiles with solid ground between them on the island's map.
  const sight = w.mobs.sight;
  let pair = null;
  for (let r = -80; r < 120 && !pair; r++) for (let c = -80; c < 80 && !pair; c++) {
    const ok = d => w.world.walkable(c + d, r);
    if (ok(0) && !ok(2) && !ok(3) && ok(5) && !sight.sees(c * 16 + 8, r * 16 + 8, (c + 5) * 16 + 8, r * 16 + 8)) pair = { a: { x: c * 16 + 8, y: r * 16 + 8 }, b: { x: (c + 5) * 16 + 8, y: r * 16 + 8 } };
  }
  assert.ok(pair, 'a wall on the island');
  const id2 = w.fxLay('ash-wolf', pair.b.x, pair.b.y, true);
  w.keeper({ id: 'a', x: pair.a.x, y: pair.a.y, level: 5 });
  const seen = w.stats.refusedSight;
  assert.equal(w.claims('a', [{ i: id2, d: 5, el: 'physical' }]).landed, 0);
  assert.equal(w.stats.refusedSight, seen + 1);
  // A take from out of reach (the first wolf's loot).
  assert.equal(m.hp <= 0, true, 'the first wolf fell');
  const g = w.groundList()[0];
  w.keeper({ id: 'a', x: g.x + TAKE_REACH + 40, y: g.y, level: 5 });
  assert.deepEqual(w.take(g.id, 'a'), { ok: false, why: 'far' });
});

test('protocol 7: sleep and wake — the ground and the resting spawns survive in the store', () => {
  const t = { now: 1_800_000_000_000 };
  const w = world('sleep', t);
  w.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 40 });
  for (let i = 0; i < 10; i++) w.tick(.1);
  const wild = w.mobs.mobs.find(m => !m.key.startsWith('fx-'));
  assert.ok(wild, 'a wild creature rose');
  w.snapFor('a');
  for (let i = 0; i < 200 && w.mobs.mobs.includes(wild); i++) { w.keeper({ id: 'a', x: wild.x - 20, y: wild.y, level: 40 }); w.claims('a', [{ i: wild.nid, d: 200, el: 'physical' }]); w.tick(.25); }
  assert.equal(w.mobs.mobs.includes(wild), false, 'it fell');
  const doc = JSON.parse(JSON.stringify(w.save()));
  assert.ok(doc.ground.length >= 1);
  assert.ok(doc.resting.some(([k]) => k === wild.key), 'its spawn rests');
  t.now += 20_000;
  const woke = world('another seed', t);
  woke.load(doc);
  assert.deepEqual(woke.groundList().map(g => g.id).sort(), doc.ground.map(g => g.id).sort());
  assert.equal(woke.mobs.resting(wild.key), true, 'still resting after the sleep');
  woke.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 40 });
  for (let i = 0; i < 4; i++) woke.tick(.25);
  assert.equal(woke.mobs.mobs.some(m => m.key === wild.key), false, 'it does not rise twice');
  // Past its five minutes, nothing is restored.
  t.now += 400_000;
  const late = world('late', t);
  late.load(doc);
  assert.equal(late.groundList().length, 0);
});

test('protocol 7: under an eclipse the Seam Eater rises at the island\'s rift for everyone; slain, it stays down that eclipse', () => {
  const t = { now: sim.nextEclipse(1_800_000_000_000).startMs + 60_000 };
  const w = world('seam', t);
  w.keeper({ id: 'a', x: OPEN.x, y: OPEN.y, level: 60 });
  w.tick(.25); w.tick(.25); w.tick(.25);
  assert.ok(w.rift, 'the island has a rift');
  w.keeper({ id: 'a', x: w.rift.x + 40, y: w.rift.y, level: 60 });
  for (let i = 0; i < 4; i++) w.tick(.25);
  const eater = w.mobs.mobs.find(m => m.def.id === 'seam-eater-risen');
  assert.ok(eater, 'it rose');
  assert.ok(w.snapFor('a').mobs.some(m => m.t === 'seam-eater-risen'), 'and is streamed');
  // Two Keepers near it: its life grows by 60%.
  const life = eater.def.hp;
  w.keeper({ id: 'b', x: w.rift.x - 40, y: w.rift.y, level: 60 });
  for (let i = 0; i < 3; i++) w.tick(.25);
  assert.equal(eater.def.hp, Math.round(life * 1.6));
  // Felled: it does not rise again this eclipse, even after a sleep.
  eater.hp = 1;
  w.claims('a', [{ i: eater.nid, d: 50, el: 'physical' }]);
  for (let i = 0; i < 4; i++) w.tick(.25);
  assert.equal(w.mobs.mobs.some(m => m.def.id === 'seam-eater-risen'), false);
  const woke = world('seam-2', t);
  woke.load(JSON.parse(JSON.stringify(w.save())));
  woke.keeper({ id: 'a', x: w.rift.x + 40, y: w.rift.y, level: 60 });
  for (let i = 0; i < 6; i++) woke.tick(.25);
  assert.equal(woke.mobs.mobs.some(m => m.def.id === 'seam-eater-risen'), false);
});

// ── The room (HTTP, two clients) ──
async function room(t, { store = memoryStore(), timing = {} } = {}) {
  let time = 1_800_000_000_000;
  const r = createSocialServer({ publishMs: 5, now: () => time, store, world: { sim, seed: 'room', fx: true, timing: { tickMs: 0, sleepMs: 1000, ...timing } } });
  await new Promise(resolve => r.server.listen(0, '127.0.0.1', resolve));
  t.after(() => r.dispose());
  const base = `http://127.0.0.1:${r.server.address().port}`;
  const post = async (path, body, token) => {
    const res = await fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const join = async (name, extra = { party: true, coop: true, trade: true, world: true }) => (await post('/join', { name, ...extra })).body;
  const move = (k, x, y, area = AREA) => post('/update', { x, y, facing: 1, animation: 'idle', zone: area, area, level: 20 }, k.token);
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
    const until = async (f, ms = 2000) => { const end = Date.now() + ms; for (;;) { const v = f(); if (v) return v; if (Date.now() > end) return null; await new Promise(r => setTimeout(r, 10)); } };
    return { seen, all, until };
  };
  const step = async (n = 1, ms = 50) => { for (let i = 0; i < n; i++) { time += ms; r.worldStep(ms); } await new Promise(res => setTimeout(res, 15)); };
  return { r, base, post, join, move, stream, step, clock: { get: () => time, add: ms => { time += ms; } } };
}

test('protocol 7: two Keepers see the same creatures from @room, the same kill, the same drop; one takes it', async t => {
  const { post, join, move, stream, step } = await room(t);
  const a = await join('Aster'), b = await join('Bryn');
  assert.equal(a.world, true);
  await move(a, OPEN.x, OPEN.y); await move(b, OPEN.x + 24, OPEN.y);
  const sa = await stream(a), sb = await stream(b);
  await step(2);
  // The room hosts the island for both (no party needed).
  for (const s of [sa, sb]) {
    const c = await s.until(() => s.all('coop').filter(e => e.areas[AREA]?.members.length === 2).at(-1));
    assert.equal(c.areas[AREA].host, ROOM_HOST);
    assert.deepEqual([...c.areas[AREA].members].sort(), [a.id, b.id].sort());
  }
  const fx = await post('/world/fx', { quiet: true, lay: { type: 'ash-wolf', dx: 40, dy: 0, calm: true } }, a.token);
  const wolf = fx.body.id;
  assert.ok(wolf);
  await step(4);
  // The same creature, the same id, on both streams.
  for (const s of [sa, sb]) {
    const snap = await s.until(() => s.all('coop-snap').find(e => e.mobs.some(m => m.i === wolf)));
    assert.equal(snap.from, ROOM_HOST);
    assert.equal(snap.mobs.find(m => m.i === wolf).t, 'ash-wolf');
  }
  // A forged snapshot from a Keeper is refused: nobody but the room hosts here.
  assert.equal((await post('/coop/snap', { area: AREA, seq: 1, kf: true, mobs: [] }, a.token)).status, 409);
  // Aster's blows are claims; the wolf falls; both hear it.
  for (let i = 0; i < 12; i++) {
    const r = await post('/coop/hits', { area: AREA, hits: [{ i: wolf, d: 40, el: 'physical' }] }, a.token);
    assert.equal(r.status, 200);
    await step(1, 200);
    if (sa.all('coop-snap').some(e => e.ev.some(x => x.k === 'kill' && x.i === wolf))) break;
  }
  await step(3);
  for (const s of [sa, sb]) {
    const kill = await s.until(() => s.all('coop-snap').flatMap(e => e.ev).find(x => x.k === 'kill' && x.i === wolf));
    assert.ok(kill, 'the kill reached both');
    assert.deepEqual(kill.by, [a.id]);
  }
  // The same drop on both screens.
  const dropsOf = s => s.all('world-ground').flatMap(e => [...(e.items ?? []), ...(e.add ?? [])]).filter(g => g.m === wolf);
  const da = await sa.until(() => dropsOf(sa).length && dropsOf(sa)), db = await sb.until(() => dropsOf(sb).length && dropsOf(sb));
  assert.deepEqual(da.map(g => g.id).sort(), db.map(g => g.id).sort());
  const pile = da.find(g => g.coins > 0);
  // Bryn reaches for it first: still Aster's. Aster takes it (answered from memory); then it is gone for Bryn too.
  assert.deepEqual((await post('/world/take', { id: pile.id }, b.token)).body.why, 'owned');
  const t0 = performance.now();
  const took = await post('/world/take', { id: pile.id }, a.token);
  const rtt = performance.now() - t0;
  assert.equal(took.body.ok, true);
  assert.equal(took.body.drop.coins, pile.coins);
  console.log(`# world take: server ${took.body.ms} ms, local round trip ${rtt.toFixed(1)} ms`);
  assert.equal((await post('/world/take', { id: pile.id }, b.token)).body.why, 'gone');
  await sb.until(() => sb.all('world-ground').some(e => e.gone?.includes(pile.id)));
  // Forged ids and other places are refused.
  assert.equal((await post('/world/take', { id: 'td:surface:loot1' }, a.token)).status, 400);
  assert.equal((await post('/coop/hits', { area: 'ember-delve', hits: [{ i: wolf, d: 5, el: 'physical' }] }, a.token)).status, 409);
});

test('protocol 7: a protocol-6 client in the same place keeps its own creatures; nothing new reaches it', async t => {
  const { join, move, stream, step } = await room(t);
  const a = await join('Aster');
  const old = await join('Oskar', { party: true, coop: true, trade: true });
  assert.equal(old.world, false);
  await move(a, OPEN.x, OPEN.y); await move(old, OPEN.x + 24, OPEN.y);
  const so = await stream(old);
  await stream(a);
  await step(6);
  await new Promise(r => setTimeout(r, 50));
  assert.equal(so.all('coop-snap').length, 0);
  assert.equal(so.all('world-ground').length, 0);
  assert.equal(so.all('coop').some(e => Object.values(e.areas).some(v => v.host === ROOM_HOST)), false);
  // It still sees the other Keeper (presence is unchanged).
  assert.ok(so.all('players').some(e => e.players.some(p => p.name === 'Aster')) || so.all('snapshot').some(e => e.players.some(p => p.name === 'Aster')));
});

test('protocol 7 (as M3 keeps it): an empty area stays awake while anyone is in the world; with nobody left it sleeps to the store and wakes with its ground', async t => {
  const store = memoryStore();
  const { post, join, move, stream, step, r, base } = await room(t, { store });
  const a = await join('Aster');
  await move(a, OPEN.x, OPEN.y);
  // Aster's own stream, closed below (stream() keeps its streams open to the end of the test).
  const abort = new AbortController();
  const res = await fetch(`${base}/events`, { headers: { Origin: origin, Authorization: `Bearer ${a.token}` }, signal: abort.signal });
  void res.body.getReader().read().catch(() => {});
  await step(2);
  const wolf = (await post('/world/fx', { quiet: true, lay: { type: 'ash-wolf', dx: 30, dy: 0, calm: true } }, a.token)).body.id;
  await step(2);
  for (let i = 0; i < 12 && r.rooms.worldOf(AREA)?.mobs.mobs.some(m => m.nid === wolf); i++) { await post('/coop/hits', { area: AREA, hits: [{ i: wolf, d: 40, el: 'physical' }] }, a.token); await step(1, 200); }
  const lying = r.rooms.worldOf(AREA).groundList().map(g => g.id).sort();
  assert.ok(lying.length >= 1);
  // Aster walks into the mine: the island is empty, but Aster is still in the world — it stays awake (dormant).
  await move(a, 0, 0, 'ember-delve');
  await step(1);
  await step(1, 1500);
  await new Promise(res => setTimeout(res, 20));
  assert.ok(r.rooms.worldOf(AREA), 'still awake while anyone is in the world');
  // Aster's stream closes (logged out): with nobody in the world, after its grace every area is written and sleeps.
  abort.abort();
  await new Promise(res => setTimeout(res, 30));
  await step(1);
  await step(1, 1500);
  await new Promise(res => setTimeout(res, 20));
  assert.equal(r.rooms.worldOf(AREA), null, 'asleep');
  const saved = await store.worldLoad(AREA);
  assert.deepEqual(saved.ground.map(g => g.id).sort(), lying);
  // Back on the island: it wakes from the store and the same ground is sent.
  const sa = await stream(a);
  await move(a, OPEN.x, OPEN.y);
  await step(1);
  await new Promise(res => setTimeout(res, 20));
  await step(1);
  const items = await sa.until(() => sa.all('world-ground').filter(e => e.items).at(-1)?.items.length && sa.all('world-ground').filter(e => e.items).at(-1).items);
  assert.deepEqual(items.map(g => g.id).sort(), lying);
});
