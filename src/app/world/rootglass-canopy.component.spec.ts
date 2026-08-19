import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { TranslationService } from '../translation.service';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import { emptyActivityLedger } from '../shared/activity/activity.model';
import { FORAGING_TIERS, ROOTGLASS_CANOPY_ID } from '../shared/activity/foraging.model';
import { xpForLevel } from '../shared/activity/mining-level';
import { RootglassCanopyComponent } from './rootglass-canopy.component';
import { InventoryService } from '../shared/rpg/inventory.service';
import { KeeperPanelService } from '../shared/keeper/keeper-panel.service';

describe('RootglassCanopyComponent', () => {
  let fixture: ComponentFixture<RootglassCanopyComponent>;
  const activity$ = new BehaviorSubject(emptyActivityLedger());
  const selectCalls: Array<{ discipline: string; locationId: string }> = [];
  // Untyped on purpose (mirrors basalt-seamworks.component.spec.ts): every
  // method the component calls must be here, or the miss is a runtime
  // TypeError rather than a compile error.
  const activity = {
    snapshot: emptyActivityLedger(),
    snapshot$: activity$.asObservable(),
    init: () => { /* noop */ },
    selectCurrentWork: (discipline: string, locationId: string) => {
      selectCalls.push({ discipline, locationId });
      return { locationId };
    },
    recoveryRemainingMs: () => 0,
    foragingSpeedupPct: () => 0,
    bagCanTakeOre: () => true,
    // Real enough to honour whichever growth the component asks for — a fixed
    // stub would make "click Thornroot, see 15 XP land" untestable.
    resolveForage: (input: { mutationId: string; herbId?: string }) => {
      const herbId = input.herbId ?? 'starlight-herb';
      const tier = FORAGING_TIERS.find(t => t.herbId === herbId) ?? FORAGING_TIERS[0];
      return {
        ok: true as const,
        replayed: false,
        operation: {
          id: input.mutationId,
          hlcRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 't', sequence: 1 },
          kind: 'active' as const,
          disciplineId: 'foraging' as const,
          locationId: ROOTGLASS_CANOPY_ID,
          resolvedAt: '2026-08-15T00:00:00.000Z',
          xpGrant: { id: `${input.mutationId}:xp`, amount: tier.xpPerAction },
          inventoryGrants: [{ id: `${input.mutationId}:herb`, definitionId: herbId, quantity: 1 }],
          discovery: { rolled: true, result: 'none' as const },
        },
      };
    },
  };

  const inventory = {
    snapshot: { bag: [], stacks: [], usedRows: 0, full: false },
    snapshot$: of({ bag: [], stacks: [], usedRows: 0, full: false }),
    init: () => { /* noop */ },
    stackOf: (id: string) => (id === 'starlight-herb' ? 4 : 0),
    canAcceptStackGrant: () => true,
  };

  beforeEach(async () => {
    activity$.next(emptyActivityLedger());
    activity.snapshot = emptyActivityLedger();
    selectCalls.length = 0;
    await TestBed.configureTestingModule({
      imports: [RootglassCanopyComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivityProgressionGateway, useValue: activity },
        { provide: InventoryService, useValue: inventory },
        { provide: KeeperPanelService, useValue: { show: () => { /* noop */ }, isOpen: false } },
      ],
    }).compileComponents();
    // Sibling specs call setLanguage('es'), which persists to localStorage and
    // survives into whichever spec Karma runs next. Every assertion here reads
    // English copy, so pin it rather than depend on run order.
    TestBed.inject(TranslationService).setLanguage('en');
    fixture = TestBed.createComponent(RootglassCanopyComponent);
    fixture.detectChanges();
  });

  it('shows Gather and the expected herb, with no Mine, Craft or Refine control', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Rootglass Canopy');
    expect(el.textContent).toContain('1 Starlight Herb + 2 Foraging XP');
    expect(el.textContent).toContain('Rift Key');
    const gather = el.querySelector('.rc__gather') as HTMLButtonElement;
    expect(gather.textContent?.trim()).toBe('Gather');
    expect(el.textContent).toContain('×4');
    gather.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Starlight Herb +1 · held ×4');
    expect(el.textContent).toContain('Foraging +2 XP.');
    expect(el.textContent).not.toContain('Craft');
    expect(el.textContent).not.toContain('Refine');
    expect(el.querySelectorAll('.rc__gather').length).toBe(1);
    expect(el.querySelectorAll('.rc__sr').length).toBe(1);
    expect(el.querySelectorAll('.sw__mine').length).toBe(0);
  });

  it('selects Foraging at the Canopy on mount when Current Work is empty', () => {
    expect(selectCalls).toEqual([{ discipline: 'foraging', locationId: ROOTGLASS_CANOPY_ID }]);
  });

  it('re-selects Foraging at the Canopy on mount when Current Work points at the Seamworks', () => {
    // The "choose which skill to grind" moment: a Keeper who walked here from
    // the Seamworks would otherwise see 'location' rejects on every Gather.
    fixture.destroy();
    selectCalls.length = 0;
    activity.snapshot = {
      ...emptyActivityLedger(),
      currentWork: {
        version: 2,
        disciplineId: 'mining',
        locationId: 'infernal/basalt-seamworks',
        startedAt: '2026-08-15T00:00:00.000Z',
        lastResolvedAt: '2026-08-15T00:00:00.000Z',
        selectionRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 't', sequence: 1 },
      },
    };
    fixture = TestBed.createComponent(RootglassCanopyComponent);
    fixture.detectChanges();
    expect(selectCalls).toEqual([{ discipline: 'foraging', locationId: ROOTGLASS_CANOPY_ID }]);
  });

  it('re-selects Foraging at the Canopy on mount when Current Work points at the Orrery', () => {
    // B1's twin of the Seamworks case above: a third site means a third way to
    // arrive with Current Work pointing somewhere else.
    fixture.destroy();
    selectCalls.length = 0;
    activity.snapshot = {
      ...emptyActivityLedger(),
      currentWork: {
        version: 2,
        disciplineId: 'prospecting',
        locationId: 'celestial/meridian-orrery',
        startedAt: '2026-08-19T00:00:00.000Z',
        lastResolvedAt: '2026-08-19T00:00:00.000Z',
        selectionRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 't', sequence: 1 },
      },
    };
    fixture = TestBed.createComponent(RootglassCanopyComponent);
    fixture.detectChanges();
    expect(selectCalls).toEqual([{ discipline: 'foraging', locationId: ROOTGLASS_CANOPY_ID }]);
  });

  it('locks growths the current foraging level has not reached and names where they open', () => {
    const el = fixture.nativeElement as HTMLElement;
    const tierButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('.rc__tier'));
    expect(tierButtons.length).toBe(4);
    expect(tierButtons[0].disabled).toBe(false); // Starlight Herb — always open
    expect(tierButtons[1].disabled).toBe(true);  // Sunbloom — level 6
    expect(tierButtons[2].disabled).toBe(true);  // Nightbloom — level 14
    expect(tierButtons[3].disabled).toBe(true);  // Thornroot — level 25
    expect(el.textContent).toContain('Unlocks at level 6');
    expect(el.textContent).toContain('Unlocks at level 14');
    expect(el.textContent).toContain('Unlocks at level 25');
    expect(tierButtons.map(b => b.textContent)).toEqual(jasmine.arrayContaining([
      jasmine.stringContaining('Starlight Herb'),
      jasmine.stringContaining('Sunbloom'),
      jasmine.stringContaining('Nightbloom'),
      jasmine.stringContaining('Thornroot'),
    ]));
  });

  it('lets a foraging-level-25 Keeper pick Thornroot and gather it for its higher XP', () => {
    activity$.next({
      ...emptyActivityLedger(),
      // Mining XP is irrelevant here — the Canopy reads the foraging total only.
      progress: { version: 1, xpByDiscipline: { foraging: xpForLevel(25), mining: 0 } },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const thornroot = Array.from(el.querySelectorAll<HTMLButtonElement>('.rc__tier'))[3];
    expect(thornroot.disabled).toBe(false);

    thornroot.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Expected: 1 Thornroot + 15 Foraging XP.');

    const gather = el.querySelector('.rc__gather') as HTMLButtonElement;
    gather.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Thornroot +1');
    expect(el.textContent).toContain('Foraging +15 XP.');
  });

  it('keeps growths shut when only mining XP is high', () => {
    activity$.next({
      ...emptyActivityLedger(),
      progress: { version: 1, xpByDiscipline: { mining: xpForLevel(40) } },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tierButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('.rc__tier'));
    expect(tierButtons.map(b => b.disabled)).toEqual([false, true, true, true]);
  });
});
