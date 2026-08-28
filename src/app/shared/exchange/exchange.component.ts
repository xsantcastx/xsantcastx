/**
 * exchange.component.ts — the trading floor.
 *
 * Three columns: what is for sale, the line you are looking at, and what the
 * hall has been doing. The market itself lives in `exchange.model.ts` and the
 * trades land in `exchange.service.ts`; this file is the reading of them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS A CLOCK HERE AND NOWHERE ELSE
 * ─────────────────────────────────────────────────────────────────────────────
 * Prices are a function of `Date.now()`, so nothing has to tick for them to be
 * right — but something has to tick for them to be *seen* to change. This holds
 * one interval, at fifteen seconds, and it exists purely so the page repaints;
 * stopping it changes nothing about what a trade costs. It is cleared on
 * destroy and never started on the server or under reduced motion, where a
 * number that rewrites itself is exactly the thing being asked for less of.
 *
 * Fifteen seconds rather than one: at the volatility the model runs, a
 * one-second repaint moves the last digit and nothing else, which is motion
 * without information. Fifteen is slow enough to read and fast enough that
 * watching a line move is a real thing you can do.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE QUOTE IS PASSED BACK INTO THE TRADE
 * ─────────────────────────────────────────────────────────────────────────────
 * `buy` and `sell` take the unit price the player was shown and refuse the
 * trade if the live price has moved past it. That check cannot live here — a
 * component cannot be the thing that decides whether a component's number is
 * stale — so this passes what it rendered and lets the service arbitrate. A
 * refusal is surfaced as "the price moved", with the new one already on screen.
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
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ArtSceneComponent } from '../art-scene/art-scene.component';
import { EconomyService } from '../economy/economy.service';
import { InventoryService, MAX_INVENTORY } from '../rpg/inventory.service';
import { PriceChartComponent } from './price-chart.component';
import {
  ExchangeService,
  type ExchangeSnapshot,
  type TradeFailure,
  type TradeRecord,
} from './exchange.service';
import {
  CATEGORY_LABELS,
  DAY_MS,
  GOOD_CATEGORIES,
  SALE_TAX_RATE,
  activeEvents,
  priceHistory,
  type ActiveMarketEvent,
  type ExchangeGood,
  type GoodCategory,
  type MarketListing,
  type PricePoint,
  type Trend,
} from './exchange.model';
import { RUNE_TIERS, type RuneTier } from '../rune-forge/rune.model';
import type { ItemRarity } from '../rpg/item.model';

import { RelatedPagesComponent } from '../seo/related-pages.component';
type SortKey = 'name' | 'price' | 'change' | 'volume';
type TrendFilter = 'all' | Trend;
type Side = 'buy' | 'sell';

/** The chart windows, and how many samples each is drawn with. */
const RANGES = [
  { id: '24h', label: '24H', span: DAY_MS, samples: 48 },
  { id: '7d',  label: '7D',  span: 7 * DAY_MS, samples: 56 },
  { id: '30d', label: '30D', span: 30 * DAY_MS, samples: 60 },
  { id: 'all', label: 'ALL', span: 120 * DAY_MS, samples: 72 },
] as const;
type RangeId = typeof RANGES[number]['id'];

/** How often the page repaints. See the header. */
const REPAINT_MS = 15_000;

/**
 * How many rows the board shows before asking.
 *
 * The catalogue is 163 lines and every row draws its own sparkline, so
 * rendering the lot puts a 24,000-pixel column on the page and 163 inline SVGs
 * in the document — which also pushes the trade panel in the rail below every
 * one of them at narrow widths. Forty is about two screens: enough that
 * scanning feels like a board rather than a paged table, short enough that the
 * panel stays reachable and the filters are the intended way to find a line.
 */
const PAGE_SIZE = 40;

