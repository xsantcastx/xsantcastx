/**
 * td-world.ts — the endless top-down world (owner, 2026-10-19: "the entire world is top down … infinite").
 *
 * One seeded world, the same for everyone: the ground and the wilds' objects are pure functions of the tile, made on
 * demand in 16×16-tile chunks as the Keeper walks (and forgotten again far away). Hand-built places are stamped into
 * it: the Seamworks square sits at the origin (seamworks-square.ts), its two streets run on as roads, and its river
 * runs on east and west with a bridge wherever a road crosses.
 *
 * Pure (no DOM): sprites are produced lazily by td-art's cache when drawn.
 */
import { boulder, bush, flowerbed, hash, oreSeam, tree, TILE, type Ground } from './td-art';
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

  constructor() {
    this.town = buildSeamworksSquare();
    this.roadRow = 15; this.roadCol = 22;
  }

  get stalls(): readonly TdStall[] { return this.town.stalls; }
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
    // Roads first: the east–west street and the north–south street, cobbled near town, then packed dirt.
    const far = Math.max(Math.abs(c - this.roadCol), Math.abs(r - this.roadRow)) > 40;
    const onRow = r === this.roadRow || r === this.roadRow + 1;
    const onCol = c >= this.roadCol - 1 && c <= this.roadCol + 1;
    const rv = this.riverAt(c);
    if (onCol && r >= rv - 2 && r <= rv + 4) return 'plank';
    if (onRow || onCol) return far ? 'dirt' : 'cobble';
    // The river, with sandy banks.
    if (r >= rv && r <= rv + 2) return 'water';
    if (r === rv - 1 || r === rv + 3) return 'sand';
    // Lakes where the moisture noise is low; a sand rim round them.
    const wet = fbm(c / 26, r / 26, 101);
    if (wet < .24) return 'water';
    if (wet < .275) return 'sand';
    // Dry, rocky ground in patches; flower meadows in others.
    if (fbm(c / 18, r / 18, 211) > .7) return 'dirt';
    if (fbm(c / 12, r / 12, 307) > .66 && hash(c, r, 41) > .55) return 'flowers';
    return 'grass';
  }

  walkable(c: number, r: number): boolean {
    if (this.inTown(c, r)) return !!this.town.walkable[r * this.town.cols + c];
    const g = this.ground(c, r);
    if (g === 'water' || g === 'ember') return false;
    return !this.chunkAt(Math.floor(c / WORLD_CHUNK), Math.floor(r / WORLD_CHUNK)).blocked.has(this.key(c, r));
  }

  /** Every object whose foot lies in the rectangle (art px): the town's, then the wilds' chunk by chunk. */
  objectsIn(x0: number, y0: number, x1: number, y1: number): TdObject[] {
    const out: TdObject[] = [];
    for (const o of this.town.objects) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
    const span = WORLD_CHUNK * TILE;
    for (let cy = Math.floor(y0 / span); cy <= Math.floor(y1 / span); cy++) {
      for (let cx = Math.floor(x0 / span); cx <= Math.floor(x1 / span); cx++) {
        for (const o of this.chunkAt(cx, cy).objects) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
      }
    }
    return out;
  }

  /** Creature spawns in the wild chunks under the rectangle (none near town: the square is safe). */
  spawnsIn(x0: number, y0: number, x1: number, y1: number): MobSpawn[] {
    const out: MobSpawn[] = [], span = WORLD_CHUNK * TILE;
    for (let cy = Math.floor(y0 / span); cy <= Math.floor(y1 / span); cy++) {
      for (let cx = Math.floor(x0 / span); cx <= Math.floor(x1 / span); cx++) out.push(...this.chunkAt(cx, cy).spawns);
    }
    return out;
  }

  /**
   * A name for where the Keeper stands: the town, or the wild REGION round them. Regions are big (64×64 tiles, a long
   * walk across) and named once from their centre, so a pond or a copse never flips the name (it did, every few steps).
   */
  placeName(x: number, y: number): string {
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (c >= -6 && r >= -6 && c < this.town.cols + 6 && r < this.town.rows + 6) return 'Basalt Seamworks';
    const R = 64, rc = Math.floor(c / R) * R + R / 2, rr = Math.floor(r / R) * R + R / 2;
    if (fbm(rc / 26, rr / 26, 101) < .34) return 'Ashwater Lakes';
    if (fbm(rc / 20, rr / 20, 503) > .55) return 'The Emberwood';
    if (fbm(rc / 18, rr / 18, 211) > .6) return 'Slagstone Hills';
    return 'Cinder Meadows';
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

  /** The wilds of one chunk: trees thick in the woods, boulders on the hills, bushes and flower beds, rare ore. */
  private makeChunk(cx: number, cy: number): WildChunk {
    const objects: TdObject[] = [], blocked = new Set<number>(), spawns: MobSpawn[] = [];
    for (let r = cy * WORLD_CHUNK; r < (cy + 1) * WORLD_CHUNK; r++) {
      for (let c = cx * WORLD_CHUNK; c < (cx + 1) * WORLD_CHUNK; c++) {
        if (this.nearTown(c, r)) continue;
        const g = this.ground(c, r);
        if (g !== 'grass' && g !== 'flowers' && g !== 'dirt') continue;
        // Keep a lane clear beside the roads.
        if (Math.abs(r - this.roadRow - .5) < 2.5 || Math.abs(c - this.roadCol) < 3) continue;
        const roll = hash(c, r, 919), x = c * TILE + TILE / 2, y = r * TILE + TILE;
        const forest = fbm(c / 20, r / 20, 503);
        const treeChance = forest > .58 ? .2 : forest > .48 ? .05 : .012;
        if (g !== 'dirt' && roll < treeChance) {
          const kind = forest > .62 ? (hash(c, r, 5) < .6 ? 'pine' : 'oak') : hash(c, r, 5) < .15 ? 'fruit' : 'oak';
          const seed = Math.floor(hash(c, r, 6) * 6);
          objects.push({ sprite: () => tree(kind, seed), x, y, block: { w: 1, h: 1 }, kind: 'tree' });
          blocked.add(this.key(c, r));
        } else if (g === 'dirt' && roll < .06) {
          const seed = Math.floor(hash(c, r, 7) * 3);
          objects.push({ sprite: () => boulder(seed), x, y, block: { w: 1, h: 1 }, kind: 'prop' });
          blocked.add(this.key(c, r));
        } else if (g === 'dirt' && roll > .996) {
          objects.push({ sprite: oreSeam, x, y, block: { w: 1, h: 1 }, kind: 'prop' });
          blocked.add(this.key(c, r));
        } else if (roll > .985) {
          const seed = Math.floor(hash(c, r, 8) * 3);
          objects.push({ sprite: () => bush(seed), x, y, kind: 'prop' });
        } else if (g === 'flowers' && roll > .97) {
          objects.push({ sprite: () => flowerbed(2, (c * 31 + r) & 7), x, y, kind: 'prop' });
        }
      }
    }
    // Creatures: about one chunk in three holds a small pack, never within a few chunks of the square.
    const tc = Math.floor(this.town.cols / 2 / WORLD_CHUNK), tr = Math.floor(this.town.rows / 2 / WORLD_CHUNK);
    if (Math.max(Math.abs(cx - tc), Math.abs(cy - tr)) >= 3 && hash(cx, cy, 77) < .34) {
      const pack = 1 + Math.floor(hash(cx, cy, 78) * 3);
      for (let i = 0, tries = 0; i < pack && tries < 24; tries++) {
        const c = cx * WORLD_CHUNK + Math.floor(hash(cx * 31 + tries, cy, 79) * WORLD_CHUNK), r = cy * WORLD_CHUNK + Math.floor(hash(cx, cy * 31 + tries, 80) * WORLD_CHUNK);
        const g = this.ground(c, r);
        if ((g !== 'grass' && g !== 'flowers' && g !== 'dirt') || blocked.has(this.key(c, r))) continue;
        spawns.push({ key: `w:${c},${r}`, type: 'rivet-maw', x: c * TILE + TILE / 2, y: r * TILE + TILE });
        i++;
      }
    }
    return { objects, blocked, spawns };
  }
}
