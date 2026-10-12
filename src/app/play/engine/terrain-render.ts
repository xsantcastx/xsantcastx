/**
 * terrain-render.ts — drawing for delve terrain. Render-only: nothing here
 * changes a cell.
 *
 * Cells are painted into CHUNK×CHUNK offscreen canvases and blitted; a chunk
 * is repainted only when its revision in the Terrain moved (a cell broke or
 * crossed a crack stage). Chunk canvases are pooled with an LRU cap, so a long
 * delve never holds more than CHUNK_CAP of them. Debris and dust are a fixed
 * pool of particles.
 */
import { CELL, CHUNK, crackStage, Terrain } from './terrain';

/** Most chunk canvases kept. A 1280×720 view touches about 24. */
const CHUNK_CAP = 36;
const SIZE = CELL * CHUNK;

/** A cheap, stable per-cell hash for flecks and crack shapes. */
export function cellHash(col: number, row: number, salt = 0): number {
  let h = (col * 374761393 + row * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

interface ChunkCanvas { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; key: number; rev: number; used: number; res: number }

export class TerrainRenderer {
  private terrain: Terrain | null = null;
  private readonly chunks = new Map<number, ChunkCanvas>();
  private readonly free: ChunkCanvas[] = [];
  private frame = 0;
  private offscreen = true;

  /** Point at a (new) terrain. Cached chunks go back to the pool. */
  attach(terrain: Terrain | null): void {
    if (terrain === this.terrain) return;
    this.terrain = terrain;
    for (const chunk of this.chunks.values()) this.free.push(chunk);
    this.chunks.clear();
  }

  /**
   * Draw the cells in view. `c` is in world px (camera applied). `res` is the
   * device pixels per world px the chunks are painted at (capped at 2).
   */
  draw(c: CanvasRenderingContext2D, left: number, top: number, width: number, height: number, res: number): void {
    const t = this.terrain;
    if (!t) return;
    this.frame++;
    const scale = Math.max(1, Math.min(2, Math.round(res * 2) / 2));
    const cc0 = Math.max(0, Math.floor(left / SIZE)), cc1 = Math.min(t.chunkCols - 1, Math.floor((left + width) / SIZE));
    const cr0 = Math.max(0, Math.floor((top - t.top) / SIZE)), cr1 = Math.min(t.chunkRows - 1, Math.floor((top + height - t.top) / SIZE));
    for (let cr = cr0; cr <= cr1; cr++) {
      for (let cc = cc0; cc <= cc1; cc++) {
        const x = cc * SIZE, y = t.top + cr * SIZE;
        const key = cr * t.chunkCols + cc;
        const chunk = this.offscreen ? this.chunk(key, scale) : null;
        if (!chunk) {
          // No offscreen canvas (tests, very old browsers): paint the cells straight in.
          paintCells(c, t, cc * CHUNK, cr * CHUNK, x, y);
          continue;
        }
        if (chunk.rev !== t.chunkRev[key] || chunk.res !== scale) {
          const p = chunk.context;
          p.setTransform(1, 0, 0, 1, 0, 0); p.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height);
          p.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
          paintCells(p, t, cc * CHUNK, cr * CHUNK, x, y);
          chunk.rev = t.chunkRev[key]; chunk.res = scale;
        }
        c.drawImage(chunk.canvas, x, y, SIZE, SIZE);
      }
    }
  }

  private chunk(key: number, scale: number): ChunkCanvas | null {
    let chunk: ChunkCanvas | null | undefined = this.chunks.get(key);
    if (!chunk) {
      chunk = this.free.pop() ?? this.make() ?? this.evict();
      if (!chunk) return null;
      chunk.key = key; chunk.rev = -1;
      this.chunks.set(key, chunk);
    }
    const px = Math.ceil(SIZE * scale);
    if (chunk.canvas.width !== px) { chunk.canvas.width = px; chunk.canvas.height = px; chunk.rev = -1; }
    chunk.used = this.frame;
    return chunk;
  }
  private make(): ChunkCanvas | null {
    if (this.chunks.size + this.free.length >= CHUNK_CAP) return null;
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') { this.offscreen = false; return null; }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) { this.offscreen = false; return null; }
    return { canvas, context, key: -1, rev: -1, used: 0, res: 0 };
  }
  /** Reuse the chunk drawn longest ago that is not on screen this frame. */
  private evict(): ChunkCanvas | null {
    let oldest: ChunkCanvas | null = null;
    for (const chunk of this.chunks.values()) if (chunk.used < this.frame && (!oldest || chunk.used < oldest.used)) oldest = chunk;
    if (oldest) this.chunks.delete(oldest.key);
    return oldest;
  }
}

/** Paint one chunk's cells (world px; the caller's transform maps them). */
function paintCells(c: CanvasRenderingContext2D, t: Terrain, col0: number, row0: number, x0: number, y0: number): void {
  for (let row = row0; row < Math.min(t.rows, row0 + CHUNK); row++) {
    for (let col = col0; col < Math.min(t.cols, col0 + CHUNK); col++) {
      paintCell(c, t, col, row, x0 + (col - col0) * CELL, y0 + (row - row0) * CELL);
    }
  }
}

function paintCell(c: CanvasRenderingContext2D, t: Terrain, col: number, row: number, x: number, y: number): void {
  const node = t.nodeAt(col, row);
  const h = cellHash(col, row);
  if (!node.solid) {
    // A dug tunnel: the dark back wall, shadowed under rock.
    c.fillStyle = (h & 3) === 0 ? '#1a1115' : '#160e12'; c.fillRect(x, y, CELL, CELL);
    if (t.solid(col, row - 1)) { c.fillStyle = '#0a0608'; c.fillRect(x, y, CELL, 7); }
    if (t.solid(col - 1, row)) { c.fillStyle = '#0d080b'; c.fillRect(x, y, 4, CELL); }
    if (t.solid(col + 1, row)) { c.fillStyle = '#0d080b'; c.fillRect(x + CELL - 4, y, 4, CELL); }
    return;
  }
  if (node.id === 'cache') {
    c.fillStyle = '#160e12'; c.fillRect(x, y, CELL, CELL);
    c.fillStyle = node.dark; c.fillRect(x + 3, y + 10, CELL - 6, CELL - 10);
    c.fillStyle = node.base; c.fillRect(x + 4, y + 11, CELL - 8, CELL - 13);
    c.fillStyle = node.light; c.fillRect(x + 3, y + 16, CELL - 6, 3);
    c.fillStyle = node.fleck; c.fillRect(x + CELL / 2 - 3, y + 15, 6, 7);
    paintCracks(c, t, col, row, x, y, h);
    return;
  }
  c.fillStyle = node.base; c.fillRect(x, y, CELL, CELL);
  // Mottling: two darker patches per cell, placed by hash.
  c.fillStyle = node.dark;
  c.fillRect(x + (h & 15), y + ((h >> 4) & 15), 8 + ((h >> 8) & 7), 6);
  c.fillRect(x + ((h >> 12) & 15) + 6, y + ((h >> 16) & 15) + 8, 6, 5 + ((h >> 20) & 3));
  switch (node.id) {
    case 'roots': {
      c.strokeStyle = node.light; c.lineWidth = 2;
      for (let s = 0; s < 3; s++) {
        const sx = x + 6 + s * 10 + ((h >> (s * 3)) & 3);
        c.beginPath(); c.moveTo(sx, y); c.quadraticCurveTo(sx + ((h >> (s + 5)) & 1 ? 6 : -6), y + CELL / 2, sx, y + CELL); c.stroke();
      }
      c.fillStyle = node.fleck; c.fillRect(x + 4 + (h & 15), y + 8 + ((h >> 6) & 7), 4, 3);
      break;
    }
    case 'cracked-wall': {
      c.strokeStyle = node.fleck; c.globalAlpha = .75; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + 4 + (h & 7), y); c.lineTo(x + 14 + ((h >> 3) & 7), y + 12); c.lineTo(x + 8 + ((h >> 6) & 7), y + 22); c.lineTo(x + 18, y + CELL); c.stroke();
      c.globalAlpha = 1;
      break;
    }
    case 'bedrock': {
      c.strokeStyle = node.light; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y + 10); c.lineTo(x + 10, y); c.moveTo(x, y + 26); c.lineTo(x + 26, y); c.moveTo(x + 12, y + CELL); c.lineTo(x + CELL, y + 12); c.stroke();
      break;
    }
    default: {
      // Flecks; ore veins get fat bright nuggets instead.
      const ore = !!node.yield || !!node.glow;
      c.fillStyle = node.fleck;
      const count = ore ? 4 : 2;
      for (let n = 0; n < count; n++) {
        const bits = h >> (n * 7);
        const size = ore ? 4 + (bits & 3) : 2 + (bits & 1);
        c.fillRect(x + 3 + ((bits >> 2) & 15) + (n & 1) * 8, y + 3 + ((bits >> 4) & 15) + (n >> 1) * 6, size, ore ? size - 1 : size);
      }
      if (ore) { c.fillStyle = '#fff4e0'; c.fillRect(x + 6 + (h & 15), y + 6 + ((h >> 5) & 15), 2, 2); }
    }
  }
  // Exposed faces: a lit crust on top, a shadow lip below, soft sides.
  if (!t.solid(col, row - 1)) { c.fillStyle = node.light; c.fillRect(x, y, CELL, 3); }
  if (!t.solid(col, row + 1)) { c.fillStyle = '#0a0608'; c.fillRect(x, y + CELL - 4, CELL, 4); }
  if (!t.solid(col - 1, row)) { c.fillStyle = node.light; c.globalAlpha = .5; c.fillRect(x, y, 2, CELL); c.globalAlpha = 1; }
  if (!t.solid(col + 1, row)) { c.fillStyle = '#0a0608'; c.globalAlpha = .6; c.fillRect(x + CELL - 2, y, 2, CELL); c.globalAlpha = 1; }
  paintCracks(c, t, col, row, x, y, h);
}

