/**
 * realm-kit.ts — what every realm Delve's generator shares (realm-gen.ts lays
 * the Umbral's; verdant-gen.ts and luminous-gen.ts the Verdant's and the
 * Luminous's). Pure: no DOM, no Angular.
 *
 * The same rules as the Ember Delve's wings (sector-gen.ts): integer hashing
 * and + − × ÷ only, caves from noise of the WORLD cell (no seam at a sector
 * border), veins rolled per sector and clipped, structures from their lattice
 * cell's own seed and never outside it, so any sector column is the same bytes
 * on any device, in any order. Lattice cell 0 (world columns 0..63) is each
 * realm's hand-laid core: the Gate Hollow where the return gate stands (the
 * same cells in every realm, so stepping through lands the same way), and
 * under it the realm's guardian's hall.
 *
 *   rows 0–1     the realm's floor above, seen from under it (bedrock)
 *   rows 2–~30   the shallow band (its rock, winding tunnels)
 *   rows ~31–61  the deep band (its rock, broad caverns)
 *   rows 62–63   bedrock
 */
import { seededRandom, type TerrainSpec } from './terrain';
import {
  AIR, BEDROCK, Builder, LATTICE, latticeCache, mix32, noiseColumn, SECTOR, sectorSeed, valueNoise1,
  type LatticeCache, type SectorColumnGen, type StructureKind,
} from './gen-kit';

/** What a realm generator reads of a Delve's sector context. */
export interface RealmContext {
  spec: Pick<TerrainSpec, 'cols' | 'rows' | 'realm'>;
  seed: number;
  gv: number;
  rows: number;
}
export interface RealmPlan { kind: StructureKind; col: number; row: number; w: number; h: number; salt: number }

export const CEILING = 2;
/** Cells a structure keeps from its lattice cell's sides (its shell and its entries). */
export const MARGIN = 6;

// ── The core every realm shares (the same cells as the Ink Deeps' Gate Hollow) ──

/** The Gate Hollow: interior rows 24..30; its floor is row 31. */
export const CORE_HOLLOW = { col: 16, row: 24, w: 32, h: 7 } as const;
/** The return gate's opening (2 × 3), on the hollow's floor. */
export const CORE_GATE = { col: 31, row: 28, w: 2, h: 3 } as const;
/** The ore outcrop east of the arrival: three cells, floor to head height (the first swing finds ore). */
export const CORE_SEAM = { col: 39, row: 28, h: 3 } as const;
/** The guardian's hall under the hollow (interior rows 44..53; its floor is row 54). */
export const CORE_HALL = { col: 6, row: 44, w: 52, h: 10 } as const;
/** The shaft from the west tunnel down to the hall: one column, rows 31..43. */
export const CORE_SHAFT = { col: 10, row: 31, h: 13 } as const;

/**
 * The Gate Hollow in a realm's own rock: the hall, tunnels east and west at
 * floor level, the return gate on a frame of rift stone, the ore outcrop.
 * The realm stamps its own features over it afterwards.
 */
export function stampCoreHollow(b: Builder, rock: number, gate: number, frame: number, ore: number): void {
  const G = CORE_HOLLOW, R = CORE_GATE;
  b.rect(G.col - 1, G.row - 1, G.w + 2, 1, rock);
  b.rect(G.col, G.row, G.w, G.h, AIR);
  b.rect(G.col - 1, G.row + G.h, G.w + 2, 1, rock);
  b.rect(0, R.row, G.col, 3, AIR); b.rect(G.col + G.w, R.row, 64 - G.col - G.w, 3, AIR);
  b.rect(0, R.row - 1, G.col, 1, rock); b.rect(0, R.row + 3, G.col, 1, rock);
  b.rect(G.col + G.w, R.row - 1, 64 - G.col - G.w, 1, rock); b.rect(G.col + G.w, R.row + 3, 64 - G.col - G.w, 1, rock);
  for (let dc = -1; dc <= R.w; dc++) b.put(R.col + dc, R.row - 1, frame, true);
  for (let dr = 0; dr < R.h; dr++) for (let dc = 0; dc < R.w; dc++) b.put(R.col + dc, R.row + dr, gate, true);
  for (let dc = -2; dc < R.w + 2; dc++) b.put(R.col + dc, G.row + G.h, frame, true);
  for (let r = CORE_SEAM.row; r < CORE_SEAM.row + CORE_SEAM.h; r++) b.put(CORE_SEAM.col, r, ore);
}

