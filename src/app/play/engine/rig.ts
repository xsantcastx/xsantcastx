/**
 * Mesh-deformation rig: bends ONE painting with a small bone chain.
 *
 * The art library ships every character as a single still painting — no frames,
 * no layered parts. Instead of wiggling that painting as a whole, the sprite is
 * cut into a triangle grid whose vertices are skinned to bones (linear blend
 * skinning, max four influences per vertex). Each frame the bones are posed,
 * the grid is deformed, and every triangle is texture-mapped with one affine
 * transform (clip + transform + drawImage) into an offscreen buffer. The buffer
 * is then blitted once onto the scene, so the scene's alpha, glow and filters
 * apply to the whole figure exactly as they did to the still painting.
 *
 * Space: "units". x = u (0..1 across the image), y = v * aspect, so rotations
 * are not skewed by a non-square image. One unit = the drawn sprite width.
 * Matrices are canvas-order [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f.
 *
 * Visual only: nothing here reads or writes combat state.
 */

export interface BoneSpec {
  name: string;
  /** Index of the parent bone, -1 for the root. Parents must precede children. */
  parent: number;
  /** Pivot in normalised image coords (u, v). */
  px: number; py: number;
  /** Influence capsule from (ax, ay) to (bx, by) with radius r (u units). r = 0: no direct skin. */
  ax: number; ay: number; bx: number; by: number; r: number;
}
export interface RigSpec {
  /** Column and row stops in normalised image coords, 0 first and 1 last. */
  cols: number[];
  rows: number[];
  bones: BoneSpec[];
}
export interface RigMesh {
  aspect: number;
  /** Vertex count and triangle count. */
  nv: number; nt: number;
  /** Rest positions in units, and normalised texture coords. */
  x: Float32Array; y: Float32Array; u: Float32Array; v: Float32Array;
  /** Three vertex indices per triangle, and the grid cell each triangle sits in. */
  tris: Uint16Array; cellOf: Uint16Array;
  /** Up to four (bone, weight) pairs per vertex; weights sum to 1. */
  wIdx: Uint8Array; wVal: Float32Array;
  /** Bone pivots in units. */
  pivotX: Float32Array; pivotY: Float32Array;
}

/** Floats per bone in a pose: rotation, translate x, translate y, scale x, scale y. */
export const POSE_STRIDE = 5;
export const MAX_INFLUENCES = 4;
/** Weight falloff sharpness. Higher = harder boundaries between bones. */
const FALLOFF = 1.5;

export function createPose(bones: number): Float32Array {
  const pose = new Float32Array(bones * POSE_STRIDE);
  resetPose(pose);
  return pose;
}
export function resetPose(pose: Float32Array): void {
  for (let i = 0; i < pose.length; i += POSE_STRIDE) {
    pose[i] = 0; pose[i + 1] = 0; pose[i + 2] = 0; pose[i + 3] = 1; pose[i + 4] = 1;
  }
}
export function isRestPose(pose: Float32Array): boolean {
  for (let i = 0; i < pose.length; i += POSE_STRIDE) {
    if (pose[i] !== 0 || pose[i + 1] !== 0 || pose[i + 2] !== 0 || pose[i + 3] !== 1 || pose[i + 4] !== 1) return false;
  }
  return true;
}

/** Squared distance from (x, y) to the segment (ax, ay)-(bx, by). */
export function segmentDistanceSq(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len > 0 ? ((x - ax) * dx + (y - ay) * dy) / len : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = x - (ax + dx * t), ey = y - (ay + dy * t);
  return ex * ex + ey * ey;
}

/**
 * Skin weights for one point. Gaussian falloff from each bone's capsule, computed
 * relative to the nearest bone so far-away vertices never underflow to all-zero.
 * Writes up to MAX_INFLUENCES pairs at `offset` and returns how many are non-zero.
 */
