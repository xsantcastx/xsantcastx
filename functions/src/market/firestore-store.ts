/**
 * firestore-store.ts — the production {@link MarketStore}, on the Admin SDK.
 *
 * The Admin SDK bypasses security rules, which is the point: the rules refuse
 * every client write under `market/**`, and these functions are the only
 * writers. Each `run` is one Firestore transaction (retried on contention).
 */
import {getApps, initializeApp} from "firebase-admin/app";
import {Firestore, Transaction, getFirestore} from "firebase-admin/firestore";
import {MARKET_ROOT, MARKET_VERSION_DOC} from "./config";
import type {MarketStore, MarketTx, SaveWhich} from "./engine";
import type {EscrowDoc, ListedItemDoc, MarketConfigDoc, MarketOrder, MarketTrade, OrderSide, PriceDoc} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SAVE_PATHS: Record<SaveWhich, [string, string]> = {
  inventory: ["progress", "inventory"],
  economy: ["economy", "state"],
};

export function marketDb(): Firestore {
  if (!getApps().length) initializeApp();
  return getFirestore();
}

export class FirestoreMarketStore implements MarketStore {
  constructor(private readonly db: Firestore = marketDb()) {}

  private get root() {
    return this.db.collection(MARKET_ROOT).doc(MARKET_VERSION_DOC);
  }

  newId(): string {
    return this.root.collection("orders").doc().id;
  }

  run<T>(fn: (tx: MarketTx) => Promise<T>): Promise<T> {
    return this.db.runTransaction((t) => fn(this.adapter(t)), {maxAttempts: 5});
  }

  private adapter(t: Transaction): MarketTx {
    const root = this.root;
    const db = this.db;
    const data = async <T>(ref: FirebaseFirestore.DocumentReference): Promise<T | null> => {
      const snap = await t.get(ref);
      return snap.exists ? (snap.data() as T) : null;
    };
    return {
      config: () => data<MarketConfigDoc>(root),
      banned: async (uid) => {
        const ban = await data<{banned?: boolean}>(db.doc(`users/${uid}/meta/ban`));
        return ban?.banned === true;
      },
      escrow: (uid) => data<EscrowDoc>(root.collection("escrow").doc(uid)),
      order: (id) => data<MarketOrder>(root.collection("orders").doc(id)),
      book: async (itemKey: string, side: OrderSide, limit: number) => {
        const q = root.collection("orders")
          .where("itemKey", "==", itemKey)
          .where("side", "==", side)
          .where("status", "==", "open")
          .orderBy("unitPrice", side === "sell" ? "asc" : "desc")
          .orderBy("createdAt", "asc")
          .limit(limit);
        const snap = await t.get(q);
        return snap.docs.map((d) => d.data() as MarketOrder);
      },
      price: (itemKey) => data<PriceDoc>(root.collection("prices").doc(itemKey)),
      saveDoc: (uid, which) => {
        const [col, doc] = SAVE_PATHS[which];
        return data<Record<string, any>>(db.collection("users").doc(uid).collection(col).doc(doc));
      },
      listed: async (itemId) => (await data<ListedItemDoc>(root.collection("listed").doc(itemId))) !== null,

      setOrder: (o: MarketOrder) => void t.set(root.collection("orders").doc(o.id), o),
      setTrade: (tr: MarketTrade) => void t.set(root.collection("trades").doc(tr.id), tr),
      setPrice: (p: PriceDoc) => void t.set(root.collection("prices").doc(p.itemKey), p),
      setEscrow: (e: EscrowDoc) => void t.set(root.collection("escrow").doc(e.uid), e),
      setSaveDoc: (uid, which, d) => {
        const [col, doc] = SAVE_PATHS[which];
        t.set(db.collection("users").doc(uid).collection(col).doc(doc), d);
      },
      setListed: (itemId: string, doc: ListedItemDoc) => void t.set(root.collection("listed").doc(itemId), doc),
    };
  }
}
