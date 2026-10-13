/* ░▒▓█ ECLIPSE REALMS — service worker █▓▒░
 *
 * Hand-written rather than @angular/service-worker, because adding that would
 * mean a new dependency and an ngsw-config.json build step. It does the things
 * that actually matter: the installed app opens with no network, and the site
 * stays installable.
 *
 * ─── THE ONE RULE ───────────────────────────────────────────────────────────
 * A service worker is the only thing on a static site that can break it
 * *permanently*. Once registered it keeps serving from cache even after the
 * bad version is deleted from the server, and users cannot fix it by reloading.
 * Every strategy below is therefore chosen to fail toward the network:
 *
 *   navigations  → network-first. A deploy is visible on the very next load;
 *                  the cache is touched only when the network actually fails.
 *                  This is the rule that makes a stale-HTML lockout impossible.
 *   hashed assets→ cache-first, safe *only* because the filename contains a
 *                  content hash, so a changed file is a different URL.
 *   assets/js/*  → network-first (stable filenames that do change), cache only
 *                  as the offline fallback.
 *   images       → stale-while-revalidate.
 *   everything   → passed straight through, never intercepted.
 *   else
 *
 * Nothing is ever cached unless its Content-Type matches what the URL claims
 * (isExpectedType) — see that function for the production bug it prevents.
 *
 * ─── OFFLINE LAUNCH ─────────────────────────────────────────────────────────
 * A navigation with no network is answered, in order, by:
 *   1. this exact page, if it was visited before (query string ignored);
 *   2. the app shell, /index.csr.html — the same file Hosting serves for every
 *      non-prerendered route, /play included — which boots the app at whatever
 *      URL was asked for. It is precached TOGETHER with the hashed scripts and
 *      stylesheets it references (refreshShell), and only stored once all of
 *      those are, so a cached shell can always at least boot;
 *   3. /offline.html, the static branded page;
 *   4. a few lines of inline HTML, if even that is missing.
 * Lazy route chunks are not precached here — their names are not knowable
 * without a build manifest. The app warms the game route's chunk and art into
 * the cache itself once it knows it is installed (app-chrome.component.ts).
 *
 * ─── UPDATES ────────────────────────────────────────────────────────────────
 * Network-first navigations only help a page that navigates; an installed app
 * or a long-open tab never does. So every deploy stamps BUILD_ID (below) and
 * /version.json (scripts/stamp-build-id.js), the page polls for both
 * (shared/pwa/app-update.service.ts), and a changed worker installs and then
 * WAITS — no skipWaiting on install — until the player taps Reload on the
 * "new version ready" toast. The page flushes saves, posts SKIP_WAITING, and
 * reloads once on controllerchange.
 *
 * If this ever does need to be killed remotely, deploy a service-worker.js
 * whose body is just:
 *     self.addEventListener('install', () => self.skipWaiting());
 *     self.addEventListener('activate', async () => {
 *       for (const k of await caches.keys()) await caches.delete(k);
 *       await self.registration.unregister();
 *     });
 * Firebase Hosting serves this file with `no-cache`, so the replacement
 * propagates on the next visit.
 */

'use strict';

// Bump on any change to the CACHING rules so old caches are dropped on
// activate. Not per deploy: the hashed bundles a still-open old tab may yet
// lazy-load live in these caches, and a deploy must not delete them under it.
const VERSION = 'godforge-sw-v3';

/**
 * Which deploy this worker belongs to. scripts/stamp-build-id.js replaces the
 * placeholder after every build, so the worker's bytes change with each deploy
 * and `registration.update()` actually finds something. Before this the file
 * was identical across deploys and the update path could never fire.
 * Answered to `{ type: 'GET_BUILD' }` on a MessageChannel port.
 */
const BUILD_ID = '__GF_BUILD_ID__';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/** The CSR app shell. Hosting's `**` rewrite target; see firebase.json. */
const APP_SHELL = '/index.csr.html';
const OFFLINE_PAGE = '/offline.html';

/**
 * Precached on install, each one individually so a single miss cannot fail the
 * install. Kept small (~0.5 MB with the shell's own bundles): fonts the game
 * UI uses, the icons, the offline page, and the Seamworks backdrop the game
 * opens on. Paths here are stable, hand-maintained filenames — never hashed
 * build output, which goes through refreshShell instead.
 */
