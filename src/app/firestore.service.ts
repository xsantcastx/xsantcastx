import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc } from '@angular/fire/firestore';
import { query, orderBy, limit } from 'firebase/firestore';
import { Observable, EMPTY } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { FirebaseErrorHandlerService } from './firebase-error-handler.service';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  constructor(
    private firestore: Firestore,
    private errorHandler: FirebaseErrorHandlerService
  ) {}

  async writeMessage(data: any): Promise<void> {
    try {
      const docRef = doc(collection(this.firestore, 'guestbook'));
      await setDoc(docRef, data);
    } catch (error) {
      console.error('[FirestoreService] Failed to write message:', error);
      this.errorHandler.handleFirestoreError(error);
      throw error;
    }
  }

  listenToMessages(): Observable<any[]> {
    const guestbookRef = collection(this.firestore, 'guestbook');
    const q = query(guestbookRef, orderBy('timestamp', 'desc'), limit(10));
    
    return collectionData(q, { idField: 'id' }).pipe(
      tap(() => console.log('[FirestoreService] Successfully listening to messages')),
      catchError((error) => {
        console.error('[FirestoreService] Failed to listen to messages:', error);
        this.errorHandler.handleFirestoreError(error);
        // Return empty array instead of throwing to prevent app crashes
        return EMPTY;
      })
    );
  }
}
