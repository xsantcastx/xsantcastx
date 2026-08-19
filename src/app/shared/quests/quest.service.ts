/**
 * quest.service.ts — the mission board's state machine.
 *
 * Holds three activity ledgers (today, this week, forever), rolls two of them
 * over on their own clocks, resolves every authored quest against them, and is
 * the only place a reward is ever paid.
 *
 * The split that makes this work: **quests are never persisted, only activity
 * is.** State on disk is a bag of counters plus a list of claim receipts. The
 * board is recomputed from the pools every time something changes. That means
 * editing a quest's target in quest.model.ts changes what every visitor sees on
 * the next load, with no migration — and it means a quest that has already been
 * claimed can never be re-rolled into a second payout, because the receipt is
 * keyed by period, not by board position.
 *
 * SSR: every mutation is behind `isBrowser`, and `init()` returns early on the
 * server, so the prerender renders an empty board rather than touching storage.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { XpService } from '../gamification/xp.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { canonicalizePlayerPath, rewriteCanonicalPageSet } from '../canonical-routes';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  DAILY_SLOTS,
  PLAYABLE_DAILY_QUESTS,
  PLAYABLE_EPIC_QUESTS,
  PLAYABLE_WEEKLY_QUESTS,
  Quest,
  QuestCondition,
  QuestDefinition,
  QuestStatus,
  WEEKLY_SLOTS,
  dayKey,
  nextMidnight,
  nextMonday,
  pickDeterministic,
  progressKey,
  questById,
  rewardEnergy,
  weekKey,
} from './quest.model';

export const QUEST_KEY = 'eclipse-quests';

/** Tallies and distinct-member sets for one period. */
interface Buckets {
  /** key → count */
  n: Record<string, number>;
  /** key → distinct members */
  s: Record<string, string[]>;
}

function emptyBuckets(): Buckets {
  return { n: {}, s: {} };
}

/** One line of the completion history. */
export interface QuestLogEntry {
  id: string;
  title: string;
  type: QuestDefinition['type'];
  xp: number;
  /** ISO instant the reward was claimed. */
  at: string;
}

interface QuestState {
  version: 1;
  dayKey: string;
  weekKey: string;
  day: Buckets;
  week: Buckets;
  life: Buckets;
  /**
   * Receipts, not quest ids: `id@2026-08-12` for a daily, `id@W2026-08-10` for
   * a weekly, bare `id` for an epic. Period-keyed so tomorrow's roll of the
   * same quest is genuinely a new quest.
   */
  claimed: string[];
  log: QuestLogEntry[];
  totalCompleted: number;
}

function emptyState(): QuestState {
  return {
    version: 1,
    dayKey: '',
    weekKey: '',
    day: emptyBuckets(),
    week: emptyBuckets(),
    life: emptyBuckets(),
    claimed: [],
    log: [],
    totalCompleted: 0,
  };
}

/** What the drawer and the /quests page render. */
export interface QuestBoard {
  daily: Quest[];
  weekly: Quest[];
  epic: Quest[];
  /** ISO instant the daily board rerolls. */
  dailyResetAt: string;
  /** ISO instant the weekly board rerolls. */
  weeklyResetAt: string;
  /** Finished but unclaimed — the number on the header badge. */
  unclaimed: number;
  /** Daily + weekly still in progress. Drives "3 quests waiting". */
  openCount: number;
  completedThisWeek: number;
  totalCompleted: number;
  log: QuestLogEntry[];
}

/** Emitted on a claim, so the UI can celebrate without polling. */
export interface QuestClaim {
  quest: Quest;
  xp: number;
}

/** A set never grows past this. The site cannot produce more distinct members. */
const SET_CAP = 512;
/** History kept on disk. The page shows the last seven days out of this. */
const LOG_CAP = 60;

