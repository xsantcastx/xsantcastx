/**
 * td-iso-props.ts — everything that stands on the ground in the isometric view (Beta), except walls and buildings:
 * trees and bushes in every land, the towns' props (barrels, crates, benches, lamps, signs, fences, the cart, the
 * fountain…), the wilds' rocks, reeds, ferns and mushrooms, and the dungeons' torches, graves, chests and bones.
 *
 * The top-down painters (td-art.ts) stay what Classic draws. Here each one has an isometric twin, sculpted at the HD
 * pixel (td-hd-sculpt.ts, two sheet px a world px) at the Diablo II angle with the same materials and the same light as
 * the Keepers, creatures and the inn's furniture (td-iso.ts): volume from the silhouette, light from the upper left, one
 * dark outline. A twin is found by the top-down sprite's cache key (td-art spriteKey: `tree:oak:3`, `barrel`,
 * `fence:3`…), so no map or builder changes.
 *
 * - **Trees** are a trunk and a crown, baked apart: the crown fades while the Keeper stands behind it, and (Normal
 *   detail, motion allowed) sways a pixel or two now and then, three frames sheared from the top, every tree on its own
 *   slow beat. Their shadow is cast on the floor down and to the right (the sun is upper left), drawn in the floor pass.
 * - **Fences** are laid a tile at a time, each tile sorted at its own depth, and a run joins the next one when only a
 *   tile lies between them.
 * - **Low** (Environment detail): fewer, larger leaf clusters, one frame, no sway.
 * - **Cost:** each twin is baked once, on first sight, under a per-frame budget (`isoPropsFrame`); until then the engine
 *   draws the old sprite. A drawn tree is two drawImage calls, as before (trunk + crown).
 */
import { Sculpt, mix, rampOf, type Mat, type Pt } from './td-hd-sculpt';
import { PAL, TILE, hash, spriteKey, type Sprite } from './td-art';
import { envDetail } from './td-detail';

// ── Materials (the art-bible ramps, lit like the Keepers) ──
const ramp6 = (base: string, o: Parameters<typeof rampOf>[1] = {}) => rampOf(base, { cool: '#1a1020', warm: '#fff0d0', ...o });
const mat = (base: string, round: number, gain: number, extra: Partial<Mat> & { cool?: string; warm?: string; hi?: number; deep?: number } = {}): Mat => {
  const { cool, warm, hi, deep, ...rest } = extra;
  return { ramp: ramp6(base, { ...(cool ? { cool } : {}), ...(warm ? { warm } : {}), ...(hi !== undefined ? { hi } : {}), ...(deep !== undefined ? { deep } : {}) }), round, gain, ...rest };
};
const M = {
  leaf: { ramp: ['#1f4a24', '#2d6a2c', '#3f8634', '#58a33c', '#7cc24c', '#a8dc66'], round: 6, gain: 1.1 } as Mat,
  leafDeep: { ramp: ['#10261a', '#163020', '#1c3a24', '#22462a', '#2a5230', '#326036'], round: 8, gain: .6 } as Mat,
  fruitLeaf: { ramp: ['#24502a', '#33702f', '#468c38', '#62a842', '#86c654', '#b0de70'], round: 6, gain: 1.1 } as Mat,
  pine: { ramp: ['#102a20', '#173a28', '#21502f', '#2d6a38', '#3f8442', '#5aa250'], round: 5, gain: 1.15 } as Mat,
  jungle: { ramp: ['#14361c', '#1f4e26', '#2f6a34', '#3f8240', '#58a04c', '#82c066'], round: 7, gain: 1.05 } as Mat,
  jungleDeep: { ramp: ['#0a1e12', '#0e2818', '#12301c', '#163820', '#1c4226', '#224c2c'], round: 8, gain: .55 } as Mat,
  frond: { ramp: ['#1a4422', '#255c2c', '#327436', '#438c40', '#5ea64c', '#84c262'], round: 2, gain: 1 } as Mat,
  cypress: { ramp: ['#1e2620', '#2a3428', '#33402f', '#41513e', '#566a50', '#6e8466'], round: 5, gain: .9 } as Mat,
  bark: mat('#7a4e2e', 4, 1, { cool: '#1c0e10', warm: '#f0d0a0', hi: .35 }),
  barkJ: mat('#6e4a30', 5, 1, { cool: '#1a0e0c', warm: '#e8d0a0', hi: .35 }),
  barkS: mat('#4a3a34', 4, .9, { cool: '#120c10', warm: '#c8b8a8', hi: .35 }),
  palm: mat('#8a6040', 3, 1, { cool: '#24120c', hi: .4 }),
  shade: { ramp: rampOf('#3a2416', { cool: '#0c0608' }), round: 2, gain: .4 } as Mat,
  moss: mat('#4c8042', 3, .9, { cool: '#0e1e10' }),
  hangmoss: mat('#9aa488', 1, .7, { cool: '#2a3024' }),
  wood: mat('#8a5a32', 1.5, .6, { cool: '#140a0c', warm: '#ffe0b0', hi: .4 }),
  woodDk: mat('#5e3a24', 1.5, .6, { cool: '#140a0c', warm: '#ffe0b0', hi: .4 }),
  woodLt: mat('#b07a48', 1.5, .6, { cool: '#140a0c', warm: '#ffe8c0', hi: .4 }),
  grey: mat('#6e665e', 1.5, .5, { cool: '#140e14', warm: '#e8e0d0', hi: .35 }),
  stone: mat('#9a8f86', 2.5, .75, { cool: '#18141c', warm: '#f4ece0', hi: .4 }),
  stoneDk: mat('#6e655e', 2.5, .7, { cool: '#120e14', warm: '#e0d8cc', hi: .35 }),
  temple: mat('#8d9486', 2.5, .75, { cool: '#141a16', warm: '#eef4e4', hi: .4 }),
  basalt: mat('#4a4352', 3, .8, { cool: '#0c0a12', warm: '#c8c0d8', hi: .4 }),
  rune: mat('#5b5770', 2.5, .8, { cool: '#0e0c18', warm: '#d8d4f0', hi: .4 }),
  iron: { ramp: rampOf('#5a5660', { cool: '#0c0a12', warm: '#e8e8f8', hi: .5 }), round: 1, shine: true, gain: .8 } as Mat,
  ironBk: { ramp: rampOf('#2f2a33', { cool: '#08060a', warm: '#a8a0b0', hi: .45 }), round: 1, shine: true, gain: .8 } as Mat,
  brass: { ramp: rampOf('#d0a048', { cool: '#3a1c08', warm: '#fff8d0', hi: .6 }), round: 1, shine: true, gain: .8 } as Mat,
  glow: { ramp: ['#ff9a3a', '#ffb04a', '#ffc866', '#ffdc88', '#fff0b8', '#fffbe8'], round: 2, gain: .4, soft: true } as Mat,
  ember: { ramp: ['#9e2e1c', '#c8401e', '#e2552a', '#ff8a2e', '#ffb24a', '#ffd25a'], round: 2, gain: .5, soft: true } as Mat,
  rootglass: { ramp: ['#17604e', '#2fb38a', '#4fd0a4', '#7affd0', '#b8ffe6', '#eafff6'], round: 2, gain: .4, soft: true } as Mat,
  water: { ramp: ['#1f4a84', '#2a5e9e', '#336fb0', '#3d7fc4', '#5aa2e2', '#8cc4f0'], round: 6, gain: .5 } as Mat,
  dirt: mat('#93623a', 3, .6, { cool: '#1a0e0c' }),
  bone: mat('#e2d8c2', 1.5, .9, { cool: '#3a3040', warm: '#fffdf4', hi: .55, deep: .55 }),
  cloth: mat('#c8b48a', 2, .7, { cool: '#2a2018' }),
  reed: mat('#6e7c4a', 1, .8, { cool: '#1a2014' }),
  cattail: mat('#5a3a24', 1.5, .9, { cool: '#140a08' }),
  stem: mat('#d8d0e0', 1, .8, { cool: '#3a3048' }),
  cap: { ramp: ['#2c2258', '#3c3078', '#5a46a8', '#7a64d0', '#a48bff', '#d0c4ff'], round: 3, gain: .8 } as Mat,
  fruit: mat('#d8433a', 1.5, .9, { cool: '#3a0a10', hi: .5 }),
  nut: mat('#7a5a30', 1.5, .9, { cool: '#1a0e08' }),
  ink: { ramp: ['#2c2258', '#3c3078', '#5a46a8', '#7a64d0', '#a48bff', '#e8e0ff'], round: 2, gain: .4, soft: true } as Mat,
  lantern: { ramp: ['#6e4220', '#d98a2a', '#ffb048', '#ffc65a', '#ffe08a', '#fff3c4'], round: 2, gain: .4, soft: true } as Mat,
};
const FLOWERS = PAL.flower;

// ── Projection helpers (world px from the foot; h up) ──
type Pr = (x: number, y: number, h: number) => Pt;
const proj = (ox: number, oy: number): Pr => (x, y, h) => [ox + (x - y) * 2, oy + (x + y) - h * 2];
/** A world-aligned box: its south face (lower left, lit), east face (lower right, shaded), then its top. */
function box(s: Sculpt, P: Pr, x0: number, y0: number, x1: number, y1: number, h0: number, h1: number, m: Mat, g: number, top: Mat = m): void {
  s.poly([P(x0, y1, h0), P(x1, y1, h0), P(x1, y1, h1), P(x0, y1, h1)], m, { g, bias: .2 });
  s.poly([P(x1, y0, h0), P(x1, y1, h0), P(x1, y1, h1), P(x1, y0, h1)], m, { g: g + 1, bias: -.9 });
  s.poly([P(x0, y0, h1), P(x1, y0, h1), P(x1, y1, h1), P(x0, y1, h1)], top, { g: g + 2, bias: .9 });
}
/** An upright cylinder (radius r) from h0 to h1, round its world point (cx, cy). */
function cyl(s: Sculpt, P: Pr, cx: number, cy: number, r: number, h0: number, h1: number, m: Mat, g: number, top: Mat = m, topBias = .8): void {
  const [X, Y0] = P(cx, cy, h0), [, Y1] = P(cx, cy, h1), rx = r * 2.83, ry = r * 1.41;
  s.ellipse(X, Y0, rx, ry, m, { g });
  s.poly([[X - rx, Y0], [X + rx, Y0], [X + rx, Y1], [X - rx, Y1]], m, { g });
  s.ellipse(X, Y1, rx, ry, top, { g: g + 1, bias: topBias });
}
/** A polygon through world points. */
const poly3 = (s: Sculpt, P: Pr, pts: readonly (readonly [number, number, number])[], m: Mat, g: number, bias = 0) => s.poly(pts.map(([x, y, h]) => P(x, y, h)), m, { g, bias });

