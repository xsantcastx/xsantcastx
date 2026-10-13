import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { emptyActivityLedger } from '../activity/activity.model';
import { xpForLevel } from '../activity/mining-level';
import { InventoryService } from '../rpg/inventory.service';
import { ToolStatsComponent } from './tool-stats.component';

describe('ToolStatsComponent (Keeper Stats → Tools)', () => {
  let fixture: ComponentFixture<ToolStatsComponent>;
  const activity$ = new BehaviorSubject(emptyActivityLedger());
  const activity = {
    get snapshot() { return activity$.value; },
    snapshot$: activity$.asObservable(),
    init: () => { /* noop */ },
  };
  const inv$ = new BehaviorSubject<{ items: { definitionId: string; explorerId?: string }[]; equipped: object }>({ items: [], equipped: {} });
  const inventory = {
    get snapshot() { return inv$.value; },
    snapshot$: inv$.asObservable(),
    init: () => { /* noop */ },
  };

  beforeEach(async () => {
    activity$.next(emptyActivityLedger());
    inv$.next({ items: [{ definitionId: 'starter-pickaxe' }, { definitionId: 'starter-axe' }, { definitionId: 'starter-sickle' }], equipped: {} });
    await TestBed.configureTestingModule({
      imports: [ToolStatsComponent],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivityProgressionGateway, useValue: activity },
        { provide: InventoryService, useValue: inventory },
      ],
    }).compileComponents();
    TestBed.inject(TranslationService).setLanguage('en');
    fixture = TestBed.createComponent(ToolStatsComponent);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const row = (family: string) => el().querySelector<HTMLElement>(`.tst__row[data-family="${family}"]`)!;

  it('says tools work from the satchel, and shows the starter pace per family', () => {
    expect(el().textContent).toContain('Tools work from your satchel — no need to equip.');
    expect(row('pickaxe').textContent).toContain('Pickaxe · tier I');
    expect(row('pickaxe').textContent).toContain('Mining power 1');
    expect(row('pickaxe').textContent).toContain('0.52 s per swing (slowest)');
    expect(row('staff').textContent).toContain('None');
  });

  it('a forged Pickaxe I swings faster; a Pickaxe III at Mining 1 says when the cap lifts', () => {
    inv$.next({ items: [{ definitionId: 'starter-pickaxe' }, { definitionId: 'pickaxe-1' }], equipped: {} });
    fixture.detectChanges();
    expect(row('pickaxe').textContent).toContain('0.46 s per swing');
    expect(row('pickaxe').textContent).not.toContain('slowest');
    inv$.next({ items: [{ definitionId: 'pickaxe-3' }], equipped: {} });
    fixture.detectChanges();
    expect(row('pickaxe').textContent).toContain('Pickaxe · tier I');
    expect(row('pickaxe').textContent).toContain('Works as tier I until Mining 10');
  });

  it('a higher Mining level shows its share: faster and harder than the tool alone', () => {
    const ledger = emptyActivityLedger();
    activity$.next({ ...ledger, progress: { ...ledger.progress, xpByDiscipline: { ...ledger.progress.xpByDiscipline, mining: xpForLevel(42) } } });
    inv$.next({ items: [{ definitionId: 'pickaxe-2' }], equipped: {} });
    fixture.detectChanges();
    expect(row('pickaxe').textContent).toContain('Power ×1.81 (tool ×1.5 · Mining 42 +21%)');
    expect(row('pickaxe').textContent).toContain('Swing 0.36 s (tool 0.40 · Mining 42 −10%)');
    // Woodcutting is still 1: the plain lines.
    expect(row('axe').textContent).toContain('None');
  });

  it('a tool left in a Delve chest is not in hand', () => {
    inv$.next({ items: [{ definitionId: 'pickaxe-2', explorerId: 'delve-chest:ember-delve:1' }], equipped: {} });
    fixture.detectChanges();
    expect(row('pickaxe').textContent).toContain('None');
  });
});
