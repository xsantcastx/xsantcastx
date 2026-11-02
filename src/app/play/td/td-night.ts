/**
 * td-night.ts — how dark the top-down world is, and how a light opens it (design-bible §5.3, effects-spec "The night").
 *
 * "Dark outside, warm inside": after dusk the open world sinks under a deep blue-violet pass (never pure black), and
 * every light is a hole in it with a stepped pixel falloff (a clear core, two steps, a dithered rim — no blurs). Lamps,
 * hearths and windows also lay a warm wash, so a town at midnight is a cozy island. An eclipse is darker and more
 * violet than any night; a dungeon floor is always dark, whatever the hour.
 *
 *  | Sky                  | Tone       | Full | Softer |
 *  |----------------------|------------|------|--------|
 *  | Night (darkness 1)   | `#100e2c`  | 0.86 | 0.72   |
 *  | Eclipse (depth 1)    | `#220c3a`  | 0.93 | 0.80   |
 *  | Dungeon floor        | `#0a081a`  | 0.90 | 0.78   |
 *
 * Outdoors the pass's opacity is `tone(e) × max(darkness, e)` (darkness = 1 − the sky's light, already eased through
 * dawn and dusk by the world clock; e = the eclipse's depth), so dusk and dawn are a smooth slide and noon is clear.
 * The setting ("Night darkness", Menu → Sound, saved with the Hush) picks the column.
 *
 * Pure: numbers and an RGBA scan. td-engine.ts draws it (drawLight, drawNightEyes).
 */
import type { NightSetting } from '../../shared/sound/sound-settings.model';
import { daylight, sunGlow } from '../../shared/world-clock/world-clock.model';

export type { NightSetting };

export interface NightTone { rgb: readonly [number, number, number]; full: number; softer: number }

export const NIGHT_TONES: Readonly<Record<'night' | 'eclipse' | 'dungeon', NightTone>> = {
  night: { rgb: [16, 14, 44], full: .86, softer: .72 },
  eclipse: { rgb: [34, 12, 58], full: .93, softer: .8 },
  dungeon: { rgb: [10, 8, 26], full: .9, softer: .78 },
};

/** The pass the engine lays this frame: its colour, its opacity, and how strongly the warm lights glow (0–1). */
export interface NightPass { rgb: readonly [number, number, number]; alpha: number; warm: number; amount: number }

/** The night pass for a sky. `darkness` 0 day … 1 night; `eclipse` 0 … 1 depth; `dungeon` a dark floor. */
export function nightPass(o: { darkness: number; eclipse: number; dungeon: boolean; setting: NightSetting }): NightPass {
  const pick = (t: NightTone) => o.setting === 'softer' ? t.softer : t.full;
  if (o.dungeon) { const t = NIGHT_TONES.dungeon; return { rgb: t.rgb, alpha: pick(t), warm: 1, amount: 1 }; }
  const e = clamp01(o.eclipse), amount = Math.max(clamp01(o.darkness), e);
  const n = NIGHT_TONES.night, x = NIGHT_TONES.eclipse;
  const rgb = [0, 1, 2].map(i => Math.round(n.rgb[i] + (x.rgb[i] - n.rgb[i]) * e)) as unknown as readonly [number, number, number];
  const alpha = (pick(n) + (pick(x) - pick(n)) * e) * amount;
  return { rgb, alpha: round3(alpha), warm: round3(amount), amount: round3(amount) };
}

/** A pinned hour's (`?hour=`) darkness and dusk glow: the world clock's own curve, so a screenshot matches the clock. */
export function skyOfHour(h: number): { darkness: number; glow: number } {
  const minute = Math.round((((h % 24) + 24) % 24) * 60);
  return { darkness: round3(1 - daylight(minute)), glow: round3(sunGlow(minute)) };
}

/**
 * A light's stepped falloff: how much of the dark it opens at a fraction `f` of its radius (0 centre … 1 rim). A clear
 * core, two steps, then a dithered rim (`odd` = the checker's other cell). Three steps, as effects-spec rule 1 asks.
 */
export const LIGHT_STEPS: readonly (readonly [number, number])[] = [[.45, 1], [.65, .8], [.83, .5]];
export const LIGHT_RIM: readonly [number, number] = [.3, .08];
export function lightOpen(f: number, odd = false): number {
  if (f > 1) return 0;
  for (const [edge, a] of LIGHT_STEPS) if (f <= edge) return a;
  return odd ? LIGHT_RIM[1] : LIGHT_RIM[0];
}

/** A 4×4 ordered-dither (Bayer) threshold at buffer pixel (x, y), in (0, 1). */
export function bayer4(x: number, y: number): number { return (BAYER4[((y & 3) << 2) | (x & 3)] + .5) / 16; }
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Pick one of the stepped `levels` (descending) for a continuous value `v`, ordered-dithered by threshold `t`. */
function stepDither(v: number, levels: readonly number[], t: number): number {
  for (let i = 0; i < levels.length - 1; i++) {
    const a = levels[i], b = levels[i + 1];
    if (v <= a && v >= b) return t < (v - b) / Math.max(1e-6, a - b) ? a : b;
  }
  return v > levels[0] ? levels[0] : levels[levels.length - 1];
}
/** A curve through (f, v) points, linear between them. */
function curve(pts: readonly (readonly [number, number])[], f: number): number {
  for (let i = 1; i < pts.length; i++) if (f <= pts[i][0]) { const [f0, v0] = pts[i - 1], [f1, v1] = pts[i]; return v0 + (v1 - v0) * (f - f0) / Math.max(1e-6, f1 - f0); }
  return pts[pts.length - 1][1];
}
const ISO_OPEN: readonly (readonly [number, number])[] = [[0, 1], [.41, 1], [.49, .8], [.61, .8], [.69, .5], [.79, .5], [.87, .3], [.94, .08], [1, 0]];
const OPEN_LEVELS = [1, .8, .5, LIGHT_RIM[0], LIGHT_RIM[1], 0];
/**
 * The isometric light map's falloff (one buffer pixel an iso pixel, td-engine drawLight): the same clear core, two steps
 * and rim as `lightOpen`, but each step's edge and the rim's fade are a fine ordered dither (`t`, bayer4) instead of a
 * hard band edge and a coarse checker — the dungeon's walls fade into the dark a pixel at a time.
 */
