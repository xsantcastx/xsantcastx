/**
 * overgrown-temple.ts — the Overgrown Temple, under the Sunken Courts in the Verdant Wilds (docs/design/world-map.md:
 * −1…−5). Whoever raised it worshipped the Root, and the Root came to worship back: it grew in through
 * the floors, drank the temple's springs and set the old guardian to keep what was left. Drawn by hand, wide on purpose,
 * nothing within eight tiles of a stair.
 *
 * Floor 1, the Sunken Narthex: a stair down from the stepped gate into a pillared nave, two springs flooded across it,
 * side chapels gone to moss; Moss Stalkers hunt the aisles, Vine Lashers root in the chapels, Canopy Bats roost.
 * Floor 2, the Hall of Roots: the Root's own floor — great roots through the flagstones, a spring at the centre, Thorn
 * Weavers spinning in the corners.
 * Floor 3, the Heart Shrine: a round sanctum, a moat of spring water round an island, two causeways onto it, and the
 * Mossbound Colossus at its heart; at half its life it calls two Vine Lashers up through the stones. A passage behind
 * the shrine goes on down.
 * Floor 4, the Drowned Vault: where the temple kept what it was given. Two flooded channels cross a pillared hall, a
 * sunken pool holds a chest on an island; the priests who drowned keeping it still walk the aisles (Drowned Acolytes).
 * Floor 5, the Rootcradle: the cavern the temple was built over, ringed with roots, and what the Root grew first —
 * the Elder Rootwyrm, coiled at its heart. It breathes rootglass; at half its life it calls the acolytes down to it.
 *
 * Legend: # temple wall · . flagstones · , moss · ~ spring water · R a great root · P a pillar · T torch · B bones ·
 * C chest · ^ the way out · < stairs up · > stairs down · b a Canopy Bat · k a Moss Stalker · v a Vine Lasher ·
 * w a Thorn Weaver · X the Mossbound Colossus · z a Drowned Acolyte · Z the Elder Rootwyrm.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

/** The way in, in the Sunken Courts (td-world stamps the temple's stepped gate there). */
export const TEMPLE_IN: StationDef = { id: 'overgrown-temple', x: 0, label: 'THE OVERGROWN TEMPLE', kind: 'passage', blurb: 'A temple the Root grew into, under the Sunken Courts. Dangerous below level 16.' };
const TEMPLE_OUT: StationDef = { id: 'temple-out', x: 0, label: 'TEMPLE GATE', kind: 'passage', blurb: 'Back up to the Sunken Courts.' };
const T1_DOWN: StationDef = { id: 'temple1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Hall of Roots (floor 2).' };
const T2_UP: StationDef = { id: 'temple2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Sunken Narthex (floor 1).' };
const T2_DOWN: StationDef = { id: 'temple2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Heart Shrine (floor 3). Something old and green is keeping it.' };
const T3_UP: StationDef = { id: 'temple3-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Hall of Roots (floor 2).' };
const T3_DOWN: StationDef = { id: 'temple3-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Drowned Vault (floor 4). The water there has not moved in a long time.' };
const T4_UP: StationDef = { id: 'temple4-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Heart Shrine (floor 3).' };
const T4_DOWN: StationDef = { id: 'temple4-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Rootcradle (floor 5). Something under the temple is breathing.' };
const T5_UP: StationDef = { id: 'temple5-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Drowned Vault (floor 4).' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'vinewall' }, '.': { ground: 'flagstone' }, ',': { ground: 'moss' }, '~': { ground: 'water' }, 'R': { ground: 'bark' },
  'P': { ground: 'flagstone', object: 'pillar' }, 'T': { ground: 'flagstone', object: 'torch' }, 'B': { ground: 'moss', object: 'bones' },
  'C': { ground: 'moss', object: 'chest' },
  'b': { ground: 'flagstone', mob: 'canopy-bat' }, 'k': { ground: 'flagstone', mob: 'moss-stalker' }, 'v': { ground: 'moss', mob: 'vine-lasher' },
  'w': { ground: 'flagstone', mob: 'thorn-weaver' }, 'z': { ground: 'flagstone', mob: 'drowned-acolyte' },
};

