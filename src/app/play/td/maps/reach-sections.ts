/**
 * reach-sections.ts — the Infernal Reach as an act (docs/design/world-acts.md §1.2; canon §3.4b): nine section areas,
 * Cinderport and Ashgrove as their own small safe areas, joined by walked seams and the two connector caves (the Kiln
 * Tunnels, the Glass Throat). Each section is a ContinentDef of its own, so the room runs it as its own area.
 *
 *  Pyrehold ──north gate── the Cinder Steppe ──west road── the Charwood ──kiln-mouth── (the Kiln Tunnels) ── the Deep
 *  Charwood ──east pass── the Obsidian Badlands ──fissure── (the Glass Throat −1, −2) ── the Molten Fields ──switchbacks──
 *  the Pyre Peaks (the Bastion Road, the Caldera Rim: the Molten Deep). Side ways: the Steppe's shore path (the Ashen
 *  Shore and Glasswater, a dead end), its south-east road (Cinderport), the Charwood's west road (Ashgrove).
 *
 * Every map is drawn by hand in blocks (one character per 8×8 tiles, as Ember Isle): `paint` lays the ground and the
 * strokes; `at(bx, by)` turns a block (and a tile inside it) into the section's tiles, where the Waystone camp (or the
 * town) sits at tile (0, 0). The walking-time check (td-sections REACH_ROUTE) reads each section's first road.
 *
 * Region legend: '.' steppe · ',' ash sand · 'l' Glasswater · 'f' the Charwood · 'F' the Deep Charwood · 'h' obsidian
 * dirt (the Badlands, the Bastion Road) · 'v' the molten ground · 'm' rock · '~' the Burning Sea · 'T' the town or camp.
 */
import type { ContinentDef, SectionSeam } from '../continent';
import { buildTown } from '../town-builder';
import type { TdMap } from '../seamworks-square';
import { DEEP_IN } from './molten-deep';
import { CRYPT_IN } from './ashen-crypt';
import { CINDERPORT_SHIP, buildCinderport } from './cinderport';
import { FORGE_IN } from './forge-of-four';
import { buildAshgrove } from './ashgrove';
import { KILN_FAR_IN, KILN_IN } from './kiln-tunnels';
import { THROAT_IN, THROAT_OUT_IN } from './glass-throat';
import { SHIP_TO_ISLE, SHIP_TO_UMBRAL, SHIP_TO_VERDANT, buildPyrehold } from './infernal-reach';

/** The region map: `base` everywhere, rock (`edge`) two blocks deep round the border, then each stroke (a rectangle of blocks) in order. */
export function paint(w: number, h: number, base: string, edge: string, strokes: readonly (readonly [string, number, number, number, number])[]): string[] {
  // Two blocks of rock (or sea) round every section: the border's wobble (td-world regionAt) never thins it to nothing.
  const rim = (x: number, y: number) => x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
  const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (rim(x, y) ? edge : base)));
  for (const [ch, x0, y0, x1, y1] of strokes) for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) g[y][x] = ch;
  return g.map(row => row.join(''));
}
/** Block (bx, by) of a map whose (0, 0) tile lies in block (ox, oy) → that block's tile (dx, dy) in the section's tiles. */
export const blocks = (ox: number, oy: number) => (bx: number, by: number, dx = 4, dy = 4): [number, number] => [(bx - ox) * 8 + dx, (by - oy) * 8 + dy];

export const CAMP_ROWS: readonly string[] = [
  'gggg........gggg',
  'gg............gg',
  'g..............g',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  'g..............g',
  'gg............gg',
  'gggg........gggg',
];
/** A Waystone camp (world-acts.md §0): safe ground round the stone, one lamp, a bench to rest at. Its stone is ContinentDef.stone. */
const buildCamp = (id: string, ash = false) => (): TdMap => buildTown({
  id, rows: CAMP_ROWS, legend: { '.': 'dirt', g: ash ? 'cave' : 'grass' }, houses: [], stalls: [],
  props: [{ kind: 'waystone', c: 8, r: 4 }, { kind: 'lamp', c: 10, r: 4 }, { kind: 'bench', c: 6, r: 6 }, { kind: 'signpost', c: 12, r: 8 }],
  spawn: { c: 8, r: 7 },
});
/** The section a seam leads to, and its far gate (the arrival). */
export const seam = (id: string, c: number, r: number, dir: SectionSeam['dir'], to: string, arrive: string, label: string, kind: SectionSeam['kind'] = 'gate'): SectionSeam =>
  ({ id, c, r, dir, to, arrive, label, kind });

