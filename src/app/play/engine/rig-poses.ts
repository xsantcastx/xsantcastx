import { POSE_STRIDE, resetPose, RigSpec, Spring, stepSpring } from './rig';

/**
 * Bone layouts for the two painted figures and the pose drivers that animate them.
 * Coordinates are normalised to the painting (u right, v down). Both paintings
 * are square; the Keeper faces the viewer, the Rivet Maw faces left.
 * Visual only: these functions read presentation timers and never write game state.
 */

export const KEEPER = { ROOT: 0, HIPS: 1, SPINE: 2, CHEST: 3, HEAD: 4, ARM_F: 5, ARM_B: 6, LEG_F: 7, LEG_B: 8, CAPE_F: 9, CAPE_B: 10, HEM: 11 } as const;
/** Where the Keeper's front hand is painted — the blade attaches here. */
export const KEEPER_HAND = { u: .665, v: .48 };

/** 8 × 9 cells = 144 triangles, denser around the shoulders, belt and knees. */
export const KEEPER_RIG: RigSpec = {
  cols: [0, .2, .3, .4, .5, .6, .7, .8, 1],
  rows: [0, .12, .22, .32, .42, .52, .62, .74, .87, 1],
  bones: [
    { name: 'root', parent: -1, px: .5, py: .96, ax: 0, ay: 0, bx: 0, by: 0, r: 0 },
    { name: 'hips', parent: 0, px: .5, py: .5, ax: .5, ay: .44, bx: .5, by: .56, r: .11 },
    { name: 'spine', parent: 1, px: .5, py: .42, ax: .5, ay: .32, bx: .5, by: .44, r: .11 },
    { name: 'chest', parent: 2, px: .5, py: .3, ax: .44, ay: .2, bx: .56, by: .3, r: .1 },
    { name: 'head', parent: 3, px: .5, py: .19, ax: .5, ay: .02, bx: .5, by: .15, r: .08 },
    { name: 'armFront', parent: 3, px: .64, py: .21, ax: .66, ay: .24, bx: .68, by: .5, r: .07 },
    { name: 'armBack', parent: 3, px: .36, py: .21, ax: .34, ay: .24, bx: .32, by: .5, r: .07 },
    { name: 'legFront', parent: 1, px: .56, py: .6, ax: .57, ay: .66, bx: .6, by: 1, r: .06 },
    { name: 'legBack', parent: 1, px: .44, py: .6, ax: .43, ay: .66, bx: .4, by: 1, r: .06 },
    { name: 'capeFront', parent: 1, px: .6, py: .5, ax: .68, ay: .58, bx: .76, by: .86, r: .08 },
    { name: 'capeBack', parent: 1, px: .4, py: .5, ax: .32, ay: .58, bx: .24, by: .86, r: .08 },
    { name: 'hem', parent: 1, px: .5, py: .55, ax: .5, ay: .62, bx: .5, by: .88, r: .06 },
  ],
};

export const MAW = { ROOT: 0, BODY: 1, BACK: 2, HEAD: 3, JAW: 4, LEGS_F: 5, LEGS_B: 6 } as const;
/** 7 × 7 cells = 98 triangles. Head and jaw sit low on the left of the painting. */
export const MAW_RIG: RigSpec = {
  cols: [0, .14, .26, .38, .52, .66, .8, 1],
  rows: [0, .2, .36, .5, .62, .74, .88, 1],
  bones: [
    { name: 'root', parent: -1, px: .55, py: .95, ax: 0, ay: 0, bx: 0, by: 0, r: 0 },
    { name: 'body', parent: 0, px: .55, py: .62, ax: .42, ay: .42, bx: .7, by: .42, r: .15 },
    { name: 'back', parent: 1, px: .68, py: .5, ax: .74, ay: .3, bx: .86, by: .55, r: .12 },
    { name: 'head', parent: 1, px: .36, py: .52, ax: .14, ay: .46, bx: .3, by: .5, r: .1 },
    { name: 'jaw', parent: 3, px: .3, py: .6, ax: .12, ay: .62, bx: .28, by: .66, r: .06 },
    { name: 'legsFront', parent: 0, px: .3, py: .68, ax: .16, ay: .8, bx: .42, by: .86, r: .09 },
    { name: 'legsBack', parent: 0, px: .76, py: .62, ax: .72, ay: .74, bx: .86, by: .82, r: .09 },
  ],
};

function set(pose: Float32Array, bone: number, rot: number, tx = 0, ty = 0, sx = 1, sy = 1): void {
  const o = bone * POSE_STRIDE;
  pose[o] += rot; pose[o + 1] += tx; pose[o + 2] += ty; pose[o + 3] *= sx; pose[o + 4] *= sy;
}
const clamp = (value: number, low: number, high: number): number => value < low ? low : value > high ? high : value;

