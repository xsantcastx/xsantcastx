// S10b: the Last Siege and the Fogmother in the room (docs/design/monsters-abilities.md §6.2, §6.4; campaign.md S10).
// The Last Siege rolls out of the Siege Trench on an ashfall night and up its track toward the Bastion (reaching it, it
// leaves unfelled); the Fogmother gathers a minute on a foggy night on the Black Meres and stands, unless a Keeper has
// lit her three lantern posts first (then she keeps down until dawn); her lit posts cut her damage in her last phase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './world-sim-build.mjs';

const sim = load();
const { RoomWorld, KeeperLife, WORLD_BOSSES, weatherAt, WEATHER_WINDOW_MS, PARTY_FORMS, MECH, newPartyState, partyStep, lightPosts, outOfLight, partyBite } = sim;
const SIEGE = WORLD_BOSSES.find(b => b.id === 'last-siege');
const FOG = WORLD_BOSSES.find(b => b.id === 'fogmother');
const T = 16;
const clockOf = () => { const t = { now: 0 }; return { t, w: new RoomWorld({ area: 'umbral-marches-meres', seed: 'clock', now: () => t.now, boot: 'c' }) }; };
const probe = clockOf();
const isNight = ms => { probe.t.now = ms; return probe.w.sky() === 'night'; };
/** The first window after `from` whose weather is `state` over `land`/`region`, `night` or not, `into` ms into it. */
function windowOf(land, region, state, night, from, into = 30000) {
  for (let w = Math.floor(from / WEATHER_WINDOW_MS); w < Math.floor(from / WEATHER_WINDOW_MS) + 40000; w++) {
    const ms = w * WEATHER_WINDOW_MS + into, end = (w + 1) * WEATHER_WINDOW_MS - 1000;
    if (weatherAt({ land, region, ms }).state === state && isNight(ms) === night && isNight(ms + 75000) === night && weatherAt({ land, region, ms: end }).state === state) return ms;
  }
  throw new Error(`no ${state} ${night ? 'night' : 'day'}`);
}
const T0 = 1_800_000_000_000;
const tick = (w, n, d = .1) => { for (let i = 0; i < n; i++) w.tick(d); };

test('S10b: the Last Siege rolls out of the Siege Trench on an ashfall night, and only then', () => {
  assert.ok(SIEGE && SIEGE.weather.state === 'ashfall' && SIEGE.night && SIEGE.form === 'last-siege' && PARTY_FORMS['last-siege']);
  const start = { x: SIEGE.track[0].c * T + 8, y: SIEGE.track[0].r * T + T };
  // An ashfall by day: nothing.
  const day = { now: windowOf('infernal-reach', 'h', 'ashfall', false, T0) };
  const wd = new RoomWorld({ area: SIEGE.area, seed: 's10b', now: () => day.now, boot: 'd' });
  wd.keeper({ id: 'a', x: start.x - 40, y: start.y, level: 32 });
  tick(wd, 30);
  assert.ok(!wd.mobs.mobs.some(m => m.key === 'wb:last-siege'), 'not by day');
  // An ashfall night: it stands at the trench with its track, its omen, its form and its own body.
  const t = { now: windowOf('infernal-reach', 'h', 'ashfall', true, T0) };
  const w = new RoomWorld({ area: SIEGE.area, seed: 's10b', now: () => t.now, boot: 'n' });
  w.keeper({ id: 'a', x: start.x - 40, y: start.y, level: 32 });
  w.keeper({ id: 'b', x: start.x - 60, y: start.y + 30, level: 32 });
  tick(w, 30);
  const m = w.mobs.mobs.find(x => x.key === 'wb:last-siege');
  assert.ok(m, 'it stands');
  assert.equal(m.def.rank, 'boss');
  assert.equal(m.def.sheet, 'last-siege', 'its own body, the siege tower');
  assert.ok(m.track && m.track.pts.length === SIEGE.track.length, 'on its track');
  assert.ok(w.flushOmens().some(o => o.boss === 'last-siege' && o.at === 'rise'));
  // It rolls toward the next point of its track, a tile every few seconds, and never chases a Keeper.
  const x0 = m.x, y0 = m.y, to = m.track.pts[1];
  tick(w, 80);
  const d0 = Math.hypot(to.x - x0, to.y - y0), d1 = Math.hypot(to.x - m.x, to.y - m.y);
  assert.ok(d1 < d0 - T * 1.2 && d1 > d0 - T * 3.5, `rolled ${(d0 - d1) / T} tiles in 8 s`);
  // Its form wakes with the first blow (Fixate's pip goes out to a client that draws marks).
  w.mobs.applyClaim(m, 2000, 'a', false, 'fire');
  tick(w, 5);
  assert.ok(m.pb && m.pb.form.id === 'last-siege');
  assert.ok(w.snapFor('a', true).ev.some(e => e.k === 'mech' && e.m === 'fix'));
});

