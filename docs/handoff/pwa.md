# Handoff: installable app (PWA)

- **Manifest** (`src/manifest.webmanifest`): Eclipse Realms, `id: /eclipse-realms`, `start_url: /play`, standalone + window-controls-overlay, orientation any, theme/background `#0a0a0f`, 7 `any` + 2 maskable icons, 4 shortcuts (Play, Character, Forge → /forge/runes, Sanctum). **No screenshots yet**: add real narrow/wide captures of /play later.
- **start_url /play**: the town is the main entry; it is CSR-only, so offline it boots from the precached `/index.csr.html` shell.
- **iOS**: apple meta tags, status bar `black` (/play doesn't pad safe-area-top), 15 portrait startup images in `assets/brand/splash/`.
- **Install offer** (`shared/pwa/pwa.model.ts`, rule + spec): second session OR first craft, 25 s dwell, cookie banner answered, not standalone; dismiss cooldown 14 → 30 → 90 days, then never. iOS gets Share → Add to Home Screen. Never on /play. Device-local key `godforge-install-offer` (not game state). Analytics: `pwa_install`, `pwa_launch`.
- **App chrome** (`app-chrome.component.ts`): offline pill (pointer-events none; the gateway's own `online` listener does the sync), WCO title-bar strip, `html.gf-play-route` (no overscroll, canvas touch-action none), warms /play chunk + art in standalone. Both pieces load lazily via `pwa-outlet.component.ts` (initial bundle is at its hard budget).
- **Service worker v3**: precaches the shell plus its hashed bundles atomically, along with fonts, the Seamworks bg and `/offline.html`. Offline navigation order: cached page → shell → offline.html. `isExpectedType` now also guards pages.
- **Stale-build recovery** (error-tracking + boot-recovery): it no longer purges caches while offline. It probes with a HEAD to /robots.txt, because `navigator.onLine` lied under test.
- Local builds use `environment.ts` (`production: false`), so the SW never registers locally. To test, register it by hand.

## Human checks
- Android Chrome: install appears after the second session, installs, launches /play, shortcuts work, airplane-mode relaunch.
- iOS Safari: instructions card, Add to Home Screen, splash, status bar, offline relaunch.
- Desktop Chrome: install, title-bar overlay toggle (nav not under the controls, window draggable).
- Offline pill shows and sync resumes on reconnect when signed in.
