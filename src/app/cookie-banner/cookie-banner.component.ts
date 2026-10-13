import { Component, ElementRef, Input, OnDestroy, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ConsentService } from '../consent.service';
import { TranslationService } from '../translation.service';
import { AnalyticsService } from '../analytics.service';

/**
 * Set on <html> while the in-world consent bar is up: its measured height.
 * The /play host (side-scroller.component.css) subtracts it from its own
 * height, so the bar is docked BELOW the game frame instead of painted over
 * it — the canvas, action bar, touch row and Hearth all sit inside the frame
 * and move up with it. A notice never covers gameplay.
 */
export const CONSENT_DOCK_VAR = '--gf-consent-h';

@Component({
  selector: 'app-cookie-banner',
  templateUrl: './cookie-banner.component.html',
  styleUrls: ['./cookie-banner.component.css'],
  standalone: false
})
export class CookieBannerComponent implements OnDestroy {
  private consentService = inject(ConsentService);
  private translationService = inject(TranslationService);
  private analyticsService = inject(AnalyticsService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  showBanner = false;

  /**
   * In-world routes (/play): the compact bar docked under the game frame.
   * Only the layout changes — the choice, its storage and what it gates are
   * the same as on every other route.
   */
  @Input() set world(value: boolean) {
    this.isWorld = !!value;
    this.syncDock();
  }
  get world(): boolean { return this.isWorld; }
  private isWorld = false;

  private observer?: ResizeObserver;
  private bar?: HTMLElement;

  @ViewChild('bar') set barRef(ref: ElementRef<HTMLElement> | undefined) {
    const el = ref?.nativeElement;
    if (el === this.bar) return;
    this.observer?.disconnect();
    this.bar = el;
    if (el && this.browser && typeof ResizeObserver !== 'undefined') {
      this.observer ??= new ResizeObserver(() => this.syncDock());
      this.observer.observe(el);
    }
    this.syncDock();
  }

  ngOnInit(): void {
    // Show banner if no consent decision has been made
    this.showBanner = !this.consentService.hasConsentDecision();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.setDock(0);
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

  private syncDock(): void {
    const docked = this.isWorld && this.showBanner && !!this.bar?.isConnected;
    this.setDock(docked ? Math.ceil(this.bar!.getBoundingClientRect().height) : 0);
  }

  private setDock(px: number): void {
    if (!this.browser) return;
    const root = document.documentElement.style;
    if (px > 0) root.setProperty(CONSENT_DOCK_VAR, `${px}px`);
    else root.removeProperty(CONSENT_DOCK_VAR);
  }
}
