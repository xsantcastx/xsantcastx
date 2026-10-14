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
  /** Map v2: the Keeper's pins and Glim's mark (drawn over the markers). */
  pins?: readonly MapPinView[];
  /** Where the full map's dotted way leads: a tracked pin or Glim's mark. Absent: the camp. */
  goal?: { col: number; row: number } | null;
  /** The Broken Astral Compass, held: the nearest thing the map has not been told about. */
  pointer?: { col: number; row: number } | null;
}

/** One pin as the map draws it. */
export interface MapPinView {
  id: string;
  col: number;
  row: number;
  color: string;
  /** Glim's temporary mark: a lamplight diamond, not a pin. */
  glim?: boolean;
  selected?: boolean;
  tracked?: boolean;
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
    const camp = source.goal ?? markers.find(m => m.kind === 'camp');
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
  drawOverlays(c, source, view, ox, oy, s);
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
  const camp = source.goal ?? world.camp;
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
  drawOverlays(c, source, view, ox, oy, s);
  c.restore();
  return length;
}

/**
 * Map v2 overlays: the Broken Astral Compass's ray, the Keeper's pins and
 * Glim's mark, and (the minimap) an arrow on the edge toward a goal that is
 * off it. Pixel glyphs with a dark rim, like the markers.
 */
function drawOverlays(c: CanvasRenderingContext2D, source: MapSource, view: MapView, ox: number, oy: number, s: number): void {
  const k = source.keeper;
  if (source.pointer) {
    // The compass points toward, it does not route: a short dotted ray, ten cells long.
    const dx = source.pointer.col - k.col, dy = source.pointer.row - k.row, d = Math.hypot(dx, dy);
    if (d > 0) {
      const dot = Math.max(2, Math.round(s / 2));
      c.fillStyle = POINTER_COLOR;
      for (let n = 2; n <= Math.min(10, d); n += 1.5) {
        const x = Math.round(ox + (k.col + .5 + dx / d * n) * s - dot / 2), y = Math.round(oy + (k.row + .5 + dy / d * n) * s - dot / 2);
        c.fillRect(x, y, dot, dot);
      }
    }
  }
  const g = Math.max(4, s + 3);
  for (const pin of source.pins ?? []) {
    const x = Math.round(ox + (pin.col + .5) * s), y = Math.round(oy + (pin.row + .5) * s);
    const half = Math.floor(g / 2);
    c.fillStyle = '#140a1f';
    if (pin.glim) {
      // A lamplight diamond: Glim's mark.
      for (let r = -half - 1; r <= half + 1; r++) { const w = half + 1 - Math.abs(r); c.fillRect(x - w, y + r, w * 2 + 1, 1); }
      c.fillStyle = pin.color;
      for (let r = -half; r <= half; r++) { const w = half - Math.abs(r); c.fillRect(x - w, y + r, w * 2 + 1, 1); }
      continue;
    }
    // A map pin: a head over a stem, its tip on the cell.
    const top = y - g - half;
    c.fillRect(x - half - 1, top - 1, g + 2, g + 2);
    c.fillRect(x - 1, top + g, 3, half + 2);
    c.fillStyle = pin.color;
    c.fillRect(x - half, top, g, g);
    c.fillRect(x, top + g, 1, half + 1);
    if (pin.selected || pin.tracked) {
      c.fillStyle = pin.selected ? '#ffffff' : '#140a1f';
      c.fillRect(x - 1, top + half - 1, 3, 3);
    }
  }
  // The minimap: a goal off its edge gets an arrow on the edge, pointing at it.
  const goal = source.goal;
  if (!view.path && goal) {
    const gx = ox + (goal.col + .5) * s, gy = oy + (goal.row + .5) * s;
    if (gx < 0 || gy < 0 || gx > view.width || gy > view.height) {
      const cx = view.width / 2, cy = view.height / 2, dx = gx - cx, dy = gy - cy;
      const t = Math.min((view.width / 2 - 6) / Math.max(1e-6, Math.abs(dx)), (view.height / 2 - 6) / Math.max(1e-6, Math.abs(dy)));
      const ax = cx + dx * t, ay = cy + dy * t, a = Math.atan2(dy, dx), size = Math.max(5, s * 2);
      c.fillStyle = GOAL_COLOR;
      c.beginPath();
      c.moveTo(ax + Math.cos(a) * size, ay + Math.sin(a) * size);
      c.lineTo(ax + Math.cos(a + 2.4) * size, ay + Math.sin(a + 2.4) * size);
      c.lineTo(ax + Math.cos(a - 2.4) * size, ay + Math.sin(a - 2.4) * size);
      c.closePath();
      c.fill();
    }
  }
}
/** The compass ray: rune violet (the art bible's map palette). */
export const POINTER_COLOR = '#c9a4ff';
/** A tracked goal's edge arrow: the dotted way's aged gold. */
const GOAL_COLOR = '#e8c898';

