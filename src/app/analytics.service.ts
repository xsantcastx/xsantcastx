import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';
import { environment } from '../environments/environment';
import { ConsentService } from './consent.service';
import { AnalyticsDebugService } from './analytics-debug.service';

type AnalyticsApi = typeof import('firebase/analytics');

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
  private consentService = inject(ConsentService);
  private debugService = inject(AnalyticsDebugService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private analyticsRef: Analytics | null = null;
  private api: AnalyticsApi | null = null;
  private queue: Array<() => void> = [];
  private loader: Promise<void> | null = null;

  constructor() {
    // Initialize consent service to set up gtag
    this.consentService;

    // Deferred, not called inline: setInitialUserProperties() ends up in
    // canTrack(), and resolving Analytics is what makes AngularFire call
    // getAnalytics() and pull in gtag.js (~150 kB). HeaderComponent is
    // app-shell mounted and injects this service, so doing that in the
    // constructor put a third-party script on the critical path of every
    // route. Nothing here is time-sensitive — the properties are attached to
    // events, and no event can fire before the user has interacted.
    if (this.isBrowser) {
      this.whenIdle(() => this.setInitialUserProperties());
    }
  }

  /**
   * Load the Analytics SDK on first real use, then replay anything queued.
   *
   * This was `inject(Analytics)` from @angular/fire, and before that a
   * constructor injection. Two separate costs were being paid: resolving the
   * token booted Firebase Analytics (and gtag.js, ~150 kB) — fixed upstream by
   * deferring the injection — and, separately, `@angular/fire/analytics`
   * *statically imports* `@angular/fire/auth`, so merely referencing the module
   * put the ~100 kB auth SDK in the initial chunk for a site whose only
   * sign-in lives on /guestbook and /admin. Talking to the raw modular SDK
   * behind a dynamic import removes both.
   *
   * Calls made before the SDK lands are queued, so every public track*()
   * method keeps its synchronous fire-and-forget signature.
   */
  private enqueue(run: (api: AnalyticsApi, analytics: Analytics) => void): void {
    if (!this.isBrowser) return;

    if (this.api && this.analyticsRef) {
      run(this.api, this.analyticsRef);
      return;
    }

    this.queue.push(() => {
      if (this.api && this.analyticsRef) run(this.api, this.analyticsRef);
    });
    this.load();
  }

  private load(): void {
    if (this.loader) return;

    this.loader = import('firebase/analytics')
      .then(async (api) => {
        // Analytics needs cookies + IndexedDB; bail cleanly where it can't run.
        if (!(await api.isSupported())) {
          this.queue.length = 0;
          return;
        }
        const app = getApps().length ? getApp() : initializeApp(environment.firebase);
        this.api = api;
        this.analyticsRef = api.getAnalytics(app);
        this.queue.splice(0).forEach(fn => fn());
      })
      .catch((err) => {
        console.warn('[Analytics] unavailable:', err);
        this.queue.length = 0;
      });
  }

  /** Consent-gated event log. */
  private log(name: string, params?: Record<string, any>): void {
    if (!this.canTrack()) return;
    this.enqueue((api, analytics) => api.logEvent(analytics, name as any, params as any));
  }

  /**
   * Consent is checked BEFORE anything touches the SDK, and the order
   * matters: loading it has the side effect of booting Firebase Analytics.
   * With the old ordering, a visitor who never accepted the cookie banner
   * still paid for gtag.js on every page — consent mode denied what it
   * *stored*, not what it *downloaded*. Now neither the SDK chunk nor the
   * script is fetched until the user has actually opted in.
   */
  private canTrack(): boolean {
    return this.isBrowser && !this.doNotTrack() && this.consentService.hasConsent();
  }

  /**
   * Do Not Track, checked ahead of consent.
   *
   * Consent and DNT are not the same question, and the cookie banner cannot
   * stand in for this one: a visitor who turned DNT on in their browser
   * settings and then clicked "accept" on a banner has given two contradictory
   * answers, and the narrower one is the one they set deliberately rather than
   * the one we interrupted them for.
   *
   * Checked inside `canTrack()` rather than at each call site so it also gates
   * the SDK *load* — `enqueue()` is what resolves `firebase/analytics` and pulls
   * gtag.js, so a DNT browser now never downloads it, rather than downloading it
   * and then declining to log through it.
   *
   * Three spellings, because the property was never standardised in one place:
   * `navigator.doNotTrack` is the modern one, `window.doNotTrack` is Safari's,
   * and `navigator.msDoNotTrack` is IE/legacy Edge. Some Firefox versions
   * report 'yes' rather than '1'.
   */
  private doNotTrack(): boolean {
    if (!this.isBrowser) return false;
    const nav = navigator as Navigator & { msDoNotTrack?: string };
    const win = window as Window & { doNotTrack?: string };
    return [nav.doNotTrack, win.doNotTrack, nav.msDoNotTrack]
      .some(signal => signal === '1' || signal === 'yes');
  }

  // ─── Acquisition funnel ─────────────────────────────────────────────────
  // The eight events that answer one question: does a stranger who lands on
  // /world come back. Every one goes through `log()`, so all of them are
  // consent- and DNT-gated and none of them can fire during prerender.
  //
  // Named as custom events rather than reused GA4 reserved ones on purpose.
  // `first_forge_strike` is not a `level_up`, and folding it into a reserved
  // name would file this funnel in the same report as that name's own meaning,
  // where it could never be read apart from it again.

  /** The overlay went up. The denominator for every step below it. */
  trackOnboardingStart(): void {
    this.log('onboarding_start', {});
  }

  /** A screen was reached. `step` is 1-indexed, matching the "2 of 5" on screen. */
  trackOnboardingStep(step: number): void {
    this.log('onboarding_step', { step });
  }

  /**
   * The run ended, by either door.
   *
   * `completed` is what separates them: somebody who walked all five screens
   * from somebody who used the skip. Both write the same "never show again"
   * record, so without this flag the funnel could not tell a finished tutorial
   * from an abandoned one.
   */
  trackOnboardingComplete(completed: boolean, lastStep: number): void {
    this.log('onboarding_complete', { completed, last_step: lastStep });
  }

  /** The first strike this browser has ever landed. Fires once, ever. */
  trackFirstForgeStrike(): void {
    this.log('first_forge_strike', {});
  }

  /** The first realm this browser walked into. */
  trackFirstRealmVisit(realm: string): void {
    this.log('first_realm_visit', { realm });
  }

  /** A session that began with a save already on disk. */
  trackReturnVisit(streakDays: number): void {
    this.log('return_visit', { streak_days: streakDays });
  }

  /** A daily quest was picked up. */
  trackDailyQuestStart(questId: string): void {
    this.log('daily_quest_start', { quest_id: questId });
  }

  /** A rank threshold was crossed. `rank` is the lore title, not the number. */
  trackRankUp(rank: string, level: number): void {
    this.log('rank_up', { rank, level });
  }

  /** Run work in the first idle window, or shortly after on older browsers. */
  private whenIdle(work: () => void): void {
    const idle = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;

    if (typeof idle === 'function') {
      idle(() => work(), { timeout: 2500 });
    } else {
      window.setTimeout(work, 1500);
    }
  }

  /**
   * Set user properties for enhanced analytics
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.canTrack()) return;

    this.enqueue((api, analytics) => api.setUserProperties(analytics, properties));
    this.debugService.logEvent('user_properties_set', properties);
  }

  /**
   * Set user ID for logged-in users (only after consent)
   */
  setUserId(userId: string): void {
    if (!this.canTrack()) return;

    this.enqueue((api, analytics) => api.setUserId(analytics, userId));
    this.debugService.logEvent('user_id_set', { user_id: userId });
  }

  /**
   * Clear user ID (logout)
   */
  clearUserId(): void {
    if (!this.canTrack()) return;

    this.enqueue((api, analytics) => api.setUserId(analytics, null));
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

    this.log('page_view', {
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
    this.log('generate_lead', eventData);
  }

  /**
   * Track portfolio project clicks
   */
  trackProjectClick(projectName: string, projectUrl?: string): void {
    if (!this.canTrack()) return;

    this.log('select_content', {
      content_type: 'project',
      item_id: projectName,
      item_name: projectName,
      project_url: projectUrl || '',
      page_location: window.location.href
    });
  }

  /**
   * Track social media link clicks
   */
  trackSocialClick(platform: 'github' | 'linkedin' | 'twitter' | 'email'): void {
    if (!this.canTrack()) return;

    this.log('social_click', {
      platform,
      page_location: window.location.href
    });
  }

  /**
   * Track skill section interactions
   */
  trackSkillInteraction(skillName: string, interactionType: 'view' | 'click' | 'hover'): void {
    if (!this.canTrack()) return;

    this.log('skill_interaction', {
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

    this.log('donation', {
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

    this.log('language_change', {
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
      this.log('scroll', {
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

    this.log('file_download', {
      file_name: fileName,
      file_type: fileType,
      page_location: window.location.href
    });
  }

  /**
   * Track consent banner interactions
   */
  trackConsentDecision(decision: 'accepted' | 'denied'): void {
    if (!this.isBrowser) return;
    // This should track even without consent (for compliance reporting)
    this.log('consent_decision', {
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

    this.log(eventName, {
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

    this.log('search', {
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
      this.log('click', {
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

    this.log('page_not_found', {
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
        this.log('form_start', eventData);
        break;
      case 'submit':
        this.log('form_submit', eventData);
        break;
      case 'error':
        this.log('form_error', eventData);
        break;
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metricName: string, value: number, unit: 'ms' | 'bytes' | 'count'): void {
    if (!this.canTrack()) return;

    this.log('performance_metric', {
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

    this.log('exception', {
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

    this.log('video_' + action, {
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
      this.log('session_milestone', {
        session_duration_minutes: minutes,
        page_location: window.location.href
      });
    }
  }
}