/**
 * mystery-box.ts — what a box can contain, and what stops it being cruel.
 *
 * A box is a Gold sink with a rarity window. You pay a fixed price, you get
 * exactly one item, and the only thing you are buying is *where in the window it
 * lands* — plus, underneath that, the roll grade the item mints with, which is a
 * second gamble stacked on the first. Two Eclipse Vaults can both pay out an
 * Epic and one of them can still be worth twenty times the other.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVERY BOX IS NEGATIVE EXPECTED VALUE IN GOLD, ON PURPOSE
 * ─────────────────────────────────────────────────────────────────────────────
 * `EQUIPMENT_SCRAP` (item-definition.ts) is deliberately set an order of
 * magnitude below the rune worths so that opening a box and selling the contents
 * always loses money. That is the property that makes this a sink rather than a
 * pump: the payout is the *item*, and a player who is buying boxes to melt them
 * down is a player who has found an exploit. `boxScrapExpectation` below exists
 * so that property is checked by a test rather than asserted in a comment.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY PITY IS COUNTED PER BOX AND NOT GLOBALLY
 * ─────────────────────────────────────────────────────────────────────────────
 * A global counter would let a player build pity on Iron Chests at 5,000 Gold
 * apiece and then spend it on a Void Cache — buying a guaranteed Singular for
 * about a fiftieth of what the guarantee is worth. Counting per box means the
 * protection is always paid for at the price of the thing it protects.
 *
 * The counter tracks *consecutive floor results*: every open that lands on the
 * box's minimum rarity increments it, and any open above the floor resets it to
 * zero. At `PITY_THRESHOLD` the next open cannot land on the floor. So the
 * guarantee is "you will not open eleven in a row and see nothing but the worst
 * this box does", which is the failure mode that actually makes people quit.
 *
 * Pure data and pure functions — no Angular, no browser APIs, no storage.
 * `GamblerService` owns the counter and the writes.
 */
import {
  ITEM_DEFINITIONS,
  EQUIPMENT_SCRAP,
  type ItemDefinition,
} from '../rpg/item-definition';
import { uniquesAtRarity } from '../rpg/unique-items';
import { SELL_QUALITY_FLOOR, SELL_QUALITY_SPAN } from '../rpg/item-quality';
import type { ItemRarity } from '../rpg/item.model';

/** The ladder, low to high. Index order is the only place it is written down. */
export const RARITY_LADDER: readonly ItemRarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular',
];

export function rarityRank(rarity: ItemRarity): number {
  const index = RARITY_LADDER.indexOf(rarity);
  return index < 0 ? 0 : index;
}

export interface MysteryBox {
  id: string;
  name: string;
  /** Gold. Fixed — a box never changes price. */
  cost: number;
  minRarity: ItemRarity;
  maxRarity: ItemRarity;
  /** One line, shown on the shelf under the rarity window. */
  blurb: string;
  /** Drives the box's colour, lid and beam. Matches the top rarity it offers. */
  accent: string;
  glow: string;
}

/**
 * Five boxes, each roughly five times the last.
 *
 * The windows overlap by one rung on purpose: the top of an Iron Chest is the
 * bottom of a Silver Coffer, so a player who has outgrown a box can see exactly
 * what the next one up replaces rather than having to work it out from two
 * disjoint lists.
 */
