/**
 * mining-recovery.ts — the strike cooldown, and why it isn't one number.
 *
 * The cooldown was a flat 2.5s regardless of anything the player had done:
 * level 50 and level 1 waited the same amount of time between clicks, and
 * the weapon slot — the pickaxe, in RuneScape's own precedent for where a
 * mining tool lives — changed nothing about how mining felt. That is the gap
 * this closes: level and gear both shave real time off the wait, so getting
 * better at Mining is something you feel on every single click, not just
 * something the skill bar records.
 *
 * Two independent, additive-feeling multipliers, each capped on its own so
 * neither one alone can trivialise the cooldown, and a hard floor so
 * stacking both can never turn Mining into a blur or a rate-limit bypass:
 *
 *  - Level: 1% shorter per level above 1, capped at 35% (reached at 36).
 *    Practice makes you faster at the same seam — no gear required.
 *  - Weapon strikePower: 2% shorter per point on whatever sits in the
 *    weapon slot, capped at 20% (reached at 10). A sharper edge breaks off
 *    ore quicker. Nothing is equipped by default, so a fresh Keeper feels
 *    only the level curve until they craft something.
 *
 * At level 1 with nothing equipped this returns exactly the old flat
 * constant — a fresh save's timing is unchanged, only from there does it
 * start moving.
 *
 * The two caps compound (0.65 x 0.8 = 0.52), so today's actual floor is
 * 1,300ms at level 36+ with a +10-or-better weapon, not the constant below.
 * MINING_RECOVERY_FLOOR_MS is set under that on purpose: a safety margin for
 * if a future item or level cap ever widens one of the two caps above without
 * anyone revisiting this file. If a change to either cap ever makes the
 * compounded floor cross MINING_RECOVERY_FLOOR_MS, the clamp below is what
 * catches it — see the spec's invariant check.
 *
 * Pure and total — no clock, no inventory read — so the gateway supplies
 * both inputs and this stays trivial to test and safe to call from an SSR
 * path.
 */
import { MINING_RECOVERY_MS as MINING_RECOVERY_BASE_MS } from './activity.model';
export { MINING_RECOVERY_BASE_MS };

/**
 * The hard backstop. Not reached by today's caps (see above) — it exists so
 * widening LEVEL_SPEEDUP_CAP or STRIKE_POWER_SPEEDUP_CAP later can never
 * silently turn a strike into a blur or a rate-limit bypass.
 */
export const MINING_RECOVERY_FLOOR_MS = 1200;

const LEVEL_SPEEDUP_PER_LEVEL = 0.01;
const LEVEL_SPEEDUP_CAP = 0.35;
const STRIKE_POWER_SPEEDUP_PER_POINT = 0.02;
const STRIKE_POWER_SPEEDUP_CAP = 0.2;

export function effectiveMiningRecoveryMs(level: number, weaponStrikePower: number): number {
  const lvl = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const power = Number.isFinite(weaponStrikePower) ? Math.max(0, weaponStrikePower) : 0;

  const levelFactor = 1 - Math.min(LEVEL_SPEEDUP_CAP, (lvl - 1) * LEVEL_SPEEDUP_PER_LEVEL);
  const gearFactor = 1 - Math.min(STRIKE_POWER_SPEEDUP_CAP, power * STRIKE_POWER_SPEEDUP_PER_POINT);

  const ms = MINING_RECOVERY_BASE_MS * levelFactor * gearFactor;
  return Math.max(MINING_RECOVERY_FLOOR_MS, Math.round(ms));
}

/**
 * Whole-percent readout of how much faster the cooldown is than the base —
 * the visible half of this file. A dependency a player can only infer from
 * a stopwatch does not feel like progress; this is what lets the Seamworks
 * page say "12% faster" instead of asking them to notice on their own.
 * Zero for a fresh Keeper, not a false "0% faster" badge — callers should
 * hide the line entirely rather than print that.
 */
export function miningSpeedupPct(level: number, weaponStrikePower: number): number {
  const effective = effectiveMiningRecoveryMs(level, weaponStrikePower);
  return Math.max(0, Math.round((1 - effective / MINING_RECOVERY_BASE_MS) * 100));
}
