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

/** The Rivet Maw: a low four-legged scavenger of basalt hide and riveted iron, a square jaw with an ember seam. */
const RIVET_MAW: CreatureArt = {
  w: 42, h: 26,
  paint(p, _l, q) {
    const X = Math.round(q.lunge * 3 - q.coil * 2 - (q.hurt ? 2 : 0)), Y = q.bob + q.coil;
    p(1 + X, 11 + Y, 4, 3, BASALT[1]); p(1 + X, 11 + Y, 4, 1, BASALT[2]); // the tail stub
    for (const [x, far] of [[8, true], [23, true], [11, false], [26, false]] as const) {
      const up = lifted(q, !far), top = 18 + Y;
      p(x + X, top, 3, 25 - up - top, far ? IRON[0] : IRON[1]);
      p(x + X - 1, 25 - up, 5, 1, far ? IRON[0] : IRON[2]);
    }
    // Hide: lit along the top, the belly in shadow.
    p(4 + X, 9 + Y, 25, 10, BASALT[1]); p(5 + X, 8 + Y, 23, 1, BASALT[1]);
    p(5 + X, 8 + Y, 19, 1, BASALT[3]); p(4 + X, 9 + Y, 21, 1, BASALT[2]); p(4 + X, 9 + Y, 1, 8, BASALT[2]);
    p(5 + X, 17 + Y, 23, 2, BASALT[0]);
    // Rivet plates down the back.
    for (let k = 0; k < 3; k++) {
      const x = 8 + k * 6 + X;
      p(x, 9 + Y, 5, 4, IRON[2]); p(x, 9 + Y, 5, 1, IRON[3]); p(x + 4, 10 + Y, 1, 3, IRON[1]);
      p(x + 1, 11 + Y, 1, 1, '#877c84'); p(x + 3, 11 + Y, 1, 1, '#877c84');
    }
    // The ember seam along the flank.
    p(7 + X, 15 + Y, 18, 1, EMBER[0]); p(10 + X, 15 + Y, 2, 1, EMBER[2]); p(18 + X, 15 + Y, 3, 1, EMBER[1]);
    // The jaw: an iron box, upper plate and lower, the mouth an ember line until it opens.
    const hy = 8 + Y - q.coil, gap = Math.round(q.open * 4);
    p(27 + X, hy, 12, 6, IRON[1]); p(27 + X, hy, 12, 1, IRON[3]); p(28 + X, hy + 1, 9, 1, IRON[2]); p(31 + X, hy, 1, 6, IRON[0]);
    p(34 + X, hy + 2, 2, 1, q.hurt ? IRON[0] : HOT[1]); p(33 + X, hy + 1, 3, 1, IRON[0]);
    if (gap === 0) p(28 + X, hy + 6, 11, 1, EMBER[2]);
    else {
      p(28 + X, hy + 6, 11, gap, EMBER[0]); p(29 + X, hy + 6, 9, Math.max(1, gap - 1), EMBER[1]);
      for (let t = 0; t < 5; t++) { p(29 + X + t * 2, hy + 6, 1, 1, HOT[1]); p(30 + X + t * 2, hy + 5 + gap, 1, 1, HOT[1]); }
    }
    p(27 + X, hy + 7 + gap, 11, 4, IRON[1]); p(27 + X, hy + 10 + gap, 11, 1, IRON[0]); p(28 + X, hy + 7 + gap, 9, 1, IRON[2]);
    p(36 + X, hy + 8 + gap, 1, 1, '#877c84');
  },
};

