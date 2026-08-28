/**
 * site-notice.service.ts — the one document every visitor reads.
 *
 * `site-config/notice` carries two things the owner can turn on from /admin: a
 * broadcast banner and a maintenance warning. Both are read here, by every
 * client, on every page load — which makes this the most-read document on the
 * site and the one place where a careless implementation would show up on the
 * bill rather than in a bug report.
 *
 * Three decisions follow from that, and they are the whole design:
 *
 *   1. `getDoc` through the read-through cache, not `onSnapshot`. A live
 *      listener would be a held connection per visitor per tab for a document
 *      that changes a handful of times a year. The cost of the announcement
 *      being up to `CACHE_TTL.notice` minutes late is nothing; the cost of a
 *      listener per visitor is not.
 *
 *   2. Nothing is read at all until the browser is idle. The notice is chrome
 *      on top of the page, never the page itself, so it has no business
 *      competing with the first render for a network slot.
 *
 *   3. It resolves to `null` and stays quiet on every failure — a missing rule,
 *      an offline device, a Firestore that will not load. A site that cannot
 *      read its announcement banner has no announcement, which is exactly the
 *      state it is in the overwhelming majority of the time anyway.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

import { LazyFirestoreService } from '../lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from '../firestore-cache.service';
// Type-only for the same reason cloud-save.service.ts does it: this service is
// eager (the outlet injects it on every page load), and a value import would
// pull gm.model and the whole /admin shape set into the initial bundle. The
// coercion is reached through the dynamic import in `load()`, which is already
// behind the lazy Firestore await.
import type { SiteNotice } from '../cloud-save/gm.model';

const CACHE_KEY = 'site-notice';

@Injectable({ providedIn: 'root' })
export class SiteNoticeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly lazyFirestore = inject(LazyFirestoreService);
  private readonly cache = inject(FirestoreCacheService);
  private readonly zone = inject(NgZone);

  /**
   * Null until a notice has been read *and* found to be worth showing. A
   * document that exists but says nothing resolves to null too — the consumer
   * should not have to know the difference between "no document" and "an empty
   * message", because there isn't one worth rendering.
   */
  private readonly notice$$ = new BehaviorSubject<SiteNotice | null>(null);
  readonly notice$: Observable<SiteNotice | null> = this.notice$$.asObservable();

  private started = false;

  /**
   * Read the notice once, on an idle callback.
   *
   * Idempotent: called from `SiteNoticeOutletComponent.ngOnInit`, which is
   * mounted in the app shell and therefore constructed once per page load. The
   * guard is there for the second caller that does not exist yet rather than
   * for one that does.
   */
  start(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    // runOutsideAngular so the idle callback does not schedule change detection
    // on a tick where nothing has changed yet; the result is published back
    // inside the zone below.
    this.zone.runOutsideAngular(() => {
      const run = () => void this.load();
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 4000 });
      } else {
        // Safari had no requestIdleCallback for years and the fallback is still
        // load-bearing there. A timeout is not an idle callback, but it is the
        // same promise to the first render, which is what matters here.
        setTimeout(run, 1200);
      }
    });
  }

  /** Drop the cached copy so the next `start()` reads live. Used by the console. */
  bust(): void {
    this.cache.bust(CACHE_KEY);
  }

  private async load(): Promise<void> {
    try {
      const notice = await this.cache.through(
        CACHE_KEY,
        CACHE_TTL.notice,
        async () => {
          const fs = await this.lazyFirestore.get();
          if (!fs) return null;
          const { NOTICE_DOC, SITE_CONFIG_COLLECTION, coerceNotice } =
            await import('../cloud-save/gm.model');
          const snap = await fs.api.getDoc(
            fs.api.doc(fs.db, SITE_CONFIG_COLLECTION, NOTICE_DOC),
          );
          return snap.exists() ? coerceNotice(snap.data()) : null;
        },
      );
      const { noticeIsLive } = await import('../cloud-save/gm.model');
      if (noticeIsLive(notice)) {
        this.zone.run(() => this.notice$$.next(notice));
      }
    } catch {
      // Quiet by design — see the header. There is no degraded state to report
      // because the absence of a banner is the normal state.
    }
  }
}
