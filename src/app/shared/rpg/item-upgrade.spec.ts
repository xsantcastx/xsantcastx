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
});
