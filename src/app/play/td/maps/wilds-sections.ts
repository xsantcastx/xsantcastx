/**
 * wilds-sections.ts — the Verdant Wilds as an act (S11; docs/design/world-acts.md §1.3, §2.3, §5.3; canon §3.4b, §8.3):
 * seven section areas and Rootglass, joined by walked seams and by the Root Hollows, now the connector under the Deep
 * Wilds. Each section is a ContinentDef of its own, so the room runs it as its own area. Drawn as the Reach is
 * (reach-sections.ts `paint`, `blocks`): one character per 8×8 tiles, two blocks of the wood's own wall of vine and root
 * round every section (`rim: 'vinewall'`: the land's edge here is the jungle grown solid, not rock).
 *
 *  Mossharbor (on the Mossy Shore) ──north road── the Fernglades (Thornwick on its east road; its west road to
 *  ROOTGLASS) ──the ford road── the Rootwater Ford (its east path to the Glassmere, a dead end) ──north road── the
 *  Greenwood (the road to the Deep Wilds grown shut with a thorn hedge) ──root-hole── (the Root Hollows −1, −2, −3 and
 *  the root-ramp) ── the Deep Wilds ──east road── the Sunken Courts (the Overgrown Temple's gate).
 *
 * Region legend: ',' the mossy shore · '.' the Fernglades (grass and flowers; a glade) · 'j' the Greenwood (jungle) ·
 * 'J' the Deep Wilds (dense jungle) · 'r' the Rootwater · 'l' the Glassmere · 'u' the Sunken Courts · 'm' the wood's
 * wall · '~' the Verdant Sea · 'T' the town or Waystone camp.
 */
import type { StationDef } from '../../world/world.model';
import type { ContinentDef } from '../continent';
import { buildTown } from '../town-builder';
import type { TdMap } from '../seamworks-square';
import { CAMP_ROWS, blocks, paint, seam } from './reach-sections';
import { MOSSHARBOR_ISLE_SHIP, MOSSHARBOR_SHIP, buildMossharbor, buildRootglass, buildThornwick } from './verdant-wilds';
import { HOLLOWS_IN, RAMP_IN } from './root-hollows';
import { TEMPLE_IN } from './overgrown-temple';

/** The Storm-Struck Oak's tile in the Greenwood (S10's world boss, the Antlered Storm, rises there). */
export const STORM_OAK_AT = { c: -10, r: -112 } as const;

/** Sunny Pell's third ship, off the long pier's east end: to Mirewatch, the Umbral Marches (end of Act II). */
export const MOSSHARBOR_MARCHES_SHIP: StationDef = { id: 'ship-mossharbor-marches', x: 0, label: 'SHIP TO MIREWATCH', kind: 'passage', blurb: 'A low fen-barge with a lantern at its prow, bound for Mirewatch in the Umbral Marches.' };

export const WILDS_SHORE = 'verdant-wilds-shore';
export const WILDS_ROOTGLASS = 'verdant-wilds-rootglass';
export const WILDS_FERNGLADES = 'verdant-wilds-fernglades';
export const WILDS_ROOTWATER = 'verdant-wilds-rootwater';
export const WILDS_GLASSMERE = 'verdant-wilds-glassmere';
export const WILDS_GREENWOOD = 'verdant-wilds-greenwood';
export const WILDS_DEEP = 'verdant-wilds-deep-wilds';
export const WILDS_COURTS = 'verdant-wilds-courts';
const LAND = 'verdant-wilds';
/** The wood's edge: vine and root grown into a wall (td-art 'vinewall'), the Overgrown Temple's own. */
const RIM = 'vinewall' as const;

/**
 * A Waystone grove (world-acts.md §0): safe ground round the stone, a rootglass lamp, a bench. `twins`: the Copy-Tree
 * Stone stands between two identical trees (canon §8.3: "two identical trees side by side, one slightly wrong").
 */
