/**
 * idle.model.ts — the ambient forge economy.
 *
 * Time spent with the site open and visible earns XP. The rates are small on
 * purpose: a full capped day of idling is worth about four tool visits, so
 * leaving a tab open is a pleasant background hum and never a substitute for
 * using the thing.
 *
 * Pure data and pure functions — no browser APIs — so this is safe to import
 * from a server-rendered path.
 */
import { EnergyType } from '../gamification/gamification.model';
import { RealmId } from '../realms/realm.model';

/** Where the visitor is standing, which decides the base rate. */
export type ForgeLocation = 'tool' | 'arena' | 'elsewhere';

/** What the flame is doing. Drives both the icon and the tooltip. */
export type ForgeState =
  /** Tab hidden. Nothing accrues. */
  | 'cooled'
  /** Visible, earning the base rate. */
  | 'warming'
  /** Visible on a tool page, earning the higher rate. */
  | 'burning'
  /** Today's allowance is spent. Still lit, no longer earning. */
  | 'banked';

/** XP per minute before multipliers. */
export const BASE_RATES: Record<ForgeLocation, number> = {
  tool: 2,
  arena: 1.5,
  elsewhere: 1,
};

/**
 * Minutes of visible time credited per local day.
 *
 * ── WHY PER DAY AND NOT PER PAGE-LOAD ──────────────────────────────────────
 * The brief called this a per-session cap. A cap held in memory resets on
 * Cmd+R, so the AFK farming it exists to prevent would be defeated by the
 * reload button — which is the single most likely thing an idler does. The
 * allowance is therefore persisted against the local day, exactly like the
 * daily quest board, and a reload buys nothing.
 */
export const DAILY_MINUTE_CAP = 30;

/** One minute of visible time. */
export const MINUTE_MS = 60_000;

/**
 * How often the accumulator runs. Not the award interval — awards happen when
 * a full minute of *visible* time has accumulated, which is a different thing
 * on a machine that sleeps or a tab the browser throttles.
 */
export const HEARTBEAT_MS = 10_000;

/**
 * Ceiling on the time credited by a single heartbeat.
 *
 * A laptop lid closed for six hours produces one heartbeat with a six-hour
 * delta. Clamping to a little over the interval means sleep is simply not
 * counted, rather than paying out a day's allowance in one frame.
 */
export const HEARTBEAT_CLAMP_MS = 15_000;

/** Minimum gap between two forge strikes. Below this the click is ignored. */
export const STRIKE_COOLDOWN_MS = 500;

/** XP for one strike, and the bonus every hundredth. */
export const STRIKE_XP = 1;
export const CENTURY_STRIKE_XP = 10;
export const CENTURY_EVERY = 100;
/** A strike this often throws a spark. */
export const SPARK_EVERY = 10;

/**
 * Streak multiplier on idle XP.
 *
 * The brief named two anchors — day 7 is 1.5×, day 30 is 2× — and a stepped
 * ladder is what actually delivers them. An interpolated curve would hit 1.5
 * and 2.0 on exactly those two days and be an invented number on every other,
 * which is a worse thing to have to explain in a tooltip.
 */
export function streakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2;
  if (streakDays >= 7) return 1.5;
  return 1;
}

/** Flat bonus per minute for idling on a tool in your most-worked realm. */
export const DOMINANT_REALM_BONUS = 0.5;

/** An active quest pointing at the tool you are sitting on doubles the rate. */
export const ACTIVE_QUEST_MULTIPLIER = 2;

export interface RateBreakdown {
  /** XP per minute, after everything. */
  rate: number;
  base: number;
  streak: number;
  dominantRealm: boolean;
  activeQuest: boolean;
}

/**
 * Compose the effective rate.
 *
 * Order matters and is fixed here rather than at the call site: the realm bonus
 * is additive on the base, the quest doubling applies to that sum, and the
 * streak multiplies the result. Additive-then-multiplicative keeps the biggest
 * number attached to the hardest thing to earn (a thirty-day streak).
 */
export function effectiveRate(
  location: ForgeLocation,
  streakDays: number,
  dominantRealm: boolean,
  activeQuest: boolean,
): RateBreakdown {
  const base = BASE_RATES[location];
  let rate = base;
  if (dominantRealm && location === 'tool') rate += DOMINANT_REALM_BONUS;
  if (activeQuest) rate *= ACTIVE_QUEST_MULTIPLIER;
  const streak = streakMultiplier(streakDays);
  rate *= streak;
  return { rate, base, streak, dominantRealm, activeQuest };
}

/** Idle XP feeds the energy of the realm you are idling in. */
export function energyForRealm(realm: RealmId | null): EnergyType {
  return realm === 'umbral' || realm === 'verge' ? 'nox' : 'aether';
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The idle milestones, keyed by the egg id they award.
 *
 * They are registered in EASTER_EGGS rather than kept in a private list, so
 * they arrive through the machinery that already exists: the rarity-tiered drop
 * with its sound, the Codex achievement wall, the global discovery counter and
 * the found-date ledger. A parallel achievement system would have to
 * reimplement all four and would show up nowhere.
 *
 * Their XP is set low in the registry for the same reason the "noticed rather
 * than hunted" eggs are: these are earned by being present, and paying a
 * hunt's 200 XP for sitting still would distort the economy the quests balance
 * against.
 */
export const IDLE_MILESTONES = {
  patientOne: 'idle-patient-one',
  forgeMeditation: 'idle-forge-meditation',
  vigil: 'idle-vigil',
  eternalFlame: 'idle-eternal-flame',
  neverSleeps: 'idle-never-sleeps',
  forgeStriker: 'idle-forge-striker',
  obsidianHammer: 'idle-obsidian-hammer',
} as const;

/** Lifetime idle XP thresholds. */
export const IDLE_XP_MILESTONES: Array<{ at: number; egg: string }> = [
  { at: 100,  egg: IDLE_MILESTONES.patientOne },
  { at: 500,  egg: IDLE_MILESTONES.vigil },
  { at: 2000, egg: IDLE_MILESTONES.eternalFlame },
];

/** Lifetime forge-strike thresholds. */
export const STRIKE_MILESTONES: Array<{ at: number; egg: string }> = [
  { at: 1000,  egg: IDLE_MILESTONES.forgeStriker },
  { at: 10000, egg: IDLE_MILESTONES.obsidianHammer },
];

/** One unbroken visible run of this long earns Forge Meditation. */
export const MEDITATION_MS = 30 * MINUTE_MS;
