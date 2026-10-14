/**
 * tile-art.ts — Terraria-style pixel art for delve terrain, baked from each
 * node's own palette (`base / dark / light / fleck`). No art assets.
 *
 * A 32 px cell is 16 × 16 art pixels drawn at 2 world px each. Every node kind
 * is baked once into VARIANTS small textures (pixel noise, pebbles, ore
 * clusters, roots, caps, bricks) in one shared atlas canvas; a cell picks its
 * variant by a fixed hash, so the same rock always looks the same. Edges are
 * not baked: they depend on the neighbours (auto-tiling) and are drawn when a
 * chunk is repainted:
 *
 *   - `tileMask` is the 8-neighbour solid mask. A diagonal bit only counts
 *     when both orthogonals next to it are solid (the "blob" reduction), so a
 *     mask names a shape, not noise.
 *   - Solid cells join: no line between rock and the ore inside it. Where a
 *     side meets air it gets a dark outline art pixel and a bevel (lit above
 *     and left, shadowed below and right); a corner open on both sides is
 *     rounded; an air pocket on a diagonal only notches the corner.
 *   - A side open to the air above carries the biome's top face: moss in the
 *     Root Hollows, ash in the Basalt Caverns, glowing lichen in the Glowcap
 *     Grotto, ember crust in the Magma Halls (keyed by the biome's own breath,
 *     `particles.kind`, so no new data).
 *
 * Render-only: nothing here reads or changes a cell's HP, solidity or save.
 */
import { BiomeDef, CELL, seededRandom, TERRAIN_NODE_LIST, TerrainNodeDef } from './terrain';

/** World px per art pixel. */
export const ART = 2;
/** Art pixels along a cell edge. */
export const TILE = CELL / ART;
/** Baked looks per node kind; a cell picks one by hash. */
export const VARIANTS = 3;
/** Wall atlas slots (one per biome); more biomes than this fall back to a flat wall. */
const WALL_SLOTS = 8;

// Palette slots a texture's pixels index.
export const P_BASE = 0, P_DARK = 1, P_LIGHT = 2, P_FLECK = 3, P_DEEP = 4, P_SHINE = 5, P_HI = 6;
const P_CLEAR = 255;
/** The palette index of a clear (transparent) art pixel. */
export const P_CLEAR_INDEX = P_CLEAR;

// Neighbour bits.
export const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;

