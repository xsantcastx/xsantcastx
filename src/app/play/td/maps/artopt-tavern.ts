/**
 * artopt-tavern.ts — the isometric prototype's tavern (td-artopt.ts `iso`; the owner's Diablo II reference): a hall with
 * the bar along the north wall, shelves behind it, the hearth, tables with benches, a stack of barrels, lamps, a rug;
 * through a doorway a storeroom of crates with no lamp — the dark corner. Registered only while `?artopt=` is on
 * (td-levels.ts), so no player can ever walk into it.
 *
 * Legend: # wall · . boards · r rug · s shelf · c the bar · h hearth · t table · n bench · o barrel · x crate · l lamp ·
 * D the door out.
 */
import type { LegendEntry, TdMapDef } from '../td-level';
import { INN_OUT } from './ember-inn';

const ROOM: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'wall' }, '.': { ground: 'plank' }, 'r': { ground: 'rug' },
  's': { ground: 'plank', object: 'shelf' }, 'c': { ground: 'plank', object: 'counter' }, 'h': { ground: 'plank', object: 'hearth' },
  't': { ground: 'plank', object: 'table' }, 'n': { ground: 'plank', object: 'bench' }, 'o': { ground: 'plank', object: 'barrel' },
  'x': { ground: 'plank', object: 'crate' }, 'l': { ground: 'plank', object: 'lamp' },
};

export const ARTOPT_TAVERN: TdMapDef = {
  id: 'artopt-tavern', name: 'The Ember Inn (prototype)', outside: 'wall', dark: false,
  legend: { ...ROOM, 'D': { ground: 'plank', station: INN_OUT, exit: { to: 'surface', arrive: 'inn-door' } } },
  rows: [
    '########################',
    '#s.s..l..h..l.#xx.o...x#',
    '#cccccc.......#x.......#',
    '#.............#........#',
    '#.l.ntn...ntn.#.....x..#',
    '#.............#........#',
    '#oo...........l........#',
    '#ooo.ntn..l............#',
    '#.............#........#',
    '#.........rrr.#..o.....#',
    '#..l......rrr.#xx......#',
    '#.............#xxo.....#',
    '#......D......#........#',
    '########################',  ],
};
