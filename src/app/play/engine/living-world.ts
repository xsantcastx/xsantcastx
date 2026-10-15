/**
 * living-world.ts — the streamed world is never empty (docs/handoff/living-world.md).
 * Pure: no DOM, no Angular; the node harness (scripts/living-world.test.cjs and
 * scripts/living-world-survey.cjs) pins it.
 *
 * The owner walked "over 2m kms" east and dug 2k blocks and found nothing but
 * fishing spots. This module plans what a Keeper meets, per sector column, from
 * integers only (the same on every device), with density RULES that the guard
 * test enforces:
 *
 *   - the surface (One World's wilds): every sector column has a tree cluster
 *     (ashwoods: climb the trunk like a rope, stand in the crown) and flora; a
 *     point of interest at least every 3 sectors (a ruin, an abandoned camp, a
 *     hermit with a line and a gift, a wayside shrine, a well, a signpost with
 *     lore); a monster pack on a spawn budget that grows with the distance from
 *     town (the area level), Rivet Maws by day and Cinder Bailiffs by night;
 *   - underground: a find in every stratum at least every other sector column
 *     (fossil beds, cellars, geodes, sealed vaults with a riddle, monster dens,
 *     a Bailiff elder guarding a strongbox, seam-engines, hidden pools);
 *   - critters everywhere (finches, hares, beetles, moths, glowworms, leaping
 *     fish), each with a job; and the day's mysteries (a wisp that moves, a
 *     whisper, a door that was not there yesterday), seeded per UTC day.
 *
 * Nothing here redesigns combat or drops: packs and dens name the area's own
 * creatures (their HP and drop tables), and `packScale` is the one knob the
 * loot-and-combat curve may replace.
 */
import { AIR, Builder, mix32, SECTOR, type SectorColumnGen, type SectorFind, type SectorHall } from './gen-kit';
import { LIQUID_WATER, nodeIndex, seededRandom, TERRAIN_NODE_LIST } from './terrain';

// ── The rules ───────────────────────────────────────────────────────────────

/** The density targets the guard test holds the generator to (scripts/living-world.test.cjs). */
export const LIVING_TARGET = {
  /** Walking the wilds' surface: never more than this many cells (2 sectors, ~8 s) between interesting things. */
  surfaceGapCols: 64,
  /** A point of interest (or a wild Waystone) at least every this many sector columns. */
  poiGapSectors: 3,
  /** Digging sideways through any stratum: never more than this many cells (3 sectors) between finds. */
  undergroundGapCols: 96,
  /** Every wild sector column has at least this many trees. */
  treesPerSector: 1,
} as const;

/** Salt of every Living World roll (never the generator's own streams, so nothing else moves). */
const LIVING_SALT = 0x11f3_a71d;

const hash = (salt: number, a: number, b = 0): number => mix32(salt ^ mix32(Math.imul(a, 0x9E3779B1) ^ Math.imul(b + 0x51, 0x85EBCA77)));

/**
 * The area level of a place: sectors from town, plus four per stratum down. The
 * loot-and-combat curve owns what a level means; here it only sizes packs.
 */
export function areaLevel(sectorsFromTown: number, stratum = -1): number {
  return Math.max(0, Math.floor(Math.abs(sectorsFromTown) / 2)) + (stratum >= 0 ? 4 + stratum * 4 : 0);
}
/** HP multiplier of a creature at an area level (capped, so a far pack is a fight, not a wall). */
export function packScale(level: number): number { return Math.min(3, 1 + Math.max(0, level) * .06); }
/** Creatures in one pack at an area level: 2 near town, up to 4 far out. */
export function packCount(level: number, roll: number): number { return Math.min(4, 2 + (level >= 6 ? 1 : 0) + (roll % 3 === 0 ? 1 : 0)); }

// ── The surface ─────────────────────────────────────────────────────────────

export type PoiKind = 'ruin' | 'camp' | 'hermit' | 'shrine' | 'well' | 'signpost';
export interface SurfacePoi {
  kind: PoiKind;
  /** Left column, and its width in cells. */
  col: number;
  w: number;
  /** The carved words it holds (`living:<id>`), if any. */
  note?: string;
  /** A hermit's id (HERMITS), standing at `npcCol`. */
  npc?: string;
  npcCol?: number;
  /** A strongbox in it (a ruin, sometimes). */
  strongbox?: boolean;
}
export interface SurfaceTree { col: number; height: number; crown: number }
export interface SurfacePlan { trees: SurfaceTree[]; bushes: number[]; poi: SurfacePoi | null }

/** What the surface planner needs of a world's surface (surface-gen.ts's SurfaceSpec). */
export interface LivingSurface {
  salt: number;
  flat: readonly [number, number];
  rowLo: number;
  ground: number;
}

