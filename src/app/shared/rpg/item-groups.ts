/**
 * item-groups.ts — one row per kind of thing in an item list (owner,
 * 2026-10-13: "so many of the same items, they should be stacked").
 *
 * Display only. Two instances share a row when they are mechanically
 * identical: same definition, name, type, rarity, sell value, soulbound flag,
 * the same rolled stats AND the same frozen roll grade, no temper or reforge
 * (not even a failed attempt), no rune set in a socket, and the same place.
 * Anything else keeps its own row. Nothing here writes or rewrites a record:
 * a grade is never recomputed (the memory note "item rolls carry a frozen
 * grade"), and each instance still takes its own slot.
 *
 * Variants of one definition that differ in rolls stay separate rows, but
 * `clusterBy` keeps them next to each other in whatever order the list sorts.
 */
import type { GameItem } from './item.model';

/** A stable string for a flat record of numbers, key order ignored. */
function canonical(record: object | undefined): string {
  if (!record) return '';
  return Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

/** Where it is: a group never spans two places. */
function placeOf(item: GameItem): string {
  if (item.equipped) return `worn:${item.slot ?? ''}`;
  return item.explorerId ? `held:${item.explorerId}` : 'bag';
}

/**
 * The key two instances must share to show as one row, or null when this
 * instance is one of a kind (worn, tempered, reforged, or holding a rune).
 */
export function groupKeyOf(item: GameItem): string | null {
  if (item.equipped) return null;
  if ((item.upgradeLevel ?? 0) > 0 || item.lastUpgradeAt || item.lastUpgradeMutationId) return null;
  if ((item.reforgeCount ?? 0) > 0 || item.lastReforgeAt || item.lastReforgeMutationId || item.lastReforgeLock) return null;
  if (item.sockets?.some(rune => rune != null)) return null;
  return [
    item.definitionId ?? '',
    item.name,
    item.type,
    item.rarity,
    item.sellValue,
    item.soulbound ? 1 : 0,
    canonical(item.stats),
    canonical(item.rollQuality),
    placeOf(item),
  ].join('|');
}

export interface ItemGroup {
  /** The group key, or `one:<id>` for a one-of-a-kind instance. */
  key: string;
  /** The member ids, sorted, so the group's first id is stable across renders. */
  ids: string[];
  /** The member that represents the group (the first id). */
  first: GameItem;
}

/**
 * Fold a list of instances into groups. Group order follows the first
 * appearance of each key in `items`; never mutates its input.
 */
export function groupItems(items: readonly GameItem[]): ItemGroup[] {
  const groups = new Map<string, GameItem[]>();
  for (const item of items) {
    const key = groupKeyOf(item) ?? `one:${item.id}`;
    const members = groups.get(key);
    if (members) members.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([key, members]) => {
    const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
    return { key, ids: sorted.map(item => item.id), first: sorted[0] };
  });
}

/** The family variants share: the definition, else the name. */
export function familyOf(item: GameItem): string {
  return item.definitionId || `name:${item.name}`;
}

/**
 * Keep rows of one family together without changing the list's order
 * otherwise: families appear where their first row sorted, and rows inside a
 * family keep their sorted order. Rows with no family (null) stay alone.
 */
export function clusterBy<T>(rows: readonly T[], family: (row: T) => string | null): T[] {
  const buckets = new Map<string, T[]>();
  const order: (T[])[] = [];
  for (const row of rows) {
    const key = family(row);
    if (key === null) { order.push([row]); continue; }
    const bucket = buckets.get(key);
    if (bucket) { bucket.push(row); continue; }
    const fresh = [row];
    buckets.set(key, fresh);
    order.push(fresh);
  }
  return order.flat();
}