export function weighPoint(spec: RigSpec, aspect: number, x: number, y: number, outIdx: Uint8Array, outVal: Float32Array, offset: number): number {
  const bones = spec.bones;
  const q = new Float64Array(bones.length);
  let qmin = Infinity;
  for (let b = 0; b < bones.length; b++) {
    const bone = bones[b];
    if (bone.r <= 0) { q[b] = Infinity; continue; }
    const d = segmentDistanceSq(x, y, bone.ax, bone.ay * aspect, bone.bx, bone.by * aspect);
    q[b] = d / (bone.r * bone.r);
    if (q[b] < qmin) qmin = q[b];
  }
  for (let k = 0; k < MAX_INFLUENCES; k++) { outIdx[offset + k] = 0; outVal[offset + k] = 0; }
  // Selection of the four strongest influences (smallest q).
  const taken = new Uint8Array(bones.length);
  let total = 0, count = 0;
  for (let k = 0; k < MAX_INFLUENCES; k++) {
    let best = -1;
    for (let b = 0; b < bones.length; b++) if (!taken[b] && q[b] !== Infinity && (best < 0 || q[b] < q[best])) best = b;
    if (best < 0) break;
    taken[best] = 1;
    const w = Math.exp(-FALLOFF * (q[best] - qmin));
    if (w < 1e-3) break;
    outIdx[offset + k] = best; outVal[offset + k] = w; total += w; count++;
  }
  for (let k = 0; k < count; k++) outVal[offset + k] /= total;
  return count;
}

/** Build the grid once per sprite. Allocation happens here, never per frame. */
export function buildMesh(spec: RigSpec, aspect: number): RigMesh {
  const cols = spec.cols, rows = spec.rows;
  const nc = cols.length, nr = rows.length;
  const nv = nc * nr, nt = (nc - 1) * (nr - 1) * 2;
  if (nt > 300) throw new Error('Rig grid too dense.');
  const mesh: RigMesh = {
    aspect, nv, nt,
    x: new Float32Array(nv), y: new Float32Array(nv), u: new Float32Array(nv), v: new Float32Array(nv),
    tris: new Uint16Array(nt * 3), cellOf: new Uint16Array(nt),
    wIdx: new Uint8Array(nv * MAX_INFLUENCES), wVal: new Float32Array(nv * MAX_INFLUENCES),
    pivotX: new Float32Array(spec.bones.length), pivotY: new Float32Array(spec.bones.length),
  };
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const i = r * nc + c;
    mesh.u[i] = cols[c]; mesh.v[i] = rows[r];
    mesh.x[i] = cols[c]; mesh.y[i] = rows[r] * aspect;
    weighPoint(spec, aspect, mesh.x[i], mesh.y[i], mesh.wIdx, mesh.wVal, i * MAX_INFLUENCES);
  }
  let t = 0;
  for (let r = 0; r < nr - 1; r++) for (let c = 0; c < nc - 1; c++) {
    const i0 = r * nc + c, i1 = i0 + 1, i2 = i0 + nc, i3 = i2 + 1;
    const cell = r * (nc - 1) + c;
    // Alternate the diagonal so bends do not all crease the same way.
    if ((r + c) % 2 === 0) {
      mesh.tris.set([i0, i1, i3], t * 3); mesh.cellOf[t++] = cell;
      mesh.tris.set([i0, i3, i2], t * 3); mesh.cellOf[t++] = cell;
    } else {
      mesh.tris.set([i0, i1, i2], t * 3); mesh.cellOf[t++] = cell;
      mesh.tris.set([i1, i3, i2], t * 3); mesh.cellOf[t++] = cell;
    }
  }
  spec.bones.forEach((bone, b) => { mesh.pivotX[b] = bone.px; mesh.pivotY[b] = bone.py * aspect; });
  return mesh;
}

/** Forward kinematics: world = parent · T(pivot + t) · R · S · T(-pivot). */
export function solveBones(spec: RigSpec, mesh: RigMesh, pose: Float32Array, out: Float32Array): void {
  const bones = spec.bones;
  for (let b = 0; b < bones.length; b++) {
    const p = b * POSE_STRIDE;
    const rot = pose[p], tx = pose[p + 1], ty = pose[p + 2], sx = pose[p + 3], sy = pose[p + 4];
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const px = mesh.pivotX[b], py = mesh.pivotY[b];
    const la = cos * sx, lb = sin * sx, lc = -sin * sy, ld = cos * sy;
    const le = px + tx - (la * px + lc * py), lf = py + ty - (lb * px + ld * py);
    const o = b * 6, parent = bones[b].parent;
    if (parent < 0) {
      out[o] = la; out[o + 1] = lb; out[o + 2] = lc; out[o + 3] = ld; out[o + 4] = le; out[o + 5] = lf;
    } else {
      const q = parent * 6;
      const pa = out[q], pb = out[q + 1], pc = out[q + 2], pd = out[q + 3], pe = out[q + 4], pf = out[q + 5];
      out[o] = pa * la + pc * lb; out[o + 1] = pb * la + pd * lb;
      out[o + 2] = pa * lc + pc * ld; out[o + 3] = pb * lc + pd * ld;
      out[o + 4] = pa * le + pc * lf + pe; out[o + 5] = pb * le + pd * lf + pf;
    }
  }
}

