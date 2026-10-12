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
import type { TerrainSpec } from '../engine/terrain';

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
  | 'vendor';
export const PANEL_IDS: readonly PanelId[] = [
  'market', 'gambler', 'exchange', 'crafting', 'enchanting', 'runes',
  'sanctum', 'codex', 'leaderboards', 'quests', 'arena', 'trials', 'character',
  'vendor',
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
}

export type HuntZoneDef = AreaDef;

export interface TownDef extends AreaDef {
  id: RealmTownId;
  realm: RealmTownId;
  hunts: readonly HuntZoneDef[];
}

/** An area of a town by id: the town itself or one of its hunts. */
export function areaOf(town: TownDef, id: string): AreaDef | undefined {
  return town.id === id ? town : town.hunts.find(hunt => hunt.id === id);
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
