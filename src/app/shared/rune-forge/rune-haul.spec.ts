import { RUNE_TIERS, type RuneTier } from './rune.model';
import {
  BatchTally, batchHaul, haulOf, isHeavyTier, tallyTiers,
  type HaulSource, type TallySource,
} from './rune-haul';

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

describe('BatchTally', () => {
  const src = (tier: RuneTier, over: Partial<TallySource> = {}): TallySource => ({
    rune: { id: `r-${tier}`, name: tier, tier },
    isNew: false,
    item: null,
    scroll: null,
    explorer: null,
    essence: 0,
    ...over,
  });

  const fill = (tally: BatchTally<TallySource>, tiers: RuneTier[]) => {
    for (const t of tiers) tally.add(src(t));
    return tally;
  };

  it('is empty before anything lands', () => {
    const t = new BatchTally<TallySource>(12);
    expect(t.count).toBe(0);
    expect(t.newCount).toBe(0);
    expect(t.best).toBeNull();
    expect(t.last).toBeNull();
    expect(t.cards).toEqual([]);
    expect(t.bestCardIndex).toBeNull();
    expect(t.tiers()).toEqual([]);
    expect(t.haul()).toEqual({ items: 0, scrolls: 0, explorers: 0, essence: 0 });
  });

  it('counts every find, whatever the card cap is', () => {
    const t = new BatchTally<TallySource>(3);
    fill(t, ['common', 'common', 'common', 'common', 'common']);
    expect(t.count).toBe(5);
  });

  it('keeps only as many cards as the grid can draw', () => {
    // The whole point: a forty-thousand-strike run must not retain forty
    // thousand find objects for a grid that draws twelve.
    const t = new BatchTally<TallySource>(3);
    fill(t, ['common', 'uncommon', 'rare', 'epic', 'legendary']);
    expect(t.cards.length).toBe(3);
    expect(t.cards.map(c => c.rune.tier)).toEqual(['common', 'uncommon', 'rare']);
    expect(t.count).toBe(5);
  });

  it('tracks the best find even when it lands past the card cap', () => {
    const t = new BatchTally<TallySource>(2);
    fill(t, ['common', 'common', 'common', 'singular', 'common']);
    expect(t.best!.rune.tier).toBe('singular');
    // ...and reports no card index for it, because there is no card to mark.
    expect(t.bestCardIndex).toBeNull();
  });

  it('points the grid at the best card when it is inside the cap', () => {
    const t = new BatchTally<TallySource>(12);
    fill(t, ['common', 'epic', 'common']);
    expect(t.bestCardIndex).toBe(1);
  });

  it('keeps the earliest of tied rungs, so the marker does not wander', () => {
    const t = new BatchTally<TallySource>(12);
    t.add(src('epic', { rune: { id: 'first', name: 'first', tier: 'epic' } }));
    t.add(src('epic', { rune: { id: 'second', name: 'second', tier: 'epic' } }));
    expect(t.best!.rune.id).toBe('first');
    expect(t.bestCardIndex).toBe(0);
  });

  it('remembers the find the run ended on', () => {
    const t = new BatchTally<TallySource>(2);
    t.add(src('singular'));
    t.add(src('common', { rune: { id: 'last', name: 'last', tier: 'common' } }));
    t.add(src('common', { rune: { id: 'really-last', name: 'really last', tier: 'common' } }));
    expect(t.last!.rune.id).toBe('really-last');
    // The reveal card shows the last find; the celebration uses the best one.
    expect(t.best!.rune.tier).toBe('singular');
  });

  it('counts new finds as they arrive', () => {
    const t = new BatchTally<TallySource>(12);
    t.add(src('common', { isNew: true }));
    t.add(src('common'));
    t.add(src('rare', { isNew: true }));
    expect(t.newCount).toBe(2);
    expect(t.count).toBe(3);
  });

  it('totals the haul the same way batchHaul does', () => {
    const finds: TallySource[] = [
      src('common', { item: item() as never, essence: 3 }),
      src('rare', { scroll: scroll() as never, essence: 2 }),
      src('epic', { explorer: explorer() as never }),
      // Negative essence must not subtract, matching batchHaul.
      src('common', { essence: -5 }),
    ];
    const t = new BatchTally<TallySource>(12);
    for (const f of finds) t.add(f);
    expect(t.haul()).toEqual(batchHaul(finds));
    expect(t.haul()).toEqual({ items: 1, scrolls: 1, explorers: 1, essence: 5 });
  });

  it('tallies rungs the same way tallyTiers does, rarest first', () => {
    const tiers: RuneTier[] = ['common', 'common', 'common', 'uncommon', 'uncommon', 'rare'];
    const t = fill(new BatchTally<TallySource>(2), tiers);
    const expected = tallyTiers(tiers.map(tier => ({ rune: { tier } })));
    expect(t.tiers()).toEqual(expected);
    expect(t.tiers().map(r => `${r.count} ${r.label}`)).toEqual(['1 Rare', '2 Uncommon', '3 Common']);
  });

  it('hands out copies of the haul, not the running totals', () => {
    // The component assigns this to a field the template reads; handing back
    // the live object would let a later strike mutate what is on screen.
    const t = new BatchTally<TallySource>(12);
    t.add(src('common', { essence: 4 }));
    const snapshot = t.haul();
    t.add(src('common', { essence: 6 }));
    expect(snapshot.essence).toBe(4);
    expect(t.haul().essence).toBe(10);
  });

  it('stays constant-time and constant-space across a very long run', () => {
    // A stand-in for the real complaint: ALL on a deep purse. The old path
    // did `batch = batch.concat(chunk)` per chunk, which is quadratic, and
    // scanned the whole array from a template getter on every pass.
    const t = new BatchTally<TallySource>(12);
    for (let i = 0; i < 40_000; i++) t.add(src(i === 31_337 ? 'mythic' : 'common'));
    expect(t.count).toBe(40_000);
    expect(t.cards.length).toBe(12);
    expect(t.best!.rune.tier).toBe('mythic');
    expect(t.tiers().map(r => r.count)).toEqual([1, 39_999]);
  });
});
