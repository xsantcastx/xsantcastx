/**
 * sector-world.ts — the endless Delve's loaded world (Phase 7, horizontal
 * first; docs/world/delve-and-beyond.md §3.3). Pure: no DOM, no Angular.
 *
 * The engine keeps working on ONE `Terrain`, as it always has; in the endless
 * Delve that terrain is a ring (`Terrain.ring`) of RING_COLS world columns:
 * four sector columns around the Keeper, every cell API taking world columns
 * (west of the core they are negative). As the Keeper walks, `follow` moves the
 * span one sector column at a time, with hysteresis (the Keeper always stands
 * EDGE_MARGIN or more cells from either edge, so nothing unloaded is ever in
 * view or in reach): the column that leaves is copied out to a cache, the one
 * that arrives is copied into the same ring slots, and only its chunks redraw.
 * The next column is generated a little ahead (`prefetch`, at most one per
 * fixed step), so a shift itself never generates.
 *
 * Every column lives in a `Column` while unloaded (an LRU of COLUMN_CACHE, the
 * core's columns pinned), so walking back is instant; a column evicted from
 * the cache is rebuilt from the seed and the save, exactly as on a reload.
 *
 * The save: the core's cells, liquid and map keep their v1 shapes (core cell
 * indices, the same layout keys: nothing the core held moves), and every cell
 * outside it goes to its sector's diff through `DelvePersistence.sectors`.
 */
import { CELL, LIQUID_FULL, liquidLayout, nodeIndex, packLiquid, Terrain, TERRAIN_NODE_LIST, terrainLayout, type TerrainSpec } from './terrain';
import { coreSectorCols, generateSectorColumn, isCoreCol, SECTOR, SECTOR_GV, sectorContext, type SectorColumnGen, type SectorContext, type SectorHall } from './sector-gen';
import type { DelvePersistence, DelveSectorStore } from './engine.model';
import { fogPixel, mapPixel, mapWalls, REVEAL_CELLS, type MapMarker, type WorldMap } from './delve-map';

/** World columns the ring holds (four sector columns). A power of two. */
export const RING_COLS = 128;
/** The Keeper never stands closer than this (cells) to an unloaded column. */
export const EDGE_MARGIN = 40;
/** Unloaded columns kept with their live state (16 columns = 32 sectors, spec §3.3). */
export const COLUMN_CACHE = 16;

const AIR = 0;
const SOLID = Uint8Array.from(TERRAIN_NODE_LIST, node => node.solid ? 1 : 0);
/**
 * Cells a diff keeps across a generator change: open air (a tunnel) and what
 * the Keeper built or a reaction made. Everything else was generated, and the
 * new generator's rock stands there now (§3.4).
 */
const KEPT = Uint8Array.from(TERRAIN_NODE_LIST, node =>
  node.id === 'air' || node.placeable || ['packed-dirt', 'basalt-block', 'obsidian-block', 'obsidian'].includes(node.id) ? 1 : 0);
const INSCRIPTION = nodeIndex('inscription');
const CAMP = nodeIndex('camp'), CHEST = nodeIndex('chest'), TORCH = nodeIndex('torch'), SHRINE = nodeIndex('rift-shrine');
/** Columns the map may generate per paint (the rest show as fog until a later HUD tick). */
const MAP_BUILDS = 4;

/** One sector column with its live state (only authoritative while it is NOT in the ring). */
export interface Column {
  sx: number;
  gen: SectorColumnGen;
  kind: Uint8Array;
  hp: Float32Array;
  liqType: Uint8Array;
  liqLevel: Uint8Array;
  /** Explored cells, one bit per local cell. */
  fog: Uint8Array;
  /** Per sector (sy 0, 1): when it regrew, or 0. */
  healed: number[];
  used: number;
}

/** What the engine does when a column enters or leaves the ring (creatures, liquid state). */
export interface WorldHooks {
  loaded?(column: Column): void;
  unloading?(column: Column): void;
}

