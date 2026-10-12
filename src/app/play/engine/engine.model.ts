export type EngineInput = 'left' | 'right' | 'jump' | 'attack' | 'dodge';
export type InteractionTarget = 'ore' | 'forge' | 'beacon' | 'passage';
export type KeeperAnimation = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'dodge' | 'hurt';
export interface EngineState {
  hp: number; enemyHp: number; nearby: InteractionTarget | null; x: number; y: number;
  coins?: number; kills?: number; area?: string;
  facing?: number; animation?: KeeperAnimation;
  paused: boolean; defeated: boolean; enemyDefeated: boolean; complete: boolean; message: string;
}
export interface EngineOptions {
  assets: { background: string; keeper: string; creature: string; ore: string; blade: string };
  onLoot?: (loot: { id: string; coins: number; ore: number }) => boolean | void;
  onInteract: (target: InteractionTarget) => void;
  onState: (state: EngineState) => void;
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
export function advanceBody(body: Body, velocityX: number, dt: number): void {
  const previousY = body.y;
  body.x = Math.max(30, Math.min(WORLD_WIDTH - 30, body.x + velocityX * dt));
  body.vy += 1650 * dt;
  body.y += body.vy * dt;
  body.grounded = false;
  for (const platform of PLATFORMS) {
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
