/**
 * td-pet-art.ts — the eight pets and Glim, drawn for the top-down world to the bestiary's standard (td-mobs.ts brushes:
 * shapes lit from the top-left, the selective outline). A pet is chibi — a big round head, big eyes with a white
 * shine, a small soft body — about half the Keeper's height, so it reads as his and never as a foe.
 *
 * One sheet per pet, eight cells of PET_W × PET_H (feet on the bottom row, facing right):
 *   walk0..walk3  the trot (contact, passing, contact, passing) — or a flier's wingbeat
 *   sit0, sit1    sitting: tail one way, then the other, looking back over its shoulder (the idle wag / look round)
 *   sleep         curled up, eyes shut (the Keeper standing still a long while)
 *   happy         a hop, eyes smiling (a fetch brought back, a meal, a level)
 */
import { TD_BRUSH, type TdRamp } from './td-mobs';
import { GLIM_FACE_PALETTE, GLIM_H, GLIM_PALETTE, GLIM_PALETTE_DIM, GLIM_W, glimFace, glimRows, type GlimFrameName, type GlimMood } from '../../shared/glim/glim-art';

const { px, dot, orb, poly, limb, line, glow, outline } = TD_BRUSH;
type C = CanvasRenderingContext2D;

export const PET_W = 24;
export const PET_H = 20;
export type TdPetFrame = 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'sit0' | 'sit1' | 'sleep' | 'happy';
export const TD_PET_FRAMES: readonly TdPetFrame[] = ['walk0', 'walk1', 'walk2', 'walk3', 'sit0', 'sit1', 'sleep', 'happy'];

/** A pose: the body's rise, how the legs stand, the eyes, the tail's swing. */
interface Pose { f: number; bob: number; lift: number; legs: 'walk' | 'sit' | 'tuck' | 'curl'; eyes: 'open' | 'look' | 'shut' | 'smile'; wag: number; flap: number }
const POSES: Readonly<Record<TdPetFrame, Pose>> = {
  walk0: { f: 0, bob: 0, lift: 0, legs: 'walk', eyes: 'open', wag: 0, flap: 0 },
  walk1: { f: 1, bob: -1, lift: 0, legs: 'walk', eyes: 'open', wag: 1, flap: 1 },
  walk2: { f: 2, bob: 0, lift: 0, legs: 'walk', eyes: 'open', wag: 0, flap: 2 },
  walk3: { f: 3, bob: -1, lift: 0, legs: 'walk', eyes: 'open', wag: -1, flap: 1 },
  sit0: { f: 0, bob: 1, lift: 0, legs: 'sit', eyes: 'open', wag: 1, flap: 0 },
  sit1: { f: 2, bob: 1, lift: 0, legs: 'sit', eyes: 'look', wag: -1, flap: 1 },
  sleep: { f: 0, bob: 3, lift: 0, legs: 'curl', eyes: 'shut', wag: 0, flap: 0 },
  happy: { f: 1, bob: -1, lift: 2, legs: 'tuck', eyes: 'smile', wag: 1, flap: 2 },
};

const INK = '#1a1020', SHINE = '#ffffff', CHEEK = '#ff9fb0', MOUTH = '#5a2030';
const STEP = [2, 0, -2, 0] as const;

