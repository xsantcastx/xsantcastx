/**
 * socket.model.spec.ts — the derived socket count, and what a rune is worth.
 *
 * The invariants worth pinning are the ones that would quietly change what
 * every save is holding: a rarity whose socket count moved, a rune whose
 * channel changed, and the padding rule that decides whether a retune eats
 * somebody's Mythic.
 */
import { RUNES, RUNE_TIER_ORDER, runeById } from '../rune-forge/rune.model';
import { ITEM_STAT_KEYS, type GameItem, type ItemRarity } from '../rpg/item.model';
import {
  MAX_SOCKETS,
  SOCKET_CHANNEL,
  SOCKET_LADDER,
  emptySocketCount,
  isFullySocketed,
  isSocketable,
  socketCountFor,
  socketEffectOf,
  socketFrameOf,
  socketStats,
  socketedRunes,
  socketsOf,
  unsocketCost,
} from './socket.model';

function item(over: Partial<GameItem> = {}): GameItem {
  return {
    id: 'spec-item',
    name: 'Spec Blade',
    type: 'artifact',
    rarity: 'rare',
    stats: {},
    sellValue: 0,
    equipped: true,
    slot: 'weapon',
    foundAt: new Date(0).toISOString(),
    soulbound: false,
    ...over,
  };
}

describe('socket counts', () => {
  it('gives a weapon one, two or three wells and never more', () => {
    for (const rarity of RUNE_TIER_ORDER) {
      const count = socketCountFor(item({ rarity: rarity as ItemRarity }));
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(MAX_SOCKETS);
    }
    expect(socketCountFor(item({ rarity: 'common' }))).toBe(1);
    expect(socketCountFor(item({ rarity: 'rare' }))).toBe(2);
    expect(socketCountFor(item({ rarity: 'legendary' }))).toBe(3);
  });

  it('caps armour at two, so the three-rune words stay weapon words', () => {
    for (const rarity of RUNE_TIER_ORDER) {
      const count = socketCountFor(item({ slot: 'chest', rarity: rarity as ItemRarity }));
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(2);
    }
    expect(socketCountFor(item({ slot: 'chest', rarity: 'rare' }))).toBe(1);
    expect(socketCountFor(item({ slot: 'chest', rarity: 'epic' }))).toBe(2);
  });

  it('refuses charms, loose runes and crafted Runewords', () => {
    expect(isSocketable(item({ type: 'charm', slot: 'charm1' }))).toBe(false);
    expect(isSocketable(item({ type: 'rune' }))).toBe(false);
    expect(isSocketable(item({ type: 'runeword' }))).toBe(false);
    expect(socketFrameOf(item({ type: 'charm', slot: 'charm1' }))).toBe('none');
  });

  it('refuses a piece with no slot at all, rather than guessing one', () => {
    expect(isSocketable(item({ slot: undefined, equipped: false }))).toBe(false);
  });

  it('reads a Legendary minted before sockets existed as three empty wells', () => {
    // The whole reason the count is derived. An old save carries no `sockets`
    // field and must not therefore carry no sockets.
    const old = item({ rarity: 'legendary', sockets: undefined });
    expect(socketsOf(old)).toEqual([null, null, null]);
    expect(emptySocketCount(old)).toBe(3);
    expect(isFullySocketed(old)).toBe(false);
  });

  it('truncates a longer stored array for reading without discarding it', () => {
    const shrunk = item({ rarity: 'common', sockets: ['ash', 'ember', 'void'] });
    expect(socketsOf(shrunk)).toEqual(['ash']);
    // The record itself is untouched, so raising the ladder back returns them.
    expect(shrunk.sockets).toEqual(['ash', 'ember', 'void']);
  });

  it('reads a retired rune id as an empty well rather than shifting the rest', () => {
    const stale = item({ rarity: 'legendary', sockets: ['ash', 'not-a-rune', 'ember'] });
    expect(socketsOf(stale)).toEqual(['ash', null, 'ember']);
    expect(socketedRunes(stale)).toEqual(['ash', 'ember']);
  });
});

describe('socket effects', () => {
  it('gives every rune in the registry a channel, or the Void treatment', () => {
    for (const rune of RUNES) {
      const effect = socketEffectOf(rune.id);
      const keys = ITEM_STAT_KEYS.filter(key => effect[key] !== undefined);
      expect(keys.length)
        .withContext(`${rune.id} contributes nothing in a socket`)
        .toBeGreaterThan(0);
    }
  });

  it('pays the Void on every channel, because it is the only rune that does', () => {
    const void_ = socketEffectOf('void');
    for (const key of ITEM_STAT_KEYS) {
      expect(void_[key]).toBe(SOCKET_LADDER[key].singular);
    }
    // Nothing else does. A second all-channel rune would make the ladder a lie.
    const others = RUNES.filter(r => r.id !== 'void');
    for (const rune of others) {
      const keys = ITEM_STAT_KEYS.filter(key => socketEffectOf(rune.id)[key] !== undefined);
      expect(keys.length).withContext(rune.id).toBe(1);
    }
  });

  it('climbs with the rune tier on every channel', () => {
    for (const key of ITEM_STAT_KEYS) {
      const ladder = SOCKET_LADDER[key];
      for (let i = 1; i < RUNE_TIER_ORDER.length; i++) {
        expect(ladder[RUNE_TIER_ORDER[i]])
          .withContext(`${key} at ${RUNE_TIER_ORDER[i]}`)
          .toBeGreaterThanOrEqual(ladder[RUNE_TIER_ORDER[i - 1]]);
      }
    }
  });

  it('names only runes that exist', () => {
    for (const id of Object.keys(SOCKET_CHANNEL)) {
      expect(runeById(id)).withContext(id).toBeTruthy();
    }
  });

  it('sums the wells and ignores the empty ones', () => {
    const sword = item({ rarity: 'legendary', sockets: ['ash', null, 'ash'] });
    // Two Commons on the Gold channel: 1 + 1.
    expect(socketStats(sword).goldPerSec).toBe(2);
    expect(socketStats(sword).magicFind).toBeUndefined();
  });

  it('prices an unsocket off the rune rather than off the item', () => {
    expect(unsocketCost('ash')).toBe(Math.ceil(runeById('ash')!.forgeCost * 0.25));
    expect(unsocketCost('void')).toBeGreaterThan(unsocketCost('godstone'));
    expect(unsocketCost('not-a-rune')).toBe(0);
  });
});