/** True when the whole sector column lies in the wilds (outside the authored span). */
export function wildSector(spec: Pick<LivingSurface, 'flat'>, sx: number): boolean {
  return sx * SECTOR >= spec.flat[1] || (sx + 1) * SECTOR <= spec.flat[0];
}
/** Sectors from the authored span's nearest edge (1 for the first wild sector). */
export function wildDepth(spec: Pick<LivingSurface, 'flat'>, sx: number): number {
  return sx * SECTOR >= spec.flat[1] ? sx - Math.floor(spec.flat[1] / SECTOR) + 1 : Math.floor(spec.flat[0] / SECTOR) - sx;
}

/** The raw roll for a point of interest in a sector column. */
const poiRoll = (salt: number, sx: number) => hash(salt ^ LIVING_SALT, sx, 1) % 100 < 58;

/**
 * Whether a wild sector column holds a point of interest. The rule: never three
 * in a row without one (a wild Waystone counts), so the gap is at most 3 sectors.
 */
export function poiAt(spec: Pick<LivingSurface, 'salt' | 'flat'>, sx: number, stone: (sx: number) => boolean): boolean {
  if (!wildSector(spec, sx) || stone(sx)) return false;
  if (poiRoll(spec.salt, sx)) return true;
  const back = sx * SECTOR >= spec.flat[1] ? -1 : 1;
  const had = (k: number) => !wildSector(spec, k) || stone(k) || poiRoll(spec.salt, k);
  return !had(sx + back) && !had(sx + 2 * back);
}

const POI_TABLE: readonly [PoiKind, number][] = [['ruin', 22], ['camp', 18], ['hermit', 14], ['shrine', 10], ['well', 16], ['signpost', 20]];
const POI_W: Readonly<Record<PoiKind, number>> = { ruin: 9, camp: 7, hermit: 7, shrine: 5, well: 4, signpost: 1 };

/**
 * A wild sector column's trees, bushes and point of interest. `ground(col)` is the
 * surface's ground row; `stoneCol` the wild Waystone's column in it, if any. Pure.
 */
export function surfacePlan(spec: LivingSurface, sx: number, ground: (col: number) => number, stoneCol: number | null, poi: boolean): SurfacePlan {
  const out: SurfacePlan = { trees: [], bushes: [], poi: null };
  if (!wildSector(spec, sx)) return out;
  const col0 = sx * SECTOR, r = seededRandom(hash(spec.salt ^ LIVING_SALT, sx, 2));
  const used = new Uint8Array(SECTOR);
  const take = (lc0: number, w: number) => { for (let k = Math.max(0, lc0); k < Math.min(SECTOR, lc0 + w); k++) used[k] = 1; };
  const free = (lc0: number, w: number) => { for (let k = lc0; k < lc0 + w; k++) if (k < 0 || k >= SECTOR || used[k]) return false; return true; };
  if (stoneCol !== null) take(stoneCol - col0 - 5, 11);
  if (poi && stoneCol === null) {
    let acc = 0; const roll = r() * 100;
    let kind: PoiKind = 'signpost';
    for (const [k, w] of POI_TABLE) { acc += w; if (roll < acc) { kind = k; break; } }
    let w = POI_W[kind];
    let lc = 4 + Math.floor(r() * (12 - w));
    // A well needs a hill to sink into (its water stands below the ground line, above the Delve's rows).
    if (kind === 'well') {
      let base = 0;
      for (let k = 0; k < w; k++) base = Math.min(base, ground(col0 + lc + k));
      if (base > -3) { kind = 'signpost'; w = 1; }
    }
    const p: SurfacePoi = { kind, col: col0 + lc, w };
    const notePick = (pool: readonly string[]) => pool[Math.floor(r() * pool.length)];
    if (kind === 'ruin') { p.note = notePick(NOTE_POOL.ruin); p.strongbox = r() < .5; }
    if (kind === 'camp') p.note = notePick(NOTE_POOL.camp);
    if (kind === 'signpost') p.note = notePick(NOTE_POOL.wild);
    if (kind === 'hermit') {
      const h = HERMITS[Math.floor(r() * HERMITS.length)];
      p.npc = h.id; p.note = h.note; p.npcCol = col0 + lc + 3;
    }
    out.poi = p;
    take(lc - 1, w + 2);
  }
  // Trees: a cluster of one to three ashwoods (crowns 3 or 5 wide), at least one per sector.
  const want = 1 + Math.floor(r() * 3);
  for (let tries = 0; tries < 24 && out.trees.length < want; tries++) {
    const crown = r() < .55 ? 5 : 3, half = crown >> 1;
    const lc = half + 1 + Math.floor(r() * (SECTOR - crown - 2));
    if (!free(lc - half - 1, crown + 2)) continue;
    const g = ground(col0 + lc);
    // Only on a level foot (the trunk stands on one ground cell, its neighbours the same height).
    if (ground(col0 + lc - 1) !== g && ground(col0 + lc + 1) !== g) continue;
    const height = 3 + Math.floor(r() * 3);
    if (g - height - 3 < spec.rowLo + 1) continue;
    out.trees.push({ col: col0 + lc, height, crown });
    take(lc - half - 1, crown + 2);
  }
  // Ashberry bushes (0–2) where nothing else stands.
  const bushes = Math.floor(r() * 3);
  for (let tries = 0; tries < 12 && out.bushes.length < bushes; tries++) {
    const lc = 1 + Math.floor(r() * (SECTOR - 2));
    if (!free(lc, 1)) continue;
    out.bushes.push(col0 + lc); take(lc - 1, 3);
  }
  return out;
}