/** Per-figure secondary motion: cape, hem and head springs, driven by velocity. */
export interface KeeperMotion {
  trail: Spring; flare: Spring; hem: Spring; head: Spring;
  lastX: number; lastY: number; vx: number; vy: number; ax: number; primed: boolean;
}
export function createKeeperMotion(): KeeperMotion {
  return { trail: { x: 0, v: 0 }, flare: { x: 0, v: 0 }, hem: { x: 0, v: 0 }, head: { x: 0, v: 0 }, lastX: 0, lastY: 0, vx: 0, vy: 0, ax: 0, primed: false };
}
/**
 * Feed the figure's world position for this frame. Velocity and acceleration are
 * derived from the motion itself, so peers (who only send positions) move the
 * same way the player does. A teleport (portal, respawn) resets the springs.
 */
export function trackKeeper(m: KeeperMotion, x: number, y: number, dt: number): void {
  if (!m.primed || dt <= 0 || Math.abs(x - m.lastX) > 160 || Math.abs(y - m.lastY) > 220) {
    m.lastX = x; m.lastY = y; m.vx = 0; m.vy = 0; m.ax = 0; m.primed = true;
    m.trail.x = m.trail.v = m.flare.x = m.flare.v = m.hem.x = m.hem.v = m.head.x = m.head.v = 0;
    return;
  }
  const blend = 1 - Math.exp(-18 * dt);
  const vx = clamp((x - m.lastX) / dt, -900, 900), vy = clamp((y - m.lastY) / dt, -1400, 1400);
  const nextVx = m.vx + (vx - m.vx) * blend;
  m.ax += (clamp((nextVx - m.vx) / dt, -9000, 9000) - m.ax) * blend;
  m.vx = nextVx; m.vy += (vy - m.vy) * blend;
  m.lastX = x; m.lastY = y;
}

export interface KeeperPoseInput {
  animation: string | undefined;
  time: number;
  /** Attack progress 0..1 (0 = not attacking) and the derived swing -1..1. */
  attackT: number; swing: number;
  /** Landing squash 0..1, hurt recoil 0..1. */
  landing: number; recoil: number;
  /** +1 / -1: which way the figure is drawn, to turn world velocity into "forward". */
  facing: number;
  dt: number;
  reduced: boolean;
}

/** Write the Keeper's bone pose for this frame. Reduced motion = the painting at rest. */
export function poseKeeper(pose: Float32Array, m: KeeperMotion, input: KeeperPoseInput): void {
  resetPose(pose);
  if (input.reduced) return;
  const K = KEEPER, t = input.time;
  const forward = m.vx * input.facing;
  const U = 1 / 156; // world px → sprite units at the player's drawn size
  switch (input.animation) {
    case 'run': {
      const phase = t * 9, lift = Math.sin(phase), roll = Math.cos(phase);
      set(pose, K.ROOT, 0, 0, (lift > 0 ? -lift * 9 : lift * 1.5) * U, 1 + Math.max(0, -lift) * .04, 1 - Math.max(0, -lift) * .05);
      set(pose, K.HIPS, .07 + roll * .05);
      set(pose, K.SPINE, -roll * .045);
      set(pose, K.CHEST, .03 - roll * .03);
      set(pose, K.HEAD, -.08 + roll * .02);
      set(pose, K.LEG_F, lift * .34); set(pose, K.LEG_B, -lift * .34);
      set(pose, K.ARM_F, -lift * .24); set(pose, K.ARM_B, lift * .24);
      break;
    }
    case 'jump':
      set(pose, K.ROOT, -.04, 0, -4 * U, .95, 1.07);
      set(pose, K.CHEST, -.04);
      set(pose, K.ARM_F, -.45); set(pose, K.ARM_B, .4);
      set(pose, K.LEG_F, -.32); set(pose, K.LEG_B, .14);
      break;
    case 'fall':
      set(pose, K.ROOT, .05, 0, 2 * U, 1.04, .95);
      set(pose, K.ARM_F, -.62); set(pose, K.ARM_B, .62);
      set(pose, K.LEG_F, -.12); set(pose, K.LEG_B, .2);
      set(pose, K.HEAD, .05);
      break;
    case 'attack': {
      const s = input.swing;
      // Anticipation: weight back, arm cocked behind. Strike: lunge, arm sweeps
      // forward and up. Follow-through: the swing value eases back to zero.
      const strike = Math.max(0, s), wind = Math.max(0, -s);
      set(pose, K.ROOT, 0, (strike * .055 - wind * .025), -strike * 2 * U);
      set(pose, K.HIPS, strike * .06 - wind * .05);
      set(pose, K.CHEST, strike * .14 - wind * .1);
      set(pose, K.HEAD, -strike * .06 + wind * .04);
      set(pose, K.ARM_F, wind * .55 - strike * 1.25);
      set(pose, K.ARM_B, strike * .42 - wind * .2);
      set(pose, K.LEG_F, -strike * .22 + wind * .08); set(pose, K.LEG_B, strike * .16);
      break;
    }
    case 'dodge':
      set(pose, K.ROOT, .2, .04, 2 * U, 1.06, .92);
      set(pose, K.CHEST, .1);
      set(pose, K.HEAD, -.06);
      set(pose, K.ARM_F, .2); set(pose, K.ARM_B, .35);
      set(pose, K.LEG_F, -.25); set(pose, K.LEG_B, .3);
      break;
    case 'hurt': {
      const k = input.recoil;
      set(pose, K.ROOT, -.06 * k, -.04 * k, U, 1.04, .95);
      set(pose, K.CHEST, -.16 * k);
      set(pose, K.HEAD, -.14 * k);
      set(pose, K.ARM_F, .35 * k); set(pose, K.ARM_B, -.3 * k);
      break;
    }
    case 'rest': {
      const rock = Math.sin(t * 1.1), breath = Math.sin(t * 1.6);
      set(pose, K.ROOT, rock * .012, rock * .004, rock * .6 * U, 1.02, .985);
      set(pose, K.CHEST, 0, 0, -breath * .004, 1 + breath * .008, 1);
      set(pose, K.HEAD, .06 + rock * .015);
      break;
    }
    default: {
      // Idle: the chest rises with breath, the head drifts a few degrees.
      const breath = Math.sin(t * 2.2);
      set(pose, K.CHEST, 0, 0, -breath * .005, 1 + breath * .012, 1 + breath * .008);
      set(pose, K.SPINE, 0, 0, 0, 1, 1 + breath * .006);
      set(pose, K.HEAD, Math.sin(t * 1.3) * .035, 0, -breath * .003);
      set(pose, K.ARM_F, -breath * .025); set(pose, K.ARM_B, breath * .025);
    }
  }
  if (input.landing > 0) {
    const squash = .1 * input.landing;
    set(pose, K.ROOT, 0, 0, squash * 6 * U, 1 + squash, 1 - squash);
    set(pose, K.ARM_F, -squash * 1.5); set(pose, K.ARM_B, squash * 1.5);
  }

  // Secondary motion. The cape trails forward speed, flares while falling, and
  // the head lags behind acceleration; the hem follows the cape a beat later.
  const dt = input.dt;
  stepSpring(m.trail, clamp(forward * .0011, -.4, .45), 9, .45, dt);
  stepSpring(m.flare, clamp(m.vy * .00035, -.12, .32), 7, .5, dt);
  stepSpring(m.hem, m.trail.x * .7, 6, .55, dt);
  stepSpring(m.head, clamp(-m.ax * input.facing * .00004, -.14, .14), 14, .6, dt);
  const sway = Math.sin(t * 1.7) * .02;
  set(pose, K.CAPE_F, m.trail.x - m.flare.x + sway);
  set(pose, K.CAPE_B, m.trail.x + m.flare.x + sway);
  set(pose, K.HEM, m.hem.x * .8 + sway * .5);
  set(pose, K.HEAD, m.head.x);
}

