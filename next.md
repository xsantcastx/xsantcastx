## IMPORTANT: Security Configuration

Before implementing Firebase Analytics, ensure your .gitignore includes all API-related files:

```gitignore
# API Keys and Configuration Files
src/app/brevo.config.ts
src/app/firebase.config.ts
src/app/analytics.config.ts
src/app/api.config.ts
**/config/api-keys.ts
**/config/secrets.ts

# Firebase Configuration Files
.firebaserc
firebase-debug.log
firebase-debug.*.log
firestore-debug.log
ui-debug.log
.firebase/

# Google Analytics and Third-party API configs
ga-config.ts
google-analytics.config.ts
stripe.config.ts
paypal.config.ts
social-auth.config.ts
```

## Firebase Analytics Setup

1) Prep in Firebase Console

Open your Firebase project → Build → Analytics → Dashboard.

If Analytics isn’t enabled, Enable Google Analytics and create/link a GA4 property.

In Analytics → Data streams → Web, either create a Web stream or open the existing one and copy the Measurement ID (G-XXXXXXXXXX).

Also grab your Firebase config (with apiKey, projectId, etc.). Make sure it includes measurementId.

2) Install SDKs

From your Angular project root:

npm i firebase @angular/fire

3) Add config (with measurementId)

In src/environments/environment.ts (and environment.prod.ts) add your config:

export const environment = {
  production: false,
  firebase: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...',
    measurementId: 'G-XXXXXXXXXX' // <- REQUIRED for Analytics
  }
};

4) Initialize Firebase + Analytics (Angular 16+ standalone)

In src/main.ts (or your app bootstrap), wire up AngularFire and Analytics:

import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAnalytics, getAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { isSupported as analyticsIsSupported } from 'firebase/analytics';
import { environment } from './environments/environment';

await bootstrapApplication(AppComponent, {
  providers: [
    provideRouter([]),
    provideHttpClient(),

    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // Only enable Analytics in browsers that support it
    provideAnalytics(async () => (await analyticsIsSupported()) ? getAnalytics() : null),

    // Optional: auto screen_view + user engagement tracking
    ScreenTrackingService,
    UserTrackingService,
  ],
});


If you’re using AppModule instead of standalone, import AngularFireModule.initializeApp(...) and provideAnalytics(() => getAnalytics()) in the module providers, and add ScreenTrackingService / UserTrackingService to providers.

5) (EU/Spain) Consent Mode (recommended)

Because you’re in Spain (GDPR), you should default to denied until user accepts cookies. After user accepts, update consent:

declare global {
  interface Window { dataLayer: any[]; }
}
window.dataLayer = window.dataLayer || [];
function gtag(...args: any[]) { window.dataLayer.push(args); }

// Default: deny until user accepts
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'denied',
  security_storage: 'granted'
});

// When user accepts your cookie banner:
export function acceptAnalyticsConsent() {
  gtag('consent', 'update', {
    analytics_storage: 'granted'
  });
}


Add a simple cookie banner and call acceptAnalyticsConsent() on accept. (If you already inject a CMP, hook it there.)

6) SPA page_view tracking (auto vs manual)

With ScreenTrackingService (shown above), AngularFire automatically sends screen_view events on router navigation—good enough for GA4.

If you prefer explicit page_view events, subscribe to router events and log them manually:

import { inject, Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PageViewService {
  private router = inject(Router);
  private analytics = inject(Analytics);

  init() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        logEvent(this.analytics, 'page_view', { page_location: window.location.href, page_path: e.urlAfterRedirects });
      });
  }
}


Call pageViewService.init() once (e.g., in AppComponent).

7) Log key business events

Add custom events where it matters (contact form, lead, purchase, etc.):

import { inject } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';

export class ContactService {
  private analytics = inject(Analytics);

  trackContactSubmit(method: 'form' | 'whatsapp' | 'email') {
    logEvent(this.analytics, 'generate_lead', {
      method, // GA4 param
      page_location: window.location.href
    });
  }

  trackPortfolioClick(projectName: string) {
    logEvent(this.analytics, 'select_content', {
      content_type: 'project',
      item_id: projectName
    });
  }

  trackHireMeClick() {
    logEvent(this.analytics, 'cta_click', { cta: 'hire_me' });
  }
}

8) Verify it’s working

DebugView: in GA4, go to Admin → DebugView. Open your app with either:

Add ?firebase_analytics_debug_mode=true to your URL, or

In code: logEvent(analytics, 'tutorial_begin', { debug_mode: 1 }).

You should see screen_view, user_engagement, and your custom events in near-real time.

In Firebase Console → Analytics → Dashboard, data appears (most cards within minutes, some reports can take longer).

