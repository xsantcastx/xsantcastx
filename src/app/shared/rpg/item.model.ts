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
 * than a lookup through a rarity table.
 *
 * It also means the bands below can be retuned without silently rewriting every
 * item already in a save. An item minted under the old bands keeps its numbers,
 * which is the correct outcome: the player earned those.
 *
 * Pure data and pure functions — no browser APIs, safe on an SSR path.
 */
import { RuneTier, RUNE_TIERS, tierOf } from '../rune-forge/rune.model';
import { QUALITY_BAND, qualityAdjustedSellValue } from './item-quality';

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

/**
 * The loadout: eight gear wells, plus three charm wells.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY charm1-3 ARE THE OLD IDS, DELIBERATELY
 * ─────────────────────────────────────────────────────────────────────────────
 * These three are not new names. They are the *pre-C5* slot ids, which C5
 * retired: `parseLocation` mapped them to the bag and `retireCharms` tagged
 * every charm so it could not be worn. Reviving the same ids rather than
 * minting `charm-a/b/c` means a save written before C5 — one that still has
 * `{"kind":"equipped","slotId":"charm2"}` on a Void Fragment — puts that charm
 * back on the player the moment it loads, instead of leaving it in the bag with
 * a tag explaining that its slot no longer exists.
 *
 * That is the whole reason the ids were never reused for anything else.
 */
export type EquipmentSlotId =
  | 'head'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'weapon'
  | 'off-hand'
  | 'trinket'
  | 'charm1'
  | 'charm2'
  | 'charm3';

/** The charm wells, in the order they are drawn. */
export const CHARM_SLOT_IDS = ['charm1', 'charm2', 'charm3'] as const;
export type CharmSlotId = typeof CHARM_SLOT_IDS[number];

export function isCharmSlot(slot: string): slot is CharmSlotId {
  return (CHARM_SLOT_IDS as readonly string[]).includes(slot);
}

/**
 * Pre-C5 persisted slot ids that still need migrating.
 *
 * `charm1`-`charm3` used to be here. They are real slots again, so they are
 * parsed rather than migrated, and only `offhand` remains — a spelling, not a
 * retirement.
 */
export type LegacySlotId = 'offhand';

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
  /**
   * RETIRED forge income (flat Gold per second while equipped). The forge no longer pays by the second (economy-curve
   * IDLE_INCOME), so nothing mints or rolls this any more; items minted before still carry it and keep loading, and
   * `legacyGoldFind` reads it as Gold Find (the tooltip and `sumStats` both do), so the old line still means something.
   */
  goldPerSec?: number;
  /**
   * Gold Find: percent more Gold from every pile picked up off the hunt (D2's "extra gold from monsters"). Added up
   * with Forge Power and the Gold runes, capped at `GOLD_FIND_CAP`, applied in `EconomyService.earnHuntGold`.
   */
  goldFind?: number;
  /** Percentage points of Magic Find. */
  magicFind?: number;
  /** Percentage XP bonus. */
  xpBonus?: number;
  /**
   * Anvil / forge power. Two consumers, both off the worn total or the weapon:
   * the Forge's yield (`rune-forge/strike-value.ts`, 2.5%/pt chance of a
   * second rune per strike, capped 25%) and the Seamworks' recovery
   * (`activity/mining-recovery.ts`, 2%/pt shorter cooldown, weapon slot only).
   */
  strikePower?: number;
  /**
   * Mitigation. The worn total turns a share of the temper fail chance aside
   * (`rpg/item-upgrade.ts`, 10%/pt of the fail chance, capped 30%). Combat,
   * when it exists, is the second consumer.
   */
  ward?: number;
  // ── The combat affixes (docs/design/loot-and-combat.md §3) ───────────────
  // Rolled at mint from the slot's pool (item-affixes.ts) and read by the
  // top-down fight through `equippedTotals` (td-engine setKeeperBuild).
  /** Flat max life. */
  life?: number;
  /** Flat max mana. */
  mana?: number;
  /** Armour: a blow is cut by Defense ÷ (Defense + 40 + 6×level). */
  defense?: number;
  /** % more damage on every spell and the staff bolt (worn cap 150). */
  spellDamage?: number;
  /** % shorter spell cooldowns and bolt interval (worn cap 40). */
  castSpeed?: number;
  /** % faster on foot — feet only (cap 40 with Agility). */
  moveSpeed?: number;
  /** % chance a hit crits ×1.75 (worn cap 40). */
  critChance?: number;
  /** Life back each second. */
  lifeRegen?: number;
  /** Mana back each second. */
  manaRegen?: number;
  // ── Resists (§6): % off that element's blows; each worn total capped at 75 ─
  /** % less fire damage taken. */
  fireResist?: number;
  /** % less cold damage taken. */
  coldResist?: number;
  /** % less lightning damage taken. */
  lightningResist?: number;
  /** % less arcane damage taken. */
  arcaneResist?: number;
  /** % added to all four resists (trinkets). */
  allResist?: number;
}

