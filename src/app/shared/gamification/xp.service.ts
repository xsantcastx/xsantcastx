/**
 * xp.service.ts — the progression ledger.
 *
 * Every XP award funnels through `award()`, which is the only method that
 * mutates state, so there is exactly one place where the economy is enforced and
 * exactly one place that writes to storage.
 *
 * SSR: the service is constructed on the server (it is providedIn root and the
 * header injects it), but `ProgressStorageService` hands back a null adapter
 * there and `init()` returns early, so no browser API is touched during
 * prerender and the server renders the level-1 state.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ProgressStorageService } from './progress-storage.service';
import {
  EnergyType,
  HISTORY_DAYS,
  LevelDefinition,
  ProgressState,
  XP_VALUES,
  XpEventType,
  emptyProgress,
  levelForXp,
  levelProgress,
  nextLevelForXp,
  streakBonus,
  withLevel,
} from './gamification.model';

/** What the XP bar renders. Derived, never persisted. */
export interface XpSnapshot {
  xp: number;
  level: LevelDefinition;
  next: LevelDefinition | null;
  /** 0-1 through the current rank. */
  progress: number;
  /** XP still needed for the next rank, or 0 at max. */
  toNext: number;
  aether: number;
  nox: number;
  /** 0-1 share of lifetime XP that is Aether — drives the split bar. */
  aetherShare: number;
  streak: number;
  bestStreak: number;
  toolsUsed: number;
}

/** Emitted whenever XP lands, so the UI can float a "+15" and pulse the bar. */
export interface XpGain {
  amount: number;
  type: XpEventType;
  energy: EnergyType;
  /** True when this award pushed the visitor into a new rank. */
  levelUp: boolean;
  level: LevelDefinition;
}

export interface AwardOptions {
  /** Which energy the XP feeds. Defaults to Aether. */
  energy?: EnergyType;
  /** Tool slug, when the award came from a tool. Counted once for `toolsUsed`. */
  toolId?: string;
  /** Overrides the table value — used by streak, which is computed. */
  amount?: number;
}

