import { Injectable, ErrorHandler, PLATFORM_ID, inject, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Shape of a captured error, stable enough to ship to a backend later. */
export interface GodforgeError {
  kind: 'window.onerror' | 'unhandledrejection' | 'angular';
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
  url: string;
  userAgent: string;
  at: string;
}

/**
 * Errors that are noise, not signal. Each one is a thing the site already
 * handles deliberately and would otherwise drown the log:
 *
 *  - ResizeObserver loop …    benign browser notice, fires on any resize-driven
 *                             layout; Chrome itself calls it non-actionable.
 *  - Loading chunk … failed   a lazy route requested against a previous deploy's
 *                             filename. Expected on every deploy for anyone with
 *                             a tab already open; the reload recovers it.
 *  - permission-denied        Firestore rules rejecting an unauthenticated read.
 *                             VisitCounterService and ChangelogService both
 *                             silent-degrade on this by design.
 *  - Non-Error promise reject library code rejecting with a plain object; carries
 *                             no stack, so nothing to act on.
 */
const IGNORED = [
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /permission-denied|Missing or insufficient permissions/i,
  /Non-Error promise rejection captured/i,
];

/** Cap per page load so a render loop cannot spam thousands of identical lines. */
const MAX_PER_SESSION = 25;

/**
 * ErrorTrackingService — structured capture of uncaught browser errors.
 *
 * Deliberately console-only (option B). Everything is shaped and de-duplicated
 * here so that pointing `report()` at a Firestore `errors` collection, Sentry,
 * or an HTTP endpoint later is a one-method change rather than a refactor —
 * see the note on report() for what wiring a backend would require.
 */
@Injectable({ providedIn: 'root' })
export class ErrorTrackingService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private count = 0;
  /** Fingerprints already reported this page load. */
  private readonly seen = new Set<string>();
  private installed = false;

  install(): void {
    // Guard both the platform and double-installation: this is called from an
    // APP_INITIALIZER, and hot-reload or a second bootstrap would otherwise
    // chain handlers and double-report.
    if (!this.isBrowser || this.installed) return;
    this.installed = true;

    window.addEventListener('error', (event: ErrorEvent) => {
      // Resource load failures (<img>, <script>) also fire 'error' on window,
      // but as a plain Event with no `message`. They are network noise here.
      if (!event.message) return;
      this.capture({
        kind: 'window.onerror',
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      this.capture({
        kind: 'unhandledrejection',
        message: reason?.message ?? String(reason),
        stack: reason?.stack,
      });
    });
  }

  /** Entry point for Angular's ErrorHandler. */
  captureAngular(error: unknown): void {
    const err = error as { message?: string; stack?: string };
    this.capture({
      kind: 'angular',
      message: err?.message ?? String(error),
      stack: err?.stack,
    });
  }

  private capture(partial: Omit<GodforgeError, 'url' | 'userAgent' | 'at'>): void {
    if (!this.isBrowser) return;
    if (this.count >= MAX_PER_SESSION) return;

    const message = partial.message || '(no message)';
    if (IGNORED.some((re) => re.test(message))) return;

    // Fingerprint on message + first stack frame: the same fault thrown from a
    // rerender loop is one problem, not two hundred.
    const frame = (partial.stack ?? '').split('\n')[1]?.trim() ?? '';
    const fingerprint = `${partial.kind}|${message}|${frame}`;
    if (this.seen.has(fingerprint)) return;
    this.seen.add(fingerprint);
    this.count++;

    this.report({
      ...partial,
      message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      at: new Date().toISOString(),
    });
  }

  /**
   * Single sink for everything captured.
   *
   * To ship these somewhere, replace the body here. Two caveats that are easy
   * to get wrong and expensive to discover in production:
   *
   *  1. Whatever you POST to must be in `connect-src` in the firebase.json CSP,
   *     or the report is itself blocked — and a blocked report cannot report
   *     that it was blocked.
   *  2. Never let the sink throw. An error handler that errors re-enters this
   *     method and takes the page down with it. Wrap any network call in
   *     try/catch and swallow, or use navigator.sendBeacon, which cannot throw.
   */
  private report(error: GodforgeError): void {
    const label = error.kind === 'unhandledrejection'
      ? '[GODFORGE PROMISE REJECTION]'
      : '[GODFORGE ERROR]';
    console.error(label, error);
  }
}

/**
 * Routes Angular's own uncaught errors through the same pipeline, then
 * re-delegates to the default handler so the framework's console output and
 * dev-mode overlay are unchanged.
 */
@Injectable()
export class GodforgeErrorHandler implements ErrorHandler {
  private readonly tracker = inject(ErrorTrackingService);
  private readonly zone = inject(NgZone);

  handleError(error: unknown): void {
    // runOutsideAngular: reporting must not schedule change detection, or a
    // render error becomes an error → CD → error loop.
    this.zone.runOutsideAngular(() => {
      try {
        this.tracker.captureAngular(error);
      } catch {
        /* the tracker must never be the reason an error is lost */
      }
    });
    console.error(error);
  }
}
