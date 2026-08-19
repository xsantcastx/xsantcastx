/**
 * art.ts — the one place a model id is turned into painted art.
 *
 * `art-manifest.generated.ts` is keyed by the catalogue filename minus its
 * two-digit prefix, which matches the model id almost everywhere. Where it
 * does not, the alias belongs here rather than in each caller: the three
 * artifact aliases were already duplicated between `rune-cards.ts` and the
 * Market before this existed, which is exactly how a fourth one gets missed.
 *
 * Pure data — no browser APIs — so it is safe to import from an SSR path.
 */
import { ART_ALL, type ArtEntry } from './art-manifest.generated';
import { UNIQUE_ITEMS } from '../rpg/unique-items';

export type { ArtEntry };

/**
 * Model id -> manifest key, for ids whose file is named more verbosely than
 * the model. Keep this small: a new entry here is usually a sign the art
 * should have been named after the id instead.
 */
export const ART_ALIAS: Readonly<Record<string, string>> = {
  'mirrorblade-kael': 'mirrorblade-of-kael',
  'relic-third-dawn': 'relic-of-the-third-dawn',
  'fragment-first-sun': 'fragment-of-the-first-sun',
  // The Market sells a slot; the painting is of the explorer who fills it.
  'explorer-slot': 'hire-an-explorer',
  // The craft names the weapon; the library filed its render as a portrait.
  'basalt-edge': 'basalt-edge-portrait',
};

/**
 * Catalogue ids that have shipped ahead of their painting.
 *
 * The Market falls back to the row's emoji glyph when `artFor` returns null,
 * which is a supported state — it is how every shelf looked before the library
 * was wired. What is *not* supported is that state being invisible, which is
 * why `art.spec.ts` fails on any unpainted row that is not named here.
 *
 * This is deliberately not an alias. Pointing a Thrall at the Apprentice
 * Striker's painting would make the coverage test pass while putting the
 * Automaton shelf's artwork on a different shelf's row — a silent lie that
 * nobody would ever be prompted to correct, because the gate would be green.
 * An entry here is a debt with a name on it, and the spec asserts that each one
 * is still genuinely unpainted, so it fails again the day the art lands and the
 * line is left behind.
 *
 * Keep it short, and delete from it rather than adding.
 *
 *   thrall-*      the five Forge Thrall tiers and the shift-length upgrade,
 *                 shipped in v2.68.0. Nothing in `Assets/Characters` depicts a
 *                 bound worker at the anvil; this needs a new painting rather
 *                 than a crop of an existing one.
 *   unique-*      the twenty-four named objects in unique-items.ts. Each one is
 *                 a specific thing with a history, so each needs its own
 *                 painting — aliasing "Goldmouth" onto the Eclipse Longblade's
 *                 render would put a generic blade on the rarest weapon in the
 *                 game and the gate would go green on the lie. They fall back to
 *                 the rarity orb until the library has them.
 */
export const ART_PENDING: ReadonlySet<string> = new Set([
  'thrall-common',
  'thrall-uncommon',
  'thrall-rare',
  'thrall-epic',
  'thrall-legendary',
  'thrall-slot',
  ...UNIQUE_ITEMS.map(u => u.id),
]);

/** Painted art for a catalogue id, or null when nothing has been painted. */
export function artFor(id: string | undefined | null): ArtEntry | null {
  if (!id) return null;
  return ART_ALL[ART_ALIAS[id] ?? id] ?? null;
}

/** True when `id` has art. Cheaper to read than `!!artFor(id)` at a call site. */
export function hasArt(id: string | undefined | null): boolean {
  return artFor(id) !== null;
}