export const ITEM_STAT_KEYS: (keyof ItemStats)[] = [
  'goldPerSec', 'goldFind', 'magicFind', 'xpBonus', 'strikePower', 'ward',
  'life', 'mana', 'defense', 'spellDamage', 'castSpeed', 'moveSpeed', 'critChance', 'lifeRegen', 'manaRegen',
  'fireResist', 'coldResist', 'lightningResist', 'arcaneResist', 'allResist',
];

/** The five stats that predate the combat affixes (Gold Find took the retired Gold/sec's place). */
export type LegacyStatKey = 'goldFind' | 'magicFind' | 'xpBonus' | 'strikePower' | 'ward';
export const LEGACY_STAT_KEYS: readonly LegacyStatKey[] = [
  'goldFind', 'magicFind', 'xpBonus', 'strikePower', 'ward',
];

/**
 * What a retired `goldPerSec` roll is worth as Gold Find, in percent: 8 × ln(1 + n), to a tenth. The old values spanned
 * 0.2 (Common) to 1,400 (Singular) on a log-ish ladder, so a log maps them to about 2% … 58% without ever recomputing
 * or rewriting the stored roll (the roll's frozen grade stays true).
 */
export function legacyGoldFind(goldPerSec: number | undefined): number {
  if (!(typeof goldPerSec === 'number') || !(goldPerSec > 0)) return 0;
  return Math.round(8 * Math.log(1 + goldPerSec) * 10) / 10;
}

/** How each stat is written on a tooltip. */
export const ITEM_STAT_LABELS: Record<keyof ItemStats, string> = {
  goldPerSec: 'Gold Find',
  goldFind: 'Gold Find',
  magicFind: 'Magic Find',
  xpBonus: 'XP',
  strikePower: 'Strike',
  ward: 'Ward',
  life: 'Life',
  mana: 'Mana',
  defense: 'Defense',
  spellDamage: 'Spell Damage',
  castSpeed: 'Cast Speed',
  moveSpeed: 'Movement Speed',
  critChance: 'Critical Chance',
  lifeRegen: 'Life Regen',
  manaRegen: 'Mana Regen',
  fireResist: 'Fire Resist',
  coldResist: 'Cold Resist',
  lightningResist: 'Lightning Resist',
  arcaneResist: 'Arcane Resist',
  allResist: 'All Resist',
};

/** True for the stats written as a percentage. */
export const ITEM_STAT_IS_PERCENT: Record<keyof ItemStats, boolean> = {
  goldPerSec: true,
  goldFind: true,
  magicFind: true,
  xpBonus: true,
  strikePower: false,
  ward: false,
  life: false,
  mana: false,
  defense: false,
  spellDamage: true,
  castSpeed: true,
  moveSpeed: true,
  critChance: true,
  lifeRegen: false,
  manaRegen: false,
  fireResist: true,
  coldResist: true,
  lightningResist: true,
  arcaneResist: true,
  allResist: true,
};

/**
 * Just the number: signed, suffixed, compacted — no label.
 *
 * Split out of `formatItemMod` for the Reforge panel, whose before/after rows
 * already carry the stat name in their own column; the composed line would
 * have printed "Gold Find  Gold Find +6%".
 */
export function formatStatValue(key: keyof ItemStats, value: number): string {
  const sign = value >= 0 ? '+' : '';
  const suffix = ITEM_STAT_IS_PERCENT[key] ? '%' : '';
  const shown = key === 'goldPerSec' ? String(legacyGoldFind(value)) : String(value);
  return `${sign}${shown}${suffix}`;
}

/** Diablo-style mod line: `Gold Find +12%`. */
export function formatItemMod(key: keyof ItemStats, value: number): string {
  return `${ITEM_STAT_LABELS[key]} ${formatStatValue(key, value)}`;
}

