import { clusterBy, familyOf, groupItems, groupKeyOf } from './item-groups';
import type { GameItem } from './item.model';

function piece(id: string, over: Partial<GameItem> = {}): GameItem {
  return {
    id, name: 'Ashen Helm', definitionId: 'artifact:ashen-helm', type: 'artifact', rarity: 'common',
    stats: { ward: 2 }, rollQuality: { ward: 0.5 }, sellValue: 40, econ: 3, equipped: false,
    foundAt: '2026-10-01T00:00:00.000Z', soulbound: false, ...over,
  };
}

describe('item-groups', () => {
  it('identical pieces share one group; the found time and id do not split them', () => {
    const items = [piece('b', { foundAt: '2026-10-02T00:00:00.000Z' }), piece('a'), piece('c')];
    const groups = groupItems(items);
    expect(groups.length).toBe(1);
    expect(groups[0].ids).toEqual(['a', 'b', 'c']);
    expect(groups[0].first.id).toBe('a');
  });

  it('stat key order does not matter, values do', () => {
    const a = piece('a', { stats: { ward: 2, goldPerSec: 1 }, rollQuality: { ward: 0.5, goldPerSec: 0.1 } });
    const b = piece('b', { stats: { goldPerSec: 1, ward: 2 }, rollQuality: { goldPerSec: 0.1, ward: 0.5 } });
    expect(groupKeyOf(a)).toBe(groupKeyOf(b));
  });

  const differ: [string, Partial<GameItem>][] = [
    ['a different roll', { stats: { ward: 3 } }],
    ['the same stats with a different frozen grade', { rollQuality: { ward: 0.51 } }],
    ['an ungraded piece beside a graded one', { rollQuality: undefined }],
    ['a different rarity', { rarity: 'rare' }],
    ['a different definition', { definitionId: 'artifact:other-helm' }],
    ['a different sell value', { sellValue: 41 }],
    ['soulbound', { soulbound: true }],
    ['a different place (the Vault)', { explorerId: 'vault:general-1' }],
  ];
  for (const [what, over] of differ) {
    it(`never merges ${what}`, () => {
      expect(groupItems([piece('a'), piece('b', over)]).length).toBe(2);
    });
  }

  const unique: [string, Partial<GameItem>][] = [
    ['a tempered piece', { upgradeLevel: 1 }],
    ['a failed temper attempt', { lastUpgradeAt: '2026-10-03T00:00:00.000Z', lastUpgradeOk: false }],
    ['a reforged piece', { reforgeCount: 1 }],
    ['a piece with a rune in a socket', { sockets: ['ash', null] }],
    ['a worn piece', { equipped: true, slot: 'head' }],
  ];
  for (const [what, over] of unique) {
    it(`keeps ${what} one of a kind, even beside its twin`, () => {
      expect(groupKeyOf(piece('a', over))).toBeNull();
      expect(groupItems([piece('a', over), piece('b', over)]).length).toBe(2);
    });
  }

  it('empty socket wells are the same as none', () => {
    expect(groupItems([piece('a', { sockets: [null, null] }), piece('b')]).length).toBe(1);
  });

  it('is display only: input records, stats and frozen grades are untouched', () => {
    const items = [piece('a'), piece('b'), piece('c', { rollQuality: { ward: 0.9 } })];
    const before = JSON.stringify(items);
    groupItems(items);
    clusterBy(items, familyOf);
    expect(JSON.stringify(items)).toBe(before);
    expect(items[2].rollQuality).toEqual({ ward: 0.9 });
  });

  it('variants of one definition sort side by side; everything else keeps its order', () => {
    const rows = [
      piece('1', { stats: { ward: 1 } }),
      piece('2', { definitionId: 'artifact:other', name: 'Other' }),
      piece('3', { stats: { ward: 5 } }),
      piece('4', { definitionId: 'artifact:other', name: 'Other', stats: { ward: 9 } }),
    ];
    expect(clusterBy(rows, familyOf).map(r => r.id)).toEqual(['1', '3', '2', '4']);
    expect(clusterBy([1, 2, 3], () => null)).toEqual([1, 2, 3]);
  });
});
