/**
 * offline-outlet.component.ts — the seam the summary chunk arrives through.
 *
 * The same shape, and the same reasoning, as the onboarding outlet: a screen
 * with an inverted audience should not be in the initial bundle. This one is
 * shown to a visitor who has been away five minutes or more *and* has something
 * to show for it, which is a minority of page loads and none at all of the
 * first one — and the initial bundle is inside its hard error budget.
 *
 * `createComponent` behind a dynamic `import()` rather than `@defer`, for the
 * reason inspect-3d and onboarding both give: the host is AppComponent, which is
 * NgModule-declared, and a deferrable view resolves its dependencies from the
 * host's own imports — all of which are eager. That would be a deferred *view*
 * over an eager *chunk*: all of the complexity, none of the saving.
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
import { OfflineService } from './offline.service';

@Component({
  selector: 'app-offline-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-container #host></ng-container>',
})
export class OfflineOutletComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly offline = inject(OfflineService);

  @ViewChild('host', { read: ViewContainerRef, static: true })
  private host!: ViewContainerRef;

  private ref: { destroy(): void } | null = null;

  /**
   * Guards the gap between asking for the chunk and getting it.
   *
   * Small but real: somebody who presses Escape while the import is in flight
   * must not have the summary mount itself a moment later on top of the page
   * they have just dismissed it from.
   */
  private token = 0;

  constructor() {
    effect(() => {
      const active = this.offline.active();
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
      const { OfflineSummaryComponent } = await import('./offline-summary.component');
      if (token !== this.token) return;
      const ref = this.host.createComponent(OfflineSummaryComponent);
      ref.changeDetectorRef.detectChanges();
      this.ref = ref;
    } catch {
      // A chunk that will not load costs the visitor a screen about rewards
      // they already have. It must not leave them staring at nothing, so the
      // flag is lowered and the page behind it is simply the page.
      this.offline.dismiss();
    }
  }

  private tearDown(): void {
    this.ref?.destroy();
    this.ref = null;
    this.host?.clear();
  }
}
