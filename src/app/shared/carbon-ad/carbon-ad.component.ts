/**
 * CarbonAdComponent — the in-tool ad slot.
 *
 * Despite the name (kept so the 39 tool templates using <app-carbon-ad> did not
 * all have to change), this renders whichever network `activeAdNetwork()` says
 * is live, and a **house ad** pointing at /sponsors when none is. See
 * ../ads/ad-config.ts for how to switch a real network on.
 *
 * Suppressed entirely — no markup, no script, no impression — when
 * AdVisibilityService says so: Pro buyers, dashboard routes, and while the boot
 * curtain is still up.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE HOUSE AD IS NOT AN EMPTY DIV
 * ─────────────────────────────────────────────────────────────────────────────
 * The site has ~39 tool pages carrying this slot and no advertiser yet. Leaving
 * it blank wastes the only asset that actually sells sponsorship: proof that
 * the inventory exists, is nicely placed, and looks good. The house card is a
 * sales pitch aimed at the one visitor in ten thousand who runs a dev-tools
 * company, and costs the other 9,999 a tasteful, dismissible card.
 */
import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { AdVisibilityService } from '../ads/ad-visibility.service';
import { activeAdNetwork, carbonScriptSrc, AdNetwork } from '../ads/ad-config';

@Component({
  selector: 'app-carbon-ad',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <aside class="carbon-ad-wrap" aria-label="Sponsored content">
        @if (network === 'house') {
          <app-house-ad></app-house-ad>
        } @else {
          <span class="carbon-ad-label">Sponsored</span>
          <div class="carbon-ad-slot" #slot></div>
        }
      </aside>
    }
  `,
  styleUrls: ['./carbon-ad.component.css'],
})
export class CarbonAdComponent implements OnInit, OnDestroy {
  /** `static: false` — the slot lives inside two @if branches, so it does not
   *  exist at ngOnInit and cannot be resolved statically. */
  @ViewChild('slot') slotEl?: ElementRef<HTMLDivElement>;

  readonly network: AdNetwork = activeAdNetwork();
  visible = false;

  private observer?: IntersectionObserver;
  private sub?: Subscription;
  private scriptRequested = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private visibility: AdVisibilityService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.sub = this.visibility.canShowAds$.subscribe(can => {
      if (this.visible === can) return;
      this.visible = can;
      // OnPush + an async source: the template will not re-evaluate `visible`
      // without being told.
      this.cdr.markForCheck();

      if (!can) {
        this.teardown();
        return;
      }
      // The house ad is pure markup — nothing to lazy-load.
      if (this.network === 'house') return;

      // The @if has only just flipped, so the slot div is not in the DOM until
      // change detection runs. Defer observation by a microtask.
      queueMicrotask(() => this.observeSlot());
    });
  }

  /**
   * Start watching for the slot to approach the viewport.
   *
   * The unit sits below the tool header, so on a phone it is often off-screen
   * at load. Fetching the network script during initial load spends bandwidth
   * and main-thread time on something the user cannot see, competing with the
   * LCP resource. 200px of rootMargin gives the request a head start so the
   * unit is usually painted by the time it is scrolled to.
   */
  private observeSlot(): void {
    const el = this.slotEl?.nativeElement;
    if (!el || this.scriptRequested) return;

    if (typeof IntersectionObserver === 'undefined') {
      this.injectScript();
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        this.disconnect();
        this.injectScript();
      },
      { rootMargin: '200px' },
    );
    this.observer.observe(el);
  }

  private injectScript(): void {
    if (this.network !== 'carbon') return;
    // Two slots on one page could both fire before either injected.
    if (this.scriptRequested || document.getElementById('_carbonads_js')) return;
    const el = this.slotEl?.nativeElement;
    if (!el) return;

    this.scriptRequested = true;
    const script = document.createElement('script');
    script.id = '_carbonads_js';
    script.type = 'text/javascript';
    script.async = true;
    script.src = carbonScriptSrc();
    el.appendChild(script);
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  /** Remove the injected script + Carbon's rendered node so a re-show re-loads. */
  private teardown(): void {
    this.disconnect();
    if (!isPlatformBrowser(this.platformId)) return;
    document.getElementById('_carbonads_js')?.remove();
    document.getElementById('carbonads')?.remove();
    this.scriptRequested = false;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.teardown();
  }
}
