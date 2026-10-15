/**
 * seam-sweeper.model — Seam Sweeper (a 5×5 Delve seam) as data and pure functions.
 *
 * Choose how many of the 25 cells will collapse (1–24) and place the bet. The
 * whole seam is drawn at that moment from the play's seed — which cells
 * collapse, and the one draw that settles the last fraction of a Gold — and
 * stored with the round. Then dig cells one at a time: ore raises the
 * multiplier, a collapse ends the round and the bet is lost. Cash out any time
 * after the first ore. A reload resumes the same seam; nothing re-rolls.
 *
 * The multiplier after k ore with m collapses is
 *
 *     ×  = RTP × C(25, k) / C(25 − m, k)
 *
 * where C(25, k) / C(25 − m, k) is 1 / (the chance of k ore in a row). So
 * cashing out after k ore returns RTP × the bet on average, for every k, every
 * m and every way of choosing cells: 95%, exactly (`seamReturnAt`).
 *
 * A dig that would lift the multiplier past ×5,000 is not offered (cash out
 * instead), so no cash-out is ever cut down by a ceiling and the 95% holds for
 * every move the board allows.
 *
 * Pure and import-free apart from the shared payout rounding.
 */
import { wholeGold } from '../games/rtp-sim';

export const SEAM_CELLS = 25;
export const SEAM_COLLAPSES = { min: 1, max: 24, start: 3 } as const;
export const SEAM_RTP = 0.95;
/** Highest multiplier a dig may reach. */
export const SEAM_MAX_X = 5_000;

export interface SeamOutcome {
  collapses: number;
  /** The collapse cells (0–24, row by row), ascending. */
  layout: number[];
  /** Settles the last fraction of a Gold at cash-out (see wholeGold). */
  u: number;
}

export interface SeamState {
  /** Cells dug, in order. All ore unless `hit` is set. */
  dug: number[];
  /** The collapse cell that ended the round. */
  hit?: number;
}

export function validCollapses(m: number): boolean {
  return Number.isInteger(m) && m >= SEAM_COLLAPSES.min && m <= SEAM_COLLAPSES.max;
}

/** The whole seam: `collapses` distinct cells by a partial Fisher–Yates shuffle, then the rounding draw. */
export function drawSeam(rng: () => number, collapses: number): SeamOutcome {
  if (!validCollapses(collapses)) throw new Error(`collapses must be ${SEAM_COLLAPSES.min}–${SEAM_COLLAPSES.max}`);
  const cells = Array.from({ length: SEAM_CELLS }, (_, i) => i);
  for (let i = 0; i < collapses; i++) {
    const j = i + Math.floor(rng() * (SEAM_CELLS - i));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const layout = cells.slice(0, collapses).sort((a, b) => a - b);
  return { collapses, layout, u: rng() };
}

/** 1 / (chance of `k` ore in a row with `m` collapses) = C(25, k) / C(25 − m, k). */
export function seamFair(m: number, k: number): number {
  let x = 1;
  for (let i = 0; i < k; i++) x *= (SEAM_CELLS - i) / (SEAM_CELLS - m - i);
  return x;
}

/** The multiplier shown and paid after `k` ore. */
export function seamMultiplier(m: number, k: number): number {
  return k <= 0 ? 0 : SEAM_RTP * seamFair(m, k);
}

/** The chance the next dig is ore, after `k` ore. */
export function seamSafeChance(m: number, k: number): number {
  const left = SEAM_CELLS - k;
  return left <= 0 ? 0 : (left - m) / left;
}

/** Ore cells in the seam. */
export function seamOre(m: number): number {
  return SEAM_CELLS - m;
}

/** True when one more dig after `k` ore is offered (ore left and under the ceiling). */
export function canDigMore(m: number, k: number): boolean {
  return k < seamOre(m) && seamMultiplier(m, k + 1) <= SEAM_MAX_X;
}

/** The deepest number of ore a round with `m` collapses can reach. */
export function seamDeepest(m: number): number {
  let k = 0;
  while (canDigMore(m, k)) k++;
  return k;
}

/** Gold a round pays when it closes in `state`. A collapse or no ore dug pays nothing. */
export function seamWin(o: SeamOutcome, state: SeamState, bet: number): number {
  if (state.hit !== undefined) return 0;
  const k = state.dug.length;
  if (k === 0) return 0;
  return wholeGold(bet * seamMultiplier(o.collapses, k), o.u);
}

/** True when the cell collapses. */
export function isCollapse(o: SeamOutcome, cell: number): boolean {
  return o.layout.includes(cell);
}

/**
 * Exact expected return (× bet) of the strategy "cash out after k ore": the
 * chance of k ore in a row × the multiplier. Equals SEAM_RTP for every k the
 * board offers (wholeGold pays the fraction exactly on average).
 */
export function seamReturnAt(m: number, k: number): number {
  return k <= 0 ? 0 : seamMultiplier(m, k) / seamFair(m, k);
}

/**
 * One whole round for the simulators: dig cells in a random order until `target`
 * ore (capped at the deepest allowed) or a collapse, then cash out.
 */
export function playSeamRound(rng: () => number, bet: number, collapses: number, target: number): { outcome: SeamOutcome; state: SeamState; win: number } {
  const outcome = drawSeam(rng, collapses);
  const goal = Math.max(1, Math.min(target, seamDeepest(collapses)));
  const order = Array.from({ length: SEAM_CELLS }, (_, i) => i);
  const state: SeamState = { dug: [] };
  for (let i = 0; i < SEAM_CELLS && state.dug.length < goal; i++) {
    const j = i + Math.floor(rng() * (SEAM_CELLS - i));
    [order[i], order[j]] = [order[j], order[i]];
    const cell = order[i];
    if (isCollapse(outcome, cell)) { state.hit = cell; break; }
    state.dug.push(cell);
  }
  return { outcome, state, win: seamWin(outcome, state, bet) };
}
