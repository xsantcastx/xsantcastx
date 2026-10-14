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
import { ART, AUTOTILE_ROWS, autoTilePiece, cellHash, N, nodePalette, P_CLEAR_INDEX, paintEdges, paintTopFace, patternOf, patternPixels, pixelLine, takesTopFace, TILE, TileAtlas, tileMask, tileVariant, topFaceOf } from './tile-art';
import { tileFor, type TileEntry } from '../../shared/art/tile-manifest.generated';

export { cellHash } from './tile-art';

/** Most chunk canvases kept. A 1280×720 view touches about 24. */
const CHUNK_CAP = 36;
const SIZE = CELL * CHUNK;

interface ChunkCanvas { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; key: number; rev: number; used: number; res: number; epoch: number }

/** An imported tile sheet (`tileFor`), its image, and its cell edge in image px once loaded. */
interface Sheet { entry: TileEntry; image: HTMLImageElement; cell: number; ready: boolean }
/** Looks up imported art per terrain node / wall id; null keeps the procedural tile. */
export type SheetLookup = (id: string) => Sheet | null;

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
  /** Imported sheets by id (null: none imported). */
  private readonly sheets = new Map<string, Sheet | null>();
  /** Bumped when an imported sheet finishes loading: every cached chunk repaints once. */
  private epoch = 0;
  /** Art lookup (tests inject one); `tileFor` reads the generated tile manifest. */
  constructor(private readonly tiles: (id: string) => TileEntry | null = tileFor) {}

  /**
   * The imported sheet for a node or wall id (`rock`, `wall-root-hollows`), once
   * its image has loaded, else null and the procedural tile stands in (RND-1).
   */
  readonly sheet: SheetLookup = (id: string) => {
    let sheet = this.sheets.get(id);
    if (sheet === undefined) {
      sheet = null;
      const entry = this.tiles(id);
      if (entry && typeof Image !== 'undefined') {
        const image = new Image();
        const made: Sheet = { entry, image, cell: 0, ready: false };
        image.onload = () => {
          const rows = entry.autotile ? AUTOTILE_ROWS.length : 1;
          made.cell = image.naturalHeight / rows;
          made.ready = made.cell > 0;
          if (made.ready) this.epoch++;
        };
        image.src = entry.src2x || entry.src;
        sheet = made;
      }
      this.sheets.set(id, sheet);
    }
    return sheet && sheet.ready ? sheet : null;
  };

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
    // World chunk columns in view, inside the loaded span (a ring's span moves; the plain grid's is 0..cols).
    const cc0 = Math.max(Math.floor(t.colLo / CHUNK), Math.floor(left / SIZE)), cc1 = Math.min(Math.ceil(t.colHi / CHUNK) - 1, Math.floor((left + width) / SIZE));
    const cr0 = Math.max(0, Math.floor((top - t.top) / SIZE)), cr1 = Math.min(t.chunkRows - 1, Math.floor((top + height - t.top) / SIZE));
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    for (let cr = cr0; cr <= cr1; cr++) {
      for (let cc = cc0; cc <= cc1; cc++) {
        const x = cc * SIZE, y = t.top + cr * SIZE;
        const key = t.chunkKey(cc, cr);
        if (key < 0) continue;
        const chunk = this.offscreen ? this.chunk(key, scale) : null;
        if (!chunk) {
          // No offscreen canvas (tests, very old browsers): paint the cells straight in.
          paintCells(c, t, cc * CHUNK, cr * CHUNK, x, y, null, this.sheet);
          continue;
        }
        if (chunk.rev !== t.chunkRev[key] || chunk.res !== scale || chunk.epoch !== this.epoch) {
          const p = chunk.context;
          p.setTransform(1, 0, 0, 1, 0, 0); p.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height);
          p.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
          p.imageSmoothingEnabled = false;
          paintCells(p, t, cc * CHUNK, cr * CHUNK, x, y, this.atlas, this.sheet);
          chunk.rev = t.chunkRev[key]; chunk.res = scale; chunk.epoch = this.epoch;
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
    return { canvas, context, key: -1, rev: -1, used: 0, res: 0, epoch: -1 };
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
function paintCells(c: CanvasRenderingContext2D, t: Terrain, col0: number, row0: number, x0: number, y0: number, atlas: TileAtlas | null, sheets: SheetLookup | null): void {
  const solid = (col: number, row: number) => t.solid(col, row);
  for (let row = row0; row < Math.min(t.rows, row0 + CHUNK); row++) {
    for (let col = col0; col < Math.min(t.colHi, col0 + CHUNK); col++) {
      paintCell(c, t, col, row, x0 + (col - col0) * CELL, y0 + (row - row0) * CELL, atlas, solid, sheets);
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
function paintWall(c: CanvasRenderingContext2D, t: Terrain, atlas: TileAtlas | null, biome: BiomeDef, col: number, row: number, x: number, y: number, h: number, sheets: SheetLookup | null): void {
  const wall = sheets?.(`wall-${biome.id}`);
  if (wall) drawSheetCell(c, wall, 0, h % Math.max(1, wall.entry.variants), x, y);
  else blitTile(c, atlas, atlas ? atlas.wall(biome) : -1, tileVariant(col, row), x, y, (h & 3) === 0 ? biome.wall[0] : biome.wall[1]);
  c.fillStyle = biome.wall[2];
  if (t.solid(col, row - 1)) { c.fillRect(x, y, CELL, ART * 2); c.globalAlpha = .5; c.fillRect(x, y + ART * 2, CELL, ART); c.globalAlpha = 1; }
  if (t.solid(col - 1, row)) { c.fillRect(x, y, ART, CELL); c.globalAlpha = .5; c.fillRect(x + ART, y, ART, CELL); c.globalAlpha = 1; }
  if (t.solid(col + 1, row)) { c.fillRect(x + CELL - ART, y, ART, CELL); c.globalAlpha = .5; c.fillRect(x + CELL - ART * 2, y, ART, CELL); c.globalAlpha = 1; }
}

/** One cell of an imported sheet (row, column) into a 32 px cell, unsmoothed. */
function drawSheetCell(c: CanvasRenderingContext2D, sheet: Sheet, row: number, col: number, x: number, y: number): void {
  c.drawImage(sheet.image, col * sheet.cell, row * sheet.cell, sheet.cell, sheet.cell, x, y, CELL, CELL);
}

function paintCell(c: CanvasRenderingContext2D, t: Terrain, col: number, row: number, x: number, y: number, atlas: TileAtlas | null, solid: (col: number, row: number) => boolean, sheets: SheetLookup | null): void {
  const index = t.index(col, row);
  const kind = t.kind[index];
  const node = TERRAIN_NODE_LIST[kind];
  const h = cellHash(col, row);
  if (!node.solid) {
    // Generated air (a cavern) stays clear: the distant cave shows through.
    // A dug or built-in cell, and a carved slab, sits on the biome's back wall.
    if (TERRAIN_NODE_LIST[t.base[index]].solid || node.id === 'inscription') paintWall(c, t, atlas, t.biomeAt(row), col, row, x, y, h, sheets);
    if (node.id === 'inscription') {
      const tally = TALLY_CARVINGS[t.inscriptions.get(index) ?? ''];
      if (tally) paintTally(c, node.light, tally, x, y);
      else paintInscription(c, node.light, node.fleck, x, y, h);
    }
    else if (node.placeable || node.use === 'shrine') paintPlaced(c, atlas, kind, x, y);
    return;
  }
  const pattern = PATTERNS[kind];
  const mask = tileMask(solid, col, row);
  const sheet = sheets?.(node.id);
  if (sheet?.entry.autotile) {
    // A full W7a sheet (RND-1): the piece for this cell's neighbours carries its own edges and lip.
    const [pieceRow, pieceCol] = autoTilePiece(mask, h);
    drawSheetCell(c, sheet, pieceRow, pieceCol, x, y);
  } else {
    // An imported interior strip, or the baked procedural texture; edges and the top face are drawn here.
    if (sheet) drawSheetCell(c, sheet, 0, h % Math.max(1, sheet.entry.variants), x, y);
    else blitTile(c, atlas, atlas ? atlas.node(kind) : -1, tileVariant(col, row), x, y, node.base);
    paintEdges(c, x, y, mask, PALETTES[kind]);
  }
  if (!sheet?.entry.autotile && !(mask & N) && takesTopFace(pattern)) {
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

/**
 * A placed thing over the tunnel wall: its 16 x 16 pixel map (tile-art.ts
 * PLACED_ART) from the atlas, transparent around the object. With no atlas
 * (tests) the same pixels are filled straight in.
 */
function paintPlaced(c: CanvasRenderingContext2D, atlas: TileAtlas | null, kind: number, x: number, y: number): void {
  const row = atlas ? atlas.node(kind) : -1;
  const image = atlas?.canvas;
  if (image && row >= 0) { c.drawImage(image, 0, row * TILE, TILE, TILE, x, y, CELL, CELL); return; }
  const node = TERRAIN_NODE_LIST[kind], palette = PALETTES[kind];
  const px = patternPixels(PATTERNS[kind], node.id, 0).px;
  for (let i = 0; i < px.length; i++) {
    if (px[i] === P_CLEAR_INDEX) continue;
    c.fillStyle = palette[px[i]]; c.fillRect(x + (i % TILE) * ART, y + Math.floor(i / TILE) * ART, ART, ART);
  }
}

/** A dressed slab in the back wall with three rows of carved glyphs, picked by hash; on the art-pixel grid. */
function paintInscription(c: CanvasRenderingContext2D, slab: string, glyph: string, x: number, y: number, h: number): void {
  c.fillStyle = '#140a1f'; c.globalAlpha = .6; c.fillRect(x + ART, y + ART, CELL - ART * 2, CELL - ART * 2);
  c.fillStyle = slab; c.globalAlpha = .75; c.fillRect(x + ART * 2, y + ART * 2, CELL - ART * 4, CELL - ART * 4); c.globalAlpha = 1;
  c.fillStyle = glyph;
  for (let line = 0; line < 3; line++) {
    const gy = y + 8 + line * 8;
    for (let g = 0; g < 3; g++) {
      const bits = (h >> (line * 9 + g * 3)) & 7, gx = x + 6 + g * 7;
      pixelLine(c, gx, gy - 2, gx + (bits & 1 ? 4 : 0), gy + 3);
      if (bits & 2) pixelLine(c, gx - 1, gy, gx + 4, gy);
      if (bits & 4) pixelLine(c, gx + 4, gy - 2, gx + 2, gy + 3);
    }
  }
}

/**
 * The two tally carvings are the story's own marks (shared/story, Act I), so
 * they are drawn as what they are rather than as generic glyphs:
 *  - `roots-keepers-tally` (Root Hollows): five marks at Keeper height, four
 *    struck through, the fifth worn smooth (a soft, wide, pale stroke);
 *  - `magma-unsigned` (Magma Halls): a single old mark, and a fresh one beside
 *    it — pale new-cut stone with the notch at the top a Keeper's pick leaves
 *    where the stroke turns, and a little bright grit under it.
 * Keyed by inscription id; every other carving keeps its glyphs.
 */
interface TallyCarving { marks: number; struck: number; worn: boolean; fresh: boolean }
const TALLY_CARVINGS: Readonly<Record<string, TallyCarving>> = {
  'roots-keepers-tally': { marks: 5, struck: 4, worn: true, fresh: false },
  'magma-unsigned': { marks: 1, struck: 0, worn: false, fresh: true },
};
/** Old cuts are dark grooves; fresh-cut stone and its grit are brighter than anything weathered. */
const OLD_GROOVE = '#2b1a12';
const FRESH_CUT = '#fff4dc';
const FRESH_GRIT = '#e8cf9a';

function paintTally(c: CanvasRenderingContext2D, slab: string, tally: TallyCarving, x: number, y: number): void {
  c.fillStyle = '#140a1f'; c.globalAlpha = .6; c.fillRect(x + ART, y + ART, CELL - ART * 2, CELL - ART * 2);
  c.fillStyle = slab; c.globalAlpha = .75; c.fillRect(x + ART * 2, y + ART * 2, CELL - ART * 4, CELL - ART * 4); c.globalAlpha = 1;
  // Strokes are one art pixel wide and seven tall, two art pixels apart, cut a little high (Keeper height).
  const top = y + ART * 3, tall = ART * 7;
  const count = tally.marks + (tally.fresh ? 1 : 0);
  // Two art pixels apart when there is room (the pair), one when there are five.
  const stride = ART * (count > 3 ? 2 : 3);
  const left = x + Math.round((CELL - ((count - 1) * stride + ART)) / 2 / ART) * ART;
  for (let n = 0; n < tally.marks; n++) {
    const sx = left + n * stride;
    const worn = tally.worn && n === tally.marks - 1;
    c.fillStyle = OLD_GROOVE;
    // Worn smooth: gone over so often the edges have rounded off into the slab.
    if (worn) { c.globalAlpha = .35; c.fillRect(sx - ART, top + ART, ART * 3, tall - ART * 2); c.globalAlpha = .8; }
    c.fillRect(sx, top, ART, tall);
    c.globalAlpha = 1;
    // Struck through: a short slash across the stroke, from low-left to high-right.
    if (n < tally.struck) pixelLine(c, sx - ART, top + ART * 5, sx + ART, top + ART * 2);
  }
  if (tally.fresh) {
    const sx = left + tally.marks * stride;
    // A groove's shadow on its left, then the pale new-cut floor of it.
    c.fillStyle = OLD_GROOVE;
    c.fillRect(sx - ART, top, ART, tall);
    c.fillStyle = FRESH_CUT;
    c.fillRect(sx, top, ART, tall);
    // The notch where the stroke turned: the Keeper's own pick leaves it.
    c.fillRect(sx + ART, top, ART, ART);
    c.fillStyle = FRESH_GRIT;
    c.fillRect(sx - ART, top + tall + ART, ART, ART);
    c.fillRect(sx + ART * 2, top + tall, ART, ART);
  }
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
