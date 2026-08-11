import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, collection, query, orderBy, limit, collectionData } from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
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
  private firestore = inject(Firestore);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  getGroupedChangelog(): Observable<ChangelogDay[]> {
    if (!this.isBrowser) {
      return of([]);
    }

    const col = collection(this.firestore, 'changelog');
    const q = query(col, orderBy('date', 'desc'), limit(50));
    // Cold — the Firestore listener attaches on subscribe, not here. Building
    // it eagerly keeps every AngularFire call inside this synchronous
    // injection context while still deferring the actual network work below.
    const entries$ = collectionData(q, { idField: 'id' });

    // App Check initializes on idle now rather than at bootstrap (see
    // app-check.bootstrap.ts), and this read fires from the landing page's
    // ngOnInit. Waiting for App Check keeps the query token-bearing if
    // enforcement is ever switched on in the Firebase console; the changelog
    // renders below the fold, so the delay is not user-visible.
    return from(whenAppCheckReady()).pipe(
      switchMap(() => entries$),
      map((entries: any[]) => this.groupByDay(entries)),
      catchError((err: any) => {
        // permission-denied (rules not deployed) and SDK-instance-mismatch
        // (SSR→client hydration) are expected in dev. Silent-degrade those
        // so the changelog falls back to "No updates yet" instead of bleeding
        // red into the console. Surface anything else as a warn.
        const code = err?.code || '';
        const msg = err?.message || '';
        if (
          code === 'permission-denied' ||
          (typeof msg === 'string' && msg.indexOf('Type does not match') >= 0) ||
          (typeof msg === 'string' && msg.indexOf('different Firestore SDK') >= 0)
        ) {
          return of([]);
        }
        console.warn('[ChangelogService] degraded:', err);
        return of([]);
      })
    );
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
