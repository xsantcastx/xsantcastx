/**
 * player-market.service.ts — what the Grand Exchange UI binds to when the
 * player-run market is live.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS, AND WHAT IT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * The order book, the matching, the escrow and the tax all live on the server
 * (`functions/src/market/`). This service is a reader and a messenger: it
 * streams the book, prices and the player's own orders out of Firestore, and
 * it asks the market functions to place, cancel and collect. It never moves an
 * item or a coin itself — the server edits the cloud save, and this service
 * then pulls the save back down so the bag and the Gold rail catch up.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAZINESS
 * ─────────────────────────────────────────────────────────────────────────────
 * `providedIn: 'root'` but imported by nothing on the eager path, so it lands in
 * whichever lazy chunk first injects it. The Firestore and Functions SDKs are
 * dynamic imports inside the backend, and with the client flag off nothing is
 * fetched at all.
 *
 * Every mutation resolves to a `MarketResult` and never rejects, so a template
 * can bind to `.error` directly — the sentences are already written for a
 * player.
 */
import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { CloudSaveService } from '../cloud-save/cloud-save.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { MarketConfig, PLAYER_MARKET_BACKEND } from './player-market.backend';
import { FAKE_MARKET_UID } from './player-market.fake-backend';
import { PLAYER_MARKET_MODE } from './player-market.mode';
import {
  CollectResult,
  MarketAccess,
  MarketBoardRow,
  MarketEscrow,
  MarketOrder,
  MarketPrice,
  MarketResult,
  MarketTrade,
  OrderBook,
  PLAYER_MARKET_CLIENT_ENABLED,
  PendingAction,
  PlaceOrderInput,
  PlaceOrderResult,
  boardFromSummary,
  buildBook,
  describeMarketError,
  emptyBook,
  newClientRequestId,
  precheckOrder,
} from './player-market.model';

/** Depth fetched per side of the book. The UI shows the top of it. */
const BOOK_DEPTH = 50;

/**
 * The two save-sync moves the market needs, behind a seam for the specs.
 *
 * `flush` pushes this device's pending writes before a sell, so an item picked
 * up a second ago is in the cloud copy the server checks. `pull` re-reads the
 * cloud after the server edited it (escrow out, deliveries in) and hands the
 * result to the live services — the same unthrottled merge the gateway runs on
 * sign-in, without the merge dialog (`attach` with no `ask` always merges).
 */
@Injectable({ providedIn: 'root' })
export class PlayerMarketSaveSync {
  private readonly gateway = inject(GameStateGateway);
  private readonly cloud = inject(CloudSaveService);
  private readonly lazy = inject(LazyFirestoreService);
  /** The dev fake never edits the save, so there is nothing to push or pull. */
  private readonly fake = inject(PLAYER_MARKET_MODE).mode === 'fake';

  async flush(): Promise<void> {
    if (this.fake) return;
    await this.gateway.flushNow();
  }

  async pull(): Promise<void> {
    if (this.fake) return;
    const uid = this.cloud.status.uid;
    const fs = await this.lazy.get();
    if (!uid || !fs) return;
    await this.gateway.attach(uid, fs);
  }
}

@Injectable({ providedIn: 'root' })
export class PlayerMarketService {
  private readonly backend = inject(PLAYER_MARKET_BACKEND);
  private readonly cloud = inject(CloudSaveService);
  private readonly sync = inject(PlayerMarketSaveSync);
  private readonly mode = inject(PLAYER_MARKET_MODE);

  /**
   * Overridable in specs. Production: the compile-time flag (`live`), or the
   * dev-only fake (`?market=fake`, see player-market.mode.ts).
   */
  protected clientEnabled(): boolean {
    return PLAYER_MARKET_CLIENT_ENABLED || this.mode.mode === 'fake';
  }

  private readonly pending$$ = new BehaviorSubject<PendingAction[]>([]);
  /** Actions in flight. Render optimistic rows from `input` / grey out `orderId`. */
  readonly pending$: Observable<PendingAction[]> = this.pending$$.asObservable();

  /** The fake's own "account": signed in unless `?market=fake-guest`. */
  private readonly fakeUid$$ = new BehaviorSubject<string | null>(
    this.mode.scenario === 'guest' ? null : FAKE_MARKET_UID);

