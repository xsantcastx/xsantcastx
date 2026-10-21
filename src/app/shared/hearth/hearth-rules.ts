/**
 * hearth-rules.ts — The Cold Hearth and the five Hearth Blessings (docs/design/design-bible.md §5.8, roadmap §10 item 5).
 *
 * What a fall costs, as numbers. Pure: imports only the two import-free curves (the hunt's Gold, the Keeper's level),
 * so the economy sim loads this file as it is.
 *
 *   wake        at the last lit hearth (a capital's or a village's), never the square once one is lit
 *   purse       the difficulty's share of the carried Gold (5% Normal) is left where the Keeper fell (LootService.fall)
 *   Ember debt  10% of the XP the current level needs; while in debt, half of each kill's XP pays it off.
 *               Never a level lost, never an item, never a skill rank: the debt only slows the next level.
 *   grace       under level {@link HEARTH_GRACE_LEVEL} a fall costs nothing but the walk (the Rookgaard rule)
 *   blessings   five, bought with Gold at a capital's hearth shrine; each takes 20% off the purse share and the debt;
 *               all five = a fall costs only the walk. A fall that costs anything consumes them all (Tibia's blessings).
 *
 * Price: one minute of a steady hunt at the Keeper's own level (economy-curve huntGold), each. A full set is five
 * minutes, about what a fall at that level costs if it is never walked back (`economy-sim --hearth` holds the band).
 */
import { huntGold } from '../economy/economy-curve';
import { keeperLevelView } from '../skills/keeper-level';

/** Under this level a fall costs nothing but the walk. */
export const HEARTH_GRACE_LEVEL = 20;
/** The debt a fall leaves: this share of the XP the current level needs. */
export const DEBT_SHARE = 0.10;
/** While in debt, this share of each kill's XP pays it off (the rest is earned as usual). */
export const DEBT_PAYOFF = 0.5;
/** The most a debt can grow to, in levels' worth of XP (several falls in a row stop adding past it). */
export const DEBT_CAP_LEVELS = 1;
/** What one blessing takes off the purse share and the debt. Five = all of it. */
export const BLESSING_SHARE = 0.2;
/** One blessing's price: this many seconds of a steady hunt at the Keeper's level. */
export const BLESSING_SECONDS = 60;
/** No blessing costs less than this, whatever the level. */
export const BLESSING_MIN_PRICE = 50;

/** The five blessings, one per realm's fire (each realm keeps a fire for the Keeper). */
export const BLESSINGS = [
  { id: 'pyre', realm: 'infernal' },
  { id: 'root', realm: 'verdant' },
  { id: 'gloam', realm: 'umbral' },
  { id: 'meridian', realm: 'celestial' },
  { id: 'dawn', realm: 'luminous' },
] as const;
export type BlessingId = typeof BLESSINGS[number]['id'];
export const BLESSING_IDS: readonly BlessingId[] = BLESSINGS.map(b => b.id);

export function isBlessingId(v: unknown): v is BlessingId {
  return typeof v === 'string' && (BLESSING_IDS as readonly string[]).includes(v);
}

/** One blessing's price in Gold at `level`. */
export function blessingPrice(level: number): number {
  return Math.max(BLESSING_MIN_PRICE, huntGold(Math.max(1, Math.floor(level || 1)), BLESSING_SECONDS));
}

/** What is left of a fall's cost with `blessings` held: 1 with none, 0 with all five. */
export function fallScale(blessings: number): number {
  const n = Math.max(0, Math.min(BLESSINGS.length, Math.floor(blessings || 0)));
  return Math.max(0, 1 - n * BLESSING_SHARE);
}

/** Does a fall at this level cost anything at all? */
export function fallCosts(level: number): boolean {
  return Math.floor(level || 1) >= HEARTH_GRACE_LEVEL;
}

/** The largest a debt may be for a Keeper holding `xp` (one level's span; 0 at the top). */
export function debtCap(xp: number): number {
  return Math.floor(keeperLevelView(xp).span * DEBT_CAP_LEVELS);
}

/**
 * The Ember debt one fall adds for a Keeper holding `xp`, with `blessings` held: 10% of the XP the current level
 * needs, less 20% per blessing; nothing under the grace level. The new total never passes {@link debtCap}.
 */
export function fallDebt(xp: number, blessings: number, debt = 0): number {
  const view = keeperLevelView(xp);
  if (!fallCosts(view.level)) return 0;
  const add = Math.floor(view.span * DEBT_SHARE * fallScale(blessings));
  return Math.max(0, Math.min(add, debtCap(xp) - Math.max(0, debt)));
}

/** A kill's XP against the debt: what is earned, what pays the debt, and the debt left. */
export function payDebt(xp: number, debt: number): { earned: number; paid: number; debt: number } {
  const gain = Math.max(0, Math.floor(xp || 0));
  const owed = Math.max(0, Math.floor(debt || 0));
  const paid = Math.min(owed, Math.ceil(gain * DEBT_PAYOFF));
  return { earned: gain - paid, paid, debt: owed - paid };
}