9) Production build considerations

Make sure environment.prod.ts also has measurementId.

If you’re doing SSR, only instantiate Analytics in the browser (use isPlatformBrowser guard).

Keep @angular/fire and firebase on compatible versions.

10) Minimal checklist (copy/paste)

 GA4 enabled + Web Data Stream created (copy G-...).

 firebase + @angular/fire installed.

 measurementId added to env configs.

 provideFirebaseApp + provideAnalytics in main.ts.

 (Optional) ScreenTrackingService + UserTrackingService added.

 Consent Mode wired to your cookie banner.

 Custom events added for lead/contact/CTA.

 Verified in DebugView.

## Security Best Practices for API Files

**CRITICAL:** Never commit API keys or sensitive configuration to git:

1. **Always use .gitignore** for files containing:
   - API keys (Firebase, Brevo, Stripe, PayPal, etc.)
   - Private configuration files
   - Environment-specific secrets

2. **Create template files** instead:
   - `firebase.config.template.ts` (safe for git)
   - `firebase.config.ts` (ignored by git, contains real keys)

3. **Environment variables** for production:
   - Use deployment-specific environment variables
   - Never hardcode API keys in source code

4. **If you accidentally commit an API key:**
   - Immediately revoke/regenerate the key
   - Clean git history if possible
   - Update all deployments with new keys

5. **Regular security audits:**
   - Review .gitignore regularly
   - Check for accidentally committed secrets
   - Rotate API keys periodically




   Must-dos (quick wins)

Disable in dev
Only init Analytics when environment.production is true.

Consent Mode v2 (GDPR, Spain)
Default to denied; grant on banner accept. (You already have the pattern—be sure it runs before Analytics.)

Name screens properly
Set router titles so screen_view has meaningful names (Angular’s TitleStrategy).

High-impact analytics setup

Define conversions in GA4 (e.g., generate_lead, cta_click, purchase).

User properties (non-PII): plan, language, theme, role, region.

import { setUserProperties } from '@angular/fire/analytics';
setUserProperties(analytics, { app_theme: 'dark', lang: 'es' });


User ID (if you have login)
Set only after consent and login, never store emails.

import { setUserId } from '@angular/fire/analytics';
setUserId(analytics, userId);

Event coverage you’ll actually use

Outbound link + file downloads

// (example) call on click handlers
logEvent(analytics, 'click', { link_domain: new URL(href).hostname, link_url: href });
logEvent(analytics, 'file_download', { file_name, file_extension });


404 / empty state

logEvent(analytics, 'page_not_found', { page_path: location.pathname });


Performance funnel

first_contentful_paint, ttfb, route_change_time (custom timings via performance.now()).

Form funnel

form_start, form_submit, form_error with form_id/field_name.

Firebase extras (pairs great with GA4)

Performance Monitoring (web)

import { providePerformance, getPerformance } from '@angular/fire/performance';
providers: [ providePerformance(() => getPerformance()) ]


Remote Config + A/B Testing
Toggle copy/CTAs and measure impact.

import { getRemoteConfig, fetchAndActivate, getValue } from '@angular/fire/remote-config';


BigQuery Export (free for export)
Enable GA4 → BigQuery link for raw data (retention, custom queries, LTV cohorts).

Crash reporting for front-end errors
If you use Sentry/Rollbar, add an Analytics bridge: log exception events with severity.

Multi-site / campaign hygiene

Multiple domains? Configure cross-domain in GA4 (Admin → Data streams → Configure tag settings).

UTM parsing
Persist UTM params to localStorage and attach to lead events:

logEvent(analytics, 'generate_lead', { source: utm_source, medium: utm_medium, campaign: utm_campaign });

Implementation polish

Router title strategy (better screen names)

import { TitleStrategy, RouterStateSnapshot } from '@angular/router';
export class AppTitleStrategy extends TitleStrategy {
  updateTitle(snapshot: RouterStateSnapshot) {
    const title = this.buildTitle(snapshot);
    if (title) document.title = `xsantcastx | ${title}`;
  }
}


Guard for SSR (if applicable): only call Analytics on browser.

Content-Security-Policy: allow GA endpoints if you set CSP.

Docs & Privacy: update your Privacy Policy to mention Analytics + consent.

Tiny checklist to commit

 Init Analytics only in prod.

 Consent Mode v2 wired to your cookie banner.

 ScreenTrackingService + meaningful route titles.

 User properties + (optional) user_id post-login.

 Lead/CTA/download/outbound/404 events implemented.

 Performance Monitoring + (optional) Remote Config.

 GA4 → BigQuery export enabled.

 Conversions configured in GA4 Admin.

 Cross-domain & UTM persistence (if needed).