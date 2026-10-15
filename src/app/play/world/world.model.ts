/**
 * world.model.ts — the playable world as data.
 *
 * Every navbar page is becoming a PLACE: a station standing in one of five
 * realm towns. The side-scroller engine reads towns, their stations, their
 * hunting grounds, the monsters in them and what those monsters drop from the
 * types below — nothing about a place is hard-coded in `engine.ts`.
 *
 * To add content, add DATA:
 *   - a town      → a new file in `towns/`, then set its entry in `TOWNS`.
 *   - a station   → a `StationDef` in that town's `stations`.
 *   - a panel     → a `PanelId` here AND a row in `panel-registry.ts`
 *                   (the compiler enforces the registry is complete).
 *   - a hunt      → a `HuntZoneDef` in the town's `hunts`, reached by a
 *                   `passage` station whose `to` is the hunt's `id`.
 *   - a monster   → a `MonsterDef` in an area's `monsters`.
 *   - a drop table→ a `ZoneDropTable` on the area (`drops`), optionally
 *                   overridden per monster.
 *
 * Pure data and types: no DOM, no Angular, no art resolution. Art is named by
 * its `artFor()` key and resolved by the host component. The node test harness
 * (`scripts/seamworks-engine.test.cjs`) loads this file directly, so it must
 * stay import-free apart from other pure modules.
 */
// Town files take only TYPES from this module, so this value import is one-way.
import { INFERNAL_TOWN } from './towns/infernal';
import { CELESTIAL_TOWN } from './towns/celestial';
import { LUMINOUS_TOWN } from './towns/luminous';
import { UMBRAL_TOWN } from './towns/umbral';
import { VERDANT_TOWN } from './towns/verdant';
import type { TerrainSpec, ToolTiers } from '../engine/terrain';
import type { AreaHeights } from './heights';
import type { DisciplineId } from '../../shared/activity/activity.model';

/** Every built town. A Phase 2 town is a new file in towns/ and one line here. */
export const TOWNS: Readonly<Record<RealmTownId, TownDef | undefined>> = {
  infernal: INFERNAL_TOWN,
  luminous: LUMINOUS_TOWN,
  umbral: UMBRAL_TOWN,
  celestial: CELESTIAL_TOWN,
  verdant: VERDANT_TOWN,
};

/** What the waystone shows for each realm, built or not. */
export const TOWN_LABELS: Readonly<Record<RealmTownId, string>> = {
  infernal: 'Infernal', luminous: 'Luminous', umbral: 'Umbral', celestial: 'Celestial', verdant: 'Verdant',
};

/** The five realm towns. Only the ones in `TOWNS` with a definition exist yet. */
export type RealmTownId = 'infernal' | 'luminous' | 'umbral' | 'celestial' | 'verdant';
export const REALM_TOWN_IDS: readonly RealmTownId[] = ['infernal', 'luminous', 'umbral', 'celestial', 'verdant'];

/**
 * Every page that can be hosted as an in-world panel. Each id has exactly one
 * lazy loader in `panel-registry.ts`; the `?at=` query parameter names a
 * STATION id, which for panel stations is the same string as its panel.
 */
export type PanelId =
  | 'market' | 'gambler' | 'exchange'
  | 'crafting' | 'enchanting' | 'runes'
  | 'sanctum' | 'codex' | 'leaderboards'
  | 'quests' | 'arena' | 'trials' | 'character'
  | 'vendor' | 'homestead' | 'skills' | 'vault' | 'reels'
  | 'rune-drop' | 'seam-sweeper' | 'eclipse-ascent';
export const PANEL_IDS: readonly PanelId[] = [
  'market', 'gambler', 'exchange', 'crafting', 'enchanting', 'runes',
  'sanctum', 'codex', 'leaderboards', 'quests', 'arena', 'trials', 'character',
  'vendor', 'homestead', 'skills', 'vault', 'reels',
  'rune-drop', 'seam-sweeper', 'eclipse-ascent',
];

export interface Platform { x: number; y: number; width: number }

