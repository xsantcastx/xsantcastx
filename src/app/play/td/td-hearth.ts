/**
 * td-hearth.ts — The Cold Hearth in the top-down world (design-bible §5.8, roadmap §10 item 5): a hearth in every
 * capital and village, a Hearth Shrine beside each capital's, the fallen purse, and the wake veil. Pixel art only.
 *
 * Placement is derived, not hand-drawn: each settlement's hearth stands on the first open tile in rings round its
 * arrival square (every neighbour walkable, the tile in front free to stand on, clear of stalls and props), so a map
 * edit moves it a tile at most and never into a wall. The fire's own tile is then blocked, like a prop with a body.
 * The ids are stable: `hearth:<continent>:<town>` (the save keeps them, hearth-save.model.ts).
 */
import { TILE } from './td-art';
import type { TdMap } from './seamworks-square';
import type { TdWorld } from './td-world';

export interface TdHearth {
  id: string;
  continent: string;
  town: string;
  capital: boolean;
  /** The fire's foot (art px, world). */
  x: number;
  y: number;
  /** The Hearth Shrine beside a capital's hearth (its foot), or null. */
  shrine: { id: string; x: number; y: number } | null;
}

const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'town';

/** The hearth id of a settlement on a continent. */
export function hearthId(continent: string, town: string): string { return `hearth:${continent}:${slug(town)}`; }
/** The continent a hearth id names. */
export function hearthContinent(id: string): string | null { return /^hearth:([a-z0-9-]+):/.exec(id)?.[1] ?? null; }

/** Ground a fire never stands on or beside: water, lava, and (on a first pass) a bridge's or boardwalk's planks. */
const WET = new Set(['water', 'blackwater', 'ember']);
const PLANKS = new Set(['plank', 'boardwalk']);

/**
 * A tile of `map` the hearth (or the shrine) can stand on: open all round, a free tile in front, clear of things, no
 * water within two tiles; `strict` also keeps it off planks (a bridge, a pier), which only a town on stilts needs.
 */
function openTile(map: TdMap, c: number, r: number, taken: readonly { c: number; r: number }[], strict: boolean): boolean {
  const walk = (cc: number, rr: number) => cc >= 0 && rr >= 0 && cc < map.cols && rr < map.rows && !!map.walkable[rr * map.cols + cc];
  for (let dr = -1; dr <= 2; dr++) for (let dc = -1; dc <= 1; dc++) if (!walk(c + dc, r + dr)) return false;
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const g = map.ground[(r + dr) * map.cols + (c + dc)];
    if (g && (WET.has(g) || (strict && PLANKS.has(g)))) return false;
  }
  const x = c * TILE + TILE / 2, y = r * TILE + TILE;
  if (map.stalls.some(s => Math.abs(s.x - x) < TILE * 3 && Math.abs(s.y - y) < TILE * 3)) return false;
  if (map.objects.some(o => Math.abs(o.x - x) < TILE * 1.5 && Math.abs(o.y - y) < TILE * 1.5)) return false;
  return !taken.some(t => Math.abs(t.c - c) < 3 && Math.abs(t.r - r) < 3);
}

/** The nearest open tile in rings round (sc, sr), at least `min` tiles off, preferring north then east of it. */
function nearestOpen(map: TdMap, sc: number, sr: number, min: number, max: number, taken: readonly { c: number; r: number }[], strict = true): { c: number; r: number } | null {
  for (let ring = min; ring <= max; ring++) {
    const cells: { c: number; r: number; k: number }[] = [];
    for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
      // North of the square first (the fire behind the arrival, facing it), then east, then the rest.
      cells.push({ c: sc + dc, r: sr + dr, k: (dr < 0 ? 0 : dc > 0 ? 1 : 2) * 100 + Math.abs(dc) + Math.abs(dr) });
    }
    cells.sort((a, b) => a.k - b.k || a.r - b.r || a.c - b.c);
    for (const cell of cells) if (openTile(map, cell.c, cell.r, taken, strict)) return { c: cell.c, r: cell.r };
  }
  return strict ? nearestOpen(map, sc, sr, min, max, taken, false) : null;
}

