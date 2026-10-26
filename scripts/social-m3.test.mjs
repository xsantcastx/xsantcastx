// Protocol 9: M3 of the room-run world (docs/design/online.md §4d "M3"). Every continent and every floor runs in the
// room; while anyone is in the world every area stays simulated (an empty one on the dormant tick); with nobody left
// the room writes each area and sleeps, and wakes fast-forwarded. Respawns per spawn (respawn.ts), world bosses on
// timers of hours with an omen (world-bosses.ts), lairs and denser packs (td-world hot spots, td-levels FLOOR_LAIRS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL, createSocialServer } from './social-server.mjs';
import { memoryStore } from './social-identity.mjs';
import { load } from './world-sim-build.mjs';
import { readFileSync } from 'node:fs';

/** combat-sim's walk between pulls (read from its source: importing it runs the whole sim). */
const TRAVEL = Number(/export const TRAVEL = (\d+(?:\.\d+)?);/.exec(readFileSync(new URL('./combat-sim.mjs', import.meta.url), 'utf8'))[1]);

const sim = load();
const { RoomWorld, WORLD_AREAS, WORLD_AREAS_ALL, WORLD_BOSSES, RESPAWN_RULES, GATE_BOSS_REST, CONTINENTS, LEVELS, fastForward } = sim;
const origin = 'http://127.0.0.1:4317';
const T0 = 1_800_000_000_000;
const FLOOR = 'molten-deep-1';
const H = 3600000;

const world = (area, t = { now: T0 }, seed = 'm3') => new RoomWorld({ area, seed, now: () => t.now, boot: 'b3' });
/** A floor's first ordinary spawn, and an open tile beside it (the Keeper stands there). */
const floorSpot = w => { const s = w.level.spawnsIn().find(x => w.mobs && sim.MOBS[x.type]?.rank !== 'boss'); return { x: s.x + 8, y: s.y }; };
/** Fell a creature outright (the room's own damage path: its rest is drawn as any fall's). */
const fell = (w, m, by = 'a') => { w.mobs.applyClaim(m, 1e9, by); w.tick(.05); };

test('protocol 9: every continent and every floor is a world area; protocol 7/8 keep the island', () => {
  assert.equal(PROTOCOL, 9);
  assert.deepEqual([...WORLD_AREAS], ['ember-isle']);
  for (const a of [...Object.keys(CONTINENTS), ...Object.keys(LEVELS)]) assert.ok(WORLD_AREAS_ALL.includes(a), a);
  // A floor's world is its hand-drawn level: all of it raised at once, its ground ids its own.
  const w = world(FLOOR);
  assert.equal(w.surface, false);
  assert.equal(w.levelId, FLOOR);
  const at = floorSpot(w);
  w.keeper({ id: 'a', ...at, level: 15 });
  for (let i = 0; i < 4; i++) w.tick(.25);
  assert.equal(w.mobs.mobs.filter(m => !m.summoned && !m.key.includes('~')).length >= w.level.spawnsIn().length - 1, true, 'the whole floor lives');
  assert.ok(w.level.spawnsIn().some(s => s.key.startsWith(`${FLOOR}:h`)), 'the floor has its lair');
  const m = w.mobs.mobs.find(x => x.def.rank !== 'boss');
  fell(w, m);
  assert.ok(w.groundList().length && w.groundList().every(g => g.id.startsWith(`td:${FLOOR}:w.${FLOOR}.`)));
});

