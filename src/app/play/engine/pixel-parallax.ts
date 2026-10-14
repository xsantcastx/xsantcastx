/**
 * pixel-parallax.ts — a procedural pixel parallax set for every town and hunting
 * ground (one art style, pass 2; style guide §8, W8).
 *
 * The towns and hunts stood on painted 3:2 backdrops (`bg-*`) behind a pixel
 * Keeper, pixel people, pixel props and pixel ground. Until the commissioned W8
 * layers land (parallax.ts draws those the moment they load, and wins), this
 * builds the four layers in code, the way cave-backdrop.ts builds the Delve's:
 *
 *   sky   0.03  flat bands top → horizon (the realm's §5.2 sky ramp) with one
 *               checker row between bands; the realm's sun, moon, stars or eclipse
 *   far   0.20  the landmark on the horizon, one tone near the horizon colour:
 *               the Godforge ring, the heliograph towers, the archive spires,
 *               the Orrery, the canopy
 *   mid   0.45  roofs, terraces, domes, hills: three tones, lit along the top
 *   near  0.70  a few big shapes behind the walk lane (chimneys, columns,
 *               arches, brass pylons, roots), outlined lighter than any figure,
 *               its bottom rows low and dark so nothing reads as a floor
 *
 * Each layer is 480 art px wide and seamless left to right, painted once per
 * realm and kind of place into a small canvas, cropped to the rows it uses
 * (so a layer is never blitted over empty sky), and laid at 4 world px per art
 * px — the figures' grid — unsmoothed and snapped to whole art pixels. Four
 * blits a frame, the lowest three only over their own bands. Hunts (the wild
 * ground past each town) swap the town's roofs for rock, ridges and roots.
 *
 * Browser only (canvas); without a DOM `draw` returns false and the caller
 * keeps the painting.
 */
import { canvas } from '../../shared/keeper-look/keeper-paint';
import { parallaxOffset, PARALLAX_SPEED } from './parallax';
import { crisp } from './prop-pixel';

export type BackdropRealm = 'infernal' | 'luminous' | 'umbral' | 'celestial' | 'verdant';
export type BackdropKind = 'town' | 'hunt';

/** World px per art px. */
const P = 4;
/** Every layer's width in art px (style guide §8), and the sky's height. */
const W = 480;
const SKY_H = 160;

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

/** Each realm's colours, from the art bible's §5.2 (sky top → horizon). */
interface Palette {
  sky: readonly [string, string, string, string];
  far: string; farAccent: string;
  mid: readonly [string, string, string]; midAccent: string;
  near: readonly [string, string, string]; nearAccent: string; nearOutline: string;
}
const PALETTES: Readonly<Record<BackdropRealm, Palette>> = {
  infernal: {
    sky: ['#120a0c', '#2a1210', '#4a1c14', '#7a2e1a'],
    far: '#3a1c18', farAccent: '#c4501e',
    mid: ['#241a1c', '#3a2b2c', '#5a4440'], midAccent: '#E8752A',
    near: ['#171116', '#2a2027', '#443540'], nearAccent: '#c4501e', nearOutline: '#3a2430',
  },
  luminous: {
    sky: ['#3a2a3a', '#a8607a', '#f2a86a', '#ffe0a0'],
    far: '#c8907a', farAccent: '#fff1b0',
    mid: ['#8a7a58', '#a8946a', '#c9b88e'], midAccent: '#b8901e',
    near: ['#4a4030', '#6a5a40', '#8a7a58'], nearAccent: '#E8D44D', nearOutline: '#6a5a48',
  },
  umbral: {
    sky: ['#05040a', '#0e0a18', '#160f22', '#1e1630'],
    far: '#241a34', farAccent: '#7b4fc0',
    mid: ['#0e0912', '#1a1220', '#33263a'], midAccent: '#A855F7',
    near: ['#0e0912', '#1a1220', '#2a1f34'], nearAccent: '#4a3260', nearOutline: '#2e2440',
  },
  celestial: {
    sky: ['#03060f', '#0a1428', '#14284a', '#24406e'],
    far: '#2a4064', farAccent: '#8a6a3a',
    mid: ['#0a1428', '#14284a', '#24406e'], midAccent: '#5fb6ff',
    near: ['#050a18', '#0a1428', '#14284a'], nearAccent: '#8a6a3a', nearOutline: '#1e3050',
  },
  verdant: {
    sky: ['#0a1a14', '#14302a', '#2a5a40', '#4a7a3a'],
    far: '#2a5040', farAccent: '#7fd5a3',
    mid: ['#1e2a14', '#3a5a2a', '#4a7a3a'], midAccent: '#7fd5a3',
    near: ['#0a1a14', '#1e2a14', '#3a2a1c'], nearAccent: '#c08a3e', nearOutline: '#24301c',
  },
};

