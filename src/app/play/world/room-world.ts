/**
 * room-world.ts — one area of the room-run world (Hearth protocol 7; docs/design/online.md "Phase 8: the room
 * simulates"). Pure TypeScript with no Angular and no DOM: the Hearth (scripts/social-server.mjs) runs it on the server
 * through a build step (scripts/world-sim-build.mjs bundles this module and everything it imports), and the Karma specs
 * run it in the browser. The numbers are the game's own, not a copy: MobSystem (td-mobs: AI, shots, bursts, elites,
 * bosses, calls, the damage path), the continent's spawn tables (TdWorld.spawnsIn), the zone levels (td-zones), the
 * sky (world-clock), the Gold/material/potion rolls (MobSystem.spoils) and the gear table (drop-tables).
 *
 * The room is the host: it plays the part a party host's browser plays in protocol 5 (td-coop.ts), with no Keeper of
 * its own (`selfAway`), every Keeper in the area as prey (`others`), and the same wire (coop-protocol.ts) — so a client
 * draws the room's creatures as a member draws a host's. What is new on top of a player host:
 *  - one delta encoder **per viewer**, each with the creatures near that Keeper (a player host sends one set to all);
 *  - claims weighed by the room's own record of the Keeper (where it stands, its level) and line of sight;
 *  - loot rolled **once** per kill, here, and owned here (`ground`): its fighters may take it first (OWN_MS), then
 *    anyone; a take is first-come, answered from memory;
 *  - `save()`/`load()`: what must survive the room going to sleep (the ground, the spawns resting).
 *
 * Every random draw inside a tick or a claim comes from this world's own seeded stream (Math.random is lent to it for
 * the call), so a world built with the same seed and fed the same intents plays out the same.
 */
import { CAPTAIN_REACH, MOBS, MobSystem, abilityFlags, fieldEvent, type CoopLink, type Drop, type Mob, type RoomKin } from '../td/td-mobs';
import { STATUS_WIRE } from '../td/td-abilities';
import { landOf } from '../td/td-pack-aura';
import { TdWorld } from '../td/td-world';
import { HandLevel, type TdLevel } from '../td/td-level';
import { CONTINENTS, LEVELS } from '../td/td-levels';
import { atZoneLevel } from '../td/td-zones';
import { makePack } from '../td/td-elites';
import { respawnSecs } from './respawn';
import { WORLD_BOSS_KEY, fastForward, firstRising, nextRising, worldBossOfKey, worldBossesIn, type WorldBossClock, type WorldBossDef } from './world-bosses';
import { uniqueById } from '../../shared/rpg/unique-items';
import { TILE } from '../td/td-art';
import { KIN_DEAD_MS, kinGuard, weighKin, type KinHeld, type KinRefusal, type KinWord } from './room-kin';
import { SEAM_ID, riftPlace, riftTile, seamEaterAt, seamLeaves, seamRises } from '../td/td-seam';
import { seamLevelFor } from '../td/td-zones';
import type { ContinentDef } from '../td/continent';
import { NOTHING_OWED, wireElite } from '../td/td-coop';
import {
  COOP_MAX_EVENTS, COOP_MAX_MOBS, COOP_RANGE_TILES, CoopEncoder, FL_CHANT, FL_HALVED, FL_SUMMONED,
  type CoopEvent, type CoopHit, type CoopMobState, type CoopSnapBody,
} from '../social/coop-protocol';
import { CLAIM_RANGE_TILES, ClaimGate, coopBossLife } from '../social/coop-rules';
import { GROUND_MS, OWN_MS, TAKE_REACH, type WorldDrop, type WorldTakeResult } from '../social/world-protocol';
import { lootEntry, rollCreatureLoot, type LootDrop } from '../../shared/loot/drop-tables';
import { CC_IMMUNE, DOT_SHARE, PULL_MAX_TILES, SLOW_MAX_PCT, STATUS_CAP, ST_BIT, statusLegal, type CoopStatus, type RoomStatusKind } from './room-status';
import type { KeeperLife } from './keeper-life';
import { CUT_AURAS, ALLY_PER_SEC, ALLY_WINDOW_MS, REKINDLE_MAX_MS, REKINDLE_MIN_CD_MS, REKINDLE_REACH, allyHealBudget, allyLegal, type AllyClaim, type AllyRefusal } from './ally-claims';
import { forgetThreat, healThreat, kinKey } from '../td/td-threat';
import { hashSeed, seededRandom, type MonsterRank } from '../../shared/loot/champions';
import { eclipseAt, worldTime, type SkyPhase } from '../../shared/world-clock/world-clock.model';
import type { EngineOptions } from '../engine/engine.model';

/**
 * A Keeper in the area as the room knows it: where it last said it stands, and its level (the room's own record).
 * `dps` (protocol 8): the damage a second its save allows (keeper-budget.ts), the claim gate's budget when present.
 */
export interface RoomKeeper { id: string; x: number; y: number; level: number; dps?: number }
/** What survives a sleep: the ground (absolute expiry) and the spawns resting (absolute end), the id counters. */
export interface RoomWorldSave {
  v: 1; area: string; savedAt: number; seq: number; drops: number;
  ground: (WorldDrop & { until: number; freeAt: number })[];
  resting: [string, number][];
  /** The Seam Eater fell in this eclipse: it does not rise again until the eclipse is over (epoch ms). */
  seamSlainUntil?: number;
  /** Protocol 9: the area's world bosses' clocks (world-bosses.ts), by boss id. */
  wb?: [string, WorldBossClock][];
}
/** A world boss rose, fell or left unfound (the room tells the whole world: an omen line). */
export interface WorldOmen { boss: string; name: string; area: string; at: 'rise' | 'fall' | 'gone'; level: number; x: number; y: number }
export interface RoomWorldOptions {
  area: string;
  /** The world's random stream (the room: a fresh secret per wake; the specs: a fixed string). */
  seed: string;
  /** Epoch ms (the ground's clocks and the sky). */
  now: () => number;
  /** The continent (default: the area's own — CONTINENTS — or the Seamworks island). A floor's area (LEVELS) is its floor. */
  def?: ContinentDef;
  /** The boot id woven into ground ids (unique across wakes). */
  boot?: string;
  /**
   * Protocol 10: the life the room keeps for this Keeper (keeper-life.ts), or null (an older client: its screen keeps
   * its own). Bites on it are cut there; a downed Keeper is not hunted.
   */
  life?: (id: string) => KeeperLife | null;
}
/** A kill as the room pays it (protocol 10, room-credit.ts): its credit id, its life's XP, the sky's lift, who fought. */
export interface RoomKill { id: string; nid: string; creature: string; level: number; hp: number; xpK: number; by: string[]; x: number; y: number }
/** Why the room refused a blow or a status (the screen shows a small cue: out of sight, too far, blocked). */
export type RoomRefusal = 'far' | 'sight' | 'cap' | 'gone' | 'dead' | 'bad' | 'illegal' | 'immune' | 'rate';
/** A creature is raised round each Keeper within this (art px), and forgotten past PRUNE of every Keeper. */
const SPAWN_REACH = 420;
const PRUNE = 900;
/** Claims from closer than this (art px) need no clear line (a blade at a creature's side, a stale position). */
const LOS_FREE = 2.5 * TILE;
/** The most ground one area holds (oldest crumble first). */
const GROUND_CAP = 240;

interface Viewer { enc: CoopEncoder; ev: CoopEvent[]; fx: WeakSet<object> }
interface GroundDrop extends WorldDrop { until: number; freeAt: number; owners: string[] }

