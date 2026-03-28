import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, collection, query, where, orderBy, limit, collectionData } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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
    const q = query(
      col,
      where('project', '==', 'xsantcastx'),
      orderBy('date', 'desc'),
      limit(50)
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((entries: any[]) => this.groupByDay(entries)),
      catchError(() => of([]))
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
