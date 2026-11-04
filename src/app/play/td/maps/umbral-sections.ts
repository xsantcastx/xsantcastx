/**
 * umbral-sections.ts — the Umbral Marches as an act (S11 part 2; docs/design/world-acts.md §1.4, §2.4, §5.4; canon
 * §3.4b, §8.4): six section areas and Gloamhaven, joined by walked seams and by two connectors, the Sunken Belfry and
 * the Bog Galleries. Each section is a ContinentDef of its own, so the room runs it as its own area. Drawn as the Reach
 * and the Wilds are (reach-sections.ts `paint`, `seam`): one character per 8×8 tiles, two blocks of the fen too deep to
 * wade round every section (`rim: 'blackwater'`: the land's edge here is black water, its ways on boardwalks across it).
 *
 *  Mirewatch (on the Gloaming Shore) ──north boardwalk── the Gloaming Fen (Lanternfen on its north-west road; its east
 *  boardwalk to GLOAMHAVEN) ──north boardwalk── the Pilgrims' Boardwalk (half sunk; it breaks off in the water) ──the
 *  broken end── (the Sunken Belfry, one floor) ── the Black Meres ──east boardwalk── the Deep Fen ──the peat-cut──
 *  (the Bog Galleries −1, −2) ── the Drowned Ruins (the Drowned Crypts' door; the Lantern Ring).
 *
 * The fog (ContinentDef.fog) lies over every section; it thins round the Keeper and every lantern.
 *
 * (Named for its land, `umbral-`, like its towns' file: combat-sim reads the maps folder in order, and its level-30
 * damage creature is the first one met there — a Reach creature, as before this act was drawn.)
 *
 * Region legend: ',' the shore · 'q' the fen (bog, black pools) · 'Q' the deep fen (more water than land, the old
 * cypresses) · 'k' the meres (black water, a hummock here and there) · 'x' the drowned ruins · 'm' the fen too deep to
 * wade · '~' the Burning Sea · 'T' the town or Waystone camp.
 */
import type { ContinentDef } from '../continent';
import { buildTown } from '../town-builder';
import type { TdMap } from '../seamworks-square';
import { CAMP_ROWS, paint, seam } from './reach-sections';
import { MIREWATCH_SHIP, buildGloamhaven, buildLanternfen, buildMirewatch } from './umbral-marches';
import { CRYPTS_IN } from './drowned-crypts';
import { BELFRY_FAR_IN, BELFRY_IN } from './sunken-belfry';
import { GALLERIES_FAR_IN, GALLERIES_IN } from './bog-galleries';

export const MARCHES_SHORE = 'umbral-marches-shore';
export const MARCHES_GLOAMHAVEN = 'umbral-marches-gloamhaven';
export const MARCHES_FEN = 'umbral-marches-fen';
export const MARCHES_BOARDWALK = 'umbral-marches-boardwalk';
export const MARCHES_MERES = 'umbral-marches-meres';
export const MARCHES_DEEP = 'umbral-marches-deep-fen';
export const MARCHES_RUINS = 'umbral-marches-ruins';
const LAND = 'umbral-marches';
/** The edge of the fen: black water too deep to wade (td-art 'blackwater'); the ways on are boardwalks across it. */
const RIM = 'blackwater' as const;
/** The fog of the Marches (built): on every section; Gloamhaven's own a little thinner under its lanterns. */
const FOG = .55;

/**
 * The Black Meres' widest pool, the Three Posts (S10b's Fogmother): no road, camp, stone or seam within 30 tiles, the
 * bog firm round it; its three posts and its spawn-free ring are td-world's (`mere-posts`).
 */
export const THREE_POSTS_AT = { c: 96, r: -52 } as const;
/** Where the fifth bell rings under the Meres (world-acts.md §5.4, the Bell Under the Water): over the Belfry's roof. */
export const BELFRY_ROOF_AT = { c: -24, r: -44 } as const;

/**
 * A Waystone hummock (world-acts.md §0): safe ground round the stone, boards to stand on, one lantern, a bench. No
 * townsfolk (td-engine spawnFolk skips a camp).
 */
