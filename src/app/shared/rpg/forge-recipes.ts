/**
 * forge-recipes.ts — C6 equipment recipe catalogue.
 *
 * Read-only presentation. Basalt Edge is listed so the Forge namespace can
 * show the approved first-craft recipe. C6 must not consume materials or
 * mint the weapon.
 */
export interface ForgeRecipeInput {
  id: string;
  name: string;
  quantity: number;
}

export interface ForgeEquipmentRecipe {
  id: string;
  name: string;
  slotId: 'weapon';
  summary: string;
  lore: string;
  inputs: readonly ForgeRecipeInput[];
  portrait?: string;
  overlay?: string;
  /** True only after a later checkpoint authorizes the craft action. */
  craftable: boolean;
}

export const BASALT_EDGE_RECIPE_ID = 'basalt-edge';

export const FORGE_EQUIPMENT_RECIPES: readonly ForgeEquipmentRecipe[] = [
  {
    id: BASALT_EDGE_RECIPE_ID,
    name: 'Basalt Edge',
    slotId: 'weapon',
    summary: 'A basic weapon. Six Cinder Ore and one Ember Residue.',
    lore: 'The first edge the Seamworks will admit. The anvil knows the recipe; it will not take the ore until a later checkpoint opens the craft.',
    portrait: 'assets/items/portraits/04-basalt-edge-portrait.png',
    overlay: 'assets/characters/overlays/09-basalt-edge-overlay.png',
    inputs: [
      { id: 'cinder-ore', name: 'Cinder Ore', quantity: 6 },
      { id: 'ember-residue', name: 'Ember Residue', quantity: 1 },
    ],
    craftable: false,
  },
];

export function forgeRecipeById(id: string): ForgeEquipmentRecipe | undefined {
  return FORGE_EQUIPMENT_RECIPES.find(row => row.id === id);
}
