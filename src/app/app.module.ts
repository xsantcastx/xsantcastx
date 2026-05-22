import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

// True only in a real browser — evaluated at module-load time so server prerender
// skips all browser-only Firebase services entirely.
const isBrowserEnv = typeof window !== 'undefined';
import { TitleStrategy } from '@angular/router';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { HeroComponent } from './hero/hero.component';
import { SkillsComponent } from './skills/skills.component';
import { ProjectsComponent } from './projects/projects.component';
import { ContactComponent } from './contact/contact.component';
import { FooterComponent } from './footer/footer.component';
import { FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { EgComponent } from './eg/eg.component';
import { GridSectionsComponent } from './grid-sections/grid-sections.component';
import { GuestbookComponent } from './guestbook/guestbook.component';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideFirestore, getFirestore, initializeFirestore } from '@angular/fire/firestore';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFunctions, getFunctions } from '@angular/fire/functions';
import { provideAnalytics, getAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { providePerformance, getPerformance } from '@angular/fire/performance';
import { provideAppCheck, initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';
import { environment } from '../environments/environment';
import { ResumeCardComponent } from './resume-card/resume-card.component';
import { AboutmeCardComponent } from './aboutme-card/aboutme-card.component';
import { CryptoCardComponent } from './crypto-card/crypto-card.component';
import { WalletSummaryComponent } from './wallet-summary/wallet-summary.component';
import { TransactionListComponent } from './transaction-list/transaction-list.component';
import { DonationFormComponent } from './donation-form/donation-form.component';
import { DonationFeedComponent } from './donation-feed/donation-feed.component';
import { DonateComponent } from './donate/donate.component';
import { LandingComponent } from './landing/landing.component';
import { NewsFeedComponent } from './news-feed/news-feed.component';
import { ServicesComponent } from './services/services.component';
import { AboutComponent } from './about/about.component';
import { CookieBannerComponent } from './cookie-banner/cookie-banner.component';
import { ScrollTrackingDirective } from './scroll-tracking.directive';
import { FocusTrapDirective } from './shared/focus-trap.directive';
import { CommonModule } from '@angular/common';
import { AppCheckInterceptor } from './app-check.interceptor';
import { AppTitleStrategy } from './shared/title-strategy.service';
import { LiveComponent } from './live/live.component';
import { AdsenseComponent } from './shared/adsense/adsense.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { EmbedBarComponent } from './shared/embed-bar/embed-bar.component';
import { MilestoneEffectComponent } from './shared/visit-counter/milestone-effect.component';
import { EggDiscoveryComponent } from './shared/easter-eggs/egg-discovery.component';
import { CommandPaletteComponent } from './shared/command-palette/command-palette.component';
import { GamesComponent } from './games/games.component';
import { McpComponent } from './mcp/mcp.component';


@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    HeroComponent,
    SkillsComponent,
    ProjectsComponent,
    ContactComponent,
    FooterComponent,
    EgComponent,
    GridSectionsComponent,
    GuestbookComponent,
    CryptoCardComponent,
    WalletSummaryComponent,
    TransactionListComponent,
    DonationFormComponent,
    DonationFeedComponent,
    DonateComponent,
    LandingComponent,
    NewsFeedComponent,
    ServicesComponent,
    AboutComponent,
    CookieBannerComponent,
    ScrollTrackingDirective,
    FocusTrapDirective,
    LiveComponent,
    AdsenseComponent,
    NotFoundComponent,
    EmbedBarComponent,
    MilestoneEffectComponent,
    EggDiscoveryComponent,
    CommandPaletteComponent,
    GamesComponent,
    McpComponent
  ],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    CommonModule,
    ResumeCardComponent,
    AboutmeCardComponent
],
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // Analytics, Performance and AppCheck require browser APIs — skip on server
    ...(isBrowserEnv ? [
      provideAnalytics(() => getAnalytics()),
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
      // Firebase Analytics automatic tracking services (browser only)
      ScreenTrackingService,
      UserTrackingService
    ] as any[] : []),
    provideFirestore(() => {
      const app = getApp();
      // Calling initializeFirestore() twice (once on the SSR pass, once on
      // client hydration) throws "Firestore has already been started" and
      // leaves us with two different SDK instances — the source of the
      // "Type does not match the expected instance. Did you pass a reference
      // from a different Firestore SDK?" red wall in the console.
      // Fall back to the already-initialized instance on subsequent calls so
      // every consumer shares one Firestore reference.
      try {
        return initializeFirestore(app, {
          experimentalForceLongPolling: true
        });
      } catch (e) {
        return getFirestore(app);
      }
    }),
    provideDatabase(() => getDatabase()),
    provideAuth(() => getAuth()),
    provideFunctions(() => getFunctions()),
    { provide: HTTP_INTERCEPTORS, useClass: AppCheckInterceptor, multi: true },
    provideHttpClient(withInterceptorsFromDi()),
    // Custom title strategy for better SEO and Analytics screen names
    { provide: TitleStrategy, useClass: AppTitleStrategy }
  ]
})
export class AppModule { }

