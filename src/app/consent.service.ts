import { Injectable } from '@angular/core';

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

  constructor() {
    this.initializeDataLayer();
    this.setDefaultConsent();
    this.checkStoredConsent();
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
    return localStorage.getItem(this.consentKey) !== null;
  }

  /**
   * Get current consent status from localStorage
   */
  getConsentStatus(): 'accepted' | 'denied' | null {
    const stored = localStorage.getItem(this.consentKey);
    return stored as 'accepted' | 'denied' | null;
  }
}