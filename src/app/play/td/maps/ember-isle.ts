import type { ContinentDef, ContinentHotspot, ContinentPlace, Region } from '../continent';
import { buildSeamworksSquare } from '../seamworks-square';
import { CAVE_IN } from './slagstone-cave';
import { BARROW_IN } from './hushed-barrow';
import type { StationDef } from '../../world/world.model';

/**
 * ember-isle.ts — Ember Isle, the Infernal realm's island, drawn by hand (docs/design/vision.md step 1; owner
 * 2026-10-20: "that map is trash … inspiration from tibia").
 *
 * The REGION map: one character per 8×8-tile block (so this island is 256×200 tiles), read through the legend below.
 * Region borders are wobbled when the ground is made (td-world.ts), so the blocks never show. The Seamworks square is
 * stamped where the T blocks are (block 12,10 is tile 0,0). Roads are drawn by hand as waypoints in tiles; places worth
 * finding (ruins, a shrine, a cave, the caldera) are drawn as points with what stands there.
 *
 * Legend: ~ the Burning Sea · , beach · . meadow · f woods · F deep Emberwood · h Slagstone Hills · m mountain rock ·
 * v the Ashfields (ash, lava pools) · l a lake · T the town.
 */
export const BLOCK = 8;
/** The region map's block (OX, OY) holds tile (0, 0): the square's corner. */
export const OX = 12;
export const OY = 10;

export const EMBER_ISLE: readonly string[] = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~,,,,,,,~~~~~~~~~~~~~~~',
  '~~~~~~~,,,,FFFFF,,,,~~~~~~~~~~~~',
  '~~~~~~,,FFFFFFFFFFF,,,~~~~~~~~~~',
  '~~~~~,,FFFFFFFFfffff..,,~~~~~~~~',
  '~~~~,,FFFFFfffff........,,~~~~~~',
  '~~~~,FFFFFff.....hhh.....,,~~~~~',
  '~~~,,FFFfff.....hhhhhh....,~~~~~',
  '~~~,FFFff....lll.hhmmhh....,,~~~',
  '~~~,Fff.....llll..hmmmhh....,~~~',
  '~~,,ff......TTTTTT.hmmh......,~~',
  '~~,ff.......TTTTTT..hh.......,~~',
  '~~,f........TTTTTT...........,~~',
  '~~,.........TTTTTT.....vvv....,~',
  '~~,,........TTTTTT....vvvvv...,~',
  '~~~,..................vvvvvv..,~',
  '~~~,..hh..............vvvvvvv.,~',
  '~~~,.hhhh..........ff..vvvvv..,~',
  '~~~,,hhh..........ffff..vvv..,,~',
  '~~~~,,...........ffffff......,~~',
  '~~~~~,,.........ffffff......,,~~',
  '~~~~~~,,,......fff.........,,~~~',
  '~~~~~~~~,,,,...........,,,,~~~~~',
  '~~~~~~~~~~~,,,,,,,,,,,,,~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

/** Roads, as waypoints in tiles (the square's streets carried out to the island's places). */
export const ROADS: readonly (readonly [number, number])[][] = [
  // North out of the square and east along the hills to the Slagstone mountain's cave.
  [[22, 0], [22, -8], [40, -6], [56, 4], [66, 12]],
  // West, through the meadows to the Emberwood's edge and the western shore.
  [[0, 15], [-14, 15], [-30, 19], [-52, 18], [-70, 14]],
  // East, into the Ashfields to the Caldera.
  [[44, 15], [60, 16], [74, 22], [86, 30]],
  // South over the bridge, past the southern woods to the beach.
  [[22, 34], [22, 46], [16, 60], [20, 74], [24, 92], [28, 104]],
];

/** Places worth finding, in tiles. */
export const PLACES: readonly ContinentPlace[] = [
  { kind: 'ruins', c: -48, r: -38, name: 'The Sunken Chapel' },
  // The chapel's old burial plot, off every road: a few Bone Walkers stir between the graves (gentle, for the curious).
  { kind: 'graveyard', c: -46, r: -27, name: 'The Hushed Barrow' },
  { kind: 'cave', c: 68, r: 9, name: 'Slagstone Cave' },
  { kind: 'shrine', c: -50, r: 40, name: 'The Ember Shrine' },
  { kind: 'caldera', c: 88, r: 32, name: 'The Caldera' },
  { kind: 'standing-stones', c: 6, r: 62, name: 'The Ninefold Stones' },
  // The harbour on the south shore: a pier into the sea, the ship to the mainland.
  { kind: 'harbour', c: 28, r: 106, name: 'Ember Harbour' },
];

