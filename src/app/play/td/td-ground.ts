/**
 * td-ground.ts — the rich ground (the art style upgrade, owner 2026-10-26: "dense, textured grass … worn dirt with
 * ragged, grass-overgrown edges"; docs/handoff/art-style.md).
 *
 * Grass and dirt are painted from two seamless 128-px textures of RAMP INDICES (not colours), sampled at the tile's
 * world pixel, so the clumps run across tile seams with no grid showing. A slow meadow noise shifts the index a step
 * lighter or darker in patches (ordered dither, never a blend), flowers and little shaded stones are scattered per tile
 * from its own hash, and a dirt tile next to grass lets the grass grow in over a ragged, noisy edge with a dark lip of
 * shade on the dirt under it. Everything is whole pixels lit from the upper left; tiles are baked once per chunk (the
 * engine's chunk cache), so none of this runs per frame.
 */
import { TILE, hash, type Ground } from './td-art';

type Ctx = CanvasRenderingContext2D;
type Rgb = readonly [number, number, number];

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Grass, darkest to lightest: the gaps between clumps, the shade, the body, the lit side, the sunlit tips. */
export const GRASS_RAMP = ['#2a5a26', '#3a7430', '#4c8c36', '#62a640', '#80c04e', '#a2d862'] as const;
/** Dirt, darkest to lightest: the shade under the grass, the ruts, the body, the worn top, the pale grit. */
export const DIRT_RAMP = ['#5e3c24', '#7c5232', '#98673d', '#ad7a47', '#c08d55', '#d4a86c'] as const;
const GRASS_RGB = GRASS_RAMP.map(hex), DIRT_RGB = DIRT_RAMP.map(hex);

const T = 128, MASK = T - 1;

/** A seamless texture of ramp indices, painted once. */
function texture(seed: number, base: number, paint: (put: (x: number, y: number, v: number) => void, get: (x: number, y: number) => number) => void): Uint8Array {
  const a = new Uint8Array(T * T).fill(base);
  paint((x, y, v) => { a[((y & MASK) * T) + (x & MASK)] = v; }, (x, y) => a[((y & MASK) * T) + (x & MASK)]);
  return a;
}

/**
 * A leafy clump of radius r at (cx, cy): its top-left lit, its lower right in shade, a dark gap under it — the
 * reference's lush clover-grass. Clumps are laid top to bottom so a lower one overlaps the one above (3/4 view).
 */
function clump(put: (x: number, y: number, v: number) => void, cx: number, cy: number, r: number, lift: number): void {
  const R = Math.ceil(r) + 1;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x + .5 - .5, y * 1.15);
    if (d > r) { if (d <= r + .9 && y > 0 && x > -r * .6) put(cx + x, cy + y, 0); continue; }
    const l = (-x - y * 1.2) / r;
    put(cx + x, cy + y, Math.max(1, Math.min(5, (l > .9 ? 5 : l > .25 ? 4 : l > -.45 ? 3 : 2) + lift)));
  }
}

let grassTex: Uint8Array | null = null, dirtTex: Uint8Array | null = null;
function grass(): Uint8Array {
  return grassTex ??= texture(11, 2, (put, get) => {
    const n = 560, pts: [number, number, number, number][] = [];
    for (let i = 0; i < n; i++) pts.push([Math.floor(hash(i, 1, 11) * T), Math.floor(hash(i, 2, 11) * T), 1.3 + hash(i, 3, 11) * 1.6, hash(i, 4, 11) < .18 ? -1 : 0]);
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r, lift] of pts) clump(put, x, y, r, lift);
    // Blades: a lit tip over its stem, poking out of the clumps.
    for (let i = 0; i < 380; i++) {
      const x = Math.floor(hash(i, 5, 11) * T), y = Math.floor(hash(i, 6, 11) * T);
      if (get(x, y) < 2) continue;
      put(x, y, 5); put(x, y + 1, 3);
      if (hash(i, 7, 11) < .5) put(x + (hash(i, 8, 11) < .5 ? -1 : 1), y + 1, 4);
    }
  });
}
function dirt(): Uint8Array {
  return dirtTex ??= texture(23, 2, (put, get) => {
    // Packed earth: soft lighter patches (the worn top), darker ruts, pebbles with a lit cap and a dark foot, grit.
    for (let i = 0; i < 90; i++) {
      const cx = Math.floor(hash(i, 1, 23) * T), cy = Math.floor(hash(i, 2, 23) * T), r = 2 + hash(i, 3, 23) * 4;
      for (let y = -6; y <= 6; y++) for (let x = -7; x <= 7; x++) if (Math.hypot(x, y * 1.4) < r && hash(cx + x, cy + y, 29) < .8) put(cx + x, cy + y, 3);
    }
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash(i, 4, 23) * T), y = Math.floor(hash(i, 5, 23) * T), len = 2 + Math.floor(hash(i, 6, 23) * 5);
      for (let k = 0; k < len; k++) put(x + k, y, 1);
    }
    for (let i = 0; i < 150; i++) {
      const x = Math.floor(hash(i, 7, 23) * T), y = Math.floor(hash(i, 8, 23) * T), big = hash(i, 9, 23) < .3;
      put(x, y, 5); put(x, y + 1, big ? 4 : 1);
      if (big) { put(x + 1, y, 4); put(x + 1, y + 1, 1); put(x, y + 2, 0); put(x + 1, y + 2, 0); } else put(x + 1, y + 1, 1);
    }
    for (let i = 0; i < 260; i++) { const x = Math.floor(hash(i, 10, 23) * T), y = Math.floor(hash(i, 11, 23) * T); put(x, y, get(x, y) >= 3 ? 4 : 1); }
  });
}

