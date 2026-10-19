/**
 * td-level.ts — a level of the top-down world, and the hand-made map format (owner, 2026-10-19: "lets make the maps").
 *
 * The surface is the endless TdWorld (hand-made places stamped into generated wilds). Everything that matters — a
 * dungeon floor, a ruin, a shrine — is drawn by hand as rows of characters, one per tile, and a legend that says what
 * each character is (its ground, an object on it, a way in or out). Easy to read in a diff, easy to redraw.
 */
import type { StationDef } from '../world/world.model';
import { bones, boulder, chest, ladderUp, oreSeam, torchPost, TILE, type Ground, type Sprite } from './td-art';
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
export interface TdExit { to: string; /** Where to arrive on the other level (art px). */ at: { x: number; y: number } }

export type MapObject = 'ore' | 'boulder' | 'torch' | 'bones' | 'chest' | 'ladder';
const SPRITES: Record<MapObject, () => Sprite> = { ore: oreSeam, boulder: () => boulder(1), torch: torchPost, bones, chest, ladder: ladderUp };
const BLOCKS: Partial<Record<MapObject, boolean>> = { ore: true, boulder: true, chest: true, torch: true };

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
  private readonly cols: number;
  private readonly rows: number;

  constructor(private readonly def: TdMapDef) {
    this.id = def.id; this.dark = def.dark;
    this.rows = def.rows.length;
    this.cols = Math.max(...def.rows.map(r => r.length));
    def.rows.forEach((line, r) => {
      for (let c = 0; c < this.cols; c++) {
        const e = def.legend[line[c] ?? ' '] ?? { ground: def.outside };
        this.grid[r * this.cols + c] = e.ground;
        const x = c * T + T / 2, y = r * T + T;
        if (e.object) {
          this.objects.push({ sprite: SPRITES[e.object], x, y, kind: 'prop', ...(BLOCKS[e.object] ? { block: { w: 1, h: 1 } } : {}) });
          if (BLOCKS[e.object]) this.blocked.add(r * this.cols + c);
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
    if (g === 'rock' || g === 'water' || g === 'ember') return false;
    return !(c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.blocked.has(r * this.cols + c));
  }
  objectsIn(x0: number, y0: number, x1: number, y1: number): TdObject[] {
    return this.objects.filter(o => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1);
  }
  placeName(): string { return this.def.name; }
  spawnsIn(): MobSpawn[] { return this.spawns; }
}
