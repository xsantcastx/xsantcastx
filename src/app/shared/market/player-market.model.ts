/**
 * player-market.model.ts — the client's view of the player auction house.
 *
 * Pure types and functions; no Angular, no Firebase. The authoritative copy of
 * every rule here lives server-side in `functions/src/market/` — these mirror
 * the shapes the server writes and the numbers it enforces, so the UI can
 * explain a refusal before making the round trip. The server never trusts any
 * of it.
 *
 * Firestore layout (all written only by Cloud Functions):
 *   market/v1                    { enabled, haltNewOrders }   public read
 *   market/v1/orders/{id}        MarketOrder                  public read
 *   market/v1/trades/{id}        MarketTrade                  public read
 *   market/v1/prices/{itemKey}   MarketPrice                  public read
 *   market/v1/escrow/{uid}       MarketEscrow                 owner read
 */

/**
 * Build-time switch. While false the service makes no Firestore reads and no
 * calls, and every surface should keep showing the simulated Exchange
 * (`shared/exchange/`). The server has its own switch (`market/v1.enabled`);
 * both must be on for the player market to work. See
 * docs/handoff/player-market.md.
 */
export const PLAYER_MARKET_CLIENT_ENABLED = false;

/** Mirrors functions/src/market/config.ts. Display only; the server decides. */
export const MARKET_TAX_RATE = 0.02;
export const MARKET_MAX_ORDER_QTY = 10_000;
export const MARKET_MAX_OPEN_ORDERS = 40;

export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'cancelled';

export interface InstanceSnapshot {
  sourceId: string;
  definitionId: string;
  name: string;
  type: string;
  rarity: string;
  stats: Record<string, number>;
  rollQuality?: Record<string, number>;
  sellValue: number;
  lore?: string;
  upgradeLevel?: number;
  reforgeCount?: number;
  sockets?: (string | null)[];
}

export interface MarketOrder {
  id: string;
  side: OrderSide;
  /** The Exchange catalogue id: `mat:<stackKey>` or `eq:<definitionId>:<rarity>`. */
  itemKey: string;
  kind: 'material' | 'equipment';
  qty: number;
  filledQty: number;
  unitPrice: number;
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
  status: OrderStatus;
  instance?: InstanceSnapshot;
  clientRequestId?: string;
}

export interface MarketTrade {
  id: string;
  itemKey: string;
  qty: number;
  unitPrice: number;
  tax: number;
  buyOrderId: string;
  sellOrderId: string;
  buyerUid: string;
  sellerUid: string;
  maker: OrderSide;
  executedAt: number;
}

export interface PriceBucket {
  hour: number;
  volume: number;
  notional: number;
  trades: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketPrice {
  itemKey: string;
  lastPrice: number;
  lastTradeAt: number;
  volume24h: number;
  vwap24h: number;
  trades24h: number;
  buckets: PriceBucket[];
  updatedAt: number;
}

export interface MarketClaim {
  id: string;
  kind: 'stack' | 'instance';
  itemKey: string;
  reason: 'fill' | 'cancel' | 'refund';
  at: number;
  stackKey?: string;
  qty?: number;
  instance?: InstanceSnapshot;
}

/** The slice of `market/v1/escrow/{uid}` the UI needs. */
export interface MarketEscrow {
  heldGold: number;
  claimableGold: number;
  claims: MarketClaim[];
  openOrders: number;
  taxPaid: number;
}

/** One price level of the aggregated book. */
export interface BookLevel {
  unitPrice: number;
  qty: number;
  orders: number;
}

export interface OrderBook {
  itemKey: string;
  /** Resting buys, dearest first. */
  bids: BookLevel[];
  /** Resting sells, cheapest first. */
  asks: BookLevel[];
  /**
   * Individual resting sells, cheapest first. For equipment each one is a
   * distinct roll (see `instance`), so the UI should list these rather than
   * the aggregated levels.
   */
  askOrders: MarketOrder[];
  bestBid: number | null;
  bestAsk: number | null;
  loading: boolean;
}

/** Who may do what, right now. */
export type MarketAccess =
  | { state: 'disabled' }                 // client flag off: show the simulated Exchange
  | { state: 'closed'; reason: string }   // server flag off or halted
  | { state: 'signed-out' }               // "Sign in to trade"
  | { state: 'ready'; uid: string; haltNewOrders: boolean };

export interface PlaceOrderInput {
  side: OrderSide;
  itemKey: string;
  qty: number;
  unitPrice: number;
  /** Equipment sells only: the inventory record id of the piece being listed. */
  instanceId?: string;
}

export interface PlaceOrderResult {
  order: MarketOrder;
  fills: { qty: number; unitPrice: number }[];
  replayed: boolean;
}

export interface CollectResult {
  gold: number;
  delivered: { itemKey: string; qty: number; name?: string }[];
  pending: number;
  bagFull: boolean;
}

/** Every service call resolves to one of these; it never rejects. */
export type MarketResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; reason: string };

