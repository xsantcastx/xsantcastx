/**
 * title-art.ts — the title screen's pixel painting: an eclipse over the hills and a lit cottage below it.
 * Its night (sky, stars, eclipse, hills) and cottage are shared with the campfire character select (camp-art.ts).
 *
 * "Dark outside, warm inside" (design-bible §1.1) as one picture: a black sun with a gold corona in a night sky, the
 * hills cold and violet, and one small house with a lit window and a hearth fire. Painted at a low resolution (about
 * 120 px tall, as wide as the screen's aspect) and scaled up whole pixels by CSS, so it is real pixel art at any size.
 * Motion is small and slow: stars twinkle, the corona breathes, chimney smoke drifts, the fire flickers, a few motes
 * float. Reduced motion paints one still frame (`time` 0) and nothing moves.
 */

const SKY = ['#0b0718', '#120a24', '#1a0f30', '#24133a', '#321a44', '#45214a'];
const HILL_FAR = '#2a1838';
const HILL_NEAR = '#170d22';
export const GROUND = '#0e0816';
const CORONA = ['#ffe6a6', '#ffd27a', '#f0a64a', '#c86a32', '#7a3a3a'];
const MOON = '#07040d';
const MOON_RIM = '#8f78c8';
const WALL = '#2b1a14';
const ROOF = '#3d2318';
const WINDOW = ['#ffd27a', '#f6b04f'];
export const FIRE = ['#fff1b8', '#ffd27a', '#f0883a', '#c4472c'];
const SMOKE = '#5a4a66';
export const MOTE = '#ffe2a0';

/** A small deterministic generator, so the hills and stars are the same every visit. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise over x (for hill lines). */
function ridge(x: number, seed: number, scale: number): number {
  const r = rng(seed);
  const pts = Array.from({ length: 64 }, () => r());
  const f = x / scale, i = Math.floor(f), t = f - i;
  const a = pts[((i % 64) + 64) % 64], b = pts[(((i + 1) % 64) + 64) % 64];
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

/** The painting's pixel size for a screen of `width`×`height` CSS px: ~120 px tall, the screen's aspect. */
export function titleArtSize(width: number, height: number): { w: number; h: number } {
  const h = 120;
  const aspect = width > 0 && height > 0 ? width / height : 16 / 9;
  return { w: Math.max(64, Math.min(320, Math.round(h * aspect))), h };
}

/** Where the night's pieces sit: the horizon row, and the eclipse's centre and radius (art px). */
export interface NightFrame { horizon: number; sunX: number; sunY: number; sunR: number }

type Px = (x: number, y: number, col: string, ww?: number, hh?: number) => void;
const pen = (c: CanvasRenderingContext2D): Px => (x, y, col, ww = 1, hh = 1) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), ww, hh); };

/**
 * The night above the hearth, shared by the title and the campfire (lobby/camp-art.ts): sky bands, stars, the eclipse,
 * the far and near hills with their pines, and the dark ground below them.
 */