/** Two big eyes (3/4 view: the far one a column narrower), and the cheeks under them. */
function eyes(c: C, x1: number, x2: number, y: number, mode: Pose['eyes'], iris = INK, cheeks = true): void {
  for (const [i, x] of [[0, x1], [1, x2]] as const) {
    const w = i === 0 ? 1 : 2;
    if (mode === 'shut') { px(c, x, y + 1, w + (i === 0 ? 1 : 0), 1, iris); continue; }
    if (mode === 'smile') { dot(c, x, y + 1, iris); dot(c, x + 1, y, iris); if (i) dot(c, x + 2, y + 1, iris); continue; }
    const dx = mode === 'look' ? -1 : 0;
    px(c, x + dx, y, w, 2, iris);
    dot(c, x + dx + (w - 1), y, SHINE);
  }
  if (cheeks && mode !== 'shut') { dot(c, x1 - 1, y + 2, CHEEK); dot(c, x2 + 2, y + 2, CHEEK); }
}
/** Four little legs (far pair darker) under a body whose belly is at `hip`; `q.legs` folds them. */
function paws(c: C, q: Pose, back: number, front: number, hip: number, far: TdRamp, near: TdRamp): void {
  if (q.legs === 'curl') return;
  const g = 19 - q.lift;
  if (q.legs === 'tuck') { for (const [x, r] of [[back + 1, far], [front + 1, far], [back, near], [front, near]] as const) limb(c, [x, hip], [x + 1, g - 1], 2, r); return; }
  if (q.legs === 'sit') {
    // Hind legs folded under a round haunch; the front pair straight.
    orb(c, back + 1, g - 2, 3, 2.2, near);
    limb(c, [front + 1, hip], [front + 1, g], 2, far); limb(c, [front, hip], [front, g], 2, near);
    px(c, front - 1, g, 3, 1, near[2]);
    return;
  }
  const s = STEP[q.f];
  const leg = (x: number, swing: number, up: number, r: TdRamp) => { limb(c, [x, hip], [x + swing * .5, g - up], 2, r); px(c, x + swing * .5 - 1, g - up, 3, 1, r[2]); };
  leg(back + 1, -s, q.f === 3 ? 1 : 0, far); leg(front + 1, s, q.f === 1 ? 1 : 0, far);
  leg(back, s, q.f === 1 ? 1 : 0, near); leg(front, -s, q.f === 3 ? 1 : 0, near);
}

// ── Ramps (realm colours: the bestiary's, made softer) ────────────────────────
const RP = {
  ink: ['#8a94d4', '#4f58a0', '#343b78', '#20244e'],
  inkDk: ['#4f58a0', '#343b78', '#252a5a', '#171a3a'],
  shade: ['#9a78c4', '#5e4284', '#3e2c5a', '#24183a'],
  shadeDk: ['#5e4284', '#3e2c5a', '#2c1f42', '#1a1228'],
  rust: ['#ffc08a', '#e8804a', '#b05030', '#70301c'],
  rustDk: ['#e8804a', '#b05030', '#7c3820', '#4a2214'],
  iron: ['#d4ceda', '#8c8698', '#5e5868', '#3c3844'],
  moss: ['#b4e08a', '#6eae52', '#467a38', '#2a5226'],
  mossDk: ['#6eae52', '#467a38', '#30582a', '#1c3a1a'],
  tan: ['#ffe4c0', '#e8b888', '#b8865c', '#80583a'],
  newt: ['#ffb080', '#ec6a3a', '#b04224', '#702414'],
  newtDk: ['#ec6a3a', '#b04224', '#7e2c18', '#4e1a0e'],
  owl: ['#b4c0f4', '#6c7ac8', '#46519a', '#2a3266'],
  owlDk: ['#6c7ac8', '#46519a', '#323a74', '#1e2448'],
  cream: ['#fffaf0', '#f4e6c8', '#d4be96', '#a08a66'],
  moth: ['#ffffff', '#f2ecfa', '#cfc4e2', '#9a8cb8'],
  wingA: ['#e8fbff', '#a8e4ff', '#6aa8e0', '#3a6aa8'],
  wingB: ['#fff0fa', '#ffb8e4', '#d47ab8', '#8a4a80'],
  sun: ['#fffbd0', '#ffd860', '#e8a030', '#a86414'],
  ray: ['#fff4a8', '#ffc84a', '#e89a2a', '#a8641a'],
  // The spirit beast: the Verdant's rootglass light (td-mobs R.rootglass), and a shade deeper for its far side.
  spirit: ['#f0fff8', '#9af0d0', '#4cb898', '#2a7a64'],
  spiritDk: ['#9af0d0', '#4cb898', '#2a7a64', '#1a4a3c'],
} satisfies Record<string, TdRamp>;
const EMBER: TdRamp = ['#fff2a8', '#ffb347', '#e2552a', '#9e2e1c'];
const VIOLET: TdRamp = ['#f0e0ff', '#c88bff', '#8a52c8', '#5a2e8a'];

// ── The pets ──────────────────────────────────────────────────────────────────

