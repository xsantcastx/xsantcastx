/**
 * storage.service.ts — buying satchel rows and Vault tabs (inventory spec §3).
 *
 * A purchase is two writes, in the Gambler's order: the Gold is spent, then
 * a `storage:*` entitlement is granted on the inventory ledger under the
 * caller's mutation id. A grant that fails to save refunds the Gold. The grant
 * op is idempotent by id and union-merges, so a retry — or a second device
 * that has synced the purchase — replays instead of charging twice.
 *
 * Entitlements live in the inventory ledger, not `economy.upgrades`, so the
 * Eclipse (which clears upgrades) leaves them owned.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { STORAGE_CURVE } from '../economy/economy-curve';
import { InventoryService } from '../rpg/inventory.service';
import {
  SATCHEL_MAX_ROWS,
  SATCHEL_ROW_KEY,
  storageTabKey,
  type VaultTabId,
} from '../rpg/inventory-layout';

export type StorageId = 'satchel-row' | VaultTabId;

export type StorageBuyResult =
  | { ok: true; replayed: boolean }
  | { ok: false; code: 'ssr' | 'unknown' | 'owned' | 'funds' | 'persist' };

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);

  /** Satchel rows bought so far, 0–5. */
  rowsOwned(): number {
    return Math.min(SATCHEL_MAX_ROWS, this.inventory.stackOf(SATCHEL_ROW_KEY));
  }

  owns(tab: VaultTabId): boolean {
    return tab === 'general-1' || tab === 'overflow' || this.inventory.stackOf(storageTabKey(tab)) >= 1;
  }

  /** Gold for the next purchase of `id`, or null when it is maxed, owned or not for sale. */
  priceOf(id: StorageId): number | null {
    if (id === 'satchel-row') return STORAGE_CURVE.satchelRows[this.rowsOwned()] ?? null;
    if (this.owns(id)) return null;
    return STORAGE_CURVE.tabs[id] ?? null;
  }

  buy(id: StorageId, mutationId: string): StorageBuyResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!mutationId) return { ok: false, code: 'unknown' };
    if (this.inventory.hasStackOp(mutationId)) return { ok: true, replayed: true };

    const price = this.priceOf(id);
    if (price === null) {
      return { ok: false, code: id === 'satchel-row' || id in STORAGE_CURVE.tabs ? 'owned' : 'unknown' };
    }
    if (!this.economy.spendGold(price, 'storage')) return { ok: false, code: 'funds' };

    const key = id === 'satchel-row' ? SATCHEL_ROW_KEY : storageTabKey(id);
    if (!this.inventory.grantStack(mutationId, key, 1)) {
      this.economy.earnGold(price, 'storage-refund');
      return { ok: false, code: 'persist' };
    }
    return { ok: true, replayed: false };
  }
}
