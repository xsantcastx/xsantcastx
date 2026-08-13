/**
 * player-stats.service.ts — the point bank and the five bars.
 *
 * Owns one localStorage key and one question: how many points has this visitor
 * earned, and where did they put them. Everything that *reads* a stat reads it
 * from here; nothing else is allowed to write one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY LEVELS ARE SETTLED AGAINST A COUNTER, NOT AN EVENT
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious build subscribes to `XpService.gain$`, filters for `levelUp`, and
 * grants three points. It loses points in three ordinary situations:
 *
 *   • `XpService.init()` settles the daily streak during its own hydration and
 *     can cross a rank doing it — before this service has subscribed to anything.
 *   • A single large award (finishing a Runeword, a Singular find) can cross two
 *     ranks at once, and one event does not mean one level.
 *   • A visitor who reached rank 9 before this feature existed was never going
 *     to receive an event for any of it.
 *
 * So the grant is `3 × (currentLevel − levelsGranted)`, settled on init and again
 * on every award. It is idempotent, it back-pays the entire history on first
 * run, and it cannot double-pay because the counter moves with the grant. This
 * is the same shape `EconomyWiringService.payLevels` uses for Essence, and for
 * the same reasons — see the note there.
 *
 * SSR: `init()` returns immediately on the server and the snapshot stays at the
 * empty build, so the character sheet prerenders five empty bars.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import {
  PlayerStats,
  POINTS_PER_LEVEL,
  RESPEC_COST,
  StatId,
  STAT_IDS,
  charismaPriceMultiplier,
  emptyStats,
  enduranceMultiplier,
  forgePowerGold,
  luckMagicFind,
  spentPoints,
  totalPoints,
  wisdomMultiplier,
} from './player-stats.model';

export const PLAYER_STATS_KEY = 'godforge-stats';

interface StatsBlob {
  version: 1;
  stats: PlayerStats;
  /**
   * The highest rank already paid points for.
   *
   * Seeded to 1 in `emptyBlob`, because rank 1 is the rank you arrive holding
   * and is therefore not one you are paid for reaching — the same seed
   * `PlayerEconomy.levelsPaid` uses, for the same reason.
   */
  levelsGranted: number;
  /** Lifetime respecs, shown on the panel so a build has a visible history. */
  respecs: number;
}

function emptyBlob(): StatsBlob {
  return { version: 1, stats: emptyStats(), levelsGranted: 1, respecs: 0 };
}

