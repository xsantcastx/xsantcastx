/* ░▒▓█ THE GODFORGE — service worker █▓▒░
 *
 * Hand-written rather than @angular/service-worker, because adding that would
 * mean a new dependency and an ngsw-config.json build step. This is ~120 lines
 * and does the two things that actually matter: the app shell survives going
 * offline, and the site becomes installable.
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
 *   everything   → passed straight through, never intercepted.
 *   else
 *
 * If this ever does need to be killed remotely, deploy a service-worker.js
 * whose body is just:
 *     self.addEventListener('install', () => self.skipWaiting());
 *     self.addEventListener('activate', async () => {
 *       for (const k of await caches.keys()) await caches.delete(k);
 *       await self.registration.unregister();
 *     });
 * Firebase Hosting serves this file with `no-cache` (it is extensionless-glob
 * exempt but matches nothing immutable), so the replacement propagates on the
 * next visit.
 */

'use strict';

// Bump on any change to this file so old caches are dropped on activate.
const VERSION = 'godforge-sw-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/**
 * Precached on install. Deliberately tiny — just enough to render something
 * branded when a visitor is offline. The hashed JS/CSS bundles are *not* listed
 * because their filenames change every build; they populate ASSET_CACHE lazily
 * on first fetch instead, which keeps install from failing on a stale list.
 */
const SHELL_URLS = [
  '/world',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/assets/brand/icon-192.png',
  '/assets/fonts/orbitron-latin-var.woff2',
  '/assets/fonts/inter-latin-var.woff2',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll is atomic — one 404 rejects the whole install and leaves the old
      // worker in place. Cache individually so a single missing asset cannot
      // block the update.
      .then((cache) => Promise.all(
        SHELL_URLS.map((url) => cache.add(url).catch(() => {
          /* asset moved or renamed; not worth failing the install over */
        }))
      ))
      .then(() => self.skipWaiting())
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

/** Content-hashed build output: main-A1B2C3D4.js, styles-XXXX.css, chunk-XXXX.js */
function isImmutableAsset(url) {
  return /-[A-Z0-9]{8,}\.(?:js|css)$/.test(url.pathname)
    || /\.(?:woff2|woff|ttf|otf)$/.test(url.pathname);
}

/** Static media that changes rarely and is fine served slightly stale. */
function isStaticMedia(url) {
  return /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/.test(url.pathname);
}

/**
 * Does this response actually contain what the URL claims?
 *
 * Firebase Hosting has no "404 for a missing static file": the `**` rewrite
 * answers *any* unmatched path with the SPA shell — 200 OK, text/html. So a
 * chunk deleted or renamed by a deploy does not fail, it comes back as HTML.
 *
 * Without this check the worker would `put()` that HTML into ASSET_CACHE under
 * the .js URL, and the cache-first branch below would then serve HTML for that
 * script *forever* — surviving reloads, new deploys, and the file being restored
 * on the server, because cache-first never revalidates. That is precisely the
 * permanent, un-reloadable breakage this file's header calls the ONE RULE, and
 * it is the only path that can still reach it. Verified against production:
 * GET /chunk-DEADBEEF.js -> 200, text/html, response.type 'basic'.
 *
 * Anything we cannot positively identify is simply not cached. Skipping the
 * cache costs one network fetch; poisoning it costs the visitor the site.
 */
function isExpectedType(url, res) {
  const ct = (res.headers.get('Content-Type') || '').toLowerCase();
  // The SPA shell masquerading as an asset — the case this exists for.
  if (ct.includes('text/html')) return false;
  if (/\.js$/.test(url.pathname)) return ct.includes('javascript') || ct.includes('ecmascript');
  if (/\.css$/.test(url.pathname)) return ct.includes('text/css');
  if (/\.(?:woff2|woff|ttf|otf)$/.test(url.pathname)) return ct.includes('font') || ct.includes('octet-stream');
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/.test(url.pathname)) return ct.startsWith('image/');
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET is cacheable, and only same-origin plus a couple of font/CDN hosts
  // are ours to reason about.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) return;

  // ── navigations: network-first ───────────────────────────────────────────
  // `mode === 'navigate'` covers link clicks, reloads and address-bar entry.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only stash successful, non-opaque responses.
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('/world'))
            .then((hit) => hit || new Response(
              '<!doctype html><meta charset="utf-8"><title>Offline — The Godforge</title>'
              + '<body style="background:#07040f;color:#e6e0ff;font:16px/1.6 system-ui;'
              + 'display:grid;place-items:center;height:100vh;margin:0;text-align:center">'
              + '<div><p style="font-size:2rem;margin:0 0 .5rem">✦</p>'
              + '<p>The forge is unreachable.</p>'
              + '<p style="opacity:.6;font-size:.9rem">Check your connection and try again.</p></div>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ))
        )
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
        }).catch(() => hit);
        return hit || network;
      })
    );
  }

  // Everything else falls through to the network untouched.
});

/** Lets the page trigger an immediate takeover after an update is found. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