// ── The baked twin ──
export interface IsoPart { img: HTMLCanvasElement; ax: number; ay: number }
export interface IsoArt {
  /** The part that never moves (a trunk, a barrel), or null. */
  base: IsoPart | null;
  /** The part that sways (a crown, reeds): one frame still, three swaying (0 rest, 1 right, 2 left). */
  sway: IsoPart[];
  /** The crown fades while the Keeper stands behind it (trees). */
  fades: boolean;
  /** The shadow on the floor (HD), anchored at the foot like the parts. */
  shadow: IsoPart | null;
  /** Tile segments along +x (a fence): the parts are laid a tile at a time, `seg` the post-and-rails piece, `cap` the end post. */
  run?: { tiles: number; seg: IsoPart; cap: IsoPart };
}

/** Trim a sculpt's canvas to what it painted; (ax, ay) the foot in the trimmed canvas. */
function trim(cv: HTMLCanvasElement, ax: number, ay: number): IsoPart {
  const g = cv.getContext('2d')!, { width: w, height: h } = cv, d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { img: cv, ax, ay };
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(cv, -x0, -y0);
  return { img: out, ax: ax - x0, ay: ay - y0 };
}
/** Three sway frames from a part: each row shifted by up to `amp` HD px at its top, nothing at its foot. */
function swayFrames(p: IsoPart, amp: number, frames: number): IsoPart[] {
  if (frames <= 1) return [p];
  const out: IsoPart[] = [p];
  const { img } = p, w = img.width, h = img.height, M = Math.ceil(amp);
  for (const s of [1, -1]) {
    const cv = document.createElement('canvas'); cv.width = w + M * 2; cv.height = h;
    const g = cv.getContext('2d')!;
    for (let y = 0; y < h; y++) {
      const t = Math.max(0, 1 - y / Math.max(1, p.ay));
      g.drawImage(img, 0, y, w, 1, M + Math.round(s * amp * t), y, w, 1);
    }
    out.push({ img: cv, ax: p.ax + M, ay: p.ay });
  }
  return out;
}
/**
 * A cast shadow on the floor (HD px): a soft-edged pixel ellipse (the edge dithered, never blurred) at (dx, dy) from the
 * foot — down and to the right, the sun being upper left — and a small one at the foot joining it to what casts it.
 */
function castShadow(rx: number, ry: number, dx: number, dy: number, foot = 0): IsoPart {
  const W = Math.ceil((Math.max(rx, foot * 2.2) + Math.abs(dx)) * 2 + 8), H = Math.ceil((Math.max(ry, foot) + Math.abs(dy)) * 2 + 8);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!, ax = W / 2 - dx, ay = H / 2 - dy;
  g.fillStyle = '#140c1c';
  const B = [0, 2, 3, 1];
  // The blob, and (when it has a foot) a streak of ellipses from the foot out to it: what casts it reaches its shadow.
  const blobs: [number, number, number, number][] = [[W / 2, H / 2, rx, ry]];
  if (foot) for (let i = 0; i < 6; i++) { const t = i / 6; blobs.push([ax + (W / 2 - ax) * t, ay + (H / 2 - ay) * t, foot + (Math.min(rx, foot * 2.2) - foot) * t, (foot + (Math.min(rx, foot * 2.2) - foot) * t) / 2]); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let k = 9;
    for (const [bx, by, brx, bry] of blobs) { const ex = (x + .5 - bx) / brx, ey = (y + .5 - by) / bry; k = Math.min(k, ex * ex + ey * ey); }
    if (k > 1) continue;
    // The rim's last fifth: a checker of pixels, the inside solid.
    if (k > .8 && B[((y & 1) << 1) | (x & 1)] < 2) continue;
    g.fillRect(x, y, 1, 1);
  }
  return { img: cv, ax, ay };
}

const tints = new Map<string, Mat>();
/**
 * A crown's own shade: the three sculpts of a kind sit a ramp half-step darker, as is, or lighter, so neighbouring crowns
 * in a wood read apart instead of as one green wall.
 */
function tint(m: Mat, v: number): Mat {
  const d = (v % 3) - 1;
  if (!d) return m;
  const k = `${m.ramp[3]}|${d}`;
  let t = tints.get(k);
  if (!t) { t = { ...m, ramp: m.ramp.map(c => mix(c, d < 0 ? '#0c1a10' : '#e8f0b0', .12)) }; tints.set(k, t); }
  return t;
}
/** Leaf clusters filling an ellipse (crown centre cx, cy; radii rx, ry), lit by their place on the dome. */
function leafCrown(s: Sculpt, cx: number, cy: number, rx: number, ry: number, leaf: Mat, deep: Mat, v: number, step: number, glint: string, gBase = 10): void {
  s.ellipse(cx, cy + 3, rx - 4, ry - 3, deep, { g: 1 });
  const cl: { x: number; y: number; r: number }[] = [];
  for (let row = 0; row * step * .8 <= ry * 2 + 4; row++) {
    const y = cy - ry + step * .55 + row * step * .8;
    for (let col = -8; col <= 8; col++) {
      const x = cx + col * step + (row % 2 ? step / 2 : 0) + (hash(row, col, v + 61) - .5) * 4;
      const yy = y + (hash(row, col, v + 62) - .5) * 3;
      const nx = (x - cx) / (rx - step * .5), ny = (yy - cy) / (ry - step * .45), d = nx * nx + ny * ny;
      if (d > 1.04 || (d > .78 && hash(row, col, v + 63) < .3)) continue;
      cl.push({ x, y: yy, r: step * .72 + hash(row, col, v + 64) * step * .2 });
    }
  }
  cl.sort((a, b) => a.y - b.y || a.x - b.x);
  cl.forEach((c, i) => {
    // The dome: lit upper left, the underside (the crown's lower rim) in its own shade.
    const nx = (c.x - cx) / rx, ny = (c.y - cy) / ry, l = -.55 * nx - .8 * ny;
    const g = gBase + i, bias = l > .55 ? .9 : l > -.15 ? .35 : l > -.55 ? -.25 : -.8;
    s.ellipse(c.x, c.y, c.r, c.r * .9, leaf, { g, bias });
    for (let k = 0; k < 3; k++) {
      const a = hash(i, k, v + 70) * Math.PI * 2;
      s.ellipse(c.x + Math.cos(a) * c.r * .78, c.y + Math.sin(a) * c.r * .68, c.r * .42, c.r * .38, leaf, { g, bias });
    }
  });
  for (let i = 0; i < 30; i++) {
    const x = Math.round(cx - rx + hash(i, 1, v + 80) * rx * 1.6), y = Math.round(cy - ry + hash(i, 2, v + 80) * ry * 1.3);
    if (s.solid(x, y) && (x - cx) / rx + (y - cy) / ry < -.4) s.dot(x, y, glint);
  }
}

/** A trunk tapering from the foot (half-width w0 HD) to a height `top` (HD px up), with root flares along the iso diagonals. */
function trunk(s: Sculpt, X: number, Y: number, w0: number, w1: number, top: number, m: Mat, v: number, lean = 0, roots = 2): void {
  s.poly([[X - w0, Y - 2], [X + w0, Y - 2], [X + w1 + lean, Y - top], [X - w1 + lean, Y - top]], m, { g: 2 });
  // Roots: one along each ground diagonal toward the camera, a third behind on a big trunk.
  s.poly([[X - w0 + 1, Y - 10], [X - w0 - 9, Y + 3], [X - w0 + 5, Y + 1]], m, { g: 3, bias: .3 });
  s.poly([[X + w0 - 1, Y - 10], [X + w0 + 9, Y + 3], [X + w0 - 5, Y + 1]], m, { g: 4, bias: -.5 });
  if (roots > 2) s.poly([[X - 2, Y - 8], [X + 2, Y + 6], [X + 5, Y - 2]], m, { g: 5, bias: -.2 });
  s.ellipse(X, Y - 2, w0 + 1, 3, m, { g: 6, bias: -.4 });
  for (let i = 0; i < 6; i++) {
    const x = X - w0 + 2 + Math.floor(hash(i, v, 90) * (w0 * 2 - 3)), y = Y - top + 8 + Math.floor(hash(i, v, 91) * (top - 18));
    s.line([x, y], [x, y + 4 + Math.floor(hash(i, v, 92) * 6)], m.ramp[1]);
  }
  s.dot(X - w0 + 2, Y - top + 12, m.ramp[5], 1, Math.max(4, Math.round(top * .4)));
}

interface Built { base?: Sculpt | null; baseFoot?: [number, number]; sway?: Sculpt | null; swayFoot?: [number, number]; amp?: number; fades?: boolean; shadow?: IsoPart | null }
/** Render, trim and finish a built twin. */
function finish(b: Built, low: boolean): IsoArt {
  const base = b.base ? trim(b.base.render(), b.baseFoot![0] + 1, b.baseFoot![1] + 1) : null;
  const sw = b.sway ? trim(b.sway.render(), b.swayFoot![0] + 1, b.swayFoot![1] + 1) : null;
  return { base, sway: sw ? swayFrames(sw, b.amp ?? 0, low || !b.amp ? 1 : 3) : [], fades: !!b.fades, shadow: b.shadow ?? null };
}

