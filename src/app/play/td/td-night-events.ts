/**
 * td-night-events.ts — the night events on the top-down canvas (S8; shared/night-events/night-events.model.ts, the
 * rules and the seeds; docs/design/world-acts.md §5).
 *
 * The model says which event runs where and when (the same for a whole party); this walks it: the Late Shift's six
 * lamps, the Count's bell over the Hushed Barrow's lych-gate, the Relief Column's grey file on the Bastion Road, the
 * self-lit kiln of the Deep Charwood. It tracks whether this Keeper followed, and says so in `news` (the engine lays
 * the reward on the ground, keyed per night, and the host books it). Nothing here hurts, takes or chases: the figures
 * have no body, nothing blocks, and walking away simply ends it.
 *
 * Cheap: a handful of fillRects per figure, no per-frame allocation beyond the news list; a phone or Low draws the
 * same few pixels (the figures are already the minimum). Reduced motion holds every figure still at its place (the
 * walk still advances — it is the clock's, not an animation — but nothing bobs or flickers).
 */
import { TILE } from './td-art';
import {
  COLUMN, COUNT, COUNT_GATE, KILN, NIGHT_REWARDS, SHIFT, WALKER, countBell, nightEventsAt, type NightEventId, type NightEventNow,
} from '../../shared/night-events/night-events.model';
import { WALKER_GLADE } from './maps/wilds-sections';
import type { WeatherInput } from '../../shared/weather/weather.model';

type Pt = readonly [number, number];
/** Tiles → art px (a figure's foot on its tile's lower edge). */
const px = (p: Pt): { x: number; y: number } => ({ x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE - 2 });

/** Where each event walks, in its area's tiles. */
export const NIGHT_PLACES = {
  // The Ember Mine head on the Seamworks' west lane (seamworks-square `delve`, tile 2,15): up out of the shaft and east
  // along the lane toward the square, where they go out one by one.
  shift: [[2, 15], [5, 15], [9, 15], [13, 15], [16, 14]] as readonly Pt[],
  // The Hushed Barrow's lych-gate, south of the plot (ember-isle PLACES graveyard -46,-27).
  gate: [-46, -22] as Pt,
  // The Pyre Peaks' Bastion Road, from the fork to the Ashen Bastion's gate (reach-sections PYRE_PEAKS_SECTION).
  column: [[40, -10], [30, -40], [0, -60], [-12, -86]] as readonly Pt[],
  // The Deep Charwood's cold kiln (reach-sections `sealed:deep-kiln`, nine days tallied on it).
  kiln: [-42, -26] as Pt,
  // S11, the Walking Tree: the Greenwood's glade (wilds-sections WALKER_GLADE). The copy stands three tiles east of its
  // true twin by day; at night (or in fog) it is somewhere else each time the Keeper looks away.
  walker: [WALKER_GLADE.c, WALKER_GLADE.r] as Pt,
  walks: [[55, -73], [74, -56], [53, -57], [74, -73], [64, -52], [66, -77]] as readonly Pt[],
} as const;
export const KILN_STATION = 'sealed:deep-kiln';
/** The area the Walking Tree stands in (its copy is drawn there, day or night). */
export const WALKER_AREA = 'verdant-wilds-greenwood';
/** The copy's jungle tree: the true twin's seed (wilds-sections GREENWOOD_SECTION.trees), so the pair is identical. */
export const WALKER_SEED = 2;

export type NightNews =
  | { kind: 'reward'; id: NightEventId; night: number; x: number; y: number }
  | { kind: 'line'; key: string }
  | { kind: 'sfx'; cue: 'farbell' | 'march' | 'crackle' | 'count-bell' | 'present' | 'creak' };

export interface NightFrame {
  /** The world clock (the room's while it speaks), or null before the host has said. */
  ms: number | null;
  rolls?: WeatherInput['rolls'];
  area: string;
  surface: boolean;
  keeper: { x: number; y: number };
  dt: number;
  /** Is a point on screen now (the Walking Tree only moves while unseen)? Unset: within 14 tiles of the Keeper. */
  seen?: (x: number, y: number) => boolean;
}