function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw `paint` at x and at x ± W, so a shape crossing an edge wraps (the layer tiles left to right). */
function wrap(c: Ctx, paint: () => void): void {
  for (const dx of [-W, 0, W]) { c.save(); c.translate(dx, 0); paint(); c.restore(); }
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color; wrap(c, () => c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)));
}
function disc(c: Ctx, x: number, y: number, r: number, color: string): void {
  c.fillStyle = color; wrap(c, () => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); });
}
function poly(c: Ctx, points: readonly (readonly [number, number])[], color: string): void {
  c.fillStyle = color;
  wrap(c, () => { c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); });
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Every opaque pixel with clear sky above it takes `lit` (the top-lit edge of a silhouette). */
function litTop(el: HTMLCanvasElement, lit: string, onlyOver?: string): void {
  const c = el.getContext('2d'), image = c?.getImageData(0, 0, el.width, el.height), d = image?.data;
  if (!c || !image || !d) return;
  const [r, g, b] = rgb(lit), only = onlyOver ? rgb(onlyOver) : null;
  const w = el.width;
  for (let y = 1; y < el.height; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, above = ((y - 1) * w + x) * 4;
    if (d[i + 3] < 128 || d[above + 3] >= 128) continue;
    if (only && (d[i] !== only[0] || d[i + 1] !== only[1] || d[i + 2] !== only[2])) continue;
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  c.putImageData(image, 0, 0);
}

/** A 1 px outline of `color` round everything on `el` (wraps in x, so the layer still tiles). */
function outline(el: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = canvas(el.width, el.height);
  const c = out.getContext('2d')!;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1 - el.width, 0], [el.width - 1, 0]]) c.drawImage(el, dx, dy);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color; c.fillRect(0, 0, out.width, out.height);
  c.globalCompositeOperation = 'source-over';
  c.drawImage(el, 0, 0);
  return out;
}

/** Crop a layer to the rows it paints (it is drawn with its bottom on the ground, so only the top is cut). */
function cropTop(el: HTMLCanvasElement): HTMLCanvasElement {
  const c = el.getContext('2d'), d = c?.getImageData(0, 0, el.width, el.height).data;
  if (!c || !d) return el;
  let top = 0;
  find: for (; top < el.height; top++) for (let x = 0; x < el.width; x++) if (d[(top * el.width + x) * 4 + 3]) break find;
  if (top <= 0 || top >= el.height) return el;
  const out = canvas(el.width, el.height - top);
  out.getContext('2d')!.drawImage(el, 0, -top);
  return out;
}

// ── Sky ──────────────────────────────────────────────────────────────────────

