import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { AnalyticsService } from '../analytics.service';
import {
  INSTALL_OFFER_KEY,
  LEGACY_DISMISSED_KEY,
  InstallOfferRecord,
  InstallOfferVerdict,
  InstallPlatform,
  coerceInstallOfferRecord,
  detectInstallPlatform,
  emptyInstallOfferRecord,
  installOfferVerdict,
  isStandaloneDisplay,
  withDismissal,
  withInstall,
  withSession,
} from './pwa/pwa.model';

/**
 * The `beforeinstallprompt` event is Chromium-only and not in lib.dom, so it
 * needs declaring locally.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Marks "this tab session has already been counted". sessionStorage survives
 * reloads and in-app navigation but not closing the tab, which is exactly the
 * unit "came back for a second session" means.
 */
const SESSION_MARK = 'godforge-pwa-session';

/**
 * PwaService — service-worker registration, the install offer's state, and the
 * facts about how the app is being run (installed window or tab, online or not).
 *
 * The rules themselves live in pwa/pwa.model.ts as pure functions; this class
 * only gathers the browser's answers and remembers the device-local record.
 *
 * Registration is deliberately *not* done in main.ts. A service worker
 * registered during the boot critical path competes with the first paint for
 * bandwidth on exactly the visit where the cache is empty and cannot help. It
 * is scheduled after load instead, when it costs nothing.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly analytics = inject(AnalyticsService);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly hasPromptEvent = signal(false);
  private readonly record = signal<InstallOfferRecord>(emptyInstallOfferRecord());
  private initialised = false;

  /** Running as the installed app (any app display mode, or iOS home screen). */
  readonly standalone = signal(false);
  /** How this browser installs. Recomputed when Chromium hands us its event. */
  readonly platform = signal<InstallPlatform>('none');
  /** navigator.onLine, kept live. `true` is optimistic; `false` is reliable. */
  readonly online = signal(true);
  /** True when the browser has offered an install prompt we are holding. */
  readonly canInstall = computed(() => this.hasPromptEvent() && !this.standalone());
  /** True once a newer service worker is waiting to take over. */
  readonly updateReady = signal(false);

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;

    this.loadRecord();
    this.readDisplayMode();
    this.platform.set(detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0, false));
    this.countSession();
    this.listenForInstallPrompt();
    this.listenForConnectivity();

    // Only register in production builds. A service worker under `ng serve`
    // caches the dev bundle and then serves it over the top of live rebuilds,
    // which reads as "my changes stopped applying" and costs an afternoon.
    if (!environment.production) return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const incoming = reg.installing;
            if (!incoming) return;
            incoming.addEventListener('statechange', () => {
              // `controller` is null on the very first install — that is a fresh
              // registration, not an update, and must not surface a prompt.
              if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
                this.updateReady.set(true);
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[GODFORGE] service worker registration failed', err);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }

  /**
   * The install-offer rule applied to what this service knows plus the three
   * facts only the caller has. See installOfferVerdict() for the order.
   */
  offerVerdict(facts: { consentSettled: boolean; dwellMs: number; hasCrafted: boolean }): InstallOfferVerdict {
    return installOfferVerdict({
      record: this.record(),
      now: Date.now(),
      platform: this.platform(),
      standalone: this.standalone(),
      ...facts,
    });
  }

  /** Fires the held prompt. Must be called from a user gesture. */
  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const evt = this.deferredPrompt;
    if (!evt) return 'unavailable';

    // The event is single-use: clear it before awaiting so a double-click cannot
    // call prompt() twice on the same event (which throws).
    this.deferredPrompt = null;
    this.hasPromptEvent.set(false);

    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      this.analytics.trackPwaInstall(outcome === 'accepted' ? 'accepted' : 'dismissed', 'prompt');
      if (outcome === 'dismissed') this.saveRecord(withDismissal(this.record(), Date.now()));
      return outcome;
    } catch {
      return 'unavailable';
    }
  }

  /** The offer was closed without deciding — start (or lengthen) the cooldown. */
  dismiss(): void {
    this.analytics.trackPwaInstall('dismissed', this.platform());
    this.saveRecord(withDismissal(this.record(), Date.now()));
  }

  /** The offer actually reached the screen. Counted once per page load by the caller. */
  noteOfferShown(): void {
    this.analytics.trackPwaInstall('shown', this.platform());
  }

  /** Applies a waiting update and reloads once it has taken control. */
  applyUpdate(): void {
    if (!this.isBrowser || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
        reg.waiting.postMessage('SKIP_WAITING');
      }
    });
  }

  // ─── internals ───────────────────────────────────────────────────────────

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Chrome shows its own mini-infobar unless the event is cancelled. We
      // cancel it and hold the event so the offer can fire it on a real click —
      // prompt() is only honoured from a user gesture. Whether the offer is
      // *shown* is the engagement rule's call, not this listener's.
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.hasPromptEvent.set(true);
      this.platform.set('prompt');
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.hasPromptEvent.set(false);
      this.saveRecord(withInstall(this.record(), Date.now()));
      this.analytics.trackPwaInstall('installed', this.platform());
    });
  }

  private readDisplayMode(): void {
    const read = () => {
      const standalone = isStandaloneDisplay(
        (q) => window.matchMedia(q).matches,
        (navigator as Navigator & { standalone?: boolean }).standalone,
      );
      this.standalone.set(standalone);
      // A class rather than only the media query, because iOS home-screen apps
      // signal through navigator.standalone, which CSS cannot see.
      document.documentElement.classList.toggle('gf-standalone', standalone);
    };
    read();
    // A desktop install can move between standalone and window-controls-overlay
    // while open (the title-bar toggle), and "Open in app" moves a tab out.
    for (const mode of ['standalone', 'window-controls-overlay']) {
      try {
        window.matchMedia(`(display-mode: ${mode})`).addEventListener('change', read);
      } catch { /* very old engines: the first read stands */ }
    }
  }

  private listenForConnectivity(): void {
    this.online.set(navigator.onLine !== false);
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  private countSession(): void {
    let fresh = false;
    try {
      if (sessionStorage.getItem(SESSION_MARK) === null) {
        sessionStorage.setItem(SESSION_MARK, '1');
        fresh = true;
      }
    } catch {
      // Storage blocked: every load would look like a new session, which would
      // satisfy the engagement rule on the second page view. Count nothing.
      return;
    }
    if (!fresh) return;
    this.saveRecord(withSession(this.record()));
    if (this.standalone()) this.analytics.trackPwaLaunch();
  }

  private loadRecord(): void {
    let raw: unknown = null;
    let legacy: string | null = null;
    try {
      const text = localStorage.getItem(INSTALL_OFFER_KEY);
      raw = text ? JSON.parse(text) : null;
      legacy = localStorage.getItem(LEGACY_DISMISSED_KEY);
    } catch { /* storage blocked or corrupt: start empty */ }
    this.record.set(coerceInstallOfferRecord(raw, legacy));
    if (legacy !== null) {
      // Folded into the new record above; the old key has nothing left to say.
      this.saveRecord(this.record());
      try { localStorage.removeItem(LEGACY_DISMISSED_KEY); } catch { /* ignore */ }
    }
  }

  private saveRecord(next: InstallOfferRecord): void {
    this.record.set(next);
    try { localStorage.setItem(INSTALL_OFFER_KEY, JSON.stringify(next)); } catch { /* storage disabled */ }
  }
}
