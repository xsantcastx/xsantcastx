/**
 * verdant.ts — the Verdant underside's broken rule, as pure functions (the
 * engine runs them; scripts/realm-delves.test.cjs pins them). No DOM, no Angular.
 *
 * The rule (rift-gates.model.ts): DUG ROCK GROWS BACK. The Root Deeps are the
 * World-Root's own wood, and it is alive. Said once, plainly, the first time
 * it applies (the engine's telegraph lines):
 *
 *  1. Regrowth. A cell dug out of the realm's living wood (rootwood,
 *     heartwood, the ores in it, a heart-root, a spore pod) is filled again
 *     REGROW_DELAY seconds later. It creeps in visibly over the last
 *     REGROW_WARN seconds (roots reaching into the hole), never on top of the
 *     Keeper or a creature (it waits for them to step out), so it is never a
 *     trap: a tunnel closes behind you, not round you.
 *  2. What holds a tunnel open: fire (a placed light within BURN_CELLS burns
 *     the roots back), a support (a placed support within its own `support`
 *     reach, or anything placed right beside the hole), or a clean cut (the
 *     Rootsever Billhook, carried: what it digs is cut at the root).
 *  3. Ore does not come back as ore: a dug vein grows back as the wood round
 *     it. A heart-root and a spore pod come back as themselves (they are the
 *     root's living parts) and are never saved as gone.
 *  4. Living vines hang from the roofs: climb them like ladders.
 */
import { TERRAIN_NODE_LIST, type Terrain } from './terrain';

/** Seconds from a dig until the hole fills again. */
export const REGROW_DELAY = 18;
/** The last seconds of that, the roots visibly reach into the hole. */
export const REGROW_WARN = 6;
/** A placed light this close (Chebyshev, cells) burns the roots back: the hole stays open. */
export const BURN_CELLS = 2;
/** The Graftmother heals this much a second while a heart-root holds her, and takes only this share of a blow. */
export const GRAFT_HEAL = 14;
export const GRAFT_SHARE = .25;
/** Seconds between the Graftmother calling two graftlings out of the walls. */
export const GRAFT_CALL = 18;
export const SPORE_STING = 8;

/** The realm's living wood: what grows back, and what it grows back as (an ore grows back as the wood round it). */
const LIVING: Readonly<Record<string, string>> = {
  'rootwood': 'rootwood', 'heartwood': 'heartwood',
  'rootglass-vein': 'rootwood', 'heart-amber-vein': 'heartwood',
  'heart-root': 'heart-root', 'spore-pod': 'spore-pod',
};
/** Parts of the root that come back as themselves and are never saved as gone (session only). */
const ALIVE: ReadonlySet<string> = new Set(['heart-root', 'spore-pod']);

const BY_ID = new Map(TERRAIN_NODE_LIST.map((node, i) => [node.id, i]));
/** Node index → the node index it regrows as, or -1 (not living wood). */
const REGROW_AS = Int16Array.from(TERRAIN_NODE_LIST, node => {
  const as = LIVING[node.id];
  return as ? BY_ID.get(as) ?? -1 : -1;
});
const ALIVE_KIND = Uint8Array.from(TERRAIN_NODE_LIST, node => ALIVE.has(node.id) ? 1 : 0);
const PLACED_LIGHT = Uint8Array.from(TERRAIN_NODE_LIST, node => node.placeable && node.glow ? 1 : 0);
const PLACED = Uint8Array.from(TERRAIN_NODE_LIST, node => node.placeable ? 1 : 0);
const SUPPORT = Uint8Array.from(TERRAIN_NODE_LIST, node => node.support ?? 0);

/** What a dug cell of generated kind `base` grows back as (a node index), or -1 when it does not grow back. */
export function regrowsAs(base: number): number { return REGROW_AS[base] ?? -1; }
/** True for the root's living parts (a heart-root, a spore pod): they come back as themselves and are never saved as gone. */
export function isAlive(kind: number): boolean { return ALIVE_KIND[kind] === 1; }

/** A hole waiting to fill: world cell, when it was dug (realm seconds), and what fills it. */
export interface Regrowth { col: number; row: number; at: number; kind: number }

/** A numeric key for a world cell (columns run negative; the realm has under 64 rows). */
export function cellKey(col: number, row: number): number { return (col + 0x100000) * 64 + row; }

/**
 * Why a hole at (col, row) stays open, or null when the roots may fill it:
 * 'burnt' (a placed light within BURN_CELLS), 'held' (a placed support whose
 * reach covers it, or anything placed right beside it). Pure.
 */
export function heldOpen(t: Terrain, col: number, row: number): 'burnt' | 'held' | null {
  const reach = Math.max(BURN_CELLS, 5);
  for (let r = row - reach; r <= row + reach; r++) for (let c = col - reach; c <= col + reach; c++) {
    if (!t.inside(c, r)) continue;
    const k = t.kind[t.index(c, r)];
    if (!PLACED[k]) continue;
    const d = Math.max(Math.abs(c - col), Math.abs(r - row));
    if (PLACED_LIGHT[k] && d <= BURN_CELLS) return 'burnt';
    if ((SUPPORT[k] && d <= SUPPORT[k]) || d <= 1) return 'held';
  }
  return null;
}

/** How far a waiting hole has grown back, 0 (just dug) .. 1 (full), at realm second `now`. */
export function regrowProgress(g: Pick<Regrowth, 'at'>, now: number): number {
  return Math.max(0, Math.min(1, (now - g.at) / REGROW_DELAY));
}
/** True when the roots are visibly reaching in (the last REGROW_WARN seconds). */
export function reaching(g: Pick<Regrowth, 'at'>, now: number): boolean {
  return now - g.at >= REGROW_DELAY - REGROW_WARN;
}
