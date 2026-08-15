import { itemDefinitionById, rollItemStats } from './item-definition';

describe('rollItemStats', () => {
  it('multiplies the authored midpoint by the rarity band', () => {
    const def = itemDefinitionById('eclipse-longblade')!;
    const low = rollItemStats(def, 'uncommon', () => 0);
    const high = rollItemStats(def, 'uncommon', () => 1);
    expect(low.goldPerSec).toBeCloseTo(3 * 0.85, 1);
    expect(high.goldPerSec).toBeCloseTo(3 * 1.15, 1);
    expect(high.goldPerSec).toBeGreaterThan(low.goldPerSec ?? 0);
  });
});