@Component({
  selector: 'app-exchange',
  standalone: true,
  imports: [RelatedPagesComponent, CommonModule, FormsModule, RouterLink, ArtSceneComponent, PriceChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exchange.component.html',
  styleUrls: ['./exchange.component.css'],
})
export class ExchangeComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly exchange = inject(ExchangeService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly categories = GOOD_CATEGORIES;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly ranges = RANGES;
  readonly taxPercent = Math.round(SALE_TAX_RATE * 100);
  readonly rarities: readonly ItemRarity[] =
    ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];

  /**
   * The moment everything on this page is priced at.
   *
   * One value, read once per repaint and threaded through every price, chart
   * and quote below. Calling `Date.now()` per row would mean the sparkline, the
   * headline price and the buy button could each be priced a few milliseconds
   * apart — invisible, but it would make the quote the service arbitrates
   * against something no single clock ever produced.
   */
  now = 0;

  hydrated = false;
  gold = 0;
  bagUsed = 0;
  readonly bagCap = MAX_INVENTORY;

  listings: MarketListing[] = [];
  /** Everything matching the filters. */
  matched: MarketListing[] = [];
  /** The slice actually rendered. See PAGE_SIZE. */
  visible: MarketListing[] = [];
  shown = PAGE_SIZE;
  events: ActiveMarketEvent[] = [];
  snap: ExchangeSnapshot = {
    trades: [], spentToday: 0, earnedToday: 0, taxPaidToday: 0, movedGoodIds: [],
  };

  risers: MarketListing[] = [];
  fallers: MarketListing[] = [];

  // ── Filters ────────────────────────────────────────────────────────────────
  search = '';
  category: GoodCategory | 'all' = 'all';
  rarity: ItemRarity | 'all' = 'all';
  trendFilter: TrendFilter = 'all';
  minPrice: number | null = null;
  maxPrice: number | null = null;
  ownedOnly = false;
  sort: SortKey = 'change';
  sortDesc = true;

  // ── The open line ──────────────────────────────────────────────────────────
  selected: MarketListing | null = null;
  range: RangeId = '24h';
  chart: PricePoint[] = [];
  side: Side = 'buy';
  quantity = 1;
  /** Set for a few seconds after a trade, so the panel can say what happened. */
  notice: { tone: 'ok' | 'bad'; text: string } | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.now = Date.now();
    if (!this.isBrowser) {
      // SSR paints the catalogue at the server's clock so the shell is real
      // markup rather than a spinner. Hydration re-prices it a frame later.
      this.recompute();
      return;
    }

    this.economy.init();
    this.inventory.init();
    this.exchange.init();

    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.gold = s.gold;
      this.cdr.markForCheck();
    }));
    this.subs.add(this.inventory.snapshot$.subscribe(s => {
      this.bagUsed = s.usedRows;
      this.cdr.markForCheck();
    }));
    this.subs.add(this.exchange.snapshot$.subscribe(s => {
      this.snap = s;
      this.recompute();
      this.cdr.markForCheck();
    }));

    this.hydrated = true;
    this.recompute();

    if (!prefersReducedMotion()) {
      this.timer = setInterval(() => {
        this.now = Date.now();
        this.recompute();
        this.cdr.markForCheck();
      }, REPAINT_MS);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.timer) clearInterval(this.timer);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Deriving the page
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Re-price everything and re-apply the filters.
   *
   * Deliberately not getters on the template. `listings()` walks the whole
   * catalogue and each row synthesises a 24-point sparkline, so a getter would
   * redo all of it on every change-detection pass — which for an OnPush
   * component with four subscriptions is several times a second.
   */
  private recompute(): void {
    this.listings = this.exchange.listings(this.now);
    this.events = activeEvents(this.now);
    this.applyFilters();

    const byChange = [...this.listings].sort((a, b) => b.change24h - a.change24h);
    this.risers = byChange.filter(l => l.trend === 'rising').slice(0, 5);
    this.fallers = byChange.filter(l => l.trend === 'falling').reverse().slice(0, 5);

    if (this.selected) {
      const fresh = this.listings.find(l => l.itemId === this.selected!.itemId);
      if (fresh) {
        this.selected = fresh;
        this.buildChart();
      }
    }
  }

  private applyFilters(): void {
    const needle = this.search.trim().toLowerCase();
    let rows = this.listings.filter(l => {
      if (needle && !l.itemName.toLowerCase().includes(needle)) return false;
      if (this.category !== 'all' && l.good.category !== this.category) return false;
      if (this.rarity !== 'all' && l.rarity !== this.rarity) return false;
      if (this.trendFilter !== 'all' && l.trend !== this.trendFilter) return false;
      if (this.minPrice != null && l.currentPrice < this.minPrice) return false;
      if (this.maxPrice != null && l.currentPrice > this.maxPrice) return false;
      if (this.ownedOnly && this.holdings(l.good) <= 0) return false;
      return true;
    });

    const dir = this.sortDesc ? -1 : 1;
    rows = rows.sort((a, b) => {
      switch (this.sort) {
        case 'name':   return a.itemName.localeCompare(b.itemName) * dir;
        case 'price':  return (a.currentPrice - b.currentPrice) * dir;
        case 'volume': return (a.demand - b.demand) * dir;
        default:       return (a.change24h - b.change24h) * dir;
      }
    });

    this.matched = rows;
    this.visible = rows.slice(0, this.shown);
  }

  /** Reveal another page. Never shrinks — the button only ever adds. */
  revealMore(): void {
    this.shown += PAGE_SIZE;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  get hidden(): number { return Math.max(0, this.matched.length - this.visible.length); }

  onFilterChange(): void {
    // A new filter is a new search, so it starts from the top rather than
    // keeping however far the last one had been unrolled.
    this.shown = PAGE_SIZE;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  setSort(key: SortKey): void {
    if (this.sort === key) this.sortDesc = !this.sortDesc;
    else { this.sort = key; this.sortDesc = key !== 'name'; }
    this.shown = PAGE_SIZE;
    this.applyFilters();
  }

  clearFilters(): void {
    this.search = '';
    this.category = 'all';
    this.rarity = 'all';
    this.trendFilter = 'all';
    this.minPrice = null;
    this.maxPrice = null;
    this.ownedOnly = false;
    this.shown = PAGE_SIZE;
    this.applyFilters();
  }

  get filtersActive(): boolean {
    return !!this.search || this.category !== 'all' || this.rarity !== 'all'
      || this.trendFilter !== 'all' || this.minPrice != null || this.maxPrice != null
      || this.ownedOnly;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The open line
  // ───────────────────────────────────────────────────────────────────────────

  select(listing: MarketListing): void {
    this.selected = listing;
    this.side = this.holdings(listing.good) > 0 ? this.side : 'buy';
    this.quantity = 1;
    this.notice = null;
    this.buildChart();
  }

  close(): void {
    this.selected = null;
    this.notice = null;
  }

  setRange(id: RangeId): void {
    this.range = id;
    this.buildChart();
  }

  setSide(side: Side): void {
    this.side = side;
    this.quantity = 1;
    this.notice = null;
  }

  private buildChart(): void {
    if (!this.selected) { this.chart = []; return; }
    const range = RANGES.find(r => r.id === this.range) ?? RANGES[0];
    this.chart = priceHistory(
      this.selected.good,
      this.now,
      range.span,
      range.samples,
      this.exchange.pressureFor(this.selected.itemId),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Quotes
  // ───────────────────────────────────────────────────────────────────────────

  holdings(good: ExchangeGood): number {
    return this.exchange.holdings(good);
  }

  get maxQuantity(): number {
    if (!this.selected) return 1;
    if (this.side === 'sell') return Math.max(1, this.holdings(this.selected.good));
    const affordable = Math.floor(this.gold / Math.max(1, this.selected.currentPrice));
    return Math.max(1, Math.min(999, affordable || 1));
  }

  setQuantity(value: number | string): void {
    const n = Math.floor(Number(value));
    this.quantity = Number.isFinite(n) && n > 0 ? Math.min(999, n) : 1;
  }

  fillMax(): void {
    this.quantity = this.maxQuantity;
  }

  get quote() {
    if (!this.selected) return null;
    return this.side === 'buy'
      ? this.exchange.previewBuy(this.selected.good, this.quantity, this.now)
      : this.exchange.previewSell(this.selected.good, this.quantity, this.now);
  }

  /** Why the trade button is off, or null when it is on. */
  get blocker(): string | null {
    if (!this.selected) return null;
    if (!this.hydrated) return 'Waking the hall…';
    const quote = this.quote;
    if (!quote || quote.quantity <= 0) return 'Choose a quantity.';

    if (this.side === 'buy') {
      if (quote.net > this.gold) return 'Not enough Gold.';
      const need = this.selected.good.kind === 'equipment' ? quote.quantity : 1;
      if (this.bagCap - this.bagUsed < need && !this.toppingUpAStack()) return 'No room in the bag.';
      return null;
    }

    if (this.holdings(this.selected.good) < quote.quantity) return 'You do not hold that many.';
    return null;
  }

  /** True when a material purchase lands on a stack that already has a row. */
  private toppingUpAStack(): boolean {
    const good = this.selected?.good;
    return !!good && good.kind === 'material' && this.holdings(good) > 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Trading
  // ───────────────────────────────────────────────────────────────────────────

  confirm(): void {
    if (!this.selected || this.blocker) return;
    const listing = this.selected;
    const quantity = this.quantity;
    const shown = listing.currentPrice;

    const result = this.side === 'buy'
      ? this.exchange.buy(listing.itemId, quantity, shown, Date.now())
      : this.exchange.sell(listing.itemId, quantity, shown, Date.now());

    if (result.ok) {
      const t = result.trade;
      this.say('ok', t.side === 'buy'
        ? `Bought ${t.quantity} × ${t.name} for ${fmt(t.net)} Gold.`
        : `Sold ${t.quantity} × ${t.name}. ${fmt(t.net)} Gold in, ${fmt(t.tax)} to the house.`);
      this.quantity = 1;
    } else {
      this.say('bad', FAILURE_COPY[result.code]);
    }

    // Re-price immediately: the trade just moved this line, and the player
    // should see their own footprint land rather than wait for the next tick.
    this.now = Date.now();
    this.recompute();
    this.cdr.markForCheck();
  }

  private say(tone: 'ok' | 'bad', text: string): void {
    this.notice = { tone, text };
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.notice = null;
      this.cdr.markForCheck();
    }, 6_000);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Painting
  // ───────────────────────────────────────────────────────────────────────────

  rarityLabel(rarity: ItemRarity): string { return RUNE_TIERS[rarity as RuneTier].label; }
  rarityColor(rarity: ItemRarity): string { return RUNE_TIERS[rarity as RuneTier].color; }
  rarityGlow(rarity: ItemRarity): string { return RUNE_TIERS[rarity as RuneTier].glow; }

  /** Rising is green, falling is red, flat borrows the rarity. */
  trendColor(listing: MarketListing): string {
    if (listing.trend === 'rising') return '#5fdc9a';
    if (listing.trend === 'falling') return '#ff6b6b';
    return this.rarityColor(listing.rarity);
  }

  gold_(n: number): string { return fmt(n); }

  percent(change: number): string {
    const pct = change * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`;
  }

  /** "in 42m" for an event's remaining life. */
  remaining(event: ActiveMarketEvent): string {
    const ms = Math.max(0, event.endsAt - this.now);
    const mins = Math.round(ms / 60_000);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
    return `${Math.max(1, mins)}m left`;
  }

  eventDelta(event: ActiveMarketEvent): string {
    const pct = Math.round((event.multiplier - 1) * 100);
    return `${pct > 0 ? '+' : ''}${pct}%`;
  }

  ago(at: number): string {
    const ms = Math.max(0, this.now - at);
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  trackListing = (_: number, l: MarketListing) => l.itemId;
  trackTrade = (_: number, t: TradeRecord) => t.id;
  trackEvent = (_: number, e: ActiveMarketEvent) => e.id + e.startsAt;
}

const FAILURE_COPY: Record<TradeFailure, string> = {
  ssr: 'The hall has not opened yet.',
  'unknown-good': 'No such line on the board.',
  'bad-quantity': 'Choose a quantity.',
  stale: 'The price moved before the order landed. The board is updated — try again.',
  'bag-full': 'No room in the bag.',
  funds: 'Not enough Gold.',
  'no-stock': 'You do not hold that many.',
  soulbound: 'That one is bound to you. It has no price here.',
  delivery: 'The bag filled before delivery. Your Gold was returned.',
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
