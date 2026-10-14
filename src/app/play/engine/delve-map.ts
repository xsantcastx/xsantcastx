/**
 * delve-map.ts — the Delve's map (Terraria's minimap and full map): fog of war,
 * the map picture, its markers and the "way to camp" hint. Pure apart from the
 * one draw function; the engine owns the fog bits and the HUD draws them.
 *
 * Fog of war is one bit per cell, set once the Keeper has been near it. It is
 * saved with the Delve's diff (delve-save.model.ts `encodeSeen`), under the
 * same layout key, so a reload shows what was explored and nothing more.
 */
import { Terrain, TERRAIN_NODE_LIST, isOneWay } from './terrain';

/** How far round the Keeper the map fills in, in cells. */
export const REVEAL_CELLS = 6;

/** A fog bitset for a grid of `cells` cells: all unexplored. */
export function createFog(cells: number): Uint8Array { return new Uint8Array((cells + 7) >> 3); }

export function isSeen(fog: Uint8Array, index: number): boolean {
  return index >= 0 && (index >> 3) < fog.length && (fog[index >> 3] & (1 << (index & 7))) !== 0;
}

/** Mark every cell whose centre lies within `radius` cells of (col, row) as explored. True when anything was new. Pure apart from `fog`. */
export function revealAround(t: Terrain, fog: Uint8Array, col: number, row: number, radius = REVEAL_CELLS): boolean {
  let changed = false;
  const span = Math.ceil(radius), r2 = radius * radius;
  for (let r = Math.max(0, row - span); r <= Math.min(t.rows - 1, row + span); r++) {
    for (let c = Math.max(t.colLo, col - span); c <= Math.min(t.colHi - 1, col + span); c++) {
      if ((c - col) * (c - col) + (r - row) * (r - row) > r2) continue;
      const i = t.index(c, r), bit = 1 << (i & 7);
      if (fog[i >> 3] & bit) continue;
      fog[i >> 3] |= bit;
      changed = true;
    }
  }
  return changed;
}

/** How many cells are explored. */
export function seenCount(fog: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < fog.length; i++) { let b = fog[i]; while (b) { b &= b - 1; n++; } }
  return n;
}

// ── The picture ─────────────────────────────────────────────────────────────

/** Unexplored rock: the style guide's deepest ink. */
const FOG_RGB = [20, 10, 31] as const;
/** Generated air (the caverns): a dark cave tone, so open ways read at a glance. */
const CAVE_RGB = [44, 34, 52] as const;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Each node's map colour: its body colour, a step brighter so the map reads on a dark HUD. */
const NODE_RGB = TERRAIN_NODE_LIST.map(node => rgb(node.base).map(v => Math.min(255, Math.round(v * 1.25 + 8))) as [number, number, number]);

/**
 * Paint the map, one RGBA pixel per cell, into `data` (cols × rows × 4).
 * Unexplored cells are fog; explored rock is its colour; a dug cell shows the
 * biome's back wall; a cavern is the cave tone. Pure apart from `data`.
 */
export function paintMap(t: Terrain, fog: Uint8Array, data: Uint8ClampedArray): void {
  const walls = t.biomes.map(biome => rgb(biome.wall[0]).map(v => Math.min(255, v + 18)));
  for (let i = 0; i < t.kind.length; i++) {
    const o = i * 4;
    let color: readonly number[];
    if (!isSeen(fog, i)) color = FOG_RGB;
    else if (t.kind[i] !== 0) color = NODE_RGB[t.kind[i]];
    else if (t.base[i] !== 0) color = walls[t.biomeOfRow[(i / t.cols) | 0]] ?? CAVE_RGB;
    else color = CAVE_RGB;
    data[o] = color[0]; data[o + 1] = color[1]; data[o + 2] = color[2]; data[o + 3] = 255;
  }
}

/** The back-wall map colour per biome (a dug cell). */
export function mapWalls(biomes: Terrain['biomes']): number[][] { return biomes.map(biome => rgb(biome.wall[0]).map(v => Math.min(255, v + 18))); }
/** A sector the Delve took back (regrowth): its explored cells, muted toward this. */
const REGROWN_RGB = [90, 82, 104] as const;
/**
 * One map pixel (the endless Delve paints column by column, sector-world.ts):
 * the same colours as `paintMap`, and a regrown sector's cells half-way to a
 * muted grey-violet ("the Delve took this back"). Pure apart from `data`.
 */