/**
 * What a station does when the Keeper interacts with it.
 *  panel    — opens `panel` in the in-world panel host (pauses the world).
 *  resource — the legacy quest hook (`ore`): the host's onInteract(id) runs.
 *  quest    — the legacy quest hook (`forge`, `beacon`): onInteract(id) runs.
 *  passage  — moves the Keeper to another area (`to`) at `arriveX`.
 *  waystone — opens the realm travel panel.
 */
export type StationKind = 'panel' | 'resource' | 'quest' | 'passage' | 'waystone';

/** A gate on a station. 'guardian' = a monster has fallen here; 'beacon' = the beacon is restored. */
export type StationRequirement = 'guardian' | 'beacon';

export interface StationDef {
  /** Unique within its area. For panel stations, also the `?at=` place id. */
  id: string;
  x: number;
  label: string;
  kind: StationKind;
  panel?: PanelId;
  /** `artFor()` key drawn on the stall/building. */
  art?: string;
  /** Footprint in world px (click target and stall width). Default 120. */
  width?: number;
  /** Passage only: the area id it leads to and where the Keeper arrives. */
  to?: string;
  arriveX?: number;
  /** Refuse to interact (and show `lockedMessage`) until this is satisfied. */
  requires?: StationRequirement;
  lockedMessage?: string;
  /** One-line description for the accessible Places list. */
  blurb?: string;
}

/**
 * One line of a drop table. Phase 1 expresses today's fixed coins + 1 ore as
 * data; Phase 2 fills real tables per zone.
 *
 *  coins    — amount = `base + (kills % spread)` (spread omitted → base).
 *  material — `qty` of the inventory stack `material`, drawn with `art`.
 *  `chance` (0..1, default 1) is rolled with the engine's RNG; a table of
 *  certain drops never touches the RNG, so the fixed-step tests stay exact.
 */
export type DropEntry =
  | { id: string; kind: 'coins'; base: number; spread?: number; chance?: number; rarity?: LootRarity }
  | { id: string; kind: 'material'; material: string; art: string; label: string; short: string; qty: number; chance?: number; rarity?: LootRarity };

/**
 * Optional, presentation only: the colour of a drop's light beam on the ground
 * (the item / rune tier ladder). Omitted → coins burn gold, materials 'common'.
 * Never affects what is granted.
 */
export type LootRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'singular';

export interface ZoneDropTable {
  id: string;
  entries: readonly DropEntry[];
}

export interface MonsterDef {
  /** `artFor()` key of the creature painting. Picks its rig in engine/creature-rigs.ts (unknown keys get a generic one). */
  creature: string;
  name: string;
  hp: number;
  spawnXs: readonly number[];
  /** Overrides the area's table for this creature. */
  drops?: ZoneDropTable;
  /** World y the creature stands on (a delve cavern floor). Default: the area floor. */
  floorY?: number;
  /** World x it never leaves, e.g. the walls of its cavern. Default: the whole area. */
  range?: readonly [number, number];
  /**
   * A guardian felled once per player: the flag recorded when it falls
   * (delve save `claimed`). It never respawns, and nodes guarded by the same
   * flag (TerrainNodeDef.guard) open once it is set.
   */
  once?: string;
  /** Not there until the host summons it (`engine.summon`): the Drowned Lamp rises to a night cast. */
  summoned?: true;
  /**
   * Hides in its own dark: a hit only lands while a placed torch burns within
   * VEIL_CELLS of it ("relight torches to expose it"), and the lantern dims while it lives.
   */
  veiled?: true;
  /**
   * The Underhearth's creatures (Phase 8):
   *  - 'dormant': cold until struck (the Banked Ember): it ignores the Keeper
   *    until a hit wakes it, then fights as any creature does;
   *  - 'shoulder': shoulders the ceiling (the Ironwood Sentinel): its strike
   *    brings down unsupported loose rock over the Keeper (a cave-in);
   *  - 'furnace': the Banked Furnace (engine/furnace.ts): never moves, pulls,
   *    spills Banked Embers, and takes no hit until its four vents are doused;
   *  - 'shade' (the Ink Deeps, engine/umbral.ts): frozen where light falls on it,
   *    fast where none does; it lunges out of the dark;
   *  - 'warden': the Gloam Warden, a shade that takes no hit unless it is lit
   *    (the hall's braziers), and calls shadelings out of the dark;
   *  - 'graft' (the Root Deeps, engine/verdant.ts): the Graftmother, held by the
   *    heart-roots in her hall: while one stands she heals and a blow does a quarter;
   *  - 'prism' (the Prism Mines, engine/luminous.ts): the Hollow Sun, struck only
   *    while a beam crosses it (caught, it cannot move); it flares the mirrors wrong;
   *  - 'orrery' (the Orrery Wells, engine/celestial.ts): the Fallen Ephemeris, in orbit on its
   *    hall's ceiling while the hall's field falls up (no blow lands); turn the field down and
   *    it drops into its own well, stunned, until it gathers itself and turns the field back.
   */
  trait?: 'dormant' | 'shoulder' | 'furnace' | 'shade' | 'warden' | 'graft' | 'prism' | 'orrery';
  /** A summoned guardian that, once felled for good (`once`), may still be summoned again for its drops. */
  rematch?: true;
}

