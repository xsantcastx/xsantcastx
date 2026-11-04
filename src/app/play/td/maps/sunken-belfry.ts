/**
 * sunken-belfry.ts — the Sunken Belfry, the Umbral Marches' first connector (S11 part 2; docs/design/world-acts.md §1.4;
 * canon §8.4, campaign #3 and #12). The drowned abbey's bell-tower, lying on its side under the water: the pilgrims'
 * boardwalk broke where it fell, so its upper half is **the only way past the broken boardwalk** into the Black Meres.
 * One floor, levels 30–32, walked along what was its wall.
 *
 * In by the bell-chamber end (the louvres are the floor now, black water in the slots between them), down the shaft
 * where the stair runs along the wall and the bell-ropes hang sideways, out by the tower's foot onto the Meres. Off the
 * shaft, a door with a bell-shaped keyhole: **the fifth bell's chamber, sealed** (campaign #12, "Who Rings Under the
 * Water"); under the water past it, one slow note every forty seconds (td-sections MARCHES_BIBLE). Under the chamber,
 * a narrow way down to a nook where a ringer's glove still hangs on its hook (the hidden thing: "Pull on four. Never on
 * five.").
 *
 * Lair: Lantern Wisps that came in with the water; Drowned Acolytes still ringing a bell that isn't there. Mood:
 * green-black water light; torches only at the two ends (the light rule).
 *
 * Legend: # the tower's drowned wall · . wet stone · ~ black water · = a louvre slat · T torch (the ends only) · S the
 * stair's newel · R a bell-rope hanging sideways · B bones · I the ringers' rota · G the ringer's glove on its hook ·
 * D the fifth bell's door (W its frame) · ^ the broken end, up to the Pilgrims' Boardwalk · v the tower's foot, up to the Black Meres ·
 * w a Lantern Wisp (the Drowned Acolytes are the floor's lair: td-levels FLOOR_LAIRS).
 */
import type { StationDef } from '../../world/world.model';
import type { TdMapDef } from '../td-level';

/** The way in, at the Pilgrims' Boardwalk's broken end (td-world stamps the belfry's roof there). */
export const BELFRY_IN: StationDef = { id: 'sunken-belfry', x: 0, label: 'THE SUNKEN BELFRY', kind: 'passage', blurb: "The abbey's bell-tower, on its side under the water. The only way past the broken boardwalk." };
/** The way back in from the Black Meres: the tower's foot, its roof out of the water. */
export const BELFRY_FAR_IN: StationDef = { id: 'belfry-roof', x: 0, label: "THE BELFRY'S ROOF", kind: 'passage', blurb: 'Down into the drowned bell-tower, back toward the Pilgrims\' Boardwalk.' };
const BELFRY_UP: StationDef = { id: 'belfry-up', x: 0, label: 'THE BROKEN END', kind: 'passage', blurb: "Up through the louvres onto the Pilgrims' Boardwalk." };
const BELFRY_OUT: StationDef = { id: 'belfry-out', x: 0, label: "THE TOWER'S FOOT", kind: 'passage', blurb: 'Up and out onto the Black Meres.' };
// The zone bible's check (td-sections MARCHES_BIBLE): the rota to read, the fifth bell's door sealed; the glove hidden.
const ROTA: StationDef = { id: 'read:belfry-rota', x: 0, label: "THE RINGERS' ROTA", kind: 'resource', blurb: 'Names and bells, chalked on a board.' };
const FIFTH: StationDef = { id: 'sealed:belfry-fifth-door', x: 0, label: "THE FIFTH BELL'S DOOR", kind: 'resource', blurb: 'A keyhole the shape of a bell.' };
const GLOVE: StationDef = { id: 'read:belfry-glove', x: 0, label: "A RINGER'S GLOVE", kind: 'resource', blurb: 'Hung on its hook, as if its owner meant to come back.' };

export const SUNKEN_BELFRY_1: TdMapDef = {
  id: 'sunken-belfry-1', name: 'The Sunken Belfry', outside: 'drownwall', dark: true, fog: .3,
  legend: {
    // W: the fifth bell's door-frame, solid stone round it (td-level widen never opens it, as it opens plain rock).
    '#': { ground: 'drownwall' }, 'W': { ground: 'drownwall' }, '.': { ground: 'wetstone' }, '~': { ground: 'blackwater' }, '=': { ground: 'plank' },
    'T': { ground: 'wetstone', object: 'torch' }, 'S': { ground: 'wetstone', object: 'pillar' }, 'R': { ground: 'wetstone', object: 'chains' },
    'B': { ground: 'wetstone', object: 'bones' },
    'I': { ground: 'wetstone', object: 'inscription', station: ROTA },
    'G': { ground: 'wetstone', object: 'chains', station: GLOVE },
    'D': { ground: 'wetstone', door: 'fifth-bell', station: FIFTH },
    '^': { ground: 'wetstone', object: 'up', station: BELFRY_UP, exit: { to: 'surface', arrive: 'sunken-belfry', continent: 'umbral-marches-boardwalk' } },
    'v': { ground: 'wetstone', object: 'up', station: BELFRY_OUT, exit: { to: 'surface', arrive: 'belfry-roof', continent: 'umbral-marches-meres' } },
    'w': { ground: 'wetstone', mob: 'lantern-wisp' },
  },
  rows: [
    '######################################################################',
    '######################################################################',
    '###....................###############################################',
    '###.......T.^.T........###############################################',
    '###..~..~..~..~..~..~..###############################################',
    '###..~..~..~..~..~..~..###############################################',
    '###..~..~..~..~..~..~..###############################################',
    '###..~..~..~..~..~..~..###############################################',
    '###.=..=..=..=..=..=...###############################################',
    '###.=..=..=..=..=..=...###############################################',
    '###..~..~..~..~..~..~..###############################################',
    '###..~..~..~..~..~.....###############################################',
    '###..~..~..~..~..~.....###############################################',
    '###..~..~..~..~..~.....###############################################',
    '###....................###############################################',
    '###....................###############################################',
    '######..##########......I......#######################################',
    '######..############...............................................###',
    '######..############...............................................###',
    '######..############....S...S...S...S...S...S...S...S...S...S......###',
    '######..############....................w..........................###',
    '######..############..........................w....................###',
    '######..############............~~~~~~.............................###',
    '######..############............~~~~~~..........~~~~~~~............###',
    '######..############............~~~~~~..........~~~~~~~............###',
    '######..############............~~~~~~..........~~~~~~~............###',
    '######..############............................~~~~~~~............###',
    '######..############......R.....R.....R.....R.....R.....R.....R....###',
    '######..############................................w..............###',
    '######..############...............................................###',
    '######..############...............................................###',
    '######..################################WWDWW#########.............###',
    '######..############################~~~~.....~~~~#####.............###',
    '######..############################~~~~.....~~~~#####.............###',
    '######..############################~~~~~~~~~~~~~#####.............###',
    '######..############################~~~~~~~~~~~~~#####.............###',
    '######..############################~~~~~~~~~~~~~#####.............###',
    '######..############################~~~~~~~~~~~~~#####...~~~~......###',
    '###...........######################~~~~~~~~~~~~~#####...~~~~......###',
    '###...........######################~~~~~~~~~~~~~#####...~~~~......###',
    '###...........######################~~~~~~~~~~~~~#####...~~~~......###',
    '###.......w...########################################.............###',
    '###...........########################################.............###',
    '###...........########################################.............###',
    '###.......B...########################################.............###',
    '###...........########################################......T.v.T..###',
    '###.G.........########################################.............###',
    '######################################################################',
    '######################################################################',
    '######################################################################',
  ],
};
