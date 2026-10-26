/**
 * td-iso.ts — the isometric projection prototype (td-artopt.ts `iso`; owner 2026-10-26, Diablo II's tavern: "the angle is
 * perfect … our style, cozy and nice with some really dark to it"). Rendering only: the world stays the square grid it
 * is (collision, maps, paths, the room server). A world point (x, y) is drawn at iso (x − y, (x + y) / 2), so a 16-px
 * tile is a 32 × 16 diamond.
 *
 * - **Ground**: each square ground chunk (the HD bake, organic edges and all) is resampled once into a diamond chunk;
 *   solid ground (walls, rock) goes dark — walls stand up as blocks instead.
 * - **Walls**: a block per wall tile that borders a floor: its two camera-facing faces (south: lower left, lit; east:
 *   lower right, shaded) and a timber cap. Plaster over a wainscot, timber posts every few tiles. A wall nearer the
 *   camera than the Keeper is cut down to a stub (Diablo II's cutaway), so a room shows its inside.
 * - **Props**: the tavern's furniture sculpted for this angle at the HD pixel (td-hd-sculpt.ts): tables, benches, the bar,
 *   barrels, crates, shelves, the hearth, lamps. Anything else stands as its top-down sprite.
 * - **Light**: indoors the room sinks into a warm dark, and every lamp, the hearth and the Keeper pour a pool of light
 *   (a 2:1 ellipse on the floor); a corner with no lamp stays dark.
 */
import { Sculpt, rampOf, type Mat, type Pt } from './td-hd-sculpt';
import { TILE } from './td-art';

/** World → iso. */
export function isoOf(x: number, y: number): { X: number; Y: number } { return { X: x - y, Y: (x + y) / 2 }; }
/** Iso → world. */
export function worldOfIso(X: number, Y: number): { x: number; y: number } { return { x: Y + X / 2, y: Y - X / 2 }; }

// ── Ground: square HD chunks resampled into diamonds ──
const VOID: readonly [number, number, number] = [11, 7, 16];

export interface IsoChunk { canvas: HTMLCanvasElement; X: number; Y: number }

/**
 * Resample a square ground chunk (`src`: HD, `hd` px a world px, covering world [x0, x0 + span)²) into its iso diamond.
 * `solid(c, r)` darkens wall and rock tiles (the blocks stand on them).
 */
