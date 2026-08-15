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
} from './item.model';

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

/** Rarity samples uniformly in [lo, hi] against the authored midpoint. */
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

export function rollItemStats(
  def: ItemDefinition,
  rarity: ItemRarity,
  rng: () => number = Math.random,
): ItemStats {
  if (!def.rollKeys.length) return {};
  const [lo, hi] = RARITY_MULT[rarity] ?? RARITY_MULT.common;
  const voidWiden = def.style === 'void' || def.style === 'void-touched' ? 0.1 : 0;
  const low = lo * (1 - voidWiden);
  const high = hi * (1 + voidWiden);
  const stats: ItemStats = {};
  for (const key of def.rollKeys) {
    const mid = def.base[key];
    if (mid == null) continue;
    const mult = low + rng() * (high - low);
    stats[key] = roundStat(key, mid * mult * styleBias(def.style, key));
  }
  return stats;
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
  const rolls = def.rollKeys.length ? rollItemStats(def, rarity, rng) : {};
  return {
    id: id ?? mintInstanceId(def.id),
    name: def.name,
    type: def.type,
    rarity,
    stats: rolls,
    sellValue: def.soulbound ? 0 : sellValueFor(def.type, rarity),
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

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
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
    rollKeys: ['goldPerSec'],
    base: { goldPerSec: 2 },
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

const BY_ID = new Map(ITEM_DEFINITIONS.map(def => [def.id, def]));
const BY_NAME = new Map(ITEM_DEFINITIONS.map(def => [def.name, def]));

export function itemDefinitionById(id: string): ItemDefinition | undefined {
  return BY_ID.get(id);
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
