/**
 * td-coop.ts — shared creatures in a party (Hearth protocol 4; docs/design/online.md §3.4).
 *
 * The room elects, per party and per area, one host (scripts/social-server.mjs). This binds the top-down mob system
 * to that election:
 *
 * - **host** (others of the party share its area): its creatures are everyone's. They hunt the other members too
 *   (MobSystem.others); a blow on a member travels as a `bite`; every SNAP_MS the creatures within COOP_RANGE_TILES of
 *   any member go out as a delta snapshot (coop-protocol.ts), with the shots, bursts, bites and kills since the last.
 *   Members' damage claims land through the creature's own path after the ClaimGate (coop-rules.ts). A boss's life
 *   grows +60% for each other member present (coopBossLife).
 * - **member** (another member hosts its area): it spawns nothing and simulates nothing; it draws the host's creatures
 *   (replicas, gliding: coop-interp.ts), its own blows on them become claims, a host's `bite` lands through its own
 *   defenses, and a host's kill pays it (its own XP and loot when it fought, the party share when it only stood by).
 * - **solo** (alone in its area, or no v4 room): exactly as before.
 *
 * Host migration: when the room names this Keeper host of an area where it was a member, it adopts the replicas as
 * its own creatures (life, elite tags, spawn keys and the half-life change kept) and the AI resumes; ids stay, so the
 * others keep their glides.
 */
import { MOBS, type CoopKeeper, type CoopLink, type DeathBurst, type Mob, type MobDef, type MobShot, type MobSystem } from './td-mobs';
import { SEAM_ID, seamEaterAt } from './td-seam';
import { atZoneLevel } from './td-zones';
import { eliteStats, lootRank, type EliteAffix, type EliteTag } from './td-elites';
import { hardened } from './td-phases';
import { TILE } from './td-art';
import type { SkyPhase } from '../../shared/world-clock/world-clock.model';
import type { DamageType } from '../../shared/loot/damage.model';
import {
  COOP_MAX_EVENTS, COOP_MAX_HITS, COOP_MAX_MOBS, COOP_RANGE_TILES, CoopDecoder, CoopEncoder, FL_CHANT, FL_HALVED, FL_SUMMONED, SNAP_MS,
  type CoopAreas, type CoopElite, type CoopEvent, type CoopHit, type CoopHitsMsg, type CoopMobState, type CoopSnapBody, type CoopSnapMsg,
} from '../social/coop-protocol';
import { CoopInterp } from '../social/coop-interp';
import { ROOM_HOST, WORLD_AREAS } from '../social/world-protocol';
import { BOSS_LIFE_PER_MEMBER, ClaimGate, coopBossLife } from '../social/coop-rules';

export type CoopRole = 'solo' | 'host' | 'member';
/** A host's kill as a member hears it (the reward is the HUD's call: coop-rules CoopRewards). */
export interface CoopKill { id: string; from: string; area: string; x: number; y: number; by: string[]; creature: string; level: number; hp: number; elite: CoopElite | null }
export interface CoopHooks {
  /** Post a snapshot (host); false when it did not go (the next is a keyframe). */
  send(body: CoopSnapBody): Promise<boolean>;
  /** Post a batch of claims (member). */
  claim(body: { area: string; hits: CoopHit[] }): Promise<boolean>;
  /** A host's creature fell: 'full' (this Keeper fought it: its own spoils here), 'share' or 'none' (the HUD pays those). */
  killed(kill: CoopKill): 'full' | 'share' | 'none';
  now(): number;
  phase(): SkyPhase;
  /** Under reduced motion replicas are placed, not slid. */
  still(): boolean;
  /** Called when the role changes (the engine sweeps its own creatures, the Seam Eater, the spawner). */
  role?(role: CoopRole, was: CoopRole): void;
}

