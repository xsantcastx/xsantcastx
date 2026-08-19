import {
  ARTIFACT_SUCCESS_CHANCE,
  MIN_TEMPER_FAIL_CHANCE,
  UPGRADE_SUCCESS_CHANCE,
  WARD_FAIL_REDUCTION_CAP,
  WARD_FAIL_REDUCTION_PER_POINT,
  applyTemperBonus,
  failPolicyFor,
  previewUpgrade,
  rollUpgradeSuccess,
  successChanceFor,
  temperFailChance,
  upgradeGoldCost,
  upgradeMaterialCost,
  wardFailReductionPct,
} from './item-upgrade';
import { itemDefinitionById } from './item-definition';
import type { GameItem } from './item.model';

function blade(level = 0): GameItem {
  return {
    id: 'edge',
    name: 'Basalt Edge',
    type: 'artifact',
    rarity: 'uncommon',
    stats: { goldPerSec: 2 },
    sellValue: 0,
    equipped: false,
    foundAt: '2026-08-01T00:00:00.000Z',
    soulbound: true,
    upgradeLevel: level,
    definitionId: 'basalt-edge',
  };
}

describe('item upgrade table', () => {
  it('keeps the authored chance and 1.65 cost curve', () => {
    expect(successChanceFor(0)).toBe(0.9);
    expect(successChanceFor(9)).toBe(0.25);
    expect(upgradeGoldCost(1)).toBeGreaterThan(upgradeGoldCost(0));
    expect(upgradeGoldCost(2) / upgradeGoldCost(0)).toBeCloseTo(1.65 * 1.65, 2);
    expect(upgradeMaterialCost(0)).toEqual([{ id: 'cinder-ore', quantity: 1 }]);
    expect(upgradeMaterialCost(1).some(row => row.id === 'ember-residue' && row.quantity === 1)).toBe(true);
    expect(upgradeMaterialCost(7).some(row => row.id === 'ember-residue' && row.quantity === 2)).toBe(true);
  });

  it('defaults harsh fail flags off', () => {
    expect(failPolicyFor(2).downgradeOnFail).toBe(false);
    expect(failPolicyFor(8).shatterOnFail).toBe(false);
    expect(failPolicyFor(8).downgradeOnFail).toBe(false);
  });

  it('previews the next level and refuses a maxed item', () => {
    const first = previewUpgrade(blade(0));
    expect(first?.nextLevel).toBe(1);
    expect(first?.gold).toBe(upgradeGoldCost(0, 40_000));
    expect(previewUpgrade(blade(10))).toBeNull();
  });

  it('rolls success against the authored table', () => {
    expect(rollUpgradeSuccess(0, () => 0.89)).toBe(true);
    expect(rollUpgradeSuccess(0, () => 0.91)).toBe(false);
  });

  it('adds 3–8% of the primary stat and does not re-roll the item', () => {
    const up = applyTemperBonus(blade(0), () => 0);
    expect(up.goldPerSec ?? 0).toBeGreaterThan(2);
    expect(up.goldPerSec ?? 0).toBeLessThan(2.3);
    expect(up.magicFind).toBeUndefined();
  });

  /*
   * Rounding to one decimal used to erase a real chunk of successful tempers:
   * on a common Basalt Edge (~1.3 goldPerSec) a 3-8% gain is 0.04-0.10, and
   * anything under 0.05 rounded straight back to the starting number. A
   * player could pay 40,000+ gold, roll a success, and see nothing change.
   * Every roll in the success range must now produce a visible gain.
   */
  it('never lets a successful temper round back to the starting value', () => {
    const common: GameItem = { ...blade(0), rarity: 'common', stats: { goldPerSec: 1.3 } };
    for (let i = 0; i <= 20; i++) {
      const roll = i / 20; // sweep the full 3-8% pct range rollUpgradeSuccess draws from
      const up = applyTemperBonus(common, () => roll);
      expect(up.goldPerSec).toBeGreaterThan(1.3);
    }
  });

  it('keeps the smallest visible step to two decimals, not a float artifact', () => {
    const common: GameItem = { ...blade(0), rarity: 'common', stats: { goldPerSec: 1.3 } };
    const up = applyTemperBonus(common, () => 0);
    // 1.3 * 1.03 * 0.85 (common scale) lands just under the old 0.05 rounding
    // threshold; confirm it is still exactly representable at 2 decimals.
    expect(Number.isInteger((up.goldPerSec ?? 0) * 100)).toBe(true);
  });
});

