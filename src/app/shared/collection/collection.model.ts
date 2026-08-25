/**
 * collection.model.ts — the Collection Log's catalogue, ledger and arithmetic.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE CATALOGUE IS DERIVED AND NOT RETYPED
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything findable in the Godforge is already authored somewhere: runes and
 * Runewords in `rune.model.ts`, charms in `item.model.ts`, equipment, artifacts,
 * materials and consumables in `item-definition.ts`, and the material ids the
 * three gathering skills actually grant in `activity/`. A second hand-written
 * list of "everything there is" would be wrong within one release — a new rune
 * would land in the Forge and never appear in the log, and nothing would fail.
 *
 * So the catalogue is *built* from those registries and only the facts they do
 * not carry are authored here: how rare a discovery is on the collection's own
 * ladder, which realm a thing belongs to, and the one line a locked card shows
 * instead of the name. `collection.model.spec.ts` pins the joins.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY SOME ENTRIES ARE NOT COUNTED
 * ─────────────────────────────────────────────────────────────────────────────
 * A completion bar that cannot reach 100% is a bar that lies, so an entry
 * nothing can grant stays visible and out of the denominator. Which entries
 * those are is decided by `mintable` below rather than by a hand-set flag —
 * the flag went stale the release the Gambler shipped, and said "no hand in the
 * Godforge can mint one" about thirteen pieces a mystery box had been handing
 * out for months.
 *
 * The Collector rewards are excluded for the opposite reason: you cannot be
 * asked to collect the prize for collecting.
 *
 * Pure data and pure functions. No browser APIs — safe on an SSR path.
 */
import {
  ALL_CHARMS,
  type GameItem,
  type ItemRarity,
} from '../rpg/item.model';
import { ITEM_DEFINITIONS, type ItemDefinition } from '../rpg/item-definition';
import { CRAFTING_RECIPES, recipeCollectionId } from '../crafting/crafting.model';
import { ARTBIBLE_RARITY } from '../rpg/artbible-items';
import { UNIQUE_ITEMS } from '../rpg/unique-items';
import { RUNES, RUNEWORDS, RUNE_TIERS, RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import type { NarrativeRealmId } from '../narrative/five-realms.narrative';

/** The localStorage key. Registered in `SYNCED_BLOBS` so it reaches the cloud. */
export const COLLECTION_KEY = 'godforge-collection';

export const COLLECTION_SCHEMA_VERSION = 1 as const;

export type CollectionCategory =
  | 'rune'
  | 'runeword'
  | 'artifact'
  | 'charm'
  | 'material'
  | 'equipment'
  | 'consumable'
  | 'recipe';

export interface CollectionCategoryDefinition {
  id: CollectionCategory;
  /** Plural, because every place it is shown is a heading over many. */
  label: string;
  /** Glyph. The categories have no painted sigil of their own. */
  icon: string;
  color: string;
  glow: string;
  /** One line under the section header. */
  blurb: string;
}

/**
 * Colours are lifted from the rune ladder and the realm palette rather than
 * invented, so a Rare rune and a Rare anything are the same violet.
 */
export const COLLECTION_CATEGORIES: readonly CollectionCategoryDefinition[] = [
  {
    id: 'rune',
    label: 'Runes',
    icon: '◈',
    color: '#a48bff',
    glow: 'rgba(140, 110, 255, 0.6)',
    blurb: 'Struck from the anvil, one at a time, at whatever price the ladder asks.',
  },
  {
    id: 'runeword',
    label: 'Runewords',
    icon: '⟡',
    color: '#e6dcff',
    glow: 'rgba(230, 220, 255, 0.65)',
    blurb: 'Runes set into an order that means something. Spent to make, kept forever.',
  },
  {
    id: 'artifact',
    label: 'Artifacts',
    icon: '✦',
    color: '#c89868',
    glow: 'rgba(201, 168, 76, 0.6)',
    blurb: 'The five things the Market will part with, and only for a great deal of Gold.',
  },
  {
    id: 'charm',
    label: 'Charms',
    icon: '☘',
    color: '#5fb6ff',
    glow: 'rgba(80, 180, 255, 0.6)',
    blurb: 'Small things that carry an exact number. Three wells, and fifteen ways to fill them.',
  },
  {
    id: 'material',
    label: 'Materials',
    icon: '⬡',
    color: '#ff9a5a',
    glow: 'rgba(255, 154, 90, 0.6)',
    blurb: 'What the Seamworks, the Canopy and the Orrery give up to a patient hand.',
  },
  {
    id: 'equipment',
    label: 'Equipment',
    icon: '⚒',
    color: '#8f98a8',
    glow: 'rgba(143, 152, 168, 0.55)',
    blurb: 'Worn things. Most of them have been drawn and named and not yet forged.',
  },
  {
    id: 'consumable',
    label: 'Consumables',
    icon: '⚗',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.6)',
    blurb: 'Spent once. The log remembers them anyway — that is the whole point of it.',
  },
  {
    id: 'recipe',
    label: 'Recipes',
    icon: '⚒',
    color: '#e8c898',
    glow: 'rgba(255, 180, 80, 0.6)',
    blurb: 'Ways of making a thing. Known the first time you make it, and never forgotten.',
  },
];

