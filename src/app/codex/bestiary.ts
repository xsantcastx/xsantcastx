/**
 * bestiary.ts — the creatures the library has actually painted.
 *
 * Source: docs/03-lore-and-design/eclipse-realms-creature-atlas-proposal.md
 * for name, realm and haunt; `Assets/Creatures/Masters/` for the art. Only
 * creatures with an approved transparent master are shown. The other five have
 * a concept sheet and no master, and the asset-library placement rules say a
 * concept sheet is "not runtime art" — so they are written out here, counted,
 * and filtered out until `artFor()` resolves their id. Their masters are
 * briefed in docs/art-commissions/; the day one is imported it appears on the
 * page with no code change.
 *
 * The notes are a one-line field observation each, written for this page
 * rather than lifted from the atlas, whose briefs are addressed to a concept
 * artist — except the two creatures the Ember Delve spawns under atlas names
 * (Cinder Bailiff, Seam Eater), whose notes quote the atlas's "Location and
 * role" line, as the owner asked (2026-10-13). Until painted they show the
 * stand-in their spawn wears (art.ts ART_ALIAS).
 *
 * Pure data, no browser APIs, safe on an SSR path.
 */
import { hasArt, type ArtRealm } from '../shared/art/art';

export interface BestiaryEntry {
  /** Manifest key — the master's filename minus its index. */
  id: string;
  name: string;
  realm: ArtRealm;
  /** Where in the realm it is found. */
  haunt: string;
  note: string;
}

const BESTIARY_ALL: readonly BestiaryEntry[] = [
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
  // ── Concept sheet only; shown once the master is imported ───────────────
  {
    id: 'afterimage-moth',
    name: 'Afterimage Moth',
    realm: 'luminous',
    haunt: 'Heliograph Court',
    note: 'Circles anyone who admits they are unsure, and goes still for anyone performing certainty.',
  },
  {
    id: 'anchor-warden',
    name: 'Anchor Warden',
    realm: 'celestial',
    haunt: 'Meridian Orrery',
    note: 'Repeats the last trajectory it was given, long after the order behind it has lapsed.',
  },
  {
    id: 'cinder-bailiff',
    name: 'Cinder Bailiff',
    realm: 'infernal',
    haunt: 'Ember Delve',
    note: 'Walks work routes and stamps heat debts onto shortcuts; it forces the local conflict into view.',
  },
  {
    id: 'seam-eater',
    name: 'Seam Eater',
    realm: 'infernal',
    haunt: 'Ember Delve',
    note: 'Rises from the deepest failed repairs and unthreads the Seamworks’ platforms.',
  },
  {
    id: 'ink-lantern',
    name: 'Ink Lantern',
    realm: 'umbral',
    haunt: 'Nocturne Archive',
    note: 'Drifts the unrecorded corridors and dims beside anyone who admits a gap in the map.',
  },
  {
    id: 'graftling',
    name: 'Graftling',
    realm: 'verdant',
    haunt: 'Rootglass Canopy',
    note: 'Mends by joining whatever is nearest, and has no idea what belonging to someone means.',
  },
];

/** The creatures with a painted master — the only ones the Codex shows. */
export const BESTIARY: readonly BestiaryEntry[] = BESTIARY_ALL.filter(entry => hasArt(entry.id));

/** Creatures sighted (concept sheet in the library) but not yet painted. */
export const BESTIARY_UNPAINTED = BESTIARY_ALL.length - BESTIARY.length;
