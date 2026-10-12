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
 * Ember Delve — a mine shaft beside the ore station. Diggable terrain (see
 * engine/terrain.ts): soft dirt near the top, basalt below, hard basalt deep.
 * Cinder veins near the surface, Slag deeper (Pickaxe II, Mining 8), a
 * Heartstone seam near the bottom (Pickaxe III, Mining 20), a root curtain
 * across the first tunnel (sickle or blade), a cavern of Rivet Maws, and a
 * cracked-wall pocket only a staff's blast opens, with a Keeper's cache inside.
 */
const DELVE_COLS = 120;
const DELVE_ROWS = 40;
const DELVE_CELL = 32;
/** Top of terrain row `row`, in world y. */
const delveRow = (row: number) => FLOOR + row * DELVE_CELL;
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
  monsters: [{
    creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [1900, 2250, 2550],
    floorY: delveRow(19), range: [48 * DELVE_CELL + 40, 87 * DELVE_CELL - 40],
  }],
  drops: SEAMWORKS_DROPS,
  spawnX: 260,
  figureScale: .5,
  arrival: 'Ember Delve. Swing (J) to dig, hold Down (S) to dig below you. The lantern only reaches so far.',
  terrain: {
    seed: 0x5eed_de1e,
    cols: DELVE_COLS,
    rows: DELVE_ROWS,
    top: FLOOR,
    bands: [{ to: 5, node: 'dirt' }, { to: 17, node: 'rock' }, { to: DELVE_ROWS, node: 'hard-rock' }],
    jitter: 1.6,
    veins: [
      { node: 'cinder-vein', from: 2, to: 17, count: 22, size: 5 },
      { node: 'ember-rock', from: 6, to: 36, count: 18, size: 3 },
      { node: 'slag-vein', from: 12, to: 31, count: 14, size: 4 },
      { node: 'heartstone-vein', from: 31, to: 38, count: 3, size: 4, cols: [50, 76] },
      { node: 'petrified-trunk', from: 4, to: 24, count: 9, size: 3 },
    ],
    stamps: [
      // The entry ledge the return shaft stands on.
      { col: 0, row: 0, w: 6, h: 3, node: 'bedrock' },
      // First swing finds ore.
      { col: 10, row: 2, w: 3, h: 2, node: 'cinder-vein' },
      // An old tunnel, a root curtain across it, ore at its end.
      { col: 14, row: 6, w: 21, h: 3, node: 'air' },
      { col: 24, row: 6, w: 2, h: 3, node: 'roots' },
      { col: 35, row: 6, w: 2, h: 3, node: 'cinder-vein' },
      // Slag on the way down.
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
      // The heartstone seam, deep.
      { col: 60, row: 33, w: 3, h: 2, node: 'heartstone-vein' },
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
