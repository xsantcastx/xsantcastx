/**
 * td-iso-ground.ts — the production isometric ground (td-artopt.ts `iso`; docs/handoff/iso.md). The world stays the
 * square grid it is; only the drawing is isometric: a world point (x, y) is drawn at iso (x − y, (x + y) / 2), so a
 * 16-px tile is a 32 × 16 diamond, and at the HD pixel (two a world px) a 64 × 32 one.
 *
 * - **Diamond tiles.** Each tile is painted by the ground's own painters (the HD square tile, organic edges and all) and
 *   laid into its diamond through a precomputed pixel map (`DIAMOND`): a straight copy of ~1 000 pixels, no per-pixel
 *   maths. Tiles whose look does not depend on where they lie (rock and walls under their blocks, open deep water) come
 *   from the **diamond atlas** (`atlas`), painted once per key.
 * - **Chunks in iso space.** The ground is cached as screen-aligned rectangles of the iso plane (`CW` × `CH` HD px), so
 *   a chunk is opaque, wastes nothing on a diamond's empty corners, and a frame is a handful of plain blits. A chunk is
 *   baked a tile at a time inside a budget (`bake`), the ring round the view ahead of the walk (`prefetch`), like the
 *   square ground's calm bake (docs/handoff/calm.md); a chunk in view is never drawn half-painted.
 * - **Water.** A chunk with liquid in it keeps four frames, but frames 1–3 start as a copy of frame 0 and repaint only
 *   the tiles that move (liquid, or a shore whose foam laps), so the animation costs one blit a frame like dry ground.
 *
 * Least-recently-drawn out, capped at `cap` chunks. No allocation per frame once the view's chunks are baked.
 */
import { TILE, type Ground } from './td-art';
import { planWalls, type IsoWall } from './td-iso-walls';
export type { IsoWall } from './td-iso-walls';

/** A chunk's size in HD px (256 × 128 iso px: 8 tiles across a row of diamonds, 16 rows). */
export const CW = 512, CH = 256;
/** A diamond tile's box in HD px. */
const DW = 64, DH = 32, SQ = TILE * 2;

/** Where each pixel of a diamond's 64 × 32 box reads in the 32 × 32 HD square (−1: outside the diamond). */
const DIAMOND = (() => {
  const m = new Int16Array(DW * DH).fill(-1);
  for (let j = 0; j < DH; j++) for (let i = 0; i < DW; i++) {
    const u = (i + .5) / 2 - TILE, v = (j + .5) / 2, lx = v + u / 2, ly = v - u / 2;
    if (lx < 0 || ly < 0 || lx >= TILE || ly >= TILE) continue;
    m[j * DW + i] = Math.floor(ly * 2) * SQ + Math.floor(lx * 2);
  }
  return m;
})();
/** Each row's first and last+1 column inside the diamond. */
const ROWS = (() => {
  const r = new Int16Array(DH * 2);
  for (let j = 0; j < DH; j++) {
    let a = DW, b = 0;
    for (let i = 0; i < DW; i++) if (DIAMOND[j * DW + i] >= 0) { a = Math.min(a, i); b = i + 1; }
    r[j * 2] = a; r[j * 2 + 1] = b;
  }
  return r;
})();

/** What the ground cache asks of the world it draws. */
export interface IsoGroundSource {
  ground(c: number, r: number): Ground;
  /** Paint tile (c, r) as the HD square (32 × 32 px at (0, 0) on `g`), at water frame `f`, its neighbours read by `at`. */
  paint(g: CanvasRenderingContext2D, k: Ground, c: number, r: number, f: number, at: (c: number, r: number) => Ground): void;
}

/** Ground drawn as a block (td-iso-walls.ts): its own ground is the dark under the block. */
export const BLOCK_GROUND: ReadonlySet<Ground> = new Set<Ground>(['rock', 'wall', 'vinewall', 'drownwall', 'bark']);
const LIQUID: ReadonlySet<Ground> = new Set<Ground>(['water', 'ember', 'blackwater']);
/** The dark a block stands on (ABGR, little-endian RGBA). */
const VOID = 0xff100b0f;

