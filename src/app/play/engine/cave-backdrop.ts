/**
 * cave-backdrop.ts — the distant cave behind a delve's natural caverns.
 *
 * Two procedural pixel layers per biome (Terraria's underground backgrounds):
 * a far one, opaque (a dim rock face with stalactites and stalagmites), and a
 * near one, transparent but for big dark columns and hanging rock edged in the
 * biome's wash colour. Each is baked once per biome into a small canvas and
 * laid as a repeating pattern, scrolling slower than the world (×0.2 far,
 * ×0.45 near), clipped to the rows its biome holds. It shows only through
 * the generated air (caverns, the old tunnel): dug cells paint their own back
 * wall over it (terrain-render.ts).
 *
 * Imported art (RND-2): `parallax-delve-<biome id>-far` / `-near`
 * (scripts/import-assets.py, `Assets/Sprites/Parallax/`) replaces a
 * procedural layer once its image has loaded, laid at 2 world px per art px
 * like the tiles; the procedural layer stands in until then and for any
 * biome without one.
 *
 * Cheap on purpose: no per-frame allocation, two pattern fills per biome band
 * in view, and below the surface the town painting and its shade (which the
 * opaque terrain used to hide entirely) are skipped instead.
 */
import { BiomeDef, CELL, seededRandom, Terrain } from './terrain';
import { ART, mixHex } from './tile-art';
import { parallaxFor } from '../../shared/art/parallax-manifest.generated';

/** Texels of each layer (one texel = ART world px). Both tile in x and y. */
const FAR = { w: 128, h: 96, speed: .2 };
const NEAR = { w: 160, h: 128, speed: .45 };

/** A layer's pixels: 0 clear, 1 rock, 2 rim, 3 back (far only). Tiles in both directions. Pure. */
export function parallaxPixels(layer: 'far' | 'near', seed: number): Uint8Array {
  const { w, h } = layer === 'far' ? FAR : NEAR;
  const px = new Uint8Array(w * h);
  const r = seededRandom(seed);
  // A wrapped sum of triangular spikes: hanging or rising rock, tileable in x.
  const profile = (count: number, minH: number, maxH: number, minW: number, maxW: number) => {
    const spikes = Array.from({ length: count }, () => ({ x: r() * w, h: minH + r() * (maxH - minH), w: minW + r() * (maxW - minW) }));
    const out = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (const s of spikes) {
        let d = Math.abs(x - s.x); d = Math.min(d, w - d);
        v = Math.max(v, s.h * (1 - d / s.w));
      }
      out[x] = v;
    }
    return out;
  };
  if (layer === 'far') {
    px.fill(3);
    const ceiling = profile(14, 4, 26, 3, 9), floor = profile(12, 4, 22, 3, 10);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < Math.round(ceiling[x] + 3); y++) px[y * w + x] = 1;
      for (let y = h - 1; y >= h - Math.round(floor[x] + 3); y--) px[y * w + x] = 1;
    }
  } else {
    const ceiling = profile(8, 6, 44, 5, 16);
    const columns = Array.from({ length: 2 }, () => ({ x: r() * w, w: 7 + r() * 8, phase: r() * 6.3 }));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let solid = y < ceiling[x];
        for (const c of columns) {
          let d = Math.abs(x - c.x); d = Math.min(d, w - d);
          if (d < c.w + Math.sin(y * Math.PI * 2 * 3 / h + c.phase) * 2) solid = true;
        }
        if (solid) px[y * w + x] = 1;
      }
    }
  }
  // Rim light: a rock texel with open space (clear or back) to its left or below.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[y * w + x] !== 1) continue;
      const left = px[y * w + ((x + w - 1) % w)], below = px[((y + 1) % h) * w + x];
      if (left !== 1 && left !== 2 || below !== 1 && below !== 2) px[y * w + x] = 2;
    }
  }
  return px;
}

