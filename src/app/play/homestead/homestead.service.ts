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
  isRetiredIncomeUpgrade,
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
import { HomesteadScene, HomesteadModel, compact, emptyModel } from '../engine/homestead-render';
import { TranslationService } from '../../translation.service';
import { HOME_STATION_IDS, HomeStationId, tierNumeral } from '../../shared/minigames/home-forge.model';
import { HomeForgeService, HomeUpgradeResult } from './home-forge.service';
import { HomesteadBuildingId } from '../world/homestead';
import {
  BuildingAction, ColumnRow, ColumnRungDef, Pending, RungDef, RungQuote, bestRung, buildingAction, columnRows,
  formatPerSecond, homesteadT, ladderLevels, nextUnheld, setHomesteadTranslator, splitIdleGain,
} from './homestead.model';
import { HOMESTEAD_I18N } from './homestead.i18n';

/** How often a waiting golden spark re-flares over the Forge, ms. */
const SPARK_PULSE_MS = 2_500;

export const FURNACE_RUNGS: readonly RungDef[] = FORGE_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: u.ratePerSecond }));
export const AUTOMATON_RUNGS: readonly RungDef[] = AUTO_CLICKERS.map(u => ({ id: u.id, name: u.name, gain: u.clicksPerSecond }));
export const TREASURY_RUNGS: readonly RungDef[] = MULTIPLIER_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: 1 }));
export const CAMP_RUNGS: readonly RungDef[] = EXPEDITION_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: u.explorers }));
export const WORKSHOP_RUNGS: readonly RungDef[] = THRALL_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: u.thralls }));
/**
 * The Gold/sec makers the buildings column lists, Cookie-Clicker style. Empty while the forge pays nothing by the
 * second (isRetiredIncomeUpgrade): a furnace or an automaton bought now would make nothing, so neither is offered.
 */
export const COLUMN_RUNGS: readonly ColumnRungDef[] = [
  ...FORGE_UPGRADES.map(u => ({ id: u.id, name: u.name, art: u.id, baseCost: u.baseCost, building: 'furnace' as const })),
  ...AUTO_CLICKERS.map(u => ({ id: u.id, name: u.name, art: u.id, baseCost: u.baseCost, building: 'automatons' as const })),
].filter(r => !isRetiredIncomeUpgrade(r.id));
/** True while the furnace and the automatons are retired (Gold comes from the hunt). */
const INCOME_RETIRED = FORGE_UPGRADES.some(u => isRetiredIncomeUpgrade(u.id));

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

/** One home crafting station in the column: its tier and the ONE upgrade button. */
export interface HomeForgeRow {
  station: HomeStationId;
  name: string;
  /** "Tier II". */
  tierLabel: string;
  /** What the next tier gives, or what the top tier has. */
  line: string;
  /** "Upgrade Anvil III · 6M Gold", or "Fully upgraded". */
  button: string;
  /** The tier the button buys; null when fully upgraded. */
  next: number | null;
  affordable: boolean;
  /** "Need 1,234 more", or ''. */
  need: string;
  art: string;
}

/** What the HUD column and the panel read. */
export interface HomesteadHud {
  gold: number;
  perSecond: number;
  perClick: number;
  rows: ColumnRow[];
  /** Your Anvil and Your Enchanting Circle. */
  forge: HomeForgeRow[];
}