const buildHummock = (id: string) => (): TdMap => buildTown({
  id, rows: CAMP_ROWS, legend: { '.': 'boardwalk', g: 'mire' }, houses: [], stalls: [],
  props: [
    { kind: 'waystone', c: 8, r: 4 }, { kind: 'lantern', c: 10, r: 5 }, { kind: 'bench', c: 6, r: 6 }, { kind: 'signpost', c: 12, r: 8 },
    { kind: 'reeds', c: 1, r: 1 }, { kind: 'reeds', c: 14, r: 10 }, { kind: 'gloomcap', c: 2, r: 9 },
  ],
  spawn: { c: 8, r: 7 },
});

// ── The Gloaming Shore (26–28): Mirewatch's landing ──────────────────────────────────────────────────────────────
export const SHORE_SECTION: ContinentDef = {
  id: MARCHES_SHORE, land: LAND, rim: RIM, title: 'The Gloaming Shore', ox: 18, oy: 8, townKind: 'camp', quiet: 1, fog: FOG,
  map: paint(36, 22, 'q', 'm', [['T', 18, 8, 19, 9], ['k', 4, 3, 9, 8], ['k', 25, 2, 31, 6], [',', 2, 15, 33, 18], ['~', 0, 19, 35, 21]]),
  roads: [
    // Mirewatch's north boardwalk, west along the dunes, back past the Corvane Stone, then north-east to the Fen.
    [[-1, 72], [-1, 58], [-40, 50], [-90, 44], [-118, 20], [-104, -6], [-118, -30], [-80, -38], [-50, -26], [-28, -12], [2, 4], [8, 8], [8, -8], [40, -30], [76, -14], [110, -20], [100, -28], [100, -46], [100, -62]],
  ],
  places: [], names: { q: 'The Gloaming Shore', k: 'The Gloaming Shore', ',': 'The Gloaming Shore', m: 'The Gloaming Shore', T: 'The Corvane Stone', '~': 'The Burning Sea' },
  mobs: { q: { types: ['mire-lurker', 'lantern-wisp', 'mire-lurker'], chance: .35 }, ',': { types: ['mire-lurker'], chance: .25 }, k: { types: ['lantern-wisp'], chance: .3 } },
  town: buildHummock('corvane-stone'), townName: 'The Corvane Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'boardwalk', far: 'boardwalk' },
  ways: [],
  villages: [
    // Old Corvane's hand-lit pier: the ketch to Pyrehold sails from its end (the village's tile 15, 16).
    { name: 'Mirewatch', c: -16, r: 72, build: buildMirewatch, ways: [{ station: MIREWATCH_SHIP, c: 15, r: 16, to: 'infernal-reach-pyrehold', arrive: 'ship-umbral', ship: true }] },
  ],
  seams: [seam('shore-n', 100, -46, 'n', MARCHES_FEN, 'fen-s', 'NORTH BOARDWALK: THE GLOAMING FEN')],
  stone: { id: 'marches:corvane', c: 8, r: 4, name: 'The Corvane Stone' },
  marks: [
    { id: 'read:shore-wickpost', kind: 'read', c: -44, r: 46, look: 'sign', label: 'A POST OF WICK-TAGS' },
    { id: 'sealed:shore-watchhouse', kind: 'sealed', c: -100, r: -24, look: 'door', label: 'A DROWNED WATCH-HOUSE' },
  ],
};

// ── Gloamhaven (safe): the capital on its stilts over the drowned square ──────────────────────────────────────────
export const GLOAMHAVEN_SECTION: ContinentDef = {
  id: MARCHES_GLOAMHAVEN, land: LAND, rim: RIM, title: 'Gloamhaven', ox: 4, oy: 4, fog: FOG,
  map: paint(14, 11, 'q', 'm', [['T', 4, 4, 9, 8]]),
  roads: [[[3, 18], [-30, 18]]],
  places: [], names: { T: 'Gloamhaven', q: 'Gloamhaven', m: 'Gloamhaven' },
  mobs: {},
  town: buildGloamhaven, townName: 'Gloamhaven', streets: { row: 18, col: 23 }, river: false, roadGround: { near: 'boardwalk', far: 'boardwalk' },
  ways: [],
  seams: [seam('gloamhaven-w', -13, 18, 'w', MARCHES_FEN, 'fen-e', 'WEST BOARDWALK: THE GLOAMING FEN')],
  stone: { id: 'marches:gloamhaven', c: 27, r: 11, name: 'The Square Stone' },
  marks: [
    { id: 'read:gloamhaven-round', kind: 'read', c: 52, r: 14, look: 'plaque', label: "THE LAMPLIGHTERS' ROUND" },
    { id: 'sealed:gloamhaven-chapel', kind: 'sealed', c: 52, r: 23, look: 'door', label: 'A CHAPEL DOOR UNDER THE BOARDS' },
  ],
};

