import { BASALT_EDGE_RECIPE_ID, FORGE_EQUIPMENT_RECIPES, forgeRecipeById } from './forge-recipes';

describe('C6 forge equipment recipes', () => {
  it('lists Basalt Edge as the locked first-craft recipe', () => {
    const recipe = forgeRecipeById(BASALT_EDGE_RECIPE_ID);
    expect(recipe?.craftable).toBe(false);
    expect(recipe?.slotId).toBe('weapon');
    expect(recipe?.inputs.map(input => `${input.quantity}:${input.id}`)).toEqual([
      '6:cinder-ore',
      '1:ember-residue',
    ]);
    expect(recipe?.portrait).toContain('04-basalt-edge-portrait.png');
    expect(recipe?.overlay).toContain('09-basalt-edge-overlay.png');
    expect(FORGE_EQUIPMENT_RECIPES.every(row => row.craftable === false)).toBe(true);
  });
});
