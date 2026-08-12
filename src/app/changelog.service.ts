import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { LazyFirestoreService } from './shared/lazy-firestore.service';
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
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  getGroupedChangelog(): Observable<ChangelogDay[]> {
    if (!this.isBrowser) {
      return of([]);
    }

    return new Observable<ChangelogDay[]>(observer => {
      let unsubscribe: (() => void) | null = null;
      let torndown = false;

      // App Check initializes on idle now rather than at bootstrap (see
      // app-check.bootstrap.ts), and this read fires from the landing page's
      // ngOnInit. Waiting for App Check keeps the query token-bearing if
      // enforcement is ever switched on in the Firebase console; the changelog
      // renders below the fold, so the delay is not user-visible. The Firestore
      // SDK itself is fetched on demand — see shared/lazy-firestore.service.ts.
      Promise.all([whenAppCheckReady(), this.lazyFirestore.get()])
        .then(([, handle]) => {
          if (!handle || torndown) return;
          const { db, api } = handle;

          const q = api.query(
            api.collection(db, 'changelog'),
            api.orderBy('date', 'desc'),
            api.limit(50)
          );

          // Raw-SDK snapshot callbacks fire outside the Angular zone; re-enter
          // it so the async pipe in the template actually repaints.
          unsubscribe = api.onSnapshot(
            q,
            snap => {
              const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChangelogEntry));
              this.lazyFirestore.runInZone(() => observer.next(this.groupByDay(entries)));
            },
            err => this.lazyFirestore.runInZone(() => this.degrade(err, observer))
          );
        })
        .catch(err => this.degrade(err, observer));

      return () => {
        torndown = true;
        unsubscribe?.();
      };
    });
  }

  /**
   * permission-denied (rules not deployed) and SDK-instance-mismatch
   * (SSR→client hydration) are expected in dev. Silent-degrade those so the
   * changelog falls back to "No updates yet" instead of bleeding red into the
   * console. Surface anything else as a warn.
   */
  private degrade(err: any, observer: { next: (v: ChangelogDay[]) => void }): void {
    const code = err?.code || '';
    const msg = err?.message || '';
    const expected =
      code === 'permission-denied' ||
      (typeof msg === 'string' && msg.indexOf('Type does not match') >= 0) ||
      (typeof msg === 'string' && msg.indexOf('different Firestore SDK') >= 0);

    if (!expected) {
      console.warn('[ChangelogService] degraded:', err);
    }
    observer.next([]);
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
