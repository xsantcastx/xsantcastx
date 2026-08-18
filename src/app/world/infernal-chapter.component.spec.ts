import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from '../translation.service';
import { ChapterGateway } from '../shared/narrative/chapter.gateway';
import { emptyChapterLedger, type ChapterLedger } from '../shared/narrative/chapter.model';
import { InfernalChapterComponent } from './infernal-chapter.component';

describe('InfernalChapterComponent', () => {
  let fixture: ComponentFixture<InfernalChapterComponent>;
  const snapshot$ = new BehaviorSubject(emptyChapterLedger());
  const gateway = {
    snapshot$: snapshot$.asObservable(),
    infernal: () => snapshot$.value.infernal,
    init: () => { /* noop */ },
    resolveInfernal: (choiceId: 'central' | 'distributed') => {
      const ledger: ChapterLedger = {
        version: 1,
        infernal: {
          chapterId: 'infernal',
          choiceId,
          completedAt: '2026-08-15T00:00:00.000Z',
          revision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 't', sequence: 1 },
        },
      };
      snapshot$.next(ledger);
      return { ok: true as const, record: ledger.infernal!, replayed: false };
    },
  };

  beforeEach(async () => {
    snapshot$.next(emptyChapterLedger());
    await TestBed.configureTestingModule({
      imports: [InfernalChapterComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ChapterGateway, useValue: gateway },
      ],
    }).compileComponents();
    // Sibling specs call setLanguage('es'), which persists to localStorage
    // and survives into whichever spec Karma runs next. Assertions here read
    // English copy, so pin it rather than depend on run order.
    TestBed.inject(TranslationService).setLanguage('en');
    fixture = TestBed.createComponent(InfernalChapterComponent);
    fixture.detectChanges();
  });

  it('walks enter to choose and records one inspectable consequence', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#ic-title')?.textContent).toContain('The Price of a Seam');
    (el.querySelector('.ic__btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.ic__btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('.ic__btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    const first = el.querySelector('.ic__choice') as HTMLButtonElement;
    expect(first.textContent).toContain('Emergency central brace');
    first.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('The works hold');
    expect(el.textContent).toContain('Witness Rune: Ash');
    expect(el.querySelector('.ic__btn--link')?.getAttribute('href')).toBe('/world/realms/infernal/basalt-seamworks');
  });
});