export class RoomWorld implements CoopLink {
  readonly area: string;
  /** The continent's surface (a surface area), as the engine's TdWorld. On a floor: unset — `level` is the floor. */
  readonly world!: TdWorld;
  /** The ground the creatures walk: the surface, or a hand-drawn floor (td-levels LEVELS). */
  readonly level: TdLevel;
  /** A surface area (a continent), not a floor. */
  readonly surface: boolean;
  /** 'surface', or the floor's id (MobSystem.levelId; the ground ids `td:<level>:w.…`). */
  readonly levelId: string;
  readonly mobs: MobSystem;
  /** Grows with every wake (the clients' decoders resync on a new term). */
  term = 1;
  private readonly keepers = new Map<string, RoomKeeper>();
  private readonly viewers = new Map<string, Viewer>();
  private readonly gate = new ClaimGate();
  private readonly rng: () => number;
  private readonly now: () => number;
  private readonly boot: string;
  private readonly seed: string;
  private nidSeq = 1;
  private dropSeq = 1;
  private spawnT = 0;
  private clockMs = 0;
  /** The kills of this tick, in order, with where their drops start in mobs.drops (MobSystem.kill: killed, then spoils). */
  private kills: { nid: string; by: string[]; at: number }[] = [];
  readonly ground = new Map<string, GroundDrop>();
  /** What came and went on the ground since the last flush (the room tells the area). */
  private added: GroundDrop[] = [];
  private removed: string[] = [];
  /** The Seam Eater (td-seam): risen at the island's rift under an eclipse, everyone's; slain, it stays down that eclipse. */
  private seam: Mob | null = null;
  private seamSlainUntil = 0;
  private rift: { x: number; y: number } | null | undefined;
  /** The ground or the resting spawns changed since the last save. */
  dirty = false;
  /** The world bosses' clocks (protocol 9; world-bosses.ts), and the ones up now. */
  private readonly wb = new Map<string, WorldBossClock>();
  private readonly wbUp = new Map<string, Mob>();
  /** Omens since the last flush (the room tells everyone). */
  private omens: WorldOmen[] = [];
  /** The spots each world boss may rise at (tiles), found once from the continent's map. */
  private wbSpots: { c: number; r: number }[] | null = null;
  private bossT = 0;
  readonly stats = { ticks: 0, kills: 0, claimsIn: 0, claimsRefused: 0, refusedFar: 0, refusedSight: 0, refusedCap: 0, drops: 0, takes: 0, takeRefused: 0, statusIn: 0, statusRefused: 0 };
  /** Protocol 10: the Keepers' life (null: none kept here), the kills since the last flush, when each held one may be held again. */
  private readonly life: (id: string) => KeeperLife | null;
  private paid: RoomKill[] = [];
  private killXp: { nid: string; hp: number; xpK: number } | null = null;
  private readonly immune = new WeakMap<Mob, Partial<Record<RoomStatusKind, number>>>();
  /** Status claims a Keeper made in the last second (STATUS_PER_SEC). */
  private readonly stRate = new Map<string, number[]>();
  // ── S5: the allies' claims (ally-claims.ts) ──
  /** Ally claims a Keeper made in the last second, and the heals it gave others in the window (its level budget). */
  private readonly allyRate = new Map<string, number[]>();
  private readonly allyHeals = new Map<string, { at: number; n: number }[]>();
  /** Where and when each Keeper last fell (Rekindle reads it), and each healer's last Rekindle. */
  private readonly fallen = new Map<string, { at: number; x: number; y: number }>();
  private readonly rekindled = new Map<string, number>();
  /** Auras that guard allies (the Banner, the Gate, a Watch Cry's Rally…): by holder and skill. */
  private readonly auras = new Map<string, { by: string; s: string; cut: number; r: number; until: number; f: number }>();
  /** Intercept: an ally's bonds (the tank takes `share` of what it takes, through his own guard). */
  private readonly bonds = new Map<string, { tank: string; share: number; until: number }[]>();
  /** Effects laid on each Keeper since its last snapshot (its screen mirrors them). */
  private readonly allyEv = new Map<string, CoopEvent[]>();
  readonly allyStats = { claims: 0, refused: 0, healed: 0, wards: 0, rekindles: 0 };
  // ── The Keepers' summons (room-kin.ts) ──
  /** Each owner's summons the room holds (by companion id), with when each was last told. */
  private readonly kinOf = new Map<string, Map<string, RoomKin & { at: number }>>();
  /** Summons the room struck down: refused until then (by `<owner>/<id>`). */
  private readonly kinDead = new Map<string, number>();
  /** Bites on each owner's summons since its last snapshot (its screen applies them). */
  private readonly kinEv = new Map<string, CoopEvent[]>();
  readonly kinStats = { told: 0, refused: 0, bites: 0, fell: 0 };

  constructor(opts: RoomWorldOptions) {
    this.area = opts.area;
    this.now = opts.now;
    this.seed = opts.seed;
    this.boot = (opts.boot ?? hashSeed(`${opts.seed}|boot`).toString(36)).replace(/[^a-z0-9]/g, '').slice(0, 12) || 'b';
    this.rng = seededRandom(hashSeed(`${opts.seed}|${opts.area}`));
    this.life = opts.life ?? (() => null);
    const def = opts.def ?? CONTINENTS[opts.area];
    const floor = !opts.def && !def && LEVELS[opts.area] ? new HandLevel(LEVELS[opts.area]) : null;
    this.surface = !floor;
    this.levelId = floor ? floor.id : 'surface';
    if (floor) this.level = floor;
    else { this.world = def ? new TdWorld(def) : new TdWorld(); this.level = this.world; }
    const world = this.level, surfaceWorld = floor ? null : this.world;
    const options: EngineOptions = {
      // The gear on top of the area's table, rolled here (drop-tables.ts) from the world's stream: the kill's key and
      // the creature's level decide it, never a Keeper's Magic Find (the room is nobody's).
      rollLoot: kill => this.rollLoot(kill).map((d, i) => lootEntry(d, `loot${i}`)),
      // Protocol 10: what a kill pays (its life's XP, the sky's lift), for the room's credit (room-credit.ts).
      onKill: ev => { const k = this.lastKill; if (k) this.killXp = { nid: k.nid, hp: ev.hp, xpK: ev.xp ?? 1 }; },
    } as Partial<EngineOptions> as EngineOptions;
    this.mobs = new MobSystem({
      options,
      walkable: (c, r) => world.walkable(c, r),
      levelId: () => this.levelId,
      // The room has no Keeper of its own: far away, and `selfAway` keeps every creature off it.
      player: () => ({ x: 1e7, y: 1e7 }),
      hurtPlayer: () => undefined,
      healPlayer: () => undefined,
      // The engine's own readings of the ground (td-engine's MobHost), so creatures walk, float and see as on a screen.
      hover: (c, r) => world.walkable(c, r) || world.ground(c, r) === 'ember' || world.ground(c, r) === 'blackwater',
      passable: (c, r) => { const g = world.ground(c, r); return g !== 'rock' && g !== 'wall' && g !== 'vinewall' && g !== 'bark'; },
      sight: (c, r) => { const g = world.ground(c, r); return g !== 'water' && g !== 'ember' && g !== 'blackwater' && g !== 'canopy' && !world.walkable(c, r); },
      swung: () => undefined,
      safeAt: (x, y) => !!surfaceWorld && surfaceWorld.safeAt(Math.floor(x / TILE), Math.floor(y / TILE)),
    });
    this.mobs.selfAway = true;
    // S6: the land its packs' auras come from (td-pack-aura landOf).
    this.mobs.land = landOf(this.levelId, def ? opts.area : '');
    // Elite packs as on every screen (td-elites.ts), and protocol 9's rest: each fallen spawn draws its own time
    // (respawn.ts: an ordinary creature 60–90 s, an elite longer, a boss about an hour) from this world's stream.
    this.mobs.elites = true;
    this.mobs.eliteSalt = hashSeed(`${opts.seed}|${opts.area}|elite`).toString(36);
    this.mobs.respawnOf = m => respawnSecs(m, Math.random);
    this.mobs.roomLoot = true;
    this.mobs.coop = this;
    this.mobs.aura = null;
    // Protocol 10: a Keeper's burn or bleed ticks here, each tick charged to that Keeper's budget.
    this.mobs.dotGate = (from, dmg) => this.dotSpend(from, dmg);
  }

  /** Lend this world's stream to Math.random for the length of `f` (MobSystem draws from Math.random). */
  private seeded<T>(f: () => T): T {
    const was = Math.random;
    Math.random = this.rng;
    try { return f(); } finally { Math.random = was; }
  }
  /** The sky over the island now (the same clock every screen reads). */
  sky(): SkyPhase { const ms = this.now(); return eclipseAt(ms) ? 'eclipse' : worldTime(ms).phase; }

