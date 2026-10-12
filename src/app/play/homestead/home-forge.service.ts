/**
 * home-forge.service.ts: owns `godforge-home-forge`, the tiers of the player's
 * own Anvil and Enchanting Circle in the Homestead (rules and prices in the
 * shared home-forge model).
 *
 * Upgrading is a Gold spend with an idempotent action id,
 * `home-forge:<station>:<tier>`. The tier IS the replay record: a retry, a
 * double tap or a second device asking for a tier the save already holds is
 * answered "replayed" and never charged again. The order follows the crafting
 * gateway's: refuse on what is knowable (maxed, a skipped tier, not enough
 * Gold), then write the new tier, then `EconomyService.spendGold` in the same
 * synchronous tick, so nothing can spend the Gold in between. A crash between
 * the two leaves a free upgrade, never a charged player with nothing.
 *
 * Saved through the game-state gateway (synced as progress/home-forge, merged
 * by the structural "higher wins" rule: a tier never goes down) and registered
 * with LocalSaveRegistry, so a cloud merge lands in memory.
 *
 * Lives in the lazy /play chunk (the side-scroller and the buildings column).
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, defer } from 'rxjs';
import { EconomyService } from '../../shared/economy/economy.service';
import { GameStateGateway } from '../../shared/save/game-state.gateway';
import { LocalSaveRegistry } from '../../shared/save/local-save-registry.service';
import { TranslationService } from '../../translation.service';
import type { HomeForgeContext } from '../../shared/in-world-panel';
import { HOME_FORGE_I18N } from '../../shared/minigames/home-forge.i18n';
import {
  HOME_FORGE_KEY, HOME_TIER_MAX, HomeForgeState, HomeStationId, HomeUpgradeQuote, applyHomeUpgrade, clampTier, coerceHomeForge,
  emptyHomeForge, homeUpgradeActionId, homeUpgradeCost, quoteHomeUpgrade,
} from '../../shared/minigames/home-forge.model';

export type HomeUpgradeCode = 'ok' | 'replayed' | 'maxed' | 'skipped' | 'insufficient-funds' | 'ssr' | 'failed';

export interface HomeUpgradeResult {
  code: HomeUpgradeCode;
  station: HomeStationId;
  /** The station's tier after the call. */
  tier: number;
  /** Gold actually taken (0 on a replay or a refusal). */
  spent: number;
}

@Injectable({ providedIn: 'root' })
export class HomeForgeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly i18n = inject(TranslationService);
  private state: HomeForgeState = emptyHomeForge();
  private hydrated = false;
  private readonly state$$ = new BehaviorSubject<HomeForgeState>(emptyHomeForge());

  /** The tiers now, and on every change (an upgrade or a cloud merge). */
  readonly state$: Observable<HomeForgeState> = defer(() => { this.hydrate(); return this.state$$.asObservable(); });

  /** What a bench opened from the Homestead reads (HOME_FORGE). Live, not a snapshot. */
  readonly context: HomeForgeContext = {
    anvilTier: () => this.tier('anvil'),
    circleTier: () => this.tier('circle'),
  };

  constructor() {
    this.i18n.register(HOME_FORGE_I18N);
  }

  tier(station: HomeStationId): number {
    this.hydrate();
    return clampTier(this.state[station]);
  }

  quote(station: HomeStationId): HomeUpgradeQuote {
    this.hydrate();
    return quoteHomeUpgrade(this.state, station, this.economy.snapshot.gold);
  }

  /** The station's display name, translated. */
  name(station: HomeStationId): string {
    return this.i18n.translate(`homeForge.${station}.name`);
  }

  /** The panel kicker over a home station ("Homestead"), translated. */
  kicker(): string {
    return this.i18n.translate('homeForge.kicker');
  }

  /**
   * Buy `station` up to `tier` (the next one). Pass the tier the button showed:
   * that is what makes a retry of the same press a replay rather than a second
   * purchase of the tier after it.
   */
  upgrade(station: HomeStationId, tier: number): HomeUpgradeResult {
    const result = (code: HomeUpgradeCode, spent = 0): HomeUpgradeResult => ({ code, station, tier: clampTier(this.state[station]), spent });
    if (!this.isBrowser) return result('ssr');
    this.hydrate();
    const current = clampTier(this.state[station]);
    if (Number.isFinite(tier) && current >= tier) return result('replayed');
    const next = applyHomeUpgrade(this.state, station, tier);
    if (!next) return result(current >= HOME_TIER_MAX ? 'maxed' : 'skipped');
    const cost = homeUpgradeCost(station, tier);
    if (this.economy.snapshot.gold < cost) return result('insufficient-funds');

    const before = this.state;
    this.commit(next);
    const paid = cost <= 0 || this.economy.spendGold(cost, homeUpgradeActionId(station, tier));
    if (!paid) {
      // Unreachable in practice (affordability was checked this tick); undo rather than give it away.
      this.commit(before);
      return result('failed');
    }
    return result('ok', cost);
  }

  private commit(next: HomeForgeState): void {
    this.state = next;
    this.store.write(HOME_FORGE_KEY, this.state);
    this.state$$.next({ ...this.state });
  }

  /** Read once, on first use; registering means "holding a copy". */
  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.state = coerceHomeForge(this.store.read(HOME_FORGE_KEY));
    this.state$$.next({ ...this.state });
    // Every change is written at once, so there is nothing to flush; a merged copy is re-read in the same tick.
    this.saves.register(HOME_FORGE_KEY, {
      rehydrate: () => { this.state = coerceHomeForge(this.store.read(HOME_FORGE_KEY)); this.state$$.next({ ...this.state }); },
    });
  }
}
