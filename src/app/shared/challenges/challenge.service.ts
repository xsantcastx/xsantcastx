/**
 * challenge.service.ts — the Contract Board's state machine.
 *
 * Holds two counter ledgers (today, this week), rolls them over on the same
 * clocks the quest board uses, resolves every authored challenge against them,
 * and is the only place Gold is paid for one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS ON DISK AND WHAT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * The same split QuestService makes, and for the same reason: **challenges are
 * never persisted, only counters are.** The board is recomputed from the pools
 * on every publish, so retuning a target in `challenge.model.ts` changes what
 * every visitor sees on the next load with no migration — and a challenge that
 * has already been claimed can never be redrawn into a second payout, because
 * the receipt is keyed by period rather than by board position.
 *
 * The streak is the exception, and it has to be: "seven days in a row" is a fact
 * about days that are already over, and no counter for today can reconstruct it.
 * So `streak` and `streakDay` are stored, and they are the only two fields here
 * that a lost save genuinely costs the player.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BOOST IS MIRRORED INTO THE ECONOMY, NOT STORED THERE
 * ─────────────────────────────────────────────────────────────────────────────
 * `EconomyService.setEventBoost` is a setter with no persistence, exactly like
 * `setRankLevel` and `setRpgFlatGold` — the economy is *told* what the boost is
 * by whoever owns it. This service owns it, persists it in its own blob, and
 * pushes it in on init, on claim and on expiry.
 *
 * The alternative — a `boostUntil` field on `PlayerEconomy` — would put a
 * wall-clock deadline inside the blob that offline settlement replays from, and
 * settling eight hours of idle Gold across a boost that expired ninety minutes
 * in is arithmetic nobody wants to write or debug. See the note on
 * `EconomyService.setEventBoost` for why the boost pays on *events* only.
 *
 * SSR: every mutation is behind `isBrowser` and `init()` returns early on the
 * server, so the prerender renders an empty board rather than touching storage.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { RUNES, Rune } from '../rune-forge/rune.model';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  dayKey,
  nextMidnight,
  nextMonday,
  weekKey,
} from '../quests/quest.model';
import {
  ALL_CHALLENGES,
  Challenge,
  ChallengeDefinition,
  ChallengeMetric,
  ChallengeStatus,
  CHALLENGE_KEY,
  DAILY_CHALLENGES,
  DAILY_CHALLENGE_SLOTS,
  DERIVED_METRICS,
  PEAK_METRICS,
  SET_METRICS,
  STREAK_BOOST_MS,
  STREAK_BOOST_MULTIPLIER,
  STREAK_CHEST_AT,
  STREAK_CHEST_FLOOR,
  WEEKLY_CHALLENGES,
  WEEKLY_CHALLENGE_SLOTS,
  challengeById,
  pickDistinctMetrics,
  tierRank,
} from './challenge.model';

/** One line of the claim history. */
export interface ChallengeLogEntry {
  id: string;
  title: string;
  cadence: ChallengeDefinition['cadence'];
  /** Gold actually credited, boost included. */
  gold: number;
  /** ISO instant the reward was claimed. */
  at: string;
}

/** metric → observed value, for one period. */
type Counters = Partial<Record<ChallengeMetric, number>>;

/** metric → the distinct things seen, for one period. */
type Members = Partial<Record<ChallengeMetric, string[]>>;

/**
 * A set never grows past this. The site cannot produce more distinct tool
 * routes than it has tools, and a hand-edited blob must not be able to make the
 * board's own storage unbounded.
 */
const SET_CAP = 512;

