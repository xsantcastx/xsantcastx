/**
 * cinderport.ts — Cinderport, Infernal Reach's fishing harbour on the south-east coast (docs/design/world-map.md),
 * east of Pyrehold past the Obsidian Badlands. A street of black-stone houses round a crossroads, a pier out over the
 * Burning Sea, and the Salted Ember, a dockside tavern you walk into (one floor and a cellar of old nets and a chest).
 *
 * Town ground: o street · . dirt · g grass · s sand · = planks · w sea.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';
import { buildTown } from '../town-builder';

export const SALTED_DOOR: StationDef = { id: 'salted-door', x: 0, label: 'THE SALTED EMBER', kind: 'passage', blurb: "Cinderport's dockside tavern." };
const SALTED_OUT: StationDef = { id: 'salted-out', x: 0, label: 'DOOR', kind: 'passage', blurb: 'Back out to the docks.' };
const SALTED_DOWN: StationDef = { id: 'salted-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the cellar.' };
const CELLAR_UP: StationDef = { id: 'salted-cellar-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the tavern.' };

const CINDERPORT_ROWS: readonly string[] = [
  '.............ooo..............',
  '.............ooo..............',
  '..g..........ooo..........g...',
  '.............ooo..............',
  '.............ooo..............',
  '..........ooooooooo...........',
  'oooooooooooooooooooooooooooooo',
  'oooooooooooooooooooooooooooooo',
  '..........ooooooooo...........',
  '.............ooo..............',
  '.............ooo..............',
  'ssssssssssssss===sssssssssssss',
  'ssssssssssssss===sssssssssssss',
  'wwwwwwwwwwwwww===wwwwwwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwww',
  'wwwwwwwwwwwwww===wwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
];

export const buildCinderport = () => buildTown({
  id: 'cinderport',
  rows: CINDERPORT_ROWS,
  legend: { o: 'cobble', '.': 'dirt', g: 'grass', s: 'sand', '=': 'plank', w: 'water' },
  houses: [
    { c: 6, r: 4, w: 5, d: 3, roof: 'slate', wall: 'basalt', door: SALTED_DOOR }, { c: 23, r: 4, w: 5, d: 3, roof: 'red', wall: 'basalt' },
    { c: 5, r: 10, w: 5, d: 2, roof: 'slate', wall: 'stone' }, { c: 24, r: 10, w: 5, d: 2, roof: 'red', wall: 'timber' },
  ],
  stalls: [],
  props: [
    { kind: 'lamp', c: 12, r: 5 }, { kind: 'lamp', c: 18, r: 5 }, { kind: 'lamp', c: 12, r: 9 }, { kind: 'lamp', c: 18, r: 9 },
    { kind: 'barrel', c: 11, r: 11 }, { kind: 'barrel', c: 12, r: 11 }, { kind: 'crate', c: 19, r: 11 }, { kind: 'crate', c: 19, r: 12 },
    { kind: 'signpost', c: 16, r: 2 }, { kind: 'bench', c: 10, r: 9 }, { kind: 'waystone', c: 20, r: 3 }, { kind: 'pine', c: 1, r: 3 }, { kind: 'pine', c: 28, r: 2 },
  ],
  spawn: { c: 15, r: 7 },
});

const ROOM: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'wall' }, '.': { ground: 'plank' }, ',': { ground: 'cobble' }, 'r': { ground: 'rug' },
  't': { ground: 'plank', object: 'table' }, 's': { ground: 'plank', object: 'shelf' }, 'c': { ground: 'plank', object: 'counter' },
  'h': { ground: 'plank', object: 'hearth' }, 'C': { ground: 'cobble', object: 'chest' }, 'B': { ground: 'cobble', object: 'bones' },
};

export const SALTED_EMBER_1: TdMapDef = {
  id: 'salted-ember-1', name: 'The Salted Ember', outside: 'wall', dark: false,
  legend: { ...ROOM,
    'D': { ground: 'plank', station: SALTED_OUT, exit: { to: 'surface', arrive: 'salted-door' } },
    '>': { ground: 'plank', object: 'down', station: SALTED_DOWN, exit: { to: 'salted-ember-0', arrive: 'salted-cellar-up' } },
  },
  rows: [
    '######################',
    '#s.....h.......s...>.#',
    '#....................#',
    '#..t.....t.....rrrr..#',
    '#..............rrrr..#',
    '#..t.....t...........#',
    '#....................#',
    '#...ccc..........t...#',
    '#....................#',
    '#..........D.........#',
    '######################',
  ],
};

export const SALTED_EMBER_0: TdMapDef = {
  id: 'salted-ember-0', name: 'The Salted Ember · Cellar', outside: 'wall', dark: true,
  legend: { ...ROOM,
    '<': { ground: 'cobble', object: 'up', station: CELLAR_UP, exit: { to: 'salted-ember-1', arrive: 'salted-down' } },
  },
  rows: [
    '####################',
    '#,,,,,,,,,,,,,,,<,,#',
    '#,,,,,,,,,,,,,,,,,,#',
    '#,,s,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,B,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,#',
    '#,C,,,,,,,,,,,,,s,,#',
    '####################',
  ],
};