// ── Finding a mark (Glim's step 3; the compass) ─────────────────────────────

/** What Glim marks for a mission: the first of these that the Delve holds. */
export interface MarkTarget {
  /** A terrain node id (the nearest one standing). */
  node?: string;
  /** One carved inscription by id. */
  inscription?: string;
  /** The nearest carving in the core not yet copied. */
  unread?: boolean;
  /** The nearest settled water or lava, optionally between two rows. */
  liquid?: 'water' | 'lava';
  rows?: readonly [number, number];
}
/** A read-only view of the cells a mark may be found in (the core, wherever the ring is). */
export interface CellReader {
  col0: number;
  col1: number;
  rows: number;
  kind(col: number, row: number): number;
  /** Liquid type (0 none, 1 water, 2 lava) with level > 0, else 0. */
  liquid(col: number, row: number): number;
  note(col: number, row: number): string | undefined;
}
const NODE_INDEX = new Map(TERRAIN_NODE_LIST.map((node, i) => [node.id, i]));
/**
 * The cell a mark points at: the first target in `targets` that resolves, the
 * nearest such cell to `from`. Null when none does (the thing was dug out).
 * A scan of the reader's cells: call it on a HUD tick, never per frame.
 */
export function findMark(r: CellReader, targets: readonly MarkTarget[], from: { col: number; row: number }, isRead: (id: string) => boolean = () => false): { col: number; row: number } | null {
  for (const target of targets) {
    const node = target.node ? NODE_INDEX.get(target.node) : undefined;
    if (target.node && node === undefined) continue;
    const liquid = target.liquid === 'water' ? 1 : target.liquid === 'lava' ? 2 : 0;
    const [r0, r1] = target.rows ?? [0, r.rows];
    let best: { col: number; row: number } | null = null, bestD = Infinity;
    for (let col = r.col0; col < r.col1; col++) for (let row = Math.max(0, r0); row < Math.min(r.rows, r1); row++) {
      let hit = false;
      if (node !== undefined) hit = r.kind(col, row) === node;
      else if (target.inscription) hit = r.note(col, row) === target.inscription;
      else if (target.unread) { const id = r.note(col, row); hit = !!id && !id.startsWith('field:') && !isRead(id); }
      else if (liquid) hit = r.liquid(col, row) === liquid;
      if (!hit) continue;
      const d = (col - from.col) * (col - from.col) + (row - from.row) * (row - from.row);
      if (d < bestD) { bestD = d; best = { col, row }; }
    }
    if (best) return best;
  }
  return null;
}
/** A reader over a plain grid (the shipped core before the endless Delve; tests). */
export function terrainReader(t: Terrain): CellReader {
  return {
    col0: t.colLo, col1: t.colHi, rows: t.rows,
    kind: (col, row) => t.kind[t.index(col, row)],
    liquid: (col, row) => { const i = t.index(col, row); return t.liqLevel[i] > 0 ? t.liqType[i] : 0; },
    note: (col, row) => t.inscriptions.get(t.index(col, row)),
  };
}