/** The Walking Tree's night, for this Keeper: where it stands (-1 home), how often it moved, how long it has been looked at. */
interface Walk { spot: number; moves: number; look: number; struck: boolean; told: boolean; dimmed: boolean }

interface Track { near: number; seen: number; paid: boolean; bell: number; full: boolean; lit: boolean; said: number }

/**
 * A stepped disc of light (2-px rows, no soft blur). `floor`: it lies on the ground (iso's floor plane squashes it 2:1
 * itself; top-down sees the ground from above), so it is drawn round either way; the flag documents the call.
 */
function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, floor: boolean): void {
  if (alpha <= .005 || r < 1) return;
  c.globalAlpha = alpha;
  // Top-down the floor is seen from above (round); iso's floor plane squashes it itself.
  void floor;
  const ry = r;
  for (let dy = -ry; dy < ry; dy += 2) { const w = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2))); if (w > 0) c.fillRect(Math.round(x - w), Math.round(y + dy), w * 2, 2); }
}

/** Polyline helpers: total length and the point `d` px along it. */
function lengthOf(path: readonly { x: number; y: number }[]): number { let n = 0; for (let i = 1; i < path.length; i++) n += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); return n; }
function along(path: readonly { x: number; y: number }[], d: number, out: { x: number; y: number }): { x: number; y: number } {
  let left = Math.max(0, d);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= seg) { const k = seg ? left / seg : 0; out.x = a.x + (b.x - a.x) * k; out.y = a.y + (b.y - a.y) * k; return out; }
    left -= seg;
  }
  const z = path[path.length - 1]; out.x = z.x; out.y = z.y; return out;
}

const SHIFT_PATH = NIGHT_PLACES.shift.map(px), SHIFT_LEN = lengthOf(SHIFT_PATH);
const COLUMN_PATH = NIGHT_PLACES.column.map(px), COLUMN_LEN = lengthOf(COLUMN_PATH);
/** Seconds the column marches before it halts at the gate (its last man in place), and the roll-call after. */
export const COLUMN_MARCH = (COLUMN_LEN / TILE) / COLUMN.speed;
export const COLUMN_CALLS_END = COLUMN_MARCH + COLUMN.calls * COLUMN.callEvery;
/** Seconds each Late Shift lamp walks; the last goes out at this. */
export const SHIFT_WALK = (SHIFT_LEN / TILE) / SHIFT.speed;
export const SHIFT_END = SHIFT_WALK + (SHIFT.lamps - 1) * SHIFT.gap;

export class NightEvents {
  /** What runs in this area now (the tests and the HUD read it). */
  now: NightEventNow[] = [];
  /** Test hook: an event forced on, from this many seconds ago (`?night=<id>`, fxNight). */
  forced: { id: NightEventId; at: number } | null = null;
  private readonly tracks = new Map<string, Track>();
  private walk: { night: number; w: Walk } | null = null;
  private askedKey = '';
  private asked: NightEventNow[] = [];
  private readonly news: NightNews[] = [];
  private readonly tmp = { x: 0, y: 0 };
  /** Seconds since the first frame (a forced event counts from here). */
  clock = 0;

  /** Each frame (surface only): which events run here, and what this Keeper has done about them. */
  update(f: NightFrame): NightNews[] {
    this.clock += f.dt;
    if (!f.surface) { this.now = []; return []; }
    // Which events run is asked twice a second (the seeds and the weather walk are cheap, but not every frame's work);
    // between asks each one's clock just moves on with the world's.
    const ms = f.ms;
    let live: NightEventNow[];
    if (ms === null) live = [];
    else {
      const key = `${f.area}|${Math.floor(ms / 500)}`;
      if (key !== this.askedKey) { this.askedKey = key; this.asked = nightEventsAt(f.area, ms, f.rolls); }
      live = this.asked.map(e => ({ ...e, t: (ms - e.startMs) / 1000 }));
    }
    if (this.forced) {
      const t = this.clock - this.forced.at;
      const secs = this.forced.id === 'count-goes-on' ? (COUNT.bells + 1) * COUNT.step : this.forced.id === 'relief-column' ? COLUMN_CALLS_END + 4 : this.forced.id === 'late-shift' ? SHIFT_END + 20 : KILN.glow;
      if (!live.some(e => e.id === this.forced!.id)) live.push({ id: this.forced.id, night: -1, startMs: 0, t: this.forced.id === 'count-goes-on' ? t % secs : t, secs });
    }
    this.now = live;
    for (const e of live) this.step(e, f);
    return this.news.splice(0);
  }

