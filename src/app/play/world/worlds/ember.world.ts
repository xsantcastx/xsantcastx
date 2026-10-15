/**
 * ember.world.ts — the Ember world (One World, docs/design/one-world.md §2):
 * the Ember Delve with the Basalt Seamworks built on its surface, the Ember
 * Quarry east of it and the Keeper's Homestead west of it (P2).
 *
 * The Delve keeps every row it has (rows ≥ 0, byte for byte: the core, the
 * wings, the Underhearth, the Rift Gates). Over it, the sky band (rows −32…−1,
 * surface-gen.ts) holds, west → east:
 *
 *   sectors −4…−1  YOUR HOMESTEAD (the Plot): the pond (cols −60…−55), the plot's buildings and the
 *                  Home Forge drawn at the world's scale (homestead-render.ts), its stations by id (`hs-*`)
 *   sectors  0…3   the BASALT SEAMWORKS, buildings made of cells, in the old town's order (§2.3):
 *                    cols   1…5   the mine head over the core's entry ledge
 *                    cols   6…15  the Vault          cols 17…19  the Cinder seam (the `ore` station)
 *                    cols  21…30  the Material Vendor cols 33…46  the Seamworks Forge (a chimney)
 *                    cols  47…62  the square: the town stone (col 50), the Hearth fire (54), its benches
 *                    cols  63…98  the Crafting Bench, the Rune Forge, the Enchanting Table
 *                    cols 111…115 the Eclipse Beacon
 *   sector   4     the QUARRY ROAD: the Rivet Maws roam it, just outside the town (the onboarding beat)
 *   cols 160…164   the QUARRY GATE: a gatehouse; its portcullis lifts when the beacon burns again (§2.4)
 *   sectors  5…7   the EMBER QUARRY: its gathering nodes, its Maws, the High Roads over it in cells
 *                  (blueprints.ts HIGH_ROADS, cols 178…234), and the Quarry Head stone (col 240)
 *   beyond         the Ember Wilds, both ways, forever
 *
 * Every station keeps its id, panel and blurb (`?at=`, found-in, first goals);
 * only its x moves to its counter's column. The region ids are the old area
 * ids where there was one ('homestead', 'ember-quarry'), so Glim's "visit every
 * area" quest, the first goals and the Homestead's column read them unchanged.
 *
 * Working names (lore pre-approved, docs/world/lore-addendum.md): the Quarry
 * Road, the Quarry Gate, the Ember Wilds, the Quarry Head stone.
 */
import { FLOOR } from '../../engine/engine.model';
import { HIGH_ROADS, HIGH_ROADS_SIZE, INFERNAL_PALETTE } from '../../engine/blueprints';
import { counterCol, type StoneDef, type SurfaceBuilding, type SurfaceSpec } from '../../engine/surface-gen';
import type { BiomeDef } from '../../engine/terrain';
import { EMBER_DELVE, EMBER_QUARRY_NODES, INFERNAL_TOWN, SEAMWORKS_DROPS } from '../towns/infernal';
import { HOME_FORGE_STATIONS, HOMESTEAD_BUILDINGS } from '../homestead';
import { HUNT_HEIGHTS, type AreaHeights, type HeightFind } from '../heights';
import { UMBRAL_DELVE } from '../towns/umbral-delve';
import { VERDANT_DELVE } from '../towns/verdant-delve';
import { LUMINOUS_DELVE } from '../towns/luminous-delve';
import { CELESTIAL_DELVE } from '../towns/celestial-delve';
import type { GatherNodeDef, HuntZoneDef, MonsterDef, StationDef, TownDef } from '../world.model';

const CELL = 32;
/** A column's centre in world x. */
const colX = (col: number) => col * CELL + CELL / 2;
/** The feet y of a surface `up` rows over the street (Ember's ground is row 0: its top is FLOOR). */
const upY = (up: number) => FLOOR - up * CELL;

/** The Ember world's surface look: basalt ash on the hills, the realm's dark (style guide §5.1). */
export const EMBER_SURFACE_BIOME: BiomeDef = {
  id: 'ember-surface', name: '', to: 0,
  wall: ['#3a2b2d', '#33262a', '#1a1214'], dark: '5,3,9',
  wash: { color: '#000000', alpha: 0 },
  particles: { kind: 'ash', color: '#8a7468', count: 6 },
  veins: [],
};

/** The Quarry Gate's left column (§2.4): the end of the Quarry Road, the start of the Quarry. */
export const QUARRY_GATE_COL = 160;
/** The High Roads' west end (blueprints.ts HIGH_ROADS: 57 columns over the Quarry). */
export const HIGH_ROADS_COL = 178;

