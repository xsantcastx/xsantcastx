/**
 * slagstone-cave.ts — Slagstone Cave, under the Slagstone mountain on Ember Isle (docs/design/world-map.md). One floor:
 * a winding cave where Rivet Maws nest round an old miners' camp, an ore vein along the back wall, and a chest at the
 * far end past the slag pools. The cave mouth on the island leads in; its own mouth leads out.
 *
 * Legend: # rock · . floor · e slag (lava) · O ore · T torch · B bones · C chest · o boulder · ^ the way out ·
 * m a Rivet Maw · i a Cinder Imp.
 */
import { INFERNAL_TOWN } from '../../world/towns/infernal';
import type { StationDef } from '../../world/world.model';
import type { TdMapDef } from '../td-level';

const ore = INFERNAL_TOWN.stations.find(s => s.id === 'ore')!;
export const CAVE_OUT: StationDef = { id: 'cave-out', x: 0, label: 'CAVE MOUTH', kind: 'passage', blurb: 'Back out to Slagstone Hills.' };
/** The way in, on the island (td-world places it at the cave mouth). */
export const CAVE_IN: StationDef = { id: 'slagstone-cave', x: 0, label: 'SLAGSTONE CAVE', kind: 'passage', blurb: 'A cave under the Slagstone mountain.' };

export const SLAGSTONE_CAVE: TdMapDef = {
  id: 'slagstone-cave', name: 'Slagstone Cave', outside: 'rock', dark: true,
  legend: {
    '#': { ground: 'rock' }, '.': { ground: 'cave' }, 'e': { ground: 'ember' },
    'O': { ground: 'cave', object: 'ore', station: ore }, 'T': { ground: 'cave', object: 'torch' }, 'B': { ground: 'cave', object: 'bones' },
    'C': { ground: 'cave', object: 'chest' }, 'o': { ground: 'cave', object: 'boulder' },
    '^': { ground: 'cave', object: 'up', station: CAVE_OUT, exit: { to: 'surface', arrive: 'slagstone-cave' } },
    'm': { ground: 'cave', mob: 'rivet-maw' }, 'i': { ground: 'cave', mob: 'cinder-imp' },
  },
  rows: [
    '##############################',
    '#############.^.##############',
    '############.....#############',
    '###########...T...############',
    '##########....m....###########',
    '#########...o....m..##########',
    '########..B......#...#########',
    '#######T.....##.......########',
    '######......####...T...#######',
    '#####..m...#####.........#####',
    '####O......#####..ee..m...####',
    '####.......######eeee......###',
    '####O..T...######.ee...o...###',
    '#####.......#####.....i....###',
    '######...m...###.......e...###',
    '#######..........T...eee..####',
    '########.....O.......e..C#####',
    '##############################',
  ],
};
