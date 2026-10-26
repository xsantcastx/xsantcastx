/**
 * umbral-marches.ts — the Umbral Marches, the swamp continent, and Gloamhaven, its capital on stilts over the black
 * water (docs/design/world-map.md: levels 25–50). Drawn by hand like the Reach and the Wilds: the region map (one
 * character per 8×8 tiles), boardwalk roads out of Gloamhaven, places worth finding, who lives where. Mist lies over
 * all of it (ContinentDef.fog), thinning round the Keeper and every lantern.
 *
 * Gloamhaven stands over the fen on boardwalks round the old abbey town's drowned square, its streets lit by lantern
 * posts that never go out; the Lantern Tower guides boats in through the fog (maps/lantern-tower.ts, floors +1…+2).
 * South down the boardwalk road lies Mirewatch, whose ship sails to Pyrehold; west, in the deep fen, the hamlet of
 * Lanternfen; north-east, in the drowned ruins, the door down into the Drowned Crypts (maps/drowned-crypts.ts).
 *
 * Region legend: ~ the sea · , the shore · q the Gloaming Fen (bog, black pools) · Q the Deep Fen (more water than
 * land, the old cypresses) · k the Black Meres · x the Drowned Ruins (the abbey town's stones, half under the bog) ·
 * T Gloamhaven.
 */
import type { StationDef } from '../../world/world.model';
import type { ContinentDef, ContinentPlace, Region } from '../continent';
import { buildTown } from '../town-builder';
import { TOWER_DOOR } from './lantern-tower';
import { CRYPTS_IN } from './drowned-crypts';

/** Mirewatch's ship, at its pier's end: across the sea to Pyrehold (Pyrehold's own ship back is SHIP_TO_UMBRAL). */
export const MIREWATCH_SHIP: StationDef = { id: 'ship-mirewatch', x: 0, label: 'SHIP TO PYREHOLD', kind: 'passage', blurb: 'A black-hulled ketch with a lantern at its bow, bound for Pyrehold in Infernal Reach.' };

export const UMBRAL_MARCHES: readonly string[] = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~,,,,,,,,,~~~~~~~~~~~~,,,,,,,,,,,~~~~~~',
  '~~~~,,qqqqqqqqq,,,,~~~~,,,,qqqqQQQQQQQ,,~~~~',
  '~~~,qqqqQQQQqqqqqqq,,,,,qqqqqQQQQxxxxQQ,,~~~',
  '~~,qqqQQQQQQQqqqkkkqqqqqqqqqqQQQxxxxxxQQ,~~~',
  '~~,qqQQQQQQQQqqkkkkkqqqqqqqqqQQQQxxxxxQQQ,~~',
  '~~,qqqQQQQQQqqqqkkkqqqqqqqqqqqQQQQQxxQQQQ,~~',
  '~~,qqqqqQQQQqqqqqqqTTTTTTqqqqqqqQQQQQQQq,,~~',
  '~~,qqqqqqqqqqqqqqqqTTTTTTqqqqqqqqQQQQQQqq,~~',
  '~~,,qqqqqqkkqqqqqqqTTTTTTqqqqqqqqqqQQQqqq,~~',
  '~~~,qqqqqkkkkqqqqqqTTTTTTqqqqkkkqqqqqqqqq,~~',
  '~~~,qqqqqqkkqqqqqqqqqqqqqqqqkkkkkqqqqqq,,~~~',
  '~~~,,qqqqqqqqqqqqqqqqqqqqqqqqkkkqqqqqqq,~~~~',
  '~~~~,qqqqqqqqxxxqqqqqqqqqqqqqqqqqqqqqq,,~~~~',
  '~~~~,,qqqqqqxxxxxqqqqqqqqqqqqqqqqqqqq,~~~~~~',
  '~~~~~,,qqqqqqxxxqqqqqqqqqqqqqqqqqqq,,~~~~~~~',
  '~~~~~~,,qqqqqqqqqqqqqqqqqqqqqqqqqq,,~~~~~~~~',
  '~~~~~~~,,,qqqqqqqqqqqqqqqqqqqqqqqq,,~~~~~~~~',
  '~~~~~~~~~~,,,,,,,,~~~~~~~~,,,,,,,,~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

