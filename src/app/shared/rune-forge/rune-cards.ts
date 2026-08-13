/**
 * rune-cards.ts — the painted card for a rune, a runeword or an artifact.
 *
 * `Rune.icon` was reserved for "the painted rune sheet" and this is that sheet,
 * arrived. It lives beside the models rather than inside them for one reason:
 * the art does not cover the whole ladder. Twenty-two of the twenty-five runes
 * were painted; Mote, Seam and Ledger were not. Putting a `card` on the seed
 * rows would mean three rows that say `card: undefined`, which reads like an
 * oversight rather than a fact about what exists.
 *
 * So: a lookup that returns null, and every caller has a text path for null.
 * The three unpainted runes keep the name-glyph the whole ladder used before
 * the art landed, which is a real state the UI already knew how to render.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE FILENAMES CARRY NUMBERS THE MODELS DO NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * The files are named for their position on the painter's sheet — card 1 of 33
 * through card 33 — and that numbering is the artist's catalogue, not ours. It
 * is kept because it is the only link back to the source sheet, but it means
 * the filename can never be derived from a model id, so this table is explicit.
 *
 * Two entries are where the catalogue and the model disagree outright, and both
 * are load-bearing — derive rather than read them and you get a 404:
 *
 *   runeword `convergents-will`   → runeword-26-the-convergents-will
 *   artifact `mirrorblade-kael`   → artifact-30-mirrorblade-of-kael
 *
 * `rune-cards.spec.ts` asserts every id here resolves to a file that exists and
 * that every painted file is claimed by an id, so a rename on either side fails
 * a test instead of quietly blanking a card.
 *
 * Intrinsic dimensions ship with each entry because the cards are NOT a uniform
 * size — the crops are tight to each painting's border, so widths run 142 to
 * 372 against a near-constant height. Without width/height on the <img> a grid
 * of them reflows as they decode.
 *
 * Pure data — no browser APIs — so it is safe to import from an SSR path.
 */

export interface CardArt {
  /** Path from the app root, no leading slash. */
  src: string;
  width: number;
  height: number;
}

const DIR = 'assets/icons/runes';

function card(stem: string, width: number, height: number): CardArt {
  return { src: `${DIR}/${stem}.webp`, width, height };
}

/** The twenty-two painted runes, by `Rune.id`. Mote, Seam and Ledger are absent. */
export const RUNE_CARDS: Readonly<Record<string, CardArt>> = {
  ash:         card('rune-01-ash', 156, 234),
  ember:       card('rune-02-ember', 157, 234),
  drift:       card('rune-03-drift', 157, 234),
  shade:       card('rune-04-shade', 157, 234),
  glint:       card('rune-05-glint', 156, 234),
  veil:        card('rune-06-veil', 156, 234),
  pulse:       card('rune-07-pulse', 156, 234),
  thorn:       card('rune-08-thorn', 156, 234),
  scorch:      card('rune-09-scorch', 156, 234),
  nexus:       card('rune-10-nexus', 147, 233),
  sigil:       card('rune-11-sigil', 147, 233),
  rift:        card('rune-12-rift', 147, 233),
  hollow:      card('rune-13-hollow', 147, 233),
  fracture:    card('rune-14-fracture', 148, 233),
  eclipse:     card('rune-15-eclipse', 148, 233),
  forge:       card('rune-16-forge', 148, 233),
  aether:      card('rune-17-aether', 148, 233),
  nox:         card('rune-18-nox', 148, 233),
  codex:       card('rune-19-codex', 151, 233),
  convergence: card('rune-20-convergence', 152, 244),
  godstone:    card('rune-21-godstone', 152, 244),
  void:        card('rune-22-void', 230, 244),
};

/** All six runewords, by `Runeword.id`. */
export const RUNEWORD_CARDS: Readonly<Record<string, CardArt>> = {
  'first-light':        card('runeword-23-first-light', 142, 232),
  'shadow-step':        card('runeword-24-shadow-step', 142, 232),
  'realm-bridge':       card('runeword-25-realm-bridge', 142, 232),
  // Catalogue says "the-"; the model does not. See the note above.
  'convergents-will':   card('runeword-26-the-convergents-will', 142, 232),
  'godforge-mastery':   card('runeword-27-godforge-mastery', 142, 232),
  'breath-of-the-void': card('runeword-28-breath-of-the-void', 201, 232),
};

/** All five artifacts, by `Artifact.id`. */
export const ARTIFACT_CARDS: Readonly<Record<string, CardArt>> = {
  'obsidian-heart':     card('artifact-29-obsidian-heart', 230, 255),
  // Catalogue says "of-kael"; the model says "kael". See the note above.
  'mirrorblade-kael':   card('artifact-30-mirrorblade-of-kael', 278, 255),
  'relic-third-dawn':   card('artifact-31-relic-third-dawn', 277, 255),
  'codex-solarii':      card('artifact-32-codex-solarii', 276, 255),
  'fragment-first-sun': card('artifact-33-fragment-first-sun', 372, 255),
};

/** The painted card for a rune, or null for the three that were never painted. */
export function runeCard(id: string): CardArt | null {
  return RUNE_CARDS[id] ?? null;
}

export function runewordCard(id: string): CardArt | null {
  return RUNEWORD_CARDS[id] ?? null;
}

export function artifactCard(id: string): CardArt | null {
  return ARTIFACT_CARDS[id] ?? null;
}
