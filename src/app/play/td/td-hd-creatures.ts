/**
 * td-hd-creatures.ts — the creatures repainted for isometric B at the HD pixel (two sheet px a world px).
 *
 * Each creature is a model for the posing rig (td-hd-rig.ts): its solids in its own body frame, posed per animation
 * frame. The rig gives all six iso facings from the one model; the sculptor (td-hd-sculpt.ts) gives the hand-painted
 * finish (soft banded volume lit from the upper left, a contour where parts overlap, one clean dark outline). Four
 * clips of four frames each: idle (a breath), walk (contact, passing, contact, passing), attack (wind-up, strike,
 * follow-through, recover) and death (recoil, buckle, fall, at rest). The ability tells reuse the wind-up.
 *
 * Style (owner, art-direction-isometric-b): smooth and characterful, a clean outline, soft shading, never chunky
 * squares; dark D&D for what lives in dungeons, cozy for critters. Sizes follow the creature's own cell (td-mobs
 * mobCell): a model is about twice its cell tall, since one HD px is half a world px.
 */
import { Rig, add, lerp3, type BodyXf, type V3 } from './td-hd-rig';
import { mix, rampOf, type Mat } from './td-hd-sculpt';

export type Anim = 'idle' | 'walk' | 'attack' | 'death';
export const ANIMS: readonly Anim[] = ['idle', 'walk', 'attack', 'death'];
export const FRAMES = 4;
export interface Pose { anim: Anim; f: number }

export interface HdModel {
  /** The render box (sculpt px; generous, the frames are trimmed) and the feet's spot in it. */
  box: readonly [w: number, h: number, ox: number, oy: number];
  build(r: Rig, p: Pose): void;
  /** A whole-body pose per frame (a lean, a lunge, a fall). */
  body?(p: Pose): BodyXf;
  /** The model grown or shrunk to its creature's size (default 1). */
  scale?: number;
  /** Hovering: its ground shadow stays put while it bobs. */
  floats?: boolean;
}

/** A model's rig for a facing and a pose: its box and its whole-body pose, both grown by its scale. */
export function rigFor(m: HdModel, yaw: number, p: Pose): Rig {
  const k = m.scale ?? 1, [w, h, ox, oy] = m.box;
  return new Rig(Math.ceil(w * k), Math.ceil(h * k), Math.round(ox * k), Math.round(oy * k), yaw, { ...(m.body ? m.body(p) : {}), scale: k });
}

