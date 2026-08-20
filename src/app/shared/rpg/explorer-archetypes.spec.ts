/**
 * explorer-archetypes.spec.ts — the cast, and the promises it makes.
 *
 * The gates here are mostly about *reachability*: an archetype nobody can
 * obtain is a locked silhouette on the roster wall forever, and the failure is
 * completely silent — the card renders, the counter just never moves.
 */
import {
  ARCHETYPE_COUNT,
  EXPLORER_ARCHETYPES,
  EXPLORER_TRAITS,
  STARTER_ARCHETYPES,
  archetypeById,
  archetypesOfRarity,
  pickArchetype,
  sourcesForMission,
} from './explorer-archetypes';
import { EXPLORER_RARITY_ORDER } from './explorer-roster.model';
import { REALMS } from '../realms/realm.model';

describe('the cast', () => {
  it('is eighteen people with unique ids and unique names', () => {
    expect(ARCHETYPE_COUNT).toBe(18);
    expect(new Set(EXPLORER_ARCHETYPES.map(a => a.id)).size).toBe(18);
    expect(new Set(EXPLORER_ARCHETYPES.map(a => a.name)).size).toBe(18);
  });

  it('covers every rarity, so no tier rolls into an empty pool', () => {
    for (const rarity of EXPLORER_RARITY_ORDER) {
      expect(archetypesOfRarity(rarity).length)
        .withContext(rarity)
        .toBeGreaterThan(0);
    }
  });

  it('gets rarer as it gets better', () => {
    // Not a strict ordering — Epic and Legendary are both three — but the two
    // Commons must not be the largest tier and Mythic must be the smallest.
    const counts = EXPLORER_RARITY_ORDER.map(r => archetypesOfRarity(r).length);
    expect(Math.min(...counts)).toBe(counts[counts.length - 1]);
  });

  it('names a real trait and a realm that exists on every entry', () => {
    const realms = new Set(REALMS.map(r => r.id));
    for (const a of EXPLORER_ARCHETYPES) {
      expect(EXPLORER_TRAITS[a.trait]).withContext(a.name).toBeTruthy();
      if (a.affinity) expect(realms.has(a.affinity)).withContext(a.name).toBeTrue();
      if (a.passive.realm) expect(realms.has(a.passive.realm)).withContext(a.name).toBeTrue();
    }
  });

  it('gives every realm-scoped passive a realm to be scoped to', () => {
    /*
     * The silent failure this catches: a `realm-gold` passive with no `realm`
     * never matches, so the card promises 40% more Gold in Luminous and the
     * settlement quietly pays the base rate forever.
     */
    for (const a of EXPLORER_ARCHETYPES) {
      if (a.passive.kind.startsWith('realm-')) {
        expect(a.passive.realm).withContext(a.name).toBeTruthy();
      }
    }
  });

  it('writes a line of copy on every passive and every bio', () => {
    for (const a of EXPLORER_ARCHETYPES) {
      expect(a.passive.text.length).withContext(a.name).toBeGreaterThan(10);
      expect(a.bio.length).withContext(a.name).toBeGreaterThan(20);
      expect(a.sourceNote.length).withContext(a.name).toBeGreaterThan(5);
    }
  });

  it('hands over both starters, because nothing else can reach them', () => {
    // `source: 'starter'` is never in `sourcesForMission`, is not a Market
    // listing and is not a quest reward. If the seed handed over one of the two,
    // the other would be permanently unobtainable and the roster could never be
    // completed — which would make the capstone unreachable too.
    expect(STARTER_ARCHETYPES.length).toBe(2);
    expect(STARTER_ARCHETYPES.every(a => a.rarity === 'common')).toBeTrue();
  });

  it('leaves no archetype without a path in', () => {
    const reachable = new Set(['starter', 'expedition', 'deep', 'grand', 'abyss',
      'market', 'realm-mastery', 'capstone']);
    for (const a of EXPLORER_ARCHETYPES) {
      expect(reachable.has(a.source)).withContext(a.name).toBeTrue();
    }
  });
});