function sky(realm: BackdropRealm, r: Rng): HTMLCanvasElement {
  const el = canvas(W, SKY_H), c = el.getContext('2d')!;
  const bands = PALETTES[realm].sky;
  const edges = [0, 52, 92, 124, SKY_H];
  bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, edges[i], W, edges[i + 1] - edges[i]); });
  // One checker row where two bands meet (the only dithering the art bible allows).
  for (let i = 1; i < bands.length; i++) {
    c.fillStyle = bands[i];
    for (let x = 0; x < W; x += 2) c.fillRect(x + (i & 1), edges[i] - 1, 1, 1);
  }
  const star = (count: number, colors: readonly string[], maxY: number) => {
    for (let i = 0; i < count; i++) {
      c.fillStyle = colors[i % colors.length];
      const x = Math.floor(r() * W), y = Math.floor(r() * maxY);
      c.fillRect(x, y, 1, 1);
      if (i % 9 === 0) { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); }
    }
  };
  switch (realm) {
    case 'infernal':
      // The eclipse over the Seamworks: a dark disc in an ember ring.
      disc(c, 150, 40, 16, '#c4501e'); disc(c, 150, 40, 14, '#E8752A'); disc(c, 151, 39, 13, '#120a0c');
      for (let i = 0; i < 40; i++) { c.fillStyle = '#8a7468'; c.fillRect(Math.floor(r() * W), 60 + Math.floor(r() * 80), 1, 1); }
      break;
    case 'luminous':
      // A low dawn sun, lit from its own top-left.
      disc(c, 132, 112, 20, '#ffe7a0'); disc(c, 132, 112, 17, '#fff1b0'); disc(c, 128, 108, 9, '#fffaf0');
      break;
    case 'umbral':
      // A drift of faint violet across the dark (flat pixels, no gradient), stars, a fractured moon.
      for (let i = 0; i < 260; i++) {
        const t = r(), x = Math.floor(t * W), y = Math.floor(30 + t * 70 + (r() - .5) * 26);
        c.fillStyle = i % 4 ? '#1a1228' : '#2a1f3a'; c.fillRect(x, y, 2, 1);
      }
      star(130, ['#8a90b0', '#d8dcf0', '#4a3260'], 130);
      disc(c, 120, 36, 14, '#d8dcf0'); disc(c, 125, 32, 12, bands[0]);
      rect(c, 109, 40, 3, 1, '#8a90b0'); rect(c, 112, 41, 1, 3, '#8a90b0');
      break;
    case 'celestial':
      star(120, ['#d8ecff', '#a8b8cc', '#5fb6ff'], 130);
      break;
    case 'verdant':
      for (let i = 0; i < 50; i++) { c.fillStyle = i % 3 ? '#4a7a3a' : '#7fd5a3'; c.fillRect(Math.floor(r() * W), 70 + Math.floor(r() * 80), 1, 1); }
      break;
  }
  crisp(el);
  return el;
}

// ── Far: the landmark on the horizon (one tone and its accent, no outline) ──