/** The buildings, west to east. `station` names the counter's station. */
export const EMBER_BUILDINGS: readonly SurfaceBuilding[] = [
  // The Homestead's pond: a raised stone basin at the plot's west end (a basin on the street is a wade).
  { kind: 'basin', col: -60 },
  { kind: 'mine-head', col: 1, station: 'delve' },
  { kind: 'shop', col: 6, station: 'vault' },
  { kind: 'shop', col: 21, station: 'vendor' },
  { kind: 'forge', col: 33, station: 'forge' },
  { kind: 'shop-wide', col: 63, station: 'crafting' },
  { kind: 'shop-wide', col: 75, station: 'runes' },
  { kind: 'shop-wide', col: 87, station: 'enchanting' },
  { kind: 'beacon-tower', col: 111, station: 'beacon' },
  { kind: 'quarry-gate', col: QUARRY_GATE_COL },
  { kind: 'high-roads', col: HIGH_ROADS_COL },
];

/** The Quarry Gate's bars, as world cells (the engine lifts them when the beacon burns). Rows −3…−1. */
export const QUARRY_GATE_BARS: readonly { col: number; row: number }[] =
  Array.from({ length: 15 }, (_, i) => ({ col: QUARRY_GATE_COL + (i % 5), row: -1 - Math.floor(i / 5) }));

/** The square's features (cols): the trunk line's stone, the Hearth fire, its benches. */
export const EMBER_SQUARE = { stone: 50, hearth: 54, benches: [52, 56] as readonly number[] };
/** The Quarry Head stone: the far end of the Ember Quarry, sector 7. */
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
  // Sectors −4…7: the Homestead, the settlement, the Quarry Road, the Quarry and its stone. The wilds run on from there.
  flat: [-128, 256],
  buildings: EMBER_BUILDINGS,
  // The pond's water: four cells of still water between the basin's rims.
  liquids: [{ col: -59, row: -1, w: 4, liquid: 'water' }],
  stones: EMBER_STONES,
  regions: [
    { id: 'homestead', name: 'Your Homestead', sx0: -4, sx1: -1 },
    { id: 'basalt-seamworks', name: 'Basalt Seamworks', sx0: 0, sx1: 3 },
    { id: 'quarry-road', name: 'Quarry Road', sx0: 4, sx1: 4 },
    { id: 'ember-quarry', name: 'Ember Quarry', sx0: 5, sx1: 7 },
  ],
  wilds: { id: 'ember-wilds', name: 'The Ember Wilds' },
  underground: { id: 'ember-delve', name: 'Ember Delve' },
  biome: EMBER_SURFACE_BIOME,
  square: EMBER_SQUARE,
  gate: QUARRY_GATE_BARS,
};

/** The x of a building's counter, or of its middle when it has none (the mine head, the tower). */
function stationX(id: string): number {
  const b = EMBER_BUILDINGS.find(row => row.station === id);
  if (!b) throw new Error(`No building for station ${id}`);
  const counter = counterCol(b);
  if (counter !== null) return colX(counter);
  return b.col * CELL + (5 * CELL) / 2;
}

/** The town's stations by id (labels, panels, blurbs and locks), moved to their counters. */
const TOWN = new Map(INFERNAL_TOWN.stations.map(s => [s.id, s]));
function moved(id: string, patch: Partial<StationDef> = {}): StationDef {
  const base = TOWN.get(id);
  if (!base) throw new Error(`Unknown Infernal station ${id}`);
  return { ...base, x: stationX(id), y: FLOOR, width: 96, ...patch };
}

/**
 * The Homestead at the world's scale (§2.2 "The Plot"): its layout is the old
 * area's (homestead.ts), drawn half size from `PLOT_X` (homestead-render.ts
 * `setWorldPlacement`), so a building at plot x stands at PLOT_X + x / 2.
 */
export const PLOT_X = -1700;
export const PLOT_SCALE = .5;
export const plotX = (x: number) => PLOT_X + x * PLOT_SCALE;
const PLOT_STATIONS: readonly StationDef[] = [...HOMESTEAD_BUILDINGS, ...HOME_FORGE_STATIONS]
  .map(s => ({ ...s, x: plotX(s.x), y: FLOOR, width: Math.round((s.width ?? 120) * PLOT_SCALE) }));

/** Every station of the world, west to east: the Homestead's, then the Seamworks'. */
export const EMBER_WORLD_STATIONS: readonly StationDef[] = [
  ...PLOT_STATIONS,
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
  moved('beacon', { blurb: 'Rekindle the beacon once a Maw falls: its light lifts the Quarry Gate.' }),
];

/** Where a fresh Keeper stands: beside the town stone (§3.3 "spawns at the Seamworks town stone"). */
export const EMBER_SPAWN_X = colX(EMBER_SQUARE.stone) + 72;

/**
 * The Rivet Maws on the Quarry Road (sector 4): the onboarding beat keeps its
 * shape: a Maw falls, the beacon is rekindled, the Quarry Gate lifts. They
 * keep to their stretch of road (`range`), west of the gate.
 */
const ROAD_MAWS: MonsterDef = { creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [4260, 4560, 4860], floorY: FLOOR, range: [4140, 5080] };
/** Where Glim's "Show me" walks for the first hunt: just short of the first Maw on the road. */
export const ROAD_MAW_APPROACH_X = 4080;