/** The Ink Pup: a round ink-blue puppy, floppy ears, a white star on its chest, a brush of a tail that never stops. */
function inkPup(c: C, q: Pose): void {
  const b = q.bob - q.lift;
  if (q.legs === 'curl') {
    orb(c, 10, 16, 7, 3.4, RP.ink); limb(c, [4, 15], [8, 18], 2, RP.inkDk);
    orb(c, 15, 14.5, 5, 4, RP.ink); poly(c, [[12, 11], [10, 15], [13, 15]], RP.inkDk);
    eyes(c, 14, 17, 14, 'shut'); dot(c, 19.5, 16, INK);
    return;
  }
  // Tail: a brush held up, wagging.
  limb(c, [5, 12 + b], [2 + q.wag, 7 + b], 2, RP.ink); dot(c, 2 + q.wag, 6 + b, RP.ink[0]);
  paws(c, q, 6, 11, 15 + b, RP.inkDk, RP.ink);
  const sit = q.legs === 'sit';
  orb(c, sit ? 9.5 : 9, sit ? 12.5 + b : 13 + b, sit ? 4.6 : 5.5, sit ? 4.4 : 3.6, RP.ink);
  px(c, 11, 13 + b, 3, 2, '#e8e6f6');
  // The big head, ears flopped down either side.
  orb(c, 15, 8.5 + b, 5.6, 4.8, RP.ink);
  poly(c, [[11, 5 + b], [9, 11 + b], [11.5, 11 + b], [12.5, 6 + b]], RP.inkDk);
  poly(c, [[18, 4.5 + b], [20.5, 10 + b], [18.5, 10 + b], [17, 5.5 + b]], RP.inkDk);
  orb(c, 18.5, 10.5 + b, 2.6, 1.8, ['#dcdcf0', '#b8b8d8', '#8c8cb4', '#5c5c88']);
  dot(c, 20, 9.5 + b, INK);
  eyes(c, 13, 16, 7 + b, q.eyes, INK);
  if (q.eyes === 'smile') px(c, 18, 12 + b, 2, 1, MOUTH);
}

/** The Shade-kit: a violet-black kitten, pointy ears pink inside, eyes of soft violet light, a wisp of a tail. */
function shadeKit(c: C, q: Pose): void {
  const b = q.bob - q.lift;
  if (q.legs === 'curl') {
    orb(c, 10, 16, 7, 3.2, RP.shade); limb(c, [3, 16], [9, 18.5], 2, RP.shadeDk); dot(c, 9, 18, VIOLET[1]);
    orb(c, 15.5, 14.5, 4.6, 3.8, RP.shade);
    poly(c, [[13, 12], [13.5, 8.5], [15.5, 11.5]], RP.shade); poly(c, [[16.5, 11.5], [18.5, 8.5], [19, 12]], RP.shade);
    eyes(c, 14, 17, 14, 'shut', VIOLET[2], false);
    return;
  }
  // The tail: a smoky S that ends in a violet spark.
  limb(c, [5, 13 + b], [3, 9 + b], 2, RP.shade); limb(c, [3, 9 + b], [4 + q.wag, 5 + b], 2, RP.shade);
  dot(c, 4 + q.wag, 4 + b, VIOLET[1]);
  paws(c, q, 6, 11, 15 + b, RP.shadeDk, RP.shade);
  const sit = q.legs === 'sit';
  orb(c, sit ? 9.5 : 9, sit ? 12.5 + b : 13 + b, sit ? 4.4 : 5.2, sit ? 4.2 : 3.4, RP.shade);
  orb(c, 15, 9 + b, 5.2, 4.4, RP.shade);
  poly(c, [[11, 6.5 + b], [11.5, 1 + b], [14.5, 5 + b]], RP.shade); dot(c, 12, 4 + b, CHEEK);
  poly(c, [[16, 5 + b], [19, 1 + b], [19.8, 6.5 + b]], RP.shade); dot(c, 18.5, 4 + b, CHEEK);
  dot(c, 19, 11 + b, CHEEK);
  if (q.eyes === 'open' || q.eyes === 'look') {
    const dx = q.eyes === 'look' ? -1 : 0;
    px(c, 13 + dx, 8 + b, 1, 2, VIOLET[1]); px(c, 16 + dx, 8 + b, 2, 2, VIOLET[1]); dot(c, 17 + dx, 8 + b, VIOLET[0]);
  } else eyes(c, 13, 16, 8 + b, q.eyes, VIOLET[2], false);
  dot(c, 21, 10 + b, RP.shade[0]);
}

