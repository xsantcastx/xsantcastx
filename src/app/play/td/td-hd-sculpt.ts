/**
 * td-hd-sculpt.ts — a small pixel sculptor for the HD prototype (td-artopt.ts option B/C, docs/handoff/artopt/).
 *
 * A figure is built from solid shapes (ellipses, polygons, tapered limbs) laid back to front, each in a material (a
 * colour ramp, dark → light). `render()` then shades it the way a pixel artist would by hand, but on a grid twice as
 * fine as the game's art: every part gets a rounded volume from its own silhouette lit from the upper left (soft,
 * banded, a light 2×2 dither only where two bands meet), a part in front casts a short shadow down-right onto the part
 * behind, a thin contour line separates overlapping parts, metals get a specular glint, and the whole figure gets one
 * clean dark outline (lighter on the lit side, a selective outline). Details (eyes, buckles, rivets) are painted last
 * in flat colour. No anti-aliasing anywhere: every pixel is one colour from the ramps.
 */

export type Pt = readonly [number, number];

export interface Mat {
  /** Dark → light. Six tones read softest. */
  ramp: readonly string[];
  /** Metal: a white glint on the brightest pixels. */
  shine?: boolean;
  /** How round a part of this material is (HD px to full height). Larger: softer, flatter gradients. */
  round?: number;
  /** The light's strength on it (1 default; cloth .8, bone 1.1). */
  gain?: number;
  /** A tone bias (−1 … +1 of a band): the far arm darker, a lit plume lighter. */
  bias?: number;
  /** Never draw a contour line on parts behind this one (glows, hair strands). */
  soft?: boolean;
}

interface ShapeOpt { g?: number; bias?: number }

const INK = '#170f1c';

const RGB = new Map<string, [number, number, number]>();
function rgb(h: string): [number, number, number] {
  let v = RGB.get(h);
  if (!v) { v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; if (RGB.size < 4096) RGB.set(h, v); }
  return v;
}
function hex(r: number, g: number, b: number): string { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a: string, b: string, t: number): string { const p = rgb(a), q = rgb(b); return hex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t); }

/**
 * A six-tone ramp from one base colour: shadows cooler (toward violet-blue) and deeper, lights warmer (toward a pale
 * cream), the way the references shift hue as well as value.
 */
export function rampOf(base: string, opts: { cool?: string; warm?: string; deep?: number; hi?: number } = {}): string[] {
  const cool = opts.cool ?? '#1c1430', warm = opts.warm ?? '#fff4d6', deep = opts.deep ?? .62, hi = opts.hi ?? .45;
  return [mix(base, cool, deep), mix(base, cool, deep * .58), mix(base, cool, deep * .22), base, mix(base, warm, hi * .5), mix(base, warm, hi)];
}

const CAST: readonly (readonly [number, number])[] = [[-1, -1], [-2, -2], [0, -2], [-2, -1]];
const B2 = [0.125, 0.625, 0.875, 0.375];
const INKED = new Map<string, string>();
/** A ramp's darkest tone pulled toward the ink (the contour between overlapping parts), cached. */
function inked(c: string): string { let v = INKED.get(c); if (!v) { v = mix(c, INK, .35); INKED.set(c, v); } return v; }

