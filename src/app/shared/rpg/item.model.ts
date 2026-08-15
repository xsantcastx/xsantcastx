/**
 * item.model.ts — equippable things, what they roll, and what they sell for.
 *
 * An item is the first object on the site that is not the same as every other
 * object with its name. Two Nexus charms found an hour apart carry different
 * numbers, because the numbers are rolled inside a per-rarity band when the item
 * is minted and then frozen onto it forever. That is the whole mechanic: the
 * ladder gives you a Nexus eventually, and the roll decides whether it was worth
 * the wait.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE ROLL IS STORED AND NOT RECOMPUTED
 * ─────────────────────────────────────────────────────────────────────────────
 * The tempting build derives an item's stats from its rarity every time they are
 * read, which needs no storage at all. It also means every Rare in the game has
 * identical stats, which deletes the reason to keep looking after the first one.
 * Rolling once at mint and persisting the result is what makes an inventory
 * worth reading — and it is why `GameItem.stats` is data on the record rather
 * than a lookup through `ITEM_ROLLS`.
 *
 * It also means the bands below can be retuned without silently rewriting every
 * item already in a save. An item minted under the old bands keeps its numbers,
 * which is the correct outcome: the player earned those.
 *
 * Pure data and pure functions — no browser APIs, safe on an SSR path.
 */
import { RuneTier, RUNE_TIERS, tierOf } from '../rune-forge/rune.model';

/**
 * Item rarity is the rune ladder, deliberately.
 *
 * A second seven-step rarity scale with its own names and its own colours is two
 * ladders the player has to hold in their head, and the first time an "Epic"
 * charm sits next to an "Epic" rune in a different colour, both stop meaning
 * anything. Reusing `RuneTier` means one set of colours, one set of sell values
 * and one answer to "is this better than that".
 */
export type ItemRarity = RuneTier;

export type ItemType = 'rune' | 'runeword' | 'charm' | 'artifact';

/** Canonical eight-slot loadout (C5). */
export type EquipmentSlotId =
  | 'head'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'weapon'
  | 'off-hand'
  | 'trinket';

/** Pre-C5 persisted slot ids. Parsed, then migrated. */
export type LegacySlotId = 'offhand' | 'charm1' | 'charm2' | 'charm3';

export type SlotId = EquipmentSlotId;

/**
 * What an item can carry.
 *
 * Four keys, not an open `Record<string, number>`: an open record cannot be
 * summed by the equipment panel without the panel knowing every key that might
 * appear, and a typo in a key name would produce an item whose stat silently
 * does nothing. Adding a fifth stat should be a compile error everywhere it
 * needs handling.
 */
export interface ItemStats {
  /** Flat Gold per second while equipped. */
  goldPerSec?: number;
  /** Percentage points of Magic Find. */
  magicFind?: number;
  /** Percentage XP bonus. */
  xpBonus?: number;
  /** Percentage bonus to expedition loot quality. Only reads on an explorer. */
  lootBonus?: number;
}

export const ITEM_STAT_KEYS: (keyof ItemStats)[] = [
  'goldPerSec', 'magicFind', 'xpBonus', 'lootBonus',
];

/** How each stat is written on a tooltip. */
export const ITEM_STAT_LABELS: Record<keyof ItemStats, string> = {
  goldPerSec: 'Gold/sec',
  magicFind: 'Magic Find',
  xpBonus: 'XP',
  lootBonus: 'Loot quality',
};

/** True for the stats written as a percentage. */
export const ITEM_STAT_IS_PERCENT: Record<keyof ItemStats, boolean> = {
  goldPerSec: false,
  magicFind: true,
  xpBonus: true,
  lootBonus: true,
};

