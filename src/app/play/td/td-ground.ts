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
import { SOLID_GROUND, TILE, hash, type Ground } from './td-art';
import { floorEdge, paintFloor } from './td-floors';
import { envDetail } from './td-detail';

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
export function grass(): Uint8Array {
  return grassTex ??= texture(11, 2, (put, get) => {
    // Calm (owner 2026-10-26, "the environment looks too much"): fewer, softer clumps and a few blades, not a carpet.
    const n = 300, pts: [number, number, number, number][] = [];
    for (let i = 0; i < n; i++) pts.push([Math.floor(hash(i, 1, 11) * T), Math.floor(hash(i, 2, 11) * T), 1.3 + hash(i, 3, 11) * 1.6, hash(i, 4, 11) < .18 ? -1 : 0]);
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r, lift] of pts) clump(put, x, y, r, lift);
    // Blades: a lit tip over its stem, poking out of the clumps.
    for (let i = 0; i < 110; i++) {
      const x = Math.floor(hash(i, 5, 11) * T), y = Math.floor(hash(i, 6, 11) * T);
      if (get(x, y) < 2) continue;
      put(x, y, 5); put(x, y + 1, 3);
      if (hash(i, 7, 11) < .5) put(x + (hash(i, 8, 11) < .5 ? -1 : 1), y + 1, 4);
    }
  });
}
export function dirt(): Uint8Array {
  return dirtTex ??= texture(23, 2, (put, get) => {
    // Packed earth: soft lighter patches (the worn top), darker ruts, pebbles with a lit cap and a dark foot, grit.
    for (let i = 0; i < 90; i++) {
      const cx = Math.floor(hash(i, 1, 23) * T), cy = Math.floor(hash(i, 2, 23) * T), r = 2 + hash(i, 3, 23) * 4;
      for (let y = -6; y <= 6; y++) for (let x = -7; x <= 7; x++) if (Math.hypot(x, y * 1.4) < r && hash(cx + x, cy + y, 29) < .8) put(cx + x, cy + y, 3);
    }
    for (let i = 0; i < 35; i++) {
      const x = Math.floor(hash(i, 4, 23) * T), y = Math.floor(hash(i, 5, 23) * T), len = 2 + Math.floor(hash(i, 6, 23) * 5);
      for (let k = 0; k < len; k++) put(x + k, y, 1);
    }
    for (let i = 0; i < 50; i++) {
      const x = Math.floor(hash(i, 7, 23) * T), y = Math.floor(hash(i, 8, 23) * T), big = hash(i, 9, 23) < .3;
      put(x, y, 5); put(x, y + 1, big ? 4 : 1);
      if (big) { put(x + 1, y, 4); put(x + 1, y + 1, 1); put(x, y + 2, 0); put(x + 1, y + 2, 0); } else put(x + 1, y + 1, 1);
    }
    for (let i = 0; i < 90; i++) { const x = Math.floor(hash(i, 10, 23) * T), y = Math.floor(hash(i, 11, 23) * T); put(x, y, get(x, y) >= 3 ? 4 : 1); }
  });
}

