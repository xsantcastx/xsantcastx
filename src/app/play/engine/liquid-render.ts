/**
 * liquid-render.ts — drawing water and lava. Render-only: nothing here moves
 * a drop (liquids.ts does).
 *
 * Liquids are drawn after the figures and before the darkness, so a Keeper
 * wading reads as *in* the water (it is translucent over them) and lava hides
 * what sinks into it. Every edge is on the 2 px art grid: a level is 2 art px.
 * Per row, runs of cells with the same liquid, level and depth band are one
 * rect, so a lake is a handful of fills, not one per cell. The surface gets a
 * 1-art-px lip and a 2-frame shimmer (water sparkle, lava churn) on its own
 * pixels only; reduced motion holds frame 0. Palettes are the spec's
 * (docs/world/delve-and-beyond.md §4.1) until the W7L art lands.
 *
 * Lava is emissive: `lavaLights` adds its surface to the light grid as extra
 * samples (never one of the 24 capped light slots).
 */
import { CELL, LIQUID_FULL, LIQUID_INK, LIQUID_LAVA, LIQUID_WATER, Terrain } from './terrain';
import { ART } from './tile-art';
import { LEVEL_PX } from './liquids';
import type { LightPool } from './lighting';

interface LiquidLook { body: readonly [string, string, string]; alpha: number; lip: string; fleck: string; fleck2: string }
/** Body (surface row, one down, deeper), its alpha, the lip, and the shimmer flecks. */
export const LIQUID_LOOK: Readonly<Record<number, LiquidLook>> = {
  [LIQUID_WATER]: { body: ['#2e6e9a', '#1e4a6a', '#0e2a3a'], alpha: .6, lip: '#86d2e6', fleck: '#d0f6ff', fleck2: '#86d2e6' },
  [LIQUID_LAVA]: { body: ['#E8752A', '#c4501e', '#7a2a12'], alpha: 1, lip: '#ffd08a', fleck: '#ff9b4f', fleck2: '#ffd08a' },
  // Ink (the Umbral's underside): near-opaque violet-black, a cold lip that catches the lantern.
  [LIQUID_INK]: { body: ['#1a1030', '#120a22', '#080412'], alpha: .94, lip: '#6a4adf', fleck: '#a48bff', fleck2: '#6a4adf' },
};

/** A fixed hash per cell, for where the flecks sit. */
function hash(col: number, row: number): number {
  let h = (col * 73856093) ^ (row * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** How deep under its column's surface a liquid cell sits: 0 = the surface cell, capped at 2. */
function depthBand(t: Terrain, col: number, row: number, type: number): number {
  let d = 0;
  while (d < 2 && row - d - 1 >= 0) {
    const above = t.index(col, row - d - 1);
    if (!t.liqLevel[above] || t.liqType[above] !== type) break;
    d++;
  }
  return d;
}

/**
 * Draw the liquids in cells [c0, c1] × [r0, r1]. `c` is in world px (camera
 * applied). `frame` picks the shimmer frame (0/1); reduced motion passes 0.
 */
export function drawLiquids(c: CanvasRenderingContext2D, t: Terrain, c0: number, c1: number, r0: number, r1: number, frame: number): void {
  const level = t.liqLevel, kind = t.liqType;
  const alpha = c.globalAlpha;
  for (let row = Math.max(0, r0); row <= Math.min(t.rows - 1, r1); row++) {
    const bottom = t.top + (row + 1) * CELL;
    let col = Math.max(t.colLo, c0);
    const end = Math.min(t.colHi - 1, c1);
    while (col <= end) {
      const i = t.index(col, row);
      const l = level[i];
      if (!l) { col++; continue; }
      const type = kind[i];
      const look = LIQUID_LOOK[type];
      if (!look) { col++; continue; }
      const band = depthBand(t, col, row, type);
      // Extend the run while the next cell looks the same.
      let run = 1;
      while (col + run <= end) {
        const j = t.index(col + run, row);
        if (level[j] !== l || kind[j] !== type || depthBand(t, col + run, row, type) !== band) break;
        run++;
      }
      const x = col * CELL, w = run * CELL, h = l * LEVEL_PX, y = bottom - h;
      c.globalAlpha = alpha * look.alpha;
      c.fillStyle = look.body[band];
      c.fillRect(x, y, w, h);
      if (band === 0) {
        // The surface: a deeper body band under the top 2 art px, then the lip.
        if (h > ART * 4) { c.fillStyle = look.body[1]; c.fillRect(x, y + ART * 3, w, h - ART * 3); }
        c.globalAlpha = alpha * Math.min(1, look.alpha + .3);
        c.fillStyle = look.lip;
        c.fillRect(x, y, w, ART);
        // Shimmer: a few art pixels per cell, at fixed spots, two frames.
        c.fillStyle = frame ? look.fleck2 : look.fleck;
        for (let k = 0; k < run; k++) {
          const hh = hash(col + k, row + frame * 7), cx = x + k * CELL;
          // An art-px column 0..13 of the cell (two art px wide at most), on the lip or just under it.
          c.fillRect(cx + Math.min(13, hh & 15) * ART, y + ((hh >> 4) & 1) * ART, ART * (1 + ((hh >> 5) & 1)), ART);
          if (type === LIQUID_LAVA && h > ART * 3) {
            // Churn: a fleck rolling in the top of the body.
            c.fillStyle = look.fleck;
            c.fillRect(cx + Math.min(14, (hh >> 6) & 15) * ART, y + ART * (2 + ((hh >> 10) & 1)), ART, ART);
            c.fillStyle = frame ? look.fleck2 : look.fleck;
          }
        }
      }
      col += run;
    }
  }
  c.globalAlpha = alpha;
}

/**
 * Lava's own light: one sample source per pair of visible surface cells, into
 * `pool` (uncapped extra lights; lighting.ts `lightGrid` takes them after the
 * capped ones). Returns how many were added.
 */
export function lavaLights(t: Terrain, c0: number, c1: number, r0: number, r1: number, pool: LightPool, flicker = 1): number {
  let added = 0;
  for (let row = Math.max(0, r0 - 3); row <= Math.min(t.rows - 1, r1 + 3); row++) {
    for (let col = Math.max(t.colLo, c0 - 3); col <= Math.min(t.colHi - 1, c1 + 3); col++) {
      const i = t.index(col, row);
      if (!t.liqLevel[i] || t.liqType[i] !== LIQUID_LAVA || (col & 1)) continue;
      if (row > 0 && t.liqLevel[i - t.cols] && t.liqType[i - t.cols] === LIQUID_LAVA) continue;
      const y = t.top + (row + 1) * CELL - t.liqLevel[i] * LEVEL_PX;
      pool.add(col * CELL + CELL, y, CELL * 3.6 * flicker, .6);
      added++;
    }
  }
  return added;
}

/** The full-cell level, re-exported for callers that draw bars. */
export { LIQUID_FULL };