/** The Prism Forager: a human-height faceted crystal forager of ivory and gold, a hollow chest full of light. */
const PRISM_FORAGER: CreatureArt = {
  w: 32, h: 42,
  paint(p, l, q) {
    const X = Math.round(q.lunge * 3 - q.coil * 2 - (q.hurt ? 2 : 0)), Y = q.bob + q.coil;
    // Legs: digitigrade, a gold knuckle at the knee.
    for (const [x, far] of [[10, true], [15, false]] as const) {
      const up = lifted(q, !far);
      l(x + X, 27 + Y, x + X - 2, 34, 2, far ? STONE[1] : STONE[2]);
      l(x + X - 2, 34, x + X + 1, 41 - up, 2, far ? STONE[1] : STONE[2]);
      p(x + X - 3, 33, 2, 2, GOLD[1]); p(x + X, 41 - up, 4, 1, far ? STONE[0] : STONE[1]);
    }
    // Back shards.
    p(5 + X, 9 + Y, 2, 6, DAWN[0]); p(3 + X, 12 + Y, 2, 5, DAWN[0]); p(5 + X, 9 + Y, 1, 6, DAWN[2]); p(3 + X, 12 + Y, 1, 1, DAWN[2]);
    // The far arm.
    l(9 + X, 15 + Y, 7 + X, 25 + Y, 2, STONE[1]);
    // Torso: a faceted diamond, ivory, lit top-left; the hollow chest holds light.
    for (let r = 0; r < 16; r++) {
      const half = r < 6 ? 3 + r : 8 - Math.floor((r - 6) / 2);
      p(13 + X - half, 12 + Y + r, half * 2 + 1, 1, r < 4 ? STONE[3] : STONE[2]);
      p(13 + X - half, 12 + Y + r, 1, 1, STONE[3]); p(13 + X + half, 12 + Y + r, 1, 1, STONE[1]);
    }
    // The hollow chest: a gold-rimmed diamond of refracted light.
    for (let r = 0; r < 7; r++) {
      const half = r < 4 ? r : 6 - r;
      p(13 + X - half - 1, 16 + Y + r, 1, 1, GOLD[1]); p(13 + X + half + 1, 16 + Y + r, 1, 1, GOLD[1]);
      if (half) p(13 + X - half, 16 + Y + r, half * 2 + 1, 1, r < 3 ? DAWN[2] : DAWN[1]);
    }
    p(13 + X, 16 + Y, 1, 1, GOLD[1]); p(13 + X, 22 + Y, 1, 1, GOLD[1]);
    p(13 + X, 19 + Y, 1, 1, q.hurt ? STONE[1] : GOLD[2]);
    // Head: a crystal wedge leaning forward.
    const hx = 15 + X + q.lunge, hy = 4 + Y + q.coil;
    p(hx, hy + 2, 7, 6, STONE[3]); p(hx + 1, hy, 4, 2, STONE[3]); p(hx + 7, hy + 4, 2, 3, STONE[2]);
    p(hx, hy + 7, 7, 1, STONE[1]); p(hx + 1, hy + 1, 2, 3, DAWN[2]);
    p(hx + 5, hy + 4, 2, 1, q.hurt ? STONE[0] : GOLD[2]);
    // The near arm with its claw: hanging, drawn back on the wind-up, thrust on the strike.
    const ax = 17 + X, ay = 14 + Y;
    const [cx, cy] = q.coil ? [9 + X, 6 + Y] : q.lunge ? [30 + X, 17 + Y] : [20 + X, 26 + Y + q.bob];
    l(ax, ay, cx, cy, 2, STONE[2]); p(cx - 1, cy - 1, 3, 3, DAWN[0]); p(cx + 1, cy - 2, 1, 2, DAWN[2]);
  },
};

