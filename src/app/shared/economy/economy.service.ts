/**
 * economy.service.ts — the Godforge ledger.
 *
 * Same shape as XpService and for the same reason: every mint and every spend
 * goes through one of three methods (`earnGold`, `earnEssence`, `spend`), so
 * there is exactly one place the economy is enforced and exactly one place that
 * writes to storage. A component that wants to give the visitor Gold cannot
 * reach past it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDLE IS SETTLED, NOT TICKED
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious implementation — `setInterval(60_000)` adding one minute of Gold
 * each time it fires — is wrong on a real browser. Background tabs get their
 * timers clamped to once a minute at best and frozen entirely at worst, and a
 * laptop that sleeps for two hours fires nothing at all. A visitor who leaves
 * the tab open across lunch would come back to four minutes of Gold and
 * correctly conclude the whole mechanic is broken.
 *
 * So the timer does not pay anything. It calls `settleIdle()`, which pays for
 * the wall-clock time that has actually elapsed since the last settlement. The
 * interval is a prompt, the elapsed time is the truth, and the same call on
 * page load pays for the time the tab was closed — capped, so that a tab
 * reopened after a fortnight does not mint a fortnight of Gold.
 *
 * The Page Visibility API decides whether that elapsed time *counts*. Hidden
 * time is discarded (the clock is moved forward without paying) unless the
 * Obsidian Heart is held, which is the artifact that buys exactly this.
 *
 * SSR: everything mutating is behind `isBrowser`; the server holds an empty
 * ledger and renders a Market where nothing is affordable, which is the
 * honest thing for a crawler to index.
 */
import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  ARTIFACTS,
  AUTO_CLICKERS,
  Artifact,
  COSMETICS,
  Cosmetic,
  ENCHANTMENTS,
  Enchantment,
  FORGE_UPGRADES,
  GoldBreakdown,
  HAMMER_UPGRADES,
  HammerEffect,
  MULTIPLIER_UPGRADES,
  PlayerEconomy,
  activeEnchantment,
  autoClicksPerSecond,
  canPrestige,
  costOf,
  earnsWhileHidden,
  emptyEconomy,
  flameTier,
  globalMultiplier,
  goldBreakdown,
  goldPerClick,
  goldPerSecond,
  hammerVisual,
  levelCap,
  pendingShards,
  shardMultiplier,
  shardsFor,
  totalUpgradeLevels,
  upgradeById,
} from './economy.model';
import {
  EconomyOp,
  EconomyOpKind,
  coerceLedger,
  maxSeqFor,
  nextHlc,
  snapshotOf,
} from './economy-ops';

export const ECONOMY_KEY = 'godforge-economy';
const DEVICE_KEY = 'godforge-device-id';

/** One second. The tick, and the unit the whole economy is priced in. */
const SECOND_MS = 1_000;
/** One minute, still the window the Click Frenzy achievement is measured over. */
const MINUTE_MS = 60_000;

/**
 * The most offline time one settlement will pay for, in seconds.
 *
 * Eight hours. Long enough that a tab left open overnight pays out properly,
 * short enough that a machine restored from a two-week-old suspend does not
 * hand over a fortnight of Gold in a single frame — and short enough that
 * moving the system clock forward is not a strategy.
 */
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

/**
 * How often the ledger is actually written, in ms.
 *
 * The tick now fires sixty times more often than it used to, and a
 * `localStorage.setItem` of the whole blob every second — synchronous, on the
 * main thread, for a tab that may be doing nothing else — is a cost with no
 * matching benefit. Writing every five seconds is safe because Gold and
 * `lastIdleAt` are written *together*: a dropped write rewinds both, so the
 * next load re-settles exactly the span it did not save and pays it once. The
 * failure mode of the throttle is a repeat of work already done, never a
 * double credit and never a loss.
 *
 * Anything that must not be lost — a purchase, an Eclipse reset, the tab going
 * away — flushes immediately instead.
 */
const PERSIST_INTERVAL_MS = 5_000;

/** Minimum ms between two paying strikes of the Forge Flame. */
export const CLICK_COOLDOWN_MS = 500;

/** What the Flame, the currency rail and the Market all render. */
export interface EconomySnapshot {
  gold: number;
  essence: number;
  totalGoldEarned: number;
  /** Gold minted since the last Eclipse. */
  runGoldEarned: number;
  totalClicks: number;
  /** Strikes the automatons have thrown. Never counted as yours. */
  autoClicks: number;
  /** Gold per second, everything applied. The headline number. */
  perSecond: number;
  /** The same rate per minute, for the surfaces that still say "a minute". */
  perMinute: number;
  /** Every line of `perSecond`, so the Market can show its working. */
  breakdown: GoldBreakdown;
  /** Strikes a second the automatons are throwing, before any multiplier. */
  autoPerSecond: number;
  /** Gold per strike, everything applied. */
  perClick: number;
  /** Eclipse Shards held. */
  shards: number;
  /** What those shards are paying. 7 shards is 1.35. */
  shardMult: number;
  /** How many Eclipses have been taken. */
  prestigeCount: number;
  /** Shards the next Eclipse would hand over. */
  pendingShards: number;
  /** True when the Eclipse reset is open and worth taking. */
  prestigeReady: boolean;
  /** The daily streak the rate is being multiplied by. */
  streakDays: number;
  /** 0-5. How elaborate the Flame is drawn. */
  flameTier: number;
  /** Loudest owned hammer visual. */
  hammerVisual: HammerEffect;
  upgradeLevels: number;
  artifacts: string[];
  cosmetics: string[];
  /** Runeword ids crafted at the Rune Forge. */
  runewords: string[];
  equipped: Record<string, string>;
  /** The strongest enchantment running, with its expiry. */
  enchantment: { def: Enchantment; expiresAt: number } | null;
  /** True while the Fragment of the First Sun is held. */
  doubled: boolean;
}

