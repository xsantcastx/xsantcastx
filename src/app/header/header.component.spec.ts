import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { HeaderComponent } from './header.component';
import { TranslationService } from '../translation.service';
import { AnalyticsService } from '../analytics.service';
import { EasterEggService } from '../shared/easter-eggs/easter-egg.service';
import { XpService } from '../shared/gamification/xp.service';
import { EconomyService } from '../shared/economy/economy.service';
import { CANONICAL } from '../shared/canonical-routes';
import { PRIMARY_NAV } from '../shared/nav/nav.manifest';

@Component({ standalone: true, template: '' })
class HallStubComponent {}

const BANNED_PRIMARY = ['/tools', '/blueprint', '/mcp', '/mission-control', '/arena', '/sponsors'];

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      imports: [RouterTestingModule.withRoutes([
        { path: 'world', component: HallStubComponent },
        { path: 'world/quests', component: HallStubComponent },
        { path: 'character', component: HallStubComponent },
        { path: 'market', component: HallStubComponent },
        { path: 'forge/runes', component: HallStubComponent },
        { path: 'codex', component: HallStubComponent },
      ])],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: TranslationService, useValue: {
          translate: (k: string) => ({
            'gfnav.brand': 'Eclipse Realms',
            'gfnav.brandLabel': 'Eclipse Realms — World',
          }[k] ?? k),
          currentLanguage$: of('en'),
          setLanguage: () => {},
        } },
        { provide: AnalyticsService, useValue: { trackLanguageChange: () => {} } },
        { provide: EasterEggService, useValue: { init: async () => {}, foundCount: 0 } },
        {
          provide: XpService,
          useValue: {
            snapshot: { xp: 0, progress: 0, level: { level: 1, title: 'Wanderer' }, next: null },
            snapshot$: of({ xp: 0, progress: 0, level: { level: 1, title: 'Wanderer' }, next: null }),
            init: async () => {},
          },
        },
        {
          provide: EconomyService,
          useValue: {
            snapshot: { gold: 0, essence: 0 },
            snapshot$: of({ gold: 0, essence: 0 }),
            init: () => {},
          },
        },
      ],
    });
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('brands the player chrome as Eclipse Realms', () => {
    fixture.detectChanges();
    const brand = fixture.nativeElement.querySelector('.gfnav__brand') as HTMLAnchorElement;
    expect(brand.getAttribute('aria-label')).toBe('Eclipse Realms — World');
    expect(brand.querySelector('.gfnav__wordmark')?.textContent?.trim()).toBe('Eclipse Realms');
    expect(fixture.nativeElement.querySelector('.gfnav__creed')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('XSANTCASTX');
    expect(fixture.nativeElement.textContent).not.toContain('BUILD');
  });

  it('primary halls come from the nav manifest', () => {
    expect(component.primaryNav).toBe(PRIMARY_NAV);
    expect(component.tabs).toBe(PRIMARY_NAV);
    expect(component.primaryNav.map(h => h.route)).toEqual(PRIMARY_NAV.map(d => d.route));
  });

  it('keeps development surfaces out of primary halls', () => {
    const routes = PRIMARY_NAV.map(h => h.route);
    for (const banned of BANNED_PRIMARY) {
      expect(routes).not.toContain(banned);
    }
  });

  it('tabs do not include legacy /home or /forge-keeper', () => {
    const routes = PRIMARY_NAV.map(t => t.route);
    expect(routes).not.toContain('/home');
    expect(routes).not.toContain('/forge-keeper');
    expect(routes).toEqual(PRIMARY_NAV.map(d => d.route));
  });

  it('World destinations require an exact active match', () => {
    expect(PRIMARY_NAV[0].exact).toBeTrue();
    expect(component.tabs[0].exact).toBeTrue();
    expect(component.tomeSections[0].halls[0].exact).toBeTrue();
  });

  it('does not mark World active on /world/quests', async () => {
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl(CANONICAL.quests);
    fixture.detectChanges();
    const worldTab = [...fixture.nativeElement.querySelectorAll('.gftabs__tab')]
      .find((el: Element) => el.getAttribute('href') === CANONICAL.world || el.getAttribute('ng-reflect-router-link') === CANONICAL.world);
    expect(worldTab).toBeTruthy();
    expect(worldTab.classList.contains('is-active')).toBeFalse();
    const worldHall = [...fixture.nativeElement.querySelectorAll('.gfnav__hall')]
      .find((el: Element) => el.getAttribute('href') === CANONICAL.world || el.getAttribute('ng-reflect-router-link') === CANONICAL.world);
    expect(worldHall.classList.contains('is-active')).toBeFalse();
  });
});
