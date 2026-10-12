/**
 * The Infernal town — the Basalt Seamworks camp, widened into a town quarter.
 *
 * Layout west → east: the hearth camp (spawn, ore, material vendor, forge), the town quarter
 * (crafting bench, rune forge, enchanting table, waystone), then the safe line
 * at `safeX`; beyond it the Rivet Maws guard the beacon and the east passage
 * to Ember Quarry. This file is the template Phase 2 towns copy.
 */
import { FLOOR } from '../../engine/engine.model';
import { HOMESTEAD, HOMESTEAD_GATE } from '../homestead';
// Types only: world.model imports this file for TOWNS, so a value import back would be a cycle.
import type { HuntZoneDef, Platform, TownDef, ZoneDropTable } from '../world.model';

/** Inventory stack id of Cinder Ore (mirrors CINDER_ORE_ID in activity.model). */
export const CINDER_ORE = 'cinder-ore';

/** Today's loot as data: 8 + kills%5 coins and one Cinder Ore per Maw. */
export const SEAMWORKS_DROPS: ZoneDropTable = {
  id: 'seamworks-maw',
  entries: [
    { id: 'coins', kind: 'coins', base: 8, spread: 5 },
    { id: 'ore', kind: 'material', material: CINDER_ORE, art: CINDER_ORE, label: 'Cinder Ore', short: 'ore', qty: 1 },
  ],
};

/** The camp is widened by this much: the town quarter sits between the forge and the Maws. */
const QUARTER = 900;

const CAMP_PLATFORMS: Platform[] = [
  { x: 370, y: 500, width: 210 }, { x: 670, y: 410, width: 180 },
];
/** The original hunting-ground ledges, east of the quarter. */
const GUARD_PLATFORMS: Platform[] = [
  { x: 1000, y: 505, width: 250 }, { x: 1350, y: 430, width: 180 }, { x: 2210, y: 505, width: 180 },
];

const TOWN_WIDTH = 2700 + QUARTER;

export const EMBER_QUARRY: HuntZoneDef = {
  id: 'ember-quarry',
  name: 'Ember Quarry',
  background: 'bg-basalt-seamworks',
  width: 2700,
  platforms: [{ x: 0, y: FLOOR, width: 2700 }, ...CAMP_PLATFORMS, ...GUARD_PLATFORMS],
  stations: [
    { id: 'passage', x: 110, label: 'RETURN TO SEAMWORKS', kind: 'passage', to: 'infernal', arriveX: 2460 + QUARTER, blurb: 'The portal home to the Seamworks.' },
    { id: 'ore', x: 520, label: 'CINDER ORE', kind: 'resource', art: CINDER_ORE, blurb: 'A seam of Cinder Ore.' },
  ],
  monsters: [{ creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [1350, 1670, 1990] }],
  drops: SEAMWORKS_DROPS,
  spawnX: 240,
  arrival: 'Ember Quarry. Hunt the Maws for coins and ore. The return portal is behind you.',
};

/**
 * Ember Delve — the way down the Godforge's fracture beneath the Seamworks.
 * Diggable terrain (see engine/terrain.ts) in four biomes by depth, each a
 * lore layer:
 *
 *   Root Hollows    rows  0–11  the World-Root's shadow: roots, petrified trunks, shadow-root
 *   Basalt Caverns  rows 12–25  Kael's abandoned forge-mines: Cinder, Slag, the Maws' cavern
 *   Glowcap Grotto  rows 26–39  light seeping through the fracture: glowcaps, soft blue light
 *   Magma Halls     rows 40–55  the fracture itself: Heartstone, ember-rock, heat, tougher Maws,
 *                               and the Godforge fragment chamber guarded by a Rune-Warden
 *
 * Every player digs their own Delve: the host hands the engine a per-player
 * seed (shared/delve/delve-save.service.ts), which moves the veins and band
 * edges. Everything in `stamps` and `inscriptions` is hand-placed and fixed for
 * everyone. `seed` below is the fallback (SSR, tests, no save).
 *
 * Changing rows, bands, veins or stamps changes what a seed generates: bump
 * `version`, or every saved dig diff lands on the wrong cells. (A bumped
 * version drops old diffs rather than misapplying them.)
 */