export const COLLECTION_CATEGORY_ORDER: readonly CollectionCategory[] =
  COLLECTION_CATEGORIES.map(c => c.id);

const CATEGORY_BY_ID = new Map(COLLECTION_CATEGORIES.map(c => [c.id, c]));

export function collectionCategory(id: CollectionCategory): CollectionCategoryDefinition {
  return CATEGORY_BY_ID.get(id) ?? COLLECTION_CATEGORIES[0];
}

/** One catalogue row: a thing that exists, whether or not it has been found. */
export interface CollectionEntry {
  /**
   * The id the game grants under. For a rune that is the rune id, for a
   * Runeword the word id, for anything that reaches the bag the definition id
   * or the material stack key — see {@link collectionIdForItem}.
   */
  id: string;
  category: CollectionCategory;
  name: string;
  /**
   * How rare the *discovery* is, on the rune ladder.
   *
   * Deliberately not the rarity of a rolled instance: a Keeper's Cowl can mint
   * common or mythic, and "which band did this copy roll in" is a fact about
   * one object, not about whether the Keeper has ever seen one.
   */
  rarity: ItemRarity;
  realm?: NarrativeRealmId;
  lore: string;
  /** Shown on a locked card in place of the name. Clues the source, never names it. */
  hint: string;
  /** True when something in the current build can actually grant it. */
  obtainable: boolean;
  /**
   * The id to look the painting up under, when it is not this row's own id.
   *
   * One consumer: a recipe. A recipe is not a painted object — it is a way of
   * getting one — so its card shows the art of what comes off the anvil. An
   * alias in `ART_ALIAS` would have been the other option and would have been
   * wrong: that map exists for ids whose *file* is named differently, and
   * `art.spec.ts` asserts every alias points at a real manifest key. Fifty
   * recipes pointing at fifty existing keys would pass that test while turning
   * the alias table into a second recipe list.
   */
  artId?: string;
  /** True for the four Collector rewards, which are outside the denominator. */
  reward?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authored facts the source registries do not carry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which realm witnessed which rune, from the narrative bible's `witnessRune`.
 *
 * Only five of the twenty-five are spoken for. The rest are unaligned and the
 * realm filter says so rather than inventing an allegiance for them.
 */
const RUNE_REALM: Readonly<Record<string, NarrativeRealmId>> = {
  glint: 'luminous',
  drift: 'celestial',
  ash: 'infernal',
  veil: 'umbral',
  thorn: 'verdant',
};

/** One line per rune tier, used as the locked-card hint. */
const RUNE_HINT: Readonly<Record<ItemRarity, string>> = {
  common: 'the floor of the drop table — a handful of strikes',
  uncommon: 'roughly one strike in four hundred',
  rare: 'one strike in ten thousand, or an expedition that went deep',
  epic: 'one strike in thirty thousand. Magic Find shortens the wait.',
  legendary: 'one strike in a hundred thousand',
  mythic: 'one strike in three hundred thousand',
  singular: 'the last rune in the game. Measured in years, not afternoons.',
};

/** Collection rarity for the five Market artifacts, by what they cost. */
const ARTIFACT_RARITY: Readonly<Record<string, ItemRarity>> = {
  'obsidian-heart': 'rare',
  'mirrorblade-kael': 'epic',
  'relic-third-dawn': 'epic',
  'codex-solarii': 'legendary',
  'fragment-first-sun': 'mythic',
};

/** Collection rarity for the authored equipment, by its stature in the lore. */
const EQUIPMENT_RARITY: Readonly<Record<string, ItemRarity>> = {
  'basalt-edge': 'common',
  'eclipse-longblade': 'uncommon',
  'keeper-staff': 'uncommon',
  'keepers-cowl': 'uncommon',
  'keepers-mantle': 'uncommon',
  'godforge-gauntlets': 'uncommon',
  'void-buckler': 'rare',
  'astral-pendant': 'rare',
  'anchor-ring': 'rare',
  'astral-helm': 'rare',
  'infernal-cuirass': 'rare',
  'luminous-greaves': 'rare',
  'verdant-bracers': 'rare',
  'keeper-signet': 'legendary',
};

/** Every named object's authored rarity, which is the one it drops at. */
const UNIQUE_RARITY: Readonly<Record<string, ItemRarity>> =
  Object.fromEntries(UNIQUE_ITEMS.map(u => [u.id, u.rarity]));

/**
 * The rarity a definition is catalogued at, from whichever table authored it.
 *
 * Three sources, in order of how specific they are: a unique names the one
 * rarity it exists at, an Art Bible entry publishes the floor of its band, and
 * the Keeper kit is graded by hand above. `rare` is the fallback and is only
 * reached by a definition that no table claims, which is a catalogue error.
 */
function rarityFor(def: ItemDefinition): ItemRarity {
  return UNIQUE_RARITY[def.id]
    ?? (ARTBIBLE_RARITY[def.id] as ItemRarity | undefined)
    ?? EQUIPMENT_RARITY[def.id]
    ?? 'rare';
}

/**
 * Whether anything in the game can actually hand this definition over.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A PREDICATE AND NOT A FLAG
 * ─────────────────────────────────────────────────────────────────────────────
 * It used to be a flag, and the flag said `false` for every authored equipment
 * piece with the line "no hand in the Godforge can mint one". That was true
 * when it was written and stopped being true when the Gambler shipped:
 * `boxPool` in gambler/mystery-box.ts hands out any equipment or charm
 * definition that rolls, is not soulbound and is not a named object, and
 * `rollBox` mints it. Thirteen Keeper pieces had been obtainable for releases
 * while the log went on calling them undrawn.
 *
 * The Art Bible adds seventy-seven more definitions through that same pool, so
 * the stale flag would have gone from a small lie to the majority of the
 * catalogue. This mirrors `boxPool`'s predicate instead — deliberately mirrored
 * rather than imported, because collection.model.ts is a leaf that an SSR path
 * pulls in for a name and the Gambler drags the economy in behind it. The pair
 * is pinned in collection.model.spec.ts.
 */
function mintable(def: ItemDefinition): boolean {
  // A named object reaches a player down a different path, and a stricter test
  // than the one that path uses would exclude it wrongly. `rollBox` picks a
  // unique from `uniquesAtRarity` *before* it consults `boxPool`, and that
  // branch checks neither `soulbound` nor `rollKeys` — so the twelve soulbound
  // Singulars are obtainable, from the one box whose window reaches their
  // rarity. Between them the five boxes in `MYSTERY_BOXES` span common to
  // singular with no gap, so every authored rarity has a box that pays it.
  if (UNIQUE_RARITY[def.id]) return true;
  if (def.family !== 'equipment' && def.family !== 'charm') return false;
  if (!def.rollKeys.length) return false;
  if (def.soulbound) return false;
  return true;
}

/**
 * The materials the three gathering skills actually grant, with the realm whose
 * site they come from and how deep into that skill's tier ladder they sit.
 *
 * Written out rather than derived from the tier tables because the tiers are
 * shaped for levelling — they carry unlock levels and yields, not "how much of
 * a find is this" — and three ladders that each mean something different cannot
 * be compared without saying so once, here.
 */
interface MaterialSeed {
  id: string;
  rarity: ItemRarity;
  realm: NarrativeRealmId;
  hint: string;
}

const MATERIAL_SEEDS: readonly MaterialSeed[] = [
  // Mining — the Basalt Seamworks.
  { id: 'cinder-ore', rarity: 'common', realm: 'infernal',
    hint: 'the first thing any seam gives up' },
  { id: 'slag-fragment', rarity: 'common', realm: 'infernal',
    hint: 'what the seam gives up once you know where to strike it' },
  { id: 'ember-residue', rarity: 'rare', realm: 'infernal',
    hint: 'left behind by a strike, rarely, once the ore has spent its heat' },
  { id: 'infernal-heartstone', rarity: 'uncommon', realm: 'infernal',
    hint: 'deep in the seam, and it does not come out early' },
  // Foraging — the Rootglass Canopy.
  { id: 'starlight-herb', rarity: 'common', realm: 'verdant',
    hint: 'growing at the foot of the Canopy' },
  { id: 'sunbloom', rarity: 'common', realm: 'verdant',
    hint: 'higher in the Canopy, where the light still reaches' },
  { id: 'nightbloom', rarity: 'uncommon', realm: 'verdant',
    hint: 'the same branch, after the light has gone' },
  { id: 'thornroot', rarity: 'uncommon', realm: 'verdant',
    hint: 'under the Canopy, and it defends itself' },
  // Prospecting — the Meridian Orrery.
  { id: 'celestial-alloy', rarity: 'common', realm: 'celestial',
    hint: 'the first thing the Orrery yields to a survey' },
  { id: 'luminous-prism', rarity: 'common', realm: 'luminous',
    hint: 'a survey run long enough to find where the light bends' },
  { id: 'verdant-sap', rarity: 'uncommon', realm: 'verdant',
    hint: 'a survey that reaches the living part of the machine' },
  { id: 'umbral-ink', rarity: 'uncommon', realm: 'umbral',
    hint: 'a survey on the side of the Orrery the sun never crosses' },
  { id: 'void-shard', rarity: 'epic', realm: 'umbral',
    hint: 'the deepest survey there is, and still mostly a rumour' },
];

/** Consumables, with the same treatment. */
const CONSUMABLE_SEEDS: readonly MaterialSeed[] = [
  { id: 'ember-elixir', rarity: 'uncommon', realm: 'infernal',
    hint: 'brewed from what a hot seam leaves behind' },
  { id: 'rift-key', rarity: 'rare', realm: 'verdant',
    hint: 'about one forage in a thousand, in the Canopy' },
  { id: 'clarity-elixir', rarity: 'rare', realm: 'celestial',
    hint: 'about one survey in fifteen hundred, at the Orrery' },
];

/** Lore for the ids that have no `ItemDefinition` of their own. */
const SEED_LORE: Readonly<Record<string, string>> = {
  'slag-fragment': 'The part of the strike that was never going to be anything. Kept, because the Seamworks weighs what it throws away.',
  'infernal-heartstone': 'It is warm on one face and cold on the other, and the warm face is always the one turned away from you.',
  'starlight-herb': 'It grows toward a light that has not been overhead for four thousand years, and it has not been told.',
  'sunbloom': 'Opens at the hour the First Sun used to cross. Nothing crosses. It opens anyway.',
  'nightbloom': 'The same plant, on the same branch, keeping a different appointment.',
  'thornroot': 'A root that learned to be a weapon and then could not learn to stop.',
  'celestial-alloy': 'Poured in a ring rather than a bar, because the Orrery only accepts things that already know how to turn.',
  'luminous-prism': 'Cut so that whatever goes in comes out as an argument about what colour it was.',
  'verdant-sap': 'Still moving. The Orrery is a machine and this is the part of it that is alive, and nobody at the Orrery will discuss that.',
  'umbral-ink': 'Drawn from the meridian the sun does not cross. It writes perfectly well and it will not photograph.',
  'void-shard': 'Not a piece of the Void — the Void does not have pieces. A place where something was carved and the cut is still open.',
  'rift-key': 'It fits a door that has not been built, in a wall that has not been raised, in a realm nobody has named.',
  'clarity-elixir': 'Two mouthfuls. The first shows you what you were looking at. The second shows you what you were looking for.',
  'keeper-signet': 'A Keeper is issued one signet in a life. This is the second, and the Archivum has no record of who authorised it.',
  'sealed-codex-page': 'A page the Archivum sealed rather than burned, which is the Archivum admitting it might be wrong.',
};

// ─────────────────────────────────────────────────────────────────────────────
// The catalogue
// ─────────────────────────────────────────────────────────────────────────────

const REWARD_IDS = new Set(['sealed-codex-page', 'keeper-signet']);

function buildCatalogue(): CollectionEntry[] {
  const rows: CollectionEntry[] = [];

  for (const rune of RUNES) {
    rows.push({
      id: rune.id,
      category: 'rune',
      name: rune.name,
      rarity: rune.tier,
      realm: RUNE_REALM[rune.id],
      lore: rune.lore,
      hint: RUNE_HINT[rune.tier],
      obtainable: true,
    });
  }

  for (const word of RUNEWORDS) {
    rows.push({
      id: word.id,
      category: 'runeword',
      name: word.name,
      rarity: word.tier,
      lore: word.lore,
      hint: `${word.runes.length} runes, set in order at the Forge — the rarest of them is ${RUNE_TIERS[word.tier].label}`,
      obtainable: true,
    });
  }

  for (const def of ITEM_DEFINITIONS) {
    if (def.family === 'artifact') {
      rows.push({
        id: def.id,
        category: 'artifact',
        name: def.name,
        rarity: ARTIFACT_RARITY[def.id] ?? 'legendary',
        realm: realmForStyle(def.style),
        lore: def.lore,
        hint: 'the Market will sell you one, for a number with a lot of zeroes on it',
        obtainable: true,
      });
      continue;
    }
    if (def.family === 'equipment' || def.family === 'charm') {
      const isReward = REWARD_IDS.has(def.id);
      rows.push({
        id: def.id,
        category: def.family === 'charm' ? 'charm' : 'equipment',
        name: def.name,
        rarity: isReward ? 'mythic' : rarityFor(def),
        realm: realmForStyle(def.style),
        lore: def.lore,
        hint: hintFor(def, isReward),
        obtainable: isReward || def.id === 'basalt-edge' || mintable(def),
        reward: isReward || undefined,
      });
      continue;
    }
    if (def.family === 'material' || def.family === 'consumable') {
      // Only the Art Bible's, because the gathering skills' own materials are
      // seeded below with the site and the tier ladder they come off — facts an
      // `ItemDefinition` does not carry.
      if (!ARTBIBLE_RARITY[def.id]) continue;
      rows.push({
        id: def.id,
        category: def.family === 'consumable' ? 'consumable' : 'material',
        name: def.name,
        rarity: rarityFor(def),
        realm: realmForStyle(def.style),
        lore: def.lore,
        hint: def.family === 'consumable'
          ? 'brewed, sealed and traded — the board carries them when someone is selling'
          : 'carried home from the realm that owns it, by an explorer who went deep enough',
        obtainable: true,
      });
    }
  }

  for (const charm of ALL_CHARMS) {
    rows.push({
      id: charm.id,
      category: 'charm',
      name: charm.name,
      rarity: charm.rarity,
      lore: charm.lore,
      hint: charmHint(charm.weight),
      obtainable: true,
    });
  }

  for (const seed of MATERIAL_SEEDS) {
    rows.push({
      id: seed.id,
      category: 'material',
      name: MATERIAL_NAMES[seed.id] ?? seed.id,
      rarity: seed.rarity,
      realm: seed.realm,
      lore: loreFor(seed.id),
      hint: seed.hint,
      obtainable: true,
    });
  }

  for (const recipe of CRAFTING_RECIPES) {
    rows.push({
      id: recipeCollectionId(recipe.id),
      category: 'recipe',
      name: recipe.name,
      rarity: recipe.rarity,
      realm: recipe.realm,
      lore: recipe.blurb,
      hint: `${recipe.ingredients.length} materials at the bench — crafting level ${recipe.requiredLevel ?? 1}`,
      obtainable: true,
      // The recipe card shows what comes off the anvil, not a picture of a
      // recipe. See `CollectionEntry.artId`.
      artId: recipe.output.itemId,
    });
  }

  for (const seed of CONSUMABLE_SEEDS) {
    rows.push({
      id: seed.id,
      category: 'consumable',
      name: MATERIAL_NAMES[seed.id] ?? seed.id,
      rarity: seed.rarity,
      realm: seed.realm,
      lore: loreFor(seed.id),
      hint: seed.hint,
      obtainable: true,
    });
  }

  return rows;
}

/**
 * Display names for the ids that are stack keys rather than item definitions.
 *
 * `material-catalog.ts` holds the same map and does not export it — and it
 * imports `art-manifest.generated.ts`, which this file is deliberately free of
 * so the catalogue stays a leaf that any SSR path can pull in for a name. The
 * spec cross-checks the two maps so they cannot drift.
 */
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
  'rift-key': 'Rift Key',
  'clarity-elixir': 'Clarity Elixir',
  'ember-elixir': 'Ember Elixir',
};

