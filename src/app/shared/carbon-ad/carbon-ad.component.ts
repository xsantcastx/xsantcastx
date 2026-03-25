/**
 * CarbonAdComponent
 * ─────────────────
 * Serves a single Carbon Ads unit — developer-focused, tasteful advertising.
 *
 * SETUP REQUIRED (one-time):
 *  1. Sign up at https://carbonads.com and submit xsantcastx.com for approval.
 *  2. Once approved, replace the `serve` param in CARBON_AD_SRC below with
 *     your real serve ID (the part after "serve=" in the snippet they provide).
 *  3. Replace `placement` with your registered placement slug if different.
 *
 * Current placeholder: serve=CWYD42JY  →  swap when account is live.
 */
import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  Inject,
  PLATFORM_ID,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const CARBON_AD_SRC =
  '//cdn.carbonads.com/carbon.js?serve=CWYD42JY&placement=xsantcastxcom';

@Component({
  selector: 'app-carbon-ad',
  standalone: false,
  template: `
    <aside class="carbon-ad-wrap" #wrap aria-label="Sponsored content">
      <span class="carbon-ad-label">Sponsored</span>
      <div class="carbon-ad-slot" #slot></div>
    </aside>
  `,
  styleUrls: ['./carbon-ad.component.css']
})
export class CarbonAdComponent implements OnInit, OnDestroy {
  @ViewChild('slot', { static: true }) slotEl!: ElementRef<HTMLDivElement>;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Avoid double-loading if the component is re-created on the same page
    if (document.getElementById('_carbonads_js')) return;

    const script = document.createElement('script');
    script.id = '_carbonads_js';
    script.type = 'text/javascript';
    script.async = true;
    script.src = CARBON_AD_SRC;
    this.slotEl.nativeElement.appendChild(script);
  }

  ngOnDestroy(): void {
    // Clean up the injected script so re-navigation re-loads correctly
    if (isPlatformBrowser(this.platformId)) {
      const existing = document.getElementById('_carbonads_js');
      existing?.parentNode?.removeChild(existing);
      // Also remove the rendered ad container Carbon inserts
      const rendered = document.getElementById('carbonads');
      rendered?.parentNode?.removeChild(rendered);
    }
  }
}
