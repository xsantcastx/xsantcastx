/**
 * td-flora.ts — the volumetric trees (the art style upgrade, owner 2026-10-26: "trees look more 3D";
 * docs/handoff/art-style.md).
 *
 * A crown is a dome of round leaf clumps painted back to front: each clump a little sphere lit from the upper left
 * (sunlit tips, a lit side, the body, a shaded side, a dark underside), the global light deepening toward the crown's
 * lower right, dark gaps where clumps meet, leaf speckle dithered inside. The trunk is shaded bark with a root flare,
 * darkened under the crown. Each tree also carries a soft stepped shadow for the ground pass (Sprite.shadow), cast down
 * and to the right. Everything is whole pixels with the one dark outline, baked once per kind and seed.
 */
import type { Sprite } from './td-art';
import { hash } from './td-art';

/**
 * The calm crowns (owner 2026-10-26: "the environment looks too much"): fewer, bigger clusters with softer light and
 * less leaf speckle, closer to the old clean trees beside the finer Keeper (docs/handoff/calm.md).
 */
const CALM = { step: 8.8, r: 5.4, rj: .9, noise: .12, marks: .35 } as const;

type Ctx = CanvasRenderingContext2D;

const OUTLINE = '#2a1a24';
/** Leaves, darkest to lightest: the gaps, the underside, the shade, the body, the lit side, the sunlit tips. */
export const LEAF_RAMP = ['#16321c', '#1f4a24', '#2d6a2c', '#3f8634', '#58a33c', '#7cc24c', '#a8dc66'] as const;
/** Needles (the pines): bluer and darker. */
export const PINE_RAMP = ['#102a20', '#173a28', '#21502f', '#2d6a38', '#3f8442', '#5aa250', '#86c068'] as const;
/** Bark, darkest to lightest. */
export const BARK_RAMP = ['#2e1c14', '#45291a', '#5e3a22', '#7a4e2e', '#94643c', '#b08050'] as const;

function cv(w: number, h: number): HTMLCanvasElement { const el = document.createElement('canvas'); el.width = w; el.height = h; return el; }
function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void { c.fillStyle = col; c.fillRect(x, y, w, h); }

/** A 1px dark outline round everything opaque already painted (as td-art's). */
function outline(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = cv(src.width + 2, src.height + 2);
  const c = out.getContext('2d')!;
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) c.drawImage(src, dx, dy);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = OUTLINE; c.fillRect(0, 0, out.width, out.height);
  c.globalCompositeOperation = 'source-over';
  c.drawImage(src, 1, 1);
  return out;
}

/** One clump: (x, y) its middle, r its radius, `tone` a whole-crown shift (−2 … +1) by where it sits. */
export interface Clump { x: number; y: number; r: number; tone: number }

/**
 * A leaf clump: a lumpy sphere (its rim nibbled by noise so it reads as leaves, not a ball), lit from the upper left,
 * a dark rim on its lower right where the next clump meets it, speckled leaves dithered through the body.
 */
export function paintClump(c: Ctx, k: Clump, ramp: readonly string[], seed: number): void {
  const R = Math.ceil(k.r) + 1, top = ramp.length - 1;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const ang = Math.atan2(y, x), wob = (hash(Math.round(ang * 4 + 9), seed, Math.round(k.x * 7 + k.y)) - .5) * (k.r < 5 ? .7 : 1.1);
    const d = Math.hypot(x, y * 1.08) - wob;
    if (d > k.r) continue;
    const nx = x / k.r, ny = y / k.r, nz = Math.sqrt(Math.max(0, 1 - Math.min(1, (nx * nx + ny * ny))));
    // Light from the upper left and a little in front.
    let l = -.58 * nx - .62 * ny + .52 * nz;
    l += (hash(k.x + x, k.y + y, seed + 3) - .5) * (k.r < 5 ? .1 : CALM.noise * 2);
    let i = l > .82 ? 6 : l > .55 ? 5 : l > .2 ? 4 : l > -.2 ? 3 : l > -.5 ? 2 : 1;
    // The rim toward the lower right is the gap between clumps: a dark crescent, two pixels deep on a big one.
    if (d > k.r - 1.1 && (nx + ny) > .2) i = (nx + ny) > .75 ? 0 : Math.min(i, 2);
    else if (d > k.r - 2.1 && (nx + ny) > .45) i = Math.min(i, 2);
    i = i === 0 ? 0 : Math.max(1, Math.min(top, i + k.tone));
    rect(c, Math.round(k.x + x), Math.round(k.y + y), 1, 1, ramp[i]);
  }
  // Leaf marks in the lit half: little two-pixel highlights.
  for (let n = 0; n < Math.round(k.r * CALM.marks); n++) {
    const a = -Math.PI * .75 + (hash(n, seed, Math.round(k.x * 13 + k.y)) - .5) * 1.6, rr = k.r * (.25 + hash(n, seed + 1, Math.round(k.x + k.y * 5)) * .5);
    const x = Math.round(k.x + Math.cos(a) * rr), y = Math.round(k.y + Math.sin(a) * rr);
    rect(c, x, y, 1, 1, ramp[Math.min(top, 6 + Math.min(0, k.tone))]); rect(c, x + 1, y + 1, 1, 1, ramp[Math.max(1, 3 + k.tone)]);
  }
}