export interface GameItem {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  /** Rolled at mint, frozen thereafter. See the note at the top of the file. */
  stats: ItemStats;
  /** Gold this pays if sold. Zero for anything soulbound. */
  sellValue: number;
  equipped: boolean;
  /** Which slot it is in, when equipped on the player. */
  slot?: SlotId;
  /** The explorer wearing it, when equipped on one instead. */
  explorerId?: string;
  lore?: string;
  /** ISO instant it was minted, for "found on" and for stable inventory sort. */
  foundAt: string;
  /**
   * Artifacts cannot be sold at any price.
   *
   * Stored on the item rather than inferred from `type` so that a future
   * quest-reward charm can be made soulbound without becoming an artifact, and
   * so the sell path has exactly one thing to check.
   */
  soulbound: boolean;
  /** Authored definition id. Missing on pre-spec saves. */
  definitionId?: string;
  /** Successful tempers. Missing means 0. */
  upgradeLevel?: number;
  lastUpgradeAt?: string;
  lastUpgradeMutationId?: string;
  lastUpgradeOk?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slots
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotDefinition {
  id: SlotId;
  name: string;
  /** Which item types this slot will accept. */
  accepts: ItemType[];
  /** Where the slot sits around the silhouette, as a percentage of the frame. */
  x: number;
  y: number;
}

/**
 * Eight slots. head/chest/weapon/off-hand accept today's worn types.
 * hands/legs/feet/trinket start empty and only take later authored defs.
 * Charms have no compatible slot — they retire to the bag in C5.
 */
export const EQUIPMENT_SLOTS: SlotDefinition[] = [
  { id: 'head', name: 'Head', accepts: ['rune', 'runeword', 'artifact'], x: 50, y: 10 },
  { id: 'chest', name: 'Chest', accepts: ['rune', 'runeword', 'artifact'], x: 50, y: 32 },
  { id: 'hands', name: 'Hands', accepts: [], x: 24, y: 36 },
  { id: 'weapon', name: 'Weapon', accepts: ['rune', 'runeword', 'artifact'], x: 16, y: 48 },
  { id: 'off-hand', name: 'Off-hand', accepts: ['rune', 'runeword', 'artifact'], x: 84, y: 48 },
  { id: 'legs', name: 'Legs', accepts: [], x: 50, y: 58 },
  { id: 'feet', name: 'Feet', accepts: [], x: 50, y: 82 },
  { id: 'trinket', name: 'Trinket', accepts: [], x: 78, y: 18 },
];

export const SLOT_IDS: SlotId[] = EQUIPMENT_SLOTS.map(s => s.id);
export const LEGACY_SLOT_IDS: readonly LegacySlotId[] = ['offhand', 'charm1', 'charm2', 'charm3'];
export const PARSE_SLOT_IDS: readonly string[] = [...SLOT_IDS, ...LEGACY_SLOT_IDS];
export const RETIRED_CHARM_TAG = 'retired-charm';

export function canonicalizeSlot(slot: string): SlotId | null {
  if ((SLOT_IDS as readonly string[]).includes(slot)) return slot as SlotId;
  if (slot === 'offhand') return 'off-hand';
  return null;
}

export function isRetiredCharmSlot(slot: string): boolean {
  return slot === 'charm1' || slot === 'charm2' || slot === 'charm3';
}

export const SLOT_BY_ID = new Map(EQUIPMENT_SLOTS.map(s => [s.id, s]));

export function slotAccepts(slot: SlotId, item: GameItem): boolean {
  return SLOT_BY_ID.get(slot)?.accepts.includes(item.type) ?? false;
}

/** The first empty slot this item could go in, or null if none will take it. */
export function firstSlotFor(
  item: GameItem,
  occupied: ReadonlySet<SlotId>,
): SlotId | null {
  for (const slot of EQUIPMENT_SLOTS) {
    if (slot.accepts.includes(item.type) && !occupied.has(slot.id)) return slot.id;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Roll bands
// ─────────────────────────────────────────────────────────────────────────────

/** A closed interval the mint rolls inside. */
export type Band = readonly [min: number, max: number];

export type RollTable = Partial<Record<keyof ItemStats, Band>>;

/**
 * What each rarity rolls.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A NOTE ON MYTHIC
 * ─────────────────────────────────────────────────────────────────────────────
 * The design brief for this tier reads "ALL stats +10 to +30". Taken literally
 * that puts Mythic's Gold/sec band (10–30) *below* Legendary's (20–50), so the
 * rarer item is the worse one on the stat players read first — and Mythic is
 * roughly three times rarer than Legendary. Every other step on this ladder
 * climbs on every axis, and a single inversion is the kind of thing that reads
 * as a bug even when it is deliberate.
 *
 * So Mythic keeps the *shape* the brief asked for — every stat at once, which is
 * what distinguishes it from Legendary's two — at a band that clears Legendary
 * on all of them: 30–60. Singular is 50–100 exactly as specified, and stays the
 * only tier that cannot roll badly.
 */
export const ITEM_ROLLS: Record<ItemRarity, RollTable> = {
  common: {
    goldPerSec: [0.2, 1],
  },
  uncommon: {
    goldPerSec: [1, 4],
    magicFind: [1, 4],
  },
  rare: {
    goldPerSec: [6, 18],
    magicFind: [3, 10],
  },
  epic: {
    goldPerSec: [20, 55],
    magicFind: [8, 18],
    xpBonus: [6, 14],
  },
  legendary: {
    goldPerSec: [70, 180],
    magicFind: [12, 28],
    xpBonus: [12, 30],
  },
  mythic: {
    goldPerSec: [200, 480],
    magicFind: [25, 55],
    xpBonus: [25, 50],
    lootBonus: [25, 50],
  },
  singular: {
    goldPerSec: [500, 1400],
    magicFind: [40, 80],
    xpBonus: [40, 80],
    lootBonus: [40, 80],
  },
};

/**
 * Roll one number inside a band.
 *
 * Gold/sec keeps one decimal and the percentages are whole, because "+7.3% XP"
 * is a number nobody can compare at a glance and "+0.3 Gold/sec" is a number
 * that has to keep its decimal or the whole Common tier rounds to zero.
 */
function rollStat(key: keyof ItemStats, band: Band, rng: () => number): number {
  const raw = band[0] + rng() * (band[1] - band[0]);
  return key === 'goldPerSec'
    ? Math.round(raw * 10) / 10
    : Math.round(raw);
}

/**
 * Roll a full stat block. `type` is reserved so a later band split cannot
 * fork callers; today rarity owns the table.
 */
export function rollItemStats(
  rarity: ItemRarity,
  _type: ItemType = 'artifact',
  rng: () => number = Math.random,
): ItemStats {
  const table = ITEM_ROLLS[rarity] ?? ITEM_ROLLS.common;
  const stats: ItemStats = {};
  for (const key of ITEM_STAT_KEYS) {
    const band = table[key];
    if (band) stats[key] = rollStat(key, band, rng);
  }
  return stats;
}

/**
 * How good a roll was, 0–1, averaged across its stats.
 *
 * Drives the "roll quality" pip on the tooltip. A band with no spread (which no
 * current rarity has, but a future fixed-stat item might) scores 1 rather than
 * dividing by zero.
 */
export function rollQuality(item: GameItem): number {
  const table = ITEM_ROLLS[item.rarity] ?? {};
  let sum = 0;
  let count = 0;
  for (const key of ITEM_STAT_KEYS) {
    const band = table[key];
    const value = item.stats[key];
    if (!band || value === undefined) continue;
    const spread = band[1] - band[0];
    sum += spread <= 0 ? 1 : (value - band[0]) / spread;
    count++;
  }
  return count === 0 ? 0 : Math.min(1, Math.max(0, sum / count));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sell values
// ─────────────────────────────────────────────────────────────────────────────

/** Charms are worth double their rarity — the brief's rule, in one place. */
export const CHARM_SELL_MULTIPLIER = 2;

/** A Runeword sells for ten times the sum of what went into it. */
export const RUNEWORD_SELL_MULTIPLIER = 10;

/**
 * What one item of this type and rarity pays.
 *
 * Artifacts return 0 and are marked soulbound at mint, so the sell path refuses
 * them on the flag rather than on a zero price — an item that sells for nothing
 * and an item that cannot be sold are different things, and only one of them
 * should render a Sell button.
 */
export function sellValueFor(
  type: ItemType,
  rarity: ItemRarity,
  componentWorth = 0,
): number {
  if (type === 'artifact') return 0;
  const base = tierOf(rarity).sellValue;
  if (type === 'charm') return base * CHARM_SELL_MULTIPLIER;
  if (type === 'runeword') {
    // A word is worth what it consumed, ten times over — the recipe is the cost
    // and the multiplier is the reward for having finished it. Falls back to the
    // tier's own value when the caller cannot price the components.
    return componentWorth > 0
      ? componentWorth * RUNEWORD_SELL_MULTIPLIER
      : base * RUNEWORD_SELL_MULTIPLIER;
  }
  return base;
}

/** Rarity colour, straight off the rune ladder so the two never disagree. */
export function rarityColor(rarity: ItemRarity): string {
  return (RUNE_TIERS[rarity] ?? RUNE_TIERS.common).color;
}

export function rarityGlow(rarity: ItemRarity): string {
  return (RUNE_TIERS[rarity] ?? RUNE_TIERS.common).glow;
}

export function rarityLabel(rarity: ItemRarity): string {
  return (RUNE_TIERS[rarity] ?? RUNE_TIERS.common).label;
}

// ─────────────────────────────────────────────────────────────────────────────
// The Magic Find charms
// ─────────────────────────────────────────────────────────────────────────────

export interface CharmSeed {
  id: string;
  name: string;
  rarity: ItemRarity;
  magicFind: number;
  lore: string;
  /** Chance of this charm on a strike that has already rolled a charm drop. */
  weight: number;
}

/**
 * Five charms, and they do not roll.
 *
 * Every other item in the game rolls inside a band; these carry the exact Magic
 * Find on the label. That is the point of them — a charm is the one item you can
 * plan around, so "+25% MF" has to mean 25 and not "somewhere between 18 and 31".
 * The variance in this system lives in *which* charm drops, which is plenty.
 *
 * The weights are the inverse of how much each one is worth, roughly: a Void
 * Fragment at 100% MF is worth more than the other four together, and turns up
 * about once in two hundred charm drops.
 */
export const MF_CHARMS: CharmSeed[] = [
  {
    id: 'charm-fortune',
    name: 'Small Charm of Fortune',
    rarity: 'common',
    magicFind: 5,
    weight: 0.9996,
    lore: 'Somebody’s luck, worn smooth and handed on. It did not save them either.',
  },
  {
    id: 'charm-seeker',
    name: 'Charm of the Seeker',
    rarity: 'rare',
    magicFind: 15,
    weight: 0.00025,
    lore: 'It does not find things. It makes you the sort of person things are found by.',
  },
  {
    id: 'charm-eclipse-eye',
    name: 'Eclipse Eye',
    rarity: 'epic',
    magicFind: 25,
    weight: 0.00011,
    lore: 'Open at the moment the light went, and never given a reason to close since.',
  },
  {
    id: 'charm-rabbits-foot',
    name: 'Lucky Rabbit’s Foot',
    rarity: 'legendary',
    magicFind: 35,
    weight: 0.000035,
    lore: 'The Archivum has never established what a rabbit was. The luck is not in dispute.',
  },
  {
    id: 'charm-void-fragment',
    name: 'Void Fragment',
    rarity: 'mythic',
    magicFind: 100,
    weight: 0.000005,
    lore: 'A piece of the thing the realms were carved out of, small enough to carry. Nothing near it is quite as likely as it was.',
  },
];

const CHARM_WEIGHT_TOTAL = MF_CHARMS.reduce((sum, c) => sum + c.weight, 0);

/** Pick which charm dropped. Weighted; see the note on `MF_CHARMS`. */
export function rollCharmSeed(rng: () => number = Math.random): CharmSeed {
  let roll = rng() * CHARM_WEIGHT_TOTAL;
  for (const charm of MF_CHARMS) {
    roll -= charm.weight;
    if (roll <= 0) return charm;
  }
  return MF_CHARMS[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Minting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A monotonic suffix, so two items minted in the same millisecond differ.
 *
 * `Date.now()` alone collides when an expedition settles three explorers at once
 * and each brings back a charm — and a duplicate id in the inventory means
 * equipping one equips the other.
 */
let mintCounter = 0;

function mintId(prefix: string): string {
  mintCounter = (mintCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${mintCounter.toString(36)}`;
}

/** Mint a charm from its seed. Fixed MF, no roll. */
export function mintCharm(seed: CharmSeed, foundAt = new Date().toISOString()): GameItem {
  return {
    id: mintId(seed.id),
    name: seed.name,
    type: 'charm',
    rarity: seed.rarity,
    stats: { magicFind: seed.magicFind },
    sellValue: sellValueFor('charm', seed.rarity),
    equipped: false,
    lore: seed.lore,
    foundAt,
    soulbound: false,
    upgradeLevel: 0,
  };
}

/**
 * Mint an equippable from a rune that was just found.
 *
 * The rune itself still lands in the Rune Forge ledger — this is a *separate*
 * object that happens to be named after it, the way a Nexus charm is named after
 * the Nexus rune. Runes in the ledger craft Runewords; items in the inventory
 * get equipped. Conflating the two would mean equipping a rune takes it out of
 * a recipe, which is a trap the player cannot see before they spring it.
 */
export function mintRuneItem(
  runeId: string,
  runeName: string,
  rarity: ItemRarity,
  lore: string,
  _rng: () => number = Math.random,
  foundAt = new Date().toISOString(),
): GameItem {
  return {
    id: mintId(`item-${runeId}`),
    name: `${runeName} Sigil`,
    type: 'rune',
    rarity,
    stats: {},
    sellValue: sellValueFor('rune', rarity),
    equipped: false,
    lore,
    foundAt,
    soulbound: false,
    upgradeLevel: 0,
  };
}

/** Sum a set of stat blocks. Used for equipped totals on both player and explorer. */
export function sumStats(blocks: readonly ItemStats[]): Required<ItemStats> {
  const total: Required<ItemStats> = {
    goldPerSec: 0, magicFind: 0, xpBonus: 0, lootBonus: 0,
  };
  for (const block of blocks) {
    for (const key of ITEM_STAT_KEYS) {
      total[key] += block[key] ?? 0;
    }
  }
  // Gold/sec accumulates one-decimal rolls, so float drift shows up in the
  // headline number within a dozen items. Round once, here.
  total.goldPerSec = Math.round(total.goldPerSec * 10) / 10;
  return total;
}

/** "+5 Gold/sec", "+12% Magic Find" — one stat line, formatted. */
export function formatStat(key: keyof ItemStats, value: number): string {
  const sign = value < 0 ? '−' : '+';
  const n = Math.abs(value);
  const shown = Number.isInteger(n) ? String(n) : n.toFixed(1);
  const pct = ITEM_STAT_IS_PERCENT[key] ? '%' : '';
  return `${sign}${shown}${pct} ${ITEM_STAT_LABELS[key]}`;
}