function loreFor(id: string): string {
  const def = ITEM_DEFINITIONS.find(d => d.id === id);
  return def?.lore ?? SEED_LORE[id] ?? 'The Archivum has it listed and has written nothing beside it.';
}

/** Item styles map onto the narrative realms for five of their eight values. */
function realmForStyle(style: string): NarrativeRealmId | undefined {
  switch (style) {
    case 'infernal': return 'infernal';
    case 'celestial': return 'celestial';
    case 'luminous': return 'luminous';
    case 'umbral': return 'umbral';
    case 'verdant': return 'verdant';
    default: return undefined;
  }
}

/** The one line a locked card shows in place of the name. */
function hintFor(def: ItemDefinition, isReward: boolean): string {
  if (isReward) {
    return def.family === 'charm'
      ? 'given to whoever fills half of this log'
      : 'given to whoever fills three quarters of this log';
  }
  if (def.id === 'basalt-edge') {
    return 'six Cinder Ore and one Ember Residue, struck once at the Seamworks';
  }
  if (UNIQUE_RARITY[def.id]) {
    return 'one of the named objects — a box that reaches its tier, and then luck';
  }
  if (mintable(def)) return 'sealed in a mystery box, at whatever tier the box reaches';
  return 'drawn, named and not yet forged — no hand in the Godforge can mint one';
}

