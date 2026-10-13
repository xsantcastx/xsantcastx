/**
 * delve-lore.model.ts — the carved inscriptions of the Ember Delve, and the
 * pure rules for the set a player has read. No Angular, no storage.
 *
 * FOR THE LORE / MISSIONS AGENT: every id below is placed in the Delve's
 * terrain spec (`EMBER_DELVE.terrain.inscriptions` in
 * play/world/towns/infernal.ts) at the cell given here. The engine reports a
 * reading as `onDiscover({ kind: 'inscription', id, biome })`, and
 * DelveLoreService records it. `text` is the one line shown in the world when
 * it is read; the full canon (Archivist copies → Codex entries) is in
 * delve-inscription-lore.ts. Ids are saved in players'
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
  /** The one line shown in the world when it is read (the Codex has the full text). */
  text: string;
}

export const INSCRIPTIONS: readonly InscriptionDef[] = [
  { id: 'roots-inverse-tree', biome: 'root-hollows', col: 19, row: 7,
    text: 'A tree is carved upside down, its crown pointing into the dark below.' },
  { id: 'roots-keepers-tally', biome: 'root-hollows', col: 69, row: 9,
    text: 'Five marks at Keeper height. Four are crossed through; the fifth is worn smooth.' },
  { id: 'basalt-kaels-mark', biome: 'basalt-caverns', col: 66, row: 16,
    text: 'A maker\'s mark is struck into the cavern wall like a hallmark: a hammer, not a name.' },
  { id: 'basalt-sealed-pocket', biome: 'basalt-caverns', col: 102, row: 23,
    text: 'Four names are cut into the basalt and struck out. Beneath them, shallow: "I stayed."' },
  { id: 'grotto-light-through-the-crack', biome: 'glowcap-grotto', col: 32, row: 32,
    text: 'A hymn to the light that comes up from below instead of down.' },
  { id: 'grotto-drowned-lamp', biome: 'glowcap-grotto', col: 87, row: 36,
    text: 'A lamp is carved with no flame, and a line about not needing one.' },
  { id: 'magma-the-fracture', biome: 'magma-halls', col: 44, row: 46,
    text: 'A map of a crack, with the Godforge drawn on both sides of it.' },
  { id: 'magma-warden-oath', biome: 'magma-halls', col: 96, row: 49,
    text: 'Orders to the fragment\'s guardian, cut in Godstone runes around the chamber.' },
  // Placed with the Delve extras: three per biome now.
  { id: 'roots-cutting-mark', biome: 'root-hollows', col: 28, row: 7,
    text: 'A cut in the shadow-root, sealed with ink. A thorn has grown where the blade went in.' },
  { id: 'basalt-seam-ledger', biome: 'basalt-caverns', col: 78, row: 16,
    text: 'A ledger of the old seam, cartload by cartload, and one line in another hand: "Seam closed."' },
  { id: 'grotto-tally-marks', biome: 'glowcap-grotto', col: 40, row: 32,
    text: 'A column of chalked prices for baskets of glowcaps, each a little higher than the last.' },
  { id: 'magma-unsigned', biome: 'magma-halls', col: 102, row: 50,
    text: 'A single tally mark, and a fresh one beside it.' },
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

// ── Shared with the missions / Codex side (merged from the lore agent's contract) ──
export interface DelveBiome { id: DelveBiomeId; name: string }
/** Shallowest first. */
export const DELVE_BIOMES: readonly DelveBiome[] = [
  { id: 'root-hollows', name: 'Root Hollows' },
  { id: 'basalt-caverns', name: 'Basalt Caverns' },
  { id: 'glowcap-grotto', name: 'Glowcap Grotto' },
  { id: 'magma-halls', name: 'Magma Halls' },
];
/** The inscriptions as the Codex and missions read them (canon text lives in delve-inscription-lore.ts). */
export const DELVE_INSCRIPTIONS: readonly InscriptionDef[] = INSCRIPTIONS;
export const SHADOW_ROOT_CUTTING = 'shadow-root-cutting';
export const GLOWCAP = 'glowcap';
export const GODFORGE_FRAGMENT = 'godforge-fragment';
