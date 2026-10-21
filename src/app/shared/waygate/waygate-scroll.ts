/**
 * waygate-scroll.ts — the Town Portal scroll (owner 2026-10-21, relaying the players: "town portals").
 *
 * A satchel stack (never an ItemDefinition: a definition fans out to four catalogues, and a scroll is a thing you
 * read, not a thing you wear or sell on), like the potions and the Basalt Blank. Reading one opens the same portal the
 * Common spell Waygate does (play/td/td-waygate.ts), with no mana, and spends the scroll only when the portal opened.
 *
 * Source: Edrin Kade's counter (the Material Vendor's Potions tab — the Seamworks' general vendor and potion seller),
 * priced on the hunt (economy-curve huntGold: SCROLL_SECONDS of a hunt at the Keeper's level), a Gold sink he never
 * buys back. Use: read from the satchel (the item card's Read). Lore: the Seam-Cant's *ul hesk vesh* in the Seamworks
 * scribes' hand.
 *
 * Pure. No Angular.
 */
import { huntGold } from '../economy/economy-curve';

export const WAYGATE_SCROLL_ID = 'waygate-scroll';
export const WAYGATE_SCROLL_NAME = 'Waygate Scroll';
/** Seconds of a hunt at the Keeper's level one scroll costs (a minute's walk home is worth more than this). */
export const SCROLL_SECONDS = 15;
export const SCROLL_MIN_PRICE = 8;

/** The scroll's price at a Keeper level (whole Gold, never below SCROLL_MIN_PRICE). */
export function waygateScrollPrice(level: number): number {
  return Math.max(SCROLL_MIN_PRICE, huntGold(Math.max(1, Math.floor(level || 1)), SCROLL_SECONDS));
}

/** Its Found in / sources / uses / lore (check-meaning.js and the item card). */
export const WAYGATE_SCROLL_MEANING = {
  sources: ['Edrin Kade sells it (Material Vendor, Potions tab), priced on the hunt'],
  foundIn: ['Seamworks: Edrin Kade\'s counter (the Material Vendor, Potions tab)'],
  uses: ['read from the satchel: opens a Waygate where you stand, to the nearest town hearth and back (no mana)'],
  lore: 'Three words in the Seamworks scribes\' hand, ul hesk vesh, pressed into rag paper with basalt dust. Read aloud, the seam opens just wide enough for one Keeper and the way home.',
} as const;
