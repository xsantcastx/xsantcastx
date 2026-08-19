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

/**
 * `n` challenges from `pool`, chosen by `seed`, no two asking for the same
 * thing.
 *
 * The plain deterministic pick is not enough here, and the day it went in it
 * drew "reach a combo of x100" and "reach a combo of x250" onto the same board.
 * Neither card is broken — hitting 250 collects both — but a board where one
 * objective clears two of its three slots is a two-card board with a bonus, and
 * on the days the walk lands that way the whole ladder is quieter than it looks.
 *
 * The quest board does not need this because its thirty entries are thirty
 * different tools; this pool is six verbs at three sizes, so collisions are the
 * common case rather than the unlucky one.
 *
 * Distinctness is a *preference*, not a guarantee: if the pool runs out of
 * unseen metrics before the board is full — which it cannot today, with six
 * metrics for three slots, but could after a retune — the walk continues and
 * takes repeats rather than returning a short board. A board with two combo
 * cards is worse than one without; a board with two cards is worse than both.
 */
export function pickDistinctMetrics(
  pool: readonly ChallengeDefinition[],
  n: number,
  seed: string,
): ChallengeDefinition[] {
  if (n <= 0) return [];
  const ordered = orderDeterministic(pool, seed);
  const seen = new Set<ChallengeMetric>();
  const out: ChallengeDefinition[] = [];

  for (const def of ordered) {
    if (out.length >= n) break;
    if (seen.has(def.metric)) continue;
    seen.add(def.metric);
    out.push(def);
  }
  // Backfill in the same walk order, so the result is still a pure function of
  // the seed and still starts with the same cards it would have started with.
  for (const def of ordered) {
    if (out.length >= n) break;
    if (out.includes(def)) continue;
    out.push(def);
  }
  return out;
}

/** Three a day. The brief's number, and it is the right one — see the pool note. */
export const DAILY_CHALLENGE_SLOTS = 3;
/** Two a week. */
export const WEEKLY_CHALLENGE_SLOTS = 2;

/**
 * Eighteen dailies, three drawn.
 *
 * Eighteen rather than the brief's floor of fifteen, and deliberately not
 * thirty: at three a day a pool of eighteen repeats a card roughly every six
 * days, which is often enough that a player learns the board and rare enough
 * that it does not read as a loop. Thirty — the quest board's number — is right
 * for a pool whose entries are *tools*, where variety is the product. Here the
 * entries are the same six verbs at different sizes, and thirty of them would
 * be twelve cards nobody can tell apart.
 *
 * Targets are one-sitting sized. Gold is priced against the mid-game rate: a
 * Delve pays 20–50k, so a daily paying 5k is a nudge, not an income. The board
 * is a reason to open the tab, not a replacement for playing.
 */
