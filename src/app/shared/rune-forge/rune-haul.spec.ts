import { RUNE_TIERS } from './rune.model';
import { batchHaul, haulOf, isHeavyTier, tallyTiers, type HaulSource } from './rune-haul';

/** Untyped literals: the shapes the service writes, minus what the haul never reads. */
const item = (over: Record<string, unknown> = {}) => ({
  id: 'i1', name: 'Ash Sigil', type: 'artifact', rarity: 'rare',
  stats: { goldPerSec: 1.3, strikePower: 2 },
  sellValue: 0, equipped: false, foundAt: '2026-01-01T00:00:00.000Z', soulbound: false,
  ...over,
}) as any;

const scroll = (over: Record<string, unknown> = {}) => ({
  id: 's1', title: 'Fragment of the First Dawn, Part III', subtitle: 'The Sun That Dreamed',
  chapter: 'first-dawn', chapterName: 'The First Dawn', partNumber: 3, content: 'a\n\nb', rarity: 'epic',
  ...over,
}) as any;

const explorer = (over: Record<string, unknown> = {}) => ({
  id: 'x1', name: 'Vesper Quill', rarity: 'uncommon', hiredAt: '2026-01-01T00:00:00.000Z',
  equipment: [], missions: 0,
  ...over,
}) as any;

const empty = (): HaulSource => ({ item: null, scroll: null, explorer: null, essence: 0 });

describe('haulOf', () => {
  it('returns nothing for a bare rune find', () => {
    expect(haulOf(empty())).toEqual([]);
  });

  it('prints the minted item in its rarity colour with its first stat as the detail', () => {
    const lines = haulOf({ ...empty(), item: item() });
    expect(lines.length).toBe(1);
    expect(lines[0].kind).toBe('item');
    expect(lines[0].name).toBe('Ash Sigil');
    expect(lines[0].color).toBe(RUNE_TIERS.rare.color);
    // goldPerSec is first in ITEM_STAT_KEYS, so it wins over strikePower.
    expect(lines[0].detail).toBe('Gold/sec +1.3');
  });

  it('falls back to the rarity label when the item rolled no stats', () => {
    const lines = haulOf({ ...empty(), item: item({ stats: {}, rarity: 'legendary' }) });
    expect(lines[0].detail).toBe(RUNE_TIERS.legendary.label);
    expect(lines[0].color).toBe(RUNE_TIERS.legendary.color);
  });

  it('orders item, scroll, explorer, essence and colours the scroll by its tier', () => {
    const lines = haulOf({ item: item(), scroll: scroll(), explorer: explorer(), essence: 3 });
    expect(lines.map(l => l.kind)).toEqual(['item', 'scroll', 'explorer', 'essence']);
    expect(lines[1].name).toBe('Fragment of the First Dawn, Part III');
    expect(lines[1].detail).toBe('The Sun That Dreamed');
    expect(lines[1].color).toBe(RUNE_TIERS.epic.color);
    expect(lines[2].name).toBe('Vesper Quill');
    expect(lines[2].detail).toBe('Uncommon');
    expect(lines[3].name).toBe('+3');
  });

  it('omits essence when none was minted', () => {
    const lines = haulOf({ ...empty(), scroll: scroll(), essence: 0 });
    expect(lines.map(l => l.kind)).toEqual(['scroll']);
  });

  it('uses the chapter name when a scroll has no subtitle', () => {
    const lines = haulOf({ ...empty(), scroll: scroll({ subtitle: '' }) });
    expect(lines[0].detail).toBe('The First Dawn');
  });
});

describe('isHeavyTier', () => {
  it('starts at epic', () => {
    expect(isHeavyTier('common')).toBeFalse();
    expect(isHeavyTier('uncommon')).toBeFalse();
    expect(isHeavyTier('rare')).toBeFalse();
    expect(isHeavyTier('epic')).toBeTrue();
    expect(isHeavyTier('legendary')).toBeTrue();
    expect(isHeavyTier('mythic')).toBeTrue();
    expect(isHeavyTier('singular')).toBeTrue();
  });
});

describe('batchHaul', () => {
  it('counts across a batch and sums essence', () => {
    const finds: HaulSource[] = [
      { item: item(), scroll: null, explorer: null, essence: 1 },
      { item: item(), scroll: scroll(), explorer: null, essence: 0 },
      { item: null, scroll: null, explorer: explorer(), essence: 2 },
    ];
    expect(batchHaul(finds)).toEqual({ items: 2, scrolls: 1, explorers: 1, essence: 3 });
  });

  it('is all zeros for an empty batch', () => {
    expect(batchHaul([])).toEqual({ items: 0, scrolls: 0, explorers: 0, essence: 0 });
  });
});

describe('tallyTiers', () => {
  const at = (tier: string) => ({ rune: { tier } as never });

  it('counts each rung and orders them rarest first', () => {
    const rows = tallyTiers([at('common'), at('rare'), at('common'), at('uncommon'), at('common')]);
    expect(rows.map(r => `${r.count} ${r.tier}`)).toEqual(['1 rare', '1 uncommon', '3 common']);
  });

  it('drops the rungs that never came up', () => {
    const rows = tallyTiers([at('common'), at('common')]);
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(2);
  });

  it('carries each rung own label and colour', () => {
    const [row] = tallyTiers([at('mythic')]);
    expect(row.label).toBeTruthy();
    expect(row.color).toMatch(/^#|rgb/);
  });

  it('is empty for an empty run', () => {
    expect(tallyTiers([])).toEqual([]);
  });
});
