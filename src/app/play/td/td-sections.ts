/**
 * td-sections.ts — an act as a long land of sections (docs/design/world-acts.md §0 and §1.2–§1.4; canon §3.4b). Pure: the
 * seam rules, the Waystones of the Reach, and the zone bible's check for every section (one thing to read, one sealed
 * thing, one sound). The maps are maps/reach-sections.ts; the engine walks the seams (td-engine `stepSeams`).
 *
 * The rules:
 *  - **A section is its own area** (a ContinentDef, so the room runs one RoomWorld per section). Its id is its land's
 *    and the section's, joined by a hyphen (`infernal-reach-charwood`): the Hearth's area grammar is `[a-z0-9_-]`.
 *  - **A seam is a place you walk through** (a road gate, a ford, a pass), never an invisible wall: the land round it is
 *    rock or sea you can see. Stepping two tiles past its gate crosses, through a 0.4 s veil (SEAM_VEIL).
 *  - **The arrival rule**: the Keeper arrives SEAM_IN tiles inside the far seam, on its road, and no creature spawns
 *    within SEAM_CLEAR tiles of that spot (td-world keeps its packs off).
 *  - **Waystones**: one a section. Touching one records it (WaystoneService, `godforge-waystones`, merge by union); any
 *    recorded stone of the land then travels to any other for free.
 */
import type { SectionSeam } from './continent';

/** Tiles inside the far seam the Keeper arrives at; and how far from there no creature spawns. */
export const SEAM_IN = 6;
export const SEAM_CLEAR = 8;
/** Tiles past the gate line that cross; tiles either side of the road the crossing still counts (the rock's ragged edge beside the cut too). */
export const SEAM_PAST = 2;
export const SEAM_SIDE = 8;
/** The crossing's veil (seconds, fade out and back in): the route veil of world-acts.md §0. */
export const SEAM_VEIL = .4;

const STEP: Readonly<Record<SectionSeam['dir'], readonly [number, number]>> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/** Is tile (c, r) past this seam's gate (on the road through it, toward the other section)? */
export function seamPast(s: SectionSeam, c: number, r: number): boolean {
  const [dc, dr] = STEP[s.dir];
  const along = (c - s.c) * dc + (r - s.r) * dr, side = Math.abs(dc ? r - s.r : c - s.c);
  return along >= SEAM_PAST && along <= SEAM_PAST + 6 && side <= SEAM_SIDE;
}
/** Where a Keeper coming through this seam from the other side arrives: SEAM_IN tiles inside its gate. */
export function seamArrival(s: SectionSeam): { c: number; r: number } {
  const [dc, dr] = STEP[s.dir];
  return { c: s.c - dc * SEAM_IN, r: s.r - dr * SEAM_IN };
}

/** A section's one sound (the zone bible's "Sounds"): an engine cue, heard every `every` seconds or so, never in a town's square. */
export interface SectionSound {
  cue: 'farbell' | 'warhorn' | 'splash' | 'crackle' | 'cart-roll' | 'drum' | 'clang' | 'glass-ping' | 'lava-hiss' | 'march'
    // The Verdant Wilds (canon §8.3): birds that stop all at once, frogs at the water, boughs creaking, weavers clicking,
    // a hymn too faint to place; under the ground, chewing in the walls, a drip into the well, a heartbeat.
    | 'birdstop' | 'frogs' | 'creak' | 'chitter' | 'hymn' | 'chew' | 'drip' | 'heartbeat'
    // The Umbral Marches (S11 part 2; canon §8.4): boards knocking on the water, black water breathing, a voice calling
    // too far off to make out; in the Belfry, one slow note under the water; in the Galleries, seeping, a spade once.
    | 'boards' | 'bubbles' | 'voice' | 'underbell' | 'seep' | 'spade';
  every: readonly [number, number];
}
/** The zone bible's check (canon §8): every section has something to read, something sealed and its own sound. */
export interface SectionBible { read: string; sealed: string; sound: SectionSound }

/**
 * The Reach's sections and connector floors, by area id: the station ids of their thing to read and their sealed
 * thing (each stands on its map), and the sound that is theirs. The words are td-reach.i18n.ts (`reach.read.<id>`,
 * `reach.sealed.<id>`).
 */
