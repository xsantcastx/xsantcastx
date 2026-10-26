/**
 * td-build.ts — the art style upgrade, stage 4 (docs/handoff/art-style.md): the large structures in the new style and
 * scale. Dungeon doors, gates, stairs, towers, ships, ruins, house roofs and the furniture inside, painted at the fine
 * figures' scale (a doorway a head over a Keeper) from one small kit: shaded ashlar courses, shaded boards with grain,
 * iron straps, deep doorways that fall away into the dark, steps that recede. Light from the upper left, colours from
 * the art bible's ramps, one dark outline, everything baked once (td-art's cache). Footprints and blocked tiles are the
 * callers' and are unchanged: only the pictures grew upward.
 */
import type { Sprite } from './td-art';
import { hash } from './td-art';
import { clumpRamp, paintClumps, shadowSprite } from './td-flora';

type Ctx = CanvasRenderingContext2D;
type Light = { x: number; y: number; r: number; warm?: boolean };

const OUTLINE = '#2a1a24';
/** The kit's ramps, darkest to lightest (the art bible's stone, basalt, wood, iron and temple, each a step or two wider). */
export const RAMP = {
  stone: ['#3e3834', '#5f5650', '#7d736b', '#9a8f86', '#b0a69c', '#c3b9ae', '#ddd4c8'],
  basalt: ['#16121a', '#231c26', '#3a3442', '#4a4352', '#5a5263', '#6b6276', '#857b90'],
  wood: ['#2a1a10', '#3f2716', '#54331b', '#6e4526', '#8a5a32', '#a06a3b', '#b77d48', '#c99a62'],
  iron: ['#141218', '#2a2630', '#3a3642', '#4a4552', '#7a7584', '#a8a4b0'],
  temple: ['#262e24', '#4b5a4a', '#6f7769', '#7e8678', '#8d9486', '#a6ad9c', '#c2c8b6'],
  moss: ['#1d3522', '#28462c', '#345a36', '#457344', '#5c8f52'],
  ember: ['#9e2e1c', '#e2552a', '#ff8a2e', '#ffd25a', '#fff2a8'],
  violet: ['#3a1e5c', '#6a3aa8', '#b06bff', '#e0c0ff'],
  rootglass: ['#17604e', '#2fb38a', '#7affd0', '#eafff6'],
  lantern: ['#6e4220', '#d98a2a', '#ffc65a', '#fff3c4'],
  cream: ['#a89a7c', '#cfc2a2', '#efdcb5', '#f6e8c8', '#fffaf0'],
} as const;
/** The dark of a doorway, deepest first. */
const DARK = ['#07040a', '#0e080c', '#160e14', '#20161c'] as const;

export function cv(w: number, h: number): HTMLCanvasElement { const el = document.createElement('canvas'); el.width = w; el.height = h; return el; }
export function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void { c.fillStyle = col; c.fillRect(x, y, w, h); }
export const px = (c: Ctx, x: number, y: number, col: string) => rect(c, x, y, 1, 1, col);
const clampI = (r: readonly string[], i: number) => r[Math.max(0, Math.min(r.length - 1, i))];

/** A 1px dark outline round everything opaque already painted. */
export function outlined(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = cv(src.width + 2, src.height + 2);
  const c = out.getContext('2d')!;
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) c.drawImage(src, dx, dy);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = OUTLINE; c.fillRect(0, 0, out.width, out.height);
  c.globalCompositeOperation = 'source-over';
  c.drawImage(src, 1, 1);
  return out;
}

/** A soft ground shadow for a structure `w` wide (cast down and to the right), as Sprite.shadow wants it. */
export function groundShadow(w: number, ax: number): NonNullable<Sprite['shadow']> {
  const sw = Math.max(8, Math.round(w * .86)), sh = Math.max(4, Math.round(sw * .26));
  return { img: shadowSprite(sw, sh), x: -Math.round(sw / 2) + 2 + (ax - Math.round(w / 2) - 1) * 0, y: -Math.round(sh * .55) };
}

// ── The kit ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface BlockOpts { bw?: number; bh?: number; moss?: number; cracks?: number; base?: number }
/**
 * Ashlar courses over (x, y, w, h): each block a lit top and left edge, a shaded bottom and right, a speckled body one
 * of two tones; the wall darkens a step toward its right (the light is upper left). `moss` 0…1 grows moss on block tops.
 */
export function blocks(c: Ctx, x: number, y: number, w: number, h: number, ramp: readonly string[], seed: number, o: BlockOpts = {}): void {
  const bw = o.bw ?? 9, bh = o.bh ?? 6, base = o.base ?? 3;
  rect(c, x, y, w, h, ramp[Math.max(0, base - 2)]);
  for (let row = 0, yy = y; yy < y + h; row++, yy += bh) {
    const off = row % 2 ? -Math.floor(bw / 2) : 0;
    for (let xx = x + off, k = 0; xx < x + w; xx += bw, k++) {
      const x0 = Math.max(x, xx), x1 = Math.min(x + w, xx + bw - 1), y1 = Math.min(y + h, yy + bh - 1);
      if (x1 <= x0 || y1 <= yy) continue;
      const fade = (x0 - x) / Math.max(1, w) > .72 ? -1 : 0;
      const t = base + fade + (hash(xx, yy, seed) > .62 ? 1 : hash(xx, yy, seed + 1) > .86 ? -1 : 0);
      rect(c, x0, yy, x1 - x0, y1 - yy, clampI(ramp, t));
      for (let i = 0; i < (x1 - x0) * (y1 - yy) / 7; i++) {
        const sx = x0 + Math.floor(hash(i, xx * 3 + yy, seed + 2) * (x1 - x0)), sy = yy + Math.floor(hash(i, xx + yy * 5, seed + 3) * (y1 - yy));
        px(c, sx, sy, clampI(ramp, t + (hash(i, sx, seed + 4) > .5 ? 1 : -1)));
      }
      rect(c, x0, yy, x1 - x0, 1, clampI(ramp, t + 2));
      if (xx >= x) rect(c, x0, yy, 1, y1 - yy, clampI(ramp, t + 1));
      rect(c, x0, y1 - 1, x1 - x0, 1, clampI(ramp, t - 1));
      if (o.cracks && hash(xx, yy, seed + 5) < o.cracks) {
        let cx = x0 + 2 + Math.floor(hash(xx, yy, seed + 6) * Math.max(1, x1 - x0 - 4)), cy = yy + 1;
        while (cy < y1 - 1) { px(c, cx, cy, ramp[Math.max(0, base - 2)]); cx += hash(cx, cy, seed) < .5 ? 1 : 0; cy++; }
      }
      if (o.moss && hash(xx, yy, seed + 7) < o.moss) {
        const mw = 2 + Math.floor(hash(xx, yy, seed + 8) * (x1 - x0 - 2));
        rect(c, x0, yy, mw, 1, RAMP.moss[3]); rect(c, x0 + 1, yy + 1, Math.max(1, mw - 2), 1, RAMP.moss[1]); px(c, x0, yy, RAMP.moss[4]);
      }
    }
  }
}