function charmHint(weight: number): string {
  if (weight > 0.5) return 'the common end of the charm table — any strike can turn one up';
  if (weight > 0.05) return 'a charm drop, and then the luckier half of that roll';
  if (weight > 0.005) return 'roughly one charm drop in fifty';
  return 'roughly one charm drop in two hundred';
}

export const COLLECTION_CATALOG: readonly CollectionEntry[] = buildCatalogue();

const ENTRY_BY_ID = new Map(COLLECTION_CATALOG.map(e => [e.id, e]));

export function collectionEntryById(id: string): CollectionEntry | undefined {
  return ENTRY_BY_ID.get(id);
}

/** True when `id` is something the log tracks. Cheaper than a catalogue scan. */
export function isCollectable(id: string | undefined | null): boolean {
  return !!id && ENTRY_BY_ID.has(id);
}

/** Entries that count toward completion: obtainable, and not a reward for it. */
export const COUNTED_CATALOG: readonly CollectionEntry[] =
  COLLECTION_CATALOG.filter(e => e.obtainable && !e.reward);

// ─────────────────────────────────────────────────────────────────────────────
// The ledger
// ─────────────────────────────────────────────────────────────────────────────

export interface CollectionRecord {
  /** Epoch ms of the first time this was ever obtained. */
  firstDiscoveredAt: number;
  /** How many have been obtained across the save's whole life. */
  count: number;
  /**
   * Best average roll grade ever seen for this entry, 0..1.
   *
   * A high-water mark, so it survives selling the item that set it — which is
   * the point: the log is a record of what you have *found*, and a player who
   * scrapped a 97% Cuirass for Gold still found a 97% Cuirass. Absent on
   * entries whose kind does not roll, and on every record written before roll
   * grades existed.
   */
  bestRoll?: number;
}

