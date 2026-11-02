/**
 * td-iso-tiles.ts — iso-native ground (docs/handoff/iso-ground.md). The isometric view's tiles painted straight into
 * their diamonds, a pixel at a time into the ground chunk's pixels (td-iso-ground.ts): no square tile painted first, no
 * canvas, no read-back, no resampling.
 *
 * - **Textures in screen space.** Grass, moss, dirt, sand, bog, ash and snow sample the ground's own calm ramp-index
 *   textures (td-ground `grass()`, `dirt()`) at the diamond pixel's screen position, so the clumps stand upright in the
 *   view and run across tile seams with no grid; a slow meadow patch map (a ramp step lighter or darker, ordered dither)
 *   breaks the repeat. Cobble is its own screen-space texture of rounded setts. Slabs, boards and rugs are laid on the
 *   tile's own axes, so their joints run along the diamond's edges, as iso pixel art does.
 * - **Transitions, natively.** Each ground has a rank. A higher neighbour (grass beside a road, sand beside the sea)
 *   grows into this tile up to a reach that wanders with a world-anchored noise: a plain distance table per diamond pixel
 *   and a few comparisons, never the old per-tile organic painter. The edge dresses itself from the distance: the
 *   overgrowing ground's dark foot (above) or lit lip (below), the shade it throws on the road, wet sand at the sea.
 * - **Water.** Depth from the distance to land at the tile's corners (smooth across tiles), foam that laps along every
 *   shore over the four water frames, short wavelets that light in turn (a palette cycle); lava glows at its banks,
 *   black water stays still.
 * - **Decks.** Piers, bridges and boardwalks are plank decks with a beam face on their camera sides and posts down into
 *   the water, a shadow on the water under them (`faces`). The Nightroad's ghost planks use the same deck (`deckSprite`).
 * - **Low** (Environment detail): hard diamond edges, no patches, no dressing — the cheapest bake.
 */
import { TILE, hash, type Ground } from './td-art';
import { CAVE_RAMP, DIRT_RAMP, FLOWERS, GRASS_RAMP, MIRE_RAMP, MOSS_RAMP, SAND_RAMP, dirt, grass } from './td-ground';
import { BOARD_RAMP } from './td-floors';

/** The diamond's box in HD px, and the HD square it stands for. */
const DW = 64, DH = 32, SQ = TILE * 2;

const abgr = (h: string): number => ((0xff << 24) | (parseInt(h.slice(5, 7), 16) << 16) | (parseInt(h.slice(3, 5), 16) << 8) | parseInt(h.slice(1, 3), 16)) >>> 0;
const ramp = (r: readonly string[]) => Uint32Array.from(r.map(abgr));

/** Per box pixel: its HD square pixel (V·32 + U), or −1 outside the diamond. Each row's first and last+1 column. */
const UV = new Int16Array(DW * DH).fill(-1);
const ROWS = new Int16Array(DH * 2);
for (let j = 0; j < DH; j++) {
  let a = DW, b = 0;
  for (let i = 0; i < DW; i++) {
    const u = (i + .5) / 2 - TILE, v = (j + .5) / 2, lx = v + u / 2, ly = v - u / 2;
    if (lx < 0 || ly < 0 || lx >= TILE || ly >= TILE) continue;
    UV[j * DW + i] = Math.floor(ly * 2) * SQ + Math.floor(lx * 2);
    a = Math.min(a, i); b = i + 1;
  }
  ROWS[j * 2] = a; ROWS[j * 2 + 1] = b;
}

/** The eight neighbours: N, S, W, E, NW, NE, SW, SE. */
const DX = [0, 0, -1, 1, -1, 1, -1, 1], DY = [-1, 1, 0, 0, -1, -1, 1, 1];
/** Each HD square pixel's distance (HD px) to each neighbour's edge or corner. */
const DIST = (() => {
  const d = new Float32Array(8 * SQ * SQ);
  for (let v = 0; v < SQ; v++) for (let u = 0; u < SQ; u++) {
    const x = u + .5, y = v + .5, X = SQ - x, Y = SQ - y, k = v * SQ + u, n = SQ * SQ;
    d[k] = y; d[n + k] = Y; d[2 * n + k] = x; d[3 * n + k] = X;
    d[4 * n + k] = Math.hypot(x, y); d[5 * n + k] = Math.hypot(X, y); d[6 * n + k] = Math.hypot(x, Y); d[7 * n + k] = Math.hypot(X, Y);
  }
  return d;
})();

const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16));
const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

