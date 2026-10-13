import { GAMES_BET, gamesBetCap, gamesBetLadder } from '../economy/economy-curve';
import { betAllowed, betsOpen, clampBet, stepBet } from './bet-tiers';
import {
  PLAYS_KEPT,
  emptyGamesLedger,
  mergeGamesLedgers,
  parseGamesLedger,
  prunePlays,
  type PlayRecord,
} from './play-ledger';
import { simulateRtp, winTier } from './rtp-sim';
import { hashSeed, newSecret, pickWeighted, playSeed, seededRng } from './seeded-rng';

describe('games: seeded RNG', () => {
  it('is a pure function of the seed', () => {
    const a = seededRng('s:1'), b = seededRng('s:1'), c = seededRng('s:2');
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(c()).not.toBe(xs[0]);
    expect(hashSeed('x')).toEqual(hashSeed('x'));
  });

  it('stays in [0, 1) and is roughly uniform', () => {
    const r = seededRng('uniform');
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const x = r();
      expect(x >= 0 && x < 1).toBeTrue();
      buckets[Math.floor(x * 10)]++;
    }
    for (const n of buckets) expect(Math.abs(n - 10_000)).toBeLessThan(500);
  });

  it('seeds a play from secret and nonce; secrets are fresh hex', () => {
    expect(playSeed('abc', 3)).toBe('abc:3');
    const s = newSecret();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
    expect(newSecret()).not.toBe(s);
  });

  it('picks by weight', () => {
    const r = seededRng('w');
    const n = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) n[pickWeighted([1, 2, 7], 10, r)]++;
    expect(n[0] / 30_000).toBeCloseTo(0.1, 1);
    expect(n[2] / 30_000).toBeCloseTo(0.7, 1);
  });
});

describe('games: bet tiers on the economy curve', () => {
  it('climbs 10, 20, 50, 100 … and every rung is a multiple of 10', () => {
    const ladder = gamesBetLadder();
    expect(ladder.slice(0, 6)).toEqual([10, 20, 50, 100, 200, 500]);
    expect(ladder.every(b => b % 10 === 0)).toBeTrue();
  });

  it('caps a new Keeper at 50 and everyone at two minutes of income', () => {
    expect(gamesBetCap(0)).toBe(GAMES_BET.floorCap);
    expect(betsOpen(0)).toEqual([10, 20, 50]);
    expect(gamesBetCap(10)).toBe(1_000); // 1,200 → highest rung under it
    expect(gamesBetCap(1_000_000)).toBe(100_000_000);
    for (const gps of [0, 0.5, 3, 47, 260, 1e4, 1e7]) {
      expect(gamesBetCap(gps)).toBeLessThanOrEqual(Math.max(GAMES_BET.floorCap, GAMES_BET.incomeSeconds * gps));
    }
  });

  it('refuses a bet off the ladder or over the cap', () => {
    expect(betAllowed(10, 0)).toBeTrue();
    expect(betAllowed(100, 0)).toBeFalse();
    expect(betAllowed(15, 100)).toBeFalse();
    expect(clampBet(10_000, 0)).toBe(50);
    expect(stepBet(50, 1, 0)).toBe(50);
    expect(stepBet(20, -1, 0)).toBe(10);
  });
});

describe('games: play ledger (pure)', () => {
  const rec = (seq: number, paid = true): PlayRecord<{ cells: string[] }> => ({
    game: 'reels', bet: 10, seed: `s:${seq}`, seq, at: '2026-10-13T00:00:00.000Z', win: 0, outcome: { cells: ['ash', 'ash', 'cinder'] }, paid,
  });

  it('reads malformed blobs as empty', () => {
    expect(parseGamesLedger(null)).toEqual(emptyGamesLedger());
    expect(parseGamesLedger({ plays: { x: 5 }, nonce: -3 }).nonce).toBe(0);
  });

  it('keeps the newest plays and never drops an unpaid one', () => {
    const plays: Record<string, PlayRecord> = {};
    for (let i = 0; i < PLAYS_KEPT + 10; i++) plays[`p${i}`] = rec(i, i !== 0);
    const kept = prunePlays(plays);
    expect(Object.keys(kept).length).toBe(PLAYS_KEPT + 1);
    expect(kept['p0']).toBeTruthy();
    expect(kept[`p${PLAYS_KEPT + 9}`]).toBeTruthy();
  });

  it('merges two devices without corrupting outcomes or un-paying a play', () => {
    const remote = { ...emptyGamesLedger(), secret: 'r', nonce: 4, plays: { a: rec(1, true) }, totals: { reels: { plays: 4, wagered: 40, paid: 30 } } };
    const local = { ...emptyGamesLedger(), secret: 'l', nonce: 2, plays: { a: rec(1, false), b: rec(2) }, totals: { reels: { plays: 2, wagered: 50, paid: 0 } } };
    const m = mergeGamesLedgers(remote, local);
    expect(m.secret).toBe('l');
    expect(m.nonce).toBe(4);
    expect(m.plays['a'].paid).toBeTrue();
    expect((m.plays['a'].outcome as { cells: string[] }).cells).toEqual(['ash', 'ash', 'cinder']);
    expect(Object.keys(m.plays).sort()).toEqual(['a', 'b']);
    expect(m.totals['reels']).toEqual({ plays: 4, wagered: 50, paid: 30 });
  });
});

describe('games: RTP harness and win tiers', () => {
  it('measures a known game exactly', () => {
    // Pays 2× half the time: RTP 1.0.
    const rep = simulateRtp({ play: r => r() < 0.5, value: w => (w ? 20 : 0) }, 200_000, 10, 'coin');
    expect(rep.rtp).toBeCloseTo(1, 1);
    expect(rep.hitRate).toBeCloseTo(0.5, 1);
    expect(rep.maxX).toBe(2);
  });

  it('names Big ≥10×, Mega ≥50×, Eclipse Win ≥200×', () => {
    expect(winTier(90, 10)).toBeNull();
    expect(winTier(100, 10)).toBe('big');
    expect(winTier(500, 10)).toBe('mega');
    expect(winTier(2_000, 10)).toBe('eclipse');
    expect(winTier(0, 10)).toBeNull();
  });
});