/** The Rivet Maw hatchling: a stubby rust-and-iron pup of a maw, rivets for freckles, a jaw too big for it, all grin. */
function rivetHatchling(c: C, q: Pose): void {
  const b = q.bob - q.lift;
  if (q.legs === 'curl') {
    orb(c, 11, 15.5, 7.5, 3.8, RP.rust);
    for (const x of [6, 9, 12]) dot(c, x, 13.5, RP.iron[0]);
    orb(c, 16, 14.5, 4.5, 3.5, RP.rust); px(c, 15, 17, 6, 1, RP.iron[2]);
    eyes(c, 15, 17, 13.5, 'shut');
    return;
  }
  // A stub of a tail with a bolt on its end.
  limb(c, [5, 12 + b], [2, 10 + b + q.wag], 2, RP.rust); dot(c, 1.5, 9.5 + b + q.wag, RP.iron[0]);
  paws(c, q, 6, 11, 15 + b, RP.rustDk, RP.rust);
  const sit = q.legs === 'sit';
  orb(c, sit ? 9.5 : 9, 12.5 + b, sit ? 5 : 5.8, sit ? 4.4 : 4, RP.rust);
  for (const x of [6, 9, 12]) dot(c, x, 10 + b, RP.iron[0]);
  // The head: an iron brow plate over two eyes, the lower jaw a hinged iron scoop with teeth.
  orb(c, 15.5, 8.5 + b, 5.6, 4.6, RP.rust);
  poly(c, [[11, 6 + b], [14, 3.5 + b], [19, 3.5 + b], [21, 6 + b], [11, 7 + b]], RP.iron);
  dot(c, 13, 5 + b, RP.iron[3]); dot(c, 19, 5 + b, RP.iron[3]);
  const open = q.eyes === 'smile' ? 2 : q.f % 2;
  poly(c, [[13, 11 + b], [22, 10 + b + open], [21.5, 13 + b + open], [14, 13.5 + b]], RP.iron);
  for (const x of [16, 18, 20]) dot(c, x, 10 + b + open, '#fffaf0');
  eyes(c, 14, 17, 7 + b, q.eyes);
}

/** The Moss Hedgehog: a tan face under a dome of mossy quills, a pink button nose, tiny feet. */
function mossHedgehog(c: C, q: Pose): void {
  const b = q.bob - q.lift;
  if (q.legs === 'curl') {
    orb(c, 11, 15, 8, 4.5, RP.moss);
    for (let i = 0; i < 6; i++) dot(c, 5 + i * 2.4, 11.5 + (i % 2), RP.mossDk[2]);
    dot(c, 18.5, 17, CHEEK);
    return;
  }
  paws(c, q, 7, 12, 16 + b, RP.tan, RP.tan);
  // The quill dome, spikes poking out along its top.
  orb(c, 10, 12 + b, 7.5, 5.5, RP.moss);
  for (let i = 0; i < 6; i++) { const x = 4 + i * 2.4; poly(c, [[x, 9 + b - (i % 2)], [x + 1, 4.5 + b + Math.abs(i - 2.5) * .7], [x + 2.2, 9 + b]], RP.mossDk); }
  dot(c, 7, 9 + b, RP.moss[0]); dot(c, 11, 8 + b, RP.moss[0]);
  dot(c, 6, 12 + b, '#ffd6ec'); dot(c, 9, 14 + b, '#fff4a8');
  // The face peeks out in front.
  orb(c, 16.5, 12 + b, 4.4, 3.8, RP.tan);
  orb(c, 20.5, 13 + b, 1.6, 1.2, RP.tan); dot(c, 21.5, 12.5 + b, CHEEK);
  eyes(c, 15, 18, 10.5 + b, q.eyes);
}