export const REACH_PYREHOLD = 'infernal-reach-pyrehold';
export const REACH_STEPPE = 'infernal-reach-steppe';
export const REACH_SHORE = 'infernal-reach-shore';
export const REACH_CHARWOOD = 'infernal-reach-charwood';
export const REACH_DEEP_CHARWOOD = 'infernal-reach-deep-charwood';
export const REACH_BADLANDS = 'infernal-reach-badlands';
export const REACH_MOLTEN_FIELDS = 'infernal-reach-molten-fields';
export const REACH_PYRE_PEAKS = 'infernal-reach-pyre-peaks';
export const REACH_CINDERPORT = 'infernal-reach-cinderport';
export const REACH_ASHGROVE = 'infernal-reach-ashgrove';
const LAND = 'infernal-reach';

// ── Pyrehold: the capital, its harbour, its north gate (safe) ────────────────────────────────────────────────────────
export const PYREHOLD_SECTION: ContinentDef = {
  id: REACH_PYREHOLD, land: LAND, title: 'Pyrehold', ox: 3, oy: 4,
  map: paint(12, 10, '.', 'm', [['T', 3, 4, 8, 7], [',', 2, 8, 2, 8], [',', 9, 8, 9, 8], ['~', 3, 8, 8, 8], ['~', 0, 9, 11, 9]]),
  roads: [[[23, 15], [23, 0], [23, -21]]],
  places: [{ kind: 'harbour', c: 23, r: 26, name: 'Pyrehold Harbour' }],
  names: { T: 'Pyrehold', '.': 'Pyrehold', m: 'Pyrehold', ',': 'Pyrehold Harbour', '~': 'The Burning Sea' },
  mobs: {},
  town: buildPyrehold, townName: 'Pyrehold', streets: { row: 15, col: 23 }, river: false,
  ways: [
    { place: 'harbour', station: SHIP_TO_ISLE, to: 'ember-isle', arrive: 'ship-reach', ship: true },
    { place: 'harbour', station: SHIP_TO_VERDANT, to: 'verdant-wilds-shore', arrive: 'ship-mossharbor', ship: true, along: -3 },
    { place: 'harbour', station: SHIP_TO_UMBRAL, to: 'umbral-marches-shore', arrive: 'ship-mirewatch', ship: true, along: 2 },
  ],
  seams: [seam('pyrehold-n', 23, -14, 'n', REACH_STEPPE, 'steppe-s', 'NORTH GATE: THE CINDER STEPPE')],
  stone: { id: 'reach:pyrehold', c: 27, r: 10, name: 'The Plaza Stone' },
  marks: [
    { id: 'read:pyrehold-bell', kind: 'read', c: 28, r: -6, look: 'plaque', label: 'THE WATCH BELL PLAQUE' },
    { id: 'sealed:pyrehold-strongroom', kind: 'sealed', c: 17, r: -7, look: 'chest', label: 'THE WATCH STRONGBOX' },
  ],
};

