/**
 * td-iso-walls.ts — walls in the isometric view (td-artopt.ts `iso`, docs/handoff/iso.md): every block tile (a wall, a
 * rock face, a temple's vine wall, the crypts' drowned wall, the Bole's living wood) that borders open ground stands up
 * as a block with its two camera-facing faces (south: lower left, lit; east: lower right, shaded) and a cap, cached per
 * material and shape — a frame only blits them, depth-sorted with everything standing.
 *
 * **Cutaway** (Diablo II), decided per room, not per tile:
 * - Inside a room (the open ground round the Keeper is closed, under `ROOM_CAP` tiles): every wall that bounds the room
 *   on the camera's side (its north or west neighbour is the room's floor) drops to a stub, so the room shows its inside;
 *   its back walls stand.
 * - In the open (a cave's galleries, the land): only the walls in a short wedge in front of the Keeper drop, so he is
 *   never hidden and the rest of the dungeon keeps its walls.
 * The room is found again only when the Keeper changes tile (a flood fill of at most ROOM_CAP tiles).
 */
import { rampOf } from './td-hd-sculpt';
import type { Ground } from './td-art';

/** A wall's height in iso px, and the stub a cut-away wall is cut down to. */
export const WALL_H = 46, STUB_H = 6;
/** A room bigger than this is "the open". */
const ROOM_CAP = 900;

type Mat = 'plaster' | 'rock' | 'vine' | 'drown' | 'bark';
const MAT: Readonly<Record<string, Mat>> = { wall: 'plaster', rock: 'rock', vinewall: 'vine', drownwall: 'drown', bark: 'bark' };
export const wallMat = (g: Ground): Mat => MAT[g] ?? 'rock';

type Rgb = readonly [number, number, number];
const rgb = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (base: string, o: Parameters<typeof rampOf>[1]) => rampOf(base, o).map(rgb);
/** Each material: its face ramp (6 tones), its trim (the beam, the wainscot, posts) and its cap. */
const RAMPS: Readonly<Record<Mat, { face: readonly Rgb[]; trim: readonly Rgb[]; cap: readonly Rgb[] }>> = {
  plaster: { face: ramp('#cbb28e', { cool: '#2e2028', warm: '#fff0d8', hi: .3, deep: .5 }), trim: ramp('#5a3a26', { cool: '#120808', warm: '#e8c098', hi: .3 }), cap: ramp('#4a3024', { cool: '#0e0608', warm: '#e8c8a0', hi: .35 }) },
  rock: { face: ramp('#5a4c48', { cool: '#0e0a12', warm: '#d8c8b8', hi: .35, deep: .6 }), trim: ramp('#3a302e', { cool: '#08060a', warm: '#a89888', hi: .3 }), cap: ramp('#2a2024', { cool: '#060408', warm: '#8a7a70', hi: .3 }) },
  vine: { face: ramp('#5c6a52', { cool: '#0a120e', warm: '#d8e8c0', hi: .3, deep: .6 }), trim: ramp('#2e5a2a', { cool: '#06100a', warm: '#a8d888', hi: .35 }), cap: ramp('#24361e', { cool: '#040a06', warm: '#88a870', hi: .3 }) },
  drown: { face: ramp('#46525a', { cool: '#06080e', warm: '#b8c8d0', hi: .3, deep: .6 }), trim: ramp('#2a3438', { cool: '#040608', warm: '#8898a0', hi: .3 }), cap: ramp('#1e262a', { cool: '#020406', warm: '#68787e', hi: .3 }) },
  bark: { face: ramp('#6a4a30', { cool: '#120a06', warm: '#e8c8a0', hi: .3, deep: .55 }), trim: ramp('#4a3220', { cool: '#0a0604', warm: '#c8a078', hi: .3 }), cap: ramp('#3a5a2a', { cool: '#06100a', warm: '#a8d888', hi: .35 }) },
};

/** A block sprite: HD (2 px an iso px), its foot (the tile's centre on the floor) at (ax, ay) in sprite px. */
export interface IsoBlock { img: HTMLCanvasElement; ax: number; ay: number }
const blocks = new Map<string, IsoBlock>();

/**
 * The block for one wall tile: `south` / `east` the faces that show (each faces open ground), `cut` the stub, `post` a
 * trim post at the face's left seam (every few tiles). Cached by its shape.
 */
