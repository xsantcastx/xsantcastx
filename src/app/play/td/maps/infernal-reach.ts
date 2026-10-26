/**
 * infernal-reach.ts — Infernal Reach, the volcanic mainland, and Pyrehold, its capital (docs/design/world-map.md:
 * levels 8–30). Drawn by hand like Ember Isle: the region map (one character per 8×8 tiles), roads from Pyrehold's
 * gates, places worth finding, who lives where. Pyrehold sits on the south coast: a forge district north of a lava
 * channel, a plaza of stalls, gates east and west, and a harbour whose ship sails back to Ember Isle.
 *
 * Region legend as Ember Isle (maps/ember-isle.ts); here '.' is the Cinder Steppe, 'h' the Obsidian Badlands, 'v' the
 * Molten Fields, 'm' the Pyre Peaks, 'f'/'F' the Charwood.
 */
import type { StationDef } from '../../world/world.model';
import type { ContinentDef, ContinentPlace, Region } from '../continent';
import { buildTown, shopStation } from '../town-builder';
import { SPIRE_DOOR } from './pyre-spire';
import { DEEP_IN } from './molten-deep';
import { CRYPT_IN } from './ashen-crypt';
import { CINDERPORT_SHIP, buildCinderport } from './cinderport';
import { FORGE_IN } from './forge-of-four';
import { buildAshgrove } from './ashgrove';

export const SHIP_TO_ISLE: StationDef = { id: 'ship-isle', x: 0, label: 'SHIP TO EMBER ISLE', kind: 'passage', blurb: 'Sail back to Ember Isle.' };
/** The second ship at Pyrehold's pier, nearer the shore: across the sea to Mossharbor in the Verdant Wilds. */
export const SHIP_TO_VERDANT: StationDef = { id: 'ship-verdant', x: 0, label: 'SHIP TO THE VERDANT WILDS', kind: 'passage', blurb: 'Sail to Mossharbor, on the jungle continent. Its creatures start at level 15.' };

/** The third ship at Pyrehold's pier, at its far end: across the sea to Mirewatch in the Umbral Marches. */
export const SHIP_TO_UMBRAL: StationDef = { id: 'ship-umbral', x: 0, label: 'SHIP TO THE UMBRAL MARCHES', kind: 'passage', blurb: 'Sail to Mirewatch, on the swamp continent. Its creatures start at level 26.' };

export const INFERNAL_REACH: readonly string[] = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~,,,,,,,,~~~~~~~~~,,,,,,,,,~~~~~~~~',
  '~~~~,,mmmmmmmm,,,~~~,,,vvvvvvvvv,,~~~~~~',
  '~~~,,mmmmmmmmmmhh,,,,hhvvvvvvvvvvv,,~~~~',
  '~~,,mmmmmmmmmhhhh....hhhvvvvvvvvvvv,~~~~',
  '~~,FFFmmmmmmhhhh......hhhvvvvvvvvvv,,~~~',
  '~~,FFFFFmmhhh.........hhhhvvvvvvvvvv,~~~',
  '~~,FFFFFFhh.....l.......hhhvvvvvvvvv,~~~',
  '~~,FFFFFff....lll.TTTTTT.hhhvvvvvvvv,~~~',
  '~~,FFFFff.....ll..TTTTTT..hhvvvvvvv,,~~~',
  '~~,,FFff..........TTTTTT...hhvvvvvv,~~~~',
  '~~~,,ff...........TTTTTT....hhvvvv,,~~~~',
  '~~~~,,,..........,~~~~~~,....hhh,,~~~~~~',
  '~~~~~~,,,,,,,,,,,~~~~~~~~,,,,,,,,~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