export class SectorWorld {
  readonly t: Terrain;
  readonly ctx: SectorContext;
  /** Explored cells of the ring, one bit per ring cell (the engine's `fog`). */
  readonly fog: Uint8Array;
  readonly layout: string;
  readonly wet: string;
  private readonly columns = new Map<number, Column>();
  private readonly loaded = new Set<number>();
  private readonly coreSeen: Uint8Array;
  private readonly coreCols: number;
  private clock = 0;
  /** Sectors whose explored blocks changed since `flushFog`. */
  private readonly fogDirty = new Set<string>();
  private coreFogDirty = false;
  /** Shifts so far (tests, perf). */
  shifts = 0;

  constructor(readonly spec: TerrainSpec, readonly seed: number, readonly areaId: string,
    private readonly persist: DelvePersistence | null, private readonly hooks: WorldHooks = {}) {
    this.ctx = sectorContext(spec, seed);
    this.layout = terrainLayout(spec, seed);
    this.wet = liquidLayout(spec, seed);
    this.coreCols = coreSectorCols(spec);
    const t = this.t = new Terrain(RING_COLS, spec.rows, spec.top, true);
    t.base = new Uint8Array(t.kind.length);
    t.baseLiqType = new Uint8Array(t.kind.length);
    t.baseLiqLevel = new Uint8Array(t.kind.length);
    if (spec.biomes?.length) { t.biomes = spec.biomes; for (let row = 0; row < spec.rows; row++) t.biomeOfRow[row] = this.ctx.core.biomeOfRow[row]; }
    if (spec.sealed) t.sealed = spec.sealed;
    this.fog = new Uint8Array((t.kind.length + 7) >> 3);
    let seen: Uint8Array | null = null;
    const cells = spec.cols * spec.rows;
    try { seen = persist?.seenCells?.(areaId, this.layout, cells) ?? null; } catch { /* unexplored */ }
    this.coreSeen = seen && seen.length === (cells + 7) >> 3 ? seen : new Uint8Array((cells + 7) >> 3);
    // The core's columns are built once and pinned: its diff is the v1 diff, read once.
    let coreCells: ReadonlyMap<number, number> | null = null, coreLiquids: ReadonlyMap<number, number> | null = null;
    try { coreCells = persist?.cells(areaId, this.layout) ?? null; } catch { /* fresh rock */ }
    try { coreLiquids = persist?.liquids?.(areaId, this.wet) ?? null; } catch { /* as generated */ }
    for (let sx = 0; sx < this.coreCols; sx++) this.columns.set(sx, this.build(sx, coreCells, coreLiquids));
  }

  private get sectors(): DelveSectorStore | null { return this.persist?.sectors ?? null; }

  // ── Columns ───────────────────────────────────────────────────────────────