describe('temper fail chance and ward', () => {
  it('hands the authored fail chance back untouched with no ward worn', () => {
    expect(temperFailChance(0.1, 0)).toBe(0.1);
    expect(temperFailChance(0.75, 0)).toBe(0.75);
    expect(temperFailChance(0.1, NaN)).toBe(0.1);
    expect(temperFailChance(0.1, -2)).toBe(0.1);
  });

  it('turns 10% of the fail chance aside per point of ward', () => {
    expect(temperFailChance(0.1, 1)).toBeCloseTo(0.09, 10);
    expect(temperFailChance(0.75, 1)).toBeCloseTo(0.675, 10);
    expect(temperFailChance(0.75, 2)).toBeCloseTo(0.6, 10);
  });

  it('caps at 30% off the fail chance from three points on', () => {
    const atCap = temperFailChance(0.75, 3);
    expect(atCap).toBeCloseTo(0.525, 10);
    expect(temperFailChance(0.75, 50)).toBe(atCap);
    expect(WARD_FAIL_REDUCTION_CAP / WARD_FAIL_REDUCTION_PER_POINT).toBeCloseTo(3, 10);
  });

  it('is monotonic in ward and never makes a temper less likely to hold', () => {
    let last = temperFailChance(0.5, 0);
    for (let ward = 0.1; ward <= 6; ward += 0.1) {
      const next = temperFailChance(0.5, ward);
      expect(next).toBeLessThanOrEqual(last);
      last = next;
    }
  });

  /*
   * The floor is a backstop, not a target. Today's best case is level 0's 10%
   * fail × 0.7 = 7%, above MIN_TEMPER_FAIL_CHANCE — this pins that fact so a
   * later cap or table change that would let ward dig under it starts failing
   * here instead of quietly making a temper a sure thing.
   */
  it('keeps the floor under what today\'s tables and cap can reach', () => {
    const bestFail = 1 - Math.max(...UPGRADE_SUCCESS_CHANCE, ...ARTIFACT_SUCCESS_CHANCE);
    expect(temperFailChance(bestFail, 999)).toBeGreaterThan(MIN_TEMPER_FAIL_CHANCE);
    expect(MIN_TEMPER_FAIL_CHANCE).toBeLessThanOrEqual(bestFail * (1 - WARD_FAIL_REDUCTION_CAP));
  });

  it('never lets ward dig under the floor, and never lifts a base already under it', () => {
    expect(temperFailChance(0.06, 999)).toBe(MIN_TEMPER_FAIL_CHANCE);
    // An authored 2% fail stays 2%: the floor stops ward from digging, it does
    // not push a written chance up.
    expect(temperFailChance(0.02, 999)).toBe(0.02);
  });

  it('reads out in whole percent, capped, zero for a fresh Keeper', () => {
    expect(wardFailReductionPct(0)).toBe(0);
    expect(wardFailReductionPct(0.5)).toBe(5);
    expect(wardFailReductionPct(1)).toBe(10);
    expect(wardFailReductionPct(3)).toBe(30);
    expect(wardFailReductionPct(9)).toBe(30);
  });

  it('keeps the success table exact at ward 0 and lifts it with ward, both families', () => {
    for (let level = 0; level < UPGRADE_SUCCESS_CHANCE.length; level++) {
      expect(successChanceFor(level)).toBe(UPGRADE_SUCCESS_CHANCE[level]);
      expect(successChanceFor(level, undefined, 1)).toBeGreaterThan(UPGRADE_SUCCESS_CHANCE[level]);
    }
    const heart = itemDefinitionById('obsidian-heart')!;
    expect(heart.family).toBe('artifact');
    for (let level = 0; level < ARTIFACT_SUCCESS_CHANCE.length; level++) {
      expect(successChanceFor(level, heart)).toBe(ARTIFACT_SUCCESS_CHANCE[level]);
      expect(successChanceFor(level, heart, 2)).toBeGreaterThan(ARTIFACT_SUCCESS_CHANCE[level]);
    }
    // Level 9: 25% → fail 75% → ward 3 → fail 52.5% → success 47.5%.
    expect(successChanceFor(9, undefined, 3)).toBeCloseTo(0.475, 10);
  });

  it('never lifts a zero authored chance — ward mitigates failure, it does not invent success', () => {
    const pastTable = UPGRADE_SUCCESS_CHANCE.length + 5;
    expect(successChanceFor(pastTable)).toBe(0);
    expect(successChanceFor(pastTable, undefined, 3)).toBe(0);
    const heart = itemDefinitionById('obsidian-heart')!;
    expect(successChanceFor(ARTIFACT_SUCCESS_CHANCE.length + 5, heart, 3)).toBe(0);
  });

  it('feeds the same ward into the preview and the roll, so they cannot disagree', () => {
    const plain = previewUpgrade(blade(9))!;
    const warded = previewUpgrade(blade(9), 3)!;
    expect(plain.successChance).toBe(0.25);
    expect(warded.successChance).toBeCloseTo(0.475, 10);
    // 0.4 fails the authored 25% and holds under 3 ward.
    expect(rollUpgradeSuccess(9, () => 0.4)).toBe(false);
    expect(rollUpgradeSuccess(9, () => 0.4, undefined, 3)).toBe(true);
    // 0.6 fails both: ward is a thumb on the scale, not a guarantee.
    expect(rollUpgradeSuccess(9, () => 0.6, undefined, 3)).toBe(false);
  });
});
