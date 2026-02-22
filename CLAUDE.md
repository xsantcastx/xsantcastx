# CLAUDE.md — xsantcastx Portfolio & Donations Platform

This file gives AI assistants the context needed to work effectively in this codebase.

---

## Project Overview

**xsantcastx** is a personal portfolio and donations platform built with Angular 20 and Firebase. It serves as a professional showcase (skills, projects, contact) with an integrated donation system (Stripe, PayPal, crypto). The app is a single-page application deployed to Firebase Hosting, backed by Firebase Cloud Functions for payment processing and email.

- Live site: `xsantcastx.com`
- Firebase project: `xsantcastx-1694b`
- Owner: Senior Full-Stack / Data Engineer based in Spain

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | Angular 20 (NgModule-based, migrating to standalone) |
| Language | TypeScript 5.8, strict mode |
| Backend | Firebase Cloud Functions (Node 22, TypeScript) |
| Database | Firebase Firestore + Firebase Realtime Database |
| Auth | Firebase Authentication |
| Hosting | Firebase Hosting |
| Analytics | Firebase Analytics (GA4) |
| Performance | Firebase Performance Monitoring |
| App security | Firebase AppCheck (reCAPTCHA v3) |
| Payments | Stripe (Checkout), PayPal SDK, Crypto (BTC/ETH/SOL) |
| Email | Brevo API (frontend), Nodemailer via Firebase Functions |
| Particles | @tsparticles/angular |
| Testing | Karma + Jasmine |

---

## Repository Layout

```
xsantcastx/
├── src/
│   ├── app/                    # Angular application root
│   │   ├── app.module.ts       # NgModule root (providers, Firebase init)
│   │   ├── app-routing.module.ts  # Route declarations with SEO metadata
│   │   ├── app.routes.ts       # Standalone routes (parallel definition, includes lazy guestbook)
│   │   ├── app.component.*     # Shell component
│   │   │
│   │   ├── about/              # About page section component
│   │   ├── aboutme-card/       # Standalone card component
│   │   ├── contact/            # Contact form page
│   │   ├── cookie-banner/      # GDPR cookie consent UI
│   │   ├── crypto-card/        # Crypto wallet display
│   │   ├── donate/             # Donations page
│   │   ├── donation-feed/      # Real-time donation activity feed
│   │   ├── donation-form/      # Multi-method donation form
│   │   ├── eg/                 # Playground/examples component
│   │   ├── footer/             # Footer component
│   │   ├── grid-sections/      # Grid layout section
│   │   ├── guestbook/          # Firestore-backed guestbook (lazy-loaded)
│   │   ├── header/             # Navigation header
│   │   ├── hero/               # Landing hero component
│   │   ├── news-feed/          # News/updates feed
│   │   ├── projects/           # Portfolio projects page
│   │   ├── resume-card/        # Standalone resume card
│   │   ├── services/           # Services offered page
│   │   ├── skills/             # Technical skills page
│   │   ├── transaction-list/   # Payment transaction list
│   │   ├── wallet-summary/     # Crypto wallet summary
│   │   │
│   │   ├── models/
│   │   │   ├── crypto.models.ts
│   │   │   └── portfolio.models.ts
│   │   │
│   │   ├── shared/
│   │   │   ├── components.ts           # Shared component exports
│   │   │   ├── event-tracking.directive.ts
│   │   │   └── title-strategy.service.ts  # Custom TitleStrategy for SEO
│   │   │
│   │   ├── analytics.service.ts        # GA4 event tracking (consent-gated)
│   │   ├── analytics-debug.service.ts  # Dev-only analytics logging
│   │   ├── app-check.interceptor.ts    # Adds X-Firebase-AppCheck header to HTTP
│   │   ├── auth-service.service.ts     # Firebase Auth wrapper
│   │   ├── consent.service.ts          # GDPR consent management (gtag)
│   │   ├── contact.service.ts          # Contact form submission logic
│   │   ├── email.service.ts            # Brevo email API calls
│   │   ├── firebase-error-handler.service.ts
│   │   ├── firebase.service.ts         # Firebase utility service
│   │   ├── firestore.service.ts        # Firestore CRUD helpers
│   │   ├── payment.service.ts          # Stripe + PayPal SDK integration
│   │   ├── performance.service.ts      # Firebase Performance helpers
│   │   ├── portfolio.service.ts        # Projects/skills data (JSON assets)
│   │   ├── realtime-dbservice.service.ts  # Firebase RTDB wrapper
│   │   ├── scroll-tracking.directive.ts   # Scroll depth analytics directive
│   │   ├── tracking-prevention.service.ts
│   │   ├── translation.service.ts      # i18n (en/es) service
│   │   ├── user.service.ts             # User profile management
│   │   ├── utm-tracking.service.ts     # UTM parameter capture
│   │   │
│   │   └── *.config.template.ts        # Config templates (copy to configure)
│   │
│   ├── assets/
│   │   ├── data/
│   │   │   ├── projects.json   # Portfolio project data
│   │   │   └── skills.json     # Skills data
│   │   └── *.svg               # Logo and placeholder images
│   │
│   ├── environments/
│   │   ├── environment.ts              # Dev environment (real Firebase config)
│   │   ├── environment.prod.ts         # Production environment
│   │   ├── environment.template.ts     # Template for new devs
│   │   └── environment.prod.template.ts
│   │
│   ├── index.html
│   ├── main.ts
│   └── styles.css              # Global styles
│
├── functions/                  # Firebase Cloud Functions (separate Node project)
│   ├── src/
│   │   ├── index.ts            # Function exports, global options
│   │   ├── contact.ts          # sendContactEmail function
│   │   ├── paypal.ts           # PayPal payment + stats functions
│   │   ├── stripe.ts           # Stripe checkout + webhook functions
│   │   └── test-functions.ts   # Function test helpers
│   ├── package.json            # Node 22, separate dependencies
│   └── tsconfig.json
│
├── scripts/                    # Deployment helper scripts
│   ├── setup.sh
│   ├── build-env.sh
│   └── build-env.bat
│
├── angular.json                # Angular CLI workspace config
├── firebase.json               # Firebase Hosting + Functions config
├── tsconfig.json               # Root TypeScript config (strict mode)
├── tsconfig.app.json
├── tsconfig.spec.json
└── params.env                  # Firebase env param file (not committed with secrets)
```

