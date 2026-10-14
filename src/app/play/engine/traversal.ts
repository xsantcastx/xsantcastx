/**
 * traversal.ts — getting down and across the Underhearth (Phase 8;
 * docs/world/delve-and-beyond.md §6.2): Bark Rope, the Thornroot Grapple,
 * and Kael's rails with the Seam Cart. Pure: no DOM, no Angular; the engine
 * owns the state and calls these each fixed step (60 Hz).
 *
 *   Rope     placed at a ledge, it spools down to the floor below in one
 *            action (up to SPOOL_MAX cells); climbed like a ladder. "It
 *            unrolls down to the floor and not a hand further."
 *   Grapple  aimed at a solid cell within GRAPPLE reach and in sight: the
 *            line grows to it (fly), then pulls the Keeper in (pull), then
 *            holds them there (hang) until they jump or move off. "Throw it
 *            and it grows the rest of the way."
 *   Rails    a cart rides a polyline through rail-cell centres: level, or
 *            one row up or down per column. Speed builds with the push and
 *            with the slope, bleeds with rolling resistance; the end of a
 *            line stops the cart against a wall or launches the Keeper off
 *            it when there is room and speed. "The cart does not care where
 *            it is going, which is why it gets there."
 */
import { BodyBox, boxHits, CELL, isAir, isRail, SPOOL_MAX, Terrain, TERRAIN_NODE_LIST } from './terrain';

// ── Rope ────────────────────────────────────────────────────────────────────

const ROPE = TERRAIN_NODE_LIST.findIndex(node => node.id === 'rope');

/** Whether a rope can be tied at (col, row): open air with rock or rope over it, or a ledge beside it. Pure. */
export function ropeTie(t: Terrain, col: number, row: number): boolean {
  if (!isAir(t, col, row)) return false;
  if (row === 0 || t.solid(col, row - 1) || (t.inside(col, row - 1) && t.kind[t.index(col, row - 1)] === ROPE)) return true;
  return t.solid(col - 1, row) || t.solid(col + 1, row);
}

/** The cells a rope tied at (col, row) fills: straight down through open air to the floor, at most `max`. Pure. */
export function ropeCells(t: Terrain, col: number, row: number, max = SPOOL_MAX): number[] {
  const out: number[] = [];
  for (let r = row; r < row + max && r < t.rows; r++) {
    if (!isAir(t, col, r)) break;
    out.push(t.index(col, r));
    if (!isAir(t, col, r + 1)) break;
  }
  return out;
}

/** The whole strand a rope cell belongs to (contiguous rope above and below), top first. Pure. */
export function ropeStrand(t: Terrain, col: number, row: number): number[] {
  const is = (r: number) => r >= 0 && r < t.rows && t.inside(col, r) && t.kind[t.index(col, r)] === ROPE;
  if (!is(row)) return [];
  let top = row;
  while (is(top - 1)) top--;
  const out: number[] = [];
  for (let r = top; is(r); r++) out.push(t.index(col, r));
  return out;
}

// ── Grapple ─────────────────────────────────────────────────────────────────

/** How fast the line grows to its mark, and how fast it pulls the Keeper in (px/s). */
export const GRAPPLE_GROW = 1500;
export const GRAPPLE_PULL = 640;
/** Close enough to hang (px from the chest to the mark), and how long a blocked pull waits before it hangs where it is. */
export const GRAPPLE_HOLD = 34;
export const GRAPPLE_STUCK = .25;

export interface Grapple {
  phase: 'grow' | 'pull' | 'hang';
  /** The mark: where the line bit (world px), and the cell it bit. */
  tx: number; ty: number; index: number;
  /** The line's tip while it grows. */
  tipX: number; tipY: number;
  stuck: number;
}

/**
 * Where a grapple thrown from the hand (hx, hy) at cell (col, row) bites: the
 * first solid cell along the line from the hand toward that cell's centre,
 * within `reach` px. The mark sits on that cell's face. Null when nothing
 * solid is in reach that way. Pure.
 */
export function grappleTarget(t: Terrain, hx: number, hy: number, col: number, row: number, reach: number): { x: number; y: number; index: number } | null {
  const ax = (col + .5) * CELL, ay = t.top + (row + .5) * CELL;
  const dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
  if (d < 1) return null;
  const ux = dx / d, uy = dy / d;
  // Walk the ray in quarter-cell steps (fine enough for a 32 px grid at these lengths).
  for (let s = 4; s <= Math.min(reach, d + CELL); s += 4) {
    const x = hx + ux * s, y = hy + uy * s;
    const c = t.colAt(x), r = t.rowAt(y);
    if (r >= 0 && t.inside(c, r) && t.solid(c, r)) {
      // Back off to the face the ray entered through.
      const bx = hx + ux * (s - 4), by = hy + uy * (s - 4);
      return { x: bx, y: by, index: t.index(c, r) };
    }
  }
  return null;
}