/** Boards over (x, y, w, h), running along x (`vertical` false) or y: each board a tone, a lit edge, a dark seam, grain, knots, nails. */
export function boards(c: Ctx, x: number, y: number, w: number, h: number, ramp: readonly string[], vertical: boolean, seed: number, bw = 4): void {
  const span = vertical ? w : h, len = vertical ? h : w;
  for (let k = 0, o = 0; o < span; k++, o += bw) {
    const t = 4 + (hash(k, seed, 11) > .6 ? 1 : hash(k, seed, 12) > .7 ? -1 : 0), n = Math.min(bw, span - o);
    const R = (a: number, b: number, ww: number, hh: number, col: string) => vertical ? rect(c, x + o + b, y + a, hh, ww, col) : rect(c, x + a, y + o + b, ww, hh, col);
    R(0, 0, len, n, clampI(ramp, t));
    R(0, 0, len, 1, clampI(ramp, t + 2));
    if (n > 1) R(0, n - 1, len, 1, clampI(ramp, t - 2));
    // Grain: long streaks a step darker, the odd knot with a lit rim.
    for (let g = 0; g < len / 5; g++) {
      const a = Math.floor(hash(k, g, seed + 13) * len), l = 2 + Math.floor(hash(k, g, seed + 14) * 6), b = 1 + Math.floor(hash(k, g, seed + 15) * Math.max(1, n - 2));
      if (b < n - 1) R(a, b, Math.min(l, len - a), 1, clampI(ramp, t - 1));
    }
    if (hash(k, seed, 16) > .7 && n > 2) { const a = 2 + Math.floor(hash(k, seed, 17) * Math.max(1, len - 4)); R(a, 1, 2, 1, clampI(ramp, t - 2)); R(a, 2, 1, 1, clampI(ramp, t + 1)); }
  }
}

/** An iron strap across (x, y, w): a lit top, rivets. */
export function strap(c: Ctx, x: number, y: number, w: number, h = 2): void {
  rect(c, x, y, w, h, RAMP.iron[2]); rect(c, x, y, w, 1, RAMP.iron[4]);
  for (let i = x + 1; i < x + w - 1; i += 4) { px(c, i, y + h - 1, RAMP.iron[5]); }
}

/**
 * A doorway (x, y, w, h) going into the dark: an arch top when `arch`, bands of dark deepening upward and inward, a
 * faint lit inner jamb on the left. `steps` paints that many steps going down, each narrower and darker.
 */
export function doorway(c: Ctx, x: number, y: number, w: number, h: number, arch: boolean, steps = 0, stepRamp: readonly string[] = RAMP.stone): void {
  const r = Math.floor(w / 2);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    if (arch && yy < r) { const dx = xx + .5 - w / 2, dy = r - yy - .5; if (dx * dx + dy * dy > r * r) continue; }
    const depth = Math.min(3, Math.floor((h - yy) / (h / 3.2)));
    const edge = Math.min(xx, w - 1 - xx);
    rect(c, x + xx, y + yy, 1, 1, DARK[Math.max(0, 3 - depth - (edge > 2 ? 1 : 0))]);
  }
  // The inner jamb on the lit side catches a little light.
  for (let yy = arch ? r : 0; yy < h; yy++) px(c, x + 1, y + yy, DARK[3]);
  for (let i = 0; i < steps; i++) {
    const sy = y + h - 2 - i * 4, inset = i * 2, sw = w - 2 - inset * 2;
    if (sw <= 2 || sy < y + 2) break;
    const t = Math.max(0, 4 - i);
    rect(c, x + 1 + inset, sy - 2, sw, 3, clampI(stepRamp, t - 1)); rect(c, x + 1 + inset, sy - 2, sw, 1, clampI(stepRamp, t + 1));
    rect(c, x + 1 + inset + sw - 1, sy - 2, 1, 3, clampI(stepRamp, t - 2));
  }
}

/** A column (x, y, w, h) shaded round: lit left, dark right, a capital and a base. */
export function column(c: Ctx, x: number, y: number, w: number, h: number, ramp: readonly string[], seed: number, flutes = true): void {
  for (let i = 0; i < w; i++) {
    const u = i / Math.max(1, w - 1), t = u < .2 ? 5 : u < .45 ? 4 : u < .75 ? 3 : 2;
    rect(c, x + i, y, 1, h, clampI(ramp, t));
    if (flutes && i % 3 === 2 && i < w - 1) rect(c, x + i, y + 3, 1, h - 6, clampI(ramp, t - 1));
  }
  rect(c, x - 1, y, w + 2, 3, ramp[4]); rect(c, x - 1, y, w + 2, 1, ramp[6] ?? ramp[5]); rect(c, x - 1, y + 2, w + 2, 1, ramp[2]);
  rect(c, x - 1, y + h - 3, w + 2, 3, ramp[3]); rect(c, x - 1, y + h - 3, w + 2, 1, ramp[5]);
  if (hash(x, y, seed) > .5) for (let i = 0; i < 3; i++) px(c, x + 1 + Math.floor(hash(i, x, seed) * (w - 2)), y + 5 + Math.floor(hash(i, y, seed) * (h - 10)), ramp[1]);
}

/** Lit flame over (cx, base): a tongue of the ember ramp, `h` tall. */
export function flame(c: Ctx, cx: number, base: number, h: number, ramp: readonly string[] = RAMP.ember, seed = 0): void {
  for (let y = 0; y < h; y++) {
    const u = y / h, half = Math.max(0, Math.round((1 - u) * (h * .32) + (hash(y, seed, 3) > .6 ? 1 : 0) - (u > .8 ? 1 : 0)));
    for (let x = -half; x <= half; x++) {
      const d = Math.abs(x) / Math.max(1, half);
      const i = d > .75 ? 0 : d > .45 ? 1 : u > .55 ? 2 : u > .25 ? 3 : 2;
      px(c, cx + x, base - y, clampI(ramp, i + (y < 2 ? 1 : 0)));
    }
  }
  px(c, cx, base - h, ramp[1]);
}

/** A stone step band, (x, y, w) and `n` steps of `sh` px rising toward y (the front of a plinth). */
export function plinth(c: Ctx, x: number, y: number, w: number, n: number, sh: number, ramp: readonly string[]): void {
  for (let i = 0; i < n; i++) {
    const yy = y - (i + 1) * sh, inset = i * 2;
    rect(c, x + inset, yy, w - inset * 2, sh, ramp[3]); rect(c, x + inset, yy, w - inset * 2, 1, ramp[5]); rect(c, x + inset, yy + sh - 1, w - inset * 2, 1, ramp[1]);
    rect(c, x + inset + w - inset * 2 - 3, yy + 1, 3, sh - 2, ramp[2]);
  }
}

function sprite(img: HTMLCanvasElement, W: number, H: number, ax: number, extra: Partial<Sprite> = {}): Sprite {
  return { img: outlined(img), ax: ax + 1, ay: H + 1, shadow: groundShadow(W, ax), ...extra };
}

// ── Dungeon doors and gates ──────────────────────────────────────────────────────────────────────────────────────

