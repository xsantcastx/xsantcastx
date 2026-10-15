/**
 * creature-pixel.ts — the hunt and Delve creatures as pixel sprites (one art
 * style, 2026-10-14).
 *
 * Owner: "go pixel ... make it consistent." The creatures were the last smooth
 * paintings bent by a mesh rig (creature-rigs.ts) standing next to a pixel
 * Keeper. Each one is now drawn here, procedurally, on the Keeper's own grid:
 * 4 world px per art px in the towns and hunts, 2 in the Delve (the engine's
 * figureScale), the same one-pixel outline (keeper-paint.ts OUTLINE), light
 * from the upper left, colours only from the realm ramps of the art bible
 * (docs/art/style-guide.md §5) and the creature briefs
 * (docs/art-commissions/world-sprites/02-creatures.md).
 *
 * Seven frames per creature — idle ×2, move ×2, wind-up, strike, hurt — each
 * painted once into a small canvas, outlined, and cached; the white hit flash
 * is a cached copy too. Per frame a creature costs one blit.
 *
 * A commissioned sprite sheet still wins when it lands (`spriteFor` in the
 * engine); these are the in-house frames until then. Browser only (canvas).
 */
import { canvas, limb, outlined, px } from '../../shared/keeper-look/keeper-paint';
import { REALM_CREATURE_ART } from './realm-creatures';

export type CreatureFrame = 'idle0' | 'idle1' | 'move0' | 'move1' | 'windup' | 'strike' | 'hurt';
export const CREATURE_FRAMES: readonly CreatureFrame[] = ['idle0', 'idle1', 'move0', 'move1', 'windup', 'strike', 'hurt'];

/** What a frame does to the body: a breath, a stride, the coil before a strike, the lunge, a flinch. */
export interface CreaturePose { bob: number; step: number; coil: number; lunge: number; open: number; hurt: boolean }
export const CREATURE_POSES: Readonly<Record<CreatureFrame, CreaturePose>> = {
  idle0: { bob: 0, step: 0, coil: 0, lunge: 0, open: 0, hurt: false },
  idle1: { bob: 1, step: 0, coil: 0, lunge: 0, open: 0, hurt: false },
  move0: { bob: 0, step: 1, coil: 0, lunge: 0, open: 0, hurt: false },
  move1: { bob: 1, step: -1, coil: 0, lunge: 0, open: 0, hurt: false },
  windup: { bob: 1, step: 0, coil: 1, lunge: 0, open: .5, hurt: false },
  strike: { bob: 0, step: 0, coil: 0, lunge: 1, open: 1, hurt: false },
  hurt: { bob: 0, step: 0, coil: 0, lunge: 0, open: .25, hurt: true },
};

type Ctx = CanvasRenderingContext2D;
type P = (x: number, y: number, w: number, h: number, color: string) => void;
type L = (x0: number, y0: number, x1: number, y1: number, t: number, color: string) => void;

/** One creature's art: its cell (art px, feet on the bottom row) and how a pose paints. */
export interface CreatureArt {
  w: number; h: number;
  paint: (p: P, l: L, q: CreaturePose) => void;
}

// ── Ramps (docs/art/style-guide.md §5.2–5.3, the creature briefs) ──
const BASALT = ['#241a1c', '#3a2b2c', '#5a4440', '#6b5148'];
const IRON = ['#171116', '#2a2027', '#443540', '#57474f'];
const EMBER = ['#7a2a12', '#c4501e', '#E8752A'];
const HOT = ['#ff9b4f', '#ffd08a', '#fff4dc'];
const STONE = ['#4a4030', '#8a7a58', '#c9b88e', '#efe4c8'];
const GOLD = ['#7a5a14', '#b8901e', '#E8D44D'];
const DAWN = ['#ffe7a0', '#fff1b0', '#fffaf0'];
const NIGHT = ['#0e0912', '#1a1220', '#33263a', '#4a3260'];
const AMETHYST = ['#5a2f8a', '#7b4fc0', '#A855F7', '#c9a0ff'];
const MOON = ['#8a90b0', '#d8dcf0'];
const MIDNIGHT = ['#0a1428', '#14284a', '#24406e', '#3a5a8a'];
const SILVER = ['#6a7890', '#a8b8cc', '#d8ecff'];
const ORBIT = ['#1e5a9a', '#5fb6ff', '#00d4ff'];
const BRASS = ['#8a6a3a', '#b08a55', '#e8c47a'];
const MOSS = ['#1e2a14', '#3a5a2a', '#4a7a3a', '#7fb85a'];
const ROOT = ['#24190f', '#3a2a1c', '#7a5a36', '#b08a55'];
const AMBER = ['#6a4010', '#c08a3e', '#e0b060'];
const BIOLUME = ['#2a8a6a', '#7fd5a3', '#c4ffe0'];
const GROTTO = ['#08161e', '#1c3846', '#2c5668', '#4a8296', '#86d2e6'];