/** Value noise in [0, 1] that wraps every `pw` × `ph` px (lattice `s` px). */
function pnoise(x: number, y: number, s: number, pw: number, ph: number, salt: number): number {
  const gw = pw / s, gh = ph / s, gx = Math.floor(x / s), gy = Math.floor(y / s), fx = x / s - gx, fy = y / s - gy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash(((a % gw) + gw) % gw, ((b % gh) + gh) % gh, salt);
  const a = h(gx, gy), b = h(gx + 1, gy), c = h(gx, gy + 1), d = h(gx + 1, gy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** The edge's wander: 256 × 256 world HD px, two octaves. */
let edgeNoise: Float32Array | null = null;
function edges(): Float32Array {
  if (edgeNoise) return edgeNoise;
  const n = new Float32Array(256 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) n[y * 256 + x] = pnoise(x, y, 16, 256, 256, 401) * .65 + pnoise(x, y, 8, 256, 256, 402) * .35;
  return (edgeNoise = n);
}
/** Two independent edge noises (256 × 256 world HD px): each ground's weight is nudged by its own mix of them. */
let edgePairs: [Float32Array, Float32Array] | null = null;
function edgePair(): [Float32Array, Float32Array] {
  if (edgePairs) return edgePairs;
  const a = edges(), b = new Float32Array(256 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) b[y * 256 + x] = pnoise(x, y, 14, 256, 256, 403) * .62 + pnoise(x, y, 6, 256, 256, 404) * .38;
  return (edgePairs = [a, b]);
}
/** Per class (Look.cls): the weight's nudge by noise A and noise B (different grounds wander differently; td-terrain NA/NB). */
const NA = Float32Array.from([0, .4, .4, -.3, .16, .2, .2, -.4, -.3, -.3, -.32, -.64, 1.2, .9, .8, 0, 0, 0, 0, 0]);
const NB = Float32Array.from([0, -.96, -.96, .7, .64, .5, .5, .88, .8, .8, .8, .96, 0, -.3, .2, 0, 0, 0, 0, 0]);
/** Smoothstep weight of the next tile centre along an axis, per HD pixel 0–31 (0 at a centre, ½ at the edge). */
const FU = Float32Array.from({ length: SQ }, (_, u) => { let t = (u + .5) / SQ - .5; t = t < 0 ? t + 1 : t; return t * t * (3 - 2 * t); });

/** The meadow's patches in screen space (512 × 256): −1, 0 or +1 ramp step, ordered-dithered. */
let patchMap: Int8Array | null = null;
function patches(): Int8Array {
  if (patchMap) return patchMap;
  const p = new Int8Array(512 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const m = pnoise(x, y, 64, 512, 256, 405) * .75 + pnoise(x, y, 32, 512, 256, 406) * .25, th = bayer(x, y);
    p[y * 512 + x] = m > .64 && th < (m - .64) * 2.4 ? 1 : m < .34 && th < (.34 - m) * 2.4 ? -1 : 0;
  }
  return (patchMap = p);
}
/** Cobble setts in screen space (128 × 64): 0 the gap, 1 the dark foot, 2–3 the body, 4–5 the lit cap. */
let cobbleTex: Uint8Array | null = null;
function cobbles(): Uint8Array {
  if (cobbleTex) return cobbleTex;
  const W = 128, H = 64, CWc = 16, CHc = 8, t = new Uint8Array(W * H);
  const centre = (gx: number, gy: number): [number, number, number] => {
    const wx = ((gx % 8) + 8) % 8, wy = ((gy % 8) + 8) % 8;
    return [gx * CWc + (gy & 1 ? 8 : 0) + (hash(wx, wy, 411) - .5) * 5, gy * CHc + (hash(wx, wy, 412) - .5) * 2.5, hash(wx, wy, 413)];
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gy = Math.floor(y / CHc), gx = Math.floor(x / CWc);
    let d1 = 1e9, d2 = 1e9, best: [number, number, number] = [0, 0, 0];
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const c = centre(gx + ox, gy + oy), dx = x + .5 - c[0], dy = (y + .5 - c[1]) * 2, d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; best = c; } else if (d < d2) d2 = d;
    }
    const gap = Math.sqrt(d2) - Math.sqrt(d1);
    const dx = x + .5 - best[0], dy = y + .5 - best[1], l = dx + dy * 2;
    // Calm (figures must read over it): a soft gap, one lit rim, two body tones.
    t[y * W + x] = gap < 1.2 ? 1 : gap < 2.2 && l > 2 ? 2 : l < -6 ? 4 : best[2] < .45 ? 2 : 3;
  }
  return (cobbleTex = t);
}
/** Wavelets in screen space (128 × 64): 0 none, 1–4 the frame each lights on. */
let rippleTex: Uint8Array | null = null;
function ripples(): Uint8Array {
  if (rippleTex) return rippleTex;
  const t = new Uint8Array(128 * 64);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 421) * 128), y = Math.floor(hash(i, 2, 421) * 64), len = 3 + Math.floor(hash(i, 3, 421) * 4), ph = 1 + Math.floor(hash(i, 4, 421) * 4);
    for (let k = 0; k < len; k++) t[y * 128 + ((x + k) & 127)] = ph;
  }
  return (rippleTex = t);
}

const enum S { Grass, Canopy, Dirt, Sand, Snow, Cobble, Slab, Board, Rug, Water, Lava, Black }
interface Look {
  s: S; ramp: Uint32Array;
  /** Rank: a higher neighbour grows into this tile; −1 never blends (decks, rugs, the canopy). */
  rank: number;
  /** Grows into lower neighbours (organic grounds); slabs are overgrown but never spread. */
  spreads: boolean;
  /** Same class never blends (grass and a flower bed). */
  cls: number;
  /** The ordinary ramp range (shading steps stay inside it). */
  lo: number; hi: number;
  liquid: boolean; deck: boolean;
  /** The ramp index of the warm step this ground takes beside lava (the bank's glow), if any. */
  warm?: number;
}
const look = (s: S, r: readonly string[], rank: number, cls: number, o: Partial<Look> = {}): Look =>
  ({ s, ramp: ramp(r), rank, spreads: rank >= 0, cls, lo: 0, hi: r.length - 1, liquid: false, deck: false, ...o });

