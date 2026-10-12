/**
 * engine.ts — placeOrder / cancelOrder / collect, as single transactions.
 *
 * Written against the small {@link MarketTx} interface rather than the Admin
 * SDK so the whole flow — escrow, matching, settlement, save edits — runs in
 * the unit tests against an in-memory store (functions/test/fake-store.ts).
 * `firestore-store.ts` is the production adapter.
 *
 * Every call reads everything it needs first and writes last, which is what a
 * Firestore transaction requires, and is retried as a whole on contention.
 *
 * GUARANTEES
 *   - Atomic: an order's escrow debit, its matches, both sides' settlement and
 *     the save edits commit together or not at all.
 *   - Conserving: Gold leaving a buyer = Gold reaching sellers + tax + refunds
 *     (asserted in tests). Items leave a seller's save exactly once.
 *   - Idempotent: a placement retried with the same clientRequestId returns the
 *     original order; a collect delivers each claim once (claims are removed in
 *     the same commit that writes them into the save, and the save ops carry
 *     stable ids the client's merge dedupes on).
 */
import {
  MARK_RETAIN_MS,
  MAX_FILLS_PER_ORDER,
  MAX_MARKS,
  MAX_OPEN_ORDERS,
  MAX_ORDER_QTY,
  MAX_PENDING_CLAIMS,
  MAX_REMEMBERED_REQUESTS,
  MAX_UNIT_PRICE,
  RATE_LIMITS,
} from "./config";
import {matchOrder, remaining, sellerTax} from "./matching";
import {checkBand, recordTrade} from "./pricing";
import {checkRate} from "./rate-limit";
import {applyBoardChange} from "./summary";
import {REFERENCE_GOODS} from "./reference.generated";
import {
  EconLedger,
  InvLedger,
  SaveError,
  applyGoldOp,
  deliverInstance,
  escrowInstance,
  escrowStack,
  findListableInstance,
  grantStackTo,
  nextEconomySeq,
  readEconomy,
  readInventory,
  reassertEconomyMarks,
  reassertInventoryMarks,
  snapshotInstance,
  stripUndefined,
} from "./save-ops";
import type {
  BoardSummaryDoc,
  Claim,
  EscrowDoc,
  EscrowMark,
  InstanceSnapshot,
  ListedItemDoc,
  MarketConfigDoc,
  MarketOrder,
  MarketTrade,
  OrderSide,
  PriceDoc,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SaveWhich = "inventory" | "economy";

export interface MarketTx {
  config(): Promise<MarketConfigDoc | null>;
  banned(uid: string): Promise<boolean>;
  escrow(uid: string): Promise<EscrowDoc | null>;
  order(id: string): Promise<MarketOrder | null>;
  /** Open orders on `side` for `itemKey`, best price first, then oldest. */
  book(itemKey: string, side: OrderSide, limit: number): Promise<MarketOrder[]>;
  price(itemKey: string): Promise<PriceDoc | null>;
  /** The raw stored document (`{ v, updatedAt }`), or null. */
  saveDoc(uid: string, which: SaveWhich): Promise<Record<string, any> | null>;
  listed(itemId: string): Promise<boolean>;
  /** `market/v1/summary/board`, the Exchange list (see summary.ts). */
  summary(): Promise<BoardSummaryDoc | null>;

  setOrder(order: MarketOrder): void;
  setTrade(trade: MarketTrade): void;
  setPrice(price: PriceDoc): void;
  setEscrow(escrow: EscrowDoc): void;
  setSaveDoc(uid: string, which: SaveWhich, data: Record<string, any>): void;
  setListed(itemId: string, doc: ListedItemDoc): void;
  setSummary(doc: BoardSummaryDoc): void;
}

export interface MarketStore {
  run<T>(fn: (tx: MarketTx) => Promise<T>): Promise<T>;
  newId(): string;
}

export type MarketErrorCode =
  | "invalid-argument"
  | "failed-precondition"
  | "permission-denied"
  | "not-found"
  | "resource-exhausted"
  | "unavailable";

/** Every refusal carries a sentence a player can act on. */
export class MarketError extends Error {
  constructor(readonly code: MarketErrorCode, message: string, readonly reason: string = code) {
    super(message);
  }
}

export function emptyEscrow(uid: string, now: number): EscrowDoc {
  return {
    uid,
    heldGold: 0,
    claimableGold: 0,
    claims: [],
    marks: [],
    econSeq: 0,
    invSeq: 0,
    openOrders: 0,
    tradeStamps: [],
    collectStamps: [],
    requests: {},
    taxPaid: 0,
    updatedAt: now,
  };
}

function cloneEscrow(e: EscrowDoc): EscrowDoc {
  return JSON.parse(JSON.stringify(e));
}

function pruneMarks(marks: EscrowMark[], now: number): EscrowMark[] {
  return marks.filter((m) => now - m.at < MARK_RETAIN_MS).slice(-MAX_MARKS);
}

async function gate(tx: MarketTx, uid: string, opts: {placing: boolean}): Promise<void> {
  const config = await tx.config();
  if (!config?.enabled) {
    throw new MarketError("unavailable", "The player market isn't open yet.", "market-closed");
  }
  if (opts.placing && config.haltNewOrders) {
    throw new MarketError("unavailable", "The market is paused for new orders. You can still cancel and collect.", "market-halted");
  }
  if (await tx.banned(uid)) {
    throw new MarketError("permission-denied", "This account can't trade.", "banned");
  }
}

function rate(stamps: number[], now: number, which: keyof typeof RATE_LIMITS): number[] {
  const verdict = checkRate(stamps, now, RATE_LIMITS[which]);
  if (!verdict.ok) {
    const secs = Math.max(1, Math.ceil(verdict.retryAfterMs / 1000));
    throw new MarketError("resource-exhausted", `Slow down a little — try again in ${secs} second${secs === 1 ? "" : "s"}.`, "rate-limited");
  }
  return verdict.stamps;
}

function asSaveError(err: unknown): never {
  if (err instanceof SaveError) throw new MarketError("failed-precondition", err.message, err.code);
  throw err;
}

function envelope(prev: Record<string, any> | null, v: unknown, now: number): Record<string, any> {
  return stripUndefined({...(prev ?? {}), v, updatedAt: new Date(now).toISOString()});
}

// ─────────────────────────────────────────────────────────────────────────────
// placeOrder
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaceOrderInput {
  side: OrderSide;
  itemKey: string;
  qty: number;
  unitPrice: number;
  /** Equipment sells: the record id in the seller's inventory. */
  instanceId?: string;
  clientRequestId?: string;
}

export interface PlaceOrderResult {
  order: MarketOrder;
  fills: {qty: number; unitPrice: number}[];
  /** True when this was a retry of an earlier placement. */
  replayed: boolean;
}

export function validatePlaceInput(raw: unknown): PlaceOrderInput {
  const bad = (msg: string): never => {
    throw new MarketError("invalid-argument", msg);
  };
  if (typeof raw !== "object" || raw === null) bad("Missing order details.");
  const r = raw as Record<string, unknown>;
  const side = r["side"];
  if (side !== "buy" && side !== "sell") bad("Choose buy or sell.");
  const itemKey = r["itemKey"];
  if (typeof itemKey !== "string" || !REFERENCE_GOODS[itemKey]) bad("That item has no market.");
  const good = REFERENCE_GOODS[itemKey as string];
  const qty = r["qty"];
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_ORDER_QTY) {
    bad(`Quantity must be a whole number from 1 to ${MAX_ORDER_QTY.toLocaleString("en-US")}.`);
  }
  const unitPrice = r["unitPrice"];
  if (typeof unitPrice !== "number" || !Number.isInteger(unitPrice) || unitPrice < 1 || unitPrice > MAX_UNIT_PRICE) {
    bad("Price must be a whole number of Gold.");
  }
  const instanceId = r["instanceId"];
  if (good.kind === "equipment" && side === "sell") {
    if (typeof instanceId !== "string" || !instanceId || instanceId.length > 200) bad("Choose which item to sell.");
    if (qty !== 1) bad("Equipment is listed one piece at a time.");
  } else if (instanceId !== undefined && instanceId !== null) {
    bad("Only equipment sells name an item.");
  }
  if (good.kind === "equipment" && side === "buy" && (qty as number) > 50) bad("Buy at most 50 pieces of equipment per order.");
  const clientRequestId = r["clientRequestId"];
  if (clientRequestId !== undefined && (typeof clientRequestId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(clientRequestId))) {
    bad("Malformed request id.");
  }
  return {
    side: side as OrderSide,
    itemKey: itemKey as string,
    qty: qty as number,
    unitPrice: unitPrice as number,
    instanceId: typeof instanceId === "string" ? instanceId : undefined,
    clientRequestId: typeof clientRequestId === "string" ? clientRequestId : undefined,
  };
}