function far(realm: BackdropRealm, kind: BackdropKind, r: Rng): HTMLCanvasElement {
  const H = 128, el = canvas(W, H), c = el.getContext('2d')!;
  const { far: tone, farAccent: accent } = PALETTES[realm];
  const ground = (lo: number, hi: number, step: number) => {
    const pts: [number, number][] = [[0, H]];
    for (let x = 0; x <= W; x += step) pts.push([x, H - lo - Math.round((Math.sin(x / W * Math.PI * 4) * .5 + .5) * (hi - lo))]);
    pts.push([W, H]);
    poly(c, pts, tone);
  };
  switch (realm) {
    case 'infernal': {
      // The Godforge ring, standing half-sunk on the horizon.
      c.strokeStyle = tone; c.lineWidth = 7;
      wrap(c, () => { c.beginPath(); c.arc(240, H + 40, 118, Math.PI, 0); c.stroke(); });
      for (let i = 0; i < 14; i++) {
        const x = r() * W, w = 4 + r() * 6, h = 22 + r() * 48;
        rect(c, x, H - h, w, h, tone);
        if (i % 3 === 0) rect(c, x + 1, H - h + 3, 1, 1, accent);
      }
      ground(6, 16, 24);
      break;
    }
    case 'luminous':
      ground(8, 22, 20);
      for (let i = 0; i < (kind === 'town' ? 7 : 4); i++) {
        const x = 20 + i * (W / 7) + r() * 20, h = 60 + r() * 52;
        rect(c, x, H - h, 4, h, tone);
        disc(c, x + 2, H - h - 4, 6, tone);
        rect(c, x, H - h - 6, 2, 2, accent);
      }
      break;
    case 'umbral':
      ground(6, 14, 30);
      for (let i = 0; i < (kind === 'town' ? 9 : 5); i++) {
        const x = r() * W, w = 10 + r() * 12, h = 48 + r() * 70;
        rect(c, x, H - h * .6, w, h * .6, tone);
        poly(c, [[x - 1, H - h * .6], [x + w / 2, H - h], [x + w + 1, H - h * .6]], tone);
        if (i % 2 === 0) rect(c, x + w / 2, H - h * .45, 1, 3, accent);
      }
      break;
    case 'celestial': {
      ground(4, 12, 32);
      // The Orrery: a pillar under three armillary rings.
      rect(c, 235, H - 88, 10, 88, tone);
      c.strokeStyle = tone; c.lineWidth = 3;
      wrap(c, () => {
        for (const [rx, ry] of [[62, 18], [44, 32], [26, 40]]) { c.beginPath(); c.ellipse(240, H - 96, rx, ry, -.35, 0, Math.PI * 2); c.stroke(); }
      });
      disc(c, 240, H - 96, 7, accent);
      for (let i = 0; i < 4; i++) disc(c, 60 + i * 110 + r() * 30, H - 6, 14 + r() * 10, tone);
      break;
    }
    case 'verdant':
      for (let i = 0; i < (kind === 'town' ? 6 : 8); i++) {
        const x = r() * W, h = 54 + r() * 44, w = 7 + r() * 5;
        rect(c, x, H - h, w, h, tone);
        disc(c, x + w / 2, H - h, 20 + r() * 12, tone);
        disc(c, x + w / 2 - 16, H - h + 10, 13 + r() * 7, tone);
        disc(c, x + w / 2 + 16, H - h + 8, 13 + r() * 7, tone);
        if (i % 2 === 0) rect(c, x + w / 2 + 6, H - h - 4, 1, 1, accent);
      }
      ground(6, 14, 24);
      break;
  }
  crisp(el);
  return cropTop(el);
}

// ── Mid: roofs, terraces, domes, hills (three tones, lit along the top) ─────