/** Ash (the volcanic lands' surface floor), then its ember glints. */
const ASH_RAMP = ['#1c181b', '#262124', '#312a2d', '#3d3437', '#4a4043', '#5a4f50', '#e2552a', '#ffb04a', '#5a3a30'];
/** Snow, shadow blue to sunlit white. */
const SNOW_RAMP = ['#7d8cab', '#9aabc8', '#b9c8de', '#d3dfee', '#e8f0f8', '#f8fbff'];
const COBBLE_RAMP = ['#5e524c', '#7a6c62', '#968678', '#a8988a', '#b8a894', '#c8b8a2'];
const TEMPLE_RAMP = ['#3a463a', '#566054', '#6f7769', '#7e8678', '#8d9486', '#a6ad9c', '#4c8042'];
const WET_RAMP = ['#1e2429', '#2e3338', '#40464c', '#4f565d', '#5d646b', '#737b83', '#2c3c4a'];
const BOARDWALK_RAMP = ['#2e241e', '#3a2e26', '#5c4b3d', '#6f5c4a', '#7d6853', '#8c7660', '#9c8670', '#ac9680'];
const RUG_RAMP = ['#3a120c', '#5e2218', '#7a2c1e', '#8f3524', '#a8442c', '#d68a2e', '#e8d5b0', '#f6ead0'];
const CANOPY_RAMP = ['#0c2012', '#12301a', '#1a4224', '#24562e', '#2f6a38', '#3d7e44'];
/** Water deep → shallow, then foam, the outer foam, a wavelet, the deck's shadow on the water. */
const WATER_RAMP = ['#1a3458', '#21466c', '#285a80', '#317092', '#4a92aa', '#78bcc4', '#eef8f2', '#b8e2e0', '#5aa2ba', '#14283f'];
const LAVA_RAMP = ['#3a1410', '#5a2418', '#7a3220', '#9e2e1c', '#e2552a', '#ff8a2e', '#ffd25a', '#fff2a8'];
const BLACK_RAMP = ['#0b1016', '#121a22', '#1a2530', '#2c3c4a', '#3e5a3a', '#557a4c', '#ffc65a'];
/** The Nightroad's ghost planks (td-dark-layer): violet shadow wood. */
const NIGHT_RAMP = ['#140e18', '#2a1f2e', '#3a2c3c', '#4a3c4e', '#5a4a5e', '#6a4e8a', '#7e62a0', '#9a80c0'];

const LOOKS = new Map<string, Look>([
  ['grass', look(S.Grass, GRASS_RAMP, 8, 1, { lo: 1, hi: 4 })],
  ['flowers', look(S.Grass, GRASS_RAMP, 8, 1, { lo: 1, hi: 4 })],
  ['moss', look(S.Grass, MOSS_RAMP, 9, 2, { lo: 1, hi: 4 })],
  ['snow', look(S.Snow, SNOW_RAMP, 7, 3, { lo: 1, hi: 5 })],
  ['cobble', look(S.Cobble, COBBLE_RAMP, 6, 4)],
  ['flagstone', look(S.Slab, TEMPLE_RAMP, 5, 5, { spreads: false, hi: 5 })],
  ['wetstone', look(S.Slab, WET_RAMP, 5, 6, { spreads: false, hi: 5 })],
  ['dirt', look(S.Dirt, DIRT_RAMP, 4, 7)],
  ['cave', look(S.Dirt, [...CAVE_RAMP, '#4a2a24'], 3, 8, { hi: 5, warm: 6 })],
  ['ash', look(S.Dirt, ASH_RAMP, 3, 9, { hi: 4, warm: 8 })],
  ['mire', look(S.Dirt, MIRE_RAMP, 2, 10)],
  ['sand', look(S.Sand, SAND_RAMP, 1, 11)],
  ['water', look(S.Water, WATER_RAMP, 0, 12, { spreads: false, liquid: true, hi: 5 })],
  ['ember', look(S.Lava, LAVA_RAMP, 0, 13, { spreads: false, liquid: true })],
  ['blackwater', look(S.Black, BLACK_RAMP, 0, 14, { spreads: false, liquid: true, hi: 3 })],
  ['plank', look(S.Board, BOARD_RAMP, -1, 15, { deck: true })],
  ['boardwalk', look(S.Board, BOARDWALK_RAMP, -1, 16, { deck: true })],
  ['rug', look(S.Rug, RUG_RAMP, -1, 17)],
  ['canopy', look(S.Canopy, CANOPY_RAMP, -1, 18)],
]);
const NIGHT_DECK = look(S.Board, NIGHT_RAMP, -1, 19, { deck: true });
/** Ground drawn as a block (td-iso-walls.ts): no look; its floor neighbours take its shade. */
const BLOCKS: ReadonlySet<string> = new Set(['rock', 'wall', 'vinewall', 'drownwall', 'bark']);
const FOAM = 6, FOAM2 = 7, WAVE = 8, UNDER = 9;
const CALM = Uint8Array.from([1, 2, 2, 3, 3, 4]);
/** Snow drifts on the dirt texture: its ruts the blue shade, its worn top the sunlit crust. */
const SNOWI = Uint8Array.from([3, 3, 4, 4, 4, 5]);
/** Beam face and post heights (HD px). */
const FACE = 6, POST = 9;

/** Is ground `g` water a deck stands over (posts, faces, a shadow)? */
const wet = (g: string) => g === 'water' || g === 'blackwater' || g === 'ember';

export class IsoTiles {
  /** Distance (world px) from each tile corner to the nearest land (for the water's depth), by packed corner. */
  private readonly depth = new Map<number, number>();
  /** The surface (cave floor reads as ash there: the Ashfields, the Molten Fields). */
  surface = false;
  /** Environment detail Low: hard edges, no patches, no dressing. */
  low = false;

  constructor(private readonly at: (c: number, r: number) => Ground) {}

  clear(): void { this.depth.clear(); this.plain.clear(); }

