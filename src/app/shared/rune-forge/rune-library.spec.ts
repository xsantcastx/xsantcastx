import { RUNEWORDS, runeById } from './rune.model';
import { filterCards, lockedMark, sortCards, type LibraryCard } from './rune-library';

function card(id: string, extra: Partial<LibraryCard> = {}): LibraryCard {
  const rune = runeById(id)!;
  return {
    rune,
    known: true,
    isNew: false,
    held: 1,
    foundAt: '2026-08-01T00:00:00.000Z',
    index: 0,
    ...extra,
  };
}

describe('rune library', () => {
  it('filters NEW and hides locked names from search', () => {
    const ash = card('ash', { isNew: true, index: 0 });
    const voidRune = card('void', { known: false, isNew: false, held: 0, foundAt: null, index: 24 });
    expect(filterCards([ash, voidRune], 'new', '', RUNEWORDS).map(c => c.rune.id)).toEqual(['ash']);
    expect(filterCards([voidRune], 'all', 'void', RUNEWORDS)).toEqual([]);
    expect(filterCards([ash, voidRune], 'all', 'ash', RUNEWORDS).map(c => c.rune.id)).toEqual(['ash']);
  });

  it('sorts by rarity then collection order', () => {
    const godstone = card('godstone', { index: 23 });
    const ash = card('ash', { index: 0 });
    const sorted = sortCards([godstone, ash], 'rarity');
    expect(sorted.map(c => c.rune.id)).toEqual(['ash', 'godstone']);
  });

  it('gives locked cards different marks', () => {
    expect(lockedMark(0)).not.toBe(lockedMark(1));
  });
});
