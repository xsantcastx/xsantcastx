/**
 * parallax-manifest.generated.ts — DO NOT EDIT BY HAND.
 *
 * Written by `scripts/import-assets.py` from `Assets/Sprites/Parallax/` (spec W8,
 * docs/art-commissions/world-sprites/09-parallax.md). One entry per layer, keyed
 * `parallax-<realm>-<layer>` (layer: sky, far, mid, near; back to front).
 *
 * Every number here is in logical (1x) pixels. `src` is the 1x sheet and
 * `src2x` the authored one. A layer repeats left to right; its bottom edge is
 * the town ground line.
 *
 * Pure data, no browser APIs, safe to import from an SSR path.
 */

export type ParallaxLayer = 'sky' | 'far' | 'mid' | 'near';

export interface ParallaxEntry {
  src: string;
  src2x: string;
  width: number;
  height: number;
  /** Always true for this pack: smoothing off, whole-pixel draws. */
  pixelArt?: boolean;
}

export const PARALLAX: Readonly<Record<string, ParallaxEntry>> = {
};

/** Layers drawn back to front. */
export const PARALLAX_LAYERS: readonly ParallaxLayer[] = ['sky', 'far', 'mid', 'near'];

/**
 * An imported parallax layer for a realm or place (`infernal`, `delve-magma-halls`), or
 * null until it lands. The world keeps its painted or procedural backdrop on null.
 */
export function parallaxFor(place: string | undefined | null, layer: ParallaxLayer): ParallaxEntry | null {
  if (!place) return null;
  const key = `parallax-${place}-${layer}`;
  return Object.prototype.hasOwnProperty.call(PARALLAX, key) ? PARALLAX[key] : null;
}