  private lookOf(g: string): Look | undefined {
    if (g === 'cave' && this.surface) return LOOKS.get('ash');
    return LOOKS.get(g);
  }
  /** Can this painter draw ground `g` (else the caller's own painters do)? */
  paints(g: string): boolean { return LOOKS.has(g); }
  /** Is ground `g` a deck (faces and posts over water)? */
  deck(g: string): boolean { return !!LOOKS.get(g)?.deck; }

  /**
   * Paint tile (c, r) at water frame `f` into `px` (a `W` × `H` chunk of ABGR pixels), its diamond's box at (ox, oy),
   * clipped. False when this painter has no look for the ground.
   *
   * The blend (td-terrain.ts's rule, in the diamond): every pixel weighs the four nearest tile centres (smoothstep
   * bilinear, so corners round off both ways), each ground nudged by its own two noises (so the line wanders), and the
   * heaviest wins. How close the runner-up came is the distance to the edge, and the edge dresses itself from it.
   */
  lay(dst: Uint32Array, DWd: number, DHd: number, dox: number, doy: number, c: number, r: number, f: number): boolean {
    const g = this.at(c, r) as string, me = this.lookOf(g);
    if (!me) return false;
    const low = this.low, pt = low ? null : patches(), gt = grass(), dt = dirt(), [na, nb] = edgePair();
    // The 3×3 neighbourhood's looks (a deck, a rug, a wall or anything unblended counts as this tile's own); walls up the
    // screen (N, W) shade this floor.
    const nbr = this.nbr;
    let mixed = false, shadeN = false, shadeW = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ng = this.at(c + dx, r + dy) as string;
      if (BLOCKS.has(ng)) { if (dx === 0 && dy === -1) shadeN = true; else if (dx === -1 && dy === 0) shadeW = true; }
      const nl: Look | undefined = dx || dy ? this.lookOf(ng) : me;
      const use: Look = !low && nl && nl.rank >= 0 && me.rank >= 0 && nl.cls !== me.cls ? nl : me;
      nbr[(dy + 1) * 3 + dx + 1] = use;
      if (use !== me) mixed = true;
    }
    const shade = !low && !me.liquid && me.rank >= 0 && (shadeN || shadeW);
    const wx0 = c * SQ, wy0 = r * SQ, X0 = (c - r - 1) * 32, Y0 = (c + r) * 16;
    let d00 = 99, d10 = 99, d01 = 99, d11 = 99;
    if (me.s === S.Water) { d00 = this.depthAt(c, r); d10 = this.depthAt(c + 1, r); d01 = this.depthAt(c, r + 1); d11 = this.depthAt(c + 1, r + 1); }
    // A plain tile (no edge, no wall's shade, open water) is a pure function of where it falls in the screen-space
    // textures' repeat (512 × 256): cached per look, place in the repeat and frame, and copied.
    let key = -1;
    if (!mixed && !shade && (me.s === S.Grass || me.s === S.Dirt || me.s === S.Sand || me.s === S.Snow || me.s === S.Cobble || me.s === S.Canopy || me.s === S.Black
      || (me.s === S.Water && Math.min(d00, d10, d01, d11) >= 38 && !low))) {
      // Open water repeats every 4 tiles along each diagonal (the wavelets' 128 × 64): 64 entries, not 1 024 (which churned the cache).
      const m = me.s === S.Water ? 3 : 15;
      key = ((me.cls * 4 + (me.liquid ? f : 0)) * 16 + ((c - r) & m)) * 16 + ((c + r) & m) + (low ? 1 << 20 : 0);
    }
    let px = dst, W = DWd, H = DHd, ox = dox, oy = doy;
    if (key >= 0) {
      const hit = this.plain.get(key);
      if (hit) { copyBox(dst, DWd, DHd, dox, doy, hit); if (!low) this.dress(dst, DWd, DHd, dox, doy, c, r, g, me); return true; }
      px = this.box; W = DW; H = DH; ox = 0; oy = 0;
    }
    const ph = f * Math.PI / 2, rt = ripples(), deckRun = me.deck ? this.run(c, r) : 0;
    const qk = this.qk, qw = this.qw;
    for (let j = 0; j < DH; j++) {
      const y = oy + j;
      if (y < 0 || y >= H) continue;
      const a = Math.max(ROWS[j * 2], -ox), b = Math.min(ROWS[j * 2 + 1], W - ox), row = y * W + ox, Y = Y0 + j;
      for (let i = a; i < b; i++) {
        const k = UV[j * DW + i], U = k & 31, V = k >> 5, X = X0 + i;
        // The winner, the runner-up, the distance to the edge (HD px), and whether the runner-up lies down the screen.
        let L: Look = me, O: Look = me, e = 99, below = false;
        if (mixed) {
          const ax = U < 16 ? 0 : 1, ay = V < 16 ? 0 : 1, fu = FU[U], fv = FU[V];
          const l00 = nbr[ay * 3 + ax], l10 = nbr[ay * 3 + ax + 1], l01 = nbr[(ay + 1) * 3 + ax], l11 = nbr[(ay + 1) * 3 + ax + 1];
          if (l00 !== l10 || l00 !== l01 || l00 !== l11) {
            const wx = (wx0 + U) & 255, wy = (wy0 + V) & 255, n1 = na[(wy << 8) | wx] - .5, n2 = nb[(wy << 8) | wx] - .5;
            // Up to four looks, summed (w) with their screen-down weight (s: 0 at the upper-left centre, 2 at the lower-right).
            let n = 0;
            n = mix(qk, qw, n, l00, (1 - fu) * (1 - fv), 0); n = mix(qk, qw, n, l10, fu * (1 - fv), 1);
            n = mix(qk, qw, n, l01, (1 - fu) * fv, 1); n = mix(qk, qw, n, l11, fu * fv, 2);
            let b1 = -9, b2 = -9, w1 = 0, w2 = 0;
            for (let q = 0; q < n; q++) {
              const l = qk[q], v = qw[q * 2] + n1 * NA[l.cls] + n2 * NB[l.cls];
              if (v > b1) { b2 = b1; w2 = w1; b1 = v; w1 = q; } else if (v > b2) { b2 = v; w2 = q; }
            }
            L = qk[w1];
            if (b2 > -9) { O = qk[w2]; e = (b1 - b2) * 10.6; below = qw[w2 * 2 + 1] / Math.max(1e-3, qw[w2 * 2]) > 1; }
          }
        }
        let idx: number;
        if (L.s === S.Water) {
          const fu = (U + .5) / SQ, fv = (V + .5) / SQ, th = bayer(X, Y), land = O !== L;
          const D = Math.min((d00 * (1 - fu) + d10 * fu) * (1 - fv) + (d01 * (1 - fu) + d11 * fu) * fv, land ? e / 2 : 99) + (th - .5) * 3;
          idx = D < 2 ? 5 : D < 5 ? 4 : D < 10 ? 3 : D < 20 ? 2 : D < 34 ? 1 : 0;
          if (land && !O.liquid && e < 9) {
            const wx = (wx0 + U) & 255, wy = (wy0 + V) & 255, nz = na[(wy << 8) | wx];
            if (e < 1.8 + 1.1 * Math.sin(ph + nz * 6)) idx = FOAM;
            else if (!low && Math.abs(e - (5.2 + .8 * Math.sin(ph + 1.6 + nz * 6))) < .6 && nb[(((wy + 97) & 255) << 8) | ((wx + 31) & 255)] > .5) idx = FOAM2;
          } else if (low && L === me) {
            // Low: a line of foam along a straight shore.
            for (let q = 0; q < 4; q++) if (!wet(this.at(c + DX[q], r + DY[q]) as string) && DIST[q * 1024 + k] < 1.6 + (f & 1)) idx = FOAM;
          }
          if (idx < 4 && rt[((Y & 63) << 7) | ((X + f) & 127)] === f + 1) idx = WAVE;
        } else {
          idx = this.sample(L, X, Y, U, V, c, r, f, gt, dt, pt, L === me ? deckRun : 0);
          // Low: lava still glows along its bank (a 1 px rim on the diamond's edge), so the hazard reads at every detail.
          if (low && L.s === S.Lava) for (let q = 0; q < 4; q++) if (DIST[q * 1024 + k] < 1.2 && this.at(c + DX[q], r + DY[q]) !== 'ember') idx = 6;
          if (O !== L && e < 3.2) {
            if (L.liquid) idx = L.s === S.Lava ? (e < 1.6 ? 6 : Math.max(idx, 5)) : 2;
            else if (O.liquid) { if (O.s === S.Lava && L.warm !== undefined) { if (e < 1.5) idx = L.warm; } else if (e < 3) idx = Math.max(L.lo, idx - 1); }
            // Snow drifts over what it meets with a shaded lip; other grounds a dark foot (above) or a lit edge (below).
            else if (L.s === S.Snow) { if (e < 1.6) idx = 1; else if (e < 2.6) idx = 2; }
            else if (L.rank > O.rank) { if (e < 1.6) idx = below ? Math.max(L.lo, idx - 1) : Math.min(L.hi, idx + 1); }
            else if (!below && e < 2.6) idx = Math.max(0, idx - (e < 1.2 ? 2 : 1));
          }
          if (shade && L === me) {
            const d = Math.min(shadeN ? V : 99, shadeW ? U : 99);
            if (d < 4) idx = Math.max(0, idx - 2); else if (d < 10 || (d < 13 && bayer(X, Y) < .5)) idx = Math.max(0, idx - 1);
          }
        }
        px[row + i] = L.ramp[idx];
      }
    }
    if (key >= 0) {
      // About 4 KB a tile: 512 of them (the looks a view shows, each place in the repeat) is ~2 MB.
      if (this.plain.size >= 512) this.plain.delete(this.plain.keys().next().value!);
      const t = pack(px);
      this.plain.set(key, t); copyBox(dst, DWd, DHd, dox, doy, t);
    }
    if (!low) this.dress(dst, DWd, DHd, dox, doy, c, r, g, me);
    return true;
  }
  private readonly nbr: Look[] = new Array<Look>(9);
  /** Plain tiles' box pixels, by look, frame and place in the textures' repeat (`lay`). */
  private readonly plain = new Map<number, Uint32Array>();
  /** The box a plain tile is painted in before it is packed into the cache. */
  private readonly box = new Uint32Array(DW * DH);
  private readonly qk: Look[] = new Array<Look>(4);
  private readonly qw = new Float32Array(8);


  /** A ground's ramp index at a pixel (screen X, Y; the tile's own U, V). */
  private sample(L: Look, X: number, Y: number, U: number, V: number, c: number, r: number, f: number, gt: Uint8Array, dt: Uint8Array, pt: Int8Array | null, run = 0): number {
    const p = pt ? pt[((Y & 255) << 9) | (X & 511)] : 0;
    switch (L.s) {
      case S.Grass: { const i = CALM[gt[((Y & 127) << 7) | (X & 127)]] + p; return i < L.lo ? L.lo : i > L.hi ? L.hi : i; }
      case S.Canopy: return CALM[gt[(((Y >> 1) & 127) << 7) | ((X >> 1) & 127)]] + (p > 0 ? 1 : 0);
      case S.Dirt: { const i = dt[((Y & 127) << 7) | (X & 127)] + (p < 0 ? -1 : 0); return i < 0 ? 0 : i > L.hi ? L.hi : i; }
      case S.Sand: { const i = dt[((Y & 127) << 7) | (X & 127)] + 1 + (p < 0 ? -1 : 0); return i > 5 ? 5 : i; }
      case S.Snow: { const i = SNOWI[dt[(((Y >> 1) & 127) << 7) | ((X >> 1) & 127)]] + p; return i < 1 ? 1 : i > 5 ? 5 : i; }
      case S.Cobble: return cobbles()[((Y & 63) << 7) | (X & 127)];
      case S.Slab: {
        // Two slabs a tile each way; the joint dark, the slab's upper edges (toward the light) lit.
        const su = U & 15, sv = V & 15, h = hash(c * 2 + (U >> 4), r * 2 + (V >> 4), 431);
        if (su === 0 || sv === 0) return 0;
        if (su === 1 || sv === 1) return 5;
        if (su === 15 || sv === 15) return 1;
        const moss = L.ramp.length > 6 && h > .7 && hash(c * 32 + U >> 1, r * 32 + V >> 1, 432) > .8;
        return moss ? 6 : h < .3 ? 2 : h < .75 ? 3 : 4;
      }
      case S.Board: {
        // Boards 8 HD px wide across the deck's run, staggered joints, nails at the joints, a lit edge and a dark seam.
        const P = run ? V + r * SQ : U + c * SQ, Q = run ? U + c * SQ : V + r * SQ, t = P & 7, bd = P >> 3;
        if (t === 0) return 0;
        const jt = (Q + Math.floor(hash(bd, 7, 441) * 64)) & 63;
        if (jt === 0) return 0;
        if ((jt === 2 || jt === 61) && (t === 3 || t === 5)) return 1;
        if (t === 1) return 6;
        const g = hash(Q >> 2, bd, 442) > .82 ? -1 : 0;
        return 3 + Math.floor(hash(bd, Q >> 6, 443) * 3) + g;
      }
      case S.Rug: {
        const e = Math.min(U, V, 31 - U, 31 - V);
        if (e < 3) return e === 0 ? 1 : 5;
        return ((((U + V) >> 3) ^ ((U - V + 64) >> 3)) & 1) ? 3 : (U + V) % 8 === 0 ? 6 : 4;
      }
      case S.Lava: {
        const v = dt[((((Y + (f >> 1)) & 127)) << 7) | ((X + f) & 127)];
        // A dark, slow body (darker than the imps over it), sparse crust, the brightness kept for cracks and banks.
        return v >= 4 ? 1 : v === 3 ? 2 : v === 2 ? 3 : v === 1 ? 4 : (hash(X >> 1, Y, 451 + f) > .9 ? 6 : 5);
      }
      case S.Black: return ripples()[((Y & 63) << 7) | ((X + (f >> 1)) & 127)] === f + 1 ? 3 : p > 0 ? 2 : 1;
      default: return 0;
    }
  }

  /** Which way a deck runs: 1 along r (deck or land north and south: boards lie across c), 0 along c. */
  private run(c: number, r: number): number {
    const d = (g: string) => !!LOOKS.get(g)?.deck;
    const n = d(this.at(c, r - 1)), s = d(this.at(c, r + 1)), w = d(this.at(c - 1, r)), e = d(this.at(c + 1, r));
    if ((n || s) && !(w || e)) return 1;
    if ((w || e) && !(n || s)) return 0;
    return wet(this.at(c - 1, r)) || wet(this.at(c + 1, r)) ? 1 : 0;
  }

  /** Distance (world px) from tile corner (cx, cy) to the nearest ground that is not water, within three tiles. */
  private depthAt(cx: number, cy: number): number {
    const key = (cx + 32768) * 65536 + (cy + 32768);
    let d = this.depth.get(key);
    if (d !== undefined) return d;
    d = 99;
    for (let tr = cy - 3; tr < cy + 3; tr++) for (let tc = cx - 3; tc < cx + 3; tc++) {
      if (this.at(tc, tr) === 'water') continue;
      const rx = Math.max(tc - cx, 0, cx - tc - 1), ry = Math.max(tr - cy, 0, cy - tr - 1), e = Math.hypot(rx, ry) * TILE;
      if (e < d) d = e;
    }
    if (this.depth.size > 20000) this.depth.clear();
    this.depth.set(key, d);
    return d;
  }

  /** The calm dressing: a bloom or a stone in a meadow, a pebble on a road, grit in a dungeon, a glint in the ash. */
  private dress(px: Uint32Array, W: number, H: number, ox: number, oy: number, c: number, r: number, g: string, me: Look): void {
    const h = (n: number) => hash(c, r, n);
    // A spot well inside the diamond (whatever grows in from the edges stays clear of it): its box pixel.
    const spot = (n: number): [number, number] => { const U = 9 + Math.floor(h(n) * 14), V = 9 + Math.floor(h(n + 1) * 14); return [ox + U - V + 32, oy + ((U + V) >> 1)]; };
    const dot = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = v; };
    if (me.s === S.Grass && me.cls === 1) {
      const blooms = g === 'flowers' ? (h(70) < .5 ? 2 : 1) : h(71) < .04 ? 1 : 0;
      for (let i = 0; i < blooms; i++) {
        const [x, y] = spot(73 + i * 2), [lit, sh, heart] = FLOWERS[Math.floor(h(87 + i) * FLOWERS.length)].map(abgr);
        dot(x, y + 2, me.ramp[0]); dot(x + 1, y + 2, me.ramp[0]);
        dot(x, y, lit); dot(x + 1, y - 1, lit); dot(x - 1, y + 1, lit); dot(x + 2, y, sh); dot(x + 1, y + 1, sh); dot(x + 1, y, heart);
      }
      if (h(95) < .02) this.stone(dot, ...spot(96), h(98) < .4 ? 4 : 3, me.ramp[0]);
    } else if (g === 'dirt' && h(61) < .12) this.stone(dot, ...spot(62), h(64) < .5 ? 2 : 3, me.ramp[0]);
    else if (me.s === S.Dirt && me.cls === 8) {
      // A dungeon floor: a pebble, a hairline crack.
      if (h(61) < .16) this.stone(dot, ...spot(62), 2, me.ramp[0]);
      if (h(70) < .12) { let [x, y] = spot(71); for (let i = 0; i < 6; i++) { dot(x, y, me.ramp[0]); x += h(73 + i) < .5 ? 1 : -1; y++; } }
    } else if (me.cls === 9 && h(61) < .1) { const [x, y] = spot(62); dot(x, y, me.ramp[6]); if (h(64) < .4) dot(x + 1, y, me.ramp[7]); }
    else if (me.cls === 10 && h(64) > .8) {
      // The bog: a reed sprig.
      const [x, y] = spot(65), reed = abgr('#78836a'), tip = abgr('#b6bea4');
      dot(x, y, tip); dot(x, y + 1, reed); dot(x, y + 2, reed); dot(x + 1, y + 1, reed); dot(x + 1, y + 2, reed); dot(x, y + 3, me.ramp[0]); dot(x + 1, y + 3, me.ramp[0]);
    } else if (me.s === S.Black && h(40) > .9) {
      // A lily pad.
      const [x, y] = spot(41);
      for (let dy = 0; dy < 3; dy++) for (let dx = -2; dx <= 3; dx++) if (Math.abs(dx - .5) + Math.abs(dy - 1) * 2 < 3.6) dot(x + dx, y + dy, me.ramp[dy === 0 ? 5 : 4]);
      dot(x + 1, y, me.ramp[1]);
    }
  }
  /** A small grey stone: a lit cap, a shaded body, a dark foot and its shadow. */
  private stone(dot: (x: number, y: number, v: number) => void, x: number, y: number, w: number, under: number): void {
    const t = STONE, h = w >= 4 ? 3 : 2;
    for (let i = 0; i <= w; i++) dot(x + i, y + h, under);
    for (let yy = 0; yy < h; yy++) for (let i = -1; i <= w; i++) if (!((i === -1 || i === w) && yy === 0)) dot(x + i, y + yy, t[0]);
    for (let yy = 0; yy < h - 1; yy++) for (let i = 0; i < w; i++) dot(x + i, y + yy, t[1]);
    for (let i = 0; i < w - 1; i++) dot(x + i, y, t[2]);
    dot(x, y, t[3]);
    for (let yy = 1; yy < h; yy++) dot(x + w - 1, y + yy, t[4]);
  }

  /**
   * A deck tile's camera-side faces, over the ground already laid round it: a beam face below its lower-left edge
   * (where the south neighbour is not deck) and its lower-right edge (east), posts at the corners down into the water, a
   * shadow on the water under it. Call after every tile of the frame is laid (the faces hang over the water's tiles).
   */
  faces(px: Uint32Array, W: number, H: number, ox: number, oy: number, c: number, r: number, f: number, L?: Look): void {
    const g = this.at(c, r) as string, me = L ?? LOOKS.get(g);
    if (!me?.deck) return;
    const sG = this.at(c, r + 1) as string, eG = this.at(c + 1, r) as string;
    const sOpen = !LOOKS.get(sG)?.deck && !BLOCKS.has(sG), eOpen = !LOOKS.get(eG)?.deck && !BLOCKS.has(eG);
    deckFaces(px, W, H, ox, oy, me.ramp, sOpen, eOpen, wet(sG), wet(eG), g === 'boardwalk' || hash(c, r, 461) < .5, f, this.low);
  }
  /** Is there a face to hang under tile (c, r)? */
  hasFaces(c: number, r: number): boolean {
    if (!LOOKS.get(this.at(c, r))?.deck) return false;
    const s = this.at(c, r + 1) as string, e = this.at(c + 1, r) as string;
    return (!LOOKS.get(s)?.deck && !BLOCKS.has(s)) || (!LOOKS.get(e)?.deck && !BLOCKS.has(e));
  }

  /**
   * The Nightroad's ghost deck for tile (c, r) of a road (td-dark-layer): its planks on the diamond and its faces and
   * posts where the road ends or the water shows (south `s`, east `e` open). A canvas 64 × (32 + face + post) HD px,
   * its diamond's box at (0, 0); cached per shape.
   */
  deckSprite(run: number, s: boolean, e: boolean, seed: number): HTMLCanvasElement {
    const key = `${run}${s ? 1 : 0}${e ? 1 : 0}${seed & 3}`;
    let cv = deckSprites.get(key);
    if (cv) return cv;
    const Hs = DH + FACE + POST + 2, img = new ImageData(DW, Hs), px = new Uint32Array(img.data.buffer);
    const L = NIGHT_DECK, gt = grass(), dt = dirt();
    for (let j = 0; j < DH; j++) for (let i = ROWS[j * 2]; i < ROWS[j * 2 + 1]; i++) {
      const k = UV[j * DW + i];
      px[j * DW + i] = L.ramp[this.sample(L, i, j, k & 31, k >> 5, seed & 3, 0, 0, gt, dt, null, run)];
    }
    deckFaces(px, DW, Hs, 0, 0, L.ramp, s, e, s, e, true, 0, false, true);
    cv = document.createElement('canvas'); cv.width = DW; cv.height = Hs;
    cv.getContext('2d')!.putImageData(img, 0, 0);
    deckSprites.set(key, cv);
    return cv;
  }
}