/** A cheap, stable per-cell hash for variants, flecks and crack shapes. */
export function cellHash(col: number, row: number, salt = 0): number {
  let h = (col * 374761393 + row * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The auto-tile mask of a cell: N/E/S/W for solid orthogonal neighbours, and a
 * diagonal only when both orthogonals beside it are solid. Pure.
 */
export function tileMask(solid: (col: number, row: number) => boolean, col: number, row: number): number {
  let m = 0;
  if (solid(col, row - 1)) m |= N;
  if (solid(col + 1, row)) m |= E;
  if (solid(col, row + 1)) m |= S;
  if (solid(col - 1, row)) m |= W;
  if ((m & (N | E)) === (N | E) && solid(col + 1, row - 1)) m |= NE;
  if ((m & (S | E)) === (S | E) && solid(col + 1, row + 1)) m |= SE;
  if ((m & (S | W)) === (S | W) && solid(col - 1, row + 1)) m |= SW;
  if ((m & (N | W)) === (N | W) && solid(col - 1, row - 1)) m |= NW;
  return m;
}

/** Which baked look a cell wears, 0..VARIANTS-1. Fixed per cell. Pure. */
export function tileVariant(col: number, row: number): number {
  return cellHash(col, row, 0x7e11) % VARIANTS;
}

// ── Colour helpers ──────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
/** `a` blended toward `b` by t, as #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  const c = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}
function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A node's palette, in P_* order. */
export function nodePalette(node: Pick<TerrainNodeDef, 'base' | 'dark' | 'light' | 'fleck'>): string[] {
  // Deep: the outline, the darkest step pulled to the art bible's outline floor (#140a1f), never black.
  // Hi: the lit-edge highlight, a step above `light` (style guide §4: one highlight per ramp).
  return [node.base, node.dark, node.light, node.fleck, mixHex(node.dark, '#140a1f', .72), '#fff4e0', mixHex(node.light, '#fff4e0', .28)];
}
/** A biome's back-wall palette, in P_* order. */
export function wallPalette(biome: Pick<BiomeDef, 'wall'>): string[] {
  const [a, b, shadow] = biome.wall;
  return [a, b, mixHex(a, '#fff4e0', .1), shadow, mixHex(shadow, '#140a1f', .4), a, a];
}

// ── Pixel patterns (pure: 16×16 palette indices) ───────────────────────────

export type TilePattern = 'rock' | 'ore' | 'roots' | 'grain' | 'glowcap' | 'fragment' | 'cracked' | 'bedrock' | 'cache' | 'block' | 'placed';

/** The pattern a node is drawn with. Pure. */
export function patternOf(node: Pick<TerrainNodeDef, 'id' | 'yield' | 'glow'> & { placeable?: string }): TilePattern {
  // Placed things, and the rift shrine (walked through like one, never placed).
  if ((node.placeable || node.id === 'rift-shrine') && PLACED_ART[node.id]) return 'placed';
  switch (node.id) {
    case 'roots': case 'shadow-root': return 'roots';
    case 'petrified-trunk': return 'grain';
    case 'glowcap': return 'glowcap';
    case 'godforge-fragment': return 'fragment';
    case 'cracked-wall': return 'cracked';
    case 'bedrock': return 'bedrock';
    case 'cache': case 'kaels-cache': case 'waycache': return 'cache';
    case 'packed-dirt': case 'basalt-block': return 'block';
  }
  return node.yield || node.glow ? 'ore' : 'rock';
}

/** Whether a node wears its biome's top face where open to the air above. */
export function takesTopFace(pattern: TilePattern): boolean {
  return pattern !== 'cache' && pattern !== 'fragment' && pattern !== 'glowcap' && pattern !== 'block' && pattern !== 'placed';
}

export interface TilePixels {
  /** TILE × TILE palette indices, row-major. 255 = clear. */
  px: Uint8Array;
  /** The art pixel a sparkle sits on (y * TILE + x), or -1. */
  sparkle: number;
}

const at = (x: number, y: number) => y * TILE + x;

/**
 * Placed things (torch, ladder, platform, chest, camp, supports, charge) as
 * 16 × 16 art-pixel maps in their node's own palette, on the same 2 px grid as
 * the rock: `.` clear, `o` outline, `d` dark, `b` base, `l` light, `h` highlight,
 * `f` fleck, `s` shine. Transparent around the object, so the back wall shows.
 * A ladder's rungs and a platform's plank sit at the same rows in every cell,
 * so a run reads as one piece. Commissioned art (`Sprites/Props/`) replaces these.
 */
const PLACED_KEY: Readonly<Record<string, number>> = { '.': P_CLEAR, o: P_DEEP, d: P_DARK, b: P_BASE, l: P_LIGHT, h: P_HI, f: P_FLECK, s: P_SHINE };
export const PLACED_ART: Readonly<Record<string, readonly string[]>> = {
  torch: [
    '................',
    '.......f........',
    '......ff........',
    '......fsf.......',
    '.....fssf.......',
    '.....fsslf......',
    '.....flssf......',
    '......flf.......',
    '......obho......',
    '......obdo......',
    '.....oobdoo.....',
    '....oddbdddo....',
    '.....oobdoo.....',
    '......obdo......',
    '......obdo......',
    '......oooo......',
  ],
  ladder: [
    '..ohd......ohd..',
    '..old......old..',
    '..old......old..',
    '..ohhhhhhhhhhd..',
    '..oddddddddddd..',
    '..old......old..',
    '..old......old..',
    '..old......old..',
    '..old......old..',
    '..old......old..',
    '..old......old..',
    '..ohhhhhhhhhhd..',
    '..oddddddddddd..',
    '..old......old..',
    '..old......old..',
    '..old......old..',
  ],
  platform: [
    'hhhhhhhhhhhhhhhh',
    'lllflllllllllfll',
    'bbbbbbbfbbbbbbbb',
    'dddddddddddddddd',
    'oooooooooooooooo',
    '..od........do..',
    '...od......do...',
    '....od....do....',
    '.....oddddo.....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  chest: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..oooooooooooo..',
    '..ohhhhhhhhhho..',
    '..ollllllllldo..',
    '..offffffffffo..',
    '..oddddssddddo..',
    '..obbbbffbbbbo..',
    '..obbbbffbbbbo..',
    '..obbbbbbbbbdo..',
    '..offffffffffo..',
    '..obbbbbbbbddo..',
    '..oooooooooooo..',
  ],
  camp: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...........f....',
    '..........ff....',
    '..hh......fsf...',
    '..lld....fssf...',
    'ohhhhhho.fsslf..',
    'obbbbbbo..fllf..',
    '.od..od..oddddo.',
    '.od..od..oddddo.',
  ],
  'timber-support': [
    'oooooooooooooooo',
    'hhhhhhhhhhhhhhhh',
    'bbbbbbbbbbbbbbbb',
    'dddddddddddddddd',
    'ooooo.ohbdo.oooo',
    '.....fohbdof....',
    '......olbdo.....',
    '......olbdo.....',
    '......olbdo.....',
    '......olbdo.....',
    '......olbdo.....',
    '......olbdo.....',
    '......olbdo.....',
    '.....folbdof....',
    '.....oolbdoo....',
    '....oooooooooo..',
  ],
  'basalt-support': [
    'oooooooooooooooo',
    'hhhhhhhhhhhhhhhh',
    'bbbbbbbbbbbbbbbb',
    'ddddfdddddddfddd',
    'ooooo.ohbdo.oooo',
    '......ohbdo.....',
    '......olbdo.....',
    '......olfdo.....',
    '......olbdo.....',
    '......olbdo.....',
    '......olbfo.....',
    '......olbdo.....',
    '......olbdo.....',
    '.....oolbdoo....',
    '....ohhbbbddo...',
    '....oooooooooo..',
  ],
  'blast-charge': [
    '................',
    '................',
    '..........l.....',
    '...........l....',
    '...........l....',
    '..........l.....',
    '.........l......',
    '.........l......',
    '..........l.....',
    '.........l......',
    '...oooooolooo...',
    '...ohbdhbdhbdo..',
    '...olbdlbdlbdo..',
    '...offfffffffo..',
    '...olbdlbdlbdo..',
    '...ooooooooooo..',
  ],
  // A rift shrine: a standing stone split by a violet seam, light leaking from the crack.
  'rift-shrine': [
    '................',
    '......oooo......',
    '.....odbbdo.....',
    '....odbfsbdo....',
    '....obdsfdbo....',
    '....odbfsbdo....',
    '....obdsfdbo....',
    '....odbfsbdo....',
    '....obdsfdbo....',
    '....odbfsbdo....',
    '...oobdsfdboo...',
    '..olllbfsblllo..',
    '..oddddddddddo..',
    '..oooooooooooo..',
    '................',
    '................',
  ],
};
const inTile = (x: number, y: number) => x >= 0 && y >= 0 && x < TILE && y < TILE;

/** Blotchy stone: coarse 4-pixel patches plus fine grain, with pebbles. */
function body(px: Uint8Array, r: () => number, darkT: number, lightT: number, pebbles: number): void {
  const coarse = Array.from({ length: 16 }, () => r());
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const v = coarse[(y >> 2) * 4 + (x >> 2)] * .55 + r() * .45;
      px[at(x, y)] = v < darkT ? P_DARK : v > lightT ? P_LIGHT : P_BASE;
    }
  }
  for (let n = 0; n < pebbles; n++) {
    const x = 1 + Math.floor(r() * (TILE - 3)), y = 1 + Math.floor(r() * (TILE - 3));
    px[at(x, y)] = P_LIGHT; px[at(x + 1, y)] = P_FLECK; px[at(x, y + 1)] = P_FLECK; px[at(x + 1, y + 1)] = P_DARK;
  }
}

