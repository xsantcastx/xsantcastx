/**
 * terrain-render.ts — drawing for delve terrain. Render-only: nothing here
 * changes a cell.
 *
 * Cells are painted into CHUNK×CHUNK offscreen canvases and blitted; a chunk
 * is repainted only when its revision in the Terrain moved (a cell broke or
 * crossed a crack stage). Chunk canvases are pooled with an LRU cap, so a long
 * delve never holds more than CHUNK_CAP of them. Debris and dust are a fixed
 * pool of particles.
 *
 * The look is Terraria's (tile-art.ts): every cell is 16 × 16 art pixels from
 * a baked texture, solid cells join their neighbours and are outlined and
 * bevelled only where they meet air, the biome's crust grows on top faces,
 * dug cells show a back wall, and generated air (caverns) is left clear so the
 * distant cave (cave-backdrop.ts) shows through. Chunks are painted and
 * blitted unsmoothed, so an art pixel stays a crisp block.
 */
import { BiomeDef, CELL, CHUNK, crackStage, isLoose, Terrain, TERRAIN_NODE_LIST } from './terrain';
import { ART, cellHash, N, nodePalette, paintEdges, paintTopFace, patternOf, pixelLine, takesTopFace, TILE, TileAtlas, tileMask, tileVariant, topFaceOf } from './tile-art';

export { cellHash } from './tile-art';

/** Most chunk canvases kept. A 1280×720 view touches about 24. */
const CHUNK_CAP = 36;
const SIZE = CELL * CHUNK;

interface ChunkCanvas { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; key: number; rev: number; used: number; res: number }

/** Palettes and patterns per node kind, built once. */
const PALETTES = TERRAIN_NODE_LIST.map(node => nodePalette(node));
const PATTERNS = TERRAIN_NODE_LIST.map(node => patternOf(node));

export class TerrainRenderer {
  private terrain: Terrain | null = null;
  private readonly chunks = new Map<number, ChunkCanvas>();
  private readonly free: ChunkCanvas[] = [];
  private frame = 0;
  private offscreen = true;
  /** The baked tile textures, shared by every chunk. */
  readonly atlas = new TileAtlas();

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
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    for (let cr = cr0; cr <= cr1; cr++) {
      for (let cc = cc0; cc <= cc1; cc++) {
        const x = cc * SIZE, y = t.top + cr * SIZE;
        const key = cr * t.chunkCols + cc;
        const chunk = this.offscreen ? this.chunk(key, scale) : null;
        if (!chunk) {
          // No offscreen canvas (tests, very old browsers): paint the cells straight in.
          paintCells(c, t, cc * CHUNK, cr * CHUNK, x, y, null);
          continue;
        }
        if (chunk.rev !== t.chunkRev[key] || chunk.res !== scale) {
          const p = chunk.context;
          p.setTransform(1, 0, 0, 1, 0, 0); p.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height);
          p.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
          p.imageSmoothingEnabled = false;
          paintCells(p, t, cc * CHUNK, cr * CHUNK, x, y, this.atlas);
          chunk.rev = t.chunkRev[key]; chunk.res = scale;
        }
        c.drawImage(chunk.canvas, x, y, SIZE, SIZE);
      }
    }
    c.imageSmoothingEnabled = smoothing;
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
function paintCells(c: CanvasRenderingContext2D, t: Terrain, col0: number, row0: number, x0: number, y0: number, atlas: TileAtlas | null): void {
  const solid = (col: number, row: number) => t.solid(col, row);
  for (let row = row0; row < Math.min(t.rows, row0 + CHUNK); row++) {
    for (let col = col0; col < Math.min(t.cols, col0 + CHUNK); col++) {
      paintCell(c, t, col, row, x0 + (col - col0) * CELL, y0 + (row - row0) * CELL, atlas, solid);
    }
  }
}

/** One baked texture into a cell, or the flat colour where there is no atlas. */
function blitTile(c: CanvasRenderingContext2D, atlas: TileAtlas | null, row: number, variant: number, x: number, y: number, flat: string): void {
  const image = atlas?.canvas;
  if (image && row >= 0) c.drawImage(image, variant * TILE, row * TILE, TILE, TILE, x, y, CELL, CELL);
  else { c.fillStyle = flat; c.fillRect(x, y, CELL, CELL); }
}

