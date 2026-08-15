/**
 * rune-cards.spec.ts — guards the seam between the models and the painted sheet.
 *
 * The card table is keyed by model id but named for the painter's catalogue, so
 * the two sides can drift apart without anything failing to compile: rename a
 * rune and its card silently stops resolving, and the UI falls back to the text
 * glyph as though that rune had never been painted. These are pure-data checks
 * — no Firebase, no network — so they run on a clean offline checkout.
 *
 * What they cannot check is that the PNG files are actually on disk; Karma has
 * no filesystem. The masters are copied from the Eclipse Realms asset library.
 */
import { RUNES, RUNEWORDS } from './rune.model';
import { ARTIFACTS } from '../economy/economy.model';
import {
  ARTIFACT_CARDS,
  RUNEWORD_CARDS,
  RUNE_CARDS,
  artifactCard,
  runeCard,
  runewordCard,
} from './rune-cards';

/**
 * The three the painter did not get to. Named here rather than counted so that
 * painting one later is a one-line change with a failing test to prompt it, and
 * so that a *new* unpainted rune cannot hide inside a tolerance.
 */
const UNPAINTED_RUNES = ['mote', 'seam', 'ledger'];

describe('rune-cards', () => {
  describe('runes', () => {
    it('has a card for every rune except the three that were never painted', () => {
      const missing = RUNES.filter(r => !runeCard(r.id)).map(r => r.id);
      expect(missing.sort()).toEqual([...UNPAINTED_RUNES].sort());
    });

    it('maps no card to an id that is not a rune', () => {
      const ids = new Set(RUNES.map(r => r.id));
      const orphans = Object.keys(RUNE_CARDS).filter(id => !ids.has(id));
      expect(orphans).toEqual([]);
    });

    it('covers 22 of the 25 runes', () => {
      expect(Object.keys(RUNE_CARDS).length).toBe(22);
      expect(RUNES.length).toBe(25);
    });
  });

  describe('runewords', () => {
    it('has a card for every runeword', () => {
      const missing = RUNEWORDS.filter(w => !runewordCard(w.id)).map(w => w.id);
      expect(missing).toEqual([]);
    });

    it('maps no card to an id that is not a runeword', () => {
      const ids = new Set(RUNEWORDS.map(w => w.id));
      expect(Object.keys(RUNEWORD_CARDS).filter(id => !ids.has(id))).toEqual([]);
    });

    it('keeps the catalogue stem for The Convergent’s Will', () => {
      expect(runewordCard('convergents-will')!.src)
        .toContain('26-convergents-will');
    });
  });

  describe('artifacts', () => {
    it('has a card for every artifact', () => {
      const missing = ARTIFACTS.filter(a => !artifactCard(a.id)).map(a => a.id);
      expect(missing).toEqual([]);
    });

    it('maps no card to an id that is not an artifact', () => {
      const ids = new Set(ARTIFACTS.map(a => a.id));
      expect(Object.keys(ARTIFACT_CARDS).filter(id => !ids.has(id))).toEqual([]);
    });

    it('keeps the catalogue name for the Mirrorblade', () => {
      expect(artifactCard('mirrorblade-kael')!.src)
        .toContain('30-mirrorblade-of-kael');
    });
  });

  describe('every entry', () => {
    const all = [
      ...Object.values(RUNE_CARDS),
      ...Object.values(RUNEWORD_CARDS),
      ...Object.values(ARTIFACT_CARDS),
    ];

    it('points at a PNG under the items asset folders', () => {
      for (const c of all) {
        expect(c.src).toMatch(/^assets\/items\/(runes|runewords|artifacts)\/[a-z0-9-]+\.png$/);
      }
    });

    /* Intrinsic dimensions exist to stop the ledger reflowing as cards decode,
       so a zero here is worse than a wrong number — it disables the reservation
       without disabling the image. */
    it('carries real intrinsic dimensions', () => {
      for (const c of all) {
        expect(c.width).toBeGreaterThan(0);
        expect(c.height).toBeGreaterThan(0);
      }
    });

    it('points every card at a distinct file', () => {
      const srcs = all.map(c => c.src);
      expect(new Set(srcs).size).toBe(srcs.length);
      expect(srcs.length).toBe(33);
    });
  });
});
