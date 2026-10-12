/**
 * pricing.ts — trade history, the reference price, the sanity band. Pure.
 */
import {
  BAND_FACTOR,
  BASE_CEILING_MULT,
  BASE_FLOOR_MULT,
  PRICE_HISTORY_HOURS,
  VWAP_MIN_TRADES,
} from "./config";
import type {PriceBucket, PriceDoc} from "./types";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** Fold one trade into an item's price document. */
export function recordTrade(
  doc: PriceDoc | null,
  itemKey: string,
  unitPrice: number,
  qty: number,
  at: number,
): PriceDoc {
  const hour = Math.floor(at / HOUR_MS);
  const buckets: PriceBucket[] = (doc?.buckets ?? []).map((b) => ({...b}));
  let bucket = buckets.find((b) => b.hour === hour);
  if (!bucket) {
    bucket = {hour, volume: 0, notional: 0, trades: 0, high: unitPrice, low: unitPrice, close: unitPrice};
    buckets.push(bucket);
    buckets.sort((a, b) => a.hour - b.hour);
  }
  bucket.volume += qty;
  bucket.notional += unitPrice * qty;
  bucket.trades += 1;
  bucket.high = Math.max(bucket.high, unitPrice);
  bucket.low = Math.min(bucket.low, unitPrice);
  bucket.close = unitPrice;
  const kept = buckets.filter((b) => b.hour > hour - PRICE_HISTORY_HOURS);
  return {
    itemKey,
    lastPrice: unitPrice,
    lastTradeAt: at,
    ...window24h(kept, at),
    buckets: kept,
    updatedAt: at,
  };
}

/** 24h volume, VWAP and trade count from hourly buckets. */
export function window24h(
  buckets: readonly PriceBucket[],
  now: number,
): {volume24h: number; vwap24h: number; trades24h: number} {
  const from = Math.floor((now - DAY_MS) / HOUR_MS);
  let volume = 0;
  let notional = 0;
  let trades = 0;
  for (const b of buckets) {
    if (b.hour <= from) continue;
    volume += b.volume;
    notional += b.notional;
    trades += b.trades;
  }
  return {volume24h: volume, vwap24h: volume > 0 ? Math.round(notional / volume) : 0, trades24h: trades};
}

export type ReferenceSource = "vwap" | "last" | "base";

/**
 * The price an order is judged against.
 *
 * VWAP over the last 24h once there are enough trades to mean something; the
 * last trade otherwise; the Exchange catalogue's base worth for an item that
 * has never traded.
 */
export function referencePrice(
  doc: PriceDoc | null,
  basePrice: number,
  now: number,
): {price: number; source: ReferenceSource} {
  if (doc) {
    const w = window24h(doc.buckets ?? [], now);
    if (w.trades24h >= VWAP_MIN_TRADES && w.vwap24h > 0) return {price: w.vwap24h, source: "vwap"};
    if (doc.lastPrice > 0) return {price: doc.lastPrice, source: "last"};
  }
  return {price: basePrice, source: "base"};
}

export interface BandVerdict {
  ok: boolean;
  min: number;
  max: number;
  source: ReferenceSource;
}

/**
 * Is `unitPrice` sane for this item right now?
 *
 * Two fences, both must pass: within BAND_FACTOR of the reference price, and
 * within the absolute floor/ceiling of the catalogue base worth — so a run of
 * wash-ish trades cannot walk the reference off to an absurd number.
 */
export function checkBand(
  unitPrice: number,
  doc: PriceDoc | null,
  basePrice: number,
  now: number,
): BandVerdict {
  const ref = referencePrice(doc, basePrice, now);
  const min = Math.max(1, Math.ceil(Math.max(ref.price / BAND_FACTOR, basePrice * BASE_FLOOR_MULT)));
  const max = Math.floor(Math.min(ref.price * BAND_FACTOR, basePrice * BASE_CEILING_MULT));
  return {ok: unitPrice >= min && unitPrice <= max, min, max: Math.max(min, max), source: ref.source};
}
