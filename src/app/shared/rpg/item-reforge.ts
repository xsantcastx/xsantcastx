/**
 * item-reforge.ts — the stat reroll, and what it costs.
 *
 * Temper (item-upgrade.ts) is the *additive* sink: it never re-rolls, it only
 * grows what is already there, and the base roll stays the item's identity
 * forever. Reforge is the other half — the sink for a player who got a Mythic
 * with a bad roll and has nothing to spend Gold on. It rerolls **every** stat
 * inside the item's own rarity band. It can come out worse. That is the point.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES NOT TOUCH
 * ─────────────────────────────────────────────────────────────────────────────
 * Rarity, definition, slot, sell value, soulbound — all untouched. A Reforge
 * never launders a Common into a Rare; it re-rolls inside the band the item
 * already has, which is why the cost ladder can climb so steeply without
 * becoming a rarity ladder in disguise.
 *
 * `upgradeLevel` is untouched too, and this is the part worth reading twice.
 * A tempered item's `stats` already *include* every temper bonus it has won,
 * so a naive "call rollItemStats and store it" would silently refund nothing
 * and destroy an arbitrary amount of Gold and Cinder Ore the player had
 * already sunk into the piece. Instead the reroll rebuilds the item from the
 * ground up: fresh base roll, then `applyTemperBonus` re-applied once per
 * level the item had already earned. The Keeper keeps their +7; what they
 * gambled is the roll underneath it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LOCK
 * ─────────────────────────────────────────────────────────────────────────────
 * Paying REFORGE_LOCK_MULTIPLIER× holds one stat at exactly its current value
 * and rerolls the rest. It is priced at a straight double rather than
 * something cleverer because the player has to be able to do the arithmetic in
 * their head at the moment they are deciding — and because on a two-key item
 * (which most equipment is) locking one key halves the randomness, so double
 * is already close to fair.
 *
 * A locked key is written back verbatim from the *pre-reforge* stats, after
 * the temper re-application, so locking survives temper exactly the way not
 * reforging at all would.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE SPEC'S §17 NON-GOAL DOES NOT BITE
 * ─────────────────────────────────────────────────────────────────────────────
 * The item roll/temper spec lists "re-roll scroll that replaces base identity
 * for gold" as an explicit non-goal, and the parallel-work brief C2 scoped the
 * sink to *one* stat plus a material. This is broader on the owner's explicit
 * instruction: all stats, gold only. The identity that §17 was protecting —
 * rarity, definition, provenance, temper level — is still frozen; what moves
 * is the roll inside the band, and it can move down. Recorded here rather than
 * in a commit message because the next person to read §17 will come looking.
 *
 * Pure. No Angular, no browser APIs, no storage — InventoryService is still
 * the only writer. Safe on an SSR path.
 */
import {
  definitionFor,
  rollItemStats,
  type ItemStatKey,
} from './item-definition';
import { applyTemperBonus, upgradeLevelOf } from './item-upgrade';
import {
  ITEM_STAT_KEYS,
  type GameItem,
  type ItemRarity,
  type ItemStats,
} from './item.model';

/**
 * Gold for one reroll, by the item's rarity. Roughly ×5 a rung, which is
 * steeper than the rarity drop rates fall — deliberately, so that rerolling a
 * Legendary is a decision a player saves up for rather than something they do
 * idly between strikes. Singular is not in the owner's brief; it extrapolates
 * the same ×5 step, and it is the only tier above Mythic.
 */
export const REFORGE_GOLD: Readonly<Record<ItemRarity, number>> = {
  common: 500,
  uncommon: 2_000,
  rare: 10_000,
  epic: 50_000,
  legendary: 200_000,
  mythic: 1_000_000,
  singular: 5_000_000,
};

/** Locking one stat doubles the bill. See the header for why it is a flat 2×. */
export const REFORGE_LOCK_MULTIPLIER = 2;

export interface ReforgePreview {
  /** Cost with nothing locked. */
  gold: number;
  /** Cost with one stat locked — `gold * REFORGE_LOCK_MULTIPLIER`. */
  lockedGold: number;
  rarity: ItemRarity;
  /** The keys a reroll will move, in ITEM_STAT_KEYS order. Never empty. */
  keys: ItemStatKey[];
  /** The item's stats as they stand — the "before" half of the comparison. */
  current: ItemStats;
  /** Temper levels the reroll will re-apply on top of the fresh base roll. */
  upgradeLevel: number;
}

/**
 * Which stats a reroll would move. Prefers the definition's authored
 * `rollKeys` — that is what `rollItemStats` will actually fill — and falls
 * back to whatever the instance carries, so a pre-catalogue save still shows
 * an honest list instead of an empty one.
 */
