/**
 * td-iso-fx.ts — the spells and the fight at the isometric angle (td-artopt `iso`; docs/handoff/iso-fx.md). Classic is
 * untouched: everything here runs only inside the iso renderer.
 *
 * - **The floor projector** (`IsoFloorFx`): the ground effects (an aura's pulse, a nova, the S6 tells, hazards, a boss's
 *   cone, a charge lane, a summons' sigil, the loot rings, the class zones) are pixel painters written for the top-down
 *   plane, whole world pixels through `fillRect`. Drawn under the floor's rotated transform each pixel became a tilted
 *   diamond (the rasteriser's slow path, and a soft smear), and the rings that were squashed for the 3/4 view came out
 *   squashed twice and tipped over. The projector stands in for the canvas during that pass: every world pixel lands as
 *   the 2 × 1 iso pixel it covers, axis-aligned and crisp, so a world line is the classic 2:1 iso step and a world circle
 *   the iso ellipse. The painters lay their rings in world px while it runs (td-fx `setIsoFloor`), so the projection
 *   does the squashing once. A flat sprite (a patch, the scorch) is projected once and cached (td-iso isoFlat).
 * - **Height** (`airFoot`): an air effect stores the point it is drawn at, its height folded into y (a spark at a
 *   foe's chest is `y − h/2`). Iso must stand it on the foot under it, or it slides off to the right by half its
 *   height; the foot is found once per effect, from the creature or Keeper it hangs over.
 * - **Shadows** (`liftShadow`): a projectile flying over the floor casts a small soft shadow on it, down and to the
 *   right of its foot (the sun is upper left), so its height reads. Low: the core only.
 */
import { isoFlat } from './td-iso';

type Ctx = CanvasRenderingContext2D;

// ── The floor projector ──
/**
 * A stand-in for the canvas while the floor's effects are painted (world px in, iso px out). The real context is held
 * in the iso screen's transform (iso px); this keeps the painters' own translate/scale (an HD pulse draws at ×2).
 * What it does not know (a path, a gradient) goes to the real context under the floor's rotated transform, as before.
 */
export class IsoFloorFx {
  private c: Ctx | null = null;
  private s = 1;
  private ex = 0;
  private ey = 0;
  private sx = 1;
  private sy = 1;
  private tx = 0;
  private ty = 0;
  private readonly stack: number[] = [];
  /** Pixels laid this frame (the perf probe). */
  laid = 0;

  /** Take the real context (in the iso screen transform: scale `s`, the view's iso origin at (X0, Y0)). */
  bind(c: Ctx, s: number, X0: number, Y0: number): this {
    this.c = c; this.s = s; this.ex = -X0 * s; this.ey = -Y0 * s;
    this.sx = this.sy = 1; this.tx = this.ty = 0; this.stack.length = 0; this.up = false;
    c.setTransform(s, 0, 0, s, this.ex, this.ey);
    return this;
  }
  /** The stand-in as the painters' context. */
  get ctx(): Ctx { return this as unknown as Ctx; }

  get fillStyle(): string | CanvasGradient | CanvasPattern { return this.c!.fillStyle; }
  set fillStyle(v: string | CanvasGradient | CanvasPattern) { this.c!.fillStyle = v; }
  get strokeStyle(): string | CanvasGradient | CanvasPattern { return this.c!.strokeStyle; }
  set strokeStyle(v: string | CanvasGradient | CanvasPattern) { this.c!.strokeStyle = v; }
  get globalAlpha(): number { return this.c!.globalAlpha; }
  set globalAlpha(v: number) { this.c!.globalAlpha = v; }
  get globalCompositeOperation(): GlobalCompositeOperation { return this.c!.globalCompositeOperation; }
  set globalCompositeOperation(v: GlobalCompositeOperation) { this.c!.globalCompositeOperation = v; }
  get imageSmoothingEnabled(): boolean { return this.c!.imageSmoothingEnabled; }
  set imageSmoothingEnabled(v: boolean) { this.c!.imageSmoothingEnabled = v; }
  get font(): string { return this.c!.font; }
  set font(v: string) { this.c!.font = v; }
  get textAlign(): CanvasTextAlign { return this.c!.textAlign; }
  set textAlign(v: CanvasTextAlign) { this.c!.textAlign = v; }
  get textBaseline(): CanvasTextBaseline { return this.c!.textBaseline; }
  set textBaseline(v: CanvasTextBaseline) { this.c!.textBaseline = v; }