/** The nodes the surface plan lays (the meaning check reads LIVING_NODES). */
const S = {
  dirt: nodeIndex('dirt'), trunk: nodeIndex('ashwood-trunk'), crown: nodeIndex('ashwood-crown'), burl: nodeIndex('ashwood-burl'),
  bush: nodeIndex('ashberry-bush'), sign: nodeIndex('wild-signpost'), ruin: nodeIndex('ruin-stone'), strongbox: nodeIndex('old-strongbox'),
  waycache: nodeIndex('waycache'), shrine: nodeIndex('rift-shrine'),
};

/** Where a surface plan writes: the sky band of one sector column (surface-gen.ts's SurfaceColumn). */
export interface SkyCells {
  kind: Uint8Array; protect: Uint8Array; liqType: Uint8Array; liqLevel: Uint8Array;
  notes: Map<number, string>;
}

/** Stamp a plan into a sector column's sky band (rows rowLo..−1). Rows ≥ 0 are never touched. Pure. */
export function stampSurface(spec: LivingSurface, sx: number, plan: SurfacePlan, ground: (col: number) => number, out: SkyCells): void {
  const col0 = sx * SECTOR;
  const at = (col: number, row: number) => (col < col0 || col >= col0 + SECTOR || row < spec.rowLo || row >= Math.min(0, spec.ground)) ? -1 : (row - spec.rowLo) * SECTOR + (col - col0);
  const put = (col: number, row: number, node: number, protect = false) => {
    const i = at(col, row);
    if (i < 0) return;
    out.kind[i] = node; out.liqType[i] = 0; out.liqLevel[i] = 0; out.protect[i] = protect ? 1 : 0; out.notes.delete(i);
  };
  const carve = (col: number, row: number, id: string, node = S.sign) => {
    const i = at(col, row);
    if (i < 0) return;
    out.kind[i] = node; out.protect[i] = 1; out.notes.set(i, id);
  };
  for (const tree of plan.trees) {
    const g = ground(tree.col);
    if (g <= spec.ground - 1) put(tree.col, g, S.burl);
    for (let k = 1; k <= tree.height; k++) put(tree.col, g - k, S.trunk);
    const top = g - tree.height - 1, half = tree.crown >> 1;
    for (let dc = -half; dc <= half; dc++) put(tree.col + dc, top, S.crown);
    for (let dc = -half + 1; dc <= half - 1; dc++) put(tree.col + dc, top - 1, S.crown);
    if (tree.crown === 3) put(tree.col, top - 1, S.crown);
  }
  for (const col of plan.bushes) put(col, ground(col) - 1, S.bush);
  const p = plan.poi;
  if (!p) return;
  // A level footing: the ground under the whole span raised to its highest point.
  let base = 0;
  for (let k = 0; k < p.w; k++) base = Math.min(base, ground(p.col + k));
  for (let k = 0; k < p.w; k++) for (let row = base; row < ground(p.col + k); row++) put(p.col + k, row, S.dirt);
  const x = p.col, y = base - 1;
  const note = p.note ? `living:${p.note}` : null;
  switch (p.kind) {
    case 'ruin':
      // Three stones of an old Keepers' waystation: a pillar with its lintel, a broken pillar, the words.
      for (let r = 0; r < 3; r++) put(x, y - r, S.ruin);
      for (let c = 0; c < 4; c++) put(x + c, y - 3, S.ruin);
      put(x + 8, y, S.ruin); put(x + 8, y - 1, S.ruin);
      if (note) carve(x + 2, y, note);
      if (p.strongbox) put(x + 6, y, S.strongbox, true);
      break;
    case 'camp':
      // An abandoned camp: a ring of stones round a cold fire, a waycache, a note.
      put(x + 3, y, S.ruin);
      put(x + 5, y, S.waycache, true);
      if (note) carve(x + 1, y, note);
      break;
    case 'hermit':
      // A hermit's lean-to: two stones, a crown of ash leaves for a roof, the sign by the door.
      put(x, y, S.ruin); put(x, y - 1, S.ruin);
      for (let c = 0; c < 3; c++) put(x + c, y - 3, S.crown);
      if (note) carve(x + 5, y, note);
      break;
    case 'shrine':
      // A wayside shrine: a plinth of ruin stone and a rift standing on it (E: the map round it).
      for (let c = 0; c < p.w; c++) put(x + c, y, S.ruin);
      put(x + 2, y - 1, S.shrine, true);
      break;
    case 'well': {
      // A well sunk into the hill: a stone rim, two rows of still water (a bucket, a line).
      put(x, y, S.ruin); put(x + 3, y, S.ruin);
      for (let c = 1; c <= 2; c++) for (let r = base; r <= base + 1; r++) {
        const i = at(x + c, r);
        if (i < 0) continue;
        out.kind[i] = AIR; out.protect[i] = 0; out.liqType[i] = LIQUID_WATER; out.liqLevel[i] = 8;
      }
      for (let c = 0; c <= 3; c++) if (base + 2 < 0) put(x + c, base + 2, S.ruin);
      put(x, base, S.ruin); put(x, base + 1, S.ruin); put(x + 3, base, S.ruin); put(x + 3, base + 1, S.ruin);
      break;
    }
    case 'signpost':
      if (note) carve(x, y, note);
      break;
  }
}

