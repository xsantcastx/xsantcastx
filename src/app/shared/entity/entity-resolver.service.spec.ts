import { TestBed } from '@angular/core/testing';

import { TranslationService } from '../../translation.service';
import { InventoryService } from '../rpg/inventory.service';
import { type GameItem } from '../rpg/item.model';
import { EntityResolver, slugifyThreat } from './entity-resolver.service';

function item(partial: Partial<GameItem> & Pick<GameItem, 'id' | 'name'>): GameItem {
  return {
    type: 'charm',
    rarity: 'rare',
    stats: {},
    sellValue: 10,
    equipped: false,
    foundAt: '2026-01-01T00:00:00.000Z',
    soulbound: false,
    ...partial,
  };
}

describe('EntityResolver', () => {
  let resolver: EntityResolver;
  let i18n: TranslationService;
  const items: GameItem[] = [
    item({ id: 'bag-1', name: 'Bag Charm' }),
    item({ id: 'worn-1', name: 'Worn Crown', equipped: true, slot: 'head', type: 'artifact', soulbound: true }),
    item({ id: 'held-1', name: 'Expedition Charm', explorerId: 'exp-7' }),
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EntityResolver,
        TranslationService,
        { provide: InventoryService, useValue: { snapshot: { items } } },
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

  it('resolves the locked Basalt Edge recipe without a craft action', () => {
    const recipe = resolver.resolve({ type: 'recipe', id: 'basalt-edge' });
    expect(recipe.state).toBe('ready');
    expect(recipe.presentation?.name).toBe('Basalt Edge');
    expect(recipe.presentation?.facts.some(fact => fact.exactValue?.includes('Cinder Ore'))).toBeTrue();
    expect(recipe.actions.some(action => action.id === 'craft')).toBeFalse();
  });

  it('does not offer buy, sell, or equip actions', () => {
    const listing = resolver.resolve({ type: 'market-listing', id: 'iron-hammer' });
    expect(listing.actions.some(action => ['buy', 'sell', 'equip'].includes(action.id))).toBeFalse();
  });

  it('distinguishes bag, player loadout, and explorer-held locations', () => {
    const bag = resolver.resolve({ type: 'item', id: 'bag-1' }).presentation?.facts
      .find(fact => fact.label === 'Location');
    const worn = resolver.resolve({ type: 'item', id: 'worn-1' }).presentation?.facts
      .find(fact => fact.label === 'Location');
    const held = resolver.resolve({ type: 'item', id: 'held-1' }).presentation?.facts
      .find(fact => fact.label === 'Location');
    expect(bag?.value).toBe('Bag');
    expect(bag?.exactValue).toBe('bag');
    expect(worn?.value).toBe('Loadout — head');
    expect(worn?.exactValue).toBe('head');
    expect(held?.value).toBe('Held by explorer');
    expect(held?.exactValue).toBe('exp-7');

    i18n.setLanguage('es');
    const heldEs = resolver.resolve({ type: 'item', id: 'held-1' }).presentation?.facts
      .find(fact => fact.exactValue === 'exp-7');
    expect(heldEs?.value).toBe('En manos de un explorador');
  });
});
