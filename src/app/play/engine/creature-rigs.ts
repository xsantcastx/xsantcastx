import { POSE_STRIDE, resetPose, RigSpec } from './rig';
import { MAW, MAW_RIG, poseMaw } from './rig-poses';

/**
 * One rig per painted creature, keyed by the MonsterDef's `creature` art key.
 *
 * Each entry pairs a bone layout (traced over the painting's silhouette) with
 * a pose driver that gives the creature its own idle, wind-up, strike and hurt
 * motion. Unknown keys fall back to GENERIC_CREATURE, a four-bone body that
 * squashes, leans and lunges without assuming any anatomy.
 *
 * Conventions (same as rig-poses.ts): coordinates are normalised to the
 * painting (u right, v down). `fwd` is +1 for a painting that faces right and
 * -1 for one that faces left, so a driver can be written once:
 *   - "pitch forward" (the top of a bone moves toward the target) = fwd * a
 *   - "swing a hanging limb forward"                             = -fwd * a
 *   - "move toward the target"                                   = tx = fwd * a
 *
 * The wind-up must stay readable for gameplay: every driver makes the coil
 * grow over the whole 0.85 s wind-up so the strike is telegraphed, and the
 * engine still draws the ground bar and the "!" above it.
 *
 * Visual only: drivers read presentation inputs and never write game state.
 */

export type CreaturePhase = 'idle' | 'windup' | 'strike' | 'recover';
export interface CreaturePoseInput {
  phase: CreaturePhase;
  /** Seconds left in the current phase. */
  timer: number;
  time: number;
  /** Per-creature offset so a pack does not move in unison. */
  seed: number;
  reduced: boolean;
  /** Hit recoil 0..1 (presentation only), decaying after each blow. */
  hurt: number;
}
export interface CreatureRigDef {
  key: string;
  spec: RigSpec;
  /** True when the painting faces left (the engine mirrors it toward its target). */
  facesLeft: boolean;
  /** Drawing box at full size, world px. Contain-fit, bottom aligned. */
  box: { w: number; h: number };
  /** v of the feet in the painting; the figure is lowered so they touch the floor. 1 = image bottom. */
  ground: number;
  /** Contact shadow radius at full size. */
  shadow: number;
  pose: (pose: Float32Array, input: CreaturePoseInput) => void;
}

/** Phase lengths, mirrored from the engine's fixed-step monster update. */
export const CREATURE_WINDUP = .85, CREATURE_STRIKE = .2, CREATURE_RECOVER = 1.1;

function add(pose: Float32Array, bone: number, rot: number, tx = 0, ty = 0, sx = 1, sy = 1): void {
  const o = bone * POSE_STRIDE;
  pose[o] += rot; pose[o + 1] += tx; pose[o + 2] += ty; pose[o + 3] *= sx; pose[o + 4] *= sy;
}
const clamp01 = (v: number): number => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (p: number): number => p * p * (3 - 2 * p);

/** Wind-up coil (0..1, eased) for this frame. */
export function windupOf(input: CreaturePoseInput): number {
  return input.phase === 'windup' ? smooth(clamp01(1 - input.timer / CREATURE_WINDUP)) : 0;
}
/** Strike extension (0..1): snaps out over the strike and eases home through the recovery. */
export function strikeOf(input: CreaturePoseInput): number {
  if (input.phase === 'strike') return 1 - Math.pow(clamp01(input.timer / CREATURE_STRIKE), 3);
  if (input.phase === 'recover') return 1 - smooth(clamp01(1 - input.timer / CREATURE_RECOVER));
  return 0;
}

