import {
  applyTemperBonus,
  failPolicyFor,
  previewUpgrade,
  rollUpgradeSuccess,
  successChanceFor,
  upgradeGoldCost,
  upgradeMaterialCost,
} from './item-upgrade';
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
