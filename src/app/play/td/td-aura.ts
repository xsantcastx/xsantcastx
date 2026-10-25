/**
 * td-aura.ts — the aura look (the art style upgrade, owner 2026-10-26: "look at that aura the player has and the
 * details, that's what we need"; docs/handoff/art-style.md). One reusable system for every aura a figure wears: the
 * Keeper's running aura today, gear and callings and D2-style monster auras later.
 *
 * Three layers, each from the same palette (`AuraLook`: core · body · edge · dark, an intensity and a ring size):
 * - **Ground** (under everything standing): a claimed floor — a dark stepped disc in the aura's colour — and three
 *   layered rings in 3/4 view (ellipses), the outer one two pixels thick in bright dashes with dark gaps, turning; a
 *   finer ring inside turning the other way; a faint one nearer the feet; a stepped halo of added light along the outer
 *   ring and a few white-hot sparks running round it. The back half of each ring is dimmer than the front.
 * - **Air** (over the figure): motes rising from inside the ring, flickering from white-hot to the edge tone as they
 *   climb, a spark's plus at birth. ≤ 10 alive (effects-spec §Budget), spawned by intensity.
 * - **Rim**: the figure's own silhouette in the aura's body colour, a pixel out all round (and fainter two out), under
 *   the sprite — the soft rim-glow on the outline.
 * Reduced motion: the same rings, still; no motes; the rim still drawn. All whole pixels; nothing is cached per frame
 * but a ring's pixel list per size, and two small scratch canvases for the rim.
 */
import type { Tones } from './td-fx';

export interface AuraLook {
  /** White-hot core, body, edge: the element's three tones (effects-spec rule 2). */
  readonly core: string;
  readonly body: string;
  readonly edge: string;
  /** The gaps between the dashes and the claimed floor's tint. */
  readonly dark: string;
  /** 0.4 faint … 1 full … 1.4 blazing: how bright the layers are and how many motes rise. */
  readonly intensity: number;
  /** The foot ring's half-width in art px (its half-height is about half that: 3/4 view). */
  readonly ring: number;
  /** Motes rising (an arcane or a fire aura), or none. */
  readonly motes: boolean;
}

/** The auras' looks by name. `arcane` is the owner's reference (the violet swordsman). */
export const AURA_LOOKS = {
  arcane: { core: '#fbeeff', body: '#c47dff', edge: '#8a3ee6', dark: '#2c0f4a', intensity: 1.1, ring: 22, motes: true },
  shadow: { core: '#f0e0ff', body: '#b06bff', edge: '#6b3aa0', dark: '#241034', intensity: .9, ring: 18, motes: true },
  ember: { core: '#fff2a8', body: '#ffb347', edge: '#e2552a', dark: '#3a120a', intensity: .95, ring: 18, motes: true },
  life: { core: '#e6ffe9', body: '#7fe08a', edge: '#3f8f4a', dark: '#0e2a14', intensity: .85, ring: 18, motes: true },
  brass: { core: '#fff2c8', body: '#e0b25a', edge: '#8a6a2a', dark: '#2e2010', intensity: .85, ring: 18, motes: true },
  lamp: { core: '#fffbe8', body: '#ffd27a', edge: '#c99a3e', dark: '#2e2410', intensity: .85, ring: 18, motes: true },
  wild: { core: '#f0fff8', body: '#9af0d0', edge: '#4cb898', dark: '#0c2a22', intensity: .85, ring: 18, motes: true },
} as const satisfies Record<string, AuraLook>;
export type AuraLookId = keyof typeof AURA_LOOKS;

/** An aura look from an element's three tones (a monster aura in its element, a piece of gear's colour). */
export function auraFrom(t: Tones, dark: string, intensity = 1, ring = 18, motes = true): AuraLook {
  return { core: t.core, body: t.body, edge: t.edge, dark, intensity, ring, motes };
}

type Pt = { x: number; y: number; a: number };
const rings = new Map<string, Pt[]>();
/** The pixels of an ellipse's outline, in order round it (angle 0 at the right, π/2 at the front). */
function ellipse(rx: number, ry: number): Pt[] {
  const key = `${rx}|${ry}`;
  let pts = rings.get(key);
  if (pts) return pts;
  pts = [];
  const seen = new Set<number>(), n = Math.ceil(Math.PI * 2 * Math.max(rx, ry) * 3);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.round(Math.cos(a) * rx), y = Math.round(Math.sin(a) * ry), k = (x + 512) * 1024 + y + 512;
    if (seen.has(k)) continue;
    seen.add(k); pts.push({ x, y, a });
  }
  rings.set(key, pts);
  return pts;
}

