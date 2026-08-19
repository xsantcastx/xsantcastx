import { COSMETICS } from '../economy/economy.model';
import { ITEM_DEFINITIONS } from '../rpg/item-definition';
import { ALL_CHARMS, type GameItem } from '../rpg/item.model';
import { materialDisplay } from '../rpg/material-catalog';
import { RUNES, RUNEWORDS, RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import { FIVE_REALMS } from '../narrative/five-realms.narrative';
import { hasArt } from '../art/art';
import {
  COLLECTION_CATALOG,
  COLLECTION_CATEGORY_ORDER,
  COLLECTION_REWARDS,
  COUNTED_CATALOG,
  buildCards,
  coerceCollectionLedger,
  collectionEntryById,
  collectionIdForItem,
  completionByCategory,
  completionByRarity,
  completionOf,
  emptyCollectionLedger,
  filterCards,
  lockedGlyph,
  mergeCollectionLedgers,
  overallCompletion,
  recentDiscoveries,
  sortCards,
  unpaidRewards,
  type CollectionLedger,
} from './collection.model';

function ledgerOf(entries: Record<string, { at?: number; count?: number }>): CollectionLedger {
  const out = emptyCollectionLedger();
  for (const [id, row] of Object.entries(entries)) {
    out.entries[id] = { firstDiscoveredAt: row.at ?? 0, count: row.count ?? 1 };
  }
  return out;
}

/** Every counted entry, so the 100% cases are testable without 80 literals. */
function fullLedger(): CollectionLedger {
  const out = emptyCollectionLedger();
  for (const entry of COUNTED_CATALOG) {
    out.entries[entry.id] = { firstDiscoveredAt: 1, count: 1 };
  }
  return out;
}

describe('collection catalogue', () => {
  it('has no duplicate ids', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const entry of COLLECTION_CATALOG) {
      if (seen.has(entry.id)) dupes.push(entry.id);
      seen.add(entry.id);
    }
    expect(dupes).toEqual([]);
  });

  it('carries every rune, Runeword and charm the game can grant', () => {
    for (const rune of RUNES) {
      const entry = collectionEntryById(rune.id);
      expect(entry).withContext(rune.id).toBeTruthy();
      expect(entry!.category).toBe('rune');
      expect(entry!.rarity).toBe(rune.tier);
    }
    for (const word of RUNEWORDS) {
      expect(collectionEntryById(word.id)?.category).withContext(word.id).toBe('runeword');
    }
    for (const charm of ALL_CHARMS) {
      const entry = collectionEntryById(charm.id);
      expect(entry).withContext(charm.id).toBeTruthy();
      expect(entry!.rarity).toBe(charm.rarity);
    }
  });

  it('carries every authored artifact and equipment definition', () => {
    for (const def of ITEM_DEFINITIONS) {
      if (def.family !== 'artifact' && def.family !== 'equipment') continue;
      expect(collectionEntryById(def.id)).withContext(def.id).toBeTruthy();
    }
  });

  /*
   * The names for material and consumable stack keys are written out in
   * collection.model.ts rather than imported, because material-catalog.ts does
   * not export its map and pulls the art manifest in with it. This is the join
   * that stops the two drifting.
   */
  it('names materials and consumables exactly as the bag does', () => {
    const wrong: string[] = [];
    for (const entry of COLLECTION_CATALOG) {
      if (entry.category !== 'material' && entry.category !== 'consumable') continue;
      const display = materialDisplay(entry.id);
      if (display && display.name !== entry.name) wrong.push(`${entry.id}: ${entry.name} vs ${display.name}`);
    }
    expect(wrong).toEqual([]);
  });

  it('only claims a realm that exists in the narrative bible', () => {
    const realms = new Set(FIVE_REALMS.map(r => r.id));
    const bad = COLLECTION_CATALOG
      .filter(e => e.realm && !realms.has(e.realm))
      .map(e => e.id);
    expect(bad).toEqual([]);
  });

  it('only uses rarities from the rune ladder, and categories from its own list', () => {
    for (const entry of COLLECTION_CATALOG) {
      expect(RUNE_TIER_ORDER).withContext(entry.id).toContain(entry.rarity);
      expect(COLLECTION_CATEGORY_ORDER).withContext(entry.id).toContain(entry.category);
    }
  });

  it('gives every entry a hint and a line of lore', () => {
    const thin = COLLECTION_CATALOG
      .filter(e => e.hint.trim().length < 8 || e.lore.trim().length < 8)
      .map(e => e.id);
    expect(thin).toEqual([]);
  });

  /*
   * A completion bar that cannot reach 100% is a bar that lies, so the twelve
   * authored-but-unforgeable equipment pieces and the two Collector rewards are
   * outside the denominator. This pins that rule rather than the exact count,
   * which moves the day a drop path ships.
   */
  it('counts only what something can actually grant, and never a reward', () => {
    for (const entry of COUNTED_CATALOG) {
      expect(entry.obtainable).withContext(entry.id).toBe(true);
      expect(entry.reward).withContext(entry.id).toBeFalsy();
    }
    expect(COUNTED_CATALOG.length).toBeLessThan(COLLECTION_CATALOG.length);
    expect(COUNTED_CATALOG.length).toBeGreaterThan(60);
  });

  it('has painted art for every catalogued rune, Runeword, artifact and charm reward', () => {
    const missing = COLLECTION_CATALOG
      .filter(e => e.category === 'rune' || e.category === 'runeword' || e.category === 'artifact')
      .filter(e => !hasArt(e.id))
      .map(e => e.id);
    // Three runes were never painted (mote, seam, ledger); the glyph fallback
    // covers them. Anything beyond those three is a regression in the manifest.
    expect(missing.sort()).toEqual(['ledger', 'mote', 'seam']);
  });
});