test('S10b: at the Bastion the Last Siege salutes and leaves unfelled, and not again in that window', () => {
  const t = { now: windowOf('infernal-reach', 'h', 'ashfall', true, T0 + 7 * 86400000) };
  const w = new RoomWorld({ area: SIEGE.area, seed: 's10b', now: () => t.now, boot: 'h' });
  const start = { x: SIEGE.track[0].c * T + 8, y: SIEGE.track[0].r * T + T };
  w.keeper({ id: 'a', x: start.x - 40, y: start.y, level: 32 });
  tick(w, 20);
  const m = w.mobs.mobs.find(x => x.key === 'wb:last-siege');
  assert.ok(m);
  w.flushOmens();
  // Put it a step from the end of its road.
  const end = m.track.pts[m.track.pts.length - 1];
  m.track.i = m.track.pts.length - 1; m.x = end.x + 4; m.y = end.y;
  tick(w, 20);
  assert.ok(!w.mobs.mobs.includes(m), 'it is gone');
  assert.ok(w.flushOmens().some(o => o.at === 'home'), 'the garrison salutes');
  tick(w, 30);
  assert.ok(!w.mobs.mobs.some(x => x.key === 'wb:last-siege'), 'not again in this window');
});

test('S10b: the Fogmother gathers a minute on a foggy night; three lit posts keep her down until dawn', () => {
  assert.ok(FOG && FOG.weather.state === 'fog' && FOG.night && FOG.posts.length === 3 && PARTY_FORMS.fogmother.posts);
  const at = { x: FOG.at.c * T + 8, y: FOG.at.r * T + T };
  const posts = FOG.posts.map(p => ({ x: p.c * T + 8, y: p.r * T + T }));
  // A foggy night: she stands after the gather minute, at the pool, with her posts dark.
  const t = { now: windowOf('umbral-marches', 'k', 'fog', true, T0, 5000) };
  const w = new RoomWorld({ area: 'umbral-marches-meres', seed: 's10b', now: () => t.now, boot: 'f' });
  w.keeper({ id: 'a', x: at.x - 60, y: at.y + 40, level: 54 });
  tick(w, 20);
  assert.ok(!w.mobs.mobs.some(m => m.key === 'wb:fogmother'), 'she gathers first');
  t.now += 61000;
  tick(w, 20);
  const m = w.mobs.mobs.find(x => x.key === 'wb:fogmother');
  assert.ok(m, 'she stands');
  assert.equal(m.def.sheet, 'fogmother');
  assert.equal(m.posts.length, 3);
  assert.ok(Math.hypot(m.x - at.x, m.y - at.y) < 120, 'in the pool');
  // Another foggy night: a Keeper lights all three within the minute — she does not rise; the room says so.
  const t2 = { now: windowOf('umbral-marches', 'k', 'fog', true, T0 + 9 * 86400000, 5000) };
  const w2 = new RoomWorld({ area: 'umbral-marches-meres', seed: 's10b', now: () => t2.now, boot: 'g' });
  w2.keeper({ id: 'a', x: posts[0].x, y: posts[0].y + 6, level: 54 });
  for (const p of posts) { w2.keeper({ id: 'a', x: p.x, y: p.y + 6, level: 54 }); t2.now += 4000; tick(w2, 40); }
  assert.ok(w2.flushOmens().some(o => o.boss === 'fogmother' && o.at === 'kept'), 'the posts burn again');
  t2.now += 70000;
  tick(w2, 20);
  assert.ok(!w2.mobs.mobs.some(x => x.key === 'wb:fogmother'), 'she keeps down');
});