test('protocol 9: respawns — ordinary 60–90 s each, elites longer, bosses about an hour (gate bosses ten minutes)', () => {
  assert.deepEqual([...RESPAWN_RULES.normal], [60, 90]);
  const rests = [];
  const w = world(FLOOR);
  w.keeper({ id: 'a', ...floorSpot(w), level: 20 });
  w.tick(.5);
  for (const m of [...w.mobs.mobs].filter(x => x.def.rank !== 'boss' && !x.elite)) {
    fell(w, m);
    rests.push(w.restingNow().find(([k]) => k === m.key)?.[1]);
  }
  assert.ok(rests.length >= 4);
  assert.ok(rests.every(s => s >= 59.9 && s <= 90.1), `ordinary rests ${rests}`);
  assert.ok(new Set(rests.map(Math.round)).size > 1, 'each spawn draws its own time');
  // A floor boss: the Magma Tyrant (an hour ± 15 %); the Ember Warden stands before the story (about ten minutes).
  for (const [area, boss, lo, hi] of [['molten-deep-3', 'magma-tyrant', 51 * 60, 69 * 60], ['ember-mine-3', 'ember-warden', ...GATE_BOSS_REST['ember-warden']]]) {
    const b = world(area);
    const s = b.level.spawnsIn().find(x => x.type === boss);
    b.keeper({ id: 'a', x: s.x, y: s.y + 20, level: 40 });
    b.tick(.5);
    const m = b.mobs.mobs.find(x => x.def.id === boss);
    fell(b, m);
    const left = b.restingNow().find(([k]) => k === m.key)?.[1];
    assert.ok(left >= lo - .1 && left <= hi + .1, `${boss} rests ${left}`);
  }
  // An elite leader rests three to five minutes.
  const e = world('ember-isle');
  e.fxQuiet();
  e.keeper({ id: 'a', x: 0, y: 0, level: 20 });
  const pack = e.mobs.spawnPack('test:elite', sim.MOBS['ash-wolf'], 40, 0, { rank: 'champion', affixes: [], name: null, followers: 0 });
  fell(e, pack[0]);
  const er = e.restingNow().find(([k]) => k === 'test:elite')?.[1];
  assert.ok(er >= 180 && er <= 300, `elite rests ${er}`);
});

test('protocol 9: the dormant tick — nobody there, the fallen rest on and rise on time; a wake fast-forwards', () => {
  const t = { now: T0 };
  const w = world(FLOOR, t);
  w.keeper({ id: 'a', ...floorSpot(w), level: 20 });
  w.tick(.5);
  const m = w.mobs.mobs.find(x => x.def.rank !== 'boss' && !x.elite);
  fell(w, m);
  const rest = w.restingNow().find(([k]) => k === m.key)[1];
  w.leave('a');
  // Nobody here: a minute of dormant ticks, once a second. It is still down; the others stand where they stood.
  const others = w.mobs.mobs.length;
  for (let i = 0; i < 50; i++) { t.now += 1000; w.idle(1); }
  assert.ok(w.restingNow().some(([k]) => k === m.key), 'still resting');
  assert.equal(w.mobs.mobs.length, others, 'nothing moved, nothing was forgotten');
  // Back after its time: it has risen.
  for (let i = 0; i < Math.ceil(rest) - 49; i++) { t.now += 1000; w.idle(1); }
  w.keeper({ id: 'a', ...floorSpot(w), level: 20 });
  for (let i = 0; i < 3; i++) w.tick(.25);
  assert.ok(w.mobs.mobs.some(x => x.key === m.key), 'risen on time');
  // Sleep and wake: a boss felled, the room asleep 20 minutes; on wake it still has ~40 to rest, an ordinary is up.
  const b = world('molten-deep-3', t);
  const s = b.level.spawnsIn().find(x => x.type === 'magma-tyrant');
  b.keeper({ id: 'a', x: s.x, y: s.y + 20, level: 40 });
  b.tick(.5);
  const ty = b.mobs.mobs.find(x => x.def.id === 'magma-tyrant'), small = b.mobs.mobs.find(x => x.def.rank !== 'boss' && !x.elite && x.key !== ty.key);
  fell(b, ty); fell(b, small);
  const before = b.restingNow().find(([k]) => k === ty.key)[1];
  const doc = JSON.parse(JSON.stringify(b.save()));
  t.now += 20 * 60000;
  const woke = world('molten-deep-3', t, 'm3-woke');
  woke.load(doc);
  const after = woke.restingNow().find(([k]) => k === ty.key)?.[1];
  assert.ok(Math.abs(after - (before - 1200)) < 2, `the boss rests on: ${before} → ${after}`);
  assert.equal(woke.restingNow().some(([k]) => k === small.key), false, 'the ordinary one rose while the room slept');
  woke.keeper({ id: 'a', x: s.x, y: s.y + 20, level: 40 });
  for (let i = 0; i < 3; i++) woke.tick(.25);
  assert.ok(woke.mobs.mobs.some(x => x.key === small.key) && !woke.mobs.mobs.some(x => x.key === ty.key));
});

