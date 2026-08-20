/**
 * roster-completion.ts — what filling the cast is worth.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS COUNTS DISCOVERIES AND NOT HEADCOUNT
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious counter is `roster.explorers.length`, and it is the wrong one in
 * a way that only shows up once: dismissing somebody would take a reward back.
 * A player who finds their tenth explorer, unlocks the sixth expedition slot,
 * then lets a Common go to make room, would lose the slot — with an expedition
 * already out in it — because a number went down.
 *
 * So the counter is over *distinct archetypes ever seen*, which is monotonic by
 * construction. It is also the honest reading of what the reward is for: this
 * is a collection, and a collection log does not un-log an entry because you
 * sold the duplicate.
 *
 * Pure data and pure functions. No browser APIs.
 */
import { ARCHETYPE_COUNT } from './explorer-archetypes';

export interface RosterReward {
  /** Distinct archetypes discovered to unlock this. */
  at: number;
  /** The title it confers, when it confers one. */
  title?: string;
  /** One line of what it does. */
  detail: string;
  /** Multiplies every expedition payout. 1 when the reward is not a multiplier. */
  payoutMultiplier: number;
  /** Extra expedition slots this grants. */
  slots: number;
}

/**
 * Four rungs, the last of them the whole cast.
 *
 * The sixth expedition slot at ten is the one that changes how the page is
 * played, and it is placed there rather than sold in the Market on purpose:
 * `MAX_EXPLORER_SLOTS` was five because there are five realms, and that stopped
 * being the binding constraint the moment there were fifteen *sites*. A sixth
 * slot is now a second run in a realm worth running twice, which is a decision
 * rather than a duplicate — and earning it by collecting people is a better fit
 * for what it does than another Gold ladder rung would be.
 */
export const ROSTER_REWARDS: readonly RosterReward[] = [
  {
    at: 5,
    title: 'Scout Master',
    detail: 'Five of the cast found. Every expedition pays 5% more.',
    payoutMultiplier: 1.05,
    slots: 0,
  },
  {
    at: 10,
    detail: 'Ten found. A sixth expedition slot opens in the Sanctum.',
    payoutMultiplier: 1.0,
    slots: 1,
  },
  {
    at: 15,
    title: 'Expedition Commander',
    detail: 'Fifteen found. Expeditions pay 10% more, and the Commander’s charm is yours.',
    payoutMultiplier: 1.1,
    slots: 0,
  },
  {
    at: ARCHETYPE_COUNT,
    title: 'Lord of the Roster',
    detail: 'Every one of them walks for you. All expedition rewards, permanently +10%.',
    payoutMultiplier: 1.1,
    slots: 0,
  },
];

/** The rewards this many discoveries has earned. */
export function earnedRewards(discovered: number): readonly RosterReward[] {
  return ROSTER_REWARDS.filter(r => discovered >= r.at);
}

/** The next rung, or null once the cast is complete. */
export function nextReward(discovered: number): RosterReward | null {
  return ROSTER_REWARDS.find(r => discovered < r.at) ?? null;
}

/**
 * Every payout multiplier earned, multiplied together.
 *
 * Compounding rather than taking the largest: three separate 5–10% rewards that
 * only ever paid the best one would make the middle two decorative, and a
 * player who read the tooltips would notice. The ceiling is 1.05 × 1.1 × 1.1 =
 * 1.27, which is real without being the reason anybody plays.
 */
export function rosterPayoutMultiplier(discovered: number): number {
  return earnedRewards(discovered).reduce((m, r) => m * r.payoutMultiplier, 1);
}

/** Extra expedition slots earned by collecting. */
export function rosterBonusSlots(discovered: number): number {
  return earnedRewards(discovered).reduce((n, r) => n + r.slots, 0);
}

/** The highest title earned, or null. */
export function rosterTitle(discovered: number): string | null {
  const titled = earnedRewards(discovered).filter(r => r.title);
  return titled.length ? titled[titled.length - 1].title! : null;
}

export { ARCHETYPE_COUNT };