// ── Trees ──
/** A broadleaf (oak or fruit tree): about 1.4 Keepers tall, a domed crown of lit clusters over a barked trunk. */
function broadleaf(v: number, fruit: boolean, low: boolean): Built {
  const W = 128, H = 150, X = 64, Y = 144;
  const t = new Sculpt(W, H);
  const lean = (v % 3) - 1;
  trunk(t, X, Y, 7 + (v % 2), 5, 58, M.bark, v, lean);
  t.rect(X - 6 + lean, Y - 58, 12, 7, M.shade, { g: 9 });
  const CW = 128, CH = 104, cx = 64, cy = 54;
  const c = new Sculpt(CW, CH);
  const rx = 48 + (v % 3) * 3, ry = 38 + (v % 2) * 3;
  leafCrown(c, cx + lean, cy, rx, ry, tint(fruit ? M.fruitLeaf : M.leaf, v), M.leafDeep, v, low ? 19 : 13, '#b6e078');
  if (fruit) for (let i = 0; i < 14; i++) {
    const x = Math.round(cx - rx + 8 + hash(i, v, 3) * (rx * 2 - 16)), y = Math.round(cy - ry + 10 + hash(i, v, 4) * (ry * 2 - 14));
    if (c.solid(x, y) && c.solid(x + 2, y + 2)) { c.dot(x, y, '#d8433a', 3, 3); c.dot(x, y, '#ff8a7a'); c.dot(x + 2, y + 2, '#8a1a20'); }
  }
  // The crown's centre sits 86 HD px (43 world) over the foot.
  return { base: t, baseFoot: [X, Y], sway: c, swayFoot: [cx, cy + 86], amp: 2, fades: true, shadow: castShadow(rx * .9, ry * .42, 26, 12, 9) };
}
/** A pine: tiers of needle skirts round a short trunk, taller and darker than the oak. */
function pine(v: number, low: boolean): Built {
  const W = 120, H = 60, X = 60, Y = 54;
  const t = new Sculpt(W, H);
  trunk(t, X, Y, 6, 4, 30, M.bark, v);
  const CW = 120, CH = 170, cx = 60, foot = 164;
  const c = new Sculpt(CW, CH);
  const tiers = low ? 4 : 5 + (v % 2), top = 150 + (v % 3) * 6, bottom = 30;
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1), hb = bottom + k * (top - bottom - 34), r = 42 - k * 26 + (v % 2) * 2, ry = r * .5;
    const by = foot - hb, apex: Pt = [cx + (hash(i, v, 5) - .5) * 2, by - 30 - r * .35];
    const pts: Pt[] = [];
    const n = low ? 8 : 12;
    for (let j = 0; j <= n; j++) {
      const a = Math.PI - Math.PI * j / n, droop = j % 2 ? 3 : 0;
      pts.push([cx + Math.cos(a) * r, by + Math.sin(a) * ry + droop]);
    }
    pts.push(apex);
    c.poly(pts, tint(M.pine, v), { g: 10 + i * 2, bias: .1 - k * .2 });
    // Needles: a few dark tufts along the skirt's hem, a few lit ones on its upper left.
    if (!low) for (let j = 0; j < 9; j++) {
      const a = Math.PI - Math.PI * (j + .5) / 9, x = Math.round(cx + Math.cos(a) * r * .8), y = Math.round(by + Math.sin(a) * ry * .7 - 4);
      if (c.solid(x, y)) c.dot(x, y, j < 4 ? M.pine.ramp[5] : M.pine.ramp[1], 1, 2);
    }
  }
  c.dot(cx, foot - top - 6, '#86c068', 1, 3);
  return { base: t, baseFoot: [X, Y], sway: c, swayFoot: [cx, foot], amp: 2, fades: true, shadow: castShadow(30, 13, 28, 13, 8) };
}
/** The jungle's trees: a buttressed trunk under a broad, flat umbrella with vines; palms (seeds 3, 4) lean with fronds. */
function jungle(v: number, low: boolean): Built {
  if (v === 3 || v === 4) return palm(v === 3 ? 1 : -1, v === 4, low);
  const W = 132, H = 160, X = 66, Y = 152;
  const t = new Sculpt(W, H);
  trunk(t, X, Y, 9, 5, 72, M.barkJ, v, 0, 3);
  // Buttress fins along the ground diagonals.
  for (const [dx, dy, g] of [[-16, 6, 7], [16, 6, 8], [-10, -3, 9]] as const) t.poly([[X + dx * .2, Y - 26], [X + dx, Y + dy], [X + dx * .4, Y + dy - 1]], M.barkJ, { g, bias: dx < 0 ? .3 : -.5 });
  t.dot(X - 4, Y - 40, M.moss.ramp[3], 3, 5); t.dot(X + 3, Y - 20, M.moss.ramp[2], 2, 4);
  t.rect(X - 6, Y - 72, 12, 8, M.shade, { g: 12 });
  const CW = 140, CH = 104, cx = 70, cy = 46;
  const c = new Sculpt(CW, CH);
  const rx = 44 - (v % 2) * 3, ry = 25;
  leafCrown(c, cx, cy, rx, ry, tint(M.jungle, v), M.jungleDeep, v + 20, low ? 18 : 12, '#a8dc66');
  // Vines hanging from the crown's rim.
  if (!low) for (let i = 0; i < 5; i++) {
    const x = Math.round(cx - rx + 10 + hash(i, v, 7) * (rx * 2 - 20)), y0 = cy + ry - 8 - Math.round(Math.abs(x - cx) / rx * 12), len = 10 + Math.floor(hash(i, v, 8) * 22);
    c.line([x, y0], [x, y0 + len], M.frond.ramp[1]); c.line([x + 1, y0], [x + 1, y0 + len - 3], M.frond.ramp[3]);
    c.dot(x, y0 + len, M.frond.ramp[4], 2, 2);
  }
  if (v === 1) { const x = cx - 10, y = cy + 8; if (c.solid(x, y)) { c.dot(x, y, '#7affd0', 2, 3); c.dot(x, y, '#eafff6'); } }
  return { base: t, baseFoot: [X, Y], sway: c, swayFoot: [cx, cy + 100], amp: 2, fades: true, shadow: castShadow(rx * .85, ry * .5, 30, 13, 11) };
}
/** A palm: a ringed trunk leaning on a curve, a crown of long drooping fronds, a bunch of nuts. */
function palm(lean: number, glass: boolean, low: boolean): Built {
  const W = 120, H = 170, X = 60, Y = 162;
  const t = new Sculpt(W, H);
  const pts: Pt[] = [];
  for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push([X + lean * 22 * k * k, Y - 4 - k * 118]); }
  t.stroke(pts, 6, 4, M.palm, { g: 2 });
  for (let i = 1; i < 8; i++) { const [x, y] = pts[i]; t.lineOn([x - 6, y], [x + 6, y + 1], M.palm.ramp[1]); }
  t.ellipse(X, Y - 2, 9, 3, M.palm, { g: 3, bias: -.4 });
  const [tx, ty] = pts[8];
  const CW = 140, CH = 90, cx = 70, cy = 34;
  const c = new Sculpt(CW, CH);
  const n = low ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + .1 + i * (Math.PI * 1.8) / n, len = 36 + (i % 3) * 5;
    const fr: Pt[] = [];
    for (let k = 0; k <= 5; k++) { const d = len * k / 5; fr.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * .45 + d * d * .012]); }
    c.stroke(fr, 4.4, 1.4, M.frond, { g: 20 + i, bias: Math.sin(a) < 0 ? .5 : -.4 });
    for (let k = 1; k < 5; k++) { c.lineOn(fr[k], fr[k + 1], M.frond.ramp[1]); const [lx, ly] = fr[k]; c.dot(lx, ly + 4, M.frond.ramp[2], 1, 2); }
  }
  for (const [dx, dy] of [[-4, 6], [2, 8], [-1, 11]] as const) c.ellipse(cx + dx, cy + dy, 3.4, 3.4, M.nut, { g: 60 });
  if (glass) { c.ellipse(cx + 7, cy + 6, 2.6, 3.6, M.rootglass, { g: 61 }); c.dot(cx + 6, cy + 4, '#eafff6'); }
  return { base: t, baseFoot: [X, Y], sway: c, swayFoot: [cx - (tx - X), cy + (Y - ty)], amp: 3, fades: true, shadow: castShadow(40, 16, 30 + lean * 20, 14, 7) };
}
/** One of the deep jungle's giants: a trunk three tiles wide, roots like walls, a crown that roofs a clearing. */
function giant(v: number, low: boolean): Built {
  const W = 200, H = 220, X = 100, Y = 212;
  const t = new Sculpt(W, H);
  trunk(t, X, Y, 30, 22, 120, M.barkJ, v + 9, 0, 3);
  for (const [dx, dy, g] of [[-50, 12, 7], [50, 12, 8], [-30, -6, 9], [30, -6, 10]] as const) t.poly([[X + dx * .3, Y - 40], [X + dx, Y + dy], [X + dx * .6, Y + dy - 1], [X + dx * .2, Y - 18]], M.barkJ, { g, bias: dx < 0 ? .3 : -.5 });
  for (let i = 0; i < 9; i++) { const x = X - 26 + Math.floor(hash(i, v, 21) * 22), y = Y - 110 + Math.floor(hash(i, v, 22) * 80); if (t.solid(x, y)) t.dot(x, y, M.moss.ramp[2 + (i % 3)], 3 + (i % 3), 2 + (i % 2)); }
  t.ellipse(X + 6, Y - 52, 7, 11, { ramp: ['#0c0806', '#120c08', '#1a120c', '#22160e', '#2a1c12', '#322214'], round: 3, gain: .2 } as Mat, { g: 13 });
  t.ellipse(X + 18, Y - 72, 8, 2.5, M.cloth, { g: 14 });
  t.rect(X - 22, Y - 120, 44, 12, M.shade, { g: 15 });
  const CW = 280, CH = 170, cx = 140, cy = 80;
  const c = new Sculpt(CW, CH);
  leafCrown(c, cx, cy, 128, 72, M.jungle, M.jungleDeep, v + 40, low ? 26 : 18, '#a8dc66');
  if (!low) for (let i = 0; i < 6; i++) {
    const x = Math.round(cx - 110 + hash(i, v, 7) * 220), y0 = cy + 50 - Math.round(Math.abs(x - cx) / 128 * 28), len = 14 + Math.floor(hash(i, v, 8) * 30);
    c.line([x, y0], [x, y0 + len], M.frond.ramp[1]); c.line([x + 1, y0], [x + 1, y0 + len - 3], M.frond.ramp[3]); c.dot(x, y0 + len, M.frond.ramp[4], 2, 2);
  }
  { const x = Math.round(cx - 30 + hash(1, v, 9) * 60), y = cy + 10; if (c.solid(x, y)) { c.dot(x, y, '#7affd0', 2, 3); c.dot(x, y, '#eafff6'); } }
  return { base: t, baseFoot: [X, Y], sway: c, swayFoot: [cx, cy + 176], amp: 1.5, fades: true, shadow: castShadow(110, 46, 50, 24, 34) };
}
/** A Marches cypress: a flared, leaning trunk with knees in the mire, sparse grey-green clusters, moss hanging; bare when dead. */
function cypress(v: number, low: boolean): Built {
  const dead = v === 4 || v === 5, lean = v % 2 ? 1 : -1;
  const W = 120, H = 150, X = 60, Y = 142;
  const t = new Sculpt(W, H);
  t.poly([[X - 12, Y - 2], [X + 12, Y - 2], [X + 4 + lean * 8, Y - 30], [X + 3 + lean * 10, Y - 80], [X - 3 + lean * 10, Y - 80], [X - 4 + lean * 8, Y - 30]], M.barkS, { g: 2 });
  t.ellipse(X, Y - 2, 13, 3.5, M.barkS, { g: 3, bias: -.4 });
  // The knees, poking out of the mire round its foot.
  const PK = proj(X, Y);
  for (const [dx, dy, h] of [[-7, 4, 4], [-5, -4, 3], [7, 3, 5], [8, -3, 3]] as const) { const [kx, ky] = PK(dx, dy, 0); t.poly([[kx - 3, ky], [kx + 3, ky], [kx + .5, ky - h * 2]], M.barkS, { g: 20 + dx, bias: dx < 0 ? .3 : -.4 }); }
  for (let i = 0; i < 5; i++) { const y = Y - 20 - i * 11; t.lineOn([X - 4 + lean * (i * 2), y], [X - 3 + lean * (i * 2), y + 6], M.barkS.ramp[1]); }
  const CW = 120, CH = 120, cx = 60, cy = 50;
  const c = new Sculpt(CW, CH);
  const bx = cx + lean * 10;
  // Boughs.
  for (const [x1, y1] of [[-34, -6], [30, -12], [-14, -38], [16, -40], [-2, -52]] as const) c.stroke([[bx, cy + 20], [bx + x1 * .5, cy + 10 + y1 * .4], [bx + x1, cy + y1]], 2.6, 1.2, M.barkS, { g: 30 + x1 });
  if (!dead) {
    const step = low ? 15 : 11;
    for (const [dx, dy, r] of [[0, -12, 24], [-30, -2, 16], [28, -8, 16], [-14, -34, 15], [14, -36, 15], [0, -50, 11]] as const) leafCrown(c, bx + dx, cy + dy, r * 1.25, r * .8, M.cypress, M.cypress, v + dx + 50, step, '#8a9e7c', 40 + dy + dx * 3);
  }
  // Hanging moss strands.
  for (let i = 0; i < (low ? 8 : 16); i++) {
    const x = Math.round(bx - 40 + hash(i, v, 31) * 80), y0 = Math.round(cy - 30 + hash(i, v, 32) * 40), len = 8 + Math.floor(hash(i, v, 33) * (dead ? 16 : 22));
    if (!c.solid(x, y0) && !dead) continue;
    c.line([x, y0], [x, y0 + len], M.hangmoss.ramp[3]); c.line([x, y0], [x, y0 + 2], M.hangmoss.ramp[5]); c.dot(x, y0 + len, M.hangmoss.ramp[1]);
  }
  if (v === 2) { c.dot(bx + 10, cy + 10, '#a48bff', 2, 2); c.dot(bx + 10, cy + 10, '#e8e0ff'); }
  return { base: t, baseFoot: [X, Y], sway: c, swayFoot: [cx, cy + 80], amp: dead ? 1 : 2, fades: true, shadow: castShadow(34, 14, 24 + lean * 6, 11, 12) };
}