/** Smooth value noise in [0, 1] over world pixels, lattice `s` px (the meadow's light and dark patches). */
function meadow(x: number, y: number, s: number, salt: number): number {
  const gx = Math.floor(x / s), gy = Math.floor(y / s), fx = x / s - gx, fy = y / s - gy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, salt), b = hash(gx + 1, gy, salt), c = hash(gx, gy + 1, salt), d = hash(gx + 1, gy + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** A 4×4 ordered dither threshold in [0, 1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

/** The grass ramp index at a world pixel, the meadow's patches dithered in. */
function grassAt(wx: number, wy: number): number {
  let i = grass()[((wy & MASK) * T) + (wx & MASK)];
  const m = meadow(wx, wy, 72, 5) * .7 + meadow(wx, wy, 23, 6) * .3;
  const th = bayer(wx, wy);
  if (m > .62 && th < (m - .62) * 2.6 && i > 0 && i < 5) i++;
  else if (m < .36 && th < (.36 - m) * 2.6 && i > 1) i--;
  return i;
}

const GRASSY: ReadonlySet<Ground> = new Set<Ground>(['grass', 'flowers']);
/** Is this ground the rich grass (so a dirt tile beside it grows a ragged edge, and its own tufts are not drawn twice)? */
export const richGrass = (g: Ground) => GRASSY.has(g);
/** Does the rich painter own the edge between `kind` and `neighbour` (paintEdge should leave it)? */
export function richEdge(kind: Ground, neighbour: Ground): boolean { return kind === 'dirt' && GRASSY.has(neighbour); }

let scratch: ImageData | null = null;

/**
 * Paint a grass, flowers or dirt tile richly at (ox, oy); `nb(dx, dy)` reads a neighbouring tile's ground. Returns
 * false for any other ground (the old painter keeps it).
 */
export function paintRichGround(c: Ctx, kind: Ground, tx: number, ty: number, ox: number, oy: number, nb: (dx: number, dy: number) => Ground): boolean {
  if (kind !== 'grass' && kind !== 'flowers' && kind !== 'dirt') return false;
  const img = scratch && scratch.width === TILE ? scratch : (scratch = c.createImageData(TILE, TILE));
  const d = img.data, wx0 = tx * TILE, wy0 = ty * TILE;
  if (kind === 'dirt') {
    // How far into this tile the grass on each side reaches: a ragged line from its own noise, deeper at corners.
    const g = (dx: number, dy: number) => GRASSY.has(nb(dx, dy));
    const n = g(0, -1), s = g(0, 1), w = g(-1, 0), e = g(1, 0), nw = g(-1, -1), ne = g(1, -1), sw = g(-1, 1), se = g(1, 1);
    const reach = (a: number, salt: number) => 1.2 + meadow(a, salt, 5, 41) * 3.4 + (hash(a, salt, 43) < .12 ? 2 : 0);
    const dirtT = dirt();
    const idx = new Int8Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const wx = wx0 + x, wy = wy0 + y;
      let grassy = false;
      if (n && y < reach(wx, wy0)) grassy = true;
      else if (s && TILE - 1 - y < reach(wx, wy0 + TILE) - .6) grassy = true;
      else if (w && x < reach(wy, wx0 + 7)) grassy = true;
      else if (e && TILE - 1 - x < reach(wy, wx0 + TILE + 7)) grassy = true;
      else {
        // Corners: a round tuft where only the diagonal is grass.
        const cr = (cx: number, cy: number) => Math.hypot(x + .5 - cx, y + .5 - cy) < 2.2 + meadow(wx, wy, 4, 47) * 2.4;
        if ((nw && !n && !w && cr(0, 0)) || (ne && !n && !e && cr(TILE, 0)) || (sw && !s && !w && cr(0, TILE)) || (se && !s && !e && cr(TILE, TILE))) grassy = true;
      }
      idx[y * TILE + x] = grassy ? -1 - grassAt(wx, wy) : dirtT[((wy & MASK) * T) + (wx & MASK)];
    }
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const k = y * TILE + x, v = idx[k];
      let rgb: Rgb;
      if (v < 0) {
        // Grass growing in: the lowest row of a tuft is its dark foot, the top row over dirt catches the light.
        let gi = -1 - v;
        const below = y + 1 < TILE ? idx[k + TILE] : 0, above = y > 0 ? idx[k - TILE] : -1;
        if (below >= 0 && y + 1 < TILE) gi = Math.min(gi, 1);
        else if (above >= 0 && y > 0) gi = Math.max(gi, 4);
        rgb = GRASS_RGB[gi];
      } else {
        // Dirt: shade under grass (the row below a tuft, two steps; beside one, one step).
        let di = v;
        const up = y > 0 ? idx[k - TILE] : 0, up2 = y > 1 ? idx[k - 2 * TILE] : 0, left = x > 0 ? idx[k - 1] : 0, right = x + 1 < TILE ? idx[k + 1] : 0;
        if (up < 0) di = 0;
        else if (up2 < 0 || left < 0) di = Math.min(di, 1);
        else if (right < 0) di = Math.min(di, 2);
        rgb = DIRT_RGB[di];
      }
      d[k * 4] = rgb[0]; d[k * 4 + 1] = rgb[1]; d[k * 4 + 2] = rgb[2]; d[k * 4 + 3] = 255;
    }
    c.putImageData(img, ox, oy);
    // A pebble now and then on the path.
    if (hash(tx, ty, 61) < .22) stone(c, ox + 3 + Math.floor(hash(tx, ty, 62) * 9), oy + 4 + Math.floor(hash(tx, ty, 63) * 8), hash(tx, ty, 64) < .5 ? 2 : 3, true);
    return true;
  }
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const rgb = GRASS_RGB[grassAt(wx0 + x, wy0 + y)], k = (y * TILE + x) * 4;
    d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255;
  }
  c.putImageData(img, ox, oy);
  // Flowers: scattered over every meadow (thicker on a flower bed), each a tiny five-pixel bloom with its own shade.
  const blooms = kind === 'flowers' ? 3 + Math.floor(hash(tx, ty, 70) * 3) : hash(tx, ty, 71) < .3 ? 1 + (hash(tx, ty, 72) < .25 ? 1 : 0) : 0;
  for (let i = 0; i < blooms; i++) flower(c, ox + 1 + Math.floor(hash(tx, ty, 73 + i) * 13), oy + 1 + Math.floor(hash(tx, ty, 80 + i) * 12), Math.floor(hash(tx, ty, 87 + i) * FLOWERS.length));
  // Now and then a little grey stone, shaded, half in the grass.
  if (hash(tx, ty, 95) < .045) stone(c, ox + 3 + Math.floor(hash(tx, ty, 96) * 8), oy + 4 + Math.floor(hash(tx, ty, 97) * 7), hash(tx, ty, 98) < .4 ? 4 : 3, false);
  return true;
}