/** A stepped soft shadow, `w`×`h`, darkest in the middle: three dithered rings, never a blur. */
export function shadowSprite(w: number, h: number): HTMLCanvasElement {
  const el = cv(w, h), c = el.getContext('2d')!;
  const cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x + .5 - cx) / (w / 2), (y + .5 - cy) / (h / 2));
    if (d > 1) continue;
    const a = d < .55 ? .34 : d < .8 ? .24 : (x + y) % 2 ? .14 : 0;
    if (!a) continue;
    c.fillStyle = `rgba(12,8,20,${a})`; c.fillRect(x, y, 1, 1);
  }
  return el;
}

/** A bark trunk from `top` to `foot`, `w` wide at x `cx`: lit left, shaded right, grain, roots flaring at its foot. */
function trunk(c: Ctx, cx: number, top: number, foot: number, w: number, seed: number): void {
  const x0 = Math.round(cx - w / 2);
  for (let y = top; y < foot; y++) for (let x = 0; x < w; x++) {
    const u = x / (w - 1);
    let i = u < .2 ? 4 : u < .45 ? 3 : u < .8 ? 2 : 1;
    if (hash(x0 + x, y, seed + 31) < .16) i = Math.max(1, i - 1);
    if ((x + Math.floor(y / 3) + seed) % 4 === 0 && u > .2 && u < .9 && hash(x, y, seed + 32) < .5) i = Math.max(0, i - 1);
    rect(c, x0 + x, y, 1, 1, BARK_RAMP[i]);
  }
  // Roots: a wedge each side, the near one lit.
  for (let i = 0; i < 4; i++) {
    const h = 4 - i;
    rect(c, x0 - 1 - i, foot - h, 1, h, BARK_RAMP[3]);
    rect(c, x0 + w + i, foot - h, 1, h, BARK_RAMP[1]);
  }
  rect(c, x0 - 4, foot - 1, w + 8, 1, BARK_RAMP[1]);
  rect(c, x0 + 1, foot - 3, 1, 1, BARK_RAMP[5]);
  // The crown's shade across the top of the trunk.
  rect(c, x0, top, w, 3, BARK_RAMP[0]); rect(c, x0, top + 3, w, 1, BARK_RAMP[1]);
}

/**
 * The crown's clumps for a broadleaf (oak, fruit): a round dome of many small leaf clusters (the owner's references) on
 * a jittered hex grid inside an ellipse, each toned by where it sits on the dome — the upper left catching the sun,
 * the lower right sinking into shade — so the crown reads as one lit ball made of little lit balls.
 */
function broadleaf(W: number, v: number): Clump[] {
  const cx = W / 2, cy = 18, rx = 19, ry = 16, step = CALM.step, out: Clump[] = [];
  for (let row = 0; row * step * .86 <= ry * 2 + 2; row++) {
    const y = cy - ry + row * step * .86;
    for (let col = -6; col <= 6; col++) {
      const x = cx + col * step + (row % 2 ? step / 2 : 0) + (hash(row, col, v + 61) - .5) * 2.2;
      const yy = y + (hash(row, col, v + 62) - .5) * 2;
      const nx = (x - cx) / rx, ny = (yy - cy) / ry, d = nx * nx + ny * ny;
      if (d > 1.02 || (d > .82 && hash(row, col, v + 63) < .35)) continue;
      const l = -.62 * nx - .72 * ny;
      out.push({ x, y: yy, r: CALM.r + hash(row, col, v + 64) * CALM.rj, tone: l > .6 ? 1 : l > -.35 ? 0 : -1 });
    }
  }
  return out;
}