export const REACH_BIBLE: Readonly<Record<string, SectionBible>> = {
  'infernal-reach-pyrehold': { read: 'read:pyrehold-bell', sealed: 'sealed:pyrehold-strongroom', sound: { cue: 'farbell', every: [40, 70] } },
  'infernal-reach-steppe': { read: 'read:steppe-cairn', sealed: 'sealed:steppe-beacon', sound: { cue: 'warhorn', every: [45, 80] } },
  'infernal-reach-shore': { read: 'read:shore-tideboard', sealed: 'sealed:shore-cave', sound: { cue: 'splash', every: [12, 24] } },
  'infernal-reach-charwood': { read: 'read:charwood-post', sealed: 'sealed:charwood-kiln', sound: { cue: 'crackle', every: [18, 34] } },
  'kiln-tunnels-1': { read: 'read:kiln-tally', sealed: 'sealed:kiln-arch', sound: { cue: 'cart-roll', every: [25, 45] } },
  'infernal-reach-deep-charwood': { read: 'read:kettle-stamp', sealed: 'sealed:deep-kiln', sound: { cue: 'drum', every: [30, 55] } },
  'infernal-reach-badlands': { read: 'read:scorch-words', sealed: 'sealed:badlands-sluice', sound: { cue: 'clang', every: [28, 34] } },
  'glass-throat-1': { read: 'read:throat-ring', sealed: 'sealed:throat-tube', sound: { cue: 'glass-ping', every: [10, 22] } },
  'glass-throat-2': { read: 'read:throat-prints', sealed: 'sealed:throat-glass', sound: { cue: 'glass-ping', every: [8, 18] } },
  'infernal-reach-molten-fields': { read: 'read:drake-post', sealed: 'sealed:drake-cage', sound: { cue: 'lava-hiss', every: [14, 28] } },
  'infernal-reach-pyre-peaks': { read: 'read:bastion-mile', sealed: 'sealed:bastion-gate', sound: { cue: 'march', every: [40, 70] } },
  'infernal-reach-cinderport': { read: 'read:cinderport-tides', sealed: 'sealed:cinderport-cellar', sound: { cue: 'splash', every: [14, 26] } },
  'infernal-reach-ashgrove': { read: 'read:ashgrove-board', sealed: 'sealed:ashgrove-clamp', sound: { cue: 'crackle', every: [20, 36] } },
};

/**
 * The act's road in order, plaza to the Caldera Rim (the walking-time check, world-acts.md §0: 12–15 minutes): each
 * surface section's through-road is its first road; a connector floor is walked stair to stair.
 */
export const REACH_ROUTE: readonly { area: string; from?: string; to?: string }[] = [
  { area: 'infernal-reach-pyrehold' },
  { area: 'infernal-reach-steppe' },
  { area: 'infernal-reach-charwood' },
  { area: 'kiln-tunnels-1', from: 'kiln-up', to: 'kiln-far' },
  { area: 'infernal-reach-deep-charwood' },
  { area: 'infernal-reach-badlands' },
  { area: 'glass-throat-1', from: 'throat-up', to: 'throat-down' },
  { area: 'glass-throat-2', from: 'throat2-up', to: 'throat-out' },
  { area: 'infernal-reach-molten-fields' },
  { area: 'infernal-reach-pyre-peaks' },
];

/**
 * The Verdant Wilds as an act (S11; world-acts.md §1.3; canon §8.3): its sections and the Root Hollows' floors (the
 * connector), by area id, as REACH_BIBLE. Words: td-wilds.i18n.ts (`reach.read.<id>`, `reach.sealed.<id>`).
 */
export const WILDS_BIBLE: Readonly<Record<string, SectionBible>> = {
  'verdant-wilds-shore': { read: 'read:shore-netpost', sealed: 'sealed:shore-hull', sound: { cue: 'splash', every: [12, 24] } },
  'verdant-wilds-rootglass': { read: 'read:rootglass-lamproll', sealed: 'sealed:rootglass-rootdoor', sound: { cue: 'glass-ping', every: [18, 34] } },
  'verdant-wilds-fernglades': { read: 'read:fern-bellpost', sealed: 'sealed:fern-bellhouse', sound: { cue: 'birdstop', every: [30, 55] } },
  'verdant-wilds-rootwater': { read: 'read:ford-depthpost', sealed: 'sealed:ford-sluice', sound: { cue: 'frogs', every: [16, 30] } },
  'verdant-wilds-glassmere': { read: 'read:mere-tally', sealed: 'sealed:mere-cave', sound: { cue: 'splash', every: [10, 22] } },
  'verdant-wilds-greenwood': { read: 'read:hedge-cairn', sealed: 'sealed:thorn-hedge', sound: { cue: 'creak', every: [20, 38] } },
  'root-hollows-1': { read: 'read:hollows-gnaw', sealed: 'sealed:hollows-packed', sound: { cue: 'chew', every: [14, 28] } },
  'root-hollows-2': { read: 'read:hollows-rope', sealed: 'sealed:hollows-coffer', sound: { cue: 'drip', every: [6, 14] } },
  'root-hollows-3': { read: 'read:heartroot-rings', sealed: 'sealed:heartroot-niche', sound: { cue: 'heartbeat', every: [12, 22] } },
  'verdant-wilds-deep-wilds': { read: 'read:deep-lantern-hook', sealed: 'sealed:deep-spore-mouth', sound: { cue: 'chitter', every: [18, 34] } },
  'verdant-wilds-courts': { read: 'read:courts-moss', sealed: 'sealed:courts-bellframe', sound: { cue: 'hymn', every: [40, 70] } },
};
/**
 * The Umbral Marches as an act (S11 part 2; world-acts.md §1.4; canon §8.4): its sections and its two connectors' floors,
 * by area id, as REACH_BIBLE. Words: td-marches.i18n.ts (`reach.read.<id>`, `reach.sealed.<id>`). The Belfry's note
 * comes every forty seconds, as the spec says (one slow note under the water past the fifth bell's door).
 */