/** Smooth value noise in [0, 1] over world pixels, lattice `s` px (the meadow's light and dark patches). */
export function meadow(x: number, y: number, s: number, salt: number): number {
  const gx = Math.floor(x / s), gy = Math.floor(y / s), fx = x / s - gx, fy = y / s - gy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, salt), b = hash(gx + 1, gy, salt), c = hash(gx, gy + 1, salt), d = hash(gx + 1, gy + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** A 4×4 ordered dither threshold in [0, 1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

/**
 * The calm grass (2026-10-26): the texture's six indices folded onto four quiet tones (no near-black gaps, no
 * sunlit tips), so the meadow reads as one soft green with a gentle clump texture — close to the old flat grass.
 */
const CALM = [1, 2, 2, 3, 3, 4] as const;
/** The meadow's light and dark patches, sampled once per 4×4 block (it changes over 72 px; per pixel was the bake's cost). */
let meadowKey = NaN, meadowVal = 0;
/** The grass ramp index at a world pixel, the meadow's patches gently dithered in. */
export function grassAt(wx: number, wy: number): number {
  let i: number = CALM[grass()[((wy & MASK) * T) + (wx & MASK)]];
  const key = (wx >> 2) * 65536 + (wy >> 2);
  if (key !== meadowKey) { meadowKey = key; meadowVal = meadow(wx & ~3, wy & ~3, 72, 5); }
  const m = meadowVal, th = bayer(wx, wy);
  if (m > .68 && th < (m - .68) * 2 && i < 4) i++;
  else if (m < .3 && th < (.3 - m) * 2 && i > 1) i--;
  return i;
}

/** Moss, darkest to lightest (the Verdant Wilds' jungle floor). */
export const MOSS_RAMP = ['#14261a', '#1d3522', '#28462c', '#345a36', '#457344', '#5c8f52'] as const;
/** Peat, darkest to lightest (the Umbral Marches' bog). */
export const MIRE_RAMP = ['#16150e', '#211f15', '#2c2a1d', '#383525', '#46422e', '#585339'] as const;
/** Sand, darkest to lightest. */
export const SAND_RAMP = ['#9a7644', '#b38c54', '#c9a264', '#dcb877', '#e8ca8a', '#f4deaa'] as const;
/** A dungeon's packed floor, darkest to lightest (dark D&D, docs/world/canon.md §8: zones are dungeons). */
export const CAVE_RAMP = ['#120c0e', '#1c1416', '#271c1c', '#332523', '#40302c', '#524038'] as const;
const RGB = { grass: GRASS_RGB, moss: MOSS_RAMP.map(hex), dirt: DIRT_RGB, mire: MIRE_RAMP.map(hex), sand: SAND_RAMP.map(hex), cave: CAVE_RAMP.map(hex) } as const;

/** The overgrowing grounds and the ramp each grows in with. */
const GRASSY: ReadonlyMap<Ground, readonly Rgb[]> = new Map<Ground, readonly Rgb[]>([['grass', RGB.grass], ['flowers', RGB.grass], ['moss', RGB.moss]]);
/** The worn grounds the grass grows in over (a road, a beach, the bog), and their own ramps. */
const WORN: ReadonlyMap<Ground, readonly Rgb[]> = new Map<Ground, readonly Rgb[]>([['dirt', RGB.dirt], ['sand', RGB.sand], ['mire', RGB.mire]]);
/** Is this ground the rich grass (so a dirt tile beside it grows a ragged edge, and its own tufts are not drawn twice)? */
export const richGrass = (g: Ground) => GRASSY.has(g);
/** Does the rich painter own the edge between `kind` and `neighbour` (paintEdge should leave it)? */
export function richEdge(kind: Ground, neighbour: Ground): boolean { return envDetail() !== 'low' && ((WORN.has(kind) && GRASSY.has(neighbour)) || floorEdge(kind, neighbour)); }

let scratch: ImageData | null = null;
const put = (d: Uint8ClampedArray, k: number, rgb: Rgb) => { d[k * 4] = rgb[0]; d[k * 4 + 1] = rgb[1]; d[k * 4 + 2] = rgb[2]; d[k * 4 + 3] = 255; };

/**
 * Paint a grass, flowers, moss, dirt, sand, mire or cave tile richly at (ox, oy); `nb(dx, dy)` reads a neighbouring
 * tile's ground. Returns false for any other ground (the old painter keeps it).
 */
export function paintRichGround(c: Ctx, kind: Ground, tx: number, ty: number, ox: number, oy: number, nb: (dx: number, dy: number) => Ground, frame = 0): boolean {
  // Environment detail Low (td-detail.ts): the old flat painters, the cheapest bake.
  if (envDetail() === 'low') return false;
  // Boards, rugs, inside walls, rock faces and water (stage 4, td-floors.ts).
  if (paintFloor(c, kind, tx, ty, ox, oy, nb, frame)) return true;
  const worn = WORN.get(kind) ?? (kind === 'cave' ? RGB.cave : null), lush = GRASSY.get(kind);
  if (!worn && !lush) return false;
  const img = scratch && scratch.width === TILE ? scratch : (scratch = c.createImageData(TILE, TILE));
  const d = img.data, wx0 = tx * TILE, wy0 = ty * TILE;
  if (worn) {
    // How far into this tile the grass on each side reaches: a ragged line from its own noise, deeper at corners.
    let grassRgb: readonly Rgb[] = RGB.grass;
    const g = (dx: number, dy: number) => { const k = GRASSY.get(nb(dx, dy)); if (k) grassRgb = k; return !!k && kind !== 'cave'; };
    const n = g(0, -1), s = g(0, 1), w = g(-1, 0), e = g(1, 0), nw = g(-1, -1), ne = g(1, -1), sw = g(-1, 1), se = g(1, 1);
    // Calm road edges: a soft, gently wavering line (no spikes of grass reaching across).
    const reach = (a: number, salt: number) => 1.4 + meadow(a, salt, 7, 41) * 1.6;
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
        const cr = (cx: number, cy: number) => Math.hypot(x + .5 - cx, y + .5 - cy) < 3;
        if ((nw && !n && !w && cr(0, 0)) || (ne && !n && !e && cr(TILE, 0)) || (sw && !s && !w && cr(0, TILE)) || (se && !s && !e && cr(TILE, TILE))) grassy = true;
      }
      idx[y * TILE + x] = grassy ? -1 - grassAt(wx, wy) : dirtT[((wy & MASK) * T) + (wx & MASK)];
    }
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const k = y * TILE + x, v = idx[k];
      if (v < 0) {
        // Grass growing in: the lowest row of a tuft is its dark foot, the top row over dirt catches the light.
        let gi = -1 - v;
        const below = y + 1 < TILE ? idx[k + TILE] : 0, above = y > 0 ? idx[k - TILE] : -1;
        if (below >= 0 && y + 1 < TILE) gi = Math.min(gi, 1);
        else if (above >= 0 && y > 0) gi = Math.max(gi, 4);
        put(d, k, grassRgb[gi]);
      } else {
        // The worn ground: shade under grass (the row below a tuft, two steps; beside one, one step).
        let di = v;
        const up = y > 0 ? idx[k - TILE] : 0, up2 = y > 1 ? idx[k - 2 * TILE] : 0, left = x > 0 ? idx[k - 1] : 0, right = x + 1 < TILE ? idx[k + 1] : 0;
        if (up < 0) di = 0;
        else if (up2 < 0 || left < 0) di = Math.min(di, 1);
        else if (right < 0) di = Math.min(di, 2);
        put(d, k, worn[di]);
      }
    }
    c.putImageData(img, ox, oy);
    wornExtras(c, kind, tx, ty, ox, oy);
    // A dungeon floor under a wall: the wall's shadow falls on its first rows (stage 4, the taller faces).
    if (kind === 'cave') {
      if (SOLID_GROUND.has(nb(0, -1))) { rect(c, ox, oy, TILE, 1, 'rgba(6,3,8,.5)'); rect(c, ox, oy + 1, TILE, 2, 'rgba(6,3,8,.32)'); for (let x = 0; x < TILE; x += 2) rect(c, ox + x + (ty & 1), oy + 3, 1, 1, 'rgba(6,3,8,.25)'); }
      if (SOLID_GROUND.has(nb(-1, 0))) rect(c, ox, oy, 2, TILE, 'rgba(6,3,8,.22)');
    }
    return true;
  }
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) put(d, y * TILE + x, lush![grassAt(wx0 + x, wy0 + y)]);
  c.putImageData(img, ox, oy);
  if (kind === 'moss') {
    // The jungle floor: a fern sprig now and then, a speck of rootglass spore catching the light.
    const r = (n: number) => hash(tx, ty, n);
    if (r(61) > .72) { const x = ox + 2 + Math.floor(r(62) * 10), y = oy + 3 + Math.floor(r(63) * 9); rect(c, x, y, 1, 3, '#6eae52'); rect(c, x - 1, y, 1, 1, '#6eae52'); rect(c, x + 1, y + 1, 1, 1, '#3f8240'); rect(c, x, y + 3, 2, 1, MOSS_RAMP[0]); }
    if (r(64) > .93) { const x = ox + Math.floor(r(65) * 15), y = oy + Math.floor(r(66) * 15); rect(c, x, y, 1, 1, '#7affd0'); }
    if (r(67) < .03) stone(c, ox + 3 + Math.floor(r(68) * 8), oy + 4 + Math.floor(r(69) * 7), 3, false, MOSS_RAMP[0]);
    return true;
  }
  // Flowers: scattered over every meadow (thicker on a flower bed), each a tiny five-pixel bloom with its own shade.
  // Calm (a little less than the old world): a flower bed's tile holds one bloom about half the time; open grass only the
  // odd one.
  const blooms = kind === 'flowers' ? (hash(tx, ty, 70) < .5 ? 1 : 0) : hash(tx, ty, 71) < .02 ? 1 : 0;
  for (let i = 0; i < blooms; i++) flower(c, ox + 1 + Math.floor(hash(tx, ty, 73 + i) * 13), oy + 1 + Math.floor(hash(tx, ty, 80 + i) * 12), Math.floor(hash(tx, ty, 87 + i) * FLOWERS.length));
  // Now and then a little grey stone, shaded, half in the grass.
  if (hash(tx, ty, 95) < .012) stone(c, ox + 3 + Math.floor(hash(tx, ty, 96) * 8), oy + 4 + Math.floor(hash(tx, ty, 97) * 7), hash(tx, ty, 98) < .4 ? 4 : 3, false);
  return true;
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void { c.fillStyle = col; c.fillRect(x, y, w, h); }

