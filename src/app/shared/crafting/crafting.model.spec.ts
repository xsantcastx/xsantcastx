/**
 * crafting.model.spec.ts — the catalogue is only as good as its ids.
 *
 * The failure this file exists to prevent is silent: a recipe naming a material
 * the game cannot grant looks completely correct on the bench — the slot paints,
 * the count reads `0 / 6`, and the player works toward something that will never
 * arrive. Nothing errors, and nothing ever will.
 */
import { ARTBIBLE_DEFINITIONS, ARTBIBLE_RARITY } from '../rpg/artbible-items';
import { ITEM_DEFINITIONS, itemDefinitionById } from '../rpg/item-definition';
import { RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import { COLLECTION_CATALOG } from '../collection/collection.model';
import {
  CRAFTING_CATEGORIES,
  CRAFTING_RECIPES,
  MASTERY_BONUS,
  MAX_CRAFTING_LEVEL,
  coerceCraftingState,
  craftXpFor,
  craftingLevelFor,
  craftingLevelView,
  craftingRecipeById,
  emptyCraftingState,
  masteryBonusFor,
  masteryProgress,
  masteryRng,
  mergeCrafting,
  recipeCollectionId,
  xpToReach,
} from './crafting.model';
import { bandFor, qualityPercent } from '../rpg/item-quality';

/** Every id the game can actually put in a bag as a stack. */
const GRANTABLE = new Set<string>([
  ...ITEM_DEFINITIONS.filter(d => d.family === 'material' || d.family === 'consumable').map(d => d.id),
  // The gathering skills' own materials have no `ItemDefinition`; they are
  // seeded straight into the Collection Log. Read off the log rather than
  // transcribed, for the reason material-catalog.ts gives at length.
  ...COLLECTION_CATALOG.filter(row => row.category === 'material' || row.category === 'consumable').map(row => row.id),
]);

describe('crafting catalogue', () => {
  it('ships a bench-sized catalogue', () => {
    expect(CRAFTING_RECIPES.length).toBeGreaterThanOrEqual(30);
  });

  it('gives every recipe a unique id', () => {
    const ids = new Set(CRAFTING_RECIPES.map(r => r.id));
    expect(ids.size).toBe(CRAFTING_RECIPES.length);
  });

  it('names only materials the game can grant', () => {
    const unknown: string[] = [];
    for (const recipe of CRAFTING_RECIPES) {
      for (const ing of recipe.ingredients) {
        if (!GRANTABLE.has(ing.materialId)) unknown.push(`${recipe.id} → ${ing.materialId}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('names only outputs the catalogue can mint', () => {
    const unminted: string[] = [];
    for (const recipe of CRAFTING_RECIPES) {
      const def = itemDefinitionById(recipe.output.itemId);
      if (!def) { unminted.push(`${recipe.id} → missing ${recipe.output.itemId}`); continue; }
      // `mintEquipment` refuses these three families outright, so a recipe
      // pointing at one would fail at the anvil and nowhere earlier.
      if (def.family === 'material' || def.family === 'quest' || def.family === 'rune') {
        unminted.push(`${recipe.id} → unmintable ${def.family}`);
      }
    }
    expect(unminted).toEqual([]);
  });

  it('files each output under a category its family agrees with', () => {
    const wrong: string[] = [];
    for (const recipe of CRAFTING_RECIPES) {
      const def = itemDefinitionById(recipe.output.itemId);
      if (!def) continue;
      const family = def.family;
      if (recipe.category === 'consumable' && family !== 'consumable') wrong.push(recipe.id);
      if (recipe.category === 'charm' && family !== 'charm') wrong.push(recipe.id);
      if ((recipe.category === 'weapon' || recipe.category === 'armor') && family !== 'equipment') wrong.push(recipe.id);
      if (recipe.category === 'weapon' && def.slot !== 'weapon') wrong.push(recipe.id);
      if (recipe.category === 'armor' && def.slot === 'weapon') wrong.push(recipe.id);
    }
    expect(wrong).toEqual([]);
  });

  it('uses only rarities from the rune ladder and categories from its own list', () => {
    const tiers = new Set<string>(RUNE_TIER_ORDER);
    const cats = new Set(CRAFTING_CATEGORIES.map(c => c.id));
    for (const recipe of CRAFTING_RECIPES) {
      expect(tiers.has(recipe.rarity)).withContext(recipe.id).toBe(true);
      expect(cats.has(recipe.category)).withContext(recipe.id).toBe(true);
    }
  });

  it('never mints below the tier the Art Bible published for that object', () => {
    // A recipe is a *guaranteed* source, so it must not be a cheap way to get an
    // object the drop tables only hand out at a higher band.
    const under: string[] = [];
    for (const recipe of CRAFTING_RECIPES) {
      const floor = ARTBIBLE_RARITY[recipe.output.itemId];
      if (!floor) continue;
      if (RUNE_TIER_ORDER.indexOf(recipe.rarity) < RUNE_TIER_ORDER.indexOf(floor as never)) {
        under.push(`${recipe.id}: ${recipe.rarity} < ${floor}`);
      }
    }
    expect(under).toEqual([]);
  });

  it('prices and gates every recipe', () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe.goldCost).withContext(recipe.id).toBeGreaterThan(0);
      expect(recipe.ingredients.length).withContext(recipe.id).toBeGreaterThan(0);
      expect(recipe.output.count).withContext(recipe.id).toBeGreaterThanOrEqual(1);
      expect(recipe.requiredLevel ?? 1).withContext(recipe.id).toBeLessThanOrEqual(MAX_CRAFTING_LEVEL);
      for (const ing of recipe.ingredients) {
        expect(ing.count).withContext(`${recipe.id} ${ing.materialId}`).toBeGreaterThan(0);
      }
    }
  });

  it('never lists the same material twice in one recipe', () => {
    // Two slots for one stack key would both consume under the same op id and
    // the second would be deduped away — a recipe that quietly costs less.
    for (const recipe of CRAFTING_RECIPES) {
      const keys = new Set(recipe.ingredients.map(i => i.materialId));
      expect(keys.size).withContext(recipe.id).toBe(recipe.ingredients.length);
    }
  });

  it('draws on all three gathering skills and on expedition materials', () => {
    const used = new Set(CRAFTING_RECIPES.flatMap(r => r.ingredients.map(i => i.materialId)));
    // Mining, Foraging, Prospecting.
    expect(used.has('cinder-ore')).toBe(true);
    expect(used.has('thornroot')).toBe(true);
    expect(used.has('celestial-alloy')).toBe(true);
    // The Art Bible's materials, which only expeditions bring home.
    const artbible = new Set(ARTBIBLE_DEFINITIONS.filter(d => d.family === 'material').map(d => d.id));
    expect([...used].some(id => artbible.has(id))).toBe(true);
  });

  it('gates the first rung of every category behind hand-gatherable materials', () => {
    // A category whose cheapest recipe needs an expedition material is a
    // category a new player cannot enter.
    const seeds = new Set(
      COLLECTION_CATALOG
        .filter(row => row.category === 'material' || row.category === 'consumable')
        .map(row => row.id),
    );
    for (const cat of CRAFTING_CATEGORIES) {
      const rung = CRAFTING_RECIPES
        .filter(r => r.category === cat.id)
        .sort((a, b) => (a.requiredLevel ?? 1) - (b.requiredLevel ?? 1))[0];
      expect(rung).withContext(cat.id).toBeTruthy();
      const gatherable = rung.ingredients.every(i => seeds.has(i.materialId));
      expect(gatherable).withContext(`${cat.id} first rung ${rung.id}`).toBe(true);
    }
  });

  it('resolves a recipe by id and nothing by a name that is not one', () => {
    expect(craftingRecipeById(CRAFTING_RECIPES[0].id)).toBe(CRAFTING_RECIPES[0]);
    expect(craftingRecipeById('not-a-recipe')).toBeUndefined();
  });

  it('namespaces its Collection Log ids away from item ids', () => {
    for (const recipe of CRAFTING_RECIPES) {
      const id = recipeCollectionId(recipe.id);
      expect(id.startsWith('recipe:')).toBe(true);
      expect(itemDefinitionById(id)).toBeUndefined();
    }
  });
});

describe('the crafting ladder', () => {
  it('starts at level 1 with nothing and climbs monotonically', () => {
    expect(craftingLevelFor(0)).toBe(1);
    let previous = 0;
    for (let level = 2; level <= MAX_CRAFTING_LEVEL; level++) {
      const need = xpToReach(level);
      expect(need).toBeGreaterThan(previous);
      expect(craftingLevelFor(need)).toBe(level);
      expect(craftingLevelFor(need - 1)).toBe(level - 1);
      previous = need;
    }
  });

  it('caps rather than running off the end', () => {
    const view = craftingLevelView(xpToReach(MAX_CRAFTING_LEVEL) * 10);
    expect(view.level).toBe(MAX_CRAFTING_LEVEL);
    expect(view.maxed).toBe(true);
    expect(view.percent).toBe(100);
  });

  it('reports a sane position inside a level', () => {
    const floor = xpToReach(5);
    const view = craftingLevelView(floor);
    expect(view.level).toBe(5);
    expect(view.into).toBe(0);
    expect(view.span).toBeGreaterThan(0);
    expect(view.percent).toBe(0);
  });

  it('survives nonsense', () => {
    expect(craftingLevelFor(Number.NaN)).toBe(1);
    expect(craftingLevelFor(-10_000)).toBe(1);
    expect(craftingLevelView(Number.NaN).level).toBe(1);
  });

  it('pays more XP for a rarer craft and scales with the batch', () => {
    const cheap = CRAFTING_RECIPES.find(r => r.rarity === 'uncommon')!;
    const dear = CRAFTING_RECIPES.find(r => r.rarity === 'legendary')!;
    expect(craftXpFor(dear)).toBeGreaterThan(craftXpFor(cheap));
    const batch = CRAFTING_RECIPES.find(r => r.output.count > 1);
    if (batch) expect(craftXpFor(batch)).toBeGreaterThan(0);
  });
});

describe('mastery', () => {
  it('pays nothing before the tenth craft and 10% from it on', () => {
    expect(masteryBonusFor(0)).toBe(0);
    expect(masteryBonusFor(9)).toBe(0);
    expect(masteryBonusFor(10)).toBe(MASTERY_BONUS);
    expect(masteryBonusFor(500)).toBe(MASTERY_BONUS);
  });

  it('counts down to the threshold and then reports done', () => {
    expect(masteryProgress(3)).toEqual({ crafted: 3, needed: 7, mastered: false });
    expect(masteryProgress(10)).toEqual({ crafted: 10, needed: 0, mastered: true });
    expect(masteryProgress(-4).crafted).toBe(0);
  });

  it('is the identity function on an unmastered recipe', () => {
    const rng = masteryRng(() => 0.42, 0, 'rare');
    expect(rng()).toBe(0.42);
  });

  it('raises a grade by 10% and never past the band ceiling', () => {
    const { min, max } = bandFor('rare');
    for (const sample of [0, 0.25, 0.5, 0.75, 1]) {
      const plain = min + sample * (max - min);
      const raised = min + masteryRng(() => sample, MASTERY_BONUS, 'rare')() * (max - min);
      expect(raised).toBeGreaterThanOrEqual(plain - 1e-9);
      expect(raised).toBeLessThanOrEqual(max + 1e-9);
      if (plain * 1.1 < max) expect(raised).toBeCloseTo(plain * 1.1, 6);
    }
  });

  it('leaves a perfect roll perfect rather than overflowing it', () => {
    // `masteryRng` returns the RNG's own 0..1 space, so a sample of 1 must come
    // back as 1 — the band ceiling — and not as something past it that
    // `qualityPercent` would then have to clamp.
    const raised = masteryRng(() => 1, MASTERY_BONUS, 'epic')();
    expect(raised).toBeLessThanOrEqual(1);
    expect(raised).toBeCloseTo(1, 9);
    // qualityPercent grades 0..1, not 0..100. The ceiling is a perfect roll.
    expect(qualityPercent(bandFor('epic').max, 'epic')).toBe(1);
  });
});

describe('the saved blob', () => {
  it('reads back what it wrote', () => {
    const state = { version: 1 as const, xp: 500, crafted: { [CRAFTING_RECIPES[0].id]: 4 } };
    expect(coerceCraftingState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('drops counts for recipes that no longer exist', () => {
    const read = coerceCraftingState({ version: 1, xp: 10, crafted: { 'craft-retired': 9 } });
    expect(read.crafted).toEqual({});
  });

  it('clamps hand-edited nonsense rather than trusting it', () => {
    const read = coerceCraftingState({
      version: 1,
      xp: -50,
      crafted: { [CRAFTING_RECIPES[0].id]: -3, [CRAFTING_RECIPES[1].id]: 'lots' },
    });
    expect(read.xp).toBe(0);
    expect(read.crafted[CRAFTING_RECIPES[0].id]).toBe(0);
    expect(read.crafted[CRAFTING_RECIPES[1].id]).toBeUndefined();
  });

  it('answers with an empty ladder for anything that is not one', () => {
    expect(coerceCraftingState(null)).toEqual(emptyCraftingState());
    expect(coerceCraftingState([1, 2, 3])).toEqual(emptyCraftingState());
    expect(coerceCraftingState('nope')).toEqual(emptyCraftingState());
  });

  it('takes the higher of two devices on every counter', () => {
    const a = { version: 1, xp: 900, crafted: { [CRAFTING_RECIPES[0].id]: 12, [CRAFTING_RECIPES[1].id]: 1 } };
    const b = { version: 1, xp: 400, crafted: { [CRAFTING_RECIPES[1].id]: 7, [CRAFTING_RECIPES[2].id]: 3 } };
    const merged = mergeCrafting(a, b);
    expect(merged.xp).toBe(900);
    expect(merged.crafted[CRAFTING_RECIPES[0].id]).toBe(12);
    expect(merged.crafted[CRAFTING_RECIPES[1].id]).toBe(7);
    expect(merged.crafted[CRAFTING_RECIPES[2].id]).toBe(3);
  });

  it('is order-independent, which is what makes it safe to run on both devices', () => {
    const a = { version: 1, xp: 900, crafted: { [CRAFTING_RECIPES[0].id]: 12 } };
    const b = { version: 1, xp: 400, crafted: { [CRAFTING_RECIPES[0].id]: 30 } };
    expect(mergeCrafting(a, b)).toEqual(mergeCrafting(b, a));
  });
});
