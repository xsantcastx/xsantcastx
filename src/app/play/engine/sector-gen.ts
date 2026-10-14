/**
 * sector-gen.ts — the endless Delve's generator (Phase 7, horizontal first;
 * docs/world/delve-and-beyond.md §3.2 and §3.6). Pure: no DOM, no Angular.
 *
 * The world is cut into SECTOR × SECTOR-cell sectors, (sx, sy) =
 * (floor(col / 32), floor(row / 32)). The shipped 120 × 56 core (EMBER_DELVE)
 * sits in sector columns 0..3 and is copied cell for cell from today's
 * `generateTerrain` (stamps, inscriptions, lakes, caches, the fragment
 * chamber): it never changes. Everything else is generated per sector column
 * (the two sectors sy 0 and sy 1 stacked, rows 0..55), and only from
 * integers derived from the seed and the column, so:
 *
 *   - the same (seed, sx, generator version) always gives the same cells, on
 *     any device and in any order (no Math.random, no Math.sin/exp: integer
 *     hashing and + − × ÷ only, which IEEE doubles do identically everywhere);
 *   - what does not depend on the sector (band edges, caves) is a function of
 *     the WORLD cell, so a cave crosses a sector border without a seam;
 *   - what does (ore veins) is rolled per sector from `sectorSeed` and clipped
 *     to it, which costs nothing visible at 32 cells;
 *   - structures sit on a lattice of LATTICE sector columns: one per stratum
 *     per lattice cell at most, placed from the lattice cell's own seed, so
 *     both sectors a structure straddles stamp exactly their half of it.
 *
 * Order per cell: the stratum's band rock (edges jittered by 1-D noise of the
 * column, blended into the core's own edges at its borders), then caves (2
 * octaves of value noise, shaped per stratum: narrow root tunnels, long basalt
 * galleries, round grotto caverns, magma halls), then ore veins (only into
 * rock, so caves stay open and their walls show ore), then structures (they
 * win: their shells are what keeps a lake a lake), then the bedrock floor.
 *
 * Bump SECTOR_GV whenever any of that changes for a seed: a saved sector diff
 * carries the version it was dug under, and on a mismatch only its air and
 * placed cells are re-applied (tunnels and builds survive, ore may move).
 */
import { FIELD_NOTE_PREFIX, fieldNotePool, type FieldNoteStratum } from '../../shared/delve/field-notes.model';
import { generateTerrain, LIQUID_FULL, LIQUID_LAVA, LIQUID_WATER, nodeIndex, seededRandom, Terrain, TerrainSpec, VeinSpec } from './terrain';

/** Sector edge in cells (§3.1). */
export const SECTOR = 32;
/** Generator version: saved with every sector diff. */
export const SECTOR_GV = 1;
/** Structures: one lattice cell is this many sector columns wide (64 cells). */
export const LATTICE = 2;

const AIR = 0;
const BEDROCK = nodeIndex('bedrock');

// ── Hashing and noise (integers in, deterministic doubles out) ──────────────

/** murmur3's finaliser on int32s (kept in small-integer range: no heap numbers in the hot loop). */
function mixi(x: number): number {
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35);
  return x ^ (x >>> 16);
}
/** A well-mixed uint32. */
export function mix32(x: number): number { return mixi(x | 0) >>> 0; }

/** §3.2: one seed per (sector, generator version). */
export function sectorSeed(seed: number, sx: number, sy: number, gv = SECTOR_GV): number {
  return mixi(seed ^ mixi(Math.imul(sx, 0x9E3779B1)) ^ mixi(Math.imul(sy, 0x85EBCA77)) ^ gv) >>> 0;
}

/** A hashed lattice value in [0, 1) for an integer point under `salt`. */
function lattice(salt: number, x: number, y: number): number {
  return (mixi(salt ^ mixi(Math.imul(x, 0x9E3779B1) ^ mixi(Math.imul(y, 0x85EBCA77) + 0x632BE5AB))) >>> 0) * 2.3283064365386963e-10;
}
const smooth = (f: number) => f * f * (3 - 2 * f);

