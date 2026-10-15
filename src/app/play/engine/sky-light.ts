/**
 * sky-light.ts — day, night and the eclipse on the pixel backdrops
 * (shared/world-clock; docs/handoff/world-clock.md).
 *
 * The host reads the world clock about once a second and hands the engine a
 * `Sky` (world-clock.model skyAt). This module turns it into a few cached
 * numbers and colour strings — only when the sky actually changes, so a frame
 * allocates nothing — and draws, per frame:
 *
 *  - `drawSky`: over the backdrop (the sky and the far scenery), under the
 *    world: a tint per realm and phase (dawn gold, dusk ember, night blue,
 *    eclipse violet), pixel stars at night, the moon mirror (fractured) at
 *    night, and in an eclipse the dark disc with the moon mirror's flare.
 *    In the Delve only the strip of sky above the surface gets it: underground
 *    the world is the same at every hour.
 *  - `drawShade`: over the world, under Glim and the bursts: a cheap night
 *    overlay (one fillRect), so the people and the stalls sit in the dark too.
 *  - `drawLamp`: a warm lantern/window glow (a cached disc) where the host
 *    asks: every stall in view, and the Keeper's own lantern.
 *
 * Phone budget: one fillRect per pass, sprites baked once (the moon, the
 * eclipse disc, the glow), no gradients built per frame, no allocation. The
 * lite tier draws lamps with plain alpha (no 'lighter' blend).
 */
import type { Sky } from '../../shared/world-clock/world-clock.model';

/** The sky the engine draws, plus the realm the current eclipse is aligned with (its hunting ground's glass doubles). */
export interface EngineSky extends Sky {
  /** The aligned realm's hunting-ground area id while an eclipse is on, else null. */
  alignedHunt: string | null;
}

export const DAY_SKY: EngineSky = { phase: 'day', light: 1, glow: 0, eclipse: 0, night: false, eclipseOn: false, dark: false, alignedHunt: null };

const canPaint = typeof document !== 'undefined' && typeof document.createElement === 'function';
/** World px per art px (the figures' grid). */
const GRID = 4;