/** The Ember Newt: a low orange salamander, yellow spots, a long tail whose tip is a little flame (its lamp). */
function emberNewt(c: C, q: Pose): void {
  const b = q.bob - q.lift;
  if (q.legs === 'curl') {
    limb(c, [8, 17], [3, 16], 2, RP.newt); limb(c, [3, 16], [5, 13], 2, RP.newt); glow(c, 5, 11.5, 1, EMBER);
    orb(c, 11, 16, 6, 2.8, RP.newt);
    orb(c, 16.5, 15.5, 4.2, 3.2, RP.newt);
    eyes(c, 15, 18, 14.5, 'shut');
    return;
  }
  const sw = q.f % 2 ? 1 : -1;
  limb(c, [6, 15 + b], [2, 13 + b + sw], 2, RP.newt); limb(c, [2, 13 + b + sw], [1, 9 + b + q.wag], 2, RP.newt);
  glow(c, 0.5, 7 + b + q.wag, 1, EMBER); dot(c, 1, 6 + b + q.wag - (q.f % 2), EMBER[1]);
  paws(c, q, 7, 12, 16 + b, RP.newtDk, RP.newt);
  orb(c, 10, 14.5 + b, 6, 2.8, RP.newt);
  for (const x of [7, 10, 13]) dot(c, x, 13 + b, '#ffd860');
  orb(c, 16.5, 11.5 + b, 5, 4, RP.newt);
  // Frilly little gills behind the head.
  dot(c, 12, 9 + b, EMBER[1]); dot(c, 12, 11 + b, EMBER[1]); dot(c, 13, 8 + b, EMBER[0]);
  eyes(c, 15, 18, 10 + b, q.eyes);
  if (q.eyes === 'smile') px(c, 19, 13 + b, 2, 1, MOUTH);
}

/** The Star Owlet: a round blue owlet with a cream face disc, ear tufts, a gold star on its chest; it hops on two feet. */
function starOwlet(c: C, q: Pose): void {
  const b = q.bob - q.lift;
  if (q.legs === 'curl') {
    orb(c, 12, 14.5, 6.5, 5, RP.owl);
    orb(c, 13.5, 13.5, 4, 3, RP.cream);
    eyes(c, 11.5, 14.5, 12.5, 'shut');
    dot(c, 13.5, 15, '#e8a030');
    return;
  }
  // Feet: two orange prongs (a hop tucks them).
  const hop = q.legs === 'walk' ? (q.f === 1 || q.f === 3 ? 1 : 0) : 0;
  if (q.legs !== 'tuck') { px(c, 9, 18 - hop, 2, 2 + hop, '#e8a030'); px(c, 14, 18 - hop, 2, 2 + hop, '#e8a030'); }
  // A wing folded at its side.
  orb(c, 12, 11 + b - hop, 6.8, 6.6, RP.owl);
  poly(c, [[6, 10 + b - hop], [8, 16 + b - hop], [5, 15 + b - hop]], RP.owlDk);
  poly(c, [[7.5, 5.5 + b - hop], [7.5, 2.5 + b - hop], [10, 5 + b - hop]], RP.owlDk);
  poly(c, [[14.5, 5 + b - hop], [17, 2.5 + b - hop], [17, 5.5 + b - hop]], RP.owlDk);
  orb(c, 12.5, 9.5 + b - hop, 4.8, 3.6, RP.cream);
  px(c, 11, 14 + b - hop, 3, 1, '#ffd860'); px(c, 12, 13 + b - hop, 1, 3, '#ffd860');
  // Two big owl eyes, front on.
  const ey = 8 + b - hop;
  if (q.eyes === 'open' || q.eyes === 'look') {
    const dx = q.eyes === 'look' ? -1 : 0;
    for (const x of [9, 14]) { px(c, x + dx, ey, 2, 2, INK); dot(c, x + dx, ey, SHINE); dot(c, x === 9 ? 8 : 16, ey + 2, CHEEK); }
  } else for (const x of [9, 14]) { if (q.eyes === 'smile') { dot(c, x, ey + 1, INK); dot(c, x + 1, ey, INK); } else px(c, x, ey + 1, 2, 1, INK); }
  dot(c, 12.5, 11 + b - hop, '#e8a030');
}

