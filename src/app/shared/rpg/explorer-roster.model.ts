/**
 * explorer-roster.model.ts — explorers as people, not as missions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED, AND WHY IT HAD TO
 * ─────────────────────────────────────────────────────────────────────────────
 * Before this file, an "Explorer" *was* a mission: a record of realm, span and
 * start time that came into existence on dispatch and was deleted on return.
 * There was nobody to name, nobody to equip, and no reason to prefer one slot
 * over another — every expedition was identical because every explorer was.
 *
 * Now an explorer is a persistent hire with a name, a rarity and a kit, and a
 * mission is a separate record that points at one. The old record survives under
 * its true name, `Expedition`, and `migrateLegacyExpedition` walks any mission
 * written by the previous build onto a freshly-minted Common explorer so nothing
 * in flight is lost on the upgrade.
 *
 * Pure data and pure functions — no browser APIs, safe on an SSR path.
 */
import { GameItem, ItemStats, sumStats } from './item.model';

/**
 * Explorer rarity stops at Mythic.
 *
 * There is no Singular explorer and there should not be one: Singular is the
 * Void's tier, one rune, the thing the realms were carved out of. A person
 * cannot be that, and a sixth tier that pays 0.1 speed already reduces an hour
 * to six minutes — there is no room above it that is not simply "free".
 */
export type ExplorerRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export interface ExplorerTierDefinition {
  id: ExplorerRarity;
  label: string;
  /** How many items they carry home from one mission. */
  inventorySlots: number;
  /** Multiplier on mission time. 1.0 is normal; 0.5 is twice as fast. */
  speed: number;
  /** Percentage bonus to loot quality — reads as Magic Find on their rolls. */
  lootBonus: number;
  /** How many items they can wear. */
  maxEquipSlots: number;
  color: string;
  glow: string;
  /** Chance of this tier when an explorer drops. Normalised at use. */
  weight: number;
}

/**
 * The six tiers, exactly as briefed.
 *
 * The speed column is the aggressive one: a Mythic explorer runs an hour-long
 * expedition in six minutes, which is a 10× throughput multiplier on the best
 * mission in the game. That is intentional and it is why Mythic explorers are
 * weighted at half a percent of an already-rare drop — the ladder has to have a
 * top that is worth climbing to, and "your expeditions now resolve while you
 * watch" is a more interesting prize than another flat percentage.
 */
export const EXPLORER_TIERS: Record<ExplorerRarity, ExplorerTierDefinition> = {
  common: {
    id: 'common', label: 'Common',
    inventorySlots: 1, speed: 1.0, lootBonus: 0, maxEquipSlots: 0,
    color: '#8f98a8', glow: 'rgba(143, 152, 168, 0.45)', weight: 0.99721,
  },
  uncommon: {
    id: 'uncommon', label: 'Uncommon',
    inventorySlots: 2, speed: 0.8, lootBonus: 10, maxEquipSlots: 1,
    color: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.55)', weight: 0.0026,
  },
  rare: {
    id: 'rare', label: 'Rare',
    inventorySlots: 3, speed: 0.6, lootBonus: 25, maxEquipSlots: 2,
    color: '#a48bff', glow: 'rgba(140, 110, 255, 0.7)', weight: 0.00012,
  },
  epic: {
    id: 'epic', label: 'Epic',
    inventorySlots: 4, speed: 0.4, lootBonus: 50, maxEquipSlots: 3,
    color: '#C9A84C', glow: 'rgba(255, 190, 90, 0.75)', weight: 0.00005,
  },
  legendary: {
    id: 'legendary', label: 'Legendary',
    inventorySlots: 5, speed: 0.3, lootBonus: 100, maxEquipSlots: 4,
    color: '#ff9a5a', glow: 'rgba(255, 154, 90, 0.8)', weight: 0.000015,
  },
  mythic: {
    id: 'mythic', label: 'Mythic',
    inventorySlots: 6, speed: 0.1, lootBonus: 200, maxEquipSlots: 5,
    color: '#ff2d4d', glow: 'rgba(255, 45, 77, 0.85)', weight: 0.000005,
  },
};

