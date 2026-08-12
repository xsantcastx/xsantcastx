import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

// True only in a real browser — evaluated at module-load time so server prerender
// skips all browser-only Firebase services entirely.
const isBrowserEnv = typeof window !== 'undefined';
import { TitleStrategy } from '@angular/router';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { providePerformance, getPerformance } from '@angular/fire/performance';
import { provideAppCheck, initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';
import { environment } from '../environments/environment';
import { CookieBannerComponent } from './cookie-banner/cookie-banner.component';
import { ScrollTrackingDirective } from './scroll-tracking.directive';
import { FocusTrapDirective } from './shared/focus-trap.directive';
import { CommonModule } from '@angular/common';
import { AppCheckInterceptor } from './app-check.interceptor';
import { AppTitleStrategy } from './shared/title-strategy.service';
import { EmbedBarComponent } from './shared/embed-bar/embed-bar.component';
import { MilestoneEffectComponent } from './shared/visit-counter/milestone-effect.component';
import { EggDiscoveryComponent } from './shared/easter-eggs/egg-discovery.component';
import { CommandPaletteComponent } from './shared/command-palette/command-palette.component';


@NgModule({
  // Every routed page is standalone and lazy-loaded (see app-routing.module.ts).
  // What is left here is the app shell — the pieces AppComponent renders on
  // every route.
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    CookieBannerComponent,
    ScrollTrackingDirective,
    FocusTrapDirective,
    EmbedBarComponent,
    MilestoneEffectComponent,
    EggDiscoveryComponent,
    CommandPaletteComponent
  ],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    CommonModule
],
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // Performance and AppCheck require browser APIs — skip on server.
    //
    // provideAnalytics() is gone: @angular/fire/analytics statically imports
    // @angular/fire/auth (for UserTrackingService), which put the ~100 kB auth
    // SDK in the initial chunk. AnalyticsService now loads `firebase/analytics`
    // on demand instead, and AppTitleStrategy logs the page_view that
    // ScreenTrackingService used to emit.
    ...(isBrowserEnv ? [
      providePerformance(() => getPerformance()),
      provideAppCheck(() => {
        const siteKey = environment.appCheck?.siteKey ?? '';
        const rawDebugToken = environment.appCheck?.debugToken;
        const debugToken =
          rawDebugToken && rawDebugToken !== 'undefined' && rawDebugToken !== 'null'
            ? rawDebugToken
            : undefined;
        const globalScope = globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown; __xsantcastxAppCheck?: ReturnType<typeof initializeAppCheck> };

        if (!siteKey || siteKey.startsWith('REPLACE_WITH')) {
          console.warn('[AppModule] Firebase App Check site key is not configured. Update environment.appCheck.siteKey before deploying.');
        }

        if (debugToken) {
          globalScope.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'auto' ? true : debugToken;
        }

        if (!globalScope.__xsantcastxAppCheck) {
          globalScope.__xsantcastxAppCheck = initializeAppCheck(getApp(), {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true
          });
        }

        return globalScope.__xsantcastxAppCheck;
      }),
    ] as any[] : []),
    // provideFirestore() is deliberately absent. It forced the ~450 kB
    // Firestore SDK into the initial chunk even though nothing on first paint
    // touches the database. Every consumer now goes through
    // shared/lazy-firestore.service.ts, which dynamically imports
    // `firebase/firestore` on first use — see that file for the details.
    //
    // provideAuth()/provideDatabase() live on the lazy /guestbook and
    // /tools/pdf-generator routes for the same reason: that keeps
    // @firebase/auth + re2js + the RTDB SDK out of the initial bundle.
    // provideFunctions() removed for the same reason as provideAnalytics():
    // @angular/fire/functions statically imports @angular/fire/auth.
    // PaymentService imports `firebase/functions` on demand instead.
    { provide: HTTP_INTERCEPTORS, useClass: AppCheckInterceptor, multi: true },
    provideHttpClient(withInterceptorsFromDi()),
    // Custom title strategy for better SEO and Analytics screen names
    { provide: TitleStrategy, useClass: AppTitleStrategy }
  ]
})
export class AppModule { }