export function paintNight(c: CanvasRenderingContext2D, w: number, h: number, time: number, f: NightFrame): void {
  const px = pen(c);
  c.imageSmoothingEnabled = false;
  const horizon = f.horizon;

  // Sky: flat bands, dithered where they meet (a checker of the two colours over two rows).
  const band = horizon / SKY.length;
  for (let i = 0; i < SKY.length; i++) {
    const y0 = Math.round(i * band), y1 = Math.round((i + 1) * band);
    c.fillStyle = SKY[i];
    c.fillRect(0, y0, w, y1 - y0);
    if (i > 0) for (let x = 0; x < w; x++) for (let d = 0; d < 2; d++) if ((x + d) % 2 === 0) px(x, y0 + d - 1, SKY[i]);
  }

  // Stars: fixed places; about a third twinkle on their own slow beat.
  const stars = rng(7);
  const count = Math.round((w * horizon) / 150);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(stars() * w), y = Math.floor(stars() * horizon * 0.9);
    const phase = stars() * 6.28, twinkles = stars() < 0.35, bright = stars() < 0.12;
    const on = !twinkles || Math.sin(time * 1.3 + phase) > -0.4;
    if (!on) continue;
    px(x, y, bright ? '#fff4d6' : y < horizon * 0.4 ? '#9d8cc8' : '#c8b8e8');
    if (bright && Math.sin(time * 0.9 + phase) > 0.6) { px(x - 1, y, '#6d5c98'); px(x + 1, y, '#6d5c98'); px(x, y - 1, '#6d5c98'); px(x, y + 1, '#6d5c98'); }
  }

  // The eclipse: a corona of rings (breathing a little), long rays, the black moon, its lit rim and one bright bead.
  const cx = f.sunX, cy = f.sunY, r = f.sunR;
  const breathe = Math.sin(time * 0.6) * 0.6;
  for (let y = -r * 3; y <= r * 3; y++) {
    for (let x = -r * 3; x <= r * 3; x++) {
      const d = Math.hypot(x, y);
      if (d <= r) continue;
      const angle = Math.atan2(y, x);
      const rays = 0.5 + 0.5 * Math.sin(angle * 9 + time * 0.15) * Math.sin(angle * 4 - time * 0.1);
      const reach = r * (1.35 + 0.9 * rays) + breathe;
      if (d > reach) continue;
      const k = (d - r) / (reach - r);
      const idx = Math.min(CORONA.length - 1, Math.floor(k * CORONA.length));
      // The outer rings are dithered so the glow fades in pixels, not in alpha.
      if (idx >= 3 && (x + y) % 2 !== 0) continue;
      if (idx === 4 && (x * 3 + y) % 4 !== 0) continue;
      px(cx + x, cy + y, CORONA[idx]);
    }
  }
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d <= r) px(cx + x, cy + y, d > r - 1 && x < 0 && y < 0 ? MOON_RIM : MOON);
  }
  const bead = 0.5 + 0.5 * Math.sin(time * 1.1);
  const bx = cx + Math.round(r * 0.72), by = cy + Math.round(r * 0.72);
  px(bx, by, '#fffbe8');
  if (bead > 0.4) { px(bx + 1, by, '#ffe6a6'); px(bx, by + 1, '#ffe6a6'); px(bx - 1, by, '#ffd27a'); px(bx, by - 1, '#ffd27a'); }

  // Hills: a far violet range and a near dark one, over the ground.
  for (let x = 0; x < w; x++) {
    const far = horizon - 6 - Math.round(ridge(x, 11, 18) * 16 + ridge(x, 12, 7) * 4);
    c.fillStyle = HILL_FAR;
    c.fillRect(x, far, 1, h - far);
  }
  for (let x = 0; x < w; x++) {
    const near = horizon + 2 - Math.round(ridge(x, 21, 26) * 10 + ridge(x, 22, 9) * 3);
    c.fillStyle = HILL_NEAR;
    c.fillRect(x, near, 1, h - near);
  }
  c.fillStyle = GROUND;
  c.fillRect(0, horizon + 10, w, h - horizon - 10);

  // Pines along the near ridge (dark triangles).
  const pines = rng(31);
  for (let i = 0; i < Math.round(w / 9); i++) {
    const x = Math.floor(pines() * w), tall = 5 + Math.floor(pines() * 6);
    const base = horizon + 4 - Math.round(ridge(x, 21, 26) * 10 + ridge(x, 22, 9) * 3);
    for (let k = 0; k < tall; k++) { const half = Math.floor((k / tall) * 3); c.fillStyle = HILL_NEAR; c.fillRect(x - half, base - tall + k, half * 2 + 1, 1); }
  }
}

/** The near ridge's top row at `x` (art px), for anything that sits on the hills. */
export function nearRidge(x: number, horizon: number): number {
  return horizon + 2 - Math.round(ridge(x, 21, 26) * 10 + ridge(x, 22, 9) * 3);
}

