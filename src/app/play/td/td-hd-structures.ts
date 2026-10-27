/**
 * td-hd-structures.ts — buildings, stalls and landmarks built at the isometric angle (Isometric B, HD pixel art;
 * docs/handoff/iso-walls.md). Classic never calls anything here.
 *
 * - **Houses** (td-art `house`, tagged `iso`): two walls seen (the south front with its door, lit; the east side,
 *   shaded), an east gable, a shingled roof over both slopes with eaves, a stone chimney, framed windows with flower
 *   boxes, a step at the door, a soft contact shadow. Timber (plaster in a timber frame with braces), stone and basalt
 *   (staggered courses). The roof is cut away while the Keeper is behind the house, and the walls over him go
 *   see-through (a dithered copy), so a house never hides him.
 * - **Stalls** (td-art `stall`): a counter of goods at a Keeper's waist, four posts, a striped awning high enough that
 *   the stallkeeper's face shows under it, string lights along its lip.
 * - **Landmarks**: the hearth (a ring of fieldstones round crossed logs: cold, grey ash and one coal; lit, a stepped
 *   flame and embers), the Hearth Shrine (a carved plinth, five realm pips, a brass bowl), the fallen purse, a Beacon
 *   on its pole, and a waygate standing on a stone dais.
 *
 * Every picture is painted once per look and cached (a frame only blits, in 16-px strips sorted at the footprint's
 * front edge like any wide object). A house or stall is baked at most one a frame (`beginStructFrame`): until its turn
 * the old sprite stands in, so walking into a town never hitches. Environment detail Low paints plain surfaces (no
 * mottling, flower boxes, moss or shingle noise), no see-through copies (the roof still lifts) and no embers or motes.
 * Light from the upper left, colours from the HD figures' ramps (td-hd-sculpt `rampOf`), one dark outline.
 */
import { PAL, TILE, type IsoSpec, type Sprite } from './td-art';
import { Sculpt, rampOf, type Mat, type Pt } from './td-hd-sculpt';
import { envDetail } from './td-detail';
import { FLAME } from './td-hearth';
import { checker } from './td-iso-walls';
import { OUTLINE } from '../../shared/keeper-look/keeper-paint';

type Rgb = readonly [number, number, number];
const rgb = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const R6 = (base: string, o: Parameters<typeof rampOf>[1] = {}): readonly Rgb[] => rampOf(base, o).map(rgb);
const hash = (a: number, b: number, c = 0): number => { let h = (a * 374761393 + b * 668265263 + c * 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const INK: Rgb = rgb(OUTLINE);
const at = (r: readonly Rgb[], i: number): Rgb => r[Math.max(0, Math.min(r.length - 1, Math.round(i)))];

// ── A pixel buffer and its painters ──
/** An RGBA buffer at the HD pixel (2 a world px), the foot of the structure at (ox, oy). */
class Buf {
  readonly d: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number, readonly ox: number, readonly oy: number) { this.d = new Uint8ClampedArray(w * h * 4); }
  put(i: number, j: number, c: Rgb, a = 255): void {
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return;
    const o = (j * this.w + i) * 4, d = this.d;
    if (a >= 255 || d[o + 3] === 0) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = Math.max(d[o + 3], a); return; }
    const t = a / 255;
    d[o] = d[o] + (c[0] - d[o]) * t; d[o + 1] = d[o + 1] + (c[1] - d[o + 1]) * t; d[o + 2] = d[o + 2] + (c[2] - d[o + 2]) * t;
  }
  /** World point (x, y, h) relative to the foot, in buffer px. */
  P(x: number, y: number, h: number): Pt { return [this.ox + (x - y) * 2, this.oy + (x + y) - h * 2]; }
  /**
   * A parallelogram P0 + a·U + b·V (a, b in 0…1), each pixel's colour from `tex(a, b)` (null: leave it). `mask` trims it
   * (a gable's triangle).
   */
  quad(P0: Pt, P1: Pt, P2: Pt, tex: (a: number, b: number) => Rgb | null, mask?: (a: number, b: number) => boolean, alpha = 255): void {
    const U = [P1[0] - P0[0], P1[1] - P0[1]], V = [P2[0] - P0[0], P2[1] - P0[1]], det = U[0] * V[1] - U[1] * V[0];
    if (Math.abs(det) < 1e-6) return;
    const xs = [P0[0], P1[0], P2[0], P1[0] + V[0]], ys = [P0[1], P1[1], P2[1], P1[1] + V[1]];
    const i0 = Math.max(0, Math.floor(Math.min(...xs))), i1 = Math.min(this.w - 1, Math.ceil(Math.max(...xs))), j0 = Math.max(0, Math.floor(Math.min(...ys))), j1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = i + .5 - P0[0], py = j + .5 - P0[1], a = (px * V[1] - py * V[0]) / det, b = (U[0] * py - U[1] * px) / det;
      if (a < 0 || a > 1 || b < 0 || b > 1 || (mask && !mask(a, b))) continue;
      const c = tex(a, b);
      if (c) this.put(i, j, c, alpha);
    }
  }
  /** The silhouette's one dark outline (only on empty pixels next to opaque ones). */
  outline(ink: Rgb = INK): void {
    const { w, h, d } = this, solid = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 200;
    const edge: number[] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!solid(i, j) && (solid(i + 1, j) || solid(i - 1, j) || solid(i, j + 1) || solid(i, j - 1))) edge.push(i, j);
    for (let k = 0; k < edge.length; k += 2) { const o = (edge[k + 1] * w + edge[k]) * 4; if (d[o + 3] < 200) { d[o] = ink[0]; d[o + 1] = ink[1]; d[o + 2] = ink[2]; d[o + 3] = 255; } }
  }
  canvas(): HTMLCanvasElement {
    const el = document.createElement('canvas'); el.width = this.w; el.height = this.h;
    const g = el.getContext('2d')!, img = g.createImageData(this.w, this.h);
    img.data.set(this.d);
    g.putImageData(img, 0, 0);
    return el;
  }
}

