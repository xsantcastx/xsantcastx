/**
 * forge-scene.component.ts — the canvas the WebGL forge burns on.
 *
 * A thin host: it owns the element, the route subscription and the visitor's
 * Reduce Effects choice, and hands everything else to ForgeSceneService. All
 * the reasoning about z-index, blending and why nothing moves on the CPU lives
 * there; this file only has to get a canvas in front of it.
 *
 * Mounted in AppComponent as a sibling of <main>, in the same band as the CSS
 * `.particle-layer` it stands in front of — and for the same reason the flame
 * and the quest drawer are siblings rather than children: every routed host
 * carries a `routeFadeIn` transform, which makes it a containing block, and a
 * `position: fixed` full-viewport canvas inside one would be pinned to the page
 * instead of the viewport and would scroll away.
 *
 * Nothing renders on the server. That is not a limitation to work around — the
 * CSS background is already prerendered underneath, so a visitor with no WebGL,
 * with Reduce Effects on, or reading the prerendered HTML before hydration sees
 * the site exactly as it looked before this component existed.
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { EmbedService } from '../embed.service';
import { ForgeEffectsService } from './forge-effects.service';
import { ForgeSceneService } from './forge-scene.service';
import { paletteForPath } from './forge-scene.model';

@Component({
  selector: 'app-forge-scene',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show) {
      <canvas #canvas class="forge-scene" aria-hidden="true"></canvas>
    }
  `,
  styles: [`
    /* z-index 0, not -1.

       A negative-z-index layer does not paint on this site. "body" is
       positioned with "z-index: auto", so it opens no stacking context and
       every negative-z-index descendant escapes into html's context and paints
       before body's own fully opaque gradient covers it — which is why
       .matrix-background, body::before and body::after are all already dead
       paint. ".cosmic-canvas" sits at 0 and is visible; so does this.

       "screen" is the right blend for an additive scene: black is its identity,
       so every pixel the forge does not light is left exactly as it was. */
    .forge-scene {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
      z-index: 0;
      mix-blend-mode: screen;
    }
  `],
})
export class ForgeSceneComponent implements AfterViewInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly embed = inject(EmbedService);
  private readonly effects = inject(ForgeEffectsService);
  private readonly scene = inject(ForgeSceneService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly subs = new Subscription();

  /**
   * Whether the canvas element exists at all.
   *
   * Read once, at construction, rather than through the observable: the
   * capability probe and the stored preference cannot change between now and
   * the first frame, and a template that could pull the canvas out from under a
   * live GL context is a leak waiting to happen. The toggle handles the live
   * case explicitly below.
   */
  show = this.effects.shouldRender({ embed: this.embed.isEmbed });

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.attach();

    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(e => this.scene.setPalette(paletteForPath(e.urlAfterRedirects))),
    );
    this.scene.setPalette(paletteForPath(this.router.url));

    // Turning Reduce Effects on tears the context down immediately; turning it
    // back off rebuilds. Deferred a tick on the way up because the canvas does
    // not exist until the template has re-rendered around the new "show".
    this.subs.add(this.effects.reduced$.subscribe(reduced => {
      if (reduced) {
        this.scene.unmount();
        this.show = false;
        this.cdr.detectChanges();
        return;
      }
      if (this.show) return;
      this.show = this.effects.shouldRender({ embed: this.embed.isEmbed });
      if (!this.show) return;
      // Synchronous, not markForCheck: "attach()" needs the canvas to exist on
      // the very next line, and under OnPush the view would otherwise not be
      // rebuilt until something else happened to schedule a pass.
      this.cdr.detectChanges();
      this.attach();
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.scene.unmount();
  }

  private attach(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) void this.scene.mount(canvas, { embed: this.embed.isEmbed });
  }
}
