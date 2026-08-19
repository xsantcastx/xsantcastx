/**
 * exchange.service.ts — the counter, the tax, and the only place a trade lands.
 *
 * `exchange.model.ts` decides what a thing is worth and stays pure. This is the
 * half that touches the world: it debits and credits Gold through
 * `EconomyService`, moves stock through `InventoryService` — still the only
 * writer of instances and stacks — and persists the player's own footprint on
 * the market.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ORDER OF OPERATIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * A trade touches two ledgers that fail independently, and only one ordering
 * costs the player nothing when the second one refuses:
 *
 * On a buy:
 *   1. Re-quote against the clock *now*, not against the price the row was
 *      rendered with. A player who left the tab open over lunch must not be
 *      able to buy at a stale price, and must not be charged more than the
 *      confirmation they just read — so a moved price is refused as `stale`
 *      rather than silently repriced.
 *   2. Check the bag has room. Debiting and then discovering there is nowhere
 *      to put the goods takes the money and hands back nothing.
 *   3. Debit Gold. If this fails nothing else has happened.
 *   4. Deliver. If delivery is refused after the debit — which needs the bag to
 *      fill between steps 2 and 4, so effectively never — the Gold is refunded
 *      rather than swallowed. A refund is right even when the race is
 *      impossible, because the alternative is a silent theft nobody can
 *      reproduce.
 *
 * On a sale the goods move *first*, because the failure that matters is the
 * reverse one: crediting Gold and then failing to take the item is duplication,
 * and duplication is worse than a refund. `earnGold` cannot fail.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY SELLING DOES NOT GO THROUGH InventoryService.sell
 * ─────────────────────────────────────────────────────────────────────────────
 * `sell()` pays `item.sellValue` — the number frozen onto the instance when it
 * was minted. That is exactly right at the Gambler's till, where the point is
 * that a well-rolled item is worth more than a badly-rolled one. It is exactly
 * wrong here, where the whole feature is that the price moved since you found
 * it. So a sale on this page is `drop` plus `earnGold` at the market price, and
 * the guards `sell()` enforces are re-stated rather than inherited:
 * `canDrop` already refuses an equipped or explorer-held item, and soulbound is
 * checked here because a dropped soulbound item would otherwise be destroyed
 * for Gold it is not allowed to be worth.
 *
 * Browser-only. Every mutation no-ops on the SSR path, like its neighbours.
 */
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject, type Observable } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { InventoryService, MAX_INVENTORY } from '../rpg/inventory.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { mintEquipment } from '../rpg/item-definition';
import type { GameItem } from '../rpg/item.model';
import {
  EXCHANGE_CATALOGUE,
  applyPressure,
  goodById,
  listingFor,
  priceAt,
  quoteBuy,
  quoteSell,
  type ExchangeGood,
  type MarketListing,
  type Pressure,
  type Quote,
} from './exchange.model';

export const EXCHANGE_KEY = 'godforge-exchange';
const SCHEMA_VERSION = 1;

/** How many completed trades the ticker remembers. */
const TRADE_LOG_LIMIT = 40;

export interface TradeRecord {
  id: string;
  goodId: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: number;
  unitPrice: number;
  /** Gold paid on a buy, Gold received on a sale — after tax either way. */
  net: number;
  tax: number;
  at: number;
}

interface ExchangeRecord {
  version: number;
  pressure: Record<string, Pressure>;
  trades: TradeRecord[];
  /** The UTC day `spent` and `earned` are counting. */
  day: string;
  spent: number;
  earned: number;
  taxPaid: number;
}

function emptyRecord(): ExchangeRecord {
  return {
    version: SCHEMA_VERSION,
    pressure: {},
    trades: [],
    day: '',
    spent: 0,
    earned: 0,
    taxPaid: 0,
  };
}

export interface ExchangeSnapshot {
  trades: readonly TradeRecord[];
  spentToday: number;
  earnedToday: number;
  taxPaidToday: number;
  /** Lines the player's own trading is currently holding off base. */
  movedGoodIds: readonly string[];
}

export type TradeFailure =
  | 'ssr'
  | 'unknown-good'
  | 'bad-quantity'
  | 'stale'
  | 'bag-full'
  | 'funds'
  | 'no-stock'
  | 'soulbound'
  | 'delivery';

