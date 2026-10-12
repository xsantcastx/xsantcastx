/**
 * material-vendor.model.spec.ts — the buyback board, its prices and the sale.
 *
 * Economy v3: the Vendor only buys (NPCs are sinks; players run the market).
 * Pure functions with fake ledgers: no TestBed, no services, nothing async.
 */
import { CRAFTING_RECIPES } from '../crafting/crafting.model';
import { ITEM_ECONOMY_SCALE, VENDOR_BUYBACK_FRACTION } from '../economy/economy-curve';
import { EXCHANGE_CATALOGUE, PRICE_FLOOR_MULT, quoteBuy, quoteSell } from '../exchange/exchange.model';
import { REALM_ARTBIBLE_MATERIALS } from '../explorer/explorer.model';
import { materialDisplay } from '../rpg/material-catalog';
import {
  VENDOR_MAX_QTY,
  VENDOR_SHELF,
  buybackPrice,
  clampQuantity,
  newVendorMutationId,
  recipeNeeds,
  sellToVendor,
  surplusOf,
  vendorConsumeId,
  vendorListing,
  vendorTotal,
  type VendorLedger,
  type VendorReceipt,
} from './material-vendor.model';

/** An in-memory pair of ledgers that records every call. */
function fakeLedger(held: Record<string, number>, opts: { consumeFails?: boolean } = {}) {
  const state = { gold: 0, stacks: new Map(Object.entries(held)), consumed: new Set<string>(), pays: [] as number[] };
  const ledger: VendorLedger = {
    held: id => state.stacks.get(id) ?? 0,
    consume: (mutationId, id, qty) => {
      if (opts.consumeFails) return { ok: false, replayed: false };
      if (state.consumed.has(mutationId)) return { ok: true, replayed: true };
      state.consumed.add(mutationId);
      state.stacks.set(id, (state.stacks.get(id) ?? 0) - qty);
      return { ok: true, replayed: false };
    },
    payGold: amount => { state.gold += amount; state.pays.push(amount); },
  };
  return { ledger, state };
}

