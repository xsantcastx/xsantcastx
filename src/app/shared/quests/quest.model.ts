/**
 * quest.model.ts — the mission board's data layer.
 *
 * Three ladders, each on its own clock:
 *
 *   daily   three of thirty, rerolled at local midnight
 *   weekly  two of eight, rerolled Monday
 *   epic    five, permanent, cleared once and never again
 *
 * The daily and weekly draws are deterministic: the pool index is chosen from a
 * hash of the date key, not from Math.random(). Two consequences that are both
 * deliberate — every visitor on 2026-08-12 is handed the same three quests, so
 * the board is something people can talk about; and the roll survives a reload,
 * a second tab and a cleared localStorage without ever handing out a fresh set
 * of unclaimed rewards.
 *
 * Pure data and pure functions only. No browser APIs, so this file is safe to
 * import from a server-rendered path.
 */
import { EclipseRarity } from '../rarity/rarity.model';
import { EnergyType } from '../gamification/gamification.model';
import { RealmId } from '../realms/realm.model';

export type QuestType = 'daily' | 'weekly' | 'epic' | 'realm';

export type QuestStatus = 'available' | 'active' | 'completed' | 'expired';

/**
 * How a quest knows it is done.
 *
 * Conditions split into two families, and QuestService resolves them
 * differently:
 *
 *   counted   page-variety, page-visit, copy-count, arena-game, time-on-site —
 *             read from the activity buckets that
 *             QuestWiringService fills. `progressKey()` below is the single
 *             place that decides which bucket, so the writer and the reader can
 *             never disagree about a key.
 *
 *   derived   streak, level, achievement, energy-balance — read live off the
 *             XP ledger. Nothing to record; the answer is already in state.
 */
export type QuestConditionType =
  | 'page-variety'
  | 'page-visit'
  | 'copy-count'
  | 'arena-game'
  | 'time-on-site'
  | 'streak'
  | 'level'
  | 'achievement'
  | 'energy-balance';

export interface QuestCondition {
  type: QuestConditionType;
  /**
   * For `page-visit`: the exact routes that must be stood on. `count` must
   * equal this length, so a quest can never ask for more places than it names.
   */
  paths?: string[];
  /** The target. Progress is `min(observed, count) / count`. */
  count: number;
}

export interface QuestReward {
  xp: number;
  /**
   * Which energy the XP feeds. Omitted means the award is split by whatever the
   * quest's realm feeds, falling back to Aether — see `rewardEnergy()`.
   */
  energy?: EnergyType;
  /** Banks an achievement id on completion, so the epics leave a permanent mark. */
  achievement?: string;
  /** A line of codex text revealed in the claim toast. */
  loreFragment?: string;
}

/** The authored shape. Everything here is a constant; nothing is per-visitor. */
export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  /** Flavour, shown in italics under the title. This is the reason to read the card. */
  loreText: string;
  type: QuestType;
  realm?: RealmId;
  condition: QuestCondition;
  rewards: QuestReward;
  rarity: EclipseRarity;
}

