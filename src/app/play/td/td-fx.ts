/**
 * td-fx.ts — the effect kit (docs/design/effects-spec.md).
 *
 * Pure pixel geometry (rings, discs, bursts, hexes) plus a few tiny painters
 * that put it on the canvas. Everything lands on whole art pixels: no strokes,
 * no arcs, no blur. Glows are stepped squares, rings are dithered dashes.
 */

/** Three tones per element (core · body · edge), spec §Rules 2. */
export interface Tones { readonly core: string; readonly body: string; readonly edge: string }

export const FX: Readonly<Record<'ember' | 'shadow' | 'life' | 'bone' | 'cold', Tones>> = {
  ember: { core: '#fff2a8', body: '#ffb347', edge: '#e2552a' },
  shadow: { core: '#f0e0ff', body: '#b06bff', edge: '#6b3aa0' },
  life: { core: '#e6ffe9', body: '#7fe08a', edge: '#3f8f4a' },
  bone: { core: '#ffffff', body: '#e8e1cf', edge: '#a89f8a' },
  cold: { core: '#ffffff', body: '#9fd8ff', edge: '#3f78b5' },
};
/** The level-up's warm light (docs/design/leveling.md §4): cream core, the lantern's glow, brass at the edge. */
export const LEVEL_UP: Tones = { core: '#fffbe8', body: '#ffd27a', edge: '#c99a3e' };
/** The white-hot spark every element shares, and the dark outline a foe's effect carries. */
export const SPARK = '#ffffff';
export const HOSTILE_EDGE = '#140c1c';

export interface Px { x: number; y: number }

const circleCache = new Map<number, Px[]>();
/**
 * The outline of a circle of radius r as whole pixels (midpoint circle), each
 * pixel once, in order round the circle from angle 0 (east), clockwise on screen.
 */
export function circlePixels(r: number): Px[] {
  const R = Math.max(1, Math.round(r));
  const hit = circleCache.get(R);
  if (hit) return hit;
  const seen = new Set<string>(), out: Px[] = [];
  const add = (x: number, y: number) => { const k = `${x},${y}`; if (!seen.has(k)) { seen.add(k); out.push({ x, y }); } };
  let x = R, y = 0, err = 1 - R;
  while (x >= y) {
    add(x, y); add(y, x); add(-y, x); add(-x, y); add(-x, -y); add(-y, -x); add(y, -x); add(x, -y);
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
  const ang = (p: Px) => { const a = Math.atan2(p.y, p.x); return a < 0 ? a + Math.PI * 2 : a; };
  out.sort((a, b) => ang(a) - ang(b));
  circleCache.set(R, out);
  return out;
}

/**
 * A dithered dash ring: dashes of `dash` pixels (every other one lit) with a gap
 * after each, `period` pixels per dash+gap; tones alternate dash by dash (0, 1).
 * `turn` (0..1) slides the pattern round the ring, so it turns in whole pixels.
 */
export function ringDash(r: number, turn: number, period = 10, dash = 6): (Px & { tone: 0 | 1 })[] {
  const ring = circlePixels(r), n = ring.length;
  const shift = Math.floor((((turn % 1) + 1) % 1) * n);
  const out: (Px & { tone: 0 | 1 })[] = [];
  for (let i = 0; i < n; i++) {
    const k = (i + shift) % n, inP = k % period;
    if (inP >= dash || inP % 2) continue;
    out.push({ x: ring[i].x, y: ring[i].y, tone: (Math.floor(k / period) % 2) as 0 | 1 });
  }
  return out;
}

/** The pixels of a ring that lie within `half` radians of angle `a` (a short arc, for a pulse). */
export function ringArc(r: number, a: number, half: number): Px[] {
  return circlePixels(r).filter(p => {
    let d = Math.atan2(p.y, p.x) - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return Math.abs(d) <= half;
  });
}

/** A filled disc as rows: for each y in -r..r, the half-width of the row (whole pixels). */
export function discRows(r: number): { y: number; w: number }[] {
  const R = Math.max(0, Math.round(r)), out: { y: number; w: number }[] = [];
  for (let y = -R; y <= R; y++) out.push({ y, w: Math.floor(Math.sqrt(R * R - y * y) + .5) });
  return out;
}

/** A tiny seeded noise (0..1) so dithers and bursts never shimmer frame to frame. */
export function fxNoise(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A burst of n pixels at time t (0..1): they fly out (eased) and then fall.
 * Seeded by `seed`, so the same burst draws the same each frame.
 */
export function burst(n: number, t: number, seed = 0, reach = 10, fall = 8): Px[] {
  const k = Math.max(0, Math.min(1, t)), out = 1 - (1 - k) * (1 - k);
  const pts: Px[] = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (fxNoise(seed, i) - .5) * .8, d = reach * (.6 + fxNoise(seed, i, 1) * .4) * out;
    pts.push({ x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d + fall * k * k) });
  }
  return pts;
}

