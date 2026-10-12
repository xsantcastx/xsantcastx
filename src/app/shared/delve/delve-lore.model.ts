// CONTRACT — the Delve agent's version wins on merge
/**
 * delve-lore.model.ts — the Delve's biomes, its inscription ids and its new
 * materials.
 *
 * Minimal stand-in so the missions and the Codex compile before the Delve
 * engine branch lands. Only the agreed surface lives here: biome ids, the
 * inscription list (id + biome + placeholder text) and the three material ids.
 * The canon text the Codex shows is in `delve-inscription-lore.ts`, keyed by
 * id, so it survives this file being replaced.
 *
 * Pure data. No Angular.
 */

export type DelveBiomeId = 'root-hollows' | 'basalt-caverns' | 'glowcap-grotto' | 'magma-halls';

export interface DelveBiome {
  id: DelveBiomeId;
  name: string;
}

/** Shallowest first. */
export const DELVE_BIOMES: readonly DelveBiome[] = [
  { id: 'root-hollows', name: 'Root Hollows' },
  { id: 'basalt-caverns', name: 'Basalt Caverns' },
  { id: 'glowcap-grotto', name: 'Glowcap Grotto' },
  { id: 'magma-halls', name: 'Magma Halls' },
];

export interface DelveInscription {
  id: string;
  biome: DelveBiomeId;
  /** Placeholder. The Codex prefers `DELVE_INSCRIPTION_LORE[id]`. */
  text: string;
}

export const DELVE_INSCRIPTIONS: readonly DelveInscription[] = [
  { id: 'roots-inverse-tree', biome: 'root-hollows', text: 'An inscription in the Root Hollows.' },
  { id: 'roots-cutting-mark', biome: 'root-hollows', text: 'An inscription in the Root Hollows.' },
  { id: 'roots-tally', biome: 'root-hollows', text: 'An inscription in the Root Hollows.' },
  { id: 'basalt-oath', biome: 'basalt-caverns', text: 'An inscription in the Basalt Caverns.' },
  { id: 'basalt-seam-ledger', biome: 'basalt-caverns', text: 'An inscription in the Basalt Caverns.' },
  { id: 'basalt-four-names', biome: 'basalt-caverns', text: 'An inscription in the Basalt Caverns.' },
  { id: 'grotto-seeping-light', biome: 'glowcap-grotto', text: 'An inscription in the Glowcap Grotto.' },
  { id: 'grotto-tally-marks', biome: 'glowcap-grotto', text: 'An inscription in the Glowcap Grotto.' },
  { id: 'grotto-first-morning', biome: 'glowcap-grotto', text: 'An inscription in the Glowcap Grotto.' },
  { id: 'magma-fracture-line', biome: 'magma-halls', text: 'An inscription in the Magma Halls.' },
  { id: 'magma-warden', biome: 'magma-halls', text: 'An inscription in the Magma Halls.' },
  { id: 'magma-unsigned', biome: 'magma-halls', text: 'An inscription in the Magma Halls.' },
];

/** Material ids the Delve grants. Stack keys, like every other material. */
export const SHADOW_ROOT_CUTTING = 'shadow-root-cutting';
export const GLOWCAP = 'glowcap';
export const GODFORGE_FRAGMENT = 'godforge-fragment';