  /** A column from the seed, with the save laid over it. */
  private build(sx: number, coreCells?: ReadonlyMap<number, number> | null, coreLiquids?: ReadonlyMap<number, number> | null): Column {
    const gen = generateSectorColumn(this.ctx, sx);
    const rows = this.spec.rows, n = SECTOR * rows;
    const column: Column = {
      sx, gen, kind: gen.kind.slice(), hp: new Float32Array(n), liqType: gen.liqType.slice(), liqLevel: gen.liqLevel.slice(),
      fog: new Uint8Array((n + 7) >> 3), healed: [0, 0], used: ++this.clock,
    };
    const set = (i: number, kind: number) => {
      if (gen.notes.has(i) || kind === INSCRIPTION || kind < 0 || kind >= TERRAIN_NODE_LIST.length) return;
      column.kind[i] = kind;
      if (SOLID[kind]) { column.liqType[i] = 0; column.liqLevel[i] = 0; }
    };
    const liquid = (i: number, packed: number) => {
      const type = packed >> 4, level = packed & 15;
      if (level > LIQUID_FULL || SOLID[column.kind[i]] || (level && (type < 1 || type > 2))) return;
      column.liqType[i] = level ? type : 0; column.liqLevel[i] = level;
    };
    for (let lc = 0; lc < SECTOR; lc++) {
      const col = sx * SECTOR + lc;
      if (!isCoreCol(this.ctx, col)) continue;
      for (let row = 0; row < rows; row++) {
        const ci = row * this.spec.cols + col, i = row * SECTOR + lc;
        const kind = coreCells?.get(ci);
        if (kind !== undefined) set(i, kind);
        const packed = coreLiquids?.get(ci);
        if (packed !== undefined) liquid(i, packed);
        if (this.coreSeen[ci >> 3] & (1 << (ci & 7))) column.fog[i >> 3] |= 1 << (i & 7);
      }
    }
    const store = this.sectors;
    for (let sy = 0; store && sy * SECTOR < rows; sy++) {
      let save = null;
      try { save = store.sector(this.areaId, sx, sy); } catch { /* fresh rock */ }
      if (!save) continue;
      const same = save.g === this.ctx.gv;
      const toCell = (local: number) => {
        const row = sy * SECTOR + (local >> 5), lc = local & 31;
        return row < rows && !isCoreCol(this.ctx, sx * SECTOR + lc) && local >= 0 && local < SECTOR * SECTOR ? row * SECTOR + lc : -1;
      };
      for (const [local, kind] of save.cells) {
        const i = toCell(local);
        if (i >= 0 && (same || KEPT[kind])) set(i, kind);
      }
      if (same) for (const [local, packed] of save.liquids) { const i = toCell(local); if (i >= 0) liquid(i, packed); }
      if (save.fog) {
        for (let b = 0; b < 64; b++) {
          if (!(save.fog[b >> 3] & (1 << (b & 7)))) continue;
          const r0 = sy * SECTOR + (b >> 3) * 4, c0 = (b & 7) * 4;
          for (let r = r0; r < Math.min(rows, r0 + 4); r++) for (let c = c0; c < c0 + 4; c++) { const i = r * SECTOR + c; column.fog[i >> 3] |= 1 << (i & 7); }
        }
      }
      if (save.healed) column.healed[sy] = save.healed;
    }
    for (let i = 0; i < n; i++) column.hp[i] = TERRAIN_NODE_LIST[column.kind[i]].hp;
    return column;
  }

  /** The column for `sx`: cached, or built now. */
  column(sx: number): Column {
    let column = this.columns.get(sx);
    if (!column) { column = this.build(sx); this.columns.set(sx, column); this.trim(); }
    column.used = ++this.clock;
    return column;
  }
  /** A cached column, never built. */
  cached(sx: number): Column | undefined { return this.columns.get(sx); }
  isLoaded(sx: number): boolean { return this.loaded.has(sx); }
  /** The columns in the ring, west to east. */
  loadedColumns(): Column[] { return [...this.loaded].sort((a, b) => a - b).map(sx => this.columns.get(sx)!).filter(Boolean); }

  private trim(): void {
    const evictable = () => [...this.columns.values()].filter(c => !this.loaded.has(c.sx) && (c.sx < 0 || c.sx >= this.coreCols));
    let spare = evictable();
    while (spare.length > COLUMN_CACHE) {
      const oldest = spare.reduce((a, b) => (a.used <= b.used ? a : b));
      this.columns.delete(oldest.sx);
      spare = evictable();
    }
  }

