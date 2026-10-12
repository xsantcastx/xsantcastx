/**
 * player-exchange.component.ts — the Grand Exchange when players run it.
 *
 * Rendered by ExchangeComponent in place of the simulated board only when
 * `PLAYER_MARKET_MODE` is `live` (client flag on) or `fake` (dev only,
 * `?market=fake`). It is a `@defer` there, so none of this — nor the market
 * service, nor its backends — is fetched while the flag is off.
 *
 * Same station-kit journal as the simulated Exchange, so the two read alike:
 *   Buy   — items players are selling; price defaults to the cheapest seller.
 *   Sell  — what you carry; price defaults to the dearest buyer.
 *   Your orders — open and finished orders, with Cancel.
 * A Collect bar appears above the journal whenever escrow holds Gold or items.
 *
 * Every number on screen comes from `player-exchange.model.ts` (specced), and
 * every refusal goes through `marketErrorCopy` into one plain sentence.
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
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subscription, combineLatest, of, switchMap } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { InventoryService, MAX_INVENTORY } from '../rpg/inventory.service';
import { TranslationService } from '../../translation.service';
import { injectInWorldPanel } from '../in-world-panel';
import { artFor } from '../art/art';
import {
  STATION_UI,
  STATION_UI_I18N,
  type JournalRow,
  type StationArt,
  type StationCost,
  type StationReward,
  type StationTab,
} from '../station-ui';
import { RUNE_TIERS, type RuneTier } from '../rune-forge/rune.model';
import type { ItemRarity } from '../rpg/item.model';
import { ExchangeService } from './exchange.service';
import { EXCHANGE_CATALOGUE, goodById, type ExchangeGood } from './exchange.model';
import { PlayerMarketService } from '../market/player-market.service';
import {
  MARKET_TAX_RATE,
  remainingQty,
  type BookLevel,
  type MarketAccess,
  type MarketBoardRow,
  type MarketEscrow,
  type MarketOrder,
  type MarketPrice,
  type MarketTrade,
  type OrderBook,
  type OrderSide,
} from '../market/player-market.model';
import {
  bookDepth,
  buyReceipt,
  defaultPrice,
  marketErrorCopy,
  maxTradeQty,
  sellReceipt,
} from './player-exchange.model';
import { PLAYER_EXCHANGE_I18N } from './player-exchange.i18n';

type Tab = 'buy' | 'sell' | 'orders';

@Component({
  selector: 'app-player-exchange',
  standalone: true,
  imports: [...STATION_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-exchange.component.html',
  styleUrls: ['./player-exchange.component.css'],
})
export class PlayerExchangeComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly market = inject(PlayerMarketService);
  private readonly exchange = inject(ExchangeService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  protected readonly inWorld = injectInWorldPanel();

  readonly taxPct = Math.round(MARKET_TAX_RATE * 100);
  readonly bagCap = MAX_INVENTORY;
  readonly stripArt: StationArt | null = artFor('unique-merchants-scale');
  readonly fake = this.market.isFake;

  tab: Tab = 'buy';
  tabs: StationTab[] = [];
  access: MarketAccess | null = null;
  board: MarketBoardRow[] = [];
  rows: JournalRow[] = [];
  gold = 0;
  bagUsed = 0;
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };

  // ── The selected item ──────────────────────────────────────────────────────
  selected: ExchangeGood | null = null;
  selectedArt: StationArt | null = null;
  private readonly selected$ = new BehaviorSubject<string | null>(null);
  book: OrderBook | null = null;
  price: MarketPrice | null = null;
  trades: MarketTrade[] = [];
  depth: { asks: BookLevel[]; bids: BookLevel[] } = { asks: [], bids: [] };
  unitPrice = 0;
  /** Set once the player types a price; until then it follows the book. */
  private priceTouched = false;
  quantity = 1;
  maxCount = 0;
  unitCosts: StationCost[] = [];
  blocked: string | null = null;
  feeLine = '';
  fillLine = '';
  statsLine = '';

  // ── Orders and escrow ──────────────────────────────────────────────────────
  myOrders: MarketOrder[] = [];
  escrow: MarketEscrow | null = null;
  collectLine = '';
  placing = false;
  collecting = false;
  cancelling = new Set<string>();

  notice: { tone: 'ok' | 'bad'; text: string } | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  reward: StationReward | null = null;
  private rewardSeq = 0;
  announce = '';
  detailsOpen = false;

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(PLAYER_EXCHANGE_I18N);
    this.buildTabs();
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.inventory.init();

    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.gold = s.gold;
      this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: s.gold, have: s.gold };
      this.refresh();
    }));
    this.subs.add(this.inventory.snapshot$.subscribe(s => {
      this.bagUsed = s.usedRows;
      this.refresh();
    }));
    this.subs.add(this.market.access$.subscribe(a => {
      this.access = a;
      this.refresh();
    }));
    this.subs.add(this.market.board$.subscribe(b => {
      this.board = b;
      this.refresh();
    }));
    this.subs.add(this.market.myOrders$.subscribe(o => {
      this.myOrders = o;
      this.buildTabs();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.market.escrow$.subscribe(e => {
      this.escrow = e;
      this.buildCollectLine();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.selected$.pipe(
      switchMap(key => key
        ? combineLatest([this.market.book$(key), this.market.price$(key), this.market.trades$(key, 10)])
        : of([null, null, []] as [OrderBook | null, MarketPrice | null, MarketTrade[]])),
    ).subscribe(([book, price, trades]) => {
      this.book = book;
      this.price = price;
      this.trades = trades;
      this.depth = bookDepth(book);
      this.rebuildTrade();
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Deriving the page
  // ───────────────────────────────────────────────────────────────────────────

  get signedOut(): boolean { return this.access?.state === 'signed-out'; }
  get closedReason(): string | null {
    return this.access?.state === 'closed' ? this.t('pmx.err.closed') : null;
  }

  private buildTabs(): void {
    const open = this.myOrders.filter(o => o.status === 'open').length;
    this.tabs = [
      { id: 'buy', label: this.t('pmx.tab.buy') },
      { id: 'sell', label: this.t('pmx.tab.sell') },
      { id: 'orders', label: this.t('pmx.tab.orders'), badge: open || undefined },
    ];
  }

  private buildCollectLine(): void {
    const e = this.escrow;
    const items = (e?.claims ?? []).reduce((n, c) => n + (c.qty ?? 1), 0);
    this.collectLine = e && (e.claimableGold > 0 || items > 0)
      ? this.t('pmx.collect.waiting', { gold: fmt(e.claimableGold), items: fmt(items) })
      : '';
  }

  private held(good: ExchangeGood): number {
    return this.exchange.holdings(good);
  }

  /** Rebuild the list for the current tab and keep a pressable selection. */
  private refresh(): void {
    if (this.tab === 'buy') {
      this.rows = this.board.flatMap(r => {
        const good = goodById(r.itemKey);
        if (!good) return [];
        const sub = r.bestAsk !== null
          ? this.t('pmx.row.from', { n: fmt(r.bestAsk) })
          : this.t('pmx.row.noSellers', { n: fmt(r.bestBid ?? 0) });
        return [{
          id: good.id,
          name: good.name,
          art: good.art ? { src: good.art } : null,
          rarity: good.rarity,
          sub,
          ready: r.bestAsk !== null && r.bestAsk <= this.gold,
          locked: r.bestAsk === null,
        }];
      });
    } else if (this.tab === 'sell') {
      const bids = new Map(this.board.map(r => [r.itemKey, r.bestBid]));
      this.rows = EXCHANGE_CATALOGUE
        .map(good => ({ good, held: this.held(good), bid: bids.get(good.id) ?? null }))
        .filter(x => x.held > 0)
        .sort((a, b) => Number(b.bid !== null) - Number(a.bid !== null) || a.good.name.localeCompare(b.good.name))
        .map(({ good, held, bid }) => ({
          id: good.id,
          name: good.name,
          art: good.art ? { src: good.art } : null,
          rarity: good.rarity,
          sub: bid !== null
            ? this.t('pmx.row.youHaveOffer', { n: fmt(held), p: fmt(bid) })
            : this.t('pmx.row.youHave', { n: fmt(held) }),
          ready: bid !== null,
        }));
    } else {
      this.rows = [];
    }

    if (this.tab !== 'orders' && (!this.selected || !this.rows.some(r => r.id === this.selected!.id))) {
      const first = this.rows.find(r => r.ready) ?? this.rows[0];
      this.select(first ? goodById(first.id) ?? null : null);
    }
    this.rebuildTrade();
    this.cdr.markForCheck();
  }

  private select(good: ExchangeGood | null): void {
    const changed = good?.id !== this.selected?.id;
    this.selected = good;
    this.selectedArt = good?.art ? { src: good.art } : null;
    if (changed) {
      this.quantity = 1;
      this.priceTouched = false;
      this.book = null;
      this.price = null;
      this.trades = [];
      this.depth = { asks: [], bids: [] };
      this.selected$.next(good?.id ?? null);
    }
  }

  private get side(): OrderSide {
    return this.tab === 'sell' ? 'sell' : 'buy';
  }

  /** Price box, Max, the action row's costs and blockers, and the fee line. */
  private rebuildTrade(): void {
    const good = this.selected;
    if (!good || this.tab === 'orders') {
      this.unitCosts = [];
      this.blocked = null;
      this.maxCount = 0;
      this.feeLine = this.fillLine = this.statsLine = '';
      return;
    }
    const side = this.side;
    if (!this.priceTouched) this.unitPrice = defaultPrice(side, this.book, this.price, good.basePrice);
    const held = this.held(good);
    const max = maxTradeQty(side, good.kind, { gold: this.gold, unitPrice: this.unitPrice, held });
    this.maxCount = max >= 2 ? max : 0;

    this.unitCosts = side === 'buy'
      ? [{ kind: 'gold', label: this.t('stationUi.gold'), need: this.unitPrice, have: this.gold }]
      : [{
          kind: good.kind === 'material' ? 'material' : 'item',
          id: good.stackKey ?? good.definitionId,
          label: good.name,
          need: 1,
          have: held,
          art: this.selectedArt,
        }];

    this.blocked = this.blocker(held);

    if (side === 'buy') {
      const r = buyReceipt(this.unitPrice, this.quantity, this.book?.bestAsk ?? null);
      this.feeLine = this.t('pmx.fee.buy', { total: fmt(r.total) });
      this.fillLine = this.t(r.fillsNow ? 'pmx.fill.buyNow' : 'pmx.fill.buyWait');
    } else {
      const r = sellReceipt(this.unitPrice, this.quantity, this.book?.bestBid ?? null);
      this.feeLine = this.t('pmx.fee.sell', { pct: this.taxPct, net: fmt(r.net) });
      this.fillLine = this.t(r.fillsNow ? 'pmx.fill.sellNow' : 'pmx.fill.sellWait');
    }
    const p = this.price;
    this.statsLine = p && p.lastPrice > 0 && p.volume24h > 0
      ? this.t('pmx.stats', { p: fmt(p.lastPrice), v: fmt(p.volume24h) })
      : this.t('pmx.statsNone');
  }

  /** A reason that is not money (the action button works out Gold itself). */
  private blocker(held: number): string | null {
    const a = this.access;
    if (!a) return this.t('pmx.loading');
    if (a.state === 'closed') return this.t('pmx.err.closed');
    if (a.state === 'signed-out') return this.t('pmx.err.signedOut');
    if (a.state === 'ready' && a.haltNewOrders) return this.t('pmx.block.halted');
    if (!(this.unitPrice >= 1)) return this.t('pmx.block.price');
    if (this.side === 'sell') {
      if (held <= 0) return this.t('pmx.block.noneHeld');
      if (this.quantity > held) return this.t('pmx.block.tooMany', { n: fmt(held) });
    }
    return null;
  }

  get tradeLine(): string {
    if (!this.selected) return '';
    return this.t(this.side === 'buy' ? 'pmx.line.buy' : 'pmx.line.sell', { n: fmt(this.quantity), name: this.selected.name });
  }

  get stepMax(): number {
    if (!this.selected) return 1;
    return Math.max(1, maxTradeQty(this.side, this.selected.kind, { gold: Number.MAX_SAFE_INTEGER, unitPrice: 1, held: this.held(this.selected) }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Input
  // ───────────────────────────────────────────────────────────────────────────

  setTab(id: string): void {
    this.tab = id === 'sell' || id === 'orders' ? id : 'buy';
    this.notice = null;
    this.priceTouched = false;
    this.quantity = 1;
    this.refresh();
  }

  pick(id: string): void {
    this.select(goodById(id) ?? null);
    this.rebuildTrade();
    this.cdr.markForCheck();
  }

  setQuantity(value: number): void {
    const n = Math.floor(Number(value));
    this.quantity = Number.isFinite(n) && n > 0 ? Math.min(this.stepMax, n) : 1;
    this.rebuildTrade();
    this.cdr.markForCheck();
  }

  onPriceInput(value: string): void {
    const n = Math.floor(Number(value));
    this.unitPrice = Number.isFinite(n) && n > 0 ? n : 0;
    this.priceTouched = true;
    this.rebuildTrade();
    this.cdr.markForCheck();
  }

  useBestPrice(): void {
    this.priceTouched = false;
    this.rebuildTrade();
    this.cdr.markForCheck();
  }

  usePrice(level: BookLevel): void {
    this.unitPrice = level.unitPrice;
    this.priceTouched = true;
    this.rebuildTrade();
    this.cdr.markForCheck();
  }

  async signIn(): Promise<void> {
    await this.market.signIn();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Calls
  // ───────────────────────────────────────────────────────────────────────────

  async trade(quantity: number): Promise<void> {
    const good = this.selected;
    if (!good || this.placing) return;
    this.setQuantity(quantity);
    if (this.blocked) return;
    const side = this.side;
    const instanceId = side === 'sell' && good.kind === 'equipment'
      ? this.exchange.sellableInstances(good)[0]?.id
      : undefined;
    this.placing = true;
    this.cdr.markForCheck();
    const res = await this.market.placeOrder({
      side, itemKey: good.id, qty: this.quantity, unitPrice: this.unitPrice, instanceId,
    });
    this.placing = false;
    if (res.ok) {
      const filled = res.value.fills.reduce((n, f) => n + f.qty, 0);
      const text = filled >= res.value.order.qty
        ? this.t('pmx.done.filled')
        : filled > 0 ? this.t('pmx.done.partial', { n: fmt(filled) }) : this.t('pmx.done.resting');
      this.say('ok', text);
      if (filled > 0 && side === 'buy') {
        this.reward = {
          seq: ++this.rewardSeq,
          name: filled > 1 ? `${filled} × ${good.name}` : good.name,
          art: this.selectedArt,
          rarity: good.rarity,
          rarityLabel: RUNE_TIERS[good.rarity as RuneTier]?.label ?? good.rarity,
          caption: this.t('pmx.collect.go'),
        };
      }
      this.quantity = 1;
      this.priceTouched = false;
    } else {
      this.say('bad', this.errorText(res.reason, res.error));
    }
    this.rebuildTrade();
    this.cdr.markForCheck();
  }

  async cancel(order: MarketOrder): Promise<void> {
    if (this.cancelling.has(order.id)) return;
    this.cancelling.add(order.id);
    this.cdr.markForCheck();
    const res = await this.market.cancelOrder(order.id);
    this.cancelling.delete(order.id);
    this.say(res.ok ? 'ok' : 'bad', res.ok ? this.t('pmx.done.cancelled') : this.errorText(res.reason, res.error));
    this.cdr.markForCheck();
  }

  async collect(): Promise<void> {
    if (this.collecting) return;
    this.collecting = true;
    this.cdr.markForCheck();
    const res = await this.market.collect();
    this.collecting = false;
    if (res.ok) {
      const items = res.value.delivered.reduce((n, d) => n + d.qty, 0);
      this.say('ok', res.value.bagFull
        ? this.t('pmx.collect.bagFull')
        : this.t('pmx.collect.done', { gold: fmt(res.value.gold), items: fmt(items) }));
    } else {
      this.say('bad', this.errorText(res.reason, res.error));
    }
    this.cdr.markForCheck();
  }

  private errorText(reason: string, message: string): string {
    const copy = marketErrorCopy(reason, message);
    return 'text' in copy ? copy.text : this.t(copy.key, copy.vars);
  }

  private say(tone: 'ok' | 'bad', text: string): void {
    this.notice = { tone, text };
    this.announce = text;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.notice = null;
      this.cdr.markForCheck();
    }, 8_000);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Painting
  // ───────────────────────────────────────────────────────────────────────────

  gold_(n: number): string { return fmt(n); }

  orderName(o: MarketOrder): string {
    return goodById(o.itemKey)?.name ?? o.itemKey;
  }

  orderRarity(o: MarketOrder): ItemRarity | null {
    return goodById(o.itemKey)?.rarity ?? null;
  }

  orderLine(o: MarketOrder): string {
    return this.t('pmx.orders.line', { done: fmt(o.qty - remainingQty(o)), qty: fmt(o.qty), p: fmt(o.unitPrice) });
  }

  statusLabel(o: MarketOrder): string {
    return this.t(o.status === 'open' ? 'pmx.orders.open' : o.status === 'filled' ? 'pmx.orders.filled' : 'pmx.orders.cancelled');
  }
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