describe('collection rewards', () => {
  it('climbs, and every title it grants is a real cosmetic variant', () => {
    const prefix = COSMETICS.find(c => c.slot === 'prefix')!;
    const trail = COSMETICS.find(c => c.slot === 'trail')!;
    let last = 0;
    for (const reward of COLLECTION_REWARDS) {
      expect(reward.at).toBeGreaterThan(last);
      last = reward.at;
      expect(prefix.variants.map(v => v.id)).withContext(reward.id).toContain(reward.titleVariant);
      if (reward.trailVariant) {
        expect(trail.variants.map(v => v.id)).toContain(reward.trailVariant);
      }
      if (reward.item) {
        expect(ITEM_DEFINITIONS.map(d => d.id)).withContext(reward.id).toContain(reward.item);
      }
    }
    expect(last).toBe(100);
  });

  it('offers nothing at 0% and everything at 100%', () => {
    expect(unpaidRewards(emptyCollectionLedger(), 0)).toEqual([]);
    expect(unpaidRewards(emptyCollectionLedger(), 100).length).toBe(COLLECTION_REWARDS.length);
  });

  it('does not re-offer what the ledger has already paid', () => {
    const ledger = emptyCollectionLedger();
    ledger.rewards = ['collector-apprentice'];
    const due = unpaidRewards(ledger, 60).map(r => r.id);
    expect(due).toEqual(['collector-journeyman']);
  });
});

describe('completion arithmetic', () => {
  it('holds at 99 until the very last entry lands', () => {
    expect(completionOf(0, 10).percent).toBe(0);
    expect(completionOf(9, 10).percent).toBe(90);
    // 999/1000 floors to 99 anyway; the guard is for the case that rounds up.
    expect(completionOf(9999, 10_000).percent).toBe(99);
    expect(completionOf(10, 10).percent).toBe(100);
  });

  it('reports an empty total as zero rather than NaN', () => {
    expect(completionOf(0, 0)).toEqual({ found: 0, total: 0, percent: 0 });
  });

  it('reaches 100% overall exactly when every counted entry is held', () => {
    expect(overallCompletion(emptyCollectionLedger()).percent).toBe(0);
    const full = overallCompletion(fullLedger());
    expect(full.percent).toBe(100);
    expect(full.found).toBe(COUNTED_CATALOG.length);
  });

  it('does not count an entry that is outside the denominator', () => {
    const ledger = ledgerOf({ 'keeper-signet': {}, 'eclipse-longblade': {} });
    expect(overallCompletion(ledger).found).toBe(0);
  });

  it('splits the same total across categories and rarities without losing one', () => {
    const byCategory = completionByCategory(fullLedger());
    const byRarity = completionByRarity(fullLedger());
    const catTotal = COLLECTION_CATEGORY_ORDER.reduce((n, c) => n + byCategory[c].total, 0);
    const rarTotal = RUNE_TIER_ORDER.reduce((n, r) => n + byRarity[r].total, 0);
    expect(catTotal).toBe(COUNTED_CATALOG.length);
    expect(rarTotal).toBe(COUNTED_CATALOG.length);
  });
});

