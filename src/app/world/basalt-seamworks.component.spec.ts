import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from '../translation.service';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import { emptyActivityLedger } from '../shared/activity/activity.model';
import { ChapterGateway } from '../shared/narrative/chapter.gateway';
import { emptyChapterLedger } from '../shared/narrative/chapter.model';
import { BasaltSeamworksComponent } from './basalt-seamworks.component';

describe('BasaltSeamworksComponent', () => {
  let fixture: ComponentFixture<BasaltSeamworksComponent>;
  const activity$ = new BehaviorSubject(emptyActivityLedger());
  const activity = {
    snapshot: emptyActivityLedger(),
    snapshot$: activity$.asObservable(),
    init: () => { /* noop */ },
    selectCurrentWork: () => ({ locationId: 'infernal/basalt-seamworks' }),
    recoveryRemainingMs: () => 0,
    resolveMine: () => ({
      ok: true as const,
      replayed: false,
      operation: {
        id: 'm1',
        hlcRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 't', sequence: 1 },
        kind: 'active' as const,
        disciplineId: 'mining' as const,
        locationId: 'infernal/basalt-seamworks',
        resolvedAt: '2026-08-15T00:00:00.000Z',
        xpGrant: { id: 'm1:xp', amount: 2 },
        inventoryGrants: [{ id: 'm1:ore', definitionId: 'cinder-ore', quantity: 1 }],
        discovery: { rolled: true, result: 'none' as const },
      },
    }),
  };

  beforeEach(async () => {
    activity$.next(emptyActivityLedger());
    await TestBed.configureTestingModule({
      imports: [BasaltSeamworksComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivityProgressionGateway, useValue: activity },
        {
          provide: ChapterGateway,
          useValue: {
            init: () => { /* noop */ },
            infernal: () => emptyChapterLedger().infernal,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BasaltSeamworksComponent);
    fixture.detectChanges();
  });

  it('shows Mine and expected ore without a craft control', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Basalt Seamworks');
    expect(el.textContent).toContain('1 Cinder Ore + 2 Mining XP');
    const mine = el.querySelector('.sw__mine') as HTMLButtonElement;
    expect(mine.textContent?.trim()).toBe('Mine');
    mine.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Bag: +1 Cinder Ore');
    expect(el.textContent).not.toContain('Craft');
  });
});
