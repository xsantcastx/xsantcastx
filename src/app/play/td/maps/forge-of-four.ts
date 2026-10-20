/**
 * forge-of-four.ts — the Forge of the Four, under the Obsidian Badlands at the foot of the Pyre Peaks, Infernal Reach
 * (docs/design/world-map.md: −1…−4; these are −1…−3). Four smiths once worked here side by side, each at their own
 * hearth, and what they forged walked out into the Reach as Bailiffs and Golems. The smiths are long gone; their
 * works were never told to stop. Drawn by hand, wide on purpose, nothing within eight tiles of a stair.
 *
 * Floor 1, the Ash Gate: a stair down from the ruined gatehouse into the first smithy, its hearths cold, two lava
 * channels still running; Bailiffs keep the hall.
 * Floor 2, the Four Smithies: a crossway and four smithies off it, one to each corner, each with its forge and anvil,
 * each still kept by what was made in it.
 * Floor 3, the First Anvil: the First Smith's own forge on an island of flagstones in a moat of slag, and the
 * Anvil-Warden set to keep it; at half its life it calls two Bailiffs to its side.
 *
 * Legend: # rock · . floor · = flagstones · e lava · T torch · B bones · C chest · F a forge · A an anvil ·
 * ^ the way out · < stairs up · > stairs down · b a Cinder Bailiff · g an Obsidian Golem · i a Cinder Imp ·
 * Y the Anvil-Warden.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

/** The way in, in the Obsidian Badlands (td-world stamps the ruined gate there). */
export const FORGE_IN: StationDef = { id: 'forge-of-four', x: 0, label: 'THE FORGE OF THE FOUR', kind: 'passage', blurb: 'The ruined smithies of the Four, under the Badlands. Dangerous below level 12.' };
const FORGE_OUT: StationDef = { id: 'forge-out', x: 0, label: 'FORGE GATE', kind: 'passage', blurb: 'Back up to the Obsidian Badlands.' };
const F1_DOWN: StationDef = { id: 'forge1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Four Smithies (floor 2).' };
const F2_UP: StationDef = { id: 'forge2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Ash Gate (floor 1).' };
const F2_DOWN: StationDef = { id: 'forge2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the First Anvil (floor 3). Something still strikes iron down there.' };
const F3_UP: StationDef = { id: 'forge3-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Four Smithies (floor 2).' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'rock' }, '.': { ground: 'cave' }, '=': { ground: 'cobble' }, 'e': { ground: 'ember' },
  'T': { ground: 'cave', object: 'torch' }, 'B': { ground: 'cave', object: 'bones' }, 'C': { ground: 'cave', object: 'chest' },
  'F': { ground: 'cobble', object: 'forge' }, 'A': { ground: 'cobble', object: 'anvil' },
  'b': { ground: 'cobble', mob: 'cinder-bailiff' }, 'g': { ground: 'cobble', mob: 'obsidian-golem' }, 'i': { ground: 'cave', mob: 'cinder-imp' },
};

export const FORGE_OF_FOUR_1: TdMapDef = {
  id: 'forge-of-four-1', name: 'The Forge of the Four · Floor 1 · The Ash Gate', outside: 'rock', dark: true,
  legend: { ...BASE,
    '^': { ground: 'cave', object: 'up', station: FORGE_OUT, exit: { to: 'surface', arrive: 'forge-of-four' } },
    '>': { ground: 'cave', object: 'down', station: F1_DOWN, exit: { to: 'forge-of-four-2', arrive: 'forge2-up' } },
  },
  rows: [
    '########################################',
    '#################..^..##################',
    '################.......#################',
    '###############..T...T..################',
    '################.......#################',
    '################.......#################',
    '#########======================#########',
    '########===F======A=====F=======########',
    '#######========================b=#######',
    '#######=====eee==========eee=====#######',
    '#######==b==eee===T==T===eee=====#######',
    '#######=====eee==========eee=====#######',
    '########=======================#########',
    '##########=====###########=====#########',
    '##########.....###########.....#########',
    '#########.......#########...i...########',
    '########.........#######.........#######',
    '########...T......................######',
    '#########.............i..........#######',
    '##########.....C..........T.......######',
    '###########.>.......................####',
    '############.........###################',
    '########################################',
  ],
};

export const FORGE_OF_FOUR_2: TdMapDef = {
  id: 'forge-of-four-2', name: 'The Forge of the Four · Floor 2 · The Four Smithies', outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: F2_UP, exit: { to: 'forge-of-four-1', arrive: 'forge1-down' } },
    '>': { ground: 'cave', object: 'down', station: F2_DOWN, exit: { to: 'forge-of-four-3', arrive: 'forge3-up' } },
  },
  rows: [
    '##############################################',
    '#####################..<..####################',
    '####################.......###################',
    '####################..T.T..###################',
    '####################.......###################',
    '###===========######.......######===========##',
    '###==F====A===######.......######===A====F==##',
    '###===========######.......######===========##',
    '###=====g=====......................=b======##',
    '###===========......................========##',
    '###==T=====T==######.......######==T=====T==##',
    '####=====#############...##########=====######',
    '#####...........................T..........###',
    '####..T....................................###',
    '####=====#############...##########=====######',
    '###===========######.......######===========##',
    '###==F====A===######.......######===A====F==##',
    '###=====g=====......................==b=====##',
    '###==b========......................========##',
    '###===========######.......######======g====##',
    '###==T=====T==######.......######==T=====T==##',
    '####################.......###################',
    '####################...C...###################',
    '#####################..>..####################',
    '#####################.....####################',
    '##############################################',
  ],
};

export const FORGE_OF_FOUR_3: TdMapDef = {
  id: 'forge-of-four-3', name: 'The Forge of the Four · Floor 3 · The First Anvil', outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: F3_UP, exit: { to: 'forge-of-four-2', arrive: 'forge2-down' } },
    'Y': { ground: 'cobble', mob: 'anvil-warden' },
  },
  rows: [
    '##############################################',
    '######################..<..###################',
    '#####################.......##################',
    '#####################.T...T.##################',
    '#####################.......##################',
    '##############..................##############',
    '###########............................#######',
    '#########.....eee================eee......####',
    '########.....eeee=====T======T===eeee......###',
    '#######..b...eee==================eee...b...##',
    '######.......eee==================eee.......##',
    '######..T....eee========F=========eee....T..##',
    '######.......eee===A==========A===eee.......##',
    '######.......eee=========Y========eee.......##',
    '#######......eee==================eee......###',
    '########.....eeee================eeee.....####',
    '#########.....eee================eee.....#####',
    '##########..............................######',
    '############....g................g.....#######',
    '##############.........C..C.........##########',
    '####################.....B.....###############',
    '##############################################',
  ],
};
