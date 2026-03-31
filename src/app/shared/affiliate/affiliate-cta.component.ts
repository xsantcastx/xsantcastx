import { Component, Input, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AffiliateService, AffiliatePartner } from './affiliate.service';

@Component({
  selector: 'app-affiliate-cta',
  standalone: false,
  template: `
    <aside
      class="aff-cta"
      *ngIf="partner && !dismissed"
      [style.--aff-accent]="partner.accentColor"
      aria-label="Sponsored recommendation"
    >
      <div class="aff-cta__inner">

        <!-- Icon -->
        <div class="aff-cta__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               [innerHTML]="partner.iconSvg">
          </svg>
        </div>

        <!-- Copy -->
        <div class="aff-cta__body">
          <p class="aff-cta__headline">
            {{ partner.headline }}
            <span class="aff-cta__badge" *ngIf="partner.incentive">{{ partner.incentive }}</span>
          </p>
          <p class="aff-cta__desc">{{ partner.description }}</p>
        </div>

        <!-- CTA button -->
        <a
          class="aff-cta__btn"
          [href]="partner.url"
          target="_blank"
          rel="sponsored noopener noreferrer"
          (click)="onClickCta()"
        >
          Try {{ partner.name }}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
          </svg>
        </a>

        <!-- Dismiss -->
        <button class="aff-cta__dismiss" (click)="dismiss()" aria-label="Dismiss recommendation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

      </div>

      <!-- Sponsored label -->
      <span class="aff-cta__sponsored">Sponsored</span>
    </aside>
  `,
  styleUrls: ['./affiliate-cta.component.css']
})
export class AffiliateCTAComponent implements OnInit {
  /** Tool category from the registry (e.g. 'Email Tools', 'Security Tools') */
  @Input() category = '';
  /** Tool slug for click tracking */
  @Input() toolSlug = '';

  partner: AffiliatePartner | null = null;
  dismissed = false;

  private isBrowser: boolean;

  constructor(
    private affiliateService: AffiliateService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.partner = this.affiliateService.getPartnerForCategory(this.category);

    // Respect session dismissal per partner
    if (this.isBrowser && this.partner) {
      const key = `aff_dismissed_${this.partner.id}`;
      if (sessionStorage.getItem(key) === '1') {
        this.dismissed = true;
      }
    }
  }

  onClickCta(): void {
    if (this.partner) {
      this.affiliateService.trackClick(this.partner.id, this.toolSlug);
    }
  }

  dismiss(): void {
    this.dismissed = true;
    if (this.isBrowser && this.partner) {
      sessionStorage.setItem(`aff_dismissed_${this.partner.id}`, '1');
    }
  }
}
