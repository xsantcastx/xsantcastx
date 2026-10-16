/**
 * glim-sprite.ts — Glim, drawn: a 12×10 art-pixel moth of lamplight.
 *
 * Art brief (world-and-cast.md §4 "Look"; npc-glim in docs/art-commissions/commissions.csv):
 * amber-gold body (Luminous gold), wings of pale dawn-glass with faint map
 * lines inked on them, violet only at the wing edges (canon: violet is
 * Godforge energy), no face beyond two small bright points, never cute. Until
 * the painted sheet lands this is the placeholder, hand-authored in the same
 * grid: idle/fly flutter of 4 frames (up, mid, down, mid) and a "dim" frame.
 * 2× like every tile (16×16 art px on a 32px cell), so 24×20 world px.
 *
 * Motion: Glim rides the Keeper's shoulder in towns and hunts, and hovers a
 * little ahead at chest height in the Delve, where it *is* the lantern (the
 * light's radius and position are unchanged; it just has a source now). It
 * follows with an exponential ease, bobs, and on Show me flies ahead to the
 * target leaving a short trail, waits, and comes back. Reduced motion: no
 * flutter, no bob, no flight, no trail; it simply sits at its anchor. Phones
 * (render budget `glows` off): the same sprite, a pre-baked halo, half the trail.
 */

import { GLIM_FACE_PALETTE, GLIM_H, GLIM_PALETTE, GLIM_PALETTE_DIM, GLIM_W, glimFace, glimRows, type GlimFrameName, type GlimMood } from '../../shared/glim/glim-art';

/** Frames in play order: idle and fly share the cycle (fly runs it faster). */
const CYCLE: readonly GlimFrameName[] = ['up', 'mid', 'down', 'mid'];

/** Where Glim is going: its anchor, a Show me target, or back. */
type Flight = { x: number; y: number; phase: 'out' | 'hold' | 'back'; hold: number } | null;

export interface GlimFrameInput {
  dt: number;
  time: number;
  reduced: boolean;
  /** Keeper feet, world px, and facing (1 right, -1 left). */
  keeperX: number;
  keeperY: number;
  facing: number;
  /** The Keeper's figure scale (k). */
  figure: number;
  delve: boolean;
  /** Somewhere to rest instead of the shoulder (the sleeping pet's head), or null. */
  perch?: { x: number; y: number } | null;
}

export class GlimSprite {
  x = NaN;
  y = NaN;
  shown = false;
  dim = false;
  /** The bond's sense (glim-bond.ts): brighter near a room no lantern has touched. Dim wins. */
  bright = false;
  /** Set while flying ahead on Show me; null otherwise. Read by the HUD (data-glim-*). */
  targetX: number | null = null;
  /** Reached the Show me target this flight (stays true until the next flight). */
  arrived = false;
  private flight: Flight = null;
  private readonly trail: { x: number; y: number }[] = [];
  private trailClock = 0;
  private frames: Record<string, HTMLCanvasElement> = {};
  private halo: HTMLCanvasElement | null = null;
  /** Its face now (glim-art.ts GlimMood), and how long a felt mood lasts. */
  mood: GlimMood = 'calm';
  private moodFor = 0;
  /** A loop-de-loop of joy (s left), and a high five's dart (s left). */
  private loop = 0;
  private five = 0;
  /** Seconds the Keeper (and Glim) have been calm: it gets sleepy at rest. */
  private calm = 0;

  /** A feeling for a while: a grin loops once, a gasp jolts. */
  feel(mood: GlimMood, seconds = 2.5): void {
    this.mood = mood; this.moodFor = seconds; this.calm = 0;
    if (mood === 'happy') this.loop = Math.max(this.loop, 1);
  }
  /** A high five: dart to the Keeper's hand, a grin, then home. */
  highFive(x: number, y: number): void {
    this.flight = { x, y, phase: 'out', hold: .35 };
    this.targetX = x; this.arrived = false; this.trail.length = 0;
    this.five = 1.2;
    this.feel('happy', 2.2);
  }