test('S10b: the posts — lit by standing at one 3 s, a light she will not stand in, and a quarter off her blows at the last', () => {
  const ps = [{ x: 0, y: 0, lit: false, hold: 0 }, { x: 200, y: 0, lit: false, hold: 0 }, { x: 0, y: 200, lit: false, hold: 0 }];
  assert.deepEqual(lightPosts(ps, [{ x: 4, y: 4 }], 2), []);
  assert.deepEqual(lightPosts(ps, [{ x: 4, y: 4 }], 1.1), [0]);
  assert.ok(ps[0].lit && !ps[1].lit);
  const out = outOfLight(ps, 10, 0);
  assert.ok(out && Math.hypot(out.x, out.y) >= MECH.postR * T - .01, 'pushed to its light\'s edge');
  assert.equal(outOfLight(ps, 210, 0), null, 'a dark post is no light');
  // Her last phase with all three lit: what she deals is cut by the form's share.
  const s = newPartyState(PARTY_FORMS.fogmother);
  s.posts = ps.map(p => ({ ...p, lit: true }));
  const marks = [], hits = [];
  const A = { keepers: () => [{ id: 'tank', self: false, x: 30, y: 0 }], strike: (k, n) => hits.push(n), ring: () => {}, mark: e => marks.push(e), say: () => {}, adds: () => {}, heal: () => {}, stopped: () => false, rng: () => .5, cadence: 1 };
  const boss = { x: 0, y: 0, hp: 200, def: { hp: 1000, dmg: [100, 100], level: 54 } };
  partyStep(s, boss, A, .1, 'tank');
  assert.equal(s.phase, 2);
  assert.equal(s.cut, 1 - PARTY_FORMS.fogmother.posts.cut);
  assert.ok(marks.some(e => e.m === 'post'), 'the lit posts are shown');
  assert.equal(Math.round(partyBite(s, 'tank', 100, 100)), 75);
});

test('S10b: the Wall\'s guard and the Psalm\'s lift are legal ally claims; a healer\'s own Cleanse reaches the room', () => {
  const lives = new Map(['a', 'b'].map(id => [id, new KeeperLife({ max: 1000, defense: 0, resists: {}, level: 54 }, 1000)]));
  const t = { now: T0 }, w = new RoomWorld({ area: 'umbral-marches-meres', seed: 'ally', now: () => t.now, boot: 'a', life: id => lives.get(id) ?? null });
  w.keeper({ id: 'a', x: 100, y: 100, level: 54 });
  w.keeper({ id: 'b', x: 120, y: 100, level: 54 });
  const [aura] = w.allies('a', [{ k: 'aura', s: 'unique-wall-that-kept-walking', n: 15, r: 30, t: 20 }]);
  assert.equal(aura, 1);
  const [lift] = w.allies('a', [{ k: 'cleanse', s: 'unique-psalm-heard-through-water', to: 'b', n: 1, t: 40, f: 4 }]);
  assert.equal(lift, 1);
  const [own] = w.allies('a', [{ k: 'cleanse', s: 'cleanse', n: 1, t: 10 }]);
  assert.equal(own, 1, 'her own Cleanse');
  const [over] = w.allies('a', [{ k: 'aura', s: 'unique-wall-that-kept-walking', n: 40, r: 30, t: 20 }]);
  assert.notEqual(over, 1, 'never past its 15%');
});