export const DAILY_CHALLENGES: readonly ChallengeDefinition[] = [
  {
    id: 'd-forge-50',
    title: 'Feed the Anvil',
    description: 'Strike 50 runes at the Rune Forge.',
    flavour: 'Fifty is the number the old smiths counted to before they trusted the heat.',
    cadence: 'daily',
    metric: 'rune-forged',
    target: 50,
    gold: 5_000,
    rarity: 'mortal',
  },
  {
    id: 'd-forge-150',
    title: 'The Long Shift',
    description: 'Strike 150 runes at the Rune Forge.',
    flavour: 'The anvil does not tire. That has always been the unfair part of the arrangement.',
    cadence: 'daily',
    metric: 'rune-forged',
    target: 150,
    gold: 12_000,
    rarity: 'eclipsed',
  },
  {
    id: 'd-mine-10',
    title: 'Break the Seam',
    description: 'Bring back 10 materials from the seams.',
    flavour: 'Ten strikes on live ore. The Basalt Seamworks does not hand anything over on the first ask.',
    cadence: 'daily',
    metric: 'material-mined',
    target: 10,
    gold: 2_000,
    rarity: 'mortal',
  },
  {
    id: 'd-mine-30',
    title: 'A Full Bag',
    description: 'Bring back 30 materials from the seams.',
    flavour: 'The bag is heavier on the way out than the way in. Nobody has explained that either.',
    cadence: 'daily',
    metric: 'material-mined',
    target: 30,
    gold: 6_000,
    rarity: 'eclipsed',
  },
  {
    id: 'd-equip-1',
    title: 'Take Up Arms',
    description: 'Equip something new.',
    flavour: 'A Keeper who carries nothing is a Keeper the realms have nothing to weigh.',
    cadence: 'daily',
    metric: 'item-equipped',
    target: 1,
    gold: 1_000,
    rarity: 'mortal',
  },
  {
    id: 'd-equip-3',
    title: 'Change the Loadout',
    description: 'Equip three items.',
    flavour: 'Three swaps in one day is either a plan or a crisis. The forge does not ask which.',
    cadence: 'daily',
    metric: 'item-equipped',
    target: 3,
    gold: 3_000,
    rarity: 'eclipsed',
  },
  {
    id: 'd-exp-3',
    title: 'Three Roads Out',
    description: 'Complete 3 expeditions.',
    flavour: 'Send them at dawn, forget about them, and let the evening do the arithmetic.',
    cadence: 'daily',
    metric: 'expedition-done',
    target: 3,
    gold: 3_000,
    rarity: 'mortal',
  },
  {
    id: 'd-exp-6',
    title: 'The Standing Rota',
    description: 'Complete 6 expeditions.',
    flavour: 'Six returns in a day means somebody was sending Scouts, and everybody knows it.',
    cadence: 'daily',
    metric: 'expedition-done',
    target: 6,
    gold: 7_000,
    rarity: 'eclipsed',
  },
  {
    id: 'd-exp-deep-1',
    title: 'Past the Shallows',
    description: 'Complete a Deep Dive or longer.',
    flavour: 'Four hours is the first length where the explorer packs food.',
    cadence: 'daily',
    metric: 'expedition-deep',
    target: 1,
    gold: 8_000,
    rarity: 'sacred',
  },
  {
    id: 'd-combo-100',
    title: 'Hold the Rhythm',
    description: 'Reach a combo of x100.',
    flavour: 'The hammer finds the beat before the hand does. Do not think about it.',
    cadence: 'daily',
    metric: 'combo-peak',
    target: 100,
    gold: 2_500,
    rarity: 'mortal',
  },
  {
    id: 'd-combo-250',
    title: 'Unbroken',
    description: 'Reach a combo of x250.',
    flavour: 'Two hundred and fifty strikes without a pause. The Nocturne consider this rude.',
    cadence: 'daily',
    metric: 'combo-peak',
    target: 250,
    gold: 9_000,
    rarity: 'sacred',
  },
  {
    id: 'd-halls-5',
    title: 'Walk the Halls',
    description: 'Stand in 5 different halls of the world.',
    flavour: 'The Archivum keeps a register of who went where. It is not clear who reads it.',
    cadence: 'daily',
    metric: 'hall-variety',
    target: 5,
    gold: 1_500,
    rarity: 'mortal',
  },
  {
    id: 'd-halls-9',
    title: 'The Long Corridor',
    description: 'Stand in 9 different halls of the world.',
    flavour: 'Nine doors in one day. Somebody is either lost or looking for something specific.',
    cadence: 'daily',
    metric: 'hall-variety',
    target: 9,
    gold: 4_500,
    rarity: 'eclipsed',
  },
  {
    id: 'd-gold-250k',
    title: 'Fill the Coffer',
    description: 'Earn 250,000 Gold.',
    flavour: 'Gold is the only thing in the realms that everyone agrees on the value of, which is why nobody trusts it.',
    cadence: 'daily',
    metric: 'gold-earned',
    target: 250_000,
    gold: 4_000,
    rarity: 'mortal',
  },
  {
    id: 'd-gold-2m',
    title: 'A Heavy Day',
    description: 'Earn 2,000,000 Gold.',
    flavour: 'Two million and the vault door starts to complain about the hinges.',
    cadence: 'daily',
    metric: 'gold-earned',
    target: 2_000_000,
    gold: 15_000,
    rarity: 'sacred',
  },
  {
    id: 'd-rune-rare',
    title: 'Something Worth Keeping',
    description: 'Find a Rare rune or better.',
    flavour: 'Most of what the anvil gives back is ash. Most is not all.',
    cadence: 'daily',
    metric: 'rune-tier',
    target: 2,
    gold: 10_000,
    rarity: 'sacred',
  },
  {
    id: 'd-upgrade-2',
    title: 'Sharpen What You Have',
    description: 'Upgrade or temper two items.',
    flavour: 'A blade improved twice is a different blade. The lore disagrees; the numbers do not.',
    cadence: 'daily',
    metric: 'item-upgraded',
    target: 2,
    gold: 4_000,
    rarity: 'eclipsed',
  },
  {
    id: 'd-mine-60',
    title: 'Down to the Basalt',
    description: 'Bring back 60 materials from the seams.',
    flavour: 'Past sixty the seam stops being a seam and starts being a room.',
    cadence: 'daily',
    metric: 'material-mined',
    target: 60,
    gold: 11_000,
    rarity: 'sacred',
  },
];

/**
 * Twelve weeklies, two drawn.
 *
 * A weekly is a *week's* objective, so every target here is deliberately out of
 * reach in one sitting — otherwise it is a daily with a longer countdown, which
 * is the failure mode the brief's "reach level X" example walks straight into
 * on an account that is already there.
 */