/** Linear blend skinning of every vertex into outX / outY (units). */
export function skin(mesh: RigMesh, matrices: Float32Array, outX: Float32Array, outY: Float32Array): void {
  for (let i = 0; i < mesh.nv; i++) {
    const x = mesh.x[i], y = mesh.y[i];
    let sx = 0, sy = 0;
    const base = i * MAX_INFLUENCES;
    for (let k = 0; k < MAX_INFLUENCES; k++) {
      const w = mesh.wVal[base + k];
      if (w === 0) break;
      const o = mesh.wIdx[base + k] * 6;
      sx += w * (matrices[o] * x + matrices[o + 2] * y + matrices[o + 4]);
      sy += w * (matrices[o + 1] * x + matrices[o + 3] * y + matrices[o + 5]);
    }
    outX[i] = sx; outY[i] = sy;
  }
}

/**
 * The affine transform carrying source triangle s0,s1,s2 onto destination d0,d1,d2.
 * Writes [a, b, c, d, e, f] into out and returns false for a degenerate source.
 */
export function triangleAffine(
  s0x: number, s0y: number, s1x: number, s1y: number, s2x: number, s2y: number,
  d0x: number, d0y: number, d1x: number, d1y: number, d2x: number, d2y: number,
  out: Float32Array | number[],
): boolean {
  const ux = s1x - s0x, uy = s1y - s0y, vx = s2x - s0x, vy = s2y - s0y;
  const det = ux * vy - vx * uy;
  if (Math.abs(det) < 1e-9) return false;
  const px = d1x - d0x, py = d1y - d0y, qx = d2x - d0x, qy = d2y - d0y;
  const a = (px * vy - qx * uy) / det, c = (qx * ux - px * vx) / det;
  const b = (py * vy - qy * uy) / det, d = (qy * ux - py * vx) / det;
  out[0] = a; out[1] = b; out[2] = c; out[3] = d;
  out[4] = d0x - a * s0x - c * s0y; out[5] = d0y - b * s0x - d * s0y;
  return true;
}

