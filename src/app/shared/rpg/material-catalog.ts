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
import { ART_ITEMS_PORTRAITS } from '../art/art-manifest.generated';
import { ARTBIBLE_DEFINITIONS } from './artbible-items';
import { artFor, type ArtEntry } from '../art/art';

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
  /** A2 Foraging's rare find. Named here so the bank paints it instead of printing the raw id. */
  'rift-key': 'Rift Key',
  /** B1 Prospecting's rare find. Same reason. */
  'clarity-elixir': 'Clarity Elixir',
  /**
   * A1 Mining's brew. Painted since the library landed and missing from this
   * map the whole time, so the bank drew it as the literal string
   * `ember-elixir` beside an empty art slot — the one id in
   * collection.model.ts's copy of this table that never had a row here.
   */
  'ember-elixir': 'Ember Elixir',
};

function displayFor(id: string, name: string, entry: ArtEntry | null | undefined): MaterialDisplay | undefined {
  if (!entry) return undefined;
  return { id, name, art: entry.src, srcset: entry.srcset };
}

const BY_ID: Record<string, MaterialDisplay> = {};
for (const [id, name] of Object.entries(MATERIAL_NAMES)) {
  const row = displayFor(id, name, artFor(id));
  if (row) BY_ID[id] = row;
}

/**
 * The Art Bible's materials, which the bag would otherwise draw as a raw id.
 *
 * A stack row reads its name and its art from `materialDisplay(stackKey)`, and
 * that map was built only from `MATERIAL_NAMES` above — a hand-kept list of the
 * sixteen ids the gathering skills grant. The Art Bible added twenty-three more
 * that expeditions bring home, all of them painted, and every one of them would
 * have rendered in the bag as the literal string `rune-of-radiance` with an
 * empty art slot: painted assets shipped, and invisible.
 *
 * They are read off the definitions rather than transcribed, because a
 * transcription is a second name for the same object and the two only have to
 * disagree once. `collection.model.spec.ts` pins the bag's name against the
 * log's for exactly that reason.
 */
for (const def of ARTBIBLE_DEFINITIONS) {
  if (def.family !== 'material' && def.family !== 'consumable') continue;
  const row = displayFor(def.id, def.name, artFor(def.id));
  if (row) BY_ID[def.id] = row;
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
 * quest object — by its `ITEM_DEFINITIONS` id.
 *
 * Basalt Edge is matched by name as well as id because a crafted instance
 * carries a minted id rather than the definition's; the id-to-file difference
 * itself is handled by ART_ALIAS, not here.
 */
export function itemArt(item: { name?: string; id?: string; definitionId?: string }): ArtEntry | null {
  if (isBasaltEdge(item)) return artFor('basalt-edge');
  return artFor(item.definitionId ?? item.id);
}