// ── Low growth ──
function bush(v: number, low: boolean): Built {
  const W = 72, H = 56, X = 36, Y = 50;
  const s = new Sculpt(W, H);
  leafCrown(s, X, Y - 18, 26 + v * 2, 17, M.leaf, M.leafDeep, v + 90, low ? 13 : 9, '#b6e078');
  if (v === 1) for (const [x, y] of [[-10, -20], [4, -26], [12, -14], [-4, -12], [-14, -12]] as const) if (s.solid(X + x, Y + y)) { s.dot(X + x, Y + y, '#e8506a', 2, 2); s.dot(X + x, Y + y, '#ffb0c0'); }
  if (v === 2) for (const [x, y] of [[-8, -24], [8, -16]] as const) if (s.solid(X + x, Y + y)) s.dot(X + x, Y + y, '#f2c94c', 2, 2);
  return { sway: s, swayFoot: [X, Y], amp: 1, shadow: castShadow(20, 8, 6, 3) };
}
function fern(v: number, low: boolean): Built {
  const W = 80, H = 56, X = 40, Y = 50;
  const s = new Sculpt(W, H);
  const n = low ? 5 : 7;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + .25 + i * (Math.PI - .5) / (n - 1), len = 24 + ((i + v) % 3) * 5;
    const fr: Pt[] = [];
    for (let k = 0; k <= 5; k++) { const d = len * k / 5; fr.push([X + Math.cos(a) * d * 1.1, Y - 3 + Math.sin(a) * d * 1.2 + d * d * .03]); }
    s.stroke(fr, 3.2, 1, M.frond, { g: 10 + i, bias: i < n / 2 ? .4 : -.3 });
  }
  if (v === 1) s.dot(X - 1, Y - 26, FLOWERS[0], 2, 2);
  if (v === 2) { s.dot(X + 4, Y - 22, '#7affd0', 2, 3); s.dot(X + 4, Y - 22, '#eafff6'); }
  return { sway: s, swayFoot: [X, Y], amp: 1, shadow: castShadow(18, 7, 4, 3) };
}
function reeds(v: number, low: boolean): Built {
  const W = 56, H = 64, X = 28, Y = 58;
  const s = new Sculpt(W, H);
  const n = low ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const dx = (i - n / 2) * 4 + (hash(i, v, 1) - .5) * 3, dy = (hash(i, v, 2) - .5) * 6, h = 26 + ((i * 5 + v * 3) % 9) * 3, lean = ((i + v) % 3) - 1;
    const x0 = X + dx, y0 = Y + dy;
    s.limb([x0, y0], [x0 + lean * 5, y0 - h], 1.3, .7, M.reed, { g: 10 + i });
    if ((i + v) % 3 === 0) s.limb([x0 + lean * 4.5, y0 - h + 6], [x0 + lean * 5, y0 - h - 2], 2.2, 2, M.cattail, { g: 40 + i });
  }
  return { sway: s, swayFoot: [X, Y], amp: 2, shadow: castShadow(16, 6, 6, 3) };
}
function gloomcap(v: number): Built {
  const W = 50, H = 44, X = 25, Y = 38;
  const s = new Sculpt(W, H), P = proj(X, Y);
  const caps = ([[-4, 2, 7, 3.6], [3, -3, 9, 4.4], [-1, -6, 5, 3], [5, 3, 6, 2.8]] as const).slice(0, 2 + v);
  caps.forEach(([x, y, h, r], i) => {
    cyl(s, P, x, y, .9, 0, h, M.stem, 10 + i * 3);
    const [cx, cy] = P(x, y, h);
    s.ellipse(cx, cy - 1, r * 2.2, r * 1.2, M.cap, { g: 30 + i, bias: .3 });
    s.dot(cx - 2, cy - 2, '#e8e0ff');
  });
  return { base: s, baseFoot: [X, Y], shadow: castShadow(12, 5, 3, 2) };
}
function flowerbed(w: number, seed: number): Built {
  const L = w * TILE, W = L * 2 + 40, H = 60, X = 20 + 4, Y = 40;
  const s = new Sculpt(W, H), P = proj(X, Y);
  box(s, P, 0, -5, L, 0, 0, 4, M.woodDk, 10, M.dirt);
  for (let i = 0; i < w * 6; i++) {
    const x = 2 + i * (L - 4) / (w * 6 - 1), y = -2.5 + (hash(i, seed, 3) - .5) * 2;
    const [px, py] = P(x, y, 4);
    s.limb([px, py], [px, py - 6], .9, .7, M.frond, { g: 30 + i });
    s.ellipse(px, py - 7, 2.2, 1.8, { ramp: rampOf(FLOWERS[Math.floor(hash(i, seed, 7) * 4)]), round: 1.5, gain: .8 } as Mat, { g: 100 + i });
  }
  return { base: s, baseFoot: [X, Y] };
}