// ── Prism Forager: an upright crystal insectoid, claw hand low, crystal hand raised. Faces right.
export const FORAGER = { ROOT: 0, PELVIS: 1, TORSO: 2, HEAD: 3, CLAW: 4, CRYSTAL: 5, LEG_F: 6, LEG_B: 7 } as const;
export const FORAGER_RIG: RigSpec = {
  cols: [0, .25, .35, .45, .55, .65, .75, 1],
  rows: [0, .12, .22, .32, .42, .52, .62, .74, .86, 1],
  bones: [
    { name: 'root', parent: -1, px: .5, py: .9, ax: 0, ay: 0, bx: 0, by: 0, r: 0 },
    { name: 'pelvis', parent: 0, px: .5, py: .55, ax: .47, ay: .48, bx: .53, by: .58, r: .08 },
    { name: 'torso', parent: 1, px: .5, py: .48, ax: .47, ay: .3, bx: .52, by: .46, r: .09 },
    { name: 'head', parent: 2, px: .54, py: .24, ax: .52, ay: .06, bx: .56, by: .2, r: .08 },
    { name: 'claw', parent: 2, px: .4, py: .3, ax: .36, ay: .34, bx: .28, by: .62, r: .07 },
    { name: 'crystal', parent: 2, px: .6, py: .3, ax: .64, ay: .34, bx: .7, by: .22, r: .07 },
    { name: 'legFront', parent: 1, px: .44, py: .6, ax: .43, ay: .64, bx: .4, by: .9, r: .06 },
    { name: 'legBack', parent: 1, px: .57, py: .6, ax: .58, ay: .64, bx: .62, by: .88, r: .06 },
  ],
};
/** Skittering: bursts of quick, jittery weight shifts with the head cocking between them. */
export function poseForager(pose: Float32Array, input: CreaturePoseInput): void {
  resetPose(pose);
  if (input.reduced) return;
  const F = FORAGER, fwd = 1, t = input.time + input.seed;
  const burst = Math.pow(Math.max(0, Math.sin(t * 1.9)), 3);
  const sk = Math.sin(t * 13);
  add(pose, F.ROOT, 0, fwd * .014 * burst * sk, -Math.abs(sk) * .008 * burst);
  add(pose, F.LEG_F, .14 * burst * sk); add(pose, F.LEG_B, -.14 * burst * sk);
  add(pose, F.HEAD, (Math.sin(t * 3.3) > .55 ? .12 : 0) * fwd + Math.sin(t * 2.1) * .02);
  add(pose, F.CRYSTAL, Math.sin(t * 2) * .05);
  add(pose, F.CLAW, Math.sin(t * 17) * .035 * burst + Math.sin(t * 1.4) * .03);
  add(pose, F.TORSO, Math.sin(t * 1.6) * .02, 0, 0, 1, 1 + Math.sin(t * 2.4) * .01);
  const e = windupOf(input);
  if (e > 0) {
    const tremble = Math.sin(t * 50) * .03 * e;
    add(pose, F.ROOT, 0, 0, .02 * e, 1 + .05 * e, 1 - .12 * e);
    add(pose, F.TORSO, -fwd * .14 * e);
    add(pose, F.HEAD, -fwd * .06 * e);
    add(pose, F.CLAW, fwd * 1.15 * e + tremble);
    add(pose, F.CRYSTAL, fwd * .3 * e);
    add(pose, F.LEG_F, -fwd * .16 * e + tremble); add(pose, F.LEG_B, fwd * .16 * e - tremble);
  }
  const out = strikeOf(input);
  if (out > 0) {
    add(pose, F.ROOT, 0, fwd * .12 * out, 0, 1 + .04 * out, 1 - .03 * out);
    add(pose, F.TORSO, fwd * .2 * out);
    add(pose, F.HEAD, fwd * .1 * out);
    add(pose, F.CLAW, -fwd * 1.35 * out);
    add(pose, F.LEG_F, -fwd * .26 * out); add(pose, F.LEG_B, fwd * .3 * out);
  }
  const h = input.hurt;
  if (h > 0) {
    // Curls in on itself: arms fold to the chest, head ducks back.
    add(pose, F.ROOT, 0, -fwd * .03 * h, 0, 1 - .05 * h, 1);
    add(pose, F.TORSO, -fwd * .16 * h);
    add(pose, F.HEAD, -fwd * .22 * h);
    add(pose, F.CLAW, -fwd * .35 * h); add(pose, F.CRYSTAL, fwd * .35 * h);
  }
}

