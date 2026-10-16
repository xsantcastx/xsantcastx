/**
 * glim-art.ts — Glim's placeholder pixels: a 12×10 art-pixel moth of lamplight,
 * hand-authored on the art bible's grid until the painted sheet (npc-glim,
 * docs/art-commissions/commissions.csv) lands. One source for the world sprite
 * (play/engine/glim-sprite.ts) and the HUD / Codex icon (glim-icon.component.ts).
 *
 * Amber-gold body (Luminous gold), pale dawn-glass wings with faint map lines,
 * violet only at the wing edges (canon: violet is Godforge energy), no face
 * beyond two bright points. Never cute.
 */
/** Half rows (cols 0..5); the right half is the mirror. Palette keys below. */
export type GlimFrameName = 'up' | 'mid' | 'down';

const HALF: Readonly<Record<GlimFrameName, readonly string[]>> = {
  up: ['.v.a..', 'vwv.a.', 'vwlv.e', 'vwwwoB', '.vwlwB', '..vwoB', '...v.B', '.....b', '......', '......'],
  mid: ['......', '...a..', '....ae', 'vvvwoB', 'vwlwwB', '.vwwlB', '..vvwB', '.....b', '......', '......'],
  down: ['......', '...a..', '....ae', '....oB', '..vwwB', '.vwlwB', 'vwwwvB', 'vwlv.b', 'vvv...', '......'],
};

export const GLIM_PALETTE: Readonly<Record<string, string>> = {
  v: '#9a6be0', // violet: the wing edges only
  w: '#efe9f7', // pale dawn-glass
  l: '#a89cc8', // the map lines inked on the wings
  a: '#ffd98a', // antennae
  e: '#fffbea', // the two bright points
  B: '#f4b942', // amber-gold body
  o: '#e89b2c', // body shade
  b: '#c8862a', // tail
};
/** Dim: the same moth with its light pulled in. */
export const GLIM_PALETTE_DIM: Readonly<Record<string, string>> = {
  v: '#4a3a66', w: '#7d7889', l: '#5d5770', a: '#8a7650', e: '#c9c4b0', B: '#8a6a32', o: '#7a5a2a', b: '#5e4626',
};

export const GLIM_W = 12;
export const GLIM_H = 10;

/**
 * Glim's moods (docs/handoff/pets-and-glim-alive.md): its two bright points
 * change, nothing more. `calm` is the plain face. A gasp widens them and opens
 * a small dark mouth, a grin turns them to little arcs, worry pulls them down
 * and dims them, sleepy closes them to a line, curious lifts one.
 */
export type GlimMood = 'calm' | 'happy' | 'gasp' | 'worry' | 'sleepy' | 'curious';
export const GLIM_MOODS: readonly GlimMood[] = ['calm', 'happy', 'gasp', 'worry', 'sleepy', 'curious'];

/** The face, as pixels painted over a frame's body (x, y, palette key; '_' = the body showing through). */
const FACE: Readonly<Record<GlimMood, readonly (readonly [number, number, string])[]>> = {
  calm: [],
  // Little upturned arcs, a warm pixel of cheek under each.
  happy: [[5, 2, 'o'], [6, 2, 'o'], [4, 2, 'e'], [7, 2, 'e'], [5, 1, 'e'], [6, 1, 'e'], [4, 3, 'k'], [7, 3, 'k']],
  // Wide: two-tall points, and a dark open mouth below.
  gasp: [[5, 2, 'e'], [6, 2, 'e'], [5, 3, 'e'], [6, 3, 'e'], [5, 5, 'm'], [6, 5, 'm']],
  // Pulled down and dimmed.
  worry: [[5, 2, 'o'], [6, 2, 'o'], [5, 3, 'a'], [6, 3, 'a']],
  // A closed line.
  sleepy: [[5, 2, 'o'], [6, 2, 'o'], [5, 3, 'b'], [6, 3, 'b']],
  // One point lifted.
  curious: [[5, 2, 'o'], [5, 1, 'e'], [6, 2, 'e']],
};
/** The face's extra colours: a rosy cheek, the open mouth. */
export const GLIM_FACE_PALETTE: Readonly<Record<string, string>> = { k: '#ff9fb0', m: '#5a2a1a' };

export function glimFace(mood: GlimMood): readonly (readonly [number, number, string])[] { return FACE[mood]; }

/** One frame as full 12-wide rows (the half and its mirror). */
export function glimRows(frame: GlimFrameName): string[] {
  return HALF[frame].map(half => half + [...half].reverse().join(''));
}
