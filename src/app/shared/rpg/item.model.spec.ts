import { rollItemStats } from './item.model';

describe('rollItemStats', () => {
  it('rolls inside the rarity band and never returns the same default block', () => {
    const low = rollItemStats('uncommon', 'artifact', () => 0);
    const high = rollItemStats('uncommon', 'artifact', () => 1);
    expect(low.goldPerSec).toBe(1);
    expect(high.goldPerSec).toBe(4);
    expect(low.goldPerSec).not.toBe(high.goldPerSec);
    const mythic = rollItemStats('mythic', 'artifact', () => 0.5);
    expect(mythic.goldPerSec ?? 0).toBeGreaterThan(high.goldPerSec ?? 0);
  });

  it('does not invent stats the rarity band does not own', () => {
    const common = rollItemStats('common', 'artifact', () => 0.5);
    expect(common.lootBonus).toBeUndefined();
    expect(common.goldPerSec).toBeTruthy();
  });
});