/** The Ashen Crypt's front (and the Barrow's way down): a basalt mausoleum, two columns, a skull pediment, steps down into the dark. */
export function paintCryptDoor(): Sprite {
  const W = 48, H = 62, img = cv(W, H), c = img.getContext('2d')!;
  // The plinth, the body behind the columns, the pediment.
  blocks(c, 4, 18, 40, 38, RAMP.basalt, 31, { bw: 8, bh: 5, cracks: .2, moss: .06 });
  for (let y = 0; y < 12; y++) { const half = Math.round(4 + (y / 11) * 20); rect(c, 24 - half, 6 + y, half * 2, 1, y % 3 === 0 ? RAMP.basalt[5] : RAMP.basalt[3 + (y < 6 ? 1 : 0)]); }
  rect(c, 2, 17, 44, 3, RAMP.basalt[4]); rect(c, 2, 17, 44, 1, RAMP.basalt[6]); rect(c, 2, 19, 44, 1, RAMP.basalt[1]);
  for (let x = 4; x < 44; x += 3) px(c, x, 20, RAMP.basalt[2]);
  // The skull carved in the pediment.
  rect(c, 20, 9, 8, 6, RAMP.cream[1]); rect(c, 21, 8, 6, 1, RAMP.cream[2]); rect(c, 20, 9, 8, 1, RAMP.cream[3]); rect(c, 21, 15, 6, 2, RAMP.cream[0]);
  rect(c, 21, 11, 2, 2, DARK[1]); rect(c, 25, 11, 2, 2, DARK[1]); px(c, 23, 13, DARK[2]); px(c, 24, 13, DARK[2]);
  for (let x = 21; x < 27; x += 2) px(c, x, 16, DARK[2]);
  // Columns either side, a violet grave-light burning on each capital.
  column(c, 6, 21, 6, 33, RAMP.basalt, 3); column(c, 36, 21, 6, 33, RAMP.basalt, 4);
  for (const x of [9, 39]) { rect(c, x - 2, 18, 5, 2, RAMP.iron[3]); flame(c, x, 17, 6, RAMP.violet, x); }
  // The doorway, steps going down.
  rect(c, 14, 22, 20, 34, RAMP.basalt[2]); rect(c, 14, 22, 20, 1, RAMP.basalt[5]);
  doorway(c, 16, 24, 16, 32, true, 5, RAMP.stone);
  plinth(c, 0, H, W, 2, 3, RAMP.stone);
  return sprite(img, W, H, W / 2, { lights: [{ x: -15, y: -46, r: 18, warm: false }, { x: 15, y: -46, r: 18, warm: false }] });
}

/** A cave mouth in a rock outcrop: round shaded boulders, a timber-propped arch into the dark, a lantern on the post. */
export function paintCaveMouth(): Sprite {
  const W = 44, H = 48, img = cv(W, H), c = img.getContext('2d')!;
  const ramp = clumpRamp(['#4a4352', '#5a5263', '#3a3442', '#6b6276']);
  paintClumps(c, [
    { x: 10, y: 34, r: 10, tone: 0 }, { x: 34, y: 34, r: 10, tone: -1 }, { x: 22, y: 16, r: 12, tone: 1 }, { x: 9, y: 22, r: 8, tone: 1 }, { x: 35, y: 21, r: 8, tone: 0 },
    { x: 22, y: 36, r: 11, tone: 0 }, { x: 4, y: 42, r: 5, tone: -1 }, { x: 40, y: 42, r: 5, tone: -1 },
  ], ramp, 17);
  // Moss on the lit tops, a trickle of dust down the face.
  for (const [x, y, w] of [[15, 6, 8], [5, 15, 5], [31, 14, 5]] as const) { rect(c, x, y, w, 1, RAMP.moss[3]); rect(c, x + 1, y + 1, w - 2, 1, RAMP.moss[1]); }
  doorway(c, 12, 20, 20, 28, true, 0);
  // Timber props: two posts and a lintel with grain, a wedge.
  for (const x of [10, 31]) { rect(c, x, 22, 3, 26, RAMP.wood[3]); rect(c, x, 22, 1, 26, RAMP.wood[5]); rect(c, x + 2, 22, 1, 26, RAMP.wood[1]); for (let y = 26; y < 46; y += 6) px(c, x + 1, y, RAMP.wood[2]); }
  boards(c, 8, 18, 28, 4, RAMP.wood, false, 5, 4); rect(c, 8, 22, 28, 1, RAMP.wood[1]);
  // The lantern on the right post.
  rect(c, 34, 25, 1, 3, RAMP.iron[2]); rect(c, 33, 28, 5, 1, RAMP.iron[1]); rect(c, 33, 29, 5, 5, RAMP.lantern[1]); rect(c, 34, 30, 2, 2, RAMP.lantern[3]); rect(c, 33, 34, 5, 1, RAMP.iron[1]);
  return sprite(img, W, H, W / 2, { lights: [{ x: 13, y: -17, r: 22, warm: true }] });
}

/** A Barrow door in the rock: stone jambs, iron-banded planks, the keyhole stamped with its number; open, the door stands back. */
export function paintBarrowDoor(open: boolean, n = 1, sealed = false): Sprite {
  const W = 18, H = 40, img = cv(W, H), c = img.getContext('2d')!;
  blocks(c, 0, 0, W, H, RAMP.basalt, 41 + n, { bw: 6, bh: 5, cracks: .15 });
  rect(c, 0, 0, W, 4, RAMP.basalt[4]); rect(c, 0, 0, W, 1, RAMP.basalt[6]);
  doorway(c, 3, 6, 12, 34, true, 0);
  if (open) {
    boards(c, 3, 9, 3, 31, RAMP.wood, true, 7, 3); strap(c, 3, 14, 3); strap(c, 3, 31, 3);
  } else {
    // The door fills the arch: planks, two straps and a hinge plate, the keyhole plate and its number.
    for (let y = 6; y < 40; y++) for (let x = 3; x < 15; x++) { const dx = x + .5 - 9, dy = 12 - (y - 6) - .5; if (y - 6 < 6 && dx * dx + dy * dy > 36) continue; }
    c.save(); c.beginPath(); c.rect(3, 12, 12, 28); c.arc(9, 12, 6, Math.PI, 0); c.clip();
    boards(c, 3, 6, 12, 34, RAMP.wood, true, 9 + n, 3); c.restore();
    strap(c, 3, 13, 12); strap(c, 3, 32, 12);
    rect(c, 7, 20, 4, 6, RAMP.iron[3]); rect(c, 7, 20, 4, 1, RAMP.iron[5]); rect(c, 8, 22, 2, 2, DARK[0]); px(c, 9, 24, DARK[0]);
    // Stamped number: n pips over the keyhole plate.
    for (let i = 0; i < n; i++) px(c, 9 - Math.floor(n / 2) + i, 18, RAMP.cream[3]);
    if (sealed) {
      // No key yet: two chains crossed over the planks, a padlock where they meet.
      for (let i = 0; i < 12; i++) { px(c, 3 + i, 15 + i * 1.4 | 0, i % 2 ? RAMP.iron[4] : RAMP.iron[2]); px(c, 14 - i, 15 + i * 1.4 | 0, i % 2 ? RAMP.iron[4] : RAMP.iron[2]); }
      rect(c, 7, 26, 4, 4, RAMP.iron[3]); rect(c, 7, 26, 4, 1, RAMP.iron[5]); rect(c, 8, 24, 2, 2, RAMP.iron[2]); px(c, 9, 28, DARK[0]);
    }
  }
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1 };
}

