/**
 * td-terrain.ts — organic terrain for the art-direction prototype (td-artopt.ts option B and iso; owner 2026-10-26:
 * "lots of borders like squared … sand and water ends"). Grass, flower beds, moss, dirt roads, sand, bog, cobble and
 * water meet along curved, noisy, blended edges with round corners: never a square tile seam.
 *
 * How: every pixel weighs the four nearest tile centres (smoothstep bilinear, so a lone tile becomes a round blob and
 * every corner rounds off), each terrain's weight nudged by its own low-frequency noise (so the line wanders), and the
 * heaviest terrain wins. How close the runner-up came (the margin) is the distance to the edge, and the edge dresses
 * itself from it: a dark lip where grass meets a road, the road shaded under it, wet sand and two lines of foam that lap
 * over the water frames along every shore, shallows paling to the deep. Baked into the ground chunks like the rest of the
 * ground (HD: two pixels a world pixel), so none of it runs per frame.
 */
import { paintGround, hash, TILE, type Ground } from './td-art';
import { DIRT_RAMP, GRASS_RAMP, MIRE_RAMP, MOSS_RAMP, SAND_RAMP, FLOWERS, dirt, flower, grassAt, meadow, stone } from './td-ground';
import { envDetail } from './td-detail';

type Ctx = CanvasRenderingContext2D;
type Rgb = readonly [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Terrain classes: 0 grass · 1 dirt · 2 sand · 3 water · 4 moss · 5 mire · 6 cobble. */
const CLASS: ReadonlyMap<Ground, number> = new Map<Ground, number>([['grass', 0], ['flowers', 0], ['dirt', 1], ['sand', 2], ['water', 3], ['moss', 4], ['mire', 5], ['cobble', 6]]);
export const organic = (g: Ground): boolean => CLASS.has(g);
const N = 7;
/** Each class's weight is nudged by (noise A − ½) · a + (noise B − ½) · b: different classes wander differently. */
const NA = [.4, -.4, -.64, 1.2, .4, -.32, .16], NB = [-.96, .88, .96, 0, -.96, .8, .64];

const GRASS = GRASS_RAMP.map(hex), DIRT = DIRT_RAMP.map(hex), SAND = SAND_RAMP.map(hex), MOSS = MOSS_RAMP.map(hex), MIRE = MIRE_RAMP.map(hex);
/** Water, deep → shallow, then the foam's two tones. */
const WATER = ['#1a3458', '#21466c', '#285a80', '#317092', '#4a92aa', '#78bcc4'].map(hex);
const FOAM = hex('#eef8f2'), FOAM2 = hex('#b8e2e0'), WAVE = hex('#5aa2ba');
const B2 = [.125, .625, .875, .375];

const smooth = (f: number) => f * f * (3 - 2 * f);
const cobbleCache = new Map<string, Uint8ClampedArray>();
/** The cobble painter's own pixels for a tile (it has its own setts; sampled, then given an organic edge). */
function cobbleAt(tx: number, ty: number): Uint8ClampedArray {
  const key = `${tx},${ty}`;
  let d = cobbleCache.get(key);
  if (d) return d;
  const el = document.createElement('canvas'); el.width = TILE; el.height = TILE;
  const g = el.getContext('2d', { willReadFrequently: true })!;
  paintGround(g, 'cobble', tx, ty, 0, 0, 0);
  d = g.getImageData(0, 0, TILE, TILE).data;
  if (cobbleCache.size > 400) cobbleCache.delete(cobbleCache.keys().next().value!);
  cobbleCache.set(key, d);
  return d;
}

let scratch: ImageData | null = null;

/**
 * Paint tile (tx, ty) at (ox, oy) on `c` at K pixels a world pixel, organically; `at(dx, dy)` reads a neighbour's ground.
 * False when this tile is not organic terrain (the caller's painters keep it) or on Environment detail Low.
 */
export function paintFieldTile(c: Ctx, kind: Ground, tx: number, ty: number, ox: number, oy: number, at: (dx: number, dy: number) => Ground, frame = 0, K = 2): boolean {
  if (envDetail() === 'low') return false;
  const own = CLASS.get(kind);
  if (own === undefined) return false;
  // The 3×3 neighbourhood's classes (a man-made neighbour counts as this tile's own: its edge stays the painter's).
  const nb = new Int8Array(9);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nb[(dy + 1) * 3 + dx + 1] = CLASS.get(at(dx, dy)) ?? own;
  const S = TILE * K, img = scratch && scratch.width === S ? scratch : (scratch = c.createImageData(S, S)), px = img.data;
  const sc = new Float32Array(N), dirtT = dirt(), wx0 = tx * TILE, wy0 = ty * TILE;
  const ph = frame * Math.PI / 2;
  // Water's depth: the distance to the nearest land tile within two tiles (smooth across tiles, no stepped blocks).
  const land: [number, number][] = [];
  if (own === 3) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const k = CLASS.get(at(dx, dy)); if (k !== 3) land.push([dx, dy]); }
  const landDist = (lx: number, ly: number): number => {
    let m = 99;
    for (const [dx, dy] of land) {
      const rx = Math.max(dx * TILE - lx, 0, lx - (dx + 1) * TILE), ry = Math.max(dy * TILE - ly, 0, ly - (dy + 1) * TILE), d = Math.hypot(rx, ry);
      if (d < m) m = d;
    }
    return m;
  };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const lx = (i + .5) / K, ly = (j + .5) / K, x = wx0 + lx, y = wy0 + ly;
    const lu = lx / TILE - .5, lv = ly / TILE - .5;
    const ax = lu < 0 ? -1 : 0, ay = lv < 0 ? -1 : 0, fu = smooth(lu - ax), fv = smooth(lv - ay);
    const c00 = nb[(ay + 1) * 3 + ax + 1], c10 = nb[(ay + 1) * 3 + ax + 2], c01 = nb[(ay + 2) * 3 + ax + 1], c11 = nb[(ay + 2) * 3 + ax + 2];
    let win = own, second = own, margin = 1;
    if (c00 !== c10 || c00 !== c01 || c00 !== c11) {
      sc.fill(-9);
      const add = (k: number, w: number) => { sc[k] = (sc[k] < -1 ? 0 : sc[k]) + w; };
      add(c00, (1 - fu) * (1 - fv)); add(c10, fu * (1 - fv)); add(c01, (1 - fu) * fv); add(c11, fu * fv);
      const na = meadow(x, y, 6, 101) * .62 + meadow(x, y, 2.4, 102) * .38 - .5, nbn = meadow(x, y, 7, 103) * .62 + meadow(x, y, 2.8, 104) * .38 - .5;
      let b1 = -99, b2 = -99, w1 = own, w2 = own;
      for (let k = 0; k < N; k++) {
        if (sc[k] < -1) continue;
        const v = sc[k] + na * NA[k] + nbn * NB[k];
        if (v > b1) { b2 = b1; w2 = w1; b1 = v; w1 = k; } else if (v > b2) { b2 = v; w2 = k; }
      }
      win = w1; second = b2 < -50 ? w1 : w2; margin = b2 < -50 ? 1 : b1 - b2;
    }
    // The distance to the edge in world px (the margin grows ~0.19 a px across a blend).
    const e = margin * 5.33;
    const hx = Math.floor(x * K), hy = Math.floor(y * K), th = B2[((hy & 1) << 1) | (hx & 1)];
    let col: Rgb;
    switch (win) {
      case 0: case 4: {
        const ramp = win === 0 ? GRASS : MOSS;
        let gi = grassAt(hx, hy);
        if (second !== win && second !== 0 && second !== 4) {
          if (e < .5) gi = 1; else if (e < 1) gi = Math.max(gi, 4);
        }
        col = ramp[gi];
        break;
      }
      case 1: case 5: {
        let di = dirtT[((hy & 127) * 128) + (hx & 127)];
        if (second === 0 || second === 4) { if (e < 1) di = Math.min(di, 0); else if (e < 2) di = Math.min(di, 1); else if (e < 3 && th < .5) di = Math.min(di, 2); }
        col = (win === 1 ? DIRT : MIRE)[di];
        break;
      }
      case 2: {
        let si = Math.min(5, dirtT[((hy & 127) * 128) + (hx & 127)] + 1);
        if (second === 3) { if (e < 1.5) si = 1; else if (e < 3) si = Math.min(si, 2); else if (e < 4 && th < .5) si = Math.min(si, 3); }
        else if (second === 0 || second === 4) { if (e < .8) si = Math.min(si, 2); }
        col = SAND[si];
        break;
      }
      case 3: {
        const land = second !== 3;
        // Depth: how far the water won by (a shore is shallow, open water deep), dithered between bands.
        const d = land ? e : 99, dd = d + (th - .5) * .5;
        let wi = dd < 1.2 ? 5 : dd < 2.5 ? 4 : dd < 4 ? 3 : 2;
        if (dd >= 4) { const ld = landDist(lx, ly) + (th - .5) * 3 + (meadow(x, y, 8, 113) - .5) * 6; wi = ld < 7 ? 2 : ld < 15 ? 1 : 0; if (ld < 5 && d < 5.2) wi = 2; }
        col = WATER[wi];
        if (land) {
          // Two foam lines lapping in and out over the four frames, the outer one broken.
          const lap = .8 + .45 * Math.sin(ph + meadow(x, y, 9, 109) * 6);
          if (d < lap) col = FOAM;
          else { const l2 = 2.3 + .5 * Math.sin(ph + 1.6 + meadow(x, y, 9, 110) * 6); if (Math.abs(d - l2) < .28 && meadow(x * 1.7, y, 3, 111) > .45) col = FOAM2; }
        }
        // Wavelets on open water: short pale dashes drifting a pixel a frame.
        if (d > 4.5) { const w = meadow(x * .7 + frame * .6, y * 2.2, 4, 112); if (w > .81 && w < .825) col = WAVE; else if (wi > 0 && w < .06) col = WATER[wi - 1]; }
        break;
      }
      default: {
        const d = cobbleAt(Math.floor(x / TILE), Math.floor(y / TILE)), k = ((Math.floor(y) & 15) * TILE + (Math.floor(x) & 15)) * 4;
        col = [d[k], d[k + 1], d[k + 2]];
        if (second !== 6 && e < .6) col = [col[0] * .6, col[1] * .6, col[2] * .6];
      }
    }
    const o = (j * S + i) * 4;
    px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255;
  }
  c.putImageData(img, ox, oy);
  // Flowers (thicker on a bed) and the odd stone, at the finer pixel; never at the tile's edge (it may be another ground).
  const r = (q: number) => hash(tx, ty, q);
  if (own === 0) {
    const blooms = kind === 'flowers' ? (r(70) < .5 ? 2 : 1) : r(71) < .04 ? 1 : 0;
    for (let i = 0; i < blooms; i++) flower(c, ox + 6 + Math.floor(r(73 + i) * (S - 14)), oy + 6 + Math.floor(r(80 + i) * (S - 14)), Math.floor(r(87 + i) * FLOWERS.length));
    if (r(95) < .02) stone(c, ox + 8 + Math.floor(r(96) * (S - 18)), oy + 8 + Math.floor(r(97) * (S - 18)), r(98) < .4 ? 4 : 3, false);
  } else if (own === 1 && r(61) < .1) stone(c, ox + 8 + Math.floor(r(62) * (S - 18)), oy + 8 + Math.floor(r(63) * (S - 18)), r(64) < .5 ? 2 : 3, true);
  return true;
}
