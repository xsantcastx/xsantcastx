import { applyOp, compareOps, emptyLedger, nextHlc } from './economy-ops';

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
});