export const MYSTERY_BOXES: readonly MysteryBox[] = [
  {
    id: 'iron-chest', name: 'Iron Chest', cost: 5_000,
    minRarity: 'common', maxRarity: 'uncommon',
    blurb: 'Banded iron, unlovely, honest about what it is.',
    accent: '#8f98a8', glow: 'rgba(143, 152, 168, 0.5)',
  },
  {
    id: 'silver-coffer', name: 'Silver Coffer', cost: 25_000,
    minRarity: 'uncommon', maxRarity: 'rare',
    blurb: 'Tarnished at the hinges. Whatever is inside has been inside a while.',
    accent: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.55)',
  },
  {
    id: 'golden-reliquary', name: 'Golden Reliquary', cost: 100_000,
    minRarity: 'rare', maxRarity: 'epic',
    blurb: 'Built to hold one thing reverently. It is not fussy about which.',
    accent: '#a48bff', glow: 'rgba(140, 110, 255, 0.7)',
  },
  {
    id: 'eclipse-vault', name: 'Eclipse Vault', cost: 500_000,
    minRarity: 'epic', maxRarity: 'legendary',
    blurb: 'Sealed during the Shattering. Nobody recorded by whom, or against what.',
    accent: '#ff9a5a', glow: 'rgba(255, 154, 90, 0.8)',
  },
  {
    id: 'void-cache', name: 'Void Cache', cost: 5_000_000,
    minRarity: 'legendary', maxRarity: 'singular',
    blurb: 'It is not a container. It is a place the realms forgot to finish, and things collect there.',
    accent: '#ff2d4d', glow: 'rgba(255, 45, 77, 0.85)',
  },
];

export function boxById(id: string): MysteryBox | undefined {
  return MYSTERY_BOXES.find(box => box.id === id);
}

/** Every rarity a box can pay out, low to high. Never empty. */
export function boxWindow(box: MysteryBox): ItemRarity[] {
  const lo = rarityRank(box.minRarity);
  const hi = Math.max(lo, rarityRank(box.maxRarity));
  return RARITY_LADDER.slice(lo, hi + 1);
}

/**
 * How the window is weighted: each rung up is a fifth as likely as the one below.
 *
 * A flat window would make the top of a Void Cache a coin flip, which would put
 * a Singular in most players' hands inside an afternoon and end the ladder. A
 * fifth per rung is steep enough that the top of a box stays an event and shallow
 * enough that it is not a lottery nobody believes in.
 */
export const RARITY_STEP_WEIGHT = 0.2;

export function boxWeights(box: MysteryBox): { rarity: ItemRarity; weight: number }[] {
  return boxWindow(box).map((rarity, step) => ({
    rarity,
    weight: Math.pow(RARITY_STEP_WEIGHT, step),
  }));
}