/** A dug cell's back wall: the biome's wall texture, shadowed under and beside rock. */
function paintWall(c: CanvasRenderingContext2D, t: Terrain, atlas: TileAtlas | null, biome: BiomeDef, col: number, row: number, x: number, y: number, h: number): void {
  blitTile(c, atlas, atlas ? atlas.wall(biome) : -1, tileVariant(col, row), x, y, (h & 3) === 0 ? biome.wall[0] : biome.wall[1]);
  c.fillStyle = biome.wall[2];
  if (t.solid(col, row - 1)) { c.fillRect(x, y, CELL, ART * 2); c.globalAlpha = .5; c.fillRect(x, y + ART * 2, CELL, ART); c.globalAlpha = 1; }
  if (t.solid(col - 1, row)) { c.fillRect(x, y, ART, CELL); c.globalAlpha = .5; c.fillRect(x + ART, y, ART, CELL); c.globalAlpha = 1; }
  if (t.solid(col + 1, row)) { c.fillRect(x + CELL - ART, y, ART, CELL); c.globalAlpha = .5; c.fillRect(x + CELL - ART * 2, y, ART, CELL); c.globalAlpha = 1; }
}

function paintCell(c: CanvasRenderingContext2D, t: Terrain, col: number, row: number, x: number, y: number, atlas: TileAtlas | null, solid: (col: number, row: number) => boolean): void {
  const index = t.index(col, row);
  const kind = t.kind[index];
  const node = TERRAIN_NODE_LIST[kind];
  const h = cellHash(col, row);
  if (!node.solid) {
    // Generated air (a cavern) stays clear: the distant cave shows through.
    // A dug or built-in cell, and a carved slab, sits on the biome's back wall.
    if (TERRAIN_NODE_LIST[t.base[index]].solid || node.id === 'inscription') paintWall(c, t, atlas, t.biomeAt(row), col, row, x, y, h);
    if (node.id === 'inscription') paintInscription(c, node.light, node.fleck, x, y, h);
    else if (node.placeable) paintPlaced(c, node.id, node.base, node.dark, node.light, node.fleck, x, y);
    return;
  }
  const pattern = PATTERNS[kind];
  blitTile(c, atlas, atlas ? atlas.node(kind) : -1, tileVariant(col, row), x, y, node.base);
  const mask = tileMask(solid, col, row);
  paintEdges(c, x, y, mask, PALETTES[kind]);
  if (!(mask & N) && takesTopFace(pattern)) {
    const face = topFaceOf(t.biomeAt(row));
    if (face) paintTopFace(c, x, y, face, h);
  }
  paintCracks(c, t, col, row, x, y, h);
  if (isLoose(t, col, row)) paintLoose(c, x, y, h);
}

/**
 * Loose rock's warning: a pale fracture right across the cell and a gap
 * along its underside, so it reads as "this lets go" before any dust falls.
 */
function paintLoose(c: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  c.fillStyle = '#d8c2b0'; c.globalAlpha = .55;
  const a = y + 9 + (h & 7), b = y + 14 + ((h >> 3) & 3), d = y + 8 + ((h >> 5) & 7), e = y + 15 + ((h >> 8) & 7);
  pixelLine(c, x, a, x + 10, b); pixelLine(c, x + 10, b, x + 17, d); pixelLine(c, x + 17, d, x + CELL - 1, e);
  pixelLine(c, x + 12 + ((h >> 11) & 7), y + CELL - 1, x + 15, y + 20); pixelLine(c, x + 15, y + 20, x + 10, b);
  c.globalAlpha = .7; c.fillStyle = '#0a0608'; c.fillRect(x + ART * 2, y + CELL - ART * 2, CELL - ART * 4, ART);
  c.globalAlpha = 1;
}

