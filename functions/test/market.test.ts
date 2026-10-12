/**
 * Player market — unit tests for matching, tax, bands, rate limits,
 * provenance, escrow idempotency and the escrow-vs-save-merge protocol.
 *
 *   npm --prefix functions test
 *
 * Runs the real engine against an in-memory transactional store; no emulator
 * needed (the Firestore emulator needs a JVM, which this machine lacks).
 */
import {test, describe} from "node:test";
import assert from "node:assert/strict";
import {cancelOrder, collect, MarketError, placeOrder, validatePlaceInput} from "../src/market/engine";
import {matchOrder, sellerTax} from "../src/market/matching";
import {checkBand, recordTrade} from "../src/market/pricing";
import {checkRate} from "../src/market/rate-limit";
import {compareRevision, readEconomy, readInventory, replayGold, stackQuantity} from "../src/market/save-ops";
import {MAX_OPEN_ORDERS, RATE_LIMITS, SELLER_TAX_RATE} from "../src/market/config";
import {REFERENCE_GOODS} from "../src/market/reference.generated";
import {applyBoardChange} from "../src/market/summary";
import type {MarketOrder} from "../src/market/types";
import {FakeStore, NOW, economySave, instance, inventorySave} from "./fake-store";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ORE = "mat:cinder-ore"; // base 420 (pinned below)
const RING = "eq:anchor-ring:rare"; // base 12,000 (pinned below)

// These tests exercise mechanics (bands, escrow, conservation), and every price
// in them was written against the v2 base worths. The v3 economy (ρ = 0.06,
// commit 20af608) regenerated the table to 25 / 720, which put every fixture
// price out of band. Pin the two fixture goods at their v2 worths so the
// arithmetic below stays readable; the generated table itself is checked
// against the live catalogue by src/app/shared/market/market-reference.spec.ts.
(REFERENCE_GOODS as Record<string, {basePrice: number}>)[ORE].basePrice = 420;
(REFERENCE_GOODS as Record<string, {basePrice: number}>)[RING].basePrice = 12_000;

function order(over: Partial<MarketOrder>): MarketOrder {
  return {
    id: "x", side: "sell", itemKey: ORE, kind: "material", qty: 10, filledQty: 0, unitPrice: 400,
    ownerUid: "s", createdAt: NOW, updatedAt: NOW, status: "open", ...over,
  };
}

async function rejects(p: Promise<unknown>, reason: string): Promise<void> {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof MarketError, `expected MarketError, got ${String(err)}`);
    assert.equal(err.reason, reason, err.message);
    return true;
  });
}

function seed(store: FakeStore, uid: string, gold: number, inv: Parameters<typeof inventorySave>[0] = {}): void {
  store.saves.set(`${uid}/economy`, economySave(gold));
  store.saves.set(`${uid}/inventory`, inventorySave(inv));
}

function gold(store: FakeStore, uid: string): number {
  return readEconomy(store.saves.get(`${uid}/economy`)).gold;
}

function stack(store: FakeStore, uid: string, key: string): number {
  return stackQuantity(readInventory(store.saves.get(`${uid}/inventory`), false), key);
}

describe("matching", () => {
  test("price-time priority: cheapest ask first, then oldest at the same price", () => {
    const book = [
      order({id: "late-cheap", unitPrice: 390, createdAt: NOW + 5}),
      order({id: "dear", unitPrice: 410, createdAt: NOW}),
      order({id: "early-cheap", unitPrice: 390, createdAt: NOW + 1}),
    ];
    const fills = matchOrder(order({id: "in", side: "buy", ownerUid: "b", qty: 25, unitPrice: 420}), book);
    assert.deepEqual(fills.map((f) => [f.maker.id, f.qty, f.unitPrice]), [
      ["early-cheap", 10, 390],
      ["late-cheap", 10, 390],
      ["dear", 5, 410],
    ]);
  });

  test("bids match dearest first, and stop at the seller's limit", () => {
    const book = [
      order({id: "low", side: "buy", ownerUid: "b1", unitPrice: 380}),
      order({id: "high", side: "buy", ownerUid: "b2", unitPrice: 405}),
    ];
    const fills = matchOrder(order({id: "in", side: "sell", qty: 30, unitPrice: 390}), book);
    assert.deepEqual(fills.map((f) => [f.maker.id, f.qty, f.unitPrice]), [["high", 10, 405]]);
  });

  test("partial fills respect what is left on a resting order", () => {
    const fills = matchOrder(
      order({id: "in", side: "buy", ownerUid: "b", qty: 4, unitPrice: 500}),
      [order({id: "m", qty: 10, filledQty: 7})],
    );
    assert.deepEqual(fills.map((f) => f.qty), [3]);
  });

  test("never matches an account against itself", () => {
    const fills = matchOrder(order({id: "in", side: "buy", ownerUid: "s", unitPrice: 500}), [order({id: "own"})]);
    assert.equal(fills.length, 0);
  });
});