/** The Ephemeris Leech: a jointed star-silver crawler like a folded rule, a dark glass abdomen leaking sparks. */
const EPHEMERIS_LEECH: CreatureArt = {
  w: 40, h: 20,
  paint(p, l, q) {
    const X = Math.round(q.lunge * 4 - q.coil * 2 - (q.hurt ? 2 : 0)), Y = q.bob;
    const rear = q.coil ? -3 : 0;
    // Legs like a pair of dividers, brass at each joint.
    for (let k = 0; k < 3; k++) {
      const x = 14 + k * 7 + X, up = lifted(q, k !== 1);
      l(x, 12 + Y, x - 2, 15, 1, SILVER[0]); l(x - 2, 15, x + 1, 19 - up, 1, SILVER[1]); p(x - 2, 15, 1, 1, BRASS[1]);
      l(x + 3, 12 + Y, x + 5, 15, 1, SILVER[1]); l(x + 5, 15, x + 3, 19 - up, 1, SILVER[2]); p(x + 5, 15, 1, 1, BRASS[2]);
    }
    // The abdomen: dark blue glass, a starfield inside.
    p(2 + X, 7 + Y + rear, 14, 7, MIDNIGHT[1]); p(3 + X, 6 + Y + rear, 12, 1, MIDNIGHT[2]); p(3 + X, 14 + Y + rear, 12, 1, MIDNIGHT[0]);
    p(3 + X, 7 + Y + rear, 9, 1, MIDNIGHT[3]); p(4 + X, 8 + Y + rear, 2, 1, MIDNIGHT[3]);
    for (const [sx, sy] of [[5, 10], [8, 9], [11, 11], [13, 8], [7, 12]] as const) p(sx + X, sy + Y + rear, 1, 1, SILVER[2]);
    p(9 + X, 10 + Y + rear, 1, 1, ORBIT[2]);
    // The thorax: silver caliper segments, hinged.
    for (let k = 0; k < 3; k++) {
      const x = 16 + k * 6 + X;
      p(x, 8 + Y, 5, 4, SILVER[1]); p(x, 8 + Y, 5, 1, SILVER[2]); p(x, 11 + Y, 5, 1, SILVER[0]); p(x + 5, 9 + Y, 1, 2, BRASS[1]);
    }
    // The head and its proboscis, longer on the strike.
    const hy = 7 + Y + q.coil;
    p(34 + X, hy, 5, 5, SILVER[1]); p(34 + X, hy, 5, 1, SILVER[2]); p(36 + X, hy + 1, 2, 1, q.hurt ? SILVER[0] : ORBIT[2]);
    p(38 + X, hy + 3, q.lunge ? 2 : 1, 1, BRASS[2]);
  },
};

/** The Mirror Substitute: a person-sized, asymmetric reflection of obsidian mirror shards; its face only in the glass. */
const MIRROR_SUBSTITUTE: CreatureArt = {
  w: 26, h: 44,
  paint(p, l, q) {
    const X = Math.round(q.lunge * 3 - q.coil * 2 - (q.hurt ? 2 : 0)), Y = q.bob;
    // Legs: two tapering shards.
    for (const [x, far] of [[9, true], [13, false]] as const) {
      const up = lifted(q, !far);
      l(x + X, 28 + Y, x + X + (far ? -1 : 1), 43 - up, 2, far ? NIGHT[1] : NIGHT[2]);
    }
    // The far arm, short.
    l(8 + X, 16 + Y, 6 + X, 26 + Y, 2, NIGHT[2]);
    // The body: stacked mirror fragments, each lit on its top-left edge, amethyst in the seams.
    const shards: readonly [number, number, number, number][] = [[7, 14, 9, 6], [6, 20, 8, 5], [11, 19, 6, 6], [8, 25, 8, 4]];
    for (const [x, y, w, h] of shards) {
      p(x + X, y + Y, w, h, NIGHT[2]); p(x + X, y + Y, w, 1, MOON[0]); p(x + X, y + Y, 1, h, NIGHT[3]);
      p(x + X + w - 1, y + Y + 1, 1, h - 1, NIGHT[1]);
    }
    p(9 + X, 20 + Y, 6, 1, AMETHYST[1]); p(12 + X, 25 + Y, 4, 1, AMETHYST[2]);
    p(15 + X, 12 + Y, 3, 3, NIGHT[3]); p(15 + X, 12 + Y, 3, 1, MOON[1]); // the higher shoulder
    // The head: a mirror oval; a face only in its reflection (two pale glints).
    const hy = 3 + Y + q.coil;
    p(9 + X, hy + 1, 8, 8, NIGHT[1]); p(10 + X, hy, 6, 10, NIGHT[1]);
    p(10 + X, hy + 1, 2, 6, MOON[0]); p(11 + X, hy + 1, 1, 3, MOON[1]);
    if (!q.hurt) { p(14 + X, hy + 4, 1, 1, MOON[1]); p(15 + X, hy + 6, 1, 1, AMETHYST[3]); }
    // The near arm ends in a long blade-shard: low, raised, then out.
    const ax = 16 + X, ay = 15 + Y;
    const [bx, by] = q.coil ? [13 + X, 1 + Y] : q.lunge ? [26 + X, 18 + Y] : [19 + X, 30 + Y];
    l(ax, ay, bx, by, 2, NIGHT[3]); l(ax + (bx - ax) / 2, ay + (by - ay) / 2, bx, by, 1, MOON[1]);
  },
};