export const MARCHES_BIBLE: Readonly<Record<string, SectionBible>> = {
  'umbral-marches-shore': { read: 'read:shore-wickpost', sealed: 'sealed:shore-watchhouse', sound: { cue: 'splash', every: [12, 24] } },
  'umbral-marches-gloamhaven': { read: 'read:gloamhaven-round', sealed: 'sealed:gloamhaven-chapel', sound: { cue: 'creak', every: [24, 44] } },
  'umbral-marches-fen': { read: 'read:fen-boundary', sealed: 'sealed:fen-cutters-hut', sound: { cue: 'frogs', every: [16, 30] } },
  'umbral-marches-boardwalk': { read: 'read:boardwalk-prayer', sealed: 'sealed:boardwalk-broken', sound: { cue: 'boards', every: [18, 32] } },
  'sunken-belfry-1': { read: 'read:belfry-rota', sealed: 'sealed:belfry-fifth-door', sound: { cue: 'underbell', every: [40, 40] } },
  'umbral-marches-meres': { read: 'read:meres-lampstake', sealed: 'sealed:meres-punt', sound: { cue: 'bubbles', every: [14, 26] } },
  'umbral-marches-deep-fen': { read: 'read:deep-wicktag', sealed: 'sealed:deep-chapel', sound: { cue: 'voice', every: [50, 90] } },
  'bog-galleries-1': { read: 'read:galleries-tally', sealed: 'sealed:galleries-boarded', sound: { cue: 'seep', every: [10, 20] } },
  'bog-galleries-2': { read: 'read:galleries-wicktag', sealed: 'sealed:galleries-sluice', sound: { cue: 'spade', every: [45, 80] } },
  'umbral-marches-ruins': { read: 'read:ruins-slab', sealed: 'sealed:ruins-watergate', sound: { cue: 'hymn', every: [40, 70] } },
};
/** Every act's zone bible, by area id (the engine's section sound reads it). */
export const SECTION_BIBLE: Readonly<Record<string, SectionBible>> = { ...REACH_BIBLE, ...WILDS_BIBLE, ...MARCHES_BIBLE };

/**
 * The Wilds' road in order, Mossharbor's pier to the Overgrown Temple's gate (world-acts.md §1.3: about 14 minutes):
 * the Mossy Shore, the Fernglades, the Rootwater Ford, the Greenwood, down the Root Hollows to the root-ramp, the Deep
 * Wilds, the Sunken Courts.
 */
export const WILDS_ROUTE: readonly { area: string; from?: string; to?: string }[] = [
  { area: 'verdant-wilds-shore' },
  { area: 'verdant-wilds-fernglades' },
  { area: 'verdant-wilds-rootwater' },
  { area: 'verdant-wilds-greenwood' },
  { area: 'root-hollows-1', from: 'hollows-out', to: 'hollows1-down' },
  { area: 'root-hollows-2', from: 'hollows2-up', to: 'hollows2-down' },
  { area: 'root-hollows-3', from: 'hollows3-up', to: 'hollows3-ramp' },
  { area: 'verdant-wilds-deep-wilds' },
  { area: 'verdant-wilds-courts' },
];

/**
 * The Marches' road in order, Mirewatch's pier to the Drowned Crypts' door (world-acts.md §1.4: about 15 minutes): the
 * Gloaming Shore, the Fen, the Pilgrims' Boardwalk to its broken end, through the Sunken Belfry, the Black Meres, the
 * Deep Fen to the peat-cut, down the Bog Galleries and up the cutters' stair, the Drowned Ruins.
 */
export const MARCHES_ROUTE: readonly { area: string; from?: string; to?: string }[] = [
  { area: 'umbral-marches-shore' },
  { area: 'umbral-marches-fen' },
  { area: 'umbral-marches-boardwalk' },
  { area: 'sunken-belfry-1', from: 'belfry-up', to: 'belfry-out' },
  { area: 'umbral-marches-meres' },
  { area: 'umbral-marches-deep-fen' },
  { area: 'bog-galleries-1', from: 'galleries-out', to: 'galleries1-down' },
  { area: 'bog-galleries-2', from: 'galleries2-up', to: 'galleries-far' },
  { area: 'umbral-marches-ruins' },
];