describe("tax", () => {
  test("seller pays 2%, rounded up", () => {
    assert.equal(SELLER_TAX_RATE, 0.02);
    assert.equal(sellerTax(10_000), 200);
    assert.equal(sellerTax(1), 1);
    assert.equal(sellerTax(0), 0);
  });

  test("a fill credits net proceeds to the seller and conserves Gold", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {stacks: {"cinder-ore": 50}});
    seed(store, "b", 100_000);
    await placeOrder(store, "s", {side: "sell", itemKey: ORE, qty: 20, unitPrice: 400}, NOW);
    const res = await placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 15, unitPrice: 450}, NOW + 1);
    assert.deepEqual(res.fills, [{qty: 15, unitPrice: 400}]);
    assert.equal(res.order.status, "filled");
    const gross = 15 * 400;
    const tax = Math.ceil(gross * 0.02);
    const seller = store.escrows.get("s")!;
    const buyer = store.escrows.get("b")!;
    assert.equal(seller.claimableGold, gross - tax);
    assert.equal(seller.taxPaid, tax);
    assert.equal(buyer.claimableGold, 15 * 50, "price improvement refunded to the buyer");
    assert.equal(buyer.heldGold, 0);
    // Gold out of the buyer's save == seller net + tax + buyer refund.
    assert.equal(100_000 - gold(store, "b"), (gross - tax) + tax + 15 * 50);
    const trade = [...store.trades.values()][0];
    assert.equal(trade.tax, tax);
    assert.equal(trade.maker, "sell");
    // Sell order stays open with 5 left; ore left the seller's save at placement.
    const sell = [...store.orders.values()].find((o) => o.side === "sell")!;
    assert.equal(sell.filledQty, 15);
    assert.equal(sell.status, "open");
    assert.equal(stack(store, "s", "cinder-ore"), 30);
  });
});

describe("price sanity band", () => {
  test("falls back to base worth for an item that has never traded", () => {
    assert.equal(checkBand(420, null, 420, NOW).source, "base");
    assert.equal(checkBand(420 * 4, null, 420, NOW).ok, true);
    assert.equal(checkBand(420 * 4 + 1, null, 420, NOW).ok, false);
    assert.equal(checkBand(104, null, 420, NOW).ok, false);
  });

  test("anchors on the 24h VWAP once there is volume", () => {
    let doc = recordTrade(null, ORE, 800, 10, NOW - 3600_000);
    doc = recordTrade(doc, ORE, 900, 10, NOW - 1800_000);
    doc = recordTrade(doc, ORE, 1000, 10, NOW);
    const band = checkBand(3000, doc, 420, NOW);
    assert.equal(band.source, "vwap");
    assert.equal(band.ok, true);
    assert.equal(checkBand(150, doc, 420, NOW).ok, false, "below vwap / 4");
    assert.equal(checkBand(420 * 8 + 1, doc, 420, NOW).ok, false, "absolute base ceiling");
  });

  test("placeOrder refuses an out-of-band price in plain words", async () => {
    const store = new FakeStore();
    seed(store, "b", 1_000_000);
    await rejects(placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 1, unitPrice: 50_000}, NOW), "price-band");
    assert.equal(gold(store, "b"), 1_000_000, "nothing escrowed on refusal");
  });
});