const GLOAMHAVEN_ROWS: readonly string[] = [
  'wwwmmmmmwwwwwwwwwwwwww====wwwwwwwwwwwwwmmmmmmwww',
  'wwwmmmmmwwwwwwwwwwwwww====wwwwwwwwwwwwwmmmmmmwww',
  'ww==========wwwwwwwwww====wwwwwwwwww==========ww',
  'ww==========wwwwwwwwww====wwwwwwwwww==========ww',
  'ww==========wwwwwwwwww====wwwwwwwwww==========ww',
  'ww==========www=====ww====ww=====www==========ww',
  'ww==========w======================w==========ww',
  'ww==========w==oooooooooooooooooo==w==========ww',
  'ww==========w==oooooooooooooooooo==w==========ww',
  'mmmwww==wwwww==oooooooooooooooooo==wwwww==wwwmmm',
  'mmmwww==wwwww==oooooooooooooooooo==wwwww==wwwmmm',
  'mmmwww=========oooooooooooooooooo=========wwwmmm',
  'mmmwww=========oooooooooooooooooo=========wwwmmm',
  'mmmwww=========oooooooooooooooooo=========wwwmmm',
  'wwwwww==wwwww==oooooooooooooooooo==wwwww==wwwwww',
  'wwwwww==wwwww==oooooooooooooooooo==wwwww==wwwwww',
  'wwwwww==wwwww==oooooooooooooooooo==wwwww==wwwwww',
  '================================================',
  '================================================',
  '================================================',
  'wwwwww==wwwwwwwwwwwwww====wwwwwwwwwwwwww==wwwwww',
  'wwwwww==wwwwwwwwwwwwww====wwwwwwwwwwwwww==wwwwww',
  'ww===========wwwwwwwww====wwwwwwwww===========ww',
  'ww===========ww======w====w======ww===========ww',
  'ww===========ww======w====w======ww===========ww',
  'ww===========ww==================ww===========ww',
  'ww===========ww==================ww===========ww',
  'ww===========ww======w====w======ww===========ww',
  'mm===========ww======w====w======ww===========ww',
  'mmmmmwwwwwwwwwwwwwwwww====wwwwwwwwwwwwwwwwwmmmmm',
  'mmmmmwwwwwwwmmmmwwwwww====wwwwwwwmmmmwwwwwwmmmmm',
  'mmmmmwwwwwwwmmmmwwwwww====wwwwwwwmmmmwwwwwwmmmmm',
  'mmmmmwwwwwwwmmmmwwwwww====wwwwwwwmmmmwwwwwwmmmmm',
  'wwwwwwwwwwwwmmmmwwwwww====wwwwwwwmmmmwwwwwwmmmmm',
];

/**
 * Gloamhaven: its ground drawn above (= the boardwalks, w the black water, m bog islets, o the drowned square's old stones).
 * The Lantern Tower stands on its stilts at the square's north-west, over the water; the ferryman's house opposite.
 * Stalls round the square, the fishmonger on the west jetty, a lantern post at every turn of the boardwalks, houses
 * on their own platforms, cypresses hung with moss on the islets, reeds in the water.
 */
