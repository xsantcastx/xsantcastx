/**
 * explorer.service.ts — dispatches expeditions and settles them when they land.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CLOCK IS THE WALL CLOCK, NOT A TIMER
 * ─────────────────────────────────────────────────────────────────────────────
 * The interval in here exists to *redraw a countdown*. It is not what makes a
 * mission finish. A mission finishes because `startedAt + duration` is in the
 * past, and that comparison is made on every tick, on every hydrate, and on
 * every visibility change — so an hour-long expedition dispatched at midnight
 * and reopened at 8am settles on load, in full, with no timer having survived
 * anything. That is the whole reason the record stores a start and a span
 * rather than a countdown that would have to be decremented by someone.
 *
 * It also means a throttled background tab is harmless. Browsers clamp
 * `setInterval` in a hidden tab to once a minute or worse; the countdown goes
 * stale and the settlement does not, because settlement never depended on the
 * interval firing on time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ZONE
 * ─────────────────────────────────────────────────────────────────────────────
 * The tick runs outside Angular and re-enters only on the seconds where
 * something a human can see actually changed — a countdown digit or a
 * settlement. On a page with no explorer out, the interval is not running at
 * all. This is the same budget the Flame and the economy tick hold themselves
 * to, and it is what keeps three simultaneous live surfaces on one page from
 * costing three change-detection passes a second.
 */
import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import { RealmId, realmById } from '../realms/realm.model';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { runeById } from '../rune-forge/rune.model';
import {
  BASE_EXPLORER_SLOTS,
  EXPLORER_KEY,
  Explorer,
  ExplorerReturn,
  ExplorerState,
  MAX_EXPLORER_SLOTS,
  MissionId,
  emptyExplorerState,
  missionById,
  remainingMs,
  rollReward,
} from './explorer.model';

/** The Market id whose levels each buy one more explorer. */
export const EXPLORER_SLOT_UPGRADE = 'explorer-slot';

/** How often the countdown is redrawn while at least one mission is out. */
const TICK_MS = 1_000;

