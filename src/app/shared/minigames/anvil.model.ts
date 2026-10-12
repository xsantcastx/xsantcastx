/**
 * anvil.model.ts — the Smithing anvil mini-game, as pure functions.
 *
 * No imports, no Angular: the component drives a clock and calls these; the
 * specs pin every number. Two jobs:
 *
 *   1. GRADE THE STRIKES. A marker sweeps a heat bar (a triangle wave, 0..1).
 *      Each press is graded by its distance from the centre: Perfect / Good /
 *      Off. The mean strike score is the piece's quality, 0..1.
 *
 *   2. BIAS THE ROLL — without moving the ceiling.
 *      `rollItemStatsWithQuality` draws one `r` in [0, 1) per roll key and maps
 *      it to `q = min + r * (max - min)` inside the rarity's band. The anvil
 *      never touches that mapping, the band, or the stored grade. It only
 *      reshapes the RNG the mint is handed:
 *
 *          r' = r ^ e,   e = 1 - ANVIL_BIAS_MAX * quality   (e in [0.8, 1])
 *
 *      For r in [0, 1) and e in (0, 1], r^e is also in [0, 1) — a power with a
 *      positive exponent maps [0, 1) onto itself and never reaches 1. So the
 *      biased roll is still drawn from the same band and cannot exceed today's
 *      maximum; it is only pushed toward the top of it. Quality 0 gives e = 1:
 *      the RNG is returned untouched, so a skipped game / Craft all / a craft of
 *      something without rolls is bit-identical to today.
 *
 *      Expected r: today E[r] = 1/2. With the bias, E[r^e] = 1/(1+e), so a
 *      perfect game (e = 0.8) gives 0.556 — at most +5.6 points of grade on
 *      average, and a typical game (quality ~0.6, e = 0.88) about +3.2.
 *
 * Mastery (`masteryRng` in crafting.model) wraps whatever RNG the gateway is
 * handed and clamps at the band max itself, so the two compose and neither can
 * push past the ceiling.
 */

export type StrikeGrade = 'perfect' | 'good' | 'off';

/** Strikes in one piece. 4 × ~1 s ≈ a 4-second game. */
export const ANVIL_STRIKES = 4;

/** Half-widths (as a fraction of the bar's half) of the two target zones. */
export const ANVIL_ZONES = { perfect: 0.12, good: 0.36 } as const;

/** What each grade is worth toward quality. An Off strike still counts a little. */
export const STRIKE_SCORE: Readonly<Record<StrikeGrade, number>> = { perfect: 1, good: 0.6, off: 0.15 };

/** How far a perfect game bends the roll exponent. See the header. */
export const ANVIL_BIAS_MAX = 0.2;

/** The first sweep's period (ms, there and back) and how much faster each strike gets. */
export const ANVIL_PERIOD_MS = 1500;
export const ANVIL_PERIOD_STEP_MS = 140;
export const ANVIL_PERIOD_MIN_MS = 900;

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Sweep period for strike `index` (0-based). */
export function anvilPeriod(index: number): number {
  const i = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return Math.max(ANVIL_PERIOD_MIN_MS, ANVIL_PERIOD_MS - i * ANVIL_PERIOD_STEP_MS);
}

/** The marker's position (0..1) `elapsedMs` into a sweep of `periodMs`, starting at `phase` (0..1). */
export function markerAt(elapsedMs: number, periodMs: number, phase = 0): number {
  if (!(periodMs > 0) || !Number.isFinite(elapsedMs)) return 0;
  const t = (((elapsedMs / periodMs + phase) % 1) + 1) % 1;
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

/** Grade a press at marker position `pos` (0..1; the centre is 0.5). */
export function gradeStrike(pos: number): StrikeGrade {
  const off = Math.abs(clamp01(pos) - 0.5) * 2;
  if (off <= ANVIL_ZONES.perfect) return 'perfect';
  if (off <= ANVIL_ZONES.good) return 'good';
  return 'off';
}

/** Mean strike score, 0..1. An empty game is quality 0 (= today's roll). */
export function anvilQuality(grades: readonly StrikeGrade[]): number {
  if (!grades.length) return 0;
  let sum = 0;
  for (const g of grades) sum += STRIKE_SCORE[g] ?? 0;
  return clamp01(sum / grades.length);
}

/** The roll exponent for a piece of `quality`. 1 at quality 0, 0.8 at quality 1. */
export function anvilExponent(quality: number): number {
  return 1 - ANVIL_BIAS_MAX * clamp01(quality);
}

/**
 * Bias one raw roll `r` toward the top of its band. Always in [0, 1) and
 * never below `r` — see the header for why it cannot exceed today's maximum.
 */
export function anvilBiasRoll(r: number, quality: number): number {
  // The mint's own contract is [0, 1); hold any RNG to it so a stray 1 cannot
  // turn into a grade the band does not have.
  const raw = Number.isFinite(r) ? Math.min(Math.max(r, 0), 1 - Number.EPSILON) : 0;
  const e = anvilExponent(quality);
  if (e >= 1) return raw;
  return Math.min(Math.pow(raw, e), 1 - Number.EPSILON);
}

/**
 * Wrap the mint's RNG with the anvil's bias. Quality null/0 (skipped game,
 * Craft all) returns `base` itself, so that path is unchanged.
 */
export function anvilRng(base: () => number, quality: number | null | undefined): () => number {
  if (quality == null || !(clamp01(quality) > 0)) return base;
  const q = clamp01(quality);
  return () => anvilBiasRoll(base(), q);
}

/** E[r'] for r ~ U[0, 1): 1 / (1 + e). 0.5 at quality 0. For docs and specs. */
export function expectedAnvilRoll(quality: number): number {
  return 1 / (1 + anvilExponent(quality));
}

/** A one-word verdict for the result line. */
export function anvilVerdict(quality: number): 'masterful' | 'fine' | 'rough' {
  const q = clamp01(quality);
  if (q >= 0.85) return 'masterful';
  if (q >= 0.5) return 'fine';
  return 'rough';
}