/** Anything the Keeper can stand in: a town or one of its hunting grounds. */
export interface AreaDef {
  id: string;
  /** Shown in the HUD and broadcast as the presence `zone`. Keep stable: peers filter on it. */
  name: string;
  /** Scene basename under assets/images (e.g. `bg-basalt-seamworks`), the ArtScene convention. */
  background: string;
  width: number;
  platforms: readonly Platform[];
  stations: readonly StationDef[];
  monsters: readonly MonsterDef[];
  drops: ZoneDropTable;
  /** Where the Keeper stands after a reset in this area. */
  spawnX: number;
  /** Monsters never cross west of this x, and stand down while the Keeper is west of it. 0 = none. */
  safeX?: number;
  /** Message on arriving through a passage. */
  arrival?: string;
  /** Hand-painted foreground set drawn by the engine's Atmosphere (only 'seamworks-hub' exists). */
  scenery?: 'seamworks-hub';
  /**
   * Diggable tile terrain below the floor line (engine/terrain.ts). An area
   * with terrain is a delve: dark, lantern-lit, and the camera follows the
   * Keeper down.
   */
  terrain?: TerrainSpec;
  /** Draw scale for Keepers and creatures (delves use 0.5: three cells tall). Default 1. */
  figureScale?: number;
  /** Herb patches, trees and ore outcrops to gather here (hunting grounds). */
  nodes?: readonly GatherNodeDef[];
  /** Height above the floor: trees, shelves, ruins, bridges and what waits up there (world/heights.ts). */
  heights?: AreaHeights;
}

export type HuntZoneDef = AreaDef;

/**
 * A gathering node standing in a hunting ground: a herb patch, a tree or an
 * ore outcrop. It follows the Delve's tool-vs-node rule (engine/terrain.ts
 * `toolFor`): `tools` names each tool that can work it and the minimum tier,
 * a hit deals 1 + (tier - minimum) / 2, and `hp` hits at the minimum break
 * it. Breaking it asks the host (`onWorldAction`, with `site` set to this id),
 * which books the XP and the yield through SkillActionService in one
 * idempotent write. Then it rests `respawn` seconds and grows back.
 *
 * Found-in reads `yield.materialId` from here, so a node can never pay a
 * material that "Found in…" does not name.
 */
export interface GatherNodeDef {
  /** Unique within its area; part of the grant's mutation id. */
  id: string;
  /** World x of its centre, on the area floor. */
  x: number;
  /** How it is drawn: a herb patch, a tree, or a rock outcrop. */
  kind: 'herb' | 'wood' | 'ore';
  /** "Sunbloom patch". Shown on the prompt and the clang. */
  label: string;
  /** Tool → minimum tier. Swing tools only (the staff's blast works delves). */
  tools: ToolTiers;
  /** Hits at the minimum tier. */
  hp: number;
  discipline: DisciplineId;
  xp: number;
  /** Skill level (in `discipline`) the host checks; mirrors the Skills unlock table. */
  minLevel?: number;
  yield: { materialId: string; qty: number; chance?: number };
  /** Seconds it takes to grow back after a harvest. */
  respawn: number;
}