/** Feet that step: a pair of legs lift in turn with the stride. */
const lifted = (q: CreaturePose, near: boolean): number => (q.step === 0 ? 0 : (q.step > 0) === near ? 1 : 0);

// ── Chibi shapes (2026-10-15): round bodies, big eyes, still a clear threat ──
// Owner: "make the character a bit more tender smaller like very cute type style
// of maple story". The creatures follow the Keeper: soft round silhouettes in
// pixel ellipses, big readable eyes that turn into an angry glare (a brow and a
// lit pupil) on the wind-up and the lunge, and squeeze shut when hit. The
// telegraph stays: coil back, mouth or weapon out, the white flash.

/** A filled pixel ellipse: centre (cx, cy), radii rx, ry. */
function blob(p: P, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + .5)) ** 2)));
    p(cx - half, cy + dy, half * 2 + 1, 1, color);
  }
}
/** A round body, lit from the upper left: mid tone, a shadowed belly, a soft highlight. */
function orb(p: P, cx: number, cy: number, rx: number, ry: number, lo: string, mid: string, hi: string): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + .5)) ** 2)));
    p(cx - half, cy + dy, half * 2 + 1, 1, dy >= ry - 1 ? lo : mid);
    if (dy < 0) p(cx - half, cy + dy, 1, 1, hi);
  }
  blob(p, cx - Math.round(rx * .35), cy - Math.round(ry * .45), Math.max(1, Math.round(rx * .3)), Math.max(0, Math.round(ry * .2)), hi);
}
const PUPIL = '#1a1020', WHITE = '#fff4ea';
/** A big 3×3 eye: white with a dark pupil looking ahead; a brow and a lit pupil when it means it; shut when hit. */
function eye(p: P, x: number, y: number, q: CreaturePose, glow: string): void {
  if (q.hurt) { p(x, y + 1, 1, 1, PUPIL); p(x + 1, y + 2, 1, 1, PUPIL); p(x + 2, y + 1, 1, 1, PUPIL); return; }
  const angry = q.coil > 0 || q.lunge > 0;
  p(x, y, 3, 3, WHITE);
  p(x + 1, y + 1, 2, 2, angry ? glow : PUPIL);
  if (angry) p(x + 1, y + 1, 1, 1, WHITE);
  if (angry) { p(x - 1, y - 1, 2, 1, PUPIL); p(x + 1, y, 2, 1, PUPIL); }
}
/** The whole-body shift of a pose: forward on the lunge, back on the coil, a flinch when hit. */
const shift = (q: CreaturePose, lunge: number, coil: number, hurt = 2): number => Math.round(q.lunge * lunge - q.coil * coil - (q.hurt ? hurt : 0));

/** The Rivet Maw: a round basalt scavenger on four stubby legs, rivet studs down its back, a box jaw with an ember seam. */
const RIVET_MAW: CreatureArt = {
  w: 38, h: 22,
  paint(p, _l, q) {
    const X = shift(q, 3, 2), Y = q.bob + q.coil;
    blob(p, 3 + X, 10 + Y, 2, 2, BASALT[1]); // the tail stub
    for (const [x, far] of [[8, true], [20, true], [11, false], [23, false]] as const) {
      const up = lifted(q, !far), top = 14 + Y;
      p(x + X, top, 3, 20 - up - top, far ? IRON[0] : IRON[1]);
      p(x + X - 1, 20 - up, 5, 2, far ? IRON[0] : IRON[2]);
    }
    orb(p, 15 + X, 10 + Y, 12, 6, BASALT[0], BASALT[1], BASALT[3]);
    for (let k = 0; k < 3; k++) {
      const x = 9 + k * 6 + X, y = 5 + Y + (k === 1 ? -1 : 0);
      blob(p, x + 1, y + 1, 1, 1, IRON[2]); p(x, y, 3, 1, IRON[3]); p(x + 1, y + 1, 1, 1, '#877c84');
    }
    p(6 + X, 12 + Y, 16, 1, EMBER[0]); p(9 + X, 12 + Y, 2, 1, EMBER[2]); p(16 + X, 12 + Y, 3, 1, EMBER[1]);
    // The head: a round iron box, a big eye, the ember mouth.
    const hy = 9 + Y - q.coil, gap = Math.round(q.open * 3);
    p(24 + X, hy - 6, 2, 2, IRON[2]); // an ear nub
    orb(p, 29 + X, hy, 6, 4, IRON[0], IRON[1], IRON[3]);
    eye(p, 28 + X, hy - 3, q, HOT[1]);
    if (gap) {
      p(24 + X, hy + 2, 11, gap + 1, EMBER[0]);
      for (let t = 0; t < 5; t++) { p(25 + X + t * 2, hy + 2, 1, 1, HOT[2]); p(26 + X + t * 2, hy + 2 + gap, 1, 1, HOT[1]); }
    } else p(26 + X, hy + 2, 8, 1, EMBER[2]);
    p(24 + X, hy + 3 + gap, 11, 2, IRON[1]); p(25 + X, hy + 5 + gap, 9, 1, IRON[0]); p(25 + X, hy + 3 + gap, 8, 1, IRON[2]);
  },
};