/**
 * The wild monster pack of a sector column (on the ground, one flat run), or null.
 * `ground(col)` is the ground row the pack stands on; `level` its area level. Pure.
 */
export function packFor(salt: number, sx: number, level: number, ground: (col: number) => number, safe: boolean): SectorHall | null {
  if (safe) return null;
  const h = hash(salt ^ LIVING_SALT, sx, 3);
  if (h % 100 >= Math.min(75, 40 + level * 4)) return null;
  // The longest level run of ground in the column (they patrol it).
  const col0 = sx * SECTOR;
  let best = [0, 0], start = 0;
  for (let lc = 1; lc <= SECTOR; lc++) {
    if (lc < SECTOR && ground(col0 + lc) === ground(col0 + start)) continue;
    if (lc - start > best[1] - best[0]) best = [start, lc];
    start = lc;
  }
  if (best[1] - best[0] < 6) return null;
  return {
    creature: 'rivet-maw', night: 'cinder-bailiff', count: packCount(level, h >>> 8), scale: packScale(level), near: true,
    col0: col0 + best[0], col1: col0 + best[1], floorRow: ground(col0 + best[0]),
  };
}

// ── Underground finds ───────────────────────────────────────────────────────

/** The four shipped strata's rows a find may use (inside the stratum, clear of its edges). */
const FIND_ROWS: readonly (readonly [number, number])[] = [[3, 8], [13, 21], [27, 35], [43, 48]];
export type FindKind = 'fossil-bed' | 'cellar' | 'cache-nook' | 'geode' | 'vault' | 'den' | 'machine' | 'pool' | 'elder';
const FIND_TABLE: readonly (readonly [FindKind, number][])[] = [
  [['fossil-bed', 40], ['cellar', 35], ['cache-nook', 25]],
  [['geode', 30], ['vault', 25], ['den', 25], ['fossil-bed', 20]],
  [['geode', 35], ['machine', 30], ['pool', 35]],
  [['den', 30], ['elder', 15], ['machine', 25], ['geode', 30]],
];
const FIND_SIZE: Readonly<Record<FindKind, readonly [number, number]>> = {
  'fossil-bed': [8, 3], cellar: [7, 3], 'cache-nook': [4, 2], geode: [7, 5], vault: [8, 3], den: [14, 4], machine: [7, 3], pool: [9, 3], elder: [14, 4],
};

const findRoll = (seed: number, sx: number, s: number) => hash(seed ^ LIVING_SALT, sx, 10 + s) % 100 < 62;
/** Whether stratum `s` of sector column `sx` holds a find: never two empty columns in a row. */
export function findAt(seed: number, sx: number, s: number): boolean {
  return findRoll(seed, sx, s) || !findRoll(seed, sx - 1, s);
}

const U = {
  fossil: nodeIndex('fossil-bone'), ruin: nodeIndex('ruin-stone'), strongbox: nodeIndex('old-strongbox'), emberBox: nodeIndex('ember-strongbox'),
  cache: nodeIndex('cache'), slag: nodeIndex('slag-vein'), glowcap: nodeIndex('glowcap'), heartstone: nodeIndex('heartstone-vein'),
  hardRock: nodeIndex('hard-rock'), cracked: nodeIndex('cracked-wall'), sign: nodeIndex('wild-signpost'), engine: nodeIndex('seam-engine'),
  rail: nodeIndex('old-rail'), emberRock: nodeIndex('ember-rock'), grotto: nodeIndex('grotto-stone'), scorched: nodeIndex('scorched-basalt'),
  rootLoam: nodeIndex('root-loam'),
};

/**
 * Lay this sector column's finds (one per stratum when `findAt` says so) into the
 * rock, clear of every structure that touches the column and inside the column,
 * so a find is stamped whole by the one column that owns it. Pure.
 */
