/**
 * td-level.ts — a level of the top-down world, and the hand-made map format (owner, 2026-10-19: "lets make the maps").
 *
 * The surface is the endless TdWorld (hand-made places stamped into generated wilds). Everything that matters — a
 * dungeon floor, a ruin, a shrine — is drawn by hand as rows of characters, one per tile, and a legend that says what
 * each character is (its ground, an object on it, a way in or out). Easy to read in a diff, easy to redraw.
 */
import type { StationDef } from '../world/world.model';
import { barrel, bench, crate, lamp, altar, brazier, brokenStatue, cage, chains, cobweb, inscription, oldStain, rime, ritualCircle, anvil, barrowDoor, bed, bones, boulder, chest, gravestone, counter, forgeHearth, hearthFire, ladderUp, oreSeam, shelf, stairsDown, stairsUp, table, templePillar, rootLamp, lanternPost, greatLantern, torchPost, SOLID_GROUND, TILE, type Ground, type Sprite } from './td-art';
import type { TdObject, TdStall } from './seamworks-square';
import type { MobSpawn } from './td-mobs';
import { zoneLevel, zoneOf } from './td-zones';

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
  /** Fog over it (the Umbral Marches, the Drowned Crypts): 0 none … 1 thick. Unset: none. */
  readonly fog?: number;
  /** Where creatures spawn in (or near) the rectangle (art px). */
  spawnsIn(x0: number, y0: number, x1: number, y1: number): MobSpawn[];
  /** The zone (td-zones.ts ZONES key) at a spot: its fixed level band. */
  zoneAt(x: number, y: number): string;
}

/** A way between levels: stand on it and use it (E, a tap) to go. */
export interface TdExit {
  /** The level it leads to: 'surface', or a hand-drawn level's id. */
  to: string;
  /** The station on that level to arrive in front of (its own way back). */
  arrive: string;
}

export type MapObject = 'ore' | 'boulder' | 'torch' | 'bones' | 'chest' | 'ladder' | 'down' | 'up' | 'table' | 'bed' | 'shelf' | 'counter' | 'hearth' | 'forge' | 'anvil' | 'pillar' | 'rootlamp' | 'lantern' | 'great-lantern' | 'grave'
  // The atmosphere pass's set dressing (docs/world/campaign.md queue #4; td-dressing.ts): painted, placed by the pass.
  | 'altar' | 'brazier' | 'brazier-lit' | 'cage' | 'chains' | 'statue-broken' | 'cobweb' | 'circle' | 'inscription' | 'stain' | 'rime'
  // The isometric prototype's tavern (maps/artopt-tavern.ts).
  | 'barrel' | 'crate' | 'bench' | 'lamp';
const SPRITES: Record<MapObject, () => Sprite> = { ore: oreSeam, boulder: () => boulder(1), torch: torchPost, bones, chest, ladder: ladderUp, down: stairsDown, up: stairsUp, table, bed: () => bed(1), shelf, counter, hearth: hearthFire, forge: forgeHearth, anvil, pillar: () => templePillar(1), rootlamp: rootLamp, lantern: lanternPost, 'great-lantern': greatLantern, grave: () => gravestone(1),
  altar, brazier: () => brazier(false), 'brazier-lit': () => brazier(true), cage, chains, 'statue-broken': brokenStatue, cobweb: () => cobweb('nw'), circle: ritualCircle, inscription, stain: oldStain, rime,
  barrel, crate, bench, lamp };
const BLOCKS: Partial<Record<MapObject, boolean>> = { ore: true, boulder: true, chest: true, torch: true, table: true, bed: true, shelf: true, counter: true, forge: true, anvil: true, pillar: true, rootlamp: true, lantern: true, 'great-lantern': true, grave: true,
  altar: true, brazier: true, 'brazier-lit': true, cage: true, 'statue-broken': true, barrel: true, crate: true, bench: true, lamp: true };
