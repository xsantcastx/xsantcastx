/**
 * loot-tiers.ts — how loud each rung of the ladder is on the ground (docs/design/loot-and-combat.md §2).
 *
 * The game has ONE rarity ladder (rune.model.ts RUNE_TIERS, shared by runes,
 * items, charms and achievements). This file does not fork it: it maps each
 * rung onto its Diablo reading and says how a drop of that rung announces
 * itself — beam height and brightness, sparkles, a sound, an edge pip.
 *
 *   common     white-grey   D2 "normal"       no beam (a glint), no sound
 *   uncommon   sage         D2 "magic"         short beam
 *   rare       blue         D2 "rare/magic+"   beam, sparkles, a chime, edge pip
 *   epic       purple       D4 "rare/purple"   taller, brighter, a horn
 *   legendary  gold         D2 "unique"        tall gold column, the legendary chime
 *   mythic     white-gold   D2 "set/ancient"   taller still, an impact
 *   singular   void pink    runeword-grade     the tallest, everything
 *
 * A unique (a named object, unique-items.ts) drops at its authored rarity and
 * is flagged on top: a crown sparkle and a double ring, so a gold beam that is
 * a NAME reads differently from a gold beam that is a roll.
 *
 * Pure: imports only types.
 */
import type { RuneTier } from '../rune-forge/rune.model';

export type LootTier = RuneTier;
export const LOOT_TIER_ORDER: readonly LootTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];

export type LootSfx = 'drop-magic' | 'drop-rare' | 'drop-epic' | 'drop-legendary' | 'drop-mythic';

export interface LootTierFx {
  tier: LootTier;
  /** The Diablo name the design doc maps the rung to. */
  d2: string;
  /** Beam height multiplier (1 = the base column) and peak alpha. */
  beam: number;
  alpha: number;
  /** Pixel sparkles orbiting the drop (0 = none). */
  sparkles: number;
  /** The drop's landing sound (none for common). */
  sfx: LootSfx | null;
  /** Off-screen drops of this rung show an edge pip. */
  pip: boolean;
}

export const LOOT_TIER_FX: Readonly<Record<LootTier, LootTierFx>> = {
  common: { tier: 'common', d2: 'Normal', beam: 0, alpha: 0, sparkles: 0, sfx: null, pip: false },
  uncommon: { tier: 'uncommon', d2: 'Magic', beam: 0.6, alpha: 0.35, sparkles: 0, sfx: 'drop-magic', pip: false },
  rare: { tier: 'rare', d2: 'Rare', beam: 1, alpha: 0.5, sparkles: 3, sfx: 'drop-rare', pip: true },
  epic: { tier: 'epic', d2: 'Rare (purple)', beam: 1.35, alpha: 0.6, sparkles: 5, sfx: 'drop-epic', pip: true },
  legendary: { tier: 'legendary', d2: 'Unique (gold)', beam: 1.8, alpha: 0.72, sparkles: 7, sfx: 'drop-legendary', pip: true },
  mythic: { tier: 'mythic', d2: 'Set / Ancient', beam: 2.2, alpha: 0.8, sparkles: 9, sfx: 'drop-mythic', pip: true },
  singular: { tier: 'singular', d2: 'Runeword-grade', beam: 2.6, alpha: 0.9, sparkles: 12, sfx: 'drop-mythic', pip: true },
};

export function tierRank(tier: LootTier | null | undefined): number {
  return tier ? LOOT_TIER_ORDER.indexOf(tier) : -1;
}

/**
 * The loot filter (Menu → Loot & Combat). 'all' shows everything; 'hide-common'
 * hides the glint, label and edge pip of common drops; 'rare-plus' hides
 * uncommon too. The filter hides clutter, never loot: coins always show, and a
 * hidden drop walked over is still collected.
 */
export type LootFilter = 'all' | 'hide-common' | 'rare-plus';
export const LOOT_FILTERS: readonly LootFilter[] = ['all', 'hide-common', 'rare-plus'];

export function isLootFilter(value: unknown): value is LootFilter {
  return value === 'all' || value === 'hide-common' || value === 'rare-plus';
}

/**
 * Whether a drop shows under a filter. `tier` undefined = an untiered drop
 * (coins, a plain material): it counts as common. Coins always show.
 */
export function shownUnderFilter(tier: LootTier | undefined, filter: LootFilter, coins = false): boolean {
  if (coins || filter === 'all') return true;
  const rank = tierRank(tier ?? 'common');
  return filter === 'hide-common' ? rank >= 1 : rank >= 2;
}
