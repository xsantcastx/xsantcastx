/**
 * glass-throat.ts — the Glass Throat, the Infernal Reach's second connector (docs/design/world-acts.md §1.2; canon
 * §8.5): nobody built it. A lava tube cooled into glass the colour of the Forge's spill, from the Obsidian Badlands'
 * fissure down and through to the Molten Fields. It is **the only way to the Fields**. Two floors, levels 17–19.
 *
 * Lair: Glass Sentinels that walked out of the Foundry and lost the way home; Slag Crawlers on the cooling crust. Mood:
 * the Keeper's own light thrown back from every wall; dark red at the floor cracks.
 *  −1: a Firecaller's ritual ring with *vael dra* cut and half melted (the thing to read); a side tube choked with glass
 *      (the sealed thing).
 *  −2: the mirror hall, rime-bright, Sentinels in rows; footprints fused in the glass floor going *in* (the thing to
 *      read); a wall of glass with a cache behind it (the sealed thing and the hidden one).
 * Sound: glass pinging as it cools (td-sections REACH_BIBLE).
 *
 * Legend: # rock · . floor · e a crack of lava · r rime on the glass · T torch (at the stairs only) · B bones · C the
 * cache · P glass piers · D sealed glass · R the ritual ring · F the fused footprints · ^ / < / > the ways ·
 * n a Glass Sentinel · k a Slag Crawler.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

/** The way in, at the Badlands' obsidian fissure (td-world places it at the cave). */
export const THROAT_IN: StationDef = { id: 'glass-throat', x: 0, label: 'THE GLASS THROAT', kind: 'passage', blurb: 'A lava tube cooled to black glass. The only way to the Molten Fields. Dangerous below level 17.' };
/** The way back in from the Molten Fields' end. */
export const THROAT_OUT_IN: StationDef = { id: 'throat-mouth', x: 0, label: 'THE GLASS THROAT', kind: 'passage', blurb: 'Back into the glass, toward the Obsidian Badlands.' };
const T1_UP: StationDef = { id: 'throat-up', x: 0, label: 'FISSURE', kind: 'passage', blurb: 'Up and out to the Obsidian Badlands.' };
const T1_DOWN: StationDef = { id: 'throat-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down the tube to the mirror hall (floor 2).' };
const T2_UP: StationDef = { id: 'throat2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the ritual ring (floor 1).' };
const T2_OUT: StationDef = { id: 'throat-out', x: 0, label: 'TUBE MOUTH', kind: 'passage', blurb: 'Up and out to the Molten Fields.' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'rock' }, '.': { ground: 'cave' }, 'e': { ground: 'ember' }, 'r': { ground: 'cave', object: 'rime' },
  'T': { ground: 'cave', object: 'torch' }, 'B': { ground: 'cave', object: 'bones' }, 'C': { ground: 'cave', object: 'chest' },
  'P': { ground: 'cave', object: 'pillar' },
  'n': { ground: 'cave', mob: 'glass-sentinel' }, 'k': { ground: 'cave', mob: 'slag-crawler' },
};