/** A layer's colours [clear, rock, rim, back] for a biome. */
function layerColors(biome: BiomeDef, layer: 'far' | 'near'): (string | null)[] {
  const [wall0, wall1, shadow] = biome.wall;
  const wash = biome.wash.alpha > 0 ? biome.wash.color : wall0;
  return layer === 'far'
    ? [null, mixHex(mixHex(wall1, wall0, .5), wash, .06), mixHex(wall0, wash, .18), mixHex(shadow, wall1, .45)]
    : [null, mixHex(shadow, '#140a1f', .25), mixHex(wall0, wash, .45), null];
}

interface Layer { canvas: HTMLCanvasElement | null; pattern: CanvasPattern | null; context: CanvasRenderingContext2D | null }

type ImageFor = (url: string) => HTMLImageElement | undefined;

export class CaveBackdrop {
  private readonly layers = new Map<string, Layer>();
  /** Imported layers: their 1x image and its pattern for the current context. */
  private readonly imported = new Map<string, { url: string | null; image: HTMLImageElement | null; pattern: CanvasPattern | null; context: CanvasRenderingContext2D | null }>();
  private failed = false;
  constructor(private readonly image: ImageFor | null = null, private readonly lookup: typeof parallaxFor = parallaxFor) {}

  /**
   * Fill the screen below the terrain's top edge with each biome's two layers.
   * `c` is in view world px (scaled, no camera translate). Returns true when
   * the terrain fills the whole view (nothing of the surface shows).
   */
  draw(c: CanvasRenderingContext2D, t: Terrain, camera: number, cameraY: number, viewport: number, height: number, masked = 0): boolean {
    const top = t.top - cameraY;
    if (top >= height) return false;
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    if (masked > 0) this.openRuns(t, camera, cameraY, viewport, height, masked);
    let from = 0;
    for (const biome of t.biomes) {
      const to = Math.min(t.rows, biome.to);
      const y0 = Math.max(0, top + from * CELL), y1 = Math.min(height, top + to * CELL);
      from = to;
      if (y1 <= y0) continue;
      if (masked > 0) {
        // Under solid rock the opaque tiles hide the cave: a flat fill of the far layer's colour there,
        // the two pattern layers only on the runs that can show (render-budget.ts `maskBackdrop`).
        c.fillStyle = this.flat(biome); c.fillRect(0, y0, viewport, y1 - y0);
        this.fill(c, biome, 'far', camera, cameraY, viewport, y0, y1, true);
        this.fill(c, biome, 'near', camera, cameraY, viewport, y0, y1, true);
      } else {
        this.fill(c, biome, 'far', camera, cameraY, viewport, y0, y1);
        this.fill(c, biome, 'near', camera, cameraY, viewport, y0, y1);
      }
      if (from >= t.rows) break;
    }
    c.imageSmoothingEnabled = smoothing;
    return top <= 0;
  }

  /** Runs to pattern-fill this frame: screen-world x, y, w, h, snapped to device pixels. */
  private runs = new Float32Array(4 * 128);
  private runCount = 0;
  /** Per view cell: 1 when the cell or a neighbour is open (the cave can show there). Reused. */
  private near = new Uint8Array(0);
  private readonly flats = new Map<string, string>();

