/**
 * td-world.ts — the surface: Ember Isle, drawn by hand (maps/ember-isle.ts; owner 2026-10-20: "that map is trash,
 * we need inspiration from tibia"). The region map says what every part of the island is — coast, meadow, woods,
 * hills, mountain, ashfields, lake — and this file gives each its ground and its things (trees thick in the
 * Emberwood, boulders on the hills, lava pools in the ash), the hand-drawn roads, the places worth finding, and who
 * lives where. Region borders are wobbled so the blocks never show. The sea runs on round the island for ever.
 * The Seamworks square is stamped at tile (0, 0); its river crosses the island and runs into the sea both ways.
 *
 * Pure (no DOM): sprites are produced lazily by td-art's cache when drawn. Made on demand in 16×16-tile chunks.
 */
import { beaconPillar, boulder, bush, caveMouth, cryptDoor, fern, forgeGate, giantTree, gravestone, jungleTree, ship, flowerbed, hash, oreSeam, rootLamp, ruinWall, standingStone, stump, templeGate, templePillar, tree, swampTree, reeds, gloomcap, lanternPost, SOLID_GROUND, TILE, type Ground } from './td-art';
import { BLOCK, EMBER_ISLE_DEF } from './maps/ember-isle';
import type { ContinentDef, Region } from './continent';
import { type TdMap, type TdObject, type TdStall } from './seamworks-square';
import type { TdLevel } from './td-level';
import type { MobSpawn } from './td-mobs';
import { onNightroad, onNook } from './td-dark';

export const WORLD_CHUNK = 16;
/** A graveyard's stones (tiles from its centre), and where its Bone Walkers rise between them. */
const GRAVES: readonly (readonly [number, number])[] = [[-4, -2], [-2, -2], [2, -2], [4, -2], [-4, 2], [-2, 2], [2, 2], [4, 2], [-5, 0], [5, 0]];
const GRAVE_WALKERS: readonly (readonly [number, number])[] = [[-3, 0], [3, 0], [0, 3], [0, -2]];
/** A harbour pier's length in tiles. */
const PIER = 10;
/** Clear ground round the stamped town before the wilds begin (tiles). */
const TOWN_MARGIN = 3;
/** Chunks of wild objects kept in memory. */
const KEEP_CHUNKS = 160;

/** A further town or village, stamped at (c0, r0), its things moved there once. */
interface Village { name: string; c0: number; r0: number; map: TdMap; objects: TdObject[] }

interface WildChunk { objects: TdObject[]; blocked: Set<number>; spawns: MobSpawn[] }