/** Per-account mutable state gathered while settling, written once at the end. */
class Ledgers {
  readonly escrows = new Map<string, EscrowDoc>();
  constructor(private readonly now: number) {}
  get(uid: string): EscrowDoc {
    const e = this.escrows.get(uid);
    if (!e) throw new Error(`escrow for ${uid} not loaded`);
    return e;
  }
  put(uid: string, e: EscrowDoc | null): void {
    this.escrows.set(uid, e ? cloneEscrow(e) : emptyEscrow(uid, this.now));
  }
}

export async function placeOrder(
  store: MarketStore,
  uid: string,
  input: PlaceOrderInput,
  now: number,
): Promise<PlaceOrderResult> {
  const good = REFERENCE_GOODS[input.itemKey];
  const orderId = store.newId();

  return store.run(async (tx) => {
    // ── reads ────────────────────────────────────────────────────────────────
    await gate(tx, uid, {placing: true});
    const mine = await tx.escrow(uid);
    if (input.clientRequestId && mine?.requests?.[input.clientRequestId]) {
      const prior = await tx.order(mine.requests[input.clientRequestId]);
      if (prior) return {order: prior, fills: [], replayed: true};
    }
    const ledgers = new Ledgers(now);
    ledgers.put(uid, mine);
    const me = ledgers.get(uid);
    me.tradeStamps = rate(me.tradeStamps, now, "trade");
    if (me.openOrders >= MAX_OPEN_ORDERS) {
      throw new MarketError("resource-exhausted", `You have ${MAX_OPEN_ORDERS} open orders. Cancel one or let it fill first.`, "too-many-orders");
    }
    if (me.claims.length >= MAX_PENDING_CLAIMS) {
      throw new MarketError("failed-precondition", "Collect your market deliveries before placing new orders.", "collect-first");
    }

    const priceDoc = await tx.price(input.itemKey);
    const band = checkBand(input.unitPrice, priceDoc, good.basePrice, now);
    if (!band.ok) {
      throw new MarketError(
        "failed-precondition",
        `That price is out of range for this item right now. Try between ${band.min.toLocaleString("en-US")} and ${band.max.toLocaleString("en-US")} Gold.`,
        "price-band",
      );
    }

    const invDoc = await tx.saveDoc(uid, "inventory");
    const econDoc = await tx.saveDoc(uid, "economy");
    let inv: InvLedger | null = null;
    let econ: EconLedger | null = null;
    try {
      if (input.side === "sell") inv = readInventory(invDoc, false);
      else econ = readEconomy(econDoc);
    } catch (err) {
      asSaveError(err);
    }
    // The other half is re-asserted opportunistically; an unreadable one is left alone.
    if (!inv) inv = tryRead(() => readInventory(invDoc, false));
    if (!econ) econ = tryRead(() => readEconomy(econDoc));
    const invBefore = JSON.stringify(inv);
    const econBefore = JSON.stringify(econ);
    if (inv) inv = reassertInventoryMarks(inv, me.marks);
    if (econ) econ = reassertEconomyMarks(econ, me.marks);

    let record: Record<string, any> | null = null;
    if (input.side === "sell" && good.kind === "equipment") {
      if (await tx.listed(input.instanceId as string)) {
        throw new MarketError("failed-precondition", "That exact item has already been on the market once and can't be listed again.", "already-listed");
      }
      try {
        record = findListableInstance(inv as InvLedger, input.instanceId as string, input.itemKey);
      } catch (err) {
        asSaveError(err);
      }
    }

    const restingSide: OrderSide = input.side === "buy" ? "sell" : "buy";
    const bookLimit = MAX_FILLS_PER_ORDER * 2;
    const book = await tx.book(input.itemKey, restingSide, bookLimit);
    // For the list summary only: the incoming side's current best.
    const incomingTop = await tx.book(input.itemKey, input.side, 1);
    const summary = await tx.summary();

    const incoming: MarketOrder = {
      id: orderId,
      side: input.side,
      itemKey: input.itemKey,
      kind: good.kind,
      qty: input.qty,
      filledQty: 0,
      unitPrice: input.unitPrice,
      ownerUid: uid,
      createdAt: now,
      updatedAt: now,
      status: "open",
      ...(input.clientRequestId ? {clientRequestId: input.clientRequestId} : {}),
    };
    if (record) incoming.instance = snapshotInstance(record);

    const fills = matchOrder(incoming, book);
    for (const uidOther of new Set(fills.map((f) => f.maker.ownerUid))) {
      ledgers.put(uidOther, await tx.escrow(uidOther));
    }

    // ── escrow the incoming order (pure, still before any write) ─────────────
    try {
      if (input.side === "sell") {
        if (good.kind === "equipment") {
          const res = escrowInstance(inv as InvLedger, record as Record<string, any>, now);
          inv = res.ledger;
          me.marks.push(res.mark);
        } else {
          me.invSeq += 1;
          const res = escrowStack(inv as InvLedger, good.stackKey as string, input.qty, `mkt:escrow:${orderId}`, me.invSeq, now);
          inv = res.ledger;
          me.marks.push(res.mark);
        }
      } else {
        const cost = input.qty * input.unitPrice;
        me.econSeq = nextEconomySeq(econ as EconLedger, me.econSeq);
        const res = applyGoldOp(econ as EconLedger, "spend-gold", cost, me.econSeq, now);
        econ = res.ledger;
        me.marks.push({kind: "economy-op", op: res.op, at: now});
        me.heldGold += cost;
      }
    } catch (err) {
      asSaveError(err);
    }

    // ── settle fills ─────────────────────────────────────────────────────────
    const prices = new Map<string, PriceDoc | null>([[input.itemKey, priceDoc]]);
    const outFills: {qty: number; unitPrice: number}[] = [];
    const makerWrites: MarketOrder[] = [];
    const trades: MarketTrade[] = [];
    fills.forEach((fill, i) => {
      const maker = {...fill.maker, updatedAt: now};
      const buy = input.side === "buy" ? incoming : maker;
      const sell = input.side === "sell" ? incoming : maker;
      const buyer = ledgers.get(buy.ownerUid);
      const seller = ledgers.get(sell.ownerUid);
      const gross = fill.unitPrice * fill.qty;
      const tax = sellerTax(gross);
      const tradeId = `${orderId}-${i + 1}`;

      // Seller: proceeds net of tax.
      seller.claimableGold += gross - tax;
      seller.taxPaid += tax;
      // Buyer: escrowed at their own limit; anything under it comes back.
      buyer.heldGold -= buy.unitPrice * fill.qty;
      const refund = (buy.unitPrice - fill.unitPrice) * fill.qty;
      if (refund > 0) buyer.claimableGold += refund;
      buyer.claims.push(itemClaim(tradeId, input.itemKey, good.stackKey, fill.qty, sell.instance, "fill", now));

      maker.filledQty += fill.qty;
      incoming.filledQty += fill.qty;
      if (remaining(maker) === 0) {
        maker.status = "filled";
        ledgers.get(maker.ownerUid).openOrders = Math.max(0, ledgers.get(maker.ownerUid).openOrders - 1);
      }
      makerWrites.push(maker);
      trades.push({
        id: tradeId,
        itemKey: input.itemKey,
        qty: fill.qty,
        unitPrice: fill.unitPrice,
        tax,
        buyOrderId: buy.id,
        sellOrderId: sell.id,
        buyerUid: buy.ownerUid,
        sellerUid: sell.ownerUid,
        maker: maker.side,
        executedAt: now,
      });
      const before = prices.get(input.itemKey) ?? null;
      prices.set(input.itemKey, recordTrade(before, input.itemKey, fill.unitPrice, fill.qty, now));
      outFills.push({qty: fill.qty, unitPrice: fill.unitPrice});
    });

    if (remaining(incoming) === 0) incoming.status = "filled";
    else me.openOrders += 1;
    me.marks = pruneMarks(me.marks, now);
    if (input.clientRequestId) me.requests = rememberRequest(me.requests, input.clientRequestId, orderId);

    // ── writes ───────────────────────────────────────────────────────────────
    tx.setOrder(stripUndefined(incoming));
    for (const m of makerWrites) tx.setOrder(stripUndefined(m));
    for (const t of trades) tx.setTrade(t);
    const updatedPrice = prices.get(input.itemKey);
    if (trades.length && updatedPrice) tx.setPrice(updatedPrice);
    if (record) tx.setListed(String(record["id"]), {uid, orderId, at: now});
    if (inv && JSON.stringify(inv) !== invBefore) tx.setSaveDoc(uid, "inventory", envelope(invDoc, inv, now));
    if (econ && JSON.stringify(econ) !== econBefore) tx.setSaveDoc(uid, "economy", envelope(econDoc, econ, now));
    const filled = outFills.reduce((n, f) => n + f.qty, 0);
    tx.setSummary(applyBoardChange(summary, {
      itemKey: input.itemKey,
      written: [incoming, ...makerWrites],
      sides: [
        {side: restingSide, read: book, limit: bookLimit, qtyDelta: -filled},
        {side: input.side, read: incomingTop, limit: 1, qtyDelta: incoming.status === "open" ? remaining(incoming) : 0},
      ],
      price: trades.length ? updatedPrice : null,
    }, now));
    for (const [owner, e] of ledgers.escrows) {
      e.updatedAt = now;
      tx.setEscrow(stripUndefined({...e, uid: owner}));
    }
    return {order: stripUndefined(incoming), fills: outFills, replayed: false};
  });
}

