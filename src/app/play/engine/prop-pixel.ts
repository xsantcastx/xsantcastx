/**
 * prop-pixel.ts — the town and hunting-ground props as pixel sprites (one art
 * style, 2026-10-14): market stalls, the waystone, passage arches, the beacon,
 * the quest pedestal, gathering nodes (tree, outcrop, herb patch) and the coin
 * drop.
 *
 * They were canvas vectors (arcs, curves, strokes, an elliptical coin) standing
 * beside a pixel Keeper and pixel ground. Now each is a small art-pixel sprite on
 * the figures' grid (4 world px per art px), painted once, outlined with the
 * figures' one outline (keeper-paint.ts), cached by its shape, and laid down as
 * one unsmoothed blit. Shapes that are easiest to say as a path (the awning's
 * scallops, the arch, a canopy) are filled into the sprite and then snapped to
 * whole pixels (`crisp`), so no soft edge survives.
 *
 * Colours are the ones these props already used (and the art bible's ramps).
 * The station's own icon on the plaque and the material over a node are still
 * the painted icons (item art is its own pass: docs/handoff/one-art-style.md).
 *
 * Browser only (canvas).
 */
import { canvas, outlined, px } from '../../shared/keeper-look/keeper-paint';

/** World px per art px (the figures' grid in the towns and hunts). */
export const PROP_PIXEL = 4;

type Ctx = CanvasRenderingContext2D;

/** Snap every pixel to fully on or fully off (a path's anti-aliased rim → a pixel edge). */
function crisp(el: HTMLCanvasElement): HTMLCanvasElement {
  const c = el.getContext('2d');
  const image = c?.getImageData(0, 0, el.width, el.height);
  const d = image?.data;
  if (!c || !image || !d) return el; // a stand-in canvas (tests) has no pixels to snap
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
  c.putImageData(image, 0, 0);
  return el;
}

/** A sprite of `w`×`h` art px with a 1 px margin for its outline. `paint` draws at (0, 0) = its top-left. */
function sprite(w: number, h: number, paint: (c: Ctx) => void, outline = true): HTMLCanvasElement {
  const raw = canvas(w + 2, h + 2);
  const c = raw.getContext('2d')!;
  c.translate(1, 1);
  paint(c);
  crisp(raw);
  return outline ? outlined(raw) : raw;
}

function disc(c: Ctx, x: number, y: number, r: number, color: string): void {
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}

/** The cached prop sprites for one engine (they never change per frame). */
export class PropPainter {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  /** Blit a cached sprite bottom-centred at (x, floor). */
  private put(c: Ctx, el: HTMLCanvasElement, x: number, floor: number): void {
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    const w = el.width * PROP_PIXEL, h = el.height * PROP_PIXEL;
    // The outline row under the base sits on the floor line.
    c.drawImage(el, Math.round(x - w / 2), floor - h + PROP_PIXEL, w, h);
    c.imageSmoothingEnabled = smoothing;
  }
  private get(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
    let el = this.cache.get(key);
    if (!el) { el = make(); this.cache.set(key, el); }
    return el;
  }

  /** A timber market stall: posts, a striped awning with a scalloped edge, a back wall, the plaque ring, a counter. */
  stall(c: Ctx, x: number, floor: number, width: number, hot: boolean): void {
    const W = Math.max(24, Math.round(width / PROP_PIXEL)), H = 48;
    const el = this.get(`stall:${W}:${hot ? 1 : 0}`, () => sprite(W, H, s => {
      const p = (x0: number, y0: number, w: number, h: number, col: string) => px(s, x0, y0, w, h, col);
      p(1, 3, 2, H - 3, '#4b332c'); p(W - 3, 3, 2, H - 3, '#4b332c'); p(1, 3, 1, H - 3, '#6a4a3c');
      p(3, 11, W - 6, 22, '#2a1d22');
      const stripes = 6, stripe = W / stripes;
      for (let i = 0; i < stripes; i++) {
        const col = i % 2 ? '#c2a26a' : '#8d3f36';
        s.fillStyle = col; s.fillRect(Math.round(i * stripe), 1, Math.round((i + 1) * stripe) - Math.round(i * stripe), 6);
        s.beginPath(); s.arc((i + .5) * stripe, 7, stripe / 2, 0, Math.PI); s.fill();
      }
      p(0, 0, W, 1, '#e1c29a');
      p(0, 32, W, 2, '#a67858'); p(1, 32, W - 2, 1, '#f6a668'); p(1, 34, W - 2, H - 34, '#4a3238'); p(1, 34, W - 2, 1, '#2a1d22');
      for (let k = 6; k < W - 4; k += 8) p(k, 36, 1, H - 38, '#3a2630');
      // The plaque: a dark disc in a brass (or lit) ring; the station's icon sits on it.
      disc(s, W / 2, 21, 9, hot ? '#ffe0a8' : '#a68456'); disc(s, W / 2, 21, 8, '#1d1418');
    }));
    this.put(c, el, x, floor);
  }

