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

/**
 * A page running against a *previous* deploy's file names.
 *
 * Every one of these is the same underlying event: the HTML (or a cached chunk)
 * references a build output that the current release renamed. Because Firebase
 * Hosting answers any unmatched path with the SPA shell — 200 OK, text/html,
 * never a 404 — the request does not fail cleanly. The browser is handed HTML
 * where it expected a module and reports it however its parser happens to trip:
 *
 *  - "Importing binding name 'a' is not found"  a real module that imports from
 *                                               a *stale* sibling still in cache
 *  - "Loading chunk N failed" / dynamic import   the lazy-route form
 *  - "not a valid JavaScript MIME type" / "<"    the SPA shell parsed as a module
 *
 * The IGNORED list above deliberately silences the two familiar spellings on the
 * grounds that "the reload recovers it" — but nothing here ever reloaded, so the
 * visitor was left on a half-booted page with the error suppressed. This list
 * drives the recovery that comment always assumed existed.
 */
const STALE_DEPLOY = [
  /Importing binding name .* is not found/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /is not a valid JavaScript MIME type/i,
  /Unexpected token '<'/i,
];

/**
 * One-shot guard. Recovery ends in location.reload(), so without a marker that
 * survives exactly one navigation a genuinely broken build would reload forever.
 * sessionStorage is the right scope: per tab, cleared when the tab closes.
 */