/** The runtime shape: an authored quest plus this visitor's standing against it. */
export interface Quest extends QuestDefinition {
  status: QuestStatus;
  /** 0–100, for the bar. */
  progress: number;
  /** Raw observed count, for the "2/3 shadows forged" line. */
  observed: number;
  /** True once the reward has been banked. */
  claimed: boolean;
  /** ISO instant the daily/weekly board this quest sits on rolls over. */
  expiresAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket keys
// ─────────────────────────────────────────────────────────────────────────────

/** A tally counts events; a set counts distinct members. */
export type BucketKind = 'tally' | 'set';

export interface BucketAddress {
  kind: BucketKind;
  key: string;
}

/**
 * The bucket a counted condition reads from — and, called with the same shape
 * from the wiring service, the bucket an event writes to.
 *
 * Returns null for the derived conditions, which have no bucket at all.
 */
export function progressKey(c: QuestCondition): BucketAddress | null {
  switch (c.type) {
    case 'page-variety':
    case 'page-visit':
      // Both read the same set of visited paths. `page-variety` counts its
      // size; `page-visit` counts how many of its named paths are members.
      return { kind: 'set', key: 'pages' };
    case 'copy-count':
      return { kind: 'tally', key: 'copy' };
    case 'arena-game':
      return { kind: 'set', key: 'arena' };
    case 'time-on-site':
      return { kind: 'tally', key: 'minutes' };
    default:
      return null;
  }
}

/** Which energy a quest's XP feeds, resolved from an explicit reward or its realm. */
export function rewardEnergy(quest: QuestDefinition): EnergyType {
  if (quest.rewards.energy) return quest.rewards.energy;
  return quest.realm === 'umbral' || quest.realm === 'verge' ? 'nox' : 'aether';
}

// ─────────────────────────────────────────────────────────────────────────────
// Date keys and the deterministic draw
// ─────────────────────────────────────────────────────────────────────────────

/** Local YYYY-MM-DD. Local, not UTC — midnight should be the visitor's midnight. */
export function dayKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Local ISO-ish week key, `YYYY-Www`, with weeks starting Monday.
 *
 * Computed by walking back to the Monday of the current week and keying on that
 * date rather than by counting weeks from January 1. Year boundaries are where
 * hand-rolled week numbering goes wrong, and "the Monday this week began" is
 * both unambiguous and exactly what the weekly board resets on.
 */
export function weekKey(d: Date = new Date()): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay(): 0 = Sunday. Sunday belongs to the week that began six days ago.
  const back = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - back);
  return `W${dayKey(monday)}`;
}

/** Midnight tonight, local, as an ISO instant. The daily board's expiry. */
export function nextMidnight(d: Date = new Date()): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return next.toISOString();
}

/** 00:00 next Monday, local, as an ISO instant. The weekly board's expiry. */
export function nextMonday(d: Date = new Date()): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const ahead = (8 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + ahead);
  return next.toISOString();
}

/** FNV-1a, 32-bit. Small, dependency-free, and well-spread over short strings. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Pick `n` distinct entries from `pool`, chosen only by `seed`.
 *
 * Walks the pool from a hashed starting offset in a hashed co-prime stride, so
 * the picks are spread across the pool rather than clustered, and the same seed
 * always yields the same set. A stride co-prime with the length guarantees the
 * walk visits every index before repeating, which is what makes "distinct"
 * true without a rejection loop.
 */
export function pickDeterministic<T>(pool: readonly T[], n: number, seed: string): T[] {
  if (n <= 0) return [];
  return orderDeterministic(pool, seed).slice(0, n);
}

/**
 * The whole pool, permuted by `seed` alone.
 *
 * `pickDeterministic` is this plus a `slice`, and the two are one function
 * because a caller that needs to *skip* entries — the Contract Board rejects a
 * second card with the same objective — has to be able to keep walking the same
 * order rather than re-hashing with a nudged seed. A nudged seed is a different
 * walk, which means it can hand back an entry the first walk already used, and
 * the loop that works around that is a rejection sampler over a permutation
 * that was already available.
 */