/** What lies on a worn ground: a road's pebbles, a beach's shells, the bog's puddles and reeds, a dungeon's grit and bones. */
function wornExtras(c: Ctx, kind: Ground, tx: number, ty: number, ox: number, oy: number): void {
  const r = (n: number) => hash(tx, ty, n);
  const at = (a: number, b: number, span = 9) => [ox + 3 + Math.floor(r(a) * span), oy + 4 + Math.floor(r(b) * 8)] as const;
  if (kind === 'dirt') { if (r(61) < .06) { const [x, y] = at(62, 63); stone(c, x, y, r(64) < .5 ? 2 : 3, true); } return; }
  if (kind === 'sand') {
    if (r(61) < .1) { const [x, y] = at(62, 63); stone(c, x, y, 2, true, SAND_RAMP[0]); }
    if (r(65) < .08) { const [x, y] = at(66, 67); rect(c, x, y, 2, 1, '#fff4e0'); rect(c, x, y + 1, 2, 1, '#d8b8a0'); rect(c, x + 2, y + 1, 1, 1, SAND_RAMP[1]); }
    return;
  }
  if (kind === 'mire') {
    // A puddle of black water with a lit rim, a reed sprig, now and then a gloomcap's violet spore.
    if (r(61) > .7) { const x = ox + 1 + Math.floor(r(62) * 10), y = oy + 2 + Math.floor(r(63) * 11); rect(c, x, y, 4, 2, '#121a22'); rect(c, x + 1, y, 2, 1, '#2c3c4a'); rect(c, x, y + 2, 4, 1, MIRE_RAMP[4]); }
    if (r(64) > .78) { const x = ox + 2 + Math.floor(r(65) * 12), y = oy + 4 + Math.floor(r(66) * 9); rect(c, x, y, 1, 3, '#5a6450'); rect(c, x + 1, y + 1, 1, 2, '#78836a'); rect(c, x, y, 1, 1, '#b6bea4'); }
    if (r(67) > .95) rect(c, ox + Math.floor(r(68) * 15), oy + Math.floor(r(69) * 15), 1, 1, '#a48bff');
    return;
  }
  // A dungeon floor: grit, a crack running through, the odd pebble, and now and then something's old bones.
  if (r(61) < .16) { const [x, y] = at(62, 63); stone(c, x, y, r(64) < .5 ? 2 : 3, true, CAVE_RAMP[0], ['#2a2430', '#4a4352', '#5a5263', '#6b6276', '#3a3442']); }
  if (r(70) < .14) { let x = ox + 2 + Math.floor(r(71) * 10), y = oy + 2 + Math.floor(r(72) * 10); for (let i = 0; i < 5; i++) { rect(c, x, y, 1, 1, CAVE_RAMP[0]); x += r(73 + i) < .5 ? 1 : 0; y += 1; } }
  if (r(80) < .025) { const [x, y] = at(81, 82, 7); rect(c, x, y, 4, 1, '#d8d0bc'); rect(c, x, y + 1, 4, 1, '#8a8270'); rect(c, x - 1, y, 1, 2, '#e8e1cf'); rect(c, x + 4, y, 1, 2, '#e8e1cf'); }
}
/** A bloom's petals (lit, shade) and heart. White, yellow, violet, blue, rose — the reference's meadow. */
export const FLOWERS: readonly (readonly [string, string, string])[] = [
  ['#ffffff', '#c9c6dc', '#f2c94c'], ['#ffe066', '#d9a52a', '#fff6c8'], ['#b57ee8', '#7a4cb0', '#f3e2ff'],
  ['#7fb4ff', '#4a78c8', '#e8f2ff'], ['#ff8fb0', '#c8506e', '#fff0c8'], ['#ffffff', '#c9c6dc', '#f2c94c'],
];
export function flower(c: Ctx, x: number, y: number, k: number): void {
  const [lit, shade, heart] = FLOWERS[k];
  c.fillStyle = GRASS_RAMP[0]; c.fillRect(x, y + 2, 2, 1);
  c.fillStyle = lit; c.fillRect(x, y, 1, 1); c.fillRect(x + 1, y - 1, 1, 1); c.fillRect(x - 1, y + 1, 1, 1);
  c.fillStyle = shade; c.fillRect(x + 2, y, 1, 1); c.fillRect(x + 1, y + 1, 1, 1);
  c.fillStyle = heart; c.fillRect(x + 1, y, 1, 1);
}
/** A small grey stone `w` px wide: a lit cap, a shaded body, a dark foot (and its shadow on the ground). */
export function stone(c: Ctx, x: number, y: number, w: number, onDirt: boolean, under?: string, tones: readonly string[] = ['#3e3a44', '#7f7a86', '#a9a4b0', '#d4d0da', '#5a5662']): void {
  const h = w >= 4 ? 3 : 2;
  c.fillStyle = under ?? (onDirt ? DIRT_RAMP[0] : GRASS_RAMP[0]); c.fillRect(x, y + h, w + 1, 1);
  c.fillStyle = tones[0]; c.fillRect(x, y, w, h); c.fillRect(x - 1, y + 1, 1, h - 1); c.fillRect(x + w, y + 1, 1, h - 1);
  c.fillStyle = tones[1]; c.fillRect(x, y, w, h - 1);
  c.fillStyle = tones[2]; c.fillRect(x, y, w - 1, 1);
  c.fillStyle = tones[3]; c.fillRect(x, y, 1, 1);
  c.fillStyle = tones[4]; c.fillRect(x + w - 1, y + 1, 1, h - 1);
}

