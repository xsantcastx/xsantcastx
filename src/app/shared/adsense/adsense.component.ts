/**
 * AdsenseComponent — the landing-page ad slot.
 *
 * Renders the AdSense unit only when a real publisher id is configured (see
 * ../ads/ad-config.ts); otherwise it renders the house "slot for sale" card.
 * Suppressed entirely for Pro buyers, on dashboard routes, and while the boot
 * curtain is up — see AdVisibilityService.
 *
 * NOTE: the AdSense loader script in src/index.html is commented out and also
 * carries the ca-pub-XXXXXXXXXX placeholder. Switching AdSense on means editing
 * BOTH that script tag and ADSENSE in ad-config.ts — `requestAd()` here only
 * queues a request; it cannot load the library.
 */
import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  Input,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { AdVisibilityService } from '../ads/ad-visibility.service';
import { HouseAdComponent } from '../ads/house-ad.component';
import { activeAdNetwork, ADSENSE, AdNetwork } from '../ads/ad-config';

@Component({
  selector: 'app-adsense',
  standalone: true,
  imports: [HouseAdComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="adsense-wrap" #wrap [attr.aria-label]="label">
        @if (network === 'house') {
          <app-house-ad
            title="This slot is for sale"
            body="The homepage unit — seen by everyone who lands here. One sponsor at a time."
          ></app-house-ad>
        } @else {
          <span class="adsense-label">{{ label }}</span>
          <ins
            class="adsbygoogle adsense-ins"
            style="display:block"
            [attr.data-ad-client]="adClient"
            [attr.data-ad-slot]="adSlot"
            data-ad-format="auto"
            data-full-width-responsive="true"
          ></ins>
        }
      </div>
    }
  `,
  styleUrls: ['./adsense.component.css'],
})
export class AdsenseComponent implements OnInit, OnDestroy {
  @Input() label = 'Advertisement';
  /** `static: false` — lives inside an @if, so it does not exist at ngOnInit. */
  @ViewChild('wrap') wrapEl?: ElementRef<HTMLDivElement>;

  readonly network: AdNetwork = activeAdNetwork();
  readonly adClient = ADSENSE.client;
  readonly adSlot = ADSENSE.slot;

  visible = false;

  private observer?: IntersectionObserver;
  private sub?: Subscription;
  private requested = false;

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
      this.cdr.markForCheck();

      if (!can) {
        this.disconnect();
        return;
      }
      if (this.network !== 'adsense') return;

      queueMicrotask(() => this.observeSlot());
    });
  }

  /**
   * Defer the ad request until the slot approaches the viewport.
   *
   * This unit sits well below the fold on the landing page. Pushing to the
   * adsbygoogle queue during ngOnInit makes AdSense fire its request as soon as
   * its loader runs — during initial page load, for a slot the user cannot see.
   */
  private observeSlot(): void {
    const el = this.wrapEl?.nativeElement;
    if (!el || this.requested) return;

    if (typeof IntersectionObserver === 'undefined') {
      this.requestAd();
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        this.disconnect();
        this.requestAd();
      },
      { rootMargin: '200px' },
    );
    this.observer.observe(el);
  }

  private requestAd(): void {
    if (this.requested) return;
    this.requested = true;
    try {
      const w = window as Window & { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // Loader not present — expected while AdSense is unconfigured.
    }
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.disconnect();
  }
}
