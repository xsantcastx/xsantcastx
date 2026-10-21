/**
 * td-dark-layer.ts — the mystery layer at run time (design-bible §5.3, §5.4; the rules are td-dark.ts).
 *
 * The engine hands it one DarkFrame a frame and asks it to paint in three places: the ground (a Nightroad's planks),
 * over the night pass (the shapes, the prints, a shy chest, the pale nails of an open road, a whisper), and the screen
 * edge (the Hush at its deepest). It keeps only session state: the Hush, what stands in the dark now, the chests
 * opened this session. Nothing here ever touches the Keeper's life, mana or satchel; the chest's loot is laid on the
 * ground by the engine, like any other drop.
 *
 * Pixel only (effects-spec rule 1), the shadow palette (rule 2: core #f0e0ff, body #b06bff, edge #6b3aa0, the hostile
 * dark #140c1c). Budgets: ≤ 2 shapes, ≤ 12 prints, one whisper. Reduced motion: the same shapes, no travel.
 */
import type { SkyPhase } from '../../shared/world-clock/world-clock.model';
import {
  HUSH_BUMP, NIGHTROADS, floorDepth, SHADE_CHESTS, SHAPE, STEPS, bumpHush, darkBornHere, darkRandom, hushAwake, hushBand, hushBoon,
  nightroadAt, nightroadFade, nightroadOpen, omenGap, pastLight, pickOmen, printSpot, shadeChestShown, shapeDone,
  shapeGap, stepHush, stepShape, type HushBand, type HushCap, type HushPlace, type LightSpot, type NightroadDef,
  type OmenKind, type Shape, type ShadeChestDef,
} from './td-dark';

const TILE = 16;
const INK = '#140c1c', CORE = '#f0e0ff', BODY = '#b06bff', EDGE = '#6b3aa0', BONE = '#e8e1cf';

/** What the engine knows this frame. */
export interface DarkFrame {
  dt: number; time: number; still: boolean;
  levelId: string; dark: boolean; continent: string; surface: boolean;
  phase: SkyPhase;
  /** A town, a village, a lit building: no dark-born, the Hush falls fast. */
  safe: boolean;
  hearth: boolean;
  keeper: { x: number; y: number; moving: boolean };
  keeperLevel: number;
  /** The Keeper's own light, Glim's, a lantern-pet's, and the fixed lights in view (torches, lamps, hearths). */
  own: LightSpot; glim: LightSpot | null; pet: LightSpot | null; fixed: readonly LightSpot[];
  /** Tiles of raised light (the Light spell, a relic). */
  raised: number;
  trail: readonly { x: number; y: number }[];
  walkable(c: number, r: number): boolean;
}

interface Print { x: number; y: number; age: number; left: boolean }
interface Whisper { text: string; x: number; y: number; age: number; life: number }

export class DarkLayer {
  /** 0–100; never shown as a number. */
  hush = 0;
  cap: HushCap = 'full';
  /** The engine's `?hush=` pin (an automated browser only): the Hush held there, awake anywhere. */
  pinned: number | null = null;
  shapes: Shape[] = [];
  prints: Print[] = [];
  private whisper: Whisper | null = null;
  private words: { whispers: readonly string[]; name: string } = { whispers: [], name: '' };
  private readonly opened = new Set<string>();
  private chestAlpha = new Map<string, number>();
  private roadAlpha = new Map<string, number>();
  private shapeT = 6;
  private stepT = 20;
  private stepSpell = 0;
  private stepEvery = 0;
  private omenT = 30;
  private flickerT = 0;
  /** The last omen, for the HUD (it flickers its band) and the host (a bell, a whisper). */
  omen: { kind: OmenKind; seq: number } | null = null;
  private seq = 0;
  private readonly rnd: () => number;
  /** The showcase (`?fxdark=1`): shapes that stay put for a photograph. */
  hold = false;

  constructor(salt: string, private readonly sfx: (cue: 'farbell' | 'whisper') => void) { this.rnd = darkRandom(salt); }

  setWords(w: { whispers: readonly string[]; name: string }): void { this.words = w; }
  setCap(cap: HushCap): void { this.cap = cap; }

