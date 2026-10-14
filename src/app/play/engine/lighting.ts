/**
 * lighting.ts — darkness and light for delve areas.
 *
 * Terraria-style: the dark is a grid of light values, one sample every
 * LIGHT_STEP world px (half a cell), interpolated smoothly over the screen.
 * Each sample starts at the ambient dark and every light lifts it
 * multiplicatively (`lightGrid`, the same model as `darknessAt`). Light
 * reaches less far into solid rock: a sample inside rock that touches no air
 * takes only part of each light (`LightShade`, built in tile-art.ts), so caves
 * read as hollows in the stone. The grid goes into a tiny canvas (one pixel
 * per sample) and is upscaled with bilinear filtering: on desktop straight
 * onto the frame; on a phone into the half-resolution overlay, which is then
 * laid nearest-neighbour as before (render-budget.ts `smoothDarkness`).
 * Nothing builds a gradient per frame, and nothing allocates once the grid
 * buffers exist.
 */

export interface Light {
  x: number; y: number;
  /** World px. */
  radius: number;
  /** 0..1: how much darkness it lifts at its centre. */
  intensity: number;
  /** Squared distance to the Keeper, filled by selectLights. */
  rank: number;
}

/** The darkness colour (`r,g,b`) when a biome names none: basalt's violet-black. */
export const DEFAULT_DARK = '5,3,9';
/** Default lantern radius in world px when the host has not set one: 7 tiles of 32 px, the Skills lantern at Delving 1 (skills/tools.ts lanternRadiusFor). */
export const DEFAULT_LANTERN = 7 * 32;
/** Most lights drawn in one frame. */
export const LIGHT_CAP = 24;

/**
 * Smooth falloff: 1 at the centre, 0 at and beyond the radius. Terraria-like:
 * a broad bright pool that rolls off near the edge (1 − d²/r², not its square),
 * so the area a light reaches reads clearly instead of fading from the middle.
 */
export function lightFalloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) return 0;
  return 1 - (distance / radius) ** 2;
}

/**
 * How dark the delve is with no light, by how far below the surface the view
 * sits. The floor stays short of black (0.8 deep down): unlit rock still shows
 * its shape faintly, as in Terraria's caverns, while only lit ground reads in
 * full colour, so the lantern and torches keep their meaning.
 */
export function ambientDarkness(depthPx: number): number {
  const deep = Math.max(0, Math.min(1, depthPx / 320));
  return .42 + deep * .38;
}

/** Darkness left at a point: ambient, lifted multiplicatively by each light. Pure. */
export function darknessAt(x: number, y: number, lights: readonly Light[], count: number, ambient: number): number {
  let dark = ambient;
  for (let i = 0; i < count; i++) {
    const light = lights[i];
    dark *= 1 - Math.min(1, light.intensity) * lightFalloff(Math.hypot(x - light.x, y - light.y), light.radius);
  }
  return dark;
}

/**
 * Keep the `cap` lights nearest (x, y) in the first slots of `lights`, in
 * place (a partial selection sort: the list is short). Returns how many are kept.
 */
export function selectLights(lights: Light[], count: number, cap: number, x: number, y: number): number {
  for (let i = 0; i < count; i++) {
    const light = lights[i];
    light.rank = (light.x - x) ** 2 + (light.y - y) ** 2;
  }
  const keep = Math.min(cap, count);
  for (let i = 0; i < keep; i++) {
    let best = i;
    for (let j = i + 1; j < count; j++) if (lights[j].rank < lights[best].rank) best = j;
    if (best !== i) { const swap = lights[i]; lights[i] = lights[best]; lights[best] = swap; }
  }
  return keep;
}

/** A fixed pool of lights, refilled every frame without allocating. */
export class LightPool {
  readonly lights: Light[];
  count = 0;
  constructor(size: number) {
    this.lights = Array.from({ length: size }, () => ({ x: 0, y: 0, radius: 0, intensity: 0, rank: 0 }));
  }
  clear(): void { this.count = 0; }
  add(x: number, y: number, radius: number, intensity: number): void {
    if (this.count >= this.lights.length) return;
    const light = this.lights[this.count++];
    light.x = x; light.y = y; light.radius = radius; light.intensity = intensity;
  }
}

/** World px between light samples: two per cell edge. */
export const LIGHT_STEP = 16;

/** How much of each light reaches a cell (1 = all), per terrain cell, row-major from `top`. */
export interface LightShade { readonly values: Float32Array; readonly cols: number; readonly rows: number; readonly top: number }

