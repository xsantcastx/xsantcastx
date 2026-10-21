/**
 * lore.ts — the Keeper's lore log: pages of the world's history the player can read in the character sheet's Lore tab.
 *
 * Owner, 2026-10-21: "Add a spirit or ghost class somewhere in the lore log." The first page is the fifth calling, not
 * yet playable: the Wanewalkers, Keepers who walked into the eclipse and came back thin. The second is the Seam Eater,
 * the eclipse's world boss, and what it has to do with them. The Glass's locked fifth figure
 * by the fire (play/lobby) quotes the same page. Words live in lore.i18n.ts (EN + ES); this file is the order and the ids.
 * Pure data: no Angular.
 */

export interface LorePage {
  id: string;
  /** i18n keys: the page's kicker (where it comes from), title and paragraphs. */
  kicker: string;
  title: string;
  body: readonly string[];
  /** A short line quoted where the page is teased (the Glass's locked figure). */
  quote?: string;
}

export const LORE_PAGES: readonly LorePage[] = [
  {
    id: 'wanewalkers',
    kicker: 'lore.wanewalkers.kicker',
    title: 'lore.wanewalkers.title',
    body: ['lore.wanewalkers.p1', 'lore.wanewalkers.p2', 'lore.wanewalkers.p3'],
    quote: 'lore.wanewalkers.quote',
  },
  {
    // The eclipse's world boss (play/td/td-seam.ts): what the Seam Eater is, and why the Wanewalkers walked toward it.
    id: 'seam-eater',
    kicker: 'lore.seamEater.kicker',
    title: 'lore.seamEater.title',
    body: ['lore.seamEater.p1', 'lore.seamEater.p2', 'lore.seamEater.p3'],
  },
];

export function lorePage(id: string): LorePage | undefined {
  return LORE_PAGES.find(p => p.id === id);
}
