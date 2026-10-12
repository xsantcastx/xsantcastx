/**
 * summary.ts — the one document the Exchange list reads.
 *
 * Before this, every Exchange visitor held two collection listeners (all open
 * orders, all price docs), so every order or trade write was re-read by every
 * open Exchange. Now the engine folds each change into
 * `market/v1/summary/board` inside the same transaction, and the list holds a
 * single document listener. Depth (the book, trades, price history) is fetched
 * only for the item a player opens.
 *
 * Exact without scanning the book:
 *   - Best prices are recomputed from orders the transaction already reads:
 *     the top of the resting side (MAX_FILLS_PER_ORDER × 2 deep, and a
 *     placement consumes at most MAX_FILLS_PER_ORDER of them, so the next best
 *     is always in hand), the top order of the incoming side, and for a cancel
 *     the top two of that side.
 *   - Quantities move by the exact delta of the change. Whenever a read covers
 *     a whole side (fewer orders came back than were asked for), that side's
 *     quantity is recomputed from the read instead, so any drift heals.
 *
 * Cost: one extra document read and write per placement or cancel, and one
 * extra order read (the incoming side's top). The document is a hotspot by
 * design: every market transaction now touches it, so sustained throughput is
 * bounded by Firestore's per-document write rate (~1/s sustained, bursts
 * fine). Past that, shard it by itemKey hash into `summary/board-<n>`.
 */
import {DAY_MS} from "./pricing";
import {remaining} from "./matching";
import type {BoardSummaryDoc, BoardSummaryRow, MarketOrder, OrderSide, PriceDoc} from "./types";

export const BOARD_SUMMARY_ID = "board";

export interface SideRead {
  side: OrderSide;
  /** Open orders on this side as read in the transaction, best first. */
  read: readonly MarketOrder[];
  /** The limit the read used: fewer rows than this means the side is complete. */
  limit: number;
  /** Change to resting units on this side (fills negative, a new remainder positive). */
  qtyDelta: number;
}

export interface BoardChange {
  itemKey: string;
  /** Orders this transaction writes for the item (makers, the incoming order, a cancel). */
  written: readonly MarketOrder[];
  sides: readonly SideRead[];
  /** The item's price doc after this change, when it traded. */
  price?: PriceDoc | null;
}

function emptyRow(): BoardSummaryRow {
  return {bestBid: null, bestAsk: null, bidQty: 0, askQty: 0, lastPrice: 0, lastTradeAt: 0, volume24h: 0, vwap24h: 0};
}

/** Whether a row still belongs on the list: something resting, or a trade in the last day. */
export function rowIsLive(row: BoardSummaryRow, now: number): boolean {
  return row.bidQty > 0 || row.askQty > 0 || (row.lastTradeAt > 0 && now - row.lastTradeAt < DAY_MS);
}

/** Fold one transaction's change into the summary. Pure. */
export function applyBoardChange(prev: BoardSummaryDoc | null, change: BoardChange, now: number): BoardSummaryDoc {
  const rows: Record<string, BoardSummaryRow> = {};
  for (const [key, r] of Object.entries(prev?.rows ?? {})) rows[key] = {...r};
  const had = rows[change.itemKey];
  const row = had ? {...had} : emptyRow();

  const written = new Map(change.written.map((o) => [o.id, o]));
  for (const s of change.sides) {
    // The side as it stands after this transaction: what was read, with this
    // transaction's own writes laid over it (fills, a cancel, a new remainder).
    const after = new Map<string, MarketOrder>();
    for (const o of s.read) after.set(o.id, written.get(o.id) ?? o);
    for (const o of change.written) {
      if (o.side === s.side && o.itemKey === change.itemKey) after.set(o.id, o);
    }
    const live = [...after.values()].filter((o) => o.status === "open" && remaining(o) > 0);
    const prices = live.map((o) => o.unitPrice);
    const best = prices.length ? (s.side === "buy" ? Math.max(...prices) : Math.min(...prices)) : null;
    const seen = live.reduce((n, o) => n + remaining(o), 0);
    const complete = s.read.length < s.limit;
    const prevQty = had ? (s.side === "buy" ? had.bidQty : had.askQty) : 0;
    // A partial read is a lower bound; the running total is exact unless it drifted.
    const qty = complete ? seen : Math.max(seen, prevQty + s.qtyDelta);
    if (s.side === "buy") {
      row.bestBid = best;
      row.bidQty = qty;
    } else {
      row.bestAsk = best;
      row.askQty = qty;
    }
  }

  if (change.price) {
    row.lastPrice = change.price.lastPrice;
    row.lastTradeAt = change.price.lastTradeAt;
    row.volume24h = change.price.volume24h;
    row.vwap24h = change.price.vwap24h;
  }
  rows[change.itemKey] = row;

  // The whole document is rewritten anyway, so drop every row that went quiet.
  for (const [key, r] of Object.entries(rows)) {
    if (!rowIsLive(r, now)) delete rows[key];
  }
  return {rows, updatedAt: now};
}
