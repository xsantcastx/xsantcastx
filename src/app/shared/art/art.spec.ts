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
import { ART_ALIAS, ART_PENDING, artFor, hasArt } from './art';
import { NPCS } from '../npc/npc.model';
import { ART_ALL } from './art-manifest.generated';
import {
  ALL_UPGRADES,
  ARTIFACTS,
  COSMETICS,
  ENCHANTMENTS,
} from '../economy/economy.model';
import { ITEM_DEFINITIONS } from '../rpg/item-definition';
import { THRALL_OFFERS } from '../thralls/thrall.model';

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
      // ALL_UPGRADES folds forge, hammers, mastery, automatons, expeditions and
      // the Thrall shift. THRALL_OFFERS is listed separately because recruiting
      // is not a Gold-ladder purchase and so is not in ALL_UPGRADES — a row that
      // reaches the shop through its own path would otherwise escape this gate
      // entirely, which is the failure mode this whole file exists for.
      const rows = [
        ...ALL_UPGRADES, ...ENCHANTMENTS, ...ARTIFACTS, ...COSMETICS, ...THRALL_OFFERS,
      ];
      const missing = rows
        .filter(row => !hasArt(row.id) && !ART_PENDING.has(row.id))
        .map(row => row.id);
      expect(missing).toEqual([]);
    });

    /*
     * The other half of the gate. Without this, `ART_PENDING` is a place where
     * ids go to be forgotten: an entry left behind after its art is painted
     * would silently exempt a row that no longer needs exempting, and the next
     * unpainted row added beside it would look like it belonged there.
     */
    it('holds nothing in ART_PENDING that has since been painted', () => {
      const painted = [...ART_PENDING].filter(id => hasArt(id));
      expect(painted).toEqual([]);
    });

    it('names a real catalogue row for every pending id', () => {
      // Item definitions are in here too: `ART_PENDING` now carries the named
      // uniques, and without them this gate would read every one as an orphan.
      // NPC portraits are in here for the same reason the uniques are: they are
      // real catalogue rows in their own catalogue, and without them this gate
      // would read all six as orphans.
      const known = new Set([
        ...[
          ...ALL_UPGRADES, ...ENCHANTMENTS, ...ARTIFACTS, ...COSMETICS, ...THRALL_OFFERS,
          ...ITEM_DEFINITIONS,
        ].map(row => row.id),
        ...NPCS.map(n => n.artId),
      ]);
      const orphans = [...ART_PENDING].filter(id => !known.has(id));
      expect(orphans).toEqual([]);
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
        .filter(def => !hasArt(def.id) && !ART_PENDING.has(def.id))
        .map(def => def.id);
      expect(missing).toEqual([]);
    });
  });
});
