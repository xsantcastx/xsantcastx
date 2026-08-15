import { itemDefinitionById, mintEquipment, rollItemStats } from './item-definition';

describe('item definition rolls', () => {
  it('rolls two mints of the same def and rarity to different stats', () => {
    const def = itemDefinitionById('eclipse-longblade')!;
    const a = rollItemStats(def, 'rare', () => 0);
    const b = rollItemStats(def, 'rare', () => 1);
    expect(a.goldPerSec).toBeTruthy();
    expect(b.goldPerSec).toBeGreaterThan(a.goldPerSec ?? 0);
    const first = mintEquipment('eclipse-longblade', 'rare', () => 0, '2026-08-01T00:00:00.000Z', 'a');
    const second = mintEquipment('eclipse-longblade', 'rare', () => 1, '2026-08-01T00:00:00.000Z', 'b');
    expect(first?.stats.goldPerSec).not.toBe(second?.stats.goldPerSec);
    expect(first?.definitionId).toBe('eclipse-longblade');
  });

  it('does not roll keys the definition does not list', () => {
    const def = itemDefinitionById('astral-helm')!;
    const stats = rollItemStats(def, 'epic', () => 0.5);
    expect(stats.xpBonus).toBeTruthy();
    expect(stats.goldPerSec).toBeUndefined();
  });

  it('refuses to mint materials', () => {
    expect(mintEquipment('cinder-ore', 'common')).toBeNull();
  });

  it('freezes the rolled block on the instance', () => {
    const item = mintEquipment('basalt-edge', 'uncommon', () => 0.2, '2026-08-01T00:00:00.000Z', 'edge')!;
    const rolled = item.stats.goldPerSec;
    const again = rollItemStats(itemDefinitionById('basalt-edge')!, 'mythic', () => 1);
    expect(item.stats.goldPerSec).toBe(rolled);
    expect(again.goldPerSec).not.toBe(rolled);
  });

  it('prices the first Basalt temper at four 10k strikes', () => {
    const edge = itemDefinitionById('basalt-edge')!;
    const cuirass = itemDefinitionById('infernal-cuirass')!;
    expect(edge.temperGoldBase).toBe(40_000);
    expect(cuirass.base.goldPerSec).toBe(5);
    const uncommon = rollItemStats(cuirass, 'uncommon', () => 0.5);
    expect(uncommon.goldPerSec).toBeGreaterThan(4);
    expect(uncommon.goldPerSec).toBeLessThan(7);
  });
});
