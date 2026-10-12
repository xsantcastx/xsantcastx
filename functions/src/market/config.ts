/**
 * config.ts — every number the player market enforces, in one place.
 *
 * These are server constants on purpose. The client mirrors a few of them for
 * friendly validation (`src/app/shared/market/player-market.model.ts`), but the
 * values here are the ones that decide whether an order is accepted.
 */

/** Firestore root for every market document: `market/v1/...`. */
export const MARKET_ROOT = "market";
export const MARKET_VERSION_DOC = "v1";

/** Tax taken from the seller's gross on every fill. A Gold sink. */
export const SELLER_TAX_RATE = 0.02;

/** Hard ceilings on a single order. */
export const MAX_ORDER_QTY = 10_000;
export const MAX_UNIT_PRICE = 50_000_000;
/** Most open orders one account may hold at once. */
export const MAX_OPEN_ORDERS = 40;
/** Pending claims before the market refuses new orders ("collect first"). */
export const MAX_PENDING_CLAIMS = 120;
/** Resting orders a single placement will walk before it stops matching. */
export const MAX_FILLS_PER_ORDER = 25;

/** Rate limits, per uid. Sliding windows over action timestamps. */
export const RATE_LIMITS = {
  /** placeOrder + cancelOrder together. */
  trade: {perMinute: 12, perDay: 150},
  collect: {perMinute: 10, perDay: 400},
} as const;

/**
 * Price sanity band. An order whose unit price sits outside
 * [reference / BAND_FACTOR, reference * BAND_FACTOR] is rejected, where the
 * reference is the 24h VWAP (when there is enough volume), else the last
 * trade, else the item's base worth from the Exchange catalogue.
 */
export const BAND_FACTOR = 4;
/** Trades in the last 24h needed before the VWAP is trusted as the anchor. */
export const VWAP_MIN_TRADES = 3;
/** Absolute guard rails against base worth, whatever trading has done. */
export const BASE_FLOOR_MULT = 0.1;
export const BASE_CEILING_MULT = 8;

/** Hourly price buckets kept on `market/v1/prices/{itemKey}` for charts. */
export const PRICE_HISTORY_HOURS = 24 * 30;

/**
 * How far ahead of wall-clock an escrow tombstone is stamped.
 *
 * The inventory merge lets a record beat a tombstone whose revision is lower,
 * and a client stamps revisions from its wall clock. A tombstone at "now" would
 * lose to any later edit of the item by a device that had not seen it yet. A
 * year ahead means no honest device can out-revision it.
 */
export const ESCROW_TOMBSTONE_LEAD_MS = 365 * 24 * 60 * 60 * 1000;

/** Escrow marks are re-asserted on every market call for this long... */
export const MARK_RETAIN_MS = 7 * 24 * 60 * 60 * 1000;
/** ...up to this many, newest kept, so the escrow document stays small. */
export const MAX_MARKS = 400;
/** Remembered clientRequestIds per account, for placement idempotency. */
export const MAX_REMEMBERED_REQUESTS = 50;

/** Device id the market writes into a player's save under. */
export const MARKET_DEVICE_ID = "market-server";