/** The Forge of the Four's gate: a ruined basalt smithy front, the broken lintel, four cold anvil sigils, braziers that still burn. */
export function paintForgeGate(): Sprite {
  const W = 52, H = 60, img = cv(W, H), c = img.getContext('2d')!;
  blocks(c, 6, 14, 40, 44, RAMP.basalt, 51, { bw: 8, bh: 5, cracks: .25 });
  // The broken lintel: the right corner fallen, its stones at the foot.
  rect(c, 4, 10, 34, 6, RAMP.basalt[4]); rect(c, 4, 10, 34, 1, RAMP.basalt[6]); rect(c, 4, 15, 34, 1, RAMP.basalt[1]);
  rect(c, 38, 12, 4, 2, RAMP.basalt[3]); rect(c, 4, 4, 14, 7, RAMP.basalt[3]); rect(c, 4, 4, 14, 1, RAMP.basalt[5]);
  for (let i = 0; i < 4; i++) { const x = 10 + i * 8; rect(c, x, 11, 6, 2, RAMP.iron[4]); rect(c, x + 2, 13, 2, 1, RAMP.iron[2]); px(c, x, 11, RAMP.iron[5]); }
  rect(c, 16, 18, 22, 40, RAMP.basalt[2]); rect(c, 16, 18, 22, 1, RAMP.basalt[5]);
  doorway(c, 18, 20, 18, 38, true, 6, RAMP.stone);
  for (const [x, y] of [[40, 54], [44, 56], [38, 57]] as const) { rect(c, x, y, 4, 3, RAMP.basalt[3]); rect(c, x, y, 4, 1, RAMP.basalt[5]); }
  // Braziers either side on stone posts.
  for (const x of [3, 49]) {
    rect(c, x - 2, 38, 5, 22, RAMP.stone[3]); rect(c, x - 2, 38, 1, 22, RAMP.stone[5]); rect(c, x + 2, 38, 1, 22, RAMP.stone[1]);
    rect(c, x - 3, 34, 7, 4, RAMP.iron[2]); rect(c, x - 3, 34, 7, 1, RAMP.iron[4]); flame(c, x, 33, 8, RAMP.ember, x);
  }
  return sprite(img, W, H, W / 2, { lights: [{ x: -23, y: -28, r: 22, warm: true }, { x: 23, y: -28, r: 22, warm: true }] });
}

/** The Overgrown Temple's gate: a stepped front of mossy temple stone, a carved face with rootglass eyes, roots over all of it. */
export function paintTempleGate(): Sprite {
  const W = 74, H = 72, img = cv(W, H), c = img.getContext('2d')!;
  for (const [x, y, w] of [[0, 46, 74], [5, 32, 64], [12, 18, 50], [21, 6, 32]] as const) {
    blocks(c, x, y, w, H - y, RAMP.temple, 61 + y, { bw: 9, bh: 5, moss: .3, cracks: .15 });
    rect(c, x, y, w, 2, RAMP.temple[5]); rect(c, x, y, w, 1, RAMP.temple[6]);
  }
  // The carved face over the door.
  rect(c, 27, 9, 20, 15, RAMP.temple[2]); rect(c, 27, 9, 20, 1, RAMP.temple[4]);
  rect(c, 29, 12, 5, 4, DARK[1]); rect(c, 40, 12, 5, 4, DARK[1]); rect(c, 30, 13, 3, 2, RAMP.rootglass[2]); rect(c, 41, 13, 3, 2, RAMP.rootglass[2]);
  px(c, 30, 13, RAMP.rootglass[3]); px(c, 41, 13, RAMP.rootglass[3]); rect(c, 35, 17, 4, 2, RAMP.temple[1]); rect(c, 31, 20, 12, 2, DARK[2]);
  rect(c, 24, 26, 26, 46, RAMP.temple[1]);
  doorway(c, 26, 28, 22, 44, true, 6, RAMP.temple);
  // Roots and vines down the steps, rootglass lamps grown in the stone.
  for (const [x, y, len] of [[7, 32, 22], [15, 18, 30], [57, 32, 26], [64, 46, 16], [36, 6, 6], [22, 20, 14]] as const) {
    for (let i = 0; i < len; i++) { px(c, x + Math.round(Math.sin(i * .5 + x) * .8), y + i, i % 4 ? RAMP.moss[2] : RAMP.moss[4]); if (i % 5 === 2) px(c, x + 1, y + i, RAMP.moss[3]); }
  }
  for (const x of [16, 57]) { rect(c, x, 36, 4, 6, RAMP.rootglass[1]); rect(c, x + 1, 37, 2, 4, RAMP.rootglass[2]); px(c, x + 1, 37, RAMP.rootglass[3]); }
  return sprite(img, W, H, W / 2 - 1, { lights: [{ x: -18, y: -33, r: 18 }, { x: 22, y: -33, r: 18 }, { x: 0, y: -58, r: 10 }] });
}

// ── Stairs and ladders ───────────────────────────────────────────────────────────────────────────────────────────