describe("rate limit", () => {
  test("sliding window", () => {
    const stamps = Array.from({length: 12}, (_, i) => NOW - 50_000 + i);
    assert.equal(checkRate(stamps, NOW, RATE_LIMITS.trade).ok, false);
    assert.equal(checkRate(stamps, NOW + 11_000, RATE_LIMITS.trade).ok, true);
  });

  test("the 13th placement in a minute is refused", async () => {
    const store = new FakeStore();
    seed(store, "b", 10_000_000);
    for (let i = 0; i < RATE_LIMITS.trade.perMinute; i++) {
      await placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 1, unitPrice: 400}, NOW + i);
    }
    await rejects(placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 1, unitPrice: 400}, NOW + 100), "rate-limited");
  });

  test("open-order cap", async () => {
    const store = new FakeStore();
    seed(store, "b", 100_000_000);
    for (let i = 0; i < MAX_OPEN_ORDERS; i++) {
      await placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 1, unitPrice: 400}, NOW + i * 10_000);
    }
    await rejects(placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 1, unitPrice: 400}, NOW + 9e6), "too-many-orders");
  });
});

describe("provenance", () => {
  test("refuses to list an instance that is not in the cloud save", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {instances: [instance("ring-1")]});
    await rejects(placeOrder(store, "s", {side: "sell", itemKey: RING, qty: 1, unitPrice: 12_000, instanceId: "ring-404"}, NOW), "not-owned");
  });

  test("refuses equipped, soulbound and mismatched items", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {instances: [
      instance("worn", {location: {kind: "equipped", slotId: "trinket"}}),
      instance("bound", {soulbound: true}),
      instance("epic", {rarity: "epic"}),
    ]});
    const sell = (id: string) => placeOrder(store, "s", {side: "sell", itemKey: RING, qty: 1, unitPrice: 12_000, instanceId: id}, NOW);
    await rejects(sell("worn"), "in-use");
    await rejects(sell("bound"), "soulbound");
    await rejects(sell("epic"), "wrong-item");
  });

  test("refuses to sell more of a stack than the save holds", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {stacks: {"cinder-ore": 5}});
    await rejects(placeOrder(store, "s", {side: "sell", itemKey: ORE, qty: 6, unitPrice: 400}, NOW), "not-enough");
  });

  test("refuses a buy the cloud Gold cannot cover", async () => {
    const store = new FakeStore();
    seed(store, "b", 1_000);
    await rejects(placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 3, unitPrice: 400}, NOW), "not-enough-gold");
  });

  test("an item id is burned once listed: a resurrected copy cannot be re-listed", async () => {
    const store = new FakeStore();
    const original = inventorySave({instances: [instance("ring-1")]});
    seed(store, "s", 0);
    store.saves.set("s/inventory", original);
    const placed = await placeOrder(store, "s", {side: "sell", itemKey: RING, qty: 1, unitPrice: 12_000, instanceId: "ring-1"}, NOW);
    await cancelOrder(store, "s", placed.order.id, NOW + 1);
    // A hostile client writes its old save back over the server's tombstone.
    store.saves.set("s/inventory", original);
    await rejects(
      placeOrder(store, "s", {side: "sell", itemKey: RING, qty: 1, unitPrice: 12_000, instanceId: "ring-1"}, NOW + 2),
      "already-listed",
    );
  });

  test("feature flag and bans gate every call", async () => {
    const store = new FakeStore();
    seed(store, "b", 10_000);
    store.config = {enabled: false};
    await rejects(placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 1, unitPrice: 400}, NOW), "market-closed");
    await rejects(collect(store, "b", NOW), "market-closed");
    store.config = {enabled: true};
    store.bans.add("b");
    await rejects(placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 1, unitPrice: 400}, NOW), "banned");
  });

  test("input validation", () => {
    assert.throws(() => validatePlaceInput({side: "buy", itemKey: "mat:nope", qty: 1, unitPrice: 1}));
    assert.throws(() => validatePlaceInput({side: "buy", itemKey: ORE, qty: 1.5, unitPrice: 1}));
    assert.throws(() => validatePlaceInput({side: "sell", itemKey: RING, qty: 1, unitPrice: 100}), /Choose which item/);
    assert.throws(() => validatePlaceInput({side: "sell", itemKey: RING, qty: 2, unitPrice: 100, instanceId: "a"}));
    assert.equal(validatePlaceInput({side: "buy", itemKey: ORE, qty: 2, unitPrice: 400}).qty, 2);
  });
});

