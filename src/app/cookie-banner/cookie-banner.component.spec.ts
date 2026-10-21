import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CONSENT_DOCK_VAR, CookieBannerComponent } from './cookie-banner.component';
import { ConsentService } from '../consent.service';
import { AnalyticsService } from '../analytics.service';
import { TranslationService } from '../translation.service';

describe('CookieBannerComponent', () => {
  let fixture: ComponentFixture<CookieBannerComponent>;
  let consent: jasmine.SpyObj<ConsentService>;
  let analytics: jasmine.SpyObj<AnalyticsService>;
  const dock = () => document.documentElement.style.getPropertyValue(CONSENT_DOCK_VAR);

  function create(decided: boolean, world: boolean): void {
    consent = jasmine.createSpyObj<ConsentService>('ConsentService', ['hasConsentDecision', 'acceptAnalyticsConsent', 'denyConsent']);
    consent.hasConsentDecision.and.returnValue(decided);
    analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['trackConsentDecision']);
    TestBed.configureTestingModule({
      declarations: [CookieBannerComponent],
      providers: [
        { provide: ConsentService, useValue: consent },
        { provide: AnalyticsService, useValue: analytics },
        { provide: TranslationService, useValue: { translate: (k: string) => k } },
      ],
    });
    fixture = TestBed.createComponent(CookieBannerComponent);
    fixture.componentRef.setInput('world', world);
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
    document.documentElement.style.removeProperty(CONSENT_DOCK_VAR);
    sessionStorage.removeItem('consent-later');
  });

  it('shows nothing once a choice exists', () => {
    create(true, true);
    expect(fixture.nativeElement.querySelector('.cookie-banner')).toBeNull();
    expect(dock()).toBe('');
  });

  it('in-world: a compact bar, both choices plain buttons, its height published for the game frame', () => {
    create(false, true);
    const bar: HTMLElement = fixture.nativeElement.querySelector('.cookie-banner--world');
    expect(bar).not.toBeNull();
    expect(bar.hasAttribute('data-engine-ignore')).toBeTrue();
    const buttons = bar.querySelectorAll('button');
    expect(buttons.length).toBe(3); // Accept, Essential Only, and "Not now"
    expect(dock()).toMatch(/^\d+px$/);
  });

  it('in-world Decline stores the choice the same way and releases the frame', () => {
    create(false, true);
    (fixture.nativeElement.querySelector('.btn-deny') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(consent.denyConsent).toHaveBeenCalledTimes(1);
    expect(consent.acceptAnalyticsConsent).not.toHaveBeenCalled();
    expect(analytics.trackConsentDecision).toHaveBeenCalledWith('denied');
    expect(fixture.nativeElement.querySelector('.cookie-banner')).toBeNull();
    expect(dock()).toBe('');
  });

  it('in-world Accept stores the choice the same way and releases the frame', () => {
    create(false, true);
    (fixture.nativeElement.querySelector('.btn-accept') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(consent.acceptAnalyticsConsent).toHaveBeenCalledTimes(1);
    expect(analytics.trackConsentDecision).toHaveBeenCalledWith('accepted');
    expect(dock()).toBe('');
  });

  it('in-world Not now closes the bar without answering and releases the frame', () => {
    create(false, true);
    (fixture.nativeElement.querySelector('.cookie-later') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(consent.denyConsent).not.toHaveBeenCalled();
    expect(consent.acceptAnalyticsConsent).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.cookie-banner')).toBeNull();
    expect(dock()).toBe('');
  });

  it('elsewhere keeps the full banner and docks nothing', () => {
    create(false, false);
    expect(fixture.nativeElement.querySelector('.cookie-banner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.cookie-banner--world')).toBeNull();
    expect(dock()).toBe('');
  });
});