const buildGrove = (id: string, twins = false) => (): TdMap => buildTown({
  id, rows: CAMP_ROWS, legend: { '.': 'dirt', g: 'moss' }, houses: [], stalls: [],
  props: [
    { kind: 'waystone', c: 8, r: 4 }, { kind: 'rootlamp', c: 10, r: 6 }, { kind: 'bench', c: 6, r: 6 }, { kind: 'signpost', c: 12, r: 8 },
    { kind: 'fern', c: 2, r: 2 }, { kind: 'fern', c: 13, r: 9 },
    // The town builder seeds a jungle tree by its tile (c·7 + r·3): (5, 3) and (11, 3) come out the same tree.
    ...(twins ? [{ kind: 'jungle' as const, c: 5, r: 3 }, { kind: 'jungle' as const, c: 11, r: 3 }] : []),
  ],
  spawn: { c: 8, r: 7 },
});

// ── The Mossy Shore (15–17): Mossharbor's landing ────────────────────────────────────────────────────────────────
export const SHORE_SECTION: ContinentDef = {
  id: WILDS_SHORE, land: LAND, rim: RIM, title: 'The Mossy Shore', ox: 8, oy: 8, townKind: 'camp', quiet: 1,
  map: paint(36, 22, ',', 'm', [['T', 8, 8, 9, 9], ['j', 2, 2, 7, 9], ['j', 28, 2, 33, 10], ['.', 12, 3, 20, 7], ['.', 22, 12, 27, 15], ['~', 0, 19, 35, 21]]),
  roads: [
    // Mossharbor's boardwalk street north, east along the dunes, back past the Net Stone, then north to the Fernglades.
    [[79, 72], [79, 62], [110, 56], [150, 60], [182, 40], [172, 8], [130, -2], [90, 20], [50, 30], [20, 18], [8, 8], [8, -2], [-12, -16], [-30, -32], [0, -40], [40, -28], [70, -36], [100, -36], [100, -62]],
  ],
  places: [], names: { ',': 'The Mossy Shore', '.': 'The Mossy Shore', j: 'The Mossy Shore', m: 'The Mossy Shore', T: 'The Net Stone', '~': 'The Verdant Sea' },
  mobs: { ',': { types: ['canopy-bat', 'moss-stalker'], chance: .25 }, j: { types: ['moss-stalker', 'canopy-bat'], chance: .4 }, '.': { types: ['canopy-bat'], chance: .25 } },
  town: buildGrove('net-stone'), townName: 'The Net Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'sand' },
  ways: [],
  villages: [
    // Sunny Pell's pier: the sloop to Pyrehold (tile 15, 16), the ketch the long way to Ember Harbour (8, 16), and the
    // fen-barge to Mirewatch (22, 12), held until the Elder Rootwyrm falls (td-harbour ACT_GATES_ENFORCED).
    { name: 'Mossharbor', c: 64, r: 72, build: buildMossharbor, ways: [
      { station: MOSSHARBOR_SHIP, c: 15, r: 16, to: 'infernal-reach-pyrehold', arrive: 'ship-verdant', ship: true },
      { station: MOSSHARBOR_ISLE_SHIP, c: 8, r: 16, to: 'ember-isle', arrive: 'ship-isle-verdant', ship: true },
      { station: MOSSHARBOR_MARCHES_SHIP, c: 22, r: 12, to: 'umbral-marches-shore', arrive: 'ship-mirewatch', ship: true },
    ] },
  ],
  seams: [seam('shore-n', 100, -46, 'n', WILDS_FERNGLADES, 'fernglades-s', 'NORTH ROAD: THE FERNGLADES')],
  stone: { id: 'wilds:net', c: 8, r: 4, name: 'The Net Stone' },
  marks: [
    { id: 'read:shore-netpost', kind: 'read', c: 140, r: 66, look: 'sign', label: 'A NET-DRYING POST' },
    { id: 'sealed:shore-hull', kind: 'sealed', c: -20, r: 60, look: 'ruin', label: 'A MOSS-GROWN HULL' },
  ],
};