export function orderDeterministic<T>(pool: readonly T[], seed: string): T[] {
  if (pool.length === 0) return [];
  if (pool.length === 1) return [...pool];

  const h = hash32(seed);
  const start = h % pool.length;
  // Force odd, then walk up until it shares no factor with the pool length.
  let stride = ((h >>> 8) % pool.length) | 1;
  while (gcd(stride, pool.length) !== 1) stride++;

  const out: T[] = [];
  for (let i = 0; i < pool.length; i++) out.push(pool[(start + i * stride) % pool.length]);
  return out;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// The daily pool — three drawn a day
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Targets are deliberately small. A daily quest that cannot be finished in one
 * sitting is not a daily quest, it is a chore with a countdown on it.
 */
export const DAILY_QUESTS: QuestDefinition[] = [
  {
    id: 'copy-merchant',
    title: 'Copy Merchant',
    description: 'Carry ten outputs out of the realms.',
    loreText: 'The merchants take nothing and leave nothing. They only move things, which the realms have never decided how to feel about.',
    type: 'daily',
    condition: { type: 'copy-count', count: 10 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'the-explorer',
    title: 'The Explorer',
    description: 'Stand in five different halls.',
    loreText: 'Maps are drawn by people who walked further than they were asked to.',
    type: 'daily',
    condition: { type: 'page-variety', count: 5 },
    rewards: { xp: 20 },
    rarity: 'eclipsed',
  },
  {
    id: 'the-long-vigil',
    title: 'The Long Vigil',
    description: 'Spend ten minutes in the realms.',
    loreText: 'Not every rank is earned by doing. Some are earned by staying.',
    type: 'daily',
    condition: { type: 'time-on-site', count: 10 },
    rewards: { xp: 20 },
    rarity: 'mortal',
  },

  {
    id: 'walk-the-world',
    title: 'Walk the World',
    description: 'Step into the world.',
    loreText: 'Every road in the five realms starts at the same table. The map does not care which one you take first.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/play'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'face-the-keeper',
    title: 'Face the Keeper',
    description: 'Open your character sheet.',
    loreText: 'The chamber writes down whoever walks in. That is the whole of the rite.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/character'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'strike-the-anvil',
    title: 'Strike the Anvil',
    description: 'Enter the Forge.',
    loreText: 'The anvil does not ask what you came to make. It only asks that you stand close enough to hear it.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/forge/crafting'], count: 1 },
    rewards: { xp: 20 },
    rarity: 'eclipsed',
  },
  {
    id: 'enter-the-trials',
    title: 'Enter the Trials',
    description: 'Walk the Arena gates.',
    loreText: 'Thirteen doors, and none of them open from the outside. Standing in front of them is still a kind of answer.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/world/trials'], count: 1 },
    rewards: { xp: 20 },
    rarity: 'eclipsed',
  },
  {
    id: 'read-the-orders',
    title: 'Read the Orders',
    description: 'Open the standing orders.',
    loreText: 'The board is posted whether anyone reads it or not. The Archivum counts the ones who do.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/world/quests'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'visit-the-market',
    title: 'Visit the Market',
    description: 'Walk the market aisle.',
    loreText: 'Nothing here is free, and nothing here is required. That is why the merchants stay.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/market'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'open-the-codex',
    title: 'Open the Codex',
    description: 'Open the ancient record.',
    loreText: 'The Codex does not care whether you came to remember or to look for what you have not found yet.',
    type: 'daily',
    condition: { type: 'page-visit', paths: ['/codex'], count: 1 },
    rewards: { xp: 15 },
    rarity: 'mortal',
  },
  {
    id: 'one-gate',
    title: 'One Gate',
    description: 'Enter any Arena gate.',
    loreText: 'The first chain is the only one that feels like a lock. The rest feel like doors you already know how to open.',
    type: 'daily',
    condition: { type: 'arena-game', count: 1 },
    rewards: { xp: 25 },
    rarity: 'eclipsed',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// The weekly pool — two drawn a week
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weeklies are the ones you cannot finish by accident. Every target here needs
 * more than one sitting, which is the whole point: the daily board is a habit,
 * the weekly board is a reason to keep the habit.
 */
export const WEEKLY_QUESTS: QuestDefinition[] = [
  {
    id: 'arena-champion',
    title: 'Arena Champion',
    description: 'Clear three different Arena games.',
    loreText: 'Thirteen gates, each chained by a secret. The chain is not the test. What is behind it is the test.',
    type: 'weekly',
    condition: { type: 'arena-game', count: 3 },
    rewards: { xp: 75 },
    rarity: 'sacred',
  },
  {
    id: 'streak-keeper',
    title: 'Streak Keeper',
    description: 'Hold a seven-day streak.',
    loreText: 'The realms do not care how hard you worked on one day. They count the days you came back, and they count them out loud.',
    type: 'weekly',
    condition: { type: 'streak', count: 7 },
    rewards: { xp: 100 },
    rarity: 'anomalous',
  },
  {
    id: 'the-architects-eye',
    title: 'The Architect\'s Eye',
    description: 'Walk the World and open the Codex.',
    loreText: 'Two rooms nobody is required to enter. The Archivum has always held that the people who enter them anyway are the ones worth watching.',
    type: 'weekly',
    condition: { type: 'page-visit', paths: ['/play', '/codex'], count: 2 },
    rewards: { xp: 50, energy: 'aether' },
    rarity: 'sacred',
  },
  {
    id: 'the-copyists-week',
    title: 'The Copyist\'s Week',
    description: 'Carry fifty outputs out of the realms.',
    loreText: 'Somewhere there is a ledger of everything ever taken from the archive. It is longer than the archive.',
    type: 'weekly',
    condition: { type: 'copy-count', count: 50 },
    rewards: { xp: 75 },
    rarity: 'sacred',
  },
  {
    id: 'walk-the-five-stations',
    title: 'Walk the Five Stations',
    description: 'Visit World, Character, the Forge, Quests and the Trials.',
    loreText: 'Five rooms, one week. The Convergents call it a circuit. Everyone else calls it showing up.',
    type: 'weekly',
    condition: {
      type: 'page-visit',
      paths: ['/play', '/character', '/forge/crafting', '/world/quests', '/world/trials'],
      count: 5,
    },
    rewards: { xp: 80 },
    rarity: 'sacred',
  },
  {
    id: 'the-long-week',
    title: 'The Long Week',
    description: 'Spend sixty minutes in the realms this week.',
    loreText: 'A week is long enough to stop pretending you were only passing through.',
    type: 'weekly',
    condition: { type: 'time-on-site', count: 60 },
    rewards: { xp: 75 },
    rarity: 'sacred',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// The epics — permanent, no clock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The epics are the only quests with no expiry, which means they are the only
 * ones whose progress is read from lifetime state rather than a bucket that
 * gets wiped. Clearing one banks an achievement id on the XP ledger, so it
 * survives everything short of a reset.
 */
export const EPIC_QUESTS: QuestDefinition[] = [
  {
    id: 'the-convergents-trial',
    title: 'The Convergent\'s Trial',
    description: 'Reach Level 5 — Convergent.',
    loreText: 'There is no ceremony. One morning the guards at both borders stop asking which realm you serve, and you understand that the answer has stopped being useful to them.',
    type: 'epic',
    condition: { type: 'level', count: 5 },
    rewards: {
      xp: 500,
      achievement: 'quest-convergent-trial',
      loreFragment: 'The Convergents were never a faction. They were an accounting error that learned to walk.',
    },
    rarity: 'sacred',
  },
  {
    id: 'the-balance',
    title: 'The Balance',
    description: 'Hold Aether and Nox within five percent of each other, past 1000 XP.',
    loreText: 'The Eclipse was not light defeating shadow, or shadow swallowing light. It was the one moment they were the same size, and it lasted four minutes.',
    type: 'epic',
    condition: { type: 'energy-balance', count: 5 },
    rewards: {
      xp: 200,
      achievement: 'quest-the-balance',
      loreFragment: 'Balance is not a resting state. It is a crossing, and you are only ever in it on the way to somewhere else.',
    },
    rarity: 'anomalous',
  },
  {
    id: 'godforge-keeper',
    title: 'Godforge Keeper',
    description: 'Reach Level 8 — Godforge Keeper.',
    loreText: 'The Godforge has had four keepers. Three of them left notes. The notes disagree about what the Godforge is.',
    type: 'epic',
    condition: { type: 'level', count: 8 },
    rewards: {
      xp: 1000,
      achievement: 'quest-godforge-keeper',
      loreFragment: 'The forge does not make things. It makes the conditions under which things can be made. This is a distinction the fourth keeper died insisting on.',
    },
    rarity: 'mythic',
  },
];

/** Every authored quest, for lookups by id. */
export const ALL_QUESTS: QuestDefinition[] = [
  ...DAILY_QUESTS,
  ...WEEKLY_QUESTS,
  ...EPIC_QUESTS,
];

export function questById(id: string): QuestDefinition | undefined {
  return ALL_QUESTS.find(q => q.id === id);
}

/**
 * True when a quest can be finished on a live game route — a guard against a
 * quest naming a retired tools-site path, which would sit on the board forever.
 */
export function isPlayableQuest(def: QuestDefinition): boolean {
  return !(def.condition.paths ?? []).some(path =>
    path === '/tools' || path.startsWith('/tools/') || path === '/blueprint' || path === '/embed');
}

export const PLAYABLE_DAILY_QUESTS = DAILY_QUESTS.filter(isPlayableQuest);
export const PLAYABLE_WEEKLY_QUESTS = WEEKLY_QUESTS.filter(isPlayableQuest);
export const PLAYABLE_EPIC_QUESTS = EPIC_QUESTS.filter(isPlayableQuest);

/** How many dailies and weeklies the board shows. */
export const DAILY_SLOTS = 3;
export const WEEKLY_SLOTS = 2;
