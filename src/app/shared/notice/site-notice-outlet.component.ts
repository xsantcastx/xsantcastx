/**
 * site-notice-outlet.component.ts — the seam the notice chunk arrives through.
 *
 * The same shape and the same reasoning as the onboarding and offline outlets.
 * A ban curtain and a broadcast banner are shown on a vanishing minority of page
 * loads — nobody is banned most days and nothing is being announced most weeks —
 * and the initial bundle is already over its warning budget. Mounting the
 * notice component eagerly cost 20 kB raw for markup that almost never paints.
 *
 * `createComponent` behind a dynamic `import()` rather than `@defer`, for the
 * reason the other two outlets give: the host is AppComponent, which is
 * NgModule-declared, and a deferrable view resolves its dependencies from the
 * host's own imports — all of which are eager. That would be a deferred *view*
 * over an eager *chunk*: all of the complexity and none of the saving.
 *
 * What stays eager is only what has to: this file, and `SiteNoticeService`,
 * which is what does the reading that decides whether there is anything to show.
 */
import {
  ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID,
  ViewChild, ViewContainerRef, inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import { CloudSaveService } from '../cloud-save/cloud-save.service';
import { SiteNoticeService } from './site-notice.service';

@Component({
  selector: 'app-site-notice-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-container #host></ng-container>',
})
export class SiteNoticeOutletComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly cloudSave = inject(CloudSaveService);
  private readonly notices = inject(SiteNoticeService);

  @ViewChild('host', { read: ViewContainerRef, static: true })
  private host!: ViewContainerRef;

  private ref: { destroy(): void } | null = null;
  private sub?: Subscription;

  /**
   * Guards the gap between asking for the chunk and getting it.
   *
   * A ban lifted — or a sign-out — while the import is in flight must not have
   * the curtain mount itself a moment later over a page it no longer applies to.
   */
  private token = 0;

  ngOnInit(): void {
    // Nothing on the server. A ban is per-session and the notice read is a
    // network call; both belong after hydration, and the prerendered HTML is
    // the page without them — which is what the first client render produces
    // too, so hydration matches.
    if (!this.isBrowser) return;

    this.sub = combineLatest([this.cloudSave.ban$, this.notices.notice$])
      .pipe(map(([ban, notice]) => !!ban || !!notice))
      .subscribe(needed => {
        const token = ++this.token;
        if (!needed) {
          this.tearDown();
          return;
        }
        void this.mount(token);
      });

    this.notices.start();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.tearDown();
  }

  private async mount(token: number): Promise<void> {
    // Already up: the streams re-emit when a notice is edited or a ban is
    // lifted and re-applied, and remounting would restart the curtain's
    // entrance over a person who is already reading it.
    if (this.ref) return;
    try {
      const { SiteNoticeComponent } = await import('./site-notice.component');
      if (token !== this.token) return;
      const ref = this.host.createComponent(SiteNoticeComponent);
      ref.changeDetectorRef.detectChanges();
      this.ref = ref;
    } catch {
      // A chunk that will not load costs a banned player their explanation and
      // everyone else an announcement. Neither is worth throwing over: the
      // enforcement lives in firestore.rules and holds regardless.
    }
  }

  private tearDown(): void {
    this.ref?.destroy();
    this.ref = null;
    this.host?.clear();
  }
}