// ── Rootglass (safe): the capital in the canopy, its boardwalks over the marsh ─────────────────────────────────────
export const ROOTGLASS_SECTION: ContinentDef = {
  id: WILDS_ROOTGLASS, land: LAND, rim: RIM, title: 'Rootglass', ox: 4, oy: 4,
  map: paint(13, 11, 'j', 'm', [['T', 4, 4, 9, 8]]),
  roads: [[[40, 18], [72, 18]]],
  places: [], names: { T: 'Rootglass', j: 'Rootglass', m: 'Rootglass' },
  mobs: {},
  town: buildRootglass, townName: 'Rootglass', streets: { row: 18, col: 23 }, river: false, roadGround: { near: 'plank', far: 'plank' },
  ways: [],
  seams: [seam('rootglass-e', 52, 18, 'e', WILDS_FERNGLADES, 'fernglades-w', 'EAST BOARDWALK: THE FERNGLADES')],
  stone: { id: 'wilds:rootglass', c: 20, r: 15, name: 'The Boardwalk Stone' },
  marks: [
    { id: 'read:rootglass-lamproll', kind: 'read', c: 14, r: -7, look: 'plaque', label: "THE LAMPLIGHTERS' ROLL" },
    { id: 'sealed:rootglass-rootdoor', kind: 'sealed', c: 34, r: -7, look: 'door', label: 'A DOOR IN THE ROOTS' },
  ],
};

// ── The Fernglades (15–17): the act's moor, Thornwick, the Moss Altar ───────────────────────────────────────────────
export const FERNGLADES_SECTION: ContinentDef = {
  id: WILDS_FERNGLADES, land: LAND, rim: RIM, title: 'The Fernglades', ox: 20, oy: 12, townKind: 'camp', quiet: 1,
  map: paint(40, 24, '.', 'm', [['T', 20, 12, 21, 13], ['j', 2, 2, 9, 8], ['j', 30, 2, 37, 9], ['j', 3, 16, 8, 21]]),
  roads: [
    // The through-road: the Shore's gate in the south, west round the glades, past the Bell-Post Stone, to the ford road.
    [[4, 96], [4, 70], [-30, 60], [-80, 64], [-120, 40], [-110, 10], [-60, 20], [-20, 14], [8, 8], [8, -6], [-30, -20], [-70, -36], [-100, -58], [-60, -70], [-20, -54], [20, -40], [52, -52], [52, -96]],
    // The west road to Rootglass, and the east road to Thornwick (a hamlet at the road's end).
    [[-70, -36], [-110, -44], [-160, -44]],
    [[8, 8], [40, 22], [70, 18], [101, 18]],
  ],
  places: [{ kind: 'shrine', c: -40, r: 44, name: 'The Moss Altar' }],
  names: { '.': 'The Fernglades', j: 'The Fernglades', m: 'The Fernglades', T: 'The Bell-Post Stone' },
  mobs: { '.': { types: ['canopy-bat', 'moss-stalker'], chance: .3 }, j: { types: ['moss-stalker', 'canopy-bat', 'vine-lasher'], chance: .45 } },
  hotspots: [{ region: '.', chance: .15, types: ['canopy-bat', 'moss-stalker'], count: 3 }],
  town: buildGrove('bell-post-stone'), townName: 'The Bell-Post Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [],
  villages: [{ name: 'Thornwick', c: 100, r: 10, build: buildThornwick }],
  seams: [
    seam('fernglades-s', 4, 78, 's', WILDS_SHORE, 'shore-n', 'SOUTH ROAD: THE MOSSY SHORE'),
    seam('fernglades-w', -142, -44, 'w', WILDS_ROOTGLASS, 'rootglass-e', 'WEST ROAD: ROOTGLASS'),
    seam('fernglades-n', 52, -78, 'n', WILDS_ROOTWATER, 'rootwater-s', 'THE FORD ROAD: THE ROOTWATER', 'ford'),
  ],
  stone: { id: 'wilds:bell-post', c: 8, r: 4, name: 'The Bell-Post Stone' },
  marks: [
    { id: 'read:fern-bellpost', kind: 'read', c: 60, r: -10, look: 'sign', label: "A PRIESTS' BELL-POST" },
    { id: 'sealed:fern-bellhouse', kind: 'sealed', c: -60, r: -6, look: 'door', label: 'A GROWN-OVER BELL-HOUSE' },
  ],
};

