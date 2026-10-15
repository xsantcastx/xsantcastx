/**
 * surface-gen.ts — One World's sky band: the surface above a world's ground
 * line (docs/design/one-world.md §2.1–§2.3, §2.7). Pure: no DOM, no Angular;
 * the node harness (scripts/one-world.test.cjs) pins it.
 *
 * Every world keeps its underground exactly as it is (rows ≥ 0 are the Delve's,
 * byte for byte) and gains rows `rowLo`…−1 above it. This module fills them, one
 * sector column at a time, the way sector-gen.ts fills the rock below:
 *
 *   - the authored span (`flat`): the ground is exactly `ground`, and the
 *     settlement's buildings are stamped from blueprints.ts, with the basin's
 *     water laid into the open cells between its rims;
 *   - the wilds east and west of it, forever: a ground line that wanders up to
 *     six rows above `ground` (hills of dirt), never below it (that would cut
 *     into the Delve's rows), boulders now and then, and a wild Waystone every
 *     eight sectors from ±12 outward, on a flattened shoulder.
 *
 * Integer hashing only (gen-kit.ts), so a world column is the same on every
 * device. Wild stone columns hash from the WORLD's salt, not the player's seed:
 * "the third stone east" is the same place for everyone.
 *
 * `regionAt` names where a cell is (the settlement, a region, the wilds, the
 * underground): the HUD's place name, presence, sound beds, Glim's area visits.
 */
import { LIQUID_FULL, LIQUID_LAVA, LIQUID_WATER, nodeIndex, type BiomeDef, type LiquidStamp } from './terrain';
import { lattice, mix32, SECTOR, smooth } from './gen-kit';
import { blueprintCell, blueprintMarks, BLUEPRINTS, BACK_NONE, type BlueprintKind, type BlueprintMarks, type RealmPalette } from './blueprints';

/** The five worlds (docs/design/one-world.md, the table at the top). */
export type WorldId = 'ember' | 'ink' | 'root' | 'prism' | 'orrery';

/** A building placed on a world's surface: its blueprint, its left column, and the station it houses. */
export interface SurfaceBuilding {
  kind: BlueprintKind;
  /** Left column of the blueprint. Its bottom row stands on the ground (row `ground` − 1). */
  col: number;
  /** The station whose counter it is (its keeper stands there), if any. */
  station?: string;
}

/** A Waystone's kind: the trunk line's town stones, a region's far stone, the wild ones (§3.1). */
export type StoneKind = 'town' | 'region' | 'wild' | 'deep';
export interface StoneDef {
  /** `<world>:<name>` for authored stones, `<world>:ws:<sx>` for wild ones. */
  id: string;
  kind: StoneKind;
  world: WorldId;
  /** The column it stands in, and the row its foot stands on (feet at the top of `row`). */
  col: number;
  row: number;
  /** Always lit: the five town stones are Sera's trunk line (owner decision, 2026-10-15). */
  trunk?: true;
}

/** A named stretch of a world's surface, by sector columns [sx0, sx1]. */
export interface SurfaceRegion { id: string; name: string; sx0: number; sx1: number }

export interface SurfaceSpec {
  world: WorldId;
  /** First row of the sky band (a negative multiple of 8). */
  rowLo: number;
  /** The ground row: its top edge is the street the Keeper walks on. Ember: 0 (the Delve's surface). */
  ground: number;
  /** The world spec's salt: the wild stones and the hills hash from it (never from a player's seed). */
  salt: number;
  palette: RealmPalette;
  /** The authored span [col0, col1): flat ground, buildings, the stones the world names. */
  flat: readonly [number, number];
  buildings: readonly SurfaceBuilding[];
  /** Water in the basin (rows < ground), laid into open cells only. */
  liquids?: readonly LiquidStamp[];
  /** The world's own stones (the town stone, the region stone). Wild stones are generated. */
  stones: readonly StoneDef[];
  regions: readonly SurfaceRegion[];
  /** What the wilds east and west of the authored span are called. */
  wilds: { id: string; name: string };
  /** What everything under the ground is called (the Delve's name). */
  underground: { id: string; name: string };
  /** The sky band's look: top faces, the back wall of a dug hill, the motes. */
  biome: BiomeDef;
  /** The settlement's square (cols): its town stone, the Hearth fire the keepers gather at, the benches. */
  square?: { stone: number; hearth: number; benches: readonly number[] };
}