// ── The Cinder Steppe (8–11): the act's moor ────────────────────────────────────────────────────────────────────────
const S = blocks(18, 12);
export const STEPPE_SECTION: ContinentDef = {
  id: REACH_STEPPE, land: LAND, title: 'The Cinder Steppe', ox: 18, oy: 12, townKind: 'camp', quiet: 1,
  map: paint(40, 24, '.', 'm', [['T', 18, 12, 19, 13], [',', 25, 3, 30, 6], [',', 5, 16, 9, 19], [',', 30, 17, 35, 20]]),
  roads: [
    // The through-road: Pyrehold's gate in the south, north past the Watch Cairn, then west to the Charwood.
    [[52, 85], [52, 78], [50, 56], [80, 40], [110, 10], [96, -30], [60, -50], [30, -24], [8, 6], [-30, 20], [-70, 40], [-100, 20], [-110, -10], [-90, -40], [-120, -52], [-133, -52]],
    // The south-east road to Cinderport, and the shore path east (a dead end).
    [[50, 56], [100, 64], [148, 72], [148, 85]],
    [[110, 10], [140, -10], [158, -28], [165, -28]],
  ],
  places: [], names: { '.': 'The Cinder Steppe', ',': 'The Cinder Steppe', m: 'The Cinder Steppe', T: 'The Watch Cairn', '~': 'The Burning Sea' },
  mobs: { '.': { types: ['ash-wolf', 'cinder-imp', 'lava-hound', 'rivet-maw', 'cinder-orc'], chance: .4 }, ',': { types: ['rivet-maw', 'cinder-imp'], chance: .3 } },
  hotspots: [{ region: '.', chance: .15, types: ['lava-hound', 'rivet-maw'], count: 3 }],
  town: buildCamp('watch-cairn'), townName: 'The Watch Cairn', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [],
  seams: [
    seam('steppe-s', ...S(24, 21, 4, 6), 's', REACH_PYREHOLD, 'pyrehold-n', 'SOUTH GATE: PYREHOLD'),
    seam('steppe-w', ...S(2, 5, 2), 'w', REACH_CHARWOOD, 'charwood-e', 'WEST ROAD: THE CHARWOOD'),
    seam('steppe-se', ...S(36, 21, 4, 6), 's', REACH_CINDERPORT, 'cinderport-n', 'SOUTH-EAST ROAD: CINDERPORT'),
    seam('steppe-e', ...S(37, 8, 6), 'e', REACH_SHORE, 'shore-w', 'SHORE PATH: THE ASHEN SHORE'),
  ],
  stone: { id: 'reach:watch-cairn', c: 8, r: 4, name: 'The Watch Cairn' },
  marks: [
    { id: 'read:steppe-cairn', kind: 'read', c: 34, r: -9, look: 'plaque', label: 'A WATCH CAIRN' },
    { id: 'sealed:steppe-beacon', kind: 'sealed', c: -100, r: 28, look: 'ruin', label: 'A BEACON TOWER' },
  ],
};

// ── The Ashen Shore and Glasswater (8–10): fishing, a dead end ──────────────────────────────────────────────────────
export const SHORE_SECTION: ContinentDef = {
  id: REACH_SHORE, land: LAND, title: 'The Ashen Shore', ox: 6, oy: 10, townKind: 'camp', quiet: 1,
  map: paint(36, 22, ',', 'm', [['T', 6, 10, 7, 11], ['l', 12, 4, 24, 12], ['.', 2, 2, 5, 8], ['.', 26, 2, 31, 6], ['~', 0, 20, 35, 21], ['~', 34, 0, 35, 21]]),
  roads: [[[-37, -12], [-30, -12], [-10, -4], [8, 6], [30, 40], [60, 60], [110, 50], [160, 60], [200, 40], [210, 0], [190, -30], [160, -50], [200, -60]]],
  places: [], names: { ',': 'The Ashen Shore', '.': 'The Ashen Shore', l: 'Glasswater', m: 'The Ashen Shore', T: 'The Glasswater Stone', '~': 'The Burning Sea' },
  mobs: { ',': { types: ['rivet-maw', 'cinder-imp', 'ash-wolf'], chance: .25 }, '.': { types: ['ash-wolf'], chance: .3 } },
  town: buildCamp('glasswater-stone'), townName: 'The Glasswater Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'sand' },
  ways: [],
  seams: [seam('shore-w', -30, -12, 'w', REACH_STEPPE, 'steppe-e', 'SHORE PATH: THE CINDER STEPPE')],
  stone: { id: 'reach:glasswater', c: 8, r: 4, name: 'The Glasswater Stone' },
  marks: [
    { id: 'read:shore-tideboard', kind: 'read', c: 104, r: 44, look: 'sign', label: "A FISHER'S TIDE-BOARD" },
    { id: 'sealed:shore-cave', kind: 'sealed', c: 198, r: -36, look: 'cave', label: 'A SEALED SEA-CAVE' },
  ],
};

