import { seededRng } from '../games/seeded-rng';
import { wholeGold } from '../games/rtp-sim';
import {
  SEAM_COLLAPSES,
  SEAM_MAX_X,
  SEAM_RTP,
  canDigMore,
  drawSeam,
  playSeamRound,
  seamDeepest,
  seamFair,
  seamMultiplier,
  seamReturnAt,
  seamWin,
} from './seam-sweeper.model';

describe('Seam Sweeper model', () => {
  it('draws m distinct collapse cells from the seed, the same every time', () => {
    for (let m = SEAM_COLLAPSES.min; m <= SEAM_COLLAPSES.max; m++) {
      const o = drawSeam(seededRng(`seam:${m}`), m);
      expect(o.layout.length).toBe(m);
      expect(new Set(o.layout).size).toBe(m);
      expect(o.layout.every(c => c >= 0 && c < 25)).toBeTrue();
      expect(drawSeam(seededRng(`seam:${m}`), m)).toEqual(o);
    }
  });

  it('every cash-out the board offers returns exactly the stated RTP (95%)', () => {
    expect(SEAM_RTP).toBe(0.95);
    for (let m = SEAM_COLLAPSES.min; m <= SEAM_COLLAPSES.max; m++) {
      expect(seamDeepest(m)).toBeGreaterThan(0);
      for (let k = 1; k <= seamDeepest(m); k++) {
        expect(seamReturnAt(m, k)).toBeCloseTo(SEAM_RTP, 12);
        expect(seamMultiplier(m, k)).toBeLessThanOrEqual(SEAM_MAX_X);
      }
    }
    // A known value: 3 collapses, 2 ore = 0.95 × 25·24 / (22·21).
    expect(seamMultiplier(3, 2)).toBeCloseTo(0.95 * 600 / 462, 12);
    // 24 collapses: one ore cell, ×23.75, and nothing after it.
    expect(seamMultiplier(24, 1)).toBeCloseTo(23.75, 12);
    expect(canDigMore(24, 1)).toBeFalse();
  });

  it('a collapse pays nothing; no ore pays nothing; ore pays bet × multiplier', () => {
    const o = { collapses: 3, layout: [0, 1, 2], u: 0.5 };
    expect(seamWin(o, { dug: [5], hit: 0 }, 100)).toBe(0);
    expect(seamWin(o, { dug: [] }, 100)).toBe(0);
    expect(seamWin(o, { dug: [5, 6] }, 100)).toBe(wholeGold(100 * seamMultiplier(3, 2), 0.5));
  });

  it('wholeGold pays the fraction with exactly its chance', () => {
    expect(wholeGold(13.7, 0.69)).toBe(14);
    expect(wholeGold(13.7, 0.71)).toBe(13);
    expect(wholeGold(12, 0.99)).toBe(12);
    expect(wholeGold(0, 0)).toBe(0);
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += wholeGold(9.3, (i + 0.5) / 1000);
    expect(sum / 1000).toBeCloseTo(9.3, 10);
  });

  it('fair multiplier is 1 / chance of k ore in a row', () => {
    let p = 1;
    for (let k = 0; k < 5; k++) p *= (25 - 5 - k) / (25 - k);
    expect(seamFair(5, 5)).toBeCloseTo(1 / p, 10);
  });

  // 300k whole rounds at the 10-Gold minimum (rounding included), 3 collapses,
  // cash out after 3 ore: per-round sd ≈ 0.67× bet, so a run's sd ≈ 0.12
  // points; ±1 point ≈ 8 sd. Fixed seed: deterministic.
  it('300k simulated rounds land within 1 point of 95% (seed karma:seam)', () => {
    const rng = seededRng('karma:seam');
    let back = 0;
    const n = 300_000;
    for (let i = 0; i < n; i++) back += playSeamRound(rng, 10, 3, 3).win;
    expect(Math.abs(back / (n * 10) - SEAM_RTP)).toBeLessThan(0.01);
  });
});
