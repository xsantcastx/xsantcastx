import { itemDefinitionById, rollItemStats } from './item-definition';
import { QUALITY_BAND } from './item-quality';
import {
  ALL_CHARMS,
  GOLD_CHARMS,
  MF_CHARMS,
  XP_CHARMS,
  charmFamily,
  formatItemMod,
  mintCharm,
  rollCharmSeed,
  type ItemRarity,
} from './item.model';

describe('rollItemStats', () => {
  it('multiplies the tier ceiling by the rolled grade', () => {
    // Was: sampled between the rarity band's floor and ceiling. Now the ceiling
    // is the anchor and the *grade* is what varies, so a maxed Uncommon lands on
    // exactly the number the old band topped out at and a floor roll sits well
    // below where the old floor was. See item-quality.ts.
    const def = itemDefinitionById('eclipse-longblade')!;
    const low = rollItemStats(def, 'uncommon', () => 0);
    const high = rollItemStats(def, 'uncommon', () => 1);
    // Rolled stats are rounded to one decimal at mint, so the expectations are
    // rounded the same way rather than compared at full precision.
    const round = (n: number) => Math.round(n * 10) / 10;
    const ceiling = 0.4 * 1.15;
    expect(high.goldPerSec).toBe(round(ceiling * QUALITY_BAND.uncommon.max));
    expect(low.goldPerSec).toBe(round(ceiling * QUALITY_BAND.uncommon.min));
    expect(high.goldPerSec).toBeGreaterThan(low.goldPerSec ?? 0);
  });
});

describe('mintCharm', () => {
  it('reads the seed value as a ceiling and never rolls above it', () => {
    // Charms used to mint at exactly their authored number. They now roll like
    // everything else, with the authored number as the *best* case — so a maxed
    // roll reproduces the old fixed value and nothing exceeds it.
    const seed = {
      id: 'charm-fortune',
      name: 'Small Charm of Fortune',
      rarity: 'common' as const,
      stats: { magicFind: 5 },
      weight: 1,
      lore: 'fixed',
    };
    const charm = mintCharm(seed, undefined, () => 1);
    const dud = mintCharm(seed, undefined, () => 0);
    expect(charm.stats).toEqual({ magicFind: 5 });
    expect(charm.rollQuality).toEqual({ magicFind: 1 });
    expect(dud.stats.magicFind!).toBeLessThan(5);
    expect(dud.rollQuality?.magicFind).toBe(0);
    expect(charm.definitionId).toBeUndefined();
    expect(formatItemMod('magicFind', 5)).toBe('Magic Find +5%');
    expect(formatItemMod('goldPerSec', 2.4)).toBe('Gold/sec +2.4');
    expect(formatItemMod('goldPerSec', 1_250)).toBe('Gold/sec +1.3K');
  });

  it('copies the stat block rather than aliasing the seed', () => {
    // The seeds are module-level constants. Handing a minted charm a reference
    // to one would mean tempering or any future stat edit rewriting the table
    // for every charm the player ever finds.
    const seed = {
      id: 'charm-copper-knot', name: 'Copper Knot', rarity: 'common' as const,
      stats: { goldPerSec: 2 }, weight: 1, lore: 'fixed',
    };
    const charm = mintCharm(seed, undefined, () => 1);
    expect(charm.stats).not.toBe(seed.stats);
    expect(charm.stats).toEqual({ goldPerSec: 2 });
    expect(seed.stats).toEqual({ goldPerSec: 2 });
  });

  it('mints whatever stat the family carries, not just Magic Find', () => {
    const xp = mintCharm({
      id: 'charm-margin-note', name: 'Margin Note', rarity: 'rare' as const,
      stats: { xpBonus: 10 }, weight: 1, lore: 'fixed',
    }, undefined, () => 1);
    expect(xp.stats).toEqual({ xpBonus: 10 });
    expect(xp.stats.magicFind).toBeUndefined();
  });
});

describe('the charm table', () => {
  it('carries three families on one rarity ladder', () => {
    expect(MF_CHARMS.length).toBe(5);
    expect(GOLD_CHARMS.length).toBe(5);
    expect(XP_CHARMS.length).toBe(5);
    expect(ALL_CHARMS.length).toBe(15);
  });

  it('gives every charm exactly one stat, and a non-zero one', () => {
    // A charm with two stats would be strictly better than a charm with one at
    // the same rarity, which collapses the three-way choice the wells exist for.
    for (const charm of ALL_CHARMS) {
      const keys = Object.keys(charm.stats);
      expect(keys.length).toBe(1);
      expect(charm.stats[keys[0] as keyof typeof charm.stats]).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids or names', () => {
    expect(new Set(ALL_CHARMS.map(c => c.id)).size).toBe(ALL_CHARMS.length);
    expect(new Set(ALL_CHARMS.map(c => c.name)).size).toBe(ALL_CHARMS.length);
  });

  it('weights the three families identically so a drop is an even split', () => {
    // This is what keeps `CHARM_DROP_CHANCE`'s 3x compensation exact: if the
    // families drifted apart in weight, tripling the drop rate would no longer
    // hold Magic Find supply flat.
    const total = (rows: typeof MF_CHARMS) => rows.reduce((sum, c) => sum + c.weight, 0);
    expect(total(GOLD_CHARMS)).toBeCloseTo(total(MF_CHARMS), 10);
    expect(total(XP_CHARMS)).toBeCloseTo(total(MF_CHARMS), 10);
  });

  it('climbs with rarity inside every family', () => {
    const ladder: ItemRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    for (const family of [MF_CHARMS, GOLD_CHARMS, XP_CHARMS]) {
      expect(family.map(c => c.rarity)).toEqual(ladder);
      const values = family.map(c => Object.values(c.stats)[0] as number);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
      // Rarer is also rarer, or the ladder is decorative.
      for (let i = 1; i < family.length; i++) {
        expect(family[i].weight).toBeLessThan(family[i - 1].weight);
      }
    }
  });

  it('names the family a charm belongs to, and nothing for a stranger', () => {
    expect(charmFamily('charm-void-fragment')).toBe('find');
    expect(charmFamily('charm-unspent-hoard')).toBe('fortune');
    expect(charmFamily('charm-whole-account')).toBe('insight');
    expect(charmFamily('seed-helm')).toBeNull();
  });

  it('rolls the common tier almost always and the mythic almost never', () => {
    expect(rollCharmSeed(() => 0).rarity).toBe('common');
    // rng() just under 1 lands at the far end of the weighted table, which is
    // the last family's mythic.
    expect(rollCharmSeed(() => 0.999999999).rarity).toBe('mythic');
  });

  it('reaches all three families across the weighted range', () => {
    // One sample per family's common band. The bands are contiguous in
    // ALL_CHARMS order, so a third of the way in is the second family.
    const families = new Set(
      [0.1, 0.45, 0.8].map(r => charmFamily(rollCharmSeed(() => r).id)),
    );
    expect(families.size).toBe(3);
  });
});