// ── The Charwood (10–13): charcoal wood, Ash Wolves, the Woodward's work ────────────────────────────────────────────
const C = blocks(22, 14);
export const CHARWOOD_SECTION: ContinentDef = {
  id: REACH_CHARWOOD, land: LAND, title: 'The Charwood', ox: 22, oy: 14, townKind: 'camp', quiet: 1,
  map: paint(40, 26, 'f', 'm', [['T', 22, 14, 23, 15], ['.', 16, 8, 20, 10], ['.', 28, 18, 33, 21], ['.', 6, 15, 10, 18]]),
  roads: [
    [[133, -4], [126, -4], [100, 20], [110, 50], [120, 72], [80, 74], [70, 60], [40, 30], [8, 6], [-24, 20], [-60, 40], [-100, 50], [-90, 10], [-70, -20], [-40, -44], [-62, -60], [-76, -82]],
    // The west road to Ashgrove, on the Charwood's edge.
    [[-24, 20], [-80, 14], [-130, 24], [-158, 20], [-165, 20]],
  ],
  places: [{ kind: 'cave', c: C(12, 3)[0], r: C(12, 3)[1], name: 'The Kiln-Mouth' }],
  names: { f: 'The Charwood', '.': 'The Charwood', m: 'The Charwood', T: 'The Kiln Stone' },
  mobs: { f: { types: ['ash-wolf', 'ash-wolf', 'lava-hound'], chance: .6 }, '.': { types: ['ash-wolf'], chance: .3 } },
  hotspots: [{ region: 'f', chance: .4, types: ['lava-hound', 'ash-wolf'], count: 4 }],
  town: buildCamp('kiln-stone'), townName: 'The Kiln Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [{ place: 'cave', station: KILN_IN, to: 'kiln-tunnels-1', arrive: 'kiln-up' }],
  seams: [
    seam('charwood-e', ...C(37, 13, 6), 'e', REACH_STEPPE, 'steppe-w', 'EAST ROAD: THE CINDER STEPPE'),
    seam('charwood-w', ...C(2, 16, 2), 'w', REACH_ASHGROVE, 'ashgrove-e', 'WEST ROAD: ASHGROVE'),
  ],
  stone: { id: 'reach:kiln', c: 8, r: 4, name: 'The Kiln Stone' },
  marks: [
    { id: 'read:charwood-post', kind: 'read', c: 62, r: 66, look: 'sign', label: "A WOODWARD'S TALLY POST" },
    { id: 'sealed:charwood-kiln', kind: 'sealed', c: -36, r: -28, look: 'kiln', label: 'A BRICKED KILN' },
  ],
};

// ── The Deep Charwood (13–16): the clans' wood, Kettle Camp ─────────────────────────────────────────────────────────
const D = blocks(14, 12);
export const DEEP_CHARWOOD_SECTION: ContinentDef = {
  id: REACH_DEEP_CHARWOOD, land: LAND, title: 'The Deep Charwood', ox: 14, oy: 12, townKind: 'camp', quiet: 1,
  map: paint(40, 26, 'F', 'm', [['T', 14, 12, 15, 13], ['f', 2, 2, 7, 8], ['f', 30, 15, 37, 22], ['.', 24, 4, 28, 8]]),
  roads: [
    [[-76, -58], [-50, -30], [-60, 10], [-80, 50], [-20, 40], [8, 6], [40, -20], [80, 10], [70, 50], [60, 80], [120, 70], [150, 40], [190, 52], [197, 52]],
    // A side track up toward Kettle Camp (it stops short: a camp sits off the road, world-acts.md §2).
    [[80, 10], [96, -26]],
  ],
  places: [{ kind: 'cave', c: D(4, 4)[0], r: D(4, 4)[1], name: 'The Far Mouth' }],
  names: { F: 'The Deep Charwood', f: 'The Deep Charwood', '.': 'The Deep Charwood', m: 'The Deep Charwood', T: 'The Clan Stone' },
  mobs: {
    F: { types: ['ash-wolf', 'lava-hound', 'cinder-orc', 'cinder-orc', 'orc-firecaller'], chance: .65 },
    f: { types: ['ash-wolf', 'lava-hound'], chance: .5 },
  },
  hotspots: [{ region: 'F', chance: .35, types: ['cinder-orc', 'cinder-orc', 'orc-firecaller', 'ashsinger'], count: 5 }],
  town: buildCamp('clan-stone'), townName: 'The Clan Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [{ place: 'cave', station: KILN_FAR_IN, to: 'kiln-tunnels-1', arrive: 'kiln-far' }],
  seams: [seam('deep-charwood-e', ...D(37, 18, 6), 'e', REACH_BADLANDS, 'badlands-w', 'EAST PASS: THE OBSIDIAN BADLANDS', 'pass')],
  stone: { id: 'reach:clan', c: 8, r: 4, name: 'The Clan Stone' },
  marks: [
    { id: 'read:kettle-stamp', kind: 'read', c: 106, r: -39, look: 'plaque', label: 'A STOLEN WATCH KETTLE' },
    { id: 'sealed:deep-kiln', kind: 'sealed', c: -42, r: -26, look: 'kiln', label: 'A COLD KILN' },
  ],
  camps: [{ id: 'kettle', name: 'Kettle Camp', kind: 'camp', c: 100, r: -44,
    spawns: ['cinder-orc', 'cinder-orc', 'cinder-orc', 'cinder-orc', 'cinder-orc', 'cinder-orc', 'cinder-orc', 'cinder-orc', 'orc-firecaller', 'orc-firecaller', 'orc-warlord'] }],
};

