/**
 * td-iso-walls.ts — walls in the isometric view (td-artopt.ts `iso`, docs/handoff/iso.md, docs/handoff/iso-walls.md):
 * every block tile (a wall, a rock face, a temple's vine wall, the crypts' drowned wall, the Bole's living wood) that
 * borders open ground stands up as a block with its two camera-facing faces (south: lower left, lit; east: lower right,
 * shaded) and a cap, cached per material and shape — a frame only blits them, depth-sorted with everything standing.
 *
 * **The painted sets** (iso-walls, 2026-10-27): each material is a hand-shaded set at the HD pixel, lit from the upper
 * left like the HD figures (td-hd-sculpt.ts ramps): the mine's hewn stone in staggered courses, the inn's plaster over a
 * board wainscot under a timber beam, the temple's mossy blocks hung with vines, the crypts' wet stone with its tide
 * line and drips, the Bole's ridged bark under a moss cap. A cap with a lit rim and a lip over the faces; an **end
 * piece** (quoins and an inked edge) where a run stops; a lit arris on an outer corner; a **lintel** over every
 * one-tile doorway so a wall reads as a wall with a door in it. Every course lines up across tiles (the patterns repeat
 * every tile), and four stone variants keep a long wall from looking stamped. Environment detail Low paints the plain
 * set: courses and trim, no moss, vines, drips or cracks, and no see-through copies.
 *
 * **Cutaway** (Diablo II), decided per room, not per tile:
 * - Inside a room (the open ground round the Keeper is closed, under `ROOM_CAP` tiles): every wall that bounds the room
 *   on the camera's side (its north or west neighbour is the room's floor) drops to a stub, so the room shows its inside;
 *   its back walls stand.
 * - Anywhere, the walls in a short wedge in front of the Keeper are **dithered** (every other iso px cleared, the classic
 *   see-through), so he is never hidden and the wall still reads; Low cuts them to stubs instead.
 * The room is found again only when the Keeper changes tile (a flood fill of at most ROOM_CAP tiles).
 */
import { rampOf } from './td-hd-sculpt';
import { envDetail } from './td-detail';
import type { Ground } from './td-art';
import { OUTLINE } from '../../shared/keeper-look/keeper-paint';

/** A wall's height in iso px, and the stub a cut-away wall is cut down to. */
export const WALL_H = 46, STUB_H = 6;
/** A lintel's depth below the wall top (iso px): the doorway's opening stands under it. */
const LINTEL_H = 12;
/** A room bigger than this is "the open". */
const ROOM_CAP = 900;

type Mat = 'plaster' | 'rock' | 'vine' | 'drown' | 'bark';
const MAT: Readonly<Record<string, Mat>> = { wall: 'plaster', rock: 'rock', vinewall: 'vine', drownwall: 'drown', bark: 'bark' };
export const wallMat = (g: Ground): Mat => MAT[g] ?? 'rock';

