/* ░▒▓█ THE GODFORGE — boot recovery █▓▒░
 *
 * The last line of defence against a visitor holding a broken copy of the build.
 *
 * ─── WHY THIS IS NOT IN THE ANGULAR APP ─────────────────────────────────────
 * ErrorTrackingService already recovers from a stale deploy, and does it well:
 * it clears Cache Storage, unregisters the worker, refetches the build over the
 * HTTP cache and reloads once. But it is a service inside main.js, installed by
 * an APP_INITIALIZER. If the failure is main.js's own module graph failing to
 * link — which is the whole class of fault it exists for — then Angular never
 * boots, the initializer never runs, and the handler that would have fixed the
 * page is sitting inside the bundle that could not load.
 *
 * Verified in WebKit against the real build with one chunk renamed: the page
 * stops at the prerendered HTML, the SyntaxError goes to window.onerror, and
 * nothing in the app is alive to hear it. The visitor sees a page that looks
 * finished and answers no clicks.
 *
 * So this is a plain classic script, not a module. That is the entire point: a
 * classic script has no import graph to fail, and runs whatever state the module
 * scripts are in. It is loaded from <head> with `defer`, which puts it ahead of
 * the deferred module scripts in document order — the listener is installed
 * before anything can throw at it.
 *
 * ─── WHAT POISONS A CLIENT IN THE FIRST PLACE ───────────────────────────────
 * Firebase Hosting used to answer a request for a missing hashed asset with the
 * SPA shell — 200 OK, text/html — and the header block for `**\/*.js` then
 * stamped that reply `Cache-Control: public, max-age=31536000, immutable`. One
 * such request writes HTML under a .js address into the *browser's own* HTTP
 * cache for a year, with an explicit instruction never to revalidate. Safari
 * honours that literally, including across reloads; Chrome revalidates on an
 * explicit reload, which is why this only ever reproduced on Safari.
 *
 * Both halves are fixed in firebase.json — the fallback no longer answers for
 * paths naming a file, and nothing is marked `immutable` any more. But neither
 * change reaches a browser that already holds a poisoned entry: it will not ask
 * the server again, so it never learns the answer changed. Only a fetch with
 * `cache: 'reload'` gets past it, and that is what this file exists to do.
 *
 * Keep it small, keep it dependency-free, and keep every branch inside a
 * try/catch: this runs only when the site is already broken, and the one thing
 * worse than a dead page is a dead page in a reload loop.
 */