/**
 * Darkness at each sample of a grid, row-major: sample (i, j) sits at
 * (x0 + (i + .5)·step, y0 + (j + .5)·step). The ambient dark lifted by every
 * light as in `darknessAt`, each light's lift scaled by `shade` (of the cell
 * holding the sample, 32 px cells) when given. Only samples inside a light's
 * radius are visited. Pure apart from `out`.
 */
export function lightGrid(out: Float32Array, gw: number, gh: number, x0: number, y0: number, step: number,
  lights: readonly Light[], count: number, ambient: number, shade?: LightShade | null, cell = 32,
  extra?: readonly Light[], extraCount = 0): void {
  const total = gw * gh;
  out.fill(1, 0, total);
  // `extra`: emissive cells (a lava surface) lifting the grid like lights, outside the capped slots.
  for (let n = 0; n < count + extraCount; n++) {
    const light = n < count ? lights[n] : extra![n - count];
    const intensity = Math.min(1, light.intensity), r = light.radius;
    if (intensity <= 0 || r <= 0) continue;
    const r2 = r * r;
    const i0 = Math.max(0, Math.ceil((light.x - r - x0) / step - .5)), i1 = Math.min(gw - 1, Math.floor((light.x + r - x0) / step - .5));
    const j0 = Math.max(0, Math.ceil((light.y - r - y0) / step - .5)), j1 = Math.min(gh - 1, Math.floor((light.y + r - y0) / step - .5));
    for (let j = j0; j <= j1; j++) {
      const sy = y0 + (j + .5) * step, dy2 = (sy - light.y) ** 2;
      if (dy2 >= r2) continue;
      const row = shade ? Math.floor((sy - shade.top) / cell) : -1;
      const shadeRow = shade && row >= 0 && row < shade.rows ? row * shade.cols : -1;
      for (let i = i0; i <= i1; i++) {
        const sx = x0 + (i + .5) * step, d2 = (sx - light.x) ** 2 + dy2;
        if (d2 >= r2) continue;
        let lift = intensity * (1 - d2 / r2);
        if (shadeRow >= 0) {
          const col = Math.floor(sx / cell);
          if (col >= 0 && col < shade!.cols) lift *= shade!.values[shadeRow + col];
        }
        out[j * gw + i] *= 1 - lift;
      }
    }
  }
  for (let k = 0; k < total; k++) out[k] *= ambient;
}

interface Grid { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; image: ImageData; dark: Float32Array; w: number; h: number }

/** The darkness overlay. Owns a tiny grid canvas (and, for phones, a half-res overlay); draws nothing where a canvas cannot be made. */
export class DarknessLayer {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private grid: Grid | null = null;
  private failed = false;
  /** Parsed colours (`r,g,b` tints and #rrggbb washes), cached so a frame parses nothing. */
  private readonly colors = new Map<string, readonly [number, number, number]>();
  /** Fraction of CSS px the phone's overlay is drawn at. Light is soft; half is plenty. */
  private readonly resolution = .5;