  /** Copy a column into its ring slots. */
  private copyIn(column: Column): void {
    const t = this.t, rows = this.spec.rows, gen = column.gen, col0 = column.sx * SECTOR;
    for (let row = 0; row < rows; row++) for (let lc = 0; lc < SECTOR; lc++) {
      const i = row * SECTOR + lc, r = t.index(col0 + lc, row);
      t.kind[r] = column.kind[i]; t.base[r] = gen.kind[i]; t.hp[r] = column.hp[i];
      t.liqType[r] = column.liqType[i]; t.liqLevel[r] = column.liqLevel[i];
      t.baseLiqType[r] = gen.liqType[i]; t.baseLiqLevel[r] = gen.liqLevel[i];
      t.protect[r] = gen.protect[i];
      if (column.fog[i >> 3] & (1 << (i & 7))) this.fog[r >> 3] |= 1 << (r & 7); else this.fog[r >> 3] &= ~(1 << (r & 7));
      const note = gen.notes.get(i);
      if (note) t.inscriptions.set(r, note); else t.inscriptions.delete(r);
    }
    t.liquidRev++;
  }
  /** Copy a column's live state out of the ring (it is leaving). */
  private copyOut(column: Column): void {
    const t = this.t, rows = this.spec.rows, col0 = column.sx * SECTOR;
    for (let row = 0; row < rows; row++) for (let lc = 0; lc < SECTOR; lc++) {
      const i = row * SECTOR + lc, r = t.index(col0 + lc, row);
      column.kind[i] = t.kind[r]; column.hp[i] = t.hp[r];
      column.liqType[i] = t.liqType[r]; column.liqLevel[i] = t.liqLevel[r];
      if (this.fog[r >> 3] & (1 << (r & 7))) column.fog[i >> 3] |= 1 << (i & 7);
      t.inscriptions.delete(r);
    }
  }

  // ── The span ──────────────────────────────────────────────────────────────

  /** The first loaded sector column. */
  get loSector(): number { return Math.floor(this.t.colLo / SECTOR); }

  /** Load the ring round world column `col` at once (entering, travelling to the camp, a reload). */
  center(col: number): void {
    const lo = Math.round(col / SECTOR) - RING_COLS / SECTOR / 2;
    if (this.loaded.size && lo === this.loSector) return;
    for (const sx of [...this.loaded]) this.unload(sx);
    this.t.colLo = lo * SECTOR; this.t.colHi = this.t.colLo + RING_COLS;
    for (let sx = lo; sx < lo + RING_COLS / SECTOR; sx++) this.load(sx);
  }

  private load(sx: number): void {
    const column = this.column(sx);
    this.copyIn(column);
    this.loaded.add(sx);
    this.t.touchColumns(sx * SECTOR, (sx + 1) * SECTOR);
    this.hooks.loaded?.(column);
  }
  private unload(sx: number): void {
    const column = this.columns.get(sx);
    if (!column) { this.loaded.delete(sx); return; }
    this.hooks.unloading?.(column);
    this.saveColumnLiquids(column);
    this.copyOut(column);
    this.loaded.delete(sx);
    column.used = ++this.clock;
  }

  /**
   * Keep the ring round the Keeper's column: one sector column at a time, only
   * when the Keeper comes within EDGE_MARGIN of an edge. Also generates the next
   * column ahead (at most one per call). True when the span moved.
   */
  follow(col: number): boolean {
    const t = this.t;
    if (col - t.colLo < EDGE_MARGIN) { this.shift(-1); return true; }
    if (t.colHi - col <= EDGE_MARGIN) { this.shift(1); return true; }
    // Prefetch: the column the next shift will need, once the Keeper heads that way.
    if (col - t.colLo < EDGE_MARGIN + 16) this.prefetch(this.loSector - 1);
    else if (t.colHi - col <= EDGE_MARGIN + 16) this.prefetch(this.loSector + RING_COLS / SECTOR);
    return false;
  }
  private prefetch(sx: number): void { if (!this.columns.has(sx)) { this.columns.set(sx, this.build(sx)); this.trim(); } }

