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
import { MOBS, MobSystem, type CoopLink, type Drop, type Mob } from '../td/td-mobs';
import { TdWorld } from '../td/td-world';
import { TILE } from '../td/td-art';
import { SEAM_ID, riftPlace, riftTile, seamEaterAt, seamLeaves, seamRises } from '../td/td-seam';
import { seamLevelFor } from '../td/td-zones';
import type { ContinentDef } from '../td/continent';
import { wireElite } from '../td/td-coop';
import {
  COOP_MAX_EVENTS, COOP_MAX_MOBS, COOP_RANGE_TILES, CoopEncoder, FL_CHANT, FL_HALVED, FL_SUMMONED,
  type CoopEvent, type CoopHit, type CoopMobState, type CoopSnapBody,
} from '../social/coop-protocol';
import { CLAIM_RANGE_TILES, ClaimGate, coopBossLife } from '../social/coop-rules';
import { GROUND_MS, OWN_MS, TAKE_REACH, type WorldDrop, type WorldTakeResult } from '../social/world-protocol';
import { lootEntry, rollCreatureLoot } from '../../shared/loot/drop-tables';
import { hashSeed, seededRandom, type MonsterRank } from '../../shared/loot/champions';
import { eclipseAt, worldTime, type SkyPhase } from '../../shared/world-clock/world-clock.model';
import type { EngineOptions } from '../engine/engine.model';

