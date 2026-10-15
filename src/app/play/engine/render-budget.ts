/**
 * render-budget.ts — how much the world canvas may spend per frame.
 *
 * Two tiers. `full` is the desktop look and is never changed by this module.
 * `lite` is a phone: a touch-first device whose fill rate, not its JS, sets
 * the frame time (docs/handoff/play-perf.md). On a lite device:
 *
 *   - the canvas backing store is capped at 1.5 device px per CSS px instead
 *     of 2 (a DPR-3 phone at 390×596 CSS px: 0.52 MP instead of 0.93 MP; the
 *     rig buffers and terrain chunks follow pixelScale down with it);
 *   - canvas `shadowBlur` glows are dropped. A shadow is a Gaussian blur of
 *     everything drawn while it is set: on the Keeper that is the whole rig
 *     buffer, every frame;
 *   - a town's backdrop is baked once and blitted (see `cacheBackdrop`);
 *   - the Delve's full-screen colour passes use plain alpha blending instead
 *     of blend modes: the biome wash is a low-alpha source-over tint instead
 *     of `soft-light`, and the torch halos and Magma Halls heat columns are
 *     source-over instead of `lighter` (the halos blitted from a cached disc
 *     rather than shaded per pixel). Over the near-black of a delve the
 *     two read almost the same, and a blend mode has to read back every
 *     destination pixel it touches (measured in the handoff: the soft-light
 *     wash alone was ~10 ms a frame on a throttled software canvas). The
 *     tint is then laid inside the darkness overlay (identical pixels, one
 *     full-frame pass fewer), and the overlay is upscaled without smoothing.
 *
 * Pure: the engine reads the media queries and passes them in, tests do not.
 */
export interface RenderBudget {
  readonly tier: 'full' | 'lite';
  /** Most device pixels per CSS pixel the canvas is allocated at. */
  readonly maxPixelRatio: number;
  /** Whether canvas shadowBlur glows are drawn. */
  readonly glows: boolean;
  /** Whether the Delve's light passes use blend modes (soft-light, lighter) or plain alpha. */
  readonly blendModes: boolean;
  /**
   * Whether a town's backdrop (floor colour, painting, shade) is baked into one
   * offscreen canvas and blitted, instead of a scaled image draw and a gradient
   * fill over the whole screen every frame. Identical pixels; costs one
   * canvas of memory (about 1.4 MP on a phone, which is why desktop, at 5–6 MP,
   * keeps drawing it live).
   */
  readonly cacheBackdrop: boolean;
  /**
   * Whether the Delve's darkness overlay (half CSS resolution) is upscaled
   * with bilinear smoothing. A phone takes it nearest-neighbour: one overlay
   * texel is 2 CSS px, the darkness is a slow gradient (a step is ~2/255 of
   * alpha at the lantern's edge), and the full-frame filtered blit was the
   * largest single cost left in the Delve (docs/handoff/play-perf.md).
   */
  readonly smoothDarkness: boolean;
  /**
   * Whether the Delve's distant cave (cave-backdrop.ts) is pattern-filled only where it can show: the rows
   * of generated air in view, one cell of margin round them. Under solid rock the opaque tiles hide it, so
   * there it is a flat fill of the far layer's colour (two full-frame pattern fills were ~10 ms of a 4×
   * throttled phone frame). Same pixels wherever terrain is drawn over it (docs/handoff/delve-perf.md).
   */
  readonly maskBackdrop: boolean;
}

export const FULL_BUDGET: RenderBudget = { tier: 'full', maxPixelRatio: 2, glows: true, blendModes: true, cacheBackdrop: false, smoothDarkness: true, maskBackdrop: false };
export const LITE_BUDGET: RenderBudget = { tier: 'lite', maxPixelRatio: 1.5, glows: false, blendModes: false, cacheBackdrop: true, smoothDarkness: false, maskBackdrop: true };

/**
 * The budget for a device. `coarse`: the primary pointer is a finger and
 * there is no hover (`(hover: none) and (pointer: coarse)`), which is a phone
 * or a tablet, never a desktop with a touchscreen. `override` (EngineOptions.lite)
 * wins when given.
 */
export function renderBudget(device: { coarse: boolean }, override?: boolean): RenderBudget {
  const lite = override ?? device.coarse;
  return lite ? LITE_BUDGET : FULL_BUDGET;
}

/** Whether this browser is a touch-first device. False where matchMedia is missing (SSR, node tests). */
export function coarseDevice(win: { matchMedia?: (query: string) => { matches: boolean } } | undefined): boolean {
  try {
    return typeof win?.matchMedia === 'function' && win.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
}