/** Emitted on every mint, so the Flame can float a "+5" and the rail can pulse. */
export interface CurrencyGain {
  currency: 'gold' | 'essence';
  amount: number;
  /** Where it came from. Drives the copy on the toast, when there is one. */
  source: string;
}

/** Emitted when something is bought, so the Market can play the coin ping. */
export interface PurchaseEvent {
  kind: 'upgrade' | 'enchantment' | 'artifact' | 'cosmetic' | 'runeword';
  id: string;
  name: string;
  cost: number;
  currency: 'gold' | 'essence';
  /** How much the Gold/sec rate moved. Drives the green "+2.5/sec" floater. */
  rateDelta: number;
}

/** Emitted when an Eclipse is taken, so the Market can celebrate the wipe. */
export interface PrestigeEvent {
  /** Shards handed over by this reset. */
  granted: number;
  /** Shards held afterwards. */
  total: number;
  /** How many Eclipses have now been taken. */
  count: number;
}

@Injectable({ providedIn: 'root' })
export class EconomyService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private state: PlayerEconomy = emptyEconomy();
  private initialised = false;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private pageHideHandler: (() => void) | null = null;

  /** Epoch ms of the last write, and the trailing write scheduled after it. */
  private lastPersistAt = 0;
  private persistHandle: ReturnType<typeof setTimeout> | null = null;

  /**
   * The current rank, mirrored in by the wiring layer.
   *
   * In memory only, unlike the streak: the prestige gate is the one thing that
   * reads it, that gate is a button on a page, and progression will always have
   * hydrated before anybody has scrolled to it. The streak has to be persisted
   * because offline settlement prices eight hours from the blob alone.
   */
  private rankLevel = 1;
  /** Charisma's Market discount, as a multiplier. 1 until the RPG layer says otherwise. */
  private priceMultiplier = 1;

  /** Epoch ms of the last strike that paid, for the 500ms cooldown. */
  private deviceId = '';
  private opSeq = 0;
  private pendingGold = 0;
  private pendingEssence = 0;
  private lastClickAt = 0;
  /**
   * Recent strike timestamps, for the Click Frenzy achievement. In memory only
   * and trimmed to the last minute — a frenzy that spans a reload is not a
   * frenzy anyone sustained.
   */
  private recentClicks: number[] = [];

  private readonly snapshot$$ = new BehaviorSubject<EconomySnapshot>(this.snapshotOf(this.state, 0));
  private readonly gain$$ = new Subject<CurrencyGain>();
  private readonly purchase$$ = new Subject<PurchaseEvent>();
  private readonly milestone$$ = new Subject<{ clicks: number; bonus: number }>();
  private readonly autoStrike$$ = new Subject<number>();
  private readonly prestige$$ = new Subject<PrestigeEvent>();

  /** Current holdings, replayed to late subscribers. */
  readonly snapshot$: Observable<EconomySnapshot> = this.snapshot$$.asObservable();
  /** One per mint. Not replayed — a missed gain is a missed animation. */
  readonly gain$: Observable<CurrencyGain> = this.gain$$.asObservable();
  readonly purchase$: Observable<PurchaseEvent> = this.purchase$$.asObservable();
  /** Century Strike and Millennium Forge. `bonus` is the Gold that came with it. */
  readonly milestone$: Observable<{ clicks: number; bonus: number }> = this.milestone$$.asObservable();
  /**
   * One beat a second while automatons are owned, carrying how many struck.
   *
   * A *display* signal, not a payout: the Gold is already in the per-second
   * rate. The Flame subscribes to make itself look struck, which is why this
   * fires once a second whether the visitor owns one automaton or twenty-six —
   * animating twenty-six strikes a second would be a strobe, and nobody could
   * count them anyway.
   */
  readonly autoStrike$: Observable<number> = this.autoStrike$$.asObservable();
  readonly prestige$: Observable<PrestigeEvent> = this.prestige$$.asObservable();

  get snapshot(): EconomySnapshot { return this.snapshot$$.value; }
  /** A copy. Callers render it; nothing outside this file may reach the ledger. */
  get economy(): PlayerEconomy { return { ...this.state }; }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Hydrate, settle whatever idle time is owed, and start the minute prompt.
   * Idempotent — every component that wants currency calls it without having to
   * coordinate who is first.
   */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.state = this.load();
    this.bindDevice();
    // First run: start the idle clock now rather than at epoch zero, or the
    // first settlement pays out the eight-hour cap for a visitor who has been
    // here four seconds.
    if (!this.state.lastIdleAt) this.state.lastIdleAt = Date.now();

    this.settleIdle();
    // Publish the hydrated ledger. `settleIdle()` only publishes when Gold
    // actually moved, and on most loads it has not — so without this the
    // BehaviorSubject keeps handing out the empty snapshot it was constructed
    // with, and every surface bound to it renders a visitor with 30,000 Gold as
    // having none until their next click happens to trigger a publish.
    this.publish();

    // The tick runs outside Angular and re-enters exactly once a second, and
    // only when there is something to show: `settleIdle()` returns without
    // touching the zone when the tab is hidden or the rate is zero. That is the
    // whole budget for the visible counter — one change-detection pass a
    // second on a foreground tab, nothing at all on a background one.
    this.zone.runOutsideAngular(() => {
      this.idleTimer = setInterval(() => this.settleIdle(), SECOND_MS);

      // Settling on the visibility edge is what makes hidden time discardable
      // without a second clock: going hidden pays out everything owed up to
      // that instant, and coming back settles the gap under the hidden rules.
      // It also flushes, because a tab that goes hidden on a phone is a tab
      // that may never get another frame before it is killed.
      this.visibilityHandler = () => {
        this.settleIdle();
        this.flush();
        if (document.visibilityState === 'visible') this.zone.run(() => this.publish());
      };
      document.addEventListener('visibilitychange', this.visibilityHandler, { passive: true });

      // `pagehide` rather than `beforeunload`: the latter is not fired at all
      // on a page entering the back/forward cache on iOS, which is exactly the
      // case where a throttled write would otherwise be the one that is lost.
      this.pageHideHandler = () => this.flush();
      window.addEventListener('pagehide', this.pageHideHandler, { passive: true });
    });

    // Registered last, so that being registered always means "is holding a
    // hydrated ledger". Cloud save calls `flush` before it reads the blob and
    // `rehydrate` the instant it writes a merged one — without which this
    // service's next write puts the pre-merge Gold straight back, which it did
    // on a one-second tick and again on `pagehide`. See LocalSaveRegistry.
    this.saves.register(ECONOMY_KEY, {
      flush: () => this.flush(),
      rehydrate: () => this.rehydrate(),
    });
  }

  /**
   * Re-read the ledger from storage, discarding the in-memory copy.
   *
   * Called only by cloud save, immediately after it has written a merged ledger
   * over ours. Cancelling the trailing write first is the whole point: a timer
   * scheduled a moment ago would otherwise fire after this has re-read and
   * overwrite the merged Gold with the copy this service was holding.
   *
   * `settleIdle()` is deliberately *not* run here. The merged blob carries the
   * later of the two devices' `lastIdleAt` — the merge takes the larger number —
   * so there is nothing owed, and settling would price a span this device did
   * not spend in front of the forge. The next tick pays from the merged clock.
   */
  private rehydrate(): void {
    if (!this.isBrowser) return;
    if (this.persistHandle !== null) {
      clearTimeout(this.persistHandle);
      this.persistHandle = null;
    }
    this.state = this.load();
    this.pendingGold = 0;
    this.pendingEssence = 0;
    this.bindDevice();
    if (!this.state.lastIdleAt) this.state.lastIdleAt = Date.now();
    this.publish();
  }

  ngOnDestroy(): void {
    if (this.idleTimer !== null) clearInterval(this.idleTimer);
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
    }
    this.flush();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Minting
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * The single Gold mint. `amount` is the base payout; the global multiplier is
   * applied here so no caller has to remember it.
   *
   * Returns the Gold actually credited, which the Flame renders as a floater.
   */
  earnGold(amount: number, source = 'forge'): number {
    if (!this.isBrowser || amount <= 0) return 0;

    const credited = Math.round(amount * globalMultiplier(this.state));
    this.credit(credited);

    this.persistSoon();
    this.publish();
    this.gain$$.next({ currency: 'gold', amount: credited, source });
    return credited;
  }

  /**
   * The one place Gold is added to the ledger.
   *
   * Three counters move together and none of them may ever move alone:
   * `gold` is spendable and goes down again, `runGoldEarned` is the current
   * Eclipse and is wiped by a reset, and `totalGoldEarned` is all-time and is
   * what prestige is priced off. Splitting this across the four call sites is
   * how one of them eventually forgets the third and quietly stops the shard
   * curve advancing.
   */
  private credit(amount: number): void {
    this.state.gold += amount;
    this.state.runGoldEarned += amount;
    this.state.totalGoldEarned += amount;
    this.pendingGold += amount;
  }

  /**
   * Take Gold for something that is not a catalog purchase.
   *
   * The four `buy*` methods each price their own item out of their own catalog
   * and debit inline. This is the door for a system that sets its own price —
   * the Rune Forge, whose strike costs a flat fee and returns a random rune
   * rather than a known item — and it deliberately does not touch
   * `totalGoldEarned` or `runGoldEarned`: those two count Gold *minted*, and a
   * spend that reduced them would let a player lower their own prestige curve
   * by gambling, which is the opposite of what the curve is for.
   *
   * False when the visitor cannot afford it. Never partially debits.
   */
  spendGold(amount: number, reason = 'spend'): boolean {
    if (!this.isBrowser || amount <= 0) return false;
    if (this.state.gold < amount) return false;

    this.recordOp('spend-gold', { amount });
    this.state.gold -= amount;
    // A spend is the kind of thing that must survive the tab closing one frame
    // later, so it flushes rather than joining the throttle — same reasoning as
    // `buyUpgrade`.
    this.flush();
    this.publish();
    this.gain$$.next({ currency: 'gold', amount: -amount, source: reason });
    return true;
  }

  /**
   * Record a Runeword as crafted.
   *
   * The runes were already checked and consumed by `RuneForgeService`; this is
   * only the ledger half, and it lives here because `goldBreakdown()` has to be
   * able to price a word's income bonus from the persisted blob alone during
   * offline settlement. False on an unknown id or one already held.
   */
  grantRuneword(id: string, name = id): boolean {
    if (!this.isBrowser) return false;
    if (this.state.runewords.includes(id)) return false;

    const before = goldPerSecond(this.state);

    this.recordOp('grant-runeword', { itemId: id });
    this.state.runewords = [...this.state.runewords, id];

    this.flush();
    this.publish();
    this.purchase$$.next({
      kind: 'runeword',
      id,
      name,
      cost: 0,
      currency: 'gold',
      rateDelta: goldPerSecond(this.state) - before,
    });
    return true;
  }

  /** Runeword ids already crafted. */
  get runewords(): string[] { return [...this.state.runewords]; }

  hasRuneword(id: string): boolean { return this.state.runewords.includes(id); }

  /**
   * The single Essence mint. Not multiplied by the Fragment: Essence is the
   * currency the Fragment is *bought* with, and a permanent 2× on the only
   * income that can buy more permanents is a loop that eats its own economy.
   */
  earnEssence(amount: number, source = 'realm'): number {
    if (!this.isBrowser || amount <= 0) return 0;

    this.state.eclipseEssence += amount;
    this.pendingEssence += amount;
    this.persistSoon();
    this.publish();
    this.gain$$.next({ currency: 'essence', amount, source });
    return amount;
  }

  /**
   * One strike of the Forge Flame.
   *
   * Returns what it paid, or null when the strike landed inside the cooldown —
   * the Flame uses null to decide whether to animate, so a held-down mouse
   * button does not strobe.
   */
  strike(): { gold: number; count: number; century: boolean; millennium: boolean } | null {
    if (!this.isBrowser) return null;

    const now = Date.now();
    if (now - this.lastClickAt < CLICK_COOLDOWN_MS) return null;
    this.lastClickAt = now;

    this.state.totalClicks += 1;
    const count = this.state.totalClicks;

    // The 100th strike pays its bonus through the same mint as everything else,
    // so the Fragment doubles it exactly once and the ledger stays auditable.
    const century = count % 100 === 0;
    const millennium = count % 1000 === 0;

    let gold = goldPerClick(this.state);
    if (century) gold += 10;

    // Credit directly rather than through earnGold(): goldPerClick() has already
    // applied every multiplier to the per-strike figure, and running it through
    // the mint would apply the Fragment a second time.
    this.credit(gold);

    this.recentClicks.push(now);
    const cutoff = now - MINUTE_MS;
    this.recentClicks = this.recentClicks.filter(t => t >= cutoff);

    this.persistSoon();
    this.publish();
    this.gain$$.next({ currency: 'gold', amount: gold, source: 'strike' });
    if (century || millennium) {
      this.milestone$$.next({ clicks: count, bonus: century ? 10 : 0 });
    }

    return { gold, count, century, millennium };
  }

  /** Distinct strikes inside the last minute. Feeds the Click Frenzy check. */
  get clicksLastMinute(): number {
    const cutoff = Date.now() - MINUTE_MS;
    return this.recentClicks.filter(t => t >= cutoff).length;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Idle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pay for the wall-clock seconds since the last settlement.
   *
   * Whole seconds only, and the remainder stays on the clock — settling twice
   * inside one second must not round a partial second up twice, which is what a
   * visibility flicker would do.
   *
   * The Gold credited here is deliberately *not* rounded. At the base rate the
   * forge makes a tenth of a Gold a second, and rounding each second to an
   * integer would round it to zero every time: a brand-new visitor would watch
   * a counter that says "0.1 Gold/sec" produce nothing at all, forever. The
   * fraction is carried on the balance and floored only where it is displayed.
   */
  private settleIdle(): void {
    if (!this.isBrowser) return;

    const now = Date.now();
    const elapsed = now - this.state.lastIdleAt;

    // A clock that moved backwards (NTP correction, manual change) would
    // otherwise sit at a negative elapsed forever. Re-anchor and pay nothing.
    if (elapsed < 0) {
      this.state.lastIdleAt = now;
      this.persistSoon();
      return;
    }

    const wholeSeconds = Math.floor(elapsed / SECOND_MS);
    if (wholeSeconds < 1) return;

    const seconds = Math.min(wholeSeconds, MAX_OFFLINE_SECONDS);
    // Advance by exactly what was paid for, leaving the sub-second remainder.
    this.state.lastIdleAt += wholeSeconds * SECOND_MS;

    const hidden = document.visibilityState !== 'visible';
    if (hidden && !earnsWhileHidden(this.state)) {
      // The clock has moved; nothing is owed. Persist so a reload does not
      // re-examine the same span and pay it under visible rules.
      this.persistSoon();
      return;
    }

    const gold = goldPerSecond(this.state) * seconds;
    if (gold <= 0) {
      this.persistSoon();
      return;
    }

    this.credit(gold);

    // Counted apart from `totalClicks`, which is the visitor's own arm and is
    // what three of the Codex achievements are for.
    const autoRate = autoClicksPerSecond(this.state);
    if (autoRate > 0) this.state.autoClicks += autoRate * seconds;

    this.persistSoon();

    // Nothing below this line is worth a change-detection pass on a tab nobody
    // is looking at. The Gold is already banked; the animation is not owed.
    if (hidden) return;

    // Back into the zone: the header ticker and the Flame are both bound to the
    // snapshot, and a mint outside the zone would not repaint until something
    // else happened to trigger a pass. Exactly one re-entry per second.
    this.zone.run(() => {
      this.publish();
      this.gain$$.next({ currency: 'gold', amount: gold, source: 'idle' });
      // One beat regardless of how many automatons are owned — see `autoStrike$`.
      if (autoRate > 0) this.autoStrike$$.next(autoRate);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Spending
  // ───────────────────────────────────────────────────────────────────────────

  /** Levels owned of one upgrade. */
  levelOf(id: string): number {
    return this.state.upgrades[id] ?? 0;
  }

  /**
   * What the next level of an upgrade costs right now.
   *
   * Resolved against the whole catalog rather than the two original ladders:
   * multipliers and automatons live in the same `upgrades` map and are bought
   * through the same method, so there is one price function for all four.
   */
  nextCost(id: string): number {
    const def = upgradeById(id);
    return def ? this.discounted(costOf(def.baseCost, this.levelOf(id))) : Infinity;
  }

  /**
   * Apply the Charisma discount to a Gold price.
   *
   * Rounded up, so a discount can never take a price to zero and a ladder can
   * never become free. Every Gold price in the Market goes through here; the
   * Essence prices deliberately do not, because Essence is a prestige currency
   * and discounting it with a levelling stat is a different balance question
   * than the one Charisma was written to answer.
   */
  private discounted(cost: number): number {
    if (this.priceMultiplier >= 1) return cost;
    return Math.max(1, Math.ceil(cost * this.priceMultiplier));
  }

  /**
   * Install the Charisma price multiplier. Pushed in by the RPG wiring layer for
   * the same reason the rank is: the ledger must not depend on the stat panel.
   *
   * Not persisted, unlike `rpgFlatGold`. A price is only ever read while the
   * page is open and the visitor is looking at the Market, so there is no
   * offline settlement that needs it — and a stale discount surviving in the
   * blob after a respec would be worse than recomputing it on every load.
   */
  setPriceMultiplier(multiplier: number): void {
    const next = Number.isFinite(multiplier)
      ? Math.min(1, Math.max(0.05, multiplier))
      : 1;
    if (next === this.priceMultiplier) return;
    this.priceMultiplier = next;
    this.publish();
  }

  /** What the Charisma discount currently is, as a multiplier. 1 means none. */
  get marketPriceMultiplier(): number { return this.priceMultiplier; }

  /** What a cosmetic costs after Charisma. The price the Market must render. */
  cosmeticCost(id: string): number {
    const def = COSMETICS.find(c => c.id === id);
    return def ? this.discounted(def.cost) : Infinity;
  }

  /**
   * True once an upgrade is held to its ceiling and cannot be bought again.
   *
   * Most ladders have no ceiling, so this is false for them forever. The
   * multipliers cap at one and the expedition ladder caps at four — both answer
   * through `levelCap`, so a third capped ladder needs no change here.
   */
  isMaxed(id: string): boolean {
    return this.levelOf(id) >= levelCap(id);
  }

  /**
   * Buy one level from any of the four Gold ladders.
   *
   * False when it is unaffordable, unknown, or already held and unrepeatable.
   * The rate delta is measured across the purchase and shipped on the event so
   * the Market can float the green "+2.5/sec" without recomputing the whole
   * breakdown itself — and so that a purchase which changes nothing visible
   * (a Hammer, when no automatons are owned) does not float a "+0".
   */
  buyUpgrade(id: string): boolean {
    if (!this.isBrowser) return false;
    const def = upgradeById(id);
    if (!def || this.isMaxed(id)) return false;

    // Through `nextCost` rather than `costOf` directly, so the Charisma discount
    // is charged at the till and not merely displayed on the shelf. The two
    // drifting apart is the classic version of this bug: the panel shows the
    // reduced price and the purchase silently takes the full one.
    const cost = this.nextCost(id);
    if (this.state.gold < cost) return false;

    const before = goldPerSecond(this.state);

    this.recordOp('buy-upgrade', { amount: cost, itemId: id });
    this.state.gold -= cost;
    this.state.upgrades = { ...this.state.upgrades, [id]: this.levelOf(id) + 1 };

    // A purchase is the kind of thing that must survive the tab being closed
    // one frame later, so it flushes rather than joining the throttle.
    this.flush();
    this.publish();
    this.purchase$$.next({
      kind: 'upgrade',
      id,
      name: def.name,
      cost,
      currency: 'gold',
      rateDelta: goldPerSecond(this.state) - before,
    });
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Prestige
  // ───────────────────────────────────────────────────────────────────────────

  /** The rank the prestige gate is measured against. Fed by the wiring layer. */
  setRankLevel(level: number): void {
    if (level === this.rankLevel) return;
    this.rankLevel = level;
    this.publish();
  }

  /**
   * The daily streak the rate is multiplied by. Persisted, because offline
   * settlement has to be able to price eight hours from the blob alone.
   */
  setStreakDays(days: number): void {
    if (!this.isBrowser || days === this.state.streakDays) return;
    this.state.streakDays = days;
    this.persistSoon();
    this.publish();
  }

  /**
   * Flat Gold/sec from stat points and equipped items, mirrored in by the RPG
   * wiring layer. Persisted for the same reason the streak is — see the field's
   * note on `PlayerEconomy`.
   *
   * Rounded to one decimal before the equality check: the value is a sum of
   * one-decimal item rolls, so float drift would otherwise make every
   * recomputation look like a change and schedule a write per equip.
   */
  setRpgFlatGold(perSecond: number): void {
    if (!this.isBrowser) return;
    const next = Number.isFinite(perSecond)
      ? Math.round(Math.max(0, perSecond) * 10) / 10
      : 0;
    if (next === this.state.rpgFlatGold) return;
    this.state.rpgFlatGold = next;
    this.persistSoon();
    this.publish();
  }

  get shards(): number { return this.state.eclipseShards; }
  get pendingShards(): number { return pendingShards(this.state); }
  get prestigeCount(): number { return this.state.prestigeCount; }
  get canPrestige(): boolean { return canPrestige(this.state, this.rankLevel); }

  /**
   * Take the Eclipse: wipe the Gold economy, keep the shards, and hand over
   * whatever the all-time total has earned since the last reset.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHAT SURVIVES, AND WHY IT IS NOT EVERYTHING
   * ───────────────────────────────────────────────────────────────────────────
   * Gold, `runGoldEarned` and all four Gold ladders go. Shards, the all-time
   * total and `shardsGranted` stay, which is what makes the curve honest across
   * resets.
   *
   * Rank does *not* reset, and that is a deliberate departure from the usual
   * prestige shape. The rank in this app is not a score the economy owns — it
   * gates lore chapters, drives quest availability, stamps discovery dates on
   * the Codex wall and is the counter Essence has already been paid against.
   * Wiping it would delete records of things the visitor genuinely did, in
   * systems that predate the Market and cannot tell a prestige from data loss.
   * The Essence shelf is left alone for the same reason: artifacts and
   * cosmetics are bought with a currency this reset does not refund, and taking
   * them would be charging for the privilege.
   *
   * Returns the shards granted, or 0 when the reset was not open.
   */
  prestige(): number {
    if (!this.isBrowser || !this.canPrestige) return 0;

    const granted = pendingShards(this.state);
    if (granted < 1) return 0;

    const grantedCurve = shardsFor(this.state.totalGoldEarned);
    this.recordOp('prestige', { amount: granted, extra: grantedCurve });
    this.state.eclipseShards += granted;
    // Marked against the all-time curve, never against the run — this is what
    // stops four resets at ten million out-earning one at forty.
    this.state.shardsGranted = grantedCurve;
    this.state.prestigeCount += 1;

    this.state.gold = 0;
    this.state.runGoldEarned = 0;
    this.state.upgrades = {};
    this.state.lastIdleAt = Date.now();

    this.flush();
    this.publish();
    this.prestige$$.next({
      granted,
      total: this.state.eclipseShards,
      count: this.state.prestigeCount,
    });
    return granted;
  }

  /**
   * Buy an enchantment and start its timer.
   *
   * Buying one that is already running extends it from *now* rather than from
   * the old expiry, which is the reading that cannot be gamed: stacking from
   * the expiry would let a visitor bank a week of Eclipse Aura in one sitting
   * for a currency that is meant to be spent on the thing you need today.
   */
  buyEnchantment(id: string): boolean {
    if (!this.isBrowser) return false;
    const def = ENCHANTMENTS.find(e => e.id === id);
    if (!def || this.state.eclipseEssence < def.cost) return false;

    const now = Date.now();
    const expiresAt = now + def.hours * 3_600_000;
    this.recordOp('buy-enchantment', { amount: def.cost, itemId: id, extra: expiresAt });
    this.state.eclipseEssence -= def.cost;
    this.state.enchantments = [
      ...this.state.enchantments.filter(a => a.id !== id && a.expiresAt > now),
      { id, expiresAt },
    ];

    this.flush();
    this.publish();
    this.purchase$$.next({ kind: 'enchantment', id, name: def.name, cost: def.cost, currency: 'essence', rateDelta: 0 });
    return true;
  }

  /** Buy an artifact. Once only — a second attempt returns false. */
  buyArtifact(id: string): boolean {
    if (!this.isBrowser) return false;
    const def = ARTIFACTS.find(a => a.id === id);
    if (!def || this.ownsArtifact(id) || this.state.eclipseEssence < def.cost) return false;

    const before = goldPerSecond(this.state);

    this.recordOp('buy-artifact', { amount: def.cost, itemId: id });
    this.state.eclipseEssence -= def.cost;
    this.state.artifacts = [...this.state.artifacts, id];

    this.flush();
    this.publish();
    this.purchase$$.next({
      kind: 'artifact',
      id,
      name: def.name,
      cost: def.cost,
      currency: 'essence',
      // The Fragment of the First Sun doubles the rate, so this line is the one
      // artifact purchase that floats a number worth reading.
      rateDelta: goldPerSecond(this.state) - before,
    });
    return true;
  }

  /**
   * Buy a cosmetic slot, equipping its first variant. Switching variants after
   * that is free — see the note on `Cosmetic`.
   */
  buyCosmetic(id: string): boolean {
    if (!this.isBrowser) return false;
    const def = COSMETICS.find(c => c.id === id);
    if (!def || this.ownsCosmetic(id)) return false;

    // Cosmetics are Gold-priced, so Charisma discounts them like every other
    // Gold price in the Market. `cosmeticCost` is what the panel renders.
    const cost = this.discounted(def.cost);
    if (this.state.gold < cost) return false;

    const variant = def.variants[0].id;
    this.recordOp('buy-cosmetic', { amount: cost, itemId: id, slot: def.slot, extra: variant });
    this.state.gold -= cost;
    this.state.cosmetics = [...this.state.cosmetics, id];
    this.state.equipped = { ...this.state.equipped, [def.slot]: variant };

    this.flush();
    this.publish();
    this.purchase$$.next({ kind: 'cosmetic', id, name: def.name, cost, currency: 'gold', rateDelta: 0 });
    return true;
  }

  /**
   * Unlock a cosmetic without charging for it, equipping a chosen variant.
   *
   * The Pro Pack's entitlement path. Kept separate from `buyCosmetic` rather
   * than added as a `free` flag, because the two differ in more than price:
   * a grant picks its own variant (the Pack promises a *golden* XP bar, not
   * whichever variant happens to be listed first), and it must not publish a
   * `purchase$` event — that stream drives the "you bought something" toast and
   * the spending achievements, neither of which should fire for something the
   * visitor was given.
   *
   * Idempotent on the cosmetic: re-granting an already-owned slot still moves
   * the equipped variant, so a buyer who had bought the frame themselves and
   * then bought Pro ends up wearing the Pro variant rather than silently
   * getting nothing.
   */
  grantCosmetic(cosmeticId: string, variantId: string): boolean {
    if (!this.isBrowser) return false;
    const def = COSMETICS.find(c => c.id === cosmeticId);
    if (!def) return false;
    // Validate the variant against the catalogue rather than trusting the
    // caller: an unknown id would otherwise be written into `equipped` and
    // paint as a missing `data-cos-*` value forever.
    if (!def.variants.some(v => v.id === variantId)) return false;

    this.recordOp('grant-cosmetic', { itemId: cosmeticId, slot: def.slot, extra: variantId });
    if (!this.ownsCosmetic(cosmeticId)) {
      this.state.cosmetics = [...this.state.cosmetics, cosmeticId];
    }
    this.state.equipped = { ...this.state.equipped, [def.slot]: variantId };

    this.flush();
    this.publish();
    return true;
  }

  /** Switch (or clear, with null) the variant in an owned cosmetic's slot. */
  equip(cosmeticId: string, variantId: string | null): boolean {
    if (!this.isBrowser) return false;
    const def = COSMETICS.find(c => c.id === cosmeticId);
    if (!def || !this.ownsCosmetic(cosmeticId)) return false;
    if (variantId && !def.variants.some(v => v.id === variantId)) return false;

    this.recordOp('equip', { itemId: variantId ?? undefined, slot: def.slot });
    const equipped = { ...this.state.equipped };
    if (variantId) equipped[def.slot] = variantId;
    else delete equipped[def.slot];
    this.state.equipped = equipped;

    this.flush();
    this.publish();
    return true;
  }

  /** The highest rank already paid Essence for. */
  get levelsPaid(): number { return this.state.levelsPaid; }
  /** Seven-day streak milestones already paid. */
  get streakWeeksPaid(): number { return this.state.streakWeeksPaid; }

  /**
   * Record that ranks up to `level` have been settled.
   *
   * Written *before* the Essence is minted by the caller, deliberately: if the
   * storage write throws, the visitor is short five Essence, which is a
   * complaint. If the mint happened first and the marker failed to save, every
   * page load would pay for the same rank again, which is a printing press.
   *
   * Flushed rather than throttled for exactly that reason — "written first" is
   * not a property a five-second write window can offer.
   */
  markLevelsPaid(level: number): void {
    if (!this.isBrowser || level <= this.state.levelsPaid) return;
    this.state.levelsPaid = level;
    this.flush();
  }

  markStreakWeeksPaid(weeks: number): void {
    if (!this.isBrowser || weeks <= this.state.streakWeeksPaid) return;
    this.state.streakWeeksPaid = weeks;
    this.flush();
  }

  ownsArtifact(id: string): boolean { return this.state.artifacts.includes(id); }
  ownsCosmetic(id: string): boolean { return this.state.cosmetics.includes(id); }
  equippedIn(slot: string): string | null { return this.state.equipped[slot] ?? null; }

  /** Every artifact bought. Used by the completion achievement. */
  get artifactsOwned(): number { return this.state.artifacts.length; }
  get allArtifactsOwned(): boolean { return this.state.artifacts.length >= ARTIFACTS.length; }
  get upgradeLevels(): number { return totalUpgradeLevels(this.state); }
  get hasBoughtAnything(): boolean {
    return this.upgradeLevels > 0
      || this.state.artifacts.length > 0
      || this.state.cosmetics.length > 0
      || this.state.enchantments.length > 0;
  }

  /**
   * Wipe the ledger, shards and all. Exposed for the console alongside the
   * other resets — this is the developer's wipe, not the Eclipse: `prestige()`
   * is the one that keeps what a visitor has earned.
   */
  reset(): void {
    if (!this.isBrowser) return;
    if (this.persistHandle !== null) {
      clearTimeout(this.persistHandle);
      this.persistHandle = null;
    }
    this.state = emptyEconomy();
    this.pendingGold = 0;
    this.pendingEssence = 0;
    this.rotateDeviceId();
    this.state.lastIdleAt = Date.now();
    this.recentClicks = [];
    this.store.remove(ECONOMY_KEY);
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): PlayerEconomy {
    try {
      const raw = this.store.readRaw(ECONOMY_KEY);
      if (!raw) return emptyEconomy();
      const parsed = JSON.parse(raw) as Partial<PlayerEconomy>;
      const now = Date.now();
      return {
        // Merged over a fresh blob so a ledger written by an older build still
        // hydrates rather than throwing on a field added since.
        ...emptyEconomy(),
        ...parsed,
        upgrades: parsed.upgrades ?? {},
        artifacts: parsed.artifacts ?? [],
        cosmetics: parsed.cosmetics ?? [],
        runewords: parsed.runewords ?? [],
        equipped: parsed.equipped ?? {},
        // Expired enchantments are dropped on read rather than left to
        // accumulate — a visitor who has run fifty of them over a month should
        // not be carrying fifty dead timers in localStorage.
        enchantments: (parsed.enchantments ?? []).filter(e => e && e.expiresAt > now),
        // Version 1 blobs carry none of the prestige fields. The spread over a
        // fresh `emptyEconomy()` above has already supplied them at zero, which
        // is the correct starting point for every one of them: no shards held,
        // none granted, no Eclipses taken, and a run that has earned whatever
        // the all-time total says. No migration step is needed and none is run.
        version: 2,
        ops: parsed.ops ?? [],
        origin: parsed.origin ?? null,
        hlc: parsed.hlc ?? 0,
        applied: parsed.applied ?? {},
      };
    } catch {
      return emptyEconomy();
    }
  }

  /**
   * Write now, cancelling any trailing write already scheduled.
   *
   * Used by everything whose loss would be visible: a purchase, an Eclipse, a
   * paid-rank marker, and the tab going away.
   */
  private flush(): void {
    if (!this.isBrowser) return;
    if (this.persistHandle !== null) {
      clearTimeout(this.persistHandle);
      this.persistHandle = null;
    }
    this.lastPersistAt = Date.now();
    this.emitPendingCredits();
    this.store.write(ECONOMY_KEY, this.state);
  }

  /**
   * Append an idempotent op before the matching state mutation.
   *
   * The first op on a device freezes `origin` so a later merge can replay from
   * a common ancestor. Credits accumulate in memory and become one op per
   * flush so a second of idle does not write a second of log.
   */
  private recordOp(
    kind: EconomyOpKind,
    fields: Pick<EconomyOp, 'amount' | 'itemId' | 'slot' | 'extra'> = {},
  ): void {
    this.emitPendingCredits();
    this.appendOp(kind, fields);
  }

  private emitPendingCredits(): void {
    if (this.pendingGold <= 0 && this.pendingEssence <= 0) return;
    this.ensureOrigin();
    if (this.pendingGold > 0) {
      const n = this.pendingGold;
      this.pendingGold = 0;
      this.appendOp('credit-gold', { amount: n });
    }
    if (this.pendingEssence > 0) {
      const n = this.pendingEssence;
      this.pendingEssence = 0;
      this.appendOp('credit-essence', { amount: n });
    }
  }

  private appendOp(
    kind: EconomyOpKind,
    fields: Pick<EconomyOp, 'amount' | 'itemId' | 'slot' | 'extra'> = {},
  ): void {
    this.ensureOrigin();
    this.opSeq += 1;
    const wall = Date.now();
    this.state.hlc = nextHlc(this.state.hlc ?? 0, wall);
    const op: EconomyOp = {
      id: `${this.deviceId}:${this.opSeq}`,
      deviceId: this.deviceId,
      seq: this.opSeq,
      kind,
      hlc: this.state.hlc,
      wall,
      ...fields,
    };
    this.state.ops = [...(this.state.ops ?? []), op];
  }

  private ensureOrigin(): void {
    if (this.state.origin) return;
    const ledger = coerceLedger(this.state);
    if (!ledger) return;
    const snap = snapshotOf(ledger);
    snap.gold = Math.max(0, snap.gold - this.pendingGold);
    snap.eclipseEssence = Math.max(0, snap.eclipseEssence - this.pendingEssence);
    snap.totalGoldEarned = Math.max(0, snap.totalGoldEarned - this.pendingGold);
    snap.runGoldEarned = Math.max(0, snap.runGoldEarned - this.pendingGold);
    this.state.origin = snap;
  }

  private rotateDeviceId(): void {
    this.deviceId = this.newDeviceId();
    this.opSeq = 0;
    try { localStorage.setItem(DEVICE_KEY, this.deviceId); } catch { /* private mode */ }
  }

  private bindDevice(): void {
    this.deviceId = this.readDeviceId();
    this.opSeq = maxSeqFor(this.deviceId, this.state.ops ?? []);
  }

  private readDeviceId(): string {
    try {
      const held = localStorage.getItem(DEVICE_KEY);
      if (held) return held;
      const id = this.newDeviceId();
      localStorage.setItem(DEVICE_KEY, id);
      return id;
    } catch {
      return this.deviceId || this.newDeviceId();
    }
  }

  private newDeviceId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `d-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Write at most once every `PERSIST_INTERVAL_MS`, with a trailing write so
   * the last change in a quiet period is never the one left unsaved.
   *
   * The trailing timer is scheduled outside the zone: it is a storage write and
   * has no template work behind it, and letting zone.js own it would mean a
   * change-detection pass every five seconds on a tab that is only ticking.
   */
  private persistSoon(): void {
    if (!this.isBrowser || this.persistHandle !== null) return;

    const due = this.lastPersistAt + PERSIST_INTERVAL_MS - Date.now();
    if (due <= 0) {
      this.flush();
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.persistHandle = setTimeout(() => {
        this.persistHandle = null;
        this.flush();
      }, due);
    });
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.state, Date.now()));
  }

  private snapshotOf(state: PlayerEconomy, now: number): EconomySnapshot {
    const breakdown = goldBreakdown(state);
    return {
      gold: state.gold,
      essence: state.eclipseEssence,
      totalGoldEarned: state.totalGoldEarned,
      runGoldEarned: state.runGoldEarned,
      totalClicks: state.totalClicks,
      autoClicks: state.autoClicks,
      perSecond: breakdown.total,
      perMinute: breakdown.total * 60,
      breakdown,
      autoPerSecond: autoClicksPerSecond(state),
      perClick: goldPerClick(state),
      shards: state.eclipseShards,
      shardMult: shardMultiplier(state),
      prestigeCount: state.prestigeCount,
      pendingShards: pendingShards(state),
      prestigeReady: canPrestige(state, this.rankLevel),
      streakDays: state.streakDays,
      flameTier: flameTier(state),
      hammerVisual: hammerVisual(state),
      upgradeLevels: totalUpgradeLevels(state),
      artifacts: [...state.artifacts],
      cosmetics: [...state.cosmetics],
      runewords: [...state.runewords],
      equipped: { ...state.equipped },
      enchantment: activeEnchantment(state, now),
      doubled: globalMultiplier(state) > 1,
    };
  }
}

/** Re-exported so the Market can render catalogs without a second import line. */
export type { Artifact, Cosmetic, Enchantment };
export {
  ARTIFACTS,
  AUTO_CLICKERS,
  COSMETICS,
  ENCHANTMENTS,
  FORGE_UPGRADES,
  HAMMER_UPGRADES,
  MULTIPLIER_UPGRADES,
};
