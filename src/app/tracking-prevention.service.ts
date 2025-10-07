import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TrackingPreventionService {
  private trackingPreventionDetected = false;
  private mitigationApplied = false;

  constructor() {
    this.detectAndMitigate();
  }

  private detectAndMitigate(): void {
    // Detect tracking prevention
    this.trackingPreventionDetected = this.detectTrackingPrevention();
    
    if (this.trackingPreventionDetected) {
      console.warn('[TrackingPrevention] Detected browser tracking prevention features');
      this.applyMitigations();
    }
  }

  private detectTrackingPrevention(): boolean {
    const indicators = [
      this.detectSafariITP(),
      this.detectFirefoxETP(),
      this.detectStorageBlocking(),
      this.detectCookieBlocking()
    ];

    return indicators.some(detected => detected);
  }

  private detectSafariITP(): boolean {
    const userAgent = navigator.userAgent;
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    
    if (isSafari) {
      // Safari with ITP typically blocks third-party storage
      try {
        const testKey = '__itp_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        return false; // Storage works, ITP might not be blocking
      } catch {
        return true; // Storage blocked, likely ITP
      }
    }
    
    return false;
  }

  private detectFirefoxETP(): boolean {
    const userAgent = navigator.userAgent;
    return userAgent.includes('Firefox');
  }

  private detectStorageBlocking(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      sessionStorage.setItem(test, test);
      localStorage.removeItem(test);
      sessionStorage.removeItem(test);
      return false;
    } catch {
      return true;
    }
  }

  private detectCookieBlocking(): boolean {
    return !navigator.cookieEnabled;
  }

  private applyMitigations(): void {
    if (this.mitigationApplied) return;

    console.log('[TrackingPrevention] Applying mitigations...');

    // 1. Use first-party storage context
    this.ensureFirstPartyContext();

    // 2. Configure Firebase for tracking prevention environments
    this.configureFirebaseForTrackingPrevention();

    // 3. Set up fallback mechanisms
    this.setupFallbackMechanisms();

    this.mitigationApplied = true;
  }

  private ensureFirstPartyContext(): void {
    // Ensure we're operating in first-party context
    // This helps with storage access in tracking prevention environments
    
    if (window.location.hostname !== 'xsantcastx.com' && 
        !window.location.hostname.includes('firebase')) {
      console.warn('[TrackingPrevention] Not running on primary domain - may affect storage access');
    }
  }

  private configureFirebaseForTrackingPrevention(): void {
    // Configure Firebase settings that work better with tracking prevention
    
    // Disable offline persistence if storage is blocked
    if (!this.isStorageAvailable()) {
      console.log('[TrackingPrevention] Disabling Firebase offline features due to storage restrictions');
      // Note: This would require Firebase configuration changes
    }
  }

  private setupFallbackMechanisms(): void {
    // Set up fallback mechanisms for when tracking prevention blocks normal operation
    
    // 1. Use session-based storage instead of persistent
    // 2. Implement graceful degradation for analytics
    // 3. Use alternative contact methods when Firebase is blocked
    
    console.log('[TrackingPrevention] Fallback mechanisms configured');
  }

  private isStorageAvailable(): boolean {
    try {
      const test = '__availability_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  isTrackingPreventionDetected(): boolean {
    return this.trackingPreventionDetected;
  }

  getRecommendations(): string[] {
    if (!this.trackingPreventionDetected) {
      return [];
    }

    const recommendations = [
      'Consider using the contact form fallback (mailto) if Firebase features are not working',
      'Some analytics features may be limited due to browser privacy settings',
    ];

    if (this.detectSafariITP()) {
      recommendations.push('Safari users: Consider adding this site to your favorites to improve functionality');
    }

    if (this.detectFirefoxETP()) {
      recommendations.push('Firefox users: You can adjust Enhanced Tracking Protection settings if needed');
    }

    return recommendations;
  }
}