export interface GameItem {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  /** Rolled at mint, frozen thereafter. See the note at the top of the file. */
  stats: ItemStats;
  /**
   * Per-stat roll grade, 0..1, where 1 is the best that stat can roll at this
   * item's rarity. Written once at mint beside `stats`, rewritten by a reforge,
   * and never touched by temper — see item-quality.ts for why the grade has to
   * describe the base roll rather than the current numbers.
   *
   * Absent on every item minted before the grade existed. Ungraded is a real
   * state that the UI renders as "—", not a zero: back-filling it would mean
   * inventing a percentage that cannot be recovered from a tempered instance.
   */
  rollQuality?: Partial<Record<keyof ItemStats, number>>;
  /**
   * Where it dropped: the monster's level (or the shop / Forge's own). Sets the
   * affix ranges (item-affixes.ts). Absent on items minted before affixes.
   */
  itemLevel?: number;
  /** Gold this pays if sold. Zero for anything soulbound. */
  sellValue: number;
  /**
   * Economy version `sellValue` is written in. Absent (or < 3) means v2 Gold,
   * which the parser scales by ρ exactly once and then stamps 3 — a per-record
   * marker, so a merge that picks either copy of a record stays consistent.
   */
  econ?: number;
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
  /**
   * Reforges resolved (item-reforge.ts). Missing means 0. Kept as a count
   * rather than a flag because it is the only trace a rerolled item carries —
   * rarity, definition and upgradeLevel all survive a reforge unchanged, so
   * without this there is no way to tell a perfect natural roll from one the
   * Keeper bought six times over.
   */
  reforgeCount?: number;
  lastReforgeAt?: string;
  lastReforgeMutationId?: string;
  /** Which stat was held on the last reroll, if the Keeper paid to lock one. */
  lastReforgeLock?: keyof ItemStats;
  /**
   * Runes set into this item's sockets, in well order. `null` is an empty well.
   *
   * The *contents* only. How many wells the item has is derived from its slot
   * and its rarity by `enchanting/socket.model.ts` and is deliberately not
   * stored — see that file's header for why. Absent on every item minted before
   * sockets existed, which reads as "every well empty" rather than as "no
   * wells": an eighteen-release-old Legendary sword has three sockets the first
   * time the Enchanting Table looks at it.
   */
  sockets?: (string | null)[];
  /**
   * A cursed grave-good (shared/grave-goods): the curse it carries, its bonus and its cost frozen at the drop, and
   * whether Sexton Wren laid it to rest. Absent on every ordinary item.
   */
  curse?: GraveCurse;
  /** A whispering item (shared/grave-goods): whose voice, kills made with it worn, and whether the Archivist silenced it. */
  whisper?: GraveWhisper;
}

/** The saved shape of a curse (grave-goods.model.ts owns the ids and the rules). */
export interface GraveCurse { id: string; bonus: number; cost: number; cleansed?: boolean }
/** The saved shape of a whisper (grave-goods.model.ts). */
export interface GraveWhisper { id: string; kills: number; silenced?: boolean }

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
 * Eight gear slots (feet takes boots like any other artifact slot).
 * Charms have no compatible slot — they retire to the bag in C5.
 */
export const EQUIPMENT_SLOTS: SlotDefinition[] = [
  { id: 'head', name: 'Head', accepts: ['rune', 'runeword', 'artifact'], x: 50, y: 10 },
  { id: 'chest', name: 'Chest', accepts: ['rune', 'runeword', 'artifact'], x: 50, y: 32 },
  { id: 'hands', name: 'Hands', accepts: ['artifact'], x: 24, y: 36 },
  { id: 'weapon', name: 'Weapon', accepts: ['rune', 'runeword', 'artifact'], x: 16, y: 48 },
  { id: 'off-hand', name: 'Off-hand', accepts: ['rune', 'runeword', 'artifact'], x: 84, y: 48 },
  { id: 'legs', name: 'Legs', accepts: ['artifact'], x: 50, y: 58 },
  { id: 'feet', name: 'Feet', accepts: ['artifact'], x: 50, y: 82 },
  { id: 'trinket', name: 'Trinket', accepts: ['artifact'], x: 78, y: 18 },
  // The charm wells accept charms and *only* charms, which is the point of
  // giving them their own row: a rune sigil cannot be parked in one to claim a
  // ninth gear slot, and a charm cannot squat in the head well.
  { id: 'charm1', name: 'Charm I', accepts: ['charm'], x: 34, y: 96 },
  { id: 'charm2', name: 'Charm II', accepts: ['charm'], x: 50, y: 96 },
  { id: 'charm3', name: 'Charm III', accepts: ['charm'], x: 66, y: 96 },
];

