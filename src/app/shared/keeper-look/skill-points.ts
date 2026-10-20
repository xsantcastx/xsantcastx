/**
 * skill-points.ts — the skill points a Keeper's level has earned (D2: one a level from level 2).
 *
 * The Spellbook's trees (play/td/td-tree) spend them; points left = earned − spent.
 */
// leveling branch extends this with milestone bonuses
export function skillPointsEarned(level: number): number {
  return Math.max(0, Math.floor(level) - 1);
}