// ── The Obsidian Badlands (15–18): the Forge's spill, the Scorch Rings ──────────────────────────────────────────────
const B = blocks(6, 13);
export const BADLANDS_SECTION: ContinentDef = {
  id: REACH_BADLANDS, land: LAND, ash: true, title: 'The Obsidian Badlands', ox: 6, oy: 13, townKind: 'camp', quiet: 1,
  map: paint(44, 26, 'h', 'm', [['T', 6, 13, 7, 14], ['m', 8, 2, 11, 5], ['m', 30, 2, 34, 4], ['m', 12, 19, 15, 22]]),
  roads: [
    [[-37, 4], [-30, 4], [-10, 8], [8, 6], [40, -30], [50, -70], [80, -40], [100, 10], [140, 36], [180, 10], [230, 0], [250, 30], [240, 60], [276, 58]],
    // Up to the Forge of the Four's ruined gate, at the foot of the Pyre Peaks.
    [[80, -40], [120, -60], [148, -66]],
  ],
  places: [
    { kind: 'forge', c: B(24, 4)[0], r: B(24, 4)[1], name: 'The Forge of the Four' },
    { kind: 'cave', c: B(40, 20)[0], r: B(40, 20)[1], name: 'The Obsidian Fissure' },
  ],
  names: { h: 'The Obsidian Badlands', m: 'The Obsidian Badlands', T: 'The Spill Stone' },
  mobs: { h: { types: ['lava-hound', 'cinder-bailiff', 'cinder-orc', 'orc-firecaller', 'orc-warlord'], chance: .65 } },
  hotspots: [{ region: 'h', chance: .35, types: ['cinder-orc', 'orc-firecaller', 'orc-warlord', 'cinder-orc', 'ashsinger'], count: 5 }],
  town: buildCamp('spill-stone', true), townName: 'The Spill Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [
    { place: 'forge', station: FORGE_IN, to: 'forge-of-four-1', arrive: 'forge-out' },
    { place: 'cave', station: THROAT_IN, to: 'glass-throat-1', arrive: 'throat-up' },
  ],
  seams: [seam('badlands-w', ...B(2, 13, 2), 'w', REACH_DEEP_CHARWOOD, 'deep-charwood-e', 'WEST PASS: THE DEEP CHARWOOD', 'pass')],
  stone: { id: 'reach:spill', c: 8, r: 4, name: 'The Spill Stone' },
  marks: [
    { id: 'read:scorch-words', kind: 'read', c: 171, r: 47, look: 'altar', label: 'WORDS CUT IN THE STONE' },
    { id: 'sealed:badlands-sluice', kind: 'sealed', c: 56, r: -26, look: 'ruin', label: 'A RUSTED SLUICE-GATE' },
  ],
  camps: [{ id: 'scorch-rings', name: 'The Scorch Rings', kind: 'champion', c: 164, r: 52,
    spawns: ['orc-firecaller', 'orc-firecaller', 'cinder-orc', 'cinder-orc', 'orc-firecaller', 'orc-firecaller'] }],
};

