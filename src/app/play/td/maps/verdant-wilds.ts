/**
 * verdant-wilds.ts — the Verdant Wilds, the jungle continent, and Rootglass, its capital in the canopy
 * (docs/design/world-map.md: levels 15–40). Drawn by hand like Ember Isle and the Reach: the region map (one character
 * per 8×8 tiles), roads out of Rootglass's boardwalks, places worth finding, who lives where.
 *
 * Rootglass is built on boardwalks over a marsh, round the Rootglass Bole — a giant tree whose floors go up into the
 * canopy (maps/rootglass-bole.ts). South down the boardwalk road lies Mossharbor, whose ship sails to Pyrehold; west,
 * past the Rootwater, the hamlet of Thornwick in the Fernglades; east, across the second river, the Sunken Courts and
 * the Overgrown Temple's gate (maps/overgrown-temple.ts).
 *
 * Region legend: ~ the sea · , the mossy shore · . the Fernglades (grass and flowers) · j the Greenwood (jungle, moss
 * underfoot) · J the Deep Wilds (dense jungle, the giant trees) · r a river · l the Glassmere · u the Sunken Courts
 * (temple ruins) · T Rootglass.
 */
import type { StationDef } from '../../world/world.model';
import type { ContinentDef, ContinentPlace, Region } from '../continent';
import { buildTown } from '../town-builder';
import { BOLE_DOOR } from './rootglass-bole';
import { TEMPLE_IN } from './overgrown-temple';

/** Mossharbor's ship, at its pier's end: across the sea to Pyrehold (Pyrehold's own ship back is SHIP_TO_VERDANT). */
export const MOSSHARBOR_SHIP: StationDef = { id: 'ship-mossharbor', x: 0, label: 'SHIP TO PYREHOLD', kind: 'passage', blurb: 'A moss-sailed sloop bound for Pyrehold, in Infernal Reach.' };

export const VERDANT_WILDS: readonly string[] = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~,,,,,,,,r,,,~~~~~~~~~~~,,,,,,,,,~~~~~~',
  '~~~~,,jjjjjjjjrjj,,,,~~~~,,,,rjJJuuuuJ,,~~~~',
  '~~~,,jjJJJJJjjrjjjj..,,,,jjjjrJJuuuuuuJJ,~~~',
  '~~,,jjJJJJJJJjjrjj....jjjjjjjrJJuuuuuuuJJ,~~',
  '~~,jj..JJJJJJjjrj.....jjjjjjjrJJJuuuuuJJJ,~~',
  '~~,j....JJJJJjjjr.....jjjjjjjrJJJJJuuJJJJ,~~',
  '~~,.......JJJJjjr.TTTTTTjjjjjjrJJJJJJJJJj,~~',
  '~~,......jjJJJjjr.TTTTTTjjjjjjjrJJJJJJJjj,~~',
  '~~,,......jjjjjjr.TTTTTTjjjjjjjrjjJJJJjjj,~~',
  '~~~,......jjjjjr..TTTTTTjjjjjjjrjjjjJJjjj,~~',
  '~~~,.......jjjjr..TTTTTTjjjjjjjrjjjjjjjj,,~~',
  '~~~,,......jjjr........jjjjjjjjrjjjjjjj,~~~~',
  '~~~~,.......jjr.......jjjjjlljjrjjjjjj,,~~~~',
  '~~~~,,......jr........jjjjllljjrJJJjjj,~~~~~',
  '~~~~~,,.....r........jjjjjjjjjjrJJJjj,,~~~~~',
  '~~~~~~,,...r........jjjjjjjjjjjrjjj,,~~~~~~~',
  '~~~~~~~,,,r,,......jjj,,,,,,jjjr,,,~~~~~~~~~',
  '~~~~~~~~~~r~~,,,,,,,,~~~~~~~,,,r~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

