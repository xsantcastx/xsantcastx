/**
 * crafting.model.ts — the recipe catalogue, the crafting ladder, and mastery.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SECOND RECIPE FILE AND NOT AN EDIT TO forge-recipes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * `forge-recipes.ts` holds exactly one recipe — Basalt Edge — and it is not a
 * catalogue: it is the C9 first-craft, wired to its own gateway, its own
 * activity flag (Mining stops guaranteeing Ember Residue once it is done) and
 * its own hand-written mint. Folding forty ordinary recipes into it would put a
 * one-off progression beat and a content list in the same file, and the next
 * person to retune the ladder would be editing the tutorial.
 *
 * So the first craft stays where it is and this is the bench. The two agree on
 * what a recipe *is* — inputs are material stack keys, output is an
 * `ITEM_DEFINITIONS` id — and share every downstream system: the same bag, the
 * same mint, the same Collection Log, the same Exchange.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE INPUTS ARE STACK KEYS AND NOT ITEM IDS
 * ─────────────────────────────────────────────────────────────────────────────
 * A material in this game is a quantity, not an instance — see the header of
 * `item-definition.ts`. `InventoryService.stackOf(key)` is the only reader and
 * `applyStackOp` the only writer, and both are keyed by the material's
 * definition id. Every `materialId` below is therefore an id that appears in
 * `MATERIAL_SEEDS` (what Mining, Foraging and Prospecting grant) or in the Art
 * Bible's material list (what expeditions bring home). The model spec
 * fails the build if one of them is not a real, grantable material.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY craftTime IS A UI BEAT AND NOT A BACKGROUND JOB
 * ─────────────────────────────────────────────────────────────────────────────
 * Nothing is consumed until the strike lands. A craft with `craftTime: 6` shows
 * six seconds of anvil, and if the tab closes at second five the player still
 * has their materials and their Gold. The alternative — reserving inputs,
 * persisting an in-flight craft, settling it on the next load — is a second
 * offline-production system, and the master plan's P0 slice is explicit that
 * active actions only are in scope. When background crafting is specified it
 * gets an operation ledger of its own; it does not get bolted onto a timer.
 *
 * Pure data and pure functions. No Angular, no browser APIs, SSR-safe.
 */
import type { ItemRarity } from '../rpg/item.model';
import type { NarrativeRealmId } from '../narrative/five-realms.narrative';
import { bandFor } from '../rpg/item-quality';

/** The localStorage key. Registered in `SYNCED_BLOBS` so it reaches the cloud. */
export const CRAFTING_KEY = 'godforge-crafting';

export const CRAFTING_SCHEMA_VERSION = 1 as const;

/** What the bench groups recipes under, and what the filter chips filter on. */
export type CraftingCategory = 'weapon' | 'armor' | 'charm' | 'consumable';

export interface CraftingCategoryDefinition {
  id: CraftingCategory;
  label: string;
  /** Glyph. Crafting categories have no painted sigil of their own. */
  icon: string;
  color: string;
  glow: string;
  blurb: string;
}

/**
 * Colours are lifted from the Collection Log's category palette rather than
 * invented, so an Equipment row and a Weapon recipe read as the same family.
 * See §2 of CLAUDE.md — no new colours without a palette entry.
 */
export const CRAFTING_CATEGORIES: readonly CraftingCategoryDefinition[] = [
  {
    id: 'weapon',
    label: 'Weapons',
    icon: '⚔',
    color: '#8f98a8',
    glow: 'rgba(143, 152, 168, 0.55)',
    blurb: 'Edges, hafts and hammers. What the anvil was built for.',
  },
  {
    id: 'armor',
    label: 'Armor',
    icon: '⛨',
    color: '#5fb6ff',
    glow: 'rgba(80, 180, 255, 0.6)',
    blurb: 'Plate, mail and cloth. The half of a loadout that decides how long you last.',
  },
  {
    id: 'charm',
    label: 'Charms',
    icon: '☘',
    color: '#a48bff',
    glow: 'rgba(140, 110, 255, 0.6)',
    blurb: 'Small things that carry an exact number, cut rather than forged.',
  },
  {
    id: 'consumable',
    label: 'Consumables',
    icon: '⚗',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.6)',
    blurb: 'Brewed at the bench and spent once. The log remembers them anyway.',
  },
];

