/**
 * luminous.ts — the Luminous underside's broken rule, as pure functions (the
 * engine runs them; scripts/realm-delves.test.cjs pins them). No DOM, no Angular.
 *
 * The rule (rift-gates.model.ts): LIGHT IS SOLID. The Prism Mines lie under
 * the Luminous realm's towns, where its sun comes through the rock in beams.
 * Said once, plainly, the first time it applies (the engine's telegraph lines):
 *
 *  1. Beams. A sun-prism (the realm's sun seen from underneath, set in a roof)
 *     shines straight down. Where the beam crosses open air it is solid: a
 *     LIGHT SHAFT (a ladder of light, climbable, its top a floor) going down,
 *     a LIGHT BRIDGE (a floor) going across. It runs until something stops
 *     it: rock, a placed thing, liquid, or BEAM_MAX cells.
 *  2. Mirrors. A prism mirror ('/' or '\') turns a beam a right angle; E turns
 *     the mirror. So a bridge can be laid across a chasm by turning one.
 *  3. Shadow glass. Some floors are glass that is only a floor while light is
 *     on it: a placed light within PANE_LIGHT cells, a beam through it, or
 *     (with the Dawn Lens carried) the Keeper's own lantern within LENS_CELLS.
 *     Unlit, it is a hole that looks like a floor. Falling is never a trap:
 *     there is no fall damage, and every shadow pit opens on a way out.
 *  4. The Hollow Sun takes no blow unless a beam crosses it; caught, it cannot
 *     move. Every PRISM_FLARE seconds it flares free and turns its hall's
 *     mirrors the wrong way.
 */
import { TERRAIN_NODE_LIST, type Terrain } from './terrain';

/** Longest a beam runs, in cells (bounds the work, and a beam is never infinite). */
export const BEAM_MAX = 48;
/** A placed light lights shadow glass this many cells round it (Chebyshev). */
export const PANE_LIGHT = 4;
/** With the Dawn Lens, the lantern lights shadow glass this many cells round the Keeper's feet. */
export const LENS_CELLS = 3;
/** Seconds between the light being worked out again (beams and panes change only when something moves). */
export const LIGHT_TICK = .15;
/** Seconds between the Hollow Sun's flares, and what one does to a Keeper within FLARE_CELLS. */
export const PRISM_FLARE = 12;
export const FLARE_CELLS = 4;
export const FLARE_HIT = 20;

const id = (name: string) => TERRAIN_NODE_LIST.findIndex(node => node.id === name);
export const K = {
  air: 0, sun: id('sun-prism'), mirrorA: id('prism-mirror-a'), mirrorB: id('prism-mirror-b'),
  bridge: id('light-bridge'), shaft: id('light-shaft'), pane: id('umbra-pane'), lit: id('lit-pane'),
};
const PLACED_LIGHT = Uint8Array.from(TERRAIN_NODE_LIST, node => node.placeable && node.glow ? 1 : 0);

/** What a cell becomes under light: a bridge (beam across), a shaft (beam down or up), lit glass. */
export const LIT_BRIDGE = 1, LIT_SHAFT = 2, LIT_PANE = 3;

/** True for the transient kinds the light makes (never saved). */
export function isLightMade(kind: number): boolean { return kind === K.bridge || kind === K.shaft || kind === K.lit; }
/** A mirror turned the other way. */
export function turned(kind: number): number { return kind === K.mirrorA ? K.mirrorB : kind === K.mirrorB ? K.mirrorA : kind; }
/** The direction a beam leaves a mirror: '/' sends east→up, down→west; '\' sends east→down, down→east. */
export function reflect(kind: number, dc: number, dr: number): [number, number] {
  return kind === K.mirrorA ? [-dr, -dc] : [dr, dc];
}

/** A rectangle of cells to work the light out in (inclusive). */
export interface LightWindow { c0: number; c1: number; r0: number; r1: number }

