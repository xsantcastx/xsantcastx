import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from '../translation.service';
import { RealmLandingComponent } from './realm-landing.component';

describe('RealmLandingComponent labels', () => {
  let fixture: ComponentFixture<RealmLandingComponent>;
  let i18n: TranslationService;
  const params$ = new BehaviorSubject(convertToParamMap({ realmId: 'luminous' }));
  // The five per-realm routes have no :realmId param and name their realm in
  // `data` instead, so the component reads both. A stub with only paramMap on
  // it no longer describes either way in.
  const data$ = new BehaviorSubject<Record<string, unknown>>({});

  beforeEach(async () => {
    params$.next(convertToParamMap({ realmId: 'luminous' }));
    data$.next({});
    await TestBed.configureTestingModule({
      imports: [RealmLandingComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params$.asObservable(), data: data$.asObservable() },
        },
      ],
    }).compileComponents();

    i18n = TestBed.inject(TranslationService);
    fixture = TestBed.createComponent(RealmLandingComponent);
    fixture.detectChanges();
  });

  function label(selector: string): string {
    return ((fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent ?? '').trim();
  }

  it('renders English chrome labels from TranslationService', () => {
    expect(label('.rl__crumb a')).toBe('World');
    expect(label('.rl__status')).toBe('Place open. Opening chapter not yet playable.');
    expect(label('#rl-facts')).toBe('Place and pressure');
    expect(label('#rl-conflict')).toBe('Unresolved conflict');
    expect(label('#rl-people')).toBe('Who waits here');
    expect(label('.rl__continue-label')).toBe('Continue Journey');
    expect(label('.rl__continue-name')).toBe('Continue to Celestial');
    const dts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('dt')).map(n => n.textContent?.trim());
    expect(dts).toEqual(['Landmark', 'Hazard', 'Resource', 'Threat']);
  });

  it('switches chrome to Spanish without rewriting lore', () => {
    i18n.setLanguage('es');
    fixture.detectChanges();
    expect(label('.rl__crumb a')).toBe('Mundo');
    expect(label('#rl-facts')).toBe('Lugar y presion');
    expect(label('#rl-conflict')).toBe('Conflicto sin resolver');
    expect(label('#rl-people')).toBe('Quien espera aqui');
    expect(label('.rl__k')).toBe('Desea');
    expect(label('.rl__continue-label')).toBe('Continua el viaje');
    expect(label('.rl__continue-name')).toBe('Continua hacia Celestial');
    expect(label('#rl-faction')).toBe('The Dawn Archive');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Heliograph Court');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ilyra Venn');
  });

  it('takes the realm from route data when the path carries no param', () => {
    params$.next(convertToParamMap({}));
    data$.next({ realmId: 'celestial' });
    fixture.detectChanges();
    expect(label('h1')).toBe('Celestial');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('This place is not on the map');
  });

  it('translates the unknown-realm fallback', () => {
    params$.next(convertToParamMap({ realmId: 'verge' }));
    fixture.detectChanges();
    expect(label('h1')).toBe('This place is not on the map');

    i18n.setLanguage('es');
    fixture.detectChanges();
    expect(label('h1')).toBe('Este lugar no esta en el mapa');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('verge');
    expect(label('.rl--missing a')).toBe('Volver al Mundo');
  });
});