export const OVERGROWN_TEMPLE_1: TdMapDef = {
  id: 'overgrown-temple-1', name: 'The Overgrown Temple · Floor 1 · The Sunken Narthex', outside: 'vinewall', dark: true,
  legend: { ...BASE,
    '^': { ground: 'flagstone', object: 'up', station: TEMPLE_OUT, exit: { to: 'surface', arrive: 'overgrown-temple' } },
    '>': { ground: 'flagstone', object: 'down', station: T1_DOWN, exit: { to: 'overgrown-temple-2', arrive: 'temple2-up' } },
  },
  rows: [
    '################################################',
    '###################....^.....###################',
    '###################..........###################',
    '###################.T......T.###################',
    '###################..........###################',
    '###################..........###################',
    '###################..........###################',
    '###################..........###################',
    '#####################......#####################',
    '#####################......#####################',
    '#####################......#####################',
    '######....................................######',
    '######....P.....P.....P..P.....P.....P....######',
    '#,,,,,.T.......~................~.......T.,,,,,#',
    '#,C,,,......~~~~~~~..........~~~~~~~......,,B,,#',
    '#,,,,,.....~~~~~~~~~...b....~~~~~~~~~.....,,,,,#',
    '#,,,v,....~~~~~~~~~~~......~~~~~~~~~~~....,,,,,#',
    '#,,,,,...k.~~~~~~~~~........~~~~~~~~~.k...,v,,,#',
    '#,,,,,......~~~~~~~..........~~~~~~~......,,,,,#',
    '#,,B,,.........~................~.........,,,C,#',
    '#,,,,,.T................................T.,,,,,#',
    '######....P.....P.....P..P.....P.....P....######',
    '######....................................######',
    '##########,,,,,,,##############,,,,,,,##########',
    '##########,,,,,,,##############,,,,,,,##########',
    '##########,,b,,,,..............,,,,b,,##########',
    '##########,,,,,,,..............,,,,,,,##########',
    '##########,,,,,,,.......>......,,,,,,,##########',
    '################################################',
    '################################################',
  ],
};

export const OVERGROWN_TEMPLE_2: TdMapDef = {
  id: 'overgrown-temple-2', name: 'The Overgrown Temple · Floor 2 · The Hall of Roots', outside: 'vinewall', dark: true,
  legend: { ...BASE,
    '<': { ground: 'flagstone', object: 'up', station: T2_UP, exit: { to: 'overgrown-temple-1', arrive: 'temple1-down' } },
    '>': { ground: 'flagstone', object: 'down', station: T2_DOWN, exit: { to: 'overgrown-temple-3', arrive: 'temple3-up' } },
    'v': { ground: 'flagstone', mob: 'vine-lasher' }, 'k': { ground: 'flagstone', mob: 'moss-stalker' },
  },
  rows: [
    '##################################################',
    '#####################........#####################',
    '#####################...<....#####################',
    '#####################........#####################',
    '#####################........#####################',
    '#####################........#####################',
    '######################T....T######################',
    '#######################....#######################',
    '#######################....#######################',
    '####..........................................####',
    '####..P..........P..............P..........P..####',
    '####......RRRR......................RRRR......####',
    '####.T....RRRR...........b..........RRRR....T.####',
    '####......RRRR..v................v..RRRR......####',
    '#,,,......RRRR.........~~~~~........RRRR......,,,#',
    '#C,,......RRRR........~~~~~~~.......RRRR......,,,#',
    '#,,,...................~~~~~..................,,,#',
    '#,,,....w.........RRRR......RRRR.........w....,,,#',
    '#,,,..............RRRR......RRRR..............,,C#',
    '#,,,......RRR.....RRRR......RRRR.....RRR......,,,#',
    '####......RRR.....RRRR......RRRR.....RRR......####',
    '####.T....RRR.....RRRR......RRRR.....RRR....T.####',
    '####......RRR..k..................k..RRR......####',
    '####..P...RRR........................RRR...P..####',
    '####..........................................####',
    '####################..........####################',
    '####################..........####################',
    '####################....>.....####################',
    '##################################################',
    '##################################################',
  ],
};

export const OVERGROWN_TEMPLE_3: TdMapDef = {
  id: 'overgrown-temple-3', name: 'The Overgrown Temple · Floor 3 · The Heart Shrine', outside: 'vinewall', dark: true,
  legend: { ...BASE,
    '<': { ground: 'flagstone', object: 'up', station: T3_UP, exit: { to: 'overgrown-temple-2', arrive: 'temple2-down' } },
    '>': { ground: 'flagstone', object: 'down', station: T3_DOWN, exit: { to: 'overgrown-temple-4', arrive: 'temple4-up' } },
    'X': { ground: 'flagstone', mob: 'mossbound-colossus' },
  },
  rows: [
    '##############################################',
    '###################........###################',
    '###################...<....###################',
    '###################........###################',
    '###################........###################',
    '###################........###################',
    '####################......####################',
    '####################......####################',
    '####################......####################',
    '###############................###############',
    '############......................############',
    '#########...T....................T...#########',
    '########..............................########',
    '######............~~~....~~~............######',
    '#####.w........~~~~~~....~~~~~~..........#####',
    '####..........~~~~~~~~~~~~~~~~~~..........####',
    '####........~~~~~~..........~~~~~~........####',
    '###.........~~~~P............P~~~~.........###',
    '###........~~~~................~~~~........###',
    '###..T.....~~~~.......X........~~~~.....T..###',
    '###........~~~~................~~~~........###',
    '###.........~~~~P............P~~~~.........###',
    '####........~~~~~~..........~~~~~~........####',
    '####..........~~~~~~~....~~~~~~~..........####',
    '#####..........~~~~~~....~~~~~~........w.#####',
    '######............~~~....~~~............######',
    '########..............................########',
    '#########...T....................T...#########',
    '############......B...............############',
    '###############.....C....C.....###############',
    '#####################....#####################',
    '#####################....#####################',
    '##################..........##################',
    '##################....>.....##################',
    '##################..........##################',
    '##############################################',
  ],
};

