/**
 * AdsenseComponent
 * ─────────────────
 * Renders a single responsive Google AdSense banner.
 *
 * SETUP REQUIRED (one-time):
 *  1. Apply for Google AdSense at https://adsense.google.com.
 *  2. Once approved, replace ca-pub-XXXXXXXXXX in src/index.html AND
 *     set the real publisher ID in AD_CLIENT below.
 *  3. Create an ad unit in AdSense (or use Auto Ads) and replace
 *     AD_SLOT below with the numeric slot ID they provide.
 *
 * Current placeholders:
 *   AD_CLIENT = 'ca-pub-XXXXXXXXXX'  →  swap after AdSense approval
 *   AD_SLOT   = '0000000000'         →  swap with real slot ID
 */
import {
  Component,
  OnInit,
  Inject,
  PLATFORM_ID,
  Input
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const AD_CLIENT = 'ca-pub-XXXXXXXXXX';
const AD_SLOT   = '0000000000';

@Component({
  selector: 'app-adsense',
  standalone: false,
  template: `
    <div class="adsense-wrap" [attr.aria-label]="label">
      <span class="adsense-label">{{ label }}</span>
      <ins class="adsbygoogle adsense-ins"
           style="display:block"
           [attr.data-ad-client]="adClient"
           [attr.data-ad-slot]="adSlot"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
    </div>
  `,
  styleUrls: ['./adsense.component.css']
})
export class AdsenseComponent implements OnInit {
  @Input() label = 'Advertisement';

  adClient = AD_CLIENT;
  adSlot   = AD_SLOT;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const w = window as Window & { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // AdSense script not yet loaded — safe to ignore during development
    }
  }
}
