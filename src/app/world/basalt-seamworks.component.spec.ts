import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { TranslationService } from '../translation.service';
import { ActivityProgressionGateway } from '../shared/activity/activity-progression.gateway';
import { MINING_TIERS, emptyActivityLedger } from '../shared/activity/activity.model';
import { xpForLevel } from '../shared/activity/mining-level';
import { ChapterGateway } from '../shared/narrative/chapter.gateway';
import { emptyChapterLedger } from '../shared/narrative/chapter.model';
import { BasaltSeamworksComponent } from './basalt-seamworks.component';
import { InventoryService } from '../shared/rpg/inventory.service';
import { KeeperPanelService } from '../shared/keeper/keeper-panel.service';

describe('BasaltSeamworksComponent', () => {
  let fixture: ComponentFixture<BasaltSeamworksComponent>;
  const activity$ = new BehaviorSubject(emptyActivityLedger());
  const activity = {
    snapshot: emptyActivityLedger(),
    snapshot$: activity$.asObservable(),
    init: () => { /* noop */ },
    selectCurrentWork: () => ({ locationId: 'infernal/basalt-seamworks' }),
    recoveryRemainingMs: () => 0,
    miningSpeedupPct: () => 0,
    bagCanTakeOre: () => true,
    // Real enough to honour whichever tier the component asks for — a fixed
    // stub would make "click Heartstone, see 12 XP land" untestable.
    resolveMine: (input: { mutationId: string; oreId?: string }) => {
      const oreId = input.oreId ?? 'cinder-ore';
      const tier = MINING_TIERS.find(t => t.oreId === oreId) ?? MINING_TIERS[0];
      return {
        ok: true as const,
        replayed: false,
        operation: {
          id: input.mutationId,
          hlcRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 't', sequence: 1 },
          kind: 'active' as const,
          disciplineId: 'mining' as const,
          locationId: 'infernal/basalt-seamworks',
          resolvedAt: '2026-08-15T00:00:00.000Z',
          xpGrant: { id: `${input.mutationId}:xp`, amount: tier.xpPerAction },
          inventoryGrants: [{ id: `${input.mutationId}:ore`, definitionId: oreId, quantity: 1 }],
          discovery: { rolled: true, result: 'none' as const },
        },
      };
    },
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
          provide: InventoryService,
          useValue: {
            snapshot: { bag: [], stacks: [], usedRows: 0, full: false },
            snapshot$: of({ bag: [], stacks: [], usedRows: 0, full: false }),
            init: () => { /* noop */ },
            stackOf: (id: string) => id === 'cinder-ore' ? 4 : 0,
          },
        },
        { provide: KeeperPanelService, useValue: { show: () => { /* noop */ }, isOpen: false } },
        {
          provide: ChapterGateway,
          useValue: {
            init: () => { /* noop */ },
            infernal: () => emptyChapterLedger().infernal,
          },
        },
      ],
    }).compileComponents();
    // Sibling specs call setLanguage('es'), which persists to localStorage
    // and survives into whichever spec Karma runs next. Every assertion here
    // reads English copy, so pin it rather than depend on run order.
    TestBed.inject(TranslationService).setLanguage('en');
    fixture = TestBed.createComponent(BasaltSeamworksComponent);
    fixture.detectChanges();
  });

  it('shows Mine and expected ore without a craft control', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Basalt Seamworks');
    expect(el.textContent).toContain('1 Cinder Ore + 2 Mining XP');
    const mine = el.querySelector('.sw__mine') as HTMLButtonElement;
    expect(mine.textContent?.trim()).toBe('Mine');
    expect(el.textContent).toContain('×4');
    mine.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Cinder Ore +1 · held ×4');
    expect(el.textContent).not.toContain('Craft');
  });

  it('locks tiers the current level has not reached and names where they open', () => {
    const el = fixture.nativeElement as HTMLElement;
    const tierButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('.sw__tier'));
    expect(tierButtons.length).toBe(3);
    expect(tierButtons[0].disabled).toBe(false); // Cinder Ore — always open
    expect(tierButtons[1].disabled).toBe(true);  // Slag Fragment — level 8
    expect(tierButtons[2].disabled).toBe(true);  // Infernal Heartstone — level 20
    expect(el.textContent).toContain('Unlocks at level 8');
    expect(el.textContent).toContain('Unlocks at level 20');
  });

  it('lets a level-20 Keeper pick Infernal Heartstone and mine it for its higher XP', () => {
    activity$.next({
      ...emptyActivityLedger(),
      progress: { version: 1, xpByDiscipline: { mining: xpForLevel(20) } },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const heartstoneTier = Array.from(el.querySelectorAll<HTMLButtonElement>('.sw__tier'))[2];
    expect(heartstoneTier.disabled).toBe(false);

    heartstoneTier.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Expected: 1 Infernal Heartstone + 12 Mining XP.');

    const mine = el.querySelector('.sw__mine') as HTMLButtonElement;
    mine.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Infernal Heartstone +1');
    expect(el.textContent).toContain('Mining +12 XP.');
  });
});