/** An action in flight, for optimistic UI. */
export interface PendingAction {
  id: string;
  kind: 'place' | 'cancel' | 'collect';
  /** The order being placed (optimistic row) or cancelled. */
  input?: PlaceOrderInput;
  orderId?: string;
  startedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

export function remainingQty(order: Pick<MarketOrder, 'qty' | 'filledQty'>): number {
  return Math.max(0, order.qty - order.filledQty);
}

/** Seller's tax on a gross amount. Same rounding as the server. */
export function sellerTax(gross: number): number {
  return gross > 0 ? Math.ceil(gross * MARKET_TAX_RATE) : 0;
}

/** What a sell of `qty` at `unitPrice` pays out if it fills in full at its ask. */
export function netProceeds(unitPrice: number, qty: number): number {
  const gross = unitPrice * qty;
  return gross - sellerTax(gross);
}

/** Collapse open orders into price levels. `side` is the side of the orders. */
export function aggregateLevels(orders: readonly MarketOrder[], side: OrderSide): BookLevel[] {
  const byPrice = new Map<number, BookLevel>();
  for (const o of orders) {
    if (o.side !== side || o.status !== 'open') continue;
    const qty = remainingQty(o);
    if (qty <= 0) continue;
    const level = byPrice.get(o.unitPrice) ?? { unitPrice: o.unitPrice, qty: 0, orders: 0 };
    level.qty += qty;
    level.orders += 1;
    byPrice.set(o.unitPrice, level);
  }
  return [...byPrice.values()].sort((a, b) =>
    side === 'sell' ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice);
}

export function buildBook(
  itemKey: string,
  bids: readonly MarketOrder[],
  asks: readonly MarketOrder[],
  loading = false,
): OrderBook {
  const bidLevels = aggregateLevels(bids, 'buy');
  const askLevels = aggregateLevels(asks, 'sell');
  const askOrders = asks
    .filter(o => o.status === 'open' && remainingQty(o) > 0)
    .slice()
    .sort((a, b) => a.unitPrice - b.unitPrice || a.createdAt - b.createdAt);
  return {
    itemKey,
    bids: bidLevels,
    asks: askLevels,
    askOrders,
    bestBid: bidLevels[0]?.unitPrice ?? null,
    bestAsk: askLevels[0]?.unitPrice ?? null,
    loading,
  };
}

export function emptyBook(itemKey: string, loading = true): OrderBook {
  return buildBook(itemKey, [], [], loading);
}

/** Client-side checks that save a round trip. The server repeats all of them. */
export function precheckOrder(input: PlaceOrderInput): string | null {
  if (!input.itemKey) return 'Choose an item.';
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > MARKET_MAX_ORDER_QTY) {
    return `Quantity must be a whole number from 1 to ${MARKET_MAX_ORDER_QTY.toLocaleString('en-US')}.`;
  }
  if (!Number.isInteger(input.unitPrice) || input.unitPrice < 1) return 'Price must be a whole number of Gold.';
  if (input.itemKey.startsWith('eq:') && input.side === 'sell') {
    if (!input.instanceId) return 'Choose which item to sell.';
    if (input.qty !== 1) return 'Equipment is listed one piece at a time.';
  }
  return null;
}

/**
 * Turn a callable failure into a sentence.
 *
 * The market functions already throw player-readable messages with a
 * `details.reason`; this keeps those and replaces the SDK's own wording for
 * transport failures, which would otherwise read "INTERNAL" or "deadline-exceeded".
 */
export function describeMarketError(err: unknown): { error: string; reason: string } {
  const e = err as { code?: unknown; message?: unknown; details?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code.replace(/^functions\//, '') : '';
  const details = e?.details as { reason?: unknown } | undefined;
  const reason = typeof details?.reason === 'string' ? details.reason : code || 'unknown';
  const message = typeof e?.message === 'string' ? e.message : '';
  switch (code) {
    case 'unauthenticated':
      return { error: 'Sign in to trade.', reason: 'signed-out' };
    case 'deadline-exceeded':
    case 'unavailable':
      if (details?.reason) return { error: message, reason };
      return { error: "Can't reach the market right now. Check your connection and try again.", reason: 'offline' };
    case 'internal':
    case 'unknown':
    case '':
      return {
        error: message && code === 'internal' && message !== 'INTERNAL'
          ? message
          : "The market couldn't finish that. Nothing was taken — try again in a moment.",
        reason: 'internal',
      };
    default:
      return { error: message || 'The market refused that order.', reason };
  }
}

/** A request id for placement idempotency: matches the server's /^[A-Za-z0-9_-]{8,64}$/. */
export function newClientRequestId(rand: () => number = Math.random, now: number = Date.now()): string {
  let tail = '';
  for (let i = 0; i < 12; i++) tail += Math.floor(rand() * 36).toString(36);
  return `r${now.toString(36)}-${tail}`;
}
