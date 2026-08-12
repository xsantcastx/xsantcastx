import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LazyFirestoreService } from './shared/lazy-firestore.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private lazyFirestore = inject(LazyFirestoreService);

  async addDonation(donation: { message: string, createdAt: Date }) {
    const handle = await this.lazyFirestore.get();
    if (!handle) return;
    const { db, api } = handle;
    return api.addDoc(api.collection(db, 'donations'), donation);
  }

  getDonations(): Observable<{ message: string, createdAt: any }[]> {
    return new Observable(observer => {
      let unsubscribe: (() => void) | null = null;
      let torndown = false;

      this.lazyFirestore.get().then(handle => {
        if (!handle || torndown) return;
        const { db, api } = handle;

        const q = api.query(
          api.collection(db, 'donations'),
          api.orderBy('createdAt', 'desc'),
          api.limit(20)
        );

        // Raw-SDK callbacks fire outside the Angular zone — re-enter it so the
        // donation feed repaints when a new donation lands.
        unsubscribe = api.onSnapshot(q, snapshot => {
          const donations = snapshot.docs.map(d => d.data() as { message: string, createdAt: any });
          this.lazyFirestore.runInZone(() => observer.next(donations));
        });
      });

      return () => {
        torndown = true;
        unsubscribe?.();
      };
    });
  }
}
