/**
 * keeper-level.ts — the Keeper's own level, 1 to 10,000 (docs/design/leveling.md).
 *
 * Fed by the same XP as the Hunting skill (every kill and town task), but read
 * on its own curve: the skill curve (mining-level.ts) is shared by nine skills
 * and stays as it is. This one is shaped for combat levelling:
 *
 *   levels 1-50    xp(L) = floor(12 · (L-1)^2.6)                 10 ≈ 3.6k, 30 ≈ 76k, 50 ≈ 298k
 *   levels 50+     xp(L) = xp(50) + floor(A · ((L-1)^2.4 − 49^2.4)), A = 13 · 49^0.2 (same slope at 50)
 *                  100 ≈ 1.7M, 1,000 ≈ 0.45B, 10,000 ≈ 113B
 *
 * The increment keeps growing (×(L)^1.4 past 50) while a creature's XP grows
 * with its level, so the time a level takes grows slowly: ~0.4 h at 50, ~3.7 h
 * at 10,000 with content at the Keeper's level (the economy sim's `--leveling`).
 *
 * THE SAVE GUARANTEE: xp(L) here is below the skill curve's at every level up
 * to 10,000, so any XP total reads as the same or a higher Keeper level than
 * the Hunting level it showed before this curve existed. Never a level lost.
 * (Spec'd in keeper-level.spec.ts, all 10,000 levels.)
 *
 * Also here, because they are what a level *is*: the bounded stat growth
 * (`levelSteps`) and the attribute points a level brings (`levelAttributePoints`).
 * Pure, import-free: keeper-look.model (eager) reads the points.
 */

/** The top of the ladder. */
export const KEEPER_MAX_LEVEL = 10_000;

const EARLY_END = 50;
const EARLY_C = 12;
const EARLY_P = 2.6;
const LATE_P = 2.4;
/** Chosen so the increment is continuous at 50: 12·2.6·49^1.6 = A·2.4·49^1.4. */
const LATE_A = (EARLY_C * EARLY_P / LATE_P) * Math.pow(EARLY_END - 1, EARLY_P - LATE_P);
const XP_50 = Math.floor(EARLY_C * Math.pow(EARLY_END - 1, EARLY_P));
const BASE_LATE = Math.pow(EARLY_END - 1, LATE_P);

/** Cumulative XP needed to *reach* `level` (0 at level 1). */
export function keeperXpForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return 0;
  const L = Math.min(KEEPER_MAX_LEVEL, Math.floor(level));
  if (L <= EARLY_END) return Math.floor(EARLY_C * Math.pow(L - 1, EARLY_P));
  return XP_50 + Math.floor(LATE_A * (Math.pow(L - 1, LATE_P) - BASE_LATE));
}

/** The Keeper level an XP total reads as (binary search, 14 steps). */
export function keeperLevelForXp(xp: number): number {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  let lo = 1, hi = KEEPER_MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (total >= keeperXpForLevel(mid)) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export interface KeeperLevelView {
  level: number;
  xp: number;
  /** XP earned inside this level, and the level's span (0 at the top). */
  into: number;
  span: number;
  /** XP still needed for the next level (0 at the top). */
  toNext: number;
}

export function keeperLevelView(xp: number): KeeperLevelView {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const level = keeperLevelForXp(total);
  const floor = keeperXpForLevel(level);
  if (level >= KEEPER_MAX_LEVEL) return { level, xp: total, into: total - floor, span: 0, toNext: 0 };
  const next = keeperXpForLevel(level + 1);
  return { level, xp: total, into: total - floor, span: next - floor, toNext: next - total };
}

/** What one level step gives (td-skills levelStats): +8 life, +6 mana, +5% spell power. */
export const LEVEL_GROWTH = { life: 8, mana: 6, power: .05 } as const;

/** Past this level a level's life, mana and power taper (gear carries the rest). */
export const STAT_TAPER_FROM = 100;
const TAPER_K = 50;

/**
 * How many "level steps" of growth a level gives (levelStats multiplies its
 * +8 life, +6 mana, +5% power by this). Exactly L−1 to 100, so today's
 * balance is untouched; past 100 a log taper with the same slope at 100:
 * 1,000 → ~246 steps, 10,000 → ~364 (life ~3k, power ~19× at the very top).
 */
export function levelSteps(level: number): number {
  const L = Number.isFinite(level) ? Math.max(1, Math.min(KEEPER_MAX_LEVEL, Math.floor(level))) : 1;
  if (L <= STAT_TAPER_FROM) return L - 1;
  return STAT_TAPER_FROM - 1 + TAPER_K * Math.log(1 + (L - STAT_TAPER_FROM) / TAPER_K);
}

/**
 * Attribute points the level itself has given (milestone batches come on top,
 * keeper-milestones.ts): 5 a level to 100 (D2's 490 by 99, unchanged), then 1 a
 * level to 1,000, then 1 per 10 levels to 10,000. A point keeps its meaning
 * (one Vitality is always 6 life); they just arrive slower, so the sheet's
 * numbers stay readable: 495 at 100, 1,395 at 1,000, 2,295 at 10,000.
 */
export function levelAttributePoints(level: number): number {
  const L = Number.isFinite(level) ? Math.max(1, Math.min(KEEPER_MAX_LEVEL, Math.floor(level))) : 1;
  return 5 * (Math.min(L, 100) - 1) + Math.max(0, Math.min(L, 1000) - 100) + Math.max(0, Math.floor((L - 1000) / 10));
}

/**
 * Tibia's rule, cozy-sized (owner, 2026-10-21: "the higher level the faster they move"): the Keeper's pace grows with
 * the level, smoothly, and levels off.
 *
 *   bonus(L) = cap × (1 − e^(−(L − 1) / scale))      cap 0.60, scale 400
 *
 * The first levels add ~0.15 % each (cap / scale); +1.3 % at 10, +7 % at 50, +13 % at 100, +38 % at 400, +55 % at
 * 1,000, +60 % (the cap, within a hair) from ~3,000 to 10,000. It multiplies the rest of the Keeper's speed (Agility,
 * worn Move Speed, Haste), never adds to their caps; the pets and the raised keep up through the same factor.
 */
export const LEVEL_SPEED = { cap: 0.6, scale: 400 } as const;

/** The level's share of extra pace (0 at level 1, → 0.6). */
export function levelSpeedBonus(level: number): number {
  const L = Number.isFinite(level) ? Math.min(KEEPER_MAX_LEVEL, Math.max(1, Math.floor(level))) : 1;
  return LEVEL_SPEED.cap * (1 - Math.exp(-(L - 1) / LEVEL_SPEED.scale));
}
