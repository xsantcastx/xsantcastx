/**
 * arena.service.ts — the Coliseum's ledger.
 *
 * Owns one blob and six facts: arena points held and ever minted, the win and
 * loss counts, the streak, wins per tier, when the last bout settled, and which
 * one-off shop rows have been bought. Nothing else about a bout lives here —
 * Gold is the economy's, XP is the ladder's, a minted item is the bag's — which
 * is why this service injects nothing but the save layer.
 *
 * Same shape as `CraftingService` and `GamblerService`: the blob is loaded
 * lazily on first read and registered with `LocalSaveRegistry` at that moment
 * rather than in an `init()`, because the moment a cached copy starts existing
 * is the moment a cloud pull needs to be able to invalidate it.
 *
 * SSR-safe: every public method is a no-op or a pure read on the server, and
 * the snapshot stays at the empty build so the ring prerenders its gate cards
 * with a zero record on them.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  ARENA_KEY,
  ARENA_TIER_ORDER,
  type ArenaRank,
  type ArenaState,
  type ArenaTierId,
  type BoutResult,
  SETTLED_RETAINED,
  arenaRankFor,
  coerceArenaState,
  cooldownRemaining,
  emptyArenaState,
  tierUnlocked,
  winsInTier,
} from './arena.model';

export interface ArenaSnapshot {
  points: number;
  lifetimePoints: number;
  wins: number;
  losses: number;
  /** Wins over bouts fought, 0–1. Zero before the first bout. */
  winRate: number;
  streak: number;
  bestStreak: number;
  rank: ArenaRank;
  tierWins: Readonly<Record<string, number>>;
  /** Tier id → whether its gate is open. Recomputed on every publish. */
  unlocked: Readonly<Record<ArenaTierId, boolean>>;
  lastBoutAt: number;
  purchases: readonly string[];
}

/** What one settled bout moved. Emitted once, never replayed — a win is a moment. */
export interface ArenaSettlement {
  result: BoutResult;
  pointsGained: number;
  streakBefore: number;
  streakAfter: number;
  /** True on the win that opens the next ring. */
  unlockedTier: ArenaTierId | null;
  /** True when this bout id had already been settled. */
  replayed: boolean;
}

