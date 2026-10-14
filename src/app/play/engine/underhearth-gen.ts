/**
 * underhearth-gen.ts — the Underhearth, the first stratum below the Magma
 * Halls (Phase 8; docs/world/delve-and-beyond.md §2.2, §3.2, §3.6, §9 Phase 8;
 * lore: lore-addendum.md, "The Four Who Went Down"). Pure: no DOM, no Angular.
 *
 * "The Infernal realm's oldest furnace. Its ceiling was held up by ironwood
 * pillars until Cindergnaw felled them; the Magma Halls' floor is that fallen
 * ceiling. Below it, heat has been under pressure so long it has turned into
 * something else."
 *
 * The world's rows from `spec.rows` (56) to `depth.rows − 3` (117) are this
 * stratum, under every column (the core's too); rows 118–119 are the world's
 * floor until the Breach opens (Phase 9). The same rules as the shipped wings
 * (sector-gen.ts): integer hashing and + − × ÷ only, caves from noise of the
 * WORLD cell (no seams at sector borders), veins rolled per sector and
 * clipped, structures from a lattice cell's own seed and never outside it.
 * The rows above are never touched, but for the Banked seal: the one way down,
 * cut through the fragment chamber's floor (rows 51–55 at cols 99–100).
 *
 *   rows 56–57   the fallen roof (rock, always)
 *   rows 58–85   iron-black basalt: vertical shafts, Kael's old rail
 *                galleries, Rivet Maws at the top, Ironwood Sentinels
 *   rows 86–117  banked obsidian: broad chambers, lava lakes with obsidian
 *                shores, Banked Embers, the furnace's slag
 *
 * Under the core it is hand-laid: the Banked Door (the landing under the
 * seal), Kael's rail down to the Furnace Hall (on trestles through the open
 * hall, a long momentum ride), the Banked Furnace with its four vents, and
 * the Four's quench trough. The Four's four outposts (each with one
 * hammer-mark) sit in fixed lattice cells two and three to each side, so
 * every seed has them within six sectors of the shaft.
 */
import { FIELD_NOTE_PREFIX, fieldNotePool } from '../../shared/delve/field-notes.model';
import { LIQUID_LAVA, LIQUID_WATER, nodeIndex, seededRandom, type TerrainSpec } from './terrain';
import {
  AIR, BEDROCK, Builder, LATTICE, latticeCache, mix32, noiseColumn, SECTOR, sectorSeed, valueNoise1,
  type LatticeCache, type SectorColumnGen, type StructureKind,
} from './gen-kit';

/** What the deep generator reads of a Delve's sector context. */
export interface DeepContext {
  spec: Pick<TerrainSpec, 'cols' | 'rows'>;
  seed: number;
  gv: number;
  /** The world's rows (down to and including the floor). */
  rows: number;
}

const K = {
  iron: nodeIndex('iron-basalt'), obsidianBand: nodeIndex('banked-obsidian'), obsidian: nodeIndex('obsidian'),
  pillar: nodeIndex('ironwood-pillar'), heart: nodeIndex('ironwood-heart'), ember: nodeIndex('emberheart-vein'),
  pyrite: nodeIndex('pyrite-seam'), coal: nodeIndex('cold-coal'), slag: nodeIndex('furnace-slag'),
  seam: nodeIndex('fracture-seam'), seal: nodeIndex('hearth-seal'), brick: nodeIndex('hearth-brick'),
  vent: nodeIndex('furnace-vent'), hearth: nodeIndex('furnace-hearth'), mark: nodeIndex('hammer-mark'),
  rail: nodeIndex('old-rail'), cache: nodeIndex('hearth-cache'), shrine: nodeIndex('rift-shrine'), slagVein: nodeIndex('slag-vein'),
  emberRock: nodeIndex('ember-rock'),
};

/** Every node this generator lays (the meaning check reads it through SECTOR_NODES). */
export function deepNodes(): string[] {
  return ['iron-basalt', 'banked-obsidian', 'obsidian', 'ironwood-pillar', 'ironwood-heart', 'emberheart-vein', 'pyrite-seam', 'cold-coal',
    'furnace-slag', 'fracture-seam', 'hearth-seal', 'hearth-brick', 'furnace-vent', 'furnace-hearth', 'hammer-mark', 'old-rail', 'hearth-cache'];
}