  // ── Keepers ──
  /** A Keeper is in the area (or moved): the room's record of it. */
  keeper(k: RoomKeeper): void {
    const was = this.keepers.get(k.id);
    this.keepers.set(k.id, { ...k });
    if (!was || !this.viewers.has(k.id)) this.viewers.set(k.id, { enc: new CoopEncoder(), ev: [], fx: new WeakSet() });
  }
  /** A Keeper left the area (or the room). */
  leave(id: string): void { this.keepers.delete(id); this.viewers.delete(id); this.gate.forget(id); this.dropKin(id); }
  /** An owner's summons leave with it (its screen keeps them; another area's room hears them from there). */
  private dropKin(id: string): void {
    const had = this.kinOf.get(id);
    if (!had) return;
    this.kinOf.delete(id); this.kinEv.delete(id);
    for (const k of had.values()) for (const m of this.mobs.mobs) { forgetThreat(m, k.key); if (m.tauntBy === k.key) { m.taunt = 0; m.tauntBy = undefined; } }
    this.syncKin();
  }
  private syncKin(): void {
    const out: RoomKin[] = [];
    for (const list of this.kinOf.values()) for (const k of list.values()) if (k.hp > 0) out.push(k);
    this.mobs.kin = out;
  }
  /**
   * An owner's summons (its companions list, `/coop/pals` with `kin`): the room weighs each (room-kin.ts weighKin —
   * kind, count, leash, life) and its creatures hunt the ones it takes. Ones the list no longer names are gone
   * (released, crumbled on the owner's screen). Answers with the ids it took and the ones it refused.
   */
  kin(from: string, list: readonly KinWord[], g = 0): { ok: string[]; no: { i: string; why: KinRefusal }[] } {
    const k = this.keepers.get(from);
    if (!k) return { ok: [], no: list.map(w => ({ i: w.i, why: 'far' as const })) };
    const now = this.clockMs, was = this.kinOf.get(from) ?? new Map<string, RoomKin & { at: number }>();
    const held = new Map<string, KinHeld>();
    for (const [i, r] of was) held.set(i, { i, x: r.x, y: r.y, hp: r.hp, maxHp: r.maxHp, at: r.at });
    const dead = new Map<string, number>();
    for (const [key, until] of this.kinDead) { if (until <= now) this.kinDead.delete(key); else if (key.startsWith(`${from}/`)) dead.set(key.slice(from.length + 1), until); }
    const r = weighKin(list, k, held, dead, now), guard = kinGuard(g);
    const next = new Map<string, RoomKin & { at: number }>();
    for (const h of r.keep) next.set(h.i, { key: kinKey(from, h.i), owner: from, i: h.i, x: h.x, y: h.y, hp: h.hp, maxHp: h.maxHp, g: guard, at: h.at });
    // The ones it no longer names: forgotten (a creature on one looks again).
    for (const [i, old] of was) if (!next.has(i)) for (const m of this.mobs.mobs) { forgetThreat(m, old.key); if (m.tauntBy === old.key) { m.taunt = 0; m.tauntBy = undefined; } }
    if (next.size) this.kinOf.set(from, next); else this.kinOf.delete(from);
    this.syncKin();
    this.kinStats.told += r.keep.length; this.kinStats.refused += r.no.length;
    return { ok: r.keep.map(h => h.i), no: r.no.slice(0, 16) };
  }
  /** The summons the room holds now (tests, /health). */
  kinNow(owner?: string): RoomKin[] { return this.mobs.kin.filter(k => owner === undefined || k.owner === owner).map(k => ({ ...k })); }
  get present(): string[] { return [...this.keepers.keys()]; }
  get empty(): boolean { return this.keepers.size === 0; }
  /** The next snapshot to this viewer is whole (its stream reopened, a send was lost). */
  resync(id: string): void { this.viewers.get(id)?.enc.keyframe(); }

  // ── The tick ──
  /** Advance the world `dt` seconds: the sky, the spawns round every Keeper, the creatures, then the loot harvested. */
  tick(dt: number): void {
    if (!(dt > 0)) return;
    const d = Math.min(dt, .25);
    // A late step (a stalled loop) simulates at most a quarter second, but the fallen's rest runs on real time.
    if (dt > d) this.mobs.idle(dt - d);
    this.clockMs += dt * 1000;
    this.stats.ticks++;
    this.seeded(() => {
      this.mobs.setPhase(this.sky(), this.surface);
      // A Keeper the room holds down (protocol 10) is not hunted.
      const others = [...this.keepers.values()].filter(k => !this.life(k.id)?.down).map(k => ({ id: k.id, x: k.x, y: k.y }));
      this.mobs.others = others;
      this.spawnT -= d;
      if (this.spawnT <= 0) {
        this.spawnT = .5;
        if (this.surface) {
          for (const o of others) this.mobs.addSpawns(this.world.spawnsIn(o.x - SPAWN_REACH, o.y - SPAWN_REACH, o.x + SPAWN_REACH, o.y + SPAWN_REACH));
          this.mobs.prune(PRUNE);
          this.updateSeam(this.sky());
        } else if (others.length) {
          // A floor is small and walled: all of it lives at once (Tibia), and nothing on it is ever forgotten.
          this.mobs.addSpawns(this.level.spawnsIn(-1e6, -1e6, 1e6, 1e6));
        }
        this.scaleBosses();
      }
      this.bosses(d);
      this.mobs.update(d);
    });
    this.harvest();
    this.expire();
  }

  /**
   * Protocol 9: time passes in an area with nobody in it (the "dormant tick"). Nothing moves and nothing is drawn, but the
   * fallen rest on toward their rising, the ground crumbles on time, and the world bosses keep their clocks — so a
   * Keeper who comes back finds what he left, minus what has risen again since.
   */
  idle(dt: number): void {
    if (!(dt > 0)) return;
    this.clockMs += dt * 1000;
    this.mobs.idle(dt);
    this.seeded(() => this.bosses(dt));
    this.harvest();
    this.expire();
  }
  /** The resting spawns now (key → seconds left): the specs and /health read it. */
  restingNow(): [string, number][] { return this.mobs.restingList(); }

