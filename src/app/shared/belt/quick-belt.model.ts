/**
 * quick-belt.model.ts — what a stack does from the belt (docs/design/verb-matrix.md, "Belt / hotkey").
 *
 * Owner rule (2026-11-02, the cooked fish that would not go on a hotkey): every usable stack goes on the belt the same
 * way and does from there exactly what its card's one action does — a potion is drunk, a meal eaten, a raw fish cooked
 * at the fire in reach, a Town Portal scroll read, a log lit at the Keeper's feet, a crate opened. Anything without a
 * use (materials, runes, bait, the Tinderbox) has no hotkey: its card offers none and the slot refuses it.
 *
 * The table is data: the verb-matrix spec (quick-belt.spec.ts) walks every kind of the matrix through it.
 */
import { POTIONS, potionById } from '../potions/potions.model';
import { BURNT_FISH_ID, LOGS, MEALS, TINDERBOX_ID, WORLD_FISH, logById, mealById, mealOfRaw, worldFishById } from '../gathering/gathering.model';
import { WAYGATE_SCROLL_ID } from '../waygate/waygate-scroll';
import { BAITS, CRATE_IDS } from '../fishing/fishing.model';

export type BeltUse = 'drink' | 'eat' | 'cook' | 'read' | 'light' | 'open';
export const BELT_USES: readonly BeltUse[] = ['drink', 'eat', 'cook', 'read', 'light', 'open'];

/** What a stack does from a hotkey, or null when it has no use there. */
export function beltUseOf(stackKey: string | null | undefined): BeltUse | null {
  if (!stackKey) return null;
  if (potionById(stackKey)) return 'drink';
  if (mealById(stackKey)) return 'eat';
  if (worldFishById(stackKey) && mealOfRaw(stackKey)) return 'cook';
  if (stackKey === WAYGATE_SCROLL_ID) return 'read';
  if (logById(stackKey)) return 'light';
  if (CRATE_IDS.includes(stackKey)) return 'open';
  return null;
}

/** One item hotkey as the HUD draws it. `count` 0 with a `stackKey`: greyed, waiting for more of that kind. */
export interface QuickSlot {
  i: number;
  /** The keymap action (`quick1`…) and its keycap. */
  action: string; key: string;
  stackKey: string | null;
  use: BeltUse | null;
  count: number;
  art: string;
  name: string;
}

/**
 * The verb matrix's "Belt / hotkey" column as data (docs/design/verb-matrix.md): each stack kind, every id of it, and
 * what its hotkey does (null: the kind has no use from the belt, its card offers no hotkey). quick-belt.spec.ts walks
 * every row: a "should work" row must go on a slot, show its count, grey at none and fill again.
 */
export interface BeltMatrixRow { kind: string; ids: readonly string[]; use: BeltUse | null }
export const BELT_MATRIX: readonly BeltMatrixRow[] = [
  { kind: 'Potions', ids: POTIONS.map(p => p.id), use: 'drink' },
  { kind: 'Food / meals', ids: MEALS.map(m => m.id), use: 'eat' },
  { kind: 'Raw fish', ids: WORLD_FISH.filter(f => mealOfRaw(f.id)).map(f => f.id), use: 'cook' },
  { kind: 'Logs', ids: LOGS.map(l => l.id), use: 'light' },
  { kind: 'Town Portal scrolls', ids: [WAYGATE_SCROLL_ID], use: 'read' },
  { kind: 'Crates', ids: CRATE_IDS, use: 'open' },
  { kind: 'Materials, bait, tools', ids: [BURNT_FISH_ID, TINDERBOX_ID, 'cinder-ore', 'basalt-blank', ...BAITS.map(b => b.id)], use: null },
  { kind: 'Runes', ids: ['rune-ash', 'rune-ember'], use: null },
];
