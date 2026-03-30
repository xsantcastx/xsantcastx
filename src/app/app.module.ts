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
import { NgxParticlesModule } from '@tsparticles/angular';
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
import { ToolsComponent } from './tools/tools.component';
import { PdfGeneratorComponent } from './tools/pdf-generator/pdf-generator.component';
import { ColorPaletteComponent } from './tools/color-palette/color-palette.component';
import { ContrastCheckerComponent } from './tools/contrast-checker/contrast-checker.component';
import { ImageCompressorComponent } from './tools/image-compressor/image-compressor.component';
import { GmailDeliverabilityCheckerComponent } from './tools/gmail-deliverability-checker/gmail-deliverability-checker.component';
import { BoxShadowGeneratorComponent } from './tools/box-shadow-generator/box-shadow-generator.component';
import { EmailDeliverabilityAuditorComponent } from './tools/email-deliverability-auditor/email-deliverability-auditor.component';
import { SslCertificateInspectorComponent } from './tools/ssl-certificate-inspector/ssl-certificate-inspector.component';
import { SvgToCodeComponent } from './tools/svg-to-code/svg-to-code.component';
import { SslCertificateAuditorComponent } from './tools/ssl-certificate-auditor/ssl-certificate-auditor.component';
import { JsonFormatterComponent } from './tools/json-formatter/json-formatter.component';
import { RegexTesterComponent } from './tools/regex-tester/regex-tester.component';
import { Base64EncoderComponent } from './tools/base64-encoder/base64-encoder.component';
import { NewsFeedComponent } from './news-feed/news-feed.component';
import { ServicesComponent } from './services/services.component';
import { AboutComponent } from './about/about.component';
import { CookieBannerComponent } from './cookie-banner/cookie-banner.component';
import { ScrollTrackingDirective } from './scroll-tracking.directive';
import { CommonModule } from '@angular/common';
import { AppCheckInterceptor } from './app-check.interceptor';
import { AppTitleStrategy } from './shared/title-strategy.service';
import { LiveComponent } from './live/live.component';
import { CarbonAdComponent } from './shared/carbon-ad/carbon-ad.component';
import { AdsenseComponent } from './shared/adsense/adsense.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { RelatedToolsComponent } from './shared/related-tools.component';
import { EmbedBarComponent } from './shared/embed-bar/embed-bar.component';
import { EmbedCodeGeneratorComponent } from './shared/embed-code-generator/embed-code-generator.component';
import { EmbedLandingComponent } from './embed-landing/embed-landing.component';
import { NewsletterCaptureComponent } from './shared/newsletter/newsletter-capture.component';


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
    ToolsComponent,
    PdfGeneratorComponent,
    ColorPaletteComponent,
    ContrastCheckerComponent,
    ImageCompressorComponent,
    GmailDeliverabilityCheckerComponent,
    BoxShadowGeneratorComponent,
    EmailDeliverabilityAuditorComponent,
    SslCertificateInspectorComponent,
    SslCertificateAuditorComponent,
    SvgToCodeComponent,
    JsonFormatterComponent,
    RegexTesterComponent,
    Base64EncoderComponent,
    NewsFeedComponent,
    ServicesComponent,
    AboutComponent,
    CookieBannerComponent,
    ScrollTrackingDirective,
    LiveComponent,
    CarbonAdComponent,
    AdsenseComponent,
    NotFoundComponent,
    RelatedToolsComponent,
    EmbedBarComponent,
    EmbedCodeGeneratorComponent,
    EmbedLandingComponent,
    NewsletterCaptureComponent
  ],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    NgxParticlesModule,
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
      return initializeFirestore(app, {
        experimentalForceLongPolling: true
      });
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

