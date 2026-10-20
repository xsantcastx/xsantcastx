/**
 * ember-inn.ts — the Ember Inn in the Basalt Seamworks: the first house you walk into, and the first floor up
 * (owner 2026-10-20: "floors layers … like a modern tibia world"). Downstairs a tavern: the bar, tables by the hearth,
 * a bookshelf; stairs up to a landing of guest rooms, a chest at the end of the hall.
 *
 * Legend: # wall · . boards · r rug · t table · b bed · s shelf · c the bar · h hearth · D the door out ·
 * > stairs up · < stairs down · C chest.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

export const INN_DOOR: StationDef = { id: 'inn-door', x: 0, label: 'THE EMBER INN', kind: 'passage', blurb: 'A warm tavern with rooms upstairs.' };
export const INN_OUT: StationDef = { id: 'inn-out', x: 0, label: 'DOOR', kind: 'passage', blurb: 'Back out to the square.' };
export const INN_UP: StationDef = { id: 'inn-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the rooms.' };
export const INN_DOWN: StationDef = { id: 'inn-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the tavern.' };

const ROOM: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'wall' }, '.': { ground: 'plank' }, 'r': { ground: 'rug' },
  't': { ground: 'plank', object: 'table' }, 'b': { ground: 'plank', object: 'bed' }, 's': { ground: 'plank', object: 'shelf' },
  'c': { ground: 'plank', object: 'counter' }, 'h': { ground: 'plank', object: 'hearth' }, 'C': { ground: 'plank', object: 'chest' },
};

export const EMBER_INN_1: TdMapDef = {
  id: 'ember-inn-1', name: 'The Ember Inn', outside: 'wall', dark: false,
  legend: { ...ROOM,
    'D': { ground: 'plank', station: INN_OUT, exit: { to: 'surface', arrive: 'inn-door' } },
    '>': { ground: 'plank', object: 'up', station: INN_UP, exit: { to: 'ember-inn-2', arrive: 'inn-down' } },
  },
  rows: [
    '######################',
    '#s..s.......h.....>..#',
    '#....................#',
    '#..t....t.....rrr....#',
    '#.............rrr..t.#',
    '#..t....t.....rrr....#',
    '#....................#',
    '#.....c.......t......#',
    '#....................#',
    '#..........D.........#',
    '######################',
  ],
};

export const EMBER_INN_2: TdMapDef = {
  id: 'ember-inn-2', name: 'The Ember Inn · Upstairs', outside: 'wall', dark: false,
  legend: { ...ROOM,
    '<': { ground: 'plank', object: 'down', station: INN_DOWN, exit: { to: 'ember-inn-1', arrive: 'inn-up' } },
  },
  rows: [
    '######################',
    '#b..s#b...#b..s#..<..#',
    '#....#....#....#.....#',
    '#rr..#rr..#rr..#.....#',
    '##.###.####.####.....#',
    '#....................#',
    '#rrrrrrrrrrrrrrrrrr..#',
    '#...................C#',
    '######################',
  ],
};