/** The Prism Forager: a small round crystal forager of ivory and gold, a hollow chest full of light. */
const PRISM_FORAGER: CreatureArt = {
  w: 28, h: 34,
  paint(p, l, q) {
    const X = shift(q, 3, 2), Y = q.bob + q.coil;
    for (const [x, far] of [[10, true], [15, false]] as const) {
      const up = lifted(q, !far), top = 25 + Y;
      p(x + X, top, 2, 32 - up - top, far ? STONE[1] : STONE[2]);
      p(x + X - 1, 32 - up, 4, 2, far ? STONE[0] : STONE[1]);
    }
    p(5 + X, 12 + Y, 2, 5, DAWN[0]); p(3 + X, 15 + Y, 2, 4, DAWN[0]); p(5 + X, 12 + Y, 1, 2, DAWN[2]); // back shards
    l(8 + X, 18 + Y, 6 + X, 24 + Y, 2, STONE[1]); // the far arm
    orb(p, 13 + X, 20 + Y, 6, 6, STONE[1], STONE[2], STONE[3]);
    // The hollow chest: a gold-rimmed diamond of refracted light.
    for (let r = -2; r <= 2; r++) {
      const half = 2 - Math.abs(r);
      p(13 + X - half - 1, 21 + Y + r, 1, 1, GOLD[1]); p(13 + X + half + 1, 21 + Y + r, 1, 1, GOLD[1]);
      p(13 + X - half, 21 + Y + r, half * 2 + 1, 1, r < 0 ? DAWN[2] : DAWN[1]);
    }
    p(13 + X, 21 + Y, 1, 1, q.hurt ? STONE[1] : GOLD[2]);
    // The head: a big round crystal with a faceted crown, two eyes.
    const hx = 14 + X + q.lunge, hy = 9 + Y + q.coil;
    p(hx - 3, hy - 8, 2, 3, DAWN[1]); p(hx, hy - 9, 2, 4, DAWN[2]); p(hx + 3, hy - 7, 2, 2, DAWN[0]);
    orb(p, hx, hy, 6, 5, STONE[1], STONE[3], DAWN[2]);
    eye(p, hx - 1, hy - 1, q, GOLD[2]); eye(p, hx + 3, hy - 1, q, GOLD[2]);
    if (q.open > .4) p(hx + 2, hy + 3, 3, 2, NIGHT[1]); else p(hx + 3, hy + 3, 2, 1, STONE[0]);
    // The near arm and its claw: hanging, drawn back on the wind-up, thrust on the strike.
    const ax = 17 + X, ay = 18 + Y;
    const [cx, cy] = q.coil ? [10 + X, 8 + Y] : q.lunge ? [24 + X, 18 + Y] : [19 + X, 25 + Y + q.bob];
    l(ax, ay, cx, cy, 2, STONE[2]); p(cx - 1, cy - 1, 3, 3, DAWN[0]); p(cx + 1, cy - 2, 1, 2, DAWN[2]);
  },
};

