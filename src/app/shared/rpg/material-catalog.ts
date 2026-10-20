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
import { itemIcon } from '../art/item-icons';
import { ARTBIBLE_DEFINITIONS } from './artbible-items';
import { artFor, type ArtEntry } from '../art/art';
import { ITEM_DEFINITIONS } from './item-definition';
import { ALL_CHARMS, type GameItem } from './item.model';
import { gearIcon } from '../art/gear-icons';
import { gearLookOf } from './item-base';

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
  /** B1 Prospecting's rare find. Named here so the bank paints it instead of printing the raw id. */
  'clarity-elixir': 'Clarity Elixir',
  /**
   * A1 Mining's brew. Painted since the library landed and missing from this
   * map the whole time, so the bank drew it as the literal string
   * `ember-elixir` beside an empty art slot — the one id in
   * collection.model.ts's copy of this table that never had a row here.
   */
  'ember-elixir': 'Ember Elixir',
  // Ember Delve biome finds (Phase 2.6). Painted by stand-ins in art.ts until
  // their own art lands: a sickle's cut from the World-Root's shadow (Root
  // Hollows), a cap of the Grotto's light, and the one Godforge fragment each
  // player can pry from the Magma Halls.
  'shadow-root-cutting': 'Shadow-Root Cutting',
  'glowcap': 'Glowcap',
  'godforge-fragment': 'Godforge Fragment',
  // Kael's lost hammer, from his old cache in the Basalt Caverns (once per
  // player). A quest stack for "The Old Seam": no ItemDefinition on purpose.
  'kaels-hammer': "Kael's Hammer",
  // Delve building (Phase 2.6): placeable stacks. Dug dirt and stone come back
  // as blocks; the rest are crafted. Stand-in art in art.ts until painted.
  'dirt-block': 'Dirt block',
  'basalt-block': 'Basalt block',
  'torch': 'Torch',
  'ladder': 'Ladder',
  'platform': 'Platform',
  'chest': 'Chest',
  'camp': 'Camp',
  'timber-support': 'Timber support',
  'basalt-support': 'Basalt support',
  'blast-charge': 'Blasting charge',
  // Fishing and liquids (Phase 6; shared/fishing/fishing.model.ts holds their
  // tables). Painted by procedural pixel icons (art/pixel-icons.ts) until the
  // I1 commission lands.
  'blindfin': 'Blindfin',
  'rootling-eel': 'Rootling Eel',
  'glowcap-minnow': 'Glowcap Minnow',
  'mere-perch': 'Mere Perch',
  'emberling': 'Emberling',
  'slagjaw-eel': 'Slagjaw Eel',
  'the-kept-morning': 'The Kept Morning',
  'the-unpaid-debt': 'The Unpaid Debt',
  'rusted-rivet': 'Rusted Rivet',
  'waterlogged-ledger-page': 'Waterlogged Ledger Page',
  'root-crate': 'Root Crate',
  'seam-crate': 'Seam Crate',
  'tallyfish': 'Tallyfish',
  'ledgerfin': 'Ledgerfin',
  'carry-one-carp': 'Carry-One Carp',
  'overdue-dace': 'Overdue Dace',
  'margin-loach': 'Margin Loach',
  'inkblot-gudgeon': 'Inkblot Gudgeon',
  'struck-through-shiner': 'Struck-Through Shiner',
  'balance-bream': 'Balance Bream',
  'receipt-eel': 'Receipt Eel',
  'countback-chub': 'Countback Chub',
  'unsigned-sprat': 'Unsigned Sprat',
  'column-pike': 'Column Pike',
  'duplicate-darter': 'Duplicate Darter',
  'tally-perch': 'Tally Perch',
  'seal-wax-snapper': 'Seal-Wax Snapper',
  'quill-minnow': 'Quill Minnow',
  'errata-ray': 'Errata Ray',
  'rivet-ruffe': 'Rivet Ruffe',
  'waterline-loach': 'Waterline Loach',
  'closing-entry-carp': 'Closing-Entry Carp',
  'ember-grub': 'Ember Grub',
  'lampfish-oil': 'Lampfish Oil',
  'obsidian-block': 'Obsidian block',
  'worn-rod': 'Worn Rod',
  'root-rod': 'Root Rod',
  'seam-rod': 'Seam Rod',
  'glowline-rod': 'Glowline Rod',
  'tackle-box': 'Tackle Box',
  'anglers-patience': 'Angler\'s Patience',
  'lodge-reel': 'Lodge Reel',
  'seam-bucket': 'Seam Bucket',
  'seam-bucket-water': 'Bucket of water',
  'seam-bucket-lava': 'Bucket of lava',
  // The Underhearth (Phase 8; art/pixel-icons.ts paints them until the commission lands).
  'cold-coalfish': 'Cold Coalfish',
  'pressure-pike': 'Pressure Pike',
  'the-fifth-ember': 'The Fifth Ember',
  'hearth-crate': 'Hearth Crate',
  'ironwood': 'Ironwood',
  'waystone-shard': 'Waystone Shard',
  'four-hammer-marks': 'The Four Hammer-Marks',
  'seam-cart': 'Seam Cart',
  'seam-rail': 'Seam Rail',
  'bark-rope': 'Bark Rope',
  'thornroot-grapple': 'Thornroot Grapple',
  'rift-anchor': 'Rift Anchor',
  // The Rift Gates and the Ink Deeps (rift-gates.model.ts; art/pixel-icons.ts paints them until the commission lands).
  'rift-splinter': 'Rift Splinter',
  'umbral-sigil': 'Umbral Sigil',
  'inkstone': 'Inkstone',
  'nightglass': 'Nightglass',
  'veil-lantern': 'Veil Lantern',
  // The Root Deeps and the Prism Mines (rift-gates.model.ts; art/pixel-icons.ts paints them).
  'verdant-sigil': 'Verdant Sigil',
  'rootglass': 'Rootglass',
  'heart-amber': 'Heart-amber',
  'rootsever-billhook': 'Rootsever Billhook',
  'luminous-sigil': 'Luminous Sigil',
  'prismite': 'Prismite',
  'dawnglass': 'Dawnglass',
  'dawn-lens': 'Dawn Lens',
  // The Orrery Wells (rift-gates.model.ts; art/pixel-icons.ts paints them).
  'celestial-sigil': 'Celestial Sigil',
  'starsteel': 'Starsteel',
  'meridian-glass': 'Meridian Glass',
  'orrery-key': 'Orrery Key',
  // Map v2's two map tools (shared/delve/map-tools.model.ts).
  'broken-astral-compass': 'Broken Astral Compass',
  'rift-map-fragment': 'Rift Map Fragment',
  // The Mirror Slate's two panes (shared/slate/slate-items.model.ts).
  // The world clock (shared/world-clock/eclipse.model.ts CLOCK_ITEMS): the dark's herb and fish, the eclipse's glass.
  'moonwake-bloom': 'Moonwake Bloom',
  'mirrorfin': 'Mirrorfin',
  'eclipse-glass': 'Eclipse Glass',
  'mirror-slate': 'Mirror Slate',
  'mirror-slate-ii': 'Mirror Slate II',
  // The potion belt (shared/potions/potions.model.ts POTIONS; potions.model.spec pins the names together).
  'minor-health-potion': 'Minor Health Potion',
  'lesser-health-potion': 'Lesser Health Potion',
  'greater-health-potion': 'Greater Health Potion',
  'minor-mana-potion': 'Minor Mana Potion',
  'lesser-mana-potion': 'Lesser Mana Potion',
  'greater-mana-potion': 'Greater Mana Potion',
  'rejuvenation-potion': 'Rejuvenation Potion',
  // The Lost Cabinets (shared/cabinets/cabinets.model.ts CABINET_ITEMS; cabinets.spec pins the names together).
  'curio-unstruck-bell': 'The Unstruck Bell',
  'curio-jar-of-noon': 'A Jar of Noon',
  'curio-blank-page': 'A Page Left Blank on Purpose',
  'curio-lost-moon': 'The Orrery\'s Lost Moon',
  'curio-stubborn-seed': 'A Seed That Would Not',
  'curio-tally-stick': 'A Courier\'s Tally Stick',
  'curio-blinking-mirror': 'A Mirror That Blinked',
  'curio-unsigned-letter': 'The Unsigned Letter',
  'curio-pressed-rose': 'A Compass Rose Pressed Flat',
  'curio-moss-locket': 'Moss in a Locket',
  'curio-lamp-wick': 'The Forge-Mine Lamp Wick',
  'curio-kept-coal': 'A Coal That Kept Its Word',
  'curio-clean-ink': 'A Bottle of Clean Ink',
  'curio-backward-rings': 'The Ring Count',
  'curio-folded-shadow': 'A Shadow, Folded',
  'curio-last-chart': 'The Last Star Chart',
  'courier-honeycomb': 'Courier\'s Honeycomb',
  'hatbox-of-small-crowns': 'Hatbox of Small Crowns',
  'curators-loupe': 'Curator\'s Loupe',
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