/** A critically (or under-) damped spring, stepped with semi-implicit Euler. */
export interface Spring { x: number; v: number }
export function stepSpring(s: Spring, target: number, omega: number, zeta: number, dt: number): void {
  // Sub-step so a long frame cannot blow the spring up.
  let left = Math.min(dt, .1);
  while (left > 0) {
    const h = left > 1 / 60 ? 1 / 60 : left;
    s.v += (omega * omega * (target - s.x) - 2 * zeta * omega * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
}

/** Placement of the last rendered figure, in the caller's coordinate frame. */
interface Placement { x: number; y: number; unit: number; pad: number; worldW: number; worldH: number }

/**
 * One rig bound to one painting. Shared by every figure that uses the painting
 * (the player and every peer Keeper; all three Maws) — each figure poses it,
 * renders, and blits before the next one does.
 */
export class RigSprite {
  readonly pose: Float32Array;
  private mesh: RigMesh | null = null;
  private meshFor: HTMLImageElement | null = null;
  private readonly matrices: Float32Array;
  private deformedX = new Float32Array(0);
  private deformedY = new Float32Array(0);
  /** 1 where a grid cell holds any painted pixel. Empty cells are never drawn. */
  private cellMask: Uint8Array | null = null;
  private buffer: HTMLCanvasElement | null = null;
  private bufferContext: CanvasRenderingContext2D | null = null;
  private readonly affine = new Float32Array(6);
  private readonly placed: Placement = { x: 0, y: 0, unit: 0, pad: 0, worldW: 0, worldH: 0 };
  private ready = false;

  constructor(readonly spec: RigSpec, private readonly padding = .32) {
    this.pose = createPose(spec.bones.length);
    this.matrices = new Float32Array(spec.bones.length * 6);
  }

  /**
   * Deform the painting with the current pose into the offscreen buffer, fitted
   * like a contain-fit drawImage into the box (bottom aligned). Returns false when
   * the image has not loaded, so the caller can keep its fallback.
   */
  render(image: HTMLImageElement | undefined, boxX: number, boxY: number, boxW: number, boxH: number, pixelScale: number): boolean {
    this.ready = false;
    if (!image?.complete || !image.naturalWidth || typeof document === 'undefined') return false;
    const nw = image.naturalWidth, nh = image.naturalHeight;
    if (this.meshFor !== image) {
      this.mesh = buildMesh(this.spec, nh / nw);
      this.meshFor = image;
      this.deformedX = new Float32Array(this.mesh.nv);
      this.deformedY = new Float32Array(this.mesh.nv);
      this.cellMask = this.measureCells(image);
      for (const anchor of this.anchors) anchor.u = -1;
    }
    const mesh = this.mesh!;
    const fit = Math.min(boxW / nw, boxH / nh);
    const unit = nw * fit;
    const pad = this.padding;
    const worldW = unit * (1 + pad * 2), worldH = unit * (mesh.aspect + pad * 2);
    const scale = Math.max(.5, Math.min(pixelScale, 1024 / worldW, 1024 / worldH));
    const pixelW = Math.ceil(worldW * scale), pixelH = Math.ceil(worldH * scale);
    if (!this.buffer) {
      this.buffer = document.createElement('canvas');
      this.bufferContext = this.buffer.getContext('2d');
    }
    const b = this.bufferContext;
    if (!b) return false;
    if (this.buffer.width !== pixelW || this.buffer.height !== pixelH) { this.buffer.width = pixelW; this.buffer.height = pixelH; }
    else { b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, pixelW, pixelH); }
    const p = this.placed;
    p.unit = unit; p.pad = pad; p.worldW = pixelW / scale; p.worldH = pixelH / scale;
    p.x = boxX + (boxW - unit) / 2 - pad * unit; p.y = boxY + boxH - nh * fit - pad * unit;
    const px = unit * scale;
    solveBones(this.spec, mesh, this.pose, this.matrices);
    if (isRestPose(this.pose)) {
      // Static pose (reduced motion, or a figure at rest): one plain draw.
      b.drawImage(image, pad * px, pad * px, px, mesh.aspect * px);
      this.ready = true;
      return true;
    }
    skin(mesh, this.matrices, this.deformedX, this.deformedY);
    const dx = this.deformedX, dy = this.deformedY, tris = mesh.tris, mask = this.cellMask;
    const ncols = this.spec.cols.length - 1;
    const offset = pad * px;
    // Push each clip edge out by ~0.7 buffer px so neighbours overlap and no seam shows.
    const grow = .7;
    for (let t = 0; t < mesh.nt; t++) {
      const cell = mesh.cellOf[t];
      if (mask && !mask[cell]) continue;
      const i0 = tris[t * 3], i1 = tris[t * 3 + 1], i2 = tris[t * 3 + 2];
      const x0 = dx[i0] * px + offset, y0 = dy[i0] * px + offset;
      const x1 = dx[i1] * px + offset, y1 = dy[i1] * px + offset;
      const x2 = dx[i2] * px + offset, y2 = dy[i2] * px + offset;
      if (!triangleAffine(mesh.u[i0] * nw, mesh.v[i0] * nh, mesh.u[i1] * nw, mesh.v[i1] * nh, mesh.u[i2] * nw, mesh.v[i2] * nh,
        x0, y0, x1, y1, x2, y2, this.affine)) continue;
      const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
      const k0 = grow / (Math.hypot(x0 - cx, y0 - cy) || 1), k1 = grow / (Math.hypot(x1 - cx, y1 - cy) || 1), k2 = grow / (Math.hypot(x2 - cx, y2 - cy) || 1);
      b.save();
      b.beginPath();
      b.moveTo(x0 + (x0 - cx) * k0, y0 + (y0 - cy) * k0);
      b.lineTo(x1 + (x1 - cx) * k1, y1 + (y1 - cy) * k1);
      b.lineTo(x2 + (x2 - cx) * k2, y2 + (y2 - cy) * k2);
      b.closePath();
      b.clip();
      const m = this.affine;
      b.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      // Only the cell's own source rectangle (plus a pixel of margin) is sampled.
      const col = cell % ncols, row = (cell - col) / ncols;
      const sx = Math.max(0, this.spec.cols[col] * nw - 1), sy = Math.max(0, this.spec.rows[row] * nh - 1);
      const sw = Math.min(nw, this.spec.cols[col + 1] * nw + 1) - sx, sh = Math.min(nh, this.spec.rows[row + 1] * nh + 1) - sy;
      b.drawImage(image, sx, sy, sw, sh, sx, sy, sw, sh);
      b.restore();
    }
    b.setTransform(1, 0, 0, 1, 0, 0);
    this.ready = true;
    return true;
  }

  /** Draw the last rendered figure onto the scene, optionally offset (smear, rim). */
  blit(c: CanvasRenderingContext2D, offsetX = 0, offsetY = 0): void {
    if (!this.ready || !this.buffer) return;
    const p = this.placed;
    c.drawImage(this.buffer, p.x + offsetX, p.y + offsetY, p.worldW, p.worldH);
  }

  /**
   * Where a point painted at (u, v) on the given bone lands now, in the caller's
   * frame, plus that bone's world rotation. Valid after render().
   */
  attach(bone: number, u: number, v: number, out: { x: number; y: number; angle: number }): boolean {
    if (!this.ready || !this.mesh) return false;
    const m = this.matrices, p = this.placed, w = this.anchorFor(u, v);
    const x = u, y = v * this.mesh.aspect;
    // Skin the point with the same blended weights the painting uses, so a held
    // item stays on the painted hand rather than on the bare bone.
    if (w.u !== u || w.v !== v) { weighPoint(this.spec, this.mesh.aspect, x, y, w.idx, w.val, 0); w.u = u; w.v = v; }
    let sx = 0, sy = 0;
    for (let k = 0; k < MAX_INFLUENCES; k++) {
      const weight = w.val[k];
      if (weight === 0) break;
      const o = w.idx[k] * 6;
      sx += weight * (m[o] * x + m[o + 2] * y + m[o + 4]);
      sy += weight * (m[o + 1] * x + m[o + 3] * y + m[o + 5]);
    }
    out.x = p.x + (p.pad + sx) * p.unit;
    out.y = p.y + (p.pad + sy) * p.unit;
    out.angle = Math.atan2(m[bone * 6 + 1], m[bone * 6]);
    return true;
  }
  /**
   * Cached skin weights for attach points (front hand, back hand, ...). Weighing
   * allocates, so each distinct (u, v) is weighed once and reused every frame.
   */
  private readonly anchors = Array.from({ length: 4 }, () => ({ u: -1, v: -1, idx: new Uint8Array(MAX_INFLUENCES), val: new Float32Array(MAX_INFLUENCES) }));
  private nextAnchor = 0;
  private anchorFor(u: number, v: number): RigSprite['anchors'][number] {
    for (const anchor of this.anchors) if (anchor.u === u && anchor.v === v) return anchor;
    const anchor = this.anchors[this.nextAnchor];
    this.nextAnchor = (this.nextAnchor + 1) % this.anchors.length;
    anchor.u = -1;
    return anchor;
  }

  /** One-time scan: which grid cells contain paint at all. Fails open (draw every cell). */
  private measureCells(image: HTMLImageElement): Uint8Array | null {
    try {
      const size = 64;
      const probe = document.createElement('canvas');
      probe.width = size; probe.height = size;
      const pc = probe.getContext('2d', { willReadFrequently: true });
      if (!pc) return null;
      pc.drawImage(image, 0, 0, size, size);
      const data = pc.getImageData(0, 0, size, size).data;
      const cols = this.spec.cols, rows = this.spec.rows;
      const mask = new Uint8Array((cols.length - 1) * (rows.length - 1));
      for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols.length - 1; c++) {
        const x0 = Math.max(0, Math.floor(cols[c] * size) - 1), x1 = Math.min(size, Math.ceil(cols[c + 1] * size) + 1);
        const y0 = Math.max(0, Math.floor(rows[r] * size) - 1), y1 = Math.min(size, Math.ceil(rows[r + 1] * size) + 1);
        let painted = 0;
        for (let y = y0; y < y1 && !painted; y++) for (let x = x0; x < x1; x++) if (data[(y * size + x) * 4 + 3] > 2) { painted = 1; break; }
        mask[r * (cols.length - 1) + c] = painted;
      }
      return mask;
    } catch {
      return null;
    }
  }
}