const SHELL_URLS = [
  OFFLINE_PAGE,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/assets/brand/icon-192.png',
  '/assets/fonts/orbitron-latin-var.woff2',
  '/assets/fonts/inter-latin-var.woff2',
  '/assets/fonts/cormorant-garamond-latin-var.woff2',
  '/assets/fonts/cinzel-decorative-400-latin.woff2',
  '/assets/fonts/cinzel-decorative-700-latin.woff2',
  '/assets/images/bg-basalt-seamworks-1536.webp',
  '/assets/js/boot-recovery.js',
];

/** Hosts that must always hit the network: live data, auth, payments, metrics. */
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'apis.google.com',
  'js.stripe.com',
  'api.stripe.com',
  'www.paypal.com',
  'cdn.carbonads.com',
];

/** Content-hashed build output: main-A1B2C3D4.js, styles-XXXX.css, chunk-XXXX.js */
function isImmutableAsset(url) {
  return /-[A-Z0-9]{8,}\.(?:js|css)$/.test(url.pathname)
    || /\.(?:woff2|woff|ttf|otf)$/.test(url.pathname);
}

/** Static media that changes rarely and is fine served slightly stale. */
function isStaticMedia(url) {
  return /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/.test(url.pathname);
}

/** Hand-written scripts with stable names (boot-recovery, cosmic-engine, …). */
function isStableScript(url) {
  return /^\/assets\/js\/[^/]+\.js$/.test(url.pathname);
}

/** No extension: a page route, which Hosting answers with HTML. */
function isPagePath(url) {
  return !/\.[a-z0-9]+$/i.test(url.pathname) || /\.html$/.test(url.pathname);
}

/**
 * Does this response actually contain what the URL claims?
 *
 * Firebase Hosting answers unmatched *extensionless* paths with the SPA shell
 * (200, text/html). The `**` rewrite used to answer *every* path that way, so a
 * chunk deleted or renamed by a deploy did not fail, it came back as HTML.
 *
 * Without this check the worker would `put()` that HTML into ASSET_CACHE under
 * the .js URL, and the cache-first branch below would then serve HTML for that
 * script *forever* — surviving reloads, new deploys, and the file being restored
 * on the server, because cache-first never revalidates. That is precisely the
 * permanent, un-reloadable breakage this file's header calls the ONE RULE.
 * Verified against production at the time: GET /chunk-DEADBEEF.js -> 200,
 * text/html, response.type 'basic'.
 *
 * Anything we cannot positively identify is simply not cached. Skipping the
 * cache costs one network fetch; poisoning it costs the visitor the site.
 */
function isExpectedType(url, res) {
  const ct = (res.headers.get('Content-Type') || '').toLowerCase();
  // Pages are the one place HTML belongs.
  if (isPagePath(url)) return ct.includes('text/html');
  // The SPA shell masquerading as an asset — the case this exists for.
  if (ct.includes('text/html')) return false;
  if (/\.js$/.test(url.pathname)) return ct.includes('javascript') || ct.includes('ecmascript');
  if (/\.css$/.test(url.pathname)) return ct.includes('text/css');
  if (/\.(?:woff2|woff|ttf|otf)$/.test(url.pathname)) return ct.includes('font') || ct.includes('octet-stream');
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/.test(url.pathname)) return ct.startsWith('image/');
  if (/\.webmanifest$/.test(url.pathname)) return ct.includes('manifest') || ct.includes('json');
  return false;
}

/** Fetch one URL fresh and cache it only if it is what it says it is. */
async function precacheOne(cache, path) {
  const url = new URL(path, self.location.origin);
  const res = await fetch(url.href, { cache: 'reload', credentials: 'same-origin' });
  if (!res.ok || res.type !== 'basic' || !isExpectedType(url, res)) {
    throw new Error(`precache refused ${path}`);
  }
  await cache.put(url.href, res);
}

/**
 * Cache the app shell and every hashed script/stylesheet it references, and
 * store the shell itself only after all of those landed. A shell whose bundles
 * are missing would boot into the stale-build recovery path offline; a shell
 * that is simply absent falls through to the offline page, which is honest.
 */