/** A structure at this angle: the body (walls) and the roof on canvases of one size, HD px, the foot at (ax, ay). */
export interface IsoStruct {
  img: HTMLCanvasElement;
  roof: HTMLCanvasElement | null;
  ax: number; ay: number;
  /** The footprint (world px from the foot): x0…x1 east–west, y0…y1 north–south. */
  x0: number; x1: number; y0: number; y1: number;
  /** Lights (iso px from the foot: x, y lifted; r the pool's radius) for the night pass. */
  lights: { x: number; y: number; r: number }[];
  /** Chimney mouths, as the world offsets from the foot whose floor point projects to the mouth (smoke drawn flat there). */
  smoke: { x: number; y: number }[];
  /** The see-through copy of the body, made the first time the Keeper stands behind it. */
  dith?: HTMLCanvasElement;
  /** Painted at Environment detail Low. */
  low: boolean;
  /** Which iso px of the picture (body or roof) are solid: (img.width / 2) × (img.height / 2), one byte each. */
  mask: Uint8Array;
}
/** The solid-pixel mask of a body and a roof (iso px: one per 2×2 HD px). */
function maskOf(a: Buf, b: Buf | null): Uint8Array {
  const w = a.w >> 1, h = a.h >> 1, m = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const o = ((j * 2 + 1) * a.w + i * 2 + 1) * 4 + 3;
    if (a.d[o] > 128 || (b && b.d[o] > 128)) m[j * w + i] = 1;
  }
  return m;
}

// ── Palettes (the HD ramps, warm lights and cool violet shadows) ──
const WOOD = R6('#8a5a36', { cool: '#140a0c', warm: '#ffe0b0', hi: .4 });
const WOOD_DK = R6('#5e3a24', { cool: '#120808', warm: '#e8c098', hi: .35 });
const PLASTER = R6('#e6d2ac', { cool: '#3a2a30', warm: '#fff8e8', hi: .3, deep: .45 });
const STONE = R6('#9a8f86', { cool: '#1a1420', warm: '#f4ead8', hi: .35, deep: .55 });
const BASALT = R6('#5a5263', { cool: '#0e0a14', warm: '#c8c0d8', hi: .35, deep: .6 });
const IRON = R6('#5a5660', { cool: '#0c0a10', warm: '#e8e8f0', hi: .45 });
const GLASS = R6('#3a3654', { cool: '#0e0a1a', warm: '#a8a0d8', hi: .4 });
const WARM = R6('#ffc86a', { cool: '#a85a1a', warm: '#fff8d8', hi: .6, deep: .4 });
const ROOF: Readonly<Record<string, readonly Rgb[]>> = {
  red: R6('#b5482f', { cool: '#2a0a14', warm: '#ffd0a0', hi: .35 }),
  slate: R6('#5c5770', { cool: '#0e0a18', warm: '#d8d0f0', hi: .35 }),
  thatch: R6('#c99a46', { cool: '#3a2010', warm: '#fff0c0', hi: .35 }),
  leaf: R6('#4f8a3a', { cool: '#06140a', warm: '#d0f0a0', hi: .35 }),
  gloam: R6('#4e4566', { cool: '#0a0814', warm: '#c8c0e8', hi: .35 }),
};
const FLOWERS = PAL.flower.map(rgb);
const LEAF = R6('#4f9440', { cool: '#06140a', warm: '#d0f0a0', hi: .35 });

// ── The bake budget ──
/** Structures being painted, a step (a face, a roof, an outline) at a time inside the frame's spare time. */
const pending = new Map<string, Generator<void, IsoStruct, void>>();
const structs = new WeakMap<Sprite, IsoStruct>();
const byKey = new Map<string, IsoStruct>();

/**
 * The structure for an object's sprite (one tagged `iso` by td-art), or null: not one, or not painted yet (it is
 * queued; the caller stands the old sprite up meanwhile). The engine also asks ahead of the walk, so a house is
 * usually ready before it comes into view.
 */
export function isoStructure(sp: Sprite): IsoStruct | null {
  const spec = sp.iso;
  if (!spec) return null;
  const low = envDetail() === 'low', known = structs.get(sp);
  if (known && known.low === low) return known;
  const key = `${JSON.stringify(spec)}:${+low}`, st = byKey.get(key);
  if (st) { structs.set(sp, st); return st; }
  if (!pending.has(key)) pending.set(key, spec.kind === 'house' ? paintHouse(spec, low) : paintStall(spec, low));
  return null;
}
/**
 * Paint the queued structures a step at a time until `deadline` (performance.now ms); at least one step a frame, so the
 * queue always moves. False while any is left.
 */
export function stepStructures(deadline: number): boolean {
  let first = true;
  for (const [key, gen] of pending) {
    while (first || performance.now() < deadline) {
      first = false;
      const r = gen.next();
      if (r.done) { byKey.set(key, r.value); pending.delete(key); break; }
    }
    if (performance.now() >= deadline) break;
  }
  return pending.size === 0;
}
/** The structure already baked for a sprite (never bakes: for the update's smoke). */
export function bakedStructure(sp: Sprite): IsoStruct | null { return structs.get(sp) ?? null; }

