/**
 * market.component.ts — the Godforge Market, at /market.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE LEDGER, ONE LIST
 * ─────────────────────────────────────────────────────────────────────────────
 * The shop used to be eight tabs, each with its own hand-written panel: eight
 * copies of a row, eight buy buttons, eight ways for a change to land on seven
 * of them. Finding anything meant knowing which tab it lived on first, which is
 * the one thing a shopper does not know.
 *
 * So every catalog is now projected into one `MarketItem` shape and rendered by
 * one row. Category is a filter, not a place. Search, rarity and price all work
 * across the whole inventory at once, and a visitor who types "hammer" gets
 * hammers without having been told where hammers are kept.
 *
 * The Eclipse is the one exception and stays a panel of its own: it is not a
 * purchase, it is a reset that takes everything on the four Gold ladders, and
 * putting a BUY button on that in a list of BUY buttons would be a trap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY RARITY IS DERIVED RATHER THAN AUTHORED
 * ─────────────────────────────────────────────────────────────────────────────
 * Only Artifacts carry a real `tier`. Rather than write a rarity onto 31 other
 * catalog entries — 31 chances for the ladder and the price to disagree — every
 * other item takes its tier from its rung: position in its own catalog, mapped
 * across the six Eclipse tiers. The ladders are already ordered by price, so
 * the badge and the number can never contradict each other, and adding an item
 * to a catalog re-grades that catalog rather than needing a decision.
 *
 * The tiers are the site's existing Eclipse ladder (Mortal → Singular) rather
 * than a generic Common → Legendary scale, because those six colours are
 * already locked in `rarity.model.ts` and used by the drop system, the Codex
 * and the egg registry. A second rarity vocabulary on one page would be a
 * second brand.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE WHOLE PAGE IS PRERENDERED IN ITS UNAFFORDABLE STATE
 * ─────────────────────────────────────────────────────────────────────────────
 * The catalogs are pure data, so the server renders the first page of the list
 * — name, price, rarity, lore — with the ledger at zero and every BUY button
 * disabled. That is a truthful page for a crawler to index (this is what the
 * shop sells, and you own none of it) and it means hydration only has to flip
 * affordability rather than build a page.
 *
 * Lazy-loaded, so a visitor who never opens it downloads none of it.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
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
  EXPEDITION_UPGRADES,
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
import { EclipseRarity, RARITY_ORDER, rarityOf } from '../rarity/rarity.model';
import { CardArt, artifactCard } from '../rune-forge/rune-cards';
import { BASE_EXPLORER_SLOTS, MAX_EXPLORER_SLOTS } from '../explorer/explorer.model';
import { ArtSceneComponent } from '../art-scene/art-scene.component';

/** Every shelf in the shop. `eclipse` renders a ritual, not a list. */
export type CategoryId =
  | 'forge' | 'hammer' | 'automaton' | 'mastery' | 'expedition'
  | 'enchant' | 'artifact' | 'cosmetic' | 'eclipse';