  private track(e: NightEventNow): Track {
    const key = `${e.id}:${e.night}`;
    let t = this.tracks.get(key);
    if (!t) { t = { near: 0, seen: 0, paid: false, bell: 0, full: false, lit: false, said: -1 }; this.tracks.set(key, t); if (this.tracks.size > 16) this.tracks.delete(this.tracks.keys().next().value!); }
    return t;
  }

  private step(e: NightEventNow, f: NightFrame): void {
    const k = f.keeper, tr = this.track(e);
    if (e.id === 'late-shift') {
      // Followed: within six tiles of a walking lamp for a while; paid where the last goes out, if the Keeper is there.
      for (let i = 0; i < SHIFT.lamps; i++) { const p = this.lampAt(e.t, i); if (p && Math.hypot(p.x - k.x, p.y - k.y) < 6 * TILE) { tr.near += f.dt; break; } }
      if (tr.said < 0 && e.t < SHIFT_END) { tr.said = 0; this.news.push({ kind: 'line', key: 'nightev.shift.seen' }); }
      if (!tr.paid && e.t >= SHIFT_END) {
        const end = SHIFT_PATH[SHIFT_PATH.length - 1];
        if (tr.near > 4 && Math.hypot(end.x - k.x, end.y - k.y) < 8 * TILE) { tr.paid = true; this.news.push({ kind: 'reward', id: e.id, night: e.night, x: end.x, y: end.y + 4 }, { kind: 'line', key: 'nightev.shift.scrap' }); }
      }
    } else if (e.id === 'count-goes-on') {
      const g = px(NIGHT_PLACES.gate), bell = countBell(e.t), at = Math.hypot(g.x - k.x, g.y - k.y) <= COUNT_GATE * TILE;
      if (bell !== tr.bell) {
        // A new bell: heard across the plot; the count is kept only by one who stood through it from the first.
        if (bell <= COUNT.bells && Math.hypot(g.x - k.x, g.y - k.y) < 26 * TILE) this.news.push({ kind: 'sfx', cue: 'count-bell' });
        if (bell === 1) tr.full = at;
        else if (bell <= COUNT.bells && !at) tr.full = false;
        if (bell === COUNT.bells + 1 && tr.full && at && !tr.paid) { tr.paid = true; this.news.push({ kind: 'reward', id: e.id, night: e.night, x: g.x + 10, y: g.y + 6 }, { kind: 'line', key: 'nightev.count.wren' }); }
        tr.bell = bell;
      }
    } else if (e.id === 'relief-column') {
      if (e.t < COLUMN_MARCH) {
        for (let i = 0; i < COLUMN.soldiers; i++) { const p = this.soldierAt(e.t, i); if (Math.hypot(p.x - k.x, p.y - k.y) < COLUMN.side * TILE) { tr.near += f.dt; break; } }
        tr.seen += f.dt;
        const beat = Math.floor(e.t / 4);
        if (beat !== tr.said && this.soldierNear(e.t, k, 24)) { tr.said = beat; this.news.push({ kind: 'sfx', cue: 'march' }); }
      } else if (e.t < COLUMN_CALLS_END) {
        const call = Math.floor((e.t - COLUMN_MARCH) / COLUMN.callEvery);
        if (call !== tr.bell) { tr.bell = call; if (this.soldierNear(e.t, k, 20)) this.news.push({ kind: 'sfx', cue: 'present' }); }
      } else if (!tr.paid) {
        const gate = COLUMN_PATH[COLUMN_PATH.length - 1];
        // Walked at their side most of the way (a share of the march, from wherever the Keeper joined), and at the gate now.
        if (tr.near >= COLUMN.share * Math.min(COLUMN_MARCH, Math.max(8, tr.seen)) && tr.near > 8 && Math.hypot(gate.x - k.x, gate.y - k.y) < 8 * TILE) {
          tr.paid = true; this.news.push({ kind: 'reward', id: e.id, night: e.night, x: gate.x + 8, y: gate.y + 2 }, { kind: 'line', key: 'nightev.column.chalk' });
        }
      }
    } else if (e.id === 'self-lit-kiln') {
      const kp = px(NIGHT_PLACES.kiln);
      if (tr.said < 0 && Math.hypot(kp.x - k.x, kp.y - k.y) < 22 * TILE) { tr.said = 0; this.news.push({ kind: 'sfx', cue: 'crackle' }); }
    } else if (e.id === 'walking-tree') this.stepWalker(e, f);
  }