// ── The Gloaming Fen (26–29): the act's moor; Lanternfen; the boardwalk east to Gloamhaven ────────────────────────
export const FEN_SECTION: ContinentDef = {
  id: MARCHES_FEN, land: LAND, rim: RIM, title: 'The Gloaming Fen', ox: 20, oy: 12, townKind: 'camp', quiet: 1, fog: FOG,
  map: paint(40, 24, 'q', 'm', [['T', 20, 12, 21, 13], ['Q', 2, 2, 9, 8], ['k', 28, 3, 35, 8], ['k', 4, 15, 10, 20], ['Q', 30, 15, 36, 20]]),
  roads: [
    // The through-boardwalk: the Shore's gate in the south, west round the black pools, past the Wick Stone, north to the pilgrims' road.
    [[4, 96], [4, 70], [-30, 56], [-80, 62], [-118, 36], [-110, 6], [-60, 18], [-20, 14], [8, 8], [8, -8], [30, -24], [70, -40], [120, -20], [128, -56], [96, -68], [60, -66], [40, -78], [40, -96]],
    // The east boardwalk to Gloamhaven; the north-west road to Lanternfen (a hamlet at the road's end).
    [[8, 8], [50, 24], [100, 18], [140, 18], [160, 18]],
    [[-60, 18], [-100, 0], [-117, -20], [-117, -42]],
  ],
  places: [{ kind: 'shrine', c: 64, r: 52, name: 'The Gloam Shrine' }],
  names: { q: 'The Gloaming Fen', Q: 'The Gloaming Fen', k: 'The Gloaming Fen', m: 'The Gloaming Fen', T: 'The Wick Stone' },
  mobs: { q: { types: ['mire-lurker', 'lantern-wisp', 'mire-lurker'], chance: .45 }, Q: { types: ['mire-lurker', 'ink-hound', 'lantern-wisp'], chance: .5 }, k: { types: ['lantern-wisp', 'mire-lurker'], chance: .4 } },
  hotspots: [{ region: 'q', chance: .2, types: ['mire-lurker', 'lantern-wisp'], count: 3 }],
  town: buildHummock('wick-stone'), townName: 'The Wick Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'boardwalk', far: 'boardwalk' },
  ways: [],
  villages: [{ name: 'Lanternfen', c: -131, r: -60, build: buildLanternfen }],
  seams: [
    seam('fen-s', 4, 76, 's', MARCHES_SHORE, 'shore-n', 'SOUTH BOARDWALK: THE GLOAMING SHORE'),
    seam('fen-e', 140, 18, 'e', MARCHES_GLOAMHAVEN, 'gloamhaven-w', 'EAST BOARDWALK: GLOAMHAVEN'),
    seam('fen-n', 40, -77, 'n', MARCHES_BOARDWALK, 'boardwalk-s', "THE PILGRIMS' ROAD: THE BOARDWALK", 'ford'),
  ],
  stone: { id: 'marches:wick', c: 8, r: 4, name: 'The Wick Stone' },
  marks: [
    { id: 'read:fen-boundary', kind: 'read', c: -24, r: 18, look: 'plaque', label: 'AN ABBEY BOUNDARY SLAB' },
    { id: 'sealed:fen-cutters-hut', kind: 'sealed', c: 82, r: -41, look: 'door', label: "A PEAT-CUTTER'S HUT, NAILED SHUT" },
  ],
};

