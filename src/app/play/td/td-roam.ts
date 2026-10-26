/**
 * td-roam.ts — the companions roam (owner, 2026-10-26: pets and summons should wander 3-8 tiles from the Keeper,
 * exploring and hunting nearby, and come back when he walks off or calls them).
 *
 * One small state machine per companion (the pet, a raised skeleton, a called beast):
 *   travel  the Keeper is on the move: the formation as before (td-sight formationSpot);
 *   roam    he has stood still a moment: stroll to a point 3-8 tiles from him on open, visible ground, pause, sniff,
 *           pick another;
 *   hunt    a creature within HUNT of him (and in the companion's sight - the caller picks it): go fight it;
 *   return  he walked more than WALK_AWAY from where he stood, or called them, or the companion is past the leash:
 *           run back into formation.
 * Pure: no DOM, no engine. The caller walks (its own free() and combat code) and passes `rng` so tests are repeatable.
 */
import { TILE } from './td-art';

export const ROAM = {
  /** Seconds the Keeper stands still before the companions may roam. */
  calmAfter: 1.5,
  /** A roam point lies this far from the Keeper (art px). */
  minR: 3 * TILE, maxR: 8 * TILE,
  /** A foe this close to the Keeper is hunted; while he is calling them, only one this close. */
  huntR: 8 * TILE, calledHuntR: 3 * TILE,
  /** He has left where he stood once he is this far from it; a companion further than FALL from him then runs back. */
  walkAway: 3 * TILE, fall: 6 * TILE, calmHome: 6 * TILE,
  /** A relaxed stroll's share of the companion's pace. */
  pace: .55,
  /** Seconds it sniffs at a point before the next, and the longest it walks to one before giving up (a wall). */
  pauseMin: 1.2, pauseMax: 3.6, giveUp: 7,
  /** Seconds a call keeps them at heel. */
  heelFor: 12,
  /** Within this of a point it has arrived. */
  arrive: 3,
} as const;

export type RoamMode = 'travel' | 'roam' | 'hunt' | 'return';
type Pt = { x: number; y: number };

/** Where the Keeper stands: "calm" once he has held still a moment, until he walks WALK_AWAY from that spot. */
export class Stand {
  still = 0;
  anchor: Pt | null = null;
  get calm(): boolean { return !!this.anchor; }
  update(k: Pt, dt: number, moving: boolean): void {
    if (moving) {
      this.still = 0;
      if (this.anchor && Math.hypot(k.x - this.anchor.x, k.y - this.anchor.y) > ROAM.walkAway) this.anchor = null;
    } else {
      this.still += dt;
      if (!this.anchor && this.still >= ROAM.calmAfter) this.anchor = { x: k.x, y: k.y };
    }
  }
  reset(): void { this.still = 0; this.anchor = null; }
}

export interface RoamState { mode: RoamMode; has: boolean; gx: number; gy: number; pause: number; walkT: number }
export function newRoam(): RoamState { return { mode: 'travel', has: false, gx: 0, gy: 0, pause: 0, walkT: 0 }; }

export interface RoamIn {
  me: Pt; keeper: Pt; stand: Pick<Stand, 'calm'>; dt: number;
  /** The foe the caller would fight (its own sight/leash pick), if any. */
  foe: Pt | null;
  /** The Keeper called them: heel. */
  called: boolean;
  free: (x: number, y: number) => boolean;
  sees: (ax: number, ay: number, bx: number, by: number) => boolean;
  rng: () => number;
}
export interface RoamOut {
  mode: RoamMode;
  /** Roam: the point to stroll to; null otherwise (use the formation or the foe). */
  goal: Pt | null;
  /** Roam: sitting at a point, sniffing - do not move. */
  idle: boolean;
  /** Share of the companion's pace for the stroll (1 otherwise). */
  pace: number;
}

export function stepRoam(s: RoamState, i: RoamIn): RoamOut {
  const dK = Math.hypot(i.me.x - i.keeper.x, i.me.y - i.keeper.y);
  const calm = i.stand.calm && !i.called;
  const huntR = i.called ? ROAM.calledHuntR : ROAM.huntR;
  if (i.foe && Math.hypot(i.foe.x - i.keeper.x, i.foe.y - i.keeper.y) <= huntR) {
    s.mode = 'hunt'; s.has = false;
    return { mode: 'hunt', goal: null, idle: false, pace: 1 };
  }
  // Back to him: called, past the roam range, or he left while it was out beyond FALL; it keeps running until near.
  const home = calm ? ROAM.calmHome : ROAM.walkAway;
  const back = i.called || (s.mode === 'return' ? dK > home : dK > (calm ? ROAM.maxR : ROAM.fall));
  if (back) { s.mode = 'return'; s.has = false; return { mode: 'return', goal: null, idle: false, pace: 1 }; }
  if (!calm) { s.mode = 'travel'; s.has = false; return { mode: 'travel', goal: null, idle: false, pace: 1 }; }
  // Calm and in range: stroll.
  if (s.mode !== 'roam') { s.mode = 'roam'; s.has = false; s.pause = .3 + i.rng() * .9; }
  if (s.has) {
    s.walkT += i.dt;
    if (Math.hypot(s.gx - i.me.x, s.gy - i.me.y) <= ROAM.arrive || s.walkT > ROAM.giveUp) { s.has = false; s.pause = ROAM.pauseMin + i.rng() * (ROAM.pauseMax - ROAM.pauseMin); }
    else return { mode: 'roam', goal: { x: s.gx, y: s.gy }, idle: false, pace: ROAM.pace };
  }
  s.pause -= i.dt;
  if (s.pause <= 0) {
    for (let t = 0; t < 6; t++) {
      const a = i.rng() * Math.PI * 2, r = ROAM.minR + i.rng() * (ROAM.maxR - ROAM.minR);
      const x = i.keeper.x + Math.cos(a) * r, y = i.keeper.y + Math.sin(a) * r;
      if (i.free(x, y) && i.sees(i.me.x, i.me.y, x, y) && i.sees(i.keeper.x, i.keeper.y, x, y)) { s.has = true; s.gx = x; s.gy = y; s.walkT = 0; break; }
    }
    if (!s.has) s.pause = 1;
    else return { mode: 'roam', goal: { x: s.gx, y: s.gy }, idle: false, pace: ROAM.pace };
  }
  return { mode: 'roam', goal: null, idle: true, pace: 0 };
}