/** The see-through copy of a structure's body (a 2×2 HD checker cleared), made once. */
export function structDither(st: IsoStruct): HTMLCanvasElement {
  if (st.dith) return st.dith;
  const el = document.createElement('canvas'); el.width = st.img.width; el.height = st.img.height;
  const g = el.getContext('2d')!;
  g.drawImage(st.img, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = g.createPattern(checker(), 'repeat')!;
  g.fillRect(0, 0, el.width, el.height);
  return (st.dith = el);
}

/**
 * A plank floor over a structure's footprint (shown while its roof is lifted, so the inside is a room, not grass), with
 * its foot at world (fx, fy), drawn in iso screen px on `c` (already in iso screen space).
 */
export function drawStructFloor(c: CanvasRenderingContext2D, st: IsoStruct, fx: number, fy: number): void {
  const P = (x: number, y: number): [number, number] => [(fx + x) - (fy + y), ((fx + x) + (fy + y)) / 2];
  const hex = (v: Rgb): string => `rgb(${v[0]},${v[1]},${v[2]})`;
  const corners = [P(st.x0, st.y0), P(st.x1, st.y0), P(st.x1, st.y1), P(st.x0, st.y1)];
  c.save();
  c.beginPath(); corners.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  c.fillStyle = hex(at(WOOD_DK, 2)); c.fill();
  c.clip();
  // Board seams every 4 world px, running east–west; 1 art px (½ iso px) wide.
  c.strokeStyle = hex(at(WOOD_DK, 0)); c.lineWidth = .5;
  c.beginPath();
  for (let y = st.y0 + 4; y < st.y1; y += 4) { const a = P(st.x0, y), b = P(st.x1, y); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
  c.stroke();
  c.restore();
}

/**
 * The depth (iso Y) a strip at iso X sorts at: the footprint's front edge under it (the south edge left of the
 * south-east corner, the east edge right of it). `fx, fy` the foot (world px).
 */
export function stripDepth(st: IsoStruct, fx: number, fy: number, X: number): number {
  const x0 = fx + st.x0, x1 = fx + st.x1, y0 = fy + st.y0, y1 = fy + st.y1, Xc = x1 - y1;
  return X <= Xc ? Math.max(X, x0 - y1) / 2 + y1 : x1 - Math.min(X, x1 - y0) / 2;
}

/**
 * Is the Keeper (iso px PX, PY: his foot) behind structure `st` with its foot at (fx, fy)? His body (40 iso px up from
 * the foot) overlaps its picture and his foot is behind the front edge under him.
 */
export function keeperBehind(st: IsoStruct, fx: number, fy: number, PX: number, PY: number): boolean {
  const FX = fx - fy, FY = (fx + fy) / 2, left = FX - st.ax / 2, top = FY - st.ay / 2, w = st.img.width >> 1, h = st.img.height >> 1;
  if (PY >= stripDepth(st, fx, fy, PX) - 1) return false;
  // Does the picture cover him: his shins, chest or head, or a little either side?
  for (const dy of [6, 18, 32]) for (const dx of [-5, 0, 5]) {
    const i = Math.round(PX + dx - left), j = Math.round(PY - dy - top);
    if (i >= 0 && j >= 0 && i < w && j < h && st.mask[j * w + i]) return true;
  }
  return false;
}

// ── Houses ──
type HouseSpec = Extract<IsoSpec, { kind: 'house' }>;
/** A house's wall height and door (iso px): the front a head over a Keeper, the door a little over him. */
const HOUSE_WALL = 42, DOOR_H = 30, DOOR_W = 10;

function* paintHouse(s: HouseSpec, low: boolean): Generator<void, IsoStruct, void> {
  const x0 = -s.w * TILE / 2 + 1, x1 = s.w * TILE / 2 - 1, y0 = -(s.d + 1) * TILE + 2, y1 = -1;
  const Hw = HOUSE_WALL, depth = y1 - y0, ym = (y0 + y1) / 2, R = Math.round(depth * .5 + 8), oh = 3, eave = Hw - 2;
  const cx = (hash(s.w, s.d, s.seed) > .5 ? .26 : -.3) * (x1 - x0);
  // The canvas: every corner the picture reaches.
  const pts: [number, number, number][] = [[x0 - oh, y1 + oh, 0], [x1 + oh, y1 + oh, 0], [x1 + oh, y0 - oh, 0], [x0 - oh, y0 - oh, eave], [x0 - oh, ym, Hw + R], [x1 + oh, ym, Hw + R], [cx, ym, Hw + R + 14], [x1 + 6, y1 + 6, 0]];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y, h] of pts) { const X = (x - y) * 2, Y = (x + y) - h * 2; minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y); }
  const W = Math.ceil(maxX - minX) + 8, H = Math.ceil(maxY - minY) + 8, ox = Math.round(-minX) + 4, oy = Math.round(-minY) + 4;
  const body = new Buf(W, H, ox, oy), roof = new Buf(W, H, ox, oy), P = body.P.bind(body);
  const wallR = s.wall === 'stone' ? STONE : s.wall === 'basalt' ? BASALT : PLASTER;
  const lights: IsoStruct['lights'] = [];

  // The contact shadow on the floor, south and east of the walls (soft, two steps).
  const shade: Rgb = rgb('#140c1c');
  body.quad(P(x0, y1, 0), P(x1 + 4, y1, 0), P(x0, y1 + 4, 0), () => shade, undefined, 70);
  body.quad(P(x1, y0, 0), P(x1, y1 + 4, 0), P(x1 + 4, y0, 0), () => shade, undefined, 70);
  yield;

  // Windows and the door along the front (u, world px from the west end) and the side (u from the south end).
  const fw = x1 - x0, door = { u0: fw / 2 - DOOR_W / 2, u1: fw / 2 + DOOR_W / 2 };
  const winsS: number[] = [];
  for (let u = 6; u + 9 < fw; u += 20) if (Math.abs(u + 4.5 - fw / 2) > 12) winsS.push(u);
  const winsE: number[] = [];
  for (let u = 7; u + 9 < depth; u += 22) winsE.push(u);
  const WIN_V0 = 15, WIN_V1 = 29;

  /** A wall's surface at (u along it, v up), `lit` 0 front, −1.5 side; null leaves the pixel for a detail. */
  const wallTex = (u: number, v: number, len: number, lit: number, wins: readonly number[], hasDoor: boolean): Rgb => {
    const ao = v < 3 ? -1 : 0;
    // The eave's shadow under the roof.
    const eaveSh = v > Hw - 5 ? -1 : 0;
    // The door: planks in a dark frame, iron straps, a brass ring.
    if (hasDoor && u > door.u0 - 2 && u < door.u1 + 2 && v < DOOR_H + 2) {
      if (u < door.u0 || u > door.u1 || v > DOOR_H) return at(WOOD_DK, 1 + lit);
      if ((v > 7 && v < 9) || (v > DOOR_H - 8 && v < DOOR_H - 6)) return at(IRON, (v % 2 < 1 ? 3 : 2) + lit);
      if (Math.abs(u - (door.u1 - 2)) < 1 && Math.abs(v - 15) < 1.2) return at(WARM, 3);
      const plank = Math.floor((u - door.u0) / 2.5);
      return at(WOOD, ((u - door.u0) % 2.5 < .5 ? 1 : 2 + (plank & 1)) + lit + (v > DOOR_H - 3 ? -1 : 0));
    }
    // A window: a timber frame, four panes (dark glass, a cool glint, a warm glow at the sill), a sill and a flower box.
    for (const w of wins) {
      if (u < w - 1.5 || u > w + 10.5 || v < WIN_V0 - 3 || v > WIN_V1 + 1.5) continue;
      if (v < WIN_V0 - .5) {
        if (low || v > WIN_V0 - 1.5) return at(WOOD, (v > WIN_V0 - 1.5 ? 4 : 2) + lit);
        const f = Math.floor((u - w + 1.5) / 1.6);
        return (f & 1) ? at(LEAF, 3 + lit) : FLOWERS[(f + Math.floor(w)) % FLOWERS.length];
      }
      if (u < w || u > w + 9 || v > WIN_V1) return at(WOOD_DK, (v > WIN_V1 ? 3 : 2) + lit);
      if (Math.abs(u - w - 4.5) < .6 || Math.abs(v - (WIN_V0 + WIN_V1) / 2) < .6) return at(WOOD_DK, 3 + lit);
      if (v < WIN_V0 + 2.5) return at(WARM, 2);
      return at(GLASS, ((u - w) + (WIN_V1 - v) * .6 > 9 && (u - w) + (WIN_V1 - v) * .6 < 11 ? 4 : 2) + lit);
    }
    if (s.wall === 'timber') {
      // Plaster in a timber frame: corner and panel posts, a sill beam, a mid rail, the top plate, braces in the panels.
      const panel = len / Math.max(1, Math.round(len / 16)), pu = u % panel;
      if (u < 2 || u > len - 2 || pu < 1.6) return at(WOOD, (u < 1 || pu < .6 ? 4 : 2) + lit + ao);
      if (v < 3) return at(WOOD, 2 + lit + (v < 1 ? -1 : 0));
      if (v > Hw - 3) return at(WOOD, 3 + lit + eaveSh);
      if (v > 13 && v < 15.5) return at(WOOD, (v > 14.6 ? 4 : 2) + lit);
      if (v < 13 && Math.abs((pu - 1.6) - v * (panel - 3) / 13) < 1.1) return at(WOOD, 2 + lit);
      const grain = !low && hash(Math.floor(u * 2), Math.floor(v * 2), s.seed) > .88 ? -1 : 0;
      return at(PLASTER, 3 + lit + grain + eaveSh + ao);
    }
    // Stone and basalt: staggered courses (5 iso px), each stone its own tone, lit top edges; quoins at the corners.
    const course = Math.floor(v / 5), cv = v - course * 5, off = (course & 1) ? 4.5 : 0, cu = u + off, k = Math.floor(cu / 9), su = cu - k * 9;
    const quoin = u < ((course & 1) ? 4 : 7) || u > len - ((course & 1) ? 7 : 4);
    if (cv < .6 || (!quoin && su < .6)) return at(wallR, 0 + lit);
    const tone = quoin ? 4 : 3 + (hash(k, course, s.seed) > .7 ? 1 : hash(k, course, s.seed + 1) < .25 ? -1 : 0);
    return at(wallR, tone + (cv > 4.2 ? 1 : 0) + lit + eaveSh + ao);
  };
  // The front (south) wall and the side (east) wall.
  body.quad(P(x0, y1, 0), P(x1, y1, 0), P(x0, y1, Hw), (a, b) => wallTex(a * fw, b * Hw, fw, 0, winsS, true));
  yield;
  body.quad(P(x1, y1, 0), P(x1, y0, 0), P(x1, y1, Hw), (a, b) => wallTex(a * depth, b * Hw, depth, -1.5, winsE, false));
  yield;
  // The east gable: boards (timber) or the wall's own courses, under the roof.
  const gableTex = (a: number, b: number): Rgb => {
    const u = a * depth, v = b * R;
    if (s.wall === 'timber') return at(WOOD, (Math.floor(u / 3) & 1 ? 2 : 3) - 1.5 + (u % 3 < .5 ? -1 : 0) + (v < 2 ? -1 : 0));
    return wallTex(u, Hw - 6 + v * .3, depth, -1.5, [], false);
  };
  body.quad(P(x1, y1, Hw), P(x1, y0, Hw), P(x1, y1, Hw + R), gableTex, (a, b) => b <= 1 - Math.abs(2 * a - 1));
  yield;
  // A round vent in the gable.
  if (!low) { const [vx, vy] = P(x1, ym, Hw + R * .45); for (let j = -3; j <= 3; j++) for (let i = -2; i <= 2; i++) if (i * i / 5 + j * j / 10 <= 1) body.put(Math.round(vx + i), Math.round(vy + j), j < 0 ? at(WOOD_DK, 0) : at(WARM, 1)); }
  // The step at the door.
  {
    const u0 = x0 + door.u0 - 2, u1 = x0 + door.u1 + 2;
    body.quad(P(u0, y1 + 3, 0), P(u1, y1 + 3, 0), P(u0, y1 + 3, 2), (a, b) => at(STONE, b > .6 ? 4 : 2));
    body.quad(P(u0, y1, 2), P(u1, y1, 2), P(u0, y1 + 3, 2), (a) => at(STONE, a < .1 ? 5 : 4));
    body.quad(P(u1, y1 + 3, 0), P(u1, y1, 0), P(u1, y1 + 3, 2), () => at(STONE, 1));
  }
  body.outline();
  yield;

  // The roof: north slope (mostly hidden), then the south slope over it; shingles in courses along the ridge.
  const rr = ROOF[s.roof] ?? ROOF['red'], slope = Math.hypot(depth / 2 + oh, R + 2), rows = Math.max(4, Math.round(slope / 3.2));
  const roofTex = (a: number, b: number, lit: number): Rgb => {
    const u = a * (fw + oh * 2), row = Math.floor(b * rows), rb = b * rows - row;
    if (b > .96) return at(rr, 4 + lit);                      // the ridge cap
    if (b < .04) return at(rr, 0 + lit);                      // the eave's dark lip
    if (s.roof === 'thatch') {
      const streak = !low && hash(Math.floor(u * 1.5), row, s.seed) > .7 ? -1 : 0;
      return at(rr, 3 + lit + streak + (rb > .75 ? -1 : 0));
    }
    if (s.roof === 'leaf') {
      const blob = Math.sin(u * 1.3 + row * 2) > .3 ? 1 : 0;
      return at(rr, 2 + lit + blob + (rb > .8 ? -1 : 0));
    }
    const wdt = s.roof === 'slate' ? 6 : 4.5, su = (u + (row & 1) * wdt / 2) % wdt;
    if (su < .6 || rb > .82) return at(rr, 1 + lit);
    const tone = low ? 0 : hash(Math.floor((u + (row & 1) * wdt / 2) / wdt), row, s.seed) > .78 ? 1 : 0;
    return at(rr, 3 + lit + tone + (rb < .25 ? 1 : 0));
  };
  roof.quad(P(x0 - oh, y0 - oh, eave), P(x1 + oh, y0 - oh, eave), P(x0 - oh, ym, Hw + R), (a, b) => roofTex(a, b, -1.5));
  yield;
  roof.quad(P(x0 - oh, y1 + oh, eave), P(x1 + oh, y1 + oh, eave), P(x0 - oh, ym, Hw + R), (a, b) => roofTex(a, b, .3));
  yield;
  // The chimney: a stone stack through the south slope, a dark mouth, a lit cap.
  const smoke: IsoStruct['smoke'] = [];
  if (s.chimney) {
    const c0 = cx - 3, c1 = cx + 3, cy0 = ym - 1, cy1 = ym + 5, base = Hw + R * .55, top = Hw + R + 9;
    roof.quad(P(c0, cy1, base), P(c1, cy1, base), P(c0, cy1, top), (a, b) => { const v = b * (top - base), cs = Math.floor(v / 3.5); return at(STONE, (v % 3.5 < .6 || (a * 6 + (cs & 1) * 1.5) % 3 < .4 ? 1 : 3) + (b < .15 ? -1 : 0)); });
    roof.quad(P(c1, cy1, base), P(c1, cy0, base), P(c1, cy1, top), (a, b) => { const v = b * (top - base); return at(STONE, v % 3.5 < .6 ? 0 : 2); });
    roof.quad(P(c0 - .5, cy0 - .5, top), P(c1 + .5, cy0 - .5, top), P(c0 - .5, cy1 + .5, top), (a, b) => (a > .2 && a < .8 && b > .2 && b < .8 ? at(IRON, 0) : at(STONE, 5)));
    // The smoke's spawn: the floor point that projects to the chimney's mouth.
    const mx = cx, my = (cy0 + cy1) / 2, X = mx - my, Y = (mx + my) / 2 - top;
    smoke.push({ x: Y + X / 2, y: Y - X / 2 });
  }
  roof.outline();
  yield;
  // The windows glow at night (pools at their sills, lifted).
  for (const u of winsS) { const [px, py] = body.P(x0 + u + 4.5, y1, WIN_V0 + 4); lights.push({ x: (px - ox) / 2, y: (py - oy) / 2, r: 16 }); }
  for (const u of winsE) { const [px, py] = body.P(x1, y1 - u - 4.5, WIN_V0 + 4); lights.push({ x: (px - ox) / 2, y: (py - oy) / 2, r: 14 }); }
  return { img: body.canvas(), roof: roof.canvas(), ax: ox, ay: oy, x0: -s.w * TILE / 2, x1: s.w * TILE / 2, y0: -(s.d + 1) * TILE, y1: 0, lights, smoke, low, mask: maskOf(body, roof) };
}

