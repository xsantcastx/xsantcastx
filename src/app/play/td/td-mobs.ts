/**
 * td-mobs.ts — monsters, fighting and ground loot in the top-down world (owner, 2026-10-19: "dungeons and mysterious
 * places, items drops monsters like if it was tibia style").
 *
 * Tibia's rules, cozy-sized: creatures roam near where they spawned and chase the Keeper on sight; the Keeper fights by
 * targeting one (a tap on it, or the attack key for the nearest) and swings while in reach; damage floats up in numbers;
 * a kill leaves its loot ON THE GROUND (coins, materials, rolled gear glowing in its rarity colour) to walk over and
 * pick up. A spawn comes back a while after its creature falls. Falling in a fight wakes the Keeper in the square.
 *
 * The host does the bookkeeping exactly as the side view did: onKill (Hunting XP, quests), rollLoot (gear) and onLoot
 * (into the satchel). Nothing here touches a save.
 */
import type { EngineOptions, LootRow } from '../engine/engine.model';
import type { LootRarity } from '../world/world.model';
import { TILE } from './td-art';
import { MANA_REGEN, MAX_MANA, SKILLS, type SkillId } from './td-skills';

export interface MobDef {
  id: string;
  name: string;
  hp: number;
  /** Art px per second. */
  speed: number;
  dmg: [number, number];
  /** Seconds between its bites. */
  rate: number;
  sight: number;
  level: number;
  coins: [number, number];
  drops: readonly { material: string; qty: number; chance: number }[];
  paint: (c: CanvasRenderingContext2D, frame: number) => void;
  w: number;
  h: number;
  /** Loot rank (shared/loot): a boss rolls more and better gear. Default 'normal'. */
  rank?: 'normal' | 'champion' | 'unique' | 'boss';
}

function px(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void { c.fillStyle = col; c.fillRect(x, y, w, h); }

/** The Rivet Maw: a rust-iron jaw on stubby legs, rivets for teeth. */
function paintMaw(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 3, 13 - b, 3, 3, '#3a2a24'); px(c, 14, 13 + b - 1, 3, 3, '#3a2a24');
  px(c, 2, 4 + b, 16, 10, '#8a5a3c'); px(c, 2, 4 + b, 16, 3, '#b07a4e'); px(c, 2, 12 + b, 16, 2, '#5e3a28');
  px(c, 4, 9 + b, 12, 3, '#2a1a1c');
  for (let i = 0; i < 4; i++) { px(c, 5 + i * 3, 9 + b, 1, 1, '#e9e4d8'); px(c, 6 + i * 3, 11 + b, 1, 1, '#e9e4d8'); }
  px(c, 5, 6 + b, 2, 2, '#ffd25a'); px(c, 13, 6 + b, 2, 2, '#ffd25a');
  px(c, 1, 5 + b, 1, 2, '#c99a6a'); px(c, 18, 5 + b, 1, 2, '#c99a6a');
}
/** The Cinder Bailiff: a hooded ember-golem with a lantern belly. */
function paintBailiff(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 5, 20, 4, 4, '#2a2028'); px(c, 13, 20, 4, 4, '#2a2028');
  px(c, 3, 7 + b, 16, 14, '#4a3a44'); px(c, 3, 7 + b, 16, 2, '#6a5562');
  px(c, 7, 12 + b, 8, 6, '#2a1a1c'); px(c, 8, 13 + b, 6, 4, '#ff8a2e'); px(c, 9, 14 + b, 4, 2, '#ffd25a');
  px(c, 5, 1 + b, 12, 7, '#3a2c36'); px(c, 7, 4 + b, 2, 2, '#ff6a2a'); px(c, 13, 4 + b, 2, 2, '#ff6a2a');
  px(c, 1, 9 + b, 2, 8, '#4a3a44'); px(c, 19, 9 - b + 1, 2, 8, '#4a3a44');
}

