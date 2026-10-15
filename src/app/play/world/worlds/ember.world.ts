/**
 * ember.world.ts — the Ember world (One World P1, docs/design/one-world.md §2):
 * the Ember Delve with the Basalt Seamworks built on its surface.
 *
 * The Delve keeps every row it has (rows ≥ 0, byte for byte: the core, the
 * wings, the Underhearth, the Rift Gates). Over it, the sky band (rows −32…−1,
 * surface-gen.ts) holds the settlement as buildings made of cells, in the old
 * town's order so muscle memory carries over (§2.3):
 *
 *   cols  −8…−4  the arch to the Homestead (temporary, P1)
 *   cols   1…5   the mine head over the core's entry ledge
 *   cols   6…15  the Vault                cols 17…19  the Cinder seam (the `ore` station)
 *   cols  21…30  the Material Vendor      cols 33…46  the Seamworks Forge (a chimney)
 *   cols  47…62  the square: the town stone (col 50), the Hearth fire (54), its benches
 *   cols −44…−39 the pond, a raised basin in the Plot
 *   cols  63…74  the Crafting Bench       cols 75…86  the Rune Forge   cols 87…98  the Enchanting Table
 *   cols 111…115 the Eclipse Beacon       cols 120…124 the arch to Ember Quarry (temporary, P1; opens on the beacon)
 *   sector 4…5   the Rivet Maws on the Quarry Road (the onboarding beat: a Maw, the beacon, the arch)
 *   sector 7     the Quarry Head stone, the first stone lit by hand
 *
 * Every station keeps its id, panel and blurb (`?at=`, the place banner,
 * found-in, first goals); only its x moves to its counter's column. A station's
 * y is the street (row 0's top edge, FLOOR), so reach is unchanged.
 *
 * Working names (lore pre-approved, docs/world/lore-addendum.md): the Quarry
 * Road, the Plot, the Ember Wilds, the Quarry Head stone.
 */
import { FLOOR } from '../../engine/engine.model';
import { INFERNAL_PALETTE } from '../../engine/blueprints';
import { counterCol, type StoneDef, type SurfaceBuilding, type SurfaceSpec } from '../../engine/surface-gen';
import type { BiomeDef } from '../../engine/terrain';
import { CINDER_ORE, EMBER_DELVE, EMBER_QUARRY, INFERNAL_TOWN, SEAMWORKS_DROPS } from '../towns/infernal';
import { HOMESTEAD, HOMESTEAD_GATE_ID } from '../homestead';
import { UMBRAL_DELVE } from '../towns/umbral-delve';
import { VERDANT_DELVE } from '../towns/verdant-delve';
import { LUMINOUS_DELVE } from '../towns/luminous-delve';
import { CELESTIAL_DELVE } from '../towns/celestial-delve';
import type { AreaDef, HuntZoneDef, MonsterDef, StationDef, TownDef } from '../world.model';

const CELL = 32;
/** A column's centre in world x. */
const colX = (col: number) => col * CELL + CELL / 2;

/** The Ember world's surface look: basalt ash on the hills, the realm's dark (style guide §5.1). */
export const EMBER_SURFACE_BIOME: BiomeDef = {
  id: 'ember-surface', name: '', to: 0,
  wall: ['#3a2b2d', '#33262a', '#1a1214'], dark: '5,3,9',
  wash: { color: '#000000', alpha: 0 },
  particles: { kind: 'ash', color: '#8a7468', count: 6 },
  veins: [],
};