@Injectable({ providedIn: 'root' })
export class ArenaService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);

  private state: ArenaState = emptyArenaState();
  private loaded = false;

  private readonly snapshot$$ = new BehaviorSubject<ArenaSnapshot>(snapshotOf(emptyArenaState()));
  private readonly settled$$ = new Subject<ArenaSettlement>();

  readonly snapshot$: Observable<ArenaSnapshot> = this.snapshot$$.asObservable();
  readonly settled$: Observable<ArenaSettlement> = this.settled$$.asObservable();

  get snapshot(): ArenaSnapshot { return this.snapshot$$.value; }

  /**
   * Hydrate and publish, once.
   *
   * The `loaded` check is not an optimisation, it is a cycle break. `init()` is
   * called from `ArenaGateway.blocker()` and `purchaseBlocker()`, which the ring
   * page calls from inside its own `snapshot$` subscription — so an `init()`
   * that published unconditionally would push a new snapshot, wake the
   * subscription, call `blocker()` again, and recur until the renderer died.
   * That is exactly what it did: the page crashed the tab on load.
   *
   * A publish is only ever needed on the load that first fills the cache, and
   * `rehydrate` below does its own publish after a cloud pull, so nothing that
   * needs announcing goes unannounced.
   */
  init(): void {
    if (!this.isBrowser || this.loaded) return;
    this.load();
    this.publish();
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  points(): number { return this.load().points; }

  wins(): number { return this.load().wins; }

  winsIn(tier: ArenaTierId): number { return winsInTier(this.load(), tier); }

  isUnlocked(tier: ArenaTierId): boolean { return tierUnlocked(this.load(), tier); }

  owns(stockId: string): boolean { return this.load().purchases.includes(stockId); }

  /** Milliseconds until the gate opens, or 0. */
  cooldown(now = Date.now()): number { return cooldownRemaining(this.load(), now); }

  ready(now = Date.now()): boolean { return this.cooldown(now) === 0; }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Record a settled bout: the counters, the streak, the points, the lock.
   *
   * Called by `ArenaGateway` and nowhere else. `boutId` makes it idempotent —
   * a second call with the same id returns the same settlement with
   * `replayed: true` and moves nothing, which is what keeps a double-press or a
   * remounted component from paying twice.
   *
   * Returns null only on the server.
   */
  settle(
    result: BoutResult,
    points: number,
    boutId: string,
    now = Date.now(),
  ): ArenaSettlement | null {
    if (!this.isBrowser) return null;
    const state = this.load();

    if (boutId && state.settled.includes(boutId)) {
      return {
        result,
        pointsGained: 0,
        streakBefore: state.streak,
        streakAfter: state.streak,
        unlockedTier: null,
        replayed: true,
      };
    }

    const streakBefore = state.streak;
    const gained = Math.max(0, Math.round(points));
    const tierWins = { ...state.tierWins };
    if (result.won) tierWins[result.tier] = (tierWins[result.tier] ?? 0) + 1;

    const next: ArenaState = {
      ...state,
      points: state.points + gained,
      lifetimePoints: state.lifetimePoints + gained,
      wins: state.wins + (result.won ? 1 : 0),
      losses: state.losses + (result.won ? 0 : 1),
      streak: result.won ? state.streak + 1 : 0,
      bestStreak: Math.max(state.bestStreak, result.won ? state.streak + 1 : 0),
      tierWins,
      lastBoutAt: now,
      settled: boutId ? [...state.settled, boutId].slice(-SETTLED_RETAINED) : state.settled,
    };

    // Read the unlock against both states rather than recomputing from wins:
    // it is the *transition* the ring announces, and only a diff can see one.
    const opened = ARENA_TIER_ORDER.find(
      tier => !tierUnlocked(state, tier) && tierUnlocked(next, tier),
    ) ?? null;

    this.state = next;
    this.persist();
    this.publish();

    const settlement: ArenaSettlement = {
      result,
      pointsGained: gained,
      streakBefore,
      streakAfter: next.streak,
      unlockedTier: opened,
      replayed: false,
    };
    this.settled$$.next(settlement);
    return settlement;
  }

  /**
   * Take `cost` points and record `stockId` as bought.
   *
   * Returns false — moving nothing — when the points are not there, which is
   * what lets `ArenaGateway` check and spend in the same synchronous tick with
   * no await between them.
   */
  spendPoints(cost: number, stockId: string): boolean {
    if (!this.isBrowser) return false;
    const state = this.load();
    const price = Math.max(0, Math.round(cost));
    if (state.points < price) return false;

    this.state = {
      ...state,
      points: state.points - price,
      purchases: state.purchases.includes(stockId) ? state.purchases : [...state.purchases, stockId],
    };
    this.persist();
    this.publish();
    return true;
  }

  /**
   * Hand back points a purchase could not deliver.
   *
   * `lifetimePoints` is deliberately untouched: it is the shop's own gate, and
   * a refund that moved it could close a row behind a player who never received
   * what it sold them.
   */
  refundPoints(amount: number, stockId: string): void {
    if (!this.isBrowser || amount <= 0) return;
    const state = this.load();
    this.state = {
      ...state,
      points: state.points + Math.round(amount),
      purchases: state.purchases.filter(id => id !== stockId),
    };
    this.persist();
    this.publish();
  }

  /** Wipe the record. Exposed alongside the other resets. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyArenaState();
    this.loaded = true;
    this.store.remove(ARENA_KEY);
    this.publish();
  }

  // ── Storage ────────────────────────────────────────────────────────────────

  private load(): ArenaState {
    if (this.loaded) return this.state;
    this.loaded = true;
    if (!this.isBrowser) return this.state;

    this.saves.register(ARENA_KEY, {
      rehydrate: () => {
        this.loaded = false;
        this.load();
        this.publish();
      },
    });

    try {
      this.state = coerceArenaState(this.store.read(ARENA_KEY));
    } catch {
      this.state = emptyArenaState();
    }
    return this.state;
  }

  private persist(): void {
    this.store.write(ARENA_KEY, this.state);
  }

  private publish(): void {
    this.snapshot$$.next(snapshotOf(this.load()));
  }
}

function snapshotOf(state: ArenaState): ArenaSnapshot {
  const fought = state.wins + state.losses;
  const unlocked = {} as Record<ArenaTierId, boolean>;
  for (const tier of ARENA_TIER_ORDER) unlocked[tier] = tierUnlocked(state, tier);

  return {
    points: state.points,
    lifetimePoints: state.lifetimePoints,
    wins: state.wins,
    losses: state.losses,
    winRate: fought > 0 ? state.wins / fought : 0,
    streak: state.streak,
    bestStreak: state.bestStreak,
    rank: arenaRankFor(state.wins),
    tierWins: { ...state.tierWins },
    unlocked,
    lastBoutAt: state.lastBoutAt,
    purchases: [...state.purchases],
  };
}