/** A Keeper in the area as the room knows it: where it last said it stands, and its level (the room's own record). */
export interface RoomKeeper { id: string; x: number; y: number; level: number }
/** What survives a sleep: the ground (absolute expiry) and the spawns resting (absolute end), the id counters. */
export interface RoomWorldSave {
  v: 1; area: string; savedAt: number; seq: number; drops: number;
  ground: (WorldDrop & { until: number; freeAt: number })[];
  resting: [string, number][];
  /** The Seam Eater fell in this eclipse: it does not rise again until the eclipse is over (epoch ms). */
  seamSlainUntil?: number;
}
export interface RoomWorldOptions {
  area: string;
  /** The world's random stream (the room: a fresh secret per wake; the specs: a fixed string). */
  seed: string;
  /** Epoch ms (the ground's clocks and the sky). */
  now: () => number;
  /** The continent (default: the Seamworks island). */
  def?: ContinentDef;
  /** The boot id woven into ground ids (unique across wakes). */
  boot?: string;
}
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
  readonly world: TdWorld;
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
  readonly stats = { ticks: 0, kills: 0, claimsIn: 0, claimsRefused: 0, refusedFar: 0, refusedSight: 0, refusedCap: 0, drops: 0, takes: 0, takeRefused: 0 };

  constructor(opts: RoomWorldOptions) {
    this.area = opts.area;
    this.now = opts.now;
    this.seed = opts.seed;
    this.boot = (opts.boot ?? hashSeed(`${opts.seed}|boot`).toString(36)).replace(/[^a-z0-9]/g, '').slice(0, 12) || 'b';
    this.rng = seededRandom(hashSeed(`${opts.seed}|${opts.area}`));
    this.world = opts.def ? new TdWorld(opts.def) : new TdWorld();
    const world = this.world;
    const options: EngineOptions = {
      // The gear on top of the area's table, rolled here (drop-tables.ts) from the world's stream: the kill's key and
      // the creature's level decide it, never a Keeper's Magic Find (the room is nobody's).
      rollLoot: kill => rollCreatureLoot({ creature: kill.creature, level: kill.level, tier: 'normal', magicFind: Math.max(0, kill.mf ?? 0), rank: kill.rank as MonsterRank, ...(kill.named ? { named: kill.named } : {}) },
        seededRandom(hashSeed(`${this.seed}|loot|${kill.killKey}`))).map((d, i) => lootEntry(d, `loot${i}`)),
    } as Partial<EngineOptions> as EngineOptions;
    this.mobs = new MobSystem({
      options,
      walkable: (c, r) => world.walkable(c, r),
      levelId: () => 'surface',
      // The room has no Keeper of its own: far away, and `selfAway` keeps every creature off it.
      player: () => ({ x: 1e7, y: 1e7 }),
      hurtPlayer: () => undefined,
      healPlayer: () => undefined,
      // The engine's own readings of the ground (td-engine's MobHost), so creatures walk, float and see as on a screen.
      hover: (c, r) => world.walkable(c, r) || world.ground(c, r) === 'ember' || world.ground(c, r) === 'blackwater',
      passable: (c, r) => { const g = world.ground(c, r); return g !== 'rock' && g !== 'wall' && g !== 'vinewall' && g !== 'bark'; },
      sight: (c, r) => { const g = world.ground(c, r); return g !== 'water' && g !== 'ember' && g !== 'blackwater' && g !== 'canopy' && !world.walkable(c, r); },
      swung: () => undefined,
      safeAt: (x, y) => world.safeAt(Math.floor(x / TILE), Math.floor(y / TILE)),
    });
    this.mobs.selfAway = true;
    this.mobs.roomLoot = true;
    this.mobs.coop = this;
    this.mobs.aura = null;
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
  leave(id: string): void { this.keepers.delete(id); this.viewers.delete(id); this.gate.forget(id); }
  get present(): string[] { return [...this.keepers.keys()]; }
  get empty(): boolean { return this.keepers.size === 0; }
  /** The next snapshot to this viewer is whole (its stream reopened, a send was lost). */
  resync(id: string): void { this.viewers.get(id)?.enc.keyframe(); }

  // ── The tick ──
  /** Advance the world `dt` seconds: the sky, the spawns round every Keeper, the creatures, then the loot harvested. */
  tick(dt: number): void {
    if (!(dt > 0)) return;
    const d = Math.min(dt, .25);
    this.clockMs += d * 1000;
    this.stats.ticks++;
    this.seeded(() => {
      this.mobs.setPhase(this.sky(), true);
      const others = [...this.keepers.values()].map(k => ({ id: k.id, x: k.x, y: k.y }));
      this.mobs.others = others;
      this.spawnT -= d;
      if (this.spawnT <= 0) {
        this.spawnT = .5;
        for (const o of others) this.mobs.addSpawns(this.world.spawnsIn(o.x - SPAWN_REACH, o.y - SPAWN_REACH, o.x + SPAWN_REACH, o.y + SPAWN_REACH));
        this.mobs.prune(PRUNE);
        this.updateSeam(this.sky());
        this.scaleBosses();
      }
      this.mobs.update(d);
    });
    this.harvest();
    this.expire();
  }

  /** The Seam Eater's glue (td-engine updateSeam, the room's copy): rises near a Keeper under the eclipse, leaves after it. */
  private updateSeam(phase: SkyPhase): void {
    if (this.seam && !this.mobs.mobs.includes(this.seam)) {
      if (this.seam.hp <= 0) { const e = eclipseAt(this.now()); this.seamSlainUntil = e ? e.endMs : 0; this.dirty = true; }
      this.seam = null;
    }
    if (this.seam && seamLeaves(phase)) { this.mobs.banish(this.seam); this.seam = null; }
    if (this.seam || !this.keepers.size) return;
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
  bite(to: string, from: Mob | null, dmg: number, type: string, burn: boolean, curse: boolean): void {
    const v = this.viewers.get(to);
    if (!v) return;
    v.ev.push({ k: 'bite', to, ...(from ? { i: this.nid(from) } : {}), d: Math.max(1, Math.min(100000, Math.round(dmg))), ty: type, ...(burn ? { b: true } : {}), ...(curse ? { c: true } : {}) });
  }
  /** A creature fell: every Keeper near hears who fought it; its loot (rolled next, in spoils) is theirs first. */
  killed(m: Mob, by: string[]): void {
    const nid = this.nid(m);
    const fought = by.filter(Boolean).slice(0, 8);
    this.kills.push({ nid, by: fought, at: this.mobs.drops.length });
    this.stats.kills++;
    const base = Math.round((m.coopBase ?? m.def.hp) / (this.mobs.tier.hp || 1));
    const ev: CoopEvent = {
      k: 'kill', i: nid, t: m.def.id, l: Math.max(1, Math.min(999, m.def.level)), h: Math.max(1, Math.min(100000, base)), by: fought,
      x: Math.round(m.x), y: Math.round(m.y), ...(m.elite ? { e: wireElite(m.elite)! } : {}), ...(/^[a-z0-9:,~._-]{1,80}$/.test(m.key) ? { key: m.key } : {}),
    };
    const reach = COOP_RANGE_TILES * TILE;
    for (const [id, v] of this.viewers) {
      const k = this.keepers.get(id);
      if (k && (Math.hypot(k.x - m.x, k.y - m.y) <= reach || fought.includes(id))) v.ev.push(ev);
    }
    this.dirty = true;
  }
  /** (A member's hook: the room is never a member.) */
  claim(): void { /* the room's creatures take blows through claims(), never this */ }

  // ── Claims (a Keeper's blows, as intents) ──
  /**
   * A Keeper's blows on the room's creatures. Each one: the creature exists and lives; the Keeper stands within the
   * gate's reach of it by the room's record, with a clear line unless at its side; its damage within its level's budget
   * over the gate's window (clipped past it). What passes lands through the creature's own path.
   */
  claims(from: string, hits: readonly CoopHit[]): { landed: number; refused: number; dmg: number } {
    const k = this.keepers.get(from);
    let landed = 0, refused = 0, dmg = 0;
    if (!k) return { landed, refused: hits.length, dmg };
    const now = this.clockMs;
    this.seeded(() => {
      for (const h of hits) {
        const m = this.mobs.mobs.find(x => x.nid === h.i) ?? null;
        const d = m ? Math.hypot(m.x - k.x, m.y - k.y) : 0;
        // Too far first (the gate's own reach), then the line: a wall between them stops a blow as it stops a shot.
        if (m && d <= CLAIM_RANGE_TILES * TILE && d > LOS_FREE && !this.mobs.sight.sees(k.x, k.y, m.x, m.y)) { refused++; this.stats.refusedSight++; continue; }
        const r = this.gate.check(h, { id: from, x: k.x, y: k.y, level: k.level }, m ? { x: m.x, y: m.y, hp: m.hp } : null, now);
        if (!r.ok || !m) { refused++; if (!r.ok && r.why === 'far') this.stats.refusedFar++; if (!r.ok && r.why === 'cap') this.stats.refusedCap++; continue; }
        landed++; dmg += this.mobs.applyClaim(m, r.dmg, from, !!h.c);
      }
    });
    this.stats.claimsIn += landed; this.stats.claimsRefused += refused;
    this.harvest();
    return { landed, refused, dmg };
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
    // Bites and kills first; pictures fill what room is left (a picture that does not fit is simply not shown).
    const firm = v.ev.filter(e => e.k === 'bite' || e.k === 'kill'), soft = v.ev.filter(e => e.k !== 'bite' && e.k !== 'kill');
    const ev = [...firm, ...soft].slice(0, COOP_MAX_EVENTS);
    v.ev = firm.slice(COOP_MAX_EVENTS);
    return { area: this.area, seq: snap.seq, kf: snap.kf, mobs: snap.mobs, gone: snap.gone.slice(0, 64), ev };
  }
  /** One creature on the wire (td-coop stateOf, the same fields). */
  stateOf(m: Mob): CoopMobState {
    return {
      i: this.nid(m), t: m.def.id, ...(/^[a-z0-9:,~._-]{1,80}$/.test(m.key) ? { k: m.key } : {}), x: m.x, y: m.y, f: m.face, h: Math.max(0, m.hp), m: m.def.hp,
      l: Math.max(1, Math.min(999, m.def.level)), e: wireElite(m.elite), tl: m.tell > 0 ? m.tell * 10 : 0, ax: m.tell > 0 && m.aim ? m.aim.x : 0, ay: m.tell > 0 && m.aim ? m.aim.y : 0,
      fl: (m.halved ? FL_HALVED : 0) | (m.summoned ? FL_SUMMONED : 0) | ((m.chantT ?? 0) > 0 ? FL_CHANT : 0),
    };
  }

  // ── The ground ──
  /** Move what the kills of this tick left (MobSystem.spoils) onto the room's ground, owned by who fought. */
  private harvest(): void {
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
    const id = `td:surface:w.${this.area}.${this.boot}.${(this.dropSeq++).toString(36)}`;
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
  fxQuiet(): void { this.spawnT = 1e9; this.mobs.mobs.length = 0; this.mobs.target = null; }
  private mobDef(type: string) {
    // The bestiary's own creature (the Seam Eater is never laid by hand).
    return type === SEAM_ID ? null : (MOBS[type] ?? null);
  }
}
/** The world clock's next eclipse (the specs stand the room under one). */
export { nextEclipse } from '../../shared/world-clock/world-clock.model';