  // ── World bosses (protocol 9; world-bosses.ts) ──
  /** Once a second: each of this area's world bosses rises when its clock says, leaves when its stay is over. */
  private bosses(dt: number): void {
    this.bossT -= dt;
    if (this.bossT > 0) return;
    this.bossT = 1;
    const now = this.now();
    for (const b of worldBossesIn(this.area)) {
      if (!this.surface) continue;
      let c = this.wb.get(b.id);
      if (!c) { c = { next: firstRising(b, now, Math.random) }; this.wb.set(b.id, c); this.dirty = true; }
      const m = this.wbUp.get(b.id);
      if (m && !this.mobs.mobs.includes(m)) {
        // Felled (or gone some other way): the next rising is hours off.
        this.wbUp.delete(b.id);
        if (m.hp <= 0) this.omen(b, 'fall', m.x, m.y);
        this.wb.set(b.id, { next: nextRising(b, now, Math.random) }); this.dirty = true;
        continue;
      }
      if (m && c.up && now >= c.up.until) {
        // Its stay is over and nobody felled it: it leaves, with its pack.
        for (const o of [...this.mobs.mobs]) if (o === m || o.key.startsWith(`${m.key}~`)) this.mobs.banish(o);
        this.wbUp.delete(b.id);
        this.omen(b, 'gone', m.x, m.y);
        this.wb.set(b.id, { next: nextRising(b, now, Math.random) }); this.dirty = true;
        continue;
      }
      if (m) { c.up = { until: c.up?.until ?? now + b.stay * 3600000, x: Math.round(m.x), y: Math.round(m.y) }; continue; }
      if (c.up && c.up.until > now) { this.raiseBoss(b, c.up.x, c.up.y, false); continue; }
      if (c.up) { this.wb.set(b.id, { next: nextRising(b, c.up.until, Math.random) }); this.dirty = true; continue; }
      if (now < c.next) continue;
      const at = this.bossSpot(b);
      if (!at) { this.wb.set(b.id, { next: now + 600000 }); continue; }
      this.wb.set(b.id, { next: c.next, up: { until: now + b.stay * 3600000, x: at.x, y: at.y } });
      this.raiseBoss(b, at.x, at.y, true);
      this.dirty = true;
    }
  }
  /** A world boss rises at (x, y): a named unique leader of its creature, its life and blows its own, its pack beside it. */
  private raiseBoss(b: WorldBossDef, x: number, y: number, announce: boolean): Mob | null {
    const base = MOBS[b.base];
    if (!base) return null;
    const def = { ...atZoneLevel(base, b.level), bound: { leash: 18 } };
    const pack = this.mobs.spawnPack(WORLD_BOSS_KEY(b.id), def, x, y, makePack('unique', b.affixes, b.name, b.followers));
    const m = pack[0];
    if (!m) return null;
    m.def = { ...m.def, hp: Math.round(m.def.hp * b.life), dmg: [Math.round(m.def.dmg[0] * b.blows), Math.round(m.def.dmg[1] * b.blows)] };
    m.hp = m.def.hp;
    this.wbUp.set(b.id, m);
    if (announce) this.omen(b, 'rise', x, y);
    return m;
  }
  private omen(b: WorldBossDef, at: WorldOmen['at'], x: number, y: number): void {
    this.omens.push({ boss: b.id, name: b.name, area: this.area, at, level: b.level, x: Math.round(x), y: Math.round(y) });
  }
  /** The omens since the last call (the room tells the whole world). */
  flushOmens(): WorldOmen[] { const o = this.omens; this.omens = []; return o; }
  /** The world bosses up now (the specs, /health). */
  bossesUp(): { id: string; hp: number; max: number; x: number; y: number }[] {
    return [...this.wbUp].filter(([, m]) => this.mobs.mobs.includes(m)).map(([id, m]) => ({ id, hp: Math.round(m.hp), max: Math.round(m.def.hp), x: Math.round(m.x), y: Math.round(m.y) }));
  }
  /** The clocks (the specs). */
  bossClock(id: string): WorldBossClock | null { return this.wb.get(id) ?? null; }
  /**
   * A random spot in one of the boss's regions: a block of the continent's map drawn in that region, then the nearest
   * open tile to its middle that is wild (no town's safety) and clear of every way down (arriving is never an ambush).
   */
  private bossSpot(b: WorldBossDef): { x: number; y: number } | null {
    const def = this.world.def, B = 8;
    if (!this.wbSpots) {
      this.wbSpots = [];
      def.map.forEach((row, by) => { for (let bx = 0; bx < row.length; bx++) if (b.regions.includes(row[bx] as never)) this.wbSpots!.push({ c: (bx - def.ox) * B + B / 2, r: (by - def.oy) * B + B / 2 }); });
    }
    const spots = this.wbSpots.filter(p => b.regions.includes(this.world.regionAt(p.c, p.r)));
    for (let tries = 0; tries < 12 && spots.length; tries++) {
      const p = spots[Math.floor(Math.random() * spots.length)];
      for (let rad = 0; rad <= 4; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        const c = p.c + dc, r = p.r + dr;
        if (!this.world.walkable(c, r) || this.world.safeAt(c, r)) continue;
        if (def.places.some(pl => (pl.kind === 'cave' || pl.kind === 'crypt' || pl.kind === 'forge' || pl.kind === 'temple' || pl.kind === 'harbour') && Math.hypot(pl.c - c, pl.r - r) < 14)) continue;
        return { x: c * TILE + TILE / 2, y: r * TILE + TILE };
      }
    }
    return null;
  }
  /** The loot of a kill, rolled here: the creature's table, and a world boss's own on top (its rolls, its uniques). */
  private rollLoot(kill: { creature: string; level: number; rank: string; killKey: string; mf?: number; named?: number }): LootDrop[] {
    const rng = seededRandom(hashSeed(`${this.seed}|loot|${kill.killKey}`));
    const ctx = { creature: kill.creature, level: kill.level, tier: 'normal' as const, magicFind: Math.max(0, kill.mf ?? 0), rank: kill.rank as MonsterRank, ...(kill.named ? { named: kill.named } : {}) };
    const out = rollCreatureLoot(ctx, rng);
    const b = worldBossOfKey(kill.killKey);
    if (!b) return out;
    for (let i = 0; i < b.loot.rolls; i++) out.push(...rollCreatureLoot({ ...ctx, rank: 'unique' }, rng));
    if (rng() < b.loot.chance) {
      const u = uniqueById(b.loot.uniques[Math.floor(rng() * b.loot.uniques.length)]);
      if (u) out.push({ kind: 'item', definitionId: u.id, rarity: u.rarity, unique: true, name: u.name, level: kill.level });
    }
    return out;
  }

  /** The Seam Eater's glue (td-engine updateSeam, the room's copy): rises near a Keeper under the eclipse, leaves after it. */
  private updateSeam(phase: SkyPhase): void {
    if (this.seam && !this.mobs.mobs.includes(this.seam)) {
      if (this.seam.hp <= 0) { const e = eclipseAt(this.now()); this.seamSlainUntil = e ? e.endMs : 0; this.dirty = true; }
      this.seam = null;
    }
    if (this.seam && seamLeaves(phase)) { this.mobs.banish(this.seam); this.seam = null; }
    if (this.seam || !this.keepers.size || !this.surface) return;
    if (this.rift === undefined) {
      const at = riftPlace(this.world.def), t = at ? riftTile(this.world, at) : null;
      this.rift = t ? { x: t.c * TILE + TILE / 2, y: t.r * TILE + TILE } : null;
    }
    const rift = this.rift;
    if (!rift) return;
    let dist = Infinity;
    for (const k of this.keepers.values()) dist = Math.min(dist, Math.hypot(rift.x - k.x, rift.y - k.y) / TILE);
    const slain = this.now() < this.seamSlainUntil;
    if (seamRises({ phase, surface: true, slain, up: false, dist })) {
      const def = seamEaterAt(MOBS[SEAM_ID], seamLevelFor(this.world.continent));
      this.seam = this.mobs.place(`seam:${this.world.continent}:${Math.round(this.clockMs / 1000)}`, def, rift.x, rift.y);
    }
  }
  /** A boss's life for the Keepers near it: +60% for each beyond the first (up to four), its wound kept in proportion. */
  private scaleBosses(): void {
    const reach = COOP_RANGE_TILES * TILE;
    for (const m of this.mobs.mobs) {
      if (m.def.rank !== 'boss' && m.def.id !== SEAM_ID) continue;
      let n = 0;
      for (const k of this.keepers.values()) if (Math.hypot(k.x - m.x, k.y - m.y) <= reach) n++;
      n = Math.max(1, Math.min(4, n));
      if (n <= 1 && !m.coopN) continue;
      this.mobs.scaleBoss(m, coopBossLife(m.coopBase ?? m.def.hp, n), n);
    }
  }

