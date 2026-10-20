/**
 * keeper-level.spec.ts — the Keeper curve to 10,000 (docs/design/leveling.md §1–2): monotone, the inverse of itself,
 * never a level lost against the old Hunting reading, and bounded stats and points at the top.
 */
import { KEEPER_MAX_LEVEL, LEVEL_SPEED, levelSpeedBonus, keeperLevelForXp, keeperLevelView, keeperXpForLevel, levelAttributePoints, levelSteps } from './keeper-level';
import { levelForXp, xpForLevel } from '../activity/mining-level';
import { levelStats } from '../../play/td/td-skills';

describe('Keeper level curve', () => {
  it('climbs strictly, and each level costs more than the one before it', () => {
    let prevStep = 0;
    for (let L = 2; L <= KEEPER_MAX_LEVEL; L++) {
      const step = keeperXpForLevel(L) - keeperXpForLevel(L - 1);
      expect(step).withContext(`level ${L}`).toBeGreaterThan(0);
      if (L > 3) expect(step).withContext(`step into ${L}`).toBeGreaterThanOrEqual(prevStep);
      prevStep = step;
    }
  });

  it('never drops a save: every level costs no more than it did on the Hunting skill curve', () => {
    for (let L = 1; L <= KEEPER_MAX_LEVEL; L++) expect(keeperXpForLevel(L)).withContext(`level ${L}`).toBeLessThanOrEqual(xpForLevel(L));
    // …so any stored XP total reads as the same or a higher level.
    const samples = [0, 1, 11, 12, 99, 100, 3_000, 12_569, 12_570, 250_000, 2_402_687, 9e6, 4.5e8, 1.9e9, 1.2e11, 2e12];
    for (let i = 0; i < 400; i++) samples.push(Math.floor(Math.pow(10, (i / 400) * 12.3)));
    for (const xp of samples) expect(keeperLevelForXp(xp)).withContext(`${xp} XP`).toBeGreaterThanOrEqual(levelForXp(xp));
  });

  it('is its own inverse: the XP of a level reads as that level, one less reads as the level below', () => {
    for (const L of [2, 3, 5, 9, 10, 11, 49, 50, 51, 99, 100, 101, 999, 1000, 4321, 9999, 10_000]) {
      expect(keeperLevelForXp(keeperXpForLevel(L))).withContext(`${L}`).toBe(L);
      expect(keeperLevelForXp(keeperXpForLevel(L) - 1)).withContext(`${L} - 1 XP`).toBe(L - 1);
    }
    expect(keeperLevelForXp(Number.MAX_SAFE_INTEGER)).toBe(KEEPER_MAX_LEVEL);
    expect(keeperLevelForXp(-5)).toBe(1);
    expect(keeperLevelForXp(NaN)).toBe(1);
  });

  it('lands the early bands: 10 in about an hour of Ember Isle (3–4k XP), 50 under 300k', () => {
    expect(keeperXpForLevel(10)).toBeGreaterThan(3_000);
    expect(keeperXpForLevel(10)).toBeLessThan(4_500);
    expect(keeperXpForLevel(50)).toBeLessThan(300_000);
  });

  it('the view: XP inside the level, the span, what is left to the next; full at the top', () => {
    const v = keeperLevelView(keeperXpForLevel(12) + 7);
    expect(v.level).toBe(12);
    expect(v.into).toBe(7);
    expect(v.span).toBe(keeperXpForLevel(13) - keeperXpForLevel(12));
    expect(v.toNext).toBe(v.span - 7);
    const top = keeperLevelView(keeperXpForLevel(KEEPER_MAX_LEVEL) + 5);
    expect(top.level).toBe(KEEPER_MAX_LEVEL);
    expect(top.span).toBe(0);
    expect(top.toNext).toBe(0);
  });

  it('keeps today\'s stats to 100 and stays bounded at 10,000', () => {
    for (let L = 1; L <= 100; L++) expect(levelSteps(L)).toBe(L - 1);
    expect(levelStats(50).maxHp).toBe(100 + 49 * 8);
    expect(levelStats(50).power).toBeCloseTo(1 + 49 * .05, 9);
    for (let L = 101; L <= KEEPER_MAX_LEVEL; L += 37) expect(levelSteps(L)).toBeGreaterThan(levelSteps(L - 1));
    const top = levelStats(KEEPER_MAX_LEVEL);
    expect(top.maxHp).toBeLessThan(5_000);
    expect(top.maxMana).toBeLessThan(3_000);
    expect(top.power).toBeLessThan(25);
  });

  it('attribute points: five a level to 100, then fewer, never shrinking', () => {
    expect(levelAttributePoints(1)).toBe(0);
    expect(levelAttributePoints(3)).toBe(10);
    expect(levelAttributePoints(100)).toBe(495);
    expect(levelAttributePoints(101)).toBe(496);
    expect(levelAttributePoints(1000)).toBe(1395);
    expect(levelAttributePoints(KEEPER_MAX_LEVEL)).toBe(2295);
    for (let L = 2; L <= KEEPER_MAX_LEVEL; L += 13) expect(levelAttributePoints(L)).toBeGreaterThanOrEqual(levelAttributePoints(L - 1));
  });
});

describe('keeper-level speed by level (Tibia: higher level, faster feet)', () => {
  it('starts at nothing, grows smoothly ~0.15 % a level, and levels off at the cap', () => {
    expect(levelSpeedBonus(1)).toBe(0);
    expect(levelSpeedBonus(2)).toBeCloseTo(0.0015, 4);
    expect(levelSpeedBonus(10)).toBeCloseTo(0.0133, 3);
    expect(levelSpeedBonus(100)).toBeCloseTo(0.1315, 3);
    expect(levelSpeedBonus(1000)).toBeCloseTo(0.5506, 3);
    expect(levelSpeedBonus(KEEPER_MAX_LEVEL)).toBeLessThanOrEqual(LEVEL_SPEED.cap);
    expect(levelSpeedBonus(KEEPER_MAX_LEVEL)).toBeCloseTo(LEVEL_SPEED.cap, 4);
    let prev = -1;
    for (let L = 1; L <= KEEPER_MAX_LEVEL; L += 37) { const b = levelSpeedBonus(L); expect(b).toBeGreaterThan(prev); prev = b; }
    expect(levelSpeedBonus(NaN)).toBe(0);
    expect(levelSpeedBonus(1e9)).toBeLessThanOrEqual(LEVEL_SPEED.cap);
  });
});
