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
import { beaconPillar, boulder, bush, caveMouth, flowerbed, hash, oreSeam, ruinWall, standingStone, stump, tree, TILE, type Ground } from './td-art';
import { CAVE_IN } from './maps/slagstone-cave';
import { BLOCK, EMBER_ISLE, OX, OY, PLACES, REGION_MOBS, REGION_NAMES, ROADS, type Region } from './maps/ember-isle';
import { buildSeamworksSquare, type TdMap, type TdObject, type TdStall } from './seamworks-square';
import type { TdLevel } from './td-level';
import type { MobSpawn } from './td-mobs';

export const WORLD_CHUNK = 16;
/** Clear ground round the stamped town before the wilds begin (tiles). */
const TOWN_MARGIN = 3;
/** Chunks of wild objects kept in memory. */
const KEEP_CHUNKS = 160;

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
  readonly dark = false;
  readonly town: TdMap;
  /** The square's centre streets (tiles): they run on as the world's roads. */
  private readonly roadRow: number;
  private readonly roadCol: number;
  private readonly wild = new Map<string, WildChunk>();
  /** Trees cut down, by tile, until when (epoch ms): a stump stands there till then. */
  private readonly felled = new Map<number, number>();

  /** Road tiles (hand-drawn waypoints, 3 wide). */
  private readonly roads = new Set<number>();

  constructor() {
    this.town = buildSeamworksSquare();
    this.roadRow = 15; this.roadCol = 22;
    const cave = PLACES.find(p => p.kind === 'cave');
    this.allStalls = [...this.town.stalls, ...(cave ? [{ station: CAVE_IN, x: cave.c * TILE + TILE / 2, y: cave.r * TILE + TILE + 6 }] : [])];
    for (const way of ROADS) {
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
    return this.regionOfBlock(Math.floor(wx / BLOCK) + OX, Math.floor(wy / BLOCK) + OY);
  }
  private regionOfBlock(bx: number, by: number): Region {
    const row = EMBER_ISLE[by];
    return (row?.[bx] ?? '~') as Region;
  }


  /** The town's stalls and the island's ways in (a cave mouth). */
  private readonly allStalls: TdStall[];
  get stalls(): readonly TdStall[] { return this.allStalls; }
  get spawn(): { x: number; y: number } { return this.town.spawn; }

  /** Inside the stamped town (tiles). */
  inTown(c: number, r: number): boolean { return c >= 0 && r >= 0 && c < this.town.cols && r < this.town.rows; }
  private nearTown(c: number, r: number): boolean {
    return c >= -TOWN_MARGIN && r >= -TOWN_MARGIN && c < this.town.cols + TOWN_MARGIN && r < this.town.rows + TOWN_MARGIN;
  }

  /** The river's three water rows at a column (the square's own river, carried on for ever). */
  private riverAt(c: number): number { return 27 + Math.round(Math.sin(c / 5) * 1.2); }

  ground(c: number, r: number): Ground {
    if (this.inTown(c, r)) return this.town.ground[r * this.town.cols + c];
    const reg = this.regionAt(c, r);
    if (reg === '~') return 'water';
    // The square's river crosses the island and runs into the sea; a road over it is a plank bridge.
    const rv = this.riverAt(c);
    const road = this.roads.has(this.key(c, r));
    if (r >= rv && r <= rv + 2 && reg !== 'm') return road ? 'plank' : 'water';
    if (road) return Math.max(Math.abs(c - this.roadCol), Math.abs(r - this.roadRow)) < 30 ? 'cobble' : 'dirt';
    if (r === rv - 1 || r === rv + 3) return 'sand';
    // The coast: sand where the sea is close.
    if (reg === ',' || this.regionAt(c + 2, r) === '~' || this.regionAt(c - 2, r) === '~' || this.regionAt(c, r + 2) === '~' || this.regionAt(c, r - 2) === '~') return 'sand';
    switch (reg) {
      case 'l': return fbm(c / 6, r / 6, 31) > .78 ? 'sand' : 'water';
      case 'm': return 'rock';
      case 'h': return fbm(c / 7, r / 7, 211) > .45 ? 'dirt' : 'grass';
      case 'v': return fbm(c / 6, r / 6, 401) > .74 ? 'ember' : 'cave';
      case '.': return fbm(c / 10, r / 10, 307) > .64 && hash(c, r, 41) > .5 ? 'flowers' : 'grass';
      default: return 'grass';
    }
  }

  walkable(c: number, r: number): boolean {
    if (this.inTown(c, r)) return !!this.town.walkable[r * this.town.cols + c];
    const g = this.ground(c, r);
    if (g === 'water' || g === 'ember' || g === 'rock') return false;
    return !this.chunkAt(Math.floor(c / WORLD_CHUNK), Math.floor(r / WORLD_CHUNK)).blocked.has(this.key(c, r));
  }

  /** Every object whose foot lies in the rectangle (art px): the town's, then the wilds' chunk by chunk. */
  objectsIn(x0: number, y0: number, x1: number, y1: number): TdObject[] {
    const out: TdObject[] = [];
    for (const o of this.town.objects) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
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
    if (c >= -6 && r >= -6 && c < this.town.cols + 6 && r < this.town.rows + 6) return 'Basalt Seamworks';
    for (const p of PLACES) if (Math.hypot(p.c - c, p.r - r) < 10) return p.name;
    return REGION_NAMES[this.regionOfBlock(Math.floor(c / BLOCK) + OX, Math.floor(r / BLOCK) + OY)];
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
        if (this.nearTown(c, r)) continue;
        const g = this.ground(c, r);
        if (g !== 'grass' && g !== 'flowers' && g !== 'dirt' && g !== 'cave') continue;
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
        } else if (reg === 'v') {
          if (roll < .045) { const sd = Math.floor(hash(c, r, 7) * 3); put({ sprite: () => boulder(sd), x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r); }
          else if (roll > .99) put({ sprite: oreSeam, x, y, block: { w: 1, h: 1 }, kind: 'prop' }, c, r);
        }
      }
    }
    // The places worth finding, stamped where the map puts them.
    const x0 = cx * WORLD_CHUNK, y0 = cy * WORLD_CHUNK;
    for (const p of PLACES) {
      if (p.c < x0 - 4 || p.c >= x0 + WORLD_CHUNK + 4 || p.r < y0 - 4 || p.r >= y0 + WORLD_CHUNK + 4) continue;
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
    }
    // Who lives here: packs by region (never near the square, never on a road).
    const tc = Math.floor(this.town.cols / 2 / WORLD_CHUNK), tr = Math.floor(this.town.rows / 2 / WORLD_CHUNK);
    const mid = this.regionAt(cx * WORLD_CHUNK + 8, cy * WORLD_CHUNK + 8), table = REGION_MOBS[mid];
    if (table && Math.max(Math.abs(cx - tc), Math.abs(cy - tr)) >= 3 && hash(cx, cy, 77) < table.chance) {
      const pack = 1 + Math.floor(hash(cx, cy, 78) * 3);
      for (let i = 0, tries = 0; i < pack && tries < 24; tries++) {
        const c = cx * WORLD_CHUNK + Math.floor(hash(cx * 31 + tries, cy, 79) * WORLD_CHUNK), r = cy * WORLD_CHUNK + Math.floor(hash(cx, cy * 31 + tries, 80) * WORLD_CHUNK);
        const g = this.ground(c, r);
        if (g === 'water' || g === 'ember' || g === 'rock' || blocked.has(this.key(c, r)) || this.roads.has(this.key(c, r))) continue;
        spawns.push({ key: `w:${c},${r}`, type: table.types[Math.floor(hash(c, r, 81) * table.types.length)], x: c * TILE + TILE / 2, y: r * TILE + TILE });
        i++;
      }
    }
    return { objects, blocked, spawns };
  }
}
