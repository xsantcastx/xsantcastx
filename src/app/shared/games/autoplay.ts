/**
 * autoplay — the rules of auto spin, pure (owner 2026-10-15: "we also need auto
 * spin and higher bets"). Shared by the Reels, the Eclipse Cascade and the
 * realm machines; the component only drives the timer.
 *
 *   counts   ×10 · ×25 · ×50 · ×100 · until stopped
 *   stops    on any bonus round (on by default), on a single win of at least
 *            ×N the bet, when the purse would fall below a floor, and always
 *            the big Stop button; it also stops when the bet is no longer open
 *            (the cap moved) or the purse is short
 *   pauses   while the tab is hidden; it ends when the machine closes (the
 *            Slate folded, the panel shut): nothing plays out of sight
 *
 * Each auto spin is an ordinary play on the ledger with its own mutation id,
 * so it is paid exactly once, like a tapped spin, and the RTP is the machine's.
 */

/** `Infinity` = until stopped. */
export const AUTO_COUNTS: readonly number[] = [10, 25, 50, 100, Infinity];
/** Stop on a single win of at least this many times the bet (0 = off). */
export const AUTO_WIN_STOPS: readonly number[] = [0, 10, 50, 200];
/** Stop when the purse would fall below this share of what it was at the start (0 = off). */
export const AUTO_FLOOR_SHARES: readonly number[] = [0, 0.5, 0.75];
/** The pause between auto spins after a result shows, ms. */
export const AUTO_GAP_MS = 450;

export interface AutoStops {
  bonus: boolean;
  /** × the bet; 0 = off. */
  winX: number;
  /** Share of the starting purse kept; 0 = off. */
  floorShare: number;
}

export const DEFAULT_STOPS: AutoStops = { bonus: true, winX: 0, floorShare: 0 };

export interface AutoRun {
  /** Spins still to go (Infinity = until stopped). */
  left: number;
  done: number;
  stops: AutoStops;
  /** The purse never goes below this (0 = no floor). */
  floor: number;
  /** Net Gold of the run so far (wins − bets). */
  net: number;
  paused: boolean;
}

export type AutoStopReason = 'count' | 'bonus' | 'win' | 'floor' | 'funds' | 'bet' | 'user';

export function startAuto(count: number, stops: AutoStops, purse: number): AutoRun {
  const floor = stops.floorShare > 0 ? Math.floor(purse * stops.floorShare) : 0;
  return { left: count, done: 0, stops: { ...stops }, floor, net: 0, paused: false };
}

/** May the next auto spin go? Checked BEFORE each bet: null = go, else why it stops. */
export function autoCanSpin(run: AutoRun, purse: number, bet: number, betOpen: boolean): AutoStopReason | null {
  if (!(run.left > 0)) return 'count';
  if (!betOpen) return 'bet';
  if (purse < bet) return 'funds';
  if (run.floor > 0 && purse - bet < run.floor) return 'floor';
  return null;
}

/** After a spin settled: the run with it counted, and why it stops (null = keep going). */
export function autoAfter(run: AutoRun, spin: { bet: number; win: number; bonus: boolean }): { run: AutoRun; stop: AutoStopReason | null } {
  const next: AutoRun = { ...run, left: run.left - 1, done: run.done + 1, net: run.net + spin.win - spin.bet };
  if (run.stops.bonus && spin.bonus) return { run: next, stop: 'bonus' };
  if (run.stops.winX > 0 && spin.win >= run.stops.winX * spin.bet) return { run: next, stop: 'win' };
  if (!(next.left > 0)) return { run: next, stop: 'count' };
  return { run: next, stop: null };
}

/** The count label: "10", "∞" is drawn by the caller from i18n. */
export function isEndless(count: number): boolean {
  return count === Infinity;
}
