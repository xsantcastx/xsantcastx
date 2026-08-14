import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { TranslationService } from '../../translation.service';
import { InspectService } from './inspect.service';

describe('InspectService', () => {
  let inspect: InspectService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([{ path: '', children: [] }])],
      providers: [InspectService, TranslationService],
    }).compileComponents();
    inspect = TestBed.inject(InspectService);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    inspect.start();
  });

  it('writes inspect into the query string without dropping other params', async () => {
    await router.navigateByUrl('/?category=forge');
    inspect.open({ type: 'market-listing', id: 'forge-bellows' });
    expect(inspect.view.open).toBeTrue();
    expect(inspect.view.ref).toEqual({ type: 'market-listing', id: 'forge-bellows' });
  });
});