// ── The hand-laid set piece under the core (world cells; every seed) ────────

/** The Banked seal: cut through the fragment chamber's floor, the only way down. */
export const SEAL = { col: 99, row: 51, w: 2, h: 5 } as const;
/** The Banked Door: the landing hall under the seal. */
export const LANDING = { col: 86, row: 60, w: 25, h: 5 } as const;
/** The Furnace Hall: the oldest furnace's chamber (its floor is row `row + h`). */
export const FURNACE_HALL = { col: 24, row: 82, w: 61, h: 28 } as const;
/**
 * The Banked Furnace: its mouth's centre column (where it stands), its body
 * and the open mouth between its legs, its four vents on the hall floor and
 * the Four's quench trough at the hall's west end (water for the vents).
 */
export const FURNACE = {
  col: 68, floorRow: 110,
  body: { col: 63, row: 96, w: 11, h: 9 },
  mouth: { col: 65, row: 105, w: 7, h: 5 },
  vents: [53, 58, 78, 82] as readonly number[],
  trough: { col: 26, row: 106, w: 6, h: 4 },
} as const;
/** The gantry Kael's rail runs along, high over the hall's west end (its rail row; the brick is one row under). */
export const GANTRY = { col: 33, row: 92, end: 60 } as const;
/**
 * Kael's old rail from the landing into the hall: flat across the Banked
 * Door, then one row down per column (a tunnel, then trestles through the
 * open hall: the momentum ride), then flat along the gantry to its bumper.
 */
export function furnaceRailPath(): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  for (let c = 104; c >= 88; c--) out.push({ col: c, row: 64 });
  for (let k = 1; 64 + k <= GANTRY.row; k++) out.push({ col: 88 - k, row: 64 + k });
  for (let c = GANTRY.end - 1; c >= GANTRY.col; c--) out.push({ col: c, row: GANTRY.row });
  return out;
}

/**
 * The Four's outposts: lattice cell → mark number. Cells 2 and 3 east of the
 * shaft, −1 and −2 west (every seed: within six sectors of the shaft).
 */
export const OUTPOST_CELLS: Readonly<Record<number, number>> = { 2: 1, [-1]: 2, 3: 3, [-2]: 4 };
/** The field note each outpost carries (lore-addendum.md, The Four Who Went Down). */
const OUTPOST_NOTES: Readonly<Record<number, string>> = { 1: 'hearth-four-hammers', 2: 'hearth-bank-not-quench', 3: 'hearth-weight', 4: 'hearth-pillar-count' };
/** The mark's id on its wall (Terrain.inscriptions): `mark:<n>`. */
export const MARK_PREFIX = 'mark:';

// ── Structures (lattice) ────────────────────────────────────────────────────

interface DeepPlan { kind: StructureKind; col: number; row: number; w: number; h: number; salt: number; mark?: number }

/** Row bands: the iron-basalt upper half and the obsidian lower half. */
const BAND_A: readonly [number, number] = [58, 84];
const BAND_B: readonly [number, number] = [87, 114];
const TABLE_A: readonly [StructureKind, number][] = [['maw-den', .18], ['rail-gallery', .26], ['sentinel-hall', .2], ['rift-shrine', .12]];
const TABLE_B: readonly [StructureKind, number][] = [['hearth-lake', .32], ['ember-den', .28], ['sentinel-hall', .14], ['rift-shrine', .1]];
const DEEP_SIZE: Readonly<Partial<Record<StructureKind, { w: readonly [number, number]; h: number }>>> = {
  'outpost': { w: [12, 12], h: 4 },
  'maw-den': { w: [16, 22], h: 5 },
  'rail-gallery': { w: [34, 44], h: 4 },
  'sentinel-hall': { w: [18, 24], h: 6 },
  'rift-shrine': { w: [5, 5], h: 4 },
  'hearth-lake': { w: [14, 20], h: 6 },
  'ember-den': { w: [14, 20], h: 5 },
};
/** Cells a deep structure keeps from its lattice cell's sides (its shell and an outpost's side tunnels). */
const MARGIN = 8;

