import { seededRng } from '../games/seeded-rng';
import {
  ASCENT_FLOOR,
  ASCENT_MAX,
  ASCENT_RTP,
  ascentAt,
  ascentStatus,
  ascentWin,
  drawAscent,
  holdChance,
  msToReach,
  playAscentRound,
} from './eclipse-ascent.model';

/** An rng that returns these values in order. */
function seq(...xs: number[]): () => number {
  const q = [...xs];
  return () => q.shift() ?? 0;
}

describe('Eclipse Ascent model', () => {
  it('draws the break point from the tail RTP / x', () => {
    // a = 0.5 → 95 / 0.5 = 190 → ×1.90
    expect(drawAscent(seq(0.5, 0.3)).crash).toBe(190);
    // a = 0 → 95 → under ×1.01 → breaks at once
    expect(drawAscent(seq(0, 0.3)).crash).toBe(ASCENT_FLOOR);
    // a → 1 → capped at ×1,000
    expect(drawAscent(seq(0.9999999, 0.3)).crash).toBe(ASCENT_MAX);
  });

  it('a cash-out at any multiplier returns exactly RTP', () => {
    for (const x of [101, 137, 200, 999, 10_000, 100_000]) expect((x / 100) * holdChance(x)).toBeCloseTo(ASCENT_RTP, 12);
  });

  it('cash-out math: paid at or under the break, lost above it', () => {
    const o = { crash: 250, u: 0 };
    expect(ascentWin(o, { startedAt: 0, auto: 0, cashedAt: 250 }, 100)).toBe(250);
    expect(ascentWin(o, { startedAt: 0, auto: 0, cashedAt: 137 }, 100)).toBe(137);
    expect(ascentWin(o, { startedAt: 0, auto: 0, cashedAt: 251 }, 100)).toBe(0);
    expect(ascentWin(o, { startedAt: 0, auto: 0 }, 100)).toBe(0);
    // bet 10 at ×1.37 = 13.7 Gold: 14 when u < 0.7, else 13.
    expect(ascentWin({ crash: 250, u: 0.6 }, { startedAt: 0, auto: 0, cashedAt: 137 }, 10)).toBe(14);
    expect(ascentWin({ crash: 250, u: 0.8 }, { startedAt: 0, auto: 0, cashedAt: 137 }, 10)).toBe(13);
  });

  it('the clock doubles the multiplier every 6 s, and status follows it', () => {
    expect(ascentAt(0)).toBe(100);
    expect(ascentAt(6_000)).toBe(200);
    expect(ascentAt(12_000)).toBe(400);
    expect(Math.round(msToReach(200))).toBe(6_000);
    const o = { crash: 300, u: 0 };
    expect(ascentStatus(o, { startedAt: 0, auto: 0 }, 3_000)).toEqual({ kind: 'rising', x: ascentAt(3_000) });
    expect(ascentStatus(o, { startedAt: 0, auto: 0 }, 60_000)).toEqual({ kind: 'broke', x: 300 });
    expect(ascentStatus(o, { startedAt: 0, auto: 150 }, 60_000)).toEqual({ kind: 'cashed', x: 150 });
    expect(ascentStatus(o, { startedAt: 0, auto: 500 }, 60_000)).toEqual({ kind: 'broke', x: 300 });
  });

  // 400k rounds cashing out at ×2.00, bet 10: per-round sd ≈ 0.95× bet, so a
  // run's sd ≈ 0.15 points; ±1 point is ~6 sd. Fixed seed: deterministic.
  it('400k simulated rounds at ×2 land within 1 point of 95% (seed karma:ascent)', () => {
    const rng = seededRng('karma:ascent');
    let back = 0;
    const n = 400_000;
    for (let i = 0; i < n; i++) back += playAscentRound(rng, 10, 200).win;
    expect(Math.abs(back / (n * 10) - ASCENT_RTP)).toBeLessThan(0.01);
  });
});