interface CategoryDef {
  id: CategoryId;
  label: string;
  /** Short form for the tab strip, where horizontal room is the constraint. */
  short: string;
  /** Path under assets/icons/shops, when a sigil was painted for it. */
  icon?: string;
  /** Stands in where no sigil exists. */
  glyph?: string;
  /** Which currency this shelf spends. Tints its rows. */
  currency: 'gold' | 'essence' | 'shard';
  /** One line under the list when this shelf is the only one showing. */
  note: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'forge', label: 'Forge Upgrades', short: 'Forge', icon: 'gold-shop', currency: 'gold',
    note: 'Ten rungs. The forge earns while you are looking at it — and, with the Obsidian Heart, while you are not. Every purchase makes the next one 15% dearer.',
  },
  {
    id: 'hammer', label: 'Hammers', short: 'Hammers', icon: 'relic-forge', currency: 'gold',
    note: 'What one strike of the Flame is worth. Every Hammer also makes every Automaton better, because an Automaton is paid at whatever a strike is worth when it lands.',
  },
  {
    id: 'automaton', label: 'Automatons', short: 'Automatons', glyph: '⚙', currency: 'gold',
    note: 'Hands that strike the Flame while you are elsewhere, paid at the current Hammer rate. They will not hold a combo for you — the arm has to be yours for that.',
  },
  {
    id: 'mastery', label: 'Mastery', short: 'Mastery', glyph: '✦', currency: 'gold',
    note: 'A percentage on everything the forge makes. Sold once each, and they add rather than compound: holding all four is +185%.',
  },
  {
    id: 'expedition', label: 'Expeditions', short: 'Expeditions', glyph: '🧭', currency: 'gold',
    // The sentence naming the Forge View is in the template instead, because it
    // carries a routerLink and a note is a plain string.
    note: 'Explorers walk into a realm and come back with Gold, and sometimes with a rune or a scroll nobody has filed yet. They keep walking while the tab is shut.',
  },
  {
    id: 'enchant', label: 'Enchantments', short: 'Enchants', icon: 'essence-shop', currency: 'essence',
    note: 'Twenty-four hours of faster progression, bought with Essence. Only the strongest one applies, and buying one you are already running restarts its clock.',
  },
  {
    id: 'artifact', label: 'Artifacts', short: 'Artifacts', icon: 'nox-shop', currency: 'essence',
    note: 'Permanent, and sold once. Five of them exist and there is no second copy of any.',
  },
  {
    id: 'cosmetic', label: 'Cosmetics', short: 'Cosmetics', icon: 'aether-shop', currency: 'gold',
    note: 'Bought once. Every variant inside comes with it, and switching between them is free — charging twice for a colour you already own is a toll booth, not a shop.',
  },
  {
    id: 'eclipse', label: 'The Eclipse', short: 'Eclipse', glyph: '🌑', currency: 'shard',
    note: 'Give the whole forge back and keep what it taught you.',
  },
];

/** What the BUY button is currently able to do. */
type ItemState = 'buy' | 'locked' | 'held' | 'owned' | 'running';

/**
 * One row of the shop, whatever shelf it came off.
 *
 * Everything the row template needs is resolved here — price, rarity colour,
 * affordability, the word on the button — so the template makes no decisions
 * and every category renders through the same twelve lines of markup.
 */
interface MarketItem {
  id: string;
  name: string;
  /** The flavour line under the name. Artifacts use their codex lore. */
  lore: string;
  icon: string;
  category: CategoryId;
  categoryLabel: string;
  rarity: EclipseRarity;
  rarityLabel: string;
  rarityColor: string;
  rarityGlow: string;
  /** Resolved for what is already owned, so a ladder price is the next price. */
  cost: number;
  currency: 'gold' | 'essence';
  /** The SUPPLY column — what one unit yields, in the item's own unit. */
  yield: string;
  /** What the item actually does, in a sentence. */
  effect: string;
  owned: number;
  state: ItemState;
  /** The verb on the button — Forge, Enlist, Master, Invoke, Claim, Acquire. */
  verb: string;
  /**
   * The painted card, where one exists. Artifacts have all five; everything
   * else falls back to its glyph, as does a sixth artifact shipped before its
   * card is drawn.
   */
  art: CardArt | null;
  /** Set only for cosmetics, which render a variant picker once owned. */
  cosmetic?: Cosmetic;
  /** Lower-cased name + lore + category, precomputed for the search box. */
  haystack: string;
}

/** A row on the MOST FORGED board. */
interface SellerRow {
  rank: number;
  id: string;
  name: string;
  icon: string;
  /** "×8 held" for real holdings, "+512 forged" for the realm-wide fallback. */
  detail: string;
  color: string;
}

/** One line of the income breakdown, ready to render. */
interface BreakdownRow {
  label: string;
  value: string;
  note: string;
  isMultiplier: boolean;
  inert: boolean;
}

/** A "+2.5/sec" rising off the rate readout after a purchase. */
interface RateFloater {
  key: number;
  text: string;
}

/** How many rows one page of the list holds. */
const PAGE_SIZE = 8;