export class Sculpt {
  readonly w: number;
  readonly h: number;
  /** Material index + 1 per pixel (0 empty). */
  private id: Uint16Array;
  /** The shape's layer (paint order) per pixel. */
  private layer: Uint16Array;
  /** The region key: shapes of one group shade as one volume. */
  private region: Int32Array;
  /** Per-pixel bias, quarter bands. */
  private bias: Int8Array;
  private mats: Mat[] = [];
  private matIx = new Map<Mat, number>();
  private n = 0;
  private details: { x: number; y: number; c: string }[] = [];
  /** Light direction in the picture plane (upper left) and toward the viewer. */
  light: [number, number, number] = [-.55, -.62, .56];

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.id = new Uint16Array(w * h); this.layer = new Uint16Array(w * h); this.region = new Int32Array(w * h); this.bias = new Int8Array(w * h);
  }

  private mi(m: Mat): number { let i = this.matIx.get(m); if (i === undefined) { i = this.mats.length; this.mats.push(m); this.matIx.set(m, i); } return i; }

  private fill(x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, m: Mat | null, o: ShapeOpt = {}): this {
    const L = ++this.n, mi = m ? this.mi(m) + 1 : 0, reg = m ? (o.g !== undefined ? 100000 + o.g : L) : 0, b = Math.round((o.bias ?? 0) * 4);
    const xa = Math.max(0, Math.floor(x0)), xb = Math.min(this.w - 1, Math.ceil(x1)), ya = Math.max(0, Math.floor(y0)), yb = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      if (!inside(x + .5, y + .5)) continue;
      const k = y * this.w + x;
      this.id[k] = mi; this.layer[k] = m ? L : 0; this.region[k] = reg; this.bias[k] = b;
    }
    return this;
  }

  /** An ellipse (optionally turned by `rot` radians). */
  ellipse(cx: number, cy: number, rx: number, ry: number, m: Mat | null, o: ShapeOpt & { rot?: number } = {}): this {
    const r = Math.max(rx, ry), cs = Math.cos(-(o.rot ?? 0)), sn = Math.sin(-(o.rot ?? 0));
    return this.fill(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => {
      const dx = x - cx, dy = y - cy, u = dx * cs - dy * sn, v = dx * sn + dy * cs;
      return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
    }, m, o);
  }

  /** A polygon (any winding), filled by the even-odd rule. */
  poly(pts: readonly Pt[], m: Mat | null, o: ShapeOpt = {}): this {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return this.fill(x0, y0, x1, y1, (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }, m, o);
  }

  /** A tapered limb from a (radius ra) to b (radius rb): a capsule. */
  limb(a: Pt, b: Pt, ra: number, rb: number, m: Mat | null, o: ShapeOpt = {}): this {
    const r = Math.max(ra, rb), dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    return this.fill(Math.min(a[0], b[0]) - r - 1, Math.min(a[1], b[1]) - r - 1, Math.max(a[0], b[0]) + r + 1, Math.max(a[1], b[1]) + r + 1, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)), px = a[0] + dx * t, py = a[1] + dy * t, rr = ra + (rb - ra) * t;
      return (x - px) * (x - px) + (y - py) * (y - py) <= rr * rr;
    }, m, o);
  }

  /** A chain of limbs through `pts` (a curl of hair, a tail, a fold), radii interpolated end to end. */
  stroke(pts: readonly Pt[], ra: number, rb: number, m: Mat, o: ShapeOpt = {}): this {
    const g = o.g ?? (900 + this.n);
    for (let i = 0; i + 1 < pts.length; i++) {
      const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
      this.limb(pts[i], pts[i + 1], ra + (rb - ra) * t0, ra + (rb - ra) * t1, m, { ...o, g });
    }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, m: Mat | null, o: ShapeOpt = {}): this {
    return this.fill(x, y, x + w - 1, y + h - 1, (px, py) => px >= x && px < x + w && py >= y && py < y + h, m, o);
  }

  /** Flat-colour detail pixels painted after shading (eyes, rivets, a buckle's glint). */
  dot(x: number, y: number, c: string, w = 1, h = 1): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.details.push({ x: Math.round(x) + i, y: Math.round(y) + j, c });
    return this;
  }
  /** A one-pixel line of detail colour. */
  line(a: Pt, b: Pt, c: string): this {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let i = 0; i <= n; i++) this.dot(Math.round(a[0] + (b[0] - a[0]) * i / n), Math.round(a[1] + (b[1] - a[1]) * i / n), c);
    return this;
  }
  /** A one-pixel line of detail colour landing only where the figure is already solid (folds, seams). */
  lineOn(a: Pt, b: Pt, c: string): this {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let i = 0; i <= n; i++) { const x = Math.round(a[0] + (b[0] - a[0]) * i / n), y = Math.round(a[1] + (b[1] - a[1]) * i / n); if (this.solid(x, y)) this.dot(x, y, c); }
    return this;
  }
  /** Is this pixel solid (for details that should only land on the figure)? */
  solid(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.id[y * this.w + x] > 0; }

  /** Shade and outline into a canvas of (w + 2) × (h + 2): the outline needs the margin. */
  render(opts: { outline?: string; noOutline?: boolean } = {}): HTMLCanvasElement {
    const { w, h, id, region, layer } = this, N = w * h;
    // Distance from each pixel to the edge of its own region (chamfer, two passes), so every part reads round.
    const INF = 1e6, d = new Float32Array(N).fill(INF);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!id[k]) { d[k] = 0; continue; }
      const r = region[k];
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || region[k - 1] !== r || region[k + 1] !== r || region[k - w] !== r || region[k + w] !== r;
      if (edge) d[k] = 1;
    }
    const relax = (k: number, j: number, c: number) => { if (region[j] === region[k] && d[j] + c < d[k]) d[k] = d[j] + c; };
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (d[k] <= 1) continue; relax(k, k - 1, 1); relax(k, k - w, 1); relax(k, k - w - 1, 1.414); relax(k, k - w + 1, 1.414); }
    for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) { const k = y * w + x; if (d[k] <= 1) continue; relax(k, k + 1, 1); relax(k, k + w, 1); relax(k, k + w + 1, 1.414); relax(k, k + w - 1, 1.414); }
    // Height: a rounded profile per material.
    const ht = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      if (!id[k]) continue;
      const R = this.mats[id[k] - 1].round ?? 6, t = Math.min(1, (d[k] - .5) / R);
      ht[k] = R * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
    }
    // The whole figure's bounds (a gentle top-to-bottom light falloff).
    let fy0 = h, fy1 = 0;
    for (let k = 0; k < N; k++) if (id[k]) { const y = (k / w) | 0; fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); }
    const [lx, ly, lz] = this.light, ln = Math.hypot(lx, ly, lz), Lx = lx / ln, Ly = ly / ln, Lz = lz / ln;
    const out = document.createElement('canvas'); out.width = w + 2; out.height = h + 2;
    const g = out.getContext('2d')!, img = g.createImageData(w + 2, h + 2), px = img.data;
    const put = (x: number, y: number, c: string) => { const [r, gg, b] = rgb(c), o = ((y + 1) * (w + 2) + x + 1) * 4; px[o] = r; px[o + 1] = gg; px[o + 2] = b; px[o + 3] = 255; };
    const hAt = (k: number, j: number) => (region[j] === region[k] ? ht[j] : 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!id[k]) continue;
      const m = this.mats[id[k] - 1], ramp = m.ramp, top = ramp.length - 1;
      const hl = x > 0 ? hAt(k, k - 1) : 0, hr = x < w - 1 ? hAt(k, k + 1) : 0, hu = y > 0 ? hAt(k, k - w) : 0, hd = y < h - 1 ? hAt(k, k + w) : 0;
      const nx = (hl - hr) * .5, ny = (hu - hd) * .5, nz = 1, nn = Math.hypot(nx, ny, nz);
      const lit = (nx * Lx + ny * Ly + nz * Lz) / nn;
      const flat = Lz;
      // The light on this pixel, banded onto the ramp: flat-facing reads as the base tone (index 3 of 6).
      const fall = (fy1 > fy0 ? (y - fy0) / (fy1 - fy0) : .5) - .5;
      let t = 3 + (lit - flat) * 5.2 * (m.gain ?? 1) - fall * .7 + (m.bias ?? 0) + this.bias[k] / 4;
      // A part in front casts a short shadow down-right onto the part behind.
      const L = layer[k];
      for (const [dx, dy] of CAST) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0) continue;
        const j = yy * w + xx;
        if (id[j] && layer[j] > L && region[j] !== region[k] && !this.mats[id[j] - 1].soft) { t -= 1.1; break; }
      }
      // Banding with a light dither only where two bands meet.
      const fr = t - Math.floor(t), th = B2[((y & 1) << 1) | (x & 1)];
      let i = Math.floor(t) + (fr > .5 + (th - .5) * .5 ? 1 : 0);
      // A contour: a part behind a neighbouring part in front of it (4-neighbours) takes its darkest line.
      let contour = false;
      for (let q = 0; q < 4; q++) { const j = q === 0 ? k - 1 : q === 1 ? k + 1 : q === 2 ? k - w : k + w; if (j >= 0 && j < N && id[j] && layer[j] > L && region[j] !== region[k] && !this.mats[id[j] - 1].soft) { contour = true; break; } }
      i = Math.max(0, Math.min(top, i));
      let col = contour ? inked(ramp[0]) : ramp[i];
      if (m.shine && !contour && t > top + .35) col = mix(ramp[top], '#ffffff', .7);
      put(x, y, col);
    }
    for (const dt of this.details) if (dt.x >= 0 && dt.y >= 0 && dt.x < w && dt.y < h) put(dt.x, dt.y, dt.c);
    // The silhouette's one dark outline, a shade softer on the lit (upper-left) side.
    if (!opts.noOutline) {
      const ink = opts.outline ?? INK, solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && id[y * w + x] > 0;
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
        if (solid(x, y)) continue;
        const r = solid(x + 1, y), b = solid(x, y + 1), l = solid(x - 1, y), u = solid(x, y - 1);
        if (!(r || b || l || u)) continue;
        // Lit side: the empty pixel sits up-left of the figure.
        const litSide = (r || b) && !(l || u);
        let c = ink;
        if (litSide) {
          const j = r ? y * w + x + 1 : (y + 1) * w + x, m = this.mats[id[j] - 1];
          c = mix(m.ramp[0], ink, .45);
        }
        put(x, y, c);
      }
    }
    g.putImageData(img, 0, 0);
    return out;
  }
}