/** Local YYYY-MM-DD. Deliberately local, not UTC: a streak is a human day. */
export function localDay(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function today(): string {
  return localDay();
}

/** Whole days between two YYYY-MM-DD strings, `b - a`. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

@Injectable({ providedIn: 'root' })
export class XpService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly storage = inject(ProgressStorageService);

  private state: ProgressState = emptyProgress();
  /**
   * The in-flight (or settled) hydration. Every caller of `init()` gets the same
   * promise, so the half-dozen components that each want progression can all
   * await readiness without coordinating who is first.
   */
  private hydration: Promise<void> | null = null;

  /** Coalesce writes: a burst of awards should be one save, not five. */
  private saveHandle: ReturnType<typeof setTimeout> | null = null;
  private static readonly SAVE_DEBOUNCE_MS = 800;
  private unloadBound = false;

  private readonly snapshot$$ = new BehaviorSubject<XpSnapshot>(this.snapshotOf(this.state));
  private readonly gain$$ = new Subject<XpGain>();

  /** Current progression, replayed to late subscribers. */
  readonly snapshot$: Observable<XpSnapshot> = this.snapshot$$.asObservable();
  /** Fires once per award. Not replayed — a missed gain is a missed animation. */
  readonly gain$: Observable<XpGain> = this.gain$$.asObservable();

  get snapshot(): XpSnapshot { return this.snapshot$$.value; }

  /**
   * Hydrate from storage and settle the daily streak. Idempotent — safe to call
   * from every component that wants progression without coordinating who is
   * first, and repeat callers get the same promise rather than a second load.
   *
   * Async because storage is: with Firestore behind the adapter this is a
   * network round trip. Callers that only render from `snapshot$` can ignore the
   * promise — the subject republishes once hydration lands. Callers that read
   * state *synchronously and once* (`toolsUsed`, `history`) must await it, or
   * they will read the empty blob and never look again.
   */
  init(): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();
    if (this.hydration) return this.hydration;

    this.hydration = this.storage.load()
      .then(loaded => {
        this.state = loaded;
        this.settleStreak();
        this.publish();
        this.bindUnloadFlush();
      })
      .catch(() => {
        // A failed load leaves the empty blob in place, which is a usable
        // level-1 state. Publishing keeps the HUD consistent with it.
        this.publish();
      });

    return this.hydration;
  }

  /** Resolves once storage has been read. Sugar for `init()` at a call site that already ran it. */
  get ready(): Promise<void> {
    return this.hydration ?? this.init();
  }

  /**
   * Roll the streak forward for today's first visit and pay the daily bonus.
   * Same day: nothing. Next day: streak grows. Any longer gap: back to one.
   */
  private settleStreak(): void {
    const now = today();
    const last = this.state.lastVisit;

    if (last === now) return;

    const gap = last ? daysBetween(last, now) : Infinity;
    // A negative gap means the device clock moved backwards. Treat it as the
    // same day rather than resetting a streak the visitor did not actually miss.
    if (gap < 0) return;

    this.state.streak = gap === 1 ? this.state.streak + 1 : 1;
    this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);
    this.state.lastVisit = now;

    this.award('streak', { amount: streakBonus(this.state.streak) });
  }

  /**
   * The single mutation point. Adds XP, routes it to an energy, persists, and
   * announces the gain.
   */
  award(type: XpEventType, opts: AwardOptions = {}): void {
    if (!this.isBrowser) return;

    const energy: EnergyType = opts.energy ?? 'aether';
    const amount = opts.amount ?? XP_VALUES[type];

    // A tool only pays out the first time it is used, so leaving a page open and
    // hammering one button is not a progression strategy.
    if (opts.toolId) {
      if (this.state.toolsUsed.includes(opts.toolId)) return;
      this.state.toolsUsed = [...this.state.toolsUsed, opts.toolId];
    }

    if (amount <= 0) return;

    const before = levelForXp(this.state.xp);
    this.state.xp += amount;
    if (energy === 'nox') this.state.nox += amount;
    else this.state.aether += amount;
    this.recordDay(amount);
    const after = levelForXp(this.state.xp);
    // Keep the denormalised rank in step. Stored rather than derived so a Phase
    // 2 leaderboard can orderBy it — see the note on ProgressState.
    this.state = withLevel(this.state);

    this.persist();
    this.publish();
    this.gain$$.next({
      amount,
      type,
      energy,
      levelUp: after.level > before.level,
      level: after,
    });
  }

  /**
   * Add today's award to the daily ledger and drop anything older than the
   * retention window. Called from `award()` only — the ledger is a projection of
   * XP, so there is no path that can write to it without XP having moved.
   */
  private recordDay(amount: number): void {
    const day = today();
    const history: Record<string, number> = { ...this.state.history };
    history[day] = (history[day] ?? 0) + amount;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);
    const floor = localDay(cutoff);
    for (const key of Object.keys(history)) {
      if (key < floor) delete history[key];
    }

    this.state.history = history;
  }

  /**
   * XP earned per local day, newest keys last. A copy: the caller renders it and
   * must not be able to reach back into the ledger.
   */
  get history(): Record<string, number> {
    return { ...this.state.history };
  }

  /** Tool slugs used at least once, in the order they were first opened. */
  get toolsUsed(): string[] {
    return [...this.state.toolsUsed];
  }

  /**
   * True once this visitor has used the tool at least once.
   *
   * The snapshot carries only the count, because that is all the XP bar needs.
   * The homepage marks individual forge cards as already-struck, so it needs
   * membership — read-only, and false on the server, where there is no stored
   * progress to read.
   */
  hasUsedTool(toolId: string): boolean {
    return this.state.toolsUsed.includes(toolId);
  }

  /** True once this achievement has been banked, so a drop never repeats. */
  hasAchievement(id: string): boolean {
    return this.state.achievements.some(a => a.id === id);
  }

  /**
   * Bank an achievement. Returns false when it was already held.
   *
   * Records the unlock time alongside the id: the Codex renders "unlocked on"
   * from the egg service today, but a synced profile has to carry its own
   * chronology rather than depending on a second store agreeing with it.
   */
  claimAchievement(id: string): boolean {
    if (!this.isBrowser || this.hasAchievement(id)) return false;
    this.state.achievements = [
      ...this.state.achievements,
      { id, unlockedAt: new Date().toISOString() },
    ];
    this.persist();
    this.publish();
    return true;
  }

  /** Achievement ids banked so far, in the order they were earned. */
  get achievementIds(): string[] {
    return this.state.achievements.map(a => a.id);
  }

  /** When an achievement was banked, or null if it has not been. */
  achievementUnlockedAt(id: string): string | null {
    return this.state.achievements.find(a => a.id === id)?.unlockedAt ?? null;
  }

  /** The identity this progression is filed under. A local UUID until sign-in exists. */
  get userId(): string {
    return this.state.userId;
  }

  /** Wipe progression. Exposed for the console and for a future settings toggle. */
  reset(): void {
    if (!this.isBrowser) return;
    this.cancelPendingSave();
    this.state = emptyProgress();
    void this.storage.clear();
    this.publish();
  }

  /**
   * Schedule a write. Storage is async now, and a single quest claim can award
   * XP and bank an achievement in the same tick — that should be one save, not
   * two round trips.
   */
  private persist(): void {
    if (this.saveHandle !== null) clearTimeout(this.saveHandle);
    this.saveHandle = setTimeout(() => {
      this.saveHandle = null;
      void this.storage.save(this.state).catch(() => {
        // A failed write must never break a session. The next debounce tick
        // retries with the newer state anyway.
      });
    }, XpService.SAVE_DEBOUNCE_MS);
  }

  private cancelPendingSave(): void {
    if (this.saveHandle === null) return;
    clearTimeout(this.saveHandle);
    this.saveHandle = null;
  }

  /**
   * Flush on the way out. `pagehide` will not await a promise, so this goes
   * through the adapter's synchronous path — without it, closing the tab within
   * the debounce window would cost the visitor their last award.
   */
  private bindUnloadFlush(): void {
    if (this.unloadBound || typeof window === 'undefined') return;
    this.unloadBound = true;

    const flush = () => {
      this.cancelPendingSave();
      this.storage.saveNow(this.state);
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.state));
  }

  private snapshotOf(state: ProgressState): XpSnapshot {
    const level = levelForXp(state.xp);
    const next = nextLevelForXp(state.xp);
    const energyTotal = state.aether + state.nox;
    return {
      xp: state.xp,
      level,
      next,
      progress: levelProgress(state.xp),
      toNext: next ? Math.max(0, next.minXp - state.xp) : 0,
      aether: state.aether,
      nox: state.nox,
      // With no XP yet the bar reads half-and-half rather than collapsing to one
      // side, which is the honest picture: neither realm has claimed you.
      aetherShare: energyTotal > 0 ? state.aether / energyTotal : 0.5,
      streak: state.streak,
      bestStreak: state.bestStreak,
      toolsUsed: state.toolsUsed.length,
    };
  }
}