type Rgb = readonly [number, number, number];
/** Night tint per realm (from the art bible's night ramps): Infernal keeps an ember warmth, Celestial goes deepest blue. */
const NIGHT: Readonly<Record<string, Rgb>> = {
  infernal: [26, 12, 30], luminous: [18, 20, 52], umbral: [12, 8, 30], celestial: [8, 16, 48], verdant: [8, 22, 34],
};
const DUSK: Rgb = [232, 117, 42];
const DAWN: Rgb = [255, 196, 120];
const ECLIPSE: Rgb = [26, 10, 46];

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function rgba(c: Rgb, a: number): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
}
function hash01(i: number, salt: number): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export class SkyLight {
  private current: EngineSky = DAY_SKY;
  private realm = 'infernal';
  /** The last (sky, realm) the strings were built for. */
  private key = '';
  private skyFill = 'rgba(0,0,0,0)';
  private skyAlpha = 0;
  private shadeFill = 'rgba(0,0,0,0)';
  private shadeAlpha = 0;
  /** 0..1: how lit the lamps are. */
  private lamps = 0;
  /** 0..1: how many stars show. */
  private stars = 0;
  private moon: HTMLCanvasElement | null = null;
  private disc: HTMLCanvasElement | null = null;
  private glow: HTMLCanvasElement | null = null;

  get sky(): EngineSky { return this.current; }
  /** Lamps are worth drawing (dusk, night, an eclipse). */
  get lit(): boolean { return this.lamps > .02; }
  get shaded(): boolean { return this.shadeAlpha > .01; }

  /**
   * The host's sky for a realm. Rebuilds the colour strings only when the light
   * moved by a visible step (1/64) or the phase or the realm changed.
   */
  set(sky: EngineSky, realm: string): void {
    this.current = sky;
    const q = (v: number) => Math.round(v * 64);
    const key = `${sky.phase}|${realm}|${q(sky.light)}|${q(sky.glow)}|${q(sky.eclipse)}`;
    if (key === this.key) return;
    this.key = key; this.realm = realm;
    const dark = 1 - sky.light;
    const night = NIGHT[realm] ?? NIGHT['infernal'];
    // The sky: night blue as it darkens, the low sun's gold or ember on top, the eclipse's violet when it bites.
    let tint: Rgb = night;
    let alpha = .66 * dark;
    if (sky.glow > 0) {
      const warm = sky.phase === 'dawn' ? DAWN : DUSK;
      tint = mix(night, warm, Math.min(1, sky.glow * (1 - dark * .4)));
      alpha = Math.max(alpha, .3 * sky.glow);
    }
    if (sky.eclipse > 0) {
      tint = mix(tint, ECLIPSE, sky.eclipse);
      alpha = Math.max(alpha, .72 * sky.eclipse);
    }
    this.skyAlpha = alpha;
    this.skyFill = rgba(tint, alpha);
    // The world itself sits in a lighter shade of the same dark: figures stay readable.
    this.shadeAlpha = Math.min(.42, .4 * dark + .1 * sky.eclipse);
    this.shadeFill = rgba(sky.eclipse > 0 ? mix(night, ECLIPSE, sky.eclipse) : night, this.shadeAlpha);
    this.lamps = Math.min(1, dark * 1.25);
    this.stars = Math.max(0, Math.min(1, (dark - .35) / .5));
  }

  /**
   * Over the backdrop, under the world, in screen space (scaled view px):
   * the tint, then the stars and the moon or the eclipse. `height` limits it to
   * the sky above a Delve's surface (720 in the towns).
   */
  drawSky(c: CanvasRenderingContext2D, viewport: number, height: number, time: number, reduced: boolean): void {
    if (height <= 0) return;
    const sky = this.current;
    if (this.skyAlpha > .005) { c.fillStyle = this.skyFill; c.fillRect(0, 0, viewport, height); }
    if (this.stars > 0) {
      c.fillStyle = '#e8ecff';
      const top = Math.min(height, 380);
      for (let i = 0; i < 36; i++) {
        const y = Math.floor(hash01(i, 2) * top / GRID) * GRID;
        if (y >= height) continue;
        const x = Math.floor(hash01(i, 1) * viewport / GRID) * GRID;
        const tw = reduced ? .7 : .45 + .55 * Math.abs(Math.sin(time * (.6 + hash01(i, 3)) + i));
        c.globalAlpha = this.stars * tw * (i % 5 === 0 ? 1 : .6);
        c.fillRect(x, y, GRID, GRID);
      }
      c.globalAlpha = 1;
    }
    if (!canPaint) return;
    const prev = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    if (sky.eclipse > 0) {
      // The eclipse: the moon mirror in front of the sun, its flare breathing round the rim.
      const disc = this.disc ??= paintEclipse();
      const size = 34 * GRID, x = Math.round(viewport * .6 - size / 2), y = 54;
      if (y < height) {
        c.globalAlpha = Math.min(1, sky.eclipse * 1.2);
        c.drawImage(disc, x, y, size, size);
        // The flare: the corona sprite again, drawn a hair larger and pulsing (no motion: held).
        c.globalAlpha = sky.eclipse * (reduced ? .35 : .25 + .2 * Math.sin(time * 1.7));
        const grow = reduced ? GRID * 2 : GRID * (2 + Math.round(Math.sin(time * 1.7) + 1));
        c.drawImage(disc, x - grow, y - grow, size + grow * 2, size + grow * 2);
        c.globalAlpha = 1;
      }
    } else if (this.stars > 0) {
      // The moon mirror, cracked where it broke.
      const moon = this.moon ??= paintMoon();
      const size = 20 * GRID, x = Math.round(viewport * .62 - size / 2), y = 70;
      if (y < height) { c.globalAlpha = this.stars; c.drawImage(moon, x, y, size, size); c.globalAlpha = 1; }
    }
    c.imageSmoothingEnabled = prev;
  }

  /** Over the world (world coords: camera-relative rect), under Glim: the night on the people and the stalls. */
  drawShade(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.shadeAlpha <= .01) return;
    c.fillStyle = this.shadeFill;
    c.fillRect(x, y, w, h);
  }

  /** A lantern or a lit window at (x, y), radius `r` world px. `blend`: 'lighter' (full tier) or plain alpha. */
  drawLamp(c: CanvasRenderingContext2D, x: number, y: number, r: number, blend: boolean, strength = 1): void {
    if (!canPaint || this.lamps <= .02) return;
    const glow = this.glow ??= paintGlow();
    const prevOp = c.globalCompositeOperation;
    if (blend) c.globalCompositeOperation = 'lighter';
    c.globalAlpha = this.lamps * strength * (blend ? .55 : .35);
    c.drawImage(glow, x - r, y - r, r * 2, r * 2);
    c.globalAlpha = 1;
    c.globalCompositeOperation = prevOp;
  }
}