test('protocol 9: world bosses — data per boss, rise with an omen, fall or leave, timers of hours, fast-forward', () => {
  assert.equal(WORLD_BOSSES.length, 4);
  for (const b of WORLD_BOSSES) {
    assert.ok(CONTINENTS[b.area] && sim.MOBS[b.base], b.id);
    assert.ok(b.every[0] >= 2 && b.every[1] > b.every[0] && b.stay > 0, `${b.id} rises every ${b.every} h`);
    assert.ok(b.loot.uniques.length && b.loot.uniques.every(u => sim.uniqueById(u)), `${b.id}'s uniques exist`);
  }
  const t = { now: T0 };
  const w = world('ember-isle', t);
  w.keeper({ id: 'a', x: 0, y: 0, level: 20 });
  // Its first clock: somewhere inside its first span.
  w.idle(1.1);
  const first = w.bossClock('old-greymaw');
  assert.ok(first.next > T0 && first.next <= T0 + 5 * H);
  // Due now: it rises (in its regions, far from town), the world hears the omen.
  assert.equal(w.fxBossNow('old-greymaw'), true);
  w.idle(1.1);
  const up = w.bossesUp();
  assert.equal(up.length, 1);
  assert.ok(w.world.regionAt(Math.floor(up[0].x / 16), Math.floor((up[0].y - 1) / 16)) === 'F' || w.world.regionAt(Math.floor(up[0].x / 16), Math.floor((up[0].y - 1) / 16)) === 'f');
  assert.deepEqual(w.flushOmens().map(o => [o.boss, o.at]), [['old-greymaw', 'rise']]);
  const boss = w.mobs.mobs.find(m => m.key === 'wb:old-greymaw');
  assert.equal(boss.elite?.name, 'Old Greymaw');
  assert.ok(boss.def.hp > sim.MOBS['ash-wolf'].hp * 20, 'a world boss, not a wolf');
  // Felled: its fall is heard, its loot is its own (more rolls; at its chance one of its uniques), the next is hours off.
  w.keeper({ id: 'a', x: boss.x, y: boss.y, level: 20 });
  fell(w, boss);
  w.idle(1.1);
  assert.deepEqual(w.flushOmens().map(o => o.at), ['fall']);
  const loot = w.groundList().filter(g => g.item);
  assert.ok(loot.length >= 1, 'it left gear');
  const next = w.bossClock('old-greymaw').next;
  assert.ok(next >= t.now + 3 * H - 2000 && next <= t.now + 5 * H + 2000, 'hours until the next');
  // Its loot table: over many kills its uniques do drop, at about its chance.
  const roll = sim.WORLD_BOSSES[0];
  let found = 0;
  for (let i = 0; i < 200; i++) if (w['rollLoot']({ creature: 'ash-wolf', level: 12, rank: 'unique', killKey: `td:surface:wb:old-greymaw:${i}` }).some(d => roll.loot.uniques.includes(d.definitionId))) found++;
  assert.ok(found > 200 * roll.loot.chance * .6 && found < 200 * roll.loot.chance * 1.4, `uniques ${found}/200`);
  // Left unfound past its stay: it goes, with its pack, and says so.
  w.fxBossNow('old-greymaw'); w.idle(1.1); w.flushOmens();
  t.now += roll.stay * H + 1000;
  w.idle(1.1);
  assert.deepEqual(w.flushOmens().map(o => o.at), ['gone']);
  assert.equal(w.bossesUp().length, 0);
  // Fast-forward: a rising it slept through came and went; one due within its stay is due now.
  const r = () => .5;
  const slept = fastForward(roll, { next: T0 }, T0 + 30 * H, r);
  assert.ok(slept.next > T0 + 30 * H - roll.stay * H && !slept.up);
  assert.deepEqual(fastForward(roll, { next: T0 }, T0 + H, r), { next: T0 });
  const stillUp = { next: T0, up: { until: T0 + 2 * H, x: 1, y: 2 } };
  assert.deepEqual(fastForward(roll, stillUp, T0 + H, r), stillUp);
  // Persisted: a woken island knows its clocks.
  const doc = JSON.parse(JSON.stringify(w.save()));
  assert.ok(doc.wb.some(([id]) => id === 'old-greymaw'));
  const woke = world('ember-isle', t, 'other');
  woke.load(doc);
  assert.equal(woke.bossClock('old-greymaw').next, w.bossClock('old-greymaw').next);
});