/** The deep structures of lattice cell `cell` (none under the core: the set piece is there). Pure. */
export function deepPlans(ctx: DeepContext, cell: number): DeepPlan[] {
  const span = LATTICE * SECTOR, x = cell * span;
  if (x < ctx.spec.cols && x + span > 0) return [];
  const out: DeepPlan[] = [];
  const mark = OUTPOST_CELLS[cell];
  const salt0 = mix32((ctx.seed ^ mix32(Math.imul(cell, 0x632BE5AB)) ^ 0x7d3e5a91 ^ Math.imul(ctx.gv, 0x27d4eb2f)) >>> 0);
  const outpostBand = mark ? (salt0 & 1 ? 0 : 1) : -1;
  for (let band = 0; band < 2; band++) {
    const salt = mix32((salt0 ^ Math.imul(band + 1, 0x85EBCA77)) >>> 0);
    const r = seededRandom(salt);
    const roll = r();
    let kind: StructureKind | null = null;
    if (band === outpostBand) kind = 'outpost';
    else {
      let acc = 0;
      for (const [k, weight] of band === 0 ? TABLE_A : TABLE_B) { acc += weight; if (roll < acc) { kind = k; break; } }
    }
    if (!kind) continue;
    const size = DEEP_SIZE[kind]!;
    const w = size.w[0] + Math.floor(r() * (size.w[1] - size.w[0] + 1));
    const [lo, hi] = band === 0 ? BAND_A : BAND_B;
    // A Maw den keeps to the top of the stratum (the atlas's Maws "at the top").
    const top = kind === 'maw-den' ? lo : lo + 1, bottom = (kind === 'maw-den' ? lo + 6 : hi) - size.h - 1;
    const row = top + Math.floor(r() * Math.max(1, bottom - top + 1));
    const col = x + MARGIN + Math.floor(r() * Math.max(1, span - 2 * MARGIN - w));
    out.push({ kind, col, row, w, h: size.h, salt: mix32(salt ^ 0x51ed270b), ...(kind === 'outpost' ? { mark } : {}) });
  }
  return out;
}

/** Ore and rock veins of the stratum: `count` blobs per sector column over the whole row range. */
const DEEP_VEINS: readonly { node: number; from: number; to: number; count: number; size: number }[] = [
  { node: K.pyrite, from: 58, to: 104, count: 5, size: 4 },
  { node: K.ember, from: 72, to: 116, count: 4, size: 4 },
  { node: K.coal, from: 60, to: 116, count: 5, size: 5 },
  { node: K.obsidian, from: 62, to: 116, count: 3, size: 6 },
  { node: K.slag, from: 100, to: 116, count: 2, size: 3 },
];

// ── The column ──────────────────────────────────────────────────────────────

/** Scratch reused across columns (the generator runs on the main thread, one column at a time). */
const scratch = Array.from({ length: 4 }, () => new Float64Array(128));
const caches: LatticeCache[] = Array.from({ length: 4 }, latticeCache);

/**
 * Fill the deep rows of sector column `sx` (all 32 columns, core or not) and
 * cut the Banked seal. Called by `generateSectorColumn` after the rows above.
 */
