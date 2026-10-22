/**
 * camp-art.ts — the character select as a campfire in a clearing, Diablo II style (owner, 2026-10-21: "would be nice
 * to have the new character picker be like in a campfire like in d2 style").
 *
 * The title's night (title-art.ts: sky, stars, the eclipse, the hills) with a clearing below it, a lit cottage on the
 * ridge and a campfire in the middle. Each Keeper on the roster stands at one of five places around the fire as their
 * own front sprite (keeper-front.ts, the painter the world uses), the fire's light flickering warm on them; the chosen
 * one steps toward the fire. The Glass reuses the scene with the four callings standing there instead.
 *
 * Painted at whole-pixel scale `s` (2–4 CSS px per art px, picked so the group fits the stage the page gives it) on a
 * canvas covering the whole lobby, so the sprites are real pixel art at any size. The HTML buttons that pick a Keeper
 * sit over the sprites: {@link spotBox} gives their boxes. Reduced motion paints still frames (`still`): no flicker, no
 * sparks moving, the step forward is taken at once.
 */
import { type KeeperLook } from '../../shared/keeper-look/keeper-look.model';
import type { KeeperGear } from '../../shared/keeper-look/keeper-gear';
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { FRONT_AX, FRONT_AY, FRONT_H, FRONT_W, drawWornFront, frontSheet } from '../../shared/keeper-look/keeper-front';
import { carriesStaff, vocationLook } from '../../shared/keeper-look/vocation-look';
import { FIRE, MOTE, nearRidge, paintCottage, paintNight } from './title-art';

type Slots = ReadonlyArray<readonly [number, number]>;
/** The five places by the fire (art px from the fire's base): left, right, back-left, back-right, back-centre. */
export const CAMP_SLOTS: Slots = [[-56, -4], [56, -4], [-30, -22], [30, -22], [0, -30]];
/** The same five on a tall, narrow stage (a phone held upright): a deeper ring, so the group can be drawn larger. */
export const CAMP_SLOTS_TALL: Slots = [[-38, 4], [38, 4], [-22, -30], [22, -30], [0, -70]];

/**
 * The two arrangements: the art px the group needs (with its name tags and a margin), how far its centre sits above the
 * fire, how far above the fire the hills begin, and how deep the trodden clearing is.
 */
const ARRANGEMENTS = {
  wide: { slots: CAMP_SLOTS, needW: 170, needH: 92, lift: 28, hills: 52, deep: 24 },
  tall: { slots: CAMP_SLOTS_TALL, needW: 118, needH: 128, lift: 48, hills: 90, deep: 40 },
} as const;
/** How far the chosen Keeper steps toward the fire (art px). */
const STEP = 5;

export interface Rect { x: number; y: number; w: number; h: number }

/** The scene's size and where its fire is, for a lobby of `viewW`×`viewH` CSS px and the stage box inside it. */
export interface CampLayout {
  /** CSS px per art px. */
  s: number;
  /** The canvas in art px (it covers the whole lobby). */
  w: number;
  h: number;
  /** The fire's base (art px). */
  fx: number;
  fy: number;
  horizon: number;
  /** Where the five places are (one of the arrangements above). */
  slots: Slots;
  /** The clearing's depth (art px). */
  deep: number;
}

/**
 * Lay the scene out: the group (the fire and five places, about 140×80 art px with the name tags) centred in `stage`
 * at the largest whole scale from 2 to 4 that fits it. No stage (or none worth the name): the whole lobby.
 */
export function campLayout(viewW: number, viewH: number, stage: Rect | null): CampLayout {
  const st = stage && stage.w >= 40 && stage.h >= 40 ? stage : { x: 0, y: 0, w: viewW, h: viewH };
  const scale = (a: { needW: number; needH: number }) => Math.max(2, Math.min(4, Math.floor(Math.min(st.w / a.needW, st.h / a.needH))));
  // The deeper ring only when it lets the Keepers be drawn bigger (a phone held upright).
  const a = scale(ARRANGEMENTS.tall) > scale(ARRANGEMENTS.wide) ? ARRANGEMENTS.tall : ARRANGEMENTS.wide;
  const s = scale(a);
  const w = Math.max(1, Math.ceil(viewW / s)), h = Math.max(1, Math.ceil(viewH / s));
  const fx = Math.round((st.x + st.w / 2) / s);
  // Centre the group (from the back Keeper's head to the front tags) in the stage.
  const fy = Math.min(h - 8, Math.round((st.y + st.h / 2) / s + a.lift));
  const horizon = Math.max(Math.round(h * 0.2), fy - a.hills);
  return { s, w, h, fx, fy, horizon, slots: a.slots, deep: a.deep };
}