/** A bloom's petals (lit, shade) and heart. White, yellow, violet, blue, rose — the reference's meadow. */
const FLOWERS: readonly (readonly [string, string, string])[] = [
  ['#ffffff', '#c9c6dc', '#f2c94c'], ['#ffe066', '#d9a52a', '#fff6c8'], ['#b57ee8', '#7a4cb0', '#f3e2ff'],
  ['#7fb4ff', '#4a78c8', '#e8f2ff'], ['#ff8fb0', '#c8506e', '#fff0c8'], ['#ffffff', '#c9c6dc', '#f2c94c'],
];
function flower(c: Ctx, x: number, y: number, k: number): void {
  const [lit, shade, heart] = FLOWERS[k];
  c.fillStyle = GRASS_RAMP[0]; c.fillRect(x, y + 2, 2, 1);
  c.fillStyle = lit; c.fillRect(x, y, 1, 1); c.fillRect(x + 1, y - 1, 1, 1); c.fillRect(x - 1, y + 1, 1, 1);
  c.fillStyle = shade; c.fillRect(x + 2, y, 1, 1); c.fillRect(x + 1, y + 1, 1, 1);
  c.fillStyle = heart; c.fillRect(x + 1, y, 1, 1);
}
/** A small grey stone `w` px wide: a lit cap, a shaded body, a dark foot (and its shadow on the ground). */
function stone(c: Ctx, x: number, y: number, w: number, onDirt: boolean): void {
  const h = w >= 4 ? 3 : 2;
  c.fillStyle = onDirt ? DIRT_RAMP[0] : GRASS_RAMP[0]; c.fillRect(x, y + h, w + 1, 1);
  c.fillStyle = '#3e3a44'; c.fillRect(x, y, w, h); c.fillRect(x - 1, y + 1, 1, h - 1); c.fillRect(x + w, y + 1, 1, h - 1);
  c.fillStyle = '#7f7a86'; c.fillRect(x, y, w, h - 1);
  c.fillStyle = '#a9a4b0'; c.fillRect(x, y, w - 1, 1);
  c.fillStyle = '#d4d0da'; c.fillRect(x, y, 1, 1);
  c.fillStyle = '#5a5662'; c.fillRect(x + w - 1, y + 1, 1, h - 1);
}
