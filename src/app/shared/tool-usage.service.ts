import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LazyFirestoreService } from './lazy-firestore.service';

@Injectable({ providedIn: 'root' })
export class ToolUsageService {
  private lazyFirestore = inject(LazyFirestoreService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private tracked = new Set<string>();

  /**
   * Record a usage for the given tool slug.
   * Only counts once per session per tool to avoid inflating numbers.
   * Returns the updated count.
   */
  async recordUsage(toolSlug: string): Promise<number> {
    if (!this.isBrowser) return 0;

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
      } catch (err) {
        console.error('[ToolUsageService] increment failed:', err);
      }
    }

    return this.getCount(toolSlug);
  }

  /** Read the current usage count for a tool. */
  async getCount(toolSlug: string): Promise<number> {
    if (!this.isBrowser) return 0;
    try {
      const handle = await this.lazyFirestore.get();
      if (!handle) return 0;
      const { db, api } = handle;
      const snap = await api.getDoc(api.doc(db, 'tool-usage', toolSlug));
      return snap.exists() ? (snap.data()['count'] ?? 0) : 0;
    } catch {
      return 0;
    }
  }
}