const PYREHOLD_ROWS: readonly string[] = [
    'rrrrrrrrrrrrrrrrrrrrrrooorrrrrrrrrrrrrrrrrrrrrrr',
    'rr....................ooo.....................rr',
    'rr..gg................ooo...............g.....rr',
    'rr....g...............ooo................g....rr',
    'rr....................ooo.....................rr',
    'rr....................ooo.....................rr',
    'rr~~~~~~~~~~~~~~~~~~~~===~~~~~~~~~~~~~~~~~~~~~rr',
    'rr~~~~~~~~~~~~~~~~~~~~===~~~~~~~~~~~~~~~~~~~~~rr',
    'rr....................ooo.....................rr',
    'rr....................ooo.....................rr',
    'rr...............ooooooooooooo................rr',
    'rr.............ooooooooooooooooo..............rr',
    'rr............ooooooooooooooooooo.............rr',
    'rr...........ooooooooooooooooooooo............rr',
    'oooooooooooooooooooooooooooooooooooooooooooooooo',
    'oooooooooooooooooooooooooooooooooooooooooooooooo',
    'oooooooooooooooooooooooooooooooooooooooooooooooo',
    'rr...........ooooooooooooooooooooo............rr',
    'rr............ooooooooooooooooooo.............rr',
    'rr.............ooooooooooooooooo..............rr',
    'rr...............ooooooooooooo................rr',
    'rr....................ooo.....................rr',
    'rr....................ooo.....................rr',
    'rr....................ooo.....................rr',
    'rr..gg................ooo.................g...rr',
    'rr....................ooo..................g..rr',
    'rr....................===.....................rr',
    'rr....................===.....................rr',
    'ssssssssssssssssssssss===sssssssssssssssssssssss',
    'ssssssssssssssssssssss===sssssssssssssssssssssss',
    'wwwwwwwwwwwwwwwwwwwwww===wwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwww===wwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwww===wwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwww===wwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwww===wwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwww===wwwwwwwwwwwwwwwwwwwwwww',

];

