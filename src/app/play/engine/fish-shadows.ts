/**
 * fish-shadows.ts — where are the fish? Under the water, where you can see them.
 *
 * Owner, 2026-10-14: "when fishing, where are the fish?". Every body of water
 * deep enough to hide one now shows dark pixel shadows slipping about under
 * its surface. They are drawn just AFTER the water (liquid-render.ts) as
 * half-transparent silhouettes with a pale glint: drawn under it, the water's
 * body swallowed them in a dark cave (tried first; nobody could find them).
 *
 * Purely visual and deterministic: a fish's home is a fixed hash of its cell,
 * so the same lake always holds the same fish, and nothing here is saved or
 * rolled (the catch is the fishing service's, never this file's).
 *
 *   - A fish needs a full water cell with water above it (never in the surface
 *     row, never in a puddle); about one in nine such cells is a home.
 *   - "More near good spots": within six cells of a cast line, one in three
 *     cells is a home, and those fish drift toward the bob. On the bite, the
 *     nearest one darts to it (the dip has a cause you can see).
 *   - Lava and ink hold none you can see (lava is opaque; nothing is fished from ink).
 *   - At most `max` per frame (the render budget), nearest the Keeper first by scan order.
 *   - Reduced motion: the fish rest at home, still.
 */
import { CELL, LIQUID_FULL, LIQUID_WATER, type Terrain } from './terrain';
import { ART } from './tile-art';

export interface FishLine { col: number; row: number; phase: 'wait' | 'bite' | 'hooked'; bobX: number }
export interface FishShadow { x: number; y: number; dir: 1 | -1; size: number }

/** One home in this many deep water cells; near a line, one in NEAR_EVERY. */
export const HOME_EVERY = 9;
export const NEAR_EVERY = 3;
/** Cells round a line that count as its "good spot". */
export const NEAR_CELLS = 6;

function hash(col: number, row: number): number {
  let h = (col * 374761393) ^ (row * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function deepWater(t: Terrain, col: number, row: number): boolean {
  if (!t.inside(col, row) || row < 1) return false;
  const i = t.index(col, row), up = t.index(col, row - 1);
  return t.liqType[i] === LIQUID_WATER && t.liqLevel[i] === LIQUID_FULL && t.liqType[up] === LIQUID_WATER && t.liqLevel[up] > 0;
}

/**
 * The fish visible in cells [c0, c1] × [r0, r1] at `time` (seconds; 0 holds them
 * at home), written into `out`. Returns how many.
 */
export function placeFish(t: Terrain, c0: number, c1: number, r0: number, r1: number, time: number, line: FishLine | null, out: FishShadow[], max: number): number {
  let n = 0;
  const lo = Math.max(t.colLo, c0), hi = Math.min(t.colHi - 1, c1);
  for (let row = Math.max(1, r0); row <= Math.min(t.rows - 1, r1) && n < max; row++) {
    for (let col = lo; col <= hi && n < max; col++) {
      const h = hash(col, row);
      const near = !!line && line.phase !== 'hooked' && Math.abs(col - line.col) <= NEAR_CELLS && Math.abs(row - line.row) <= 3;
      if (h % (near ? NEAR_EVERY : HOME_EVERY) !== 0) continue;
      if (!deepWater(t, col, row)) continue;
      const phase = (h >>> 8) % 628 / 100, speed = .35 + ((h >>> 4) % 40) / 100;
      const homeX = (col + .5) * CELL;
      let x = homeX + Math.sin(time * speed + phase) * CELL * 1.4;
      let dir: 1 | -1 = Math.cos(time * speed + phase) >= 0 ? 1 : -1;
      if (near && line && time > 0) {
        // Drawn to the bait: half-way toward the bob, and on the bite all the way.
        const pull = line.phase === 'bite' && Math.abs(col - line.col) <= 2 ? .92 : .45;
        const tx = x + (line.bobX - x) * pull;
        dir = tx > x ? 1 : tx < x ? -1 : dir;
        x = tx;
      }
      // Never swims into rock: a position outside deep water falls back to its home.
      if (!deepWater(t, Math.floor(x / CELL), row)) x = homeX;
      const y = t.top + (row + .5) * CELL + Math.round(Math.sin(time * .9 + phase * 2) * 2) * ART;
      const slot = out[n] ?? (out[n] = { x: 0, y: 0, dir: 1, size: 1 });
      slot.x = Math.round(x / ART) * ART; slot.y = Math.round(y / ART) * ART; slot.dir = dir; slot.size = 1.5 + ((h >>> 12) % 3) * .25;
      n++;
    }
  }
  return n;
}

/** Draw `count` shadows (world px, camera applied). Pixel shapes on the art grid. */
export function drawFishShadows(c: CanvasRenderingContext2D, fish: readonly FishShadow[], count: number): void {
  if (!count) return;
  c.save();
  for (let i = 0; i < count; i++) {
    const f = fish[i], u = ART * f.size, d = f.dir;
    const x = f.x, y = f.y;
    // Body, head taper, tail fork: a dark fish seen from the side, through the water.
    c.globalAlpha = .55; c.fillStyle = '#04101a';
    c.fillRect(x - u * 3, y - u, u * 6, u * 2);
    c.fillRect(x + d * u * 3 - (d < 0 ? u : 0), y - u * .5, u, u);
    c.fillRect(x - d * u * 4 - (d > 0 ? u : 0), y - u * 1.5, u, u);
    c.fillRect(x - d * u * 4 - (d > 0 ? u : 0), y + u * .5, u, u);
    // A pale glint on the back, so a shadow in a dark cave still reads as a fish.
    c.globalAlpha = .75; c.fillStyle = '#bfefff';
    c.fillRect(x + d * u - (d < 0 ? u : 0), y - u, u, ART);
    c.globalAlpha = .35;
    c.fillRect(x - u * 2, y + u - ART, u * 3, ART);
  }
  c.restore();
}