// ── Ephemeris Leech: a star-glass abdomen on a clockwork spider body, head low on the left. Faces left.
export const LEECH = { ROOT: 0, THORAX: 1, ABDOMEN: 2, HEAD: 3, FANGS: 4, LEGS_F: 5, LEGS_B: 6, LEGS_M: 7 } as const;
export const LEECH_RIG: RigSpec = {
  cols: [0, .15, .28, .4, .52, .64, .76, .88, 1],
  rows: [0, .15, .28, .4, .5, .6, .7, .8, .9, 1],
  bones: [
    { name: 'root', parent: -1, px: .5, py: .9, ax: 0, ay: 0, bx: 0, by: 0, r: 0 },
    { name: 'thorax', parent: 0, px: .48, py: .5, ax: .38, ay: .46, bx: .56, by: .52, r: .09 },
    { name: 'abdomen', parent: 1, px: .58, py: .42, ax: .62, ay: .2, bx: .74, by: .4, r: .14 },
    { name: 'head', parent: 1, px: .4, py: .48, ax: .3, ay: .44, bx: .38, by: .52, r: .07 },
    { name: 'fangs', parent: 3, px: .36, py: .55, ax: .3, ay: .56, bx: .36, by: .7, r: .05 },
    { name: 'legsFront', parent: 0, px: .4, py: .52, ax: .14, ay: .62, bx: .36, by: .82, r: .11 },
    { name: 'legsBack', parent: 0, px: .6, py: .52, ax: .66, ay: .62, bx: .86, by: .82, r: .11 },
    { name: 'legsMid', parent: 0, px: .5, py: .55, ax: .42, ay: .7, bx: .58, by: .86, r: .08 },
  ],
};
/** Undulating: a slow wave travels head → thorax → abdomen, and the abdomen pulses like a lung. */
export function poseLeech(pose: Float32Array, input: CreaturePoseInput): void {
  resetPose(pose);
  if (input.reduced) return;
  const L = LEECH, fwd = -1, t = input.time + input.seed;
  const w0 = Math.sin(t * 2.4), w1 = Math.sin(t * 2.4 - .9), w2 = Math.sin(t * 2.4 - 1.8);
  add(pose, L.HEAD, .05 * w0, 0, -.006 * w0);
  add(pose, L.THORAX, .03 * w1, 0, -.012 * w1);
  add(pose, L.ABDOMEN, .07 * w2, 0, 0, 1 + .035 * w2, 1 + .045 * w2);
  add(pose, L.FANGS, .06 * Math.max(0, Math.sin(t * 1.3)));
  add(pose, L.LEGS_F, .04 * Math.sin(t * 2.4 + .5)); add(pose, L.LEGS_B, -.04 * Math.sin(t * 2.4 + 1.2));
  add(pose, L.LEGS_M, .025 * Math.sin(t * 2.4 + 2));
  const e = windupOf(input);
  if (e > 0) {
    // Rears back, arches the abdomen over itself and throbs faster as the strike nears.
    const throb = Math.abs(Math.sin(t * (10 + 8 * e))) * .08 * e;
    add(pose, L.ROOT, 0, -fwd * .05 * e, 0, 1 + .04 * e, 1 - .08 * e);
    add(pose, L.THORAX, -fwd * .08 * e);
    add(pose, L.ABDOMEN, fwd * .32 * e, 0, 0, 1 + throb, 1 + throb);
    add(pose, L.HEAD, -fwd * .16 * e);
    add(pose, L.FANGS, -fwd * .35 * e);
    add(pose, L.LEGS_F, fwd * .12 * e); add(pose, L.LEGS_B, -fwd * .12 * e);
  }
  const out = strikeOf(input);
  if (out > 0) {
    add(pose, L.ROOT, 0, 0, 0, 1 + .08 * out, 1 - .05 * out);
    add(pose, L.THORAX, fwd * .06 * out, fwd * .14 * out, .01 * out);
    add(pose, L.ABDOMEN, fwd * .42 * out);
    add(pose, L.HEAD, fwd * .16 * out);
    add(pose, L.FANGS, fwd * .45 * out);
    add(pose, L.LEGS_F, -fwd * .18 * out); add(pose, L.LEGS_B, fwd * .14 * out);
  }
  const h = input.hurt;
  if (h > 0) {
    // Contracts: the abdomen shrinks, the legs draw in under the body.
    add(pose, L.ABDOMEN, -fwd * .1 * h, 0, 0, 1 - .1 * h, 1 - .1 * h);
    add(pose, L.THORAX, 0, -fwd * .04 * h);
    add(pose, L.LEGS_F, -fwd * .14 * h); add(pose, L.LEGS_B, fwd * .14 * h);
  }
}

