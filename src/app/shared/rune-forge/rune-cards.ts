/**
 * rune-cards.ts — the painted card for a rune, a runeword or an artifact.
 *
 * Masters live under `assets/items/{runes,runewords,artifacts}` and match the
 * Eclipse Realms asset library (1254×1254 transparent PNG). The table is
 * still explicit: filenames carry the painter's 01–33 catalogue numbers,
 * and two model ids do not match the file stem (`mirrorblade-kael`,
 * `relic-third-dawn` / `fragment-first-sun`).
 *
 * Twenty-two of the twenty-five runes were painted; Mote, Seam and Ledger
 * are absent. Callers keep a text glyph for null.
 *
 * Pure data — no browser APIs — so it is safe to import from an SSR path.
 */

export interface CardArt {
  /** Path from the app root, no leading slash. */
  src: string;
  width: number;
  height: number;
}

const MASTER = 1254;

function art(folder: 'runes' | 'runewords' | 'artifacts', stem: string): CardArt {
  return { src: `assets/items/${folder}/${stem}.png`, width: MASTER, height: MASTER };
}

/** The twenty-two painted runes, by `Rune.id`. Mote, Seam and Ledger are absent. */
export const RUNE_CARDS: Readonly<Record<string, CardArt>> = {
  ash:         art('runes', '01-ash'),
  ember:       art('runes', '02-ember'),
  drift:       art('runes', '03-drift'),
  shade:       art('runes', '04-shade'),
  glint:       art('runes', '05-glint'),
  veil:        art('runes', '06-veil'),
  pulse:       art('runes', '07-pulse'),
  thorn:       art('runes', '08-thorn'),
  scorch:      art('runes', '09-scorch'),
  nexus:       art('runes', '10-nexus'),
  sigil:       art('runes', '11-sigil'),
  rift:        art('runes', '12-rift'),
  hollow:      art('runes', '13-hollow'),
  fracture:    art('runes', '14-fracture'),
  eclipse:     art('runes', '15-eclipse'),
  forge:       art('runes', '16-forge'),
  aether:      art('runes', '17-aether'),
  nox:         art('runes', '18-nox'),
  codex:       art('runes', '19-codex'),
  convergence: art('runes', '20-convergence'),
  godstone:    art('runes', '21-godstone'),
  void:        art('runes', '22-void'),
};

/** All six runewords, by `Runeword.id`. */
export const RUNEWORD_CARDS: Readonly<Record<string, CardArt>> = {
  'first-light':        art('runewords', '23-first-light'),
  'shadow-step':        art('runewords', '24-shadow-step'),
  'realm-bridge':       art('runewords', '25-realm-bridge'),
  'convergents-will':   art('runewords', '26-convergents-will'),
  'godforge-mastery':   art('runewords', '27-godforge-mastery'),
  'breath-of-the-void': art('runewords', '28-breath-of-the-void'),
};

/** All five artifacts, by `Artifact.id`. */
export const ARTIFACT_CARDS: Readonly<Record<string, CardArt>> = {
  'obsidian-heart':     art('artifacts', '29-obsidian-heart'),
  'mirrorblade-kael':   art('artifacts', '30-mirrorblade-of-kael'),
  'relic-third-dawn':   art('artifacts', '31-relic-of-the-third-dawn'),
  'codex-solarii':      art('artifacts', '32-codex-solarii'),
  'fragment-first-sun': art('artifacts', '33-fragment-of-the-first-sun'),
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