  /** This night's Walking Tree (a new night, a new walk from home). */
  private walkOf(e: NightEventNow): Walk {
    if (!this.walk || this.walk.night !== e.night) this.walk = { night: e.night, w: { spot: -1, moves: 0, look: 0, struck: false, told: false, dimmed: false } };
    return this.walk.w;
  }
  private walkerPos(w: Walk | null): { x: number; y: number } { return px(w && w.spot >= 0 ? NIGHT_PLACES.walks[w.spot] : NIGHT_PLACES.walker); }
  /**
   * The Walking Tree (world-acts.md §5.3): looked at, then looked away from, it is somewhere else — only while unseen,
   * never within WALKER.keep tiles of the Keeper. After WALKER.moves moves it stops, and Glim dims beside it.
   */
  private stepWalker(e: NightEventNow, f: NightFrame): void {
    const w = this.walkOf(e), k = f.keeper;
    if (w.struck) return;
    const at = this.walkerPos(w), d = Math.hypot(at.x - k.x, at.y - k.y);
    const inView = f.seen ? f.seen(at.x, at.y) : d < 14 * TILE;
    if (w.moves >= WALKER.moves) {
      if (!w.dimmed && inView && d < 12 * TILE) { w.dimmed = true; this.news.push({ kind: 'line', key: 'nightev.walker.dim' }); }
      return;
    }
    if (inView) {
      w.look += f.dt;
      if (w.moves > 0 && !w.told && w.look >= WALKER.look) { w.told = true; this.news.push({ kind: 'line', key: 'nightev.walker.seen' }, { kind: 'sfx', cue: 'creak' }); }
      return;
    }
    if (w.look < WALKER.look) return;
    // Looked away from: it is somewhere else, out of sight, never close. Which spot is the night's own (seeded).
    const n = NIGHT_PLACES.walks.length, from = (Math.abs(e.night) * 7 + w.moves * 3) % n;
    for (let i = 0; i < n; i++) {
      const j = (from + i) % n;
      if (j === w.spot) continue;
      const p = px(NIGHT_PLACES.walks[j]);
      if (Math.hypot(p.x - k.x, p.y - k.y) < WALKER.keep * TILE || (f.seen ? f.seen(p.x, p.y) : Math.hypot(p.x - k.x, p.y - k.y) < 14 * TILE)) continue;
      w.spot = j; w.moves++; w.look = 0;
      return;
    }
  }
  /**
   * Where the copied tree stands now, in the Greenwood (home by day), and whether it waits for its blow (Glim has dimmed
   * beside it) or has had it. The engine draws it as one of the wilds' own trees.
   */
  walker(): { x: number; y: number; ready: boolean; struck: boolean } {
    const e = this.now.find(x => x.id === 'walking-tree'), w = e ? this.walkOf(e) : null, p = this.walkerPos(e ? w : null);
    return { x: p.x, y: p.y, ready: !!w && !w.struck && w.moves >= WALKER.moves, struck: !!w?.struck };
  }
  /** A blow at the copy (the Keeper within WALKER.reach tiles, Glim dimmed): it is a plain tree again, and leaves a copy-seed. */
  strikeWalker(k: { x: number; y: number }): boolean {
    const e = this.now.find(x => x.id === 'walking-tree');
    if (!e) return false;
    const w = this.walkOf(e), p = this.walkerPos(w);
    if (w.struck || w.moves < WALKER.moves || Math.hypot(p.x - k.x, p.y - k.y) > (WALKER.reach + .5) * TILE) return false;
    w.struck = true;
    this.news.push({ kind: 'reward', id: e.id, night: e.night, x: p.x + 14, y: p.y + 6 }, { kind: 'line', key: 'nightev.walker.struck' });
    return true;
  }

