/**
 * td-life.ts — how long a top-down creature lasts (docs/design/loot-and-combat.md §13, `node scripts/combat-sim.mjs`).
 *
 * The life written beside each creature in td-mobs MOBS was set by eye next to a starter Keeper. The combat simulator
 * (the real MobSystem, every vocation at levels 5–60 in level-appropriate gear) found that a Keeper at level killed an
 * ordinary creature in about a second and every boss in five to ten — the Keeper's damage had grown about threefold
 * past what the table was written for, and some twenty-fold past the bosses'. So every creature rises with its
 * authored life × `lifeScale`:
 *
 *  - an ordinary creature (and a champion or unique made of one): ×1 at level 1, rising evenly to ×CREATURE_LIFE.normal
 *    at level 1 + CREATURE_LIFE.ramp, then CREATURE_LIFE.perLevel more a level — the Ash Wolf and the tutorial Maw stay
 *    exactly what they were;
 *  - a boss: ×CREATURE_LIFE.boss (a floor boss lasts a minute or two, D2's pace, not five seconds);
 *  - the Seam Eater keeps its own curve (td-seam seamStats), built on the same boss factor.
 *
 * Hunting XP still follows the AUTHORED life (td-mobs reports life ÷ lifeScale on a kill, as it already reports life ÷
 * the difficulty's), so leveling.md's pace is the authored table's. Pure: no DOM, no imports.
 */

export const CREATURE_LIFE = {
  /** An ordinary creature's life × this from level 1 + ramp. */
  normal: 3,
  /** Levels over which an ordinary creature's factor climbs from ×1 (level 1) to `normal`. */
  ramp: 5,
  /** Past the ramp it keeps climbing this much a level (the Keeper's ranks and power both grow with his level). */
  perLevel: .06,
  /** A boss's life × this (every level). */
  boss: 22,
} as const;

/** The factor a creature of `level` and `rank` rises with over its authored life. */
export function lifeScale(level: number, rank?: string): number {
  if (rank === 'boss') return CREATURE_LIFE.boss;
  const L = Number.isFinite(level) ? Math.max(1, level) : 1;
  return 1 + (CREATURE_LIFE.normal - 1) * Math.min(1, (L - 1) / CREATURE_LIFE.ramp) + CREATURE_LIFE.perLevel * Math.max(0, L - 1 - CREATURE_LIFE.ramp);
}

/** A creature's life at level: its authored life × lifeScale, whole. */
export function livedHp(authored: number, level: number, rank?: string): number {
  return Math.max(1, Math.round(authored * lifeScale(level, rank)));
}