export function findsInto(seed: number, out: SectorColumnGen, sx: number, b: Builder, sectorsFromTown: number, blocked: (col: number) => boolean): void {
  const col0 = sx * SECTOR;
  out.finds ??= [];
  for (let s = 0; s < 4; s++) {
    if (!findAt(seed, sx, s)) continue;
    const r = seededRandom(hash(seed ^ LIVING_SALT, sx, 20 + s));
    const roll = r() * 100;
    let acc = 0, kind: FindKind = FIND_TABLE[s][0][0];
    for (const [k, w] of FIND_TABLE[s]) { acc += w; if (roll < acc) { kind = k; break; } }
    const [w, h] = FIND_SIZE[kind];
    const [lo, hi] = FIND_ROWS[s];
    // Two tries: a spot clear of the structures (and the core) inside this column.
    let placed: SectorFind | null = null;
    for (let t = 0; t < 3 && !placed; t++) {
      const col = col0 + 3 + Math.floor(r() * (SECTOR - w - 6));
      const row = lo + Math.floor(r() * Math.max(1, hi - lo - h + 2));
      let clear = true;
      for (let c = col - 2; c < col + w + 2 && clear; c++) if (blocked(c)) clear = false;
      for (const st of out.structures) {
        if (col - 2 < st.col + st.w + 1 && col + w + 2 > st.col - 1 && row - 2 < st.row + st.h + 1 && row + h + 2 > st.row - 1) clear = false;
      }
      if (clear) placed = { kind, col, row, w, h };
    }
    if (!placed) continue;
    stampFind(b, placed, r, s, out, areaLevel(sectorsFromTown, s));
    out.finds.push(placed);
  }
}

function stampFind(b: Builder, f: SectorFind, r: () => number, s: number, out: SectorColumnGen, level: number): void {
  const { col: x, row: y, w, h } = f;
  const pick = (pool: readonly string[]) => `living:${pool[Math.floor(r() * pool.length)]}`;
  switch (f.kind as FindKind) {
    case 'fossil-bed':
      // A lens of fossil in the loam, and the hollow a root left over it.
      for (let c = 0; c < w; c++) for (let rr = 0; rr < h; rr++) {
        const edge = (c === 0 || c === w - 1) && rr !== 1;
        if (!edge) b.put(x + c, y + rr, U.fossil);
      }
      b.rect(x + 2, y - 1, w - 4, 1, AIR);
      break;
    case 'cellar':
      // A hidden cellar: a ruin-stone room, a strongbox, the words of whoever stocked it.
      b.rect(x - 1, y - 1, w + 2, h + 2, U.ruin);
      b.rect(x, y, w, h, AIR);
      b.put(x + w - 2, y + h - 1, U.strongbox, true);
      b.markCell(x + 1, y + h - 1, U.sign, pick(NOTE_POOL.cellar));
      break;
    case 'cache-nook':
      b.rect(x, y, w, h, AIR);
      b.put(x + w - 1, y + h - 1, U.cache);
      b.dress(x - 1, y, U.rootLoam);
      break;
    case 'geode': {
      // A geode: a round shell of crystal (the stratum's own ore, glinting through the rock), hollow, crystals hanging.
      const ore = s === 1 ? U.slag : s === 2 ? U.glowcap : U.heartstone;
      const cx = x + (w - 1) / 2, cy = y + (h - 1) / 2;
      for (let c = 0; c < w; c++) for (let rr = 0; rr < h; rr++) {
        const d = ((c - (w - 1) / 2) / (w / 2)) ** 2 + ((rr - (h - 1) / 2) / (h / 2)) ** 2;
        if (d > 1.05) continue;
        b.put(x + c, y + rr, d > .5 ? ore : AIR);
      }
      b.put(Math.round(cx), Math.round(cy) - 1, ore);
      break;
    }
    case 'vault':
      // A sealed vault: hard rock, a cracked door only the staff's breath opens, the riddle cut beside it.
      b.rect(x - 1, y - 1, w + 2, h + 2, U.hardRock);
      b.rect(x, y, w, h, AIR);
      b.put(x - 1, y + h - 1, U.cracked); b.put(x - 1, y + h - 2, U.cracked);
      b.markCell(x - 2, y + h - 1, U.sign, 'living:vault-riddle');
      b.put(x + w - 2, y + h - 1, U.strongbox, true);
      break;
    case 'den': {
      // A den: a low hall, its floor packed hard, the area's creatures in it (more and tougher the farther out).
      const floor = s === 3 ? U.scorched : U.hardRock;
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, floor);
      for (let n = 0; n < 3; n++) b.dress(x + Math.floor(r() * w), y - 1, U.emberRock);
      const creature = s === 3 ? 'cinder-bailiff' : 'rivet-maw';
      out.halls.push({ creature, count: packCount(level, Math.floor(r() * 9)) - 1, col0: x, col1: x + w, floorRow: y + h, scale: packScale(level), near: true });
      break;
    }
    case 'elder':
      // A Bailiff elder's hall (a mini-boss): one Cinder Bailiff, far tougher, and the strongbox it keeps.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, U.scorched);
      b.rect(x + 2, y - 2, 3, 2, U.heartstone);
      b.put(x + w - 2, y + h - 1, U.emberBox, true);
      out.halls.push({ creature: 'cinder-bailiff', count: 1, col0: x, col1: x + w - 3, floorRow: y + h, scale: packScale(level) * 2.2, near: true });
      break;
    case 'machine':
      // A seam-engine: brass older than the Seamworks, on a length of old rail, still ticking.
      b.rect(x - 1, y - 1, w + 2, h + 2, s === 3 ? U.scorched : U.hardRock);
      b.rect(x, y, w, h, AIR);
      for (let c = 0; c < w; c++) if (c !== (w >> 1)) b.put(x + c, y + h - 1, U.rail);
      b.markCell(x + (w >> 1), y + h - 1, U.engine, pick(NOTE_POOL.machine));
      b.dress(x - 1, y + 1, U.emberRock); b.dress(x + w, y + 1, U.emberRock);
      break;
    case 'pool':
      // A hidden pool: a grotto-stone basin, two rows of still water, glowcaps over it (fish rise here).
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + 1, 1, h, U.grotto); b.rect(x + w, y + 1, 1, h, U.grotto);
      b.rect(x - 1, y + h, w + 2, 1, U.grotto);
      b.liquid(x, y + 1, w, h - 1, LIQUID_WATER);
      for (let c = x + 1; c < x + w - 1; c += 3) b.put(c, y - 1, U.glowcap);
      break;
  }
}