const CATEGORY_BY_ID = new Map(CRAFTING_CATEGORIES.map(c => [c.id, c]));

export function craftingCategory(id: CraftingCategory): CraftingCategoryDefinition {
  return CATEGORY_BY_ID.get(id) ?? CRAFTING_CATEGORIES[0];
}

export interface CraftingIngredient {
  /** A material definition id. Must be something the game can actually grant. */
  materialId: string;
  count: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  ingredients: readonly CraftingIngredient[];
  output: { itemId: string; count: number };
  /**
   * The tier the output mints at.
   *
   * Authored rather than derived: an ordinary definition has no rarity of its
   * own (the box that opens it decides), and a recipe that cost forty
   * materials must not be able to hand back a Common. This is the contract the
   * ingredient list is priced against.
   */
  rarity: ItemRarity;
  category: CraftingCategory;
  requiredLevel?: number;
  realm?: NarrativeRealmId;
  /** Seconds of anvil before the strike lands. 0 for instant. See the header. */
  craftTime?: number;
  goldCost: number;
  /** One line, shown under the name on the recipe card. */
  blurb: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The catalogue
// ─────────────────────────────────────────────────────────────────────────────
//
// Forty recipes. Read the columns rather than the rows: every gathering skill
// feeds the bottom of the ladder (Mining's ore into weapons, Foraging's herbs
// into consumables, Prospecting's alloy and prisms into armor and charms), and
// every Art Bible material — the ones expeditions bring home — appears at the
// top. A recipe that used only expedition materials would be unreachable to a
// player who has never sent an explorer out, so the first rung of each column
// is gatherable by hand.

function r(
  id: string,
  name: string,
  category: CraftingCategory,
  rarity: ItemRarity,
  itemId: string,
  ingredients: readonly CraftingIngredient[],
  goldCost: number,
  requiredLevel: number,
  blurb: string,
  extra: { realm?: NarrativeRealmId; craftTime?: number; count?: number } = {},
): CraftingRecipe {
  return {
    id,
    name,
    category,
    rarity,
    ingredients,
    output: { itemId, count: extra.count ?? 1 },
    goldCost,
    requiredLevel,
    realm: extra.realm,
    craftTime: extra.craftTime ?? 0,
    blurb,
  };
}

const m = (materialId: string, count: number): CraftingIngredient => ({ materialId, count });

const WEAPON_RECIPES: readonly CraftingRecipe[] = [
  r('craft-briarvein-kris', 'Briarvein Kris', 'weapon', 'uncommon', 'briarvein-kris',
    [m('thornroot', 6), m('verdant-sap', 3), m('world-root-bark', 2)],
    12_000, 1, 'Planted as a seed, watered with sap, harvested after three eclipses.',
    { realm: 'verdant', craftTime: 3 }),
  r('craft-rootbreaker-mace', 'Rootbreaker Mace', 'weapon', 'uncommon', 'rootbreaker-mace',
    [m('world-root-bark', 5), m('thornroot', 4), m('slag-fragment', 6)],
    14_000, 2, 'Petrified heartwood, cut before it could rot into nothing.',
    { realm: 'verdant', craftTime: 3 }),
  r('craft-ashveil-knives', 'Ashveil Throwing Knives', 'weapon', 'uncommon', 'ashveil-throwing-knives',
    [m('cinder-ore', 8), m('pyrite-dust', 4), m('shadowthread-silk', 1)],
    16_000, 3, 'Fire should be precise, said the Ashwalkers, and then were disbanded.',
    { realm: 'infernal', craftTime: 4 }),
  r('craft-dawnrender', 'Dawnrender', 'weapon', 'epic', 'dawnrender',
    [m('emberheart-ore', 5), m('ember-residue', 2), m('solar-resin', 3), m('luminous-prism', 4)],
    180_000, 12, 'The blade the Luminous Realm cracked the void ceiling with.',
    { realm: 'luminous', craftTime: 8 }),
  r('craft-pyreclast-wand', 'Pyreclast Wand', 'weapon', 'rare', 'pyreclast-wand',
    [m('cinder-ore', 12), m('ember-residue', 3), m('pyrite-dust', 6)],
    46_000, 5, 'The Infernal Realm does not produce elegant instruments.',
    { realm: 'infernal', craftTime: 5 }),
  r('craft-meridian-longbow', 'Meridian Longbow', 'weapon', 'rare', 'meridian-longbow',
    [m('celestial-alloy', 10), m('world-root-bark', 4), m('celestial-quartz', 3)],
    52_000, 6, 'Twelve were made, each tuned to a different constellation.',
    { realm: 'celestial', craftTime: 5 }),
  r('craft-radiant-halberd', 'Radiant Halberd', 'weapon', 'rare', 'radiant-halberd',
    [m('luminous-prism', 8), m('solar-resin', 4), m('orichalcum-ore', 2)],
    58_000, 7, 'Light reaches further than shadow, so the Luminous carry halberds.',
    { realm: 'luminous', craftTime: 5 }),
  r('craft-spinerift-crossbow', 'Spinerift Crossbow', 'weapon', 'rare', 'spinerift-crossbow',
    [m('world-root-bark', 8), m('thornroot', 6), m('verdant-sap', 5)],
    50_000, 6, 'The Verdant Realm does not mine metal. It grows its range.',
    { realm: 'verdant', craftTime: 5 }),
  r('craft-nullthorn-staff', 'Nullthorn Staff', 'weapon', 'rare', 'nullthorn-staff',
    [m('umbral-ink', 6), m('shadowthread-silk', 4), m('world-root-bark', 3)],
    62_000, 8, 'Grown from a cutting of the World-Root\'s shadow.',
    { realm: 'umbral', craftTime: 6 }),
  r('craft-cindergnaw', 'Cindergnaw', 'weapon', 'epic', 'cindergnaw',
    [m('emberheart-ore', 6), m('infernal-heartstone', 3), m('rune-of-cinder', 1)],
    195_000, 13, 'Made to fell the ironwood pillars holding up the Underhearth.',
    { realm: 'infernal', craftTime: 8 }),
  r('craft-astral-glaive', 'Astral Glaive', 'weapon', 'epic', 'astral-glaive',
    [m('celestial-quartz', 6), m('celestial-alloy', 12), m('moonpetal-herb', 4)],
    210_000, 14, 'The Celestial Realm measures time by the motion of their glaives.',
    { realm: 'celestial', craftTime: 8 }),
  r('craft-godforge-tongs', 'Godforge Tongs', 'weapon', 'epic', 'godforge-tongs',
    [m('godforge-slag', 8), m('orichalcum-ore', 4), m('rune-of-the-forge', 2)],
    225_000, 15, 'They shaped the first anvil, which shaped everything else.',
    { craftTime: 9 }),
  r('craft-starfall-maul', 'Starfall Maul', 'weapon', 'legendary', 'starfall-maul',
    [m('celestial-quartz', 10), m('orichalcum-ore', 6), m('void-shard', 2), m('rune-of-starfire', 1)],
    720_000, 20, 'A fragment of dead star, fallen through an open window.',
    { realm: 'celestial', craftTime: 12 }),
  r('craft-hollow-fang', 'Hollow Fang', 'weapon', 'legendary', 'hollow-fang',
    [m('void-crystal', 3), m('shadowthread-silk', 8), m('umbral-ink', 10), m('rune-of-hollow', 2)],
    760_000, 22, 'Pulled from the jaw of something whose teeth had become glass.',
    { realm: 'umbral', craftTime: 12 }),
  r('craft-eclipse-edge', 'Eclipse Edge', 'weapon', 'mythic', 'eclipse-edge',
    [m('void-crystal', 6), m('void-shard', 5), m('orichalcum-ore', 12), m('rune-of-the-world-root', 1)],
    3_200_000, 28, 'The tool the Nameless used to cut one world into five.',
    { craftTime: 15 }),
];

const ARMOR_RECIPES: readonly CraftingRecipe[] = [
  r('craft-thornmantle-pauldrons', 'Thornmantle Pauldrons', 'armor', 'uncommon', 'thornmantle-pauldrons',
    [m('thornroot', 8), m('world-root-bark', 4), m('verdant-sap', 3)],
    13_000, 1, 'They grow inward if left unworn, which is the Verdant way of asking.',
    { realm: 'verdant', craftTime: 3 }),
  r('craft-rootwall-shield', 'Rootwall Shield', 'armor', 'uncommon', 'rootwall-shield',
    [m('world-root-bark', 7), m('thornroot', 5), m('slag-fragment', 4)],
    15_000, 2, 'A wall that was a tree and has not entirely stopped being one.',
    { realm: 'verdant', craftTime: 3 }),
  r('craft-starplate-cuirass', 'Starplate Cuirass', 'armor', 'rare', 'starplate-cuirass',
    [m('celestial-alloy', 3), m('void-shard', 1), m('celestial-quartz', 4)],
    64_000, 6, 'Three Celestial Alloy and one Void Shard, poured in a ring.',
    { realm: 'celestial', craftTime: 5 }),
  r('craft-ember-vambraces', 'Ember Vambraces', 'armor', 'rare', 'ember-vambraces',
    [m('emberheart-ore', 4), m('ember-residue', 2), m('pyrite-dust', 6)],
    56_000, 5, 'They stay warm through an Umbral night, which is the whole point.',
    { realm: 'infernal', craftTime: 5 }),
  r('craft-cinderhide-coat', 'Cinderhide Coat', 'armor', 'rare', 'cinderhide-coat',
    [m('cinder-ore', 14), m('slag-fragment', 8), m('shadowthread-silk', 2)],
    54_000, 5, 'Ash worked into leather until the leather stopped minding.',
    { realm: 'infernal', craftTime: 5 }),
  r('craft-astral-striders', 'Astral Striders', 'armor', 'rare', 'astral-striders',
    [m('celestial-alloy', 8), m('luminous-prism', 5), m('moonpetal-herb', 3)],
    60_000, 7, 'They do not make a sound on stone, and they do on nothing.',
    { realm: 'celestial', craftTime: 5 }),
  r('craft-blazebraid-belt', 'Blazebraid Belt', 'armor', 'rare', 'blazebraid-belt',
    [m('emberheart-ore', 3), m('pyrite-dust', 8), m('shadowthread-silk', 3)],
    58_000, 7, 'Braided hot, cooled once, and never untied since.',
    { realm: 'infernal', craftTime: 5 }),
  r('craft-voidweave-cowl', 'Voidweave Cloak', 'armor', 'epic', 'voidweave-cowl',
    [m('shadowthread-silk', 2), m('umbral-ink', 1), m('void-crystal', 1)],
    175_000, 11, 'Two Shadowthread Silk and one Umbral Ink, woven by the blind.',
    { realm: 'umbral', craftTime: 8 }),
  r('craft-solstice-greaves', 'Solstice Greaves', 'armor', 'epic', 'solstice-greaves',
    [m('solar-resin', 6), m('luminous-prism', 8), m('orichalcum-ore', 3)],
    190_000, 12, 'Cut to the Luminous calendar, one plate per turning of the light.',
    { realm: 'luminous', craftTime: 8 }),
  r('craft-cometfall-helm', 'Cometfall Helm', 'armor', 'epic', 'cometfall-helm',
    [m('celestial-quartz', 5), m('orichalcum-ore', 4), m('rune-of-void-navigation', 1)],
    205_000, 14, 'The dent on the crown is original and the smith refused to beat it out.',
    { realm: 'celestial', craftTime: 8 }),
  r('craft-duskmail-hauberk', 'Duskmail Hauberk', 'armor', 'epic', 'duskmail-hauberk',
    [m('shadowthread-silk', 6), m('umbral-ink', 8), m('void-shard', 2)],
    198_000, 13, 'Every ring is a shadow of the ring beside it, which is why it is quiet.',
    { realm: 'umbral', craftTime: 8 }),
  r('craft-forgeborn-warhelm', 'Forgeborn Warhelm', 'armor', 'epic', 'forgeborn-warhelm',
    [m('godforge-slag', 10), m('emberheart-ore', 4), m('rune-of-the-forge', 1)],
    215_000, 15, 'Poured, not beaten. The Godforge does not repeat itself.',
    { craftTime: 9 }),
  r('craft-abyssal-aegis', 'Abyssal Aegis', 'armor', 'legendary', 'abyssal-aegis',
    [m('void-crystal', 4), m('void-shard', 4), m('shadowthread-silk', 10), m('rune-of-erasure', 1)],
    780_000, 22, 'It does not block. It declines to have been struck.',
    { realm: 'umbral', craftTime: 12 }),
  r('craft-luminous-aegis-mantle', 'Luminous Aegis Mantle', 'armor', 'legendary', 'luminous-aegis-mantle',
    [m('solar-resin', 10), m('luminous-prism', 14), m('orichalcum-ore', 6), m('rune-of-the-solstice', 1)],
    810_000, 24, 'Aureth wore one of these and it is not known what happened to it.',
    { realm: 'luminous', craftTime: 12 }),
  r('craft-crown-first-dawn', 'Crown of the First Dawn', 'armor', 'legendary', 'crown-of-the-first-dawn',
    [m('solar-resin', 12), m('celestial-quartz', 8), m('orichalcum-ore', 8), m('rune-of-radiance', 3)],
    950_000, 26, 'The original absorbed enough light during the Shattering to burn forever.',
    { realm: 'luminous', craftTime: 14 }),
];

const CHARM_RECIPES: readonly CraftingRecipe[] = [
  r('craft-aurumleaf-pendant', 'Aurumleaf Pendant', 'charm', 'uncommon', 'aurumleaf-pendant',
    [m('solar-resin', 2), m('luminous-prism', 4), m('sunbloom', 6)],
    18_000, 2, 'Gold leaf beaten thin enough to hear.',
    { realm: 'luminous', craftTime: 2 }),
  r('craft-dewdrop-purse', 'Dewdrop Purse', 'charm', 'uncommon', 'dewdrop-purse',
    [m('verdant-sap', 5), m('starlight-herb', 8), m('world-root-bark', 2)],
    17_000, 1, 'It holds more than it should and will not explain how.',
    { realm: 'verdant', craftTime: 2 }),
  r('craft-inkwell-talisman', 'Inkwell Talisman', 'charm', 'uncommon', 'inkwell-talisman',
    [m('umbral-ink', 5), m('shadowthread-silk', 2), m('nightbloom', 4)],
    19_000, 3, 'It writes perfectly well and it will not photograph.',
    { realm: 'umbral', craftTime: 2 }),
  r('craft-seedpod-of-knowing', 'Seedpod of Knowing', 'charm', 'uncommon', 'seedpod-of-knowing',
    [m('world-root-bark', 4), m('starlight-herb', 10), m('verdant-sap', 3)],
    18_500, 3, 'It rattles near a true thing and is silent near a clever one.',
    { realm: 'verdant', craftTime: 2 }),
  r('craft-ember-primer', 'Ember Primer', 'charm', 'rare', 'ember-primer',
    [m('ember-residue', 3), m('pyrite-dust', 8), m('cinder-ore', 10)],
    68_000, 6, 'The first page is a warning and the rest is not.',
    { realm: 'infernal', craftTime: 4 }),
  r('craft-lens-of-the-archivist', 'Lens of the Archivist', 'charm', 'rare', 'lens-of-the-archivist',
    [m('celestial-quartz', 4), m('luminous-prism', 6), m('moonpetal-herb', 4)],
    72_000, 8, 'Ground so that what goes in comes out as an argument about it.',
    { realm: 'celestial', craftTime: 4 }),
  r('craft-sunstone-dowser', 'Sunstone Dowser', 'charm', 'rare', 'sunstone-dowser',
    [m('solar-resin', 5), m('luminous-prism', 7), m('celestial-alloy', 6)],
    70_000, 7, 'It points at light the way a compass points at north, and as stubbornly.',
    { realm: 'luminous', craftTime: 4 }),
  r('craft-thornseeker-beetle', 'Thornseeker Beetle', 'charm', 'rare', 'thornseeker-beetle',
    [m('thornroot', 10), m('nightbloom', 6), m('verdant-sap', 4)],
    66_000, 6, 'It is not alive. It has never been told.',
    { realm: 'verdant', craftTime: 4 }),
  r('craft-cinder-compass', 'Cinder Compass', 'charm', 'epic', 'cinder-compass',
    [m('infernal-heartstone', 4), m('emberheart-ore', 5), m('rune-of-cinder', 1)],
    240_000, 16, 'Its needle finds heat, and it has been wrong exactly once.',
    { realm: 'infernal', craftTime: 7 }),
  r('craft-gilded-quill', 'Gilded Quill', 'charm', 'epic', 'gilded-quill',
    [m('solar-resin', 7), m('orichalcum-ore', 3), m('moonpetal-herb', 6)],
    235_000, 16, 'It signs a name it was not given, once per owner.',
    { realm: 'luminous', craftTime: 7 }),
  r('craft-tithe-of-ash', 'Tithe of Ash', 'charm', 'epic', 'tithe-of-ash',
    [m('godforge-slag', 6), m('pyrite-dust', 12), m('infernal-heartstone', 3)],
    245_000, 17, 'What the Godforge keeps back, weighed and carried.',
    { realm: 'infernal', craftTime: 7 }),
  r('craft-phantom-toll', 'Phantom Toll', 'charm', 'legendary', 'phantom-toll',
    [m('void-crystal', 3), m('umbral-ink', 12), m('shadowthread-silk', 6), m('rune-of-hollow', 1)],
    840_000, 25, 'A coin paid to a ferryman who is not there and takes it anyway.',
    { realm: 'umbral', craftTime: 11 }),
];

const CONSUMABLE_RECIPES: readonly CraftingRecipe[] = [
  r('craft-health-elixir', 'Thornberry Elixir', 'consumable', 'uncommon', 'thornberry-elixir',
    [m('thornroot', 10), m('moonpetal-herb', 3)],
    4_000, 1, 'Ten Thornroot and three Moonpetal. It tastes like a warning.',
    { realm: 'verdant', craftTime: 0, count: 2 }),
  r('craft-starbloom-tea', 'Starbloom Tea', 'consumable', 'uncommon', 'starbloom-tea',
    [m('starlight-herb', 8), m('moonpetal-herb', 2), m('sunbloom', 4)],
    4_500, 1, 'Brewed at the hour the First Sun used to cross. Nothing crosses.',
    { realm: 'celestial', craftTime: 0, count: 2 }),
  r('craft-rootsap-tincture', 'Rootsap Tincture', 'consumable', 'uncommon', 'rootsap-tincture',
    [m('verdant-sap', 6), m('starlight-herb', 6), m('world-root-bark', 1)],
    5_000, 2, 'Still moving in the bottle. The Canopy will not discuss that.',
    { realm: 'verdant', craftTime: 0, count: 2 }),
  r('craft-embervial', 'Embervial', 'consumable', 'rare', 'embervial',
    [m('ember-residue', 2), m('cinder-ore', 8), m('pyrite-dust', 3)],
    22_000, 4, 'Sealed hot. It has never once cooled and nobody has asked why.',
    { realm: 'infernal', craftTime: 2 }),
  r('craft-liquid-dawn', 'Flask of Liquid Dawn', 'consumable', 'rare', 'liquid-dawn',
    [m('solar-resin', 3), m('sunbloom', 10), m('luminous-prism', 3)],
    24_000, 5, 'One mouthful of the morning the Luminous Realm keeps in reserve.',
    { realm: 'luminous', craftTime: 2 }),
  r('craft-astral-ink', 'Astral Ink', 'consumable', 'rare', 'astral-ink',
    [m('celestial-quartz', 2), m('umbral-ink', 4), m('moonpetal-herb', 3)],
    26_000, 6, 'It dries into a constellation that is accurate for about a week.',
    { realm: 'celestial', craftTime: 2 }),
  r('craft-forge-dust-sachet', 'Forge-Dust Sachet', 'consumable', 'rare', 'forge-dust-sachet',
    [m('godforge-slag', 4), m('slag-fragment', 10), m('pyrite-dust', 5)],
    25_000, 6, 'Swept up, sieved twice, and worth more than what it was swept from.',
    { craftTime: 2, count: 2 }),
  r('craft-phial-null', 'Phial of Null', 'consumable', 'epic', 'phial-null',
    [m('void-shard', 2), m('umbral-ink', 8), m('void-crystal', 1)],
    120_000, 10, 'The label is blank. So, reportedly, is the phial.',
    { realm: 'umbral', craftTime: 4 }),
  r('craft-scroll-shattering-memory', 'Scroll of Shattering Memory', 'consumable', 'legendary', 'scroll-shattering-memory',
    [m('void-crystal', 2), m('celestial-quartz', 6), m('rune-of-erasure', 1)],
    560_000, 21, 'Read once. It removes what it was read to remove, and one thing more.',
    { craftTime: 9 }),
  r('craft-eclipse-fragment-capsule', 'Eclipse Fragment Capsule', 'consumable', 'mythic', 'eclipse-fragment-capsule',
    [m('void-crystal', 5), m('void-shard', 6), m('orichalcum-ore', 8), m('rune-of-the-underhearth', 1)],
    2_400_000, 30, 'A piece of the cut itself, sealed in glass that does not want it.',
    { craftTime: 14 }),
];

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
  ...WEAPON_RECIPES,
  ...ARMOR_RECIPES,
  ...CHARM_RECIPES,
  ...CONSUMABLE_RECIPES,
];