  private shift(dir: number): void {
    const t = this.t, lo = this.loSector, count = RING_COLS / SECTOR;
    const leaving = dir > 0 ? lo : lo + count - 1;
    const arriving = dir > 0 ? lo + count : lo - 1;
    this.unload(leaving);
    t.colLo += dir * SECTOR; t.colHi += dir * SECTOR;
    this.load(arriving);
    this.shifts++;
  }

  // ── Cells ─────────────────────────────────────────────────────────────────

  /** The sector of a world cell and its local index. */
  static local(col: number, row: number): { sx: number; sy: number; local: number } {
    const sx = Math.floor(col / SECTOR), sy = Math.floor(row / SECTOR);
    return { sx, sy, local: (row - sy * SECTOR) * SECTOR + (col - sx * SECTOR) };
  }

  /** Tell the save about a ring cell that changed (dug, built, a reaction). */
  record(index: number): void {
    const t = this.t, col = t.colOf(index), row = t.rowOf(index), kind = t.kind[index], base = t.base[index];
    const now = kind === base ? null : kind;
    try {
      if (isCoreCol(this.ctx, col)) { this.persist?.changed(this.areaId, this.layout, row * this.spec.cols + col, now); return; }
      const { sx, sy, local } = SectorWorld.local(col, row);
      const receipt = !!TERRAIN_NODE_LIST[base].receipt && kind === AIR;
      this.sectors?.sectorChanged(this.areaId, sx, sy, this.ctx.gv, local, now, receipt || undefined);
    } catch { /* the change stands this session */ }
  }

  /** Save the ring's liquid: the core's whole diff (as v1), each loaded wing sector's own. */
  saveLiquids(): void {
    for (const sx of this.loaded) { const c = this.columns.get(sx); if (c) this.saveColumnLiquids(c); }
    if (!this.persist?.liquidsChanged) return;
    const core = new Map<number, number>(), t = this.t, rows = this.spec.rows;
    for (let sx = 0; sx < this.coreCols; sx++) {
      const column = this.columns.get(sx)!, inRing = this.loaded.has(sx);
      for (let lc = 0; lc < SECTOR; lc++) {
        const col = sx * SECTOR + lc;
        if (!isCoreCol(this.ctx, col)) continue;
        for (let row = 0; row < rows; row++) {
          const i = row * SECTOR + lc, r = t.index(col, row);
          const type = inRing ? t.liqType[r] : column.liqType[i], level = inRing ? t.liqLevel[r] : column.liqLevel[i];
          const now = packLiquid(type, level), was = packLiquid(column.gen.liqType[i], column.gen.liqLevel[i]);
          if (now !== was) core.set(row * this.spec.cols + col, now);
        }
      }
    }
    try { this.persist.liquidsChanged(this.areaId, this.wet, core); } catch { /* flowing this session */ }
  }
  /** One column's wing sectors' liquid diffs (read from the ring while it is loaded). Core cells are skipped. */
  private saveColumnLiquids(column: Column): void {
    const store = this.sectors;
    if (!store) return;
    const t = this.t, rows = this.spec.rows, inRing = this.loaded.has(column.sx);
    if (column.sx * SECTOR >= 0 && column.sx * SECTOR + SECTOR <= this.spec.cols) return;
    for (let sy = 0; sy * SECTOR < rows; sy++) {
      const cells = new Map<number, number>();
      let wing = false;
      for (let r0 = 0; r0 < SECTOR && sy * SECTOR + r0 < rows; r0++) for (let lc = 0; lc < SECTOR; lc++) {
        const col = column.sx * SECTOR + lc, row = sy * SECTOR + r0;
        if (isCoreCol(this.ctx, col)) continue;
        wing = true;
        const i = row * SECTOR + lc, r = t.index(col, row);
        const type = inRing ? t.liqType[r] : column.liqType[i], level = inRing ? t.liqLevel[r] : column.liqLevel[i];
        const now = packLiquid(type, level), was = packLiquid(column.gen.liqType[i], column.gen.liqLevel[i]);
        if (now !== was) cells.set(r0 * SECTOR + lc, now);
      }
      if (!wing) continue;
      try { store.sectorLiquids(this.areaId, column.sx, sy, this.ctx.gv, cells); } catch { /* this session */ }
    }
  }