/** Stairs cut down into the rock: a stone rim, side walls, steps that narrow and darken as they go down. */
export function paintStairsDown(): Sprite {
  const W = 22, H = 22, img = cv(W, H), c = img.getContext('2d')!;
  blocks(c, 0, 0, W, H, RAMP.basalt, 71, { bw: 6, bh: 4 });
  rect(c, 3, 3, 16, 17, DARK[0]);
  for (let i = 0; i < 5; i++) {
    const y = 3 + i * 3, inset = Math.min(4, i), t = 5 - i;
    rect(c, 3 + inset, y, 16 - inset * 2, 3, clampI(RAMP.stone, t - 1)); rect(c, 3 + inset, y, 16 - inset * 2, 1, clampI(RAMP.stone, t + 1));
  }
  rect(c, 3, 3, 16, 1, 'rgba(0,0,0,.4)');
  rect(c, 2, 2, 18, 1, RAMP.basalt[6]); rect(c, 2, 2, 1, 18, RAMP.basalt[5]); rect(c, 19, 3, 1, 17, RAMP.basalt[1]);
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1 };
}
/** Stairs going up out of a floor toward the daylight: side walls, steps lit more the higher they go. */
export function paintStairsUp(): Sprite {
  const W = 22, H = 32, img = cv(W, H), c = img.getContext('2d')!;
  rect(c, 3, 0, 16, H, '#e9dcae'); rect(c, 5, 0, 12, 6, '#fff3c9');
  for (let i = 0; i < 8; i++) {
    const y = H - 4 - i * 4, t = Math.min(6, 2 + Math.floor(i / 2));
    rect(c, 3, y, 16, 4, clampI(RAMP.stone, t)); rect(c, 3, y, 16, 1, clampI(RAMP.stone, t + 1)); rect(c, 3, y + 3, 16, 1, clampI(RAMP.stone, t - 2));
  }
  column(c, 0, 0, 3, H, RAMP.basalt, 5, false); column(c, 19, 0, 3, H, RAMP.basalt, 6, false);
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1, lights: [{ x: 0, y: -22, r: 30 }] };
}
/** A ladder up out of a dungeon floor: rails with grain and rungs against a shaft of daylight. */
export function paintLadderUp(): Sprite {
  const W = 20, H = 44, img = cv(W, H), c = img.getContext('2d')!;
  for (let y = 0; y < 34; y++) { const a = y < 8 ? 3 : y < 20 ? 2 : 1; rect(c, 3, y, 14, 1, ['#c9bb8e', '#e9dcae', '#f6ebc4', '#fff3c9'][a]); }
  for (let y = 0; y < 34; y += 2) px(c, 3 + (y % 4), y + 34 > 60 ? 0 : y, '#fff8dc');
  for (const x of [4, 14]) { rect(c, x, 0, 3, H, RAMP.wood[4]); rect(c, x, 0, 1, H, RAMP.wood[6]); rect(c, x + 2, 0, 1, H, RAMP.wood[2]); }
  for (let y = 4; y < H - 2; y += 6) { rect(c, 7, y, 7, 2, RAMP.wood[5]); rect(c, 7, y, 7, 1, RAMP.wood[7]); rect(c, 7, y + 2, 7, 1, 'rgba(0,0,0,.25)'); }
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1, lights: [{ x: 0, y: -26, r: 34, warm: false }] };
}
/** The mine head into the Ember Delve: a timber frame and a winch over a dark shaft, a lantern on the post. */
export function paintMineShaft(): Sprite {
  const W = 40, H = 46, img = cv(W, H), c = img.getContext('2d')!;
  rect(c, 6, 28, 28, 18, RAMP.stone[2]); blocks(c, 6, 28, 28, 6, RAMP.stone, 81, { bw: 7, bh: 3 });
  rect(c, 9, 32, 22, 14, DARK[0]); rect(c, 9, 32, 22, 2, DARK[2]);
  for (let y = 36; y < 46; y += 4) { rect(c, 10, y, 20, 1, RAMP.wood[3]); px(c, 10, y, RAMP.wood[5]); }
  for (const x of [4, 33]) { rect(c, x, 6, 4, 40, RAMP.wood[3]); rect(c, x, 6, 1, 40, RAMP.wood[5]); rect(c, x + 3, 6, 1, 40, RAMP.wood[1]); }
  boards(c, 2, 4, 36, 4, RAMP.wood, false, 13, 4);
  for (let i = 0; i < 12; i++) { px(c, 7 + i, 8 + i, RAMP.wood[2]); px(c, 32 - i, 8 + i, RAMP.wood[2]); }
  // The winch drum and its rope down the shaft.
  rect(c, 15, 10, 10, 5, RAMP.wood[4]); rect(c, 15, 10, 10, 1, RAMP.wood[6]); rect(c, 15, 14, 10, 1, RAMP.wood[1]);
  for (let x = 16; x < 25; x += 2) px(c, x, 12, '#c9a46a');
  rect(c, 20, 15, 1, 22, '#c9a46a');
  rect(c, 36, 16, 4, 6, RAMP.lantern[1]); rect(c, 37, 17, 2, 3, RAMP.lantern[3]); rect(c, 36, 15, 4, 1, RAMP.iron[1]);
  return sprite(img, W, H, W / 2 - 2, { lights: [{ x: 18, y: -28, r: 22 }] });
}

// ── Towers and ruins ─────────────────────────────────────────────────────────────────────────────────────────────

/** A round basalt tower of three floors: courses shaded round, lit arched windows, a door at its foot, a shingled slate cone. */
export function paintTower(): Sprite {
  const W = 50, cone = 36, storey = 28, wallH = storey * 3, H = cone + wallH, img = cv(W, H), c = img.getContext('2d')!;
  const lights: Light[] = [];
  blocks(c, 3, cone, W - 6, wallH, RAMP.basalt, 91, { bw: 7, bh: 4, moss: .04 });
  // Round it: lighter toward the lit left third, darker on the right, a cos profile in dithered steps.
  for (let x = 3; x < W - 3; x++) {
    const u = (x - 3) / (W - 7), s = Math.cos((u - .32) * Math.PI);
    for (let y = cone; y < H; y++) if ((x + y) % 2 === 0 || s < .2) { if (s < .35) rect(c, x, y, 1, 1, s < 0 ? 'rgba(10,6,16,.34)' : 'rgba(10,6,16,.16)'); else if (s > .92 && (x + y) % 4 === 0) rect(c, x, y, 1, 1, 'rgba(255,240,220,.08)'); }
  }
  for (let f = 0; f < 3; f++) {
    const fy = cone + f * storey;
    rect(c, 1, fy, W - 2, 3, RAMP.stone[3]); rect(c, 1, fy, W - 2, 1, RAMP.stone[5]); rect(c, 1, fy + 3, W - 2, 1, 'rgba(0,0,0,.35)'); rect(c, W - 10, fy, 9, 3, RAMP.stone[2]);
    if (f < 2) for (const x of [12, 31]) {
      rect(c, x - 2, fy + 7, 10, 14, RAMP.stone[3]); rect(c, x - 2, fy + 7, 10, 1, RAMP.stone[5]);
      doorway(c, x - 1, fy + 8, 8, 12, true, 0);
      rect(c, x, fy + 11, 6, 8, '#ffe39b'); rect(c, x + 1, fy + 10, 4, 1, '#ffe39b'); rect(c, x, fy + 11, 2, 3, '#fff6cc'); rect(c, x + 3, fy + 10, 1, 9, RAMP.iron[2]); rect(c, x, fy + 15, 6, 1, RAMP.iron[2]);
      rect(c, x - 2, fy + 20, 10, 2, RAMP.stone[4]); rect(c, x - 2, fy + 20, 10, 1, RAMP.stone[6]);
      lights.push({ x: x + 3 - W / 2, y: fy + 15 - H, r: 12, warm: true });
    }
  }
  const dy = cone + storey * 2;
  rect(c, 16, dy + 4, 18, 24, RAMP.stone[3]); rect(c, 16, dy + 4, 18, 1, RAMP.stone[5]);
  c.save(); c.beginPath(); c.rect(18, dy + 12, 14, 16); c.arc(25, dy + 12, 7, Math.PI, 0); c.clip(); boards(c, 18, dy + 5, 14, 23, RAMP.wood, true, 3, 3); c.restore();
  strap(c, 18, dy + 12, 14); strap(c, 18, dy + 22, 14); rect(c, 28, dy + 16, 2, 2, '#e6c35a');
  rect(c, 8, dy + 10, 5, 6, RAMP.lantern[1]); rect(c, 9, dy + 11, 2, 2, RAMP.lantern[3]); rect(c, 8, dy + 9, 5, 1, RAMP.iron[1]); lights.push({ x: 10 - W / 2, y: dy + 12 - H, r: 16, warm: true });
  paintCone(c, W / 2, 6, cone - 4, W / 2, RAMP.basalt.slice(2) as unknown as string[], 5);
  rect(c, W / 2 - 1, 0, 2, 7, RAMP.wood[2]); rect(c, W / 2 - 2, 0, 4, 3, RAMP.ember[3]); px(c, W / 2 - 1, 0, RAMP.ember[4]);
  lights.push({ x: 0, y: -H + 2, r: 10, warm: true });
  return sprite(img, W, H, W / 2, { lights });
}
/** A shingled cone (cx, y0, h, half-width at its eave), shaded round and lit on its left. */
export function paintCone(c: Ctx, cx: number, y0: number, h: number, half: number, ramp: readonly string[], seed: number): void {
  for (let y = 0; y < h; y++) {
    const hw = Math.round(3 + (half - 3) * (y / (h - 1)));
    for (let x = -hw; x < hw; x++) {
      const u = (x + hw) / (hw * 2), row = Math.floor(y / 3), col = Math.floor((x + hw + (row % 2) * 2) / 4);
      let t = u < .22 ? 3 : u < .5 ? 2 : u < .78 ? 1 : 0;
      if (hash(col, row, seed) > .75) t = Math.max(0, t - 1);
      if (y % 3 === 2) t = Math.max(0, t - 1);
      else if (y % 3 === 0 && u < .5) t = Math.min(ramp.length - 1, t + 1);
      px(c, Math.round(cx + x), y0 + y, ramp[t]);
    }
  }
  rect(c, cx - half, y0 + h - 1, half * 2, 1, ramp[0]);
}

