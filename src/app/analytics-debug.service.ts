import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsDebugService {
  private isDebugMode = false;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (!this.isBrowser) return;
    // Enable debug mode if URL contains debug parameter
    this.isDebugMode = window.location.search.includes('firebase_analytics_debug_mode=true') ||
                      window.location.search.includes('analytics_debug=true');
  }

  logEvent(eventName: string, eventData?: any): void {
    if (this.isDebugMode) {
      console.group(`📊 Analytics Event: ${eventName}`);
      console.log('Event Data:', eventData);
      console.log('Timestamp:', new Date().toISOString());
      if (this.isBrowser) console.log('Page URL:', window.location.href);
      console.groupEnd();
    }
  }

  logConsentChange(decision: string): void {
    if (this.isDebugMode) {
      console.log(`🍪 Consent Decision: ${decision}`);
    }
  }

  isEnabled(): boolean {
    return this.isDebugMode;
  }
}
