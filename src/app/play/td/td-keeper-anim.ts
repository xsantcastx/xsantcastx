/**
 * td-keeper-anim.ts — the Keeper's eleven fight animations (docs/design/skills-100.md §0.6), as pose offsets on the
 * visible-gear rig.
 *
 * The figure itself is the painter's cached frame (keeper-paint, one sheet per painter; the 'attack' pose it already
 * owns does the weapon). What an animation adds is pure and whole-pixel: per frame, a body offset (a lean forward, a
 * rise, a crouch, one knee down) and an overlay the engine draws over the figure — the flash at a staff's head, a ring
 * struck into the ground, the brass of a raised shield, a looping channel glow, a note for a whistle. 4–6 frames at
 * 80–100 ms each, so a cast reads as wind-up, release and settle.
 *
 * Reduced motion: no offset (the figure stands), and the overlay is drawn at its key frame, still and full size — the
 * tell stays, nothing moves. Low detail: the overlay is its single brightest pixel group (no ring, no glow).
 */
import type { KeeperAnim } from './td-skill-kit';

/** One frame: the body's offset in art px (dx toward the facing side) and the overlay shown, if any. */
export interface AnimFrame { dx: number; dy: number; o: AnimOverlay | null }
export type AnimOverlay = 'flash' | 'push' | 'slam' | 'glow' | 'arc' | 'smash' | 'shield' | 'whip' | 'bow' | 'note' | 'kneel';

export interface AnimSpec {
  /** Milliseconds a frame. */
  ms: number;
  frames: readonly AnimFrame[];
  /** Frames held at the end (shield-up's hold, kneel's hold), the last frame repeated. */
  hold: number;
  /** The key frame reduced motion shows still. */
  key: number;
  /** It loops while held (channel). */
  loop?: boolean;
}

const F = (dx: number, dy: number, o: AnimOverlay | null = null): AnimFrame => ({ dx, dy, o });

export const ANIMS: Readonly<Record<KeeperAnim, AnimSpec>> = {
  'cast-raise': { ms: 90, hold: 0, key: 2, frames: [F(0, 0), F(0, -1), F(0, -2, 'flash'), F(0, -2, 'flash'), F(0, -1)] },
  'cast-push': { ms: 90, hold: 0, key: 2, frames: [F(-1, 0), F(1, 0), F(2, 0, 'push'), F(1, 0)] },
  'cast-slam': { ms: 90, hold: 0, key: 2, frames: [F(0, -1), F(0, -2), F(0, 1, 'slam'), F(0, 1, 'slam'), F(0, 0, 'slam')] },
  'channel': { ms: 100, hold: 0, key: 1, loop: true, frames: [F(0, -1, 'glow'), F(0, -2, 'glow')] },
  'swing': { ms: 80, hold: 0, key: 2, frames: [F(-1, 0), F(0, -1), F(2, 0, 'arc'), F(2, 0, 'arc'), F(0, 0)] },
  'heavy': { ms: 100, hold: 0, key: 3, frames: [F(0, 0), F(-1, -2), F(-1, -3), F(2, 1, 'smash'), F(2, 1, 'smash'), F(0, 0)] },
  'shield-up': { ms: 90, hold: 3, key: 2, frames: [F(0, 0), F(-1, 0, 'shield'), F(-1, 1, 'shield')] },
  'throw': { ms: 80, hold: 0, key: 2, frames: [F(-2, 0), F(-1, -1), F(2, 0, 'whip'), F(1, 0)] },
  'draw': { ms: 90, hold: 0, key: 2, frames: [F(0, 0), F(-1, 0, 'bow'), F(-1, 0, 'bow'), F(-1, 0, 'bow'), F(1, 0)] },
  'whistle': { ms: 90, hold: 0, key: 1, frames: [F(0, 0), F(0, -1, 'note'), F(0, 0, 'note'), F(0, -1, 'note')] },
  'kneel': { ms: 100, hold: 4, key: 3, frames: [F(0, 0), F(0, 1), F(0, 3, 'kneel'), F(0, 3, 'kneel')] },
};