/**
 * Trace every sun-prism's beam in the window: `out` gets cell index → LIT_BRIDGE
 * or LIT_SHAFT (a crossing is a shaft: a ladder is a floor too) or LIT_PANE for
 * shadow glass a beam passes through. Reads the terrain as it is, light-made
 * cells counting as open air. Pure apart from `out`.
 */
export function traceBeams(t: Terrain, w: LightWindow, out: Map<number, number>): number {
  let beams = 0;
  for (let row = Math.max(0, w.r0); row <= Math.min(t.rows - 1, w.r1); row++) for (let col = w.c0; col <= w.c1; col++) {
    if (!t.inside(col, row) || t.kind[t.index(col, row)] !== K.sun) continue;
    beams++;
    let c = col, r = row, dc = 0, dr = 1;
    for (let step = 0; step < BEAM_MAX; step++) {
      c += dc; r += dr;
      if (!t.inside(c, r)) break;
      const i = t.index(c, r), k = t.kind[i];
      if (k === K.mirrorA || k === K.mirrorB) { [dc, dr] = reflect(k, dc, dr); continue; }
      if (t.liqLevel[i]) break;
      if (k === K.pane || k === K.lit) { out.set(i, LIT_PANE); continue; }
      if (k !== K.air && k !== K.bridge && k !== K.shaft) break;
      const want = dc ? LIT_BRIDGE : LIT_SHAFT;
      if (out.get(i) !== LIT_SHAFT) out.set(i, want);
    }
  }
  return beams;
}

/**
 * Light shadow glass in the window: within PANE_LIGHT of a placed light, and
 * (the Dawn Lens) within LENS_CELLS of `lens` (the Keeper's feet cell). Pure apart from `out`.
 */
export function lightPanes(t: Terrain, w: LightWindow, lens: { col: number; row: number } | null, out: Map<number, number>): void {
  for (let row = Math.max(0, w.r0); row <= Math.min(t.rows - 1, w.r1); row++) for (let col = w.c0; col <= w.c1; col++) {
    if (!t.inside(col, row)) continue;
    const k = t.kind[t.index(col, row)];
    if (k !== K.pane && k !== K.lit) continue;
    let lit = !!lens && Math.max(Math.abs(col - lens.col), Math.abs(row - lens.row)) <= LENS_CELLS;
    for (let r = row - PANE_LIGHT; r <= row + PANE_LIGHT && !lit; r++) for (let c = col - PANE_LIGHT; c <= col + PANE_LIGHT && !lit; c++) {
      if (t.inside(c, r) && PLACED_LIGHT[t.kind[t.index(c, r)]]) lit = true;
    }
    if (lit) out.set(t.index(col, row), LIT_PANE);
  }
}

/**
 * Lay the light: every cell of the window takes what `lit` says (or goes back
 * to open air / dark glass). Calls `changed` for each cell it set. Pure apart
 * from `t`. Returns how many cells changed.
 */
export function applyLight(t: Terrain, w: LightWindow, lit: ReadonlyMap<number, number>, changed?: (col: number, row: number) => void): number {
  let n = 0;
  for (let row = Math.max(0, w.r0); row <= Math.min(t.rows - 1, w.r1); row++) for (let col = w.c0; col <= w.c1; col++) {
    if (!t.inside(col, row)) continue;
    const i = t.index(col, row), k = t.kind[i];
    const want = lit.get(i);
    let next = k;
    if (k === K.pane || k === K.lit) next = want === LIT_PANE ? K.lit : K.pane;
    else if (k === K.air || k === K.bridge || k === K.shaft) next = want === LIT_BRIDGE ? K.bridge : want === LIT_SHAFT ? K.shaft : K.air;
    if (next === k) continue;
    t.set(col, row, next);
    n++;
    changed?.(col, row);
  }
  return n;
}

/** Put a light-made cell back as it was generated (a column leaving the ring keeps none). */
export function unlit(kind: number): number { return kind === K.lit ? K.pane : kind === K.bridge || kind === K.shaft ? K.air : kind; }