interface Mote { x: number; y: number; age: number; life: number; seed: number; rise: number }

/** One figure's aura: its motes, and the clock they rise by. */
export class AuraFx {
  private motes: Mote[] = [];
  private last = -1;
  private due = 0;
  /** Motes alive now (the budget's check). */
  get alive(): number { return this.motes.length; }

  /** Advance to `time` (s): motes climb and die, new ones rise at the intensity's rate. No motes while still. */
  step(time: number, look: AuraLook, still: boolean): void {
    const dt = this.last < 0 ? 0 : Math.max(0, Math.min(.1, time - this.last));
    this.last = time;
    if (still || !look.motes) { this.motes.length = 0; return; }
    for (const m of this.motes) m.age += dt;
    this.motes = this.motes.filter(m => m.age < m.life);
    this.due += dt * 9 * look.intensity;
    while (this.due >= 1) {
      this.due -= 1;
      if (this.motes.length >= 10) continue;
      const s = Math.random(), a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * look.ring * .95;
      this.motes.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * .48, age: 0, life: .9 + Math.random() * .7, seed: s, rise: 16 + Math.random() * 12 });
    }
  }

  /** The ground layer round feet at (x, y). */
  ground(c: CanvasRenderingContext2D, x: number, y: number, look: AuraLook, time: number, still: boolean): void {
    const X = Math.round(x), Y = Math.round(y), I = look.intensity, rx = look.ring, ry = Math.max(4, Math.round(rx * .48));
    const breathe = still ? 1 : .9 + .1 * Math.sin(time * 3.1);
    const was = c.globalAlpha, op = c.globalCompositeOperation;
    // The claimed floor: the aura's own colour laid over the ground (deep at the rim, paler toward the feet), stepped.
    for (const [k, a, col] of [[1.04, .34, look.dark], [.9, .3, look.edge], [.66, .22, look.edge], [.4, .16, look.body]] as const) {
      c.fillStyle = col; c.globalAlpha = was * a * Math.min(1.2, I) * breathe;
      fillEllipse(c, X, Y, Math.round(rx * k), Math.max(2, Math.round(ry * k)));
    }
    // An under-glow of added light just inside the ring.
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = look.edge;
    c.globalAlpha = was * .14 * I * breathe;
    for (const p of ellipse(rx - 2, Math.max(2, ry - 2))) c.fillRect(X + p.x, Y + p.y, 1, 1);
    for (const p of ellipse(rx - 3, Math.max(2, ry - 3))) c.fillRect(X + p.x, Y + p.y, 1, 1);
    c.globalCompositeOperation = op;
    const turn = still ? 0 : time / 9;
    // The outer ring: two pixels thick, bright dashes with dark gaps between; the back half dimmer (it is further off).
    const outer = ellipse(rx, ry), inner = ellipse(rx - 1, Math.max(2, ry - 1)), rim = ellipse(rx + 1, ry + 1);
    const tone = (a: number, t: number) => {
      const seg = Math.floor(((a / (Math.PI * 2) + t) % 1 + 1) % 1 * 22);
      return seg % 5 === 4 ? look.dark : seg % 5 === 0 ? look.core : seg % 5 === 2 ? look.edge : look.body;
    };
    for (const ring of [rim, outer, inner]) for (const p of ring) {
      const back = p.y < 0;
      c.globalAlpha = was * Math.min(1, (back ? .62 : 1) * I * breathe);
      const tn = tone(p.a, turn);
      c.fillStyle = ring === rim ? (tn === look.dark ? look.dark : look.edge) : ring === inner && tn === look.core ? look.body : tn;
      c.fillRect(X + p.x, Y + p.y, 1, 1);
    }
    // The halo along it: added light a pixel outside and two inside.
    c.globalCompositeOperation = 'lighter'; c.fillStyle = look.body;
    c.globalAlpha = was * .32 * I * breathe;
    for (const p of ellipse(rx + 2, ry + 2)) c.fillRect(X + p.x, Y + p.y, 1, 1);
    c.globalAlpha = was * .2 * I * breathe;
    for (const p of ellipse(rx - 2, Math.max(2, ry - 2))) c.fillRect(X + p.x, Y + p.y, 1, 1);
    c.globalCompositeOperation = op;
    // The middle ring, finer, turning the other way; and a faint one near the feet.
    const mid = ellipse(Math.round(rx * .7), Math.max(2, Math.round(ry * .7)));
    for (const p of mid) {
      const seg = Math.floor(((p.a / (Math.PI * 2) - turn * 1.4) % 1 + 1) % 1 * 18);
      if (seg % 3 === 2) continue;
      c.globalAlpha = was * Math.min(1, (p.y < 0 ? .5 : .85) * I);
      c.fillStyle = seg % 6 === 0 ? look.core : look.edge; c.fillRect(X + p.x, Y + p.y, 1, 1);
    }
    c.globalAlpha = was * .45 * Math.min(1, I);
    c.fillStyle = look.edge;
    for (const p of ellipse(Math.round(rx * .4), Math.max(1, Math.round(ry * .4)))) if (((p.x + p.y) & 1) === 0) c.fillRect(X + p.x, Y + p.y, 1, 1);
    // Sparks running round the outer ring: a white-hot plus.
    c.globalCompositeOperation = 'lighter';
    const n = still ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n + turn * 1.7) * Math.PI * 2, sx = X + Math.round(Math.cos(a) * rx), sy = Y + Math.round(Math.sin(a) * ry);
      c.globalAlpha = was * Math.min(1, (Math.sin(a) < 0 ? .5 : .95) * I);
      c.fillStyle = look.body; c.fillRect(sx - 1, sy, 3, 1); c.fillRect(sx, sy - 1, 1, 3);
      c.fillStyle = look.core; c.fillRect(sx, sy, 1, 1);
    }
    c.globalCompositeOperation = op; c.globalAlpha = was;
  }

  /** The air layer over a figure at (x, y): the rising motes. */
  air(c: CanvasRenderingContext2D, x: number, y: number, look: AuraLook): void {
    if (!this.motes.length) return;
    const was = c.globalAlpha, op = c.globalCompositeOperation;
    c.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const k = m.age / m.life;
      // A flicker: now and then a mote blinks out for a frame.
      if (Math.sin(m.age * 31 + m.seed * 50) > .86) continue;
      const mx = Math.round(x + m.x + Math.sin(m.age * 4 + m.seed * 9) * 1.5), my = Math.round(y + m.y - m.rise * k * 1.6);
      c.globalAlpha = was * Math.min(1, look.intensity) * (k > .7 ? (1 - k) / .3 : 1);
      if (k < .12) {
        c.fillStyle = look.body; c.fillRect(mx - 1, my, 3, 1); c.fillRect(mx, my - 1, 1, 3);
        c.fillStyle = look.core; c.fillRect(mx, my, 1, 1);
      } else {
        c.fillStyle = k < .4 ? look.core : k < .7 ? look.body : look.edge;
        const big = k < .5 && m.seed > .35;
        c.fillRect(mx, my, big ? 2 : 1, big ? 2 : 1);
      }
    }
    c.globalCompositeOperation = op; c.globalAlpha = was;
  }
}

