/**
 * player-exchange.model.spec.ts — what the player-market Exchange shows:
 * fee math, default prices, the Max button, book depth, error copy, the board
 * and the dev-only mode switch. Pure functions; no TestBed.
 */
import {
  bookDepth,
  buyReceipt,
  defaultPrice,
  marketErrorCopy,
  maxTradeQty,
  sellReceipt,
} from './player-exchange.model';
import {
  buildBoard,
  resolveMarketMode,
  type MarketOrder,
  type MarketPrice,
} from '../market/player-market.model';

const order = (over: Partial<MarketOrder>): MarketOrder => ({
  id: 'o', side: 'sell', itemKey: 'mat:cinder-ore', kind: 'material', qty: 10, filledQty: 0,
  unitPrice: 100, ownerUid: 'u', createdAt: 1, updatedAt: 1, status: 'open', ...over,
});

const priceDoc = (over: Partial<MarketPrice>): MarketPrice => ({
  itemKey: 'mat:cinder-ore', lastPrice: 0, lastTradeAt: 0, volume24h: 0, vwap24h: 0,
  trades24h: 0, buckets: [], updatedAt: 0, ...over,
});

describe('player exchange view model', () => {
  describe('fees', () => {
    it('takes 2% from the seller, rounded up, and says what they receive', () => {
      expect(sellReceipt(100, 10, null)).toEqual({ gross: 1000, tax: 20, net: 980, fillsNow: false });
      // 2% of 1,001 is 20.02 → 21, the server's rounding.
      expect(sellReceipt(1001, 1, null)).toEqual({ gross: 1001, tax: 21, net: 980, fillsNow: false });
      expect(sellReceipt(1, 1, null).tax).toBe(1);
      expect(sellReceipt(0, 5, null)).toEqual({ gross: 0, tax: 0, net: 0, fillsNow: false });
    });

    it('a buy escrows quantity × price and has no tax', () => {
      expect(buyReceipt(120, 5, null)).toEqual({ total: 600, fillsNow: false });
    });

    it('says whether the order fills right away', () => {
      expect(buyReceipt(120, 1, 120).fillsNow).toBeTrue();
      expect(buyReceipt(119, 1, 120).fillsNow).toBeFalse();
      expect(sellReceipt(90, 1, 90).fillsNow).toBeTrue();
      expect(sellReceipt(91, 1, 90).fillsNow).toBeFalse();
      expect(buyReceipt(500, 0, 120).fillsNow).toBeFalse();
    });
  });

  describe('default prices', () => {
    const book = { bestBid: 90, bestAsk: 110 };
    it('buys at the cheapest seller and sells to the dearest buyer', () => {
      expect(defaultPrice('buy', book, null, 50)).toBe(110);
      expect(defaultPrice('sell', book, null, 50)).toBe(90);
    });
    it('falls back to the 24h average, then the last trade, then base worth', () => {
      const empty = { bestBid: null, bestAsk: null };
      expect(defaultPrice('buy', empty, { vwap24h: 101, lastPrice: 99 }, 50)).toBe(101);
      expect(defaultPrice('sell', empty, { vwap24h: 0, lastPrice: 99 }, 50)).toBe(99);
      expect(defaultPrice('sell', empty, null, 50)).toBe(50);
      expect(defaultPrice('buy', null, null, 0)).toBe(1);
    });
    it('uses the other side only through the fallback, never the wrong best', () => {
      expect(defaultPrice('buy', { bestBid: 90, bestAsk: null }, null, 70)).toBe(70);
    });
  });

  describe('Max', () => {
    it('buys what the purse covers, capped per order', () => {
      expect(maxTradeQty('buy', 'material', { gold: 1000, unitPrice: 30, held: 0 })).toBe(33);
      expect(maxTradeQty('buy', 'material', { gold: 1e12, unitPrice: 1, held: 0 })).toBe(10_000);
      expect(maxTradeQty('buy', 'equipment', { gold: 1e12, unitPrice: 1, held: 0 })).toBe(50);
      expect(maxTradeQty('buy', 'material', { gold: 1000, unitPrice: 0, held: 0 })).toBe(0);
    });
    it('sells everything carried; equipment one piece at a time', () => {
      expect(maxTradeQty('sell', 'material', { gold: 0, unitPrice: 5, held: 42 })).toBe(42);
      expect(maxTradeQty('sell', 'equipment', { gold: 0, unitPrice: 5, held: 3 })).toBe(1);
      expect(maxTradeQty('sell', 'equipment', { gold: 0, unitPrice: 5, held: 0 })).toBe(0);
    });
  });

  it('shows five levels each side of the book', () => {
    const lv = (p: number) => ({ unitPrice: p, qty: 1, orders: 1 });
    const d = bookDepth({ asks: [1, 2, 3, 4, 5, 6, 7].map(lv), bids: [9, 8].map(lv) });
    expect(d.asks.map(l => l.unitPrice)).toEqual([1, 2, 3, 4, 5]);
    expect(d.bids.length).toBe(2);
    expect(bookDepth(null)).toEqual({ asks: [], bids: [] });
  });

  describe('error copy', () => {
    it('reads the accepted range out of a price-band refusal', () => {
      expect(marketErrorCopy('price-band', 'That price is out of range for this item right now. Try between 1,200 and 19,000 Gold.'))
        .toEqual({ key: 'pmx.err.priceBand', vars: { min: '1,200', max: '19,000' } });
      expect(marketErrorCopy('price-band', 'nope')).toEqual({ key: 'pmx.err.priceBandPlain' });
    });
    it('reads the wait out of a rate limit', () => {
      expect(marketErrorCopy('rate-limited', 'Slow down a little — try again in 42 seconds.'))
        .toEqual({ key: 'pmx.err.rateLimited', vars: { secs: '42' } });
      expect(marketErrorCopy('rate-limited', '')).toEqual({ key: 'pmx.err.rateLimitedPlain' });
    });
    it('folds every save problem into "not in your cloud save"', () => {
      for (const r of ['not-owned', 'not-enough', 'save-missing', 'save-era', 'save-unreadable', 'save-syncing', 'wrong-item']) {
        expect(marketErrorCopy(r, 'x')).toEqual({ key: 'pmx.err.notInSave' });
      }
    });
    it('names a closed or paused market, offline and internal failures plainly', () => {
      expect(marketErrorCopy('market-closed', 'x')).toEqual({ key: 'pmx.err.closed' });
      expect(marketErrorCopy('market-halted', 'x')).toEqual({ key: 'pmx.err.halted' });
      expect(marketErrorCopy('offline', 'x')).toEqual({ key: 'pmx.err.offline' });
      expect(marketErrorCopy('internal', 'INTERNAL')).toEqual({ key: 'pmx.err.internal' });
      expect(marketErrorCopy('signed-out', 'x')).toEqual({ key: 'pmx.err.signedOut' });
      expect(marketErrorCopy('not-open', 'x')).toEqual({ key: 'pmx.err.orderGone' });
    });
    it('passes an unknown refusal through as the server sentence, never a code', () => {
      expect(marketErrorCopy('precheck', 'Choose an item.')).toEqual({ text: 'Choose an item.' });
      expect(marketErrorCopy('something-new', '')).toEqual({ key: 'pmx.err.internal' });
    });
  });

  describe('board', () => {
    it('keeps items with a live order or a trade today, best prices per side, busiest first', () => {
      const rows = buildBoard(
        [
          order({ id: 'a', side: 'sell', unitPrice: 110, qty: 5 }),
          order({ id: 'b', side: 'sell', unitPrice: 105, qty: 5, filledQty: 2 }),
          order({ id: 'c', side: 'buy', unitPrice: 90, qty: 4 }),
          order({ id: 'd', side: 'buy', unitPrice: 95, qty: 1, status: 'filled', filledQty: 1 }),
          order({ id: 'e', itemKey: 'mat:frost', side: 'buy', unitPrice: 7, qty: 1 }),
        ],
        [
          priceDoc({ lastPrice: 100, vwap24h: 101, volume24h: 30 }),
          priceDoc({ itemKey: 'mat:stale', lastPrice: 5, volume24h: 0 }),
          priceDoc({ itemKey: 'mat:busy', lastPrice: 5, vwap24h: 5, volume24h: 99 }),
        ],
      );
      expect(rows.map(r => r.itemKey)).toEqual(['mat:busy', 'mat:cinder-ore', 'mat:frost']);
      const ore = rows[1];
      expect(ore).toEqual(jasmine.objectContaining({
        bestAsk: 105, bestBid: 90, askQty: 8, bidQty: 4, lastPrice: 100, vwap24h: 101, volume24h: 30,
      }));
      expect(rows[2].bestAsk).toBeNull();
    });
  });

  describe('market mode', () => {
    it('is off with the flag off, live with it on', () => {
      expect(resolveMarketMode({ clientFlag: false, devMode: true, search: '' }).mode).toBe('off');
      expect(resolveMarketMode({ clientFlag: true, devMode: false, search: null }).mode).toBe('live');
    });
    it('only ever picks the fake in dev mode', () => {
      expect(resolveMarketMode({ clientFlag: false, devMode: false, search: '?market=fake' }).mode).toBe('off');
      expect(resolveMarketMode({ clientFlag: true, devMode: false, search: '?market=fake' }).mode).toBe('live');
      expect(resolveMarketMode({ clientFlag: false, devMode: true, search: '?market=fake' }))
        .toEqual({ mode: 'fake', scenario: 'ready', failReason: null });
    });
    it('reads the fake scenarios and a forced refusal', () => {
      expect(resolveMarketMode({ clientFlag: false, devMode: true, search: '?market=fake-guest' }).scenario).toBe('guest');
      expect(resolveMarketMode({ clientFlag: false, devMode: true, search: '?market=fake-closed' }).scenario).toBe('closed');
      expect(resolveMarketMode({ clientFlag: false, devMode: true, search: '?market=fake&fail=price-band' }).failReason).toBe('price-band');
      expect(resolveMarketMode({ clientFlag: false, devMode: true, search: '?market=fake&fail=<x>' }).failReason).toBeNull();
      expect(resolveMarketMode({ clientFlag: false, devMode: true, search: '?market=real' }).mode).toBe('off');
    });
  });
});