/**
 * The lit cottage with its top-left wall corner at (`hx`, `hy`): its warm light on the ground, chimney smoke, and
 * (unless `hearth` is false) the small hearth fire by the door with its motes.
 */
export function paintCottage(c: CanvasRenderingContext2D, hx: number, hy: number, time: number, hearth = true): void {
  const px = pen(c);
  const glow = 0.85 + 0.15 * Math.sin(time * 7.3) * Math.sin(time * 3.1);
  // The warm light on the ground (on the title, the hearth's; up on the campfire's ridge, only the window's spill).
  const reach = hearth ? 15 : 6, core = hearth ? 6 : 3;
  for (let y = -16; y <= 16; y++) for (let x = -34; x <= 34; x++) {
    const d = Math.hypot(x / 2.2, y);
    if (d > reach * glow) continue;
    if ((x + y) % 2 !== 0 && d > core * 1.5) continue;
    px(hx + (hearth ? 16 : 6) + x, hy + (hearth ? 14 : 11) + y, d < core ? '#4a2a1c' : '#2c1820');
  }
  c.fillStyle = WALL; c.fillRect(hx, hy, 20, 12);
  for (let k = 0; k < 8; k++) { c.fillStyle = ROOF; c.fillRect(hx - 2 + k, hy - 1 - k, 24 - k * 2, 1); }
  c.fillStyle = ROOF; c.fillRect(hx + 14, hy - 10, 3, 6);
  c.fillStyle = WINDOW[0]; c.fillRect(hx + 4, hy + 4, 4, 3);
  c.fillStyle = WINDOW[1]; c.fillRect(hx + 4, hy + 6, 4, 1);
  c.fillStyle = '#1a0f0a'; c.fillRect(hx + 12, hy + 5, 4, 7);
  c.fillStyle = WINDOW[1]; c.fillRect(hx + 15, hy + 8, 1, 1);

  // Chimney smoke: puffs rising and drifting right, fading in pixels.
  for (let i = 0; i < 5; i++) {
    const age = ((time * 0.35 + i / 5) % 1);
    const sx = hx + 15 + Math.round(age * 8 + Math.sin(age * 6 + i) * 1.5), sy = hy - 12 - Math.round(age * 16);
    if (age > 0.85 && (i % 2)) continue;
    px(sx, sy, SMOKE, age < 0.5 ? 2 : 1, 1);
  }
  if (!hearth) return;

  // The hearth fire in front of the door: four flame pixels flickering, stones either side.
  const fx = hx + 28, fy = hy + 10;
  px(fx - 2, fy + 1, '#3a2c2c'); px(fx + 3, fy + 1, '#3a2c2c');
  const flick = (n: number) => Math.sin(time * 9 + n) * Math.sin(time * 4.7 + n * 2);
  px(fx, fy, FIRE[2], 2, 1);
  px(fx, fy - 1, flick(1) > -0.3 ? FIRE[1] : FIRE[2], 2, 1);
  if (flick(2) > -0.2) px(fx + (flick(3) > 0 ? 1 : 0), fy - 2, FIRE[0]);
  if (flick(4) > 0.3) px(fx, fy - 3, FIRE[3]);

  // Motes: a few warm sparks drifting up from the fire.
  for (let i = 0; i < 4; i++) {
    const age = ((time * 0.22 + i * 0.27) % 1);
    if (age > 0.9) continue;
    px(fx + Math.round(Math.sin(age * 9 + i * 2) * 4), fy - 4 - Math.round(age * 30), MOTE);
  }
}

/** Paint one frame at `time` seconds (0 for the still frame). */
export function paintTitleArt(c: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const horizon = Math.round(h * 0.72);
  paintNight(c, w, h, time, {
    horizon, sunX: Math.round(w / 2), sunY: Math.round(h * 0.22), sunR: Math.max(7, Math.round(Math.min(w * 0.16, h * 0.085))),
  });
  // The cottage, below and left of the eclipse, and its warm light on the ground.
  paintCottage(c, Math.round(w * 0.5) - 22, h - 22, time);
}