// ── Critters ────────────────────────────────────────────────────────────────

export type CritterId = 'cinder-finch' | 'ash-hare' | 'ember-beetle' | 'dusk-moth' | 'glowworm' | 'leaping-fish';
export interface CritterDef {
  id: CritterId;
  /** Where it lives and when it is out. */
  habitat: 'surface' | 'cave' | 'water' | 'both';
  time: 'day' | 'night' | 'any';
  /** A swing catches it: this material, once a day per creature (the host pays). */
  drop?: { materialId: string; qty: number };
  /** What it does for a Keeper (English; the meaning check reads it). */
  role: string;
  /** Flies or flees from a Keeper within this many px (0: stays put). */
  shy: number;
}
export const CRITTERS: Readonly<Record<CritterId, CritterDef>> = {
  'cinder-finch': { id: 'cinder-finch', habitat: 'surface', time: 'day', shy: 140,
    role: 'roosts in ashwood crowns and flocks thickest over a ruin, a camp or a hermit\'s door: a flock means somebody lived there' },
  'ash-hare': { id: 'ash-hare', habitat: 'surface', time: 'day', shy: 170,
    role: 'burrows where a cellar or a vault lies under the loam: dig down where the hares are' },
  'ember-beetle': { id: 'ember-beetle', habitat: 'both', time: 'any', shy: 0, drop: { materialId: 'ember-grub', qty: 1 },
    role: 'a swing catches one: it gives up an Ember Grub (bait, and pet food)' },
  'dusk-moth': { id: 'dusk-moth', habitat: 'surface', time: 'night', shy: 60, drop: { materialId: 'glowcap', qty: 1 },
    role: 'drinks from glowcaps; a swing catches one and it shakes off a Glowcap' },
  'glowworm': { id: 'glowworm', habitat: 'cave', time: 'any', shy: 0,
    role: 'a living light: a glowworm ceiling lights the cave under it' },
  'leaping-fish': { id: 'leaping-fish', habitat: 'water', time: 'any', shy: 0,
    role: 'leaps where the water holds bites: a leaping fish marks a fishing spot' },
};
export const CRITTER_IDS = Object.keys(CRITTERS) as CritterId[];

/**
 * One critter as spawned: its kind, a stable id, and its cell. `on` says how it sits there:
 * 'ground' (feet on the cell below `row`), 'perch' (feet on top of `row`, a crown), 'air' (hovering
 * in `row`), 'ceiling' (hanging from the cell above `row`), 'water' (in the top water cell `row`).
 */
export type CritterOn = 'ground' | 'perch' | 'air' | 'ceiling' | 'water';
export interface CritterSpawn { id: string; critter: CritterId; col: number; row: number; on: CritterOn }

export const isNight = (hour: number) => hour >= 20 || hour < 6;

/**
 * The critters of one loaded sector column. `kind`/`liqLevel` are the column's cells
 * (local index (row − rowLo) × SECTOR + lc), `ground` the surface's ground row per column
 * (null under a plain Delve's flat surface strip: row 0), `plan` the surface plan
 * (its trees, its point of interest) or null. Pure: the same column and hour give the same list.
 */
