/**
 * temper-feedback.ts — what a temper changed, and how loud the anvil rings.
 *
 * `InventoryService.upgrade()` returns the stored post-temper item; the Inspect
 * panel captures the stats before the call and hands both to `temperDeltas`
 * to print "Strike 2 → 2.12 (+0.12)" rows. `applyTemperBonus` guarantees every
 * rollKey visibly increases on a success, so the list is never empty when
 * `leveled` is true — "it worked, and here is exactly what changed".
 *
 * `temperCue` picks the anvil's pitch off the item's rarity, the same table the
 * Rune Forge pull uses, so a Rare piece rings the way a Rare rune does. Nothing
 * here plays audio or reads the ledger; the panel does both.
 *
 * Pure. No Angular imports, no browser APIs — safe on an SSR path.
 */
import {
  ITEM_STAT_KEYS,
  ITEM_STAT_LABELS,
  type ItemRarity,
  type ItemStats,
} from '../rpg/item.model';
import { RUNE_TIERS, RUNE_TIER_ORDER } from '../rune-forge/rune.model';

export interface TemperDelta {
  key: keyof ItemStats;
  before: number;
  after: number;
  /** `after − before`, rounded to two decimals so 0.12000000000000011 never prints. */
  delta: number;
  label: string;
}

/**
 * One row per stat that moved, in `ITEM_STAT_KEYS` order. A key absent on
 * either side is skipped: a temper never adds or removes a stat, so a missing
 * key is a stat the item does not roll, not a change.
 */
export function temperDeltas(before: ItemStats, after: ItemStats): TemperDelta[] {
  const rows: TemperDelta[] = [];
  for (const key of ITEM_STAT_KEYS) {
    const a = before[key];
    const b = after[key];
    if (a == null || b == null || a === b) continue;
    rows.push({
      key,
      before: a,
      after: b,
      delta: Math.round((b - a) * 100) / 100,
      label: ITEM_STAT_LABELS[key],
    });
  }
  return rows;
}

/**
 * How the anvil rings for a piece of this rarity: the tier's semitone offset,
 * and whether the reveal earns the sub-bass voice (epic and above — the same
 * threshold as `rune-forge/rune-haul.ts`'s `isHeavyTier`, written out here so
 * the entity folder does not reach into the forge for a one-liner).
 */
export function temperCue(rarity: ItemRarity): { semitones: number; heavy: boolean } {
  const tier = RUNE_TIERS[rarity] ?? RUNE_TIERS.common;
  const heavy = RUNE_TIER_ORDER.indexOf(tier.id) >= RUNE_TIER_ORDER.indexOf('epic');
  return { semitones: tier.semitones, heavy };
}
