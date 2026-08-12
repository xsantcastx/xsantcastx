/**
 * market.component.ts — the Godforge Market, at /market.
 *
 * Five tabs over one ledger: two Gold ladders that repeat and get more
 * expensive, one Essence timer, one Essence shelf that sells each thing exactly
 * once, and a Gold shelf that sells appearances.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE WHOLE PAGE IS PRERENDERED IN ITS UNAFFORDABLE STATE
 * ─────────────────────────────────────────────────────────────────────────────
 * The catalogs are pure data, so the server renders every card — name, price,
 * effect, lore quote — with the ledger at zero and every BUY button disabled.
 * That is a truthful page for a crawler to index (this is what the shop sells,
 * and you own none of it) and it means hydration only has to flip affordability
 * rather than build a page. The alternative — an empty shell that fills in on
 * the client — would put a shop with no products in the index.
 *
 * Lazy-loaded, so a visitor who never opens it downloads none of it.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { EconomyService, EconomySnapshot } from './economy.service';
import {
  ARTIFACTS,
  AUTO_CLICKERS,
  AnyUpgrade,
  Artifact,
  COSMETICS,
  Cosmetic,
  CosmeticVariant,
  ENCHANTMENTS,
  Enchantment,
  FORGE_UPGRADES,
  MULTIPLIER_UPGRADES,
  HAMMER_UPGRADES,
  PRESTIGE_GOLD_THRESHOLD,
  PRESTIGE_LEVEL_THRESHOLD,
  SHARD_BONUS,
  costOf,
  formatCompact,
  formatCurrency,
  formatMultiplier,
  formatRate,
} from './economy.model';
import { ForgeAudioService } from './forge-audio.service';
import { rarityOf } from '../rarity/rarity.model';

type TabId =
  | 'forge' | 'hammer' | 'automaton' | 'mastery'
  | 'enchant' | 'artifact' | 'cosmetic' | 'eclipse';

interface Tab {
  id: TabId;
  label: string;
  /** Path to the shop sigil under assets/icons/shops, when one was painted. */
  icon?: string;
  /** Stands in where no sigil exists. See the note on TABS. */
  glyph?: string;
  /** Which currency this tab spends. Tints the whole panel. */
  currency: 'gold' | 'essence' | 'shard';
}

/** One line of the income breakdown, ready to render. */
interface BreakdownRow {
  label: string;
  /** The value, already formatted — "12.5/sec" or "×1.25". */
  value: string;
  /** What is producing it, in the visitor's own inventory. */
  note: string;
  /** True for the multiplier rows, which are styled apart from the sources. */
  isMultiplier: boolean;
  /** Dimmed when it is doing nothing — a ×1.00 line is information, not noise. */
  inert: boolean;
}

/**
 * The shop sigils were painted for a five-shop layout (one per currency) that
 * the Market does not have — it is five tabs over a single ledger. They are
 * assigned here by what each panel *sells*, not by the name on the original
 * sheet, so the pairing stays readable: the Gold Shop's anvil fronts Forge
 * Upgrades, the Relic Forge's crafting circle fronts Hammers, the Essence
 * Shop's crystals front Enchantments, the Nox orb fronts Artifacts, and the
 * Aether shrine's sparkle fronts Cosmetics. Each tab gets a distinct sigil and
 * every gold tab reads warm against every essence tab's violet.
 */
const TABS: Tab[] = [
  { id: 'forge',     label: 'Forge Upgrades', icon: 'gold-shop',    currency: 'gold' },
  { id: 'hammer',    label: 'Hammers',        icon: 'relic-forge',  currency: 'gold' },
  { id: 'automaton', label: 'Automatons',     glyph: '⚙',           currency: 'gold' },
  { id: 'mastery',   label: 'Mastery',        glyph: '✦',           currency: 'gold' },
  { id: 'enchant',   label: 'Enchantments',   icon: 'essence-shop', currency: 'essence' },
  { id: 'artifact',  label: 'Artifacts',      icon: 'nox-shop',     currency: 'essence' },
  { id: 'cosmetic',  label: 'Cosmetics',      icon: 'aether-shop',  currency: 'gold' },
  { id: 'eclipse',   label: 'The Eclipse',    glyph: '🌑',          currency: 'shard' },
];