/** The Prism Moth-kit: a fluffy cream moth, feathered antennae, prism wings that catch the light as they beat. */
function prismMothkit(c: C, q: Pose): void {
  const lift = q.legs === 'curl' ? 0 : 4 - q.bob;
  const y = (v: number) => v - lift;
  const up = q.legs === 'curl' ? 1 : q.flap;
  // Wings: the far pair darker, then the near, raised by the beat.
  const wing = (dx: number, r: TdRamp) => poly(c, [[10 + dx, y(12)], [3 + dx, y(5 + up * 2)], [2 + dx, y(10 + up)], [6 + dx, y(15)], [10 + dx, y(15)]], r);
  wing(2, RP.wingB); wing(0, RP.wingA);
  dot(c, 5, y(9 + up), RP.wingB[1]); dot(c, 7, y(12), '#fff4a8');
  orb(c, 12, y(14), 4.5, 4, RP.moth);
  orb(c, 15.5, y(10), 4.6, 4.2, RP.moth);
  // Antennae, feathered.
  line(c, [14, y(6)], [12, y(2)], RP.moth[3]); line(c, [17, y(6)], [19, y(2)], RP.moth[3]);
  dot(c, 11.5, y(1.5), '#ffd860'); dot(c, 19.5, y(1.5), '#ffd860');
  eyes(c, 14, 17, y(9), q.eyes);
}

/** The Sunling: a very small sun with a face, rays that turn as it bobs, a warm halo. */
function sunling(c: C, q: Pose): void {
  const lift = q.legs === 'curl' ? 0 : 5 - q.bob;
  const cy = 12 - lift, cx = 12;
  // Rays: eight short spikes that alternate long and short by frame.
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + (q.f % 2 ? Math.PI / 8 : 0), long = (i + q.f) % 2 ? 7.5 : 6.5;
    limb(c, [cx + Math.cos(a) * 4, cy + Math.sin(a) * 4], [cx + Math.cos(a) * long, cy + Math.sin(a) * long], 1.6, RP.ray);
  }
  orb(c, cx, cy, 5.4, 5.2, RP.sun);
  dot(c, cx - 3, cy - 3, '#ffffff');
  eyes(c, cx - 2, cx + 1, cy - 1, q.eyes, MOUTH);
  if (q.eyes !== 'shut') px(c, cx - 1, cy + 2, 2, 1, MOUTH);
}

/**
 * The spirit beast (td-thorn.ts SPIRIT_BEAST): what stands in at a Thornstrider's side when no pet walks with him — a
 * fox-wolf of the wild's rootglass light, a long brush of a tail with a wisp at its tip, tall ears and a sprig of
 * leaves between them. The engine draws it half-seen (a spirit), and the called beasts and the stampede are its kin.
 */
function spiritBeast(c: C, q: Pose): void {
  const b = q.bob - q.lift;
  if (q.legs === 'curl') {
    orb(c, 10, 16, 7, 3.4, RP.spirit); limb(c, [3, 16], [9, 18.5], 2, RP.spiritDk); dot(c, 3, 15, '#e8f5b0');
    orb(c, 15, 14.5, 4.6, 3.8, RP.spirit); poly(c, [[13, 10], [14.5, 13], [16, 11]], RP.spiritDk);
    eyes(c, 14, 17, 14, 'shut', '#1a4a3c', false); dot(c, 19.5, 15.5, INK);
    return;
  }
  // The tail: a long brush streaming back, its tip a wisp of light.
  limb(c, [5, 12 + b], [1 + q.wag, 9 + b], 2, RP.spirit); dot(c, 1 + q.wag, 8 + b, RP.spirit[0]); dot(c, q.wag, 7 + b, '#e8f5b0');
  paws(c, q, 6, 12, 15 + b, RP.spiritDk, RP.spirit);
  const sit = q.legs === 'sit';
  orb(c, 9.5, sit ? 12.5 + b : 12.8 + b, sit ? 4.6 : 6, sit ? 4.4 : 3.4, RP.spirit);
  px(c, 12, 13 + b, 3, 2, '#f0fff8');
  // The head: a fox's long muzzle, two tall pointed ears, a sprig of leaves between them.
  orb(c, 15.5, 8.5 + b, 4.8, 4.2, RP.spirit);
  poly(c, [[12.5, 6 + b], [13, 1.5 + b], [15, 5 + b]], RP.spiritDk);
  poly(c, [[16, 5 + b], [18, 1.5 + b], [18.5, 6 + b]], RP.spirit);
  poly(c, [[18, 8 + b], [22.5, 10 + b], [18, 11.5 + b]], RP.spirit); dot(c, 22, 10 + b, INK);
  px(c, 15, 3 + b, 1, 1, '#6eae52'); px(c, 16, 2 + b, 1, 1, '#b4e08a');
  eyes(c, 14, 17, 7 + b, q.eyes, '#1a4a3c', false);
  if (q.eyes === 'smile') px(c, 19, 11 + b, 2, 1, MOUTH);
}