---

## Routes

Defined in `src/app/app-routing.module.ts` (NgModule) and mirrored in `src/app/app.routes.ts` (standalone):

| Path | Component | Notes |
|---|---|---|
| `/home` | `HeroComponent` | Landing page, default redirect |
| `/skills` | `SkillsComponent` | Tech skills grid |
| `/projects` | `ProjectsComponent` | Portfolio projects |
| `/contact` | `ContactComponent` | Contact form + social links |
| `/donate` | `DonateComponent` | Payment methods |
| `/guestbook` | `GuestbookComponent` | Lazy-loaded (standalone route only) |
| `/` | redirect → `/home` | |

---

## Development Commands

### Frontend (Angular)

```bash
# Install dependencies
npm install

# Dev server (http://localhost:4200)
npm start
# or: npx ng serve

# Production build → dist/xsantcastx/browser
npm run build

# Dev build with watch
npm run watch

# Unit tests (Karma + Jasmine, headless Chrome)
npm test
```

### Firebase Functions

```bash
cd functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Build + watch
npm run build:watch

# Local emulator (functions only)
npm run serve

# Deploy functions only
npm run deploy

# Stream logs
npm run logs

# Lint
npm run lint
```

### Firebase Deployment

```bash
# Full deploy (hosting + functions)
firebase deploy

# Hosting only
firebase deploy --only hosting

# Functions only
firebase deploy --only functions

# Local emulators (all)
firebase emulators:start
```

---

## Environment Configuration

**Never commit real secrets.** The project uses template files to onboard new developers:

| Template file | Purpose |
|---|---|
| `src/environments/environment.template.ts` | Dev environment template |
| `src/environments/environment.prod.template.ts` | Prod environment template |
| `src/app/api.config.template.ts` | API keys template |
| `src/app/brevo.config.template.ts` | Brevo email config |
| `src/app/paypal.config.template.ts` | PayPal config |
| `src/app/stripe.config.template.ts` | Stripe config |
| `src/app/social-auth.config.template.ts` | Social auth config |

**To set up locally:**
1. Copy `environment.template.ts` → `environment.ts` (already done for the Firebase project)
2. Replace placeholder values (`YOUR_*_HERE`) with real keys
3. Do the same for `environment.prod.ts` before production deploys

**Key environment sections** (`environment.ts`):
- `firebase` — Firebase project config (safe to commit for this project)
- `appCheck.siteKey` — reCAPTCHA v3 site key (safe to commit)
- `appCheck.debugToken` — Local debug token (leave empty or use `'auto'`)
- `email.brevo.apiKey` — Brevo API key (**never commit**)
- `payments.paypal.clientId` — PayPal client ID
- `payments.stripe.publishableKey` — Stripe publishable key (safe for frontend)
- `payments.crypto` — Static wallet addresses (safe to commit)

---

## Angular Module Architecture