  private readonly uid$: Observable<string | null> = (this.mode.mode === 'fake'
    ? this.fakeUid$$.asObservable()
    : this.cloud.status$.pipe(map(s => s.uid))
  ).pipe(distinctUntilChanged());

  private signedIn(): boolean {
    return this.mode.mode === 'fake' ? this.fakeUid$$.value !== null : this.cloud.signedIn;
  }

  /** The sign-in button. In the fake it just flips the fake account on. */
  async signIn(): Promise<void> {
    if (this.mode.mode === 'fake') {
      this.fakeUid$$.next(FAKE_MARKET_UID);
      return;
    }
    await this.cloud.signIn();
  }

  /** Whether this is the dev-only in-memory market (the UI shows a ribbon). */
  get isFake(): boolean {
    return this.mode.mode === 'fake';
  }

  private config$?: Observable<MarketConfig | null>;
  private access$$?: Observable<MarketAccess>;

  /**
   * Can this visitor trade right now, and if not, why.
   *
   *   disabled    — client flag off. Keep rendering the simulated Exchange.
   *   closed      — the server switch is off (or halted); show `reason`.
   *   signed-out  — show "Sign in to trade" with the sign-in button.
   *   ready       — trade. `haltNewOrders` greys out the order ticket only.
   */
  get access$(): Observable<MarketAccess> {
    if (!this.access$$) {
      this.access$$ = !this.clientEnabled()
        ? of<MarketAccess>({ state: 'disabled' })
        : combineLatest([this.configStream(), this.uid$]).pipe(
            map(([config, uid]): MarketAccess => {
              if (!config?.enabled) return { state: 'closed', reason: "The player market isn't open yet." };
              if (!uid) return { state: 'signed-out' };
              return { state: 'ready', uid, haltNewOrders: config.haltNewOrders === true };
            }),
            shareReplay({ bufferSize: 1, refCount: true }),
          );
    }
    return this.access$$;
  }

