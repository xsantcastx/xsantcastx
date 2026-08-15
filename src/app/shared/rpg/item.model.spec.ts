import { itemDefinitionById, rollItemStats } from './item-definition';
import { formatItemMod, mintCharm } from './item.model';

describe('rollItemStats', () => {
  it('multiplies the authored midpoint by the rarity band', () => {
    const def = itemDefinitionById('eclipse-longblade')!;
    const low = rollItemStats(def, 'uncommon', () => 0);
    const high = rollItemStats(def, 'uncommon', () => 1);
    expect(low.goldPerSec).toBeCloseTo(0.4 * 0.85, 1);
    expect(high.goldPerSec).toBeCloseTo(0.4 * 1.15, 1);
    expect(high.goldPerSec).toBeGreaterThan(low.goldPerSec ?? 0);
  });
});

describe('mintCharm', () => {
  it('freezes the seed Magic Find and does not roll a definition band', () => {
    const charm = mintCharm({
      id: 'charm-fortune',
      name: 'Small Charm of Fortune',
      rarity: 'common',
      magicFind: 5,
      weight: 1,
      lore: 'fixed',
    });
    expect(charm.stats).toEqual({ magicFind: 5 });
    expect(charm.definitionId).toBeUndefined();
    expect(formatItemMod('magicFind', 5)).toBe('Magic Find +5%');
    expect(formatItemMod('goldPerSec', 2.4)).toBe('Gold/sec +2.4');
    expect(formatItemMod('goldPerSec', 1_250)).toBe('Gold/sec +1.3K');
  });
});
