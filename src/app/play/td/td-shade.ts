/**
 * td-shade.ts — soft contact shadows under everything that stands (the art style upgrade, 2026-10-26: "a soft dark
 * elliptical drop shadow on the grass"). A stepped, dithered ellipse per width, cast a pixel down and right (the light is
 * upper left), cached; drawn in the ground pass so a shadow never paints over a neighbour's feet.
 */
import { shadowSprite } from './td-flora';

const cache = new Map<number, HTMLCanvasElement>();

/** The shadow under feet at (x, y), `w` art px wide (flattened to about a third of that); `alpha` fades a floater's. */
export function castShadow(c: CanvasRenderingContext2D, x: number, y: number, w: number, alpha = 1): void {
  const W = Math.max(6, Math.min(96, Math.round(w / 2) * 2));
  let img = cache.get(W);
  if (!img) { img = shadowSprite(W, Math.max(4, Math.round(W * .34))); cache.set(W, img); }
  const was = c.globalAlpha;
  c.globalAlpha = was * alpha;
  c.drawImage(img, Math.round(x - W / 2 + 1), Math.round(y - img.height / 2));
  c.globalAlpha = was;
}
