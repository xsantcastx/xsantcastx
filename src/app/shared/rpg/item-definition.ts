/**
 * item-definition.ts — authored families, roll keys, and mint.
 *
 * Style is a tag on the definition, not a second random system.
 * Materials and quest items never roll. Runes stay on the Forge ledger.
 */
import {
  type GameItem,
  type ItemRarity,
  type ItemStats,
  type ItemType,
  type SlotId,
  sellValueFor,
  slotAccepts,
} from './item.model';
import { ARTBIBLE_DEFINITIONS } from './artbible-items';
import { UNIQUE_DEFINITIONS } from './unique-items';
import {
  bandFor,
  qualityAdjustedSellValue,
  qualityPercent,
  type RollQuality,
} from './item-quality';

export type ItemFamily =
  | 'equipment'
  | 'artifact'
  | 'charm'
  | 'material'
  | 'consumable'
  | 'quest'
  | 'rune';

export type ItemStyle =
  | 'neutral'
  | 'infernal'
  | 'celestial'
  | 'luminous'
  | 'umbral'
  | 'verdant'
  | 'void'
  | 'void-touched';

export type ItemStatKey = keyof ItemStats;

export interface ItemDefinition {
  id: string;
  name: string;
  family: ItemFamily;
  type: ItemType;
  slot?: SlotId;
  style: ItemStyle;
  rollKeys: readonly ItemStatKey[];
  /** Authored midpoint. Rarity multiplies this at mint. */
  base: Partial<ItemStats>;
  temperable: boolean;
  maxTemper: number;
  /** Gold for the first temper. Later levels use 1.65 ** level. */
  temperGoldBase: number;
  lore: string;
  soulbound?: boolean;
}

/**
 * The rarity power ladder, as `[floor, ceiling]` against the authored midpoint.
 *
 * Only the **ceiling** is live: `rollItemStats` multiplies it by a grade sampled
 * from `QUALITY_BAND` (item-quality.ts), so the ceiling is what "100% roll"
 * means at each tier and the floor is now a historical record of the band this
 * table used to sample directly. It is kept because the numbers still document
 * the intended power gap between rungs, and because saves minted under the old
 * scheme were rolled against it.
 */
export const RARITY_MULT: Record<ItemRarity, readonly [number, number]> = {
  common: [0.6, 1.0],
  uncommon: [0.85, 1.15],
  rare: [1.0, 1.35],
  epic: [1.15, 1.55],
  legendary: [1.35, 1.8],
  mythic: [1.6, 2.2],
  singular: [1.9, 2.8],
};

const STYLE_GOLD: Partial<Record<ItemStyle, number>> = {
  infernal: 1.08,
  verdant: 1.04,
};
const STYLE_XP: Partial<Record<ItemStyle, number>> = {
  celestial: 1.08,
  verdant: 1.04,
};
const STYLE_MF: Partial<Record<ItemStyle, number>> = {
  luminous: 1.08,
};
const STYLE_LOOT: Partial<Record<ItemStyle, number>> = {
  umbral: 1.08,
};
const STYLE_WARD: Partial<Record<ItemStyle, number>> = {
  umbral: 1.08,
  'void-touched': 1.08,
};

function styleBias(style: ItemStyle, key: ItemStatKey): number {
  if (key === 'goldPerSec') return STYLE_GOLD[style] ?? 1;
  if (key === 'xpBonus') return STYLE_XP[style] ?? 1;
  if (key === 'magicFind') return STYLE_MF[style] ?? 1;
  if (key === 'lootBonus') return STYLE_LOOT[style] ?? 1;
  if (key === 'ward') return STYLE_WARD[style] ?? 1;
  return 1;
}

function roundStat(key: ItemStatKey, value: number): number {
  if (key === 'goldPerSec') return Math.round(value * 10) / 10;
  return Math.round(value * 10) / 10;
}