/** Build one variant of a pattern. Same inputs → same pixels. Pure. */
export function patternPixels(pattern: TilePattern, seedKey: string, variant: number): TilePixels {
  const px = new Uint8Array(TILE * TILE);
  const r = seededRandom(strHash(seedKey) ^ Math.imul(variant + 1, 0x9e3779b1));
  let sparkle = -1;
  switch (pattern) {
    case 'rock': body(px, r, .24, .84, 1 + (variant & 1)); break;
    case 'ore': {
      body(px, r, .26, .9, 0);
      // Bright clustered nuggets: a plus-shaped blob each, lit top-left, shadowed below.
      const clusters = 3 + (variant % 2);
      for (let n = 0; n < clusters; n++) {
        const cx = 3 + Math.floor(r() * 10), cy = 3 + Math.floor(r() * 10);
        const cells: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1]];
        for (const [dx, dy] of cells) if ((dx === 0 && dy === 0) || r() < .7) px[at(cx + dx, cy + dy)] = P_FLECK;
        for (let y = TILE - 2; y >= 0; y--) for (let x = 0; x < TILE; x++) {
          if (px[at(x, y)] === P_FLECK && px[at(x, y + 1)] !== P_FLECK && Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) px[at(x, y + 1)] = P_DARK;
        }
        px[at(cx - 1 >= 0 ? cx - 1 : cx, cy - 1 >= 0 ? cy - 1 : cy)] = P_LIGHT;
        if (n === 0) sparkle = at(cx, cy);
      }
      // The first nugget's centre shines (set last, so a later nugget cannot paint over it).
      px[sparkle] = P_SHINE;
      break;
    }
    case 'roots': {
      body(px, r, .55, .97, 0);
      const strands = 2 + (variant % 2);
      for (let s = 0; s < strands; s++) {
        const x0 = 2 + Math.floor(r() * 11), phase = r() * 6.3, knot = 3 + Math.floor(r() * 10);
        for (let y = 0; y < TILE; y++) {
          const x = Math.max(0, Math.min(TILE - 2, x0 + Math.round(Math.sin(y * .45 + phase) * 1.3)));
          px[at(x, y)] = P_LIGHT; px[at(x + 1, y)] = P_DEEP;
          if (y === knot) { px[at(x, y)] = P_FLECK; px[at(x + 1, y)] = P_FLECK; if (inTile(x, y + 1)) px[at(x, y + 1)] = P_FLECK; }
        }
      }
      break;
    }
    case 'grain': {
      // Petrified wood: vertical streaks, a knot.
      const tone = Array.from({ length: TILE }, () => r());
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const v = tone[x] * .7 + r() * .3;
        px[at(x, y)] = v < .3 ? P_DARK : v > .78 ? P_LIGHT : P_BASE;
      }
      const kx = 4 + Math.floor(r() * 8), ky = 4 + Math.floor(r() * 8);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) px[at(kx + dx, ky + dy)] = P_DARK;
      px[at(kx - 1, ky)] = P_FLECK; px[at(kx + 2, ky + 1)] = P_FLECK;
      break;
    }
    case 'glowcap': {
      body(px, r, .4, .95, 0);
      const caps = 2 + (variant === 2 ? 1 : 0);
      for (let s = 0; s < caps; s++) {
        const x = 2 + s * Math.floor(12 / caps) + Math.floor(r() * 3), h = 4 + Math.floor(r() * 4) + (s === 1 ? 2 : 0);
        for (let y = TILE - 1; y > TILE - 1 - h; y--) px[at(x, y)] = P_LIGHT;
        const top = TILE - 1 - h;
        for (let dx = -2; dx <= 2; dx++) if (inTile(x + dx, top)) px[at(x + dx, top)] = P_FLECK;
        for (let dx = -1; dx <= 1; dx++) if (inTile(x + dx, top - 1)) px[at(x + dx, top - 1)] = P_FLECK;
        if (inTile(x - 1, top - 1)) { px[at(x - 1, top - 1)] = P_SHINE; if (s === 0) sparkle = at(x - 1, top - 1); }
      }
      break;
    }
    case 'fragment': {
      body(px, r, .3, .9, 0);
      for (let y = 2; y < 14; y++) {
        const hw = Math.round((y - 2) * .45);
        for (let x = 8 - hw; x <= 8 + hw; x++) px[at(x, y)] = P_LIGHT;
        if (y > 2) { px[at(8 - hw - 1, y)] = P_DEEP; px[at(Math.min(TILE - 1, 8 + hw + 1), y)] = P_DEEP; }
      }
      for (let y = 6; y < 12; y++) px[at(8, y)] = P_FLECK;
      px[at(8, 3)] = P_SHINE; sparkle = at(8, 3);
      break;
    }
    case 'cracked': {
      body(px, r, .24, .86, 1);
      let x = 4 + Math.floor(r() * 7);
      for (let y = 0; y < TILE; y++) {
        const step = r();
        if (step < .3) x = Math.max(1, x - 1); else if (step > .7) x = Math.min(TILE - 2, x + 1);
        px[at(x, y)] = P_FLECK; px[at(x + 1, y)] = P_DEEP;
      }
      break;
    }
    case 'bedrock': {
      body(px, r, .5, .97, 0);
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        if ((x + y + variant * 3) % 7 === 0 && r() < .75) px[at(x, y)] = P_LIGHT;
        else if ((x + y + variant * 3) % 7 === 1 && r() < .5) px[at(x, y)] = P_DEEP;
      }
      break;
    }
    case 'cache': {
      px.fill(P_DEEP);
      for (let y = 5; y < TILE; y++) for (let x = 1; x < TILE - 1; x++) {
        const edge = y === 5 || y === TILE - 1 || x === 1 || x === TILE - 2;
        px[at(x, y)] = edge ? P_DARK : y === 9 ? P_LIGHT : P_BASE;
      }
      for (let y = 8; y < 12; y++) { px[at(7, y)] = P_FLECK; px[at(8, y)] = P_FLECK; }
      px[at(7, 8)] = P_SHINE; sparkle = at(7, 8);
      break;
    }
    case 'placed': {
      const rows = PLACED_ART[seedKey];
      px.fill(P_CLEAR);
      if (rows) for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px[at(x, y)] = PLACED_KEY[rows[y][x]] ?? P_CLEAR;
      break;
    }
    case 'block': {
      // Laid bricks: 8 × 4 courses, offset every other course, mortar dark, lit top-left.
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const course = y >> 2, bx = (x + (course & 1) * 4) & 7, by = y & 3;
        px[at(x, y)] = by === 3 || bx === 7 ? P_DARK : by === 0 || bx === 0 ? P_LIGHT : r() < .15 ? P_FLECK : P_BASE;
      }
      break;
    }
  }
  return { px, sparkle };
}