const placed = new WeakMap<TdWorld, TdHearth[]>();

/**
 * The hearths of a continent, placed once per TdWorld: each one's stall (and a capital's shrine's) is added to the
 * continent and its tile blocked. Later calls return the same list.
 */
export function hearthsOf(world: TdWorld): TdHearth[] {
  const known = placed.get(world);
  if (known) return known;
  const out: TdHearth[] = [];
  world.settlements.forEach((s, i) => {
    const map = s.map, capital = i === 0;
    const sc = Math.floor(s.map.spawn.x / TILE), sr = Math.floor((s.map.spawn.y - 1) / TILE);
    const taken: { c: number; r: number }[] = [{ c: sc, r: sr }];
    const fire = nearestOpen(map, sc, sr, 2, 9, taken);
    if (!fire) return;
    taken.push(fire);
    const shrineAt = capital ? nearestOpen(map, fire.c, fire.r, 3, 6, taken) : null;
    const id = hearthId(world.continent, s.name);
    const wx = (c: number) => (s.c0 + c) * TILE + TILE / 2, wy = (r: number) => (s.r0 + r) * TILE + TILE;
    const h: TdHearth = {
      id, continent: world.continent, town: s.name, capital, x: wx(fire.c), y: wy(fire.r),
      shrine: shrineAt ? { id: `shrine:${world.continent}:${slug(s.name)}`, x: wx(shrineAt.c), y: wy(shrineAt.r) } : null,
    };
    map.walkable[fire.r * map.cols + fire.c] = 0;
    world.addStall({ station: { id, x: 0, label: 'HEARTH', kind: 'resource', blurb: `${s.name}: light it to wake here` }, x: h.x, y: h.y + 4 });
    if (shrineAt && h.shrine) {
      map.walkable[shrineAt.r * map.cols + shrineAt.c] = 0;
      world.addStall({ station: { id: h.shrine.id, x: 0, label: 'HEARTH SHRINE', kind: 'resource', blurb: 'The five Hearth Blessings' }, x: h.shrine.x, y: h.shrine.y + 4 });
    }
    out.push(h);
  });
  placed.set(world, out);
  return out;
}

// ── Pixel art ────────────────────────────────────────────────────────────────

const OUTLINE = '#2a1a24';
const STONE = ['#8a7a6e', '#6a5a52', '#4a3c3a'] as const;
const LOG = ['#7a5232', '#5a3a24', '#3a2416'] as const;
/** The flame ramp, outside in: a red rim, orange body, gold, a pale core (effects-spec fire). */
export const FLAME = ['#a8321a', '#ff6a3d', '#ffb340', '#fff0a0'] as const;

