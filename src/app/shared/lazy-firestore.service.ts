import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

/**
 * The Firestore SDK is ~450 kB raw / ~116 kB gzip — by far the largest thing
 * this app ships. Nothing on the first paint needs it: the visit counter, the
 * changelog, newsletter signup, tool-usage counters, easter-egg discovery and
 * the guestbook all run after hydration, and most users never trigger any of
 * them at all.
 *
 * Putting `provideFirestore()` in the root injector forced it into the initial
 * chunk regardless. This service replaces that: it dynamically imports
 * `firebase/firestore` on first use, so the SDK lands in its own lazy chunk
 * that is fetched only when a consumer actually reaches for the database.
 *
 * Consumers get the raw modular SDK rather than the @angular/fire wrapper, so
 * callbacks fire OUTSIDE the Angular zone. Anything that updates component
 * state from a snapshot must wrap it in {@link runInZone}.
 */
export type FirestoreApi = typeof import('firebase/firestore');

export interface FirestoreHandle {
  db: Firestore;
  api: FirestoreApi;
}

@Injectable({ providedIn: 'root' })
export class LazyFirestoreService {
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private handle: Promise<FirestoreHandle | null> | null = null;

  /**
   * Resolve the Firestore handle, loading the SDK on first call.
   * Resolves to `null` on the server or if the SDK fails to load — callers
   * silent-degrade rather than throw, matching the previous behaviour.
   */
  get(): Promise<FirestoreHandle | null> {
    if (!this.isBrowser) {
      return Promise.resolve(null);
    }

    if (!this.handle) {
      this.handle = this.zone
        .runOutsideAngular(() => import('firebase/firestore'))
        .then((api): FirestoreHandle => {
          const app = getApps().length ? getApp() : initializeApp(environment.firebase);
          let db: Firestore;
          // initializeFirestore() throws if Firestore has already been started
          // (the SSR pass + client hydration both reach here). Fall through to
          // the existing instance so every consumer shares one reference.
          try {
            db = api.initializeFirestore(app, { experimentalForceLongPolling: true });
          } catch {
            db = api.getFirestore(app);
          }
          return { db, api };
        })
        .catch((err) => {
          console.warn('[LazyFirestore] Firestore is unavailable:', err);
          return null;
        });
    }

    return this.handle;
  }

  /**
   * Re-enter the Angular zone. Snapshot listeners registered against the raw
   * SDK run outside it, so change detection would not otherwise fire.
   */
  runInZone<T>(fn: () => T): T {
    return this.zone.run(fn);
  }
}