  /** The kiln glows now (the Keeper may light it), and is not yet lit by this Keeper tonight. */
  kilnLive(): NightEventNow | null {
    const e = this.now.find(x => x.id === 'self-lit-kiln');
    return e && e.t < KILN.glow && !this.track(e).lit ? e : null;
  }
  /** The Keeper lit the kiln before it faded (the host allowed it): its cache is laid beside it. */
  lightKiln(): boolean {
    const e = this.kilnLive();
    if (!e) return false;
    const tr = this.track(e);
    tr.lit = true;
    if (!tr.paid) { tr.paid = true; const kp = px(NIGHT_PLACES.kiln); this.news.push({ kind: 'reward', id: e.id, night: e.night, x: kp.x + 14, y: kp.y + 6 }, { kind: 'line', key: 'nightev.kiln.tally' }); }
    return true;
  }

  /** The Late Shift's lamp `i` at `t` s (null before it rises or after it goes out). */
  lampAt(t: number, i: number): { x: number; y: number } | null {
    const s = t - i * SHIFT.gap;
    if (s < 0 || s > SHIFT_WALK + SHIFT.out) return null;
    return along(SHIFT_PATH, s * SHIFT.speed * TILE, this.tmp);
  }
  /** The column's soldier `i` (0 the head) at `t` s: in file behind the head, halting in place at the gate. */
  soldierAt(t: number, i: number): { x: number; y: number } {
    const d = Math.min(COLUMN_LEN - i * COLUMN.gap * TILE, t * COLUMN.speed * TILE - i * COLUMN.gap * TILE);
    return along(COLUMN_PATH, d, this.tmp);
  }
  private soldierNear(t: number, k: { x: number; y: number }, tiles: number): boolean {
    const a = this.soldierAt(t, 0); if (Math.hypot(a.x - k.x, a.y - k.y) < tiles * TILE) return true;
    const b = this.soldierAt(t, COLUMN.soldiers - 1); return Math.hypot(b.x - k.x, b.y - k.y) < tiles * TILE;
  }

  /** The lights the dark reads (the dark-born keep back; the night pass opens round them): the lamps and the kiln. */
  lights(out: { x: number; y: number; r: number }[]): void {
    for (const e of this.now) {
      if (e.id === 'late-shift') for (let i = 0; i < SHIFT.lamps; i++) { const p = this.lampAt(e.t, i); if (p) out.push({ x: p.x, y: p.y - 12, r: 44 }); }
      else if (e.id === 'self-lit-kiln' && e.t < KILN.glow) { const kp = px(NIGHT_PLACES.kiln); out.push({ x: kp.x, y: kp.y - 8, r: 96 * this.kilnGlow(e) }); }
    }
  }
  private kilnGlow(e: NightEventNow): number {
    const lit = this.track(e).lit;
    if (lit) return 1;
    const t = e.t / KILN.glow;
    return t < .025 ? t / .025 : t > .8 ? Math.max(0, (1 - t) / .2) : 1;
  }

  /** The tracks for tests (what this Keeper has done about an event tonight). */
  trackOf(id: NightEventId): { near: number; paid: boolean; full: boolean; lit: boolean } | null {
    const e = this.now.find(x => x.id === id);
    if (!e) return null;
    const t = this.track(e);
    return { near: Math.round(t.near * 10) / 10, paid: t.paid, full: t.full, lit: t.lit };
  }