/** Pyrehold: its ground drawn above (o street, . dirt, g grass, ~ lava channel, = planks, s sand, w sea, r cliff). */
export const buildPyrehold = () => buildTown({
  id: 'pyrehold',
  rows: PYREHOLD_ROWS,
  legend: { o: 'cobble', '.': 'dirt', g: 'grass', '~': 'ember', '=': 'plank', s: 'sand', w: 'water', r: 'rock' },
  houses: [
    { c: 6, r: 4, w: 5, d: 3, roof: 'slate', wall: 'basalt' }, { c: 14, r: 4, w: 5, d: 3, roof: 'red', wall: 'stone' },
    { c: 32, r: 4, w: 5, d: 3, roof: 'red', wall: 'basalt' }, { c: 40, r: 4, w: 4, d: 3, roof: 'slate', wall: 'stone' },
    { c: 5, r: 12, w: 4, d: 3, roof: 'red', wall: 'timber' }, { c: 42, r: 12, w: 4, d: 3, roof: 'slate', wall: 'timber' },
    { c: 6, r: 24, w: 5, d: 3, roof: 'thatch', wall: 'timber' }, { c: 14, r: 25, w: 4, d: 3, roof: 'red', wall: 'stone' },
    { c: 33, r: 25, w: 4, d: 3, roof: 'slate', wall: 'timber' }, { c: 41, r: 24, w: 5, d: 3, roof: 'red', wall: 'timber' },
  ],
  stalls: [
    { station: 'vault', c: 15, r: 11, w: 4, palette: 2, goods: 'pots' },
    { station: 'crafting', c: 31, r: 11, w: 4, palette: 0, goods: 'tools' },
    { station: 'enchanting', c: 31, r: 20, w: 4, palette: 1, goods: 'books' },
    { station: 'brews', c: 27, r: 20, w: 2, palette: 1, goods: 'pots' },
    // The shops by district (shared/shops; canon §6.5): the General Store and the Alchemist on the plaza of stalls, the
    // Smith's in the forge district north of the lava channel, Netter Pell's stall at the harbour.
    { station: shopStation('shop-general', "GARRICK DROSS'S GENERAL STORE", 'garrick-dross'), c: 23, r: 22, w: 4, palette: 4, goods: 'bread' },
    { station: shopStation('shop-alchemist', "JUNO MARL'S ALCHEMIST", 'juno-marl'), c: 15, r: 20, w: 4, palette: 3, goods: 'pots' },
    { station: shopStation('shop-smith', "YSOLDE MARR'S SMITH", 'ysolde-marr'), c: 27, r: 3, w: 4, palette: 0, goods: 'tools' },
    { station: shopStation('shop-fishing', "NETTER PELL'S FISHING STALL", 'netter-pell'), c: 31, r: 27, w: 4, palette: 2, goods: 'fish' },
  ],
  props: [
    { kind: 'fountain', c: 22, r: 14 }, { kind: 'hearth', c: 22, r: 18 },
    { kind: 'forge', c: 10, r: 2 }, { kind: 'forge', c: 36, r: 2 },
    { kind: 'lamp', c: 19, r: 9 }, { kind: 'lamp', c: 27, r: 9 }, { kind: 'lamp', c: 11, r: 15 }, { kind: 'lamp', c: 35, r: 15 },
    { kind: 'lamp', c: 19, r: 23 }, { kind: 'lamp', c: 27, r: 23 }, { kind: 'lamp', c: 21, r: 27 }, { kind: 'lamp', c: 25, r: 27 },
    { kind: 'bench', c: 17, r: 13 }, { kind: 'bench', c: 29, r: 13 }, { kind: 'bench', c: 17, r: 18 }, { kind: 'bench', c: 29, r: 18 },
    { kind: 'barrel', c: 12, r: 9 }, { kind: 'barrel', c: 34, r: 9 }, { kind: 'crate', c: 13, r: 9 }, { kind: 'crate', c: 18, r: 27 },
    { kind: 'barrel', c: 28, r: 27 }, { kind: 'signpost', c: 20, r: 1 }, { kind: 'signpost', c: 3, r: 13 }, { kind: 'signpost', c: 44, r: 13 },
    { kind: 'pine', c: 3, r: 3 }, { kind: 'pine', c: 44, r: 3 }, { kind: 'oak', c: 4, r: 21 }, { kind: 'oak', c: 43, r: 21 },
    { kind: 'waystone', c: 27, r: 10 },
  ],
  // The Pyre Spire, the watchtower over the south quarter: its door opens onto three floors (maps/pyre-spire.ts).
  towers: [{ c: 37, r: 21, door: SPIRE_DOOR }],
  // Town task givers (shared/town-tasks): the Watch's captain by the east road, the forgewife by the north forges,
  // the Spire's scholar under its tower.
  givers: [
    { id: 'captain-vey', name: 'Captain Brannoc Vey', c: 42, r: 16, blurb: 'Captain of the Pyre Watch. He has work for a steady hand.' },
    { id: 'forgewife-marr', name: 'Forgewife Ysolde Marr', c: 9, r: 10, blurb: "Keeps Pyrehold's great forges lit." },
    { id: 'scholar-pryor', name: 'Scholar Odette Pryor', c: 34, r: 19, blurb: 'A scholar of the Pyre Spire who maps the Deep.' },
  ],
  spawn: { c: 23, r: 25 },
});

export const REACH_PLACES: readonly ContinentPlace[] = [
  { kind: 'ruins', c: -110, r: -6, name: 'The Ashen Bastion' },
  // Under the Bastion's south wall, the door to its crypt (maps/ashen-crypt.ts).
  { kind: 'crypt', c: -110, r: -1, name: 'The Ashen Crypt' },
  { kind: 'standing-stones', c: -46, r: 18, name: 'The Ring of Pyres' },
  { kind: 'shrine', c: -40, r: -24, name: 'The Ember Altar' },
  { kind: 'caldera', c: 98, r: -22, name: 'The Great Caldera' },
  { kind: 'cave', c: 70, r: -38, name: 'The Molten Deep' },
  // At the foot of the Pyre Peaks, by the road to the Ember Altar: the ruined gate of the Forge of the Four.
  { kind: 'forge', c: -28, r: -26, name: 'The Forge of the Four' },
  { kind: 'harbour', c: 23, r: 26, name: 'Pyrehold Harbour' },
];

