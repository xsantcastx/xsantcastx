/**
 * socket.model.ts — sockets on equipment (D2's rule, docs/design/runewords.md §2), and what a rune set into one does.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SOCKET COUNT IS THE LENGTH OF `GameItem.sockets`
 * ─────────────────────────────────────────────────────────────────────────────
 * A normal (white) base rolls its sockets ONCE, at the drop (`rollSockets`: by base type and item level, canon
 * §6.2), and they are written as that many empty wells: `sockets: [null, null, null]`. The array's length is the
 * count, so the save, the packed v3 format (`so`) and trade-core (≤ 8 wells) carry it with no new field. An item
 * with no array has no sockets. Old saves keep every rune they had set: an array that holds runes keeps its length.
 *
 * Runes fill the wells in order, left to right, and never come out (canon: "a rune in a socket is a promise the gear
 * has to keep"). Setting one happens only at an Enchanting Table (socketing.ts).
 *
 * Pure data and pure functions — no browser APIs, safe on an SSR path.
 */
import {
  ITEM_STAT_KEYS,
  LEGACY_STAT_KEYS,
  type LegacyStatKey,
  type GameItem,
  type ItemStats,
  type SlotId,
} from '../rpg/item.model';
import { itemDefinitionById } from '../rpg/item-definition';
import { itemBase } from '../rpg/item-base';
import type { GearBase } from '../art/gear-icons';
import { runeById, type RuneTier } from '../rune-forge/rune.model';
import { parseToolId } from '../skills/tool-items';

/** Which family an item's runes are read against: weapons give the rune's line, armour its resist. */
export type SocketFrame = 'weapon' | 'armor' | 'none';

const ARMOR_SLOTS: readonly SlotId[] = [
  'head', 'chest', 'hands', 'legs', 'feet', 'off-hand', 'trinket',
];

/** The most wells any item can hold (a staff or a shield at item level 30+). */
export const MAX_SOCKETS = 5;

export function socketFrameOf(item: Pick<GameItem, 'type' | 'slot' | 'definitionId'>): SocketFrame {
  if (item.type === 'charm' || item.type === 'rune' || item.type === 'runeword') return 'none';
  const slot = itemDefinitionById(item.definitionId ?? '')?.slot ?? item.slot;
  if (!slot) return 'none';
  if (slot === 'weapon') return 'weapon';
  return ARMOR_SLOTS.includes(slot) ? 'armor' : 'none';
}

/** How many wells this item has: the length of its socket array. Zero for anything that cannot be socketed. */
export function socketCountFor(item: Pick<GameItem, 'type' | 'slot' | 'definitionId'> & { sockets?: readonly (string | null)[] }): number {
  if (socketFrameOf(item) === 'none') return 0;
  return Math.min(MAX_SOCKETS + 1, Math.max(0, item.sockets?.length ?? 0));
}

export function isSocketable(item: Pick<GameItem, 'type' | 'slot' | 'definitionId'> & { sockets?: readonly (string | null)[] }): boolean {
  return socketCountFor(item) > 0;
}

/** This item's wells: exactly `socketCountFor` entries; ids that are not runes read as empty. */
export function socketsOf(item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'sockets'>): (string | null)[] {
  const count = socketCountFor(item);
  const stored = item.sockets ?? [];
  const wells: (string | null)[] = [];
  for (let i = 0; i < count; i++) {
    const id = stored[i];
    wells.push(typeof id === 'string' && runeById(id) ? id : null);
  }
  return wells;
}

export function socketedRunes(item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'sockets'>): string[] {
  return socketsOf(item).filter((id): id is string => id !== null);
}

export function emptySocketCount(item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'sockets'>): number {
  return socketsOf(item).filter(id => id === null).length;
}

/** The next well a rune goes into (D2: left to right), or -1 when there is none. */
export function firstEmptyWell(item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'sockets'>): number {
  return socketsOf(item).indexOf(null);
}

export function isFullySocketed(item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'sockets'>): boolean {
  const count = socketCountFor(item);
  return count > 0 && emptySocketCount(item) === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rolling sockets on a white base (canon §6.2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The most wells a base type can ever hold (Diablo II's per-base caps, in this game's bases). Hand-sized things hold
 * few, long two-handers and body armour hold many; gloves, boots, belts, jewellery and tools hold none.
 */
export const BASE_SOCKET_MAX: Readonly<Partial<Record<GearBase, number>>> = {
  dagger: 2, wand: 2,
  sword: 3, mace: 3, axe: 3,
  greatsword: 4, hammer: 4, spear: 4, bow: 4, crossbow: 4, staff: 5,
  shield: 4, tome: 2,
  helm: 3, hood: 2, crown: 3, circlet: 2,
  plate: 4, robe: 3, coat: 3, legs: 2,
};

/** Bases canon gives one more well than the item level allows ("shields and staves get +1"). */
const PLUS_ONE: ReadonlySet<GearBase> = new Set<GearBase>(['shield', 'staff']);

/** Canon's item-level cap: 1–14 up to 2, 15–29 up to 3, 30+ up to 4. */
export function socketCapForLevel(itemLevel: number): number {
  return itemLevel >= 30 ? 4 : itemLevel >= 15 ? 3 : 2;
}

/** The most wells this base can roll at this item level (0: it cannot be socketed). */
export function maxSocketsFor(base: GearBase | null, itemLevel: number): number {
  if (!base) return 0;
  const byBase = BASE_SOCKET_MAX[base] ?? 0;
  if (!byBase) return 0;
  return Math.min(byBase, socketCapForLevel(itemLevel) + (PLUS_ONE.has(base) ? 1 : 0), MAX_SOCKETS);
}

/** The chance a dropped white base comes up socketed (D2's "Socketed" normals: about one in three). */
export const WHITE_SOCKET_CHANCE = 0.34;

/**
 * Roll a white drop's wells: null when it comes up plain (or is not a normal, socketable base), else that many
 * empty wells. Uniform from 1 to the cap, so a full-width base is as rare as D2 makes it. `rng` is the drop's own
 * seeded stream (LootService), so a replayed pickup rolls the same sockets.
 */
export function rollSockets(
  item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'rarity' | 'name' | 'id' | 'itemLevel'>,
  rng: () => number,
  chance = WHITE_SOCKET_CHANCE,
): (string | null)[] | null {
  if (item.rarity !== 'common' || socketFrameOf(item) === 'none') return null;
  // Tools (pickaxes, axes, sickles, staves of the gathering ladder) are tools, not bases.
  if (parseToolId(item.definitionId) || parseToolId(item.id)) return null;
  const max = maxSocketsFor(itemBase(item), item.itemLevel ?? 1);
  if (max <= 0) return null;
  if (rng() >= chance) return null;
  const n = 1 + Math.min(max - 1, Math.floor(rng() * max));
  return Array.from({ length: n }, () => null);
}

/** A socketed normal base (grey-named, D2): a white item with at least one well. */
export function isSocketedNormal(item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'rarity' | 'sockets'>): boolean {
  return item.rarity === 'common' && socketCountFor(item) > 0;
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
export function socketStats(item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'sockets'>): ItemStats {
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
