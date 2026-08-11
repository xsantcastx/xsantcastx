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
  LevelDefinition,
  ProgressState,
  XP_VALUES,
  XpEventType,
  emptyProgress,
  levelForXp,
  levelProgress,
  nextLevelForXp,
  streakBonus,
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
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  private initialised = false;

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
   * first.
   */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.state = this.storage.load();
    this.settleStreak();
    this.publish();
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
    const after = levelForXp(this.state.xp);

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

  /** True once this achievement has been banked, so a drop never repeats. */
  hasAchievement(id: string): boolean {
    return this.state.achievements.includes(id);
  }

  /** Bank an achievement id. Returns false when it was already held. */
  claimAchievement(id: string): boolean {
    if (!this.isBrowser || this.hasAchievement(id)) return false;
    this.state.achievements = [...this.state.achievements, id];
    this.persist();
    this.publish();
    return true;
  }

  /** Wipe progression. Exposed for the console and for a future settings toggle. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyProgress();
    this.storage.clear();
    this.publish();
  }

  private persist(): void {
    this.storage.save(this.state);
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
