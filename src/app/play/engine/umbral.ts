/**
 * umbral.ts — the Umbral underside's broken rule, as pure functions (the
 * engine runs them; scripts/rift-gates.test.cjs pins them). No DOM, no Angular.
 *
 * The rule (rift-gates.model.ts): THE DARK IS UNRELIABLE. Four ways, each said
 * once, plainly, the first time it applies (the engine's telegraph lines):
 *
 *  1. Ink-blind. The lantern reaches only part of its radius (BiomeDef.gloom),
 *     and a head under ink (or the tide) carries almost none. Placed light is
 *     untouched: torches are how you push the dark back.
 *  2. Unlit passages shift. A drift pocket (realm-gen.ts) is open or filled
 *     with drift-shale; every SHIFT_PERIOD it may change, but only while no
 *     light reaches it, the Keeper cannot see it, and nobody stands in it. A
 *     torch (any placed thing) inside pins it for good. Never a trap: it never
 *     moves in view, and its shell is ordinary rock you can dig round.
 *  3. The ink tide. On a fixed clock the ink stands up to TIDE_ROWS above every
 *     pool: the low passages fill with blinding ink and braziers go out. It is
 *     telegraphed (the HUD shows the tide), never sudden, and never drowns.
 *  4. Shades move only in the dark. A shade under strong light (a torch, a lit
 *     brazier, a glowing vein, the lantern's own core) cannot move or strike;
 *     out of it, it is fast. The Gloam Warden takes no blow at all unless lit.
 */
import { CELL, LIQUID_INK, type Terrain } from './terrain';

// ── The tide ────────────────────────────────────────────────────────────────

/** One tide, in seconds of play: rest, rise, hold, fall. */
export const TIDE_PERIOD = 50;
const TIDE_RISE_AT = 22, TIDE_HIGH_AT = 26, TIDE_FALL_AT = 40, TIDE_LOW_AT = 44;
/** Rows the ink stands above its pools at high tide. */
export const TIDE_ROWS = 2;

export type TidePhase = 'low' | 'rising' | 'high' | 'falling';
/** The tide at `seconds` of play: its phase, how high (0..TIDE_ROWS rows), and seconds until it next changes phase. */
export function tideAt(seconds: number): { phase: TidePhase; rows: number; next: number } {
  const s = ((seconds % TIDE_PERIOD) + TIDE_PERIOD) % TIDE_PERIOD;
  if (s < TIDE_RISE_AT) return { phase: 'low', rows: 0, next: TIDE_RISE_AT - s };
  if (s < TIDE_HIGH_AT) return { phase: 'rising', rows: TIDE_ROWS * (s - TIDE_RISE_AT) / (TIDE_HIGH_AT - TIDE_RISE_AT), next: TIDE_HIGH_AT - s };
  if (s < TIDE_FALL_AT) return { phase: 'high', rows: TIDE_ROWS, next: TIDE_FALL_AT - s };
  if (s < TIDE_LOW_AT) return { phase: 'falling', rows: TIDE_ROWS * (TIDE_LOW_AT - s) / (TIDE_LOW_AT - TIDE_FALL_AT), next: TIDE_LOW_AT - s };
  return { phase: 'low', rows: 0, next: TIDE_PERIOD - s + TIDE_RISE_AT };
}

/**
 * The world y of the ink surface under (col, row), when there is ink within
 * `reach` open cells straight below (row itself included), else NaN. The
 * surface is the top of the topmost ink cell (its level counted).
 */
export function inkSurfaceUnder(t: Terrain, col: number, row: number, reach = TIDE_ROWS + 1): number {
  for (let r = Math.max(0, row); r <= Math.min(t.rows - 1, row + reach); r++) {
    if (!t.inside(col, r)) return NaN;
    const i = t.index(col, r);
    if (t.liqLevel[i] && t.liqType[i] === LIQUID_INK) return t.top + (r + 1) * CELL - t.liqLevel[i] * (CELL / 8);
    if (t.solid(col, r) || t.liqLevel[i]) return NaN;
  }
  return NaN;
}

/** True when world point (x, y) is under ink: in an ink cell, or under the tide standing over a pool. */
export function inInk(t: Terrain, x: number, y: number, tideRows: number): boolean {
  const col = t.colAt(x), row = t.rowAt(y);
  if (!t.inside(col, row)) return false;
  const surface = inkSurfaceUnder(t, col, row);
  return Number.isFinite(surface) && y >= surface - tideRows * CELL;
}

// ── Drift pockets ───────────────────────────────────────────────────────────

/** Seconds between the dark's chances to move a pocket. */
export const SHIFT_PERIOD = 24;

/** Which state an unpinned pocket takes in shift `epoch` (0 open, 1 filled): a fair coin per pocket per epoch. */
export function pocketPhase(seed: number, pocketId: string, epoch: number): 0 | 1 {
  if (epoch <= 0) return 0;
  let h = (seed ^ Math.imul(epoch, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < pocketId.length; i++) h = Math.imul(h ^ pocketId.charCodeAt(i), 0x01000193) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  return (h & 1) as 0 | 1;
}

/** A rectangle of cells, inclusive. */
export interface CellRect { c0: number; c1: number; r0: number; r1: number }
export function rectsMeet(a: CellRect, b: CellRect): boolean { return a.c0 <= b.c1 && b.c0 <= a.c1 && a.r0 <= b.r1 && b.r0 <= a.r1; }
/** Whether a circle (world px) reaches into a cell rectangle. */
export function circleMeetsRect(x: number, y: number, radius: number, rect: CellRect, top: number): boolean {
  const left = rect.c0 * CELL, right = (rect.c1 + 1) * CELL, up = top + rect.r0 * CELL, down = top + (rect.r1 + 1) * CELL;
  const dx = Math.max(left - x, 0, x - right), dy = Math.max(up - y, 0, y - down);
  return dx * dx + dy * dy < radius * radius;
}

// ── Shades ──────────────────────────────────────────────────────────────────

/** A shade freezes inside this share of a light's radius (the bright middle of a pool). */
export const SHADE_LIGHT_SHARE = .55;
/** …and inside this share of the lantern's own (ink-blind) radius: its core, right beside the Keeper. */
export const SHADE_LANTERN_SHARE = .4;
/** How fast a shade crosses the dark (px/s; a Maw walks at 65), and how long its lunge winds up. */
export const SHADE_SPEED = 210;
export const SHADE_WINDUP = .5;
/** Seconds between the Warden calling two shadelings out of the dark (only while it is unlit). */
export const WARDEN_CALL = 16;
/** Seconds a lit brazier burns before it gutters out. */
export const BRAZIER_BURN = 30;

/** Whether a point stands in strong light: inside the bright middle of any light but the lantern, or the lantern's core. */
export function litBy(x: number, y: number, lights: readonly { x: number; y: number; radius: number }[], count: number,
  lantern: { x: number; y: number; radius: number } | null): boolean {
  for (let n = 0; n < count; n++) {
    const l = lights[n];
    if (lantern && l.x === lantern.x && l.y === lantern.y) continue;
    const r = l.radius * SHADE_LIGHT_SHARE;
    if ((x - l.x) ** 2 + (y - l.y) ** 2 < r * r) return true;
  }
  if (lantern) {
    const r = lantern.radius * SHADE_LANTERN_SHARE;
    if ((x - lantern.x) ** 2 + (y - lantern.y) ** 2 < r * r) return true;
  }
  return false;
}