/** Interaction reach around a gathering node's x, world px (tighter than a station's). */
export const NODE_REACH = 90;

export interface TownDef extends AreaDef {
  id: RealmTownId;
  realm: RealmTownId;
  hunts: readonly HuntZoneDef[];
}

/** An area of a town by id: the town itself or one of its hunts. */
export function areaOf(town: TownDef, id: string): AreaDef | undefined {
  return town.id === id ? town : town.hunts.find(hunt => hunt.id === id);
}

/**
 * A station by id in ANY built town, for `/play?at=<station id>` deep links
 * from anywhere. Town stations only (not hunts or the Homestead). Station ids
 * repeat across towns ('waystone', 'passage'), so `prefer` (the town the
 * Keeper is in) is searched first, then the towns in realm order. Unknown ids
 * are null. Pure.
 */
export function findStation(stationId: string | null | undefined, prefer?: RealmTownId): { townId: RealmTownId; station: StationDef } | null {
  if (!stationId) return null;
  const order = prefer ? [prefer, ...REALM_TOWN_IDS.filter(id => id !== prefer)] : REALM_TOWN_IDS;
  for (const townId of order) {
    const station = TOWNS[townId]?.stations.find(row => row.id === stationId);
    if (station) return { townId, station };
  }
  return null;
}

/** Interaction radius in world px around a station's x. */
export const STATION_REACH = 110;

/** The station whose centre is nearest `x` within reach, or null. */
export function nearestStation(stations: readonly StationDef[], x: number): StationDef | null {
  let best: StationDef | null = null;
  let bestDistance = STATION_REACH;
  for (const station of stations) {
    const distance = Math.abs(station.x - x);
    if (distance < bestDistance) { best = station; bestDistance = distance; }
  }
  return best;
}

/** The station under a world point, using its footprint and a tall hit box above the floor. */
export function stationAt(stations: readonly StationDef[], x: number, y: number, floor: number): StationDef | null {
  if (y < floor - 240 || y > floor + 70) return null;
  let best: StationDef | null = null;
  let bestDistance = Infinity;
  for (const station of stations) {
    const half = (station.width ?? 120) / 2;
    const distance = Math.abs(station.x - x);
    if (distance <= half && distance < bestDistance) { best = station; bestDistance = distance; }
  }
  return best;
}

/** The engine's view geometry: virtual height 720, scaled to the canvas CSS height. */
export const VIEW_HEIGHT = 720;
export interface ViewTransform {
  /** Canvas bounding rect in CSS px. */
  left: number; top: number; rectWidth: number; rectHeight: number;
  /** Size the engine laid out at, in CSS px (the backing store is this × DPR). */
  cssWidth: number; cssHeight: number;
  camera: number;
  /** Vertical camera in world px (delves scroll down). Default 0. */
  cameraY?: number;
}

/**
 * Client (pointer) coordinates → world coordinates. Pure.
 * The canvas draws at `scale = cssHeight / 720` after a DPR `setTransform`, so
 * DPR cancels out: work in CSS px, correct for any CSS stretch between the
 * laid-out size and the on-screen rect, then undo the scale and the camera.
 */
export function clientToWorld(clientX: number, clientY: number, view: ViewTransform): { x: number; y: number } {
  const cssX = (clientX - view.left) * (view.rectWidth ? view.cssWidth / view.rectWidth : 1);
  const cssY = (clientY - view.top) * (view.rectHeight ? view.cssHeight / view.rectHeight : 1);
  const scale = view.cssHeight / VIEW_HEIGHT;
  return { x: view.camera + cssX / scale, y: (view.cameraY ?? 0) + cssY / scale };
}
