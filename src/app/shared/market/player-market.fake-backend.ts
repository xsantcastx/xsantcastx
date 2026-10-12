/**
 * player-market.fake-backend.ts — an in-memory player market for clicking
 * through the Exchange UX on `ng serve`, with no Firebase and no deploy.
 *
 * DEV ONLY. Selected by `PLAYER_MARKET_BACKEND` when `PLAYER_MARKET_MODE`
 * resolved to `fake`, which needs `isDevMode()` and `?market=fake…` in the URL.
 *
 * What it imitates, roughly as the server does (functions/src/market/):
 *   - a seeded book of "other players'" buys and sells on a dozen items
 *   - price-time matching, fills at the resting price, 2% seller tax rounded up
 *   - buy escrow and the refund of (limit − fill price), sells credited net
 *   - the sanity band (×4 around the reference, 0.1×–8× base worth)
 *   - the rate limit (12 trade actions a minute) and the 40-open-order cap
 *   - a bot that takes half of any order you leave resting, ~8 seconds later,
 *     so "Collect" has something to collect
 *   - `&fail=<reason>` refuses every placement with that reason's server copy
 *
 * What it does NOT do: touch your save. Nothing leaves the bag, no Gold moves,
 * and "Collect" delivers nothing — it only clears the fake escrow. Reload the
 * page to reset the whole market.
 */
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { EXCHANGE_CATALOGUE, goodById, type ExchangeGood } from '../exchange/exchange.model';
import type { MarketBackend, MarketCallable, MarketConfig } from './player-market.backend';
import { PLAYER_MARKET_MODE } from './player-market.mode';
import {
  MARKET_MAX_OPEN_ORDERS,
  type CollectResult,
  type MarketClaim,
  type MarketEscrow,
  type MarketOrder,
  type MarketPrice,
  type MarketTrade,
  type OrderSide,
  type PlaceOrderInput,
  type PlaceOrderResult,
  remainingQty,
  sellerTax,
} from './player-market.model';

/** The uid the fake treats as "you". */
export const FAKE_MARKET_UID = 'fake-you';

const HOUR = 3_600_000;
const LATENCY_MS = 350;
const BOT_FILL_MS = 8_000;
const RATE_PER_MINUTE = 12;

/** Server copy for `&fail=<reason>`, so the UI can be read against each one. */
const CANNED: Record<string, [code: string, message: string]> = {
  'price-band': ['failed-precondition', 'That price is out of range for this item right now. Try between 120 and 1,900 Gold.'],
  'rate-limited': ['resource-exhausted', 'Slow down a little — try again in 42 seconds.'],
  'not-owned': ['failed-precondition', "That item isn't in your cloud save. If you just got it, wait a few seconds for your save to sync and try again."],
  'not-enough': ['failed-precondition', 'Your cloud save holds 3 of that, not 10. If you just gathered more, wait a few seconds for your save to sync.'],
  'not-enough-gold': ['failed-precondition', 'You need 12,000 Gold in your cloud save for that.'],
  'market-closed': ['unavailable', "The player market isn't open yet."],
  'market-halted': ['unavailable', 'The market is paused for new orders. You can still cancel and collect.'],
  'collect-first': ['failed-precondition', 'Collect your market deliveries before placing new orders.'],
  'too-many-orders': ['resource-exhausted', 'You have 40 open orders. Cancel one or let it fill first.'],
  'already-listed': ['failed-precondition', "That exact item has already been on the market once and can't be listed again."],
  'in-use': ['failed-precondition', 'Unequip that item (and recall it from any expedition) before listing it.'],
  soulbound: ['failed-precondition', "Soulbound items can't be traded."],
  banned: ['permission-denied', "This account can't trade."],
  'save-syncing': ['failed-precondition', 'Your Gold ledger is mid-sync. Open the game for a few seconds, then try again.'],
};

/** Shaped like the SDK's FunctionsError, so `describeMarketError` reads it the same way. */
function refusal(code: string, message: string, reason?: string): Error {
  return Object.assign(new Error(message), {
    code: `functions/${code}`,
    details: reason ? { reason } : undefined,
  });
}

@Injectable({ providedIn: 'root' })
export class FakeMarketBackend implements MarketBackend {
  private readonly mode = inject(PLAYER_MARKET_MODE);

  private readonly orders = new Map<string, MarketOrder>();
  private readonly prices = new Map<string, MarketPrice>();
  private readonly trades: MarketTrade[] = [];
  private readonly escrow: MarketEscrow = { heldGold: 0, claimableGold: 0, claims: [], openOrders: 0, taxPaid: 0 };
  private readonly replays = new Map<string, PlaceOrderResult>();
  private readonly actions: number[] = [];
  private seq = 0;
  private readonly tick$ = new BehaviorSubject(0);

