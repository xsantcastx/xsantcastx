/**
 * material-vendor.service.ts — wires the vendor's pure purchase routine to the
 * two real ledgers.
 *
 * Gold goes out through `EconomyService.spendGold` — the same door the Rune
 * Forge, the Gambler and the Exchange use for a price they set themselves. It
 * records the `spend-gold` op the cloud merge replays and flushes before
 * returning, so the debit survives the tab closing a frame later. Materials
 * come in through `InventoryService.grantStack` under `vendor:<mutationId>`,
 * which is idempotent by that id across reloads and devices.
 *
 * Why not `EconomyService.purchaseListing` (the Market's receipted door)? It
 * prices and grants only its own catalogue kinds (upgrade, enchantment,
 * artifact, cosmetic) from inside the economy blob; a material is an inventory
 * stack it cannot deliver. Teaching it a new kind is an economy rule change.
 * The double-submit guard here is the `settled` map: a mutation id that already
 * bought returns its receipt and touches nothing.
 *
 * Browser-only, like its neighbours: on the server every purchase is refused.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { buyFromVendor, type VendorIntent, type VendorLedger, type VendorReceipt } from './material-vendor.model';

/** Settled receipts kept for replay. Old ones fall off; a mutation id is minted per click. */
const SETTLED_MAX = 64;

@Injectable({ providedIn: 'root' })
export class MaterialVendorService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly settled = new Map<string, VendorReceipt>();

  private readonly ledger: VendorLedger = {
    gold: () => this.economy.snapshot.gold,
    spendGold: (amount, reason) => this.economy.spendGold(amount, reason),
    refundGold: (amount, reason) => { this.economy.earnGold(amount, reason); },
    canAccept: materialId => this.inventory.canAcceptStackGrant(materialId),
    grantStack: (grantId, materialId, quantity) => this.inventory.grantStack(grantId, materialId, quantity),
  };

  init(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.inventory.init();
  }

  buy(intent: VendorIntent): VendorReceipt {
    if (!this.isBrowser) {
      return { ok: false, code: 'unknown', mutationId: intent.mutationId, materialId: intent.materialId, quantity: 0, total: 0, grantId: '' };
    }
    this.init();
    const receipt = buyFromVendor(this.ledger, intent, this.settled);
    while (this.settled.size > SETTLED_MAX) {
      const oldest = this.settled.keys().next().value;
      if (oldest === undefined) break;
      this.settled.delete(oldest);
    }
    return receipt;
  }
}