describe('material vendor buyback board', () => {
  it('paints every board material (a name and art in the catalogue), no duplicates', () => {
    const ids = VENDOR_SHELF.map(listing => listing.materialId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const listing of VENDOR_SHELF) {
      const display = materialDisplay(listing.materialId);
      expect(display?.name).withContext(listing.materialId).toBeTruthy();
      expect(listing.materialId.startsWith('rune-')).withContext(listing.materialId).toBeFalse();
    }
  });

  it('names an expedition for every expedition-only material', () => {
    const expedition = new Set(Object.values(REALM_ARTBIBLE_MATERIALS).flat());
    for (const listing of VENDOR_SHELF.filter(row => row.tier !== 'gathered')) {
      expect(expedition.has(listing.materialId)).withContext(listing.materialId).toBeTrue();
      expect(listing.source).withContext(listing.materialId).toBeTruthy();
    }
  });

  it('pays a whole-Gold fraction of base worth, never more than the worth', () => {
    for (const listing of VENDOR_SHELF) {
      expect(listing.price).toBe(buybackPrice(listing.worth));
      expect(Number.isInteger(listing.price) && listing.price >= 1).withContext(listing.materialId).toBeTrue();
      expect(listing.price).toBeLessThanOrEqual(Math.max(1, listing.worth * VENDOR_BUYBACK_FRACTION));
    }
  });

  it('anchors gathered materials on the Exchange base × ρ', () => {
    for (const listing of VENDOR_SHELF.filter(row => row.tier === 'gathered')) {
      const good = EXCHANGE_CATALOGUE.find(row => row.kind === 'material' && row.stackKey === listing.materialId);
      expect(good).withContext(listing.materialId).toBeTruthy();
      // One scale: the Exchange quotes the same ρ-scaled worth the Vendor reads.
      expect(listing.worth).withContext(listing.materialId).toBe(good!.basePrice);
    }
  });

  // P-5 (docs/handoff/playtest-findings.md): the Exchange's floor quote, in whole
  // Gold, after its 5% sale tax (rounded up), is what a player is handed for one
  // unit at the bottom of the market. The counter must pay strictly less, for
  // every material it takes — gathered and expedition-only alike.
  const exchangeBaseFor = (materialId: string, worth: number) =>
    EXCHANGE_CATALOGUE.find(row => row.kind === 'material' && row.stackKey === materialId)?.basePrice ?? worth;
  const floorUnitFor = (base: number) => Math.max(1, Math.round(base * PRICE_FLOOR_MULT));

  it('pays strictly less than the Exchange floor quote after tax, for every material', () => {
    const offenders: string[] = [];
    for (const listing of VENDOR_SHELF) {
      const floorNet = quoteSell(floorUnitFor(exchangeBaseFor(listing.materialId, listing.worth)), 1).net;
      // The single exception is the 1-Gold minimum where the Exchange floor also
      // nets 1 (Slag Fragment): nothing lower than 1 can be paid.
      const minimumTie = listing.price === 1 && floorNet <= 1;
      if (listing.price >= floorNet && !minimumTie) offenders.push(`${listing.materialId}: vendor ${listing.price} >= exchange ${floorNet}`);
    }
    expect(offenders).toEqual([]);
    // The minimum tie is only ever the one cheapest material, never a priced one.
    const ties = VENDOR_SHELF.filter(listing =>
      listing.price >= quoteSell(floorUnitFor(exchangeBaseFor(listing.materialId, listing.worth)), 1).net);
    expect(ties.map(listing => listing.materialId)).toEqual(['slag-fragment']);
  });

  it('pays strictly less per unit than the Exchange floor rate net of tax, on a lot of any size', () => {
    for (const listing of VENDOR_SHELF) {
      const floorRate = exchangeBaseFor(listing.materialId, listing.worth) * PRICE_FLOOR_MULT;
      for (const qty of [10, 50, 99]) {
        const exchangeNet = quoteSell(floorRate, qty).net; // unrounded floor, the rate a lot settles at
        expect(listing.price * qty).withContext(`${listing.materialId} x${qty}`).toBeLessThan(exchangeNet);
      }
    }
  });

  it('can never be arbitraged: it pays less than the Exchange ever charges', () => {
    for (const listing of VENDOR_SHELF) {
      // The Exchange's lowest possible ask (priceAt clamps to base × floor, min 1).
      const lowestAsk = quoteBuy(floorUnitFor(exchangeBaseFor(listing.materialId, listing.worth)), 1).net;
      expect(listing.price).withContext(listing.materialId).toBeLessThan(lowestAsk);
    }
  });

  it('keeps every Exchange material on the ρ-scaled worth (one source with economy-curve.ts)', () => {
    for (const good of EXCHANGE_CATALOGUE.filter(row => row.kind === 'material')) {
      expect(good.basePrice).withContext(good.id).toBeLessThan(10_000); // v2 bases ran to 95,000
    }
    expect(ITEM_ECONOMY_SCALE).toBe(0.06);
  });
});

describe('material vendor arithmetic', () => {
  it('clamps quantities into a whole 1..max', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
    expect(clampQuantity(NaN)).toBe(1);
    expect(clampQuantity(3.9)).toBe(3);
    expect(clampQuantity(4000)).toBe(VENDOR_MAX_QTY);
    expect(clampQuantity(9, 5)).toBe(5);
  });

  it('totals and surplus agree', () => {
    const pyrite = vendorListing('pyrite-dust')!;
    expect(vendorTotal(pyrite, 3)).toBe(3 * pyrite.price);
    const recipes = [
      { id: 'a', name: 'Alpha', ingredients: [{ materialId: 'x', count: 4 }] },
      { id: 'b', name: 'Bravo', ingredients: [{ materialId: 'x', count: 2 }, { materialId: 'x', count: 3 }] },
    ];
    expect(surplusOf('x', recipes, 9)).toBe(4); // keeps 5 for Bravo
    expect(surplusOf('x', recipes, 3)).toBe(0);
    expect(surplusOf('nothing-wants-it', recipes, 7)).toBe(7);
  });

  it('finds real recipe hints for the real bench', () => {
    const needs = recipeNeeds('world-root-bark', CRAFTING_RECIPES, 0);
    expect(needs.length).toBeGreaterThan(0);
    expect(needs[0].short).toBe(needs[0].need);
  });
});

