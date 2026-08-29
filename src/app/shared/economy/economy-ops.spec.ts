import {
  acknowledgeAndMaybeCompact,
  applyOp,
  compactOps,
  compareOps,
  emptyLedger,
  mergeEconomyLedgers,
  nextHlc,
  parseOp,
} from './economy-ops';

describe('economy ops primitives', () => {
  it('advances the hybrid clock past both the wall and the previous stamp', () => {
    expect(nextHlc(50, 10)).toBe(51);
    expect(nextHlc(50, 80)).toBe(80);
    expect(nextHlc(0, 0)).toBe(1);
  });

  it('orders equal clocks by deviceId then seq then id', () => {
    const a = {
      id: 'aaa:1', deviceId: 'aaa', seq: 1, kind: 'spend-gold' as const,
      hlc: 7, wall: 1, amount: 1,
    };
    const b = {
      id: 'zzz:1', deviceId: 'zzz', seq: 1, kind: 'spend-gold' as const,
      hlc: 7, wall: 9_999, amount: 1,
    };
    expect(compareOps(a, b)).toBeLessThan(0);
    expect(compareOps(b, a)).toBeGreaterThan(0);
    expect(compareOps(a, a)).toBe(0);
  });

  it('skips a spend the ledger cannot afford and does not go negative', () => {
    const state = emptyLedger();
    state.gold = 100;
    expect(applyOp(state, {
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'spend-gold',
      amount: 700, hlc: 1, wall: 1,
    })).toBe(false);
    expect(state.gold).toBe(100);
  });

  it('rejects a negative debit instead of minting Gold', () => {
    const state = emptyLedger();
    expect(applyOp(state, {
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'spend-gold',
      amount: -500, hlc: 1, wall: 1,
    })).toBe(false);
    expect(state.gold).toBe(0);
    expect(parseOp({
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'spend-gold',
      amount: -500, hlc: 1, wall: 1,
    })).toBeNull();
  });

  it('drops ops whose id is not deviceId:seq', () => {
    expect(parseOp({
      id: 'other:1', deviceId: 'd', seq: 1, kind: 'credit-gold',
      amount: 10, hlc: 1, wall: 1,
    })).toBeNull();
    expect(parseOp({
      id: 'd:1', deviceId: 'd', seq: 0, kind: 'credit-gold',
      amount: 10, hlc: 1, wall: 1,
    })).toBeNull();
    expect(parseOp({
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'not-a-kind',
      amount: 10, hlc: 1, wall: 1,
    })).toBeNull();
  });

  it('keeps a zero-cost buy-upgrade and still drops every other zero amount', () => {
    // The free first Forge Bellows records `buy-upgrade` with `amount: 0`. Under
    // the old blanket `amount > 0` rule parseOp returned null for it, so the
    // rung survived locally and vanished the first time the ledger came back
    // through a cloud merge — which reads every op through this function.
    const free = parseOp({
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'buy-upgrade',
      amount: 0, itemId: 'forge-bellows', hlc: 1, wall: 1,
    });
    expect(free).not.toBeNull();
    expect(free!.amount).toBe(0);
    expect(free!.itemId).toBe('forge-bellows');

    // The widening is scoped to that one kind. A zero-Gold credit or spend is
    // still a malformed op and is still dropped.
    for (const kind of ['credit-gold', 'credit-essence', 'spend-gold', 'buy-artifact', 'prestige']) {
      expect(parseOp({
        id: 'd:1', deviceId: 'd', seq: 1, kind, amount: 0, hlc: 1, wall: 1,
      })).toBeNull();
    }
  });

  it('replays a zero-cost buy-upgrade as a level without a debit', () => {
    const state = emptyLedger();
    state.gold = 250;
    expect(applyOp(state, {
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'buy-upgrade',
      amount: 0, itemId: 'forge-bellows', hlc: 1, wall: 1,
    })).toBe(true);
    expect(state.upgrades['forge-bellows']).toBe(1);
    expect(state.gold).toBe(250);
  });

  it('omits optional fields rather than writing undefined', () => {
    const op = parseOp({
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'credit-gold',
      amount: 10, hlc: 1, wall: 1,
    });
    expect(op).not.toBeNull();
    expect('itemId' in op!).toBe(false);
    expect('slot' in op!).toBe(false);
    expect('extra' in op!).toBe(false);
    expect(Object.values(op!).some(value => value === undefined)).toBe(false);
  });
});

