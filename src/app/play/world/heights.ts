/**
 * heights.ts — the surface with height: what stands above each hunting
 * ground's floor (trees you climb, rock shelves you grab, floating Godforge
 * ruins, rope bridges) and what waits up there (courier caches, carvings, a
 * look-out, one summit cairn per realm, a perched creature, a traveller).
 *
 * Pure data, deterministic per area: the same layout for every player, built
 * from one route shape per realm (`climbRoute`) so every route is proven
 * climbable by one engine test and checked geometrically for all five.
 *
 * The route, west → east, all from the hunting ground's floor (FLOOR = 610):
 *   1. Low shelf     a rock shelf over head height: jump at its side, catch the lip, mantle.  → cache
 *   2. The tree      climb the trunk (Jump), stand in the canopy.
 *   3. Ruin + bridge a floating ruin slab, then a rope bridge east.                          → carving
 *   4. The mesa      a wide rock shelf; a creature is perched on it (and, one day in five, Hollis Fenn).  → cache
 *   5. The snag      a dead trunk with no canopy: climb to its top.
 *   6. Wall-jump     from the snag's top kick east (direction + Jump) and catch a ruin block. → look-out
 *   7. The spire     up a ruin slab, then catch the spire's lip and mantle onto the summit.   → summit cairn
 *
 * Lore (lore-addendum, "The High Roads"): before the Waystones, the Ridge
 * Couriers carried the realms' post over the high ground, and cached what they
 * could not carry. Most caches were never collected.
 */
import { FLOOR } from '../engine/engine.model';
import type { SurfaceClimb, SurfaceSolid } from '../engine/surface-body';
// Types only: world.model imports the town files, which import this file.
import type { MonsterDef, Platform, RealmTownId } from './world.model';

/** How a piece is drawn (engine/surface-render.ts). */
export type HeightLook = 'rock' | 'ruin' | 'bridge' | 'canopy';
export interface HeightLedge extends Platform { look: HeightLook }
export interface HeightSolid extends SurfaceSolid { look: 'rock' | 'ruin' }
export interface HeightTree extends SurfaceClimb { canopy: number }

export type HeightFindKind = 'cache' | 'carving' | 'lookout' | 'summit';
export interface HeightFind {
  /** Unique across the world: `<area>:<name>`. The claim and the grant are keyed by it. */
  id: string;
  kind: HeightFindKind;
  x: number;
  /** Feet y of the ground it stands on. */
  y: number;
  /** i18n key of its name (play.height.find.*). */
  nameKey: string;
  /** What it pays the first time (caches, the summit): Gold as max(gold, goldSeconds of income) (rule I), and real material stacks. */
  reward?: { gold: number; goldSeconds: number; materials: readonly { id: string; qty: number }[] };
  /** Carvings and the summit: the i18n key of the text read aloud. */
  textKey?: string;
}

/** A person who stands on high ground. `days`: which realm's hunt they are in, by day (travelling); absent = always here. */
export interface HeightFolk {
  id: 'hollis-fenn';
  x: number;
  y: number;
  nameKey: string;
  titleKey: string;
  /** i18n keys of the lines, said one at a time as the Keeper comes near. */
  lines: readonly string[];
}

export interface AreaHeights {
  /** Highest point the camera may show (world y of the frame's top). */
  top: number;
  solids: readonly HeightSolid[];
  trees: readonly HeightTree[];
  ledges: readonly HeightLedge[];
  finds: readonly HeightFind[];
  folk: readonly HeightFolk[];
  /** Creatures perched on the high ground (added to the area's monsters). */
  perched: readonly MonsterDef[];
  realm: RealmTownId;
}

/** The pieces of the route, relative to its west end `x0` (exported for the tests). */
export const ROUTE = {
  low: { dx: 0, y: 330, w: 150, h: 56 },
  tree: { dx: 380, height: 320, canopy: 220 },
  ruin: { dx: 560, w: 180, y: 170 },
  bridge: { dx: 740, w: 260, y: 170 },
  mesa: { dx: 1000, w: 300, y: 170, h: 80 },
  snag: { dx: 1400, top: 40 },
  block: { dx: 1530, w: 150, y: -150, h: 60 },
  slab: { dx: 1690, w: 190, y: -270 },
  spire: { dx: 1900, w: 110, y: -560, h: 140 },
} as const;