/** Every pixel on a line from (x0,y0) to (x1,y1), ends included (Bresenham). */
export function linePixels(x0: number, y0: number, x1: number, y1: number): Px[] {
  let x = Math.round(x0), y = Math.round(y0);
  const X = Math.round(x1), Y = Math.round(y1), dx = Math.abs(X - x), dy = -Math.abs(Y - y), sx = x < X ? 1 : -1, sy = y < Y ? 1 : -1;
  let err = dx + dy;
  const out: Px[] = [];
  for (let guard = 0; guard < 4096; guard++) {
    out.push({ x, y });
    if (x === X && y === Y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

/** The n corners of a polygon (rx by ry) turned by `a`, whole pixels. */
export function polyPoints(n: number, rx: number, ry: number, a: number): Px[] {
  const out: Px[] = [];
  for (let i = 0; i < n; i++) { const t = a + i / n * Math.PI * 2; out.push({ x: Math.round(Math.cos(t) * rx), y: Math.round(Math.sin(t) * ry) }); }
  return out;
}

// ── Painters ─────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;

/** A stepped glow: three nested squares (edge, body, core), never a blur. */
export function glowSquare(c: Ctx, x: number, y: number, r: number, tones: Tones, alpha = 1): void {
  const X = Math.round(x), Y = Math.round(y), a0 = c.globalAlpha;
  const step = (s: number, col: string, a: number) => { if (s < 0) return; c.globalAlpha = a0 * alpha * a; c.fillStyle = col; c.fillRect(X - s, Y - s, s * 2 + 1, s * 2 + 1); };
  step(r, tones.edge, .3); step(Math.round(r * .62), tones.body, .65); step(Math.round(r * .25), tones.core, 1);
  c.globalAlpha = a0;
}

/**
 * A dithered dash ring in two tones at (x, y). With `inner`, each lit pixel gets a shadow pixel one step
 * toward the middle, so the ring reads two pixels deep at a glance.
 */
export function drawRing(c: Ctx, x: number, y: number, r: number, turn: number, toneA: string, toneB: string, period = 10, dash = 6, inner?: string): void {
  const X = Math.round(x), Y = Math.round(y), pts = ringDash(r, turn, period, dash), k = Math.max(0, r - 1) / Math.max(1, r);
  if (inner) { c.fillStyle = inner; for (const p of pts) c.fillRect(X + Math.round(p.x * k), Y + Math.round(p.y * k), 1, 1); }
  for (const p of pts) { c.fillStyle = p.tone ? toneB : toneA; c.fillRect(X + p.x, Y + p.y, 1, 1); }
}

/** Burst pixels at (x, y): a dark outline pixel under each for a foe's burst. */
export function drawBurst(c: Ctx, x: number, y: number, pts: readonly Px[], tones: Tones, hostile = false): void {
  const X = Math.round(x), Y = Math.round(y);
  pts.forEach((p, i) => {
    if (hostile) { c.fillStyle = HOSTILE_EDGE; c.fillRect(X + p.x - 1, Y + p.y - 1, 3, 3); }
    c.fillStyle = i % 3 === 0 ? tones.core : i % 3 === 1 ? tones.body : tones.edge;
    c.fillRect(X + p.x, Y + p.y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
  });
}

const discCache = new Map<string, HTMLCanvasElement>();
/**
 * The aura's floor tint: three stepped discs of one colour (the inner ones on top
 * of the outer), baked once per radius and colour.
 */
export function discSprite(r: number, color: string, steps: readonly number[] = [.045, .04, .035]): HTMLCanvasElement {
  const key = `${r}|${color}|${steps.join(',')}`;
  let cv = discCache.get(key);
  if (cv) return cv;
  const R = Math.round(r);
  cv = document.createElement('canvas'); cv.width = cv.height = R * 2 + 1;
  const g = cv.getContext('2d')!;
  g.fillStyle = color;
  steps.forEach((a, i) => {
    g.globalAlpha = a;
    for (const row of discRows(R * (1 - i * .3))) g.fillRect(R - row.w, R + row.y, row.w * 2 + 1, 1);
  });
  discCache.set(key, cv);
  return cv;
}

const scorchCache = new Map<number, HTMLCanvasElement>();
/** Scorched ground: a sparse dither of ash and ember pixels inside a disc, denser toward the middle. */
export function scorchSprite(r: number): HTMLCanvasElement {
  const R = Math.round(r);
  let cv = scorchCache.get(R);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = R * 2 + 1;
  const g = cv.getContext('2d')!;
  for (const row of discRows(R)) for (let x = -row.w; x <= row.w; x++) {
    if ((x + row.y) % 2) continue;
    const d = Math.hypot(x, row.y) / Math.max(1, R), n = fxNoise(x, row.y, 7);
    // Burnt in a band just inside where the ring ran, and round the feet; the middle ground between stays clearer.
    const band = Math.max(1 - Math.abs(d - .85) * 7, 1 - d * 3.5, 0);
    if (n > .05 + band * .45) continue;
    g.fillStyle = n < .04 ? FX.ember.edge : n < .2 ? '#3a1c18' : '#241012';
    g.fillRect(R + x, R + row.y, 1, 1);
  }
  scorchCache.set(R, cv);
  return cv;
}

// ── Loot (the third pass) ────────────────────────────────────────────────────

/** The rarity ladder's rungs (world.model's LootRarity, spelt out so the kit stays free of imports). */
export type LootRung = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'singular';

/**
 * The rarity ladder as canvas tones: each body is its `--cozy-loot-*` token (src/styles/tokens/_cozy.css), the core
 * a paler shine of it and the edge a deeper shade. Singular has no cozy token: it keeps the ladder's void pink
 * (docs/design/loot-and-combat.md §2).
 */
export const LOOT: Readonly<Record<LootRung, Tones>> = {
  common: { core: '#ffffff', body: '#d8d2c2', edge: '#8f8a7c' },
  uncommon: { core: '#dcffd6', body: '#6fd36a', edge: '#2f7a34' },
  rare: { core: '#ddeeff', body: '#5aa8ff', edge: '#2a5aa8' },
  epic: { core: '#f0deff', body: '#b46bff', edge: '#6b3aa0' },
  legendary: { core: '#fff0c8', body: '#ff9a3c', edge: '#b4521c' },
  mythic: { core: '#fffbe0', body: '#ffd25a', edge: '#b88a1c' },
  singular: { core: '#ffe6f6', body: '#ff6dd7', edge: '#a03a8a' },
};

/**
 * How a drop of each rung stands on the ground: its light column's height (art px; 0 = a glint only), how many
 * motes rise up it, the radius of its ground ring (0 = none) and how far its light reaches into the dark.
 */
export interface LootBeam { readonly h: number; readonly motes: number; readonly ring: number; readonly light: number }
const BEAMS: Readonly<Record<LootRung, LootBeam>> = {
  common: { h: 0, motes: 0, ring: 0, light: 16 },
  uncommon: { h: 10, motes: 0, ring: 4, light: 22 },
  rare: { h: 18, motes: 0, ring: 5, light: 28 },
  epic: { h: 28, motes: 0, ring: 6, light: 34 },
  legendary: { h: 38, motes: 3, ring: 7, light: 42 },
  mythic: { h: 44, motes: 4, ring: 7, light: 46 },
  singular: { h: 48, motes: 5, ring: 8, light: 50 },
};
export function lootBeam(rung: LootRung): LootBeam { return BEAMS[rung] ?? BEAMS.common; }

/**
 * A light column's stepped falloff, bottom up: up to three bands (y0 > y1, both ≤ 0 above the ground), each one
 * alpha lower than the band under it. `top` is the brightest band's alpha; never above 0.55 (it stands over creatures).
 */
export function beamSteps(h: number, top = .55): { y0: number; y1: number; a: number }[] {
  const H = Math.max(0, Math.round(h)), A = Math.min(.55, top);
  if (!H) return [];
  const n = H < 8 ? 1 : H < 14 ? 2 : 3, cuts = n === 1 ? [H] : n === 2 ? [Math.round(H * .55), H] : [Math.round(H * .4), Math.round(H * .72), H];
  const fall = [1, .6, .3];
  return cuts.map((c, i) => ({ y0: -(i ? cuts[i - 1] : 0), y1: -c, a: +(A * fall[i]).toFixed(3) }));
}

/** The motes rising up a column of height h at time t (seconds): one climb every 3 s, staggered, whole pixels. */
export function beamMotes(h: number, n: number, t: number, seed = 0): Px[] {
  const out: Px[] = [];
  for (let i = 0; i < n; i++) {
    const k = (((t / 3 + i / n + fxNoise(seed, i) * .2) % 1) + 1) % 1;
    out.push({ x: Math.round((fxNoise(seed, i, 2) - .5) * 4 + Math.sin(k * 6 + i) * 1), y: -Math.round(4 + k * (h - 4)) });
  }
  return out;
}

/** A ring laid on the ground: a circle squashed to half its height (the floor seen at three quarters), each pixel once. */
export function groundRing(r: number): Px[] {
  const seen = new Set<string>(), out: Px[] = [];
  for (const p of circlePixels(r)) { const q = { x: p.x, y: Math.round(p.y / 2) }, k = `${q.x},${q.y}`; if (!seen.has(k)) { seen.add(k); out.push(q); } }
  return out;
}

// ── Bosses' tells (the fourth pass) ──────────────────────────────────────────

const coneCache = new Map<string, { edge: Px[]; fill: Px[] }>();
/**
 * A cone on the ground from (0, 0) toward angle `a`, `len` long and `half` radians either side: its outline (the
 * two sides and the far arc) and a sparse dither inside it (every other pixel of every other row). Whole pixels.
 */
export function conePixels(len: number, half: number, a: number): { edge: Px[]; fill: Px[] } {
  const L = Math.max(2, Math.round(len)), key = `${L}|${half.toFixed(3)}|${a.toFixed(2)}`;
  const hit = coneCache.get(key);
  if (hit) return hit;
  const within = (x: number, y: number) => { let d = Math.atan2(y, x) - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) <= half; };
  const seen = new Set<string>(), edge: Px[] = [];
  const add = (p: Px) => { const k = `${p.x},${p.y}`; if (!seen.has(k)) { seen.add(k); edge.push(p); } };
  for (const s of [-1, 1]) linePixels(0, 0, Math.cos(a + s * half) * L, Math.sin(a + s * half) * L).forEach(add);
  ringArc(L, a, half).forEach(add);
  const fill: Px[] = [];
  for (let j = 0, y = -L; y <= L; y += 2, j++) for (let x = -L + (j % 2); x <= L; x += 2) {
    if ((x || y) && x * x + y * y < (L - 1) * (L - 1) && within(x, y) && !seen.has(`${x},${y}`)) fill.push({ x, y });
  }
  if (coneCache.size > 24) coneCache.clear();
  const out = { edge, fill };
  coneCache.set(key, out);
  return out;
}