/** Crack lines that deepen with each stage of damage. */
function paintCracks(c: CanvasRenderingContext2D, t: Terrain, col: number, row: number, x: number, y: number, h: number): void {
  const stage = crackStage(t.health(col, row));
  if (!stage) return;
  c.strokeStyle = '#070406'; c.lineWidth = stage === 3 ? 2.2 : 1.6;
  c.beginPath();
  const cx = x + CELL / 2 + ((h & 7) - 3), cy = y + CELL / 2 + (((h >> 3) & 7) - 3);
  for (let n = 0; n < stage * 2; n++) {
    const a = ((h >> (n * 3)) & 7) * .785 + n * .9;
    const len = 8 + ((h >> (n + 9)) & 7) + stage * 2;
    c.moveTo(cx, cy);
    const mx = cx + Math.cos(a) * len * .5 + ((h >> n) & 1 ? 2 : -2), my = cy + Math.sin(a) * len * .5;
    c.lineTo(mx, my); c.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
  }
  c.stroke();
}

// ── Debris ─────────────────────────────────────────────────────────────────

const DEBRIS_CAP = 140;

/** Crumbs, chips and dust from broken cells. A fixed pool; spawning past the cap overwrites the oldest. */
export class Debris {
  private readonly x = new Float32Array(DEBRIS_CAP);
  private readonly y = new Float32Array(DEBRIS_CAP);
  private readonly vx = new Float32Array(DEBRIS_CAP);
  private readonly vy = new Float32Array(DEBRIS_CAP);
  private readonly life = new Float32Array(DEBRIS_CAP);
  private readonly size = new Float32Array(DEBRIS_CAP);
  /** 1 = dust (rises, soft, fades), 0 = a chip (falls, bounces). */
  private readonly dust = new Uint8Array(DEBRIS_CAP);
  private readonly color: string[] = new Array(DEBRIS_CAP).fill('#000');
  private next = 0;
  live = 0;
  constructor(private readonly random: () => number = Math.random) {}