function tryRead<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

function rememberRequest(map: Record<string, string>, id: string, orderId: string): Record<string, string> {
  const entries = Object.entries(map ?? {}).filter(([k]) => k !== id);
  entries.push([id, orderId]);
  return Object.fromEntries(entries.slice(-MAX_REMEMBERED_REQUESTS));
}

function itemClaim(
  id: string,
  itemKey: string,
  stackKey: string | undefined,
  qty: number,
  instance: InstanceSnapshot | undefined,
  reason: Claim["reason"],
  now: number,
): Claim {
  if (instance) return {id, kind: "instance", itemKey, reason, at: now, instance};
  return {id, kind: "stack", itemKey, reason, at: now, stackKey, qty};
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelOrder
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelOrder(
  store: MarketStore,
  uid: string,
  orderId: unknown,
  now: number,
): Promise<{order: MarketOrder}> {
  if (typeof orderId !== "string" || !orderId || orderId.length > 128) {
    throw new MarketError("invalid-argument", "Which order?");
  }
  return store.run(async (tx) => {
    await gate(tx, uid, {placing: false});
    const order = await tx.order(orderId);
    if (!order || order.ownerUid !== uid) throw new MarketError("not-found", "That order isn't yours or no longer exists.");
    if (order.status !== "open") throw new MarketError("failed-precondition", "That order has already filled or been cancelled.", "not-open");
    const e = cloneEscrow((await tx.escrow(uid)) ?? emptyEscrow(uid, now));
    e.tradeStamps = rate(e.tradeStamps, now, "trade");
    // For the list summary: the top two of this side hold the next best
    // whether or not the cancelled order was the best.
    const top = await tx.book(order.itemKey, order.side, 2);
    const summary = await tx.summary();

    const left = remaining(order);
    const good = REFERENCE_GOODS[order.itemKey];
    if (order.side === "buy") {
      const refund = left * order.unitPrice;
      e.heldGold = Math.max(0, e.heldGold - refund);
      e.claimableGold += refund;
    } else if (left > 0) {
      e.claims.push(itemClaim(`${order.id}-cancel`, order.itemKey, good?.stackKey, left, order.instance, "cancel", now));
    }
    e.openOrders = Math.max(0, e.openOrders - 1);
    e.updatedAt = now;
    const next: MarketOrder = {...order, status: "cancelled", updatedAt: now};
    tx.setOrder(stripUndefined(next));
    tx.setEscrow(stripUndefined(e));
    tx.setSummary(applyBoardChange(summary, {
      itemKey: order.itemKey,
      written: [next],
      sides: [{side: order.side, read: top, limit: 2, qtyDelta: -left}],
    }, now));
    return {order: next};
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// collect
// ─────────────────────────────────────────────────────────────────────────────

export interface CollectResult {
  gold: number;
  delivered: {itemKey: string; qty: number; name?: string}[];
  /** Claims still waiting (bag full). */
  pending: number;
  bagFull: boolean;
}

export async function collect(store: MarketStore, uid: string, now: number): Promise<CollectResult> {
  return store.run(async (tx) => {
    await gate(tx, uid, {placing: false});
    const stored = await tx.escrow(uid);
    const e = cloneEscrow(stored ?? emptyEscrow(uid, now));
    e.collectStamps = rate(e.collectStamps, now, "collect");

    const invDoc = await tx.saveDoc(uid, "inventory");
    const econDoc = await tx.saveDoc(uid, "economy");
    let inv: InvLedger;
    let econ: EconLedger | null = null;
    try {
      inv = readInventory(invDoc, true);
      if (e.claimableGold > 0) econ = readEconomy(econDoc);
    } catch (err) {
      asSaveError(err);
    }
    if (!econ) econ = tryRead(() => readEconomy(econDoc));
    const invBefore = JSON.stringify(inv);
    const econBefore = JSON.stringify(econ);
    inv = reassertInventoryMarks(inv, e.marks);
    if (econ) econ = reassertEconomyMarks(econ, e.marks);

    let gold = 0;
    if (e.claimableGold > 0 && econ) {
      e.econSeq = nextEconomySeq(econ, e.econSeq);
      try {
        const res = applyGoldOp(econ, "credit-gold", Math.floor(e.claimableGold), e.econSeq, now);
        econ = res.ledger;
        e.marks.push({kind: "economy-op", op: res.op, at: now});
      } catch (err) {
        asSaveError(err);
      }
      gold = Math.floor(e.claimableGold);
      e.claimableGold -= gold;
    }

    const delivered: CollectResult["delivered"] = [];
    const left: Claim[] = [];
    let bagFull = false;
    for (const claim of e.claims) {
      if (claim.kind === "stack" && claim.stackKey && claim.qty) {
        e.invSeq += 1;
        const res = grantStackTo(inv, claim.stackKey, claim.qty, `mkt:claim:${claim.id}`, e.invSeq, now);
        if (!res) {
          bagFull = true;
          left.push(claim);
          continue;
        }
        inv = res.ledger;
        e.marks.push({kind: "stack-op", op: res.op, at: now});
        delivered.push({itemKey: claim.itemKey, qty: claim.qty});
      } else if (claim.kind === "instance" && claim.instance) {
        e.invSeq += 1;
        const next = deliverInstance(inv, claim.instance, `mkt-${claim.id}`, e.invSeq, now);
        if (!next) {
          bagFull = true;
          left.push(claim);
          continue;
        }
        inv = next;
        delivered.push({itemKey: claim.itemKey, qty: 1, name: claim.instance.name});
      }
    }
    e.claims = left;
    e.marks = pruneMarks(e.marks, now);
    e.updatedAt = now;

    if (JSON.stringify(inv) !== invBefore) tx.setSaveDoc(uid, "inventory", envelope(invDoc, inv, now));
    if (econ && JSON.stringify(econ) !== econBefore) tx.setSaveDoc(uid, "economy", envelope(econDoc, econ, now));
    tx.setEscrow(stripUndefined(e));
    return {gold, delivered, pending: left.length, bagFull};
  });
}
