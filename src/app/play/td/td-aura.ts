/**
 * td-aura.ts — the aura look (the art style upgrade, owner 2026-10-26: "look at that aura the player has and the
 * details, that's what we need"; then, the same day: "I still see a huge ugly circle around. Can we remove it, and only
 * have light auras flashing around, like the radius use effect, not a constant circle"; docs/handoff/look.md).
 * One reusable system for every aura a figure wears: the Keeper's running aura, the pack auras' bearers, gear later.
 *
 * Nothing stays on the ground. The layers, each from the same palette (`AuraLook`: core · body · edge · dark, an
 * intensity and a reach):
 * - **Rim**: the figure's own silhouette in the aura's body colour, a pixel out all round (and fainter two out), under
 *   the sprite — the soft rim-glow on the outline. Low detail: only the faint inner rim.
 * - **Air** (over the figure): light motes drifting up round the body (not from a disc on the floor), swaying,
 *   flickering from white-hot to the edge tone as they climb; now and then a brief white-hot flicker (a plus that
 *   blinks once) at the body's edge. ≤ 10 alive (effects-spec §Budget), spawned by intensity. None on Low.
 * - **Pulse**: when the aura starts, on its tick, and as a slow heartbeat, a light ring runs out from the feet to the
 *   aura's reach in 3/4 view (an ellipse), bright at its front, a fainter trail inside, fading as it goes — then
 *   nothing. Reduced motion: no pulses and no motes; only the rim.
 * All whole pixels; nothing is cached per frame but a ring's pixel list per size, and two small scratch canvases.
 */
import type { Tones } from './td-fx';

export interface AuraLook {
  /** White-hot core, body, edge: the element's three tones (effects-spec rule 2). */
  readonly core: string;
  readonly body: string;
  readonly edge: string;
  /** The darkest tone (a pack bearer's sigil shadow, Lightless). */
  readonly dark: string;
  /** 0.4 faint … 1 full … 1.4 blazing: how bright the layers are and how many motes rise. */
  readonly intensity: number;
  /** A pulse's reach in art px when the wearer gives none (its half-width; the half-height is about half: 3/4 view). */
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

interface Mote { x: number; y: number; age: number; life: number; seed: number; rise: number; spark: boolean }
interface Pulse { age: number; life: number; strength: number }

/** How long one pulse takes to run out to its reach and fade (s). */
export const AURA_PULSE_LIFE = .75;

/**
 * One light ring at `k` (0 → 1) of its run from the feet at (X, Y) out to `reach` (art px, the half-width; 3/4 view, so
 * the half-height is about half that): a bright two-tone front, a dotted trail just inside, the back half dimmer,
 * fading as it runs. Stateless: a pulse anyone can draw (the Keeper's, a pack bearer's).
 */
export function auraWave(c: CanvasRenderingContext2D, X: number, Y: number, reach: number, k: number, look: AuraLook, strength = 1): void {
  if (k <= 0 || k >= 1) return;
  const e = 1 - (1 - k) * (1 - k), rx = Math.max(3, Math.round(4 + (reach - 4) * e)), ry = Math.max(2, Math.round(rx * .48));
  const fade = (k < .15 ? k / .15 : 1) * (1 - k) * (1 - k * .3);
  const was = c.globalAlpha, op = c.globalCompositeOperation, I = Math.min(1.2, look.intensity) * strength;
  c.globalCompositeOperation = 'lighter';
  // The front: the body tone a pixel out, the white-hot core on the ring itself, every fourth pixel left dark.
  for (const p of ellipse(rx, ry)) {
    const back = p.y < 0, gap = Math.round(p.a * rx * .9) % 7 === 0;
    if (gap) continue;
    c.globalAlpha = was * Math.min(1, fade * I * (back ? .5 : .95));
    c.fillStyle = (p.x + p.y) & 1 ? look.body : look.core; c.fillRect(X + p.x, Y + p.y, 1, 1);
  }
  c.fillStyle = look.body;
  for (const p of ellipse(rx + 1, ry + 1)) { c.globalAlpha = was * Math.min(1, fade * I * (p.y < 0 ? .3 : .6)); c.fillRect(X + p.x, Y + p.y, 1, 1); }
  // The trail: a dotted ring of the edge tone two pixels behind the front.
  if (rx > 6) {
    c.fillStyle = look.edge;
    for (const p of ellipse(rx - 2, Math.max(2, ry - 1))) if (((p.x + p.y) & 1) === 0) { c.globalAlpha = was * Math.min(1, fade * I * (p.y < 0 ? .22 : .42)); c.fillRect(X + p.x, Y + p.y, 1, 1); }
  }
  c.globalCompositeOperation = op; c.globalAlpha = was;
}

/** One figure's aura: its motes and flickers, its pulses, and the clock they run by. */
export class AuraFx {
  private motes: Mote[] = [];
  private pulses: Pulse[] = [];
  private last = -1;
  private due = 0;
  private sparkDue = 0;
  /** Motes alive now (the budget's check). */
  get alive(): number { return this.motes.length; }
  /** Pulses running now. */
  get pulsing(): number { return this.pulses.length; }

  /** A pulse starts at the feet (the aura began, ticked, or beat). `strength` 1 a tick, 1.3 the start. */
  pulse(strength = 1): void {
    if (this.pulses.length >= 3) this.pulses.shift();
    this.pulses.push({ age: 0, life: AURA_PULSE_LIFE * (strength > 1 ? 1.2 : 1), strength });
  }

