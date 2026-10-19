/**
 * ember-mine-deep.ts — the Ember Mine's floors 2 and 3, drawn by hand (docs/design/world-map.md: Ember Mine −1…−3,
 * boss). Floor 2, the Flooded Galleries: old workings half under black water, bridged by planks, Bailiffs on watch.
 * Floor 3, the Warden's Forge: a long hall to a ring of torches where the Ember Warden keeps the mine's heart.
 *
 * Legend as floor 1 (maps/ember-mine-1.ts), plus: = plank walkway · < stairs up · > stairs down · W the Ember Warden.
 */
import { INFERNAL_TOWN } from '../../world/towns/infernal';
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

const ore = INFERNAL_TOWN.stations.find(s => s.id === 'ore')!;
export const MINE_2_UP: StationDef = { id: 'mine2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to floor 1.' };
export const MINE_2_DOWN: StationDef = { id: 'mine2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: "Down to the Warden's Forge (floor 3)." };
export const MINE_3_UP: StationDef = { id: 'mine3-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Flooded Galleries (floor 2).' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'rock' }, '.': { ground: 'cave' }, '=': { ground: 'plank' }, '~': { ground: 'water' },
  'O': { ground: 'cave', object: 'ore', station: ore }, 'T': { ground: 'cave', object: 'torch' }, 'B': { ground: 'cave', object: 'bones' },
  'C': { ground: 'cave', object: 'chest' }, 'o': { ground: 'cave', object: 'boulder' },
  'm': { ground: 'cave', mob: 'rivet-maw' }, 'b': { ground: 'cave', mob: 'cinder-bailiff' }, 'i': { ground: 'cave', mob: 'cinder-imp' },
};

export const EMBER_MINE_2: TdMapDef = {
  id: 'ember-mine-2', name: 'Ember Mine · Floor 2 · The Flooded Galleries', outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: MINE_2_UP, exit: { to: 'ember-mine-1', arrive: 'mine1-down' } },
    '>': { ground: 'cave', object: 'down', station: MINE_2_DOWN, exit: { to: 'ember-mine-3', arrive: 'mine3-up' } },
  },
  rows: [
    '############################################',
    '##<.T.####################################',
    '##.....######~~~~~~~~~~~~~~~#######O.######',
    '###.....####~~~~~~~~~~~~~~~~~~####...b.####',
    '####.m...###~~~~~~=====~~~~~~~~##.......###',
    '#####......~~~~~~~=###==~~~~~~~~=====...###',
    '######.....=========###======~~~=###..T.###',
    '#######..T.~~~~~~~~#####~~~~=====###....###',
    '#########..~~~~~~~######~~~~~~~~=###.O..###',
    '##########.#~~~~~~########~~~~~~=####..####',
    '##########.###~~~###########~~~~=#####.####',
    '#########...#################~~~=#####.####',
    '########.....##############T....b.....m####',
    '#######..O.B..##############...........####',
    '#######.......###############....o....#####',
    '########..b..################C..i..T.######',
    '#########...#####################..########',
    '##########.######################..########',
    '##########.T#####################.>########',
    '############################################',
  ],
};

export const EMBER_MINE_3: TdMapDef = {
  id: 'ember-mine-3', name: "Ember Mine · Floor 3 · The Warden's Forge", outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: MINE_3_UP, exit: { to: 'ember-mine-2', arrive: 'mine2-down' } },
    'W': { ground: 'cave', mob: 'ember-warden' },
    'e': { ground: 'ember' },
  },
  rows: [
    '############################################',
    '#################.<.########################',
    '#################...########################',
    '################T...T#######################',
    '#################...########################',
    '##########.i.....b.....i..##################',
    '#########..............o...#################',
    '#########.T....##.....##...T################',
    '##########.....##..B..##...#################',
    '###########...###.....###.##################',
    '############..####...####.##################',
    '#############.....T.T.....##################',
    '##############.........#####################',
    '#############T..eeeee..T####################',
    '############...e.....e...###################',
    '###########.......W.......##################',
    '############...e.....e...###################',
    '#############T..eeeee..T####################',
    '##############....C....#####################',
    '############################################',
  ],
};
