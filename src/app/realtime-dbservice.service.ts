import { Injectable, inject, runInInjectionContext, ApplicationRef } from '@angular/core';
import { Database, ref, set, push, onValue, query, orderByKey, limitToFirst, startAfter, get } from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RealtimeDBserviceService {
  private auth = inject(Auth);  // Inject once here
  private appRef = inject(ApplicationRef);

  constructor(private db: Database) {}

  subscribeEntries(callback: (entries: { nickname: string; message: string }[]) => void) {
    runInInjectionContext(this.appRef.injector, () => {
      const guestbookRef = ref(this.db, 'guestbook');
      onValue(guestbookRef, (snapshot) => {
        const data = snapshot.val() || {};
        const entries = Object.values(data).reverse() as { nickname: string; message: string }[];
        callback(entries);
      });
    });
  }

  async addEntry(nickname: string, message: string) {
    return runInInjectionContext(this.appRef.injector, async () => {
      const user = this.auth.currentUser;
      if (!user) {
        return Promise.reject(new Error('User must be logged in to add entries'));
      }
      const guestbookRef = ref(this.db, 'guestbook');
      const newEntryRef = push(guestbookRef);
      return set(newEntryRef, {
        nickname,
        message,
        uid: user.uid,
        timestamp: Date.now(),
      });
    });
  }

  getEntriesObservable(): Observable<{ nickname: string; message: string; timestamp: number }[]> {
    return new Observable(observer => {
      runInInjectionContext(this.appRef.injector, () => {
        const guestbookRef = ref(this.db, 'guestbook');
        onValue(guestbookRef, snapshot => {
          const data = snapshot.val() || {};
          const entries = Object.values(data)
            .map((entry: any) => ({
              nickname: entry.nickname,
              message: entry.message,
              timestamp: entry.timestamp
            }))
            .reverse();
          observer.next(entries);
        }, (error) => {
          observer.error(error);
        });
      });
      // Note: You might add cleanup code here if you want to unsubscribe from onValue listener on Observable unsubscribe.
    });
  }
  getEntries(limit: number, startAfterKey?: string): Promise<{ entries: any[], lastKey: string | null }> {
  const dbRef = ref(this.db, 'guestbook');
  let queryRef = query(dbRef, orderByKey(), limitToFirst(limit + 1));

  if (startAfterKey) {
    queryRef = query(dbRef, orderByKey(), startAfter(startAfterKey), limitToFirst(limit + 1));
  }

  return get(queryRef).then(snapshot => {
    const data = snapshot.val() || {};
    const keys = Object.keys(data);
    const entries = keys.slice(0, limit).map(key => ({ ...data[key], key }));
    const lastKey = keys.length > limit ? keys[limit] : null;
    return { entries, lastKey };
  });
}

}
