/**
 * matching.ts — price-time priority, partial fills, the seller's tax. Pure.
 */
import {MAX_FILLS_PER_ORDER, SELLER_TAX_RATE} from "./config";
import type {MarketOrder, OrderSide} from "./types";

export interface Fill {
  maker: MarketOrder;
  qty: number;
  /** Trades print at the resting (maker) order's price. */
  unitPrice: number;
}

/** Units still open on an order. */
export function remaining(order: MarketOrder): number {
  return Math.max(0, order.qty - order.filledQty);
}

/** The seller's tax on a gross amount. Rounded up so dust trades still pay. */
export function sellerTax(gross: number): number {
  if (gross <= 0) return 0;
  return Math.ceil(gross * SELLER_TAX_RATE);
}

/**
 * Order a book best-first for the side *being matched against*.
 *
 * Asks (resting sells): cheapest first. Bids (resting buys): dearest first.
 * Ties break on createdAt, then id, so the order is total and deterministic.
 */
export function sortBook(restingSide: OrderSide, orders: MarketOrder[]): MarketOrder[] {
  return [...orders].sort((a, b) => {
    if (a.unitPrice !== b.unitPrice) {
      return restingSide === "sell" ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice;
    }
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** True when a resting order's price is acceptable to the incoming one. */
export function crosses(incoming: MarketOrder, resting: MarketOrder): boolean {
  return incoming.side === "buy" ?
    resting.unitPrice <= incoming.unitPrice :
    resting.unitPrice >= incoming.unitPrice;
}

/**
 * Walk the opposite side of the book and fill as much of `incoming` as it can.
 *
 * - Price-time priority: `book` is re-sorted here, so the caller's query order
 *   is not trusted.
 * - Partial fills on both sides.
 * - Self-trades are skipped: an account's own resting order is passed over,
 *   never matched (it would only move tax and could fake volume).
 * - At most {@link MAX_FILLS_PER_ORDER} makers per placement.
 */
export function matchOrder(
  incoming: MarketOrder,
  book: MarketOrder[],
  maxFills = MAX_FILLS_PER_ORDER,
): Fill[] {
  const restingSide: OrderSide = incoming.side === "buy" ? "sell" : "buy";
  const sorted = sortBook(
    restingSide,
    book.filter((o) =>
      o.side === restingSide &&
      o.status === "open" &&
      o.itemKey === incoming.itemKey &&
      remaining(o) > 0,
    ),
  );
  const fills: Fill[] = [];
  let left = remaining(incoming);
  for (const maker of sorted) {
    if (left <= 0 || fills.length >= maxFills) break;
    if (!crosses(incoming, maker)) break;
    if (maker.ownerUid === incoming.ownerUid) continue;
    const qty = Math.min(left, remaining(maker));
    if (qty <= 0) continue;
    fills.push({maker, qty, unitPrice: maker.unitPrice});
    left -= qty;
  }
  return fills;
}
