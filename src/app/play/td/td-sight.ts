/**
 * td-sight.ts — line of sight and the crowd's elbow room in the top-down fight (owner 2026-10-21: "I was hitting the
 * boss behind the walls. We need to add collision, like npcs and walls, we shouldn't be able to shoot or dmg them like
 * that. Also the warlock skeletons all are like 1 on top of another").
 *
 * SIGHT is Tibia's, on the tile grid: a ray from the middle of one creature's foot tile to the middle of the other's,
 * walked tile by tile (the endpoints never count — a creature never blocks its own sight). Whatever is solid stops it:
 * a wall, rock, a stall, a tree, a shut door — anything the walkability map keeps feet off, except the low grounds a
 * shot flies over (water, embers, black water, the leaf-sea). Through a corner exactly, it is blocked only when both
 * tiles beside the corner are solid, so a diagonal gap between two pillars still sees through.
 *
 * Costs (docs/design/effects-spec.md budget): each tile's solidity is asked once per TTL and kept; each ray between two
 * tiles is walked once per TTL and kept (both directions share it); a frame casts at most RAY_BUDGET fresh rays for
 * the creatures' hunting — past it, a creature keeps what it last saw. The Keeper's own attacks are never budgeted.
 *
 * THE CROWD: the Warlock's raised and the Thornstrider's called beast stand in a loose formation behind and round the
 * Keeper (FORMATION: slots authored so no two are within a body of each other, the pet's spot left clear), fan out
 * round the foe they fight (fanSpot), and a soft push (separate) keeps any two bodies a body apart. Nothing is ever
 * pushed into a wall: every push asks the caller's `free` first.
 */
import { TILE } from './td-art';

export type Solid = (c: number, r: number) => boolean;

const OFF = 1 << 20, SPAN = 1 << 21;
/** One number for a tile (the endless surface reaches far either side of 0). */
export function tileKey(c: number, r: number): number { return (c + OFF) * SPAN + (r + OFF); }
/** The tile under a foot at (x, y) (art px): a foot stands on its tile's bottom edge. */
export function footTile(x: number, y: number): { c: number; r: number } { return { c: Math.floor(x / TILE), r: Math.floor((y - 1) / TILE) }; }

/**
 * Walk the tiles between (c0, r0) and (c1, r1), both ends left out: false at the first solid one. A ray through a
 * corner exactly is stopped only when both tiles beside the corner are solid.
 */
export function clearLine(solid: Solid, c0: number, r0: number, c1: number, r1: number): boolean {
  const dx = c1 - c0, dy = r1 - r0, nx = Math.abs(dx), ny = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
  let c = c0, r = r0;
  for (let ix = 0, iy = 0; ix < nx || iy < ny;) {
    const k = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
    if (k === 0) {
      if (solid(c + sx, r) && solid(c, r + sy)) return false;
      c += sx; r += sy; ix++; iy++;
    } else if (k < 0) { c += sx; ix++; } else { r += sy; iy++; }
    if ((c !== c1 || r !== r1) && solid(c, r)) return false;
  }
  return true;
}

/** Fresh rays a frame may cast for the creatures' hunting before they keep what they last saw. */
export const RAY_BUDGET = 400;

/** Sight on one level: the solid tiles and the rays between tiles, each asked once per TTL. */
export class TdSight {
  private readonly tiles = new Map<number, boolean>();
  private readonly rays = new Map<number, Map<number, boolean>>();
  private age = 0;
  private where = '';
  /** Fresh rays cast this frame (the budget), and since the start (the specs and the perf notes read them). */
  cast = 0;
  castTotal = 0;
  asked = 0;
  constructor(private readonly blocks: Solid, private readonly ttl = .5) {}

  /** Each frame: a new budget; every TTL, or on another level, everything is asked again (a door opened, a road rose). */
  tick(dt: number, where: string): void {
    this.age += dt; this.cast = 0;
    if (this.age >= this.ttl || where !== this.where) this.flush(where);
  }
  flush(where = this.where): void { this.tiles.clear(); this.rays.clear(); this.age = 0; this.where = where; }

  /** Is the tile solid to sight and to shots? */
  readonly solid = (c: number, r: number): boolean => {
    const k = tileKey(c, r);
    let v = this.tiles.get(k);
    if (v === undefined) { v = this.blocks(c, r); this.tiles.set(k, v); }
    return v;
  };
  /** Is the ground point (x, y) (art px) inside a solid tile? A shot's ground track asks this as it flies. */
  wallAt(x: number, y: number): boolean { return this.solid(Math.floor(x / TILE), Math.floor(y / TILE)); }

