import { RARITY_ORDER } from '../rarity/rarity.model';
import {
  type MarketListingView,
  discoverMarketListings,
  marketQueryNeedsNormalize,
  normalizeSearch,
  pageMarketListings,
  parseMarketQuery,
  serializeMarketQuery,
} from './market-query';

function listing(partial: Partial<MarketListingView> & Pick<MarketListingView, 'id' | 'name'>): MarketListingView {
  return {
    category: 'forge',
    categoryLabel: 'Forge',
    rarity: 'mortal',
    cost: 100,
    currency: 'gold',
    owned: 0,
    state: 'buy',
    haystack: normalizeSearch(`${partial.name} Forge`),
    catalogueIndex: 0,
    ...partial,
  };
}

describe('Market query (C1 presentation)', () => {
  it('normalizes invalid query values to defaults', () => {
    const q = parseMarketQuery({
      category: 'eclipse',
      rarity: 'legendary',
      ownership: 'sellers',
      sort: 'hot',
      page: '0',
      q: 'bellows',
    });
    expect(q.category).toBe('all');
    expect(q.rarity).toBe('all');
    expect(q.ownership).toBe('all');
    expect(q.sort).toBe('recommended');
    expect(q.page).toBe(1);
    expect(q.q).toBe('bellows');
  });

  it('drops default keys from the serialized query', () => {
    expect(serializeMarketQuery(parseMarketQuery({}))).toEqual({
      category: null,
      rarity: null,
      ownership: null,
      q: null,
      sort: null,
      page: null,
    });
    expect(serializeMarketQuery(parseMarketQuery({ category: 'forge', page: '3' }))).toEqual({
      category: 'forge',
      rarity: null,
      ownership: null,
      q: null,
      sort: null,
      page: '3',
    });
  });

  it('folds accents for search', () => {
    expect(normalizeSearch('Orrery')).toBe(normalizeSearch('Orréry'));
    const items = [
      listing({ id: 'a', name: 'Meridian Orrery', haystack: normalizeSearch('Meridian Orrery landmark') }),
    ];
    expect(discoverMarketListings(items, parseMarketQuery({ q: 'orrery' })).count).toBe(1);
  });

  it('filters by category, rarity, and ownership without inventing rows', () => {
    const items = [
      listing({ id: 'g', name: 'Gold thing', category: 'forge', owned: 0, state: 'buy', catalogueIndex: 0 }),
      listing({ id: 'o', name: 'Owned thing', category: 'artifact', rarity: 'sacred', owned: 1, state: 'held', currency: 'essence', catalogueIndex: 1 }),
      listing({ id: 'l', name: 'Locked thing', category: 'hammer', owned: 0, state: 'locked', catalogueIndex: 2 }),
    ];
    expect(discoverMarketListings(items, parseMarketQuery({ category: 'artifact' })).items.map(i => i.id)).toEqual(['o']);
    expect(discoverMarketListings(items, parseMarketQuery({ ownership: 'owned' })).items.map(i => i.id)).toEqual(['o']);
    expect(discoverMarketListings(items, parseMarketQuery({ ownership: 'affordable' })).items.map(i => i.id)).toEqual(['g']);
    expect(discoverMarketListings(items, parseMarketQuery({ ownership: 'available' })).items.map(i => i.id)).toEqual(['g', 'l']);
  });

  it('sorts price by Gold then Essence, then amount', () => {
    const items = [
      listing({ id: 'e-hi', name: 'E high', cost: 500, currency: 'essence', catalogueIndex: 0 }),
      listing({ id: 'g-hi', name: 'G high', cost: 900, currency: 'gold', catalogueIndex: 1 }),
      listing({ id: 'g-lo', name: 'G low', cost: 50, currency: 'gold', catalogueIndex: 2 }),
      listing({ id: 'e-lo', name: 'E low', cost: 5, currency: 'essence', catalogueIndex: 3 }),
    ];
    expect(discoverMarketListings(items, parseMarketQuery({ sort: 'price-asc' })).items.map(i => i.id))
      .toEqual(['g-lo', 'g-hi', 'e-lo', 'e-hi']);
    expect(discoverMarketListings(items, parseMarketQuery({ sort: 'price-desc' })).items.map(i => i.id))
      .toEqual(['g-hi', 'g-lo', 'e-hi', 'e-lo']);
  });

  it('uses recommended as catalogue order and paginates deterministically', () => {
    const items = RARITY_ORDER.map((rarity, i) => listing({
      id: `i${i}`,
      name: `Item ${i}`,
      rarity,
      catalogueIndex: i,
    }));
    const page1 = discoverMarketListings(items, parseMarketQuery({ page: '1' }));
    expect(page1.totalPages).toBe(1);
    expect(page1.items.map(i => i.id)).toEqual(items.map(i => i.id).slice(0, 8));
    const many = Array.from({ length: 10 }, (_, i) => listing({ id: `n${i}`, name: `N${i}`, catalogueIndex: i }));
    const p2 = pageMarketListings(many, 2, 8);
    expect(p2.page).toBe(2);
    expect(p2.totalPages).toBe(2);
    expect(p2.slice.map(i => i.id)).toEqual(['n8', 'n9']);
  });

  it('never treats eclipse as a valid listing category', () => {
    expect(parseMarketQuery({ category: 'eclipse' }).category).toBe('all');
  });

  it('flags default and invalid URL values for normalization', () => {
    expect(marketQueryNeedsNormalize({})).toBe(false);
    expect(marketQueryNeedsNormalize({ category: 'eclipse', page: '0' })).toBe(true);
    expect(marketQueryNeedsNormalize({ sort: 'recommended', rarity: 'all' })).toBe(true);
    expect(marketQueryNeedsNormalize({ category: 'forge', page: '3' })).toBe(false);
  });
});