test('protocol 9: hot spots and lairs stay within the sims — a lair of five at the room\'s rest feeds the sims\' 240 kills an hour', () => {
  const restMean = (RESPAWN_RULES.normal[0] + RESPAWN_RULES.normal[1]) / 2;
  // combat-sim's hunt: a ~3 s kill then TRAVEL s to the next pull → its kills an hour.
  const simKph = 3600 / (3 + TRAVEL);
  for (const [id, def] of Object.entries(CONTINENTS)) for (const h of def.hotspots ?? []) {
    assert.ok(h.count <= 5, `${id} ${h.region}`);
    assert.ok(h.count * 3600 / restMean <= simKph + 1e-9, `${id} ${h.region}: ${h.count} at ${restMean} s sustains ${h.count * 3600 / restMean} > ${simKph}`);
    assert.ok(h.types.every(t => sim.MOBS[t]));
  }
  for (const [id, def] of Object.entries(LEVELS)) if (def.lair) {
    assert.ok(def.lair.count <= 5 && def.lair.types.every(t => sim.MOBS[t] && sim.MOBS[t].rank !== 'boss'), id);
  }
});

// ── The room (HTTP) ──
async function room(t, { store = memoryStore() } = {}) {
  let time = T0;
  const r = createSocialServer({ publishMs: 5, now: () => time, store, world: { sim, seed: 'room3', fx: true, timing: { tickMs: 0, sleepMs: 1000 } } });
  await new Promise(resolve => r.server.listen(0, '127.0.0.1', resolve));
  t.after(() => r.dispose());
  const base = `http://127.0.0.1:${r.server.address().port}`;
  const post = async (path, body, token) => {
    const res = await fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const join = async (name, protocol = 9) => (await post('/join', { name, party: true, coop: true, trade: true, world: true, protocol })).body;
  const move = (k, x, y, area) => post('/update', { x, y, facing: 1, animation: 'idle', zone: area, area, level: 20 }, k.token);
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
    return { seen, all, until, abort };
  };
  const step = async (n = 1, ms = 50) => { for (let i = 0; i < n; i++) { time += ms; r.worldStep(ms); } await new Promise(res => setTimeout(res, 15)); };
  return { r, post, join, move, stream, step, clock: { get: () => time } };
}

