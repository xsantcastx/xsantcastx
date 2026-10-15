/**
 * homestead-pixel.ts — the Homestead's figures and props as pixel art (one art
 * style, pass 2). Used by homestead-render.ts when a canvas can be made.
 *
 * Buildings are the scene's own geometry painted once into a quarter-size
 * canvas (`paintWorld`, the Hearth's method): the figures' 4 px grid, snapped,
 * outlined, cached per look (a Treasury with three banners and four coin piles
 * is one sprite until a fourth banner is bought).
 *
 * The workers get real pixel bodies instead of stick figures:
 *   - Forge Automatons, by rung: the brass Apprentice Striker, the stone-and-iron
 *     Forge Golem, the obsidian Eclipse Automaton with its violet core — 10–14 art
 *     px wide, two frames each (hammer raised, hammer struck);
 *   - Thralls: hooded, a chain at the wrist, robe trimmed in their tier's colour,
 *     three hammer frames (the hammer's angle is still the time to the next real
 *     pull) and a slumped idle pose;
 *   - Explorers are people, so they are Keepers (keeper-paint.ts) in their realm's
 *     cloth: sitting by the camp fire, walking the road out and home.
 *
 * Small on purpose: an automaton is a tool, half a Keeper's height, so ten fit
 * round one anvil on the same grid as the people beside them.
 *
 * Browser only (canvas).
 */
import { canvas, dark, light, outlined, px } from '../../shared/keeper-look/keeper-paint';

type Ctx = CanvasRenderingContext2D;
/** World px per art px. */
export const HP = 4;

/** Blit a sprite made by paintWorld (or a 1 px-margin art sprite) with its art (0, 0) at world (x, y). */
export function blit(c: Ctx, el: HTMLCanvasElement, x: number, y: number): void {
  const smoothing = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(el, Math.round(x) - HP, Math.round(y) - HP, el.width * HP, el.height * HP);
  c.imageSmoothingEnabled = smoothing;
}

/** An art-px sprite with a 1 px margin for the outline; `paint` draws at (0, 0) = its top-left. */
function sprite(w: number, h: number, paint: (c: Ctx) => void): HTMLCanvasElement {
  const raw = canvas(w + 2, h + 2);
  const c = raw.getContext('2d')!;
  c.translate(1, 1);
  paint(c);
  return outlined(raw);
}

/** The three automaton rungs (economy ladder order: apprentice, golem, eclipse). */
const AUTOMATON = [
  { w: 10, h: 16, body: '#a5793a', hi: '#e8c898', lo: '#5a3c1a', eye: '#ffcf8a', core: null },
  { w: 14, h: 20, body: '#6d6474', hi: '#a0949b', lo: '#3a3339', eye: '#ffcf8a', core: '#c4501e' },
  { w: 11, h: 18, body: '#2e2238', hi: '#6a5878', lo: '#140a1f', eye: '#c9a0ff', core: '#a855f7' },
] as const;

/** Thrall: hood, robe, the chain at the wrist. */
const THRALL = { w: 9, h: 14 } as const;

