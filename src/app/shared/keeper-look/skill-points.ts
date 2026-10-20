/**
 * skill-points.ts — the Spellbook's skill points a Keeper has earned (docs/design/leveling.md §2).
 *
 * One point per level from level 2 (level L has earned L − 1), plus the bonus points the level milestones hand out
 * (MILESTONE_SKILL_POINTS, the "+N skill points" rows of keeper-milestones.ts). How points are SPENT — ranks, the
 * tree — belongs to the Warlock skill tree, which reads this; nothing here knows about spells.
 *
 * Pure and import-free (derived from the level alone, so a point can never be granted twice or lost on a merge).
 */

/** Bonus skill points at a milestone level (on top of the one every level gives). */
export const MILESTONE_SKILL_POINTS: Readonly<Record<number, number>> = {
  10: 1, 30: 1, 50: 2, 100: 2,
  200: 1, 300: 1, 400: 1, 500: 1, 600: 1, 700: 1, 800: 1, 900: 1, 1000: 3,
  1500: 1, 2000: 1, 2500: 1, 3000: 1, 3500: 1, 4000: 1, 4500: 1, 5000: 2,
  10000: 5,
};

/** The milestone bonus a level has reached (every MILESTONE_SKILL_POINTS row at or below it). */
export function milestoneSkillPoints(level: number): number {
  const L = Number.isFinite(level) ? Math.floor(level) : 1;
  let n = 0;
  for (const [at, pts] of Object.entries(MILESTONE_SKILL_POINTS)) if (Number(at) <= L) n += pts;
  return n;
}

/** Every skill point a Keeper of `level` has earned: L − 1, plus the milestones' bonus. */
export function skillPointsEarned(level: number): number {
  const L = Number.isFinite(level) ? Math.max(1, Math.min(10_000, Math.floor(level))) : 1;
  return L - 1 + milestoneSkillPoints(L);
}