type Rgb = readonly [number, number, number];
const rgb = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (base: string, o: Parameters<typeof rampOf>[1]) => rampOf(base, o).map(rgb);
/** Each material: its face ramp (6 tones), its trim (the beam, the wainscot, posts), its cap, and an accent (boards, moss, vine, algae, glint). */
interface Ramps { face: readonly Rgb[]; trim: readonly Rgb[]; cap: readonly Rgb[]; acc: readonly Rgb[] }
const RAMPS: Readonly<Record<Mat, Ramps>> = {
  plaster: { face: ramp('#cbb28e', { cool: '#2e2028', warm: '#fff0d8', hi: .3, deep: .5 }), trim: ramp('#6a4430', { cool: '#120808', warm: '#f0c89c', hi: .32 }), cap: ramp('#4a3024', { cool: '#0e0608', warm: '#e8c8a0', hi: .35 }), acc: ramp('#8a5a36', { cool: '#140a0c', warm: '#ffe0b0', hi: .4 }) },
  rock: { face: ramp('#6a5a52', { cool: '#120c14', warm: '#e8d4c0', hi: .32, deep: .62 }), trim: ramp('#4a3e3a', { cool: '#08060a', warm: '#b8a494', hi: .3 }), cap: ramp('#3a3030', { cool: '#060408', warm: '#a08a7a', hi: .32 }), acc: ramp('#d0703a', { cool: '#3a1008', warm: '#ffe0a0', hi: .5 }) },
  vine: { face: ramp('#6c7462', { cool: '#0a120e', warm: '#e0ecc8', hi: .3, deep: .6 }), trim: ramp('#4a5a42', { cool: '#06100a', warm: '#b8d098', hi: .3 }), cap: ramp('#3a5a2a', { cool: '#040a06', warm: '#a8d888', hi: .35 }), acc: ramp('#4a8a3a', { cool: '#06140a', warm: '#c8f0a0', hi: .45 }) },
  drown: { face: ramp('#4e5a62', { cool: '#06080e', warm: '#c0d0d8', hi: .3, deep: .6 }), trim: ramp('#323c42', { cool: '#040608', warm: '#90a0a8', hi: .3 }), cap: ramp('#2a3236', { cool: '#020406', warm: '#788890', hi: .3 }), acc: ramp('#4a6a4a', { cool: '#060e08', warm: '#a8c8a0', hi: .35 }) },
  bark: { face: ramp('#6a4a30', { cool: '#120a06', warm: '#e8c8a0', hi: .3, deep: .55 }), trim: ramp('#4a3220', { cool: '#0a0604', warm: '#c8a078', hi: .3 }), cap: ramp('#3a5a2a', { cool: '#06100a', warm: '#a8d888', hi: .35 }), acc: ramp('#5a8a3a', { cool: '#06120a', warm: '#c8e898', hi: .4 }) },
};
/** The ink of an end piece's edge and an outer corner's shade. */
const INK: Rgb = rgb(OUTLINE);

/** A block sprite: HD (2 px an iso px), its foot (the tile's centre on the floor) at (ax, ay) in sprite px. */
export interface IsoBlock { img: HTMLCanvasElement; ax: number; ay: number; dith?: IsoBlock }
const blocks = new Map<string, IsoBlock>();