/** A tunnel's back wall: big dim blocks with grout, like Terraria's dirt and stone walls. Pure. */
export function wallPixels(seedKey: string, variant: number): Uint8Array {
  const px = new Uint8Array(TILE * TILE);
  const r = seededRandom(strHash(`wall:${seedKey}`) ^ Math.imul(variant + 1, 0x85ebca6b));
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const course = y >> 3, bx = (x + (course & 1) * 4) & 7, by = y & 7;
      const grout = by === 7 || bx === 7;
      const v = r();
      px[at(x, y)] = grout ? P_DEEP : (by === 0 || bx === 0) && v < .7 ? P_LIGHT : v < .35 ? P_DARK : P_BASE;
    }
  }
  return px;
}

const sparkles = new Map<number, number>();
/**
 * Where a node's sparkle sits in a variant, as world px offsets from the cell's
 * top-left (centre of the art pixel), or -1 when the look has none. Memoised.
 */
export function sparkleOffset(kind: number, variant: number): number {
  const key = kind * VARIANTS + variant;
  let s = sparkles.get(key);
  if (s === undefined) {
    const node = TERRAIN_NODE_LIST[kind];
    s = node ? patternPixels(patternOf(node), node.id, variant).sparkle : -1;
    sparkles.set(key, s);
  }
  return s;
}

