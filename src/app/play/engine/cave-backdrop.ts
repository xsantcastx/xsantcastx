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
 * Cheap on purpose: no per-frame allocation, two pattern fills per biome band
 * in view, and below the surface the town painting and its shade (which the
 * opaque terrain used to hide entirely) are skipped instead.
 */
import { BiomeDef, CELL, seededRandom, Terrain } from './terrain';
import { ART, mixHex } from './tile-art';

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
    : [null, mixHex(shadow, '#000000', .25), mixHex(wall0, wash, .3), null];
}

interface Layer { canvas: HTMLCanvasElement | null; pattern: CanvasPattern | null; context: CanvasRenderingContext2D | null }

export class CaveBackdrop {
  private readonly layers = new Map<string, Layer>();
  private failed = false;

  /**
   * Fill the screen below the terrain's top edge with each biome's two layers.
   * `c` is in view world px (scaled, no camera translate). Returns true when
   * the terrain fills the whole view (nothing of the surface shows).
   */
  draw(c: CanvasRenderingContext2D, t: Terrain, camera: number, cameraY: number, viewport: number, height: number): boolean {
    const top = t.top - cameraY;
    if (top >= height) return false;
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    let from = 0;
    for (const biome of t.biomes) {
      const to = Math.min(t.rows, biome.to);
      const y0 = Math.max(0, top + from * CELL), y1 = Math.min(height, top + to * CELL);
      from = to;
      if (y1 <= y0) continue;
      this.fill(c, biome, 'far', camera, cameraY, viewport, y0, y1);
      this.fill(c, biome, 'near', camera, cameraY, viewport, y0, y1);
      if (from >= t.rows) break;
    }
    c.imageSmoothingEnabled = smoothing;
    return top <= 0;
  }

  private fill(c: CanvasRenderingContext2D, biome: BiomeDef, layer: 'far' | 'near', camera: number, cameraY: number, viewport: number, y0: number, y1: number): void {
    const spec = layer === 'far' ? FAR : NEAR;
    const pattern = this.pattern(c, biome, layer);
    if (!pattern) {
      if (layer === 'far') { c.fillStyle = biome.wall[2]; c.fillRect(0, y0, viewport, y1 - y0); }
      return;
    }
    const tw = spec.w * ART, th = spec.h * ART;
    // Snapped to whole art pixels so the layer never swims between texels.
    const ox = -Math.round(((camera * spec.speed) % tw) / ART) * ART, oy = -Math.round(((cameraY * spec.speed) % th) / ART) * ART;
    c.save();
    c.translate(ox, oy); c.scale(ART, ART);
    c.fillStyle = pattern;
    c.fillRect(-ox / ART, (y0 - oy) / ART, viewport / ART, (y1 - y0) / ART);
    c.restore();
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