export function mapPixel(kind: number, base: number, seen: boolean, biome: number, walls: readonly (readonly number[])[], regrown: boolean, data: Uint8ClampedArray, o: number): void {
  let color: readonly number[];
  if (!seen) color = FOG_RGB;
  else if (kind !== 0) color = NODE_RGB[kind];
  else if (base !== 0) color = walls[biome] ?? CAVE_RGB;
  else color = CAVE_RGB;
  if (seen && regrown) {
    data[o] = (color[0] + REGROWN_RGB[0]) >> 1; data[o + 1] = (color[1] + REGROWN_RGB[1]) >> 1; data[o + 2] = (color[2] + REGROWN_RGB[2]) >> 1;
  } else { data[o] = color[0]; data[o + 1] = color[1]; data[o + 2] = color[2]; }
  data[o + 3] = 255;
}
/** Fog, for columns the map has no picture of. */
export function fogPixel(data: Uint8ClampedArray, o: number): void { data[o] = FOG_RGB[0]; data[o + 1] = FOG_RGB[1]; data[o + 2] = FOG_RGB[2]; data[o + 3] = 255; }

export type MapMarkerKind = 'keeper' | 'camp' | 'chest' | 'torch' | 'inscription' | 'shaft' | 'shrine'
  // The Underhearth (Phase 8): Rift Anchors, the Four's hammer-marks, the Banked Furnace.
  | 'anchor' | 'mark' | 'furnace';
export interface MapMarker { kind: MapMarkerKind; col: number; row: number }

const CAMP = TERRAIN_NODE_LIST.findIndex(node => node.id === 'camp');
const CHEST = TERRAIN_NODE_LIST.findIndex(node => node.id === 'chest');
const TORCH = TERRAIN_NODE_LIST.findIndex(node => node.id === 'torch');

/** The explored camp, chests, torches and carved walls, then the shafts (always known) and the Keeper. */
export function mapMarkers(t: Terrain, fog: Uint8Array, keeper: { col: number; row: number }, shafts: readonly number[]): MapMarker[] {
  const out: MapMarker[] = [];
  for (let i = 0; i < t.kind.length; i++) {
    const k = t.kind[i];
    if (k !== CAMP && k !== CHEST && k !== TORCH && !t.inscriptions.has(i)) continue;
    if (!isSeen(fog, i)) continue;
    out.push({ kind: k === CAMP ? 'camp' : k === CHEST ? 'chest' : k === TORCH ? 'torch' : 'inscription', col: t.colOf(i), row: t.rowOf(i) });
  }
  for (const col of shafts) out.push({ kind: 'shaft', col, row: -1 });
  out.push({ kind: 'keeper', ...keeper });
  return out;
}

/**
 * The way to `to` through open, explored cells (4-neighbour, rows above the
 * grid count as open sky), as cell indices from `from` to `to`, or null when
 * nothing explored joins them (the player must dig). A breadth-first search
 * over the grid: call it when the map is drawn, never per frame.
 */
export function pathThrough(t: Terrain, fog: Uint8Array, from: number, to: number): number[] | null {
  const n = t.kind.length;
  if (from < 0 || to < 0 || from >= n || to >= n) return null;
  const open = (i: number) => i === to || i === from || (isSeen(fog, i) && (!t.solid(t.colOf(i), t.rowOf(i)) || isOneWay(t, t.colOf(i), t.rowOf(i))));
  const prev = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  queue[tail++] = from; prev[from] = from;
  while (head < tail) {
    const i = queue[head++];
    if (i === to) break;
    const col = t.colOf(i), row = t.rowOf(i);
    const next = [t.inside(col - 1, row) ? t.index(col - 1, row) : -1, t.inside(col + 1, row) ? t.index(col + 1, row) : -1, i - t.cols, i + t.cols];
    for (const j of next) {
      if (j < 0 || j >= n || prev[j] !== -1 || !open(j)) continue;
      prev[j] = i; queue[tail++] = j;
    }
  }
  if (prev[to] === -1) return null;
  const path: number[] = [];
  for (let i = to; i !== from; i = prev[i]) path.push(i);
  path.push(from);
  return path.reverse();
}

// ── Drawing ─────────────────────────────────────────────────────────────────

export interface MapView {
  /** Canvas size in device pixels. */
  width: number; height: number;
  /** Device pixels per cell: a whole number, so cells stay crisp squares. */
  scale: number;
  /** The cell (fractional) at the canvas centre. */
  centerCol: number; centerRow: number;
  /** Draw the way to camp (the full map). */
  path?: boolean;
}

export interface MapSource {
  t: Terrain;
  fog: Uint8Array;
  keeper: { col: number; row: number };
  /** Columns of the Delve's ways out at the surface. */
  shafts: readonly number[];
  /** The endless Delve: the whole explored world, beyond the loaded ring `t` (sector-world.ts). */
  world?: WorldMap;
}

