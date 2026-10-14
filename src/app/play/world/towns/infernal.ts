/**
 * The Infernal town — the Basalt Seamworks camp, widened into a town quarter.
 *
 * Layout west → east: the hearth camp (spawn, ore, material vendor, forge), the town quarter
 * (crafting bench, rune forge, enchanting table, waystone), then the safe line
 * at `safeX`; beyond it the Rivet Maws guard the beacon and the east passage
 * to Ember Quarry. This file is the template Phase 2 towns copy.
 */
import { FLOOR } from '../../engine/engine.model';
import { WARDEN_FLAG } from '../../engine/terrain';
import { HOMESTEAD, HOMESTEAD_GATE } from '../homestead';
// Types only: world.model imports this file for TOWNS, so a value import back would be a cycle.
import type { GatherNodeDef, HuntZoneDef, Platform, TownDef, ZoneDropTable } from '../world.model';

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

/**
 * The Delve's two named creatures, from the creature atlas (canon proposal,
 * eclipse-realms-creature-atlas-proposal.md, Infernal). Their drops are drawn
 * from the atlas lines and the Delve's own materials:
 *  - Cinder Bailiff, "walks work routes and stamps heat debts onto shortcuts":
 *    the heat it collects (Ember Residue, now and then Infernal Heartstone).
 *  - Seam Eater, "colossal serpentine mass of cooled slag, broken braces, and
 *    molten interior channels": slag, residue and the heartstone of its
 *    channels. It falls once per player.
 */
export const CINDER_BAILIFF_DROPS: ZoneDropTable = {
  id: 'delve-cinder-bailiff',
  entries: [
    { id: 'coins', kind: 'coins', base: 16, spread: 8 },
    { id: 'ore', kind: 'material', material: CINDER_ORE, art: CINDER_ORE, label: 'Cinder Ore', short: 'ore', qty: 1 },
    { id: 'residue', kind: 'material', material: 'ember-residue', art: 'ember-residue', label: 'Ember Residue', short: 'residue', qty: 1, chance: 0.35, rarity: 'uncommon' },
    { id: 'heartstone', kind: 'material', material: 'infernal-heartstone', art: 'infernal-heartstone', label: 'Infernal Heartstone', short: 'heart', qty: 1, chance: 0.05, rarity: 'legendary' },
  ],
};
export const SEAM_EATER_DROPS: ZoneDropTable = {
  id: 'delve-seam-eater',
  entries: [
    { id: 'coins', kind: 'coins', base: 60, spread: 20 },
    { id: 'slag', kind: 'material', material: 'slag-fragment', art: 'slag-fragment', label: 'Slag Fragment', short: 'slag', qty: 4 },
    { id: 'residue', kind: 'material', material: 'ember-residue', art: 'ember-residue', label: 'Ember Residue', short: 'residue', qty: 2, rarity: 'uncommon' },
    { id: 'heartstone', kind: 'material', material: 'infernal-heartstone', art: 'infernal-heartstone', label: 'Infernal Heartstone', short: 'heart', qty: 1, rarity: 'legendary' },
  ],
};

/**
 * The Drowned Lamp (Phase 6, delve-and-beyond.md §7.4): "a lampfish the size
 * of a cart that dims every light in the cavern". It rises from the Grotto
 * Mere to a night cast with Glowcap bait once the Archivist has read its
 * carving, falls once per player, and leaves the light it was hoarding.
 */
export const DROWNED_LAMP_DROPS: ZoneDropTable = {
  id: 'delve-drowned-lamp',
  entries: [
    { id: 'coins', kind: 'coins', base: 40, spread: 12 },
    { id: 'oil', kind: 'material', material: 'lampfish-oil', art: 'lampfish-oil', label: 'Lampfish Oil', short: 'oil', qty: 3, rarity: 'uncommon' },
    { id: 'glowcap', kind: 'material', material: 'glowcap', art: 'glowcap', label: 'Glowcap', short: 'cap', qty: 2 },
  ],
};
/** The flag it sets (the same string as delve-missions.model's DROWNED_LAMP_FLAG; a spec pins them). */
export const DROWNED_LAMP_FLAG = 'drowned-lamp-defeated';