export const EXPLORER_RARITY_ORDER: ExplorerRarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic',
];

export function explorerTier(rarity: ExplorerRarity): ExplorerTierDefinition {
  return EXPLORER_TIERS[rarity] ?? EXPLORER_TIERS.common;
}

const TIER_WEIGHT_TOTAL = EXPLORER_RARITY_ORDER
  .reduce((sum, id) => sum + EXPLORER_TIERS[id].weight, 0);

/** Weighted pick of an explorer tier. Used when one drops from the anvil. */
export function rollExplorerRarity(rng: () => number = Math.random): ExplorerRarity {
  let roll = rng() * TIER_WEIGHT_TOTAL;
  for (const id of EXPLORER_RARITY_ORDER) {
    roll -= EXPLORER_TIERS[id].weight;
    if (roll <= 0) return id;
  }
  return 'common';
}

// ─────────────────────────────────────────────────────────────────────────────
// Names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Two halves and an optional epithet.
 *
 * Generated rather than drawn from a fixed list of fifty because a roster of
 * five explorers with two duplicate names reads as a bug, and because the names
 * have to survive a player who hires forty of them over a month. 24 × 24 stems
 * is 576 base names before the epithet, which is enough that a collision inside
 * one roster is a curiosity rather than an expectation.
 */
const NAME_FIRST = [
  'Vel', 'Kor', 'Ash', 'Mar', 'Sel', 'Dra', 'Thes', 'Ryn', 'Cal', 'Ombr',
  'Nyx', 'Sar', 'Ith', 'Vor', 'Elu', 'Hald', 'Tor', 'Aza', 'Fen', 'Lysa',
  'Grim', 'Ves', 'Qual', 'Bren',
];

const NAME_LAST = [
  'ren', 'vash', 'mir', 'thal', 'wyn', 'dros', 'kai', 'sel', 'orn', 'ith',
  'vane', 'gar', 'lys', 'mora', 'tesk', 'una', 'reth', 'vil', 'sha', 'dun',
  'kesh', 'ora', 'phel', 'nax',
];

/** Only the rare-and-better get one. An epithet should mean something. */
const EPITHETS = [
  'the Unlit', 'the Patient', 'Ash-Walker', 'the Sixth Return', 'Veilborn',
  'the Cartographer', 'Long-Shadow', 'the Unaccounted', 'Dusk-Handed',
  'the Quiet Ledger', 'First-Through', 'the Unburied',
];

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

