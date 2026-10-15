/**
 * bet-tiers — which bets a player may place, read off the economy curve.
 *
 * The ladder and the cap live in economy-curve (GAMES_BET) so the simulator
 * grades the numbers that ship. This file is the games' view of them.
 */
import { GAMES_BET, gamesBetCap, gamesBetLadder } from '../economy/economy-curve';

const LADDER = gamesBetLadder();

/** Every bet open at this income, lowest first. Never empty. */
export function betsOpen(goldPerSecond: number): number[] {
  const cap = gamesBetCap(goldPerSecond);
  return LADDER.filter(b => b <= cap);
}

/** True when `bet` is a rung of the ladder and under the cap. */
export function betAllowed(bet: number, goldPerSecond: number): boolean {
  return LADDER.includes(bet) && bet <= gamesBetCap(goldPerSecond);
}

/** The highest open bet at or under `bet` (the minimum when none is). */
export function clampBet(bet: number, goldPerSecond: number): number {
  const open = betsOpen(goldPerSecond);
  let out = open[0];
  for (const b of open) if (b <= bet) out = b;
  return out;
}

/** One rung up or down the open ladder from `bet`. */
export function stepBet(bet: number, dir: 1 | -1, goldPerSecond: number): number {
  const open = betsOpen(goldPerSecond);
  const i = Math.max(0, open.indexOf(clampBet(bet, goldPerSecond)));
  return open[Math.max(0, Math.min(open.length - 1, i + dir))];
}
