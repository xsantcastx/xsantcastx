/**
 * tile-manifest.generated.ts — DO NOT EDIT BY HAND.
 *
 * Written by `scripts/import-assets.py` from `Assets/Sprites/Tiles/` (spec W7,
 * docs/art-commissions/world-sprites/05-delve-tiles.md). Opaque delve tiles,
 * one strip of interchangeable variants per terrain node, keyed
 * `tile-<node id>` (ids from src/app/play/engine/terrain.ts).
 *
 * Every number here is in logical (1x) pixels. `src` is the 1x strip and
 * `src2x` the authored one. Variant N is the cell at x = N * size.
 *
 * Pure data, no browser APIs, safe to import from an SSR path.
 */

export interface TileEntry {
  src: string;
  src2x: string;
  /** Cell edge, 1x px (the delve grid: 32). */
  size: number;
  /** Interchangeable variants, left to right; pick one per cell by hash. */
  variants: number;
}

export const TILES: Readonly<Record<string, TileEntry>> = {
};

/**
 * The painted tile for a terrain node id (`rock` -> `tile-rock`), or null until
 * its strip has been imported. The renderer keeps its code-drawn tile on null.
 */
export function tileFor(nodeId: string | undefined | null): TileEntry | null {
  if (!nodeId) return null;
  const key = `tile-${nodeId}`;
  return Object.prototype.hasOwnProperty.call(TILES, key) ? TILES[key] : null;
}