interface ChallengeState {
  version: 1;
  dayKey: string;
  weekKey: string;
  day: Counters;
  week: Counters;
  /**
   * Distinct members per set metric, one bag per period.
   *
   * Persisted rather than held in memory for the session, because a set that
   * emptied on reload would let the same tool page count five times toward
   * "visit 5 different tool pages" — which is a 1,500 Gold exploit that costs
   * one F5 to find.
   */
  daySets: Members;
  weekSets: Members;
  /**
   * Receipts: `id@2026-08-19` for a daily, `id@W2026-08-17` for a weekly.
   * Period-keyed, so tomorrow's draw of the same challenge is a new challenge.
   */
  claimed: string[];
  /** Consecutive days the whole daily board was cleared. */
  streak: number;
  /** The day the streak last advanced, so it can only advance once a day. */
  streakDay: string;
  /** Epoch ms the double-Gold window ends. 0 when none is running. */
  boostUntil: number;
  /** Seven-day chests opened, lifetime. Shown on the streak card. */
  chests: number;
  /** Lifetime Gold this board has paid. */
  goldPaid: number;
  log: ChallengeLogEntry[];
}

function emptyState(): ChallengeState {
  return {
    version: 1,
    dayKey: '',
    weekKey: '',
    day: {},
    week: {},
    daySets: {},
    weekSets: {},
    claimed: [],
    streak: 0,
    streakDay: '',
    boostUntil: 0,
    chests: 0,
    goldPaid: 0,
    log: [],
  };
}

/** What the panel renders. */
export interface ChallengeBoard {
  daily: Challenge[];
  weekly: Challenge[];
  /** ISO instant the daily board redraws. */
  dailyResetAt: string;
  /** ISO instant the weekly board redraws. */
  weeklyResetAt: string;
  /** Finished but unclaimed, across both cadences. The badge number. */
  unclaimed: number;
  /** True once every daily on the board has been claimed. */
  dailySwept: boolean;
  streak: number;
  chests: number;
  /** Epoch ms the boost ends, or 0. */
  boostUntil: number;
  goldPaid: number;
  log: ChallengeLogEntry[];
}

/** Emitted on a claim so the panel can celebrate without polling. */
export interface ChallengeClaim {
  challenge: Challenge;
  /** Gold credited, boost included. */
  gold: number;
  /** True when this claim swept the daily board and lit the boost. */
  sweep: boolean;
  /** The rune the seven-day chest paid, when this claim opened one. */
  chestRune?: Rune;
}

