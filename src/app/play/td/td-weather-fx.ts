/**
 * td-weather-fx.ts — Weather v1 on the top-down canvas (shared/weather/weather.model.ts; world-acts §3.4).
 *
 *   Rain        diagonal 1 × 3 art-px streaks in two depths (40 near + 60 far; half on a phone; 16 far ones on Low),
 *               2 × 1 splash ticks (Normal only), and puddles on road and flagstone that linger 60 s after the rain.
 *   Thunderstorm  the rain, the day dimmed more, and a flash now and then: never above 25% white, never two within 3 s,
 *               none at all under reduced motion or "soft" (the tint stays).
 *   Fog         the engine's own fog bank (drawFog) thickened; on Low a flat grey wash instead of the noise layer.
 *   Overcast    the day a little darker.
 *   S8          a storm's strikes: a 1.2 s ring on the ground (the tell), then a stepped bolt, a scorch that fades in
 *               20 s, and the flash (near: 25%, off-screen: 8%; the same limits). Ashfall: grey flakes drifting down-left
 *               and a grey film; Spore drift: pale motes rising and a green tint; Mist-rain: half the rain, finer, and the
 *               fog thicker. Under reduced motion or Soft: the tints and the ring only (no particles, no bolt, no flash).
 *
 * Everything is cheap on purpose: a fixed pool of streaks drawn as fillRects in screen space, puddles found once per
 * chunk and cached, no per-frame allocation. The phone profile (e2e/td-perf-phone, CPU ×6, DPR 3) must hold 60 fps on
 * Low with rain falling.
 */
import { STRIKE, dayDim, isWet, wetStrength, type WeatherNow, type WeatherShow } from '../../shared/weather/weather.model';

const TILE = 16;
const CHUNK = 16;
const NEAR = 40, FAR = 60, LOW_FAR = 16;
/** Puddles fill over 30 s of rain and dry 60 s after it stops. */
const FILL_SECS = 30, DRY_SECS = 60;
/** The flash: at most this white, at most one in this many seconds. */
export const FLASH_MAX = .25;
export const FLASH_GAP = 3;

export type Ground = string;
/** Where the storm may strike now (the engine's open ground round the Keeper), and whether a point is on screen. */
export interface StrikeGround { pick(rnd: () => number): { x: number; y: number } | null; onScreen(x: number, y: number): boolean }
/** A strike's tell on the ground, and what it left: `t` seconds in (the tell lasts STRIKE.tell). */
export interface StrikeMark { x: number; y: number; t: number; seed: number }
/** What the storm did this frame, for the engine: a tell began, a strike landed (near, on screen, or far). */
export type StormNews = { kind: 'tell'; x: number; y: number } | { kind: 'strike'; x: number; y: number; near: boolean } | { kind: 'far' };
/** The land specials' motes on screen (Normal; a phone has fewer, Low fewer still). */
const MOTES = 20, MOTES_PHONE = 12, MOTES_LOW = 8;

export class WeatherFx {
  now: WeatherNow = { state: 'clear', level: 0, window: 0, next: 'clear', leftMs: 0 };
  show: WeatherShow = 'full';
  /** 0..1: how full the puddles are. */
  wetness = 0;
  /** The flash's alpha this frame (0 between strikes), and when the last one was. */
  flash = 0;
  private lastFlash = -99;
  private nextStrike = 18;
  private readonly drops = new Float32Array((NEAR + FAR) * 3);
  private seeded = false;
  private readonly puddles = new Map<string, Float32Array>();
  /** Flashes seen (the tests read it). */
  flashes = 0;
  /** S8: the strikes' tells on the ground, the bolts (a strike's first 0.12 s) and the scorches (20 s). */
  readonly rings: StrikeMark[] = [];
  readonly scorches: StrikeMark[] = [];
  /** What happened since the engine last read it (drained by `news()`). */
  private readonly told: StormNews[] = [];
  private readonly motes = new Float32Array(MOTES * 3);
  private motesSeeded = false;
  /** Strikes landed (the tests read it). */
  strikes = 0;
  news(): StormNews[] { return this.told.splice(0); }
  /** Test hook: the next strike now. */
  strikeSoon(): void { this.nextStrike = 0; }

  /** The rain's strength now (0 dry … 1 full; Mist-rain is half). */
  get rain(): number { return isWet(this.now.state) ? this.now.level * wetStrength(this.now.state) : 0; }

