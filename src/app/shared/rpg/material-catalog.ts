/**
 * material-catalog.ts — C8 display map for activity materials.
 *
 * Derived runtime thumbs from Desktop Assets/Items. Ember Residue has
 * an approved raster; no invented glyph is required.
 */
export interface MaterialDisplay {
  id: string;
  name: string;
  art: string;
}

export const CINDER_ORE_DISPLAY: MaterialDisplay = {
  id: 'cinder-ore',
  name: 'Cinder Ore',
  art: 'assets/items/materials/01-cinder-ore.png',
};

export const EMBER_RESIDUE_DISPLAY: MaterialDisplay = {
  id: 'ember-residue',
  name: 'Ember Residue',
  art: 'assets/items/materials/12-ember-residue.png',
};

export const BASALT_EDGE_PORTRAIT = 'assets/items/portraits/04-basalt-edge-portrait.png';
export const BASALT_EDGE_OVERLAY = 'assets/characters/overlays/09-basalt-edge-overlay.png';

const BY_ID: Record<string, MaterialDisplay> = {
  [CINDER_ORE_DISPLAY.id]: CINDER_ORE_DISPLAY,
  [EMBER_RESIDUE_DISPLAY.id]: EMBER_RESIDUE_DISPLAY,
};

export function materialDisplay(id: string): MaterialDisplay | undefined {
  return BY_ID[id];
}