  /** Is the Hush awake for this Keeper here (and not capped to nothing)? */
  awake(f: Pick<DarkFrame, 'keeperLevel' | 'continent'>): boolean {
    if (this.cap === 'off') return false;
    return this.pinned !== null || hushAwake(f.keeperLevel, f.continent);
  }
  get band(): HushBand { return hushBand(this.hush); }
  get boon(): { mf: number; xp: number } { return hushBoon(this.hush); }
  /** The light flickers (an omen): the engine's hole radii are multiplied by this. */
  get flicker(): number {
    if (this.flickerT <= 0) return 1;
    return 0.86 + 0.1 * Math.abs(Math.sin(this.flickerT * 31));
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(f: DarkFrame): void {
    const awake = this.awake(f);
    const lights = this.lightsOf(f);
    if (this.pinned !== null) this.hush = Math.min(this.pinned, this.cap === 'quiet' ? 59 : 100);
    else {
      const place: HushPlace = {
        dark: f.dark, depth: floorDepth(f.levelId, f.dark), phase: f.phase, town: f.safe, hearth: f.hearth,
        lamp: f.fixed.length > 0 && pastLight(f.keeper.x, f.keeper.y, f.fixed) < 0,
        lit: f.raised > 0 || !!f.pet,
      };
      this.hush = stepHush(this.hush, f.dt, place, this.cap, awake);
    }
    const band = awake ? this.band : 0;
    this.flickerT = Math.max(0, this.flickerT - f.dt);
    this.updateShapes(f, lights, band, awake);
    this.updatePrints(f, band);
    this.updateOmens(f, band, awake);
    this.updateChests(f);
    this.updateRoads(f);
  }

  private lightsOf(f: DarkFrame): LightSpot[] {
    const out: LightSpot[] = [f.own, ...f.fixed];
    if (f.glim) out.push(f.glim);
    if (f.pet) out.push(f.pet);
    return out;
  }

  private updateShapes(f: DarkFrame, lights: LightSpot[], band: HushBand, awake: boolean): void {
    for (const s of this.shapes) {
      if (this.hold && s.state === 'stand') { s.alpha = Math.min(SHAPE.alpha, s.alpha + SHAPE.fadeIn * f.dt); continue; }
      const x = s.x, y = s.y;
      if (stepShape(s, lights, f.dt) === 'unveiled') this.hush = bumpHush(this.hush, HUSH_BUMP.unveiled, this.cap, awake);
      // Reduced motion: no travel — it fades where it stood.
      if (f.still) { s.x = x; s.y = y; }
    }
    this.shapes = this.shapes.filter(s => !shapeDone(s));
    if (this.hold || !darkBornHere(f.dark, f.phase, f.safe)) { if (!this.hold) this.shapes.forEach(s => { s.state = 'gone'; }); return; }
    if ((this.shapeT -= f.dt) > 0 || this.shapes.length >= SHAPE.max) return;
    this.shapeT = shapeGap(band, this.rnd);
    const s = this.placeShape(f, lights, band >= 2, this.rnd() * Math.PI * 2);
    if (s) this.shapes.push(s);
  }

  /** A shape on firm ground just past every light, at (about) this angle from the Keeper. Null: nowhere fits. */
  placeShape(f: Pick<DarkFrame, 'keeper' | 'walkable'>, lights: readonly LightSpot[], deep: boolean, angle: number): Shape | null {
    const gap = deep ? SHAPE.gapDeep : SHAPE.gap;
    for (let k = 0; k < 8; k++) {
      const a = angle + k * Math.PI / 4;
      for (let d = 40; d < 260; d += 4) {
        const x = f.keeper.x + Math.cos(a) * d, y = f.keeper.y + Math.sin(a) * d * .8;
        if (pastLight(x, y, lights) < gap) continue;
        if (!f.walkable(Math.floor(x / TILE), Math.floor((y - 1) / TILE))) break;
        const [lo, hi] = SHAPE.life;
        return { x, y, alpha: 0, age: 0, life: lo + (hi - lo) * this.rnd(), state: 'stand', seed: Math.floor(this.rnd() * 1e6) };
      }
    }
    return null;
  }

  private updatePrints(f: DarkFrame, band: HushBand): void {
    if (!this.hold) for (const p of this.prints) p.age += f.dt;
    this.prints = this.prints.filter(p => p.age < STEPS.life);
    if (!darkBornHere(f.dark, f.phase, f.safe)) { this.stepSpell = 0; return; }
    if (this.stepSpell > 0) {
      this.stepSpell -= f.dt;
      if (!f.keeper.moving || (this.stepEvery -= f.dt) > 0 || this.prints.length >= STEPS.max) return;
      this.stepEvery = STEPS.every;
      const at = printSpot(f.trail, f.keeper.x, f.keeper.y, Math.max(f.own.r, f.glim?.r ?? 0));
      if (at && pastLight(at.x, at.y, this.lightsOf(f)) >= 0) {
        const last = this.prints[this.prints.length - 1];
        this.prints.push({ x: at.x, y: at.y, age: 0, left: !(last?.left ?? false) });
      }
      return;
    }
    // A spell of steps now and then, only while the Keeper walks; more often as the Hush deepens.
    if (f.keeper.moving && (this.stepT -= f.dt * (1 + band * .5)) <= 0) {
      const [a, b] = STEPS.spell, [g0, g1] = STEPS.gap;
      this.stepSpell = a + (b - a) * this.rnd();
      this.stepT = g0 + (g1 - g0) * this.rnd();
    }
  }

  private updateOmens(f: DarkFrame, band: HushBand, awake: boolean): void {
    if (this.whisper && (this.whisper.age += f.dt) >= this.whisper.life) this.whisper = null;
    if (!awake || band === 0) { this.omenT = Math.max(this.omenT, 10); return; }
    if ((this.omenT -= f.dt) > 0) return;
    this.omenT = omenGap(band, this.rnd) ?? 30;
    const o = pickOmen(band, this.rnd);
    if (o) this.fire(o.kind, o.line, f);
  }
  /** An omen goes off: a far bell, the lights flicker, a whisper at the edge of the light. */
  fire(kind: OmenKind, line: number, f: Pick<DarkFrame, 'keeper' | 'own' | 'glim' | 'still'>): void {
    this.omen = { kind, seq: ++this.seq };
    if (kind === 'bell') { this.sfx('farbell'); return; }
    if (kind === 'flicker') { this.flickerT = f.still ? .3 : .7; return; }
    const text = kind === 'name' ? this.words.name : this.words.whispers[(line - 1) % Math.max(1, this.words.whispers.length)];
    if (!text) return;
    const a = this.rnd() * Math.PI * 2, r = Math.max(f.own.r, f.glim?.r ?? 0) * .9;
    this.whisper = { text, x: f.keeper.x + Math.cos(a) * r, y: f.keeper.y - 20 + Math.sin(a) * r * .55, age: 0, life: 3.4 };
    this.sfx('whisper');
  }

  // ── Shade-bound chests ─────────────────────────────────────────────────────

  /** The chests on this level. */
  chestsOn(levelId: string): readonly ShadeChestDef[] { return SHADE_CHESTS.filter(c => c.level === levelId); }
  isOpened(id: string): boolean { return this.opened.has(id); }
  markOpened(id: string): void { this.opened.add(id); }
  /** Is the light on this chest low enough for it to be there? */
  chestShown(ch: ShadeChestDef, f: Pick<DarkFrame, 'raised' | 'pet' | 'fixed'>): boolean {
    const x = ch.c * TILE + TILE / 2, y = ch.r * TILE + TILE;
    return shadeChestShown({ raised: f.raised, petLight: !!f.pet, fixed: pastLight(x, y, f.fixed) < 0 });
  }
  private updateChests(f: DarkFrame): void {
    for (const ch of this.chestsOn(f.levelId)) {
      const want = this.opened.has(ch.id) || this.chestShown(ch, f) ? 1 : 0, now = this.chestAlpha.get(ch.id) ?? 0;
      this.chestAlpha.set(ch.id, f.still ? want : now < want ? Math.min(want, now + f.dt * 1.5) : Math.max(want, now - f.dt * 3));
    }
  }

  // ── Nightroads ─────────────────────────────────────────────────────────────

  /** Is any Nightroad on this continent open now (night, an eclipse, or the Keeper on one)? */
  roadsOpen(continent: string, phase: SkyPhase, kx: number, ky: number): boolean {
    const on = nightroadAt(continent, Math.floor(kx / TILE), Math.floor((ky - 1) / TILE));
    return nightroadOpen(phase, !!on);
  }
  private updateRoads(f: DarkFrame): void {
    if (!f.surface) return;
    const open = this.roadsOpen(f.continent, f.phase, f.keeper.x, f.keeper.y);
    for (const n of NIGHTROADS) if (n.continent === f.continent) this.roadAlpha.set(n.id, nightroadFade(this.roadAlpha.get(n.id) ?? 0, open, f.phase, f.dt, f.still));
  }
  roadAlphaOf(id: string): number { return this.roadAlpha.get(id) ?? 0; }

  // ── Paint ──────────────────────────────────────────────────────────────────

  /** Under everything (the ground layer): an open Nightroad's planks. World transform set. */
  drawGround(c: CanvasRenderingContext2D, continent: string, inView: (x: number, y: number) => boolean): void {
    for (const n of NIGHTROADS) {
      const a = this.roadAlphaOf(n.id);
      if (n.continent !== continent || a <= .01) continue;
      c.globalAlpha = a;
      for (const [tc, tr] of n.road) if (inView(tc * TILE, tr * TILE)) plank(c, tc * TILE, tr * TILE, tc + tr);
      c.globalAlpha = 1;
    }
    // The nook's note: a pale page weighted with a stone (always there; only the road comes and goes).
    for (const n of NIGHTROADS) if (n.continent === continent && inView(n.note[0] * TILE, n.note[1] * TILE)) notePage(c, n.note[0] * TILE + 8, n.note[1] * TILE + 12);
  }

  /** Over the night pass (world transform): what only the dark shows. */
  drawOver(c: CanvasRenderingContext2D, f: { levelId: string; continent: string; surface: boolean; time: number; still: boolean; night: number }, inView: (x: number, y: number) => boolean): void {
    // An open road's pale nails, so it can be seen across the water.
    if (f.surface) for (const n of NIGHTROADS) {
      const a = this.roadAlphaOf(n.id);
      if (n.continent !== f.continent || a <= .01) continue;
      c.globalAlpha = .55 * a * Math.max(.3, f.night);
      c.fillStyle = CORE;
      for (const [tc, tr] of n.road) if (inView(tc * TILE, tr * TILE)) for (const [dx, dy] of [[2, 3], [13, 3], [2, 12], [13, 12]]) c.fillRect(tc * TILE + dx, tr * TILE + dy, 1, 1);
      c.globalAlpha = 1;
    }
    for (const p of this.prints) {
      const k = 1 - p.age / STEPS.life;
      c.globalAlpha = .42 * k; c.fillStyle = BONE;
      const x = Math.round(p.x + (p.left ? -2 : 2)), y = Math.round(p.y);
      c.fillRect(x - 1, y - 2, 2, 1); c.fillRect(x - 1, y, 2, 2);
      c.globalAlpha = 1;
    }
    for (const ch of this.chestsOn(f.levelId)) {
      const a = this.chestAlpha.get(ch.id) ?? 0;
      if (a > .01) shyChest(c, ch.c * TILE + TILE / 2, ch.r * TILE + TILE - 2, a, this.opened.has(ch.id), f.time, f.still);
    }
    for (const s of this.shapes) if (s.alpha > .01 && inView(s.x, s.y)) shape(c, s, f.time, f.still);
    const w = this.whisper;
    if (w) {
      const t = w.age / w.life, a = f.still ? 1 : t < .2 ? t / .2 : t > .75 ? (1 - t) / .25 : 1;
      c.font = '7px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.globalAlpha = .55 * a; c.fillStyle = INK; c.fillText(w.text, Math.round(w.x) + 1, Math.round(w.y) + 1);
      c.globalAlpha = .9 * a; c.fillStyle = CORE; c.fillText(w.text, Math.round(w.x), Math.round(w.y - (f.still ? 0 : t * 4)));
      c.globalAlpha = 1;
    }
  }

  /** The screen's edge at the deepest Hush: two art pixels of dark dithering inward (screen transform). */
  drawEdge(c: CanvasRenderingContext2D, w: number, h: number, px: number, time: number, still: boolean): void {
    if (this.band < 3) return;
    const a = still ? .5 : .42 + .12 * Math.sin(time * 1.3);
    c.globalAlpha = a; c.fillStyle = INK;
    const n = Math.ceil(Math.max(w, h) / px);
    for (let i = 0; i < n; i++) for (let d = 0; d < 2; d++) {
      if ((i + d) % 2) continue;
      const o = d * px;
      if (i * px < w) { c.fillRect(i * px, o, px, px); c.fillRect(i * px, h - px - o, px, px); }
      if (i * px < h) { c.fillRect(o, i * px, px, px); c.fillRect(w - px - o, i * px, px, px); }
    }
    c.globalAlpha = 1;
  }
}

/** One Nightroad tile: old grey planks across, dark seams, posts at the corners. */
function plank(c: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  c.fillStyle = '#3a2c3c'; c.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    c.fillStyle = (seed + i) % 3 ? '#6b5a6e' : '#5a4a5e'; c.fillRect(x, y + i * 4, TILE, 3);
    c.fillStyle = '#8a7a8c'; c.fillRect(x + ((seed * 5 + i * 7) & 7), y + i * 4, 3, 1);
  }
  c.fillStyle = INK; c.fillRect(x, y, 1, TILE); c.fillRect(x + TILE - 1, y, 1, TILE);
  c.fillStyle = EDGE; c.fillRect(x + 1, y + 1, 2, 2); c.fillRect(x + TILE - 3, y + TILE - 3, 2, 2);
}