export const WEEKLY_CHALLENGES: readonly ChallengeDefinition[] = [
  {
    id: 'w-rune-rare',
    title: 'The Rare Find',
    description: 'Forge a Rare rune or better.',
    flavour: 'One in ten thousand. The Nocturne keep a wall of the ones that got away.',
    cadence: 'weekly',
    metric: 'rune-tier',
    target: 2,
    gold: 25_000,
    rarity: 'sacred',
  },
  {
    id: 'w-rune-epic',
    title: 'The Better Find',
    description: 'Forge an Epic rune or better.',
    flavour: 'Epic is where the tier table stops being a curve and starts being a promise.',
    cadence: 'weekly',
    metric: 'rune-tier',
    target: 3,
    gold: 120_000,
    rarity: 'anomalous',
  },
  {
    id: 'w-exp-20',
    title: 'Twenty Roads',
    description: 'Complete 20 expeditions.',
    flavour: 'Twenty returns is a season of work for a roster of one and a fortnight for a roster of five.',
    cadence: 'weekly',
    metric: 'expedition-done',
    target: 20,
    gold: 50_000,
    rarity: 'sacred',
  },
  {
    id: 'w-exp-deep-3',
    title: 'The Deep Rota',
    description: 'Complete 3 expeditions of Deep Dive length or longer.',
    flavour: 'Three long runs in seven days. Somebody is planning rather than clicking.',
    cadence: 'weekly',
    metric: 'expedition-deep',
    target: 3,
    gold: 90_000,
    rarity: 'anomalous',
  },
  {
    id: 'w-mine-100',
    title: 'Empty the Seam',
    description: 'Bring back 100 materials.',
    flavour: 'A hundred strikes and the Seamworks starts giving up things it was not asked for.',
    cadence: 'weekly',
    metric: 'material-mined',
    target: 100,
    gold: 30_000,
    rarity: 'sacred',
  },
  {
    id: 'w-forge-1000',
    title: 'A Thousand Strikes',
    description: 'Strike 1,000 runes at the forge.',
    flavour: 'The number the Luminous smiths use to mean "long enough to stop counting".',
    cadence: 'weekly',
    metric: 'rune-forged',
    target: 1_000,
    gold: 45_000,
    rarity: 'sacred',
  },
  {
    id: 'w-level-5',
    title: 'Rank of Five',
    description: 'Reach Keeper rank 5.',
    flavour: 'Five is where the Abyss stops refusing to open.',
    cadence: 'weekly',
    metric: 'level',
    target: 5,
    gold: 100_000,
    rarity: 'anomalous',
  },
  {
    id: 'w-level-10',
    title: 'Rank of Ten',
    description: 'Reach Keeper rank 10.',
    flavour: 'Ten, and the Archivum starts writing your name down without being asked.',
    cadence: 'weekly',
    metric: 'level',
    target: 10,
    gold: 250_000,
    rarity: 'anomalous',
  },
  {
    id: 'w-gold-25m',
    title: 'The Week\'s Take',
    description: 'Earn 25,000,000 Gold.',
    flavour: 'Twenty-five million. The vault has stopped being a room and become a policy.',
    cadence: 'weekly',
    metric: 'gold-earned',
    target: 25_000_000,
    gold: 60_000,
    rarity: 'sacred',
  },
  {
    id: 'w-runeword-1',
    title: 'Speak the Word',
    description: 'Craft a Runeword.',
    flavour: 'Three runes in the right order stop being three runes.',
    cadence: 'weekly',
    metric: 'runeword-crafted',
    target: 1,
    gold: 150_000,
    rarity: 'anomalous',
  },
  {
    id: 'w-halls-13',
    title: 'The Whole Register',
    description: 'Stand in 13 different halls of the world.',
    flavour: 'Thirteen doors. At this point the Archivum stops filing you under "visitor".',
    cadence: 'weekly',
    metric: 'hall-variety',
    // Thirteen of the sixteen halls the router actually has, so the card asks
    // for nearly everywhere without asking for the one nobody can reach.
    target: 13,
    gold: 35_000,
    rarity: 'sacred',
  },
  {
    id: 'w-upgrade-10',
    title: 'The Whetstone Week',
    description: 'Upgrade or temper ten items.',
    flavour: 'Ten improvements is a smith who has stopped hoping the drop table will do it for them.',
    cadence: 'weekly',
    metric: 'item-upgraded',
    target: 10,
    gold: 40_000,
    rarity: 'sacred',
  },
];

export const ALL_CHALLENGES: readonly ChallengeDefinition[] = [
  ...DAILY_CHALLENGES,
  ...WEEKLY_CHALLENGES,
];

const CHALLENGE_BY_ID = new Map(ALL_CHALLENGES.map(c => [c.id, c]));

export function challengeById(id: string): ChallengeDefinition | undefined {
  return CHALLENGE_BY_ID.get(id);
}

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
