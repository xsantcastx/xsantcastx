import {
  applyUpgradeBonus,
  failPolicyFor,
  previewUpgrade,
  rollUpgradeSuccess,
  successChanceFor,
  upgradeGoldCost,
  upgradeMaterialCost,
  MAX_UPGRADE_LEVEL,
} from './item-upgrade';
import type { GameItem, ItemStats } from './item.model';

function blade(level = 0): GameItem {
  return {
    id: 'edge',
    name: 'Basalt Edge',
    type: 'artifact',
    rarity: 'uncommon',
    stats: { goldPerSec: 2, magicFind: 1 },
    sellValue: 0,
    equipped: false,
    foundAt: '2026-08-01T00:00:00.000Z',
    soulbound: true,
    upgradeLevel: level,
  };
}

describe('item upgrade table', () => {
  it('keeps the authored chance and cost curve', () => {
    expect(successChanceFor(0)).toBe(0.9);
    expect(successChanceFor(9)).toBe(0.25);
    expect(upgradeGoldCost(1)).toBeGreaterThan(upgradeGoldCost(0));
    expect(upgradeGoldCost(4)).toBeGreaterThan(upgradeGoldCost(3) * 2);
    expect(upgradeMaterialCost(0)).toEqual([{ id: 'cinder-ore', quantity: 4 }]);
    expect(upgradeMaterialCost(2).some(row => row.id === 'ember-residue')).toBe(true);
  });

  it('uses consume-only fails at low levels and downgrade flags at high levels', () => {
    expect(failPolicyFor(2).downgradeOnFail).toBe(false);
    expect(failPolicyFor(2).shatterOnFail).toBe(false);
    expect(failPolicyFor(8).downgradeOnFail).toBe(true);
    expect(failPolicyFor(8).shatterOnFail).toBe(false);
  });

  it('previews the next level and refuses a maxed item', () => {
    const first = previewUpgrade(blade(0));
    expect(first?.nextLevel).toBe(1);
    expect(first?.gold).toBe(upgradeGoldCost(0));
    expect(previewUpgrade(blade(MAX_UPGRADE_LEVEL))).toBeNull();
  });

  it('rolls success against the authored table', () => {
    expect(rollUpgradeSuccess(0, () => 0.89)).toBe(true);
    expect(rollUpgradeSuccess(0, () => 0.91)).toBe(false);
  });

  it('adds a small fixed step so a rarity jump still outruns ten tempers', () => {
    const up = applyUpgradeBonus({ goldPerSec: 2 }, 'uncommon', 1);
    expect(up.goldPerSec).toBe(2.2);
    const down = applyUpgradeBonus(up, 'uncommon', -1);
    expect(down.goldPerSec).toBe(2);
    let walk: ItemStats = { goldPerSec: 2 };
    for (let i = 0; i < 10; i++) walk = applyUpgradeBonus(walk, 'uncommon', 1);
    expect(walk.goldPerSec ?? 0).toBeLessThan(6);
  });
});