export type TradeResult =
  | { ok: true; trade: TradeRecord }
  | { ok: false; code: TradeFailure };

function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class ExchangeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);

  private record: ExchangeRecord = emptyRecord();
  private loaded = false;

  private readonly snapshot$$ = new BehaviorSubject<ExchangeSnapshot>({
    trades: [], spentToday: 0, earnedToday: 0, taxPaidToday: 0, movedGoodIds: [],
  });
  private readonly traded$$ = new Subject<TradeRecord>();

  /** Counters and the ticker, replayed to late subscribers. */
  readonly snapshot$: Observable<ExchangeSnapshot> = this.snapshot$$.asObservable();
  /** One event per settled trade. Not replayed — it drives the flash. */
  readonly traded$: Observable<TradeRecord> = this.traded$$.asObservable();

  get snapshot(): ExchangeSnapshot { return this.snapshot$$.value; }

  readonly catalogue = EXCHANGE_CATALOGUE;

  /** Read the record and publish it once. Idempotent. */
  init(): void {
    if (!this.isBrowser) return;
    this.load();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  pressureFor(goodId: string): Pressure | undefined {
    return this.load().pressure[goodId];
  }

  /** The live price for one good, with the player's footprint folded in. */
  price(good: ExchangeGood, now: number): number {
    return priceAt(good, now, this.pressureFor(good.id));
  }

  /** Every row, priced at `now`. */
  listings(now: number): MarketListing[] {
    const pressure = this.load().pressure;
    return EXCHANGE_CATALOGUE.map(good => listingFor(good, now, pressure[good.id]));
  }

  /**
   * How many of this good the player is holding.
   *
   * Materials read the stack ledger. Equipment counts loose instances that
   * could actually be sold — a worn helm is not stock, and neither is one on an
   * explorer, so neither is offered for sale.
   */
  holdings(good: ExchangeGood): number {
    if (!this.isBrowser) return 0;
    if (good.kind === 'material') {
      return good.stackKey ? this.inventory.stackOf(good.stackKey) : 0;
    }
    return this.sellableInstances(good).length;
  }

  /** The loose instances of a good, oldest first — the order a sale consumes. */
  sellableInstances(good: ExchangeGood): GameItem[] {
    if (!this.isBrowser || good.kind !== 'equipment') return [];
    return this.inventory.snapshot.items
      .filter(item =>
        item.definitionId === good.definitionId &&
        item.rarity === good.rarity &&
        !item.soulbound &&
        this.inventory.canDrop(item))
      .sort((a, b) => a.foundAt.localeCompare(b.foundAt));
  }

  previewBuy(good: ExchangeGood, quantity: number, now: number): Quote {
    return quoteBuy(this.price(good, now), quantity);
  }

  previewSell(good: ExchangeGood, quantity: number, now: number): Quote {
    return quoteSell(this.price(good, now), quantity);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The trades
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Buy `quantity` units. See the header for why the steps are in this order.
   *
   * `expectedUnitPrice` is the price the player was shown. A trade is refused
   * as `stale` when the live price has moved past `PRICE_TOLERANCE` against
   * them; a move in their favour settles at the better price, because refusing
   * that would be a worse surprise than granting it.
   */
  buy(
    goodId: string,
    quantity: number,
    expectedUnitPrice: number,
    now = Date.now(),
    rng: () => number = Math.random,
  ): TradeResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };

    const good = goodById(goodId);
    if (!good) return { ok: false, code: 'unknown-good' };

    const qty = Math.floor(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, code: 'bad-quantity' };

    const unitPrice = this.price(good, now);
    if (!withinTolerance(unitPrice, expectedUnitPrice)) return { ok: false, code: 'stale' };

    if (!this.hasRoomFor(good, qty)) return { ok: false, code: 'bag-full' };

    const quote = quoteBuy(unitPrice, qty);
    if (!this.economy.spendGold(quote.net, 'grand-exchange')) return { ok: false, code: 'funds' };

    if (!this.deliver(good, qty, now, rng)) {
      // The bag filled between the check and the delivery. Effectively
      // unreachable; refunded rather than swallowed regardless.
      this.economy.earnGold(quote.net, 'grand-exchange-refund');
      return { ok: false, code: 'delivery' };
    }

    return { ok: true, trade: this.settle(good, 'buy', quote, now) };
  }

  /**
   * Sell `quantity` units at the market price, less the house's cut.
   *
   * The goods move before the Gold, which is the opposite of `buy` and for the
   * reason in the header: a failure after the credit would be duplication.
   */
  sell(
    goodId: string,
    quantity: number,
    expectedUnitPrice: number,
    now = Date.now(),
  ): TradeResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };

    const good = goodById(goodId);
    if (!good) return { ok: false, code: 'unknown-good' };

    const qty = Math.floor(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, code: 'bad-quantity' };
    if (this.holdings(good) < qty) return { ok: false, code: 'no-stock' };

    const unitPrice = this.price(good, now);
    if (!withinTolerance(unitPrice, expectedUnitPrice)) return { ok: false, code: 'stale' };

    const taken = this.take(good, qty);
    if (taken <= 0) return { ok: false, code: 'no-stock' };

    // A partial take is settled for what actually moved rather than rolled
    // back: the units are already gone, and paying for fewer of them is the
    // only outcome that is not either theft or duplication.
    const quote = quoteSell(unitPrice, taken);
    this.economy.earnGold(quote.net, 'grand-exchange');

    return { ok: true, trade: this.settle(good, 'sell', quote, now) };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Moving stock
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Whether the bag can take a purchase.
   *
   * A material the player already holds needs no new row, so topping up a stack
   * is allowed at the 250-row cap; a new stack, or any instance, is not.
   */
  private hasRoomFor(good: ExchangeGood, quantity: number): boolean {
    if (good.kind === 'material') {
      return good.stackKey ? this.inventory.canAcceptStackGrant(good.stackKey) : false;
    }
    // Instances take one row each and there is no partial purchase, so the
    // whole order has to fit before any of it is paid for. `usedRows` counts
    // stacks as well as instances, which is the number the cap is actually
    // enforced against.
    return MAX_INVENTORY - this.inventory.snapshot.usedRows >= quantity;
  }

  private deliver(
    good: ExchangeGood,
    quantity: number,
    now: number,
    rng: () => number,
  ): boolean {
    if (good.kind === 'material') {
      if (!good.stackKey) return false;
      // The grant id carries the good, the moment and the size, so a double
      // submit of the same click is idempotent at the ledger while a genuine
      // second purchase a millisecond later is not.
      const grantId = `ge:${good.id}:${now}:${quantity}`;
      return this.inventory.grantStack(grantId, good.stackKey, quantity);
    }

    if (!good.definitionId) return false;
    let delivered = 0;
    for (let i = 0; i < quantity; i++) {
      const minted = mintEquipment(good.definitionId, good.rarity, rng);
      if (!minted || !this.inventory.add(minted)) break;
      delivered++;
    }
    return delivered === quantity;
  }

  /** Take stock off the player. Returns how many units actually moved. */
  private take(good: ExchangeGood, quantity: number): number {
    if (good.kind === 'material') {
      if (!good.stackKey) return 0;
      return this.inventory.dropStack(good.stackKey, quantity) ? quantity : 0;
    }
    const stock = this.sellableInstances(good).slice(0, quantity);
    let taken = 0;
    for (const item of stock) {
      if (this.inventory.drop(item.id)) taken++;
    }
    return taken;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Settlement
  // ───────────────────────────────────────────────────────────────────────────

  /** Record the trade, move the price, persist, publish. */
  private settle(
    good: ExchangeGood,
    side: 'buy' | 'sell',
    quote: Quote,
    now: number,
  ): TradeRecord {
    const record = this.load();

    // Buying takes stock off the shelf and lifts the price; selling floods it
    // and drops it. The sign is the whole of the supply-and-demand mechanic.
    const units = side === 'buy' ? quote.quantity : -quote.quantity;
    record.pressure[good.id] = applyPressure(record.pressure[good.id], units, now);

    const today = utcDay(now);
    if (record.day !== today) {
      record.day = today;
      record.spent = 0;
      record.earned = 0;
      record.taxPaid = 0;
    }
    if (side === 'buy') record.spent += quote.net;
    else {
      record.earned += quote.net;
      record.taxPaid += quote.tax;
    }

    const trade: TradeRecord = {
      id: `${side}:${good.id}:${now}`,
      goodId: good.id,
      name: good.name,
      side,
      quantity: quote.quantity,
      unitPrice: quote.unitPrice,
      net: quote.net,
      tax: quote.tax,
      at: now,
    };
    record.trades = [trade, ...record.trades].slice(0, TRADE_LOG_LIMIT);

    this.persist();
    this.publish(now);
    this.traded$$.next(trade);
    return trade;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): ExchangeRecord {
    if (this.loaded) return this.record;
    this.loaded = true;
    if (!this.isBrowser) return this.record;

    // Registered on first read rather than in `init()`, matching GamblerService:
    // this is the moment the cached copy starts existing, so it is the moment a
    // cloud pull needs to be able to invalidate it.
    this.saves.register(EXCHANGE_KEY, {
      rehydrate: () => {
        this.loaded = false;
        this.load();
        this.publish();
      },
    });

    try {
      const raw = this.store.readRaw(EXCHANGE_KEY);
      if (!raw) return this.record;
      const parsed = JSON.parse(raw) as Partial<ExchangeRecord>;
      this.record = {
        version: SCHEMA_VERSION,
        pressure: readPressure(parsed.pressure),
        trades: readTrades(parsed.trades),
        day: typeof parsed.day === 'string' ? parsed.day : '',
        spent: whole(parsed.spent),
        earned: whole(parsed.earned),
        taxPaid: whole(parsed.taxPaid),
      };
    } catch {
      this.record = emptyRecord();
    }
    return this.record;
  }

  private persist(): void {
    this.store.write(EXCHANGE_KEY, this.record);
  }

  private publish(now = Date.now()): void {
    const record = this.load();
    const today = utcDay(now);
    const current = record.day === today;
    this.snapshot$$.next({
      trades: [...record.trades],
      spentToday: current ? record.spent : 0,
      earnedToday: current ? record.earned : 0,
      taxPaidToday: current ? record.taxPaid : 0,
      movedGoodIds: Object.keys(record.pressure),
    });
  }

  /** Wipe the footprint and the ticker. Exposed alongside the other resets. */
  reset(): void {
    if (!this.isBrowser) return;
    this.record = emptyRecord();
    this.loaded = true;
    this.store.remove(EXCHANGE_KEY);
    this.publish();
  }
}

