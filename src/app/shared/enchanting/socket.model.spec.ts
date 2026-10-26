/**
 * socket.model.spec.ts — sockets are the length of `GameItem.sockets` (rolled once, on a white drop), and what a rune
 * is worth in a well (docs/design/runewords.md §2).
 */
import { RUNES, RUNE_TIER_ORDER, runeById } from '../rune-forge/rune.model';
import { SOCKET_WORDS } from './socket-words';
import { ITEM_STAT_KEYS, LEGACY_STAT_KEYS, type GameItem } from '../rpg/item.model';
import { seededRandom } from '../loot/champions';
import {
  BASE_SOCKET_MAX,
  MAX_SOCKETS,
  SOCKET_CHANNEL,
  SOCKET_LADDER,
  emptySocketCount,
  firstEmptyWell,
  isFullySocketed,
  isSocketable,
  isSocketedNormal,
  maxSocketsFor,
  rollSockets,
  socketCapForLevel,
  socketCountFor,
  socketEffectOf,
  socketStats,
  socketedRunes,
  socketsOf,
} from './socket.model';

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

describe('socket counts', () => {
  it('reads the count off the array: no array, no sockets', () => {
    expect(socketCountFor(item())).toBe(0);
    expect(isSocketable(item())).toBe(false);
    expect(socketCountFor(item({ sockets: [null, null] }))).toBe(2);
    expect(socketsOf(item({ sockets: [null, null] }))).toEqual([null, null]);
  });

  it('keeps every rune an old save had set (a legacy socketed piece keeps its wells)', () => {
    const old = item({ rarity: 'legendary', sockets: ['ash', 'ember'] });
    expect(socketedRunes(old)).toEqual(['ash', 'ember']);
    expect(isFullySocketed(old)).toBe(true);
  });

  it('refuses charms and loose runes whatever they carry', () => {
    expect(socketCountFor(item({ type: 'charm', sockets: [null] }))).toBe(0);
    expect(socketCountFor(item({ type: 'rune', sockets: [null] }))).toBe(0);
  });

  it('fills left to right and reads a retired rune id as empty', () => {
    const it2 = item({ sockets: ['ash', 'not-a-rune', null] });
    expect(socketsOf(it2)).toEqual(['ash', null, null]);
    expect(firstEmptyWell(it2)).toBe(1);
    expect(emptySocketCount(it2)).toBe(2);
  });

  it('names a socketed white a socketed normal (grey), and a magic piece not', () => {
    expect(isSocketedNormal(item({ sockets: [null] }))).toBe(true);
    expect(isSocketedNormal(item({ rarity: 'rare', sockets: [null] }))).toBe(false);
    expect(isSocketedNormal(item())).toBe(false);
  });
});

describe('rolling sockets on a white drop (canon §6.2)', () => {
  it('caps by item level: 1–14 two, 15–29 three, 30+ four', () => {
    expect(socketCapForLevel(1)).toBe(2);
    expect(socketCapForLevel(14)).toBe(2);
    expect(socketCapForLevel(15)).toBe(3);
    expect(socketCapForLevel(29)).toBe(3);
    expect(socketCapForLevel(30)).toBe(4);
  });

  it('gives shields and staves one more, and never passes the base or MAX_SOCKETS', () => {
    expect(maxSocketsFor('shield', 10)).toBe(3);
    expect(maxSocketsFor('staff', 30)).toBe(5);
    expect(maxSocketsFor('dagger', 60)).toBe(2);
    expect(maxSocketsFor('ring', 60)).toBe(0);
    expect(maxSocketsFor('gloves', 60)).toBe(0);
    for (const [base, max] of Object.entries(BASE_SOCKET_MAX)) {
      expect(maxSocketsFor(base as never, 99)).withContext(base).toBeLessThanOrEqual(Math.min(max!, MAX_SOCKETS));
    }
  });

  it('rolls only on whites, in range, about a third of the time, and the same on the same seed', () => {
    const rng = seededRandom(7);
    let socketed = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const wells = rollSockets(item({ itemLevel: 10 }), rng);
      if (!wells) continue;
      socketed++;
      expect(wells.length).toBeGreaterThanOrEqual(1);
      expect(wells.length).toBeLessThanOrEqual(2);
      expect(wells.every(w => w === null)).toBe(true);
    }
    expect(socketed / N).toBeGreaterThan(0.28);
    expect(socketed / N).toBeLessThan(0.40);
    expect(rollSockets(item({ rarity: 'rare', itemLevel: 40 }), () => 0)).toBeNull();
    const a = rollSockets(item({ itemLevel: 40 }), seededRandom(99));
    const b = rollSockets(item({ itemLevel: 40 }), seededRandom(99));
    expect(a).toEqual(b);
  });

  it('never sockets a tool or a ring', () => {
    expect(rollSockets(item({ definitionId: 'axe-1', id: 'axe-1', name: 'Axe' }), () => 0)).toBeNull();
    expect(rollSockets(item({ definitionId: 'anchor-ring', name: 'Anchor Ring' }), () => 0)).toBeNull();
  });
});

describe('socket effects', () => {
  it('folds the old loot-quality runes into Magic Find (meaning audit #5)', () => {
    expect(ITEM_STAT_KEYS as string[]).not.toContain('lootBonus');
    expect(SOCKET_CHANNEL['codex']).toBe('magicFind');
  });

  it('channels only canon runes: Mote, Seam and Ledger are gone (meaning audit #12)', () => {
    for (const id of ['mote', 'seam', 'ledger']) expect(SOCKET_CHANNEL[id]).withContext(id).toBeUndefined();
    for (const word of SOCKET_WORDS) for (const id of word.runes) expect(runeById(id)).withContext(`${word.id} -> ${id}`).toBeTruthy();
  });

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
    for (const key of LEGACY_STAT_KEYS) {
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
    for (const key of LEGACY_STAT_KEYS) {
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
    const sword = item({ slot: 'weapon', sockets: ['ash', null, 'ash'] });
    // Two Commons on the Gold Find channel: 1 + 1.
    expect(socketStats(sword).goldFind).toBe(2);
    expect(socketStats(sword).magicFind).toBeUndefined();
  });

});
