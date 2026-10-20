/**
 * td-engine.ts — the top-down engine, Phase 1 (docs/design/top-down.md §2).
 *
 * Draws a hand-authored town (seamworks-square.ts) in a cozy 3/4 view: baked
 * ground chunks, y-sorted buildings/stalls/trees/props/people, roofs and tree
 * crowns that fade when the Keeper walks behind them, chimney smoke, and a
 * half-resolution night pass lit by windows, lamps and string lights, driven
 * by the world clock (setWorldHour). The Keeper walks in 8 directions: WASD /
 * arrows, a drag-anywhere joystick on touch, or tap/click-to-walk with A*.
 *
 * It speaks the side-scroller's contract (EngineOptions in, EngineState out,
 * the same setters), so the play component keeps all its wiring; members the
 * top-down world has no use for yet are no-ops (see createTopDownEngine).
 */
import type { EngineOptions, EngineState, EngineInput } from '../engine/engine.model';
import type { StationDef } from '../world/world.model';
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { vocationLook } from '../../shared/keeper-look/vocation-look';
import { CAST_FRAME, FRONT_AX, FRONT_AY, FRONT_H, FRONT_W, PHONE_FRAME, frontFrame, frontSheet } from '../../shared/keeper-look/keeper-front';
import { NPC_LOOKS } from '../../shared/keeper-look/npc-looks';
import { defaultLook, randomLook, type KeeperLook, type KeeperStats } from '../../shared/keeper-look/keeper-look.model';
import type { KeeperGear } from '../../shared/keeper-look/keeper-gear';
import { PAL, paintEdge, paintGround, TILE, type Ground, type Sprite } from './td-art';
import { type TdMap, type TdObject, type TdStall } from './seamworks-square';
import { TdWorld } from './td-world';
import { HandLevel, footFree, standNear, type TdLevel } from './td-level';
import { EMBER_MINE_1 } from './maps/ember-mine-1';
import { EMBER_MINE_2, EMBER_MINE_3 } from './maps/ember-mine-deep';
import { SLAGSTONE_CAVE } from './maps/slagstone-cave';
import { EMBER_INN_1, EMBER_INN_2 } from './maps/ember-inn';
import { PYRE_SPIRE_1, PYRE_SPIRE_2, PYRE_SPIRE_3 } from './maps/pyre-spire';
import { MOLTEN_DEEP_1, MOLTEN_DEEP_2, MOLTEN_DEEP_3, MOLTEN_DEEP_4, MOLTEN_DEEP_5, MOLTEN_DEEP_6 } from './maps/molten-deep';
import { FORGE_OF_FOUR_1, FORGE_OF_FOUR_2, FORGE_OF_FOUR_3 } from './maps/forge-of-four';
import { ASHEN_CRYPT_1, ASHEN_CRYPT_2 } from './maps/ashen-crypt';
import { SALTED_EMBER_0, SALTED_EMBER_1 } from './maps/cinderport';
import { WOODWARD_LODGE_1, WOODWARD_LODGE_2 } from './maps/ashgrove';
import { BLOCK, EMBER_ISLE_DEF } from './maps/ember-isle';
import { INFERNAL_REACH_DEF } from './maps/infernal-reach';
import { VERDANT_WILDS_DEF } from './maps/verdant-wilds';
import { ROOTGLASS_BOLE_0, ROOTGLASS_BOLE_1, ROOTGLASS_BOLE_2, ROOTGLASS_BOLE_3 } from './maps/rootglass-bole';
import { OVERGROWN_TEMPLE_1, OVERGROWN_TEMPLE_2, OVERGROWN_TEMPLE_3 } from './maps/overgrown-temple';
import type { ContinentDef } from './continent';
import type { TdMapDef } from './td-level';

/** Every hand-drawn level under (or over) the surface, by id. */
/** Every continent, by id (ships sail between them). */
export const CONTINENTS: Readonly<Record<string, ContinentDef>> = { 'ember-isle': EMBER_ISLE_DEF, 'infernal-reach': INFERNAL_REACH_DEF, 'verdant-wilds': VERDANT_WILDS_DEF };

export const LEVELS: Readonly<Record<string, TdMapDef>> = { 'ember-mine-1': EMBER_MINE_1, 'ember-mine-2': EMBER_MINE_2, 'ember-mine-3': EMBER_MINE_3, 'slagstone-cave': SLAGSTONE_CAVE, 'ember-inn-1': EMBER_INN_1, 'ember-inn-2': EMBER_INN_2,
  'pyre-spire-1': PYRE_SPIRE_1, 'pyre-spire-2': PYRE_SPIRE_2, 'pyre-spire-3': PYRE_SPIRE_3,
  'molten-deep-1': MOLTEN_DEEP_1, 'molten-deep-2': MOLTEN_DEEP_2, 'molten-deep-3': MOLTEN_DEEP_3,
  'molten-deep-4': MOLTEN_DEEP_4, 'molten-deep-5': MOLTEN_DEEP_5, 'molten-deep-6': MOLTEN_DEEP_6,
  'forge-of-four-1': FORGE_OF_FOUR_1, 'forge-of-four-2': FORGE_OF_FOUR_2, 'forge-of-four-3': FORGE_OF_FOUR_3,
  'ashen-crypt-1': ASHEN_CRYPT_1, 'ashen-crypt-2': ASHEN_CRYPT_2,
  'salted-ember-1': SALTED_EMBER_1, 'salted-ember-0': SALTED_EMBER_0, 'woodward-lodge-1': WOODWARD_LODGE_1, 'woodward-lodge-2': WOODWARD_LODGE_2,
  'rootglass-bole-0': ROOTGLASS_BOLE_0, 'rootglass-bole-1': ROOTGLASS_BOLE_1, 'rootglass-bole-2': ROOTGLASS_BOLE_2, 'rootglass-bole-3': ROOTGLASS_BOLE_3,
  'overgrown-temple-1': OVERGROWN_TEMPLE_1, 'overgrown-temple-2': OVERGROWN_TEMPLE_2, 'overgrown-temple-3': OVERGROWN_TEMPLE_3 };
/** Doors on the surface into a building's ground floor (a town's stall station id → the level and where to stand). */
const DOORS: Readonly<Record<string, { to: string; arrive: string }>> = {
  'inn-door': { to: 'ember-inn-1', arrive: 'inn-out' }, 'spire-door': { to: 'pyre-spire-1', arrive: 'spire-out' },
  'salted-door': { to: 'salted-ember-1', arrive: 'salted-out' }, 'lodge-door': { to: 'woodward-lodge-1', arrive: 'lodge-out' },
  'bole-door': { to: 'rootglass-bole-0', arrive: 'bole-out' },
};
import { BOSS_TELL, CALL_TELL, MobSystem, RAISED_SKELETON, mobSheet, windsUp, type Drop, type Minion, type Mob } from './td-mobs';
import { SKILLS, defaultBar, fightStats, type SkillId } from './td-skills';
import { FX, HOSTILE_EDGE, LEVEL_UP, LOOT, beamMotes, beamSteps, burst, circlePixels, conePixels, discSprite, drawBurst, drawRing, fxNoise, glowSquare, groundRing, linePixels, lootBeam, polyPoints, ringArc, scorchSprite, type LootRung, type Tones } from './td-fx';
import type { ItemStats } from '../../shared/rpg/item.model';

/** The worn-gear keys the fight reads (they make up the build's cache key). */
const GEAR_KEYS: readonly (keyof ItemStats)[] = ['life', 'mana', 'defense', 'spellDamage', 'castSpeed', 'moveSpeed', 'critChance', 'lifeRegen', 'manaRegen',
  'fireResist', 'coldResist', 'lightningResist', 'arcaneResist', 'allResist'];

/** The Map window's ground colours (one pixel per tile, or per two on a continent). */
const MAP_COL: Partial<Record<Ground, string>> = {
  grass: PAL.grass[0], flowers: PAL.grass[1], dirt: PAL.dirt[0], cobble: PAL.cobble[0], sand: PAL.sand[0], plank: PAL.plank[0],
  water: PAL.water[0], ember: PAL.ember[0], cave: '#6a564c', rock: '#1d1720', wall: '#3a2a24', rug: '#8f3524',
  moss: PAL.moss[1], flagstone: PAL.temple[1], vinewall: '#2c3a2c', canopy: PAL.jungle[2], bark: PAL.bark[2],
};
/** One pin on the Map: a place to go, where it lies (0..1 across and down the map), and its kind for its colour. */
export interface TdMapPin { id: string; label: string; blurb: string; kind: 'way' | 'ship' | 'stall' | 'npc'; u: number; v: number }
/** HUD portraits by look (heroPortrait). */
const portraits = new WeakMap<KeeperPainter, string>();
const CHUNK = 16;
const SPEED = 74;              // art px / s
const REACH = 26;              // art px from a stall's interaction spot
const FOLK = 16;               // townsfolk strolling the square (the references' busy plaza)
const FOLK_SPEED = 30;         // art px / s: a stroll, under half the Keeper's pace

interface Person { painter: KeeperPainter | null; x: number; y: number; face: 1 | -1; dir: 'side' | 'down' | 'up'; name?: string; moving: boolean; t: number; /** A keeper's id (its task mark). */ kid?: string }
/** A townsperson: strolls a route to somewhere in town, lingers, picks somewhere new. */
interface Folk extends Person { path: { x: number; y: number }[]; wait: number }
interface Puff { x: number; y: number; age: number; life: number; r: number }
/** A visual-only pixel of the effects pass: an aura's mote, a shard the Dark Ward sheds (docs/design/effects-spec.md). */
interface Mote { x: number; y: number; sx: number; sy: number; age: number; life: number; kind: 'ember' | 'life' | 'shard'; seed: number }
const AURA_R = SKILLS['aura-embers'].vars['radius'] * TILE;
const NOVA_R = SKILLS['hellfire-nova'].vars['radius'] * TILE;
const MOTES = 10;              // an aura's motes alive at once (spec: ≤ 10)
const SHARDS = 8;
/** A loot pop: the small burst when gear lands on the ground or goes into the satchel (spec §Loot). */
interface LootPop { x: number; y: number; rung: LootRung; age: number; life: number; kind: 'drop' | 'pick'; seed: number }
/** The rung a drop stands on: gear and runes their own, anything else none (a coin pile, a sack). */
const rungOf = (g: Drop): LootRung | null => g.rarity ?? g.item?.rarity ?? (g.rune ? 'common' : null);