// ── The atlas ───────────────────────────────────────────────────────────────

export interface AtlasCanvas { canvas: CanvasImageSource & { width: number; height: number }; context: { fillStyle: unknown; fillRect(x: number, y: number, w: number, h: number): void } }

function defaultCanvas(width: number, height: number): AtlasCanvas | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext?.('2d');
  if (!context) return null;
  canvas.width = width; canvas.height = height;
  return { canvas, context };
}

/**
 * Every baked texture in one canvas: a row of VARIANTS tiles per node kind,
 * then one row per biome back wall. A row is painted the first time it is
 * asked for and never again. Draws nothing (returns -1) where no canvas can
 * be made (SSR, node tests).
 */
export class TileAtlas {
  private surface: AtlasCanvas | null = null;
  private failed = false;
  private readonly painted = new Set<number>();
  private readonly walls = new Map<string, number>();
  /** Textures baked so far (tests). */
  baked = 0;
  constructor(private readonly make: (width: number, height: number) => AtlasCanvas | null = defaultCanvas) {}

  get canvas(): AtlasCanvas['canvas'] | null { return this.surface?.canvas ?? null; }

  /** The atlas row (y = row × TILE) holding a node kind's variants, or -1. */
  node(kind: number): number {
    const node = TERRAIN_NODE_LIST[kind];
    if (!node || !this.ready()) return -1;
    if (!this.painted.has(kind)) {
      this.painted.add(kind);
      const pattern = patternOf(node), palette = nodePalette(node);
      for (let v = 0; v < VARIANTS; v++) this.paint(patternPixels(pattern, node.id, v).px, palette, v, kind);
    }
    return kind;
  }
  /** The atlas row of a biome's back wall, or -1. */
  wall(biome: BiomeDef): number {
    if (!this.ready()) return -1;
    let row = this.walls.get(biome.id);
    if (row === undefined) {
      if (this.walls.size >= WALL_SLOTS) return -1;
      row = TERRAIN_NODE_LIST.length + this.walls.size;
      this.walls.set(biome.id, row);
      const palette = wallPalette(biome);
      for (let v = 0; v < VARIANTS; v++) this.paint(wallPixels(biome.id, v), palette, v, row);
    }
    return row;
  }
  private ready(): boolean {
    if (this.surface) return true;
    if (this.failed) return false;
    this.surface = this.make(TILE * VARIANTS, TILE * (TERRAIN_NODE_LIST.length + WALL_SLOTS));
    if (!this.surface) this.failed = true;
    return !!this.surface;
  }
  /** Lay one texture into its slot, a fillRect per run of equal pixels. */
  private paint(px: Uint8Array, palette: readonly string[], variant: number, row: number): void {
    const c = this.surface!.context, ox = variant * TILE, oy = row * TILE;
    for (let y = 0; y < TILE; y++) {
      let x = 0;
      while (x < TILE) {
        const index = px[at(x, y)];
        let end = x + 1;
        while (end < TILE && px[at(end, y)] === index) end++;
        if (index !== P_CLEAR) { c.fillStyle = palette[index]; c.fillRect(ox + x, oy + y, end - x, 1); }
        x = end;
      }
    }
    this.baked++;
  }
}

