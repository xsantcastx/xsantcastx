/**
 * onboarding-outlet.component.ts — the seam the tutorial chunk arrives through.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE TUTORIAL IS NOT IN THE INITIAL BUNDLE
 * ─────────────────────────────────────────────────────────────────────────────
 * OnboardingComponent is the one component on this site with an inverted
 * audience: it is shown to a browser exactly once, ever, and every visit after
 * that — and every visit by anybody who has been here before — must never
 * render it. Shipping its markup, its stylesheet and its five screens inside
 * `main.js` would put it on the critical path of every page load in order to
 * serve a case that, by construction, almost never happens.
 *
 * That is not a theoretical saving. The initial bundle sits inside ~50 kB of
 * its 2 MB hard error budget, and a shell widget added to `AppModule.imports`
 * is eager by definition.
 *
 * This outlet is what stays eager, and it is a view container, a signal read
 * and an `import()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY `createComponent` AND NOT `@defer`
 * ─────────────────────────────────────────────────────────────────────────────
 * The same reason `inspect-3d-outlet.component.ts` gives, and it is worth
 * repeating because it is not obvious: the host here is AppComponent, which is
 * NgModule-declared. A deferrable view resolves its dependencies from the host's
 * own `imports`, and anything AppModule imports is eager. `@defer` in
 * app.component.html would produce a deferred *view* over an eager *chunk* —
 * all of the complexity and none of the saving. `ViewContainerRef.createComponent`
 * behind a dynamic import is the form that gives a real lazy chunk from an
 * NgModule host.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { OnboardingService } from './onboarding.service';

@Component({
  selector: 'app-onboarding-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-container #host></ng-container>',
})
export class OnboardingOutletComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly onboarding = inject(OnboardingService);

  @ViewChild('host', { read: ViewContainerRef, static: true })
  private host!: ViewContainerRef;

  private ref: { destroy(): void } | null = null;

  /**
   * Guards the gap between asking for the chunk and getting it.
   *
   * The window is small but it is real: a visitor who hits the skip while the
   * import is still in flight must not have the tutorial mount itself a moment
   * later on top of the page they have just been let into.
   */
  private token = 0;

  constructor() {
    effect(() => {
      const active = this.onboarding.active();
      const token = ++this.token;
      if (!this.isBrowser || !active) {
        this.tearDown();
        return;
      }
      void this.mount(token);
    });
  }

  ngOnDestroy(): void {
    this.tearDown();
  }

  private async mount(token: number): Promise<void> {
    this.tearDown();
    try {
      const { OnboardingComponent } = await import('./onboarding.component');
      // Raised again while we were fetching, or lowered. Either way this
      // instance is stale.
      if (token !== this.token) return;
      const ref = this.host.createComponent(OnboardingComponent);
      ref.changeDetectorRef.detectChanges();
      this.ref = ref;
    } catch {
      // A chunk that will not load must not leave a new visitor staring at a
      // blank shell with the scroll locked by a curtain that never arrived.
      // Ending the run drops them onto the real page, which is the same place
      // the tutorial would have delivered them to.
      this.onboarding.finish(this.onboarding.step());
    }
  }

  private tearDown(): void {
    this.ref?.destroy();
    this.ref = null;
    this.host?.clear();
  }
}