export function crittersFor(o: {
  sx: number; hour: number; seed: number; rowLo: number; rows: number; kind: Uint8Array; liqLevel: Uint8Array;
  ground: ((col: number) => number) | null; wild: boolean; plan: SurfacePlan | null; finds: readonly SectorFind[];
}): CritterSpawn[] {
  const out: CritterSpawn[] = [];
  const col0 = o.sx * SECTOR, night = isNight(o.hour);
  const r = seededRandom(hash(o.seed ^ LIVING_SALT, o.sx, 40 + (night ? 1 : 0)));
  const at = (col: number, row: number) => (row - o.rowLo) * SECTOR + (col - col0);
  const solid = (col: number, row: number) => row >= o.rowLo && row < o.rows && SOLID[o.kind[at(col, row)]] === 1;
  const open = (col: number, row: number) => row >= o.rowLo && row < o.rows && !solid(col, row) && !o.liqLevel[at(col, row)];
  const add = (critter: CritterId, col: number, row: number, on: CritterOn = 'ground') => out.push({ id: `${o.sx}:${out.length}:${critter}`, critter, col, row, on });
  // The surface: the wilds only (the settlement has its own people).
  if (o.wild) {
    const g = o.ground ?? (() => 0);
    const ground = (lc: number) => g(col0 + lc);
    const crowns = o.plan?.trees ?? [];
    const busy = !!o.plan?.poi;
    if (!night) {
      // Finches on the crowns (more over a point of interest), hares on the ground (more over a cellar or vault).
      for (const t of crowns) if (r() < (busy ? .95 : .6)) add('cinder-finch', t.col, g(t.col) - t.height - 2, 'perch');
      if (busy) add('cinder-finch', o.plan!.poi!.col + 1, ground(o.plan!.poi!.col - col0 + 1) - 5, 'air');
      const burrows = o.finds.some(f => f.kind === 'cellar' || f.kind === 'vault') ? 2 : r() < .3 ? 1 : 0;
      for (let n = 0; n < burrows; n++) { const lc = 2 + Math.floor(r() * 28); add('ash-hare', col0 + lc, ground(lc) - 1); }
      if (r() < .7) { const lc = 2 + Math.floor(r() * 28); add('ember-beetle', col0 + lc, ground(lc) - 1); }
    } else {
      // Moths round the crowns and over the ground, glowworms in the grass.
      const moths = 1 + Math.floor(r() * 2);
      for (let n = 0; n < moths; n++) { const lc = 2 + Math.floor(r() * 28); add('dusk-moth', col0 + lc, ground(lc) - 3 - Math.floor(r() * 3), 'air'); }
      if (r() < .8) { const lc = 2 + Math.floor(r() * 28); add('glowworm', col0 + lc, ground(lc) - 1); }
    }
  }
  // Water: one leaping fish over each body of still water (the sky band's wells and ponds, the caves' lakes and pools).
  let fish = 0;
  for (let row = Math.max(o.rowLo, -32); row < o.rows && fish < 2; row++) {
    for (let lc = 1; lc < SECTOR - 1 && fish < 2; lc++) {
      const i = at(col0 + lc, row);
      if (!o.liqLevel[i] || (row > o.rowLo && o.liqLevel[at(col0 + lc, row - 1)]) || !open(col0 + lc, row - 1)) continue;
      if (o.liqLevel[at(col0 + lc + 1, row)] && o.liqLevel[at(col0 + lc - 1, row)]) { add('leaping-fish', col0 + lc, row, 'water'); fish++; lc += 8; }
    }
  }
  // Caves: glowworms on the ceilings of the Root Hollows and the Grotto, beetles on the floors deeper down.
  let worms = 0, beetles = 0;
  const tries = 40;
  for (let n = 0; n < tries && (worms < 3 || beetles < 2); n++) {
    const lc = Math.floor(r() * SECTOR), row = 3 + Math.floor(r() * 50);
    if (row >= o.rows || !open(col0 + lc, row)) continue;
    const s = row < 12 ? 0 : row < 26 ? 1 : row < 40 ? 2 : 3;
    if ((s === 0 || s === 2) && worms < 3 && solid(col0 + lc, row - 1)) { add('glowworm', col0 + lc, row, 'ceiling'); worms++; continue; }
    if ((s === 1 || s === 3) && beetles < 2 && solid(col0 + lc, row + 1)) { add('ember-beetle', col0 + lc, row); beetles++; }
  }
  return out;
}

/** 1 where a node is solid (a critter stands on it, never in it). */
const SOLID = Uint8Array.from(TERRAIN_NODE_LIST, node => node.solid ? 1 : 0);

// ── The day's mysteries ─────────────────────────────────────────────────────