/** Plain words for a purchase receipt. */
export function purchaseMessage(code: CommerceCode): string {
  switch (code) {
    case 'ok': case 'queued': return homesteadT('homestead.buy.ok');
    case 'insufficient-funds': return homesteadT('homestead.buy.funds');
    case 'stale': return homesteadT('homestead.buy.stale');
    case 'maxed': return homesteadT('homestead.buy.maxed');
    case 'in-flight': return homesteadT('homestead.buy.inFlight');
    default: return homesteadT('homestead.buy.failed');
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
  private readonly homeForge = inject(HomeForgeService);
  private readonly i18n = inject(TranslationService);

  /** The canvas view handed to the engine with `setHomesteadView`. */
  readonly scene = new HomesteadScene();
  private readonly hud$$ = new BehaviorSubject<HomesteadHud>({ gold: 0, perSecond: 0, perClick: 1, rows: [], forge: [] });
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
    this.i18n.register(HOMESTEAD_I18N);
    setHomesteadTranslator((key, vars) => this.i18n.translate(key, vars));
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
        : building === 'camp' ? this.t('homestead.grew.tent') : building === 'workshop' ? this.t('homestead.grew.spot') : this.t('homestead.grew.upgraded');
      this.scene.grew(building, line);
    }));
    subs.add(this.explorers.returned$.subscribe(r => this.scene.addPending('camp', { gold: Math.max(0, r.reward.gold || 0), returns: 1 })));
    subs.add(this.thrallService.find$.subscribe(() => { this.scene.addPending('workshop', { runes: 1 }); this.scene.rune(); }));
    // The shared Golden Spark clock runs while the Homestead is open. While a
    // spark is waiting, the Forge flares with it every couple of seconds (the
    // `goldenSpark` burst), so it is visible on the plot; striking catches it.
    subs.add(this.spark.attach());
    subs.add(this.spark.offer$.subscribe(offer => this.showWaitingSpark(offer !== null)));
    subs.add(() => this.showWaitingSpark(false));
    subs.add(this.homeForge.state$.subscribe(() => this.refresh()));
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
   * Upgrade the player's own Anvil or Enchanting Circle to `tier` (the one the
   * button showed). Gold goes through EconomyService.spendGold under the action
   * id `home-forge:<station>:<tier>`; a repeat of the same press is a replay.
   * On success the station flashes on the plot with its new tier.
   */
  upgradeHome(station: HomeStationId, tier: number): HomeUpgradeResult {
    const result = this.homeForge.upgrade(station, tier);
    if (result.code === 'ok') {
      this.scene.homeGrew(station, this.i18n.translate('homeForge.tier', { tier: tierNumeral(result.tier) }));
      this.audio.strike(pitchFor(1));
    }
    return result;
  }

  /**
   * Play a golden spark over the Forge. Grants nothing: it marks a spark that
   * is waiting to be struck (see `showWaitingSpark`) and the one just caught,
   * which GoldenSparkService has already credited through EconomyService.
   */
  goldenSpark(): void {
    this.scene.goldenSpark();
    this.spark$$.next();
  }

  // ── Reading ──

  private sparkPulse: ReturnType<typeof setInterval> | null = null;

  /** Flare the Forge now and every SPARK_PULSE_MS while a spark waits; stop when it goes. */
  private showWaitingSpark(waiting: boolean): void {
    if (this.sparkPulse !== null) { clearInterval(this.sparkPulse); this.sparkPulse = null; }
    if (!waiting || !this.browser) return;
    this.scene.goldenSpark();
    this.zone.runOutsideAngular(() => {
      this.sparkPulse = setInterval(() => this.scene.goldenSpark(), SPARK_PULSE_MS);
    });
  }

  /** Words, in the Keeper's language. */
  private t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  /** The one action a building's panel offers. */
  action(id: HomesteadBuildingId): BuildingAction {
    const gold = this.economy.snapshot.gold;
    switch (id) {
      case 'furnace': {
        if (INCOME_RETIRED) return buildingAction(null, this.quote, gold, this.t('homestead.verb.upgradeFurnace'), this.t('homestead.retired.why'));
        const built = ladderLevels(FURNACE_RUNGS, this.quote) > 0;
        return buildingAction(bestRung(FURNACE_RUNGS, this.quote), this.quote, gold, this.t(built ? 'homestead.verb.upgradeFurnace' : 'homestead.verb.build'));
      }
      case 'automatons': {
        if (INCOME_RETIRED) return buildingAction(null, this.quote, gold, this.t('homestead.verb.addAutomaton'), this.t('homestead.retired.why'));
        const built = ladderLevels(AUTOMATON_RUNGS, this.quote) > 0;
        return buildingAction(bestRung(AUTOMATON_RUNGS, this.quote), this.quote, gold, this.t(built ? 'homestead.verb.addAutomaton' : 'homestead.verb.unlock'));
      }
      case 'treasury': return buildingAction(nextUnheld(TREASURY_RUNGS, this.quote), this.quote, gold, this.t('homestead.verb.upgradeTreasury'));
      case 'camp': return buildingAction(nextUnheld(CAMP_RUNGS, this.quote), this.quote, gold, this.t('homestead.verb.addTent'));
      case 'workshop': {
        const gate = (this.thralls?.owned ?? 0) > 0 ? '' : this.t('homestead.gate.thrall');
        return buildingAction(nextUnheld(WORKSHOP_RUNGS, this.quote), this.quote, gold, this.t('homestead.verb.addSpot'), gate);
      }
      default: return { upgradeId: null, label: this.t('homestead.column.strike', { n: Math.floor(this.economy.snapshot.perClick) }), cost: 0, affordable: true, locked: '' };
    }
  }

  /** The latest HUD reading (the Mirror Slate reads it once per change). */
  snapshotHud(): HomesteadHud { return this.hud$$.value; }

  /** Every building's receipt, summed (the Mirror Slate reads it for its badge and its Homestead tab). */
  pendingAll(): Pending { return this.scene.pendingAll(); }

  /** The Slate's Collect: every receipt handed over at once. Credits nothing (the services already did). */
  collectAll(): Pending { return this.scene.collectAll(); }

  /** The building's "since you were last here" receipt, uncollected. */
  pending(id: HomesteadBuildingId): Pending { return this.scene.pending(id); }

  /** The building's one plain sentence, with its real number. */
  sentence(id: HomesteadBuildingId): string {
    const s = this.economy.snapshot;
    const n = (v: number) => Math.floor(v).toLocaleString('en-US');
    switch (id) {
      case 'forge': return this.t('homestead.sentence.forge', { n: n(s.perClick) });
      case 'treasury': return this.t('homestead.sentence.treasury', { n: n(s.gold) });
      case 'furnace': if (INCOME_RETIRED) return this.t('homestead.retired.furnace');
        return this.t('homestead.sentence.furnace', { rate: formatPerSecond(s.breakdown.idle * this.mult(s)).slice(1) });
      case 'automatons': if (INCOME_RETIRED) return this.t('homestead.retired.automatons');
        return this.t('homestead.sentence.automatons', { n: ladderLevels(AUTOMATON_RUNGS, this.quote), rate: formatPerSecond(s.breakdown.auto * this.mult(s)).slice(1) });
      case 'camp': return this.t('homestead.sentence.camp', { out: this.explorers.snapshot.active.length, slots: this.explorers.slots });
      case 'workshop': {
        const t = this.thralls;
        return t && t.owned ? this.t('homestead.sentence.workshop', { working: t.working, owned: t.owned, slots: t.slots }) : this.t('homestead.sentence.noThralls');
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
    if (!INCOME_RETIRED && !furnace.some(Boolean)) signs.furnace = this.signFor(this.action('furnace'));
    if (!INCOME_RETIRED && !automatons.some(Boolean)) signs.automatons = this.signFor(this.action('automatons'));
    if (!(this.thralls?.owned)) signs.workshop = this.t('homestead.sign.thrall');
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
      homeForge: { anvil: this.homeForge.tier('anvil'), circle: this.homeForge.tier('circle') },
    };
    this.scene.setModel(model);
    this.hud$$.next({
      gold: snapshot.gold, perSecond: snapshot.perSecond, perClick: snapshot.perClick,
      rows: columnRows(COLUMN_RUNGS, this.quote, snapshot.gold, snapshot.totalGoldEarned, id => this.gainOf(id)),
      forge: HOME_STATION_IDS.map(id => this.forgeRow(id)),
    });
  }

  /** The column row for one home crafting station, from its live quote. */
  private forgeRow(station: HomeStationId): HomeForgeRow {
    const t = (key: string, vars?: Record<string, string | number>) => this.i18n.translate(key, vars);
    const tier = this.homeForge.tier(station);
    const q = this.homeForge.quote(station);
    const next = q.tier;
    return {
      station,
      name: this.homeForge.name(station),
      tierLabel: t('homeForge.tier', { tier: tierNumeral(tier) }),
      line: next === null ? t(`homeForge.${station}.top`) : t(`homeForge.${station}.next${next}`),
      button: next === null ? t('homeForge.upgrade.maxed') : t(`homeForge.upgrade.${station}`, { tier: tierNumeral(next), cost: compact(q.cost) }),
      next,
      affordable: next !== null && q.affordable,
      need: next !== null && !q.affordable ? t('homeForge.upgrade.need', { n: Math.ceil(q.shortfall).toLocaleString('en-US') }) : '',
      art: station === 'anvil' ? 'iron-hammer' : 'enhancement-aura',
    };
  }

  /** "Unlock: Apprentice Striker · 500,000 Gold" for an unbuilt plot's sign. */
  private signFor(action: BuildingAction): string { return action.label; }
}
