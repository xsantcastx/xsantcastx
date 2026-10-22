/**
 * td-sight.spec.ts — line of sight and the crowd (td-sight.ts; owner 2026-10-21: "I was hitting the boss behind the
 * walls… also the warlock skeletons all are like 1 on top of another").
 *
 * The arena: open floor with one wall, a column of solid tiles at c = 10 (or none, for the control). The Keeper stands
 * west of it, the creature east, well inside the staff's reach.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, groundY, type Minion, type Mob, type MobHost } from './td-mobs';
import { ELBOW, TdSight, clearLine, fanSpot, formationSpot, separate, type Body } from './td-sight';
import { TILE } from './td-art';

const WALL = 10;
const at = (c: number, r = 5) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE - 2 });

function arena(wall = true, keeper = at(7)): { sys: MobSystem; hurt: number[]; keeper: { x: number; y: number } } {
  const hurt: number[] = [];
  const host: MobHost = {
    options: {} as EngineOptions,
    walkable: c => !wall || c !== WALL,
    levelId: () => 'sight',
    player: () => keeper,
    hurtPlayer: n => hurt.push(n),
    healPlayer: () => undefined,
    swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return { sys, hurt, keeper };
}
const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) sys.update(dt); };
/** A creature that stands (no sight, no stroll), sturdy enough to count every point it loses. */
const still = (sys: MobSystem, type: string, x: number, y: number, hp = 2000): Mob => {
  const m = sys.place(`${type}@${x}`, { ...MOBS[type], hp, sight: 0 }, x, y);
  m.wait = 1e9;
  return m;
};

describe('td-sight: the ray', () => {
  const wall = (c: number) => c === WALL;
  it('is clear on open ground and stopped by a solid tile between', () => {
    expect(clearLine(() => false, 0, 0, 20, 7)).toBeTrue();
    expect(clearLine((c) => wall(c), 7, 5, 13, 5)).toBeFalse();
    expect(clearLine((c) => wall(c), 7, 5, 9, 9)).toBeTrue();
  });
  it('never counts its own ends (a creature does not hide itself)', () => {
    expect(clearLine((c) => c === 3 || c === 9, 3, 0, 9, 0)).toBeTrue();
  });
  it('sees through a diagonal gap, not through a corner shut on both sides', () => {
    expect(clearLine((c, r) => c === 1 && r === 0, 0, 0, 2, 2)).toBeTrue();
    expect(clearLine((c, r) => (c === 1 && r === 0) || (c === 0 && r === 1), 0, 0, 2, 2)).toBeFalse();
  });
  it('is the same both ways, and a ray is walked once per look (the cache)', () => {
    let asks = 0;
    const s = new TdSight((c) => { asks++; return c === WALL; });
    const a = at(7), b = at(13, 8);
    expect(s.sees(a.x, a.y, b.x, b.y)).toBe(s.sees(b.x, b.y, a.x, a.y));
    expect(s.castTotal).toBe(1);
    const before = asks;
    for (let i = 0; i < 50; i++) s.sees(a.x, a.y, b.x, b.y);
    expect(asks).toBe(before);
    s.tick(1, 'sight');
    s.sees(a.x, a.y, b.x, b.y);
    expect(s.castTotal).toBe(2);
  });
  it('keeps its frame budget for the creatures: past it an unknown ray answers what it is told', () => {
    const s = new TdSight(() => false);
    for (let i = 0; i < 500; i++) s.sees(0, 14, (i + 3) * TILE, 14, false);
    expect(s.cast).toBeLessThanOrEqual(400);
  });
});