export function deepColumn(ctx: DeepContext, out: SectorColumnGen, sx: number): void {
  const spec = ctx.spec, top = spec.rows, rows = ctx.rows, floor = rows - 2, col0 = sx * SECTOR, deep = rows - top;
  const s = ctx.seed;
  if (scratch[0].length < deep) for (let n = 0; n < scratch.length; n++) scratch[n] = new Float64Array(deep);
  for (let lc = 0; lc < SECTOR; lc++) {
    const col = col0 + lc;
    const shaft = noiseColumn(s ^ 0x51a7f00d, col / 4.5, 9, deep, scratch[0], caches[0], top);
    const basin = noiseColumn(s ^ 0x6b17a3c5, col / 15, 6, deep, scratch[1], caches[1], top);
    const fine = noiseColumn(s ^ 0x2c9e4f61, col / 6, 3, deep, scratch[2], caches[2], top);
    const edge = 86 + Math.round((valueNoise1(s ^ 0x3fd1b2a7, col / 9) * 2 - 1) * 3);
    for (let row = top; row < rows; row++) {
      const i = row * SECTOR + lc, k = row - top;
      out.liqType[i] = 0; out.liqLevel[i] = 0; out.protect[i] = 0;
      if (row >= floor) { out.kind[i] = BEDROCK; continue; }
      let cave = false;
      if (row >= top + 2 && row < floor - 1) {
        const depthT = (row - top) / (floor - top);
        cave = shaft[k] > .74 || (row >= 66 && .6 * basin[k] + .4 * fine[k] > .665 - .035 * depthT);
      }
      out.kind[i] = cave ? AIR : row < edge ? K.iron : K.obsidianBand;
    }
  }
  // Veins, per sector, clipped to it, into rock only.
  for (let sy = Math.floor(top / SECTOR); sy * SECTOR < floor; sy++) deepVeins(ctx, out, sx, sy, top, floor);
  // The fracture's seam: short glowing runs through the rock, one line per lattice cell at most.
  fractureSeam(ctx, out, sx, top, floor);
  const builder = new Builder(out, col0, rows, () => false);
  // Under the core: the hand-laid set piece. Elsewhere: the lattice's structures.
  if (col0 < spec.cols && col0 + SECTOR > 0) setPiece(builder, out, col0);
  for (const plan of deepPlans(ctx, Math.floor(sx / LATTICE))) {
    if (plan.col + plan.w + MARGIN < col0 || plan.col - MARGIN >= col0 + SECTOR) continue;
    stampDeep(builder, plan, out);
    out.structures.push({ kind: plan.kind, col: plan.col, row: plan.row, w: plan.w, h: plan.h });
  }
  // A hall belongs to the column holding its first cell (it spawns once, not twice).
  out.halls = out.halls.filter(hall => hall.col0 >= col0 && hall.col0 < col0 + SECTOR);
  // The floor is the world's (until the Breach, Phase 9).
  for (let lc = 0; lc < SECTOR; lc++) for (let row = floor; row < rows; row++) {
    const i = row * SECTOR + lc;
    out.kind[i] = BEDROCK; out.liqType[i] = 0; out.liqLevel[i] = 0; out.notes.delete(i);
  }
}

