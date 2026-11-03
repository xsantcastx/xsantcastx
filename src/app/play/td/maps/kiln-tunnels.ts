/**
 * kiln-tunnels.ts — the Kiln Tunnels, the Infernal Reach's first connector (docs/design/world-acts.md §1.2; canon §8.5):
 * the charcoal burners' haul-ways, cut so the carts could reach Pyrehold under the orc raids. The clans found them and
 * the burners bricked their end. It is **the only way into the Deep Charwood**: in by the kiln-mouth in the Charwood,
 * out by the far mouth among the clans' trees. One floor, levels 12–14.
 *
 * Lair: Cinder Imps in the cold kilns, Ash Ghouls (burners who never came up). Mood: soot-black, one cold kiln-glow per
 * chamber. Dressing: cart rails, sacks gone to dust, a cart tally on a post that stops mid-week (the thing to read), the
 * bricked arch "BURNERS ONLY" (the sealed thing), with a chest behind it that is reached from the far side once you have
 * walked round (the hidden thing). Sound: a cart rolling somewhere with nobody pushing it (td-sections REACH_BIBLE).
 *
 * Legend: # rock · . floor · = cart rails · T torch (at the mouths only) · K a cold kiln still glowing · k a kiln gone
 * out · c a cart · x sacks · B bones · C the chest behind the arch · P the arch's piers · D the bricked arch ·
 * I the cart tally · ^ the kiln-mouth up to the Charwood · v the far mouth up to the Deep Charwood ·
 * i a Cinder Imp · g an Ash Ghoul.
 */
import type { StationDef } from '../../world/world.model';
import type { TdMapDef } from '../td-level';

/** The way in, at the Charwood's kiln-mouth (td-world places it at the cave). */
export const KILN_IN: StationDef = { id: 'kiln-tunnels', x: 0, label: 'THE KILN TUNNELS', kind: 'passage', blurb: "The charcoal burners' haul-ways, under the Charwood. The only way into the Deep Charwood." };
/** The way back in from the far end, among the Deep Charwood's trees. */
export const KILN_FAR_IN: StationDef = { id: 'kiln-far-mouth', x: 0, label: 'THE KILN TUNNELS', kind: 'passage', blurb: 'Back down the haul-ways, to the Charwood.' };
const KILN_UP: StationDef = { id: 'kiln-up', x: 0, label: 'KILN-MOUTH', kind: 'passage', blurb: 'Up and out to the Charwood.' };
const KILN_FAR: StationDef = { id: 'kiln-far', x: 0, label: 'FAR MOUTH', kind: 'passage', blurb: 'Up and out to the Deep Charwood.' };
const TALLY: StationDef = { id: 'read:kiln-tally', x: 0, label: 'A CART TALLY', kind: 'resource', blurb: 'Chalk marks on a post, one for every cart.' };
const ARCH: StationDef = { id: 'sealed:kiln-arch', x: 0, label: 'A BRICKED ARCH', kind: 'resource', blurb: '"BURNERS ONLY", in chalk.' };

export const KILN_TUNNELS_1: TdMapDef = {
  id: 'kiln-tunnels-1', name: 'The Kiln Tunnels', outside: 'rock', dark: true,
  legend: {
    '#': { ground: 'rock' }, '.': { ground: 'cave' }, '=': { ground: 'plank' }, 'T': { ground: 'cave', object: 'torch' },
    'K': { ground: 'cave', object: 'brazier-lit' }, 'k': { ground: 'cave', object: 'brazier' }, 'c': { ground: 'plank', object: 'cart' },
    'x': { ground: 'cave', object: 'crate' }, 'B': { ground: 'cave', object: 'bones' }, 'C': { ground: 'cave', object: 'chest' },
    'P': { ground: 'cave', object: 'pillar' }, 'D': { ground: 'cave', door: 'kiln-arch', station: ARCH },
    'I': { ground: 'rock', object: 'inscription', station: TALLY },
    '^': { ground: 'cave', object: 'up', station: KILN_UP, exit: { to: 'surface', arrive: 'kiln-tunnels', continent: 'infernal-reach-charwood' } },
    'v': { ground: 'cave', object: 'up', station: KILN_FAR, exit: { to: 'surface', arrive: 'kiln-far-mouth', continent: 'infernal-reach-deep-charwood' } },
    'i': { ground: 'cave', mob: 'cinder-imp' }, 'g': { ground: 'cave', mob: 'ash-ghoul' },
  },
  rows: [
    '########################################################################',
    '#####.....^.......######################################################',
    '#####.............##########..............##############################',
    '#####...T...T.....##########..x...K.......##############################',
    '#####.............##########..........i...##############################',
    '#####............===========..............##############################',
    '#####............===========.============.##############################',
    '#####............===========..............##############################',
    '#####.............##########.....i........##############################',
    '#####.............##########..c........x..##############################',
    '############################............x.##############################',
    '############################.....===......##############################',
    '#################################===####################################',
    '#################################===####################################',
    '#################################===################...............#####',
    '#################################===################......K........#####',
    '######I##########################===################...x...........#####',
    '###.............#################===################...............#####',
    '###.............#########...........=...........####..........i....#####',
    '###.............#########...........=........c..####...............#####',
    '###.............#########....g......=...........####....i..........#####',
    '###.............==========..........=..........=====...............#####',
    '###.....g.......====================================...............#####',
    '###.............==========..........=..........=====...............#####',
    '###......B......#########...........=...........####............i..#####',
    '###.........g...#########..c........=.......i...####...............#####',
    '###.............#########...........=...........####...g......k....#####',
    '###.........k...#########...........=...........####...............#####',
    '###.............####################################......===......#####',
    '###..g.......K..##########################################===###########',
    '###.............##########################################===###########',
    '########PDP###############################################===###########',
    '########...###############################################===###########',
    '###..................#####################################===###########',
    '###......C...........#####################################===###########',
    '###.............g.B..#####################################===###########',
    '###..................#####################################===###########',
    '###..................=============i==========================###########',
    '###..................=========c=========K=======g============###########',
    '###.T................========================================###########',
    '###..................###################################################',
    '###...v..T...........###################################################',
    '###..................###################################################',
    '########################################################################',
  ],
};