const RECOVERY_KEY = 'godforge-stale-deploy-recovery';

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

    // Before the noise filter: a stale-deploy error is the one class of fault
    // the page can actually fix, and two of its spellings are in IGNORED.
    if (STALE_DEPLOY.some((re) => re.test(message))) {
      this.recoverFromStaleDeploy(message);
      return;
    }

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
   * Purge every client-side copy of the old build and reload once.
   *
   * A plain location.reload() is not enough. The service worker serves hashed
   * assets cache-first and never revalidates, so a poisoned or stale entry
   * outlives any number of reloads — the caches have to be dropped explicitly
   * and the worker unregistered, or the next load is served the same bad bytes.
   *
   * Everything is best-effort and individually guarded: this runs while the app
   * is already in a bad state, and a failure to clean up must still end in the
   * reload, which is what actually gets the visitor a working page.
   */
  private recoverFromStaleDeploy(message: string): void {
    let alreadyTried = false;
    try {
      alreadyTried = sessionStorage.getItem(RECOVERY_KEY) !== null;
      sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    } catch {
      // Storage disabled (private mode, blocked cookies). Without a marker a
      // reload could loop, so report and leave the page alone.
      alreadyTried = true;
    }

    if (alreadyTried) {
      // The purge already happened and the error came back: this is a genuine
      // build fault, not a stale cache. Report it instead of reloading again.
      this.report({
        kind: 'angular',
        message: `[unrecovered after cache purge] ${message}`,
        url: window.location.href,
        userAgent: navigator.userAgent,
        at: new Date().toISOString(),
      });
      return;
    }

    console.warn('[GODFORGE] stale build detected — purging caches and reloading once.', message);

    // Never let a hung purge strand the visitor on a broken page: whichever
    // settles first wins, and the reload happens either way.
    //
    // Raised from 2s when the purge grew a network step. The budget is not about
    // patience, it is about correctness: the one-shot marker is already set, so
    // reloading *before* the refetch lands spends the single retry on a cache
    // that has not been repaired yet, and the visitor is then written off as
    // '[unrecovered after cache purge]' with no attempt left. The refetch is a
    // dozen already-hashed files over one warm connection and finishes well
    // inside this on any real network; the ceiling exists for the case where it
    // does not.
    const deadline = new Promise((resolve) => setTimeout(resolve, 5000));
    Promise.race([this.purgeClientCaches(), deadline]).then(() => this.reloadPage());
  }

  /**
   * Drops every client-side copy of the old build. There are *three* of them,
   * and the first version of this method only knew about two.
   *
   *  1. Cache Storage — what the service worker serves cache-first.
   *  2. The worker registration itself.
   *  3. The browser's own HTTP cache. This one is not scriptable: `caches.delete`
   *     does not touch it, `unregister()` does not touch it, and neither does
   *     `location.reload()`.
   *
   * (3) is why this method existed and still did not work. Firebase Hosting has
   * no 404 for a missing static file — the `**` rewrite answers *any* unmatched
   * path with the SPA shell, 200 OK, text/html. Our own header block then stamps
   * that reply, because it matches `**\/*.js`, with:
   *
   *     Cache-Control: public, max-age=31536000, immutable
   *
   * So one request for a since-renamed chunk writes a year-long, explicitly
   * *non-revalidating* entry into the browser's HTTP cache with HTML sitting
   * under a .js address. `immutable` is a promise not to ask again, and Safari
   * keeps that promise literally: it will not revalidate on a reload, on a hard
   * reload, or after the caches above are emptied. Chrome does revalidate an
   * `immutable` subresource on an explicit reload, which is the entire reason
   * this reproduces on Safari and not on Chrome.
   *
   * The only way back is to fetch the address again with `cache: 'reload'`,
   * which bypasses the HTTP cache *and* overwrites the entry with the response
   * it gets. Verified in WebKit against a server reproducing the header exactly:
   * purge + reload leaves the page dead, purge + refetch + reload boots it.
   *
   * Which addresses to repair is answered by resource timing rather than by the
   * document, because the chunk that fails is usually a lazily imported one that
   * appears in no tag. `getEntriesByType('resource')` lists every module the
   * page actually requested this load, dynamic imports included.
   *
   * All of it is best-effort and individually guarded: this runs while the app
   * is already broken, and a failure to clean up must still end in the reload.
   *
   * Split out from recoverFromStaleDeploy so a test can stand in for it without
   * needing a real CacheStorage, a registered worker, or a network.
   */
  private purgeClientCaches(): Promise<unknown> {
    return Promise.all([
      'caches' in window
        ? caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .catch(() => undefined)
        : Promise.resolve(),
      'serviceWorker' in navigator
        ? navigator.serviceWorker.getRegistrations()
            .then((regs) => Promise.all(regs.map((r) => r.unregister())))
            .catch(() => undefined)
        : Promise.resolve(),
      this.repairHttpCache(),
    ]);
  }

  /**
   * Re-fetch every same-origin script and stylesheet this page load touched,
   * bypassing the HTTP cache, so a poisoned `immutable` entry is overwritten
   * with what the server actually serves now.
   *
   * Ordering matters on the way out: the caller reloads once this settles, and
   * the reload is what picks the repaired copies up.
   */
  private repairHttpCache(): Promise<unknown> {
    let urls: string[];
    try {
      urls = this.staleBuildUrls();
    } catch {
      return Promise.resolve();
    }

    return Promise.all(urls.map((u) =>
      // `reload` is the mode that skips the cache on the way in and writes on
      // the way out; `no-store` would skip it in both directions and leave the
      // poisoned entry exactly where it is.
      fetch(u, { cache: 'reload', credentials: 'same-origin' }).catch(() => undefined)
    ));
  }

  /**
   * Every same-origin .js/.css address this load requested or declared.
   *
   * Resource timing covers what was actually fetched — including the dynamic
   * imports that carry the lazy routes and that no element references. The
   * document is read as well because an entry that failed early enough may not
   * have produced a timing entry at all.
   */
  private staleBuildUrls(): string[] {
    const out = new Set<string>();
    const keep = (raw: string | null | undefined) => {
      if (!raw) return;
      let u: URL;
      try { u = new URL(raw, window.location.href); } catch { return; }
      if (u.origin !== window.location.origin) return;
      if (!/\.(?:js|css)$/.test(u.pathname)) return;
      out.add(u.href);
    };

    if (typeof performance?.getEntriesByType === 'function') {
      for (const e of performance.getEntriesByType('resource')) keep(e.name);
    }

    document
      .querySelectorAll<HTMLElement>('script[src], link[rel="modulepreload"][href], link[rel="stylesheet"][href]')
      .forEach((el) => keep(el.getAttribute('src') ?? el.getAttribute('href')));

    return [...out];
  }

  /**
   * The reload, as its own seam. `location.reload` is non-configurable in
   * Chrome, so a spec cannot spy on it directly — it spies on this instead.
   */
  private reloadPage(): void {
    window.location.reload();
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
