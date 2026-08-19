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
    expect(stats.strikePower).toBeUndefined();
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

  it('mints the Basalt Edge with strikePower — the one craftable weapon has to feed the Seamworks and the Forge', () => {
    // B2 scope deviation, accepted: `mintEquipment` is only ever called from
    // forge-recipes.ts (Basalt Edge). Without strikePower on this def neither
    // strikePower consumer — mining recovery, forge yield — could fire in real
    // play. goldPerSec stays the primary key; the strikePower base is the
    // Eclipse Longblade anchor. Only *newly* crafted Edges carry it: an
    // instance's rolled block is frozen at mint (see the spec above), so an
    // Edge minted before this change never gains the stat.
    const edge = itemDefinitionById('basalt-edge')!;
    expect(edge.rollKeys[0]).toBe('goldPerSec');
    expect(edge.rollKeys).toContain('strikePower');
    expect(edge.base.strikePower).toBe(itemDefinitionById('eclipse-longblade')!.base.strikePower);
    for (const roll of [0, 0.5, 1]) {
      const minted = mintEquipment('basalt-edge', 'uncommon', () => roll, '2026-08-01T00:00:00.000Z', `edge-${roll}`)!;
      expect(minted.stats.strikePower).toBeGreaterThan(0);
      expect(minted.stats.goldPerSec).toBeGreaterThan(0);
    }
  });

  it('prices the first Basalt temper at four 10k strikes', () => {
    const edge = itemDefinitionById('basalt-edge')!;
    const cuirass = itemDefinitionById('infernal-cuirass')!;
    expect(edge.temperGoldBase).toBe(40_000);
    expect(cuirass.base.goldPerSec).toBe(0.45);
    // The band this samples moved when roll grades landed: `rollItemStats` now
    // multiplies the tier *ceiling* by a grade drawn from `QUALITY_BAND`, so a
    // mid-band Uncommon sits lower than it did under the old floor-to-ceiling
    // sample. The ceiling itself is unchanged — see RARITY_MULT's header.
    const uncommon = rollItemStats(cuirass, 'uncommon', () => 0.5);
    expect(uncommon.goldPerSec).toBeGreaterThan(0.2);
    expect(uncommon.goldPerSec).toBeLessThan(0.5);
    const best = rollItemStats(cuirass, 'uncommon', () => 1);
    expect(best.goldPerSec).toBeGreaterThan(uncommon.goldPerSec!);
  });

  it('authors the Keeper kit to the roll/temper spec table', () => {
    const kit = [
      ['eclipse-longblade', 'weapon', 'neutral', 'goldPerSec', 0.4],
      ['keeper-staff', 'weapon', 'neutral', 'xpBonus', 2],
      ['void-buckler', 'off-hand', 'void-touched', 'ward', 1],
      ['keepers-cowl', 'head', 'neutral', 'magicFind', 1.5],
      ['keepers-mantle', 'chest', 'neutral', 'goldPerSec', 0.25],
      ['godforge-gauntlets', 'hands', 'neutral', 'strikePower', 1.2],
      ['astral-pendant', 'trinket', 'celestial', 'magicFind', 2],
      ['anchor-ring', 'trinket', 'celestial', 'ward', 0.5],
      ['astral-helm', 'head', 'celestial', 'xpBonus', 2.5],
      ['infernal-cuirass', 'chest', 'infernal', 'goldPerSec', 0.45],
      ['luminous-greaves', 'legs', 'luminous', 'magicFind', 2],
      ['verdant-bracers', 'hands', 'verdant', 'xpBonus', 1.5],
    ] as const;
    for (const [id, slot, style, key, mid] of kit) {
      const def = itemDefinitionById(id)!;
      expect(def.slot).toBe(slot);
      expect(def.style).toBe(style);
      expect(def.rollKeys[0]).toBe(key);
      expect(def.base[key]).toBe(mid);
      expect(def.maxTemper).toBe(10);
    }
  });
});