  /** Reveal the map round (col, row) in the ring. True when anything was new. */
  reveal(col: number, row: number, radius = REVEAL_CELLS): boolean {
    const t = this.t, span = Math.ceil(radius), r2 = radius * radius;
    let changed = false;
    for (let r = Math.max(0, row - span); r <= Math.min(t.rows - 1, row + span); r++) {
      for (let c = Math.max(t.colLo, col - span); c <= Math.min(t.colHi - 1, col + span); c++) {
        if ((c - col) * (c - col) + (r - row) * (r - row) > r2) continue;
        if (this.mark(c, r)) changed = true;
      }
    }
    return changed;
  }
  /** Reveal a rectangle (a rift shrine shows the tunnels round it). */
  revealRect(col0: number, col1: number, row0: number, row1: number): boolean {
    const t = this.t;
    let changed = false;
    for (let r = Math.max(0, row0); r <= Math.min(t.rows - 1, row1); r++) for (let c = Math.max(t.colLo, col0); c <= Math.min(t.colHi - 1, col1); c++) if (this.mark(c, r)) changed = true;
    return changed;
  }
  private mark(c: number, r: number): boolean {
    const i = this.t.index(c, r), bit = 1 << (i & 7);
    if (this.fog[i >> 3] & bit) return false;
    this.fog[i >> 3] |= bit;
    if (isCoreCol(this.ctx, c)) { const ci = r * this.spec.cols + c; this.coreSeen[ci >> 3] |= 1 << (ci & 7); this.coreFogDirty = true; }
    else { const { sx, sy } = SectorWorld.local(c, r); this.fogDirty.add(`${sx},${sy}`); }
    return true;
  }
  /** Hand the explored cells to the save (the host debounces). */
  flushFog(): void {
    if (this.coreFogDirty) {
      this.coreFogDirty = false;
      try { this.persist?.explored?.(this.areaId, this.layout, this.coreSeen); } catch { /* this session */ }
    }
    const store = this.sectors;
    for (const key of this.fogDirty) {
      const [sx, sy] = key.split(',').map(Number);
      const blocks = this.sectorBlocks(sx, sy);
      try { store?.sectorExplored(this.areaId, sx, sy, this.ctx.gv, blocks); } catch { /* this session */ }
    }
    this.fogDirty.clear();
  }
  /** A sector's explored 4 × 4 blocks (any cell explored → the block is). */
  sectorBlocks(sx: number, sy: number): Uint8Array {
    const out = new Uint8Array(8), t = this.t, rows = this.spec.rows, inRing = this.loaded.has(sx), column = this.columns.get(sx);
    for (let b = 0; b < 64; b++) {
      const r0 = sy * SECTOR + (b >> 3) * 4, c0 = (b & 7) * 4;
      let any = false;
      for (let r = r0; r < Math.min(rows, r0 + 4) && !any; r++) for (let c = c0; c < c0 + 4 && !any; c++) {
        const col = sx * SECTOR + c;
        if (isCoreCol(this.ctx, col)) continue;
        if (inRing) { const i = t.index(col, r); any = !!(this.fog[i >> 3] & (1 << (i & 7))); }
        else if (column) { const i = r * SECTOR + c; any = !!(column.fog[i >> 3] & (1 << (i & 7))); }
      }
      if (any) out[b >> 3] |= 1 << (b & 7);
    }
    return out;
  }

  // ── Finding things anywhere ──────────────────────────────────────────────

