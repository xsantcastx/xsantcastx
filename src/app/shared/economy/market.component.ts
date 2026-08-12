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
  Artifact,
  COSMETICS,
  Cosmetic,
  CosmeticVariant,
  ENCHANTMENTS,
  Enchantment,
  FORGE_UPGRADES,
  ForgeUpgrade,
  HAMMER_UPGRADES,
  HammerUpgrade,
  costOf,
  formatCurrency,
  formatRate,
} from './economy.model';
import { ForgeAudioService } from './forge-audio.service';
import { rarityOf } from '../rarity/rarity.model';

type TabId = 'forge' | 'hammer' | 'enchant' | 'artifact' | 'cosmetic';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  /** Which currency this tab spends. Tints the whole panel. */
  currency: 'gold' | 'essence';
}

const TABS: Tab[] = [
  { id: 'forge',    label: 'Forge Upgrades', icon: '🔥', currency: 'gold' },
  { id: 'hammer',   label: 'Hammers',        icon: '🔨', currency: 'gold' },
  { id: 'enchant',  label: 'Enchantments',   icon: '🕯️', currency: 'essence' },
  { id: 'artifact', label: 'Artifacts',      icon: '💠', currency: 'essence' },
  { id: 'cosmetic', label: 'Cosmetics',      icon: '✨', currency: 'gold' },
];

/** A row on either Gold ladder, with its price already resolved. */
interface LadderRow {
  id: string;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  cost: number;
  owned: number;
  affordable: boolean;
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

  ngOnInit(): void {
    this.economy.init();
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));

    if (!this.isBrowser) return;
    this.now = Date.now();
    // Only while an enchantment is actually running — a shop with no timer on
    // it has no reason to be repainting once a second.
    this.subs.add(interval(1_000).subscribe(() => {
      if (!this.snap.enchantment) return;
      this.now = Date.now();
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Header numbers ─────────────────────────────────────────────────────────

  get gold(): string { return formatCurrency(this.snap.gold); }
  get essence(): string { return formatCurrency(this.snap.essence); }
  get perMinute(): string { return formatRate(this.snap.perMinute); }
  get perClick(): string { return formatCurrency(this.snap.perClick); }
  get lifetime(): string { return formatCurrency(this.snap.totalGoldEarned); }
  get strikes(): string { return formatCurrency(this.snap.totalClicks); }

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

  private rowFor(u: ForgeUpgrade | HammerUpgrade): LadderRow {
    const owned = this.economy.levelOf(u.id);
    const cost = costOf(u.baseCost, owned);
    return {
      id: u.id,
      name: u.name,
      effect: u.effect,
      flavour: u.flavour,
      icon: u.icon,
      cost,
      owned,
      affordable: this.snap.gold >= cost,
    };
  }

  buyUpgrade(id: string): void {
    this.settle(id, this.economy.buyUpgrade(id));
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

  format(n: number): string { return formatCurrency(n); }
}
