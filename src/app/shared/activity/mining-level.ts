/**
 * mining-level.ts — authored Mining XP thresholds for C8 display.
 *
 * Spec table, not a curve. Level 2 unlocks a later discovery table.
 * Level 3 is reserved. No yield multiplier.
 */
export const MINING_XP_TO_LEVEL_2 = 30;
export const MINING_XP_TO_LEVEL_3 = 90;

export interface MiningLevelView {
  level: number;
  xp: number;
  into: number;
  next: number | null;
}

export function miningLevelView(xp: number): MiningLevelView {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  if (total < MINING_XP_TO_LEVEL_2) {
    return { level: 1, xp: total, into: total, next: MINING_XP_TO_LEVEL_2 };
  }
  if (total < MINING_XP_TO_LEVEL_3) {
    return { level: 2, xp: total, into: total, next: MINING_XP_TO_LEVEL_3 };
  }
  return { level: 3, xp: total, into: total, next: null };
}