/** The Basalt Edge as its pixel icon (one art style); the painted portrait stays in the library. */
export const BASALT_EDGE_PORTRAIT = itemIcon('basalt-edge')?.src ?? '';
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
 * Gear and charms come first: each is painted from its base, realm, rarity and
 * instance id (art/gear-icons.ts), so two drops of one definition differ.
 *
 * Basalt Edge is matched by name as well as id because a crafted instance
 * carries a minted id rather than the definition's; the id-to-file difference
 * itself is handled by ART_ALIAS, not here.
 */
export function itemArt(item: { name?: string; id?: string; definitionId?: string; rarity?: GameItem['rarity']; type?: GameItem['type'] }): ArtEntry | null {
  // Gear and charms: their own 32-px picture — base, realm, rarity and the instance's seed (art/gear-icons.ts).
  // A hand-made icon for one of them replaces this line's answer, nothing else.
  const look = gearLookOf(item);
  if (look) return gearIcon(look);
  if (isBasaltEdge(item)) return artFor('basalt-edge');
  for (const key of [item.definitionId, item.id]) {
    if (!key) continue;
    const own = artFor(key);
    if (own) return own;
    // A minted item (a charm: `${seed.id}-${time}-${n}`) carries its seed id as a prefix.
    const minted = /^(.+)-[0-9a-z]{6,}-[0-9a-z]{1,4}$/.exec(key)?.[1];
    const seeded = minted ? artFor(minted) : null;
    if (seeded) return seeded;
  }
  // A ledger record's definition is often `${type}:${name}` (inventory-ops): resolve the name.
  const id = item.name ? idByName().get(item.name) : undefined;
  return id ? artFor(id) : null;
}

let NAME_TO_ID: Map<string, string> | null = null;
/** Every authored item and charm by its display name (built once, on first ask). */
function idByName(): Map<string, string> {
  if (!NAME_TO_ID) {
    NAME_TO_ID = new Map();
    for (const def of ITEM_DEFINITIONS) NAME_TO_ID.set(def.name, def.id);
    for (const seed of ALL_CHARMS) NAME_TO_ID.set(seed.name, seed.id);
  }
  return NAME_TO_ID;
}
