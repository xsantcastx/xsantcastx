/**
 * td-level.ts — a level of the top-down world, and the hand-made map format (owner, 2026-10-19: "lets make the maps").
 *
 * The surface is the endless TdWorld (hand-made places stamped into generated wilds). Everything that matters — a
 * dungeon floor, a ruin, a shrine — is drawn by hand as rows of characters, one per tile, and a legend that says what
 * each character is (its ground, an object on it, a way in or out). Easy to read in a diff, easy to redraw.
 */
import type { StationDef } from '../world/world.model';
import { anvil, bed, bones, boulder, chest, counter, forgeHearth, hearthFire, ladderUp, oreSeam, shelf, stairsDown, stairsUp, table, torchPost, TILE, type Ground, type Sprite } from './td-art';
import type { TdObject, TdStall } from './seamworks-square';
import type { MobSpawn } from './td-mobs';

/** What the engine asks of any level. */
export interface TdLevel {
  readonly id: string;
  ground(c: number, r: number): Ground;
  walkable(c: number, r: number): boolean;
  objectsIn(x0: number, y0: number, x1: number, y1: number): TdObject[];
  readonly stalls: readonly TdStall[];
  placeName(x: number, y: number): string;
  /** Always dark (a dungeon): the night pass runs at full dark whatever the hour. */
  readonly dark: boolean;
  /** Where creatures spawn in (or near) the rectangle (art px). */
  spawnsIn(x0: number, y0: number, x1: number, y1: number): MobSpawn[];
}

/** A way between levels: stand on it and use it (E, a tap) to go. */
export interface TdExit {
  /** The level it leads to: 'surface', or a hand-drawn level's id. */
  to: string;
  /** The station on that level to arrive in front of (its own way back). */
  arrive: string;
}

export type MapObject = 'ore' | 'boulder' | 'torch' | 'bones' | 'chest' | 'ladder' | 'down' | 'up' | 'table' | 'bed' | 'shelf' | 'counter' | 'hearth' | 'forge' | 'anvil';
const SPRITES: Record<MapObject, () => Sprite> = { ore: oreSeam, boulder: () => boulder(1), torch: torchPost, bones, chest, ladder: ladderUp, down: stairsDown, up: stairsUp, table, bed: () => bed(1), shelf, counter, hearth: hearthFire, forge: forgeHearth, anvil };
const BLOCKS: Partial<Record<MapObject, boolean>> = { ore: true, boulder: true, chest: true, torch: true, table: true, bed: true, shelf: true, counter: true, forge: true, anvil: true };
/** Objects wider than their tile block the tiles either side too (a forge is three tiles of stone). */
const WIDE: Partial<Record<MapObject, number>> = { forge: 1 };

export interface LegendEntry {
  ground: Ground;
  object?: MapObject;
  /** A station on this tile (the seam is the play view's mining; a ladder is an exit). */
  station?: StationDef;
  exit?: TdExit;
  /** A creature spawns here (td-mobs MOBS id). */
  mob?: string;
}

/** A hand-made map: rows of characters, one per tile, read through the legend. */
export interface TdMapDef {
  id: string;
  name: string;
  rows: readonly string[];
  legend: Readonly<Record<string, LegendEntry>>;
  /** Ground outside the drawn rows (a dungeon is solid rock round its halls). */
  outside: Ground;
  dark: boolean;
}

const T = TILE;

/**
 * Roomier passages (owner 2026-10-20: "the caves … I'm getting stuck, we need more space"): wherever a way is one tile
 * wide between rock, the rock beside it opens, twice over, so every passage drawn as one tile walks as three. Only
 * rock is opened (never the map's outer edge); everything drawn stays where it was drawn.
 */
export function widen(rows: readonly string[]): string[] {
  const w = Math.max(...rows.map(r => r.length));
  const g = rows.map(r => r.padEnd(w, '#').split(''));
  const h = g.length, rock = (c: number, r: number) => g[r]?.[c] === '#';
  for (let pass = 0; pass < 2; pass++) {
    const open: [number, number][] = [];
    for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) {
      if (g[r][c] === '#') continue;
      if (rock(c, r - 1) && rock(c, r + 1)) open.push(r + 1 < h - 1 ? [c, r + 1] : [c, r - 1]);
      if (rock(c - 1, r) && rock(c + 1, r)) open.push(c + 1 < w - 1 ? [c + 1, r] : [c - 1, r]);
    }
    for (const [c, r] of open) if (r > 0 && r < h - 1 && c > 0 && c < w - 1 && g[r][c] === '#') g[r][c] = '.';
  }
  return g.map(row => row.join(''));
}