  constructor() {
    this.seed(Date.now());
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  watchConfig(): Observable<MarketConfig | null> {
    return this.read(() => ({ enabled: this.mode.scenario !== 'closed', haltNewOrders: false }));
  }

  watchBook(itemKey: string, side: OrderSide, limit: number): Observable<MarketOrder[]> {
    return this.read(() => this.open()
      .filter(o => o.itemKey === itemKey && o.side === side)
      .sort((a, b) => (side === 'sell' ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice) || a.createdAt - b.createdAt)
      .slice(0, limit));
  }

  watchPrice(itemKey: string): Observable<MarketPrice | null> {
    return this.read(() => this.prices.get(itemKey) ?? null);
  }

  watchTrades(itemKey: string, limit: number): Observable<MarketTrade[]> {
    return this.read(() => this.trades.filter(t => t.itemKey === itemKey).slice(0, limit));
  }

  watchMyOrders(uid: string, limit: number): Observable<MarketOrder[]> {
    return this.read(() => [...this.orders.values()]
      .filter(o => o.ownerUid === uid)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit));
  }

  watchEscrow(): Observable<MarketEscrow | null> {
    return this.read(() => ({
      ...this.escrow,
      claims: [...this.escrow.claims],
      openOrders: this.open().filter(o => o.ownerUid === FAKE_MARKET_UID).length,
    }));
  }

  watchOpenOrders(limit: number): Observable<MarketOrder[]> {
    return this.read(() => this.open().slice(0, limit));
  }

  watchPrices(limit: number): Observable<MarketPrice[]> {
    return this.read(() => [...this.prices.values()]
      .sort((a, b) => b.lastTradeAt - a.lastTradeAt)
      .slice(0, limit));
  }

  // ── Calls ──────────────────────────────────────────────────────────────────

  async call<T>(name: MarketCallable, data: unknown): Promise<T> {
    await new Promise(resolve => setTimeout(resolve, LATENCY_MS));
    if (this.mode.scenario === 'closed') {
      throw refusal('unavailable', "The player market isn't open yet.", 'market-closed');
    }
    if (this.mode.scenario === 'guest') throw refusal('unauthenticated', 'Sign in to trade.');
    let out: unknown;
    if (name === 'placeOrder') out = this.place(data as PlaceOrderInput & { clientRequestId?: string });
    else if (name === 'cancelOrder') out = this.cancel((data as { orderId?: string }).orderId ?? '');
    else out = this.collect();
    this.bump();
    return out as T;
  }

  private place(input: PlaceOrderInput & { clientRequestId?: string }): PlaceOrderResult {
    const replay = input.clientRequestId ? this.replays.get(input.clientRequestId) : undefined;
    if (replay) return { ...replay, replayed: true };

    const forced = this.mode.failReason;
    if (forced) {
      const [code, message] = CANNED[forced] ?? ['failed-precondition', 'The market refused that order.'];
      throw refusal(code, message, forced);
    }
    this.rateLimit();
    const good = goodById(input.itemKey);
    if (!good) throw refusal('invalid-argument', 'That item has no market.');
    const mine = this.open().filter(o => o.ownerUid === FAKE_MARKET_UID).length;
    if (mine >= MARKET_MAX_OPEN_ORDERS) {
      throw refusal('resource-exhausted', `You have ${MARKET_MAX_OPEN_ORDERS} open orders. Cancel one or let it fill first.`, 'too-many-orders');
    }
    const band = this.band(good);
    if (input.unitPrice < band.min || input.unitPrice > band.max) {
      throw refusal(
        'failed-precondition',
        `That price is out of range for this item right now. Try between ${band.min.toLocaleString('en-US')} and ${band.max.toLocaleString('en-US')} Gold.`,
        'price-band',
      );
    }

    const now = Date.now();
    const order: MarketOrder = {
      id: `fake-${++this.seq}`,
      side: input.side,
      itemKey: input.itemKey,
      kind: good.kind,
      qty: input.qty,
      filledQty: 0,
      unitPrice: input.unitPrice,
      ownerUid: FAKE_MARKET_UID,
      createdAt: now,
      updatedAt: now,
      status: 'open',
      clientRequestId: input.clientRequestId,
    };
    if (order.side === 'buy') this.escrow.heldGold += order.qty * order.unitPrice;

    const fills = this.match(order, good, now);
    this.orders.set(order.id, order);
    if (order.status === 'open') this.scheduleBotFill(order.id);

    const result: PlaceOrderResult = { order: { ...order }, fills, replayed: false };
    if (input.clientRequestId) this.replays.set(input.clientRequestId, result);
    return result;
  }

