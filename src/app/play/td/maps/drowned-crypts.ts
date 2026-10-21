/**
 * drowned-crypts.ts — the Drowned Crypts, under the drowned ruins of the Umbral Marches (docs/design/world-map.md:
 * −1…−6; these are −1…−3). When the abbey went under the fen, its crypts went with it: the water came in through the
 * floors, the abbey's old guard marched down to hold them, and the abbess stayed at her prayers. Drawn by hand, wide on
 * purpose, nothing within eight tiles of a stair; mist lies on every floor.
 *
 * Floor 1, the Flooded Nave: a stair down from the door into a pillared nave, two black pools across it, side chapels
 * gone to silt; Mire Lurkers wallow by the pools, Lantern Wisps drift over them, Drowned Knights keep the chapels.
 * Floor 2, the Sunken Cloister: a cloister walk round a flooded garth with an island in it, cells off both sides; Ink
 * Hounds run the walk, Gloam Witches keep the cells.
 * Floor 3, the Abbess's Chapel: a round chapel, a ring of black water round the island where the altar was, two
 * causeways onto it, and the Ink Abbess at her prayers; her great attack is a wave of ink from her censer, shown on the
 * floor first, and at half her life two Ink Hounds come up out of the water.
 *
 * Legend: # drowned wall · . wet flagstones · , silt · ~ black water · P a pillar · L a lantern · B bones · C chest ·
 * ^ the way out · < stairs up · > stairs down · m a Mire Lurker · w a Lantern Wisp · h an Ink Hound · k a Drowned
 * Knight · g a Gloam Witch · X the Ink Abbess.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

/** The way in, in the Drowned Ruins (td-world stamps the crypt door there). */
export const CRYPTS_IN: StationDef = { id: 'drowned-crypts', x: 0, label: 'THE DROWNED CRYPTS', kind: 'passage', blurb: 'The abbey\'s crypts, under the fen. Dangerous below level 41.' };
const CRYPTS_OUT: StationDef = { id: 'crypts-out', x: 0, label: 'CRYPT DOOR', kind: 'passage', blurb: 'Back up to the Drowned Ruins.' };
const D1_DOWN: StationDef = { id: 'crypts1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Sunken Cloister (floor 2).' };
const D2_UP: StationDef = { id: 'crypts2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Flooded Nave (floor 1).' };
const D2_DOWN: StationDef = { id: 'crypts2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Abbess\'s Chapel (floor 3). Someone is still praying down there.' };
const D3_UP: StationDef = { id: 'crypts3-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Sunken Cloister (floor 2).' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'drownwall' }, '.': { ground: 'wetstone' }, ',': { ground: 'mire' }, '~': { ground: 'blackwater' },
  'P': { ground: 'wetstone', object: 'pillar' }, 'L': { ground: 'wetstone', object: 'lantern' }, 'B': { ground: 'mire', object: 'bones' },
  'C': { ground: 'mire', object: 'chest' },
  'm': { ground: 'wetstone', mob: 'mire-lurker' }, 'w': { ground: 'wetstone', mob: 'lantern-wisp' }, 'h': { ground: 'wetstone', mob: 'ink-hound' },
  'k': { ground: 'mire', mob: 'drowned-knight' }, 'g': { ground: 'wetstone', mob: 'gloam-witch' },
};

export const DROWNED_CRYPTS_1: TdMapDef = {
  id: 'drowned-crypts-1', name: 'The Drowned Crypts · Floor 1 · The Flooded Nave', outside: 'drownwall', dark: true, fog: .35,
  legend: { ...BASE,
    '^': { ground: 'wetstone', object: 'up', station: CRYPTS_OUT, exit: { to: 'surface', arrive: 'drowned-crypts' } },
    '>': { ground: 'wetstone', object: 'down', station: D1_DOWN, exit: { to: 'drowned-crypts-2', arrive: 'crypts2-up' } },
  },
  rows: [
    '################################################',
    '###################....^.....###################',
    '###################..........###################',
    '###################.L......L.###################',
    '###################..........###################',
    '###################..........###################',
    '###################..........###################',
    '###################..........###################',
    '#####################......#####################',
    '#####################......#####################',
    '#####################......#####################',
    '######...................................#######',
    '######...P.....P.....P....P.....P.....P..#######',
    '#,,,,,..L.....~~~~~~........~~~~~~.....L.,,,,,,#',
    '#,C,,,......~~~~~~~~~......~~~~~~~~~.....,,B,,,#',
    '#,,,,,.....~~~~~~~~~~~..w..~~~~~~~~~~~...,,,,,,#',
    '#,,m,,....m~~~~~~~~~~~.....~~~~~~~~~~~m..,,,k,,#',
    '#,,,,,.....~~~~~~~~~~~.w...~~~~~~~~~~~...,,,,,,#',
    '#,,B,,......~~~~~~~~~......~~~~~~~~~.....,,,,C,#',
    '#,,,,,..L.....~~~~~~........~~~~~~.....L.,,,,,,#',
    '######...P.....P.....P....P.....P.....P..#######',
    '######...................................#######',
    '##########,,,,,,,##############,,,,,,,##########',
    '##########,,k,,,,##############,,,,w,,##########',
    '##########,,,,,,,..............,,,,,,,##########',
    '##########,,,,,,,..............,,,,,,,##########',
    '#################.......>......#################',
    '################################################',
  ],
};

