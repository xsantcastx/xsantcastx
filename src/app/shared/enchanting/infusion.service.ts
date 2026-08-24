/**
 * infusion.service.ts — the owner of the infusion ledger.
 *
 * One blob, `godforge-infusions`, holding at most three rows. It is its own
 * ledger rather than three more fields on the economy for the reason every
 * other feature here has its own: the economy blob is merged by a hand-written
 * per-field merge, and adding a timer to it means teaching that merge what a
 * timer is. A separate key gets its own merge (`mergeInfusionLedgers`) and can
 * be wiped without touching anyone's Gold.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE TIMER TICKS HERE AND NOT ONLY IN THE COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * The countdown on the bench is cosmetic; the *expiry* is not. Two consumers
 * read the multiplier live (`MagicFindService`, the XP hook), and a third has
 * it pushed in (the Gold rate, through `EconomyService.setInfusionGold` — the
 * rate is computed from a pure function over the persisted blob, so it cannot
 * see a clock). The push has to happen when the timer lapses whether or not the
 * bench is on screen, so the tick lives with the ledger.
 *
 * It runs outside Angular and only while something is actually running: an
 * empty ledger costs no interval at all, and the last expiry clears it.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  INFUSIONS,
  MAX_ACTIVE_INFUSIONS,
  channelBonus,
  emptyInfusionLedger,
  infusionById,
  isRunning,
  liveInfusions,
  parseInfusionLedger,
  pruneInfusions,
  type ActiveInfusion,
  type Infusion,
  type InfusionChannel,
  type InfusionLedger,
} from './infusion.model';

export const INFUSIONS_KEY = 'godforge-infusions';

const TICK_MS = 1000;

/** What the bench renders, and what the wiring layers read. */
export interface InfusionSnapshot {
  /** Running now, soonest to expire first. */
  active: ActiveInfusion[];
  /** Free slots out of {@link MAX_ACTIVE_INFUSIONS}. */
  free: number;
  gold: number;
  xp: number;
  magicFind: number;
}

