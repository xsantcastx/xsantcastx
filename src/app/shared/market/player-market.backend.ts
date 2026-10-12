/**
 * player-market.backend.ts — the Firebase edge of the player market.
 *
 * Everything that touches the network sits behind {@link MarketBackend}, so
 * `PlayerMarketService` can be specced with a fake and so the Firestore and
 * Functions SDKs are only ever imported dynamically: nothing here is on the
 * initial bundle, and a visitor who never opens the market never loads either.
 */
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { ensureFirebaseApp, whenAppCheckReady } from '../../app-check.bootstrap';
import type {
  MarketEscrow,
  MarketOrder,
  MarketPrice,
  MarketSummary,
  MarketTrade,
  OrderSide,
} from './player-market.model';
import { PLAYER_MARKET_MODE } from './player-market.mode';
import { FakeMarketBackend } from './player-market.fake-backend';

export interface MarketConfig {
  enabled?: boolean;
  haltNewOrders?: boolean;
}

export type MarketCallable = 'placeOrder' | 'cancelOrder' | 'collect';

export interface MarketBackend {
  /** Invoke `market-<name>`. Rejects with the SDK's FunctionsError on refusal. */
  call<T>(name: MarketCallable, data: unknown): Promise<T>;
  watchConfig(): Observable<MarketConfig | null>;
  /** Open orders on one side, best price first, up to `limit`. */
  watchBook(itemKey: string, side: OrderSide, limit: number): Observable<MarketOrder[]>;
  watchPrice(itemKey: string): Observable<MarketPrice | null>;
  watchTrades(itemKey: string, limit: number): Observable<MarketTrade[]>;
  watchMyOrders(uid: string, limit: number): Observable<MarketOrder[]>;
  watchEscrow(uid: string): Observable<MarketEscrow | null>;
  /**
   * `market/v1/summary/board`: best bid/ask, depth and 24h figures for every
   * item with a live market — the whole Exchange list in one document. The
   * server rewrites it inside each placement/cancel transaction.
   */
  watchSummary(): Observable<MarketSummary | null>;
}

/**
 * Firebase in production. The in-memory fake only when the dev-only
 * `?market=fake` mode resolved (see player-market.mode.ts) — a production
 * build can never select it, because that mode needs `isDevMode()`.
 */
export const PLAYER_MARKET_BACKEND = new InjectionToken<MarketBackend>('PLAYER_MARKET_BACKEND', {
  providedIn: 'root',
  factory: () => inject(PLAYER_MARKET_MODE).mode === 'fake'
    ? inject(FakeMarketBackend)
    : inject(FirebaseMarketBackend),
});

const ROOT = ['market', 'v1'] as const;

@Injectable({ providedIn: 'root' })
export class FirebaseMarketBackend implements MarketBackend {
  private readonly lazy = inject(LazyFirestoreService);
  private functions: Promise<{
    api: typeof import('firebase/functions');
    fns: import('firebase/functions').Functions;
  }> | null = null;

  async call<T>(name: MarketCallable, data: unknown): Promise<T> {
    await whenAppCheckReady();
    if (!this.functions) {
      this.functions = import('firebase/functions').then(api => ({
        api,
        fns: api.getFunctions(ensureFirebaseApp(), 'us-central1'),
      }));
    }
    const { api, fns } = await this.functions;
    const res = await api.httpsCallable(fns, `market-${name}`, { timeout: 30_000 })(data);
    return res.data as T;
  }

  watchConfig(): Observable<MarketConfig | null> {
    return this.watch(async ({ api, db }, next, fail) =>
      api.onSnapshot(api.doc(db, ROOT[0], ROOT[1]), s => next(s.exists() ? (s.data() as MarketConfig) : null), fail));
  }

  watchBook(itemKey: string, side: OrderSide, limit: number): Observable<MarketOrder[]> {
    return this.watch(async ({ api, db }, next, fail) => {
      const q = api.query(
        api.collection(db, ROOT[0], ROOT[1], 'orders'),
        api.where('itemKey', '==', itemKey),
        api.where('side', '==', side),
        api.where('status', '==', 'open'),
        api.orderBy('unitPrice', side === 'sell' ? 'asc' : 'desc'),
        api.orderBy('createdAt', 'asc'),
        api.limit(limit),
      );
      return api.onSnapshot(q, s => next(s.docs.map(d => d.data() as MarketOrder)), fail);
    });
  }

  watchPrice(itemKey: string): Observable<MarketPrice | null> {
    return this.watch(async ({ api, db }, next, fail) =>
      api.onSnapshot(
        api.doc(db, ROOT[0], ROOT[1], 'prices', itemKey),
        s => next(s.exists() ? (s.data() as MarketPrice) : null),
        fail,
      ));
  }

  watchTrades(itemKey: string, limit: number): Observable<MarketTrade[]> {
    return this.watch(async ({ api, db }, next, fail) => {
      const q = api.query(
        api.collection(db, ROOT[0], ROOT[1], 'trades'),
        api.where('itemKey', '==', itemKey),
        api.orderBy('executedAt', 'desc'),
        api.limit(limit),
      );
      return api.onSnapshot(q, s => next(s.docs.map(d => d.data() as MarketTrade)), fail);
    });
  }

  watchMyOrders(uid: string, limit: number): Observable<MarketOrder[]> {
    return this.watch(async ({ api, db }, next, fail) => {
      const q = api.query(
        api.collection(db, ROOT[0], ROOT[1], 'orders'),
        api.where('ownerUid', '==', uid),
        api.orderBy('createdAt', 'desc'),
        api.limit(limit),
      );
      return api.onSnapshot(q, s => next(s.docs.map(d => d.data() as MarketOrder)), fail);
    });
  }

  watchEscrow(uid: string): Observable<MarketEscrow | null> {
    return this.watch(async ({ api, db }, next, fail) =>
      api.onSnapshot(
        api.doc(db, ROOT[0], ROOT[1], 'escrow', uid),
        s => next(s.exists() ? (s.data() as MarketEscrow) : null),
        fail,
      ));
  }

  /**
   * One document listener for the whole list: one read on attach and one per
   * market write, instead of re-reading every changed order and price doc.
   */
  watchSummary(): Observable<MarketSummary | null> {
    return this.watch(async ({ api, db }, next, fail) =>
      api.onSnapshot(
        api.doc(db, ROOT[0], ROOT[1], 'summary', 'board'),
        s => next(s.exists() ? (s.data() as MarketSummary) : null),
        fail,
      ));
  }

  /**
   * One snapshot listener as an Observable: subscribes lazily, re-enters the
   * Angular zone on every emission, and detaches on unsubscribe — including an
   * unsubscribe that lands before the SDK has finished loading.
   */
  private watch<T>(
    open: (
      handle: { api: typeof import('firebase/firestore'); db: import('firebase/firestore').Firestore },
      next: (value: T) => void,
      fail: (err: Error) => void,
    ) => Promise<() => void>,
  ): Observable<T> {
    return new Observable<T>(sub => {
      let stop: (() => void) | null = null;
      let closed = false;
      void this.lazy.get().then(async handle => {
        if (closed) return;
        if (!handle) {
          sub.error(new Error('offline'));
          return;
        }
        await whenAppCheckReady();
        if (closed) return;
        stop = await open(
          handle,
          value => this.lazy.runInZone(() => sub.next(value)),
          err => this.lazy.runInZone(() => sub.error(err)),
        );
        if (closed) stop();
      }).catch(err => sub.error(err));
      return () => {
        closed = true;
        stop?.();
      };
    });
  }
}
