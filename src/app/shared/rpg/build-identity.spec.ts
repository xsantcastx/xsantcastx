/**
 * build-identity.spec.ts — the archetype a loadout reads as.
 *
 * Pure function, no TestBed: nothing here touches a service or the DOM.
 */
import { deriveBuild } from './build-identity';
import type { GameItem, ItemRarity, ItemStats, SlotId } from './item.model';

function item(id: string, stats: ItemStats, rarity: ItemRarity = 'common'): GameItem {
  return { id, name: id, rarity, stats, type: 'artifact', equipped: true } as unknown as GameItem;
}

function worn(map: Partial<Record<SlotId, GameItem>>): Partial<Record<SlotId, GameItem>> {
  return map;
}

describe('deriveBuild', () => {
  it('calls an empty loadout unforged, with no bars', () => {
    const build = deriveBuild({});
    expect(build.archetype).toBe('unforged');
    expect(build.axis).toBeNull();
    expect(build.contributions).toEqual([]);
    expect(build.itemCount).toBe(0);
  });

  it('survives a null map', () => {
    expect(deriveBuild(null).archetype).toBe('unforged');
    expect(deriveBuild(undefined).archetype).toBe('unforged');
  });

  it('ignores items that carry nothing, and negative or non-finite values', () => {
    const build = deriveBuild(worn({
      head: item('blank', {}),
      chest: item('broken', { ward: -3, goldPerSec: Number.NaN }),
    }));
    expect(build.archetype).toBe('unforged');
    expect(build.itemCount).toBe(0);
  });

  it('reads a strike-heavy loadout as a Vanguard', () => {
    const build = deriveBuild(worn({
      weapon: item('edge', { strikePower: 3, goldPerSec: 0.4 }),
      hands: item('grips', { strikePower: 1.2 }),
    }));
    expect(build.archetype).toBe('vanguard');
    expect(build.axis).toBe('strike');
    expect(build.contributions[0].key).toBe('strikePower');
    expect(build.contributions[0].top?.id).toBe('edge');
  });

  it('pools Magic Find and Loot quality into a Treasure Seeker', () => {
    const build = deriveBuild(worn({
      charm1: item('fortune', { magicFind: 5 }),
      trinket: item('loot', { lootBonus: 5 }),
      head: item('ward-cap', { ward: 0.8 }),
    }));
    expect(build.archetype).toBe('treasure-seeker');
    expect(build.axis).toBe('treasure');
  });

  it('reads gold income as a Forgewright', () => {
    const build = deriveBuild(worn({ charm1: item('coin', { goldPerSec: 20 }, 'epic') }));
    expect(build.archetype).toBe('forgewright');
  });

  it('reads ward as a Bulwark', () => {
    const build = deriveBuild(worn({
      chest: item('plate', { ward: 2 }),
      legs: item('greaves', { ward: 1, xpBonus: 1 }),
    }));
    expect(build.archetype).toBe('bulwark');
  });

  it('reads XP as a Lorekeeper', () => {
    const build = deriveBuild(worn({ charm2: item('tome', { xpBonus: 18 }, 'epic') }));
    expect(build.archetype).toBe('lorekeeper');
  });

  it('calls an even split a Wanderer', () => {
    // A fresh Basalt Edge: one Common piece of gold, one of strike.
    const build = deriveBuild(worn({ weapon: item('basalt-edge', { goldPerSec: 2, strikePower: 1 }) }));
    expect(build.archetype).toBe('wanderer');
    expect(build.axis).toBeNull();
    expect(build.contributions.length).toBe(2);
  });

  it('needs a clear margin over the runner-up, not just the biggest share', () => {
    // strike 1.0 vs ward 0.9: the lead is real but not decisive.
    const build = deriveBuild(worn({
      weapon: item('a', { strikePower: 1 }),
      chest: item('b', { ward: 0.9 }),
    }));
    expect(build.archetype).toBe('wanderer');
  });

  it('keeps the top three contributions, heaviest first, with shares that sum to at most 1', () => {
    const build = deriveBuild(worn({
      weapon: item('w', { strikePower: 4 }),
      chest: item('c', { ward: 2 }),
      head: item('h', { goldPerSec: 2 }),
      charm1: item('m', { magicFind: 1 }),
    }));
    expect(build.contributions.map(row => row.key)).toEqual(['strikePower', 'ward', 'goldPerSec']);
    const shares = build.contributions.reduce((sum, row) => sum + row.share, 0);
    expect(shares).toBeLessThanOrEqual(1);
    expect(build.contributions[0].share).toBeGreaterThan(build.contributions[1].share);
  });

  it('names the item giving the most of each stat and sums the rest', () => {
    const build = deriveBuild(worn({
      weapon: item('big', { strikePower: 2.5 }, 'rare'),
      hands: item('small', { strikePower: 0.5 }),
    }));
    const strike = build.contributions[0];
    expect(strike.total).toBe(3);
    expect(strike.top).toEqual({ id: 'big', name: 'big', rarity: 'rare', value: 2.5 });
  });

  it('counts only items that carry a stat', () => {
    const build = deriveBuild(worn({
      weapon: item('w', { strikePower: 1 }),
      head: item('empty', {}),
    }));
    expect(build.itemCount).toBe(1);
  });

  it('honours a smaller limit', () => {
    const build = deriveBuild(worn({
      weapon: item('w', { strikePower: 4, ward: 1, goldPerSec: 1 }),
    }), 1);
    expect(build.contributions.length).toBe(1);
  });
});
