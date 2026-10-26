/**
 * td-gather.ts — the gathering loops in the top-down world (shared/gathering; docs/handoff/gather.md): the fishing
 * spots' floats and their fish under the water (world-acts §4), the line and the bite, the campfires (Firemaking) and
 * the pan (Cooking), and the meal mending in the Keeper.
 *
 * The engine owns the Keeper and the clock and hands this the frame; the host answers each step (td-engine onGather).
 * Drawing is pixel-crisp in world space (art px): each shadow is the painter hook `fishShadow(len)` (td-floors.ts), at
 * most 14 on screen (8 on Low), nearest the Keeper first, moved at 15 Hz; a jump is three frames of a small sprite.
 */
import { fishShadow } from './td-floors';
import type { FishSpot } from './td-world';
import { COOK_SECS, FIRE_LIGHT, LIGHT_SECS, MEAL_SECS, biteSecs, shownHere, type SkyNow, type WorldFishDef } from '../../shared/gathering/gathering.model';

/** A campfire on the ground (Firemaking). `left`: seconds of burning left (rain burns it twice as fast). */
export interface Campfire { id: number; x: number; y: number; left: number; life: number; log: string; lv: string }

export interface FishLoop { spot: FishSpot; wait: number; speed: number; jumped: boolean; dip: number; at: { x: number; y: number }; n: number }
export interface CookLoop { fire: Campfire | null; x: number; y: number; range: boolean; t: number; at: { x: number; y: number }; n: number }
export interface StrikeLoop { log: string; t: number; x: number; y: number }

interface Jump { x: number; y: number; age: number; tone: WorldFishDef['tone']; dir: number }

/** Shadows drawn at most (a phone or Low: 8). */
export const SHADOW_CAP = 14;
export const SHADOW_CAP_LOW = 8;
/** How far from the float a Keeper may stand and still fish (art px). */
export const FISH_REACH = 30;
/** A step this far from where the loop began ends it ("or you move"). */
export const MOVE_STOP = 8;
/** The most campfires a Keeper keeps burning (the oldest goes out). */
export const FIRE_CAP = 6;

const TONE: Readonly<Record<WorldFishDef['tone'], string>> = { grey: '#9a94a0', silver: '#e8eef8', warm: '#ffc86a', pale: '#e0e6ff' };

