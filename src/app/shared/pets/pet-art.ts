/**
 * pet-art.ts — the seven pets as chibi pixel sprites (docs/agents/BRIEF.md "Art").
 *
 * MapleStory-cute on the Keeper's own grid: 4 world px per art px in towns and
 * hunts, 2 in the Delve; the one outline (keeper-paint.ts OUTLINE); light from
 * the upper left; colours from the art bible's realm ramps (the same ramps
 * creature-pixel.ts uses). A pet is about half the Keeper's height: a big round
 * head over a small soft body, big 2×3 eyes with a white highlight, a tiny
 * mouth, rosy cheeks, little feet.
 *
 * Frames (one row; a second row wears the hat):
 *   idle0 idle1  a breath (the body settles a pixel)
 *   hop0  hop1   the follow-hop: feet tucked, then stretched
 *   happy        eyes closed in a smile, mouth open (a meal, a pickup, a trick)
 *   sleep        curled, eyes shut (the Keeper standing still a while)
 *   blink        idle with the eyes shut
 *   alert        ears up, eyes wide (the Ink Pup's bark)
 *
 * Every frame of a pet is painted ONCE into one sheet canvas per pet type
 * (outlined in a single pass), the way KeeperPainter keeps one sheet per
 * figure, so the live-canvas count stays flat (e2e/play-memory). A frame
 * costs one blit. Browser only (canvas); `paintPetFrame` is pure over a pixel
 * callback so the specs can read the pixels.
 */
import { OUTLINE, canvas, limb, outlined, px } from '../keeper-look/keeper-paint';
import type { PetId } from './pets.model';

export type PetFrame = 'idle0' | 'idle1' | 'hop0' | 'hop1' | 'happy' | 'sleep' | 'blink' | 'alert';
export const PET_FRAMES: readonly PetFrame[] = ['idle0', 'idle1', 'hop0', 'hop1', 'happy', 'sleep', 'blink', 'alert'];

/** One frame's cell in art px (feet on the bottom row, facing right). */
export const PET_W = 26;
export const PET_H = 22;
/** Art rows from the feet up to the top of the head (not the hat): name tags sit above this. */
export const PET_TOP = 15;

type P = (x: number, y: number, w: number, h: number, color: string) => void;
type L = (x0: number, y0: number, x1: number, y1: number, t: number, color: string) => void;

interface Pose { bob: number; lift: number; eyes: 'open' | 'shut' | 'smile' | 'wide'; mouth: 'dot' | 'open' | 'none'; curl: boolean; flap: number }
const POSES: Readonly<Record<PetFrame, Pose>> = {
  idle0: { bob: 0, lift: 0, eyes: 'open', mouth: 'dot', curl: false, flap: 0 },
  idle1: { bob: 1, lift: 0, eyes: 'open', mouth: 'dot', curl: false, flap: 1 },
  hop0: { bob: -1, lift: 1, eyes: 'open', mouth: 'dot', curl: false, flap: 1 },
  hop1: { bob: 0, lift: 2, eyes: 'open', mouth: 'open', curl: false, flap: 0 },
  happy: { bob: -1, lift: 1, eyes: 'smile', mouth: 'open', curl: false, flap: 1 },
  sleep: { bob: 3, lift: 0, eyes: 'shut', mouth: 'none', curl: true, flap: 0 },
  blink: { bob: 0, lift: 0, eyes: 'shut', mouth: 'dot', curl: false, flap: 0 },
  alert: { bob: -1, lift: 0, eyes: 'wide', mouth: 'open', curl: false, flap: 1 },
};

/** A pet's look: its ramps (dark, mid, light), belly, cheek, eye shine and its own marks. */
interface PetLook {
  dark: string; mid: string; light: string; belly: string; cheek: string;
  /** Eye colours: the iris (white for most) and the pupil. */
  iris: string; pupil: string;
  /** Head / body radii (art px). */
  head: [number, number]; body: [number, number];
  marks: (p: P, l: L, q: Pose, hx: number, hy: number, bx: number, by: number) => void;
  /** Drawn behind the body (tails, wings). */
  back?: (p: P, l: L, q: Pose, bx: number, by: number) => void;
  hat: (p: P, hx: number, top: number) => void;
}

