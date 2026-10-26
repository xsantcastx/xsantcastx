/**
 * shops.spec.ts — the district shops (docs/design/shops.md): every offer is a real thing priced off the economy curve,
 * buying and selling is never a Gold loop, and a buy or a sale is one replay-safe write.
 */
import { TestBed } from '@angular/core/testing';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { huntGold } from '../economy/economy-curve';
import { itemDefinitionById } from '../rpg/item-definition';
import { potionById } from '../potions/potions.model';
import { SHOPS, SHOP_IDS, buyPriceOf, offerById, offerPrice, shopOfStation, stackWorth } from './shops.model';
import { ShopService } from './shop.service';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  read(key: string): unknown { const raw = this.bag.get(key); try { return raw == null ? null : JSON.parse(raw); } catch { return null; } }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

describe('the shop catalogue', () => {
  it('has five shops, each found by its station', () => {
    expect(SHOP_IDS.length).toBe(5);
    for (const id of SHOP_IDS) expect(shopOfStation(`shop-${id}`)).toBe(id);
    expect(shopOfStation('vendor')).toBeNull();
  });

  it('prices every offer off the curve (or its own pinned price), in whole Gold', () => {
    for (const id of SHOP_IDS) for (const o of SHOPS[id].stock) {
      const p = offerPrice(o, 10);
      expect(Number.isInteger(p)).withContext(o.id).toBe(true);
      expect(p).withContext(o.id).toBeGreaterThan(0);
      if (o.kind === 'stack' || o.kind === 'item') expect(p).toBe(Math.max(1, huntGold(o.level, o.secs)));
      if (o.kind === 'potion') expect(p).toBe(potionById(o.key)!.price);
      if (o.kind === 'item') expect(itemDefinitionById(o.key)).withContext(o.key).toBeTruthy();
    }
  });

  it('never buys back for more than it sells, and never buys potions back', () => {
    for (const shop of SHOP_IDS) for (const o of SHOPS[shop].stock) {
      for (const other of SHOP_IDS) {
        expect(buyPriceOf(other, o.key)).withContext(`${other} buys ${o.key}`).toBeLessThan(offerPrice(o, 1) + 1);
        if (o.kind === 'potion') expect(buyPriceOf(other, o.key)).toBe(0);
      }
    }
  });

  it('buys only what fits the shop: the fishmonger buys fish, not ore', () => {
    expect(buyPriceOf('fishing', 'blindfin')).toBeGreaterThan(0);
    expect(buyPriceOf('fishing', 'cinder-ore')).toBe(0);
    expect(buyPriceOf('smith', 'cinder-ore')).toBeGreaterThan(0);
    expect(buyPriceOf('alchemist', 'sunbloom')).toBeGreaterThan(0);
    expect(buyPriceOf('wood', 'world-root-bark')).toBeGreaterThan(0);
    expect(stackWorth('rune-ash')).toBe(0);
  });

  it('sells the Smith\'s bases with empty wells, sized for a runeword', () => {
    const bases = SHOPS.smith.stock.filter(o => o.kind === 'item');
    expect(bases.length).toBeGreaterThan(5);
    for (const o of bases) if (o.kind === 'item') expect(o.sockets).withContext(o.id).toBeGreaterThanOrEqual(2);
  });
});

describe('ShopService', () => {
  let shops: ShopService;
  let inventory: InventoryService;
  let economy: EconomyService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ShopService, InventoryService, EconomyService, LocalSaveRegistry, { provide: GameStateGateway, useValue: new MemoryGateway() }] });
    shops = TestBed.inject(ShopService);
    inventory = TestBed.inject(InventoryService);
    economy = TestBed.inject(EconomyService);
    shops.init();
    economy.earnGold(100_000, 'spec');
  });

  it('buys a stack once per press, and charges once', () => {
    const before = economy.snapshot.gold;
    const torch = offerById('gen-torch')!.offer;
    expect(shops.buy('gen-torch', 3, 'p1').code).toBe('ok');
    expect(shops.buy('gen-torch', 3, 'p1').code).toBe('replayed');
    expect(inventory.stackOf('torch')).toBe(3);
    expect(economy.snapshot.gold).toBe(before - 3 * shops.priceOf(torch));
  });

  it('mints a Smith\'s base white, at its item level, with its empty wells', () => {
    const out = shops.buy('smith-staff-2', 1, 'p2');
    expect(out.code).toBe('ok');
    expect(out.item?.rarity).toBe('common');
    expect(out.item?.sockets).toEqual([null, null]);
    expect(shops.buy('smith-staff-2', 1, 'p2').code).toBe('replayed');
  });

  it('refuses a buy it cannot afford, and spends nothing', () => {
    economy.spendGold(economy.snapshot.gold, 'spec');
    expect(shops.buy('smith-mace-3', 1, 'p3').code).toBe('funds');
    expect(inventory.snapshot.items.length).toBe(0);
  });

  it('sells a stack the shop buys, and refuses one it does not', () => {
    inventory.grantStack('spec-ore', 'cinder-ore', 10);
    const gold = economy.snapshot.gold;
    const sold = shops.sellStack('general', 'cinder-ore', 10, 's1');
    expect(sold.code).toBe('ok');
    expect(sold.gold).toBe(10 * buyPriceOf('general', 'cinder-ore'));
    expect(economy.snapshot.gold).toBe(gold + sold.gold);
    inventory.grantStack('spec-ore2', 'cinder-ore', 1);
    expect(shops.sellStack('alchemist', 'cinder-ore', 1, 's2').code).toBe('refused');
  });

  it('sells gear at the Smith and the General Store, never at the Alchemist', () => {
    const base = shops.buy('smith-cowl-2', 1, 'p4').item!;
    expect(shops.sellItem('alchemist', base.id).code).toBe('refused');
    expect(shops.sellItem('smith', base.id).code).toBe('ok');
    expect(inventory.itemById(base.id)).toBeUndefined();
  });
});
