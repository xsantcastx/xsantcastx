/**
 * player-exchange.model.ts — the arithmetic and wording decisions behind the
 * Exchange while the player market is on. Pure: no Angular, no Firebase, so
 * the specs exercise exactly what the screen shows.
 *
 *   defaultPrice   what the price box starts at (best ask to buy, best bid to sell)
 *   buyReceipt     what a buy escrows, and whether it fills right away
 *   sellReceipt    the 2% tax line: "you receive N Gold"
 *   maxTradeQty    the Max button
 *   bookDepth      the top five levels each side
 *   marketErrorCopy a server refusal → one plain sentence (an i18n key + vars)
 */
import {
  MARKET_MAX_ORDER_QTY,
  sellerTax,
  type BookLevel,
  type MarketPrice,
  type OrderBook,
  type OrderSide,
} from '../market/player-market.model';

/** Mirrors functions/src/market/config.ts: an equipment buy order takes at most 50. */
export const MARKET_MAX_EQUIPMENT_BUY = 50;

/** How many price levels each side of the detail shows. */
export const BOOK_DEPTH_SHOWN = 5;

/**
 * The starting price for a new order.
 *
 * Buy: the cheapest seller, so pressing Buy without touching anything fills at
 * once. Sell: the dearest buyer, likewise. With nobody on the other side, the
 * day's average, then the last trade, then the catalogue's base worth — a
 * price the server's sanity band will always accept.
 */
export function defaultPrice(
  side: OrderSide,
  book: Pick<OrderBook, 'bestBid' | 'bestAsk'> | null,
  price: Pick<MarketPrice, 'vwap24h' | 'lastPrice'> | null,
  basePrice: number,
): number {
  const best = side === 'buy' ? book?.bestAsk : book?.bestBid;
  const hint = best ?? (price?.vwap24h || price?.lastPrice || basePrice);
  return Math.max(1, Math.round(hint || 1));
}

export interface BuyReceipt {
  /** Gold held in escrow when the order is placed: qty × your price. */
  total: number;
  /** True when your price meets the cheapest seller, so (some of) it fills now. */
  fillsNow: boolean;
}

export function buyReceipt(unitPrice: number, qty: number, bestAsk: number | null): BuyReceipt {
  const p = Math.max(0, Math.floor(unitPrice));
  const q = Math.max(0, Math.floor(qty));
  return { total: p * q, fillsNow: bestAsk !== null && q > 0 && p >= bestAsk };
}

export interface SellReceipt {
  gross: number;
  /** 2% of gross, rounded up — the same rounding as the server. */
  tax: number;
  /** What lands in your escrow when it all fills at your price. */
  net: number;
  /** True when your price meets the dearest buyer. */
  fillsNow: boolean;
}

export function sellReceipt(unitPrice: number, qty: number, bestBid: number | null): SellReceipt {
  const p = Math.max(0, Math.floor(unitPrice));
  const q = Math.max(0, Math.floor(qty));
  const gross = p * q;
  const tax = sellerTax(gross);
  return { gross, tax, net: gross - tax, fillsNow: bestBid !== null && q > 0 && p <= bestBid };
}

/**
 * The Max button.
 *   Buy:  as many as your Gold covers at your price (50 for equipment).
 *   Sell: everything you carry (one piece at a time for equipment).
 * Never above the server's per-order cap.
 */
export function maxTradeQty(
  side: OrderSide,
  kind: 'material' | 'equipment',
  opts: { gold: number; unitPrice: number; held: number },
): number {
  if (side === 'sell') {
    const held = Math.max(0, Math.floor(opts.held));
    return kind === 'equipment' ? Math.min(1, held) : Math.min(MARKET_MAX_ORDER_QTY, held);
  }
  const price = Math.floor(opts.unitPrice);
  if (!(price >= 1)) return 0;
  const afford = Math.max(0, Math.floor(opts.gold / price));
  return Math.min(kind === 'equipment' ? MARKET_MAX_EQUIPMENT_BUY : MARKET_MAX_ORDER_QTY, afford);
}

/** The top of the book: cheapest sellers and dearest buyers, five each. */
export function bookDepth(
  book: Pick<OrderBook, 'asks' | 'bids'> | null,
  n = BOOK_DEPTH_SHOWN,
): { asks: BookLevel[]; bids: BookLevel[] } {
  return { asks: (book?.asks ?? []).slice(0, n), bids: (book?.bids ?? []).slice(0, n) };
}

/** One plain sentence: a key in player-exchange.i18n.ts, or the server's own words. */
export type MarketErrorCopy =
  | { key: string; vars?: Record<string, string | number> }
  | { text: string };

/**
 * Turn a refused market call into words for the player.
 *
 * The server's sentences are already readable, but English-only and sometimes
 * technical ("op-log", "era"). The common refusals get their own translated
 * copy — reading the numbers back out of the server sentence where it names
 * them (the accepted price range, the seconds to wait). Anything unrecognised
 * falls back to the server's sentence, never to a code.
 */
export function marketErrorCopy(reason: string, message: string): MarketErrorCopy {
  switch (reason) {
    case 'price-band': {
      const m = /between\s+([\d,]+)\s+and\s+([\d,]+)/i.exec(message);
      return m
        ? { key: 'pmx.err.priceBand', vars: { min: m[1], max: m[2] } }
        : { key: 'pmx.err.priceBandPlain' };
    }
    case 'rate-limited': {
      const m = /(\d+)\s+second/i.exec(message);
      return m ? { key: 'pmx.err.rateLimited', vars: { secs: m[1] } } : { key: 'pmx.err.rateLimitedPlain' };
    }
    case 'not-owned':
    case 'not-enough':
    case 'wrong-item':
    case 'save-missing':
    case 'save-unreadable':
    case 'save-era':
    case 'save-syncing':
      return { key: 'pmx.err.notInSave' };
    case 'not-enough-gold':
      return { key: 'pmx.err.notEnoughGold' };
    case 'market-closed':
      return { key: 'pmx.err.closed' };
    case 'market-halted':
      return { key: 'pmx.err.halted' };
    case 'signed-out':
      return { key: 'pmx.err.signedOut' };
    case 'offline':
      return { key: 'pmx.err.offline' };
    case 'internal':
      return { key: 'pmx.err.internal' };
    case 'collect-first':
      return { key: 'pmx.err.collectFirst' };
    case 'too-many-orders':
      return { key: 'pmx.err.tooManyOrders' };
    case 'already-listed':
      return { key: 'pmx.err.alreadyListed' };
    case 'in-use':
      return { key: 'pmx.err.inUse' };
    case 'soulbound':
    case 'not-tradable':
      return { key: 'pmx.err.notTradable' };
    case 'banned':
      return { key: 'pmx.err.banned' };
    case 'not-open':
    case 'not-found':
      return { key: 'pmx.err.orderGone' };
    default:
      return message ? { text: message } : { key: 'pmx.err.internal' };
  }
}