const DELVE_COLS = 120;
const DELVE_ROWS = 56;
const DELVE_CELL = 32;
/** Top of terrain row `row`, in world y. */
const delveRow = (row: number) => FLOOR + row * DELVE_CELL;
/** Left edge of terrain column `col`, in world x. */
const delveCol = (col: number) => col * DELVE_CELL;
export const EMBER_DELVE: HuntZoneDef = {
  id: 'ember-delve',
  name: 'Ember Delve',
  background: 'bg-basalt-seamworks',
  width: DELVE_COLS * DELVE_CELL,
  // Under the bedrock: a net that never shows, and the floor every area declares.
  platforms: [{ x: 0, y: delveRow(DELVE_ROWS), width: DELVE_COLS * DELVE_CELL }],
  stations: [
    { id: 'delve-exit', x: 110, label: 'RETURN TO SEAMWORKS', kind: 'passage', to: 'infernal', arriveX: 590, width: 120, blurb: 'Climb the shaft back to the Seamworks.' },
  ],
  monsters: [
    // Basalt Caverns: the Maws' cavern.
    { creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [1900, 2250, 2550],
      floorY: delveRow(19), range: [delveCol(48) + 40, delveCol(87) - 40] },
    // Magma Halls: Maws that grew up in the heat.
    { creature: 'rivet-maw', name: 'Magma Maw', hp: 110, spawnXs: [delveCol(38), delveCol(50)],
      floorY: delveRow(49), range: [delveCol(30) + 40, delveCol(61) - 40] },
    // The fragment chamber's guardian. Stand-in art: the Mirror Substitute's painting and rig.
    { creature: 'mirror-substitute', name: 'Rune-Warden', hp: 260, spawnXs: [delveCol(100)],
      floorY: delveRow(51), range: [delveCol(92) + 30, delveCol(108) - 30] },
  ],
  drops: SEAMWORKS_DROPS,
  spawnX: 260,
  figureScale: .5,
  arrival: 'Ember Delve. Swing (J) to dig, hold Down (S) to dig below you. The lantern only reaches so far.',
  terrain: {
    seed: 0x5eed_de1e,
    version: 2,
    cols: DELVE_COLS,
    rows: DELVE_ROWS,
    top: FLOOR,
    bands: [
      { to: 5, node: 'dirt' }, { to: 12, node: 'root-loam' }, { to: 26, node: 'rock' },
      { to: 40, node: 'grotto-stone' }, { to: DELVE_ROWS, node: 'scorched-basalt' },
    ],
    jitter: 1.6,
    // Shared across the depths.
    veins: [
      { node: 'ember-rock', from: 6, to: 52, count: 22, size: 3 },
    ],
    biomes: [
      {
        id: 'root-hollows', name: 'Root Hollows', to: 12,
        wall: ['#1a130f', '#16100c', '#0a0706'], dark: '6,4,3',
        wash: { color: '#7a5a36', alpha: .08 },
        particles: { kind: 'spore', color: '#c9b27a', count: 14 },
        veins: [
          { node: 'cinder-vein', from: 2, to: 12, count: 10, size: 5 },
          { node: 'petrified-trunk', from: 3, to: 12, count: 9, size: 3 },
          { node: 'roots', from: 2, to: 12, count: 12, size: 3 },
          { node: 'shadow-root', from: 5, to: 12, count: 9, size: 2 },
        ],
      },
      {
        id: 'basalt-caverns', name: 'Basalt Caverns', to: 26,
        wall: ['#1a1115', '#160e12', '#0a0608'], dark: '5,3,9',
        wash: { color: '#b97a45', alpha: .05 },
        particles: { kind: 'ash', color: '#8a7468', count: 10 },
        veins: [
          { node: 'cinder-vein', from: 12, to: 20, count: 12, size: 5 },
          { node: 'slag-vein', from: 14, to: 26, count: 14, size: 4 },
          { node: 'hard-rock', from: 18, to: 26, count: 12, size: 6 },
        ],
      },
      {
        id: 'glowcap-grotto', name: 'Glowcap Grotto', to: 40,
        wall: ['#0f1820', '#0c141b', '#05090c'], dark: '3,7,12',
        wash: { color: '#4fa8e0', alpha: .12 },
        particles: { kind: 'mote', color: '#9fdcff', count: 22 },
        veins: [
          { node: 'glowcap', from: 27, to: 40, count: 16, size: 2 },
          { node: 'slag-vein', from: 26, to: 34, count: 6, size: 3 },
        ],
      },
      {
        id: 'magma-halls', name: 'Magma Halls', to: DELVE_ROWS,
        wall: ['#1e0d0a', '#190a08', '#0b0403'], dark: '12,3,2',
        wash: { color: '#ff5a2a', alpha: .1 },
        particles: { kind: 'ember', color: '#ff9b4f', count: 26 },
        shimmer: true,
        veins: [
          { node: 'ember-rock', from: 40, to: 54, count: 16, size: 4 },
          { node: 'hard-rock', from: 40, to: 54, count: 10, size: 5 },
          { node: 'heartstone-vein', from: 44, to: 54, count: 5, size: 4, cols: [20, 90] },
        ],
      },
    ],
    stamps: [
      // The entry ledge the return shaft stands on.
      { col: 0, row: 0, w: 6, h: 3, node: 'bedrock' },
      // First swing finds ore.
      { col: 10, row: 2, w: 3, h: 2, node: 'cinder-vein' },
      // Root Hollows: an old tunnel, a root curtain across it, ore at its end.
      { col: 14, row: 6, w: 21, h: 3, node: 'air' },
      { col: 24, row: 6, w: 2, h: 3, node: 'roots' },
      { col: 35, row: 6, w: 2, h: 3, node: 'cinder-vein' },
      // A shadow-root knot hanging from the tunnel roof: Verrin's cutting, always within reach.
      { col: 29, row: 5, w: 2, h: 1, node: 'shadow-root' },
      // An alcove further east, its own inscription inside.
      { col: 69, row: 8, w: 2, h: 3, node: 'air' },
      // Basalt Caverns: slag on the way down.
      { col: 40, row: 20, w: 3, h: 2, node: 'slag-vein' },
      // The Maws' cavern: a bedrock floor so it stays a cavern.
      { col: 48, row: 14, w: 39, h: 5, node: 'air' },
      { col: 47, row: 19, w: 41, h: 1, node: 'bedrock' },
      { col: 50, row: 18, node: 'ember-rock' }, { col: 62, row: 13, node: 'ember-rock' }, { col: 74, row: 18, node: 'ember-rock' }, { col: 84, row: 14, node: 'ember-rock' },
      // The sealed pocket: cracked walls round a hollow, the cache on its floor.
      { col: 100, row: 21, w: 7, h: 5, node: 'cracked-wall' },
      { col: 101, row: 22, w: 5, h: 3, node: 'air' },
      { col: 103, row: 24, node: 'cache' },
      { col: 99, row: 23, node: 'ember-rock' },
      // Glowcap Grotto: a cavern lit from below, glowcaps along its floor.
      { col: 20, row: 30, w: 25, h: 5, node: 'air' },
      { col: 20, row: 35, w: 25, h: 1, node: 'grotto-stone' },
      { col: 23, row: 34, node: 'glowcap' }, { col: 29, row: 34, node: 'glowcap' }, { col: 36, row: 34, node: 'glowcap' }, { col: 42, row: 34, node: 'glowcap' },
      { col: 87, row: 35, w: 2, h: 3, node: 'air' },
      // Magma Halls: the Magma Maws' hall on a bedrock floor.
      { col: 30, row: 44, w: 31, h: 5, node: 'air' },
      { col: 29, row: 49, w: 33, h: 1, node: 'bedrock' },
      { col: 64, row: 47, w: 3, h: 2, node: 'heartstone-vein' },
      // The fragment chamber: a bedrock floor, the Rune-Warden, the fragment at the back wall.
      { col: 92, row: 46, w: 16, h: 5, node: 'air' },
      { col: 91, row: 51, w: 18, h: 1, node: 'bedrock' },
      // One cell: each cell pays its yield, and there is one fragment per player.
      { col: 106, row: 50, node: 'godforge-fragment' },
    ],
    // Two per biome; ids and placeholder text live in shared/delve/delve-lore.model.ts.
    inscriptions: [
      { id: 'roots-inverse-tree', col: 19, row: 7 },
      { id: 'roots-keepers-tally', col: 69, row: 9 },
      { id: 'basalt-kaels-mark', col: 66, row: 16 },
      { id: 'basalt-sealed-pocket', col: 102, row: 23 },
      { id: 'grotto-light-through-the-crack', col: 32, row: 32 },
      { id: 'grotto-drowned-lamp', col: 87, row: 36 },
      { id: 'magma-the-fracture', col: 44, row: 46 },
      { id: 'magma-warden-oath', col: 96, row: 49 },
    ],
    bedrock: 2,
  },
};