// ── Mirror Substitute: a slender shard-wrapped humanoid. Faces left.
export const MIRROR = { ROOT: 0, HIPS: 1, CHEST: 2, HEAD: 3, ARM_L: 4, ARM_R: 5, LEG_L: 6, LEG_R: 7 } as const;
export const MIRROR_RIG: RigSpec = {
  cols: [0, .22, .32, .42, .5, .58, .68, .78, 1],
  rows: [0, .12, .22, .32, .42, .52, .62, .74, .86, 1],
  bones: [
    { name: 'root', parent: -1, px: .5, py: .92, ax: 0, ay: 0, bx: 0, by: 0, r: 0 },
    { name: 'hips', parent: 0, px: .5, py: .56, ax: .47, ay: .48, bx: .53, by: .6, r: .08 },
    { name: 'chest', parent: 1, px: .5, py: .44, ax: .46, ay: .24, bx: .54, by: .42, r: .1 },
    { name: 'head', parent: 2, px: .48, py: .2, ax: .46, ay: .05, bx: .5, by: .17, r: .07 },
    { name: 'armLeft', parent: 2, px: .4, py: .26, ax: .36, ay: .3, bx: .24, by: .56, r: .08 },
    { name: 'armRight', parent: 2, px: .58, py: .26, ax: .62, ay: .3, bx: .7, by: .55, r: .08 },
    { name: 'legLeft', parent: 1, px: .46, py: .6, ax: .45, ay: .64, bx: .43, by: .92, r: .06 },
    { name: 'legRight', parent: 1, px: .55, py: .6, ax: .56, ay: .64, bx: .6, by: .92, r: .06 },
  ],
};
/**
 * Mirrored sway: hips and chest lean in opposite directions, the arms rise and
 * fall as reflections of each other, and every few seconds the head snaps to a
 * wrong angle for a beat. Unsettling, never fast enough to read as a strike.
 */
export function poseMirror(pose: Float32Array, input: CreaturePoseInput): void {
  resetPose(pose);
  if (input.reduced) return;
  const M = MIRROR, fwd = -1, t = input.time + input.seed;
  const s = Math.sin(t * 1.1), s2 = Math.sin(t * 1.7);
  const glitch = (t % 3.7) < .14 ? 1 : 0;
  add(pose, M.HIPS, .06 * s);
  add(pose, M.CHEST, -.12 * s, 0, 0, 1, 1 + Math.sin(t * 2) * .008);
  add(pose, M.HEAD, .1 * s + .38 * glitch);
  add(pose, M.ARM_L, .14 * s2); add(pose, M.ARM_R, -.14 * s2);
  add(pose, M.LEG_L, -.03 * s); add(pose, M.LEG_R, .03 * s);
  if (glitch) add(pose, M.ROOT, 0, .012, 0, .95, 1);
  const e = windupOf(input);
  if (e > 0) {
    // Arms open wide as one reflection; the body stretches too tall; the head tilts.
    const tremble = Math.sin(t * 47) * .02 * e;
    add(pose, M.ROOT, 0, 0, 0, 1 - .05 * e, 1 + .08 * e);
    add(pose, M.CHEST, -fwd * .1 * e);
    add(pose, M.HEAD, .32 * e);
    add(pose, M.ARM_L, .95 * e + tremble); add(pose, M.ARM_R, -.95 * e - tremble);
  }
  const out = strikeOf(input);
  if (out > 0) {
    add(pose, M.ROOT, 0, fwd * .12 * out, 0, 1 + .05 * out, 1 - .04 * out);
    add(pose, M.CHEST, fwd * .2 * out);
    add(pose, M.HEAD, fwd * .1 * out);
    add(pose, M.ARM_L, -fwd * 1.1 * out); add(pose, M.ARM_R, -fwd * 1.1 * out);
    add(pose, M.LEG_L, -fwd * .2 * out); add(pose, M.LEG_R, fwd * .25 * out);
  }
  const h = input.hurt;
  if (h > 0) {
    // Cracks: a lateral judder, the chest thrown back, the head knocked askew.
    add(pose, M.ROOT, 0, Math.sin(t * 60) * .03 * h);
    add(pose, M.CHEST, -fwd * .14 * h);
    add(pose, M.HEAD, .28 * h);
  }
}

