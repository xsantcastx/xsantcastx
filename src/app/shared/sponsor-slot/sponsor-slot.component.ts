/**
 * SponsorSlotComponent
 * ────────────────────
 * Renders ONE Featured Partner direct-sponsor slot for a named placement.
 * Returns nothing when no sponsor is live (component just doesn't paint),
 * so it's safe to drop into any sidebar without empty-state UX cost.
 *
 * Usage:
 *   <app-sponsor-slot placement="tools-sidebar:ai"></app-sponsor-slot>
 *
 * Accessibility:
 *   • aria-label='Sponsored content' on the wrapper.
 *   • Visible 'Sponsored' badge for transparency (FTC + IAB compliant).
 *   • CTA uses rel="sponsored noopener noreferrer" per Google guidance.
 *   • Dismiss button has aria-label and works via keyboard.
 *
 * Tracking:
 *   • Impression fired on first paint in the browser (deduped per placement).
 *   • Click fired before the navigation hand-off — uses gtag + localStorage
 *     counter, no Firebase dependency.
 */
import {
  Component,
  Input,
  Inject,
  PLATFORM_ID,
  OnInit,
  OnChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Sponsor, SponsorPlacement, SponsorService } from './sponsor.service';

@Component({
  selector: 'app-sponsor-slot',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sponsor && !dismissed) {
      <aside
        class="sponsor-slot"
        [attr.style]="'--sponsor-accent: ' + sponsor.accentColor"
        [attr.data-placement]="placement"
        aria-label="Sponsored content"
      >
        <div class="sponsor-slot__inner">
          <div class="sponsor-slot__icon" aria-hidden="true">
            @if (sponsor.iconSvg) {
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                [innerHTML]="sponsor.iconSvg"
              ></svg>
            } @else {
              <!-- Neutral fallback mark when sponsor didn't supply art -->
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M9 12l2 2 4-4"></path>
              </svg>
            }
          </div>
          <div class="sponsor-slot__body">
            <p class="sponsor-slot__brand">{{ sponsor.brand }}</p>
            <p class="sponsor-slot__headline">{{ sponsor.headline }}</p>
            <p class="sponsor-slot__desc">{{ sponsor.description }}</p>
          </div>
          <a
            class="sponsor-slot__cta"
            [href]="sponsor.ctaUrl"
            target="_blank"
            rel="sponsored noopener noreferrer"
            (click)="onClickCta()"
          >
            {{ sponsor.cta }}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7"></path>
              <path d="M7 7h10v10"></path>
            </svg>
          </a>
          <button
            type="button"
            class="sponsor-slot__dismiss"
            (click)="dismiss()"
            aria-label="Dismiss sponsored content"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <span class="sponsor-slot__badge">Sponsored</span>
      </aside>
    }
  `,
  styleUrls: ['./sponsor-slot.component.css'],
})
export class SponsorSlotComponent implements OnInit, OnChanges {
  /** Named placement slot — see SponsorService.SponsorPlacement */
  @Input({ required: true }) placement!: SponsorPlacement;

  sponsor: Sponsor | null = null;
  dismissed = false;

  private readonly isBrowser: boolean;

  constructor(
    private sponsorService: SponsorService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.resolveSponsor();
  }

  ngOnChanges(): void {
    this.resolveSponsor();
  }

  onClickCta(): void {
    if (this.sponsor) {
      this.sponsorService.trackClick(this.sponsor, this.placement);
    }
  }

  dismiss(): void {
    if (!this.sponsor) return;
    this.dismissed = true;

    if (this.isBrowser) {
      try {
        sessionStorage.setItem(
          `sponsor_dismissed_${this.sponsor.id}_${this.placement}`,
          '1',
        );
      } catch {
        // ignore — sessionStorage may be disabled
      }
    }
    this.cdr.markForCheck();
  }

  private resolveSponsor(): void {
    if (!this.placement) {
      this.sponsor = null;
      return;
    }
    const next = this.sponsorService.getActiveSponsorForPlacement(this.placement);

    // Respect previous session dismissal so the same sponsor doesn't keep
    // re-appearing after the user opted out for this slot.
    if (next && this.isBrowser) {
      try {
        const key = `sponsor_dismissed_${next.id}_${this.placement}`;
        if (sessionStorage.getItem(key) === '1') {
          this.dismissed = true;
        } else {
          this.dismissed = false;
        }
      } catch {
        this.dismissed = false;
      }
    }

    this.sponsor = next;

    if (next && this.isBrowser && !this.dismissed) {
      this.sponsorService.trackImpression(next, this.placement);
    }
    this.cdr.markForCheck();
  }
}