const ROOTGLASS_ROWS: readonly string[] = [
  '......................====......................',
  '..gg..................====..................gg..',
  '...wwww==www..........====..........www==wwww...',
  '..wwwww==wwww.........====.........wwww==wwwww..',
  '..w==========.........====.........===========..',
  '..w==========...oooooo====oooooo...===========..',
  '..wwwww==wwww..oooooooooooooooooo..wwww==wwwww..',
  '...wwww==www...oooooooooooooooooo...www==wwww...',
  '.......==......oooooooooooooooooo......==.......',
  '.......==......oooooooooooooooooo......==.......',
  '.......========oooooooooooooooooo========.......',
  '.......========oooooooooooooooooo========.......',
  '.......==......oooooooooooooooooo......==.......',
  '.......==......oooooooooooooooooo......==.......',
  '.......==......oooooooooooooooooo......==.......',
  '.......==......oooooooooooooooooo......==.......',
  '.......==.......oooooooooooooooo.......==.......',
  '================================================',
  '================================================',
  '================================================',
  '......................====......................',
  '.gg...................====......................',
  '......................====...................gg.',
  '..wwwwwwww............====............wwwwwwww..',
  '.wwwwwwwwww...........====...........wwwwwwwwww.',
  '.wwwwwwwwww...........====...........wwwwwwwwww.',
  '.ww========...........====...........========ww.',
  '.ww========....wwww...====...wwww....========ww.',
  '.wwwwwwwwww...wwwwww..====..wwwwww...wwwwwwwwww.',
  '.wwwwwwwwww...====================...wwwwwwwwww.',
  '..wwwwwwww....wwwwww..====..wwwwww....wwwwwwww..',
  '...............wwww...====...wwww...............',
  '............gg........====.........gg...........',
  '......................====......................',
];

/**
 * Rootglass: its ground drawn above (= boardwalk, w marsh water, . moss, g grass, o the plaza's old flagstones). The
 * Bole stands at the plaza's head; stalls round it, rootglass lamps along every boardwalk, houses on the moss islands.
 */
export const buildRootglass = () => buildTown({
  id: 'rootglass',
  rows: ROOTGLASS_ROWS,
  legend: { '=': 'plank', w: 'water', '.': 'moss', g: 'grass', o: 'flagstone' },
  houses: [
    { c: 4, r: 12, w: 5, d: 3, roof: 'leaf', wall: 'timber' }, { c: 43, r: 12, w: 5, d: 3, roof: 'leaf', wall: 'timber' },
    { c: 11, r: 15, w: 5, d: 3, roof: 'thatch', wall: 'timber' }, { c: 36, r: 15, w: 5, d: 3, roof: 'leaf', wall: 'stone' },
    { c: 17, r: 25, w: 5, d: 3, roof: 'leaf', wall: 'stone' }, { c: 30, r: 25, w: 5, d: 3, roof: 'thatch', wall: 'timber' },
  ],
  stalls: [
    { station: 'runes', c: 18, r: 8, w: 4, palette: 3, goods: 'gems' },
    { station: 'enchanting', c: 30, r: 8, w: 4, palette: 1, goods: 'books' },
    { station: 'vault', c: 18, r: 13, w: 4, palette: 2, goods: 'pots' },
    { station: 'crafting', c: 30, r: 13, w: 4, palette: 0, goods: 'tools' },
    { station: 'vendor', c: 4, r: 16, w: 4, palette: 4, goods: 'bread' },
  ],
  props: [
    { kind: 'rootlamp', c: 21, r: 2 }, { kind: 'rootlamp', c: 26, r: 2 }, { kind: 'rootlamp', c: 14, r: 16 }, { kind: 'rootlamp', c: 33, r: 16 },
    { kind: 'rootlamp', c: 14, r: 20 }, { kind: 'rootlamp', c: 33, r: 20 }, { kind: 'rootlamp', c: 21, r: 24 }, { kind: 'rootlamp', c: 26, r: 24 },
    { kind: 'rootlamp', c: 21, r: 31 }, { kind: 'rootlamp', c: 26, r: 31 }, { kind: 'rootlamp', c: 9, r: 16 }, { kind: 'rootlamp', c: 41, r: 16 },
    { kind: 'waystone', c: 20, r: 15 }, { kind: 'bench', c: 17, r: 16 }, { kind: 'bench', c: 30, r: 16 },
    { kind: 'barrel', c: 10, r: 16 }, { kind: 'crate', c: 14, r: 13 }, { kind: 'barrel', c: 33, r: 13 },
    { kind: 'signpost', c: 20, r: 0 }, { kind: 'signpost', c: 2, r: 16 }, { kind: 'signpost', c: 45, r: 16 }, { kind: 'signpost', c: 27, r: 33 },
    { kind: 'flowerbed', c: 16, r: 6 }, { kind: 'flowerbed', c: 31, r: 6 },
    { kind: 'jungle', c: 1, r: 15 }, { kind: 'jungle', c: 46, r: 15 }, { kind: 'jungle', c: 14, r: 2 }, { kind: 'jungle', c: 33, r: 2 },
    { kind: 'jungle', c: 18, r: 1 }, { kind: 'jungle', c: 29, r: 1 }, { kind: 'jungle', c: 10, r: 21 }, { kind: 'jungle', c: 37, r: 21 },
    { kind: 'jungle', c: 18, r: 33 }, { kind: 'jungle', c: 30, r: 33 }, { kind: 'jungle', c: 12, r: 33 }, { kind: 'jungle', c: 35, r: 33 },
    { kind: 'giant-tree', c: 5, r: 33 }, { kind: 'giant-tree', c: 42, r: 33 },
    { kind: 'fern', c: 12, r: 8 }, { kind: 'fern', c: 35, r: 8 }, { kind: 'fern', c: 13, r: 22 }, { kind: 'fern', c: 34, r: 22 },
    { kind: 'fern', c: 5, r: 20 }, { kind: 'fern', c: 42, r: 20 }, { kind: 'fern', c: 3, r: 8 }, { kind: 'fern', c: 44, r: 8 },
  ],
  // The Rootglass Bole: a door between its roots onto the Root Hall, and three floors above it in the canopy.
  towers: [{ c: 24, r: 9, door: BOLE_DOOR, look: 'bole' }],
  spawn: { c: 24, r: 21 },
});

