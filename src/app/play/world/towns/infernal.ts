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
  hunts: [EMBER_QUARRY, HOMESTEAD],
};
