/**
 * td-hd-rig.ts — a tiny 3D posing rig for the HD creatures (isometric B, docs: memory art-direction-isometric-b).
 *
 * A creature is modelled once, in its own body frame, out of a few solids (balls, eggs, tapered limbs, flat plates) and
 * posed by its animation (a step, a lunge, a fall). The rig turns that pose to any facing, projects it the way the iso
 * camera sees a figure (upright, the ground plane tipped 2:1), sorts the solids far to near, and hands them to the pixel
 * sculptor (td-hd-sculpt.ts), which shades and outlines them by hand-painting rules. So one model gives all six iso
 * facings (front, back, each turned a quarter left and right) with the light always from the upper left — never a
 * mirrored sprite with its light and its shield arm on the wrong side.
 *
 * Body frame: `f` forward (the way it faces), `r` its right, `u` up; HD px, origin on the ground between its feet.
 */
import { Sculpt, type Mat } from './td-hd-sculpt';

export type V3 = readonly [number, number, number];

/** The six iso facings, as yaw (0 faces the camera, +π/2 faces screen right). Rows of an HD creature's frames. */
export const FACING_YAW: readonly number[] = [0, Math.PI, Math.PI / 4, Math.PI * 3 / 4, -Math.PI / 4, -Math.PI * 3 / 4];
/** Row for the engine's iso facing: front/back, turned a quarter, to the screen's left (flip). */
export function facingRow(front: boolean, turned: boolean, left: boolean): number {
  return (front ? 0 : 1) + (turned ? (left ? 4 : 2) : 0);
}

/** How the ground plane tips toward the viewer (2:1 iso) and how much height counts toward nearness. */
const TILT = .5, RISE = .42;

/** A whole-body pose on top of the model: lean (pitch, + forward), roll (+ toward its right), a shift, a squash. */
export interface BodyXf { pitch?: number; roll?: number; df?: number; dr?: number; du?: number; pivot?: number; /** The whole model grown (a boss is its kin grown huge). */ scale?: number }

export interface PartOpt {
  /** Shade with other parts of the same group as one volume (Sculpt's `g`). */
  g?: number;
  /** A tone bias (−1 … +1 of a band). */
  bias?: number;
  /** Draw nearer (+) or farther (−) than its own depth says, in HD px. */
  z?: number;
}
export interface MarkOpt {
  /** The surface's outward normal (body frame): the mark shows only on the side that faces the viewer. */
  n?: V3;
  /** Draw it however it faces (a glow). */
  always?: boolean;
}

type Item =
  | { k: 'ell'; d: number; x: number; y: number; rx: number; ry: number; rot: number; m: Mat; o: PartOpt }
  | { k: 'limb'; d: number; a: [number, number]; b: [number, number]; ra: number; rb: number; m: Mat; o: PartOpt }
  | { k: 'poly'; d: number; pts: [number, number][]; m: Mat; o: PartOpt };