const KEY_OK = /^[a-z0-9:,~._-]{1,80}$/;
const NAME_OK = /^[\p{L}\p{N} '-]{1,40}$/u;
/** A blow's element, read off the colour it floats in (fire's ambers, shadow's violets; anything else physical). */
const FIRE = new Set(['#ffd25a', '#ff9a4a', '#ff8a2e', '#e0b25a']);
const ARCANE = new Set(['#c88bff', '#e9dcff', '#c8a8ff', '#fff2a8']);
export function elementOf(color: string): DamageType { return FIRE.has(color) ? 'fire' : ARCANE.has(color) ? 'arcane' : 'physical'; }

/** An elite tag as the wire carries it (a name the room would refuse is left out). */
export function wireElite(tag: EliteTag | undefined): CoopElite | null {
  if (!tag) return null;
  const e: CoopElite = { r: tag.rank, o: tag.role, a: tag.affixes.filter(a => /^[a-z-]{1,24}$/.test(a)).slice(0, 6) };
  if (tag.name && NAME_OK.test(tag.name)) e.n = tag.name;
  return e;
}
/** The creature a member draws for a host's: its kind's numbers under this sky, its elite tag's, the host's life and level. */
export function replicaDef(s: Pick<CoopMobState, 't' | 'm' | 'l' | 'e'>, phase: SkyPhase): MobDef | null {
  const base = MOBS[s.t];
  if (!base) return null;
  // At the host's level for it (td-zones: the zone's, never a Keeper's), then under this sky.
  let def: MobDef = s.t === SEAM_ID ? seamEaterAt(base, s.l) : hardened(atZoneLevel(base, s.l), phase);
  if (s.e) {
    const tag = { rank: s.e.r, role: s.e.o, affixes: s.e.a as EliteAffix[] };
    const st = eliteStats({ hp: def.hp, dmg: def.dmg, speed: def.speed, rate: def.rate, hits: def.hits }, tag);
    def = { ...def, dmg: st.dmg, speed: st.speed, rate: st.rate, rank: lootRank(tag), ...(st.hits ? { hits: st.hits } : {}) };
  }
  return { ...def, hp: Math.max(1, s.m), level: s.l };
}

/** How long a world area waits on the room's listing before this screen raises its own creatures there (ms). */
export const EXPECT_MS = 5000;

export class TdCoop implements CoopLink {
  role: CoopRole = 'solo';
  private areas: CoopAreas = {};
  private me = '';
  private party: string[] = [];
  private area = '';
  private host: string | null = null;
  private term = -1;
  private present: string[] = [];
  /** The room runs the world for this Keeper (protocol 7, connected): a world area is the room's before it says so. */
  private world = false;
  /** This area's room host is assumed (the room has not listed this Keeper there yet): its real election is no change. */
  private expecting = false;
  /** When this Keeper began waiting on the room's listing in this area, and the area it gave up waiting in. */
  private expectSince = 0;
  private gaveUp = '';
  // Host
  private readonly enc = new CoopEncoder();
  private readonly gate = new ClaimGate();
  private seq = 1;
  private acc = 0;
  private sending = false;
  private pending: CoopEvent[] = [];
  private readonly sentFx = new WeakSet<object>();
  // Member
  private readonly dec = new CoopDecoder();
  private readonly interp = new CoopInterp();
  private readonly replicas = new Map<string, Mob>();
  private claims: CoopHit[] = [];
  private claimAcc = 0;
  private claiming = false;
  /** The corpse each fallen host creature left here (its wire id → corpse id): the room's loot lies beside it. */
  private readonly fell = new Map<string, string>();
  /** Counters the e2e and the HUD read. */
  readonly stats = { sent: 0, heard: 0, dropped: 0, claimsOut: 0, claimsIn: 0, claimsRefused: 0 };

  constructor(private readonly mobs: MobSystem, private readonly hooks: CoopHooks) {}

  /** Others of the party share this Keeper's area (its companions go to them). */
  get sharing(): boolean { return this.present.length > 1 && this.present.includes(this.me); }
  /** The room's election (protocol 4) and who this Keeper is; null against an older room (everything solo). */
  setAreas(areas: CoopAreas | null, me: string, party: readonly string[], world = false, everywhere = false): void {
    this.areas = areas ?? {}; this.me = me; this.party = [...party]; this.world = world; this.everywhere = world && everywhere;
  }
  /** Protocol 9 (m3, the server-run world): the room hosts every surface and floor, not only WORLD_AREAS. */
  private everywhere = false;
  /** Does the room run `area` for this Keeper (so this screen raises nothing of its own there)? */
  roomRuns(area: string): boolean {
    return this.world && !!this.me && this.gaveUp !== area && (this.everywhere || WORLD_AREAS.includes(area) || this.areas[area]?.host === ROOM_HOST);
  }

  /**
   * The Keeper changed level (a dungeon's mouth, a stair, a ship): nothing of the last area may stay on this screen.
   * Called by the engine the moment the level changes, before any snapshot of the old area can land in the new one
   * (owner 2026-10-26: "mobs appear and then disappear around dungeon entrances"). The engine has already swept its
   * own creatures (MobSystem.enterLevel); this forgets the replicas, the decoder and the interpolation, so a late
   * snapshot of the old area is refused (area check) and the old area's creatures are never adopted into the new one.
   */
  left(area: string): void {
    if (area === this.area) return;
    const was = this.role;
    if (was === 'member') {
      for (const m of this.replicas.values()) { const i = this.mobs.mobs.indexOf(m); if (i >= 0) this.mobs.mobs.splice(i, 1); }
      if (this.mobs.target && !this.mobs.mobs.includes(this.mobs.target)) this.mobs.target = null;
    }
    this.replicas.clear(); this.interp.clear(); this.dec.reset(); this.claims = []; this.pending = [];
    // Solo until the next frame decides the new area's part (before()): never a member of the area left behind.
    this.role = 'solo'; this.area = area; this.host = null; this.term = -1; this.present = []; this.expecting = false; this.gaveUp = '';
    this.mobs.replica = false; this.mobs.coop = null; this.mobs.others = [];
    this.enc.keyframe();
    if (was !== 'solo') this.hooks.role?.('solo', was);
  }

  /** Every frame, before the creatures move: the role for the area this Keeper is in now, and the replicas placed. */
  before(dt: number, area: string, keepers: readonly CoopKeeper[]): void {
    const listed = this.areas[area];
    // A world area of the room (protocol 7): the room hosts every Keeper there, party or not. Stepping into one, the
    // room lists this Keeper only after its presence round-trips (~0.2 s live); meanwhile the island must not raise
    // creatures of its own that the room's then wipe. So the room is the host at once, and its election is no change.
    let expect = this.roomRuns(area) && (!listed || listed.host === ROOM_HOST) && !listed?.members.includes(this.me);
    // A room that never lists this Keeper here (it does not run this area after all): its own creatures, as before.
    if (expect && !this.expecting) this.expectSince = this.hooks.now();
    else if (expect && this.hooks.now() - this.expectSince > EXPECT_MS) { expect = false; this.gaveUp = area; }
    if (listed?.members.includes(this.me)) this.gaveUp = '';
    const a = expect ? { host: ROOM_HOST, term: this.host === ROOM_HOST && this.area === area ? this.term : -1, members: [...(listed?.members ?? []), this.me] } : listed;
    const role: CoopRole = !a || !this.me ? 'solo' : a.host === this.me ? (a.members.length > 1 ? 'host' : 'solo') : a.members.includes(this.me) ? 'member' : 'solo';
    const confirmed = this.expecting && !expect && a?.host === ROOM_HOST && this.host === ROOM_HOST && area === this.area;
    const hostChanged = !!a && !confirmed && (a.host !== this.host || a.term !== this.term);
    this.expecting = expect;
    const was = this.role;
    if (role !== was || area !== this.area || (role === 'member' && hostChanged)) this.become(role, area, a?.host ?? null);
    this.host = a?.host ?? null; this.term = a?.term ?? -1;
    // Someone arrived or left: the next snapshot is whole (a newcomer must be able to place every creature).
    const present = a ? [...a.members].sort() : [];
    if (present.join() !== this.present.join()) { this.present = present; this.enc.keyframe(); }
    if (this.role === 'host') {
      const ids = new Set(present.filter(id => id !== this.me));
      this.mobs.others = keepers.filter(k => ids.has(k.id));
      this.scaleBosses(present.length);
    } else {
      this.mobs.others = [];
      if (this.role === 'solo') this.scaleBosses(1);
    }
    if (this.role === 'member') this.placeReplicas();
    void dt;
  }

  /** Every frame, after the creatures moved: the host's snapshot when it is due, the member's claims when they are. */
  after(dt: number): void {
    if (this.role === 'host') {
      this.acc += dt * 1000;
      if (this.acc >= SNAP_MS && !this.sending) { this.acc = 0; this.sendSnap(); }
    } else if (this.role === 'member') {
      this.claimAcc += dt * 1000;
      if (this.claimAcc >= SNAP_MS && this.claims.length && !this.claiming) { this.claimAcc = 0; this.sendClaims(); }
    }
  }

  private become(role: CoopRole, area: string, host: string | null): void {
    const was = this.role;
    // Host migration keeps the replicas (same area, a new host); a new area never inherits the last one's creatures.
    const sameArea = area === this.area;
    this.role = role; this.area = area;
    if (role === 'member') {
      // The host's creatures replace this Keeper's own: nothing of its own is simulated here any more.
      this.mobs.replica = true; this.mobs.coop = this;
      this.mobs.mobs.length = 0; this.mobs.target = null;
      this.mobs.shots.length = 0; this.mobs.bursts.length = 0; this.mobs.calls.length = 0;
      this.dec.reset(); this.interp.clear(); this.replicas.clear(); this.claims = [];
      this.hooks.role?.(role, was);
      void host;
      return;
    }
    if (was === 'member' && sameArea) this.adopt();
    else if (was === 'member') {
      for (const m of this.replicas.values()) { const i = this.mobs.mobs.indexOf(m); if (i >= 0) this.mobs.mobs.splice(i, 1); }
      this.replicas.clear(); this.interp.clear(); this.dec.reset();
    }
    this.mobs.replica = false;
    this.mobs.coop = role === 'host' ? this : null;
    this.pending = [];
    this.enc.keyframe();
    this.hooks.role?.(role, was);
  }

  /** A member becomes host (or alone): the replicas are its own creatures now, and their minds wake. */
  private adopt(): void {
    let top = 0;
    // A boss came scaled for the party that was here (the old host among them): its own life is that, unscaled.
    const n = Math.max(1, Math.min(4, this.present.length));
    for (const m of this.mobs.mobs) {
      if ((m.def.rank === 'boss' || m.def.id === SEAM_ID) && m.coopBase === undefined) {
        m.coopBase = Math.max(1, Math.round(m.def.hp / (1 + BOSS_LIFE_PER_MEMBER * (n - 1)))); m.coopN = n;
      }
      m.hx = m.x; m.hy = m.y; m.wander = null; m.cd = Math.max(m.cd, .6); m.wait = Math.random() * 2;
      if (m.nid) top = Math.max(top, parseInt(m.nid, 36) || 0);
    }
    this.seq = Math.max(this.seq, top + 1);
    this.replicas.clear(); this.interp.clear(); this.dec.reset();
  }

  private scaleBosses(present: number): void {
    for (const m of this.mobs.mobs) {
      if (m.def.rank !== 'boss' && m.def.id !== SEAM_ID) continue;
      if (present <= 1 && !m.coopN) continue;
      const base = m.coopBase ?? m.def.hp;
      this.mobs.scaleBoss(m, coopBossLife(base, present), present);
    }
  }

  // ── Host ──
  /** The creatures the others can see: within COOP_RANGE_TILES of any of them, nearest first, at most COOP_MAX_MOBS. */
  private visible(): Mob[] {
    const reach = COOP_RANGE_TILES * TILE, others = this.mobs.others;
    const near: { m: Mob; d: number }[] = [];
    for (const m of this.mobs.mobs) {
      let d = Infinity;
      for (const o of others) d = Math.min(d, Math.hypot(m.x - o.x, m.y - o.y));
      if (d <= reach || m.def.bound) near.push({ m, d });
    }
    near.sort((a, b) => a.d - b.d);
    return near.slice(0, COOP_MAX_MOBS).map(n => n.m);
  }
  private nid(m: Mob): string { return m.nid ??= (this.seq++).toString(36); }
  stateOf(m: Mob): CoopMobState {
    return {
      i: this.nid(m), t: m.def.id, ...(KEY_OK.test(m.key) ? { k: m.key } : {}), x: m.x, y: m.y, f: m.face, h: Math.max(0, m.hp), m: m.def.hp, l: Math.max(1, Math.min(999, m.def.level)),
      e: wireElite(m.elite), tl: m.tell > 0 ? m.tell * 10 : 0, ax: m.tell > 0 && m.aim ? m.aim.x : 0, ay: m.tell > 0 && m.aim ? m.aim.y : 0,
      fl: (m.halved ? FL_HALVED : 0) | (m.summoned ? FL_SUMMONED : 0) | ((m.chantT ?? 0) > 0 ? FL_CHANT : 0),
    };
  }
  /** The shots and bursts in flight that the others have not been shown yet (pictures only: the host decides hits). */
  private fx(): CoopEvent[] {
    const out: CoopEvent[] = [], reach = COOP_RANGE_TILES * TILE;
    const seen = (x: number, y: number) => this.mobs.others.some(o => Math.hypot(o.x - x, o.y - y) <= reach);
    for (const s of this.mobs.shots) {
      if (this.sentFx.has(s)) continue;
      this.sentFx.add(s);
      if (seen(s.x, s.y)) out.push({ k: 'shot', x: s.x, y: s.y, vx: s.vx, vy: s.vy, s: s.kind, l: Math.max(0, Math.min(10, s.life - s.age)) });
    }
    for (const b of this.mobs.bursts) {
      if (this.sentFx.has(b)) continue;
      this.sentFx.add(b);
      if (seen(b.x, b.y)) out.push({ k: 'burst', x: b.x, y: b.y, r: Math.max(1, Math.min(400, Math.round(b.r))), t: Math.max(0, Math.min(10, b.t)), ...(b.el ? { el: b.el } : {}) });
    }
    return out;
  }
  private sendSnap(): void {
    const now = this.hooks.now();
    const snap = this.enc.encode(now, this.visible().map(m => this.stateOf(m)));
    // Bites and kills first (they matter); pictures fill what room is left.
    const all = [...this.pending, ...this.fx()];
    const ev = all.slice(0, COOP_MAX_EVENTS);
    this.pending = all.slice(COOP_MAX_EVENTS).filter(e => e.k === 'bite' || e.k === 'kill');
    const body: CoopSnapBody = { area: this.area, seq: snap.seq, kf: snap.kf, mobs: snap.mobs, gone: snap.gone.slice(0, 64), ev };
    this.sending = true;
    this.stats.sent++;
    void this.hooks.send(body).then(ok => {
      this.sending = false;
      if (!ok) {
        // Lost: everyone heals on the next keyframe; the bites and kills go again with it.
        this.enc.keyframe(); this.stats.dropped++;
        this.pending = [...ev.filter(e => e.k === 'bite' || e.k === 'kill'), ...this.pending];
      }
    }, () => { this.sending = false; this.enc.keyframe(); });
  }
  /** CoopLink: a creature struck another member (host). */
  bite(to: string, from: Mob | null, dmg: number, type: DamageType, burn: boolean, curse: boolean): void {
    if (this.role !== 'host' || !this.party.includes(to) || to === this.me) return;
    this.pending.push({ k: 'bite', to, ...(from ? { i: this.nid(from) } : {}), d: Math.max(1, Math.min(100000, Math.round(dmg))), ty: type, ...(burn ? { b: true } : {}), ...(curse ? { c: true } : {}) });
  }
  /** CoopLink: a creature fell on the host; the party hears who fought it. */
  killed(m: Mob, by: string[]): void {
    if (this.role !== 'host') return;
    const base = Math.round((m.coopBase ?? m.def.hp) / (this.mobs.tier.hp || 1));
    this.pending.push({
      k: 'kill', i: this.nid(m), t: m.def.id, l: Math.max(1, Math.min(999, m.def.level)), h: Math.max(1, Math.min(100000, base)),
      by: by.filter(id => this.party.includes(id) && id !== this.me).slice(0, 4), x: m.x, y: m.y,
      ...(m.elite ? { e: wireElite(m.elite)! } : {}), ...(KEY_OK.test(m.key) ? { key: m.key } : {}),
    });
  }
  /** The room handed over members' claims (host): each through the gate, then the creature's own path. */
  hits(msg: CoopHitsMsg): void {
    if (this.role !== 'host' || msg.area !== this.area || !this.party.includes(msg.from)) return;
    const now = this.hooks.now();
    for (const h of msg.hits) {
      const m = this.mobs.mobs.find(x => x.nid === h.i) ?? null;
      const r = this.gate.check(h, { id: msg.from, x: msg.x, y: msg.y, level: msg.level }, m ? { x: m.x, y: m.y, hp: m.hp } : null, now);
      if (!r.ok || !m) { this.stats.claimsRefused++; continue; }
      this.stats.claimsIn++;
      this.mobs.applyClaim(m, r.dmg, msg.from, !!h.c);
    }
  }

  // ── Member ──
  /** CoopLink: this Keeper's blow on a host's creature — shown here, claimed from the host. */
  claim(m: Mob, dmg: number, crit: boolean, color: string): void {
    if (this.role !== 'member' || !m.nid) return;
    const el = elementOf(color);
    const same = this.claims.find(c => c.i === m.nid && c.el === el);
    if (same) { same.d = Math.min(100000, same.d + dmg); if (crit) same.c = true; }
    else this.claims.push({ i: m.nid, d: Math.min(100000, dmg), el, ...(crit ? { c: true } : {}) });
  }
  private sendClaims(): void {
    const hits = this.claims.slice(0, COOP_MAX_HITS);
    this.claims = this.claims.slice(COOP_MAX_HITS);
    this.claiming = true;
    this.stats.claimsOut += hits.length;
    void this.hooks.claim({ area: this.area, hits }).finally(() => { this.claiming = false; });
  }
  /** A host's snapshot (member): the creatures kept in step, and the bites, kills and pictures applied. */
  snap(msg: CoopSnapMsg): void {
    if (this.role !== 'member' || msg.area !== this.area || msg.from !== this.host) return;
    this.stats.heard++;
    const res = this.dec.apply(msg);
    for (const e of msg.ev ?? []) this.event(e, msg);
    if (!res.ok) return;
    const now = this.hooks.now(), still = this.hooks.still();
    for (const id of res.removed) {
      const m = this.replicas.get(id);
      if (m) { const i = this.mobs.mobs.indexOf(m); if (i >= 0) this.mobs.mobs.splice(i, 1); if (this.mobs.target === m) this.mobs.target = null; }
      this.replicas.delete(id); this.interp.forget(id);
    }
    for (const id of [...res.added, ...res.changed]) {
      const s = this.dec.state.get(id);
      if (!s) continue;
      let m = this.replicas.get(id);
      if (!m) {
        const def = replicaDef(s, this.hooks.phase());
        if (!def) continue;
        m = this.mobs.replicaMob(s.k ?? `coop:${id}`, def, s.x, s.y);
        m.nid = id;
        this.replicas.set(id, m); this.mobs.mobs.push(m);
      }
      this.mirror(m, s);
      this.interp.push(id, now, s.x, s.y, still);
    }
  }
  /** One replica takes the host's numbers. */
  private mirror(m: Mob, s: CoopMobState): void {
    if (s.h < m.hp) m.hit = .18;
    if (m.def.hp !== s.m) m.def = { ...m.def, hp: Math.max(1, s.m) };
    m.hp = s.h; m.face = s.f;
    m.tell = s.tl / 10; m.aim = s.tl > 0 ? { x: s.ax, y: s.ay } : null;
    if (s.fl & FL_HALVED) this.mobs.halve(m);
    m.summoned = !!(s.fl & FL_SUMMONED);
    m.chantT = s.fl & FL_CHANT ? Math.max(m.chantT ?? 0, .3) : 0;
    m.chantText = m.halved ? m.def.half?.chant ?? m.def.chant : m.def.chant;
    m.elite = s.e ? { rank: s.e.r, role: s.e.o, affixes: s.e.a as EliteAffix[], name: s.e.n ?? null } : undefined;
  }
  private placeReplicas(): void {
    const now = this.hooks.now();
    for (const [id, m] of this.replicas) {
      const at = this.interp.sample(id, now);
      if (!at) continue;
      if (Math.abs(at.x - m.x) > .05) m.face = at.x < m.x ? -1 : 1;
      m.x = at.x; m.y = at.y; m.hx = at.x; m.hy = at.y;
    }
  }
  private event(e: CoopEvent, msg: CoopSnapMsg): void {
    if (e.k === 'bite') {
      if (e.to !== this.me) return;
      const from = e.i ? this.replicas.get(e.i) ?? null : null;
      this.mobs.coopBite(e.d, e.ty as DamageType, from, !!e.b, !!e.c);
      return;
    }
    if (e.k === 'shot') {
      this.mobs.shots.push({ x: e.x, y: e.y, vx: e.vx, vy: e.vy, dmg: 0, age: 0, life: e.l, kind: e.s as MobShot['kind'] });
      return;
    }
    if (e.k === 'burst') {
      this.mobs.bursts.push({ x: e.x, y: e.y, t: e.t, r: e.r, dmg: 0, ...(e.el ? { el: e.el as DeathBurst['el'] } : {}) });
      return;
    }
    // A kill: this Keeper's reward is the HUD's call; the creature leaves the world here either way.
    const def = MOBS[e.t];
    const cap = !def ? 0 : def.rank === 'boss' || e.t === SEAM_ID ? 100000 : def.hp * 6;
    const hp = Math.max(1, Math.min(cap || 1, e.h));
    const kill: CoopKill = { id: `${msg.from}:${msg.term}:${msg.seq}:${e.i}`, from: msg.from, area: msg.area, x: e.x, y: e.y, by: e.by, creature: e.t, level: e.l, hp, elite: e.e ?? null };
    const reward = def ? this.hooks.killed(kill) : 'none';
    let m = this.replicas.get(e.i) ?? null;
    if (!m && reward === 'full' && def) {
      // Never drawn here (it fell as this Keeper arrived): its spoils still land where it fell.
      const rd = replicaDef({ t: e.t, m: hp, l: e.l, e: e.e ?? null }, this.hooks.phase());
      if (rd) { m = this.mobs.replicaMob(e.key ?? `coop:${e.i}`, rd, e.x, e.y); m.elite = e.e ? { rank: e.e.r, role: e.e.o, affixes: e.e.a as EliteAffix[], name: e.e.n ?? null } : undefined; }
    }
    if (m) {
      m.hp = 0;
      // The room's world (protocol 7) rolled the loot once, on its own ground: this Keeper is paid its XP, never a roll.
      const corpse = this.mobs.coopFell(m, reward === 'full', hp * (this.mobs.tier.hp || 1), msg.from !== ROOM_HOST);
      this.fell.set(e.i, corpse);
      if (this.fell.size > 64) this.fell.delete(this.fell.keys().next().value!);
    }
    this.replicas.delete(e.i); this.interp.forget(e.i); this.dec.state.delete(e.i);
  }

  /** The e2e's view: role, host, and the creatures as this screen holds them. */
  view(): { role: CoopRole; host: string | null; area: string; present: string[]; mobs: { id: string; t: string; key: string; x: number; y: number; hp: number; max: number }[] } {
    return {
      role: this.role, host: this.host, area: this.area, present: this.present,
      mobs: this.mobs.mobs.filter(m => m.nid || this.role !== 'member').map(m => ({ id: m.nid ?? '', t: m.def.id, key: m.key, x: Math.round(m.x), y: Math.round(m.y), hp: Math.round(m.hp), max: Math.round(m.def.hp) })),
    };
  }
  /** The corpse a host's creature left on this screen (the room's loot from it lies beside it), if it fell here. */
  corpseOf(nid: string | undefined): string | undefined { return nid ? this.fell.get(nid) : undefined; }
  /** Give every creature its wire id now (the host's e2e reads them before the first snapshot). */
  name(m: Mob): string { return this.nid(m); }
}
