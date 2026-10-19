/**
 * app-chrome.component.ts — what changes when Eclipse Realms runs as an app.
 *
 * Four small jobs, all of them about the window the game is in rather than the
 * game itself, kept in one host so app.component.html gains one tag:
 *
 *   1. The connection pill. "Offline — progress will sync" while the network is
 *      gone, a short "Back online" when it returns. Informational only:
 *      `pointer-events: none`, so it can never take a tap from the game or from
 *      any of the fixed corner widgets. Sync itself is NOT triggered here — the
 *      save gateway already listens for `online` and pushes its queue, and a
 *      second trigger would be a second sync path.
 *
 *   2. The desktop title-bar strip. With `window-controls-overlay` the app's
 *      own content runs up under the minimise/close buttons; this draws a
 *      draggable strip there (so the window can still be moved) and the global
 *      stylesheet pushes the nav and main content below it.
 *
 *   3. The game route's gesture rules. `html.gf-play-route` turns off
 *      pull-to-refresh and overscroll bounce while the canvas is up. A class on
 *      <html> rather than CSS in the play component, which this layer does not
 *      own.
 *
 *   4. Offline resilience for lazy routes. In the installed app, the game
 *      route's code and art are warmed into the service worker's cache once per
 *      session, so the app can open straight into the game with no network. And
 *      a route whose chunk was never cached fails to load offline: rather than a
 *      blank page, the visitor is sent to the static offline shell.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { PwaService } from '../pwa.service';
import { TranslationService } from '../../translation.service';
import { GameStateGateway } from '../save/game-state.gateway';

/** How long "Back online" stays up. */
const BACK_ONLINE_MS = 4_000;
/** Once per tab session is plenty: the worker keeps what it fetched. */
const WARM_MARK = 'godforge-pwa-warmed';
/**
 * The art the Seamworks opens with. Ids, not paths: they resolve through
 * artFor(), so a re-import that renames the files cannot leave this list
 * pointing at nothing. An id that stops existing is skipped silently.
 */
const GAME_ART_IDS = ['keeper-base', 'rivet-maw', 'basalt-edge', 'cinder-ore'];
const GAME_BACKGROUND = 'assets/images/bg-basalt-seamworks-1536.webp';