describe('td-sight: the Keeper\'s blows', () => {
  it('a bolt thrown at a creature behind a wall breaks on it and deals 0', () => {
    const { sys, keeper } = arena();
    const m = still(sys, 'ash-wolf', at(13).x, at(13).y);
    sys.bolts.push({ x: keeper.x, y: keeper.y - 22, to: m, dmg: 40, age: 0, lift: 22 });
    run(sys, 1.5);
    expect(m.hp).toBe(2000);
    expect(sys.walled).toBe(1);
    expect(sys.bolts.length).toBe(0);
    expect(sys.effects.some(e => e.kind === 'puff') || sys.walled > 0).toBeTrue();
  });
  it('the same bolt with no wall lands', () => {
    const { sys, keeper } = arena(false);
    const m = still(sys, 'ash-wolf', at(13).x, at(13).y);
    sys.bolts.push({ x: keeper.x, y: keeper.y - 22, to: m, dmg: 40, age: 0, lift: 22 });
    run(sys, 1.5);
    expect(m.hp).toBeLessThan(2000);
    expect(sys.walled).toBe(0);
  });
  it('no sight, no target: the attack key throws nothing, a targeted spell has no foe', () => {
    const { sys } = arena();
    const m = still(sys, 'ash-wolf', at(13).x, at(13).y);
    expect(sys.sees(m)).toBeFalse();
    sys.attacking = true;
    run(sys, 2);
    expect(sys.bolts.length).toBe(0);
    expect(m.hp).toBe(2000);
    sys.target = m;
    run(sys, 2);
    expect(m.hp).toBe(2000);
    for (const id of ['bone-spear', 'drain-life', 'ember-curse', 'cinder-rain', 'meteor'] as const) {
      sys.cooldowns[id] = 0; sys.mana = sys.maxMana;
      expect(sys.useAbility(id)).withContext(id).toBe('nofoe');
    }
  });
  it('with sight the attack key finds it and the bolts land (the control)', () => {
    const { sys } = arena(false);
    const m = still(sys, 'ash-wolf', at(13).x, at(13).y);
    sys.attacking = true;
    run(sys, 2);
    expect(m.hp).toBeLessThan(2000);
  });
  it('a Hellfire Nova by a wall does not burn the room behind it', () => {
    for (const wall of [true, false]) {
      const { sys } = arena(wall, at(8));
      const near = still(sys, 'ash-wolf', at(8, 7).x, at(8, 7).y), far = still(sys, 'ash-wolf', at(11).x, at(11).y);
      expect(sys.useAbility('hellfire-nova')).toBeNull();
      expect(near.hp).withContext('this side').toBeLessThan(2000);
      expect(far.hp < 2000).withContext(wall ? 'behind the wall' : 'no wall').toBe(!wall);
    }
  });
  it('a spear flies into the wall and stops there; a melee arc never reaches past it', () => {
    const { sys, keeper } = arena(true, at(9));
    const m = still(sys, 'ash-wolf', at(11).x, at(11).y);
    sys.spears.push({ x: keeper.x, y: keeper.y - 16, vx: 280, vy: 0, age: 0, life: 1, hit: [], lift: 16, land: m.def.h / 2, reach: 32 });
    run(sys, .6);
    expect(m.hp).toBe(2000);
    expect(sys.walled).toBeGreaterThan(0);
    sys.vocation = 'ashguard'; sys.target = m; sys.attacking = true;
    run(sys, 2);
    expect(sys.swings).toBe(0);
    expect(m.hp).toBe(2000);
  });
  it('the ground track of a lofted shot sinks from its hand to the foe\'s middle', () => {
    expect(groundY({ lift: 22, land: 6, reach: 100 }, 0, 0)).toBe(22);
    expect(groundY({ lift: 22, land: 6, reach: 100 }, 0, 50)).toBe(14);
    expect(groundY({ lift: 22, land: 6, reach: 100 }, 0, 400)).toBe(6);
    expect(groundY({}, 10, 0)).toBe(22);
  });
});

describe('td-sight: the creatures\' blows', () => {
  it('a creature behind a wall neither hunts nor hits the Keeper', () => {
    const { sys, hurt } = arena(true, at(9));
    const wolf = sys.place('wolf', MOBS['ash-wolf'], at(11).x, at(11).y);
    const archer = sys.place('archer', MOBS['bone-archer'], at(14).x, at(14).y);
    run(sys, 6);
    expect(hurt).toEqual([]);
    expect(wolf.saw).toBeFalse();
    expect(archer.saw).toBeFalse();
    expect(sys.shots.length).toBe(0);
  });
  it('the same creatures with no wall find him (the control)', () => {
    const { sys, hurt } = arena(false, at(9));
    sys.place('wolf', MOBS['ash-wolf'], at(11).x, at(11).y);
    run(sys, 6);
    expect(hurt.length).toBeGreaterThan(0);
  });
  it('a shot already flying breaks on a wall stepped behind', () => {
    const { sys, hurt, keeper } = arena(true, at(9));
    sys.shots.push({ x: at(13).x, y: at(13).y - 12, vx: -120, vy: 0, dmg: 10, age: 0, life: 2, kind: 'arrow', lift: 12, land: 12, reach: 64 });
    run(sys, 1);
    expect(hurt).toEqual([]);
    expect(sys.walled).toBe(1);
    expect(keeper.x).toBe(at(9).x);
  });
});

