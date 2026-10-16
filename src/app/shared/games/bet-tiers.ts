/**
 * bet-tiers — which bets a player may place, read off the economy curve.
 *
 * The ladder and the cap live in economy-curve (GAMES_BET) so the simulator
 * grades the numbers that ship. This file is the games' view of them. `purse`
 * is the Keeper's Gold now: a deep purse opens bets up to 1% of it, never more
 * than an hour of income (economy-curve `gamesBetCap`). Omitted, it is 0 and
 * the cap is the plain two minutes of income.
 */
import { GAMES_BET, gamesBetCap, gamesBetLadder, gamesHighStake } from '../economy/economy-curve';

const LADDER = gamesBetLadder();

/** Every bet open at this income and purse, lowest first. Never empty. */
export function betsOpen(goldPerSecond: number, purse = 0): number[] {
  const cap = gamesBetCap(goldPerSecond, purse);
  return LADDER.filter(b => b <= cap);
}

/** True when `bet` is a rung of the ladder and under the cap. */
export function betAllowed(bet: number, goldPerSecond: number, purse = 0): boolean {
  return LADDER.includes(bet) && bet <= gamesBetCap(goldPerSecond, purse);
}

/** The highest open bet at or under `bet` (the minimum when none is). */
export function clampBet(bet: number, goldPerSecond: number, purse = 0): number {
  const open = betsOpen(goldPerSecond, purse);
  let out = open[0];
  for (const b of open) if (b <= bet) out = b;
  return out;
}

/** One rung up or down the open ladder from `bet`. */
export function stepBet(bet: number, dir: 1 | -1, goldPerSecond: number, purse = 0): number {
  const open = betsOpen(goldPerSecond, purse);
  const i = Math.max(0, open.indexOf(clampBet(bet, goldPerSecond, purse)));
  return open[Math.max(0, Math.min(open.length - 1, i + dir))];
}

/** The quick-pick chips: the minimum, half, double and the cap, as open rungs. */
export interface BetChips { min: number; half: number; double: number; max: number }
export function betChips(bet: number, goldPerSecond: number, purse = 0): BetChips {
  const open = betsOpen(goldPerSecond, purse);
  return {
    min: open[0],
    half: clampBet(Math.floor(bet / 2), goldPerSecond, purse),
    double: clampBet(bet * 2, goldPerSecond, purse),
    max: open[open.length - 1],
  };
}

/** A bet the games confirm with one more tap (more than two minutes of income). */
export function highStake(bet: number, goldPerSecond: number): boolean {
  return bet > GAMES_BET.min && gamesHighStake(bet, goldPerSecond);
}
