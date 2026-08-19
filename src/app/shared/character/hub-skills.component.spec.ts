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

  it('shows two live skill tiles — Mining and Foraging — and three locked ones', () => {
    const el = fixture.nativeElement as HTMLElement;
    const live = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--live'));
    const locked = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--locked'));
    expect(live.length).toBe(2);
    expect(locked.length).toBe(3);
    expect(live.map(li => li.querySelector('.hs__name')?.textContent?.trim())).toEqual(['Mining', 'Foraging']);
    expect(locked.map(li => li.querySelector('.hs__name')?.textContent?.trim())).toEqual(['Exploration', 'Forge', 'Hunting']);
    expect(el.querySelector('.hs__tag')?.textContent).toContain('Mining and Foraging are live');
  });

  it('sends the Foraging tile to the Rootglass Canopy and the Mining tile to the Seamworks', () => {
    const el = fixture.nativeElement as HTMLElement;
    const goes = Array.from(el.querySelectorAll<HTMLAnchorElement>('.hs__skill--live .hs__go'));
    expect(goes.length).toBe(2);
    expect(goes[0].getAttribute('href')).toContain('/world/realms/infernal/basalt-seamworks');
    expect(goes[1].getAttribute('href')).toContain('/world/realms/verdant/rootglass-canopy');
    expect(goes[1].textContent?.trim()).toBe('Go to Canopy');
  });

  it('draws the Foraging bar off foraging XP alone — mining XP does not move it', () => {
    activity$.next({
      ...emptyActivityLedger(),
      progress: { version: 1, xpByDiscipline: { mining: xpForLevel(12), foraging: xpForLevel(3) } },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const [mining, foraging] = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--live'));
    expect(mining.querySelector('.hs__lvl-n')?.textContent?.trim()).toBe('12');
    expect(foraging.querySelector('.hs__lvl-n')?.textContent?.trim()).toBe('3');
    const bars = Array.from(el.querySelectorAll<HTMLElement>('.hs__skill--live .hs__bar'));
    expect(bars.length).toBe(2);
    expect(bars[1].getAttribute('aria-label')).toContain('Foraging');
    // Level 3 exactly: 0 XP into the level, so the fill starts at 0%.
    expect(foraging.querySelector<HTMLElement>('.hs__bar-fill')?.style.width).toBe('0%');
    expect(foraging.textContent).toContain('to level 4');
  });
});
