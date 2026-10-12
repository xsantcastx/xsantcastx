import type { StationDef, StationKind, TownDef } from '../world/world.model';
import type { DisciplineId } from '../../shared/activity/activity.model';
import type { WorldActionKind } from './terrain';
/** `down` aims a delve swing (or blast) below the Keeper; `blast` channels the staff. */
export type EngineInput = 'left' | 'right' | 'jump' | 'attack' | 'dodge' | 'down' | 'blast';
export type InteractionTarget = 'ore' | 'forge' | 'beacon' | 'passage';
export type KeeperAnimation = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'dodge' | 'hurt';
export interface EngineState {
  /** `nearby`: id of the station within reach (`ore`/`forge`/`beacon`/`passage` or a town station id). */
  hp: number; enemyHp: number; nearby: string | null; x: number; y: number;
  /** Label and kind of the station within reach, for the HUD prompt. */
  nearbyLabel?: string; nearbyKind?: StationKind;
  /** Id of the town or hunt the Keeper stands in. */
  areaId?: string;
  coins?: number; kills?: number; area?: string;
  facing?: number; animation?: KeeperAnimation;
  /** True in an area with diggable terrain. `depth`: terrain rows below the surface the Keeper stands at. */
  delve?: boolean; depth?: number;
  /** In a delve with biomes: the name of the biome the Keeper stands in ("Glowcap Grotto"). */
  biome?: string;
  /**
   * Name of the creature the enemy bar measures: the nearest living one the
   * Keeper could meet (in a delve, on roughly the Keeper's level). Absent, with
   * `enemyHp` 0, when there is none — the bar hides.
   */
  enemyName?: string;
  paused: boolean; defeated: boolean; enemyDefeated: boolean; complete: boolean; message: string;
}
export interface EngineOptions {
  /** Pre-resolved legacy images. `creature`/`ore` are fallbacks when `art` cannot resolve a data key. */
  assets: { background?: string; keeper?: string; creature?: string; ore?: string; blade?: string };
  /** Resolves an `artFor()` key from world data to a URL. */
  art?: (key: string) => string;
  /** Resolves an area's scene basename (AreaDef.background) to a URL. Falls back to `assets.background`. */
  scene?: (name: string) => string;
  /** The town to stand in. Defaults to the Infernal town. */
  town?: TownDef;
  /** `ore` is the material quantity (legacy name); `material` is its stack id. */
  onLoot?: (loot: { id: string; coins: number; ore: number; material?: string }) => boolean | void;
  onInteract: (target: InteractionTarget) => void;
  /** A panel or waystone station was interacted with. The host opens its panel. */
  onStation?: (station: StationDef) => void;
  onState: (state: EngineState) => void;
  /**
   * Where picked-up loot flies: the satchel HUD's centre in CLIENT (viewport) px,
   * e.g. from its getBoundingClientRect(). Called once per pickup. Omitted, or
   * returning null → the canvas's top-right corner. Also settable later with
   * `engine.setSatchelTarget()`.
   */
  satchelTarget?: () => { x: number; y: number } | null | undefined;
  /**
   * A tool is about to break a terrain cell that pays XP or a material (see
   * engine/terrain.ts). Grant it through the progression gateway, keyed by
   * `mutationId` (stable per cell per engine session, so a retry is the same
   * grant). Return false to refuse: the cell stays standing, fully cracked,
   * and the next hit asks again. Cells that pay nothing (dirt, basalt) break
   * without asking.
   */
  onWorldAction?: (event: WorldActionEvent) => boolean | void;
  /**
   * The Keeper read something in the world (E or a tap beside it). Fires on
   * every read; the host decides whether it is new (DelveLoreService).
   */
  onDiscover?: (event: DiscoverEvent) => void;
  /**
   * Per-player delves: where a delve area's seed comes from and where its dug
   * and placed cells go. Absent (SSR, tests): the spec's fixed seed, and dug
   * state lives for the engine session. Settable later with `setDelve()`.
   */
  delve?: DelvePersistence | null;
}
export interface DiscoverEvent {
  kind: 'inscription';
  /** Inscription id from the terrain spec (shared/delve/delve-lore.model.ts lists them). */
  id: string;
  /** Biome id the inscription sits in ('root-hollows', …). */
  biome: string;
}
/**
 * The engine's whole view of a per-player delve save. `layout` is
 * `terrainLayout(spec, seed)`: a saved diff under another layout is stale.
 */