export function isoBlock(mat: Mat, south: boolean, east: boolean, cut: boolean, postS: boolean, postE: boolean): IsoBlock {
  const key = `${mat}${+south}${+east}${+cut}${+postS}${+postE}`;
  let b = blocks.get(key);
  if (b) return b;
  const R = RAMPS[mat], H = cut ? STUB_H : WALL_H, K = 2, W = 34 * K, HH = (18 + H) * K, ox = 17 * K, oy = (H + 9) * K;
  const el = document.createElement('canvas'); el.width = W; el.height = HH;
  const g = el.getContext('2d')!, img = g.createImageData(W, HH), d = img.data;
  const put = (i: number, j: number, c: Rgb) => { const o = (j * W + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; };
  const at = (r: readonly Rgb[], i: number) => r[Math.max(0, Math.min(5, i))];
  const tex = (u: number, v: number, lit: number, post: boolean): Rgb => {
    // v: height above the floor (iso px), u: 0…1 along the face.
    if (cut) return v > H - 2 ? at(R.cap, 4) : at(R.trim, 2 + lit);
    if (v > H - 4) return at(R.trim, 3 + lit + (v > H - 1.5 ? 1 : 0));
    if (post && u < .14) return at(R.trim, (u < .05 ? 4 : 2) + lit);
    if (mat === 'plaster') {
      // Wainscot to 12, plaster above, darker toward the floor and a little mottled.
      if (v < 12) { const board = Math.floor(u * 6) !== Math.floor((u + .03) * 6); return at(R.trim, (board ? 0 : v > 10.5 ? 4 : 2) + lit); }
      const m = ((Math.sin(u * 37 + v * 3.1) + Math.sin(u * 11 - v * 1.7)) * .25 + .5) > .78 ? -1 : 0;
      return at(R.face, 3 + lit + m + (v < 16 ? -1 : 0));
    }
    // Stone courses: rows of blocks, joints offset every other course, a lit top edge to each course.
    const course = Math.floor(v / 7), cu = u * 4 + (course & 1) * .5, joint = Math.abs(cu - Math.round(cu)) < .05 || v % 7 < .8;
    const m = ((Math.sin(u * 29 + v * 2.3) + Math.sin(u * 7 - v * 1.3)) * .25 + .5) > .74 ? -1 : 0;
    if (mat === 'bark') { const grain = Math.sin(u * 40 + Math.sin(v * .3) * 2) > .6 ? -1 : 0; return at(R.face, 3 + lit + grain + (v < 6 ? -1 : 0)); }
    return joint ? at(R.face, 1 + lit) : at(R.face, 3 + lit + m + (v % 7 > 6 ? 1 : 0) + (v < 8 ? -1 : 0));
  };
  for (let j = 0; j < HH; j++) for (let i = 0; i < W; i++) {
    const X = (i + .5) / K - ox / K, Y = (j + .5) / K - oy / K;
    // South face: between the left corner (−16, 0) and the bottom (0, 8), rising H.
    if (south && X >= -16 && X <= 0) { const base = (X + 16) / 2, v = base - Y; if (v >= 0 && v <= H) { put(i, j, tex((X + 16) / 16, v, 0, postS)); continue; } }
    if (east && X >= 0 && X <= 16) { const base = 8 - X / 2, v = base - Y; if (v >= 0 && v <= H) { put(i, j, tex(X / 16, v, -2, postE)); continue; } }
    // The cap: the tile's diamond raised by H, its rim a tone darker.
    const ty = Y + H, e = Math.abs(X) / 16 + Math.abs(ty) / 8;
    if (e <= 1) put(i, j, at(R.cap, cut ? (e > .82 ? 2 : 4) : (e > .82 ? 1 : 3)));
  }
  g.putImageData(img, 0, 0);
  // A dark seam where the two faces meet.
  g.fillStyle = '#1a0e10';
  if (south && east) g.fillRect(ox - 1, oy + 16 - H * K, 2, H * K);
  b = { img: el, ax: ox, ay: oy };
  blocks.set(key, b);
  return b;
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

  /** Is the wall at (c, r) cut down to a stub? */
  cut(c: number, r: number): boolean {
    const d = c + r - (this.pc + this.pr);
    if (d <= 0) return false;
    if (this.front?.has(key(c, r))) return true;
    // The wedge in front of the Keeper (so a wall never hides him): up to six diagonals nearer, three columns either side.
    return d <= 6 && Math.abs((c - r) - (this.pc - this.pr)) <= 3 + (d >> 1);
  }
}
// Neighbours: north, south, west, east.
const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
const key = (c: number, r: number) => (c + 32768) * 65536 + (r + 32768);