  /** A standing waystone: a tapered stone, lit on its west edge, a rift-crack of violet up its face. */
  waystone(c: Ctx, x: number, floor: number, hot: boolean): void {
    const el = this.get(`waystone:${hot ? 1 : 0}`, () => sprite(13, 47, s => {
      s.fillStyle = '#3d3446'; s.beginPath(); s.moveTo(0, 47); s.lineTo(3, 4); s.lineTo(6.5, 0); s.lineTo(10, 4); s.lineTo(13, 47); s.closePath(); s.fill();
      s.fillStyle = hot ? '#ffe0a8' : '#7d6a86'; s.beginPath(); s.moveTo(1, 47); s.lineTo(3.5, 4); s.lineTo(5, 3); s.lineTo(3, 47); s.closePath(); s.fill();
      px(s, 10, 8, 1, 39, '#2a2236');
      for (const [cx, cy] of [[5, 37], [6, 34], [7, 31], [6, 28], [5, 25], [6, 22], [7, 19], [6, 16]] as const) px(s, cx, cy, 1, 3, '#c9a0ff');
    }));
    this.put(c, el, x, floor);
  }

  /** A passage arch, open or dark. */
  arch(c: Ctx, x: number, floor: number, open: boolean): void {
    const el = this.get(`arch:${open ? 1 : 0}`, () => sprite(28, 33, s => {
      const col = open ? '#99e3cb' : '#574658', hi = open ? '#d0f6ff' : '#7d6a86';
      s.fillStyle = col; s.beginPath(); s.arc(14, 15, 14, Math.PI, 0); s.lineTo(28, 33); s.lineTo(25, 33); s.lineTo(25, 15);
      s.arc(14, 15, 11, 0, Math.PI, true); s.lineTo(3, 33); s.lineTo(0, 33); s.closePath(); s.fill();
      px(s, 0, 15, 1, 18, hi); px(s, 4, 3, 3, 1, hi); px(s, 2, 5, 2, 1, hi);
    }));
    this.put(c, el, x, floor);
  }

  /** The Seamworks beacon: an iron pillar under a lamp (lit once restored; the engine adds the halo). */
  beacon(c: Ctx, x: number, floor: number, lit: boolean): void {
    const el = this.get(`beacon:${lit ? 1 : 0}`, () => sprite(12, 50, s => {
      px(s, 1, 10, 10, 40, '#423f51'); px(s, 1, 10, 2, 40, '#5c5359'); px(s, 9, 10, 2, 40, '#2a2530');
      px(s, 0, 9, 12, 2, '#2a2530'); px(s, 0, 48, 12, 2, '#2a2530');
      disc(s, 6, 5, 5, lit ? '#d5fffa' : '#b96d55'); px(s, 4, 2, 2, 2, lit ? '#ffffff' : '#e0a080');
    }));
    this.put(c, el, x, floor);
  }

  /** A quest pedestal: a low plinth with an ember band (its item floats above it). */
  pedestal(c: Ctx, x: number, floor: number): void {
    const el = this.get('pedestal', () => sprite(23, 15, s => {
      px(s, 0, 0, 23, 15, '#493543'); px(s, 0, 0, 23, 1, '#6a5060'); px(s, 0, 0, 1, 15, '#6a5060'); px(s, 22, 1, 1, 14, '#2a1d22');
      px(s, 3, 2, 17, 2, '#ffaf62');
    }));
    this.put(c, el, x, floor);
  }

