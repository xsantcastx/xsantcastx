import { Injectable } from '@angular/core';
import { FirebaseError } from '@angular/fire/app';

@Injectable({
  providedIn: 'root'
})
export class FirebaseErrorHandlerService {

  constructor() { }

  handleFirestoreError(error: any): void {
    if (this.isFirebaseError(error)) {
      switch (error.code) {
        case 'failed-precondition':
          console.warn('[Firestore] App Check token validation failed. This may be due to misconfigured App Check or network issues.');
          break;
        case 'permission-denied':
          console.warn('[Firestore] Permission denied. Check Firestore security rules.');
          break;
        case 'unavailable':
          console.warn('[Firestore] Service unavailable. This may be temporary.');
          break;
        case 'unauthenticated':
          console.warn('[Firestore] Authentication required but user not signed in.');
          break;
        default:
          console.error('[Firestore] Unexpected error:', error.code, error.message);
      }
    } else {
      // Handle non-Firebase errors (like network 400 errors)
      if (error.status === 400) {
        console.error('[Firestore] 400 Bad Request - possible causes:');
        console.error('- App Check token validation failed');
        console.error('- Invalid request format');
        console.error('- Firestore security rules blocking access');
        console.error('- Browser tracking prevention interfering');
      }
      console.error('[Firestore] Network or other error:', error);
    }
    
    // Log additional debugging info
    this.logEnvironmentInfo();
  }

  private isFirebaseError(error: any): error is FirebaseError {
    return error && typeof error.code === 'string' && error.code.includes('/');
  }

  private logEnvironmentInfo(): void {
    console.group('[Firebase Debug Info]');
    console.log('User Agent:', navigator.userAgent);
    console.log('Cookies Enabled:', navigator.cookieEnabled);
    console.log('Local Storage Available:', this.isLocalStorageAvailable());
    console.log('Session Storage Available:', this.isSessionStorageAvailable());
    console.log('Tracking Prevention Detected:', this.detectTrackingPrevention());
    console.groupEnd();
  }

  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private isSessionStorageAvailable(): boolean {
    try {
      const test = '__sessionStorage_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private detectTrackingPrevention(): boolean {
    // Check for common tracking prevention indicators
    const userAgent = navigator.userAgent;
    
    // Safari tracking prevention
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return true;
    }
    
    // Firefox enhanced tracking protection
    if (userAgent.includes('Firefox')) {
      return true;
    }
    
    // Check if storage is being blocked (common with tracking prevention)
    return !this.isLocalStorageAvailable() || !this.isSessionStorageAvailable();
  }
}