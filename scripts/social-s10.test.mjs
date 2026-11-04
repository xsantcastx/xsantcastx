// S10: the party bosses in the room (docs/design/monsters-abilities.md §5, §6.3; campaign.md S10). The Antlered Storm
// rises at the Storm-Struck Oak while a thunderstorm holds over the Greenwood, runs its party form in the room (threat,
// Fixate, the rings and marks every screen draws), leaves with the weather unfelled, and once felled stays down for
// its cooldown; the marks go only to a client that says it draws them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './world-sim-build.mjs';

const sim = load();
const { RoomWorld, WORLD_BOSSES, weatherAt, WEATHER_WINDOW_MS, PARTY_FORMS, MECH, partyBite, newPartyState, partyCleanse } = sim;
const STORM = WORLD_BOSSES.find(b => b.id === 'antlered-storm');
const H = 3600000;
const sky = ms => weatherAt({ land: 'verdant-wilds', region: 'j', ms }).state;
/** The first Greenwood thunderstorm after `from`, a minute into its window. */
function storm(from) {
  for (let w = Math.floor(from / WEATHER_WINDOW_MS); w < Math.floor(from / WEATHER_WINDOW_MS) + 20000; w++) {
    const ms = w * WEATHER_WINDOW_MS + 60000;
    if (sky(ms) === 'storm') return ms;
  }
  throw new Error('no storm');
}
const T0 = storm(1_800_000_000_000);
const oak = { x: STORM.at.c * 16 + 8, y: (STORM.at.r + 2) * 16 + 16 };
const world = t => new RoomWorld({ area: 'verdant-wilds', seed: 's10', now: () => t.now, boot: 'b10' });
const up = w => w.mobs.mobs.find(m => m.key === 'wb:antlered-storm');

test('S10: the Antlered Storm rises at the Oak in a Greenwood thunderstorm, with its omen and its party form', () => {
  assert.ok(STORM && STORM.weather.state === 'storm' && STORM.form === 'antlered-storm' && PARTY_FORMS['antlered-storm']);
  const t = { now: T0 }, w = world(t);
  w.keeper({ id: 'a', x: oak.x - 40, y: oak.y, level: 42 });
  w.keeper({ id: 'b', x: oak.x - 80, y: oak.y + 30, level: 42 });
  for (let i = 0; i < 30; i++) w.tick(.1);
  const m = up(w);
  assert.ok(m, 'it stands');
  assert.ok(Math.hypot(m.x - oak.x, m.y - oak.y) < 48, 'at the Oak');
  assert.equal(m.def.rank, 'boss');
  assert.equal(m.elite?.name, 'The Antlered Storm');
  assert.ok(w.flushOmens().some(o => o.boss === 'antlered-storm' && o.at === 'rise'));
  // Two Keepers near: +60% life (the party rule), and its form wakes with the first blow.
  assert.ok(m.def.hp > m.coopBase * 1.5);
  w.mobs.applyClaim(m, 500, 'a', false, 'fire');
  for (let i = 0; i < 5; i++) w.tick(.1);
  assert.ok(m.pb, 'the party form is awake');
  assert.equal(m.pb.phase, 0);
  // Its marks go only to a client that draws them (an older one would read a mark as a kill).
  const marked = w.snapFor('a', true).ev.filter(e => e.k === 'mech');
  assert.ok(marked.some(e => e.m === 'fix'), 'the fixate pip goes out');
  w.mobs.applyClaim(m, 10, 'a', false, 'fire'); w.tick(.1);
  assert.ok(!w.snapFor('b', false).ev.some(e => e.k === 'mech'));
});

test('S10: it leaves with the weather unfelled; felled, it stays down its cooldown, whoever felled it', () => {
  const t = { now: T0 }, w = world(t);
  w.keeper({ id: 'a', x: oak.x - 40, y: oak.y, level: 42 });
  for (let i = 0; i < 20; i++) w.tick(.1);
  assert.ok(up(w));
  w.flushOmens();
  // The storm passes (the next window that is not a storm): it goes, no kill.
  let after = T0;
  while (sky(after) === 'storm') after += WEATHER_WINDOW_MS;
  t.now = after;
  for (let i = 0; i < 15; i++) w.tick(.1);
  assert.ok(!up(w), 'gone with the weather');
  assert.ok(w.flushOmens().some(o => o.at === 'gone'));
  // The next storm: it rises; felled, the next storm inside two hours finds nothing.
  t.now = storm(after);
  for (let i = 0; i < 15; i++) w.tick(.1);
  const m = up(w);
  assert.ok(m);
  w.mobs.applyClaim(m, 1e9, 'a'); w.tick(.05); for (let i = 0; i < 15; i++) w.tick(.1);
  assert.ok(w.flushOmens().some(o => o.at === 'fall'));
  const clock = w.bossClock('antlered-storm');
  assert.ok(clock.next >= t.now + STORM.cooldown * H - 2000, 'its cooldown runs');
  t.now = storm(t.now + WEATHER_WINDOW_MS);
  for (let i = 0; i < 15; i++) w.tick(.1);
  if (t.now < clock.next) assert.ok(!up(w), 'down for its cooldown');
});

test('S10: the vocabulary — Fixate\'s heavy every 4th bite, Sunder to ×2 at five, a Cleanse lifts a Brand', () => {
  const s = newPartyState(PARTY_FORMS['anvil-warden']);
  s.phase = 0; s.fixOn = 'tank';
  const B = 100, bites = [];
  for (let i = 0; i < 8; i++) bites.push(Math.round(partyBite(s, 'tank', B, B)));
  // The 4th and 8th are heavies (2.5B, then Sunder on top); the 6th has five stacks: doubled, the stacks fall.
  assert.ok(bites[3] >= MECH.heavyB * B, `heavy ${bites}`);
  assert.equal(bites[5], 2 * B, `sundered ${bites}`);
  assert.ok(bites[6] === B, `stacks fell ${bites}`);
  s.dots.push({ id: 'heal', t: 8, dps: 30, type: 'fire', brand: true, tick: 1 });
  assert.equal(partyCleanse(s, 'heal'), true);
  assert.equal(s.dots.length, 0);
});
