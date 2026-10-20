/**
 * ashen-crypt.ts — the Ashen Crypt, under the Ashen Bastion's ruins at the Deep Charwood's west edge of Infernal Reach
 * (docs/design/world-map.md; owner 2026-10-20: "lots of scary monsters like skeletons, dragons … undead stuff").
 *
 * The Bastion's garrison was buried in the cinder under its walls, and never stopped marching. Floor 1, the Ossuary:
 * a flagstone processional down into a hall of bone niches and side chapels, where Bone Walkers keep their watch, Bone
 * Archers loose from the far end, Ash Ghouls feed and Cinder Wraiths drift. Floor 2, the Bone Hall: the Bastion's last
 * lord, the Ashbone Dragon, curled round slag pools under the old throne. Drawn wide on purpose, and nothing waits
 * within eight tiles of a stair (docs/design/world-map.md's rule for every dungeon).
 *
 * Legend: # rock · . floor · = flagstones · e slag (lava) · T torch · B bones · C chest · ^ the way out · < stairs up ·
 * > stairs down · s a Bone Walker · a a Bone Archer · g an Ash Ghoul · w a Cinder Wraith · X the Ashbone Dragon.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

/** The way in, at the Ashen Bastion (td-world stamps the crypt door there). */
export const CRYPT_IN: StationDef = { id: 'ashen-crypt', x: 0, label: 'THE ASHEN CRYPT', kind: 'passage', blurb: 'Steps down under the Ashen Bastion, where its dead garrison still marches. Dangerous below level 10.' };
const CRYPT_OUT: StationDef = { id: 'crypt-out', x: 0, label: 'CRYPT DOOR', kind: 'passage', blurb: 'Back up to the Ashen Bastion.' };
const C1_DOWN: StationDef = { id: 'crypt1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Bone Hall (floor 2). Something large breathes down there.' };
const C2_UP: StationDef = { id: 'crypt2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Ossuary (floor 1).' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'rock' }, '.': { ground: 'cave' }, '=': { ground: 'cobble' }, 'e': { ground: 'ember' },
  'T': { ground: 'cave', object: 'torch' }, 'B': { ground: 'cave', object: 'bones' }, 'C': { ground: 'cave', object: 'chest' },
  's': { ground: 'cave', mob: 'bone-walker' }, 'a': { ground: 'cave', mob: 'bone-archer' },
  'g': { ground: 'cave', mob: 'ash-ghoul' }, 'w': { ground: 'cave', mob: 'cinder-wraith' },
};

export const ASHEN_CRYPT_1: TdMapDef = {
  id: 'ashen-crypt-1', name: 'The Ashen Crypt · Floor 1 · The Ossuary', outside: 'rock', dark: true,
  legend: { ...BASE,
    '^': { ground: 'cave', object: 'up', station: CRYPT_OUT, exit: { to: 'surface', arrive: 'ashen-crypt' } },
    '>': { ground: 'cave', object: 'down', station: C1_DOWN, exit: { to: 'ashen-crypt-2', arrive: 'crypt2-up' } },
  },
  rows: [
    '##############################################',
    '####################..^..#####################',
    '##################.........###################',
    '##################.T.....T.###################',
    '##################....=....###################',
    '###################...=...####################',
    '####################..=..#####################',
    '####################..=..#####################',
    '#########...........B=B...........############',
    '########...B....T....=....T....B...###########',
    '########.............=..............##########',
    '#######..s....####...=...####...a....#########',
    '#######......######..=..######.......#########',
    '########....#######..=..#######..B...#########',
    '########....#######..=..#######......#########',
    '#######..g..#######..=..#######..w...#########',
    '#######......#####...=...#####.......#########',
    '#######..........T...=...T.......a...#########',
    '########.....s.......=.......g.......#########',
    '#########...........===.............##########',
    '###########.C..#####...#####....B..###########',
    '############...#####...#####......############',
    '####################...#######################',
    '###################.....######################',
    '##################..T.T..#####################',
    '##################...>...#####################',
    '###################.....######################',
    '##############################################',
  ],
};

export const ASHEN_CRYPT_2: TdMapDef = {
  id: 'ashen-crypt-2', name: 'The Ashen Crypt · Floor 2 · The Bone Hall', outside: 'rock', dark: true,
  legend: { ...BASE,
    '<': { ground: 'cave', object: 'up', station: C2_UP, exit: { to: 'ashen-crypt-1', arrive: 'crypt1-down' } },
    'X': { ground: 'cave', mob: 'bone-dragon' },
  },
  rows: [
    '##############################################',
    '#####################..<..####################',
    '###################.........##################',
    '###################..T...T..##################',
    '###################.........##################',
    '####################.......###################',
    '#####################.....####################',
    '#####################..=..####################',
    '###################....=....##################',
    '##########.............=.............#########',
    '########....T.....B....=....B.....T....#######',
    '#######................=................######',
    '######....B.....eee....=....eee.....B....#####',
    '######.........eeeee...=...eeeee.........#####',
    '######..w.......eee....=....eee.......w..#####',
    '######.................=.................#####',
    '######...T.............X...............T.#####',
    '######...................................#####',
    '######..........eee.........eee..........#####',
    '######..s......eeeee.......eeeee......s..#####',
    '######..........eee.........eee..........#####',
    '#######...B..........B.C.B..........B...######',
    '########....T.....................T....#######',
    '##########...........................#########',
    '##############################################',
  ],
};