  // ── CoopLink (the creatures tell the room) ──
  private nid(m: Mob): string { return m.nid ??= (this.nidSeq++).toString(36); }
  /** A creature struck a Keeper: that Keeper's next snapshot carries it (it lands through its own defenses). */
  bite(to: string, from: Mob | null, dmg: number, type: string, burn: boolean, curse: boolean, st?: string): void {
    const v = this.viewers.get(to);
    if (!v) return;
    const d = Math.max(1, Math.min(100000, Math.round(dmg))), status = st && STATUS_WIRE.test(st) ? st : '';
    const life = this.life(to);
    if (life?.down) return;
    const now = this.now();
    // S5: the allies' guards the room keeps — the strongest Banner or Gate reaching it cuts the blow, and an Intercept
    // bond hands its share to the tank (through his own guard). The screen mirrors both (its `ally` events).
    const shield = this.guardOn(to, now);
    let n = shield.cut > 0 ? Math.max(1, Math.round(d * (1 - shield.cut / 100))) : d;
    if (life && n > 1 && !(status && d <= 1)) for (const b of this.bondsOn(to, now)) {
      const share = Math.round(n * b.share / 100), tl = this.life(b.tank);
      if (!(share > 0) || !tl || tl.down) continue;
      tl.bite(share, type, from?.def.level, now);
      this.viewers.get(b.tank)?.ev.push({ k: 'bite', to: b.tank, ...(from ? { i: this.nid(from) } : {}), d: share, ty: type });
      n = Math.max(1, n - share);
    }
    // Protocol 10: the room's own cut, off the life it keeps (the screen shows the same blow through its own wards).
    life?.bite(n, type, from?.def.level, now, !!status && d <= 1);
    v.ev.push({ k: 'bite', to, ...(from ? { i: this.nid(from) } : {}), d, ty: type, ...(burn ? { b: true } : {}), ...(curse ? { c: true } : {}), ...(status ? { st: status } : {}) });
  }
  /** CoopLink: a creature struck a Keeper's summon (td-mobs biteKin, its guard already taken): its owner hears it. */
  kinBite(k: RoomKin, from: Mob | null, dmg: number): void {
    const d = Math.max(0, Math.min(100000, Math.round(dmg))), fell = k.hp <= 0;
    this.kinStats.bites++;
    const list = this.kinEv.get(k.owner) ?? [];
    list.push({ k: 'kin', to: k.owner, p: k.i, d, ...(from ? { i: this.nid(from) } : {}), ...(fell ? { x: 1 as const } : {}) });
    this.kinEv.set(k.owner, list.slice(-24));
    if (fell) {
      this.kinStats.fell++;
      this.kinDead.set(k.key, this.clockMs + KIN_DEAD_MS);
      this.kinOf.get(k.owner)?.delete(k.i);
      this.syncKin();
    }
  }
  /** Protocol 10: a Keeper went down (the room's life): everyone near sees it fall. */
  downed(id: string): void {
    const k = this.keepers.get(id);
    if (!k) return;
    const reach = COOP_RANGE_TILES * TILE;
    for (const [vid, v] of this.viewers) {
      const o = this.keepers.get(vid);
      if (vid === id || (o && Math.hypot(o.x - k.x, o.y - k.y) <= reach)) v.ev.push({ k: 'down', to: id, x: Math.round(k.x), y: Math.round(k.y) });
    }
    // Nothing keeps after it: its creatures forget it at once (its taunts and its threat).
    for (const m of this.mobs.mobs) { if (m.tauntBy === id) { m.taunt = 0; m.tauntBy = undefined; } forgetThreat(m, id); }
    // S5: where and when it fell — a Lanternwright's Rekindle reads it; its bonds and auras end.
    this.fallen.set(id, { at: this.now(), x: Math.round(k.x), y: Math.round(k.y) });
    this.bonds.delete(id);
    for (const [key, a] of this.auras) if (a.by === id) this.auras.delete(key);
  }
  /** The kills since the last call, with what each pays (protocol 10: the room's credit). */
  flushKills(): RoomKill[] { const k = this.paid; this.paid = []; return k; }
  private lastKill: { nid: string; by: string[]; m: Mob } | null = null;
  /** A creature fell: every Keeper near hears who fought it; its loot (rolled next, in spoils) is theirs first. */
  killed(m: Mob, by: string[]): void {
    // The kill before this one has had its spoils by now: keep what it pays.
    this.settleKill();
    const nid = this.nid(m);
    const fought = by.filter(Boolean).slice(0, 8);
    this.kills.push({ nid, by: fought, at: this.mobs.drops.length });
    this.stats.kills++;
    this.lastKill = { nid, by: fought, m };
    this.killXp = null;
    const base = Math.round((m.coopBase ?? m.def.hp) / (this.mobs.tier.hp || 1));
    const ev: CoopEvent = {
      k: 'kill', i: nid, t: m.def.id, l: Math.max(1, Math.min(999, m.def.level)), h: Math.max(1, Math.min(100000, base)), by: fought,
      x: Math.round(m.x), y: Math.round(m.y), ...(m.elite ? { e: wireElite(m.elite)! } : {}), ...(/^[a-z0-9:,~._-]{1,80}$/.test(m.key) ? { key: m.key } : {}),
      // S6: a raised one or a mirror owes nothing.
      ...(m.raised || m.mirror ? { xp: NOTHING_OWED } : {}),
      // Protocol 10: the id the room pays this kill under (room-credit.ts), the same on every screen.
      cr: `k.${this.boot}.${nid}`,
    };
    const reach = COOP_RANGE_TILES * TILE;
    for (const [id, v] of this.viewers) {
      const k = this.keepers.get(id);
      if (k && (Math.hypot(k.x - m.x, k.y - m.y) <= reach || fought.includes(id))) v.ev.push(ev);
    }
    this.dirty = true;
  }
  /** After a kill's spoils (MobSystem.kill → spoils → onKill): what it pays, kept for the room's credit. */
  private settleKill(): void {
    const k = this.lastKill, x = this.killXp;
    this.lastKill = null; this.killXp = null;
    if (!k || !x || x.nid !== k.nid || k.m.raised || k.m.mirror) return;
    this.paid.push({ id: `k.${this.boot}.${k.nid}`, nid: k.nid, creature: k.m.def.id, level: k.m.def.level, hp: x.hp, xpK: x.xpK, by: k.by, x: Math.round(k.m.x), y: Math.round(k.m.y) });
    if (this.paid.length > 512) this.paid.splice(0, this.paid.length - 512);
  }
  /** (A member's hook: the room is never a member.) */
  claim(): void { /* the room's creatures take blows through claims(), never this */ }

  // ── Claims (a Keeper's blows, as intents) ──
  /**
   * A Keeper's blows on the room's creatures. Each one: the creature exists and lives; the Keeper stands within the
   * gate's reach of it by the room's record, with a clear line unless at its side; its damage within its level's budget
   * over the gate's window (clipped past it). What passes lands through the creature's own path.
   */
  claims(from: string, hits: readonly CoopHit[]): { landed: number; refused: number; dmg: number; no: { i: string; why: RoomRefusal }[] } {
    const k = this.keepers.get(from);
    let landed = 0, refused = 0, dmg = 0;
    const no: { i: string; why: RoomRefusal }[] = [];
    if (!k) return { landed, refused: hits.length, dmg, no };
    const now = this.clockMs;
    const nay = (i: string, why: RoomRefusal) => { refused++; if (!no.some(n => n.i === i && n.why === why)) no.push({ i, why }); };
    this.seeded(() => {
      for (const h of hits) {
        const m = this.mobs.mobs.find(x => x.nid === h.i) ?? null;
        const d = m ? Math.hypot(m.x - k.x, m.y - k.y) : 0;
        // Too far first (the gate's own reach), then the line: a wall between them stops a blow as it stops a shot.
        if (m && d <= CLAIM_RANGE_TILES * TILE && d > LOS_FREE && !this.mobs.sight.sees(k.x, k.y, m.x, m.y)) { nay(h.i, 'sight'); this.stats.refusedSight++; continue; }
        const r = this.gate.check(h, { id: from, x: k.x, y: k.y, level: k.level, ...(k.dps ? { dps: k.dps } : {}) }, m ? { x: m.x, y: m.y, hp: m.hp } : null, now);
        if (!r.ok || !m) {
          const why = !r.ok ? r.why : 'gone';
          nay(h.i, why);
          if (why === 'far') this.stats.refusedFar++; if (why === 'cap') this.stats.refusedCap++;
          continue;
        }
        // A summon's blow (`k`): its threat is its own — only for a summon the room holds for this Keeper.
        const kin = h.k && this.kinOf.get(from)?.has(h.k) ? h.k : '';
        landed++; dmg += this.mobs.applyClaim(m, r.dmg, from, !!h.c, h.el, h.s, kin);
      }
    });
    this.stats.claimsIn += landed; this.stats.claimsRefused += refused;
    this.harvest();
    return { landed, refused, dmg, no: no.slice(0, 24) };
  }

