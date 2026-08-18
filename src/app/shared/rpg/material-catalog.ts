/**
 * material-catalog.ts — display names and art for materials and equipment.
 *
 * This held exactly two hand-written materials and one portrait, pointing at
 * PNG masters. Everything now resolves through `art-manifest.generated.ts`, so
 * all thirteen materials, the four consumables, the four quest objects and —
 * the gap that mattered — all twelve authored equipment definitions have art.
 * Those twelve previously rendered as two-letter text orbs in the bag and on
 * the loadout, because `src/assets/items/` had no equipment folder at all.
 *
 * Names still live here rather than in the manifest: the importer knows about
 * files, not about what a thing is called in either language.
 */
import { ART_ALL, ART_ITEMS_PORTRAITS, type ArtEntry } from '../art/art-manifest.generated';

export interface MaterialDisplay {
  id: string;
  name: string;
  art: string;
  srcset?: string;
}

/** Display names for every stackable the game can grant. */
const MATERIAL_NAMES: Readonly<Record<string, string>> = {
  'cinder-ore': 'Cinder Ore',
  'celestial-alloy': 'Celestial Alloy',
  'luminous-prism': 'Luminous Prism',
  'umbral-ink': 'Umbral Ink',
  'verdant-sap': 'Verdant Sap',
  'void-shard': 'Void Shard',
  'starlight-herb': 'Starlight Herb',
  'sunbloom': 'Sunbloom',
  'nightbloom': 'Nightbloom',
  'thornroot': 'Thornroot',
  'slag-fragment': 'Slag Fragment',
  'ember-residue': 'Ember Residue',
  'infernal-heartstone': 'Infernal Heartstone',
};

function displayFor(id: string, name: string, entry: ArtEntry | undefined): MaterialDisplay | undefined {
  if (!entry) return undefined;
  return { id, name, art: entry.src, srcset: entry.srcset };
}

const BY_ID: Record<string, MaterialDisplay> = {};
for (const [id, name] of Object.entries(MATERIAL_NAMES)) {
  const row = displayFor(id, name, ART_ALL[id]);
  if (row) BY_ID[id] = row;
}

export const CINDER_ORE_DISPLAY = BY_ID['cinder-ore'];
export const EMBER_RESIDUE_DISPLAY = BY_ID['ember-residue'];

export const BASALT_EDGE_PORTRAIT = ART_ITEMS_PORTRAITS['basalt-edge-portrait']?.src ?? '';
export const BASALT_EDGE_NAME = 'Basalt Edge';

export function isBasaltEdge(item: { name?: string; id?: string }): boolean {
  return item.name === BASALT_EDGE_NAME || (item.id?.includes('basalt-edge') ?? false);
}

export function materialDisplay(id: string): MaterialDisplay | undefined {
  return BY_ID[id];
}

/**
 * Art for any catalogued thing — equipment, artifact, material, consumable,
 * quest object — by its `ITEM_DEFINITIONS` id. Basalt Edge is special-cased to
 * its authored portrait because the craft names it rather than carrying the id.
 */
export function itemArt(item: { name?: string; id?: string; definitionId?: string }): ArtEntry | null {
  if (isBasaltEdge(item)) return ART_ITEMS_PORTRAITS['basalt-edge-portrait'] ?? null;
  const key = item.definitionId ?? item.id;
  return key ? ART_ALL[key] ?? null : null;
}