async function refreshShell() {
  const res = await fetch(APP_SHELL, { cache: 'reload', credentials: 'same-origin' });
  const shellUrl = new URL(APP_SHELL, self.location.origin);
  if (!res.ok || res.type !== 'basic' || !isExpectedType(shellUrl, res)) return;
  const html = await res.text();

  const refs = new Set();
  for (const m of html.matchAll(/\s(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    let u;
    try { u = new URL(m[1], shellUrl); } catch { continue; }
    if (u.origin === self.location.origin && isImmutableAsset(u)) refs.add(u.href);
  }

  const assets = await caches.open(ASSET_CACHE);
  for (const href of refs) {
    if (await assets.match(href)) continue;
    await precacheOne(assets, href); // throws -> shell not stored
  }

  const shell = await caches.open(SHELL_CACHE);
  await shell.put(shellUrl.href, new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }));
}

/** At most one shell refresh in flight, and not more often than this. */
const SHELL_REFRESH_MS = 6 * 60 * 60 * 1000;
let lastShellRefresh = 0;
let shellRefreshing = null;

function maybeRefreshShell() {
  if (shellRefreshing || Date.now() - lastShellRefresh < SHELL_REFRESH_MS) return null;
  lastShellRefresh = Date.now();
  shellRefreshing = refreshShell().catch(() => {}).finally(() => { shellRefreshing = null; });
  return shellRefreshing;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll is atomic — one 404 rejects the whole install and leaves the old
      // worker in place. Cache individually so a single missing asset cannot
      // block the update.
      .then((cache) => Promise.all(
        SHELL_URLS.map((path) => precacheOne(cache, path).catch(() => {
          /* asset moved or renamed; not worth failing the install over */
        }))
      ))
      .then(() => maybeRefreshShell())
      // No skipWaiting here. An update now WAITS until the player accepts the
      // "new version ready" toast (AppUpdateService posts SKIP_WAITING and
      // reloads once on controllerchange), or until every tab has closed. Taking
      // over a page mid-play would swap the worker under a running old bundle.
      // A very first install has no active worker and activates regardless.
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const INLINE_OFFLINE = '<!doctype html><meta charset="utf-8"><title>Offline — Eclipse Realms</title>'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<body style="background:#0a0a0f;color:#e6e0ff;font:16px/1.6 system-ui;'
  + 'display:grid;place-items:center;height:100vh;margin:0;text-align:center">'
  + '<div><p>The realm is unreachable.</p>'
  + '<p style="opacity:.6;font-size:.9rem">Check your connection and try again.</p></div>';

async function offlineNavigation(req) {
  return (await caches.match(req, { ignoreSearch: true }))
    || (await caches.match(APP_SHELL))
    || (await caches.match(OFFLINE_PAGE))
    || new Response(INLINE_OFFLINE, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET is cacheable, and only same-origin is ours to reason about.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) return;

  // ── navigations: network-first ───────────────────────────────────────────
  // `mode === 'navigate'` covers link clicks, reloads and address-bar entry.
  if (req.mode === 'navigate') {
    // The reserved Firebase namespace (/__/auth/handler and friends) is never
    // ours to answer, online or off.
    if (url.pathname.startsWith('/__/')) return;
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only stash successful, same-origin HTML. A redirect arrives here as
          // an opaqueredirect and is passed through untouched.
          if (res && res.ok && res.type === 'basic' && isExpectedType(url, res)) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            // A good moment to bring the offline shell up to this deploy.
            const refresh = maybeRefreshShell();
            if (refresh) event.waitUntil(refresh);
          }
          return res;
        })
        .catch(() => offlineNavigation(req))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // ── hashed build output: cache-first ─────────────────────────────────────
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok && isExpectedType(url, res)) {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
    return;
  }

  // ── stable-name scripts: network-first, cache as the offline fallback ────
  if (isStableScript(url)) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok && isExpectedType(url, res)) {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || Response.error()))
    );
    return;
  }

  // ── images and icons: stale-while-revalidate ─────────────────────────────
  if (isStaticMedia(url)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req).then((res) => {
          if (res && res.ok && isExpectedType(url, res)) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => hit || Response.error());
        return hit || network;
      })
    );
    return;
  }

  // ── the manifest: network-first so a changed icon set is picked up ──────
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(fetch(req).catch(() => caches.match(req).then((hit) => hit || Response.error())));
  }

  // Everything else falls through to the network untouched.
});

/** Lets the page trigger an immediate takeover after an update is found. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  else if (event.data && event.data.type === 'GET_BUILD' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ build: BUILD_ID });
  }
});