export interface CollectionLedger {
  version: typeof COLLECTION_SCHEMA_VERSION;
  /** entry id → what is known about it. Absence means undiscovered. */
  entries: Record<string, CollectionRecord>;
  /** Reward ids already paid, so a threshold cannot be settled twice. */
  rewards: string[];
  /**
   * True once the one-time backfill from the pre-existing ledgers has run.
   *
   * Without it a visitor who has been striking the anvil for two months opens
   * the log at 0% and is told to go and find a Cinder Ore. The backfill reads
   * the rune ledger's `firstFound`, the economy's Runewords and artifacts and
   * whatever is in the bag, and credits all of it — see `CollectionService`.
   */
  backfilled?: boolean;
}

export function emptyCollectionLedger(): CollectionLedger {
  return { version: COLLECTION_SCHEMA_VERSION, entries: {}, rewards: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse anything into a ledger.
 *
 * Ids that are not in *this build's* catalogue are kept rather than dropped,
 * and that is the whole reason this note exists. Dropping them is the obvious
 * reading of "validate your input" and it is a data-loss bug in a multi-device
 * save: a phone on last week's build would strip every entry the desktop's
 * newer catalogue added, write the stripped ledger back, and the cloud merge
 * would carry the loss to both. Unknown ids are inert — nothing renders them
 * and nothing counts them — so keeping them costs a few bytes and keeps an old
 * tab from quietly deleting a new tab's discoveries.
 *
 * The shape of each record is still enforced, because that is a real parse.
 */
export function coerceCollectionLedger(raw: unknown): CollectionLedger {
  if (!isRecord(raw)) return emptyCollectionLedger();

  const entries: Record<string, CollectionRecord> = {};
  const rawEntries = isRecord(raw['entries']) ? raw['entries'] : {};
  for (const [id, value] of Object.entries(rawEntries)) {
    if (!isRecord(value)) continue;
    const at = Number(value['firstDiscoveredAt']);
    const count = Number(value['count']);
    const best = Number(value['bestRoll']);
    entries[id] = {
      firstDiscoveredAt: Number.isFinite(at) && at > 0 ? Math.floor(at) : 0,
      count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1,
      ...(Number.isFinite(best) && best > 0
        ? { bestRoll: Math.min(1, Math.max(0, best)) }
        : {}),
    };
  }

  // Same rule as the entries above: a reward id this build has never heard of
  // is a reward a newer build has already paid, and forgetting it would pay it
  // a second time the next time that build is open.
  const rewards = Array.isArray(raw['rewards'])
    ? raw['rewards'].filter((id): id is string => typeof id === 'string')
    : [];

  // `backfilled` is spread in only when true rather than written as
  // `|| undefined`: an explicit `undefined` key is a different object to a
  // missing one under a deep-equality check, and this value is compared against
  // `emptyCollectionLedger()` in more than one place.
  return {
    version: COLLECTION_SCHEMA_VERSION,
    entries,
    rewards: [...new Set(rewards)],
    ...(raw['backfilled'] === true ? { backfilled: true as const } : {}),
  };
}

/**
 * Two collection ledgers into one.
 *
 * The structural max rule in `cloud-save.model.ts` is right for `count` and
 * wrong for `firstDiscoveredAt` in the same way it is wrong for the egg dates:
 * these are the moments things were *first* found, so the later of two is the
 * record of the same discovery made again on a second device, and taking the
 * larger would quietly rewrite somebody's history forward. Earliest wins, and a
 * zero — a backfilled record with no date behind it — loses to any real date.
 *
 * `rewards` unions, because a threshold paid on either device has been paid.
 */
export function mergeCollectionLedgers(remote: unknown, local: unknown): CollectionLedger {
  const a = coerceCollectionLedger(remote);
  const b = coerceCollectionLedger(local);

  const entries: Record<string, CollectionRecord> = { ...a.entries };
  for (const [id, mine] of Object.entries(b.entries)) {
    const theirs = entries[id];
    if (!theirs) {
      entries[id] = { ...mine };
      continue;
    }
    // `bestRoll` is a high-water mark, so the merge is the same `max` the count
    // takes — the better roll happened, whichever device saw it.
    const best = Math.max(theirs.bestRoll ?? 0, mine.bestRoll ?? 0);
    entries[id] = {
      firstDiscoveredAt: earliest(theirs.firstDiscoveredAt, mine.firstDiscoveredAt),
      count: Math.max(theirs.count, mine.count),
      ...(best > 0 ? { bestRoll: best } : {}),
    };
  }

  return {
    version: COLLECTION_SCHEMA_VERSION,
    entries,
    rewards: [...new Set([...a.rewards, ...b.rewards])],
    ...(a.backfilled || b.backfilled ? { backfilled: true as const } : {}),
  };
}

function earliest(a: number, b: number): number {
  if (a <= 0) return b;
  if (b <= 0) return a;
  return Math.min(a, b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Completion arithmetic
// ─────────────────────────────────────────────────────────────────────────────

export interface CompletionCount {
  found: number;
  total: number;
  /** 0–100, floored. 100 is reserved for genuinely everything. */
  percent: number;
}

export function completionOf(found: number, total: number): CompletionCount {
  if (total <= 0) return { found: 0, total: 0, percent: 0 };
  const raw = (found / total) * 100;
  // Floor, then hold 99 until the last one lands: a bar that reads 100% with
  // one card still dark is the single thing a collection log must never do.
  const percent = found >= total ? 100 : Math.min(99, Math.floor(raw));
  return { found, total, percent };
}

function isFound(ledger: CollectionLedger, id: string): boolean {
  return !!ledger.entries[id];
}

/** Overall completion across everything that counts. */
export function overallCompletion(ledger: CollectionLedger): CompletionCount {
  let found = 0;
  for (const entry of COUNTED_CATALOG) if (isFound(ledger, entry.id)) found++;
  return completionOf(found, COUNTED_CATALOG.length);
}

/** Completion per category, in catalogue order. Uncounted entries are excluded. */
export function completionByCategory(
  ledger: CollectionLedger,
): Record<CollectionCategory, CompletionCount> {
  const out = {} as Record<CollectionCategory, CompletionCount>;
  for (const cat of COLLECTION_CATEGORY_ORDER) {
    const rows = COUNTED_CATALOG.filter(e => e.category === cat);
    let found = 0;
    for (const row of rows) if (isFound(ledger, row.id)) found++;
    out[cat] = completionOf(found, rows.length);
  }
  return out;
}

/** Completion per rarity band, in ladder order. */
export function completionByRarity(
  ledger: CollectionLedger,
): Record<ItemRarity, CompletionCount> {
  const out = {} as Record<ItemRarity, CompletionCount>;
  for (const tier of RUNE_TIER_ORDER) {
    const rows = COUNTED_CATALOG.filter(e => e.rarity === tier);
    let found = 0;
    for (const row of rows) if (isFound(ledger, row.id)) found++;
    out[tier] = completionOf(found, rows.length);
  }
  return out;
}

/** The n most recent discoveries, newest first. Records with no date are skipped. */
export function recentDiscoveries(
  ledger: CollectionLedger,
  limit = 6,
): { entry: CollectionEntry; at: number; count: number }[] {
  const rows: { entry: CollectionEntry; at: number; count: number }[] = [];
  for (const [id, record] of Object.entries(ledger.entries)) {
    const entry = ENTRY_BY_ID.get(id);
    if (!entry || record.firstDiscoveredAt <= 0) continue;
    rows.push({ entry, at: record.firstDiscoveredAt, count: record.count });
  }
  rows.sort((a, b) => b.at - a.at || a.entry.name.localeCompare(b.entry.name));
  return rows.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rewards
// ─────────────────────────────────────────────────────────────────────────────

export interface CollectionReward {
  id: string;
  /** Overall completion, in percent, that pays this out. */
  at: number;
  /** The title as it reads on the card. */
  title: string;
  gold: number;
  /**
   * The `title-prefix` cosmetic variant granted with it.
   *
   * A real variant on the real cosmetic, so the title shows in the XP bar's
   * rank chip like any other — a title that only existed on this one page would
   * be a label, not a title.
   */
  titleVariant: string;
  /** An `ItemDefinition` id minted into the bag, when the tier carries one. */
  item?: string;
  /** A `cursor-trail` variant, when the tier carries one. */
  trailVariant?: string;
  blurb: string;
}

export const COLLECTION_REWARDS: readonly CollectionReward[] = [
  {
    id: 'collector-apprentice',
    at: 25,
    title: 'Apprentice Collector',
    gold: 10_000,
    titleVariant: 'apprentice-collector',
    blurb: 'A quarter of the record. Enough to know what the shape of it is.',
  },
  {
    id: 'collector-journeyman',
    at: 50,
    title: 'Journeyman Collector',
    gold: 50_000,
    titleVariant: 'journeyman-collector',
    item: 'sealed-codex-page',
    blurb: 'Half. The Archivum sends a page it had decided never to send anyone.',
  },
  {
    id: 'collector-master',
    at: 75,
    title: 'Master Collector',
    gold: 200_000,
    titleVariant: 'master-collector',
    item: 'keeper-signet',
    blurb: 'Three quarters, and a signet that nobody can produce the paperwork for.',
  },
  {
    id: 'collector-archivist',
    at: 100,
    title: 'Eclipse Archivist',
    gold: 1_000_000,
    titleVariant: 'eclipse-archivist',
    trailVariant: 'archivist',
    blurb: 'Everything. There is nothing left in the world you have not held.',
  },
];

const REWARD_BY_ID = new Map(COLLECTION_REWARDS.map(r => [r.id, r]));

export function collectionRewardById(id: string): CollectionReward | undefined {
  return REWARD_BY_ID.get(id);
}

/** Rewards a given completion has earned but the ledger has not yet paid. */
export function unpaidRewards(
  ledger: CollectionLedger,
  percent: number,
): CollectionReward[] {
  const paid = new Set(ledger.rewards);
  return COLLECTION_REWARDS.filter(r => percent >= r.at && !paid.has(r.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Turning a granted thing into a catalogue id
// ─────────────────────────────────────────────────────────────────────────────

const CHARM_BY_NAME = new Map(ALL_CHARMS.map(c => [c.name, c.id]));

/**
 * The catalogue id a bag item counts as, or null when it counts as nothing.
 *
 * Three shapes reach the bag and only two of them are catalogued:
 *
 *   • Anything minted from a definition carries `definitionId`, which *is* the
 *     catalogue id.
 *   • A charm is minted from a `CharmSeed` and carries no definition id at all —
 *     its instance id is `${seed.id}-${base36}-${base36}`, which a prefix match
 *     would resolve wrongly the day two seeds share a prefix. The name is exact
 *     and stable, so the name is the join.
 *   • A rune Sigil (`type: 'rune'`) is a *separate* object named after a rune;
 *     the rune itself is tracked on the Forge ledger. Counting the sigil would
 *     record the Void as found because a Void Sigil dropped, which it cannot.
 */
export function collectionIdForItem(
  item: Pick<GameItem, 'definitionId' | 'name' | 'type'>,
): string | null {
  if (item.type === 'rune') return null;
  if (item.definitionId && ENTRY_BY_ID.has(item.definitionId)) return item.definitionId;
  if (item.type === 'charm') {
    const id = CHARM_BY_NAME.get(item.name);
    if (id && ENTRY_BY_ID.has(id)) return id;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtering, sorting and the locked silhouette
// ─────────────────────────────────────────────────────────────────────────────

export type CollectionStatus = 'all' | 'found' | 'unfound';
export type CollectionSort = 'catalogue' | 'rarity' | 'newest' | 'name';

export const COLLECTION_SORTS: readonly CollectionSort[] = ['catalogue', 'rarity', 'newest', 'name'];

export const COLLECTION_SORT_LABELS: Readonly<Record<CollectionSort, string>> = {
  catalogue: 'Catalogue order',
  rarity: 'Rarity',
  newest: 'Newest find',
  name: 'Name',
};

/** One card, as the grid renders it. */
export interface CollectionCard {
  entry: CollectionEntry;
  found: boolean;
  firstDiscoveredAt: number;
  count: number;
  /** Position in the catalogue, which is what picks the locked glyph. */
  index: number;
}

export function buildCards(ledger: CollectionLedger): CollectionCard[] {
  return COLLECTION_CATALOG.map((entry, index) => {
    const record = ledger.entries[entry.id];
    return {
      entry,
      found: !!record,
      firstDiscoveredAt: record?.firstDiscoveredAt ?? 0,
      count: record?.count ?? 0,
      index,
    };
  });
}

export interface CollectionFilter {
  category: CollectionCategory | 'all';
  rarity: ItemRarity | 'all';
  status: CollectionStatus;
  realm: NarrativeRealmId | 'all' | 'unaligned';
  query: string;
}

export const EMPTY_FILTER: CollectionFilter = {
  category: 'all', rarity: 'all', status: 'all', realm: 'all', query: '',
};

export function filterCards(
  cards: readonly CollectionCard[],
  filter: CollectionFilter,
): CollectionCard[] {
  const q = filter.query.trim().toLowerCase();
  return cards.filter(card => {
    const e = card.entry;
    if (filter.category !== 'all' && e.category !== filter.category) return false;
    if (filter.rarity !== 'all' && e.rarity !== filter.rarity) return false;
    if (filter.status === 'found' && !card.found) return false;
    if (filter.status === 'unfound' && card.found) return false;
    if (filter.realm === 'unaligned' && e.realm) return false;
    if (filter.realm !== 'all' && filter.realm !== 'unaligned' && e.realm !== filter.realm) return false;
    if (!q) return true;

    // An unfound card must not be searchable by its name — that is the answer,
    // and a search box that reveals it turns the log into a checklist.
    if (card.found && e.name.toLowerCase().includes(q)) return true;
    if (e.category.includes(q) || e.rarity.includes(q)) return true;
    if ((q === 'locked' || q === 'unknown' || q === 'missing') && !card.found) return true;
    if ((q === 'found' || q === 'discovered') && card.found) return true;
    if (card.found && e.lore.toLowerCase().includes(q)) return true;
    return false;
  });
}

export function sortCards(
  cards: readonly CollectionCard[],
  sort: CollectionSort,
): CollectionCard[] {
  const next = [...cards];
  next.sort((a, b) => {
    if (sort === 'name') {
      // Found first: sorting the unfound by a name the player cannot see is a
      // shuffle with extra steps.
      if (a.found !== b.found) return a.found ? -1 : 1;
      if (!a.found) return a.index - b.index;
      return a.entry.name.localeCompare(b.entry.name);
    }
    if (sort === 'newest') {
      return b.firstDiscoveredAt - a.firstDiscoveredAt || a.index - b.index;
    }
    if (sort === 'rarity') {
      const d = RUNE_TIER_ORDER.indexOf(b.entry.rarity) - RUNE_TIER_ORDER.indexOf(a.entry.rarity);
      if (d !== 0) return d;
      return a.index - b.index;
    }
    return a.index - b.index;
  });
  return next;
}

/** A stable silhouette for a locked card that leaks nothing about the name. */
const LOCKED_MARKS = ['◈', '◇', '☽', 'ϟ', '✦', '✶', '⬡', '⟡', '☼', '☖', '⌘', '❖'] as const;

export function lockedGlyph(index: number): string {
  return LOCKED_MARKS[Math.abs(index) % LOCKED_MARKS.length];
}
