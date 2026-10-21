/**
 * player-stats.model.ts — the five stats and what a point in each one buys.
 *
 * Every level pays three points and nothing takes them away, so by rank ten a
 * visitor is holding thirty and by the top of the ladder considerably more. The
 * five lines below are the whole of the build: there are no hidden stats, no
 * soft caps and no diminishing returns, because a build you cannot read off a
 * panel is a build nobody makes on purpose.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE EFFECT IS A FUNCTION AND NOT A NUMBER
 * ─────────────────────────────────────────────────────────────────────────────
 * Each definition carries `per`, the effect of one point, *and* `effectOf`,
 * which is the effect of n points. Today every one of them is linear and
 * `effectOf` is a multiply. It is still written as a function because the first
 * stat that needs a cap or a curve should not require a second shape for the
 * panel to read — the bar, the tooltip and the service all ask the definition
 * what n points are worth, and none of them assume the answer is `n * per`.
 *
 * Pure data and pure functions. No browser APIs — safe to import from an SSR
 * path, which the character sheet needs because it prerenders the empty panel.
 */

export type StatId =
  | 'forgePower'
  | 'luck'
  | 'endurance'
  | 'wisdom'
  | 'charisma';

export interface PlayerStats {
  /** +0.5% Gold Find per point (the forge no longer pays by the second: it raises every pile the hunt drops). */
  forgePower: number;
  /** +2% Magic Find per point. */
  luck: number;
  /** +10% max explorer mission duration per point. */
  endurance: number;
  /** +3% XP gain per point. */
  wisdom: number;
  /** -2% Market prices per point. */
  charisma: number;
  /** Points earned and not yet spent. */
  unallocated: number;
}

export interface StatDefinition {
  id: StatId;
  name: string;
  /** How the effect reads on the panel, with `{n}` standing in for the total. */
  unit: string;
  /** What one point buys, in the unit's own terms. */
  per: number;
  /** One line of Eclipse Realms flavour. */
  flavour: string;
  /** Palette colour, from the cosmic table in CLAUDE.md §2. */
  color: string;
  glow: string;
  /** The effect of `points` points. Linear today; see the note above. */
  effectOf: (points: number) => number;
  /** How that effect is written out, e.g. "+4.5% Gold Find". */
  format: (points: number) => string;
}

/** One decimal, but only when there is one — "+5" beats "+5.0". */
function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const STAT_DEFINITIONS: StatDefinition[] = [
  {
    id: 'forgePower',
    name: 'Forge Power',
    unit: '% Gold Find',
    per: 0.5,
    flavour: 'The arm behind the hammer. Every point shakes a little more out of whatever falls, and the piles come up fatter.',
    color: '#e8c898',
    glow: 'rgba(255, 180, 80, 0.6)',
    effectOf: p => p * 0.5,
    format: p => `+${trim(p * 0.5)}% Gold Find`,
  },
  {
    id: 'luck',
    name: 'Luck',
    unit: 'Magic Find',
    per: 2,
    flavour: 'Not a thumb on the scale. A different scale, which happens to be the one the anvil reads.',
    color: '#7fd5a3',
    glow: 'rgba(100, 220, 150, 0.6)',
    effectOf: p => p * 2,
    format: p => `+${trim(p * 2)}% Magic Find`,
  },
  {
    id: 'endurance',
    name: 'Endurance',
    unit: 'expedition haul',
    per: 10,
    flavour: 'Explorers do not walk faster for you. They simply stop turning back.',
    color: '#ff9a5a',
    glow: 'rgba(255, 140, 60, 0.6)',
    effectOf: p => p * 10,
    format: p => `+${trim(p * 10)}% expedition haul`,
  },
  {
    id: 'wisdom',
    name: 'Wisdom',
    unit: 'XP',
    per: 3,
    flavour: 'The Archivum insists this is not the same thing as having read the book. The Archivum is outvoted.',
    color: '#a48bff',
    glow: 'rgba(140, 110, 255, 0.6)',
    effectOf: p => p * 3,
    format: p => `+${trim(p * 3)}% XP`,
  },
  {
    id: 'charisma',
    name: 'Charisma',
    unit: 'Market prices',
    per: 2,
    flavour: 'The Market does not like you. It has simply concluded that arguing costs more than the discount.',
    color: '#ff6dd7',
    glow: 'rgba(255, 90, 210, 0.6)',
    effectOf: p => p * 2,
    format: p => `−${trim(p * 2)}% Market prices`,
  },
];