/**
 * A row on any of the four Gold ladders, with its price already resolved.
 *
 * `maxed` is what separates the Mastery shelf from the other three: those four
 * are bought once and then permanently held, and a Forge button that stays lit
 * on something you already own is a button that takes a million Gold twice.
 */
interface LadderRow {
  id: string;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  cost: number;
  owned: number;
  affordable: boolean;
  maxed: boolean;
}

/** A "+2.5/sec" rising off the rate readout after a purchase. */
interface RateFloater {
  key: number;
  text: string;
}

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.css'],
})
export class MarketComponent implements OnInit, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly audio = inject(ForgeAudioService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly subs = new Subscription();

  readonly tabs = TABS;
  readonly artifacts = ARTIFACTS;
  readonly cosmetics = COSMETICS;
  readonly enchantments = ENCHANTMENTS;

  active: TabId = 'forge';
  snap: EconomySnapshot = this.economy.snapshot;

  /** Ids that just bought something, for the button's flash. */
  flashing = new Set<string>();
  /** Ids the visitor could not afford on their last attempt. */
  denied = new Set<string>();

  /** Recomputed once a second so the enchantment countdown is honest. */
  now = 0;

  /** One frame of gold-coloured flash across the wallet, per purchase. */
  walletFlash = false;
  /** The green "+2.5/sec" rising off the rate. */
  rateFloaters: RateFloater[] = [];

  /**
   * Whether the Eclipse tab has been armed.
   *
   * A reset that wipes every Gold ladder the visitor owns behind a single
   * unguarded click is a support ticket waiting to be filed, so the button is
   * two clicks: the first arms it and says exactly what will be lost, the
   * second takes it. Reset to false on every snapshot the tab is not showing.
   */
  eclipseArmed = false;

  /** What the last Eclipse handed over, held until the visitor navigates away. */
  eclipseResult: { granted: number; total: number } | null = null;

  private seq = 0;

  readonly prestigeGold = PRESTIGE_GOLD_THRESHOLD;
  readonly prestigeLevel = PRESTIGE_LEVEL_THRESHOLD;
  readonly shardBonusPercent = Math.round(SHARD_BONUS * 100);

  ngOnInit(): void {
    this.economy.init();
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));

    if (!this.isBrowser) return;
    this.now = Date.now();
    // Only while an enchantment is actually running — a shop with no timer on
    // it has no reason to be repainting once a second. (The ledger itself now
    // publishes every second, but that repaint is the counters; this one is
    // only the countdown, and it must not run when there is nothing counting.)
    this.subs.add(interval(1_000).subscribe(() => {
      if (!this.snap.enchantment) return;
      this.now = Date.now();
      this.cdr.markForCheck();
    }));

    // Purchase feedback that belongs to the page rather than to one button:
    // the wallet flashes, and a rate change floats off the headline number.
    this.subs.add(this.economy.purchase$.subscribe(p => {
      this.flashWallet();
      if (p.rateDelta > 0.001) this.floatRate(p.rateDelta);
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Header numbers ─────────────────────────────────────────────────────────

  get gold(): string { return formatCurrency(this.snap.gold); }
  get essence(): string { return formatCurrency(this.snap.essence); }
  /** The headline. Compact past a thousand — the masthead is not a spreadsheet. */
  get perSecond(): string { return formatCompact(this.snap.perSecond); }
  get perMinute(): string { return formatCompact(this.snap.perMinute); }
  get perClick(): string { return formatCurrency(this.snap.perClick); }
  get lifetime(): string { return formatCurrency(this.snap.totalGoldEarned); }
  get strikes(): string { return formatCurrency(this.snap.totalClicks); }
  get shards(): string { return formatCurrency(this.snap.shards); }
  get shardMult(): string { return formatMultiplier(this.snap.shardMult); }
  get autoRate(): string { return formatRate(this.snap.autoPerSecond); }

  // ── The breakdown ──────────────────────────────────────────────────────────

  /**
   * Where the Gold is actually coming from, one line per source and one per
   * multiplier, each naming what the visitor owns that produces it.
   *
   * The whole point is that a rate is not a number handed down from nowhere. A
   * visitor looking at 23.1/sec should be able to read off which four purchases
   * are responsible and what each is worth, which is also the only way the shop
   * can argue for the next one.
   */
  get breakdown(): BreakdownRow[] {
    const b = this.snap.breakdown;
    return [
      {
        label: 'Idle upgrades',
        value: formatCompact(b.idle) + '/sec',
        note: this.ownedNames(FORGE_UPGRADES) || 'the bare forge',
        isMultiplier: false,
        inert: false,
      },
      {
        label: 'Automatons',
        value: formatCompact(b.auto) + '/sec',
        note: this.ownedNames(AUTO_CLICKERS)
          || 'nothing is striking for you yet',
        isMultiplier: false,
        inert: b.auto <= 0,
      },
      {
        label: 'Mastery',
        value: formatMultiplier(b.upgrades),
        note: this.ownedNames(MULTIPLIER_UPGRADES) || 'no efficiency held',
        isMultiplier: true,
        inert: b.upgrades <= 1,
      },
      {
        label: 'Daily streak',
        value: formatMultiplier(b.streak),
        note: this.snap.streakDays > 0
          ? `${this.snap.streakDays}-day streak, 1% a day`
          : 'come back tomorrow',
        isMultiplier: true,
        inert: b.streak <= 1,
      },
      {
        label: 'Eclipse Shards',
        value: formatMultiplier(b.shards),
        note: this.snap.shards > 0
          ? `${this.snap.shards} held, ${this.shardBonusPercent}% each`
          : 'no Eclipse taken',
        isMultiplier: true,
        inert: b.shards <= 1,
      },
      {
        label: 'Fragment of the First Sun',
        value: formatMultiplier(b.artifact),
        note: b.artifact > 1 ? 'held' : 'not held',
        isMultiplier: true,
        inert: b.artifact <= 1,
      },
    ];
  }

  /** "Forge Bellows ×3, Ember Stoker ×2", or an empty string when none are held. */
  private ownedNames(catalog: readonly AnyUpgrade[]): string {
    return catalog
      .map(u => ({ u, n: this.economy.levelOf(u.id) }))
      .filter(x => x.n > 0)
      .map(x => (x.n > 1 ? `${x.u.name} ×${x.n}` : x.u.name))
      .join(', ');
  }

  get tabDef(): Tab {
    return TABS.find(t => t.id === this.active) ?? TABS[0];
  }

  select(id: TabId): void {
    this.active = id;
  }

  // ── Ladders ────────────────────────────────────────────────────────────────

  /** Forge rows, priced against what is already owned. */
  get forgeRows(): LadderRow[] {
    return FORGE_UPGRADES.map(u => this.rowFor(u));
  }

  get hammerRows(): LadderRow[] {
    return HAMMER_UPGRADES.map(u => this.rowFor(u));
  }

  get automatonRows(): LadderRow[] {
    return AUTO_CLICKERS.map(u => this.rowFor(u));
  }

  get masteryRows(): LadderRow[] {
    return MULTIPLIER_UPGRADES.map(u => this.rowFor(u));
  }

  private rowFor(u: AnyUpgrade): LadderRow {
    const owned = this.economy.levelOf(u.id);
    const cost = costOf(u.baseCost, owned);
    const maxed = this.economy.isMaxed(u.id);
    return {
      id: u.id,
      name: u.name,
      effect: u.effect,
      flavour: u.flavour,
      icon: u.icon,
      cost,
      owned,
      affordable: !maxed && this.snap.gold >= cost,
      maxed,
    };
  }

  buyUpgrade(id: string): void {
    this.settle(id, this.economy.buyUpgrade(id));
  }

  // ── The Eclipse ────────────────────────────────────────────────────────────

  get canPrestige(): boolean { return this.snap.prestigeReady; }
  get pendingShards(): number { return this.snap.pendingShards; }
  get prestigeCount(): number { return this.snap.prestigeCount; }

  /** 0-1 toward whichever gate is closer. Drives the progress bar. */
  get prestigeProgress(): number {
    return Math.min(1, this.snap.totalGoldEarned / PRESTIGE_GOLD_THRESHOLD);
  }

  /** Everything the reset would take, named, so nothing is a surprise. */
  get eclipseCost(): string {
    const levels = this.snap.upgradeLevels;
    return levels === 1 ? '1 upgrade level' : `${levels} upgrade levels`;
  }

  arm(): void {
    this.eclipseArmed = true;
  }

  disarm(): void {
    this.eclipseArmed = false;
  }

  takeEclipse(): void {
    const granted = this.economy.prestige();
    this.eclipseArmed = false;
    if (granted <= 0) return;

    this.eclipseResult = { granted, total: this.snap.shards };
    this.audio.comboImpact();
    this.flashWallet();
    this.cdr.markForCheck();
  }

  // ── Enchantments ───────────────────────────────────────────────────────────

  /** Whether this enchantment is the one currently running. */
  isRunning(e: Enchantment): boolean {
    return this.snap.enchantment?.def.id === e.id;
  }

  canAffordEssence(cost: number): boolean {
    return this.snap.essence >= cost;
  }

  buyEnchantment(id: string): void {
    this.settle(id, this.economy.buyEnchantment(id));
  }

  /** "6h 14m left" for the running enchantment, or an empty string. */
  get enchantRemaining(): string {
    const active = this.snap.enchantment;
    if (!active) return '';
    const ms = active.expiresAt - (this.now || Date.now());
    if (ms <= 0) return 'expiring';
    const hours = Math.floor(ms / 3_600_000);
    const mins = Math.floor((ms % 3_600_000) / 60_000);
    return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
  }

  // ── Artifacts ──────────────────────────────────────────────────────────────

  owns(a: Artifact): boolean {
    return this.snap.artifacts.includes(a.id);
  }

  /** Border and glow come from the shared Eclipse ladder, never a new colour. */
  colorOf(a: Artifact): string { return rarityOf(a.tier).color; }
  glowOf(a: Artifact): string { return rarityOf(a.tier).glow; }
  tierLabel(a: Artifact): string { return rarityOf(a.tier).label; }

  buyArtifact(id: string): void {
    this.settle(id, this.economy.buyArtifact(id));
  }

  get artifactsOwned(): number { return this.snap.artifacts.length; }

  // ── Cosmetics ──────────────────────────────────────────────────────────────

  ownsCosmetic(c: Cosmetic): boolean {
    return this.snap.cosmetics.includes(c.id);
  }

  equippedVariant(c: Cosmetic): string | null {
    return this.snap.equipped[c.slot] ?? null;
  }

  isEquipped(c: Cosmetic, v: CosmeticVariant): boolean {
    return this.equippedVariant(c) === v.id;
  }

  buyCosmetic(id: string): void {
    this.settle(id, this.economy.buyCosmetic(id));
  }

  /** Clicking the equipped variant takes it off. Owning is not wearing. */
  equip(c: Cosmetic, v: CosmeticVariant): void {
    this.economy.equip(c.id, this.isEquipped(c, v) ? null : v.id);
    this.audio.coin();
  }

  // ── Purchase feedback ──────────────────────────────────────────────────────

  /**
   * One place where a buy attempt turns into feedback, so every button in the
   * shop behaves identically: a ping and a flash when it lands, a shake when it
   * does not.
   */
  private settle(id: string, bought: boolean): void {
    const set = bought ? this.flashing : this.denied;
    if (bought) this.audio.coin();

    set.add(id);
    this.cdr.markForCheck();
    setTimeout(() => {
      set.delete(id);
      this.cdr.markForCheck();
    }, bought ? 420 : 360);
  }

  isFlashing(id: string): boolean { return this.flashing.has(id); }
  isDenied(id: string): boolean { return this.denied.has(id); }

  /** One gold pulse across the wallet, so a purchase is felt in two places. */
  private flashWallet(): void {
    if (!this.isBrowser) return;
    this.walletFlash = false;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.walletFlash = true;
      this.cdr.markForCheck();
      setTimeout(() => { this.walletFlash = false; this.cdr.markForCheck(); }, 520);
    }, 20);
  }

  /**
   * Float "+2.5/sec" off the rate.
   *
   * The delta is measured by the service across the purchase rather than
   * recomputed here, because the honest number is not the upgrade's printed
   * rate: a Forge Bellows bought while Forge Mastery and nine shards are held
   * is worth considerably more than the +0.5 on its own card, and the floater
   * should say what actually happened.
   */
  private floatRate(delta: number): void {
    if (!this.isBrowser) return;
    const key = this.seq++;
    this.rateFloaters = [...this.rateFloaters, { key, text: `+${formatCompact(delta)}/sec` }];
    this.cdr.markForCheck();
    setTimeout(() => {
      this.rateFloaters = this.rateFloaters.filter(f => f.key !== key);
      this.cdr.markForCheck();
    }, 1_200);
  }

  format(n: number): string { return formatCurrency(n); }
  compact(n: number): string { return formatCompact(n); }
}