describe("escrow idempotency", () => {
  test("a retried placement returns the original order and escrows once", async () => {
    const store = new FakeStore();
    seed(store, "b", 10_000);
    const input = {side: "buy" as const, itemKey: ORE, qty: 5, unitPrice: 400, clientRequestId: "req-abcdef12"};
    const first = await placeOrder(store, "b", input, NOW);
    const again = await placeOrder(store, "b", input, NOW + 1);
    assert.equal(again.replayed, true);
    assert.equal(again.order.id, first.order.id);
    assert.equal(gold(store, "b"), 10_000 - 2_000);
    assert.equal(store.orders.size, 1);
  });

  test("collect delivers each claim exactly once", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {instances: [instance("ring-1")]});
    seed(store, "b", 50_000);
    await placeOrder(store, "s", {side: "sell", itemKey: RING, qty: 1, unitPrice: 12_000, instanceId: "ring-1"}, NOW);
    await placeOrder(store, "b", {side: "buy", itemKey: RING, qty: 1, unitPrice: 12_500}, NOW + 1);

    const b1 = await collect(store, "b", NOW + 2);
    const b2 = await collect(store, "b", NOW + 3);
    assert.equal(b1.delivered.length, 1);
    assert.equal(b1.gold, 500, "price improvement refund");
    assert.equal(b2.delivered.length, 0);
    assert.equal(b2.gold, 0);
    const inv = readInventory(store.saves.get("b/inventory"), false);
    const rings = inv.records.filter((r) => r["definitionId"] === "anchor-ring");
    assert.equal(rings.length, 1);
    assert.deepEqual(rings[0]["stats"], {power: 12, focus: 4}, "the exact roll travels");
    assert.equal(gold(store, "b"), 50_000 - 12_500 + 500);

    const s1 = await collect(store, "s", NOW + 4);
    await collect(store, "s", NOW + 5);
    assert.equal(s1.gold, 12_000 - sellerTax(12_000));
    assert.equal(gold(store, "s"), 12_000 - sellerTax(12_000));
  });

  test("a failed transaction leaves nothing behind", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {stacks: {"cinder-ore": 3}});
    const before = JSON.stringify([...store.saves.entries()]);
    await rejects(placeOrder(store, "s", {side: "sell", itemKey: ORE, qty: 10, unitPrice: 400}, NOW), "not-enough");
    assert.equal(JSON.stringify([...store.saves.entries()]), before);
    assert.equal(store.escrows.size, 0);
  });

  test("cancel returns the unfilled remainder, once", async () => {
    const store = new FakeStore();
    seed(store, "b", 10_000);
    const placed = await placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 10, unitPrice: 400}, NOW);
    assert.equal(gold(store, "b"), 6_000);
    await cancelOrder(store, "b", placed.order.id, NOW + 1);
    await rejects(cancelOrder(store, "b", placed.order.id, NOW + 2), "not-open");
    await collect(store, "b", NOW + 3);
    assert.equal(gold(store, "b"), 10_000);
  });

  test("bag full: instance claims wait instead of evicting", async () => {
    const store = new FakeStore();
    const full = Array.from({length: 250}, (_, i) => instance(`filler-${i}`, {definitionId: "anchor-ring", rarity: "uncommon"}));
    seed(store, "b", 50_000, {instances: full});
    seed(store, "s", 0, {instances: [instance("ring-1")]});
    await placeOrder(store, "s", {side: "sell", itemKey: RING, qty: 1, unitPrice: 12_000, instanceId: "ring-1"}, NOW);
    await placeOrder(store, "b", {side: "buy", itemKey: RING, qty: 1, unitPrice: 12_000}, NOW + 1);
    const res = await collect(store, "b", NOW + 2);
    assert.equal(res.bagFull, true);
    assert.equal(res.pending, 1);
    assert.equal(store.escrows.get("b")!.claims.length, 1);
  });
});

