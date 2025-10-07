import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Analytics, logEvent, setUserProperties, setUserId } from '@angular/fire/analytics';
import { ConsentService } from './consent.service';
import { AnalyticsDebugService } from './analytics-debug.service';

export interface CustomEventData {
  [key: string]: string | number | boolean;
}

export interface UserProperties {
  app_theme?: string;
  language?: string;
  user_type?: string;
  device_type?: string;
  region?: string;
  [key: string]: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private analytics = inject(Analytics);
  private consentService = inject(ConsentService);
  private debugService = inject(AnalyticsDebugService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor() {
    // Initialize consent service to set up gtag
    this.consentService;
    
    // Set initial user properties if browser
    if (this.isBrowser) {
      this.setInitialUserProperties();
    }
  }

  private canTrack(): boolean {
    return this.isBrowser && this.consentService.hasConsent();
  }

  /**
   * Set user properties for enhanced analytics
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.canTrack()) return;

    setUserProperties(this.analytics, properties);
    this.debugService.logEvent('user_properties_set', properties);
  }

  /**
   * Set user ID for logged-in users (only after consent)
   */
  setUserId(userId: string): void {
    if (!this.canTrack()) return;

    setUserId(this.analytics, userId);
    this.debugService.logEvent('user_id_set', { user_id: userId });
  }

  /**
   * Clear user ID (logout)
   */
  clearUserId(): void {
    if (!this.canTrack()) return;

    setUserId(this.analytics, null);
    this.debugService.logEvent('user_id_cleared', {});
  }

  /**
   * Set initial user properties based on browser/device
   */
  private setInitialUserProperties(): void {
    if (!this.isBrowser) return;

    const properties: UserProperties = {
      device_type: this.getDeviceType(),
      language: this.getLanguagePreference(),
      app_theme: this.getThemePreference(),
      region: this.getRegion()
    };

    // Set properties if consent is already given, or wait for consent
    if (this.consentService.hasConsent()) {
      this.setUserProperties(properties);
    } else {
      // Check periodically for consent (simple polling approach)
      const checkConsent = setInterval(() => {
        if (this.consentService.hasConsent()) {
          this.setUserProperties(properties);
          clearInterval(checkConsent);
        }
      }, 1000);
      
      // Clear interval after 30 seconds to avoid memory leaks
      setTimeout(() => clearInterval(checkConsent), 30000);
    }
  }

  /**
   * Detect device type
   */
  private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    if (!this.isBrowser) return 'desktop';
    
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Get language preference
   */
  private getLanguagePreference(): 'en' | 'es' {
    if (!this.isBrowser) return 'en';
    
    const lang = navigator.language.toLowerCase();
    return lang.startsWith('es') ? 'es' : 'en';
  }

  /**
   * Get theme preference
   */
  private getThemePreference(): 'light' | 'dark' {
    if (!this.isBrowser) return 'light';
    
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return darkMode ? 'dark' : 'light';
  }

  /**
   * Get user region (simple detection)
   */
  private getRegion(): string {
    if (!this.isBrowser) return 'unknown';
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone.includes('Madrid') || timezone.includes('Europe')) return 'EU';
    if (timezone.includes('America')) return 'Americas';
    if (timezone.includes('Asia')) return 'Asia';
    return 'other';
  }

