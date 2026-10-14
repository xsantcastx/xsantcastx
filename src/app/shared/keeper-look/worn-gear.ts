/**
 * worn-gear.ts — the player's equipped items → the painter's gear layers.
 *
 * Kept apart from keeper-gear.ts so that file stays import-free (it is pure
 * rules + math); this one reads item definitions for each piece's realm style.
 * Items worn by an explorer are not on the Keeper and are skipped.
 */
import type { GameItem, SlotId } from '../rpg/item.model';
import { definitionFor } from '../rpg/item-definition';
import { GEAR_SLOTS, KeeperGear, gearPiece } from './keeper-gear';

export function wornGear(equipped: Partial<Record<SlotId, GameItem>>): KeeperGear {
  const gear: KeeperGear = {};
  for (const slot of GEAR_SLOTS) {
    const item = equipped[slot as SlotId];
    if (!item || item.explorerId) continue;
    const def = definitionFor(item);
    gear[slot] = gearPiece(slot, `${item.name} ${item.definitionId ?? ''}`, def?.style, item.rarity);
  }
  return gear;
}
