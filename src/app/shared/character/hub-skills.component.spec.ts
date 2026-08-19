import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { emptyActivityLedger } from '../activity/activity.model';
import { xpForLevel } from '../activity/mining-level';
import { HubSkillsComponent } from './hub-skills.component';

describe('HubSkillsComponent', () => {
  let fixture: ComponentFixture<HubSkillsComponent>;
  const activity$ = new BehaviorSubject(emptyActivityLedger());
  // Untyped: the embedded current-work tile also reads this. Every method
  // either component calls has to be here or the miss is a runtime TypeError.
  const activity = {
    snapshot: emptyActivityLedger(),
    snapshot$: activity$.asObservable(),
    init: () => { /* noop */ },
    recoveryRemainingMs: () => 0,
    currentRecoveryMs: () => 2500,
  };

  beforeEach(async () => {
    activity$.next(emptyActivityLedger());
    await TestBed.configureTestingModule({
      imports: [HubSkillsComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivityProgressionGateway, useValue: activity },
      ],
    }).compileComponents();
    TestBed.inject(TranslationService).setLanguage('en');
    fixture = TestBed.createComponent(HubSkillsComponent);
    fixture.detectChanges();
  });

  it('shows three live skill tiles — Mining, Foraging and Prospecting — and three locked ones', () => {
    const el = fixture.nativeElement as HTMLElement;
    const live = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--live'));
    const locked = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--locked'));
    expect(live.length).toBe(3);
    expect(locked.length).toBe(3);
    expect(live.map(li => li.querySelector('.hs__name')?.textContent?.trim()))
      .toEqual(['Mining', 'Foraging', 'Prospecting']);
    expect(locked.map(li => li.querySelector('.hs__name')?.textContent?.trim()))
      .toEqual(['Exploration', 'Forge', 'Hunting']);
    expect(el.querySelector('.hs__tag')?.textContent).toContain('Mining, Foraging and Prospecting are live');
  });

  it('sends each live tile to its own site', () => {
    const el = fixture.nativeElement as HTMLElement;
    const goes = Array.from(el.querySelectorAll<HTMLAnchorElement>('.hs__skill--live .hs__go'));
    expect(goes.length).toBe(3);
    expect(goes[0].getAttribute('href')).toContain('/world/realms/infernal/basalt-seamworks');
    expect(goes[1].getAttribute('href')).toContain('/world/realms/verdant/rootglass-canopy');
    expect(goes[2].getAttribute('href')).toContain('/world/realms/celestial/meridian-orrery');
    expect(goes[1].textContent?.trim()).toBe('Go to Canopy');
    expect(goes[2].textContent?.trim()).toBe('Go to Orrery');
  });

  it('draws each bar off its own discipline XP alone — no other skill moves it', () => {
    activity$.next({
      ...emptyActivityLedger(),
      progress: {
        version: 1,
        xpByDiscipline: { mining: xpForLevel(12), foraging: xpForLevel(3), prospecting: xpForLevel(7) },
      },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const [mining, foraging, prospecting] = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--live'));
    expect(mining.querySelector('.hs__lvl-n')?.textContent?.trim()).toBe('12');
    expect(foraging.querySelector('.hs__lvl-n')?.textContent?.trim()).toBe('3');
    expect(prospecting.querySelector('.hs__lvl-n')?.textContent?.trim()).toBe('7');
    const bars = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--live .hs__bar'));
    expect(bars.length).toBe(3);
    expect(bars[1].getAttribute('aria-label')).toContain('Foraging');
    expect(bars[2].getAttribute('aria-label')).toContain('Prospecting');
    // Each level exactly: 0 XP into the level, so every fill starts at 0%.
    expect(foraging.querySelector<HTMLElement>('.hs__bar-fill')?.style.width).toBe('0%');
    expect(prospecting.querySelector<HTMLElement>('.hs__bar-fill')?.style.width).toBe('0%');
    expect(foraging.textContent).toContain('to level 4');
    expect(prospecting.textContent).toContain('to level 8');
  });

  it('leaves a skill with no XP at level 1 while another is high', () => {
    activity$.next({
      ...emptyActivityLedger(),
      progress: { version: 1, xpByDiscipline: { mining: xpForLevel(30) } },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const live = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--live'));
    expect(live[0].querySelector('.hs__lvl-n')?.textContent?.trim()).toBe('30');
    expect(live[1].querySelector('.hs__lvl-n')?.textContent?.trim()).toBe('1');
    expect(live[2].querySelector('.hs__lvl-n')?.textContent?.trim()).toBe('1');
  });
});
