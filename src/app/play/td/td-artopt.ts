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
 * - `c`    hybrid: B's HD figures and effects over A's world (A's ground and trees).
 *
 * `?artopt=a|b|c` is read only in an automated browser (navigator.webdriver) or on localhost, so it can never leak to a
 * player on the live site.
 */
export type ArtOpt = 'live' | 'a' | 'b' | 'c';

let cached: ArtOpt | null = null;

export function artOpt(): ArtOpt {
  if (cached) return cached;
  let v: ArtOpt = 'live';
  try {
    if (typeof window !== 'undefined' && typeof location !== 'undefined') {
      const dev = (typeof navigator !== 'undefined' && navigator.webdriver === true) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      const q = dev ? new URLSearchParams(location.search).get('artopt') : null;
      if (q === 'a' || q === 'b' || q === 'c') v = q;
    }
  } catch { /* no location: live */ }
  return (cached = v);
}

/** The zoomed-out camera and the ringless aura (A, B and C). */
export const optCamera = (): boolean => artOpt() !== 'live';
/** HD figures and effects (B and C). */
export const optHdFigures = (): boolean => artOpt() === 'b' || artOpt() === 'c';
/** HD world: the oak and the ground (B only). */
export const optHdWorld = (): boolean => artOpt() === 'b';
