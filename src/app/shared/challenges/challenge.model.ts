/**
 * challenge.model.ts — the Contract Board's data layer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT THE QUEST BOARD
 * ─────────────────────────────────────────────────────────────────────────────
 * `quest.model.ts` already runs a daily/weekly rotation, and the obvious build
 * bolts Gold onto it and adds fifteen more entries to `DAILY_QUESTS`. That build
 * is wrong for two reasons that only show up after it ships.
 *
 * The first is dilution. The daily pool holds thirty quests and three are drawn.
 * Adding fifteen Godforge objectives to it makes a board that is 2/3 tool work
 * and 1/3 forge work on a good day, and on a bad day is three "use the box
 * shadow generator" cards for a player who came to run expeditions. The two
 * ladders want *separate* draws precisely because they ask for different things.
 *
 * The second is the currency. A quest pays XP into an energy — Aether or Nox —
 * and the whole shape of `QuestReward` is built around which realm the XP feeds.
 * A challenge pays Gold, which has no realm and no energy, and threading a
 * nullable second currency through `rewardEnergy()`, the claim toast, the log
 * and the drawer would make every one of them carry a branch for a case the
 * quest board never has.
 *
 * So this is its own board, and it deliberately imports the *clock and the draw*
 * from `quest.model.ts` rather than reimplementing them. `dayKey`, `weekKey`,
 * `nextMidnight`, `nextMonday` and `pickDeterministic` are the parts that must
 * never disagree between the two boards — a challenge that rolls at a different
 * midnight than a quest is a bug report nobody can reproduce — and there is
 * exactly one copy of each.
 *
 * Pure data and pure functions. No browser APIs, so this file is safe to import
 * from a server-rendered path.
 */
import { EclipseRarity } from '../rarity/rarity.model';
import { RuneTier } from '../rune-forge/rune.model';
import { orderDeterministic } from '../quests/quest.model';

/**
 * The quest board's deterministic walk, re-exported so `challenge-pools.ts` can
 * reach it without importing the quest model directly.
 *
 * Re-exported rather than imported straight: the pools file is a lazy chunk and
 * `quest.model.ts` is eager, so a direct import there would be a second edge
 * into a module the chunk does not otherwise need. Going through the model,
 * which already depends on it, keeps the lazy chunk's import graph inside this
 * folder.
 */
export const orderDeterministicChallenges = orderDeterministic;

/** localStorage key. One blob, owned solely by ChallengeService. */
export const CHALLENGE_KEY = 'godforge-challenges';

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a challenge counts.
 *
 * Every one of these is already an event some service publishes — see
 * `challenge-wiring.service.ts`, which is the only place they are written.
 * Nothing here needs a new listener on 126 tool components, and nothing here
 * duplicates a quest bucket: the quest board counts *tool work*, this board
 * counts *forge work*, and the one metric they share — pages visited — is
 * counted here off the same router the quest wiring already reads.
 *
 * Two families, resolved differently by `ChallengeService.observe`:
 *
 *   counted  Every metric except the two below. A running tally for the period,
 *            incremented by `record()`. Progress is `min(tally, target)/target`.
 *
 *   peak     `combo-peak` and `rune-tier`. A *high water mark* rather than a
 *            tally, written by `recordPeak()`. A combo of 120 clears a "reach
 *            x100" challenge; two combos of 60 do not, which is the whole point
 *            of the objective.
 *
 *   set      `hall-variety`. Distinct members, written by `recordMember()`.
 *            A tally here would count the same hall every time it was
 *            reloaded, and "stand in 5 different halls" would be one hall
 *            visited five times. The members are persisted for the period
 *            rather than held in memory for the session, for exactly the same
 *            reason.
 */
export type ChallengeMetric =
  /** One per rune struck at the anvil, however it was struck. */
  | 'rune-forged'
  /** Peak rune tier found this period, as an index into `RUNE_TIER_ORDER`. */
  | 'rune-tier'
  /** One per material an activity action banked — mining and foraging both. */
  | 'material-mined'
  /** One per item moved into a slot on the Keeper or an explorer. */
  | 'item-equipped'
  /** One per expedition that came home and paid out. */
  | 'expedition-done'
  /** One per expedition of Deep Dive length or longer that came home. */
  | 'expedition-deep'
  /** Peak combo reached this period. */
  | 'combo-peak'
  /** Gold minted this period, from every source. */
  | 'gold-earned'
  /** Distinct halls of the world stood in this period. */
  | 'hall-variety'
  /** One per Runeword crafted. */
  | 'runeword-crafted'
  /** One per item upgraded or tempered. */
  | 'item-upgraded'
  /** The Keeper's current rank. Read live, not tallied. */
  | 'level';

/** Metrics that count distinct members rather than events. */
export const SET_METRICS: ReadonlySet<ChallengeMetric> = new Set<ChallengeMetric>([
  'hall-variety',
]);

/** The two metrics that keep a high water mark rather than a running total. */
export const PEAK_METRICS: ReadonlySet<ChallengeMetric> = new Set<ChallengeMetric>([
  'combo-peak',
  'rune-tier',
]);

/** Read live off another ledger rather than out of this board's counters. */
export const DERIVED_METRICS: ReadonlySet<ChallengeMetric> = new Set<ChallengeMetric>([
  'level',
]);

