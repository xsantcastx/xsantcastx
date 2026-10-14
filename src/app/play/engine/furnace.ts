/**
 * furnace.ts — the Banked Furnace's fight, as a pure state machine (Phase 8;
 * docs/world/delve-and-beyond.md §7.4; lore: lore-addendum.md, "The Four Who
 * Went Down": "It never moves. It pulls. It is a promise kept so long it
 * forgot who it was kept for.").
 *
 * Readable and fair, in three rules a player learns in the first minute:
 *
 *   1. BANKED: it cannot be hurt. Its four vents burn on the hall floor; pour
 *      water on each (a Seam Bucket from the Four's quench trough) to douse it.
 *   2. It BREATHES IN every few seconds, telegraphed a beat early (the vents
 *      flare, embers stream toward the mouth): for INHALE seconds it pulls the
 *      Keeper and loose drops toward its mouth — slower than walking, so
 *      walking away always wins — and the mouth itself burns. Each breath
 *      spills Banked Embers (awake) until there are three.
 *   3. With all four vents out its core is OPEN for OPEN_FOR seconds: strike
 *      it. Then it banks itself again: the vents relight and the trough
 *      refills, and the cycle starts over. Under half its strength it
 *      REMEMBERS: it breathes sooner and harder and spills two at a time.
 *
 * The engine owns positions, the vents' cells and the creatures; this file
 * only decides what happens when.
 */

export const FURNACE_TUNING = {
  /** Seconds between breaths (calm / remembering), the warning before one, and how long it pulls. */
  every: 6.5, everyEnraged: 4.6, warn: .9, inhale: 2.6,
  /** Pull at the mouth, px/s (the Keeper walks 191 in the Delve: always more than this). */
  pull: 118, pullEnraged: 150,
  /** How far the pull reaches (px either side of the mouth), and how close the mouth burns. */
  reach: 560, burn: 60,
  /** Share of max HP a second the mouth takes while it breathes in. */
  burnShare: .12,
  /** Seconds the core stays open once all four vents are out. */
  openFor: 12,
  /** Most Banked Embers it keeps out at once. */
  embers: 3,
} as const;

export type FurnacePhase = 'banked' | 'open';

export interface FurnaceState {
  phase: FurnacePhase;
  /** Vents doused this banking (four). */
  doused: boolean[];
  /** Seconds until the next breath starts (counting the warning), and seconds of breath left (0: not breathing). */
  next: number;
  inhale: number;
  /** Seconds the core stays open (phase 'open'). */
  open: number;
  /** Under half strength. */
  enraged: boolean;
}

export function newFurnace(): FurnaceState {
  return { phase: 'banked', doused: [false, false, false, false], next: FURNACE_TUNING.every * .6, inhale: 0, open: 0, enraged: false };
}

export interface FurnaceTick {
  /** A breath began this step: spill this many embers (the engine caps by what is out). */
  spill: number;
  /** The warning began (a beat before a breath). */
  warn: boolean;
  /** The core just opened (all four vents out). */
  opened: boolean;
  /** It banked itself again: relight the vents, refill the trough. */
  rebanked: boolean;
  /** It just started remembering (under half strength). */
  enraged: boolean;
}

/** One fixed step. `hpShare` 0..1 is what is left of it. Pure apart from `s`. */
export function stepFurnace(s: FurnaceState, dt: number, hpShare: number): FurnaceTick {
  const out: FurnaceTick = { spill: 0, warn: false, opened: false, rebanked: false, enraged: false };
  if (!s.enraged && hpShare <= .5) { s.enraged = true; out.enraged = true; }
  if (s.inhale > 0) s.inhale = Math.max(0, s.inhale - dt);
  else {
    const before = s.next;
    s.next -= dt;
    if (before > FURNACE_TUNING.warn && s.next <= FURNACE_TUNING.warn) out.warn = true;
    if (s.next <= 0) {
      s.inhale = FURNACE_TUNING.inhale;
      s.next = s.enraged ? FURNACE_TUNING.everyEnraged : FURNACE_TUNING.every;
      out.spill = s.enraged ? 2 : 1;
    }
  }
  if (s.phase === 'open') {
    s.open -= dt;
    if (s.open <= 0) {
      s.phase = 'banked'; s.open = 0; s.doused = [false, false, false, false];
      out.rebanked = true;
    }
  } else if (s.doused.every(Boolean)) {
    s.phase = 'open'; s.open = FURNACE_TUNING.openFor;
    out.opened = true;
  }
  return out;
}

/** Douse vent `n` (0..3). True when it was burning. */
export function douseVent(s: FurnaceState, n: number): boolean {
  if (s.phase !== 'banked' || n < 0 || n >= s.doused.length || s.doused[n]) return false;
  s.doused[n] = true;
  return true;
}

/** Whether a hit lands (the core is open). */
export function furnaceOpen(s: FurnaceState): boolean { return s.phase === 'open'; }

/** Whether it is breathing in, or about to (the telegraph). */
export function furnaceBreathing(s: FurnaceState): boolean { return s.inhale > 0; }
export function furnaceWarning(s: FurnaceState): boolean { return s.inhale <= 0 && s.next <= FURNACE_TUNING.warn; }

/**
 * The pull on a body at `x` (feet `y`) toward a mouth at (mx, floorY), px/s
 * along x (signed), while it breathes in: full at the mouth, easing to zero at
 * `reach`, nothing above or below the hall floor's band. Pure.
 */
export function pullAt(s: FurnaceState, mx: number, floorY: number, x: number, y: number): number {
  if (s.inhale <= 0 || Math.abs(y - floorY) > 140) return 0;
  const d = mx - x, ad = Math.abs(d);
  if (ad < 4 || ad > FURNACE_TUNING.reach) return 0;
  const strength = s.enraged ? FURNACE_TUNING.pullEnraged : FURNACE_TUNING.pull;
  return Math.sign(d) * strength * Math.min(1, 1.25 * (1 - ad / FURNACE_TUNING.reach));
}

/** Whether a body at `x` (feet `y`) is in the burning mouth while it breathes in. Pure. */
export function inMouth(s: FurnaceState, mx: number, floorY: number, x: number, y: number): boolean {
  return s.inhale > 0 && Math.abs(x - mx) <= FURNACE_TUNING.burn && Math.abs(y - floorY) <= 40;
}