// ── Stalls ──
type StallSpec = Extract<IsoSpec, { kind: 'stall' }>;
const AWNING = PAL.awning.map(([a, b]) => [R6(a, { cool: '#1a0a14', warm: '#fff4d8', hi: .35 }), R6(b, { cool: '#3a2a30', warm: '#ffffff', hi: .3, deep: .4 })] as const);

function* paintStall(s: StallSpec, low: boolean): Generator<void, IsoStruct, void> {
  const x0 = -s.w * TILE / 2 + 1, x1 = s.w * TILE / 2 - 1, y0 = -TILE + 1, y1 = -1, fw = x1 - x0;
  const CH = 15, POST = 54, AF = 50, AB = 58, ay1 = y1 + 4, ay0 = y0 + 4;
  const pts: [number, number, number][] = [[x0 - 2, ay1 + 2, 0], [x1 + 3, ay1 + 3, 0], [x1 + 2, y0 - 2, 0], [x0 - 2, ay0, AB + 2], [x1 + 2, ay0, AB + 2], [x0 - 2, ay1 + 2, AF - 3]];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y, h] of pts) { const X = (x - y) * 2, Y = (x + y) - h * 2; minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y); }
  const W = Math.ceil(maxX - minX) + 8, H = Math.ceil(maxY - minY) + 8, ox = Math.round(-minX) + 4, oy = Math.round(-minY) + 4;
  const body = new Buf(W, H, ox, oy), roof = new Buf(W, H, ox, oy), P = body.P.bind(body);
  const shade: Rgb = rgb('#140c1c');
  body.quad(P(x0, y1, 0), P(x1 + 3, y1, 0), P(x0, y1 + 3, 0), () => shade, undefined, 60);
  // A box: south, east, top faces with tones from `r`.
  const box = (b: Buf, bx0: number, by0: number, bx1: number, by1: number, h0: number, h1: number, r: readonly Rgb[], tex?: (u: number, v: number, f: 0 | 1 | 2) => Rgb | null) => {
    b.quad(b.P(bx0, by1, h0), b.P(bx1, by1, h0), b.P(bx0, by1, h1), (a, c) => tex?.(a * (bx1 - bx0), c * (h1 - h0), 0) ?? at(r, 3));
    b.quad(b.P(bx1, by1, h0), b.P(bx1, by0, h0), b.P(bx1, by1, h1), (a, c) => tex?.(a * (by1 - by0), c * (h1 - h0), 1) ?? at(r, 1));
    b.quad(b.P(bx0, by0, h1), b.P(bx1, by0, h1), b.P(bx0, by1, h1), (a, c) => tex?.(a * (bx1 - bx0), c * (by1 - by0), 2) ?? at(r, 4));
  };
  // The back posts, then the counter, then the front posts.
  box(body, x0, y0, x0 + 2, y0 + 2, 0, POST, WOOD);
  box(body, x1 - 2, y0, x1, y0 + 2, 0, POST, WOOD);
  box(body, x0, y1 - 6, x1, y1, 0, CH, WOOD, (u, v, f) => {
    if (f === 2) return at(WOOD, (Math.floor(u / 3) & 1 ? 4 : 5) - (u % 3 < .4 ? 1 : 0));
    const lit = f === 0 ? 0 : -1.5;
    if (v > CH - 2) return at(WOOD, 4 + lit);
    if (v < 2) return at(WOOD_DK, 1 + lit);
    return at(WOOD, ((u % 4) < .5 ? 1 : 2 + (Math.floor(u / 4) & 1)) + lit);
  });
  yield;
  // The goods on the counter, in rows.
  const goods = s.goods, cols: Readonly<Record<typeof goods, readonly string[]>> = {
    pots: ['#8a4fb0', '#e8506a', '#4b90d6', '#5a9a49', '#f2c94c'], bread: ['#c98a45', '#d9a35c', '#b0763a'], gems: ['#7fd5ff', '#ff6dd7', '#a48bff', '#4dffe0'],
    tools: ['#9aa2ad', '#7a828d'], books: ['#8f3524', '#3f78b5', '#5a9a49', '#8a4fb0'], fish: ['#9fb7c9', '#c9a26f', '#7fa3c2'],
  };
  for (let x = x0 + 2.5, i = 0; x < x1 - 3; x += 4, i++) {
    const ramp = R6(cols[goods][Math.floor(hash(i, s.seed, 3) * cols[goods].length)], { cool: '#1a0a14', warm: '#ffffff', hi: .4 });
    const gy = y1 - 3 - (i & 1) * 1.5, tall = goods === 'pots' ? 5 : goods === 'books' ? 4 : goods === 'tools' ? 7 : 2.5;
    const wdt = goods === 'tools' ? 1 : goods === 'fish' ? 3.5 : 2.4;
    box(body, x, gy - 1.5, x + wdt, gy, CH, CH + tall, ramp);
    if (goods === 'tools') box(body, x - 1, gy - 1.5, x + 2, gy, CH + tall - 1.5, CH + tall, IRON);
  }
  box(body, x0, y1 - 2, x0 + 2, y1, 0, POST - 4, WOOD);
  box(body, x1 - 2, y1 - 2, x1, y1, 0, POST - 4, WOOD);
  body.outline();
  yield;
  // The awning: a striped slope from the back (high) to the front lip (low), a scalloped valance and string lights.
  const [A, B] = AWNING[s.palette % AWNING.length];
  const stripe = (u: number) => (Math.floor(u / 4) & 1 ? B : A);
  roof.quad(P(x0 - 2, ay1, AF), P(x1 + 2, ay1, AF), P(x0 - 2, ay0, AB), (a, b) => at(stripe(a * (fw + 4)), (b > .92 ? 2 : 3) + (b < .12 ? 1 : 0)));
  yield;
  roof.quad(P(x0 - 2, ay1, AF - 3), P(x1 + 2, ay1, AF - 3), P(x0 - 2, ay1, AF), (a, b) => { const u = a * (fw + 4); return b < .4 && Math.abs((u % 4) - 2) > 1.4 ? null : at(stripe(u), 2); });
  roof.quad(P(x1 + 2, ay1, AF - 3), P(x1 + 2, ay0, AB - 3), P(x1 + 2, ay1, AF), (a) => at(stripe(a * 18), 1));
  roof.outline();
  yield;
  const lights: IsoStruct['lights'] = [];
  for (let u = 2; u < fw + 2; u += 5) {
    const [px, py] = roof.P(x0 - 2 + u, ay1 + .5, AF - 4);
    roof.put(Math.round(px), Math.round(py), WARM[4]); roof.put(Math.round(px) + 1, Math.round(py), WARM[3]);
    roof.put(Math.round(px), Math.round(py) + 1, WARM[2]); roof.put(Math.round(px) + 1, Math.round(py) + 1, WARM[2]);
    if (!low) lights.push({ x: (px - ox) / 2, y: (py - oy) / 2, r: 6 });
  }
  return { img: body.canvas(), roof: roof.canvas(), ax: ox, ay: oy, x0: -s.w * TILE / 2, x1: s.w * TILE / 2, y0: -TILE, y1: 0, lights, smoke: [], low, mask: maskOf(body, roof) };
}