@Injectable({ providedIn: 'root' })
export class ExplorerService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly runeForge = inject(RuneForgeService);

  private state: ExplorerState = emptyExplorerState();
  private initialised = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  private readonly state$$ = new BehaviorSubject<ExplorerState>(this.state);
  private readonly returned$$ = new Subject<ExplorerReturn>();
  /** Ticks once a second while a mission is out, so countdowns redraw. */
  private readonly tick$$ = new Subject<number>();

  /** Current expeditions and collection, replayed to late subscribers. */
  readonly state$: Observable<ExplorerState> = this.state$$.asObservable();
  /** One per landed mission. Drives the loot reveal — not replayed. */
  readonly returned$: Observable<ExplorerReturn> = this.returned$$.asObservable();
  readonly tick$: Observable<number> = this.tick$$.asObservable();

  get snapshot(): ExplorerState { return this.state$$.value; }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Hydrate and settle anything that landed while the tab was shut. Idempotent,
   * so the Forge View and the Market can both call it without coordinating.
   */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.state = this.load();
    // Settle before the first publish: a visitor returning to three finished
    // expeditions should see the Gold already banked and three loot reveals,
    // not three explorers standing at 0:00 waiting for the next tick.
    this.settle();
    this.publish();
    this.syncTimer();

    this.zone.runOutsideAngular(() => {
      // A tab that comes back into view after being throttled may be minutes
      // behind. Settling on the visibility edge closes that gap immediately
      // rather than on whatever schedule the browser next grants the interval.
      this.visibilityHandler = () => {
        if (document.visibilityState !== 'visible') return;
        if (this.settle()) this.zone.run(() => this.publish());
        else this.zone.run(() => this.tick$$.next(Date.now()));
      };
      document.addEventListener('visibilitychange', this.visibilityHandler, { passive: true });
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Slots
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * How many explorers the visitor can have out at once.
   *
   * Read from the economy ledger rather than stored here, so the Market remains
   * the single place a slot is bought and this service can never disagree with
   * it about what was paid for.
   */
  get slots(): number {
    const bought = this.economy.levelOf(EXPLORER_SLOT_UPGRADE);
    return Math.min(MAX_EXPLORER_SLOTS, BASE_EXPLORER_SLOTS + bought);
  }

  get freeSlots(): number {
    return Math.max(0, this.slots - this.state.active.length);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Dispatch
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Send an explorer out. False when every slot is busy, or the realm or
   * mission is unknown.
   *
   * Dispatch is free — the cost of an expedition is the wait, and charging Gold
   * on top would make the first one unreachable for exactly the new visitor the
   * mechanic is meant to hook.
   */
  dispatch(realm: RealmId, mission: MissionId): boolean {
    if (!this.isBrowser) return false;
    if (this.freeSlots <= 0) return false;

    const def = missionById(mission);
    if (!def || !realmById(realm)) return false;

    const explorer: Explorer = {
      id: `${realm}-${mission}-${Date.now()}-${this.state.missionsCompleted}`,
      realm,
      mission,
      duration: def.duration,
      startedAt: Date.now(),
    };

    this.state = { ...this.state, active: [...this.state.active, explorer] };
    this.persist();
    this.publish();
    this.syncTimer();
    return true;
  }

  /**
   * Recall an explorer early, forfeiting the mission.
   *
   * No partial payout: a mission that pays pro rata is a mission you always
   * recall the instant the Gold clears whatever you were saving for, and the
   * wait — the only cost an expedition has — stops meaning anything.
   */
  recall(id: string): boolean {
    if (!this.isBrowser) return false;
    const before = this.state.active.length;
    const active = this.state.active.filter(e => e.id !== id);
    if (active.length === before) return false;

    this.state = { ...this.state, active };
    this.persist();
    this.publish();
    this.syncTimer();
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Settlement
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pay out every mission whose span has elapsed. Returns true when anything
   * moved, so callers know whether a publish is owed.
   *
   * Landings are settled oldest-first so a visitor who comes back to three
   * finished expeditions sees them revealed in the order they actually
   * happened, and so the duplicate-suppression in `rollReward` sees each
   * previous rune before rolling the next.
   */
  private settle(): boolean {
    const now = Date.now();
    const landed = this.state.active
      .filter(e => remainingMs(e, now) <= 0)
      .sort((a, b) => (a.startedAt + a.duration) - (b.startedAt + b.duration));

    if (!landed.length) return false;

    let next: ExplorerState = {
      ...this.state,
      active: this.state.active.filter(e => remainingMs(e, now) > 0),
    };
    const returns: ExplorerReturn[] = [];

    for (const explorer of landed) {
      const def = missionById(explorer.mission);
      if (!def) continue;

      const reward = rollReward(def);

      next = {
        ...next,
        runesFound: next.runesFound + (reward.rune ? 1 : 0),
        missionsCompleted: next.missionsCompleted + 1,
        goldRecovered: next.goldRecovered + reward.gold,
      };

      returns.push({
        explorer,
        reward,
        returnedAt: explorer.startedAt + explorer.duration,
      });
    }

    this.state = next;
    this.persist();

    // Minting is deliberately after the state is written and flushed. If the
    // ledger write threw, the expedition would otherwise have paid out and
    // still be sitting in `active` to pay out again on the next load.
    let scrollsFound = 0;
    for (const landing of returns) {
      const realm = realmById(landing.explorer.realm);
      this.economy.earnGold(landing.reward.gold, 'expedition');
      this.xp.award('idle', {
        amount: landing.reward.xp,
        energy: realm?.energy ?? 'aether',
      });

      // The rune goes into the Rune Forge's ledger, not ours — that is where
      // duplicates are counted, Runewords are crafted and the Codex reads from.
      if (landing.reward.rune) {
        const rune = runeById(landing.reward.rune);
        // `grant` also rolls the rune's Lore Scroll and banks it, so the scroll
        // on the reward is read back off what it returned rather than rolled
        // here — one find, one roll, one set of shelf rules.
        const find = rune ? this.runeForge.grant(rune) : null;
        if (find?.scroll) {
          landing.reward.scroll = find.scroll.id;
          scrollsFound++;
        }
      }

      this.returned$$.next(landing);
    }

    // The scroll count is only knowable after the grants, so it lands in a
    // second write. Cheap — this runs once per settlement, not per tick.
    if (scrollsFound > 0) {
      this.state = { ...this.state, scrollsFound: this.state.scrollsFound + scrollsFound };
      this.persist();
      this.publish();
    }

    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The tick
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Start the interval when a mission is out, stop it when none is.
   *
   * Called after every state change rather than left running, because the
   * steady state of this page for most visitors is zero explorers, and a
   * one-second re-entry into Angular for a panel showing "no expeditions out"
   * is a change-detection pass a second bought for nothing.
   */
  private syncTimer(): void {
    if (!this.isBrowser) return;
    if (this.state.active.length === 0) { this.stopTimer(); return; }
    if (this.timer !== null) return;

    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        const settled = this.settle();
        this.zone.run(() => {
          if (settled) this.publish();
          this.tick$$.next(Date.now());
        });
        if (settled) this.syncTimer();
      }, TICK_MS);
    });
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private publish(): void {
    this.state$$.next(this.state);
  }

  private load(): ExplorerState {
    try {
      const raw = localStorage.getItem(EXPLORER_KEY);
      if (!raw) return emptyExplorerState();
      const parsed = JSON.parse(raw) as Partial<ExplorerState>;
      const empty = emptyExplorerState();

      // Every field is rebuilt rather than spread over the default, because the
      // blob is user-writable: a hand-edited `active` array carrying a string
      // where a number belongs would otherwise reach `remainingMs` and produce
      // a mission that is permanently 0:00 or permanently NaN.
      return {
        version: 1,
        active: Array.isArray(parsed.active) ? parsed.active.filter(isExplorer) : empty.active,
        runesFound: numberOr(parsed.runesFound, 0),
        scrollsFound: numberOr(parsed.scrollsFound, 0),
        missionsCompleted: numberOr(parsed.missionsCompleted, 0),
        goldRecovered: numberOr(parsed.goldRecovered, 0),
      };
    } catch {
      return emptyExplorerState();
    }
  }

  private persist(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(EXPLORER_KEY, JSON.stringify(this.state));
    } catch {
      // Private mode, or the quota is full. An expedition that cannot be
      // written still runs for this session; losing it on reload is a better
      // outcome than a thrown error taking the panel down with it.
    }
  }

  /** Wipes expeditions and the collection. Used by the progression reset. */
  reset(): void {
    this.state = emptyExplorerState();
    this.persist();
    this.publish();
    this.syncTimer();
  }
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function isExplorer(v: unknown): v is Explorer {
  if (!v || typeof v !== 'object') return false;
  const e = v as Partial<Explorer>;
  return typeof e.id === 'string'
    && typeof e.realm === 'string'
    && typeof e.mission === 'string'
    && typeof e.duration === 'number' && Number.isFinite(e.duration)
    && typeof e.startedAt === 'number' && Number.isFinite(e.startedAt)
    && !!realmById(e.realm as RealmId)
    && !!missionById(e.mission as MissionId);
}
