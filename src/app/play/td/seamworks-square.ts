/**
 * seamworks-square.ts — the Seamworks town square, top-down (Phase 1 of
 * docs/design/top-down.md). Hand-authored as data: a ground grid, objects
 * (houses, stalls, trees, lamps, props) and the stalls' station ids.
 *
 * The stations are the town's own StationDefs (world/towns/infernal.ts), so a
 * stall opens exactly the panel the side-view station opened (onStation), and
 * `?at=` deep links, quests and the nav audit keep their ids. Keepers stand at
 * their stalls (world/life.ts TOWN_KEEPERS) in their NPC looks.
 */
import { INFERNAL_TOWN } from '../world/towns/infernal';
import { HOMESTEAD_GATE_ID } from '../world/homestead';
import { TOWN_KEEPERS } from '../world/life';
import type { StationDef } from '../world/world.model';
import { beaconPillar, mineShaft, oreSeam, brazierFountain, forgeHearth, waystone as waystone_, bench, barrel, cart, crate, fence, flowerbed, hash, hearthFire, house, lamp, signpost, stall, tree, type Ground, type Sprite, TILE } from './td-art';

export interface TdObject {
  sprite: () => Sprite;
  /** Foot position in art px (the y-sort line). */
  x: number;
  y: number;
  /** Blocked footprint in tiles, centred on the foot (w × h, h rows above the foot line). */
  block?: { w: number; h: number };
  /** A building the Keeper can stand behind: its roof fades then. */
  kind?: 'building' | 'tree' | 'prop' | 'stall';
}

export interface TdStall {
  station: StationDef;
  /** Foot of the counter (art px); the interaction spot is in front of it. */
  x: number;
  y: number;
  /** Where its keeper stands (behind the counter). */
  keeper?: { id: string; name: string; x: number; y: number };
}

export interface TdMap {
  id: string;
  /** Size in tiles. */
  cols: number;
  rows: number;
  ground: Ground[];
  objects: TdObject[];
  stalls: TdStall[];
  /** Where a new arrival stands (art px). */
  spawn: { x: number; y: number };
  /** Walkability per tile, built from the ground (water blocks) and object footprints. */
  walkable: Uint8Array;
}

const COLS = 44, ROWS = 34;
const T = TILE;

function station(id: string): StationDef | null {
  return INFERNAL_TOWN.stations.find(s => s.id === id) ?? null;
}