  /**
   * Advance to `time` (s): motes climb and die, new ones rise round a body `h` art px tall at the intensity's rate,
   * pulses run out. `still` (reduced motion): nothing moves and no pulses. `low` (Environment detail Low): no motes.
   */
  step(time: number, look: AuraLook, still: boolean, low = false, h = 44): void {
    const dt = this.last < 0 ? 0 : Math.max(0, Math.min(.1, time - this.last));
    this.last = time;
    if (still) this.pulses.length = 0;
    else { for (const p of this.pulses) p.age += dt; this.pulses = this.pulses.filter(p => p.age < p.life); }
    if (still || low || !look.motes) { this.motes.length = 0; return; }
    for (const m of this.motes) m.age += dt;
    this.motes = this.motes.filter(m => m.age < m.life);
    this.due += dt * 6 * look.intensity;
    this.sparkDue += dt * 1.6 * look.intensity;
    const w = Math.max(6, Math.round(h * .3));
    const spawn = (spark: boolean) => {
      // Round the body: either side of it more than in front, from the knees to the shoulders.
      const side = Math.random() < .5 ? -1 : 1, x = side * (w * .45 + Math.random() * w * .55), y = -(h * (.12 + Math.random() * .62));
      this.motes.push(spark
        ? { x, y, age: 0, life: .22 + Math.random() * .12, seed: Math.random(), rise: 2, spark: true }
        : { x, y, age: 0, life: 1 + Math.random() * .8, seed: Math.random(), rise: 8 + Math.random() * 10, spark: false });
    };
    while (this.due >= 1) { this.due -= 1; if (this.motes.length < 10) spawn(false); }
    while (this.sparkDue >= 1) { this.sparkDue -= 1; if (this.motes.length < 10) spawn(true); }
  }

  /** The pulses running out from feet at (x, y) to `reach` art px. */
  waves(c: CanvasRenderingContext2D, x: number, y: number, look: AuraLook, reach: number): void {
    const X = Math.round(x), Y = Math.round(y);
    for (const p of this.pulses) auraWave(c, X, Y, reach, p.age / p.life, look, p.strength);
  }

  /** The air layer over a figure with its feet at (x, y): the drifting motes and the flickers. */
  air(c: CanvasRenderingContext2D, x: number, y: number, look: AuraLook): void {
    if (!this.motes.length) return;
    const was = c.globalAlpha, op = c.globalCompositeOperation;
    c.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const k = m.age / m.life;
      if (m.spark) {
        // A flicker: a white-hot plus that blinks on and is gone.
        const mx = Math.round(x + m.x), my = Math.round(y + m.y), a = k < .3 ? 1 : (1 - k) / .7;
        c.globalAlpha = was * Math.min(1, look.intensity) * a;
        c.fillStyle = look.body; c.fillRect(mx - 1, my, 3, 1); c.fillRect(mx, my - 1, 1, 3);
        if (k < .5) { c.globalAlpha = was * .5 * a; c.fillRect(mx - 2, my, 5, 1); c.fillRect(mx, my - 2, 1, 5); }
        c.globalAlpha = was * Math.min(1, look.intensity) * a;
        c.fillStyle = look.core; c.fillRect(mx, my, 1, 1);
        continue;
      }
      // Now and then a mote blinks out for a frame.
      if (Math.sin(m.age * 31 + m.seed * 50) > .9) continue;
      const mx = Math.round(x + m.x + Math.sin(m.age * 3 + m.seed * 9) * 2), my = Math.round(y + m.y - m.rise * k);
      const a = Math.min(1, look.intensity) * (k < .15 ? k / .15 : k > .65 ? (1 - k) / .35 : 1);
      const big = k < .55 && m.seed > .4;
      // A big mote carries a faint halo of its body tone a pixel round it.
      if (big) { c.globalAlpha = was * .35 * a; c.fillStyle = look.body; c.fillRect(mx - 1, my - 1, 4, 4); }
      c.globalAlpha = was * a;
      c.fillStyle = k < .35 ? look.core : k < .7 ? look.body : look.edge;
      c.fillRect(mx, my, big ? 2 : 1, big ? 2 : 1);
    }
    c.globalCompositeOperation = op; c.globalAlpha = was;
  }
}

let tint: HTMLCanvasElement | null = null;
/**
 * The rim-glow: `src` (a figure drawn on a scratch canvas, its feet at (fx, fy)) tinted the aura's body and laid a pixel
 * out all round, fainter two out, at world (x, y) — under the figure, which the caller then draws over it.
 */
export function rimGlow(c: CanvasRenderingContext2D, src: HTMLCanvasElement, fx: number, fy: number, x: number, y: number, look: AuraLook, time: number, still: boolean, low = false): void {
  if (typeof document === 'undefined') return;
  tint ??= document.createElement('canvas');
  if (tint.width !== src.width || tint.height !== src.height) { tint.width = src.width; tint.height = src.height; }
  const t = tint.getContext('2d')!;
  t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, tint.width, tint.height);
  t.drawImage(src, 0, 0);
  t.globalCompositeOperation = 'source-in'; t.fillStyle = look.body; t.fillRect(0, 0, tint.width, tint.height);
  const X = Math.round(x - fx), Y = Math.round(y - fy), was = c.globalAlpha, op = c.globalCompositeOperation;
  const pulse = still ? 1 : .85 + .15 * Math.sin(time * 3.1);
  // Low detail: only a faint one-pixel rim, no outer glow.
  if (!low) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = was * .3 * look.intensity * pulse;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) c.drawImage(tint, X + dx, Y + dy);
    c.globalCompositeOperation = op;
  }
  c.globalAlpha = was * Math.min(1, (low ? .5 : .85) * look.intensity) * pulse;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.drawImage(tint, X + dx, Y + dy);
  c.globalAlpha = was;
}
