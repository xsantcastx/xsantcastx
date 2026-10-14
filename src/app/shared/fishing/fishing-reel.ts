/**
 * fishing-reel.ts: "Line Tension", the reel mini-game, as pure functions.
 * No imports, no Angular: the component (line-tension.component.ts) drives a
 * clock and calls these; the specs pin the numbers. Spec: delve-and-beyond.md §5.1.
 *
 * One bar. A fish marker drifts along it on a smooth path fixed by the cast's
 * seed. Holding raises the catch window (it accelerates up the bar); letting
 * go lets it fall. Time the fish spends inside the window fills the ring; the
 * reel lasts 2.5–4 s by the catch's rarity. The grade comes from the share of
 * the time inside: Perfect ≥ 90%, Good ≥ 60%, Off below.
 *
 * The contract is the anvil's: playing can only improve the result, never fail
 * it. There is no fail state anywhere in this file. Once hooked, the fish is
 * landed (`reelResult` always says so); the grade only adds XP and, Perfect,
 * a crate step (fishing.model.ts GRADE_XP, crateStep).
 */
import type { CatchRarity, ReelGrade } from './fishing.model';

/** The catch window's width (a share of the bar), before the skill's and the Lodge Reel's widening. */
export const REEL_WINDOW = .28;
/** How hard holding lifts the window, and how fast it falls when let go (bar widths per s²). */
export const REEL_LIFT = 3.2;
export const REEL_FALL = 2.6;
/** The window's top speed (bar widths per s). */
export const REEL_MAX_SPEED = 1.1;

/** Seconds a reel lasts, by what is on the line. */
export function reelDuration(rarity: CatchRarity): number {
  return rarity === 'legendary' ? 4 : rarity === 'rare' || rarity === 'quest' ? 3.5 : rarity === 'uncommon' || rarity === 'crate' ? 3 : 2.5;
}

export interface ReelState {
  /** Seconds played and the reel's length. */
  t: number;
  duration: number;
  /** The window's centre (0..1) and speed. */
  window: number;
  speed: number;
  width: number;
  /** The fish's position (0..1), and seconds it has spent inside the window. */
  fish: number;
  inside: number;
  seed: number;
}

/** mulberry32's mix, for the path's fixed phases. */
function unit(seed: number, n: number): number {
  let a = (seed + Math.imul(n + 1, 0x6d2b79f5)) >>> 0;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

/** The fish's position at `t` seconds: two slow waves and a quicker wobble, fixed by the seed. 0..1. */
export function fishAt(seed: number, t: number, rarity: CatchRarity = 'common'): number {
  const lively = rarity === 'legendary' ? 1.5 : rarity === 'rare' || rarity === 'quest' ? 1.25 : 1;
  const a = (.7 + unit(seed, 1) * .5) * lively, b = (1.6 + unit(seed, 2) * .9) * lively;
  const p1 = unit(seed, 3) * Math.PI * 2, p2 = unit(seed, 4) * Math.PI * 2;
  const x = .5 + .3 * Math.sin(a * t + p1) + .12 * Math.sin(b * t + p2);
  return Math.min(1, Math.max(0, x));
}

/** A fresh reel for a hooked catch. `widen`: the skill's window perk plus the Lodge Reel (shares of the bar). */
export function reelStart(seed: number, rarity: CatchRarity, widen = 0): ReelState {
  const width = Math.min(.6, REEL_WINDOW * (1 + Math.max(0, widen)));
  return { t: 0, duration: reelDuration(rarity), window: .5, speed: 0, width, fish: fishAt(seed >>> 0, 0, rarity), inside: 0, seed: seed >>> 0 };
}

/** Advance the reel by `dt` seconds, holding or not. Returns true when the reel is over. Mutates `s`. */
export function reelStep(s: ReelState, dt: number, holding: boolean, rarity: CatchRarity = 'common'): boolean {
  if (s.t >= s.duration) return true;
  const step = Math.max(0, Math.min(dt, s.duration - s.t));
  s.speed += (holding ? REEL_LIFT : -REEL_FALL) * step;
  s.speed = Math.max(-REEL_MAX_SPEED, Math.min(REEL_MAX_SPEED, s.speed));
  s.window += s.speed * step;
  const half = s.width / 2;
  // The window stops at the bar's ends (and loses its speed there, so it does not stick).
  if (s.window < half) { s.window = half; s.speed = Math.max(0, s.speed); }
  if (s.window > 1 - half) { s.window = 1 - half; s.speed = Math.min(0, s.speed); }
  s.t += step;
  s.fish = fishAt(s.seed, s.t, rarity);
  if (Math.abs(s.fish - s.window) <= half) s.inside += step;
  return s.t >= s.duration;
}

/** How full the ring is, 0..1 (time inside over the reel's length). */
export function reelRing(s: ReelState): number { return s.duration > 0 ? Math.min(1, s.inside / s.duration) : 0; }

/** The result: always landed; the grade by the share of time inside. */
export function reelResult(s: ReelState): { landed: true; inside: number; grade: ReelGrade } {
  const inside = s.duration > 0 ? Math.min(1, s.inside / s.duration) : 0;
  return { landed: true, inside, grade: inside >= .9 ? 'perfect' : inside >= .6 ? 'good' : 'off' };
}

/** Reduced motion (and auto-fish): one press, a fixed middling quality: the Off grade, the baseline. */
export const REEL_STILL_QUALITY = .5;