/**
 * The realm-wide board, shown until the visitor has forged anything of their
 * own. These are the five things the shop most wants a new visitor to look at,
 * and the counts are the Archivum's, not this browser's — which is why the
 * board relabels itself to "in your forge" the moment there is real data to
 * show instead. It never presents one as the other.
 */
const TRENDING: { id: string; sales: number }[] = [
  { id: 'realm-conduit',      sales: 512 },
  { id: 'godforge-heart',     sales: 487 },
  { id: 'eclipse-reactor',    sales: 402 },
  { id: 'forge-efficiency-i', sales: 376 },
  { id: 'nether-furnace',     sales: 329 },
];

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, RouterLink, ArtSceneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.css'],
})
export class MarketComponent implements OnInit, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly audio = inject(ForgeAudioService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly subs = new Subscription();

  readonly categories = CATEGORIES;
  readonly rarityOrder = RARITY_ORDER;
  readonly pageSize = PAGE_SIZE;

  snap: EconomySnapshot = this.economy.snapshot;

  // ── Filter state ───────────────────────────────────────────────────────────

  /** `null` is "All" — the default, and the whole point of the redesign. */
  category: CategoryId | null = null;
  rarity: EclipseRarity | null = null;
  query = '';
  page = 0;

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
   * Whether the Eclipse has been armed.
   *
   * A reset that wipes every Gold ladder the visitor owns behind a single
   * unguarded click is a support ticket waiting to be filed, so the button is
   * two clicks: the first arms it and says exactly what will be lost, the
   * second takes it.
   */
  eclipseArmed = false;

  /** What the last Eclipse handed over, held until the visitor navigates away. */
  eclipseResult: { granted: number; total: number } | null = null;

  private seq = 0;
  private revealObserver?: IntersectionObserver;

  readonly prestigeGold = PRESTIGE_GOLD_THRESHOLD;
  readonly prestigeLevel = PRESTIGE_LEVEL_THRESHOLD;
  readonly shardBonusPercent = Math.round(SHARD_BONUS * 100);

  /**
   * The whole inventory, rebuilt once per snapshot rather than once per getter.
   *
   * The template reads the list through five different accessors (the page, the
   * count, the category counts, the rarity counts, the top sellers) and the
   * ledger publishes every second. Without this cache that is five full rebuilds
   * of 36 items a second for a page that changed one number.
   */
  private itemCache: MarketItem[] = [];
  private itemCacheKey = '';

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

    // Purchase feedback that belongs to the page rather than to one button.
    this.subs.add(this.economy.purchase$.subscribe(p => {
      this.flashWallet();
      if (p.rateDelta > 0.001) this.floatRate(p.rateDelta);
    }));

    this.armReveal();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.revealObserver?.disconnect();
  }

  // ── Scroll reveal ──────────────────────────────────────────────────────────

  /**
   * Fade the shelves up as they arrive. One observer for the page's handful of
   * blocks — the rows themselves are not observed, because a list that
   * re-paginates would need re-observing on every page turn for an effect
   * nobody asked to see twice.
   *
   * Two things this deliberately does not do:
   *
   * The hidden state is armed from here rather than written in the stylesheet.
   * A `[data-reveal] { opacity: 0 }` that is only undone by a class this method
   * adds means the entire shop floor is invisible to anything that did not run
   * this method — a JS error, a blocked bundle, a crawler that does not execute
   * scripts. The page is prerendered specifically so its inventory is readable
   * without JS, and hiding all of it behind JS would throw that away. So the
   * served HTML is visible, and only a browser that got this far opts into the
   * animation, by way of the `armed` value on the attribute.
   *
   * And anything already on screen when this runs is skipped outright. Arming
   * it would mean painting the block, then hiding it, then fading it back in —
   * a flash of content on every load. Only what is below the fold animates,
   * which is the only place the effect was ever visible anyway.
   */
  private armReveal(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.revealObserver = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('mk-in');
        this.revealObserver?.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    // After the first paint, so the nodes exist and their boxes are real.
    setTimeout(() => {
      const nodes = this.host.nativeElement.querySelectorAll('[data-reveal]');
      const fold = window.innerHeight;
      nodes.forEach((n: Element) => {
        if (n.getBoundingClientRect().top < fold) return;
        n.setAttribute('data-reveal', 'armed');
        this.revealObserver?.observe(n);
      });
    });
  }

  // ── Header numbers ─────────────────────────────────────────────────────────

  get gold(): string { return formatCurrency(this.snap.gold); }
  get essence(): string { return formatCurrency(this.snap.essence); }
  get perSecond(): string { return formatCompact(this.snap.perSecond); }
  get perMinute(): string { return formatCompact(this.snap.perMinute); }
  get perClick(): string { return formatCurrency(this.snap.perClick); }
  get lifetime(): string { return formatCurrency(this.snap.totalGoldEarned); }
  get strikes(): string { return formatCurrency(this.snap.totalClicks); }
  get shards(): string { return formatCurrency(this.snap.shards); }
  get shardMult(): string { return formatMultiplier(this.snap.shardMult); }
  get autoRate(): string { return formatRate(this.snap.autoPerSecond); }

  /**
   * Everything the visitor is holding, priced in Gold, as one number.
   *
   * Essence is converted at the rate the shop itself charges — the Artifact
   * shelf is the only place both currencies are quoted against the same goods —
   * so this is a shop-relative figure and is labelled as an estimate, not a
   * balance.
   */
  get totalValue(): string {
    return formatCompact(this.snap.gold + this.snap.essence * 10_000);
  }

  // ── The inventory ──────────────────────────────────────────────────────────

  /**
   * Every purchasable thing in the shop, as one list.
   *
   * Rebuilt only when something that changes a row changes: the two balances,
   * the number of upgrade levels held, and the counts of the three one-shot
   * shelves. A ticking `perSecond` does not rebuild the list, because no row
   * renders it.
   */
  private get items(): MarketItem[] {
    const s = this.snap;
    const key = [
      s.gold, s.essence, s.upgradeLevels,
      s.artifacts.length, s.cosmetics.length,
      s.enchantment?.def.id ?? '',
    ].join('|');
    if (key === this.itemCacheKey) return this.itemCache;

    const out: MarketItem[] = [
      ...FORGE_UPGRADES.map((u, i) =>
        this.fromLadder(u, i, FORGE_UPGRADES.length, 'forge', 'Forge',
          `${formatCompact(u.ratePerSecond)}/sec`)),
      ...HAMMER_UPGRADES.map((u, i) =>
        this.fromLadder(u, i, HAMMER_UPGRADES.length, 'hammer', 'Forge',
          `${formatCompact(u.goldPerClick)}/hit`)),
      ...AUTO_CLICKERS.map((u, i) =>
        this.fromLadder(u, i, AUTO_CLICKERS.length, 'automaton', 'Enlist',
          `${formatCompact(u.clicksPerSecond)}/sec`)),
      ...MULTIPLIER_UPGRADES.map((u, i) =>
        this.fromLadder(u, i, MULTIPLIER_UPGRADES.length, 'mastery', 'Master',
          `+${Math.round(u.bonus * 100)}%`)),
      ...EXPEDITION_UPGRADES.map((u, i) =>
        this.fromLadder(u, i, EXPEDITION_UPGRADES.length, 'expedition', 'Hire',
          `${u.explorers} out`)),
      ...ENCHANTMENTS.map((e, i) => this.fromEnchantment(e, i)),
      ...ARTIFACTS.map(a => this.fromArtifact(a)),
      ...COSMETICS.map((c, i) => this.fromCosmetic(c, i)),
    ];

    this.itemCache = out;
    this.itemCacheKey = key;
    return out;
  }

  /**
   * Where an item's rarity comes from when it has no authored tier: its rung.
   *
   * The catalogs are already ordered cheapest-first, so mapping position across
   * the six tiers means the badge and the price can never disagree, and a new
   * entry re-grades its own shelf instead of needing a decision.
   */
  private tierFor(index: number, total: number): EclipseRarity {
    if (total <= 1) return RARITY_ORDER[0];
    const step = Math.floor((index * RARITY_ORDER.length) / total);
    return RARITY_ORDER[Math.min(step, RARITY_ORDER.length - 1)];
  }

  private paint(item: Omit<MarketItem, 'rarityLabel' | 'rarityColor' | 'rarityGlow' | 'haystack'>): MarketItem {
    const def = rarityOf(item.rarity);
    return {
      ...item,
      rarityLabel: def.label,
      rarityColor: def.color,
      rarityGlow: def.glow,
      haystack: `${item.name} ${item.lore} ${item.effect} ${item.categoryLabel} ${def.label}`.toLowerCase(),
    };
  }

  private labelOf(id: CategoryId): string {
    return CATEGORIES.find(c => c.id === id)?.label ?? id;
  }

  private fromLadder(
    u: AnyUpgrade, index: number, total: number, category: CategoryId,
    verb: string, yieldText: string,
  ): MarketItem {
    const owned = this.economy.levelOf(u.id);
    const cost = costOf(u.baseCost, owned);
    const maxed = this.economy.isMaxed(u.id);
    return this.paint({
      id: u.id,
      name: u.name,
      lore: u.flavour,
      icon: u.icon,
      category,
      categoryLabel: this.labelOf(category),
      rarity: this.tierFor(index, total),
      cost,
      currency: 'gold',
      yield: yieldText,
      effect: u.effect,
      owned,
      state: maxed ? 'held' : (this.snap.gold >= cost ? 'buy' : 'locked'),
      verb,
      art: null,
    });
  }

  private fromEnchantment(e: Enchantment, index: number): MarketItem {
    const running = this.snap.enchantment?.def.id === e.id;
    const afford = this.snap.essence >= e.cost;
    return this.paint({
      id: e.id,
      name: e.name,
      lore: e.flavour,
      icon: e.icon,
      category: 'enchant',
      categoryLabel: this.labelOf('enchant'),
      rarity: this.tierFor(index, ENCHANTMENTS.length),
      cost: e.cost,
      currency: 'essence',
      yield: `${e.hours}h`,
      effect: e.effect,
      owned: running ? 1 : 0,
      // A running enchantment is still buyable — that is how you renew it — so
      // it never reaches 'running' unless the Essence is also short.
      state: running && !afford ? 'running' : (afford ? 'buy' : 'locked'),
      verb: running ? 'Renew' : 'Invoke',
      art: null,
    });
  }

  private fromArtifact(a: Artifact): MarketItem {
    const owned = this.snap.artifacts.includes(a.id);
    return this.paint({
      id: a.id,
      name: a.name,
      lore: a.lore,
      icon: a.icon,
      category: 'artifact',
      categoryLabel: this.labelOf('artifact'),
      rarity: a.tier,
      cost: a.cost,
      currency: 'essence',
      yield: 'permanent',
      effect: a.effect,
      owned: owned ? 1 : 0,
      state: owned ? 'held' : (this.snap.essence >= a.cost ? 'buy' : 'locked'),
      verb: 'Claim',
      art: artifactCard(a.id),
    });
  }

  private fromCosmetic(c: Cosmetic, index: number): MarketItem {
    const owned = this.snap.cosmetics.includes(c.id);
    return this.paint({
      id: c.id,
      name: c.name,
      lore: c.flavour,
      icon: c.icon,
      category: 'cosmetic',
      categoryLabel: this.labelOf('cosmetic'),
      rarity: this.tierFor(index, COSMETICS.length),
      cost: c.cost,
      currency: 'gold',
      yield: `${c.variants.length} skins`,
      effect: c.effect,
      owned: owned ? 1 : 0,
      state: owned ? 'owned' : (this.snap.gold >= c.cost ? 'buy' : 'locked'),
      verb: 'Acquire',
      art: null,
      cosmetic: c,
    });
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  /** The inventory after the search box, the shelf and the rarity facet. */
  get filtered(): MarketItem[] {
    const q = this.query.trim().toLowerCase();
    return this.items.filter(it =>
      (!this.category || it.category === this.category) &&
      (!this.rarity || it.rarity === this.rarity) &&
      (!q || it.haystack.includes(q))
    );
  }

  get filteredCount(): number { return this.filtered.length; }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCount / PAGE_SIZE));
  }

  /**
   * The rows actually on screen.
   *
   * The page index is clamped here rather than reset by every filter change,
   * so narrowing a filter while deep in the list lands on the last page of the
   * new result instead of an empty one.
   */
  get pageItems(): MarketItem[] {
    const page = Math.min(this.page, this.totalPages - 1);
    const start = page * PAGE_SIZE;
    return this.filtered.slice(start, start + PAGE_SIZE);
  }

  /** 1-based, clamped, for the "3 / 12" readout. */
  get pageLabel(): number { return Math.min(this.page, this.totalPages - 1) + 1; }

  get canPrev(): boolean { return this.pageLabel > 1; }
  get canNext(): boolean { return this.pageLabel < this.totalPages; }

  prev(): void { if (this.canPrev) this.page = this.pageLabel - 2; }
  next(): void { if (this.canNext) this.page = this.pageLabel; }

  /** How many items a shelf holds, for the count beside its name. */
  countOf(id: CategoryId): number {
    if (id === 'eclipse') return 1;
    return this.items.filter(i => i.category === id).length;
  }

  /** How many items wear a tier, for the count beside the rarity swatch. */
  countOfRarity(r: EclipseRarity): number {
    return this.items.filter(i => i.rarity === r).length;
  }

  rarityLabel(r: EclipseRarity): string { return rarityOf(r).label; }
  rarityColor(r: EclipseRarity): string { return rarityOf(r).color; }
  rarityGlow(r: EclipseRarity): string { return rarityOf(r).glow; }

  /**
   * Selecting a shelf. Clicking the one already selected clears it — the
   * sidebar doubles as its own "back to everything".
   */
  selectCategory(id: CategoryId | null): void {
    this.category = this.category === id ? null : id;
    this.page = 0;
    this.eclipseArmed = false;
  }

  selectRarity(r: EclipseRarity | null): void {
    this.rarity = this.rarity === r ? null : r;
    this.page = 0;
  }

  onSearch(value: string): void {
    this.query = value;
    this.page = 0;
  }

  clearFilters(): void {
    this.query = '';
    this.category = null;
    this.rarity = null;
    this.page = 0;
  }

  get hasFilters(): boolean {
    return !!this.query.trim() || !!this.category || !!this.rarity;
  }

  /** True when the Eclipse ritual should replace the list entirely. */
  get showEclipse(): boolean { return this.category === 'eclipse'; }

  /** The note under the tab strip, when exactly one shelf is showing. */
  get activeNote(): string {
    return CATEGORIES.find(c => c.id === this.category)?.note ?? '';
  }

  /** Explorers hired, including the one every visitor starts with. */
  get explorerSlots(): number {
    return Math.min(
      MAX_EXPLORER_SLOTS,
      BASE_EXPLORER_SLOTS + this.economy.levelOf('explorer-slot'),
    );
  }

  readonly maxExplorerSlots = MAX_EXPLORER_SLOTS;

  /**
   * The one shelf whose note carries a live number. Kept apart from the static
   * `note` strings rather than templating them all, so eight constants stay
   * constants.
   */
  get activeTally(): string {
    if (this.category !== 'expedition') return '';
    return this.explorerSlots >= this.maxExplorerSlots
      ? `All ${this.maxExplorerSlots} hired — one for every realm.`
      : `${this.explorerSlots} of ${this.maxExplorerSlots} hired.`;
  }

  /** Tints the page to whatever currency the visible shelf spends. */
  get activeCurrency(): string {
    return CATEGORIES.find(c => c.id === this.category)?.currency ?? 'gold';
  }

  // ── The board ──────────────────────────────────────────────────────────────

  /**
   * MOST FORGED — the visitor's own five deepest holdings.
   *
   * Real numbers when there are real numbers. Until then it falls back to the
   * realm-wide board, and `sellersAreMine` tells the template which heading to
   * put on it, because a curated list wearing the words "in your forge" is a
   * lie the shop does not need to tell.
   */
  get sellers(): SellerRow[] {
    const mine = this.items
      .filter(i => i.owned > 0 && i.category !== 'cosmetic')
      .sort((a, b) => b.owned - a.owned || b.cost - a.cost)
      .slice(0, 5);

    if (mine.length >= 3) {
      return mine.map((i, n) => ({
        rank: n + 1,
        id: i.id,
        name: i.name,
        icon: i.icon,
        detail: i.owned > 1 ? `×${i.owned} held` : 'held',
        color: i.rarityColor,
      }));
    }

    const byId = new Map(this.items.map(i => [i.id, i]));
    return TRENDING
      .map((t, n) => {
        const item = byId.get(t.id);
        if (!item) return null;
        return {
          rank: n + 1,
          id: item.id,
          name: item.name,
          icon: item.icon,
          detail: `+${t.sales} forged`,
          color: item.rarityColor,
        };
      })
      .filter((r): r is SellerRow => r !== null);
  }

  get sellersAreMine(): boolean {
    return this.items.filter(i => i.owned > 0 && i.category !== 'cosmetic').length >= 3;
  }

  /** Jumps the list to a board entry, so the board is a shortcut not a poster. */
  focusItem(item: SellerRow): void {
    const found = this.items.find(i => i.id === item.id);
    if (!found) return;
    this.category = null;
    this.rarity = null;
    this.query = found.name;
    this.page = 0;
  }

  // ── The breakdown ──────────────────────────────────────────────────────────

  /**
   * Where the Gold is actually coming from, one line per source and one per
   * multiplier, each naming what the visitor owns that produces it.
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
        note: this.ownedNames(AUTO_CLICKERS) || 'nothing is striking for you yet',
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

  // ── Buying ─────────────────────────────────────────────────────────────────

  /**
   * The one BUY handler. Which service call it makes is decided by the row's
   * own category, so the template has a single `(click)` and adding a shelf
   * cannot leave a button wired to the wrong ledger.
   */
  buy(item: MarketItem): void {
    if (item.state === 'held' || item.state === 'owned') return;

    let bought = false;
    switch (item.category) {
      case 'enchant':  bought = this.economy.buyEnchantment(item.id); break;
      case 'artifact': bought = this.economy.buyArtifact(item.id);    break;
      case 'cosmetic': bought = this.economy.buyCosmetic(item.id);    break;
      default:         bought = this.economy.buyUpgrade(item.id);     break;
    }
    this.settle(item.id, bought);
  }

  // ── Cosmetics ──────────────────────────────────────────────────────────────

  isEquipped(c: Cosmetic, v: CosmeticVariant): boolean {
    return (this.snap.equipped[c.slot] ?? null) === v.id;
  }

  /** Clicking the equipped variant takes it off. Owning is not wearing. */
  equip(c: Cosmetic, v: CosmeticVariant): void {
    this.economy.equip(c.id, this.isEquipped(c, v) ? null : v.id);
    this.audio.coin();
  }

  // ── Enchantments ───────────────────────────────────────────────────────────

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

  isRunning(item: MarketItem): boolean {
    return item.category === 'enchant' && this.snap.enchantment?.def.id === item.id;
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

  arm(): void { this.eclipseArmed = true; }
  disarm(): void { this.eclipseArmed = false; }

  takeEclipse(): void {
    const granted = this.economy.prestige();
    this.eclipseArmed = false;
    if (granted <= 0) return;

    this.eclipseResult = { granted, total: this.snap.shards };
    this.audio.comboImpact();
    this.flashWallet();
    this.cdr.markForCheck();
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
   * is worth considerably more than the +0.5 on its own card.
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

  trackItem = (_: number, it: MarketItem) => it.id;
}