test('protocol 9: kill on a floor, leave, return — still dead; another Keeper sees the same; a protocol-8 client keeps its own', async t => {
  const { r, join, move, stream, step } = await room(t);
  const a = await join('Aster'), b = await join('Bryn'), old = await join('Oskar', 8);
  const probe = world(FLOOR), at = floorSpot(probe);
  await move(a, at.x, at.y, FLOOR); await move(b, at.x + 10, at.y, FLOOR); await move(old, at.x, at.y + 10, FLOOR);
  const sa = await stream(a), sb = await stream(b), so = await stream(old);
  await step(2); await new Promise(res => setTimeout(res, 30)); await step(4);
  // Every area woke (the world is awake), and the floor is the room's for both protocol-9 Keepers.
  assert.equal(r.rooms.rooms.size, WORLD_AREAS_ALL.length);
  for (const s of [sa, sb]) assert.ok(await s.until(() => s.all('coop').find(e => e.areas[FLOOR]?.host === '@room' && e.areas[FLOOR].members.length === 2)), 'hosted by the room');
  assert.equal(so.all('coop').some(e => e.areas[FLOOR]?.host === '@room'), false, 'a protocol-8 client is never hosted on a floor');
  const w = r.rooms.worldOf(FLOOR);
  const m = w.mobs.mobs.find(x => x.def.rank !== 'boss' && !x.elite);
  const key = m.key;
  fell(w, m, a.id);
  await step(4);
  for (const s of [sa, sb]) assert.ok(await s.until(() => s.all('coop-snap').flatMap(e => e.ev).find(e => e.k === 'kill' && e.key === key)), 'both saw it fall');
  // Aster climbs out to the surface for half a minute; the floor runs on dormant (Bryn leaves too).
  await move(a, 300, 300, 'infernal-reach'); await move(b, 300, 300, 'infernal-reach');
  await step(1);
  for (let i = 0; i < 30; i++) await step(1, 1000);
  assert.ok(r.rooms.worldOf(FLOOR), 'the floor stayed loaded');
  assert.ok(w.restingNow().some(([k]) => k === key), 'still dead after 30 s');
  // Back down, both: it is still not there, for either.
  await move(a, at.x, at.y, FLOOR); await move(b, at.x + 10, at.y, FLOOR);
  const n = sa.all('coop-snap').length;
  await step(6);
  await sa.until(() => sa.all('coop-snap').length > n + 2);
  assert.equal(w.mobs.mobs.some(x => x.key === key), false);
  for (const s of [sa, sb]) assert.equal(s.all('coop-snap').slice(-2).some(e => e.mobs.some(x => x.k === key)), false);
  // After its time (≤ 90 s from the fall) it is back, for both.
  for (let i = 0; i < 70; i++) await step(1, 1000);
  await step(4);
  assert.ok(w.mobs.mobs.some(x => x.key === key), 'risen');
  const health = await (await fetch(`http://127.0.0.1:${r.server.address().port}/health`)).json();
  assert.equal(health.protocol, 9);
  assert.equal(health.world.loaded, WORLD_AREAS_ALL.length);
});

test('protocol 9: a world boss\'s omen reaches every protocol-9 Keeper anywhere in the world, never an older client', async t => {
  const { r, join, move, stream, step } = await room(t);
  const a = await join('Aster'), far = await join('Fen'), old = await join('Oskar', 8);
  await move(a, 160, 610, 'ember-isle'); await move(far, 0, 0, 'umbral-marches'); await move(old, 160, 610, 'ember-isle');
  const sa = await stream(a), sf = await stream(far), so = await stream(old);
  await step(2); await new Promise(res => setTimeout(res, 30)); await step(2);
  r.rooms.worldOf('ember-isle').fxBossNow('old-greymaw');
  for (let i = 0; i < 3; i++) await step(1, 1000);
  for (const s of [sa, sf]) assert.ok(await s.until(() => s.all('world-omen').find(o => o.boss === 'old-greymaw' && o.at === 'rise')), 'heard the omen');
  assert.equal(so.all('world-omen').length, 0);
});