/** The same falloff unquantized (the half-resolution iso light map: its 2-px cells carry the steps without bands). */
export function isoLightSmooth(f: number): number { return f > 1 ? 0 : curve(ISO_OPEN, f); }
export function isoLightOpen(f: number, t: number): number { return f > 1 ? 0 : stepDither(curve(ISO_OPEN, f), OPEN_LEVELS, t); }
const ISO_WARM: readonly (readonly [number, number])[] = [[0, .26], [.31, .26], [.39, .17], [.56, .17], [.64, .09], [.8, .09], [.9, 0], [1, 0]];
const WARM_LEVELS = [.26, .17, .09, 0];
/** The warm wash's bands on the isometric light map, their edges ordered-dithered (`t`, bayer4) like isoLightOpen. */
export function isoWarmAt(f: number, t: number): number { return f > 1 ? 0 : stepDither(curve(ISO_WARM, f), WARM_LEVELS, t); }

/** The warm wash a lamp, hearth or window lays inside its light (alpha by band; the colour is the Hearth palette). */
export const WARM_STEPS: readonly (readonly [number, number])[] = [[.35, .26], [.6, .17], [.85, .09]];
export function warmAt(f: number): number {
  for (const [edge, a] of WARM_STEPS) if (f <= edge) return a;
  return 0;
}

/** The light radii (art px) the darkness pass opens: the Keeper's own is a modest circle; Glim's a little wider. */
export const KEEPER_LIGHT = 56;
export const GLIM_OPEN_LIGHT = 64;

export interface NightLight { x: number; y: number; r: number; w?: number }

/** How lit a point is (0 dark … 1 in a light's clear core), by the same steps the pass draws. */
export function litAt(lights: readonly NightLight[], x: number, y: number): number {
  let best = 0;
  for (const l of lights) {
    const d = Math.hypot(x - l.x, y - l.y);
    if (d >= l.r) continue;
    const v = lightOpen(d / l.r) * (l.w ?? 1);
    if (v > best) best = v;
  }
  return best;
}

/**
 * How strongly a creature at a point shows as a silhouette with glowing eyes: none by day or in a light, full in the
 * deep dark. `alpha` is the pass's opacity.
 */
export function eyeGlow(alpha: number, lit: number): number {
  const dark = clamp01((alpha - .3) / .4);
  return round3(dark * clamp01(1 - lit * 1.4));
}

export interface EyeSpot { x: number; y: number; rgb: readonly [number, number, number] }

/**
 * Where a creature's eyes are in one frame (RGBA, `w`×`h`, facing right): the brightest pixels in the upper part of
 * the body that stand out from their neighbours (a lit eye in a dark socket), one or two of them side by side. A frame
 * with no such pixel gets a guess: two pixels down from the top of the head's front.
 */
export function findEyes(data: Uint8ClampedArray, w: number, h: number): EyeSpot[] {
  const at = (x: number, y: number) => (y * w + x) * 4;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[at(x, y) + 3] > 160;
  const bright = (x: number, y: number) => { const i = at(x, y); return Math.max(data[i], data[i + 1], data[i + 2]); };
  const cands: { x: number; y: number; s: number }[] = [];
  const top = Math.max(1, Math.ceil(h * .7));
  for (let y = 0; y < top; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue;
    const b = bright(x, y);
    if (b < 150) continue;
    let sum = 0, n = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      const nx = x + dx, ny = y + dy;
      sum += solid(nx, ny) ? bright(nx, ny) : 0; n++;
    }
    const s = b - sum / n;
    if (s >= 55) cands.push({ x, y, s });
  }
  cands.sort((a, b) => b.s - a.s || a.y - b.y || b.x - a.x);
  const rgbAt = (x: number, y: number) => { const i = at(x, y); return [data[i], data[i + 1], data[i + 2]] as const; };
  if (cands.length) {
    const a = cands[0];
    const b = cands.find(c => c !== a && Math.abs(c.y - a.y) <= 2 && Math.abs(c.x - a.x) >= 2 && Math.abs(c.x - a.x) <= 7 && c.s >= a.s * .6);
    return (b ? [a, b].sort((p, q) => p.x - q.x) : [a]).map(p => ({ x: p.x, y: p.y, rgb: rgbAt(p.x, p.y) }));
  }
  // No lit eye painted: the top of the front third of the body, two pixels in.
  for (let y = 0; y < h; y++) for (let x = w - 1; x >= Math.floor(w * .6); x--) {
    if (solid(x, y)) return [{ x: Math.max(0, x - 1), y: Math.min(h - 1, y + 2), rgb: [255, 196, 120] }];
  }
  return [];
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)); }
function round3(n: number): number { return Math.round(n * 1000) / 1000; }
