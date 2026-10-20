/**
 * lantern-tower.ts — the Lantern Tower in Gloamhaven (docs/design/world-map.md: the capital "on stilts"). It stands on
 * its stilts over the black water at the drowned square's north-west, and its Great Lantern brings the boats in
 * through the fog. A door off the landing opens on the Keeper's Hall; a stair winds up to two floors with a gallery
 * round each, out over the fen.
 * Floor 0, the Keeper's Hall: the lamplighters' room — their table, their shelves of wicks, the oil in its chest.
 * Floor +1, the Wick Loft: where the wicks are trimmed and the oil is kept dry; a gallery round it over the water.
 * Floor +2, the Lantern Room: the Great Lantern itself, a glass of gold in a cage as tall as a man, and the gallery where the keepers
 * watch the fog.
 * Walkways wide on purpose — every passage two tiles or more.
 *
 * Legend: # the tower's timber walls · O the black water far below · . boards · r rug · t table · s shelf ·
 * L a lantern · G the Great Lantern · C chest · D the door out · > stairs up · < stairs down.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

export const TOWER_DOOR: StationDef = { id: 'lantern-tower-door', x: 0, label: 'THE LANTERN TOWER', kind: 'passage', blurb: "Gloamhaven's lighthouse on stilts: the Keeper's Hall, and two floors up to the Great Lantern." };
const TOWER_OUT: StationDef = { id: 'lantern-tower-out', x: 0, label: 'DOOR', kind: 'passage', blurb: 'Back out to Gloamhaven.' };
const L0_UP: StationDef = { id: 'lantern-0-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Wick Loft (+1).' };
const L1_DOWN: StationDef = { id: 'lantern-1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: "Down to the Keeper's Hall." };
const L1_UP: StationDef = { id: 'lantern-1-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Lantern Room (+2).' };
const L2_DOWN: StationDef = { id: 'lantern-2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Wick Loft (+1).' };

const ROOM: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'wall' }, 'O': { ground: 'blackwater' }, '.': { ground: 'plank' }, 'r': { ground: 'rug' },
  't': { ground: 'plank', object: 'table' }, 's': { ground: 'plank', object: 'shelf' },
  'L': { ground: 'plank', object: 'lantern' }, 'C': { ground: 'plank', object: 'chest' },
};

export const LANTERN_TOWER_0: TdMapDef = {
  id: 'lantern-tower-0', name: "The Lantern Tower · The Keeper's Hall", outside: 'wall', dark: false,
  legend: { ...ROOM,
    'D': { ground: 'plank', station: TOWER_OUT, exit: { to: 'surface', arrive: 'lantern-tower-door' } },
    '>': { ground: 'plank', object: 'up', station: L0_UP, exit: { to: 'lantern-tower-1', arrive: 'lantern-1-down' } },
  },
  rows: [
    '######################',
    '#####ss....L....ss####',
    '###................###',
    '##..t..........>...C##',
    '##..................##',
    '#L.....rrrrrrrr.....L#',
    '#......rrrrrrrr......#',
    '##.....rrrrrrrr.....##',
    '##..t..............t##',
    '###................###',
    '#####.....D......#####',
    '######################',
  ],
};

export const LANTERN_TOWER_1: TdMapDef = {
  id: 'lantern-tower-1', name: 'The Lantern Tower · +1 · The Wick Loft', outside: 'blackwater', dark: false,
  legend: { ...ROOM,
    '<': { ground: 'plank', object: 'down', station: L1_DOWN, exit: { to: 'lantern-tower-0', arrive: 'lantern-0-up' } },
    '>': { ground: 'plank', object: 'up', station: L1_UP, exit: { to: 'lantern-tower-2', arrive: 'lantern-2-down' } },
  },
  rows: [
    'OOOOOOOOOOOOOOOOOOOOOOOOOO',
    'OOOOOOOOOOOOOOOOOOOOOOOOOO',
    'OOO....................OOO',
    'OO..L................L..OO',
    'OO...##################.OO',
    'OO...#ss....t.....ss#...OO',
    'OO...#..............#...OO',
    'OO...#..<........>..#...OO',
    'OO...#..............#...OO',
    'OO...#C...rrrrrr...C#...OO',
    'OO...#....rrrrrr....#...OO',
    'OO...####......######...OO',
    'OO..L................L..OO',
    'OOO....................OOO',
    'OOOOOOOOOOOOOOOOOOOOOOOOOO',
    'OOOOOOOOOOOOOOOOOOOOOOOOOO',
  ],
};

export const LANTERN_TOWER_2: TdMapDef = {
  id: 'lantern-tower-2', name: 'The Lantern Tower · +2 · The Lantern Room', outside: 'blackwater', dark: false,
  legend: { ...ROOM,
    '<': { ground: 'plank', object: 'down', station: L2_DOWN, exit: { to: 'lantern-tower-1', arrive: 'lantern-1-up' } },
    'G': { ground: 'rug', object: 'great-lantern' },
  },
  rows: [
    'OOOOOOOOOOOOOOOOOOOOOOOO',
    'OOOOOOOOOOOOOOOOOOOOOOOO',
    'OOOO................OOOO',
    'OOO..L............L..OOO',
    'OO....................OO',
    'OO.....rrrrrrrrrr.....OO',
    'OO.....rr......rr.....OO',
    'OO..t..rr......rr..C..OO',
    'OO.....rr...G..rr.....OO',
    'OO.....rr......rr.....OO',
    'OO.....rrrrrrrrrr.....OO',
    'OO..........<.........OO',
    'OOO..L............L..OOO',
    'OOOO................OOOO',
    'OOOOOOOOOOOOOOOOOOOOOOOO',
    'OOOOOOOOOOOOOOOOOOOOOOOO',
  ],
};
