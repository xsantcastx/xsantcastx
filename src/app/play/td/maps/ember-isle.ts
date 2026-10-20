import type { ContinentDef, ContinentPlace, Region } from '../continent';
import { buildSeamworksSquare } from '../seamworks-square';
import { CAVE_IN } from './slagstone-cave';
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
  { kind: 'cave', c: 68, r: 9, name: 'Slagstone Cave' },
  { kind: 'shrine', c: -50, r: 40, name: 'The Ember Shrine' },
  { kind: 'caldera', c: 88, r: 32, name: 'The Caldera' },
  { kind: 'standing-stones', c: 6, r: 62, name: 'The Ninefold Stones' },
  // The harbour on the south shore: a pier into the sea, the ship to the mainland.
  { kind: 'harbour', c: 28, r: 106, name: 'Ember Harbour' },
];

export const REGION_NAMES: Readonly<Record<Region, string>> = {
  '~': 'The Burning Sea', ',': 'Ember Coast', '.': 'Cinder Meadows', f: 'The Emberwood', F: 'The Deep Emberwood',
  h: 'Slagstone Hills', m: 'Slagstone Hills', v: 'The Ashfields', l: 'Ashwater Lake', T: 'Basalt Seamworks',
};
/** Who lives where (td-mobs MOBS ids) and how thick: packs per 16×16-tile chunk, as a chance. */
export const REGION_MOBS: Partial<Record<Region, { types: readonly string[]; chance: number }>> = {
  f: { types: ['ash-wolf'], chance: .3 },
  F: { types: ['ash-wolf', 'ash-wolf', 'rivet-maw'], chance: .5 },
  h: { types: ['rivet-maw'], chance: .45 },
  v: { types: ['cinder-imp', 'cinder-bailiff'], chance: .55 },
  '.': { types: ['rivet-maw'], chance: .08 },
};

/** The ship from Ember Harbour to Pyrehold, and back. */
export const SHIP_TO_REACH: StationDef = { id: 'ship-reach', x: 0, label: 'SHIP TO PYREHOLD', kind: 'passage', blurb: 'Sail to Pyrehold, the capital of Infernal Reach.' };

export const EMBER_ISLE_DEF: ContinentDef = {
  id: 'ember-isle', map: EMBER_ISLE, ox: OX, oy: OY, roads: ROADS, places: PLACES, names: REGION_NAMES, mobs: REGION_MOBS,
  town: buildSeamworksSquare, townName: 'Basalt Seamworks', streets: { row: 15, col: 22 }, river: true,
  ways: [
    { place: 'cave', station: CAVE_IN, to: 'slagstone-cave', arrive: 'cave-out' },
    { place: 'harbour', station: SHIP_TO_REACH, to: 'infernal-reach', arrive: 'ship-isle', ship: true },
  ],
};
