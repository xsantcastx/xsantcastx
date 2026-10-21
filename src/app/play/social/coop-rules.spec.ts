/**
 * coop-rules.spec.ts — the judgement calls of shared creatures (protocol 4): a member's damage claim, a party boss's
 * life, and paying each member once for a shared kill.
 */
import { BOSS_LIFE_PER_MEMBER, CLAIM_RANGE_TILES, CLAIM_TILE_PX, CLAIM_WINDOW_MS, COOP_KILL_TILES, ClaimGate, CoopRewards, claimDpsCap, coopBossLife, rescaleLife } from './coop-rules';
import { PartyShare } from './party-share';

describe('coop-rules: the host weighs a member\'s claim', () => {
  const from = { id: 'm', x: 0, y: 0, level: 10 };
  const near = { x: 40, y: 0, hp: 500 };
  it('the creature must exist, live and stand within reach of where the room last saw the member', () => {
    const g = new ClaimGate();
    expect(g.check({ d: 10 }, from, null, 0)).toEqual({ ok: false, why: 'gone' });
    expect(g.check({ d: 10 }, from, { ...near, hp: 0 }, 0)).toEqual({ ok: false, why: 'dead' });
    expect(g.check({ d: 10 }, from, { x: CLAIM_RANGE_TILES * CLAIM_TILE_PX + 1, y: 0, hp: 9 }, 0)).toEqual({ ok: false, why: 'far' });
    expect(g.check({ d: 0 }, from, near, 0)).toEqual({ ok: false, why: 'bad' });
    expect(g.check({ d: 10 }, from, near, 0)).toEqual({ ok: true, dmg: 10, clipped: false });
  });

  it('damage over the window is capped by the member\'s level: clipped, then refused, then refilled', () => {
    const g = new ClaimGate();
    const budget = claimDpsCap(10) * CLAIM_WINDOW_MS / 1000;
    expect(claimDpsCap(10)).toBe(240);
    const big = g.check({ d: budget + 500 }, from, near, 0);
    expect(big).toEqual({ ok: true, dmg: budget, clipped: true });
    expect(g.check({ d: 5 }, from, near, 100)).toEqual({ ok: false, why: 'cap' });
    expect(g.check({ d: 5 }, from, near, CLAIM_WINDOW_MS)).toEqual({ ok: true, dmg: 5, clipped: false });
    // Each member has its own budget; a level-1 Keeper's is small.
    expect(g.check({ d: 1000 }, { ...from, id: 'low', level: 1 }, near, 0)).toEqual({ ok: true, dmg: claimDpsCap(1) * 3, clipped: true });
  });
});

describe('coop-rules: a party boss', () => {
  it('+60% life for each other member present (D2-like), never below its own, at most four', () => {
    expect(BOSS_LIFE_PER_MEMBER).toBe(0.6);
    expect(coopBossLife(1000, 1)).toBe(1000);
    expect(coopBossLife(1000, 2)).toBe(1600);
    expect(coopBossLife(1000, 3)).toBe(2200);
    expect(coopBossLife(1000, 4)).toBe(2800);
    expect(coopBossLife(1000, 9)).toBe(2800);
    expect(coopBossLife(1000, 0)).toBe(1000);
  });
  it('a wounded boss keeps its share of life when the party present changes', () => {
    expect(rescaleLife(800, 1600, 1000)).toBe(500);
    expect(rescaleLife(1, 1600, 1000)).toBe(1);
    expect(rescaleLife(0, 1600, 1000)).toBe(0);
  });
});

describe('coop-rules: a shared kill pays each member once', () => {
  const me = { id: 'me', area: 'ember-isle', x: 0, y: 0 };
  const kill = (id = 'k1', by: string[] = ['me']) => ({ id, from: 'host', area: 'ember-isle', x: 32, y: 0, by });
  it('fought it: in full; only stood by: the share; elsewhere, far or the host itself: nothing', () => {
    const r = new CoopRewards();
    expect(r.decide(kill('a'), me)).toEqual({ kind: 'full' });
    expect(r.decide(kill('b', ['other']), me)).toEqual({ kind: 'share' });
    expect(r.decide({ ...kill('c'), area: 'cinder-steppe' }, me)).toEqual({ kind: 'none', why: 'area' });
    expect(r.decide({ ...kill('d'), x: COOP_KILL_TILES * CLAIM_TILE_PX + 40 }, me)).toEqual({ kind: 'none', why: 'far' });
    expect(r.decide({ ...kill('e'), from: 'me' }, me)).toEqual({ kind: 'none', why: 'self' });
  });
  it('the same kill twice pays once', () => {
    const r = new CoopRewards();
    expect(r.decide(kill(), me).kind).toBe('full');
    expect(r.decide(kill(), me)).toEqual({ kind: 'none', why: 'seen' });
  });
  it('the host\'s protocol-3 announcement of a kill in a shared area is not paid again; anyone else\'s is', () => {
    const r = new CoopRewards();
    expect(r.partyKillPays({ from: 'host', area: 'ember-isle' }, me, 'host')).toBeFalse();
    expect(r.partyKillPays({ from: 'host', area: 'cinder-steppe' }, me, 'host')).toBeTrue();
    expect(r.partyKillPays({ from: 'other', area: 'ember-isle' }, me, 'host')).toBeTrue();
    expect(r.partyKillPays({ from: 'host', area: 'ember-isle' }, me, null)).toBeTrue();
  });
  it('a share already paid through the party share cannot be paid again by the same kill id', () => {
    const share = new PartyShare(() => ({ level: 6, hp: 40 }));
    const k = { id: 'host:1:4:a', from: 'host', creature: 'ash-wolf', level: 6, hp: 40, area: 'ember-isle', x: 0, y: 0 };
    const meP = { id: 'me', area: 'ember-isle', x: 0, y: 0, level: 6, members: ['host', 'me'] };
    expect(share.accept(k, meP, 0).ok).toBeTrue();
    expect(share.accept(k, meP, 1)).toEqual({ ok: false, why: 'seen' });
  });
});