  private configStream(): Observable<MarketConfig | null> {
    if (!this.config$) {
      this.config$ = this.backend.watchConfig().pipe(
        catchError(() => of(null)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }
    return this.config$;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  private readonly books = new Map<string, Observable<OrderBook>>();
  private readonly prices = new Map<string, Observable<MarketPrice | null>>();

  /** The live order book for one item. Public: works signed out. */
  book$(itemKey: string): Observable<OrderBook> {
    if (!this.clientEnabled()) return of(emptyBook(itemKey, false));
    let stream = this.books.get(itemKey);
    if (!stream) {
      stream = combineLatest([
        this.backend.watchBook(itemKey, 'buy', BOOK_DEPTH),
        this.backend.watchBook(itemKey, 'sell', BOOK_DEPTH),
      ]).pipe(
        map(([bids, asks]) => buildBook(itemKey, bids, asks)),
        startWith(emptyBook(itemKey)),
        catchError(() => of(emptyBook(itemKey, false))),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.books.set(itemKey, stream);
    }
    return stream;
  }

  /** Last price, 24h volume / VWAP and hourly buckets (for charts). */
  price$(itemKey: string): Observable<MarketPrice | null> {
    if (!this.clientEnabled()) return of(null);
    let stream = this.prices.get(itemKey);
    if (!stream) {
      stream = this.backend.watchPrice(itemKey).pipe(
        catchError(() => of(null)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.prices.set(itemKey, stream);
    }
    return stream;
  }

  /** Most recent trades for one item, newest first. */
  trades$(itemKey: string, limit = 30): Observable<MarketTrade[]> {
    if (!this.clientEnabled()) return of([]);
    return this.backend.watchTrades(itemKey, limit).pipe(catchError(() => of([])));
  }

  private board$$?: Observable<MarketBoardRow[]>;

  /**
   * Every item with a live player market (a resting order or a trade in the
   * last day), busiest first, with best bid/ask and 24h price and volume.
   * Public: works signed out.
   *
   * One document listener (`market/v1/summary/board`, server-written in the
   * same transaction as each order change). Depth is only fetched by `book$`
   * for the item the player opens.
   */
  get board$(): Observable<MarketBoardRow[]> {
    if (!this.clientEnabled()) return of([]);
    if (!this.board$$) {
      this.board$$ = this.backend.watchSummary().pipe(
        catchError(() => of(null)),
        map(summary => boardFromSummary(summary, this.now())),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }
    return this.board$$;
  }

  /** Overridable in specs. */
  protected now(): number {
    return Date.now();
  }

  /** This player's orders (open and recent), newest first. Empty signed out. */
  readonly myOrders$: Observable<MarketOrder[]> = this.signedInStream(uid =>
    this.backend.watchMyOrders(uid, 50), [] as MarketOrder[]);

  /** Held Gold, claimable Gold and deliveries waiting. Null signed out. */
  readonly escrow$: Observable<MarketEscrow | null> = this.signedInStream(uid =>
    this.backend.watchEscrow(uid), null as MarketEscrow | null);

  private signedInStream<T>(open: (uid: string) => Observable<T>, empty: T): Observable<T> {
    return new Observable<T>(sub => {
      if (!this.clientEnabled()) {
        sub.next(empty);
        sub.complete();
        return;
      }
      return this.uid$.pipe(
        switchMap(uid => (uid ? open(uid).pipe(catchError(() => of(empty))) : of(empty))),
      ).subscribe(sub);
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Mutations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Post a buy or sell order. It matches immediately against the book where it
   * can; any remainder rests. A sell escrows the item at once; a buy escrows
   * `qty × unitPrice` Gold at once (anything it fills under its limit comes
   * back on collect).
   *
   * Retries are safe when they reuse the request id: the pending action's `id`
   * *is* that id, so a "Retry" button that passes it back cannot place the
   * order twice even if the first response was lost after the server committed
   * (the server answers a repeated id with the original order, `replayed: true`).
   */
  async placeOrder(
    input: PlaceOrderInput,
    opts: { requestId?: string } = {},
  ): Promise<MarketResult<PlaceOrderResult>> {
    const refused = this.refuseUnlessReady() ?? precheckOrder(input);
    if (refused) return { ok: false, error: refused, reason: 'precheck' };
    const clientRequestId = opts.requestId ?? newClientRequestId();
    return this.track({ id: clientRequestId, kind: 'place', input, startedAt: Date.now() }, async () => {
      if (input.side === 'sell') await this.sync.flush().catch(() => undefined);
      const value = await this.backend.call<PlaceOrderResult>('placeOrder', { ...input, clientRequestId });
      void this.sync.pull().catch(() => undefined);
      return value;
    });
  }

  async cancelOrder(orderId: string): Promise<MarketResult<{ order: MarketOrder }>> {
    const refused = this.refuseUnlessReady();
    if (refused) return { ok: false, error: refused, reason: 'precheck' };
    return this.track({ id: `cancel-${orderId}`, kind: 'cancel', orderId, startedAt: Date.now() }, () =>
      this.backend.call<{ order: MarketOrder }>('cancelOrder', { orderId }));
  }

  /** Move proceeds, refunds and bought items from escrow into the save. */
  async collect(): Promise<MarketResult<CollectResult>> {
    const refused = this.refuseUnlessReady();
    if (refused) return { ok: false, error: refused, reason: 'precheck' };
    return this.track({ id: `collect-${Date.now()}`, kind: 'collect', startedAt: Date.now() }, async () => {
      await this.sync.flush().catch(() => undefined);
      const value = await this.backend.call<CollectResult>('collect', {});
      await this.sync.pull().catch(() => undefined);
      return value;
    });
  }

  private refuseUnlessReady(): string | null {
    if (!this.clientEnabled()) return "The player market isn't open yet.";
    if (!this.signedIn()) return 'Sign in to trade.';
    return null;
  }

  private async track<T>(action: PendingAction, run: () => Promise<T>): Promise<MarketResult<T>> {
    this.pending$$.next([...this.pending$$.value, action]);
    try {
      return { ok: true, value: await run() };
    } catch (err) {
      return { ok: false, ...describeMarketError(err) };
    } finally {
      this.pending$$.next(this.pending$$.value.filter(a => a !== action));
    }
  }
}