/** History kept on disk. The panel shows the newest handful. */
const LOG_CAP = 40;

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly runeForge = inject(RuneForgeService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private state: ChallengeState = emptyState();
  private initialised = false;
  private boostTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly board$$ = new BehaviorSubject<ChallengeBoard>(this.computeBoard());
  private readonly claim$$ = new Subject<ChallengeClaim>();

  /** The current board, replayed to late subscribers. */
  readonly board$: Observable<ChallengeBoard> = this.board$$.asObservable();
  /** Fires once per claim. Not replayed — a missed claim is a missed animation. */
  readonly claim$: Observable<ChallengeClaim> = this.claim$$.asObservable();

  get board(): ChallengeBoard { return this.board$$.value; }

  /** True while the sweep boost is paying. */
  get boostActive(): boolean {
    return this.state.boostUntil > Date.now();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /** Hydrate, roll the clocks forward, publish. Idempotent. */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.state = this.load();
    // The XP ledger backs the `level` metric. Fire-and-forget: the board
    // republishes off `snapshot$` below when hydration lands.
    void this.xp.init();
    this.rollPeriods();
    this.pushBoost();
    this.publish();

    this.xp.snapshot$.subscribe(() => this.publish());

    // `persist()` writes this whole blob from memory, so a merged log or a
    // longer streak arriving from another device would be dropped by the next
    // claim if it were not re-read here.
    this.saves.register(CHALLENGE_KEY, { rehydrate: () => this.rehydrate() });
  }

  /** Re-read from storage after a cloud merge. */
  private rehydrate(): void {
    if (!this.isBrowser) return;
    this.state = this.load();
    // Not `rollPeriods()` — same reasoning as QuestService.rehydrate: the merged
    // blob carries the later of the two devices' period keys, and rolling here
    // would wipe counters the other device has already filled in for today.
    this.pushBoost();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Recording
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Add to a counted metric in both periods at once.
   *
   * Writing day and week together is what lets one event feed a daily and a
   * weekly without the caller knowing which challenges are on the board — the
   * wiring layer reports what happened and the board decides whether it cares.
   */
  record(metric: ChallengeMetric, by = 1): void {
    if (!this.isBrowser || by <= 0) return;
    if (PEAK_METRICS.has(metric) || DERIVED_METRICS.has(metric) || SET_METRICS.has(metric)) return;
    // Two of the writers — the explorer and the activity gateway — push from
    // inside their own transactions and can therefore reach this before
    // `AppComponent` has started the wiring layer. Hydrating here rather than
    // assuming it has happened is what stops that write landing on an empty
    // in-memory state and then being overwritten by the `load()` that follows.
    // `init` is idempotent, so on every other call this is a boolean check.
    this.init();
    this.rollPeriods();
    this.state.day[metric] = (this.state.day[metric] ?? 0) + by;
    this.state.week[metric] = (this.state.week[metric] ?? 0) + by;
    this.persist();
    this.publish();
  }

  /**
   * Raise a peak metric's high water mark. A lower value is a no-op.
   *
   * Separate from `record` rather than a flag on it because the two are not the
   * same operation and conflating them is how a combo of 60 twice quietly
   * clears an "x100" card.
   */
  recordPeak(metric: ChallengeMetric, value: number): void {
    if (!this.isBrowser || !Number.isFinite(value) || value <= 0) return;
    if (!PEAK_METRICS.has(metric)) return;
    this.init();
    this.rollPeriods();
    const day = this.state.day[metric] ?? 0;
    const week = this.state.week[metric] ?? 0;
    if (value <= day && value <= week) return;
    this.state.day[metric] = Math.max(day, value);
    this.state.week[metric] = Math.max(week, value);
    this.persist();
    this.publish();
  }

  /**
   * Add a distinct member to a set metric in both periods. A member already
   * held is a no-op, which is the whole point of the metric family.
   */
  recordMember(metric: ChallengeMetric, member: string): void {
    if (!this.isBrowser || !member) return;
    if (!SET_METRICS.has(metric)) return;
    this.init();
    this.rollPeriods();
    let changed = false;
    for (const bag of [this.state.daySets, this.state.weekSets]) {
      const list = bag[metric] ?? (bag[metric] = []);
      if (!list.includes(member) && list.length < SET_CAP) {
        list.push(member);
        changed = true;
      }
    }
    if (!changed) return;
    this.persist();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Claiming
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Bank a finished challenge's Gold. False when the challenge is not on the
   * board, not finished, or already claimed — the three ways a double payout
   * could otherwise happen.
   */
  claim(id: string): boolean {
    if (!this.isBrowser) return false;

    const challenge = this.findOnBoard(id);
    if (!challenge || challenge.status !== 'completed') return false;

    const receipt = this.receiptFor(challenge);
    if (this.state.claimed.includes(receipt)) return false;
    this.state.claimed.push(receipt);
    this.persist();

    // Paid only after the receipt is written and flushed. If the mint threw,
    // the challenge stays claimed rather than becoming an infinite faucet —
    // the same ordering `QuestService.claim` and `ExplorerService.settle` use.
    const gold = this.economy.earnGold(challenge.gold, 'challenge');

    this.state.goldPaid += gold;
    this.state.log.unshift({
      id: challenge.id,
      title: challenge.title,
      cadence: challenge.cadence,
      gold,
      at: new Date().toISOString(),
    });
    this.state.log = this.state.log.slice(0, LOG_CAP);

    // The sweep is resolved after this claim is banked, because "every daily
    // claimed" has to include the one that just landed.
    const sweep = this.settleSweep();

    this.persist();
    this.publish();
    this.claim$$.next({
      challenge: { ...challenge, status: 'claimed' },
      gold,
      sweep: sweep.swept,
      chestRune: sweep.chestRune,
    });
    return true;
  }

  /**
   * Clearing the whole daily board lights the boost and advances the streak.
   *
   * Guarded on `streakDay` rather than on the boost's own deadline: a player who
   * sweeps the board, waits for the hour to run out and then reloads must not be
   * able to re-light it, and the only fact that cannot be replayed is "the
   * streak already advanced today".
   */
  private settleSweep(): { swept: boolean; chestRune?: Rune } {
    const dk = this.state.dayKey;
    const swept = this.board$$.value.daily.length > 0
      && this.dailyDefinitions().every(def => this.state.claimed.includes(`${def.id}@${dk}`));
    if (!swept || this.state.streakDay === dk) return { swept: false };

    // Yesterday's key, computed by walking a Date back a day rather than by
    // subtracting 86,400,000 from now: the two disagree on the days either side
    // of a DST change, and a player who lost a streak to the clocks going
    // forward would be entirely right to be annoyed about it.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const continued = this.state.streakDay === dayKey(yesterday);

    this.state.streak = continued ? this.state.streak + 1 : 1;
    this.state.streakDay = dk;
    this.state.boostUntil = Date.now() + STREAK_BOOST_MS;
    this.pushBoost();

    let chestRune: Rune | undefined;
    if (this.state.streak > 0 && this.state.streak % STREAK_CHEST_AT === 0) {
      chestRune = this.openChest();
      this.state.chests += 1;
    }

    return { swept: true, chestRune };
  }

  /**
   * The seven-day chest: one rune at `STREAK_CHEST_FLOOR` or better, banked
   * through the Rune Forge so it counts toward Runewords, rolls its Lore Scroll
   * and mints its equippable exactly as a found rune does.
   *
   * Drawn from the floor's own weights rather than uniformly across the tiers
   * above it — a chest that paid Mythic as often as Rare would be a better
   * source of Mythics than twenty billion Gold of strikes, which is the number
   * the drop table was tuned around.
   */
  private openChest(): Rune | undefined {
    const floor = tierRank(STREAK_CHEST_FLOOR);
    const pool = RUNES.filter(r => tierRank(r.tier) >= floor);
    if (!pool.length) return undefined;

    const total = pool.reduce((sum, r) => sum + r.dropRate, 0);
    let roll = Math.random() * total;
    let chosen = pool[0];
    for (const rune of pool) {
      roll -= rune.dropRate;
      if (roll <= 0) { chosen = rune; break; }
    }
    this.runeForge.grant(chosen);
    return chosen;
  }

  /** Wipe the board and every counter behind it. Used by the progression reset. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyState();
    this.store.remove(CHALLENGE_KEY);
    this.clearBoostTimer();
    this.economy.setEventBoost(1, 0);
    this.rollPeriods();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Board assembly
  // ───────────────────────────────────────────────────────────────────────────

  private findOnBoard(id: string): Challenge | undefined {
    const b = this.board$$.value;
    return [...b.daily, ...b.weekly].find(c => c.id === id);
  }

  private receiptFor(c: Challenge): string {
    return c.cadence === 'daily'
      ? `${c.id}@${this.state.dayKey}`
      : `${c.id}@${this.state.weekKey}`;
  }

  /** Today's three, as definitions. The sweep check needs them without resolving. */
  private dailyDefinitions(): readonly ChallengeDefinition[] {
    return pickDistinctMetrics(
      DAILY_CHALLENGES,
      DAILY_CHALLENGE_SLOTS,
      this.state.dayKey || dayKey(),
    );
  }

  private computeBoard(): ChallengeBoard {
    const now = new Date();
    const dk = this.state.dayKey || dayKey(now);
    const wk = this.state.weekKey || weekKey(now);
    const dailyResetAt = nextMidnight(now);
    const weeklyResetAt = nextMonday(now);

    const daily = pickDistinctMetrics(DAILY_CHALLENGES, DAILY_CHALLENGE_SLOTS, dk)
      .map(def => this.resolve(def, this.state.day, this.state.daySets, `${def.id}@${dk}`, dailyResetAt));
    const weekly = pickDistinctMetrics(WEEKLY_CHALLENGES, WEEKLY_CHALLENGE_SLOTS, wk)
      .map(def => this.resolve(def, this.state.week, this.state.weekSets, `${def.id}@${wk}`, weeklyResetAt));

    const all = [...daily, ...weekly];

    return {
      daily,
      weekly,
      dailyResetAt,
      weeklyResetAt,
      unclaimed: all.filter(c => c.status === 'completed').length,
      dailySwept: daily.length > 0 && daily.every(c => c.status === 'claimed'),
      streak: this.state.streak,
      chests: this.state.chests,
      // Expired boosts read as absent rather than as a stale timestamp, so the
      // panel never has to decide whether a past deadline means anything.
      boostUntil: this.state.boostUntil > Date.now() ? this.state.boostUntil : 0,
      goldPaid: this.state.goldPaid,
      log: this.state.log,
    };
  }

  /** An authored challenge plus this visitor's standing against it. */
  private resolve(
    def: ChallengeDefinition,
    counters: Counters,
    members: Members,
    receipt: string,
    expiresAt: string,
  ): Challenge {
    const target = Math.max(1, def.target);
    const observed = this.observe(def.metric, counters, members);
    const claimed = this.state.claimed.includes(receipt);
    const done = observed >= target;

    const status: ChallengeStatus = claimed ? 'claimed' : done ? 'completed' : 'active';

    return {
      ...def,
      observed: Math.min(observed, target),
      progress: Math.round(Math.min(1, observed / target) * 100),
      status,
      expiresAt,
    };
  }

  /**
   * How far along a metric is.
   *
   * Counted and peak metrics both read this board's own counters — the
   * difference between them is entirely in *how they were written*, which is
   * why there is no branch for it here. Derived metrics read the ledger that
   * already knows the answer.
   */
  private observe(metric: ChallengeMetric, counters: Counters, members: Members): number {
    if (metric === 'level') return this.xp.snapshot.level.level;
    if (SET_METRICS.has(metric)) return members[metric]?.length ?? 0;
    return counters[metric] ?? 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The boost
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Tell the economy what the boost is, and schedule the publish that ends it.
   *
   * The timer exists to *redraw the panel* when the hour runs out — it is not
   * what makes the boost expire. Expiry is `boostUntil` against the wall clock,
   * checked inside `earnGold`, so a throttled tab that never fires this timeout
   * still stops paying double on the correct second. Same reasoning as the
   * expedition clock, and the same consequence: closing the tab is harmless.
   */
  private pushBoost(): void {
    this.clearBoostTimer();
    const remaining = this.state.boostUntil - Date.now();
    if (remaining <= 0) {
      this.economy.setEventBoost(1, 0);
      return;
    }
    this.economy.setEventBoost(STREAK_BOOST_MULTIPLIER, this.state.boostUntil);
    this.boostTimer = setTimeout(() => {
      this.boostTimer = null;
      this.economy.setEventBoost(1, 0);
      this.publish();
    }, remaining + 250);
  }

  private clearBoostTimer(): void {
    if (this.boostTimer === null) return;
    clearTimeout(this.boostTimer);
    this.boostTimer = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Clocks and storage
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reset whichever periods have elapsed. Called before every write and on
   * init rather than on a timer: a tab left open overnight settles on the first
   * event after midnight, and a tab that sees no events has nothing to settle.
   */
  private rollPeriods(): void {
    const dk = dayKey();
    const wk = weekKey();
    let dirty = false;

    if (this.state.dayKey !== dk) {
      this.state.dayKey = dk;
      this.state.day = {};
      this.state.daySets = {};
      dirty = true;
    }
    if (this.state.weekKey !== wk) {
      this.state.weekKey = wk;
      this.state.week = {};
      this.state.weekSets = {};
      dirty = true;
    }
    if (!dirty) return;

    // A streak that skipped a day is over. Checked here rather than on claim so
    // that a player who opens the panel after a week away sees a cold flame
    // rather than a seven that is about to silently become a one.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (this.state.streakDay && this.state.streakDay !== dk && this.state.streakDay !== dayKey(yesterday)) {
      this.state.streak = 0;
    }

    // Receipts for periods that have rolled over are dead weight.
    this.state.claimed = this.state.claimed.filter(r => {
      const at = r.indexOf('@');
      if (at < 0) return false;
      const period = r.slice(at + 1);
      return period === dk || period === wk;
    });
    this.persist();
  }

  private load(): ChallengeState {
    try {
      const raw = this.store.readRaw(CHALLENGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<ChallengeState>;
      const empty = emptyState();

      // Every field is rebuilt rather than spread over the default, because the
      // blob is user-writable: a hand-edited `boostUntil` holding a string would
      // otherwise reach `setEventBoost` and multiply every payout by NaN.
      return {
        version: 1,
        dayKey: typeof parsed.dayKey === 'string' ? parsed.dayKey : empty.dayKey,
        weekKey: typeof parsed.weekKey === 'string' ? parsed.weekKey : empty.weekKey,
        day: sanitiseCounters(parsed.day),
        week: sanitiseCounters(parsed.week),
        daySets: sanitiseMembers(parsed.daySets),
        weekSets: sanitiseMembers(parsed.weekSets),
        claimed: Array.isArray(parsed.claimed)
          ? parsed.claimed.filter(r => typeof r === 'string' && isKnownReceipt(r))
          : empty.claimed,
        streak: clampInt(parsed.streak, 0),
        streakDay: typeof parsed.streakDay === 'string' ? parsed.streakDay : empty.streakDay,
        // Capped at the boost's own length ahead of now, so a hand-edited
        // deadline in the year 3000 buys an hour rather than a permanent x2.
        boostUntil: Math.min(clampInt(parsed.boostUntil, 0), Date.now() + STREAK_BOOST_MS),
        chests: clampInt(parsed.chests, 0),
        goldPaid: clampInt(parsed.goldPaid, 0),
        log: Array.isArray(parsed.log) ? parsed.log.filter(isLogEntry).slice(0, LOG_CAP) : empty.log,
      };
    } catch {
      return emptyState();
    }
  }

  private persist(): void {
    if (!this.isBrowser) return;
    this.store.write(CHALLENGE_KEY, this.state);
  }

  private publish(): void {
    this.board$$.next(this.computeBoard());
  }
}

/** Known metric keys holding finite non-negative numbers. Everything else is dropped. */
function sanitiseCounters(v: unknown): Counters {
  if (!v || typeof v !== 'object') return {};
  const out: Counters = {};
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
    out[key as ChallengeMetric] = value;
  }
  return out;
}

/** Known metric keys holding arrays of strings. Everything else is dropped. */
function sanitiseMembers(v: unknown): Members {
  if (!v || typeof v !== 'object') return {};
  const out: Members = {};
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    out[key as ChallengeMetric] = value
      .filter((m): m is string => typeof m === 'string')
      .slice(0, SET_CAP);
  }
  return out;
}

/**
 * A receipt for a challenge that still exists.
 *
 * Dropping receipts whose id has left the pool matters more here than on the
 * quest board: a retired challenge's receipt would sit in the array until its
 * period rolled, and on a weekly that is up to seven days of a row that can
 * never match anything.
 */
function isKnownReceipt(r: string): boolean {
  const at = r.indexOf('@');
  if (at <= 0) return false;
  return challengeById(r.slice(0, at)) !== undefined;
}

function isLogEntry(v: unknown): v is ChallengeLogEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Partial<ChallengeLogEntry>;
  return typeof e.id === 'string'
    && typeof e.title === 'string'
    && (e.cadence === 'daily' || e.cadence === 'weekly')
    && typeof e.gold === 'number' && Number.isFinite(e.gold)
    && typeof e.at === 'string';
}

function clampInt(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

/** Re-exported so callers can look a challenge up without importing the model too. */
export { ALL_CHALLENGES, challengeById };