/** 2-D value noise in [0, 1): smooth between hashed lattice values. */
export function valueNoise(salt: number, x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  const a = lattice(salt, ix, iy), b = lattice(salt, ix + 1, iy);
  const c = lattice(salt, ix, iy + 1), d = lattice(salt, ix + 1, iy + 1);
  const top = a + (b - a) * sx, bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

/**
 * `valueNoise(salt, x, row / scaleY)` for every row of one column, into `out`:
 * the same numbers, with the lattice hashed once per lattice row instead of
 * once per cell (a column is generated in well under a millisecond).
 */
export function noiseColumn(salt: number, x: number, scaleY: number, rows: number, out: Float64Array, cache?: LatticeCache): Float64Array {
  const ix = Math.floor(x), sx = smooth(x - ix);
  const span = Math.floor((rows - 1) / scaleY) + 2;
  // The lattice values of columns ix and ix + 1, reused while consecutive columns share them.
  let left: Float64Array, right: Float64Array;
  if (cache && cache.salt === salt && cache.ix === ix && cache.left.length >= span) { left = cache.left; right = cache.right; }
  else {
    left = cache && cache.salt === salt && cache.ix === ix - 1 && cache.right.length >= span ? cache.right : new Float64Array(span);
    if (left !== cache?.right) for (let iy = 0; iy < span; iy++) left[iy] = lattice(salt, ix, iy);
    right = new Float64Array(span);
    for (let iy = 0; iy < span; iy++) right[iy] = lattice(salt, ix + 1, iy);
    if (cache) { cache.salt = salt; cache.ix = ix; cache.left = left; cache.right = right; }
  }
  for (let row = 0; row < rows; row++) {
    const y = row / scaleY, iy = Math.floor(y);
    const a = left[iy], b = right[iy], c = left[iy + 1], d = right[iy + 1];
    const top = a + (b - a) * sx, bottom = c + (d - c) * sx;
    out[row] = top + (bottom - top) * smooth(y - iy);
  }
  return out;
}
/** Two lattice columns kept between calls of `noiseColumn` (one per noise field). */
export interface LatticeCache { salt: number; ix: number; left: Float64Array; right: Float64Array }
export function latticeCache(): LatticeCache { return { salt: NaN, ix: NaN, left: new Float64Array(0), right: new Float64Array(0) }; }

/** 1-D value noise in [0, 1). */
export function valueNoise1(salt: number, x: number): number {
  const ix = Math.floor(x), s = smooth(x - ix);
  const a = lattice(salt, ix, 0), b = lattice(salt, ix + 1, 0);
  return a + (b - a) * s;
}

// ── What a sector column holds ──────────────────────────────────────────────

/** A hall's creatures (they live in its flat-floored cavern, like the core's Maws). */
export interface SectorHall { creature: string; count: number; col0: number; col1: number; floorRow: number }
export type StructureKind = 'ruin' | 'waycache' | 'flooded-shaft' | 'maw-den' | 'lake' | 'rift-shrine' | 'lava-basin' | 'bailiff-hall';
/** A structure as the map and the meaning check see it: its kind and its top-left cell. */
export interface SectorStructure { kind: StructureKind; col: number; row: number; w: number; h: number }

/**
 * One generated sector column: SECTOR cells wide, the core's rows tall.
 * Local index = row × SECTOR + (col − sx × SECTOR).
 */
export interface SectorColumnGen {
  sx: number;
  gv: number;
  kind: Uint8Array;
  liqType: Uint8Array;
  liqLevel: Uint8Array;
  /** 1 where a blasting charge must leave the cell (caches, the core's protected stamps). */
  protect: Uint8Array;
  /** Carved walls: local index → id (`field:<note>` for field notes, the core's own ids in the core). */
  notes: Map<number, string>;
  /** Halls whose first column is in this sector column (they spawn creatures when it loads). */
  halls: SectorHall[];
  /** Structures that touch this sector column. */
  structures: SectorStructure[];
}

/** What every sector column of one Delve shares: the spec, the seed, and the core as generated. */
export interface SectorContext {
  spec: TerrainSpec;
  seed: number;
  gv: number;
  /** The core exactly as `generateTerrain(spec, seed)` makes it (no diff). */
  core: Terrain;
  /** Band edge offsets at the core's west (col 0) and east (col cols−1) borders, as the core drew them. */
  coreEdgeWest: number[];
  coreEdgeEast: number[];
  /** Per-band salts for the wings' edge noise. */
  bandSalt: number[];
  /** The veins a sector rolls: the spec's shared veins, then each biome's. */
  veins: readonly VeinSpec[];
  /** Row → stratum index (0 Root Hollows … 3 Magma Halls), from the spec's biomes. */
  stratumOfRow: Uint8Array;
}

/** The four shipped strata, top to bottom (biome ids of the core spec). */
const STRATA: readonly FieldNoteStratum[] = ['root-hollows', 'basalt-caverns', 'glowcap-grotto', 'magma-halls'];

/** Build the shared context once per (spec, seed). */
export function sectorContext(spec: TerrainSpec, seed: number, gv = SECTOR_GV): SectorContext {
  const core = generateTerrain(spec, seed);
  // The core's band edges come first off its RNG stream (generateTerrain): replay them exactly.
  const random = seededRandom(seed);
  const jitter = spec.jitter ?? 0;
  const coreEdgeWest: number[] = [], coreEdgeEast: number[] = [];
  for (let b = 0; b < spec.bands.length; b++) {
    const knots = Array.from({ length: Math.ceil(spec.cols / 6) + 2 }, () => (random() * 2 - 1) * jitter);
    const at = (col: number) => { const k = col / 6, i = Math.floor(k), f = k - i, s = f * f * (3 - 2 * f); return knots[i] * (1 - s) + knots[i + 1] * s; };
    coreEdgeWest.push(at(0)); coreEdgeEast.push(at(spec.cols - 1));
  }
  const bandSalt = spec.bands.map((_, b) => mix32((seed ^ Math.imul(b + 1, 0x27d4eb2f) ^ gv) >>> 0));
  const veins = spec.biomes?.length ? [...spec.veins, ...spec.biomes.flatMap(biome => biome.veins)] : spec.veins;
  const stratumOfRow = new Uint8Array(spec.rows);
  for (let row = 0; row < spec.rows; row++) {
    let s = STRATA.length - 1;
    for (let i = 0; i < (spec.biomes?.length ?? 0); i++) if (row < spec.biomes![i].to) { s = Math.min(STRATA.length - 1, i); break; }
    stratumOfRow[row] = s;
  }
  return { spec, seed: seed >>> 0, gv, core, coreEdgeWest, coreEdgeEast, bandSalt, veins, stratumOfRow };
}

/** True when world column `col` belongs to the hand-made core. */
export function isCoreCol(ctx: Pick<SectorContext, 'spec'>, col: number): boolean { return col >= 0 && col < ctx.spec.cols; }

/** Sector columns the core overlaps: 0 .. ceil(cols / SECTOR) − 1. */
export function coreSectorCols(spec: Pick<TerrainSpec, 'cols'>): number { return Math.ceil(spec.cols / SECTOR); }

// ── Band rock and caves (functions of the world cell) ───────────────────────

/** How far (cells) from the core a wing column is, or 0 inside it. */
function coreDistance(ctx: SectorContext, col: number): number {
  return col < 0 ? -col : col >= ctx.spec.cols ? col - ctx.spec.cols + 1 : 0;
}

/** Band edge offset (rows) at a wing column: noise, eased into the core's own edge at its borders. */
function bandEdge(ctx: SectorContext, b: number, col: number): number {
  const jitter = ctx.spec.jitter ?? 0;
  const noise = (valueNoise1(ctx.bandSalt[b], col / 6) * 2 - 1) * jitter;
  const d = coreDistance(ctx, col);
  if (d >= 12) return noise;
  const w = smooth(d / 12), base = col < 0 ? ctx.coreEdgeWest[b] : ctx.coreEdgeEast[b];
  return base * (1 - w) + noise * w;
}

/**
 * The band rock and caves of one wing column, into `out.kind` (local column
 * `lc`). Caves are shaped per stratum (§3.2 step 3): the Root Hollows wind
 * narrow tunnels (the 0.5 contour of a noise field), the Basalt Caverns run
 * long horizontal galleries (noise stretched along x), the Glowcap Grotto
 * opens round caverns, the Magma Halls broad low halls. Near the core the
 * rock closes up, so its hand-made walls are not cut open.
 */
function rockColumn(ctx: SectorContext, col: number, lc: number, out: Uint8Array, nodes: readonly number[], scratch: Float64Array[], caches: LatticeCache[]): void {
  const spec = ctx.spec, rows = spec.rows, bands = spec.bands, s = ctx.seed;
  const bedrockFrom = rows - spec.bedrock;
  const d = coreDistance(ctx, col);
  const closing = d < 10 ? (1 - d / 10) * .3 : 0;
  // Band edges once per column.
  const edges = scratch[8];
  for (let b = 0; b < bands.length - 1; b++) edges[b] = bands[b].to + Math.round(bandEdge(ctx, b, col));
  const root = noiseColumn(s ^ 0x1a2b3c4d, col / 11, 4.5, rows, scratch[0], caches[0]);
  const basaltA = noiseColumn(s ^ 0x2b3c4d5e, col / 24, 3.2, rows, scratch[1], caches[1]), basaltB = noiseColumn(s ^ 0x3c4d5e6f, col / 9, 2.4, rows, scratch[2], caches[2]);
  const grottoA = noiseColumn(s ^ 0x4d5e6f70, col / 13, 8, rows, scratch[3], caches[3]), grottoB = noiseColumn(s ^ 0x5e6f7081, col / 6, 4, rows, scratch[4], caches[4]);
  const magmaA = noiseColumn(s ^ 0x6f708192, col / 16, 5, rows, scratch[5], caches[5]), magmaB = noiseColumn(s ^ 0x708192a3, col / 7, 3, rows, scratch[6], caches[6]);
  for (let row = 0; row < rows; row++) {
    const i = row * SECTOR + lc;
    if (row >= bedrockFrom) { out[i] = BEDROCK; continue; }
    let cave = false;
    if (row >= 3 && row < bedrockFrom - 1) {
      switch (ctx.stratumOfRow[row]) {
        case 0: cave = Math.abs(root[row] - .5) < .05 - closing * .2; break;
        case 1: cave = .65 * basaltA[row] + .35 * basaltB[row] > .66 + closing; break;
        case 2: cave = .6 * grottoA[row] + .4 * grottoB[row] > .63 + closing; break;
        default: cave = .6 * magmaA[row] + .4 * magmaB[row] > .65 + closing; break;
      }
    }
    if (cave) { out[i] = AIR; continue; }
    let node = nodes[nodes.length - 1];
    for (let b = 0; b < bands.length - 1; b++) if (row < edges[b]) { node = nodes[b]; break; }
    out[i] = node;
  }
}

// ── Structures (§3.6) ───────────────────────────────────────────────────────

/** Writes into one sector column, clipped to it. */
class Builder {
  constructor(private readonly out: SectorColumnGen, private readonly col0: number, private readonly rows: number, private readonly core: (col: number) => boolean) {}
  private at(col: number, row: number): number {
    if (row < 0 || row >= this.rows || col < this.col0 || col >= this.col0 + SECTOR || this.core(col)) return -1;
    return row * SECTOR + (col - this.col0);
  }
  put(col: number, row: number, node: number, protect = false): void {
    const i = this.at(col, row);
    if (i < 0) return;
    this.out.kind[i] = node; this.out.liqType[i] = 0; this.out.liqLevel[i] = 0;
    this.out.protect[i] = protect ? 1 : 0;
    this.out.notes.delete(i);
  }
  rect(col: number, row: number, w: number, h: number, node: number): void {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) this.put(c, r, node);
  }
  liquid(col: number, row: number, w: number, h: number, type: number): void {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) {
      const i = this.at(c, r);
      if (i < 0 || this.out.kind[i] !== AIR) continue;
      this.out.liqType[i] = type; this.out.liqLevel[i] = LIQUID_FULL;
    }
  }
  note(col: number, row: number, id: string): void {
    const i = this.at(col, row);
    if (i < 0) return;
    this.out.kind[i] = INSCRIPTION; this.out.liqType[i] = 0; this.out.liqLevel[i] = 0;
    this.out.notes.set(i, id);
  }
  /** Solid cells only: dress a wall without filling the room. */
  dress(col: number, row: number, node: number): void {
    const i = this.at(col, row);
    if (i >= 0 && this.out.kind[i] !== AIR && this.out.kind[i] !== INSCRIPTION) this.out.kind[i] = node;
  }
}