export const REGION_NAMES: Readonly<Partial<Record<Region, string>>> = {
  '~': 'The Burning Sea', ',': 'Ember Coast', '.': 'Cinder Meadows', f: 'The Emberwood', F: 'The Deep Emberwood',
  h: 'Slagstone Hills', m: 'Slagstone Hills', v: 'The Ashfields', l: 'Ashwater Lake', T: 'Basalt Seamworks',
};
/** Who lives where (td-mobs MOBS ids) and how thick: packs per 16×16-tile chunk, as a chance. */
export const REGION_MOBS: Partial<Record<Region, { types: readonly string[]; chance: number }>> = {
  f: { types: ['ash-wolf'], chance: .5 },
  F: { types: ['ash-wolf', 'ash-wolf', 'rivet-maw'], chance: .6 },
  h: { types: ['rivet-maw'], chance: .65 },
  v: { types: ['cinder-imp', 'cinder-bailiff'], chance: .75 },
  '.': { types: ['rivet-maw'], chance: .15 },
};
/**
 * The isle's lairs (canon §8.1): wolf dens in the Emberwood, where the Ash Wolves gather after the last ember fades;
 * the rivet dumps in the hills the Maws chew; the slag-cart heaps of the Ashfields where the Imps and the Bailiffs keep
 * their writs.
 */
export const REGION_HOTSPOTS: readonly ContinentHotspot[] = [
  { region: 'F', chance: .45, types: ['ash-wolf', 'ash-wolf', 'rivet-maw'], count: 5 },
  { region: 'f', chance: .3, types: ['ash-wolf'], count: 4 },
  { region: 'h', chance: .45, types: ['rivet-maw'], count: 5 },
  { region: 'v', chance: .5, types: ['cinder-imp', 'cinder-bailiff', 'cinder-imp'], count: 5 },
  // A few Maw nests out in the meadows, small (a starter's first pack fight).
  { region: '.', chance: .12, types: ['rivet-maw'], count: 3 },
];

/** The ship from Ember Harbour to Pyrehold, and back. */
export const SHIP_TO_REACH: StationDef = { id: 'ship-reach', x: 0, label: 'SHIP TO PYREHOLD', kind: 'passage', blurb: 'Sail to Pyrehold, the capital of Infernal Reach.' };
/** The second ship at Ember Harbour, nearer the shore: the long way round to Mossharbor in the Verdant Wilds, and back. */
export const SHIP_TO_MOSSHARBOR: StationDef = { id: 'ship-isle-verdant', x: 0, label: 'SHIP TO MOSSHARBOR', kind: 'passage', blurb: 'Sail the long way round to Mossharbor, on the jungle continent. Its creatures start at level 15.' };

export const EMBER_ISLE_DEF: ContinentDef = {
  id: 'ember-isle', map: EMBER_ISLE, ox: OX, oy: OY, roads: ROADS, places: PLACES, names: REGION_NAMES, mobs: REGION_MOBS, hotspots: REGION_HOTSPOTS,
  town: buildSeamworksSquare, townName: 'Basalt Seamworks', streets: { row: 15, col: 22 }, river: true,
  ways: [
    { place: 'cave', station: CAVE_IN, to: 'slagstone-cave', arrive: 'cave-out' },
    // Down under the Hushed Barrow's plot to its vault (the Sexton's Count): the door stands where the plot's stone did.
    { place: 'graveyard', station: BARROW_IN, to: 'hushed-barrow-1', arrive: 'barrow-up', at: [0, -4] },
    { place: 'harbour', station: SHIP_TO_REACH, to: 'infernal-reach', arrive: 'ship-isle', ship: true },
    { place: 'harbour', station: SHIP_TO_MOSSHARBOR, to: 'verdant-wilds', arrive: 'ship-mossharbor-isle', ship: true, along: -3 },
  ],
};