// ── The Rootwater Ford (16–18): the river crossing, the Drowned Aqueduct ────────────────────────────────────────────
export const ROOTWATER_SECTION: ContinentDef = {
  id: WILDS_ROOTWATER, land: LAND, rim: RIM, title: 'The Rootwater Ford', ox: 20, oy: 20, townKind: 'camp', quiet: 1,
  map: paint(40, 24, '.', 'm', [['T', 20, 20, 21, 21], ['r', 2, 11, 37, 11], ['j', 2, 2, 12, 9], ['j', 28, 2, 37, 8], ['j', 27, 14, 36, 19]]),
  roads: [
    // The Fernglades' gate in the south, west along the bank, over the Rootwater on the planks, north to the Greenwood.
    [[52, 32], [52, 6], [20, 10], [8, 8], [-30, 0], [-80, -14], [-120, -34], [-100, -52], [-60, -54], [-60, -84], [-20, -96], [30, -86], [60, -108], [20, -126], [-44, -122], [-44, -160]],
    // The east path to the Glassmere.
    [[30, -86], [90, -90], [160, -90]],
  ],
  places: [{ kind: 'ruins', c: 100, r: -30, name: 'The Drowned Aqueduct' }],
  names: { '.': 'The Rootwater Ford', j: 'The Rootwater Ford', r: 'The Rootwater', m: 'The Rootwater Ford', T: 'The Plank Stone' },
  mobs: { '.': { types: ['canopy-bat', 'moss-stalker'], chance: .35 }, j: { types: ['moss-stalker', 'vine-lasher', 'canopy-bat'], chance: .5 } },
  hotspots: [{ region: 'j', chance: .25, types: ['moss-stalker', 'vine-lasher'], count: 3 }],
  town: buildGrove('plank-stone'), townName: 'The Plank Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [],
  seams: [
    seam('rootwater-s', 52, 14, 's', WILDS_FERNGLADES, 'fernglades-n', 'THE FORD ROAD: THE FERNGLADES', 'ford'),
    seam('rootwater-e', 142, -90, 'e', WILDS_GLASSMERE, 'glassmere-w', 'MERE PATH: THE GLASSMERE'),
    seam('rootwater-n', -44, -142, 'n', WILDS_GREENWOOD, 'greenwood-s', 'NORTH ROAD: THE GREENWOOD'),
  ],
  stone: { id: 'wilds:plank', c: 8, r: 4, name: 'The Plank Stone' },
  marks: [
    { id: 'read:ford-depthpost', kind: 'read', c: -66, r: -48, look: 'sign', label: 'A DEPTH POST' },
    { id: 'sealed:ford-sluice', kind: 'sealed', c: 108, r: -22, look: 'ruin', label: 'A ROOT-CHOKED SLUICE' },
  ],
};