describe("escrow vs. save merge", () => {
  test("the escrow tombstone out-revisions a later edit by a device that has not synced", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {instances: [instance("ring-1")]});
    await placeOrder(store, "s", {side: "sell", itemKey: RING, qty: 1, unitPrice: 12_000, instanceId: "ring-1"}, NOW);
    const inv = readInventory(store.saves.get("s/inventory"), false);
    const tomb = inv.tombstones.find((t) => t["id"] === "ring-1")!;
    assert.ok(tomb);
    assert.equal(inv.records.some((r) => r["id"] === "ring-1"), false);
    // A stale device upgrades the ring an hour later, wall-clock stamped.
    const laterEdit = {hlc: NOW + 3600_000, deviceId: "dev-b", sequence: 9};
    assert.ok(compareRevision(tomb["revision"], laterEdit) > 0);
  });

  test("a client overwrite is undone on the next market call (stacks and Gold)", async () => {
    const store = new FakeStore();
    seed(store, "s", 10_000, {stacks: {"cinder-ore": 40}});
    const staleInv = store.saves.get("s/inventory");
    const staleEcon = store.saves.get("s/economy");
    await placeOrder(store, "s", {side: "sell", itemKey: ORE, qty: 30, unitPrice: 400}, NOW);
    await placeOrder(store, "s", {side: "buy", itemKey: "mat:slag-fragment", qty: 10, unitPrice: 16}, NOW + 1);
    assert.equal(stack(store, "s", "cinder-ore"), 10);
    assert.equal(gold(store, "s"), 10_000 - 160);
    // "Keep this device" writes the pre-market save back wholesale.
    store.saves.set("s/inventory", staleInv!);
    store.saves.set("s/economy", staleEcon!);
    assert.equal(stack(store, "s", "cinder-ore"), 40);
    await collect(store, "s", NOW + 2);
    assert.equal(stack(store, "s", "cinder-ore"), 10, "consume op re-asserted");
    assert.equal(gold(store, "s"), 10_000 - 160, "spend op re-asserted");
  });

  test("a legacy (log-free) Gold ledger gets its pre-op origin pinned", async () => {
    const store = new FakeStore();
    store.saves.set("b/economy", economySave(5_000, {legacy: true}));
    store.saves.set("b/inventory", inventorySave({}));
    await placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 2, unitPrice: 400}, NOW);
    const econ = readEconomy(store.saves.get("b/economy"));
    assert.equal(econ.gold, 4_200);
    assert.equal((econ.origin as any).gold, 5_000);
    assert.equal(replayGold(econ), 4_200, "origin + ops replays to the stored balance");
  });

  test("refuses a save from another inventory era", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {stacks: {"cinder-ore": 40}, era: 54});
    await rejects(placeOrder(store, "s", {side: "sell", itemKey: ORE, qty: 1, unitPrice: 400}, NOW), "save-era");
  });
});