/** Start a throw. */
export function throwGrapple(hx: number, hy: number, target: { x: number; y: number; index: number }): Grapple {
  return { phase: 'grow', tx: target.x, ty: target.y, index: target.index, tipX: hx, tipY: hy, stuck: 0 };
}

/**
 * One fixed step of a thrown grapple. `body` feet at (x, y); the chest is the
 * pull's origin. The line grows; then the body is drawn along the line
 * (walls stop it, a slide along them is kept); then it hangs. Returns false
 * when the mark is gone (its cell dug or broken): the line drops.
 */
export function stepGrapple(g: Grapple, body: { x: number; y: number; vy: number; grounded: boolean }, box: BodyBox, t: Terrain, dt: number): boolean {
  if (g.index < 0 || g.index >= t.kind.length || !TERRAIN_NODE_LIST[t.kind[g.index]].solid) return false;
  const chest = () => body.y - box.height * .55;
  if (g.phase === 'grow') {
    const dx = g.tx - g.tipX, dy = g.ty - g.tipY, d = Math.hypot(dx, dy), step = GRAPPLE_GROW * dt;
    if (d <= step) { g.tipX = g.tx; g.tipY = g.ty; g.phase = 'pull'; }
    else { g.tipX += dx / d * step; g.tipY += dy / d * step; }
    return true;
  }
  body.vy = 0;
  if (g.phase === 'hang') { body.grounded = true; return true; }
  const dx = g.tx - body.x, dy = g.ty - chest(), d = Math.hypot(dx, dy);
  if (d <= GRAPPLE_HOLD) { g.phase = 'hang'; body.grounded = true; return true; }
  const step = Math.min(d - GRAPPLE_HOLD * .5, GRAPPLE_PULL * dt);
  const mx = dx / d * step, my = dy / d * step;
  let moved = false;
  if (Math.abs(mx) > 1e-3 && !boxHits(t, body.x + mx, body.y, box)) { body.x += mx; moved = true; }
  if (Math.abs(my) > 1e-3 && !boxHits(t, body.x, body.y + my, box)) { body.y += my; moved = true; }
  body.grounded = false;
  g.stuck = moved ? 0 : g.stuck + dt;
  if (g.stuck >= GRAPPLE_STUCK) { g.phase = 'hang'; body.grounded = true; }
  return true;
}

// ── Rails and the Seam Cart ─────────────────────────────────────────────────

/** Cart tuning (px/s, px/s²). Top speed is three times the Keeper's Delve walk (191 px/s). */
export const CART = {
  /** Push from Left/Right. */
  accel: 760,
  max: 575,
  /** Rolling resistance and drag. */
  roll: 40, drag: .12,
  /** Gravity along a slope: × dy / length (a one-row-per-column slope gives ~0.71 of it). */
  slope: 900,
  /** Faster than this off an open end of the line and the Keeper is launched; slower, the cart stops. */
  launch: 220,
  /** The Keeper's feet sit this far above the rail cell's floor (standing in the cart). */
  lift: 6,
} as const;

export interface Cart {
  /** The rail cell the cart last passed, and the direction it rolls (+1 east, −1 west). */
  col: number; row: number; dir: 1 | -1;
  /** Progress 0..1 toward the next rail cell (0 when there is none). */
  u: number;
  /** Speed along the rail, ≥ 0, in `dir`. */
  speed: number;
}

/** The rail cell after (col, row) heading `dir`: level first, then up a row, then down a row; null at a line's end. Pure. */
export function nextRail(t: Terrain, col: number, row: number, dir: number): { col: number; row: number } | null {
  if (isRail(t, col + dir, row)) return { col: col + dir, row };
  if (isRail(t, col + dir, row - 1)) return { col: col + dir, row: row - 1 };
  if (isRail(t, col + dir, row + 1)) return { col: col + dir, row: row + 1 };
  return null;
}

/** Where the Keeper's feet are on a rail cell (its centre, on its floor). */
export function railPoint(t: Terrain, col: number, row: number): { x: number; y: number } {
  return { x: (col + .5) * CELL, y: t.top + (row + 1) * CELL - CART.lift };
}