/**
 * The art-direction prototype's finer ground (td-artopt.ts option B, docs/handoff/artopt/): grass, flower beds and
 * worn dirt baked at HD_K pixels per world pixel — the same textures sampled at the finer pixel, so every clump, blade,
 * pebble, bloom and edge is half the size and twice as many. (ox, oy) are the tile's corner in the HD chunk's pixels.
 * Returns false for any other ground (the engine paints it at the art grid and scales it up).
 */
let hdScratch: ImageData | null = null;
export function paintRichGroundHd(c: Ctx, kind: Ground, tx: number, ty: number, ox: number, oy: number, nb: (dx: number, dy: number) => Ground, K = 2): boolean {
  if (envDetail() === 'low') return false;
  const worn = kind === 'dirt' ? RGB.dirt : null, lush = GRASSY.get(kind);
  if (!worn && (kind === 'moss' || !lush)) return false;
  const S = TILE * K, img = hdScratch && hdScratch.width === S ? hdScratch : (hdScratch = c.createImageData(S, S));
  const d = img.data, wx0 = tx * S, wy0 = ty * S;
  if (worn) {
    const g = (dx: number, dy: number) => GRASSY.has(nb(dx, dy));
    const n = g(0, -1), s = g(0, 1), w = g(-1, 0), e = g(1, 0), nw = g(-1, -1), ne = g(1, -1), sw = g(-1, 1), se = g(1, 1);
    const reach = (a: number, salt: number) => (1.4 + meadow(a / K, salt, 7, 41) * 1.6) * K;
    const dirtT = dirt(), idx = new Int8Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wx = wx0 + x, wy = wy0 + y;
      let grassy = false;
      if (n && y < reach(wx, ty * TILE)) grassy = true;
      else if (s && S - 1 - y < reach(wx, ty * TILE + TILE) - .6 * K) grassy = true;
      else if (w && x < reach(wy, tx * TILE + 7)) grassy = true;
      else if (e && S - 1 - x < reach(wy, tx * TILE + TILE + 7)) grassy = true;
      else {
        const cr = (cx: number, cy: number) => Math.hypot(x + .5 - cx, y + .5 - cy) < 3 * K;
        if ((nw && !n && !w && cr(0, 0)) || (ne && !n && !e && cr(S, 0)) || (sw && !s && !w && cr(0, S)) || (se && !s && !e && cr(S, S))) grassy = true;
      }
      idx[y * S + x] = grassy ? -1 - grassAt(wx, wy) : dirtT[((wy & MASK) * T) + (wx & MASK)];
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = y * S + x, v = idx[k];
      if (v < 0) {
        let gi = -1 - v;
        const below = y + 1 < S ? idx[k + S] : 0, above = y > 0 ? idx[k - S] : -1;
        if (below >= 0 && y + 1 < S) gi = Math.min(gi, 1);
        else if (above >= 0 && y > 0) gi = Math.max(gi, 4);
        put(d, k, RGB.grass[gi]);
      } else {
        let di = v;
        const up = y > 0 ? idx[k - S] : 0, up2 = y > 1 ? idx[k - 2 * S] : 0, up3 = y > 2 ? idx[k - 3 * S] : 0, left = x > 0 ? idx[k - 1] : 0, right = x + 1 < S ? idx[k + 1] : 0;
        if (up < 0 || up2 < 0) di = 0;
        else if (up3 < 0 || left < 0) di = Math.min(di, 1);
        else if (right < 0) di = Math.min(di, 2);
        put(d, k, worn[di]);
      }
    }
    c.putImageData(img, ox, oy);
    const r = (q: number) => hash(tx, ty, q);
    for (let i = 0; i < 2; i++) if (r(61 + i * 7) < .12) stone(c, ox + 6 + Math.floor(r(62 + i * 7) * 18), oy + 8 + Math.floor(r(63 + i * 7) * 16), r(64 + i * 7) < .5 ? 2 : 3, true);
    return true;
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(d, y * S + x, lush![grassAt(wx0 + x, wy0 + y)]);
  c.putImageData(img, ox, oy);
  // Twice the pixels, so the same calm count of blooms and stones reads as finer, not busier.
  const blooms = kind === 'flowers' ? (hash(tx, ty, 70) < .5 ? 2 : 1) : hash(tx, ty, 71) < .04 ? 1 : 0;
  for (let i = 0; i < blooms; i++) flower(c, ox + 2 + Math.floor(hash(tx, ty, 73 + i) * 27), oy + 2 + Math.floor(hash(tx, ty, 80 + i) * 26), Math.floor(hash(tx, ty, 87 + i) * FLOWERS.length));
  if (hash(tx, ty, 95) < .02) stone(c, ox + 6 + Math.floor(hash(tx, ty, 96) * 18), oy + 8 + Math.floor(hash(tx, ty, 97) * 16), hash(tx, ty, 98) < .4 ? 4 : 3, false);
  return true;
}