const WHITE = '#fff4ea', PUPIL = '#1a1020';
const HOT = ['#ff9b4f', '#ffd08a', '#fff4dc'];
const GOLD = ['#7a5a14', '#b8901e', '#E8D44D'];

/** A filled pixel ellipse. */
function blob(p: P, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + .5)) ** 2)));
    p(cx - half, cy + dy, half * 2 + 1, 1, color);
  }
}
/** A round body lit from the upper left: mid tone, shadowed lower rows, a soft highlight. */
function orb(p: P, cx: number, cy: number, rx: number, ry: number, lo: string, mid: string, hi: string): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + .5)) ** 2)));
    p(cx - half, cy + dy, half * 2 + 1, 1, dy >= ry - 1 ? lo : mid);
    // The shaded right rim.
    if (dy > -ry + 1) p(cx + half, cy + dy, 1, 1, lo);
  }
  blob(p, cx - Math.round(rx * .4), cy - Math.round(ry * .45), Math.max(1, Math.round(rx * .3)), Math.max(0, Math.round(ry * .2)), hi);
}

const LOOKS: Readonly<Record<PetId, PetLook>> = {
  // Infernal: ember red-orange, a cream belly, a flame at the tail's tip.
  'ember-newt': {
    dark: '#7a2a12', mid: '#c4501e', light: '#E8752A', belly: '#ffd08a', cheek: '#ff9b8a', iris: WHITE, pupil: PUPIL,
    head: [6, 5], body: [6, 3],
    back(p, l, q, bx, by) {
      l(bx - 5, by + 1, bx - 9, by - 2 + q.bob, 2, '#c4501e');
      l(bx - 9, by - 2 + q.bob, bx - 10, by - 4 + q.bob, 1, '#7a2a12');
      // The tail's flame (its glow in the Delve): two tongues that trade places.
      p(bx - 11, by - 7 + q.bob - q.flap, 2, 3, HOT[0]); p(bx - 10, by - 6 + q.bob - q.flap, 1, 2, HOT[1]);
      p(bx - 12 + q.flap, by - 5 + q.bob, 1, 1, HOT[2]);
    },
    marks(p, _l, _q, hx, hy) {
      // Crest nubs on the big head, spots down the back.
      p(hx - 2, hy - 6, 2, 1, '#E8752A'); p(hx + 1, hy - 6, 2, 1, '#E8752A');
      p(hx - 4, hy - 2, 1, 1, '#7a2a12'); p(hx - 5, hy, 1, 1, '#7a2a12');
    },
    hat(p, hx, top) { // a tiny forge cap, soot black with an ember band
      p(hx - 4, top + 1, 9, 2, '#2a2027'); p(hx - 3, top - 1, 7, 2, '#443540'); p(hx - 4, top + 2, 9, 1, '#E8752A');
      p(hx - 2, top - 1, 2, 1, '#57474f');
    },
  },
  // Luminous: ivory fluff, a golden collar, prism wings, gold-tipped antennae.
  'prism-mothkit': {
    dark: '#b9ab8c', mid: '#e9dfc8', light: '#fffaf0', belly: '#fff1b0', cheek: '#ffb0b8', iris: WHITE, pupil: '#3a2e1a',
    head: [6, 5], body: [5, 3],
    back(p, _l, q, bx, by) {
      const up = q.flap;
      // Two prism wings behind the body: pink, gold, sky.
      blob(p, bx - 4, by - 4 - up, 3, 2, '#ffd0e8'); p(bx - 6, by - 5 - up, 2, 1, '#b8f0ff');
      blob(p, bx - 3, by - 1 + up, 2, 1, '#fff1b0'); p(bx - 5, by - 1 + up, 1, 1, '#E8D44D');
    },
    marks(p, l, q, hx, hy) {
      // Antennae with gold tips, a fluffy collar.
      l(hx - 2, hy - 5, hx - 4, hy - 8 + (q.flap ? 0 : 1), 1, '#7a5a14');
      l(hx + 2, hy - 5, hx + 4, hy - 8 + (q.flap ? 1 : 0), 1, '#7a5a14');
      p(hx - 5, hy - 9 + (q.flap ? 0 : 1), 2, 2, GOLD[2]); p(hx + 4, hy - 9 + (q.flap ? 1 : 0), 2, 2, GOLD[2]);
      p(hx - 4, hy + 5, 9, 1, '#fff1b0'); p(hx - 3, hy + 4, 1, 1, '#fffaf0'); p(hx + 2, hy + 4, 1, 1, '#fffaf0');
    },
    hat(p, hx, top) { // a sunbloom crown
      p(hx - 4, top + 1, 9, 1, '#4a7a3a');
      for (const x of [-4, -1, 2]) { p(hx + x, top - 1, 3, 2, '#E8D44D'); p(hx + x + 1, top - 1, 1, 1, '#ffffff'); }
      p(hx - 2, top, 1, 1, '#ff9bb8'); p(hx + 1, top, 1, 1, '#ff9bb8');
    },
  },
  // Umbral: black-violet, floppy ears, an amethyst-lit muzzle, an ink-drip tail.
  'ink-pup': {
    dark: '#160f22', mid: '#33263a', light: '#4a3260', belly: '#8e7aa8', cheek: '#c9a0ff', iris: '#c9a0ff', pupil: PUPIL,
    head: [6, 5], body: [5, 3],
    back(p, l, q, bx, by) {
      l(bx - 5, by, bx - 8, by - 3 - q.flap, 2, '#33263a');
      p(bx - 9, by - 5 - q.flap, 2, 2, '#4a3260'); p(bx - 8, by - 1, 1, 2, '#160f22');
    },
    marks(p, _l, q, hx, hy) {
      // Floppy ears (up on the bark), a pale muzzle, an amethyst nose.
      if (q.eyes === 'wide') { p(hx - 6, hy - 7, 3, 4, '#33263a'); p(hx + 4, hy - 7, 3, 4, '#33263a'); p(hx - 5, hy - 6, 1, 2, '#a855f7'); p(hx + 5, hy - 6, 1, 2, '#a855f7'); }
      else { p(hx - 7, hy - 3, 3, 5, '#160f22'); p(hx + 5, hy - 3, 3, 5, '#160f22'); p(hx - 6, hy - 2, 1, 3, '#4a3260'); }
      p(hx + 1, hy + 2, 5, 2, '#8e7aa8'); p(hx + 4, hy + 2, 2, 1, '#a855f7');
    },
    hat(p, hx, top) { // an amethyst ribbon bow on the head
      p(hx - 1, top + 2, 2, 2, '#7b4fc0'); p(hx - 4, top + 1, 3, 3, '#a855f7'); p(hx + 1, top + 1, 3, 3, '#a855f7');
      p(hx - 3, top + 1, 1, 1, '#c9a0ff'); p(hx + 2, top + 1, 1, 1, '#c9a0ff');
    },
  },
  // Celestial: midnight blue, ear tufts, silver face disc, a gold beak and a star on the chest.
  'star-owlet': {
    dark: '#0a1428', mid: '#24406e', light: '#3a5a8a', belly: '#a8b8cc', cheek: '#8a90d8', iris: '#E8D44D', pupil: PUPIL,
    head: [7, 6], body: [5, 3],
    back(p, _l, q, bx, by) {
      // Little wings that lift on a hop.
      p(bx - 6, by - 2 - q.flap, 2, 4, '#14284a'); p(bx + 5, by - 2 - q.flap, 2, 4, '#14284a');
    },
    marks(p, _l, _q, hx, hy, bx, by) {
      p(hx - 6, hy - 7, 2, 3, '#14284a'); p(hx + 5, hy - 7, 2, 3, '#14284a');
      p(hx - 5, hy - 2, 11, 5, '#a8b8cc'); p(hx - 4, hy - 3, 9, 1, '#a8b8cc'); p(hx - 4, hy + 3, 9, 1, '#6a7890');
      p(hx, hy + 3, 2, 2, GOLD[1]); p(hx, hy + 3, 1, 1, GOLD[2]);
      p(bx, by, 1, 3, GOLD[2]); p(bx - 1, by + 1, 3, 1, GOLD[2]);
    },
    hat(p, hx, top) { // a wizard's star hat, very tall for a very small owl
      for (let r = 0; r < 5; r++) p(hx - 4 + r, top + 1 - r, 9 - r * 2, 1, r ? '#14284a' : '#24406e');
      p(hx - 5, top + 2, 11, 1, '#24406e'); p(hx, top - 2, 1, 1, GOLD[2]); p(hx + 1, top - 4, 1, 1, '#d8ecff');
    },
  },
  // Verdant: a root-brown face under a back of moss quills, a pink flower among them.
  'moss-hedgehog': {
    dark: '#3a2a1c', mid: '#7a5a36', light: '#b08a55', belly: '#e8c49a', cheek: '#ff9b8a', iris: WHITE, pupil: PUPIL,
    head: [6, 5], body: [6, 3],
    back(p, _l, q, bx, by) {
      // The quills: a moss mantle over the back, spiky at the edge.
      blob(p, bx - 1, by - 3 + q.bob, 7, 4, '#3a5a2a');
      for (let k = -6; k <= 4; k += 2) p(bx + k, by - 8 + q.bob + (k % 4 ? 0 : 1), 1, 2, '#4a7a3a');
      p(bx - 8, by - 3 + q.bob, 1, 2, '#4a7a3a'); p(bx - 3, by - 6 + q.bob, 2, 1, '#7fb85a');
    },
    marks(p, _l, _q, hx, hy) {
      // Moss over the crown, a snout and a little pink flower.
      p(hx - 6, hy - 5, 7, 3, '#3a5a2a'); p(hx - 5, hy - 6, 4, 1, '#4a7a3a'); p(hx - 4, hy - 5, 2, 1, '#7fb85a');
      p(hx + 5, hy + 1, 2, 2, '#e8c49a'); p(hx + 6, hy + 1, 1, 1, PUPIL);
      p(hx - 3, hy - 7, 1, 1, '#ff9bb8'); p(hx - 4, hy - 6, 3, 1, '#ff9bb8'); p(hx - 3, hy - 6, 1, 1, '#ffe7a0');
    },
    hat(p, hx, top) { // an acorn cap
      p(hx - 4, top + 1, 9, 2, '#7a5a36'); p(hx - 3, top, 7, 1, '#b08a55'); p(hx - 2, top + 1, 1, 1, '#c8a060'); p(hx, top - 2, 1, 2, '#3a2a1c');
    },
  },
  // The Underhearth: a round basalt baby scavenger, rivet studs, a box jaw with an ember seam.
  'rivet-hatchling': {
    dark: '#241a1c', mid: '#3a2b2c', light: '#6b5148', belly: '#5a4440', cheek: '#c4501e', iris: '#ffd08a', pupil: '#7a2a12',
    head: [6, 5], body: [6, 3],
    back(p, _l, q, bx, by) { blob(p, bx - 6, by + q.bob, 1, 1, '#3a2b2c'); },
    marks(p, _l, q, hx, hy, bx, by) {
      for (let k = 0; k < 3; k++) { p(bx - 4 + k * 3, by - 3, 2, 1, '#57474f'); p(bx - 4 + k * 3, by - 3, 1, 1, '#877c84'); }
      p(hx - 2, hy - 6, 2, 1, '#57474f');
      // The box jaw: a seam that glows, wider when it is happy.
      const open = q.mouth === 'open' ? 1 : 0;
      p(hx - 1, hy + 2, 7, 1 + open, '#7a2a12'); p(hx, hy + 2, 2, 1, '#E8752A'); p(hx + 3, hy + 2, 2, 1, '#c4501e');
      p(hx - 1, hy + 3 + open, 7, 1, '#2a2027');
    },
    hat(p, hx, top) { // a miner's helmet with a lit lamp
      p(hx - 5, top + 1, 11, 2, '#b08a55'); p(hx - 4, top - 1, 9, 2, '#8a6a3a'); p(hx - 3, top - 1, 2, 1, '#e8c47a');
      p(hx + 1, top - 2, 3, 2, '#ffd08a'); p(hx + 2, top - 2, 1, 1, '#fff4dc');
    },
  },
  // The Ink Deeps: smoke-black fox-kit, pointed ears, pale moonlit eyes, a wisp of a tail.
  'shade-kit': {
    dark: '#0e0912', mid: '#1a1220', light: '#33263a', belly: '#4a3260', cheek: '#6a5878', iris: '#d8dcf0', pupil: '#8a90b0',
    head: [6, 5], body: [5, 3],
    back(p, l, q, bx, by) {
      l(bx - 5, by, bx - 9, by - 4 - q.flap, 3, '#1a1220');
      p(bx - 11, by - 7 - q.flap, 3, 3, '#33263a'); p(bx - 11, by - 7 - q.flap, 1, 1, '#d8dcf0');
    },
    marks(p, _l, _q, hx, hy) {
      for (const s of [-1, 1]) {
        const x = hx + s * 4;
        p(x - 1, hy - 8, 3, 1, '#1a1220'); p(x - 1, hy - 7, 3, 2, '#1a1220'); p(x, hy - 9, 1, 1, '#1a1220'); p(x, hy - 7, 1, 2, '#6a5878');
      }
      p(hx + 2, hy + 2, 4, 1, '#33263a');
    },
    hat(p, hx, top) { // a silver crescent circlet
      p(hx - 4, top + 2, 9, 1, '#8a90b0'); p(hx - 1, top, 3, 2, '#d8dcf0'); p(hx, top, 1, 1, '#ffffff'); p(hx + 1, top + 1, 1, 1, '#8a90b0');
    },
  },
};