export const DROWNED_CRYPTS_2: TdMapDef = {
  id: 'drowned-crypts-2', name: 'The Drowned Crypts · Floor 2 · The Sunken Cloister', outside: 'drownwall', dark: true, fog: .4,
  legend: { ...BASE,
    '<': { ground: 'wetstone', object: 'up', station: D2_UP, exit: { to: 'drowned-crypts-1', arrive: 'crypts1-down' } },
    '>': { ground: 'wetstone', object: 'down', station: D2_DOWN, exit: { to: 'drowned-crypts-3', arrive: 'crypts3-up' } },
    'k': { ground: 'wetstone', mob: 'drowned-knight' },
  },
  rows: [
    '##################################################',
    '#########......###################################',
    '#########..<...###################################',
    '#########......###################################',
    '#########.L..L.###################################',
    '#########......###################################',
    '#########......###################################',
    '#########......###################################',
    '####......................................########',
    '####..P......P......P......P......P.......########',
    '####..........................................####',
    '####..P..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...P...####',
    '#,,,.....~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.....,,,,,#',
    '#,C,..h..~~~~~~,,,,,,,,,,,,,,,,,,~~~~~~..g..,,B,,#',
    '#,,,.....~~~~~~,,,,,,,,,,,,,,,,,,~~~~~~.....,,,,,#',
    '####..P..~~~~~~,,,,,,,,L,,,,,,,,,~~~~~~...P...####',
    '####.....~~~~~~,,,,,,,,,,,,,,,,,,~~~~~~.......####',
    '####.....~~~~~~,,,,,,,,,,,,,,,,,,~~~~~~.......####',
    '####..P..~~~~~~,,,,,,,,,,,,,L,,,,~~~~~~...P...####',
    '#,,,.....~~~~~~,,,,,,,,,,,,,,,,,,~~~~~~.....,,,,,#',
    '#,B,..k..~~~~~~,,,,,,,,,,,,,,,,,,~~~~~~..h..,,C,,#',
    '#,,,.....~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.....,,,,,#',
    '####..P..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...P...####',
    '####..........................................####',
    '####..P......P......P......P......P......P....####',
    '####......................................########',
    '##################################.......#########',
    '##################################.......#########',
    '##################################.L...L.#########',
    '##################################.......#########',
    '##################################...>...#########',
    '##################################################',
  ],
};

export const DROWNED_CRYPTS_3: TdMapDef = {
  id: 'drowned-crypts-3', name: 'The Drowned Crypts · Floor 3 · The Abbess\'s Chapel', outside: 'drownwall', dark: true, fog: .45,
  legend: { ...BASE,
    '<': { ground: 'wetstone', object: 'up', station: D3_UP, exit: { to: 'drowned-crypts-2', arrive: 'crypts2-down' } },
    'X': { ground: 'mire', mob: 'ink-abbess' }, 'k': { ground: 'wetstone', mob: 'drowned-knight' },
  },
  rows: [
    '##############################################',
    '###################........###################',
    '###################...<....###################',
    '###################........###################',
    '###################........###################',
    '###################.L....L.###################',
    '####################......####################',
    '####################......####################',
    '####################......####################',
    '#################............#################',
    '#############....................#############',
    '##########L........................L##########',
    '########..........~~~~~~~~~~..........########',
    '#######.........~~~~~~~~~~~~~~.........#######',
    '######..P.....~~~~~~~~~~~~~~~~~~.....P..######',
    '#####........~~~~~~~~,,,,~~~~~~~~........#####',
    '####........~~~~~~,,,,,,,,,,~~~~~~........####',
    '####.......~~~~~~,,,,,,,,,,,,~~~~~~.......####',
    '####..g.........,,,,,,,,,,,,,,............####',
    '###.............,,,,,,X,,,,,,,.............###',
    '####............,,,,,,,,,,,,,,.........k..####',
    '####.......~~~~~~,,,,,,,,,,,,~~~~~~.......####',
    '####........~~~~~~,,,,,,,,,,~~~~~~........####',
    '#####........~~~~~~~~,,,,~~~~~~~~........#####',
    '######..P.....~~~~~~~~~~~~~~~~~~.....P..######',
    '#######.........~~~~~~~~~~~~~~.........#######',
    '########..........~~~~~~~~~~..........########',
    '##########L........................L##########',
    '#############.....B..............#############',
    '#################...C....C...#################',
    '##############################################',
    '##############################################',
  ],
};
