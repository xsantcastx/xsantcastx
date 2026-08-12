import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LazyFirestoreService } from './shared/lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from './shared/firestore-cache.service';

/** Where the donation feed is cached, so a new donation can invalidate it. */
const DONATIONS_KEY = 'donations/recent';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private lazyFirestore = inject(LazyFirestoreService);
  private cache = inject(FirestoreCacheService);

  async addDonation(donation: { message: string, createdAt: Date }) {
    const handle = await this.lazyFirestore.get();
    if (!handle) return;
    const { db, api } = handle;
    const written = await api.addDoc(api.collection(db, 'donations'), donation);
    // The one moment the cached feed is definitely wrong, and the one person who
    // will certainly look for their own message in it.
    this.cache.bust(DONATIONS_KEY);
    return written;
  }

  /**
   * The recent donation feed.
   *
   * Was an `onSnapshot` over twenty documents: twenty reads to attach, on every
   * page that mounts the feed, plus a standing listener for the life of the tab.
   * Donations arrive a few times a week, so watching for one live cost a great
   * deal to almost never fire. A cached read gets the same list, and
   * {@link addDonation} busts the cache so a donor still sees their own message
   * appear straight away.
   */
  getDonations(): Observable<{ message: string, createdAt: any }[]> {
    return this.cache.read$(DONATIONS_KEY, CACHE_TTL.changelog, async () => {
      const handle = await this.lazyFirestore.get();
      if (!handle) return [];
      const { db, api } = handle;

      const q = api.query(
        api.collection(db, 'donations'),
        api.orderBy('createdAt', 'desc'),
        api.limit(20)
      );
      const snapshot = await api.getDocs(q);
      return snapshot.docs.map(d => {
        const data = d.data() as { message: string, createdAt: any };
        return {
          message: data.message,
          // A Firestore Timestamp does not survive a round trip through the
          // cache's JSON, so it is flattened to an ISO string on the way in.
          createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? null,
        };
      });
    }).pipe(
      catchError(err => {
        // permission-denied is what a blocked App Check token looks like
        // downstream (routine on localhost, where the debug-token exchange
        // 403s). Degrade to an empty feed rather than letting the error
        // surface — same convention as ChangelogService.
        if (err?.code !== 'permission-denied') {
          console.warn('[FirebaseService] donation feed degraded:', err);
        }
        return of([] as { message: string, createdAt: any }[]);
      }),
    );
  }
}
