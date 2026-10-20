/**
 * pyre-spire.ts — the Pyre Spire in Pyrehold: a watchtower of three floors (owner 2026-10-20: "floors layers … like a
 * modern tibia world"). The Watch Hall at the foot (tables, a hearth, the wardens' shelves), the Study above (books,
 * rugs, a reading table), and the Lookout at the top, open to the sky over the Burning Sea, a chest by the parapet.
 * Floors are wide on purpose — every passage two tiles or more, so nothing catches the Keeper.
 *
 * Legend as the Ember Inn (maps/ember-inn.ts): # wall · . boards · , flagstones · r rug · t table · s shelf ·
 * h hearth · D the door out · > stairs up · < stairs down · C chest.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

export const SPIRE_DOOR: StationDef = { id: 'spire-door', x: 0, label: 'THE PYRE SPIRE', kind: 'passage', blurb: "Pyrehold's watchtower, three floors high." };
const SPIRE_OUT: StationDef = { id: 'spire-out', x: 0, label: 'DOOR', kind: 'passage', blurb: 'Back out to Pyrehold.' };
const HALL_UP: StationDef = { id: 'spire-1-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Study.' };
const STUDY_DOWN: StationDef = { id: 'spire-2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Watch Hall.' };
const STUDY_UP: StationDef = { id: 'spire-2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Lookout.' };
const LOOKOUT_DOWN: StationDef = { id: 'spire-3-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Study.' };

const ROOM: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'wall' }, '.': { ground: 'plank' }, ',': { ground: 'cobble' }, 'r': { ground: 'rug' },
  't': { ground: 'plank', object: 'table' }, 's': { ground: 'plank', object: 'shelf' },
  'h': { ground: 'cobble', object: 'hearth' }, 'C': { ground: 'plank', object: 'chest' },
};

export const PYRE_SPIRE_1: TdMapDef = {
  id: 'pyre-spire-1', name: 'The Pyre Spire · Watch Hall', outside: 'wall', dark: false,
  legend: { ...ROOM,
    'D': { ground: 'cobble', station: SPIRE_OUT, exit: { to: 'surface', arrive: 'spire-door' } },
    '>': { ground: 'cobble', object: 'up', station: HALL_UP, exit: { to: 'pyre-spire-2', arrive: 'spire-2-down' } },
  },
  rows: [
    '########################',
    '#######,,,,h,,,,,#######',
    '####s,,,,,,,,,,,,,,s####',
    '###,,,,,,,,,,,,,,,,,,>,#',
    '##,,,,t,,,,,,,,,t,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,rrrrrr,,,,,,,,#',
    '#,,,,t,,,rrrrrr,,,,t,,,#',
    '#,,,,,,,,,,,,,,,,,,,,,,#',
    '##,,,,,,,,,,,,,,,,,,,,##',
    '####,,,,,,,,D,,,,,,,####',
    '########################',
  ],
};

export const PYRE_SPIRE_2: TdMapDef = {
  id: 'pyre-spire-2', name: 'The Pyre Spire · Study', outside: 'wall', dark: false,
  legend: { ...ROOM,
    '<': { ground: 'plank', object: 'down', station: STUDY_DOWN, exit: { to: 'pyre-spire-1', arrive: 'spire-1-up' } },
    '>': { ground: 'plank', object: 'up', station: STUDY_UP, exit: { to: 'pyre-spire-3', arrive: 'spire-3-down' } },
  },
  rows: [
    '########################',
    '#######s..s..s..s#######',
    '####..............s#####',
    '###.................<..#',
    '##.....rrrrrrrr........#',
    '#......rrrrrrrr........#',
    '#......rrrtrrrr........#',
    '#......rrrrrrrr....t...#',
    '#......................#',
    '##.>..................##',
    '####................####',
    '########################',
  ],
};

export const PYRE_SPIRE_3: TdMapDef = {
  id: 'pyre-spire-3', name: 'The Pyre Spire · Lookout', outside: 'wall', dark: false,
  legend: { ...ROOM,
    '<': { ground: 'cobble', object: 'down', station: LOOKOUT_DOWN, exit: { to: 'pyre-spire-2', arrive: 'spire-2-up' } },
  },
  rows: [
    '########################',
    '#######,,,,,,,,,,#######',
    '####,,,,,,,,,,,,,,,,####',
    '###,,,,,,,,,,,,,,,,,,###',
    '##,,,,,,,,,,,,,,,,,,,,##',
    '#,,,,,,,,,,h,,,,,,,,,C,#',
    '#,,,,,,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,,,,#',
    '##,<,,,,,,,,,,,,,,,,,,##',
    '###,,,,,,,,,,,,,,,,,,###',
    '####,,,,,,,,,,,,,,,,####',
    '########################',
  ],
};