describe("board summary (market/v1/summary/board)", () => {
  /** The board recomputed from every order, to hold the incremental summary against. */
  function truth(store: FakeStore, itemKey: string) {
    const open = [...store.orders.values()].filter((o) => o.itemKey === itemKey && o.status === "open" && o.qty > o.filledQty);
    const side = (s: "buy" | "sell") => open.filter((o) => o.side === s);
    const best = (s: "buy" | "sell") => {
      const p = side(s).map((o) => o.unitPrice);
      return p.length ? (s === "buy" ? Math.max(...p) : Math.min(...p)) : null;
    };
    const qty = (s: "buy" | "sell") => side(s).reduce((n, o) => n + o.qty - o.filledQty, 0);
    return {bestBid: best("buy"), bestAsk: best("sell"), bidQty: qty("buy"), askQty: qty("sell")};
  }
  function row(store: FakeStore, itemKey: string) {
    const r = store.summary?.rows[itemKey];
    return r ? {bestBid: r.bestBid, bestAsk: r.bestAsk, bidQty: r.bidQty, askQty: r.askQty} : undefined;
  }

  test("tracks best prices and depth through placements, fills and cancels", async () => {
    const store = new FakeStore();
    seed(store, "s1", 0, {stacks: {"cinder-ore": 200}});
    seed(store, "s2", 0, {stacks: {"cinder-ore": 200}});
    seed(store, "b1", 1_000_000);
    seed(store, "b2", 1_000_000);
    await placeOrder(store, "s1", {side: "sell", itemKey: ORE, qty: 20, unitPrice: 410}, NOW);
    assert.deepEqual(row(store, ORE), truth(store, ORE));
    await placeOrder(store, "s2", {side: "sell", itemKey: ORE, qty: 10, unitPrice: 400}, NOW + 1);
    await placeOrder(store, "b1", {side: "buy", itemKey: ORE, qty: 5, unitPrice: 380}, NOW + 2);
    assert.deepEqual(row(store, ORE), {bestBid: 380, bestAsk: 400, bidQty: 5, askQty: 30});
    // Sweeps the 400 level and part of 410; the buy fills completely.
    const sweep = await placeOrder(store, "b2", {side: "buy", itemKey: ORE, qty: 15, unitPrice: 420}, NOW + 3);
    assert.equal(sweep.order.status, "filled");
    assert.deepEqual(row(store, ORE), truth(store, ORE));
    assert.deepEqual(row(store, ORE), {bestBid: 380, bestAsk: 410, bidQty: 5, askQty: 15});
    assert.equal(store.summary!.rows[ORE].lastPrice, 410);
    assert.equal(store.summary!.rows[ORE].volume24h, 15);
    // A buy that clears the asks rests its remainder as the new best bid.
    await placeOrder(store, "b1", {side: "buy", itemKey: ORE, qty: 25, unitPrice: 410}, NOW + 4);
    assert.deepEqual(row(store, ORE), truth(store, ORE));
    assert.deepEqual(row(store, ORE), {bestBid: 410, bestAsk: null, bidQty: 15, askQty: 0});
    // Cancelling the best bid falls back to the next one.
    const top = [...store.orders.values()].find((o) => o.side === "buy" && o.status === "open" && o.unitPrice === 410)!;
    await cancelOrder(store, "b1", top.id, NOW + 5);
    assert.deepEqual(row(store, ORE), {bestBid: 380, bestAsk: null, bidQty: 5, askQty: 0});
  });

  test("a cancel below the best leaves the best alone", async () => {
    const store = new FakeStore();
    seed(store, "s", 0, {stacks: {"cinder-ore": 100}});
    await placeOrder(store, "s", {side: "sell", itemKey: ORE, qty: 4, unitPrice: 400}, NOW);
    const deep = await placeOrder(store, "s", {side: "sell", itemKey: ORE, qty: 6, unitPrice: 450}, NOW + 1);
    await placeOrder(store, "s", {side: "sell", itemKey: ORE, qty: 3, unitPrice: 470}, NOW + 2);
    await cancelOrder(store, "s", deep.order.id, NOW + 3);
    assert.deepEqual(row(store, ORE), {bestBid: null, bestAsk: 400, bidQty: 0, askQty: 7});
  });

  test("a refused placement writes no summary", async () => {
    const store = new FakeStore();
    seed(store, "b", 10);
    await rejects(placeOrder(store, "b", {side: "buy", itemKey: ORE, qty: 10, unitPrice: 400}, NOW), "not-enough-gold");
    assert.equal(store.summary, null);
  });

  test("rows drop off once nothing rests and the last trade is a day old", () => {
    const quiet = {bestBid: null, bestAsk: null, bidQty: 0, askQty: 0, lastPrice: 5, lastTradeAt: NOW - 25 * 3_600_000, volume24h: 3, vwap24h: 5};
    const next = applyBoardChange({rows: {"mat:old": quiet}, updatedAt: NOW - 1}, {
      itemKey: ORE,
      written: [order({id: "n", side: "buy", unitPrice: 390, qty: 2})],
      sides: [{side: "buy", read: [], limit: 1, qtyDelta: 2}],
    }, NOW);
    assert.deepEqual(Object.keys(next.rows), [ORE]);
    assert.equal(next.rows[ORE].bestBid, 390);
    assert.equal(next.rows[ORE].bidQty, 2);
  });

  test("a partial read keeps the running quantity; a complete read heals drift", () => {
    const prev = {rows: {[ORE]: {bestBid: null, bestAsk: 400, bidQty: 0, askQty: 500, lastPrice: 0, lastTradeAt: 0, volume24h: 0, vwap24h: 0}}, updatedAt: NOW};
    const top = order({id: "t", unitPrice: 400, qty: 10});
    const partial = applyBoardChange(prev, {itemKey: ORE, written: [], sides: [{side: "sell", read: [top], limit: 1, qtyDelta: 0}]}, NOW);
    assert.equal(partial.rows[ORE].askQty, 500);
    const complete = applyBoardChange(prev, {itemKey: ORE, written: [], sides: [{side: "sell", read: [top], limit: 2, qtyDelta: 0}]}, NOW);
    assert.equal(complete.rows[ORE].askQty, 10);
  });
});
