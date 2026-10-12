/**
 * player-market.service.spec.ts — access states, the order of save syncs
 * around a mutation, optimistic pending rows, and plain-words errors. The
 * network is a fake {@link MarketBackend}; the matching itself is specced
 * server-side in functions/test/market.test.ts.
 */
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, Subject, firstValueFrom, of } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { CloudSaveService } from '../cloud-save/cloud-save.service';
import { MarketBackend, MarketCallable, MarketConfig, PLAYER_MARKET_BACKEND } from './player-market.backend';
import { MarketOrder, MarketSummary, PendingAction } from './player-market.model';
import { PlayerMarketSaveSync, PlayerMarketService } from './player-market.service';

@Injectable()
class EnabledMarketService extends PlayerMarketService {
  protected override clientEnabled(): boolean { return true; }
}

class FakeBackend implements MarketBackend {
  readonly config$ = new BehaviorSubject<MarketConfig | null>({ enabled: true });
  readonly asks$ = new BehaviorSubject<MarketOrder[]>([]);
  readonly bids$ = new BehaviorSubject<MarketOrder[]>([]);
  readonly calls: { name: MarketCallable; data: unknown }[] = [];
  respond: (name: MarketCallable, data: unknown) => Promise<unknown> = async () => ({});
  call<T>(name: MarketCallable, data: unknown): Promise<T> {
    this.calls.push({ name, data });
    return this.respond(name, data) as Promise<T>;
  }
  readonly summary$ = new BehaviorSubject<MarketSummary | null>(null);
  /** Every listener the service opened, in order. */
  readonly opened: string[] = [];
  watchConfig(): Observable<MarketConfig | null> { return this.config$; }
  watchBook(k: string, side: 'buy' | 'sell'): Observable<MarketOrder[]> {
    this.opened.push(`book:${k}:${side}`);
    return side === 'sell' ? this.asks$ : this.bids$;
  }
  watchPrice(): Observable<null> { return of(null); }
  watchTrades(): Observable<never[]> { return of([]); }
  watchMyOrders(): Observable<MarketOrder[]> { return of([]); }
  watchEscrow(): Observable<null> { return of(null); }
  watchSummary(): Observable<MarketSummary | null> {
    this.opened.push('summary');
    return this.summary$;
  }
}

class FakeCloud {
  readonly status$$ = new BehaviorSubject<{ uid: string | null }>({ uid: null });
  readonly status$ = this.status$$.asObservable();
  get status() { return this.status$$.value; }
  get signedIn() { return this.status$$.value.uid !== null; }
}

