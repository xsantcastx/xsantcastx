/**
 * keeper-combat.ts — how the worn loadout turns into Seamworks combat numbers.
 *
 * The side-scroller hit for a hard-coded 10, or 20 with the Basalt Edge worn,
 * whatever the Edge rolled or was tempered to and whatever else was worn. Gear
 * now pays out in the fight through two stats the loadout already sums:
 *
 *   damage = 10 + round(strikePower × 10)   floor 10 (unarmed), cap 60
 *   maxHp  = 100 + round(ward × 10)          floor 100, cap 250
 *
 * k = 10 because the Basalt Edge rolls strikePower ~0.85–1.15 at Uncommon, so a
 * fresh Edge still lands 18–22 — the ~20 the tutorial was tuned around — and a
 * Rivet Maw (60 HP) still takes three swings. Tempering and better weapons cut
 * that to two, then one at the cap; 60 is one Maw, so nothing above it means
 * anything. Ward is the mitigation stat, and more health is the honest
 * side-scroller reading of it until there is a damage-reduction model.
 */
import type { ItemStats } from './item.model';

export const UNARMED_DAMAGE = 10;
export const DAMAGE_PER_STRIKE = 10;
export const MAX_DAMAGE = 60;
export const BASE_MAX_HP = 100;
export const HP_PER_WARD = 10;
export const MAX_HP_CAP = 250;

export interface KeeperCombatStats {
  damage: number;
  maxHp: number;
}

function finite(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * The Hunting level is the Keeper's character level in a fight (D2's clvl;
 * docs/design/loot-and-combat.md §8): each level past the first adds
 * HUNT_DAMAGE_PER_LEVEL of damage and HUNT_HP_PER_LEVEL health ON TOP of the
 * gear caps above. Level 1 adds nothing, so a fresh Keeper is unchanged; a
 * level-99 hunter hits about half again as hard and has about 200 more health,
 * which is what Nightmare and Hell are tuned against (economy-sim --combat).
 */
export const HUNT_DAMAGE_PER_LEVEL = 0.005;
export const HUNT_HP_PER_LEVEL = 2;
/** The hunting bonus stops growing here (uncapped skill levels keep going; the fight does not). */
export const HUNT_LEVEL_CAP = 99;

export function keeperCombatStats(totals: Pick<ItemStats, 'strikePower' | 'ward'>, huntingLevel = 1): KeeperCombatStats {
  const strike = finite(totals.strikePower);
  const ward = finite(totals.ward);
  const over = Math.max(0, Math.min(HUNT_LEVEL_CAP, Math.floor(Number.isFinite(huntingLevel) ? huntingLevel : 1)) - 1);
  return {
    damage: Math.round(Math.min(MAX_DAMAGE, UNARMED_DAMAGE + Math.round(strike * DAMAGE_PER_STRIKE)) * (1 + over * HUNT_DAMAGE_PER_LEVEL)),
    maxHp: Math.min(MAX_HP_CAP, BASE_MAX_HP + Math.round(ward * HP_PER_WARD)) + over * HUNT_HP_PER_LEVEL,
  };
}