  private cancel(orderId: string): { order: MarketOrder } {
    this.rateLimit();
    const order = this.orders.get(orderId);
    if (!order || order.ownerUid !== FAKE_MARKET_UID) throw refusal('not-found', "That order isn't yours or no longer exists.");
    if (order.status !== 'open') throw refusal('failed-precondition', 'That order has already filled or been cancelled.', 'not-open');
    const left = remainingQty(order);
    if (order.side === 'buy') {
      const gold = left * order.unitPrice;
      this.escrow.heldGold -= gold;
      this.escrow.claimableGold += gold;
    } else if (left > 0) {
      this.claim(order.itemKey, left, 'cancel');
    }
    order.status = 'cancelled';
    order.updatedAt = Date.now();
    return { order: { ...order } };
  }

  private collect(): CollectResult {
    const gold = this.escrow.claimableGold;
    const delivered = this.escrow.claims.map(c => ({ itemKey: c.itemKey, qty: c.qty ?? 1, name: goodById(c.itemKey)?.name }));
    this.escrow.claimableGold = 0;
    this.escrow.claims = [];
    return { gold, delivered, pending: 0, bagFull: false };
  }

  // ── The engine, in miniature ───────────────────────────────────────────────

  private match(taker: MarketOrder, good: ExchangeGood, now: number): { qty: number; unitPrice: number }[] {
    const fills: { qty: number; unitPrice: number }[] = [];
    const opposite = this.open()
      .filter(o => o.itemKey === taker.itemKey && o.side !== taker.side && o.ownerUid !== taker.ownerUid)
      .sort((a, b) => (taker.side === 'buy' ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice) || a.createdAt - b.createdAt);
    for (const maker of opposite) {
      const left = remainingQty(taker);
      if (left <= 0) break;
      const crosses = taker.side === 'buy' ? maker.unitPrice <= taker.unitPrice : maker.unitPrice >= taker.unitPrice;
      if (!crosses) break;
      const qty = Math.min(left, remainingQty(maker));
      this.settle(taker.side === 'buy' ? taker : maker, taker.side === 'buy' ? maker : taker, qty, maker.unitPrice, now, good);
      fills.push({ qty, unitPrice: maker.unitPrice });
    }
    return fills;
  }

  /** One trade. Only "your" side moves escrow; the bots have bottomless pockets. */
  private settle(buy: MarketOrder, sell: MarketOrder, qty: number, price: number, now: number, good: ExchangeGood): void {
    for (const o of [buy, sell]) {
      o.filledQty += qty;
      o.updatedAt = now;
      if (remainingQty(o) <= 0) o.status = 'filled';
    }
    const gross = qty * price;
    const tax = sellerTax(gross);
    if (buy.ownerUid === FAKE_MARKET_UID) {
      this.escrow.heldGold -= qty * buy.unitPrice;
      this.escrow.claimableGold += (buy.unitPrice - price) * qty;
      this.claim(buy.itemKey, qty, 'fill');
    }
    if (sell.ownerUid === FAKE_MARKET_UID) {
      this.escrow.claimableGold += gross - tax;
      this.escrow.taxPaid += tax;
    }
    this.trades.unshift({
      id: `fake-trade-${++this.seq}`,
      itemKey: buy.itemKey,
      qty,
      unitPrice: price,
      tax,
      buyOrderId: buy.id,
      sellOrderId: sell.id,
      buyerUid: buy.ownerUid,
      sellerUid: sell.ownerUid,
      maker: buy.createdAt < sell.createdAt ? 'buy' : 'sell',
      executedAt: now,
    });
    this.print(good, qty, price, now);
  }

  private claim(itemKey: string, qty: number, reason: MarketClaim['reason']): void {
    const kind = itemKey.startsWith('eq:') ? 'instance' : 'stack';
    this.escrow.claims.push({
      id: `fake-claim-${++this.seq}`,
      kind,
      itemKey,
      reason,
      at: Date.now(),
      qty,
      stackKey: kind === 'stack' ? itemKey.slice(4) : undefined,
    });
  }

  private print(good: ExchangeGood, qty: number, price: number, now: number): void {
    const p = this.prices.get(good.id) ?? this.blankPrice(good.id, now);
    const notional = p.vwap24h * p.volume24h + price * qty;
    p.volume24h += qty;
    p.trades24h += 1;
    p.vwap24h = Math.round(notional / p.volume24h);
    p.lastPrice = price;
    p.lastTradeAt = now;
    p.updatedAt = now;
    const hour = Math.floor(now / HOUR) * HOUR;
    let bucket = p.buckets[p.buckets.length - 1];
    if (!bucket || bucket.hour !== hour) {
      bucket = { hour, volume: 0, notional: 0, trades: 0, high: price, low: price, close: price };
      p.buckets.push(bucket);
    }
    bucket.volume += qty;
    bucket.notional += price * qty;
    bucket.trades += 1;
    bucket.high = Math.max(bucket.high, price);
    bucket.low = Math.min(bucket.low, price);
    bucket.close = price;
    this.prices.set(good.id, p);
  }