function mid(realm: BackdropRealm, kind: BackdropKind, r: Rng): HTMLCanvasElement {
  const H = 88, el = canvas(W, H), c = el.getContext('2d')!;
  const { mid: [dark, base, lit], midAccent: accent } = PALETTES[realm];
  const hills = (lo: number, hi: number, color: string, phase: number) => {
    const pts: [number, number][] = [[0, H]];
    for (let x = 0; x <= W; x += 8) pts.push([x, H - lo - Math.round((Math.sin(x / W * Math.PI * 6 + phase) * .5 + .5) * (hi - lo))]);
    pts.push([W, H]);
    poly(c, pts, color);
  };
  if (kind === 'hunt') {
    // The wild ground: ridges and rock, with the realm's light caught in seams.
    hills(14, 40, base, r() * 6);
    hills(6, 22, dark, r() * 6);
    for (let i = 0; i < 18; i++) rect(c, r() * W, H - 6 - r() * 26, 1 + Math.round(r()), 1, accent);
  } else {
    switch (realm) {
      case 'infernal':
        for (let x = 0; x < W;) {
          const w = 22 + r() * 30, h = 22 + r() * 34;
          rect(c, x, H - h, w, h, base);
          // Sawtooth roof.
          for (let k = 0; k < w - 6; k += 8) poly(c, [[x + k, H - h], [x + k + 8, H - h - 5], [x + k + 8, H - h]], base);
          if (r() < .6) rect(c, x + w * .7, H - h - 16, 4, 16, dark);
          for (let k = 4; k < w - 4; k += 7) if (r() < .45) rect(c, x + k, H - h + 6 + Math.floor(r() * (h - 12)), 2, 2, accent);
          x += w + 2 + r() * 10;
        }
        break;
      case 'luminous':
        for (let x = 0; x < W;) {
          const w = 34 + r() * 30, h = 24 + r() * 32;
          rect(c, x, H - h, w, h, base);
          rect(c, x + 3, H - h + 3, w - 6, 1, accent);
          for (let k = 6; k < w - 10; k += 12) { rect(c, x + k, H - h + 8, 6, h - 8, dark); disc(c, x + k + 3, H - h + 8, 3, dark); }
          x += w + 4 + r() * 12;
        }
        break;
      case 'umbral':
        for (let x = 0; x < W;) {
          const w = 18 + r() * 16, h = 30 + r() * 40;
          rect(c, x, H - h, w, h, base);
          poly(c, [[x - 2, H - h], [x + w / 2, H - h - 10], [x + w + 2, H - h]], dark);
          for (let k = 4; k < h - 6; k += 6) if (r() < .5) rect(c, x + 3 + Math.floor(r() * (w - 6)), H - h + k, 1, 3, accent);
          x += w + 3 + r() * 14;
        }
        break;
      case 'celestial':
        for (let x = 0; x < W;) {
          const w = 28 + r() * 24, h = 12 + r() * 14;
          rect(c, x, H - h, w, h, base);
          disc(c, x + w / 2, H - h, w * .36, base);
          rect(c, x + w / 2, H - h - w * .36 - 6, 1, 6, dark);
          rect(c, x + w / 2 - 1, H - h - 2, 2, 2, accent);
          x += w + 6 + r() * 16;
        }
        break;
      case 'verdant':
        hills(10, 34, base, r() * 6);
        for (let i = 0; i < 6; i++) {
          const x = r() * W, w = 20 + r() * 16, h = 20 + r() * 12;
          c.strokeStyle = dark; c.lineWidth = 3;
          wrap(c, () => { c.beginPath(); c.arc(x, H, w, Math.PI, 0); c.stroke(); });
          rect(c, x - 1, H - h, 1, 1, accent);
        }
        for (let i = 0; i < 16; i++) rect(c, r() * W, H - 4 - r() * 18, 1, 1, accent);
        break;
    }
  }
  crisp(el);
  litTop(el, lit, base);
  return cropTop(el);
}

// ── Near: a few big shapes behind the walk lane, outlined lighter than any figure ──