/** The nook's note: a page under a small stone. (x, y) its foot. */
function notePage(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.fillStyle = INK; c.fillRect(x - 5, y - 4, 10, 6);
  c.fillStyle = BONE; c.fillRect(x - 4, y - 3, 8, 4);
  c.fillStyle = '#a89f8a'; c.fillRect(x - 3, y - 2, 5, 1); c.fillRect(x - 3, y, 4, 1);
  c.fillStyle = '#5a4a5e'; c.fillRect(x + 1, y - 5, 4, 3);
  c.fillStyle = '#8a7a8c'; c.fillRect(x + 2, y - 5, 2, 1);
}

/** A shy chest: dark wood, shadow-violet bands, a pale keyhole; a dithered violet ring under it. Open: the lid thrown back. */
function shyChest(c: CanvasRenderingContext2D, x: number, y: number, a: number, open: boolean, time: number, still: boolean): void {
  x = Math.round(x); y = Math.round(y);
  c.globalAlpha = a * .5; c.fillStyle = EDGE;
  const phase = still ? 0 : Math.floor(time * 2) % 2;
  for (let i = -8; i <= 8; i++) if ((i + phase) % 2 === 0) { c.fillRect(x + i, y + 1, 1, 1); }
  for (const i of [-9, 9]) c.fillRect(x + i, y, 1, 1);
  c.globalAlpha = a;
  c.fillStyle = INK; c.fillRect(x - 7, y - 9, 14, 10);
  c.fillStyle = '#3a2430'; c.fillRect(x - 6, y - 5, 12, 5);
  c.fillStyle = BODY; c.fillRect(x - 6, y - 5, 12, 1); c.fillRect(x - 4, y - 5, 1, 5); c.fillRect(x + 3, y - 5, 1, 5);
  if (open) {
    c.fillStyle = INK; c.fillRect(x - 6, y - 12, 12, 4);
    c.fillStyle = '#3a2430'; c.fillRect(x - 5, y - 11, 10, 2);
    c.fillStyle = '#0a0610'; c.fillRect(x - 5, y - 7, 10, 2);
  } else {
    c.fillStyle = '#4a2c3c'; c.fillRect(x - 6, y - 8, 12, 3);
    c.fillStyle = EDGE; c.fillRect(x - 6, y - 8, 12, 1);
    c.fillStyle = CORE; c.fillRect(x, y - 4, 1, 2);
  }
  c.globalAlpha = 1;
}

