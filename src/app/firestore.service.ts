import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc } from '@angular/fire/firestore';
import { query, orderBy, limit } from 'firebase/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  constructor(private firestore: Firestore) {}

  async writeMessage(data: any): Promise<void> {
    const docRef = doc(collection(this.firestore, 'guestbook'));
    await setDoc(docRef, data);
  }

  listenToMessages(): Observable<any[]> {
    const guestbookRef = collection(this.firestore, 'guestbook');
    const q = query(guestbookRef, orderBy('timestamp', 'desc'), limit(10));
    return collectionData(q, { idField: 'id' });
  }
}