/** One sector column's sky band: SECTOR × (−rowLo) cells, row-major from `rowLo` (local index (row − rowLo) × 32 + lc). */
export interface SurfaceColumn {
  kind: Uint8Array;
  back: Uint8Array;
  protect: Uint8Array;
  liqType: Uint8Array;
  liqLevel: Uint8Array;
}

const DIRT = nodeIndex('dirt'), ROCK = nodeIndex('rock');
/** The wilds' hills rise at most this many rows over the ground (§2.2: −6…0). */
export const HILL_MAX = 6;
/** Cells either side of a wild stone kept flat, so it stands on level ground. */
const STONE_SHOULDER = 3;
/** Cells over which the hills ease in from the authored span's flat ground. */
const HILL_EASE = 16;

/** A wild stone in sector column `sx`, or null (§3.1: sx ≡ 4 mod 8, |sx| ≥ 12). Pure. */
export function wildStoneAt(spec: Pick<SurfaceSpec, 'world' | 'salt'>, sx: number): { col: number; id: string } | null {
  if (Math.abs(sx) < 12 || ((sx % 8) + 8) % 8 !== 4) return null;
  const col = sx * SECTOR + 6 + (mix32(spec.salt ^ Math.imul(sx, 0x2c1b3c6d)) % 20);
  return { col, id: `${spec.world}:ws:${sx}` };
}

/** Every stone in sector columns [sx0, sx1]: the world's own, then the wild ones, west to east. Pure. */
export function stonesIn(spec: SurfaceSpec, sx0: number, sx1: number): StoneDef[] {
  const out: StoneDef[] = spec.stones.filter(s => s.col >= sx0 * SECTOR && s.col < (sx1 + 1) * SECTOR);
  for (let sx = sx0; sx <= sx1; sx++) {
    const wild = wildStoneAt(spec, sx);
    if (wild) out.push({ id: wild.id, kind: 'wild', world: spec.world, col: wild.col, row: groundAt(spec, wild.col) });
  }
  return out.sort((a, b) => a.col - b.col);
}

/** The ground row at a world column: `ground` across the authored span, hills in the wilds. Pure. */
export function groundAt(spec: Pick<SurfaceSpec, 'ground' | 'flat' | 'salt' | 'world'>, col: number): number {
  const [f0, f1] = spec.flat;
  if (col >= f0 && col < f1) return spec.ground;
  // A wild stone's shoulder: the ground there is the stone's own column's.
  const sx = Math.floor(col / SECTOR);
  const wild = wildStoneAt(spec, sx);
  if (wild && Math.abs(col - wild.col) <= STONE_SHOULDER) col = wild.col;
  const d = col < f0 ? f0 - col : col - f1 + 1;
  const ease = smooth(Math.min(1, d / HILL_EASE));
  // Two octaves of 1-D value noise, then eased in from the flat span.
  const n = .7 * noise1(spec.salt, col / 14) + .3 * noise1(spec.salt ^ 0x5bd1e995, col / 5);
  const rise = Math.round(n * HILL_MAX * ease);
  return spec.ground - Math.max(0, Math.min(HILL_MAX, rise));
}

function noise1(salt: number, x: number): number {
  const ix = Math.floor(x), s = smooth(x - ix);
  const a = lattice(salt, ix, 0), b = lattice(salt, ix + 1, 0);
  return a + (b - a) * s;
}

/** A boulder (two rock cells on the ground) at this wild column? Pure. */
function boulderAt(spec: SurfaceSpec, col: number): boolean {
  const [f0, f1] = spec.flat;
  if (col >= f0 - 4 && col < f1 + 4) return false;
  const sx = Math.floor(col / SECTOR), wild = wildStoneAt(spec, sx);
  if (wild && Math.abs(col - wild.col) <= STONE_SHOULDER + 2) return false;
  return mix32(spec.salt ^ Math.imul(col, 0x45d9f3b)) % 29 === 0;
}

/**
 * The sky band of sector column `sx`. The same (spec, sx) always gives the
 * same cells. Rows ≥ 0 are never touched: they are the Delve's. Pure.
 */
