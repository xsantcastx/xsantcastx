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
import { GradientGeneratorComponent } from './tools/gradient-generator/gradient-generator.component';
import { JwtDecoderComponent } from './tools/jwt-decoder/jwt-decoder.component';
import { UuidGeneratorComponent } from './tools/uuid-generator/uuid-generator.component';
import { HashGeneratorComponent } from './tools/hash-generator/hash-generator.component';
import { MetaTagGeneratorComponent } from './tools/meta-tag-generator/meta-tag-generator.component';
import { EnvValidatorComponent } from './tools/env-validator/env-validator.component';
import { FontPairerComponent } from './tools/font-pairer/font-pairer.component';
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
import { ToolUsageCounterComponent } from './shared/tool-usage-counter/tool-usage-counter.component';
import { MilestoneEffectComponent } from './shared/visit-counter/milestone-effect.component';
import { EggDiscoveryComponent } from './shared/easter-eggs/egg-discovery.component';
import { AffiliateCTAComponent } from './shared/affiliate/affiliate-cta.component';
import { CronBuilderComponent } from './tools/cron-builder/cron-builder.component';
import { ApiRequestBuilderComponent } from './tools/api-request-builder/api-request-builder.component';
import { JsonToTsComponent } from './tools/json-to-ts/json-to-ts.component';
import { MarkdownEditorComponent } from './tools/markdown-editor/markdown-editor.component';
import { DiffCheckerComponent } from './tools/diff-checker/diff-checker.component';
import { TimestampConverterComponent } from './tools/timestamp-converter/timestamp-converter.component';
import { UrlEncoderComponent } from './tools/url-encoder/url-encoder.component';
import { SqlFormatterComponent } from './tools/sql-formatter/sql-formatter.component';
import { BaseConverterComponent } from './tools/base-converter/base-converter.component';
import { PasswordGeneratorComponent } from './tools/password-generator/password-generator.component';
import { QrGeneratorComponent } from './tools/qr-generator/qr-generator.component';
import { LoremGeneratorComponent } from './tools/lorem-generator/lorem-generator.component';
import { ColorConverterComponent } from './tools/color-converter/color-converter.component';
import { CaseConverterComponent } from './tools/case-converter/case-converter.component';
import { FlexboxGeneratorComponent } from './tools/flexbox-generator/flexbox-generator.component';
import { ChmodCalculatorComponent } from './tools/chmod-calculator/chmod-calculator.component';
import { HtmlEntitiesComponent } from './tools/html-entities/html-entities.component';
import { JsonPathComponent } from './tools/json-path/json-path.component';
import { CssUnitsComponent } from './tools/css-units/css-units.component';
import { AspectRatioComponent } from './tools/aspect-ratio/aspect-ratio.component';
import { CssMinifierComponent } from './tools/css-minifier/css-minifier.component';
import { HttpStatusComponent } from './tools/http-status/http-status.component';
import { BorderRadiusComponent } from './tools/border-radius/border-radius.component';
import { EmojiPickerComponent } from './tools/emoji-picker/emoji-picker.component';
import { IpLookupComponent } from './tools/ip-lookup/ip-lookup.component';
import { GridGeneratorComponent } from './tools/grid-generator/grid-generator.component';
import { YamlJsonComponent } from './tools/yaml-json/yaml-json.component';
import { JwtGeneratorComponent } from './tools/jwt-generator/jwt-generator.component';
import { TailwindLookupComponent } from './tools/tailwind-lookup/tailwind-lookup.component';
import { MdTableGeneratorComponent } from './tools/md-table-generator/md-table-generator.component';
import { JsonEscapeComponent } from './tools/json-escape/json-escape.component';
import { AnimationGeneratorComponent } from './tools/animation-generator/animation-generator.component';
import { TextCounterComponent } from './tools/text-counter/text-counter.component';
import { ScreenInfoComponent } from './tools/screen-info/screen-info.component';
import { SlugGeneratorComponent } from './tools/slug-generator/slug-generator.component';
import { CsvJsonComponent } from './tools/csv-json/csv-json.component';
import { FaviconGeneratorComponent } from './tools/favicon-generator/favicon-generator.component';
import { KeyboardShortcutsComponent } from './tools/keyboard-shortcuts/keyboard-shortcuts.component';
import { PlaceholderImageComponent } from './tools/placeholder-image/placeholder-image.component';
import { ColorBlindnessComponent } from './tools/color-blindness/color-blindness.component';
import { RobotsGeneratorComponent } from './tools/robots-generator/robots-generator.component';
import { DnsLookupComponent } from './tools/dns-lookup/dns-lookup.component';
import { BoxModelComponent } from './tools/box-model/box-model.component';
import { SnippetManagerComponent } from './tools/snippet-manager/snippet-manager.component';
import { RegexGeneratorComponent } from './tools/regex-generator/regex-generator.component';
import { TextShadowComponent } from './tools/text-shadow/text-shadow.component';
import { HtmlToMdComponent } from './tools/html-to-md/html-to-md.component';
import { DataSizeComponent } from './tools/data-size/data-size.component';
import { ColorShadesComponent } from './tools/color-shades/color-shades.component';
import { GitReferenceComponent } from './tools/git-reference/git-reference.component';
import { ResponsivePreviewComponent } from './tools/responsive-preview/responsive-preview.component';
import { PomodoroComponent } from './tools/pomodoro/pomodoro.component';
import { CssFilterComponent } from './tools/css-filter/css-filter.component';
import { NpmSearchComponent } from './tools/npm-search/npm-search.component';
import { JsonMinifierComponent } from './tools/json-minifier/json-minifier.component';
import { MorseCodeComponent } from './tools/morse-code/morse-code.component';
import { BinaryTextComponent } from './tools/binary-text/binary-text.component';
import { StringRepeaterComponent } from './tools/string-repeater/string-repeater.component';
import { MockDataComponent } from './tools/mock-data/mock-data.component';
import { ApcaContrastComponent } from './tools/apca-contrast/apca-contrast.component';
import { TsPlaygroundComponent } from './tools/ts-playground/ts-playground.component';
import { CaesarCipherComponent } from './tools/caesar-cipher/caesar-cipher.component';
import { DesignTokensComponent } from './tools/design-tokens/design-tokens.component';


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
    GradientGeneratorComponent,
    JwtDecoderComponent,
    UuidGeneratorComponent,
    HashGeneratorComponent,
    MetaTagGeneratorComponent,
    EnvValidatorComponent,
    FontPairerComponent,
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
    NewsletterCaptureComponent,
    ToolUsageCounterComponent,
    MilestoneEffectComponent,
    EggDiscoveryComponent,
    AffiliateCTAComponent,
    CronBuilderComponent,
    ApiRequestBuilderComponent,
    JsonToTsComponent,
    MarkdownEditorComponent,
    DiffCheckerComponent,
    TimestampConverterComponent,
    UrlEncoderComponent,
    SqlFormatterComponent,
    BaseConverterComponent,
    PasswordGeneratorComponent,
    QrGeneratorComponent,
    LoremGeneratorComponent,
    ColorConverterComponent,
    CaseConverterComponent,
    FlexboxGeneratorComponent,
    ChmodCalculatorComponent,
    HtmlEntitiesComponent,
    JsonPathComponent,
    CssUnitsComponent,
    AspectRatioComponent,
    CssMinifierComponent,
    HttpStatusComponent,
    BorderRadiusComponent,
    EmojiPickerComponent,
    IpLookupComponent,
    GridGeneratorComponent,
    YamlJsonComponent,
    JwtGeneratorComponent,
    TailwindLookupComponent,
    MdTableGeneratorComponent,
    JsonEscapeComponent,
    AnimationGeneratorComponent,
    TextCounterComponent,
    ScreenInfoComponent,
    SlugGeneratorComponent,
    CsvJsonComponent,
    FaviconGeneratorComponent,
    KeyboardShortcutsComponent,
    PlaceholderImageComponent,
    ColorBlindnessComponent,
    RobotsGeneratorComponent,
    DnsLookupComponent,
    BoxModelComponent,
    SnippetManagerComponent,
    RegexGeneratorComponent,
    TextShadowComponent,
    HtmlToMdComponent,
    DataSizeComponent,
    ColorShadesComponent,
    GitReferenceComponent,
    ResponsivePreviewComponent,
    PomodoroComponent,
    CssFilterComponent,
    NpmSearchComponent,
    JsonMinifierComponent,
    MorseCodeComponent,
    BinaryTextComponent,
    StringRepeaterComponent,
    MockDataComponent,
    ApcaContrastComponent,
    TsPlaygroundComponent,
    CaesarCipherComponent,
    DesignTokensComponent
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

