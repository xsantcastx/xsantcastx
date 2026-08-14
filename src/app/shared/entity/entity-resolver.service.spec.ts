import { TestBed } from '@angular/core/testing';

import { TranslationService } from '../../translation.service';
import { InventoryService } from '../rpg/inventory.service';
import { EntityResolver, slugifyThreat } from './entity-resolver.service';

describe('EntityResolver', () => {
  let resolver: EntityResolver;
  let i18n: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EntityResolver,
        TranslationService,
        { provide: InventoryService, useValue: { snapshot: { items: [] } } },
      ],
    });
    resolver = TestBed.inject(EntityResolver);
    i18n = TestBed.inject(TranslationService);
    i18n.setLanguage('en');
  });

  it('resolves existing market listings, runes, realms, quests, and creatures', () => {
    expect(resolver.resolve({ type: 'market-listing', id: 'forge-bellows' }).state).toBe('ready');
    expect(resolver.resolve({ type: 'market-listing', id: 'obsidian-heart' }).presentation?.name)
      .toBe('Obsidian Heart');
    expect(resolver.resolve({ type: 'rune', id: 'ash' }).presentation?.name).toBe('Ash');
    expect(resolver.resolve({ type: 'runeword', id: 'first-light' }).presentation?.facts
      .some(fact => fact.exactValue?.includes('ash'))).toBeTrue();
    expect(resolver.resolve({ type: 'realm', id: 'luminous' }).presentation?.name).toBe('Luminous');
    expect(resolver.resolve({ type: 'quest', id: 'forge-three-shadows' }).state).toBe('ready');
    expect(resolver.resolve({ type: 'creature', id: slugifyThreat('The Pale Refrain') }).presentation?.name)
      .toBe('The Pale Refrain');
  });

  it('returns missing for unknown ids without inventing records', () => {
    const miss = resolver.resolve({ type: 'item', id: 'no-such-item' });
    expect(miss.state).toBe('missing');
    expect(miss.retryable).toBeFalse();
    expect(resolver.resolve({ type: 'zone', id: 'anywhere' }).state).toBe('missing');
    expect(resolver.resolve({ type: 'character', id: 'anyone' }).state).toBe('missing');
  });

  it('exposes exact values alongside compact display', () => {
    const listing = resolver.resolve({ type: 'market-listing', id: 'the-first-sun' });
    const price = listing.presentation?.facts.find(fact => fact.label === 'Price');
    expect(price?.exactValue).toContain('10,000,000');
    expect(price?.value).toContain('10M');
  });

  it('translates kind labels without rewriting lore', () => {
    i18n.setLanguage('es');
    const rune = resolver.resolve({ type: 'rune', id: 'ash' });
    expect(rune.presentation?.kindLabel).toBe('Runa');
    expect(rune.presentation?.lore).toContain('First Sun');
    expect(JSON.stringify(rune)).not.toMatch(/bubble/i);
  });

  it('does not offer buy, sell, or equip actions', () => {
    const listing = resolver.resolve({ type: 'market-listing', id: 'iron-hammer' });
    expect(listing.actions.some(action => ['buy', 'sell', 'equip'].includes(action.id))).toBeFalse();
  });
});
