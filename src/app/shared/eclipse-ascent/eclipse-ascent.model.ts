/**
 * eclipse-ascent.model — Eclipse Ascent (a single-player crash game) as data and pure functions.
 *
 * Launch: the multiplier starts at ×1.00 and doubles every 6 seconds while the
 * eclipse grows. At a point drawn at the bet it breaks; cash out before then
 * and you are paid the bet × the multiplier you cashed at. Optionally set a
 * target and the round cashes out there by itself.
 *
 * The break point is drawn ONCE, at the bet, from the play's seed, and stored
 * with the round. In hundredths:
 *
 *     crash = floor(100 × RTP / (1 − a)),  a uniform in [0, 1)
 *
 * so the chance the eclipse holds to at least ×x is exactly RTP / x for every
 * x from ×1.01 to the ×1,000 ceiling, and cashing out at ×x returns
 * x × RTP / x = RTP of the bet on average — 95%, whatever target you pick or
 * whenever you press. Draws under ×1.01 break at once (×1.00): 1 − 0.95 / 1.01
 * = 5.94% of rounds.
 *
 * The round runs on the wall clock from its stored launch time: leave and come
 * back and it has kept rising (or broken) exactly as if you had watched.
 *
 * Pure and import-free apart from the shared payout rounding.
 */
import { wholeGold } from '../games/rtp-sim';

export const ASCENT_RTP = 0.95;
/** Multipliers are whole hundredths: 100 = ×1.00. */
export const ASCENT_FLOOR = 100;
/** The lowest cash-out (×1.01). */
export const ASCENT_MIN_CASH = 101;
/** The ceiling: the eclipse never holds past ×1,000. */
export const ASCENT_MAX = 100_000;
/** The multiplier doubles every this many ms. */
export const ASCENT_DOUBLING_MS = 6_000;
/** Auto cash-out targets offered (hundredths). 0 = off. */
export const ASCENT_TARGETS: readonly number[] = [0, 120, 150, 200, 300, 500, 1_000, 2_500, 10_000, 100_000];

export interface AscentOutcome {
  /** The break point, hundredths (100 = broke at once). */
  crash: number;
  /** Settles the last fraction of a Gold at cash-out (see wholeGold). */
  u: number;
}

export interface AscentState {
  /** Wall-clock launch time, ms. */
  startedAt: number;
  /** Auto cash-out target in hundredths, or 0. */
  auto: number;
  /** Where the round was cashed out (hundredths). Unset = broke. */
  cashedAt?: number;
}

/** The break point and the rounding draw. */
export function drawAscent(rng: () => number): AscentOutcome {
  const a = rng();
  const u = rng();
  let crash = Math.floor((100 * ASCENT_RTP) / (1 - a));
  if (crash < ASCENT_MIN_CASH) crash = ASCENT_FLOOR;
  return { crash: Math.min(ASCENT_MAX, crash), u };
}

/** The multiplier (hundredths) `ms` after launch. */
export function ascentAt(ms: number): number {
  if (!(ms > 0)) return ASCENT_FLOOR;
  return Math.min(ASCENT_MAX, Math.floor(ASCENT_FLOOR * 2 ** (ms / ASCENT_DOUBLING_MS)));
}

/** Ms after launch at which the multiplier reaches `x` hundredths. */
export function msToReach(x: number): number {
  return x <= ASCENT_FLOOR ? 0 : ASCENT_DOUBLING_MS * Math.log2(x / ASCENT_FLOOR);
}

/** Chance the eclipse holds to at least `x` hundredths: RTP / (x / 100), capped at 1. */
export function holdChance(x: number): number {
  if (x <= ASCENT_FLOOR) return 1;
  if (x > ASCENT_MAX) return 0;
  return Math.min(1, (ASCENT_RTP * 100) / x);
}

/** True when a cash-out at `x` beats the break. */
export function cashHolds(o: AscentOutcome, x: number): boolean {
  return x >= ASCENT_MIN_CASH && x <= o.crash;
}

/** Gold a round pays when it closes in `state`. */
export function ascentWin(o: AscentOutcome, state: AscentState, bet: number): number {
  const x = state.cashedAt;
  if (x === undefined || !cashHolds(o, x)) return 0;
  return wholeGold((bet * x) / 100, o.u);
}

/**
 * Where a round stands at `now`, given its stored state: still rising, or how
 * it closed. Pure, so the service, the panel and a reload agree.
 *
 *   auto target reached before the break → cashed at the target
 *   the clock passed the break            → broke
 *   otherwise                             → rising at `x`
 */
export function ascentStatus(o: AscentOutcome, state: AscentState, now: number):
  { kind: 'rising'; x: number } | { kind: 'cashed'; x: number } | { kind: 'broke'; x: number } {
  const x = ascentAt(now - state.startedAt);
  if (state.auto >= ASCENT_MIN_CASH && state.auto <= o.crash && x >= state.auto) return { kind: 'cashed', x: state.auto };
  if (x >= o.crash) return { kind: 'broke', x: o.crash };
  return { kind: 'rising', x };
}

/** One whole round for the simulators: cash out at `target` (hundredths). */
export function playAscentRound(rng: () => number, bet: number, target: number): { outcome: AscentOutcome; win: number } {
  const outcome = drawAscent(rng);
  return { outcome, win: ascentWin(outcome, { startedAt: 0, auto: target, cashedAt: target }, bet) };
}

/** Format hundredths as "×1.37". */
export function fmtX(x: number): string {
  return `×${(x / 100).toFixed(2)}`;
}
