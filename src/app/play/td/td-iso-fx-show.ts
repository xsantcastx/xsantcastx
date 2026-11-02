/**
 * td-iso-fx-show.ts — the effects' photographs (webdriver only, e2e/td-iso-fx-shots.spec.ts; docs/handoff/iso-fx.md):
 * a fight laid round the Keeper with every kind of effect in flight, a boss mid-telegraph, and the dungeon dressing
 * stood round him. The engine freezes the fight (`__tdArt.freeze`) so each picture holds still; nothing here runs in play.
 */
import { MOBS, type MobSystem, type Mob } from './td-mobs';
import { TILE, altar, brazier, brokenStatue, cage, chains, cobweb, ladderUp, ruinWall, stairsDown, stairsUp } from './td-art';
import type { TdObject } from './seamworks-square';

interface At { x: number; y: number }

function foe(m: MobSystem, type: string, x: number, y: number): Mob | null {
  const def = MOBS[type];
  if (!def) return null;
  const f = m.place(`fx-iso:${type}:${m.mobs.length}`, { ...def, sight: 0 }, x, y);
  f.wait = 1e9;
  return f;
}

/** A fight round the Keeper at `p`: novas, bolts, shots, spears, rings, tells, hazards, sparks, an elite and a pack aura. */
export function layFight(m: MobSystem, p: At): number {
  const walker = foe(m, 'bone-walker', p.x + 64, p.y + 6);
  const hound = foe(m, 'lava-hound', p.x - 60, p.y + 34);
  const champ = foe(m, 'ash-wolf', p.x + 30, p.y - 54);
  if (hound) { hound.tell = .35; hound.abCast = 0; hound.aim = { x: p.x, y: p.y - 12 }; hound.face = 1; }
  if (champ) { champ.elite = { rank: 'champion', role: 'champion', affixes: ['cold-aura'], name: null }; }
  if (walker) walker.aura = 'might';
  const fx = (e: Parameters<MobSystem['effects']['push']>[0]) => m.effects.push(e);
  fx({ kind: 'wave', x: p.x, y: p.y, age: .24, life: .7, dir: 1, r: 44 });
  if (walker) {
    fx({ kind: 'impact', x: walker.x - 3, y: walker.y - walker.def.h / 2, age: .05, life: .14, dir: 2, c: '#ffb347' });
    fx({ kind: 'bolt-hit', x: walker.x + 2, y: walker.y - walker.def.h * .6, age: .08, life: .3, dir: 1 });
    m.bolts.push({ x: p.x + 30, y: p.y - 20, to: walker, dmg: 0, age: .1, lift: 22 });
  }
  if (hound) m.shots.push({ x: hound.x + 34, y: hound.y - 22, vx: 90, vy: -30, dmg: 0, age: .2, life: 9, kind: 'fire', lift: 12 });
  m.shots.push({ x: p.x + 20, y: p.y + 40, vx: -60, vy: -80, dmg: 0, age: .2, life: 9, kind: 'arrow', lift: 16 });
  m.spears.push({ x: p.x - 18, y: p.y - 40, vx: -40, vy: -120, age: .1, life: 9, hit: [], lift: 18 });
  for (let i = 0; i < 4; i++) fx({ kind: 'flame', x: p.x - 30 + i * 10, y: p.y + 60 - i * 4, age: .2 + i * .05, life: 1, dir: 1 });
  // A frost ring falling, an ink stain lasting, a fire burst on its way.
  m.bursts.push({ x: p.x + 70, y: p.y + 64, t: .3, r: 22, dmg: 0, delay: .7, tone: 'frost' });
  m.hazards.push({ x: p.x - 74, y: p.y - 30, r: 22, t: 1, life: 9, dps: 0, tone: 'ink', tick: 0 });
  return m.mobs.length;
}

/** A boss mid-telegraph: the Ashbone Dragon's breath cone, a gap-closer's charge lane, a summons' sigil, a rend ring. */
export function layBoss(m: MobSystem, p: At): number {
  const dragon = foe(m, 'bone-dragon', p.x + 96, p.y - 30);
  if (dragon) { dragon.tell = .3; dragon.aim = { x: p.x - 10, y: p.y - 12 }; dragon.face = -1; }
  const tyrant = foe(m, 'magma-tyrant', p.x - 90, p.y + 50);
  if (tyrant) { tyrant.tell = .3; tyrant.charging = true; tyrant.aim = { x: p.x - 8, y: p.y + 4 - 12 }; tyrant.face = 1; }
  m.calls.push({ x: p.x + 40, y: p.y + 70, type: 'bone-walker', key: 'fx-iso-call', t: .3 });
  m.bursts.push({ x: p.x - 40, y: p.y - 60, t: .5, r: 30, dmg: 0, delay: 1.2, el: 'shadow' });
  return m.mobs.length;
}

/** The dungeon dressing stood round the Keeper on a hand-made level (it has a plain object list), and the ways up and down. */
export function layDressing(objects: TdObject[], p: At): number {
  const c0 = Math.floor(p.x / TILE), r0 = Math.floor(p.y / TILE);
  const put = (dc: number, dr: number, sprite: () => ReturnType<typeof altar>, id: string, block = true) =>
    objects.push({ sprite, x: (c0 + dc) * TILE + TILE / 2, y: (r0 + dr) * TILE + TILE, kind: 'prop', id: `fx-${id}`, ...(block ? { block: { w: 1, h: 1 } } : {}) });
  put(-3, -2, altar, 'altar'); put(3, -2, () => brazier(true), 'brazier-lit'); put(-3, 2, () => brazier(false), 'brazier');
  put(0, -4, cage, 'cage'); put(2, -4, chains, 'chains', false); put(4, 1, brokenStatue, 'statue');
  put(-1, -3, () => cobweb('nw'), 'cobweb', false); put(-5, 0, stairsDown, 'down', false); put(5, 3, stairsUp, 'up', false);
  put(2, 2, ladderUp, 'ladder', false); put(1, 4, () => ruinWall(0), 'ruin-0'); put(3, 5, () => ruinWall(1), 'ruin-1'); put(-1, 5, () => ruinWall(2), 'ruin-2');
  return objects.length;
}
