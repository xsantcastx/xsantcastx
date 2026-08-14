import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { TranslationService } from '../translation.service';
import { FivefoldLockComponent } from './fivefold-lock.component';

describe('FivefoldLockComponent labels', () => {
  let fixture: ComponentFixture<FivefoldLockComponent>;
  let i18n: TranslationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FivefoldLockComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();

    i18n = TestBed.inject(TranslationService);
    fixture = TestBed.createComponent(FivefoldLockComponent);
    fixture.detectChanges();
  });

  function label(selector: string): string {
    return ((fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent ?? '').trim();
  }

  it('renders English chrome labels from TranslationService', () => {
    expect(label('.fl__crumb a')).toBe('World');
    expect(label('#fl-answers')).toBe('Five incomplete answers');
    expect(label('.fl__back span')).toBe('Continue Journey');
    expect(label('.fl__back strong')).toBe('Enter Luminous');
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('The Dawn Archive wants a necessary but incomplete remedy.');
  });

  it('switches chrome to Spanish and keeps the narrative title', () => {
    i18n.setLanguage('es');
    fixture.detectChanges();
    expect(label('h1')).toBe('The Fivefold Lock');
    expect(label('.fl__crumb a')).toBe('Mundo');
    expect(label('#fl-answers')).toBe('Cinco respuestas incompletas');
    expect(label('.fl__back span')).toBe('Continua el viaje');
    expect(label('.fl__back strong')).toBe('Entra en Luminous');
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('The Dawn Archive quiere un remedio necesario pero incompleto.');
  });
});