The app uses **NgModule** (`AppModule`) as the root module. Some newer components (`ResumeCardComponent`, `AboutmeCardComponent`) are standalone and imported directly in `AppModule.imports`.

**AppModule providers** configure:
- `provideFirebaseApp` — initializes Firebase with `environment.firebase`
- `provideAppCheck` — reCAPTCHA v3 with singleton guard (avoids double-init)
- `provideFirestore` — with `experimentalForceLongPolling: true`
- `provideDatabase`, `provideAuth`, `provideFunctions`
- `provideAnalytics`, `providePerformance`
- `AppCheckInterceptor` — HTTP interceptor that injects the AppCheck token header
- `AppTitleStrategy` — Custom `TitleStrategy` for SEO page titles + Analytics screen names
- `ScreenTrackingService`, `UserTrackingService` — Automatic GA4 tracking

---

## Key Service Responsibilities

| Service | Role |
|---|---|
| `AnalyticsService` | Consent-gated GA4 event tracking. All `logEvent` calls go through `canTrack()` check. |
| `ConsentService` | GDPR consent state. Initializes `gtag` with `analytics_storage: denied` by default (Spain/EU). Reads/writes `localStorage['xsantcastx_consent']`. |
| `PaymentService` | Loads PayPal and Stripe SDKs dynamically. Skips load if keys contain placeholder strings. Calls Firebase Functions for Stripe Checkout sessions. |
| `ContactService` | Submits contact form via the `/api/send-contact` Firebase Function (proxied by Firebase Hosting rewrite). |
| `FirestoreService` | Generic Firestore CRUD helpers. |
| `RealtimeDbService` | Firebase RTDB helpers (used for live donation feed). |
| `TranslationService` | Basic i18n for en/es. |
| `UtmTrackingService` | Captures UTM params from URL on page load. |
| `ScrollTrackingDirective` | Reports scroll depth milestones (25/50/75/100%) to `AnalyticsService`. |

---

## Firebase Cloud Functions

Defined in `functions/src/`, exported from `functions/src/index.ts`.

Global options: `maxInstances: 10`, `enforceAppCheck: true` (all functions require a valid AppCheck token).

| Export | File | Purpose |
|---|---|---|
| `sendContactEmail` | `contact.ts` | Sends contact form email via Nodemailer; routed via `/api/send-contact` |
| `paypal.processPayment` | `paypal.ts` | Handles PayPal payment capture |
| `paypal.getStats` | `paypal.ts` | Returns PayPal donation statistics |
| `stripe.createCheckoutSession` | `stripe.ts` | Creates Stripe Checkout session |
| `stripe.verifyCheckoutSession` | `stripe.ts` | Verifies Stripe session after redirect |
| `stripe.createPaymentIntent` | `stripe.ts` | Creates Stripe Payment Intent |
| `stripe.confirmPayment` | `stripe.ts` | Confirms Stripe payment |
| `stripe.handleWebhook` | `stripe.ts` | Stripe webhook handler |
| `stripe.getStats` | `stripe.ts` | Returns Stripe donation statistics |

The `/api/send-contact` route is rewired in `firebase.json`:
```json
{ "source": "/api/send-contact", "function": { "functionId": "sendContactEmail" } }
```

---

## Testing

The project uses **Karma + Jasmine** for unit tests.

```bash
npm test        # Runs all tests in Chrome (headless by default)
```

Test files follow Angular convention: `*.spec.ts` co-located with the file under test.

Existing spec files:
- `app.component.spec.ts`
- `auth-service.service.spec.ts`
- `portfolio.service.spec.ts`
- `realtime-dbservice.service.spec.ts`
- `aboutme-card/aboutme-card.component.spec.ts`
- `contact/contact.component.spec.ts`
- `donation-feed/donation-feed.component.spec.ts`
- `eg/eg.component.spec.ts`
- `footer/footer.component.spec.ts`
- `grid-sections/grid-sections.component.spec.ts`
- `guestbook/guestbook.component.spec.ts`
- `header/header.component.spec.ts`
- `hero/hero.component.spec.ts`
- `news-feed/news-feed.component.spec.ts`
- `projects/projects.component.spec.ts`
- `resume-card/resume-card.component.spec.ts`
- `skills/skills.component.spec.ts`
- `transaction-list/transaction-list.component.spec.ts`
- `wallet-summary/wallet-summary.component.spec.ts`
- `crypto-card/crypto-card.component.spec.ts`

---

## TypeScript Configuration