/** The Rootglass Stag: a rootwood cervid with living-crystal antlers, amber seams, moss and brass root braces. */
const ROOTGLASS_STAG: CreatureArt = {
  w: 44, h: 42,
  paint(p, l, q) {
    const X = Math.round(q.lunge * 4 - q.coil * 2 - (q.hurt ? 2 : 0)), Y = q.bob;
    // Legs: thin rootwood with brass bands, hooves; the far pair darker.
    for (const [x, far] of [[9, true], [25, true], [12, false], [28, false]] as const) {
      const up = lifted(q, !far), top = 24 + Y + (q.coil && x < 20 ? -1 : 0);
      l(x + X, top, x + X + (q.step && !far ? q.step : 0), 40 - up, 2, far ? ROOT[1] : ROOT[2]);
      p(x + X, 31, 2, 1, BRASS[1]); p(x + X - 1, 40 - up, 3, 2, ROOT[0]);
    }
    // The body: rootwood, a mossy back, amber seams in the grain.
    const by = 14 + Y + (q.coil ? 1 : 0);
    p(6 + X, by + 1, 26, 9, ROOT[2]); p(7 + X, by, 24, 1, ROOT[2]); p(7 + X, by + 9, 23, 2, ROOT[1]);
    p(7 + X, by, 20, 2, MOSS[2]); p(8 + X, by - 1, 14, 1, MOSS[3]); p(10 + X, by, 3, 1, MOSS[3]);
    p(6 + X, by + 2, 1, 6, ROOT[3]);
    p(10 + X, by + 5, 7, 1, AMBER[1]); p(18 + X, by + 6, 6, 1, AMBER[2]); p(25 + X, by + 4, 4, 1, AMBER[1]);
    p(4 + X, by + 1, 3, 3, MOSS[2]); // the tail tuft
    // Neck and head: lowered on the wind-up and strike (antlers forward).
    const down = q.coil ? 4 : q.lunge ? 5 : 0;
    l(29 + X, by + 2, 33 + X, 8 + Y + down, 4, ROOT[2]);
    const hx = 31 + X, hy = 5 + Y + down;
    p(hx, hy + 1, 7, 5, ROOT[2]); p(hx + 7, hy + 3, 4, 3, ROOT[2]); p(hx + 10, hy + 4, 1, 1, ROOT[0]);
    p(hx, hy + 1, 7, 1, ROOT[3]); p(hx + 4, hy + 2, 1, 1, q.hurt ? ROOT[0] : BIOLUME[2]); p(hx + 1, hy, 2, 2, ROOT[1]); // ear
    // Antlers: living crystal, branching back and up from the brow.
    const tilt = down ? 3 : 0;
    l(hx + 3, hy, hx + 1 + tilt, hy - 7, 1, BIOLUME[1]); l(hx + 1 + tilt, hy - 7, hx - 2 + tilt * 2, hy - 10, 1, BIOLUME[1]);
    l(hx + 2 + tilt, hy - 4, hx + 6 + tilt, hy - 8, 1, BIOLUME[1]); l(hx + 1 + tilt, hy - 7, hx + 3 + tilt * 2, hy - 12, 1, BIOLUME[2]);
    l(hx + 5, hy, hx + 7 + tilt, hy - 5, 1, BIOLUME[0]); p(hx + 6 + tilt, hy - 8, 1, 1, BIOLUME[2]);
  },
};

