/**
 * mining-level.ts — the skill XP curve.
 *
 * This was a three-entry table: level 2 at 3,000 XP and level 3 at 9,000, with
 * nothing after. At 2 XP per action and a 2.5s cooldown that is 62 minutes of
 * unbroken clicking for the first level-up and roughly three hours to reach the
 * cap — a curve shaped for a game with twenty skills, applied to a game with
 * one. A player who levels twice and hits the ceiling does not come back.
 *
 * The curve now runs to 50 and is deliberately front-loaded: four level-ups in
 * the first hour to teach the loop, then a slope steep enough that later levels
 * want *better methods* rather than more clicking. Higher tiers are expected to
 * pay more XP per action; that is the intended answer to the slope, not grinding
 * Cinder Ore for a week.
 *
 * Pure and total — no clock, no storage — so it is safe from any path and
 * cheap to property-test.
 *
 * Changing the curve re-levels existing saves. That is safe: XP totals are the
 * stored value and levels are derived, so nobody loses progress, and because
 * this curve is gentler early than the old table, every existing player gains
 * levels rather than losing them.
 */

/** The ceiling. A skill at MAX_SKILL_LEVEL has no `next`. */
export const MAX_SKILL_LEVEL = 50;

/**
 * Cumulative XP required to *reach* `level`.
 *
 * `floor(100 * (level - 1) ^ 2.2)` — level 1 is free, level 2 lands at 100 XP
 * (50 actions, ~2 minutes), level 10 near 15k, level 50 near 700k.
 */
export function xpForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return 0;
  const capped = Math.min(MAX_SKILL_LEVEL, Math.floor(level));
  return Math.floor(100 * Math.pow(capped - 1, 2.2));
}

export interface MiningLevelView {
  level: number;
  /** Total XP earned in this discipline. */
  xp: number;
  /** XP earned *inside* the current level. Pair with `span` for a bar. */
  into: number;
  /** XP the current level spans. 0 at the cap. */
  span: number;
  /** Cumulative XP needed for the next level, or null at the cap. */
  next: number | null;
}

export function miningLevelView(xp: number): MiningLevelView {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;

  let level = 1;
  while (level < MAX_SKILL_LEVEL && total >= xpForLevel(level + 1)) level++;

  const floorXp = xpForLevel(level);
  if (level >= MAX_SKILL_LEVEL) {
    return { level, xp: total, into: total - floorXp, span: 0, next: null };
  }

  const nextXp = xpForLevel(level + 1);
  return {
    level,
    xp: total,
    into: total - floorXp,
    span: nextXp - floorXp,
    next: nextXp,
  };
}

/** Fill fraction for an XP bar, 0-100. A capped skill reads full. */
export function levelProgressPct(view: MiningLevelView): number {
  if (view.span <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((view.into / view.span) * 100)));
}
