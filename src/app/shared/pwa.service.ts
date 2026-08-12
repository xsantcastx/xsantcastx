import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

/**
 * The `beforeinstallprompt` event is Chromium-only and not in lib.dom, so it
 * needs declaring locally.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'godforge-install-dismissed';
/** How long a dismissal suppresses the banner. Long enough not to nag. */
const DISMISS_DAYS = 60;

/**
 * PwaService — service-worker registration and the install prompt.
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

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  /** True when the browser has offered an install prompt we are holding. */
  readonly canInstall = signal(false);
  /** True once a newer service worker is waiting to take over. */
  readonly updateReady = signal(false);

  init(): void {
    if (!this.isBrowser) return;

    this.listenForInstallPrompt();

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

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Chrome shows its own mini-infobar unless the event is cancelled. We
      // cancel it and hold the event so the banner can fire it on a real click —
      // prompt() is only honoured from a user gesture.
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      if (!this.recentlyDismissed() && !this.isStandalone()) {
        this.canInstall.set(true);
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      try { localStorage.removeItem(DISMISSED_KEY); } catch { /* storage disabled */ }
    });
  }

  /** Fires the held prompt. Must be called from a user gesture. */
  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const evt = this.deferredPrompt;
    if (!evt) return 'unavailable';

    // The event is single-use: clear it before awaiting so a double-click cannot
    // call prompt() twice on the same event (which throws).
    this.deferredPrompt = null;
    this.canInstall.set(false);

    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === 'dismissed') this.rememberDismissal();
      return outcome;
    } catch {
      return 'unavailable';
    }
  }

  /** User closed the banner without deciding — suppress it for a while. */
  dismiss(): void {
    this.canInstall.set(false);
    this.rememberDismissal();
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

  private isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
      // iOS Safari predates display-mode and uses a non-standard flag.
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  }

  private recentlyDismissed(): boolean {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (!raw) return false;
      const at = Number(raw);
      if (!Number.isFinite(at)) return false;
      return (Date.now() - at) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  private rememberDismissal(): void {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* storage disabled */ }
  }
}