// ── The Glassmere (16–18): still water, fishing, a dead end ─────────────────────────────────────────────────────────
export const GLASSMERE_SECTION: ContinentDef = {
  id: WILDS_GLASSMERE, land: LAND, rim: RIM, title: 'The Glassmere', ox: 8, oy: 10, townKind: 'camp', quiet: 1,
  map: paint(32, 22, 'j', 'm', [['T', 8, 10, 9, 11], ['l', 14, 4, 26, 15], ['.', 2, 14, 7, 19]]),
  roads: [[[-64, 4], [-30, 4], [8, 6], [30, -24], [40, -60], [100, -62], [150, -60], [168, -20], [164, 40], [150, 64], [100, 64], [50, 62], [30, 40]]],
  places: [], names: { j: 'The Glassmere', '.': 'The Glassmere', l: 'The Glassmere', m: 'The Glassmere', T: 'The Mere Stone' },
  mobs: { j: { types: ['moss-stalker', 'canopy-bat'], chance: .4 }, '.': { types: ['canopy-bat'], chance: .25 } },
  town: buildGrove('mere-stone'), townName: 'The Mere Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [],
  seams: [seam('glassmere-w', -46, 4, 'w', WILDS_ROOTWATER, 'rootwater-e', 'MERE PATH: THE ROOTWATER FORD')],
  stone: { id: 'wilds:mere', c: 8, r: 4, name: 'The Mere Stone' },
  marks: [
    { id: 'read:mere-tally', kind: 'read', c: 120, r: 69, look: 'sign', label: "A FISHER'S TALLY" },
    { id: 'sealed:mere-cave', kind: 'sealed', c: 160, r: -52, look: 'cave', label: 'A ROOT-SEALED CAVE' },
  ],
};

// ── The Greenwood (17–20): the copied trees, the Weaver Canopy, the thorn hedge, the Root Hollows' mouth ────────────
/** The Walking Tree's glade (world-acts.md §5.3; td-night-events NIGHT_PLACES.walker): its true twin stands here. */
export const WALKER_GLADE = { c: 64, r: -64 } as const;
export const GREENWOOD_SECTION: ContinentDef = {
  id: WILDS_GREENWOOD, land: LAND, rim: RIM, title: 'The Greenwood', ox: 8, oy: 20, townKind: 'camp', quiet: 1,
  map: paint(42, 26, 'j', 'm', [['T', 8, 20, 9, 21], ['.', 14, 10, 17, 13], ['.', 2, 14, 5, 18]]),
  roads: [
    // The Ford's gate in the south, west under the copied trees, north and east to the root-hole of the Root Hollows.
    [[36, 48], [36, 22], [10, 10], [-24, -14], [-30, -56], [10, -90], [60, -100], [100, -96], [150, -70], [140, -30], [180, -10], [230, -40], [228, -112]],
    // The old road north to the Deep Wilds: grown shut with thorns where it enters the wood's wall.
    [[100, -96], [100, -120], [100, -160]],
  ],
  places: [
    { kind: 'cave', c: 228, r: -118, name: 'The Root Hollows' },
    // S10: the Storm-Struck Oak, the Greenwood's oldest tree, split by the first thunderstorm after the Lock; the Antlered
    // Storm rises here in a thunderstorm (world-bosses.ts STORM_OAK_AT). Its 10-tile ring of stumps stands in a clearing
    // off the road, clear of the Copied Pair's glade and the Weaver Canopy.
    { kind: 'storm-oak', c: STORM_OAK_AT.c, r: STORM_OAK_AT.r, name: 'The Storm-Struck Oak' },
  ],
  names: { j: 'The Greenwood', '.': 'The Greenwood', m: 'The Greenwood', T: 'The Copy-Tree Stone' },
  mobs: { j: { types: ['canopy-bat', 'moss-stalker', 'moss-stalker', 'vine-lasher'], chance: .6 }, '.': { types: ['canopy-bat'], chance: .3 } },
  hotspots: [{ region: 'j', chance: .3, types: ['moss-stalker', 'canopy-bat', 'moss-stalker'], count: 4 }],
  town: buildGrove('copy-tree-stone', true), townName: 'The Copy-Tree Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [{ place: 'cave', station: HOLLOWS_IN, to: 'root-hollows-1', arrive: 'hollows-out' }],
  seams: [seam('greenwood-s', 36, 30, 's', WILDS_ROOTWATER, 'rootwater-n', 'SOUTH ROAD: THE ROOTWATER FORD')],
  stone: { id: 'wilds:copy-tree', c: 8, r: 4, name: 'The Copy-Tree Stone' },
  marks: [
    { id: 'read:hedge-cairn', kind: 'read', c: 106, r: -134, look: 'plaque', label: 'A CAIRN BY THE THORNS' },
    // The thorn hedge (world-acts.md §1.3): grown across the road's cut from its mouth six rows deep, so its last rows
    // stand between the wood's wall however ragged the wall's face (regionAt's wobble); no blade cuts it.
    { id: 'sealed:thorn-hedge', kind: 'sealed', c: 100, r: -145, look: 'hedge', label: 'THE THORN HEDGE', span: { w: 2, rows: 6, dir: -1 } },
  ],
  camps: [{ id: 'weaver-canopy', name: 'The Weaver Canopy', kind: 'den', c: 190, r: -92, spawns: ['thorn-weaver'] }],
  // The copied pair in its glade: the true tree, and the copy that walks (the night event draws and moves it).
  trees: [{ c: WALKER_GLADE.c - 3, r: WALKER_GLADE.r, seed: 2 }],
  glades: [{ c: WALKER_GLADE.c, r: WALKER_GLADE.r, size: 14 }],
};