// ── Stones ──
function boulder(v: number): Built {
  const W = 70, H = 54, X = 35, Y = 46;
  const s = new Sculpt(W, H);
  const w = 20 + v * 3;
  s.ellipse(X, Y - 10, w, 12, M.stone, { g: 2 });
  s.ellipse(X - 4, Y - 18, w * .7, 10, M.stone, { g: 2 });
  s.ellipse(X + w * .45, Y - 8, w * .4, 8, M.stoneDk, { g: 3, bias: -.4 });
  s.ellipse(X - w * .4, Y - 22, 8, 4, M.moss, { g: 4, bias: .4 });
  s.lineOn([X - 2, Y - 20], [X + 4, Y - 10], M.stone.ramp[1]);
  return { base: s, baseFoot: [X, Y], shadow: castShadow(w + 2, 8, 8, 4) };
}
function standingStone(v: number): Built {
  const W = 48, H = 130, X = 24, Y = 122;
  const s = new Sculpt(W, H), P = proj(X, Y);
  const h = 42 + v * 5;
  poly3(s, P, [[-4, 3.5, 0], [4, 3.5, 0], [3.5, 3, h * .7], [1.5, 2.5, h], [-2.5, 2.5, h * .96], [-3.6, 3, h * .6]], M.stone, 2, .2);
  poly3(s, P, [[4, -3.5, 0], [4, 3.5, 0], [3.5, 3, h * .7], [1.5, 2.5, h], [2.6, -2.5, h * .9], [3.5, -3, h * .6]], M.stone, 3, -.8);
  for (const [k, hh] of [[0, .3], [1, .5], [2, .7]] as const) { const [x, y] = P(-1 + k * .5, 3.4, h * hh); s.dot(x, y, '#ffd27a', 2, 2); s.dot(x, y, '#fff3c4'); }
  return { base: s, baseFoot: [X, Y], shadow: castShadow(10, 5, 14, 6, 8) };
}
function gravestone(v: number): Built {
  const W = 50, H = 56, X = 25, Y = 46;
  const s = new Sculpt(W, H), P = proj(X, Y);
  box(s, P, -6, -2, 6, 6, 0, 1.5, M.dirt, 2, M.dirt);
  if (v === 2) { box(s, P, -1, -1, 1, 1, 0, 16, M.stone, 10); box(s, P, -5, -1, 5, 1, 9, 12, M.stone, 14); }
  else {
    box(s, P, -4.5, -1.5, 4.5, 1.5, 0, 12 - v, M.stone, 10);
    const [cx, cy] = P(0, 1.5, 12 - v);
    s.ellipse(cx - 1, cy + 1, 9, 5, M.stone, { g: 10 });
    for (const hh of [5, 8 - v]) s.lineOn(P(-2, 1.5, hh), P(2, 1.5, hh), M.stone.ramp[1]);
  }
  s.dot(...P(-4, 5, 1.5), M.moss.ramp[3], 2, 1);
  return { base: s, baseFoot: [X, Y], shadow: castShadow(9, 4, 10, 4) };
}
function pillar(v: number): Built {
  const W = 50, H = 100, X = 25, Y = 92;
  const s = new Sculpt(W, H), P = proj(X, Y);
  const h = 30 + v * 6;
  box(s, P, -5, -5, 5, 5, 0, 4, M.temple, 2);
  cyl(s, P, 0, 0, 3.6, 4, h, M.temple, 10, M.temple, .4);
  // The broken top: a jagged lip.
  const [tx, ty] = P(0, 0, h);
  s.poly([[tx - 10, ty], [tx - 6, ty - 6], [tx - 1, ty - 2], [tx + 4, ty - 9], [tx + 10, ty]], M.temple, { g: 10 });
  for (const dx of [-5, 0, 5]) s.lineOn([tx + dx, ty + 4], [tx + dx, ty + 4 + (h - 8) * 2], M.temple.ramp[1]);
  s.ellipse(...P(0, 3.6, h * .4), 4, 5, M.moss, { g: 20 });
  s.limb(P(2.5, 3, h - 2), P(2.5, 3, h * .5), 1, .8, M.frond, { g: 21 });
  return { base: s, baseFoot: [X, Y], shadow: castShadow(10, 5, 14, 6, 10) };
}
function oreSeam(): Built {
  const W = 90, H = 64, X = 45, Y = 54;
  const s = new Sculpt(W, H);
  s.ellipse(X, Y - 12, 34, 14, M.basalt, { g: 2 });
  s.ellipse(X - 6, Y - 24, 22, 13, M.basalt, { g: 2 });
  s.ellipse(X + 14, Y - 20, 12, 10, M.basalt, { g: 3, bias: -.3 });
  for (const [x, y, w] of [[-18, -14, 7], [-4, -30, 5], [10, -18, 8], [-8, -8, 5], [20, -24, 4]] as const) { s.lineOn([X + x, Y + y], [X + x + w, Y + y + 2], '#ff8a2e'); s.dot(X + x + 1, Y + y, '#ffd25a'); }
  return { base: s, baseFoot: [X, Y], shadow: castShadow(32, 10, 8, 4) };
}

