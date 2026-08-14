/**
 * market-query.ts — presentation-only Market discovery contract (C1).
 *
 * Pure functions. No Economy writes, no ownership mutations, no route table
 * changes. Query keys match the entity/Market spec section 4.
 */
import { EclipseRarity, RARITY_ORDER } from '../rarity/rarity.model';

export const MARKET_PAGE_SIZE = 8;

export const MARKET_CATEGORIES = [
  'forge', 'hammer', 'automaton', 'mastery', 'expedition', 'enchant', 'artifact', 'cosmetic',
] as const;

export type MarketCategoryId = typeof MARKET_CATEGORIES[number];
export type MarketCategory = 'all' | MarketCategoryId;
export type MarketOwnership = 'all' | 'available' | 'owned' | 'affordable';
export type MarketSort =
  | 'recommended'
  | 'name-asc'
  | 'rarity-desc'
  | 'price-asc'
  | 'price-desc'
  | 'owned-first';
export type MarketRarity = 'all' | EclipseRarity;

export interface MarketQuery {
  category: MarketCategory;
  rarity: MarketRarity;
  ownership: MarketOwnership;
  q: string;
  sort: MarketSort;
  page: number;
}

export interface MarketListingView {
  id: string;
  name: string;
  category: MarketCategoryId;
  categoryLabel: string;
  rarity: EclipseRarity;
  cost: number;
  currency: 'gold' | 'essence';
  owned: number;
  state: 'buy' | 'locked' | 'held' | 'owned' | 'running';
  haystack: string;
  catalogueIndex: number;
}

export const MARKET_QUERY_DEFAULTS: MarketQuery = {
  category: 'all',
  rarity: 'all',
  ownership: 'all',
  q: '',
  sort: 'recommended',
  page: 1,
};

const CATEGORY_SET = new Set<string>(MARKET_CATEGORIES);
const OWNERSHIP_SET = new Set<string>(['all', 'available', 'owned', 'affordable']);
const SORT_SET = new Set<string>([
  'recommended', 'name-asc', 'rarity-desc', 'price-asc', 'price-desc', 'owned-first',
]);
const RARITY_SET = new Set<string>(['all', ...RARITY_ORDER]);

export function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function parseMarketQuery(
  params: Record<string, string | null | undefined>,
): MarketQuery {
  const category = params['category'];
  const rarity = params['rarity'];
  const ownership = params['ownership'];
  const sort = params['sort'];
  const q = params['q'] ?? '';
  const pageRaw = Number(params['page']);
  return {
    category: category && CATEGORY_SET.has(category) ? category as MarketCategoryId : 'all',
    rarity: rarity && RARITY_SET.has(rarity) ? rarity as MarketRarity : 'all',
    ownership: ownership && OWNERSHIP_SET.has(ownership) ? ownership as MarketOwnership : 'all',
    q,
    sort: sort && SORT_SET.has(sort) ? sort as MarketSort : 'recommended',
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

/** Defaults serialize to null so they drop out of the URL. */
export function serializeMarketQuery(query: MarketQuery): Record<string, string | null> {
  return {
    category: query.category === 'all' ? null : query.category,
    rarity: query.rarity === 'all' ? null : query.rarity,
    ownership: query.ownership === 'all' ? null : query.ownership,
    q: query.q.trim() ? query.q : null,
    sort: query.sort === 'recommended' ? null : query.sort,
    page: query.page <= 1 ? null : String(query.page),
  };
}

export function isListingOwned(item: MarketListingView): boolean {
  return item.owned > 0 || item.state === 'held' || item.state === 'owned';
}

export function matchesOwnership(item: MarketListingView, ownership: MarketOwnership): boolean {
  if (ownership === 'all') return true;
  if (ownership === 'owned') return isListingOwned(item);
  if (ownership === 'available') return !isListingOwned(item);
  return item.state === 'buy';
}

export function filterMarketListings(
  items: readonly MarketListingView[],
  query: MarketQuery,
): MarketListingView[] {
  const needle = normalizeSearch(query.q.trim());
  return items.filter(item => {
    if (query.category !== 'all' && item.category !== query.category) return false;
    if (query.rarity !== 'all' && item.rarity !== query.rarity) return false;
    if (!matchesOwnership(item, query.ownership)) return false;
    if (needle && !item.haystack.includes(needle)) return false;
    return true;
  });
}

export function sortMarketListings(
  items: readonly MarketListingView[],
  sort: MarketSort,
): MarketListingView[] {
  const copy = items.slice();
  const rarityRank = (id: EclipseRarity) => RARITY_ORDER.indexOf(id);
  const currencyRank = (c: 'gold' | 'essence') => (c === 'gold' ? 0 : 1);
  copy.sort((a, b) => {
    switch (sort) {
      case 'name-asc':
        return a.name.localeCompare(b.name) || a.catalogueIndex - b.catalogueIndex;
      case 'rarity-desc':
        return rarityRank(b.rarity) - rarityRank(a.rarity) || a.catalogueIndex - b.catalogueIndex;
      case 'price-asc':
        return currencyRank(a.currency) - currencyRank(b.currency)
          || a.cost - b.cost
          || a.catalogueIndex - b.catalogueIndex;
      case 'price-desc':
        return currencyRank(a.currency) - currencyRank(b.currency)
          || b.cost - a.cost
          || a.catalogueIndex - b.catalogueIndex;
      case 'owned-first':
        return Number(isListingOwned(b)) - Number(isListingOwned(a))
          || a.catalogueIndex - b.catalogueIndex;
      default:
        return a.catalogueIndex - b.catalogueIndex;
    }
  });
  return copy;
}

export function pageMarketListings<T>(
  items: readonly T[],
  page: number,
  pageSize = MARKET_PAGE_SIZE,
): { page: number; totalPages: number; slice: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { page: safePage, totalPages, slice: items.slice(start, start + pageSize) };
}

export function discoverMarketListings(
  items: readonly MarketListingView[],
  query: MarketQuery,
): { items: MarketListingView[]; page: number; totalPages: number; count: number } {
  const filtered = sortMarketListings(filterMarketListings(items, query), query.sort);
  const paged = pageMarketListings(filtered, query.page);
  return { items: paged.slice, page: paged.page, totalPages: paged.totalPages, count: filtered.length };
}

/** After filtering, the URL page must be a real page of that result set. */
export function clampMarketQueryPage(query: MarketQuery, count: number): MarketQuery {
  const totalPages = Math.max(1, Math.ceil(count / MARKET_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), totalPages);
  return page === query.page ? query : { ...query, page };
}

export function queriesEqual(a: MarketQuery, b: MarketQuery): boolean {
  return a.category === b.category
    && a.rarity === b.rarity
    && a.ownership === b.ownership
    && a.q === b.q
    && a.sort === b.sort
    && a.page === b.page;
}

/** True when the URL carries defaults or values parseMarketQuery would drop. */
export function marketQueryNeedsNormalize(
  params: Record<string, string | null | undefined>,
): boolean {
  const parsed = parseMarketQuery(params);
  const expected = serializeMarketQuery(parsed);
  const keys = ['category', 'rarity', 'ownership', 'q', 'sort', 'page'] as const;
  return keys.some(key => {
    const have = params[key] ?? null;
    const want = expected[key];
    if (want === null) return !!have;
    return have !== want;
  });
}