const RECIPE_BY_ID = new Map(CRAFTING_RECIPES.map(row => [row.id, row]));

export function craftingRecipeById(id: string): CraftingRecipe | undefined {
  return RECIPE_BY_ID.get(id);
}

export function recipesInCategory(category: CraftingCategory): readonly CraftingRecipe[] {
  return CRAFTING_RECIPES.filter(row => row.category === category);
}

// ─────────────────────────────────────────────────────────────────────────────
// The crafting ladder
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_CRAFTING_LEVEL = 30;

/**
 * XP for one craft, by the tier of what came off the anvil.
 *
 * Deliberately steep. A player who only ever brews Thornberry Elixirs should
 * reach level 10 eventually and never reach 25 — the ladder is a record of what
 * you have actually forged, not of how many times you pressed the button.
 */
export const CRAFT_XP: Readonly<Record<ItemRarity, number>> = {
  common: 12,
  uncommon: 30,
  rare: 90,
  epic: 260,
  legendary: 780,
  mythic: 2_200,
  singular: 6_000,
};

export function craftXpFor(recipe: CraftingRecipe): number {
  return (CRAFT_XP[recipe.rarity] ?? CRAFT_XP.common) * Math.max(1, recipe.output.count);
}

/**
 * Total XP needed to *reach* `level`.
 *
 * `120 * (level - 1) ** 1.85`, rounded to something readable. Level 2 costs
 * 120, level 10 costs about 8,000, level 30 about 76,000 — roughly ninety
 * Epics or a long patient life of tinctures.
 */
