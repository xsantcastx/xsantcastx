/**
 * An in-memory MarketStore with Firestore-transaction semantics close enough
 * for the engine's guarantees: reads see committed state, writes are buffered
 * and applied only if the callback resolves (a throw rolls everything back),
 * and a write issued before a read is an error, as it is in Firestore.
 */
import type {MarketStore, MarketTx, SaveWhich} from "../src/market/engine";
import type {BoardSummaryDoc, EscrowDoc, ListedItemDoc, MarketConfigDoc, MarketOrder, MarketTrade, OrderSide, PriceDoc} from "../src/market/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class FakeStore implements MarketStore {
  config: MarketConfigDoc | null = {enabled: true};
  bans = new Set<string>();
  orders = new Map<string, MarketOrder>();
  trades = new Map<string, MarketTrade>();
  prices = new Map<string, PriceDoc>();
  escrows = new Map<string, EscrowDoc>();
  saves = new Map<string, Record<string, any>>();
  listed = new Map<string, ListedItemDoc>();
  summary: BoardSummaryDoc | null = null;
  private seq = 0;
  commits = 0;

  newId(): string {
    this.seq += 1;
    return `o${String(this.seq).padStart(4, "0")}`;
  }

  async run<T>(fn: (tx: MarketTx) => Promise<T>): Promise<T> {
    const writes: (() => void)[] = [];
    const clone = <V>(v: V): V => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));
    const read = <V>(v: V | undefined): V | null => {
      if (writes.length) throw new Error("Firestore transactions require all reads before writes");
      return v === undefined ? null : clone(v);
    };
    const tx: MarketTx = {
      config: async () => read(this.config ?? undefined),
      banned: async (uid) => read(this.bans.has(uid)) === true,
      escrow: async (uid) => read(this.escrows.get(uid)),
      order: async (id) => read(this.orders.get(id)),
      book: async (itemKey: string, side: OrderSide, limit: number) => {
        const rows = [...this.orders.values()]
          .filter((o) => o.itemKey === itemKey && o.side === side && o.status === "open")
          .sort((a, b) => (a.unitPrice !== b.unitPrice ?
            (side === "sell" ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice) :
            a.createdAt - b.createdAt))
          .slice(0, limit);
        return read(rows) as MarketOrder[];
      },
      price: async (k) => read(this.prices.get(k)),
      saveDoc: async (uid, which: SaveWhich) => read(this.saves.get(`${uid}/${which}`)),
      listed: async (id) => read(this.listed.has(id)) === true,
      summary: async () => read(this.summary ?? undefined),
      setOrder: (o) => void writes.push(() => this.orders.set(o.id, clone(o))),
      setTrade: (t) => void writes.push(() => this.trades.set(t.id, clone(t))),
      setPrice: (p) => void writes.push(() => this.prices.set(p.itemKey, clone(p))),
      setEscrow: (e) => void writes.push(() => this.escrows.set(e.uid, clone(e))),
      setSaveDoc: (uid, which, d) => void writes.push(() => this.saves.set(`${uid}/${which}`, clone(d))),
      setListed: (id, d) => void writes.push(() => this.listed.set(id, clone(d))),
      setSummary: (d) => void writes.push(() => {
        this.summary = clone(d);
      }),
    };
    const out = await fn(tx);
    for (const w of writes) w();
    this.commits += 1;
    return out;
  }
}

export const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

/** A minimal current-era inventory save, enveloped as the client stores it. */
export function inventorySave(opts: {
  instances?: Record<string, any>[];
  stacks?: Record<string, number>;
  era?: number;
}): Record<string, any> {
  const records: Record<string, any>[] = [...(opts.instances ?? [])];
  const stackOps: Record<string, any>[] = [];
  let hlc = NOW - 10_000;
  for (const [key, qty] of Object.entries(opts.stacks ?? {})) {
    hlc += 1;
    records.push({
      id: `stack:${key}`, definitionId: key, kind: "stack", category: "materials", tags: ["material", key],
      soulbound: false, acquiredAt: new Date(NOW).toISOString(),
      revision: {hlc, deviceId: "dev-a", sequence: 1}, source: "inventory", stackKey: key, location: {kind: "bag"},
    });
    stackOps.push({id: `grant-${key}`, stackKey: key, kind: "grant", quantity: qty, hlc, deviceId: "dev-a", sequence: 1});
  }
  return {
    v: {
      version: 2, records, tombstones: [], stackOps, stackCheckpoints: [],
      goldFromSales: 0, sold: 0, hlc, legacyBackup: null, era: opts.era ?? 55,
    },
    updatedAt: new Date(NOW).toISOString(),
  };
}

export function instance(id: string, over: Record<string, any> = {}): Record<string, any> {
  return {
    id,
    definitionId: "anchor-ring",
    kind: "instance",
    category: "artifacts",
    tags: ["artifact"],
    rarity: "rare",
    soulbound: false,
    acquiredAt: new Date(NOW - 60_000).toISOString(),
    revision: {hlc: NOW - 60_000, deviceId: "dev-a", sequence: 3},
    source: "inventory",
    name: "Rare Anchor Ring",
    type: "artifact",
    stats: {power: 12, focus: 4},
    rollQuality: {power: 0.8},
    sellValue: 900,
    location: {kind: "bag"},
    ...over,
  };
}

/** An economy save with `gold`, as an op-log ledger with an origin. */
export function economySave(gold: number, opts: {legacy?: boolean} = {}): Record<string, any> {
  if (opts.legacy) {
    return {v: {version: 2, gold, ops: [], origin: null, hlc: 0, applied: {}, cosmetics: []}, updatedAt: ""};
  }
  const origin = {version: 2, gold: 0, ops: [], origin: null, hlc: 0, applied: {}, cosmetics: []};
  const ops = [{id: "dev-a:1", deviceId: "dev-a", seq: 1, kind: "credit-gold", amount: gold, hlc: NOW - 5000, wall: NOW - 5000}];
  return {v: {version: 2, gold, ops, origin, hlc: NOW - 5000, applied: {}, cosmetics: [], totalGoldEarned: gold, runGoldEarned: gold}, updatedAt: ""};
}