export function rollExplorerName(rarity: ExplorerRarity, rng: () => number = Math.random): string {
  const base = `${pick(NAME_FIRST, rng)}${pick(NAME_LAST, rng)}`;
  const earnsEpithet = rarity !== 'common' && rarity !== 'uncommon';
  return earnsEpithet ? `${base} ${pick(EPITHETS, rng)}` : base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Records
// ─────────────────────────────────────────────────────────────────────────────

export interface RosterExplorer {
  id: string;
  name: string;
  rarity: ExplorerRarity;
  /** ISO instant they joined, for the roster's "hired" line and stable sort. */
  hiredAt: string;
  /** Item ids worn by this explorer. The items themselves live in the inventory. */
  equipment: string[];
  /** Lifetime missions completed, shown on their card. */
  missions: number;

  // ── The cast ───────────────────────────────────────────────────────────────
  // Everything below is optional so that a roster written by the build before
  // named explorers existed still type-checks and still loads. `ExplorerRosterService`
  // fills them in on the next hydrate — see `adoptArchetypes` — rather than
  // leaving them permanently blank, but nothing downstream may assume they are
  // present.

  /**
   * Which of the eighteen written people this is.
   *
   * Absent on a generated hire, which is what happens when the cast has no
   * unclaimed member of the rolled tier left. See `pickArchetype`.
   */
  archetypeId?: string;

  /**
   * Lifetime XP, feeding this explorer's own level.
   *
   * Their own, not a share of the Keeper's: see the note at the top of
   * `explorer-progression.ts` for why the roster needs a ladder the account
   * cannot climb on its behalf.
   */
  xp?: number;

  /** Runes, scrolls and items this person has personally carried home. */
  itemsFound?: number;
  /** Gold this person has personally recovered. */
  goldFound?: number;
  /**
   * The best rune they ever found, as a `RUNE_TIER_ORDER` index.
   *
   * Stored as the index rather than the rune id because the card renders "best
   * find: Epic" and a rune id would need the forge's registry imported into a
   * file that is meant to stay pure data.
   */
  bestFindTier?: number;
  /** Milliseconds this person has spent out on missions, lifetime. */
  timeDeployed?: number;
}

export function explorerEquipmentStats(
  explorer: RosterExplorer,
  itemById: (id: string) => GameItem | undefined,
): Required<ItemStats> {
  const blocks: ItemStats[] = [];
  for (const id of explorer.equipment) {
    const item = itemById(id);
    if (item) blocks.push(item.stats);
  }
  return sumStats(blocks);
}

/**
 * The loot bonus this explorer actually carries: their tier, plus what they wear.
 *
 * An item's `lootBonus` and `magicFind` both count here and are added together.
 * They are the same thing from the explorer's side — a charm that makes the
 * wearer find better runes does not care whether the wearer is the player or the
 * person the player sent into Umbral — and keeping them separate would mean
 * every Magic Find charm silently does nothing once equipped on an explorer,
 * which is exactly the trap this system exists to avoid.
 */
export function explorerLootBonus(
  explorer: RosterExplorer,
  itemById: (id: string) => GameItem | undefined,
): number {
  const worn = explorerEquipmentStats(explorer, itemById);
  return explorerTier(explorer.rarity).lootBonus + worn.lootBonus + worn.magicFind;
}

/** How long a mission takes for this explorer, after their speed. */
export function missionDurationFor(baseDuration: number, rarity: ExplorerRarity): number {
  return Math.max(1_000, Math.round(baseDuration * explorerTier(rarity).speed));
}

let explorerCounter = 0;

function explorerId(): string {
  explorerCounter = (explorerCounter + 1) % 1_000_000;
  return `exp-${Date.now().toString(36)}-${explorerCounter.toString(36)}`;
}

/**
 * Mint a new explorer of a given rarity, with a rolled name.
 *
 * The nameless path. Still reached — see `pickArchetype`, which returns null
 * once the cast has no unclaimed member of the rolled tier — and deliberately
 * kept rather than made to throw: a player who has collected every Rare and
 * then rolls another one should be handed *somebody*, at the tier the roll
 * actually produced.
 */
export function mintExplorer(
  rarity: ExplorerRarity,
  rng: () => number = Math.random,
  hiredAt = new Date().toISOString(),
): RosterExplorer {
  return {
    id: explorerId(),
    name: rollExplorerName(rarity, rng),
    rarity,
    hiredAt,
    equipment: [],
    missions: 0,
    xp: 0,
    itemsFound: 0,
    goldFound: 0,
    timeDeployed: 0,
  };
}

/**
 * Mint one of the eighteen, as themselves.
 *
 * Takes the archetype rather than an id so the caller has already proved it
 * exists — a mint that silently produced a nameless explorer because an id was
 * misspelled would be a bug that reads, on the card, as bad luck.
 */
export function mintFromArchetype(
  archetype: { id: string; name: string; rarity: ExplorerRarity },
  hiredAt = new Date().toISOString(),
): RosterExplorer {
  return {
    id: explorerId(),
    name: archetype.name,
    rarity: archetype.rarity,
    archetypeId: archetype.id,
    hiredAt,
    equipment: [],
    missions: 0,
    xp: 0,
    itemsFound: 0,
    goldFound: 0,
    timeDeployed: 0,
  };
}

/**
 * The explorer every visitor starts with.
 *
 * Common, because the roster ladder has to have a bottom the player can feel
 * themselves climbing off. A starter Rare would make the first three drops feel
 * like downgrades.
 */
export function starterExplorer(rng: () => number = Math.random): RosterExplorer {
  return mintExplorer('common', rng, new Date().toISOString());
}

/** How many equipment slots this explorer's tier grants, before their level. */
export function baseEquipSlots(rarity: ExplorerRarity): number {
  return explorerTier(rarity).maxEquipSlots;
}
