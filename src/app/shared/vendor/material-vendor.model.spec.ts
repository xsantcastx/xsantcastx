/**
 * material-vendor.model.spec.ts — the shelf, the prices and the purchase.
 *
 * Pure functions with fake ledgers: no TestBed, no services, nothing async.
 */
import { CRAFTING_RECIPES } from '../crafting/crafting.model';
import { EXCHANGE_CATALOGUE, PRICE_CEILING_MULT, SALE_TAX_RATE } from '../exchange/exchange.model';
import { REALM_ARTBIBLE_MATERIALS } from '../explorer/explorer.model';
import { materialDisplay } from '../rpg/material-catalog';
import {
  VENDOR_MAX_QTY,
  VENDOR_SHELF,
  VENDOR_TIER_PRICE,
  buyFromVendor,
  clampQuantity,
  goldShort,
  maxAffordable,
  newVendorMutationId,
  recipeCount,
  recipeNeeds,
  suggestedQuantity,
  vendorGrantId,
  vendorListing,
  vendorTotal,
  type VendorLedger,
  type VendorReceipt,
} from './material-vendor.model';

/** An in-memory pair of ledgers that records every call. */
function fakeLedger(gold: number, opts: { room?: boolean; grantFails?: boolean } = {}) {
  const state = { gold, stacks: new Map<string, number>(), grants: new Set<string>(), spends: [] as number[], refunds: [] as number[] };
  const ledger: VendorLedger = {
    gold: () => state.gold,
    spendGold: amount => {
      if (amount <= 0 || state.gold < amount) return false;
      state.gold -= amount; state.spends.push(amount); return true;
    },
    refundGold: amount => { state.gold += amount; state.refunds.push(amount); },
    canAccept: () => opts.room !== false,
    grantStack: (grantId, materialId, qty) => {
      if (opts.grantFails) return false;
      if (state.grants.has(grantId)) return true;
      state.grants.add(grantId);
      state.stacks.set(materialId, (state.stacks.get(materialId) ?? 0) + qty);
      return true;
    },
  };
  return { ledger, state };
}

describe('material vendor shelf', () => {
  it('stocks only materials a crafting recipe actually consumes', () => {
    for (const listing of VENDOR_SHELF) {
      expect(recipeCount(listing.materialId, CRAFTING_RECIPES)).withContext(listing.materialId).toBeGreaterThan(0);
    }
  });

  it('paints every shelf material (a name and art in the catalogue)', () => {
    for (const listing of VENDOR_SHELF) {
      const display = materialDisplay(listing.materialId);
      expect(display?.art).withContext(listing.materialId).toBeTruthy();
      expect(display?.name).withContext(listing.materialId).not.toBe(listing.materialId);
    }
  });

  it('sells expedition materials, never runes, and has no duplicates', () => {
    const expedition = new Set(Object.values(REALM_ARTBIBLE_MATERIALS).flat());
    const ids = VENDOR_SHELF.map(listing => listing.materialId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(expedition.has(id)).withContext(`${id} comes from expeditions`).toBeTrue();
      expect(id.startsWith('rune-')).withContext(id).toBeFalse();
    }
  });

  it('prices by tier, whole Gold', () => {
    for (const listing of VENDOR_SHELF) {
      expect(listing.price).toBe(VENDOR_TIER_PRICE[listing.tier]);
      expect(Number.isInteger(listing.price) && listing.price > 0).toBeTrue();
    }
  });

  it('can never be arbitraged against the Exchange (buy here, sell there)', () => {
    // The most the Exchange can ever pay for one unit, after its sale tax.
    for (const listing of VENDOR_SHELF) {
      const good = EXCHANGE_CATALOGUE.find(row => row.kind === 'material' && row.stackKey === listing.materialId);
      if (!good) continue;
      const bestSale = good.basePrice * PRICE_CEILING_MULT * (1 - SALE_TAX_RATE);
      expect(listing.price).withContext(listing.materialId).toBeGreaterThan(bestSale);
    }
  });
});

describe('material vendor arithmetic', () => {
  const pyrite = vendorListing('pyrite-dust')!;

  it('clamps quantities into a whole 1..25', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
    expect(clampQuantity(NaN)).toBe(1);
    expect(clampQuantity(3.9)).toBe(3);
    expect(clampQuantity(400)).toBe(VENDOR_MAX_QTY);
    expect(clampQuantity(9, 5)).toBe(5);
  });

  it('totals, affordability and shortfall agree', () => {
    expect(vendorTotal(pyrite, 3)).toBe(3 * pyrite.price);
    expect(maxAffordable(pyrite.price, pyrite.price * 2 + 1)).toBe(2);
    expect(maxAffordable(pyrite.price, pyrite.price - 1)).toBe(0);
    expect(maxAffordable(pyrite.price, pyrite.price * 1000)).toBe(VENDOR_MAX_QTY);
    expect(maxAffordable(0, 1000)).toBe(0);
    expect(goldShort(pyrite, 2, pyrite.price)).toBe(pyrite.price);
    expect(goldShort(pyrite, 1, pyrite.price * 5)).toBe(0);
  });
});

