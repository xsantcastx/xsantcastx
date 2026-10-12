/**
 * rate-limit.ts — sliding-window limits over stored action timestamps. Pure.
 *
 * The stamps live on the player's escrow document and are written in the same
 * transaction as the action, so two concurrent calls cannot both squeeze under
 * the limit: Firestore retries the loser against the winner's stamps.
 */
import {DAY_MS} from "./pricing";

export interface RateLimit {
  perMinute: number;
  perDay: number;
}

export interface RateVerdict {
  ok: boolean;
  /** How long until the next call would be accepted. 0 when ok. */
  retryAfterMs: number;
  /** The stamps to store if the action goes ahead (pruned, plus `now`). */
  stamps: number[];
}

export function checkRate(stamps: readonly number[], now: number, limit: RateLimit): RateVerdict {
  const day = stamps.filter((t) => t > now - DAY_MS && t <= now).sort((a, b) => a - b);
  const minute = day.filter((t) => t > now - 60_000);
  if (minute.length >= limit.perMinute) {
    return {ok: false, retryAfterMs: minute[minute.length - limit.perMinute] + 60_000 - now, stamps: day};
  }
  if (day.length >= limit.perDay) {
    return {ok: false, retryAfterMs: day[day.length - limit.perDay] + DAY_MS - now, stamps: day};
  }
  return {ok: true, retryAfterMs: 0, stamps: [...day, now]};
}
