import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, onSnapshot, addDoc, query, orderBy, limit } from '@angular/fire/firestore';
import { User } from 'firebase/auth';
import { Observable } from 'rxjs';
import { Transaction, Wallet } from './models/crypto.models';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private firestore: Firestore = inject(Firestore);

  constructor() { }

  // Create a new user document in Firestore
  async createUser(user: User) {
    if (!user) return;

    const userRef = doc(this.firestore, `users/${user.uid}`);
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };

    return setDoc(userRef, userData, { merge: true });
  }

  // Get user's wallet in real-time
  getWallet(userId: string): Observable<Wallet[]> {
    const walletCollection = collection(this.firestore, `users/${userId}/wallet`);
    return new Observable(observer => {
      const unsubscribe = onSnapshot(walletCollection, (snapshot) => {
        const wallets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet));
        observer.next(wallets);
      });
      return () => unsubscribe();
    });
  }

  // Get user's transactions in real-time
  getTransactions(userId: string): Observable<Transaction[]> {
    const transactionsCollection = collection(this.firestore, `users/${userId}/transactions`);
    return new Observable(observer => {
      const unsubscribe = onSnapshot(transactionsCollection, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        observer.next(transactions);
      });
      return () => unsubscribe();
    });
  }

  addDonation(donation: { message: string, createdAt: Date }) {
    const donationsCollection = collection(this.firestore, 'donations');
    return addDoc(donationsCollection, donation);
  }

  getDonations(): Observable<{ message: string, createdAt: any }[]> {
    const donationsCollection = collection(this.firestore, 'donations');
    const q = query(donationsCollection, orderBy('createdAt', 'desc'), limit(20));
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const donations = snapshot.docs.map(doc => doc.data() as { message: string, createdAt: any });
        observer.next(donations);
      });
      return () => unsubscribe();
    });
  }
}