interface Chunk {
  I: number; J: number;
  /** The blocks whose foot lies in this chunk (found once, when it is planned). */
  walls: IsoWall[];
  /** One canvas per frame (1, or 4 with liquid). */
  frames: (HTMLCanvasElement | null)[];
  nf: number;
  /** The tiles to paint, as [c, r] pairs, and how far the frame being baked has got. */
  tiles: Int32Array;
  /** Indexes into `tiles` of those that move with the water (frames 1–3 repaint only these). */
  anim: Int32Array;
  frame: number; next: number;
  img: ImageData | null; px: Uint32Array | null;
  /** Frame 0's pixels, kept until the water frames are baked from them. */
  base: Uint32Array | null;
}

export class IsoGround {
  private readonly chunks = new Map<number, Chunk>();
  private readonly atlas = new Map<string, Uint32Array>();
  private sq: CanvasRenderingContext2D | null = null;
  /** The engine's ground generation this cache was baked for (a new level or detail setting clears it). */
  gen = -1;
  /** Chunks kept (the view and its ring). */
  cap = 48;
  /** HD-px ms spent baking this frame (the perf probe). */
  bakeMs = 0;
  /** The perf probe: [tiles painted, atlas hits, ms painting, ms reading back, ms laying, ms putting frames]. */
  readonly stats = new Float64Array(6);

  private readonly at = (c: number, r: number): Ground => this.src.ground(c, r);
  constructor(private readonly src: IsoGroundSource) {}

  /** Forget everything (a new level, a new detail setting). */
  clear(): void { this.chunks.clear(); this.atlas.clear(); }

  /**
   * Draw the ground under the iso view (`X0, Y0` its top-left in iso px, `w × h` iso px) at `s` backing px per iso px,
   * water frame `f`. The context's transform must be the identity.
   */
  draw(c: CanvasRenderingContext2D, X0: number, Y0: number, w: number, h: number, s: number, f: number): void {
    const k = s / 2;
    const i0 = Math.floor(X0 * 2 / CW), i1 = Math.floor((X0 + w) * 2 / CW), j0 = Math.floor(Y0 * 2 / CH), j1 = Math.floor((Y0 + h) * 2 / CH);
    this.cap = Math.max(this.cap, (i1 - i0 + 3) * (j1 - j0 + 3) + 4);
    for (let J = j0; J <= j1; J++) for (let I = i0; I <= i1; I++) {
      const ch = this.chunk(I, J);
      // Never drawn half-painted: a chunk in view without its first frame bakes that frame now (the ring is baked ahead so
      // this is rare); its water frames come later.
      if (!this.ready(ch, 0)) this.bake(ch, Infinity, 1);
      const fi = f % ch.nf, cv = ch.frames[fi] ?? ch.frames[0]!;
      c.drawImage(cv, Math.round((I * CW / 2 - X0) * s), Math.round((J * CH / 2 - Y0) * s), CW * k, CH * k);
    }
  }

  /**
   * After a draw, until `deadline` (performance.now ms): the first frame of each chunk in the ring round the view (so a
   * walk never meets unpainted ground), then the view's water frames, then the ring's. `idle` (the Keeper standing, the
   * frame cheap): then a second ring's first frames too, so the first few seconds of the next walk bake nothing.
   */
  prefetch(X0: number, Y0: number, w: number, h: number, deadline: number, idle = false): void {
    const i0 = Math.floor(X0 * 2 / CW), i1 = Math.floor((X0 + w) * 2 / CW), j0 = Math.floor(Y0 * 2 / CH), j1 = Math.floor((Y0 + h) * 2 / CH);
    for (let pass = 0; pass < 3; pass++) for (let J = j0 - 1; J <= j1 + 1; J++) for (let I = i0 - 1; I <= i1 + 1; I++) {
      const inView = I >= i0 && I <= i1 && J >= j0 && J <= j1;
      if ((pass === 1) !== inView) continue;
      const ch = this.chunk(I, J), upto = pass === 0 ? 1 : ch.nf;
      if (!this.ready(ch, upto - 1) && !this.bake(ch, deadline, upto)) return;
    }
    if (!idle) return;
    this.cap = Math.max(this.cap, (i1 - i0 + 5) * (j1 - j0 + 5) + 4);
    for (let J = j0 - 2; J <= j1 + 2; J++) for (let I = i0 - 2; I <= i1 + 2; I++) {
      if (I >= i0 - 1 && I <= i1 + 1 && J >= j0 - 1 && J <= j1 + 1) continue;
      const ch = this.chunk(I, J);
      if (!this.ready(ch, 0) && !this.bake(ch, deadline, 1)) return;
    }
  }