// ── The Pilgrims' Boardwalk (28–30): the pilgrims' road to the abbey, half sunk; it breaks off in the water ────────
/** Where the boardwalk breaks off: its last boards, then the piles standing out of the water (the sealed thing). */
export const BROKEN_END = { c: 104, r: -58 } as const;
/** The belfry's upper end lying out of the water beside the break: the way down into it. */
export const BOARDWALK_BELFRY = { c: 120, r: -56 } as const;
export const BOARDWALK_SECTION: ContinentDef = {
  id: MARCHES_BOARDWALK, land: LAND, rim: RIM, title: "The Pilgrims' Boardwalk", ox: 20, oy: 11, townKind: 'camp', quiet: 1, fog: FOG,
  map: paint(40, 22, 'k', 'm', [['T', 20, 11, 21, 12], ['q', 3, 12, 12, 18], ['q', 22, 2, 28, 5], ['Q', 2, 2, 8, 7], ['q', 24, 14, 32, 19]]),
  roads: [
    // From the Fen's gate in the south, west and back over the black water, past the Prayer-Board Stone, north-east to
    // where it breaks off; the last spur to the belfry's roof lying out of the water beside it.
    [[-100, 88], [-100, 60], [-132, 30], [-112, -2], [-64, 10], [-30, 40], [-24, 22], [2, 4], [8, 8], [8, -8], [30, -30], [0, -48], [-40, -58], [-6, -66], [40, -54], [80, -64], [60, -36], [104, -44], [BROKEN_END.c, BROKEN_END.r + 1]],
    [[104, -48], [BOARDWALK_BELFRY.c, -48], [BOARDWALK_BELFRY.c, BOARDWALK_BELFRY.r + 1]],
  ],
  places: [{ kind: 'belfry', c: BOARDWALK_BELFRY.c, r: BOARDWALK_BELFRY.r, name: 'The Sunken Belfry' }],
  names: { k: "The Pilgrims' Boardwalk", q: "The Pilgrims' Boardwalk", Q: "The Pilgrims' Boardwalk", m: "The Pilgrims' Boardwalk", T: 'The Prayer-Board Stone' },
  mobs: { k: { types: ['lantern-wisp', 'mire-lurker'], chance: .45 }, q: { types: ['mire-lurker', 'lantern-wisp'], chance: .5 }, Q: { types: ['mire-lurker', 'lantern-wisp', 'mire-lurker'], chance: .5 } },
  hotspots: [{ region: 'q', chance: .25, types: ['mire-lurker', 'lantern-wisp', 'mire-lurker'], count: 4 }],
  town: buildHummock('prayer-board-stone'), townName: 'The Prayer-Board Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'boardwalk', far: 'boardwalk' },
  ways: [{ place: 'belfry', station: BELFRY_IN, to: 'sunken-belfry-1', arrive: 'belfry-up' }],
  seams: [seam('boardwalk-s', -100, 68, 's', MARCHES_FEN, 'fen-n', "THE PILGRIMS' ROAD: THE GLOAMING FEN", 'ford')],
  stone: { id: 'marches:prayer-board', c: 8, r: 4, name: 'The Prayer-Board Stone' },
  marks: [
    { id: 'read:boardwalk-prayer', kind: 'read', c: -60, r: 7, look: 'sign', label: 'A PRAYER-BOARD' },
    // The boardwalk's piles standing on out of the water where its boards are gone, three abreast, six deep (no seam
    // past them: the way on is down through the belfry lying beside the break).
    { id: 'sealed:boardwalk-broken', kind: 'sealed', c: BROKEN_END.c, r: BROKEN_END.r, look: 'piles', label: 'THE BROKEN BOARDWALK', span: { w: 1, rows: 6, dir: -1 } },
  ],
};