/** The eight gear wells, without the charm row. What the paper doll draws. */
export const GEAR_SLOTS: SlotDefinition[] = EQUIPMENT_SLOTS.filter(s => !isCharmSlot(s.id));

export const SLOT_IDS: SlotId[] = EQUIPMENT_SLOTS.map(s => s.id);
export const LEGACY_SLOT_IDS: readonly LegacySlotId[] = ['offhand'];
export const PARSE_SLOT_IDS: readonly string[] = [...SLOT_IDS, ...LEGACY_SLOT_IDS];
/**
 * The tag C5 stamped on every charm when it took the slots away.
 *
 * Kept, and now only ever *removed* — see `restoreCharms`. Every save written
 * between C5 and this release carries it on every charm the player owns, and a
 * tag that says "cannot be worn" sitting on an item the panel will happily
 * equip is the kind of contradiction that outlives the person who remembers
 * why. `unretireCharm` strips it on load; nothing writes it any more.
 */
export const RETIRED_CHARM_TAG = 'retired-charm';

export function canonicalizeSlot(slot: string): SlotId | null {
  if ((SLOT_IDS as readonly string[]).includes(slot)) return slot as SlotId;
  if (slot === 'offhand') return 'off-hand';
  return null;
}

export const SLOT_BY_ID = new Map(EQUIPMENT_SLOTS.map(s => [s.id, s]));

export function slotAccepts(slot: SlotId, item: GameItem): boolean {
  return SLOT_BY_ID.get(slot)?.accepts.includes(item.type) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Roll bands
// ─────────────────────────────────────────────────────────────────────────────

/** A closed interval the mint rolls inside. */
export type Band = readonly [min: number, max: number];

export type RollTable = Partial<Record<keyof ItemStats, Band>>;

/**
 * Legacy rarity bands. Mint no longer reads this table.
 *
 * Equipment rolls go through `item-definition.rollItemStats` at
 * `mintEquipment`. Charms stay fixed-MF in `mintCharm`. Runes mint empty.
 * These bands remain only so `rollQuality` can score definition-less saves.
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
  },
  singular: {
    goldPerSec: [500, 1400],
    magicFind: [40, 80],
    xpBonus: [40, 80],
  },
};

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
  /**
   * What the charm gives, as a whole stat block.
   *
   * This was a bare `magicFind: number` while Magic Find was the only thing a
   * charm could carry. Three charm wells make that a non-choice — you wear your
   * three highest and there is nothing to decide — so a charm now names its own
   * stat, and the three families below let a loadout be built for finding
   * things, for earning, or for levelling.
   */
  stats: ItemStats;
  lore: string;
  /** Chance of this charm on a strike that has already rolled a charm drop. */
  weight: number;
}

/** Which build a charm serves. Groups the table and nothing else. */
export type CharmFamily = 'find' | 'fortune' | 'insight';

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
    stats: { magicFind: 5 },
    weight: 0.9996,
    lore: 'Somebody’s luck, worn smooth and handed on. It did not save them either.',
  },
  {
    id: 'charm-seeker',
    name: 'Charm of the Seeker',
    rarity: 'rare',
    stats: { magicFind: 15 },
    weight: 0.00025,
    lore: 'It does not find things. It makes you the sort of person things are found by.',
  },
  {
    id: 'charm-eclipse-eye',
    name: 'Eclipse Eye',
    rarity: 'epic',
    stats: { magicFind: 25 },
    weight: 0.00011,
    lore: 'Open at the moment the light went, and never given a reason to close since.',
  },
  {
    id: 'charm-rabbits-foot',
    name: 'Lucky Rabbit’s Foot',
    rarity: 'legendary',
    stats: { magicFind: 35 },
    weight: 0.000035,
    lore: 'The Archivum has never established what a rabbit was. The luck is not in dispute.',
  },
  {
    id: 'charm-void-fragment',
    name: 'Void Fragment',
    rarity: 'mythic',
    stats: { magicFind: 100 },
    weight: 0.000005,
    lore: 'A piece of the thing the realms were carved out of, small enough to carry. Nothing near it is quite as likely as it was.',
  },
];

