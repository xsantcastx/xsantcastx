/**
 * molten-deep.ts — the Molten Deep, under Infernal Reach's Molten Fields (docs/design/world-map.md: Infernal Reach's
 * first dungeon, levels 8–30). Drawn by hand, wide on purpose (owner 2026-10-20: "more space … I'm getting stuck").
 * Floor 1, the Scorched Throat: a long descent past lava pools where Lava Hounds hunt in packs and Imps nest.
 * Floor 2, the Glass Halls: obsidian galleries split by lava rivers, crossed on stone bridges, Golems on guard.
 * Floor 3, the Tyrant's Caldera: a ring of lava round an island of rock where the Magma Tyrant waits; past it, south,
 * a stair the Tyrant was set to guard.
 * Floor 4, the Slag Rivers: two rivers of slag cut the floor in three, each crossed by one bridge; Slag Crawlers feed
 * on the cooling crust, Ember Drakes nest where the heat rises, Cinder Wraiths drift over the slag itself.
 * Floor 5, the Glass Foundry: where the Four cast their black glass — a flagstone hall of casting pits and cold anvils,
 * Glass Sentinels still at their posts, Golems hauling what nobody will ever pour again.
 * Floor 6, the Heart of the Deep: the cavern every slag river runs down to, round a basalt dais where the Cinder
 * Sovereign sits; at half its life it calls the Lava Hounds of the deep to its side.
 * Nothing waits within eight tiles of a stair (docs/design/world-map.md's rule for every dungeon).
 *
 * Legend: # rock · . floor · e lava · = a stone bridge or flagstones · T torch · B bones · C chest · o boulder · O ore ·
 * A an anvil · ^ the way out · < stairs up · > stairs down · h a Lava Hound · i a Cinder Imp · g an Obsidian Golem ·
 * k a Slag Crawler · n a Glass Sentinel · d an Ember Drake · w a Cinder Wraith · W the Tyrant · S the Cinder Sovereign.
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
const D3_DOWN: StationDef = { id: 'deep3-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Slag Rivers (floor 4). Dangerous below level 18.' };
const D4_UP: StationDef = { id: 'deep4-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: "Up to the Tyrant's Caldera (floor 3)." };
const D4_DOWN: StationDef = { id: 'deep4-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Glass Foundry (floor 5).' };
const D5_UP: StationDef = { id: 'deep5-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Slag Rivers (floor 4).' };
const D5_DOWN: StationDef = { id: 'deep5-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Heart of the Deep (floor 6). Something old and crowned sits there.' };
const D6_UP: StationDef = { id: 'deep6-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Glass Foundry (floor 5).' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'rock' }, '.': { ground: 'cave' }, 'e': { ground: 'ember' }, '=': { ground: 'cobble' },
  'O': { ground: 'cave', object: 'ore', station: ore }, 'T': { ground: 'cave', object: 'torch' }, 'B': { ground: 'cave', object: 'bones' },
  'C': { ground: 'cave', object: 'chest' }, 'o': { ground: 'cave', object: 'boulder' },
  'h': { ground: 'cave', mob: 'lava-hound' }, 'i': { ground: 'cave', mob: 'cinder-imp' }, 'g': { ground: 'cave', mob: 'obsidian-golem' },
  'A': { ground: 'cobble', object: 'anvil' }, 'k': { ground: 'cave', mob: 'slag-crawler' }, 'n': { ground: 'cobble', mob: 'glass-sentinel' },
  'd': { ground: 'cave', mob: 'ember-drake' }, 'w': { ground: 'cave', mob: 'cinder-wraith' },
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
    '>': { ground: 'cave', object: 'down', station: D3_DOWN, exit: { to: 'molten-deep-4', arrive: 'deep4-up' } },
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
    '##########################...#################',
    '##########################...#################',
    '#######################.........##############',
    '#######################..T...T..##############',
    '#######################....>....##############',
    '#######################.........##############',
    '##############################################',
  ],
};

export const MOLTEN_DEEP_4: TdMapDef = {
  id: 'molten-deep-4', name: 'The Molten Deep · Floor 4 · The Slag Rivers', outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: D4_UP, exit: { to: 'molten-deep-3', arrive: 'deep3-down' } },
    '>': { ground: 'cave', object: 'down', station: D4_DOWN, exit: { to: 'molten-deep-5', arrive: 'deep5-up' } },
  },
  rows: [
    '##############################################',
    '#####...<...##################################',
    '####.........#################################',
    '####..T...T..######......T.......#############',
    '####.........#####.................###########',
    '#####.................k.................######',
    '######..........................T........#####',
    '######eeeeeeeeeeeeeeeeeeee===eeeeeeeeeeeeeeee#',
    '######eeeeeeeeeeeeeeeeeeee===eeeeeeeeeeeeeeee#',
    '######............h.................d......###',
    '#####....T.......####.........####.......#####',
    '#####...........######.......######......#####',
    '######....k.....######...C...######..w...#####',
    '#######.........####.........####.......######',
    '########......................T.........######',
    '#######.................h..............#######',
    '#######eeeeeeeeeeeeeeeeeeeeeeeeeee===eeeeeeee#',
    '#######eeeeeeeeeeeeeeeeeeeeeeeeeee===eeeeeeee#',
    '########.........................T....o...####',
    '#######..........###########..............####',
    '#######....T.....###########..k...........####',
    '########.........###########..............####',
    '#########...>.....########.......C.......#####',
    '##########.........########...............####',
    '###########.......................T......#####',
    '##############################################',
  ],
};

export const MOLTEN_DEEP_5: TdMapDef = {
  id: 'molten-deep-5', name: 'The Molten Deep · Floor 5 · The Glass Foundry', outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: D5_UP, exit: { to: 'molten-deep-4', arrive: 'deep4-down' } },
    '>': { ground: 'cave', object: 'down', station: D5_DOWN, exit: { to: 'molten-deep-6', arrive: 'deep6-up' } },
  },
  rows: [
    '##############################################',
    '##################################...<...#####',
    '#################################.........####',
    '###########################......T.....T..####',
    '#####=========================............####',
    '#####==T=================T===.............####',
    '#####=====eee======eee=======#####.......#####',
    '#####==n==eee===g==eee===n===#####.......#####',
    '#####=====eee======eee=======#####...T...#####',
    '#####=====eee======eee=======#####.......#####',
    '#####==T=================T===####.........####',
    '#####=========================.....k.......###',
    '######=======A=======A=======.............####',
    '########.....######..............######..#####',
    '#######.......####......w.........####...#####',
    '######...T.....##.................##....######',
    '######.........##....eeeeeeeee....##...T.#####',
    '#######.......###...eeeeeeeeeee...###.....####',
    '########.....####....eeeeeeeee....###..n..####',
    '#######.......###.................###.....####',
    '######.....................g..............####',
    '######.....T..........................C...####',
    '#######.......################################',
    '#######...>...################################',
    '########.....#################################',
    '##############################################',
  ],
};

export const MOLTEN_DEEP_6: TdMapDef = {
  id: 'molten-deep-6', name: 'The Molten Deep · Floor 6 · The Heart of the Deep', outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: D6_UP, exit: { to: 'molten-deep-5', arrive: 'deep5-down' } },
    'S': { ground: 'cave', mob: 'cinder-sovereign' },
  },
  rows: [
    '##############################################',
    '######################..<..###################',
    '#####################.......##################',
    '####################..T...T..#################',
    '####################.........#################',
    '###################...........################',
    '##################.............###############',
    '##############.....................###########',
    '###########.............................######',
    '#########....eeee.................eeee....####',
    '########..T.eeeeee...............eeeeee.T..###',
    '#######......eeee.................eeee......##',
    '######......................................##',
    '#####......T...........................T....##',
    '#####..h..................................h..#',
    '#####..................S.....................#',
    '######.......................................#',
    '######.....T...........................T....##',
    '#######......eeee.................eeee.....###',
    '########....eeeeee....eeeeeeee...eeeeee...####',
    '#########....eeee......eeeeee.....eeee...#####',
    '###########.....w...................w...######',
    '#############..........C...C..........########',
    '################..........B.........##########',
    '####################.............#############',
    '##############################################',
  ],
};