describe('economy merge lifecycle', () => {
  function buy(deviceId: string, seq: number, amount: number, itemId: string) {
    return {
      id: `${deviceId}:${seq}`,
      deviceId,
      seq,
      kind: 'buy-upgrade' as const,
      amount,
      itemId,
      hlc: seq,
      wall: seq,
    };
  }

  function credit(deviceId: string, seq: number, amount: number) {
    return {
      id: `${deviceId}:${seq}`,
      deviceId,
      seq,
      kind: 'credit-gold' as const,
      amount,
      hlc: seq,
      wall: seq,
    };
  }

  it('does not double-apply when a compacted ledger meets a stale full log', () => {
    const origin = emptyLedger();
    origin.gold = 10_000;
    origin.totalGoldEarned = 10_000;
    const ops = [1, 2, 3, 4, 5].map(seq => buy('phone', seq, 100, 'iron-hammer'));
    const stale = {
      ...origin,
      gold: 9_500,
      upgrades: { 'iron-hammer': 5 },
      origin,
      ops,
    };

    const folded = compactOps(origin, ops, 2);
    const compacted = {
      ...origin,
      gold: 9_500,
      upgrades: { 'iron-hammer': 5 },
      origin: folded.origin,
      ops: folded.ops,
    };

    const merged = mergeEconomyLedgers(compacted, stale);
    const swapped = mergeEconomyLedgers(stale, compacted);
    expect(merged.upgrades['iron-hammer']).toBe(5);
    expect(swapped.upgrades['iron-hammer']).toBe(5);
    expect(merged.gold).toBe(9_500);
    expect(merged.gold).toBe(swapped.gold);
  });

  it('sums independent concurrent earnings from both devices', () => {
    const origin = emptyLedger();
    const a = {
      ...origin,
      gold: 100,
      totalGoldEarned: 100,
      origin,
      ops: [credit('aaa', 1, 100)],
      hlc: 1,
    };
    const b = {
      ...origin,
      gold: 200,
      totalGoldEarned: 200,
      origin,
      ops: [credit('bbb', 1, 200)],
      hlc: 1,
    };
    const merged = mergeEconomyLedgers(a, b);
    expect(merged.gold).toBe(300);
    expect(merged.totalGoldEarned).toBe(300);
    expect(mergeEconomyLedgers(b, a).gold).toBe(300);
  });

  it('picks a deterministic payload when the same id carries two bodies', () => {
    const origin = emptyLedger();
    origin.gold = 1_000;
    const spend = {
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'spend-gold' as const,
      amount: 100, hlc: 1, wall: 1,
    };
    const other = {
      id: 'd:1', deviceId: 'd', seq: 1, kind: 'credit-gold' as const,
      amount: 50, hlc: 2, wall: 2,
    };
    const a = { ...origin, origin, ops: [spend], gold: 900 };
    const b = { ...origin, origin, ops: [other], gold: 1_050 };
    const ab = mergeEconomyLedgers(a, b);
    const ba = mergeEconomyLedgers(b, a);
    expect(ab.gold).toBe(ba.gold);
    expect(ab.ops).toEqual(ba.ops);
    expect(ab.ops.length).toBe(1);
  });

  it('ignores a negative or malformed op in a blob', () => {
    const origin = emptyLedger();
    origin.gold = 500;
    const good = credit('d', 1, 50);
    const merged = mergeEconomyLedgers(origin, {
      ...origin,
      gold: 550,
      origin,
      ops: [
        good,
        { id: 'd:2', deviceId: 'd', seq: 2, kind: 'spend-gold', amount: -400, hlc: 2, wall: 2 },
        { id: 'x', deviceId: 'd', seq: 3, kind: 'credit-gold', amount: 999, hlc: 3, wall: 3 },
      ],
    });
    expect(merged.gold).toBe(550);
    expect(merged.ops.map(o => o.id)).toEqual(['d:1']);
  });

  it('does not fold until every recently-seen device has acked', () => {
    const origin = emptyLedger();
    origin.gold = 10_000;
    const ops = [1, 2, 3, 4, 5, 6, 7, 8].map(seq => buy('phone', seq, 100, 'iron-hammer'));
    const live = mergeEconomyLedgers(origin, { ...origin, gold: 9_200, origin, ops });
    live.seenAt = { phone: 1_000, tablet: 1_000 };
    live.acks = { phone: 0 };

    const blocked = acknowledgeAndMaybeCompact(live, 'phone', 1_000, {
      after: 4, keep: 2, staleMs: 60_000,
    });
    expect(blocked.ops.length).toBe(8);
    expect(blocked.checkpointId).toBe(0);

    blocked.acks = { ...blocked.acks, tablet: 0 };
    const folded = acknowledgeAndMaybeCompact(blocked, 'phone', 1_000, {
      after: 4, keep: 2, staleMs: 60_000,
    });
    expect(folded.ops.length).toBe(2);
    expect(folded.checkpointId).toBe(1);
    expect(folded.acks['phone']).toBe(1);

    const stale = { ...origin, gold: 9_200, upgrades: { 'iron-hammer': 8 }, origin, ops };
    const merged = mergeEconomyLedgers(folded, stale);
    expect(merged.upgrades['iron-hammer']).toBe(8);
    expect(merged.gold).toBe(9_200);
  });

  it('folds when a second device has gone stale', () => {
    const origin = emptyLedger();
    origin.gold = 10_000;
    const ops = [1, 2, 3, 4, 5, 6].map(seq => buy('phone', seq, 100, 'iron-hammer'));
    const live = mergeEconomyLedgers(origin, { ...origin, gold: 9_400, origin, ops });
    live.seenAt = { phone: 100_000, tablet: 1 };
    live.acks = { phone: 0 };
    const folded = acknowledgeAndMaybeCompact(live, 'phone', 100_000, {
      after: 4, keep: 2, staleMs: 1_000,
    });
    expect(folded.checkpointId).toBe(1);
    expect(folded.ops.length).toBe(2);
  });

  it('does not let a future-dated device block compaction', () => {
    const origin = emptyLedger();
    origin.gold = 10_000;
    const ops = [1, 2, 3, 4, 5, 6].map(seq => buy('phone', seq, 100, 'iron-hammer'));
    const live = mergeEconomyLedgers(origin, { ...origin, gold: 9_400, origin, ops });
    live.seenAt = { phone: 1_000, tablet: 9_999_999_999 };
    live.acks = { phone: 0 };
    const folded = acknowledgeAndMaybeCompact(live, 'phone', 1_000, {
      after: 4, keep: 2, staleMs: 60_000,
    });
    expect(folded.checkpointId).toBe(1);
    expect(folded.ops.length).toBe(2);
    expect(folded.seenAt['tablet']).toBeUndefined();
  });
});