  /** A stable number for a world cell: the core keeps its v1 index (chests are filed by it); wings get their own range. */
  cellId(col: number, row: number): number {
    if (isCoreCol(this.ctx, col)) return row * this.spec.cols + col;
    const zig = col >= 0 ? col * 2 : -col * 2 - 1;
    return WING_ID + zig * 64 + row;
  }
  /** The world cell of a stable id, or null. */
  cellOf(id: number): { col: number; row: number } | null {
    if (!Number.isInteger(id) || id < 0) return null;
    if (id < WING_ID) { const col = id % this.spec.cols, row = (id - col) / this.spec.cols; return row < this.spec.rows ? { col, row } : null; }
    const zig = Math.floor((id - WING_ID) / 64), row = (id - WING_ID) % 64;
    const col = zig % 2 === 0 ? zig / 2 : -(zig + 1) / 2;
    return row < this.spec.rows ? { col, row } : null;
  }
  /** The node at a world cell, from the ring or a cached column; null when neither holds it. */
  kindAt(col: number, row: number): number | null {
    if (row < 0 || row >= this.spec.rows) return null;
    if (this.t.inside(col, row)) return this.t.kind[this.t.index(col, row)];
    const column = this.columns.get(Math.floor(col / SECTOR));
    return column ? column.kind[row * SECTOR + (col - column.sx * SECTOR)] : null;
  }

  /** The first cell holding `kind` anywhere the player has been (ring, cache, then the saved sectors). */
  find(kind: number): { col: number; row: number } | null {
    const t = this.t;
    for (let i = 0; i < t.kind.length; i++) if (t.kind[i] === kind) return { col: t.colOf(i), row: t.rowOf(i) };
    for (const column of this.columns.values()) {
      if (this.loaded.has(column.sx)) continue;
      const i = column.kind.indexOf(kind);
      if (i >= 0) return { col: column.sx * SECTOR + (i % SECTOR), row: Math.floor(i / SECTOR) };
    }
    const store = this.sectors;
    if (!store) return null;
    try {
      for (const { sx, sy } of store.sectorKeys(this.areaId)) {
        if (this.columns.has(sx)) continue;
        const save = store.sector(this.areaId, sx, sy);
        if (!save) continue;
        for (const [local, k] of save.cells) if (k === kind) return { col: sx * SECTOR + (local & 31), row: sy * SECTOR + (local >> 5) };
      }
    } catch { /* not found */ }
    return null;
  }

  // ── The map ───────────────────────────────────────────────────────────────

  /** Sector columns with anything explored: the core's, every cached column's, every saved sector's. */
  explored(): number[] {
    const out = new Set<number>();
    for (let sx = 0; sx < this.coreCols; sx++) if (this.coreSeen.some(b => b !== 0)) out.add(sx);
    for (const column of this.columns.values()) {
      if (this.loaded.has(column.sx) ? this.ringColumnSeen(column.sx) : column.fog.some(b => b !== 0)) out.add(column.sx);
    }
    try { for (const { sx } of this.sectors?.sectorKeys(this.areaId) ?? []) out.add(sx); } catch { /* the cached ones */ }
    return [...out].sort((a, b) => a - b);
  }
  private ringColumnSeen(sx: number): boolean {
    const t = this.t;
    for (let row = 0; row < this.spec.rows; row++) for (let lc = 0; lc < SECTOR; lc++) { const i = t.index(sx * SECTOR + lc, row); if (this.fog[i >> 3] & (1 << (i & 7))) return true; }
    return false;
  }

  /**
   * Read one map cell: its kind, its generated kind, and whether it is explored
   * and regrown. From the ring when loaded, else the column (built if `build`).
   * Returns false when the column is not available.
   */
  mapColumn(sx: number, build: boolean): MapColumn | null {
    const t = this.t;
    if (this.loaded.has(sx)) {
      const column = this.columns.get(sx)!;
      return {
        kind: (i: number) => t.kind[t.index(sx * SECTOR + (i % SECTOR), (i / SECTOR) | 0)],
        base: (i: number) => column.gen.kind[i],
        seen: (i: number) => { const r = t.index(sx * SECTOR + (i % SECTOR), (i / SECTOR) | 0); return !!(this.fog[r >> 3] & (1 << (r & 7))); },
        healed: column.healed, gen: column.gen,
      };
    }
    const column = build ? this.column(sx) : this.columns.get(sx);
    if (!column) return null;
    return {
      kind: (i: number) => column.kind[i], base: (i: number) => column.gen.kind[i],
      seen: (i: number) => !!(column.fog[i >> 3] & (1 << (i & 7))), healed: column.healed, gen: column.gen,
    };
  }

