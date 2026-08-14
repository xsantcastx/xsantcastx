import {
  acknowledgeAndMaybeCompact,
  applyOp,
  applyOps,
  emptyLedger,
  mergeEconomyLedgers,
} from './economy-ops';
import {
  beginCommerceOp,
  commitCommerceOp,
  compactCommerceReceipts,
  debitGrantOnce,
  findCommerceByKey,
  mergeCommerceOps,
  parseCommerceOp,
  quoteIsStale,
  reconcileCommerceOps,
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

function buyOp(deviceId: string, seq: number, amount: number, itemId: string, hlc = seq) {
  return {
    id: `${deviceId}:${seq}`,
    deviceId,
    seq,
    kind: 'buy-upgrade' as const,
    amount,
    itemId,
    hlc,
    wall: hlc,
  };
}

describe('commerce operations (C2)', () => {
  it('rejects a stale quoted price', () => {
    expect(quoteIsStale(58, 50)).toBe(true);
    expect(quoteIsStale(50, 50)).toBe(false);
  });

  it('replays a committed mutation key without a second debit', () => {
    const first = commitCommerceOp(beginCommerceOp({
      mutationKey: 'buy:unique-1',
      listingId: 'forge-bellows',
      kind: 'upgrade',
      expectedCost: 50,
    }, 'gold', 10), 'dev:1');
    expect(debitGrantOnce(first)).toBe('replay');
    expect(debitGrantOnce(first)).toBe('replay');
  });

  it('blocks a second activation while the first is in flight', () => {
    const pending = beginCommerceOp({
      mutationKey: 'buy:unique-2',
      listingId: 'forge-bellows',
      kind: 'upgrade',
      expectedCost: 50,
    }, 'gold', 10);
    expect(debitGrantOnce(pending)).toBe('blocked');
  });

  it('recovers a crash: pending with no applied ledger op rolls back', () => {
    const pending = op({ mutationKey: 'k1', economicOpId: 'dev:3' });
    const recovered = reconcileCommerceOps([pending], new Set(), new Set());
    expect(recovered[0].status).toBe('rolled-back');
    expect(debitGrantOnce(recovered[0])).toBe('apply');
  });

  it('recovers a crash: pending whose economy op applied commits', () => {
    const pending = op({ mutationKey: 'k2', economicOpId: 'dev:4' });
    const recovered = reconcileCommerceOps([pending], new Set(['dev:4']), new Set(['dev:4']));
    expect(recovered[0].status).toBe('committed');
    expect(recovered[0].grantId).toBe('grant:dev:4');
    expect(debitGrantOnce(recovered[0])).toBe('replay');
  });

  it('marks a skipped merge loser as rejected, not committed', () => {
    const pending = op({
      mutationKey: 'loser',
      listingId: 'ember-stoker',
      expectedCost: 200,
      economicOpId: 'tablet:1',
    });
    const recovered = reconcileCommerceOps(
      [pending],
      new Set(['phone:1']),
      new Set(['phone:1', 'tablet:1']),
    );
    expect(recovered[0].status).toBe('rejected');
    expect(debitGrantOnce(recovered[0])).toBe('conflict');
  });

  it('one debit and one grant survive reversed merge and repeated delivery', () => {
    const origin = emptyLedger();
    origin.gold = 200;
    const debit = buyOp('phone', 1, 50, 'forge-bellows');
    const receipt = commitCommerceOp(op({
      mutationKey: 'buy:unique-merge',
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

  it('two devices spending the same balance reject the unaffordable loser', () => {
    const origin = emptyLedger();
    origin.gold = 200;
    const bellows = buyOp('phone', 1, 50, 'forge-bellows', 1);
    const stoker = buyOp('tablet', 1, 200, 'ember-stoker', 1);
    const win = commitCommerceOp(op({
      id: 'c-win', mutationKey: 'buy:phone-bellows', listingId: 'forge-bellows',
      expectedCost: 50, economicOpId: 'phone:1', createdAt: 1,
    }), 'phone:1');
    const lose = commitCommerceOp(op({
      id: 'c-lose', mutationKey: 'buy:tablet-stoker', listingId: 'ember-stoker',
      expectedCost: 200, economicOpId: 'tablet:1', createdAt: 2,
    }), 'tablet:1');

    const phone = {
      ...origin, gold: 150, upgrades: { 'forge-bellows': 1 },
      origin, ops: [bellows], commerceOps: [win],
    };
    const tablet = {
      ...origin, gold: 0, upgrades: { 'ember-stoker': 1 },
      origin, ops: [stoker], commerceOps: [lose],
    };

    const ab = mergeEconomyLedgers(phone, tablet);
    const ba = mergeEconomyLedgers(tablet, phone);
    expect(ab.gold).toBe(ba.gold);
    expect(ab.upgrades).toEqual(ba.upgrades);
    const replay = applyOps(origin, [bellows, stoker]);
    expect(replay.appliedIds).toContain('phone:1');
    expect(replay.skippedIds).toContain('tablet:1');
    expect(ab.commerceOps.find(o => o.mutationKey === 'buy:phone-bellows')?.status).toBe('committed');
    expect(ab.commerceOps.find(o => o.mutationKey === 'buy:tablet-stoker')?.status).toBe('rejected');
    expect(ba.commerceOps.find(o => o.mutationKey === 'buy:tablet-stoker')?.status).toBe('rejected');
    expect(ab.gold).toBe(150);
    expect(ab.upgrades['forge-bellows']).toBe(1);
    expect(ab.upgrades['ember-stoker']).toBeUndefined();
  });

  it('retries a compacted mutation key without a second debit', () => {
    const receipts = Array.from({ length: 70 }, (_, i) => commitCommerceOp(op({
      id: `c-${i}`,
      mutationKey: `buy:old-${i}`,
      expectedCost: 50,
      createdAt: i + 1,
    }), `dev:${i + 1}`));
    const compacted = compactCommerceReceipts(receipts, {}, { after: 64, keep: 16 });
    expect(compacted.ops.length).toBe(16);
    expect(compacted.appliedKeys['buy:old-0']).toBe('committed');
    const found = findCommerceByKey(compacted.ops, compacted.appliedKeys, 'buy:old-0');
    expect(found?.status).toBe('committed');
    expect(debitGrantOnce(found)).toBe('replay');
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

  it('folds receipts at a ledger checkpoint and still finds the key', () => {
    const origin = emptyLedger();
    origin.gold = 10_000;
    const ops = Array.from({ length: 8 }, (_, i) => buyOp('phone', i + 1, 50, 'forge-bellows', i + 1));
    const receipts = ops.map((ledgerOp, i) => commitCommerceOp(op({
      id: `c-${i}`, mutationKey: `buy:chk-${i}`, createdAt: i + 1, economicOpId: ledgerOp.id,
    }), ledgerOp.id));
    const live = mergeEconomyLedgers(origin, {
      ...origin, gold: 9_600, origin, ops, commerceOps: receipts,
    });
    live.seenAt = { phone: 1_000 };
    live.acks = { phone: 0 };
    const folded = acknowledgeAndMaybeCompact(live, 'phone', 1_000, {
      after: 4, keep: 2, staleMs: 60_000,
    });
    expect(folded.checkpointId).toBe(1);
    expect(findCommerceByKey(folded.commerceOps, folded.commerceApplied, 'buy:chk-0')?.status)
      .toBe('committed');
  });
});