function deepVeins(ctx: DeepContext, out: SectorColumnGen, sx: number, sy: number, top: number, floor: number): void {
  const col0 = sx * SECTOR;
  const r0 = Math.max(top + 1, sy * SECTOR), r1 = Math.min(floor, (sy + 1) * SECTOR);
  if (r1 <= r0) return;
  // Its own stream: the rows above roll theirs from sectorSeed(sx, sy) untouched.
  const random = seededRandom(mix32((sectorSeed(ctx.seed, sx, sy, ctx.gv) ^ 0x9d2c5680) >>> 0));
  for (const vein of DEEP_VEINS) {
    const from = Math.max(vein.from, r0), to = Math.min(vein.to, r1);
    const expected = vein.count * Math.max(0, to - from) / (vein.to - vein.from);
    const roll = random();
    const count = Math.floor(expected) + (roll < expected - Math.floor(expected) ? 1 : 0);
    if (to <= from) continue;
    for (let n = 0; n < count; n++) {
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

/**
 * One fracture seam per lattice cell (half of them): runs of 2–4 cells down a
 * wandering line, gaps of 4 or more between, only in rock. Unbreakable and
 * lit, never a wall you cannot get round (a gap is always within four rows).
 */
function fractureSeam(ctx: DeepContext, out: SectorColumnGen, sx: number, top: number, floor: number): void {
  const cell = Math.floor(sx / LATTICE), span = LATTICE * SECTOR;
  const salt = mix32((ctx.seed ^ Math.imul(cell, 0x2545F491) ^ 0x0f7ac3d1) >>> 0);
  if ((salt & 3) >= 2) return;
  const r = seededRandom(salt);
  const x0 = cell * span + 10 + Math.floor(r() * (span - 20));
  const col0 = sx * SECTOR;
  let row = top + 4 + Math.floor(r() * 4);
  while (row < floor - 3) {
    const run = 2 + Math.floor(r() * 3);
    for (let n = 0; n < run && row < floor - 2; n++, row++) {
      const col = x0 + Math.round((valueNoise1(salt, row / 6) * 2 - 1) * 2);
      if (col < col0 || col >= col0 + SECTOR) continue;
      const i = row * SECTOR + (col - col0);
      if (out.kind[i] !== AIR) out.kind[i] = K.seam;
    }
    row += 4 + Math.floor(r() * 5);
  }
}

/** A field note from the stratum's pool, by the structure's own stream. */
function poolNote(r: () => number): string | null {
  const pool = fieldNotePool('underhearth');
  return pool.length ? FIELD_NOTE_PREFIX + pool[Math.floor(r() * pool.length)] : null;
}

function stampDeep(b: Builder, plan: DeepPlan, out: SectorColumnGen): void {
  const { col: x, row: y, w, h } = plan;
  const r = seededRandom(plan.salt);
  switch (plan.kind) {
    case 'outpost': {
      // A ruined forge corner: brick floor, an anvil, the hammer-mark on the back wall, what they left.
      b.rect(x - 1, y - 1, w + 2, h + 2, K.iron);
      b.rect(x, y, w, h, AIR);
      // Side tunnels, so a cave nearby can open onto it.
      b.rect(x - 7, y + 1, 7, 3, AIR); b.rect(x + w, y + 1, 7, 3, AIR);
      b.rect(x - 8, y + 4, w + 16, 1, K.brick);
      b.rect(x + 3, y + h - 1, 2, 1, K.brick);
      b.markCell(x + w - 3, y + 1, K.mark, `${MARK_PREFIX}${plan.mark}`);
      b.put(x + w - 2, y + h - 1, K.cache, true);
      b.note(x + 1, y + 1, FIELD_NOTE_PREFIX + OUTPOST_NOTES[plan.mark ?? 1]);
      break;
    }
    case 'maw-den': {
      // Rivet Maws at the top of the stratum: a hall on a brick floor, rivets in the walls.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, K.brick);
      for (let n = 0; n < 4; n++) b.dress(x + Math.floor(r() * w), y - 1, K.emberRock);
      b.dress(x - 1, y + 2, K.slagVein); b.dress(x + w, y + 1, K.slagVein);
      out.halls.push({ creature: 'rivet-maw', count: 2, col0: x, col1: x + w, floorRow: y + h });
      break;
    }
    case 'rail-gallery': {
      // One of Kael's old rail galleries, laid toward the crack: flat, one drop, flat; a section is broken.
      const third = Math.floor(w / 3), drop = Math.min(6, third);
      const base = y + h - 1;
      const gap = x + 4 + Math.floor(r() * Math.max(1, third - 6));
      for (let c = x; c < x + w; c++) {
        const k = c - x;
        const row = k < third ? base : k < third + drop ? base + (k - third + 1) : base + drop;
        b.rect(c, row - 4, 1, 5, AIR);
        if (b.get(c, row + 1) === AIR) b.put(c, row + 1, K.iron);
        if (c === gap || c === gap + 1) continue;
        b.put(c, row, K.rail);
      }
      if (r() < .5) { const note = poolNote(r); if (note) b.note(x + w - 2, base + drop - 2, note); }
      break;
    }
    case 'sentinel-hall': {
      // Where one of the four pillars still walks: a brick floor, two standing pillars, a loose ceiling.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, K.brick);
      b.rect(x, y - 1, w, 1, K.iron);
      b.rect(x + 2, y, 1, h, K.pillar); b.rect(x + w - 3, y, 1, h, K.pillar);
      b.put(x + w - 3, y + (h >> 1), K.heart);
      if (r() < .5) { const note = poolNote(r); if (note) b.note(x + 4, y + 1, note); }
      out.halls.push({ creature: 'ironwood-sentinel', count: 1, col0: x + 3, col1: x + w - 3, floorRow: y + h });
      break;
    }
    case 'ember-den': {
      // Banked Embers asleep in cold coal: a low hall, coal in its walls.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, K.brick);
      for (let c = x; c < x + w; c += 2 + Math.floor(r() * 3)) b.dress(c, y - 1, K.coal);
      b.dress(x - 1, y + 1, K.coal); b.dress(x + w, y + 2, K.coal);
      out.halls.push({ creature: 'banked-ember', count: 3, col0: x, col1: x + w, floorRow: y + h });
      break;
    }
    case 'hearth-lake': {
      // A lava lake: obsidian where the seeps met it, shores to stand on and fish from.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + 2, 1, h - 1, K.obsidian); b.rect(x + w, y + 2, 1, h - 1, K.obsidian);
      b.rect(x - 1, y + h, w + 2, 1, K.obsidian);
      b.rect(x, y + h - 2, 2, 2, K.obsidian); b.rect(x + w - 2, y + h - 2, 2, 2, K.obsidian);
      b.liquid(x + 2, y + h - 2, w - 4, 2, LIQUID_LAVA);
      break;
    }
    case 'rift-shrine': {
      b.rect(x - 1, y - 1, w + 2, h + 2, K.iron);
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + 1, 1, h - 1, AIR); b.rect(x + w, y + 1, 1, h - 1, AIR);
      b.put(x + (w >> 1), y + h - 1, K.shrine, true);
      break;
    }
    default: break;
  }
}

/** The hand-laid Underhearth under the core: the seal, the Banked Door, Kael's rail and the Furnace Hall. */
function setPiece(b: Builder, out: SectorColumnGen, col0: number): void {
  // The seal through the chamber floor (rows 51–55: the floor, two rows of scorched basalt, the bedrock).
  for (let row = SEAL.row; row < SEAL.row + SEAL.h; row++) for (let col = SEAL.col; col < SEAL.col + SEAL.w; col++) b.put(col, row, K.seal, true);
  // The drop, and the Banked Door's landing hall.
  b.rect(SEAL.col, 56, SEAL.w, LANDING.row - 56, AIR);
  b.rect(LANDING.col - 1, LANDING.row - 1, LANDING.w + 2, 1, K.iron);
  b.rect(SEAL.col, LANDING.row - 1, SEAL.w, 1, AIR);
  b.rect(LANDING.col, LANDING.row, LANDING.w, LANDING.h, AIR);
  b.rect(LANDING.col - 1, LANDING.row + LANDING.h, LANDING.w + 2, 1, K.brick);
  b.rect(LANDING.col + LANDING.w, LANDING.row, 1, LANDING.h, K.iron);
  b.note(LANDING.col + LANDING.w - 2, LANDING.row + 1, `${FIELD_NOTE_PREFIX}hearth-for-the-fifth`);
  if (col0 <= LANDING.col + 6 && LANDING.col + 6 < col0 + SECTOR) {
    out.halls.push({ creature: 'banked-ember', count: 2, col0: LANDING.col + 6, col1: LANDING.col + LANDING.w - 4, floorRow: LANDING.row + LANDING.h });
  }
  // The Furnace Hall.
  const H = FURNACE_HALL, F = FURNACE, floorRow = H.row + H.h;
  b.rect(H.col, H.row, H.w, H.h, AIR);
  b.rect(H.col - 1, floorRow, H.w + 2, 1, K.brick);
  // Kael's rail: a tunnel down from the landing, then trestles through the open hall, then the gantry to its bumper.
  for (const { col, row } of furnaceRailPath()) {
    // Five cells of headroom: on a slope the Keeper's body straddles two columns a row apart.
    b.rect(col, row - 4, 1, 5, AIR);
    b.put(col, row, K.rail);
    if (row + 1 < H.row && b.get(col, row + 1) === AIR) b.put(col, row + 1, K.iron);
  }
  b.rect(GANTRY.col - 1, GANTRY.row + 1, GANTRY.end - GANTRY.col + 2, 1, K.brick);
  b.put(GANTRY.col - 1, GANTRY.row, K.brick);
  // The furnace: body and legs; the mouth between its legs is open.
  b.rect(F.body.col, F.body.row, F.body.w, F.body.h, K.brick);
  // Its legs stop short of the floor: the Keeper walks in under its belly to the mouth (three rows of headroom).
  b.rect(F.body.col, F.mouth.row, 2, 2, K.brick);
  b.rect(F.body.col + F.body.w - 2, F.mouth.row, 2, 2, K.brick);
  b.rect(F.mouth.col, F.mouth.row, F.mouth.w, F.mouth.h, AIR);
  b.put(F.col, floorRow - 1, K.hearth, true);
  for (const col of F.vents) b.put(col, floorRow - 1, K.vent, true);
  // The Four's quench trough: brick walls, water to the brim.
  const T = F.trough;
  b.rect(T.col - 1, T.row, 1, T.h, K.brick); b.rect(T.col + T.w, T.row, 1, T.h, K.brick);
  b.rect(T.col, T.row, T.w, T.h, AIR);
  b.liquid(T.col, T.row, T.w, T.h, LIQUID_WATER);
  // Two of the four pillars that were left to hold: they still do. One heartpost.
  b.rect(H.col + H.w - 2, H.row, 2, H.h, K.pillar);
  b.put(H.col + H.w - 2, H.row + 14, K.heart);
  b.note(T.col + 2, T.row - 6, `${FIELD_NOTE_PREFIX}hearth-unsigned-again`);
}
