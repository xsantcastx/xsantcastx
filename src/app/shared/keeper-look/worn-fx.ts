/**
 * worn-fx.ts — the few live pixels a worn piece carries (worn-look.model.ts `fx`, `eyes`): embers rising off a crown of
 * coals, a dark mist wisp round a cowl, slow motes, a censer's smoke, and the 1-px glow round glowing eyes, flickering.
 *
 * docs/design/effects-spec.md: pixel only (whole art pixels, no blur), the element's own tones, never more than six
 * pixels alive per piece (rule 4's budget: the Keeper's own flourishes stay small beside a fight), ≤ 85% opaque, and
 * under reduced motion the same pixels held still. The painters (keeper-paint.ts side view, keeper-front.ts front and
 * back) call these with the anchor point in art pixels; the pixels are drawn live, over the cached body sheet, so a
 * flicker never re-bakes a sprite.
 *
 * Pure geometry plus one canvas call per pixel group.
 */
import type { WornFxKind } from './worn-look.model';

type Ctx = CanvasRenderingContext2D;

function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string, alpha: number): void {
  if (alpha <= 0) return;
  const a = c.globalAlpha;
  c.globalAlpha = a * Math.min(.85, alpha);
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
  c.globalAlpha = a;
}
function dim(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - t) + 0x14 * t).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
/** A per-piece phase, so two Keepers' embers never rise in step. */
function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 997) / 997;
}

/**
 * One piece's particles round (ox, oy) — the top of a crown, the bowl of a censer, a cowl's brim — at `time` seconds.
 * `w` is how wide the source is (art px). At most six pixels.
 */
export function wornParticles(c: Ctx, kind: WornFxKind, color: string, ox: number, oy: number, w: number, time: number, still: boolean, seed = ''): void {
  const s = seedOf(seed + kind);
  const half = Math.max(1, w >> 1);
  switch (kind) {
    case 'embers': {
      // Four sparks climbing ~10 px, wavering, cooling from the colour to its dark as they rise; one blinks out early.
      for (let i = 0; i < 4; i++) {
        const u = still ? (i + 1) / 5 : ((time * .65 + i / 4 + s) % 1);
        if (!still && u > .82 && i % 2) continue;
        const x = ox - half + Math.round(((i * 7 + 3) % (half * 2 + 1))) + (still ? 0 : Math.round(Math.sin(u * 6 + i * 1.7) * 1.2));
        const y = oy - 1 - Math.round(u * 10);
        rect(c, x, y, 1, 1, u < .45 ? color : dim(color, .45), 1 - u * .6);
      }
      // A white-hot spark at the source now and then.
      if (still || Math.sin(time * 5.1 + s * 9) > .6) rect(c, ox, oy - 1, 1, 1, '#fff2a8', .8);
      return;
    }
    case 'smoke': {
      // Four puffs rising from the bowl and curling to one side, thinning out.
      for (let i = 0; i < 4; i++) {
        const u = still ? (i + 1) / 5 : ((time * .45 + i / 4 + s) % 1);
        const x = ox + Math.round(Math.sin(u * 4.2 + i) * 1.6 + u * 2);
        const y = oy - 1 - Math.round(u * 9);
        rect(c, x, y, u > .5 ? 2 : 1, 1, u < .3 ? color : dim(color, .35), (1 - u) * .75);
      }
      return;
    }
    case 'mist': {
      // A dark wisp: three short smears drifting slowly sideways round the source, never brighter than a shadow.
      for (let i = 0; i < 3; i++) {
        const u = still ? i / 3 : ((time * .22 + i / 3 + s) % 1);
        const x = ox - half - 2 + Math.round(u * (w + 4));
        const y = oy + i * 3 - Math.round(Math.sin(u * Math.PI) * 2);
        rect(c, x, y, 2, 1, color, Math.sin(u * Math.PI) * .7);
      }
      return;
    }
    case 'motes': {
      // Three motes on a slow ellipse round the source, twinkling.
      for (let i = 0; i < 3; i++) {
        const a = (still ? 0 : time * 1.1) + i * 2.09 + s * 6;
        const x = ox + Math.round(Math.cos(a) * (half + 3));
        const y = oy - 2 + Math.round(Math.sin(a) * 2);
        rect(c, x, y, 1, 1, color, still ? .7 : .45 + .35 * Math.sin(time * 4 + i * 2));
      }
      return;
    }
  }
}

/** The flicker of glowing eyes: 0.15–0.5, a fixed 0.35 under reduced motion. */
export function eyeFlicker(time: number, still: boolean, seed = ''): number {
  if (still) return .35;
  const s = seedOf(seed) * 6;
  return .32 + .1 * Math.sin(time * 7.3 + s) + .08 * Math.sin(time * 12.7 + 1 + s);
}

/** The 1-px glow round an eye pip w×h at (x, y): four sides, at `alpha`. */
export function eyeGlow(c: Ctx, x: number, y: number, w: number, h: number, color: string, alpha: number): void {
  rect(c, x - 1, y, 1, h, color, alpha);
  rect(c, x + w, y, 1, h, color, alpha);
  rect(c, x, y - 1, w, 1, color, alpha * .8);
  rect(c, x, y + h, w, 1, color, alpha * .6);
}