  /**
   * Track page views manually (if not using ScreenTrackingService)
   */
  trackPageView(pagePath: string, pageTitle?: string): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'page_view', {
      page_location: window.location.href,
      page_path: pagePath,
      page_title: pageTitle || document.title
    });
  }

  /**
   * Track contact form submissions
   */
  trackContactSubmit(method: 'form' | 'whatsapp' | 'email', projectType?: string): void {
    if (!this.canTrack()) return;

    const eventData = {
      method,
      project_type: projectType || 'unknown',
      page_location: window.location.href,
      timestamp: new Date().toISOString()
    };

    this.debugService.logEvent('generate_lead', eventData);
    logEvent(this.analytics, 'generate_lead', eventData);
  }

  /**
   * Track portfolio project clicks
   */
  trackProjectClick(projectName: string, projectUrl?: string): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'select_content', {
      content_type: 'project',
      item_id: projectName,
      item_name: projectName,
      project_url: projectUrl || '',
      page_location: window.location.href
    });
  }

  /**
   * Track CTA button clicks (hire me, download resume, etc.)
   */
  trackCTAClick(ctaType: 'hire_me' | 'download_resume' | 'view_portfolio' | 'contact' | 'social'): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'cta_click', {
      cta_type: ctaType,
      page_location: window.location.href,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track social media link clicks
   */
  trackSocialClick(platform: 'github' | 'linkedin' | 'twitter' | 'email'): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'social_click', {
      platform,
      page_location: window.location.href
    });
  }

  /**
   * Track skill section interactions
   */
  trackSkillInteraction(skillName: string, interactionType: 'view' | 'click' | 'hover'): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'skill_interaction', {
      skill_name: skillName,
      interaction_type: interactionType,
      page_location: window.location.href
    });
  }

  /**
   * Track donation/payment events
   */
  trackDonation(method: 'paypal' | 'stripe' | 'crypto', amount?: number, currency?: string): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'donation', {
      payment_method: method,
      value: amount || 0,
      currency: currency || 'USD',
      page_location: window.location.href
    });
  }

  /**
   * Track language changes
   */
  trackLanguageChange(newLanguage: 'en' | 'es', previousLanguage: 'en' | 'es'): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'language_change', {
      new_language: newLanguage,
      previous_language: previousLanguage,
      page_location: window.location.href
    });
  }

  /**
   * Track scroll depth for engagement
   */
  trackScrollDepth(percentage: number): void {
    if (!this.canTrack()) return;

    // Only track at 25%, 50%, 75%, 100%
    const milestones = [25, 50, 75, 100];
    if (milestones.includes(percentage)) {
      logEvent(this.analytics, 'scroll', {
        percent_scrolled: percentage,
        page_location: window.location.href
      });
    }
  }

  /**
   * Track file downloads
   */
  trackFileDownload(fileName: string, fileType: string): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'file_download', {
      file_name: fileName,
      file_type: fileType,
      page_location: window.location.href
    });
  }

  /**
   * Track consent banner interactions
   */
  trackConsentDecision(decision: 'accepted' | 'denied'): void {
    // This should track even without consent (for compliance reporting)
    logEvent(this.analytics, 'consent_decision', {
      decision,
      page_location: window.location.href,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track custom events with flexible data
   */
  trackCustomEvent(eventName: string, eventData?: CustomEventData): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, eventName, {
      ...eventData,
      page_location: window.location.href,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track search events (if you add search functionality)
   */
  trackSearch(searchTerm: string, resultCount?: number): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'search', {
      search_term: searchTerm,
      result_count: resultCount || 0,
      page_location: window.location.href
    });
  }

  /**
   * Track outbound link clicks
   */
  trackOutboundLink(url: string, linkText?: string): void {
    if (!this.canTrack()) return;

    try {
      const domain = new URL(url).hostname;
      logEvent(this.analytics, 'click', {
        link_domain: domain,
        link_url: url,
        link_text: linkText || '',
        outbound: true,
        page_location: window.location.href
      });
    } catch (error) {
      console.warn('Invalid URL for outbound tracking:', url);
    }
  }

  /**
   * Track 404 or page not found events
   */
  trackPageNotFound(attemptedPath: string): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'page_not_found', {
      page_path: attemptedPath,
      referrer: document.referrer,
      page_location: window.location.href
    });
  }

  /**
   * Track form interactions (start, progress, error)
   */
  trackFormInteraction(formId: string, action: 'start' | 'submit' | 'error', fieldName?: string): void {
    if (!this.canTrack()) return;

    const eventData: any = {
      form_id: formId,
      action,
      page_location: window.location.href
    };

    if (fieldName) {
      eventData.field_name = fieldName;
    }

    switch (action) {
      case 'start':
        logEvent(this.analytics, 'form_start', eventData);
        break;
      case 'submit':
        logEvent(this.analytics, 'form_submit', eventData);
        break;
      case 'error':
        logEvent(this.analytics, 'form_error', eventData);
        break;
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metricName: string, value: number, unit: 'ms' | 'bytes' | 'count'): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'performance_metric', {
      metric_name: metricName,
      metric_value: value,
      metric_unit: unit,
      page_location: window.location.href
    });
  }

  /**
   * Track page load performance
   */
  trackPageLoadPerformance(): void {
    if (!this.canTrack() || !this.isBrowser) return;

    // Wait for load event to ensure performance data is available
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          // Track key performance metrics
          this.trackPerformance('first_contentful_paint', navigation.loadEventEnd - navigation.fetchStart, 'ms');
          this.trackPerformance('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, 'ms');
          this.trackPerformance('page_load_time', navigation.loadEventEnd - navigation.fetchStart, 'ms');
          
          // Track Time to First Byte (TTFB)
          const ttfb = navigation.responseStart - navigation.requestStart;
          this.trackPerformance('ttfb', ttfb, 'ms');
        }
      }, 1000);
    });
  }

  /**
   * Track JavaScript errors
   */
  trackError(error: Error, context?: string): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'exception', {
      description: error.message,
      fatal: false,
      context: context || 'unknown',
      page_location: window.location.href
    });
  }

  /**
   * Track video interactions (if you have video content)
   */
  trackVideoInteraction(videoId: string, action: 'play' | 'pause' | 'complete', currentTime?: number): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics, 'video_' + action, {
      video_id: videoId,
      video_current_time: currentTime || 0,
      page_location: window.location.href
    });
  }

  /**
   * Track session duration milestones
   */
  trackSessionMilestone(minutes: number): void {
    if (!this.canTrack()) return;

    // Track at 1, 5, 10, 30 minute milestones
    const milestones = [1, 5, 10, 30];
    if (milestones.includes(minutes)) {
      logEvent(this.analytics, 'session_milestone', {
        session_duration_minutes: minutes,
        page_location: window.location.href
      });
    }
  }
}