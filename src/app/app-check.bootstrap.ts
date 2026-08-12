/**
 * Deferred Firebase App Check bootstrap.
 * ──────────────────────────────────────
 * App Check used to be wired through AngularFire's `provideAppCheck()` in
 * AppModule's providers. That factory runs when the root injector is created,
 * i.e. during bootstrap, on every route. `ReCaptchaV3Provider` responds by
 * injecting <script src="https://www.google.com/recaptcha/api.js?render=…">,
 * which is ~333 kB of JavaScript downloaded and parsed while the browser is
 * still trying to paint — on the home page and all 123 tool pages, none of
 * which show a captcha.
 *
 * Nothing needs an App Check token during first paint: `protectedOrigins` is
 * empty, so AppCheckInterceptor attaches nothing, and the only Firestore
 * traffic that early is the visit counter and the changelog — both of which
 * now await `whenAppCheckReady()` so they still carry a token if App Check
 * enforcement is switched on in the Firebase console.
 *
 * So we initialize App Check on the first idle callback instead. The token
 * still exists (and still auto-refreshes) within a second or two of load, but
 * reCAPTCHA's payload no longer competes with LCP resources for bandwidth on
 * a throttled mobile connection.
 *
 * Note this deliberately bypasses Angular DI. `initializeAppCheck()` registers
 * against the FirebaseApp itself, which is what Firestore and Functions read
 * from — `provideAppCheck()` is only DI sugar around the same call. Consumers
 * that want the instance use `getAppCheckInstance()` below rather than
 * `inject(AppCheck)`, which would now always be null.
 */
import { getApp } from '@angular/fire/app';
import { AppCheck, initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';
import { environment } from '../environments/environment';

/** How long to wait for a genuine idle window before initializing anyway. */
const IDLE_TIMEOUT_MS = 2500;
/** Fallback delay on browsers without requestIdleCallback (Safari < 16.4). */
const FALLBACK_DELAY_MS = 1500;

let instance: AppCheck | null = null;
let scheduled = false;
let settle: ((value: AppCheck | null) => void) | null = null;

const ready: Promise<AppCheck | null> = new Promise(resolve => {
  settle = resolve;
});

/**
 * The live App Check instance, or null if it has not initialized yet (or we
 * are on the server). Prefer `whenAppCheckReady()` unless you specifically
 * want a non-blocking peek.
 */
export function getAppCheckInstance(): AppCheck | null {
  return instance;
}

/**
 * Resolves once App Check has initialized — or immediately with null on the
 * server, or if App Check is not configured. Callers that issue Firebase
 * traffic which may be App Check enforced should await this first.
 *
 * Also schedules initialization, so awaiting it can never deadlock on a
 * caller that forgot to call `scheduleAppCheck()`.
 */
export function whenAppCheckReady(): Promise<AppCheck | null> {
  scheduleAppCheck();
  return ready;
}

/**
 * Queue App Check initialization for the next idle window. Idempotent — call
 * it from anywhere, as many times as you like.
 */
export function scheduleAppCheck(): void {
  if (scheduled) return;
  scheduled = true;

  // SSR has no window for reCAPTCHA to attach to, and no need for a token.
  if (typeof window === 'undefined') {
    settle?.(null);
    return;
  }

  const idle = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;

  if (typeof idle === 'function') {
    idle(() => initializeNow(), { timeout: IDLE_TIMEOUT_MS });
  } else {
    window.setTimeout(() => initializeNow(), FALLBACK_DELAY_MS);
  }
}

function initializeNow(): void {
  if (instance) return;

  const siteKey = environment.appCheck?.siteKey ?? '';
  const rawDebugToken = environment.appCheck?.debugToken;
  const debugToken =
    rawDebugToken && rawDebugToken !== 'undefined' && rawDebugToken !== 'null'
      ? rawDebugToken
      : undefined;

  const globalScope = globalThis as typeof globalThis & {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown;
    __xsantcastxAppCheck?: AppCheck;
  };

  if (!siteKey || siteKey.startsWith('REPLACE_WITH')) {
    console.warn('[AppCheck] Firebase App Check site key is not configured. Update environment.appCheck.siteKey before deploying.');
    settle?.(null);
    return;
  }

  if (debugToken) {
    globalScope.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'auto' ? true : debugToken;
  }

  try {
    // The global guard survives an SSR→client hydration double-init, which
    // would otherwise throw on the second initializeAppCheck() call.
    if (!globalScope.__xsantcastxAppCheck) {
      globalScope.__xsantcastxAppCheck = initializeAppCheck(getApp(), {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
    }
    instance = globalScope.__xsantcastxAppCheck;
  } catch (error) {
    // A failed App Check init must not take the page down with it — Firestore
    // degrades to token-less requests, which is exactly what happened before
    // App Check existed.
    console.warn('[AppCheck] initialization failed; continuing without a token', error);
    instance = null;
  }

  settle?.(instance);
}