const INSCRIPTION = nodeIndex('inscription');
const N = {
  rootLoam: nodeIndex('root-loam'), trunk: nodeIndex('petrified-trunk'), shadowRoot: nodeIndex('shadow-root'), cinder: nodeIndex('cinder-vein'),
  hardRock: nodeIndex('hard-rock'), emberRock: nodeIndex('ember-rock'), waycache: nodeIndex('waycache'), slag: nodeIndex('slag-vein'),
  grottoStone: nodeIndex('grotto-stone'), glowcap: nodeIndex('glowcap'), shrine: nodeIndex('rift-shrine'),
  scorched: nodeIndex('scorched-basalt'), heartstone: nodeIndex('heartstone-vein'),
};

interface Plan { kind: StructureKind; col: number; row: number; w: number; h: number; salt: number }
/** Cells a structure keeps from its lattice cell's sides: its shell, and a flooded shaft's five-cell adit. */
const MARGIN = 7;

/** Which structure (if any) each stratum holds in lattice cell `cell`. Pure: the same for every sector that asks. */
export function latticePlans(ctx: SectorContext, cell: number): Plan[] {
  const span = LATTICE * SECTOR, x = cell * span;
  // The core's lattice cells are the core's own: nothing generated lands in it.
  if (x < ctx.spec.cols && x + span > 0) return [];
  const out: Plan[] = [];
  for (let s = 0; s < STRATA.length; s++) {
    const salt = mix32((ctx.seed ^ mix32(Math.imul(cell, 0x632BE5AB)) ^ Math.imul(s + 1, 0x85EBCA77) ^ Math.imul(ctx.gv, 0x27d4eb2f)) >>> 0);
    const r = seededRandom(salt);
    const roll = r();
    const pick = (table: readonly [StructureKind | null, number][]): StructureKind | null => {
      let acc = 0;
      for (const [kind, weight] of table) { acc += weight; if (roll < acc) return kind; }
      return null;
    };
    const kind = pick(STRUCTURE_TABLE[s]);
    if (!kind) continue;
    const size = SIZE[kind];
    const w = size.w[0] + Math.floor(r() * (size.w[1] - size.w[0] + 1));
    const h = size.h;
    // A kind laid in two strata (the rift shrine) takes its rows from the stratum it was rolled in.
    const rows = kind === 'rift-shrine' && s === 3 ? MAGMA_SHRINE_ROWS : size.row;
    const row = rows[0] + Math.floor(r() * (rows[1] - rows[0] + 1));
    // Inside the lattice cell with room for its shell and adit (MARGIN), so it never
    // reaches a neighbouring cell: the sectors of that cell would not stamp it.
    const col = x + MARGIN + Math.floor(r() * Math.max(1, span - 2 * MARGIN - w));
    out.push({ kind, col, row, w, h, salt: mix32(salt ^ 0x51ed270b) });
  }
  return out;
}