export class TopDownEngine {
  private readonly ctx: CanvasRenderingContext2D;
  /** The continent the Keeper is on (its surface); one is made per continent and kept (sailing back finds it as left). */
  private world: TdWorld;
  private readonly continents = new Map<string, TdWorld>();
  /** The level the Keeper is on: the surface, or a hand-drawn floor under it. */
  private level: TdLevel;
  private readonly levels = new Map<string, HandLevel>();
  /** Monsters, the Keeper's fight and the loot on the ground (td-mobs.ts). */
  private readonly mobs: MobSystem;
  private hp = 100;
  private maxHp = 100;
  /** Agility's speed of foot (0–0.3). */
  private agility = 0;
  /** Worn Life Regen: life back each second, in the fight too. */
  private lifeRegen = 0;
  /** A potion still pouring in (potions.model.ts): life and mana left to give, over the seconds left. */
  private sip = { hp: 0, mana: 0, t: 0 };
  private lastHurt = -99;
  private messageAge = 0;
  /** The engine's own line, as an i18n key the HUD translates (engineMessage). */
  private messageKey = '';
  private spawnTimer = 0;
  private chaseTimer = 0;
  /** The swing being played (seconds left) and which way it faces. */
  private actT = 0;
  /** A tree being cut: hits so far, the next swing's timer. */
  private chop: { c: number; r: number; x: number; y: number; hits: number; t: number } | null = null;
  private shake = 0;
  /** The stamped town (its stalls, keepers and streets); the ground and walls everywhere come from `world`. */
  private map: TdMap;
  private readonly chunks = new Map<string, HTMLCanvasElement[]>();
  private readonly player: Person;
  private readonly keepers: Person[] = [];
  private readonly folk: Folk[] = [];
  /** Walkable street tiles (cobble, plank, dirt) where townsfolk start and stroll to. */
  private readonly streets: number[] = [];
  private readonly keys = new Set<string>();
  private path: { x: number; y: number }[] = [];
  /** Walking a path: the closest the Keeper has come to the next step, and how long without getting closer. */
  private pathBest = Infinity;
  private pathStall = 0;
  private arrive: (() => void) | null = null;
  private joy: { id: number; sx: number; sy: number; x: number; y: number; active: boolean } | null = null;
  private puffs: Puff[] = [];
  private raf = 0;
  private last = 0;
  private time = 0;
  private paused = false;
  private hour = 12;
  /** 0 day … 1 full night, from the world clock (setSky); `?hour=` pins it for screenshots and tests. */
  private darkness = 0;
  private dusk = 0;
  private pinned: number | null = null;
  private scale = 2;
  private cam = { x: 0, y: 0, w: 0, h: 0 };
  private stateTimer = 0;
  private message = '';
  private nearby: TdStall | null = null;
  /** Head marks over task givers, by keeper id ('!' a task on offer, '?' one to hand in): setTaskMarks. */
  private taskMarks: Readonly<Record<string, '!' | '?'>> = {};
  private glim = { x: 0, y: 0, shown: true };
  private dark: HTMLCanvasElement | null = null;
  private lightSprite: HTMLCanvasElement | null = null;
  private glowSprite: HTMLCanvasElement | null = null;
  private readonly unbind: (() => void)[] = [];
  /** The Slate is open: the Keeper faces the camera and looks at it in their hands. */
  private phone = false;
  private frameError = false;
  /** The objects drawn this frame (smoke, lights and fireflies read them). */
  private visible: TdObject[] = [];
  /** The effects pass: aura motes and ward shards (visual only), the ward last seen, reduced motion. */
  private motes: Mote[] = [];
  private moteT = 0;
  private wardSeen = 0;
  /** Loot pops alive, and the gear drops seen last frame (a new one pops as it lands, a vanished one at the feet as it is taken). */
  private pops: LootPop[] = [];
  private seenDrops = new Map<string, { x: number; y: number; rung: LootRung }>();
  private seenLevel: unknown = null;
  /**
   * Screenshot-only (e2e/td-fx2-shots.spec.ts): with `?fxloot=1` under an automated browser, one drop of every rung
   * lies round the Keeper. Drawn only — never in the MobSystem, so nothing can be picked up and nothing reaches a save.
   */
  private readonly fxLoot = typeof navigator !== 'undefined' && !!navigator.webdriver && typeof location !== 'undefined' && /[?&]fxloot=1\b/.test(location.search);
  private showcase: Drop[] = [];
  private tellSeen = '';
  private popSeen = '';
  private showcaseLevel: unknown = null;
  private showcaseT = 0;
  private readonly reduceMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  /** Reduced motion, read live: the same shapes, no travel (spec §Rules 6). */
  private get still(): boolean { return !!this.reduceMq?.matches; }

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: EngineOptions) {
    this.ctx = canvas.getContext('2d')!;
    this.world = new TdWorld();
    this.continents.set(this.world.continent, this.world);
    this.map = this.world.town;
    this.level = this.world;
    this.mobs = new MobSystem({
      options: this.options,
      walkable: (c, r) => this.level.walkable(c, r),
      levelId: () => this.level.id,
      player: () => this.player,
      hurtPlayer: n => this.hurt(n),
      healPlayer: n => { this.hp = Math.min(this.maxHp, this.hp + n); },
      hover: (c, r) => this.level.walkable(c, r) || this.level.ground(c, r) === 'ember',
      passable: (c, r) => { const g = this.level.ground(c, r); return g !== 'rock' && g !== 'wall' && g !== 'vinewall' && g !== 'bark'; },
      swung: at => { this.actT = .3; if (at && Math.abs(at.x - this.player.x) > 2) this.player.face = at.x < this.player.x ? -1 : 1; this.player.dir = 'side'; },
    });
    this.player = { painter: new KeeperPainter(defaultLook()), x: this.map.spawn.x, y: this.map.spawn.y, face: 1, dir: 'down', moving: false, t: 0 };
    this.glim.x = this.player.x + 12; this.glim.y = this.player.y - 44;
    this.populate();
    this.bindInput();
    try { const h = new URLSearchParams(window.location.search).get('hour'); if (h !== null && h !== '') { this.pinned = Math.max(0, Math.min(24, Number(h))); this.darkness = TopDownEngine.darknessAt(this.pinned); } } catch { /* no URL */ }
  }
  private static darknessAt(h: number): number { return h >= 21 || h < 5 ? 1 : h >= 18 ? (h - 18) / 3 : h < 7 ? (7 - h) / 2 : 0; }

  // ── Lifecycle (the component's contract) ───────────────────────────────────

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      // rAF stamps the frame's start, which can precede the performance.now() taken in start(): never step backwards.
      const dt = Math.max(0, Math.min(.05, (now - this.last) / 1000));
      this.last = now;
      // Schedule first: one bad frame (a host callback throwing) must never stop the world.
      this.raf = requestAnimationFrame(loop);
      try {
        if (!this.paused) this.update(dt);
        this.draw();
      } catch (err) {
        if (!this.frameError) { this.frameError = true; console.error('[top-down] frame error', err); }
      }
    };
    this.raf = requestAnimationFrame(loop);
  }
  destroy(): void {
    cancelAnimationFrame(this.raf); this.raf = 0;
    for (const off of this.unbind) off();
  }
  setPaused(paused: boolean): void { this.paused = paused; if (paused) { this.keys.clear(); this.joy = null; } }
  setPhone(on: boolean): void {
    // Called on every HUD tick: turn to the camera only as the Slate comes out, never mid-walk afterwards.
    if (on && !this.phone && !this.player.moving) this.player.dir = 'down';
    this.phone = on;
  }
  setWorldHour(hour: number): void { this.hour = ((hour % 24) + 24) % 24; }
  /** The world clock's sky (world-clock.model.ts Sky): light 1 = day, 0 = dark; glow = dawn/dusk gold. */
  setSky(sky: { light: number; glow: number; eclipse: number }): void {
    if (this.pinned !== null) return;
    this.darkness = Math.max(0, Math.min(1, 1 - sky.light));
    this.dusk = sky.glow;
  }
  setKeeperLook(look: KeeperLook | null, gear: KeeperGear | null = null): void {
    const l = look ?? defaultLook();
    // The Warlock is undead (owner, 2026-10-20): grey-green skin, a dark violet robe with bone trim, a hood, eyes that
    // burn violet. Worn gear still shows over it; the hood stands in only when no head piece is worn.
    const v = vocationLook(l.vocation, gear);
    this.player.painter = new KeeperPainter(l, v.gear, v.garb);
  }
  setInput(action: EngineInput, pressed: boolean): void {
    // The side view's on-screen buttons: left/right walk, down walks south, jump walks north.
    if (action === 'attack') { this.mobs.attacking = pressed; return; }
    const key = action === 'left' ? 'a' : action === 'right' ? 'd' : action === 'down' ? 's' : action === 'jump' ? 'w' : '';
    if (!key) return;
    if (pressed) { this.keys.add(key); this.path = []; } else this.keys.delete(key);
  }
  interact(): void {
    if (this.nearby) { this.use(this.nearby); return; }
    const t = this.treeNear();
    if (t) this.startChop(t.c, t.r, t.x, t.y);
  }
  /** The skills on keys 1–4 (the Spellbook assigns them). */
  private bar: SkillId[] = defaultBar('warlock');
  /** Use a skill on the bar (by id, or by slot '1'–'4'). Returns why not, or null when it went off. */
  useAbility(idOrSlot: string): 'cooldown' | 'nofoe' | 'mana' | null {
    const id = /^[1-4]$/.test(idOrSlot) ? this.bar[Number(idOrSlot) - 1] : idOrSlot as SkillId;
    if (!id) return null;
    return this.paused ? 'cooldown' : this.mobs.useAbility(id);
  }
  /** The bar for the HUD: each slot's skill, cooldown left (0–1), and whether there is mana for it. */
  get abilities(): readonly { id: string; key: string; left: number; mana: number; ready: boolean }[] {
    return this.bar.map((id, i) => ({ id, key: String(i + 1), left: SKILLS[id].cd ? Math.min(1, (this.mobs.cooldowns[id] ?? 0) * (1 + this.mobs.castSpeed) / SKILLS[id].cd) : 0, mana: SKILLS[id].mana, ready: this.mobs.mana >= SKILLS[id].mana }));
  }
  get mana(): number { return this.mobs.mana; }
  get maxMana(): number { return this.mobs.maxMana; }
  get maxHealth(): number { return this.maxHp; }
  private buildKey = '';
  /**
   * The Keeper's level, spent points and worn gear totals (the HUD hands them in): life, mana, regeneration, spell
   * power, speed — and from the gear (§3 affixes) cast speed, crits, Defense, resists and life back each second.
   */
  setKeeperBuild(level: number, stats: KeeperStats, gear: Partial<ItemStats> = {}): void {
    const key = `${level}|${stats.vit},${stats.ene},${stats.spi},${stats.agi}|${GEAR_KEYS.map(k => gear[k] ?? 0).join(',')}`;
    if (key === this.buildKey) return;
    this.buildKey = key;
    const st = fightStats(level, stats, gear);
    this.maxHp = st.maxHp; this.hp = Math.min(this.hp, this.maxHp);
    this.mobs.maxMana = st.maxMana; this.mobs.mana = Math.min(this.mobs.mana, st.maxMana);
    this.mobs.power = st.power; this.mobs.regen = st.regen; this.mobs.agility = st.haste;
    this.mobs.castSpeed = st.castSpeed; this.mobs.crit = st.crit;
    this.mobs.defense = st.defense; this.mobs.keeperLevel = Math.max(1, Math.floor(level));
    this.mobs.resists = st.resists;
    this.agility = st.moveHaste;
    this.lifeRegen = st.lifeRegen;
  }

  get aura(): SkillId | null { return this.mobs.aura; }
  /** How many raised skeletons walk with the Keeper (the HUD's Release button shows while any do). */
  get raisedCount(): number { return this.mobs.minions.length; }
  /** Let the raised go (they last until killed or released; owner 2026-10-20). */
  releaseRaised(): number { return this.mobs.releaseMinions(); }
  /** A level gained (the HUD calls it): a column of warm light rises on the Keeper; taller and longer for a big milestone. */
  levelPillar(big = false): void {
    this.mobs.effects.push({ kind: 'pillar', x: this.player.x, y: this.player.y, age: 0, life: big ? 1.8 : 1.3, dir: big ? 2 : 1 });
  }
  get ward(): number { return this.mobs.ward; }
  /** The Spellbook's choices: the bar (up to four actives) and the running aura. */
  setSkillLoadout(bar: readonly string[], aura: string | null): void {
    const ok = bar.filter((id): id is SkillId => id in SKILLS && SKILLS[id as SkillId].kind === 'active').slice(0, 4);
    if (ok.length) this.bar = ok;
    this.mobs.aura = aura && aura in SKILLS && SKILLS[aura as SkillId].kind === 'aura' ? aura as SkillId : null;
  }
  get hasted(): boolean { return this.mobs.haste > 0; }
  /**
   * A drink from the potion belt (the host consumed the potion; potions.model.ts potionEffect): life and mana pour in
   * over `secs` (a gentle fill), or at once when `secs` is 0. A green sparkle rises and the amount floats up.
   */
  drinkPotion(heal: number, mana: number, secs: number): void {
    const p = this.player;
    this.mobs.effects.push({ kind: 'heal', x: p.x, y: p.y, age: 0, life: .7, dir: 1 });
    if (heal > 0) this.mobs.floaters.push({ x: p.x - 6, y: p.y - 36, text: `+${Math.round(heal)}`, color: '#7fe08a', age: 0 });
    if (mana > 0) this.mobs.floaters.push({ x: p.x + 6, y: p.y - 30, text: `+${Math.round(mana)}`, color: '#7fb8ff', age: 0 });
    if (secs <= 0) { this.pour(heal, mana); return; }
    this.sip = { hp: this.sip.hp + heal, mana: this.sip.mana + mana, t: secs };
  }
  private pour(heal: number, mana: number): void {
    this.hp = Math.min(this.maxHp, this.hp + heal);
    this.mobs.mana = Math.min(this.mobs.maxMana, this.mobs.mana + mana);
  }

  private say(key: string): void { this.messageKey = key; this.message = key; this.messageAge = 0; }

  // ── Woodcutting ────────────────────────────────────────────────────────────

  /** A standing tree beside the Keeper (surface only). */
  private treeNear(): { c: number; r: number; x: number; y: number } | null {
    if (this.level !== this.world) return null;
    const pc = Math.floor(this.player.x / TILE), pr = Math.floor((this.player.y - 1) / TILE);
    let best: { c: number; r: number; x: number; y: number } | null = null, bd = 26;
    for (let r = pr - 2; r <= pr + 2; r++) for (let c = pc - 2; c <= pc + 2; c++) {
      const o = this.world.treeAt(c, r);
      if (!o) continue;
      const d = Math.hypot(o.x - this.player.x, o.y - this.player.y);
      if (d < bd) { bd = d; best = { c, r, x: o.x, y: o.y }; }
    }
    return best;
  }
  private startChop(c: number, r: number, x: number, y: number): void {
    this.chop = { c, r, x, y, hits: 0, t: 0 };
    this.player.face = x < this.player.x ? -1 : 1;
  }
  private updateChop(dt: number): void {
    const ch = this.chop;
    if (!ch) return;
    ch.t -= dt;
    if (ch.t > 0) return;
    ch.t = .55;
    ch.hits++;
    this.actT = .3; this.player.dir = 'side'; this.player.face = ch.x < this.player.x ? -1 : 1;
    this.shake = .15;
    this.mobs.chips(ch.x, ch.y - 12);
    if (ch.hits < 4) return;
    // Felled: the host books Woodcutting XP and the bark (a roll) like any trunk in the old hunts.
    const bark = Math.random() < .6;
    const ok = this.options.onWorldAction?.({
      kind: 'chop', areaId: 'ember-quarry', cellKey: `${ch.c},${ch.r}`, discipline: 'woodcutting', xp: 4,
      mutationId: `td-chop:${ch.c},${ch.r}:${Date.now().toString(36)}`, site: 'td-tree',
      ...(bark ? { materialId: 'world-root-bark', qty: 1 } : {}),
    } as Parameters<NonNullable<EngineOptions['onWorldAction']>>[0]);
    if (ok !== false) this.world.fell(ch.c, ch.r, 90_000);
    this.chop = null;
  }
  /** Use a stall: the seam, the forge and the beacon are the play view's own deeds (onInteract); the rest open. */
  private use(s: TdStall): void {
    const id = s.station.id;
    // A town task giver's spot (one standing on their own, or beside a keeper's counter): the host opens the talk.
    if (id.startsWith('giver-') && s.keeper && this.options.onTalk?.(s.keeper.id)) return;
    // Down the mine shaft: the hand-drawn Ember Mine (never the old 2D Delve).
    if (id === 'delve' && this.level === this.world) { this.enter(this.handLevel('ember-mine-1'), 'mine-up'); return; }
    // A door into a building: its ground floor.
    if (this.level === this.world && DOORS[id]) { this.enter(this.handLevel(DOORS[id].to), DOORS[id].arrive); return; }
    // A way on from the continent: a cave mouth into its hand-drawn level, a ship to another continent.
    if (this.level === this.world) {
      const way = this.world.ways.get(id);
      if (way) { if (way.ship) this.sail(way.to, way.arrive); else this.enter(this.handLevel(way.to), way.arrive); return; }
    }
    if (this.level instanceof HandLevel) {
      // A ladder, stairs or a hole: to the level it names, in front of its own way back.
      const exit = this.level.exits.get(id);
      if (exit) { this.enter(exit.to === 'surface' ? this.world : this.handLevel(exit.to), exit.arrive); return; }
    }
    if (id === 'ore' || id === 'forge' || id === 'beacon') this.options.onInteract?.(id);
    else this.options.onStation?.(s.station);
  }
  get inTown(): boolean { return true; }
  // The side view's queries the HUD dereferences: real answers, never the Proxy's undefined (a crash in onState froze the loop).
  pick(clientX: number, clientY: number): { x: number; y: number; station: StationDef | null } {
    const w = this.toWorld(clientX, clientY);
    return { x: w.x, y: w.y, station: this.stallAt(w.x, w.y)?.station ?? null };
  }
  /**
   * The Keeper's face for the HUD portrait (owner 2026-10-20: the Top Heroes frame, docs/design/ui-pass-top-heroes.md):
   * the head and shoulders of the front sprite, as a data URL, made once per look.
   */
  heroPortrait(): string {
    const painter = this.player.painter;
    if (!painter || typeof document === 'undefined') return '';
    let url = portraits.get(painter);
    if (url) return url;
    const sheet = frontSheet(painter, true), out = document.createElement('canvas');
    // A 22-px square round the hood and face (the HUD shows it at exactly ×2).
    out.width = out.height = 22;
    out.getContext('2d')!.drawImage(sheet, 3, 1, 22, 22, 0, 0, 22, 22);
    url = out.toDataURL();
    portraits.set(painter, url);
    return url;
  }
  delveAnchors(): readonly never[] { return []; }
  hasDelveCamp(): boolean { return false; }
  readRiftMap(): boolean { return false; }
  get places(): readonly StationDef[] { return this.level.stalls.map(s => s.station); }
  private readonly mapImages = new Map<string, { url: string; x0: number; y0: number; w: number; h: number }>();
  /**
   * The Map window (owner 2026-10-20: "take that Places UI out, create the map and pin point the stuff"): the level the
   * Keeper is on — a hand-drawn floor whole, or the continent's whole region map — painted once from its own ground,
   * with a pin per place to go and the Keeper's mark. Positions are 0..1 across and down the picture.
   */
  mapView(): { url: string; aspect: number; pins: TdMapPin[]; me: { u: number; v: number } } | null {
    if (typeof document === 'undefined') return null;
    const lv = this.level, onWorld = lv === this.world;
    const key = onWorld ? `world:${this.world.continent}` : lv.id;
    let m = this.mapImages.get(key);
    if (!m) {
      const d = this.world.def, step = onWorld ? 2 : 1;
      const box = onWorld
        ? { x0: -d.ox * BLOCK, y0: -d.oy * BLOCK, w: d.map[0].length * BLOCK, h: d.map.length * BLOCK }
        : { x0: 0, y0: 0, w: (lv as HandLevel).cols, h: (lv as HandLevel).rows };
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(box.w / step); cv.height = Math.ceil(box.h / step);
      const c = cv.getContext('2d')!;
      for (let r = 0; r < cv.height; r++) for (let q = 0; q < cv.width; q++) {
        c.fillStyle = MAP_COL[lv.ground(box.x0 + q * step, box.y0 + r * step)] ?? PAL.grass[0];
        c.fillRect(q, r, 1, 1);
      }
      // The towns' roofs, so a settlement reads as one.
      if (onWorld) for (const o of this.world.settlementObjects) {
        if (o.kind !== 'building' || !o.block) continue;
        c.fillStyle = PAL.roofRed[2];
        c.fillRect(Math.round((o.x / TILE - box.x0 - o.block.w / 2) / step), Math.round((o.y / TILE - box.y0 - o.block.h) / step), Math.max(1, Math.round(o.block.w / step)), Math.max(1, Math.round(o.block.h / step)));
      }
      m = { url: cv.toDataURL(), ...box };
      this.mapImages.set(key, m);
    }
    const mm = m;
    const u = (x: number) => (x / TILE - mm.x0) / mm.w, v = (y: number) => (y / TILE - mm.y0) / mm.h;
    const seen = new Set<string>(), pins: TdMapPin[] = [];
    for (const st of lv.stalls) {
      if (seen.has(st.station.id)) continue;
      seen.add(st.station.id);
      const id = st.station.id;
      const kind: TdMapPin['kind'] = id.startsWith('ship') ? 'ship' : id.startsWith('giver-') ? 'npc' : st.station.kind === 'passage' ? 'way' : 'stall';
      pins.push({ id, label: st.station.label, blurb: st.station.blurb ?? '', kind, u: u(st.x), v: v(st.y) });
    }
    return { url: mm.url, aspect: mm.w / mm.h, pins, me: { u: u(this.player.x), v: v(this.player.y) } };
  }
  /** Where the Keeper stands — continent, level (or 'surface'), position — so the HUD can save it and a reload resumes there. */
  get whereabouts(): { continent: string; level: string; x: number; y: number } {
    return { continent: this.world.continent, level: this.level === this.world ? 'surface' : this.level.id, x: Math.round(this.player.x), y: Math.round(this.player.y) };
  }
  /**
   * Put the Keeper back where they last stood (owner 2026-10-20: "not saving in my last location"). Anything unknown —
   * a continent or level that no longer exists — keeps the arrival square; a spot a map change walled in becomes the
   * nearest free one (standNear), never a wall.
   */
  restoreWhereabouts(w: { continent?: unknown; level?: unknown; x?: unknown; y?: unknown }): boolean {
    if (typeof w.continent !== 'string' || typeof w.level !== 'string' || typeof w.x !== 'number' || typeof w.y !== 'number' || !Number.isFinite(w.x) || !Number.isFinite(w.y)) return false;
    const def = CONTINENTS[w.continent];
    if (!def || (w.level !== 'surface' && !LEVELS[w.level])) return false;
    if (w.continent !== this.world.continent) {
      let next = this.continents.get(w.continent);
      if (!next) { next = new TdWorld(def); this.continents.set(w.continent, next); }
      this.world = next; this.map = next.town; this.populate();
    }
    const level = w.level === 'surface' ? this.world : this.handLevel(w.level);
    this.enter(level, '');
    const spot = standNear(level, w.x, w.y);
    if (!footFree(level, spot.x, spot.y)) { this.enter(this.world, ''); this.player.x = this.map.spawn.x; this.player.y = this.map.spawn.y; return false; }
    this.player.x = spot.x; this.player.y = spot.y;
    this.glim.x = this.player.x + 12; this.glim.y = this.player.y - 44;
    this.report();
    return true;
  }
  get settlementKeepers(): readonly { id: string; x: number; y: number; upstairs: boolean; mark: '!' | '?' | null }[] {
    return this.world.stalls.filter(s => s.keeper).map(s => ({ id: s.keeper!.id, x: Math.round(s.keeper!.x), y: Math.round(s.keeper!.y), upstairs: false, mark: this.taskMarks[s.keeper!.id] ?? null }));
  }
  /** The town task givers' head marks (td-only; the side view's setKeeperMarks is another engine's). */
  setTaskMarks(marks: Readonly<Record<string, '!' | '?'>>): void { this.taskMarks = { ...marks };
  }
  get glimView(): { shown: boolean; x: number; targetX: number | null; arrived: boolean; dimmed: boolean; bright: boolean; mood: string; trail: number | null; lamp: number } {
    return { shown: this.glim.shown, x: this.glim.x, targetX: null, arrived: true, dimmed: false, bright: false, mood: 'calm', trail: null, lamp: 0 };
  }
  get petView(): null { return null; }
  get realm(): null { return null; }
  get placeable(): null { return null; }
  /** Walk to a station and open it on arrival (`instant`: stand there now). */
  goToStation(id: string, instant = false): boolean {
    // The nearest of its kind (a floor has many seams of one ore).
    let s: TdStall | undefined, best = Infinity;
    for (const st of this.level.stalls) if (st.station.id === id) { const d = Math.hypot(st.x - this.player.x, st.y - this.player.y); if (d < best) { best = d; s = st; } }
    if (!s) return false;
    // Instant (reduced motion, a deep link): stand there and use it, as the side view's travel did.
    // In front of it, or the nearest free spot (a stair against the back wall has no "in front").
    const spot = standNear(this.level, s.x, s.y + 10);
    if (instant) { this.player.x = spot.x; this.player.y = spot.y; this.path = []; this.use(s); return true; }
    return this.walkTo(spot.x, spot.y, () => this.use(s));
  }
  moveTo(x: number, onArrive?: () => void): boolean { return this.walkTo(x, this.player.y, onArrive); }

  private handLevel(id: string): HandLevel {
    let lv = this.levels.get(id);
    if (!lv) { lv = new HandLevel(LEVELS[id] ?? EMBER_MINE_1); this.levels.set(id, lv); }
    return lv;
  }
  /** Sail to another continent: its surface becomes the world, its town's people come out, the Keeper steps ashore. */
  private sail(to: string, arrive: string): void {
    const def = CONTINENTS[to];
    if (!def) { this.say('play.td.soon.place'); return; }
    let next = this.continents.get(to);
    if (!next) { next = new TdWorld(def); this.continents.set(to, next); }
    this.world = next;
    this.map = next.town;
    this.populate();
    this.enter(next, arrive);
    this.say('play.td.sailed');
  }

  /** Change level: stand in front of `at` (a station on the new level), drop the old level's baked ground. */
  private enter(level: TdLevel, at: string): void {
    this.level = level;
    this.chunks.clear();
    this.path = []; this.arrive = null; this.puffs = [];
    this.mobs.enterLevel(level === this.world ? [] : level.spawnsIn(-1e6, -1e6, 1e6, 1e6));
    // In front of the way in, or the nearest free spot to it: never inside a wall (standNear, td-level.ts).
    const s = level.stalls.find(st => st.station.id === at);
    if (s) { const spot = standNear(level, s.x, s.y + 10); this.player.x = spot.x; this.player.y = spot.y; }
    this.player.dir = 'down';
    this.glim.x = this.player.x + 12; this.glim.y = this.player.y - 44;
    this.report();
  }

  /** A creature's bite. At zero the Keeper wakes in the square, whole (a cozy fall: nothing is lost). */
  private hurt(n: number): void {
    this.hp = Math.max(0, this.hp - n);
    this.lastHurt = this.time;
    if (this.hp > 0) return;
    this.hp = this.maxHp;
    this.say('play.td.fell');
    this.enter(this.world, '');
    this.player.x = this.map.spawn.x; this.player.y = this.map.spawn.y;
    this.mobs.target = null;
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  private update(dt: number): void {
    this.time += dt;
    let vx = 0, vy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) vx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) vx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) vy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) vy += 1;
    if (this.joy?.active) {
      const dx = this.joy.x - this.joy.sx, dy = this.joy.y - this.joy.sy, len = Math.hypot(dx, dy);
      if (len > 6) { const k = Math.min(1, len / 48); vx = dx / len * k; vy = dy / len * k; }
    }
    if (vx || vy) { this.path = []; this.chop = null; }
    else if (this.path.length) {
      const p = this.path[0], dx = p.x - this.player.x, dy = p.y - this.player.y, d = Math.hypot(dx, dy);
      // No headway on this step for half a second (an edge the feet catch on): count it reached, never grind a wall.
      if (d < this.pathBest - .5) { this.pathBest = d; this.pathStall = 0; } else this.pathStall += dt;
      if (d < 3 || (this.pathStall > .5 && d < TILE * 1.5)) {
        this.path.shift(); this.pathBest = Infinity; this.pathStall = 0;
        if (!this.path.length) { const go = this.arrive; this.arrive = null; go?.(); }
      } else if (this.pathStall > 1.5) { this.path = []; this.arrive = null; this.pathBest = Infinity; this.pathStall = 0; }
      else { vx = dx / d; vy = dy / d; }
    }
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    this.player.moving = len > .05;
    if (this.player.moving) {
      if (Math.abs(vx) > .2) this.player.face = vx < 0 ? -1 : 1;
      // Mostly vertical: show the face (south) or the back (north); otherwise the side view.
      this.player.dir = Math.abs(vy) > Math.abs(vx) * 1.2 ? (vy > 0 ? 'down' : 'up') : 'side';
      const speed = SPEED * (this.mobs.haste > 0 ? 1.5 : 1) * (1 + this.agility);
      this.tryMove(vx * speed * dt, 0);
      this.tryMove(0, vy * speed * dt);
    }
    // Glim drifts to the Keeper's shoulder.
    const gx = this.player.x + this.player.face * -16, gy = this.player.y - 48 + Math.sin(this.time * 2.4) * 3;
    this.glim.x += (gx - this.glim.x) * Math.min(1, dt * 4);
    this.glim.y += (gy - this.glim.y) * Math.min(1, dt * 4);
    this.updateFolk(dt);
    // Keepers breathe and turn toward the Keeper when near.
    for (const k of this.keepers) { k.t += dt; if (Math.abs(this.player.x - k.x) < 120) k.face = this.player.x < k.x ? -1 : 1; }
    // The nearest stall within reach (the HUD's prompt and E).
    let best: TdStall | null = null, bestD = REACH;
    for (const s of this.level.stalls) {
      const d = Math.hypot(this.player.x - s.x, this.player.y - (s.y + 10));
      if (d < bestD) { best = s; bestD = d; }
    }
    this.nearby = best;
    this.updateSmoke(dt);
    this.updateFight(dt);
    this.updateFx(dt);
    this.updateLoot(dt);
    this.updateChop(dt);
    this.actT = Math.max(0, this.actT - dt); this.shake = Math.max(0, this.shake - dt);
    // A line of the engine's own (a fall) fades from the HUD after a few seconds.
    if (this.message || this.messageKey) { this.messageAge += dt; if (this.messageAge > 4) { this.message = ''; this.messageKey = ''; this.messageAge = 0; } }
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) { this.stateTimer = .1; this.report(); }
  }

  private tryMove(dx: number, dy: number): void {
    const p = this.player, nx = p.x + dx, ny = p.y + dy;
    if (this.free(nx, ny)) { p.x = nx; p.y = ny; return; }
    // Blocked: slide round the corner (owner 2026-10-20: "getting stuck in places"). If a small sidestep along the
    // other axis would clear the way, take a step of it now, so the Keeper glides past an edge instead of stopping.
    const step = Math.max(Math.abs(dx), Math.abs(dy));
    for (const off of [2, 4, 6, 8]) for (const side of [-1, 1]) {
      if (dx && !dy && this.free(nx, p.y + side * off)) { const move = side * Math.min(step, off); if (this.free(p.x, p.y + move)) { p.y += move; return; } }
      if (dy && !dx && this.free(p.x + side * off, ny)) { const move = side * Math.min(step, off); if (this.free(p.x + move, p.y)) { p.x += move; return; } }
    }
  }
  private free(x: number, y: number): boolean { return footFree(this.level, x, y); }

  private report(): void {
    const s = this.nearby;
    const state: EngineState = {
      hp: Math.round(this.hp), enemyHp: 0, nearby: s ? s.station.id : this.treeNear() ? 'td-tree' : null,
      nearbyLabel: s ? s.station.label : this.treeNear() ? 'CHOP TREE' : undefined, nearbyKind: s?.station.kind ?? (this.treeNear() ? 'resource' : undefined),
      x: Math.round(this.player.x), y: Math.round(this.player.y),
      area: this.level.placeName(this.player.x, this.player.y), areaId: 'infernal', facing: this.player.face,
      animation: this.player.moving ? 'run' : 'idle', delve: false, coins: 0, kills: 0,
      paused: this.paused, defeated: false, enemyDefeated: false, complete: false, message: this.message, ...(this.messageKey ? { messageKey: this.messageKey } : {}),
    };
    this.options.onState(state);
  }

  // ── Walking to a point (A* over the tile grid, 8-way, no corner cutting) ──

  private walkTo(x: number, y: number, onArrive?: () => void): boolean {
    const route = this.route(this.player.x, this.player.y, x, y);
    if (!route) return false;
    this.path = route; this.arrive = onArrive ?? null; this.pathBest = Infinity; this.pathStall = 0;
    if (!route.length) { this.arrive = null; onArrive?.(); }
    return true;
  }
  private route(fx: number, fy: number, tx: number, ty: number): { x: number; y: number }[] | null {
    // The world has no edge: tiles are keyed by an offset pair, and the search gives up past a few thousand tiles.
    const K = 0x10000, O = 0x8000;
    const key = (c: number, r: number) => (c + O) * K + (r + O);
    const colOf = (k: number) => Math.floor(k / K) - O, rowOf = (k: number) => (k % K) - O;
    const at = (x: number, y: number) => [Math.floor(x / TILE), Math.floor((y - 1) / TILE)] as const;
    const [sc, sr] = at(fx, fy);
    let [ec, er] = at(tx, ty);
    const ok = (c: number, r: number) => this.level.walkable(c, r);
    if (!ok(ec, er)) {
      // Nearest walkable tile to the target (a tap on a roof or the river).
      let best: [number, number] | null = null, bd = 1e9;
      for (let r = er - 4; r <= er + 4; r++) for (let c = ec - 4; c <= ec + 4; c++) if (ok(c, r)) { const d = (c - ec) ** 2 + (r - er) ** 2; if (d < bd) { bd = d; best = [c, r]; } }
      if (!best) return null;
      [ec, er] = best;
    }
    const start = key(sc, sr), goal = key(ec, er);
    const g = new Map<number, number>([[start, 0]]), from = new Map<number, number>();
    const open: [number, number][] = [[0, start]];
    const h = (k: number) => Math.hypot(colOf(k) - ec, rowOf(k) - er);
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [, cur] = open.shift()!;
      if (cur === goal) break;
      const cc = colOf(cur), cr = rowOf(cur);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = cc + dc, nr = cr + dr;
        if (!ok(nc, nr) || (dc && dr && (!ok(cc + dc, cr) || !ok(cc, cr + dr)))) continue;
        const ni = key(nc, nr), ng = g.get(cur)! + (dc && dr ? 1.414 : 1);
        if (ng < (g.get(ni) ?? Infinity)) { g.set(ni, ng); from.set(ni, cur); open.push([ng + h(ni), ni]); }
      }
      if (g.size > 4000) break;
    }
    if (!g.has(goal)) return null;
    const pts: { x: number; y: number }[] = [];
    for (let k = goal; k !== start; k = from.get(k)!) pts.unshift({ x: colOf(k) * TILE + TILE / 2, y: rowOf(k) * TILE + TILE - 2 });
    // End on the exact spot asked for only when the feet fit there; else the last free tile's centre.
    if (pts.length && footFree(this.level, tx, ty)) pts[pts.length - 1] = { x: tx, y: ty };
    return pts;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private bindInput(): void {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || this.paused) return;
      // Space, Enter and E on a focused button or link press it (a banner, a menu), never the world's attack or use.
      if ((k === ' ' || k === 'enter' || k === 'e') && (e.target as HTMLElement | null)?.closest?.('button, a, [role="button"], [contenteditable]')) return;
      // E opens the stall in reach (the side view handled E inside its own engine).
      if (down && !e.repeat && (k === 'e' || k === 'enter') && this.nearby) { e.preventDefault(); this.interact(); return; }
      if (k === 'j' || k === ' ') { e.preventDefault(); this.mobs.attacking = down; return; }
      if (/^[1-4]$/.test(k)) { if (down && !e.repeat) { const why = this.useAbility(k); if (why) this.say(`play.td.ability.${why}`); } return; }
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
      if (down) { this.keys.add(k); this.path = []; } else this.keys.delete(k);
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    this.unbind.push(() => window.removeEventListener('keydown', kd), () => window.removeEventListener('keyup', ku));
    const c = this.canvas;
    const down = (e: PointerEvent) => {
      if (this.paused) return;
      this.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, active: false };
      try { c.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    };
    const move = (e: PointerEvent) => {
      if (!this.joy || this.joy.id !== e.pointerId) return;
      this.joy.x = e.clientX; this.joy.y = e.clientY;
      if (Math.hypot(e.clientX - this.joy.sx, e.clientY - this.joy.sy) > 12) { this.joy.active = true; this.path = []; }
    };
    const up = (e: PointerEvent) => {
      if (!this.joy || this.joy.id !== e.pointerId) return;
      const tap = !this.joy.active;
      this.joy = null;
      if (tap) this.tap(e.clientX, e.clientY);
    };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    this.unbind.push(() => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); });
  }
  /** A tap: on a stall or its keeper walks there and opens it; anywhere else walks there. */
  private toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: this.cam.x + (clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width)) / this.scale,
      y: this.cam.y + (clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height)) / this.scale,
    };
  }
  private stallAt(wx: number, wy: number): TdStall | undefined {
    // A tap on a task giver's body talks to them (a stall keeper's counter still opens the stall).
    const giver = this.level.stalls.find(s => s.keeper && s.station.id.startsWith('giver-') && Math.abs(wx - s.keeper.x) < 10 && wy > s.keeper.y - 34 && wy < s.keeper.y + 2);
    if (giver) return giver;
    return this.level.stalls.find(s => Math.abs(wx - s.x) < 34 && wy > s.y - 46 && wy < s.y + 16);
  }
  private tap(clientX: number, clientY: number): void {
    const { x: wx, y: wy } = this.toWorld(clientX, clientY);
    // A creature under the finger is the target (Tibia's click-to-attack): the Keeper closes in and swings.
    const foe = this.mobs.mobAt(wx, wy);
    if (foe) { this.mobs.target = foe; this.chaseTimer = 0; return; }
    this.mobs.target = null;
    if (this.level === this.world) {
      const tc = Math.floor(wx / TILE), tr = Math.floor((wy + 6) / TILE);
      for (const [c, r] of [[tc, tr], [tc, tr + 1], [tc, tr + 2]]) {
        const o = this.world.treeAt(c, r);
        if (o) { this.walkTo(o.x, o.y + 12, () => this.startChop(c, r, o.x, o.y)); return; }
      }
    }
    const hit = this.stallAt(wx, wy);
    if (hit) { this.walkTo(hit.x, hit.y + 10, () => this.use(hit)); return; }
    this.walkTo(wx, wy);
  }

  // ── Minimap (the round compass in the HUD's top-right, like the references) ──

  /** Draw the town round the Keeper into a small square canvas (the HUD clips it round). */
  drawMinimap(target: HTMLCanvasElement): void {
    const c = target.getContext('2d');
    if (!c) return;
    const W = target.width, H = target.height, k = Math.max(2, Math.round(W / 24));   // ~24 tiles across
    const span = Math.ceil(W / k / 2) + 1;
    const pc = Math.floor(this.player.x / TILE), pr = Math.floor(this.player.y / TILE);
    const ox = W / 2 - (this.player.x / TILE - pc) * k, oy = H / 2 - (this.player.y / TILE - pr) * k;
    const col: Partial<Record<Ground, string>> = { grass: PAL.grass[0], flowers: PAL.grass[1], dirt: PAL.dirt[0], cobble: PAL.cobble[0], sand: PAL.sand[0], plank: PAL.plank[0], water: PAL.water[0], ember: PAL.ember[0], cave: '#6a564c', rock: '#1d1720', moss: PAL.moss[1], flagstone: PAL.temple[1], vinewall: '#2c3a2c', canopy: PAL.jungle[2], bark: PAL.bark[2] };
    c.imageSmoothingEnabled = false;
    // The ground round the Keeper, sampled from the world each time (it has no edge to pre-paint).
    for (let r = -span; r <= span; r++) for (let q = -span; q <= span; q++) {
      c.fillStyle = col[this.level.ground(pc + q, pr + r)] ?? PAL.grass[0];
      c.fillRect(Math.floor(ox + q * k - k / 2), Math.floor(oy + r * k - k / 2), k, k);
    }
    const toX = (x: number) => Math.round(W / 2 + (x - this.player.x) / TILE * k), toY = (y: number) => Math.round(H / 2 + (y - this.player.y) / TILE * k);
    const reach = span * TILE;
    for (const o of this.level.objectsIn(this.player.x - reach, this.player.y - reach, this.player.x + reach, this.player.y + reach)) {
      if (o.kind !== 'building' && o.kind !== 'tree') continue;
      const w = (o.block?.w ?? 1) * k, h = (o.block?.h ?? 1) * k;
      c.fillStyle = o.kind === 'building' ? PAL.roofRed[2] : PAL.leaf[2];
      c.fillRect(toX(o.x) - Math.floor(w / 2), toY(o.y) - h, w, h);
    }
    const dot = (x: number, y: number, r: number, fill: string) => {
      const sx = toX(x), sy = toY(y);
      c.fillStyle = PAL.outline; c.fillRect(sx - r - 1, sy - r - 1, r * 2 + 2, r * 2 + 2);
      c.fillStyle = fill; c.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    for (const st of this.level.stalls) dot(st.x, st.y, Math.max(1, k >> 1), PAL.glow);
    if (this.level === this.world) for (const kp of this.keepers) if (kp.kid && this.taskMarks[kp.kid]) dot(kp.x, kp.y, Math.max(2, k - 1), this.taskMarks[kp.kid] === '?' ? '#ffd27a' : '#f3e7cf');
    if (this.level === this.world) for (const f of this.folk) { c.fillStyle = 'rgba(42,26,36,.55)'; c.fillRect(toX(f.x), toY(f.y), Math.max(1, k >> 1), Math.max(1, k >> 1)); }
    dot(this.player.x, this.player.y, Math.max(2, k - 1), '#ffffff');
  }

  // ── Fireflies: dusk and night, round the trees and the flower beds (the references' summer evenings) ──

  private drawFireflies(): void {
    const night = Math.max(this.darkness, this.dusk * .6);
    if (night < .25) return;
    const c = this.ctx, s = this.scale, cam = this.cam;
    c.setTransform(1, 0, 0, 1, 0, 0);
    let n = 0;
    for (const o of this.visible) {
      if (o.kind !== 'tree') continue;
      for (let j = 0; j < 3; j++) {
        const seed = (n++ * 7.31) % 6.283;
        const t = this.time * (.35 + (j * .13)) + seed * 3;
        const wx = o.x + Math.sin(t + j) * 18 + Math.sin(t * 2.3) * 4, wy = o.y - 18 - j * 7 + Math.cos(t * .8 + seed) * 10;
        const sx = (wx - cam.x) * s, sy = (wy - cam.y) * s;
        if (sx < -10 || sy < -10 || sx > this.canvas.width + 10 || sy > this.canvas.height + 10) continue;
        const blink = Math.max(0, Math.sin(this.time * (1.7 + j * .4) + seed * 5));
        if (blink < .15) continue;
        c.globalAlpha = blink * Math.min(1, (night - .25) * 2);
        c.fillStyle = '#fff6a8'; c.fillRect(Math.round(sx), Math.round(sy), s, s);
        c.globalAlpha *= .35; c.fillStyle = '#ffd27a'; c.fillRect(Math.round(sx - s), Math.round(sy - s), s * 3, s * 3);
      }
    }
    c.globalAlpha = 1;
  }

  // ── Townsfolk ──────────────────────────────────────────────────────────────

  /** The town's people: its keepers behind their stalls, its townsfolk on its streets. */
  private populate(): void {
    this.keepers.length = 0; this.folk.length = 0; this.streets.length = 0;
    // Every keeper on the continent: the capital's stalls and the villages' own (Cinderport, Ashgrove…).
    const seen = new Set<string>();
    for (const s of this.world.stalls) {
      // One person per keeper (a stall keeper who gives tasks has a second spot to talk from, beside the counter).
      if (!s.keeper || seen.has(s.keeper.id)) continue;
      seen.add(s.keeper.id);
      const npc = NPC_LOOKS[s.keeper.id];
      // A giver with no portrait of their own gets a look seeded by their id (the same face every visit).
      let h = 0; for (const ch of s.keeper.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
      const rand = () => { h = (h + 0x6D2B79F5) >>> 0; let t = Math.imul(h ^ (h >>> 15), h | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const painter = npc ? new KeeperPainter(npc.look, npc.gear, npc.garb) : new KeeperPainter(randomLook(rand));
      this.keepers.push({ painter, x: s.keeper.x, y: s.keeper.y, face: 1, dir: 'down', name: s.keeper.name, moving: false, t: Math.random() * 4, kid: s.keeper.id });
    }
    this.spawnFolk();
  }
  private spawnFolk(): void {
    const m = this.map;
    for (let i = 0; i < m.ground.length; i++) {
      const g = m.ground[i];
      if (m.walkable[i] && (g === 'cobble' || g === 'plank' || g === 'dirt')) this.streets.push(i);
    }
    if (!this.streets.length) return;
    // Seeded, so the square looks the same on every visit (and in every screenshot).
    let a = 0x5eed;
    const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let n = 0; n < FOLK; n++) {
      const i = this.streets[Math.floor(rand() * this.streets.length)];
      const x = (i % m.cols) * TILE + TILE / 2, y = Math.floor(i / m.cols) * TILE + TILE - 2;
      // Not on top of the Keeper's arrival spot.
      if (Math.hypot(x - m.spawn.x, y - m.spawn.y) < 40) { n--; continue; }
      this.folk.push({ painter: new KeeperPainter(randomLook(rand)), x, y, face: rand() < .5 ? -1 : 1, dir: 'down', moving: false, t: rand() * 4, path: [], wait: rand() * 4 });
    }
  }
  private updateFolk(dt: number): void {
    const m = this.map;
    for (const f of this.folk) {
      f.t += dt;
      if (!f.path.length) {
        f.moving = false;
        f.wait -= dt;
        if (f.wait > 0) continue;
        // Somewhere new: often a stall (browsing the market), otherwise any street within a few tiles' stroll.
        let tx: number, ty: number;
        if (Math.random() < .35 && m.stalls.length) { const s = m.stalls[Math.floor(Math.random() * m.stalls.length)]; tx = s.x + (Math.random() * 24 - 12); ty = s.y + 12; }
        else { const i = this.streets[Math.floor(Math.random() * this.streets.length)]; tx = (i % m.cols) * TILE + TILE / 2; ty = Math.floor(i / m.cols) * TILE + TILE - 2; }
        if (Math.hypot(tx - f.x, ty - f.y) > 260) { f.wait = .5; continue; }
        f.path = this.route(f.x, f.y, tx, ty) ?? [];
        f.wait = 1.5 + Math.random() * 4;
        if (!f.path.length) continue;
      }
      const p = f.path[0], dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
      if (d < 2) { f.path.shift(); if (!f.path.length) { f.moving = false; f.dir = 'down'; } continue; }
      const vx = dx / d, vy = dy / d, step = Math.min(d, FOLK_SPEED * dt);
      f.x += vx * step; f.y += vy * step; f.moving = true;
      if (Math.abs(vx) > .2) f.face = vx < 0 ? -1 : 1;
      f.dir = Math.abs(vy) > Math.abs(vx) * 1.2 ? (vy > 0 ? 'down' : 'up') : 'side';
    }
  }

  // ── The fight ──────────────────────────────────────────────────────────────

  private updateFight(dt: number): void {
    // The endless surface hands over the spawns round the Keeper as they come into reach, and forgets far ones.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.level === this.world) {
      this.spawnTimer = .5;
      const r = 420;
      this.mobs.addSpawns(this.world.spawnsIn(this.player.x - r, this.player.y - r, this.player.x + r, this.player.y + r));
      this.mobs.prune(900);
    }
    // Chasing a target (Tibia): walk into reach of it, re-aimed as it moves.
    const t = this.mobs.target;
    this.chaseTimer -= dt;
    if (t && this.chaseTimer <= 0 && !this.keys.size && !this.joy?.active) {
      this.chaseTimer = .4;
      // Close in only to the staff's range (a Warlock fights from a distance).
      if (Math.hypot(t.x - this.player.x, t.y - this.player.y) > this.mobs.range - 12) { const route = this.route(this.player.x, this.player.y, t.x, t.y); if (route) { this.path = route; this.arrive = null; } }
      else this.path = [];
    }
    this.mobs.update(dt);
    // A potion pouring in: its share of what is left this frame.
    if (this.sip.t > 0) {
      const f = Math.min(1, dt / this.sip.t), h = this.sip.hp * f, m = this.sip.mana * f;
      this.pour(h, m);
      this.sip = f >= 1 ? { hp: 0, mana: 0, t: 0 } : { hp: this.sip.hp - h, mana: this.sip.mana - m, t: this.sip.t - dt };
    }
    // Out of the fight a while: the Keeper mends.
    if (this.hp < this.maxHp && this.time - this.lastHurt > 4) this.hp = Math.min(this.maxHp, this.hp + 6 * dt);
    if (this.lifeRegen > 0 && this.hp > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.lifeRegen * dt);
  }

  // ── Smoke ──────────────────────────────────────────────────────────────────

  private updateSmoke(dt: number): void {
    for (const p of this.puffs) { p.age += dt; p.y -= 9 * dt; p.x += Math.sin(p.age * 1.6 + p.r) * 3 * dt + 2 * dt; }
    this.puffs = this.puffs.filter(p => p.age < p.life);
    if (this.puffs.length > 60) return;
    for (const o of this.visible) {
      const s = o.sprite();
      for (const m of s.smoke ?? []) if (Math.random() < dt * 1.4) this.puffs.push({ x: o.x + m.x, y: o.y + m.y, age: 0, life: 2.8 + Math.random(), r: Math.random() * 6 });
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    // 1.5 CSS px per art px on phones (~16 tiles across), 2 on tablets, 3 on wide screens; whole device pixels so pixels stay crisp.
    const css = this.canvas.clientWidth >= 1100 ? 3 : this.canvas.clientWidth >= 700 ? 2 : 1.5;
    this.scale = Math.max(1, Math.round(css * dpr));
    this.cam.w = w / this.scale; this.cam.h = h / this.scale;
    // No edge to clamp to: the world runs on in every direction.
    this.cam.x = Math.round(this.player.x - this.cam.w / 2);
    this.cam.y = Math.round(this.player.y - 20 - this.cam.h / 2);
  }

  private chunk(cx: number, cy: number, frame: number): HTMLCanvasElement {
    const key = `${cx},${cy}`;
    let frames = this.chunks.get(key);
    if (!frames) {
      frames = [];
      const kind = (c: number, r: number): Ground => this.level.ground(c, r);
      let liquid = false;
      for (let r = cy * CHUNK; r < (cy + 1) * CHUNK; r++) for (let c = cx * CHUNK; c < (cx + 1) * CHUNK; c++) if (kind(c, r) === 'water' || kind(c, r) === 'ember') liquid = true;
      for (let f = 0; f < (liquid ? 4 : 1); f++) {
        const el = document.createElement('canvas');
        el.width = CHUNK * TILE; el.height = CHUNK * TILE;
        const g = el.getContext('2d')!;
        for (let r = cy * CHUNK; r < (cy + 1) * CHUNK; r++) for (let c = cx * CHUNK; c < (cx + 1) * CHUNK; c++) {
          const ox = (c - cx * CHUNK) * TILE, oy = (r - cy * CHUNK) * TILE, k = kind(c, r);
          paintGround(g, k, c, r, ox, oy, f);
          paintEdge(g, k, kind(c, r - 1), 'n', c, r, ox, oy);
          paintEdge(g, k, kind(c, r + 1), 's', c, r, ox, oy);
          paintEdge(g, k, kind(c - 1, r), 'w', c, r, ox, oy);
          paintEdge(g, k, kind(c + 1, r), 'e', c, r, ox, oy);
        }
        frames.push(el);
      }
      this.chunks.set(key, frames);
      // Far chunks go (the world never ends; their canvases must not pile up).
      if (this.chunks.size > 96) this.chunks.delete(this.chunks.keys().next().value!);
    }
    return frames[((frame % frames.length) + frames.length) % frames.length];
  }

  private draw(): void {
    this.resize();
    const c = this.ctx, s = this.scale, cam = this.cam;
    c.imageSmoothingEnabled = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2a1a24'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    // Ground.
    const frame = Math.floor(this.time * 3) % 4;
    const span = CHUNK * TILE;
    for (let cy = Math.floor(cam.y / span); cy <= Math.floor((cam.y + cam.h) / span); cy++) {
      for (let cx = Math.floor(cam.x / span); cx <= Math.floor((cam.x + cam.w) / span); cx++) {
        c.drawImage(this.chunk(cx, cy, frame), cx * span, cy * span);
      }
    }
    // Ground effects (aura rings, nova waves, sigils): under every creature and the Keeper.
    this.drawGroundFx();
    // Y-sorted world: objects, keepers, the Keeper, Glim.
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    const inView = (x: number, y: number, pad = 80) => x > cam.x - pad && x < cam.x + cam.w + pad && y > cam.y - pad && y < cam.y + cam.h + pad * 2;
    const roofs: { o: TdObject; sp: Sprite }[] = [];
    const visible = this.level.objectsIn(cam.x - 120, cam.y - 80, cam.x + cam.w + 120, cam.y + cam.h + 240);
    this.visible = visible;
    for (const o of visible) {
      const sp = o.sprite();
      const jig = this.chop && this.shake > 0 && o.kind === 'tree' && o.x === this.chop.x && o.y === this.chop.y ? Math.round(Math.sin(this.time * 70) * 1.5) : 0;
      items.push({ y: o.y, draw: () => c.drawImage(sp.img, Math.round(o.x - sp.ax) + jig, Math.round(o.y - sp.ay)) });
      if (sp.roof) roofs.push({ o, sp });
    }
    const surface = this.level === this.world;
    for (const k of this.keepers) if (surface && inView(k.x, k.y)) items.push({ y: k.y, draw: () => this.drawPerson(k, 'idle') });
    for (const f of this.folk) if (surface && inView(f.x, f.y)) items.push({ y: f.y, draw: () => this.drawPerson(f, f.moving ? 'walk' : 'idle') });
    for (const g of this.groundLoot()) if (inView(g.x, g.y)) items.push({ y: g.y - 6, draw: () => this.drawDrop(g) });
    for (const m of this.mobs.mobs) if (inView(m.x, m.y)) items.push({ y: m.y, draw: () => this.drawMob(m) });
    for (const k of this.mobs.minions) if (inView(k.x, k.y)) items.push({ y: k.y, draw: () => this.drawRaised(k) });
    items.push({ y: this.player.y, draw: () => this.drawPerson(this.player, this.player.moving ? 'run' : 'idle') });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    // Roofs and crowns, faded when the Keeper is behind or under them.
    for (const { o, sp } of roofs) {
      const r = sp.roof!;
      const x0 = o.x + r.x, y0 = o.y + r.y, x1 = x0 + r.img.width, y1 = y0 + r.img.height;
      const under = this.player.x > x0 + 2 && this.player.x < x1 - 2 && this.player.y - 20 > y0 && this.player.y - 20 < y1 + 4 && this.player.y < o.y;
      c.globalAlpha = under ? .32 : 1;
      c.drawImage(r.img, Math.round(x0), Math.round(y0));
      c.globalAlpha = 1;
    }
    // Smoke.
    for (const p of this.puffs) {
      const t = p.age / p.life;
      c.globalAlpha = (1 - t) * .55;
      c.fillStyle = '#e9e4ef';
      const r = 2 + t * 5;
      c.fillRect(Math.round(p.x - r / 2), Math.round(p.y - r / 2), Math.round(r), Math.round(r));
    }
    c.globalAlpha = 1;
    // Glim: a small warm light with a pixel core.
    c.fillStyle = '#fff4c2'; c.fillRect(Math.round(this.glim.x) - 1, Math.round(this.glim.y) - 1, 3, 3);
    c.fillStyle = '#ffd27a'; c.fillRect(Math.round(this.glim.x) - 2, Math.round(this.glim.y), 1, 1); c.fillRect(Math.round(this.glim.x) + 2, Math.round(this.glim.y), 1, 1);
    // Night.
    this.drawLight();
    this.drawFireflies();
    // The drag joystick: a ring where the thumb landed and a knob under it (screen space).
    if (this.joy?.active) {
      const r = this.canvas.getBoundingClientRect(), k = this.canvas.width / Math.max(1, r.width);
      const sx = (this.joy.sx - r.left) * k, sy = (this.joy.sy - r.top) * k;
      let dx = (this.joy.x - this.joy.sx) * k, dy = (this.joy.y - this.joy.sy) * k;
      const max = 48 * k, len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = .5; c.strokeStyle = '#f3e7cf'; c.lineWidth = 3 * k;
      c.beginPath(); c.arc(sx, sy, max, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = .75; c.fillStyle = '#f3e7cf';
      c.beginPath(); c.arc(sx + dx, sy + dy, 18 * k, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
    // World UI: name plates for keepers, the label of the stall in reach.
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (const k of this.keepers) if (this.level === this.world && k.name && inView(k.x, k.y) && Math.hypot(this.player.x - k.x, this.player.y - k.y) < 90) this.plate(k.name, k.x, k.y - 42, '#f3e7cf');
    // A task giver's head mark: '!' a task on offer, '?' one to hand in (MapleStory), seen from across the square.
    for (const k of this.keepers) { const m = k.kid ? this.taskMarks[k.kid] : undefined; if (m && this.level === this.world && inView(k.x, k.y)) this.headMark(m, k.x, k.y - (Math.hypot(this.player.x - k.x, this.player.y - k.y) < 90 ? 54 : 44)); }
    this.drawEffects();
    this.drawFightUi(inView);
    // A giver standing on their own already wears their name: no second plate.
    if (this.nearby && !this.nearby.station.id.startsWith('giver-')) this.plate(this.nearby.station.label, this.nearby.x, this.nearby.y - (this.nearby.keeper ? 62 : 36), '#ffd27a');
  }
  /** A pixel speech mark over a head: a brass bubble with '!' or '?', bobbing a little (still under reduced motion). */
  private headMark(mark: '!' | '?', x: number, y: number): void {
    const c = this.ctx, bob = this.still ? 0 : Math.round(Math.sin(this.time * 3) * 1.5);
    const bx = Math.round(x) - 5, by = Math.round(y) - 12 + bob;
    c.fillStyle = PAL.outline; c.fillRect(bx - 1, by - 1, 12, 13); c.fillRect(bx + 4, by + 12, 3, 2);
    c.fillStyle = mark === '?' ? '#ffd27a' : '#f3e7cf'; c.fillRect(bx, by, 10, 11);
    c.fillStyle = mark === '?' ? '#c98a2a' : '#d9c7a4'; c.fillRect(bx, by + 9, 10, 2);
    c.fillStyle = PAL.outline;
    c.font = 'bold 9px "Pixelify Sans", monospace';
    c.fillText(mark, bx + 5, by + 10);
  }

  private drawMob(m: Mob): void {
    const c = this.ctx, d = m.def, sheet = mobSheet(d), f = Math.floor(m.t * 6) % Math.max(1, Math.round(sheet.width / d.w));
    c.fillStyle = 'rgba(30,18,26,.3)'; c.fillRect(Math.round(m.x - d.w / 2 + 2), Math.round(m.y - 2), d.w - 4, 3);
    // The target stands in a red pixel square (Tibia).
    if (m === this.mobs.target) { c.strokeStyle = '#ff4a3a'; c.lineWidth = 1; c.strokeRect(Math.round(m.x - d.w / 2) - 2.5, Math.round(m.y - d.h) - 2.5, d.w + 5, d.h + 5); }
    c.save();
    // A floater drifts a little above the floor; a ghost is half there, flickering.
    const lift = d.floats ? Math.round(2 + Math.sin(m.t * 2.4) * 2) : 0;
    c.translate(Math.round(m.x), Math.round(m.y - d.h - lift));
    if (m.face < 0) c.scale(-1, 1);
    if (d.ghost) c.globalAlpha = .62 + Math.sin(m.t * 7 + m.hx) * .14 + (Math.random() < .04 ? -.25 : 0);
    c.drawImage(sheet, f * d.w, 0, d.w, d.h, -Math.floor(d.w / 2), 0, d.w, d.h);
    if (m.hit > 0) { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .7; c.fillStyle = '#ffffff'; c.fillRect(-d.w / 2, 0, d.w, d.h); }
    c.restore();
  }
  /** A skeleton the Keeper raised: violet-eyed bones, a faint violet glow at its feet, its life in a small violet bar. */
  private drawRaised(k: Minion): void {
    const c = this.ctx, d = RAISED_SKELETON, sheet = mobSheet(d), f = Math.floor(k.t * 6) % Math.max(1, Math.round(sheet.width / d.w));
    c.globalAlpha = .35; c.fillStyle = '#b06bff'; c.fillRect(Math.round(k.x - 7), Math.round(k.y - 2), 14, 3); c.globalAlpha = 1;
    c.save();
    // Rising out of the ground for its first half second; fading as its time runs out.
    const rise = Math.max(0, 1 - k.t / .5);
    c.translate(Math.round(k.x), Math.round(k.y - d.h + rise * d.h * .6));
    if (k.face < 0) c.scale(-1, 1);
    if (k.life < 3) c.globalAlpha = .4 + .6 * (k.life / 3);
    c.drawImage(sheet, f * d.w, 0, d.w, Math.round(d.h * (1 - rise * .6)), -Math.floor(d.w / 2), 0, d.w, Math.round(d.h * (1 - rise * .6)));
    if (k.hit > 0) { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = .6; c.fillStyle = '#ffffff'; c.fillRect(-d.w / 2, 0, d.w, d.h); }
    c.restore();
    const w = 14, frac = Math.max(0, k.hp / k.maxHp);
    c.fillStyle = '#1a1014'; c.fillRect(Math.round(k.x - w / 2) - 1, Math.round(k.y - d.h - 5), w + 2, 3);
    c.fillStyle = '#b06bff'; c.fillRect(Math.round(k.x - w / 2), Math.round(k.y - d.h - 4), Math.round(w * frac), 1);
  }
  /** The loot on the ground: the fight's drops, and the screenshot showcase when it is on. */
  private groundLoot(): readonly Drop[] { return this.showcase.length ? [...this.mobs.drops, ...this.showcase] : this.mobs.drops; }
  /**
   * A drop on the ground: a coin pile, a sack, or gear standing in a pixel light column of its rung (spec §Loot) —
   * the rarer the taller, stepped bands (never a gradient), at most 55% over whatever stands behind it; legendary and
   * up carry motes climbing the column. Common gear only glints. The ground ring is drawn under creatures (drawGroundFx).
   */
  private drawDrop(g: Drop): void {
    const c = this.ctx, X = Math.round(g.x), Y = Math.round(g.y), rung = rungOf(g);
    if (rung) {
      const tn = LOOT[rung], beam = lootBeam(rung), seed = this.dropSeed(g);
      const pulse = this.still ? 1 : .85 + .15 * Math.sin(this.time * 2.6 + seed % 7);
      for (const b of beamSteps(beam.h)) {
        // Five pixels wide: an edge-tone halo, a body column, a one-pixel core — each band a step dimmer than the one under it.
        const top = Y - 3 + b.y1, h = b.y0 - b.y1;
        c.globalAlpha = b.a * pulse * .45; c.fillStyle = tn.edge; c.fillRect(X - 2, top, 5, h);
        c.globalAlpha = b.a * pulse; c.fillStyle = tn.body; c.fillRect(X - 1, top, 3, h);
        c.fillStyle = tn.core; c.fillRect(X, top, 1, h);
      }
      if (beam.motes) {
        c.globalAlpha = .55;
        for (const [i, m] of beamMotes(beam.h, beam.motes, this.still ? 1.3 : this.time, seed).entries()) {
          c.fillStyle = i % 2 ? tn.core : tn.body; c.fillRect(X + m.x, Y - 3 + m.y, 1, 1);
        }
      }
      c.globalAlpha = 1;
      // The piece itself: a dark-outlined tile of its colour with a shine.
      c.fillStyle = '#2a1a24'; c.fillRect(X - 4, Y - 6, 9, 5);
      c.fillStyle = tn.edge; c.fillRect(X - 3, Y - 5, 7, 3);
      c.fillStyle = tn.body; c.fillRect(X - 3, Y - 5, 6, 2);
      c.fillStyle = tn.core; c.fillRect(X - 2, Y - 5, 2, 1);
      // A glint: a four-point twinkle that crosses the piece now and then (every drop on its own beat).
      const beat = this.still ? .05 : ((this.time + (seed % 97) / 31) % 2.2) / 2.2;
      if (beat < .12) {
        const big = beat > .03 && beat < .09;
        c.fillStyle = '#ffffff'; c.fillRect(X + 2, Y - 6, 1, 1);
        c.globalAlpha = .8; c.fillStyle = tn.core;
        c.fillRect(X + 1, Y - 6, 1, 1); c.fillRect(X + 3, Y - 6, 1, 1); c.fillRect(X + 2, Y - 7, 1, 1); c.fillRect(X + 2, Y - 5, 1, 1);
        if (big) { c.fillRect(X, Y - 6, 1, 1); c.fillRect(X + 4, Y - 6, 1, 1); c.fillRect(X + 2, Y - 8, 1, 1); }
        c.globalAlpha = 1;
      }
    } else if (g.coins > 0) {
      c.fillStyle = '#2a1a24'; c.fillRect(X - 5, Y - 5, 10, 5); c.fillStyle = '#e8a83a'; c.fillRect(X - 4, Y - 4, 8, 3); c.fillStyle = '#ffd25a'; c.fillRect(X - 3, Y - 5, 3, 2); c.fillRect(X + 1, Y - 4, 2, 1);
    } else {
      c.fillStyle = '#2a1a24'; c.fillRect(X - 4, Y - 8, 8, 8); c.fillStyle = '#a8743f'; c.fillRect(X - 3, Y - 7, 6, 6); c.fillStyle = '#c99657'; c.fillRect(X - 3, Y - 7, 6, 2);
    }
  }
  private dropSeed(g: Drop): number { let h = 0; for (let i = 0; i < g.id.length; i++) h = (h * 31 + g.id.charCodeAt(i)) | 0; return Math.abs(h); }
  /** The top of a drop's column (its label sits just over it). */
  private dropTop(g: Drop): number { const r = rungOf(g); return g.y - 8 - (r ? lootBeam(r).h : 0); }

  /** Loot pops: a burst in its colour as gear lands, a smaller one rising as it is taken; the showcase, when on. */
  private updateLoot(dt: number): void {
    for (const q of this.pops) q.age += dt;
    this.pops = this.pops.filter(q => q.age < q.life);
    // The showcase lies down a second after each arrival, round wherever the Keeper stands.
    if (this.fxLoot && this.showcaseLevel !== this.level) {
      this.showcase = [];
      if ((this.showcaseT += dt) > 1) { this.showcase = this.makeShowcase(); this.showcaseLevel = this.level; this.showcaseT = 0; }
    }
    const p = this.player;
    if (this.seenLevel !== this.level) { this.seenLevel = this.level; this.seenDrops.clear(); for (const g of this.groundLoot()) { const r = rungOf(g); if (r) this.seenDrops.set(g.id, { x: g.x, y: g.y, rung: r }); } return; }
    const now = new Set<string>();
    for (const g of this.groundLoot()) {
      const r = rungOf(g);
      if (!r) continue;
      now.add(g.id);
      if (!this.seenDrops.has(g.id)) this.pops.push({ x: g.x, y: g.y - 3, rung: r, age: 0, life: .4, kind: 'drop', seed: this.dropSeed(g) });
      this.seenDrops.set(g.id, { x: g.x, y: g.y, rung: r });
    }
    for (const [id, g] of this.seenDrops) {
      if (now.has(id)) continue;
      this.seenDrops.delete(id);
      // Taken: it vanished at the Keeper's feet (a drop that lay out its time just goes).
      if (Math.hypot(g.x - p.x, g.y - p.y) < 30) this.pops.push({ x: g.x, y: g.y - 3, rung: g.rung, age: 0, life: .45, kind: 'pick', seed: id.length * 13 });
    }
    if (this.pops.length > 12) this.pops.splice(0, this.pops.length - 12);
    // For the screenshot spec: the canvas says when a pop is in the air.
    const popping = this.pops.length ? 'pop' : '';
    if (popping !== this.popSeen) { this.popSeen = popping; this.canvas.setAttribute('data-loot-pop', popping); }
  }
  private makeShowcase(): Drop[] {
    const p = this.player, rows: [LootRung, string, number, number][] = [
      ['common', 'Worn Cap', -84, 44], ['uncommon', 'Ashwood Staff', -28, 44], ['rare', 'Ember Ring', 28, 44], ['epic', 'Hexed Mantle', 84, 44],
      ['legendary', 'Pyrelord Crown', -60, 104], ['mythic', 'Eclipse Shard', 0, 104], ['singular', 'Void Rune', 60, 104],
    ];
    return rows.map(([rung, label, dx, dy], i) => ({ id: `fx-showcase:${i}`, x: p.x + dx, y: p.y + dy, coins: 0, qty: 0, rarity: rung, label, color: LOOT[rung].body, age: 0 }));
  }

  /** The effects pass's own pixels: an aura's motes (≤ 10 alive), the shards a Dark Ward sheds as it drinks a blow. */
  private updateFx(dt: number): void {
    for (const m of this.motes) m.age += dt;
    this.motes = this.motes.filter(m => m.age < m.life);
    const p = this.player, ward = this.mobs.ward;
    if (ward < this.wardSeen - .5 && !this.still) {
      const shards = this.motes.filter(m => m.kind === 'shard').length;
      for (let i = 0; i < Math.min(SHARDS - shards, 3); i++) {
        const a = Math.random() * Math.PI * 2, x = p.x + Math.cos(a) * 13, y = p.y - 18 + Math.sin(a) * 18;
        this.motes.push({ x, y, sx: x, sy: y, age: 0, life: .6, kind: 'shard', seed: Math.random() });
      }
    }
    this.wardSeen = ward;
    const aura = this.mobs.aura;
    const kind = aura === 'aura-siphon' ? 'life' : aura === 'aura-embers' ? 'ember' : null;
    this.motes = this.motes.filter(m => m.kind === 'shard' || m.kind === kind);
    if (!kind || this.still) return;
    this.moteT -= dt;
    const alive = this.motes.filter(m => m.kind === kind).length;
    if (this.moteT > 0 || alive >= MOTES) return;
    if (kind === 'ember') {
      // Embers rise from the ground anywhere inside the ring.
      this.moteT = .11;
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (AURA_R - 4), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      this.motes.push({ x, y, sx: x, sy: y, age: 0, life: .9 + Math.random() * .4, kind, seed: Math.random() });
    } else {
      // Siphoning flows inward: from the foes in the ring to the Keeper's chest (from the ring's edge, slower, with none near).
      const foes = this.mobs.mobs.filter(m => Math.hypot(m.x - p.x, m.y - p.y) <= AURA_R);
      let sx: number, sy: number;
      if (foes.length) { const f = foes[Math.floor(Math.random() * foes.length)]; this.moteT = .12; sx = f.x; sy = f.y - f.def.h / 2; }
      else { if (alive >= 5) return; this.moteT = .32; const a = Math.random() * Math.PI * 2; sx = p.x + Math.cos(a) * AURA_R; sy = p.y + Math.sin(a) * AURA_R; }
      this.motes.push({ x: sx, y: sy, sx, sy, age: 0, life: .8 + Math.random() * .3, kind, seed: Math.random() });
    }
  }

  /** Ground effects (spec §Rules 3): the aura's floor tint and rings, its pulses, the nova's ring and scorch, the raise sigil. */
  private drawGroundFx(): void {
    const c = this.ctx, p = this.player, X = Math.round(p.x), Y = Math.round(p.y), aura = this.mobs.aura;
    if (aura === 'aura-embers' || aura === 'aura-siphon') {
      const tn = aura === 'aura-embers' ? FX.ember : FX.life, turn = this.still ? 0 : this.time / 12;
      c.drawImage(discSprite(AURA_R, tn.edge, [.05, .045, .04]), X - AURA_R, Y - AURA_R);
      drawRing(c, X, Y, AURA_R, turn, tn.core, tn.body, 8, 6, tn.edge);
      c.globalAlpha = .6; drawRing(c, X, Y, Math.round(AURA_R * .6), -turn * 1.4, tn.body, tn.edge, 8, 4);
      c.globalAlpha = 1;
    }
    this.drawLootRings();
    this.drawTells();
    for (const e of this.mobs.effects) {
      if (e.age < 0) continue;
      const t = e.age / e.life, ex = Math.round(e.x), ey = Math.round(e.y);
      if (e.kind === 'pulse') {
        // A short bright arc of the ring flashes at the foe's side.
        const tn = e.el === 'life' ? FX.life : FX.ember, a = Math.atan2(e.y - p.y, e.x - p.x);
        c.globalAlpha = Math.max(0, 1 - t * .8);
        c.fillStyle = tn.body; for (const q of ringArc(AURA_R + 1, a, .2)) c.fillRect(X + q.x, Y + q.y, 1, 1);
        c.fillStyle = tn.core; for (const q of ringArc(AURA_R, a, .3)) c.fillRect(X + q.x, Y + q.y, 1, 1);
        c.fillStyle = tn.body; for (const q of ringArc(AURA_R - 1, a, .22)) c.fillRect(X + q.x, Y + q.y, 1, 1);
      } else if (e.kind === 'wave') {
        // Hellfire Nova: a two-tone pixel ring runs out to its 3 tiles in half a second; the ground it crossed stays scorched.
        if (t > .2) {
          const f = Math.min(1, (t - .2) / .2) * (t > .5 ? 1 - (t - .5) / .5 : 1);
          c.globalAlpha = .75 * f; c.drawImage(scorchSprite(NOVA_R), ex - NOVA_R, ey - NOVA_R);
        }
        if (t < .5) {
          const k = this.still ? 1 : t / .5, r = Math.round(6 + (NOVA_R - 6) * (1 - (1 - k) * (1 - k)));
          c.globalAlpha = 1 - k * .3;
          // A two-pixel front (core over body) with a dithered edge tone trailing just inside.
          drawRing(c, ex, ey, r, 0, FX.ember.core, FX.ember.body, 4, 4, FX.ember.body);
          drawRing(c, ex, ey, Math.max(1, r - 3), .5, FX.ember.edge, FX.ember.body, 6, 4);
        }
      } else if (e.kind === 'raise' && t < .55) {
        // Raise Skeleton: a violet sigil on the ground for its first 0.4 s, a ring and a five-point star.
        c.globalAlpha = t < .08 ? t / .08 : t > .4 ? Math.max(0, 1 - (t - .4) / .15) : 1;
        c.fillStyle = FX.shadow.edge; for (const q of circlePixels(9)) c.fillRect(ex + q.x, ey + q.y, 1, 1);
        c.fillStyle = FX.shadow.body; for (const q of circlePixels(8)) if ((q.x + q.y) % 2 === 0) c.fillRect(ex + q.x, ey + q.y, 1, 1);
        const pts = polyPoints(5, 7, 7, -Math.PI / 2 + (this.still ? 0 : t * 2));
        for (let i = 0; i < 5; i++) {
          const a = pts[i], b = pts[(i + 2) % 5];
          linePixels(a.x, a.y, b.x, b.y).forEach((q, j) => { c.fillStyle = j % 2 ? FX.shadow.edge : FX.shadow.body; c.fillRect(ex + q.x, ey + q.y, 1, 1); });
        }
        c.fillStyle = FX.shadow.core; for (const q of pts) c.fillRect(ex + q.x, ey + q.y, 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  /** The ground ring under each piece of gear above common: two tones, dithered, breathing with its column. */
  private drawLootRings(): void {
    const c = this.ctx, cam = this.cam;
    for (const g of this.groundLoot()) {
      const r = rungOf(g), beam = r ? lootBeam(r) : null;
      if (!r || !beam?.ring || g.x < cam.x - 20 || g.x > cam.x + cam.w + 20 || g.y < cam.y - 20 || g.y > cam.y + cam.h + 60) continue;
      const tn = LOOT[r], X = Math.round(g.x), Y = Math.round(g.y) - 2, seed = this.dropSeed(g);
      const rr = beam.ring + (this.still ? 0 : Math.round(Math.sin(this.time * 2.6 + seed % 7)));
      c.globalAlpha = .3; c.fillStyle = tn.edge;
      for (const q of groundRing(rr + 1)) c.fillRect(X + q.x, Y + q.y, 1, 1);
      c.globalAlpha = .75;
      groundRing(rr).forEach((q, i) => { if (i % 2) return; c.fillStyle = i % 4 ? tn.body : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    }
    c.globalAlpha = 1;
  }

  /**
   * Bosses' tells (spec §Order 4): while a boss winds up (BOSS_TELL), the ground where its breath will go shows as a
   * pixel cone in the ember edge tone, outlined dark (a foe's effect), pulsing, with a bright front running out to
   * its far edge as the tell runs down — when the front reaches the edge, the breath leaves. A summons' sigil shows
   * where each called creature will stand (CALL_TELL). Ground layer: under every creature.
   */
  private drawTells(): void {
    const c = this.ctx;
    // For the screenshot spec (e2e/td-fx2-shots.spec.ts): the canvas says when a tell is on the ground.
    const telling = this.mobs.mobs.some(m => m.tell > 0) ? 'breath' : this.mobs.calls.length ? 'call' : '';
    if (telling !== this.tellSeen) { this.tellSeen = telling; this.canvas.setAttribute('data-boss-tell', telling); }
    for (const m of this.mobs.mobs) {
      const shoot = m.def.ranged;
      if (!(m.tell > 0) || !m.aim || !shoot || !windsUp(m.def)) continue;
      const k = 1 - m.tell / BOSS_TELL, ox = Math.round(m.x + m.face * m.def.w * .3), oy = Math.round(m.y - 2);
      // The cone lies on the floor: from the boss's feet toward where the prey stood (its feet, 12 px under the aim).
      const ax = m.aim.x, ay = m.aim.y + 12, a = Math.atan2(ay - oy, ax - ox);
      const len = Math.min(shoot.range, Math.hypot(ax - ox, ay - oy) + 28), half = ((shoot.spread ?? 1) - 1) / 2 * .22 + .14;
      const cone = conePixels(len, half, a), tn = FX.ember;
      const beat = this.still ? 1 : Math.floor(this.time * 8) % 2 ? 1 : .7;
      // The front: how far the wind-up has filled the cone; behind it the dither burns brighter (body), ahead of it dim.
      const fr = Math.max(4, Math.round((this.still ? .7 : k) * len));
      for (const q of cone.fill) {
        const near = q.x * q.x + q.y * q.y < fr * fr;
        c.globalAlpha = (near ? .6 : .35) * beat; c.fillStyle = near ? tn.body : tn.edge;
        c.fillRect(ox + q.x, oy + q.y, 1, 1);
      }
      c.globalAlpha = .9 * beat;
      for (const q of cone.edge) { c.fillStyle = HOSTILE_EDGE; c.fillRect(ox + q.x, oy + q.y + 1, 1, 1); }
      cone.edge.forEach((q, i) => { c.fillStyle = i % 3 ? tn.edge : tn.body; c.fillRect(ox + q.x, oy + q.y, 1, 1); });
      c.globalAlpha = .85;
      c.fillStyle = tn.body; for (const q of ringArc(fr, a, half)) c.fillRect(ox + q.x, oy + q.y, 1, 1);
      c.fillStyle = tn.core; for (const q of ringArc(fr - 1, a, half * .7)) c.fillRect(ox + q.x, oy + q.y, 1, 1);
    }
    for (const k of this.mobs.calls) {
      const t = 1 - k.t / CALL_TELL, X = Math.round(k.x), Y = Math.round(k.y), tn = FX.ember;
      c.globalAlpha = this.still ? 1 : Math.min(1, t * 5) * (Math.floor(this.time * 8) % 2 ? 1 : .75);
      c.fillStyle = HOSTILE_EDGE; for (const q of groundRing(11)) c.fillRect(X + q.x, Y + q.y + 1, 1, 1);
      c.fillStyle = tn.edge; for (const q of groundRing(11)) c.fillRect(X + q.x, Y + q.y, 1, 1);
      groundRing(8).forEach((q, i) => { if (i % 2) return; c.fillStyle = tn.body; c.fillRect(X + q.x, Y + q.y, 1, 1); });
      // A turning three-point mark inside, closing in as the creature comes.
      const pts = polyPoints(3, 7 - t * 3, 3.5 - t * 1.5, this.still ? 0 : this.time * 3);
      for (let i = 0; i < 3; i++) linePixels(pts[i].x, pts[i].y, pts[(i + 1) % 3].x, pts[(i + 1) % 3].y).forEach((q, j) => { c.fillStyle = j % 2 ? tn.edge : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    }
    c.globalAlpha = 1;
  }

  /** The Dark Ward's hex: six violet points round the Keeper, turning; `keep` (0..1) is how much of it still holds. */
  private drawHex(cx: number, cy: number, scale: number, keep: number, turn: number): void {
    const c = this.ctx, X = Math.round(cx), Y = Math.round(cy), pts = polyPoints(6, 13 * scale, 18 * scale, turn);
    for (let i = 0; i < 6; i++) {
      const a = pts[i], b = pts[(i + 1) % 6];
      linePixels(a.x, a.y, b.x, b.y).forEach((q, j) => {
        if (fxNoise(i, j, 3) > keep) return;
        // Dithered by tone, not by gaps: body and edge pixels alternate along each side.
        c.fillStyle = (j + i) % 2 ? FX.shadow.edge : FX.shadow.body; c.fillRect(X + q.x, Y + q.y, 1, 1);
      });
    }
    for (const q of pts) { c.fillStyle = FX.shadow.body; c.fillRect(X + q.x - 1, Y + q.y, 3, 1); c.fillRect(X + q.x, Y + q.y - 1, 1, 3); c.fillStyle = FX.shadow.core; c.fillRect(X + q.x, Y + q.y, 1, 1); }
  }

  /** Air effects (over creatures): hits, bursts, bolts, motes, the ward. Pixel pictures that live a moment. */
  private drawEffects(): void {
    const c = this.ctx, p = this.player;
    for (const e of this.mobs.effects) {
      if (e.age < 0 || e.kind === 'pulse' || e.kind === 'wave') continue;
      // Reduced motion: a burst is one still frame, never no burst.
      const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), bt = this.still ? .5 : t, seed = (X * 7 + Y * 13) | 0;
      c.globalAlpha = Math.max(0, 1 - t);
      if (e.kind === 'slash') {
        // Three bright strokes sweeping down across the foe.
        c.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) { const k = Math.min(i, Math.floor(t * 9)); c.fillRect(X + e.dir * (-6 + k * 2), Y - 6 + k * 2, 2, 2); }
        c.fillStyle = '#ffe9a8'; for (let i = 0; i < 5; i++) c.fillRect(X + e.dir * (-4 + i * 2), Y - 8 + i * 2, 1, 1);
      } else if (e.kind === 'heal') {
        c.fillStyle = '#7fe08a';
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * 2; c.fillRect(Math.round(X + Math.cos(a) * 9), Math.round(Y - 10 - t * 22 + Math.sin(a) * 3), 2, 2); }
        c.fillStyle = '#e6ffe9'; c.fillRect(X - 1, Math.round(Y - 22 - t * 14), 3, 1); c.fillRect(X, Math.round(Y - 23 - t * 14), 1, 3);
      } else if (e.kind === 'chips') {
        for (let i = 0; i < 5; i++) {
          c.fillStyle = i % 2 ? '#c99657' : '#4f9440';
          c.fillRect(Math.round(X + e.dir * (i * 3 + t * 14) - 4), Math.round(Y - t * 10 + t * t * 26 + i), 2, 2);
        }
      } else if (e.kind === 'drain') {
        // The red thread of life pulled from the foe; green beads run it to the Keeper and burst on arrival.
        const tx = e.tx ?? X, ty = e.ty ?? Y, wav = (k: number) => Math.sin(k * 6 + (this.still ? 0 : t * 12)) * 3;
        c.globalAlpha = Math.max(0, 1 - t) * .9;
        for (let i = 0; i <= 10; i++) {
          const k = i / 10;
          c.fillStyle = i % 2 ? '#e2452a' : '#9e2e1c'; c.fillRect(Math.round(X + (tx - X) * k), Math.round(Y + (ty - Y) * k + wav(k)), 2, 2);
        }
        c.globalAlpha = 1;
        for (let j = 0; j < 3 && t < .7; j++) {
          const k = this.still ? (j + 1) / 4 : Math.min(1, t * 1.6 + j * .12), bx = Math.round(X + (tx - X) * k), by = Math.round(Y + (ty - Y) * k + wav(k));
          c.fillStyle = FX.life.body; c.fillRect(bx - 1, by - 1, 3, 3); c.fillStyle = FX.life.core; c.fillRect(bx, by, 1, 1);
        }
        if (t > .55 || this.still) { c.globalAlpha = this.still ? 1 : 1 - (t - .55) / .45; drawBurst(c, tx, ty, burst(7, this.still ? .5 : (t - .55) / .45, seed, 9, 4), FX.life); }
      } else if (e.kind === 'curse') {
        c.fillStyle = '#b06bff';
        c.fillRect(X - 4, Y - 4, 8, 1); c.fillRect(X - 4, Y + 3, 8, 1); c.fillRect(X - 4, Y - 4, 1, 8); c.fillRect(X + 3, Y - 4, 1, 8);
        c.fillStyle = '#ff6a2a'; c.fillRect(X - 1, Y - 1, 2, 2);
      } else if (e.kind === 'ward') {
        // The ward going up: the hex springs out from the Keeper, a bright frame.
        const k = this.still ? 1 : 1 - (1 - t) * (1 - t);
        this.drawHex(p.x, p.y - 18, .55 + .45 * k, 1, this.still ? 0 : this.time * .8);
      } else if (e.kind === 'raise') {
        // Bones knitting up out of the sigil (from 0.25 s), violet motes climbing with them.
        if (t > .25) {
          const k = this.still ? .6 : (t - .25) / .75;
          for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? FX.bone.body : FX.bone.edge; c.fillRect(Math.round(X - 6 + i * 2.4), Math.round(Y - 1 - k * (6 + (i % 3) * 5)), 2, 1); }
        }
        c.fillStyle = FX.shadow.body;
        for (let i = 0; i < 7; i++) c.fillRect(Math.round(X - 8 + i * 2.6), Math.round(Y - 2 - bt * (10 + (i % 3) * 8)), 1, 1);
      } else if (e.kind === 'pillar') {
        // The level-up: a stepped column of warm light stands on the Keeper (it follows him), motes climb it, sparks
        // ring his feet. Thin and see-through over the body (spec rule 4); reduced motion draws the full column still.
        const big = e.dir > 1, X0 = Math.round(p.x), Y0 = Math.round(p.y), n = big ? 10 : 6;
        const fade = this.still || t < .6 ? 1 : 1 - (t - .6) / .4, h = Math.round((big ? 96 : 72) * (this.still ? 1 : Math.min(1, t / .25)));
        c.globalAlpha = .3 * fade; c.fillStyle = LEVEL_UP.edge; c.fillRect(X0 - (big ? 7 : 5), Y0 - h, big ? 14 : 10, h);
        c.globalAlpha = .5 * fade; c.fillStyle = LEVEL_UP.body; c.fillRect(X0 - 3, Y0 - h, 6, h);
        c.globalAlpha = .6 * fade; c.fillStyle = LEVEL_UP.core; c.fillRect(X0 - 1, Y0 - h, 2, h);
        c.globalAlpha = fade;
        for (let i = 0; i < n; i++) {
          const k = this.still ? (i + 1) / (n + 1) : (t * 1.4 + i / n) % 1;
          c.fillStyle = i % 2 ? LEVEL_UP.core : LEVEL_UP.body;
          c.fillRect(X0 + (i % 2 ? -1 : 1) * (3 + (i * 5) % 6), Math.round(Y0 - 4 - k * h), 1, 2);
        }
        if (t < .4 || this.still) { c.globalAlpha = 1; drawBurst(c, X0, Y0 - 2, burst(big ? 10 : 8, bt, seed, 12, 4), LEVEL_UP); }
      } else if (e.kind === 'spark') {
        // A foe's shot breaking: its own fire, edged dark.
        drawBurst(c, X, Y, burst(6, bt, seed, 7, 5), FX.ember, true);
      } else if (e.kind === 'bolt-hit') {
        // The Ember Bolt landing: a quick core flash, then 8 embers flying out and falling.
        if (t < .3 || this.still) glowSquare(c, X, Y, 3, FX.ember, .6);
        drawBurst(c, X, Y, burst(8, bt, seed, 10, 7), FX.ember);
      } else if (e.kind === 'bone-chips') {
        drawBurst(c, X, Y, burst(6, bt, seed, 8, 10), FX.bone);
      } else if (e.kind === 'flash') {
        glowSquare(c, X, Y, 4, FX.bone);
      } else if (e.kind === 'crit') {
        // A crit's white-hot core (over a creature: never above 60%).
        c.globalAlpha = .6 * Math.max(0, 1 - t);
        glowSquare(c, X, Y, 4, { core: '#ffffff', body: FX.ember.core, edge: FX.ember.body });
        c.fillStyle = '#ffffff'; c.fillRect(X - 6, Y, 13, 1); c.fillRect(X, Y - 6, 1, 13);
      } else {
        c.fillStyle = '#e9dcc0'; c.fillRect(X - 2, Math.round(Y - 2 - t * 4), Math.round(4 - t * 2), 2);
      }
    }
    c.globalAlpha = 1;
    this.drawMotes();
    // A boss winding up: a stepped glow gathering at its jaws (over its own body: never above 60%).
    for (const m of this.mobs.mobs) if (m.tell > 0 && windsUp(m.def)) {
      const k = this.still ? .7 : 1 - m.tell / BOSS_TELL;
      glowSquare(c, m.x + m.face * m.def.w * .3, m.y - m.def.h * .55, 2 + Math.round(k * 5), FX.ember, .35 + .25 * k);
    }
    // Loot pops: out and falling as gear lands; up and in as the Keeper takes it.
    for (const q of this.pops) {
      const t = q.age / q.life, bt = this.still ? .5 : t;
      c.globalAlpha = Math.max(0, 1 - t * .8);
      const tn = LOOT[q.rung], X = Math.round(q.x), Y = Math.round(q.y);
      if (q.kind === 'drop') {
        // Landing: a flash, a flat ring running out along the ground, and a dozen pixels thrown up and falling.
        if (t < .3 || this.still) glowSquare(c, X, Y - 2, 4, tn, .6);
        const rr = 2 + Math.round((this.still ? .5 : 1 - (1 - t) * (1 - t)) * 12);
        groundRing(rr).forEach((g, i) => { if (i % 2) return; c.fillStyle = i % 4 ? tn.body : tn.core; c.fillRect(X + g.x, Y + 3 + g.y, 1, 1); });
        drawBurst(c, X, Y - 2, burst(12, bt, q.seed, 14, 7), tn);
      } else {
        // Taken: the pixels gather up and in toward the satchel, a last flash where it lay.
        if (t < .25 || this.still) glowSquare(c, X, Y, 3, tn, .6);
        drawBurst(c, X, Y - Math.round(bt * 14), burst(9, 1 - bt * .7, q.seed, 9, 0), tn);
      }
    }
    c.globalAlpha = 1;
    // Ember Bolts in flight: a stepped violet halo, an ember core, a three-pixel trail fading in steps.
    for (const b of this.mobs.bolts) {
      const X = Math.round(b.x), Y = Math.round(b.y), dx = b.to.x - b.x, dy = b.to.y - b.to.def.h / 2 - b.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const trail: [string, number][] = [[FX.ember.body, .8], [FX.ember.edge, .5], [FX.shadow.body, .25]];
      trail.forEach(([col, a], i) => { c.globalAlpha = a; c.fillStyle = col; c.fillRect(Math.round(X - ux * (i + 1) * 3) - 1, Math.round(Y - uy * (i + 1) * 3) - 1, 2, 2); });
      c.globalAlpha = 1;
      glowSquare(c, X, Y, 4, FX.shadow, .7);
      c.fillStyle = FX.ember.edge; c.fillRect(X - 2, Y - 2, 4, 4); c.fillStyle = FX.ember.body; c.fillRect(X - 1, Y - 2, 3, 3); c.fillStyle = FX.ember.core; c.fillRect(X, Y - 1, 1, 1);
    }
    // Creatures' shots: a bone arrow, a fire bolt, a gout of breath.
    for (const s of this.mobs.shots) {
      const X = Math.round(s.x), Y = Math.round(s.y), sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
      if (s.kind === 'arrow') {
        c.fillStyle = '#e8e1cf'; for (let i = 0; i < 6; i++) c.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 1, 1);
        c.fillStyle = '#c9c2cc'; c.fillRect(X, Y, 2, 2); c.fillStyle = '#ff8a2e'; c.fillRect(Math.round(X - ux * 6), Math.round(Y - uy * 6), 2, 1);
      } else {
        const r = s.kind === 'breath' ? 4 : 3;
        c.globalAlpha = .45; c.fillStyle = '#9e2e1c'; c.fillRect(Math.round(X - ux * 5) - r, Math.round(Y - uy * 5) - r, r * 2, r * 2);
        c.globalAlpha = 1; c.fillStyle = '#ff6a2a'; c.fillRect(X - r, Y - r, r * 2, r * 2); c.fillStyle = '#ffd25a'; c.fillRect(X - 1, Y - 1, 2, 2);
      }
    }
    // Bone Spears: a white shaft with a violet tail.
    for (const s of this.mobs.spears) {
      const X = Math.round(s.x), Y = Math.round(s.y), sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
      c.fillStyle = '#b06bff'; for (let i = 8; i < 13; i++) c.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 1, 1);
      c.fillStyle = '#e8e1cf'; for (let i = 0; i < 9; i++) c.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 2, 2);
      c.fillStyle = '#ffffff'; c.fillRect(X, Y, 2, 2);
    }
    // The Dark Ward while it holds: the hex turns, and it is missing the pixels the blows it drank have cracked off.
    if (this.mobs.ward > 0) {
      c.globalAlpha = .8;
      this.drawHex(p.x, p.y - 18, 1, Math.max(.15, this.mobs.ward / SKILLS['dark-ward'].vars['absorb']), this.still ? 0 : this.time * .8);
      c.globalAlpha = 1;
    }
    for (const m of this.mobs.mobs) if (m.cursed > 0) {
      c.fillStyle = Math.floor(this.time * 6) % 2 ? '#b06bff' : '#ff6a2a';
      c.fillRect(Math.round(m.x - 1 + Math.sin(this.time * 3) * 5), Math.round(m.y - m.def.h - 8 - (this.time * 8) % 6), 2, 2);
    }
  }

  /** An aura's motes and the ward's falling shards; with reduced motion, the aura's motes stand still where they are seeded. */
  private drawMotes(): void {
    const c = this.ctx, p = this.player, aura = this.mobs.aura;
    // Over a creature an effect stays under 60% (spec §Budget).
    const overFoe = (x: number, y: number) => this.mobs.mobs.some(m => Math.abs(x - m.x) < m.def.w / 2 && y < m.y && y > m.y - m.def.h);
    const dot = (x: number, y: number, col: string, a: number, size = 1) => { const X = Math.round(x), Y = Math.round(y); c.globalAlpha = overFoe(X, Y) ? Math.min(a, .6) : a; c.fillStyle = col; c.fillRect(X, Y, size, size); };
    if (this.still && (aura === 'aura-embers' || aura === 'aura-siphon')) {
      const tn: Tones = aura === 'aura-embers' ? FX.ember : FX.life;
      for (let i = 0; i < 8; i++) {
        const a = fxNoise(i, 1) * Math.PI * 2, d = (aura === 'aura-embers' ? Math.sqrt(fxNoise(i, 2)) : .55 + fxNoise(i, 2) * .3) * (AURA_R - 4);
        dot(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d - (aura === 'aura-embers' ? 6 : 10), i % 2 ? tn.core : tn.body, .9);
      }
    }
    for (const m of this.motes) {
      const k = m.age / m.life;
      if (m.kind === 'ember') {
        // Rising ~18 px, flickering through the three tones, a pixel off now and then.
        if (fxNoise(Math.floor(m.age * 14), Math.floor(m.seed * 1e4)) < .15) continue;
        const tone = [FX.ember.core, FX.ember.body, FX.ember.edge][Math.min(2, Math.floor(k * 3))];
        const x = m.sx + Math.round(Math.sin(m.age * 5 + m.seed * 9)), y = m.sy - 18 * k;
        dot(x, y, tone, k > .8 ? (1 - k) * 5 * .9 : .9, k < .3 ? 2 : 1);
      } else if (m.kind === 'life') {
        // Drawn in to the Keeper's chest, wavering less as it nears.
        const e = k * k * (3 - 2 * k), tx = p.x, ty = p.y - 18;
        const x = m.sx + (tx - m.sx) * e + Math.sin(m.age * 7 + m.seed * 9) * 2 * (1 - e), y = m.sy + (ty - m.sy) * e;
        const bx = m.sx + (tx - m.sx) * Math.max(0, e - .08), by = m.sy + (ty - m.sy) * Math.max(0, e - .08);
        dot(bx, by, FX.life.edge, .55);
        dot(x, y, k > .75 ? FX.life.core : FX.life.body, k > .85 ? (1 - k) * 6 * .9 : .9, 2);
      } else {
        // A shard of the ward cracking off and falling.
        const x = m.sx + (m.seed - .5) * 10 * k, y = m.sy + 22 * k * k;
        dot(x, y, k < .4 ? FX.shadow.core : FX.shadow.body, 1 - k);
      }
    }
    c.globalAlpha = 1;
  }

  /** Names and health over creatures, labels over gear on the ground, the numbers that float up. */
  private drawFightUi(inView: (x: number, y: number, pad?: number) => boolean): void {
    const c = this.ctx;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (const m of this.mobs.mobs) {
      if (!inView(m.x, m.y) || Math.hypot(m.x - this.player.x, m.y - this.player.y) > 150) continue;
      const top = m.y - m.def.h - 3, w = 18, frac = Math.max(0, m.hp / m.def.hp);
      c.fillStyle = '#1a1014'; c.fillRect(Math.round(m.x - w / 2) - 1, Math.round(top) - 1, w + 2, 4);
      c.fillStyle = frac > .6 ? '#5fd35a' : frac > .3 ? '#e8c23a' : '#e2452a'; c.fillRect(Math.round(m.x - w / 2), Math.round(top), Math.round(w * frac), 2);
      c.font = '6px "Pixelify Sans", monospace'; c.fillStyle = '#1a1014'; c.fillText(m.def.name, Math.round(m.x) + 1, Math.round(top) - 1);
      c.fillStyle = m === this.mobs.target ? '#ff8a7a' : '#f3e7cf'; c.fillText(m.def.name, Math.round(m.x), Math.round(top) - 2);
    }
    for (const g of this.groundLoot()) { const r = rungOf(g); if (r && inView(g.x, g.y) && (Math.hypot(g.x - this.player.x, g.y - this.player.y) < 110 || this.showcase.includes(g))) this.plate(g.label, g.x, this.dropTop(g), LOOT[r].body); }
    c.font = 'bold 8px "Pixelify Sans", monospace';
    for (const f of this.mobs.floaters) {
      c.globalAlpha = Math.max(0, 1 - f.age);
      c.fillStyle = '#1a1014'; c.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
      c.fillStyle = f.color; c.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    c.globalAlpha = 1;
  }

  private drawPerson(p: Person, action: 'idle' | 'run' | 'walk'): void {
    const c = this.ctx, s = this.scale, cam = this.cam;
    // Soft shadow under the feet: a pixel ellipse as wide as the sprite's stance.
    c.fillStyle = 'rgba(30,18,26,.28)';
    const sx = Math.round(p.x), sy = Math.round(p.y);
    c.fillRect(sx - 7, sy - 3, 14, 1); c.fillRect(sx - 9, sy - 2, 18, 2); c.fillRect(sx - 6, sy, 12, 1);
    if (!p.painter) return;
    const acting = p === this.player && this.actT > 0;
    if (p === this.player && (p.dir !== 'side' || acting)) {
      // The Warlock: front/back views with the staff in hand; every cast faces the camera, staff raised.
      const sheet = frontSheet(p.painter, true), row = acting ? 0 : p.dir === 'down' ? 0 : 1;
      const f = acting ? CAST_FRAME : this.phone && row === 0 && !p.moving ? PHONE_FRAME : frontFrame(this.time + p.t, p.moving);
      c.drawImage(sheet, f * FRONT_W, row * FRONT_H, FRONT_W, FRONT_H, Math.round(p.x) - FRONT_AX, Math.round(p.y) - FRONT_AY, FRONT_W, FRONT_H);
      return;
    }
    if (p.dir !== 'side') {
      const sheet = frontSheet(p.painter), row = p.dir === 'down' ? 0 : 1;
      const f = p === this.player && this.phone && row === 0 && !p.moving ? PHONE_FRAME : frontFrame(this.time + p.t, p.moving);
      c.drawImage(sheet, f * FRONT_W, row * FRONT_H, FRONT_W, FRONT_H, Math.round(p.x) - FRONT_AX, Math.round(p.y) - FRONT_AY, FRONT_W, FRONT_H);
      return;
    }
    c.save();
    c.setTransform(s * p.face, 0, 0, s, (Math.round(p.x) - cam.x) * s, (Math.round(p.y) - cam.y) * s);
    p.painter.draw(c, 1, acting ? { action: 'attack', time: this.time, attackT: 1 - this.actT / .3, weapon: true } : { action, time: this.time + p.t, attackT: 0, weapon: p === this.player });
    c.restore();
  }

  private plate(text: string, x: number, y: number, color: string): void {
    const c = this.ctx;
    c.font = '7px "Pixelify Sans", monospace';
    const w = Math.ceil(c.measureText(text).width) + 6;
    c.fillStyle = 'rgba(26,16,30,.82)';
    c.fillRect(Math.round(x - w / 2), Math.round(y - 9), w, 9);
    c.fillStyle = color;
    c.fillText(text, Math.round(x), Math.round(y - 1));
  }

  /** Darkness by the hour (day clear → dusk amber → night blue), holes for every light. */
  private drawLight(): void {
    const night = this.level.dark ? .9 : this.darkness;
    if (!this.level.dark && this.dusk > .05 && night < .5) {
      // Dawn and dusk: a warm wash before the dark.
      const c0 = this.ctx; c0.setTransform(1, 0, 0, 1, 0, 0); c0.globalAlpha = .16 * this.dusk; c0.fillStyle = '#ff9a4a';
      c0.fillRect(0, 0, this.canvas.width, this.canvas.height); c0.globalAlpha = 1;
    }
    if (night <= .02) return;
    const cam = this.cam, s = this.scale;
    const hw = Math.max(1, Math.ceil(cam.w / 2)), hh = Math.max(1, Math.ceil(cam.h / 2));
    if (!this.dark || this.dark.width !== hw || this.dark.height !== hh) { this.dark = document.createElement('canvas'); this.dark.width = hw; this.dark.height = hh; }
    if (!this.lightSprite) {
      const l = document.createElement('canvas'); l.width = l.height = 64;
      const g = l.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(.55, 'rgba(0,0,0,.6)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      this.lightSprite = l;
    }
    const d = this.dark.getContext('2d')!;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, hw, hh);
    d.fillStyle = `rgba(18,20,52,${(.62 * night).toFixed(3)})`;
    d.fillRect(0, 0, hw, hh);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number) => d.drawImage(this.lightSprite!, (x - cam.x - r) / 2, (y - cam.y - r) / 2, r, r);
    const glows: { x: number; y: number; r: number }[] = [];
    for (const o of this.visible) {
      const sp = o.sprite();
      for (const l of sp.lights ?? []) { hole(o.x + l.x, o.y + l.y, l.r * 2); if (l.warm) glows.push({ x: o.x + l.x, y: o.y + l.y, r: l.r }); }
    }
    hole(this.player.x, this.player.y - 18, 70);
    // A running aura claims the ground round the Keeper: its ring glows through the dark (a soft light, not a stroke on screen).
    if (this.mobs.aura) {
      d.globalAlpha = .8; d.strokeStyle = '#000'; d.lineWidth = 6;
      d.beginPath(); d.arc((this.player.x - cam.x) / 2, (this.player.y - cam.y) / 2, AURA_R / 2, 0, Math.PI * 2); d.stroke();
      d.globalAlpha = .2; hole(this.player.x, this.player.y, AURA_R * 2 + 16); d.globalAlpha = 1;
    }
    // Spells are their own light: the nova's running ring, a bolt's ember, a burst as it breaks.
    for (const e of this.mobs.effects) {
      const t = e.age / e.life;
      if (e.kind === 'wave' && t < .5) {
        const k = t / .5, r = 6 + (NOVA_R - 6) * (1 - (1 - k) * (1 - k));
        d.globalAlpha = .9 * (1 - k * .5); d.strokeStyle = '#000'; d.lineWidth = 5;
        d.beginPath(); d.arc((e.x - cam.x) / 2, (e.y - cam.y) / 2, r / 2, 0, Math.PI * 2); d.stroke(); d.globalAlpha = 1;
      } else if (e.kind === 'bolt-hit' || e.kind === 'raise' || e.kind === 'flash') hole(e.x, e.y, 28);
      else if (e.kind === 'pillar' && t < .8) hole(this.player.x, this.player.y - 30, 56);
    }
    for (const b of this.mobs.bolts) hole(b.x, b.y, 24);
    // Gear on the ground is its own light, the rarer the further; a boss's tell lights its jaws and its cone.
    for (const g of this.groundLoot()) { const r = rungOf(g); if (r) { const b = lootBeam(r); hole(g.x, g.y - 3 - b.h / 2, b.light + b.h / 2); } }
    for (const m of this.mobs.mobs) if (m.tell > 0 && m.aim && windsUp(m.def)) { hole(m.x + m.face * m.def.w * .3, m.y - m.def.h * .55, 40); hole((m.x + m.aim.x) / 2, (m.y + m.aim.y + 12) / 2, 70); }
    for (const k of this.mobs.calls) hole(k.x, k.y, 30);
    hole(this.glim.x, this.glim.y, 56);
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.dark, 0, 0, hw * 2 * s, hh * 2 * s);
    c.imageSmoothingEnabled = false;
    // Warm glow added on top for windows and lamps: a soft round sprite, never squares.
    if (!this.glowSprite) {
      const l = document.createElement('canvas'); l.width = l.height = 64;
      const g = l.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,190,96,1)'); grad.addColorStop(.4, 'rgba(255,150,60,.45)'); grad.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      this.glowSprite = l;
    }
    c.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = .38 * night;
    for (const g of glows) if (g.x > cam.x - 60 && g.x < cam.x + cam.w + 60 && g.y > cam.y - 60 && g.y < cam.y + cam.h + 60) c.drawImage(this.glowSprite, g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = false;
    c.globalCompositeOperation = 'source-over';
  }
}

/**
 * The top-down engine behind the side-scroller's type: every member the play
 * component calls that the top-down world does not implement yet answers as a
 * harmless no-op (undefined / null), so the component's wiring stays intact
 * while the phases fill them in (docs/design/top-down.md §5).
 */
export function createTopDownEngine(canvas: HTMLCanvasElement, options: EngineOptions): TopDownEngine {
  const engine = new TopDownEngine(canvas, options);
  const noop = () => undefined;
  return new Proxy(engine, {
    get(target, key, receiver) {
      if (key in target) {
        const value = Reflect.get(target, key, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return noop;
    },
  });
}

/** The top-down gate: on by default; `?td=0` keeps the old view on this device, `?td=1` clears that. */
export function topDownGate(): boolean {
  // Top-down is the game now (owner, 2026-10-19): on unless this device chose the old view with `?td=0`.
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('td');
    if (q === '1') localStorage.removeItem('eclipse-td');
    if (q === '0') localStorage.setItem('eclipse-td', '0');
    return localStorage.getItem('eclipse-td') !== '0';
  } catch { return true; }
}
