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
 * The player's graphics: `classic` the top-down world (the default), `iso` the isometric Beta (td-iso*.ts). A device's
 * own choice like Environment detail (td-detail.ts): plain localStorage behind try/catch, never the save gateway. The
 * dev `?artopt=` parameter (webdriver or localhost only) still overrides it, for the specs and the comparison shots.
 */
export type Graphics = 'classic' | 'iso';
export const GRAPHICS: readonly Graphics[] = ['classic', 'iso'];
export const GRAPHICS_KEY = 'eclipse-td-graphics';
let graphicsNow: Graphics | null = null;
const graphicsListeners = new Set<(g: Graphics) => void>();
const slowListeners = new Set<() => void>();
/** The graphics this device chose (Classic until it chooses). */
export function graphics(): Graphics {
  if (graphicsNow) return graphicsNow;
  let v: Graphics = 'classic';
  try { if (typeof localStorage !== 'undefined' && localStorage.getItem(GRAPHICS_KEY) === 'iso') v = 'iso'; } catch { /* private mode: Classic */ }
  return (graphicsNow = v);
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
