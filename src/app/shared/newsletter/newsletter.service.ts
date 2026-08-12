import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LazyFirestoreService } from '../lazy-firestore.service';

export interface NewsletterSubscription {
  email: string;
  subscribedAt: string;
  source: string;
  toolSlug?: string;
}

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly COLLECTION = 'newsletter_subscribers';
  private readonly STORAGE_KEY = 'xs_newsletter_subscribed';
  private lazyFirestore = inject(LazyFirestoreService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Check if user already subscribed (via in-memory/sessionStorage flag) */
  isAlreadySubscribed(): boolean {
    if (!this.isBrowser) return false;
    try {
      return sessionStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /** Mark user as subscribed for the current session */
  private markSubscribed(): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.setItem(this.STORAGE_KEY, 'true');
    } catch { /* sessionStorage blocked */ }
  }

  /** Subscribe an email address */
  async subscribe(email: string, source: string, toolSlug?: string): Promise<void> {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      throw new Error('Please enter a valid email address.');
    }

    const handle = await this.lazyFirestore.get();
    if (!handle) {
      throw new Error('The signal could not reach the network. Try again in a moment.');
    }
    const { db, api } = handle;

    const col = api.collection(db, this.COLLECTION);
    const data: NewsletterSubscription = {
      email: trimmed,
      subscribedAt: new Date().toISOString(),
      source,
      ...(toolSlug ? { toolSlug } : {})
    };

    await api.addDoc(col, data);
    this.markSubscribed();
  }
}
