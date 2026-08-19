import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { TranslationService } from '../translation.service';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import { emptyActivityLedger } from '../shared/activity/activity.model';
import {
  CELESTIAL_ALLOY_ID,
  MERIDIAN_ORRERY_ID,
  PROSPECTING_TIERS,
} from '../shared/activity/prospecting.model';
import { xpForLevel } from '../shared/activity/mining-level';
import { MeridianOrreryComponent } from './meridian-orrery.component';
import { InventoryService } from '../shared/rpg/inventory.service';
import { KeeperPanelService } from '../shared/keeper/keeper-panel.service';

describe('MeridianOrreryComponent', () => {
  let fixture: ComponentFixture<MeridianOrreryComponent>;
  const activity$ = new BehaviorSubject(emptyActivityLedger());
  const selectCalls: Array<{ discipline: string; locationId: string }> = [];
  // Untyped on purpose (mirrors the other two site specs): every method the
  // component calls — *and every method the embedded Current Work tile calls* —
  // must be here, or the miss is a runtime TypeError inside change detection
  // rather than a compile error.
  const activity = {
    snapshot: emptyActivityLedger(),
    snapshot$: activity$.asObservable(),
    init: () => { /* noop */ },
    selectCurrentWork: (discipline: string, locationId: string) => {
      selectCalls.push({ discipline, locationId });
      return { locationId };
    },
    recoveryRemainingMs: () => 0,
    currentRecoveryMs: () => 2500,
    prospectingSpeedupPct: () => 0,
    bagCanTake: () => true,
    bagCanTakeOre: () => true,
    // Real enough to honour whichever cut the component asks for — a fixed
    // stub would make "click Void Shard, see 19 XP land" untestable.
    resolveProspect: (input: { mutationId: string; mineralId?: string }) => {
      const mineralId = input.mineralId ?? CELESTIAL_ALLOY_ID;
      const tier = PROSPECTING_TIERS.find(t => t.mineralId === mineralId) ?? PROSPECTING_TIERS[0];
      return {
        ok: true as const,
        replayed: false,
        operation: {
          id: input.mutationId,
          hlcRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 't', sequence: 1 },
          kind: 'active' as const,
          disciplineId: 'prospecting' as const,
          locationId: MERIDIAN_ORRERY_ID,
          resolvedAt: '2026-08-19T00:00:00.000Z',
          xpGrant: { id: `${input.mutationId}:xp`, amount: tier.xpPerAction },
          inventoryGrants: [{ id: `${input.mutationId}:mineral`, definitionId: mineralId, quantity: 1 }],
          discovery: { rolled: true, result: 'none' as const },
        },
      };
    },
  };

  const inventory = {
    snapshot: { bag: [], stacks: [], usedRows: 0, full: false },
    snapshot$: of({ bag: [], stacks: [], usedRows: 0, full: false }),
    init: () => { /* noop */ },
    stackOf: (id: string) => (id === CELESTIAL_ALLOY_ID ? 4 : 0),
    canAcceptStackGrant: () => true,
  };

  beforeEach(async () => {
    activity$.next(emptyActivityLedger());
    activity.snapshot = emptyActivityLedger();
    selectCalls.length = 0;
    await TestBed.configureTestingModule({
      imports: [MeridianOrreryComponent, RouterTestingModule],
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
    fixture = TestBed.createComponent(MeridianOrreryComponent);
    fixture.detectChanges();
  });

  it('shows Survey and the expected mineral, with no Mine, Gather, Craft or Refine control', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Meridian Orrery');
    expect(el.textContent).toContain('1 Celestial Alloy + 2 Prospecting XP');
    expect(el.textContent).toContain('Clarity Elixir');
    const prospect = el.querySelector('.mo__prospect') as HTMLButtonElement;
    expect(prospect.textContent?.trim()).toBe('Survey');
    expect(el.textContent).toContain('×4');
    prospect.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Celestial Alloy +1 · held ×4');
    expect(el.textContent).toContain('Prospecting +2 XP.');
    expect(el.textContent).not.toContain('Craft');
    expect(el.textContent).not.toContain('Refine');
    expect(el.querySelectorAll('.mo__prospect').length).toBe(1);
    expect(el.querySelectorAll('.mo__sr').length).toBe(1);
    expect(el.querySelectorAll('.sw__mine').length).toBe(0);
    expect(el.querySelectorAll('.rc__gather').length).toBe(0);
  });

  it('selects Prospecting at the Orrery on mount when Current Work is empty', () => {
    expect(selectCalls).toEqual([{ discipline: 'prospecting', locationId: MERIDIAN_ORRERY_ID }]);
  });

  it('re-selects Prospecting at the Orrery on mount when Current Work points at another site', () => {
    // The "choose which skill to grind" moment: a Keeper who walked here from
    // the Canopy would otherwise see 'location' rejects on every Survey.
    fixture.destroy();
    selectCalls.length = 0;
    activity.snapshot = {
      ...emptyActivityLedger(),
      currentWork: {
        version: 2,
        disciplineId: 'foraging',
        locationId: 'verdant/rootglass-canopy',
        startedAt: '2026-08-19T00:00:00.000Z',
        lastResolvedAt: '2026-08-19T00:00:00.000Z',
        selectionRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 't', sequence: 1 },
      },
    };
    fixture = TestBed.createComponent(MeridianOrreryComponent);
    fixture.detectChanges();
    expect(selectCalls).toEqual([{ discipline: 'prospecting', locationId: MERIDIAN_ORRERY_ID }]);
  });

  it('locks cuts the current prospecting level has not reached and names where they open', () => {
    const el = fixture.nativeElement as HTMLElement;
    const tierButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('.mo__tier'));
    expect(tierButtons.length).toBe(5);
    expect(tierButtons[0].disabled).toBe(false); // Celestial Alloy — always open
    expect(tierButtons.slice(1).map(b => b.disabled)).toEqual([true, true, true, true]);
    expect(el.textContent).toContain('Unlocks at level 7');
    expect(el.textContent).toContain('Unlocks at level 15');
    expect(el.textContent).toContain('Unlocks at level 24');
    expect(el.textContent).toContain('Unlocks at level 34');
    expect(tierButtons.map(b => b.textContent)).toEqual(jasmine.arrayContaining([
      jasmine.stringContaining('Celestial Alloy'),
      jasmine.stringContaining('Luminous Prism'),
      jasmine.stringContaining('Verdant Sap'),
      jasmine.stringContaining('Umbral Ink'),
      jasmine.stringContaining('Void Shard'),
    ]));
  });

  it('lets a prospecting-level-34 Keeper pick Void Shard and survey it for its higher XP', () => {
    activity$.next({
      ...emptyActivityLedger(),
      // The other two totals are irrelevant — the Orrery reads prospecting only.
      progress: { version: 1, xpByDiscipline: { prospecting: xpForLevel(34), mining: 0, foraging: 0 } },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const voidShard = Array.from(el.querySelectorAll<HTMLButtonElement>('.mo__tier'))[4];
    expect(voidShard.disabled).toBe(false);

    voidShard.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Expected: 1 Void Shard + 19 Prospecting XP.');

    const prospect = el.querySelector('.mo__prospect') as HTMLButtonElement;
    prospect.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Void Shard +1');
    expect(el.textContent).toContain('Prospecting +19 XP.');
  });

  it('keeps cuts shut when only the other skills\' XP is high', () => {
    activity$.next({
      ...emptyActivityLedger(),
      progress: { version: 1, xpByDiscipline: { mining: xpForLevel(40), foraging: xpForLevel(40) } },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tierButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('.mo__tier'));
    expect(tierButtons.map(b => b.disabled)).toEqual([false, true, true, true, true]);
  });
});
