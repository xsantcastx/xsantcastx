/**
 * ember-mine-1.ts — the Ember Mine, floor 1: the first hand-drawn dungeon (docs/design/top-down.md; owner 2026-10-19,
 * "dungeons and mysterious places … Tibia style", "lets make the maps").
 *
 * Under the Seamworks' mine shaft. The ladder comes down into a torch-lit hall; a timbered passage runs east to the
 * ore galleries; a flooded cave lies north; old bones mark where the last crew stopped. Monsters and the stairs down to
 * floor 2 come next — the map has room left for both (the dead end in the far south-east).
 *
 * Legend: # rock · . floor · O Cinder Ore seam · T torch · B bones · C chest · o boulder · ~ water · ^ ladder up ·
 * m a Rivet Maw · b a Cinder Bailiff · > stairs down to floor 2.
 */
import { INFERNAL_TOWN } from '../../world/towns/infernal';
import type { StationDef } from '../../world/world.model';
import type { TdMapDef } from '../td-level';

const ore = INFERNAL_TOWN.stations.find(s => s.id === 'ore')!;
/** The ladder home: a passage the top-down engine walks (the square's mine head is where it lands). */
export const MINE_LADDER: StationDef = { id: 'mine-up', x: 0, label: 'LADDER UP', kind: 'passage', blurb: 'Back up to the Seamworks.' };
export const MINE_1_DOWN: StationDef = { id: 'mine1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Flooded Galleries (floor 2).' };

export const EMBER_MINE_1: TdMapDef = {
  id: 'ember-mine-1',
  name: 'Ember Mine · Floor 1',
  outside: 'rock',
  dark: true,
  legend: {
    '#': { ground: 'rock' },
    '.': { ground: 'cave' },
    'O': { ground: 'cave', object: 'ore', station: ore },
    'T': { ground: 'cave', object: 'torch' },
    'B': { ground: 'cave', object: 'bones' },
    'C': { ground: 'cave', object: 'chest' },
    'o': { ground: 'cave', object: 'boulder' },
    '~': { ground: 'water' },
    '^': { ground: 'cave', object: 'ladder', station: MINE_LADDER, exit: { to: 'surface', arrive: 'delve' } },
    '>': { ground: 'cave', object: 'down', station: MINE_1_DOWN, exit: { to: 'ember-mine-2', arrive: 'mine2-up' } },
    'm': { ground: 'cave', mob: 'rivet-maw' },
    'b': { ground: 'cave', mob: 'cinder-bailiff' },
  },
  rows: [
    '############################################',
    '#####~~~~~######################O###########',
    '####~~~~~~~#####################..##########',
    '####~~~~~~..####################...#########',
    '#####~~~..m..##################.m.O#########',
    '#######.......#################....#########',
    '########...B...################...##########',
    '##########....#################..T##########',
    '###########..##################...##########',
    '###########..###########O......#..##########',
    '#########T....T#########....o...m...########',
    '#######...........######..........O.########',
    '#######....^......................T..#######',
    '#######...........########......o....#######',
    '#######T.........T#########...........######',
    '##########.....############O...C.b.O..######',
    '###########...##############.........#######',
    '###########...###############..B.....#######',
    '###########...######################...#####',
    '##########.....######################...####',
    '#########...o.m.######################..####',
    '#########.O...O.#######################..###',
    '##########..T..#########################..##',
    '###########...###########################b##',
    '############.############################.##',
    '#########################################.>#',
    '############################################',
  ],
};
