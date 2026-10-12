/**
 * material-vendor.service.ts — wires the vendor's pure sale routine to the two
 * real ledgers.
 *
 * Economy v3: the Vendor is a buyback counter (a sink), not a shop — see
 * material-vendor.model.ts. Goods leave through `InventoryService.consumeStacks`
 * under `vendor-sell:<mutationId>`, which is idempotent by that id across
 * reloads and devices; Gold comes in through `EconomyService.earnGold`, the one
 * mint, which records the credit op the cloud merge replays.
 *
 * Browser-only, like its neighbours: on the server every sale is refused.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { sellToVendor, type VendorIntent, type VendorLedger, type VendorReceipt } from './material-vendor.model';

/** Settled receipts kept for replay. Old ones fall off; a mutation id is minted per click. */
const SETTLED_MAX = 64;

@Injectable({ providedIn: 'root' })
export class MaterialVendorService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly settled = new Map<string, VendorReceipt>();

  private readonly ledger: VendorLedger = {
    held: materialId => this.inventory.stackOf(materialId),
    consume: (mutationId, materialId, quantity) => {
      const result = this.inventory.consumeStacks(mutationId, [{ id: materialId, count: quantity }]);
      return result.ok ? { ok: true, replayed: result.replayed } : { ok: false, replayed: false };
    },
    payGold: (amount, reason) => { this.economy.earnGold(amount, reason); },
  };

  init(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.inventory.init();
  }

  sell(intent: VendorIntent): VendorReceipt {
    if (!this.isBrowser) {
      return { ok: false, code: 'unknown', mutationId: intent.mutationId, materialId: intent.materialId, quantity: 0, total: 0, consumeId: '' };
    }
    this.init();
    const receipt = sellToVendor(this.ledger, intent, this.settled);
    while (this.settled.size > SETTLED_MAX) {
      const oldest = this.settled.keys().next().value;
      if (oldest === undefined) break;
      this.settled.delete(oldest);
    }
    return receipt;
  }
}
