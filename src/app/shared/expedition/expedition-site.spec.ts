/**
 * expedition-site.spec.ts — the promises the site cards make.
 *
 * Every assertion here is a claim a card prints to the player. The balance rule
 * in particular is not a style preference: a hard site that paid a worse rate
 * than the easy one would be a trap, and a trap that the numbers hide is worse
 * than no site at all.
 */
import {
  EXPEDITION_SITES,
  NEUTRAL_SITE,
  defaultSiteFor,
  siteBlock,
  siteById,
  siteProfile,
  sitesInRealm,
} from './expedition-site.model';
import { REALMS } from '../realms/realm.model';

describe('expedition sites', () => {
  it('gives every realm exactly three, easy to deep', () => {
    for (const realm of REALMS) {
      const sites = sitesInRealm(realm.id);
      expect(sites.length).withContext(realm.name).toBe(3);
      expect(sites.map(s => s.tier)).toEqual(['outer', 'inner', 'deep']);
    }
  });

  it('has fifteen places and no duplicate ids', () => {
    expect(EXPEDITION_SITES.length).toBe(15);
    expect(new Set(EXPEDITION_SITES.map(s => s.id)).size).toBe(15);
  });

  it('never makes the shallow site the efficient one', () => {
    /*
     * The same property `explorer.model.spec.ts` pins over the mission ladder,
     * restated along the site axis: Gold per unit time must not fall as the
     * site gets harder. If it ever did, the optimal play would become "run the
     * outer site forever", and the two rungs above it would be decoration.
     */
    for (const realm of REALMS) {
      const rates = sitesInRealm(realm.id)
        .map(s => s.goldMultiplier / s.durationMultiplier);
      for (let i = 1; i < rates.length; i++) {
        expect(rates[i])
          .withContext(`${realm.name} tier ${i}`)
          .toBeGreaterThan(rates[i - 1]);
      }
    }
  });

  it('makes the deeper site worth more per dispatch, not just per hour', () => {
    for (const realm of REALMS) {
      const golds = sitesInRealm(realm.id).map(s => s.goldMultiplier);
      for (let i = 1; i < golds.length; i++) {
        expect(golds[i]).toBeGreaterThan(golds[i - 1]);
      }
    }
  });

  it('charges more and takes longer the deeper it goes', () => {
    for (const realm of REALMS) {
      const sites = sitesInRealm(realm.id);
      for (let i = 1; i < sites.length; i++) {
        expect(sites[i].costMultiplier).toBeGreaterThan(sites[i - 1].costMultiplier);
        expect(sites[i].durationMultiplier).toBeGreaterThanOrEqual(sites[i - 1].durationMultiplier);
        expect(sites[i].difficulty).toBeGreaterThan(sites[i - 1].difficulty);
      }
    }
  });

  it('puts the walls and the rune floor only on the sites that earn them', () => {
    for (const site of EXPEDITION_SITES) {
      if (site.tier === 'outer') {
        expect(site.minKeeperLevel).withContext(site.name).toBeUndefined();
        expect(site.minExplorerLevel).withContext(site.name).toBeUndefined();
        expect(site.runeFloor).withContext(site.name).toBeUndefined();
      }
      if (site.tier === 'deep') {
        // The deep tier's whole identity is the floor: it is the only thing a
        // site gives that Gold cannot buy at any price. A deep site without one
        // is the middle site with a longer clock.
        expect(site.runeFloor).withContext(site.name).toBeGreaterThan(0);
        expect(site.minExplorerLevel).withContext(site.name).toBeGreaterThan(0);
        expect(site.exclusive).withContext(site.name).toBeTruthy();
      }
    }
  });

  it('promises something on every card', () => {
    for (const site of EXPEDITION_SITES) {
      expect(site.finds.length).withContext(site.name).toBeGreaterThan(0);
      expect(site.flavour.length).withContext(site.name).toBeGreaterThan(10);
    }
  });
});

describe('site resolution', () => {
  it('resolves an absent id to a completely free profile', () => {
    /*
     * The migration contract. Every expedition written before sites existed has
     * no `siteId`, and settling one has to pay exactly what it would have paid
     * then — which means every multiplier on the fallback is 1 and there is no
     * floor. This is the single assertion that keeps old saves honest.
     */
    const p = siteProfile(undefined);
    expect(p.goldMultiplier).toBe(1);
    expect(p.xpMultiplier).toBe(1);
    expect(p.runeChanceMultiplier).toBe(1);
    expect(p.materialMultiplier).toBe(1);
    expect(p.durationMultiplier).toBe(1);
    expect(p.costMultiplier).toBe(1);
    expect(p.runeFloor).toBeUndefined();
    expect(p).toBe(NEUTRAL_SITE);
  });

  it('resolves an id that is not a site to the same free profile', () => {
    expect(siteProfile('a-place-that-does-not-exist')).toBe(NEUTRAL_SITE);
    expect(siteById('a-place-that-does-not-exist')).toBeUndefined();
  });

  it('defaults a realm to its outer site, which has no walls', () => {
    for (const realm of REALMS) {
      const site = defaultSiteFor(realm.id);
      expect(site.realm).toBe(realm.id);
      expect(site.tier).toBe('outer');
      expect(siteBlock(site, 1, 1)).toBeNull();
    }
  });
});

describe('site walls', () => {
  const deep = EXPEDITION_SITES.find(s => s.id === 'void-threshold')!;

  it('names the Keeper rank when that is what is short', () => {
    expect(siteBlock(deep, 1, 20)).toEqual({
      code: 'keeper-level', need: deep.minKeeperLevel!, have: 1,
    });
  });

  it('names the explorer level when the Keeper is already ready', () => {
    expect(siteBlock(deep, 99, 1)).toEqual({
      code: 'explorer-level', need: deep.minExplorerLevel!, have: 1,
    });
  });

  it('lets them through once both are cleared', () => {
    expect(siteBlock(deep, deep.minKeeperLevel!, deep.minExplorerLevel!)).toBeNull();
  });

  it('reports the Keeper wall first, because it is the harder one to fix', () => {
    // Both short. The rank is a whole-account climb and the explorer level is
    // one person's; telling the player about the level first would send them to
    // grind somebody up for a site they still could not enter.
    expect(siteBlock(deep, 1, 1)?.code).toBe('keeper-level');
  });
});