// ── Rootglass Stag: an antlered quadruped of roots and glass leaves. Faces right.
export const STAG = { ROOT: 0, BODY: 1, NECK: 2, HEAD: 3, ANTLERS: 4, LEGS_F: 5, LEGS_B: 6 } as const;
export const STAG_RIG: RigSpec = {
  cols: [0, .16, .28, .4, .5, .6, .7, .82, 1],
  rows: [0, .12, .22, .32, .42, .52, .62, .74, .86, 1],
  bones: [
    { name: 'root', parent: -1, px: .5, py: .92, ax: 0, ay: 0, bx: 0, by: 0, r: 0 },
    { name: 'body', parent: 0, px: .48, py: .55, ax: .28, ay: .5, bx: .62, by: .5, r: .12 },
    { name: 'neck', parent: 1, px: .58, py: .46, ax: .57, ay: .34, bx: .6, by: .46, r: .06 },
    { name: 'head', parent: 2, px: .6, py: .34, ax: .6, ay: .26, bx: .63, by: .36, r: .05 },
    { name: 'antlers', parent: 3, px: .6, py: .26, ax: .3, ay: .12, bx: .88, by: .12, r: .14 },
    { name: 'legsFront', parent: 1, px: .6, py: .6, ax: .56, ay: .66, bx: .66, by: .92, r: .08 },
    { name: 'legsBack', parent: 1, px: .32, py: .6, ax: .24, ay: .66, bx: .38, by: .92, r: .08 },
  ],
};
/** Head-lowering charge: the wind-up drops the antlers level and paws the ground; the strike drives forward. */
export function poseStag(pose: Float32Array, input: CreaturePoseInput): void {
  resetPose(pose);
  if (input.reduced) return;
  const S = STAG, fwd = 1, t = input.time + input.seed;
  const breath = Math.sin(t * 1.8);
  add(pose, S.BODY, 0, 0, -breath * .004, 1 + breath * .01, 1 + breath * .014);
  add(pose, S.NECK, fwd * .05 * Math.sin(t * .7));
  add(pose, S.HEAD, (Math.sin(t * 2.9) > .92 ? .06 : 0) + Math.sin(t * 1.1) * .02);
  add(pose, S.ANTLERS, Math.sin(t * 1.3) * .015);
  const e = windupOf(input);
  if (e > 0) {
    const paw = Math.max(0, Math.sin(t * 9)) * e;
    add(pose, S.ROOT, 0, -fwd * .04 * e, 0, 1 + .03 * e, 1 - .05 * e);
    add(pose, S.BODY, -fwd * .04 * e);
    add(pose, S.NECK, fwd * .36 * e);
    add(pose, S.HEAD, fwd * .26 * e);
    add(pose, S.LEGS_F, -fwd * .28 * paw, 0, -.02 * paw);
  }
  const out = strikeOf(input);
  if (out > 0) {
    add(pose, S.ROOT, 0, fwd * .16 * out, 0, 1 + .06 * out, 1 - .03 * out);
    add(pose, S.BODY, fwd * .06 * out);
    add(pose, S.NECK, fwd * .4 * out);
    add(pose, S.HEAD, fwd * .25 * out);
    add(pose, S.LEGS_F, -fwd * .3 * out); add(pose, S.LEGS_B, fwd * .35 * out);
  }
  const h = input.hurt;
  if (h > 0) {
    // Rears: the head tosses up and the weight drops onto the haunches.
    add(pose, S.NECK, -fwd * .26 * h);
    add(pose, S.HEAD, -fwd * .16 * h);
    add(pose, S.BODY, -fwd * .05 * h);
  }
}