/**
 * How far the live price may have moved from the quote the player read.
 *
 * Half a percent. The prices move continuously, so demanding an exact match
 * would refuse honest trades on nothing more than the millisecond between
 * rendering a row and clicking it; a wider band would let a stale tab settle at
 * a price the player never saw.
 */
const PRICE_TOLERANCE = 0.005;

function withinTolerance(live: number, expected: number): boolean {
  if (!Number.isFinite(expected) || expected <= 0) return false;
  // A move in the player's favour is never a reason to refuse; only a move
  // against the quote they read is.
  return live <= expected * (1 + PRICE_TOLERANCE);
}

function whole(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

/**
 * Read a persisted pressure map, dropping anything malformed.
 *
 * Clamped on read as well as on write: a hand-edited blob should not be able to
 * pin a market at its floor.
 */
function readPressure(raw: unknown): Record<string, Pressure> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, Pressure> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const { net, at } = value as Partial<Pressure>;
    if (typeof net !== 'number' || !Number.isFinite(net)) continue;
    if (typeof at !== 'number' || !Number.isFinite(at)) continue;
    if (!goodById(key)) continue;
    out[key] = { net: Math.max(-1e9, Math.min(1e9, net)), at };
  }
  return out;
}

function readTrades(raw: unknown): TradeRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: TradeRecord[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const t = row as Partial<TradeRecord>;
    if (typeof t.goodId !== 'string' || (t.side !== 'buy' && t.side !== 'sell')) continue;
    out.push({
      id: typeof t.id === 'string' ? t.id : `${t.side}:${t.goodId}:${whole(t.at)}`,
      goodId: t.goodId,
      name: typeof t.name === 'string' ? t.name : (goodById(t.goodId)?.name ?? t.goodId),
      side: t.side,
      quantity: whole(t.quantity),
      unitPrice: whole(t.unitPrice),
      net: whole(t.net),
      tax: whole(t.tax),
      at: whole(t.at),
    });
    if (out.length >= TRADE_LOG_LIMIT) break;
  }
  return out;
}