/**
 * Gold charms. The same ladder, paying Gold Find (percent on every pile the hunt drops, capped at GOLD_FIND_CAP across
 * everything worn). They used to pay the forge's flat Gold per second, which the forge no longer makes (IDLE_INCOME);
 * a charm minted then keeps its stored roll and reads as Gold Find (`legacyGoldFind`).
 *
 * The numbers sit below the Magic Find charms' (5 … 100) at every rung, because Gold Find is a straight multiplier on
 * the hunt's income while Magic Find only changes what falls.
 */
export const GOLD_CHARMS: CharmSeed[] = [
  {
    id: 'charm-copper-knot',
    name: 'Copper Knot',
    rarity: 'common',
    stats: { goldFind: 4 },
    weight: 0.9996,
    lore: 'Tied by somebody who was owed money and never collected. It has been earning quietly since.',
  },
  {
    id: 'charm-tollkeepers-mark',
    name: 'Tollkeeper’s Mark',
    rarity: 'rare',
    stats: { goldFind: 10 },
    weight: 0.00025,
    lore: 'Every road out of the Archivum had one of these at the end of it. The roads are gone.',
  },
  {
    id: 'charm-counting-stone',
    name: 'Counting Stone',
    rarity: 'epic',
    stats: { goldFind: 18 },
    weight: 0.00011,
    lore: 'It counts. Nobody has established what, only that the number goes up and has never gone down.',
  },
  {
    id: 'charm-first-coin',
    name: 'The First Coin',
    rarity: 'legendary',
    stats: { goldFind: 28 },
    weight: 0.000035,
    lore: 'Struck before there was anything to buy, by someone who correctly assumed there would be.',
  },
  {
    id: 'charm-unspent-hoard',
    name: 'The Unspent Hoard',
    rarity: 'mythic',
    stats: { goldFind: 60 },
    weight: 0.000005,
    lore: 'A whole vault, folded small enough to carry. The folding is the valuable part.',
  },
];

/**
 * XP charms. Percentage, because XP is the one curve where a flat bonus dies.
 *
 * The rank ladder's costs climb steeply, so a flat "+12 XP" charm is decisive
 * at rank 1 and invisible by rank 8 — which makes it an item you find, wear
 * once, and never think about again. A percentage keeps its meaning the whole
 * way up, which is what a slot the player has to *choose* to spend needs.
 */
export const XP_CHARMS: CharmSeed[] = [
  {
    id: 'charm-students-thread',
    name: 'Student’s Thread',
    rarity: 'common',
    stats: { xpBonus: 3 },
    weight: 0.9996,
    lore: 'Knotted once for every lesson that stuck. It is not a long thread.',
  },
  {
    id: 'charm-margin-note',
    name: 'Margin Note',
    rarity: 'rare',
    stats: { xpBonus: 10 },
    weight: 0.00025,
    lore: 'Torn from a book nobody has found, in handwriting nobody has matched. It is correct.',
  },
  {
    id: 'charm-copyists-lens',
    name: 'Copyist’s Lens',
    rarity: 'epic',
    stats: { xpBonus: 18 },
    weight: 0.00011,
    lore: 'Ground for a scribe who wanted to see what they were transcribing. They regretted it.',
  },
  {
    id: 'charm-verge-compass',
    name: 'Verge Compass',
    rarity: 'legendary',
    stats: { xpBonus: 28 },
    weight: 0.000035,
    lore: 'It does not point anywhere. It points at *how far*, which turned out to be the useful question.',
  },
  {
    id: 'charm-whole-account',
    name: 'The Whole Account',
    rarity: 'mythic',
    stats: { xpBonus: 60 },
    weight: 0.000005,
    lore: 'Everything that happened, written down once, by the only witness who was there for all of it.',
  },
];

/**
 * The whole table.
 *
 * The three families carry identical weights at each rarity, so a charm drop is
 * an even three-way split on which family and then the same rarity ladder
 * inside it. That is the property that makes the three wells a *build*: the
 * player who wants all-Magic-Find can get there, it just costs them three
 * finds from one third of the table instead of three from all of it.
 *
 * `CHARM_DROP_CHANCE` was tripled alongside this so the supply of any one
 * family per strike is what the whole table used to be — widening the table
 * without that would have been a silent 3x nerf to Magic Find.
 */
export const ALL_CHARMS: CharmSeed[] = [...MF_CHARMS, ...GOLD_CHARMS, ...XP_CHARMS];