// ── The Molten Fields (18–21): drakes, lava rivers, the Drake Nests ─────────────────────────────────────────────────
const M = blocks(8, 12);
export const MOLTEN_FIELDS_SECTION: ContinentDef = {
  id: REACH_MOLTEN_FIELDS, land: LAND, ash: true, title: 'The Molten Fields', ox: 8, oy: 12, townKind: 'camp', quiet: 1,
  map: paint(42, 26, 'v', 'm', [['T', 8, 12, 9, 13], ['h', 2, 14, 8, 22], ['h', 2, 2, 6, 6], ['m', 16, 2, 20, 6]]),
  roads: [[[-36, -58], [-10, -30], [-40, 10], [8, 6], [30, 50], [80, 60], [120, 30], [110, -10], [150, -40], [200, -20], [230, -50], [254, -44], [261, -44]]],
  places: [
    { kind: 'cave', c: M(3, 4)[0], r: M(3, 4)[1], name: 'The Tube Mouth' },
    { kind: 'caldera', c: 180, r: -20, name: 'The Great Caldera' },
  ],
  names: { v: 'The Molten Fields', h: 'The Molten Fields', m: 'The Molten Fields', T: 'The Drake Stone' },
  mobs: { v: { types: ['cinder-imp', 'obsidian-golem', 'ember-drake'], chance: .65 }, h: { types: ['lava-hound', 'cinder-imp'], chance: .5 } },
  hotspots: [{ region: 'v', chance: .3, types: ['ember-drake', 'lava-hound', 'cinder-imp'], count: 4 }],
  town: buildCamp('drake-stone', true), townName: 'The Drake Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [{ place: 'cave', station: THROAT_OUT_IN, to: 'glass-throat-2', arrive: 'throat-out' }],
  seams: [seam('molten-fields-e', ...M(39, 6, 6), 'e', REACH_PYRE_PEAKS, 'pyre-peaks-w', 'THE SWITCHBACKS: THE PYRE PEAKS', 'pass')],
  stone: { id: 'reach:drake', c: 8, r: 4, name: 'The Drake Stone' },
  marks: [
    { id: 'read:drake-post', kind: 'read', c: 60, r: 47, look: 'sign', label: 'A WATCH WARNING POST' },
    { id: 'sealed:drake-cage', kind: 'sealed', c: 116, r: 52, look: 'cage', label: "A DRAKE-CATCHER'S CAGE" },
  ],
  camps: [{ id: 'drake-nests', name: 'The Drake Nests', kind: 'den', c: 132, r: 68, spawns: ['ember-drake'] }],
};

// ── The Pyre Peaks (19–22): the Bastion Road, the Ring of Pyres, the Caldera Rim and the Molten Deep ────────────────
const P = blocks(8, 16);
export const PYRE_PEAKS_SECTION: ContinentDef = {
  id: REACH_PYRE_PEAKS, land: LAND, ash: true, title: 'The Pyre Peaks', ox: 8, oy: 16, townKind: 'camp', quiet: 1,
  map: paint(40, 28, 'h', 'm', [['T', 8, 16, 9, 17], ['m', 14, 2, 20, 8], ['m', 30, 18, 34, 22], ['v', 30, 2, 37, 10]]),
  roads: [
    [[-53, 36], [-46, 36], [-30, 30], [8, 6], [40, -10], [70, 30], [110, 40], [150, 0], [120, -30], [150, -60], [190, -50], [230, -60], [212, -74]],
    // The Bastion Road north-west to the ruins and the crypt door; a path south-east to the Ember Altar.
    [[40, -10], [30, -40], [0, -60], [-12, -85]],
    [[110, 40], [132, 66]],
  ],
  places: [
    { kind: 'ruins', c: P(6, 4)[0], r: P(6, 4)[1], name: 'The Ashen Bastion' },
    { kind: 'crypt', c: P(6, 4)[0], r: P(6, 4)[1] + 5, name: 'The Ashen Crypt' },
    { kind: 'standing-stones', c: 36, r: 20, name: 'The Ring of Pyres' },
    { kind: 'shrine', c: 132, r: 68, name: 'The Ember Altar' },
    { kind: 'cave', c: P(34, 6)[0], r: P(34, 6)[1], name: 'The Molten Deep' },
  ],
  names: { h: 'The Bastion Road', m: 'The Pyre Peaks', v: 'The Caldera Rim', T: 'The Pyre Stone' },
  mobs: { h: { types: ['bone-walker', 'lava-hound', 'obsidian-golem', 'cinder-wraith'], chance: .55 }, v: { types: ['cinder-imp', 'obsidian-golem', 'lava-hound'], chance: .55 } },
  hotspots: [{ region: 'h', chance: .3, types: ['bone-walker', 'bone-archer', 'cinder-wraith'], count: 4 }],
  town: buildCamp('pyre-stone', true), townName: 'The Pyre Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [
    { place: 'cave', station: DEEP_IN, to: 'molten-deep-1', arrive: 'deep-out' },
    { place: 'crypt', station: CRYPT_IN, to: 'ashen-crypt-1', arrive: 'crypt-out' },
  ],
  seams: [seam('pyre-peaks-w', ...P(2, 20, 2), 'w', REACH_MOLTEN_FIELDS, 'molten-fields-e', 'THE SWITCHBACKS: THE MOLTEN FIELDS', 'pass')],
  stone: { id: 'reach:pyre', c: 8, r: 4, name: 'The Pyre Stone' },
  marks: [
    { id: 'read:bastion-mile', kind: 'read', c: 10, r: -47, look: 'plaque', label: 'A BASTION MILESTONE' },
    { id: 'sealed:bastion-gate', kind: 'sealed', c: P(6, 4)[0], r: P(6, 4)[1] - 8, look: 'door', label: "THE BASTION'S GREAT GATE" },
  ],
  camps: [{ id: 'last-cairn', name: "The Watch's Last Cairn", kind: 'camp', c: 52, r: -44,
    spawns: ['bone-walker', 'bone-walker', 'bone-walker', 'bone-walker', 'bone-walker', 'bone-walker', 'bone-archer', 'bone-archer', 'bone-archer', 'ash-ghoul'] }],
};