// ── Materials ──
const mat = (base: string, o: { cool?: string; warm?: string; deep?: number; hi?: number } = {}, x: Partial<Mat> = {}): Mat => ({ ramp: rampOf(base, o), round: 4, gain: 1, ...x });
export const HM = {
  bone: mat('#e2d8c2', { cool: '#3a3040', warm: '#fffdf4', deep: .55, hi: .55 }, { round: 3, gain: 1.1 }),
  boneDk: mat('#cfc3aa', { cool: '#2e2434', warm: '#fff6e0', deep: .6, hi: .4 }, { round: 3, gain: 1, bias: -.4 }),
  skull: mat('#e6dcc6', { cool: '#3a3040', warm: '#fffdf4', deep: .55, hi: .55 }, { round: 9, gain: 1.05 }),
  vbone: mat('#d8cce8', { cool: '#2a1e44', warm: '#fbf4ff', deep: .55, hi: .55 }, { round: 3, gain: 1.1 }),
  vskull: mat('#ddd0ec', { cool: '#2a1e44', warm: '#fbf4ff', deep: .55, hi: .55 }, { round: 9, gain: 1.05 }),
  void: { ramp: ['#0a0610', '#140c18', '#1c1220', '#24182a', '#2c1e32', '#34243a'], round: 3, gain: .5 } as Mat,
  rag: mat('#8a2a2a', { cool: '#1a0810', deep: .6, hi: .3 }, { round: 3, gain: .9 }),
  wood: mat('#8a5a34', { cool: '#24100c', hi: .4 }, { round: 1.5, gain: .7 }),
  iron: mat('#6a6a74', { cool: '#14121c', warm: '#f0f0ff', hi: .5 }, { shine: true, round: 2, gain: 1.2 }),
  rust: mat('#b47144', { cool: '#2a1210', warm: '#ffd8a0', deep: .6, hi: .45 }, { round: 5, gain: 1.05 }),
  rustDk: mat('#7e482c', { cool: '#1a0c0c', warm: '#f0b880', deep: .55, hi: .35 }, { round: 4, gain: 1 }),
  steel: mat('#9aa6b8', { cool: '#1a1a34', warm: '#ffffff', hi: .6 }, { shine: true, round: 3, gain: 1.25 }),
  blade: mat('#c4ccd8', { cool: '#262a44', warm: '#ffffff', hi: .7 }, { shine: true, round: 1.5, gain: 1.4 }),
  grip: mat('#4a2a20', { cool: '#0e0608' }, { round: 2 }),
  brass: mat('#d6a040', { cool: '#3a1a08', warm: '#fff8d0', hi: .6 }, { shine: true, round: 2, gain: 1.2 }),
  ash: mat('#968a93', { cool: '#1e1428', warm: '#fff0e8', deep: .6, hi: .5 }, { round: 6, gain: 1 }),
  ashLt: mat('#c9bdc4', { cool: '#3a2a3a', warm: '#ffffff', deep: .5, hi: .5 }, { round: 4, gain: .95 }),
  ashDk: mat('#625764', { cool: '#120a18', warm: '#e0d0d8', deep: .6, hi: .4 }, { round: 4, gain: 1 }),
  imp: mat('#da4b2c', { cool: '#3a0a10', warm: '#ffd090', deep: .6, hi: .5 }, { round: 6, gain: 1 }),
  wing: mat('#82301e', { cool: '#1e060c', warm: '#ff9070', deep: .6, hi: .4 }, { round: 1.5, gain: .7 }),
  horn: mat('#4a3228', { cool: '#0e0608', warm: '#c8a080', hi: .4 }, { round: 2, gain: 1.1 }),
  ember: { ramp: ['#9e2e1c', '#e2552a', '#ff8a3a', '#ffb347', '#ffd870', '#fff2a8'], round: 3, gain: .5, soft: true } as Mat,
  emberCore: { ramp: ['#ff8a3a', '#ffb347', '#ffd870', '#ffe8a0', '#fff2c8', '#fffbe8'], round: 2, gain: .3, soft: true } as Mat,
  robe: mat('#5a4755', { cool: '#120a18', warm: '#f0d8e0', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
  hood: mat('#463844', { cool: '#0c0610', warm: '#d8c0d0', deep: .6, hi: .35 }, { round: 5, gain: .85 }),
  char: mat('#4a3228', { cool: '#0e0608', warm: '#c8a080' }, { round: 4 }),
  leather: mat('#6a4c3a', { cool: '#1a0e10', warm: '#f0d0b0' }, { round: 3 }),
  cowl: mat('#542622', { cool: '#14060a', warm: '#f0a090', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
};
export const EYE = { ember: ['#a03a1a', '#ffb040', '#fff0b0'], violet: ['#4a1a80', '#b06bff', '#f0e0ff'], blood: ['#601010', '#ff4a3a', '#ffd0c0'] } as const;

// ── Posing helpers ──
const TAU = Math.PI * 2;
/** Two-bone reach: the elbow (knee) between a and b, bending toward `pole`. */
export function ik(a: V3, b: V3, l1: number, l2: number, pole: V3): V3 {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  let d = Math.hypot(dx, dy, dz) || 1e-3;
  const ux = dx / d, uy = dy / d, uz = dz / d;
  d = Math.min(d, l1 + l2 - .01);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const pd = pole[0] * ux + pole[1] * uy + pole[2] * uz;
  let px = pole[0] - ux * pd, py = pole[1] - uy * pd, pz = pole[2] - uz * pd;
  const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
  return [a[0] + ux * along + px * h, a[1] + uy * along + py * h, a[2] + uz * along + pz * h];
}
/** A biped's step for a frame: each foot's forward offset and lift, the body's rise, the arms' swing (left arm +). */
export function stride(p: Pose, len = 8, lift = 5): { fL: number; fR: number; lL: number; lR: number; bob: number; sw: number } {
  if (p.anim === 'walk') {
    const f = p.f % 4;
    return [
      { fL: len, fR: -len, lL: 0, lR: 1, bob: 0, sw: -1 },
      { fL: 0, fR: 1, lL: 0, lR: lift, bob: 2, sw: 0 },
      { fL: -len, fR: len, lL: 1, lR: 0, bob: 0, sw: 1 },
      { fL: 1, fR: 0, lL: lift, lR: 0, bob: 2, sw: 0 },
    ][f];
  }
  if (p.anim === 'attack') return { fL: 5, fR: -4, lL: 0, lR: 0, bob: [0, -1, -1, 0][p.f % 4], sw: 0 };
  return { fL: 2, fR: -1, lL: 0, lR: 0, bob: [0, -.5, -1, -.5][p.f % 4], sw: 0 };
}
/** A breath for idle frames (0 … 1 … 0). */
export const breath = (p: Pose): number => (p.anim === 'idle' ? [0, .5, 1, .5][p.f % 4] : 0);
/** The attack's swing for a frame: −1 wound back, +1 struck through. */
export const swing = (p: Pose): number => (p.anim === 'attack' ? [-1, 1, .7, .1][p.f % 4] : 0);
/** A generic lunge with the strike. */
export const lungeBody = (p: Pose, k = 1): BodyXf => (p.anim === 'attack' ? { df: [-2, 6, 4, 1][p.f % 4] * k, pitch: [-.08, .12, .08, 0][p.f % 4] * k } : {});
/** A generic fall: back (a biped) or onto its side (a beast), round its feet. */
export function fallBody(p: Pose, how: 'back' | 'side' = 'back', k = 1): BodyXf {
  if (p.anim !== 'death') return {};
  const f = p.f % 4;
  if (how === 'side') return { roll: [.12, .55, 1.25, 1.42][f], du: [0, -2, -4, -5][f] * k, df: [-2, -3, -3, -3][f] * k };
  return { pitch: [-.2, -.55, -1.25, -1.48][f], du: [0, -6, -8, -8][f] * k, df: [-2, -5, -6, -6][f] * k };
}

/** A glowing eye: a dark socket rim pixel, the glow, a hot centre. */
function eyeGlow(r: Rig, p: V3, n: V3, c: readonly string[], big = 3): void {
  if (!r.faces(n)) return;
  r.mark(p, c[1], big, big, { always: true });
  r.mark(p, c[2], 1, 1, { always: true });
}

// ── The skeleton kin (Bone Walker, the raised) ──
interface SkelLook { bone: Mat; skull: Mat; eye: readonly string[]; rag: Mat | null; shield: boolean; weapon: 'sword' | 'none' }

function skeleton(r: Rig, p: Pose, L: SkelLook): void {
  const st = stride(p, 7, 5), br = breath(p), sw = swing(p);
  const dying = p.anim === 'death', df = p.f % 4;
  // Death: the bones give way (buckle, sink, then a heap with the skull on top), not a stiff fall.
  const sink = dying ? [0, 14, 30, 38][df] : 0, spread = dying ? [0, 2, 6, 10][df] : 0;
  const hipU = 42 + st.bob - sink * .9;
  const B = L.bone;
  // Legs: thigh, knee, shin, a long foot; knees bend forward. In the heap they lie splayed on the ground.
  for (const side of [-1, 1] as const) {
    const fo = side < 0 ? st.fL : st.fR, lift = side < 0 ? st.lL : st.lR;
    const hip: V3 = [0, side * 6, hipU];
    let foot: V3 = [fo, side * (7 + spread), lift + 3];
    if (dying && df >= 2) foot = [side * 6 + 10, side * (14 + spread), 3];
    const knee = dying && df >= 2 ? lerp3(hip, foot, .5) as V3 : ik(hip, foot, 21, 21, [1, side * .15, 0]);
    const kn: V3 = dying && df >= 2 ? [knee[0] + 4, knee[1], Math.max(3, knee[2])] : knee;
    r.limb(hip, kn, 3.4, 3, B, { bias: side < 0 ? 0 : -.2 });
    r.ball(kn, 3.4, B);
    r.limb(kn, foot, 3, 2.6, B, { bias: side < 0 ? 0 : -.2 });
    r.egg(add(foot, [3, 0, -1]), 5, 3, 2.2, B, { bias: -.2 });
  }
  // Pelvis and the rag round it.
  r.egg([0, 0, hipU + 3], 6, 9.5, 4.5, B, { g: 30 });
  if (L.rag) {
    r.egg([0, 0, hipU + 2], 7.5, 11, 5.5, L.rag, { g: 31, z: 1 });
    r.plate([[7.5, -6, hipU + 3], [8.5, 6, hipU + 3], [9, 4, hipU - 7], [8.5, 1, hipU - 3], [8.5, -2, hipU - 9], [8, -5, hipU - 4]], L.rag, { g: 31, z: 1.5 });
    r.plate([[-7.5, -7, hipU + 3], [-8, 7, hipU + 3], [-8.5, 5, hipU - 6], [-8, 0, hipU - 2], [-8.5, -4, hipU - 8]], L.rag, { g: 31, z: -1 });
  }
  // The torso: it slumps forward in the death clip.
  // Death: the trunk folds back over the hips and settles on the heap.
  const slump: V3 = dying ? ([[0, 0, 0], [1, 0, 0], [2, 2, -2], [3, 3, -4]] as V3[])[df] : [0, 0, 0];
  const tip = dying ? [-.15, -.45, -1.2, -1.42][df] : p.anim === 'attack' ? [-.06, .1, .08, 0][p.f % 4] : 0;
  const ct = Math.cos(tip), stp = Math.sin(tip);
  const T = (q: V3): V3 => { const f = q[0], u = q[2] - hipU; return [f * ct + u * stp + slump[0], q[1] + slump[1], -f * stp + u * ct + hipU + slump[2]]; };
  const top = hipU + 30 + br * .6;
  r.chain([T([-2, 0, hipU + 4]), T([-3, 0, hipU + 14]), T([-2, 0, top - 2])], 3, 2.6, B, { g: 40 });
  // The ribcage: a dark hollow behind four pairs of ribs round it, a sternum down the front.
  const rc = T([1, 0, hipU + 21]);
  r.egg(rc, 7, 10.5, 9.5, HM.void, { g: 41 });
  for (let i = 0; i < 4; i++) {
    const u = top - 3 - i * 4.6, rf = 7.8 - i * .5, rr = 11.4 - i * 1.2, pts: V3[] = [];
    for (let a = -165; a <= 165; a += 22) {
      const t = a * Math.PI / 180;
      pts.push(T([1 + Math.cos(t) * rf, Math.sin(t) * rr, u - (1 + Math.cos(t)) * 1.4]));
    }
    // Split each rib into its two halves so the far half sorts behind the hollow and the near half in front.
    const half = Math.floor(pts.length / 2);
    r.chain(pts.slice(0, half + 1), 1.9, 1.7, B, { g: 50 + i });
    r.chain(pts.slice(half), 1.7, 1.9, B, { g: 60 + i });
  }
  r.limb(T([8, 0, top - 1]), T([8.4, 0, hipU + 15]), 1.9, 1.6, B, { g: 70, z: 2 });
  // Collarbones and shoulders.
  const shL: V3 = T([0, -13, top]), shR: V3 = T([0, 13, top]);
  r.limb(shL, shR, 2.2, 2.2, B, { g: 71, z: 1 });
  // The arms: the shield arm (its left) held across, the sword arm (its right) out by the hip or swinging.
  const handL: V3 = dying ? (df >= 2 ? [8, -20 - spread, 4] : T([4, -18, top - 20])) : T([9 + st.sw * 3, -15, top - 18 + (sw < 0 ? 2 : 0)]);
  const elL = ik(shL, handL, 13, 13, [-1, -1, 0]);
  r.limb(shL, elL, 2.8, 2.5, B, { bias: -.3 }); r.ball(elL, 2.9, B, { bias: -.3 }); r.limb(elL, handL, 2.5, 2.2, B, { bias: -.3 });
  r.ball(handL, 2.8, B, { bias: -.3 });
  if (L.shield) {
    // The round shield: an iron rim, planks, an iron boss; facing forward and out. In the heap it lies on the ground.
    const lying = dying && df >= 2;
    const c: V3 = lying ? [12, -22 - spread, 2] : add(handL, [3, -3, 0]);
    const n: V3 = lying ? [0, 0, 1] : [.82, -.57, 0];
    const a: V3 = lying ? [1, 0, 0] : [0, 0, 1], b: V3 = lying ? [0, 1, 0] : [.57, .82, 0];
    const R0 = 13, R1 = 11;
    r.disc(c, [a[0] * R0, a[1] * R0, a[2] * R0], [b[0] * R0, b[1] * R0, b[2] * R0], HM.iron, { g: 80, z: 3 });
    const front = r.faces(n);
    r.disc(add(c, n, front ? .6 : -.6), [a[0] * R1, a[1] * R1, a[2] * R1], [b[0] * R1, b[1] * R1, b[2] * R1], front ? HM.wood : mix3(HM.wood), { g: 81, z: 3.4 });
    if (front) {
      for (const k of [-4.5, 0, 4.5]) {
        const off = add(c, b, k), h = Math.sqrt(R1 * R1 - k * k) - 1;
        r.line(add(add(off, a, h), n, .6), add(add(off, a, -h), n, .6), HM.wood.ramp[0], { always: true });
      }
      r.ball(add(c, n, 2), 3.6, HM.iron, { g: 82, z: 4 });
    }
  }
  // The sword arm and its blade, by the swing: held low and upright, wound back over the shoulder, cut through.
  if (L.weapon === 'sword') {
    const wind: V3 = T([-6, 17, top + 8]), strike: V3 = T([16, 9, top - 14]), follow: V3 = T([13, 1, top - 22]), rest: V3 = T([6 - st.sw * 3, 23, top - 20]);
    let handR = rest, dir: V3 = [.12, .42, 1];
    if (p.anim === 'attack') {
      const fr = p.f % 4;
      handR = [wind, strike, follow, lerp3(follow, rest, .6) as V3][fr];
      dir = ([[-.45, .2, .85], [.85, -.1, -.35], [.7, -.55, -.45], [.4, -.1, .8]] as V3[])[fr];
    }
    if (dying) { handR = df >= 2 ? [10, 20 + spread, 4] : T([6, 19, top - 22 + df * 4]); dir = df >= 2 ? [.9, .4, 0] : [.6, .3, .7]; }
    const elR = ik(shR, handR, 13, 13, [-1, 1, -.2]);
    r.limb(shR, elR, 2.8, 2.5, B); r.ball(elR, 2.9, B); r.limb(elR, handR, 2.5, 2.2, B);
    sword(r, handR, dir, 46, z(handR));
  }
  // The skull: big and round, a jaw that hangs open as it strikes; sockets with ember eyes. In the heap it rolls clear.
  let sk: V3 = T([1, 0, top + 18 + br * .4]);
  if (dying) sk = df < 2 ? T([1 + df * 3, 0, top + 18]) : ([[14, 8, 14], [18, 12, 13]] as V3[])[df - 2];
  const nod = dying ? [0, .2, .5, .3][df] : 0;
  r.ball(sk, 14.5, L.skull, { g: 90 });
  r.egg(add(sk, [-2.5, 0, 1]), 13.5, 13.8, 13.8, L.skull, { g: 90 });
  const jawOpen = p.anim === 'attack' ? [2, 4, 2, 0][p.f % 4] : dying ? 3 : (p.anim === 'idle' && p.f === 2 ? 1 : 0);
  const jaw: V3 = add(sk, [6.5 - nod * 4, 0, -12 - jawOpen]);
  r.egg(jaw, 7.5, 8.5, 4.6, L.skull, { g: 91, z: -1 });
  // Teeth, a dark mouth line.
  const fwd: V3 = [1, 0, 0];
  if (r.faces(fwd)) {
    r.line(add(jaw, [6.5, -5, 3]), add(jaw, [6.5, 5, 3]), HM.void.ramp[1]);
    if (jawOpen > 1) r.line(add(jaw, [6.6, -4, 2]), add(jaw, [6.6, 4, 2]), HM.void.ramp[0]);
    for (let i = -2; i <= 2; i++) r.mark(add(jaw, [7, i * 2.2, 4.4]), L.skull.ramp[2], 1, 2, { n: fwd });
  }
  for (const side of [-1, 1] as const) {
    const ec: V3 = add(sk, [11.6, side * 6, -1 - nod * 3]);
    r.egg(ec, 2.6, 4.4, 4.2, HM.void, { g: 92 + side, z: .5 });
    eyeGlow(r, add(ec, [2.4, side * -.4, 0]), [1, side * .55, 0], L.eye, 3);
  }
  r.egg(add(sk, [13.4, 0, -7 - nod * 3]), 1.2, 1.6, 2, HM.void, { g: 95, z: .6 });
  // A crack across the crown (seen from behind and the side), a glint on the dome.
  r.line(add(sk, [-6, 3, 12]), add(sk, [-12, 1, 6]), L.skull.ramp[1], { n: [-1, 0, .4] });
  r.line(add(sk, [-12, 1, 6]), add(sk, [-13, 4, 1]), L.skull.ramp[1], { n: [-1, 0, .4] });
  r.mark(add(sk, [2, -6, 12]), L.skull.ramp[5], 3, 1, { always: true });
}
/** A plank shield's back reads darker. */
function mix3(m: Mat): Mat { return { ...m, ramp: m.ramp.map(c => mix(c, '#1a0e10', .35)), bias: -.6 }; }
/** Depth of a body-frame point, for sorting a held thing with its hand. */
const z = (_p: V3): number => 1.5;

/** A sword from the hand along `dir`: grip and pommel behind the hand, a brass guard, a tapering blade with a lit edge. */
function sword(r: Rig, hand: V3, dir: V3, len: number, zz = 0, m: Mat = HM.blade): void {
  const l = Math.hypot(...dir) || 1, d: V3 = [dir[0] / l, dir[1] / l, dir[2] / l];
  const g0 = add(hand, d, 4), tip = add(hand, d, len);
  r.limb(add(hand, d, -5), add(hand, d, 2), 1.8, 1.8, HM.grip, { z: zz - .2 });
  r.ball(add(hand, d, -6.5), 2.2, HM.brass, { z: zz - .1 });
  // The guard: across the blade, sideways to the body.
  const side: V3 = Math.abs(d[2]) > .7 ? [1, 0, 0] : [0, 0, 1];
  const cx: V3 = [d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]];
  const cl = Math.hypot(...cx) || 1, c: V3 = [cx[0] / cl, cx[1] / cl, cx[2] / cl];
  r.limb(add(g0, c, -6), add(g0, c, 6), 1.6, 1.6, HM.brass, { z: zz + .1 });
  r.limb(add(g0, d, 1), add(tip, d, -4), 2.6, 2, m, { z: zz, g: 3000 });
  r.limb(add(tip, d, -4), tip, 2, .7, m, { z: zz, g: 3000 });
  r.line(add(g0, d, 3), add(tip, d, -6), m.ramp[5], { always: true });
}


// ── Four-legged kin (wolves, hounds, stalkers, the hart) ──
export interface QuadLook {
  /** Hips at f = −len, the chest at +len; the hip/withers height; leg length (two equal bones). */
  len: number; hipU: number; leg: number; legR: number;
  body: Mat; under: Mat; dark: Mat;
  /** Barrel radii (forward, side, up), chest and haunch balls. */
  barrel: V3; chest: number; haunch: number;
  /** Head ball, its spot ahead of and above the chest, the muzzle's length and radius. */
  head: number; headAt: V3; muzzle: number; muzzleR: number;
  ear: number; tail: readonly V3[]; tailR: number;
  eye: readonly string[]; nose: string; claw: string;
  /** The barrel's own material (a bone dragon's dark hollow under its ribs); the body's when unset. */
  barrelMat?: Mat;
  /** Extra dressing in the body frame (embers in the ruff, magma cracks, a flame mane). */
  dress?: (r: Rig, p: Pose, q: { chest: V3; hip: V3; head: V3; jaw: number; dir: V3 }) => void;
}
export function quadruped(r: Rig, p: Pose, L: QuadLook): void {
  const walk = p.anim === 'walk', ph = p.f / FRAMES * TAU, br = breath(p);
  const atk = p.anim === 'attack' ? p.f % 4 : -1;
  const bob = walk ? Math.abs(Math.cos(ph)) * 1.6 : br * .8;
  const pitch = atk === 0 ? -.08 : atk === 1 ? .1 : 0;
  const hip: V3 = [-L.len, 0, L.hipU + bob - (atk === 0 ? 3 : 0)], chest: V3 = [L.len, 0, L.hipU + 2 + bob + pitch * 20 - (atk === 0 ? 4 : 0)];
  // Legs: trot in diagonal pairs (front-left with back-right).
  const legs: [V3, number, number][] = [[chest, -1, 0], [chest, 1, Math.PI], [hip, -1, Math.PI], [hip, 1, 0]];
  for (const [root, side, off] of legs) {
    const front = root === chest, a = walk ? ph + off : 0;
    const sw = walk ? Math.sin(a) * L.len * .42 : atk === 1 ? (front ? 6 : -4) : 0;
    const lift = walk ? Math.max(0, Math.cos(a)) * 5 : 0;
    const top: V3 = [root[0] + (front ? 1 : -1), side * L.barrel[1] * .55, root[2] - 2];
    const foot: V3 = [root[0] + sw, side * L.barrel[1] * .6, lift];
    const knee = ik(top, foot, L.leg, L.leg, front ? [-1, side * .1, 0] : [1, side * .1, 0]);
    const far = r.toward([0, side, 0]) < 0;
    const m = far ? L.dark : L.body;
    const lg = 230 + (front ? 0 : 2) + (side > 0 ? 1 : 0);
    r.limb(top, knee, L.legR * 1.3, L.legR, m, { g: lg, bias: far ? -.3 : 0 });
    r.limb(knee, foot, L.legR, L.legR * .75, m, { g: lg, bias: far ? -.3 : 0 });
    r.egg(add(foot, [2, 0, 1.2]), L.legR * 1.3, L.legR, L.legR * .7, m, { g: lg, bias: far ? -.4 : -.1 });
    if (!far) r.mark(add(foot, [L.legR * 1.3 + 1.5, 0, 1]), L.claw, 1, 1, { n: [1, 0, 0] });
  }
  // Tail, haunch, barrel, chest (one volume), the pale underside.
  const wag = walk ? Math.sin(ph) * 3 : br * 1.5;
  r.chain(L.tail.map((q, i) => add(add(hip, q), [0, i ? wag * i / L.tail.length : 0, 0])), L.tailR, L.tailR * .55, L.body, { g: 200 });
  r.ball(add(hip, [1, 0, 1]), L.haunch, L.body, { g: 201 });
  r.egg(lerp3(hip, chest, .5), L.barrel[0], L.barrel[1], L.barrel[2], L.barrelMat ?? L.body, { g: 201 });
  r.ball(add(chest, [0, 0, .5]), L.chest, L.body, { g: 201 });
  r.egg(add(lerp3(hip, chest, .6), [0, 0, -L.barrel[2] * .55]), L.barrel[0] * .8, L.barrel[1] * .7, L.barrel[2] * .45, L.under, { g: 202, z: -.5 });
  // A darker saddle along the back, a pale bib down the chest.
  r.egg(add(lerp3(hip, chest, .45), [0, 0, L.barrel[2] * .55]), L.barrel[0] * .85, L.barrel[1] * .6, L.barrel[2] * .45, L.dark, { g: 203, z: .4 });
  r.egg(add(chest, [L.chest * .6, 0, -1]), L.chest * .45, L.chest * .62, L.chest * .8, L.under, { g: 204, z: .6 });
  // Neck and head: low and forward on the snap, the jaw open.
  const reach = atk === 1 ? 8 : atk === 2 ? 5 : atk === 0 ? -3 : 0, dip = atk === 1 ? -6 : atk === 0 ? 2 : 0;
  const head: V3 = add(chest, [L.headAt[0] + reach, 0, L.headAt[2] + dip + (walk ? Math.cos(ph * 2) * .8 : br * .5)]);
  r.limb(add(chest, [2, 0, 3]), head, L.chest * .8, L.head * .7, L.body, { g: 201 });
  r.ball(head, L.head, L.body, { g: 210 });
  const jaw = atk === 1 ? 4 : atk === 2 ? 2 : atk === 0 ? 1 : 0;
  const mz: V3 = add(head, [L.head * .6 + L.muzzle * .5, 0, -L.head * .25]);
  r.egg(mz, L.muzzle * .62, L.muzzleR, L.muzzleR * .8, L.body, { g: 210 });
  if (jaw) {
    r.egg(add(mz, [-1, 0, -L.muzzleR * .9 - jaw * .8]), L.muzzle * .5, L.muzzleR * .8, L.muzzleR * .4, L.dark, { g: 211, z: -.4 });
    r.egg(add(mz, [0, 0, -L.muzzleR * .55 - jaw * .4]), L.muzzle * .45, L.muzzleR * .65, jaw * .45, HM.void, { g: 212, z: -.2 });
    r.mark(add(mz, [L.muzzle * .35, -2, -L.muzzleR * .7]), '#fffaf0', 1, 2, { n: [1, 0, 0] });
    r.mark(add(mz, [L.muzzle * .35, 2, -L.muzzleR * .7]), '#fffaf0', 1, 2, { n: [1, 0, 0] });
  }
  r.ball(add(mz, [L.muzzle * .55, 0, L.muzzleR * .3]), L.muzzleR * .45, { ramp: rampOf(L.nose, { cool: '#08040a' }), round: 2, gain: 1 }, { g: 213, z: .5 });
  // Ears: two pricked plates, the far one darker.
  for (const side of [-1, 1] as const) {
    const base: V3 = add(head, [-L.head * .25, side * L.head * .5, L.head * .65]);
    r.plate([add(base, [-L.ear * .45, side * -L.ear * .3, 0]), add(base, [L.ear * .35, side * L.ear * .3, 0]), add(base, [-L.ear * .15, side * L.ear * .45, L.ear * 1.25])], L.dark, { g: 220 + side, z: 1, bias: r.toward([0, side, 0]) < 0 ? -.3 : .4 });
    if (r.faces([1, side * .4, .3])) r.mark(add(base, [0, side * .1, L.ear * .45]), mix(L.body.ramp[1], '#c06070', .4), 1, 2, { always: true });
  }
  for (const side of [-1, 1] as const) eyeGlow(r, add(head, [L.head * .62, side * L.head * .45, L.head * .2]), [1, side * .7, .1], L.eye, 2);
  L.dress?.(r, p, { chest, hip, head, jaw, dir: [1, 0, 0] });
}

// ── The Rivet Maw: a rust-iron jaw on four stubby legs, rivets for teeth, a forge glow in the throat ──
function maw(r: Rig, p: Pose): void {
  const walk = p.anim === 'walk', ph = p.f / FRAMES * TAU, atk = p.anim === 'attack' ? p.f % 4 : -1;
  const bob = walk ? Math.abs(Math.sin(ph)) * 1.5 : breath(p) * .6;
  const open = atk === 0 ? 10 : atk === 1 ? 1 : atk === 2 ? 4 : p.anim === 'idle' ? [5, 6, 7, 6][p.f % 4] : [6, 4, 6, 4][p.f % 4];
  const u0 = 13 + bob;
  for (const [ff, side, off] of [[10, -1, 0], [10, 1, Math.PI], [-10, -1, Math.PI], [-10, 1, 0]] as const) {
    const a = walk ? ph + off : 0, sw = walk ? Math.sin(a) * 4 : 0, lift = walk ? Math.max(0, Math.cos(a)) * 3 : 0;
    const top: V3 = [ff, side * 8, u0 + 1], foot: V3 = [ff + sw, side * 10, lift + 2];
    const far = r.toward([0, side, 0]) < 0;
    r.limb(top, foot, 3.6, 3, HM.iron, { bias: far ? -.4 : 0 });
    r.egg(add(foot, [1.5, 0, -.5]), 4.2, 3.4, 2.2, HM.iron, { bias: far ? -.5 : -.1 });
  }
  // The lower jaw, a shell bowl; the mouth's dark, the throat's glow; the riveted upper shell hinged at the back.
  r.egg([1, 0, u0 + 3], 15, 13, 6.5, HM.rust, { g: 300 });
  r.egg([4, 0, u0 + 8 + open * .25], 12, 10.5, 2 + open * .45, HM.void, { g: 301, z: 1 });
  if (open > 2) r.ball([2, 0, u0 + 7 + open * .3], 3.5 + open * .25, HM.ember, { g: 302, z: 1.5 });
  const hinge = Math.min(.55, open * .045);
  const up = (q: V3): V3 => { const f = q[0] + 12, u = q[2] - (u0 + 8); return [f * Math.cos(hinge) - u * Math.sin(hinge) - 12, q[1], f * Math.sin(hinge) + u * Math.cos(hinge) + u0 + 8]; };
  r.egg(up([1, 0, u0 + 13]), 15.5, 13.5, 7, HM.rust, { g: 310, z: 2 });
  r.egg(up([-1, 0, u0 + 17]), 11, 10, 4, HM.rustDk, { g: 311, z: 2.2 });
  // Teeth: rivets round both rims.
  for (let i = -4; i <= 4; i++) {
    const a = i / 4 * 1.2, cx = Math.cos(a), sy = Math.sin(a);
    const lo: V3 = [1 + cx * 13.5, sy * 11.5, u0 + 8], hi = up([1 + cx * 14, sy * 12, u0 + 8.5]);
    r.mark(lo, HM.bone.ramp[5], 2, 2, { n: [cx, sy, .2] }); r.mark(add(lo, [0, 0, -1]), HM.bone.ramp[1], 2, 1, { n: [cx, sy, .2] });
    r.mark(hi, HM.bone.ramp[4], 2, 2, { n: [cx, sy, .2] });
  }
  for (let i = -3; i <= 3; i++) { const a = i / 3 * 1.4; r.mark(up([-1 + Math.cos(a) * 8, Math.sin(a) * 8, u0 + 21]), HM.rust.ramp[5], 1, 1, { n: [0, 0, 1] }); }
  // Eyes on iron stalks, ember-lit.
  for (const side of [-1, 1] as const) {
    const base = up([-4, side * 6, u0 + 19]), eye = up([-2, side * 8, u0 + 27]);
    r.limb(base, eye, 1.5, 1.2, HM.iron, { z: 3 });
    r.ball(eye, 2.6, HM.emberCore, { z: 3.2, g: 320 + side });
    r.mark(eye, '#fff2a8', 1, 1, { always: true });
  }
}

// ── The Cinder Imp: a small horned ember-imp on bat wings, a grin with a fire in its belly ──
function imp(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, atk = p.anim === 'attack' ? p.f % 4 : -1, dying = p.anim === 'death';
  const beat = dying ? .2 : Math.sin(ph + (p.anim === 'walk' ? 0 : .5)) * (p.anim === 'walk' ? 1 : .7);
  const hover = dying ? 0 : 16 + Math.sin(ph) * 2;
  const lean = atk === 1 ? 8 : atk === 0 ? -4 : 0;
  const c: V3 = [lean * .4, 0, hover + 14];
  // Wings: thin membranes from the shoulder blades, beating; the far one first by depth.
  for (const side of [-1, 1] as const) {
    const sh: V3 = add(c, [-4, side * 5, 6]);
    const tip: V3 = add(sh, [-10, side * (18 - beat * 3), 8 + beat * 12]);
    const mid: V3 = add(sh, [-14, side * (12 - beat), -2 + beat * 6]);
    const low: V3 = add(sh, [-6, side * 7, -8 + beat * 2]);
    r.plate([sh, tip, mid, low], HM.wing, { g: 400 + side, z: -2, bias: r.toward([0, side, 0]) < 0 ? -.6 : 0 });
    r.limb(sh, tip, 1.2, .8, HM.horn, { z: -1.8 });
  }
  // Tail with a spade.
  const tl: V3[] = [add(c, [-5, 0, -8]), add(c, [-10, 2, -12]), add(c, [-15, 1, -8]), add(c, [-17, -1, -3])];
  r.chain(tl, 1.6, 1, HM.imp, { z: -1 });
  r.plate([add(tl[3], [-1, 0, 4]), add(tl[3], [2, -3, -1]), add(tl[3], [-2, 3, -1])], HM.imp, { z: -1 });
  // Legs, the pot belly with its fire, little clawed arms.
  for (const side of [-1, 1] as const) {
    const hip = add(c, [0, side * 4, -7]), foot = add(c, [3 + (atk === 1 ? -3 : 0), side * 5, -15]);
    r.limb(hip, add(c, [4, side * 5, -11]), 2.6, 2, HM.imp); r.limb(add(c, [4, side * 5, -11]), foot, 2, 1.6, HM.imp);
  }
  r.egg(c, 8, 9, 9.5, HM.imp, { g: 410 });
  r.egg(add(c, [6, 0, -1]), 3.5, 5, 5.5, HM.ember, { g: 411, z: .5 });
  r.ball(add(c, [8, 0, -1]), 2, HM.emberCore, { g: 412, z: .8 });
  const claw = atk === 1 ? [16, 0, 4] as V3 : atk === 0 ? [-2, 0, 14] as V3 : [6, 0, 0] as V3;
  for (const side of [-1, 1] as const) {
    const sh = add(c, [1, side * 8, 5]), hand = add(c, [claw[0], side * (10 - (atk === 1 ? 4 : 0)), claw[2]]);
    r.limb(sh, hand, 2.2, 1.6, HM.imp, { bias: r.toward([0, side, 0]) < 0 ? -.4 : 0 });
    r.mark(add(hand, [2, 0, 0]), HM.bone.ramp[5], 1, 1, { n: [1, 0, 0] });
  }
  // Head: round, two curling horns, big ember eyes, a toothy grin.
  const h: V3 = add(c, [2 + lean * .3, 0, 16]);
  r.ball(h, 10, HM.imp, { g: 420 });
  for (const side of [-1, 1] as const) r.chain([add(h, [-2, side * 6, 7]), add(h, [-3, side * 9, 13]), add(h, [-6, side * 9, 16])], 2.2, .9, HM.horn, { z: -.5 });
  for (const side of [-1, 1] as const) {
    const e = add(h, [8.4, side * 4, 1.5]);
    if (r.faces([1, side * .6, 0])) { r.mark(e, '#fff2a8', 3, 3); r.mark(add(e, [0, side * .5, 0]), '#2a1008', 1, 2); }
  }
  if (r.faces([1, 0, -.2])) { r.line(add(h, [8.5, -4, -4]), add(h, [8.5, 4, -4]), '#3a0a08'); r.mark(add(h, [9, -2, -5]), '#fffaf0'); r.mark(add(h, [9, 2, -5]), '#fffaf0'); }
}

// ── The Cinder Bailiff: a hooded ember-golem in a soot robe, a caged lantern for a belly, a ledger-hook ──
interface BailiffLook { robe: Mat; hood: Mat; tool: 'hook' | 'hammer'; scale: number; crown?: 'slag' | 'anvil' }
function bailiff(r: Rig, p: Pose, L: BailiffLook): void {
  const k = L.scale, st = stride(p, 6 * k, 3 * k), br = breath(p), atk = p.anim === 'attack' ? p.f % 4 : -1;
  const S = (q: V3): V3 => [q[0] * k, q[1] * k, q[2] * k];
  const bob = st.bob * k * .5;
  // Feet: basalt blocks peeking under the hem.
  for (const side of [-1, 1] as const) r.egg(S([side < 0 ? st.fL / k : st.fR / k, side * 7, 2.5 + (side < 0 ? st.lL : st.lR) / k]), 5 * k, 4 * k, 3 * k, HM.char, { bias: -.2 });
  // The robe: a long bell, hem swaying.
  const sway = p.anim === 'walk' ? [1, 0, -1, 0][p.f % 4] : 0;
  r.egg(S([sway * .5, 0, 18]), 13 * k, 14 * k, 17 * k, L.robe, { g: 500 });
  r.egg(S([sway, 0, 7]), 14 * k, 15 * k, 7 * k, L.robe, { g: 500 });
  // The lantern belly: an iron cage over a breathing fire, on its front.
  const lc = S([11, 0, 26 + bob]);
  r.egg(lc, 4 * k, 7 * k, 7 * k, HM.iron, { g: 510, z: 1 });
  r.egg(add(lc, [2 * k, 0, 0]), 2.6 * k, (4.6 + br * .5) * k, (4.6 + br * .5) * k, HM.ember, { g: 511, z: 1.4 });
  r.ball(add(lc, [3.5 * k, 0, 0]), 2.2 * k, HM.emberCore, { g: 512, z: 1.6 });
  for (const dy of [-3.5, 0, 3.5]) r.line(add(lc, [4.4 * k, dy * k, 6 * k]), add(lc, [4.4 * k, dy * k, -6 * k]), HM.iron.ramp[2], { n: [1, 0, 0] });
  // The mantle and hood, two coals inside.
  r.egg(S([0, 0, 38 + bob]), 10 * k, 15 * k, 6 * k, L.hood, { g: 520, z: .5 });
  const hd: V3 = S([1, 0, 47 + bob + br * .4]);
  r.egg(hd, 10 * k, 10 * k, 11 * k, L.hood, { g: 521 });
  r.egg(add(hd, [5 * k, 0, -1 * k]), 5 * k, 6.5 * k, 6 * k, HM.void, { g: 522, z: 1 });
  r.plate([add(hd, [-6 * k, 0, 9 * k]), add(hd, [-12 * k, 0, 16 * k]), add(hd, [-4 * k, 0, 6 * k])], L.hood, { g: 521 });
  for (const side of [-1, 1] as const) eyeGlow(r, add(hd, [9 * k, side * 2.6 * k, -1 * k]), [1, side * .5, 0], EYE.ember, Math.round(2 * k));
  if (L.crown === 'slag') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; r.limb(add(hd, [Math.cos(a) * 8 * k, Math.sin(a) * 8 * k, 9 * k]), add(hd, [Math.cos(a) * 8 * k, Math.sin(a) * 8 * k, (14 + (i % 2) * 3) * k]), 2.2 * k, 1.2 * k, HM.char, { g: 530 }); }
    r.egg(add(hd, [0, 0, 9 * k]), 9 * k, 9 * k, 2.6 * k, HM.char, { g: 530 });
    for (let i = 0; i < 6; i++) { const a = (i + .5) / 6 * TAU; r.mark(add(hd, [Math.cos(a) * 8.6 * k, Math.sin(a) * 8.6 * k, 10.5 * k]), '#ffb347', 2, 2, { n: [Math.cos(a), Math.sin(a), .5] }); }
  }
  if (L.crown === 'anvil') {
    const a0 = add(hd, [0, 0, 12 * k]);
    r.egg(a0, 5 * k, 4 * k, 3 * k, HM.iron, { g: 540 });
    r.egg(add(a0, [0, 0, 5 * k]), 9 * k, 6 * k, 2.6 * k, HM.iron, { g: 540 });
    r.limb(add(a0, [8 * k, 0, 5 * k]), add(a0, [15 * k, 0, 6 * k]), 2.4 * k, .8 * k, HM.iron, { g: 540 });
  }
  // The arms: the far one hangs, the near one carries the hook (or the hammer) and swings it.
  const shL = S([1, -12, 37 + bob]), shR = S([1, 12, 37 + bob]);
  const handL = S([5 + st.sw * 2, -15, 22 + bob]);
  r.limb(shL, handL, 4.4 * k, 3.6 * k, L.robe, { bias: -.3 });
  r.ball(handL, 3.4 * k, HM.char, { bias: -.2 });
  const swingTo: V3[] = [[-4, 15, 50], [16, 12, 26], [14, 6, 18], [8, 14, 22]];
  const handR = S(atk >= 0 ? swingTo[atk] : [6 - st.sw * 2, 16, 22 + bob]);
  r.limb(shR, handR, 4.4 * k, 3.6 * k, L.robe);
  r.ball(handR, 3.4 * k, HM.char);
  const up: V3 = atk === 0 ? [-.3, 0, 1] : atk === 1 ? [1, 0, .15] : atk === 2 ? [.7, -.4, -.3] : [.15, .1, 1];
  const ul = Math.hypot(...up), d: V3 = [up[0] / ul, up[1] / ul, up[2] / ul];
  if (L.tool === 'hook') {
    const tip = add(handR, d, 26 * k);
    r.limb(add(handR, d, -14 * k), tip, 1.8 * k, 1.6 * k, HM.iron, { g: 550, z: 1 });
    r.chain([tip, add(add(tip, d, 3 * k), [3 * k, 0, 0]), add(add(tip, d, 1 * k), [6 * k, 0, -2 * k]), add(tip, [6 * k, 0, -5 * k])], 1.6 * k, .8 * k, HM.iron, { g: 551, z: 1 });
  } else {
    const head = add(handR, d, 24 * k);
    r.limb(add(handR, d, -6 * k), head, 1.8 * k, 1.8 * k, HM.wood, { z: 1 });
    r.egg(head, 6 * k, 8 * k, 5 * k, HM.iron, { g: 560, z: 1.2 });
    if (atk === 1) r.mark(add(head, [7 * k, 0, 0]), '#fff2a8', 3, 3, { always: true });
  }
}


// ── Folk who stand on two legs (orcs, shamans, knights, witches, golems) ──
export type HeadKind = 'orc' | 'hood' | 'helm' | 'bare' | 'skull' | 'horned' | 'mitre' | 'drowned' | 'stone' | 'crystal';
export type Weapon = 'axe' | 'greataxe' | 'sword' | 'staff' | 'bow' | 'censer' | 'spear' | 'hook' | 'fists' | 'none';
export interface HumLook {
  k: number; skin: Mat; torso: Mat; legs: Mat; boots: Mat; belt?: Mat;
  /** Sleeves (or bare arms); the robe's or the torso's when unset. */
  arms?: Mat;
  /** A long robe or cope over the legs, a cape behind, plates on the shoulders. */
  robe?: Mat; cape?: Mat; plates?: Mat;
  head: HeadKind; headMat?: Mat; hair?: Mat;
  eye: readonly string[];
  /** Width of shoulders and trunk (1 a Keeper's). */
  bulk: number;
  weapon: Weapon; weaponMat?: Mat; edge?: string;
  off: 'shield' | 'none' | 'cinder' | 'book' | 'lantern' | 'fetish';
  offMat?: Mat;
  /** It casts rather than strikes (the off hand comes up with the weapon). */
  caster?: boolean;
  /** Hunched (a ghoul, a drowned thing): the trunk leans forward. */
  hunch?: number;
  dress?: (r: Rig, p: Pose, q: { hip: V3; chest: V3; head: V3; handR: V3; handL: V3; S: (q: V3) => V3 }) => void;
}
export function humanoid(r: Rig, p: Pose, L: HumLook): void {
  const k = L.k, b = L.bulk, st = stride(p, 8 * k, 5 * k), br = breath(p), atk = p.anim === 'attack' ? p.f % 4 : -1;
  const S = (q: V3): V3 => [q[0] * k, q[1] * k, q[2] * k];
  const hipU = 44 * k + st.bob * k * .6;
  const lean = (L.hunch ?? 0) + (atk === 0 ? -.08 : atk === 1 ? .14 : atk === 2 ? .1 : 0);
  const cl = Math.cos(lean), sl = Math.sin(lean);
  // The trunk bends forward at the hips.
  const T = (q: V3): V3 => { const u = q[2] * k - hipU; return [q[0] * k + u * sl, q[1] * k, hipU + u * cl + q[0] * k * -sl * 0]; };
  // Legs.
  for (const side of [-1, 1] as const) {
    const fo = side < 0 ? st.fL : st.fR, lift = side < 0 ? st.lL : st.lR;
    const hip: V3 = [0, side * 6.5 * k * b, hipU], foot: V3 = [fo, side * 7.5 * k * b, lift + 3 * k];
    const knee = ik(hip, foot, 22 * k, 21 * k, [1, side * .1, 0]);
    const far = r.toward([0, side, 0]) < -.2, bias = far ? -.35 : 0, g = 600 + (side > 0 ? 1 : 0);
    if (!L.robe) {
      r.limb(hip, knee, 6 * k * b, 5 * k * b, L.legs, { g, bias });
      r.limb(knee, foot, 5 * k * b, 4.4 * k * b, L.boots, { g: g + 2, bias });
    } else r.limb(knee, foot, 4.6 * k * b, 4.2 * k * b, L.boots, { g: g + 2, bias });
    r.egg(add(foot, [3 * k, 0, -.5 * k]), 7 * k, 4.6 * k * b, 3 * k, L.boots, { g: g + 2, bias: bias - .1 });
  }
  const chest = T([0, 0, 66]), hip = T([0, 0, 47]);
  // A cape behind (sways with the walk).
  if (L.cape) {
    const sw = p.anim === 'walk' ? [2, 0, -2, 0][p.f % 4] : br;
    r.plate([T([-6, -15 * b, 74]), T([-6, 15 * b, 74]), add(T([-12 - sw, 19 * b, 14]), [0, 0, 0]), add(T([-14 - sw, 0, 10]), [0, 0, 0]), T([-12 - sw, -19 * b, 14])], L.cape, { g: 610, z: -14 * k });
  }
  // Robe (a bell to the ankles) or hips and belt.
  if (L.robe) {
    const sw = p.anim === 'walk' ? [1.5, 0, -1.5, 0][p.f % 4] : 0;
    r.egg(T([sw, 0, 34]), 12 * k * b, 13 * k * b, 30 * k, L.robe, { g: 620 });
    r.egg([sw * k, 0, 9 * k], 14 * k * b, 15 * k * b, 9 * k, L.robe, { g: 620 });
  } else r.egg(T([0, 0, 49]), 9.5 * k * b, 12 * k * b, 7 * k, L.legs, { g: 621 });
  // Trunk.
  r.egg(T([0, 0, 63 + br * .4]), 9.5 * k * b, 14 * k * b, 15 * k, L.torso, { g: 630 });
  if (L.belt) r.egg(T([0, 0, 53]), 10 * k * b, 13.5 * k * b, 3 * k, L.belt, { g: 631, z: .5 });
  // Shoulders.
  const shL = T([0, -15 * b, 74 + br * .5]), shR = T([0, 15 * b, 74 + br * .5]);
  if (L.plates) for (const [sh, side] of [[shL, -1], [shR, 1]] as const) r.egg(add(sh, [0, side * 1.5 * k, 2 * k]), 8 * k, 8 * k, 6.5 * k, L.plates, { g: 640 + side, z: 2 });
  // The head.
  const hd = T([1, 0, 90 + br * .5 + (atk === 1 ? -1 : 0)]);
  head(r, hd, k, L);
  // Arms: the weapon in its right hand (wound back, struck through, followed), the off hand.
  const W = L.weapon;
  let handR: V3, handL: V3, dirR: V3 = [.15, .2, 1];
  const restR = T([7 - st.sw * 4, 19 * b, 48]), restL = T([7 + st.sw * 4, -19 * b, 48]);
  if (L.caster) {
    const lift = atk >= 0 ? [.4, 1, .8, .2][atk] : 0;
    handR = lerp3(restR, T([16, 13 * b, 80]), lift); handL = lerp3(L.off === 'none' ? restL : T([10, -16 * b, 56]), T([18, -10 * b, 74]), lift);
    dirR = [.1, .05, 1];
  } else if (atk >= 0) {
    handR = T(([[-6, 17 * b, 92], [20, 10 * b, 60], [16, 0, 46], [10, 16 * b, 52]] as V3[])[atk]);
    dirR = ([[-.45, .15, .9], [.9, -.1, -.3], [.6, -.6, -.5], [.4, .1, .9]] as V3[])[atk];
    handL = T([10, -16 * b, 56]);
  } else { handR = restR; handL = L.off === 'none' ? restL : T([10, -16 * b, 56]); }
  if (W === 'bow') { handL = T([16 + (atk === 1 ? 4 : 0), -6 * b, 72]); handR = atk === 0 || atk === 1 ? T([0, 4 * b, 74]) : T([12, -2 * b, 72]); }
  if (W === 'fists' && atk >= 0) { handR = T(([[-4, 18 * b, 70], [24, 8 * b, 64], [20, 4 * b, 56], [10, 18 * b, 52]] as V3[])[atk]); }
  for (const [sh, hand, side] of [[shL, handL, -1], [shR, handR, 1]] as const) {
    const el = ik(sh, hand, 15 * k, 14 * k, [-1, side * .6, -.3]);
    const far = r.toward([0, side, 0]) < -.2, bias = far ? -.35 : 0, g = 650 + (side > 0 ? 1 : 0);
    const am = L.arms ?? L.robe ?? L.torso;
    r.limb(sh, el, 5 * k * b, 4.4 * k * b, am, { g, bias });
    r.limb(el, hand, 4.4 * k * b, 3.8 * k * b, am, { g, bias });
    r.ball(hand, 3.6 * k * b, L.skin, { g: g + 4, bias });
  }
  weapon(r, handR, dirR, k, L, atk);
  offhand(r, handL, k, L, atk);
  L.dress?.(r, p, { hip, chest, head: hd, handR, handL, S: T });
}
function head(r: Rig, hd: V3, k: number, L: HumLook): void {
  const fwd: V3 = [1, 0, 0], H = L.headMat ?? L.skin;
  const eyes = (dz: number, spread: number, big = 2, glow = true) => { for (const side of [-1, 1] as const) { const e = add(hd, [11 * k, side * spread * k, dz * k]); if (glow) eyeGlow(r, e, [1, side * .6, 0], L.eye, Math.max(1, Math.round(big * k))); else if (r.faces([1, side * .6, 0])) { r.mark(e, '#2a1a30', 2, 3); r.mark(add(e, [0, 0, .8]), '#ffffff'); } } };
  switch (L.head) {
    case 'orc': {
      r.ball(hd, 12 * k, H, { g: 700 });
      r.egg(add(hd, [7 * k, 0, -6 * k]), 6 * k, 9 * k, 5 * k, H, { g: 700 });
      for (const side of [-1, 1] as const) {
        r.plate([add(hd, [-1 * k, side * 10 * k, 3 * k]), add(hd, [-4 * k, side * 18 * k, 6 * k]), add(hd, [-1 * k, side * 11 * k, -2 * k])], H, { g: 701 + side, bias: -.2 });
        r.limb(add(hd, [11 * k, side * 4.5 * k, -7 * k]), add(hd, [13 * k, side * 5.5 * k, -1 * k]), 1.6 * k, .8 * k, HM.bone, { z: 2 });
      }
      r.egg(add(hd, [7 * k, 0, 5 * k]), 6 * k, 10 * k, 2.5 * k, mix3(H), { g: 703, z: .5 });
      eyes(1, 4.5); if (L.hair) r.chain([add(hd, [-2 * k, 0, 11 * k]), add(hd, [-9 * k, 0, 9 * k]), add(hd, [-13 * k, 0, 1 * k])], 3 * k, 1.6 * k, L.hair, { z: -1 });
      break;
    }
    case 'hood': case 'mitre': {
      const m = L.headMat ?? L.robe ?? L.torso;
      r.egg(add(hd, [-1 * k, 0, 1 * k]), 12.5 * k, 12.5 * k, 13 * k, m, { g: 710 });
      if (L.head === 'mitre') r.plate([add(hd, [2 * k, -7 * k, 9 * k]), add(hd, [2 * k, 7 * k, 9 * k]), add(hd, [0, 0, 26 * k])], m, { g: 712, z: 1 });
      else r.plate([add(hd, [-6 * k, 0, 10 * k]), add(hd, [-14 * k, 0, 15 * k]), add(hd, [-5 * k, 0, 4 * k])], m, { g: 710 });
      r.egg(add(hd, [6.5 * k, 0, -1 * k]), 6 * k, 8 * k, 8 * k, L.skin === HM.bone ? HM.skull : HM.void, { g: 711, z: 1 });
      if (L.skin === HM.bone || L.skin === HM.vbone) { for (const side of [-1, 1] as const) r.egg(add(hd, [10.5 * k, side * 3.4 * k, 0]), 1.6 * k, 2.6 * k, 2.6 * k, HM.void, { z: 1.5 }); }
      eyes(0, 3.2, 2);
      break;
    }
    case 'helm': case 'horned': case 'drowned': {
      r.ball(hd, 12 * k, H, { g: 720 });
      const hm = L.headMat ?? HM.iron;
      r.egg(add(hd, [-1 * k, 0, 3.5 * k]), 13 * k, 13.5 * k, 11 * k, hm, { g: 721 });
      r.egg(add(hd, [9.5 * k, 0, -1 * k]), 3 * k, 7 * k, 2.2 * k, HM.void, { g: 722, z: 1 });
      if (L.head === 'horned') for (const side of [-1, 1] as const) r.chain([add(hd, [0, side * 11 * k, 6 * k]), add(hd, [2 * k, side * 18 * k, 11 * k]), add(hd, [5 * k, side * 19 * k, 19 * k])], 3 * k, 1 * k, HM.bone, { z: 1 });
      if (L.head === 'drowned') for (let i = 0; i < 5; i++) r.chain([add(hd, [-6 * k, (i - 2) * 4 * k, -6 * k]), add(hd, [-9 * k, (i - 2) * 4.6 * k, -16 * k - (i % 2) * 3 * k])], 1.4 * k, .8 * k, mat('#3a6a5a', { cool: '#08141a' }, { round: 1 }), { z: -2 });
      for (const side of [-1, 1] as const) { const e = add(hd, [12 * k, side * 3.5 * k, -1 * k]); if (r.faces([1, side * .4, 0])) r.mark(e, L.eye[1], 2, 1, { always: true }); }
      break;
    }
    case 'skull': {
      r.ball(hd, 12 * k, HM.skull, { g: 730 });
      r.egg(add(hd, [5 * k, 0, -9 * k]), 6 * k, 7 * k, 4 * k, HM.skull, { g: 731, z: -1 });
      for (const side of [-1, 1] as const) { const ec = add(hd, [9.6 * k, side * 5 * k, -1 * k]); r.egg(ec, 2.2 * k, 3.7 * k, 3.5 * k, HM.void, { z: .5 }); eyeGlow(r, add(ec, [2 * k, 0, 0]), [1, side * .55, 0], L.eye, 2); }
      break;
    }
    case 'bare': {
      r.ball(hd, 12 * k, H, { g: 740 });
      if (L.hair) r.egg(add(hd, [-3 * k, 0, 4 * k]), 11 * k, 12.5 * k, 10 * k, L.hair, { g: 741 });
      eyes(0, 4.6, 2, L.eye !== EYE.ember || true);
      if (r.faces(fwd)) r.egg(add(hd, [10.5 * k, 0, -6 * k]), 1.2 * k, 3 * k, 1.6 * k, HM.void, { z: 1 });
      break;
    }
    case 'stone': case 'crystal': {
      const m = L.headMat ?? L.torso;
      r.egg(hd, 10 * k, 11 * k, 9 * k, m, { g: 750 });
      if (L.head === 'crystal') for (const [a, b] of [[-1, 0], [0, 1], [1, 0]] as const) r.plate([add(hd, [-2 * k, (a * 6 - 3) * k, 6 * k]), add(hd, [-2 * k, (a * 6 + 3) * k, 6 * k]), add(hd, [-4 * k, a * 8 * k, (16 + b * 5) * k])], m, { z: -1 });
      for (const side of [-1, 1] as const) eyeGlow(r, add(hd, [9.5 * k, side * 3.5 * k, 0]), [1, side * .5, 0], L.eye, 2);
      break;
    }
  }
}
function weapon(r: Rig, hand: V3, dir: V3, k: number, L: HumLook, atk: number): void {
  const l = Math.hypot(...dir) || 1, d: V3 = [dir[0] / l, dir[1] / l, dir[2] / l], m = L.weaponMat ?? HM.iron;
  switch (L.weapon) {
    case 'sword': sword(r, hand, d, 40 * k, 0, m); break;
    case 'axe': case 'greataxe': {
      const big = L.weapon === 'greataxe' ? 1.4 : 1, top = add(hand, d, 30 * k * big);
      r.limb(add(hand, d, -8 * k * big), top, 2 * k, 2 * k, HM.wood);
      // The blade: a crescent plate beside the haft's head, turned to its swing.
      const side: V3 = [d[1] * 0 - d[2] * 1, d[2] * 0 - d[0] * 0, d[0] * 1 - d[1] * 0];
      const sl = Math.hypot(...side) || 1, sd: V3 = [side[0] / sl, side[1] / sl, side[2] / sl];
      const bw = 12 * k * big, bh = 9 * k * big;
      const c0 = add(top, d, -5 * k * big);
      r.plate([add(c0, d, bh * .6), add(add(c0, sd, bw), d, bh), add(add(c0, sd, bw * 1.15), d, 0), add(add(c0, sd, bw), d, -bh), add(c0, d, -bh * .6)], m, { z: .5 });
      r.line(add(add(c0, sd, bw), d, bh * .9), add(add(c0, sd, bw), d, -bh * .9), L.edge ?? m.ramp[5], { always: true });
      break;
    }
    case 'staff': case 'spear': {
      const top = add(hand, d, 34 * k);
      r.limb(add(hand, d, -30 * k), top, 1.8 * k, 1.8 * k, L.weaponMat ?? HM.wood);
      if (L.weapon === 'spear') r.plate([add(top, [0, -2 * k, 0]), add(top, d, 10 * k), add(top, [0, 2 * k, 0])], HM.iron, { z: .5 });
      else {
        r.ball(add(top, d, 3 * k), 4.5 * k, HM.skull, { z: .5 });
        if (atk >= 0 || true) { r.ball(add(top, d, 9 * k), (3 + (atk === 1 ? 2 : 0)) * k, HM.ember, { z: 1 }); r.ball(add(top, d, 9 * k), 1.8 * k, HM.emberCore, { z: 1.2 }); }
      }
      break;
    }
    case 'hook': {
      const tip = add(hand, d, 26 * k);
      r.limb(add(hand, d, -14 * k), tip, 1.8 * k, 1.6 * k, HM.iron);
      r.chain([tip, add(tip, [3 * k, 0, 2 * k]), add(tip, [6 * k, 0, -2 * k])], 1.6 * k, .8 * k, HM.iron);
      break;
    }
    case 'bow': {
      // Held in the off hand; the string drawn to the right hand.
      const hl = add(hand, [0, 0, 0]);
      void hl;
      break;
    }
    case 'censer': {
      const swing = atk >= 0 ? [-.6, .9, .5, 0][atk] : .15;
      const end = add(hand, [Math.sin(swing) * 16 * k, 0, -Math.cos(swing) * 16 * k]);
      r.line(hand, end, HM.brass.ramp[3]);
      r.egg(end, 4 * k, 4 * k, 3.6 * k, HM.brass, { z: 1 });
      r.ball(add(end, [0, 0, 3 * k]), 1.8 * k, L.eye === EYE.violet ? { ...HM.ember, ramp: ['#40205e', '#6b3aa0', '#8a5ad0', '#b06bff', '#d8b0ff', '#f0e0ff'] } : HM.ember, { z: 1.2 });
      break;
    }
    default: break;
  }
}
function offhand(r: Rig, hand: V3, k: number, L: HumLook, atk: number): void {
  switch (L.off) {
    case 'shield': {
      const c = add(hand, [3 * k, -3 * k, 0]), n: V3 = [.82, -.57, 0], a: V3 = [0, 0, 14 * k], b: V3 = [.57 * 13 * k, .82 * 13 * k, 0];
      r.disc(c, a, b, L.offMat ?? HM.iron, { z: 3 });
      if (r.faces(n)) r.ball(add(c, n, 2 * k), 3.4 * k, HM.iron, { z: 3.5 });
      break;
    }
    case 'cinder': case 'lantern': {
      const up = L.off === 'cinder' ? add(hand, [0, 0, 5 * k]) : add(hand, [0, 0, -7 * k]);
      if (L.off === 'lantern') { r.line(hand, up, HM.iron.ramp[1]); r.egg(up, 4 * k, 4 * k, 5 * k, HM.iron, { z: 1 }); }
      r.ball(up, (3.4 + (atk === 1 ? 1.4 : 0)) * k, L.offMat ?? HM.ember, { z: 1.4 }); r.ball(up, 1.6 * k, HM.emberCore, { z: 1.6 });
      break;
    }
    case 'book': r.egg(add(hand, [2 * k, 0, 2 * k]), 5 * k, 6 * k, 1.8 * k, L.offMat ?? HM.leather, { z: 1 }); break;
    case 'fetish': {
      r.limb(add(hand, [0, 0, -30 * k]), add(hand, [0, 0, 24 * k]), 1.6 * k, 1.4 * k, HM.wood, { z: .5 });
      r.ball(add(hand, [0, 0, 26 * k]), 4 * k, HM.skull, { z: .6 });
      for (const dz of [16, 12]) r.mark(add(hand, [1 * k, 0, dz * k]), '#c8bdc4', 2, 3, { always: true });
      break;
    }
    default: break;
  }
  if (L.weapon === 'bow') {
    // The bow in the off hand: a curved stave, the string to the drawing hand.
    const top = add(hand, [-2 * k, 0, 22 * k]), bot = add(hand, [-2 * k, 0, -22 * k]);
    r.chain([bot, add(hand, [3 * k, 0, -10 * k]), add(hand, [4 * k, 0, 0]), add(hand, [3 * k, 0, 10 * k]), top], 1.6 * k, 1.6 * k, L.weaponMat ?? HM.bone, { z: 1 });
    const draw = atk === 0 || atk === 1 ? add(hand, [-16 * k, 0, 0]) : add(hand, [-2 * k, 0, 0]);
    r.line(top, draw, '#d8d0c0', { always: true }); r.line(draw, bot, '#d8d0c0', { always: true });
    if (atk === 0) r.limb(draw, add(hand, [8 * k, 0, 0]), .8 * k, .8 * k, HM.wood, { z: 1.2 });
  }
}

// ── The other lands' commons (batch 2) ──
const glowMat = (r: string[]): Mat => ({ ramp: r, round: 3, gain: .4, soft: true });
const C = {
  orc: mat('#77855c', { cool: '#14200e', warm: '#f0ffd0', deep: .6, hi: .45 }, { round: 6 }),
  basalt: mat('#4e4754', { cool: '#0c0a12', warm: '#d8d0e0', hi: .45 }, { round: 4, gain: 1.1, shine: true }),
  slagIron: mat('#5c5a6c', { cool: '#0e0c16', warm: '#e8e0ff', hi: .5 }, { round: 1.5, shine: true, gain: 1.2 }),
  red: mat('#923422', { cool: '#1a060a', warm: '#ffb090', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
  ashCloak: mat('#7a6e78', { cool: '#160e1c', warm: '#f0e4ec', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
  dusk: mat('#5a3a78', { cool: '#120624', warm: '#f0d8ff', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
  gold: mat('#e8b040', { cool: '#3a1a08', warm: '#fff8d0', hi: .6 }, { shine: true, round: 2, gain: 1.2 }),
  wraith: mat('#544268', { cool: '#0e0818', warm: '#e8d8ff', deep: .6, hi: .45 }, { round: 6, gain: .9 }),
  obs: mat('#3c3354', { cool: '#08060e', warm: '#c8b8f0', deep: .6, hi: .5 }, { round: 5, gain: 1.2, shine: true }),
  obsDk: mat('#2a2440', { cool: '#06040a', warm: '#a898d0', deep: .6, hi: .4 }, { round: 4, gain: 1.1 }),
  ghoul: mat('#988d95', { cool: '#1e1420', warm: '#fff0f4', deep: .6, hi: .45 }, { round: 5 }),
  slag: mat('#5e4c42', { cool: '#120a08', warm: '#e8c8a8', deep: .6, hi: .4 }, { round: 4, gain: 1.1 }),
  glass: mat('#524c76', { cool: '#0a0818', warm: '#e0e8ff', deep: .6, hi: .65 }, { round: 3, gain: 1.4, shine: true }),
  bat: mat('#64527a', { cool: '#120a20', warm: '#f0e0ff', deep: .6, hi: .45 }, { round: 5 }),
  leaf: mat('#55a03e', { cool: '#08200c', warm: '#eaffc0', deep: .6, hi: .45 }, { round: 1.5, gain: .8 }),
  leafDk: mat('#36702c', { cool: '#061408', warm: '#c0f0a0', deep: .6, hi: .35 }, { round: 1.5, gain: .7 }),
  stalker: mat('#5a6e44', { cool: '#0c1408', warm: '#e8ffd0', deep: .6, hi: .45 }, { round: 6 }),
  moss: mat('#62a04a', { cool: '#0c200a', warm: '#e8ffc8', deep: .55, hi: .5 }, { round: 4 }),
  bark: mat('#74543a', { cool: '#140a08', warm: '#f0d0b0', deep: .6, hi: .4 }, { round: 4 }),
  hart: mat('#a4764c', { cool: '#1e0e0a', warm: '#fff0d0', deep: .6, hi: .45 }, { round: 6 }),
  hartLt: mat('#d8b07c', { cool: '#3a2414', warm: '#fffaf0', deep: .5, hi: .5 }, { round: 4 }),
  rootglass: { ramp: ['#17604e', '#2a7a64', '#4cb898', '#7affd0', '#b0ffe8', '#eafff6'], round: 2, gain: 1.3, shine: true } as Mat,
  thorn: mat('#94784e', { cool: '#1a0e08', warm: '#fff0c8', deep: .6, hi: .45 }, { round: 3 }),
  petal: mat('#ec6eac', { cool: '#2a0618', warm: '#fff0f8', deep: .6, hi: .45 }, { round: 3, gain: .9 }),
  ink: mat('#2c2240', { cool: '#06040c', warm: '#b8a0e0', deep: .6, hi: .5 }, { round: 6, gain: 1.1 }),
  inkDk: mat('#1c1430', { cool: '#040208', warm: '#8070a8', deep: .6, hi: .35 }, { round: 4 }),
  mireRust: mat('#6a5a4a', { cool: '#0c1010', warm: '#d0d8c8', deep: .6, hi: .4 }, { round: 3, gain: 1.15, shine: true }),
  kelp: mat('#3a6a5a', { cool: '#08141a', warm: '#c0f0d8', deep: .6, hi: .4 }, { round: 2 }),
  bog: mat('#4a5a3a', { cool: '#0a1008', warm: '#d8e8b8', deep: .6, hi: .45 }, { round: 7 }),
  bogLt: mat('#8a9a62', { cool: '#1a2010', warm: '#f8ffe0', deep: .5, hi: .5 }, { round: 5 }),
  witch: mat('#3a3050', { cool: '#08060e', warm: '#d0c8f0', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
  skinPale: mat('#b8c0a8', { cool: '#1a2018', warm: '#fffff0', deep: .55, hi: .45 }, { round: 6 }),
  grub: mat('#d8c8a8', { cool: '#3a2a20', warm: '#fffcf0', deep: .55, hi: .5 }, { round: 6 }),
  cap: mat('#b04a3a', { cool: '#2a0810', warm: '#ffe0c0', deep: .6, hi: .45 }, { round: 8 }),
  stem: mat('#e0d4b8', { cool: '#3a3028', warm: '#fffcf0', deep: .5, hi: .45 }, { round: 5 }),
  robeWet: mat('#4a5a5a', { cool: '#081014', warm: '#d8f0f0', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
  stone: mat('#78707c', { cool: '#100c16', warm: '#f0e8f0', deep: .55, hi: .45 }, { round: 4, gain: 1.1 }),
};
const FIRE = glowMat(['#9e2e1c', '#e2552a', '#ff8a3a', '#ffb347', '#ffd870', '#fff2a8']);
const VIOLETG = glowMat(['#40205e', '#6b3aa0', '#8a5ad0', '#b06bff', '#d8b0ff', '#f0e0ff']);
const ROOTG = glowMat(['#17604e', '#2fb38a', '#4cd0a0', '#7affd0', '#b0ffe8', '#eafff6']);
const LAMP = glowMat(['#a05a10', '#e09a2a', '#ffc04a', '#ffd870', '#fff0b0', '#fffbe8']);
const hb = (L: HumLook) => (r: Rig, p: Pose) => humanoid(r, p, L);
const biped = (p: Pose) => ({ ...lungeBody(p, .7), ...fallBody(p, 'back') });
const beast = (p: Pose) => ({ ...lungeBody(p, .7), ...fallBody(p, 'side', .7) });
const BIG: [number, number, number, number] = [220, 180, 110, 160];

// ── Floaters: a hooded shade of ash, a lantern's lost flame ──
function shade(r: Rig, p: Pose, robe: Mat, heart: Mat, eye: readonly string[], k = 1): void {
  const ph = p.f / FRAMES * TAU, atk = p.anim === 'attack' ? p.f % 4 : -1, dying = p.anim === 'death';
  const lift = dying ? [8, 4, 0, -4][p.f % 4] : 10 + Math.sin(ph) * 2.5;
  const S = (q: V3): V3 => [q[0] * k, q[1] * k, q[2] * k + lift];
  // Tatters for feet, waving.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6 - .5) * 2.4, sway = Math.sin(ph + i * 1.3) * 3;
    r.chain([S([Math.cos(a) * 9, Math.sin(a) * 11, 10]), S([Math.cos(a) * 9 + sway * .3, Math.sin(a) * 12, 2]), S([Math.cos(a) * 8 + sway, Math.sin(a) * 12 + sway * .4, -6 - (i % 3) * 3])], 3.2 * k, 1 * k, robe, { g: 800 });
  }
  r.egg(S([0, 0, 26]), 11, 13, 17, robe, { g: 801 });
  // The ember heart through the robe's open front.
  r.egg(S([8, 0, 30]), 3, 6, 9, HM.void, { g: 802, z: 1 });
  r.ball(S([10, 0, 31]), (3 + (atk === 1 ? 1.5 : 0)) * k, heart, { g: 803, z: 1.5 });
  // Hood with nothing in it but two coals.
  const hd = S([2, 0, 48 + (atk === 1 ? -2 : 0)]);
  r.egg(hd, 11 * k, 11 * k, 12 * k, robe, { g: 804 });
  r.plate([add(hd, [-6 * k, 0, 9 * k]), add(hd, [-15 * k, 0, 13 * k]), add(hd, [-5 * k, 0, 2 * k])], robe, { g: 804 });
  r.egg(add(hd, [6 * k, 0, -1 * k]), 5 * k, 7 * k, 7 * k, HM.void, { g: 805, z: 1 });
  for (const side of [-1, 1] as const) if (r.faces([1, side * .5, 0])) { r.mark(add(hd, [10 * k, side * 3 * k, 0]), eye[1], 2, 2, { always: true }); r.mark(add(hd, [10 * k, side * 3 * k, 0]), eye[2], 1, 1, { always: true }); }
  // Sleeves reaching, bone hands.
  const reach = atk >= 0 ? [4, 18, 14, 8][atk] : 6 + Math.sin(ph) * 2;
  for (const side of [-1, 1] as const) {
    const sh = S([0, side * 12, 38]), hand = S([reach, side * (14 - (atk === 1 ? 5 : 0)), 26 + (atk === 0 ? 10 : 0)]);
    const far = r.toward([0, side, 0]) < -.2;
    r.limb(sh, hand, 4.6 * k, 3.4 * k, robe, { g: 810 + side, bias: far ? -.4 : 0 });
    r.chain([hand, add(hand, [4 * k, side * 1 * k, -1 * k]), add(hand, [6 * k, side * 1 * k, -4 * k])], 1.3 * k, .8 * k, HM.bone, { z: .5 });
    r.chain([hand, add(hand, [4 * k, side * -1 * k, -2 * k]), add(hand, [5 * k, side * -1.5 * k, -5 * k])], 1.2 * k, .8 * k, HM.bone, { z: .5 });
  }
}
function wisp(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, atk = p.anim === 'attack' ? p.f % 4 : -1, dying = p.anim === 'death';
  const lift = 18 + Math.sin(ph) * 3 - (dying ? p.f * 5 : 0), grow = atk === 1 ? 1.25 : 1, fade = dying ? 1 - p.f * .2 : 1;
  for (const [y, n] of [[-4, 10], [0, 14], [4, 9]] as const) {
    const pts: V3[] = [];
    for (let i = 0; i < 4; i++) pts.push([-i * 2, y + Math.sin(ph + i + y) * 2, lift - i * n / 3]);
    r.chain(pts, 2.4, .8, mat('#6a5a50', { cool: '#140c10' }, { round: 2, gain: .5, soft: true }), { z: -4 });
  }
  const c: V3 = [0, 0, lift + 12];
  r.egg(c, 9 * grow * fade, 10 * grow * fade, 13 * grow * fade, LAMP, { g: 820 });
  r.chain([add(c, [0, 0, 8]), add(c, [Math.sin(ph) * 2, 0, 15 * grow]), add(c, [Math.sin(ph + 1) * 3, Math.cos(ph) * 2, 21 * grow])], 5 * fade, 1, LAMP, { g: 820 });
  r.egg(add(c, [2, 0, -1]), 4.5, 5.5, 7, glowMat(['#ffc04a', '#ffd870', '#ffe8a0', '#fff4c8', '#fffbe8', '#ffffff']), { z: 1 });
  // What's left of its cage: an iron ring below, one bent bar.
  r.disc(add(c, [0, 0, -12]), [7, 0, 0], [0, 7, 0], HM.iron, { z: -1 });
  r.limb(add(c, [-6, -5, -11]), add(c, [-7, -7, 2]), 1, 1, HM.iron, { z: -1 });
  for (const side of [-1, 1] as const) if (r.faces([1, side * .3, 0])) r.mark(add(c, [8, side * 3, 1]), '#2a1408', 1, 3);
}
// ── Wings: a bat on leaf wings ──
function bat(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, atk = p.anim === 'attack' ? p.f % 4 : -1, dying = p.anim === 'death';
  const beat = dying ? .3 : Math.sin(ph * (p.anim === 'walk' ? 1 : 1)), lift = dying ? [14, 8, 2, 0][p.f % 4] : 22 + Math.sin(ph) * 3;
  const c: V3 = [atk === 1 ? 8 : 0, 0, lift + 10 + (atk === 1 ? -4 : 0)];
  for (const side of [-1, 1] as const) {
    const sh = add(c, [0, side * 5, 4]), tip = add(sh, [-2, side * 24, 10 + beat * 12]), mid = add(sh, [-8, side * 18, -2 + beat * 6]), low = add(sh, [-4, side * 7, -8]);
    r.plate([sh, tip, mid, low], C.leaf, { g: 830 + side, z: -1, bias: r.toward([0, side, 0]) < 0 ? -.6 : .1 });
    r.line(sh, tip, C.leaf.ramp[1], { always: true }); r.line(add(sh, [-2, side * 6, 0]), mid, C.leafDk.ramp[2], { always: true });
  }
  r.egg(c, 7, 8, 9, C.bat, { g: 840 });
  r.egg(add(c, [5, 0, -1]), 3, 5, 6, lighten(C.bat, .25), { g: 841, z: .5 });
  const h: V3 = add(c, [2, 0, 11]);
  r.ball(h, 7, C.bat, { g: 842 });
  for (const side of [-1, 1] as const) r.plate([add(h, [-1, side * 3, 4]), add(h, [1, side * 7, 4]), add(h, [-1, side * 6, 14])], C.bat, { g: 843 + side, z: .5 });
  for (const side of [-1, 1] as const) { const e = add(h, [6, side * 2.6, 1]); if (r.faces([1, side * .5, 0])) { r.mark(e, '#7affd0', 2, 2); r.mark(e, '#eafff6'); } }
  if (r.faces([1, 0, 0])) { r.mark(add(h, [6.6, -1, -3]), '#fffaf0', 1, 2); r.mark(add(h, [6.6, 1, -3]), '#fffaf0', 1, 2); }
  for (const side of [-1, 1] as const) r.limb(add(c, [0, side * 3, -7]), add(c, [1, side * 3, -12]), 1.2, 1, C.bat);
}
function lighten(m: Mat, t = .35): Mat { return { ...m, ramp: m.ramp.map(c => mix(c, '#fff4e0', t)) }; }

// ── Many legs: a thorn spider, slag beetle, a bark grub ──
function spider(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, walk = p.anim === 'walk', atk = p.anim === 'attack' ? p.f % 4 : -1;
  const bob = walk ? Math.abs(Math.sin(ph * 2)) * 1.5 : breath(p);
  const th: V3 = [6, 0, 20 + bob], ab: V3 = [-14, 0, 24 + bob + (atk === 0 ? 4 : 0)];
  for (let i = 0; i < 4; i++) for (const side of [-1, 1] as const) {
    const a = walk ? ph + (i % 2 ? Math.PI : 0) + (side > 0 ? Math.PI : 0) : 0;
    const hipF = 12 - i * 5, root: V3 = [hipF, side * 5, 21 + bob];
    const foot: V3 = [hipF + (i - 1.5) * 8 + Math.sin(a) * 5, side * (30 - Math.abs(i - 1.5) * 2), Math.max(0, Math.cos(a)) * 4];
    const knee: V3 = add(lerp3(root, foot, .45), [0, 0, 18]);
    const far = r.toward([0, side, 0]) < -.2;
    r.limb(root, knee, 2.6, 2, C.thorn, { g: 850 + i * 2 + (side > 0 ? 1 : 0), bias: far ? -.5 : 0 });
    r.limb(knee, foot, 2, .9, C.thorn, { g: 850 + i * 2 + (side > 0 ? 1 : 0), bias: far ? -.5 : 0 });
    r.chain([knee, add(knee, [0, side * 2, 4])], 1.2, .4, mat('#d4c098', {}, { round: 1 }), { z: .3 });
  }
  r.egg(ab, 16, 13, 12, C.bark, { g: 860 });
  for (let i = 0; i < 5; i++) r.mark(add(ab, [-4 + i * 2, (i - 2) * 3, 12]), '#d4c098', 2, 1, { n: [0, 0, 1] });
  r.ball(add(ab, [-4, 0, 5]), 4.5, ROOTG, { z: .5 });
  r.egg(th, 9, 9, 7, C.thorn, { g: 861 });
  const h = add(th, [9 + (atk === 1 ? 4 : 0), 0, 1]);
  r.ball(h, 6, C.thorn, { g: 862 });
  for (const side of [-1, 1] as const) {
    r.chain([add(h, [4, side * 3, -3]), add(h, [8 + (atk === 1 ? 3 : 0), side * (atk === 1 ? 1 : 4), -6]), add(h, [8, side * 1, -9])], 1.6, .7, HM.bone, { z: .8 });
    for (const [dy, dz] of [[2, 2], [4, 1], [1.5, 4]] as const) if (r.faces([1, side * .5, .2])) r.mark(add(h, [5, side * dy, dz]), '#7affd0', 1, 1);
  }
}
function crawler(r: Rig, p: Pose, shell: Mat, seam: Mat, legs: Mat, n = 4, size = 1, mand = true): void {
  const ph = p.f / FRAMES * TAU, walk = p.anim === 'walk', atk = p.anim === 'attack' ? p.f % 4 : -1;
  const k = size;
  for (let i = 0; i < 3; i++) for (const side of [-1, 1] as const) {
    const a = walk ? ph + (i % 2 ? Math.PI : 0) + (side > 0 ? Math.PI : 0) : 0;
    const root: V3 = [(8 - i * 9) * k, side * 8 * k, 8 * k], foot: V3 = [(8 - i * 9 + Math.sin(a) * 4) * k, side * 19 * k, Math.max(0, Math.cos(a)) * 3];
    const knee = add(lerp3(root, foot, .5), [0, 0, 7 * k]);
    const far = r.toward([0, side, 0]) < -.2;
    r.limb(root, knee, 2.2 * k, 1.8 * k, legs, { bias: far ? -.5 : 0 }); r.limb(knee, foot, 1.8 * k, 1 * k, legs, { bias: far ? -.5 : 0 });
  }
  for (let i = 0; i < n; i++) {
    const f = (12 - i * 9) * k, bob = walk ? Math.sin(ph + i) * .8 : breath(p) * .5;
    const rr = (11 - Math.abs(i - 1) * 1.2) * k;
    r.egg([f, 0, 11 * k + bob], 7 * k, rr, 7.5 * k, shell, { g: 870 + i });
    if (i) r.line([f + 4 * k, -rr * .9, 14 * k + bob], [f + 4 * k, rr * .9, 14 * k + bob], seam.ramp[3], { always: true });
  }
  if (mand) for (const side of [-1, 1] as const) {
    const open = atk === 0 ? 7 : atk === 1 ? 1 : p.anim === 'idle' ? 4 : [4, 3, 4, 3][p.f % 4];
    r.chain([[18 * k, side * 4 * k, 9 * k], [25 * k, side * (3 + open) * k, 8 * k], [30 * k, side * (open * .4) * k, 7 * k]], 2 * k, .8 * k, HM.iron, { z: .5 });
  }
  for (const side of [-1, 1] as const) if (r.faces([1, side * .5, 0])) r.mark([18 * k, side * 4 * k, 15 * k], seam.ramp[4], 2, 2);
  // Fire at the seams.
  for (let i = 1; i < n; i++) r.mark([(12 - i * 9 + 4.5) * k, ((i % 2) * 2 - 1) * 3 * k, 18 * k], seam.ramp[5], 2, 1, { n: [0, 0, 1] });
}
function grub(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, walk = p.anim === 'walk', atk = p.anim === 'attack' ? p.f % 4 : -1;
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const f = 22 - i * 9, wave = walk ? Math.sin(ph - i * .9) * 2.5 : breath(p) * Math.sin(i);
    const rr = 10.5 - Math.abs(i - 1.5) * .9, u = 10 + Math.max(0, wave);
    r.egg([f, Math.cos(ph - i) * (walk ? 1.5 : 0), u], 7, rr, 9 - i * .4, i % 2 ? C.bark : mat('#5e4430', { cool: '#120a06' }, { round: 6 }), { g: 880 + i });
    r.mark([f + 2, 0, u + 8], '#7affd0', 2, 2, { n: [0, 0, 1] });
    for (const side of [-1, 1] as const) if (r.faces([0, side, 0])) r.mark([f, side * (rr - 1), u + 1], '#4cd0a0', 1, 2);
  }
  const h: V3 = [28 + (atk === 1 ? 6 : 0), 0, 11];
  r.ball(h, 8, C.grub, { g: 890 });
  const open = atk === 0 ? 1 : atk === 1 ? 4 : 2;
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; r.chain([add(h, [6, Math.cos(a) * 4, Math.sin(a) * 4]), add(h, [10 + open, Math.cos(a) * (4 + open), Math.sin(a) * (4 + open)])], 1.6, .6, HM.bone, { z: .5 }); }
  if (r.faces([1, 0, 0])) r.mark(add(h, [8, 0, 0]), '#3a0a10', 3, 3);
}
// ── Walking plants ──
function lasher(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, walk = p.anim === 'walk', atk = p.anim === 'attack' ? p.f % 4 : -1;
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU + .3, step = walk ? Math.sin(ph + i * 1.7) * 3 : 0;
    r.chain([[Math.cos(a) * 6, Math.sin(a) * 6, 10], [Math.cos(a) * 12 + step, Math.sin(a) * 12, 4], [Math.cos(a) * 15 + step, Math.sin(a) * 15, 0]], 2.6, 1.2, C.bark, { g: 900 });
  }
  const bob = walk ? Math.abs(Math.sin(ph)) * 2 : breath(p);
  r.egg([0, 0, 18 + bob], 11, 12, 11, C.leaf, { g: 901 });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; r.plate([[Math.cos(a) * 7, Math.sin(a) * 7, 12], [Math.cos(a + .4) * 17, Math.sin(a + .4) * 17, 6], [Math.cos(a - .2) * 15, Math.sin(a - .2) * 15, 3]], C.leafDk, { z: -1 }); }
  // The stalk and the petalled maw.
  const lean = atk === 0 ? -8 : atk === 1 ? 14 : atk === 2 ? 8 : Math.sin(ph) * 2;
  const top: V3 = [lean, 0, 50 + bob - (atk === 1 ? 6 : 0)];
  r.chain([[0, 0, 26 + bob], [lean * .4, 0, 38 + bob], top], 3.6, 2.6, C.leaf, { g: 902 });
  const open = atk === 1 ? 1 : atk === 0 ? .3 : .6;
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; r.plate([top, add(top, [6 + Math.cos(a) * 3, Math.cos(a) * 11 * open + Math.cos(a) * 3, Math.sin(a) * 11 * open + 3]), add(top, [9, Math.cos(a + .5) * 6 * open, Math.sin(a + .5) * 6 * open + 3])], C.petal, { z: .3 + (Math.cos(a) > 0 ? .1 : 0) }); }
  r.egg(add(top, [3, 0, 1]), 3, 5, 5, HM.void, { z: .6 });
  for (let i = -1; i <= 1; i++) r.mark(add(top, [6, i * 3, 4]), '#fffaf0', 1, 2, { n: [1, 0, 0] });
  for (const side of [-1, 1] as const) {
    const w = atk >= 0 ? [6, 14, 10, 4][atk] : 4 + Math.sin(ph + side) * 2;
    const pts: V3[] = [[2, side * 9, 24 + bob], [8 + w * .4, side * 18, 34 + w * .5], [14 + w, side * 22, 30 + w * .2], [18 + w * 1.2, side * 20, 20]];
    r.chain(pts, 2.4, 1, C.leafDk, { z: -.5 + (r.toward([0, side, 0]) > 0 ? 3 : 0) });
    for (let i = 1; i < 4; i++) r.mark(pts[i], '#d4c098', 1, 1, { always: true });
  }
}
function sporecap(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, walk = p.anim === 'walk', atk = p.anim === 'attack' ? p.f % 4 : -1;
  for (const side of [-1, 1] as const) {
    const a = walk ? ph + (side > 0 ? Math.PI : 0) : 0;
    r.chain([[0, side * 5, 14], [Math.sin(a) * 4, side * 8, 5], [Math.sin(a) * 6 + 2, side * 9, Math.max(0, Math.cos(a)) * 3]], 3, 1.6, C.bark, { g: 910 + side });
  }
  const bob = walk ? Math.abs(Math.sin(ph)) * 2 : breath(p);
  const puff = atk === 1 ? 1.15 : atk === 0 ? .92 : 1;
  r.egg([0, 0, 26 + bob], 9, 10, 15, C.stem, { g: 911 });
  r.egg([0, 0, 44 + bob], 18 * puff, 19 * puff, 9 * puff, C.cap, { g: 912 });
  r.egg([0, 0, 39 + bob], 15 * puff, 16 * puff, 3, mat('#e8d0b0', { cool: '#3a2a20' }, { round: 3 }), { g: 913, z: -1 });
  for (const [a, rr, d] of [[0, 9, 4], [1.6, 12, 3], [3.3, 8, 3], [4.6, 13, 2.5], [2.4, 4, 3.5]] as const) r.ball([Math.cos(a) * rr, Math.sin(a) * rr, 49 + bob], d, mat('#f8ecd8', { cool: '#5a3a30' }, { round: 2 }), { z: .5 });
  for (const side of [-1, 1] as const) if (r.faces([1, side * .5, 0])) { r.mark([9, side * 3.5, 30 + bob], '#2a1a14', 2, 3); r.mark([9.4, side * 3.5, 31 + bob], '#fffaf0'); }
  if (atk === 1) for (let i = 0; i < 6; i++) r.ball([14 + i * 3, Math.sin(i * 2) * 5, 34 + Math.cos(i * 3) * 4], 2 + (i % 2), glowMat(['#6a7a2a', '#9ab040', '#c8d860', '#e0ec90', '#f4f8c8', '#ffffff']), { z: 2 });
}

const ORC: HumLook = { k: 1.05, skin: C.orc, torso: HM.leather, arms: C.orc, legs: HM.char, boots: C.basalt, belt: HM.leather, plates: C.basalt, head: 'orc', hair: HM.char, eye: EYE.blood, bulk: 1.35, weapon: 'axe', weaponMat: C.slagIron, edge: '#ffb347', off: 'none' } as HumLook;
const WOLFLIKE: Omit<QuadLook, 'body' | 'under' | 'dark' | 'eye'> = { len: 15, hipU: 30, leg: 13, legR: 4.2, barrel: [18, 12, 11], chest: 13, haunch: 11.5, head: 11, headAt: [11, 0, 14], muzzle: 13, muzzleR: 5.4, ear: 8, tail: [[-3, 0, 4], [-11, 0, 7], [-19, 0, 6], [-25, 0, 2]], tailR: 5.6, nose: '#1a1018', claw: '#e8e1cf' };
const qb = (L: QuadLook) => (r: Rig, p: Pose) => quadruped(r, p, L);

// ── Bosses and world bosses (batch 2) ──
const BB = {
  drake: mat('#dc4e2c', { cool: '#2a0610', warm: '#ffe0a0', deep: .6, hi: .5 }, { round: 6 }),
  belly: mat('#ffc262', { cool: '#5a2a10', warm: '#fffbe0', deep: .5, hi: .5 }, { round: 4 }),
  membrane: mat('#45365a', { cool: '#0a0614', warm: '#e0c8ff', deep: .6, hi: .4 }, { round: 1.5, gain: .7 }),
  sov: mat('#3e2c34', { cool: '#08040a', warm: '#f0c8b8', deep: .6, hi: .4 }, { round: 5 }),
  magma: mat('#4e4754', { cool: '#0a080e', warm: '#ffc8a0', deep: .6, hi: .45 }, { round: 5, gain: 1.1 }),
  guard: mat('#8e9682', { cool: '#14180e', warm: '#f8fff0', deep: .55, hi: .45 }, { round: 5, gain: 1.05 }),
  sexton: mat('#6a6670', { cool: '#0e0c14', warm: '#e8e8f0', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
  abbess: mat('#2a2238', { cool: '#06040c', warm: '#c8b8f0', deep: .6, hi: .4 }, { round: 5, gain: .9 }),
  void: mat('#140c18', { cool: '#020104', warm: '#6a5080', deep: .5, hi: .35 }, { round: 8, gain: .8 }),
};
const CORONA: Mat = { ramp: ['#8a7aa8', '#b0a0d0', '#d0c4ec', '#e8e0ff', '#f6f2ff', '#ffffff'], round: 3, gain: .4, soft: true };

/** Membrane wings from two shoulders: an arm and three fingers each, the skin between, beating. */
function wings(r: Rig, root: V3, span: number, beat: number, skin: Mat, bone: Mat, g = 950): void {
  for (const side of [-1, 1] as const) {
    const sh = add(root, [0, side * 6, 0]);
    const elbow = add(sh, [-6, side * span * .45, 10 + beat * span * .35]);
    const tips: V3[] = [add(elbow, [-4, side * span * .55, 8 + beat * span * .2]), add(elbow, [-14, side * span * .45, -2 + beat * span * .15]), add(elbow, [-20, side * span * .25, -12 + beat * span * .1])];
    const far = r.toward([0, side, 0]) < 0;
    r.plate([sh, elbow, tips[0], tips[1], tips[2], add(sh, [-18, side * 4, -6])], skin, { g: g + side, z: -3, bias: far ? -.6 : 0 });
    r.limb(sh, elbow, 2.6, 2, bone, { z: -2.8 });
    for (const t of tips) r.limb(elbow, t, 1.6, .8, bone, { z: -2.7 });
  }
}
function drake(r: Rig, p: Pose, bone = false): void {
  const ph = p.f / FRAMES * TAU, beat = Math.sin(ph) * (p.anim === 'walk' ? 1 : .5) + (p.anim === 'attack' && p.f === 0 ? .6 : 0);
  const L: QuadLook = { ...WOLFLIKE, len: 18, hipU: 23, leg: 10.5, legR: 4.8, barrel: [21, 13, 12], chest: 14, haunch: 13, head: 8, headAt: [22, 0, 24], muzzle: 20, muzzleR: 4.8, ear: .01,
    tail: [[-4, 0, 2], [-16, 0, 2], [-28, 4, 0], [-38, 2, -4]], tailR: 6.5,
    body: bone ? HM.bone : BB.drake, barrelMat: bone ? HM.void : undefined, under: bone ? HM.boneDk : BB.belly, dark: bone ? HM.boneDk : mat('#9c2e1c', { cool: '#1a0408' }, { round: 4 }), eye: bone ? EYE.violet : EYE.ember, nose: '#2a0a08', claw: '#fff0d0',
    dress: (rr, pp, q) => {
      for (const side of [-1, 1] as const) rr.chain([add(q.head, [-6, side * 5, 6]), add(q.head, [-12, side * 7, 10]), add(q.head, [-17, side * 6, 9])], 2.4, .8, HM.horn, { z: .5 });
      for (let i = 0; i < 6; i++) rr.plate([add(q.hip, [i * 7, -1, 12]), add(q.hip, [i * 7 + 4, 1, 12]), add(q.hip, [i * 7 + 1, 0, 18 - (i % 2) * 2])], HM.horn, { z: .5 });
      wings(rr, add(q.chest, [-6, 0, 10]), 48, beat + .35, bone ? { ...BB.membrane, ramp: BB.membrane.ramp.map(c => mix(c, '#6b3aa0', .25)) } : BB.membrane, bone ? HM.bone : BB.drake);
      if (bone) {
        rr.ball(add(q.chest, [-12, 0, -1]), 6, FIRE, { z: -2 });
        for (let i = 0; i < 6; i++) { const f = 6 + i * 5.2, pts: V3[] = []; for (let a = -160; a <= 160; a += 32) { const t = a * Math.PI / 180; pts.push(add(q.hip, [f, Math.sin(t) * 13, Math.cos(t) * 12 + 1])); } rr.chain(pts.slice(0, 6), 1.9, 1.7, HM.bone, { g: 980 + i }); rr.chain(pts.slice(5), 1.7, 1.9, HM.bone, { g: 990 + i }); }
        rr.chain([add(q.hip, [0, 0, 12]), add(q.chest, [0, 0, 13])], 2.6, 2.6, HM.bone, { z: .2 });
      }
      if (pp.anim === 'attack' && pp.f === 1) rr.ball(add(q.head, [20, 0, -4]), 6, bone ? VIOLETG : FIRE, { z: 3 });
    } };
  quadruped(r, p, L);
}
function wyrm(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, atk = p.anim === 'attack' ? p.f % 4 : -1;
  const n = 14, pts: V3[] = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1), a = t * 4.2 + ph * .25; pts.push([Math.cos(a) * 26 * (1 - t * .3) - 6, Math.sin(a) * 30 * (1 - t * .3), 10 + Math.max(0, t - .7) * 140 + Math.sin(ph + i) * 1.5]); }
  const head: V3 = add(pts[n - 1], [10 + (atk === 1 ? 12 : atk === 0 ? -6 : 0), 0, 6 + (atk === 0 ? 6 : 0)]);
  for (let i = 0; i < n - 1; i++) { const rr = 15 - i * .55; r.limb(pts[i], pts[i + 1], rr, rr - .55, C.bark, { g: 960 }); if (i % 2 === 0) r.plate([add(pts[i], [0, -2, rr - 1]), add(pts[i], [0, 2, rr - 1]), add(pts[i], [0, 0, rr + 7])], C.thorn, { z: .3 }); r.mark(add(pts[i], [0, 0, rr]), '#62a04a', 3, 2, { n: [0, 0, 1] }); }
  r.limb(pts[n - 1], head, 9, 11, C.bark, { g: 960 });
  r.egg(head, 16, 13, 11, C.bark, { g: 961 });
  r.egg(add(head, [12, 0, -5 - (atk === 1 ? 3 : 0)]), 9, 9, 4, mat('#4e3828', { cool: '#0a0604' }), { g: 962, z: -.3 });
  for (const side of [-1, 1] as const) {
    r.chain([add(head, [-4, side * 7, 9]), add(head, [-8, side * 14, 22]), add(head, [-14, side * 22, 30]), add(head, [-12, side * 28, 42])], 3.6, 1.6, C.rootglass, { z: 1 });
    r.chain([add(head, [-9, side * 15, 24]), add(head, [-2, side * 22, 34])], 2.2, 1, C.rootglass, { z: 1 });
    if (r.faces([1, side * .5, 0])) { r.mark(add(head, [12, side * 6, 4]), '#7affd0', 3, 3); r.mark(add(head, [12, side * 6, 4]), '#eafff6'); }
  }
  if (atk === 1) for (let i = 0; i < 5; i++) r.plate([add(head, [24 + i * 5, (i - 2) * 4, -2]), add(head, [28 + i * 5, (i - 2) * 5, 0]), add(head, [26 + i * 5, (i - 2) * 4.5, 4])], C.rootglass, { z: 3 });
}
function seamEater(r: Rig, p: Pose): void {
  const ph = p.f / FRAMES * TAU, atk = p.anim === 'attack' ? p.f % 4 : -1, open = atk === 1 ? 1 : atk === 0 ? .2 : .45 + Math.sin(ph) * .15;
  const c: V3 = [0, 0, 70 + Math.sin(ph) * 3];
  // The corona: rays all round the dark sun (every way out of it, so any facing shows them round its rim).
  r.ball(c, 50, CORONA, { g: 968, z: -60 });
  for (let i = 0; i < 16; i++) {
    const y = 1 - (i + .5) / 16 * 2, rad = Math.sqrt(1 - y * y), th = i * 2.39996 + ph * .1, d: V3 = [Math.cos(th) * rad, Math.sin(th) * rad, y];
    const len = 52 + (i % 3) * 6;
    r.limb(add(c, d, 40), add(c, d, len), 6, 1.5, CORONA, { g: 968, z: -60 });
  }
  r.ball(c, 44, BB.void, { g: 970 });
  // The maw: a tear top to bottom, violet throat, teeth along both lips, bone stitches.
  r.egg(add(c, [40, 0, 0]), 4, 9 + open * 12, 34, mat('#6b3aa0', { cool: '#14062a', warm: '#f0e0ff' }, { round: 6 }), { g: 971, z: 1 });
  r.egg(add(c, [42, 0, 0]), 2, 4 + open * 6, 28, VIOLETG, { g: 972, z: 1.2 });
  for (let i = -5; i <= 5; i++) for (const side of [-1, 1] as const) { const z = i * 5.4, w = (9 + open * 12) * Math.sqrt(Math.max(0, 1 - (z / 34) ** 2)); r.mark(add(c, [44, side * (w - 1), z]), '#f0e8dc', 2, 3, { n: [1, 0, 0] }); if (i % 2 === 0 && open < .6) r.line(add(c, [44, -w, z]), add(c, [44, w, z]), '#e8dcc8', { n: [1, 0, 0] }); }
  for (let i = 0; i < 7; i++) r.chain([add(c, [Math.cos(i) * 20, Math.sin(i * 2.3) * 30, -36]), add(c, [Math.cos(i) * 22, Math.sin(i * 2.3) * 32, -52 - ((i + p.f) % 3) * 6])], 3, 1, BB.void, { z: -1 });
}
function colossus(r: Rig, p: Pose): void {
  humanoid(r, p, { k: 1.6, skin: BB.guard, torso: BB.guard, arms: BB.guard, legs: BB.guard, boots: BB.guard, plates: BB.guard, head: 'stone', headMat: BB.guard, eye: ['#17604e', '#7affd0', '#eafff6'], bulk: 1.7, weapon: 'fists', off: 'none',
    dress: (rr, pp, q) => {
      rr.ball(add(q.chest, [14, 0, 0]), 7, ROOTG, { z: 1 });
      for (let i = 0; i < 5; i++) rr.chain([add(q.head, [-2, (i - 2) * 6, 14]), add(q.head, [-4, (i - 2) * 9, 26 + (i % 2) * 6])], 2.6, 1, C.bark, { z: .5 });
      for (let i = 0; i < 4; i++) rr.chain([add(q.chest, [12, -20 + i * 12, 20]), add(q.chest, [14, -18 + i * 12, -10]), add(q.hip, [12, -16 + i * 10, -30])], 1.8, 1.2, C.moss, { z: 1.5 });
    } });
}
const BIGB: [number, number, number, number] = [300, 260, 150, 230];
function BIG2(): [number, number, number, number] { return BIGB; }

export const HD_MODELS: Record<string, HdModel> = {
  'bone-walker': {
    box: [190, 150, 95, 132],
    build: (r, p) => skeleton(r, p, { bone: HM.bone, skull: HM.skull, eye: EYE.ember, rag: HM.rag, shield: true, weapon: 'sword' }),
    body: p => (p.anim === 'attack' ? lungeBody(p, .8) : {}),
  },
  'raised-skeleton': {
    box: [190, 150, 95, 132],
    build: (r, p) => skeleton(r, p, { bone: HM.vbone, skull: HM.vskull, eye: EYE.violet, rag: null, shield: false, weapon: 'sword' }),
    body: p => (p.anim === 'attack' ? lungeBody(p, .8) : {}),
  },
  'ash-wolf': {
    box: [200, 150, 100, 120],
    build: (r, p) => quadruped(r, p, {
      len: 15, hipU: 30, leg: 13, legR: 4.2, body: HM.ash, under: HM.ashLt, dark: HM.ashDk,
      barrel: [18, 12, 11], chest: 13, haunch: 11.5, head: 11, headAt: [11, 0, 14], muzzle: 13, muzzleR: 5.4, ear: 8,
      tail: [[-3, 0, 4], [-11, 0, 7], [-19, 0, 6], [-25, 0, 2]], tailR: 5.6, eye: EYE.ember, nose: '#2a1a20', claw: '#e8e1cf',
      dress: (rr, pp, q) => {
        // The ruff: a lighter mane over the withers, embers caught in it; the tail's tip still smoulders.
        rr.egg(add(q.chest, [3, 0, 6]), 8, 11, 7, HM.ashLt, { g: 205, z: .3 });
        const e: V3 = pp.f % 2 ? [-6, 2, 13] : [-12, -3, 12];
        rr.mark(add(q.chest, e), '#ffb347', 2, 1, { always: true });
        rr.mark(add(q.hip, [-26, 0, 2]), '#ff8a3a', 2, 2, { always: true });
      },
    }),
    body: p => ({ ...lungeBody(p, .7), ...fallBody(p, 'side', .7) }),
  },
  'rivet-maw': {
    box: [170, 130, 85, 105],
    build: maw,
    body: p => ({ ...lungeBody(p, .6), ...fallBody(p, 'side', .5) }),
  },
  'cinder-imp': {
    scale: 1.2,
    box: [170, 150, 85, 128],
    build: imp,
    body: p => (p.anim === 'death' ? { roll: [.2, .6, 1.2, 1.45][p.f % 4], du: [10, 2, -4, -6][p.f % 4] } : lungeBody(p, .7)),
    floats: true,
  },
  'cinder-bailiff': {
    box: [190, 160, 95, 140],
    build: (r, p) => bailiff(r, p, { robe: HM.robe, hood: HM.hood, tool: 'hook', scale: 1.15 }),
    body: p => ({ ...lungeBody(p, .7), ...fallBody(p, 'back') }),
    scale: 1.3,
  },
  'cinder-orc': { box: BIG, build: hb(ORC), body: biped },
  'orc-firecaller': { box: BIG, build: hb({ ...ORC, torso: C.red, robe: C.red, plates: undefined, head: 'hood', headMat: C.red, weapon: 'staff', off: 'cinder', caster: true, bulk: 1.1 }), body: biped },
  'ashsinger': { box: BIG, build: hb({ ...ORC, k: .95, torso: C.ashCloak, robe: C.ashCloak, plates: undefined, head: 'orc', weapon: 'none', off: 'fetish', caster: true, bulk: 1, eye: EYE.ember,
    dress: (r, p, q) => { r.ball(add(q.handR, [0, 0, 5]), 3.2, FIRE, { z: 1.4 }); r.egg(add(q.hip, [3, 13, 4]), 5, 4, 5, HM.leather, { z: 1 }); if (p.anim === 'attack' || p.f % 2) { if (r.faces([1, 0, 0])) r.mark(add(q.head, [12, 0, -7]), '#3a0a08', 3, 2); } } }), body: biped },
  'cinder-wraith': { scale: 1.25, box: BIG, build: (r, p) => shade(r, p, C.wraith, FIRE, EYE.ember), body: p => (p.anim === 'death' ? { pitch: [-.2, -.5, -1, -1.3][p.f % 4] } : lungeBody(p, .6)), floats: true },
  'lantern-wisp': { scale: 1.6, box: BIG, build: wisp, body: p => lungeBody(p, .5), floats: true },
  'canopy-bat': { scale: 1.6, box: BIG, build: bat, body: p => (p.anim === 'death' ? { roll: [.3, .8, 1.3, 1.5][p.f % 4] } : lungeBody(p, .6)), floats: true },
  'thorn-weaver': { scale: 1.3, box: BIG, build: spider, body: beast },
  'slag-crawler': { scale: 1.35, box: BIG, build: (r, p) => crawler(r, p, C.slag, FIRE, HM.iron, 4, 1.1), body: beast },
  'rootgnaw': { scale: 1.35, box: BIG, build: grub, body: beast },
  'vine-lasher': { scale: 1.45, box: BIG, build: lasher, body: p => ({ ...lungeBody(p, .3), ...fallBody(p, 'side', .7) }) },
  'sporecap': { scale: 1.5, box: BIG, build: sporecap, body: p => ({ ...lungeBody(p, .3), ...fallBody(p, 'side', .7) }) },
  'lava-hound': { box: BIG, build: qb({ ...WOLFLIKE, len: 17, hipU: 31, barrel: [19, 13, 12], chest: 14, haunch: 12.5, body: C.obs, under: C.obsDk, dark: C.obsDk, eye: EYE.ember, nose: '#ff8a3a', claw: '#ffb347',
    dress: (r, p, q) => { for (let i = 0; i < 5; i++) { const f = -14 + i * 7, h = 6 + ((i + p.f) % 3) * 3; r.chain([add(q.hip, [f + 17, 0, 9]), add(q.hip, [f + 15, Math.sin(p.f + i), 9 + h * .6]), add(q.hip, [f + 13, 0, 9 + h])], 3, .8, FIRE, { z: .5 }); }
      r.line(add(q.hip, [10, 13, 4]), add(q.hip, [18, 13, -2]), '#ff8a3a', { n: [0, 1, 0] }); r.line(add(q.hip, [20, -13, 4]), add(q.hip, [28, -13, 0]), '#ff8a3a', { n: [0, -1, 0] }); } }), body: beast },
  'ink-hound': { box: BIG, build: qb({ ...WOLFLIKE, len: 17, hipU: 31, body: C.ink, under: C.inkDk, dark: C.inkDk, eye: EYE.violet, nose: '#0a0610', claw: '#b06bff',
    dress: (r, p, q) => { for (let i = 0; i < 4; i++) r.chain([add(q.hip, [6 + i * 8, (i % 2 ? 1 : -1) * 6, -2]), add(q.hip, [6 + i * 8, (i % 2 ? 1 : -1) * 6, -8 - ((i + p.f) % 3) * 2])], 1.8, .6, C.inkDk, { z: -.5 }); } }), body: beast },
  'moss-stalker': { box: BIG, build: qb({ ...WOLFLIKE, len: 18, hipU: 27, leg: 11.5, barrel: [20, 11, 10], chest: 12, haunch: 11, head: 10, headAt: [10, 0, 10], muzzle: 8, muzzleR: 5, ear: 6, tail: [[-3, 0, 3], [-14, 0, 2], [-25, 0, 4], [-32, 0, 10]], tailR: 3.6, body: C.stalker, under: C.moss, dark: mat('#3c4c30', { cool: '#060a04' }, { round: 4 }), eye: ['#17604e', '#7affd0', '#eafff6'], nose: '#1a2010', claw: '#d8d0c0',
    dress: (r, p, q) => { for (const [f, side] of [[0, -1], [3, 1]] as const) r.plate([add(q.chest, [f - 3, side * 5, 9]), add(q.chest, [f + 3, side * 5, 9]), add(q.chest, [f, side * 6, 19])], C.rootglass, { z: .6 }); for (let i = 0; i < 5; i++) r.mark(add(q.hip, [6 + i * 5, (i % 2 ? 4 : -4), 12]), '#2a3420', 2, 2, { n: [0, 0, 1] }); } }), body: beast },
  'rootglass-hart': { scale: 0.92, box: [220, 200, 110, 175], build: qb({ ...WOLFLIKE, len: 18, hipU: 40, leg: 18, legR: 3.6, barrel: [20, 11, 11], chest: 13, haunch: 12, head: 9, headAt: [13, 0, 24], muzzle: 12, muzzleR: 4.6, ear: 7, tail: [[-3, 0, 4], [-8, 0, 6]], tailR: 4, body: C.hart, under: C.hartLt, dark: mat('#76522f', { cool: '#140a06' }, { round: 4 }), eye: ['#17604e', '#2a1408', '#7affd0'], nose: '#2a1408', claw: '#3a2414',
    dress: (r, p, q) => { for (const side of [-1, 1] as const) { const b = add(q.head, [-2, side * 4, 8]); r.chain([b, add(b, [-2, side * 6, 10]), add(b, [-6, side * 10, 18]), add(b, [-4, side * 14, 26])], 2.4, 1.2, C.rootglass, { z: .5 }); r.chain([add(b, [-3, side * 7, 13]), add(b, [3, side * 9, 19])], 1.6, .8, C.rootglass, { z: .5 }); } } }), body: beast },
  'mire-lurker': { scale: 1.35, box: BIG, build: qb({ ...WOLFLIKE, len: 15, hipU: 18, leg: 9, legR: 5, barrel: [19, 16, 10], chest: 14, haunch: 13, head: 12, headAt: [13, 0, 4], muzzle: 12, muzzleR: 8, ear: 0.01, tail: [[-4, 0, 2], [-14, 0, 0], [-22, 0, 0]], tailR: 6, body: C.bog, under: C.bogLt, dark: mat('#2e3a24', { cool: '#060a04' }, { round: 5 }), eye: ['#4a3a08', '#e8d040', '#fffbe0'], nose: '#1a2010', claw: '#d8d0c0',
    dress: (r, p, q) => { for (let i = 0; i < 6; i++) r.ball(add(q.hip, [4 + i * 5, (i % 3 - 1) * 7, 9 + (i % 2) * 2]), 2.4, C.bogLt, { z: .5 }); } }), body: beast },
  'ash-ghoul': { scale: 0.9, box: BIG, build: hb({ k: .9, skin: C.ghoul, torso: C.ghoul, arms: C.ghoul, legs: C.ghoul, boots: C.ghoul, head: 'bare', eye: EYE.blood, bulk: .85, weapon: 'fists', off: 'none', hunch: .75, cape: HM.hood }), body: biped },
  'bone-archer': { box: BIG, build: hb({ k: .95, skin: HM.bone, torso: HM.bone, arms: HM.bone, legs: HM.bone, boots: HM.bone, head: 'skull', eye: EYE.ember, bulk: .62, weapon: 'bow', weaponMat: HM.bone, off: 'none', cape: HM.rag }), body: biped },
  'bone-priest': { box: BIG, build: hb({ k: .95, skin: HM.bone, torso: C.dusk, robe: C.dusk, arms: C.dusk, legs: HM.bone, boots: HM.bone, head: 'mitre', headMat: C.dusk, eye: EYE.violet, bulk: .85, weapon: 'censer', off: 'book', caster: true,
    dress: (r, p, q) => { r.plate([add(q.chest, [8, -4, 8]), add(q.chest, [8, 4, 8]), add(q.chest, [11, 3, -30]), add(q.chest, [11, -3, -30])], mat('#e8e0c8', {}, { round: 1 }), { z: 1 }); r.line(add(q.chest, [11, -3, -30]), add(q.chest, [11, 3, -30]), '#e8b040', { n: [1, 0, 0] }); } }), body: biped },
  'drowned-knight': { box: BIG, build: hb({ k: 1.1, skin: C.mireRust, torso: C.mireRust, arms: C.mireRust, legs: C.mireRust, boots: C.mireRust, plates: C.mireRust, head: 'drowned', headMat: C.mireRust, eye: ['#0a3a30', '#7affd0', '#eafff6'], bulk: 1.25, weapon: 'sword', weaponMat: mat('#8a6a4a', { cool: '#140a08', warm: '#e8d0b0' }, { round: 1.5, shine: true, gain: 1.2 }), off: 'none', cape: C.kelp }), body: biped },
  'gloam-witch': { box: BIG, build: hb({ k: .95, skin: C.skinPale, torso: C.witch, robe: C.witch, arms: C.witch, legs: C.witch, boots: HM.char, head: 'hood', headMat: C.witch, eye: EYE.violet, bulk: .9, weapon: 'staff', off: 'none', caster: true,
    dress: (r, p, q) => { const t = add(q.head, [0, 0, 9]); r.egg(t, 17, 17, 3, C.witch, { z: .5 }); r.chain([add(t, [0, 0, 1]), add(t, [-2, 0, 9]), add(t, [-6, 2, 16])], 7, 1.5, C.witch, { z: .6 }); r.ball(add(q.handR, [2, 0, 36]), 4, VIOLETG, { z: 2 }); } }), body: biped },
  'drowned-acolyte': { box: BIG, build: hb({ k: .95, skin: C.skinPale, torso: C.robeWet, robe: C.robeWet, arms: C.robeWet, legs: C.robeWet, boots: HM.char, head: 'hood', headMat: C.robeWet, eye: ['#0a3a30', '#7affd0', '#eafff6'], bulk: .9, weapon: 'none', off: 'lantern', offMat: ROOTG, caster: true,
    dress: (r, p, q) => { for (let i = 0; i < 4; i++) r.mark(add(q.chest, [9, -6 + i * 4, 4 - i * 3]), '#62a04a', 2, 1, { n: [1, 0, 0] }); } }), body: biped },
  'obsidian-golem': { box: BIG, build: hb({ k: 1.12, skin: C.obs, torso: C.obs, arms: C.obs, legs: C.obsDk, boots: C.obsDk, plates: C.obs, head: 'stone', headMat: C.obs, eye: EYE.ember, bulk: 1.6, weapon: 'fists', off: 'none',
    dress: (r, p, q) => { r.ball(add(q.chest, [9, 0, 0]), 4, FIRE, { z: 1 }); r.line(add(q.chest, [10, -8, 8]), add(q.chest, [11, -3, -2]), '#ff8a3a', { n: [1, 0, 0] }); r.line(add(q.chest, [10, 9, 6]), add(q.chest, [11, 4, -6]), '#e2552a', { n: [1, 0, 0] }); } }), body: biped },
  'glass-sentinel': { box: BIG, build: hb({ k: 1.08, skin: C.glass, torso: C.glass, arms: C.glass, legs: C.glass, boots: C.glass, plates: C.glass, head: 'crystal', headMat: C.glass, eye: ['#4a5890', '#b8c8f0', '#ffffff'], bulk: 1.15, weapon: 'none', off: 'none', caster: true,
    dress: (r, p, q) => { r.ball(add(q.chest, [9, 0, -2]), 4.5, FIRE, { z: 1 }); r.ball(add(q.chest, [11, 0, -2]), 2, HM.emberCore, { z: 1.2 }); } }), body: biped },
  // Bosses and world bosses.
  'ember-drake': { scale: 0.95, box: BIG2(), build: (r, p) => drake(r, p), body: beast },
  'bone-dragon': { scale: 1.6, box: BIG2(), build: (r, p) => drake(r, p, true), body: beast },
  'orc-warlord': { scale: 1.1, box: BIG2(), build: hb({ ...ORC, head: 'horned', headMat: C.basalt, cape: mat('#9c2e1c', { cool: '#1a0408' }, { round: 5 }), weapon: 'greataxe', bulk: 1.45 }), body: biped },
  'ember-warden': { scale: 1.75, box: BIG2(), build: (r, p) => bailiff(r, p, { robe: C.slag, hood: C.slag, tool: 'hook', scale: 1.15, crown: 'slag' }), body: biped },
  'anvil-warden': { scale: 2.0, box: BIG2(), build: (r, p) => bailiff(r, p, { robe: C.stone, hood: C.stone, tool: 'hammer', scale: 1.15, crown: 'anvil' }), body: biped },
  'magma-tyrant': { scale: 1.45, box: BIG2(), build: hb({ k: 1.12, skin: BB.magma, torso: BB.magma, arms: BB.magma, legs: BB.magma, boots: BB.magma, plates: BB.magma, head: 'stone', headMat: BB.magma, eye: EYE.ember, bulk: 1.7, weapon: 'fists', off: 'none',
    dress: (rr, pp, q) => { rr.ball(add(q.chest, [9, 0, 0]), 5, FIRE, { z: 1 }); for (const s of [-1, 1]) rr.line(add(q.chest, [10, s * 9, 10]), add(q.hip, [10, s * 8, -4]), '#ffb347', { n: [1, s * .3, 0] }); rr.egg(add(q.head, [0, 0, 10]), 10, 10, 2.5, HM.brass, { z: .5 }); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; rr.chain([add(q.head, [Math.cos(a) * 8, Math.sin(a) * 8, 11]), add(q.head, [Math.cos(a) * 8, Math.sin(a) * 8, 17 + ((i + pp.f) % 3) * 2])], 2.6, .6, FIRE, { z: .6 }); } } }), body: biped },
  'cinder-sovereign': { scale: 1.35, box: BIG2(), build: hb({ k: 1.1, skin: BB.magma, torso: BB.sov, robe: BB.sov, arms: BB.sov, legs: BB.sov, boots: BB.sov, head: 'stone', headMat: BB.magma, eye: EYE.ember, bulk: 1.4, weapon: 'none', off: 'cinder', caster: true,
    dress: (rr, pp, q) => { rr.ball(add(q.handR, [0, 0, 6]), 5, FIRE, { z: 1.4 }); rr.egg(add(q.head, [0, 0, 10]), 10, 10, 2.5, HM.brass, { z: .5 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; rr.chain([add(q.head, [Math.cos(a) * 8.5, Math.sin(a) * 8.5, 11]), add(q.head, [Math.cos(a) * 8.5, Math.sin(a) * 8.5, 18 + ((i + pp.f) % 3) * 3])], 2.6, .6, FIRE, { z: .6 }); } for (let i = 0; i < 4; i++) rr.line(add(q.hip, [12, -10 + i * 7, 4]), add(q.hip, [13, -12 + i * 7, -36]), '#e2552a', { n: [1, 0, 0] }); } }), body: biped },
  'the-uncounted': { scale: 1.45, box: BIG2(), build: hb({ k: 1, skin: HM.bone, torso: BB.sexton, robe: BB.sexton, arms: BB.sexton, legs: HM.bone, boots: HM.bone, head: 'hood', headMat: BB.sexton, eye: ['#3a6a6a', '#b8e8d8', '#ffffff'], bulk: .85, weapon: 'none', off: 'lantern', offMat: { ramp: ['#3a6a6a', '#6aa0a0', '#9ad0c8', '#b8e8d8', '#e0fff8', '#ffffff'], round: 2, gain: .4, soft: true },
    dress: (rr, pp, q) => { rr.line(add(q.head, [12, -3, 6]), add(q.head, [12, 3, 6]), '#3a3040', { n: [1, 0, 0] }); for (const d of [-2, 0, 2]) rr.line(add(q.head, [12, d, 8]), add(q.head, [12, d, 4]), '#3a3040', { n: [1, 0, 0] }); } }), body: biped },
  'ink-abbess': { scale: 1.5, box: BIG2(), build: hb({ k: 1, skin: C.skinPale, torso: BB.abbess, robe: BB.abbess, arms: BB.abbess, legs: BB.abbess, boots: BB.abbess, head: 'hood', headMat: BB.abbess, eye: EYE.violet, bulk: 1.05, weapon: 'censer', off: 'book', offMat: mat('#5a3a78'), caster: true,
    dress: (rr, pp, q) => { for (let i = 0; i < 6; i++) rr.chain([add(q.hip, [10 * Math.cos(i), 12 * Math.sin(i), -30]), add(q.hip, [11 * Math.cos(i), 13 * Math.sin(i), -44 - ((i + pp.f) % 3) * 3])], 2, .6, C.inkDk, { z: 1 }); rr.plate([add(q.chest, [9, -5, 8]), add(q.chest, [9, 5, 8]), add(q.chest, [12, 4, -34]), add(q.chest, [12, -4, -34])], mat('#e8e0c8', {}, { round: 1 }), { z: 1 }); } }), body: biped },
  'mossbound-colossus': { scale: 1.0, box: BIG2(), build: colossus, body: biped },
  'elder-rootwyrm': { scale: 1.45, box: BIG2(), build: wyrm, body: p => ({ ...lungeBody(p, .4), ...fallBody(p, 'side', .5) }) },
  'seam-eater-risen': { scale: 1.7, box: BIG2(), build: seamEater, body: p => (p.anim === 'death' ? { du: [-4, -20, -50, -70][p.f % 4] } : lungeBody(p, .3)), floats: true },
};