test('protocol 9: every area loaded with Keepers spread over them stays well inside one vCPU and 512 MiB', async () => {
  const t = { now: T0 };
  const heap0 = process.memoryUsage().heapUsed;
  const all = WORLD_AREAS_ALL.map(a => world(a, t, `cpu|${a}`));
  // 12 Keepers: three on each continent's surface (walking), the rest on floors with creatures; every other area dormant.
  const busy = [];
  for (const w of all) {
    if (w.surface) for (let i = 0; i < 3; i++) busy.push({ w, id: `${w.area}-${i}`, x: (i - 1) * 400, y: 600 + i * 200 });
  }
  for (const w of all.filter(x => !x.surface && x.level.spawnsIn().length).slice(0, 8)) { const s = w.level.spawnsIn()[0]; busy.push({ w, id: `${w.area}-k`, x: s.x + 8, y: s.y }); }
  const live = new Set(busy.map(k => k.w));
  // Warm up 10 s, then measure 60 s of the room's own loop: 20 ticks a second where Keepers are, 1 idle a second elsewhere.
  const run = secs => {
    let ms = 0, steps = 0, max = 0;
    for (let i = 0; i < secs * 20; i++) {
      t.now += 50;
      const t0 = performance.now();
      for (const k of busy) { k.x += Math.sin(i / 40 + k.y) * 2; k.w.keeper({ id: k.id, x: k.x, y: k.y, level: 25 }); }
      for (const w of all) {
        if (live.has(w)) { w.tick(.05); if (i % 3 === 0) for (const k of busy) if (k.w === w) w.snapFor(k.id); }
        else if (i % 20 === 0) w.idle(1);
      }
      const d = performance.now() - t0;
      ms += d; steps++; max = Math.max(max, d);
    }
    return { avg: ms / steps, max };
  };
  run(10);
  const { avg, max } = run(60);
  const heapMB = (process.memoryUsage().heapUsed - heap0) / 1048576, rssMB = process.memoryUsage().rss / 1048576;
  const creatures = all.reduce((n, w) => n + w.mobs.mobs.length, 0);
  console.log(`# all ${all.length} areas, ${busy.length} Keepers, ${creatures} creatures: step avg ${avg.toFixed(2)} ms (max ${max.toFixed(1)}) of a 50 ms tick = ${(avg / 50 * 100).toFixed(1)}% of one vCPU; heap +${heapMB.toFixed(0)} MB, rss ${rssMB.toFixed(0)} MB`);
  assert.ok(avg < 10, `a step costs ${avg.toFixed(2)} ms (≤ 20% of a vCPU)`);
  // (rss here carries the TypeScript compiler the test loads the world with; the image runs the bundle, measured in the
  // M3 handoff, docs/handoff/room-world.md.)
  assert.ok(heapMB < 150, `the world's heap +${heapMB.toFixed(0)} MB`);
});

test('weather v1: the room owns the sky\'s roll — a Keeper hears the window and every land\'s roll from the room\'s clock, and again when the window turns', async t => {
  const { r, join, move, stream, step, clock } = await room(t);
  const a = await join('Aster'), b = await join('Bryn'), old = await join('Oskar', 8);
  await move(a, 300, 300, 'ember-isle'); await move(b, 340, 300, 'ember-isle'); await move(old, 300, 340, 'ember-isle');
  const sa = await stream(a), sb = await stream(b), so = await stream(old);
  await step(2);
  const first = await sa.until(() => sa.all('world-weather')[0]);
  assert.ok(first, 'the room told the Keeper the sky');
  assert.equal(first.window, sim.weatherWindow(clock.get()));
  assert.deepEqual(first.lands, sim.weatherRolls(first.window), 'the rolls are the shared model\'s, from the room\'s clock');
  assert.deepEqual((await sb.until(() => sb.all('world-weather')[0])).lands, first.lands, 'one sky for both');
  assert.equal(so.all('world-weather').length, 0, 'a protocol-8 client keeps its own clock');
  // The window turns: everyone hears the new roll once.
  const left = (first.window + 1) * sim.WEATHER_WINDOW_MS - clock.get();
  await step(1, left + 10);
  const next = await sa.until(() => sa.all('world-weather').find(e => e.window === first.window + 1));
  assert.ok(next, 'the next window was sent');
  assert.equal(sa.all('world-weather').filter(e => e.window === first.window + 1).length, 1);
  assert.deepEqual(r.rooms.weatherNow().lands, sim.weatherRolls(first.window + 1));
});
