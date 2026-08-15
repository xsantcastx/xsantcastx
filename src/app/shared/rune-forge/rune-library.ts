/**
 * rune-library.ts — filter and sort for the card album.
 */
import { RUNE_TIER_ORDER, type Rune, type RuneTier, type Runeword } from './rune.model';

export type LibraryFilter = 'all' | 'new' | RuneTier;
export type LibrarySort = 'rarity' | 'newest' | 'name' | 'collection';
export type LibraryTab = 'runes' | 'runewords' | 'equipment';

export const LIBRARY_FILTERS: readonly LibraryFilter[] = [
  'all', 'new', ...RUNE_TIER_ORDER,
];

export const LIBRARY_SORTS: readonly LibrarySort[] = [
  'rarity', 'newest', 'name', 'collection',
];

export interface LibraryCard {
  rune: Rune;
  known: boolean;
  isNew: boolean;
  held: number;
  foundAt: string | null;
  index: number;
}

export function wordsUsing(runeId: string, words: readonly Runeword[]): Runeword[] {
  return words.filter(word => word.runes.includes(runeId));
}

export function filterCards(
  cards: readonly LibraryCard[],
  filter: LibraryFilter,
  query: string,
  words: readonly Runeword[],
): LibraryCard[] {
  const q = query.trim().toLowerCase();
  return cards.filter(card => {
    if (filter === 'new' && !card.isNew) return false;
    if (filter !== 'all' && filter !== 'new' && card.rune.tier !== filter) return false;
    if (!q) return true;
    if (card.known && card.rune.name.toLowerCase().includes(q)) return true;
    if (card.rune.tier.includes(q)) return true;
    if (q === 'new' && card.isNew) return true;
    if ((q === 'locked' || q === 'unknown') && !card.known) return true;
    if ((q === 'found' || q === 'discovered') && card.known) return true;
    if (card.known) {
      for (const word of wordsUsing(card.rune.id, words)) {
        if (word.name.toLowerCase().includes(q) || word.id.includes(q)) return true;
      }
    }
    return false;
  });
}

export function sortCards(
  cards: readonly LibraryCard[],
  sort: LibrarySort,
): LibraryCard[] {
  const next = [...cards];
  next.sort((a, b) => {
    if (sort === 'name') {
      if (a.known !== b.known) return a.known ? -1 : 1;
      return a.rune.name.localeCompare(b.rune.name);
    }
    if (sort === 'newest') {
      const at = a.foundAt ? Date.parse(a.foundAt) : 0;
      const bt = b.foundAt ? Date.parse(b.foundAt) : 0;
      return bt - at || a.index - b.index;
    }
    if (sort === 'collection') return a.index - b.index;
    const tr = RUNE_TIER_ORDER.indexOf(a.rune.tier) - RUNE_TIER_ORDER.indexOf(b.rune.tier);
    if (tr !== 0) return tr;
    return a.index - b.index;
  });
  return next;
}

/** Locked cards get a stable silhouette without leaking the name. */
const MARKS = ['◈', '◇', '☽', 'ϟ', '✦', '✶', '⬡', '⟡', '☼', '☖'] as const;

export function lockedMark(index: number): string {
  return MARKS[Math.abs(index) % MARKS.length];
}
