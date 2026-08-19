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

/** Painted art for a catalogue id, or null when nothing has been painted. */
export function artFor(id: string | undefined | null): ArtEntry | null {
  if (!id) return null;
  return ART_ALL[ART_ALIAS[id] ?? id] ?? null;
}

/** True when `id` has art. Cheaper to read than `!!artFor(id)` at a call site. */
export function hasArt(id: string | undefined | null): boolean {
  return artFor(id) !== null;
}