export const REACH_NAMES: Readonly<Partial<Record<Region, string>>> = {
  '~': 'The Burning Sea', ',': 'The Ashen Shore', '.': 'The Cinder Steppe', f: 'The Charwood', F: 'The Deep Charwood',
  h: 'The Obsidian Badlands', m: 'The Pyre Peaks', v: 'The Molten Fields', l: 'Glasswater', T: 'Pyrehold',
};

export const INFERNAL_REACH_DEF: ContinentDef = {
  id: 'infernal-reach', map: INFERNAL_REACH, ox: 18, oy: 8,
  roads: [
    [[23, 0], [23, -10], [10, -20], [-20, -24], [-38, -22]],
    [[0, 15], [-20, 16], [-44, 18], [-80, 10], [-106, -4]],
    [[47, 15], [66, 10], [84, -6], [96, -18]],
    [[84, -6], [76, -22], [70, -34]],
    [[66, 10], [88, 22], [106, 34]],
  ],
  places: REACH_PLACES, names: REACH_NAMES,
  mobs: {
    '.': { types: ['rivet-maw', 'lava-hound'], chance: .35 },
    f: { types: ['ash-wolf', 'ash-wolf', 'lava-hound'], chance: .6 },
    // The Cinder clans hold the Deep Charwood and the Badlands; drakes hunt the Molten Fields.
    F: { types: ['ash-wolf', 'lava-hound', 'cinder-orc', 'cinder-orc', 'orc-firecaller'], chance: .7 },
    h: { types: ['lava-hound', 'cinder-bailiff', 'cinder-orc', 'orc-firecaller', 'orc-warlord'], chance: .65 },
    v: { types: ['cinder-imp', 'obsidian-golem', 'ember-drake'], chance: .65 },
  },
  // Lairs (canon §8.2): the orc camps (each with its Ashsinger, S6: monsters-abilities §2.7) of the Deep Charwood and the Badlands, the drakes' nests in the Molten Fields,
  // the hounds' runs through the burnt Charwood.
  hotspots: [
    { region: 'F', chance: .5, types: ['cinder-orc', 'cinder-orc', 'orc-firecaller', 'ashsinger'], count: 5 },
    { region: 'h', chance: .45, types: ['cinder-orc', 'orc-firecaller', 'orc-warlord', 'cinder-orc', 'ashsinger'], count: 5 },
    { region: 'v', chance: .35, types: ['ember-drake', 'lava-hound', 'cinder-imp'], count: 4 },
    { region: 'f', chance: .4, types: ['lava-hound', 'ash-wolf'], count: 4 },
    { region: '.', chance: .15, types: ['lava-hound', 'rivet-maw'], count: 3 },
  ],
  town: buildPyrehold, townName: 'Pyrehold', streets: { row: 15, col: 23 }, river: false,
  ways: [
    { place: 'harbour', station: SHIP_TO_ISLE, to: 'ember-isle', arrive: 'ship-reach', ship: true },
    { place: 'harbour', station: SHIP_TO_VERDANT, to: 'verdant-wilds', arrive: 'ship-mossharbor', ship: true, along: -3 },
    { place: 'harbour', station: SHIP_TO_UMBRAL, to: 'umbral-marches', arrive: 'ship-mirewatch', ship: true, along: 2 },
    { place: 'cave', station: DEEP_IN, to: 'molten-deep-1', arrive: 'deep-out' },
    { place: 'crypt', station: CRYPT_IN, to: 'ashen-crypt-1', arrive: 'crypt-out' },
    { place: 'forge', station: FORGE_IN, to: 'forge-of-four-1', arrive: 'forge-out' },
  ],
  villages: [
    // Cinderport's salt-ketch sails from the pier's end (the village's tile 15, 15) back to Ember Harbour.
    { name: 'Cinderport', c: 92, r: 34, build: buildCinderport, ways: [{ station: CINDERPORT_SHIP, c: 15, r: 15, to: 'ember-isle', arrive: 'ship-reach', ship: true }] },
    { name: 'Ashgrove', c: -92, r: 6, build: buildAshgrove },
  ],
};
