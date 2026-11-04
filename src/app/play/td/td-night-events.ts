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
  COLUMN, COUNT, COUNT_GATE, KILN, NIGHT_REWARDS, SHIFT, countBell, nightEventsAt, type NightEventId, type NightEventNow,
} from '../../shared/night-events/night-events.model';
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
} as const;
export const KILN_STATION = 'sealed:deep-kiln';

export type NightNews =
  | { kind: 'reward'; id: NightEventId; night: number; x: number; y: number }
  | { kind: 'line'; key: string }
  | { kind: 'sfx'; cue: 'farbell' | 'march' | 'crackle' | 'count-bell' | 'present' };

export interface NightFrame {
  /** The world clock (the room's while it speaks), or null before the host has said. */
  ms: number | null;
  rolls?: WeatherInput['rolls'];
  area: string;
  surface: boolean;
  keeper: { x: number; y: number };
  dt: number;
}

interface Track { near: number; seen: number; paid: boolean; bell: number; full: boolean; lit: boolean; said: number }

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
    }
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
    if (s < 0 || s > SHIFT_WALK) return null;
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
      if (e.id === 'late-shift') for (let i = 0; i < SHIFT.lamps; i++) { const p = this.lampAt(e.t, i); if (p) out.push({ x: p.x, y: p.y - 12, r: 28 }); }
      else if (e.id === 'self-lit-kiln' && e.t < KILN.glow) { const kp = px(NIGHT_PLACES.kiln); out.push({ x: kp.x, y: kp.y - 8, r: 60 * this.kilnGlow(e) }); }
    }
  }
  private kilnGlow(e: NightEventNow): number {
    const lit = this.track(e).lit;
    if (lit) return 1;
    const t = e.t / KILN.glow;
    return t < .1 ? t / .1 : t > .8 ? Math.max(0, (1 - t) / .2) : 1;
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
  draw(c: CanvasRenderingContext2D, inView: (x: number, y: number) => boolean, time: number, still: boolean, at?: (x: number, y: number) => void, flat?: () => void): void {
    for (const e of this.now) {
      if (e.id === 'late-shift') {
        for (let i = 0; i < SHIFT.lamps; i++) {
          const p = this.lampAt(e.t, i);
          if (!p || !inView(p.x, p.y)) continue;
          const x = Math.round(p.x), y = Math.round(p.y);
          at?.(x, y);
          // A fading-in lamp at the shaft, a fading-out one where the walk ends; between, a lamp at hip height, swinging.
          const s = e.t - i * SHIFT.gap, a = Math.min(1, s / 1.5, (SHIFT_WALK - s) / 1.5);
          const sw = still ? 0 : Math.round(Math.sin(time * 3 + i) * 1), lx = x + 3 + sw, ly = y - 14;
          // The one carrying it is the faintest grey, a miner's shape; the lamp itself is what is seen from afar.
          c.globalAlpha = .16 * a; c.fillStyle = '#b8b0bc';
          c.fillRect(x - 3, y - 24, 6, 6); c.fillRect(x - 4, y - 18, 8, 12); c.fillRect(x - 3, y - 6, 2, 6); c.fillRect(x + 1, y - 6, 2, 6);
          // A stepped glow round the lamp, then the lamp: a dark frame, a warm pane, its bright wick.
          c.fillStyle = '#ffd36d';
          c.globalAlpha = .14 * a; c.fillRect(lx - 9, ly - 6, 18, 14); c.fillRect(lx - 6, ly - 9, 12, 20);
          c.globalAlpha = .22 * a; c.fillRect(lx - 5, ly - 4, 10, 10);
          c.globalAlpha = .95 * a; c.fillStyle = '#3a3048'; c.fillRect(lx - 2, ly - 3, 5, 7); c.fillRect(lx, ly - 5, 1, 2);
          c.fillStyle = '#ffd36d'; c.fillRect(lx - 1, ly - 2, 3, 5);
          c.fillStyle = '#fff2c8'; c.fillRect(lx, ly - 1, 1, 2);
        }
      } else if (e.id === 'count-goes-on') {
        const g = px(NIGHT_PLACES.gate);
        if (!inView(g.x, g.y)) continue;
        const bell = countBell(e.t), beat = still ? 0 : 1 - ((e.t % COUNT.step) / COUNT.step);
        flat?.();
        c.globalAlpha = .2 + .25 * beat; c.fillStyle = '#e8e4ef';
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.fillRect(Math.round(g.x + Math.cos(a) * COUNT_GATE * TILE), Math.round(g.y + Math.sin(a) * COUNT_GATE * TILE), 1, 1); }
        at?.(g.x, g.y);
        if (bell <= COUNT.bells) {
          c.font = '8px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'bottom';
          c.globalAlpha = .6; c.fillStyle = '#140a1f'; c.fillText(String(bell), Math.round(g.x) + 1, Math.round(g.y) - 29);
          c.globalAlpha = .55 + .4 * beat; c.fillStyle = '#e8e4ef'; c.fillText(String(bell), Math.round(g.x), Math.round(g.y) - 30 - Math.round(beat * 2));
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
          c.globalAlpha = .38 * fade; c.fillStyle = '#b8b0bc';
          c.fillRect(x - 3, y - 22 - bob, 6, 5); c.fillRect(x - 4, y - 17 - bob, 8, 9); c.fillRect(x - 3, y - 8, 2, 8 - bob); c.fillRect(x + 1, y - 8, 2, 8 - (1 - bob));
          c.globalAlpha = .5 * fade; c.fillStyle = '#e8e4ef'; c.fillRect(x + 5, y - 30 - bob, 1, 26); c.fillRect(x + 4, y - 31 - bob, 3, 2);
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
      } else if (e.id === 'self-lit-kiln') {
        const kp = px(NIGHT_PLACES.kiln);
        if (!inView(kp.x, kp.y)) continue;
        const g = this.kilnGlow(e), fl = still ? 1 : .8 + .2 * Math.sin(time * 9) * Math.sin(time * 3.7);
        flat?.();
        c.globalAlpha = .28 * g * fl; c.fillStyle = '#ff8a3d'; c.fillRect(Math.round(kp.x) - 14, Math.round(kp.y) - 4, 28, 8);
        at?.(kp.x, kp.y);
        c.globalAlpha = .75 * g * fl; c.fillStyle = '#ffb060'; c.fillRect(Math.round(kp.x) - 3, Math.round(kp.y) - 10, 6, 4);
        c.globalAlpha = .9 * g; c.fillStyle = '#ffe9a8'; c.fillRect(Math.round(kp.x) - 1, Math.round(kp.y) - 9, 2, 2);
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
};
export function nightLabel(id: string): string { return NAMES[id] ?? id; }

/** The reward rows for an event (the engine lays them as drops; the host books them by drop id). */
export function nightRewardRows(id: NightEventId): typeof NIGHT_REWARDS[NightEventId] { return NIGHT_REWARDS[id]; }