export const buildGloamhaven = () => buildTown({
  id: 'gloamhaven',
  rows: GLOAMHAVEN_ROWS,
  legend: { '=': 'boardwalk', w: 'blackwater', m: 'mire', o: 'wetstone' },
  houses: [
    { c: 6, r: 6, w: 5, d: 3, roof: 'gloam', wall: 'timber' }, { c: 41, r: 6, w: 5, d: 3, roof: 'gloam', wall: 'stone' },
    { c: 7, r: 26, w: 5, d: 3, roof: 'slate', wall: 'timber' }, { c: 40, r: 26, w: 5, d: 3, roof: 'gloam', wall: 'timber' },
    { c: 17, r: 26, w: 4, d: 2, roof: 'gloam', wall: 'stone' }, { c: 30, r: 26, w: 4, d: 2, roof: 'slate', wall: 'timber' },
    // The ferryman's house, on stilts over the water opposite the tower.
    { c: 30, r: 4, w: 5, d: 2, roof: 'gloam', wall: 'timber' },
  ],
  stalls: [
    { station: 'runes', c: 18, r: 9, w: 4, palette: 3, goods: 'gems' },
    { station: 'enchanting', c: 30, r: 9, w: 4, palette: 3, goods: 'books' },
    { station: 'vault', c: 18, r: 14, w: 4, palette: 1, goods: 'pots' },
    { station: 'crafting', c: 30, r: 14, w: 4, palette: 4, goods: 'tools' },
    // The fishmonger's, out on the west jetty.
    { station: 'vendor', c: 10, r: 11, w: 4, palette: 1, goods: 'fish' },
  ],
  props: [
    // Lanterns: the square's four corners, along the main street, down the south boardwalk, up the north one, the jetties.
    { kind: 'lantern', c: 15, r: 7 }, { kind: 'lantern', c: 32, r: 7 }, { kind: 'lantern', c: 15, r: 16 }, { kind: 'lantern', c: 32, r: 16 },
    { kind: 'lantern', c: 3, r: 17 }, { kind: 'lantern', c: 11, r: 19 }, { kind: 'lantern', c: 19, r: 17 }, { kind: 'lantern', c: 28, r: 19 },
    { kind: 'lantern', c: 36, r: 17 }, { kind: 'lantern', c: 44, r: 19 },
    { kind: 'lantern', c: 22, r: 22 }, { kind: 'lantern', c: 25, r: 26 }, { kind: 'lantern', c: 22, r: 30 }, { kind: 'lantern', c: 25, r: 33 },
    { kind: 'lantern', c: 22, r: 2 }, { kind: 'lantern', c: 25, r: 4 }, { kind: 'lantern', c: 39, r: 13 }, { kind: 'lantern', c: 8, r: 13 },
    { kind: 'lantern', c: 2, r: 8 }, { kind: 'lantern', c: 45, r: 8 }, { kind: 'lantern', c: 2, r: 22 }, { kind: 'lantern', c: 45, r: 22 },
    { kind: 'waystone', c: 27, r: 11 }, { kind: 'bench', c: 20, r: 16 }, { kind: 'bench', c: 27, r: 16 },
    { kind: 'barrel', c: 36, r: 11 }, { kind: 'barrel', c: 37, r: 11 }, { kind: 'crate', c: 12, r: 13 }, { kind: 'crate', c: 10, r: 2 },
    { kind: 'barrel', c: 44, r: 2 }, { kind: 'crate', c: 3, r: 28 }, { kind: 'barrel', c: 44, r: 28 },
    { kind: 'signpost', c: 21, r: 0 }, { kind: 'signpost', c: 1, r: 18 }, { kind: 'signpost', c: 46, r: 18 }, { kind: 'signpost', c: 26, r: 32 },
    // The islets: cypresses hung with moss, gloomcaps under them; reeds standing in the black water.
    { kind: 'swamp-tree', c: 5, r: 1 }, { kind: 'swamp-tree', c: 42, r: 1 }, { kind: 'swamp-tree', c: 2, r: 31 }, { kind: 'swamp-tree', c: 45, r: 32 },
    { kind: 'swamp-tree', c: 14, r: 32 }, { kind: 'swamp-tree', c: 35, r: 32 }, { kind: 'swamp-tree', c: 1, r: 12 }, { kind: 'swamp-tree', c: 46, r: 12 },
    { kind: 'gloomcap', c: 7, r: 0 }, { kind: 'gloomcap', c: 40, r: 0 }, { kind: 'gloomcap', c: 4, r: 30 }, { kind: 'gloomcap', c: 44, r: 30 },
    { kind: 'gloomcap', c: 12, r: 31 }, { kind: 'gloomcap', c: 33, r: 31 }, { kind: 'gloomcap', c: 2, r: 10 }, { kind: 'gloomcap', c: 45, r: 10 },
    { kind: 'reeds', c: 13, r: 3 }, { kind: 'reeds', c: 34, r: 3 }, { kind: 'reeds', c: 3, r: 15 }, { kind: 'reeds', c: 44, r: 15 },
    { kind: 'reeds', c: 9, r: 21 }, { kind: 'reeds', c: 38, r: 21 }, { kind: 'reeds', c: 19, r: 30 }, { kind: 'reeds', c: 29, r: 30 },
    { kind: 'reeds', c: 13, r: 21 }, { kind: 'reeds', c: 34, r: 20 }, { kind: 'reeds', c: 10, r: 15 }, { kind: 'reeds', c: 37, r: 15 },
    { kind: 'reeds', c: 20, r: 1 }, { kind: 'reeds', c: 27, r: 0 },
  ],
  // The Lantern Tower: on stilts over the water, its door onto the landing; two floors up to the Great Lantern.
  towers: [{ c: 17, r: 4, door: TOWER_DOOR, look: 'lantern' }],
  spawn: { c: 24, r: 21 },
});