  /** Same shape as functions/src/market/pricing.ts `checkBand`. */
  private band(good: ExchangeGood): { min: number; max: number } {
    const p = this.prices.get(good.id);
    const ref = p && p.trades24h >= 3 && p.vwap24h > 0 ? p.vwap24h : p?.lastPrice || good.basePrice;
    const min = Math.max(1, Math.ceil(Math.max(ref / 4, good.basePrice * 0.1)));
    const max = Math.floor(Math.min(ref * 4, good.basePrice * 8));
    return { min, max: Math.max(min, max) };
  }

  private rateLimit(): void {
    const now = Date.now();
    while (this.actions.length && now - this.actions[0] > 60_000) this.actions.shift();
    if (this.actions.length >= RATE_PER_MINUTE) {
      const secs = Math.max(1, Math.ceil((60_000 - (now - this.actions[0])) / 1000));
      throw refusal('resource-exhausted', `Slow down a little — try again in ${secs} second${secs === 1 ? '' : 's'}.`, 'rate-limited');
    }
    this.actions.push(now);
  }

  /** Another "player" takes half of what you left resting. */
  private scheduleBotFill(orderId: string): void {
    setTimeout(() => {
      const order = this.orders.get(orderId);
      const good = order && goodById(order.itemKey);
      if (!order || !good || order.status !== 'open') return;
      const qty = Math.max(1, Math.ceil(remainingQty(order) / 2));
      const now = Date.now();
      const bot: MarketOrder = {
        ...order,
        id: `fake-bot-${++this.seq}`,
        side: order.side === 'buy' ? 'sell' : 'buy',
        qty,
        filledQty: 0,
        ownerUid: 'fake-bot',
        createdAt: now,
        updatedAt: now,
        clientRequestId: undefined,
      };
      this.orders.set(bot.id, bot);
      if (order.side === 'buy') this.settle(order, bot, qty, order.unitPrice, now, good);
      else this.settle(bot, order, qty, order.unitPrice, now, good);
      this.bump();
    }, BOT_FILL_MS);
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private open(): MarketOrder[] {
    return [...this.orders.values()].filter(o => o.status === 'open' && remainingQty(o) > 0);
  }

  private read<T>(project: () => T): Observable<T> {
    return this.tick$.pipe(map(() => project()));
  }

  private bump(): void {
    this.tick$.next(this.tick$.value + 1);
  }

  private blankPrice(itemKey: string, now: number): MarketPrice {
    return { itemKey, lastPrice: 0, lastTradeAt: 0, volume24h: 0, vwap24h: 0, trades24h: 0, buckets: [], updatedAt: now };
  }

  /**
   * A dozen markets: the cheapest few materials and a few pieces of equipment,
   * each with a small ladder of bot bids and asks around its base worth, and a
   * day of trades so the list has 24h prices and volumes to show.
   */
  private seed(now: number): void {
    const materials = EXCHANGE_CATALOGUE.filter(g => g.kind === 'material').slice(0, 8);
    const equipment = EXCHANGE_CATALOGUE.filter(g => g.kind === 'equipment' && (g.rarity === 'common' || g.rarity === 'rare')).slice(0, 4);
    let n = 0;
    for (const good of [...materials, ...equipment]) {
      n++;
      const depth = good.kind === 'equipment' ? 1 : 40;
      for (let i = 0; i < 4; i++) {
        const t = now - (i + 1) * 7 * 60_000;
        this.addBot(good, 'sell', Math.round(good.basePrice * (1.03 + i * 0.04)), depth + i * (depth > 1 ? 15 : 0), t);
        this.addBot(good, 'buy', Math.max(1, Math.round(good.basePrice * (0.97 - i * 0.04))), depth + i * (depth > 1 ? 10 : 0), t);
      }
      if (n % 3 !== 0) {
        for (let h = 20; h >= 1; h -= 3) {
          const drift = 1 + Math.sin(n + h) * 0.05;
          this.print(good, depth > 1 ? 10 + (h % 7) * 5 : 1, Math.max(1, Math.round(good.basePrice * drift)), now - h * HOUR);
        }
      }
    }
  }

  private addBot(good: ExchangeGood, side: OrderSide, unitPrice: number, qty: number, at: number): void {
    const id = `fake-seed-${++this.seq}`;
    this.orders.set(id, {
      id, side, itemKey: good.id, kind: good.kind, qty, filledQty: 0, unitPrice,
      ownerUid: `fake-player-${this.seq % 5}`, createdAt: at, updatedAt: at, status: 'open',
    });
  }
}
