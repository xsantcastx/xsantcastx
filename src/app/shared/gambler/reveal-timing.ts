/**
 * reveal-timing.ts — how long each beat of the Gambler's reveal holds.
 *
 * Pure presentation. Nothing here reads a random number or touches a save; the
 * outcome is already minted and banked by `GamblerService.open` before any of
 * these numbers are asked for.
 *
 * THE HONESTY RULE
 * The charge beat lengthens with the rarity that was *actually rolled*, so a
 * long charge is a true signal and a short one is a true signal. There is no
 * "near miss" path: a common never gets a mythic-length build-up and a fake
 * flicker of gold, and the same rarity always gets the same timing. Fast mode
 * and reduced motion shorten every rarity alike, so they never leak or hide
 * anything the normal speed would not.
 */
import { rarityRank, RARITY_LADDER } from './mystery-box';
import type { ItemRarity } from '../rpg/item.model';

export type RevealSpeed = 'normal' | 'fast' | 'instant';

export interface RevealTiming {
  /** The wager settles onto the altar. */
  wagerMs: number;
  /** The veiled card shakes and charges. */
  chargeMs: number;
  /** The veil cracks and flips. */
  crackMs: number;
  /** 0..1 — how hard the card shakes and how bright the charge glows. */
  intensity: number;
}

const NORMAL = { wager: 420, chargeBase: 900, chargeStep: 260, crack: 640 } as const;
const FAST = { wager: 0, chargeBase: 260, chargeStep: 0, crack: 320 } as const;

/** Timing for one reveal of an outcome that has already been decided. */
export function revealTiming(rarity: ItemRarity, speed: RevealSpeed): RevealTiming {
  const rank = rarityRank(rarity);
  const intensity = RARITY_LADDER.length > 1 ? rank / (RARITY_LADDER.length - 1) : 0;
  if (speed === 'instant') return { wagerMs: 0, chargeMs: 0, crackMs: 0, intensity };
  const t = speed === 'fast' ? FAST : NORMAL;
  return {
    wagerMs: t.wager,
    chargeMs: t.chargeBase + t.chargeStep * rank,
    crackMs: t.crack,
    intensity,
  };
}

/** Total time from wager to reveal. */
export function revealTotalMs(timing: RevealTiming): number {
  return timing.wagerMs + timing.chargeMs + timing.crackMs;
}