/** The guardian's hall: open, walls of `rock`, an unbreakable floor of rift stone. */
export function stampCoreHall(b: Builder, rock: number, frame: number): void {
  const H = CORE_HALL;
  b.rect(H.col, H.row - 1, H.w, 1, rock);
  b.rect(H.col, H.row, H.w, H.h, AIR);
  b.rect(H.col - 1, H.row + H.h, H.w + 2, 1, frame);
  b.rect(H.col - 1, H.row, 1, H.h, rock); b.rect(H.col + H.w, H.row, 1, H.h, rock);
}

// ── Structures ──────────────────────────────────────────────────────────────

export interface PlanTable {
  /** Per band: its row range and the kinds it may roll (weights sum ≤ 1; the rest is nothing). */
  bands: readonly { rows: readonly [number, number]; table: readonly [StructureKind, number][] }[];
  sizes: Readonly<Partial<Record<StructureKind, { w: readonly [number, number]; h: number }>>>;
  salt: number;
}

/** The structures of lattice cell `cell` outside the core: one per band at most, from the cell's own seed. Pure. */
export function rollPlans(ctx: RealmContext, cell: number, def: PlanTable): RealmPlan[] {
  const span = LATTICE * SECTOR, x = cell * span;
  const out: RealmPlan[] = [];
  const salt0 = mix32((ctx.seed ^ mix32(Math.imul(cell, 0x632BE5AB)) ^ def.salt ^ Math.imul(ctx.gv, 0x27d4eb2f)) >>> 0);
  def.bands.forEach((band, n) => {
    const salt = mix32((salt0 ^ Math.imul(n + 1, 0x85EBCA77)) >>> 0);
    const r = seededRandom(salt);
    const roll = r();
    let kind: StructureKind | null = null, acc = 0;
    for (const [k, weight] of band.table) { acc += weight; if (roll < acc) { kind = k; break; } }
    if (!kind) return;
    const size = def.sizes[kind]!;
    const w = size.w[0] + Math.floor(r() * (size.w[1] - size.w[0] + 1));
    const [lo, hi] = band.rows;
    const row = lo + Math.floor(r() * Math.max(1, hi - lo - size.h + 1));
    const col = x + MARGIN + Math.floor(r() * Math.max(1, span - 2 * MARGIN - w));
    out.push({ kind, col, row, w, h: size.h, salt: mix32(salt ^ 0x51ed270b) });
  });
  return out;
}
/** True when lattice cell `cell` is the realm's core (world columns 0..63). */
export function isRealmCore(ctx: RealmContext, cell: number): boolean {
  const span = LATTICE * SECTOR, x = cell * span;
  return x < ctx.spec.cols && x + span > 0;
}

// ── The column ──────────────────────────────────────────────────────────────

export interface VeinDef { node: number; from: number; to: number; count: number; size: number }
export interface RealmDef {
  /** Noise salt: each realm's caves are its own. */
  salt: number;
  shallow: number; deep: number;
  /** Where the deep band begins (the edge wanders ±3). */
  edge: number;
  /** Shallow caves: the band width of the winding tunnels (wider = more open). */
  tunnel: number;
  /** Deep caverns: the threshold (lower = more open). */
  cavern: number;
  veins: readonly VeinDef[];
  plans(ctx: RealmContext, cell: number): RealmPlan[];
  stamp(b: Builder, plan: RealmPlan, out: SectorColumnGen, deep: boolean): void;
  /** After the structures: the realm's own dressing (vines, blooms), deterministic per cell. */
  dress?(ctx: RealmContext, out: SectorColumnGen, col0: number, floor: number): void;
}

const scratch = Array.from({ length: 4 }, () => new Float64Array(64));
const caches: LatticeCache[] = Array.from({ length: 4 }, latticeCache);