  /**
   * Each frame. In a storm a strike comes every 20–40 s: with `ground`, its tell is a ring on an open tile near the
   * Keeper and it lands STRIKE.tell later (the engine reads `news()` and hurts what stands there); without (a test, or
   * nowhere open), it is a distant one, a flash only.
   */
  update(dt: number, time: number, rnd: () => number, still: boolean, ground?: StrikeGround): void {
    const r = this.rain;
    this.wetness = r > 0 ? Math.min(1, this.wetness + dt / FILL_SECS) : Math.max(0, this.wetness - dt / DRY_SECS);
    this.flash = Math.max(0, this.flash - dt * 12);
    for (let i = this.scorches.length - 1; i >= 0; i--) { this.scorches[i].t += dt; if (this.scorches[i].t >= STRIKE.scorch) this.scorches.splice(i, 1); }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const g = this.rings[i];
      g.t += dt;
      if (g.t < STRIKE.tell) continue;
      this.rings.splice(i, 1);
      const near = !!ground?.onScreen(g.x, g.y);
      this.scorches.push({ x: g.x, y: g.y, t: 0, seed: g.seed });
      if (this.scorches.length > 8) this.scorches.shift();
      this.strikes++;
      this.told.push({ kind: 'strike', x: g.x, y: g.y, near });
      this.flashNow(time, still, near ? FLASH_MAX : .08);
    }
    if (this.now.state === 'storm' && this.now.level > .5) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.nextStrike = STRIKE.every[0] + rnd() * (STRIKE.every[1] - STRIKE.every[0]);
        const at = ground?.pick(rnd) ?? null;
        if (at) { this.rings.push({ x: at.x, y: at.y, t: 0, seed: Math.floor(rnd() * 1e6) }); this.told.push({ kind: 'tell', x: at.x, y: at.y }); }
        else { this.told.push({ kind: 'far' }); this.flashNow(time, still, rnd() < .5 ? FLASH_MAX : .08); }
      }
    } else if (this.rings.length && this.now.state !== 'storm') this.rings.length = 0;
  }
  /** Photosensitivity: never above FLASH_MAX, never twice within FLASH_GAP, none under reduced motion or on soft. */
  private flashNow(time: number, still: boolean, a: number): void {
    if (still || this.show !== 'full' || time - this.lastFlash < FLASH_GAP) return;
    this.lastFlash = time; this.flashes++;
    this.flash = Math.min(FLASH_MAX, a);
  }

  /**
   * On the floor (world space, flat; iso has its ground plane set): each strike's tell — a pulsing white ring a tile and
   * a quarter round, brightening as it closes — and the scorches. Held still (a steady ring) under reduced motion.
   */
  drawGround(c: CanvasRenderingContext2D, inView: (x: number, y: number) => boolean, still: boolean): void {
    if (!this.rings.length && !this.scorches.length) return;
    for (const g of this.scorches) {
      if (!inView(g.x, g.y)) continue;
      c.globalAlpha = .5 * (1 - g.t / STRIKE.scorch); c.fillStyle = '#1a1418';
      c.fillRect(Math.round(g.x) - 6, Math.round(g.y) - 2, 12, 4); c.fillRect(Math.round(g.x) - 4, Math.round(g.y) - 4, 8, 8);
      c.fillStyle = '#3a3236'; c.fillRect(Math.round(g.x) - 9, Math.round(g.y), 3, 1); c.fillRect(Math.round(g.x) + 6, Math.round(g.y) - 1, 3, 1);
    }
    const R = STRIKE.radius * TILE;
    for (const g of this.rings) {
      if (!inView(g.x, g.y)) continue;
      const k = g.t / STRIKE.tell, pulse = still ? 1 : .7 + .3 * Math.abs(Math.sin(g.t * (6 + k * 10)));
      const x0 = Math.round(g.x), y0 = Math.round(g.y);
      // The ground it will hit, faintly lit; then the rim, a solid stepped circle of art pixels, and a second ring
      // closing in on the middle as the strike nears (it reads as a countdown).
      c.fillStyle = '#ffffff';
      c.globalAlpha = (.08 + .14 * k) * pulse;
      for (let dy = -R; dy <= R; dy += 2) { const w = Math.round(Math.sqrt(R * R - dy * dy)); c.fillRect(x0 - w, y0 + dy, w * 2, 2); }
      c.globalAlpha = (.6 + .35 * k) * pulse;
      const n = 96, r2 = R * (1 - k * .75);
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        c.fillRect(Math.round(x0 + ca * R), Math.round(y0 + sa * R), 1, 1);
        if (i % 2 === 0) c.fillRect(Math.round(x0 + ca * r2), Math.round(y0 + sa * r2), 1, 1);
      }
      c.fillStyle = '#ffe066'; c.globalAlpha = .5 + .4 * k; c.fillRect(x0 - 1, y0 - 1, 2, 2);
    }
    c.globalAlpha = 1;
  }
  /**
   * A strike's bolt (its first 0.12 s): a stepped pixel bolt from high above down to the ground, drawn upright where the
   * ring was (`at` anchors it for iso). Never under reduced motion or on soft.
   */
  drawBolts(c: CanvasRenderingContext2D, inView: (x: number, y: number) => boolean, still: boolean, at?: (x: number, y: number) => void): void {
    if (still || this.show !== 'full') return;
    for (const g of this.scorches) {
      if (g.t > .12 || !inView(g.x, g.y)) continue;
      at?.(g.x, g.y);
      let x = Math.round(g.x), y = Math.round(g.y) - 160, h = g.seed;
      c.fillStyle = '#fff8e0'; c.globalAlpha = .95;
      while (y < g.y) {
        h = (h * 1103515245 + 12345) >>> 0;
        const step = 6 + (h >>> 16) % 8, dx = ((h >>> 8) % 5) - 2;
        c.fillRect(x, y, 2, step); x += dx; y += step;
      }
      c.globalAlpha = .6; c.fillStyle = '#ffe066'; c.fillRect(Math.round(g.x) - 3, Math.round(g.y) - 2, 6, 2);
    }
    c.globalAlpha = 1;
  }

  /** Puddles on the roads and flagstones of the chunks in view (world space, under everything standing). */
  drawPuddles(c: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }, ground: (c: number, r: number) => Ground, budget: { left: number }): void {
    if (this.wetness <= .02) return;
    const span = CHUNK * TILE;
    const x0 = Math.floor(view.x / span), x1 = Math.floor((view.x + view.w) / span), y0 = Math.floor(view.y / span), y1 = Math.floor((view.y + view.h) / span);
    c.fillStyle = '#2c3442';
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const key = `${cx},${cy}`;
      let list = this.puddles.get(key);
      if (!list) {
        // One chunk's survey a frame at most: the roads read the ground once, then the list is kept.
        if (budget.left <= 0) continue;
        budget.left--;
        const out: number[] = [];
        for (let r = cy * CHUNK; r < (cy + 1) * CHUNK; r++) for (let q = cx * CHUNK; q < (cx + 1) * CHUNK; q++) {
          const hsh = Math.abs(Math.sin(q * 12.9898 + r * 78.233) * 43758.5453) % 1;
          if (hsh > .1) continue;
          const g = ground(q, r);
          if (g === 'cobble' || g === 'dirt' || g === 'flagstone' || g === 'plank') out.push(q * TILE + 3 + Math.floor(hsh * 60) % 6, r * TILE + 5 + Math.floor(hsh * 300) % 6, 5 + Math.floor(hsh * 90) % 5);
        }
        list = new Float32Array(out);
        this.puddles.set(key, list);
        if (this.puddles.size > 96) this.puddles.delete(this.puddles.keys().next().value!);
      }
      for (let i = 0; i < list.length; i += 3) {
        const w = Math.round(list[i + 2] * this.wetness);
        if (w < 2) continue;
        c.globalAlpha = .45 * this.wetness;
        c.fillRect(list[i], list[i + 1], w, Math.max(1, Math.round(w / 2.5)));
        // The sky's glint on the water.
        c.globalAlpha = .35 * this.wetness; c.fillStyle = '#9ab0c8';
        c.fillRect(list[i] + 1, list[i + 1], Math.max(1, w - 3), 1);
        c.fillStyle = '#2c3442';
      }
    }
    c.globalAlpha = 1;
  }

  /**
   * Over the world, under the HUD (screen space, device px): the day dimmed, the rain, the flash, and on Low a fog wash.
   * `s`: device px per art px. `phone`: half the streaks. `low`: Low detail (16 far streaks, no splashes).
   */
  drawScreen(c: CanvasRenderingContext2D, w: number, h: number, s: number, time: number, dt: number, o: { still: boolean; low: boolean; phone: boolean; night: number }): void {
    const st = this.now.state, lv = this.now.level;
    if (lv <= 0 || this.show === 'off') return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const dim = dayDim(st) * lv * (1 - o.night * .7);
    if (dim > .01) { c.globalAlpha = dim; c.fillStyle = '#1e2030'; c.fillRect(0, 0, w, h); }
    if ((st === 'fog' || st === 'mistrain') && o.low) { c.globalAlpha = (st === 'fog' ? .2 : .1) * lv; c.fillStyle = '#c8c8d8'; c.fillRect(0, 0, w, h); }
    // The land specials' films: Ashfall's grey on the ground, Spore drift's soft green (kept under Soft and reduced motion).
    if (st === 'ashfall') { c.globalAlpha = .05 * lv; c.fillStyle = '#8a8288'; c.fillRect(0, 0, w, h); }
    if (st === 'spores') { c.globalAlpha = .05 * lv; c.fillStyle = '#7fd5a3'; c.fillRect(0, 0, w, h); }
    const rain = this.rain;
    if (rain > 0 && this.show === 'full' && !o.still) this.drawRain(c, w, h, s, dt, rain, o, st === 'mistrain');
    if ((st === 'ashfall' || st === 'spores') && this.show === 'full' && !o.still) this.drawMotes(c, w, h, s, dt, lv, st === 'spores', o);
    if (this.flash > 0) { c.globalAlpha = Math.min(FLASH_MAX, this.flash); c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); }
    c.globalAlpha = 1;
    void time;
  }

  /** Ashfall's grey 2 × 2 flakes drifting down-left, slowly; or Spore drift's pale motes rising (screen space, a fixed pool). */
  private drawMotes(c: CanvasRenderingContext2D, w: number, h: number, s: number, dt: number, lv: number, up: boolean, o: { low: boolean; phone: boolean }): void {
    const m = this.motes, px = Math.max(1, Math.round(s));
    if (!this.motesSeeded) { for (let i = 0; i < MOTES; i++) { m[i * 3] = Math.random() * w; m[i * 3 + 1] = Math.random() * h; m[i * 3 + 2] = Math.random(); } this.motesSeeded = true; }
    const n = Math.round((o.low ? MOTES_LOW : o.phone ? MOTES_PHONE : MOTES) * lv);
    c.fillStyle = up ? '#c8ffe0' : '#b8b0bc';
    for (let i = 0; i < n; i++) {
      const j = i * 3, k = m[j + 2];
      if (up) { m[j + 1] -= (10 + 14 * k) * px * dt; m[j] += Math.sin((m[j + 1] / px) * .05 + k * 6) * 4 * px * dt; }
      else { m[j] -= (8 + 8 * k) * px * dt; m[j + 1] += (14 + 10 * k) * px * dt; }
      if (m[j + 1] > h) m[j + 1] -= h; if (m[j + 1] < 0) m[j + 1] += h;
      if (m[j] < 0) m[j] += w; if (m[j] > w) m[j] -= w;
      c.globalAlpha = (up ? .5 : .6) * (.6 + .4 * k);
      c.fillRect(Math.floor(m[j] / px) * px, Math.floor(m[j + 1] / px) * px, px * 2, px * 2);
    }
  }

  private drawRain(c: CanvasRenderingContext2D, w: number, h: number, s: number, dt: number, rain: number, o: { low: boolean; phone: boolean }, fine: boolean): void {
    const d = this.drops;
    if (!this.seeded) {
      for (let i = 0; i < NEAR + FAR; i++) { d[i * 3] = Math.random() * w; d[i * 3 + 1] = Math.random() * h; d[i * 3 + 2] = i < NEAR ? 1 : 0; }
      this.seeded = true;
    }
    const near = o.low ? 0 : Math.round(NEAR * (o.phone ? .5 : 1) * rain);
    const far = o.low ? Math.round(LOW_FAR * rain) : Math.round(FAR * (o.phone ? .5 : 1) * rain);
    const px = Math.max(1, Math.round(s));
    c.fillStyle = '#dce8f8';
    // Near streaks: faster, brighter, 1 × 6 art px, slanted; far ones fainter and shorter.
    c.globalAlpha = .7;
    // Mist-rain's are finer: 1 × 2 art px (world-acts §3.4).
    for (let i = 0; i < near; i++) this.step(c, d, i, w, h, px, dt, 1, fine ? 3 : 6);
    c.globalAlpha = .42;
    for (let i = 0; i < far; i++) this.step(c, d, NEAR + i, w, h, px, dt, .6, fine ? 2 : 4);
    // Splash ticks where it lands (Normal only).
    if (!o.low) {
      c.globalAlpha = .45;
      const n = Math.round(8 * rain * (o.phone ? .5 : 1));
      for (let i = 0; i < n; i++) c.fillRect(Math.floor(Math.random() * w / px) * px, Math.floor(Math.random() * h / px) * px, px * 2, px);
    }
  }
  private step(c: CanvasRenderingContext2D, d: Float32Array, i: number, w: number, h: number, px: number, dt: number, speed: number, len: number): void {
    const j = i * 3;
    d[j] -= 90 * speed * px * dt; d[j + 1] += 420 * speed * px * dt;
    if (d[j + 1] > h) { d[j + 1] -= h + len * px; d[j] = Math.random() * (w + 60 * px); }
    if (d[j] < -4 * px) d[j] += w + 8 * px;
    const x = Math.floor(d[j] / px) * px, y = Math.floor(d[j + 1] / px) * px, half = Math.ceil(len / 2);
    // Two stepped halves, the lower one a pixel left: the wind's slant, still on the pixel grid.
    c.fillRect(x, y, px, px * half);
    c.fillRect(x - px, y + px * half, px, px * (len - half));
  }
}