@Injectable({ providedIn: 'root' })
export class QuestService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly xp = inject(XpService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private state: QuestState = emptyState();
  private initialised = false;

  private readonly board$$ = new BehaviorSubject<QuestBoard>(this.computeBoard());
  private readonly claim$$ = new Subject<QuestClaim>();
  private readonly drawerOpen$$ = new BehaviorSubject<boolean>(false);

  /** The current board, replayed to late subscribers. */
  readonly board$: Observable<QuestBoard> = this.board$$.asObservable();
  /** Fires once per claim. Not replayed — a missed claim is a missed animation. */
  readonly claim$: Observable<QuestClaim> = this.claim$$.asObservable();

  /**
   * Whether the slide-out board is showing.
   *
   * Lives here rather than in a component because the trigger and the panel are
   * deliberately in different places in the DOM: the ⚔️ sits in the navbar, and
   * the panel must NOT — a positioned element inside `.navbar` joins its
   * z-index:1000 stacking context and paints over the logo and the language
   * toggle, which is the v2.1.0 mobile-nav regression this repo already paid
   * for once. The panel therefore renders as a sibling of the header, and the
   * two halves talk through this.
   */
  readonly drawerOpen$: Observable<boolean> = this.drawerOpen$$.asObservable();
  get drawerOpen(): boolean { return this.drawerOpen$$.value; }

  toggleDrawer(): void { this.drawerOpen$$.next(!this.drawerOpen$$.value); }
  closeDrawer(): void { if (this.drawerOpen$$.value) this.drawerOpen$$.next(false); }

  get board(): QuestBoard { return this.board$$.value; }

  /** Hydrate, roll the clocks forward, publish. Idempotent. */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.state = this.load();
    if (this.canonicalizePageSets()) this.persist();
    // The XP ledger backs four of the condition types. It is idempotent and the
    // header usually beat us to it, but the board must never render a level-0
    // epic just because nothing else happened to touch XP first.
    // Fire-and-forget: every condition the board derives from XP is read through
    // `snapshot$`, which republishes when hydration lands, so the board corrects
    // itself rather than needing to block on storage here.
    void this.xp.init();
    this.rollPeriods();
    this.publish();

    // Derived conditions (level, streak, energy balance) change without any
    // quest event firing, so the board has to follow the XP ledger too.
    this.xp.snapshot$.subscribe(() => this.publish());

    // `persist()` writes this whole blob from memory, so a merged quest log
    // written by cloud save would be gone at the next claim. No `flush` hook:
    // every write here is immediate rather than throttled.
    this.saves.register(QUEST_KEY, { rehydrate: () => this.rehydrate() });
  }

  /** Re-read the board from storage. Called by cloud save after a merge. */
  private rehydrate(): void {
    if (!this.isBrowser) return;
    this.state = this.load();
    if (this.canonicalizePageSets()) this.persist();
    // Not `rollPeriods()`: the merged blob carries the later of the two devices'
    // period keys, and rolling here would wipe a board the other device has
    // already filled in for today. The next event to arrive rolls it honestly.
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Recording
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Add to a tally in all three periods at once.
   *
   * Writing to day, week and life together is what lets one event feed a daily,
   * a weekly and an epic without the caller knowing which quests are on the
   * board — the wiring layer reports what happened, and the quests decide
   * whether they care.
   */
  tally(key: string, by = 1): void {
    if (!this.isBrowser || by <= 0) return;
    this.rollPeriods();
    for (const b of [this.state.day, this.state.week, this.state.life]) {
      b.n[key] = (b.n[key] ?? 0) + by;
    }
    this.persist();
    this.publish();
  }

  /** Add a distinct member to a set in all three periods. */
  addToSet(key: string, member: string): void {
    if (!this.isBrowser || !member) return;
    const value = key === 'pages' ? canonicalizePlayerPath(member) : member;
    this.rollPeriods();
    let changed = false;
    for (const b of [this.state.day, this.state.week, this.state.life]) {
      const list = b.s[key] ?? (b.s[key] = []);
      if (!list.includes(value) && list.length < SET_CAP) {
        list.push(value);
        changed = true;
      }
    }
    if (!changed) return;
    this.persist();
    this.publish();
  }

  /**
   * Record that an Arena gate was entered. Public because the Arena owns that
   * event and nothing at the wiring layer can infer it.
   */
  recordArenaGame(gameId: string): void {
    this.addToSet('arena', gameId);
  }

  /**
   * How far a condition has come over this visitor's whole history.
   *
   * Public so the NPC chains can be authored in the same condition vocabulary
   * the board uses instead of growing a second, subtly-different one. It reads
   * the `life` buckets specifically: a chain step is a standing ask from a
   * character, not something that expires at midnight, so the daily and weekly
   * ledgers are the wrong ones to answer it with.
   *
   * Read-only. Nothing here rolls a period or writes a bucket, so a caller
   * polling it cannot move the board.
   */
  lifetimeObserved(condition: QuestCondition): number {
    return this.observe(condition, this.state.life);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Claiming
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Bank a finished quest's reward. Returns false when the quest is not on the
   * board, not finished, or already claimed — the three ways a double payout
   * could otherwise happen.
   */
  claim(questId: string): boolean {
    if (!this.isBrowser) return false;

    const quest = this.findOnBoard(questId);
    if (!quest || quest.status !== 'completed' || quest.claimed) return false;

    const receipt = this.receiptFor(quest);
    if (this.state.claimed.includes(receipt)) return false;
    this.state.claimed.push(receipt);

    this.state.totalCompleted += 1;
    this.state.log.unshift({
      id: quest.id,
      title: quest.title,
      type: quest.type,
      xp: quest.rewards.xp,
      at: new Date().toISOString(),
    });
    this.state.log = this.state.log.slice(0, LOG_CAP);

    this.persist();

    // Pay out only after the receipt is written. If the XP write throws, the
    // quest stays claimed rather than becoming an infinite faucet.
    this.xp.award('quest', {
      amount: quest.rewards.xp,
      energy: rewardEnergy(quest),
    });
    if (quest.rewards.achievement) {
      this.xp.claimAchievement(quest.rewards.achievement);
    }

    this.publish();
    this.claim$$.next({ quest: { ...quest, claimed: true }, xp: quest.rewards.xp });
    return true;
  }

  /** Wipe the board and every ledger behind it. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyState();
    this.store.remove(QUEST_KEY);
    this.rollPeriods();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Board assembly
  // ───────────────────────────────────────────────────────────────────────────

  private findOnBoard(id: string): Quest | undefined {
    const b = this.board;
    return [...b.daily, ...b.weekly, ...b.epic].find(q => q.id === id);
  }

  private receiptFor(quest: Quest): string {
    if (quest.type === 'daily') return `${quest.id}@${this.state.dayKey}`;
    if (quest.type === 'weekly') return `${quest.id}@${this.state.weekKey}`;
    return quest.id;
  }

  private computeBoard(): QuestBoard {
    const now = new Date();
    const dk = this.state.dayKey || dayKey(now);
    const wk = this.state.weekKey || weekKey(now);

    const daily = pickDeterministic(PLAYABLE_DAILY_QUESTS, DAILY_SLOTS, dk)
      .map(def => this.resolve(def, this.state.day, `${def.id}@${dk}`, nextMidnight(now)));
    const weekly = pickDeterministic(PLAYABLE_WEEKLY_QUESTS, WEEKLY_SLOTS, wk)
      .map(def => this.resolve(def, this.state.week, `${def.id}@${wk}`, nextMonday(now)));
    const epic = PLAYABLE_EPIC_QUESTS
      .map(def => this.resolve(def, this.state.life, def.id, undefined));

    const all = [...daily, ...weekly, ...epic];
    const weekStart = Date.parse(`${wk.slice(1)}T00:00:00`);

    return {
      daily,
      weekly,
      epic,
      dailyResetAt: nextMidnight(now),
      weeklyResetAt: nextMonday(now),
      unclaimed: all.filter(q => q.status === 'completed' && !q.claimed).length,
      openCount: [...daily, ...weekly].filter(q => q.status !== 'completed').length,
      completedThisWeek: Number.isNaN(weekStart)
        ? 0
        : this.state.log.filter(e => Date.parse(e.at) >= weekStart).length,
      totalCompleted: this.state.totalCompleted,
      log: this.state.log,
    };
  }

  /** An authored quest plus this visitor's standing against it. */
  private resolve(
    def: QuestDefinition,
    buckets: Buckets,
    receipt: string,
    expiresAt: string | undefined,
  ): Quest {
    const target = Math.max(1, def.condition.count);
    const observed = this.observe(def.condition, buckets);
    const claimed = this.state.claimed.includes(receipt);
    const done = observed >= target;

    const status: QuestStatus = done ? 'completed' : observed > 0 ? 'active' : 'available';

    return {
      ...def,
      observed: Math.min(observed, target),
      progress: Math.round(Math.min(1, observed / target) * 100),
      status,
      claimed,
      expiresAt,
    };
  }

  /**
   * How far along a condition is.
   *
   * Counted conditions read the bucket that `progressKey()` names. Derived
   * conditions read the XP ledger, which already knows the answer — there is no
   * bucket for "what level are you", only a number that is already true.
   */
  private observe(c: QuestCondition, buckets: Buckets): number {
    const snap = this.xp.snapshot;

    switch (c.type) {
      case 'streak':
        return snap.streak;

      case 'level':
        return snap.level.level;

      case 'achievement':
        // The ledger exposes a membership test rather than a count, so this
        // reads the one number it does publish: tools banked. Achievement-count
        // quests are not authored today; this keeps the type honest rather than
        // throwing if one is added.
        return snap.toolsUsed;

      case 'energy-balance': {
        const total = snap.aether + snap.nox;
        // Below a floor the ratio is noise — one tool use can sit at a perfect
        // 50/50 and clear an epic. The floor is the epic's own gate, restated
        // here so the condition cannot be cleared at 30 XP.
        if (total < 1000) return 0;
        const spreadPct = (Math.abs(snap.aether - snap.nox) / total) * 100;
        // Inverted: the target is "within N percent", so progress is how far
        // *under* the threshold the spread has come.
        return spreadPct <= c.count ? c.count : 0;
      }

      case 'page-visit': {
        const visited = buckets.s['pages'] ?? [];
        return (c.paths ?? []).filter(p => visited.includes(p)).length;
      }

      default: {
        const addr = progressKey(c);
        if (!addr) return 0;
        return addr.kind === 'tally'
          ? (buckets.n[addr.key] ?? 0)
          : (buckets.s[addr.key]?.length ?? 0);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Clocks and storage
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reset whichever periods have elapsed. Called before every write and on
   * init, rather than on a timer: a tab left open overnight settles on the
   * first event after midnight, and a tab that sees no events has nothing to
   * settle.
   */
  private rollPeriods(): void {
    const dk = dayKey();
    const wk = weekKey();
    let dirty = false;

    if (this.state.dayKey !== dk) {
      this.state.dayKey = dk;
      this.state.day = emptyBuckets();
      dirty = true;
    }
    if (this.state.weekKey !== wk) {
      this.state.weekKey = wk;
      this.state.week = emptyBuckets();
      dirty = true;
    }
    // Receipts for periods that have rolled over are dead weight; a bare epic
    // id has no '@' and is kept forever.
    if (dirty) {
      this.state.claimed = this.state.claimed.filter(r => {
        const at = r.indexOf('@');
        if (at < 0) return true;
        const period = r.slice(at + 1);
        return period === dk || period === wk;
      });
      this.persist();
    }
  }

  private load(): QuestState {
    try {
      const raw = this.store.readRaw(QUEST_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<QuestState>;
      // Merge over a fresh blob so a state written by an older build still
      // hydrates instead of throwing on a field that did not exist yet.
      return {
        ...emptyState(),
        ...parsed,
        day: { ...emptyBuckets(), ...(parsed.day ?? {}) },
        week: { ...emptyBuckets(), ...(parsed.week ?? {}) },
        life: { ...emptyBuckets(), ...(parsed.life ?? {}) },
        claimed: parsed.claimed ?? [],
        log: parsed.log ?? [],
        version: 1,
      };
    } catch {
      return emptyState();
    }
  }

  /** Collapse remounted halls in persisted `pages` sets. Returns true if any bucket changed. */
  private canonicalizePageSets(): boolean {
    let dirty = false;
    for (const bucket of [this.state.day, this.state.week, this.state.life]) {
      const pages = bucket.s['pages'];
      if (!pages?.length) continue;
      const next = rewriteCanonicalPageSet(pages);
      if (next.length !== pages.length || next.some((p, i) => p !== pages[i])) {
        bucket.s['pages'] = next;
        dirty = true;
      }
    }
    return dirty;
  }

  private persist(): void {
      this.store.write(QUEST_KEY, this.state);
  }

  private publish(): void {
    this.board$$.next(this.computeBoard());
  }
}

/** Re-exported so callers can look a quest up without importing the model too. */
export { questById };
