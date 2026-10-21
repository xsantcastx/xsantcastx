/**
 * td-seek.ts — Lumvesh, the Seek (design-bible §4.6, §5.5; Tibia's `exiva`, in Glim's voice): "The Ink Abbess is very
 * far to the south-east, below you."
 *
 * Pure: the direction in eight points, the distance band, the floor, and where every boss and every hand-drawn level
 * sits on its continent (derived from the maps' own legends and ways, never hand-written). The engine finds the
 * Keeper's place and the targets with these and shows the answer (pixel arrows, Glim's short flight, the words).
 */
import { TILE } from './td-art';
import type { TdMapDef } from './td-level';
import type { ContinentDef } from './continent';

export type Compass = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export const COMPASS: readonly Compass[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
/** How far, in Glim's words: beside you (< 5 tiles), near (< 30), far (< 120), very far (design-bible §5.5). */
export type SeekBand = 'beside' | 'near' | 'far' | 'veryFar';
export const SEEK_BANDS = { beside: 5, near: 30, far: 120 } as const;
/** Which floor: the Keeper's own, one above it, or below it. */
export type SeekFloor = 'here' | 'above' | 'below';

/** The eight-point direction of a step (dx, dy) on the map (y grows south, as on screen); null for no step at all. */
export function compass(dx: number, dy: number): Compass | null {
  if (!dx && !dy) return null;
  // 0° east, counter-clockwise; each point holds the 45° centred on it.
  const deg = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360;
  const i = Math.round(deg / 45) % 8;
  return (['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'] as const)[i];
}
export function bandOf(tiles: number): SeekBand {
  const d = Math.max(0, tiles);
  return d < SEEK_BANDS.beside ? 'beside' : d < SEEK_BANDS.near ? 'near' : d < SEEK_BANDS.far ? 'far' : 'veryFar';
}
/** Floors count up from the surface (0): a dungeon floor under it is negative, a tower's upper floor positive. */
export function floorWord(from: number, to: number): SeekFloor { return to === from ? 'here' : to < from ? 'below' : 'above'; }

/** Where something stands: its continent, the hand-drawn level it is on (null: the surface), art px there, its floor and,
 * for a level, the surface point its way in starts from (the anchor). */
export interface SeekPlace {
  continent: string;
  level: string | null;
  x: number; y: number;
  floor: number;
  ax: number; ay: number;
}
/** Glim's answer: which way, how far, which floor — or across the sea, when it is on another continent. */
export interface SeekReading { dir: Compass | null; band: SeekBand; floor: SeekFloor; tiles: number; sea: boolean }

/**
 * The reading from one place to another. On the surface it is the straight line; in a dungeon it is its way in; two
 * floors of one dungeon (the same way in) compare their own halls, as Tibia compares floors.
 */
export function seekReading(from: SeekPlace, to: SeekPlace): SeekReading {
  if (from.continent !== to.continent) return { dir: null, band: 'veryFar', floor: 'here', tiles: Infinity, sea: true };
  const sameWay = !!from.level && !!to.level && from.ax === to.ax && from.ay === to.ay;
  const fx = sameWay || !from.level ? from.x : from.ax, fy = sameWay || !from.level ? from.y : from.ay;
  const tx = sameWay || !to.level ? to.x : to.ax, ty = sameWay || !to.level ? to.y : to.ay;
  const tiles = Math.hypot(tx - fx, ty - fy) / TILE, band = bandOf(tiles);
  return { dir: band === 'beside' ? null : compass(tx - fx, ty - fy), band, floor: floorWord(from.floor, to.floor), tiles, sea: false };
}
/** How the nearest is picked: across the sea last, then by tiles, then a floor away after one here. */
export function seekCost(r: SeekReading): number { return r.sea ? 1e9 : r.tiles + (r.floor === 'here' ? 0 : 2); }

/** A way in from the surface: the level it opens onto, the continent and where it stands (art px). */
export interface SeekEntry { level: string; continent: string; x: number; y: number }
export interface LevelLink { continent: string; ax: number; ay: number; floor: number }

/**
 * The ways in from every continent's surface (a cave mouth by its place, a village's own way), where TdWorld stands
 * them (td-world.ts): ships are not ways into a level and are left out. Doors into buildings are the engine's to add.
 */
export function wayEntries(continents: Readonly<Record<string, ContinentDef>>, levels: Readonly<Record<string, TdMapDef>>): SeekEntry[] {
  const out: SeekEntry[] = [];
  for (const def of Object.values(continents)) {
    for (const w of def.ways) {
      if (w.ship || !levels[w.to]) continue;
      const p = def.places.find(pl => pl.kind === w.place);
      const [dc, dr] = w.at ?? [0, 0];
      if (p) out.push({ level: w.to, continent: def.id, x: (p.c + dc) * TILE + TILE / 2, y: (p.r + dr) * TILE + TILE + 6 });
    }
    for (const v of def.villages ?? []) for (const w of v.ways ?? []) if (!w.ship && levels[w.to]) out.push({ level: w.to, continent: def.id, x: (v.c + w.c) * TILE + TILE / 2, y: (v.r + w.r) * TILE + TILE });
  }
  return out;
}

/**
 * The ways in that stand in a town or a village (td-engine `use`): the Seamworks' mine shaft (`delve`, the Ember Mine)
 * and the building doors (`doors`: station id → level), where their stalls stand on the continent.
 */
export function townEntries(continents: Readonly<Record<string, ContinentDef>>, levels: Readonly<Record<string, TdMapDef>>, doors: Readonly<Record<string, { to: string }>>): SeekEntry[] {
  const out: SeekEntry[] = [];
  const add = (continent: string, id: string, x: number, y: number) => {
    const to = id === 'delve' ? 'ember-mine-1' : doors[id]?.to;
    if (to && levels[to]) out.push({ level: to, continent, x, y });
  };
  for (const def of Object.values(continents)) {
    for (const st of def.town().stalls) add(def.id, st.station.id, st.x, st.y);
    for (const v of def.villages ?? []) for (const st of v.build().stalls) add(def.id, st.station.id, st.x + v.c * TILE, st.y + v.r * TILE);
  }
  return out;
}

/** The object on the tile of a level's exit to `to` (up, down, a ladder — or none, a door), and whether there is one. */
function exitTo(level: TdMapDef, to: string): { found: boolean; object?: string } {
  for (const e of Object.values(level.legend)) if (e.exit?.to === to) return { found: true, object: e.object };
  return { found: false };
}
/** What an exit's object says of the floor beyond it: up a ladder or stair is +1, down is −1, a door is level. */
function step(object: string | undefined): number { return object === 'down' ? -1 : object === 'up' || object === 'ladder' ? 1 : 0; }

/**
 * Every level reachable from the surface: its continent, its way in and its floor (by the stairs between, so a mine's
 * third floor is −3 and a tower's top floor is +2).
 */
export function levelLinks(entries: readonly SeekEntry[], levels: Readonly<Record<string, TdMapDef>>): Map<string, LevelLink> {
  const out = new Map<string, LevelLink>();
  const queue: string[] = [];
  for (const e of entries) {
    const lv = levels[e.level];
    if (!lv || out.has(e.level)) continue;
    // Its own way back up says where it lies: a ladder up out of it means it is under the ground.
    const back = exitTo(lv, 'surface');
    out.set(e.level, { continent: e.continent, ax: e.x, ay: e.y, floor: -step(back.object) });
    queue.push(e.level);
  }
  while (queue.length) {
    const id = queue.shift()!, here = out.get(id)!, lv = levels[id];
    for (const e of Object.values(lv.legend)) {
      const to = e.exit?.to;
      if (!to || to === 'surface' || out.has(to) || !levels[to]) continue;
      out.set(to, { ...here, floor: here.floor + step(e.object) });
      queue.push(to);
    }
  }
  return out;
}

/** Every creature of `pick` drawn into a level (a boss in its hall): its id, the level and where it stands (art px). */
export function levelSpawns(levels: Readonly<Record<string, TdMapDef>>, pick: (mob: string) => boolean): { mob: string; level: string; x: number; y: number }[] {
  const out: { mob: string; level: string; x: number; y: number }[] = [];
  for (const lv of Object.values(levels)) {
    for (const [ch, e] of Object.entries(lv.legend)) {
      if (!e.mob || !pick(e.mob)) continue;
      lv.rows.forEach((row, r) => { const c = row.indexOf(ch); if (c >= 0) out.push({ mob: e.mob!, level: lv.id, x: c * TILE + TILE / 2, y: r * TILE + TILE - 2 }); });
    }
  }
  return out;
}