export interface DelvePersistence {
  /** This player's seed for a delve area, or undefined for the spec's own. */
  seed(areaId: string): number | undefined;
  /** Saved cell overrides (cell index → node index) for that layout, or null. */
  cells(areaId: string, layout: string): ReadonlyMap<number, number> | null;
  /** A cell changed. `kind` null: it is back to what the seed generated. Debounce on the host side. */
  changed(areaId: string, layout: string, index: number, kind: number | null): void;
  /** Whether a once-per-player flag (a felled guardian, a paid find) is set. Optional: absent = never. */
  isClaimed?(id: string): boolean;
  /** Set a once-per-player flag, saved at once. Optional: absent = this session only. */
  claim?(id: string): boolean;
}
export interface WorldActionEvent {
  kind: WorldActionKind;
  areaId: string;
  /** `col,row` of the cell in its area's terrain. */
  cellKey: string;
  /** Rolled yield; absent when the node pays only XP or its chance missed. */
  materialId?: string;
  qty?: number;
  discipline: DisciplineId;
  xp: number;
  mutationId: string;
}
export interface Body { x: number; y: number; vy: number; grounded: boolean }
export interface Platform { x: number; y: number; width: number }
export const WORLD_WIDTH = 2700;
export const FLOOR = 610;
export const PLATFORMS: Platform[] = [
  { x: 0, y: FLOOR, width: WORLD_WIDTH }, { x: 370, y: 500, width: 210 },
  { x: 670, y: 410, width: 180 }, { x: 1000, y: 505, width: 250 },
  { x: 1350, y: 430, width: 180 }, { x: 2210, y: 505, width: 180 },
];
/** One-way platforms: land only while descending across the top surface. */
export function advanceBody(body: Body, velocityX: number, dt: number, platforms: readonly Platform[] = PLATFORMS, width = WORLD_WIDTH): void {
  const previousY = body.y;
  body.x = Math.max(30, Math.min(width - 30, body.x + velocityX * dt));
  body.vy += 1650 * dt;
  body.y += body.vy * dt;
  body.grounded = false;
  for (const platform of platforms) {
    if (body.vy >= 0 && previousY <= platform.y && body.y >= platform.y &&
        body.x + 16 > platform.x && body.x - 16 < platform.x + platform.width) {
      body.y = platform.y; body.vy = 0; body.grounded = true;
    }
  }
}
/** `floorY`: the ground the enemy stands on; `scale`: the area's figure scale (reach shrinks with the figures). */
export function meleeHits(player: Body, enemyX: number, facing: number, floorY = FLOOR, scale = 1): boolean {
  const distance = enemyX - player.x;
  return Math.abs(distance) < 145 * scale && distance * facing >= -20 * scale && Math.abs(player.y - floorY) < 105 * Math.max(scale, .6);
}
/** Arrival tolerance for click-to-move, in world px. One fixed step at walk speed is ~4.4px. */
export const ARRIVE_DISTANCE = 6;
/**
 * The walk direction toward a click-to-move target: -1, 0 (arrived) or 1.
 * Pure, so the fixed-step update and the tests agree on what "arrived" means.
 */
export function walkDirection(fromX: number, toX: number): -1 | 0 | 1 {
  const dx = toX - fromX;
  return Math.abs(dx) <= ARRIVE_DISTANCE ? 0 : dx > 0 ? 1 : -1;
}