/** Per stratum: the structure kinds and their odds (the rest: none). */
const STRUCTURE_TABLE: readonly (readonly [StructureKind | null, number][])[] = [
  [['ruin', .45]],
  [['waycache', .32], ['flooded-shaft', .2], ['maw-den', .26]],
  [['lake', .5], ['rift-shrine', .1]],
  [['lava-basin', .34], ['bailiff-hall', .3], ['rift-shrine', .1]],
];
/** A rift shrine rolled in the Magma Halls sits in their rows. */
const MAGMA_SHRINE_ROWS: readonly [number, number] = [42, 48];
/** Interior width range, interior height and the top row range of each kind (rows inside its stratum). */
const SIZE: Readonly<Record<StructureKind, { w: readonly [number, number]; h: number; row: readonly [number, number] }>> = {
  'ruin': { w: [9, 12], h: 3, row: [4, 7] },
  'waycache': { w: [6, 8], h: 3, row: [13, 21] },
  'flooded-shaft': { w: [3, 3], h: 9, row: [14, 15] },
  'maw-den': { w: [16, 22], h: 5, row: [13, 19] },
  'lake': { w: [14, 20], h: 6, row: [28, 32] },
  'rift-shrine': { w: [5, 5], h: 4, row: [29, 34] },
  'lava-basin': { w: [12, 16], h: 5, row: [42, 46] },
  'bailiff-hall': { w: [18, 24], h: 5, row: [42, 47] },
};