// ── Edges and top faces (drawn per cell when a chunk is repainted) ─────────

interface Painter { fillStyle: unknown; globalAlpha: number; fillRect(x: number, y: number, w: number, h: number): void }

/**
 * Outline and bevel where a solid cell meets air, rounded open corners, and
 * notches for diagonal air pockets. (x, y) is the cell's top-left in world px.
 */
export function paintEdges(c: Painter, x: number, y: number, mask: number, palette: readonly string[]): void {
  const A = ART, R = x + CELL - A, B = y + CELL - A;
  const deep = palette[P_DEEP];
  // Lit from the upper left: the highlight step along an open top, the light step down an open left side.
  if (!(mask & N)) { c.fillStyle = palette[P_HI] ?? palette[P_LIGHT]; c.fillRect(x, y + A, CELL, A); }
  if (!(mask & W)) { c.fillStyle = palette[P_LIGHT]; c.fillRect(x + A, y, A, CELL); }
  if (!(mask & S)) { c.fillStyle = palette[P_DARK]; c.fillRect(x, B - A, CELL, A); }
  if (!(mask & E)) { c.fillStyle = palette[P_DARK]; c.fillRect(R - A, y, A, CELL); }
  c.fillStyle = deep;
  if (!(mask & N)) c.fillRect(x, y, CELL, A);
  if (!(mask & S)) c.fillRect(x, B, CELL, A);
  if (!(mask & W)) c.fillRect(x, y, A, CELL);
  if (!(mask & E)) c.fillRect(R, y, A, CELL);
  // Rounded corners: open on both sides, the corner steps in by a pixel.
  if (!(mask & (N | W))) c.fillRect(x + A, y + A, A, A);
  if (!(mask & (N | E))) c.fillRect(R - A, y + A, A, A);
  if (!(mask & (S | W))) c.fillRect(x + A, B - A, A, A);
  if (!(mask & (S | E))) c.fillRect(R - A, B - A, A, A);
  // Inner corners: both sides solid, the diagonal open.
  if ((mask & (N | W)) === (N | W) && !(mask & NW)) c.fillRect(x, y, A, A);
  if ((mask & (N | E)) === (N | E) && !(mask & NE)) c.fillRect(R, y, A, A);
  if ((mask & (S | W)) === (S | W) && !(mask & SW)) c.fillRect(x, B, A, A);
  if ((mask & (S | E)) === (S | E) && !(mask & SE)) c.fillRect(R, B, A, A);
}