export function reforgeKeys(item: GameItem): ItemStatKey[] {
  const def = definitionFor(item);
  const keys = def?.rollKeys?.length
    ? [...def.rollKeys]
    : (Object.keys(item.stats ?? {}) as ItemStatKey[]);
  // ITEM_STAT_KEYS order, so the panel's before/after rows never reshuffle.
  return ITEM_STAT_KEYS.filter(key => keys.includes(key));
}

/**
 * True when a reroll is meaningful. An item with no rolled stats — a material,
 * a quest object, a rune — has nothing to reforge, and charging for a no-op
 * is the kind of thing players rightly call a scam.
 *
 * Soulbound is *not* a bar: an artifact you can never sell is exactly the
 * thing worth perfecting.
 */
export function canReforgeItem(item: GameItem): boolean {
  return reforgeKeys(item).length > 0;
}

export function reforgeGoldCost(rarity: ItemRarity, locked = false): number {
  const base = REFORGE_GOLD[rarity] ?? REFORGE_GOLD.common;
  return locked ? base * REFORGE_LOCK_MULTIPLIER : base;
}

export function previewReforge(item: GameItem): ReforgePreview | null {
  const keys = reforgeKeys(item);
  if (!keys.length) return null;
  const gold = reforgeGoldCost(item.rarity);
  return {
    gold,
    lockedGold: gold * REFORGE_LOCK_MULTIPLIER,
    rarity: item.rarity,
    keys,
    current: { ...item.stats },
    upgradeLevel: upgradeLevelOf(item),
  };
}

/**
 * The reroll itself.
 *
 * 1. Fresh base roll from the definition at the item's own rarity.
 * 2. `applyTemperBonus` once per level the item had already won, so a +7 piece
 *    comes back a +7 piece.
 * 3. The locked key, if any, written back at exactly its pre-reforge value.
 *
 * Returns the item's existing stats unchanged when there is nothing to roll or
 * no definition to roll from — the caller must not charge for that, and
 * `canReforgeItem` is how it knows.
 */
export function rollReforge(
  item: GameItem,
  lockedKey: ItemStatKey | null = null,
  rng: () => number = Math.random,
): ItemStats {
  const def = definitionFor(item);
  const keys = reforgeKeys(item);
  if (!def || !def.rollKeys.length || !keys.length) return { ...item.stats };

  let next = rollItemStats(def, item.rarity, rng);

  // Re-apply the temper the player already paid for. `applyTemperBonus` reads
  // an item, so it is fed the running stats each pass rather than the original.
  const levels = upgradeLevelOf(item);
  for (let i = 0; i < levels; i++) {
    next = applyTemperBonus({ ...item, stats: next }, rng);
  }

  if (lockedKey && keys.includes(lockedKey)) {
    const held = item.stats[lockedKey];
    if (held != null) next = { ...next, [lockedKey]: held };
    else delete (next as Record<string, unknown>)[lockedKey];
  }
  return next;
}

export interface ReforgeDelta {
  key: ItemStatKey;
  before: number;
  after: number;
  /** `after − before`, two decimals. Negative when the reroll went badly. */
  delta: number;
  locked: boolean;
}

/**
 * Every reforged key, in `ITEM_STAT_KEYS` order — including the ones that did
 * not move, and including the locked one. Unlike `temperDeltas` this does not
 * skip unchanged rows: after a reroll the player is owed a full accounting of
 * what they just gambled on, and "this stat came back identical" is a real
 * outcome worth seeing rather than a row to hide.
 */
export function reforgeDeltas(
  before: ItemStats,
  after: ItemStats,
  keys: readonly ItemStatKey[],
  lockedKey: ItemStatKey | null = null,
): ReforgeDelta[] {
  const rows: ReforgeDelta[] = [];
  for (const key of ITEM_STAT_KEYS) {
    if (!keys.includes(key)) continue;
    const a = before[key] ?? 0;
    const b = after[key] ?? 0;
    rows.push({
      key,
      before: a,
      after: b,
      delta: Math.round((b - a) * 100) / 100,
      locked: key === lockedKey,
    });
  }
  return rows;
}

/** Did the reroll come out ahead overall? Used only to pick the result's tone. */
export function reforgeVerdict(rows: readonly ReforgeDelta[]): 'better' | 'worse' | 'even' {
  // Stats are on wildly different scales (goldPerSec in whole numbers, magicFind
  // in hundredths), so a raw sum of deltas would let one key drown the rest.
  // Count the keys that moved instead — each stat gets one vote.
  let up = 0;
  let down = 0;
  for (const row of rows) {
    if (row.locked || row.delta === 0) continue;
    if (row.delta > 0) up++;
    else down++;
  }
  if (up > down) return 'better';
  if (down > up) return 'worse';
  return 'even';
}
