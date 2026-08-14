import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { FooterComponent } from './footer.component';
import { TranslationService } from '../translation.service';
import { PaymentService } from '../payment.service';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FooterComponent],
      imports: [RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: TranslationService, useValue: {
          translate: (k: string) => ({
            'gfnav.brand': 'Eclipse Realms',
            'gfnav.brandLabel': 'Eclipse Realms — World',
            'gffoot.forgedBy': 'Forged by xsantcastx',
          }[k] ?? k),
          currentLanguage$: of('en'),
        } },
        { provide: PaymentService, useValue: { donationAmounts: [], isPayPalReady: () => false, isStripeReady: () => false } },
      ],
    });
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('brand links to /world', () => {
    const brand = fixture.nativeElement.querySelector('.gffoot__brand') as HTMLAnchorElement;
    expect(brand.getAttribute('routerLink') ?? brand.getAttribute('href')).toBe('/world');
  });

  it('brands the player wordmark as Eclipse Realms', () => {
    const brand = fixture.nativeElement.querySelector('.gffoot__brand') as HTMLAnchorElement;
    expect(brand.getAttribute('aria-label')).toBe('Eclipse Realms — World');
    expect(brand.querySelector('.gffoot__wordmark')?.textContent?.trim()).toBe('Eclipse Realms');
  });

  it('keeps xsantcastx as studio attribution', () => {
    const info = fixture.nativeElement.querySelector('.footer-info') as HTMLElement;
    expect(info.textContent).toContain('xsantcastx');
    expect(info.textContent).not.toContain('Development Studio');
    expect(fixture.nativeElement.querySelector('.gffoot__mark')?.textContent).toContain('xsantcastx');
  });

  it('still exposes demoted surfaces', () => {
    const hrefs = [...fixture.nativeElement.querySelectorAll('a')]
      .map(a => a.getAttribute('routerLink') || a.getAttribute('ng-reflect-router-link') || a.getAttribute('href') || '');
    for (const route of ['/tools', '/blueprint', '/mcp', '/mission-control', '/sponsors', '/donate']) {
      expect(hrefs).toContain(route);
    }
  });
});