/** The Ash Wolf: a lean grey-ember wolf of the Emberwood. */
function paintWolf(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 1 : 0;
  px(c, 3, 13, 2, 4 - b, '#3a3236'); px(c, 15, 13, 2, 3 + b, '#3a3236'); px(c, 6, 14, 2, 3, '#3a3236'); px(c, 12, 14, 2, 3, '#3a3236');
  px(c, 3, 7, 15, 7, '#6a5f66'); px(c, 3, 7, 15, 2, '#8a7f86'); px(c, 3, 12, 15, 2, '#4a4248');
  px(c, 15, 3 + b, 6, 6, '#6a5f66'); px(c, 15, 2 + b, 2, 2, '#4a4248'); px(c, 19, 2 + b, 2, 2, '#4a4248'); px(c, 20, 6 + b, 2, 2, '#2a2226');
  px(c, 17, 5 + b, 1, 1, '#ff8a2e'); px(c, 0, 6 - b, 4, 2, '#8a7f86'); px(c, 1, 5 - b, 2, 1, '#ff8a2e');
}
/** The Cinder Imp: a small horned ember-imp with bat wings. */
function paintImp(c: CanvasRenderingContext2D, f: number): void {
  const b = f ? 2 : 0;
  px(c, 0, 4 + b, 5, 6, '#7a2a1c'); px(c, 15, 4 + b, 5, 6, '#7a2a1c'); px(c, 1, 5 + b, 3, 4, '#a83a24');
  px(c, 5, 5, 10, 11, '#c8432a'); px(c, 5, 5, 10, 2, '#e8633a'); px(c, 6, 15, 3, 3, '#7a2a1c'); px(c, 11, 15, 3, 3, '#7a2a1c');
  px(c, 6, 2, 2, 3, '#2a1a1c'); px(c, 12, 2, 2, 3, '#2a1a1c'); px(c, 7, 8, 2, 2, '#ffd25a'); px(c, 11, 8, 2, 2, '#ffd25a'); px(c, 8, 12, 4, 1, '#2a1a1c');
}

/** The Ember Warden, the Ember Mine's keeper: a towering Bailiff crowned in slag, its lantern a furnace. */
function paintWarden(c: CanvasRenderingContext2D, f: number): void {
  c.save(); c.scale(1.7, 1.7); paintBailiff(c, f); c.restore();
  px(c, 10, 0, 18, 4, '#2a1a1c'); px(c, 12, 0, 3, 2, '#ff8a2e'); px(c, 18, 0, 3, 2, '#ffd25a'); px(c, 24, 0, 3, 2, '#ff8a2e');
}

export const MOBS: Readonly<Record<string, MobDef>> = {
  'ember-warden': {
    id: 'ember-warden', name: 'The Ember Warden', hp: 420, speed: 24, dmg: [10, 16], rate: 1.6, sight: 140, level: 8,
    coins: [120, 220], drops: [{ material: 'infernal-heartstone', qty: 1, chance: .5 }, { material: 'ember-residue', qty: 2, chance: 1 }], paint: paintWarden, w: 38, h: 44, rank: 'boss',
  },
  'ash-wolf': {
    id: 'ash-wolf', name: 'Ash Wolf', hp: 45, speed: 46, dmg: [3, 7], rate: 1.1, sight: 110, level: 1,
    coins: [2, 9], drops: [{ material: 'world-root-bark', qty: 1, chance: .2 }], paint: paintWolf, w: 22, h: 17,
  },
  'cinder-imp': {
    id: 'cinder-imp', name: 'Cinder Imp', hp: 80, speed: 38, dmg: [5, 9], rate: 1.2, sight: 120, level: 2,
    coins: [6, 18], drops: [{ material: 'ember-residue', qty: 1, chance: .3 }], paint: paintImp, w: 20, h: 18,
  },
  'rivet-maw': {
    id: 'rivet-maw', name: 'Rivet Maw', hp: 60, speed: 34, dmg: [3, 6], rate: 1.3, sight: 96, level: 1,
    coins: [3, 13], drops: [{ material: 'cinder-ore', qty: 1, chance: .7 }], paint: paintMaw, w: 20, h: 17,
  },
  'cinder-bailiff': {
    id: 'cinder-bailiff', name: 'Cinder Bailiff', hp: 110, speed: 28, dmg: [6, 10], rate: 1.5, sight: 110, level: 3,
    coins: [8, 24], drops: [{ material: 'cinder-ore', qty: 1, chance: 1 }, { material: 'ember-residue', qty: 1, chance: .35 }], paint: paintBailiff, w: 22, h: 25,
  },
};

const sheets = new Map<string, HTMLCanvasElement>();
/** Two outlined frames side by side. */
export function mobSheet(def: MobDef): HTMLCanvasElement {
  let s = sheets.get(def.id);
  if (s) return s;
  const raw = document.createElement('canvas'); raw.width = def.w * 2; raw.height = def.h;
  const c = raw.getContext('2d')!;
  for (let f = 0; f < 2; f++) { c.save(); c.translate(f * def.w, 0); def.paint(c, f); c.restore(); }
  s = document.createElement('canvas'); s.width = raw.width; s.height = raw.height;
  const o = s.getContext('2d')!;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) o.drawImage(raw, dx, dy);
  o.globalCompositeOperation = 'source-in'; o.fillStyle = '#2a1a24'; o.fillRect(0, 0, s.width, s.height);
  o.globalCompositeOperation = 'source-over'; o.drawImage(raw, 0, 0);
  sheets.set(def.id, s);
  return s;
}

