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
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { ChapterGateway } from '../narrative/chapter.gateway';

@Injectable({ providedIn: 'root' })
export class RpgWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly stats = inject(PlayerStatsService);
  private readonly inventory = inject(InventoryService);
  private readonly roster = inject(ExplorerRosterService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly chapters = inject(ChapterGateway);

  private started = false;

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.economy.init();
    this.stats.init();
    this.inventory.init();
    this.roster.init();
    this.activity.init();
    this.chapters.init();

    // Recompute from scratch on every source publish. Cheap (a sum over the
    // worn items) and keeps the two ledgers in step. Economy merge still
    // maxes persisted rpgFlatGold — a device that last wrote the pre-C5
    // charm bonus would otherwise keep paying it after inventory bagged the
    // charm.
    //
    // Attach walks STATE_ENTRIES with economy before inventory. Mirror
    // inventory synchronously; defer the economy remirror a microtask so
    // a same-tick inventory rehydrate/retire is visible before we write
    // rpgFlatGold. A later inventory-only snapshot still remirrors now.
    this.stats.snapshot$.subscribe(() => this.mirror());
    this.inventory.snapshot$.subscribe(() => this.mirror());
    this.economy.snapshot$.subscribe(() => {
      queueMicrotask(() => this.mirror());
    });
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