/** The chance of each rarity, normalised. What the shelf shows before you buy. */
export function boxOdds(box: MysteryBox): { rarity: ItemRarity; chance: number }[] {
  const weights = boxWeights(box);
  const total = weights.reduce((sum, row) => sum + row.weight, 0);
  return weights.map(row => ({ rarity: row.rarity, chance: row.weight / total }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bad luck protection
// ─────────────────────────────────────────────────────────────────────────────

/** Consecutive floor results before the next open is guaranteed above it. */
export const PITY_THRESHOLD = 10;

/** Per-box count of consecutive opens that landed on the box's worst rarity. */
export type PityState = Readonly<Record<string, number>>;

export function pityFor(state: PityState, boxId: string): number {
  const n = state[boxId];
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** How many more floor results until the guarantee fires. Zero means "next one". */
export function pityRemaining(state: PityState, boxId: string): number {
  return Math.max(0, PITY_THRESHOLD - pityFor(state, boxId));
}

export function pityArmed(state: PityState, boxId: string): boolean {
  return pityFor(state, boxId) >= PITY_THRESHOLD;
}

// ─────────────────────────────────────────────────────────────────────────────
// The roll
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How often a box pays out a named object instead of an ordinary one, when the
 * rolled rarity has any uniques authored at it.
 *
 * Low, because a unique that turns up every fifteenth box stops being a story
 * the second time you see it. The Bestiary entry and the discovery animation are
 * built assuming most players will own a handful, not a set.
 */
export const UNIQUE_CHANCE = 0.06;

export interface BoxResult {
  rarity: ItemRarity;
  definitionId: string;
  unique: boolean;
  /** True when the guarantee, not the weights, decided the rarity. */
  pityApplied: boolean;
}

/** Definitions a box will hand out: rollable, wearable, and not a Keeper reward. */
export function boxPool(rarity: ItemRarity): ItemDefinition[] {
  const uniqueIds = new Set(uniquesAtRarity(rarity).map(u => u.id));
  return ITEM_DEFINITIONS.filter(def => {
    if (uniqueIds.has(def.id)) return false;
    if (def.family !== 'equipment' && def.family !== 'charm') return false;
    if (!def.rollKeys.length) return false;
    // Soulbound ordinaries are quest and collection rewards — the Basalt Edge,
    // the Keeper's Signet, the Sealed Codex Page. Handing them out for Gold
    // would undo the only thing that made them worth earning.
    if (def.soulbound) return false;
    return true;
  });
}

/**
 * Open one box.
 *
 * Three samples, in this order and no other: the rarity (or the guarantee), then
 * whether it is a named object, then which one. Sampling the item before the
 * rarity would mean a box whose pool happens to be empty at the top rung
 * silently re-rolls the rarity down, which is the sort of bug that only shows up
 * as "the Void Cache feels wrong" months later.
 *
 * Returns null only when no definition exists to hand out at all, which is a
 * catalogue error rather than a game outcome — the caller must not charge.
 */
export function rollBox(
  box: MysteryBox,
  state: PityState,
  rng: () => number = Math.random,
): BoxResult | null {
  const window = boxWindow(box);
  const armed = pityArmed(state, box.id) && window.length > 1;

  // The guarantee removes the floor from the window and re-weights what is left,
  // rather than jumping straight to the ceiling: "guaranteed better" should not
  // quietly mean "guaranteed best", or the optimal play becomes farming pity.
  const pool = armed ? window.slice(1) : window;
  const weights = pool.map((_, step) => Math.pow(RARITY_STEP_WEIGHT, armed ? step + 1 : step));
  const total = weights.reduce((sum, w) => sum + w, 0);

  let ticket = rng() * total;
  let rarity = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    ticket -= weights[i];
    if (ticket <= 0) { rarity = pool[i]; break; }
  }

  const uniques = uniquesAtRarity(rarity);
  if (uniques.length && rng() < UNIQUE_CHANCE) {
    const pick = uniques[Math.min(uniques.length - 1, Math.floor(rng() * uniques.length))];
    return { rarity, definitionId: pick.id, unique: true, pityApplied: armed };
  }

  const ordinary = boxPool(rarity);
  if (!ordinary.length) {
    // No ordinary at this rung: fall back to a unique rather than returning
    // nothing, because the player has already been told what they are buying.
    if (!uniques.length) return null;
    const pick = uniques[Math.min(uniques.length - 1, Math.floor(rng() * uniques.length))];
    return { rarity, definitionId: pick.id, unique: true, pityApplied: armed };
  }
  const pick = ordinary[Math.min(ordinary.length - 1, Math.floor(rng() * ordinary.length))];
  return { rarity, definitionId: pick.id, unique: false, pityApplied: armed };
}

/** The counter after an open. Floor result increments; anything better resets. */
export function advancePity(state: PityState, box: MysteryBox, got: ItemRarity): PityState {
  const onFloor = got === box.minRarity;
  return { ...state, [box.id]: onFloor ? pityFor(state, box.id) + 1 : 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// The sink check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expected Gold back if a player opened this box and immediately sold the item.
 *
 * Used by the spec to hold the line described in the header: this must stay
 * below `box.cost` for every box. It reads the *average* grade multiplier
 * (`SELL_QUALITY_FLOOR + mid × SELL_QUALITY_SPAN`) rather than the best case,
 * because a sink that only breaks even on a dud is not a sink.
 *
 * Charm stickers are ignored — they price off the rune ladder and are far
 * higher, but charms are a small slice of any box's pool and including them
 * would let one outlier claim the whole table is broken. The number this returns
 * is the equipment case, which is what the ladder was tuned against.
 */
export function boxScrapExpectation(box: MysteryBox): number {
  const avgGrade = SELL_QUALITY_FLOOR + 0.5 * SELL_QUALITY_SPAN;
  return boxOdds(box).reduce(
    (sum, row) => sum + row.chance * (EQUIPMENT_SCRAP[row.rarity] ?? 0) * avgGrade,
    0,
  );
}