/** A placed thing over the tunnel wall. Stand-in drawing until tile art lands. */
function paintPlaced(c: CanvasRenderingContext2D, id: string, base: string, dark: string, light: string, fleck: string, x: number, y: number): void {
  switch (id) {
    case 'torch': {
      // A bracket on the wall, a haft, and a flame (its light comes from the lighting pass).
      c.fillStyle = dark; c.fillRect(x + 12, y + 20, 8, 3);
      c.fillStyle = base; c.fillRect(x + 14, y + 12, 4, 16);
      c.fillStyle = fleck; c.beginPath(); c.ellipse(x + 16, y + 9, 5, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = light; c.beginPath(); c.ellipse(x + 16, y + 10, 2.5, 4, 0, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'ladder': {
      // Two rails and three rungs; rungs at the same heights in every cell, so a run reads as one ladder.
      c.fillStyle = dark; c.fillRect(x + 6, y, 4, 32); c.fillRect(x + 22, y, 4, 32);
      c.fillStyle = base; c.fillRect(x + 7, y, 2, 32); c.fillRect(x + 23, y, 2, 32);
      for (let ry = 4; ry < 32; ry += 11) { c.fillStyle = dark; c.fillRect(x + 8, y + ry + 1, 16, 3); c.fillStyle = light; c.fillRect(x + 8, y + ry, 16, 2); }
      break;
    }
    case 'chest': {
      // A banded box on the floor: lid, body, brass lock.
      c.fillStyle = dark; c.fillRect(x + 3, y + 12, 26, 20);
      c.fillStyle = base; c.fillRect(x + 4, y + 13, 24, 18);
      c.fillStyle = light; c.fillRect(x + 3, y + 12, 26, 3); c.fillRect(x + 3, y + 20, 26, 2);
      c.fillStyle = fleck; c.fillRect(x + 14, y + 18, 4, 6);
      break;
    }
    case 'camp': {
      // A low workbench with a hammer on it, and a small fire beside it.
      c.fillStyle = dark; c.fillRect(x + 1, y + 18, 18, 3); c.fillRect(x + 3, y + 21, 2, 11); c.fillRect(x + 15, y + 21, 2, 11);
      c.fillStyle = base; c.fillRect(x + 1, y + 16, 18, 3);
      c.fillStyle = light; c.fillRect(x + 6, y + 12, 8, 3); c.fillRect(x + 9, y + 12, 2, 4);
      c.fillStyle = dark; c.fillRect(x + 21, y + 29, 10, 3);
      c.fillStyle = fleck; c.beginPath(); c.ellipse(x + 26, y + 25, 4, 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = light; c.beginPath(); c.ellipse(x + 26, y + 27, 2, 3, 0, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'timber-support': case 'basalt-support': {
      // A post from the floor to a cap beam that bears on the rock above.
      c.fillStyle = dark; c.fillRect(x + 12, y + 4, 8, 28); c.fillRect(x + 2, y, 28, 5);
      c.fillStyle = base; c.fillRect(x + 13, y + 5, 6, 27); c.fillRect(x + 2, y, 28, 3);
      c.fillStyle = light; c.fillRect(x + 13, y + 5, 2, 27);
      c.fillStyle = fleck; c.fillRect(x + 11, y + 6, 3, 3); c.fillRect(x + 18, y + 6, 3, 3);
      break;
    }
    case 'blast-charge': {
      // A bound bundle of sticks on the floor, its fuse curling up (the spark is drawn live).
      c.fillStyle = dark; c.fillRect(x + 7, y + 18, 18, 14);
      c.fillStyle = base; c.fillRect(x + 8, y + 19, 4, 13); c.fillRect(x + 14, y + 19, 4, 13); c.fillRect(x + 20, y + 19, 4, 13);
      c.fillStyle = light; c.fillRect(x + 7, y + 23, 18, 2);
      c.strokeStyle = fleck; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + 16, y + 19); c.quadraticCurveTo(x + 22, y + 14, x + 20, y + 10); c.stroke();
      break;
    }
    case 'platform': {
      // A plank across the top, a lit edge, two thin struts to the wall.
      c.fillStyle = dark; c.fillRect(x, y + 6, 32, 3); c.fillRect(x + 5, y + 6, 2, 12); c.fillRect(x + 25, y + 6, 2, 12);
      c.fillStyle = base; c.fillRect(x, y, 32, 6);
      c.fillStyle = light; c.fillRect(x, y, 32, 2);
      c.fillStyle = fleck; c.fillRect(x + 10, y + 2, 1, 4); c.fillRect(x + 21, y + 2, 1, 4);
      break;
    }
  }
}

/** A dressed slab in the back wall with three rows of carved glyphs, picked by hash. */
function paintInscription(c: CanvasRenderingContext2D, slab: string, glyph: string, x: number, y: number, h: number): void {
  c.fillStyle = slab; c.globalAlpha = .55; c.fillRect(x + 3, y + 3, CELL - 6, CELL - 6); c.globalAlpha = 1;
  c.strokeStyle = glyph; c.lineWidth = 1.4;
  c.beginPath();
  for (let line = 0; line < 3; line++) {
    const gy = y + 8 + line * 8;
    for (let g = 0; g < 3; g++) {
      const bits = (h >> (line * 9 + g * 3)) & 7, gx = x + 7 + g * 7;
      c.moveTo(gx, gy - 2); c.lineTo(gx + (bits & 1 ? 4 : 0), gy + 3);
      if (bits & 2) { c.moveTo(gx - 1, gy); c.lineTo(gx + 4, gy); }
      if (bits & 4) { c.moveTo(gx + 4, gy - 2); c.lineTo(gx + 2, gy + 3); }
    }
  }
  c.stroke();
}

/** Crack lines that deepen with each stage of damage, on the art-pixel grid and inside the cell. */
function paintCracks(c: CanvasRenderingContext2D, t: Terrain, col: number, row: number, x: number, y: number, h: number): void {
  const stage = crackStage(t.health(col, row));
  if (!stage) return;
  c.fillStyle = '#070406';
  const cx = x + CELL / 2 + ((h & 7) - 3), cy = y + CELL / 2 + (((h >> 3) & 7) - 3);
  const inX = (v: number) => Math.max(x, Math.min(x + CELL - 1, v)), inY = (v: number) => Math.max(y, Math.min(y + CELL - 1, v));
  for (let n = 0; n < stage * 2; n++) {
    const a = ((h >> (n * 3)) & 7) * .785 + n * .9;
    const len = 8 + ((h >> (n + 9)) & 7) + stage * 2;
    const mx = inX(cx + Math.cos(a) * len * .5 + ((h >> n) & 1 ? 2 : -2)), my = inY(cy + Math.sin(a) * len * .5);
    pixelLine(c, cx, cy, mx, my);
    pixelLine(c, mx, my, inX(cx + Math.cos(a) * len), inY(cy + Math.sin(a) * len));
    // The deepest stage splits the cell: a second pixel wide.
    if (stage === 3) pixelLine(c, inX(cx + ART), cy, inX(mx + ART), my);
  }
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


// ── Biome ambience ─────────────────────────────────────────────────────────

const MOTE_CAP = 48;

/**
 * The biome's breath: spores drifting up in the Root Hollows, ash settling in
 * the Basalt Caverns, blue motes wandering the Grotto, embers rising in the
 * Magma Halls. A fixed pool in typed arrays; render-only, never touches the
 * world. Reduced motion draws none (the scene stays still, not empty: the
 * biome's wash and dark still carry it).
 */
export class AmbientMotes {
  private readonly x = new Float32Array(MOTE_CAP);
  private readonly y = new Float32Array(MOTE_CAP);
  private readonly vx = new Float32Array(MOTE_CAP);
  private readonly vy = new Float32Array(MOTE_CAP);
  private readonly life = new Float32Array(MOTE_CAP);
  private readonly span = new Float32Array(MOTE_CAP);
  private readonly size = new Float32Array(MOTE_CAP);
  private readonly phase = new Float32Array(MOTE_CAP);
  private biome: BiomeDef | null = null;
  private time = 0;
  live = 0;
  constructor(private readonly random: () => number = Math.random) {}

  /** Drop every mote (a new area). */
  reset(): void { this.life.fill(0); this.live = 0; this.biome = null; }

  /** Advance and top the pool up to the biome's count, spawning inside the view (world px). */
  update(dt: number, biome: BiomeDef, left: number, top: number, width: number, height: number, reduced: boolean): void {
    if (reduced || biome.particles.count <= 0) { if (this.live) this.reset(); return; }
    if (biome !== this.biome) { this.life.fill(0); this.live = 0; this.biome = biome; }
    this.time += dt;
    const kind = biome.particles.kind;
    const target = Math.min(MOTE_CAP, biome.particles.count);
    let live = 0, spawned = 0;
    for (let i = 0; i < MOTE_CAP; i++) {
      if (this.life[i] <= 0) {
        // A couple per frame, so a biome fades in rather than popping.
        // Counted against last frame's total: this frame's is still being tallied.
        if (this.live + spawned >= target || spawned >= 2) continue;
        this.spawn(i, kind, left, top, width, height);
        spawned++;
        continue;
      }
      this.life[i] -= dt;
      const sway = Math.sin(this.time * 1.3 + this.phase[i]);
      this.x[i] += (this.vx[i] + (kind === 'ember' ? 0 : sway * 6)) * dt;
      this.y[i] += (this.vy[i] + (kind === 'mote' ? Math.cos(this.time + this.phase[i]) * 5 : 0)) * dt;
      // Out of view: retire it, a fresh one is spawned in view.
      if (this.x[i] < left - 40 || this.x[i] > left + width + 40 || this.y[i] < top - 40 || this.y[i] > top + height + 40) this.life[i] = 0;
      if (this.life[i] > 0) live++;
    }
    this.live = live + spawned;
  }
  private spawn(i: number, kind: BiomeDef['particles']['kind'], left: number, top: number, width: number, height: number): void {
    const r = this.random;
    this.x[i] = left + r() * width;
    this.y[i] = top + r() * height;
    this.phase[i] = r() * Math.PI * 2;
    switch (kind) {
      case 'ember': this.vx[i] = (r() - .5) * 18; this.vy[i] = -40 - r() * 50; this.span[i] = 2 + r() * 2.5; this.size[i] = 1 + r() * 1.4; break;
      case 'spore': this.vx[i] = (r() - .5) * 6; this.vy[i] = -6 - r() * 9; this.span[i] = 6 + r() * 5; this.size[i] = 1.2 + r() * 1.6; break;
      case 'mote': this.vx[i] = (r() - .5) * 14; this.vy[i] = (r() - .5) * 10; this.span[i] = 5 + r() * 5; this.size[i] = 1.5 + r() * 2; break;
      default: this.vx[i] = (r() - .5) * 8; this.vy[i] = 8 + r() * 12; this.span[i] = 6 + r() * 5; this.size[i] = 1 + r(); break;
    }
    this.life[i] = this.span[i];
  }
  /** Draw in world px (camera applied), after the darkness so the lit kinds glow through it. */
  draw(c: CanvasRenderingContext2D): void {
    const biome = this.biome;
    if (!this.live || !biome) return;
    const kind = biome.particles.kind;
    const glows = kind !== 'ash';
    c.save();
    if (glows) c.globalCompositeOperation = 'lighter';
    c.fillStyle = biome.particles.color;
    for (let i = 0; i < MOTE_CAP; i++) {
      const life = this.life[i];
      if (life <= 0) continue;
      const age = 1 - life / this.span[i];
      // Fade in over the first fifth, out over the last third; embers flicker.
      const fade = Math.min(1, age * 5, life / (this.span[i] * .33));
      const flicker = kind === 'ember' ? .65 + .35 * Math.sin(this.time * 17 + this.phase[i]) : kind === 'mote' ? .6 + .4 * Math.sin(this.time * 2.2 + this.phase[i]) : 1;
      c.globalAlpha = Math.max(0, fade * flicker) * (glows ? .8 : .35);
      const s = this.size[i];
      c.fillRect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
    }
    c.restore();
  }
}

/**
 * Coloured light, additive, for glowing cells (glowcaps tint the Grotto blue)
 * and the Magma Halls' heat columns. One unit gradient per colour, built once
 * and scaled by transform, so a frame allocates nothing after the first.
 */
export class GlowHalos {
  private readonly radial = new Map<string, CanvasGradient>();
  private readonly column = new Map<string, CanvasGradient>();
  /** Pre-rendered halo discs per colour (phones): a bitmap blit instead of shading a gradient per pixel. */
  private readonly discs = new Map<string, HTMLCanvasElement | null>();
  /**
   * A soft disc of `color` at (x, y), radius r, in the current transform.
   * `sprite` (the phone tier) draws a cached 128 px disc of the same gradient
   * instead: on a software canvas that halves the cost of each halo.
   */
  halo(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number, sprite = false): void {
    const disc = sprite ? this.disc(color) : null;
    if (disc) {
      const was = c.globalAlpha;
      c.globalAlpha = alpha; c.drawImage(disc, x - r, y - r, r * 2, r * 2); c.globalAlpha = was;
      return;
    }
    let gradient = this.radial.get(color);
    if (!gradient) {
      gradient = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, color); gradient.addColorStop(1, 'rgba(0,0,0,0)');
      this.radial.set(color, gradient);
    }
    c.save(); c.globalAlpha = alpha; c.fillStyle = gradient;
    c.translate(x, y); c.scale(r, r); c.fillRect(-1, -1, 2, 2);
    c.restore();
  }
  private disc(color: string): HTMLCanvasElement | null {
    let disc = this.discs.get(color);
    if (disc === undefined) {
      disc = null;
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        const d = canvas.getContext?.('2d');
        if (d) {
          canvas.width = canvas.height = 128;
          const g = d.createRadialGradient(64, 64, 0, 64, 64, 64);
          g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
          d.fillStyle = g; d.fillRect(0, 0, 128, 128);
          disc = canvas;
        }
      }
      this.discs.set(color, disc);
    }
    return disc;
  }
  /** A vertical band of `color`, clear at both ends, w × h at (x, y). */
  band(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha: number): void {
    let gradient = this.column.get(color);
    if (!gradient) {
      gradient = c.createLinearGradient(0, 0, 1, 0);
      gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(.5, color); gradient.addColorStop(1, 'rgba(0,0,0,0)');
      this.column.set(color, gradient);
    }
    c.save(); c.globalAlpha = alpha; c.fillStyle = gradient;
    c.translate(x, y); c.scale(w, h); c.fillRect(0, 0, 1, 1);
    c.restore();
  }
}