/** A hearth at its foot (X, Y): a ring of stones, crossed logs, and — lit — a stepped flame that flickers (still under reduced motion). */
export function drawHearth(c: CanvasRenderingContext2D, X: number, Y: number, lit: boolean, time: number, still: boolean): void {
  X = Math.round(X); Y = Math.round(Y);
  // Contact shadow.
  c.globalAlpha = .35; c.fillStyle = '#140c1c'; c.fillRect(X - 8, Y, 17, 1); c.globalAlpha = 1;
  // Back stones.
  for (let i = -5; i <= 5; i += 3) { c.fillStyle = OUTLINE; c.fillRect(X + i - 1, Y - 7, 4, 3); c.fillStyle = STONE[1]; c.fillRect(X + i, Y - 6, 2, 2); c.fillStyle = STONE[0]; c.fillRect(X + i, Y - 6, 1, 1); }
  // Logs, crossed.
  c.fillStyle = OUTLINE; c.fillRect(X - 6, Y - 5, 13, 3);
  c.fillStyle = lit ? LOG[1] : '#3a3038'; c.fillRect(X - 5, Y - 4, 11, 1);
  c.fillStyle = lit ? LOG[0] : '#4a4048'; c.fillRect(X - 5, Y - 5, 5, 1); c.fillRect(X + 1, Y - 3, 5, 1);
  if (lit) {
    // The flame: rows bottom up, each a step narrower; three nested colours. Its height breathes in whole pixels.
    const f = still ? 0 : Math.floor(time * 9) % 4;
    const h = 12 + [0, 1, 0, 2][f], lean = still ? 0 : [0, 1, 0, -1][Math.floor(time * 5) % 4];
    for (let i = 0; i < h; i++) {
      const k = i / h, w = Math.max(1, Math.round(11 * (1 - k * k * .9) * (1 - k * .35))), x0 = X - Math.floor(w / 2) + (i > h * .6 ? lean : 0), y = Y - 5 - i;
      c.fillStyle = FLAME[0]; c.fillRect(x0, y, w, 1);
      if (w > 2) { c.fillStyle = FLAME[1]; c.fillRect(x0 + 1, y, w - 2, 1); }
      if (w > 4 && k < .7) { c.fillStyle = FLAME[2]; c.fillRect(x0 + 2, y, w - 4, 1); }
      if (w > 6 && k < .45) { c.fillStyle = FLAME[3]; c.fillRect(x0 + 3, y, w - 6, 1); }
    }
    // Two embers rising and fading (none under reduced motion).
    if (!still) for (let e = 0; e < 2; e++) {
      const t = (time * .8 + e * .5) % 1;
      c.globalAlpha = 1 - t; c.fillStyle = FLAME[2 + e % 2];
      c.fillRect(X - 2 + e * 4 + Math.round(Math.sin(time * 3 + e) * 1.5), Y - 17 - Math.round(t * 14), 1, 1);
      c.globalAlpha = 1;
    }
  } else {
    // Cold: grey ash and one last dark coal.
    c.fillStyle = '#8a8090'; c.fillRect(X - 3, Y - 6, 7, 1); c.fillRect(X - 2, Y - 7, 4, 1);
    c.fillStyle = '#5a2a20'; c.fillRect(X, Y - 6, 1, 1);
  }
  // Front stones over the logs.
  for (let i = -7; i <= 7; i += 3) { c.fillStyle = OUTLINE; c.fillRect(X + i - 1, Y - 3, 4, 3); c.fillStyle = STONE[1]; c.fillRect(X + i, Y - 2, 2, 2); c.fillStyle = STONE[0]; c.fillRect(X + i, Y - 2, 2, 1); c.fillStyle = STONE[2]; c.fillRect(X + i + 1, Y - 1, 1, 1); }
}

/** The Hearth Shrine at its foot: a stone plinth, a brass bowl, five pips on its face — gold for each blessing held. */
export function drawShrine(c: CanvasRenderingContext2D, X: number, Y: number, held: number, time: number, still: boolean): void {
  X = Math.round(X); Y = Math.round(Y);
  c.globalAlpha = .35; c.fillStyle = '#140c1c'; c.fillRect(X - 6, Y, 13, 1); c.globalAlpha = 1;
  c.fillStyle = OUTLINE; c.fillRect(X - 6, Y - 16, 13, 16);
  c.fillStyle = STONE[1]; c.fillRect(X - 5, Y - 15, 11, 15);
  c.fillStyle = STONE[0]; c.fillRect(X - 5, Y - 15, 2, 15); c.fillRect(X - 5, Y - 15, 11, 1);
  c.fillStyle = STONE[2]; c.fillRect(X + 4, Y - 14, 2, 14); c.fillRect(X - 5, Y - 2, 11, 2);
  // The five pips, one per realm's fire.
  for (let i = 0; i < 5; i++) { c.fillStyle = i < held ? '#ffd27a' : '#2e2228'; c.fillRect(X - 4 + i * 2, Y - 8, 1, 2); }
  // The brass bowl on top.
  c.fillStyle = OUTLINE; c.fillRect(X - 6, Y - 19, 13, 4);
  c.fillStyle = '#c98a2a'; c.fillRect(X - 5, Y - 18, 11, 2);
  c.fillStyle = '#ffd27a'; c.fillRect(X - 5, Y - 18, 4, 1);
  // A small flame in the bowl while any blessing is held.
  if (held > 0) {
    const tall = still ? 4 : 3 + (Math.floor(time * 7) % 2);
    for (let i = 0; i < tall; i++) { const w = Math.max(1, 3 - i); c.fillStyle = FLAME[i === 0 ? 1 : i === 1 ? 2 : 3]; c.fillRect(X - Math.floor(w / 2), Y - 19 - i, w, 1); }
  }
}