/** Paint one frame of a pet (feet on row PET_H − 1, facing right) through a pixel callback. */
export function paintPetFrame(p: P, l: L, id: PetId, frame: PetFrame, hat: boolean): void {
  const look = LOOKS[id], q = POSES[frame];
  const foot = PET_H - 1;
  const bx = 13, by = foot - 3 - q.lift + (q.curl ? 1 : 0);
  const [brx, bry] = look.body;
  const hx = q.curl ? 15 : 14, hy = foot - 9 - q.lift + q.bob;
  const [hrx, hry] = look.head;
  // Tails and wings stay inside the cell when it curls up asleep.
  look.back?.(p, l, q.curl ? { ...q, bob: 1 } : q, bx, by);
  // Little feet (tucked on a hop, hidden asleep).
  if (!q.curl) {
    const tuck = q.lift > 1 ? 1 : 0;
    p(bx - 4, foot - 1 - tuck, 3, 2 - tuck, look.dark); p(bx + 2, foot - 1 - tuck, 3, 2 - tuck, look.dark);
    p(bx - 4, foot - 1 - tuck, 2, 1, look.mid); p(bx + 2, foot - 1 - tuck, 2, 1, look.mid);
  }
  orb(p, bx, by, brx, q.curl ? bry - 1 : bry, look.dark, look.mid, look.light);
  blob(p, bx + 1, by + 1, Math.max(1, brx - 3), Math.max(0, bry - 2), look.belly);
  orb(p, hx, hy, hrx, hry, look.dark, look.mid, look.light);
  look.marks(p, l, q, hx, hy, bx, by);
  // The face: big eyes with a white highlight, a tiny mouth, rosy cheeks.
  const ex = hx, ey = hy - 1;
  for (const x of [ex - 1, ex + 3]) {
    if (q.eyes === 'shut') { p(x, ey + 2, 2, 1, PUPIL); continue; }
    if (q.eyes === 'smile') { p(x, ey + 1, 1, 1, PUPIL); p(x + 1, ey, 1, 1, PUPIL); p(x + 2, ey + 1, 1, 1, PUPIL); continue; }
    const tall = q.eyes === 'wide' ? 4 : 3;
    p(x, ey - (tall - 3), 2, tall, look.iris === WHITE ? PUPIL : look.iris);
    if (look.iris !== WHITE) p(x + 1, ey + 1, 1, 2, look.pupil);
    p(x, ey - (tall - 3), 1, 1, WHITE);
  }
  if (q.mouth === 'dot') p(ex + 2, ey + 4, 1, 1, PUPIL);
  if (q.mouth === 'open') { p(ex + 1, ey + 4, 3, 1, PUPIL); p(ex + 2, ey + 5, 1, 1, '#ff6a7a'); }
  p(ex - 3, ey + 3, 2, 1, look.cheek); p(ex + 5, ey + 3, 2, 1, look.cheek);
  if (hat) look.hat(p, hx, hy - hry - 2);
}

