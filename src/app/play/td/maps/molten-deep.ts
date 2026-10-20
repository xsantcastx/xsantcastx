/**
 * molten-deep.ts — the Molten Deep, under Infernal Reach's Molten Fields (docs/design/world-map.md: Infernal Reach's
 * first dungeon, levels 8–30). Drawn by hand, wide on purpose (owner 2026-10-20: "more space … I'm getting stuck").
 * Floor 1, the Scorched Throat: a long descent past lava pools where Lava Hounds hunt in packs and Imps nest.
 * Floor 2, the Glass Halls: obsidian galleries split by lava rivers, crossed on stone bridges, Golems on guard.
 * Floor 3, the Tyrant's Caldera: a ring of lava round an island of rock where the Magma Tyrant waits.
 *
 * Legend: # rock · . floor · e lava · = a stone bridge · T torch · B bones · C chest · o boulder · O ore ·
 * ^ the way out · < stairs up · > stairs down · h a Lava Hound · i a Cinder Imp · g an Obsidian Golem · W the Tyrant.
 */
import { INFERNAL_TOWN } from '../../world/towns/infernal';
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

const ore = INFERNAL_TOWN.stations.find(s => s.id === 'ore')!;
/** The way in, in the Molten Fields (td-world places it at the cave mouth). */
export const DEEP_IN: StationDef = { id: 'molten-deep', x: 0, label: 'THE MOLTEN DEEP', kind: 'passage', blurb: 'A burning dungeon under the Molten Fields. Dangerous below level 10.' };
const DEEP_OUT: StationDef = { id: 'deep-out', x: 0, label: 'CAVE MOUTH', kind: 'passage', blurb: 'Back out to the Molten Fields.' };
const D1_DOWN: StationDef = { id: 'deep1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Glass Halls (floor 2).' };
const D2_UP: StationDef = { id: 'deep2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Scorched Throat (floor 1).' };
const D2_DOWN: StationDef = { id: 'deep2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: "Down to the Tyrant's Caldera (floor 3)." };
const D3_UP: StationDef = { id: 'deep3-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Glass Halls (floor 2).' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'rock' }, '.': { ground: 'cave' }, 'e': { ground: 'ember' }, '=': { ground: 'cobble' },
  'O': { ground: 'cave', object: 'ore', station: ore }, 'T': { ground: 'cave', object: 'torch' }, 'B': { ground: 'cave', object: 'bones' },
  'C': { ground: 'cave', object: 'chest' }, 'o': { ground: 'cave', object: 'boulder' },
  'h': { ground: 'cave', mob: 'lava-hound' }, 'i': { ground: 'cave', mob: 'cinder-imp' }, 'g': { ground: 'cave', mob: 'obsidian-golem' },
};

export const MOLTEN_DEEP_1: TdMapDef = {
  id: 'molten-deep-1', name: 'The Molten Deep · Floor 1 · The Scorched Throat', outside: 'rock', dark: true,
  legend: { ...BASE,
    '^': { ground: 'cave', object: 'up', station: DEEP_OUT, exit: { to: 'surface', arrive: 'molten-deep' } },
    '>': { ground: 'cave', object: 'down', station: D1_DOWN, exit: { to: 'molten-deep-2', arrive: 'deep2-up' } },
  },
  rows: [
    '##############################################',
    '###########...^...############################',
    '##########.........###########################',
    '#########....T.T....##########################',
    '########.............#########################',
    '#######..........o....########################',
    '######...ee............#######....T...########',
    '######..eeee............#####...........######',
    '######...ee.............#####....O..i....#####',
    '#######...i...B................h....ee...#####',
    '########...............h..........eeee...#####',
    '#########......####...............ee.....#####',
    '##########....######..h...T......h.......#####',
    '###########..#######..........#####.....######',
    '##########...#######.....h...######....#######',
    '#########....########.......#######...########',
    '########..i..#########.....########...########',
    '########.....##########...#########.....######',
    '#########...###########...########.......#####',
    '##########.T###########.C.########...ee..#####',
    '##########...#####################..eeee.#####',
    '###########...####################...ee..#####',
    '############....T########################...##',
    '#############.......#################......###',
    '##############..h.....####........T....>..####',
    '###############.............................##',
    '################.....T.......####..o.....#####',
    '##############################################',
  ],
};

export const MOLTEN_DEEP_2: TdMapDef = {
  id: 'molten-deep-2', name: 'The Molten Deep · Floor 2 · The Glass Halls', outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: D2_UP, exit: { to: 'molten-deep-1', arrive: 'deep1-down' } },
    '>': { ground: 'cave', object: 'down', station: D2_DOWN, exit: { to: 'molten-deep-3', arrive: 'deep3-up' } },
  },
  rows: [
    '##############################################',
    '#####...<...##################################',
    '####.........#################################',
    '####...T.T...######.....T.....################',
    '####.........#####.............###############',
    '#####.......######.....g........##############',
    '######.....#######..............##############',
    '######.....eeeeeee===eeeeeeeeeeeeeee##########',
    '######.....eeeeeee===eeeeeeeeeeeeeeee#########',
    '#######....######.......####......eee#########',
    '########...######...O...####..h....e##########',
    '########...######.......####.......###########',
    '#######.....####...B....####....T...##########',
    '######..h..g.###........#####........#########',
    '######..........................h....#########',
    '#######......T.......g.................########',
    '########eeeeeeeeeeeeeeeeeeeeee===eeeeeeee#####',
    '########eeeeeeeeeeeeeeeeeeeeee===eeeeeeeee####',
    '##########......#####......####...#####...####',
    '#########...C....###...i....##.....###.....###',
    '#########........###........##.go..###.....###',
    '##########..T...####...T....##.....###.....###',
    '###########.......................T......>..##',
    '############..########.................#######',
    '##############################################',
  ],
};

export const MOLTEN_DEEP_3: TdMapDef = {
  id: 'molten-deep-3', name: "The Molten Deep · Floor 3 · The Tyrant's Caldera", outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: D3_UP, exit: { to: 'molten-deep-2', arrive: 'deep2-down' } },
    'W': { ground: 'cave', mob: 'magma-tyrant' },
  },
  rows: [
    '##############################################',
    '####################..<..#####################',
    '###################.......####################',
    '##################..T...T..###################',
    '##################.........###################',
    '###########.....................##############',
    '#########.......eeeeeeeeeee.......############',
    '########....T..eeeeeeeeeeeee..T....###########',
    '#######.......eee.........eee......h##########',
    '#######......eee...T...T...eee......##########',
    '######......eee.............eee......#########',
    '######..g...===......W......===...g..#########',
    '######......eee.............eee......#########',
    '#######......eee...T...T...eee......##########',
    '#######..h....eee.........eee.......##########',
    '########....T..eeeeeeeeeeeee..T....###########',
    '#########.......eeeeeeeeeee.......############',
    '###########.........C.B.........##############',
    '##############################################',
  ],
};