/** Objects wider than their tile block the tiles either side too (a forge is three tiles of stone). */
const WIDE: Partial<Record<MapObject, number>> = { forge: 1, 'great-lantern': 1 };

export interface LegendEntry {
  ground: Ground;
  object?: MapObject;
  /** A station on this tile (the seam is the play view's mining; a ladder is an exit). */
  station?: StationDef;
  exit?: TdExit;
  /** A creature spawns here (td-mobs MOBS id). */
  mob?: string;
  /**
   * A locked door (Tibia): this tile is shut until the door with this id is opened (HandLevel.open, the key's holder),
   * then it is floor. Shut, it blocks the Keeper and every creature alike.
   */
  door?: string;
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
  /** Fog drifting over the floor (td-engine drawFog): 0 none … 1 thick. */
  fog?: number;
  /**
   * The floor's lair (owner 2026-10-26: "more combat zones, like hot spots"; td-levels FLOOR_LAIRS): a pack of `count`
   * of `types` round the lair feature farthest from the stairs (bones, an ore vein, a boulder), never in a boss's ring.
   */
  lair?: { types: readonly string[]; count: number };
}
/** What a floor's lair gathers round, best first. */
const LAIR_FEATURES: readonly MapObject[] = ['bones', 'ore', 'boulder', 'pillar'];
/** A lair stands at least this far (tiles) from every way in or out (arriving is never an ambush) and from the boss. */
const LAIR_CLEAR = 12, LAIR_BOSS = 10;