export type ChallengeCadence = 'daily' | 'weekly';

export type ChallengeStatus = 'active' | 'completed' | 'claimed';

export interface ChallengeDefinition {
  id: string;
  title: string;
  /** What to do, in one imperative line. */
  description: string;
  /** One line of Eclipse Realms flavour. This is the reason to read the card. */
  flavour: string;
  cadence: ChallengeCadence;
  metric: ChallengeMetric;
  /** The target. For a peak metric this is the mark to reach, not a count. */
  target: number;
  /** Gold paid on claim, before any active boost. */
  gold: number;
  rarity: EclipseRarity;
}

/** The authored challenge plus this visitor's standing against it. */
export interface Challenge extends ChallengeDefinition {
  status: ChallengeStatus;
  /** 0–100, for the bar. */
  progress: number;
  /** Raw observed value, capped at the target, for the "7/10" line. */
  observed: number;
  /** ISO instant the board this challenge sits on rerolls. */
  expiresAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The draw
// ─────────────────────────────────────────────────────────────────────────────

/** Three a day. The brief's number, and it is the right one — see the pool note. */
export const DAILY_CHALLENGE_SLOTS = 3;
/** Two a week. */
export const WEEKLY_CHALLENGE_SLOTS = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Rune tiers as a number
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The `rune-tier` metric's scale: 0 = Common, 6 = Singular.
 *
 * A peak metric has to be a number so `Math.max` can be the whole update rule,
 * and an *index into the existing ladder* is the only encoding that cannot
 * drift from it. Writing 'rare' = 3 as a literal here would be a second copy of
 * `RUNE_TIER_ORDER` waiting to disagree with the first the next time a tier is
 * inserted.
 */
export const CHALLENGE_TIER_SCALE: readonly RuneTier[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular',
];

export function tierRank(tier: RuneTier | string): number {
  const i = CHALLENGE_TIER_SCALE.indexOf(tier as RuneTier);
  return i < 0 ? 0 : i;
}

/** The tier a `rune-tier` target names, for the card's progress line. */
export function tierAtRank(rank: number): RuneTier {
  const i = Math.min(CHALLENGE_TIER_SCALE.length - 1, Math.max(0, Math.round(rank)));
  return CHALLENGE_TIER_SCALE[i];
}

// ─────────────────────────────────────────────────────────────────────────────
// The streak
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clearing all three dailies pays a boost rather than more Gold, and that is
 * the whole design of the streak.
 *
 * A fourth lump of Gold for finishing the board is a number that gets added to
 * the three already on the cards and changes nothing about how the day is
 * played. An hour at double rate changes *when* you play: the correct move
 * becomes "finish the board, then strike", and a player who works that out has
 * found a strategy rather than a bigger number.
 *
 * One hour rather than a day because the boost has to be spendable in the
 * session that earned it. A 24-hour boost is a boost you forget you have.
 */
export const STREAK_BOOST_MULTIPLIER = 2;
export const STREAK_BOOST_MS = 60 * 60_000;

/** Days of a full daily clear before the chest opens. */
export const STREAK_CHEST_AT = 7;

/**
 * What the seven-day chest pays.
 *
 * A rune at Rare or better, banked through `RuneForgeService.grant` so it
 * counts toward Runewords, rolls its Lore Scroll and mints its equippable on
 * exactly the same terms as one found in the Umbral vault. A chest with its own
 * private rune would be a trophy with the mechanics cut off it — the same
 * mistake `explorer.model.ts` documents at length and declines to make.
 */
export const STREAK_CHEST_FLOOR: RuneTier = 'rare';

/** The flame is drawn at these marks. Purely cosmetic, but it wants one home. */
export function streakFlameTier(days: number): 'cold' | 'lit' | 'burning' | 'eternal' {
  if (days >= 30) return 'eternal';
  if (days >= STREAK_CHEST_AT) return 'burning';
  if (days >= 1) return 'lit';
  return 'cold';
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "14:32:05" — time until the next board.
 *
 * Hours are always shown, unlike the expedition countdown, because this one is
 * read as "is it worth starting a daily now" and a bare "32:05" is ambiguous
 * between half an hour and half a day at exactly the moment that matters.
 *
 * Returns an em dash rather than throwing on an unparseable instant: this is a
 * line of chrome on a panel that still works without it.
 */
export function challengeCountdown(iso: string, now = Date.now()): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '—';
  const total = Math.max(0, Math.ceil((at - now) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** "2,000,000" — the target and the reward both read better grouped. */
export function formatChallengeNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

/** The progress line under a card: "7 / 10", or the tier names for a tier goal. */
export function challengeProgressLabel(c: Challenge): string {
  if (c.metric === 'rune-tier') {
    const have = c.observed > 0 ? tierAtRank(c.observed) : 'nothing yet';
    return `${have} / ${tierAtRank(c.target)}`;
  }
  if (c.metric === 'combo-peak') {
    return `x${formatChallengeNumber(c.observed)} / x${formatChallengeNumber(c.target)}`;
  }
  return `${formatChallengeNumber(c.observed)} / ${formatChallengeNumber(c.target)}`;
}