/** The Ephemeris Leech: a round-segmented star-silver crawler, a dark glass abdomen full of stars. */
const EPHEMERIS_LEECH: CreatureArt = {
  w: 40, h: 17,
  paint(p, l, q) {
    const X = shift(q, 4, 2), Y = q.bob;
    const rear = q.coil ? -2 : 0;
    for (let k = 0; k < 3; k++) {
      const x = 14 + k * 6 + X, up = lifted(q, k !== 1);
      l(x, 11 + Y, x - 1, 16 - up, 1, SILVER[1]); p(x - 1, 14, 1, 1, BRASS[1]);
      l(x + 2, 11 + Y, x + 3, 16 - up, 1, SILVER[2]);
    }
    orb(p, 8 + X, 9 + Y + rear, 7, 5, MIDNIGHT[0], MIDNIGHT[1], MIDNIGHT[3]);
    for (const [sx, sy] of [[5, 10], [8, 8], [11, 10], [7, 12]] as const) p(sx + X, sy + Y + rear, 1, 1, SILVER[2]);
    p(9 + X, 10 + Y + rear, 1, 1, ORBIT[2]);
    for (let k = 0; k < 3; k++) {
      const x = 17 + k * 5 + X;
      orb(p, x, 9 + Y, 3, 3, SILVER[0], SILVER[1], SILVER[2]); p(x + 2, 8 + Y, 1, 3, BRASS[1]);
    }
    const hy = 8 + Y + q.coil;
    l(29 + X, hy - 4, 27 + X, hy - 7, 1, SILVER[1]); p(26 + X, hy - 8, 2, 2, ORBIT[1]); // the feeler
    orb(p, 30 + X, hy, 4, 4, SILVER[0], SILVER[1], SILVER[2]);
    eye(p, 30 + X, hy - 2, q, ORBIT[2]);
    p(34 + X, hy + 2, q.lunge ? 3 : 1, 1, BRASS[2]); // the proboscis
  },
};

/** The Mirror Substitute: a small rounded reflection of obsidian mirror shards; its face only in the glass. */
const MIRROR_SUBSTITUTE: CreatureArt = {
  w: 25, h: 34,
  paint(p, l, q) {
    const X = shift(q, 3, 2), Y = q.bob;
    for (const [x, far] of [[9, true], [13, false]] as const) {
      const up = lifted(q, !far);
      l(x + X, 25 + Y, x + X + (far ? -1 : 1), 33 - up, 2, far ? NIGHT[1] : NIGHT[2]);
    }
    l(6 + X, 17 + Y, 4 + X, 23 + Y, 2, NIGHT[2]); // the far arm
    orb(p, 11 + X, 21 + Y, 6, 6, NIGHT[1], NIGHT[2], NIGHT[3]);
    p(8 + X, 18 + Y, 6, 1, MOON[0]); p(9 + X, 22 + Y, 5, 1, AMETHYST[1]); p(12 + X, 25 + Y, 3, 1, AMETHYST[2]);
    p(15 + X, 14 + Y, 3, 3, NIGHT[3]); p(15 + X, 14 + Y, 3, 1, MOON[1]); // the higher shoulder
    // The head: a round mirror; the eyes are only reflections.
    const hy = 9 + Y + q.coil;
    orb(p, 12 + X, hy, 6, 6, NIGHT[0], NIGHT[1], NIGHT[2]);
    p(8 + X, hy - 4, 2, 5, MOON[0]); p(9 + X, hy - 4, 1, 2, MOON[1]);
    eye(p, 11 + X, hy - 1, q, AMETHYST[3]); eye(p, 15 + X, hy - 1, q, AMETHYST[3]);
    // The near arm ends in a blade-shard: low, raised, then out.
    const ax = 16 + X, ay = 17 + Y;
    const [bx, by] = q.coil ? [13 + X, 2 + Y] : q.lunge ? [20 + X, 18 + Y] : [18 + X, 27 + Y];
    l(ax, ay, bx, by, 2, NIGHT[3]); l(ax + (bx - ax) / 2, ay + (by - ay) / 2, bx, by, 1, MOON[1]);
  },
};