/** The fallen purse: a leather pouch, its drawstring, a coin at the mouth, and a thin ember beam over it to find it by. */
export function drawPurse(c: CanvasRenderingContext2D, X: number, Y: number, time: number, still: boolean): void {
  X = Math.round(X); Y = Math.round(Y);
  // The beam: a single warm column, faint, breathing (fixed under reduced motion).
  const a = still ? .3 : .22 + Math.sin(time * 2.4) * .1;
  for (let i = 0; i < 28; i++) { c.globalAlpha = a * (1 - i / 28); c.fillStyle = FLAME[2]; c.fillRect(X, Y - 12 - i, 1, 1); }
  c.globalAlpha = .35; c.fillStyle = '#140c1c'; c.fillRect(X - 5, Y, 11, 1); c.globalAlpha = 1;
  const rows: readonly (readonly [number, number])[] = [[-4, 9], [-5, 11], [-5, 11], [-4, 9], [-3, 7], [-2, 5]];
  rows.forEach(([x0, w], i) => { c.fillStyle = OUTLINE; c.fillRect(X + x0 - 1, Y - 1 - i, w + 2, 1); });
  c.fillRect(X - 2, Y - 8, 5, 1);
  rows.forEach(([x0, w], i) => {
    const y = Y - 1 - i;
    c.fillStyle = i === 0 ? '#4a2e1a' : '#6a4426'; c.fillRect(X + x0, y, w, 1);
    if (i > 0) { c.fillStyle = '#8a5a34'; c.fillRect(X + x0, y, w - 2, 1); }
    if (i > 1 && i < 5) { c.fillStyle = '#b07a48'; c.fillRect(X + x0 + 1, y, 2, 1); }
  });
  // The neck, tied: a pale cord, the flared mouth, a coin peeking.
  c.fillStyle = '#d9c7a4'; c.fillRect(X - 2, Y - 7, 5, 1);
  c.fillStyle = '#6a4426'; c.fillRect(X - 3, Y - 9, 7, 1);
  c.fillStyle = '#fff0a0'; c.fillRect(X + 1, Y - 10, 1, 1);
}

/** The wake veil (screen space): the world goes dark as the Keeper falls, then the hearth's warmth comes back. */
export function drawWakeVeil(c: CanvasRenderingContext2D, w: number, h: number, dark: number, warm: number): void {
  if (dark > 0) { c.globalAlpha = Math.min(1, dark); c.fillStyle = '#140c1c'; c.fillRect(0, 0, w, h); }
  if (warm > 0) {
    // A warm frame, stepped in four bands toward the middle (no gradient: pixel bands).
    const band = Math.max(4, Math.round(Math.min(w, h) / 40));
    for (let i = 0; i < 4; i++) {
      c.globalAlpha = warm * (.28 - i * .06); c.fillStyle = FLAME[1];
      c.fillRect(i * band, i * band, w - i * band * 2, band); c.fillRect(i * band, h - (i + 1) * band, w - i * band * 2, band);
      c.fillRect(i * band, (i + 1) * band, band, h - (i + 1) * band * 2); c.fillRect(w - (i + 1) * band, (i + 1) * band, band, h - (i + 1) * band * 2);
    }
  }
  c.globalAlpha = 1;
}