describe('trait balance', () => {
  it('never gives a trait every axis at once', () => {
    /*
     * A trait is a bend, not a bonus. One that raised speed, Gold, XP, runes,
     * loot and materials together would not be a disposition — it would be a
     * tier, and the roster already has six of those.
     */
    for (const trait of Object.values(EXPLORER_TRAITS)) {
      const better = [
        trait.speed < 1, trait.gold > 1, trait.xp > 1,
        trait.rune > 1, trait.loot > 0, trait.materials > 1,
      ].filter(Boolean).length;
      expect(better).withContext(trait.label).toBeLessThan(5);
    }
  });

  it('keeps every multiplier inside a band a card can honestly print', () => {
    for (const trait of Object.values(EXPLORER_TRAITS)) {
      for (const v of [trait.speed, trait.gold, trait.xp, trait.rune, trait.materials]) {
        expect(v).withContext(trait.label).toBeGreaterThanOrEqual(0.5);
        expect(v).withContext(trait.label).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('sourcesForMission', () => {
  it('opens nothing but the shallow pool on a short run', () => {
    expect(sourcesForMission({ deep: false, grand: false, abyss: false }))
      .toEqual(['expedition']);
  });

  it('opens each deeper pool cumulatively', () => {
    expect(sourcesForMission({ deep: true, grand: false, abyss: false }))
      .toEqual(['expedition', 'deep']);
    expect(sourcesForMission({ deep: true, grand: true, abyss: true }))
      .toEqual(['expedition', 'deep', 'grand', 'abyss']);
  });

  it('never opens the three paths that are not drops', () => {
    const all = sourcesForMission({ deep: true, grand: true, abyss: true });
    for (const closed of ['starter', 'market', 'realm-mastery', 'capstone']) {
      expect(all).not.toContain(closed as never);
    }
  });
});

describe('pickArchetype', () => {
  const first = () => 0;

  it('returns nobody the mission cannot reach', () => {
    // A Scout that rolled Rare: every Rare in the cast is `source: 'deep'`, so
    // there is nobody to hand over and the caller falls back to a generated hire
    // at the same tier rather than silently downgrading the roll.
    expect(pickArchetype('rare', new Set(), ['expedition'], first)).toBeNull();
  });

  it('returns somebody once the mission is deep enough', () => {
    const found = pickArchetype('rare', new Set(), ['expedition', 'deep'], first);
    expect(found?.rarity).toBe('rare');
    expect(found?.source).toBe('deep');
  });

  it('never returns anybody already claimed', () => {
    const claimed = new Set<string>();
    const sources = ['expedition', 'deep'] as const;
    let guard = 0;
    while (guard++ < 20) {
      const found = pickArchetype('rare', claimed, sources, Math.random);
      if (!found) break;
      expect(claimed.has(found.id)).toBeFalse();
      claimed.add(found.id);
    }
    // The four Rares, then nobody.
    expect(claimed.size).toBe(archetypesOfRarity('rare').filter(a => a.source === 'deep').length);
    expect(pickArchetype('rare', claimed, sources, Math.random)).toBeNull();
  });

  it('never silently hands over a different tier', () => {
    for (const rarity of EXPLORER_RARITY_ORDER) {
      const found = pickArchetype(rarity, new Set(),
        ['starter', 'expedition', 'deep', 'grand', 'abyss', 'market', 'realm-mastery', 'capstone'],
        first);
      if (found) expect(found.rarity).withContext(rarity).toBe(rarity);
    }
  });

  it('resolves by id, and refuses an id that is not one of them', () => {
    expect(archetypeById('lyra-starwalker')?.name).toBe('Lyra the Starwalker');
    expect(archetypeById('nobody')).toBeUndefined();
    expect(archetypeById(undefined)).toBeUndefined();
  });
});
