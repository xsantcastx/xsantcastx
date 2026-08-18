import { BASALT_EDGE_RECIPE_ID, FORGE_EQUIPMENT_RECIPES, forgeRecipeById } from './forge-recipes';

describe('C6 forge equipment recipes', () => {
  it('lists Basalt Edge as the unlocked first-craft recipe', () => {
    const recipe = forgeRecipeById(BASALT_EDGE_RECIPE_ID);
    expect(recipe?.craftable).toBe(true);
    expect(recipe?.slotId).toBe('weapon');
    expect(recipe?.inputs.map(input => `${input.quantity}:${input.id}`)).toEqual([
      '6:cinder-ore',
      '1:ember-residue',
    ]);
    expect(recipe?.portrait).toContain('04-basalt-edge-portrait');
    expect(recipe?.portrait).toContain('assets/game/');
    expect(FORGE_EQUIPMENT_RECIPES.every(row => row.craftable === true)).toBe(true);
  });
});
