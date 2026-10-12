/**
 * homestead.service.ts — the Homestead's controller.
 *
 * Reads the REAL services (EconomyService, ExplorerService, ThrallService) and
 * turns them into what the plot draws, what the buildings column lists and the
 * one action each building panel offers. It never credits and never prices:
 *
 *  - Striking the Forge goes through exactly the calls the Forge Flame makes
 *    (IdleService.strike for XP, EconomyService.strike for Gold, ComboService
 *    for the run), so there is one click economy, not two.
 *  - Buying goes through EconomyService.purchaseListing with an idempotent
 *    action id kept until the purchase settles (the Market's own pattern), at
 *    the economy's own `nextCost` quote.
 *  - "Since you were last here" is a receipt built from the services' own
 *    after-the-fact events (gain$, returned$, find$). The value is already in the
 *    ledger when the event fires; collecting only zeroes the receipt.
 *
 * Lives in the lazy /play chunk: only the side-scroller and the Homestead panel
 * import it.
 *
 * REBALANCE HOOKS: prices, rates and multipliers are all read live
 * (nextCost / levelOf / goldPerSecond / goldPerClick), so new numbers flow
 * through untouched. The rung lists (`FURNACE_RUNGS`, `AUTOMATON_RUNGS`,
 * `COLUMN_RUNGS`) are built from FORGE_UPGRADES / AUTO_CLICKERS /
 * MULTIPLIER_UPGRADES, so new rungs appear by themselves.
 *
 * GOLDEN SPARK (economy v3): the Homestead holds the shared GoldenSparkService
 * clock while it is open. A spark offered while you are here is caught by
 * striking the Forge within its 13 seconds; EconomyService credits it
 * (Windfall or Forge Frenzy) and only then `goldenSpark()` plays the burst.
 */
import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { EconomyService, EconomySnapshot } from '../../shared/economy/economy.service';
import {
  AUTO_CLICKERS, EXPEDITION_UPGRADES, FORGE_UPGRADES, MULTIPLIER_UPGRADES, THRALL_UPGRADES, goldPerSecond,
} from '../../shared/economy/economy.model';
import { CommerceCode, newPurchaseActionId } from '../../shared/economy/commerce-ops';
import { ComboService } from '../../shared/economy/combo.service';
import { GoldenSparkService } from '../../shared/economy/golden-spark.service';
import { pitchFor } from '../../shared/economy/combo.model';
import { ForgeAudioService } from '../../shared/economy/forge-audio.service';
import { IdleService } from '../../shared/idle/idle.service';
import { ExplorerService } from '../../shared/explorer/explorer.service';
import { EXPLORER_REALMS } from '../../shared/explorer/explorer.model';
import { ExplorerRosterService } from '../../shared/rpg/explorer-roster.service';
import { ThrallService, ThrallSnapshot } from '../../shared/thralls/thrall.service';
import { thrallTier } from '../../shared/thralls/thrall.model';
import { HomesteadScene, HomesteadModel, emptyModel } from '../engine/homestead-render';
import { HomesteadBuildingId } from '../world/homestead';
import {
  BuildingAction, ColumnRow, ColumnRungDef, Pending, RungDef, RungQuote, bestRung, buildingAction, columnRows,
  formatPerSecond, ladderLevels, nextUnheld, splitIdleGain,
} from './homestead.model';

export const FURNACE_RUNGS: readonly RungDef[] = FORGE_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: u.ratePerSecond }));
export const AUTOMATON_RUNGS: readonly RungDef[] = AUTO_CLICKERS.map(u => ({ id: u.id, name: u.name, gain: u.clicksPerSecond }));
export const TREASURY_RUNGS: readonly RungDef[] = MULTIPLIER_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: 1 }));
export const CAMP_RUNGS: readonly RungDef[] = EXPEDITION_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: u.explorers }));
export const WORKSHOP_RUNGS: readonly RungDef[] = THRALL_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: u.thralls }));
/** The Gold/sec makers the buildings column lists, Cookie-Clicker style. */
export const COLUMN_RUNGS: readonly ColumnRungDef[] = [
  ...FORGE_UPGRADES.map(u => ({ id: u.id, name: u.name, art: u.id, baseCost: u.baseCost, building: 'furnace' as const })),
  ...AUTO_CLICKERS.map(u => ({ id: u.id, name: u.name, art: u.id, baseCost: u.baseCost, building: 'automatons' as const })),
];

