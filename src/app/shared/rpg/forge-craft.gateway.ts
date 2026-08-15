/**
 * forge-craft.gateway.ts — C9 sole writer of Basalt Edge craft.
 *
 * Inventory consumes and mints. Activity marks first-craft complete so
 * Mining drops the Ember guarantee. Templates do not write either ledger.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { InventoryService } from './inventory.service';
import type { GameItem } from './item.model';

export type ForgeCraftReject = 'ssr' | 'clock' | 'missing' | 'capacity' | 'persist';

export type ForgeCraftResult =
  | { ok: true; item: GameItem; replayed: boolean }
  | { ok: false; code: ForgeCraftReject };

@Injectable({ providedIn: 'root' })
export class ForgeCraftGateway {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly activity = inject(ActivityProgressionGateway);

  init(): void {
    if (!this.isBrowser) return;
    this.inventory.init();
    this.activity.init();
  }

  missing() {
    return this.inventory.missingCraftInputs();
  }

  craftBasaltEdge(mutationId: string, now = Date.now()): ForgeCraftResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    this.init();
    const result = this.inventory.craftBasaltEdge(mutationId, now);
    if (!result.ok) return result;
    if (!this.activity.markCraftedBasaltEdge()) {
      return { ok: false, code: 'persist' };
    }
    return result;
  }
}