/** A broken wall of an old building: shaded courses, a ragged broken top, moss and ivy in its cracks, rubble at its foot. */
export function paintRuinWall(v: number): Sprite {
  const W = 48, H = 40, img = cv(W, H), c = img.getContext('2d')!;
  const tops = [[0, 10, 9], [9, 2, 10], [19, 14, 8], [27, 6, 11], [38, 12, 10]].map(([x, t, w]) => [x, t + ((v * 5 + x) % 9), w]);
  for (const [x, t, w] of tops) {
    c.save(); c.beginPath(); c.rect(x, t, w, H - 4 - t); c.clip();
    blocks(c, 0, 0, W, H, RAMP.stone, 101 + v, { bw: 8, bh: 5, moss: .2, cracks: .3 }); c.restore();
    // The broken top: jagged, lit where it faces up.
    for (let i = 0; i < w; i++) { const d = Math.floor(hash(x + i, v, 7) * 3); rect(c, x + i, t, 1, d, 'rgba(0,0,0,0)'); c.clearRect(x + i, t, 1, d); px(c, x + i, t + d, RAMP.stone[6]); }
  }
  rect(c, W - 9, 0, 9, H, 'rgba(10,6,16,.16)');
  // Ivy down one face.
  for (let i = 0; i < 14; i++) { const x = 6 + v * 13 + Math.round(Math.sin(i * .7) * 1.5), y = 14 + i; px(c, x, y, i % 3 ? RAMP.moss[2] : RAMP.moss[4]); if (i % 3 === 1) { px(c, x - 1, y, RAMP.moss[3]); px(c, x + 1, y + 1, RAMP.moss[1]); } }
  // Rubble at the foot.
  for (let i = 0; i < 7; i++) { const x = Math.floor(hash(i, v, 9) * (W - 4)), w = 2 + Math.floor(hash(i, v, 10) * 3); rect(c, x, H - 4, w, 3, RAMP.stone[3]); rect(c, x, H - 4, w, 1, RAMP.stone[5]); rect(c, x, H - 2, w, 1, RAMP.stone[1]); }
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1, shadow: groundShadow(W, W / 2) };
}

// ── Ships ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ShipLook { hull: readonly string[]; sail: readonly string[]; stripe: readonly string[]; flag: string; lantern?: boolean; studs?: string }
/**
 * A sailing ship at the pier, seen in 3/4: a curved hull of shaded strakes (bow to the left), a rail and a stern cabin,
 * a mast and yard, a billowing sail shaded round with the realm's stripe, rigging, a flag, foam at the waterline.
 */
export function paintShip(look: ShipLook): Sprite {
  const W = 60, H = 62, img = cv(W, H), c = img.getContext('2d')!;
  const hull = look.hull, base = 56;
  // The hull: each row a little narrower toward the keel, the bow rising at the left, the stern at the right.
  for (let y = 0; y < 13; y++) {
    const inset = Math.round(Math.pow(y / 12, 1.6) * 9), x0 = 3 + inset + (y < 3 ? 0 : 0), x1 = W - 3 - Math.round(inset * .7);
    const t = y < 2 ? 5 : y % 3 === 2 ? 2 : y < 7 ? 4 : 3;
    rect(c, x0, base - 13 + y, x1 - x0, 1, clampI(hull, t - (y > 9 ? 1 : 0)));
    px(c, x0, base - 13 + y, clampI(hull, t + 1)); px(c, x1 - 1, base - 13 + y, clampI(hull, t - 2));
  }
  // The bow's prow and the stern's high cabin.
  for (let i = 0; i < 6; i++) rect(c, 1 + Math.floor(i / 2), base - 19 + i, 6 - Math.floor(i / 2), 1, clampI(hull, 4));
  rect(c, 1, base - 20, 3, 1, clampI(hull, 6));
  rect(c, W - 16, base - 22, 14, 10, clampI(hull, 3)); rect(c, W - 16, base - 22, 14, 1, clampI(hull, 6)); rect(c, W - 16, base - 21, 1, 9, clampI(hull, 5));
  rect(c, W - 12, base - 19, 3, 3, '#ffe39b'); rect(c, W - 7, base - 19, 3, 3, '#ffe39b'); px(c, W - 12, base - 19, '#fff6cc');
  // The rail and the studs along the strake.
  rect(c, 4, base - 15, W - 18, 2, clampI(hull, 5)); rect(c, 4, base - 15, W - 18, 1, clampI(hull, 6));
  for (let x = 8; x < W - 16; x += 4) px(c, x, base - 14, clampI(hull, 2));
  for (let x = 10; x < W - 10; x += 7) { rect(c, x, base - 9, 2, 2, look.studs ?? clampI(hull, 6)); px(c, x, base - 9, '#ffffff55'); }
  // Mast and yard.
  const mx = 27;
  rect(c, mx, 4, 3, base - 16, RAMP.wood[3]); rect(c, mx, 4, 1, base - 16, RAMP.wood[5]); rect(c, mx + 2, 4, 1, base - 16, RAMP.wood[1]);
  rect(c, 8, 9, 42, 2, RAMP.wood[4]); rect(c, 8, 9, 42, 1, RAMP.wood[6]);
  // The sail, billowing: shaded by a curve across it, lit on its left, the stripe through its middle, a seam or two.
  const sail = look.sail, st = look.stripe;
  for (let y = 11; y < 38; y++) {
    const bow = Math.round(Math.sin(((y - 11) / 27) * Math.PI) * 3), x0 = 9 - bow, x1 = 49 + bow;
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / (x1 - x0), s = Math.sin(u * Math.PI);
      let t = u < .18 ? 3 : s > .8 ? 2 : u > .8 ? 0 : 1;
      if ((y - 11) / 27 > .85) t = Math.max(0, t - 1);
      const band = y >= 21 && y < 26;
      if (x === mx || x === mx + 1 || x === mx + 2) continue;
      px(c, x, y, band ? clampI(st, t) : clampI(sail, t));
      if (!band && (x - x0) % 9 === 0 && y % 2) px(c, x, y, clampI(sail, t - 1));
    }
  }
  rect(c, 9, 38, 40, 1, clampI(sail, 0));
  // Rigging: lines from the mast-head to bow and stern.
  for (let i = 0; i <= 22; i++) { px(c, Math.round(mx - i * 1.05), Math.round(5 + i * 1.6), '#2a2026'); px(c, Math.round(mx + 2 + i * 1.1), Math.round(5 + i * 1.55), '#2a2026'); }
  // A flag at the mast-head.
  rect(c, mx + 3, 1, 7, 3, look.flag); rect(c, mx + 3, 1, 7, 1, '#ffffff66'); rect(c, mx + 9, 2, 2, 1, look.flag); rect(c, mx, 0, 3, 2, RAMP.wood[2]);
  if (look.lantern) { rect(c, 2, base - 26, 4, 5, RAMP.lantern[1]); rect(c, 3, base - 25, 2, 2, RAMP.lantern[3]); rect(c, 2, base - 27, 4, 1, '#1c1418'); }
  // Foam at the waterline (it sits in the water, under the anchor).
  for (let x = 12; x < W - 10; x++) if (hash(x, 3, 5) > .35) px(c, x, base, hash(x, 4, 5) > .5 ? '#eef8ff' : '#a6d4f0');
  for (const [x, y] of [[9, base - 2], [10, base - 1], [11, base], [7, base - 3]] as const) px(c, x, y, '#eef8ff');
  // Its reflection: a dark wobble under the hull.
  for (let y = base + 2; y < base + 6; y++) for (let x = 8 + (y - base) * 3; x < W - 8 - (y - base) * 3; x++) if (hash(x, y, 9) > .45) px(c, x + (y % 2), y, 'rgba(10,20,40,.22)');
  return { img: outlined(img), ax: W / 2 + 1, ay: base + 2 };
}

