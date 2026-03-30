import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

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
  private isBrowser: boolean;

  constructor(
    private firestore: Firestore,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

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

    const col = collection(this.firestore, this.COLLECTION);
    const data: NewsletterSubscription = {
      email: trimmed,
      subscribedAt: new Date().toISOString(),
      source,
      ...(toolSlug ? { toolSlug } : {})
    };

    await addDoc(col, data);
    this.markSubscribed();
  }
}