  save(): void { this.stack.push(this.sx, this.sy, this.tx, this.ty); this.c!.save(); }
  restore(): void {
    if (this.stack.length >= 4) { this.ty = this.stack.pop()!; this.tx = this.stack.pop()!; this.sy = this.stack.pop()!; this.sx = this.stack.pop()!; }
    this.c!.restore();
  }
  translate(x: number, y: number): void { this.tx += x * this.sx; this.ty += y * this.sy; }
  scale(a: number, b: number): void { this.sx *= a; this.sy *= b; }

  /**
   * Stand the next pixels upright at world point (x, y) (a thorn out of the ground, a campfire's flame): drawn as the
   * top-down view draws them, offset from where (x, y) projects, until `stand(NaN, NaN)` lays them flat again.
   */
  stand(x: number, y: number): void {
    if (Number.isNaN(x)) { this.up = false; return; }
    const wx = x * this.sx + this.tx, wy = y * this.sy + this.ty;
    this.up = true; this.ux = wx; this.uy = wy; this.uX = wx - wy; this.uY = (wx + wy) / 2;
  }
  private up = false;
  private ux = 0;
  private uy = 0;
  private uX = 0;
  private uY = 0;
  /** A world rect: each world pixel of it as the 2 × 1 iso pixel it covers (a big one through the slow path). */
  fillRect(x: number, y: number, w: number, h: number): void {
    const c = this.c!, wx = x * this.sx + this.tx, wy = y * this.sy + this.ty, ww = w * this.sx, wh = h * this.sy;
    if (ww <= 0 || wh <= 0) return;
    if (this.up) { c.fillRect(this.uX + wx - this.ux, this.uY + wy - this.uy, ww, wh); this.laid++; return; }
    // The pixel: a world pixel (1) or the HD pixel (½) an HD painter lays.
    const u = Math.min(1, Math.max(.5, Math.min(Math.abs(this.sx), Math.abs(this.sy)))), nx = Math.round(ww / u), ny = Math.round(wh / u);
    if (nx * ny > 400) { this.slow(x, y, w, h); return; }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const px = wx + i * u, py = wy + j * u;
      // The pixel's diamond spans iso X [x − y − u, x − y + u], Y [(x + y)/2, (x + y)/2 + u]; snapped to the pixel.
      const X = Math.round((px - py) / u) * u - u, Y = Math.floor((px + py) / 2 / u) * u;
      c.fillRect(X, Y, u * 2, u);
    }
    this.laid += nx * ny;
  }
  /** A flat image on the floor: projected once (td-iso isoFlat), then drawn axis-aligned at its top-left corner's place. */
  drawImage(img: CanvasImageSource, ...a: number[]): void {
    const c = this.c!;
    if (a.length === 6 || a.length === 8 || !(img instanceof HTMLCanvasElement)) { this.slowImage(img, a); return; }
    const dx = a[0], dy = a[1], dw = a.length === 4 ? a[2] : img.width, dh = a.length === 4 ? a[3] : img.height;
    const f = isoFlat(img), kx = dw / img.width * this.sx, ky = dh / img.height * this.sy;
    if (Math.abs(kx - ky) > 1e-6) { this.slowImage(img, a); return; }
    const wx = dx * this.sx + this.tx, wy = dy * this.sy + this.ty;
    c.drawImage(f, wx - wy - img.height * ky, (wx + wy) / 2, f.width / 2 * kx, f.height / 2 * kx);
  }
  /** Text lies upright where its world point projects (a name on a tell). */
  fillText(t: string, x: number, y: number): void {
    const wx = x * this.sx + this.tx, wy = y * this.sy + this.ty;
    this.c!.fillText(t, Math.round(wx - wy), Math.round((wx + wy) / 2));
  }

  /** The floor's own transform with the painters' on top (what the old pass drew under). */
  private plane(): void {
    const s = this.s;
    this.c!.setTransform(s * this.sx, s / 2 * this.sx, -s * this.sy, s / 2 * this.sy, this.ex + (this.tx - this.ty) * s, this.ey + (this.tx + this.ty) / 2 * s);
  }
  private slow(x: number, y: number, w: number, h: number): void {
    const c = this.c!;
    this.plane(); c.fillRect(x, y, w, h); c.setTransform(this.s, 0, 0, this.s, this.ex, this.ey);
  }
  private slowImage(img: CanvasImageSource, a: number[]): void {
    const c = this.c!;
    this.plane(); (c.drawImage as (...v: unknown[]) => void)(img, ...a); c.setTransform(this.s, 0, 0, this.s, this.ex, this.ey);
  }
}