  /**
   * The cells in view where the distant cave can show, as horizontal runs per cell row: any cell that is not
   * solid rock (generated air shows it; a dug wall or a placed thing may have see-through pixels), with one
   * cell of margin, since a tile's edge piece may be rounded. Columns outside the loaded span are filled too
   * (nothing is drawn over them), without margin.
   * `pixelScale`: device px per world px, so every run edge lands on a device pixel (no seam between runs).
   */
  private openRuns(t: Terrain, camera: number, cameraY: number, viewport: number, height: number, pixelScale: number): void {
    const c0 = Math.floor(camera / CELL), c1 = Math.floor((camera + viewport) / CELL);
    const r0 = Math.max(0, Math.floor((cameraY - t.top) / CELL)), r1 = Math.min(t.rows - 1, Math.floor((cameraY + height - t.top) / CELL));
    this.runCount = 0;
    if (r1 < r0) return;
    // Open cells over the view plus a ring of one, then dilated into `near`.
    const w = c1 - c0 + 3, h = r1 - r0 + 3;
    if (this.near.length < w * h * 2) this.near = new Uint8Array(w * h * 2);
    const open = this.near, near = this.near, o = w * h;
    for (let j = 0; j < h; j++) {
      const row = r0 - 1 + j;
      for (let i = 0; i < w; i++) {
        const col = c0 - 1 + i;
        // 1: open and in the loaded span (its neighbours' tiles may have see-through edges); 2: outside the span,
        // where nothing is drawn over the cave, but a tile beside it is drawn as interior rock (solid() is true there).
        open[j * w + i] = row < 0 || row >= t.rows ? 0 : !t.inside(col, row) ? 2 : !t.solid(col, row) ? 1 : 0;
      }
    }
    for (let j = 1; j < h - 1; j++) {
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i;
        near[o + k] = open[k] || (open[k - w - 1] | open[k - w] | open[k - w + 1] | open[k - 1] | open[k + 1] | open[k + w - 1] | open[k + w] | open[k + w + 1]) & 1 ? 1 : 0;
      }
    }
    const snap = (v: number) => Math.round(v * pixelScale) / pixelScale;
    for (let j = 1; j < h - 1; j++) {
      const row = r0 - 1 + j;
      const y0 = snap(t.top + row * CELL - cameraY), y1 = snap(t.top + (row + 1) * CELL - cameraY);
      let i = 1;
      while (i < w - 1) {
        if (!near[o + j * w + i]) { i++; continue; }
        let end = i + 1;
        while (end < w - 1 && near[o + j * w + end]) end++;
        const x0 = snap(Math.max(0, (c0 - 1 + i) * CELL - camera)), x1 = snap(Math.min(viewport, (c0 - 1 + end) * CELL - camera));
        if (this.runCount * 4 + 4 > this.runs.length) { const grown = new Float32Array(this.runs.length * 2); grown.set(this.runs); this.runs = grown; }
        const r = this.runCount++ * 4;
        this.runs[r] = x0; this.runs[r + 1] = y0; this.runs[r + 2] = x1 - x0; this.runs[r + 3] = y1 - y0;
        i = end;
      }
    }
  }

  /** The far layer's back colour for a biome: what the masked rock rows are filled with. */
  private flat(biome: BiomeDef): string {
    let color = this.flats.get(biome.id);
    if (!color) { color = layerColors(biome, 'far')[3]!; this.flats.set(biome.id, color); }
    return color;
  }

  /** Fill the band y0..y1 with one layer; `runs`: only the open runs (openRuns) inside the band. */
  private fill(c: CanvasRenderingContext2D, biome: BiomeDef, layer: 'far' | 'near', camera: number, cameraY: number, viewport: number, y0: number, y1: number, runs = false): void {
    const spec = layer === 'far' ? FAR : NEAR;
    const art = this.importedPattern(c, biome, layer);
    if (art) {
      // Imported: the 1x image is 4 px per art px; the Delve lays it at 2 (half size), snapped.
      const tw = art.w / 2, th = art.h / 2;
      const ox = -Math.round(((camera * spec.speed) % tw) / ART) * ART, oy = -Math.round(((cameraY * spec.speed) % th) / ART) * ART;
      c.save();
      c.translate(ox, oy); c.scale(.5, .5);
      c.fillStyle = art.pattern;
      if (runs) this.fillRuns(c, y0, y1, ox, oy, 2);
      else c.fillRect(-ox * 2, (y0 - oy) * 2, viewport * 2, (y1 - y0) * 2);
      c.restore();
      return;
    }
    const pattern = this.pattern(c, biome, layer);
    if (!pattern) {
      if (layer === 'far') {
        c.fillStyle = biome.wall[2];
        if (runs) this.fillRuns(c, y0, y1, 0, 0, 1); else c.fillRect(0, y0, viewport, y1 - y0);
      }
      return;
    }
    const tw = spec.w * ART, th = spec.h * ART;
    // Snapped to whole art pixels so the layer never swims between texels.
    const ox = -Math.round(((camera * spec.speed) % tw) / ART) * ART, oy = -Math.round(((cameraY * spec.speed) % th) / ART) * ART;
    c.save();
    c.translate(ox, oy); c.scale(ART, ART);
    c.fillStyle = pattern;
    if (runs) this.fillRuns(c, y0, y1, ox, oy, 1 / ART);
    else c.fillRect(-ox / ART, (y0 - oy) / ART, viewport / ART, (y1 - y0) / ART);
    c.restore();
  }

  /** The open runs clipped to y0..y1, in a frame translated by (ox, oy) and scaled by 1/k. */
  private fillRuns(c: CanvasRenderingContext2D, y0: number, y1: number, ox: number, oy: number, k: number): void {
    const r = this.runs;
    for (let n = 0; n < this.runCount; n++) {
      const x = r[n * 4], y = Math.max(y0, r[n * 4 + 1]), w = r[n * 4 + 2], bottom = Math.min(y1, r[n * 4 + 1] + r[n * 4 + 3]);
      if (bottom <= y) continue;
      c.fillRect((x - ox) * k, (y - oy) * k, w * k, (bottom - y) * k);
    }
  }

  /** The imported layer's pattern once its image has loaded, else null. */
  private importedPattern(c: CanvasRenderingContext2D, biome: BiomeDef, layer: 'far' | 'near'): { pattern: CanvasPattern; w: number; h: number } | null {
    if (!this.image) return null;
    const key = `${biome.id}:${layer}`;
    let entry = this.imported.get(key);
    if (!entry) {
      const found = this.lookup(`delve-${biome.id}`, layer);
      entry = { url: found ? found.src : null, image: null, pattern: null, context: null };
      this.imported.set(key, entry);
    }
    if (!entry.url) return null;
    if (!entry.image) {
      const image = this.image(entry.url);
      if (!image?.complete || !image.naturalWidth) return null;
      entry.image = image;
    }
    if (entry.context !== c) {
      entry.context = c;
      entry.pattern = typeof c.createPattern === 'function' ? c.createPattern(entry.image, 'repeat') ?? null : null;
    }
    return entry.pattern ? { pattern: entry.pattern, w: entry.image.naturalWidth, h: entry.image.naturalHeight } : null;
  }

  private pattern(c: CanvasRenderingContext2D, biome: BiomeDef, layer: 'far' | 'near'): CanvasPattern | null {
    const key = `${biome.id}:${layer}`;
    let entry = this.layers.get(key);
    if (!entry) {
      entry = { canvas: this.bake(biome, layer), pattern: null, context: null };
      this.layers.set(key, entry);
    }
    if (!entry.canvas) return null;
    if (entry.context !== c) {
      entry.context = c;
      entry.pattern = typeof c.createPattern === 'function' ? c.createPattern(entry.canvas, 'repeat') ?? null : null;
    }
    return entry.pattern;
  }

  private bake(biome: BiomeDef, layer: 'far' | 'near'): HTMLCanvasElement | null {
    if (this.failed || typeof document === 'undefined' || typeof document.createElement !== 'function') { this.failed = true; return null; }
    const spec = layer === 'far' ? FAR : NEAR;
    const canvas = document.createElement('canvas');
    const d = canvas.getContext?.('2d');
    if (!d) return null;
    canvas.width = spec.w; canvas.height = spec.h;
    let seed = 0x0ca7e ^ (layer === 'far' ? 0 : 0x5bd1e995);
    for (let i = 0; i < biome.id.length; i++) seed = Math.imul(seed ^ biome.id.charCodeAt(i), 16777619) >>> 0;
    const px = parallaxPixels(layer, seed), colors = layerColors(biome, layer);
    for (let y = 0; y < spec.h; y++) {
      let x = 0;
      while (x < spec.w) {
        const v = px[y * spec.w + x];
        let end = x + 1;
        while (end < spec.w && px[y * spec.w + end] === v) end++;
        const color = colors[v];
        if (color) { d.fillStyle = color; d.fillRect(x, y, end - x, 1); }
        x = end;
      }
    }
    return canvas;
  }
}