/** Stamp one planned structure's part inside this sector column. */
function stamp(b: Builder, plan: Plan, out: SectorColumnGen): void {
  const { col: x, row: y, w, h } = plan;
  const r = seededRandom(plan.salt);
  const notePool = (stratum: FieldNoteStratum) => fieldNotePool(stratum);
  const pickNote = (stratum: FieldNoteStratum): string | null => {
    const pool = notePool(stratum);
    return pool.length ? FIELD_NOTE_PREFIX + pool[Math.floor(r() * pool.length)] : null;
  };
  switch (plan.kind) {
    case 'ruin': {
      // An old Keepers' camp: a low room with trunk posts, a shadow-root knot overhead, a field note.
      b.rect(x - 1, y - 1, w + 2, 1, N.rootLoam);
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, N.rootLoam);
      b.rect(x - 1, y, 1, h, N.trunk); b.rect(x + w, y, 1, h, N.trunk);
      b.put(x + (w >> 1), y - 1, N.shadowRoot);
      b.put(x + w - 2, y + h, N.cinder); b.put(x + w - 3, y + h, N.cinder);
      const note = pickNote('root-hollows');
      if (note) b.note(x + 1 + Math.floor(r() * 2), y + 1, note);
      break;
    }
    case 'waycache': {
      // Kael's waycache: a hard-rock niche with his bundle of torches on the floor.
      b.rect(x - 1, y - 1, w + 2, 1, N.hardRock);
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, N.hardRock);
      b.put(x + w - 2, y + h - 1, N.waycache, true);
      b.dress(x + w, y + 1, N.emberRock);
      if (r() < .6) { const note = pickNote('basalt-caverns'); if (note) b.note(x + 1, y + 1, note); }
      break;
    }
    case 'flooded-shaft': {
      // One of Kael's mines, let go to the water: a shaft in hard rock, an adit at the top, a waycache drowned at the bottom.
      b.rect(x - 5, y - 2, 6, 3, AIR);
      b.rect(x, y - 2, w, h + 2, AIR);
      b.rect(x - 1, y + 1, 1, h, N.hardRock);
      b.rect(x + w, y - 2, 1, h + 3, N.hardRock);
      b.rect(x - 1, y + h, w + 2, 1, N.hardRock);
      b.put(x + 1, y + h - 1, N.waycache, true);
      b.liquid(x, y + 2, w, h - 2, LIQUID_WATER);
      break;
    }
    case 'maw-den': {
      // A Maw den: a long hall on a bedrock floor, rivets (ember-rock) in its walls.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, BEDROCK);
      for (let n = 0; n < 4; n++) b.dress(x + Math.floor(r() * w), y - 1, N.emberRock);
      b.dress(x - 1, y + 2, N.slag); b.dress(x + w, y + 1, N.slag);
      out.halls.push({ creature: 'rivet-maw', count: 2 + (r() < .5 ? 1 : 0), col0: x, col1: x + w, floorRow: y + h });
      break;
    }
    case 'lake': {
      // A grotto lake: a cavern over a grotto-stone basin, shores either side, glowcaps in the roof.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + 2, 1, h - 1, N.grottoStone); b.rect(x + w, y + 2, 1, h - 1, N.grottoStone);
      b.rect(x - 1, y + h, w + 2, 1, N.grottoStone);
      b.rect(x, y + h - 2, 2, 2, N.grottoStone); b.rect(x + w - 2, y + h - 2, 2, 2, N.grottoStone);
      b.liquid(x + 2, y + h - 2, w - 4, 2, LIQUID_WATER);
      for (let c = x + 2; c < x + w - 2; c += 3 + Math.floor(r() * 3)) b.put(c, y - 1, N.glowcap);
      const note = pickNote('glowcap-grotto');
      if (note) b.note(x + 1, y + 1, note);
      break;
    }
    case 'rift-shrine': {
      // A rift the fracture scattered: a small hard-rock chamber, open at both sides, the shrine on its floor.
      b.rect(x - 1, y - 1, w + 2, h + 2, N.hardRock);
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + 1, 1, h - 1, AIR); b.rect(x + w, y + 1, 1, h - 1, AIR);
      b.put(x + (w >> 1), y + h - 1, N.shrine, true);
      break;
    }
    case 'lava-basin': {
      // A lava basin: scorched-basalt walls round a single-row pool, shores to stand on.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + 2, 1, h - 1, N.scorched); b.rect(x + w, y + 2, 1, h - 1, N.scorched);
      b.rect(x - 1, y + h, w + 2, 1, N.scorched);
      b.rect(x, y + h - 1, 2, 1, N.scorched); b.rect(x + w - 2, y + h - 1, 2, 1, N.scorched);
      b.liquid(x + 2, y + h - 1, w - 4, 1, LIQUID_LAVA);
      break;
    }
    case 'bailiff-hall': {
      // A Bailiff hall: their work route, on a bedrock floor, heartstone in the roof.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, BEDROCK);
      const hc = x + 2 + Math.floor(r() * Math.max(1, w - 6));
      b.rect(hc, y - 2, 3, 2, N.heartstone);
      if (r() < .4) { const note = pickNote('magma-halls'); if (note) b.note(x + w - 2, y + 1, note); }
      out.halls.push({ creature: 'cinder-bailiff', count: 2, col0: x, col1: x + w, floorRow: y + h });
      break;
    }
  }
}