/** The Rootglass Stag: a round rootwood fawn-stag with living-crystal antlers, amber seams and a mossy back. */
const ROOTGLASS_STAG: CreatureArt = {
  w: 40, h: 34,
  paint(p, l, q) {
    const X = shift(q, 4, 2), Y = q.bob;
    for (const [x, far] of [[8, true], [20, true], [11, false], [23, false]] as const) {
      const up = lifted(q, !far), top = 23 + Y;
      l(x + X, top, x + X + (q.step && !far ? q.step : 0), 31 - up, 2, far ? ROOT[1] : ROOT[2]);
      p(x + X, 28, 2, 1, BRASS[1]); p(x + X - 1, 32 - up, 3, 2, ROOT[0]);
    }
    blob(p, 4 + X, 15 + Y, 2, 2, MOSS[2]); // the tail tuft
    orb(p, 15 + X, 19 + Y + (q.coil ? 1 : 0), 11, 6, ROOT[1], ROOT[2], ROOT[3]);
    blob(p, 14 + X, 14 + Y, 7, 1, MOSS[2]); p(10 + X, 13 + Y, 8, 1, MOSS[3]);
    p(9 + X, 20 + Y, 5, 1, AMBER[1]); p(17 + X, 21 + Y, 5, 1, AMBER[2]);
    // Neck and head: lowered on the wind-up and strike (antlers forward).
    const down = q.coil ? 3 : q.lunge ? 4 : 0;
    l(24 + X, 17 + Y, 27 + X, 14 + Y + down, 4, ROOT[2]);
    const hx = 29 + X, hy = 12 + Y + down;
    p(hx - 4, hy - 4, 2, 2, ROOT[1]); // the ear
    orb(p, hx, hy, 5, 4, ROOT[1], ROOT[2], ROOT[3]);
    p(hx + 4, hy, 3, 3, ROOT[2]); p(hx + 6, hy, 1, 1, ROOT[0]); // the snout
    eye(p, hx - 1, hy - 2, q, BIOLUME[2]);
    // Antlers: living crystal, branching back and up from the brow.
    const ay = hy - 4, tilt = down ? 2 : 0;
    l(hx, ay, hx - 1 + tilt, ay - 5, 1, BIOLUME[1]); l(hx - 1 + tilt, ay - 5, hx - 3 + tilt * 2, ay - 7, 1, BIOLUME[1]);
    l(hx + tilt, ay - 3, hx + 3 + tilt, ay - 6, 1, BIOLUME[1]); l(hx + 2, ay, hx + 4 + tilt, ay - 3, 1, BIOLUME[0]);
    p(hx - 3 + tilt * 2, ay - 8, 1, 1, BIOLUME[2]); p(hx + 3 + tilt, ay - 7, 1, 1, BIOLUME[2]);
  },
};

/** The Cinder Bailiff: a round little collector in an iron hood, an ember grate for a belly, a branding stamp in hand. */
const CINDER_BAILIFF: CreatureArt = {
  w: 26, h: 34,
  paint(p, l, q) {
    const X = shift(q, 3, 1), Y = q.bob;
    for (const [x, far] of [[8, true], [13, false]] as const) {
      const up = lifted(q, !far), top = 27 + Y;
      p(x + X, top, 3, 32 - up - top, far ? IRON[0] : IRON[1]); p(x + X - 1, 32 - up, 5, 2, far ? IRON[0] : IRON[2]);
    }
    orb(p, 11 + X, 21 + Y, 7, 7, IRON[0], IRON[1], IRON[3]);
    p(5 + X, 27 + Y, 13, 1, EMBER[0]);
    blob(p, 11 + X, 21 + Y, 3, 2, EMBER[0]);
    p(9 + X, 20 + Y, 5, 3, q.coil || q.lunge ? HOT[1] : EMBER[2]);
    p(10 + X, 19 + Y, 1, 5, IRON[0]); p(12 + X, 19 + Y, 1, 5, IRON[0]);
    p(5 + X, 25 + Y, 13, 1, BASALT[0]); p(10 + X, 25 + Y, 2, 1, BRASS[1]); // the belt and its seal
    // The hood: a round iron cowl with a point at the back, two ember eyes in the dark.
    const hy = 10 + Y + q.coil;
    p(4 + X, hy - 5, 2, 3, IRON[1]);
    orb(p, 12 + X, hy, 7, 6, IRON[0], IRON[1], IRON[3]);
    blob(p, 14 + X, hy + 1, 4, 3, IRON[0]);
    if (q.hurt) { p(12 + X, hy + 1, 2, 1, EMBER[1]); p(16 + X, hy + 1, 2, 1, EMBER[1]); }
    else if (q.coil || q.lunge) { p(12 + X, hy + 1, 2, 1, HOT[2]); p(16 + X, hy + 1, 2, 1, HOT[2]); p(11 + X, hy, 2, 1, IRON[3]); p(16 + X, hy, 2, 1, IRON[3]); }
    else { p(12 + X, hy, 2, 2, HOT[1]); p(16 + X, hy, 2, 2, HOT[1]); p(12 + X, hy, 1, 1, HOT[2]); p(16 + X, hy, 1, 1, HOT[2]); }
    // The stamp: a hafted iron block with an ember face, held low, raised overhead, brought down.
    const ax = 17 + X, ay = 17 + Y;
    const [hx, hy2] = q.coil ? [16 + X, 3] : q.lunge ? [21 + X, 24 + Y] : [19 + X, 26 + Y];
    l(ax, ay, hx, hy2, 2, IRON[2]);
    p(hx - 2, hy2 - 3, 5, 4, IRON[2]); p(hx - 2, hy2 - 3, 5, 1, IRON[3]); p(hx - 2, hy2, 5, 1, q.lunge ? HOT[1] : EMBER[1]);
  },
};

