/**
 * waygate-scroll.service.ts — buying and reading the Waygate Scroll (waygate-scroll.ts). The satchel holds the stack
 * (InventoryService); the purse pays (EconomyService). Reading spends one only after the portal opened.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { InventoryService } from '../rpg/inventory.service';
import { EconomyService } from '../economy/economy.service';
import { WAYGATE_SCROLL_ID, waygateScrollPrice } from './waygate-scroll';

export type ScrollBuyCode = 'ok' | 'replayed' | 'funds' | 'failed' | 'unknown' | 'ssr';

@Injectable({ providedIn: 'root' })
export class WaygateScrollService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private seq = 0;

  /** Scrolls held. */
  get held(): number { return this.isBrowser ? this.inventory.stackOf(WAYGATE_SCROLL_ID) : 0; }

  /** Edrin Kade's counter: `n` scrolls for Gold, at the Keeper's level's price. Idempotent per press. */
  buyWaygateScrolls(n: number, level: number, pressId: string): ScrollBuyCode {
    if (!this.isBrowser) return 'ssr';
    const count = Math.floor(n);
    if (!(count >= 1)) return 'unknown';
    const grantId = `waygate:scroll:${pressId}`;
    if (this.inventory.hasStackOp(grantId)) return 'replayed';
    const total = waygateScrollPrice(level) * count;
    if (this.economy.snapshot.gold < total) return 'funds';
    if (!this.inventory.grantStack(grantId, WAYGATE_SCROLL_ID, count)) return 'failed';
    if (!this.economy.spendGold(total, grantId)) {
      this.inventory.consumeStacks(`${grantId}:undo`, [{ id: WAYGATE_SCROLL_ID, count }]);
      return 'failed';
    }
    return 'ok';
  }

  /**
   * Read one: `open` opens the portal (the engine's openWaygate) and says why not; the scroll is spent only when it
   * opened. Returns the refusal, 'none' when no scroll is held, or null when it worked.
   */
  read<T extends string>(open: () => T | null): T | 'none' | null {
    if (this.held < 1) return 'none';
    const why = open();
    if (why) return why;
    this.inventory.consumeStacks(`waygate:read:${Date.now().toString(36)}:${++this.seq}`, [{ id: WAYGATE_SCROLL_ID, count: 1 }]);
    return null;
  }
}