// ── Landmarks (sculpted, td-hd-sculpt.ts, at the props' scale: 2 HD px a world px) ──
const mat = (base: string, extra: Partial<Mat> = {}, o: Parameters<typeof rampOf>[1] = {}): Mat => ({ ramp: rampOf(base, { cool: '#140a0c', warm: '#ffe0b0', hi: .4, ...o }), round: 1.5, gain: .6, ...extra });
const MT = {
  stone: mat('#8a7e74', { round: 2, gain: .7 }, { cool: '#16121a', warm: '#f0e8dc' }),
  stoneDk: mat('#5e5450', { round: 2, gain: .7 }, { cool: '#100c14', warm: '#d8ccc0' }),
  log: mat('#7a5232'), charred: mat('#3a3038', {}, { cool: '#0a0810', warm: '#a09098' }),
  ash: mat('#8a8090', { round: 3, gain: .4 }, { cool: '#2a2430', warm: '#e8e0f0' }),
  brass: mat('#d0a048', { round: 1, shine: true, gain: .8 }, { cool: '#3a1c08', warm: '#fff8d0', hi: .6 }),
  iron: mat('#5a5660', { round: 1, shine: true, gain: .8 }, { cool: '#100e16', warm: '#f0f0ff', hi: .5 }),
  leather: mat('#8a5a34', { round: 2.5 }),
  cord: mat('#d9c7a4', { round: 1 }),
  violet: mat('#5a3a8a', { round: 2, gain: .7 }, { cool: '#100820', warm: '#d8c0ff' }),
};
function boxS(s: Sculpt, ox: number, oy: number, x0: number, y0: number, x1: number, y1: number, h0: number, h1: number, m: Mat, g: number, top: Mat = m): void {
  const P = (x: number, y: number, h: number): Pt => [ox + (x - y) * 2, oy + (x + y) - h * 2];
  s.poly([P(x0, y1, h0), P(x1, y1, h0), P(x1, y1, h1), P(x0, y1, h1)], m, { g, bias: .2 });
  s.poly([P(x1, y0, h0), P(x1, y1, h0), P(x1, y1, h1), P(x1, y0, h1)], m, { g: g + 1, bias: -.9 });
  s.poly([P(x0, y0, h1), P(x1, y0, h1), P(x1, y1, h1), P(x0, y1, h1)], top, { g: g + 2, bias: .9 });
}
function cylS(s: Sculpt, ox: number, oy: number, cx: number, cy: number, r: number, h0: number, h1: number, m: Mat, g: number, top: Mat = m): void {
  const X = ox + (cx - cy) * 2, Y = oy + (cx + cy), rx = r * 2 * 1.414, ry = r * 1.414;
  s.ellipse(X, Y - h0 * 2, rx, ry, m, { g });
  s.poly([[X - rx, Y - h0 * 2], [X + rx, Y - h0 * 2], [X + rx, Y - h1 * 2], [X - rx, Y - h1 * 2]], m, { g });
  s.ellipse(X, Y - h1 * 2, rx, ry, top, { g: g + 1, bias: .8 });
}
/** A sculpted landmark: its picture and its foot (HD px). */
interface Pic { img: HTMLCanvasElement; ax: number; ay: number }
const pics = new Map<string, Pic>();
function pic(key: string, w: number, h: number, ox: number, oy: number, paint: (s: Sculpt, P: (x: number, y: number, h: number) => Pt) => void): Pic {
  let p = pics.get(key);
  if (p) return p;
  const s = new Sculpt(w, h);
  paint(s, (x, y, hh) => [ox + (x - y) * 2, oy + (x + y) - hh * 2]);
  p = { img: s.render(), ax: ox + 1, ay: oy + 1 };
  pics.set(key, p);
  return p;
}
const blit = (c: CanvasRenderingContext2D, p: Pic, X: number, Y: number) => c.drawImage(p.img, Math.round(X * 2 - p.ax) / 2, Math.round(Y * 2 - p.ay) / 2, p.img.width / 2, p.img.height / 2);

