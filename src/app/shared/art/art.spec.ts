/**
 * art.spec.ts — guards the seam between catalogue ids and painted art.
 *
 * The manifest is generated from filenames; the ids come from the models. When
 * they drift, nothing fails to compile — the art silently stops resolving and
 * the UI falls back to an emoji or a two-letter orb, which is exactly the state
 * the Market was in with 37 emoji rows sitting beside real rarity sigils.
 *
 * Pure data: no Firebase, no network, no DOM. Runs on a clean offline checkout.
 */
import { ART_ALIAS, artFor, hasArt } from './art';
import { ART_ALL } from './art-manifest.generated';
import {
  ALL_UPGRADES,
  ARTIFACTS,
  COSMETICS,
  ENCHANTMENTS,
} from '../economy/economy.model';
import { ITEM_DEFINITIONS } from '../rpg/item-definition';

describe('art lookup', () => {
  it('resolves nothing for a missing or empty id', () => {
    expect(artFor(undefined)).toBeNull();
    expect(artFor(null)).toBeNull();
    expect(artFor('')).toBeNull();
    expect(artFor('no-such-thing')).toBeNull();
  });

  it('points every alias at a key that actually exists', () => {
    const dangling = Object.entries(ART_ALIAS)
      .filter(([, key]) => !ART_ALL[key])
      .map(([id, key]) => `${id} -> ${key}`);
    expect(dangling).toEqual([]);
  });

  it('carries a width-descriptor srcset on every entry', () => {
    const noSrcset = Object.entries(ART_ALL)
      .filter(([, entry]) => !entry.srcset.includes('w'))
      .map(([id]) => id);
    expect(noSrcset).toEqual([]);
  });

  it('serves the smallest variant as src', () => {
    for (const [, entry] of Object.entries(ART_ALL)) {
      const first = entry.srcset.split(',')[0].trim().split(' ')[0];
      expect(entry.src).toBe(first);
    }
  });

  describe('Market catalogue', () => {
    /*
     * Every shop row used to carry an emoji `icon` and only the five artifacts
     * had real art. If this list grows an entry, either paint it and re-run
     * scripts/import-assets.py, or alias it in ART_ALIAS.
     */
    it('has painted art for every purchasable row', () => {
      // ALL_UPGRADES folds forge, hammers, mastery, automatons and expeditions.
      const rows = [...ALL_UPGRADES, ...ENCHANTMENTS, ...ARTIFACTS, ...COSMETICS];
      const missing = rows.filter(row => !hasArt(row.id)).map(row => row.id);
      expect(missing).toEqual([]);
    });
  });

  describe('item definitions', () => {
    /*
     * All twelve authored equipment definitions had no art at all — they
     * rendered as two-letter text orbs, because src/assets/items/ never had an
     * equipment folder.
     */
    it('has painted art for every authored definition', () => {
      const missing = ITEM_DEFINITIONS
        .filter(def => !hasArt(def.id))
        .map(def => def.id);
      expect(missing).toEqual([]);
    });
  });
});
