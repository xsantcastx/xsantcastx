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
import {
  ARTIFACTS,
  Artifact,
  COSMETICS,
  Cosmetic,
  ENCHANTMENTS,
  Enchantment,
  FORGE_UPGRADES,
  HAMMER_UPGRADES,
  HammerEffect,
  PlayerEconomy,
  activeEnchantment,
  costOf,
  earnsWhileHidden,
  emptyEconomy,
  flameTier,
  globalMultiplier,
  goldPerClick,
  goldPerMinute,
  hammerVisual,
  totalUpgradeLevels,
} from './economy.model';

export const ECONOMY_KEY = 'godforge-economy';

/** One minute. The idle prompt, and the unit idle is priced in. */
const MINUTE_MS = 60_000;

/**
 * The most offline time one settlement will pay for, in minutes.
 *
 * Eight hours. Long enough that a tab left open overnight pays out properly,
 * short enough that a machine restored from a two-week-old suspend does not
 * hand over a fortnight of Gold in a single frame — and short enough that
 * moving the system clock forward is not a strategy.
 */
const MAX_OFFLINE_MINUTES = 8 * 60;

/** Minimum ms between two paying strikes of the Forge Flame. */
export const CLICK_COOLDOWN_MS = 500;

/** What the Flame, the currency rail and the Market all render. */
export interface EconomySnapshot {
  gold: number;
  essence: number;
  totalGoldEarned: number;
  totalClicks: number;
  /** Gold per minute, everything applied. */
  perMinute: number;
  /** Gold per strike, everything applied. */
  perClick: number;
  /** 0-5. How elaborate the Flame is drawn. */
  flameTier: number;
  /** Loudest owned hammer visual. */
  hammerVisual: HammerEffect;
  upgradeLevels: number;
  artifacts: string[];
  cosmetics: string[];
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
  kind: 'upgrade' | 'enchantment' | 'artifact' | 'cosmetic';
  id: string;
  name: string;
  cost: number;
  currency: 'gold' | 'essence';
}