/** The cart's position (the Keeper's feet), and the segment it is on. Pure. */
export function cartPoint(t: Terrain, cart: Cart): { x: number; y: number; dy: number } {
  const a = railPoint(t, cart.col, cart.row);
  const next = nextRail(t, cart.col, cart.row, cart.dir);
  if (!next || cart.u <= 0) return { ...a, dy: next ? next.row - cart.row : 0 };
  const b = railPoint(t, next.col, next.row);
  return { x: a.x + (b.x - a.x) * cart.u, y: a.y + (b.y - a.y) * cart.u, dy: next.row - cart.row };
}

/** The rail cell the Keeper's feet are on (feet at y, centre at x), or null. Pure. */
export function railUnder(t: Terrain, x: number, feetY: number): { col: number; row: number } | null {
  const col = t.colAt(x);
  for (const row of [t.rowAt(feetY - 1), t.rowAt(feetY - 1) + 1, t.rowAt(feetY - 1) - 1]) if (isRail(t, col, row)) return { col, row };
  return null;
}

/** Board the cart at a rail cell, facing `dir`, at rest. */
export function mountCart(col: number, row: number, dir: number): Cart {
  return { col, row, dir: dir < 0 ? -1 : 1, u: 0, speed: 0 };
}

export interface CartStep {
  /** The Keeper left the line at speed off an open end: their velocity as they go. */
  launched?: { vx: number; vy: number };
  /** The cart rolled into a wall or the end of a line and stopped. */
  stopped?: boolean;
}

/**
 * One fixed step of a cart: `push` −1/0/+1 (Left/Right). Speed builds with the
 * push and the slope (downhill), bleeds with rolling resistance; it reverses
 * through zero. `blocked(x, feetY)` is the Keeper's body hitting rock there.
 * Pure apart from `cart`.
 */
export function stepCart(t: Terrain, cart: Cart, push: number, dt: number, blocked: (x: number, y: number) => boolean): CartStep {
  let next = nextRail(t, cart.col, cart.row, cart.dir);
  const dy = next ? next.row - cart.row : 0;
  const along = dy / Math.hypot(1, dy);
  const thrust = push * cart.dir * CART.accel;
  const slope = CART.slope * along;
  const resist = cart.speed > 0 ? CART.roll + CART.drag * cart.speed : 0;
  let speed = cart.speed + (thrust + slope - resist) * dt;
  // Resistance only ever brings the cart to rest; it never pushes it backwards.
  if (speed < 0 && thrust === 0 && slope === 0) speed = 0;
  if (speed < 0) {
    // Through zero: roll the other way along the same rail.
    const back = nextRail(t, cart.col, cart.row, -cart.dir);
    if (next && cart.u > 0) { cart.col = next.col; cart.row = next.row; cart.u = 1 - cart.u; }
    else if (!back) { cart.speed = 0; return { stopped: true }; }
    cart.dir = cart.dir === 1 ? -1 : 1;
    speed = -speed;
    next = nextRail(t, cart.col, cart.row, cart.dir);
  }
  cart.speed = Math.min(CART.max, speed);
  let dist = cart.speed * dt;
  while (dist > 0) {
    next = nextRail(t, cart.col, cart.row, cart.dir);
    if (!next) {
      // The end of the line: off into open air at speed, or stopped against rock.
      const point = railPoint(t, cart.col, cart.row);
      const ahead = point.x + cart.dir * CELL * .6;
      if (cart.speed >= CART.launch && !blocked(ahead, point.y)) {
        const last = nextRail(t, cart.col, cart.row, -cart.dir);
        const climb = last ? cart.row - last.row : 0;
        const k = Math.hypot(1, climb);
        const vx = cart.dir * cart.speed / k, vy = climb * cart.speed / k;
        cart.speed = 0; cart.u = 0;
        return { launched: { vx, vy } };
      }
      cart.speed = 0; cart.u = 0;
      return { stopped: true };
    }
    const len = CELL * Math.hypot(1, next.row - cart.row);
    const room = (1 - cart.u) * len;
    const before = cart.u;
    if (dist < room) cart.u += dist / len;
    else { cart.col = next.col; cart.row = next.row; cart.u = 0; }
    dist -= Math.min(dist, room);
    const at = cartPoint(t, cart);
    if (blocked(at.x, at.y)) {
      // Rock across the line (a dug ceiling filled in, a block on the rail): stop where it was.
      if (cart.u === 0) { const back = nextRail(t, cart.col, cart.row, -cart.dir); if (back) { cart.col = back.col; cart.row = back.row; cart.u = Math.max(0, before); } }
      else cart.u = before;
      cart.speed = 0;
      return { stopped: true };
    }
  }
  return {};
}