  /**
   * Protocol 10: a Keeper's statuses on the room's creatures (room-status.ts). Each one: the creature exists and lives;
   * the Keeper stands within reach and sight of it by the room's record (as a blow); the status is one the named skill
   * and mark can lay by the game's data; at most STATUS_PER_SEC a second; its seconds the room's own (STATUS_CAP, a
   * boss a fifth); a creature that just shook off a stun, root or fear is immune a while; a burn's or bleed's damage a
   * second within the Keeper's budget (the room ticks it, charged to that budget). Laid through the creature's own path.
   */
  statuses(from: string, list: readonly CoopStatus[], perSec = 24): { landed: number; refused: number; no: { i: string; why: RoomRefusal }[] } {
    const k = this.keepers.get(from);
    let landed = 0, refused = 0;
    const no: { i: string; why: RoomRefusal }[] = [];
    if (!k) return { landed, refused: list.length, no };
    const nay = (i: string, why: RoomRefusal) => { refused++; this.stats.statusRefused++; if (!no.some(n => n.i === i && n.why === why)) no.push({ i, why }); };
    const now = this.clockMs;
    const rate = (this.stRate.get(from) ?? []).filter(t => now - t < 1000);
    this.seeded(() => {
      for (const c of list) {
        if (!statusLegal(c.s, c.m, c.k)) { nay(c.i, 'illegal'); continue; }
        const m = this.mobs.mobs.find(x => x.nid === c.i) ?? null;
        if (!m) { nay(c.i, 'gone'); continue; }
        if (m.hp <= 0) { nay(c.i, 'dead'); continue; }
        const d = Math.hypot(m.x - k.x, m.y - k.y);
        if (d > CLAIM_RANGE_TILES * TILE) { nay(c.i, 'far'); continue; }
        if (d > LOS_FREE && !this.mobs.sight.sees(k.x, k.y, m.x, m.y)) { nay(c.i, 'sight'); continue; }
        if (rate.length >= perSec) { nay(c.i, 'rate'); continue; }
        rate.push(now);
        // Its own seconds: what was asked, never past the kind's cap (applyStatus makes a boss's a fifth).
        const secs = Math.min(STATUS_CAP[c.k], Math.max(0, c.t / 10));
        const im = this.immune.get(m) ?? {};
        const held = c.k === 'stun' || c.k === 'root' || c.k === 'fear';
        // Held once, it shakes off another of the same until that one is over and CC_IMMUNE more (no endless chain).
        if (held && (im[c.k] ?? 0) > now) { nay(c.i, 'immune'); continue; }
        let dps = 0;
        if (c.k === 'burn' || c.k === 'bleed') {
          const budget = (k.dps ?? 0) > 0 ? k.dps as number : 40 + 20 * Math.max(1, k.level);
          dps = Math.max(0, Math.min(c.d ?? 0, Math.round(budget * DOT_SHARE)));
          if (!(dps > 0)) { nay(c.i, 'bad'); continue; }
        }
        const ok = this.mobs.roomStatus(m, c.k, secs, {
          by: from, at: { x: k.x, y: k.y }, dps, pct: Math.min(SLOW_MAX_PCT, Math.max(0, c.n ?? 0)), tiles: Math.min(PULL_MAX_TILES, Math.max(0, (c.n ?? 0) / 10)),
        });
        if (!ok) { nay(c.i, 'bad'); continue; }
        // A Captain of the Dead's taunt (Raise Skeleton's mark): it turns on the Captain — this Keeper's summon nearest it.
        if (c.k === 'taunt' && c.s === 'raise-skeleton') {
          let best: RoomKin | null = null, bd = (CAPTAIN_REACH + 2) * TILE;
          for (const kk of this.kinOf.get(from)?.values() ?? []) { const dk = Math.hypot(kk.x - m.x, kk.y - m.y); if (kk.hp > 0 && dk <= bd) { bd = dk; best = kk; } }
          if (best) m.tauntBy = best.key;
        }
        if (held) { im[c.k] = now + secs * 1000 + CC_IMMUNE * 1000; this.immune.set(m, im); }
        // Fighting it with a status is fighting it (its loot is this Keeper's first too).
        (m.coopBy ??= new Set()).add(from);
        landed++; this.stats.statusIn++;
      }
    });
    this.stRate.set(from, rate);
    return { landed, refused, no: no.slice(0, 24) };
  }
  // ── S5: heals, wards and guards on allies (ally-claims.ts) ──
  /** The strongest guard (a Banner, a Gate…) another Keeper's aura lays on `to` now: its cut %, and its flags. */
  private guardOn(to: string, now: number): { cut: number; f: number } {
    const k = this.keepers.get(to);
    let cut = 0, f = 0;
    if (!k) return { cut, f };
    for (const [key, a] of this.auras) {
      if (a.until <= now) { this.auras.delete(key); continue; }
      if (a.by === to) continue;
      const o = this.keepers.get(a.by);
      if (!o || Math.hypot(o.x - k.x, o.y - k.y) > a.r) continue;
      if (a.cut > cut) cut = a.cut;
      f |= a.f;
    }
    return { cut: Math.min(60, cut), f };
  }
  /** The live Intercept bonds on `to` (expired ones dropped; a tank who left takes nothing). */
  private bondsOn(to: string, now: number): { tank: string; share: number }[] {
    const list = (this.bonds.get(to) ?? []).filter(b => b.until > now && this.keepers.has(b.tank));
    if (list.length) this.bonds.set(to, list); else this.bonds.delete(to);
    return list;
  }
  /** An effect laid on `to` by another Keeper: its screen mirrors it with its next snapshot. */
  private tell(to: string, e: CoopEvent): void {
    const list = this.allyEv.get(to) ?? [];
    if (list.length < 16) list.push(e);
    this.allyEv.set(to, list);
  }
  /**
   * S5: a Keeper's heals, wards, cleanses, Rekindles, bonds and auras on others (the `/world/life` body's `a`). Each is
   * weighed (ally-claims allyLegal: the skill, the level, the reach by the room's record; then the level's heal budget
   * over the window, Rekindle's clock and the fall's place, a rate) and what passes lands on the target's life the room
   * keeps, with an `ally` event to its screen. Healing makes threat ×0.5 on the creatures fighting the healed (td-threat).
   * Returns, for each claim, what it moved (a heal's life, a ward's absorb, 1 for the rest) or why it was refused.
   */
  allies(from: string, list: readonly AllyClaim[]): (number | AllyRefusal)[] {
    const k = this.keepers.get(from);
    const now = this.now();
    if (!k) return list.map(() => 'nobody');
    const rate = (this.allyRate.get(from) ?? []).filter(t => now - t < 1000);
    const log = (this.allyHeals.get(from) ?? []).filter(e => now - e.at < ALLY_WINDOW_MS);
    const out: (number | AllyRefusal)[] = [];
    const nay = (why: AllyRefusal) => { this.allyStats.refused++; out.push(why); };
    for (const c of list) {
      if (rate.length >= ALLY_PER_SEC) { nay('rate'); continue; }
      rate.push(now);
      const to = c.to ? this.keepers.get(c.to) ?? null : null;
      const why = allyLegal(c, k, to);
      if (why) { nay(why); continue; }
      this.allyStats.claims++;
      if (c.k === 'aura') {
        // The holder's guard on those near it, until it is said again (the screen repeats it while it runs).
        const r = Math.max(0, Math.min(11, (c.r ?? 0) / 10)) * TILE, until = now + Math.max(500, (c.t ?? 20) * 100);
        this.auras.set(`${from}|${c.s}`, { by: from, s: c.s, cut: CUT_AURAS.has(c.s) ? c.n : 0, r, until, f: c.f ?? 0 });
        for (const o of this.keepers.values()) if (o.id !== from && Math.hypot(o.x - k.x, o.y - k.y) <= r) this.tell(o.id, { k: 'ally', to: o.id, a: 'aura', by: from, s: c.s, n: c.n, t: Math.round((until - now) / 100), ...(c.f ? { f: c.f } : {}) });
        out.push(1);
        continue;
      }
      const tl = this.life(to!.id);
      if (!tl) { nay('nobody'); continue; }
      if (c.k === 'rekindle') {
        const fell = this.fallen.get(to!.id);
        if (!fell || now - fell.at > REKINDLE_MAX_MS) { nay('late'); continue; }
        if (Math.hypot(fell.x - k.x, fell.y - k.y) > (REKINDLE_REACH + 1) * TILE) { nay('far'); continue; }
        if (now - (this.rekindled.get(from) ?? -Infinity) < REKINDLE_MIN_CD_MS) { nay('cooldown'); continue; }
        this.rekindled.set(from, now); this.fallen.delete(to!.id);
        const n = tl.rekindle(c.n);
        this.allyStats.rekindles++;
        this.tell(to!.id, { k: 'ally', to: to!.id, a: 'rekindle', by: from, s: c.s, n: c.n, x: fell.x, y: fell.y });
        out.push(n);
        continue;
      }
      if (tl.down) { nay('down'); continue; }
      if (c.k === 'heal') {
        const spent = log.reduce((a, e) => a + e.n, 0), room = allyHealBudget(k.level) * ALLY_WINDOW_MS / 1000 - spent;
        if (room <= 0) { nay('budget'); continue; }
        const want = Math.min(c.n, room);
        const n = tl.allyHeal(want, now);
        log.push({ at: now, n: want });
        this.allyStats.healed += n;
        healThreat(this.mobs.mobs, to!.id, from, n);
        if (n > 0) this.tell(to!.id, { k: 'ally', to: to!.id, a: 'heal', by: from, s: c.s, n });
        out.push(n);
      } else if (c.k === 'ward') {
        // The ward is the target's screen's to hold (its soaks are claims the room bounds by the bites it took). A vow's
        // copy (Vow for Two) is the room's: it holds the life on its last point a few seconds.
        this.allyStats.wards++;
        if ((c.f ?? 0) & 2) tl.vowUntil = now + Math.max(0, Math.min(50, c.t ?? 40)) * 100;
        this.tell(to!.id, { k: 'ally', to: to!.id, a: 'ward', by: from, s: c.s, n: c.n, t: c.t ?? 120, ...(c.f ? { f: c.f } : {}) });
        out.push(c.n);
      } else if (c.k === 'cleanse') {
        this.tell(to!.id, { k: 'ally', to: to!.id, a: 'cleanse', by: from, s: c.s, n: c.n, ...(c.f ? { f: c.f } : {}), ...(c.t ? { t: c.t } : {}) });
        out.push(1);
      } else if (c.k === 'bond') {
        const share = Math.max(0, Math.min(70, c.n)), until = now + Math.max(0, Math.min(110, c.t ?? 60)) * 100;
        const mine = (this.bonds.get(to!.id) ?? []).filter(b => b.tank !== from);
        mine.push({ tank: from, share, until });
        this.bonds.set(to!.id, mine.slice(-2));
        this.tell(to!.id, { k: 'ally', to: to!.id, a: 'bond', by: from, s: c.s, n: share, t: c.t ?? 60, ...(c.f ? { f: c.f } : {}) });
        out.push(1);
      }
    }
    this.allyRate.set(from, rate);
    this.allyHeals.set(from, log);
    return out;
  }
  /** A Keeper healed itself `n` (its own life claims): threat on what fights it, ×0.5 (td-threat). */
  selfHealed(id: string, n: number): void { if (n > 0) healThreat(this.mobs.mobs, id, id, n); }
  /** Protocol 10: a burn's or a bleed's tick, charged to its Keeper's claim budget (what is left of it). */
  dotSpend(from: string, dmg: number): number {
    const k = this.keepers.get(from);
    if (!k) return 0;
    return this.gate.spend(from, dmg, (k.dps ?? 0) > 0 ? k.dps as number : 40 + 20 * Math.max(1, k.level), this.clockMs);
  }

