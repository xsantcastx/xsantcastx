/**
 * magic-find.service.ts — one number, assembled from four places.
 *
 * Magic Find is read by the anvil on every strike and by every expedition on
 * every return, and it is composed of contributions owned by three different
 * services. Putting the sum here rather than at each call site means there is
 * exactly one definition of what MF is, and adding a fourth source later is one
 * edit rather than a hunt.
 *
 * It is a read-only projection — this service owns no state and writes to
 * nothing, which is why it can safely depend on all three without becoming a
 * cycle risk.
 */
import { Injectable, inject } from '@angular/core';

import { EconomyService } from '../economy/economy.service';
import { InfusionService } from '../enchanting/infusion.service';
import { InventoryService } from './inventory.service';
import { PlayerStatsService } from './player-stats.service';

/**
 * Magic Find granted by an active enchantment.
 *
 * The enchantment catalog predates this system and none of its entries carry a
 * `magicFind` field, so there is nothing to read yet and this is 0. It is a
 * named function rather than an inline zero so that the day an MF enchantment is
 * added, the wiring is already here and the only edit is in the catalog.
 */
export function enchantmentMagicFind(_economy: EconomyService): number {
  return 0;
}

@Injectable({ providedIn: 'root' })
export class MagicFindService {
  private readonly stats = inject(PlayerStatsService);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly infusions = inject(InfusionService);

  /**
   * The visitor's total Magic Find, as a percentage.
   *
   * Luck at 2% a point, plus everything worn in the seven slots — socketed
   * runes and any seated Socket Word included, since `equippedMagicFind` reads
   * the worn total and that total is composed by `wornStats` — plus any
   * enchantment, plus any Void Infusion running at the Enchanting Table.
   * Explorer-worn items are deliberately *not* counted: they apply to that
   * explorer's own rolls through `ExplorerRosterService.lootBonusOf`, and
   * counting them here as well would pay the same charm twice.
   */
  get total(): number {
    const fromLuck = this.stats.magicFind;
    const fromGear = this.inventory.equippedMagicFind;
    const fromEnchantment = enchantmentMagicFind(this.economy);
    const fromInfusion = this.infusions.bonusOn('magicFind');
    const total = fromLuck + fromGear + fromEnchantment + fromInfusion;
    // Guards the drop table against a NaN reaching `mfMultiplier` from a
    // hand-edited blob that slipped past the loaders.
    return Number.isFinite(total) ? Math.max(0, total) : 0;
  }

  /** The four lines, for the panel that shows its working. */
  get breakdown(): {
    luck: number; gear: number; enchantment: number; infusion: number; total: number;
  } {
    const luck = this.stats.magicFind;
    const gear = this.inventory.equippedMagicFind;
    const enchantment = enchantmentMagicFind(this.economy);
    const infusion = this.infusions.bonusOn('magicFind');
    return {
      luck, gear, enchantment, infusion,
      total: Math.max(0, luck + gear + enchantment + infusion),
    };
  }
}