describe('collection ledger parsing and merging', () => {
  it('reads a hand-mangled blob without throwing', () => {
    expect(coerceCollectionLedger(null)).toEqual(emptyCollectionLedger());
    expect(coerceCollectionLedger('nope')).toEqual(emptyCollectionLedger());
    expect(coerceCollectionLedger({ entries: 7, rewards: 'x' })).toEqual(emptyCollectionLedger());
  });

  it('repairs a record with a broken count or date', () => {
    const parsed = coerceCollectionLedger({
      entries: { ash: { firstDiscoveredAt: 'yesterday', count: -4 } },
    });
    expect(parsed.entries['ash']).toEqual({ firstDiscoveredAt: 0, count: 1 });
  });

  /*
   * The bug this pins is a data-loss one and it is silent: an older tab that
   * dropped ids it did not recognise would strip everything a newer catalogue
   * had recorded, write the stripped ledger back, and the cloud merge would
   * carry the loss to every device.
   */
  it('keeps an id this build has never heard of', () => {
    const parsed = coerceCollectionLedger({
      entries: { 'rune-from-the-future': { firstDiscoveredAt: 5, count: 2 } },
      rewards: ['collector-from-the-future'],
    });
    expect(parsed.entries['rune-from-the-future']).toEqual({ firstDiscoveredAt: 5, count: 2 });
    expect(parsed.rewards).toEqual(['collector-from-the-future']);
    // ...and it stays inert: nothing renders it and nothing counts it.
    expect(overallCompletion(parsed).found).toBe(0);
    expect(recentDiscoveries(parsed)).toEqual([]);
  });

  it('takes the earliest first-found and the larger count', () => {
    const remote = ledgerOf({ ash: { at: 5_000, count: 3 } });
    const local = ledgerOf({ ash: { at: 1_000, count: 9 } });
    const merged = mergeCollectionLedgers(remote, local);
    expect(merged.entries['ash']).toEqual({ firstDiscoveredAt: 1_000, count: 9 });
  });

  it('lets a real date beat a backfilled record with no date behind it', () => {
    const remote = ledgerOf({ ash: { at: 0, count: 1 } });
    const local = ledgerOf({ ash: { at: 7_000, count: 1 } });
    expect(mergeCollectionLedgers(remote, local).entries['ash'].firstDiscoveredAt).toBe(7_000);
    expect(mergeCollectionLedgers(local, remote).entries['ash'].firstDiscoveredAt).toBe(7_000);
  });

  it('adopts an entry only one side holds, and unions the paid rewards', () => {
    const remote = ledgerOf({ ash: { at: 5 } });
    remote.rewards = ['collector-apprentice'];
    const local = ledgerOf({ ember: { at: 9 } });
    local.rewards = ['collector-journeyman'];
    const merged = mergeCollectionLedgers(remote, local);
    expect(Object.keys(merged.entries).sort()).toEqual(['ash', 'ember']);
    expect(merged.rewards.sort()).toEqual(['collector-apprentice', 'collector-journeyman']);
  });

  it('is order-independent on the fields that matter', () => {
    const a = ledgerOf({ ash: { at: 5_000, count: 3 }, ember: { at: 20, count: 1 } });
    const b = ledgerOf({ ash: { at: 1_000, count: 9 } });
    expect(mergeCollectionLedgers(a, b).entries).toEqual(mergeCollectionLedgers(b, a).entries);
  });
});

describe('turning a granted thing into a catalogue id', () => {
  function item(over: Partial<GameItem>): GameItem {
    return {
      id: 'x', name: 'x', type: 'artifact', rarity: 'common', stats: {},
      sellValue: 0, equipped: false, foundAt: '', soulbound: false, upgradeLevel: 0,
      ...over,
    } as GameItem;
  }

  it('uses the definition id when the item carries one', () => {
    expect(collectionIdForItem(item({ definitionId: 'basalt-edge', name: 'Basalt Edge' })))
      .toBe('basalt-edge');
  });

  it('joins a charm by name, because a minted charm carries no definition id', () => {
    const charm = ALL_CHARMS[0];
    expect(collectionIdForItem(item({ type: 'charm', name: charm.name }))).toBe(charm.id);
  });

  /*
   * A rune Sigil is a separate object named after a rune. Counting it would
   * record the Void as found because a Void Sigil dropped — which it cannot,
   * since the sigil mints at the rune's tier from a different table.
   */
  it('counts a rune Sigil as nothing at all', () => {
    expect(collectionIdForItem(item({ type: 'rune', name: 'Void Sigil' }))).toBeNull();
  });

  it('counts an item it has never heard of as nothing at all', () => {
    expect(collectionIdForItem(item({ definitionId: 'not-a-thing', name: 'Not A Thing' }))).toBeNull();
  });
});