// ── Town props ──
function barrel(): Built {
  const s = new Sculpt(50, 64), P = proj(25, 56);
  cyl(s, P, 0, 0, 6, 0, 19, M.wood, 10, M.woodLt);
  for (const h of [3.5, 15]) { const [x, y] = P(0, 0, h); s.lineOn([x - 17, y], [x + 17, y], M.iron.ramp[1]); s.lineOn([x - 17, y + 1], [x + 17, y + 1], M.iron.ramp[3]); }
  for (let i = -12; i <= 12; i += 6) { const [x, y] = P(0, 0, 0); s.lineOn([x + i, y + 4], [x + i, y - 34], M.wood.ramp[1]); }
  const [tx, ty] = P(0, 0, 19); s.ellipse(tx, ty, 6, 3, M.woodDk, { g: 30 }); s.dot(tx - 1, ty - 1, M.woodDk.ramp[4], 2, 1);
  return { base: s, baseFoot: [25, 56], shadow: castShadow(15, 7, 7, 3, 12) };
}
function crate(): Built {
  const s = new Sculpt(56, 60), P = proj(28, 46);
  box(s, P, -7, -7, 7, 7, 0, 14, M.woodLt, 10, M.wood);
  s.lineOn(P(-7, 7, 7), P(7, 7, 7), M.woodDk.ramp[1]); s.lineOn(P(7, -7, 7), P(7, 7, 7), M.woodDk.ramp[0]);
  s.lineOn(P(-7, 7, 0), P(7, 7, 14), M.woodDk.ramp[2]); s.lineOn(P(7, -7, 0), P(7, 7, 14), M.woodDk.ramp[1]);
  for (const t of [-3.5, 0, 3.5]) s.lineOn(P(-7, t, 14), P(7, t, 14), M.wood.ramp[1]);
  return { base: s, baseFoot: [28, 46], shadow: castShadow(18, 8, 8, 4, 12) };
}
function bench(): Built {
  const s = new Sculpt(84, 54), P = proj(42, 34);
  for (const x of [-11, 9]) box(s, P, x, -3, x + 2, 3, 0, 6, M.woodDk, 10 + x);
  box(s, P, -13, -3.5, 13, 3, 6, 7.5, M.wood, 30, M.woodLt);
  // The back rest, along the north edge.
  for (const x of [-11, 9]) box(s, P, x, -4.5, x + 2, -3, 7.5, 15, M.woodDk, 40 + x);
  box(s, P, -13, -4.8, 13, -3.5, 12, 15, M.wood, 60, M.woodLt);
  return { base: s, baseFoot: [42, 34], shadow: castShadow(26, 9, 6, 3) };
}
function lamp(): Built {
  const s = new Sculpt(40, 120), P = proj(20, 112);
  box(s, P, -2.5, -2.5, 2.5, 2.5, 0, 2.5, M.ironBk, 10);
  box(s, P, -.9, -.9, .9, .9, 2.5, 38, M.ironBk, 12);
  box(s, P, -3, -3, 3, 3, 38, 47, M.glow, 20, M.brass);
  for (const [x, y] of [[-3, 3], [3, 3], [3, -3]] as const) s.line(P(x, y, 38), P(x, y, 47), M.ironBk.ramp[0]);
  box(s, P, -3.6, -3.6, 3.6, 3.6, 47, 49, M.ironBk, 30);
  const [lx, ly] = P(0, 3, 43); s.dot(lx - 1, ly - 2, '#fffbe8', 2, 3);
  s.dot(...P(0, 0, 50.5), M.ironBk.ramp[3], 2, 2);
  return { base: s, baseFoot: [20, 112], shadow: castShadow(5, 2.5, 18, 8, 5) };
}
function signpost(): Built {
  const s = new Sculpt(60, 80), P = proj(30, 70);
  box(s, P, -1.1, -1.1, 1.1, 1.1, 0, 30, M.woodDk, 10);
  box(s, P, -10, 1.1, 10, 2.4, 17, 28, M.woodLt, 20, M.wood);
  for (const [h, w] of [[24, 7], [21, 5]] as const) s.lineOn(P(-w, 2.4, h), P(w, 2.4, h), M.woodDk.ramp[1]);
  s.dot(...P(-8, 2.4, 26.5), M.iron.ramp[4]); s.dot(...P(8, 2.4, 26.5), M.iron.ramp[4]);
  return { base: s, baseFoot: [30, 70], shadow: castShadow(12, 4, 12, 6, 4) };
}
function cart(): Built {
  const s = new Sculpt(110, 80), P = proj(55, 56);
  // The bed, along x, two wheels on its south side, a pull bar east.
  box(s, P, -15, -6, 15, 6, 6, 13, M.wood, 10, M.woodLt);
  box(s, P, -14, -5, 14, 5, 13, 13.6, M.woodDk, 13);
  const goods = ['#e0702f', '#f39a3c', '#c98a45'];
  for (let i = 0; i < 6; i++) { const [x, y] = P(-11 + i * 4.4, (i % 2) * 3 - 1.5, 15); s.ellipse(x, y, 4, 3, { ramp: rampOf(goods[i % 3]), round: 2, gain: .9 } as Mat, { g: 40 + i }); }
  box(s, P, 15, -1, 22, 1, 6, 7.5, M.woodDk, 60);
  for (const wx of [-9, 9]) {
    const pts: [number, number, number][] = [];
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; pts.push([wx + Math.cos(a) * 6, 7, 6 + Math.sin(a) * 6]); }
    poly3(s, P, pts, M.woodDk, 70 + wx, .2);
    const [hx, hy] = P(wx, 7, 6); s.dot(hx - 1, hy - 1, M.iron.ramp[2], 3, 3);
  }
  return { base: s, baseFoot: [55, 56], shadow: castShadow(34, 12, 8, 4) };
}
function waystone(): Built {
  const s = new Sculpt(56, 140), P = proj(28, 124);
  box(s, P, -8, -8, 8, 8, 0, 4, M.stone, 2);
  poly3(s, P, [[-5, 4.5, 4], [5, 4.5, 4], [4, 3.5, 44], [1, 2.5, 52], [-4, 3.5, 46]], M.rune, 10, .2);
  poly3(s, P, [[5, -4.5, 4], [5, 4.5, 4], [4, 3.5, 44], [1, 2.5, 52], [3.6, -3.5, 46]], M.rune, 11, -.8);
  for (let h = 12; h < 42; h += 6) { const [x, y] = P(0, 4.3, h); s.dot(x - 3, y, '#8fe8ff', 6, 2); s.dot(x - 1, y, '#e8ffff', 2, 1); }
  return { base: s, baseFoot: [28, 124], shadow: castShadow(12, 6, 16, 7, 12) };
}
function beacon(): Built {
  const s = new Sculpt(60, 140), P = proj(30, 126);
  box(s, P, -8, -8, 8, 8, 0, 4, M.stoneDk, 2);
  box(s, P, -5, -5, 5, 5, 4, 46, M.stone, 10);
  for (let h = 10; h < 46; h += 7) s.lineOn(P(-5, 5, h), P(5, 5, h), M.stone.ramp[1]);
  cyl(s, P, 0, 0, 7.5, 46, 52, M.woodDk, 20, M.basalt);
  const [tx, ty] = P(0, 0, 52); s.ellipse(tx, ty, 12, 5, M.ember, { g: 30 }); s.dot(tx - 2, ty - 1, '#ffd25a', 4, 1);
  return { base: s, baseFoot: [30, 126], shadow: castShadow(12, 6, 16, 7, 14) };
}
function torch(): Built {
  const s = new Sculpt(40, 90), P = proj(20, 82);
  box(s, P, -1, -1, 1, 1, 0, 30, M.woodDk, 10);
  box(s, P, -2.4, -2.4, 2.4, 2.4, 28, 31, M.iron, 12);
  const [x, y] = P(0, 0, 31);
  s.ellipse(x, y - 6, 4, 7, M.ember, { g: 20 }); s.ellipse(x, y - 8, 2.4, 5, M.glow, { g: 21 });
  return { base: s, baseFoot: [20, 82], shadow: castShadow(5, 2.5, 12, 5, 4) };
}
function rootLamp(): Built {
  const s = new Sculpt(50, 100), P = proj(25, 92);
  s.stroke([P(0, 0, 0), P(-.5, .5, 18), P(.8, 0, 34), P(3, 1, 40)], 2.6, 1.6, M.barkJ, { g: 10 });
  s.ellipse(...P(-1, 1, 1), 6, 2.5, M.barkJ, { g: 11, bias: -.4 });
  const [x, y] = P(4, 1.5, 34);
  s.ellipse(x, y, 4.4, 6, M.rootglass, { g: 20 }); s.dot(x - 1, y - 3, '#eafff6', 1, 2);
  s.ellipse(...P(-.5, 1.5, 14), 3, 4, M.moss, { g: 21 });
  return { base: s, baseFoot: [25, 92], shadow: castShadow(6, 3, 14, 6, 5) };
}
function lanternPost(): Built {
  const s = new Sculpt(60, 110), P = proj(22, 100);
  s.stroke([P(0, 0, 0), P(.5, 0, 16), P(-.3, 0, 32), P(.2, 0, 42)], 2.4, 1.8, mat('#2a2026', 2, .8, { cool: '#08060a', warm: '#a89098' }), { g: 10 });
  s.stroke([P(.2, 0, 41), P(4, 0, 43), P(8, 0, 41)], 1.4, 1.1, mat('#2a2026', 1, .8, { cool: '#08060a', warm: '#a89098' }), { g: 12 });
  const [hx, hy] = P(8, 0, 40);
  s.line([hx, hy], [hx, hy + 3], '#1c1418');
  s.rect(hx - 4, hy + 3, 9, 2, M.ironBk, { g: 20 });
  s.rect(hx - 3, hy + 5, 7, 10, M.lantern, { g: 21 });
  for (const dx of [-3, 0, 3]) s.line([hx + dx, hy + 5], [hx + dx, hy + 14], '#1c1418');
  s.rect(hx - 4, hy + 15, 9, 2, M.ironBk, { g: 22 });
  s.dot(hx - 1, hy + 7, '#fff3c4', 1, 3);
  s.limb(P(-.5, .5, 22), P(-.5, .5, 14), 1, .7, M.hangmoss, { g: 30 });
  return { base: s, baseFoot: [22, 100], shadow: castShadow(5, 2.5, 14, 6, 5) };
}
function greatLantern(): Built {
  const s = new Sculpt(130, 140), P = proj(65, 120);
  const tim = mat('#3b2f36', 2, .7, { cool: '#08060a', warm: '#b8a0a8' });
  box(s, P, -16, -16, 16, 16, 0, 5, tim, 2);
  box(s, P, -12, -12, 12, 12, 5, 9, tim, 6);
  box(s, P, -8, -8, 8, 8, 9, 40, M.lantern, 10, M.ironBk);
  for (const t of [-8, -3, 3, 8]) { s.line(P(t, 8, 9), P(t, 8, 40), '#1c1418'); s.line(P(8, t, 9), P(8, t, 40), '#1c1418'); }
  box(s, P, -9, -9, 9, 9, 40, 44, M.ironBk, 30);
  box(s, P, -2, -2, 2, 2, 44, 49, M.ironBk, 34);
  s.dot(...P(0, 8, 28), '#fff3c4', 3, 6);
  return { base: s, baseFoot: [65, 120], shadow: castShadow(36, 16, 14, 6) };
}
function fountain(): Built {
  const s = new Sculpt(170, 170), P = proj(85, 120);
  // Centred on the block's middle: the foot is the south row, the basin a tile north of it.
  const cy = -TILE;
  cyl(s, P, 0, cy, 22, 0, 5, M.stone, 2, M.stone, .2);
  const [wx, wy] = P(0, cy, 4.5);
  s.ellipse(wx, wy, 22 * 2.83 - 6, 22 * 1.41 - 3, M.water, { g: 4, bias: .2 });
  for (let i = 0; i < 6; i++) s.dot(wx - 30 + i * 11, wy - 6 + (i % 3) * 5, '#bfe4ff', 3, 1);
  cyl(s, P, 0, cy, 4.5, 4, 28, M.stone, 10, M.stone, .2);
  for (const dx of [-6, 0, 6]) { const [x, y] = P(0, cy, 6); s.lineOn([x + dx, y + 2], [x + dx, y - 40], M.stone.ramp[1]); }
  cyl(s, P, 0, cy, 11, 28, 33, M.basalt, 20, M.basalt);
  const [ex, ey] = P(0, cy, 33);
  for (let i = 0; i < 9; i++) s.ellipse(ex - 20 + i * 5, ey - 2 - (i % 3) * 2, 3, 4 + (i % 2), M.ember, { g: 30 + i });
  s.ellipse(ex, ey - 4, 6, 3, M.glow, { g: 40 });
  return { base: s, baseFoot: [85, 120], shadow: castShadow(56, 20, 14, 2) };
}
function hearthRing(): Built {
  const s = new Sculpt(90, 60), P = proj(45, 40);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; cyl(s, P, Math.cos(a) * 8, Math.sin(a) * 8 - 3, 2.2, 0, 3.5, i % 2 ? M.stone : M.stoneDk, 10 + Math.round(Math.sin(a) * 8) * 4 + i); }
  s.limb(P(-6, -3, 2), P(6, -3, 3), 2.4, 2.2, M.woodDk, { g: 80 }); s.limb(P(0, -9, 2), P(0, 3, 3), 2.4, 2.2, M.woodDk, { g: 81 });
  return { base: s, baseFoot: [45, 40] };
}
function forge(): Built {
  const s = new Sculpt(150, 150), P = proj(60, 120);
  // The stone hearth (west), its chimney, the anvil on its block (east).
  box(s, P, -16, -12, 4, 4, 0, 26, M.stone, 2);
  const [mx, my] = P(-6, 4, 0);
  s.poly([[mx - 14, my - 6], [mx + 2, my + 2], [mx + 2, my - 22], [mx - 14, my - 30]], { ramp: ['#0a0406', '#120608', '#1a0a0a', '#22100c', '#2a1410', '#321a12'], round: 3, gain: .2 } as Mat, { g: 20 });
  s.ellipse(mx - 6, my - 6, 6, 4, M.ember, { g: 21 }); s.ellipse(mx - 6, my - 8, 3, 2, M.glow, { g: 22 });
  box(s, P, -10, -10, -2, -2, 26, 50, M.stoneDk, 30);
  box(s, P, 10, -4, 18, 4, 0, 8, M.woodDk, 40);
  box(s, P, 8, -2.2, 20, 2.2, 8, 12, M.iron, 50);
  poly3(s, P, [[20, -1.5, 9], [25, 0, 11.5], [20, 1.5, 12]], M.iron, 53);
  return { base: s, baseFoot: [60, 120], shadow: castShadow(34, 14, 12, 4) };
}
function anvil(): Built {
  const s = new Sculpt(70, 56), P = proj(35, 42);
  box(s, P, -5, -4, 5, 4, 0, 8, M.woodDk, 10, M.wood);
  box(s, P, -6, -2.4, 6, 2.4, 8, 13, M.iron, 20);
  poly3(s, P, [[6, -1.6, 10], [11, 0, 12.5], [6, 1.6, 13]], M.iron, 23);
  s.limb(P(-2, 3, 13.5), P(5, 3, 13.5), 1.2, 1.2, M.woodDk, { g: 30 }); s.ellipse(...P(5.5, 3, 14), 2.5, 2, M.iron, { g: 31 });
  return { base: s, baseFoot: [35, 42], shadow: castShadow(16, 6, 6, 3) };
}
function chest(): Built {
  const s = new Sculpt(60, 54), P = proj(30, 42);
  box(s, P, -8, -5, 8, 5, 0, 9, M.wood, 10, M.woodLt);
  // The lid: a low half-round along x.
  const lid: [number, number, number][] = [];
  for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; lid.push([-8, 5 - (1 - Math.cos(a)) * 5, 9 + Math.sin(a) * 4]); }
  for (let k = 8; k >= 0; k--) { const a = Math.PI * k / 8; lid.push([8, 5 - (1 - Math.cos(a)) * 5, 9 + Math.sin(a) * 4]); }
  poly3(s, P, lid, M.woodLt, 20, .5);
  for (const x of [-5, 5]) { s.lineOn(P(x, 5, 0), P(x, 5, 9), M.iron.ramp[3]); s.lineOn(P(x, 5, 9), P(x, 2, 13), M.iron.ramp[3]); }
  s.dot(...P(0, 5, 8), '#ffd27a', 2, 3);
  return { base: s, baseFoot: [30, 42], shadow: castShadow(18, 7, 6, 3) };
}
function bones(): Built {
  const s = new Sculpt(60, 34), P = proj(30, 24);
  s.limb(P(-8, 1, .8), P(4, -2, .8), 1.4, 1.3, M.bone, { g: 10 });
  s.limb(P(-3, 4, .8), P(2, -5, .8), 1.2, 1.1, M.bone, { g: 11 });
  for (const [x, y] of [[-8, 1], [4, -2]] as const) s.ellipse(...P(x, y, 1), 2.2, 1.6, M.bone, { g: 12 + x });
  const [sx, sy] = P(6, 3, 2.5);
  s.ellipse(sx, sy, 5, 4.4, M.bone, { g: 20 }); s.dot(sx - 3, sy - 1, '#3a2a2a', 2, 2); s.dot(sx + 1, sy - 1, '#3a2a2a', 2, 2);
  return { base: s, baseFoot: [30, 24] };
}
function stump(): Built {
  const s = new Sculpt(60, 46), P = proj(30, 36);
  cyl(s, P, 0, 0, 6, 0, 7, M.bark, 10, { ramp: ['#7a5a3a', '#94704a', '#b08a5a', '#c99a62', '#d8b07a', '#e8c890'], round: 6, gain: .5 } as Mat, .6);
  const [tx, ty] = P(0, 0, 7);
  for (const r of [10, 6, 2]) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; if (k % 2) s.dot(tx + Math.cos(a) * r * 1.3, ty + Math.sin(a) * r * .55, '#94704a'); }
  for (const [dx, dy] of [[-8, 4], [7, 5]] as const) s.limb(P(dx * .4, dy * .4, 1.5), P(dx, dy, 0), 2.2, 1.2, M.bark, { g: 20 + dx });
  return { base: s, baseFoot: [30, 36], shadow: castShadow(16, 6, 6, 3) };
}
/** One tile of fence along +x: a post at the tile's west end and two rails across it (world px from the post's foot). */
function fenceSeg(cap: boolean): Built {
  const s = new Sculpt(60, 70), P = proj(14, 54);
  if (!cap) for (const h of [7, 14]) box(s, P, 0, -.6, TILE, .6, h, h + 2.2, M.wood, 10 + h, M.woodLt);
  box(s, P, -1.2, -1.2, 1.2, 1.2, 0, 19, M.woodDk, 40);
  poly3(s, P, [[-1.2, 1.2, 19], [1.2, 1.2, 19], [0, 0, 21.5]], M.woodLt, 44, .6);
  return { base: s, baseFoot: [14, 54] };
}