export interface RouteSpec {
  area: string;
  realm: RealmTownId;
  x0: number;
  /** The realm's creature, perched on the mesa. */
  perched: MonsterDef;
  /** Reward rows, on the economy curve (scripts/economy-sim.mjs --heights). */
  low: HeightFind['reward'];
  mesa: HeightFind['reward'];
  summit: HeightFind['reward'];
}

/** Build one realm's route. Pure; the same spec always gives the same layout. */
export function climbRoute(spec: RouteSpec): AreaHeights {
  const { x0, area } = spec, R = ROUTE;
  const id = (name: string) => `${area}:${name}`;
  return {
    realm: spec.realm,
    top: R.spire.y - 450,
    solids: [
      { x: x0 + R.low.dx, y: R.low.y, w: R.low.w, h: R.low.h, look: 'rock' },
      { x: x0 + R.mesa.dx, y: R.mesa.y, w: R.mesa.w, h: R.mesa.h, look: 'rock' },
      { x: x0 + R.block.dx, y: R.block.y, w: R.block.w, h: R.block.h, look: 'ruin' },
      { x: x0 + R.spire.dx, y: R.spire.y, w: R.spire.w, h: R.spire.h, look: 'ruin' },
    ],
    trees: [
      { x: x0 + R.tree.dx, top: FLOOR - R.tree.height, bottom: FLOOR, canopy: R.tree.canopy },
      { x: x0 + R.snag.dx, top: R.snag.top, bottom: FLOOR, canopy: 0 },
    ],
    ledges: [
      { x: x0 + R.tree.dx - R.tree.canopy / 2, y: FLOOR - R.tree.height, width: R.tree.canopy, look: 'canopy' },
      { x: x0 + R.ruin.dx, y: R.ruin.y, width: R.ruin.w, look: 'ruin' },
      { x: x0 + R.bridge.dx, y: R.bridge.y, width: R.bridge.w, look: 'bridge' },
      { x: x0 + R.slab.dx, y: R.slab.y, width: R.slab.w, look: 'ruin' },
    ],
    finds: [
      { id: id('low-cache'), kind: 'cache', x: x0 + R.low.dx + R.low.w / 2, y: R.low.y, nameKey: 'play.height.find.cache', reward: spec.low },
      { id: id('carving'), kind: 'carving', x: x0 + R.ruin.dx + R.ruin.w / 2, y: R.ruin.y, nameKey: 'play.height.find.carving', textKey: `play.height.carving.${spec.realm}` },
      { id: id('mesa-cache'), kind: 'cache', x: x0 + R.mesa.dx + R.mesa.w - 40, y: R.mesa.y, nameKey: 'play.height.find.cache', reward: spec.mesa },
      { id: id('lookout'), kind: 'lookout', x: x0 + R.block.dx + R.block.w / 2, y: R.block.y, nameKey: 'play.height.find.lookout' },
      { id: id('summit'), kind: 'summit', x: x0 + R.spire.dx + R.spire.w / 2, y: R.spire.y, nameKey: `play.height.summit.${spec.realm}`, reward: spec.summit, textKey: `play.height.summitText.${spec.realm}` },
    ],
    folk: [],
    perched: [{ ...spec.perched, spawnXs: [x0 + R.mesa.dx + 90], floorY: R.mesa.y, range: [x0 + R.mesa.dx + 30, x0 + R.mesa.dx + R.mesa.w - 90] }],
  };
}

/**
 * Hollis Fenn, the last Ridge Courier, walks the high roads: one realm's mesa
 * a day (day number since the epoch, mod 5, in realm order). Pure.
 */
