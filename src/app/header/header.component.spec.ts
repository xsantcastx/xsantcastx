import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { HeaderComponent } from './header.component';
import { TranslationService } from '../translation.service';
import { AnalyticsService } from '../analytics.service';
import { EasterEggService } from '../shared/easter-eggs/easter-egg.service';
import { XpService } from '../shared/gamification/xp.service';
import { EconomyService } from '../shared/economy/economy.service';

const PLAYER_HALLS = ['/world', '/character', '/market', '/forge/runes', '/codex'];
const BANNED_PRIMARY = ['/tools', '/blueprint', '/mcp', '/mission-control', '/arena', '/sponsors'];

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      imports: [RouterTestingModule],
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
    expect(routes).toEqual(['/world', '/character', '/market', '/forge/runes', '/codex']);
  });
});