// ── The column ──────────────────────────────────────────────────────────────

/**
 * Generate sector column `sx` (rows 0..rows−1). Inside the core's columns the
 * core's own generated cells are copied as they are; everywhere else the
 * wing generator runs. Same (context, sx) → the same arrays, byte for byte.
 */
export function generateSectorColumn(ctx: SectorContext, sx: number): SectorColumnGen {
  const spec = ctx.spec, rows = spec.rows, n = SECTOR * rows, col0 = sx * SECTOR;
  const out: SectorColumnGen = {
    sx, gv: ctx.gv,
    kind: new Uint8Array(n), liqType: new Uint8Array(n), liqLevel: new Uint8Array(n), protect: new Uint8Array(n),
    notes: new Map(), halls: [], structures: [],
  };
  const core = (col: number) => isCoreCol(ctx, col);
  const bandNodes = spec.bands.map(band => nodeIndex(band.node));
  const bedrockFrom = rows - spec.bedrock;
  const t = ctx.core;
  const scratch = Array.from({ length: 9 }, () => new Float64Array(Math.max(rows, spec.bands.length)));
  const caches = Array.from({ length: 7 }, latticeCache);
  for (let lc = 0; lc < SECTOR; lc++) {
    const col = col0 + lc;
    if (core(col)) {
      for (let row = 0; row < rows; row++) {
        const i = row * SECTOR + lc, ci = t.index(col, row);
        out.kind[i] = t.kind[ci]; out.liqType[i] = t.liqType[ci]; out.liqLevel[i] = t.liqLevel[ci]; out.protect[i] = t.protect[ci];
        const id = t.inscriptions.get(ci);
        if (id) out.notes.set(i, id);
      }
      continue;
    }
    rockColumn(ctx, col, lc, out.kind, bandNodes, scratch, caches);
  }
  // Ore veins, per sector, clipped to it, into rock only.
  for (let sy = 0; sy * SECTOR < rows; sy++) veinsInto(ctx, out, sx, sy);
  // Structures from this column's lattice cell (they never leave it).
  const builder = new Builder(out, col0, rows, core);
  for (const plan of latticePlans(ctx, Math.floor(sx / LATTICE))) {
    if (plan.col + plan.w + 6 < col0 || plan.col - 6 >= col0 + SECTOR) continue;
    stamp(builder, plan, out);
    out.structures.push({ kind: plan.kind, col: plan.col, row: plan.row, w: plan.w, h: plan.h });
  }
  // A hall belongs to the column holding its first cell (it spawns once, not twice).
  out.halls = out.halls.filter(hall => hall.col0 >= col0 && hall.col0 < col0 + SECTOR);
  // The bedrock floor is the world's: nothing stamped above it ever reaches it, but say so.
  for (let lc = 0; lc < SECTOR; lc++) {
    if (core(col0 + lc)) continue;
    for (let row = bedrockFrom; row < rows; row++) { const i = row * SECTOR + lc; out.kind[i] = BEDROCK; out.liqType[i] = 0; out.liqLevel[i] = 0; }
  }
  return out;
}