export const HOLLIS_REALMS: readonly RealmTownId[] = ['infernal', 'luminous', 'umbral', 'celestial', 'verdant'];
export function hollisRealm(day: number): RealmTownId { return HOLLIS_REALMS[((day % 5) + 5) % 5]; }
export function hollisFolk(heights: AreaHeights): HeightFolk {
  const mesa = heights.solids[1];
  return { id: 'hollis-fenn', x: mesa.x + 70, y: mesa.y, nameKey: 'play.height.folk.hollis', titleKey: 'play.height.folk.hollisTitle',
    lines: ['play.height.hollis.1', `play.height.hollis.${heights.realm}`, 'play.height.hollis.2'] };
}

/** Reach round a find, world px: the Keeper's feet within this box of its foot point. */
export const FIND_REACH = { x: 80, y: 60 };
/** Every find id a summit's Codex entry can name, for checks. */
export function summitId(area: string): string { return `${area}:summit`; }

/** Every route starts here: east of the stair foot, the gathering nodes and the safe line's first steps. */
const X0 = 560;
const pay = (gold: number, goldSeconds: number, ...materials: [string, number][]) => ({ gold, goldSeconds, materials: materials.map(([id, qty]) => ({ id, qty })) });

/**
 * The five routes. Rewards: each realm's common material (a shelf's worth) and
 * its rare one (the mesa and the summit), plus Gold as 2, 5 and 15 minutes of income (rule I quest and daily bands),
 * once per player (economy-sim --heights).
 */
export const HUNT_HEIGHTS: Readonly<Record<string, AreaHeights>> = {
  'ember-quarry': climbRoute({ area: 'ember-quarry', realm: 'infernal', x0: X0,
    perched: { creature: 'rivet-maw', name: 'Rivet Maw', hp: 60, spawnXs: [] },
    low: pay(40, 120, ['cinder-ore', 3]), mesa: pay(90, 300, ['cinder-ore', 3], ['infernal-heartstone', 1]), summit: pay(250, 900, ['infernal-heartstone', 2], ['ember-residue', 2]) }),
  'reflection-channels': climbRoute({ area: 'reflection-channels', realm: 'luminous', x0: X0,
    perched: { creature: 'prism-forager', name: 'Prism Forager', hp: 70, spawnXs: [] },
    low: pay(40, 120, ['luminous-prism', 2]), mesa: pay(90, 300, ['sunbloom', 3], ['solar-resin', 1]), summit: pay(250, 900, ['solar-resin', 2], ['luminous-prism', 3]) }),
  'unrecorded-corridors': climbRoute({ area: 'unrecorded-corridors', realm: 'umbral', x0: X0,
    perched: { creature: 'mirror-substitute', name: 'Mirror Substitute', hp: 75, spawnXs: [] },
    low: pay(40, 120, ['umbral-ink', 2]), mesa: pay(90, 300, ['nightbloom', 3], ['shadowthread-silk', 1]), summit: pay(250, 900, ['shadowthread-silk', 2], ['umbral-ink', 3]) }),
  'orrery-rings': climbRoute({ area: 'orrery-rings', realm: 'celestial', x0: X0,
    perched: { creature: 'ephemeris-leech', name: 'Ephemeris Leech', hp: 70, spawnXs: [] },
    low: pay(40, 120, ['celestial-alloy', 2]), mesa: pay(90, 300, ['moonpetal-herb', 3], ['celestial-quartz', 1]), summit: pay(250, 900, ['celestial-quartz', 2], ['celestial-alloy', 3]) }),
  'rootglass-thicket': climbRoute({ area: 'rootglass-thicket', realm: 'verdant', x0: X0,
    perched: { creature: 'rootglass-stag', name: 'Rootglass Stag', hp: 50, spawnXs: [] },
    low: pay(40, 120, ['world-root-bark', 3]), mesa: pay(90, 300, ['verdant-sap', 3], ['thornroot', 1]), summit: pay(250, 900, ['thornroot', 2], ['verdant-sap', 3]) }),
};
/** A find by id, anywhere. */
export function heightFind(id: string): HeightFind | undefined {
  for (const h of Object.values(HUNT_HEIGHTS)) { const f = h.finds.find(row => row.id === id); if (f) return f; }
  return undefined;
}
