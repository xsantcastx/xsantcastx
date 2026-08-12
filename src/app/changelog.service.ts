import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LazyFirestoreService } from './shared/lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from './shared/firestore-cache.service';
import { whenAppCheckReady } from './app-check.bootstrap';

export interface ChangelogEntry {
  id?: string;
  date: any;          // Firestore Timestamp
  title: string;
  details: string;
  category: string;
  project: string;
  createdAt: any;     // Firestore Timestamp
}

export interface ChangelogDay {
  dateLabel: string;  // e.g. "March 28, 2026"
  dateKey: string;    // YYYY-MM-DD for sorting
  entries: ChangelogEntry[];
  expanded: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChangelogService {
  private lazyFirestore = inject(LazyFirestoreService);
  private cache = inject(FirestoreCacheService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * The dev log, grouped by day.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY THIS IS NO LONGER A LIVE LISTENER
   * ───────────────────────────────────────────────────────────────────────────
   * This was an `onSnapshot` over `orderBy(date desc).limit(50)`. Attaching one
   * bills fifty document reads before it has told you anything, and it re-bills
   * for every document that changes for as long as the page is open — for a
   * changelog, which by construction changes when its author ships something,
   * not while somebody is reading it. Nobody has ever needed this page to update
   * under them mid-visit.
   *
   * A one-shot read behind an hour-long cache gets the same content, costs those
   * fifty reads roughly once an hour per visitor instead of once per page view,
   * and drops a standing listener that had to be torn down correctly.
   *
   * The limit came down to 20 as well: the template groups by day and shows the
   * most recent, so entries past the first couple of weeks were being paid for
   * and then never rendered.
   */
  getGroupedChangelog(): Observable<ChangelogDay[]> {
    if (!this.isBrowser) {
      return of([]);
    }

    return this.cache.read$('changelog/recent', CACHE_TTL.changelog, async () => {
      // App Check initializes on idle now rather than at bootstrap (see
      // app-check.bootstrap.ts), and this read fires from a page's ngOnInit.
      // Waiting for App Check keeps the query token-bearing if enforcement is
      // ever switched on in the Firebase console; the changelog renders below
      // the fold, so the delay is not user-visible. The Firestore SDK itself is
      // fetched on demand — see shared/lazy-firestore.service.ts.
      const [, handle] = await Promise.all([whenAppCheckReady(), this.lazyFirestore.get()]);
      if (!handle) return [];
      const { db, api } = handle;

      const q = api.query(
        api.collection(db, 'changelog'),
        api.orderBy('date', 'desc'),
        api.limit(20),
      );
      const snap = await api.getDocs(q);

      // Cached as plain days rather than raw docs, because a Firestore
      // Timestamp does not survive JSON — `groupByDay` reads `.toDate()` off it,
      // and a revived entry would have a bare object there instead.
      return this.groupByDay(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as ChangelogEntry)),
      );
    }).pipe(
      catchError(err => of(this.degradeTo(err, [] as ChangelogDay[]))),
    );
  }

  /**
   * permission-denied (rules not deployed) and SDK-instance-mismatch
   * (SSR→client hydration) are expected in dev. Silent-degrade those so the
   * changelog falls back to "No updates yet" instead of bleeding red into the
   * console. Surface anything else as a warn.
   */
  private degradeTo<T>(err: any, fallback: T): T {
    const code = err?.code || '';
    const msg = err?.message || '';
    const expected =
      code === 'permission-denied' ||
      (typeof msg === 'string' && msg.indexOf('Type does not match') >= 0) ||
      (typeof msg === 'string' && msg.indexOf('different Firestore SDK') >= 0);

    if (!expected) {
      console.warn('[ChangelogService] degraded:', err);
    }
    return fallback;
  }

  private groupByDay(entries: ChangelogEntry[]): ChangelogDay[] {
    const map = new Map<string, ChangelogDay>();

    for (const entry of entries) {
      const date: Date = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
      const dateKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
      const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      if (!map.has(dateKey)) {
        map.set(dateKey, { dateLabel, dateKey, entries: [], expanded: false });
      }
      map.get(dateKey)!.entries.push(entry);
    }

    const days = Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    // Expand the most recent day by default
    if (days.length > 0) {
      days[0].expanded = true;
    }

    return days;
  }
}
