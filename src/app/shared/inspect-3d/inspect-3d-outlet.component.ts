/**
 * inspect-3d-outlet.component.ts — the seam the lazy chunk arrives through.
 *
 * This component is eager and costs almost nothing: a view container, a
 * subscription, and an `import()`. Everything expensive lives in the component
 * it builds, which is not fetched until an item is actually inspected in 3D.
 *
 * `ViewContainerRef.createComponent` rather than `@defer` because the host is
 * AppComponent, which is NgModule-declared: a deferrable view resolves its
 * dependencies from the host's own `imports`, and anything AppModule imports is
 * eager by definition. This is the form that gives a real lazy chunk from an
 * NgModule host.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { Inspect3dService } from './inspect-3d.service';

@Component({
  selector: 'app-inspect-3d-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-container #host></ng-container>',
})
export class Inspect3dOutletComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inspect3d = inject(Inspect3dService);

  @ViewChild('host', { read: ViewContainerRef, static: true })
  private host!: ViewContainerRef;

  private sub?: Subscription;
  private ref: { destroy(): void } | null = null;
  /**
   * Guards the gap between asking for the chunk and getting it. A visitor who
   * closes the inspector while the import is still in flight must not have it
   * open itself a moment later on top of nothing.
   */
  private openToken = 0;

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.sub = this.inspect3d.subject$.subscribe(place => {
      const token = ++this.openToken;
      if (!place) { this.tearDown(); return; }
      void this.mount(place, token);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.tearDown();
  }

  private async mount(place: unknown, token: number): Promise<void> {
    this.tearDown();
    try {
      const { Inspect3dComponent } = await import('./inspect-3d.component');
      if (token !== this.openToken) return;
      const ref = this.host.createComponent(Inspect3dComponent);
      ref.instance.place = place as never;
      ref.changeDetectorRef.detectChanges();
      this.ref = ref;
    } catch {
      // A chunk that will not load is not worth a dialog: Quick Inspect is
      // still open behind this and already shows the item.
      this.inspect3d.close();
    }
  }

  private tearDown(): void {
    this.ref?.destroy();
    this.ref = null;
    this.host?.clear();
  }
}
