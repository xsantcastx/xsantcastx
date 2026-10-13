/**
 * pwa-outlet.component.ts — the seam the installed-app UI arrives through.
 *
 * The install offer, the app chrome (offline pill, title-bar strip, game
 * route gesture class) and the "new version ready" toast are not needed for the first paint of anybody's visit:
 * the offer waits at least MIN_DWELL_MS by rule, and the pill only matters once
 * the network drops. The initial bundle sits at its hard error budget, so both
 * load as their own chunk once the browser is idle, the same way the onboarding
 * and offline-summary outlets do (see offline-outlet.component.ts for why this
 * is createComponent behind a dynamic import() rather than @defer).
 */
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type PwaOutletKind = 'offer' | 'chrome' | 'update';

@Component({
  selector: 'app-pwa-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-container #host></ng-container>',
})
export class PwaOutletComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @Input({ required: true }) kind!: PwaOutletKind;

  @ViewChild('host', { read: ViewContainerRef, static: true })
  private host!: ViewContainerRef;

  private ref: { destroy(): void } | null = null;
  private destroyed = false;
  private idleHandle: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const load = () => { void this.mount(); };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
    // A timeout on the idle callback, and a plain timer where there is none:
    // rAF-based scheduling would never fire in a background tab.
    if (w.requestIdleCallback) this.idleHandle = w.requestIdleCallback(load, { timeout: 4_000 });
    else this.timer = setTimeout(load, 1_500);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    // Never touch `window` before the platform check: this runs during prerender.
    if (this.isBrowser && this.idleHandle !== null) {
      (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(this.idleHandle);
    }
    this.ref?.destroy();
    this.ref = null;
  }

  private async mount(): Promise<void> {
    try {
      const component = this.kind === 'offer'
        ? (await import('./install-prompt.component')).InstallPromptComponent
        : this.kind === 'update'
          ? (await import('./update-toast.component')).UpdateToastComponent
          : (await import('./app-chrome.component')).PwaChromeComponent;
      // The host may have been torn down (route change into /play) while the
      // chunk was in flight; mounting now would attach to a dead view.
      if (this.destroyed) return;
      const ref = this.host.createComponent<object>(component);
      ref.changeDetectorRef.detectChanges();
      this.ref = ref;
    } catch {
      // Offline with the chunk uncached, most likely. Neither piece is worth an
      // error: the page is the page without them.
    }
  }
}