  /**
   * Over the night pass (so the dark never hides them): every figure upright where it stands (`at` anchors iso), a
   * faint ring at the lych-gate, the bell's count over it, "Present." over the gate. World space.
   */
  draw(c: CanvasRenderingContext2D, inView: (x: number, y: number) => boolean, time: number, still: boolean, at?: (x: number, y: number) => void, flat?: () => void, low = false): void {
    // Low detail and reduced motion: the same glows, held still (no pulse, no sparks, no swing).
    const calm = still || low;
    for (const e of this.now) {
      if (e.id === 'late-shift') {
        for (let i = 0; i < SHIFT.lamps; i++) {
          const s0 = e.t - i * SHIFT.gap;
          const p = this.lampAt(e.t, i);
          if (!p || !inView(p.x, p.y)) continue;
          const x = Math.round(p.x), y = Math.round(p.y);
          // Fading in at the shaft; at the walk's end it flares once and goes out (SHIFT.out s), a curl of smoke after it.
          const out = s0 > SHIFT_WALK ? (s0 - SHIFT_WALK) / SHIFT.out : 0;
          const a = out > 0 ? Math.max(0, 1 - out) : Math.min(1, s0 / 1.2);
          const flare = out > 0 && out < .3 ? 1 + (1 - out / .3) * .6 : 1;
          const sw = calm || out > 0 ? 0 : Math.round(Math.sin(time * 3 + i) * 1), lx = x + 3 + sw, ly = y - 14;
          // The warm light it throws on the ground, two tiles round (flat on the floor).
          flat?.();
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = '#ffb060';
          disc(c, x, y, 30 * flare, .16 * a, !flat);
          disc(c, x, y, 14 * flare, .18 * a, !flat);
          at?.(x, y);
          // The halo round the lamp itself: two to three tiles across, stepped, then the bright heart.
          c.fillStyle = '#ffd36d';
          disc(c, lx, ly, 34 * flare, .2 * a, false);
          disc(c, lx, ly, 18 * flare, .3 * a, false);
          disc(c, lx, ly, 8 * flare, .55 * a, false);
          c.globalCompositeOperation = 'source-over';
          if (out <= 0) {
            // The miner carrying it: the faintest grey; the lamp: a dark frame, a warm pane, the wick.
            c.globalAlpha = .22 * a; c.fillStyle = '#b8b0bc';
            c.fillRect(x - 3, y - 24, 6, 6); c.fillRect(x - 4, y - 18, 8, 12); c.fillRect(x - 3, y - 6, 2, 6); c.fillRect(x + 1, y - 6, 2, 6);
          }
          c.globalAlpha = a; c.fillStyle = '#2a2030'; c.fillRect(lx - 3, ly - 4, 7, 9); c.fillRect(lx, ly - 6, 1, 2);
          c.fillStyle = '#ffd36d'; c.fillRect(lx - 2, ly - 3, 5, 7);
          c.fillStyle = '#fff8e0'; c.fillRect(lx - 1, ly - 1, 3, 3);
          if (out > .3 && !calm) { const k = (out - .3) / .7; c.globalAlpha = .5 * (1 - k); c.fillStyle = '#b8b0bc'; c.fillRect(lx + Math.round(Math.sin(k * 6) * 2), ly - 8 - Math.round(k * 12), 2, 2); }
          c.globalAlpha = 1;
        }
      } else if (e.id === 'count-goes-on') {
        const g = px(NIGHT_PLACES.gate);
        if (!inView(g.x, g.y)) continue;
        const bell = countBell(e.t), beat = still ? 0 : 1 - ((e.t % COUNT.step) / COUNT.step);
        flat?.();
        // The gate's ring, where a Keeper stands to keep the count: a solid stepped circle, brighter on each bell.
        c.fillStyle = '#e8e4ef';
        c.globalAlpha = .35 + .4 * beat;
        for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; c.fillRect(Math.round(g.x + Math.cos(a) * COUNT_GATE * TILE), Math.round(g.y + Math.sin(a) * COUNT_GATE * TILE), 1, 1); }
        at?.(g.x, g.y);
        if (bell <= COUNT.bells) {
          // The count itself, large over the gate on a small dark plate (a bell's mark beside it).
          const y1 = Math.round(g.y) - 44 - Math.round(beat * 2), txt = String(bell);
          c.font = 'bold 12px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'bottom';
          c.globalAlpha = .7; c.fillStyle = '#140a1f'; c.fillRect(Math.round(g.x) - 13, y1 - 13, 26, 15);
          c.globalAlpha = .9; c.fillStyle = '#e8e4ef'; c.fillRect(Math.round(g.x) - 11, y1 - 11, 3, 3); c.fillRect(Math.round(g.x) - 12, y1 - 8, 5, 2);
          c.globalAlpha = .65 + .35 * beat; c.fillStyle = '#fff2c8'; c.fillText(txt, Math.round(g.x) + 3, y1);
        }
      } else if (e.id === 'relief-column') {
        for (let i = 0; i < COLUMN.soldiers; i++) {
          const p = this.soldierAt(e.t, i);
          if (!inView(p.x, p.y)) continue;
          const x = Math.round(p.x) + (i % 2 ? 5 : -5), y = Math.round(p.y);
          at?.(x, y);
          const marching = e.t < COLUMN_MARCH && !still, bob = marching && Math.floor(time * 4 + i) % 2 ? 1 : 0;
          const fade = e.t > COLUMN_CALLS_END ? Math.max(0, 1 - (e.t - COLUMN_CALLS_END) / 4) : Math.min(1, e.t / 2);
          // Grey, half-seen: helm, shoulders, a spear; no face.
          c.globalAlpha = .55 * fade; c.fillStyle = '#c8c2cc';
          c.fillRect(x - 3, y - 22 - bob, 6, 5); c.fillRect(x - 4, y - 17 - bob, 8, 9); c.fillRect(x - 3, y - 8, 2, 8 - bob); c.fillRect(x + 1, y - 8, 2, 8 - (1 - bob));
          c.globalAlpha = .7 * fade; c.fillStyle = '#e8e4ef'; c.fillRect(x + 5, y - 30 - bob, 1, 26); c.fillRect(x + 4, y - 31 - bob, 3, 2);
        }
        if (e.t >= COLUMN_MARCH && e.t < COLUMN_CALLS_END) {
          const gate = COLUMN_PATH[COLUMN_PATH.length - 1];
          if (!inView(gate.x, gate.y)) continue;
          at?.(gate.x, gate.y);
          const k = ((e.t - COLUMN_MARCH) % COLUMN.callEvery) / COLUMN.callEvery, a = still ? .8 : Math.max(0, 1 - k * 1.2);
          c.font = '7px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'bottom';
          c.globalAlpha = .5 * a; c.fillStyle = '#140a1f'; c.fillText('Present.', Math.round(gate.x) + 1, Math.round(gate.y) - 37);
          c.globalAlpha = .85 * a; c.fillStyle = '#e8e4ef'; c.fillText('Present.', Math.round(gate.x), Math.round(gate.y) - 38 - (still ? 0 : Math.round(k * 4)));
        }
      } else if (e.id === 'walking-tree') {
        // Glim dims beside the copy (the tree itself is drawn as one of the wilds' own: td-world `extra`): a small pale
        // light at its trunk, a third as bright as Glim, breathing slowly (held still on Low and under reduced motion).
        const wk = this.walker();
        if (!wk.ready || !inView(wk.x, wk.y)) continue;
        const gx = Math.round(wk.x + 14), gy = Math.round(wk.y - 22 + (calm ? 0 : Math.sin(time * 1.2) * 2)), b = calm ? .8 : .7 + .3 * Math.sin(time * .9);
        at?.(gx, gy + 22);
        c.fillStyle = '#a8c8d8';
        disc(c, gx, gy, 16, .14 * b, false);
        disc(c, gx, gy, 8, .32 * b, false);
        c.globalAlpha = .7 * b; c.fillStyle = '#d8e8f0'; c.fillRect(gx - 2, gy - 2, 4, 4);
        // A slow ring breathing out from her (held at its middle on Low and under reduced motion): seen from across the glade.
        const k = calm ? .5 : (time * .5) % 1, rr = 6 + k * 14;
        c.globalAlpha = .45 * (1 - k); c.fillStyle = '#c8d4dc';
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.fillRect(Math.round(gx + Math.cos(a) * rr), Math.round(gy + Math.sin(a) * rr * .8), 1, 1); }
        // Her wings, folded and grey: Glim herself, gone dim.
        c.globalAlpha = .5 * b; c.fillStyle = '#c8d0d8'; c.fillRect(gx - 6, gy - 3, 3, 3); c.fillRect(gx + 3, gy - 3, 3, 3);
        c.globalAlpha = 1;
      } else if (e.id === 'self-lit-kiln') {
        const kp = px(NIGHT_PLACES.kiln);
        if (!inView(kp.x, kp.y)) continue;
        // A slow pulse (held still on Low and under reduced motion); a warm ground three tiles round; a column of
        // light over the mouth so it reads from six tiles off; the mouth itself white-hot at its heart.
        const g = this.kilnGlow(e), fl = calm ? 1 : .85 + .15 * Math.sin(time * 1.6);
        const x0 = Math.round(kp.x), y0 = Math.round(kp.y);
        flat?.();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = '#ff8a3d';
        disc(c, x0, y0, 48 * fl, .14 * g, !flat);
        disc(c, x0, y0, 28 * fl, .2 * g, !flat);
        disc(c, x0, y0, 12, .3 * g, !flat);
        at?.(kp.x, kp.y);
        c.fillStyle = '#ffb060';
        disc(c, x0, y0 - 10, 30 * fl, .2 * g, false);
        disc(c, x0, y0 - 10, 14 * fl, .35 * g, false);
        c.globalAlpha = .12 * g * fl; c.fillRect(x0 - 5, y0 - 52, 10, 42); c.fillRect(x0 - 3, y0 - 70, 6, 18);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = g; c.fillStyle = '#2a1a18'; c.fillRect(x0 - 7, y0 - 14, 14, 10);
        c.fillStyle = '#ff8a3d'; c.fillRect(x0 - 5, y0 - 12, 10, 7);
        c.fillStyle = '#ffd36d'; c.fillRect(x0 - 3, y0 - 11, 6, 5);
        c.fillStyle = '#fff8e0'; c.fillRect(x0 - 1, y0 - 10, 2, 3);
        if (!calm) for (let i = 0; i < 5; i++) {
          const k = (time * .6 + i / 5) % 1, sx = x0 + Math.round(Math.sin(time * 2 + i * 1.7) * 5), sy = y0 - 18 - Math.round(k * 34);
          c.globalAlpha = .9 * g * (1 - k); c.fillStyle = i % 2 ? '#ffd36d' : '#ff8a3d'; c.fillRect(sx, sy, 2, 2);
        }
        c.globalAlpha = 1;
        // The burners' shadows working it, leaving before it fades (never once it is lit: they have gone home).
        if (!this.track(e).lit && e.t < KILN.glow * .75) for (let i = 0; i < 2; i++) {
          const ph = still ? i * 2 : time * .6 + i * Math.PI, bx = Math.round(kp.x + Math.cos(ph) * 16), by = Math.round(kp.y + 6 + Math.sin(ph) * 5);
          at?.(bx, by);
          c.globalAlpha = .4 * Math.min(1, (KILN.glow * .75 - e.t) / 6); c.fillStyle = '#140a1f';
          c.fillRect(bx - 2, by - 16, 4, 4); c.fillRect(bx - 3, by - 12, 6, 12);
        }
      }
    }
    c.globalAlpha = 1;
  }
}

/** The names a night's reward floats under (the satchel's own names: material-catalog MATERIAL_NAMES). */
const NAMES: Readonly<Record<string, string>> = {
  'cold-miners-pasty': 'Cold Miner\'s Pasty', 'margin-note-scrap': 'Margin Note Scrap', charcoal: 'Charcoal', 'basalt-blank': 'Basalt Blank',
  'copy-seed': 'Copy-Seed',
};
export function nightLabel(id: string): string { return NAMES[id] ?? id; }

/** The reward rows for an event (the engine lays them as drops; the host books them by drop id). */
export function nightRewardRows(id: NightEventId): typeof NIGHT_REWARDS[NightEventId] { return NIGHT_REWARDS[id]; }
