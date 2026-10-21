/**
 * socket.model.ts — sockets on equipment, and what a rune set into one does.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE SOCKET COUNT IS DERIVED AND NOT STORED
 * ─────────────────────────────────────────────────────────────────────────────
 * An item's socket count is a pure function of what the item *is* — its slot and
 * its rarity — so it is computed on read rather than written at mint. The
 * alternative would mean every one of the thousands of items already in players'
 * saves has no socket field, and back-filling it means inventing a number and
 * then living with two sources for it forever. Deriving means a Legendary sword
 * minted eighteen releases ago has three sockets the first time this page loads,
 * which is the correct outcome: the player earned the Legendary.
 *
 * What *is* stored is the contents — `GameItem.sockets`, a sparse array of rune
 * ids and nulls. Its length is not authoritative; `socketCountFor` is. A save
 * whose array is longer than the derived count (because the ladder was retuned
 * downward) has its tail ignored by `socketsOf`, not thrown away, so retuning
 * back up returns the runes rather than having eaten them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE EFFECT TABLE IS PER-STAT AND NOT A SINGLE TIER MULTIPLIER
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious build is one ladder — "a Mythic rune is worth 32× a Common" — and
 * it works for Gold/sec, which is unbounded, and destroys every percentage stat,
 * which is not: 32× a one-point Magic Find roll is a 32-point Magic Find rune
 * that outclasses every item in the game. So each stat carries its own ladder,
 * and the shape of that ladder is a property of the stat rather than of the
 * rune. Adding a rune is one row in `SOCKET_CHANNEL`; retuning a stat is one
 * row in `SOCKET_LADDER`.
 *
 * Pure data and pure functions — no browser APIs, safe on an SSR path.
 */
import {
  ITEM_STAT_KEYS,
  LEGACY_STAT_KEYS,
  type LegacyStatKey,
  type GameItem,
  type ItemRarity,
  type ItemStats,
  type SlotId,
} from '../rpg/item.model';
import { itemDefinitionById } from '../rpg/item-definition';
import { runeById, type RuneTier } from '../rune-forge/rune.model';

/** Which ladder an item's socket count is read off. */
export type SocketFrame = 'weapon' | 'armor' | 'none';

/**
 * The armour wells. Everything the paper doll draws that is not the weapon.
 *
 * `off-hand` counts as armour rather than as a second weapon: it accepts the
 * same item types the chest does, and giving it three sockets would make the
 * cheapest three-socket word a shield rather than a sword.
 */
const ARMOR_SLOTS: readonly SlotId[] = [
  'head', 'chest', 'hands', 'legs', 'feet', 'off-hand', 'trinket',
];

/**
 * Sockets per rarity, per frame.
 *
 * The brief is "weapons 1–3, armour 1–2", spread across the seven-rung rune
 * ladder rather than a three-rung one. A weapon reaches three at Legendary,
 * which is where the three-rune words start; armour reaches two at Epic.
 */
const WEAPON_SOCKETS: Record<ItemRarity, number> = {
  common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3, mythic: 3, singular: 3,
};

const ARMOR_SOCKETS: Record<ItemRarity, number> = {
  common: 1, uncommon: 1, rare: 1, epic: 2, legendary: 2, mythic: 2, singular: 2,
};

export const MAX_SOCKETS = 3;

/**
 * Which frame this item is read against.
 *
 * The slot comes from the authored definition when there is one, and from where
 * the item is currently worn when there is not. Both are needed: a bagged item
 * has no `slot`, and a save old enough to predate `definitionId` has no
 * definition. An item that answers neither is unsocketable, which is the right
 * answer for a charm, a loose rune or a crafted Runeword.
 */
export function socketFrameOf(item: Pick<GameItem, 'type' | 'slot' | 'definitionId'>): SocketFrame {
  if (item.type === 'charm' || item.type === 'rune' || item.type === 'runeword') return 'none';
  const slot = itemDefinitionById(item.definitionId ?? '')?.slot ?? item.slot;
  if (!slot) return 'none';
  if (slot === 'weapon') return 'weapon';
  return ARMOR_SLOTS.includes(slot) ? 'armor' : 'none';
}

/** How many wells this item has. Zero for anything that cannot be socketed. */
export function socketCountFor(
  item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'rarity'>,
): number {
  const frame = socketFrameOf(item);
  if (frame === 'none') return 0;
  const table = frame === 'weapon' ? WEAPON_SOCKETS : ARMOR_SOCKETS;
  return table[item.rarity] ?? 0;
}

export function isSocketable(
  item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'rarity'>,
): boolean {
  return socketCountFor(item) > 0;
}

/**
 * This item's wells, normalised to the derived count.
 *
 * Always returns exactly `socketCountFor` entries — short arrays are padded
 * with nulls and long ones are truncated for reading only. Ids that are not
 * runes any more read as empty rather than as a rune nobody can name.
 */
export function socketsOf(item: GameItem): (string | null)[] {
  const count = socketCountFor(item);
  const stored = item.sockets ?? [];
  const wells: (string | null)[] = [];
  for (let i = 0; i < count; i++) {
    const id = stored[i];
    wells.push(typeof id === 'string' && runeById(id) ? id : null);
  }
  return wells;
}

