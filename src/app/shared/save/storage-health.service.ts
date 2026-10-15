/**
 * storage-health.service.ts — is this device's localStorage running out?
 *
 * The owner's phone filled its 5 MB origin quota (the economy op log grew
 * ~260 KB an hour, see economy-ops compactLocalLedger) and every save write
 * after that failed silently: pickups were refused with "could not be saved".
 * The gateway now keeps a refused value in memory (game-state.gateway.ts
 * `spilled`), so play goes on; this service is how the player and the
 * developer find out:
 *
 *  - dev builds log the per-key table once per load (largest first) and the
 *    origin estimate from `navigator.storage.estimate` where there is one;
 *  - `state$` says 'nearlyFull' past 80% of the quota (storage-usage.ts) and
 *    'full' once any value is held in memory only. The play HUD shows a
 *    gentle notice for either, once per load.
 */
import { Injectable, PLATFORM_ID, inject, isDevMode } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from './game-state.gateway';
import { measureStorage, underPressure, type StorageUsage } from './storage-usage';

export type StorageHealth = 'ok' | 'nearlyFull' | 'full';

@Injectable({ providedIn: 'root' })
export class StorageHealthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly gateway = inject(GameStateGateway);
  private readonly state$$ = new BehaviorSubject<StorageHealth>('ok');
  readonly state$: Observable<StorageHealth> = this.state$$.asObservable();
  private started = false;

  /** Measure once and follow the gateway's spill count. Idempotent; browser only. */
  start(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    const usage = this.measure();
    if (isDevMode()) this.log(usage);
    if (underPressure(usage)) this.state$$.next('nearlyFull');
    this.gateway.spilled$.subscribe(held => {
      if (held > 0) this.state$$.next('full');
      else if (this.state$$.value === 'full') this.state$$.next(underPressure(this.measure()) ? 'nearlyFull' : 'ok');
    });
  }

  measure(): StorageUsage {
    try {
      return measureStorage(localStorage);
    } catch {
      return { bytes: 0, keys: [] };
    }
  }

  private log(usage: StorageUsage): void {
    const kb = (n: number) => Math.round(n / 102.4) / 10;
    console.info(`[storage] localStorage ${kb(usage.bytes)} KB (UTF-16)`);
    console.table(usage.keys.slice(0, 15).map(row => ({ key: row.key, kb: kb(row.bytes) })));
    const estimate = typeof navigator !== 'undefined' ? navigator.storage?.estimate?.bind(navigator.storage) : undefined;
    if (estimate) {
      void estimate().then(
        e => console.info(`[storage] origin estimate: ${kb(e.usage ?? 0)} KB of ${kb(e.quota ?? 0)} KB`),
        () => { /* not offered here */ },
      );
    }
  }
}
