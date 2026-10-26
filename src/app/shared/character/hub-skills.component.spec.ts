import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { emptyActivityLedger } from '../activity/activity.model';
import { xpForLevel } from '../activity/mining-level';
import { CraftingService } from '../crafting/crafting.service';
import { HubSkillsComponent } from './hub-skills.component';

describe('HubSkillsComponent', () => {
  let fixture: ComponentFixture<HubSkillsComponent>;
  const activity$ = new BehaviorSubject(emptyActivityLedger());
  // Untyped: the embedded current-work tile also reads this. Every method
  // either component calls has to be here or the miss is a runtime TypeError.
  const activity = {
    get snapshot() { return activity$.value; },
    snapshot$: activity$.asObservable(),
    init: () => { /* noop */ },
    recoveryRemainingMs: () => 0,
    currentRecoveryMs: () => 2500,
  };
  const bench$ = new BehaviorSubject({ xp: 0 });
  const crafting = {
    get snapshot() { return bench$.value; },
    snapshot$: bench$.asObservable(),
    init: () => { /* noop */ },
  };

  beforeEach(async () => {
    activity$.next(emptyActivityLedger());
    bench$.next({ xp: 0 });
    await TestBed.configureTestingModule({
      imports: [HubSkillsComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivityProgressionGateway, useValue: activity },
        { provide: CraftingService, useValue: crafting },
      ],
    }).compileComponents();
    TestBed.inject(TranslationService).setLanguage('en');
    fixture = TestBed.createComponent(HubSkillsComponent);
    fixture.detectChanges();
  });

  const cards = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.sk__card'));
  const level = (card: HTMLElement) => card.querySelector('.sk__lvl')?.textContent?.trim();

  it('shows all eleven skills as real cards', () => {
    expect(cards().map(c => c.querySelector('.sk__name')?.textContent?.trim())).toEqual([
      'Mining', 'Foraging', 'Woodcutting', 'Smithing', 'Delving', 'Enchanting', 'Hunting', 'Prospecting', 'Fishing', 'Firemaking', 'Cooking',
    ]);
  });

  it('sends the three site skills to their own site', () => {
    const goes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.sk__go'));
    expect(goes.map(a => a.getAttribute('href'))).toEqual([
      '/world/realms/infernal/basalt-seamworks',
      '/world/realms/verdant/rootglass-canopy',
      '/world/realms/celestial/meridian-orrery',
    ]);
  });

  it('reads each level off its own discipline XP alone', () => {
    activity$.next({
      ...emptyActivityLedger(),
      progress: { version: 1, xpByDiscipline: { mining: xpForLevel(12), exploration: xpForLevel(7) } },
    });
    fixture.detectChanges();
    const [mining, foraging, , , delving] = cards();
    expect(level(mining)).toBe('12');
    expect(level(foraging)).toBe('1');
    expect(level(delving)).toBe('7');
  });

  it('counts the bench ladder toward Smithing', () => {
    bench$.next({ xp: xpForLevel(10) });
    fixture.detectChanges();
    expect(level(cards()[3])).toBe('10');
  });

  it('says what the next level opens, in one line', () => {
    expect(cards()[0].querySelector('.sk__next')?.textContent).toContain('level 8');
  });
});
