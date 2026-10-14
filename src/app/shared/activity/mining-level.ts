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

/**
 * Mastery: the last level of the original 1-99 curve, and the line every
 * skill's unlock table ends on ("every rung climbed").
 *
 * It is no longer a ceiling (owner, 2026-10-14: "levels shouldn't be capped,
 * we should do it like Tibia"). Levels 2-99 cost exactly what they always did,
 * so a stored XP total reads as the same level it read before; past 99 the
 * curve keeps going, Tibia-style, on a steepening increment (see xpForLevel).
 */
export const MASTERY_LEVEL = 99;

/**
 * A bookkeeping bound for the level search, not a cap: level 10,000 needs
 * ~1.8 trillion XP (about 100,000 years at the best rate in the game), and
 * every number on the way stays an exact integer.
 */
export const LEVEL_SEARCH_LIMIT = 10_000;

/** The original curve, levels 1-99: `floor(100 * (level - 1) ^ 2.2)`. */
function baseXp(level: number): number {
  return Math.floor(100 * Math.pow(level - 1, 2.2));
}

/** XP the 98 -> 99 step costs (53,607): the unit the curve past 99 is priced in. */
export const MASTERY_STEP = baseXp(MASTERY_LEVEL) - baseXp(MASTERY_LEVEL - 1);
const MASTERY_XP = baseXp(MASTERY_LEVEL);

/** Sum of k^2 for k = 1..n. */
function squares(n: number): number {
  return (n * (n + 1) * (2 * n + 1)) / 6;
}

/**
 * Cumulative XP required to *reach* `level`.
 *
 * Levels 1-99: `floor(100 * (level - 1) ^ 2.2)` — level 2 lands at 100 XP,
 * level 10 near 12.5k, level 50 near 530k, level 99 at 2,402,687.
 *
 * Past 99, Tibia's shape: each level costs the 98 -> 99 step scaled by
 * (level / 99)^2, so the increment grows with the square of the level and the
 * total with its cube (Tibia's own curve is a cubic). In closed form:
 *
 *   xp(L) = xp(99) + floor(MASTERY_STEP * (S(L) - S(99)) / 99^2),  S(n) = sum k^2 for k <= n
 *
 * Level 100 costs ~1.02x the step to 99 (continuous), level 150 ~2.3x, level
 * 200 ~4.1x, level 300 ~9.2x. Totals: 150 ~6.8M, 200 ~15.3M, 300 ~50.1M,
 * 1,000 ~1.83B — exact integers all the way to LEVEL_SEARCH_LIMIT.
 */
export function xpForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return 0;
  const lvl = Math.min(LEVEL_SEARCH_LIMIT, Math.floor(level));
  if (lvl <= MASTERY_LEVEL) return baseXp(lvl);
  return MASTERY_XP + Math.floor(MASTERY_STEP * (squares(lvl) - squares(MASTERY_LEVEL)) / (MASTERY_LEVEL * MASTERY_LEVEL));
}

export interface MiningLevelView {
  level: number;
  /** Total XP earned in this discipline. */
  xp: number;
  /** XP earned *inside* the current level. Pair with `span` for a bar. */
  into: number;
  /** XP the current level spans. 0 only at LEVEL_SEARCH_LIMIT. */
  span: number;
  /** Cumulative XP needed for the next level; null only at LEVEL_SEARCH_LIMIT. */
  next: number | null;
}

/** The level an XP total reads as: a linear walk to 99, a binary search past it. */
export function levelForXp(xp: number): number {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  if (total < MASTERY_XP) {
    let level = 1;
    while (total >= xpForLevel(level + 1)) level++;
    return level;
  }
  let lo = MASTERY_LEVEL, hi = LEVEL_SEARCH_LIMIT;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (total >= xpForLevel(mid)) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function miningLevelView(xp: number): MiningLevelView {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const level = levelForXp(total);
  const floorXp = xpForLevel(level);
  if (level >= LEVEL_SEARCH_LIMIT) {
    return { level, xp: total, into: total - floorXp, span: 0, next: null };
  }
  const nextXp = xpForLevel(level + 1);
  return { level, xp: total, into: total - floorXp, span: nextXp - floorXp, next: nextXp };
}

/** Fill fraction for an XP bar, 0-100. A capped skill reads full. */
export function levelProgressPct(view: MiningLevelView): number {
  if (view.span <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((view.into / view.span) * 100)));
}

/**
 * An XP figure short enough for a phone: exact under 100,000 ("53,607"), then
 * K / M / B with up to two decimals ("240K", "2.4M", "1.83B"). Past 99 the
 * totals run to tens of millions, and a ten-digit number shoves a skill card
 * sideways. Locale-neutral on purpose (SSR HTML is shared by EN and ES), like
 * economy.model's formatCompact — kept here so the skill surfaces do not pull
 * the economy module into their chunk.
 */
export function formatXp(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const short = (x: number, unit: string): string => `${Number(x.toFixed(x < 10 ? 2 : x < 100 ? 1 : 0))}${unit}`;
  if (v >= 1e9) return short(v / 1e9, 'B');
  if (v >= 1e6) return short(v / 1e6, 'M');
  if (v >= 1e5) return short(v / 1e3, 'K');
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The skill-agnostic names. The `mining*` ones stay for existing callers. */
export type SkillLevelView = MiningLevelView;
export const skillLevelView = miningLevelView;