/** What the panel renders. Derived, never persisted. */
export interface StatsSnapshot {
  stats: PlayerStats;
  /** Points spent across the five. */
  spent: number;
  /** Spent plus banked. */
  total: number;
  /** Flat Gold/sec from Forge Power. */
  goldPerSec: number;
  /** Magic Find from Luck alone. */
  magicFind: number;
  /** Mission-length multiplier from Endurance. */
  endurance: number;
  /** XP multiplier from Wisdom. */
  xpMultiplier: number;
  /** Market price multiplier from Charisma. */
  priceMultiplier: number;
  respecs: number;
  /** True when there is at least one point to spend. Drives the panel's badge. */
  hasUnspent: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlayerStatsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);

  private blob: StatsBlob = emptyBlob();
  private initialised = false;

  private readonly snapshot$$ = new BehaviorSubject<StatsSnapshot>(this.snapshotOf(emptyBlob()));
  private readonly pointsGranted$$ = new Subject<number>();

  /** The build, replayed. Safe to subscribe before `init()`. */
  readonly snapshot$: Observable<StatsSnapshot> = this.snapshot$$.asObservable();
  /** Fires with the number of points granted whenever a rank is settled. */
  readonly pointsGranted$: Observable<number> = this.pointsGranted$$.asObservable();

  get snapshot(): StatsSnapshot { return this.snapshot$$.value; }
  get stats(): PlayerStats { return { ...this.blob.stats }; }

  /**
   * Hydrate and back-pay every rank already reached. Idempotent — the character
   * sheet, the Sanctum and the wiring layer all call it without coordinating.
   */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.blob = this.load();
    // Progression may not have hydrated yet; `settleLevels` reads whatever rank
    // is known now and is called again on every award, so a rank that lands
    // after this point is settled then rather than missed.
    this.settleLevels();
    this.publish();

    this.xp.snapshot$.subscribe(() => this.settleLevels());
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Points
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pay three points for every rank reached and not yet paid for.
   *
   * Publishes only when something actually moved, so the subscription to
   * `snapshot$` above cannot become a republish loop.
   */
  private settleLevels(): void {
    const level = this.xp.snapshot.level.level;
    const owed = level - this.blob.levelsGranted;
    if (owed <= 0) return;

    const points = owed * POINTS_PER_LEVEL;
    this.blob = {
      ...this.blob,
      levelsGranted: level,
      stats: {
        ...this.blob.stats,
        unallocated: this.blob.stats.unallocated + points,
      },
    };
    this.save();
    this.publish();
    this.pointsGranted$$.next(points);
  }

  /**
   * Put one point into a stat. False when there is nothing banked.
   *
   * One at a time rather than a bulk `allocate(id, n)`: the panel's plus button
   * is the only caller, and a bulk path is a bulk path someone eventually calls
   * with a number they did not validate.
   */
  allocate(id: StatId): boolean {
    if (!this.isBrowser) return false;
    if (this.blob.stats.unallocated <= 0) return false;
    if (!STAT_IDS.includes(id)) return false;

    this.blob = {
      ...this.blob,
      stats: {
        ...this.blob.stats,
        [id]: this.blob.stats[id] + 1,
        unallocated: this.blob.stats.unallocated - 1,
      },
    };
    this.save();
    this.publish();
    return true;
  }

  /** Spend every banked point on one stat. Used by the panel's "all in" affordance. */
  allocateAll(id: StatId): number {
    if (!this.isBrowser || !STAT_IDS.includes(id)) return 0;
    const banked = this.blob.stats.unallocated;
    if (banked <= 0) return 0;

    this.blob = {
      ...this.blob,
      stats: {
        ...this.blob.stats,
        [id]: this.blob.stats[id] + banked,
        unallocated: 0,
      },
    };
    this.save();
    this.publish();
    return banked;
  }

  get canRespec(): boolean {
    return this.isBrowser
      && spentPoints(this.blob.stats) > 0
      && this.economy.snapshot.gold >= RESPEC_COST;
  }

  get respecCost(): number { return RESPEC_COST; }

  /**
   * Refund every spent point for a flat fee.
   *
   * The Gold is taken first and the points are only moved if it cleared, so a
   * refused payment cannot reset a build for free. Returns false when there is
   * nothing to refund — paying 1,000 Gold to reset an empty build is a mistake
   * the panel should not let happen and this method will not perform.
   */
  respec(): boolean {
    if (!this.isBrowser) return false;
    const spent = spentPoints(this.blob.stats);
    if (spent <= 0) return false;
    if (!this.economy.spendGold(RESPEC_COST, 'respec')) return false;

    this.blob = {
      ...this.blob,
      respecs: this.blob.respecs + 1,
      stats: {
        ...emptyStats(),
        unallocated: this.blob.stats.unallocated + spent,
      },
    };
    this.save();
    this.publish();
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Derived reads, for the systems that consume a stat
  // ───────────────────────────────────────────────────────────────────────────

  get goldPerSec(): number { return forgePowerGold(this.blob.stats); }
  get magicFind(): number { return luckMagicFind(this.blob.stats); }
  get missionMultiplier(): number { return enduranceMultiplier(this.blob.stats); }
  get xpMultiplier(): number { return wisdomMultiplier(this.blob.stats); }
  get priceMultiplier(): number { return charismaPriceMultiplier(this.blob.stats); }

  /** Wipe the build. Mirrors the reset on every other Godforge store. */
  reset(): void {
    if (!this.isBrowser) return;
    this.blob = emptyBlob();
    try { localStorage.removeItem(PLAYER_STATS_KEY); } catch { /* private mode */ }
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): StatsBlob {
    try {
      const raw = localStorage.getItem(PLAYER_STATS_KEY);
      if (!raw) return emptyBlob();
      const parsed = JSON.parse(raw) as Partial<StatsBlob>;
      const empty = emptyBlob();

      // Every stat is rebuilt through `whole()` rather than spread, because the
      // blob is user-writable and a hand-edited "luck": "lots" would otherwise
      // reach `luckMagicFind` and produce a NaN Magic Find, which silently
      // poisons the drop table for the rest of the session.
      const stats = { ...emptyStats() };
      for (const id of STAT_IDS) {
        stats[id] = whole(parsed.stats?.[id]);
      }
      stats.unallocated = whole(parsed.stats?.unallocated);

      return {
        version: 1,
        stats,
        levelsGranted: Math.max(1, whole(parsed.levelsGranted) || empty.levelsGranted),
        respecs: whole(parsed.respecs),
      };
    } catch {
      return emptyBlob();
    }
  }

  private save(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify(this.blob));
    } catch { /* quota or private mode — the session works, it just forgets */ }
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.blob));
  }

  private snapshotOf(blob: StatsBlob): StatsSnapshot {
    const stats = blob.stats;
    return {
      stats: { ...stats },
      spent: spentPoints(stats),
      total: totalPoints(stats),
      goldPerSec: forgePowerGold(stats),
      magicFind: luckMagicFind(stats),
      endurance: enduranceMultiplier(stats),
      xpMultiplier: wisdomMultiplier(stats),
      priceMultiplier: charismaPriceMultiplier(stats),
      respecs: blob.respecs,
      hasUnspent: stats.unallocated > 0,
    };
  }
}

/** A non-negative integer, or zero. The one coercion the loader trusts. */
function whole(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}
