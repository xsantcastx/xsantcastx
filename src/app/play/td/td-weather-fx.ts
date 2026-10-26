/**
 * td-weather-fx.ts — Weather v1 on the top-down canvas (shared/weather/weather.model.ts; world-acts §3.4).
 *
 *   Rain        diagonal 1 × 3 art-px streaks in two depths (40 near + 60 far; half on a phone; 16 far ones on Low),
 *               2 × 1 splash ticks (Normal only), and puddles on road and flagstone that linger 60 s after the rain.
 *   Thunderstorm  the rain, the day dimmed more, and a flash now and then: never above 25% white, never two within 3 s,
 *               none at all under reduced motion or "soft" (the tint stays).
 *   Fog         the engine's own fog bank (drawFog) thickened; on Low a flat grey wash instead of the noise layer.
 *   Overcast    the day a little darker.
 *
 * Everything is cheap on purpose: a fixed pool of streaks drawn as fillRects in screen space, puddles found once per
 * chunk and cached, no per-frame allocation. The phone profile (e2e/td-perf-phone, CPU ×6, DPR 3) must hold 60 fps on
 * Low with rain falling.
 */
import { dayDim, isWet, type WeatherNow, type WeatherShow } from '../../shared/weather/weather.model';

const TILE = 16;
const CHUNK = 16;
const NEAR = 40, FAR = 60, LOW_FAR = 16;
/** Puddles fill over 30 s of rain and dry 60 s after it stops. */
const FILL_SECS = 30, DRY_SECS = 60;
/** The flash: at most this white, at most one in this many seconds. */
export const FLASH_MAX = .25;
export const FLASH_GAP = 3;

export type Ground = string;

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

  /** The rain's strength now (0 dry … 1 full). */
  get rain(): number { return isWet(this.now.state) ? this.now.level : 0; }

  update(dt: number, time: number, rnd: () => number, still: boolean): void {
    const r = this.rain;
    this.wetness = r > 0 ? Math.min(1, this.wetness + dt / FILL_SECS) : Math.max(0, this.wetness - dt / DRY_SECS);
    this.flash = Math.max(0, this.flash - dt * 12);
    if (this.now.state === 'storm' && this.now.level > .5) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.nextStrike = 20 + rnd() * 20;
        // Photosensitivity: off under reduced motion and on soft; never twice within FLASH_GAP.
        if (!still && this.show === 'full' && time - this.lastFlash >= FLASH_GAP) {
          this.lastFlash = time; this.flashes++;
          this.flash = rnd() < .5 ? FLASH_MAX : .08;   // a near strike, or a far one
        }
      }
    }
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
    if (st === 'fog' && o.low) { c.globalAlpha = .2 * lv; c.fillStyle = '#c8c8d8'; c.fillRect(0, 0, w, h); }
    const rain = this.rain;
    if (rain > 0 && this.show === 'full' && !o.still) this.drawRain(c, w, h, s, dt, rain, o);
    if (this.flash > 0) { c.globalAlpha = Math.min(FLASH_MAX, this.flash); c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); }
    c.globalAlpha = 1;
    void time;
  }

  private drawRain(c: CanvasRenderingContext2D, w: number, h: number, s: number, dt: number, rain: number, o: { low: boolean; phone: boolean }): void {
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
    for (let i = 0; i < near; i++) this.step(c, d, i, w, h, px, dt, 1, 6);
    c.globalAlpha = .42;
    for (let i = 0; i < far; i++) this.step(c, d, NEAR + i, w, h, px, dt, .6, 4);
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