export const GLASS_THROAT_1: TdMapDef = {
  id: 'glass-throat-1', name: 'The Glass Throat · Floor 1 · The Ritual Ring', outside: 'rock', dark: true,
  legend: { ...BASE,
    'R': { ground: 'cave', object: 'circle', station: { id: 'read:throat-ring', x: 0, label: 'A RITUAL RING', kind: 'resource', blurb: 'Words cut in the glass, half melted.' } },
    'D': { ground: 'cave', door: 'throat-tube', station: { id: 'sealed:throat-tube', x: 0, label: 'A GLASS-CHOKED TUBE', kind: 'resource', blurb: 'A side tube, shut with glass.' } },
    '^': { ground: 'cave', object: 'up', station: T1_UP, exit: { to: 'surface', arrive: 'glass-throat', continent: 'infernal-reach-badlands' } },
    '>': { ground: 'cave', object: 'down', station: T1_DOWN, exit: { to: 'glass-throat-2', arrive: 'throat2-up' } },
  },
  rows: [
    '################################################################',
    '###....^......##################################################',
    '###...........################################...............###',
    '###..T...T....################################...............###',
    '###.................r.............................r..........###',
    '###...........................ee.........................k...###',
    '###.................................r........................###',
    '###...........################################...............###',
    '###...........################################....n..........###',
    '##############################################...............###',
    '##############################################............r..###',
    '##############################################...............###',
    '##############################################...............###',
    '####################################################...#########',
    '####################################################...#########',
    '################.........................................#######',
    '################........r................................#######',
    '################........................k................#######',
    '####.....................................................#######',
    '####..................n...........R......................#######',
    '####........................................ee...........#######',
    '####.......#####..............n..........................#######',
    '####.......#####................................r........#######',
    '####.......#####.........................................#######',
    '####...k...#####################################################',
    '####....e..#####################################################',
    '####.......###########################.....................#####',
    '####.......###########################....r................#####',
    '####.......................................................#####',
    '####.....................n....e............................#####',
    '####..r.....................................k..............#####',
    '####.......#########...###############.....................#####',
    '####.......#########...###############.....................#####',
    '####################...###############.....................#####',
    '##############...........#############..n..................#####',
    '#############P....k......#############.............T.....T.#####',
    '#############D...........#############................>....#####',
    '#############P...........#############.....................#####',
    '################################################################',
    '################################################################',
  ],
};

export const GLASS_THROAT_2: TdMapDef = {
  id: 'glass-throat-2', name: 'The Glass Throat · Floor 2 · The Mirror Hall', outside: 'rock', dark: true,
  legend: { ...BASE,
    'F': { ground: 'cave', object: 'rime', station: { id: 'read:throat-prints', x: 0, label: 'FUSED FOOTPRINTS', kind: 'resource', blurb: 'Footprints in the glass floor.' } },
    'D': { ground: 'cave', door: 'throat-glass', station: { id: 'sealed:throat-glass', x: 0, label: 'A WALL OF GLASS', kind: 'resource', blurb: 'Your own face looks back.' } },
    '<': { ground: 'cave', object: 'up', station: T2_UP, exit: { to: 'glass-throat-1', arrive: 'throat-down' } },
    '^': { ground: 'cave', object: 'up', station: T2_OUT, exit: { to: 'surface', arrive: 'throat-mouth', continent: 'infernal-reach-molten-fields' } },
  },
  rows: [
    '################################################################',
    '################################################.....<.....#####',
    '################################################...........#####',
    '#############........................###########...T...T...#####',
    '#############..r..r..r..r..r..r..r...###########...........#####',
    '#############..............................................#####',
    '#############..............................................#####',
    '#############..............................................#####',
    '###.........#.....n.......n..........###########...........#####',
    '###.........P........................###########################',
    '###..C......D........................###########################',
    '###.........P...................n....###########################',
    '###.........#.........n..............###########################',
    '#############........................###########################',
    '#############..r..r..r..r..r..r..r...###########################',
    '#############........................###########################',
    '########################...#####################################',
    '########################...#####################################',
    '########################...#####################################',
    '########################...#####################################',
    '########################.................................#######',
    '########################................k................#######',
    '########################................ee...............#######',
    '########################........................n........#######',
    '########################.................................#######',
    '####################################################...#########',
    '######.................................................#########',
    '######........k...............F.....n..................#########',
    '######............ee...................................#########',
    '######.....#####################################################',
    '######.....#####################################################',
    '######.....#####################################################',
    '######.....#############################...................#####',
    '######.....#############################...................#####',
    '######.....................................................#####',
    '######..............k.........n............................#####',
    '######.....................................................#####',
    '######...........................................T.....T...#####',
    '########################################............^......#####',
    '################################################################',
  ],
};
