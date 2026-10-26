/**
 * socket-words.spec.ts — the runewords (docs/design/runewords.md): the catalogue's own consistency against the
 * socket ladder it has to fit, and the match rule (a normal base of the word's type, exactly its wells, in order).
 */
import { runeById } from '../rune-forge/rune.model';
import type { GameItem } from '../rpg/item.model';
import { itemBase } from '../rpg/item-base';
import { ITEM_DEFINITIONS, itemDefinitionById } from '../rpg/item-definition';
import { SOCKET_WORDS, matchSocketWord, wordTier, wordsForBase, wornStats } from './socket-words';
import { MAX_SOCKETS, maxSocketsFor } from './socket.model';

function item(over: Partial<GameItem> = {}): GameItem {
  return {
    id: 'spec-item',
    name: 'Eclipse Longblade',
    type: 'artifact',
    rarity: 'common',
    stats: {},
    sellValue: 0,
    equipped: false,
    definitionId: 'eclipse-longblade',
    foundAt: new Date(0).toISOString(),
    soulbound: false,
    ...over,
  };
}

const staff = (sockets: (string | null)[], over: Partial<GameItem> = {}) =>
  item({ id: 'spec-staff', name: 'Keeper Staff', definitionId: 'keeper-staff', sockets, ...over });

describe('the runeword catalogue', () => {
  it('ships twelve to twenty words', () => {
    expect(SOCKET_WORDS.length).toBeGreaterThanOrEqual(12);
    expect(SOCKET_WORDS.length).toBeLessThanOrEqual(20);
  });

  it('names only runes that exist', () => {
    for (const w of SOCKET_WORDS) for (const id of w.runes) expect(runeById(id)).withContext(`${w.id} -> ${id}`).toBeTruthy();
  });

  it('has unique ids, and no two words share a rune sequence on a shared base', () => {
    expect(new Set(SOCKET_WORDS.map(w => w.id)).size).toBe(SOCKET_WORDS.length);
    for (const a of SOCKET_WORDS) for (const b of SOCKET_WORDS) {
      if (a === b || a.runes.join() !== b.runes.join()) continue;
      expect(a.bases.some(x => b.bases.includes(x))).withContext(`${a.id} / ${b.id}`).toBe(false);
    }
  });

  it('fits every word into a base that can hold that many wells, and a base of that type exists', () => {
    for (const w of SOCKET_WORDS) {
      expect(w.runes.length).toBeLessThanOrEqual(MAX_SOCKETS);
      expect(w.bases.some(b => maxSocketsFor(b, 99) >= w.runes.length)).withContext(w.id).toBe(true);
      expect(w.bases.some(b => ITEM_DEFINITIONS.some(d => d.family === 'equipment' && itemBase({ definitionId: d.id, name: d.name, type: d.type }) === b)))
        .withContext(`${w.id}: no base of ${w.bases.join('/')}`).toBe(true);
    }
  });

  it('gives every word stats, a lore line and a clue that never spells the runes', () => {
    for (const w of SOCKET_WORDS) {
      expect(Object.keys(w.stats).length).withContext(w.id).toBeGreaterThan(0);
      expect(w.lore.length).withContext(w.id).toBeGreaterThan(20);
      for (const id of w.runes) expect(w.clue.toLowerCase().includes(runeById(id)!.name.toLowerCase())).withContext(`${w.id} clue says ${id}`).toBe(false);
    }
  });

  it('derives its tier from the rarest rune it demands', () => {
    expect(wordTier(SOCKET_WORDS.find(w => w.id === 'cinderling')!)).toBe('common');
    expect(wordTier(SOCKET_WORDS.find(w => w.id === 'voidmark')!)).toBe('singular');
  });

  it('keeps the Void for Hell: the only word that asks for it is Voidmark', () => {
    expect(SOCKET_WORDS.filter(w => w.runes.includes('void')).map(w => w.id)).toEqual(['voidmark']);
  });
});

describe('matching', () => {
  it('makes Ashwake from Ember then Drift in a two-well normal staff', () => {
    expect(itemDefinitionById('keeper-staff')).toBeTruthy();
    expect(matchSocketWord(staff(['ember', 'drift']))?.id).toBe('ashwake');
  });

  it('is ordered: the same runes the other way round are not the word', () => {
    expect(matchSocketWord(staff(['drift', 'ember']))).toBeNull();
  });

  it('seats a word only when every well is full', () => {
    expect(matchSocketWord(staff(['ember', null]))).toBeNull();
  });

  it('will not let a spare well satisfy a shorter word', () => {
    expect(matchSocketWord(staff(['ember', 'drift', null]))).toBeNull();
  });

  it('needs a normal (white) base: a magic staff with the same runes spells nothing', () => {
    expect(matchSocketWord(staff(['ember', 'drift'], { rarity: 'uncommon' }))).toBeNull();
  });

  it('respects the base type: a blade word does not seat in a staff', () => {
    expect(matchSocketWord(item({ sockets: ['ember', 'ash'] }))?.id).toBe('cinderling');
    expect(matchSocketWord(staff(['ember', 'ash']))).toBeNull();
  });

  it('lists the words a base can hold', () => {
    expect(wordsForBase('staff').map(w => w.id)).toContain('ashwake');
    expect(wordsForBase('staff', 2).every(w => w.runes.length === 2)).toBe(true);
    expect(wordsForBase(null)).toEqual([]);
  });
});

describe('what a runeword pays', () => {
  it('adds the runes and the word\'s fixed stats to the base roll', () => {
    const worn = wornStats(staff(['ember', 'drift'], { stats: { spellDamage: 5 } }));
    // Ashwake: +20% spell damage on the 5 rolled; Ember adds +1 Strike, Drift +1 Magic Find.
    expect(worn.spellDamage).toBe(25);
    expect(worn.strikePower).toBe(1);
    expect(worn.magicFind).toBe(1);
    expect(worn.castSpeed).toBe(8);
  });

  it('adds only the runes when the wells spell no word', () => {
    expect(wornStats(staff(['ash', null], { stats: { goldFind: 10 } })).goldFind).toBe(11);
  });

  it('leaves an unsocketable piece exactly as it rolled, and drops zeroes', () => {
    expect(wornStats(item({ type: 'charm', slot: 'charm1', stats: { magicFind: 5 } }))).toEqual({ magicFind: 5 });
    expect(wornStats(item({ stats: {} }))).toEqual({});
  });
});
