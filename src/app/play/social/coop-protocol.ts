/**
 * coop-protocol.ts — shared creatures for parties (Hearth protocol 4; docs/design/online.md §3.4).
 *
 * Within a party, per area, one member (the host, elected by the room) simulates the wild creatures and streams them
 * to the others in that area. This file is the wire: the compact creature state, the delta encoder the host keeps and
 * the decoder each member keeps. Pure (no Angular, no DOM, no engine).
 *
 * A snapshot is a keyframe (every creature, whole: the member replaces its set) or a delta against the last one sent:
 * a new creature whole, a changed one by its changed fields only, an unchanged one not at all, a vanished one in
 * `gone`. Keyframes come every KEYFRAME_MS and whenever the host asks for one (someone arrived, a send failed). A
 * member that misses a delta (a gap in `seq`, a new host's term) ignores deltas until the next keyframe.
 */

/** The room's protocol for shared creatures (scripts/social-server.mjs PROTOCOL). */
export const COOP_PROTOCOL = 4;
/** Snapshots a second while others share the host's area (8 Hz: one per 125 ms). */
export const SNAP_HZ = 8;
export const SNAP_MS = 1000 / SNAP_HZ;
/** A keyframe at least this often. */
export const KEYFRAME_MS = 2000;
/** The host streams creatures within this many tiles of any other member in its area. */
export const COOP_RANGE_TILES = 24;
/** The most creatures in one snapshot, events in one snapshot, claims in one batch (the room's caps, COOP in the server). */
export const COOP_MAX_MOBS = 48;
export const COOP_MAX_EVENTS = 24;
export const COOP_MAX_HITS = 24;

/** An elite's tag on the wire: rank, role, affixes, a unique leader's name. */
export interface CoopElite { r: 'champion' | 'unique'; o: 'leader' | 'champion' | 'minion'; a: string[]; n?: string }
/** Flags (`fl`): halved (the half-life change has come), summoned (its call is spent), chanting. */
export const FL_HALVED = 1, FL_SUMMONED = 2, FL_CHANT = 4;

/** One creature as the host last saw it. */
export interface CoopMobState {
  /** The host's short id (base 36): stable for the creature's life, kept across a host change. */
  i: string;
  /** Its creature id (MOBS), and its spawn key (so a new host never spawns it twice). */
  t: string; k?: string;
  x: number; y: number; f: 1 | -1;
  /** Life now and most. */
  h: number; m: number;
  l: number;
  e: CoopElite | null;
  /** A boss's wind-up left (tenths of a second; 0 = none) and where it will land. */
  tl: number; ax: number; ay: number;
  fl: number;
}
export type CoopMobWire = Partial<CoopMobState> & { i: string };

/** Things that happen between snapshots. `kill`: the host's creature fell; `bite`: a creature struck a member. */
export type CoopEvent =
  | { k: 'kill'; i: string; t: string; l: number; h: number; xp?: number; by: string[]; x: number; y: number; e?: CoopElite; key?: string }
  | { k: 'bite'; to: string; i?: string; d: number; ty: string; b?: boolean; c?: boolean }
  | { k: 'shot'; x: number; y: number; vx: number; vy: number; s: string; l: number }
  | { k: 'burst'; x: number; y: number; r: number; t: number; el?: string };

/** What the host posts (and the room relays, with `from`, `term`). */
export interface CoopSnapBody { area: string; seq: number; kf: boolean; mobs: CoopMobWire[]; gone: string[]; ev: CoopEvent[]; tier?: string }
export interface CoopSnapMsg extends CoopSnapBody { from: string; term: number }
/** A member's damage claim (target id, amount, element, a crit, the skill it came from). */
export interface CoopHit { i: string; d: number; el: string; c?: boolean; s?: string }
/** The claims as the room hands them to the host: with the member's last presence (where, and its level). */
export interface CoopHitsMsg { from: string; area: string; x: number; y: number; level: number; hits: CoopHit[] }
/** The room's election: per area, the host, its term, and who of the party is there. */
export type CoopAreas = Record<string, { host: string; term: number; members: string[] }>;

const FIELDS = ['t', 'k', 'x', 'y', 'f', 'h', 'm', 'l', 'e', 'tl', 'ax', 'ay', 'fl'] as const;
const same = (a: unknown, b: unknown): boolean => a === b || (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));

/** A creature's state as the wire carries it: whole numbers for place and life, the wind-up in tenths. */
export function quantize(s: CoopMobState): CoopMobState {
  return {
    ...s, x: Math.round(s.x), y: Math.round(s.y), f: s.f === -1 ? -1 : 1, h: Math.max(0, Math.round(s.h)), m: Math.max(1, Math.round(s.m)),
    tl: Math.max(0, Math.min(100, Math.round(s.tl))), ax: Math.round(s.ax), ay: Math.round(s.ay), fl: s.fl & 255,
  };
}

