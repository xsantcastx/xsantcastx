/**
 * bestiary.ts — the creatures the library has actually painted.
 *
 * Source: docs/03-lore-and-design/eclipse-realms-creature-atlas-proposal.md
 * for name, realm and haunt; `Assets/Creatures/Masters/` for the art. Only
 * creatures with an approved transparent master are listed. The library also
 * holds five concept sheets with no master, and the asset-library placement
 * rules say a concept sheet is "not runtime art" — so those creatures are
 * counted, not shown, until their masters are painted.
 *
 * The notes are a one-line field observation each, written for this page
 * rather than lifted from the atlas, whose briefs are addressed to a concept
 * artist.
 *
 * Pure data, no browser APIs, safe on an SSR path.
 */
import type { ArtRealm } from '../shared/art/art';

export interface BestiaryEntry {
  /** Manifest key — the master's filename minus its index. */
  id: string;
  name: string;
  realm: ArtRealm;
  /** Where in the realm it is found. */
  haunt: string;
  note: string;
}

export const BESTIARY: readonly BestiaryEntry[] = [
  {
    id: 'prism-forager',
    name: 'Prism Forager',
    realm: 'luminous',
    haunt: 'Heliograph Court',
    note: 'Nests in cracked dawn prisms and feeds on whichever memory is repeated most.',
  },
  {
    id: 'ephemeris-leech',
    name: 'Ephemeris Leech',
    realm: 'celestial',
    haunt: 'Meridian Orrery',
    note: 'Clings to the brass rings and drinks small errors from models that only look precise.',
  },
  {
    id: 'rivet-maw',
    name: 'Rivet Maw',
    realm: 'infernal',
    haunt: 'Basalt Seamworks',
    note: 'Hoards loose joins; its trail marks every repair that was put off.',
  },
  {
    id: 'mirror-substitute',
    name: 'Mirror Substitute',
    realm: 'umbral',
    haunt: 'Nocturne Archive',
    note: 'Appears beside a redacted witness and tells the room what it wants to hear.',
  },
  {
    id: 'rootglass-stag',
    name: 'Rootglass Stag',
    realm: 'verdant',
    haunt: 'Rootglass Canopy',
    note: 'Refuses any path the canopy is bending toward a single answer.',
  },
];

/** Creatures with a concept sheet in the library but no runtime master yet. */
export const BESTIARY_UNPAINTED = 5;
