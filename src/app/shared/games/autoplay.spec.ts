import { GAMES_BET, gamesBetCap, gamesHighStake } from '../economy/economy-curve';
import { AUTO_COUNTS, autoAfter, autoCanSpin, startAuto } from './autoplay';
import { betAllowed, betChips, highStake } from './bet-tiers';

describe('autoplay', () => {
  const stops = { bonus: true, winX: 0, floorShare: 0 };

  it('offers ×10, ×25, ×50, ×100 and until stopped', () => {
    expect(AUTO_COUNTS).toEqual([10, 25, 50, 100, Infinity]);
  });

  it('runs its count, then stops', () => {
    let run = startAuto(3, stops, 1_000);
    for (let i = 0; i < 2; i++) {
      expect(autoCanSpin(run, 1_000, 10, true)).toBeNull();
      const after = autoAfter(run, { bet: 10, win: 0, bonus: false });
      expect(after.stop).toBeNull();
      run = after.run;
    }
    expect(autoAfter(run, { bet: 10, win: 5, bonus: false }).stop).toBe('count');
    expect(autoAfter(run, { bet: 10, win: 5, bonus: false }).run.net).toBe(-25);
  });

  it('until stopped never ends on its own count', () => {
    let run = startAuto(Infinity, stops, 1_000);
    for (let i = 0; i < 500; i++) {
      const after = autoAfter(run, { bet: 10, win: 0, bonus: false });
      expect(after.stop).toBeNull();
      run = after.run;
    }
    expect(autoCanSpin(run, 1_000, 10, true)).toBeNull();
  });

  it('stops on a bonus (when asked), on a big win, at the Gold floor, when short, or when the bet closes', () => {
    const run = startAuto(25, stops, 1_000);
    expect(autoAfter(run, { bet: 10, win: 0, bonus: true }).stop).toBe('bonus');
    expect(autoAfter(startAuto(25, { ...stops, bonus: false }, 1_000), { bet: 10, win: 0, bonus: true }).stop).toBeNull();
    const big = startAuto(25, { ...stops, winX: 50 }, 1_000);
    expect(autoAfter(big, { bet: 10, win: 499, bonus: false }).stop).toBeNull();
    expect(autoAfter(big, { bet: 10, win: 500, bonus: false }).stop).toBe('win');
    const floor = startAuto(25, { ...stops, floorShare: 0.5 }, 1_000);
    expect(floor.floor).toBe(500);
    expect(autoCanSpin(floor, 510, 10, true)).toBeNull();
    expect(autoCanSpin(floor, 505, 10, true)).toBe('floor');
    expect(autoCanSpin(run, 5, 10, true)).toBe('funds');
    expect(autoCanSpin(run, 1_000, 10, false)).toBe('bet');
  });
});

describe('higher bets', () => {
  it('a deep purse opens up to 1% of it, never more than an hour of income', () => {
    // No purse: the two-minute cap, as before.
    expect(gamesBetCap(1_000)).toBe(100_000);
    // 1% of a big purse, under an hour of income (3.6M): 1,000,000 → the rung 1,000,000.
    expect(gamesBetCap(1_000, 100_000_000)).toBe(1_000_000);
    // A hoard far past the income: still an hour of income at most.
    expect(gamesBetCap(1_000, 1e15)).toBe(2_000_000);
    expect(gamesBetCap(1_000, 1e15)).toBeLessThanOrEqual(GAMES_BET.purseIncomeSeconds * 1_000);
    // No income, a purse: the floor (a purse alone opens nothing; the cap follows the curve).
    expect(gamesBetCap(0, 1e12)).toBe(GAMES_BET.floorCap);
    expect(betAllowed(1_000_000, 1_000, 100_000_000)).toBeTrue();
    expect(betAllowed(1_000_000, 1_000)).toBeFalse();
  });

  it('quick picks land on open rungs; Max is a high stake above two minutes of income', () => {
    const chips = betChips(1_000, 1_000, 100_000_000);
    expect(chips.min).toBe(10);
    expect(chips.half).toBe(500);
    expect(chips.double).toBe(2_000);
    expect(chips.max).toBe(1_000_000);
    expect(highStake(chips.max, 1_000)).toBeTrue();
    expect(highStake(100_000, 1_000)).toBeFalse();
    expect(gamesHighStake(50, 0)).toBeFalse();
  });
});