/** Copy a cached diamond (its 64 × 32 box) into `px` (W × H) with the box at (ox, oy), clipped. */
function copyBox(px: Uint32Array, W: number, H: number, ox: number, oy: number, t: Uint32Array): void {
  for (let j = 0; j < DH; j++) {
    const y = oy + j;
    if (y < 0 || y >= H) continue;
    const a = Math.max(ROWS[j * 2], -ox), b = Math.min(ROWS[j * 2 + 1], W - ox), row = y * W + ox, m = OFF[j] - ROWS[j * 2];
    for (let i = a; i < b; i++) px[row + i] = t[m + i];
  }
}
/** A diamond's pixels packed row by row (a box's 2 048 pixels hold 1 024 of them): where each row starts. */
const OFF = (() => { const o = new Int32Array(DH + 1); for (let j = 0; j < DH; j++) o[j + 1] = o[j] + ROWS[j * 2 + 1] - ROWS[j * 2]; return o; })();
function pack(box: Uint32Array): Uint32Array {
  const t = new Uint32Array(OFF[DH]);
  for (let j = 0; j < DH; j++) t.set(box.subarray(j * DW + ROWS[j * 2], j * DW + ROWS[j * 2 + 1]), OFF[j]);
  return t;
}

/** Add weight `w` (screen-down `sd`) for look `l` to the first `n` slots of (qk, qw); the new slot count. */
function mix(qk: Look[], qw: Float32Array, n: number, l: Look, w: number, sd: number): number {
  for (let q = 0; q < n; q++) if (qk[q] === l) { qw[q * 2] += w; qw[q * 2 + 1] += w * sd; return n; }
  qk[n] = l; qw[n * 2] = w; qw[n * 2 + 1] = w * sd; return n + 1;
}