@Injectable({ providedIn: 'root' })
export class EconomyService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);

  private state: PlayerEconomy = emptyEconomy();
  private initialised = false;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  /** Epoch ms of the last strike that paid, for the 500ms cooldown. */
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

  /** Current holdings, replayed to late subscribers. */
  readonly snapshot$: Observable<EconomySnapshot> = this.snapshot$$.asObservable();
  /** One per mint. Not replayed — a missed gain is a missed animation. */
  readonly gain$: Observable<CurrencyGain> = this.gain$$.asObservable();
  readonly purchase$: Observable<PurchaseEvent> = this.purchase$$.asObservable();
  /** Century Strike and Millennium Forge. `bonus` is the Gold that came with it. */
  readonly milestone$: Observable<{ clicks: number; bonus: number }> = this.milestone$$.asObservable();

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

    // The idle prompt does no template work — it calls settleIdle(), which
    // re-enters the zone through its own subscribers only when Gold actually
    // moves. A minute timer that triggers change detection sixty times an hour
    // for a tab nobody is looking at is exactly the kind of thing the mobile
    // pass in 2.1.0 was cleaning up.
    this.zone.runOutsideAngular(() => {
      this.idleTimer = setInterval(() => this.settleIdle(), MINUTE_MS);

      // Settling on the visibility edge is what makes hidden time discardable
      // without a second clock: going hidden pays out everything owed up to
      // that instant, and coming back settles the gap under the hidden rules.
      this.visibilityHandler = () => this.settleIdle();
      document.addEventListener('visibilitychange', this.visibilityHandler, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (this.idleTimer !== null) clearInterval(this.idleTimer);
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
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
    this.state.gold += credited;
    this.state.totalGoldEarned += credited;

    this.persist();
    this.publish();
    this.gain$$.next({ currency: 'gold', amount: credited, source });
    return credited;
  }

  /**
   * The single Essence mint. Not multiplied by the Fragment: Essence is the
   * currency the Fragment is *bought* with, and a permanent 2× on the only
   * income that can buy more permanents is a loop that eats its own economy.
   */
  earnEssence(amount: number, source = 'realm'): number {
    if (!this.isBrowser || amount <= 0) return 0;

    this.state.eclipseEssence += amount;
    this.persist();
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
    // applied the multiplier to the per-strike figure, and running it through
    // the mint would apply it a second time.
    this.state.gold += gold;
    this.state.totalGoldEarned += gold;

    this.recentClicks.push(now);
    const cutoff = now - MINUTE_MS;
    this.recentClicks = this.recentClicks.filter(t => t >= cutoff);

    this.persist();
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
   * Pay for the wall-clock minutes since the last settlement.
   *
   * Whole minutes only, and the remainder stays on the clock — settling twice
   * inside one minute must not round a partial minute up twice, which is what a
   * visibility flicker would do.
   */
  private settleIdle(): void {
    if (!this.isBrowser) return;

    const now = Date.now();
    const elapsed = now - this.state.lastIdleAt;

    // A clock that moved backwards (NTP correction, manual change) would
    // otherwise sit at a negative elapsed forever. Re-anchor and pay nothing.
    if (elapsed < 0) {
      this.state.lastIdleAt = now;
      this.persist();
      return;
    }

    const wholeMinutes = Math.floor(elapsed / MINUTE_MS);
    if (wholeMinutes < 1) return;

    const minutes = Math.min(wholeMinutes, MAX_OFFLINE_MINUTES);
    // Advance by exactly what was paid for, leaving the sub-minute remainder.
    this.state.lastIdleAt += wholeMinutes * MINUTE_MS;

    const hidden = document.visibilityState !== 'visible';
    if (hidden && !earnsWhileHidden(this.state)) {
      // The clock has moved; nothing is owed. Persist so a reload does not
      // re-examine the same span and pay it under visible rules.
      this.persist();
      return;
    }

    const gold = Math.round(goldPerMinute(this.state) * minutes);
    if (gold <= 0) {
      this.persist();
      return;
    }

    this.state.gold += gold;
    this.state.totalGoldEarned += gold;
    this.persist();

    // Back into the zone: the currency rail and the Flame are both bound to the
    // snapshot, and a mint outside the zone would not repaint until something
    // else happened to trigger a pass.
    this.zone.run(() => {
      this.publish();
      this.gain$$.next({ currency: 'gold', amount: gold, source: 'idle' });
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Spending
  // ───────────────────────────────────────────────────────────────────────────

  /** Levels owned of one upgrade. */
  levelOf(id: string): number {
    return this.state.upgrades[id] ?? 0;
  }

  /** What the next level of an upgrade costs right now. */
  nextCost(id: string): number {
    const def = FORGE_UPGRADES.find(u => u.id === id) ?? HAMMER_UPGRADES.find(u => u.id === id);
    return def ? costOf(def.baseCost, this.levelOf(id)) : Infinity;
  }

  /** Buy one level of a forge or hammer upgrade. False when it is unaffordable. */
  buyUpgrade(id: string): boolean {
    if (!this.isBrowser) return false;
    const def = FORGE_UPGRADES.find(u => u.id === id) ?? HAMMER_UPGRADES.find(u => u.id === id);
    if (!def) return false;

    const cost = costOf(def.baseCost, this.levelOf(id));
    if (this.state.gold < cost) return false;

    this.state.gold -= cost;
    this.state.upgrades = { ...this.state.upgrades, [id]: this.levelOf(id) + 1 };

    this.persist();
    this.publish();
    this.purchase$$.next({ kind: 'upgrade', id, name: def.name, cost, currency: 'gold' });
    return true;
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
    this.state.eclipseEssence -= def.cost;
    this.state.enchantments = [
      ...this.state.enchantments.filter(a => a.id !== id && a.expiresAt > now),
      { id, expiresAt: now + def.hours * 3_600_000 },
    ];

    this.persist();
    this.publish();
    this.purchase$$.next({ kind: 'enchantment', id, name: def.name, cost: def.cost, currency: 'essence' });
    return true;
  }

  /** Buy an artifact. Once only — a second attempt returns false. */
  buyArtifact(id: string): boolean {
    if (!this.isBrowser) return false;
    const def = ARTIFACTS.find(a => a.id === id);
    if (!def || this.ownsArtifact(id) || this.state.eclipseEssence < def.cost) return false;

    this.state.eclipseEssence -= def.cost;
    this.state.artifacts = [...this.state.artifacts, id];

    this.persist();
    this.publish();
    this.purchase$$.next({ kind: 'artifact', id, name: def.name, cost: def.cost, currency: 'essence' });
    return true;
  }

  /**
   * Buy a cosmetic slot, equipping its first variant. Switching variants after
   * that is free — see the note on `Cosmetic`.
   */
  buyCosmetic(id: string): boolean {
    if (!this.isBrowser) return false;
    const def = COSMETICS.find(c => c.id === id);
    if (!def || this.ownsCosmetic(id) || this.state.gold < def.cost) return false;

    this.state.gold -= def.cost;
    this.state.cosmetics = [...this.state.cosmetics, id];
    this.state.equipped = { ...this.state.equipped, [def.slot]: def.variants[0].id };

    this.persist();
    this.publish();
    this.purchase$$.next({ kind: 'cosmetic', id, name: def.name, cost: def.cost, currency: 'gold' });
    return true;
  }

  /** Switch (or clear, with null) the variant in an owned cosmetic's slot. */
  equip(cosmeticId: string, variantId: string | null): boolean {
    if (!this.isBrowser) return false;
    const def = COSMETICS.find(c => c.id === cosmeticId);
    if (!def || !this.ownsCosmetic(cosmeticId)) return false;
    if (variantId && !def.variants.some(v => v.id === variantId)) return false;

    const equipped = { ...this.state.equipped };
    if (variantId) equipped[def.slot] = variantId;
    else delete equipped[def.slot];
    this.state.equipped = equipped;

    this.persist();
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
   */
  markLevelsPaid(level: number): void {
    if (!this.isBrowser || level <= this.state.levelsPaid) return;
    this.state.levelsPaid = level;
    this.persist();
  }

  markStreakWeeksPaid(weeks: number): void {
    if (!this.isBrowser || weeks <= this.state.streakWeeksPaid) return;
    this.state.streakWeeksPaid = weeks;
    this.persist();
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

  /** Wipe the ledger. Exposed for the console alongside the other resets. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyEconomy();
    this.state.lastIdleAt = Date.now();
    this.recentClicks = [];
    try { localStorage.removeItem(ECONOMY_KEY); } catch { /* private mode */ }
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): PlayerEconomy {
    try {
      const raw = localStorage.getItem(ECONOMY_KEY);
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
        equipped: parsed.equipped ?? {},
        // Expired enchantments are dropped on read rather than left to
        // accumulate — a visitor who has run fifty of them over a month should
        // not be carrying fifty dead timers in localStorage.
        enchantments: (parsed.enchantments ?? []).filter(e => e && e.expiresAt > now),
        version: 1,
      };
    } catch {
      return emptyEconomy();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(ECONOMY_KEY, JSON.stringify(this.state));
    } catch {
      /* quota or private mode — a forge is not worth breaking a page over */
    }
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.state, Date.now()));
  }

  private snapshotOf(state: PlayerEconomy, now: number): EconomySnapshot {
    return {
      gold: state.gold,
      essence: state.eclipseEssence,
      totalGoldEarned: state.totalGoldEarned,
      totalClicks: state.totalClicks,
      perMinute: goldPerMinute(state),
      perClick: goldPerClick(state),
      flameTier: flameTier(state),
      hammerVisual: hammerVisual(state),
      upgradeLevels: totalUpgradeLevels(state),
      artifacts: [...state.artifacts],
      cosmetics: [...state.cosmetics],
      equipped: { ...state.equipped },
      enchantment: activeEnchantment(state, now),
      doubled: globalMultiplier(state) > 1,
    };
  }
}

/** Re-exported so the Market can render catalogs without a second import line. */
export type { Artifact, Cosmetic, Enchantment };
export { ARTIFACTS, COSMETICS, ENCHANTMENTS, FORGE_UPGRADES, HAMMER_UPGRADES };