export const INFERNAL_TOWN: TownDef = {
  id: 'infernal',
  realm: 'infernal',
  name: 'Basalt Seamworks',
  background: 'bg-basalt-seamworks',
  width: TOWN_WIDTH,
  platforms: [
    { x: 0, y: FLOOR, width: TOWN_WIDTH }, ...CAMP_PLATFORMS,
    // The first guard ledge would hang over the waystone; the quarter keeps open ground.
    ...GUARD_PLATFORMS.slice(1).map(p => ({ ...p, x: p.x + QUARTER })),
  ],
  stations: [
    { id: 'ore', x: 480, label: 'CINDER ORE', kind: 'resource', art: CINDER_ORE, width: 130, blurb: 'Mine Cinder Ore from the seam.' },
    { id: 'delve', x: 590, label: 'EMBER DELVE', kind: 'passage', to: 'ember-delve', arriveX: 260, width: 90, blurb: 'A mine shaft into the rock under the Seamworks. Dig for ore.' },
    { id: 'vendor', x: 705, label: 'MATERIAL VENDOR', kind: 'panel', panel: 'vendor', art: 'trade-complete', width: 130, blurb: 'Buy expedition materials for Gold; crates go to the forge stockpile.' },
    { id: 'forge', x: 930, label: 'SEAMWORKS FORGE', kind: 'quest', width: 120, blurb: 'Forge and equip the Basalt Edge.' },
    { id: 'crafting', x: 1220, label: 'CRAFTING BENCH', kind: 'panel', panel: 'crafting', art: 'iron-hammer', width: 170, blurb: 'Strike gathered materials into gear.' },
    { id: 'runes', x: 1500, label: 'RUNE FORGE', kind: 'panel', panel: 'runes', art: 'rune-of-cinder', width: 170, blurb: 'Gamble Gold on the anvil for runes.' },
    { id: 'enchanting', x: 1780, label: 'ENCHANTING TABLE', kind: 'panel', panel: 'enchanting', art: 'enchantment-active', width: 170, blurb: 'Socket runes into gear and brew infusions.' },
    { id: 'waystone', x: 2010, label: 'WAYSTONE', kind: 'waystone', art: 'rift-portal-core', width: 130, blurb: 'Travel between the realm towns.' },
    { id: 'beacon', x: 2320 + QUARTER, label: 'ECLIPSE BEACON', kind: 'quest', width: 100, requires: 'guardian', lockedMessage: 'Defeat a Rivet Maw before repairing the beacon.', blurb: 'Rekindle the beacon once a Maw falls.' },
    { id: 'passage', x: 2580 + QUARTER, label: 'EAST PASSAGE', kind: 'passage', to: 'ember-quarry', arriveX: 240, width: 120, requires: 'beacon', lockedMessage: 'Restore the beacon to open the eastern passage.', blurb: 'The road east to Ember Quarry.' },
    // The Homestead gate: the Keeper's own plot, where the idle economy stands as buildings.
    HOMESTEAD_GATE,
  ],
  monsters: [{ creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [1350 + QUARTER, 1670 + QUARTER, 1990 + QUARTER] }],
  drops: SEAMWORKS_DROPS,
  spawnX: 160,
  safeX: 1100 + QUARTER,
  scenery: 'seamworks-hub',
  arrival: 'Returned to Seamworks. Explore freely or head out for another hunt.',
  hunts: [EMBER_QUARRY, HOMESTEAD, EMBER_DELVE],
};