describe('the grid', () => {
  it('builds a card for every catalogue row, locked by default', () => {
    const cards = buildCards(emptyCollectionLedger());
    expect(cards.length).toBe(COLLECTION_CATALOG.length);
    expect(cards.every(c => !c.found)).toBe(true);
  });

  /*
   * The search box must not be a way to read the catalogue: typing "Godstone"
   * with the Godstone unfound would confirm it exists and name it, which turns
   * the log into a checklist.
   */
  it('does not let a search match an unfound card by its name', () => {
    const locked = buildCards(emptyCollectionLedger());
    const byName = filterCards(locked, {
      category: 'all', rarity: 'all', status: 'all', realm: 'all', query: 'godstone',
    });
    expect(byName).toEqual([]);

    const found = buildCards(ledgerOf({ godstone: { at: 1 } }));
    const nowVisible = filterCards(found, {
      category: 'all', rarity: 'all', status: 'all', realm: 'all', query: 'godstone',
    });
    expect(nowVisible.map(c => c.entry.id)).toEqual(['godstone']);
  });

  it('finds every locked card by keyword, which is the honest way to list them', () => {
    const locked = buildCards(emptyCollectionLedger());
    const missing = filterCards(locked, {
      category: 'all', rarity: 'all', status: 'all', realm: 'all', query: 'locked',
    });
    expect(missing.length).toBe(COLLECTION_CATALOG.length);
  });

  it('filters by realm, and separates the unaligned from everything', () => {
    const cards = buildCards(emptyCollectionLedger());
    const base = { category: 'all', rarity: 'all', status: 'all', query: '' } as const;
    const infernal = filterCards(cards, { ...base, realm: 'infernal' });
    expect(infernal.length).toBeGreaterThan(0);
    expect(infernal.every(c => c.entry.realm === 'infernal')).toBe(true);
    const unaligned = filterCards(cards, { ...base, realm: 'unaligned' });
    expect(unaligned.every(c => !c.entry.realm)).toBe(true);
    expect(infernal.length + unaligned.length).toBeLessThan(cards.length);
  });

  it('sorts found cards ahead of locked ones by name, and never shuffles the locked', () => {
    const cards = buildCards(ledgerOf({ void: { at: 5 }, ash: { at: 9 } }));
    const sorted = sortCards(cards, 'name');
    expect(sorted[0].found).toBe(true);
    expect(sorted[1].found).toBe(true);
    expect(sorted.slice(2).every(c => !c.found)).toBe(true);
    const lockedOrder = sorted.slice(2).map(c => c.index);
    expect(lockedOrder).toEqual([...lockedOrder].sort((a, b) => a - b));
  });

  it('sorts newest first without dropping the never-found', () => {
    const cards = buildCards(ledgerOf({ ash: { at: 100 }, ember: { at: 900 } }));
    const sorted = sortCards(cards, 'newest');
    expect(sorted[0].entry.id).toBe('ember');
    expect(sorted[1].entry.id).toBe('ash');
    expect(sorted.length).toBe(COLLECTION_CATALOG.length);
  });

  it('lists the most recent discoveries newest first and skips undated records', () => {
    const ledger = ledgerOf({ ash: { at: 100 }, ember: { at: 900 }, drift: { at: 0 } });
    const rows = recentDiscoveries(ledger, 6);
    expect(rows.map(r => r.entry.id)).toEqual(['ember', 'ash']);
  });

  it('gives a locked card a stable silhouette that leaks nothing', () => {
    expect(lockedGlyph(0)).toBe(lockedGlyph(0));
    expect(lockedGlyph(3)).not.toBe('');
    expect(lockedGlyph(-1)).not.toBe('');
    expect(lockedGlyph(9_999)).not.toBe('');
  });
});
