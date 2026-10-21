/**
 * root-hollows.ts — the Root Hollows, under the Deep Wilds west of Rootglass (docs/design/world-map.md: the Verdant
 * Wilds' second dungeon, levels 18–26). Where a giant tree died standing, its roots rotted out and left their shape in
 * the earth: tunnels the width of the roots that made them, chambers where they knotted. Something still chews them
 * wider, and something else grows in the dark they leave. Drawn by hand, every passage two tiles or more, nothing
 * within eight tiles of a stair or the way out.
 *
 * Floor 1, the Gnawed Galleries: a cross gallery under the mouth, two side tunnels chewed down by Rootgnaws, a mossy
 * chamber between them where the Sporecaps first take root.
 * Floor 2, the Sporewell: a round cavern round a dark well, Sporecaps at its edges, Rootgnaws in the far tunnels, a
 * Moss Stalker that followed the warmth down.
 * Floor 3, the Heartroot Cellar: the dead tree's heartroot, still faintly lit from inside, and what the tree kept.
 *
 * Legend: # packed earth and root · , earth · . moss · ~ still water · R a great root · L a rootglass lamp · B bones ·
 * C chest · ^ the way out · < stairs up · > stairs down · q a Rootgnaw · u a Sporecap · k a Moss Stalker.
 */
import type { StationDef } from '../../world/world.model';
import type { LegendEntry, TdMapDef } from '../td-level';

/** The way in, a root-hole in the Deep Wilds (td-world stamps a cave mouth there). */
export const HOLLOWS_IN: StationDef = { id: 'root-hollows', x: 0, label: 'THE ROOT HOLLOWS', kind: 'passage', blurb: 'Tunnels a dead giant tree left in the earth, west of Rootglass. Dangerous below level 19.' };
const HOLLOWS_OUT: StationDef = { id: 'hollows-out', x: 0, label: 'ROOT-HOLE', kind: 'passage', blurb: 'Back up into the Deep Wilds.' };
const H1_DOWN: StationDef = { id: 'hollows1-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Sporewell (floor 2).' };
const H2_UP: StationDef = { id: 'hollows2-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Gnawed Galleries (floor 1).' };
const H2_DOWN: StationDef = { id: 'hollows2-down', x: 0, label: 'STAIRS DOWN', kind: 'passage', blurb: 'Down to the Heartroot Cellar (floor 3).' };
const H3_UP: StationDef = { id: 'hollows3-up', x: 0, label: 'STAIRS UP', kind: 'passage', blurb: 'Up to the Sporewell (floor 2).' };

const BASE: Readonly<Record<string, LegendEntry>> = {
  '#': { ground: 'bark' }, ',': { ground: 'dirt' }, '.': { ground: 'moss' }, '~': { ground: 'water' }, 'R': { ground: 'bark' },
  'L': { ground: 'moss', object: 'rootlamp' }, 'B': { ground: 'dirt', object: 'bones' }, 'C': { ground: 'dirt', object: 'chest' },
  'q': { ground: 'dirt', mob: 'rootgnaw' }, 'u': { ground: 'dirt', mob: 'sporecap' }, 'k': { ground: 'moss', mob: 'moss-stalker' },
};

export const ROOT_HOLLOWS_1: TdMapDef = {
  id: 'root-hollows-1', name: 'The Root Hollows · Floor 1 · The Gnawed Galleries', outside: 'bark', dark: true,
  legend: { ...BASE,
    '^': { ground: 'moss', object: 'up', station: HOLLOWS_OUT, exit: { to: 'surface', arrive: 'root-hollows' } },
    '>': { ground: 'dirt', object: 'down', station: H1_DOWN, exit: { to: 'root-hollows-2', arrive: 'hollows2-up' } },
  },
  rows: [
    '############################################',
    '##################........##################',
    '##################...^....##################',
    '##################........##################',
    '##################L......L##################',
    '###################......###################',
    '###################......###################',
    '######,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,######',
    '#####,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#####',
    '#####,,,,RRR,,,,,,,,,,,,,,,,,,,,RRR,,,,#####',
    '#####,,,,,,,####............####,,,,,,,#####',
    '#####,,,,,,,####............####,,,,,,,#####',
    '#####,,q,,,,####............####,,,,q,,#####',
    '#####,,,,,,,###..............###,,,,,,,#####',
    '#####,,,,,,,##....~~....~~....##,,,,,,,#####',
    '#####,,,,,,,##................##,,,,,,,#####',
    '####,,,,,,,,,u,,,,,,,,,,,,,,,,,,u,,,,,,,####',
    '####,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,####',
    '####,,,,RRR,,,,,,,,,,,,,,,,,,,,,,RRR,,,,####',
    '#######,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#######',
    '##########,,,,,,,,######,,,,,,,,,,##########',
    '##########,,,k,,,,######,,,,,,,,,,##########',
    '##########,,,,,,,,######,,,,,,,,,,##########',
    '##########,,C,,,,,######,,,,,,,,,,##########',
    '##########,,,,,,,,######,,,,>,,,,,##########',
    '##########,,,,,,,,######,,,,,,,,,,##########',
    '############################################',
    '############################################',
  ],
};