  /** A cell crumbles: chips of its colours fall and a puff of dust hangs. */
  crumble(x: number, y: number, base: string, fleck: string, reduced: boolean): void {
    const chips = reduced ? 5 : 11;
    for (let n = 0; n < chips; n++) {
      this.spawn(x + (this.random() - .5) * CELL, y + (this.random() - .5) * CELL,
        (this.random() - .5) * 220, -this.random() * 260 - 40, .7 + this.random() * .5, 2 + this.random() * 3.5, n % 3 ? base : fleck, 0);
    }
    for (let n = 0; n < (reduced ? 2 : 5); n++) {
      this.spawn(x + (this.random() - .5) * CELL, y + (this.random() - .5) * CELL * .6,
        (this.random() - .5) * 40, -10 - this.random() * 25, 1 + this.random() * .6, 8 + this.random() * 10, '#8a7468', 1);
    }
  }
  /** A glancing hit: a few chips, no dust. */
  chip(x: number, y: number, color: string, count: number): void {
    for (let n = 0; n < count; n++) {
      this.spawn(x, y, (this.random() - .5) * 260, -this.random() * 200 - 60, .35 + this.random() * .3, 1.5 + this.random() * 2, color, 0);
    }
  }
  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, dust: number): void {
    const i = this.next; this.next = (this.next + 1) % DEBRIS_CAP;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.life[i] = life; this.size[i] = size; this.color[i] = color; this.dust[i] = dust;
  }
  update(dt: number, terrain: Terrain | null): void {
    let live = 0;
    for (let i = 0; i < DEBRIS_CAP; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.dust[i]) { this.vx[i] *= .96; this.vy[i] *= .97; this.size[i] += dt * 10; }
      else {
        this.vy[i] += 1400 * dt;
        const ny = this.y[i] + this.vy[i] * dt;
        if (terrain && this.vy[i] > 0 && terrain.solidAt(this.x[i], ny)) { this.vy[i] *= -.3; this.vx[i] *= .6; }
        else this.y[i] = ny;
      }
      this.x[i] += this.vx[i] * dt;
      if (this.dust[i]) this.y[i] += this.vy[i] * dt;
      if (this.life[i] > 0) live++;
    }
    this.live = live;
  }
  draw(c: CanvasRenderingContext2D): void {
    if (!this.live) return;
    for (let i = 0; i < DEBRIS_CAP; i++) {
      const life = this.life[i];
      if (life <= 0) continue;
      const s = this.size[i];
      c.fillStyle = this.color[i];
      if (this.dust[i]) {
        c.globalAlpha = Math.min(1, life) * .16;
        c.beginPath(); c.arc(this.x[i], this.y[i], s, 0, Math.PI * 2); c.fill();
      } else {
        c.globalAlpha = Math.min(1, life * 2.5);
        c.fillRect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
      }
    }
    c.globalAlpha = 1;
  }
}