/** The Cinder Bailiff: an iron-hooded collector of heat debts, an ember grate for a chest, a branding stamp in hand. */
const CINDER_BAILIFF: CreatureArt = {
  w: 30, h: 42,
  paint(p, l, q) {
    const X = Math.round(q.lunge * 3 - q.coil * 1 - (q.hurt ? 2 : 0)), Y = q.bob;
    for (const [x, far] of [[10, true], [15, false]] as const) {
      const up = lifted(q, !far);
      p(x + X, 30 + Y, 4, 11 - Y - up, far ? IRON[0] : IRON[1]); p(x + X - 1, 40 - up, 6, 2, far ? IRON[0] : IRON[2]);
    }
    // The long iron coat, its skirt split, lit on the left.
    p(7 + X, 13 + Y, 14, 18, IRON[1]); p(6 + X, 24 + Y, 16, 8, IRON[1]); p(7 + X, 13 + Y, 1, 18, IRON[3]); p(8 + X, 13 + Y, 12, 1, IRON[2]);
    p(13 + X, 26 + Y, 1, 6, IRON[0]); p(6 + X, 31 + Y, 16, 1, EMBER[0]);
    // The grate in the chest, glowing with what it has collected.
    p(10 + X, 16 + Y, 8, 6, EMBER[0]); p(11 + X, 17 + Y, 6, 4, q.coil || q.lunge ? HOT[1] : EMBER[2]);
    for (let k = 0; k < 3; k++) p(11 + X + k * 2, 16 + Y, 1, 6, IRON[0]);
    p(8 + X, 23 + Y, 12, 2, BASALT[0]); p(13 + X, 23 + Y, 2, 2, BRASS[1]); // the belt and its seal
    // The hood: an iron cowl, a slit of ember for eyes.
    const hy = 4 + Y + q.coil;
    p(9 + X, hy + 1, 10, 9, IRON[1]); p(10 + X, hy, 8, 1, IRON[2]); p(9 + X, hy + 1, 1, 8, IRON[3]); p(18 + X, hy + 2, 2, 7, IRON[0]);
    p(13 + X, hy + 4, 6, 3, IRON[0]); p(14 + X, hy + 5, 4, 1, q.hurt ? IRON[2] : HOT[1]);
    // The stamp: a hafted iron block with an ember face, held low, raised overhead, brought down.
    const ax = 18 + X, ay = 15 + Y;
    const [hx, hy2] = q.coil ? [17 + X, 2] : q.lunge ? [28 + X, 26 + Y] : [21 + X, 27 + Y];
    l(ax, ay, hx, hy2, 2, IRON[2]);
    p(hx - 2, hy2 - 3, 5, 4, IRON[2]); p(hx - 2, hy2 - 3, 5, 1, IRON[3]); p(hx - 2, hy2, 5, 1, q.lunge ? HOT[1] : EMBER[1]);
  },
};

/** The Seam Eater: risen from the deepest failed repairs, a hunched mass of scrap plates and rivets, a maw of seams. */
const SEAM_EATER: CreatureArt = {
  w: 52, h: 38,
  paint(p, l, q) {
    const X = Math.round(q.lunge * 4 - q.coil * 3 - (q.hurt ? 3 : 0)), Y = q.bob;
    // Stubby forelimbs and a dragging hind mass.
    for (const [x, far] of [[30, true], [36, false]] as const) {
      const up = lifted(q, !far);
      p(x + X, 26 + Y, 4, 11 - Y - up, far ? IRON[0] : IRON[1]); p(x + X - 1, 36 - up, 6, 2, far ? IRON[0] : IRON[2]);
    }
    // The body: an arc of scrap plates rising from the floor to the shoulders.
    for (let k = 0; k < 7; k++) {
      // A hunched back: low at the tail, highest over the middle, falling to the shoulders.
      const x = 2 + k * 5 + X, top = 28 - Math.round(Math.sin((k + 1) / 8 * Math.PI) * 20) + Y + (k > 4 ? q.coil : 0);
      p(x, top, 7, 37 - top, k % 2 ? IRON[1] : BASALT[1]);
      p(x, top, 7, 1, k % 2 ? IRON[3] : BASALT[3]); p(x, top + 1, 1, 37 - top - 1, k % 2 ? IRON[2] : BASALT[2]);
      p(x + 2, top + 2, 1, 1, '#877c84'); p(x + 5, top + 3, 1, 1, '#877c84');
      p(x + 6, top + 4, 1, 37 - top - 6, EMBER[k % 3 === 0 ? 2 : 0]); // the failed seams glow
    }
    p(2 + X, 35, 36, 2, BASALT[0]);
    // The head: a riveted prow with a maw of seams.
    const hy = 8 + Y + q.coil, gap = Math.round(q.open * 6);
    p(36 + X, hy, 13, 8, IRON[1]); p(36 + X, hy, 13, 1, IRON[3]); p(37 + X, hy + 1, 10, 1, IRON[2]);
    p(44 + X, hy + 3, 2, 2, q.hurt ? IRON[0] : HOT[1]); p(40 + X, hy + 3, 1, 1, HOT[0]);
    if (gap) {
      p(37 + X, hy + 8, 12, gap, EMBER[0]); p(38 + X, hy + 8, 10, gap - 1, EMBER[1]);
      for (let t = 0; t < 6; t++) { p(38 + X + t * 2, hy + 8, 1, 2, HOT[2]); p(39 + X + t * 2, hy + 7 + gap, 1, 1, HOT[1]); }
    } else p(37 + X, hy + 8, 12, 1, EMBER[2]);
    p(36 + X, hy + 9 + gap, 12, 5, IRON[1]); p(36 + X, hy + 13 + gap, 12, 1, IRON[0]); p(37 + X, hy + 9 + gap, 10, 1, IRON[2]);
  },
};