/**
 * The Underhearth's creatures (Phase 8, delve-and-beyond.md §2.2; lore-addendum.md,
 * "The Four Who Went Down", bestiary lines):
 *  - Banked Ember: "Cold until struck. Every blow releases heat it took from
 *    somewhere else" — the heat it gives up (Ember Residue).
 *  - Ironwood Sentinel: "One of the four pillars left standing" — its wood.
 *  - The Banked Furnace: "a promise kept so long it forgot who it was kept
 *    for" — what it was banking: Emberheart Ore, its slag, ironwood.
 */
export const BANKED_EMBER_DROPS: ZoneDropTable = {
  id: 'delve-banked-ember',
  entries: [
    { id: 'coins', kind: 'coins', base: 20, spread: 8 },
    { id: 'residue', kind: 'material', material: 'ember-residue', art: 'ember-residue', label: 'Ember Residue', short: 'residue', qty: 1, chance: 0.5, rarity: 'uncommon' },
  ],
};
export const IRONWOOD_SENTINEL_DROPS: ZoneDropTable = {
  id: 'delve-ironwood-sentinel',
  entries: [
    { id: 'coins', kind: 'coins', base: 40, spread: 12 },
    { id: 'ironwood', kind: 'material', material: 'ironwood', art: 'ironwood', label: 'Ironwood', short: 'wood', qty: 2, rarity: 'uncommon' },
  ],
};
export const BANKED_FURNACE_DROPS: ZoneDropTable = {
  id: 'delve-banked-furnace',
  entries: [
    { id: 'coins', kind: 'coins', base: 120, spread: 30 },
    { id: 'emberheart', kind: 'material', material: 'emberheart-ore', art: 'emberheart-ore', label: 'Emberheart Ore', short: 'ore', qty: 3, rarity: 'rare' },
    { id: 'ironwood', kind: 'material', material: 'ironwood', art: 'ironwood', label: 'Ironwood', short: 'wood', qty: 2, rarity: 'uncommon' },
    { id: 'slag', kind: 'material', material: 'godforge-slag', art: 'godforge-slag', label: 'Godforge Slag', short: 'slag', qty: 1, chance: 0.5, rarity: 'legendary' },
  ],
};
/** The flag the Banked Furnace sets on its first fall (the same string as shared/delve/underhearth.model's FURNACE_FLAG; a spec pins them). */
export const BANKED_FURNACE_FLAG = 'banked-furnace-defeated';

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

/**
 * What grows and stands in the Quarry between the seam and the Maws. Same
 * rule as the Delve (tool + tier, then the skill level): a fresh Keeper can
 * cut the starlight tuft and fell the scorched trunk with the starter kit;
 * the slag outcrop wants a Pickaxe II and Mining 8, like a Delve slag vein.
 */