Strict mode is fully enabled (`tsconfig.json`):
- `strict: true`
- `noImplicitOverride: true`
- `noPropertyAccessFromIndexSignature: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- `strictTemplates: true` (Angular compiler)
- `strictInjectionParameters: true`
- Target: `ES2022`, module: `ES2022`

**Do not use `any` without justification.** The codebase has some legacy `any` in payment callbacks where third-party SDK types are unavailable; this is acceptable. New code should use proper types.

---

## Code Conventions

### Component structure
- Each component lives in its own folder: `component-name/component-name.component.{ts,html,css}`
- Components follow Angular naming: `kebab-case` folders, `PascalCase` class names
- Schematics use type separators (`.component`, `.service`, `.directive`, etc.)

### Services
- All services are `providedIn: 'root'` (tree-shakable, singleton)
- Use Angular `inject()` function (not constructor injection) for new services
- Guard analytics/consent calls with `canTrack()` before calling `logEvent`

### Analytics pattern
```typescript
// Always check consent before tracking
if (!this.canTrack()) return;
logEvent(this.analytics, 'event_name', { ...data });
```

### Payment SDK guard
Both `PaymentService.loadPayPalSDK()` and `loadStripeSDK()` check for placeholder strings before loading SDKs. This prevents errors in dev when keys are not configured.

### Environment guard pattern
```typescript
if (!key || key.includes('YOUR_') || key.includes('PLACEHOLDER')) {
  // skip or warn, never throw
}
```

### Firebase AppCheck singleton guard
`AppModule` uses a global scope flag (`globalScope.__xsantcastxAppCheck`) to prevent double-initialization of AppCheck across hot reloads.

---

## Git Workflow

The project follows a **Gitflow** pattern:

| Branch | Purpose |
|---|---|
| `master` | Production releases |
| `develop` | Integration branch |
| `release/x.x.xx` | Release preparation |
| `feature/*` | Feature branches |
| `claude/*` | Claude AI assistant branches |

Commit messages are descriptive and lowercase. Merge commits are common (`Merge branch 'release/...'`).

**Current working branch for AI tasks:** `claude/claude-md-mlxkf0vusnnm93c9-f8Jjn`

---

## Security Notes

- **Firebase AppCheck** is enforced on all Cloud Functions (`enforceAppCheck: true`). Calls without a valid token are rejected.
- **AppCheckInterceptor** automatically adds the `X-Firebase-AppCheck` header to HTTP requests.
- **GDPR consent** defaults to denied. Analytics only fire after the user accepts via `CookieBannerComponent`.
- **Firestore rules** should restrict writes to authenticated users or validated data (check Firebase console).
- **Never put secret keys** (Stripe secret, Brevo API key, Firebase service account) in frontend code or committed environment files.
- The `params.env` file is used for Cloud Functions secret parameters (not committed).

---

## Build Output

```
dist/
└── xsantcastx/
    └── browser/        ← Firebase Hosting serves this
        ├── index.html
        ├── main-*.js
        ├── chunk-*.js
        └── assets/
```

Build budgets (enforced):
- Initial bundle: warning at 1.1 MB, error at 1.4 MB
- Component styles: warning at 8 KB, error at 12 KB

---

## Static Data Files

- `src/assets/data/projects.json` — Portfolio projects list (consumed by `PortfolioService`)
- `src/assets/data/skills.json` — Skills data (consumed by `SkillsComponent`)

When adding new projects or skills, update these JSON files rather than hardcoding in components.

---

## i18n

`TranslationService` provides basic English/Spanish support. The app targets Spanish and English-speaking audiences. The `ConsentService` defaults to GDPR-compliant behavior suited for Spain/EU.

---

## Common Tasks for AI Assistants

**Adding a new component:**
```bash
npx ng generate component component-name
```
This creates `src/app/component-name/` with `.ts`, `.html`, `.css`, `.spec.ts`. Add to `AppModule.declarations` if not standalone.

**Adding a new route:**
1. Add to `src/app/app-routing.module.ts` (NgModule routing, used at runtime)
2. Mirror in `src/app/app.routes.ts` if needed
3. Include SEO `title` and `data.description` on the route object

**Adding a new Firebase Function:**
1. Create `functions/src/my-function.ts`
2. Export from `functions/src/index.ts`
3. If it needs an HTTP rewrite, add to `firebase.json` under `hosting.rewrites`

**Adding analytics tracking:**
1. Inject `AnalyticsService` into the component/service
2. Call the appropriate `track*` method (already defined for most use cases)
3. For new event types, add a typed method to `AnalyticsService` following the consent-gated pattern

**Modifying environment config:**
- Edit `src/environments/environment.ts` for dev changes
- Edit `src/environments/environment.prod.ts` for prod changes
- Update both `*.template.ts` files if adding new config keys so other devs know what to fill in
