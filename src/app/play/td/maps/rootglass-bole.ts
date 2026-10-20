/**
 * rootglass-bole.ts — the Rootglass Bole, the giant tree at the heart of Rootglass (docs/design/world-map.md: the
 * capital "in the canopy: floors +1…+3"). A door between its roots opens on the Root Hall, a round room hollowed in the
 * living wood; a stair winds up the trunk to three floors of walkways out on the branches, over a sea of leaves.
 * Floor +1, the Lower Boughs: the first ring of walkways, a reading nook out on the west bough, the warden's chest east.
 * Floor +2, the Sap Galleries: where the town keeps its sap jars and its rugs, high and dry.
 * Floor +3, the Crown: an open deck at the top of the tree, the whole Greenwood below it.
 * Walkways wide on purpose — every passage two tiles or more.
 *
 * Legend: # the Bole's wood (the Root Hall) or the leaves (the floors above) · B the trunk · . boards · r rug ·
 * t table · s shelf · L a rootglass lamp · C chest · D the door out · > stairs up · < stairs down.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

export const BOLE_DOOR: StationDef = { id: 'bole-door', x: 0, label: 'THE ROOTGLASS BOLE', kind: 'passage', blurb: "Rootglass's great tree: a hall in its roots, three floors up in the canopy." };
const BOLE_OUT: StationDef = { id: 'bole-out', x: 0, label: 'DOOR', kind: 'passage', blurb: 'Back out to Rootglass.' };
const HALL_UP: StationDef = { id: 'bole-0-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up the trunk to the Lower Boughs (+1).' };
const B1_DOWN: StationDef = { id: 'bole-1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Root Hall.' };
const B1_UP: StationDef = { id: 'bole-1-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Sap Galleries (+2).' };
const B2_DOWN: StationDef = { id: 'bole-2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Lower Boughs (+1).' };
const B2_UP: StationDef = { id: 'bole-2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Crown (+3).' };
const B3_DOWN: StationDef = { id: 'bole-3-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Sap Galleries (+2).' };

const ROOM: Readonly<Record<string, LegendEntry>> = {
  '.': { ground: 'plank' }, 'r': { ground: 'rug' }, 'B': { ground: 'bark' },
  't': { ground: 'plank', object: 'table' }, 's': { ground: 'plank', object: 'shelf' },
  'L': { ground: 'plank', object: 'rootlamp' }, 'C': { ground: 'plank', object: 'chest' },
};

export const ROOTGLASS_BOLE_0: TdMapDef = {
  id: 'rootglass-bole-0', name: 'The Rootglass Bole · Root Hall', outside: 'bark', dark: false,
  legend: { ...ROOM, '#': { ground: 'bark' },
    'D': { ground: 'plank', station: BOLE_OUT, exit: { to: 'surface', arrive: 'bole-door' } },
    '>': { ground: 'plank', object: 'up', station: HALL_UP, exit: { to: 'rootglass-bole-1', arrive: 'bole-1-down' } },
  },
  rows: [
    '##########################',
    '########.L......L.########',
    '#####s..............s#####',
    '###..................>.###',
    '##....t............t....##',
    '##.s....................##',
    '#.........rrrrrr.........#',
    '##L........rrrr........L##',
    '##.........rrrr.........##',
    '###.C.t............t...###',
    '#####................#####',
    '########....D.....########',
    '##########################',
  ],
};

export const ROOTGLASS_BOLE_1: TdMapDef = {
  id: 'rootglass-bole-1', name: 'The Rootglass Bole · +1 · The Lower Boughs', outside: 'canopy', dark: false,
  legend: { ...ROOM, '#': { ground: 'canopy' },
    '<': { ground: 'plank', object: 'down', station: B1_DOWN, exit: { to: 'rootglass-bole-0', arrive: 'bole-0-up' } },
    '>': { ground: 'plank', object: 'up', station: B1_UP, exit: { to: 'rootglass-bole-2', arrive: 'bole-2-down' } },
  },
  rows: [
    '################################',
    '############L.ss.L##############',
    '############......##############',
    '############......##############',
    '#########........>.....#......L#',
    '########L....................C.#',
    '########.......................#',
    '#L..........BBBBBBBB..........L#',
    '#..t........BBBBBBBB....########',
    '#...........BBBBBBBB....########',
    '#L..........BBBBBBBB....########',
    '########.....<..........########',
    '########...............L########',
    '#########..............#########',
    '##################.........#####',
    '##################.........#####',
    '##################....t....#####',
    '##################L.......L#####',
    '################################',
  ],
};

export const ROOTGLASS_BOLE_2: TdMapDef = {
  id: 'rootglass-bole-2', name: 'The Rootglass Bole · +2 · The Sap Galleries', outside: 'canopy', dark: false,
  legend: { ...ROOM, '#': { ground: 'canopy' },
    '<': { ground: 'plank', object: 'down', station: B2_DOWN, exit: { to: 'rootglass-bole-1', arrive: 'bole-1-up' } },
    '>': { ground: 'plank', object: 'up', station: B2_UP, exit: { to: 'rootglass-bole-3', arrive: 'bole-3-down' } },
  },
  rows: [
    '################################',
    '################################',
    '################################',
    '#ss....s########################',
    '#.rrrr..#L......<.....L#########',
    '#.rrrr..................########',
    '#.rrrr..................########',
    '#............BBBBBB.....########',
    '#L...........BBBBBB.....########',
    '########.....BBBBBB...........s#',
    '########.....BBBBBB.......t....#',
    '########......>..........rrrr..#',
    '########.................rrrr..#',
    '####...................#.......#',
    '####........############L.....s#',
    '####........####################',
    '####....t...####################',
    '####C......L####################',
    '################################',
  ],
};

export const ROOTGLASS_BOLE_3: TdMapDef = {
  id: 'rootglass-bole-3', name: 'The Rootglass Bole · +3 · The Crown', outside: 'canopy', dark: false,
  legend: { ...ROOM, '#': { ground: 'canopy' },
    '<': { ground: 'plank', object: 'down', station: B3_DOWN, exit: { to: 'rootglass-bole-2', arrive: 'bole-2-up' } },
  },
  rows: [
    '##############################',
    '###########........###########',
    '#######................#######',
    '#####...L............L...#####',
    '####......................####',
    '###..t.....................###',
    '##.......................C..##',
    '##...........BBBB...........##',
    '#..L.........BBBB............#',
    '##..........................##',
    '##...........<............L.##',
    '###.......rrrrrrrrrr.......###',
    '####......rrrrrrrrrr......####',
    '#####...L............L...#####',
    '#######................#######',
    '###########........###########',
    '##############################',
  ],
};