/** The endless Delve's map, in world columns (map v2: drawn column by column from sector pictures). */
export interface WorldMap {
  /** World columns the full map spans when fitted: [col0, col1) (the explored sectors and the core). */
  col0: number;
  col1: number;
  /** Sector columns with anything explored, west to east. */
  sectors: readonly number[];
  /** Paint world columns [c0, c1), every row, into `data` (row stride (c1 − c0) × 4). Unknown columns paint as fog. */
  paint(c0: number, c1: number, data: Uint8ClampedArray): void;
  /** The explored markers in [c0, c1). */
  markers(c0: number, c1: number): MapMarker[];
  /** The camp, wherever it is (the way-to-camp line), or null. */
  camp: { col: number; row: number } | null;
}

/** Marker colours from the art bible's world palettes (style guide §5: aged gold, the camp's fire, rune violet), one per kind. The full map's legend reads them too. */
export const MAP_MARKER_COLORS: Readonly<Record<MapMarkerKind, string>> = {
  keeper: '#f8e8c8', camp: '#ff9b4f', chest: '#a5793a', torch: '#ffd08a', inscription: '#d9b8ff', shaft: '#9db8a8', shrine: '#b88cff',
  anchor: '#e8d8ff', mark: '#ffd08a', furnace: '#E8752A',
};

/** A reusable cell picture per terrain (one canvas, repainted per draw). */
const pictures = new WeakMap<Terrain, { canvas: HTMLCanvasElement; image: ImageData }>();
/** The endless map's picture: one canvas, sized to the columns in view. */
let worldPicture: { canvas: HTMLCanvasElement; image: ImageData } | null = null;

/**
 * Draw the map into `c`: the cell picture scaled nearest-neighbour, the way to
 * camp (full map), then the markers as pixel glyphs. Returns the path length in
 * cells (0 when there is no explored way, -1 when there is no camp).
 */
export function drawDelveMap(c: CanvasRenderingContext2D, source: MapSource, view: MapView): number {
  if (source.world) return drawWorldMap(c, source, source.world, view);
  const { t, fog } = source;
  let picture = pictures.get(t);
  if (!picture) {
    const canvas = document.createElement('canvas');
    canvas.width = t.cols; canvas.height = t.rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;
    picture = { canvas, image: ctx.createImageData(t.cols, t.rows) };
    pictures.set(t, picture);
  }
  paintMap(t, fog, picture.image.data);
  picture.canvas.getContext('2d')!.putImageData(picture.image, 0, 0);
  const s = Math.max(1, Math.round(view.scale));
  const ox = Math.round(view.width / 2 - view.centerCol * s), oy = Math.round(view.height / 2 - view.centerRow * s);
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = `rgb(${FOG_RGB.join(',')})`;
  c.fillRect(0, 0, view.width, view.height);
  // The sky strip over the surface row, so the shaft marker has somewhere to sit.
  c.fillStyle = '#2c3a4e';
  c.fillRect(ox, oy - s * 2, t.cols * s, s * 2);
  c.drawImage(picture.canvas, ox, oy, t.cols * s, t.rows * s);
  const markers = mapMarkers(t, fog, source.keeper, source.shafts);
  let length = -1;
  if (view.path) {
    const camp = markers.find(m => m.kind === 'camp');
    if (camp) {
      const from = t.index(Math.max(0, Math.min(t.cols - 1, source.keeper.col)), Math.max(0, Math.min(t.rows - 1, source.keeper.row)));
      const path = pathThrough(t, fog, from, t.index(camp.col, camp.row));
      const dot = Math.max(1, Math.round(s / 3));
      c.fillStyle = '#e8c898';
      if (path) {
        length = path.length - 1;
        // Every other cell: a dotted trail, Terraria-style.
        for (let n = 1; n < path.length - 1; n += 2) {
          const col = path[n] % t.cols, row = (path[n] - col) / t.cols;
          c.fillRect(ox + col * s + (s - dot) / 2 | 0, oy + row * s + (s - dot) / 2 | 0, dot, dot);
        }
      } else {
        length = 0;
        // No explored way: a sparse straight line, "dig this way".
        const steps = Math.max(1, Math.round(Math.hypot(camp.col - source.keeper.col, camp.row - source.keeper.row) / 3));
        for (let n = 1; n < steps; n++) {
          const col = source.keeper.col + (camp.col - source.keeper.col) * n / steps, row = source.keeper.row + (camp.row - source.keeper.row) * n / steps;
          c.fillRect(Math.round(ox + (col + .5) * s - dot / 2), Math.round(oy + (row + .5) * s - dot / 2), dot, dot);
        }
      }
    }
  }
  drawMarkers(c, markers, ox, oy, s);
  c.restore();
  return length;
}