function fillEllipse(c: CanvasRenderingContext2D, X: number, Y: number, rx: number, ry: number): void {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) * (y / ry))));
    c.fillRect(X - w, Y + y, w * 2 + 1, 1);
  }
}

let tint: HTMLCanvasElement | null = null;
/**
 * The rim-glow: `src` (a figure drawn on a scratch canvas, its feet at (fx, fy)) tinted the aura's body and laid a pixel
 * out all round, fainter two out, at world (x, y) — under the figure, which the caller then draws over it.
 */
export function rimGlow(c: CanvasRenderingContext2D, src: HTMLCanvasElement, fx: number, fy: number, x: number, y: number, look: AuraLook, time: number, still: boolean): void {
  if (typeof document === 'undefined') return;
  tint ??= document.createElement('canvas');
  if (tint.width !== src.width || tint.height !== src.height) { tint.width = src.width; tint.height = src.height; }
  const t = tint.getContext('2d')!;
  t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, tint.width, tint.height);
  t.drawImage(src, 0, 0);
  t.globalCompositeOperation = 'source-in'; t.fillStyle = look.body; t.fillRect(0, 0, tint.width, tint.height);
  const X = Math.round(x - fx), Y = Math.round(y - fy), was = c.globalAlpha, op = c.globalCompositeOperation;
  const pulse = still ? 1 : .85 + .15 * Math.sin(time * 3.1);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = was * .3 * look.intensity * pulse;
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) c.drawImage(tint, X + dx, Y + dy);
  c.globalCompositeOperation = op;
  c.globalAlpha = was * Math.min(1, .85 * look.intensity) * pulse;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.drawImage(tint, X + dx, Y + dy);
  c.globalAlpha = was;
}