/** Place `i`'s box (the sprite's 28×40 cell) in CSS px relative to `stage`'s top-left. */
export function spotBox(l: CampLayout, i: number, stage: Rect): Rect {
  const [dx, dy] = l.slots[i] ?? l.slots[0];
  return {
    x: (l.fx + dx - FRONT_AX) * l.s - stage.x,
    y: (l.fy + dy - FRONT_AY) * l.s - stage.y,
    w: FRONT_W * l.s,
    h: FRONT_H * l.s,
  };
}

/** One figure by the fire: a Keeper on the roster, or a calling on the Glass. */
export interface CampFigure {
  key: string;
  look: KeeperLook;
  chosen: boolean;
  /** A calling not yet open (the Wanewalkers, shared/lore): a faint, cold silhouette that drifts, never steps forward. */
  ghost?: boolean;
  /** What the Keeper wears (keeper-look worn-gear): its worn looks over the class kit. `key` must change with it. */
  gear?: KeeperGear | null;
}

const CLEARING = '#170e1c';
const LIGHT = ['#5c3420', '#4a2a1c', '#36201c', '#26161c'];
const STONE = '#4a3c42', STONE_LO = '#2e242c', STONE_HI = '#6a5a5e';
const LOG = '#5a3820', LOG_LO = '#3a2414', LOG_HI = '#7a5030';
const EMBER = '#ff7a2e';
const SHADOW = '#0a0610';
const RING = ['#ffd27a', '#c99a3e'];
const WARM = '#ffb45a';

/** A small deterministic generator (the grass tufts are the same every visit). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Sprite { sheet: HTMLCanvasElement; lit: HTMLCanvasElement; ghost: HTMLCanvasElement; painter: KeeperPainter }
const GHOST = '#b8d0f0';

/** The campfire painter. One per lobby: it holds the baked sprites and each place's step toward the fire. */
export class CampArt {
  private readonly sprites = new Map<string, Sprite>();
  private readonly steps = new Map<number, number>();

  /** Is a place still stepping (forward or back)? The page keeps painting until it settles, even when still. */
  get moving(): boolean { return this.stepping; }
  private stepping = false;