const MOSSHARBOR_ROWS: readonly string[] = [
  '..............===...............',
  '..gg..........===...............',
  '..............===...........gg..',
  '..............===...............',
  '..............===...............',
  '================================',
  '================================',
  '..............===...............',
  '.........g....===.....g.........',
  '..............===...............',
  'ssssssssssssss===sssssssssssssss',
  'ssssssssssssss===sssssssssssssss',
  'wwwwwwwwwwwwww=========wwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
];

/** Mossharbor, on the south shore: a boardwalk street, leaf-roofed houses, a pier out to the moss-sailed ship. */
export const buildMossharbor = () => buildTown({
  id: 'mossharbor',
  rows: MOSSHARBOR_ROWS,
  legend: { '=': 'plank', '.': 'moss', g: 'grass', s: 'sand', w: 'water' },
  houses: [
    { c: 5, r: 4, w: 5, d: 3, roof: 'leaf', wall: 'timber' }, { c: 26, r: 4, w: 5, d: 3, roof: 'thatch', wall: 'timber' },
    { c: 6, r: 9, w: 5, d: 2, roof: 'leaf', wall: 'stone' }, { c: 25, r: 9, w: 5, d: 2, roof: 'leaf', wall: 'timber' },
  ],
  stalls: [],
  props: [
    { kind: 'rootlamp', c: 13, r: 4 }, { kind: 'rootlamp', c: 17, r: 4 }, { kind: 'rootlamp', c: 13, r: 9 }, { kind: 'rootlamp', c: 17, r: 9 },
    { kind: 'barrel', c: 12, r: 11 }, { kind: 'barrel', c: 11, r: 11 }, { kind: 'crate', c: 18, r: 11 }, { kind: 'crate', c: 19, r: 11 },
    { kind: 'signpost', c: 12, r: 1 }, { kind: 'bench', c: 10, r: 8 }, { kind: 'waystone', c: 19, r: 2 },
    { kind: 'jungle', c: 1, r: 2 }, { kind: 'jungle', c: 30, r: 1 }, { kind: 'jungle', c: 9, r: 1 }, { kind: 'fern', c: 21, r: 8 }, { kind: 'fern', c: 2, r: 8 },
    { kind: 'verdant-ship', c: 19, r: 16 },
  ],
  spawn: { c: 15, r: 7 },
});

const THORNWICK_ROWS: readonly string[] = [
  '.............pp.............',
  '.............pp.............',
  '.............pp.............',
  '.............pp.............',
  '.............pp.............',
  '......gggggggppggggggg......',
  '.....gggffgggppgggggfgg.....',
  '.....ggggggggppggggggg......',
  'pppppppppppppppppppppppppppp',
  'pppppppppppppppppppppppppppp',
  '.....ggggggggppgggggggg.....',
  '.....ggfgggggppgggffggg.....',
  '......gggggggppggggggg......',
  '.............pp.............',
  '.............pp.............',
  '.............pp.............',
  '.............pp.............',
  '.............pp.............',
];