  // ── Snapshots ──
  /** What one Keeper is sent now: the creatures near it (nearest first), as a delta on what it was last sent. */
  snapFor(id: string): CoopSnapBody | null {
    const v = this.viewers.get(id), k = this.keepers.get(id);
    if (!v || !k) return null;
    const reach = COOP_RANGE_TILES * TILE;
    const near: { m: Mob; d: number }[] = [];
    for (const m of this.mobs.mobs) {
      const d = Math.hypot(m.x - k.x, m.y - k.y);
      if (d <= reach || m.def.bound) near.push({ m, d });
    }
    near.sort((a, b) => a.d - b.d);
    const snap = v.enc.encode(this.clockMs, near.slice(0, COOP_MAX_MOBS).map(n => this.stateOf(n.m)));
    // Shots and bursts near this Keeper it has not been shown (pictures only: the room decides what hits).
    for (const s of this.mobs.shots) {
      if (v.fx.has(s)) continue;
      v.fx.add(s);
      if (Math.hypot(s.x - k.x, s.y - k.y) <= reach) v.ev.push({ k: 'shot', x: Math.round(s.x), y: Math.round(s.y), vx: Math.round(s.vx), vy: Math.round(s.vy), s: s.kind, l: Math.max(0, Math.min(10, s.life - s.age)) });
    }
    for (const b of this.mobs.bursts) {
      if (v.fx.has(b)) continue;
      v.fx.add(b);
      if (Math.hypot(b.x - k.x, b.y - k.y) <= reach) v.ev.push({ k: 'burst', x: Math.round(b.x), y: Math.round(b.y), r: Math.max(1, Math.min(400, Math.round(b.r))), t: Math.max(0, Math.min(10, b.t)), ...(b.el ? { el: b.el } : {}) });
    }
    // S6: hostile ground (pictures and statuses; the room decides damage).
    for (const h of this.mobs.hazards) {
      if (v.fx.has(h)) continue;
      v.fx.add(h);
      if (Math.hypot(h.x - k.x, h.y - k.y) <= reach) v.ev.push(fieldEvent(h));
    }
    // Bites and kills first; pictures fill what room is left (a picture that does not fit is simply not shown).
    const firm = v.ev.filter(e => e.k === 'bite' || e.k === 'kill'), soft = v.ev.filter(e => e.k !== 'bite' && e.k !== 'kill');
    // S5: what other Keepers laid on this one (heals, wards, bonds…) goes first: it is its life.
    const mine = [...this.allyEv.get(id) ?? [], ...this.kinEv.get(id) ?? []];
    this.allyEv.delete(id); this.kinEv.delete(id);
    const ev = [...mine, ...[...firm, ...soft].slice(0, COOP_MAX_EVENTS)];
    v.ev = firm.slice(COOP_MAX_EVENTS);
    // S5: the life of the Keepers near it, as the room keeps it (a healer's lowest-ally pick; the plates' bars).
    const al: [string, number, number, number][] = [];
    for (const o of this.keepers.values()) {
      if (o.id === id || Math.hypot(o.x - k.x, o.y - k.y) > reach) continue;
      const ol = this.life(o.id);
      if (ol) al.push([o.id, Math.max(0, Math.round(ol.hp)), ol.max, ol.down ? 1 : 0]);
      if (al.length >= 12) break;
    }
    // Protocol 10: the life the room keeps for this Keeper, with the last of its claims it took.
    const life = this.life(id);
    return { area: this.area, seq: snap.seq, kf: snap.kf, mobs: snap.mobs, gone: snap.gone.slice(0, 64), ev, ...(life ? { me: life.view() } : {}), ...(al.length ? { al } : {}) };
  }
  /** One creature on the wire (td-coop stateOf, the same fields). */
  stateOf(m: Mob): CoopMobState {
    return {
      i: this.nid(m), t: m.def.id, ...(/^[a-z0-9:,~._-]{1,80}$/.test(m.key) ? { k: m.key } : {}), x: m.x, y: m.y, f: m.face, h: Math.max(0, m.hp), m: m.def.hp,
      l: Math.max(1, Math.min(999, m.def.level)), e: wireElite(m.elite), tl: m.tell > 0 ? m.tell * 10 : 0, ax: m.tell > 0 && m.aim ? m.aim.x : 0, ay: m.tell > 0 && m.aim ? m.aim.y : 0,
      fl: (m.halved ? FL_HALVED : 0) | (m.summoned ? FL_SUMMONED : 0) | ((m.chantT ?? 0) > 0 ? FL_CHANT : 0) | abilityFlags(m),
      // Protocol 10: the statuses it carries (every screen draws them; an older one ignores the field).
      ...(this.statusBits(m) ? { st: this.statusBits(m) } : {}),
    };
  }
  /** The statuses a creature carries now, as the wire's one number (room-status ST_BIT). */
  statusBits(m: Mob): number {
    const on = (v: number | undefined) => (v ?? 0) > 0;
    return (on(m.stun) ? ST_BIT.stun : 0) | (on(m.rootT) ? ST_BIT.root : 0) | (on(m.chillT) ? ST_BIT.chill : 0) | (on(m.fearT) ? ST_BIT.fear : 0)
      | (on(m.blindT) ? ST_BIT.blind : 0) | (on(m.hushT) ? ST_BIT.hush : 0) | (on(m.taunt) ? ST_BIT.taunt : 0) | (on(m.slowT) ? ST_BIT.slow : 0)
      | (on(m.scorchT) ? ST_BIT.burn : 0) | (on(m.bleedT) ? ST_BIT.bleed : 0) | (m.stripped ? ST_BIT.strip : 0);
  }

