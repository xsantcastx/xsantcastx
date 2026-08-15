/**
 * forge-recipes.ts — C9 first-craft catalogue.
 *
 * Basalt Edge is the public first craft: 6 Cinder Ore + 1 Ember Residue.
 * The ForgeCraftGateway consumes and mints. This file stays the recipe
 * definition.
 */
import { rollItemStats } from './item.model';
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
    lore: 'The first edge the Seamworks will admit. Six Cinder Ore and one Ember Residue, struck once into a unique weapon.',
    portrait: 'assets/items/portraits/04-basalt-edge-portrait.png',
    overlay: 'assets/characters/overlays/09-basalt-edge-overlay.png',
    inputs: [
      { id: 'cinder-ore', name: 'Cinder Ore', quantity: 6 },
      { id: 'ember-residue', name: 'Ember Residue', quantity: 1 },
    ],
    craftable: true,
  },
];

export function forgeRecipeById(id: string): ForgeEquipmentRecipe | undefined {
  return FORGE_EQUIPMENT_RECIPES.find(row => row.id === id);
}

export function basaltEdgeItemId(mutationId: string): string {
  return `${mutationId}:item`;
}

export function mintBasaltEdge(
  id: string,
  foundAt: string,
  rng: () => number = Math.random,
): import('./item.model').GameItem {
  const recipe = forgeRecipeById(BASALT_EDGE_RECIPE_ID)!;
  return {
    id,
    name: recipe.name,
    type: 'artifact',
    rarity: 'uncommon',
    stats: rollItemStats('uncommon', 'artifact', rng),
    sellValue: 0,
    equipped: false,
    lore: recipe.lore,
    foundAt,
    soulbound: true,
    upgradeLevel: 0,
  };
}