function near(realm: BackdropRealm, kind: BackdropKind, r: Rng): HTMLCanvasElement {
  const H = 64, el = canvas(W, H), c = el.getContext('2d')!;
  const { near: [dark, base, lit], nearAccent: accent, nearOutline } = PALETTES[realm];
  // The low, dark rows: nothing here may read as somewhere to stand.
  const lowPts: [number, number][] = [[0, H]];
  for (let x = 0; x <= W; x += 6) lowPts.push([x, H - 4 - Math.round(r() * 5)]);
  lowPts.push([W, H]);
  poly(c, lowPts, dark);
  const spots = kind === 'town' ? 3 : 4;
  for (let i = 0; i < spots; i++) {
    const x = (i + .5) * (W / spots) + (r() - .5) * 60;
    switch (realm) {
      case 'infernal': {
        const h = 40 + r() * 18;
        rect(c, x, H - h, 12, h, base);
        rect(c, x - 2, H - h, 16, 3, lit);
        rect(c, x + 2, H - h + 10, 2, h - 14, dark);
        rect(c, x + 4, H - h + 6, 4, 2, accent);
        break;
      }
      case 'luminous': {
        const h = 44 + r() * 14;
        rect(c, x, H - h + 4, 10, h - 4, base);
        rect(c, x - 3, H - h, 16, 4, lit);
        rect(c, x + 7, H - h + 6, 2, h - 8, dark);
        rect(c, x - 3, H - h + 4, 16, 1, accent);
        break;
      }
      case 'umbral': {
        // A broken gothic arch.
        c.strokeStyle = base; c.lineWidth = 6;
        wrap(c, () => { c.beginPath(); c.moveTo(x, H); c.lineTo(x, H - 30); c.quadraticCurveTo(x + 18, H - 62, x + 36, H - 30); c.lineTo(x + 36, H - 20); c.stroke(); });
        rect(c, x - 3, H - 32, 6, 2, lit);
        rect(c, x + 16, H - 52, 2, 2, accent);
        break;
      }
      case 'celestial': {
        const h = 42 + r() * 16;
        rect(c, x, H - h, 6, h, base);
        c.strokeStyle = accent; c.lineWidth = 2;
        wrap(c, () => { c.beginPath(); c.moveTo(x + 3, H - h); c.lineTo(x + 30, H - h + 18); c.stroke(); });
        disc(c, x + 3, H - h, 4, lit);
        break;
      }
      case 'verdant': {
        // A great root arching out of the ground.
        c.strokeStyle = base; c.lineWidth = 7;
        wrap(c, () => { c.beginPath(); c.moveTo(x - 20, H); c.quadraticCurveTo(x, H - 70, x + 34, H - 4); c.stroke(); });
        rect(c, x - 2, H - 40, 2, 2, accent);
        break;
      }
    }
  }
  crisp(el);
  litTop(el, lit);
  return cropTop(outline(el, nearOutline));
}

interface Layers { readonly sky: HTMLCanvasElement; readonly layers: readonly { el: HTMLCanvasElement; speed: number }[] }

/** Build a place's four layers (browser only). Deterministic per realm and kind. */
export function buildParallax(realm: BackdropRealm, kind: BackdropKind): Layers {
  const seed = [...`${realm}:${kind}`].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
  const r = rng(seed);
  return {
    sky: sky(realm, r),
    layers: [
      { el: far(realm, kind, r), speed: PARALLAX_SPEED.far },
      { el: mid(realm, kind, r), speed: PARALLAX_SPEED.mid },
      { el: near(realm, kind, r), speed: PARALLAX_SPEED.near },
    ],
  };
}

const canPaint = typeof document !== 'undefined' && typeof document.createElement === 'function';

/** The engine's procedural backdrop: built on first sight, the two most recent places kept. */
export class PixelParallax {
  private readonly built = new Map<string, Layers>();

  /** Draw in view world px (no camera translate). False without a DOM (the caller keeps its painting). */
  draw(c: Ctx, realm: BackdropRealm, kind: BackdropKind, camera: number, viewport: number, groundY: number): boolean {
    if (!canPaint || !(realm in PALETTES)) return false;
    const key = `${realm}:${kind}`;
    let set = this.built.get(key);
    if (!set) {
      set = buildParallax(realm, kind);
      this.built.set(key, set);
      if (this.built.size > 2) this.built.delete(this.built.keys().next().value!);
    }
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    const sw = set.sky.width * P, sh = set.sky.height * P;
    // The sky fills down to the ground and above the top of the view.
    c.fillStyle = PALETTES[realm].sky[0]; c.fillRect(0, 0, viewport, Math.max(0, groundY - sh));
    for (let x = parallaxOffset(camera, PARALLAX_SPEED.sky, sw); x < viewport; x += sw) c.drawImage(set.sky, x, groundY - sh, sw, sh);
    for (const { el, speed } of set.layers) {
      const w = el.width * P, h = el.height * P;
      for (let x = parallaxOffset(camera, speed, w); x < viewport; x += w) c.drawImage(el, x, groundY - h, w, h);
    }
    c.imageSmoothingEnabled = smoothing;
    return true;
  }
}
