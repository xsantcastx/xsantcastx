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
  Expedition,
  ExplorerReturn,
  ExplorerState,
  MAX_EXPLORER_SLOTS,
  MissionId,
  emptyExplorerState,
  missionById,
  remainingMs,
  rollReward,
} from './explorer.model';
import { ExplorerRosterService } from '../rpg/explorer-roster.service';
import { PlayerStatsService } from '../rpg/player-stats.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  explorerTier,
  missionDurationFor,
} from '../rpg/explorer-roster.model';

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
  private readonly roster = inject(ExplorerRosterService);
  private readonly stats = inject(PlayerStatsService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

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

    // The roster has to be hydrated before `load()`, because migrating a
    // pre-roster mission means minting an explorer for it — and a roster that
    // has not read its own key yet would mint a second starter alongside the one
    // already in storage.
    this.roster.init();
    this.stats.init();

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

    // `persist()` writes the whole log from memory, so the lifetime tallies
    // merged in from another device would be dropped by the next dispatch.
    //
    // `mergeExpeditions` deliberately keeps *this* device's `active` list rather
    // than unioning the two, because a mission in flight has a wall-clock
    // deadline on the device that started it and adopting the other one's runs
    // would pay them out twice. So the settle below can only ever be settling
    // expeditions this tab already knew about.
    this.saves.register(EXPLORER_KEY, {
      rehydrate: () => {
        this.state = this.load();
        this.settle();
        this.publish();
        this.syncTimer();
      },
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
  dispatch(realm: RealmId, mission: MissionId, explorerId?: string): boolean {
    if (!this.isBrowser) return false;
    if (this.freeSlots <= 0) return false;

    const def = missionById(mission);
    if (!def || !realmById(realm)) return false;

    // With no explorer named, the best one standing idle goes. `snapshot`
    // returns the roster rarest-first, so "the best available" is the first one
    // that is not already out — which is what a player clicking Dispatch with a
    // roster of twelve expects, and saves them picking every time.
    const chosen = explorerId
      ? this.roster.byId(explorerId)
      : this.roster.snapshot.explorers.find(e => !this.isOut(e.id));
    if (!chosen || this.isOut(chosen.id)) return false;

    const tier = explorerTier(chosen.rarity);

    const expedition: Expedition = {
      id: `${realm}-${mission}-${Date.now()}-${this.state.missionsCompleted}`,
      explorerId: chosen.id,
      realm,
      mission,
      // Speed is applied once, here, and frozen onto the record. See the note on
      // `Expedition.duration`.
      duration: missionDurationFor(def.duration, chosen.rarity),
      startedAt: Date.now(),
      lootBonus: this.roster.lootBonusOf(chosen.id),
      yieldMultiplier: this.stats.missionMultiplier,
    };

    this.state = { ...this.state, active: [...this.state.active, expedition] };
    this.persist();
    this.publish();
    this.syncTimer();
    return true;
  }

  /** True while this explorer is already on a mission. One at a time. */
  isOut(explorerId: string): boolean {
    return this.state.active.some(e => e.explorerId === explorerId);
  }

  /** Roster explorers not currently on a mission, rarest first. */
  get available() {
    return this.roster.snapshot.explorers.filter(e => !this.isOut(e.id));
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

      const who = this.roster.byId(explorer.explorerId);
      // A mission whose explorer has since been dismissed still pays — the
      // player earned the wait. It pays at Common rates, because there is no
      // longer anybody to read a tier off.
      const tier = explorerTier(who?.rarity ?? 'common');

      const reward = rollReward(def, Math.random, {
        inventorySlots: tier.inventorySlots,
        // Both were frozen at dispatch. See the notes on the two fields.
        lootBonus: explorer.lootBonus,
        yieldMultiplier: explorer.yieldMultiplier,
      });

      next = {
        ...next,
        runesFound: next.runesFound + reward.runes.length,
        missionsCompleted: next.missionsCompleted + 1,
        goldRecovered: next.goldRecovered + reward.gold,
      };

      returns.push({
        explorer,
        explorerName: who?.name,
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
    let itemsFound = 0;
    for (const landing of returns) {
      const realm = realmById(landing.explorer.realm);
      this.economy.earnGold(landing.reward.gold, 'expedition');
      this.xp.award('idle', {
        amount: landing.reward.xp,
        energy: realm?.energy ?? 'aether',
      });

      // The runes go into the Rune Forge's ledger, not ours — that is where
      // duplicates are counted, Runewords are crafted and the Codex reads from.
      // One grant per inventory slot that hit, so a Mythic explorer banks six.
      const items: string[] = [];
      for (const runeId of landing.reward.runes) {
        const rune = runeById(runeId);
        if (!rune) continue;
        // `grant` also rolls the rune's Lore Scroll, mints the matching
        // equippable and banks both, so the scroll and the item on the reward
        // are read back off what it returned rather than rolled here — one
        // find, one roll, one set of shelf rules.
        const find = this.runeForge.grant(rune);
        if (find?.scroll) {
          landing.reward.scroll = find.scroll.id;
          scrollsFound++;
        }
        if (find?.item) {
          items.push(find.item.id);
          itemsFound++;
        }
      }
      if (items.length) landing.reward.items = items;

      this.roster.recordMission(landing.explorer.explorerId);
      this.returned$$.next(landing);
    }

    // The scroll and item counts are only knowable after the grants, so they
    // land in a second write. Cheap — this runs once per settlement, not per
    // tick.
    if (scrollsFound > 0 || itemsFound > 0) {
      this.state = {
        ...this.state,
        scrollsFound: this.state.scrollsFound + scrollsFound,
        itemsFound: this.state.itemsFound + itemsFound,
      };
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
      const raw = this.store.readRaw(EXPLORER_KEY);
      if (!raw) return emptyExplorerState();
      const parsed = JSON.parse(raw) as Partial<ExplorerState>;
      const empty = emptyExplorerState();

      // Every field is rebuilt rather than spread over the default, because the
      // blob is user-writable: a hand-edited `active` array carrying a string
      // where a number belongs would otherwise reach `remainingMs` and produce
      // a mission that is permanently 0:00 or permanently NaN.
      const active = Array.isArray(parsed.active)
        ? parsed.active.filter(isExpedition).map(e => this.adopt(e))
        : empty.active;

      return {
        version: 1,
        active,
        itemsFound: numberOr(parsed.itemsFound, 0),
        runesFound: numberOr(parsed.runesFound, 0),
        scrollsFound: numberOr(parsed.scrollsFound, 0),
        missionsCompleted: numberOr(parsed.missionsCompleted, 0),
        goldRecovered: numberOr(parsed.goldRecovered, 0),
      };
    } catch {
      return emptyExplorerState();
    }
  }

  /**
   * Give a mission written by a pre-roster build somebody to belong to.
   *
   * The old record had no `explorerId`, no `lootBonus` and no `yieldMultiplier`.
   * Dropping those missions would be the simpler migration and it would take an
   * hour-long expedition off a visitor who did nothing wrong, so instead they
   * are adopted onto a real roster explorer and given the neutral bonuses —
   * a Common's rates, which is exactly what the mission was dispatched at when
   * every explorer was identical.
   */
  private adopt(e: Expedition): Expedition {
    if (e.explorerId && this.roster.byId(e.explorerId)) return e;
    return {
      ...e,
      explorerId: e.explorerId || this.roster.adoptOrphanMission(),
      lootBonus: numberOr(e.lootBonus, 0),
      yieldMultiplier: Math.max(1, numberOr(e.yieldMultiplier, 1)),
    };
  }

  private persist(): void {
    if (!this.isBrowser) return;
      this.store.write(EXPLORER_KEY, this.state);
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

/**
 * A mission record worth keeping.
 *
 * `explorerId`, `lootBonus` and `yieldMultiplier` are deliberately *not*
 * required here: a blob written by the build before the roster existed carries
 * none of them, and rejecting those records would silently delete every
 * expedition in flight at upgrade time. `adopt` fills them in instead.
 */
function isExpedition(v: unknown): v is Expedition {
  if (!v || typeof v !== 'object') return false;
  const e = v as Partial<Expedition>;
  return typeof e.id === 'string'
    && typeof e.realm === 'string'
    && typeof e.mission === 'string'
    && typeof e.duration === 'number' && Number.isFinite(e.duration)
    && typeof e.startedAt === 'number' && Number.isFinite(e.startedAt)
    && !!realmById(e.realm as RealmId)
    && !!missionById(e.mission as MissionId);
}
