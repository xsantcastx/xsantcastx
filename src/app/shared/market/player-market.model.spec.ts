import {
  MarketOrder,
  aggregateLevels,
  buildBook,
  describeMarketError,
  netProceeds,
  newClientRequestId,
  precheckOrder,
  sellerTax,
} from './player-market.model';

function order(over: Partial<MarketOrder>): MarketOrder {
  return {
    id: 'o', side: 'sell', itemKey: 'mat:cinder-ore', kind: 'material', qty: 10, filledQty: 0,
    unitPrice: 400, ownerUid: 'u', createdAt: 1, updatedAt: 1, status: 'open', ...over,
  };
}

describe('player-market.model', () => {
  it('aggregates open remainders into price levels, best first', () => {
    const asks = [
      order({ id: 'a', unitPrice: 410 }),
      order({ id: 'b', unitPrice: 400, filledQty: 4 }),
      order({ id: 'c', unitPrice: 400 }),
      order({ id: 'd', unitPrice: 390, status: 'cancelled' }),
    ];
    expect(aggregateLevels(asks, 'sell')).toEqual([
      { unitPrice: 400, qty: 16, orders: 2 },
      { unitPrice: 410, qty: 10, orders: 1 },
    ]);
    const bids = [order({ side: 'buy', unitPrice: 300 }), order({ side: 'buy', unitPrice: 350 })];
    expect(aggregateLevels(bids, 'buy').map(l => l.unitPrice)).toEqual([350, 300]);
  });

  it('builds a book with best bid / ask and individual asks for equipment', () => {
    const book = buildBook('eq:anchor-ring:rare',
      [order({ side: 'buy', unitPrice: 11_000, qty: 1 })],
      [order({ id: 'x', unitPrice: 12_500, qty: 1, createdAt: 2 }), order({ id: 'y', unitPrice: 12_000, qty: 1 })]);
    expect(book.bestBid).toBe(11_000);
    expect(book.bestAsk).toBe(12_000);
    expect(book.askOrders.map(o => o.id)).toEqual(['y', 'x']);
    expect(book.loading).toBeFalse();
  });

  it('computes the 2% seller tax the way the server does', () => {
    expect(sellerTax(10_000)).toBe(200);
    expect(sellerTax(1)).toBe(1);
    expect(netProceeds(400, 15)).toBe(6_000 - 120);
  });

  it('prechecks orders in plain words', () => {
    expect(precheckOrder({ side: 'buy', itemKey: 'mat:cinder-ore', qty: 0, unitPrice: 5 })).toContain('Quantity');
    expect(precheckOrder({ side: 'buy', itemKey: 'mat:cinder-ore', qty: 1, unitPrice: 1.5 })).toContain('whole number of Gold');
    expect(precheckOrder({ side: 'sell', itemKey: 'eq:anchor-ring:rare', qty: 1, unitPrice: 9 })).toBe('Choose which item to sell.');
    expect(precheckOrder({ side: 'sell', itemKey: 'eq:anchor-ring:rare', qty: 2, unitPrice: 9, instanceId: 'r' }))
      .toBe('Equipment is listed one piece at a time.');
    expect(precheckOrder({ side: 'buy', itemKey: 'mat:cinder-ore', qty: 3, unitPrice: 400 })).toBeNull();
  });

  it('keeps the server sentence and reason, and rewrites transport failures', () => {
    expect(describeMarketError({ code: 'functions/failed-precondition', message: 'Try between 105 and 1,680 Gold.', details: { reason: 'price-band' } }))
      .toEqual({ error: 'Try between 105 and 1,680 Gold.', reason: 'price-band' });
    expect(describeMarketError({ code: 'functions/unauthenticated', message: 'whatever' }).error).toBe('Sign in to trade.');
    expect(describeMarketError({ code: 'functions/unavailable', message: 'UNAVAILABLE' }).reason).toBe('offline');
    expect(describeMarketError({ code: 'functions/internal', message: 'INTERNAL' }).error).toContain('Nothing was taken');
    expect(describeMarketError(new Error('boom')).reason).toBe('internal');
  });

  it('mints request ids the server accepts', () => {
    for (let i = 0; i < 20; i++) expect(newClientRequestId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