// ── The Ember Quarry (§2.2 "the hunt region", P2) ──

/** The Quarry's own Maws, under the High Roads (the old area's three, east of the gate). */
const QUARRY_MAWS: MonsterDef = { creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [6560, 6960, 7360], floorY: FLOOR, range: [6420, 7480] };

/** The Quarry's nodes at world columns 166…176 (the same ids: the harvest save and the found-in lines). */
const QUARRY_NODE_COLS: Readonly<Record<string, number>> = {
  'starlight-tuft': 166, 'scorched-trunk': 169, 'eclipse-glass': 171, 'slag-outcrop': 173, moonwake: 175,
};
export const EMBER_QUARRY_WORLD_NODES: readonly GatherNodeDef[] = EMBER_QUARRY_NODES.map(n => ({ ...n, x: colX(QUARRY_NODE_COLS[n.id] ?? 176) }));

/** A High Roads piece's world column span [west, east) and its top's feet y. */
const piece = (p: { dx: number; w?: number; top: number }) => ({ x0: (HIGH_ROADS_COL + p.dx) * CELL, x1: (HIGH_ROADS_COL + p.dx + (p.w ?? 1)) * CELL, y: upY(p.top) });

/**
 * The High Roads over the Quarry, in cells (blueprints.ts lays them): the same
 * find ids, rewards and texts as the old route (heights.ts 'ember-quarry'),
 * stood on the cells' tops. The route's collision is the terrain's; `solids`,
 * `trees` and `ledges` are empty here.
 */
function emberHighRoads(): AreaHeights {
  const old = HUNT_HEIGHTS['ember-quarry'];
  const R = HIGH_ROADS, shelf = piece(R.shelf), ruin = piece(R.ruin), mesa = piece(R.mesa), block = piece(R.block), spire = piece(R.spire);
  const at: Record<string, { x: number; y: number }> = {
    'ember-quarry:low-cache': { x: (shelf.x0 + shelf.x1) / 2, y: shelf.y },
    'ember-quarry:carving': { x: (ruin.x0 + ruin.x1) / 2, y: ruin.y },
    'ember-quarry:mesa-cache': { x: mesa.x1 - 24, y: mesa.y },
    'ember-quarry:lookout': { x: (block.x0 + block.x1) / 2, y: block.y },
    'ember-quarry:summit': { x: (spire.x0 + spire.x1) / 2, y: spire.y },
  };
  const finds: HeightFind[] = old.finds.map(f => ({ ...f, ...at[f.id] }));
  const perched = old.perched.map(m => ({ ...m, spawnXs: [mesa.x0 + 56], floorY: mesa.y, range: [mesa.x0 + 16, mesa.x1 - 48] as [number, number] }));
  return { realm: 'infernal', top: upY(HIGH_ROADS_SIZE.h + 6), solids: [], trees: [], ledges: [], finds, folk: [], perched, hollis: { x: mesa.x0 + 120, y: mesa.y }, artPx: 2 };
}
export const EMBER_HIGH_ROADS: AreaHeights = emberHighRoads();

/** The Ember world: the Delve, its surface, the Seamworks, the Quarry and the Homestead on it. Area id stays the Delve's (its save, its missions). */
export const EMBER_WORLD: HuntZoneDef = {
  ...EMBER_DELVE,
  world: 'ember',
  stations: EMBER_WORLD_STATIONS,
  monsters: [ROAD_MAWS, QUARRY_MAWS, ...EMBER_HIGH_ROADS.perched, ...EMBER_DELVE.monsters],
  nodes: EMBER_QUARRY_WORLD_NODES,
  heights: EMBER_HIGH_ROADS,
  drops: SEAMWORKS_DROPS,
  spawnX: EMBER_SPAWN_X,
  arrival: 'The Basalt Seamworks. The Delve is under your feet; the stone in the square takes you anywhere you have lit.',
  terrain: { ...EMBER_DELVE.terrain!, surface: EMBER_SURFACE },
};

/**
 * The Infernal town in One World: the same town (id, name, realm), whose home
 * IS the Ember world. Its stations are the world's, so a deep link and the
 * Places list name the same counters the Keeper walks to. The old Quarry and
 * Homestead areas are gone from it: both are regions of the world now.
 */
export const INFERNAL_WORLD_TOWN: TownDef = {
  ...INFERNAL_TOWN,
  home: EMBER_WORLD.id,
  stations: EMBER_WORLD_STATIONS,
  spawnX: EMBER_SPAWN_X,
  monsters: [],
  safeX: 0,
  hunts: [EMBER_WORLD, UMBRAL_DELVE, VERDANT_DELVE, LUMINOUS_DELVE, CELESTIAL_DELVE],
};

/** The world's region ids that stand for a place the game already knew by an area id (Glim, first goals, the column). */
export function placeOfRegion(region: string | null | undefined, townId: string): string {
  if (!region || region === 'basalt-seamworks' || region === 'quarry-road') return townId;
  return region;
}