/** A broadleaf tree (oak or fruit): six variants by seed. Crown 42 × 34 over a trunk; the shadow falls lower right. */
export function broadleafTree(kind: 'oak' | 'fruit', seed: number): Sprite {
  const v = ((seed % 6) + 6) % 6;
  const W = 46, CH = 38, H = 54;
  const crown = cv(W, CH), k = crown.getContext('2d')!;
  const clumps = broadleaf(W, v);
  // The crown's dark heart behind the clusters: where they part, the pockets read deep.
  for (let y = 0; y < CH; y++) for (let x = 0; x < W; x++) {
    const nx = (x + .5 - W / 2) / 19.5, ny = (y + .5 - 18) / 16.5;
    if (nx * nx + ny * ny <= .92) rect(k, x, y, 1, 1, nx * nx + ny * ny > .6 || ny > .2 ? LEAF_RAMP[0] : LEAF_RAMP[1]);
  }
  // Back to front: the higher a clump sits, the earlier it is painted (the lower ones overlap it, 3/4 view).
  for (const cl of [...clumps].sort((a, b) => a.y - b.y || a.x - b.x)) paintClump(k, cl, LEAF_RAMP, v * 17 + 5);
  if (kind === 'fruit') for (let i = 0; i < 8; i++) {
    const x = 6 + Math.floor(hash(i, v, 2) * (W - 12)), y = 8 + Math.floor(hash(i, v, 3) * 20);
    if (k.getImageData(x, y, 1, 1).data[3] === 0) continue;
    rect(k, x, y, 2, 2, '#c8342c'); rect(k, x, y, 1, 1, '#ff8a70'); rect(k, x + 1, y + 1, 1, 1, '#7a1a1a');
  }
  const body = cv(W, H), c = body.getContext('2d')!;
  trunk(c, W / 2, 30, H, 7 + (v % 2), v);
  const sp = { img: outline(body), ax: W / 2 + 1, ay: H + 1, roof: { img: outline(crown), x: -(W / 2) - 1, y: -H - 1 + 2 } } as Sprite;
  sp.shadow = { img: shadowSprite(44, 14), x: -19, y: -9 };
  return sp;
}

/** A pine: four tiers of drooping needle clumps, each tier lit on its upper left and shaded under the one above. */
export function pineTree(seed: number): Sprite {
  const v = ((seed % 6) + 6) % 6;
  const W = 36, CH = 44, H = 56;
  const crown = cv(W, CH), k = crown.getContext('2d')!;
  const cx = W / 2;
  for (let t = 0; t < 4; t++) {
    const y0 = 3 + t * 9, half = 5 + t * 3.6, rows = 12;
    for (let row = 0; row < rows; row++) {
      const w = Math.round(half * (row + 1) / rows) + (row > rows - 3 ? 1 : 0);
      for (let x = -w; x <= w; x++) {
        const u = x / Math.max(1, w), drop = row === rows - 1 && hash(x + t * 9, v, 7) < .4;
        if (drop) continue;
        let l = -.6 * u - .5 * (row / rows - .5) + (hash(x + 40, row + t * 13, v + 4) - .5) * .22;
        if (row >= rows - 2) l -= .45;
        let i = l > .55 ? 6 : l > .25 ? 5 : l > -.05 ? 4 : l > -.35 ? 3 : 2;
        if (row < 2 && t > 0) i = 1;
        rect(k, Math.round(cx + x), y0 + row, 1, 1, PINE_RAMP[Math.max(1, Math.min(6, i - (t === 0 ? 0 : 0)))]);
      }
    }
  }
  const body = cv(W, H), c = body.getContext('2d')!;
  trunk(c, cx, 40, H, 5, v + 2);
  const sp = { img: outline(body), ax: W / 2 + 1, ay: H + 1, roof: { img: outline(crown), x: -(W / 2) - 1, y: -H - 1 + 2 } } as Sprite;
  sp.shadow = { img: shadowSprite(30, 11), x: -12, y: -7 };
  return sp;
}

/** Mix two #rrggbb colours (t: 0 → a, 1 → b). */
function mixHex(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('');
}
/**
 * A clump ramp (seven tones, gap to sunlit tip) from one of td-art's four-tone leaf ramps ([base, light, shadow,
 * highlight]): the jungle's, the swamp's, a roof of leaves.
 */
export function clumpRamp(r: readonly string[]): readonly string[] {
  return [mixHex(r[2], '#08060e', .55), mixHex(r[2], '#08060e', .2), r[2], r[0], r[1], r[3], mixHex(r[3], '#fff8d8', .3)];
}
/** Clumps for a crown filling a dome `w` wide centred at cx, from y0 (top) to y1 (its lowest clump's middle). */
export function domeClumps(cx: number, w: number, y0: number, y1: number, r: number, v: number): Clump[] {
  const out: Clump[] = [], rows = Math.max(2, Math.round((y1 - y0) / (r * 1.1)) + 1);
  for (let row = 0; row < rows; row++) {
    const t = row / (rows - 1), y = y0 + (y1 - y0) * t, half = w / 2 * (.55 + .45 * Math.sin(Math.PI * Math.min(1, t * .9 + .25)));
    const n = Math.max(1, Math.round(half * 2 / (r * 1.5)));
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? cx : cx - half + r * .8 + (half * 2 - r * 1.6) * i / (n - 1);
      out.push({ x: x + (hash(row, i, v + 51) - .5) * 3, y: y + (hash(row, i, v + 52) - .5) * 3, r: r * (.85 + hash(row, i, v + 53) * .3), tone: row === 0 ? 1 : row === rows - 1 ? -1 : 0 });
    }
  }
  return out;
}
/** Paint clumps back to front (higher first, 3/4 view). */
export function paintClumps(c: Ctx, clumps: readonly Clump[], ramp: readonly string[], seed: number): void {
  for (const cl of [...clumps].sort((a, b) => a.y - b.y || a.x - b.x)) paintClump(c, cl, ramp, seed);
}