// ── The Deep Wilds (21–25): noon is dusk; the Hart Meadow; up out of the Heartroot Cellar ──────────────────────────
export const DEEP_SECTION: ContinentDef = {
  id: WILDS_DEEP, land: LAND, rim: RIM, title: 'The Deep Wilds', ox: 8, oy: 14, townKind: 'camp', quiet: 1,
  // Noon is dusk under the old canopy (canon §8.3): the light never climbs past a dusk's (S11 part 2).
  dim: .42,
  map: paint(44, 28, 'J', 'm', [['T', 8, 14, 9, 15], ['j', 2, 2, 7, 8], ['.', 24, 18, 29, 22], ['j', 34, 2, 41, 7]]),
  roads: [
    // From the root-ramp among the giant roots, down past the Heartroot Stone, east through the deep wood to the Courts.
    [[-20, -54], [-30, -20], [8, 6], [40, -30], [80, -70], [130, -50], [110, -10], [80, 30], [100, 80], [150, 92], [200, 60], [230, 20], [250, 12], [290, 12]],
  ],
  places: [{ kind: 'cave', c: -20, r: -60, name: 'The Root-Ramp' }],
  names: { J: 'The Deep Wilds', j: 'The Deep Wilds', '.': 'The Deep Wilds', m: 'The Deep Wilds', T: 'The Heartroot Stone' },
  mobs: {
    J: { types: ['vine-lasher', 'moss-stalker', 'rootglass-hart', 'thorn-weaver'], chance: .6 },
    j: { types: ['moss-stalker', 'canopy-bat'], chance: .45 },
  },
  hotspots: [{ region: 'J', chance: .4, types: ['thorn-weaver', 'vine-lasher', 'moss-stalker'], count: 5 }],
  town: buildGrove('heartroot-stone'), townName: 'The Heartroot Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [{ place: 'cave', station: RAMP_IN, to: 'root-hollows-3', arrive: 'hollows3-ramp' }],
  seams: [seam('deep-wilds-e', 270, 12, 'e', WILDS_COURTS, 'courts-w', 'EAST ROAD: THE SUNKEN COURTS')],
  stone: { id: 'wilds:heartroot', c: 8, r: 4, name: 'The Heartroot Stone' },
  marks: [
    { id: 'read:deep-lantern-hook', kind: 'read', c: 64, r: -56, look: 'sign', label: 'A LANTERN HOOK IN A TRUNK' },
    { id: 'sealed:deep-spore-mouth', kind: 'sealed', c: 200, r: -40, look: 'cave', label: 'A SPORE-CHOKED HOLLOW' },
  ],
  camps: [{ id: 'hart-meadow', name: 'The Hart Meadow', kind: 'champion', c: 150, r: 50,
    spawns: ['rootglass-hart', 'rootglass-hart', 'moss-stalker', 'rootglass-hart', 'moss-stalker', 'rootglass-hart'] }],
};

