/**
 * socket-words.spec.ts — the catalogue's own consistency, and the match rule.
 *
 * A word that cannot be assembled is worse than no word: it is a clue the
 * player will keep trying. So the catalogue is checked against the socket
 * ladder it has to fit into, not only against itself.
 */
import { runeById } from '../rune-forge/rune.model';
import type { GameItem, ItemRarity } from '../rpg/item.model';
import { SOCKET_WORDS, matchSocketWord, wordTier, wornStats } from './socket-words';
import { MAX_SOCKETS, socketCountFor } from './socket.model';

function item(over: Partial<GameItem> = {}): GameItem {
  return {
    id: 'spec-item',
    name: 'Spec Blade',
    type: 'artifact',
    rarity: 'legendary',
    stats: {},
    sellValue: 0,
    equipped: true,
    slot: 'weapon',
    foundAt: new Date(0).toISOString(),
    soulbound: false,
    ...over,
  };
}

/** The cheapest rarity whose frame gives exactly `wells` wells, or null. */
function rarityWith(slot: 'weapon' | 'chest', wells: number): ItemRarity | null {
  const order: ItemRarity[] = [
    'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular',
  ];
  return order.find(r => socketCountFor(item({ slot, rarity: r })) === wells) ?? null;
}

describe('the Socket Word catalogue', () => {
  it('ships between ten and fifteen words', () => {
    expect(SOCKET_WORDS.length).toBeGreaterThanOrEqual(10);
    expect(SOCKET_WORDS.length).toBeLessThanOrEqual(15);
  });

  it('names only runes that exist', () => {
    for (const word of SOCKET_WORDS) {
      for (const id of word.runes) {
        expect(runeById(id)).withContext(`${word.id} wants ${id}`).toBeTruthy();
      }
    }
  });

  it('has unique ids and no two words with the same sequence and frame', () => {
    const ids = new Set(SOCKET_WORDS.map(w => w.id));
    expect(ids.size).toBe(SOCKET_WORDS.length);

    const shapes = SOCKET_WORDS.map(w => `${w.frame}:${w.runes.join('>')}`);
    // Two words with the same sequence in the same frame would make
    // `matchSocketWord` return whichever came first in the array, which is not
    // a rule anybody could reason about.
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('never asks for more wells than any piece can have', () => {
    for (const word of SOCKET_WORDS) {
      expect(word.runes.length).withContext(word.id).toBeGreaterThanOrEqual(1);
      expect(word.runes.length).withContext(word.id).toBeLessThanOrEqual(MAX_SOCKETS);
    }
  });

  it('fits every word into a frame that can actually hold it', () => {
    for (const word of SOCKET_WORDS) {
      const weapon = rarityWith('weapon', word.runes.length);
      const armor = rarityWith('chest', word.runes.length);
      const fits = word.frame === 'weapon' ? !!weapon
        : word.frame === 'armor' ? !!armor
        : !!weapon || !!armor;
      expect(fits)
        .withContext(`${word.id} needs ${word.runes.length} wells in ${word.frame}`)
        .toBe(true);
    }
  });

  it('gives every word a clue, and never puts its runes in it', () => {
    for (const word of SOCKET_WORDS) {
      expect(word.clue.length).withContext(word.id).toBeGreaterThan(10);
      for (const id of word.runes) {
        const name = runeById(id)!.name.toLowerCase();
        // A clue that names the rune is not a clue, it is the answer. The
        // Godforge Seal's clue may describe a Godstone; it may not say
        // "Godstone".
        expect(word.clue.toLowerCase().includes(name))
          .withContext(`${word.id} clue names ${name}`)
          .toBe(false);
      }
    }
  });

  it('derives its tier from the rarest rune it demands', () => {
    expect(wordTier(SOCKET_WORDS.find(w => w.id === 'cinderling')!)).toBe('common');
    expect(wordTier(SOCKET_WORDS.find(w => w.id === 'voidmark')!)).toBe('singular');
    expect(wordTier(SOCKET_WORDS.find(w => w.id === 'eclipse-blade')!)).toBe('legendary');
  });
});

describe('matching', () => {
  it('seats a word only when every well is full', () => {
    const partial = item({ rarity: 'legendary', sockets: ['eclipse', 'nox', null] });
    expect(matchSocketWord(partial)).toBeNull();

    const seated = item({ rarity: 'legendary', sockets: ['eclipse', 'nox', 'fracture'] });
    expect(matchSocketWord(seated)?.id).toBe('eclipse-blade');
  });

  it('is ordered — the same runes the other way round are not the word', () => {
    const reversed = item({ rarity: 'legendary', sockets: ['fracture', 'nox', 'eclipse'] });
    expect(matchSocketWord(reversed)).toBeNull();
  });

  it('will not let a spare well satisfy a shorter word', () => {
    // Ashwake is a two-well weapon word. A three-well Legendary carrying its
    // sequence plus an empty well is not carrying Ashwake.
    const three = item({ rarity: 'legendary', sockets: ['ash', 'ember', null] });
    expect(matchSocketWord(three)).toBeNull();

    const two = item({ rarity: 'rare', sockets: ['ash', 'ember'] });
    expect(matchSocketWord(two)?.id).toBe('ashwake');
  });

  it('respects the frame — an armour word does not seat in a weapon', () => {
    // Dustmark is Drift in one armour well.
    expect(matchSocketWord(item({ rarity: 'common', sockets: ['drift'] }))).toBeNull();
    expect(
      matchSocketWord(item({ slot: 'chest', rarity: 'common', sockets: ['drift'] }))?.id,
    ).toBe('dustmark');
  });
});

describe('effective stats', () => {
  it('adds the runes to the base roll', () => {
    const sword = item({ rarity: 'rare', stats: { goldPerSec: 10 }, sockets: ['ash', null] });
    // Ash is +1 Gold/sec at Common. No word — one well is empty.
    expect(wornStats(sword).goldPerSec).toBe(11);
  });

  it('multiplies the whole sum, not just the base roll', () => {
    // Eclipse Blade is ×1.5 and carries no flat stats of its own. Its three
    // runes are Magic Find (Eclipse, epic 7), Magic Find (Nox, legendary 12)
    // and Strike (Fracture, epic 3).
    const sword = item({
      rarity: 'legendary',
      stats: { goldPerSec: 100, magicFind: 10 },
      sockets: ['eclipse', 'nox', 'fracture'],
    });
    const worn = wornStats(sword);
    expect(matchSocketWord(sword)?.id).toBe('eclipse-blade');
    expect(worn.goldPerSec).toBe(150);
    expect(worn.magicFind).toBe((10 + 7 + 12) * 1.5);
    expect(worn.strikePower).toBe(3 * 1.5);
  });

  it('leaves an unsocketable piece exactly as it rolled', () => {
    const charm = item({ type: 'charm', slot: 'charm1', stats: { magicFind: 5 } });
    expect(wornStats(charm)).toEqual({ magicFind: 5 });
  });

  it('drops zeroes rather than printing them', () => {
    expect(wornStats(item({ rarity: 'common', stats: {} }))).toEqual({});
  });
});
