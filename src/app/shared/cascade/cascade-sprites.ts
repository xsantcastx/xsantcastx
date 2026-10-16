/**
 * cascade-sprites — the pixel symbols of the cascade machines (14 × 14 art px).
 *
 * Eclipse Cascade: eight rune tablets (the Rune Forge's own runes, the stone
 * tinted by the rune's tier, the carved mark in the rune's colour), the moon-
 * mirror shard (wild) and the Eclipse (scatter). The Orrery Tumbler: brass and
 * star things from the Orrery Wells, the Pole Star (wild) and the Comet.
 * One grid, one 1-px outline (keeper-paint OUTLINE), light from the upper left,
 * colours from the art-bible ramps the Reels and the Orrery Wells already use.
 *
 * Pure: `spriteGrid` builds the pixels; `spriteLayers` turns them into SVG
 * paths (Details, the pay table); the component bakes each into a canvas once.
 * Memoised per machine and code.
 */
import { OUTLINE } from '../keeper-look/keeper-paint';

export const CASCADE_SPRITE = 14;

export interface SpriteLayer { color: string; d: string }
export type SpriteGrid = (string | null)[][];

function blank(): SpriteGrid {
  return Array.from({ length: CASCADE_SPRITE }, () => Array<string | null>(CASCADE_SPRITE).fill(null));
}

function put(g: SpriteGrid, x: number, y: number, c: string): void {
  if (x >= 0 && y >= 0 && x < CASCADE_SPRITE && y < CASCADE_SPRITE) g[y][x] = c;
}

/** Wrap every filled pixel with the outline in the empty pixels around it. */
function outline(g: SpriteGrid): SpriteGrid {
  const add: [number, number][] = [];
  for (let y = 0; y < CASCADE_SPRITE; y++) for (let x = 0; x < CASCADE_SPRITE; x++) {
    if (g[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx])) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = OUTLINE;
  return g;
}

/** Three tones lit from the upper left. */
function lit(light: string, mid: string, dark: string, cx = 6.5, cy = 6.5) {
  return (x: number, y: number): string => {
    const t = (x - cx) + (y - cy);
    return t < -3 ? light : t > 3 ? dark : mid;
  };
}

function disc(g: SpriteGrid, cx: number, cy: number, r: number, color: (x: number, y: number) => string | null): void {
  for (let y = 0; y < CASCADE_SPRITE; y++) for (let x = 0; x < CASCADE_SPRITE; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= r * r) { const c = color(x, y); if (c) g[y][x] = c; }
  }
}

/** A mark drawn from rows of '#' (6 wide, 8 tall), placed at (ox, oy). */
function mark(g: SpriteGrid, rows: readonly string[], ox: number, oy: number, ink: string, glow?: string): void {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '#') return;
    if (glow && !rows[y]?.[x + 1]?.startsWith('#')) put(g, ox + x + 1, oy + y, glow);
  }));
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') put(g, ox + x, oy + y, ink); }));
}

// ── Eclipse Cascade: rune tablets ───────────────────────────────────────────

/** Stone by the rune's tier (common grey, uncommon moss, rare deep blue, epic violet). */
const STONE = {
  common: ['#a9a3b5', '#7d7689', '#56505f'],
  uncommon: ['#8fae96', '#5f8068', '#3e5745'],
  rare: ['#8aa6d8', '#5674a8', '#37507a'],
  epic: ['#b896e8', '#8058b8', '#563482'],
} as const;

const RUNES: Readonly<Record<string, { stone: keyof typeof STONE; ink: string; glow: string; rows: readonly string[] }>> = {
  a: { stone: 'common', ink: '#f2eef8', glow: '#56505f', rows: ['#.....', '##....', '#.#...', '##.#..', '#.#...', '#.....', '#.....', '#.....'] },
  b: { stone: 'common', ink: '#ff8a2a', glow: '#7a2a10', rows: ['..#...', '..##..', '.#..#.', '.#..#.', '#.##.#', '#....#', '.#..#.', '..##..'] },
  c: { stone: 'uncommon', ink: '#9cf06a', glow: '#2a4a1a', rows: ['..#...', '..#.#.', '..##..', '#.#...', '.##...', '..#...', '..#...', '..#...'] },
  d: { stone: 'uncommon', ink: '#7af0ff', glow: '#1a4a5a', rows: ['..#...', '..#...', '.###..', '#####.', '.###..', '..#...', '..#...', '......'] },
  e: { stone: 'uncommon', ink: '#ff7ad8', glow: '#5a1a4a', rows: ['......', '#.....', '#..#..', '#.#.#.', '##...#', '#.....', '#.....', '......'] },
  f: { stone: 'rare', ink: '#f2c94c', glow: '#5a4410', rows: ['######', '#....#', '#.##.#', '#.##.#', '#....#', '######', '..##..', '..##..'] },
  g: { stone: 'rare', ink: '#e8f4ff', glow: '#1a2a5a', rows: ['#....#', '.#..#.', '..##..', '.####.', '..##..', '.#..#.', '#....#', '......'] },
  h: { stone: 'epic', ink: '#ff4a6a', glow: '#4a0a1a', rows: ['...##.', '..##..', '.##...', '######', '...##.', '..##..', '.##...', '##....'] },
};

