/**
 * verdant-wilds.ts — the Verdant Wilds' towns (docs/design/world-map.md: levels 15–40): Rootglass, its capital in the
 * canopy, Mossharbor on the south shore, the hamlet of Thornwick. The land itself is an act of sections now (S11,
 * maps/wilds-sections.ts): Rootglass is its own section, Mossharbor stands on the Mossy Shore, Thornwick on the
 * Fernglades' east road.
 *
 * Rootglass is built on boardwalks over a marsh, round the Rootglass Bole — a giant tree whose floors go up into the
 * canopy (maps/rootglass-bole.ts). Mossharbor's ships sail to Pyrehold, the long way to Ember Isle, and to Mirewatch.
 */
import type { StationDef } from '../../world/world.model';
import { buildTown, shopStation } from '../town-builder';
import { BOLE_DOOR } from './rootglass-bole';
import { HERBAL_DOOR, NETLOFT_DOOR } from './verdant-houses';

/** Mossharbor's ship, at its pier's end: across the sea to Pyrehold (Pyrehold's own ship back is SHIP_TO_VERDANT). */
export const MOSSHARBOR_SHIP: StationDef = { id: 'ship-mossharbor', x: 0, label: 'SHIP TO PYREHOLD', kind: 'passage', blurb: 'A moss-sailed sloop bound for Pyrehold, in Infernal Reach.' };
/** Mossharbor's second ship, off the west finger of its pier: the long way round to Ember Harbour (ember-isle.ts SHIP_TO_MOSSHARBOR back). */
export const MOSSHARBOR_ISLE_SHIP: StationDef = { id: 'ship-mossharbor-isle', x: 0, label: 'SHIP TO EMBER ISLE', kind: 'passage', blurb: 'A rootwood ketch that sails the long way round to Ember Harbour.' };

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
    // The Bole's herb and seed counter (shared/shops alchemist; canon §6.5: Seedwife Rue Hazel).
    { station: shopStation('shop-alchemist', "RUE HAZEL'S HERB AND SEED", 'rue-hazel'), c: 18, r: 8, w: 4, palette: 3, goods: 'pots' },
    { station: 'enchanting', c: 30, r: 8, w: 4, palette: 1, goods: 'books' },
    { station: 'brews', c: 34, r: 8, w: 2, palette: 1, goods: 'pots' },
    { station: 'vault', c: 18, r: 13, w: 4, palette: 2, goods: 'pots' },
    { station: 'crafting', c: 30, r: 13, w: 4, palette: 0, goods: 'tools' },
    // The boardwalk market's general store (canon §6.5: Provisioner Teo Alder).
    { station: shopStation('shop-general', "TEO ALDER'S GENERAL STORE", 'teo-alder'), c: 4, r: 16, w: 4, palette: 4, goods: 'bread' },
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
  // Town task givers (shared/town-tasks): the canopy warden by the Bole's door, the mossreader by the books.
  givers: [
    { id: 'warden-fenn', name: 'Canopy Warden Ilsa Fenn', c: 28, r: 11, blurb: 'Keeps the Bole\'s lamps lit and its walkways sound.' },
    { id: 'mossreader-tull', name: 'Mossreader Oren Tull', c: 34, r: 10, blurb: 'Reads the moss the way others read the sky.' },
  ],
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
  'wwwwwww================wwwwwwwww',
  'wwwwwww===wwww===wwwwwwwwwwwwwww',
  'wwwwwww===wwww===wwwwwwwwwwwwwww',
  'wwwwwww===wwww===wwwwwwwwwwwwwww',
  'wwwwwww===wwww===wwwwwwwwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
];

/**
 * Mossharbor, on the south shore: a boardwalk street, leaf-roofed houses, a pier out to the moss-sailed ship, a west
 * finger to the ketch for Ember Isle, the fen-barge for Mirewatch off the long pier's east end; the Net-Mender's Loft
 * to walk into (verdant-houses.ts), its mender outside.
 */
export const buildMossharbor = () => buildTown({
  id: 'mossharbor',
  rows: MOSSHARBOR_ROWS,
  legend: { '=': 'plank', '.': 'moss', g: 'grass', s: 'sand', w: 'water' },
  houses: [
    { c: 5, r: 4, w: 5, d: 3, roof: 'leaf', wall: 'timber' }, { c: 26, r: 4, w: 5, d: 3, roof: 'thatch', wall: 'timber', door: NETLOFT_DOOR },
    { c: 6, r: 9, w: 5, d: 2, roof: 'leaf', wall: 'stone' }, { c: 25, r: 9, w: 5, d: 2, roof: 'leaf', wall: 'timber' },
  ],
  stalls: [],
  props: [
    { kind: 'rootlamp', c: 13, r: 4 }, { kind: 'rootlamp', c: 17, r: 4 }, { kind: 'rootlamp', c: 13, r: 9 }, { kind: 'rootlamp', c: 17, r: 9 },
    { kind: 'barrel', c: 12, r: 11 }, { kind: 'barrel', c: 11, r: 11 }, { kind: 'crate', c: 18, r: 11 }, { kind: 'crate', c: 19, r: 11 },
    { kind: 'signpost', c: 12, r: 1 }, { kind: 'bench', c: 10, r: 8 }, { kind: 'waystone', c: 19, r: 2 },
    { kind: 'jungle', c: 1, r: 2 }, { kind: 'jungle', c: 30, r: 1 }, { kind: 'jungle', c: 9, r: 1 }, { kind: 'fern', c: 21, r: 8 }, { kind: 'fern', c: 2, r: 8 },
    { kind: 'verdant-ship', c: 19, r: 16 }, { kind: 'verdant-ship', c: 4, r: 16 }, { kind: 'verdant-ship', c: 26, r: 15 },
  ],
  // Town task givers (shared/town-tasks): the net-mender outside her loft.
  givers: [
    { id: 'netmender-brisk', name: 'Netmender Wenna Brisk', c: 23, r: 7, blurb: 'Mends the harbour\'s nets with thornroot twine.' },
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

/**
 * Thornwick, a hamlet in the Fernglades: four leaf-roofed cottages round a green, a crossroads of dirt paths; the
 * Herbalist's Cottage to walk into (verdant-houses.ts), its herbalist at her gate.
 */
export const buildThornwick = () => buildTown({
  id: 'thornwick',
  rows: THORNWICK_ROWS,
  legend: { p: 'dirt', '.': 'moss', g: 'grass', f: 'flowers' },
  houses: [
    { c: 8, r: 5, w: 5, d: 3, roof: 'leaf', wall: 'timber', door: HERBAL_DOOR }, { c: 20, r: 5, w: 5, d: 3, roof: 'thatch', wall: 'timber' },
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
  givers: [
    { id: 'herbalist-sorrel', name: 'Herbalist Agathe Sorrel', c: 4, r: 7, blurb: 'Thornwick\'s herbalist. Her cures taste of moss.' },
  ],
  spawn: { c: 13, r: 9 },
});
