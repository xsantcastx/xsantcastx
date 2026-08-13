/**
 * rpg-wiring.service.ts — connects stats and equipment to the systems they modify.
 *
 * The same shape as `EconomyWiringService`, and for the same reason: the ledger
 * must not depend on the stat panel, so the two numbers the ledger needs are
 * *pushed* in whenever they change rather than pulled on read.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THE XP MULTIPLIER IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * Wisdom and equipped `xpBonus` are deliberately *not* installed from here.
 * `XpService.setMultiplierSource` replaces its source rather than composing with
 * it — a second caller silently deletes the first — and `EconomyWiringService`
 * is already the one caller, carrying the enchantments, the Mirrorblade, the
 * Relic, the Fragment and the Pro Pack. So the RPG contribution composes inside
 * that existing hook, where the comment on `installHooks` explains the same trap
 * for the Pro Pack.
 *
 * That leaves this service with the two pushes the ledger genuinely owns.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from './inventory.service';
import { PlayerStatsService } from './player-stats.service';
import { ExplorerRosterService } from './explorer-roster.service';

@Injectable({ providedIn: 'root' })
export class RpgWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly stats = inject(PlayerStatsService);
  private readonly inventory = inject(InventoryService);
  private readonly roster = inject(ExplorerRosterService);

  private started = false;

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.economy.init();
    this.stats.init();
    this.inventory.init();
    this.roster.init();

    // Both mirrors are recomputed from scratch on every change to either source,
    // which is cheap (a sum over at most seven worn items) and removes any
    // question of the two staying in step. The setters on EconomyService both
    // return early when the value has not moved, so a burst of publishes costs
    // one write, not one per event.
    this.stats.snapshot$.subscribe(() => this.mirror());
    this.inventory.snapshot$.subscribe(() => this.mirror());
    this.mirror();
  }

  /**
   * Push the flat Gold/sec and the Market discount into the ledger.
   *
   * Gold/sec is the sum of Forge Power's half-a-point and every `goldPerSec` on
   * a worn item. Explorer-worn items are excluded — they pay their wearer's
   * expedition rolls, not the furnace, and counting them here would pay the same
   * item on both sides.
   */
  private mirror(): void {
    const fromStats = this.stats.goldPerSec;
    const fromGear = this.inventory.equippedTotals.goldPerSec;
    this.economy.setRpgFlatGold(fromStats + fromGear);
    this.economy.setPriceMultiplier(this.stats.priceMultiplier);
  }
}
