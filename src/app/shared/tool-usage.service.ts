import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LazyFirestoreService } from './lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from './firestore-cache.service';
import { whenAppCheckReady } from '../app-check.bootstrap';

@Injectable({ providedIn: 'root' })
export class ToolUsageService {
  private lazyFirestore = inject(LazyFirestoreService);
  private cache = inject(FirestoreCacheService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private tracked = new Set<string>();

  /**
   * Record a usage for the given tool slug.
   * Only counts once per session per tool to avoid inflating numbers.
   * Returns the updated count.
   */
  async recordUsage(toolSlug: string): Promise<number> {
    if (!this.isBrowser) return 0;

    // App Check initializes on idle rather than at bootstrap (see
    // app-check.bootstrap.ts). This write fires as a tool page mounts, so
    // without waiting it can beat App Check to the wire and go out without a
    // token — harmless today, but it would silently stop counting the moment
    // App Check enforcement is switched on. The count is not rendered until
    // getCount() resolves anyway.
    await whenAppCheckReady();

    const handle = await this.lazyFirestore.get();
    if (!handle) return 0;
    const { db, api } = handle;

    const sessionKey = `tool-used-${toolSlug}`;
    const alreadyCounted = sessionStorage.getItem(sessionKey);
    const ref = api.doc(db, 'tool-usage', toolSlug);

    if (!alreadyCounted && !this.tracked.has(toolSlug)) {
      try {
        await api.setDoc(ref, { count: api.increment(1) }, { merge: true });
        sessionStorage.setItem(sessionKey, '1');
        this.tracked.add(toolSlug);

        // This visit is now in the server's count but not in whatever is
        // cached, so nudge the cached copy rather than spending a read to go
        // and find out a number we already know has gone up by one.
        const known = this.cache.getStale<number>(cacheKey(toolSlug));
        if (known !== null) {
          this.cache.set(cacheKey(toolSlug), known + 1, CACHE_TTL.counters);
        }
      } catch (err) {
        console.error('[ToolUsageService] increment failed:', err);
      }
    }

    return this.getCount(toolSlug);
  }

  /**
   * The current usage count for a tool.
   *
   * Cached for an hour. This is rendered as "N people used this" under a tool,
   * which is a social-proof decoration — it does not need to be the number as of
   * this millisecond, and reading it fresh on every one of 126 tool pages was
   * paying a document read per page view to move a figure by one.
   */
  async getCount(toolSlug: string): Promise<number> {
    if (!this.isBrowser) return 0;
    return this.cache.through(cacheKey(toolSlug), CACHE_TTL.counters, async () => {
      // Same reasoning as recordUsage() — reads are enforced too, and this is
      // also reachable directly, not only through recordUsage().
      await whenAppCheckReady();
      const handle = await this.lazyFirestore.get();
      if (!handle) return 0;
      const { db, api } = handle;
      const snap = await api.getDoc(api.doc(db, 'tool-usage', toolSlug));
      return snap.exists() ? ((snap.data()['count'] as number) ?? 0) : 0;
    }).catch(() => 0);
  }
}

function cacheKey(toolSlug: string): string {
  return `tool-usage/${toolSlug}`;
}
