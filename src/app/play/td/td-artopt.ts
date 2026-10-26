/**
 * td-artopt.ts — the art-direction decision prototype (branch `artopt`, docs/handoff/artopt/). Three looks for the
 * same world, switchable only for the comparison photographs:
 *
 * - `live` the look players have now (the default, and the only one a player can ever get);
 * - `a`    zoomed out, finer pixels: the current art at a smaller crisp camera (≈30% more world), the aura without its
 *          ground ring (the paused look branch, ~/er/wt-look's camera and aura);
 * - `b`    HD pixel art: the Keeper, the Bone Walker, the pet and the oak repainted at twice the art resolution
 *          (td-hd-art.ts), each art pixel drawn half a world pixel; the grass and road baked at twice the resolution;
 *          the aura's motes and rim at the HD pixel;
 * - `c`    hybrid: B's HD figures and effects over A's world (A's ground and trees);
 * - `iso`  B drawn isometrically (td-iso.ts): 2:1 diamonds, depth-sorted, walls with two faces cut away in front of the
 *          Keeper, warm light pools indoors. Only the drawing and the input mapping change: the world, collision, maps and
 *          the room server stay square.
 *
 * `?artopt=a|b|c|iso|live` is read only in an automated browser (navigator.webdriver) or on localhost, so a, b and c
 * can never reach a player on the live site; `iso` reaches players only through their own Graphics setting.
 */
export type ArtOpt = 'live' | 'a' | 'b' | 'c' | 'iso';
/** (`iso` is also the player's Isometric graphics: Menu → Settings, `graphics()` below.) */

let cached: ArtOpt | null = null;
let fromParam = false;
/** The look came from the dev `?artopt=` parameter (webdriver or localhost), not the player's setting. */
export function artOptParam(): boolean { artOpt(); return fromParam; }

export function artOpt(): ArtOpt {
  if (cached) return cached;
  let v: ArtOpt = graphics() === 'iso' ? 'iso' : 'live';
  try {
    if (typeof window !== 'undefined' && typeof location !== 'undefined') {
      const dev = (typeof navigator !== 'undefined' && navigator.webdriver === true) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      const q = dev ? new URLSearchParams(location.search).get('artopt') : null;
      if (q === 'a' || q === 'b' || q === 'c' || q === 'iso' || q === 'live') { v = q; fromParam = true; }
    }
  } catch { /* no location: the player's setting */ }
  return (cached = v);
}

// ── Graphics (Menu → Settings; owner 2026-10-27: iso goes live as a Beta toggle) ──
/**
 * The player's graphics: `iso` the isometric Beta (td-iso*.ts, the default since 2026-10-27), `classic` the top-down world. A device's
 * own choice like Environment detail (td-detail.ts): plain localStorage behind try/catch, never the save gateway. The
 * dev `?artopt=` parameter (webdriver or localhost only) still overrides it, for the specs and the comparison shots.
 */
export type Graphics = 'classic' | 'iso';
/** In the order the setting lists them: Isometric (Beta) first, the default. */
export const GRAPHICS: readonly Graphics[] = ['iso', 'classic'];
export const GRAPHICS_KEY = 'eclipse-td-graphics';
let graphicsNow: Graphics | null = null;
const graphicsListeners = new Set<(g: Graphics) => void>();
const slowListeners = new Set<() => void>();
/** The graphics this device chose; Isometric (Beta) until it chooses (owner 2026-10-27: the new default for everyone). */
export function graphics(): Graphics {
  if (graphicsNow) return graphicsNow;
  let v: Graphics = defaultGraphics(unitSpecs());
  try { const st = typeof localStorage === 'undefined' ? null : localStorage.getItem(GRAPHICS_KEY); if (st === 'classic' || st === 'iso') v = st; } catch { /* private mode: the default */ }
  return (graphicsNow = v);
}
/** No stored choice: Isometric for every player; the unit specs (Karma/Jasmine), written for the top-down engine, Classic. */
export function defaultGraphics(unit: boolean): Graphics { return unit ? 'classic' : 'iso'; }
/** Running under Karma/Jasmine (a Playwright browser is not: it gets the players' default unless a spec pins it). */
function unitSpecs(): boolean {
  const g = globalThis as unknown as { jasmine?: unknown; __karma__?: unknown; parent?: { __karma__?: unknown } };
  let karma = !!g.__karma__;
  try { karma ||= !!g.parent?.__karma__; } catch { /* cross-origin parent */ }
  return typeof g.jasmine !== 'undefined' || karma;
}
/** Choose the graphics (saved on this device, applied at once: the engine draws the next frame the new way). */
export function setGraphics(g: Graphics): void {
  if (!GRAPHICS.includes(g)) return;
  const was = graphics();
  try { localStorage.setItem(GRAPHICS_KEY, g); } catch { /* private mode: this session only */ }
  if (was === g) return;
  graphicsNow = g; cached = null;
  for (const f of graphicsListeners) f(g);
}
/** Forget the cached choice (unit specs only: the next read comes from storage). */
export function resetGraphicsForTest(): void { graphicsNow = null; cached = null; }
export function onGraphics(f: (g: Graphics) => void): () => void { graphicsListeners.add(f); return () => graphicsListeners.delete(f); }
/** The engine measured Isometric running slowly here (never under a test harness): the HUD offers Classic, one tap. */
export function offerClassic(): void { for (const f of slowListeners) f(); }
export function onIsoSlow(f: () => void): () => void { slowListeners.add(f); return () => slowListeners.delete(f); }

/** The zoomed-out camera and the ringless aura (A, B and C). */
export const optCamera = (): boolean => artOpt() !== 'live';
/** HD figures and effects (B, C and iso). */
export const optHdFigures = (): boolean => artOpt() === 'b' || artOpt() === 'c' || artOpt() === 'iso';
/** HD world: the oak and the ground (B, and iso, which is B seen at D2's angle). */
export const optHdWorld = (): boolean => artOpt() === 'b' || artOpt() === 'iso';
/** The isometric projection (td-iso.ts): the same square world drawn as 2:1 diamonds, D2's angle. */
export const optIso = (): boolean => artOpt() === 'iso';