@Injectable({ providedIn: 'root' })
export class InfusionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly zone = inject(NgZone);

  private ledger: InfusionLedger = emptyInfusionLedger();
  private initialised = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly snapshot$$ = new BehaviorSubject<InfusionSnapshot>(
    snapshotOf(emptyInfusionLedger(), 0),
  );
  private readonly brewed$$ = new Subject<Infusion>();
  private readonly lapsed$$ = new Subject<Infusion>();

  readonly snapshot$: Observable<InfusionSnapshot> = this.snapshot$$.asObservable();
  /** One brewed. The bench celebrates on this. */
  readonly brewed$: Observable<Infusion> = this.brewed$$.asObservable();
  /** One ran out. The bench announces it; the wiring layers repush on it. */
  readonly lapsed$: Observable<Infusion> = this.lapsed$$.asObservable();

  readonly catalogue = INFUSIONS;
  readonly maxActive = MAX_ACTIVE_INFUSIONS;

  get snapshot(): InfusionSnapshot { return this.snapshot$$.value; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.ledger = this.load();
    this.publish();
    this.retime();

    this.saves.register(INFUSIONS_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        this.publish();
        this.retime();
      },
    });
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /** Percentage points running on one channel right now. Zero when idle. */
  bonusOn(channel: InfusionChannel, now = Date.now()): number {
    return channelBonus(this.ledger, channel, now);
  }

  /** The same figure as a multiplier — 1.15 for a Moonpetal. */
  multiplierOn(channel: InfusionChannel, now = Date.now()): number {
    return 1 + this.bonusOn(channel, now) / 100;
  }

  isRunning(id: string, now = Date.now()): boolean {
    return isRunning(this.ledger, id, now);
  }

  /** Milliseconds left on one infusion, or 0 when it is not running. */
  remaining(id: string, now = Date.now()): number {
    const row = this.ledger.active.find(entry => entry.id === id);
    return row && row.expiresAt > now ? row.expiresAt - now : 0;
  }

  /**
   * Why this infusion cannot be brewed, or null when it can.
   *
   * Materials are deliberately *not* checked here: this service does not own
   * the bag, and asking it to would give the infusion ledger a dependency on
   * the inventory purely to render a disabled button. `EnchantingGateway`
   * composes the two checks — it is the layer that already holds both.
   */
  blocker(id: string, now = Date.now()): 'unknown' | 'running' | 'slots' | null {
    const def = infusionById(id);
    if (!def) return 'unknown';
    if (this.isRunning(id, now)) return 'running';
    if (liveInfusions(this.ledger, now).length >= MAX_ACTIVE_INFUSIONS) return 'slots';
    return null;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Start one running. The caller has already taken the materials.
   *
   * Deliberately narrow: it refuses on everything `blocker` refuses on and
   * nothing else, because the gateway is what sequences this against the bag.
   * Splitting it that way is what lets the gateway consume materials first and
   * still refuse cleanly — see the order in `enchanting.gateway.ts`.
   */
  start(id: string, now = Date.now()): ActiveInfusion | null {
    if (!this.isBrowser) return null;
    this.init();
    const def = infusionById(id);
    if (!def) return null;
    if (this.blocker(id, now)) return null;

    const row: ActiveInfusion = {
      id,
      startedAt: now,
      expiresAt: now + def.minutes * 60_000,
    };
    // Pruned in the same write: a lapsed row that is still in the array is a
    // slot the cap is counting and the player cannot use.
    const pruned = pruneInfusions(this.ledger, now);
    this.ledger = { ...pruned, active: [...pruned.active, row] };
    this.save();
    this.publish(now);
    this.retime();
    this.brewed$$.next(def);
    return row;
  }

  /** Wipe every timer. Dev-only, mirrors the other services' `reset`. */
  reset(): void {
    if (!this.isBrowser) return;
    this.ledger = emptyInfusionLedger();
    this.store.remove(INFUSIONS_KEY);
    this.publish();
    this.retime();
  }

  // ── The clock ──────────────────────────────────────────────────────────────

  /**
   * Start, stop or leave the tick alone to match what is running.
   *
   * Called after every write and after a rehydrate. An empty ledger has no
   * interval at all, which is the state a visitor who has never touched the
   * bench is in for the whole session.
   */
  private retime(): void {
    const live = liveInfusions(this.ledger, Date.now()).length > 0;
    if (live && !this.timer) {
      this.zone.runOutsideAngular(() => {
        this.timer = setInterval(() => this.sweep(), TICK_MS);
      });
    } else if (!live && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Drop anything that has lapsed, and say so.
   *
   * Re-entering the zone only when something actually changed is what keeps
   * this at zero change-detection passes for the fifty-nine seconds of every
   * minute in which no infusion expires. The bench runs its own countdown for
   * the display.
   */
  private sweep(): void {
    const now = Date.now();
    const before = this.ledger.active;
    const pruned = pruneInfusions(this.ledger, now);
    if (pruned === this.ledger) return;

    const gone = before.filter(row => !pruned.active.some(kept => kept.id === row.id));
    this.ledger = pruned;
    this.save();
    this.zone.run(() => {
      this.publish(now);
      for (const row of gone) {
        const def = infusionById(row.id);
        if (def) this.lapsed$$.next(def);
      }
    });
    this.retime();
  }

  // ── Storage ────────────────────────────────────────────────────────────────

  private load(): InfusionLedger {
    try {
      const raw = this.store.readRaw(INFUSIONS_KEY);
      if (!raw) return emptyInfusionLedger();
      return pruneInfusions(parseInfusionLedger(JSON.parse(raw)), Date.now());
    } catch {
      return emptyInfusionLedger();
    }
  }

  private save(): void {
    if (!this.isBrowser) return;
    this.store.write(INFUSIONS_KEY, this.ledger);
  }

  /**
   * `now` is threaded through from the caller rather than read here so that a
   * publish always describes the same instant the write it follows was applied
   * at. Two clock reads a microsecond apart cannot disagree in production; they
   * can disagree by two years under a test that brews at a fixed timestamp, and
   * a snapshot that contradicts `bonusOn` is not worth the one saved argument.
   */
  private publish(now = Date.now()): void {
    this.snapshot$$.next(snapshotOf(this.ledger, now));
  }
}

function snapshotOf(ledger: InfusionLedger, now: number): InfusionSnapshot {
  const active = liveInfusions(ledger, now);
  return {
    active,
    free: Math.max(0, MAX_ACTIVE_INFUSIONS - active.length),
    gold: channelBonus(ledger, 'gold', now),
    xp: channelBonus(ledger, 'xp', now),
    magicFind: channelBonus(ledger, 'magicFind', now),
  };
}