/** The buildings, west to east. `station` names the counter's station. */
export const EMBER_BUILDINGS: readonly SurfaceBuilding[] = [
  { kind: 'arch', col: -8, station: HOMESTEAD_GATE_ID },
  { kind: 'mine-head', col: 1, station: 'delve' },
  { kind: 'shop', col: 6, station: 'vault' },
  { kind: 'shop', col: 21, station: 'vendor' },
  { kind: 'forge', col: 33, station: 'forge' },
  // The pond: a raised stone basin in the Plot, off the street (a basin on the street is a wade).
  { kind: 'basin', col: -44 },
  { kind: 'shop-wide', col: 63, station: 'crafting' },
  { kind: 'shop-wide', col: 75, station: 'runes' },
  { kind: 'shop-wide', col: 87, station: 'enchanting' },
  { kind: 'beacon-tower', col: 111, station: 'beacon' },
  { kind: 'arch', col: 120, station: 'passage' },
];

/** The square's features (cols): the trunk line's stone, the Hearth fire, its benches. */
export const EMBER_SQUARE = { stone: 50, hearth: 54, benches: [52, 56] as readonly number[] };
/** The Quarry Head stone: the far end of the Quarry Road, sector 7. */
export const QUARRY_HEAD_COL = 7 * 32 + 16;

export const EMBER_STONES: readonly StoneDef[] = [
  { id: 'ember:town', kind: 'town', world: 'ember', col: EMBER_SQUARE.stone, row: 0, trunk: true },
  { id: 'ember:quarry-head', kind: 'region', world: 'ember', col: QUARRY_HEAD_COL, row: 0 },
];

export const EMBER_SURFACE: SurfaceSpec = {
  world: 'ember',
  rowLo: -32,
  ground: 0,
  salt: 0x0e3b_e57c,
  palette: INFERNAL_PALETTE,
  // Sectors −4…7: the Plot, the settlement, the Quarry Road and its stone. The wilds run on from there.
  flat: [-128, 256],
  buildings: EMBER_BUILDINGS,
  // The basin's water: four cells of still water between the rims (the settlement's pond).
  liquids: [{ col: -43, row: -1, w: 4, liquid: 'water' }],
  stones: EMBER_STONES,
  regions: [
    { id: 'the-plot', name: 'The Plot', sx0: -4, sx1: -1 },
    { id: 'basalt-seamworks', name: 'Basalt Seamworks', sx0: 0, sx1: 3 },
    { id: 'quarry-road', name: 'Quarry Road', sx0: 4, sx1: 7 },
  ],
  wilds: { id: 'ember-wilds', name: 'The Ember Wilds' },
  underground: { id: 'ember-delve', name: 'Ember Delve' },
  biome: EMBER_SURFACE_BIOME,
  square: EMBER_SQUARE,
};

/** The x of a building's counter, or of its middle when it has none (the arches, the tower). */
function stationX(id: string): number {
  const b = EMBER_BUILDINGS.find(row => row.station === id);
  if (!b) throw new Error(`No building for station ${id}`);
  const counter = counterCol(b);
  if (counter !== null) return colX(counter);
  const w = { arch: 5, 'mine-head': 5, 'beacon-tower': 5 }[b.kind as 'arch' | 'mine-head' | 'beacon-tower'] ?? 4;
  return b.col * CELL + (w * CELL) / 2;
}

/** The town's stations by id (labels, panels, blurbs and locks), moved to their counters. */
const TOWN = new Map(INFERNAL_TOWN.stations.map(s => [s.id, s]));
function moved(id: string, patch: Partial<StationDef> = {}): StationDef {
  const base = TOWN.get(id);
  if (!base) throw new Error(`Unknown Infernal station ${id}`);
  return { ...base, x: stationX(id), y: FLOOR, width: 96, ...patch };
}

/** The arch's x (east): where the Keeper steps back out of the old Quarry. */
export const EAST_ARCH_X = stationX('passage');
export const WEST_ARCH_X = stationX(HOMESTEAD_GATE_ID);