  /** Each wall block standing in the iso rectangle (iso px), chunk by chunk (planning chunks not seen yet). */
  forWalls(X0: number, Y0: number, w: number, h: number, each: (wl: IsoWall) => void): void {
    const i0 = Math.floor(X0 * 2 / CW), i1 = Math.floor((X0 + w) * 2 / CW), j0 = Math.floor(Y0 * 2 / CH), j1 = Math.floor((Y0 + h) * 2 / CH);
    for (let J = j0; J <= j1; J++) for (let I = i0; I <= i1; I++) for (const wl of this.chunk(I, J).walls) each(wl);
  }

  /** Is frame `f` of chunk `ch` (and every frame before it) painted? */
  private ready(ch: Chunk, f: number): boolean { return ch.frame > f; }

  private chunk(I: number, J: number): Chunk {
    const key = pack(I, J);
    let ch = this.chunks.get(key);
    if (ch) { this.chunks.delete(key); this.chunks.set(key, ch); return ch; }
    ch = this.plan(I, J);
    this.chunks.set(key, ch);
    while (this.chunks.size > this.cap) this.chunks.delete(this.chunks.keys().next().value!);
    return ch;
  }

  /** The tiles whose diamonds touch chunk (I, J), in drawing order (back to front), and which of them move. */
  private plan(I: number, J: number): Chunk {
    const X0 = I * CW, Y0 = J * CH;
    // A tile (c, r) has a = c − r, b = c + r; its diamond's box is [(a − 1)·32, (a + 1)·32) × [b·16, b·16 + 32) HD px.
    const a0 = Math.floor(X0 / 32) - 1, a1 = Math.ceil((X0 + CW) / 32) + 1, b0 = Math.floor(Y0 / 16) - 2, b1 = Math.ceil((Y0 + CH) / 16);
    const list: number[] = [], anim: number[] = [];
    let liquid = false;
    const g = (c: number, r: number) => this.src.ground(c, r);
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
      if (((a + b) & 1) !== 0) continue;
      if ((a + 1) * 32 <= X0 || (a - 1) * 32 >= X0 + CW || b * 16 + 32 <= Y0 || b * 16 >= Y0 + CH) continue;
      const c = (a + b) / 2, r = (b - a) / 2;
      list.push(c, r);
      let moves = LIQUID.has(g(c, r));
      for (let dy = -1; dy <= 1 && !moves; dy++) for (let dx = -1; dx <= 1 && !moves; dx++) if (LIQUID.has(g(c + dx, r + dy))) moves = true;
      if (moves) { anim.push(list.length - 2); if (LIQUID.has(g(c, r))) liquid = true; }
    }
    const nf = liquid ? 4 : 1;
    // The blocks (and doorway lintels) whose foot lies in this chunk: each belongs to exactly one chunk (td-iso-walls.ts).
    const walls = planWalls(list, X0, Y0, CW, CH, (c, r) => BLOCK_GROUND.has(g(c, r)), g);
    return { I, J, walls, frames: new Array<HTMLCanvasElement | null>(nf).fill(null), nf, tiles: Int32Array.from(list), anim: Int32Array.from(liquid ? anim : []), frame: 0, next: 0, img: null, px: null, base: null };
  }

  /** Paint chunk `ch` a tile at a time until its first `upto` frames are done or `deadline` passes; true when they are. */
  private bake(ch: Chunk, deadline: number, upto = ch.nf): boolean {
    if (ch.frame >= upto) return true;
    const t0 = performance.now();
    while (ch.frame < upto) {
      if (!ch.img) {
        ch.img = new ImageData(CW, CH);
        ch.px = new Uint32Array(ch.img.data.buffer);
        if (ch.frame > 0 && ch.base) ch.px.set(ch.base);
        ch.next = 0;
      }
      const f = ch.frame, list = f === 0 ? null : ch.anim, n = list ? list.length : ch.tiles.length / 2;
      while (ch.next < n) {
        const ti = list ? list[ch.next] : ch.next * 2;
        this.lay(ch, ch.tiles[ti], ch.tiles[ti + 1], f);
        ch.next++;
        if (performance.now() > deadline) { this.bakeMs += performance.now() - t0; return false; }
      }
      // The frame is whole: onto its canvas (opaque), and on to the next.
      const tp = performance.now();
      const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
      cv.getContext('2d', { alpha: false })!.putImageData(ch.img, 0, 0);
      this.stats[5] += performance.now() - tp;
      ch.frames[f] = cv;
      if (f === 0 && ch.nf > 1) ch.base = ch.px!.slice();
      ch.img = null; ch.px = null; ch.frame++;
      if (ch.frame >= ch.nf) ch.base = null;
      if (performance.now() > deadline) { this.bakeMs += performance.now() - t0; return ch.frame >= upto; }
    }
    this.bakeMs += performance.now() - t0;
    return true;
  }

  /** Tile (c, r) at frame f into chunk `ch`'s pixels. */
  private lay(ch: Chunk, c: number, r: number, f: number): void {
    const k = this.src.ground(c, r), px = ch.px!;
    const ox = (c - r - 1) * 32 - ch.I * CW, oy = (c + r) * 16 - ch.J * CH;
    if (BLOCK_GROUND.has(k)) { fill(px, ox, oy, VOID); return; }
    // The atlas: open deep water (no land within two tiles) looks the same wherever it lies, given its place in an 8×8
    // pattern; painted once per (kind, frame, place).
    let key: string | null = null;
    if (k === 'water' && this.open(c, r)) key = `w${f}:${c & 7}:${r & 7}`;
    let tile = key ? this.atlas.get(key) : undefined;
    if (tile) this.stats[1]++;
    if (!tile) {
      const t0 = performance.now();
      this.stats[0]++;
      const g = this.sq ??= Object.assign(document.createElement('canvas'), { width: SQ, height: SQ }).getContext('2d', { willReadFrequently: true })!;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
      g.fillStyle = '#2a1a24'; g.fillRect(0, 0, SQ, SQ);
      // An atlas tile is painted at its place in the pattern (so the pattern is seamless inside its 8×8 block).
      if (key) this.src.paint(g, k, c & 7, r & 7, f, ALL_WATER); else this.src.paint(g, k, c, r, f, this.at);
      const t1 = performance.now();
      const sq = new Uint32Array(g.getImageData(0, 0, SQ, SQ).data.buffer);
      const t2 = performance.now();
      this.stats[2] += t1 - t0; this.stats[3] += t2 - t1;
      if (key) { tile = sq; if (this.atlas.size > 600) this.atlas.clear(); this.atlas.set(key, tile); }
      else { blit(px, ox, oy, sq); this.stats[4] += performance.now() - t2; return; }
    }
    blit(px, ox, oy, tile);
  }
  /** No ground but water within two tiles. */
  private open(c: number, r: number): boolean {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (this.src.ground(c + dx, r + dy) !== 'water') return false;
    return true;
  }
}

const ALL_WATER = (): Ground => 'water';
const pack = (I: number, J: number) => (I + 32768) * 65536 + (J + 32768);

/** Lay the diamond of HD square `sq` (32 × 32) with its box at (ox, oy) on the chunk's pixels, clipped. */
function blit(px: Uint32Array, ox: number, oy: number, sq: Uint32Array): void {
  for (let j = 0; j < DH; j++) {
    const y = oy + j;
    if (y < 0 || y >= CH) continue;
    const a = Math.max(ROWS[j * 2], -ox), b = Math.min(ROWS[j * 2 + 1], CW - ox), row = y * CW + ox, m = j * DW;
    for (let i = a; i < b; i++) px[row + i] = sq[DIAMOND[m + i]];
  }
}
function fill(px: Uint32Array, ox: number, oy: number, v: number): void {
  for (let j = 0; j < DH; j++) {
    const y = oy + j;
    if (y < 0 || y >= CH) continue;
    const a = Math.max(ROWS[j * 2], -ox), b = Math.min(ROWS[j * 2 + 1], CW - ox);
    if (b > a) px.fill(v, y * CW + ox + a, y * CW + ox + b);
  }
}
