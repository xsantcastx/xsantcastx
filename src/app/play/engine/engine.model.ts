import type { SpriteEntry } from '../../shared/art/sprite-manifest.generated';
import type { StationDef, StationKind, TownDef } from '../world/world.model';
import type { DisciplineId } from '../../shared/activity/activity.model';
import type { PlaceableId, WorldActionKind } from './terrain';
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
  /**
   * The same creature's stable id (its MonsterDef `creature` key, e.g.
   * 'rivet-maw'). The HUD translates it (`play.creature.<id>`), so a mixed
   * hunt names exactly the creature measured, in the player's language.
   */
  enemyId?: string;
  /**
   * The i18n key (`play.delve.*`, `play.hud.*`) of `message`, when it is a
   * line the HUD can translate. `messageVars.item` is a placeable id (the HUD
   * turns it into `name` / `lname`); `messageVars.items` is an English " and "
   * list the HUD re-joins. Absent otherwise (town arrivals, refusals written
   * in world data): show `message`.
   */
  messageKey?: string;
  messageVars?: Record<string, string | number>;
  /**
   * The gathering node within reach (a herb patch, a tree, an outcrop) when
   * no station is: `nearby` is then 'gather'. `need` is what still stops the
   * Keeper ("Sickle II", "Foraging 6"); `seconds` is the regrowth left.
   */
  gather?: { id: string; label: string; ready: boolean; seconds: number; need?: string; materialId: string };
  paused: boolean; defeated: boolean; enemyDefeated: boolean; complete: boolean; message: string;
}
export interface EngineOptions {
  /**
   * Force the render budget (engine/render-budget.ts): true = phone tier, false
   * = desktop tier. Omitted, it follows the device (a touch-first pointer is lite).
   */
  lite?: boolean;
  /** Pre-resolved legacy images. `creature`/`ore` are fallbacks when `art` cannot resolve a data key. */
  assets: { background?: string; keeper?: string; creature?: string; ore?: string; blade?: string };
  /** Resolves an `artFor()` key from world data to a URL. */
  art?: (key: string) => string;
  /** Resolves an area's scene basename (AreaDef.background) to a URL. Falls back to `assets.background`. */
  scene?: (name: string) => string;
  /**
   * World-layer sprite sheets by id (`spriteFor`, sprite-manifest.generated.ts).
   * Defaults to the generated manifest; tests inject fixtures. An id with no
   * entry (today: every id) keeps the mesh rig / placeholder exactly as before.
   */
  sprite?: (id: string) => SpriteEntry | null;
  /**
   * i18n lookup for in-canvas copy (keeper name tags and chatter, world/life.i18n.ts).
   * Absent (tests): name tags fall back to their English, chatter stays silent.
   */
  translate?: (key: string) => string;
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
   * The Keeper is about to place one `item` from the satchel. Take it (one
   * idempotent consume keyed by `mutationId`, unique per placement) and return
   * true; return false to refuse (none left, a failed save) and say why. The
   * cell is only filled after a yes. Absent: every placement is free (tests).
   */
  onPlace?: (event: PlaceEvent) => boolean | void;
  /**
   * The Keeper takes a placed thing back (X, or a long-press on it): grant one
   * `item` back to the satchel (idempotent on `mutationId`) and return true,
   * or false to refuse (a chest with things in it) and say why. Absent: free.
   */
  onTakeBack?: (event: PlaceEvent) => boolean | void;
  /** A placed chest or camp was used (E beside it, or a tap on it). The host opens it. */
  onUse?: (event: UseEvent) => void;
  /**
   * A creature fell to the Keeper. Fires once per kill (`id` is unique per
   * kill per engine session, the same prefix its drops are keyed by): the
   * host pays Hunting XP through SkillActionService, keyed by it.
   */
  onKill?: (event: KillEvent) => void;
  /**
   * Per-player delves: where a delve area's seed comes from and where its dug
   * and placed cells go. Absent (SSR, tests): the spec's fixed seed, and dug
   * state lives for the engine session. Settable later with `setDelve()`.
   */
  delve?: DelvePersistence | null;
  /**
   * Where hunting-ground gathering nodes' harvest times come from and go.
   * Absent (SSR, tests): regrowth is kept for the engine session only.
   * Settable later with `setGathering()`.
   */
  gathering?: GatherPersistence | null;
  /** Wall clock in epoch ms (regrowth is measured against it). Defaults to `Date.now`; tests pass a fake. */
  now?: () => number;
}
/**
 * The engine's whole view of saved gathering regrowth: only harvest times are
 * stored, and readiness is derived from them and the node's `respawn` against
 * the wall clock, so a reload shows each node exactly as far along as it is.
 */
export interface GatherPersistence {
  /** Epoch ms of a node's last harvest, or null when there is none on record. */
  harvestedAt(areaId: string, nodeId: string): number | null;
  /** A node was harvested (the host accepted the grant). Idempotent: the later stamp wins. */
  harvested(areaId: string, nodeId: string, at: number): void;
}
export interface KillEvent {
  id: string;
  areaId: string;
  creature: string;
  name: string;
  /** The creature's full HP: what Hunting XP scales with. */
  hp: number;
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
export interface PlaceEvent {
  item: PlaceableId;
  areaId: string;
  /** `col,row` of the cell it goes into (or comes out of). */
  cellKey: string;
  /** The same cell as an index into the area's terrain (what chests are filed by). */
  index: number;
  mutationId: string;
}
export interface UseEvent {
  kind: 'chest' | 'camp';
  areaId: string;
  cellKey: string;
  index: number;
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
  /**
   * The placeable stack the break drops (dirt → 'dirt-block'), to grant after
   * the break is accepted, keyed `${mutationId}:block`. A full satchel just
   * loses the block; it never stops the dig.
   */
  block?: PlaceableId;
  /**
   * Set when a hunting-ground gathering node (GatherNodeDef) broke rather
   * than a delve cell: the node's id. The host books it as a skill action at
   * that area, never through the Seamworks seam.
   */
  site?: string;
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