export function xpToReach(level: number): number {
  const n = Math.max(1, Math.min(MAX_CRAFTING_LEVEL, Math.floor(level)));
  if (n <= 1) return 0;
  return Math.round((120 * Math.pow(n - 1, 1.85)) / 10) * 10;
}

export function craftingLevelFor(xp: number): number {
  const total = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let level = 1;
  while (level < MAX_CRAFTING_LEVEL && total >= xpToReach(level + 1)) level++;
  return level;
}

export interface CraftingLevelView {
  level: number;
  xp: number;
  /** XP into the current level. */
  into: number;
  /** XP the current level spans. 0 at the cap. */
  span: number;
  percent: number;
  maxed: boolean;
}

export function craftingLevelView(xp: number): CraftingLevelView {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const level = craftingLevelFor(total);
  const floor = xpToReach(level);
  if (level >= MAX_CRAFTING_LEVEL) {
    return { level, xp: total, into: 0, span: 0, percent: 100, maxed: true };
  }
  const ceiling = xpToReach(level + 1);
  const span = Math.max(1, ceiling - floor);
  const into = Math.max(0, total - floor);
  return {
    level,
    xp: total,
    into,
    span,
    percent: Math.min(100, Math.round((into / span) * 100)),
    maxed: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mastery
// ─────────────────────────────────────────────────────────────────────────────

/** Crafts of one recipe before its mastery bonus is earned. */
export const MASTERY_THRESHOLD = 10;

/** What mastery is worth: a 10% better roll grade, forever, on that recipe. */
export const MASTERY_BONUS = 0.10;

export function masteryBonusFor(crafted: number): number {
  return crafted >= MASTERY_THRESHOLD ? MASTERY_BONUS : 0;
}

export function masteryProgress(crafted: number): { crafted: number; needed: number; mastered: boolean } {
  const done = Number.isFinite(crafted) ? Math.max(0, Math.floor(crafted)) : 0;
  return {
    crafted: done,
    needed: Math.max(0, MASTERY_THRESHOLD - done),
    mastered: done >= MASTERY_THRESHOLD,
  };
}

/**
 * Wrap an RNG so every grade it produces comes out `bonus` better.
 *
 * `rollItemStatsWithQuality` samples one number per roll key and turns it into
 * a grade with `q = min + r * (max - min)`. Rather than fork that function — and
 * with it the invariant that the stat and the displayed grade come from the same
 * sample — the bias is applied to `r` in the same space the grade lives in:
 * undo the mapping, scale the grade, redo it. The result is exactly "this roll,
 * ten percent better", clamped at the band ceiling so a mastered recipe can hit
 * 100% and never exceed it.
 *
 * `bonus: 0` returns the RNG untouched, so an unmastered craft is bit-identical
 * to an ordinary mint.
 */
export function masteryRng(
  base: () => number,
  bonus: number,
  rarity: ItemRarity,
  voidTouched = false,
): () => number {
  if (!(bonus > 0)) return base;
  const { min, max } = bandFor(rarity, voidTouched);
  const span = max - min;
  if (!(span > 0)) return base;
  return () => {
    const r = base();
    const q = min + r * span;
    const boosted = Math.min(max, q * (1 + bonus));
    return (boosted - min) / span;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persisted state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The saved blob.
 *
 * `crafted` is per-recipe lifetime count and is what mastery is read off, so it
 * is also the discovery record: a recipe with a count has been crafted at least
 * once. There is no separate `discovered` list, because two records of the same
 * fact only have to disagree once — see the Collection Log's header for the
 * same argument made at length.
 */
export interface CraftingState {
  version: typeof CRAFTING_SCHEMA_VERSION;
  xp: number;
  crafted: Record<string, number>;
}

export function emptyCraftingState(): CraftingState {
  return { version: CRAFTING_SCHEMA_VERSION, xp: 0, crafted: {} };
}

export function coerceCraftingState(raw: unknown): CraftingState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyCraftingState();
  const row = raw as Partial<CraftingState>;
  const crafted: Record<string, number> = {};
  if (row.crafted && typeof row.crafted === 'object' && !Array.isArray(row.crafted)) {
    for (const [id, count] of Object.entries(row.crafted as Record<string, unknown>)) {
      // Unknown ids are dropped rather than kept: a recipe that has been retired
      // would otherwise sit in the blob forever, counting toward nothing and
      // riding every cloud write.
      if (!RECIPE_BY_ID.has(id)) continue;
      if (typeof count !== 'number' || !Number.isFinite(count)) continue;
      crafted[id] = Math.max(0, Math.floor(count));
    }
  }
  return {
    version: CRAFTING_SCHEMA_VERSION,
    xp: typeof row.xp === 'number' && Number.isFinite(row.xp) ? Math.max(0, Math.floor(row.xp)) : 0,
    crafted,
  };
}

/**
 * Cloud merge: every number here is a monotone lifetime counter, so the higher
 * of two devices is the true one on all of them. Written out rather than left
 * to the structural rule because `xp` and the per-recipe counts must move
 * together with the same rule — and because a future field that is *not* a
 * counter needs to arrive as a visible edit to this function.
 */
export function mergeCrafting(remote: unknown, local: unknown): CraftingState {
  const a = coerceCraftingState(remote);
  const b = coerceCraftingState(local);
  const crafted: Record<string, number> = { ...a.crafted };
  for (const [id, count] of Object.entries(b.crafted)) {
    crafted[id] = Math.max(crafted[id] ?? 0, count);
  }
  return { version: CRAFTING_SCHEMA_VERSION, xp: Math.max(a.xp, b.xp), crafted };
}

/** The Collection Log id for a recipe. Namespaced so it cannot collide with an item. */
export function recipeCollectionId(recipeId: string): string {
  return `recipe:${recipeId}`;
}