  /** A gathering tree: trunk and a lumpy canopy, or the cut stump. */
  tree(c: Ctx, x: number, floor: number, ready: boolean): void {
    const el = this.get(`tree:${ready ? 1 : 0}`, () => ready ? sprite(28, 50, s => {
      px(s, 11, 22, 6, 28, '#4a3324'); px(s, 11, 22, 1, 28, '#7a5a36'); px(s, 15, 26, 1, 22, '#3a2618');
      disc(s, 14, 13, 12, '#2f4a2c'); disc(s, 9, 10, 7, '#4c6e3a'); disc(s, 19, 14, 6, '#4c6e3a');
      disc(s, 8, 8, 3, '#5f8a46'); disc(s, 17, 11, 2, '#5f8a46');
    }) : sprite(8, 9, s => {
      px(s, 1, 1, 6, 8, '#4a3324'); px(s, 1, 1, 1, 8, '#7a5a36'); px(s, 1, 0, 6, 2, '#c9a06a'); px(s, 3, 0, 2, 1, '#e8c47a');
    }));
    this.put(c, el, x, floor);
  }

  /** A rock outcrop with ore glinting in it (`glow` = the material's colour), or its worked-down stub. */
  outcrop(c: Ctx, x: number, floor: number, ready: boolean, glow: string): void {
    const el = this.get(`ore:${ready ? 1 : 0}:${glow}`, () => {
      const h = ready ? 16 : 6;
      return sprite(20, h, s => {
        s.fillStyle = '#3f3440'; s.beginPath(); s.moveTo(0, h); s.lineTo(2.5, h * .23); s.lineTo(9, 0); s.lineTo(16.5, h * .3); s.lineTo(20, h); s.closePath(); s.fill();
        s.fillStyle = '#6b5a6e'; s.beginPath(); s.moveTo(1, h); s.lineTo(3, h * .26); s.lineTo(9, 1); s.lineTo(9, 3); s.lineTo(4.5, h * .4); s.lineTo(3, h); s.closePath(); s.fill();
        if (ready) for (const [nx, ny] of [[5, 9], [11, 4], [15, 10], [9, 12]] as const) { px(s, nx, ny, 2, 2, glow); px(s, nx, ny, 1, 1, '#ffffff'); }
      });
    });
    this.put(c, el, x, floor);
  }

  /** A herb patch: seven stems with bulbs in the herb's colour, or cropped stubs. */
  herbs(c: Ctx, x: number, floor: number, ready: boolean, glow: string): void {
    const el = this.get(`herb:${ready ? 1 : 0}:${glow}`, () => {
      const h = ready ? 13 : 3;
      return sprite(20, h, s => {
        const stem = ready ? '#5f8a46' : '#5a4a36';
        for (let i = -3; i <= 3; i++) {
          const tall = ready ? 8 + (i & 1) * 3 : 2, bx = 10 + i * 1.5;
          for (let r = 0; r < tall; r++) px(s, Math.round(bx + i * r / tall * 1.2), h - 1 - r, 1, 1, r > tall - 3 && ready ? '#7fb85a' : stem);
        }
        if (ready) for (const i of [-2, 0, 2]) px(s, Math.round(10 + i * 2.7) - 1, h - 11 - (i === 0 ? 1 : 0), 2, 2, glow);
      });
    });
    this.put(c, el, x, floor);
  }

  /** A gold coin turning: four frames, face → edge → face (`frame` 0..3). Centred on (x, y). */
  coin(c: Ctx, x: number, y: number, frame: number): void {
    const f = ((frame % 4) + 4) % 4;
    const el = this.get(`coin:${f}`, () => {
      const w = [7, 5, 2, 5][f];
      return sprite(w, 7, s => {
        px(s, 0, 1, w, 5, '#9e602c'); px(s, w > 2 ? 1 : 0, 0, Math.max(1, w - 2), 7, '#9e602c');
        if (w > 2) { px(s, 1, 1, w - 2, 5, '#ffd36d'); px(s, 1, 1, 1, 2, '#fff1c9'); if (w >= 7) px(s, 3, 2, 1, 3, '#9e602c'); }
        else px(s, 0, 1, 1, 5, '#ffd36d');
      });
    });
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    const S = PROP_PIXEL, w = el.width * S, h = el.height * S;
    c.drawImage(el, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
    c.imageSmoothingEnabled = smoothing;
  }
}