export class Rig {
  readonly s: Sculpt;
  private items: Item[] = [];
  private marks: { x: number; y: number; c: string; w: number; h: number }[] = [];
  private cy: number; private sy: number;
  private cp: number; private sp: number;
  private cr: number; private sr: number;
  private bx: BodyXf;
  readonly w: number; readonly h: number; readonly ox: number; readonly oy: number; readonly yaw: number;
  /** The sculpt's size and the feet's spot on it. */
  constructor(w: number, h: number, ox: number, oy: number, yaw: number, body: BodyXf = {}) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.yaw = yaw;
    this.s = new Sculpt(w, h);
    this.cy = Math.cos(yaw); this.sy = Math.sin(yaw);
    this.cp = Math.cos(body.pitch ?? 0); this.sp = Math.sin(body.pitch ?? 0);
    this.cr = Math.cos(body.roll ?? 0); this.sr = Math.sin(body.roll ?? 0);
    this.bx = body;
  }

  /** Body frame → turned and posed ground frame (s screen-right, t toward the viewer, u up). */
  private ground(p: V3, vec = false): [number, number, number] {
    const k = this.bx.scale ?? 1;
    let f = p[0] * k, r = p[1] * k, u = p[2] * k;
    const pv = vec ? 0 : (this.bx.pivot ?? 0) * k;
    // Lean (about the right axis, round a pivot height) then roll (about the forward axis).
    u -= pv;
    const f1 = f * this.cp + u * this.sp, u1 = -f * this.sp + u * this.cp;
    const r2 = r * this.cr + u1 * this.sr, u2 = -r * this.sr + u1 * this.cr;
    f = f1; r = r2; u = u2 + pv;
    if (!vec) { f += (this.bx.df ?? 0) * k; r += (this.bx.dr ?? 0) * k; u += (this.bx.du ?? 0) * k; }
    return [f * this.sy - r * this.cy, f * this.cy + r * this.sy, u];
  }
  /** Body-frame point → sculpt px and depth (toward the viewer). */
  P(p: V3): [number, number, number] {
    const [s, t, u] = this.ground(p);
    return [this.ox + s, this.oy - u + t * TILT, t + u * RISE];
  }
  /** Does a surface with this body-frame normal face the viewer? */
  faces(n: V3): boolean { const [, t, u] = this.ground(n, true); return t + u * .35 > -.05; }
  /** How much a body-frame direction points toward the viewer (−1 … 1). */
  toward(n: V3): number { const [, t, u] = this.ground(n, true), l = Math.hypot(...this.ground(n, true)) || 1; return (t + u * .35) / l; }

  /** An egg: an ellipsoid with radii along the body's own forward, right and up. */
  egg(c: V3, rf: number, rr: number, ru: number, m: Mat, o: PartOpt = {}): this {
    const [x, y, d] = this.P(c);
    // Each radius axis projected; the outline is the ellipse with covariance Σ aᵢaᵢᵀ.
    const axes: [number, number][] = [];
    for (const v of [[rf, 0, 0], [0, rr, 0], [0, 0, ru]] as V3[]) { const [s, t, u] = this.ground(v, true); axes.push([s, -u + t * TILT]); }
    let a = 0, b = 0, cc = 0;
    for (const [px, py] of axes) { a += px * px; b += px * py; cc += py * py; }
    const tr = (a + cc) / 2, det = Math.sqrt(Math.max(0, ((a - cc) / 2) ** 2 + b * b));
    const l1 = tr + det, l2 = Math.max(.01, tr - det);
    const rot = Math.abs(b) < 1e-6 ? (a >= cc ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b);
    this.items.push({ k: 'ell', d: d + (o.z ?? 0), x, y, rx: Math.sqrt(l1), ry: Math.sqrt(l2), rot, m, o });
    return this;
  }
  ball(c: V3, r: number, m: Mat, o: PartOpt = {}): this { return this.egg(c, r, r, r, m, o); }
  /** A tapered limb from a (radius ra) to b (radius rb). */
  limb(a: V3, b: V3, ra: number, rb: number, m: Mat, o: PartOpt = {}): this {
    const A = this.P(a), B = this.P(b);
    const k = this.bx.scale ?? 1;
    this.items.push({ k: 'limb', d: (A[2] + B[2]) / 2 + (o.z ?? 0), a: [A[0], A[1]], b: [B[0], B[1]], ra: ra * k, rb: rb * k, m, o });
    return this;
  }
  /** Limbs through a chain of points (a tail, a spine, a tentacle), radii running end to end; one shaded volume. */
  chain(pts: readonly V3[], ra: number, rb: number, m: Mat, o: PartOpt = {}): this {
    const g = o.g ?? 7000 + this.items.length;
    for (let i = 0; i + 1 < pts.length; i++) {
      const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
      this.limb(pts[i], pts[i + 1], ra + (rb - ra) * t0, ra + (rb - ra) * t1, m, { ...o, g });
    }
    return this;
  }
  /** A flat plate through body-frame points (a blade, an ear, a wing's skin, a shield's face). */
  plate(pts: readonly V3[], m: Mat, o: PartOpt = {}): this {
    const q = pts.map(p => this.P(p));
    const d = q.reduce((s, p) => s + p[2], 0) / q.length;
    this.items.push({ k: 'poly', d: d + (o.z ?? 0), pts: q.map(p => [p[0], p[1]]), m, o });
    return this;
  }
  /** A disc (a round shield, a buckler, a wheel): centre, two in-plane half-axes. */
  disc(c: V3, a: V3, b: V3, m: Mat, o: PartOpt = {}, n = 20): this {
    const pts: V3[] = [];
    for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t); pts.push([c[0] + a[0] * ca + b[0] * sa, c[1] + a[1] * ca + b[1] * sa, c[2] + a[2] * ca + b[2] * sa]); }
    return this.plate(pts, m, o);
  }

  /** A flat-colour mark painted after shading (an eye, a rivet, a rune), w × h sculpt px. */
  mark(p: V3, c: string, w = 1, h = 1, o: MarkOpt = {}): this {
    if (!o.always && o.n && !this.faces(o.n)) return this;
    const [x, y] = this.P(p);
    this.marks.push({ x: Math.round(x - (w - 1) / 2), y: Math.round(y - (h - 1) / 2), c, w, h });
    return this;
  }
  /** A one-px line of mark colour between body-frame points. */
  line(a: V3, b: V3, c: string, o: MarkOpt = {}): this {
    if (!o.always && o.n && !this.faces(o.n)) return this;
    const A = this.P(a), B = this.P(b);
    const n = Math.max(1, Math.round(Math.max(Math.abs(B[0] - A[0]), Math.abs(B[1] - A[1]))));
    for (let i = 0; i <= n; i++) this.marks.push({ x: Math.round(A[0] + (B[0] - A[0]) * i / n), y: Math.round(A[1] + (B[1] - A[1]) * i / n), c, w: 1, h: 1 });
    return this;
  }

  /** Sort far to near, sculpt, shade and outline. */
  render(opts: { outline?: string } = {}): HTMLCanvasElement {
    const s = this.s;
    const order = this.items.map((it, i) => ({ it, i })).sort((p, q) => p.it.d - q.it.d || p.i - q.i);
    for (const { it } of order) {
      if (it.k === 'ell') s.ellipse(it.x, it.y, it.rx, it.ry, it.m, { g: it.o.g, bias: it.o.bias, rot: it.rot });
      else if (it.k === 'limb') s.limb(it.a, it.b, it.ra, it.rb, it.m, { g: it.o.g, bias: it.o.bias });
      else s.poly(it.pts, it.m, { g: it.o.g, bias: it.o.bias });
    }
    for (const mk of this.marks) s.dot(mk.x, mk.y, mk.c, mk.w, mk.h);
    return s.render(opts);
  }
}

/** Mix a body-frame vector by a scalar and add (small helpers for posing). */
export const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
