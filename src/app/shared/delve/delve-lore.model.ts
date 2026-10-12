/**
 * delve-lore.model.ts — the carved inscriptions of the Ember Delve, and the
 * pure rules for the set a player has read. No Angular, no storage.
 *
 * FOR THE LORE / MISSIONS AGENT: every id below is placed in the Delve's
 * terrain spec (`EMBER_DELVE.terrain.inscriptions` in
 * play/world/towns/infernal.ts) at the cell given here. The engine reports a
 * reading as `onDiscover({ kind: 'inscription', id, biome })`, and
 * DelveLoreService records it. `text` is a one-line placeholder: replace it
 * with the canon (Archivist copies → Codex entries). Ids are saved in players'
 * blobs, so never rename one; add new ids instead, and place them in the spec.
 *
 * Biome ids, top to bottom: 'root-hollows' (the World-Root's shadow),
 * 'basalt-caverns' (Kael's abandoned forge-mines), 'glowcap-grotto' (light
 * seeping through the fracture), 'magma-halls' (the fracture itself).
 */

export const DELVE_LORE_KEY = 'godforge-delve-lore';

export type DelveBiomeId = 'root-hollows' | 'basalt-caverns' | 'glowcap-grotto' | 'magma-halls';

export interface InscriptionDef {
  id: string;
  biome: DelveBiomeId;
  /** Where it is carved (terrain column, row). Mirrors the spec; the engine test pins the two together. */
  col: number;
  row: number;
  /** PLACEHOLDER — the lore agent replaces this with the canon line. */
  text: string;
}

export const INSCRIPTIONS: readonly InscriptionDef[] = [
  { id: 'roots-inverse-tree', biome: 'root-hollows', col: 19, row: 7,
    text: 'Placeholder: a tree drawn upside down, its crown pointing into the dark below.' },
  { id: 'roots-keepers-tally', biome: 'root-hollows', col: 69, row: 9,
    text: 'Placeholder: a Keeper\'s tally of days, scratched until the marks stop.' },
  { id: 'basalt-kaels-mark', biome: 'basalt-caverns', col: 66, row: 16,
    text: 'Placeholder: Kael\'s maker\'s mark, struck into the cavern wall like a hallmark.' },
  { id: 'basalt-sealed-pocket', biome: 'basalt-caverns', col: 102, row: 23,
    text: 'Placeholder: a warning carved inside the sealed pocket, facing in.' },
  { id: 'grotto-light-through-the-crack', biome: 'glowcap-grotto', col: 32, row: 32,
    text: 'Placeholder: a hymn to the light that comes up from below instead of down.' },
  { id: 'grotto-drowned-lamp', biome: 'glowcap-grotto', col: 87, row: 36,
    text: 'Placeholder: a lamp carved with no flame, and a line about not needing one.' },
  { id: 'magma-the-fracture', biome: 'magma-halls', col: 44, row: 46,
    text: 'Placeholder: a map of a crack, and the Godforge drawn on both sides of it.' },
  { id: 'magma-warden-oath', biome: 'magma-halls', col: 96, row: 49,
    text: 'Placeholder: the Rune-Warden\'s oath, cut in Godstone runes around the chamber.' },
];

const BY_ID = new Map(INSCRIPTIONS.map(row => [row.id, row]));
export function inscriptionById(id: string): InscriptionDef | undefined { return BY_ID.get(id); }

/** Delving XP paid the first time an inscription is read. Small: reading is a reward for looking. */
export const INSCRIPTION_XP = 15;

export interface DelveLoreState {
  version: 1;
  /** Inscription ids read, sorted. Only known ids survive a read. */
  inscriptions: string[];
}

export function emptyDelveLore(): DelveLoreState {
  return { version: 1, inscriptions: [] };
}

/** Whatever was read, as valid state: unknown ids (renamed or never placed) are dropped. */
export function coerceDelveLore(value: unknown): DelveLoreState {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>)['inscriptions'] : null;
  if (!Array.isArray(raw)) return emptyDelveLore();
  return { version: 1, inscriptions: [...new Set(raw.filter((id): id is string => typeof id === 'string' && BY_ID.has(id)))].sort() };
}

/** Record a reading. True when it is new (and `state` now holds it); false for a repeat or an unknown id. */
export function recordInscriptionIn(state: DelveLoreState, id: string): boolean {
  if (!BY_ID.has(id) || state.inscriptions.includes(id)) return false;
  state.inscriptions = [...state.inscriptions, id].sort();
  return true;
}

/** Two devices' readings: the union. Reading something cannot be undone. */
export function mergeDelveLore(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceDelveLore(remote), l = coerceDelveLore(local);
  return { version: 1, inscriptions: [...new Set([...l.inscriptions, ...r.inscriptions])].sort() } satisfies DelveLoreState;
}