// ── House roofs ──────────────────────────────────────────────────────────────────────────────────────────────────

export type RoofKind = 'red' | 'slate' | 'thatch' | 'leaf' | 'gloam';
/**
 * A 3/4 gable roof `W`×`H`: the far slope (above the ridge) faces the sky and is lit, the near slope falls toward the
 * eave and darkens; shingles laid in courses, each with a lit top and a dark lip, clay tiles scalloped, slate cut square,
 * thatch combed; moss on old roofs; bargeboards at both ends, a ridge cap, a fascia under the eave.
 */
export function paintRoof(c: Ctx, ox: number, oy: number, W: number, H: number, kind: RoofKind, ramp: readonly string[], seed: number): void {
  // ramp: [body, light, dark, highlight] (td-art's roof palettes); widen it to six steps.
  const R6 = [mix(ramp[2], '#140c1c', .45), ramp[2], ramp[0], mix(ramp[0], ramp[1], .5), ramp[1], ramp[3]];
  const ridge = Math.floor(H * .38);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const far = y < ridge, v = far ? y / ridge : (y - ridge) / (H - ridge);
    let t = far ? 4 - (v < .3 ? 1 : 0) : v < .25 ? 3 : v < .7 ? 2 : 1;
    if (x / W > .82) t--;
    if (x / W < .12) t++;
    let sh: number;
    if (kind === 'thatch') {
      const row = Math.floor(y / 5), strand = hash(x, row, seed) > .55 ? 1 : hash(x, row, seed + 1) > .8 ? -1 : 0;
      sh = t + strand + (y % 5 === 4 ? -1 : 0) + (y % 5 === 0 ? 1 : 0);
    } else {
      const ch = kind === 'slate' ? 4 : 4, cw = kind === 'slate' ? 7 : 5;
      const row = Math.floor(y / ch), off = row % 2 ? Math.floor(cw / 2) : 0, col = Math.floor((x + off) / cw), lx = (x + off) % cw, ly = y % ch;
      sh = t + (hash(col, row, seed) > .7 ? 1 : hash(col, row, seed + 2) > .8 ? -1 : 0);
      if (ly === ch - 1) sh -= 2;
      else if (ly === 0) sh += 1;
      if (kind === 'red' || kind === 'leaf' || kind === 'gloam') { if (ly === ch - 2 && (lx === 0 || lx === cw - 1)) sh -= 2; }
      else if (lx === cw - 1) sh -= 1;
    }
    rect(c, ox + x, oy + y, 1, 1, R6[Math.max(0, Math.min(5, sh))]);
  }
  // Moss on old roofs (and leaf roofs are moss all over at the edges).
  const mossy = kind === 'thatch' ? 0 : kind === 'leaf' ? 10 : 3;
  for (let i = 0; i < mossy; i++) {
    const x = Math.floor(hash(i, seed, 31) * (W - 6)), y = ridge + 2 + Math.floor(hash(i, seed, 32) * (H - ridge - 6)), w = 2 + Math.floor(hash(i, seed, 33) * 4);
    rect(c, ox + x, oy + y, w, 1, RAMP.moss[3]); rect(c, ox + x + 1, oy + y + 1, Math.max(1, w - 2), 1, RAMP.moss[1]); px(c, ox + x, oy + y, RAMP.moss[4]);
  }
  // Ridge cap, fascia, bargeboards.
  rect(c, ox, oy + ridge - 1, W, 2, R6[5]); rect(c, ox, oy + ridge + 1, W, 1, R6[1]);
  for (let x = 2; x < W; x += 6) px(c, ox + x, oy + ridge, R6[3]);
  rect(c, ox, oy, W, 1, R6[2]);
  rect(c, ox, oy + H - 3, W, 3, RAMP.wood[2]); rect(c, ox, oy + H - 3, W, 1, RAMP.wood[4]);
  for (const x of [0, W - 2]) { rect(c, ox + x, oy, 2, H - 1, RAMP.wood[x ? 1 : 4]); }
}
function mix(a: string, b: string, k: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(p(a, i) * (1 - k) + p(b, i) * k).toString(16).padStart(2, '0')).join('');
}
/** A stone chimney on a roof: courses, a lit left, a cap, its shadow on the shingles to the right. */
export function paintChimney(c: Ctx, x: number, y: number): void {
  rect(c, x + 8, y + 6, 4, 8, 'rgba(10,6,16,.28)');
  blocks(c, x, y + 2, 8, 12, RAMP.stone, 7, { bw: 4, bh: 3 });
  rect(c, x - 1, y, 10, 3, RAMP.stone[4]); rect(c, x - 1, y, 10, 1, RAMP.stone[6]); rect(c, x + 1, y + 1, 6, 1, DARK[1]);
}

// ── Furniture (painted at the fine scale: the grown sizes, now crisp) ────────────────────────────────────────────