/** One sheet per pet type: every frame (and its hatted twin), outlined once, cached for the session. */
const SLOT_W = PET_W + 2, SLOT_H = PET_H + 4;
const sheets = new Map<PetId, HTMLCanvasElement>();

function sheetFor(id: PetId): HTMLCanvasElement | null {
  const have = sheets.get(id);
  if (have) return have;
  if (typeof document === 'undefined') return null;
  const raw = canvas(SLOT_W * PET_FRAMES.length, SLOT_H * 2);
  const c = raw.getContext('2d');
  if (!c) return null;
  PET_FRAMES.forEach((frame, i) => {
    for (const hat of [false, true]) {
      // Each slot keeps a 1 px clear rim so the one outline pass never bleeds into a neighbour; 2 rows of headroom for hats.
      const ox = i * SLOT_W + 1, oy = (hat ? SLOT_H : 0) + 3;
      paintPetFrame((x, y, w, h, color) => px(c, ox + x, oy + y, w, h, color), (x0, y0, x1, y1, t, color) => limb(c, ox + x0, oy + y0, ox + x1, oy + y1, t, color), id, frame, hat);
    }
  });
  const sheet = outlined(raw);
  sheets.set(id, sheet);
  return sheet;
}

/**
 * Draw a pet with the context at its feet (world px), facing right unless
 * `facing` < 0. `scale` is world px per art px (4 in towns, 2 in the Delve).
 */