/** The Seam Eater: risen from the deepest failed repairs, a round heap of scrap plates with a wide maw of seams. */
const SEAM_EATER: CreatureArt = {
  w: 46, h: 30,
  paint(p, _l, q) {
    const X = shift(q, 4, 3, 3), Y = q.bob;
    for (const [x, far] of [[26, true], [31, false]] as const) {
      const up = lifted(q, !far), top = 21 + Y;
      p(x + X, top, 4, 28 - up - top, far ? IRON[0] : IRON[1]); p(x + X - 1, 28 - up, 6, 2, far ? IRON[0] : IRON[2]);
    }
    orb(p, 16 + X, 18 + Y, 14, 10, BASALT[0], BASALT[1], BASALT[3]);
    for (let k = 0; k < 5; k++) {
      const x = 6 + k * 5 + X, y = 12 + Y + Math.abs(k - 2);
      orb(p, x, y, 3, 2, k % 2 ? IRON[1] : BASALT[1], k % 2 ? IRON[2] : BASALT[2], k % 2 ? IRON[3] : BASALT[3]);
      p(x, y, 1, 1, '#877c84');
      p(x + 2, y + 3, 1, 6, EMBER[k % 3 === 0 ? 2 : 0]); // the failed seams glow
    }
    p(3 + X, 28, 28, 2, BASALT[0]);
    // The head: a round riveted prow, two eyes, a wide maw of seams.
    const hy = 13 + Y + q.coil, gap = Math.round(q.open * 4);
    orb(p, 33 + X, hy, 7, 6, IRON[0], IRON[1], IRON[3]);
    eye(p, 30 + X, hy - 4, q, HOT[1]); eye(p, 35 + X, hy - 4, q, HOT[1]);
    const my = hy + 2;
    if (gap) {
      p(28 + X, my, 12, gap + 1, EMBER[0]); p(29 + X, my + 1, 10, Math.max(1, gap - 1), EMBER[1]);
      for (let t = 0; t < 6; t++) { p(28 + X + t * 2, my, 1, 1, HOT[2]); p(29 + X + t * 2, my + gap, 1, 1, HOT[1]); }
    } else { p(29 + X, my, 10, 1, EMBER[2]); p(31 + X, my, 1, 1, HOT[2]); p(36 + X, my, 1, 1, HOT[2]); }
    p(28 + X, my + gap + 1, 12, 2, IRON[1]); p(29 + X, my + gap + 3, 10, 1, IRON[0]);
  },
};

/** The Drowned Lamp: something round and large that circles the morning lamp at the bottom of the Mere, the lamp on its lure. */
const DROWNED_LAMP: CreatureArt = {
  w: 46, h: 28,
  paint(p, l, q) {
    const X = shift(q, 4, 2), Y = q.bob;
    const flap = q.step ? (q.step > 0 ? 0 : 1) : 0;
    p(1 + X, 12 + Y + flap, 3, 9, GROTTO[2]); p(1 + X, 12 + Y + flap, 1, 9, GROTTO[3]); p(3 + X, 14 + Y, 3, 5, GROTTO[2]); // the tail
    orb(p, 14 + X, 17 + Y, 10, 7, GROTTO[0], GROTTO[1], GROTTO[3]);
    for (const [sx, sy] of [[9, 15], [14, 13], [18, 17]] as const) p(sx + X, sy + Y, 1, 1, GROTTO[4]);
    p(10 + X, 25 - flap, 5, 2, GROTTO[2]); p(18 + X, 25 - (1 - flap), 4, 2, GROTTO[2]); // fins
    // The head: big and round, one pale eye, a jaw that opens on the strike.
    const hy = 15 + Y + q.coil, gap = Math.round(q.open * 4);
    orb(p, 29 + X, hy, 9, 8, GROTTO[1], GROTTO[2], GROTTO[4]);
    eye(p, 30 + X, hy - 5, q, MOON[1]);
    const my = hy + 3;
    if (gap) {
      p(27 + X, my, 11, gap + 1, GROTTO[0]);
      for (let t = 0; t < 5; t++) { p(28 + X + t * 2, my, 1, 2, DAWN[2]); p(29 + X + t * 2, my + gap, 1, 1, DAWN[2]); }
    } else { p(29 + X, my, 8, 1, GROTTO[0]); p(31 + X, my + 1, 1, 1, DAWN[2]); }
    // The lure: a stalk from the brow to the lamp, the lamp holding a little morning.
    const lx = 37 + X + (q.coil ? -5 : q.lunge ? 1 : 0), ly = 1 + (q.coil ? 2 : 0) + q.bob;
    l(30 + X, hy - 8, lx - 1, ly + 3, 1, GROTTO[3]);
    p(lx - 2, ly, 5, 6, BRASS[0]); p(lx - 1, ly + 1, 3, 4, DAWN[0]); p(lx, ly + 2, 1, 2, DAWN[2]); p(lx - 2, ly, 5, 1, BRASS[2]);
  },
};

