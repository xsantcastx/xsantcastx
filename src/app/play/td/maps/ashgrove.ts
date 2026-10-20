/**
 * ashgrove.ts — Ashgrove, a charcoal-burners' village on the edge of the Charwood, west of Pyrehold on the old road
 * (docs/design/world-map.md). Thatched cottages round a green, charcoal kilns smoking, and the Woodward's Lodge: walk
 * in, climb to the loft where the woodwards keep their maps of the Charwood.
 *
 * Town ground: o path · . dirt · g grass.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';
import { buildTown } from '../town-builder';

export const LODGE_DOOR: StationDef = { id: 'lodge-door', x: 0, label: "THE WOODWARD'S LODGE", kind: 'passage', blurb: "The Charwood's woodwards live here." };
const LODGE_OUT: StationDef = { id: 'lodge-out', x: 0, label: 'DOOR', kind: 'passage', blurb: 'Back out to Ashgrove.' };
const LODGE_UP: StationDef = { id: 'lodge-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the loft.' };
const LOFT_DOWN: StationDef = { id: 'loft-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the lodge.' };

const ASHGROVE_ROWS: readonly string[] = [
  'gggggggggggggooogggggggggggg',
  'gggggggggggggooogggggggggggg',
  'gg..........ooooo..........g',
  'gg..........ooooo..........g',
  'gg....gggggggggggggggg.....g',
  'oooooogggggggggggggggggooooo',
  'oooooogggggggggggggggggooooo',
  'gg....gggggggggggggggg.....g',
  'gg..........ooooo..........g',
  'gg..........ooooo..........g',
  'gggggggggggggooogggggggggggg',
  'gggggggggggggooogggggggggggg',
  'gggggggggggggooogggggggggggg',
  'gggggggggggggooogggggggggggg',
];

export const buildAshgrove = () => buildTown({
  id: 'ashgrove',
  rows: ASHGROVE_ROWS,
  legend: { o: 'dirt', '.': 'dirt', g: 'grass' },
  houses: [
    { c: 6, r: 3, w: 5, d: 3, roof: 'thatch', wall: 'timber', door: LODGE_DOOR }, { c: 21, r: 3, w: 4, d: 3, roof: 'thatch', wall: 'timber' },
    { c: 6, r: 12, w: 4, d: 2, roof: 'thatch', wall: 'timber' }, { c: 21, r: 12, w: 5, d: 2, roof: 'red', wall: 'timber' },
  ],
  stalls: [],
  props: [
    { kind: 'forge', c: 10, r: 8 }, { kind: 'forge', c: 18, r: 8 }, { kind: 'hearth', c: 14, r: 6 },
    { kind: 'bench', c: 12, r: 4 }, { kind: 'bench', c: 16, r: 4 }, { kind: 'flowerbed', c: 9, r: 6 }, { kind: 'flowerbed', c: 19, r: 6 },
    { kind: 'crate', c: 3, r: 8 }, { kind: 'barrel', c: 25, r: 8 }, { kind: 'signpost', c: 12, r: 1 }, { kind: 'waystone', c: 16, r: 10 },
    { kind: 'pine', c: 1, r: 1 }, { kind: 'pine', c: 26, r: 1 }, { kind: 'oak', c: 1, r: 12 }, { kind: 'pine', c: 26, r: 12 }, { kind: 'oak', c: 11, r: 13 },
  ],
  // Town task givers (shared/town-tasks): a woodward by the lodge, the charburner at her kilns.
  givers: [
    { id: 'woodward-ashby', name: 'Woodward Hesk Ashby', c: 5, r: 8, blurb: 'A woodward of the Charwood, keeper of its maps.' },
    { id: 'charburner-kiln', name: 'Maud Kiln', c: 20, r: 8, blurb: "Ashgrove's charburner, never far from her kilns." },
  ],
  spawn: { c: 14, r: 9 },
});

const ROOM: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'wall' }, '.': { ground: 'plank' }, 'r': { ground: 'rug' },
  't': { ground: 'plank', object: 'table' }, 'b': { ground: 'plank', object: 'bed' }, 's': { ground: 'plank', object: 'shelf' },
  'h': { ground: 'plank', object: 'hearth' }, 'C': { ground: 'plank', object: 'chest' },
};

export const WOODWARD_LODGE_1: TdMapDef = {
  id: 'woodward-lodge-1', name: "The Woodward's Lodge", outside: 'wall', dark: false,
  legend: { ...ROOM,
    'D': { ground: 'plank', station: LODGE_OUT, exit: { to: 'surface', arrive: 'lodge-door' } },
    '>': { ground: 'plank', object: 'up', station: LODGE_UP, exit: { to: 'woodward-lodge-2', arrive: 'loft-down' } },
  },
  rows: [
    '####################',
    '#s...s....h.....>..#',
    '#..................#',
    '#...rrrrrr.........#',
    '#...rrtrrr.....t...#',
    '#...rrrrrr.........#',
    '#..................#',
    '#.........D........#',
    '####################',
  ],
};

export const WOODWARD_LODGE_2: TdMapDef = {
  id: 'woodward-lodge-2', name: "The Woodward's Lodge · Loft", outside: 'wall', dark: false,
  legend: { ...ROOM,
    '<': { ground: 'plank', object: 'down', station: LOFT_DOWN, exit: { to: 'woodward-lodge-1', arrive: 'lodge-up' } },
  },
  rows: [
    '####################',
    '#b..b..s..s.....<..#',
    '#..................#',
    '#..........rrrr....#',
    '#..t.......rrrr..C.#',
    '#..................#',
    '####################',
  ],
};