  private make(): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    return context ? { canvas, context } : null;
  }
  private ensureGrid(w: number, h: number): Grid | null {
    if (this.failed) return null;
    if (this.grid && this.grid.w === w && this.grid.h === h) return this.grid;
    const made = this.grid ?? this.make();
    if (!made) { this.failed = true; return null; }
    made.canvas.width = w; made.canvas.height = h;
    const image = typeof made.context.createImageData === 'function' ? made.context.createImageData(w, h) : null;
    if (!image?.data || image.data.length < w * h * 4) { this.failed = true; return null; }
    this.grid = { canvas: made.canvas, context: made.context, image, dark: new Float32Array(w * h), w, h };
    return this.grid;
  }
  private ensureOverlay(width: number, height: number): CanvasRenderingContext2D | null {
    if (!this.canvas) {
      const made = this.make();
      if (!made) return null;
      this.canvas = made.canvas; this.context = made.context;
    }
    const w = Math.max(1, Math.ceil(width * this.resolution)), h = Math.max(1, Math.ceil(height * this.resolution));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    return this.context;
  }
  private rgb(color: string): readonly [number, number, number] {
    let c = this.colors.get(color);
    if (!c) {
      if (color.startsWith('#')) { const v = parseInt(color.slice(1, 7), 16); c = [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
      else { const [r, g, b] = color.split(',').map(Number); c = [r || 0, g || 0, b || 0]; }
      this.colors.set(color, c);
    }
    return c;
  }

  /**
   * Lay the darkness over the frame. `target` must be in canvas CSS px (the
   * world transform popped). `scale` is world → CSS px; camera in world px.
   *
   * `under`: a uniform tint the caller would otherwise fill over the whole
   * frame just before this (the phone's biome wash, source-over). It is folded
   * into each grid sample beneath its darkness: premultiplied, tint-then-dark
   * over the world is
   *   colour = dark·d + tint·a·(1 − d),  alpha = 1 − (1 − a)(1 − d),
   * so one full-frame blend does both. Returns false when nothing was drawn
   * (no canvas), so the caller can tint.
   * `smooth` false: the phone tier (render-budget.ts) — the grid is filtered
   * into the half-res overlay and that is upscaled nearest-neighbour.
   * `shade`: how far light reaches into rock, per cell (optional).
   * `warm`: the colour lit ground takes on (lantern and torch light is warm):
   * a sample lifted from the ambient dark is tinted by `alpha` × how far it was
   * lifted, folded into the same blend (tint, then warmth, then dark):
   *   colour = U·u·(1−w)(1−d) + W·w·(1−d) + T·d,  alpha = 1 − (1−u)(1−w)(1−d).
   */
  draw(target: CanvasRenderingContext2D, width: number, height: number, scale: number, cameraX: number, cameraY: number,
    lights: readonly Light[], count: number, ambient: number, tint = DEFAULT_DARK, under?: { color: string; alpha: number }, smooth = true,
    shade?: LightShade | null, warm?: { color: string; alpha: number }, extra?: readonly Light[], extraCount = 0): boolean {
    const step = LIGHT_STEP;
    // One sample of margin all round, so the filtered edge never shows.
    const gx0 = Math.floor(cameraX / step) - 1, gy0 = Math.floor(cameraY / step) - 1;
    const gw = Math.ceil(width / scale / step) + 3, gh = Math.ceil(height / scale / step) + 3;
    const grid = this.ensureGrid(gw, gh);
    if (!grid) return false;
    lightGrid(grid.dark, gw, gh, gx0 * step, gy0 * step, step, lights, count, ambient, shade, 32, extra, extraCount);
    const [tr, tg, tb] = this.rgb(tint);
    const ua = under && under.alpha > 0 ? Math.min(1, under.alpha) : 0;
    const [ur, ug, ub] = ua > 0 ? this.rgb(under!.color) : [0, 0, 0];
    const wa = warm && warm.alpha > 0 && ambient > 0 ? Math.min(1, warm.alpha) : 0;
    const [wr, wg, wb] = wa > 0 ? this.rgb(warm!.color) : [0, 0, 0];
    const data = grid.image.data, dark = grid.dark;
    for (let k = 0, p = 0; k < gw * gh; k++, p += 4) {
      const d = dark[k];
      if (wa > 0) {
        const lw = wa * Math.max(0, 1 - d / ambient), open = 1 - d;
        const a = 1 - (1 - ua) * (1 - lw) * open, inv = a > 0 ? 1 / a : 0;
        const tu = ua * (1 - lw) * open, tw = lw * open;
        data[p] = (ur * tu + wr * tw + tr * d) * inv; data[p + 1] = (ug * tu + wg * tw + tg * d) * inv; data[p + 2] = (ub * tu + wb * tw + tb * d) * inv;
        data[p + 3] = a * 255 + .5;
      } else if (ua > 0) {
        const a = 1 - (1 - ua) * (1 - d), w = a > 0 ? 1 / a : 0, t = ua * (1 - d);
        data[p] = (tr * d + ur * t) * w; data[p + 1] = (tg * d + ug * t) * w; data[p + 2] = (tb * d + ub * t) * w; data[p + 3] = a * 255 + .5;
      } else {
        data[p] = tr; data[p + 1] = tg; data[p + 2] = tb; data[p + 3] = d * 255 + .5;
      }
    }
    grid.context.putImageData(grid.image, 0, 0);
    const left = (gx0 * step - cameraX) * scale, top = (gy0 * step - cameraY) * scale, span = step * scale;
    const was = target.imageSmoothingEnabled;
    if (smooth) {
      target.imageSmoothingEnabled = true;
      target.drawImage(grid.canvas, 0, 0, gw, gh, left, top, gw * span, gh * span);
    } else {
      const c = this.ensureOverlay(width, height);
      if (!c || !this.canvas) return false;
      const k = this.resolution;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      c.imageSmoothingEnabled = true;
      c.drawImage(grid.canvas, 0, 0, gw, gh, left * k, top * k, gw * span * k, gh * span * k);
      target.imageSmoothingEnabled = false;
      target.drawImage(this.canvas, 0, 0, width, height);
    }
    target.imageSmoothingEnabled = was;
    return true;
  }
}