/** A round tavern table, two stools and a candle. */
export function paintTable(): Sprite {
  const W = 36, H = 27, img = cv(W, H), c = img.getContext('2d')!;
  for (const x of [1, 29]) { rect(c, x, 15, 6, 4, RAMP.wood[4]); rect(c, x, 15, 6, 1, RAMP.wood[6]); rect(c, x + 1, 19, 1, 6, RAMP.wood[2]); rect(c, x + 4, 19, 1, 6, RAMP.wood[1]); }
  // The top: an ellipse of boards, lit edge front-left, the apron shaded under it.
  c.save(); c.beginPath(); c.ellipse(18, 10, 13, 6, 0, 0, Math.PI * 2); c.clip(); boards(c, 4, 3, 28, 14, RAMP.wood, false, 21, 3); c.restore();
  for (let x = 6; x < 31; x++) { const dy = Math.round(Math.sqrt(Math.max(0, 1 - ((x - 18) / 13) ** 2)) * 6); rect(c, x, 10 + dy, 1, 3, RAMP.wood[x < 18 ? 3 : 2]); px(c, x, 10 + dy, RAMP.wood[x < 14 ? 6 : 4]); }
  rect(c, 16, 18, 4, 8, RAMP.wood[2]); rect(c, 16, 18, 1, 8, RAMP.wood[4]); rect(c, 13, 25, 10, 2, RAMP.wood[1]);
  rect(c, 17, 2, 3, 6, RAMP.cream[3]); rect(c, 17, 2, 1, 6, RAMP.cream[4]); rect(c, 19, 3, 1, 5, RAMP.cream[1]); rect(c, 16, 8, 5, 1, RAMP.iron[3]);
  px(c, 18, 1, RAMP.ember[3]); px(c, 18, 0, RAMP.ember[4]);
  // A mug on the table.
  rect(c, 9, 7, 4, 4, '#c99a3e'); rect(c, 9, 7, 4, 1, RAMP.cream[4]); rect(c, 13, 8, 1, 2, '#a07a2a');
  return { img: outlined(img), ax: 19, ay: 28, lights: [{ x: 0, y: -26, r: 21, warm: true }], shadow: groundShadow(W, 18) };
}
/** A bed: a carved headboard, a plump pillow, a quilt with a folded hem and its pattern, shaded round. */
export function paintBed(v: number): Sprite {
  const quilt = [['#2e4a78', '#3f6496', '#5a7fb0', '#7fa0cc'], ['#5e2218', '#8f3524', '#b5482f', '#cf6a4a'], ['#2e5a28', '#3f7838', '#5a9a49', '#7cbc64']][v];
  const W = 27, H = 42, img = cv(W, H), c = img.getContext('2d')!;
  rect(c, 1, 0, 25, 42, RAMP.wood[3]); boards(c, 1, 0, 25, 7, RAMP.wood, true, 31 + v, 5); rect(c, 1, 6, 25, 1, RAMP.wood[1]);
  rect(c, 1, 0, 25, 1, RAMP.wood[7]); px(c, 1, 0, RAMP.wood[6]);
  // Pillow.
  rect(c, 4, 8, 19, 8, RAMP.cream[2]); rect(c, 5, 8, 17, 2, RAMP.cream[4]); rect(c, 4, 14, 19, 2, RAMP.cream[1]); rect(c, 20, 9, 3, 6, RAMP.cream[1]);
  // Quilt: a folded hem, a diamond pattern, shaded toward the right and the foot.
  for (let y = 16; y < 39; y++) for (let x = 3; x < 24; x++) {
    let t = x < 7 ? 3 : x > 19 ? 1 : 2;
    if (y > 34) t--;
    if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) t = Math.min(3, t + 1);
    px(c, x, y, quilt[Math.max(0, t)]);
  }
  rect(c, 3, 16, 21, 3, RAMP.cream[3]); rect(c, 3, 16, 21, 1, RAMP.cream[4]); rect(c, 3, 19, 21, 1, quilt[0]);
  rect(c, 1, 39, 25, 3, RAMP.wood[2]); rect(c, 1, 39, 25, 1, RAMP.wood[4]);
  return { img: outlined(img), ax: 14, ay: 43, shadow: groundShadow(W, 13) };
}
/** A bookshelf against the wall: a dark carcass, three shelves of books leaning and shaded, a candle. */
export function paintShelf(): Sprite {
  const W = 30, H = 33, img = cv(W, H), c = img.getContext('2d')!;
  rect(c, 0, 0, W, H, RAMP.wood[3]); rect(c, 0, 0, W, 2, RAMP.wood[6]); rect(c, 0, 0, 2, H, RAMP.wood[5]); rect(c, W - 2, 0, 2, H, RAMP.wood[1]);
  rect(c, 2, 2, W - 4, H - 4, RAMP.wood[1]);
  const books = [['#5e2218', '#8f3524', '#b5482f'], ['#2e4a78', '#3f78b5', '#6a9ad6'], ['#2e5a28', '#5a9a49', '#7cbc64'], ['#8a5a1a', '#d68a2e', '#f2b05a'], ['#4a2a6a', '#8a4fb0', '#b07ad6']];
  for (const y of [3, 13, 23]) {
    for (let x = 3; x < W - 3;) {
      const bw = 2 + Math.floor(hash(x, y, 3) * 2), bh = 7 + Math.floor(hash(x, y, 4) * 2), b = books[Math.floor(hash(x, y, 5) * books.length)];
      if (x + bw > W - 3) break;
      if (hash(x, y, 6) > .9) { x += 2; continue; }
      rect(c, x, y + 9 - bh, bw, bh, b[1]); rect(c, x, y + 9 - bh, 1, bh, b[2]); rect(c, x + bw - 1, y + 9 - bh, 1, bh, b[0]);
      rect(c, x, y + 11 - bh, bw, 1, '#e8d5b0');
      x += bw;
    }
    rect(c, 2, y + 9, W - 4, 2, RAMP.wood[4]); rect(c, 2, y + 9, W - 4, 1, RAMP.wood[6]);
  }
  return { img: outlined(img), ax: 16, ay: 34 };
}
/** The inn's bar: a long panelled counter, a lit top board, mugs of ale and a keg on its cradle. */
export function paintCounter(): Sprite {
  const W = 96, H = 33, img = cv(W, H), c = img.getContext('2d')!;
  rect(c, 0, 12, W, 21, RAMP.wood[3]);
  for (let x = 2; x < W - 4; x += 12) { rect(c, x, 15, 10, 13, RAMP.wood[4]); rect(c, x, 15, 10, 1, RAMP.wood[2]); rect(c, x, 15, 1, 13, RAMP.wood[2]); rect(c, x + 9, 15, 1, 13, RAMP.wood[6]); rect(c, x, 27, 10, 1, RAMP.wood[6]); }
  rect(c, 0, 30, W, 3, RAMP.wood[1]);
  boards(c, 0, 8, W, 5, RAMP.wood, false, 41, 5); rect(c, 0, 8, W, 1, RAMP.wood[7]); rect(c, 0, 13, W, 1, RAMP.wood[1]);
  for (const x of [10, 26, 44, 62]) { rect(c, x, 1, 6, 8, '#c99a3e'); rect(c, x, 1, 2, 8, '#e6c35a'); rect(c, x + 5, 1, 1, 8, '#8a6a20'); rect(c, x, 0, 6, 3, RAMP.cream[4]); rect(c, x + 6, 3, 2, 4, '#a07a2a'); }
  rect(c, 78, 0, 14, 10, RAMP.wood[4]); rect(c, 78, 0, 14, 1, RAMP.wood[6]); strap(c, 78, 2, 14); strap(c, 78, 7, 14); rect(c, 77, 4, 2, 2, RAMP.iron[4]);
  return { img: outlined(img), ax: 49, ay: 34, shadow: groundShadow(W, 48) };
}
