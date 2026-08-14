import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { TranslationService } from '../../translation.service';
import { InspectService } from './inspect.service';

describe('InspectService', () => {
  let inspect: InspectService;
  let router: Router;
  let i18n: TranslationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([{ path: '', children: [] }])],
      providers: [InspectService, TranslationService],
    }).compileComponents();
    inspect = TestBed.inject(InspectService);
    router = TestBed.inject(Router);
    i18n = TestBed.inject(TranslationService);
    i18n.setLanguage('en');
    await router.navigateByUrl('/');
    inspect.start();
  });

  it('writes inspect into the query string without dropping other params', async () => {
    await router.navigateByUrl('/?category=forge');
    inspect.open({ type: 'market-listing', id: 'forge-bellows' });
    expect(inspect.view.open).toBeTrue();
    expect(inspect.view.ref).toEqual({ type: 'market-listing', id: 'forge-bellows' });
  });

  it('re-resolves the open record when the language changes', () => {
    inspect.open({ type: 'rune', id: 'ash' });
    expect(inspect.view.resolution?.presentation?.kindLabel).toBe('Rune');
    i18n.setLanguage('es');
    expect(inspect.view.resolution?.presentation?.kindLabel).toBe('Runa');
    expect(inspect.view.resolution?.presentation?.name).toBe('Ash');
    expect(inspect.view.open).toBeTrue();
  });
});
