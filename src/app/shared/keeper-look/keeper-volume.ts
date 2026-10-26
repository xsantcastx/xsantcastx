/**
 * keeper-volume.ts — the volume pass (the art style upgrade, owner 2026-10-26: "player and monsters … look more 3D";
 * docs/handoff/art-style.md).
 *
 * Run once over a baked, outlined figure (a Keeper's front/back sheet, a painter's body frame, a pet's sheet): it reads
 * the silhouette as a soft relief — the distance from each pixel to the outline, smoothed — and lights that relief from
 * the upper left. Pixels on the lit rim step a shade warmer and lighter, pixels turning away step cooler and darker (two
 * steps in the deepest turn), the flat middle keeps its painted colour. So every figure — whatever it wears, worn looks
 * and all — reads round, like the reference's characters, without a hand repaint of each piece. Whole pixels, each a
 * mix of its own colour (never a blur); the dark outline, the eyes' white highlights and the near-black pupils are
 * left alone. The result is a pure function of the pixels, so the keeper-look caches (painter keys) are untouched.
 */

const OUT_R = 0x14, OUT_G = 0x0c, OUT_B = 0x1c;
/** Transparent, or the one dark outline (any near-black edge pixel counts). */
function isOut(d: Uint8ClampedArray, p: number): boolean {
  if (d[p + 3] < 200) return true;
  return d[p] + d[p + 1] + d[p + 2] < 90 && Math.abs(d[p] - OUT_R) < 14 && Math.abs(d[p + 2] - OUT_B) < 20;
}
/** The light (upper left, a little in front), normalised. */
const LX = -.56, LY = -.68, LZ = .47;
/** What the light and the shade lean toward (hue-shifted, as a pixel artist's ramps do). */
const WARM = [255, 244, 214] as const, COOL = [30, 16, 52] as const;

export interface VolumeOptions {
  /** How much the lit rim lightens (0 … 1). */
  light?: number;
  /** How much the turned-away side darkens (0 … 1). */
  shade?: number;
  /** How deep (px) the relief reaches in from the outline: smaller for a small figure. */
  depth?: number;
  /** Pixels fainter than this count as empty (a creature's soft halo is not its body). Default 1. */
  alphaMin?: number;
}

let enabled = true;
/** Galleries only: paint without the pass (before/after pictures). */
export function setVolume(on: boolean): void { enabled = on; }

/** Light the figures on `canvas` in place (every opaque pixel; transparent gaps separate figures). */
export function volumize(canvas: HTMLCanvasElement, opts: VolumeOptions = {}): HTMLCanvasElement {
  if (!enabled) return canvas;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  if (!c || !canvas.width || !canvas.height) return canvas;
  // A stand-in canvas (a headless test's) may hand back no pixels at all: then there is nothing to light.
  let img: ImageData | undefined;
  try { img = c.getImageData(0, 0, canvas.width, canvas.height); } catch { return canvas; }
  if (!img?.data || img.data.length < canvas.width * canvas.height * 4) return canvas;
  volumizeData(img.data, canvas.width, canvas.height, opts);
  c.putImageData(img, 0, 0);
  return canvas;
}

/** The same over raw RGBA (for tests and for sheets already read back). */
export function volumizeData(d: Uint8ClampedArray, W: number, H: number, opts: VolumeOptions = {}): void {
  if (!d || d.length < W * H * 4) return;
  const lightK = opts.light ?? .3, shadeK = opts.shade ?? .34, depth = opts.depth ?? 5;
  const n = W * H;
  // Distance (in px, capped) from each opaque pixel to the nearest transparent one: a two-pass chamfer.
  const dist = new Float32Array(n);
  const BIG = 1e4;
  const aMin = opts.alphaMin ?? 1;
  for (let i = 0; i < n; i++) dist[i] = d[i * 4 + 3] >= aMin ? BIG : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!dist[i]) continue;
    let v = dist[i];
    if (x > 0) v = Math.min(v, dist[i - 1] + 1); else v = Math.min(v, 1);
    if (y > 0) v = Math.min(v, dist[i - W] + 1); else v = Math.min(v, 1);
    if (x > 0 && y > 0) v = Math.min(v, dist[i - W - 1] + 1.41);
    if (x < W - 1 && y > 0) v = Math.min(v, dist[i - W + 1] + 1.41);
    dist[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (!dist[i]) continue;
    let v = dist[i];
    if (x < W - 1) v = Math.min(v, dist[i + 1] + 1); else v = Math.min(v, 1);
    if (y < H - 1) v = Math.min(v, dist[i + W] + 1); else v = Math.min(v, 1);
    if (x < W - 1 && y < H - 1) v = Math.min(v, dist[i + W + 1] + 1.41);
    if (x > 0 && y < H - 1) v = Math.min(v, dist[i + W - 1] + 1.41);
    dist[i] = v;
  }
  // The relief: the distance capped at `depth`, eased (a rounded shoulder), smoothed twice (3×3) inside the figure.
  let h = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = Math.min(1, dist[i] / depth); h[i] = dist[i] ? Math.sqrt(t * (2 - t)) * depth : 0; }
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float32Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!dist[i]) continue;
      let s = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) { k++; continue; }
        s += h[Y * W + X]; k++;
      }
      o[i] = s / k;
    }
    h = o;
  }
  const flat = LZ;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : h[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = i * 4;
    if (!dist[i]) continue;
    const r = d[p], g = d[p + 1], b = d[p + 2];
    // The outline, the pupils and the eyes' white glints keep their colour.
    if (Math.abs(r - OUT_R) < 6 && Math.abs(g - OUT_G) < 6 && Math.abs(b - OUT_B) < 6) continue;
    const lum = (r * .299 + g * .587 + b * .114) / 255;
    if (lum < .09 || lum > .95) continue;
    const gx = (at(x + 1, y) - at(x - 1, y)) / 2, gy = (at(x, y + 1) - at(x, y - 1)) / 2;
    const nx = -gx, ny = -gy, nz = .9, len = Math.hypot(nx, ny, nz);
    const lam = (nx * LX + ny * LY + nz * LZ) / len, delta = lam - flat;
    // The first ring in from the outline: lit where the outline is above or to the left, shaded below and to the right.
    const edge = (X: number, Y: number) => X < 0 || Y < 0 || X >= W || Y >= H || isOut(d, (Y * W + X) * 4);
    const rimLit = edge(x - 1, y) || edge(x, y - 1), rimDark = edge(x + 1, y) || edge(x, y + 1) || edge(x + 1, y + 1);
    let t = 0, to: readonly number[] = WARM;
    if (delta > .16) { t = lightK * (delta > .4 ? 1 : .65); to = WARM; }
    else if (delta < -.16) { t = shadeK * (delta < -.5 ? 1.5 : delta < -.32 ? 1.1 : .65); to = COOL; }
    if (rimLit && !rimDark && to !== COOL) { t = Math.max(t, lightK * 1.1); to = WARM; }
    else if (rimDark && !rimLit) { if (to === WARM) t = 0; t = Math.max(t, shadeK * 1.1); to = COOL; }
    if (!t) continue;
    d[p] = Math.round(r + (to[0] - r) * t); d[p + 1] = Math.round(g + (to[1] - g) * t); d[p + 2] = Math.round(b + (to[2] - b) * t);
  }
}