export const ROOT_HOLLOWS_2: TdMapDef = {
  id: 'root-hollows-2', name: 'The Root Hollows · Floor 2 · The Sporewell', outside: 'bark', dark: true,
  legend: { ...BASE,
    '<': { ground: 'dirt', object: 'up', station: H2_UP, exit: { to: 'root-hollows-1', arrive: 'hollows1-down' } },
    '>': { ground: 'dirt', object: 'down', station: H2_DOWN, exit: { to: 'root-hollows-3', arrive: 'hollows3-up' } },
  },
  rows: [
    '##############################################',
    '####,,,,,,,,##################################',
    '####,,,<,,,,##################################',
    '####,,,,,,,,##################################',
    '####L,,,,,,L##################################',
    '#####,,,,,,###################################',
    '#####,,,,,,###################################',
    '#####,,,,,,,,,,,,,,,,,,,,,,,,,,###############',
    '###,,,,,,,,,,,,.,..,..,..,..,..,,,,,,,,#######',
    '###,,,,,,,,,,..,..............k..,,,,,,,,,,###',
    '##,,,,,,,,,,.....~~~~~~~~~~~~...,,,,,,,,,,,,##',
    '##,,,,,,,,,,...~~~~~~~~~~~~~~~~..,,,,,,,,,,,##',
    '##,,,u,,,,,,,.~~~~~~~~~~~~~~~~...,,,,,u,,,,,##',
    '##,,,,,,,,,,...~~~~~~~~~~~~~~~~.,,,,,,,,,,,,##',
    '##,,,,,,,,,,.,.~~~~~~~~~~~~~~~~..,,,,,,,,,,,##',
    '##,,,,,,,,,,,....~~~~~~~~~~~~....,,,,,,,,,,,##',
    '##,,,q,,,,,,,.,.................,,,,,,,,q,,,##',
    '##,,,,,,,,,,,,,.,..,..,..,..,..,,,,,,,,,,,,,##',
    '###,,,,RRR,,,,,,,,,,,,,,,,,,,,,,,,,,RRR,,,,###',
    '###,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,###',
    '####,,,u,,,,,,,,,,B,,,,,,,,,,,,,,,,,,,,,,,####',
    '#####,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#####',
    '########,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,########',
    '##############################,,,,,,,,########',
    '##############################,,,,,,,,########',
    '##############################,,,>,,,,########',
    '##############################,,,,,,,,########',
    '##############################################',
  ],
};

export const ROOT_HOLLOWS_3: TdMapDef = {
  id: 'root-hollows-3', name: 'The Root Hollows · Floor 3 · The Heartroot Cellar', outside: 'bark', dark: true,
  legend: { ...BASE,
    '<': { ground: 'dirt', object: 'up', station: H3_UP, exit: { to: 'root-hollows-2', arrive: 'hollows2-down' } },
  },
  rows: [
    '############################################',
    '##################,,,,,,,,##################',
    '##################,,,<,,,,##################',
    '##################,,,,,,,,##################',
    '##################L,,,,,,L##################',
    '###################,,,,,,###################',
    '###################,,,,,,###################',
    '###################,,,,,,###################',
    '########,,,,,,,,,,,,,,,,,,,,,,,,,,,,########',
    '#####,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#####',
    '####,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,####',
    '###,,,,,,,,,,,,,,..,..,..,..,,,,,,,,,,,,,###',
    '###,,,q,,,,,,,,,...........,.,,,,,,,,q,,,###',
    '##,,,,,,,,,,,,,...RRRRRRRR...,,,,,,,,,,,,,##',
    '##,,,,,,,,,,,,...RRRRRRRRRR...,,,,,,,,,,,,##',
    '##,,,,u,,,,,,L..RRRRRRRRRRRR..L,,,,,,u,,,,##',
    '##,,,,,,,,,,,,,..RRRRRRRRRR..,,,,,,,,,,,,,##',
    '##,,,,,,,,,,,,....RRRRRRRR..,.,,,,,,,,,,,,##',
    '###,,,,,,,,,,,,,...........,.,,,,,,,,,,,,###',
    '###,,,,,,k,,,,,,.,..,..,..,.,,,,,,k,,,,,,###',
    '####,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,####',
    '#####,,,C,,,,,,,,,,,,,,,,,,,,,,,,,,C,,,#####',
    '########,,,,,,,,,,,,,,,,,,,,,,,,,,,,########',
    '############################################',
    '############################################',
  ],
};