// ── The registry: top-down cache key → twin ──
const seedOf = (k: string): number => Number(k.split(/[-:]/).pop()) || 0;
type Make = (key: string, low: boolean) => Built;
const MAKERS: readonly [RegExp, Make][] = [
  [/^(?:low-)?tree:(oak|fruit):\d+$/, (k, low) => broadleaf(seedOf(k), k.includes(':fruit:'), low)],
  [/^hd-tree:\d+$/, (k, low) => broadleaf(seedOf(k), false, low)],
  [/^(?:low-)?tree:pine:\d+$/, (k, low) => pine(seedOf(k), low)],
  [/^jungle:\d+$/, (k, low) => jungle(seedOf(k), low)],
  [/^giant:\d+$/, (k, low) => giant(seedOf(k), low)],
  [/^swamp-tree:\d+$/, (k, low) => cypress(seedOf(k), low)],
  [/^bush-\d+$/, (k, low) => bush(seedOf(k), low)],
  [/^fern-\d+$/, (k, low) => fern(seedOf(k), low)],
  [/^reeds-\d+$/, (k, low) => reeds(seedOf(k), low)],
  [/^gloomcap-\d+$/, k => gloomcap(seedOf(k))],
  [/^flowerbed:\d+:\d+$/, k => { const [, w, sd] = k.split(':'); return flowerbed(Number(w), Number(sd)); }],
  [/^boulder-\d+$/, k => boulder(seedOf(k))],
  [/^stone-\d+$/, k => standingStone(seedOf(k))],
  [/^grave-\d+$/, k => gravestone(seedOf(k))],
  [/^pillar-\d+$/, k => pillar(seedOf(k))],
  [/^ore-seam$/, oreSeam],
  [/^barrel$/, barrel], [/^crate$/, crate], [/^bench$/, bench], [/^lamp$/, lamp], [/^signpost$/, signpost], [/^cart$/, cart],
  [/^waystone$/, waystone], [/^beacon$/, beacon], [/^torch-post$/, torch], [/^root-lamp$/, rootLamp], [/^lantern-post$/, lanternPost],
  [/^great-lantern$/, greatLantern], [/^fountain$/, fountain], [/^hearth$/, hearthRing], [/^forge$/, forge], [/^anvil$/, anvil],
  [/^chest$/, chest], [/^bones$/, bones], [/^stump$/, stump],
];
/** Every top-down key with an isometric twin (the gallery and the spec walk it). */
export const ISO_PROP_KEYS: readonly string[] = [
  ...['oak', 'fruit', 'pine'].flatMap(k => [0, 1, 2, 3, 4, 5].map(v => `tree:${k}:${v}`)),
  ...[0, 1, 2, 3, 4, 5].map(v => `jungle:${v}`), ...[0, 1, 2].map(v => `giant:${v}`), ...[0, 1, 2, 3, 4, 5].map(v => `swamp-tree:${v}`),
  ...['bush', 'fern', 'reeds', 'gloomcap', 'boulder', 'stone', 'grave', 'pillar'].flatMap(k => [0, 1, 2].map(v => `${k}-${v}`)),
  'flowerbed:2:3', 'fence:3', 'ore-seam', 'barrel', 'crate', 'bench', 'lamp', 'signpost', 'cart', 'waystone', 'beacon', 'torch-post', 'root-lamp',
  'lantern-post', 'great-lantern', 'fountain', 'hearth', 'forge', 'anvil', 'chest', 'bones', 'stump',
];

const arts = new Map<string, IsoArt | null>();
let budgetEnd = 0;
let starved = 0;
let idle = false;
/** Frames a waiting twin may go unbaked while the Keeper walks (a bake is a few ms, ×6 on a slow phone). */
const STARVE = 24;
/**
 * Start a frame's bake budget (a performance.now() deadline). While the Keeper stands (`still`) one twin bakes a frame;
 * while he walks a twin waits for a frame with time to spare, or one in STARVE frames, so the walk stays smooth and a
 * new wood still fills in.
 */
export function isoPropsFrame(deadline: number, still = false): void { budgetEnd = deadline; idle = still; starved++; }
/**
 * The twin a top-down key shares: the six seeds of a tree kind fold onto three sculpts (the bake is the cost, and three
 * read as varied in a wood), the dead cypresses onto one, the palms keep their two.
 */
export function canonKey(key: string): string {
  const m = /^((?:low-)?tree:(?:oak|fruit|pine)|swamp-tree|jungle|hd-tree):(\d+)$/.exec(key);
  if (!m) return key;
  const base = m[1].replace(/^low-/, ''), v = Number(m[2]);
  const f = base === 'jungle' ? (v === 3 || v === 4 ? v : v % 3) : base === 'swamp-tree' ? (v >= 4 ? 4 : v % 3) : v % 3;
  return `${base === 'hd-tree' ? 'tree:oak' : base}:${f}`;
}
/** Bake a twin now, whatever the budget (galleries, specs). */
export function isoArtByKey(key: string, low = envDetail() === 'low'): IsoArt | null {
  key = canonKey(key);
  const k = `${low ? 'L' : 'N'}|${key}`;
  if (arts.has(k)) return arts.get(k)!;
  let art: IsoArt | null = null;
  const fm = /^fence:(\d+)$/.exec(key);
  if (fm) {
    const seg = finish(fenceSeg(false), low).base!, cap = finish(fenceSeg(true), low).base!;
    art = { base: null, sway: [], fades: false, shadow: null, run: { tiles: Number(fm[1]), seg, cap } };
  } else {
    const mk = MAKERS.find(([re]) => re.test(key));
    if (mk) art = finish(mk[1](key, low), low);
  }
  arts.set(k, art);
  return art;
}
/** Each sprite's resolved twin at a detail (the per-frame lookup: no string work once found). */
const resolved = new WeakMap<Sprite, { low: boolean; art: IsoArt | null }>();
/** The isometric twin of a top-down sprite, or null (none, or not baked yet: draw the sprite). */
export function isoArt(sp: Sprite): IsoArt | null {
  const low = envDetail() === 'low', r = resolved.get(sp);
  if (r && r.low === low) return r.art;
  const raw = spriteKey(sp);
  if (!raw) { resolved.set(sp, { low, art: null }); return null; }
  const key = canonKey(raw), k = `${low ? 'L' : 'N'}|${key}`;
  let art = arts.get(k);
  if (art === undefined) {
    if (!/^fence:/.test(key) && !MAKERS.some(([re]) => re.test(key))) art = null;
    else {
      if (typeof document === 'undefined') return null;
      if (!idle && performance.now() > budgetEnd && starved < STARVE) return null;
      starved = 0;
      const t0 = performance.now();
      art = isoArtByKey(key, low);
      bakes++; bakeMs += performance.now() - t0;
      // One bake spends the rest of the frame's budget.
      budgetEnd = 0; idle = false;
    }
  }
  resolved.set(sp, { low, art });
  return art;
}
let bakes = 0, bakeMs = 0;
/** Bakes so far and their ms (the perf probe). */
export function isoPropBakes(): { n: number; ms: number } { return { n: bakes, ms: Math.round(bakeMs) }; }
/** The baked twins' canvas pixels (the memory check). */
export function isoPropPixels(): number {
  let n = 0;
  const px = (p: IsoPart | null | undefined) => { if (p) n += p.img.width * p.img.height; };
  for (const a of arts.values()) if (a) { px(a.base); a.sway.forEach(px); px(a.shadow); if (a.run) { px(a.run.seg); px(a.run.cap); } }
  return n;
}