  // ── The ground ──
  /** Move what the kills of this tick left (MobSystem.spoils) onto the room's ground, owned by who fought. */
  private harvest(): void {
    this.settleKill();
    const drops = this.mobs.drops;
    if (!drops.length) { this.kills = []; return; }
    const now = this.now();
    const marks = this.kills;
    for (let i = 0; i < drops.length; i++) {
      let owner: { nid: string; by: string[] } | null = null;
      for (const k of marks) if (k.at <= i) owner = k;
      this.layDrop(drops[i], owner, now);
    }
    drops.length = 0;
    this.kills = [];
  }
  private layDrop(g: Drop, from: { nid: string; by: string[] } | null, now: number): void {
    // `td:<level>:w.…`: a floor's own id where the surface says 'surface' (grave-goods reads the level from it).
    const id = `td:${this.levelId}:w.${this.area}.${this.boot}.${(this.dropSeq++).toString(36)}`;
    const owners = from?.by.filter(Boolean) ?? [];
    const drop: GroundDrop = {
      id, x: Math.round(g.x), y: Math.round(g.y), ...(from ? { m: from.nid } : {}), coins: g.coins, ...(g.material ? { material: g.material } : {}), qty: g.qty,
      ...(g.item ? { item: { definitionId: g.item.definitionId, rarity: g.item.rarity, unique: !!g.item.unique, ...(g.item.level ? { level: g.item.level } : {}) } } : {}),
      ...(g.rune ? { rune: g.rune } : {}), ...(g.rarity ? { rarity: g.rarity } : {}), label: g.label, color: g.color,
      own: owners, free: 0, owners, until: now + GROUND_MS, freeAt: owners.length ? now + OWN_MS : now,
    };
    this.ground.set(id, drop);
    this.added.push(drop);
    this.stats.drops++;
    this.dirty = true;
    if (this.ground.size > GROUND_CAP) {
      const oldest = [...this.ground.values()].sort((a, b) => a.until - b.until)[0];
      this.ground.delete(oldest.id); this.removed.push(oldest.id);
    }
  }
  private expire(): void {
    const now = this.now();
    for (const [id, g] of this.ground) if (g.until <= now) { this.ground.delete(id); this.removed.push(id); this.dirty = true; }
  }
  /** A drop as the wire carries it now (`free`: ms until anyone may take it). */
  wire(g: GroundDrop): WorldDrop {
    const { until: _u, freeAt, owners, ...rest } = g;
    void _u;
    return { ...rest, own: [...owners], free: Math.max(0, freeAt - this.now()) };
  }
  /** Everything lying in the area now. */
  groundList(): WorldDrop[] { return [...this.ground.values()].map(g => this.wire(g)); }
  /** What came and went since the last call (the room tells everyone in the area). */
  flushGround(): { add: WorldDrop[]; gone: string[] } {
    const add = this.added.filter(g => this.ground.has(g.id)).map(g => this.wire(g)), gone = this.removed;
    this.added = []; this.removed = [];
    return { add, gone };
  }
  /**
   * A Keeper reaches for a piece of the ground: the first one allowed wins, answered from memory. Refused when it is
   * gone (someone was first), when the Keeper stands too far from it by the room's record, or while its fighters still
   * own it and this Keeper was not one of them.
   */
  take(id: string, who: string): WorldTakeResult {
    const g = this.ground.get(id), k = this.keepers.get(who);
    if (!k) { this.stats.takeRefused++; return { ok: false, why: 'area' }; }
    if (!g) { this.stats.takeRefused++; return { ok: false, why: 'gone' }; }
    if (Math.hypot(g.x - k.x, g.y - k.y) > TAKE_REACH) { this.stats.takeRefused++; return { ok: false, why: 'far' }; }
    if (g.owners.length && !g.owners.includes(who) && this.now() < g.freeAt) { this.stats.takeRefused++; return { ok: false, why: 'owned' }; }
    this.ground.delete(id);
    this.removed.push(id);
    this.taken.set(id, { g, who, at: this.now() });
    this.stats.takes++;
    this.dirty = true;
    return { ok: true, drop: this.wire(g) };
  }
  /** Taken in the last minute, by whom (a satchel too full to hold it hands it back). */
  private readonly taken = new Map<string, { g: GroundDrop; who: string; at: number }>();
  /** The taker could not hold it (a full satchel): it lies where it was again, as it was. */
  giveBack(id: string, who: string): boolean {
    const t = this.taken.get(id);
    for (const [k, v] of this.taken) if (this.now() - v.at > 60000) this.taken.delete(k);
    if (!t || t.who !== who || this.now() - t.at > 60000 || t.g.until <= this.now()) return false;
    this.taken.delete(id);
    this.ground.set(id, t.g); this.added.push(t.g);
    this.dirty = true;
    return true;
  }

  // ── Sleep and wake ──
  /** What must survive the room going to sleep. */
  save(): RoomWorldSave {
    const now = this.now();
    this.dirty = false;
    return {
      v: 1, area: this.area, savedAt: now, seq: this.nidSeq, drops: this.dropSeq,
      ground: [...this.ground.values()].filter(g => g.until > now).map(g => ({ ...this.wire(g), until: g.until, freeAt: g.freeAt })),
      resting: this.mobs.restingList().map(([k, s]) => [k, Math.round(now + s * 1000)]),
      ...(this.seamSlainUntil > now ? { seamSlainUntil: this.seamSlainUntil } : {}),
      ...(this.wb.size ? { wb: [...this.wb].map(([id, c]) => [id, { ...c, ...(c.up ? { up: { ...c.up } } : {}) }] as [string, WorldBossClock]) } : {}),
    };
  }
  /** Wake from a save: the ground as it lay (its clocks run on in real time), the fallen still resting their time. */
  load(s: RoomWorldSave | null | undefined): void {
    if (!s || s.v !== 1 || s.area !== this.area) return;
    const now = this.now();
    this.nidSeq = Math.max(this.nidSeq, Number(s.seq) || 1);
    this.dropSeq = Math.max(this.dropSeq, Number(s.drops) || 1);
    for (const g of Array.isArray(s.ground) ? s.ground : []) {
      if (!g || typeof g.id !== 'string' || !(g.until > now) || this.ground.has(g.id)) continue;
      const owners = Array.isArray(g.own) ? g.own.filter(x => typeof x === 'string') : [];
      this.ground.set(g.id, { ...g, own: owners, owners, free: 0, until: g.until, freeAt: Number(g.freeAt) || now });
    }
    for (const [key, until] of Array.isArray(s.resting) ? s.resting : []) if (typeof key === 'string' && until > now) this.mobs.rest(key, (until - now) / 1000);
    if (Number(s.seamSlainUntil) > now) this.seamSlainUntil = Number(s.seamSlainUntil);
    // The world bosses' clocks, fast-forwarded by the time the room slept (a rising it slept through came and went).
    for (const [id, c] of Array.isArray(s.wb) ? s.wb : []) {
      const b = worldBossesIn(this.area).find(x => x.id === id);
      if (!b || !c || !(Number(c.next) > 0 || c.up)) continue;
      const clock: WorldBossClock = { next: Number(c.next) || now, ...(c.up && Number(c.up.until) > 0 ? { up: { until: Number(c.up.until), x: Number(c.up.x) || 0, y: Number(c.up.y) || 0 } } : {}) };
      this.wb.set(id, this.seeded(() => fastForward(b, clock, now, Math.random)));
    }
  }

  /** The test hook (the local e2e only, never on Cloud Run): lay a creature (calm: it stands still) where asked. */
  fxLay(type: string, x: number, y: number, calm = false): string | null {
    return this.seeded(() => {
      const def = this.mobDef(type);
      if (!def) return null;
      const m = this.mobs.place(`fx-world:${type}:${this.nidSeq}`, calm ? { ...def, sight: 0 } : def, x, y);
      if (calm) { m.wait = 1e9; m.wander = null; }
      return this.nid(m);
    });
  }
  /** The test hook: no wild spawns (the e2e compares only what it laid). */
  fxQuiet(): void { this.spawnT = 1e9; this.bossT = 1e9; this.mobs.mobs.length = 0; this.mobs.target = null; }
  /** The test hook: this world boss's clock says now (it rises on the next check). */
  fxBossNow(id: string): boolean {
    if (!worldBossesIn(this.area).some(b => b.id === id)) return false;
    this.wb.set(id, { next: this.now() }); this.bossT = 0;
    return true;
  }
  private mobDef(type: string) {
    // The bestiary's own creature (the Seam Eater is never laid by hand).
    return type === SEAM_ID ? null : (MOBS[type] ?? null);
  }
}
/** The world clock's next eclipse (the specs stand the room under one). */
export { nextEclipse } from '../../shared/world-clock/world-clock.model';
/**
 * Protocol 9: every area the room runs for a client that says so — each continent's surface (CONTINENTS) and every
 * hand-drawn floor (LEVELS: caves, dungeon floors, houses). A protocol 7/8 client keeps world-protocol's WORLD_AREAS.
 */
export const WORLD_AREAS_ALL: readonly string[] = [...Object.keys(CONTINENTS), ...Object.keys(LEVELS)];
/** The bestiary and the unique table, as the room reads them (the node tests check against them). */
export { MOBS } from '../td/td-mobs';
export { uniqueById } from '../../shared/rpg/unique-items';
/** Weather v1 (shared/weather): the room owns the sky's roll, every land's for a window, from its own clock. */
export { weatherRolls, weatherWindow, WEATHER_WINDOW_MS } from '../../shared/weather/weather.model';