const deckSprites = new Map<string, HTMLCanvasElement>();
const STONE = ['#3e3a44', '#7f7a86', '#a9a4b0', '#d4d0da', '#5a5662'].map(abgr);
const FOAM_PX = abgr(WATER_RAMP[FOAM]), FOAM2_PX = abgr(WATER_RAMP[FOAM2]);

/** Darken an ABGR pixel to about two thirds (the deck's shadow on whatever lies under it). */
const dim = (v: number) => (0xff000000 | (((v & 0xff) * 5) >> 3) | (((((v >> 8) & 0xff) * 5) >> 3) << 8) | (((((v >> 16) & 0xff) * 6) >> 3) << 16)) >>> 0;

/**
 * Faces and posts below a deck diamond whose box is at (ox, oy) in `px` (W × H): the lower-left edge runs from (0, 16)
 * to (32, 32) in the box, the lower-right from (32, 32) to (64, 16). `sOpen`/`eOpen`: a face on that side; `sWet`/`eWet`:
 * water under it (posts and a shadow). `alpha`: leave transparent pixels where nothing is drawn (the sprite).
 */
function deckFaces(px: Uint32Array, W: number, H: number, ox: number, oy: number, ramp: Uint32Array, sOpen: boolean, eOpen: boolean, sWet: boolean, eWet: boolean, posts: boolean, f: number, low: boolean, sprite = false): void {
  const put = (x: number, y: number, v: number) => { x += ox; y += oy; if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = v; };
  const shadow = (x: number, y: number) => { x += ox; y += oy; if (x >= 0 && y >= 0 && x < W && y < H && !sprite) px[y * W + x] = dim(px[y * W + x]); };
  for (let side = 0; side < 2; side++) {
    const open = side === 0 ? sOpen : eOpen, wt = side === 0 ? sWet : eWet;
    if (!open) continue;
    // Over land a deck only lips (two rows); over water its beam shows, lit on the left face, in shade on the right.
    const fh = wt ? FACE : 2, body = side === 0 ? 4 : 2;
    for (let n = 0; n < 32; n++) {
      const i = side === 0 ? n : 32 + n, top = side === 0 ? 16 + (n >> 1) + 1 : 32 - (n >> 1);
      for (let d = 0; d < fh; d++) {
        const idx = d === 0 ? (sprite ? 7 : body + 2) : d === fh - 1 ? 0 : (n & 7) === (side === 0 ? 7 : 0) ? 1 : d === 1 ? body + 1 : body;
        put(i, top + d, ramp[idx]);
      }
      if (wt && !low) for (let d = fh; d < fh + 4; d++) if (d < fh + 2 || ((i + d) & 1)) shadow(i, top + d);
    }
    if (!wt || !posts) continue;
    // Posts at the side's two corners (left vertex and bottom; bottom and right), down into the water, a ring of foam.
    for (const pxl of side === 0 ? [1, 29] : [31, 59]) {
      const top = (pxl < 32 ? 16 + (pxl >> 1) : 32 - ((pxl - 32) >> 1)) + FACE;
      for (let d = 0; d < POST; d++) for (let w = 0; w < 4; w++) put(pxl + w, top + d, ramp[w === 0 ? 3 : w === 3 ? 0 : d === POST - 1 ? 0 : 2]);
      if (!sprite) { const lap = (f & 1) ? 1 : 0; for (let w = -1 - lap; w < 5 + lap; w++) put(pxl + w, top + POST, w < 0 || w > 3 ? FOAM2_PX : FOAM_PX); }
    }
  }
}