describe('sellToVendor', () => {
  const pyrite = vendorListing('pyrite-dust')!;
  const intent = (over: Partial<{ mutationId: string; materialId: string; quantity: number; expectedUnitPrice: number }> = {}) => ({
    mutationId: 'm1', materialId: 'pyrite-dust', quantity: 3, expectedUnitPrice: pyrite.price, ...over,
  });

  it('takes the goods once under vendor-sell:<id> and pays the total', () => {
    const { ledger, state } = fakeLedger({ 'pyrite-dust': 10 });
    const receipt = sellToVendor(ledger, intent(), new Map());
    expect(receipt.code).toBe('ok');
    expect(receipt.total).toBe(pyrite.price * 3);
    expect(receipt.consumeId).toBe(vendorConsumeId('m1'));
    expect(state.gold).toBe(pyrite.price * 3);
    expect(state.stacks.get('pyrite-dust')).toBe(7);
  });

  it('a replayed mutation id is one sale', () => {
    const { ledger, state } = fakeLedger({ 'pyrite-dust': 10 });
    const settled = new Map<string, VendorReceipt>();
    sellToVendor(ledger, intent(), settled);
    expect(sellToVendor(ledger, intent(), settled).code).toBe('replay');
    expect(state.pays.length).toBe(1);
    expect(state.stacks.get('pyrite-dust')).toBe(7);
  });

  it('a consume that was already taken (after a reload) is never paid twice', () => {
    const { ledger, state } = fakeLedger({ 'pyrite-dust': 10 });
    sellToVendor(ledger, intent(), new Map());
    // Fresh settled map: the session that sold is gone.
    expect(sellToVendor(ledger, intent(), new Map()).code).toBe('replay');
    expect(state.pays.length).toBe(1);
  });

  it('refuses what is not held, and a failed hand-over pays nothing', () => {
    const short = fakeLedger({ 'pyrite-dust': 2 });
    expect(sellToVendor(short.ledger, intent(), new Map()).code).toBe('short');
    expect(short.state.pays.length).toBe(0);
    const broken = fakeLedger({ 'pyrite-dust': 10 }, { consumeFails: true });
    expect(sellToVendor(broken.ledger, intent(), new Map()).code).toBe('delivery');
    expect(broken.state.pays.length).toBe(0);
  });

  it('rejects unknown goods, bad quantities and a moved price', () => {
    const { ledger, state } = fakeLedger({ 'pyrite-dust': 1e6 });
    expect(sellToVendor(ledger, intent({ materialId: 'rune-of-cinder' }), new Map()).code).toBe('unknown');
    expect(sellToVendor(ledger, intent({ mutationId: '' }), new Map()).code).toBe('unknown');
    expect(sellToVendor(ledger, intent({ quantity: 0 }), new Map()).code).toBe('bad-quantity');
    expect(sellToVendor(ledger, intent({ quantity: 2.5 }), new Map()).code).toBe('bad-quantity');
    expect(sellToVendor(ledger, intent({ quantity: VENDOR_MAX_QTY + 1 }), new Map()).code).toBe('bad-quantity');
    expect(sellToVendor(ledger, intent({ expectedUnitPrice: pyrite.price + 1 }), new Map()).code).toBe('stale');
    expect(state.pays.length).toBe(0);
  });

  it('mints distinct mutation ids', () => {
    let n = 0;
    const rand = () => (++n) / 7;
    expect(newVendorMutationId('pyrite-dust', 1000, rand)).not.toBe(newVendorMutationId('pyrite-dust', 1000, rand));
  });
});
