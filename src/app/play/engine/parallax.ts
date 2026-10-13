/**
 * parallax.ts — imported W8 parallax layers (style guide §8, RND-2).
 *
 * Towns and hunting grounds: when a realm's layers have been imported
 * (`parallaxFor(realm, layer)`, written by scripts/import-assets.py from
 * `Assets/Sprites/Parallax/`), the four are drawn back to front (sky, far,
 * mid, near) at their scroll factors, repeating left to right, their bottom
 * edge on the town ground line, unsmoothed and snapped to whole art pixels.
 * Until every imported layer has loaded (or when none is imported) `draw`
 * returns false and the caller keeps the painted backdrop: landing one layer
 * at a time never leaves a half-drawn sky.
 *
 * Render-only, no per-frame allocation.
 */
import { parallaxFor, PARALLAX_LAYERS, type ParallaxEntry, type ParallaxLayer } from '../../shared/art/parallax-manifest.generated';

/** Scroll factor per layer, the middle of each range in style guide §8. */
export const PARALLAX_SPEED: Readonly<Record<ParallaxLayer, number>> = { sky: .03, far: .2, mid: .45, near: .7 };
/** Logical px per art px for an imported town layer (480 art px → 1920 px). */
const TOWN_ART = 4;

/** How far a layer has scrolled for a camera, snapped to whole art pixels, in [−width, 0]. Pure. */
export function parallaxOffset(camera: number, speed: number, width: number, art = TOWN_ART): number {
  if (width <= 0) return 0;
  const shift = ((camera * speed) % width + width) % width;
  return -Math.round(shift / art) * art || 0;
}

type ImageFor = (url: string) => HTMLImageElement | undefined;

export class ParallaxBackdrop {
  private readonly entries = new Map<string, (ParallaxEntry | null)[]>();
  constructor(private readonly image: ImageFor, private readonly lookup: typeof parallaxFor = parallaxFor) {}

  /** Whether any layer is imported for a place (it may still be loading). */
  has(place: string): boolean { return this.layers(place).some(Boolean); }

  /**
   * Draw a place's imported layers in view world px (scaled, no camera
   * translate). Returns false (drawing nothing) unless at least one layer is
   * imported and every imported layer has loaded.
   */
  draw(c: CanvasRenderingContext2D, place: string, camera: number, viewport: number, groundY: number, sharp: boolean): boolean {
    const layers = this.layers(place);
    let any = false;
    for (const entry of layers) {
      if (!entry) continue;
      any = true;
      const image = this.ready(entry, sharp);
      if (!image) return false;
    }
    if (!any) return false;
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    for (let i = 0; i < layers.length; i++) {
      const entry = layers[i];
      if (!entry) continue;
      const image = this.ready(entry, sharp)!;
      const w = entry.width, h = entry.height, top = groundY - h;
      for (let x = parallaxOffset(camera, PARALLAX_SPEED[PARALLAX_LAYERS[i]], w); x < viewport; x += w) c.drawImage(image, x, top, w, h);
    }
    c.imageSmoothingEnabled = smoothing;
    return true;
  }

  private layers(place: string): (ParallaxEntry | null)[] {
    let layers = this.entries.get(place);
    if (!layers) { layers = PARALLAX_LAYERS.map(layer => this.lookup(place, layer)); this.entries.set(place, layers); }
    return layers;
  }
  /** The sharper copy on dense screens, either one standing in while the other loads. */
  private ready(entry: ParallaxEntry, sharp: boolean): HTMLImageElement | null {
    const loaded = (url: string) => { const image = this.image(url); return image?.complete && image.naturalWidth ? image : null; };
    return loaded(sharp ? entry.src2x : entry.src) ?? loaded(sharp ? entry.src : entry.src2x);
  }
}