  /**
   * The map v2 source: the explored world in columns. Painting builds at most
   * MAP_BUILDS missing columns per call (a long-explored Delve fills in over a
   * few HUD ticks instead of stalling one).
   */
  map(): WorldMap {
    const sectors = this.explored();
    const col0 = Math.min(0, sectors.length ? sectors[0] * SECTOR : 0);
    const col1 = Math.max(this.spec.cols, sectors.length ? (sectors[sectors.length - 1] + 1) * SECTOR : 0);
    const known = new Set(sectors), walls = mapWalls(this.t.biomes), rows = this.spec.rows, biomeOfRow = this.t.biomeOfRow;
    let builds = MAP_BUILDS;
    const columnFor = (sx: number): MapColumn | null => {
      const have = this.loaded.has(sx) || this.columns.has(sx);
      if (!have && (!known.has(sx) || builds <= 0)) return null;
      if (!have) builds--;
      return this.mapColumn(sx, true);
    };
    return {
      col0, col1, sectors,
      paint: (c0, c1, data) => {
        const w = c1 - c0;
        for (let sx = Math.floor(c0 / SECTOR); sx * SECTOR < c1; sx++) {
          const mc = columnFor(sx);
          for (let lc = 0; lc < SECTOR; lc++) {
            const x = sx * SECTOR + lc - c0;
            if (x < 0 || x >= w) continue;
            for (let row = 0; row < rows; row++) {
              const o = (row * w + x) * 4, i = row * SECTOR + lc;
              if (!mc) fogPixel(data, o);
              else mapPixel(mc.kind(i), mc.base(i), mc.seen(i), biomeOfRow[row], walls, mc.healed[row >> 5] > 0, data, o);
            }
          }
        }
      },
      markers: (c0, c1) => {
        const out: MapMarker[] = [];
        for (let sx = Math.floor(c0 / SECTOR); sx * SECTOR < c1; sx++) {
          const mc = this.loaded.has(sx) || this.columns.has(sx) ? this.mapColumn(sx, false) : null;
          if (!mc) continue;
          for (let i = 0; i < SECTOR * rows; i++) {
            if (!mc.seen(i)) continue;
            const k = mc.kind(i), note = mc.gen.notes.has(i) && k === INSCRIPTION;
            const kind = k === CAMP ? 'camp' : k === CHEST ? 'chest' : k === TORCH ? 'torch' : k === SHRINE ? 'shrine' : note ? 'inscription' : null;
            if (kind) out.push({ kind, col: sx * SECTOR + (i % SECTOR), row: Math.floor(i / SECTOR) });
          }
        }
        return out;
      },
      camp: this.find(CAMP),
    };
  }

  /** Halls of the loaded columns (tests). */
  hallsLoaded(): SectorHall[] { return [...this.loaded].flatMap(sx => this.columns.get(sx)?.gen.halls ?? []); }
  /** World x of the loaded span, for the camera. */
  get left(): number { return this.t.colLo * CELL; }
  get right(): number { return this.t.colHi * CELL; }
}

/** First stable id of a wing cell (core ids are below it). */
export const WING_ID = 0x1000000;

export interface MapColumn {
  kind(i: number): number;
  base(i: number): number;
  seen(i: number): boolean;
  healed: number[];
  gen: SectorColumnGen;
}

export { SECTOR, SECTOR_GV };