describe('material vendor recipe hints', () => {
  const recipes = [
    { id: 'a', name: 'Alpha', requiredLevel: 5, ingredients: [{ materialId: 'x', count: 4 }] },
    { id: 'b', name: 'Bravo', requiredLevel: 1, ingredients: [{ materialId: 'x', count: 2 }, { materialId: 'y', count: 1 }] },
    { id: 'c', name: 'Charlie', requiredLevel: 2, ingredients: [{ materialId: 'y', count: 9 }] },
    { id: 'd', name: 'Delta', requiredLevel: 3, ingredients: [{ materialId: 'x', count: 1 }, { materialId: 'x', count: 1 }] },
  ];

  it('lists recipes that are short first, then by level', () => {
    const needs = recipeNeeds('x', recipes, 2);
    expect(needs.map(n => n.recipeId)).toEqual(['a', 'b', 'd']);
    expect(needs[0]).toEqual(jasmine.objectContaining({ need: 4, short: 2 }));
    expect(needs[1].short).toBe(0);
  });

  it('sums an ingredient listed twice, and respects the limit', () => {
    expect(recipeNeeds('x', recipes, 0).find(n => n.recipeId === 'd')?.need).toBe(2);
    expect(recipeNeeds('x', recipes, 0, 1).length).toBe(1);
    expect(recipeNeeds('nothing', recipes, 0)).toEqual([]);
  });

  it('suggests the first shortfall as the quantity', () => {
    expect(suggestedQuantity(recipeNeeds('x', recipes, 0))).toBe(2); // Bravo, level 1, needs 2
    expect(suggestedQuantity(recipeNeeds('x', recipes, 99))).toBe(1);
  });

  it('finds real hints for the real bench', () => {
    const needs = recipeNeeds('world-root-bark', CRAFTING_RECIPES, 0);
    expect(needs.length).toBeGreaterThan(0);
    expect(needs[0].short).toBe(needs[0].need);
  });
});

describe('buyFromVendor', () => {
  const pyrite = vendorListing('pyrite-dust')!;
  const intent = (over: Partial<{ mutationId: string; materialId: string; quantity: number; expectedUnitPrice: number }> = {}) => ({
    mutationId: 'm1', materialId: 'pyrite-dust', quantity: 3, expectedUnitPrice: pyrite.price, ...over,
  });

  it('debits once, grants under vendor:<id>, and reports the total', () => {
    const { ledger, state } = fakeLedger(pyrite.price * 10);
    const settled = new Map<string, VendorReceipt>();
    const receipt = buyFromVendor(ledger, intent(), settled);
    expect(receipt.code).toBe('ok');
    expect(receipt.total).toBe(pyrite.price * 3);
    expect(receipt.grantId).toBe(vendorGrantId('m1'));
    expect(state.gold).toBe(pyrite.price * 7);
    expect(state.stacks.get('pyrite-dust')).toBe(3);
  });

  it('a replayed mutation id is one purchase', () => {
    const { ledger, state } = fakeLedger(pyrite.price * 10);
    const settled = new Map<string, VendorReceipt>();
    buyFromVendor(ledger, intent(), settled);
    const again = buyFromVendor(ledger, intent(), settled);
    expect(again.code).toBe('replay');
    expect(state.spends.length).toBe(1);
    expect(state.stacks.get('pyrite-dust')).toBe(3);
  });

  it('refuses what it cannot afford without touching either ledger', () => {
    const { ledger, state } = fakeLedger(pyrite.price * 2);
    const receipt = buyFromVendor(ledger, intent(), new Map());
    expect(receipt.code).toBe('funds');
    expect(state.spends.length).toBe(0);
    expect(state.stacks.size).toBe(0);
  });

  it('checks the bag before taking Gold', () => {
    const { ledger, state } = fakeLedger(pyrite.price * 10, { room: false });
    expect(buyFromVendor(ledger, intent(), new Map()).code).toBe('bag-full');
    expect(state.gold).toBe(pyrite.price * 10);
  });

  it('refunds when the grant is refused after the debit, and allows a retry', () => {
    const { ledger, state } = fakeLedger(pyrite.price * 10, { grantFails: true });
    const settled = new Map<string, VendorReceipt>();
    expect(buyFromVendor(ledger, intent(), settled).code).toBe('delivery');
    expect(state.gold).toBe(pyrite.price * 10);
    expect(state.refunds).toEqual([pyrite.price * 3]);
    expect(settled.size).toBe(0);
  });

  it('rejects unknown goods, bad quantities and a moved price', () => {
    const { ledger, state } = fakeLedger(1e9);
    expect(buyFromVendor(ledger, intent({ materialId: 'rune-of-cinder' }), new Map()).code).toBe('unknown');
    expect(buyFromVendor(ledger, intent({ mutationId: '' }), new Map()).code).toBe('unknown');
    expect(buyFromVendor(ledger, intent({ quantity: 0 }), new Map()).code).toBe('bad-quantity');
    expect(buyFromVendor(ledger, intent({ quantity: 2.5 }), new Map()).code).toBe('bad-quantity');
    expect(buyFromVendor(ledger, intent({ quantity: VENDOR_MAX_QTY + 1 }), new Map()).code).toBe('bad-quantity');
    expect(buyFromVendor(ledger, intent({ expectedUnitPrice: pyrite.price - 1 }), new Map()).code).toBe('stale');
    expect(state.spends.length).toBe(0);
  });

  it('mints distinct mutation ids', () => {
    let n = 0;
    const rand = () => (++n) / 7;
    expect(newVendorMutationId('pyrite-dust', 1000, rand)).not.toBe(newVendorMutationId('pyrite-dust', 1000, rand));
  });
});