export interface MawPoseInput {
  phase: 'idle' | 'windup' | 'strike' | 'recover';
  /** Seconds left in the current phase. */
  timer: number;
  time: number;
  /** Per-creature offset so three Maws do not breathe in unison. */
  seed: number;
  reduced: boolean;
}
const WINDUP = .85, STRIKE = .2, RECOVER = 1.1;

/** Rivet Maw: idle breathing, wind-up coil, strike lunge with the jaw thrown open. */
export function poseMaw(pose: Float32Array, input: MawPoseInput): void {
  resetPose(pose);
  if (input.reduced) return;
  const M = MAW, t = input.time + input.seed;
  const breath = Math.sin(t * 3);
  // Art faces left: forward is -x, "head down" is a negative rotation.
  set(pose, M.BODY, 0, 0, -breath * .006, 1 + breath * .012, 1 + breath * .02);
  set(pose, M.BACK, breath * .015);
  set(pose, M.HEAD, Math.sin(t * 1.7) * .03);
  set(pose, M.JAW, -(breath + 1) * .02);
  if (input.phase === 'windup') {
    const p = clamp(1 - input.timer / WINDUP, 0, 1), e = p * p * (3 - 2 * p);
    const tremble = Math.sin(t * 55) * .005 * e;
    set(pose, M.ROOT, 0, 0, 0, 1 + .06 * e, 1 - .1 * e);
    set(pose, M.BODY, -.07 * e, .07 * e + tremble, .02 * e);
    set(pose, M.BACK, .1 * e);
    set(pose, M.HEAD, -.12 * e, .02 * e);
    set(pose, M.JAW, -.08 * e);
  } else if (input.phase === 'strike' || input.phase === 'recover') {
    // The lunge snaps out over the strike and eases home through the recovery.
    const home = clamp(1 - input.timer / RECOVER, 0, 1);
    const out = input.phase === 'strike'
      ? 1 - Math.pow(clamp(input.timer / STRIKE, 0, 1), 3)
      : 1 - home * home * (3 - 2 * home);
    set(pose, M.ROOT, 0, 0, 0, 1 + .08 * out, 1 - .06 * out);
    set(pose, M.BODY, .05 * out, -.13 * out, -.015 * out);
    set(pose, M.BACK, -.06 * out);
    set(pose, M.HEAD, .1 * out, -.05 * out);
    set(pose, M.JAW, -.48 * out);
    set(pose, M.LEGS_F, .14 * out);
    set(pose, M.LEGS_B, -.1 * out);
  }
}