/** Roll one sector's ore veins (§3.2 step 4): the core's vein specs, scaled to a sector's share of the core's width. */
function veinsInto(ctx: SectorContext, out: SectorColumnGen, sx: number, sy: number): void {
  const spec = ctx.spec, rows = spec.rows, col0 = sx * SECTOR;
  const r0 = sy * SECTOR, r1 = Math.min(rows - spec.bedrock, r0 + SECTOR);
  if (r1 <= r0) return;
  const random = seededRandom(sectorSeed(ctx.seed, sx, sy, ctx.gv));
  for (const vein of ctx.veins) {
    const from = Math.max(vein.from, r0), to = Math.min(vein.to, r1);
    // Roll even when the vein misses this sector, so the stream stays aligned.
    const expected = vein.count * (SECTOR / spec.cols) * Math.max(0, to - from) / Math.max(1, vein.to - vein.from);
    const roll = random();
    const count = Math.floor(expected) + (roll < expected - Math.floor(expected) ? 1 : 0);
    if (to <= from) continue;
    const node = nodeIndex(vein.node);
    for (let k = 0; k < count; k++) {
      let col = col0 + Math.floor(random() * SECTOR);
      let row = from + Math.floor(random() * (to - from));
      for (let s = 0; s < vein.size; s++) {
        if (col >= col0 && col < col0 + SECTOR && row >= from && row < to && !isCoreCol(ctx, col)) {
          const i = row * SECTOR + (col - col0);
          if (out.kind[i] !== AIR) out.kind[i] = node;
        }
        const step = Math.floor(random() * 4);
        col += step === 0 ? 1 : step === 1 ? -1 : 0;
        row += step === 2 ? 1 : step === 3 ? -1 : 0;
      }
    }
  }
}

/** A hash of a column's cells and liquids (golden tests, and a cheap "same column?" check). FNV-1a. */
export function columnHash(gen: Pick<SectorColumnGen, 'kind' | 'liqType' | 'liqLevel'>): number {
  let h = 0x811c9dc5;
  for (const array of [gen.kind, gen.liqType, gen.liqLevel]) for (let i = 0; i < array.length; i++) h = Math.imul(h ^ array[i], 0x01000193) >>> 0;
  return h >>> 0;
}

/** Every node id the generator can lay (the meaning check reads this). */
export const SECTOR_NODES: readonly string[] = ['root-loam', 'petrified-trunk', 'shadow-root', 'cinder-vein', 'hard-rock', 'ember-rock', 'waycache', 'slag-vein',
  'grotto-stone', 'glowcap', 'rift-shrine', 'scorched-basalt', 'heartstone-vein', 'bedrock', 'inscription'];