/** The markers as pixel glyphs: a dark rim, then the colour (reads on any rock). */
function drawMarkers(c: CanvasRenderingContext2D, markers: readonly MapMarker[], ox: number, oy: number, s: number): void {
  const g = Math.max(3, s + 2);
  for (const marker of markers) {
    const x = Math.round(ox + (marker.col + .5) * s), y = Math.round(oy + (marker.row + .5) * s);
    const size = marker.kind === 'keeper' || marker.kind === 'camp' ? g + 2 : g;
    const half = Math.floor(size / 2);
    c.fillStyle = '#140a1f';
    c.fillRect(x - half - 1, y - half - 1, size + 2, size + 2);
    c.fillStyle = MAP_MARKER_COLORS[marker.kind];
    if (marker.kind === 'keeper') {
      // A plus, so the Keeper never reads as a torch.
      const arm = Math.max(1, Math.floor(size / 3));
      c.fillRect(x - half, y - arm / 2 | 0, size, arm);
      c.fillRect(x - arm / 2 | 0, y - half, arm, size);
    } else c.fillRect(x - half, y - half, size, size);
  }
}

/**
 * The endless Delve's map (map v2): only the world columns in view are
 * painted, column by column from the sector pictures (sector-world.ts), so a
 * map of a hundred explored sectors costs what is on screen. The way to camp
 * runs through the loaded ring when the camp is in it, else a dotted straight
 * line points the way.
 */
function drawWorldMap(c: CanvasRenderingContext2D, source: MapSource, world: WorldMap, view: MapView): number {
  const { t, fog } = source;
  const s = Math.max(1, Math.round(view.scale));
  const ox = Math.round(view.width / 2 - view.centerCol * s), oy = Math.round(view.height / 2 - view.centerRow * s);
  // Every column in view (unexplored ones paint as fog): the picture keeps one width while the view does.
  const c0 = Math.floor(-ox / s) - 1, c1 = Math.ceil((view.width - ox) / s) + 1;
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = `rgb(${FOG_RGB.join(',')})`;
  c.fillRect(0, 0, view.width, view.height);
  c.fillStyle = '#2c3a4e';
  c.fillRect(ox + world.col0 * s, oy - s * 2, (world.col1 - world.col0) * s, s * 2);
  const w = c1 - c0;
  if (w > 0) {
    if (!worldPicture || worldPicture.image.width !== w || worldPicture.canvas.height !== t.rows) {
      // Sized to the columns in view; reused while the view keeps its width (no allocation per HUD tick).
      const canvas = worldPicture?.canvas ?? document.createElement('canvas');
      canvas.width = Math.max(w, canvas.width); canvas.height = t.rows;
      const ctx = canvas.getContext('2d');
      if (!ctx) { c.restore(); return -1; }
      worldPicture = { canvas, image: ctx.createImageData(w, t.rows) };
    }
    world.paint(c0, c1, worldPicture.image.data);
    worldPicture.canvas.getContext('2d')!.putImageData(worldPicture.image, 0, 0);
    c.drawImage(worldPicture.canvas, 0, 0, w, t.rows, ox + c0 * s, oy, w * s, t.rows * s);
  }
  const markers = world.markers(c0, c1);
  for (const col of source.shafts) markers.push({ kind: 'shaft', col, row: -1 });
  markers.push({ kind: 'keeper', ...source.keeper });
  let length = -1;
  const camp = world.camp;
  if (view.path && camp) {
    const dot = Math.max(1, Math.round(s / 3));
    c.fillStyle = '#e8c898';
    const inRing = t.inside(camp.col, camp.row) && t.inside(source.keeper.col, Math.max(0, Math.min(t.rows - 1, source.keeper.row)));
    const path = inRing ? pathThrough(t, fog, t.index(source.keeper.col, Math.max(0, Math.min(t.rows - 1, source.keeper.row))), t.index(camp.col, camp.row)) : null;
    if (path) {
      length = path.length - 1;
      for (let n = 1; n < path.length - 1; n += 2) {
        const col = t.colOf(path[n]), row = t.rowOf(path[n]);
        c.fillRect(ox + col * s + (s - dot) / 2 | 0, oy + row * s + (s - dot) / 2 | 0, dot, dot);
      }
    } else {
      length = 0;
      const steps = Math.max(1, Math.round(Math.hypot(camp.col - source.keeper.col, camp.row - source.keeper.row) / 3));
      for (let n = 1; n < steps; n++) {
        const col = source.keeper.col + (camp.col - source.keeper.col) * n / steps, row = source.keeper.row + (camp.row - source.keeper.row) * n / steps;
        c.fillRect(Math.round(ox + (col + .5) * s - dot / 2), Math.round(oy + (row + .5) * s - dot / 2), dot, dot);
      }
    }
  }
  drawMarkers(c, markers, ox, oy, s);
  c.restore();
  return length;
}