// ── Height ──
interface Over { x: number; y: number; def: { w: number; h: number } }
const feet = new WeakMap<object, number>();
/**
 * The floor under an air effect drawn at (x, y): the foot of the creature or Keeper it hangs over (a spark at a chest,
 * a slash across a body), else its own point (a burst on the ground, a shot's spark). Found once per effect.
 */
export function airFoot(e: { x: number; y: number }, mobs: readonly Over[], keeper: { x: number; y: number }, keeperH = 40): number {
  const got = feet.get(e);
  if (got !== undefined) return got;
  let foot = e.y, best = 1e9;
  for (const m of mobs) {
    const dx = Math.abs(e.x - m.x), up = m.y - e.y;
    if (dx > m.def.w * .6 + 4 || up < 2 || up > m.def.h + 8) continue;
    const d = dx + Math.abs(up - m.def.h / 2) * .5;
    if (d < best) { best = d; foot = m.y; }
  }
  { const dx = Math.abs(e.x - keeper.x), up = keeper.y - e.y;
    if (dx < 14 && up >= 2 && up <= keeperH + 10 && dx + Math.abs(up - keeperH / 2) * .5 < best) foot = keeper.y; }
  feet.set(e, foot);
  return foot;
}

// ── Shadows ──
/**
 * A projectile's shadow on the floor (iso px, the iso screen's transform): a soft 2:1 smudge cast down and to the right
 * of its foot (X, Y) by its height `lift` (art px), fainter and wider the higher it flies. Low: the core only.
 */
export function liftShadow(c: Ctx, X: number, Y: number, lift: number, size: number, low: boolean): void {
  const h = Math.max(0, Math.min(60, lift)), k = 1 - h / 90, dx = Math.round(h * .22), dy = Math.round(h * .08);
  const rx = Math.max(2, Math.round(size * (1.2 + h / 50))), ry = Math.max(1, Math.round(rx / 2));
  const x = Math.round(X) + dx, y = Math.round(Y) + dy, was = c.globalAlpha;
  c.fillStyle = '#140c1c';
  if (!low) {
    c.globalAlpha = was * .16 * k;
    for (let j = -ry - 1; j <= ry + 1; j++) { const w = Math.round((rx + 2) * Math.sqrt(Math.max(0, 1 - (j / (ry + 1.5)) ** 2))); if (w) c.fillRect(x - w, y + j, w * 2, 1); }
  }
  c.globalAlpha = was * .32 * k;
  for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + .5)) ** 2))); if (w) c.fillRect(x - w, y + j, w * 2, 1); }
  c.globalAlpha = was;
}