describe('PlayerMarketService', () => {
  let backend: FakeBackend;
  let cloud: FakeCloud;
  let log: string[];
  let market: PlayerMarketService;

  function setup(enabled = true): void {
    TestBed.resetTestingModule();
    backend = new FakeBackend();
    cloud = new FakeCloud();
    log = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: PLAYER_MARKET_BACKEND, useValue: backend },
        { provide: CloudSaveService, useValue: cloud },
        {
          provide: PlayerMarketSaveSync,
          useValue: {
            flush: async () => { log.push('flush'); },
            pull: async () => { log.push('pull'); },
          },
        },
        enabled ? { provide: PlayerMarketService, useClass: EnabledMarketService } : PlayerMarketService,
      ],
    });
    market = TestBed.inject(PlayerMarketService);
  }

  const order = (over: Partial<MarketOrder>): MarketOrder => ({
    id: 'o1', side: 'sell', itemKey: 'mat:cinder-ore', kind: 'material', qty: 5, filledQty: 0,
    unitPrice: 400, ownerUid: 'x', createdAt: 1, updatedAt: 1, status: 'open', ...over,
  });

  it('is fully dormant behind the client flag', async () => {
    setup(false);
    expect(await firstValueFrom(market.access$)).toEqual({ state: 'disabled' });
    const res = await market.placeOrder({ side: 'buy', itemKey: 'mat:cinder-ore', qty: 1, unitPrice: 400 });
    expect(res.ok).toBeFalse();
    expect(backend.calls.length).toBe(0);
  });

  it('reports closed / signed-out / ready', async () => {
    setup();
    backend.config$.next({ enabled: false });
    expect((await firstValueFrom(market.access$)).state).toBe('closed');
    backend.config$.next({ enabled: true });
    expect(await firstValueFrom(market.access$)).toEqual({ state: 'signed-out' });
    cloud.status$$.next({ uid: 'u1' });
    expect(await firstValueFrom(market.access$)).toEqual({ state: 'ready', uid: 'u1', haltNewOrders: false });
  });

  it('refuses to trade signed out, in plain words, without calling the server', async () => {
    setup();
    const res = await market.placeOrder({ side: 'buy', itemKey: 'mat:cinder-ore', qty: 1, unitPrice: 400 });
    expect(res).toEqual({ ok: false, error: 'Sign in to trade.', reason: 'precheck' });
    expect(backend.calls.length).toBe(0);
  });

  it('streams an aggregated book', async () => {
    setup();
    backend.asks$.next([order({ id: 'a', unitPrice: 410 }), order({ id: 'b', unitPrice: 400 })]);
    backend.bids$.next([order({ id: 'c', side: 'buy', unitPrice: 380 })]);
    const book = await firstValueFrom(market.book$('mat:cinder-ore').pipe(filter(b => !b.loading), take(1)));
    expect(book.bestAsk).toBe(400);
    expect(book.bestBid).toBe(380);
  });

  it('builds the list from the one summary document, and opens depth only for the item opened', async () => {
    setup();
    const now = Date.now();
    backend.summary$.next({
      updatedAt: now,
      rows: {
        'mat:cinder-ore': { bestBid: 380, bestAsk: 400, bidQty: 5, askQty: 12, lastPrice: 390, lastTradeAt: now - 60_000, volume24h: 40, vwap24h: 392 },
        'mat:frost': { bestBid: null, bestAsk: 9, bidQty: 0, askQty: 3, lastPrice: 0, lastTradeAt: 0, volume24h: 0, vwap24h: 0 },
      },
    });
    const board = await firstValueFrom(market.board$);
    expect(board.map(r => r.itemKey)).toEqual(['mat:cinder-ore', 'mat:frost']);
    expect(board[0]).toEqual(jasmine.objectContaining({ bestBid: 380, bestAsk: 400, volume24h: 40 }));
    expect(backend.opened).toEqual(['summary']);

    await firstValueFrom(market.book$('mat:frost').pipe(filter(b => !b.loading), take(1)));
    expect(backend.opened).toEqual(['summary', 'book:mat:frost:buy', 'book:mat:frost:sell']);
  });

  it('shows an empty list when the summary is missing or unreadable', async () => {
    setup();
    expect(await firstValueFrom(market.board$)).toEqual([]);
  });

  it('a sell flushes the save first, then calls, then pulls the edited save back', async () => {
    setup();
    cloud.status$$.next({ uid: 'u1' });
    backend.respond = async () => { log.push('call'); return { order: order({}), fills: [], replayed: false }; };
    const res = await market.placeOrder({ side: 'sell', itemKey: 'mat:cinder-ore', qty: 5, unitPrice: 400 });
    expect(res.ok).toBeTrue();
    await Promise.resolve();
    expect(log).toEqual(['flush', 'call', 'pull']);
    const sent = backend.calls[0].data as { clientRequestId: string };
    expect(sent.clientRequestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('a retry can reuse the request id so the server can dedupe it', async () => {
    setup();
    cloud.status$$.next({ uid: 'u1' });
    await market.placeOrder({ side: 'buy', itemKey: 'mat:cinder-ore', qty: 1, unitPrice: 400 }, { requestId: 'retry-12345678' });
    expect((backend.calls[0].data as { clientRequestId: string }).clientRequestId).toBe('retry-12345678');
  });

  it('shows the action as pending while in flight, then clears it', async () => {
    setup();
    cloud.status$$.next({ uid: 'u1' });
    const gate = new Subject<void>();
    backend.respond = () => firstValueFrom(gate).then(() => ({ order: order({}), fills: [], replayed: false }));
    const seen: PendingAction[][] = [];
    const sub = market.pending$.subscribe(p => seen.push(p));
    const running = market.placeOrder({ side: 'buy', itemKey: 'mat:cinder-ore', qty: 2, unitPrice: 400 });
    await Promise.resolve();
    expect(seen[seen.length - 1].length).toBe(1);
    expect(seen[seen.length - 1][0].input?.qty).toBe(2);
    gate.next();
    await running;
    expect(seen[seen.length - 1].length).toBe(0);
    sub.unsubscribe();
  });

  it('passes the server refusal through as a sentence and never rejects', async () => {
    setup();
    cloud.status$$.next({ uid: 'u1' });
    backend.respond = async () => {
      throw { code: 'functions/failed-precondition', message: 'Try between 105 and 1,680 Gold.', details: { reason: 'price-band' } };
    };
    const res = await market.placeOrder({ side: 'buy', itemKey: 'mat:cinder-ore', qty: 1, unitPrice: 9_999 });
    expect(res).toEqual({ ok: false, error: 'Try between 105 and 1,680 Gold.', reason: 'price-band' });
  });

  it('collect pulls the save after the server delivers', async () => {
    setup();
    cloud.status$$.next({ uid: 'u1' });
    backend.respond = async () => { log.push('call'); return { gold: 10, delivered: [], pending: 0, bagFull: false }; };
    const res = await market.collect();
    expect(res.ok).toBeTrue();
    expect(log).toEqual(['flush', 'call', 'pull']);
  });
});