// ── The Black Meres (29–32): black water, the Lure Pools, the Belfry's roof ─────────────────────────────────────────
export const MERES_SECTION: ContinentDef = {
  id: MARCHES_MERES, land: LAND, rim: RIM, title: 'The Black Meres', ox: 8, oy: 14, townKind: 'camp', quiet: 1, fog: FOG,
  map: paint(42, 26, 'k', 'm', [['T', 8, 14, 9, 15], ['q', 2, 2, 10, 8], ['q', 14, 17, 22, 22], ['q', 30, 2, 38, 8], ['q', 28, 17, 38, 23]]),
  roads: [
    // Up out of the Belfry's roof, past the Mere-Lamp Stone, east over the meres to the Deep Fen.
    [[BELFRY_ROOF_AT.c, BELFRY_ROOF_AT.r + 1], [-20, -10], [2, 4], [8, 8], [30, 40], [70, 64], [110, 50], [100, 20], [140, 0], [130, -30], [170, -40], [200, -60], [230, -80], [250, -56], [232, -34], [222, -12], [236, -10], [252, -10], [270, -10]],
    // A boardwalk out toward the Lure Pools (they learned that Keepers walk toward lanterns).
    [[110, 50], [150, 56], [190, 54]],
    // Old Corvane's boards out to the Three Posts, ending at the pool's edge (he rows the last of it to light them).
    [[130, -30], [116, -42], [107, -48]],
  ],
  places: [
    { kind: 'belfry', c: BELFRY_ROOF_AT.c, r: BELFRY_ROOF_AT.r, name: "The Belfry's Roof" },
    // S10b: the Three Posts, the Meres' widest pool, its reed islands and the three lantern posts Old Corvane has lit since
    // he was a boy; on a foggy night with them out the Fogmother rises here (world-bosses.ts).
    { kind: 'mere-posts', c: THREE_POSTS_AT.c, r: THREE_POSTS_AT.r, name: 'The Three Posts' },
  ],
  names: { k: 'The Black Meres', q: 'The Black Meres', m: 'The Black Meres', T: 'The Mere-Lamp Stone' },
  mobs: { k: { types: ['lantern-wisp', 'mire-lurker', 'mire-lurker'], chance: .5 }, q: { types: ['mire-lurker', 'lantern-wisp'], chance: .5 } },
  town: buildHummock('mere-lamp-stone'), townName: 'The Mere-Lamp Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'boardwalk', far: 'boardwalk' },
  ways: [{ place: 'belfry', station: BELFRY_FAR_IN, to: 'sunken-belfry-1', arrive: 'belfry-out' }],
  seams: [seam('meres-e', 252, -10, 'e', MARCHES_DEEP, 'deep-fen-w', 'EAST BOARDWALK: THE DEEP FEN')],
  stone: { id: 'marches:mere-lamp', c: 8, r: 4, name: 'The Mere-Lamp Stone' },
  marks: [
    { id: 'read:meres-lampstake', kind: 'read', c: 44, r: 44, look: 'sign', label: 'A LAMP-STAKE' },
    { id: 'sealed:meres-punt', kind: 'sealed', c: 176, r: -50, look: 'ruin', label: 'A PUNT CHAINED UNDER THE WATER' },
  ],
  camps: [{ id: 'lure-pools', name: 'The Lure Pools', kind: 'camp', c: 200, r: 52,
    spawns: ['mire-lurker', 'mire-lurker', 'mire-lurker', 'mire-lurker', 'mire-lurker', 'mire-lurker', 'mire-lurker', 'mire-lurker'] }],
  // The Three Posts' pool (THREE_POSTS_AT): its glade keeps the wilds' trees and rocks off it.
  glades: [{ c: THREE_POSTS_AT.c, r: THREE_POSTS_AT.r, size: 14 }],
};

// ── The Deep Fen (32–36): lost lanterns on posts, the Knights' Causeway, the peat-cut ──────────────────────────────
export const DEEP_SECTION: ContinentDef = {
  id: MARCHES_DEEP, land: LAND, rim: RIM, title: 'The Deep Fen', ox: 8, oy: 12, townKind: 'camp', quiet: 1, fog: FOG,
  map: paint(42, 26, 'Q', 'm', [['T', 8, 12, 9, 13], ['q', 2, 2, 9, 7], ['k', 16, 16, 24, 22], ['x', 32, 3, 39, 9]]),
  roads: [
    // The Meres' gate in the west, past the Lost-Lantern Stone, south and round, up to the peat-cut in the north-east.
    [[-64, 4], [-30, 4], [2, 4], [8, 8], [50, -20], [100, -40], [150, -20], [196, -46], [176, -4], [130, 20], [90, 44], [60, 76], [120, 86], [180, 72], [230, 40], [240, 0], [236, -45]],
  ],
  places: [{ kind: 'cave', c: 236, r: -46, name: 'The Peat-Cut' }],
  names: { Q: 'The Deep Fen', q: 'The Deep Fen', k: 'The Deep Fen', x: 'The Deep Fen', m: 'The Deep Fen', T: 'The Lost-Lantern Stone' },
  mobs: { Q: { types: ['mire-lurker', 'ink-hound', 'lantern-wisp', 'drowned-knight'], chance: .6 }, q: { types: ['mire-lurker', 'ink-hound'], chance: .45 }, k: { types: ['lantern-wisp', 'mire-lurker'], chance: .4 }, x: { types: ['drowned-knight', 'ink-hound'], chance: .5 } },
  hotspots: [{ region: 'Q', chance: .3, types: ['ink-hound', 'mire-lurker', 'ink-hound'], count: 4 }],
  town: buildHummock('lost-lantern-stone'), townName: 'The Lost-Lantern Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'boardwalk', far: 'boardwalk' },
  ways: [{ place: 'cave', station: GALLERIES_IN, to: 'bog-galleries-1', arrive: 'galleries-out' }],
  seams: [seam('deep-fen-w', -45, 4, 'w', MARCHES_MERES, 'meres-e', 'WEST BOARDWALK: THE BLACK MERES')],
  stone: { id: 'marches:lost-lantern', c: 8, r: 4, name: 'The Lost-Lantern Stone' },
  marks: [
    { id: 'read:deep-wicktag', kind: 'read', c: 96, r: -34, look: 'sign', label: 'A LOST LANTERN ON A POST' },
    { id: 'sealed:deep-chapel', kind: 'sealed', c: 64, r: 80, look: 'ruin', label: 'A CHAPEL ROOF IN THE BOG' },
  ],
  camps: [{ id: 'knights-causeway', name: "The Knights' Causeway", kind: 'champion', c: 180, r: 30,
    spawns: ['drowned-knight', 'ink-hound', 'drowned-knight', 'ink-hound', 'drowned-knight', 'ink-hound'] }],
};