/** The Drowned Lamp: something large that circles the morning lamp at the bottom of the Mere, the lamp on its lure. */
const DROWNED_LAMP: CreatureArt = {
  w: 50, h: 34,
  paint(p, l, q) {
    const X = Math.round(q.lunge * 4 - q.coil * 2 - (q.hurt ? 2 : 0)), Y = q.bob;
    // The tail fin and a long eel body along the floor, pale grotto light along its back.
    p(1 + X, 18 + Y, 4, 9, GROTTO[2]); p(1 + X, 18 + Y, 1, 9, GROTTO[3]);
    for (let k = 0; k < 8; k++) {
      const x = 4 + k * 4 + X, sway = q.step ? ((k + (q.step > 0 ? 0 : 1)) % 2) : 0, top = 18 + Y - Math.min(k, 4) + sway;
      p(x, top, 5, 33 - top, GROTTO[1]); p(x, top, 5, 1, GROTTO[3]); p(x, 31, 5, 2, GROTTO[0]);
      if (k % 2) p(x + 2, top + 3, 1, 1, GROTTO[4]);
    }
    // Fins.
    p(14 + X, 30, 6, 3, GROTTO[2]); p(26 + X, 31, 5, 2, GROTTO[2]);
    // The head: a broad drowned skull, a pale eye, a jaw that opens on the strike.
    const hy = 12 + Y + q.coil, gap = Math.round(q.open * 4);
    p(34 + X, hy, 12, 9, GROTTO[2]); p(34 + X, hy, 12, 1, GROTTO[4]); p(34 + X, hy, 1, 9, GROTTO[3]);
    p(41 + X, hy + 3, 2, 2, q.hurt ? GROTTO[0] : MOON[1]);
    if (gap) { p(36 + X, hy + 9, 12, gap, GROTTO[0]); for (let t = 0; t < 5; t++) p(37 + X + t * 2, hy + 9, 1, 1, DAWN[2]); }
    p(35 + X, hy + 9 + gap, 12, 4, GROTTO[1]); p(35 + X, hy + 12 + gap, 12, 1, GROTTO[0]);
    // The lure: a stalk from the brow to the lamp, the lamp holding a little morning.
    const lx = 46 + X + (q.coil ? -6 : q.lunge ? 2 : 0), ly = 2 + (q.coil ? 2 : 0) + q.bob;
    l(38 + X, hy, lx - 1, ly + 3, 1, GROTTO[3]);
    p(lx - 2, ly, 5, 6, BRASS[0]); p(lx - 1, ly + 1, 3, 4, DAWN[0]); p(lx, ly + 2, 1, 2, DAWN[2]); p(lx - 2, ly, 5, 1, BRASS[2]);
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
