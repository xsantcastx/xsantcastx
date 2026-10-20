/**
 * verdant-houses.ts — the Verdant Wilds' village houses you walk into (docs/design/world-map.md), like the Ember Inn
 * and the Salted Ember: a door on the village street (verdant-wilds.ts `door`), a hand-drawn ground floor, and a floor
 * above or below it.
 *
 * Mossharbor, the Net-Mender's Loft: Wenna Brisk's workroom — a long rug where she lays the nets out to mend, a bench,
 * a hearth to dry them by — and up a ladder-stair the loft where she sleeps under the eaves, a chest of floats and old sail.
 * Thornwick, the Herbalist's Cottage: Agathe Sorrel's front room of jars and drying racks, a counter for the village's
 * coughs; and under it a root cellar of shelves and a sorting table, where she keeps what must stay cool and dark.
 *
 * Legend: # wall · . boards · r rug · t table · b bed · s shelf · c counter · h hearth · C chest · L a rootglass lamp ·
 * , earth · D the door out · > stairs up/down · < stairs back.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

export const NETLOFT_DOOR: StationDef = { id: 'netloft-door', x: 0, label: "THE NET-MENDER'S LOFT", kind: 'passage', blurb: "Wenna Brisk's workroom, nets drying by the hearth, a loft above." };
const NETLOFT_OUT: StationDef = { id: 'netloft-out', x: 0, label: 'DOOR', kind: 'passage', blurb: 'Back out to the boardwalk.' };
const NETLOFT_UP: StationDef = { id: 'netloft-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the loft.' };
const NETLOFT_DOWN: StationDef = { id: 'netloft-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the workroom.' };

export const HERBAL_DOOR: StationDef = { id: 'herbal-door', x: 0, label: "THE HERBALIST'S COTTAGE", kind: 'passage', blurb: "Agathe Sorrel's cottage of jars and drying racks, a root cellar under it." };
const HERBAL_OUT: StationDef = { id: 'herbal-out', x: 0, label: 'DOOR', kind: 'passage', blurb: 'Back out to the green.' };
const HERBAL_DOWN: StationDef = { id: 'herbal-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the root cellar.' };
const HERBAL_UP: StationDef = { id: 'herbal-cellar-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the cottage.' };

const ROOM: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'wall' }, '.': { ground: 'plank' }, 'r': { ground: 'rug' }, ',': { ground: 'dirt' },
  't': { ground: 'plank', object: 'table' }, 'b': { ground: 'plank', object: 'bed' }, 's': { ground: 'plank', object: 'shelf' },
  'c': { ground: 'plank', object: 'counter' }, 'h': { ground: 'plank', object: 'hearth' }, 'C': { ground: 'plank', object: 'chest' },
  'L': { ground: 'plank', object: 'rootlamp' },
};

export const NETLOFT_1: TdMapDef = {
  id: 'netloft-1', name: "The Net-Mender's Loft", outside: 'wall', dark: false,
  legend: { ...ROOM,
    'D': { ground: 'plank', station: NETLOFT_OUT, exit: { to: 'surface', arrive: 'netloft-door' } },
    '>': { ground: 'plank', object: 'up', station: NETLOFT_UP, exit: { to: 'netloft-2', arrive: 'netloft-down' } },
  },
  rows: [
    '####################',
    '#s..s.....h......>.#',
    '#..................#',
    '#..t...rrrrrr..c...#',
    '#......rrrrrr..c...#',
    '#..t...rrrrrr......#',
    '#L................L#',
    '#.........D........#',
    '####################',
  ],
};

export const NETLOFT_2: TdMapDef = {
  id: 'netloft-2', name: "The Net-Mender's Loft · The Loft", outside: 'wall', dark: false,
  legend: { ...ROOM,
    '<': { ground: 'plank', object: 'down', station: NETLOFT_DOWN, exit: { to: 'netloft-1', arrive: 'netloft-up' } },
  },
  rows: [
    '####################',
    '#b..s.......t....<.#',
    '#..................#',
    '#rr.....rrrr.......#',
    '#rr.....rrrr....C..#',
    '#L.................#',
    '####################',
  ],
};

export const HERBAL_1: TdMapDef = {
  id: 'herbal-cottage-1', name: "The Herbalist's Cottage", outside: 'wall', dark: false,
  legend: { ...ROOM,
    'D': { ground: 'plank', station: HERBAL_OUT, exit: { to: 'surface', arrive: 'herbal-door' } },
    '>': { ground: 'plank', object: 'down', station: HERBAL_DOWN, exit: { to: 'herbal-cottage-0', arrive: 'herbal-cellar-up' } },
  },
  rows: [
    '##################',
    '#s.s.s....h....>.#',
    '#................#',
    '#..t....rrr......#',
    '#.......rrr...c..#',
    '#..t..........c..#',
    '#L..............L#',
    '#.......D........#',
    '##################',
  ],
};

export const HERBAL_0: TdMapDef = {
  id: 'herbal-cottage-0', name: "The Herbalist's Cottage · Root Cellar", outside: 'wall', dark: true,
  legend: { ...ROOM,
    '<': { ground: 'dirt', object: 'up', station: HERBAL_UP, exit: { to: 'herbal-cottage-1', arrive: 'herbal-down' } },
    's': { ground: 'dirt', object: 'shelf' }, 'C': { ground: 'dirt', object: 'chest' }, 'L': { ground: 'dirt', object: 'rootlamp' },
    't': { ground: 'dirt', object: 'table' },
  },
  rows: [
    '##################',
    '#s,s,s,,,,,,,,<,,#',
    '#,,,,,,,,,,,,,,,,#',
    '#,,,t,,,,,,,,,,,,#',
    '#L,,,,,,,,,,,,,,L#',
    '#,C,,,,,,,,,,,s,,#',
    '##################',
  ],
};