/** The best a stat can be at this rarity: authored midpoint × tier ceiling. */
/**
 * What a wearable is worth at the till, before its roll is priced in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EQUIPMENT NEEDS ITS OWN LADDER
 * ─────────────────────────────────────────────────────────────────────────────
 * `sellValueFor` prices every `type: 'artifact'` at zero, because a true
 * artifact is soulbound and unsellable. But `eq()` files *every* wearable as
 * `type: 'artifact'` — that is what makes the paper doll accept it — so the
 * side effect was that no helm, blade or cuirass in the game had a price, and
 * `canSell` (which requires `sellValue > 0`) refused all of them. Equipment was
 * silently unsellable, which nothing surfaced because no sell button was wired.
 *
 * The Gambler needs a till, so equipment gets a ladder of its own here rather
 * than inheriting the rune worths. It has to be its own table because the rune
 * numbers are an order of magnitude larger — a Common rune is worth 5,000 Gold,
 * which is the entire price of an Iron Chest. Reusing them would make the
 * cheapest mystery box strictly profitable to open and scrap on the spot, and a
 * gambling hub that prints money is not a sink, it is a bug with an animation.
 *
 * These numbers are set so every box in `MYSTERY_BOXES` is negative expected
 * value in scrap alone. What the player buys is the *chance*, and the payout is
 * the item — never the Gold it melts down into.
 */
export const EQUIPMENT_SCRAP: Readonly<Record<ItemRarity, number>> = {
  common: 600,
  uncommon: 2_500,
  rare: 12_000,
  epic: 60_000,
  legendary: 300_000,
  mythic: 1_500_000,
  singular: 8_000_000,
};

/** Sticker price for one minted instance, before the roll grade scales it. */
export function stickerPrice(def: ItemDefinition, rarity: ItemRarity): number {
  if (def.soulbound) return 0;
  const byType = sellValueFor(def.type, rarity);
  if (byType > 0) return byType;
  if (def.family === 'equipment' || def.family === 'charm') {
    return EQUIPMENT_SCRAP[rarity] ?? EQUIPMENT_SCRAP.common;
  }
  return 0;
}

export function statCeiling(def: ItemDefinition, rarity: ItemRarity, key: ItemStatKey): number {
  const mid = def.base[key];
  if (mid == null) return 0;
  const ceiling = (RARITY_MULT[rarity] ?? RARITY_MULT.common)[1];
  return mid * ceiling * styleBias(def.style, key);
}

export interface RolledStats {
  stats: ItemStats;
  /** Displayed grade per key, 0..1. See item-quality.ts for the two numbers. */
  quality: RollQuality;
}

/**
 * Roll a stat block and grade it in the same pass.
 *
 * The two outputs come from one sample each and must stay that way: computing
 * the grade afterwards from the rounded stat would disagree with the sample by
 * up to half a rounding step, which is enough to show `100%` on an item that is
 * not maxed and `99%` on one that is.
 */
export function rollItemStatsWithQuality(
  def: ItemDefinition,
  rarity: ItemRarity,
  rng: () => number = Math.random,
): RolledStats {
  if (!def.rollKeys.length) return { stats: {}, quality: {} };
  const voidTouched = def.style === 'void' || def.style === 'void-touched';
  const { min, max } = bandFor(rarity, voidTouched);
  const stats: ItemStats = {};
  const quality: RollQuality = {};
  for (const key of def.rollKeys) {
    const ceiling = statCeiling(def, rarity, key);
    if (!ceiling) continue;
    const q = min + rng() * (max - min);
    stats[key] = roundStat(key, ceiling * q);
    quality[key] = qualityPercent(q, rarity, voidTouched);
  }
  return { stats, quality };
}

/** The stat block alone, for the callers that do not keep the grade. */
export function rollItemStats(
  def: ItemDefinition,
  rarity: ItemRarity,
  rng: () => number = Math.random,
): ItemStats {
  return rollItemStatsWithQuality(def, rarity, rng).stats;
}

export function mintEquipment(
  defId: string,
  rarity: ItemRarity,
  rng: () => number = Math.random,
  foundAt = new Date().toISOString(),
  id?: string,
): GameItem | null {
  const def = itemDefinitionById(defId);
  if (!def) return null;
  if (def.family === 'material' || def.family === 'quest' || def.family === 'rune') return null;
  const rolled = def.rollKeys.length
    ? rollItemStatsWithQuality(def, rarity, rng)
    : { stats: {}, quality: {} };
  const sticker = stickerPrice(def, rarity);
  return {
    id: id ?? mintInstanceId(def.id),
    name: def.name,
    type: def.type,
    rarity,
    stats: rolled.stats,
    rollQuality: rolled.quality,
    // The till pays for the roll, not the name. See item-quality.ts.
    sellValue: qualityAdjustedSellValue(sticker, { rollQuality: rolled.quality }),
    equipped: false,
    lore: def.lore,
    foundAt,
    soulbound: def.soulbound === true,
    upgradeLevel: 0,
    definitionId: def.id,
  };
}

