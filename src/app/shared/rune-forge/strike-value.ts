/**
 * strike-value.ts — what `strikePower` is worth at the anvil.
 *
 * `strikePower` rolled on the weapon and the hands (Eclipse Longblade,
 * Godforge Gauntlets, and now the Basalt Edge) and was displayed on the
 * tooltip while nothing read it at the Forge. A number a player can watch
 * that changes nothing teaches them the numbers are decorative, and that
 * is the one lesson a stat sheet must never teach. This is the second of
 * the stat's two consumers — see below — and it is the one the name asks
 * for: a harder strike is worth more.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT "WORTH MORE" MEANS HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * A Forge strike costs a flat `STRIKE_COST` and pays one rune off the drop
 * table. Both of those are fixed by design: the price does not scale, and
 * the table (which rune, at what odds) is Magic Find's lever and nobody
 * else's. So the only honest place for a strike to be worth more is the
 * *yield* — how many runes one blow shears off. `strikeValueMultiplier` is
 * the expected runes per strike; the part above 1 is the chance the strike
 * lands a second copy of whatever it rolled. It never changes which rune
 * comes out and it never reduces the count, so every point of strikePower
 * is an upgrade or a no-op, never a downgrade — the same guarantee
 * `rollRuneWithMagicFind` gives for MF.
 *
 * Why not XP: the Forge deliberately pays a duplicate a tenth of the tier's
 * XP with a floor of one, so at the Common tier — 99.7% of strikes — any
 * multiplier under 5× rounds back to the same single point. It would have
 * been a consumer on paper and a dead stat in play.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE NUMBERS
 * ─────────────────────────────────────────────────────────────────────────────
 * 2.5% extra yield per point of *worn* strikePower, capped at 25% (reached
 * at 10 points). Ten is where the mining consumer caps too, so one weapon
 * tops out both meanings at once. Floor is exactly 1.0: nothing equipped, a
 * negative roll, or junk input all mean one rune per strike, which is what
 * every strike paid before this file existed. Meaningful — a full kit lands
 * a bonus rune every fourth strike — but not dominant: at cap the Forge pays
 * 1.25 runes for 10k Gold, and which runes is still Magic Find's job.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO CONSUMERS, ONE STAT
 * ─────────────────────────────────────────────────────────────────────────────
 * `shared/activity/mining-recovery.ts` already reads strikePower off the
 * weapon slot to shorten the seam cooldown (2%/pt, capped 20%). This file
 * reads it off *every* worn piece — the spec lists strikePower's carriers as
 * "hands, weapon", and gauntlets are what you work an anvil in — and the two
 * coexist on purpose: a good weapon breaks ore faster AND hits harder at the
 * anvil. Neither reads the other; both are pure functions the caller feeds.
 *
 * Pure and total — no clock, no inventory, no RNG inside. `strikeCopies`
 * takes its roll as an argument so a spec can drive it exactly.
 */

/** Extra expected yield per point of worn strikePower. */
export const STRIKE_YIELD_PER_POINT = 0.025;

/** The most strikePower can add. Reached at 10 points, same as mining's cap. */
export const STRIKE_YIELD_CAP = 0.25;

/**
 * Expected runes per strike for a given worn strikePower total.
 *
 * 1.0 at zero (or any junk), 1.025 per point, 1.25 from ten points on. The
 * fractional part is the chance of a second copy — see `strikeCopies`.
 */
export function strikeValueMultiplier(strikePower: number): number {
  return 1 + strikeYieldBonus(strikePower);
}

/**
 * The bonus on its own, as a fraction in [0, STRIKE_YIELD_CAP]. The other two
 * readouts derive from this rather than from `multiplier − 1`, which would
 * hand back 0.10000000000000009 for four points and turn a clean 2.5% into
 * a rounded-down 2.
 */
export function strikeYieldBonus(strikePower: number): number {
  const power = Number.isFinite(strikePower) ? Math.max(0, strikePower) : 0;
  return Math.min(STRIKE_YIELD_CAP, power * STRIKE_YIELD_PER_POINT);
}

/**
 * Whole-percent readout of the yield bonus — the visible half of this file,
 * the way `miningSpeedupPct` is for the cooldown. Zero for a fresh Keeper;
 * callers should hide the line rather than print "+0%".
 */
export function strikeValuePct(strikePower: number): number {
  return Math.round(strikeYieldBonus(strikePower) * 100);
}

/**
 * How many copies of the rolled rune one strike lands: 1, or 2 when the
 * bonus roll comes in under the yield bonus. `roll` is the strike's own
 * uniform draw so the caller can pass a fixed sequence in a spec.
 *
 * Only ever 1 or 2. The cap is 25%, so there is no path to a third copy, and
 * a strike with nothing worn is exactly the one-rune strike it always was.
 */
export function strikeCopies(strikePower: number, roll: number): 1 | 2 {
  const bonus = strikeYieldBonus(strikePower);
  if (bonus <= 0) return 1;
  const r = Number.isFinite(roll) ? roll : 1;
  return r < bonus ? 2 : 1;
}
