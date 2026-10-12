/**
 * types.ts — the market's Firestore documents.
 *
 *   market/v1                         MarketConfigDoc  (feature flag; owner-written)
 *   market/v1/orders/{orderId}        MarketOrder      (public read)
 *   market/v1/trades/{tradeId}        MarketTrade      (public read)
 *   market/v1/prices/{itemKey}        PriceDoc         (public read)
 *   market/v1/escrow/{uid}            EscrowDoc        (owner read only)
 *   market/v1/listed/{itemId}         ListedItemDoc    (no client access)
 *
 * Every write goes through the Cloud Functions in this folder. The rules
 * refuse all client writes under `market/**`.
 */

export type OrderSide = "buy" | "sell";
export type OrderStatus = "open" | "filled" | "cancelled";
export type GoodKind = "material" | "equipment";

/**
 * A frozen copy of one equipment instance, as it was when it was listed.
 *
 * Equipment rolls differ item to item, so a sell order carries the exact
 * numbers the buyer will receive. Public: the order book shows it.
 */
export interface InstanceSnapshot {
  /** The seller's record id. Burned: it may never be listed again. */
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
  /** Exchange catalogue id: `mat:<stackKey>` or `eq:<definitionId>:<rarity>`. */
  itemKey: string;
  kind: GoodKind;
  qty: number;
  filledQty: number;
  /** Whole Gold per unit. A buy's limit; a sell's ask. */
  unitPrice: number;
  ownerUid: string;
  /** Epoch ms. Second key of price-time priority. */
  createdAt: number;
  updatedAt: number;
  status: OrderStatus;
  /** Sell orders of equipment only. */
  instance?: InstanceSnapshot;
  /** Client-supplied idempotency key; a retried placement returns the same order. */
  clientRequestId?: string;
}

export interface MarketTrade {
  id: string;
  itemKey: string;
  qty: number;
  unitPrice: number;
  /** Gold the seller paid to the market: ceil(gross * tax rate). */
  tax: number;
  buyOrderId: string;
  sellOrderId: string;
  buyerUid: string;
  sellerUid: string;
  /** Which side was resting. The trade prints at the maker's price. */
  maker: OrderSide;
  executedAt: number;
}

export interface PriceBucket {
  /** Epoch hour (ms / 3_600_000, floored). */
  hour: number;
  volume: number;
  /** Sum of price * qty, for VWAP. */
  notional: number;
  trades: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceDoc {
  itemKey: string;
  lastPrice: number;
  lastTradeAt: number;
  volume24h: number;
  vwap24h: number;
  trades24h: number;
  /** Oldest first. Bounded by PRICE_HISTORY_HOURS. */
  buckets: PriceBucket[];
  updatedAt: number;
}

export type ClaimReason = "fill" | "cancel" | "refund";

/** Something waiting for the player to collect into their save. */
export interface Claim {
  id: string;
  kind: "stack" | "instance";
  itemKey: string;
  reason: ClaimReason;
  at: number;
  /** Stacks. */
  stackKey?: string;
  qty?: number;
  /** Instances. */
  instance?: InstanceSnapshot;
}

/**
 * A change the market made to the player's cloud save, kept so it can be
 * re-applied if a client re-sync wrote over it. See docs/handoff/player-market.md.
 */
export type EscrowMark =
  | {
      kind: "tombstone";
      recordId: string;
      revision: {hlc: number; deviceId: string; sequence: number};
      deletedAt: number;
      at: number;
    }
  | {
      kind: "stack-op";
      op: StackOp;
      at: number;
    }
  | {
      kind: "economy-op";
      op: EconomyOpLite;
      at: number;
    };

export interface StackOp {
  id: string;
  stackKey: string;
  kind: "grant" | "consume";
  quantity: number;
  hlc: number;
  deviceId: string;
  sequence: number;
}

export interface EconomyOpLite {
  id: string;
  deviceId: string;
  seq: number;
  kind: "credit-gold" | "spend-gold";
  amount: number;
  hlc: number;
  wall: number;
}

export interface EscrowDoc {
  uid: string;
  /** Gold currently locked behind this player's open buy orders. */
  heldGold: number;
  /** Proceeds and refunds not yet collected into the save. */
  claimableGold: number;
  claims: Claim[];
  marks: EscrowMark[];
  /** Next `seq` for the market's ops in this player's economy ledger. */
  econSeq: number;
  /** Next `sequence` for the market's ops in this player's inventory ledger. */
  invSeq: number;
  openOrders: number;
  /** Action timestamps (epoch ms), newest last, for the rate limiter. */
  tradeStamps: number[];
  collectStamps: number[];
  /** Placement idempotency: clientRequestId -> orderId, bounded. */
  requests: Record<string, string>;
  /** Lifetime totals, for the UI and for support. */
  taxPaid: number;
  updatedAt: number;
}

export interface ListedItemDoc {
  uid: string;
  orderId: string;
  at: number;
}

export interface MarketConfigDoc {
  /** The feature flag. False or absent: every market call is refused. */
  enabled?: boolean;
  /** Optional read-only mode: cancels and collects allowed, new orders refused. */
  haltNewOrders?: boolean;
}