/** A small seeded hash (0..1). */
function h(n: number): number { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export class GatherRuntime {
  fish: FishLoop | null = null;
  cook: CookLoop | null = null;
  strike: StrikeLoop | null = null;
  readonly fires: Campfire[] = [];
  /** A meal mending: life a second, seconds left. */
  meal: { rate: number; left: number } | null = null;
  private readonly jumps: Jump[] = [];
  /** Per spot: when each of its shadows next jumps (engine seconds). */
  private readonly nextJump = new Map<string, number[]>();
  private fireSeq = 0;
  /** Shadows drawn last frame (the canvas tells the tests: "where are the fish?"). */
  shadowsDrawn = 0;

  // ── The loops ────────────────────────────────────────────────────────────

  startFish(spot: FishSpot, speed: number, at: { x: number; y: number }, rnd: () => number): void {
    this.cook = null; this.strike = null;
    this.fish = { spot, speed, wait: biteSecs(speed, false, rnd), jumped: false, dip: 0, at: { ...at }, n: 0 };
  }
  startCook(fire: Campfire | null, x: number, y: number, range: boolean, at: { x: number; y: number }): void {
    this.fish = null; this.strike = null;
    this.cook = { fire, x, y, range, t: COOK_SECS, at: { ...at }, n: 0 };
  }
  startStrike(log: string, x: number, y: number): void {
    this.fish = null; this.cook = null;
    this.strike = { log, t: LIGHT_SECS, x, y };
  }
  stopAll(): void { this.fish = null; this.cook = null; this.strike = null; }
  /** Busy at something the Keeper's own step would end. */
  get busy(): boolean { return !!(this.fish || this.cook || this.strike); }

  lightFire(x: number, y: number, log: string, secs: number, lv: string): Campfire {
    const f: Campfire = { id: ++this.fireSeq, x, y, left: secs, life: secs, log, lv };
    this.fires.push(f);
    while (this.fires.length > FIRE_CAP) this.fires.shift();
    return f;
  }
  /** The level the Keeper stands on (a fire burns where it was lit). */
  lv = 'surface';
  /** The nearest burning fire within `reach` of a point, on the Keeper's level. */
  /** The campfire within `reach` of a point. `rel` (the isometric view): the point as seen against each fire's foot. */
  fireNear(x: number, y: number, reach: number, rel?: (fx: number, fy: number) => { x: number; y: number }): Campfire | null {
    let best: Campfire | null = null, bd = reach;
    for (const f of this.fires) { if (f.lv !== this.lv) continue; const q = rel ? rel(f.x, f.y) : null; const d = Math.hypot(f.x - (q ? q.x : x), f.y - (q ? q.y : y)); if (d <= bd) { bd = d; best = f; } }
    return best;
  }

  eat(heal: number): void { this.meal = { rate: heal / MEAL_SECS, left: MEAL_SECS }; }

  /**
   * One step. Returns what fell due this frame (the engine asks the host): a bite, a cooked fish, a struck light.
   * `wet`: rain on the land (fires burn twice as fast). `moved`: the Keeper's distance from where a loop began.
   */
  update(dt: number, time: number, k: { x: number; y: number }, wet: boolean): { bite?: true; cooked?: true; lit?: StrikeLoop; heal: number; fireOut?: boolean } {
    const out: { bite?: true; cooked?: true; lit?: StrikeLoop; heal: number; fireOut?: boolean } = { heal: 0 };
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.left -= dt * (wet ? 2 : 1);
      if (f.left <= 0) { this.fires.splice(i, 1); out.fireOut = true; if (this.cook?.fire === f) this.cook = null; }
    }
    for (let i = this.jumps.length - 1; i >= 0; i--) { this.jumps[i].age += dt; if (this.jumps[i].age > 1.1) this.jumps.splice(i, 1); }
    if (this.meal) {
      const step = Math.min(dt, this.meal.left);
      out.heal = this.meal.rate * step;
      this.meal.left -= dt;
      if (this.meal.left <= 0) this.meal = null;
    }
    const f = this.fish;
    if (f) {
      if (Math.hypot(k.x - f.at.x, k.y - f.at.y) > MOVE_STOP) this.fish = null;
      else if (f.dip > 0) { f.dip -= dt; if (f.dip <= 0) out.bite = true; }
      else { f.wait -= dt; if (f.wait <= 0) f.dip = .35; }
    }
    const c = this.cook;
    if (c) {
      if (Math.hypot(k.x - c.at.x, k.y - c.at.y) > MOVE_STOP) this.cook = null;
      else { c.t -= dt; if (c.t <= 0) { c.t = COOK_SECS; out.cooked = true; } }
    }
    const s = this.strike;
    if (s) {
      if (Math.hypot(k.x - s.x, k.y - s.y) > MOVE_STOP) this.strike = null;
      else { s.t -= dt; if (s.t <= 0) { this.strike = null; out.lit = s; } }
    }
    void time;
    return out;
  }
  /** After a bite the host answered: wait again (the jump tell was spent on this one). */
  rearm(speed: number, rnd: () => number): void {
    const f = this.fish;
    if (!f) return;
    f.speed = speed; f.jumped = false; f.n++;
    f.wait = biteSecs(speed, false, rnd);
  }

  // ── The fish under the water ─────────────────────────────────────────────

  /**
   * Seed each visible spot's jump clock; fire the jumps due. A jump at the spot being fished brings its next bite two
   * seconds sooner (the tell: "Watch them jump before you cast").
   */
  stepJumps(spots: readonly FishSpot[], time: number, sky: SkyNow, splash: () => void): void {
    for (const sp of spots) {
      const n = 3 + (sp.seed % 3);
      let next = this.nextJump.get(sp.id);
      if (!next) { next = Array.from({ length: n }, (_, i) => time + 8 + h(sp.seed + i * 13) * 40); this.nextJump.set(sp.id, next); }
      for (let i = 0; i < next.length; i++) {
        if (time < next[i]) continue;
        next[i] = time + 40 + h(sp.seed + i * 7 + Math.floor(time)) * 50;
        const fish = shownHere(sp.water, sky);
        const tone = fish[(sp.seed + i) % Math.max(1, fish.length)]?.tone ?? 'grey';
        const a = time * .4 + i * 2.1 + sp.seed;
        this.jumps.push({ x: sp.x + Math.cos(a) * 12, y: sp.y + Math.sin(a) * 6, age: 0, tone, dir: Math.cos(a) > 0 ? 1 : -1 });
        if (this.fish && this.fish.spot.id === sp.id && !this.fish.jumped && this.fish.dip <= 0) {
          this.fish.jumped = true;
          this.fish.wait = Math.max(.3, this.fish.wait - 2);
        }
        splash();
      }
    }
    if (this.nextJump.size > 64) for (const id of [...this.nextJump.keys()].slice(0, 16)) this.nextJump.delete(id);
  }

  /**
   * The spots' floats and their shadows (under everything standing). `still`: reduced motion (the shadows hold their
   * places; jumps show as a ring only). `cap`: the most shadows drawn this frame, nearest the Keeper first.
   */
  drawWater(c: CanvasRenderingContext2D, spots: readonly FishSpot[], time: number, k: { x: number; y: number }, sky: SkyNow, cap: number, still: boolean, rainy: boolean): void {
    const tick = Math.floor(time * 15) / 15;   // 15 Hz
    const order = [...spots].sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y));
    let drawn = 0;
    for (const sp of order) {
      const fish = shownHere(sp.water, sky);
      const n = 3 + (sp.seed % 3);
      for (let i = 0; i < n && drawn < cap; i++) {
        const f = fish[(sp.seed + i) % Math.max(1, fish.length)];
        if (!f) continue;
        const speed = .35 + h(sp.seed + i) * .25, a = (still ? 0 : tick * speed) + i * (Math.PI * 2 / n) + sp.seed;
        const r = 6 + h(sp.seed * 3 + i) * 9;
        const x = sp.x + Math.cos(a) * r, y = sp.y + Math.sin(a) * r * .55;
        const img = fishShadow(f.shadow[0] + 2);
        c.globalAlpha = rainy ? .78 : 1;
        const dir = -Math.sin(a) >= 0 ? 1 : -1;
        if (dir < 0) { c.save(); c.translate(Math.round(x), 0); c.scale(-1, 1); c.drawImage(img, -Math.round(img.width / 2), Math.round(y - 2)); c.restore(); }
        else c.drawImage(img, Math.round(x - img.width / 2), Math.round(y - 2));
        // The Lampfish's warm dot: on a dark lake its light is the only light.
        if (f.tone === 'warm') { c.globalAlpha = .9; c.fillStyle = TONE.warm; c.fillRect(Math.round(x + dir * 2), Math.round(y), 1, 1); }
        drawn++;
      }
      c.globalAlpha = 1;
    }
    c.globalAlpha = 1;
    this.shadowsDrawn = drawn;
    // Jumps: a 3-frame arc of a small fish, a 1-tile splash ring.
    for (const j of this.jumps) {
      const t = j.age;
      if (!still && t < .45) {
        const p = t / .45, x = j.x + j.dir * p * 8, y = j.y - Math.sin(p * Math.PI) * 9;
        c.fillStyle = '#140a1f'; c.fillRect(Math.round(x - 3), Math.round(y - 1), 6, 3);
        c.fillStyle = TONE[j.tone]; c.fillRect(Math.round(x - 2), Math.round(y), 4, 1);
      }
      const rr = Math.round(2 + t * 9);
      c.globalAlpha = Math.max(0, .7 - t * .65); c.strokeStyle = '#d8ecff'; c.lineWidth = 1;
      c.strokeRect(Math.round(j.x - rr), Math.round(j.y - rr / 2), rr * 2, rr);
      c.globalAlpha = 1;
    }
  }

  /** Every spot's float in view, over everything standing (a float never hides under the Keeper's ring). */
  drawFloats(c: CanvasRenderingContext2D, spots: readonly FishSpot[], time: number, still: boolean): void {
    for (const sp of spots) this.drawFloat(c, sp, time, still);
  }
  /** The spot's float: a red-and-white bob on a ripple ring; it dips on a bite. */
  private drawFloat(c: CanvasRenderingContext2D, sp: FishSpot, time: number, still: boolean): void {
    const active = this.fish?.spot.id === sp.id;
    const dip = active && this.fish!.dip > 0 ? 2 : 0;
    const bob = still ? 0 : Math.round(Math.sin(time * 2.4 + sp.seed) * .8);
    const x = Math.round(sp.x), y = Math.round(sp.y + bob + dip);
    // The ripple: two stepped rings, slowly widening.
    const ring = still ? 6 : 5 + Math.floor((time * 3 + sp.seed) % 4);
    c.globalAlpha = .6; c.fillStyle = '#d8ecff';
    c.fillRect(x - ring, y + 3, ring * 2, 1); c.fillRect(x - ring + 2, y - 3, ring * 2 - 4, 1);
    c.fillRect(x - ring - 1, y, 1, 1); c.fillRect(x + ring, y, 1, 1);
    c.globalAlpha = 1;
    c.fillStyle = '#140a1f'; c.fillRect(x - 2, y - 5, 5, 8);
    c.fillStyle = '#e8e4ef'; c.fillRect(x - 1, y - 4, 3, 3);
    c.fillStyle = '#d0402a'; c.fillRect(x - 1, y - 1, 3, 3);
    c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 4, 1, 1);
  }

  /** The line from the rod's tip to the float while fishing. */
  drawLine(c: CanvasRenderingContext2D, k: { x: number; y: number; face: number; dir?: string }, time: number): void {
    const f = this.fish;
    if (!f) return;
    // The rod's tip, held out toward the water: past the feet facing south, over the head facing north, else to the side.
    const tx = k.dir === 'down' ? k.x + 5 : k.dir === 'up' ? k.x + 5 : k.x + k.face * 12, ty = k.dir === 'down' ? k.y - 8 : k.dir === 'up' ? k.y - 38 : k.y - 26, fx = f.spot.x, fy = f.spot.y - 3 + (f.dip > 0 ? 2 : 0);
    const n = Math.max(4, Math.floor(Math.hypot(fx - tx, fy - ty) / 3));
    c.fillStyle = '#e8e4ef'; c.globalAlpha = .75;
    for (let i = 0; i <= n; i++) {
      const p = i / n, sag = Math.sin(p * Math.PI) * 5;
      c.fillRect(Math.round(tx + (fx - tx) * p), Math.round(ty + (fy - ty) * p + sag), 1, 1);
    }
    c.globalAlpha = 1;
    // The rod: a short dark stroke from the hand to the tip.
    c.fillStyle = '#5a3f2a';
    const hx = k.x + (k.dir === 'side' ? k.face * 4 : 4), hy = k.y - 18;
    for (let i = 0; i <= 8; i++) c.fillRect(Math.round(hx + (tx - hx) * i / 8), Math.round(hy + (ty - hy) * i / 8), 1, 1);
    void time;
  }

  // ── Fire ─────────────────────────────────────────────────────────────────

  /** A campfire: a ring of stones, crossed logs, a stepped flame that flickers (still under reduced motion). */
  drawFire(c: CanvasRenderingContext2D, f: Campfire, time: number, still: boolean): void {
    const x = Math.round(f.x), y = Math.round(f.y);
    c.fillStyle = '#3a3440';
    for (const [dx, dy] of [[-6, 0], [-4, 2], [0, 3], [4, 2], [6, 0], [4, -2], [-4, -2]] as const) c.fillRect(x + dx - 1, y + dy - 1, 2, 2);
    c.fillStyle = '#5a3f2a'; c.fillRect(x - 5, y - 1, 10, 2);
    c.fillStyle = '#3a2614'; c.fillRect(x - 3, y - 2, 6, 1);
    const fade = Math.min(1, f.left / 10);
    const fl = still ? 0 : Math.floor((time * 10 + f.id) % 3);
    const hgt = Math.round((6 + fl) * (.5 + fade * .5));
    c.fillStyle = '#c4501e'; c.fillRect(x - 3, y - 1 - hgt, 6, hgt);
    c.fillStyle = '#e8752a'; c.fillRect(x - 2, y - 1 - hgt + 1, 4, hgt - 1);
    c.fillStyle = '#ffd08a'; c.fillRect(x - 1, y - 1 - Math.max(2, hgt - 3), 2, Math.max(2, hgt - 3));
    if (!still && fl === 0) { c.fillStyle = '#ffd08a'; c.fillRect(x + ((f.id + Math.floor(time * 3)) % 5) - 2, y - hgt - 4, 1, 1); }
  }

  /** The strike of a light: sparks at the Keeper's feet. */
  drawStrike(c: CanvasRenderingContext2D, time: number, still: boolean): void {
    const s = this.strike;
    if (!s) return;
    c.fillStyle = '#5a3f2a'; c.fillRect(Math.round(s.x - 4), Math.round(s.y - 1), 8, 2);
    if (still) return;
    c.fillStyle = '#ffd08a';
    for (let i = 0; i < 3; i++) if ((Math.floor(time * 12) + i) % 3 === 0) c.fillRect(Math.round(s.x - 3 + i * 3), Math.round(s.y - 3 - i), 1, 1);
  }

  /** The fires' lights (the dark layer and the night pass read them). */
  lights(): { x: number; y: number; r: number }[] {
    return this.fires.filter(f => f.lv === this.lv).map(f => ({ x: f.x, y: f.y - 6, r: FIRE_LIGHT * Math.min(1, .4 + f.left / 20) }));
  }
}
