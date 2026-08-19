import {
  STRIKE_YIELD_CAP,
  STRIKE_YIELD_PER_POINT,
  strikeCopies,
  strikeValueMultiplier,
  strikeValuePct,
} from './strike-value';

describe('strikeValueMultiplier', () => {
  it('is exactly 1.0 with nothing worn — a fresh Keeper strikes as before', () => {
    expect(strikeValueMultiplier(0)).toBe(1);
  });

  it('rises with every point and never falls', () => {
    let last = strikeValueMultiplier(0);
    for (let power = 0.5; power <= 12; power += 0.5) {
      const next = strikeValueMultiplier(power);
      expect(next).toBeGreaterThanOrEqual(last);
      last = next;
    }
    expect(strikeValueMultiplier(1)).toBeCloseTo(1 + STRIKE_YIELD_PER_POINT, 10);
    expect(strikeValueMultiplier(4)).toBeCloseTo(1 + 4 * STRIKE_YIELD_PER_POINT, 10);
  });

  it('caps at +25% from ten points on, however much more is worn', () => {
    const atCap = strikeValueMultiplier(10);
    expect(atCap).toBeCloseTo(1 + STRIKE_YIELD_CAP, 10);
    expect(strikeValueMultiplier(999)).toBe(atCap);
    expect(STRIKE_YIELD_CAP / STRIKE_YIELD_PER_POINT).toBeCloseTo(10, 10);
  });

  it('treats junk input as nothing worn rather than throwing', () => {
    expect(strikeValueMultiplier(NaN)).toBe(1);
    expect(strikeValueMultiplier(-3)).toBe(1);
    expect(strikeValueMultiplier(Infinity)).toBe(1);
  });
});

describe('strikeValuePct', () => {
  it('is zero for a fresh Keeper, not a false "+0%" badge', () => {
    expect(strikeValuePct(0)).toBe(0);
  });

  it('reads the item roll in whole percent and tops out at 25', () => {
    expect(strikeValuePct(1)).toBe(3);   // 2.5 rounds up
    expect(strikeValuePct(1.2)).toBe(3);
    expect(strikeValuePct(4)).toBe(10);
    expect(strikeValuePct(10)).toBe(25);
    expect(strikeValuePct(50)).toBe(25);
  });
});

describe('strikeCopies', () => {
  it('is always one rune with nothing worn, whatever the roll', () => {
    expect(strikeCopies(0, 0)).toBe(1);
    expect(strikeCopies(0, 0.999)).toBe(1);
    expect(strikeCopies(NaN, 0)).toBe(1);
  });

  it('lands a second copy when the roll falls under the yield bonus, and only then', () => {
    // 4 points = 10% bonus.
    expect(strikeCopies(4, 0.05)).toBe(2);
    expect(strikeCopies(4, 0.0999)).toBe(2);
    expect(strikeCopies(4, 0.1)).toBe(1);
    expect(strikeCopies(4, 0.9)).toBe(1);
  });

  it('never exceeds two, even far past the cap', () => {
    expect(strikeCopies(999, 0)).toBe(2);
    expect(strikeCopies(999, 0.2499)).toBe(2);
    expect(strikeCopies(999, 0.25)).toBe(1);
  });

  it('treats a junk roll as a miss — the bonus is a gift, never a default', () => {
    expect(strikeCopies(10, NaN)).toBe(1);
  });
});
