import { Component, inject } from '@angular/core';
import { ConsentService } from '../consent.service';
import { TranslationService } from '../translation.service';
import { AnalyticsService } from '../analytics.service';

@Component({
  selector: 'app-cookie-banner',
  templateUrl: './cookie-banner.component.html',
  styleUrls: ['./cookie-banner.component.css'],
  standalone: false
})
export class CookieBannerComponent {
  private consentService = inject(ConsentService);
  private translationService = inject(TranslationService);
  private analyticsService = inject(AnalyticsService);

  showBanner = false;

  ngOnInit(): void {
    // Show banner if no consent decision has been made
    this.showBanner = !this.consentService.hasConsentDecision();
  }

  acceptCookies(): void {
    this.consentService.acceptAnalyticsConsent();
    this.analyticsService.trackConsentDecision('accepted');
    this.showBanner = false;
  }

  denyCookies(): void {
    this.consentService.denyConsent();
    this.analyticsService.trackConsentDecision('denied');
    this.showBanner = false;
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }
}