/** A small stable hash in [0, 1). */
const hash = (a: number, b: number, c = 0): number => { let h = (a * 374761393 + b * 668265263 + c * 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** A wall's shape: which faces show, posts at their left seams, open ends, a stone variant (0…3). */
export interface WallShape { south: boolean; east: boolean; postS: boolean; postE: boolean; endS: boolean; endE: boolean; v: number }

/**
 * The block for one wall tile of shape `sh`, or its stub (`cut`). Cached by its shape (and the detail).
 */
export function isoBlock(mat: Mat, sh: WallShape, cut: boolean): IsoBlock {
  const low = envDetail() === 'low';
  const key = `${mat}${+sh.south}${+sh.east}${+cut}${+sh.postS}${+sh.postE}${+sh.endS}${+sh.endE}${sh.v}${+low}`;
  let b = blocks.get(key);
  if (b) return b;
  b = paintBlock(mat, sh, cut ? STUB_H : WALL_H, 0, cut, low);
  blocks.set(key, b);
  return b;
}

/** The lintel over a one-tile doorway: a beam (`axis` the run it continues: 'x' east–west, 'y' north–south). */
export function isoLintel(mat: Mat, axis: 'x' | 'y'): IsoBlock {
  const low = envDetail() === 'low';
  const key = `L${mat}${axis}${+low}`;
  let b = blocks.get(key);
  if (b) return b;
  b = paintBlock(mat, { south: axis === 'x', east: axis === 'y', postS: false, postE: false, endS: false, endE: false, v: 0 }, WALL_H, WALL_H - LINTEL_H, false, low, true);
  blocks.set(key, b);
  return b;
}
let none: IsoBlock | null = null;
/** Nothing (a cut-away lintel): a one-pixel clear block. */
export function isoNone(): IsoBlock {
  if (!none) { const el = document.createElement('canvas'); el.width = el.height = 1; none = { img: el, ax: 0, ay: 0 }; }
  return none;
}

/** The see-through copy of a block (a 2×2 HD checker cleared: every other iso px), made once per block. */
export function isoDither(b: IsoBlock): IsoBlock {
  if (b.dith) return b.dith;
  const el = document.createElement('canvas'); el.width = b.img.width; el.height = b.img.height;
  const g = el.getContext('2d')!;
  g.drawImage(b.img, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = g.createPattern(checker(), 'repeat')!;
  g.fillRect(0, 0, el.width, el.height);
  const d: IsoBlock = { img: el, ax: b.ax, ay: b.ay };
  d.dith = d;
  b.dith = d;
  return d;
}
let checkerCv: HTMLCanvasElement | null = null;
/** A 4×4 checker of 2×2 HD cells (one iso px each): the cleared half of a see-through wall. */
export function checker(): HTMLCanvasElement {
  if (checkerCv) return checkerCv;
  const el = document.createElement('canvas'); el.width = el.height = 4;
  const g = el.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, 2, 2); g.fillRect(2, 2, 2, 2);
  return (checkerCv = el);
}

/**
 * Paint a block `H` iso px tall whose faces start `h0` above the floor (a lintel's beam; 0 for a wall). The texture is
 * read per HD pixel from the face's own coordinates, so courses line up across tiles.
 */
function paintBlock(mat: Mat, sh: WallShape, H: number, h0: number, cut: boolean, low: boolean, lintel = false): IsoBlock {
  const R = RAMPS[mat], K = 2, W = 34 * K, HH = (18 + H) * K, ox = 17 * K, oy = (H + 9) * K;
  const el = document.createElement('canvas'); el.width = W; el.height = HH;
  const g = el.getContext('2d')!, img = g.createImageData(W, HH), d = img.data;
  const put = (i: number, j: number, c: Rgb) => { const o = (j * W + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; };
  const at = (r: readonly Rgb[], i: number) => r[Math.max(0, Math.min(5, i))];
  /** The face's colour at (u along the face 0…16 world px, v above the floor in iso px); `lit` 0 south, −2 east. */
  const tex = (u: number, v: number, lit: number, post: boolean, end: boolean, s: 0 | 1): Rgb => {
    if (cut) return v > H - 2 ? at(R.cap, 4) : at(R.trim, 2 + lit);
    // The cap's lip over the face, and the dark line of its shadow under it.
    if (v > H - 3) return at(R.trim, (v > H - 1 ? 4 : 3) + lit);
    if (v > H - 4) return at(R.face, 0 + lit);
    // An end piece: the inked edge (the run's far end: west on the south face, north on the east face).
    const ue = s === 0 ? u : 16 - u;
    if (end && ue < .6) return INK;
    if (lintel && v < h0 + 1.2) return at(R.trim, 0);
    const ao = v < h0 + 3 ? -1 : 0;
    switch (mat) {
      case 'plaster': {
        if ((post && u < 2.2) || (end && ue < 2.6)) return at(R.trim, (u < .7 || (end && ue < 1.2) ? 4 : 2) + lit + (v < 3 ? -1 : 0));
        // The top beam, the wainscot's rail and boards, plaster between them (mottled, a soft shadow under the beam).
        if (v > H - 9) return at(R.trim, (v > H - 5 ? 3 : 2) + lit);
        if (lintel) return at(R.trim, 2 + lit);
        if (v > 12 && v < 14) return at(R.trim, 4 + lit);
        if (v <= 12) { const seam = (u * 4) % 4 < .5; return at(R.acc, (seam ? 1 : v > 10 ? 3 : 2) + lit + ao); }
        const mot = !low && ((Math.sin(u * 3.7 + v * 1.9) + Math.sin(u * 1.1 - v * 2.3)) * .25 + .5) > .8 ? -1 : 0;
        return at(R.face, 3 + lit + mot + (v > H - 12 ? -1 : 0) + (v < 17 ? -1 : 0));
      }
      case 'bark': {
        const ridge = Math.sin(u * 2.4 + Math.sin(v * .25 + u) * 1.6), knot = !low && hash(Math.floor(u / 4), Math.floor(v / 9), sh.v) > .93;
        // Moss creeping down from the cap in tongues.
        const tongue = low ? 3 : 3 + Math.floor(hash(Math.floor(u * 2), 3, sh.v) * 6);
        if (v > H - 3 - tongue) return at(R.acc, 3 + lit + (v > H - 5 ? 1 : 0));
        if (knot) return at(R.face, 1 + lit);
        return at(R.face, (ridge > .55 ? 4 : ridge < -.4 ? 2 : 3) + lit + ao);
      }
      default: {
        // Hewn stone in courses (7, 6, 8 iso px, repeating), joints staggered, each stone its own tone; a lit top edge
        // and a shaded foot to every stone.
        const vv = v - h0 + (lintel ? 2 : 0), m = ((vv % 21) + 21) % 21;
        let course = Math.floor(vv / 21) * 3, base = 0;
        for (const ch of CYC) { if (m < base + ch) break; base += ch; course++; }
        const ch = CYC[((course % 3) + 3) % 3], cv = m - base, odd = (course & 1) === 1, cu = u + (odd ? 4 : 0), k = Math.floor(cu / 8), su = cu - k * 8;
        // A stone that straddles two tiles takes the course's tone, so its halves agree.
        const tone = !odd || k === 1 ? hash(k, course, sh.v + s * 7) : hash(course, 99);
        if (su < .7 || cv < .7) return at(R.face, 0 + lit);
        // Quoins at an end: long and short stones on alternate courses.
        if (end && ue < (odd ? 5 : 9)) return at(R.face, (cv > ch - 1.4 ? 5 : 4) + lit + ao);
        let t = 3 + (tone > .72 ? 1 : tone < .25 ? -1 : 0);
        if (cv > ch - 1.4) t++;
        else if (cv < 1.6) t--;
        if (!low) {
          if (mat === 'rock' && hash(k, course, sh.v + 3) > .88 && Math.abs(su - 4 + (cv - ch / 2) * .6) < .5) t = 1;
          if (mat === 'rock' && hash(k, course, sh.v + 5) > .94 && Math.abs(su - 5) < 1 && Math.abs(cv - ch / 2) < 1) return at(R.acc, 3 + (lit < 0 ? -1 : 0));
          if (mat === 'drown') {
            if (vv < 9 && vv > 3 && !lintel) return at(R.acc, (vv > 7 ? 3 : 2) + lit);
            if (hash(Math.floor(u * 2), 11, sh.v) > .86 && v > 9) return at(R.face, 4 + lit);
          }
          if (mat === 'vine') {
            const col = Math.floor(u * 1.5), len = hash(col, 5, sh.v) > .55 ? 6 + hash(col, 6, sh.v) * (H - 14) : 0;
            if (v > H - 4 - len) return at(R.acc, ((Math.floor(v) + col) % 3 === 0 ? 4 : 2) + lit);
            if (vv < 3) return at(R.acc, 1 + lit);
          }
        }
        return at(R.face, t + lit + ao);
      }
    }
  };
  for (let j = 0; j < HH; j++) for (let i = 0; i < W; i++) {
    const X = (i + .5) / K - ox / K, Y = (j + .5) / K - oy / K;
    // South face: between the left corner (−16, 0) and the bottom (0, 8), rising from h0 to H.
    if (sh.south && X >= -16 && X <= 0) { const base = (X + 16) / 2, v = base - Y; if (v >= h0 && v <= H) { put(i, j, tex(X + 16, v, 0, sh.postS, sh.endS, 0)); continue; } }
    if (sh.east && X >= 0 && X <= 16) { const base = 8 - X / 2, v = base - Y; if (v >= h0 && v <= H) { put(i, j, tex(X, v, -2, sh.postE, sh.endE, 1)); continue; } }
    // The cap: the tile's diamond raised by H, its lit rim on the camera's edges and an inked rim where the run stops.
    const ty = Y + H, e = Math.abs(X) / 16 + Math.abs(ty) / 8;
    if (e > 1) continue;
    const front = ty > 0, rim = e > .84;
    let c = at(R.cap, cut ? 4 : 3);
    if (rim && !front && ((X < 0 && sh.endS) || (X >= 0 && sh.endE))) c = INK;
    else if (rim && front) c = at(R.cap, X < 0 ? 5 : 4);
    else if (rim) c = at(R.cap, 1);
    else if (!low && !cut && mat !== 'plaster' && hash(Math.floor((X + 16) * 1.5), Math.floor((ty + 8) * 1.5), sh.v) > .9) c = at(R.cap, 2);
    put(i, j, c);
  }
  g.putImageData(img, 0, 0);
  // An outer corner: a lit arris on the south side of the seam, the shade's dark edge on the east.
  if (sh.south && sh.east) {
    const top = oy + 16 - H * K, hgt = (H - h0) * K, ar = R.face[cut ? 3 : 5];
    g.fillStyle = `rgb(${ar[0]},${ar[1]},${ar[2]})`; g.fillRect(ox - 1, top + 6, 1, hgt - 6);
    g.fillStyle = `rgb(${INK[0]},${INK[1]},${INK[2]})`; g.fillRect(ox, top + 6, 1, hgt - 6);
  }
  return { img: el, ax: ox, ay: oy };
}
/** The stone courses' heights (iso px), repeating. */
const CYC = [7, 6, 8] as const;

/** A wall block standing on the floor: its tile, its foot in iso px, the full block and the stub; a doorway's lintel its axis. */
export interface IsoWall { c: number; r: number; X: number; Y: number; full: IsoBlock; stub: IsoBlock; lintel?: 'x' | 'y' }

/**
 * The wall blocks (and doorway lintels) among the tiles `list` (c, r pairs) whose foot lies in the HD rectangle
 * (X0, Y0, w, h); `block(c, r)` says a tile stands as a block, `ground(c, r)` its ground (for the material).
 */
export function planWalls(list: ArrayLike<number>, X0: number, Y0: number, w: number, h: number, block: (c: number, r: number) => boolean, ground: (c: number, r: number) => Ground): IsoWall[] {
  const walls: IsoWall[] = [];
  for (let i = 0; i < list.length; i += 2) {
    const c = list[i], r = list[i + 1];
    const X = (c - r) * 16, Y = (c + r + 1) * 8;
    if (X * 2 < X0 || X * 2 >= X0 + w || Y * 2 < Y0 || Y * 2 >= Y0 + h) continue;
    if (!block(c, r)) {
      // A one-tile doorway: wall either side along one axis, open floor through it on the other.
      // (A one-wide tunnel is not a doorway: the floor must open out on both sides, past a corner of the wall.)
      const ew = block(c - 1, r) && block(c + 1, r) && !block(c, r - 1) && !block(c, r + 1)
        && (!block(c - 1, r - 1) || !block(c + 1, r - 1)) && (!block(c - 1, r + 1) || !block(c + 1, r + 1));
      const ns = !ew && block(c, r - 1) && block(c, r + 1) && !block(c - 1, r) && !block(c + 1, r)
        && (!block(c - 1, r - 1) || !block(c - 1, r + 1)) && (!block(c + 1, r - 1) || !block(c + 1, r + 1));
      if (!ew && !ns) continue;
      const ax = ew ? 'x' : 'y';
      walls.push({ c, r, X, Y, full: isoLintel(wallMat(ground(ew ? c - 1 : c, ew ? r : r - 1)), ax), stub: isoNone(), lintel: ax });
      continue;
    }
    const so = !block(c, r + 1), ea = !block(c + 1, r);
    // Inside the rock, or a back wall's top that nothing sees past: no block.
    if (!so && !ea && block(c, r - 1) && block(c - 1, r)) continue;
    const m = wallMat(ground(c, r));
    const sh: WallShape = { south: so, east: ea, postS: c % 3 === 0, postE: r % 3 === 0, endS: so && !block(c - 1, r), endE: ea && !block(c, r - 1), v: ((c * 7 + r * 13) % 4 + 4) % 4 };
    walls.push({ c, r, X, Y, full: isoBlock(m, sh, false), stub: isoBlock(m, sh, true) });
  }
  return walls;
}

/**
 * Which wall tiles are cut away for the Keeper on tile (pc, pr): found again only when he changes tile. `open(c, r)`:
 * ground that is not a block.
 */
export class IsoCutaway {
  private pc = NaN; private pr = NaN; private gen = NaN; private level: object | null = null;
  /** The room's wall tiles on the camera's side (packed keys), or null in the open. */
  private front: Set<number> | null = null;
  /** In a room (the flood closed under ROOM_CAP)? */
  inRoom = false;

  /** For the Keeper on tile (pc, pr) of `level` (ground generation `gen`); a no-op unless one of them changed. */
  update(gen: number, level: object, pc: number, pr: number, open: (c: number, r: number) => boolean): void {
    if (pc === this.pc && pr === this.pr && level === this.level && gen === this.gen) return;
    this.pc = pc; this.pr = pr; this.level = level; this.gen = gen;
    // Flood the open ground from the Keeper's tile; the walls met on the way bound the room.
    const seen = new Set<number>(), stack = [pc, pr], walls = new Set<number>();
    seen.add(key(pc, pr));
    let closed = true;
    while (stack.length) {
      const r = stack.pop()!, c = stack.pop()!;
      for (let k = 0; k < 4; k++) {
        const nc = c + DX[k], nr = r + DY[k], nk = key(nc, nr);
        if (seen.has(nk)) continue;
        if (!open(nc, nr)) {
          // A wall on the room's south or east side (its north or west neighbour is this floor) faces the camera.
          if (k === 1 || k === 3) walls.add(nk);
          continue;
        }
        seen.add(nk);
        if (seen.size > ROOM_CAP) { closed = false; stack.length = 0; break; }
        stack.push(nc, nr);
      }
    }
    this.inRoom = closed;
    this.front = closed ? walls : null;
  }

  /** Is the wall at (c, r) cut down to a stub (a room's camera-side wall)? */
  cut(c: number, r: number): boolean { return this.state(c, r) === 2; }

  /** The wall at (c, r): 0 standing, 1 see-through (in the wedge in front of the Keeper), 2 cut to its stub. */
  state(c: number, r: number): 0 | 1 | 2 {
    const d = c + r - (this.pc + this.pr);
    if (d <= 0) return 0;
    if (this.front?.has(key(c, r))) return 2;
    // The wedge in front of the Keeper (so a wall never hides him): up to six diagonals nearer, three columns either side.
    return d <= 6 && Math.abs((c - r) - (this.pc - this.pr)) <= 3 + (d >> 1) ? 1 : 0;
  }

  /** What to draw for wall `wl`: its block, its see-through copy (Low: the stub), its stub; a lintel follows the walls it spans. */
  pick(wl: IsoWall): IsoBlock {
    let s = this.state(wl.c, wl.r);
    if (wl.lintel) {
      const a = wl.lintel === 'x' ? this.state(wl.c - 1, wl.r) : this.state(wl.c, wl.r - 1);
      const b = wl.lintel === 'x' ? this.state(wl.c + 1, wl.r) : this.state(wl.c, wl.r + 1);
      s = Math.max(s, a, b) as 0 | 1 | 2;
    }
    return s === 2 ? wl.stub : s === 1 ? (envDetail() === 'low' ? wl.stub : isoDither(wl.full)) : wl.full;
  }
}
// Neighbours: north, south, west, east.
const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
const key = (c: number, r: number) => (c + 32768) * 65536 + (r + 32768);