/** A level made from a hand-made map. */
export class HandLevel implements TdLevel {
  readonly id: string;
  readonly dark: boolean;
  readonly stalls: TdStall[] = [];
  readonly exits = new Map<string, TdExit>();
  private readonly objects: TdObject[] = [];
  private readonly grid: Ground[] = [];
  private readonly blocked = new Set<number>();
  private readonly spawns: MobSpawn[] = [];
  readonly cols: number;
  readonly rows: number;

  constructor(private readonly def: TdMapDef) {
    this.id = def.id; this.dark = def.dark;
    const drawn = widen(def.rows);
    this.rows = drawn.length;
    this.cols = Math.max(...drawn.map(r => r.length));
    drawn.forEach((line, r) => {
      for (let c = 0; c < this.cols; c++) {
        const e = def.legend[line[c] ?? ' '] ?? { ground: def.outside };
        this.grid[r * this.cols + c] = e.ground;
        const x = c * T + T / 2, y = r * T + T;
        if (e.object) {
          this.objects.push({ sprite: SPRITES[e.object], x, y, kind: 'prop', ...(BLOCKS[e.object] ? { block: { w: 1, h: 1 } } : {}) });
          if (BLOCKS[e.object]) for (let dc = -(WIDE[e.object] ?? 0); dc <= (WIDE[e.object] ?? 0); dc++) if (c + dc >= 0 && c + dc < this.cols) this.blocked.add(r * this.cols + c + dc);
        }
        if (e.station) this.stalls.push({ station: e.station, x, y: y + 6 });
        if (e.exit) this.exits.set(e.station?.id ?? `exit-${c},${r}`, e.exit);
        if (e.mob) this.spawns.push({ key: `${def.id}:${c},${r}`, type: e.mob, x, y });
      }
    });
  }

  ground(c: number, r: number): Ground {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return this.def.outside;
    return this.grid[r * this.cols + c];
  }
  walkable(c: number, r: number): boolean {
    const g = this.ground(c, r);
    if (g === 'rock' || g === 'wall' || g === 'water' || g === 'ember') return false;
    return !(c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.blocked.has(r * this.cols + c));
  }
  objectsIn(x0: number, y0: number, x1: number, y1: number): TdObject[] {
    return this.objects.filter(o => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1);
  }
  placeName(): string { return this.def.name; }
  spawnsIn(): MobSpawn[] { return this.spawns; }
}

/** The Keeper's collision box at the feet (art px): small, so doorways and passages never catch. */
export const FOOT = { w: 6, h: 3 } as const;

/** Can the Keeper's feet stand at (x, y) on this level? Its four foot corners must all be walkable. */
export function footFree(level: { walkable(c: number, r: number): boolean }, x: number, y: number): boolean {
  for (const [px, py] of [[x - FOOT.w / 2, y - FOOT.h], [x + FOOT.w / 2, y - FOOT.h], [x - FOOT.w / 2, y - 1], [x + FOOT.w / 2, y - 1]]) {
    if (!level.walkable(Math.floor(px / TILE), Math.floor(py / TILE))) return false;
  }
  return true;
}

/**
 * Where to stand when arriving at (x, y) — a door, a stair, a cave mouth (owner 2026-10-20: "I get stuck frequently
 * inside caves or buildings"). The spot in front of a way in is often wall (a door on a room's bottom row, a stair
 * against the back wall), and a Keeper set down inside a wall cannot move at all. So: the asked-for spot if it is
 * free, else the nearest free spot, tile by tile outward, up to six tiles.
 */
export function standNear(level: { walkable(c: number, r: number): boolean }, x: number, y: number): { x: number; y: number } {
  if (footFree(level, x, y)) return { x, y };
  const tc = Math.floor(x / TILE), tr = Math.floor((y - 1) / TILE);
  const spots: { x: number; y: number; d: number }[] = [];
  for (let dr = -6; dr <= 6; dr++) for (let dc = -6; dc <= 6; dc++) {
    // A tile's centre, feet a little above its bottom edge.
    const sx = (tc + dc) * TILE + TILE / 2, sy = (tr + dr) * TILE + TILE - 2;
    spots.push({ x: sx, y: sy, d: Math.hypot(sx - x, sy - y) });
  }
  spots.sort((a, b) => a.d - b.d);
  for (const sp of spots) if (footFree(level, sp.x, sp.y)) return { x: sp.x, y: sp.y };
  return { x, y };
}

