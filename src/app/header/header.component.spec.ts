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

@Component({ standalone: true, template: '' })
class HallStubComponent {}

const PLAYER_HALLS = [CANONICAL.world, CANONICAL.character, '/market', CANONICAL.forge, '/codex'];
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
        { provide: TranslationService, useValue: { translate: (k: string) => k, currentLanguage$: of('en'), setLanguage: () => {} } },
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

  it('primary halls are exactly the implemented player destinations', () => {
    expect(component.primaryHalls.map(h => h.route)).toEqual(PLAYER_HALLS);
  });

  it('keeps development surfaces out of primary halls', () => {
    const routes = component.primaryHalls.map(h => h.route);
    for (const banned of BANNED_PRIMARY) {
      expect(routes).not.toContain(banned);
    }
  });

  it('tabs do not include legacy /home or /forge-keeper', () => {
    const routes = component.tabs.map(t => t.route);
    expect(routes).not.toContain('/home');
    expect(routes).not.toContain('/forge-keeper');
    expect(routes).toEqual(PLAYER_HALLS);
  });

  it('World destinations require an exact active match', () => {
    expect(component.primaryHalls[0].exact).toBeTrue();
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
