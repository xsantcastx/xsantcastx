/**
 * hushed-barrow.ts — the Hushed Barrow's vault, under the old burial plot on Ember Isle's west (the Sexton's Count,
 * shared/sexton; design-bible §9.3). One floor: the barrow steps go down from under the plot's door into a hall of
 * bones where two of the barrow's dead still keep watch; at its far end Barrow Door 1, iron-banded and locked; past
 * it the vault itself — eight graves in two rows, two lanterns somebody keeps lit, and between them the forty-first,
 * with no name, only a tally mark. The Uncounted stands over it.
 *
 * The door is a Tibia door: shut, its tiles are rock to everyone; the Keeper holding Barrow Key 1 opens it at the
 * keyhole (td-engine, the host's chain says whether the key is held). Nothing waits within eight tiles of the stair.
 *
 * Legend: # rock · . floor · = flagstones · T torch · B bones · G a grave · L a lantern · ^ the way out ·
 * | Barrow Door 1 · k its keyhole · N the forty-first grave · s a Bone Walker · X the Uncounted.
 */
import type { StationDef } from '../../world/world.model';
import type { TdMapDef } from '../td-level';

/** The way in, on the island: the barrow's door, cut under the old plot's standing stone (td-world stamps it there). */
export const BARROW_IN: StationDef = { id: 'hushed-barrow', x: 0, label: 'THE HUSHED BARROW', kind: 'passage', blurb: 'Steps down under the old burial plot. The sexton keeps the key ring.' };
const BARROW_OUT: StationDef = { id: 'barrow-up', x: 0, label: 'BARROW STEPS', kind: 'passage', blurb: 'Back up to the burial plot.' };
/** Barrow Door 1's keyhole: the engine opens it when Barrow Key 1 is held (td-engine `use`). */
export const BARROW_DOOR: StationDef = { id: 'sexton:door', x: 0, label: 'BARROW DOOR 1', kind: 'resource', blurb: 'Old iron. A keyhole stamped with a 1.' };
/** The forty-first grave: no name, only a tally mark (the Sexton's Count). */
export const GRAVE_41: StationDef = { id: 'sexton:grave', x: 0, label: 'THE FORTY-FIRST GRAVE', kind: 'resource', blurb: 'No name. Only a tally mark.' };
/** The door's id on the map and in the chain's save (shared/sexton). */
export const BARROW_DOOR_ID = 'barrow-1';

export const HUSHED_BARROW_1: TdMapDef = {
  id: 'hushed-barrow-1', name: 'The Hushed Barrow · The Vault', outside: 'rock', dark: true,
  legend: {
    '#': { ground: 'rock' }, '.': { ground: 'cave' }, '=': { ground: 'cobble' },
    'T': { ground: 'cave', object: 'torch' }, 'B': { ground: 'cave', object: 'bones' }, 'G': { ground: 'cave', object: 'grave' },
    'L': { ground: 'cave', object: 'lantern' },
    '^': { ground: 'cave', object: 'up', station: BARROW_OUT, exit: { to: 'surface', arrive: 'hushed-barrow' } },
    '|': { ground: 'cobble', door: BARROW_DOOR_ID },
    'k': { ground: 'cobble', station: BARROW_DOOR },
    'N': { ground: 'cave', object: 'grave', station: GRAVE_41 },
    's': { ground: 'cave', mob: 'bone-walker' }, 'X': { ground: 'cave', mob: 'the-uncounted' },
  },
  rows: [
    '##############################',
    '#############..^..############',
    '############.......###########',
    '############.T...T.###########',
    '#############.....############',
    '##############...#############',
    '##########.....=.....#########',
    '#########..B...=......########',
    '#########......=...s..########',
    '########...s...=....B.########',
    '#########......=......########',
    '##########T....=....T#########',
    '#############..k..############',
    '##############|||#############',
    '#############.....############',
    '###########.........##########',
    '##########..G..G..G..#########',
    '#########.............########',
    '#########.L....X....L.########',
    '#########.............########',
    '##########..G..N..G..#########',
    '###########.........##########',
    '##############################',
  ],
};