const T = TILE;
/** The floors' bosses (td-mobs rank 'boss'), by id, so a lair keeps out of their rings without reading the bestiary. */
const BOSSES = /^(ember-warden|magma-tyrant|anvil-warden|cinder-sovereign|bone-dragon|mossbound-colossus|elder-rootwyrm|ink-abbess|the-uncounted)$/;

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
  readonly fog: number;
  readonly stalls: TdStall[] = [];
  readonly exits = new Map<string, TdExit>();
  private readonly objects: TdObject[] = [];
  private readonly grid: Ground[] = [];
  private readonly blocked = new Set<number>();
  private readonly spawns: MobSpawn[] = [];
  /** Door tiles (packed index → door id) and the doors opened (the engine opens one when its key is held). */
  private readonly doorTiles = new Map<number, string>();
  readonly opened = new Set<string>();
  readonly cols: number;
  readonly rows: number;

  constructor(private readonly def: TdMapDef) {
    this.id = def.id; this.dark = def.dark; this.fog = def.fog ?? 0;
    const drawn = widen(def.rows);
    const features: { c: number; r: number; rank: number }[] = [], bossTiles: { c: number; r: number }[] = [], ways: { c: number; r: number }[] = [];
    this.rows = drawn.length;
    this.cols = Math.max(...drawn.map(r => r.length));
    drawn.forEach((line, r) => {
      for (let c = 0; c < this.cols; c++) {
        const e = def.legend[line[c] ?? ' '] ?? { ground: def.outside };
        this.grid[r * this.cols + c] = e.ground;
        const x = c * T + T / 2, y = r * T + T;
        if (e.object && LAIR_FEATURES.includes(e.object)) features.push({ c, r, rank: LAIR_FEATURES.indexOf(e.object) });
        if (e.object) {
          this.objects.push({ sprite: SPRITES[e.object], x, y, kind: 'prop', id: e.object, ...(BLOCKS[e.object] ? { block: { w: 1, h: 1 } } : {}) });
          if (BLOCKS[e.object]) for (let dc = -(WIDE[e.object] ?? 0); dc <= (WIDE[e.object] ?? 0); dc++) if (c + dc >= 0 && c + dc < this.cols) this.blocked.add(r * this.cols + c + dc);
        }
        if (e.station) this.stalls.push({ station: e.station, x, y: y + 6 });
        if (e.exit) { this.exits.set(e.station?.id ?? `exit-${c},${r}`, e.exit); ways.push({ c, r }); }
        if (e.mob) { const key = `${def.id}:${c},${r}`, z = zoneOf(def.id); this.spawns.push({ key, type: e.mob, x, y, ...(z ? { level: zoneLevel(z.band, `${def.id}|${key}`) } : {}) }); if (BOSSES.test(e.mob)) bossTiles.push({ c, r }); }
        if (e.door) {
          const id = e.door;
          this.doorTiles.set(r * this.cols + c, id);
          this.objects.push({ sprite: () => barrowDoor(this.opened.has(id)), x, y, kind: 'prop' });
        }
      }
    });
    if (def.lair) this.layLair(def.lair, features, bossTiles, ways);
  }
  /** The floor's lair: its pack round the best feature clear of the stairs and the boss (keys `<floor>:h<i>`). */
  private layLair(lair: NonNullable<TdMapDef['lair']>, features: { c: number; r: number; rank: number }[], bosses: { c: number; r: number }[], stalls: { c: number; r: number }[]): void {
    const clear = (c: number, r: number) => stalls.every(s => Math.hypot(s.c - c, s.r - r) >= LAIR_CLEAR) && bosses.every(b => Math.hypot(b.c - c, b.r - r) >= LAIR_BOSS);
    const far = (f: { c: number; r: number }) => Math.min(99, ...stalls.map(s => Math.hypot(s.c - f.c, s.r - f.r)));
    let at: { c: number; r: number } | undefined = features.filter(f => clear(f.c, f.r)).sort((a, b) => a.rank - b.rank || far(b) - far(a))[0];
    // No feature clear of the stairs and the boss: the open ground farthest from the stairs (the floor's deep end).
    if (!at) {
      let best = -1;
      for (let r = 1; r < this.rows - 1; r++) for (let c = 1; c < this.cols - 1; c++) {
        if (!this.walkable(c, r) || !clear(c, r) || ![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dc, dr]) => this.walkable(c + dc, r + dr))) continue;
        const f = far({ c, r });
        if (f > best) { best = f; at = { c, r }; }
      }
    }
    if (!at) return;
    const z = zoneOf(this.id);
    for (let i = 0, tries = 0; i < lair.count && tries < 40; tries++) {
      const a = tries * 2.39996, d = 1.5 + (tries % 3);
      const c = Math.round(at.c + Math.cos(a) * d), r = Math.round(at.r + Math.sin(a) * d);
      const x = c * T + T / 2, y = r * T + T;
      if (!this.walkable(c, r) || !clear(c, r) || this.spawns.some(s => Math.abs(s.x - x) < T && Math.abs(s.y - y) < T)) continue;
      const key = `${this.id}:h${i}`;
      this.spawns.push({ key, type: lair.types[i % lair.types.length], x, y, ...(z ? { level: zoneLevel(z.band, `${this.id}|${key}`) } : {}) });
      i++;
    }
  }

  ground(c: number, r: number): Ground {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return this.def.outside;
    return this.grid[r * this.cols + c];
  }
  walkable(c: number, r: number): boolean {
    const g = this.ground(c, r);
    if (SOLID_GROUND.has(g) || g === 'water' || g === 'ember') return false;
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    const door = this.doorTiles.get(r * this.cols + c);
    if (door !== undefined && !this.opened.has(door)) return false;
    return !this.blocked.has(r * this.cols + c);
  }
  /** The doors drawn on this level (ids). */
  get doors(): string[] { return [...new Set(this.doorTiles.values())]; }
  /** Open a door for good (this session; the host re-opens it from the save on the way in). */
  open(id: string): boolean {
    if (!this.doors.includes(id) || this.opened.has(id)) return false;
    this.opened.add(id);
    return true;
  }
  objectsIn(x0: number, y0: number, x1: number, y1: number): TdObject[] {
    return this.objects.filter(o => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1);
  }
  placeName(): string { return this.def.name; }
  /** A floor or a house is one zone, its own id. */
  zoneAt(): string { return this.def.id; }
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