(function () {
  'use strict';

  /* Shared with ErrorTrackingService on purpose. Whichever of the two gets there
     first spends the tab's single retry; the other then stands down rather than
     reloading on top of it. */
  var RECOVERY_KEY = 'godforge-stale-deploy-recovery';

  /* The spellings a stale or poisoned build takes across engines. Kept in step
     with STALE_DEPLOY in error-tracking.service.ts. */
  var STALE = [
    /Importing binding name .* is not found/i,
    /Loading chunk \d+ failed/i,
    /Failed to fetch dynamically imported module/i,
    /error loading dynamically imported module/i,
    /is not a valid JavaScript MIME type/i,
    /Unexpected token '</i,
  ];

  function isStale(message) {
    if (!message) return false;
    for (var i = 0; i < STALE.length; i++) if (STALE[i].test(message)) return true;
    return false;
  }

  /* Every same-origin script and stylesheet this load asked for or declared.
     Resource timing is the half that matters — the chunk that fails is usually
     one no tag references, pulled in by a dynamic import. */
  function buildUrls() {
    var out = {};
    var keep = function (raw) {
      if (!raw) return;
      var u;
      try { u = new URL(raw, location.href); } catch (e) { return; }
      if (u.origin !== location.origin) return;
      if (!/\.(js|css)$/.test(u.pathname)) return;
      out[u.href] = true;
    };

    try {
      var entries = performance.getEntriesByType('resource');
      for (var i = 0; i < entries.length; i++) keep(entries[i].name);
    } catch (e) { /* no resource timing; the document below still gives us the shell */ }

    try {
      var els = document.querySelectorAll(
        'script[src], link[rel="modulepreload"][href], link[rel="stylesheet"][href]'
      );
      for (var j = 0; j < els.length; j++) {
        keep(els[j].getAttribute('src') || els[j].getAttribute('href'));
      }
    } catch (e) { /* nothing else to add */ }

    return Object.keys(out);
  }

  function purge() {
    var jobs = [];

    try {
      if (window.caches) {
        jobs.push(caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }));
      }
    } catch (e) { /* best effort */ }

    try {
      if (navigator.serviceWorker) {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        }));
      }
    } catch (e) { /* best effort */ }

    /* The one that actually clears the poison. `reload` skips the HTTP cache on
       the way in and overwrites the entry on the way out; `no-store` would skip
       it in both directions and leave the bad copy exactly where it was. */
    try {
      var urls = buildUrls();
      for (var i = 0; i < urls.length; i++) {
        jobs.push(fetch(urls[i], { cache: 'reload', credentials: 'same-origin' }));
      }
    } catch (e) { /* best effort */ }

    return Promise.all(jobs.map(function (p) {
      return Promise.resolve(p)['catch'](function () { return null; });
    }));
  }

  var handled = false;

  /* `certain` is for the branch that identifies the fault by *what failed*
     rather than by how it was worded — a messageless link error on our own
     entry script. There is no text to match there, and inventing one just to
     satisfy the matcher would put a sentence in the log that no engine said. */
  function recover(message, certain) {
    if (handled || (!certain && !isStale(message))) return;
    handled = true;

    var alreadyTried;
    try {
      alreadyTried = sessionStorage.getItem(RECOVERY_KEY) !== null;
      sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    } catch (e) {
      /* Storage blocked. Without a marker to stop at, a reload could loop
         forever, so the page is left as it is — broken, but not thrashing. */
      alreadyTried = true;
    }

    if (alreadyTried) {
      console.error('[GODFORGE] stale build survived the purge — not reloading again.', message);
      return;
    }

    console.warn('[GODFORGE] stale build detected before boot — repairing and reloading once.', message);

    /* The reload happens either way: a hung purge must not strand the visitor
       on a dead page. Long enough for a dozen small files on one warm
       connection, because reloading early spends the tab's only retry on a
       cache that has not been repaired yet. */
    var fired = false;
    var go = function () {
      if (fired) return;
      fired = true;
      location.reload();
    };
    setTimeout(go, 5000);
    purge().then(go, go);
  }

  /* Is this the page's own build failing, rather than some third party's?
     Same-origin only, and only the file types the build emits — an ad script or
     an analytics beacon failing is not our problem and must never reload anyone. */
  function isOwnBuildAsset(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    if (tag !== 'SCRIPT' && tag !== 'LINK') return false;
    var raw = el.getAttribute ? (el.getAttribute('src') || el.getAttribute('href')) : null;
    if (!raw) return false;
    var u;
    try { u = new URL(raw, location.href); } catch (e) { return false; }
    return u.origin === location.origin && /\.(js|css)$/.test(u.pathname);
  }

  /* Capture phase, so this is reached before anything that stops propagation.
     There are two shapes to catch here and the first draft of this file only
     caught one of them.

     An ErrorEvent carrying `message` is the uncaught-exception form — what a
     failing *dynamic* import throws, and what Chrome reports for most of this
     family. That one is matched against the spellings above.

     But a module graph that fails to *link* does not arrive that way. WebKit
     fires a bare Event, with no message and no filename, whose target is the
     entry <script type="module"> element — the descriptive SyntaxError goes to
     the console and nowhere a listener can read it. Verified against the real
     build with one chunk renamed: exactly one event, message null, target
     `<script type="module" src="main-VSVKZJ4M.js">`. Skipping messageless
     events as network noise is why this file did nothing on its first attempt.

     So the target is the signal in that case, and it is a specific one: the
     page's own, same-origin, .js/.css build output failed to load. Nothing a
     third party does can reach this branch. */
  window.addEventListener('error', function (event) {
    if (!event) return;

    if (event.message) { recover(event.message); return; }

    /* Offline is not a stale build, and reloading a disconnected visitor only
       costs them the page they still had. The service worker serves the shell
       in that case; leave it to do its job. */
    if (navigator.onLine === false) return;

    if (isOwnBuildAsset(event.target)) {
      var src = event.target.getAttribute('src') || event.target.getAttribute('href');
      recover('module graph failed to link: ' + src, true);
    }
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    recover(reason && reason.message ? reason.message : String(reason));
  });
})();
