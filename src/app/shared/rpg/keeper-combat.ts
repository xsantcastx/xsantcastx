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

export function keeperCombatStats(totals: Pick<ItemStats, 'strikePower' | 'ward'>): KeeperCombatStats {
  const strike = finite(totals.strikePower);
  const ward = finite(totals.ward);
  return {
    damage: Math.min(MAX_DAMAGE, UNARMED_DAMAGE + Math.round(strike * DAMAGE_PER_STRIKE)),
    maxHp: Math.min(MAX_HP_CAP, BASE_MAX_HP + Math.round(ward * HP_PER_WARD)),
  };
}