// ── The Drowned Ruins (37–41): the abbey town under the bog, the Witch's Island, the Lantern Ring, the crypts' door ─
export const RUINS_SECTION: ContinentDef = {
  id: MARCHES_RUINS, land: LAND, rim: RIM, title: 'The Drowned Ruins', ox: 6, oy: 12, townKind: 'camp', quiet: 1, fog: FOG,
  map: paint(44, 28, 'x', 'm', [['T', 6, 12, 7, 13], ['Q', 2, 2, 9, 8], ['k', 16, 18, 28, 25], ['Q', 34, 18, 41, 25]]),
  roads: [
    // Up the cutters' stair among the abbey's stones, past the Abbey-Slab Stone, east through the drowned town to the crypts.
    [[-20, -49], [-10, -20], [2, 4], [8, 8], [40, 50], [90, 70], [120, 40], [100, 10], [150, -10], [190, 30], [210, 70], [250, 60], [230, 10], [250, -20], [264, -36], [264, -45]],
    // A boardwalk out over the black water toward the Witch's Island.
    [[120, 40], [152, 62]],
  ],
  places: [
    { kind: 'cave', c: -20, r: -50, name: "The Cutters' Stair" },
    { kind: 'crypt', c: 264, r: -46, name: 'The Drowned Crypts' },
    { kind: 'standing-stones', c: 110, r: -40, name: 'The Lantern Ring' },
  ],
  names: { x: 'The Drowned Ruins', Q: 'The Drowned Ruins', k: 'The Drowned Ruins', m: 'The Drowned Ruins', T: 'The Abbey-Slab Stone' },
  mobs: { x: { types: ['drowned-knight', 'gloam-witch', 'ink-hound', 'drowned-knight'], chance: .6 }, Q: { types: ['mire-lurker', 'ink-hound', 'gloam-witch'], chance: .55 }, k: { types: ['lantern-wisp', 'mire-lurker'], chance: .45 } },
  hotspots: [{ region: 'x', chance: .3, types: ['drowned-knight', 'gloam-witch', 'drowned-knight'], count: 4 }],
  town: buildHummock('abbey-slab-stone'), townName: 'The Abbey-Slab Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'boardwalk', far: 'boardwalk' },
  ways: [
    { place: 'cave', station: GALLERIES_FAR_IN, to: 'bog-galleries-2', arrive: 'galleries-far' },
    { place: 'crypt', station: CRYPTS_IN, to: 'drowned-crypts-1', arrive: 'crypts-out' },
  ],
  seams: [],
  stone: { id: 'marches:abbey-slab', c: 8, r: 4, name: 'The Abbey-Slab Stone' },
  marks: [
    { id: 'read:ruins-slab', kind: 'read', c: 60, r: 64, look: 'plaque', label: 'AN ABBEY SLAB' },
    { id: 'sealed:ruins-watergate', kind: 'sealed', c: 214, r: 26, look: 'door', label: "THE ABBEY'S WATER-GATE" },
  ],
  camps: [{ id: 'witchs-island', name: "The Witch's Island", kind: 'den', c: 160, r: 72, spawns: ['gloam-witch'] }],
};

/** Every section of the Marches, by area id (td-levels CONTINENTS takes them as continents). */
export const MARCHES_SECTIONS: Readonly<Record<string, ContinentDef>> = Object.fromEntries([
  SHORE_SECTION, GLOAMHAVEN_SECTION, FEN_SECTION, BOARDWALK_SECTION, MERES_SECTION, DEEP_SECTION, RUINS_SECTION,
].map(d => [d.id, d]));