export function drawPet(c: CanvasRenderingContext2D, id: PetId, frame: PetFrame, hat: boolean, x: number, y: number, scale: number, facing: number, squash = 0): void {
  const sheet = sheetFor(id);
  if (!sheet) return;
  const i = PET_FRAMES.indexOf(frame);
  const w = SLOT_W * scale, h = SLOT_H * scale;
  const smooth = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  if (facing < 0) c.scale(-1, 1);
  if (squash) c.scale(1 + squash, 1 - squash);
  // The slot's bottom: 1 px of rim under the outline row of the feet.
  c.drawImage(sheet, i * SLOT_W, hat ? SLOT_H : 0, SLOT_W, SLOT_H, -Math.floor(SLOT_W / 2) * scale, -h + scale, w, h);
  c.restore();
  c.imageSmoothingEnabled = smooth;
}

/** A still portrait (the pet well, the sheet, the Codex): a data URL of one frame, cached. */
const portraits = new Map<string, string>();
export function petPortrait(id: PetId, frame: PetFrame = 'idle0', hat = false, scale = 4): string {
  const key = `${id}:${frame}:${hat}:${scale}`;
  const have = portraits.get(key);
  if (have !== undefined) return have;
  if (typeof document === 'undefined') return '';
  const el = canvas(SLOT_W * scale, SLOT_H * scale);
  const c = el.getContext('2d');
  if (!c) return '';
  drawPet(c, id, frame, hat, el.width / 2, el.height, scale, 1);
  const url = el.toDataURL('image/png');
  portraits.set(key, url);
  return url;
}