let mintCounter = 0;
function mintInstanceId(prefix: string): string {
  mintCounter = (mintCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${mintCounter.toString(36)}`;
}

function eq(
  id: string,
  name: string,
  slot: SlotId | undefined,
  style: ItemStyle,
  rollKeys: readonly ItemStatKey[],
  base: Partial<ItemStats>,
  lore: string,
): ItemDefinition {
  return {
    id, name, family: 'equipment', type: 'artifact', slot, style, rollKeys, base,
    temperable: true, maxTemper: 10, temperGoldBase: 50_000, lore,
  };
}

const KEEPER_DEFINITIONS: readonly ItemDefinition[] = [
  eq('eclipse-longblade', 'Eclipse Longblade', 'weapon', 'neutral',
    ['goldPerSec', 'strikePower'], { goldPerSec: 0.4, strikePower: 1 },
    'A neutral blade with a violet eclipse seam; it is carried to make a boundary visible before it is crossed.'),
  eq('keeper-staff', 'Keeper Staff', 'weapon', 'neutral',
    ['xpBonus', 'goldPerSec'], { xpBonus: 2, goldPerSec: 0.15 },
    'A grounded conduit for reading unstable runes without claiming they belong to the bearer.'),
  eq('void-buckler', 'Void Buckler', 'off-hand', 'void-touched',
    ['ward', 'magicFind'], { ward: 1, magicFind: 1 },
    'A small shield that turns an incoming possibility aside rather than trying to erase it.'),
  eq('keepers-cowl', "Keeper's Cowl", 'head', 'neutral',
    ['magicFind', 'xpBonus'], { magicFind: 1.5, xpBonus: 1 },
    'A practical mantle hood that protects a witness from spectacle while leaving their actions accountable.'),
  eq('keepers-mantle', "Keeper's Mantle", 'chest', 'neutral',
    ['goldPerSec', 'ward'], { goldPerSec: 0.25, ward: 0.5 },
    'Woven with repairable seams so every field repair remains legible to the next Keeper.'),
  eq('godforge-gauntlets', 'Godforge Gauntlets', 'hands', 'neutral',
    ['strikePower', 'goldPerSec'], { strikePower: 1.2, goldPerSec: 0.1 },
    'Insulated hands for handling fragments whose effects must be felt before they are controlled.'),
  eq('astral-pendant', 'Astral Pendant', 'trinket', 'celestial',
    ['magicFind', 'xpBonus'], { magicFind: 2, xpBonus: 1.5 },
    'A suspended star-metal measure that vibrates when a route\'s stated rule and actual behavior diverge.'),
  eq('anchor-ring', 'Anchor Ring', 'trinket', 'celestial',
    ['ward', 'xpBonus'], { ward: 0.5, xpBonus: 1 },
    'A four-point band used to mark a temporary boundary, never a claim of permanent dominion.'),
  eq('astral-helm', 'Astral Helm', 'head', 'celestial',
    ['xpBonus', 'magicFind'], { xpBonus: 2.5, magicFind: 1 },
    'A Celestial field helm that makes shifting trajectories visible as light across its surface.'),
  eq('infernal-cuirass', 'Infernal Cuirass', 'chest', 'infernal',
    ['goldPerSec', 'ward'], { goldPerSec: 0.45, ward: 0.8 },
    'An iron-black chest piece whose ember seams show where its bearer is carrying heat for someone else.'),
  eq('luminous-greaves', 'Luminous Greaves', 'legs', 'luminous',
    ['magicFind', 'goldPerSec'], { magicFind: 2, goldPerSec: 0.12 },
    'Ivory-and-gold leg armor that leaves a faint trail only when the wearer\'s path can be honestly described.'),
  eq('verdant-bracers', 'Verdant Bracers', 'hands', 'verdant',
    ['xpBonus', 'ward'], { xpBonus: 1.5, ward: 0.4 },
    'Rootwood guards that tighten near invasive growth and loosen near cooperative repair.'),
  {
    id: 'basalt-edge',
    name: 'Basalt Edge',
    family: 'equipment',
    type: 'artifact',
    slot: 'weapon',
    style: 'infernal',
    // strikePower is what the Seamworks' recovery and the Forge's yield read
    // off the weapon slot, and this is the only weapon a Keeper can craft —
    // without it both consumers stayed dead for everyone. Same base as the
    // spec's Eclipse Longblade anchor; goldPerSec stays the primary key.
    rollKeys: ['goldPerSec', 'strikePower'],
    base: { goldPerSec: 2, strikePower: 1 },
    temperable: true,
    maxTemper: 10,
    temperGoldBase: 40_000,
    lore: 'The first edge the Seamworks will admit. Six Cinder Ore and one Ember Residue, struck once into a unique weapon.',
    soulbound: true,
  },
  {
    id: 'obsidian-heart',
    name: 'Obsidian Heart',
    family: 'artifact',
    type: 'artifact',
    style: 'infernal',
    rollKeys: ['goldPerSec'],
    base: { goldPerSec: 12 },
    temperable: true,
    maxTemper: 5,
    temperGoldBase: 120_000,
    lore: 'It was cut from a furnace that had been cold for six hundred years and was still warm in the centre.',
    soulbound: true,
  },
  {
    id: 'mirrorblade-kael',
    name: 'Mirrorblade of Kael',
    family: 'artifact',
    type: 'artifact',
    slot: 'weapon',
    style: 'void',
    rollKeys: ['xpBonus', 'goldPerSec'],
    base: { xpBonus: 15, goldPerSec: 4 },
    temperable: true,
    maxTemper: 5,
    temperGoldBase: 120_000,
    lore: 'Kael carried it into the Verge to cut the two realms apart and came back having only made them symmetrical.',
    soulbound: true,
  },
  {
    id: 'relic-third-dawn',
    name: 'Relic of the Third Dawn',
    family: 'artifact',
    type: 'artifact',
    style: 'luminous',
    rollKeys: ['xpBonus'],
    base: { xpBonus: 12 },
    temperable: true,
    maxTemper: 5,
    temperGoldBase: 150_000,
    lore: 'Two dawns were promised and two dawns came. The third was not promised to anyone.',
    soulbound: true,
  },
  {
    id: 'codex-solarii',
    name: 'Codex Solarii',
    family: 'artifact',
    type: 'artifact',
    style: 'celestial',
    rollKeys: ['xpBonus'],
    base: { xpBonus: 18 },
    temperable: true,
    maxTemper: 4,
    temperGoldBase: 180_000,
    lore: 'The Solarii wrote everything twice: once for the reader they had, and once for the reader who would arrive already knowing.',
    soulbound: true,
  },
  {
    id: 'fragment-first-sun',
    name: 'Fragment of the First Sun',
    family: 'artifact',
    type: 'artifact',
    style: 'luminous',
    rollKeys: ['goldPerSec', 'xpBonus'],
    base: { goldPerSec: 25, xpBonus: 12 },
    temperable: true,
    maxTemper: 3,
    temperGoldBase: 250_000,
    lore: 'There is one. It has been in the hands of four people and none of them wrote down what it was like.',
    soulbound: true,
  },
  {
    id: 'cinder-ore',
    name: 'Cinder Ore',
    family: 'material',
    type: 'artifact',
    style: 'infernal',
    rollKeys: [],
    base: {},
    temperable: false,
    maxTemper: 0,
    temperGoldBase: 0,
    lore: 'Iron-black material carrying live orange seams; heat taken from one place must appear somewhere else.',
  },
  {
    id: 'ember-residue',
    name: 'Ember Residue',
    family: 'material',
    type: 'artifact',
    style: 'infernal',
    rollKeys: [],
    base: {},
    temperable: false,
    maxTemper: 0,
    temperGoldBase: 0,
    lore: 'What the strike leaves when the ore has already given its heat.',
  },
  // ── The two Collector rewards ───────────────────────────────────────────
  // Granted by `CollectionService` when the Collection Log crosses 50% and 75%.
  // Both are painted: the asset library filed them under `items/quest/`, where
  // they had names, lore-shaped art and no game behind them. Nothing else mints
  // either one, which is what makes them exclusive — soulbound, so the till will
  // not take them back, and outside the log's own denominator, because you
  // cannot be asked to collect the prize for collecting.
  {
    id: 'sealed-codex-page',
    name: 'Sealed Codex Page',
    family: 'charm',
    type: 'charm',
    style: 'celestial',
    rollKeys: ['xpBonus', 'magicFind'],
    base: { xpBonus: 6, magicFind: 6 },
    temperable: false,
    maxTemper: 0,
    temperGoldBase: 0,
    lore: 'A page the Archivum sealed rather than burned, which is the Archivum admitting it might be wrong.',
    soulbound: true,
  },
  {
    id: 'keeper-signet',
    name: "Keeper's Signet",
    family: 'equipment',
    type: 'artifact',
    slot: 'trinket',
    style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus', 'goldPerSec'],
    base: { magicFind: 8, xpBonus: 6, goldPerSec: 1.5 },
    temperable: true,
    maxTemper: 5,
    temperGoldBase: 90_000,
    lore: 'A Keeper is issued one signet in a life. This is the second, and the Archivum has no record of who authorised it.',
    soulbound: true,
  },
  {
    id: 'ember-elixir',
    name: 'Ember Elixir',
    family: 'consumable',
    type: 'charm',
    style: 'infernal',
    rollKeys: ['xpBonus'],
    base: { xpBonus: 4 },
    temperable: false,
    maxTemper: 0,
    temperGoldBase: 0,
    lore: 'Lets a bearer endure heat distortion, leaving a visible line where the strain was absorbed.',
  },
];

/**
 * The whole catalogue: the Keeper kit above, the Art Bible, and the named
 * objects.
 *
 * The uniques are spread in rather than kept apart so that every consumer —
 * mint, reforge, temper, the paper doll, the Collection Log — treats a unique as
 * an ordinary definition and needs no branch for it. See unique-items.ts. The
 * Art Bible table is separate for the opposite reason: the Keeper kit above is
 * a balance table that gets retuned and `artbible-items.ts` is a content list
 * that gets added to, and mixing them means every new painting is a diff on the
 * same file as the numbers.
 */
export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  ...KEEPER_DEFINITIONS,
  ...ARTBIBLE_DEFINITIONS,
  ...UNIQUE_DEFINITIONS,
];

const BY_ID = new Map(ITEM_DEFINITIONS.map(def => [def.id, def]));
const BY_NAME = new Map(ITEM_DEFINITIONS.map(def => [def.name, def]));

export function itemDefinitionById(id: string): ItemDefinition | undefined {
  return BY_ID.get(id);
}

/**
 * Whether `item` belongs in `slot`, honouring the definition's intended slot.
 *
 * `slotAccepts` in item.model only checks the item *type*, and every authored
 * equipment piece is `type: 'artifact'` — so by that test a helm "fits" the
 * weapon slot. Legacy/definition-less items keep the type-only rule so nothing
 * that used to equip stops equipping.
 */
export function itemFitsSlot(slot: SlotId, item: Pick<GameItem, 'definitionId' | 'name' | 'type'>): boolean {
  if (!slotAccepts(slot, item as GameItem)) return false;
  const def = definitionFor(item);
  return !def?.slot || def.slot === slot;
}

export function definitionFor(item: Pick<GameItem, 'definitionId' | 'name' | 'type'>): ItemDefinition | undefined {
  if (item.definitionId) return BY_ID.get(item.definitionId);
  return BY_NAME.get(item.name);
}

export function primaryRollKey(def: ItemDefinition): ItemStatKey | null {
  return def.rollKeys[0] ?? null;
}

export function isTemperableItem(item: Pick<GameItem, 'definitionId' | 'name' | 'type'>): boolean {
  const def = definitionFor(item);
  if (def) return def.temperable && def.family !== 'rune' && def.family !== 'material' && def.family !== 'quest';
  return item.type === 'artifact';
}