  /** Fly in from above the Keeper (the Prologue landing on the shoulder). */
  arrive(fromX: number, fromY: number): void {
    this.x = fromX; this.y = fromY;
    // A homeward flight: eased in to the shoulder, leaving its trail.
    this.flight = { x: fromX, y: fromY, phase: 'back', hold: 0 };
    this.trail.length = 0;
  }

  /** A new place: Glim is simply at the Keeper's shoulder (no flight across the old area's coordinates). */
  reset(): void {
    this.x = NaN; this.y = NaN; this.flight = null; this.trail.length = 0;
  }

  /** Show me: fly ahead to world (x, y), wait (`hold` s), come back. */
  flyTo(x: number, y: number, hold = .8): void {
    this.flight = { x, y, phase: 'out', hold };
    this.targetX = x;
    this.arrived = false;
    this.trail.length = 0;
  }

  /** The anchor: the shoulder in towns, a little ahead at chest height in the Delve. */
  anchor(f: GlimFrameInput): { x: number; y: number } {
    const k = f.figure;
    // The chibi Keeper (keeper-paint.ts) is ~124 px tall: Glim hovers by the big head, or ahead at its chest.
    return f.delve
      ? { x: f.keeperX + f.facing * 34 * k, y: f.keeperY - 64 * k }
      : { x: f.keeperX - f.facing * 30 * k, y: f.keeperY - 118 * k };
  }