function tablet(code: string): SpriteGrid {
  const r = RUNES[code];
  const [light, mid, dark] = STONE[r.stone];
  const g = blank();
  const shade = lit(light, mid, dark);
  for (let y = 1; y <= 12; y++) for (let x = 2; x <= 11; x++) {
    const corner = (y === 1 || y === 12) && (x === 2 || x === 11);
    if (!corner) g[y][x] = shade(x, y);
  }
  // A worn top edge catches the light; the foot sits in shadow.
  for (let x = 3; x <= 10; x++) { g[1][x] = light; g[12][x] = dark; }
  mark(g, r.rows, 4, 3, r.ink, r.glow);
  return outline(g);
}

/** The wild: a shard of the Archive's moon mirror. */
function shard(): SpriteGrid {
  const g = blank();
  const shade = lit('#f4ecff', '#c9a0ff', '#7a4ab8', 7, 7);
  for (let y = 0; y < CASCADE_SPRITE; y++) for (let x = 0; x < CASCADE_SPRITE; x++) {
    if (Math.abs(x + 0.5 - 7) * 1.25 + Math.abs(y + 0.5 - 7) <= 6.2) g[y][x] = shade(x, y);
  }
  for (const [x, y] of [[5, 4], [6, 3], [5, 5]] as const) put(g, x, y, '#ffffff');
  for (const [x, y] of [[8, 9], [9, 8]] as const) put(g, x, y, '#4a2a7a');
  return outline(g);
}

/** The scatter: the Eclipse, a black disc in its violet corona. */
function eclipse(): SpriteGrid {
  const g = blank();
  disc(g, 7, 7, 6.2, (x, y) => ((x + y) % 2 === 0 ? '#c9a0ff' : '#a855f7'));
  disc(g, 7, 7, 4.9, () => '#f2c94c');
  disc(g, 7, 7, 4, () => '#0a0610');
  disc(g, 8, 6, 2.8, () => '#1e1430');
  put(g, 3, 3, '#ffffff');
  return outline(g);
}

// ── The Orrery Tumbler ─────────────────────────────────────────────────────

const BRASS = ['#f2d48a', '#c9a04a', '#7a5a22'] as const;
const STEEL = ['#e8f0ff', '#a8b8d8', '#5a6a8a'] as const;

function cog(): SpriteGrid {
  const g = blank();
  const s = lit(...BRASS);
  disc(g, 7, 7, 4.6, s);
  for (const [x, y] of [[6, 1], [7, 1], [6, 12], [7, 12], [1, 6], [1, 7], [12, 6], [12, 7], [3, 3], [10, 3], [3, 10], [10, 10]] as const) put(g, x, y, s(x, y));
  disc(g, 7, 7, 1.6, () => '#2a1a0a');
  return outline(g);
}

function ingot(): SpriteGrid {
  const g = blank();
  const s = lit(...STEEL);
  for (let y = 4; y <= 10; y++) {
    const inset = Math.max(0, 6 - y) ;
    for (let x = 1 + inset; x <= 12 - inset; x++) g[y][x] = y === 4 ? STEEL[0] : s(x, y);
  }
  for (let x = 3; x <= 9; x++) put(g, x, 5, '#ffffff');
  put(g, 10, 8, '#5fb6ff');
  return outline(g);
}

function prism(): SpriteGrid {
  const g = blank();
  for (let y = 2; y <= 11; y++) {
    const half = Math.floor((y - 2) * 0.6);
    for (let x = 7 - half - 1; x <= 6 + half + 1; x++) g[y][x] = x < 7 ? (y < 7 ? '#c8f8ff' : '#7ad8f0') : '#3a8aa8';
  }
  for (const [x, y] of [[6, 4], [5, 6]] as const) put(g, x, y, '#ffffff');
  for (const [x, y] of [[8, 10], [9, 10], [10, 10]] as const) put(g, x, y, '#e8c47a');
  return outline(g);
}

