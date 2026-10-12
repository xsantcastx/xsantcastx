/**
 * lighting.ts — darkness and light for delve areas.
 *
 * One offscreen canvas at half resolution is filled with the ambient dark,
 * then every light punches a soft hole in it (`destination-out`, one cached
 * unit radial gradient scaled per light), and the result is laid over the
 * world. The pure helpers below are the model the renderer approximates; the
 * tests check them.
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

/** Default lantern radius in world px when the host has not set one. */
export const DEFAULT_LANTERN = 230;
/** Most lights drawn in one frame. */
export const LIGHT_CAP = 24;

/** Smooth falloff: 1 at the centre, 0 at and beyond the radius. */
export function lightFalloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) return 0;
  const k = 1 - (distance / radius) ** 2;
  return k * k;
}

/** How dark the delve is with no light, by how far below the surface the view sits. */
export function ambientDarkness(depthPx: number): number {
  const deep = Math.max(0, Math.min(1, depthPx / 320));
  return .5 + deep * .44;
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

/** The darkness overlay. Owns one offscreen canvas; draws nothing where a canvas cannot be made. */
export class DarknessLayer {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private hole: CanvasGradient | null = null;
  private failed = false;
  private readonly fills = new Map<number, string>();
  /** Fraction of CSS px the overlay is drawn at. Light is soft; half is plenty. */
  private readonly resolution = .5;

  private ensure(width: number, height: number): CanvasRenderingContext2D | null {
    if (this.failed) return null;
    if (!this.canvas) {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') { this.failed = true; return null; }
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');
      if (!this.context) { this.failed = true; return null; }
      const hole = this.context.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const stop of [0, .25, .5, .75, 1]) hole.addColorStop(stop, `rgba(0,0,0,${lightFalloff(stop, 1).toFixed(3)})`);
      this.hole = hole;
    }
    const w = Math.max(1, Math.ceil(width * this.resolution)), h = Math.max(1, Math.ceil(height * this.resolution));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    return this.context;
  }

  /**
   * Lay the darkness over the frame. `target` must be in canvas CSS px (the
   * world transform popped). `scale` is world → CSS px; camera in world px.
   */
  draw(target: CanvasRenderingContext2D, width: number, height: number, scale: number, cameraX: number, cameraY: number,
    lights: readonly Light[], count: number, ambient: number): void {
    const c = this.ensure(width, height);
    if (!c || !this.canvas || !this.hole) return;
    const k = this.resolution * scale;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.fillStyle = this.fill(ambient);
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = this.hole;
    for (let i = 0; i < count; i++) {
      const light = lights[i];
      const r = light.radius * k;
      if (r < 1) continue;
      c.globalAlpha = Math.min(1, light.intensity);
      c.setTransform(r, 0, 0, r, (light.x - cameraX) * k, (light.y - cameraY) * k);
      c.fillRect(-1, -1, 2, 2);
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    target.drawImage(this.canvas, 0, 0, width, height);
  }

  /** The ambient fill colour, cached per hundredth so no string is built per frame. */
  private fill(ambient: number): string {
    const key = Math.round(Math.max(0, Math.min(1, ambient)) * 100);
    let fill = this.fills.get(key);
    if (!fill) { fill = `rgba(5,3,9,${(key / 100).toFixed(2)})`; this.fills.set(key, fill); }
    return fill;
  }
}