/** Generate sector column `sx` of a realm Delve (all rows) from its definition. Same (context, sx) → the same arrays. */
export function bandedColumn(ctx: RealmContext, sx: number, def: RealmDef): SectorColumnGen {
  const rows = ctx.rows, n = SECTOR * rows, col0 = sx * SECTOR, s = (ctx.seed ^ def.salt) >>> 0;
  const out: SectorColumnGen = {
    sx, gv: ctx.gv,
    kind: new Uint8Array(n), liqType: new Uint8Array(n), liqLevel: new Uint8Array(n), protect: new Uint8Array(n),
    notes: new Map(), halls: [], structures: [],
  };
  if (scratch[0].length < rows) for (let k = 0; k < scratch.length; k++) scratch[k] = new Float64Array(rows);
  const floor = rows - 2;
  for (let lc = 0; lc < SECTOR; lc++) {
    const col = col0 + lc;
    const wind = noiseColumn(s ^ 0x13579bdf, col / 10, 4.5, rows, scratch[0], caches[0]);
    const blob = noiseColumn(s ^ 0x2468ace0, col / 16, 7, rows, scratch[1], caches[1]);
    const deepA = noiseColumn(s ^ 0x0badf00d, col / 18, 6, rows, scratch[2], caches[2]);
    const deepB = noiseColumn(s ^ 0x5eedc0de, col / 7, 3, rows, scratch[3], caches[3]);
    const edge = def.edge + Math.round((valueNoise1(s ^ 0x7a3c1e55, col / 9) * 2 - 1) * 3);
    for (let row = 0; row < rows; row++) {
      const i = row * SECTOR + lc;
      if (row < CEILING || row >= floor) { out.kind[i] = BEDROCK; continue; }
      let cave = false;
      if (row >= CEILING + 2 && row < floor - 1) {
        cave = row < edge
          ? Math.abs(wind[row] - .5) < def.tunnel + Math.max(0, blob[row] - .62) * .5
          : .6 * deepA[row] + .4 * deepB[row] > def.cavern;
      }
      out.kind[i] = cave ? AIR : row < edge ? def.shallow : def.deep;
    }
  }
  for (let sy = 0; sy * SECTOR < rows; sy++) veins(ctx, out, sx, sy, floor, def.veins, def.salt);
  const builder = new Builder(out, col0, rows, () => false);
  for (const plan of def.plans(ctx, Math.floor(sx / LATTICE))) {
    if (plan.col + plan.w + MARGIN < col0 || plan.col - MARGIN >= col0 + SECTOR) continue;
    def.stamp(builder, plan, out, plan.row >= def.edge);
    out.structures.push({ kind: plan.kind, col: plan.col, row: plan.row, w: plan.w, h: plan.h });
  }
  def.dress?.(ctx, out, col0, floor);
  out.halls = out.halls.filter(hall => hall.col0 >= col0 && hall.col0 < col0 + SECTOR);
  for (let lc = 0; lc < SECTOR; lc++) for (let row = 0; row < rows; row++) {
    if (row >= CEILING && row < floor) continue;
    const i = row * SECTOR + lc;
    out.kind[i] = BEDROCK; out.liqType[i] = 0; out.liqLevel[i] = 0; out.notes.delete(i);
  }
  return out;
}

function veins(ctx: RealmContext, out: SectorColumnGen, sx: number, sy: number, floor: number, list: readonly VeinDef[], salt: number): void {
  const col0 = sx * SECTOR;
  const r0 = Math.max(CEILING + 1, sy * SECTOR), r1 = Math.min(floor, (sy + 1) * SECTOR);
  if (r1 <= r0) return;
  const random = seededRandom(mix32((sectorSeed(ctx.seed, sx, sy, ctx.gv) ^ 0x3b9aca07 ^ salt) >>> 0));
  for (const vein of list) {
    const from = Math.max(vein.from, r0), to = Math.min(vein.to, r1);
    const expected = vein.count * Math.max(0, to - from) / (vein.to - vein.from);
    const roll = random();
    const count = Math.floor(expected) + (roll < expected - Math.floor(expected) ? 1 : 0);
    if (to <= from) continue;
    for (let k = 0; k < count; k++) {
      let col = col0 + Math.floor(random() * SECTOR);
      let row = from + Math.floor(random() * (to - from));
      for (let step = 0; step < vein.size; step++) {
        if (col >= col0 && col < col0 + SECTOR && row >= from && row < to) {
          const i = row * SECTOR + (col - col0);
          if (out.kind[i] !== AIR) out.kind[i] = vein.node;
        }
        const d = Math.floor(random() * 4);
        col += d === 0 ? 1 : d === 1 ? -1 : 0;
        row += d === 2 ? 1 : d === 3 ? -1 : 0;
      }
    }
  }
}

/** A stable hash of a world cell under a seed (dressing: which roof grows a vine). */
export function cellRoll(seed: number, col: number, row: number, salt: number): number {
  return mix32((seed ^ Math.imul(col, 0x27d4eb2f) ^ Math.imul(row + 1, 0x165667b1) ^ salt) >>> 0) / 4294967296;
}

