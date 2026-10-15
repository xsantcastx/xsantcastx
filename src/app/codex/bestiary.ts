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
    id: 'drowned-lamp',
    name: 'The Drowned Lamp',
    realm: 'infernal',
    haunt: 'Ember Delve',
    note: 'A lampfish the size of a cart that circles the lamp at the bottom of the Grotto Mere and dims every other light in the cavern. In the dark it is a rumour; in the light it is a fight.',
  },
  // The Underhearth (Phase 8; lore-addendum.md, The Four Who Went Down). Drawn in the world as
  // pixel figures (engine.ts drawDeepCreature) until their masters are painted.
  {
    id: 'banked-ember',
    name: 'Banked Ember',
    realm: 'infernal',
    haunt: 'The Underhearth',
    note: 'Cold until struck. Every blow releases heat it took from somewhere else, and the tunnel gets warmer for it.',
  },
  {
    id: 'ironwood-sentinel',
    name: 'Ironwood Sentinel',
    realm: 'infernal',
    haunt: 'The Underhearth',
    note: 'One of the four pillars left standing. It still walks to where the ceiling should be and shoulders it up, whether or not the ceiling is there.',
  },
  {
    id: 'banked-furnace',
    name: 'The Banked Furnace',
    realm: 'infernal',
    haunt: 'The Underhearth',
    note: 'It never moves. It pulls. It is a promise kept so long it forgot who it was kept for.',
  },
  // The Ink Deeps, the Umbral's underside behind its Rift Gate (lore-addendum.md, The Rift Gates). Pixel figures
  // (engine.ts drawShade) until their masters are painted (docs/art-commissions/rift-gates.md).
  {
    id: 'shadeling',
    name: 'Shadeling',
    realm: 'umbral',
    haunt: 'The Ink Deeps',
    note: 'Only moves where no light is. Hold it in a torch\'s light and it stands like a statue of itself, waiting for you to look away.',
  },
  {
    id: 'gloam-warden',
    name: 'The Gloam Warden',
    realm: 'umbral',
    haunt: 'The Ink Deeps',
    note: 'Keeps the dark that was left when the light went somewhere else. It asks only to be lit; in the light it cannot move, and cannot refuse an ending.',
  },
  // The Root Deeps and the Prism Mines, behind the Verdant and Luminous Rift Gates (lore-addendum.md). Pixel figures
  // (engine/realm-creatures.ts) until their masters are painted.
  {
    id: 'graftling',
    name: 'Graftling',
    realm: 'verdant',
    haunt: 'The Root Deeps',
    note: 'A cutting that took. It still has the shape of whatever it was cut from, roughly, and it would like to be joined back on.',
  },
  {
    id: 'graftmother',
    name: 'The Graftmother',
    realm: 'verdant',
    haunt: 'The Root Deeps',
    note: 'Joins everything that is cut. Her heart-roots hold her to the hall; cut them and burn the stumps, and she can at last be let go.',
  },
  {
    id: 'prismling',
    name: 'Prismling',
    realm: 'luminous',
    haunt: 'The Prism Mines',
    note: 'A little light that set before it could go anywhere. It hops toward warmth and does not mean the sting.',
  },
  {
    id: 'hollow-sun',
    name: 'The Hollow Sun',
    realm: 'luminous',
    haunt: 'The Prism Mines',
    note: 'The light that was promised and never arrived. Blows pass through it while it is free; caught in a beam, it stands still long enough to be ended.',
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