export const STAT_BY_ID = new Map(STAT_DEFINITIONS.map(s => [s.id, s]));

/** The five ids, in panel order. */
export const STAT_IDS: StatId[] = STAT_DEFINITIONS.map(s => s.id);

/** Points granted per level. Three, so a level is always a real decision. */
export const POINTS_PER_LEVEL = 3;

/**
 * The floor of a respec's price. A respec costs max(this, ten minutes of the
 * Keeper's hunt) — `respecCostFor`, fed the hunt's rate at the Keeper's level
 * (economy-curve huntRate; the forge pays nothing by the second) — so it stays
 * a small decision at every level and a build is still cheap to regret:
 * 250 Gold at level 1, ~1.3k at 10, ~5.8k at 40, ~20k at 100.
 */
export const RESPEC_COST = 250;
/** Seconds of the Keeper's hunt a respec costs once that exceeds the floor. */
export const RESPEC_INCOME_SECONDS = 600;

/** What a respec costs right now, given the hunt's Gold/sec at the Keeper's level. */
export function respecCostFor(goldPerSecond: number): number {
  const gps = Number.isFinite(goldPerSecond) ? Math.max(0, goldPerSecond) : 0;
  return Math.max(RESPEC_COST, Math.ceil(gps * RESPEC_INCOME_SECONDS));
}

/**
 * The floor on Market prices after Charisma.
 *
 * Fifty points of Charisma would otherwise make everything free and the
 * hundredth would make it pay you. A 75% discount is already the strongest
 * single-stat payoff in the game; past that the Market stops being a sink and
 * the economy has no bottom.
 */
export const MIN_PRICE_MULTIPLIER = 0.25;

export function emptyStats(): PlayerStats {
  return {
    forgePower: 0,
    luck: 0,
    endurance: 0,
    wisdom: 0,
    charisma: 0,
    unallocated: 0,
  };
}

/** Points actually spent across the five stats. */
export function spentPoints(stats: PlayerStats): number {
  return STAT_IDS.reduce((sum, id) => sum + stats[id], 0);
}

/** Everything ever earned — spent plus banked. Drives the "of N" on the panel. */
export function totalPoints(stats: PlayerStats): number {
  return spentPoints(stats) + stats.unallocated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived effects
// ─────────────────────────────────────────────────────────────────────────────

/** Forge Power's Gold Find, in percent on every pile the hunt drops. */
export function forgePowerGold(stats: PlayerStats): number {
  return STAT_BY_ID.get('forgePower')!.effectOf(stats.forgePower);
}

/** Magic Find percentage from Luck alone. Equipment adds to this elsewhere. */
export function luckMagicFind(stats: PlayerStats): number {
  return STAT_BY_ID.get('luck')!.effectOf(stats.luck);
}

/** Expedition haul (payout) multiplier from Endurance. 1.0 at zero points. */
export function enduranceMultiplier(stats: PlayerStats): number {
  return 1 + STAT_BY_ID.get('endurance')!.effectOf(stats.endurance) / 100;
}

/** XP multiplier from Wisdom. 1.0 at zero points. */
export function wisdomMultiplier(stats: PlayerStats): number {
  return 1 + STAT_BY_ID.get('wisdom')!.effectOf(stats.wisdom) / 100;
}

/**
 * Market price multiplier from Charisma, floored.
 *
 * Returns a number to multiply a price by, so a caller that forgets the floor
 * cannot reintroduce the free-shop bug — the clamp lives here, once.
 */
export function charismaPriceMultiplier(stats: PlayerStats): number {
  const raw = 1 - STAT_BY_ID.get('charisma')!.effectOf(stats.charisma) / 100;
  return Math.max(MIN_PRICE_MULTIPLIER, raw);
}
