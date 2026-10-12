import type { StationDef, StationKind, TownDef } from '../world/world.model';
export type EngineInput = 'left' | 'right' | 'jump' | 'attack' | 'dodge';
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
export function meleeHits(player: Body, enemyX: number, facing: number): boolean {
  const distance = enemyX - player.x;
  return Math.abs(distance) < 145 && distance * facing >= -20 && Math.abs(player.y - FLOOR) < 105;
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
