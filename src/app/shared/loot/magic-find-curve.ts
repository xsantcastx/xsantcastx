/**
 * magic-find-curve.ts — D2's diminishing Magic Find, one rung at a time (docs/design/loot-and-combat.md §9.2).
 *
 * Magic Find is the percentage the satchel, the Hush, the sets and the worn uniques add up to. A rung does not
 * feel all of it: the higher the rung, the more of it is damped away, `effective = MF × K / (MF + K)`:
 *
 *   uncommon (magic)      linear, effective = MF        (the card's own "+N%" is exact here)
 *   rare                  K 600
 *   epic / set pieces     K 500
 *   legendary (unique)    K 250                         the "toward unique" figure on the C sheet
 *   mythic, singular      K 150                         a ceiling no gear reaches (K is the most it can ever add)
 *
 * A leaf (no imports): drop-tables.ts, set-items.ts and the C sheet all read it.
 */
import type { RuneTier } from '../rune-forge/rune.model';

/** Each rung's damping constant (Infinity = linear). */
export const MF_K: Readonly<Record<RuneTier, number>> = {
  common: Infinity, uncommon: Infinity, rare: 600, epic: 500, legendary: 250, mythic: 150, singular: 150,
};
/** The set pieces' damping (they lean like an epic). */
export const SET_MF_K = 500;
/** The curve the C sheet quotes beside the raw figure: "effective toward unique". */
export const UNIQUE_MF_K = MF_K.legendary;

/** `mf × k / (mf + k)`: D2's diminishing returns (k = Infinity: linear). Negative or non-finite MF counts as 0. */
export function effectiveMagicFind(mf: number, k: number): number {
  const m = Math.max(0, Number.isFinite(mf) ? mf : 0);
  if (!Number.isFinite(k)) return m;
  return (m * k) / (m + k) || 0;
}

/** What a rung feels of this Magic Find (percentage points). */
export function mfFor(tier: RuneTier, mf: number): number { return effectiveMagicFind(mf, MF_K[tier]); }

/** The C sheet's "toward uniques" figure for a Magic Find: the legendary curve, to a tenth of a point. */
export function mfTowardUnique(mf: number): number { return Math.round(effectiveMagicFind(mf, UNIQUE_MF_K) * 10) / 10; }
