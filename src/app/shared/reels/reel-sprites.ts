/**
 * reel-sprites — procedural pixel art for the six reel symbols, until the
 * commissioned sheet lands (docs/art-commissions/world-sprites/10-reels.md).
 *
 * Each symbol is a 16×16 grid built from a few primitives (discs, a tablet, a
 * diamond), lit from the top-left, then wrapped in a one-pixel dark outline —
 * the style guide's chunky outlined pixel look. The grid becomes one SVG path
 * per colour (`shape-rendering: crispEdges`), drawn at a whole multiple so
 * every art pixel stays square.
 *
 * Pure, no DOM. Memoised: each symbol is built once.
 */
import type { ReelSymbol } from './reels.model';

export const SPRITE_SIZE = 16;
const OUTLINE = '#120c14';

export interface SpriteLayer { color: string; d: string }

type Grid = (string | null)[][];

function grid(): Grid {
  return Array.from({ length: SPRITE_SIZE }, () => Array<string | null>(SPRITE_SIZE).fill(null));
}

function disc(g: Grid, cx: number, cy: number, r: number, color: (x: number, y: number) => string | null): void {
  for (let y = 0; y < SPRITE_SIZE; y++) for (let x = 0; x < SPRITE_SIZE; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= r * r) { const c = color(x, y); if (c) g[y][x] = c; }
  }
}

function rect(g: Grid, x0: number, y0: number, w: number, h: number, color: (x: number, y: number) => string | null): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const c = color(x, y);
    if (c && y >= 0 && y < SPRITE_SIZE && x >= 0 && x < SPRITE_SIZE) g[y][x] = c;
  }
}

function dots(g: Grid, color: string, pts: readonly [number, number][]): void {
  for (const [x, y] of pts) g[y][x] = color;
}

/** Light from the top-left: three tones by distance along the light axis. */
function lit(light: string, mid: string, dark: string, cx: number, cy: number) {
  return (x: number, y: number): string => {
    const t = (x - cx) + (y - cy);
    return t < -3 ? light : t > 3 ? dark : mid;
  };
}

/** Wrap every filled pixel with a dark outline in the empty pixels around it. */
function outline(g: Grid): void {
  const add: [number, number][] = [];
  for (let y = 0; y < SPRITE_SIZE; y++) for (let x = 0; x < SPRITE_SIZE; x++) {
    if (g[y][x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx]);
    if (near) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = OUTLINE;
}

/** A rune tablet with a carved mark, the mark in `ink`. */
function tablet(ink: string, glow: string, mark: readonly [number, number][]): Grid {
  const g = grid();
  rect(g, 4, 2, 8, 12, lit('#9a94a6', '#77707f', '#55505c', 8, 8));
  rect(g, 5, 1, 6, 1, () => '#9a94a6');
  rect(g, 5, 14, 6, 1, () => '#55505c');
  dots(g, glow, mark.map(([x, y]) => [x + 1, y] as [number, number]).filter(([x]) => x < 12));
  dots(g, ink, mark);
  outline(g);
  return g;
}

const BUILD: Record<ReelSymbol, () => Grid> = {
  cinder: () => {
    const g = grid();
    const rock = lit('#7a6a6c', '#574a4e', '#3a3034', 8, 8);
    disc(g, 7, 9, 5.2, rock);
    disc(g, 10, 7, 3.6, rock);
    disc(g, 5, 7, 3, rock);
    dots(g, '#ff8a2a', [[6, 8], [7, 9], [10, 7], [9, 11], [5, 10]]);
    dots(g, '#ffd27a', [[7, 8], [10, 6]]);
    outline(g);
    return g;
  },
  ash: () => tablet('#e6e2ee', '#55505c', [[7, 4], [7, 5], [7, 6], [7, 7], [7, 8], [7, 9], [7, 10], [7, 11], [8, 5], [9, 6], [8, 7], [9, 8]]),
  ember: () => tablet('#ff8a2a', '#7a2a10', [[7, 4], [8, 5], [6, 6], [9, 6], [6, 7], [9, 7], [7, 8], [8, 8], [7, 9], [8, 10], [7, 11], [8, 11]]),
  maw: () => {
    const g = grid();
    disc(g, 8, 8, 6.4, lit('#a6a2b0', '#6d6a78', '#45424e', 8, 8));
    rect(g, 4, 9, 8, 3, () => '#1c1018');
    dots(g, '#efe6d8', [[4, 9], [6, 9], [8, 9], [10, 9], [5, 11], [7, 11], [9, 11], [11, 11]]);
    dots(g, '#ff4a3a', [[5, 6], [10, 6]]);
    dots(g, '#d8d4e0', [[3, 8], [12, 8], [8, 2], [8, 14]]);
    outline(g);
    return g;
  },
  heart: () => {
    const g = grid();
    for (let y = 2; y < 15; y++) {
      const half = y <= 7 ? y - 2 : 14 - y;
      for (let x = 8 - half - 1; x <= 8 + half; x++) {
        if (x < 0 || x >= SPRITE_SIZE) continue;
        g[y][x] = x < 8 ? (y < 7 ? '#ff9a6a' : '#e0402a') : (y < 7 ? '#e0402a' : '#8a1a1a');
      }
    }
    dots(g, '#ffe0c0', [[6, 4], [5, 5], [6, 5]]);
    dots(g, '#ffb24a', [[8, 8], [7, 9]]);
    outline(g);
    return g;
  },
  eclipse: () => {
    const g = grid();
    disc(g, 8, 8, 7, (x, y) => ((x + y) % 2 === 0 ? '#c9a0ff' : '#a855f7'));
    disc(g, 8, 8, 5.6, () => '#f2c94c');
    disc(g, 8, 8, 4.6, () => '#0a0610');
    disc(g, 9.2, 7, 3.4, () => '#1e1430');
    outline(g);
    return g;
  },
};

const cache = new Map<ReelSymbol, SpriteLayer[]>();

/** One `<path>` per colour for the symbol, in paint order. */
export function spriteLayers(symbol: ReelSymbol): SpriteLayer[] {
  const hit = cache.get(symbol);
  if (hit) return hit;
  const g = BUILD[symbol]();
  const byColor = new Map<string, string[]>();
  for (let y = 0; y < SPRITE_SIZE; y++) for (let x = 0; x < SPRITE_SIZE; x++) {
    const c = g[y][x];
    if (!c) continue;
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c)!.push(`M${x} ${y}h1v1h-1z`);
  }
  const layers = [...byColor.entries()].map(([color, parts]) => ({ color, d: parts.join('') }));
  cache.set(symbol, layers);
  return layers;
}