/** Rows of a W7a auto-tile sheet (style guide §7.1), top to bottom. */
export const AUTOTILE_ROWS = ['tile', 'top', 'bottom', 'sides', 'thin', 'caps', 'inner'] as const;

/**
 * The W7a piece for a cell's auto-tile mask (style guide §7.1): `[row, col]`
 * in the 4 × 7 sheet. A side is open when its neighbour is not solid; `h`
 * picks between the A/B (or A–D) variants. Pure.
 */
export function autoTilePiece(mask: number, h: number): [number, number] {
  const n = !(mask & N), e = !(mask & E), s = !(mask & S), w = !(mask & W);
  const open = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);
  if (open === 0) {
    if (!(mask & NW)) return [6, 0];
    if (!(mask & NE)) return [6, 1];
    if (!(mask & SW)) return [6, 2];
    if (!(mask & SE)) return [6, 3];
    return [0, h & 3];
  }
  if (open === 4) return [4, 2 + (h & 1)];
  if (open === 3) return !s ? [5, 0] : !n ? [5, 1] : !e ? [5, 2] : [5, 3];
  if (n && s) return [4, 0];
  if (e && w) return [4, 1];
  if (n) return w ? [1, 2] : e ? [1, 3] : [1, h & 1];
  if (s) return w ? [2, 2] : e ? [2, 3] : [2, h & 1];
  return w ? [3, h & 1] : [3, 2 + (h & 1)];
}

export type TopFace = 'moss' | 'ash' | 'lichen' | 'crust';
/** The top face a biome grows, from what it breathes. Pure. */
export function topFaceOf(biome: Pick<BiomeDef, 'particles'> | null | undefined): TopFace | null {
  switch (biome?.particles.kind) {
    case 'spore': return 'moss';
    case 'ash': return biome.particles.count > 0 ? 'ash' : null;
    case 'mote': return 'lichen';
    case 'ember': return 'crust';
  }
  return null;
}
/** [lit, body, accent] per top face. Lichen and crust reuse the glowcap's and the embers' own colours. */
const FACE_COLORS: Readonly<Record<TopFace, readonly [string, string, string]>> = {
  moss: ['#9ad84e', '#4c9a2e', '#d8f2a0'],
  ash: ['#d4c8bc', '#9a8c84', '#6a5c56'],
  lichen: ['#bff4ff', '#2a8eb0', '#6fe0ff'],
  crust: ['#ffc45c', '#8a2a14', '#ff7a3a'],
};

