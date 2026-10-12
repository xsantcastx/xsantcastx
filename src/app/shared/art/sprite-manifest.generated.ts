/**
 * sprite-manifest.generated.ts — DO NOT EDIT BY HAND.
 *
 * Written by `scripts/import-assets.py` from `Assets/Sprites/**` and each
 * sheet's sidecar JSON (schema: docs/art-commissions/README.md). World-layer
 * sprites only; menu paintings are in art-manifest.generated.ts.
 *
 * Every number here is in logical (1x) pixels. `src` is the 1x sheet and
 * `src2x` the authored one (the same file when a sheet was authored at 1x).
 * A sheet is a uniform grid: action N is row `row`, frames run left to right.
 *
 * Pure data, no browser APIs, safe to import from an SSR path.
 */

export interface SpriteAction {
  row: number;
  frames: number;
  /** Frames per second; 0 for a still. */
  fps: number;
  loop: boolean;
  /**
   * Per-frame attachment points (e.g. `hand_front`), cell-relative, 1x px. An
   * optional third number is the held item's angle in degrees, clockwise from
   * pointing straight up.
   */
  anchors?: Readonly<Record<string, readonly (readonly [number, number] | readonly [number, number, number])[]>>;
}

export interface SpriteEntry {
  src: string;
  src2x: string;
  frameW: number;
  frameH: number;
  /** Ground contact / rotation origin inside a cell, 1x px. */
  pivotX: number;
  pivotY: number;
  actions: Readonly<Record<string, SpriteAction>>;
}

export const SPRITES: Readonly<Record<string, SpriteEntry>> = {
};

/** A world sprite by id, or null until its sheet has been imported. */
export function spriteFor(id: string | undefined | null): SpriteEntry | null {
  return (id && SPRITES[id]) || null;
}
