/**
 * rune-cards.ts — the painted card for a rune, a runeword or an artifact.
 *
 * Art now resolves through `art-manifest.generated.ts`, which is written by
 * `scripts/import-assets.py` from the approved library. This used to be a
 * hand-written table of 33 paths into `assets/items/**\/*.png` — the 1254x1254
 * masters, 45 MB of them, downloaded in full to fill a ~90px card. The manifest
 * carries a 96/256 ladder instead and the same set weighs 8 MB.
 *
 * Manifest keys are the catalogue filename with the painter's two-digit prefix
 * stripped, which matches the model id everywhere except the handful aliased in
 * `art.ts`, where the file name is more verbose than the id.
 *
 * Twenty-two of the twenty-five runes were painted; Mote, Seam and Ledger are
 * absent. Callers keep a text glyph for null.
 *
 * Pure data — no browser APIs — so it is safe to import from an SSR path.
 */
import {
  ART_ITEMS_ARTIFACTS,
  ART_ITEMS_RUNES,
  ART_ITEMS_RUNEWORDS,
} from '../art/art-manifest.generated';
import { ART_ALIAS, type ArtEntry } from '../art/art';

export interface CardArt {
  /** Path from the app root, no leading slash. */
  src: string;
  /** Width-descriptor set so a card does not fetch the largest variant. */
  srcset: string;
  width: number;
  height: number;
}

function card(entry: ArtEntry | undefined): CardArt | null {
  return entry ? { src: entry.src, srcset: entry.srcset, width: entry.width, height: entry.height } : null;
}

function toCards(source: Readonly<Record<string, ArtEntry>>): Readonly<Record<string, CardArt>> {
  const out: Record<string, CardArt> = {};
  for (const [id, entry] of Object.entries(source)) {
    const value = card(entry);
    if (value) out[id] = value;
  }
  return out;
}

/*
 * Keyed by *model* id, not by filename, so the orphan checks in the spec stay
 * meaningful — the whole point of that suite is catching the day a rune is
 * renamed and its art silently stops resolving.
 */
export const RUNE_CARDS: Readonly<Record<string, CardArt>> = toCards(ART_ITEMS_RUNES);
export const RUNEWORD_CARDS: Readonly<Record<string, CardArt>> = toCards(ART_ITEMS_RUNEWORDS);
export const ARTIFACT_CARDS: Readonly<Record<string, CardArt>> = (() => {
  const byFileStem = toCards(ART_ITEMS_ARTIFACTS);
  const out: Record<string, CardArt> = { ...byFileStem };
  for (const [modelId, fileKey] of Object.entries(ART_ALIAS)) {
    const hit = byFileStem[fileKey];
    if (!hit) continue;
    out[modelId] = hit;
    delete out[fileKey];
  }
  return out;
})();

export function runeCard(id: string): CardArt | null {
  return RUNE_CARDS[id] ?? null;
}

export function runewordCard(id: string): CardArt | null {
  return RUNEWORD_CARDS[id] ?? null;
}

export function artifactCard(id: string): CardArt | null {
  return ARTIFACT_CARDS[id] ?? null;
}