  /**
   * Can a foot at (ax, ay) see a foot at (bx, by)? `spare`: what to answer when this frame's budget is spent and the ray
   * is not known yet (unset: cast it anyway — the Keeper's own attacks).
   */
  sees(ax: number, ay: number, bx: number, by: number, spare?: boolean): boolean {
    this.asked++;
    const a = footTile(ax, ay), b = footTile(bx, by);
    if (Math.abs(a.c - b.c) <= 1 && Math.abs(a.r - b.r) <= 1) {
      // Neighbours: only a diagonal between two solid tiles stands between them.
      return !(a.c !== b.c && a.r !== b.r && this.solid(b.c, a.r) && this.solid(a.c, b.r));
    }
    let ka = tileKey(a.c, a.r), kb = tileKey(b.c, b.r), lo = a, hi = b;
    if (kb < ka) { [ka, kb] = [kb, ka]; lo = b; hi = a; }
    let row = this.rays.get(ka);
    const known = row?.get(kb);
    if (known !== undefined) return known;
    if (spare !== undefined && this.cast >= RAY_BUDGET) return spare;
    this.cast++; this.castTotal++;
    const v = clearLine(this.solid, lo.c, lo.r, hi.c, hi.r);
    if (!row) { row = new Map(); this.rays.set(ka, row); }
    row.set(kb, v);
    return v;
  }
}

// ── The crowd ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** How near two bodies of the crowd may stand (art px), and the Keeper's own elbow room. */
export const ELBOW = 17;
export const KEEPER_ELBOW = 11;

/**
 * The formation round the Keeper (art px): along = behind him (+) or before him (−), across = up (−) or down (+).
 * The first two flank the pet's spot (a step straight behind him, td-pets followSpot) instead of standing on it; no
 * two slots are within ELBOW of each other. Past the table they stand on a wide ring.
 */
const FORMATION: readonly (readonly [number, number])[] = [
  [18, -20], [18, 20], [44, 0], [0, -32], [0, 32], [46, -30], [46, 30], [70, -12], [70, 12], [-22, -38], [-22, 38], [24, -52], [24, 52],
];
export function formationSpot(i: number, k: { x: number; y: number }, face: number): { x: number; y: number } {
  const back = face < 0 ? 1 : -1;
  if (i < FORMATION.length) { const [along, across] = FORMATION[i]; return { x: k.x + back * along, y: k.y + 4 + across }; }
  const n = i - FORMATION.length, a = n * 2.399963 + (back > 0 ? 0 : Math.PI);
  return { x: k.x + Math.cos(a) * 80, y: k.y + 4 + Math.sin(a) * 56 };
}

/**
 * Where the j-th of `n` fighting one foe stands: on an arc round it facing the Keeper's side (so the raised do not
 * all bite from one pixel), `reach` from its feet.
 */
export function fanSpot(j: number, n: number, foe: { x: number; y: number }, from: { x: number; y: number }, reach: number): { x: number; y: number } {
  const a0 = Math.atan2(from.y - foe.y, from.x - foe.x), a = a0 + (j - (n - 1) / 2) * Math.min(.95, 5.8 / Math.max(1, n));
  return { x: foe.x + Math.cos(a) * reach, y: foe.y + Math.sin(a) * reach * .75 };
}

/**
 * A body in the crowd: where it stands; `fixed` ones (the Keeper, the pet) push but are never pushed; `held` ones (a
 * creature at its prey) give way only to another held one standing nearly on top of it (closer than HELD_ROOM).
 */
export interface Body { x: number; y: number; fixed?: boolean; held?: boolean; r?: number }
/** How near two held bodies may stand before they part (art px): two biters at one prey stay two sprites. */
export const HELD_ROOM = 7;

/**
 * The soft push: every pair nearer than their elbow room (the larger of their `r`, ELBOW unset) moves apart along the
 * line between them, each by up to `rate` px this frame, and only onto ground `free` says is open. Two on the very
 * same pixel part along a fixed angle from their order, so the result never depends on chance.
 */
export function separate(bodies: Body[], free: (x: number, y: number) => boolean, rate: number): void {
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (a.fixed && b.fixed) continue;
      const both = !!a.held && !!b.held, room = both ? HELD_ROOM : Math.max(a.r ?? ELBOW, b.r ?? ELBOW);
      const aFixed = a.fixed || (!!a.held && !both), bFixed = b.fixed || (!!b.held && !both);
      if (aFixed && bFixed) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) >= room || Math.abs(dy) >= room) continue;
      let d = Math.hypot(dx, dy);
      if (d >= room) continue;
      if (d < .01) { const t = (i * 7 + j * 3) * 1.3; dx = Math.cos(t); dy = Math.sin(t); d = 1; }
      const ux = dx / d, uy = dy / d, need = room - d;
      const share = aFixed || bFixed ? 1 : .5, step = Math.min(need * share, rate);
      if (!aFixed) nudge(a, -ux * step, -uy * step, free);
      if (!bFixed) nudge(b, ux * step, uy * step, free);
    }
  }
}
function nudge(o: Body, dx: number, dy: number, free: (x: number, y: number) => boolean): void {
  if (free(o.x + dx, o.y + dy)) { o.x += dx; o.y += dy; return; }
  // Along a wall: the part of the push that does not go into it.
  if (dx && free(o.x + dx, o.y)) o.x += dx;
  else if (dy && free(o.x, o.y + dy)) o.y += dy;
}