/** Smooth value noise in [0, 1): bilinear over hashed lattice points, smoothstepped. */
function noise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, salt), b = hash(x0 + 1, y0, salt), c = hash(x0, y0 + 1, salt), d = hash(x0 + 1, y0 + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** Three octaves: broad shapes with a ragged edge. */
function fbm(x: number, y: number, salt: number): number {
  return noise(x, y, salt) * .57 + noise(x * 2.1, y * 2.1, salt + 7) * .29 + noise(x * 4.3, y * 4.3, salt + 13) * .14;
}

export class TdWorld implements TdLevel {
  readonly id = 'surface';
  /** Which continent this is (the engine holds one per continent; 'surface' names whichever the Keeper is on). */
  readonly continent: string;
  readonly dark = false;
  /** Fog over the continent (ContinentDef.fog: the Umbral Marches' mist). */
  readonly fog: number;
  readonly town: TdMap;
  /** The square's centre streets (tiles): they run on as the world's roads. */
  private readonly roadRow: number;
  private readonly roadCol: number;
  private readonly wild = new Map<string, WildChunk>();
  /** Trees cut down, by tile, until when (epoch ms): a stump stands there till then. */
  private readonly felled = new Map<number, number>();

  /** Road tiles (hand-drawn waypoints, 3 wide). */
  private readonly roads = new Set<number>();

  /**
   * The Nightroads (td-dark NIGHTROADS) are walkable while this is set: the engine opens them at night and under an
   * eclipse, and keeps one open while the Keeper stands on it. Their planks are drawn over the water, never baked in.
   */
  nightOpen = false;

  /** The ways on from this continent's places (a cave, a ship), by station id. */
  readonly ways = new Map<string, { to: string; arrive: string; ship: boolean }>();

  constructor(readonly def: ContinentDef = EMBER_ISLE_DEF) {
    this.continent = def.id;
    this.fog = def.fog ?? 0;
    this.town = def.town();
    this.roadRow = def.streets.row; this.roadCol = def.streets.col;
    this.allStalls = [...this.town.stalls];
    this.villages = (def.villages ?? []).map(v => {
      const map = v.build(), dx = v.c * TILE, dy = v.r * TILE;
      for (const st of map.stalls) this.allStalls.push({ ...st, x: st.x + dx, y: st.y + dy, ...(st.keeper ? { keeper: { ...st.keeper, x: st.keeper.x + dx, y: st.keeper.y + dy } } : {}) });
      return { name: v.name, c0: v.c, r0: v.r, map, objects: map.objects.map(o => ({ ...o, x: o.x + dx, y: o.y + dy })) };
    });
    for (const w of def.ways) {
      const p = def.places.find(pl => pl.kind === w.place);
      if (!p) continue;
      // A ship is boarded at the pier's end; anything else in front of the place.
      const at = w.place === 'harbour' ? { x: p.c * TILE + TILE / 2, y: (p.r + PIER - 4 + (w.along ?? 0)) * TILE + TILE } : { x: p.c * TILE + TILE / 2, y: p.r * TILE + TILE + 6 };
      this.allStalls.push({ station: w.station, ...at });
      this.ways.set(w.station.id, { to: w.to, arrive: w.arrive, ship: !!w.ship });
    }
    // A village's own ways (Cinderport's ship from its pier), at a tile of the village.
    for (const v of def.villages ?? []) for (const w of v.ways ?? []) {
      this.allStalls.push({ station: w.station, x: (v.c + w.c) * TILE + TILE / 2, y: (v.r + w.r) * TILE + TILE });
      this.ways.set(w.station.id, { to: w.to, arrive: w.arrive, ship: !!w.ship });
    }
    for (const way of def.roads) {
      for (let i = 1; i < way.length; i++) {
        const [x0, y0] = way[i - 1], [x1, y1] = way[i], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 0; k <= n; k++) {
          // A gentle wobble so a road never runs ruler-straight.
          const t = k / n, wob = Math.round(Math.sin((x0 + (x1 - x0) * t) / 7 + (y0 + (y1 - y0) * t) / 9) * .8);
          const c = Math.round(x0 + (x1 - x0) * t), r = Math.round(y0 + (y1 - y0) * t) + wob;
          for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) this.roads.add(this.key(c + dc, r + dr));
        }
      }
    }
  }

  /** The region under a tile, its border wobbled by noise so the blocks never show. */
  regionAt(c: number, r: number): Region {
    const wx = c + (noise(c / 9, r / 9, 11) - .5) * 9, wy = r + (noise(c / 9, r / 9, 12) - .5) * 9;
    return this.regionOfBlock(Math.floor(wx / BLOCK) + this.def.ox, Math.floor(wy / BLOCK) + this.def.oy);
  }
  private regionOfBlock(bx: number, by: number): Region {
    const row = this.def.map[by];
    return (row?.[bx] ?? '~') as Region;
  }


  /** The town's stalls and the island's ways in (a cave mouth). */
  private readonly allStalls: TdStall[];
  /** The continent's other towns and villages. */
  private readonly villages: Village[];
  get stalls(): readonly TdStall[] { return this.allStalls; }
  /** The town and each village, with the tile their map's (0, 0) lies on: where the hearths are placed (td-hearth.ts). */
  get settlements(): readonly { name: string; map: TdMap; c0: number; r0: number }[] {
    return [{ name: this.def.townName, map: this.town, c0: 0, r0: 0 }, ...this.villages.map(v => ({ name: v.name, map: v.map, c0: v.c0, r0: v.r0 }))];
  }
  /** A stall added after the continent was built (a hearth, a shrine: td-hearth.ts). */
  addStall(stall: TdStall): void { this.allStalls.push(stall); }
  get spawn(): { x: number; y: number } { return this.town.spawn; }
  /** Every town's and village's own things (the Map draws their roofs). */
  get settlementObjects(): readonly TdObject[] { return [...this.town.objects, ...this.villages.flatMap(v => v.objects)]; }

  /** Inside the stamped town (tiles). */
  inTown(c: number, r: number): boolean { return c >= 0 && r >= 0 && c < this.town.cols && r < this.town.rows; }
  private villageAt(c: number, r: number, margin = 0): Village | undefined {
    for (const v of this.villages) if (c >= v.c0 - margin && r >= v.r0 - margin && c < v.c0 + v.map.cols + margin && r < v.r0 + v.map.rows + margin) return v;
    return undefined;
  }
  /** A town, a village, or the clear ground round them (tiles): no elite pack ever spawns here (td-elites.ts). */
  safeAt(c: number, r: number): boolean { return this.nearTown(c, r); }
  private nearTown(c: number, r: number): boolean {
    if (this.villageAt(c, r, TOWN_MARGIN)) return true;
    return c >= -TOWN_MARGIN && r >= -TOWN_MARGIN && c < this.town.cols + TOWN_MARGIN && r < this.town.rows + TOWN_MARGIN;
  }

  /** The river's three water rows at a column (the square's own river, carried on for ever). */
  private riverAt(c: number): number { return this.def.river ? 27 + Math.round(Math.sin(c / 5) * 1.2) : -1e9; }
  /** A harbour's pier: three planks wide, running from the beach out over the sea. */
  private onPier(c: number, r: number): boolean {
    for (const p of this.def.places) if (p.kind === 'harbour' && Math.abs(c - p.c) <= 1 && r >= p.r && r < p.r + PIER) return true;
    return false;
  }

  ground(c: number, r: number): Ground {
    if (this.inTown(c, r)) return this.town.ground[r * this.town.cols + c];
    const v = this.villageAt(c, r);
    if (v) return v.map.ground[(r - v.r0) * v.map.cols + (c - v.c0)];
    if (this.onPier(c, r)) return 'plank';
    // A Nightroad's nook: a square of old stone in the water, there by day too (only its road is not).
    if (onNook(this.continent, c, r)) return 'flagstone';
    const reg = this.regionAt(c, r);
    if (reg === '~') return 'water';
    // The square's river crosses the island and runs into the sea; a road over it is a plank bridge.
    const rv = this.riverAt(c);
    const road = this.roads.has(this.key(c, r));
    if (r >= rv && r <= rv + 2 && reg !== 'm') return road ? 'plank' : 'water';
    // A Verdant river (its own region): wide water with a sandbar here and there; a road crosses it on a plank bridge.
    if (reg === 'r') return road ? 'plank' : fbm(c / 5, r / 5, 503) > .74 ? 'sand' : 'water';
    if (road) return Math.max(Math.abs(c - this.roadCol), Math.abs(r - this.roadRow)) < 30 ? this.def.roadGround?.near ?? 'cobble' : this.def.roadGround?.far ?? 'dirt';
    if (r === rv - 1 || r === rv + 3) return 'sand';
    // The coast: sand where the sea is close.
    if (reg === ',' || this.regionAt(c + 2, r) === '~' || this.regionAt(c - 2, r) === '~' || this.regionAt(c, r + 2) === '~' || this.regionAt(c, r - 2) === '~') return 'sand';
    switch (reg) {
      case 'l': return fbm(c / 6, r / 6, 31) > .78 ? 'sand' : 'water';
      case 'm': return 'rock';
      case 'h': return fbm(c / 7, r / 7, 211) > .45 ? 'dirt' : 'grass';
      case 'v': return fbm(c / 6, r / 6, 401) > .74 ? 'ember' : 'cave';
      case '.': return fbm(c / 10, r / 10, 307) > .64 && hash(c, r, 41) > .5 ? 'flowers' : 'grass';
      // The jungle: moss underfoot, a grassy break now and then; deeper in, moss only. The ruins: old flagstones in it.
      case 'j': return fbm(c / 8, r / 8, 601) > .66 ? 'grass' : 'moss';
      case 'J': return 'moss';
      case 'u': return fbm(c / 5, r / 5, 607) > .5 ? 'flagstone' : 'moss';
      // The Umbral Marches: the fen (bog, black pools), the deep fen (more water than land), the meres (black water,
      // a hummock here and there), the drowned ruins (old slabs half under the bog).
      // Round a place worth finding the bog holds firm (no black water at a door or a ring of stones).
      case 'q': return fbm(c / 6, r / 6, 701) > .66 && !this.nearPlace(c, r) ? 'blackwater' : 'mire';
      case 'Q': return fbm(c / 5, r / 5, 709) > .6 && !this.nearPlace(c, r) ? 'blackwater' : 'mire';
      case 'k': return fbm(c / 6, r / 6, 719) > .7 || this.nearPlace(c, r) ? 'mire' : 'blackwater';
      case 'x': return fbm(c / 5, r / 5, 727) > .52 ? 'wetstone' : fbm(c / 7, r / 7, 733) > .72 && !this.nearPlace(c, r) ? 'blackwater' : 'mire';
      default: return 'grass';
    }
  }

  walkable(c: number, r: number): boolean {
    if (this.inTown(c, r)) return !!this.town.walkable[r * this.town.cols + c];
    const v = this.villageAt(c, r);
    if (v) return !!v.map.walkable[(r - v.r0) * v.map.cols + (c - v.c0)];
    if (this.nightOpen && onNightroad(this.continent, c, r)) return true;
    const g = this.ground(c, r);
    if (g === 'water' || g === 'ember' || SOLID_GROUND.has(g)) return false;
    return !this.chunkAt(Math.floor(c / WORLD_CHUNK), Math.floor(r / WORLD_CHUNK)).blocked.has(this.key(c, r));
  }

  /** Every object whose foot lies in the rectangle (art px): the town's, then the wilds' chunk by chunk. */
  objectsIn(x0: number, y0: number, x1: number, y1: number): TdObject[] {
    const out: TdObject[] = [];
    for (const o of this.town.objects) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
    for (const v of this.villages) for (const o of v.objects) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
    const span = WORLD_CHUNK * TILE, now = Date.now();
    for (let cy = Math.floor(y0 / span); cy <= Math.floor(y1 / span); cy++) {
      for (let cx = Math.floor(x0 / span); cx <= Math.floor(x1 / span); cx++) {
        for (const o of this.chunkAt(cx, cy).objects) {
          if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
          // A felled tree shows its stump until it grows back.
          if (o.kind === 'tree' && (this.felled.get(this.key(Math.floor(o.x / TILE), Math.floor((o.y - 1) / TILE))) ?? 0) > now) out.push({ ...o, sprite: stump, kind: 'prop' });
          else out.push(o);
        }
      }
    }
    return out;
  }

  /** The tree standing on this tile in the wilds (not a stump), if any. */
  treeAt(c: number, r: number): TdObject | null {
    if ((this.felled.get(this.key(c, r)) ?? 0) > Date.now()) return null;
    return this.chunkAt(Math.floor(c / WORLD_CHUNK), Math.floor(r / WORLD_CHUNK)).objects.find(o => o.kind === 'tree' && Math.floor(o.x / TILE) === c && Math.floor((o.y - 1) / TILE) === r) ?? null;
  }
  /** Fell a tree: a stump for `ms`, then it grows back. */
  fell(c: number, r: number, ms: number): void { this.felled.set(this.key(c, r), Date.now() + ms); }

  /** Creature spawns in the wild chunks under the rectangle (none near town: the square is safe). */
  spawnsIn(x0: number, y0: number, x1: number, y1: number): MobSpawn[] {
    const out: MobSpawn[] = [], span = WORLD_CHUNK * TILE;
    for (let cy = Math.floor(y0 / span); cy <= Math.floor(y1 / span); cy++) {
      for (let cx = Math.floor(x0 / span); cx <= Math.floor(x1 / span); cx++) out.push(...this.chunkAt(cx, cy).spawns);
    }
    return out;
  }

  /** A name for where the Keeper stands: a place worth finding when near one, else the region (read unwobbled, so it holds steady). */
  placeName(x: number, y: number): string {
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (c >= -6 && r >= -6 && c < this.town.cols + 6 && r < this.town.rows + 6) return this.def.townName;
    const v = this.villageAt(c, r, 6);
    if (v) return v.name;
    for (const p of this.def.places) if (Math.hypot(p.c - c, p.r - r) < 10) return p.name;
    return this.def.names[this.regionOfBlock(Math.floor(c / BLOCK) + this.def.ox, Math.floor(r / BLOCK) + this.def.oy)] ?? this.def.townName;
  }

  /** Round a crypt or a graveyard the wilds stand back (no trees, rocks or bushes): a plot to walk, a door to reach. A cave mouth gets a smaller one. */
  private inClearing(c: number, r: number): boolean {
    for (const p of this.def.places) if ((p.kind === 'crypt' || p.kind === 'graveyard' || p.kind === 'forge' || p.kind === 'temple') && Math.abs(c - p.c) <= 7 && Math.abs(r - p.r) <= 6) return true;
    for (const p of this.def.places) if (p.kind === 'cave' && Math.abs(c - p.c) <= 3 && Math.abs(r - p.r) <= 3) return true;
    return false;
  }
  /** Within eight tiles of a dungeon's door the wild packs never spawn (arriving is never a death trap). */
  private nearWayIn(c: number, r: number): boolean {
    for (const p of this.def.places) if ((p.kind === 'crypt' || p.kind === 'forge' || p.kind === 'temple' || p.kind === 'cave') && Math.hypot(c - p.c, r - p.r) < 9) return true;
    return false;
  }
  private walkableGround(c: number, r: number): boolean {
    const g = this.ground(c, r);
    return g !== 'water' && g !== 'ember' && !SOLID_GROUND.has(g);
  }

  /** Within eight tiles of a place worth finding (the Marches keep their bog firm there). */
  private nearPlace(c: number, r: number): boolean {
    for (const p of this.def.places) if (Math.abs(c - p.c) <= 8 && Math.abs(r - p.r) <= 8) return true;
    return false;
  }

  /** A giant tree needs the tiles either side of its foot clear of the roads and the water. */
  private giantRoom(c: number, r: number): boolean {
    for (let dc = -2; dc <= 2; dc++) {
      const g = this.ground(c + dc, r);
      if (g !== 'moss' && g !== 'grass') return false;
      if (this.roads.has(this.key(c + dc, r)) || this.roads.has(this.key(c + dc, r + 2))) return false;
    }
    return true;
  }

  private key(c: number, r: number): number { return (c + 0x8000) * 0x10000 + (r + 0x8000); }

  private chunkAt(cx: number, cy: number): WildChunk {
    const k = `${cx},${cy}`;
    let ch = this.wild.get(k);
    if (ch) { this.wild.delete(k); this.wild.set(k, ch); return ch; }   // most recently used last
    ch = this.makeChunk(cx, cy);
    this.wild.set(k, ch);
    if (this.wild.size > KEEP_CHUNKS) this.wild.delete(this.wild.keys().next().value!);
    return ch;
  }

  /** The things of one chunk, by region: trees thick in the Emberwood, boulders on the hills, the places worth finding. */
  private makeChunk(cx: number, cy: number): WildChunk {
    const objects: TdObject[] = [], blocked = new Set<number>(), spawns: MobSpawn[] = [];
    const put = (o: TdObject, c: number, r: number) => { objects.push(o); if (o.block) blocked.add(this.key(c, r)); };
    for (let r = cy * WORLD_CHUNK; r < (cy + 1) * WORLD_CHUNK; r++) {
      for (let c = cx * WORLD_CHUNK; c < (cx + 1) * WORLD_CHUNK; c++) {
        if (this.nearTown(c, r) || this.inClearing(c, r)) continue;
        const g = this.ground(c, r);
        if (g !== 'grass' && g !== 'flowers' && g !== 'dirt' && g !== 'cave' && g !== 'moss' && g !== 'flagstone' && g !== 'mire' && g !== 'wetstone') continue;
        // A clear lane beside the roads.
        if (this.roads.has(this.key(c, r)) || this.roads.has(this.key(c + 2, r)) || this.roads.has(this.key(c - 2, r)) || this.roads.has(this.key(c, r + 2)) || this.roads.has(this.key(c, r - 2))) continue;
        const reg = this.regionAt(c, r), roll = hash(c, r, 919), x = c * TILE + TILE / 2, y = r * TILE + TILE;
        const treeKind = (pine: number): 'oak' | 'pine' | 'fruit' => { const h = hash(c, r, 5); return h < pine ? 'pine' : h < pine + .12 ? 'fruit' : 'oak'; };
        const treeAt = (kind: 'oak' | 'pine' | 'fruit') => { const seed = Math.floor(hash(c, r, 6) * 6); put({ sprite: () => tree(kind, seed), x, y, block: { w: 1, h: 1 }, kind: 'tree' }, c, r); };
        if (reg === 'F') { if (roll < .34) treeAt(treeKind(.6)); else if (roll > .975) put({ sprite: () => bush(1), x, y, kind: 'prop' }, c, r); }
        else if (reg === 'f') { if (roll < .14) treeAt(treeKind(.25)); else if (roll > .98) put({ sprite: () => bush(Math.floor(hash(c, r, 8) * 3)), x, y, kind: 'prop' }, c, r); }
        else if (reg === '.') {
          if (roll < .015) treeAt(treeKind(.1));
          else if (roll > .992) put({ sprite: () => bush(2), x, y, kind: 'prop' }, c, r);
          else if (g === 'flowers' && roll > .975) put({ sprite: () => flowerbed(2, (c * 31 + r) & 7), x, y, kind: 'prop' }, c, r);
        } else if (reg === 'h') {
          if (g === 'dirt' && roll < .07) { const sd = Math.floor(hash(c, r, 7) * 3); put({ sprite: () => boulder(sd), x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r); }
          else if (g === 'dirt' && roll > .994) put({ sprite: oreSeam, x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r);
          else if (g === 'grass' && roll < .04) treeAt('pine');
        } else if (reg === 'J' || reg === 'j') {
          // The jungle: close-set jungle trees, ferns between; in the deep jungle the giants, each in its own clearing.
          const deep = reg === 'J', seed = Math.floor(hash(c, r, 6) * 6);
          if (deep && roll < .03 && ((c % WORLD_CHUNK) + WORLD_CHUNK) % WORLD_CHUNK % 5 === 2 && this.giantRoom(c, r)) {
            put({ sprite: () => giantTree(seed), x, y, block: { w: 3, h: 1 }, kind: 'tree' }, c, r);
            blocked.add(this.key(c - 1, r)); blocked.add(this.key(c + 1, r));
          } else if (roll < (deep ? .3 : .15)) put({ sprite: () => jungleTree(seed), x, y, block: { w: 1, h: 1 }, kind: 'tree' }, c, r);
          else if (roll > (deep ? .93 : .96)) put({ sprite: () => fern(seed), x, y, kind: 'prop' }, c, r);
          else if (!deep && g === 'grass' && roll > .945) put({ sprite: () => flowerbed(2, (c * 31 + r) & 7), x, y, kind: 'prop' }, c, r);
        } else if (reg === 'u') {
          // The temple ruins: broken walls and pillars in the moss, a jungle tree pushing up between.
          if (roll < .018) { const sd = Math.floor(hash(c, r, 7) * 3); put({ sprite: () => ruinWall(sd), x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r); }
          else if (roll < .04) { const sd = Math.floor(hash(c, r, 7) * 3); put({ sprite: () => templePillar(sd), x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r); }
          else if (roll < .1) put({ sprite: () => jungleTree(Math.floor(hash(c, r, 6) * 6)), x, y, block: { w: 1, h: 1 }, kind: 'tree' }, c, r);
          else if (roll > .965) put({ sprite: () => fern(Math.floor(hash(c, r, 8) * 3)), x, y, kind: 'prop' }, c, r);
        } else if (reg === 'q' || reg === 'Q' || reg === 'k' || reg === 'x') {
          // The Marches: moss-hung cypresses, reeds at the water, gloomcaps glowing in the bog; a lost lantern on a post
          // in the deep fen and the drowned ruins, still lit; broken walls where the old town went under.
          const seed = Math.floor(hash(c, r, 6) * 6), wet = this.ground(c + 1, r) === 'blackwater' || this.ground(c - 1, r) === 'blackwater' || this.ground(c, r + 1) === 'blackwater';
          const trees = reg === 'Q' ? .1 : reg === 'q' ? .055 : .03;
          if (reg === 'x' && g === 'wetstone' && roll < .03) { const sd = Math.floor(hash(c, r, 7) * 3); put({ sprite: () => ruinWall(sd), x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r); }
          else if ((reg === 'Q' || reg === 'x') && roll > .996) put({ sprite: lanternPost, x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r);
          else if (g === 'mire' && roll < trees) put({ sprite: () => swampTree(seed), x, y, block: { w: 1, h: 1 }, kind: 'tree' }, c, r);
          else if (wet && roll > .8) put({ sprite: () => reeds(seed), x, y, kind: 'prop' }, c, r);
          else if (roll > .982) put({ sprite: () => gloomcap(seed), x, y, kind: 'prop' }, c, r);
        } else if (reg === 'v') {
          if (roll < .045) { const sd = Math.floor(hash(c, r, 7) * 3); put({ sprite: () => boulder(sd), x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r); }
          else if (roll > .99) put({ sprite: oreSeam, x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r);
        }
      }
    }
    // The places worth finding, stamped where the map puts them.
    const x0 = cx * WORLD_CHUNK, y0 = cy * WORLD_CHUNK;
    for (const p of this.def.places) {
      if (p.c < x0 - PIER - 4 || p.c >= x0 + WORLD_CHUNK + PIER + 4 || p.r < y0 - PIER - 4 || p.r >= y0 + WORLD_CHUNK + PIER + 4) continue;
      const stamp = (dc: number, dr: number, sprite: () => import('./td-art').Sprite, block = true) => {
        const c = p.c + dc, r = p.r + dr;
        if (c < x0 || c >= x0 + WORLD_CHUNK || r < y0 || r >= y0 + WORLD_CHUNK) return;
        objects.push({ sprite, x: c * TILE + TILE / 2, y: r * TILE + TILE, ...(block ? { block: { w: 1, h: 1 } } : {}), kind: 'prop' });
        if (block) blocked.add(this.key(c, r));
      };
      if (p.kind === 'ruins') { stamp(-3, -2, () => ruinWall(0)); stamp(1, -3, () => ruinWall(1)); stamp(3, 1, () => ruinWall(2)); stamp(-2, 2, () => ruinWall(1)); stamp(0, 0, () => standingStone(1)); }
      else if (p.kind === 'standing-stones') { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; stamp(Math.round(Math.cos(a) * 4), Math.round(Math.sin(a) * 3), () => standingStone(i)); } }
      else if (p.kind === 'shrine') { stamp(0, 0, beaconPillar); stamp(-2, 1, () => flowerbed(2, 3), false); stamp(2, 1, () => flowerbed(2, 5), false); }
      else if (p.kind === 'cave') { stamp(0, 0, caveMouth); }
      else if (p.kind === 'caldera') { stamp(-3, 0, () => standingStone(2)); stamp(3, 0, () => standingStone(0)); }
      else if (p.kind === 'harbour') { stamp(3, PIER - 2, ship, false); stamp(-2, 1, () => standingStone(1)); }
      else if (p.kind === 'crypt' || p.kind === 'forge' || p.kind === 'temple') {
        // The mausoleum front (or the Forge's ruined gate, the temple's stepped front) is wider than its tile: the tiles either side are its walls.
        stamp(0, 0, p.kind === 'crypt' ? cryptDoor : p.kind === 'forge' ? forgeGate : templeGate);
        if (p.kind === 'temple') { stamp(-5, 2, () => templePillar(2)); stamp(5, 2, () => templePillar(1)); stamp(-3, 4, rootLamp); stamp(3, 4, rootLamp); }
        for (const dc of p.kind === 'temple' ? [-2, -1, 1, 2] : [-1, 1]) { const c = p.c + dc; if (c >= x0 && c < x0 + WORLD_CHUNK && p.r >= y0 && p.r < y0 + WORLD_CHUNK) blocked.add(this.key(c, p.r)); }
      }
      else if (p.kind === 'graveyard') {
        // Rows of graves round a bare plot; the dead walk between them (GRAVES below).
        GRAVES.forEach(([dc, dr], i) => stamp(dc, dr, () => gravestone(i)));
        stamp(0, -4, () => standingStone(2));
      }
    }
    // The graveyards' own dead: a few Bone Walkers between the graves, back again after each falls.
    for (const p of this.def.places) {
      if (p.kind !== 'graveyard') continue;
      for (const [dc, dr] of GRAVE_WALKERS) {
        const c = p.c + dc, r = p.r + dr;
        if (c < x0 || c >= x0 + WORLD_CHUNK || r < y0 || r >= y0 + WORLD_CHUNK || !this.walkableGround(c, r)) continue;
        spawns.push({ key: `g:${c},${r}`, type: 'bone-walker', x: c * TILE + TILE / 2, y: r * TILE + TILE });
      }
    }
    // Who lives here: packs by region (never near the square, never on a road).
    const tc = Math.floor(this.town.cols / 2 / WORLD_CHUNK), tr = Math.floor(this.town.rows / 2 / WORLD_CHUNK);
    const mid = this.regionAt(cx * WORLD_CHUNK + 8, cy * WORLD_CHUNK + 8), table = this.def.mobs[mid];
    const nearVillage = this.villages.some(v => Math.max(Math.abs(cx - Math.floor((v.c0 + v.map.cols / 2) / WORLD_CHUNK)), Math.abs(cy - Math.floor((v.r0 + v.map.rows / 2) / WORLD_CHUNK))) < 2);
    if (table && !nearVillage && Math.max(Math.abs(cx - tc), Math.abs(cy - tr)) >= 3 && hash(cx, cy, 77) < table.chance) {
      const pack = 1 + Math.floor(hash(cx, cy, 78) * 3);
      for (let i = 0, tries = 0; i < pack && tries < 24; tries++) {
        const c = cx * WORLD_CHUNK + Math.floor(hash(cx * 31 + tries, cy, 79) * WORLD_CHUNK), r = cy * WORLD_CHUNK + Math.floor(hash(cx, cy * 31 + tries, 80) * WORLD_CHUNK);
        const g = this.ground(c, r);
        if (g === 'water' || g === 'ember' || SOLID_GROUND.has(g) || blocked.has(this.key(c, r)) || this.roads.has(this.key(c, r)) || this.nearWayIn(c, r)) continue;
        spawns.push({ key: `w:${c},${r}`, type: table.types[Math.floor(hash(c, r, 81) * table.types.length)], x: c * TILE + TILE / 2, y: r * TILE + TILE });
        i++;
      }
    }
    return { objects, blocked, spawns };
  }
}