export interface MobSpawn { key: string; type: string; x: number; y: number }

export interface Mob {
  key: string;
  def: MobDef;
  x: number; y: number;
  hx: number; hy: number;
  hp: number;
  /** Ember Curse: seconds left, and the burn's tick timer. */
  cursed: number;
  burnT: number;
  face: 1 | -1;
  t: number;
  cd: number;
  hit: number;
  wander: { x: number; y: number } | null;
  wait: number;
}

export interface Drop {
  id: string;
  x: number; y: number;
  coins: number;
  material?: string;
  qty: number;
  item?: { definitionId: string; rarity: LootRarity; unique: boolean };
  rune?: string;
  label: string;
  color: string;
  age: number;
}

export interface Floater { x: number; y: number; text: string; color: string; age: number }

/** A short-lived picture in the world: a slash, a fire ring, a heal, wood chips, haste dust. */
export interface Effect { kind: 'slash' | 'wave' | 'heal' | 'chips' | 'dust' | 'drain' | 'curse' | 'ward' | 'bolt-hit'; x: number; y: number; age: number; life: number; dir: number; tx?: number; ty?: number }

/** A bolt in flight toward a creature. */
export interface Bolt { x: number; y: number; to: Mob; dmg: number; age: number }


export const RARITY_COLOR: Readonly<Record<LootRarity, string>> = {
  common: '#f3e7cf', uncommon: '#7fd56a', rare: '#5fb6ff', epic: '#c48bff', legendary: '#ffb347', mythic: '#ff6dd7', singular: '#4dffe0',
};

const REACH = 24;          // the Keeper's swing
const MOB_REACH = 18;      // a creature's bite
const RESPAWN = 75;        // seconds until a spawn comes back
const DESPAWN = 300;       // seconds a drop lies on the ground

/** What the mob system needs from the engine. */
export interface MobHost {
  readonly options: EngineOptions;
  walkable(c: number, r: number): boolean;
  levelId(): string;
  player(): { x: number; y: number };
  hurtPlayer(n: number): void;
  healPlayer(n: number): void;
  /** The Keeper swung (an attack or an ability): the host plays the swing toward `at`. */
  swung(at: { x: number; y: number } | null): void;
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export class MobSystem {
  readonly mobs: Mob[] = [];
  readonly drops: Drop[] = [];
  readonly floaters: Floater[] = [];
  readonly effects: Effect[] = [];
  readonly bolts: Bolt[] = [];
  /** Seconds each skill still cools. */
  readonly cooldowns: Partial<Record<SkillId, number>> = {};
  mana = MAX_MANA;
  /** The level's mana cap and spell power (td-skills levelStats). */
  maxMana = MAX_MANA;
  power = 1;
  /** Mana back per second, and Agility's quicker staff (td-skills levelStats). */
  regen = MANA_REGEN;
  agility = 0;
  /** The running aura (one at a time, D2), or none. */
  aura: SkillId | null = 'aura-embers';
  /** Dark Ward: damage it still absorbs, seconds left. */
  ward = 0;
  wardT = 0;
  /** Seconds of Haste left (kept for kits that have it). */
  haste = 0;
  /** The basic attack reaches this far (art px): the staff's bolt (7 tiles). */
  readonly range = SKILLS['ember-bolt'].vars['range'] * TILE;
  private auraT = 0;
  target: Mob | null = null;
  attacking = false;
  private swing = 0;
  private kills = 0;
  private readonly deadUntil = new Map<string, number>();
  private clock = 0;

  constructor(private readonly host: MobHost) {}

  /** Bring the level's spawns to life (those not resting after a death) and drop everything of the last level. */
  enterLevel(spawns: readonly MobSpawn[]): void {
    this.mobs.length = 0; this.drops.length = 0; this.target = null;
    this.addSpawns(spawns);
  }
  /** Spawns that came into reach (the endless surface hands them over chunk by chunk). */
  addSpawns(spawns: readonly MobSpawn[]): void {
    for (const s of spawns) {
      if (this.mobs.some(m => m.key === s.key) || (this.deadUntil.get(s.key) ?? 0) > this.clock) continue;
      const def = MOBS[s.type];
      if (!def) continue;
      this.mobs.push({ key: s.key, def, x: s.x, y: s.y, hx: s.x, hy: s.y, hp: def.hp, cursed: 0, burnT: 0, face: 1, t: Math.random() * 3, cd: 1, hit: 0, wander: null, wait: Math.random() * 3 });
    }
  }
  /** Forget creatures far from the Keeper (the surface never ends; they come back when their chunk does). */
  prune(maxDist: number): void {
    const p = this.host.player();
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (Math.hypot(m.x - p.x, m.y - p.y) > maxDist && m !== this.target) this.mobs.splice(i, 1);
    }
  }