// ── Baked sprites (once each) ───────────────────────────────────────────────

function sprite(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  return [el, el.getContext('2d')!];
}

/** A pixel disc (art px), lit from the upper left: the moon mirror, a crack across it. 20 × 20. */
function paintMoon(): HTMLCanvasElement {
  const [el, c] = sprite(20, 20);
  const r = 8.5, cx = 10, cy = 10;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const d = Math.hypot(x + .5 - cx, y + .5 - cy);
    if (d > r + .6) continue;
    const edge = d > r - .4;
    const lit = (x - cx) + (y - cy) < -3;
    c.fillStyle = edge ? '#33263a' : lit ? '#f4f4ff' : '#d8dcf0';
    c.fillRect(x, y, 1, 1);
  }
  // The crack where it broke (the Archive's moon mirror is never whole).
  c.fillStyle = '#8a90b0';
  for (const [x, y] of [[6, 4], [7, 5], [8, 6], [8, 7], [9, 8], [10, 9], [11, 9], [12, 10], [12, 11], [13, 12], [14, 13]]) c.fillRect(x, y, 1, 1);
  c.fillStyle = '#ffffff'; c.fillRect(5, 6, 2, 1); c.fillRect(5, 7, 1, 1);
  return el;
}

/** The eclipse: a black disc in a gold-white corona with four flare spikes. 34 × 34 art px. */
function paintEclipse(): HTMLCanvasElement {
  const [el, c] = sprite(34, 34);
  const cx = 17, cy = 17;
  for (let y = 0; y < 34; y++) for (let x = 0; x < 34; x++) {
    const d = Math.hypot(x + .5 - cx, y + .5 - cy);
    let col: string | null = null;
    if (d <= 8.6) col = d > 7.8 ? '#33263a' : '#0e0912';
    else if (d <= 9.6) col = '#fff4dc';
    else if (d <= 11) col = '#E8D44D';
    else if (d <= 12.4 && (x + y) % 2 === 0) col = '#b8901e';
    if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
  }
  // The flare's spikes: the moon mirror throwing the sun back four ways.
  c.fillStyle = '#E8D44D';
  for (let k = 12; k < 17; k++) { c.fillRect(cx, cy - k - 1, 1, 1); c.fillRect(cx, cy + k, 1, 1); c.fillRect(cx - k - 1, cy, 1, 1); c.fillRect(cx + k, cy, 1, 1); }
  c.fillStyle = '#fff4dc';
  c.fillRect(cx, cy - 13, 1, 2); c.fillRect(cx, cy + 11, 1, 2); c.fillRect(cx - 13, cy, 2, 1); c.fillRect(cx + 11, cy, 2, 1);
  return el;
}

/** A warm lantern glow: a soft disc, baked once (the only gradient in this module). */
function paintGlow(): HTMLCanvasElement {
  const [el, c] = sprite(64, 64);
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,214,140,1)');
  g.addColorStop(.35, 'rgba(255,170,90,.55)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return el;
}