export function isoChunk(src: HTMLCanvasElement, x0: number, y0: number, span: number, hd: number, solid: (c: number, r: number) => boolean): IsoChunk {
  const sg = src.getContext('2d', { willReadFrequently: true })!, sw = src.width, sd = sg.getImageData(0, 0, sw, src.height).data;
  // The diamond's bounding box in iso px.
  const X0 = x0 - (y0 + span), Y0 = (x0 + y0) / 2, W = span * 2, H = span;
  const out = document.createElement('canvas'); out.width = W * hd; out.height = H * hd;
  const g = out.getContext('2d')!, img = g.createImageData(out.width, out.height), d = img.data;
  let lastC = NaN, lastR = NaN, lastSolid = false;
  for (let j = 0; j < out.height; j++) {
    const Y = Y0 + (j + .5) / hd;
    for (let i = 0; i < out.width; i++) {
      const X = X0 + (i + .5) / hd, x = Y + X / 2, y = Y - X / 2, lx = x - x0, ly = y - y0;
      if (lx < 0 || ly < 0 || lx >= span || ly >= span) continue;
      const o = (j * out.width + i) * 4, tc = Math.floor(x / TILE), tr = Math.floor(y / TILE);
      if (tc !== lastC || tr !== lastR) { lastC = tc; lastR = tr; lastSolid = solid(tc, tr); }
      if (lastSolid) { d[o] = VOID[0]; d[o + 1] = VOID[1]; d[o + 2] = VOID[2]; d[o + 3] = 255; continue; }
      const k = (Math.floor(ly * hd) * sw + Math.floor(lx * hd)) * 4;
      d[o] = sd[k]; d[o + 1] = sd[k + 1]; d[o + 2] = sd[k + 2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: out, X: X0, Y: Y0 };
}

// ── Sculpting at this angle ──
/** An iso sprite: HD (2 px an iso px), its foot at (ax, ay) in sprite px; lights as iso-px offsets from the foot. */
export interface IsoSprite { img: HTMLCanvasElement; ax: number; ay: number; lights?: readonly { x: number; y: number; r: number }[] }

const wood = (base: string, extra: Partial<Mat> = {}): Mat => ({ ramp: rampOf(base, { cool: '#140a0c', warm: '#ffe0b0', hi: .4 }), round: 1.5, gain: .6, ...extra });
const MT = {
  oak: wood('#8a5a36'), oakDk: wood('#5e3a24'), oakLt: wood('#a87448'),
  plaster: { ramp: rampOf('#cdb592', { cool: '#3a2a30', warm: '#fff4dc', hi: .35, deep: .5 }), round: 1.5, gain: .5 } as Mat,
  stone: { ramp: rampOf('#7a7068', { cool: '#16121a', warm: '#f0e8dc', hi: .4 }), round: 2, gain: .7 } as Mat,
  iron: { ramp: rampOf('#6a6670', { cool: '#100e16', warm: '#f0f0ff', hi: .5 }), round: 1, shine: true, gain: .8 } as Mat,
  brass: { ramp: rampOf('#d0a048', { cool: '#3a1c08', warm: '#fff8d0', hi: .6 }), round: 1, shine: true, gain: .8 } as Mat,
  cloth: { ramp: rampOf('#7c2234', { cool: '#1a0a1c', hi: .3 }), round: 2, gain: .6 } as Mat,
  glow: { ramp: ['#ff9a3a', '#ffb04a', '#ffc866', '#ffdc88', '#fff0b8', '#fffbe8'], round: 2, gain: .4, soft: true } as Mat,
};

/** A world-aligned box (world px from the foot; h up) on sculpt `s` with its foot at (ox, oy): south, east, then top. */
function box(s: Sculpt, ox: number, oy: number, x0: number, y0: number, x1: number, y1: number, h0: number, h1: number, m: Mat, g: number, top: Mat = m): void {
  const P = (x: number, y: number, h: number): Pt => [ox + (x - y) * 2, oy + (x + y) - h * 2];
  s.poly([P(x0, y1, h0), P(x1, y1, h0), P(x1, y1, h1), P(x0, y1, h1)], m, { g, bias: .2 });
  s.poly([P(x1, y0, h0), P(x1, y1, h0), P(x1, y1, h1), P(x1, y0, h1)], m, { g: g + 1, bias: -.9 });
  s.poly([P(x0, y0, h1), P(x1, y0, h1), P(x1, y1, h1), P(x0, y1, h1)], top, { g: g + 2, bias: .9 });
}
/** An upright cylinder (radius r world px) from h0 to h1. */
function cylinder(s: Sculpt, ox: number, oy: number, cx: number, cy: number, r: number, h0: number, h1: number, m: Mat, g: number, top: Mat = m): void {
  const X = ox + (cx - cy) * 2, Y = oy + (cx + cy), rx = r * 2 * 1.414, ry = r * 1.414;
  s.ellipse(X, Y - h0 * 2, rx, ry, m, { g });
  s.poly([[X - rx, Y - h0 * 2], [X + rx, Y - h0 * 2], [X + rx, Y - h1 * 2], [X - rx, Y - h1 * 2]], m, { g });
  s.ellipse(X, Y - h1 * 2, rx, ry, top, { g: g + 1, bias: .8 });
}

const props = new Map<string, IsoSprite | null>();
/** The tavern's furniture at this angle, by MapObject id (null: none — the caller stands the top-down sprite up). */
export function isoProp(id: string): IsoSprite | null {
  if (props.has(id)) return props.get(id)!;
  const make = PROPS[id];
  const sp = make ? make() : null;
  props.set(id, sp);
  return sp;
}
const W0 = 96, H0 = 120, OX = 48, OY = 96;
const PROPS: Record<string, () => IsoSprite> = {
  table: () => {
    const s = new Sculpt(W0, H0);
    for (const [x, y] of [[-6, -5], [5, -5], [-6, 4], [5, 4]]) box(s, OX, OY, x, y, x + 1.5, y + 1.5, 0, 9, MT.oakDk, 10 + x * 3 + y);
    box(s, OX, OY, -7.5, -6.5, 7.5, 6.5, 9, 11, MT.oak, 40, MT.oakLt);
    // A tankard and a plate on the board.
    cylinder(s, OX, OY, 2, -1, 1.6, 11, 15, MT.brass, 60);
    s.ellipse(OX + (-3 - 2) * 2, OY + (-3 + 2) - 22, 5, 2.5, MT.stone, { g: 62, bias: .6 });
    for (let i = -6; i <= 6; i += 3) s.line([OX + (i + 6.5) * 2, OY + (i - 6.5) - 22], [OX + (i - 6.5) * 2, OY + (i + 6.5) - 22], MT.oak.ramp[2]);
    return { img: s.render(), ax: OX + 1, ay: OY + 1 };
  },
  bench: () => {
    const s = new Sculpt(W0, H0);
    for (const x of [-6, 5]) box(s, OX, OY, x, -2, x + 1.5, 2, 0, 5, MT.oakDk, 10 + x);
    box(s, OX, OY, -7.5, -3, 7.5, 3, 5, 6.5, MT.oak, 30, MT.oakLt);
    return { img: s.render(), ax: OX + 1, ay: OY + 1 };
  },
  counter: () => {
    const s = new Sculpt(W0, H0);
    box(s, OX, OY, -8, -5, 8, 5, 0, 13, MT.oakDk, 10);
    for (let i = -6; i <= 6; i += 4) s.line([OX + (i - 5) * 2, OY + (i + 5) - 2], [OX + (i - 5) * 2, OY + (i + 5) - 24], MT.oakDk.ramp[1]);
    box(s, OX, OY, -8, -6, 8, 6, 13, 14.5, MT.oak, 30, MT.oakLt);
    cylinder(s, OX, OY, -3, -2, 1.5, 14.5, 18, MT.brass, 50);
    return { img: s.render(), ax: OX + 1, ay: OY + 1 };
  },
  barrel: () => {
    const s = new Sculpt(W0, H0);
    cylinder(s, OX, OY, 0, 0, 5.5, 0, 15, MT.oak, 10, MT.oakLt);
    for (const h of [3, 12]) { const X = OX, Y = OY - h * 2; s.line([X - 15, Y], [X + 15, Y], MT.iron.ramp[1]); s.line([X - 15, Y + 1], [X + 15, Y + 1], MT.iron.ramp[3]); }
    for (let i = -10; i <= 10; i += 5) s.line([OX + i, OY - 2], [OX + i, OY - 28], MT.oak.ramp[1]);
    s.ellipse(OX, OY - 30, 6, 3, MT.oakDk, { g: 30 });
    return { img: s.render(), ax: OX + 1, ay: OY + 1 };
  },
  crate: () => {
    const s = new Sculpt(W0, H0);
    box(s, OX, OY, -6, -6, 6, 6, 0, 12, MT.oakLt, 10, MT.oak);
    const P = (x: number, y: number, h: number): Pt => [OX + (x - y) * 2, OY + (x + y) - h * 2];
    s.line(P(-6, 6, 6), P(6, 6, 6), MT.oakDk.ramp[1]); s.line(P(6, -6, 6), P(6, 6, 6), MT.oakDk.ramp[0]);
    s.line(P(-6, 6, 0), P(6, 6, 12), MT.oakDk.ramp[2]);
    return { img: s.render(), ax: OX + 1, ay: OY + 1 };
  },
  shelf: () => {
    const s = new Sculpt(W0, H0);
    box(s, OX, OY, -7, -7, 7, -2, 0, 30, MT.oakDk, 10, MT.oak);
    const P = (x: number, y: number, h: number): Pt => [OX + (x - y) * 2, OY + (x + y) - h * 2];
    const bottles = ['#3a8a5a', '#8a2a3a', '#d8b040', '#4a6ac8', '#9a5ad0'];
    for (const h of [8, 16, 24]) {
      s.line(P(-7, -2, h), P(7, -2, h), MT.oak.ramp[4]);
      for (let i = 0; i < 4; i++) { const x = -5.5 + i * 3.4, c = bottles[(i + h) % 5]; const [bx, by] = P(x, -2, h); s.dot(bx, by - 5, c, 2, 5); s.dot(bx, by - 7, '#2a1a14', 1, 2); s.dot(bx, by - 4, '#fff8e0'); }
    }
    return { img: s.render(), ax: OX + 1, ay: OY + 1 };
  },
  hearth: () => {
    const s = new Sculpt(W0, H0);
    box(s, OX, OY, -8, -8, 8, -1, 0, 26, MT.stone, 10);
    box(s, OX, OY, -9, -8, 9, 0, 26, 29, MT.oakDk, 20);
    const P = (x: number, y: number, h: number): Pt => [OX + (x - y) * 2, OY + (x + y) - h * 2];
    s.poly([P(-4.5, -1, 0), P(4.5, -1, 0), P(4.5, -1, 11), P(0, -1, 14), P(-4.5, -1, 11)], { ramp: ['#0a0406', '#120608', '#1a0a0a', '#22100c', '#2a1410', '#321a12'], round: 3, gain: .2 } as Mat, { g: 30 });
    for (const [x, h, r] of [[-1.5, 3, 2.6], [1.5, 4, 2.2], [0, 6, 2]] as const) s.ellipse(...P(x, -1, h), r * 1.6, r * 2.4, MT.glow, { g: 40 });
    const [fx, fy] = P(0, -1, 3); s.dot(fx - 1, fy - 2, '#fffbe8', 2, 3);
    return { img: s.render(), ax: OX + 1, ay: OY + 1, lights: [{ x: 4, y: -6, r: 70 }] };
  },
  lamp: () => {
    const s = new Sculpt(W0, H0);
    box(s, OX, OY, -2, -2, 2, 2, 0, 1.5, MT.iron, 10);
    box(s, OX, OY, -.7, -.7, .7, .7, 1.5, 24, MT.iron, 12);
    box(s, OX, OY, -2.6, -2.6, 2.6, 2.6, 24, 31, MT.glow, 20, MT.brass);
    const P = (x: number, y: number, h: number): Pt => [OX + (x - y) * 2, OY + (x + y) - h * 2];
    s.line(P(-2.6, 2.6, 24), P(-2.6, 2.6, 31), MT.iron.ramp[0]); s.line(P(2.6, 2.6, 24), P(2.6, 2.6, 31), MT.iron.ramp[0]); s.line(P(2.6, -2.6, 24), P(2.6, -2.6, 31), MT.iron.ramp[0]);
    box(s, OX, OY, -3, -3, 3, 3, 31, 33, MT.iron, 30);
    const [lx, ly] = P(0, 2.6, 27); s.dot(lx - 1, ly - 2, '#fffbe8', 2, 3);
    return { img: s.render(), ax: OX + 1, ay: OY + 1, lights: [{ x: 0, y: -28, r: 58 }] };
  },
};

// ── Walls ──
/** A wall's height in iso px, and the stub a cut-away wall is cut down to. */
export const WALL_H = 46, STUB_H = 6;
const blocks = new Map<string, IsoSprite>();
const PLASTER = rampOf('#cbb28e', { cool: '#2e2028', warm: '#fff0d8', hi: .3, deep: .5 }), TIMBER = rampOf('#5a3a26', { cool: '#120808', warm: '#e8c098', hi: .3 });
const CAP = rampOf('#4a3024', { cool: '#0e0608', warm: '#e8c8a0', hi: .35 });
const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;
/**
 * A wall block: `south` / `east` its faces that show (each faces a floor tile), `cut` the cut-away stub, `post` a timber
 * post at its left seam on that face. HD sprite, foot at the tile's centre.
 */
export function isoWall(south: boolean, east: boolean, cut: boolean, postS: boolean, postE: boolean): IsoSprite {
  const key = `${+south}${+east}${+cut}${+postS}${+postE}`;
  let b = blocks.get(key);
  if (b) return b;
  const H = cut ? STUB_H : WALL_H, K = 2, W = 34 * K, HH = (18 + H) * K, ox = 17 * K, oy = (H + 9) * K;
  const el = document.createElement('canvas'); el.width = W; el.height = HH;
  const g = el.getContext('2d')!, img = g.createImageData(W, HH), d = img.data;
  const put = (i: number, j: number, c: readonly number[], a = 255) => { if (i < 0 || j < 0 || i >= W || j >= HH) return; const o = (j * W + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = a; };
  const tex = (u: number, v: number, lit: number, post: boolean): readonly number[] => {
    // v: height above the floor (iso px), u: 0…1 along the face. Wainscot to 12, plaster above, a beam at the top.
    const k = lit;
    if (cut) return rgb(v > H - 2 ? CAP[4] : TIMBER[Math.max(0, 2 + k)]);
    if (v > H - 4) return rgb(TIMBER[Math.max(0, Math.min(5, 3 + k + (v > H - 1.5 ? 1 : 0)))]);
    if (post && u < .14) return rgb(TIMBER[Math.max(0, Math.min(5, (u < .05 ? 4 : 2) + k))]);
    if (v < 12) { const board = Math.floor(u * 6) !== Math.floor((u + .03) * 6); return rgb(TIMBER[Math.max(0, Math.min(5, (board ? 0 : v > 10.5 ? 4 : 2) + k))]); }
    // Plaster, darker toward the floor and with a soft grime, a little mottled.
    const m = ((Math.sin(u * 37 + v * 3.1) + Math.sin(u * 11 - v * 1.7)) * .25 + .5) > .78 ? -1 : 0;
    return rgb(PLASTER[Math.max(0, Math.min(5, 3 + k + m + (v < 16 ? -1 : 0)))]);
  };
  for (let j = 0; j < HH; j++) for (let i = 0; i < W; i++) {
    const X = (i + .5) / K - ox / K, Y = (j + .5) / K - oy / K;
    // South face: between the left corner (−16, 0) and the bottom (0, 8), rising H.
    if (south && X >= -16 && X <= 0) { const base = (X + 16) / 2, v = base - Y; if (v >= 0 && v <= H) { put(i, j, tex((X + 16) / 16, v, 0, postS)); continue; } }
    if (east && X >= 0 && X <= 16) { const base = 8 - X / 2, v = base - Y; if (v >= 0 && v <= H) { put(i, j, tex(X / 16, v, -2, postE)); continue; } }
    // The cap: the tile's diamond raised by H.
    const ty = Y + H;
    if (Math.abs(X) / 16 + Math.abs(ty) / 8 <= 1) { const edge = Math.abs(X) / 16 + Math.abs(ty) / 8 > .82; put(i, j, rgb(cut ? CAP[edge ? 2 : 4] : CAP[edge ? 1 : 3])); }
  }
  // A dark line where the two faces meet, and the outline along the cap's front edges.
  g.putImageData(img, 0, 0);
  g.fillStyle = '#1a0e10';
  if (south && east) g.fillRect(ox - 1, oy + 16 - H * K, 2, H * K);
  b = { img: el, ax: ox, ay: oy };
  blocks.set(key, b);
  return b;
}

// ── Light ──
let lightCv: HTMLCanvasElement | null = null;
/**
 * Indoors: sink the view into a warm dark (`ambient`), then pour each light's pool (screen px: x, y, radius) back in,
 * a 2:1 ellipse on the floor with a hot heart. Drawn at a quarter resolution and laid over by multiply (soft light,
 * never over the HUD: the HUD is HTML).
 */
export function lightPass(c: CanvasRenderingContext2D, w: number, h: number, ambient: string, lights: readonly { x: number; y: number; r: number; warm?: boolean }[]): void {
  const q = 4, lw = Math.ceil(w / q), lh = Math.ceil(h / q);
  const L = lightCv ??= document.createElement('canvas');
  if (L.width !== lw || L.height !== lh) { L.width = lw; L.height = lh; }
  const g = L.getContext('2d')!;
  g.globalCompositeOperation = 'source-over'; g.fillStyle = ambient; g.fillRect(0, 0, lw, lh);
  g.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    g.save(); g.translate(l.x / q, l.y / q); g.scale(1, .55);
    const r = l.r / q, gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, l.warm === false ? 'rgba(170,190,230,.9)' : 'rgba(255,196,128,.95)');
    gr.addColorStop(.35, l.warm === false ? 'rgba(110,130,170,.55)' : 'rgba(214,140,80,.6)');
    gr.addColorStop(.7, 'rgba(110,64,40,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.restore();
  }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = true;
  c.globalCompositeOperation = 'multiply'; c.drawImage(L, 0, 0, lw * q, lh * q);
  // A faint warm bloom where the light is strongest.
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .12; c.drawImage(L, 0, 0, lw * q, lh * q);
  c.restore();
}