/** Every rune actually set into this item, in socket order. */
export function socketedRunes(item: GameItem): string[] {
  return socketsOf(item).filter((id): id is string => id !== null);
}

export function emptySocketCount(item: GameItem): number {
  return socketsOf(item).filter(id => id === null).length;
}

/** True when every well on this item holds a rune. */
export function isFullySocketed(item: GameItem): boolean {
  const count = socketCountFor(item);
  return count > 0 && emptySocketCount(item) === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// What a rune does in a well
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which stat each rune feeds. One channel per rune, chosen so every stat has
 * runes at several rungs and no rune is a strictly worse copy of another.
 */
export const SOCKET_CHANNEL: Readonly<Record<string, LegacyStatKey>> = {
  // Common — the floor of the world, one rune per stat.
  ash: 'goldFind',
  ember: 'strikePower',
  drift: 'magicFind',
  shade: 'ward',
  // Uncommon — the realms, each leaving one mark.
  glint: 'magicFind',
  veil: 'ward',
  pulse: 'goldFind',
  thorn: 'strikePower',
  scorch: 'strikePower',
  // Rare — things that were made on purpose.
  nexus: 'goldFind',
  sigil: 'xpBonus',
  rift: 'magicFind',
  hollow: 'ward',
  // Epic — the Shattering, in three pieces.
  fracture: 'strikePower',
  eclipse: 'magicFind',
  forge: 'goldFind',
  // Legendary — the two energies and the book that named them.
  aether: 'xpBonus',
  nox: 'magicFind',
  codex: 'magicFind',
  // Mythic — the two halves of the thing that broke.
  convergence: 'goldFind',
  godstone: 'strikePower',
  // Singular — the Void feeds every channel at once. See `socketEffectOf`.
};

/**
 * How much one rune of each tier is worth, per stat.
 *
 * Gold Find climbs like Magic Find (percentages on the hunt's piles; the forge's
 * Gold/sec this row used to feed is retired). The percentages climb gently because they compete with item
 * rolls that top out in the tens. Strike and Ward climb most gently of all:
 * both are consumed by systems with hard caps (25% second-rune chance, 30% of
 * the temper fail chance), so a rune worth thirty points would buy nothing.
 */
// Runes channel the five legacy stats only; the combat affixes roll on gear.
export const SOCKET_LADDER: Readonly<Record<LegacyStatKey, Record<RuneTier, number>>> = {
  goldFind: {
    common: 1, uncommon: 2, rare: 4, epic: 7, legendary: 12, mythic: 20, singular: 32,
  },
  magicFind: {
    common: 1, uncommon: 2, rare: 4, epic: 7, legendary: 12, mythic: 20, singular: 32,
  },
  xpBonus: {
    common: 1, uncommon: 2, rare: 4, epic: 7, legendary: 12, mythic: 20, singular: 32,
  },
  strikePower: {
    common: 1, uncommon: 1, rare: 2, epic: 3, legendary: 5, mythic: 8, singular: 12,
  },
  ward: {
    common: 1, uncommon: 1, rare: 2, epic: 3, legendary: 5, mythic: 8, singular: 12,
  },
};

/**
 * What one rune contributes when set into a well.
 *
 * The Void is the exception the ladder is built to allow: it has no row in
 * `SOCKET_CHANNEL` and instead pays every channel at its Singular rung. One
 * rune in the game does this, and it is the one that takes twenty billion Gold
 * of striking to find.
 */
export function socketEffectOf(runeId: string): ItemStats {
  const rune = runeById(runeId);
  if (!rune) return {};
  if (rune.tier === 'singular') {
    const all: ItemStats = {};
    for (const key of LEGACY_STAT_KEYS) all[key] = SOCKET_LADDER[key][rune.tier];
    return all;
  }
  const channel = SOCKET_CHANNEL[runeId];
  if (!channel) return {};
  return { [channel]: SOCKET_LADDER[channel][rune.tier] };
}

/** Everything this item's runes contribute, summed. Empty when unsocketed. */
export function socketStats(item: GameItem): ItemStats {
  const total: ItemStats = {};
  for (const runeId of socketedRunes(item)) {
    const effect = socketEffectOf(runeId);
    for (const key of ITEM_STAT_KEYS) {
      const value = effect[key];
      if (value === undefined) continue;
      total[key] = round(total[key] ?? 0, value);
    }
  }
  return total;
}

function round(carried: number, add: number): number {
  return Math.round((carried + add) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unsocketing
// ─────────────────────────────────────────────────────────────────────────────

/** A quarter of what the rune is worth at the anvil. */
export const UNSOCKET_COST_RATIO = 0.25;

/**
 * Gold to pull one rune back out, which scales with the rune rather than with
 * the item. Pulling a Common costs 150; pulling the Void costs 1.5 million (economy v3),
 * which is the point: the last rune in the game should be a decision.
 */
export function unsocketCost(runeId: string): number {
  const rune = runeById(runeId);
  if (!rune) return 0;
  return Math.ceil(rune.forgeCost * UNSOCKET_COST_RATIO);
}