  update(f: GlimFrameInput): void {
    this.moodFor = Math.max(0, this.moodFor - f.dt);
    this.loop = Math.max(0, this.loop - f.dt);
    this.five = Math.max(0, this.five - f.dt);
    // Resting on the pet's head, or long calm: sleepy eyes (any felt mood wins).
    this.calm = f.perch ? this.calm + f.dt : 0;
    if (this.moodFor <= 0) this.mood = this.calm > 2 ? 'sleepy' : 'calm';
    const home = f.perch && !this.flight ? f.perch : this.anchor(f);
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || f.reduced) {
      this.x = home.x; this.y = home.y;
      if (f.reduced && this.flight) { this.arrived = true; this.flight = null; }
      this.trail.length = 0;
      return;
    }
    let tx = home.x, ty = home.y, rate = 6;
    const flight = this.flight;
    if (flight) {
      if (flight.phase === 'out') { tx = flight.x; ty = flight.y; rate = 3.2; }
      else if (flight.phase === 'hold') { tx = flight.x; ty = flight.y; flight.hold -= f.dt; if (flight.hold <= 0) flight.phase = 'back'; }
      else rate = 3.6;
    }
    const ease = 1 - Math.exp(-rate * Math.min(f.dt, .1));
    let nx = this.x + (tx - this.x) * ease, ny = this.y + (ty - this.y) * ease;
    // Never faster than a moth: 1100 px/s.
    const step = Math.hypot(nx - this.x, ny - this.y), cap = 1100 * f.dt;
    if (step > cap && step > 0) { nx = this.x + (nx - this.x) * cap / step; ny = this.y + (ny - this.y) * cap / step; }
    this.x = nx; this.y = ny;
    if (flight) {
      const d = Math.hypot(tx - this.x, ty - this.y);
      if (flight.phase === 'out' && d < 10) { flight.phase = 'hold'; this.arrived = true; }
      else if (flight.phase === 'back' && d < 12) { this.flight = null; }
      this.trailClock += f.dt;
      if (this.trailClock >= 1 / 30) {
        this.trailClock = 0;
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 14) this.trail.shift();
      }
    } else if (this.trail.length) {
      this.trail.shift();
    }
  }

  get flying(): boolean { return !!this.flight; }

  draw(c: CanvasRenderingContext2D, time: number, reduced: boolean, glows: boolean, figure: number): void {
    if (!this.shown || !Number.isFinite(this.x)) return;
    const k = Math.max(.7, figure);
    const bob = reduced || this.mood === 'sleepy' ? 0 : Math.sin(time * 2.2) * 3;
    // A loop-de-loop of joy: one small circle (never under reduced motion).
    const lp = reduced ? 0 : this.loop;
    const loopX = lp ? Math.sin((1 - lp) * Math.PI * 2) * 14 * k : 0, loopY = lp ? (Math.cos((1 - lp) * Math.PI * 2) - 1) * 12 * k : 0;
    const x = Math.round(this.x + loopX), y = Math.round(this.y + bob + loopY);
    const light = this.dim ? .25 : 1;
    // The trail: small square motes, the oldest faintest (half of them on a phone).
    for (let i = glows ? 0 : 1; i < this.trail.length; i += glows ? 1 : 2) {
      const p = this.trail[i]!, a = (i + 1) / this.trail.length;
      c.globalAlpha = .55 * a * light; c.fillStyle = i % 3 ? '#ffd98a' : '#c9a6ff';
      const s = Math.round((2 + a * 3) * k);
      c.fillRect(Math.round(p.x) - s / 2, Math.round(p.y + bob) - s / 2, s, s);
    }
    c.globalAlpha = 1;
    const halo = this.haloCanvas();
    if (halo) {
      const lit = this.bright && !this.dim;
      const r = (this.dim ? 22 : lit ? 58 : 40) * k * (reduced ? 1 : 1 + Math.sin(time * (lit ? 4.4 : 3.1)) * (lit ? .1 : .05));
      c.globalAlpha = this.dim ? .3 : lit ? 1 : .85;
      c.drawImage(halo, x - r, y - r, r * 2, r * 2);
      c.globalAlpha = 1;
    }
    const frameName = this.dim ? 'dim' : CYCLE[reduced || this.mood === 'sleepy' ? 1 : Math.floor(time * (this.flight || this.five ? 14 : 7)) % CYCLE.length]!;
    const art = this.frame(frameName, this.dim ? 'calm' : this.mood);
    if (!art) return;
    const w = GLIM_W * 2 * k, h = GLIM_H * 2 * k;
    const smooth = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    c.drawImage(art, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
    c.imageSmoothingEnabled = smooth;
    if (this.mood === 'sleepy' && !reduced) {
      // A tiny drifting z over a resting Glim.
      const u = (time * .5) % 1;
      c.globalAlpha = .7 * (1 - u); c.fillStyle = '#d8dcf0';
      const s = Math.max(2, Math.round(2 * k));
      const zx = Math.round(x + 10 * k + u * 8 * k), zy = Math.round(y - 12 * k - u * 16 * k);
      c.fillRect(zx, zy, s * 3, s); c.fillRect(zx + s, zy + s, s, s); c.fillRect(zx, zy + 2 * s, s * 3, s);
      c.globalAlpha = 1;
    }
  }

  /** Each frame × face baked once into a 12×10 canvas (one drawImage per frame after that). */
  private frame(name: GlimFrameName | 'dim', mood: GlimMood = 'calm'): HTMLCanvasElement | null {
    const key = `${name}:${mood}`;
    if (this.frames[key]) return this.frames[key]!;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = GLIM_W; canvas.height = GLIM_H;
    const g = canvas.getContext('2d');
    if (!g) return null;
    const palette = name === 'dim' ? GLIM_PALETTE_DIM : GLIM_PALETTE;
    glimRows(name === 'dim' ? 'mid' : name).forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x]!];
        if (color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
      }
    });
    for (const [x, y, key] of glimFace(mood)) {
      g.fillStyle = GLIM_FACE_PALETTE[key] ?? palette[key] ?? '#fff';
      g.fillRect(x, y, 1, 1);
    }
    return (this.frames[key] = canvas);
  }

  /** The warm halo, baked once: a phone pays one drawImage, not a gradient or a shadowBlur. */
  private haloCanvas(): HTMLCanvasElement | null {
    if (this.halo) return this.halo;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    if (!g) return null;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 226, 150, 0.85)');
    grad.addColorStop(.35, 'rgba(255, 196, 92, 0.35)');
    grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return (this.halo = canvas);
  }
}