/** The hearth's ring of fieldstones: the back half (behind the fire) or the front half. */
function hearthStones(s: Sculpt, ox: number, oy: number, front: boolean): void {
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + .2, x = Math.cos(a) * 8.5, y = Math.sin(a) * 8.5;
    if ((x + y > 0) !== front) continue;
    const r = 3 + hash(i, 4) * 1.2;
    cylS(s, ox, oy, x, y, r, 0, 2.2 + hash(i, 5) * 1.6, i & 1 ? MT.stone : MT.stoneDk, 10 + i, MT.stone);
  }
}
const HW = 72, HH = 104, HOX = 36, HOY = 84;
/** The hearth's picture behind its fire: the back stones, the ash bed, the logs (charred when cold). */
function hearthBack(lit: boolean): Pic {
  return pic(`hearth-back-${+lit}`, HW, HH, HOX, HOY, (s, P) => {
    hearthStones(s, HOX, HOY, false);
    s.ellipse(...P(0, 0, 0), 15, 7, MT.ash, { g: 40 });
    const L = lit ? MT.log : MT.charred;
    s.limb(P(-5, -3, 1.5), P(5, 3, 1.5), 2.2, 2, L, { g: 50 });
    s.limb(P(-5, 3, 1.5), P(5, -3, 3), 2.2, 2, L, { g: 52 });
    if (!lit) { const [x, y] = P(0, 0, 2.5); s.dot(x - 1, y - 1, '#7a2a1a', 3, 2); s.dot(x, y - 1, '#c8502a', 1, 1); }
    else { const [x, y] = P(0, 0, 1); s.dot(x - 6, y, '#ff8a3a', 3, 1); s.dot(x + 4, y + 1, '#ffb340', 2, 1); }
    // The tripod's back leg.
    s.limb(P(-8, -8, 0), P(0, 0, 27), 1, .8, MT.iron, { g: 60 });
  });
}
/** Over the fire: the stones' front half, the tripod's two front legs, its chain and the soup kettle. */
function hearthFront(): Pic {
  return pic('hearth-front', HW, HH, HOX, HOY, (s, P) => {
    hearthStones(s, HOX, HOY, true);
    s.limb(P(-7, 9, 0), P(0, 0, 27), 1, .8, MT.iron, { g: 70 });
    s.limb(P(9, -6, 0), P(0, 0, 27), 1, .8, MT.iron, { g: 72 });
    s.line(P(0, 0, 27), P(0, 0, 22), '#2a2630');
    s.ellipse(...P(0, 0, 19), 7, 6, MT.iron, { g: 80 });
    s.ellipse(...P(0, 0, 21.5), 5, 2, MT.charred, { g: 82, bias: -.5 });
  });
}

