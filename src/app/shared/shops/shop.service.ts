/**
 * shop.service.ts — buying from a shop's shelf and selling back to it (docs/design/shops.md). Gold only.
 *
 * Every buy is replay-safe on its press id: a stack is one `shop:buy:<press>` grant, a potion PotionService.buy, an
 * item a mint whose id is the press's (`shop-<press>`), so a retried press finds what it already made and charges
 * nothing twice. Every write checks the purse first and spends in the same tick. Selling a stack is one consume op
 * (`shop:sell:<press>`) then the Gold; selling an item is InventoryService.sell (its tombstone, then the Gold).
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { mintEquipment } from '../rpg/item-definition';
import type { GameItem } from '../rpg/item.model';
import { PotionService } from '../potions/potion.service';
import { FishingService } from '../fishing/fishing.service';
import { seededRandom, hashSeed } from '../loot/champions';
import { SpellstoneService } from '../spellstones/spellstone.service';
import { WaygateScrollService } from '../waygate/waygate-scroll.service';
import { buyPriceOf, offerById, offerPrice, SHOPS, type ShopId, type ShopOffer } from './shops.model';

export type ShopBuyCode = 'ok' | 'replayed' | 'unknown' | 'funds' | 'room' | 'skill' | 'failed' | 'ssr';
export type ShopSellCode = 'ok' | 'unknown' | 'refused' | 'worn' | 'failed' | 'ssr';

@Injectable({ providedIn: 'root' })
export class ShopService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly potions = inject(PotionService);
  private readonly fishing = inject(FishingService);
  private readonly stones = inject(SpellstoneService);
  private readonly scrolls = inject(WaygateScrollService);

  /** The Keeper's level, for the level-priced specials. */
  get level(): number { return this.economy.rewardLevel; }
  priceOf(offer: ShopOffer): number { return offerPrice(offer, this.level); }

  init(): void {
    if (!this.browser) return;
    this.economy.init();
    this.inventory.init();
  }

  /** Why an offer cannot be bought right now (null: it can). */
  blocker(offer: ShopOffer, n = 1): ShopBuyCode | null {
    if (!this.browser) return 'ssr';
    if (offer.kind === 'stack' && offer.skill && this.skillLevel(offer.skill.id) < offer.skill.level) return 'skill';
    if (this.economy.snapshot.gold < this.priceOf(offer) * n) return 'funds';
    if (offer.kind === 'item' && !this.inventory.canAcceptInstance()) return 'room';
    return null;
  }

  /** Buy `n` of an offer (an item: one). `pressId` names the press. */
  buy(offerId: string, n: number, pressId: string): { code: ShopBuyCode; item?: GameItem } {
    if (!this.browser) return { code: 'ssr' };
    this.init();
    const found = offerById(offerId);
    if (!found || !pressId) return { code: 'unknown' };
    const offer = found.offer;
    const count = offer.kind === 'item' ? 1 : Math.max(1, Math.min(99, Math.floor(n)));
    if (offer.kind === 'potion') {
      const code = this.potions.buy(offer.key, count, `shop:${pressId}`);
      return { code: code === 'ok' ? 'ok' : code === 'replayed' ? 'replayed' : code === 'funds' ? 'funds' : code === 'ssr' ? 'ssr' : 'failed' };
    }
    if (offer.kind === 'special') {
      const code = offer.key === 'basalt-blank' ? this.stones.buyBlanks(count, this.level, `shop:${pressId}`) : this.scrolls.buyWaygateScrolls(count, this.level, `shop:${pressId}`);
      return { code: code === 'ok' ? 'ok' : code === 'replayed' ? 'replayed' : code === 'funds' ? 'funds' : code === 'ssr' ? 'ssr' : 'failed' };
    }
    const grantId = `shop:buy:${pressId}`;
    if (offer.kind === 'stack') {
      if (this.inventory.hasStackOp(grantId)) return { code: 'replayed' };
      const blocked = this.blocker(offer, count);
      if (blocked) return { code: blocked };
      const total = this.priceOf(offer) * count;
      if (!this.inventory.grantStack(grantId, offer.key, count)) return { code: 'failed' };
      if (!this.economy.spendGold(total, grantId)) {
        this.inventory.consumeStacks(`${grantId}:undo`, [{ id: offer.key, count }]);
        return { code: 'failed' };
      }
      return { code: 'ok' };
    }
    // An item: minted with the press's id, so a replay finds it.
    const id = `shop-${pressId}`;
    const already = this.inventory.itemById(id);
    if (already) return { code: 'replayed', item: already };
    const blocked = this.blocker(offer);
    if (blocked) return { code: blocked };
    const minted = mintEquipment(offer.key, 'common', seededRandom(hashSeed(`shop|${pressId}`)), new Date().toISOString(), id, offer.level);
    if (!minted) return { code: 'unknown' };
    const item: GameItem = offer.sockets ? { ...minted, sockets: Array.from({ length: offer.sockets }, () => null) } : minted;
    if (!this.inventory.canPickUp(item)) return { code: 'room' };
    const price = this.priceOf(offer);
    if (!this.economy.spendGold(price, grantId)) return { code: 'funds' };
    const landed = this.inventory.add(item);
    if (!landed) { this.economy.earnGold(price, `${grantId}:refund`); return { code: 'failed' }; }
    return { code: 'ok', item: landed };
  }

  /** What this shop pays for one of a satchel stack (0: it does not buy it). */
  stackOffer(shop: ShopId, stackKey: string): number { return buyPriceOf(shop, stackKey); }

  /** What this shop pays for an item (0: it does not buy it). */
  itemOffer(shop: ShopId, item: GameItem): number {
    if (!SHOPS[shop].buysGear || !this.inventory.canSell(item)) return 0;
    return item.sellValue;
  }

  /** Sell `qty` of a satchel stack. */
  sellStack(shop: ShopId, stackKey: string, qty: number, pressId: string): { code: ShopSellCode; gold: number } {
    if (!this.browser) return { code: 'ssr', gold: 0 };
    this.init();
    const unit = buyPriceOf(shop, stackKey);
    if (unit <= 0) return { code: 'refused', gold: 0 };
    const n = Math.min(Math.floor(qty), this.inventory.stackOf(stackKey));
    if (!(n >= 1)) return { code: 'unknown', gold: 0 };
    const taken = this.inventory.consumeStacks(`shop:sell:${pressId}`, [{ id: stackKey, count: n }]);
    if (!taken.ok) return { code: 'failed', gold: 0 };
    if (taken.replayed) return { code: 'ok', gold: 0 };
    this.economy.earnGold(unit * n, `shop:${shop}`);
    return { code: 'ok', gold: unit * n };
  }

  /** Sell a satchel item. */
  sellItem(shop: ShopId, itemId: string): { code: ShopSellCode; gold: number } {
    if (!this.browser) return { code: 'ssr', gold: 0 };
    this.init();
    const item = this.inventory.itemById(itemId);
    if (!item) return { code: 'unknown', gold: 0 };
    if (item.equipped || item.explorerId) return { code: 'worn', gold: 0 };
    if (this.itemOffer(shop, item) <= 0) return { code: 'refused', gold: 0 };
    const gold = this.inventory.sell(itemId);
    return gold > 0 ? { code: 'ok', gold } : { code: 'failed', gold: 0 };
  }

  private skillLevel(_id: 'fishing'): number {
    try { return this.fishing.level(); } catch { return 1; }
  }
}
