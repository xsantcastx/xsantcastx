/**
 * gen-kit.ts — what every sector generator shares (the shipped strata in
 * sector-gen.ts, the Underhearth in underhearth-gen.ts): integer hashing,
 * value noise that is the same on every device, and the Builder that writes
 * a structure into one sector column, clipped to it. Pure: no DOM, no Angular.
 *
 * Moved out of sector-gen.ts unchanged (Phase 8) so a deeper stratum can use
 * them without an import cycle; sector-gen.ts re-exports the public ones.
 */
import { LIQUID_FULL, nodeIndex } from './terrain';

/** Sector edge in cells (§3.1). */
export const SECTOR = 32;
/** Generator version: saved with every sector diff. */
export const SECTOR_GV = 1;
/** Structures: one lattice cell is this many sector columns wide (64 cells). */
export const LATTICE = 2;

export const AIR = 0;
export const BEDROCK = nodeIndex('bedrock');
export const INSCRIPTION = nodeIndex('inscription');

// ── Hashing and noise (integers in, deterministic doubles out) ──────────────

/** murmur3's finaliser on int32s (kept in small-integer range: no heap numbers in the hot loop). */
export function mixi(x: number): number {
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
export function lattice(salt: number, x: number, y: number): number {
  return (mixi(salt ^ mixi(Math.imul(x, 0x9E3779B1) ^ mixi(Math.imul(y, 0x85EBCA77) + 0x632BE5AB))) >>> 0) * 2.3283064365386963e-10;
}
export const smooth = (f: number) => f * f * (3 - 2 * f);

/** 2-D value noise in [0, 1): smooth between hashed lattice values. */
export function valueNoise(salt: number, x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  const a = lattice(salt, ix, iy), b = lattice(salt, ix + 1, iy);
  const c = lattice(salt, ix, iy + 1), d = lattice(salt, ix + 1, iy + 1);
  const top = a + (b - a) * sx, bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

/** Two lattice columns kept between calls of `noiseColumn` (one per noise field). */
export interface LatticeCache { salt: number; ix: number; left: Float64Array; right: Float64Array }
export function latticeCache(): LatticeCache { return { salt: NaN, ix: NaN, left: new Float64Array(0), right: new Float64Array(0) }; }

/**
 * `valueNoise(salt, x, (row0 + row) / scaleY)` for `rows` rows of one column,
 * into `out`: the same numbers, with the lattice hashed once per lattice row
 * instead of once per cell (a column is generated in well under a millisecond).
 * `row0` lets a deeper stratum sample its own rows of the same field.
 */
export function noiseColumn(salt: number, x: number, scaleY: number, rows: number, out: Float64Array, cache?: LatticeCache, row0 = 0): Float64Array {
  const ix = Math.floor(x), sx = smooth(x - ix);
  const span = Math.floor((row0 + rows - 1) / scaleY) + 2;
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
    const y = (row0 + row) / scaleY, iy = Math.floor(y);
    const a = left[iy], b = right[iy], c = left[iy + 1], d = right[iy + 1];
    const top = a + (b - a) * sx, bottom = c + (d - c) * sx;
    out[row] = top + (bottom - top) * smooth(y - iy);
  }
  return out;
}

/** 1-D value noise in [0, 1). */
export function valueNoise1(salt: number, x: number): number {
  const ix = Math.floor(x), s = smooth(x - ix);
  const a = lattice(salt, ix, 0), b = lattice(salt, ix + 1, 0);
  return a + (b - a) * s;
}

// ── What a sector column holds ──────────────────────────────────────────────

/** A hall's creatures (they live in its flat-floored cavern, like the core's Maws). */
export interface SectorHall { creature: string; count: number; col0: number; col1: number; floorRow: number }
export type StructureKind = 'ruin' | 'waycache' | 'flooded-shaft' | 'maw-den' | 'lake' | 'rift-shrine' | 'lava-basin' | 'bailiff-hall'
  // The Underhearth (Phase 8).
  | 'outpost' | 'hearth-lake' | 'sentinel-hall' | 'ember-den' | 'rail-gallery' | 'banked-door' | 'furnace-hall'
  // The Rift Gates (rift-gates.model.ts), and the Umbral's underside (realm-gen.ts).
  | 'rift-gate' | 'gate-hollow' | 'warden-hall' | 'ink-pool' | 'drift-pocket' | 'mirror-cavern' | 'shade-den';
/** A structure as the map and the meaning check see it: its kind and its top-left cell. */
export interface SectorStructure { kind: StructureKind; col: number; row: number; w: number; h: number }

/**
 * One generated sector column: SECTOR cells wide, the world's rows tall.
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

/** Writes into one sector column, clipped to it (and kept off the cells `skip` names: the core). */
export class Builder {
  constructor(private readonly out: SectorColumnGen, private readonly col0: number, private readonly rows: number, private readonly skip: (col: number, row: number) => boolean) {}
  private at(col: number, row: number): number {
    if (row < 0 || row >= this.rows || col < this.col0 || col >= this.col0 + SECTOR || this.skip(col, row)) return -1;
    return row * SECTOR + (col - this.col0);
  }
  /** The node a cell holds now, or -1 outside this column. */
  get(col: number, row: number): number {
    const i = this.at(col, row);
    return i < 0 ? -1 : this.out.kind[i];
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
  /** A wall feature that carries an id like a carving (a hammer-mark: `mark:<n>`). */
  markCell(col: number, row: number, node: number, id: string): void {
    const i = this.at(col, row);
    if (i < 0) return;
    this.out.kind[i] = node; this.out.liqType[i] = 0; this.out.liqLevel[i] = 0;
    this.out.protect[i] = 1;
    this.out.notes.set(i, id);
  }
  /** Solid cells only: dress a wall without filling the room. */
  dress(col: number, row: number, node: number): void {
    const i = this.at(col, row);
    if (i >= 0 && this.out.kind[i] !== AIR && this.out.kind[i] !== INSCRIPTION) this.out.kind[i] = node;
  }
}