export type MysteryKind = 'wisp' | 'whisper' | 'door';
export interface Mystery {
  /** `<day>:<sx>:<kind>`: the reward's receipt (once a day each). */
  id: string;
  kind: MysteryKind;
  sx: number;
  /** Where it is: its column, and its stratum's middle row (underground) or the surface. */
  col: number;
  row: number;
  underground: boolean;
}
/** The UTC day number of a time (ms): the day a mystery belongs to. */
export const utcDay = (ms: number) => Math.floor(ms / 86_400_000);
/** Mysteries are about this rare: one sector column in four, each day. */
const MYSTERY_ODDS = 4;

/** The mystery in sector column `sx` on `day`, or null. Not in the core's columns (town). Pure. */
export function mysteryAt(seed: number, day: number, sx: number, coreSectors = 4): Mystery | null {
  if (sx >= 0 && sx < coreSectors) return null;
  const h = hash(seed ^ LIVING_SALT ^ Math.imul(day, 0x2c1b3c6d), sx, 60);
  if (h % MYSTERY_ODDS) return null;
  const kind: MysteryKind = (['wisp', 'whisper', 'door'] as const)[(h >>> 4) % 3];
  const underground = ((h >>> 8) & 1) === 1 || kind === 'door';
  const s = (h >>> 10) % 4;
  return { id: `${day}:${sx}:${kind}`, kind, sx, col: sx * SECTOR + 8 + ((h >>> 12) % 16), row: underground ? [6, 19, 33, 46][s] : -1, underground };
}

/** What a mystery pays, once a day each (the host's ledger key is `living-mystery:<id>`). Delving XP and a small find. */
export const MYSTERY_REWARD: Readonly<Record<MysteryKind, { xp: number; item?: { materialId: string; qty: number } }>> = {
  wisp: { xp: 12, item: { materialId: 'glowcap', qty: 2 } },
  whisper: { xp: 6 },
  door: { xp: 15, item: { materialId: 'ember-residue', qty: 1 } },
};

// ── Words: notes, hermits ───────────────────────────────────────────────────

/** Carved words by place (ids; the text is `play.living.note.<id>` in living-world.i18n.ts, EN + ES). */
export const NOTE_POOL = {
  wild: ['wild-two-days', 'wild-ash-remembers', 'wild-stones-count', 'wild-finches'],
  ruin: ['ruin-waystation', 'ruin-lintel', 'ruin-lamp-hook'],
  camp: ['camp-left-in-a-hurry', 'camp-boots', 'camp-torches'],
  cellar: ['cellar-stores', 'cellar-for-winter'],
  machine: ['machine-ticking', 'machine-no-maker', 'machine-oil'],
} as const;
/** The vault's riddle (its door is a cracked wall: the staff's breath opens it). */
export const VAULT_RIDDLE = 'vault-riddle';

/** The hermits of the wilds: a line, and a gift the first time (once per Keeper, ever). */
export interface HermitDef { id: string; note: string; gift: { materialId: string; qty: number }; look: 'coat' | 'robe' }
export const HERMITS: readonly HermitDef[] = [
  { id: 'hermit-orla', note: 'hermit-orla', gift: { materialId: 'torch', qty: 3 }, look: 'coat' },
  { id: 'hermit-tobb', note: 'hermit-tobb', gift: { materialId: 'ember-grub', qty: 4 }, look: 'robe' },
  { id: 'hermit-mira', note: 'hermit-mira', gift: { materialId: 'glowcap', qty: 2 }, look: 'coat' },
];
/** Delving XP for the first reading of each carved Living World note (a field note's). */
export const LIVING_NOTE_XP = 8;

/** Every Living World note id (the i18n check and the spec read it). */
export const LIVING_NOTE_IDS: readonly string[] = [...Object.values(NOTE_POOL).flat(), VAULT_RIDDLE, ...HERMITS.map(h => h.note)];
/** The hermit whose door a note hangs on, or null. */
export function hermitOfNote(note: string): HermitDef | null { return HERMITS.find(h => h.note === note) ?? null; }

/** Every node the Living World lays (the meaning check's layout list). */
export const LIVING_NODES: readonly string[] = ['ashwood-trunk', 'ashwood-crown', 'ashwood-burl', 'ashberry-bush', 'wild-signpost', 'ruin-stone',
  'fossil-bone', 'old-strongbox', 'ember-strongbox', 'seam-engine', 'waycache', 'rift-shrine', 'cache', 'cracked-wall', 'old-rail'];

// ── The spawn budget (engine.ts `wakeHalls`) ─────────────────────────────────

/** Living World creatures alive at once round the Keeper (packs and dens), at most. */
export const WILD_BUDGET = 12;
/** A waiting pack or den wakes when the Keeper is this close (world px): about a phone screen and a half. */
export const WILD_NEAR = { x: 1400, y: 900 } as const;