/** Thornwick, a hamlet in the Fernglades: four leaf-roofed cottages round a green, a crossroads of dirt paths. */
export const buildThornwick = () => buildTown({
  id: 'thornwick',
  rows: THORNWICK_ROWS,
  legend: { p: 'dirt', '.': 'moss', g: 'grass', f: 'flowers' },
  houses: [
    { c: 8, r: 5, w: 5, d: 3, roof: 'leaf', wall: 'timber' }, { c: 20, r: 5, w: 5, d: 3, roof: 'thatch', wall: 'timber' },
    { c: 8, r: 16, w: 5, d: 3, roof: 'thatch', wall: 'timber' }, { c: 20, r: 16, w: 5, d: 3, roof: 'leaf', wall: 'stone' },
  ],
  stalls: [],
  props: [
    { kind: 'waystone', c: 16, r: 11 }, { kind: 'signpost', c: 12, r: 7 }, { kind: 'bench', c: 10, r: 11 },
    { kind: 'rootlamp', c: 12, r: 10 }, { kind: 'rootlamp', c: 15, r: 7 },
    { kind: 'fence', c: 3, r: 11 }, { kind: 'fence', c: 24, r: 11 }, { kind: 'flowerbed', c: 17, r: 6 }, { kind: 'flowerbed', c: 6, r: 12 },
    { kind: 'jungle', c: 1, r: 2 }, { kind: 'jungle', c: 26, r: 3 }, { kind: 'jungle', c: 2, r: 15 }, { kind: 'jungle', c: 25, r: 16 },
    { kind: 'fern', c: 4, r: 6 }, { kind: 'fern', c: 23, r: 13 },
  ],
  spawn: { c: 13, r: 9 },
});

export const VERDANT_PLACES: readonly ContinentPlace[] = [
  // The Overgrown Temple's stepped gate in the Sunken Courts, at the east road's end.
  { kind: 'temple', c: 150, r: -20, name: 'The Overgrown Temple' },
  { kind: 'shrine', c: 4, r: -30, name: 'The Moss Altar' },
  { kind: 'ruins', c: 80, r: 40, name: 'The Drowned Aqueduct' },
  { kind: 'standing-stones', c: -56, r: 44, name: 'The Ring of Thorns' },
];

export const VERDANT_NAMES: Readonly<Partial<Record<Region, string>>> = {
  '~': 'The Verdant Sea', ',': 'The Mossy Shore', '.': 'The Fernglades', j: 'The Greenwood', J: 'The Deep Wilds',
  r: 'The Rootwater', l: 'The Glassmere', u: 'The Sunken Courts', T: 'Rootglass',
};

export const VERDANT_WILDS_DEF: ContinentDef = {
  id: 'verdant-wilds', map: VERDANT_WILDS, ox: 18, oy: 7,
  roads: [
    // North to the Moss Altar.
    [[23, 0], [20, -14], [6, -26]],
    // West over the Rootwater to Thornwick.
    [[0, 18], [-24, 20], [-56, 14], [-84, 12]],
    // East over the second river, through the Greenwood, to the temple's gate.
    [[47, 18], [76, 14], [100, 4], [124, -6], [146, -10], [150, -14]],
    // South down the boardwalk road to Mossharbor.
    [[23, 33], [24, 48], [36, 62], [55, 77]],
    // A branch off the east road to the Drowned Aqueduct.
    [[76, 14], [80, 36]],
  ],
  places: VERDANT_PLACES, names: VERDANT_NAMES,
  mobs: {
    '.': { types: ['canopy-bat', 'moss-stalker'], chance: .2 },
    j: { types: ['canopy-bat', 'moss-stalker', 'moss-stalker', 'vine-lasher'], chance: .4 },
    J: { types: ['vine-lasher', 'moss-stalker', 'rootglass-hart', 'thorn-weaver'], chance: .5 },
    u: { types: ['thorn-weaver', 'vine-lasher', 'canopy-bat'], chance: .5 },
  },
  town: buildRootglass, townName: 'Rootglass', streets: { row: 18, col: 23 }, river: false,
  roadGround: { near: 'plank', far: 'dirt' },
  ways: [
    { place: 'temple', station: TEMPLE_IN, to: 'overgrown-temple-1', arrive: 'temple-out' },
  ],
  villages: [
    // Mossharbor's sloop sails from the pier's end (the village's tile 15, 16) to Pyrehold Harbour.
    { name: 'Mossharbor', c: 40, r: 78, build: buildMossharbor, ways: [{ station: MOSSHARBOR_SHIP, c: 15, r: 16, to: 'infernal-reach', arrive: 'ship-verdant', ship: true }] },
    { name: 'Thornwick', c: -112, r: 4, build: buildThornwick },
  ],
};