/**
 * The hearth with its foot at world (X, Y) in the iso-anchored frame (td-engine `isoAt`): the ring of fieldstones,
 * crossed logs, and lit, a stepped flame with embers rising (still under reduced motion; no embers on Low).
 */
export function drawIsoHearth(c: CanvasRenderingContext2D, X: number, Y: number, lit: boolean, time: number, still: boolean): void {
  const low = envDetail() === 'low';
  blit(c, hearthBack(lit), X, Y);
  if (lit) isoFlame(c, X, Y - 2.5, 7, 14, time, still, low);
  else if (!still && !low) {
    // One last coal breathing in the ash.
    c.globalAlpha = .35 + .25 * Math.sin(time * 1.7); c.fillStyle = FLAME[1]; c.fillRect(X - .5, Y - 2, 1.5, 1); c.globalAlpha = 1;
  }
  blit(c, hearthFront(), X, Y);
}

/** A stepped flame at the HD pixel: rows bottom up, each a step narrower, three nested colours, its height breathing. */
function isoFlame(c: CanvasRenderingContext2D, X: number, Y: number, w0: number, h0: number, time: number, still: boolean, low: boolean): void {
  const f = still ? 0 : Math.floor(time * 9) % 4, h = h0 + [0, 1, 0, 1.5][f], lean = still ? 0 : [0, .5, 0, -.5][Math.floor(time * 5) % 4];
  for (let i = 0; i < h * 2; i++) {
    const k = i / (h * 2), w = Math.max(1, Math.round(w0 * 2 * (1 - k * k * .9) * (1 - k * .35))), x0 = X - w / 4 + (k > .6 ? lean : 0), y = Y - i / 2;
    c.fillStyle = FLAME[0]; c.fillRect(x0, y, w / 2, .5);
    if (w > 2) { c.fillStyle = FLAME[1]; c.fillRect(x0 + .5, y, w / 2 - 1, .5); }
    if (w > 5 && k < .7) { c.fillStyle = FLAME[2]; c.fillRect(x0 + 1.25, y, w / 2 - 2.5, .5); }
    if (w > 8 && k < .45) { c.fillStyle = FLAME[3]; c.fillRect(x0 + 2, y, w / 2 - 4, .5); }
  }
  if (!still && !low) for (let e = 0; e < 3; e++) {
    const t = (time * .8 + e / 3) % 1;
    c.globalAlpha = 1 - t; c.fillStyle = FLAME[2 + (e & 1)];
    c.fillRect(X - 2 + e * 2 + Math.sin(time * 3 + e) * 1.5, Y - h - 2 - t * 14, .5, .5);
    c.globalAlpha = 1;
  }
}

/** The Hearth Shrine: a carved plinth, the five realm pips on its face (gold for each blessing held), a brass bowl. */
function shrinePic(held: number): Pic {
  return pic(`shrine-${held}`, 64, 92, 32, 76, (s, P) => {
    boxS(s, 32, 76, -7, -7, 7, 7, 0, 3, MT.stoneDk, 10);
    boxS(s, 32, 76, -5.5, -5.5, 5.5, 5.5, 3, 22, MT.stone, 20);
    boxS(s, 32, 76, -6.5, -6.5, 6.5, 6.5, 22, 24.5, MT.stoneDk, 30);
    cylS(s, 32, 76, 0, 0, 4.2, 24.5, 28, MT.brass, 40);
    s.ellipse(...P(0, 0, 28), 9, 4, MT.iron, { g: 50, bias: -.6 });
    // The pips on the south face: a ring of five, gold when held.
    for (let i = 0; i < 5; i++) { const [x, y] = P(-4 + i * 2, 5.5, 12 + (i & 1) * 2); s.dot(x - 1, y - 1, i < held ? '#ffd27a' : '#2e2228', 2, 3); if (i < held) s.dot(x - 1, y - 1, '#fff4c2'); }
    // A carved hearth sign over them.
    const [cx, cy] = P(0, 5.5, 18); s.line([cx - 3, cy], [cx + 3, cy], '#5a4c48'); s.line([cx, cy - 3], [cx, cy + 1], '#5a4c48');
  });
}
/** The Hearth Shrine at world (X, Y) in the iso-anchored frame: a small flame in its bowl while any blessing is held. */
export function drawIsoShrine(c: CanvasRenderingContext2D, X: number, Y: number, held: number, time: number, still: boolean): void {
  const h = Math.max(0, Math.min(5, held));
  blit(c, shrinePic(h), X, Y);
  if (h > 0) isoFlame(c, X, Y - 28.5, 3, 5, time, still, envDetail() === 'low');
}