  /**
   * One frame. `figures[i]` stands at place i (null: nobody); `empty` is the place shown as free ("New Keeper"), or
   * null. `still`: reduced motion (time is held, the chosen one is already forward).
   */
  paint(c: CanvasRenderingContext2D, l: CampLayout, figures: ReadonlyArray<CampFigure | null>, empty: number | null, time: number, still: boolean): void {
    const { w, h, fx, fy, horizon, slots, deep } = l;
    const t = still ? 0 : time;
    const px = (x: number, y: number, col: string, ww = 1, hh = 1): void => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), ww, hh); };
    c.imageSmoothingEnabled = false;

    // The eclipse low over the hills, off to the right of the fire (clear of the heading above the stage).
    const sunR = Math.max(6, Math.min(12, Math.round(horizon * 0.12)));
    paintNight(c, w, h, t, {
      horizon,
      sunX: Math.max(sunR * 2, Math.min(w - sunR * 2, fx + Math.round(Math.min(64, w * 0.3)))),
      sunY: Math.max(sunR + 4, horizon - Math.round(sunR * 2.6)),
      sunR,
    });

    // The cottage up on the ridge, off to one side (left when the right has no room).
    const right = fx + 74 + 26 <= w;
    const hx = right ? fx + 74 : Math.max(2, fx - 98);
    paintCottage(c, hx, nearRidge(hx + 10, horizon) - 10, t, false);

    // The clearing: trodden ground in an oval round the fire, its edge dithered into the dark.
    for (let y = -deep - 2; y <= 22; y++) for (let x = -92; x <= 92; x++) {
      const d = Math.hypot(x / 92, (y < 0 ? y / deep : y / 22));
      if (d > 1) continue;
      if (d > 0.82 && (x + y) % 2 !== 0) continue;
      const yy = fy + y;
      if (yy < horizon + 10) continue;
      px(fx + x, yy, CLEARING);
    }
    // Grass tufts round the edge.
    const grass = rng(53);
    for (let i = 0; i < 70; i++) {
      const a = grass() * Math.PI * 2, r = 0.85 + grass() * 0.5;
      const gx = fx + Math.round(Math.cos(a) * 92 * r), gy = fy + Math.round(Math.sin(a) * (Math.sin(a) < 0 ? deep : 22) * r);
      if (gy < horizon + 12 || gy >= h) continue;
      px(gx, gy - 1, '#2a2238'); px(gx + 1, gy - 2, '#3a3050'); px(gx + 2, gy - 1, '#2a2238');
    }

    // The firelight on the ground: warm rings, breathing with the flames.
    const glow = still ? 1 : 0.9 + 0.1 * Math.sin(t * 6.1) * Math.sin(t * 2.3 + 1);
    for (let y = -16; y <= 12; y++) for (let x = -64; x <= 64; x++) {
      const d = Math.hypot(x / 64, y / 15) / glow;
      if (d > 1) continue;
      const ring = Math.min(LIGHT.length - 1, Math.floor(d * LIGHT.length));
      if (ring >= 2 && (x + y) % 2 !== 0) continue;
      if (ring === 3 && (x * 3 + y) % 4 !== 0) continue;
      px(fx + x, fy + y, LIGHT[ring]);
    }

    // The free place: a stump to sit on, and a faint ring where a new Keeper would stand.
    if (empty !== null && slots[empty]) {
      const [dx, dy] = slots[empty];
      const ex = fx + dx, ey = fy + dy;
      for (let a = 0; a < 20; a++) {
        if (a % 2) continue;
        const ang = (a / 20) * Math.PI * 2;
        px(ex + Math.round(Math.cos(ang) * 10), ey + Math.round(Math.sin(ang) * 3), '#4a3a58');
      }
      px(ex - 4, ey - 4, LOG, 8, 4); px(ex - 4, ey - 1, LOG_LO, 8, 1); px(ex - 3, ey - 5, LOG_HI, 6, 1); px(ex - 1, ey - 4, '#9a7048', 2, 1);
    }

    // The Keepers, back to front, each with a shadow cast away from the fire and the firelight on them.
    this.stepping = false;
    const order = figures.map((f, i) => ({ f, i })).filter((e): e is { f: CampFigure; i: number } => !!e.f && !!slots[e.i])
      .sort((a, b) => slots[a.i][1] - slots[b.i][1]);
    for (const { f, i } of order) {
      const [dx, dy] = slots[i];
      const want = f.chosen ? 1 : 0;
      const had = this.steps.get(i) ?? want;
      const now = still || Math.abs(want - had) < 0.02 ? want : had + (want - had) * 0.3;
      if (now !== want) this.stepping = true;
      this.steps.set(i, now);
      const len = Math.hypot(dx, dy) || 1;
      const ax = Math.round(fx + dx - (dx / len) * STEP * now), ay = Math.round(fy + dy - (dy / len) * STEP * now + now);
      // Shadow: a dark oval at the feet, pushed away from the fire.
      const sx = ax + Math.round((dx / len) * 3);
      for (let y = -2; y <= 1; y++) for (let x = -9; x <= 9; x++) {
        if (Math.hypot(x / 9, y / 2.2) > 1 || (x + y) % 2 !== 0) continue;
        px(sx + x, ay + y, SHADOW);
      }
      if (f.chosen) {
        // The chosen one: a brass ring at their feet.
        for (let a = 0; a < 28; a++) {
          const ang = (a / 28) * Math.PI * 2;
          px(ax + Math.round(Math.cos(ang) * 11), ay + Math.round(Math.sin(ang) * 3.4), RING[a % 2]);
        }
      }
      const sprite = this.sprite(f);
      if (!sprite) continue;
      if (f.ghost) {
        // The thin one: a pale silhouette, half there, drifting a pixel up and down and fading in and out.
        const drift = still ? 0 : Math.round(Math.sin(t * 0.9) * 1.5);
        c.globalAlpha = still ? 0.38 : 0.3 + 0.12 * Math.sin(t * 1.3);
        c.drawImage(sprite.ghost, 0, 0, FRONT_W, FRONT_H, ax - FRONT_AX, ay - FRONT_AY - 2 + drift, FRONT_W, FRONT_H);
        c.globalAlpha = 1;
        continue;
      }
      const frame = still ? 0 : (Math.sin(t * 1.5 + i * 1.7) > 0.55 ? 1 : 0);
      const ox = ax - FRONT_AX, oy = ay - FRONT_AY;
      c.drawImage(sprite.sheet, frame * FRONT_W, 0, FRONT_W, FRONT_H, ox, oy, FRONT_W, FRONT_H);
      // Firelight: the warm copy over it, flickering; the chosen one (nearer) catches more of it.
      const flick = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 8.3 + i) * Math.sin(t * 3.7 + i * 2);
      c.globalAlpha = (f.chosen ? 0.34 : 0.22) + 0.12 * flick;
      c.drawImage(sprite.lit, frame * FRONT_W, 0, FRONT_W, FRONT_H, ox, oy, FRONT_W, FRONT_H);
      c.globalAlpha = 1;
      // What it wears, alive: eyes glowing in a cowl, embers off a crown, a censer's smoke (worn-fx.ts).
      drawWornFront(c, sprite.painter, 'down', frame, ox, oy, t, still);
    }

    // The fire: a ring of stones, two crossed logs, the flames, embers, and sparks rising into the dark.
    // The back half of the ring first (behind the logs and flames), the front half last.
    const stones = (front: boolean): void => {
      for (let a = 0; a < 14; a++) {
        const ang = (a / 14) * Math.PI * 2;
        if ((Math.sin(ang) > 0) !== front) continue;
        const sx = fx + Math.round(Math.cos(ang) * 11), sy = fy + Math.round(Math.sin(ang) * 4);
        px(sx - 1, sy - 1, STONE, 3, 2); px(sx - 1, sy, STONE_LO, 3, 1); px(sx - 1, sy - 1, STONE_HI, 1, 1);
      }
    };
    stones(false);
    for (let k = -7; k <= 7; k++) { px(fx + k, fy - 1 + Math.round(k * 0.3), LOG); px(fx + k, fy + Math.round(k * 0.3), LOG_LO); }
    for (let k = -7; k <= 7; k++) { px(fx + k, fy - 1 - Math.round(k * 0.3), LOG_HI); px(fx + k, fy - Math.round(k * 0.3), LOG_LO); }
    for (let x = -5; x <= 5; x++) {
      const n = still ? 0.6 : 0.5 + 0.5 * Math.sin(t * 11 + x * 1.9) * Math.sin(t * 5.3 + x * 0.7);
      const tall = Math.max(1, Math.round((12 - Math.abs(x) * 1.9) * (0.7 + 0.45 * n)));
      for (let y = 0; y < tall; y++) {
        const k = y / tall;
        px(fx + x, fy - 2 - y, k < 0.3 ? FIRE[3] : k < 0.6 ? FIRE[2] : k < 0.85 ? FIRE[1] : FIRE[0]);
      }
    }
    px(fx - 1, fy - 3, FIRE[0], 2, 2); px(fx + 1, fy - 5, FIRE[0], 1, 1);
    for (let i = 0; i < 6; i++) if (still || Math.sin(t * 4 + i * 2.1) > 0) px(fx - 5 + i * 2, fy + 1, EMBER);
    stones(true);
    if (!still) {
      for (let i = 0; i < 9; i++) {
        const age = (t * 0.45 + i / 9) % 1;
        if (age > 0.85 && i % 2) continue;
        const sx = fx + Math.round(Math.sin(age * 7 + i * 1.3) * (2 + age * 7)), sy = fy - 12 - Math.round(age * 54);
        px(sx, sy, age < 0.4 ? FIRE[1] : age < 0.75 ? MOTE : FIRE[2]);
      }
    } else {
      for (const [sx, sy] of [[1, 16], [-3, 24], [2, 35]]) px(fx + sx, fy - sy, MOTE);
    }
  }

  /** The figure's front sheet (the world's own painter) and its firelit copy, baked once per look. */
  private sprite(f: CampFigure): Sprite | null {
    const held = this.sprites.get(f.key);
    if (held) return held;
    try {
      const v = vocationLook(f.look.vocation, f.gear ?? null);
      const painter = new KeeperPainter(f.look, v.gear, v.garb);
      const sheet = frontSheet(painter, carriesStaff(f.look.vocation));
      const lit = document.createElement('canvas');
      lit.width = FRONT_W * 2; lit.height = FRONT_H;
      const c = lit.getContext('2d');
      if (!c) return null;
      c.imageSmoothingEnabled = false;
      c.drawImage(sheet, 0, 0, FRONT_W * 2, FRONT_H, 0, 0, FRONT_W * 2, FRONT_H);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = WARM;
      c.fillRect(0, 0, FRONT_W * 2, FRONT_H);
      const ghost = document.createElement('canvas');
      ghost.width = FRONT_W; ghost.height = FRONT_H;
      const g = ghost.getContext('2d');
      if (g) {
        g.imageSmoothingEnabled = false;
        g.drawImage(sheet, 0, 0, FRONT_W, FRONT_H, 0, 0, FRONT_W, FRONT_H);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = GHOST;
        g.fillRect(0, 0, FRONT_W, FRONT_H);
        // Two cold eyes where the face would be, and the hem fraying into the air.
        g.fillStyle = '#4a5a84'; g.fillRect(10, 13, 2, 2); g.fillRect(16, 13, 2, 2);
        g.fillStyle = '#e8f2ff'; g.fillRect(10, 13, 1, 1); g.fillRect(16, 13, 1, 1);
        g.globalCompositeOperation = 'destination-out';
        for (let x = 0; x < FRONT_W; x += 2) g.fillRect(x, FRONT_H - 4 + (x % 4 ? 1 : 0), 1, 4);
      }
      const sprite = { sheet, lit, ghost, painter };
      // The Glass bakes one per look tried on: keep the cache small.
      if (this.sprites.size > 48) this.sprites.clear();
      this.sprites.set(f.key, sprite);
      return sprite;
    } catch {
      return null;
    }
  }
}