export const OVERGROWN_TEMPLE_4: TdMapDef = {
  id: 'overgrown-temple-4', name: 'The Overgrown Temple · Floor 4 · The Drowned Vault', outside: 'vinewall', dark: true,
  legend: { ...BASE,
    '<': { ground: 'flagstone', object: 'up', station: T4_UP, exit: { to: 'overgrown-temple-3', arrive: 'temple3-down' } },
    '>': { ground: 'flagstone', object: 'down', station: T4_DOWN, exit: { to: 'overgrown-temple-5', arrive: 'temple5-up' } },
  },
  rows: [
    '##################################################',
    '#####################........#####################',
    '#####################...<....#####################',
    '#####################........#####################',
    '#####################T......T#####################',
    '#######################....#######################',
    '#######################....#######################',
    '#######################....#######################',
    '###............................................###',
    '###...P.......P.......P....P.......P.......P...###',
    '###.....b..........................b...........###',
    '###~~~~~~~~~..~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~~###',
    '###~~~~~~~~~..~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~~###',
    '###...w....................................w...###',
    '#,C,,...T................................T...,,B,#',
    '#,,,,.............~~~~~~~~~~~~~~.............,,,,#',
    '#,,,,...z.........~~~~......~~~~.........z...,,,,#',
    '#,,,,.............~~~~..C...~~~~.............,,,,#',
    '#,,,,.............~~~~......~~~~.............,,,,#',
    '#,,,,.............~~~~~~..~~~~~~.............,,,,#',
    '#,,,,......b............................v....,,,,#',
    '#,B,,...T................................T...,,C,#',
    '###............................................###',
    '###~~~~~~~~~..~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~~###',
    '###~~~~~~~~~..~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~~###',
    '###.....v.............................z........###',
    '###...P.......P.......P....P.......P.......P...###',
    '###............................................###',
    '######################......######################',
    '####################..........####################',
    '####################....>.....####################',
    '####################..........####################',
    '##################################################',
    '##################################################',
  ],
};

export const OVERGROWN_TEMPLE_5: TdMapDef = {
  id: 'overgrown-temple-5', name: 'The Overgrown Temple · Floor 5 · The Rootcradle', outside: 'vinewall', dark: true,
  legend: { ...BASE,
    '<': { ground: 'flagstone', object: 'up', station: T5_UP, exit: { to: 'overgrown-temple-4', arrive: 'temple4-down' } },
    ',': { ground: 'moss' }, 'Z': { ground: 'moss', mob: 'elder-rootwyrm' },
  },
  rows: [
    '##############################################',
    '###################........###################',
    '###################...<....###################',
    '###################........###################',
    '###################T......T###################',
    '####################......####################',
    '####################......####################',
    '####################......####################',
    '####################......####################',
    '####################......####################',
    '####################......####################',
    '##############..................##############',
    '##########..........................##########',
    '#######.....z....................z.....#######',
    '#####...T............................T...#####',
    '####......RRR....................RRR......####',
    '###........................................###',
    '##....RR..............................RR....##',
    '##...RRR......,,,,,,,,,,,,,,,,,,......RRR...##',
    '#....RR.......,,,,,,,,,,,,,,,,,,.......RR....#',
    '#.............,,,,,,,,,,,,,,,,,,.............#',
    '#..T.........RRR,,,,,,,,,,,,,,RRR.........T..#',
    '#............,,,,,,,,,,,,,,,,,,,,............#',
    '#............,,,,,,,,,Z,,,,,,,,,,............#',
    '#............,,,,,,,,,,,,,,,,,,,,............#',
    '#..T.........RRR,,,,,,,,,,,,,,RRR.........T..#',
    '#.............,,,,,,,,,,,,,,,,,,.............#',
    '#....RR.......,,,,,,,,,,,,,,,,,,.......RR....#',
    '##...RRR......,,,,,,,,,,,,,,,,,,......RRR...##',
    '##....RR..............................RR....##',
    '###........................................###',
    '#####...B............................B...#####',
    '#######....C......................C....#######',
    '##########..........................##########',
    '##############################################',
    '##############################################',
  ],
};