/** Rivet Maw keeps its original driver; hits add a backward recoil. Faces left. */
function poseRivetMaw(pose: Float32Array, input: CreaturePoseInput): void {
  poseMaw(pose, input);
  if (input.reduced || input.hurt <= 0) return;
  const fwd = -1, h = input.hurt;
  add(pose, MAW.ROOT, -fwd * .06 * h);
  add(pose, MAW.BODY, 0, -fwd * .04 * h);
  add(pose, MAW.HEAD, -fwd * .12 * h);
}

// ── Generic: four bones, no anatomy assumed. Any painting reads as alive with it.
export const GENERIC = { ROOT: 0, BASE: 1, BODY: 2, TOP: 3 } as const;
export const GENERIC_RIG: RigSpec = {
  cols: [0, .2, .4, .6, .8, 1],
  rows: [0, .2, .4, .6, .8, 1],
  bones: [
    { name: 'root', parent: -1, px: .5, py: .95, ax: 0, ay: 0, bx: 0, by: 0, r: 0 },
    { name: 'base', parent: 0, px: .5, py: .78, ax: .2, ay: .78, bx: .8, by: .86, r: .18 },
    { name: 'body', parent: 1, px: .5, py: .6, ax: .3, ay: .48, bx: .7, by: .6, r: .18 },
    { name: 'top', parent: 2, px: .5, py: .4, ax: .3, ay: .15, bx: .7, by: .35, r: .18 },
  ],
};
function poseGeneric(pose: Float32Array, input: CreaturePoseInput): void {
  resetPose(pose);
  if (input.reduced) return;
  const G = GENERIC, fwd = -1, t = input.time + input.seed;
  const breath = Math.sin(t * 2.6);
  add(pose, G.BODY, 0, 0, -breath * .005, 1 + breath * .012, 1 + breath * .018);
  add(pose, G.TOP, Math.sin(t * 1.5) * .03);
  const e = windupOf(input);
  if (e > 0) {
    add(pose, G.ROOT, 0, -fwd * .04 * e, 0, 1 + .06 * e, 1 - .1 * e);
    add(pose, G.TOP, -fwd * .14 * e + Math.sin(t * 50) * .01 * e);
  }
  const out = strikeOf(input);
  if (out > 0) {
    add(pose, G.ROOT, 0, fwd * .12 * out, 0, 1 + .08 * out, 1 - .06 * out);
    add(pose, G.TOP, fwd * .18 * out);
  }
  if (input.hurt > 0) add(pose, G.ROOT, -fwd * .07 * input.hurt, -fwd * .03 * input.hurt);
}

export const RIVET_MAW_CREATURE: CreatureRigDef = {
  key: 'rivet-maw', spec: MAW_RIG, facesLeft: true, box: { w: 140, h: 110 }, ground: 1, shadow: 54, pose: poseRivetMaw,
};
export const GENERIC_CREATURE: CreatureRigDef = {
  key: 'generic', spec: GENERIC_RIG, facesLeft: true, box: { w: 140, h: 120 }, ground: .95, shadow: 50, pose: poseGeneric,
};
export const CREATURE_RIGS: Readonly<Record<string, CreatureRigDef>> = {
  'rivet-maw': RIVET_MAW_CREATURE,
  'prism-forager': { key: 'prism-forager', spec: FORAGER_RIG, facesLeft: false, box: { w: 130, h: 160 }, ground: .9, shadow: 36, pose: poseForager },
  'ephemeris-leech': { key: 'ephemeris-leech', spec: LEECH_RIG, facesLeft: true, box: { w: 150, h: 130 }, ground: .87, shadow: 58, pose: poseLeech },
  'mirror-substitute': { key: 'mirror-substitute', spec: MIRROR_RIG, facesLeft: true, box: { w: 140, h: 175 }, ground: .91, shadow: 34, pose: poseMirror },
  'rootglass-stag': { key: 'rootglass-stag', spec: STAG_RIG, facesLeft: false, box: { w: 165, h: 165 }, ground: .93, shadow: 62, pose: poseStag },
};

/** The rig for a MonsterDef's `creature` art key; unknown keys get the generic body. */
export function creatureRigFor(key: string | undefined): CreatureRigDef {
  return (key && Object.prototype.hasOwnProperty.call(CREATURE_RIGS, key)) ? CREATURE_RIGS[key] : GENERIC_CREATURE;
}