const PAINT: Readonly<Record<string, (c: C, q: Pose) => void>> = {
  'ink-pup': inkPup, 'shade-kit': shadeKit, 'rivet-hatchling': rivetHatchling, 'moss-hedgehog': mossHedgehog,
  'ember-newt': emberNewt, 'star-owlet': starOwlet, 'prism-mothkit': prismMothkit, 'sunling': sunling,
  'spirit-beast': spiritBeast,
};
export const hasTdPetArt = (id: string): boolean => id in PAINT;

const sheets = new Map<string, HTMLCanvasElement>();
/** A pet's eight frames side by side, painted once and outlined like the creatures. */
export function petSheet(id: string): HTMLCanvasElement | null {
  const paint = PAINT[id];
  if (!paint || typeof document === 'undefined') return null;
  let s = sheets.get(id);
  if (s) return s;
  s = document.createElement('canvas'); s.width = PET_W * TD_PET_FRAMES.length; s.height = PET_H;
  const o = s.getContext('2d')!;
  TD_PET_FRAMES.forEach((frame, i) => {
    const cell = document.createElement('canvas'); cell.width = PET_W; cell.height = PET_H;
    const c = cell.getContext('2d', { willReadFrequently: true })!;
    paint(c, POSES[frame]);
    const img = c.getImageData(0, 0, PET_W, PET_H);
    outline(img);
    o.putImageData(img, i * PET_W, 0);
  });
  sheets.set(id, s);
  return s;
}
/** The cell of a frame in the sheet. */
export const petFrameIndex = (frame: TdPetFrame): number => TD_PET_FRAMES.indexOf(frame);

/** The pet's face for the HUD chip (a data URL, made once per pet): the head of its sit frame. */
const faces = new Map<string, string>();
export function petFace(id: string): string {
  const cached = faces.get(id);
  if (cached !== undefined) return cached;
  const sheet = petSheet(id);
  if (!sheet) return '';
  const out = document.createElement('canvas');
  out.width = out.height = 18;
  out.getContext('2d')!.drawImage(sheet, petFrameIndex('sit0') * PET_W + 5, 0, 18, 18, 0, 0, 18, 18);
  const url = out.toDataURL();
  faces.set(id, url);
  return url;
}

// ── Glim (glim-art.ts's moth, one world px per art px, outlined; its face by mood) ─────────────────────────────

const glimFrames = new Map<string, HTMLCanvasElement>();
/** One of Glim's frames with a mood's face, outlined, made once each. */
export function glimFrame(frame: GlimFrameName, mood: GlimMood, dim = false): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${frame}|${mood}|${dim ? 1 : 0}`;
  let cv = glimFrames.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = GLIM_W + 2; cv.height = GLIM_H + 2;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const pal = dim ? GLIM_PALETTE_DIM : GLIM_PALETTE;
  glimRows(frame).forEach((row, y) => [...row].forEach((k, x) => { const col = pal[k]; if (col) { c.fillStyle = col; c.fillRect(x + 1, y + 1, 1, 1); } }));
  for (const [x, y, k] of glimFace(mood)) { const col = GLIM_FACE_PALETTE[k] ?? pal[k]; if (col) { c.fillStyle = col; c.fillRect(x + 1, y + 1, 1, 1); } }
  const img = c.getImageData(0, 0, cv.width, cv.height);
  outline(img);
  c.putImageData(img, 0, 0);
  glimFrames.set(key, cv);
  return cv;
}
export { GLIM_W, GLIM_H };
/** For the specs: the pet painters' ids. */
export const TD_PET_ART_IDS = Object.keys(PAINT);
