import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

// True only in a real browser — evaluated at module-load time so server prerender
// skips all browser-only Firebase services entirely.
const isBrowserEnv = typeof window !== 'undefined';
import { TitleStrategy } from '@angular/router';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideFirebaseApp, initializeApp, getApp, getApps } from '@angular/fire/app';
import { providePerformance, getPerformance } from '@angular/fire/performance';
import { environment } from '../environments/environment';
import { CookieBannerComponent } from './cookie-banner/cookie-banner.component';
import { CommonModule } from '@angular/common';
import { AppCheckInterceptor } from './app-check.interceptor';
import { AppTitleStrategy } from './shared/title-strategy.service';
import { CloudSaveMergeDialogComponent } from './shared/cloud-save/cloud-save-merge-dialog.component';
import { DeviceLeaseBannerComponent } from './shared/save/device-lease-banner.component';
import { SiteNoticeOutletComponent } from './shared/notice/site-notice-outlet.component';
import { PwaOutletComponent } from './shared/pwa/pwa-outlet.component';
import { ErrorTrackingService, GodforgeErrorHandler } from './shared/error-tracking.service';
import { ErrorHandler, APP_INITIALIZER } from '@angular/core';
import { PwaService } from './shared/pwa.service';


@NgModule({
  // Every routed page is standalone and lazy-loaded (see app-routing.module.ts).
  // What is left here is the app shell — the pieces AppComponent renders on
  // every route.
  declarations: [
    AppComponent,
    CookieBannerComponent,
  ],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    CommonModule,
    // Standalone — imported here so the (non-standalone) HeaderComponent and
    // AppComponent templates can use them without the module graph moving.
    CloudSaveMergeDialogComponent,
    DeviceLeaseBannerComponent,
    SiteNoticeOutletComponent,
    PwaOutletComponent,
    // Standalone, imported here because AppComponent's template is not.
],
  providers: [
    provideFirebaseApp(() => getApps().length ? getApp() : initializeApp(environment.firebase)),
    // Uncaught-error capture. Installed via APP_INITIALIZER rather than from
    // AppComponent.ngOnInit so the window handlers are attached before the
    // first component renders — an error thrown during initial render would
    // otherwise be the one error nothing catches.
    ErrorTrackingService,
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [ErrorTrackingService, PwaService],
      useFactory: (errors: ErrorTrackingService, pwa: PwaService) => () => {
        errors.install();
        pwa.init();
      },
    },
    { provide: ErrorHandler, useClass: GodforgeErrorHandler },
    // Performance requires browser APIs — skip on server.
    ...(isBrowserEnv ? [
      providePerformance(() => getPerformance()),
      // App Check is deliberately NOT provided here any more.
      // provideAppCheck() runs during root-injector creation, and
      // ReCaptchaV3Provider reacts by pulling ~333 kB of reCAPTCHA into every
      // page load — including the 123 tool pages that show no captcha. It now
      // initializes on the first idle callback instead; see
      // app-check.bootstrap.ts for the rationale and for the consumers that
      // await it before issuing Firebase traffic.
    ] as any[] : []),
    // Three more providers are deliberately absent, all for the same reason:
    // having them in the root injector puts their SDK in the initial chunk,
    // and nothing on first paint uses any of them.
    //
    //   provideFirestore()  — the ~450 kB Firestore SDK, for a visit counter,
    //                         a changelog and some counters that all run after
    //                         hydration. Consumers go through
    //                         shared/lazy-firestore.service.ts instead.
    //   provideAnalytics()  — statically imports @angular/fire/auth (for
    //                         UserTrackingService), which is what kept the auth
    //                         SDK eager despite provideAuth() already being
    //                         route-scoped. AnalyticsService imports
    //                         `firebase/analytics` on demand. ScreenTracking's
    //                         page_view now comes from AppTitleStrategy.
    //   provideFunctions()  — same static auth import. PaymentService imports
    //                         `firebase/functions` on demand.
    //
    // provideAuth() lives on the lazy /admin route for the same reason.
    // provideDatabase() is gone entirely: the guestbook was the only Realtime
    // Database consumer, so deleting it dropped @angular/fire/database from the
    // build along with the SDK it pulled in.
    { provide: HTTP_INTERCEPTORS, useClass: AppCheckInterceptor, multi: true },
    provideHttpClient(withInterceptorsFromDi()),
    // Custom title strategy for better SEO and Analytics screen names
    { provide: TitleStrategy, useClass: AppTitleStrategy }
  ]
})
export class AppModule { }