/** The egg: a speckled oval in the pet's ramp (the pet well and the sheet before it hatches). */
export function eggPortrait(id: PetId, crack = 0, scale = 4): string {
  const key = `egg:${id}:${crack}:${scale}`;
  const have = portraits.get(key);
  if (have !== undefined) return have;
  if (typeof document === 'undefined') return '';
  const look = LOOKS[id];
  const raw = canvas(16, 18);
  const c = raw.getContext('2d');
  if (!c) return '';
  const p: P = (x, y, w, h, color) => px(c, x + 1, y + 1, w, h, color);
  orb(p, 7, 9, 5, 7, look.dark, look.belly, '#fffaf0');
  p(4, 6, 2, 1, look.mid); p(8, 4, 2, 1, look.mid); p(9, 10, 2, 1, look.mid); p(5, 12, 2, 1, look.mid);
  if (crack) { p(5, 7, 1, 1, OUTLINE); p(6, 8, 1, 1, OUTLINE); p(7, 7, 1, 1, OUTLINE); p(8, 8, 1, 1, OUTLINE); p(9, 7, 1, 1, OUTLINE); }
  const out = outlined(raw);
  const el = canvas(16 * scale, 18 * scale);
  const g = el.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(out, 0, 0, el.width, el.height);
  const url = el.toDataURL('image/png');
  portraits.set(key, url);
  return url;
}
