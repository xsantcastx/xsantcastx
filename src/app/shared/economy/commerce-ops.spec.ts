import {
  applyOp,
  emptyLedger,
  mergeEconomyLedgers,
} from './economy-ops';
import {
  beginCommerceOp,
  commitCommerceOp,
  debitGrantOnce,
  findCommerceByKey,
  mergeCommerceOps,
  parseCommerceOp,
  quoteIsStale,
  recoverCommerceOps,
  rollbackCommerceOp,
  upsertCommerceOp,
  type CommerceOperation,
} from './commerce-ops';

function op(partial: Partial<CommerceOperation> & Pick<CommerceOperation, 'mutationKey'>): CommerceOperation {
  return {
    id: partial.id ?? `c-${partial.mutationKey}`,
    listingId: 'forge-bellows',
    kind: 'upgrade',
    expectedCost: 50,
    currency: 'gold',
    economicOpId: null,
    grantId: null,
    status: 'pending',
    createdAt: 1,
    ...partial,
  };
}

describe('commerce operations (C2)', () => {
  it('rejects a stale quoted price', () => {
    expect(quoteIsStale(58, 50)).toBe(true);
    expect(quoteIsStale(50, 50)).toBe(false);
  });

  it('replays a committed mutation key without a second debit', () => {
    const first = commitCommerceOp(beginCommerceOp({
      mutationKey: 'buy:forge-bellows:50:0',
      listingId: 'forge-bellows',
      kind: 'upgrade',
      expectedCost: 50,
      currency: 'gold',
    }, 10), 'dev:1');
    expect(debitGrantOnce(first)).toBe('replay');
    expect(debitGrantOnce(first)).toBe('replay');
  });

  it('blocks a second activation while the first is in flight', () => {
    const pending = beginCommerceOp({
      mutationKey: 'buy:forge-bellows:50:0',
      listingId: 'forge-bellows',
      kind: 'upgrade',
      expectedCost: 50,
      currency: 'gold',
    }, 10);
    expect(debitGrantOnce(pending)).toBe('blocked');
  });

  it('recovers a crash: pending with no ledger op rolls back', () => {
    const pending = op({ mutationKey: 'k1', economicOpId: 'dev:3' });
    const recovered = recoverCommerceOps([pending], new Set());
    expect(recovered[0].status).toBe('rolled-back');
    expect(debitGrantOnce(recovered[0])).toBe('apply');
  });

  it('recovers a crash: pending whose economy op landed commits', () => {
    const pending = op({ mutationKey: 'k2', economicOpId: 'dev:4' });
    const recovered = recoverCommerceOps([pending], new Set(['dev:4']));
    expect(recovered[0].status).toBe('committed');
    expect(recovered[0].grantId).toBe('grant:dev:4');
    expect(debitGrantOnce(recovered[0])).toBe('replay');
  });

  it('one debit and one grant survive reversed merge and repeated delivery', () => {
    const origin = emptyLedger();
    origin.gold = 200;
    const debit = {
      id: 'phone:1', deviceId: 'phone', seq: 1, kind: 'buy-upgrade' as const,
      amount: 50, itemId: 'forge-bellows', hlc: 1, wall: 1,
    };
    const receipt = commitCommerceOp(op({
      mutationKey: 'buy:forge-bellows:50:0',
      economicOpId: 'phone:1',
      createdAt: 1,
    }), 'phone:1');

    const a = {
      ...origin,
      gold: 150,
      upgrades: { 'forge-bellows': 1 },
      origin,
      ops: [debit],
      commerceOps: [receipt],
    };
    const b = {
      ...origin,
      gold: 150,
      upgrades: { 'forge-bellows': 1 },
      origin,
      ops: [debit],
      commerceOps: [receipt, receipt],
    };

    const ab = mergeEconomyLedgers(a, b);
    const ba = mergeEconomyLedgers(b, a);
    expect(ab.gold).toBe(150);
    expect(ba.gold).toBe(150);
    expect(ab.upgrades['forge-bellows']).toBe(1);
    expect(ba.upgrades['forge-bellows']).toBe(1);
    expect(ab.ops.filter(o => o.id === 'phone:1')).toHaveSize(1);
    expect(mergeCommerceOps(a.commerceOps, b.commerceOps).filter(o => o.mutationKey === receipt.mutationKey))
      .toHaveSize(1);
  });

  it('keeps gold and ownership consistent when a spend cannot be afforded', () => {
    const state = emptyLedger();
    state.gold = 10;
    const applied = applyOp(state, {
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'buy-upgrade',
      amount: 50, itemId: 'forge-bellows', hlc: 1, wall: 1,
    });
    expect(applied).toBe(false);
    expect(state.gold).toBe(10);
    expect(state.upgrades['forge-bellows']).toBeUndefined();
    const rolled = rollbackCommerceOp(op({ mutationKey: 'k3', expectedCost: 50 }));
    expect(rolled.status).toBe('rolled-back');
  });

  it('drops malformed commerce rows', () => {
    expect(parseCommerceOp({ mutationKey: 'x' })).toBeNull();
    expect(parseCommerceOp({
      id: 'c1', mutationKey: 'k', listingId: 'a', kind: 'trade',
      expectedCost: 1, currency: 'gold', status: 'committed', createdAt: 1,
    })).toBeNull();
  });

  it('lets a rolled-back key apply once, then replay', () => {
    const rolled = rollbackCommerceOp(op({ mutationKey: 'k4' }));
    expect(debitGrantOnce(rolled)).toBe('apply');
    const committed = commitCommerceOp(rolled, 'dev:8');
    expect(debitGrantOnce(committed)).toBe('replay');
    expect(upsertCommerceOp([rolled], committed).map(o => o.status)).toEqual(['committed']);
  });
});