/** The host's side: what the members were last sent, and the next snapshot against it. */
export class CoopEncoder {
  private last = new Map<string, CoopMobState>();
  private seq = 0;
  private lastKf = -Infinity;
  private force = true;
  /** Ask for a keyframe next (someone arrived, a send failed, a new term). */
  keyframe(): void { this.force = true; }
  /**
   * The next snapshot of `mobs` at `now` (ms). A keyframe carries everything whole; a delta only what changed. The
   * encoder assumes it is sent: if the send fails, call keyframe() so the next one heals every member.
   */
  encode(now: number, mobs: readonly CoopMobState[]): { seq: number; kf: boolean; mobs: CoopMobWire[]; gone: string[] } {
    const kf = this.force || now - this.lastKf >= KEYFRAME_MS;
    const next = new Map<string, CoopMobState>();
    const out: CoopMobWire[] = [];
    for (const raw of mobs) {
      const s = quantize(raw);
      next.set(s.i, s);
      const was = this.last.get(s.i);
      if (kf || !was) { out.push(whole(s)); continue; }
      const d: CoopMobWire = { i: s.i };
      let changed = false;
      for (const f of FIELDS) if (!same(s[f], was[f])) { (d as Record<string, unknown>)[f] = s[f]; changed = true; }
      if (changed) out.push(d);
    }
    const gone = kf ? [] : [...this.last.keys()].filter(i => !next.has(i));
    this.last = next;
    if (kf) { this.lastKf = now; this.force = false; }
    return { seq: ++this.seq, kf, mobs: out, gone };
  }
}
function whole(s: CoopMobState): CoopMobWire {
  const w: CoopMobWire = { i: s.i, t: s.t, x: s.x, y: s.y, f: s.f, h: s.h, m: s.m, l: s.l, e: s.e, tl: s.tl, ax: s.ax, ay: s.ay, fl: s.fl };
  if (s.k) w.k = s.k;
  return w;
}

/** A member's side: the host's creatures as last heard, kept in step with the stream. */
export class CoopDecoder {
  readonly state = new Map<string, CoopMobState>();
  private term = -1;
  private seq = -1;
  private host = '';
  /** In step (a keyframe heard under this term, and no delta missed since). */
  synced = false;
  /** Forget everything (a new host, leaving the area, a member becoming host). */
  reset(): void { this.state.clear(); this.synced = false; this.seq = -1; this.term = -1; this.host = ''; }
  /**
   * Apply one snapshot. Returns what changed, or `ok: false` when it was a delta this member cannot place (out of
   * step: it waits for the next keyframe). A keyframe replaces the whole set.
   */
  apply(msg: Pick<CoopSnapMsg, 'from' | 'term' | 'seq' | 'kf' | 'mobs' | 'gone'>): { ok: boolean; added: string[]; removed: string[]; changed: string[] } {
    const none = { ok: false, added: [], removed: [], changed: [] };
    if (msg.term !== this.term || msg.from !== this.host) { this.term = msg.term; this.host = msg.from; this.synced = false; }
    if (!msg.kf && (!this.synced || msg.seq !== this.seq + 1)) { this.synced = false; return none; }
    this.seq = msg.seq;
    const added: string[] = [], removed: string[] = [], changed: string[] = [];
    if (msg.kf) {
      const keep = new Set(msg.mobs.map(m => m.i));
      for (const id of [...this.state.keys()]) if (!keep.has(id)) { this.state.delete(id); removed.push(id); }
      this.synced = true;
    }
    for (const w of msg.mobs) {
      const was = this.state.get(w.i);
      if (!was) {
        // A creature first heard of must come whole (a type, a place, its life); a partial one waits for a keyframe.
        if (typeof w.t !== 'string' || !Number.isFinite(w.x) || !Number.isFinite(w.y) || !Number.isFinite(w.m)) continue;
        this.state.set(w.i, { i: w.i, t: w.t, k: w.k, x: w.x!, y: w.y!, f: w.f === -1 ? -1 : 1, h: w.h ?? w.m!, m: w.m!, l: w.l ?? 1, e: w.e ?? null, tl: w.tl ?? 0, ax: w.ax ?? 0, ay: w.ay ?? 0, fl: w.fl ?? 0 });
        added.push(w.i);
        continue;
      }
      Object.assign(was, Object.fromEntries(Object.entries(w).filter(([, v]) => v !== undefined)));
      changed.push(w.i);
    }
    for (const id of msg.gone ?? []) if (this.state.delete(id)) removed.push(id);
    return { ok: true, added, removed, changed };
  }
}