export const EMBER_QUARRY_NODES: readonly GatherNodeDef[] = [
  { id: 'starlight-tuft', x: 340, kind: 'herb', label: 'Starlight Herb tuft', tools: { sickle: 1 }, hp: 1, discipline: 'foraging', xp: 2, minLevel: 1,
    yield: { materialId: 'starlight-herb', qty: 1 }, respawn: 25 },
  { id: 'scorched-trunk', x: 720, kind: 'wood', label: 'Scorched World-Root trunk', tools: { axe: 1 }, hp: 3, discipline: 'woodcutting', xp: 4, minLevel: 1,
    yield: { materialId: 'world-root-bark', qty: 1, chance: .6 }, respawn: 35 },
  { id: 'slag-outcrop', x: 920, kind: 'ore', label: 'Slag outcrop', tools: { pickaxe: 2 }, hp: 4, discipline: 'mining', xp: 5, minLevel: 8,
    yield: { materialId: 'slag-fragment', qty: 1 }, respawn: 45 },
];

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
  nodes: EMBER_QUARRY_NODES,
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
 *   Magma Halls     rows 40–55  the fracture itself: Heartstone, ember-rock, heat, Cinder Bailiffs,
 *                               and the Godforge fragment chamber guarded by a Seam Eater
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
/** The world's rows with the Underhearth (Phase 8): rows 56-117 under every column, bedrock 118-119. */
const DEEP_ROWS = 120;
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
  // Under the world's floor (the Underhearth's bedrock): a net that never shows, and the floor every area declares.
  platforms: [{ x: 0, y: delveRow(DEEP_ROWS), width: DELVE_COLS * DELVE_CELL }],
  stations: [
    { id: 'delve-exit', x: 110, label: 'RETURN TO SEAMWORKS', kind: 'passage', to: 'infernal', arriveX: 590, width: 120, blurb: 'Climb the shaft back to the Seamworks.' },
  ],
  monsters: [
    // Basalt Caverns: the Maws' cavern.
    { creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [1900, 2250, 2550],
      floorY: delveRow(19), range: [delveCol(48) + 40, delveCol(87) - 40] },
    // Magma Halls: Cinder Bailiffs walk the hall's work routes (creature atlas).
    // Own art key; until it is painted `artFor` shows the Rivet Maw (art.ts ART_ALIAS).
    { creature: 'cinder-bailiff', name: 'Cinder Bailiff', hp: 110, spawnXs: [delveCol(38), delveCol(50)],
      floorY: delveRow(49), range: [delveCol(30) + 40, delveCol(61) - 40], drops: CINDER_BAILIFF_DROPS },
    // The fragment chamber's guardian: the Seam Eater, the atlas's boss-scale
    // Infernal creature, risen "from the deepest failed repairs". Until it is
    // painted it wears the Mirror Substitute's painting (art.ts ART_ALIAS) and rig.
    // Felled once per player: it never rises again, and its fall unseals the fragment.
    { creature: 'seam-eater', name: 'Seam Eater', hp: 260, spawnXs: [delveCol(100)],
      floorY: delveRow(51), range: [delveCol(92) + 30, delveCol(108) - 30], once: WARDEN_FLAG, drops: SEAM_EATER_DROPS },
    // The Grotto Mere's keeper: summoned by a night cast, veiled in its own dark.
    { creature: 'drowned-lamp', name: 'The Drowned Lamp', hp: 180, spawnXs: [delveCol(32)], floorY: delveRow(35),
      range: [delveCol(20) + 30, delveCol(45) - 30], once: DROWNED_LAMP_FLAG, summoned: true, veiled: true, drops: DROWNED_LAMP_DROPS },
    // The Underhearth (Phase 8). The two hall creatures spawn only in the halls the
    // generator lays (engine/underhearth-gen.ts), from these defs: no fixed spawns.
    { creature: 'banked-ember', name: 'Banked Ember', hp: 140, spawnXs: [], trait: 'dormant', drops: BANKED_EMBER_DROPS },
    { creature: 'ironwood-sentinel', name: 'Ironwood Sentinel', hp: 320, spawnXs: [], trait: 'shoulder', drops: IRONWOOD_SENTINEL_DROPS },
    // The Banked Furnace in the Furnace Hall under the core: summoned at its hearth with
    // the Four Hammer-Marks, felled once for the story, then once a day for its drops.
    { creature: 'banked-furnace', name: 'The Banked Furnace', hp: 900, spawnXs: [delveCol(68) + 16], floorY: delveRow(110),
      range: [delveCol(68) + 16, delveCol(68) + 16], once: BANKED_FURNACE_FLAG, summoned: true, rematch: true, trait: 'furnace', drops: BANKED_FURNACE_DROPS },
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
    // Phase 7: sectors are generated east and west of this grid, forever (engine/sector-gen.ts).
    // The grid itself is untouched: no `version` bump.
    endless: true,
    // Phase 8: the Underhearth under every column (engine/underhearth-gen.ts), rows 56-117.
    // The grid above is untouched but for the Banked seal through the fragment chamber's
    // floor, which only the endless world lays: no `version` bump, nobody's dig is dropped.
    depth: {
      rows: DEEP_ROWS,
      biomes: [{
        id: 'underhearth', name: 'The Underhearth', to: DEEP_ROWS,
        // Style guide §5.3, the Underhearth ramps: iron black, obsidian, ember seams.
        wall: ['#1c1420', '#241a28', '#0e0a12'], dark: '4,2,6',
        wash: { color: '#c4501e', alpha: .1 },
        particles: { kind: 'ember', color: '#ffd08a', count: 18 },
        shimmer: true,
        // The fallen roof is cracked through: the Ironwood Sentinels bring it down.
        loose: { node: 'iron-basalt', chance: .18 },
        veins: [],
      }],
    },
    // Shared across the depths.
    veins: [
      { node: 'ember-rock', from: 6, to: 52, count: 22, size: 3 },
    ],
    biomes: [
      {
        id: 'root-hollows', name: 'Root Hollows', to: 12,
        wall: ['#3c2b1e', '#34251a', '#1a110b'], dark: '6,4,3',
        wash: { color: '#6a8a3a', alpha: .08 },
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
        wall: ['#302b32', '#29252b', '#141216'], dark: '5,3,9',
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
        wall: ['#163444', '#122c3a', '#08161e'], dark: '3,7,12',
        wash: { color: '#4fa8e0', alpha: .12 },
        particles: { kind: 'mote', color: '#9fdcff', count: 22 },
        veins: [
          { node: 'glowcap', from: 27, to: 40, count: 16, size: 2 },
          { node: 'slag-vein', from: 26, to: 34, count: 6, size: 3 },
        ],
      },
      {
        id: 'magma-halls', name: 'Magma Halls', to: DELVE_ROWS,
        wall: ['#3e1812', '#35140f', '#1a0806'], dark: '12,3,2',
        wash: { color: '#ff5a2a', alpha: .1 },
        particles: { kind: 'ember', color: '#ff9b4f', count: 26 },
        shimmer: true,
        // The fracture's roof is cracked through: about one cell in five of
        // scorched basalt is loose. Derived from a fixed hash, not generated.
        loose: { node: 'scorched-basalt', chance: .2 },
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
      // Kael's old cache at the cavern's east end: his lost hammer (once per player).
      // Placed in a cell every seed already carves to air, so no saved diff can
      // name it: `version` stays put and nobody's dig is dropped.
      { col: 85, row: 18, node: 'kaels-cache', protect: true },
      // The sealed pocket: cracked walls round a hollow, the cache on its floor.
      // Protected: a blasting charge never opens what only a staff should.
      { col: 100, row: 21, w: 7, h: 5, node: 'cracked-wall', protect: true },
      { col: 101, row: 22, w: 5, h: 3, node: 'air' },
      { col: 103, row: 24, node: 'cache', protect: true },
      { col: 99, row: 23, node: 'ember-rock' },
      // Glowcap Grotto: a cavern lit from below, glowcaps along its floor.
      { col: 20, row: 30, w: 25, h: 5, node: 'air' },
      { col: 20, row: 35, w: 25, h: 1, node: 'grotto-stone' },
      { col: 23, row: 34, node: 'glowcap' }, { col: 29, row: 34, node: 'glowcap' }, { col: 36, row: 34, node: 'glowcap' }, { col: 42, row: 34, node: 'glowcap' },
      { col: 87, row: 35, w: 2, h: 3, node: 'air' },
      // Magma Halls: the Cinder Bailiffs' hall on a bedrock floor.
      { col: 30, row: 44, w: 31, h: 5, node: 'air' },
      { col: 29, row: 49, w: 33, h: 1, node: 'bedrock' },
      { col: 64, row: 47, w: 3, h: 2, node: 'heartstone-vein' },
      // The fragment chamber: a bedrock floor, the Seam Eater, the fragment at the back wall.
      { col: 92, row: 46, w: 16, h: 5, node: 'air' },
      { col: 91, row: 51, w: 18, h: 1, node: 'bedrock' },
      // One cell: each cell pays its yield, and there is one fragment per player.
      { col: 106, row: 50, node: 'godforge-fragment', protect: true },
    ],
    // A charge cannot open the fragment chamber (walls, roof) until its warden falls.
    sealed: [{ col: 90, row: 44, w: 20, h: 8, flag: WARDEN_FLAG }],
    // Three per biome; ids and one-line readings live in shared/delve/delve-lore.model.ts.
    // Each sits in a cell a stamp carves to air for every seed, so no saved dig
    // can name it and `version` stays put.
    inscriptions: [
      { id: 'roots-inverse-tree', col: 19, row: 7 },
      { id: 'roots-keepers-tally', col: 69, row: 9 },
      { id: 'basalt-kaels-mark', col: 66, row: 16 },
      { id: 'basalt-sealed-pocket', col: 102, row: 23 },
      { id: 'grotto-light-through-the-crack', col: 32, row: 32 },
      { id: 'grotto-drowned-lamp', col: 87, row: 36 },
      { id: 'magma-the-fracture', col: 44, row: 46 },
      { id: 'magma-warden-oath', col: 96, row: 49 },
      // Beside the shadow-root knot in the old tunnel, where Verrin's cutting grows.
      { id: 'roots-cutting-mark', col: 28, row: 7 },
      // The Maws' cavern, east of Kael's mark: the old seam's ledger.
      { id: 'basalt-seam-ledger', col: 78, row: 16 },
      // The glowcap cavern, over the caps someone used to sell.
      { id: 'grotto-tally-marks', col: 40, row: 32 },
      // The deepest open cell in the Delve, at the fragment chamber's floor.
      { id: 'magma-unsigned', col: 102, row: 50 },
    ],
    bedrock: 2,
    // Lakes and pools (Phase 6.2): liquid laid only into cells the stamps above
    // already carve to air for every seed, so no cell changes, `version` stays
    // at 2 and nobody's dig is dropped. Each is at rest as generated (a level
    // step of 2 or less never spreads), so it sleeps until a dig wakes it.
    liquidVersion: 1,
    liquids: [
      // Root Hollows: a rain-seep puddle in the alcove floor, under the Keepers' tally.
      { col: 69, row: 10, w: 2, liquid: 'water', level: 4 },
      // Basalt Caverns: Kael's flooded seam, the sealed pocket's floor (round the cache).
      { col: 101, row: 23, w: 5, h: 2, liquid: 'water' },
      // Glowcap Grotto: the Grotto Mere, two cells deep across the glowcap cavern; the caps glow under it.
      { col: 20, row: 33, w: 25, h: 2, liquid: 'water' },
      // The drowned lamp's alcove: the carving is under the water now ("the last mark is under the surface").
      { col: 87, row: 36, w: 2, h: 2, liquid: 'water' },
      // Magma Halls: two lava pools on the Bailiffs' hall floor, shallow at their rims.
      { col: 31, row: 48, liquid: 'lava', level: 2 }, { col: 32, row: 48, w: 3, liquid: 'lava', level: 4 }, { col: 35, row: 48, liquid: 'lava', level: 2 },
      { col: 54, row: 48, liquid: 'lava', level: 2 }, { col: 55, row: 48, w: 3, liquid: 'lava', level: 4 }, { col: 58, row: 48, liquid: 'lava', level: 2 },
    ],
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
    // West of the seam, by the camp: the first stop when the satchel fills. (The spec's x≈1075 is the Homestead gate.)
    { id: 'vault', x: 330, label: 'THE VAULT', kind: 'panel', panel: 'vault', art: 'artifacts', width: 100, blurb: 'Keep what you do not carry. A full satchel sends things here; the benches still use them.' },
    { id: 'ore', x: 480, label: 'CINDER ORE', kind: 'resource', art: CINDER_ORE, width: 130, blurb: 'Mine Cinder Ore from the seam.' },
    { id: 'delve', x: 590, label: 'EMBER DELVE', kind: 'passage', to: 'ember-delve', arriveX: 260, width: 90, blurb: 'A mine shaft into the rock under the Seamworks. Dig for ore.' },
    { id: 'vendor', x: 705, label: 'MATERIAL VENDOR', kind: 'panel', panel: 'vendor', art: 'trade-complete', width: 130, blurb: 'Sell surplus materials for a little Gold. The Vendor buys; it does not sell.' },
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
