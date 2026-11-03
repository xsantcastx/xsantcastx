/**
 * infernal-reach.ts — Pyrehold, the Infernal Reach's capital (docs/design/world-map.md: levels 8–30), and its three
 * ships. Pyrehold sits on the south coast: a forge district north of a lava channel, a plaza of stalls, gates east and
 * west, and a harbour whose ships sail to Ember Isle, the Verdant Wilds and the Umbral Marches. The land itself is an
 * act of sections now (maps/reach-sections.ts, docs/design/world-acts.md §1.2): Pyrehold is its first.
 */
import type { StationDef } from '../../world/world.model';
import { buildTown, shopStation } from '../town-builder';
import { SPIRE_DOOR } from './pyre-spire';

export const SHIP_TO_ISLE: StationDef = { id: 'ship-isle', x: 0, label: 'SHIP TO EMBER ISLE', kind: 'passage', blurb: 'Sail back to Ember Isle.' };
/** The second ship at Pyrehold's pier, nearer the shore: across the sea to Mossharbor in the Verdant Wilds. */
export const SHIP_TO_VERDANT: StationDef = { id: 'ship-verdant', x: 0, label: 'SHIP TO THE VERDANT WILDS', kind: 'passage', blurb: 'Sail to Mossharbor, on the jungle continent. Its creatures start at level 15.' };

/** The third ship at Pyrehold's pier, at its far end: across the sea to Mirewatch in the Umbral Marches. */
export const SHIP_TO_UMBRAL: StationDef = { id: 'ship-umbral', x: 0, label: 'SHIP TO THE UMBRAL MARCHES', kind: 'passage', blurb: 'Sail to Mirewatch, on the swamp continent. Its creatures start at level 26.' };

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