// ── Drawing (under the engine's iso screen transform: one unit a world px, iso coordinates) ──
/** How many queue items a twin takes (a fence a tile each, plus a joining tile, plus its end post). */
export function isoParts(art: IsoArt): number { return art.run ? art.run.tiles + 1 : 1; }
/** Queue depth (iso Y) of part `i` of a twin standing at world foot (x, y). */
export function isoPartDepth(art: IsoArt, x: number, y: number, i: number): number {
  if (!art.run) return (x + y) / 2;
  const x0 = x - art.run.tiles * TILE / 2, xi = x0 + i * TILE + TILE / 2;
  return (xi + y) / 2;
}
const put = (c: CanvasRenderingContext2D, p: IsoPart, X: number, Y: number) => c.drawImage(p.img, X - p.ax / 2, Y - p.ay / 2, p.img.width / 2, p.img.height / 2);
/**
 * Draw part `i` of a twin at world foot (x, y). `t` the time (the sway), `still` reduced motion, `jig` a chop's shake in
 * world px, `fade` the crown's alpha (crownFade), `joins` (a fence) the next run starts a tile on.
 */
export function drawIsoArt(c: CanvasRenderingContext2D, art: IsoArt, x: number, y: number, i: number, t: number, still: boolean, jig: number, fade: number, joins: boolean): void {
  const rx = Math.round(x), ry = Math.round(y);
  if (art.run) {
    // The last part: the run's end post, or (joining the next run a tile on) one more post and rails across the gap.
    const x0 = rx - art.run.tiles * TILE / 2, xi = x0 + i * TILE, p = i === art.run.tiles && !joins ? art.run.cap : art.run.seg;
    put(c, p, xi - ry, (xi + ry) / 2);
    return;
  }
  const X = rx - ry + jig, Y = (rx + ry) / 2;
  if (art.base) put(c, art.base, X, Y);
  const n = art.sway.length;
  if (!n) return;
  let f = 0;
  if (n > 1 && !still) {
    // Each its own slow beat; most of the time at rest, a lean one way or the other now and then.
    const ph = hash(rx, ry, 77) * 6.28, w = Math.sin(t * .9 + ph) + .45 * Math.sin(t * 2.1 + ph * 1.7);
    f = w > .95 ? 1 : w < -.95 ? 2 : 0;
  }
  if (fade < 1) c.globalAlpha = fade;
  put(c, art.sway[f], X, Y);
  if (fade < 1) c.globalAlpha = 1;
}
/** The twin's shadow on the floor (iso screen transform), at world foot (x, y). */
export function drawIsoShadow(c: CanvasRenderingContext2D, art: IsoArt, x: number, y: number, alpha = .3): void {
  if (!art.shadow) return;
  const rx = Math.round(x), ry = Math.round(y);
  c.globalAlpha = alpha; put(c, art.shadow, rx - ry, (rx + ry) / 2); c.globalAlpha = 1;
}
const joined = new WeakMap<object, boolean>();
/** A fence run: does another run start a tile past its east end, on the same line (they join across the gap)? Memoised. */
export function fenceJoins(o: { x: number; y: number }, art: IsoArt, near: (x0: number, y0: number, x1: number, y1: number) => readonly { x: number; y: number; sprite: () => Sprite }[]): boolean {
  const hit = joined.get(o);
  if (hit !== undefined) return hit;
  let j = false;
  if (art.run) {
    const east = o.x + art.run.tiles * TILE / 2 + TILE;
    j = near(east - 2, o.y - 2, east + TILE * 4, o.y + 2).some(n => {
      if (n === o || Math.abs(n.y - o.y) > .5) return false;
      const k = spriteKey(n.sprite()), m = k ? /^fence:(\d+)$/.exec(k) : null;
      return !!m && Math.abs(n.x - Number(m[1]) * TILE / 2 - east) < 1;
    });
  }
  joined.set(o, j);
  return j;
}
/** How far a crown fades while something that matters stands behind it: still reads as a tree, never fog. */
export const CROWN_FADE = .45;
/**
 * Does this twin's crown hide any of the `n` figures at iso points `pts` (x, y pairs, the foot), standing behind it?
 * Each figure's body is a box 24 wide and 44 tall over its foot; a quarter of it under the crown is enough.
 */
export function behindCrown(art: IsoArt, x: number, y: number, pts: ArrayLike<number>, n: number): boolean {
  if (!art.fades || !art.sway.length) return false;
  const rx = Math.round(x), ry = Math.round(y), X = rx - ry, Y = (rx + ry) / 2, p = art.sway[0];
  const x0 = X - p.ax / 2, y0 = Y - p.ay / 2, x1 = x0 + p.img.width / 2, y1 = y0 + p.img.height / 2;
  for (let k = 0; k < n; k++) {
    const PX = pts[k * 2], PY = pts[k * 2 + 1];
    if (PY >= Y) continue;
    const w = Math.min(PX + 12, x1) - Math.max(PX - 12, x0), h = Math.min(PY, y1) - Math.max(PY - 44, y0);
    if (w > 0 && h > 0 && w * h >= 24 * 44 * .25) return true;
  }
  return false;
}
const fades = new WeakMap<object, number>();
/** A crown's alpha this frame, eased toward CROWN_FADE (hiding something) or whole over about 150 ms; a snap when still. */
export function crownFade(o: object, behind: boolean, dt: number, still: boolean): number {
  const want = behind ? CROWN_FADE : 1;
  let a = fades.get(o) ?? 1;
  if (a === want && !behind) return 1;
  a = still ? want : a + Math.sign(want - a) * Math.min(Math.abs(want - a), dt / .15 * (1 - CROWN_FADE));
  fades.set(o, a);
  return a;
}

// ── Ground items ──
const icons = new WeakMap<HTMLCanvasElement, IsoPart>();
/**
 * A loot icon lying on the floor (HD): tipped back onto the ground (squashed to three quarters, its foot at the front),
 * with a pixel of dark thickness under its lower edge, so it reads as a small thing lying there and stays readable.
 */
export function isoIcon(icon: HTMLCanvasElement): IsoPart {
  let p = icons.get(icon);
  if (p) return p;
  // 1.25× the satchel icon (whole HD px), tipped back to 0.85 of its height: readable lying in the grass.
  const S = icon.width, W = Math.round(S * 2.5), H = Math.round(W * .85);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H + 3;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  // A light rim one HD px under it (so it reads on dark ground and water), then its thickness, its own silhouette darkened.
  g.drawImage(icon, 0, 3, W, H);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(244,236,216,.5)'; g.fillRect(0, 0, W, H + 3);
  g.globalCompositeOperation = 'source-over';
  const dk = document.createElement('canvas'); dk.width = W; dk.height = H + 3;
  const d = dk.getContext('2d')!; d.imageSmoothingEnabled = false;
  d.drawImage(icon, 0, 2, W, H); d.globalCompositeOperation = 'source-in'; d.fillStyle = '#1c121c'; d.fillRect(0, 0, W, H + 3);
  g.drawImage(dk, 0, 0);
  g.drawImage(icon, 0, 0, W, H);
  p = { img: cv, ax: W / 2, ay: H + 2 };
  icons.set(icon, p);
  return p;
}
let contact: IsoPart | null = null;
/** The small soft contact shadow under a thing lying on the ground (iso screen units, at the anchor already set). */
export function drawContact(c: CanvasRenderingContext2D, x: number, y: number, r = 7): void {
  contact ??= castShadow(16, 7, 0, 0);
  const s = r / 8;
  c.globalAlpha = .3;
  c.drawImage(contact.img, Math.round(x) - contact.ax / 2 * s, Math.round(y) - contact.ay / 2 * s, contact.img.width / 2 * s, contact.img.height / 2 * s);
  c.globalAlpha = 1;
}
/** Draw an iso icon with its foot at (x, y) (the engine's upright anchor), mirrored by the drop's seed. */
export function drawIsoIcon(c: CanvasRenderingContext2D, p: IsoPart, x: number, y: number, flip: boolean): void {
  const X = Math.round(x), Y = Math.round(y);
  if (flip) { c.save(); c.translate(X, 0); c.scale(-1, 1); c.drawImage(p.img, -p.ax / 2, Y - p.ay / 2, p.img.width / 2, p.img.height / 2); c.restore(); }
  else c.drawImage(p.img, X - p.ax / 2, Y - p.ay / 2, p.img.width / 2, p.img.height / 2);
}