/** Which family a charm belongs to, for the Codex and the bag filter. */
export function charmFamily(id: string): CharmFamily | null {
  if (MF_CHARMS.some(c => c.id === id)) return 'find';
  if (GOLD_CHARMS.some(c => c.id === id)) return 'fortune';
  if (XP_CHARMS.some(c => c.id === id)) return 'insight';
  return null;
}

const CHARM_WEIGHT_TOTAL = ALL_CHARMS.reduce((sum, c) => sum + c.weight, 0);

/** Pick which charm dropped. Weighted across all three families. */
export function rollCharmSeed(rng: () => number = Math.random): CharmSeed {
  let roll = rng() * CHARM_WEIGHT_TOTAL;
  for (const charm of ALL_CHARMS) {
    roll -= charm.weight;
    if (roll <= 0) return charm;
  }
  return ALL_CHARMS[0];
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

/**
 * Mint a charm from its seed, rolled inside its rarity's grade band.
 *
 * The seed's authored numbers are read as the **ceiling**, not the midpoint:
 * every charm in the table was balanced as "what a Verge Compass is worth", and
 * treating that as a midpoint would let half of them roll above a number the
 * economy was tuned against. So a maxed roll reproduces exactly the fixed value
 * charms used to always have, and every other roll is below it.
 *
 * That makes this a nerf in expectation, and deliberately: the fixed charm was
 * a guaranteed payout on a drop that is already the rarest thing the Forge
 * produces, which left nothing to chase once you had one of each. What it buys
 * is that the second Verge Compass is now worth picking up.
 */
export function mintCharm(
  seed: CharmSeed,
  foundAt = new Date().toISOString(),
  rng: () => number = Math.random,
): GameItem {
  const band = QUALITY_BAND[seed.rarity] ?? QUALITY_BAND.common;
  const span = band.max - band.min;
  const stats: ItemStats = {};
  const rollQuality: NonNullable<GameItem['rollQuality']> = {};
  for (const key of ITEM_STAT_KEYS) {
    const best = seed.stats[key];
    if (best == null) continue;
    const q = band.min + rng() * span;
    // `q / band.max` rather than `q`: the seed carries the *best* this charm can
    // roll, so the top of the band has to land exactly on it. Multiplying by the
    // raw `q` would top a Common charm out at 70% of its own authored number and
    // silently nerf every charm in the table by the width of its band.
    stats[key] = Math.round(best * (q / band.max) * 10) / 10;
    rollQuality[key] = span > 0 ? Math.min(1, Math.max(0, (q - band.min) / span)) : 1;
  }
  return {
    id: mintId(seed.id),
    name: seed.name,
    type: 'charm',
    rarity: seed.rarity,
    stats,
    rollQuality,
    sellValue: qualityAdjustedSellValue(sellValueFor('charm', seed.rarity), { rollQuality }),
    equipped: false,
    lore: seed.lore,
    foundAt,
    soulbound: false,
    upgradeLevel: 0,
  };
}

/** The Gold Find of a worn total: its `goldFind` plus the retired `goldPerSec` of older items read as Gold Find. */
export function totalGoldFind(totals: Pick<ItemStats, 'goldFind' | 'goldPerSec'>): number {
  return Math.round(((totals.goldFind ?? 0) + legacyGoldFind(totals.goldPerSec)) * 10) / 10;
}

/** Sum a set of stat blocks. Used for equipped totals on both player and explorer. */
export function sumStats(blocks: readonly ItemStats[]): Required<ItemStats> {
  const total: Required<ItemStats> = {
    goldPerSec: 0, goldFind: 0, magicFind: 0, xpBonus: 0, strikePower: 0, ward: 0,
    life: 0, mana: 0, defense: 0, spellDamage: 0, castSpeed: 0, moveSpeed: 0, critChance: 0, lifeRegen: 0, manaRegen: 0,
    fireResist: 0, coldResist: 0, lightningResist: 0, arcaneResist: 0, allResist: 0,
  };
  for (const block of blocks) {
    for (const key of ITEM_STAT_KEYS) {
      total[key] += block[key] ?? 0;
    }
  }
  // The retired Gold/sec rolls on older items add up raw; `totalGoldFind` reads them as Gold Find. One-decimal rolls
  // drift in float; round once, here.
  total.goldPerSec = Math.round(total.goldPerSec * 10) / 10;
  total.goldFind = Math.round(total.goldFind * 10) / 10;
  return total;
}