/** An Unrecorded: a hooded shape, darker than the dark, a faint violet rim, two pale points for eyes. (x, y) its foot. */
function shape(c: CanvasRenderingContext2D, s: Shape, time: number, still: boolean): void {
  const x = Math.round(s.x), y = Math.round(s.y), a = s.alpha;
  // Rows bottom up: [left offset, width]; the foot dithers away into the ground.
  const rows: [number, number][] = [[-4, 8], [-5, 10], [-5, 10], [-5, 10], [-5, 10], [-5, 10], [-5, 10], [-6, 12], [-6, 12], [-6, 12],
    [-6, 12], [-5, 10], [-5, 10], [-4, 8], [-3, 6], [-3, 6], [-4, 8], [-4, 8], [-4, 8], [-4, 8], [-3, 6], [-2, 4]];
  c.globalAlpha = a * .35; c.fillStyle = EDGE;
  rows.forEach(([x0, w], i) => { c.fillRect(x + x0 - 1, y - 1 - i, 1, 1); c.fillRect(x + x0 + w, y - 1 - i, 1, 1); });
  c.fillStyle = INK;
  rows.forEach(([x0, w], i) => {
    if (i < 3) { c.globalAlpha = a * (.3 + i * .2); for (let k = 0; k < w; k++) if ((k + i) % 2 === 0) c.fillRect(x + x0 + k, y - 1 - i, 1, 1); return; }
    c.globalAlpha = a; c.fillRect(x + x0, y - 1 - i, w, 1);
  });
  // Eyes: two pale points; a slow blink now and then (held open under reduced motion).
  const blink = !still && ((time * .7 + s.seed % 7) % 5) < .12;
  if (!blink) { c.globalAlpha = a * .9; c.fillStyle = CORE; c.fillRect(x - 2, y - 19, 1, 1); c.fillRect(x + 1, y - 19, 1, 1); }
  c.globalAlpha = 1;
}

export type { NightroadDef };