export class HomesteadPixels {
  private readonly cache = new Map<string, HTMLCanvasElement>();
  private get(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
    let el = this.cache.get(key);
    if (!el) { el = make(); this.cache.set(key, el); }
    return el;
  }
  /** A cached sprite of world-space geometry under `key` (paintWorld). */
  world(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement { return this.get(`w:${key}`, make); }

  /**
   * An automaton of `rung`, feet at (x, floor), facing right; `struck` brings the hammer down.
   * Drawn at the figures' grid.
   */
  automaton(c: Ctx, rung: number, x: number, floor: number, struck: boolean): void {
    const a = AUTOMATON[Math.max(0, Math.min(2, rung))];
    if (!this.cache.has(`auto:${rung}:0`)) this.automatonSprite(rung, true);
    const el = this.automatonSprite(rung, struck);
    blit(c, el, x - (a.w / 2) * HP, floor - el.height * HP + HP * 2);
  }

  private automatonSprite(rung: number, struck: boolean): HTMLCanvasElement {
    const a = AUTOMATON[Math.max(0, Math.min(2, rung))];
    return this.get(`auto:${rung}:${struck ? 1 : 0}`, () => sprite(a.w + 6, a.h + 4, s => {
      const p = (x0: number, y0: number, w: number, h: number, col: string) => px(s, x0, y0, w, h, col);
      const top = 4, cx = Math.floor(a.w / 2);
      // Legs, body (lit top-left, shaded right), head, eyes.
      p(cx - 3, top + a.h - 5, 2, 5, a.lo); p(cx + 1, top + a.h - 5, 2, 5, a.lo);
      p(1, top + 5, a.w - 2, a.h - 10, a.body); p(1, top + 5, a.w - 2, 1, a.hi); p(1, top + 5, 1, a.h - 10, a.hi);
      p(a.w - 2, top + 6, 1, a.h - 11, a.lo);
      if (rung === 1) { p(0, top + 5, 2, 3, a.lo); p(a.w - 2, top + 5, 2, 3, a.lo); }
      p(cx - 2, top, 5, 5, a.body); p(cx - 2, top, 5, 1, a.hi); p(cx - 1, top + 2, 1, 1, a.eye); p(cx + 1, top + 2, 1, 1, a.eye);
      if (a.core) { p(cx - 1, top + 8, 3, 3, a.core); p(cx, top + 9, 1, 1, light(a.core, .5)); }
      // Rivets.
      p(2, top + a.h - 7, 1, 1, a.lo); p(a.w - 3, top + a.h - 7, 1, 1, a.lo);
      // The arm and hammer: raised above the shoulder, or struck down in front.
      if (struck) {
        p(a.w - 1, top + 7, 3, 2, a.body); p(a.w + 2, top + 8, 1, 4, '#5a3d2e'); p(a.w + 1, top + 12, 4, 3, '#9aa0a8'); p(a.w + 1, top + 12, 4, 1, '#c0c4cc');
      } else {
        p(a.w - 1, top + 5, 2, 2, a.body); p(a.w + 1, top + 1, 1, 5, '#5a3d2e'); p(a.w - 1, top - 2, 5, 3, '#9aa0a8'); p(a.w - 1, top - 2, 5, 1, '#c0c4cc');
      }
    }));
  }

  /**
   * A Thrall in `color` (its tier), feet at (x, floor). `phase` 0..1 is its hammer
   * (0 raised → 1 struck); `idle` slumps it, unlit.
   */
  thrall(c: Ctx, color: string, x: number, floor: number, phase: number, idle: boolean, facing: number): void {
    const frame = idle ? 'idle' : phase < .34 ? 'up' : phase < .67 ? 'mid' : 'down';
    // A tier's four poses are made together, so no sprite appears later as a slow cycle reaches it.
    if (!this.cache.has(`thrall:${color}:idle`)) for (const pose of ['idle', 'up', 'mid', 'down'] as const) this.thrallSprite(color, pose);
    this.blitThrall(c, this.thrallSprite(color, frame), x, floor, facing);
  }

  private thrallSprite(color: string, frame: 'idle' | 'up' | 'mid' | 'down'): HTMLCanvasElement {
    const idle = frame === 'idle';
    return this.get(`thrall:${color}:${frame}`, () => sprite(THRALL.w + 5, THRALL.h + 4, s => {
      const p = (x0: number, y0: number, w: number, h: number, col: string) => px(s, x0, y0, w, h, col);
      const cloth = '#3a2a30', clothHi = '#5a4448', top = idle ? 6 : 4;
      const h = idle ? THRALL.h - 2 : THRALL.h;
      // Robe, trimmed in the tier colour; hood with two dim eyes in its shadow.
      p(1, top + 4, 7, h - 4, cloth); p(1, top + 4, 1, h - 4, clothHi); p(1, top + h - 1, 7, 1, color);
      p(2, top, 5, 5, cloth); p(2, top, 4, 1, clothHi); p(3, top + 2, 3, 2, '#140a1f');
      p(3, top + 3, 1, 1, idle ? '#5a4a3e' : '#ffcf8a'); p(5, top + 3, 1, 1, idle ? '#5a4a3e' : '#ffcf8a');
      // The chain at the wrist.
      p(7, top + 7, 2, 1, '#8c8494'); p(8, top + 8, 1, 1, '#57474f');
      if (idle) return;
      const hammer = frame === 'up' ? [9, top - 3] : frame === 'mid' ? [10, top + 2] : [10, top + 7];
      p(8, top + 5, 2, 1, cloth);
      p(hammer[0], hammer[1] + 2, 1, 4, '#5a3d2e'); p(hammer[0] - 1, hammer[1], 3, 2, '#9aa0a8'); p(hammer[0] - 1, hammer[1], 3, 1, '#c0c4cc');
    }));
  }

  private blitThrall(c: Ctx, el: HTMLCanvasElement, x: number, floor: number, facing: number): void {
    c.save();
    c.translate(Math.round(x), floor); c.scale(facing < 0 ? -1 : 1, 1);
    blit(c, el, -(THRALL.w / 2) * HP, -el.height * HP + HP * 2);
    c.restore();
  }

  /** A tent, 18 × 13 art px: canvas over two poles, the flap dark (or a lantern lit inside when someone is home). */
  tent(c: Ctx, x: number, floor: number, away: boolean, cloth: string): void {
    const el = this.get(`tent:${away ? 1 : 0}:${cloth}`, () => sprite(18, 13, s => {
      const lo = dark(cloth, .3), hi = light(cloth, .25);
      for (let y = 0; y < 13; y++) {
        const half = Math.round((y + 1) * 9 / 13);
        px(s, 9 - half, y, half * 2, 1, cloth);
        px(s, 9 - half, y, 1, 1, hi);
        px(s, 8 + half, y, 1, 1, lo);
      }
      for (let y = 5; y < 13; y++) { const half = Math.round((y - 4) * 3 / 8); px(s, 9 - half, y, half * 2, 1, away ? '#2a1d22' : '#6a4a2a'); }
      if (!away) px(s, 8, 9, 2, 2, '#ffd08a');
    }));
    blit(c, el, x - 9 * HP, floor - el.height * HP + HP * 2);
  }

  /** A small pixel fire, 5 art px wide; `flicker` 0..1 lifts its tongues a pixel. */
  fire(c: Ctx, x: number, floor: number, flicker: number): void {
    if (!this.cache.has('fire:0')) this.fireSprite(1);
    const el = this.fireSprite(flicker > .5 ? 1 : 0);
    blit(c, el, x - 3.5 * HP, floor - el.height * HP + HP);
  }

  private fireSprite(f: number): HTMLCanvasElement {
    return this.get(`fire:${f}`, () => sprite(7, 9, s => {
      px(s, 0, 7, 7, 2, '#5a3d2e'); px(s, 1, 7, 5, 1, '#7a5440');
      const rows = [[3, 1], [2, 3], [1, 5], [1, 5], [2, 3]] as const;
      rows.forEach(([x0, w], i) => px(s, x0, 2 + i - f, w, 1, i < 2 ? '#ffd08a' : '#E8752A'));
      px(s, 3, 4 - f, 1, 2, '#fff1b0');
    }));
  }

  /**
   * The Forge's violet fire (the Godforge's own flame, as the painting it replaces
   * was), its base at (x, base): 16 art px wide, three tongues, two frames.
   * No outline: a flame reads by brightness (art bible §4).
   */
  forgeFire(c: Ctx, x: number, base: number, time: number): void {
    const f = time > 0 && Math.sin(time * 9) > 0 ? 1 : 0;
    if (!this.cache.has('forge-fire:0')) this.forgeFireSprite(1);
    const el = this.forgeFireSprite(f);
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    c.drawImage(el, Math.round(x - 8 * HP), Math.round(base - 22 * HP), 16 * HP, 22 * HP);
    c.imageSmoothingEnabled = smoothing;
  }

  private forgeFireSprite(f: number): HTMLCanvasElement {
    return this.get(`forge-fire:${f}`, () => {
      const raw = canvas(16, 22), s = raw.getContext('2d')!;
      // Column heights per tongue, swapped between the frames.
      const heights = f ? [6, 11, 15, 19, 21, 17, 13, 18, 20, 16, 12, 9, 7, 5, 4, 3] : [4, 8, 13, 17, 19, 21, 16, 12, 16, 19, 15, 11, 8, 6, 4, 3];
      heights.forEach((h, x0) => {
        for (let y = 0; y < h; y++) {
          const t = y / h;
          px(s, x0, 21 - y, 1, 1, t > .82 ? '#d9b8ff' : t > .55 ? '#a855f7' : t > .2 ? '#7b3fc4' : '#3a1f63');
        }
      });
      px(s, 6, 15, 4, 5, '#fff1b0'); px(s, 7, 12, 2, 3, '#d9b8ff');
      return raw;
    });
  }
}