describe('td-sight: the crowd', () => {
  const minion = (id: number, x: number, y: number): Minion => ({ id, x, y, hp: 400, maxHp: 400, dmg: [1, 1], cd: 0, t: 0, face: 1, life: Infinity, hit: 0, target: null });
  const spread = (list: readonly { x: number; y: number }[]) => {
    let min = Infinity;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) min = Math.min(min, Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y));
    return min;
  };
  it('the formation\'s slots stand a body apart, and clear of the pet\'s spot behind him', () => {
    const k = { x: 500, y: 500 };
    const slots = Array.from({ length: 13 }, (_, i) => formationSpot(i, k, 1));
    expect(spread(slots)).toBeGreaterThanOrEqual(ELBOW - 1);
    const pet = { x: k.x - 15, y: k.y + 4 };
    for (const s of slots) expect(Math.hypot(s.x - pet.x, s.y - pet.y)).toBeGreaterThanOrEqual(ELBOW);
  });
  it('six skeletons laid on one pixel stand apart round the Keeper after a few seconds', () => {
    const { sys, keeper } = arena(false, at(20, 20));
    for (let i = 0; i < 6; i++) sys.minions.push(minion(i, keeper.x, keeper.y));
    run(sys, 3);
    expect(spread(sys.minions)).toBeGreaterThanOrEqual(12);
    for (const k of sys.minions) expect(Math.hypot(k.x - keeper.x, k.y - keeper.y)).toBeLessThan(80);
  });
  it('fighting one foe they fan out round it instead of biting from one spot', () => {
    const { sys, keeper } = arena(false, at(20, 20));
    const m = still(sys, 'ash-wolf', keeper.x + 60, keeper.y, 1e6);
    m.def = { ...m.def, dmg: [0, 0] };
    for (let i = 0; i < 4; i++) sys.minions.push(minion(i, keeper.x, keeper.y));
    run(sys, 4);
    expect(sys.minions.every(k => k.target === m)).toBeTrue();
    expect(spread(sys.minions)).toBeGreaterThanOrEqual(10);
    expect(m.hp).toBeLessThan(1e6);
  });
  it('never pushes one into a wall', () => {
    const solid = (x: number) => Math.floor(x / TILE) === WALL;
    const bodies: Body[] = Array.from({ length: 5 }, () => ({ x: WALL * TILE - 2, y: 50 }));
    for (let i = 0; i < 200; i++) separate(bodies, (x) => !solid(x), 2);
    for (const b of bodies) expect(solid(b.x)).toBeFalse();
    expect(spread(bodies)).toBeGreaterThan(ELBOW - 1);
  });
  it('a pack of creatures on one spot eases apart (light: a pack stays a pack)', () => {
    const { sys } = arena(false, at(40, 40));
    const ms = [0, 1, 2].map(i => still(sys, 'ash-wolf', at(20).x + i * .1, at(20).y));
    run(sys, 2);
    expect(spread(ms)).toBeGreaterThanOrEqual(8);
    expect(spread(ms)).toBeLessThan(40);
  });
  it('fanSpot puts n bodies on an arc round the foe, on the Keeper\'s side', () => {
    const foe = { x: 0, y: 0 }, from = { x: -100, y: 0 };
    const pts = [0, 1, 2].map(j => fanSpot(j, 3, foe, from, 22));
    for (const q of pts) expect(q.x).toBeLessThan(0);
    expect(spread(pts)).toBeGreaterThanOrEqual(15);
  });
});
