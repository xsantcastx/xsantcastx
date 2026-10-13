/**
 * ground-strip.ts — the walkable ground of towns and hunting grounds as pixel
 * art (it used to be three flat rectangles).
 *
 * One small texture per realm, 16 art px wide and 28 tall, baked once and laid
 * as a repeating pattern at 4 logical px per art px (the town scale, style
 * guide §2): a bright worn top lip lit from above, a 1 art px outline under it,
 * then dressed stone courses in the realm's ground ramp (§5.2). The pattern is
 * anchored to world x = 0 and to each platform's top, so the lip always sits
 * on the walking line and neighbouring platforms read as one material.
 *
 * Render-only; a frame allocates nothing after the first bake per realm.
 */
import { seededRandom } from './terrain';

/** Logical px per art px in towns. */
export const TOWN_ART = 4;
const W = 16, H = 28;

/** [outline, dark, base, light, lip, lip highlight] per realm (style guide §5.2). */
export const GROUND_PALETTES: Readonly<Record<string, readonly string[]>> = {
  infernal: ['#171116', '#3a2b2c', '#5a4440', '#7a625a', '#c4501e', '#ff9b4f'],
  luminous: ['#2a2218', '#6a5a3e', '#8a7a58', '#b8a57c', '#c9b88e', '#efe4c8'],
  umbral: ['#0e0912', '#261b30', '#33263a', '#4a3a58', '#5a2f8a', '#a878e8'],
  celestial: ['#0a1428', '#1f3558', '#2c4a74', '#4a6c98', '#8a6a3a', '#e8c47a'],
  verdant: ['#1a120a', '#3a2a1c', '#5a4228', '#7a5a36', '#4a7a3a', '#9ad84e'],
};

/** The texture's palette indices (row-major, W × H). Same realm → same pixels. Pure. */
export function groundPixels(realm: string): Uint8Array {
  const px = new Uint8Array(W * H);
  let seed = 0x67a0d;
  for (let i = 0; i < realm.length; i++) seed = Math.imul(seed ^ realm.charCodeAt(i), 16777619) >>> 0;
  const r = seededRandom(seed);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v: number;
      if (y === 0) v = r() < .7 ? 5 : 4;            // lit lip, a few darker worn pixels
      else if (y === 1) v = 4;
      else if (y === 2) v = r() < .25 ? 4 : 0;      // outline under the lip, a few lip drips
      else {
        // Stone courses 6 art px tall, joints offset every other course.
        const yy = y - 3, course = Math.floor(yy / 6), by = yy % 6, bx = (x + (course & 1) * 8) % 16;
        if (by === 5 || bx === 15) v = 0;           // mortar
        else if (by === 0 || bx === 0) v = 3;       // lit top-left of each stone
        else if (by === 4 || bx === 14) v = 1;      // shadowed bottom-right
        else v = r() < .12 ? 1 : r() < .1 ? 3 : 2;  // speckle
      }
      px[y * W + x] = v;
    }
  }
  return px;
}

export class GroundStrip {
  private readonly baked = new Map<string, HTMLCanvasElement | null>();
  private readonly patterns = new Map<string, { context: CanvasRenderingContext2D; pattern: CanvasPattern | null }>();

  /**
   * Fill a platform's box (world px, camera applied) with the realm's ground.
   * Returns false where no canvas can be made, so the caller draws its flat fallback.
   */
  draw(c: CanvasRenderingContext2D, realm: string, x: number, y: number, w: number, h: number): boolean {
    const pattern = this.pattern(c, realm);
    if (!pattern) return false;
    const a = TOWN_ART;
    c.save();
    c.translate(0, Math.round(y / a) * a);
    c.scale(a, a);
    c.fillStyle = pattern;
    const left = Math.floor(x / a), right = Math.ceil((x + w) / a);
    c.fillRect(left, 0, right - left, Math.max(1, Math.round(h / a)));
    c.restore();
    // A thin ledge gets a dark underside, so it reads as a slab, not a stripe.
    if (h < H * a) { c.fillStyle = (GROUND_PALETTES[realm] ?? GROUND_PALETTES['infernal'])[0]; c.fillRect(Math.floor(x / a) * a, Math.round((y + h) / a) * a - a, (right - left) * a, a); }
    return true;
  }

  private pattern(c: CanvasRenderingContext2D, realm: string): CanvasPattern | null {
    const known = this.patterns.get(realm);
    if (known && known.context === c) return known.pattern;
    const canvas = this.bake(realm);
    const pattern = canvas && typeof c.createPattern === 'function' ? c.createPattern(canvas, 'repeat') ?? null : null;
    this.patterns.set(realm, { context: c, pattern });
    return pattern;
  }

  private bake(realm: string): HTMLCanvasElement | null {
    let canvas = this.baked.get(realm);
    if (canvas !== undefined) return canvas;
    canvas = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const made = document.createElement('canvas');
      const d = made.getContext?.('2d');
      if (d) {
        made.width = W; made.height = H;
        const palette = GROUND_PALETTES[realm] ?? GROUND_PALETTES['infernal'];
        const px = groundPixels(realm);
        for (let i = 0; i < px.length; i++) { d.fillStyle = palette[px[i]]; d.fillRect(i % W, Math.floor(i / W), 1, 1); }
        canvas = made;
      }
    }
    this.baked.set(realm, canvas);
    return canvas;
  }
}