// ── The Sunken Courts (24–28): the moss-priests' ruins, the Bell-less Square, the Ring of Thorns, the temple's gate ─
export const COURTS_SECTION: ContinentDef = {
  id: WILDS_COURTS, land: LAND, rim: RIM, title: 'The Sunken Courts', ox: 6, oy: 12, townKind: 'camp', quiet: 1,
  map: paint(40, 26, 'u', 'm', [['T', 6, 12, 7, 13], ['J', 2, 2, 8, 8], ['J', 2, 18, 8, 23], ['J', 30, 18, 37, 23]]),
  roads: [
    // The Deep Wilds' gate in the west, through the courts, up to the Overgrown Temple's stepped gate.
    [[-48, 4], [-20, 4], [8, 6], [40, 30], [80, 10], [110, 40], [170, 30], [200, 0], [190, -30], [228, -34], [230, -32]],
  ],
  places: [
    { kind: 'temple', c: 230, r: -40, name: 'The Overgrown Temple' },
    { kind: 'standing-stones', c: 120, r: 72, name: 'The Ring of Thorns' },
  ],
  names: { u: 'The Sunken Courts', J: 'The Sunken Courts', m: 'The Sunken Courts', T: 'The Pillar Stone' },
  mobs: { u: { types: ['thorn-weaver', 'vine-lasher', 'canopy-bat'], chance: .6 }, J: { types: ['vine-lasher', 'moss-stalker'], chance: .5 } },
  hotspots: [{ region: 'u', chance: .35, types: ['thorn-weaver', 'vine-lasher'], count: 4 }],
  town: buildGrove('pillar-stone'), townName: 'The Pillar Stone', streets: { row: 6, col: 8 }, river: false, roadGround: { near: 'dirt', far: 'dirt' },
  ways: [{ place: 'temple', station: TEMPLE_IN, to: 'overgrown-temple-1', arrive: 'temple-out' }],
  seams: [seam('courts-w', -30, 4, 'w', WILDS_DEEP, 'deep-wilds-e', 'WEST ROAD: THE DEEP WILDS')],
  stone: { id: 'wilds:pillar', c: 8, r: 4, name: 'The Pillar Stone' },
  marks: [
    { id: 'read:courts-moss', kind: 'read', c: 60, r: -30, look: 'plaque', label: 'MOSS IN STRAIGHT LINES' },
    { id: 'sealed:courts-bellframe', kind: 'sealed', c: 104, r: -62, look: 'ruin', label: 'A BELL-FRAME TAKEN BY VINES' },
  ],
  camps: [{ id: 'bell-less-square', name: 'The Bell-less Square', kind: 'camp', c: 150, r: -40,
    spawns: ['vine-lasher', 'vine-lasher', 'vine-lasher', 'vine-lasher', 'vine-lasher', 'vine-lasher', 'moss-stalker', 'moss-stalker', 'sporecap', 'sporecap', 'sporecap'] }],
};

/** Every section of the Wilds, by area id (td-levels CONTINENTS takes them as continents). */
export const WILDS_SECTIONS: Readonly<Record<string, ContinentDef>> = Object.fromEntries([
  SHORE_SECTION, ROOTGLASS_SECTION, FERNGLADES_SECTION, ROOTWATER_SECTION, GLASSMERE_SECTION, GREENWOOD_SECTION, DEEP_SECTION, COURTS_SECTION,
].map(d => [d.id, d]));
