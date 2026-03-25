import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

export interface ConsentSettings {
  ad_storage: 'granted' | 'denied';
  analytics_storage: 'granted' | 'denied';
  functionality_storage: 'granted' | 'denied';
  security_storage: 'granted' | 'denied';
}

@Injectable({
  providedIn: 'root'
})
export class ConsentService {
  private consentKey = 'xsantcastx_consent';
  private consentGiven = false;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  constructor() {
    if (this.isBrowser) {
      this.initializeDataLayer();
      this.setDefaultConsent();
      this.checkStoredConsent();
    }
  }

  private initializeDataLayer(): void {
    window.dataLayer = window.dataLayer || [];

    // Define gtag function
    window.gtag = function(...args: any[]) {
      window.dataLayer.push(args);
    };
  }

  private setDefaultConsent(): void {
    // Default to denied for GDPR compliance (Spain/EU)
    window.gtag!('consent', 'default', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'denied',
      security_storage: 'granted' // Security storage is always granted
    });
  }

  private checkStoredConsent(): void {
    const storedConsent = localStorage.getItem(this.consentKey);
    if (storedConsent === 'accepted') {
      this.acceptAnalyticsConsent();
    }
  }

  /**
   * Accept analytics consent and update Google Analytics
   */
  acceptAnalyticsConsent(): void {
    this.consentGiven = true;
    if (!this.isBrowser) return;
    localStorage.setItem(this.consentKey, 'accepted');

    window.gtag!('consent', 'update', {
      analytics_storage: 'granted',
      functionality_storage: 'granted'
    });

    console.log('🍪 Analytics consent granted');
  }

  /**
   * Deny consent and update storage
   */
  denyConsent(): void {
    this.consentGiven = false;
    if (!this.isBrowser) return;
    localStorage.setItem(this.consentKey, 'denied');

    window.gtag!('consent', 'update', {
      analytics_storage: 'denied',
      functionality_storage: 'denied'
    });

    console.log('🚫 Analytics consent denied');
  }

  /**
   * Reset consent (user can change their mind)
   */
  resetConsent(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.consentKey);
    this.consentGiven = false;
    this.setDefaultConsent();
  }

  /**
   * Check if user has given consent
   */
  hasConsent(): boolean {
    return this.consentGiven;
  }

  /**
   * Check if user has made a consent decision
   */
  hasConsentDecision(): boolean {
    if (!this.isBrowser) return false;
    return localStorage.getItem(this.consentKey) !== null;
  }

  /**
   * Get current consent status from localStorage
   */
  getConsentStatus(): 'accepted' | 'denied' | null {
    if (!this.isBrowser) return null;
    const stored = localStorage.getItem(this.consentKey);
    return stored as 'accepted' | 'denied' | null;
  }
}
