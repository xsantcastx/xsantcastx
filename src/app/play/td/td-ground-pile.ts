/**
 * td-ground-pile.ts — piles on the ground, RuneScape-style (owner 2026-10-26: "we need to be able to pile items in one
 * tile with no problem, like RuneScape").
 *
 * Pure. Any number of things may lie on one tile, solo and online: a creature's loot, a Keeper's own drops, the room's
 * ground. A tile's things are one pile: drawn with a count, listed by a right-click (desktop) or a long-press or tap
 * (phone), taken one by one or all at once. Nothing here moves a thing; it only groups what lies where.
 */
import { TILE } from './td-art';

export interface Lying { id: string; x: number; y: number; coins: number }

/** The tile a thing lies on, as a key. */
export function tileKey(x: number, y: number): string { return `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`; }

/** The centre of the tile under a point (where a Keeper's own drop lands). */
export function tileCentre(x: number, y: number): { x: number; y: number } {
  return { x: Math.floor(x / TILE) * TILE + TILE / 2, y: Math.floor(y / TILE) * TILE + TILE / 2 };
}

/** Everything on the ground grouped by tile, each pile in the order it was laid (oldest first). */
export function pilesOf<T extends Lying>(things: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const g of things) {
    const k = tileKey(g.x, g.y);
    const list = out.get(k);
    if (list) list.push(g); else out.set(k, [g]);
  }
  return out;
}

/**
 * Where the n-th thing laid on a tile sits inside it, so a pile reads as a heap and not one sprite: a little to each
 * side, then a row up. Never leaves the tile.
 */
export function heapOffset(n: number): { dx: number; dy: number } {
  const col = [0, -4, 4, -2, 2][n % 5];
  const row = Math.floor(n / 5) % 3;
  return { dx: col, dy: -row * 2 };
}

/**
 * The pile under a point: the thing nearest the point within `slop` art px (its body sits a little above its foot),
 * and everything else on its tile. Empty when nothing is near.
 */
export function pileAt<T extends Lying>(things: readonly T[], wx: number, wy: number, slop = 12): T[] {
  let best: T | null = null, bd = Infinity;
  for (const g of things) {
    if (Math.abs(wx - g.x) > slop || wy < g.y - slop - 8 || wy > g.y + slop) continue;
    const d = Math.hypot(wx - g.x, wy - (g.y - 4));
    if (d < bd) { bd = d; best = g; }
  }
  if (!best) return [];
  const k = tileKey(best.x, best.y);
  return things.filter(g => tileKey(g.x, g.y) === k);
}

/** A pile's count as drawn on its badge (Gold counts as one thing). */
export function pileCount(pile: readonly Lying[]): number { return pile.length; }