export function surfaceColumn(spec: SurfaceSpec, sx: number): SurfaceColumn {
  const sky = -spec.rowLo, n = SECTOR * sky, col0 = sx * SECTOR;
  const out: SurfaceColumn = {
    kind: new Uint8Array(n), back: new Uint8Array(n), protect: new Uint8Array(n), liqType: new Uint8Array(n), liqLevel: new Uint8Array(n),
  };
  const at = (row: number, lc: number) => (row - spec.rowLo) * SECTOR + lc;
  // The ground: hills of dirt from the ground line up (never into the Delve's rows).
  for (let lc = 0; lc < SECTOR; lc++) {
    const col = col0 + lc, g = groundAt(spec, col);
    for (let row = Math.max(spec.rowLo, g); row < Math.min(0, spec.ground); row++) out.kind[at(row, lc)] = DIRT;
    // The realm worlds (P3): their ground sits at −8, topsoil to the seal. Ember's ground is row 0 itself.
    if (boulderAt(spec, col) && g - 1 >= spec.rowLo) {
      out.kind[at(g - 1, lc)] = ROCK;
      if (mix32(spec.salt ^ col) % 3 === 0 && g - 2 >= spec.rowLo) out.kind[at(g - 2, lc)] = ROCK;
    }
  }
  // The buildings, stamped last (they win), protected: the town keeps its walls.
  for (const b of spec.buildings) {
    const rows = BLUEPRINTS[b.kind], w = rows[0].length, h = rows.length;
    if (b.col + w <= col0 || b.col >= col0 + SECTOR) continue;
    const top = spec.ground - h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = b.col + x, row = top + y;
      if (col < col0 || col >= col0 + SECTOR || row < spec.rowLo || row >= 0) continue;
      const cell = blueprintCell(rows[y][x], spec.palette);
      if (!cell) continue;
      const i = at(row, col - col0);
      out.kind[i] = cell.node ? nodeIndex(cell.node) : 0;
      out.back[i] = cell.back;
      out.protect[i] = 1;
    }
  }
  // The basin's water: open cells only, settled as laid.
  for (const pool of spec.liquids ?? []) {
    const type = pool.liquid === 'lava' ? LIQUID_LAVA : LIQUID_WATER;
    const level = Math.max(1, Math.min(LIQUID_FULL, Math.round(pool.level ?? LIQUID_FULL)));
    for (let r = pool.row; r < pool.row + (pool.h ?? 1); r++) for (let c = pool.col; c < pool.col + (pool.w ?? 1); c++) {
      if (c < col0 || c >= col0 + SECTOR || r < spec.rowLo || r >= 0) continue;
      const i = at(r, c - col0);
      if (out.kind[i] !== 0) continue;
      out.liqType[i] = type; out.liqLevel[i] = level;
    }
  }
  return out;
}

/** A building's footprint and dressing marks in world cells. */
export interface PlacedBuilding extends SurfaceBuilding { top: number; marks: BlueprintMarks }

/** Every building in world columns [c0, c1) with its world top row and marks. Pure. */
export function buildingsIn(spec: SurfaceSpec, c0: number, c1: number): PlacedBuilding[] {
  return spec.buildings.filter(b => b.col < c1 && b.col + BLUEPRINTS[b.kind][0].length > c0)
    .map(b => ({ ...b, top: spec.ground - BLUEPRINTS[b.kind].length, marks: blueprintMarks(b.kind) }));
}

/** The world column of a building's counter (its station's x is that column's centre), or null. */
export function counterCol(b: SurfaceBuilding): number | null {
  const m = blueprintMarks(b.kind);
  return m.counter ? b.col + m.counter.x : null;
}

/** Where a cell is: the region's id and name (the underground's below the ground line). Pure. */
export function regionAt(spec: SurfaceSpec, col: number, row: number): { id: string; name: string } {
  if (row >= spec.ground) return spec.underground;
  const sx = Math.floor(col / SECTOR);
  for (const region of spec.regions) if (sx >= region.sx0 && sx <= region.sx1) return { id: region.id, name: region.name };
  return spec.wilds;
}

export { BACK_NONE };