const MIREWATCH_ROWS: readonly string[] = [
  'mmwwwwmmmmmmmm===mmmmmmmmmmmmmmm',
  'mmwwwwmmmmmmmm===mmmmmmmmwwwwwmm',
  'mmwwwwmmmmmmmm===mmmmmmmmwwwwwmm',
  'mmmmmmmmmmmmmm===mmmmmmmmwwwwwmm',
  'mmmmmmmmmmmmmm===mmmmmmmmmmmmmmm',
  '================================',
  '================================',
  'mmmmmmmmmmmmmm===mmmmmmmmmmmmmmm',
  'wwwwmmmmmmmmmm===mmmmmmmmmmmwwww',
  'wwwwmmmmmmmmmm===mmmmmmmmmmmwwww',
  'ssssssssssssss===sssssssssssssss',
  'ssssssssssssss===sssssssssssssss',
  'WWWWWWWWWWWWWW=========WWWWWWWWW',
  'WWWWWWWWWWWWWW===WWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWW===WWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWW===WWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWW===WWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWW===WWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

/**
 * Mirewatch, on the south shore: a boardwalk crossroads in the bog, stilt houses, the old watchtower on the beach whose
 * lantern still turns, and a pier out to the black-hulled ketch.
 */
export const buildMirewatch = () => buildTown({
  id: 'mirewatch',
  rows: MIREWATCH_ROWS,
  legend: { '=': 'boardwalk', m: 'mire', w: 'blackwater', s: 'sand', W: 'water' },
  houses: [
    { c: 8, r: 4, w: 5, d: 3, roof: 'gloam', wall: 'timber' }, { c: 22, r: 4, w: 5, d: 3, roof: 'slate', wall: 'timber' },
    { c: 7, r: 9, w: 5, d: 2, roof: 'gloam', wall: 'stone' }, { c: 23, r: 9, w: 5, d: 2, roof: 'gloam', wall: 'timber' },
  ],
  stalls: [],
  props: [
    { kind: 'lantern', c: 13, r: 2 }, { kind: 'lantern', c: 17, r: 4 }, { kind: 'lantern', c: 13, r: 8 }, { kind: 'lantern', c: 17, r: 9 },
    { kind: 'lantern', c: 14, r: 15 }, { kind: 'lantern', c: 16, r: 13 }, { kind: 'lantern', c: 1, r: 4 }, { kind: 'lantern', c: 30, r: 4 },
    { kind: 'barrel', c: 12, r: 11 }, { kind: 'barrel', c: 11, r: 11 }, { kind: 'crate', c: 18, r: 11 }, { kind: 'crate', c: 21, r: 12 },
    { kind: 'signpost', c: 12, r: 0 }, { kind: 'bench', c: 10, r: 7 }, { kind: 'waystone', c: 19, r: 3 },
    { kind: 'swamp-tree', c: 1, r: 1 }, { kind: 'swamp-tree', c: 30, r: 0 }, { kind: 'swamp-tree', c: 1, r: 8 }, { kind: 'swamp-tree', c: 30, r: 9 },
    { kind: 'reeds', c: 3, r: 2 }, { kind: 'reeds', c: 27, r: 3 }, { kind: 'reeds', c: 2, r: 9 }, { kind: 'reeds', c: 29, r: 8 },
    { kind: 'gloomcap', c: 20, r: 8 }, { kind: 'gloomcap', c: 4, r: 4 },
    { kind: 'umbral-ship', c: 19, r: 16 },
  ],
  // The watchtower on the beach: no way up, but its lantern still guides the ketch in.
  towers: [{ c: 27, r: 11, look: 'lantern' }],
  spawn: { c: 15, r: 7 },
});

const LANTERNFEN_ROWS: readonly string[] = [
  'wwwwwmmmmmmmm==mmmmmwwwwwwww',
  'wwwwwmmmmmmmm==mmmmmwwwwwwww',
  'wwwwwmmmmmmmm==mmmmmwwwwwwww',
  'wwwwwmmmmwwwm==mmmmmmmmmmmmm',
  'mmmmmmmmmwwwm==mmmmmmmmmmmmm',
  'mmmmmmmmmmmmm==mmmmmmmmmmmmm',
  'mmmmmmmmmm========mmmmmmmmmm',
  'mmmmmmmmmm==oooo==mmmmmmmmmm',
  '============oooo============',
  '============oooo============',
  'mmmmmmmmmm==oooo==mmmmmmmmmm',
  'mmmmmmmmmm========mmmmmmmmmm',
  'mmmmmmmmmmmmm==mmwwwmmmmmmmm',
  'wwwwwwmmmmmmm==mmwwwmmwwwwww',
  'wwwwwwmmmmmmm==mmmmmmmwwwwww',
  'wwwwwwmmmmmmm==mmmmmmmwwwwww',
  'wwwwwwmmmmmmm==mmmmmmmwwwwww',
  'wwwwwwmmmmmmm==mmmmmmmwwwwww',
];

/** Lanternfen, a hamlet on hummocks in the deep fen: four stilt cottages round a lantern green, a ring of gloomcaps. */
export const buildLanternfen = () => buildTown({
  id: 'lanternfen',
  rows: LANTERNFEN_ROWS,
  legend: { '=': 'boardwalk', m: 'mire', w: 'blackwater', o: 'wetstone' },
  houses: [
    { c: 6, r: 6, w: 5, d: 3, roof: 'gloam', wall: 'timber' }, { c: 22, r: 6, w: 5, d: 3, roof: 'thatch', wall: 'timber' },
    { c: 9, r: 15, w: 5, d: 3, roof: 'thatch', wall: 'timber' }, { c: 20, r: 15, w: 5, d: 3, roof: 'gloam', wall: 'stone' },
  ],
  stalls: [],
  props: [
    { kind: 'lantern', c: 11, r: 7 }, { kind: 'lantern', c: 16, r: 7 }, { kind: 'lantern', c: 11, r: 10 }, { kind: 'lantern', c: 16, r: 10 },
    { kind: 'lantern', c: 13, r: 2 }, { kind: 'lantern', c: 14, r: 14 }, { kind: 'lantern', c: 2, r: 9 }, { kind: 'lantern', c: 25, r: 8 },
    { kind: 'waystone', c: 12, r: 7 }, { kind: 'signpost', c: 15, r: 0 }, { kind: 'bench', c: 15, r: 10 },
    { kind: 'gloomcap', c: 13, r: 8 }, { kind: 'gloomcap', c: 15, r: 9 }, { kind: 'gloomcap', c: 9, r: 12 }, { kind: 'gloomcap', c: 18, r: 5 },
    { kind: 'swamp-tree', c: 6, r: 1 }, { kind: 'swamp-tree', c: 18, r: 1 }, { kind: 'swamp-tree', c: 2, r: 5 }, { kind: 'swamp-tree', c: 25, r: 4 },
    { kind: 'swamp-tree', c: 7, r: 12 }, { kind: 'swamp-tree', c: 24, r: 12 },
    { kind: 'reeds', c: 5, r: 2 }, { kind: 'reeds', c: 19, r: 2 }, { kind: 'reeds', c: 6, r: 14 }, { kind: 'reeds', c: 21, r: 14 }, { kind: 'reeds', c: 12, r: 4 },
  ],
  spawn: { c: 13, r: 9 },
});

export const UMBRAL_PLACES: readonly ContinentPlace[] = [
  // The Drowned Crypts' door in the drowned ruins, at the east road's end.
  { kind: 'crypt', c: 128, r: -24, name: 'The Drowned Crypts' },
  { kind: 'shrine', c: -88, r: -16, name: 'The Gloam Shrine' },
  { kind: 'ruins', c: -36, r: 58, name: 'The Sunken Belfry' },
  { kind: 'standing-stones', c: 14, r: -30, name: 'The Lantern Ring' },
];

export const UMBRAL_NAMES: Readonly<Partial<Record<Region, string>>> = {
  '~': 'The Burning Sea', ',': 'The Gloaming Shore', q: 'The Gloaming Fen', Q: 'The Deep Fen', k: 'The Black Meres',
  x: 'The Drowned Ruins', T: 'Gloamhaven',
};

export const UMBRAL_MARCHES_DEF: ContinentDef = {
  id: 'umbral-marches', map: UMBRAL_MARCHES, ox: 19, oy: 7, fog: .55,
  roads: [
    // North up the boardwalk to the Lantern Ring, by the Black Meres.
    [[23, 0], [22, -14], [16, -26]],
    // West into the deep fen to Lanternfen, a branch on to the Gloam Shrine.
    [[0, 18], [-30, 18], [-60, 10], [-96, 2]],
    [[-60, 10], [-80, -4], [-88, -12]],
    // East through the fen to the drowned ruins and the Drowned Crypts' door.
    [[47, 18], [72, 14], [96, 2], [116, -12], [128, -19]],
    // South down the boardwalk road to Mirewatch; a branch west to the Sunken Belfry.
    [[23, 33], [24, 50], [22, 66], [23, 76]],
    [[24, 50], [-6, 54], [-32, 58]],
  ],
  places: UMBRAL_PLACES, names: UMBRAL_NAMES,
  mobs: {
    q: { types: ['mire-lurker', 'mire-lurker', 'lantern-wisp'], chance: .5 },
    Q: { types: ['mire-lurker', 'ink-hound', 'lantern-wisp', 'gloam-witch'], chance: .6 },
    k: { types: ['lantern-wisp', 'mire-lurker'], chance: .5 },
    x: { types: ['drowned-knight', 'gloam-witch', 'ink-hound', 'drowned-knight'], chance: .6 },
  },
  // Lairs (canon §8.4): the lurkers' lantern-lure pools of the fens, the Drowned Knights' patrol posts in the ruins,
  // the wisps gathered over the Black Meres.
  hotspots: [
    { region: 'q', chance: .35, types: ['mire-lurker', 'lantern-wisp', 'mire-lurker'], count: 4 },
    { region: 'Q', chance: .45, types: ['mire-lurker', 'ink-hound', 'gloam-witch'], count: 5 },
    { region: 'x', chance: .5, types: ['drowned-knight', 'gloam-witch', 'drowned-knight'], count: 5 },
    { region: 'k', chance: .4, types: ['lantern-wisp', 'mire-lurker'], count: 4 },
  ],
  town: buildGloamhaven, townName: 'Gloamhaven', streets: { row: 18, col: 23 }, river: false,
  roadGround: { near: 'boardwalk', far: 'boardwalk' },
  ways: [
    { place: 'crypt', station: CRYPTS_IN, to: 'drowned-crypts-1', arrive: 'crypts-out' },
  ],
  villages: [
    // Mirewatch's ketch sails from the pier's end (the village's tile 15, 16) to Pyrehold Harbour.
    { name: 'Mirewatch', c: 8, r: 76, build: buildMirewatch, ways: [{ station: MIREWATCH_SHIP, c: 15, r: 16, to: 'infernal-reach', arrive: 'ship-umbral', ship: true }] },
    { name: 'Lanternfen', c: -124, r: -6, build: buildLanternfen },
  ],
};
