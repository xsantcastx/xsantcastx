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
 * `?artopt=a|b|c` is read only in an automated browser (navigator.webdriver) or on localhost, so it can never leak to a
 * player on the live site.
 */
export type ArtOpt = 'live' | 'a' | 'b' | 'c' | 'iso';

let cached: ArtOpt | null = null;

export function artOpt(): ArtOpt {
  if (cached) return cached;
  let v: ArtOpt = 'live';
  try {
    if (typeof window !== 'undefined' && typeof location !== 'undefined') {
      const dev = (typeof navigator !== 'undefined' && navigator.webdriver === true) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      const q = dev ? new URLSearchParams(location.search).get('artopt') : null;
      if (q === 'a' || q === 'b' || q === 'c' || q === 'iso') v = q;
    }
  } catch { /* no location: live */ }
  return (cached = v);
}

/** The zoomed-out camera and the ringless aura (A, B and C). */
export const optCamera = (): boolean => artOpt() !== 'live';
/** HD figures and effects (B, C and iso). */
export const optHdFigures = (): boolean => artOpt() === 'b' || artOpt() === 'c' || artOpt() === 'iso';
/** HD world: the oak and the ground (B, and iso, which is B seen at D2's angle). */
export const optHdWorld = (): boolean => artOpt() === 'b' || artOpt() === 'iso';
/** The isometric projection (td-iso.ts): the same square world drawn as 2:1 diamonds, D2's angle. */
export const optIso = (): boolean => artOpt() === 'iso';
