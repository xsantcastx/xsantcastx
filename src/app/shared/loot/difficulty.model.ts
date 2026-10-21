/**
 * difficulty.model.ts — Normal, Nightmare, Hell (docs/design/loot-and-combat.md §8).
 *
 * D2's three passes over the same world. Each tier makes every creature
 * tougher and harder-hitting, puts a penalty on the Keeper's resists, and pays
 * for it with better drops: more items, a shift up the rarity ladder, and a
 * higher rune ceiling (the best runes only ever drop in Hell).
 *
 * A tier unlocks once its gate boss falls on the tier below: the Fallen
 * Ephemeris, at the bottom of the Orrery Wells, is the end of a pass. The
 * Keeper can always step back down to an easier tier.
 *
 * Pure: imports only types.
 */
import type { RuneTier } from '../rune-forge/rune.model';

export type DifficultyTier = 'normal' | 'nightmare' | 'hell';
export const DIFFICULTY_TIERS: readonly DifficultyTier[] = ['normal', 'nightmare', 'hell'];

export interface DifficultyDef {
  id: DifficultyTier;
  /** Creature HP and damage multipliers. */
  hp: number;
  damage: number;
  /** Added to every creature's level (drop quality, rune ceiling, damage curve). */
  level: number;
  /** Taken off every Keeper resist (D2: 0 / -40 / -100). */
  resistPenalty: number;
  /** Added to every creature resist (points; a resist that reaches 100 is an immunity). */
  creatureResist: number;
  /** Multiplies every item drop chance. */
  itemChance: number;
  /** Shifts the rarity roll up the ladder (each step multiplies the rare+ weights). */
  rarityShift: number;
  /** The best rune tier that can drop from a creature here. */
  runeCap: RuneTier;
  /** Share of the purse a fall drops where the Keeper fell (the corpse run). */
  deathShare: number;
  /** The boss whose fall on this tier unlocks the next one (null on Hell). */
  gate: string | null;
  /** The tier's beam colour on the Loot & Combat sheet (an art-bible ramp). */
  color: string;
}

export const GATE_BOSS = 'fallen-ephemeris';

export const DIFFICULTIES: Readonly<Record<DifficultyTier, DifficultyDef>> = {
  normal: {
    id: 'normal', hp: 1, damage: 1, level: 0, resistPenalty: 0, creatureResist: 0,
    itemChance: 1, rarityShift: 0, runeCap: 'rare', deathShare: 0.05, gate: GATE_BOSS, color: '#f2e6d0',
  },
  nightmare: {
    id: 'nightmare', hp: 2.5, damage: 2, level: 20, resistPenalty: 40, creatureResist: 15,
    itemChance: 1.35, rarityShift: 1, runeCap: 'legendary', deathShare: 0.10, gate: GATE_BOSS, color: '#a855f7',
  },
  hell: {
    id: 'hell', hp: 4, damage: 3, level: 40, resistPenalty: 100, creatureResist: 30,
    itemChance: 1.7, rarityShift: 2, runeCap: 'singular', deathShare: 0.15, gate: null, color: '#ff6a3d',
  },
};

export function difficultyOf(tier: DifficultyTier | string | null | undefined): DifficultyDef {
  return DIFFICULTIES[(tier as DifficultyTier)] ?? DIFFICULTIES.normal;
}

export function isDifficulty(value: unknown): value is DifficultyTier {
  return value === 'normal' || value === 'nightmare' || value === 'hell';
}

/** The tier after this one, or null at Hell. */
export function nextTier(tier: DifficultyTier): DifficultyTier | null {
  const i = DIFFICULTY_TIERS.indexOf(tier);
  return i >= 0 && i < DIFFICULTY_TIERS.length - 1 ? DIFFICULTY_TIERS[i + 1] : null;
}

/** The tier a gate boss's fall on `tier` unlocks (null when that creature is no gate, or at Hell). */
export function unlockedBy(creature: string, tier: DifficultyTier): DifficultyTier | null {
  return DIFFICULTIES[tier].gate === creature ? nextTier(tier) : null;
}

/**
 * Gold a fall leaves where the Keeper fell (the corpse run): the tier's share of
 * the purse, floored. Nothing else is ever lost: no item, no rune, no stack.
 */
export function deathCost(purse: number, tier: DifficultyTier, scale = 1): number {
  if (!(purse > 0)) return 0;
  // `scale`: what the Hearth Blessings leave of it (shared/hearth/hearth-rules.ts fallScale), 1 with none.
  const k = Number.isFinite(scale) ? Math.max(0, Math.min(1, scale)) : 1;
  return Math.floor(purse * DIFFICULTIES[tier].deathShare * k);
}