/**
 * The Ink Lantern (world clock: out in the Unrecorded Corridors by dark): a round
 * paper lantern of ink that drifts a little above the floor, an amethyst flame
 * inside, a big pair of eyes on the paper, and an ink drip under it. It dims
 * (its flame shrinks) when it is hit; it flares on the strike.
 */
const INK_LANTERN: CreatureArt = {
  w: 26, h: 34,
  paint(p, l, q) {
    const X = shift(q, 3, 2), Y = q.bob - q.coil;
    // The hanging cord and the cap.
    l(13 + X, 0, 13 + X, 4 + Y, 1, NIGHT[3]);
    p(9 + X, 4 + Y, 9, 2, NIGHT[2]); p(10 + X, 4 + Y, 7, 1, NIGHT[3]);
    // The paper body: a round ink orb with ribs.
    orb(p, 13 + X, 15 + Y, 9, 9, NIGHT[0], NIGHT[1], NIGHT[3]);
    for (const rx of [7, 13, 19]) p(rx + X, 8 + Y, 1, 15, NIGHT[0]);
    // The flame inside, seen through the paper: small when hurt, tall on the strike.
    const flame = q.hurt ? 1 : q.lunge ? 4 : 2;
    blob(p, 13 + X, 18 + Y, 3, flame, AMETHYST[1]);
    blob(p, 13 + X, 18 + Y, 1, Math.max(1, flame - 1), AMETHYST[3]);
    eye(p, 8 + X, 11 + Y, q, AMETHYST[3]); eye(p, 15 + X, 11 + Y, q, AMETHYST[3]);
    // The base cap and the ink drip (it lengthens on the wind-up).
    p(9 + X, 24 + Y, 9, 2, NIGHT[2]);
    const drip = 3 + Math.round(q.coil * 3);
    p(13 + X, 26 + Y, 1, drip, NIGHT[0]); p(12 + X, 26 + Y + drip, 3, 2, NIGHT[1]);
  },
};

/**
 * The Afterimage Moth (world clock: rises in the Reflection Channels under an
 * eclipse): a round moth of pale noon light, each wing carrying the eclipse's
 * dark disc with a gold ring, big dark eyes, feathered feelers. The wings beat
 * with the stride and spread wide on the strike.
 */
const AFTERIMAGE_MOTH: CreatureArt = {
  w: 34, h: 30,
  paint(p, l, q) {
    const X = shift(q, 3, 2), Y = q.bob + q.coil;
    const beat = q.step ? (q.step > 0 ? -2 : 1) : 0, spread = q.lunge ? 2 : q.coil ? -1 : 0;
    // The far wing, then the near one: pale discs with the eclipse on them.
    for (const [cx, cy, far] of [[9, 9, true], [24, 9, false]] as const) {
      const wy = cy + Y + beat;
      blob(p, cx + X + (far ? -spread : spread), wy, 7 + spread, 7, far ? DAWN[0] : DAWN[1]);
      blob(p, cx + X + (far ? -spread : spread), wy, 3, 3, GOLD[1]);
      blob(p, cx + X + (far ? -spread : spread), wy, 2, 2, NIGHT[1]);
      p(cx + X - 5, wy - 5, 2, 1, DAWN[2]);
    }
    // The body: a soft round thorax and a ringed abdomen.
    orb(p, 17 + X, 20 + Y, 5, 6, STONE[1], DAWN[0], DAWN[2]);
    for (const ry of [22, 24]) p(13 + X, ry + Y, 9, 1, STONE[1]);
    // The legs, tucked.
    for (const lx of [14, 18]) l(lx + X, 25 + Y, lx + X - 1, 29, 1, STONE[1]);
    // The head and the feathered feelers.
    const hx = 22 + X + q.lunge, hy = 14 + Y;
    l(hx, hy - 3, hx + 3, hy - 8, 1, GOLD[1]); l(hx - 2, hy - 3, hx - 4, hy - 8, 1, GOLD[1]);
    p(hx + 3, hy - 9, 2, 2, GOLD[2]); p(hx - 5, hy - 9, 2, 2, GOLD[2]);
    orb(p, hx, hy, 4, 4, STONE[1], DAWN[1], DAWN[2]);
    eye(p, hx - 3, hy - 2, q, GOLD[2]); eye(p, hx + 1, hy - 2, q, GOLD[2]);
  },
};