/** Which plot building a ladder id belongs to (a purchase anywhere grows it). */
export function buildingOfUpgrade(id: string): HomesteadBuildingId | null {
  const has = (rungs: readonly RungDef[]) => rungs.some(r => r.id === id);
  if (has(FURNACE_RUNGS)) return 'furnace';
  if (has(AUTOMATON_RUNGS)) return 'automatons';
  if (has(TREASURY_RUNGS)) return 'treasury';
  if (has(CAMP_RUNGS)) return 'camp';
  if (has(WORKSHOP_RUNGS)) return 'workshop';
  return null;
}

/** What the HUD column and the panel read. */
export interface HomesteadHud {
  gold: number;
  perSecond: number;
  perClick: number;
  rows: ColumnRow[];
}

/** Plain words for a purchase receipt. */
export function purchaseMessage(code: CommerceCode): string {
  switch (code) {
    case 'ok': case 'queued': return 'Built!';
    case 'insufficient-funds': return 'Not enough Gold yet.';
    case 'stale': return 'The price just changed. Try again.';
    case 'maxed': return 'That is fully built.';
    case 'in-flight': return 'Still building the last one…';
    default: return 'That did not go through. Try again.';
  }
}

@Injectable({ providedIn: 'root' })
export class HomesteadService implements OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly explorers = inject(ExplorerService);
  private readonly roster = inject(ExplorerRosterService);
  private readonly thrallService = inject(ThrallService);
  private readonly idle = inject(IdleService);
  private readonly combo = inject(ComboService);
  private readonly spark = inject(GoldenSparkService);
  private readonly audio = inject(ForgeAudioService);
  private readonly zone = inject(NgZone);

  /** The canvas view handed to the engine with `setHomesteadView`. */
  readonly scene = new HomesteadScene();
  private readonly hud$$ = new BehaviorSubject<HomesteadHud>({ gold: 0, perSecond: 0, perClick: 1, rows: [] });
  readonly hud$: Observable<HomesteadHud> = this.hud$$.asObservable();
  private readonly spark$$ = new Subject<void>();
  /** Fires on every golden spark (the rebalance's bonus moment). Presentation only. */
  readonly goldenSpark$: Observable<void> = this.spark$$.asObservable();

  private subs: Subscription | null = null;
  private users = 0;
  private thralls: ThrallSnapshot | null = null;
  private readonly actionKeys = new Map<string, string>();

  private readonly quote: RungQuote = {
    level: id => this.economy.levelOf(id),
    cost: id => this.economy.nextCost(id),
    maxed: id => this.economy.isMaxed(id),
  };

  constructor() {
    this.scene.onStrike = () => this.zone.run(() => this.strike());
    // Every other building opens its one-action panel through the engine.
    this.scene.onBuilding = () => false;
  }

  /** Begin reading the services. Ref-counted; the side-scroller calls it once per mount. */
  start(): void {
    if (!this.browser) return;
    if (this.users++ > 0) return;
    this.explorers.init();
    this.thrallService.init();
    const subs = new Subscription();
    subs.add(this.economy.snapshot$.subscribe(s => this.refresh(s)));
    subs.add(this.explorers.state$.subscribe(() => this.refresh()));
    subs.add(this.roster.snapshot$.subscribe(() => this.refresh()));
    subs.add(this.thrallService.snapshot$.subscribe(s => { this.thralls = s; this.refresh(); }));
    subs.add(this.economy.gain$.subscribe(g => {
      if (g.currency !== 'gold' || g.source !== 'idle' || !(g.amount > 0)) return;
      const split = splitIdleGain(g.amount, this.economy.snapshot.breakdown);
      if (split.furnace > 0) { this.scene.addPending('furnace', { gold: split.furnace }); this.scene.tick('furnace'); }
      if (split.automatons > 0) this.scene.addPending('automatons', { gold: split.automatons });
      if (split.treasury > 0) this.scene.addPending('treasury', { gold: split.treasury });
    }));
    subs.add(this.economy.autoStrike$.subscribe(() => this.scene.autoBeat()));
    subs.add(this.economy.purchase$.subscribe(p => {
      if (p.kind !== 'upgrade') return;
      const building = buildingOfUpgrade(p.id);
      if (!building) return;
      const line = p.rateDelta > 0 ? formatPerSecond(p.rateDelta)
        : building === 'camp' ? '+1 tent' : building === 'workshop' ? '+1 work spot' : 'Upgraded!';
      this.scene.grew(building, line);
    }));
    subs.add(this.explorers.returned$.subscribe(r => this.scene.addPending('camp', { gold: Math.max(0, r.reward.gold || 0), returns: 1 })));
    subs.add(this.thrallService.find$.subscribe(() => { this.scene.addPending('workshop', { runes: 1 }); this.scene.rune(); }));
    // The shared Golden Spark clock runs while the Homestead is open.
    subs.add(this.spark.attach());
    this.subs = subs;
  }

  stop(): void {
    if (this.users === 0 || --this.users > 0) return;
    this.subs?.unsubscribe(); this.subs = null;
  }

  ngOnDestroy(): void { this.subs?.unsubscribe(); }

  // ── Actions ──

  /** Strike the Forge: the Forge Flame's own path, then the juice. */
  strike(): void {
    if (!this.browser) return;
    this.idle.strike();
    const hit = this.economy.strike();
    if (!hit) return; // inside the economy's own cooldown
    const run = this.combo.strike();
    this.audio.strike(pitchFor(run.count));
    this.scene.strikeFx(hit.gold, hit.century || hit.millennium);
    // A spark on offer is caught by striking the Forge. Credited first, then shown.
    if (this.spark.offer && this.spark.catch()) this.goldenSpark();
  }

  /**
   * Buy one level of an existing ladder rung through the Market's receipted door.
   * The action id is kept while the purchase is in flight, so a double tap is one purchase.
   */
  buy(upgradeId: string): CommerceCode {
    if (!this.browser) return 'ineligible';
    let mutationKey = this.actionKeys.get(upgradeId);
    if (!mutationKey) { mutationKey = newPurchaseActionId(); this.actionKeys.set(upgradeId, mutationKey); }
    const receipt = this.economy.purchaseListing({ mutationKey, listingId: upgradeId, kind: 'upgrade', expectedCost: this.economy.nextCost(upgradeId) });
    if (receipt.code !== 'in-flight') this.actionKeys.delete(upgradeId);
    return receipt.code;
  }

  /**
   * Play a golden spark over the Forge. Grants nothing — the spark was already
   * credited through GoldenSparkService → EconomyService (see `strike()`).
   */
  goldenSpark(): void {
    this.scene.goldenSpark();
    this.spark$$.next();
  }

  // ── Reading ──

  /** The one action a building's panel offers. */
  action(id: HomesteadBuildingId): BuildingAction {
    const gold = this.economy.snapshot.gold;
    switch (id) {
      case 'furnace': {
        const built = ladderLevels(FURNACE_RUNGS, this.quote) > 0;
        return buildingAction(bestRung(FURNACE_RUNGS, this.quote), this.quote, gold, built ? 'Upgrade Furnace' : 'Build');
      }
      case 'automatons': {
        const built = ladderLevels(AUTOMATON_RUNGS, this.quote) > 0;
        return buildingAction(bestRung(AUTOMATON_RUNGS, this.quote), this.quote, gold, built ? 'Add Automaton' : 'Unlock');
      }
      case 'treasury': return buildingAction(nextUnheld(TREASURY_RUNGS, this.quote), this.quote, gold, 'Upgrade Treasury');
      case 'camp': return buildingAction(nextUnheld(CAMP_RUNGS, this.quote), this.quote, gold, 'Add a tent');
      case 'workshop': {
        const gate = (this.thralls?.owned ?? 0) > 0 ? '' : 'Recruit a Thrall at the Market first.';
        return buildingAction(nextUnheld(WORKSHOP_RUNGS, this.quote), this.quote, gold, 'Add a work spot', gate);
      }
      default: return { upgradeId: null, label: `Strike the Forge · +${Math.floor(this.economy.snapshot.perClick)} Gold`, cost: 0, affordable: true, locked: '' };
    }
  }

  /** The building's "since you were last here" receipt, uncollected. */
  pending(id: HomesteadBuildingId): Pending { return this.scene.pending(id); }

  /** The building's one plain sentence, with its real number. */
  sentence(id: HomesteadBuildingId): string {
    const s = this.economy.snapshot;
    switch (id) {
      case 'forge': return `Every strike makes ${Math.floor(s.perClick).toLocaleString('en-US')} Gold. Click it as fast as you like.`;
      case 'treasury': return `You hold ${Math.floor(s.gold).toLocaleString('en-US')} Gold. Treasury upgrades raise ALL Gold income.`;
      case 'furnace': return `Your buildings make ${formatPerSecond(s.breakdown.idle * this.mult(s)).slice(1)}, even while you are away.`;
      case 'automatons': return `${ladderLevels(AUTOMATON_RUNGS, this.quote)} automatons strike for you: ${formatPerSecond(s.breakdown.auto * this.mult(s)).slice(1)}.`;
      case 'camp': return `${this.explorers.snapshot.active.length} of ${this.explorers.slots} explorers are out. Send them from the Sanctum.`;
      case 'workshop': {
        const t = this.thralls;
        return t && t.owned ? `${t.working} of ${t.owned} Thralls are pulling runes (room for ${t.slots}).` : 'No Thralls yet. Recruit one at the Market and it works here.';
      }
    }
  }

  /** The shared multipliers a breakdown line is scaled by. */
  private mult(s: EconomySnapshot): number {
    const b = s.breakdown;
    return b.upgrades * b.streak * b.shards * b.artifact * b.runeword * b.infusion;
  }

  /** Gold/sec one more level of `id` adds, measured on the real ledger. */
  private gainOf(id: string): number {
    const e = this.economy.economy;
    const before = goldPerSecond(e);
    const after = goldPerSecond({ ...e, upgrades: { ...e.upgrades, [id]: (e.upgrades[id] ?? 0) + 1 } });
    return after - before;
  }

  private refresh(snapshot: EconomySnapshot = this.economy.snapshot): void {
    if (!this.browser) return;
    const realmColor = (id: string) => EXPLORER_REALMS.find(r => r.id === id)?.color ?? '#ffd36d';
    const furnace = FURNACE_RUNGS.map(r => this.quote.level(r.id));
    const automatons = AUTOMATON_RUNGS.map(r => this.quote.level(r.id));
    const signs: HomesteadModel['signs'] = {};
    if (!furnace.some(Boolean)) signs.furnace = this.signFor(this.action('furnace'));
    if (!automatons.some(Boolean)) signs.automatons = this.signFor(this.action('automatons'));
    if (!(this.thralls?.owned)) signs.workshop = 'Recruit a Thrall at the Market';
    const model: HomesteadModel = {
      ...emptyModel(),
      gold: snapshot.gold,
      perSecond: snapshot.perSecond,
      perClick: snapshot.perClick,
      furnace, automatons,
      multipliers: TREASURY_RUNGS.filter(r => this.quote.level(r.id) > 0).length,
      explorers: {
        slots: this.explorers.slots,
        idle: this.explorers.available.length,
        out: this.explorers.snapshot.active.map(e => ({ startedAt: e.startedAt, duration: e.duration, color: realmColor(e.realm) })),
      },
      thralls: (this.thralls?.thralls ?? []).map(t => ({
        working: t.status === 'working', lastRollAt: t.lastRollAt, rollInterval: t.rollInterval, color: thrallTier(t.rarity).color,
      })),
      signs,
    };
    this.scene.setModel(model);
    this.hud$$.next({
      gold: snapshot.gold, perSecond: snapshot.perSecond, perClick: snapshot.perClick,
      rows: columnRows(COLUMN_RUNGS, this.quote, snapshot.gold, snapshot.totalGoldEarned, id => this.gainOf(id)),
    });
  }

  /** "Unlock: Apprentice Striker · 500,000 Gold" for an unbuilt plot's sign. */
  private signFor(action: BuildingAction): string { return action.label; }
}