@Component({
  selector: 'app-pwa-chrome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gf-titlebar" aria-hidden="true"><span class="gf-titlebar__name">Eclipse Realms</span></div>
    @if (message(); as text) {
      <p class="gf-net" [class.gf-net--back]="online()" role="status" aria-live="polite">
        <span class="gf-net__dot" aria-hidden="true"></span>{{ text }}
      </p>
    }
  `,
  styles: [`
    :host { display: contents; }

    /* ── Title-bar strip: only exists in a desktop window-controls-overlay. ── */
    .gf-titlebar { display: none; }
    @media (display-mode: window-controls-overlay) {
      .gf-titlebar {
        display: flex;
        align-items: center;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: env(titlebar-area-height, 0px);
        padding-left: calc(env(titlebar-area-x, 0px) + 12px);
        z-index: var(--z-header);
        background: var(--surface-page);
        border-bottom: 1px solid var(--violet-ink);
        -webkit-app-region: drag;
        app-region: drag;
        user-select: none;
      }
      .gf-titlebar__name {
        font-family: var(--font-game);
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        color: var(--ink-2);
      }
    }

    /* ── Connection pill ─────────────────────────────────────────────────── */
    .gf-net {
      position: fixed;
      top: calc(var(--gf-titlebar-h, 0px) + var(--nav-h, 0px) + env(safe-area-inset-top, 0px) + 10px);
      left: 50%;
      transform: translateX(-50%);
      z-index: var(--z-toast);
      /* Never a click target: it says something, it does not do anything. */
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      max-width: calc(100vw - 32px);
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      font-size: 0.74rem;
      line-height: 1.3;
      color: var(--ink-0);
      background: var(--surface-overlay);
      border: 1px solid var(--violet-glow-soft);
      box-shadow: 0 6px 24px -10px rgba(0, 0, 0, 0.8);
      animation: gfNetIn 0.3s ease-out both;
    }
    .gf-net__dot {
      flex: 0 0 auto;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ink-3);
    }
    .gf-net--back .gf-net__dot { background: var(--violet-bright); }

    @media (min-width: 961px) {
      /* Desktop: the nav is a left rail, so centre in the content column. */
      .gf-net { left: calc(50% + var(--shell-sidebar-w, 0px) / 2); }
    }

    @keyframes gfNetIn {
      from { opacity: 0; transform: translate(-50%, -6px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .gf-net { animation: none; }
    }
  `],
})
export class PwaChromeComponent implements OnInit {
  private readonly pwa = inject(PwaService);
  private readonly i18n = inject(TranslationService);
  private readonly gateway = inject(GameStateGateway);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly lang = toSignal(this.i18n.currentLanguage$, { initialValue: this.i18n.getCurrentLanguage() });
  private readonly link = toSignal(this.gateway.link$, { initialValue: 'local' as const });

  readonly online = this.pwa.online;
  /** Set for a few seconds after the connection comes back. */
  private readonly justReconnected = signal(false);

  readonly message = computed<string | null>(() => {
    this.lang();
    const signedIn = this.link() !== 'local';
    if (!this.online()) {
      return this.i18n.translate(signedIn ? 'netstatus.offlineSync' : 'netstatus.offlineLocal');
    }
    if (this.justReconnected()) {
      return this.i18n.translate(signedIn ? 'netstatus.backSyncing' : 'netstatus.back');
    }
    return null;
  });

  constructor() {
    let wasOnline = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      const now = this.online();
      if (now && !wasOnline) {
        this.justReconnected.set(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => this.justReconnected.set(false), BACK_ONLINE_MS);
      }
      if (!now) this.justReconnected.set(false);
      wasOnline = now;
    });
    this.destroyRef.onDestroy(() => { if (timer) clearTimeout(timer); });

    // Warm the game route as soon as we know we are the installed app — at
    // start, or the moment an install completes in this tab.
    effect(() => {
      if (this.pwa.standalone()) this.scheduleWarmUp();
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const html = document.documentElement;
    const mark = (url: string) => {
      const path = url.split(/[?#]/)[0];
      html.classList.toggle('gf-play-route', path === '/play' || path.startsWith('/play/'));
    };
    // The first navigation can finish before this view exists (blocking initial
    // navigation), so read where we already are as well as where we go next.
    mark(this.router.url);
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        mark(e.urlAfterRedirects);
      } else if (e instanceof NavigationError && navigator.onLine === false) {
        // The route's chunk is not in the cache and there is no network to get
        // it from. The static offline shell at least explains that and offers
        // the way back in; an empty <main> explains nothing.
        location.assign('/offline.html');
      }
    });
    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      html.classList.remove('gf-play-route');
    });
  }

  private warmScheduled = false;

  private scheduleWarmUp(): void {
    if (!this.isBrowser || this.warmScheduled) return;
    this.warmScheduled = true;
    try {
      if (sessionStorage.getItem(WARM_MARK)) return;
    } catch { /* storage blocked: warming twice is harmless */ }
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;

    const run = () => { void this.warmUp(); };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    // A timeout fallback rather than requestAnimationFrame: rAF never fires in a
    // background tab, and an app that was opened and then hidden still wants it.
    if (idle) idle(run, { timeout: 10_000 }); else setTimeout(run, 4_000);
  }

  /**
   * Fetches the game route's code and opening art through the service worker,
   * which caches them (code cache-first, art stale-while-revalidate). Every
   * step is best-effort: a failure here costs an offline launch, never the
   * online one.
   */
  private async warmUp(): Promise<void> {
    if (navigator.onLine === false) return;
    try { sessionStorage.setItem(WARM_MARK, '1'); } catch { /* fine */ }

    const play = this.router.config.find(r => r.path === 'play');
    try { await play?.loadComponent?.(); } catch { /* offline mid-warm; next session */ }

    const urls = [GAME_BACKGROUND];
    try {
      const { artFor } = await import('../art/art');
      for (const id of GAME_ART_IDS) {
        const src = artFor(id)?.src;
        if (src) urls.push(src);
      }
    } catch { /* art table unavailable; the background is still worth having */ }

    await Promise.all(urls.map(u =>
      fetch(u, { credentials: 'same-origin' }).catch(() => null),
    ));
  }
}