function ring(): SpriteGrid {
  const g = blank();
  const s = lit(...BRASS);
  disc(g, 7, 7, 5.8, s);
  disc(g, 7, 7, 3.6, () => null);
  for (let y = 0; y < CASCADE_SPRITE; y++) for (let x = 0; x < CASCADE_SPRITE; x++) {
    const dx = x + 0.5 - 7, dy = y + 0.5 - 7;
    if (dx * dx + dy * dy <= 3.6 * 3.6) g[y][x] = null;
  }
  disc(g, 7, 7, 1.8, (x, y) => (x + y < 13 ? '#9ad0ff' : '#3a6aa8'));
  return outline(g);
}

function chain(): SpriteGrid {
  const g = blank();
  const link = (cx: number, cy: number) => {
    for (let y = 0; y < CASCADE_SPRITE; y++) for (let x = 0; x < CASCADE_SPRITE; x++) {
      const dx = (x + 0.5 - cx) / 2.6, dy = (y + 0.5 - cy) / 4;
      const d = dx * dx + dy * dy;
      if (d <= 1 && d >= 0.36) g[y][x] = x + y < cx + cy ? STEEL[0] : STEEL[1];
    }
  };
  link(5, 5);
  link(9, 9);
  put(g, 4, 2, '#ffffff');
  return outline(g);
}

function ephemeris(): SpriteGrid {
  const g = blank();
  for (let y = 2; y <= 11; y++) for (let x = 2; x <= 11; x++) g[y][x] = x === 11 || y === 11 ? '#c4a87a' : '#efe0c0';
  for (const [x, y] of [[4, 4], [8, 5], [6, 7], [9, 9], [4, 9]] as const) put(g, x, y, '#3a4a8a');
  for (const [x, y] of [[5, 5], [7, 6], [8, 8]] as const) put(g, x, y, '#8a9ad0');
  put(g, 6, 7, '#f2c94c');
  return outline(g);
}

function poleStar(): SpriteGrid {
  const g = blank();
  for (let y = 0; y < CASCADE_SPRITE; y++) for (let x = 0; x < CASCADE_SPRITE; x++) {
    const dx = Math.abs(x + 0.5 - 7), dy = Math.abs(y + 0.5 - 7);
    if (dx * dy <= 1.6 && dx + dy <= 6.4) g[y][x] = dx + dy < 2.2 ? '#ffffff' : x + y < 14 ? '#fff4c8' : '#e8c47a';
  }
  return outline(g);
}

function comet(): SpriteGrid {
  const g = blank();
  for (let i = 0; i < 7; i++) for (let w = 0; w <= Math.floor(i / 2); w++) put(g, 1 + i, 1 + i + w - Math.floor(i / 4), i < 3 ? '#3a6aa8' : '#9ad0ff');
  disc(g, 9.5, 9.5, 3.2, (x, y) => (x + y < 18 ? '#ffffff' : '#c8f0ff'));
  put(g, 8, 8, '#f2c94c');
  return outline(g);
}

const BUILD: Readonly<Record<string, Readonly<Record<string, () => SpriteGrid>>>> = {
  'eclipse-cascade': {
    a: () => tablet('a'), b: () => tablet('b'), c: () => tablet('c'), d: () => tablet('d'),
    e: () => tablet('e'), f: () => tablet('f'), g: () => tablet('g'), h: () => tablet('h'),
    W: shard, S: eclipse,
  },
  'orrery-tumbler': { a: cog, b: ingot, c: prism, d: ring, e: chain, f: ephemeris, W: poleStar, S: comet },
};

const grids = new Map<string, SpriteGrid>();

/** The pixels of one symbol (row-major, null = clear). */
export function spriteGrid(machine: string, code: string): SpriteGrid {
  const key = `${machine}:${code}`;
  let g = grids.get(key);
  if (!g) {
    const make = BUILD[machine]?.[code];
    g = make ? make() : outline(blank());
    grids.set(key, g);
  }
  return g;
}

const layers = new Map<string, SpriteLayer[]>();

/** One `<path>` per colour, for an SVG (Details' pay table). */
export function spriteLayers(machine: string, code: string): SpriteLayer[] {
  const key = `${machine}:${code}`;
  const hit = layers.get(key);
  if (hit) return hit;
  const g = spriteGrid(machine, code);
  const byColor = new Map<string, string[]>();
  for (let y = 0; y < CASCADE_SPRITE; y++) for (let x = 0; x < CASCADE_SPRITE; x++) {
    const c = g[y][x];
    if (!c) continue;
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c)!.push(`M${x} ${y}h1v1h-1z`);
  }
  const out = [...byColor.entries()].map(([color, parts]) => ({ color, d: parts.join('') }));
  layers.set(key, out);
  return out;
}

/** Every code a machine draws (for the gallery and the spec). */
export function spriteCodes(machine: string): string[] {
  return Object.keys(BUILD[machine] ?? {});
}