/** The art for each creature key (MonsterDef.creature). Unknown keys keep the engine's own drawing. */
export const CREATURE_ART: Readonly<Record<string, CreatureArt>> = {
  'rivet-maw': RIVET_MAW,
  'prism-forager': PRISM_FORAGER,
  'ephemeris-leech': EPHEMERIS_LEECH,
  'mirror-substitute': MIRROR_SUBSTITUTE,
  'rootglass-stag': ROOTGLASS_STAG,
  'cinder-bailiff': CINDER_BAILIFF,
  'seam-eater': SEAM_EATER,
  'drowned-lamp': DROWNED_LAMP,
  // The world clock's (play/world/clock-nodes.ts): out by dark, and under an eclipse.
  'ink-lantern': INK_LANTERN,
  'afterimage-moth': AFTERIMAGE_MOTH,
  // The Root Deeps' and the Prism Mines' (realm-creatures.ts).
  ...REALM_CREATURE_ART,
};

/** World px per art px at figureScale 1 (the Keeper's, keeper-paint.ts; 2 in the Delve at 0.5). */
export const CREATURE_PIXEL = 4;

/** Which frame a creature shows: the fight's phase first, then a stride while it moves, else a breath. */
export function creatureFrame(phase: string, recoil: number, moving: boolean, time: number, reduced: boolean): CreatureFrame {
  if (recoil > .3) return 'hurt';
  if (phase === 'windup') return 'windup';
  if (phase === 'strike') return 'strike';
  if (reduced) return 'idle0';
  if (moving) return Math.floor(time * 6) % 2 ? 'move1' : 'move0';
  return Math.floor(time * 1.8) % 2 ? 'idle1' : 'idle0';
}

/** One creature's cached frames and their white flash copies. */
export class CreaturePainter {
  private readonly frames = new Map<string, HTMLCanvasElement>();
  constructor(readonly art: CreatureArt) {}
  /** Height in art px (for the health bar and the "!" above it). */
  get height(): number { return this.art.h; }

  /**
   * Draw with the context at the creature's feet, facing right (the caller
   * mirrors). `scale` is world px per art px.
   */
  draw(c: Ctx, scale: number, frame: CreatureFrame, flash: boolean): void {
    const sprite = this.frame(frame, flash);
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    const w = this.art.w + 2, h = this.art.h + 2;
    // The outline row under the feet sits on the floor line.
    c.drawImage(sprite, -Math.floor(w / 2) * scale, -h * scale, w * scale, h * scale);
    c.imageSmoothingEnabled = smoothing;
  }

  private frame(frame: CreatureFrame, flash: boolean): HTMLCanvasElement {
    const id = flash ? `${frame}!` : frame;
    let el = this.frames.get(id);
    if (el) return el;
    if (flash) {
      el = canvas(this.art.w + 2, this.art.h + 2);
      const c = el.getContext('2d')!;
      c.drawImage(this.frame(frame, false), 0, 0);
      c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff4ea'; c.fillRect(0, 0, el.width, el.height);
    } else {
      const raw = canvas(this.art.w + 2, this.art.h + 2);
      const c = raw.getContext('2d')!;
      c.translate(1, 1);
      this.art.paint((x, y, w, h, color) => px(c, x, y, w, h, color), (x0, y0, x1, y1, t, color) => limb(c, x0, y0, x1, y1, t, color), CREATURE_POSES[frame]);
      el = outlined(raw);
    }
    this.frames.set(id, el);
    return el;
  }
}