/** Build the square. Pure: same map every time (no Math.random). */
export function buildSeamworksSquare(): TdMap {
  const ground: Ground[] = new Array(COLS * ROWS).fill('grass');
  const set = (c: number, r: number, g: Ground) => { if (c >= 0 && r >= 0 && c < COLS && r < ROWS) ground[r * COLS + c] = g; };
  const cx = 22, cy = 15;
  // The plaza: a cobbled oval round the fountain.
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const nx = (c - cx) / 11, ny = (r - cy) / 7.5;
    if (nx * nx + ny * ny <= 1) set(c, r, 'cobble');
  }
  // Streets: north-south and east-west cobbles out of the plaza; a dirt lane to the mine head (west).
  for (let r = 0; r < ROWS; r++) { set(cx - 1, r, 'cobble'); set(cx, r, 'cobble'); set(cx + 1, r, 'cobble'); }
  for (let c = 0; c < COLS; c++) { set(c, cy, 'cobble'); set(c, cy + 1, 'cobble'); }
  for (let c = 0; c < 8; c++) for (const r of [cy - 1, cy + 2]) set(c, r, 'dirt');
  // The river across the south (blue water: the cozy town, owner 2026-10-19; the realm's fire lives in its forges), a plank bridge where the street crosses it.
  for (let c = 0; c < COLS; c++) {
    const bend = Math.round(Math.sin(c / 5) * 1.2);
    for (const r of [27 + bend, 28 + bend, 29 + bend]) set(c, r, 'water');
    set(c, 26 + bend, 'sand'); set(c, 30 + bend, 'sand');
  }
  for (let r = 25; r < 32; r++) for (const c of [cx - 1, cx, cx + 1]) set(c, r, 'plank');
  // Flower patches in the grass.
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (ground[r * COLS + c] === 'grass' && hash(c, r, 77) > .93) set(c, r, 'flowers');
  }

  const objects: TdObject[] = [];
  const add = (sprite: () => Sprite, x: number, y: number, block?: { w: number; h: number }, kind: TdObject['kind'] = 'prop') => objects.push({ sprite, x, y, block, kind });
  const tx = (c: number) => c * T + T / 2, ty = (r: number) => r * T + T;

  // Houses ring the plaza (north row, west and east sides), each a different roof/wall.
  const houses: [number, number, number, number, 'red' | 'slate' | 'thatch', 'timber' | 'stone' | 'basalt'][] = [
    [6, 4, 5, 3, 'red', 'timber'], [13, 3, 5, 3, 'slate', 'stone'], [29, 3, 5, 3, 'red', 'timber'], [36, 4, 5, 3, 'thatch', 'timber'],
    [3, 12, 4, 3, 'slate', 'basalt'], [40, 12, 4, 3, 'red', 'stone'],
    [5, 23, 5, 3, 'thatch', 'timber'], [38, 23, 5, 3, 'slate', 'timber'],
  ];
  houses.forEach(([c, r, w, d, roof, wall], i) => add(() => house(w, d, roof, wall, true, i), tx(c), ty(r), { w, h: d + 1 }, 'building'));

  // Stalls round the fountain, each a Seamworks station, its keeper behind the counter.
  const keepers = TOWN_KEEPERS.infernal;
  const stalls: TdStall[] = [];
  const stallAt = (id: string, c: number, r: number, w: number, palette: number, goods: 'pots' | 'bread' | 'gems' | 'tools' | 'books' | 'fish') => {
    const s = station(id);
    if (!s) return;
    const x = tx(c), y = ty(r);
    add(() => stall(w, palette, goods, c * 7 + r), x, y, { w, h: 1 }, 'stall');
    const k = keepers.find(k => k.station === id || (k.serves ?? []).includes(id));
    stalls.push({ station: s, x, y: y + 6, keeper: k ? { id: k.id, name: k.name, x, y: y - 14 } : undefined });
  };
  stallAt('crafting', 14, 11, 4, 0, 'tools');
  stallAt('runes', 30, 11, 4, 3, 'gems');
  stallAt('enchanting', 13, 19, 4, 1, 'books');
  stallAt('vault', 31, 19, 4, 2, 'pots');
  stallAt('vendor', 22, 22, 4, 4, 'bread');
  // The forge quest and the waystone stand on their own.
  const forge = station('forge');
  if (forge) { add(forgeHearth, tx(18), ty(8), { w: 2, h: 1 }); stalls.push({ station: forge, x: tx(18), y: ty(8) + 6 }); }
  const waystone = station('waystone');
  const waystoneSprite = () => waystone_();
  if (waystone) { add(waystoneSprite, tx(27), ty(8), { w: 1, h: 1 }); stalls.push({ station: waystone, x: tx(27), y: ty(8) + 6 }); }

  // The ways out (docs/handoff/cozy-ui.md): the Cinder Ore seam and the mine head on the west lane, the Eclipse Beacon at
  // the north road's end, the East Passage sign. Until each is rebuilt top-down, using one hands the Keeper to the old
  // view of that place and back again (the play component's side trip).
  const exit = (id: string, sprite: () => Sprite, c: number, r: number, block?: { w: number; h: number }) => {
    const st = station(id);
    if (!st) return;
    add(sprite, tx(c), ty(r), block);
    stalls.push({ station: st, x: tx(c), y: ty(r) + 6 });
  };
  exit('ore', oreSeam, 6, cy - 2, { w: 2, h: 1 });
  exit('delve', mineShaft, 2, cy, { w: 2, h: 1 });
  exit('beacon', beaconPillar, 25, 2, { w: 1, h: 1 });
  exit('passage', signpost, 42, cy - 1);
  // The Homestead: a gate sign over the bridge (the Homestead's own panel opens there; its plot comes later).
  const gate: StationDef = { id: HOMESTEAD_GATE_ID, x: 0, label: 'YOUR HOMESTEAD', kind: 'panel', panel: 'homestead', blurb: 'Your land: buildings that earn Gold.' };
  add(signpost, tx(cx + 3), ty(32));
  stalls.push({ station: gate, x: tx(cx + 3), y: ty(32) + 6 });

  // The heart of the square: the brazier fountain, the Hearth fire, benches facing them.
  add(brazierFountain, tx(cx) - T / 2, ty(cy - 1), { w: 3, h: 2 });
  add(hearthFire, tx(cx) - T / 2, ty(cy + 4));
  for (const [c, r] of [[17, 14], [27, 14], [17, 17], [27, 17]] as const) add(bench, tx(c), ty(r));
  // Lamps along the streets and round the plaza.
  for (const [c, r] of [[18, 9], [26, 9], [11, 15], [33, 15], [18, 21], [26, 21], [20, 25], [24, 25], [20, 4], [24, 4]] as const) add(lamp, tx(c), ty(r), { w: 1, h: 1 });
  // Signposts at the plaza's mouths.
  add(signpost, tx(19), ty(23)); add(signpost, tx(25), ty(7));
  // Props: barrels, crates, a produce cart, flower beds by the houses, fences by the river.
  for (const [c, r] of [[11, 7], [12, 7], [33, 7], [8, 18], [36, 18], [16, 22], [28, 22]] as const) add(barrel, tx(c), ty(r), { w: 1, h: 1 });
  for (const [c, r] of [[10, 7], [34, 7], [15, 23], [29, 23]] as const) add(crate, tx(c), ty(r), { w: 1, h: 1 });
  add(cart, tx(34), ty(20), { w: 2, h: 1 });
  for (const [c, r] of [[6, 7], [13, 6], [29, 6], [36, 7], [5, 26], [38, 26]] as const) add(() => flowerbed(2, c), tx(c), ty(r));
  for (let c = 1; c < COLS - 1; c += 4) if (Math.abs(c - cx) > 3) add(() => fence(3), tx(c) + T, ty(25));
  // Trees: an orchard edge north, scattered oaks and pines round the outskirts.
  const trees: [number, number, 'oak' | 'pine' | 'fruit'][] = [
    [1, 2, 'pine'], [3, 7, 'oak'], [10, 1, 'fruit'], [19, 1, 'oak'], [26, 1, 'oak'], [33, 1, 'fruit'], [42, 2, 'pine'], [42, 8, 'oak'],
    [1, 19, 'oak'], [42, 19, 'pine'], [10, 24, 'oak'], [33, 24, 'fruit'], [2, 32, 'pine'], [14, 33, 'oak'], [30, 33, 'oak'], [41, 32, 'pine'],
  ];
  trees.forEach(([c, r, k], i) => add(() => tree(k, i), tx(c), ty(r), { w: 1, h: 1 }, 'tree'));

  const walkable = new Uint8Array(COLS * ROWS).fill(1);
  for (let i = 0; i < ground.length; i++) if (ground[i] === 'ember' || ground[i] === 'water') walkable[i] = 0;
  // The bridge over the river is walkable.
  for (let r = 25; r < 32; r++) for (const c of [cx - 1, cx, cx + 1]) walkable[r * COLS + c] = 1;
  for (const o of objects) {
    if (!o.block) continue;
    const fc = Math.floor(o.x / T), fr = Math.floor((o.y - 1) / T);
    const c0 = fc - Math.floor((o.block.w - 1) / 2);
    for (let r = fr - o.block.h + 1; r <= fr; r++) for (let c = c0; c < c0 + o.block.w; c++) {
      if (c >= 0 && r >= 0 && c < COLS && r < ROWS) walkable[r * COLS + c] = 0;
    }
  }
  return { id: 'infernal', cols: COLS, rows: ROWS, ground, objects, stalls, spawn: { x: tx(cx), y: ty(cy + 9) }, walkable };
}