// ── Cinderport (safe): the fishing harbour on the Steppe's south-east road, its ketch to Ember Isle ─────────────────
export const CINDERPORT_SECTION: ContinentDef = {
  id: REACH_CINDERPORT, land: LAND, title: 'Cinderport', ox: 3, oy: 4, townKind: 'village',
  map: paint(10, 9, '.', 'm', [['T', 3, 4, 6, 5], ['~', 2, 6, 7, 6], ['~', 0, 7, 9, 8]]),
  roads: [[[14, 7], [14, 0], [14, -21]]],
  places: [], names: { T: 'Cinderport', '.': 'Cinderport', ',': 'Cinderport', m: 'Cinderport', '~': 'The Burning Sea' },
  mobs: {},
  town: buildCinderport, townName: 'Cinderport', streets: { row: 6, col: 14 }, river: false,
  ways: [],
  townWays: [{ station: CINDERPORT_SHIP, c: 15, r: 15, to: 'ember-isle', arrive: 'ship-reach', ship: true }],
  seams: [seam('cinderport-n', 14, -14, 'n', REACH_STEPPE, 'steppe-se', 'NORTH ROAD: THE CINDER STEPPE')],
  stone: { id: 'reach:cinderport', c: 20, r: 3, name: 'The Harbour Stone' },
  marks: [
    { id: 'read:cinderport-tides', kind: 'read', c: 20, r: -6, look: 'sign', label: 'THE TIDE BOARD' },
    { id: 'sealed:cinderport-cellar', kind: 'sealed', c: 8, r: -6, look: 'chest', label: "MARIT'S SEA-CHEST" },
  ],
};

// ── Ashgrove (safe): the charcoal-burners' village on the Charwood's west edge ───────────────────────────────────────
export const ASHGROVE_SECTION: ContinentDef = {
  id: REACH_ASHGROVE, land: LAND, title: 'Ashgrove', ox: 3, oy: 3, townKind: 'village',
  map: paint(10, 8, 'f', 'm', [['T', 3, 3, 6, 4], ['.', 7, 3, 7, 4]]),
  roads: [[[27, 5], [42, 5]]],
  places: [], names: { T: 'Ashgrove', f: 'Ashgrove', '.': 'Ashgrove', m: 'Ashgrove' },
  mobs: {},
  town: buildAshgrove, townName: 'Ashgrove', streets: { row: 5, col: 14 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [],
  seams: [seam('ashgrove-e', 38, 5, 'e', REACH_CHARWOOD, 'charwood-w', 'EAST ROAD: THE CHARWOOD')],
  stone: { id: 'reach:ashgrove', c: 16, r: 10, name: 'The Green Stone' },
  marks: [
    { id: 'read:ashgrove-board', kind: 'read', c: 31, r: 9, look: 'sign', label: "MAUD KILN'S BOARD" },
    { id: 'sealed:ashgrove-clamp', kind: 'sealed', c: 31, r: 1, look: 'mound', label: 'A SMOKING CLAMP' },
  ],
};

/** Every section of the Reach, by area id (td-levels CONTINENTS takes them as continents). */
export const REACH_SECTIONS: Readonly<Record<string, ContinentDef>> = Object.fromEntries([
  PYREHOLD_SECTION, STEPPE_SECTION, SHORE_SECTION, CHARWOOD_SECTION, DEEP_CHARWOOD_SECTION, BADLANDS_SECTION,
  MOLTEN_FIELDS_SECTION, PYRE_PEAKS_SECTION, CINDERPORT_SECTION, ASHGROVE_SECTION,
].map(d => [d.id, d]));