  /** The creature under a world point (a tap), if any. */
  mobAt(x: number, y: number): Mob | null {
    let best: Mob | null = null, bd = 18;
    for (const m of this.mobs) { const d = Math.hypot(m.x - x, m.y - m.def.h / 2 - y); if (d < bd) { bd = d; best = m; } }
    return best;
  }

  update(dt: number): void {
    this.clock += dt;
    const p = this.host.player();
    this.swing = Math.max(0, this.swing - dt);
    // The Keeper's attack: the target, or with the key held the nearest creature in reach.
    if (this.target && (this.target.hp <= 0 || !this.mobs.includes(this.target))) this.target = null;
    let foe = this.target;
    if (!foe && this.attacking) {
      let bd = this.range;
      for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; foe = m; } }
    }
    // The Warlock's staff: an ember bolt flies to the foe in range (Tibia's auto-attack, at a distance).
    const bolt = SKILLS['ember-bolt'];
    if (foe && this.swing <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) <= this.range) {
      this.swing = bolt.cd / (1 + this.agility);
      this.bolts.push({ x: p.x, y: p.y - 22, to: foe, dmg: rnd(bolt.vars['min'], bolt.vars['max']), age: 0 });
      this.host.swung(foe);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i], tx = b.to.x, ty = b.to.y - b.to.def.h / 2;
      b.age += dt;
      const dx = tx - b.x, dy = ty - b.y, len = Math.hypot(dx, dy), step = 190 * dt;
      if (!this.mobs.includes(b.to) || b.age > 2) { this.bolts.splice(i, 1); continue; }
      if (len <= step + 2) {
        this.bolts.splice(i, 1);
        this.effects.push({ kind: 'bolt-hit', x: tx, y: ty, age: 0, life: .25, dir: 1 });
        this.hitFoe(b.to, b.dmg, '#ffd25a');
      } else { b.x += dx / len * step; b.y += dy / len * step; }
    }
    // The aura (D2): it works on everything near, every second, while it is chosen.
    this.auraT -= dt;
    const auraTick = this.auraT <= 0;
    if (auraTick) this.auraT = 1;
    for (const m of [...this.mobs]) {
      if (m.cursed > 0) {
        m.cursed -= dt; m.burnT -= dt;
        if (m.burnT <= 0) { m.burnT = 1; this.hitFoe(m, SKILLS['ember-curse'].vars['dps'], '#ff9a4a'); if (m.hp <= 0) continue; }
      }
      if (auraTick && this.aura === 'aura-embers' && Math.hypot(m.x - p.x, m.y - p.y) <= SKILLS['aura-embers'].vars['radius'] * TILE) this.hitFoe(m, SKILLS['aura-embers'].vars['dps'], '#ff8a2e');
    }
    for (const m of this.mobs) {
      m.t += dt; m.cd -= dt; m.hit = Math.max(0, m.hit - dt);
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      let tx: number | null = null, ty: number | null = null;
      if (d < m.def.sight) { tx = p.x; ty = p.y; m.wander = null; }
      else {
        // Roam near home: a short stroll, a pause, another.
        if (!m.wander) {
          m.wait -= dt;
          if (m.wait <= 0) { m.wander = { x: m.hx + rnd(-40, 40), y: m.hy + rnd(-30, 30) }; m.wait = 1.5 + Math.random() * 3; }
        }
        if (m.wander) { tx = m.wander.x; ty = m.wander.y; if (Math.hypot(tx - m.x, ty - m.y) < 3) m.wander = null; }
      }
      if (tx !== null && ty !== null) {
        const dx = tx - m.x, dy = ty - m.y, len = Math.hypot(dx, dy);
        if (len > (d < m.def.sight ? MOB_REACH - 4 : 2)) {
          const step = Math.min(len, m.def.speed * dt), vx = dx / len * step, vy = dy / len * step;
          if (this.free(m.x + vx, m.y)) m.x += vx; else m.wander = null;
          if (this.free(m.x, m.y + vy)) m.y += vy; else m.wander = null;
          if (Math.abs(vx) > .05) m.face = vx < 0 ? -1 : 1;
        }
      }
      // A bite when the Keeper is in its reach.
      if (d <= MOB_REACH && m.cd <= 0) {
        m.cd = m.def.rate;
        let n = rnd(m.def.dmg[0], m.def.dmg[1]);
        // A cursed foe bites weaker; the Dark Ward drinks what it can.
        if (m.cursed > 0) n = Math.max(1, Math.round(n * (1 - SKILLS['ember-curse'].vars['weaken'] / 100)));
        if (this.ward > 0) { const soak = Math.min(this.ward, n); this.ward -= soak; n -= soak; this.float(p.x + 8, p.y - 30, `-${soak}`, '#c8a8ff'); }
        if (n > 0) { this.host.hurtPlayer(n); this.float(p.x, p.y - 34, `${n}`, '#ff5a4a'); }
      }
    }
    // Walk over loot to pick it up.
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const g = this.drops[i];
      g.age += dt;
      if (g.age > DESPAWN) { this.drops.splice(i, 1); continue; }
      // Coins come to the Keeper (a Warlock kills from afar); gear and materials wait to be walked to.
      if (g.coins > 0 && g.age > .6) {
        const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
        if (d < 8 * TILE && d > 1) { const v = Math.min(d, (90 + g.age * 60) * dt); g.x += dx / d * v; g.y += dy / d * v; }
      }
      if (Math.hypot(g.x - p.x, g.y - p.y) < 22 && g.age > .4) this.pick(g, i);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.age += dt; f.y -= 14 * dt; if (f.age > 1) this.floaters.splice(i, 1); }
    for (let i = this.effects.length - 1; i >= 0; i--) { const e = this.effects[i]; e.age += dt; if (e.age > e.life) this.effects.splice(i, 1); }
    for (const k of Object.keys(this.cooldowns) as SkillId[]) this.cooldowns[k] = Math.max(0, (this.cooldowns[k] ?? 0) - dt);
    this.mana = Math.min(this.maxMana, this.mana + this.regen * dt);
    if (this.wardT > 0) { this.wardT -= dt; if (this.wardT <= 0) this.ward = 0; }
    if (this.haste > 0) {
      this.haste = Math.max(0, this.haste - dt);
      if (Math.random() < dt * 8) this.effects.push({ kind: 'dust', x: p.x + rnd(-4, 4), y: p.y, age: 0, life: .4, dir: 1 });
    }
  }

  private hitFoe(foe: Mob, raw: number, color: string): void {
    const dmg = Math.round(raw * this.power);
    foe.hp -= dmg; foe.hit = .18;
    if (this.aura === 'aura-siphon') this.host.healPlayer(SKILLS['aura-siphon'].vars['heal']);
    this.float(foe.x, foe.y - foe.def.h, `${dmg}`, color);
    if (foe.hp <= 0) this.kill(foe);
  }

  /** Use a skill from the bar. Returns why not (for the host to say), or null when it went off. */
  useAbility(id: SkillId): 'cooldown' | 'nofoe' | 'mana' | null {
    const sk = SKILLS[id];
    if (!sk || sk.kind !== 'active') return null;
    if ((this.cooldowns[id] ?? 0) > 0) return 'cooldown';
    if (this.mana < sk.mana) return 'mana';
    const p = this.host.player();
    const foeInRange = (): Mob | null => {
      if (this.target && Math.hypot(this.target.x - p.x, this.target.y - p.y) <= this.range) return this.target;
      let best: Mob | null = null, bd = this.range;
      for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= bd) { bd = d; best = m; } }
      return best;
    };
    const v = sk.vars;
    if (id === 'drain-life') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      const dmg = rnd(v['min'], v['max']);
      this.effects.push({ kind: 'drain', x: foe.x, y: foe.y - foe.def.h / 2, tx: p.x, ty: p.y - 20, age: 0, life: .5, dir: 1 });
      this.hitFoe(foe, dmg, '#ff7a6a');
      const heal = Math.round(dmg * v['heal'] / 100);
      this.host.healPlayer(heal); this.float(p.x, p.y - 36, `+${heal}`, '#7fe08a');
      this.host.swung(foe);
    } else if (id === 'ember-curse') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      foe.cursed = v['secs']; foe.burnT = 1;
      this.effects.push({ kind: 'curse', x: foe.x, y: foe.y - foe.def.h - 4, age: 0, life: .6, dir: 1 });
      this.host.swung(foe);
    } else if (id === 'hellfire-nova') {
      for (const m of [...this.mobs]) if (Math.hypot(m.x - p.x, m.y - p.y) <= v['radius'] * TILE) this.hitFoe(m, rnd(v['min'], v['max']), '#ff9a4a');
      this.effects.push({ kind: 'wave', x: p.x, y: p.y - 8, age: 0, life: .5, dir: 1 });
      this.host.swung(null);
    } else if (id === 'dark-ward') {
      this.ward = v['absorb']; this.wardT = v['secs'];
      this.effects.push({ kind: 'ward', x: p.x, y: p.y - 14, age: 0, life: .6, dir: 1 });
      this.host.swung(null);
    }
    this.mana -= sk.mana;
    this.cooldowns[id] = sk.cd;
    return null;
  }

  /** Wood chips flying off a struck tree (the host's chopping). */
  chips(x: number, y: number): void { this.effects.push({ kind: 'chips', x, y, age: 0, life: .45, dir: Math.random() < .5 ? -1 : 1 }); }

  private free(x: number, y: number): boolean {
    for (const [ox, oy] of [[-4, -3], [4, -3], [-4, -1], [4, -1]]) if (!this.host.walkable(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false;
    return true;
  }

  private float(x: number, y: number, text: string, color: string): void { this.floaters.push({ x, y, text, color, age: 0 }); }

  private kill(m: Mob): void {
    this.mobs.splice(this.mobs.indexOf(m), 1);
    // Soul Harvest (passive): every kill gives back mana.
    this.mana = Math.min(this.maxMana, this.mana + SKILLS['soul-harvest'].vars['mana']);
    if (this.target === m) this.target = null;
    this.deadUntil.set(m.key, this.clock + RESPAWN);
    const id = `td:${this.host.levelId()}:${m.key}:${Date.now().toString(36)}:${this.kills++}`;
    const areaId = this.host.levelId() === 'surface' ? 'ember-quarry' : 'ember-delve';
    this.host.options.onKill?.({ id, areaId, creature: m.def.id, name: m.def.name, hp: m.def.hp });
    // The ground loot: a coin pile with the creature's materials, and whatever gear the host rolls for the kill.
    const spot = (i: number) => ({ x: m.x + (i % 3 - 1) * 6, y: m.y + Math.floor(i / 3) * 5 });
    let n = 0;
    const coins = rnd(m.def.coins[0], m.def.coins[1]);
    for (const d of m.def.drops) {
      if (Math.random() >= d.chance) continue;
      this.drops.push({ id: `${id}:m${n}`, ...spot(n++), coins: 0, material: d.material, qty: d.qty, label: d.material.replace(/-/g, ' '), color: RARITY_COLOR.common, age: 0 });
    }
    this.drops.push({ id: `${id}:c`, ...spot(n++), coins, qty: 0, label: `${coins} Gold`, color: '#ffd25a', age: 0 });
    let rows: readonly LootRow[] = [];
    try { rows = this.host.options.rollLoot?.({ creature: m.def.id, level: m.def.level, rank: m.def.rank ?? 'normal', killKey: id }) ?? []; } catch { rows = []; }
    rows.forEach((row, i) => {
      const color = RARITY_COLOR[row.rarity] ?? RARITY_COLOR.common;
      if (row.kind === 'item') this.drops.push({ id: `${id}:g${i}`, ...spot(n++), coins: 0, qty: 0, item: { definitionId: row.definitionId, rarity: row.rarity, unique: !!row.unique }, label: row.label, color, age: 0 });
      else this.drops.push({ id: `${id}:r${i}`, ...spot(n++), coins: 0, qty: 0, rune: row.rune, label: row.label, color, age: 0 });
    });
  }

  private pick(g: Drop, i: number): void {
    const ok = this.host.options.onLoot?.({
      id: g.id, coins: g.coins, ore: g.material ? g.qty : 0, ...(g.material ? { material: g.material } : {}),
      ...(g.item ? { item: g.item } : {}), ...(g.rune ? { rune: g.rune } : {}),
    });
    if (ok === false) return;   // the satchel is full: it stays on the ground
    this.drops.splice(i, 1);
    this.float(g.x, g.y - 10, g.label, g.color);
  }
}
