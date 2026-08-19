import {
  MYSTERY_BOXES,
  PITY_THRESHOLD,
  RARITY_LADDER,
  advancePity,
  boxById,
  boxOdds,
  boxPool,
  boxScrapExpectation,
  boxWindow,
  pityArmed,
  pityRemaining,
  rarityRank,
  rollBox,
  type PityState,
} from './mystery-box';
import { itemDefinitionById } from '../rpg/item-definition';
import { UNIQUE_ITEMS, uniqueById } from '../rpg/unique-items';

/** Deterministic rng: replays a fixed list, then holds the last value. */
function scripted(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('the box shelf', () => {
  it('climbs in price and in rarity together, with one rung of overlap', () => {
    for (let i = 1; i < MYSTERY_BOXES.length; i++) {
      const below = MYSTERY_BOXES[i - 1];
      const box = MYSTERY_BOXES[i];
      expect(box.cost).toBeGreaterThan(below.cost);
      // Each box starts where the one below it topped out.
      expect(box.minRarity).toBe(below.maxRarity);
      expect(rarityRank(box.maxRarity)).toBeGreaterThan(rarityRank(box.minRarity));
    }
  });

  it('quotes odds that sum to one and fall as the rarity climbs', () => {
    for (const box of MYSTERY_BOXES) {
      const odds = boxOdds(box);
      expect(odds.length).toBe(boxWindow(box).length);
      expect(odds.reduce((sum, row) => sum + row.chance, 0)).toBeCloseTo(1, 8);
      for (let i = 1; i < odds.length; i++) {
        expect(odds[i].chance).toBeLessThan(odds[i - 1].chance);
      }
    }
  });

  it('stays a Gold sink — no box pays for itself in scrap', () => {
    // The property the whole economy rests on. See the header of mystery-box.ts.
    for (const box of MYSTERY_BOXES) {
      expect(boxScrapExpectation(box)).toBeLessThan(box.cost);
    }
  });

  it('keeps every named object out of the ordinary pool, at every rarity', () => {
    // The leak: `boxPool` used to exclude only the uniques authored *at* the
    // rolled rarity, so the other twenty-odd could be handed out as ordinary
    // items at whatever rarity came up — a named object at a rarity it does not
    // exist at, with `unique: false` on the result so nothing announced it.
    const named = new Set(UNIQUE_ITEMS.map(u => u.id));
    for (const rarity of RARITY_LADDER) {
      for (const def of boxPool(rarity)) {
        expect(named.has(def.id)).withContext(`${def.id} leaked at ${rarity}`).toBeFalse();
      }
    }
  });

  it('only ever mints a unique at its own authored rarity', () => {
    for (const box of MYSTERY_BOXES) {
      for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
        // Second sample under UNIQUE_CHANCE forces the named branch when one exists.
        const result = rollBox(box, {}, scripted([roll, 0.001, roll]));
        if (!result?.unique) continue;
        expect(uniqueById(result.definitionId)!.rarity).toBe(result.rarity);
      }
    }
  });

  it('never hands out a soulbound reward or an unrollable stack', () => {
    for (const rarity of RARITY_LADDER) {
      for (const def of boxPool(rarity)) {
        expect(def.soulbound).toBeFalsy();
        expect(def.rollKeys.length).toBeGreaterThan(0);
        expect(['equipment', 'charm']).toContain(def.family);
      }
    }
  });
});

describe('opening a box', () => {
  const iron = boxById('iron-chest')!;
  const vault = boxById('void-cache')!;

  it('returns a definition that actually exists in the catalogue', () => {
    for (const box of MYSTERY_BOXES) {
      for (const roll of [0, 0.3, 0.999]) {
        const result = rollBox(box, {}, scripted([roll, 0.99, roll]))!;
        expect(result).toBeTruthy();
        expect(itemDefinitionById(result.definitionId)).toBeTruthy();
        expect(boxWindow(box)).toContain(result.rarity);
      }
    }
  });

  it('marks a unique and can find it back in the named table', () => {
    // Second sample under UNIQUE_CHANCE forces the named branch.
    const result = rollBox(vault, {}, scripted([0.999, 0.001, 0]))!;
    expect(result.unique).toBe(true);
    expect(uniqueById(result.definitionId)).toBeTruthy();
    expect(uniqueById(result.definitionId)!.rarity).toBe(result.rarity);
  });

  it('sends most opens to the floor of the window', () => {
    // Ticket 0.5 of the normalised total lands on the first rung, which carries
    // ~83% of an Iron Chest's mass.
    const result = rollBox(iron, {}, scripted([0.5, 0.99, 0]))!;
    expect(result.rarity).toBe(iron.minRarity);
    expect(result.pityApplied).toBe(false);
  });
});

describe('bad luck protection', () => {
  const iron = boxById('iron-chest')!;

  it('counts consecutive floor results and resets on anything better', () => {
    let state: PityState = {};
    for (let i = 0; i < 4; i++) state = advancePity(state, iron, 'common');
    expect(pityRemaining(state, iron.id)).toBe(PITY_THRESHOLD - 4);
    state = advancePity(state, iron, 'uncommon');
    expect(pityRemaining(state, iron.id)).toBe(PITY_THRESHOLD);
    expect(pityArmed(state, iron.id)).toBe(false);
  });

  it('is counted per box, so pity built cheaply cannot be spent expensively', () => {
    let state: PityState = {};
    for (let i = 0; i < PITY_THRESHOLD; i++) state = advancePity(state, iron, 'common');
    expect(pityArmed(state, 'iron-chest')).toBe(true);
    expect(pityArmed(state, 'void-cache')).toBe(false);
  });

  it('guarantees above the floor once armed, however unlucky the sample', () => {
    let state: PityState = {};
    for (let i = 0; i < PITY_THRESHOLD; i++) state = advancePity(state, iron, 'common');
    // rng 0 is the unluckiest possible ticket; without the guarantee it is a
    // dead-certain floor result.
    const result = rollBox(iron, state, scripted([0, 0.99, 0]))!;
    expect(result.rarity).not.toBe(iron.minRarity);
    expect(result.pityApplied).toBe(true);
    expect(rarityRank(result.rarity)).toBeGreaterThan(rarityRank(iron.minRarity));
  });

  it('does not jump straight to the ceiling — pity is "better", not "best"', () => {
    let state: PityState = {};
    const armedVault = MYSTERY_BOXES.find(b => b.id === 'void-cache')!;
    for (let i = 0; i < PITY_THRESHOLD; i++) state = advancePity(state, armedVault, 'legendary');
    const result = rollBox(armedVault, state, scripted([0.5, 0.99, 0]))!;
    // Three-rung window: the guarantee removes Legendary and lands on Mythic,
    // not on Singular, so farming pity is never the optimal way to a Singular.
    expect(result.rarity).toBe('mythic');
  });
});