const pursePic = (): Pic => pic('purse', 40, 40, 20, 28, (s, P) => {
  s.ellipse(...P(0, 0, 3.5), 9, 7, MT.leather, { g: 10 });
  s.ellipse(...P(0, 0, 7.5), 4, 2.5, MT.cord, { g: 20 });
  s.ellipse(...P(0, 0, 9), 6, 3, MT.leather, { g: 30, bias: .4 });
  const [x, y] = P(1, 0, 10); s.dot(x, y - 1, '#fff0a0', 2, 2); s.dot(x, y - 1, '#ffffff');
});
/** The fallen purse at world (X, Y) in the iso-anchored frame: a leather pouch, its cord, a coin, and a faint ember beam. */
export function drawIsoPurse(c: CanvasRenderingContext2D, X: number, Y: number, time: number, still: boolean): void {
  const a = still ? .3 : .22 + Math.sin(time * 2.4) * .1;
  for (let i = 0; i < 28; i++) { c.globalAlpha = a * (1 - i / 28); c.fillStyle = FLAME[2]; c.fillRect(X, Y - 12 - i, 1, 1); }
  c.globalAlpha = .35; c.fillStyle = '#140c1c'; c.beginPath(); c.ellipse(X, Y, 5, 2.5, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  blit(c, pursePic(), X, Y);
}

const beaconPic = (): Pic => pic('beacon', 40, 96, 20, 86, (s, P) => {
  s.ellipse(...P(0, 0, 0), 9, 4.5, MT.stoneDk, { g: 5 });
  boxS(s, 20, 86, -.9, -.9, .9, .9, 0, 27, MT.iron, 10);
  boxS(s, 20, 86, -2.6, -2.6, 2.6, 2.6, 27, 28, MT.brass, 20);
  boxS(s, 20, 86, -2.8, -2.8, 2.8, 2.8, 36, 37.5, MT.brass, 30);
  cylS(s, 20, 86, 0, 0, 1, 37.5, 39, MT.brass, 40);
  for (const [x, y] of [[-2.4, 2.4], [2.4, 2.4], [2.4, -2.4]] as const) s.line(P(x, y, 28), P(x, y, 36), '#7a5a28');
});
/** A Beacon on its pole at world (b.x, b.y) in the iso-anchored frame: the lantern breathing in its brass cage. */
export function drawIsoBeacon(c: CanvasRenderingContext2D, b: { x: number; y: number; t: number }, time: number, still: boolean): void {
  const X = b.x, Y = b.y, glow = still ? 1 : .8 + .2 * Math.sin(time * 5);
  c.globalAlpha = Math.min(1, b.t / .4);
  blit(c, beaconPic(), X, Y);
  c.globalAlpha *= glow;
  c.fillStyle = '#ffc86a'; c.fillRect(X - 2, Y - 36, 4, 7.5);
  c.fillStyle = '#fff3c4'; c.fillRect(X - 1, Y - 35, 2, 5);
  c.fillStyle = '#ffffff'; c.fillRect(X - 1, Y - 34, .5, 2);
  c.globalAlpha = 1;
}

const daisPic = (): Pic => pic('dais', 72, 40, 36, 20, (s, P) => {
  cylS(s, 36, 20, 0, 0, 10, 0, 1.5, MT.stoneDk, 10, MT.stone);
  cylS(s, 36, 20, 0, 0, 7, 1.5, 2.5, MT.stone, 20);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, [x, y] = P(Math.cos(a) * 8.5, Math.sin(a) * 8.5, 1.5); s.dot(x - 1, y, '#a855f7', 2, 1); }
});
const RIM = ['#1e0f38', '#3a1f63', '#7b3fc4', '#a855f7', '#d9b8ff'] as const;
const HEART = ['#ffd27a', '#fff4c2'] as const;
/**
 * A waygate at world (X, Y) in the iso-anchored frame: a stone dais with six seam studs, and over it the standing oval
 * of seam light at the HD pixel (its rim's light walking round, a hearth-gold heart, motes; none on Low or still).
 */
export function drawIsoWaygate(c: CanvasRenderingContext2D, X: number, Y: number, time: number, still: boolean, fade = 1, party = false): void {
  const f = Math.max(.25, Math.min(1, fade)), low = envDetail() === 'low';
  c.save();
  c.globalAlpha = f;
  blit(c, daisPic(), X, Y);
  const W = 18, H = 30, cy = (Y - 2.5) * 2 - H - 1, X2 = Math.round(X * 2), turn = still ? 0 : time * 2.2;
  c.scale(.5, .5);
  for (let r = -H; r <= H; r++) {
    const k = r / H, half = Math.round(W * Math.sqrt(Math.max(0, 1 - k * k)));
    if (half <= 0) continue;
    const y = cy + r;
    c.fillStyle = '#140c1c'; c.fillRect(X2 - half - 1, y, 1, 1); c.fillRect(X2 + half + 1, y, 1, 1);
    const lit = Math.sin(turn + k * 3) > .3;
    c.fillStyle = lit ? (party ? HEART[0] : RIM[4]) : RIM[3]; c.fillRect(X2 - half, y, 2, 1);
    c.fillStyle = lit ? RIM[3] : RIM[2]; c.fillRect(X2 + half - 1, y, 2, 1);
    if (half > 2) {
      c.fillStyle = RIM[1]; c.fillRect(X2 - half + 2, y, half * 2 - 3, 1);
      const inner = Math.max(0, half - 6);
      if (inner > 0 && Math.abs(k) < .8) { c.fillStyle = Math.abs(k) < .35 ? HEART[1] : HEART[0]; c.fillRect(X2 - inner + 1, y, inner * 2 - 1, 1); }
      else if (half > 4) { c.fillStyle = RIM[2]; c.fillRect(X2 - half + 3, y, half * 2 - 5, 1); }
    }
  }
  c.fillStyle = '#140c1c'; c.fillRect(X2 - 2, cy - H - 1, 5, 1); c.fillRect(X2 - 2, cy + H + 1, 5, 1);
  if (!still && !low) for (let i = 0; i < 4; i++) {
    const t = (time * .7 + i / 4) % 1;
    c.globalAlpha = (1 - t) * f; c.fillStyle = i % 2 ? RIM[4] : HEART[0];
    c.fillRect(X2 - 8 + i * 5 + Math.round(Math.sin(time * 3 + i) * 3), cy - H - 3 - Math.round(t * 24), 1, 1);
  }
  c.restore();
}

/** The landmark pictures' total pixels (the memory check). */
export function structPixels(): number { let n = 0; for (const p of pics.values()) n += p.img.width * p.img.height; for (const st of byKey.values()) n += st.img.width * st.img.height * (st.roof ? 2 : 1); return n; }