/** Every station of the Seamworks, in the world (west to east). */
export const EMBER_WORLD_STATIONS: readonly StationDef[] = [
  moved(HOMESTEAD_GATE_ID, { label: 'YOUR HOMESTEAD', blurb: 'An arch to your own plot (for now; it moves into the world next).' }),
  // The mine head stands over the Delve's entry ledge: the Delve is under your feet. At it, a camp or an anchor is a descent.
  moved('delve', { label: 'MINE HEAD', blurb: 'The headframe over the Delve\'s entry ledge. Dig down beside it; descend to your camp from here.' }),
  moved('vault'),
  { ...TOWN.get('ore')!, x: colX(18), y: FLOOR, width: 96 },
  moved('vendor'),
  moved('forge'),
  // The trunk line's stone: `?at=waystone` still lands here, and E opens the Travel map.
  { ...TOWN.get('waystone')!, x: colX(EMBER_SQUARE.stone), y: FLOOR, width: 64, label: 'TOWN STONE', blurb: 'Sera\'s trunk line: always lit. Travel to any stone you have lit, or to another realm\'s town.' },
  moved('crafting'),
  moved('runes'),
  moved('enchanting'),
  moved('beacon'),
  moved('passage', { label: 'ARCH TO EMBER QUARRY', blurb: 'An arch to the old Quarry road (for now; it becomes the Quarry next).' }),
];

/** Where a fresh Keeper stands: beside the town stone (§3.3 "spawns at the Seamworks town stone"). */
export const EMBER_SPAWN_X = colX(EMBER_SQUARE.stone) + 72;

/**
 * The Rivet Maws on the Quarry Road (P1): the onboarding beat keeps its shape:
 * a Maw falls, the beacon is rekindled, the arch to the old Quarry opens.
 * They stand in their stretch of road (`range`), on the street.
 */
const ROAD_MAWS: MonsterDef = { creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [4260, 4560, 4860], floorY: FLOOR, range: [4140, 5080] };
/** Where Glim's "Show me" walks for the first hunt: just short of the first Maw on the road. */
export const ROAD_MAW_APPROACH_X = 4080;

/** The Ember world: the Delve, its surface, the Seamworks on it. Area id stays the Delve's (its save, its missions). */
export const EMBER_WORLD: HuntZoneDef = {
  ...EMBER_DELVE,
  world: 'ember',
  stations: EMBER_WORLD_STATIONS,
  monsters: [ROAD_MAWS, ...EMBER_DELVE.monsters],
  drops: SEAMWORKS_DROPS,
  spawnX: EMBER_SPAWN_X,
  arrival: 'The Basalt Seamworks. The Delve is under your feet; the stone in the square takes you anywhere you have lit.',
  terrain: { ...EMBER_DELVE.terrain!, surface: EMBER_SURFACE },
};

/** The old Quarry and the Homestead, their way home pointed at the arches (P1; P2 makes them regions). */
const QUARRY_BY_ARCH: HuntZoneDef = {
  ...EMBER_QUARRY,
  stations: EMBER_QUARRY.stations.map(s => s.kind === 'passage' ? { ...s, to: EMBER_WORLD.id, arriveX: EAST_ARCH_X } : s),
};
const HOMESTEAD_BY_ARCH: HuntZoneDef = {
  ...HOMESTEAD,
  stations: HOMESTEAD.stations.map(s => s.kind === 'passage' ? { ...s, to: EMBER_WORLD.id, arriveX: WEST_ARCH_X } : s),
};

/**
 * The Infernal town under the One World gate: the same town (id, name, realm),
 * whose home IS the Ember world. Its stations are the world's, so a deep link
 * and the Places list name the same counters the Keeper walks to.
 */
export const INFERNAL_WORLD_TOWN: TownDef = {
  ...INFERNAL_TOWN,
  home: EMBER_WORLD.id,
  stations: EMBER_WORLD_STATIONS,
  spawnX: EMBER_SPAWN_X,
  monsters: [],
  safeX: 0,
  hunts: [EMBER_WORLD, QUARRY_BY_ARCH, HOMESTEAD_BY_ARCH, UMBRAL_DELVE, VERDANT_DELVE, LUMINOUS_DELVE, CELESTIAL_DELVE],
};