/** How long an animation plays (seconds), its hold included; a channel plays one loop unless held. */
export function animSecs(a: KeeperAnim): number { const s = ANIMS[a]; return (s.frames.length + s.hold) * s.ms / 1000; }

/** The frame `t` seconds in (null: it is over). Reduced motion: the key frame, standing still. */
export function animFrame(a: KeeperAnim, t: number, still = false): AnimFrame | null {
  const s = ANIMS[a];
  if (t < 0) return null;
  let i = Math.floor(t * 1000 / s.ms);
  if (s.loop) i %= s.frames.length;
  else if (i >= s.frames.length + s.hold) return null;
  const f = s.frames[Math.min(i, s.frames.length - 1)];
  if (still) { const k = s.frames[s.key]; return { dx: 0, dy: 0, o: k.o }; }
  return f;
}

/** Pixel rects (x, y, w, h, tone 0 core · 1 body · 2 edge) of an overlay round the Keeper's feet, facing +x. Low: the core alone. */
export function overlayRects(o: AnimOverlay, low: boolean): readonly (readonly [number, number, number, number, 0 | 1 | 2])[] {
  const R = OVERLAYS[o];
  return low ? R.filter(r => r[4] === 0) : R;
}
const OVERLAYS: Readonly<Record<AnimOverlay, readonly (readonly [number, number, number, number, 0 | 1 | 2])[]>> = {
  // The staff's head over the shoulder: a stepped star.
  flash: [[5, -44, 3, 3, 0], [4, -45, 5, 1, 1], [6, -47, 1, 7, 1], [3, -43, 1, 1, 2], [9, -43, 1, 1, 2]],
  // Both hands forward: a bright knot at arm's length.
  push: [[10, -24, 3, 3, 0], [9, -25, 5, 1, 1], [11, -27, 1, 7, 1], [14, -24, 2, 1, 2]],
  // The staff struck into the ground: a flat stepped ring at the feet.
  slam: [[-1, -1, 3, 2, 0], [-9, 0, 4, 1, 1], [7, 0, 4, 1, 1], [-5, -2, 3, 1, 2], [4, -2, 3, 1, 2], [-5, 2, 3, 1, 2], [4, 2, 3, 1, 2]],
  // The staff held up, a looping glow at its head.
  glow: [[5, -46, 3, 3, 0], [3, -45, 7, 1, 1], [6, -48, 1, 7, 1], [2, -47, 1, 1, 2], [10, -43, 1, 1, 2]],
  // The blade's bright edge across the front.
  arc: [[9, -26, 2, 1, 0], [11, -23, 2, 1, 0], [12, -20, 2, 1, 1], [12, -17, 1, 2, 1], [11, -14, 1, 2, 2]],
  // An overhead coming down: the strike's flash on the ground in front.
  smash: [[11, -2, 3, 2, 0], [8, -1, 2, 1, 1], [15, -1, 2, 1, 1], [10, -5, 1, 2, 2], [14, -5, 1, 2, 2]],
  // The shield raised and braced: a brass slab in front of the chest.
  shield: [[8, -28, 2, 14, 1], [10, -27, 1, 12, 0], [7, -29, 1, 16, 2]],
  // The arm whip: the release's streak.
  whip: [[10, -32, 2, 1, 0], [12, -33, 3, 1, 1], [15, -34, 2, 1, 2]],
  // The drawn string held: a taut line at the hand.
  bow: [[7, -31, 1, 12, 1], [8, -26, 2, 1, 0]],
  // A hand to the mouth: one note rising.
  note: [[6, -40, 2, 2, 0], [8, -44, 1, 4, 1], [8, -45, 2, 1, 2]],
  // One knee down: a warm glow at the knee.
  kneel: [[2, -3, 3, 2, 0], [0, -2, 7, 1, 1], [-1, -1, 9, 1, 2]],
};
