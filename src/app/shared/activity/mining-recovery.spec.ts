import {
  MINING_RECOVERY_BASE_MS,
  MINING_RECOVERY_FLOOR_MS,
  effectiveMiningRecoveryMs,
  miningSpeedupPct,
} from './mining-recovery';

describe('effectiveMiningRecoveryMs', () => {
  it('matches the old flat constant at level 1 with nothing equipped', () => {
    expect(effectiveMiningRecoveryMs(1, 0)).toBe(MINING_RECOVERY_BASE_MS);
  });

  it('shortens with level and caps at 35% off', () => {
    const atTen = effectiveMiningRecoveryMs(10, 0);
    const atTwenty = effectiveMiningRecoveryMs(20, 0);
    expect(atTen).toBeLessThan(MINING_RECOVERY_BASE_MS);
    expect(atTwenty).toBeLessThan(atTen);

    const capped = effectiveMiningRecoveryMs(36, 0);
    const wayPastCap = effectiveMiningRecoveryMs(50, 0);
    expect(capped).toBe(wayPastCap);
    expect(capped).toBe(Math.round(MINING_RECOVERY_BASE_MS * 0.65));
  });

  it('shortens with weapon strikePower and caps at 20% off', () => {
    const withOne = effectiveMiningRecoveryMs(1, 1);
    expect(withOne).toBeLessThan(MINING_RECOVERY_BASE_MS);

    const capped = effectiveMiningRecoveryMs(1, 10);
    const wayPastCap = effectiveMiningRecoveryMs(1, 999);
    expect(capped).toBe(wayPastCap);
    expect(capped).toBe(Math.round(MINING_RECOVERY_BASE_MS * 0.8));
  });

  it('stacks both bonuses rather than picking the larger one', () => {
    const levelOnly = effectiveMiningRecoveryMs(20, 0);
    const both = effectiveMiningRecoveryMs(20, 5);
    expect(both).toBeLessThan(levelOnly);
  });

  /*
   * The two caps compound multiplicatively (0.65 x 0.8 = 0.52), landing at
   * 1,300ms — above MINING_RECOVERY_FLOOR_MS, not equal to it. The floor is
   * deliberate headroom for a future cap change, not something today's caps
   * reach on their own; this pins that fact down so nobody "fixes" the caps
   * to hit a floor that was never meant to be the same number.
   */
  it('caps compound to a fixed minimum above the floor, however extreme the input', () => {
    const atCaps = effectiveMiningRecoveryMs(36, 10);
    const wayPastCaps = effectiveMiningRecoveryMs(999, 999);
    expect(atCaps).toBe(wayPastCaps);
    expect(atCaps).toBe(Math.round(MINING_RECOVERY_BASE_MS * 0.65 * 0.8));
    expect(atCaps).toBeGreaterThan(MINING_RECOVERY_FLOOR_MS);
  });

  it('keeps the floor at or below what the current caps can produce', () => {
    // An invariant, not a scenario: if a future cap change ever lets the
    // compounded factor imply a value under the floor, this is what would
    // start failing and is the signal to revisit MINING_RECOVERY_FLOOR_MS.
    const capsFloor = Math.round(MINING_RECOVERY_BASE_MS * 0.65 * 0.8);
    expect(MINING_RECOVERY_FLOOR_MS).toBeLessThanOrEqual(capsFloor);
  });

  it('treats junk input as the level-1, no-gear baseline rather than throwing', () => {
    expect(effectiveMiningRecoveryMs(NaN, NaN)).toBe(MINING_RECOVERY_BASE_MS);
    expect(effectiveMiningRecoveryMs(-5, -5)).toBe(MINING_RECOVERY_BASE_MS);
  });
});

describe('miningSpeedupPct', () => {
  it('is exactly zero for a fresh Keeper, not a false badge', () => {
    expect(miningSpeedupPct(1, 0)).toBe(0);
  });

  it('rises with level and gear the same direction the recovery time falls', () => {
    expect(miningSpeedupPct(10, 0)).toBeGreaterThan(0);
    expect(miningSpeedupPct(20, 0)).toBeGreaterThan(miningSpeedupPct(10, 0));
    expect(miningSpeedupPct(1, 5)).toBeGreaterThan(0);
  });

  it('caps at 48% — the two caps compounded, not summed', () => {
    expect(miningSpeedupPct(999, 999)).toBe(48);
  });
});