/** The biome's crust along a cell's top edge (open to the air above). `h` picks the ragged shape. */
export function paintTopFace(c: Painter, x: number, y: number, face: TopFace, h: number): void {
  const [lit, body, accent] = FACE_COLORS[face];
  const A = ART;
  c.fillStyle = body; c.fillRect(x, y, CELL, A);
  for (let i = 0; i < TILE; i++) {
    const bits = (h >>> (i % 16)) ^ (h >>> ((i * 7) % 29));
    // Ragged underside: some columns hang one or two pixels lower.
    const drop = face === 'ash' ? (bits & 3) === 0 ? 1 : 0 : (bits & 3);
    if (drop) { c.fillStyle = body; c.fillRect(x + i * A, y + A, A, A * Math.min(2, drop)); }
    if (face === 'moss' || face === 'ash') {
      if ((bits & 1) === 0) { c.fillStyle = lit; c.fillRect(x + i * A, y, A, A); }
      if (face === 'moss' && (bits & 31) === 7) { c.fillStyle = accent; c.fillRect(x + i * A, y, A, A); }
    } else if ((bits & 3) === 1) {
      // Lichen and crust glimmer in specks.
      c.fillStyle = (bits & 4) ? lit : accent; c.fillRect(x + i * A, y + ((bits & 8) ? A : 0), A, A);
    }
  }
}

/** Fill the art pixels along a segment (world px), so cracks stay on the pixel grid. */
export function pixelLine(c: Painter, x0: number, y0: number, x1: number, y1: number): void {
  let ax = Math.floor(x0 / ART), ay = Math.floor(y0 / ART);
  const bx = Math.floor(x1 / ART), by = Math.floor(y1 / ART);
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 64; n++) {
    c.fillRect(ax * ART, ay * ART, ART, ART);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; ax += sx; }
    if (e2 <= dx) { err += dx; ay += sy; }
  }
}

// ── Rock shade: light reaches less far into solid rock ─────────────────────

/**
 * How much of a light reaches each cell, by how deep it sits in rock: 1 for
 * air and for rock that touches air, ROCK_DEEP1 one cell in, ROCK_DEEP2 deeper.
 * Kept per terrain and rebuilt only when a cell changes (any chunk revision).
 */
export const ROCK_DEEP1 = .8;
export const ROCK_DEEP2 = .6;
export class RockShade {
  values = new Float32Array(0);
  cols = 0; rows = 0; top = 0;
  /** World column of `values`' first column (a ring's loaded span). */
  col0 = 0;
  private source: unknown = null;
  private revision = -1;
  update(t: { cols: number; rows: number; top: number; chunkRev: Uint32Array; solid(col: number, row: number): boolean; colLo?: number }): this {
    let rev = 0;
    for (let i = 0; i < t.chunkRev.length; i++) rev = (rev + t.chunkRev[i] * (i + 1)) >>> 0;
    const col0 = t.colLo ?? 0;
    if (t === this.source && rev === this.revision && col0 === this.col0) return this;
    this.source = t; this.revision = rev; this.col0 = col0;
    this.cols = t.cols; this.rows = t.rows; this.top = t.top;
    if (this.values.length !== t.cols * t.rows) this.values = new Float32Array(t.cols * t.rows);
    for (let row = 0; row < t.rows; row++) {
      for (let col = col0; col < col0 + t.cols; col++) {
        let v = 1;
        if (t.solid(col, row) && t.solid(col - 1, row) && t.solid(col + 1, row) && t.solid(col, row - 1) && t.solid(col, row + 1)) {
          v = ROCK_DEEP2;
          // One more ring (a diamond of radius 2): any air there and the cell is only one deep.
          for (let dy = -2; dy <= 2 && v !== ROCK_DEEP1; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const d = Math.abs(dx) + Math.abs(dy);
              if (d !== 2) continue;
              if (!t.solid(col + dx, row + dy)) { v = ROCK_DEEP1; break; }
            }
          }
        }
        this.values[row * t.cols + (col - col0)] = v;
      }
    }
    return this;
  }
}
