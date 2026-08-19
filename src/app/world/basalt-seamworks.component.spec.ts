import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
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

  // Held counts the InventoryService stub answers from. Stateful so a refine
  // visibly moves the numbers the template renders; reset before every spec so
  // the '×4' assertions below never depend on run order.
  let held: Record<string, number> = {};
  const refineCalls: Array<{ id: string; from: string; batches: number }> = [];
  const inventory = {
    snapshot: { bag: [], stacks: [], usedRows: 0, full: false },
    snapshot$: of({ bag: [], stacks: [], usedRows: 0, full: false }),
    init: () => { /* noop */ },
    stackOf: (id: string) => held[id] ?? 0,
    canAcceptStackGrant: () => true,
    refineStack: (id: string, from: string, batches = 1) => {
      refineCalls.push({ id, from, batches });
      const to = from === 'cinder-ore' ? 'slag-fragment' : 'infernal-heartstone';
      const consume = batches * 3;
      if ((held[from] ?? 0) < consume) return { ok: false as const, code: 'insufficient' as const };
      held[from] = (held[from] ?? 0) - consume;
      held[to] = (held[to] ?? 0) + batches;
      return { ok: true as const, from, to, consumed: consume, produced: batches, replayed: false };
    },
  };

  beforeEach(async () => {
    activity$.next(emptyActivityLedger());
    held = { 'cinder-ore': 4 };
    refineCalls.length = 0;
    await TestBed.configureTestingModule({
      imports: [BasaltSeamworksComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivityProgressionGateway, useValue: activity },
        { provide: InventoryService, useValue: inventory },
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

  it('keeps Mine and its status line unique so class locators never match a Refine row', () => {
    // e2e/c8-infernal-seamworks.spec.ts locates the Mine button and its
    // live region by `.sw__mine` / `.sw__sr` in Playwright strict mode; a
    // second match anywhere on the page fails that spec. The Refine rows share
    // Mine's look through their own classes instead of reusing these two.
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.sw__mine').length).toBe(1);
    expect(el.querySelectorAll('.sw__sr').length).toBe(1);
    const rows = Array.from(el.querySelectorAll<HTMLElement>('.sw__refine-row'));
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.querySelectorAll('.sw__mine').length).toBe(0);
      expect(row.querySelectorAll('.sw__sr').length).toBe(0);
      expect(row.querySelectorAll('.sw__refine-btn').length).toBe(1);
      expect(row.querySelectorAll('.sw__refine-sr').length).toBe(1);
    }
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

  it('refines 3 Cinder Ore into 1 Slag Fragment on arm-then-confirm and shows the target count climb', () => {
    const el = fixture.nativeElement as HTMLElement;
    const rows = Array.from(el.querySelectorAll<HTMLElement>('.sw__refine-row'));
    expect(rows.length).toBe(2); // cinder → slag, slag → heartstone
    const [cinderRow, slagRow] = rows;
    expect(cinderRow.textContent).toContain('Cinder Ore');
    expect(cinderRow.textContent).toContain('Slag Fragment');

    const target = () => cinderRow.querySelector('[data-refine-target]')?.textContent?.trim();
    expect(target()).toBe('×0');

    const button = cinderRow.querySelector('.sw__refine-btn') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.textContent?.trim()).toBe('Refine ×1');
    // Slag row: 0 held → disabled with the reason spelled out, and only ×1 on offer.
    const slagButton = slagRow.querySelector('.sw__refine-btn') as HTMLButtonElement;
    expect(slagButton.disabled).toBe(true);
    expect(slagRow.textContent).toContain('Needs 3 Slag Fragment');
    const slagChoices = Array.from(slagRow.querySelectorAll<HTMLButtonElement>('.sw__choice'));
    expect(slagChoices.map(c => c.disabled)).toEqual([false, true, true]);
    // Cinder row holds 4: ×1 and Max ×1 are live, ×5 is not.
    const cinderChoices = Array.from(cinderRow.querySelectorAll<HTMLButtonElement>('.sw__choice'));
    expect(cinderChoices.map(c => `${c.textContent?.trim()}:${c.disabled ? 'off' : 'on'}`)).toEqual(['×1:on', '×5:off', 'Max ×1:on']);

    // First click arms — nothing written yet.
    button.click();
    fixture.detectChanges();
    expect(refineCalls.length).toBe(0);
    expect(button.classList.contains('sw__refine-btn--armed')).toBe(true);
    expect(button.textContent?.trim()).toBe('Refine 3 Cinder Ore → 1 Slag Fragment?');
    expect(target()).toBe('×0');

    // Second click confirms — one call, one batch, fresh mutation id.
    button.click();
    fixture.detectChanges();
    expect(refineCalls.length).toBe(1);
    expect(refineCalls[0].from).toBe('cinder-ore');
    expect(refineCalls[0].batches).toBe(1);
    expect(refineCalls[0].id.length).toBeGreaterThan(8);
    expect(target()).toBe('×1');
    expect(cinderRow.textContent).toContain('Cinder Ore −3 · Slag Fragment +1 · held ×1');
    expect(button.classList.contains('sw__refine-btn--armed')).toBe(false);
    // 1 Cinder left: the button falls back to disabled with its reason.
    expect(button.disabled).toBe(true);
    expect(cinderRow.textContent).toContain('Needs 3 Cinder Ore · held ×1');
    // The mine panel's own held figure follows the same source.
    expect(el.textContent).not.toContain('Craft');
  });

  it('offers ×5 and Max only when the stack can fund them, and disarms on a choice change', () => {
    held = { 'cinder-ore': 16 };
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cinderRow = el.querySelector('.sw__refine-row') as HTMLElement;
    // Force a held refresh the way the real snapshot$ would.
    (fixture.componentInstance as unknown as { refreshHeld(): void }).refreshHeld();
    fixture.detectChanges();
    const choices = Array.from(cinderRow.querySelectorAll<HTMLButtonElement>('.sw__choice'));
    expect(choices.map(c => c.textContent?.trim())).toEqual(['×1', '×5', 'Max ×5']);
    expect(choices.every(c => !c.disabled)).toBe(true);

    const button = cinderRow.querySelector('.sw__refine-btn') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(button.classList.contains('sw__refine-btn--armed')).toBe(true);

    choices[1].click(); // ×5
    fixture.detectChanges();
    expect(button.classList.contains('sw__refine-btn--armed')).toBe(false);
    expect(button.textContent?.trim()).toBe('Refine ×5');

    button.click();
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('Refine 15 Cinder Ore → 5 Slag Fragment?');
    button.click();
    fixture.detectChanges();
    expect(refineCalls.length).toBe(1);
    expect(refineCalls[0].batches).toBe(5);
    expect(cinderRow.querySelector('[data-refine-target]')?.textContent?.trim()).toBe('×5');
    // 1 Cinder left: the ×5 pick can no longer be funded, so the control falls back to ×1.
    expect(button.textContent?.trim()).toBe('Refine ×1');
    expect(button.disabled).toBe(true);
  });

  it('keeps refine floaters on the row that refined — the shared Slag Fragment tier never bleeds into its neighbour', fakeAsync(() => {
    // Slag Fragment is the target of cinder→slag AND the source of slag→heartstone.
    // A floater keyed by ore id alone would rise on both rows at once (wrong
    // colour on one of them); it must be scoped to the row + figure instead.
    held = { 'cinder-ore': 4, 'slag-fragment': 3 };
    (fixture.componentInstance as unknown as { refreshHeld(): void }).refreshHeld();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const [cinderRow, slagRow] = Array.from(el.querySelectorAll<HTMLElement>('.sw__refine-row'));
    const figures = (row: HTMLElement) => Array.from(row.querySelectorAll<HTMLElement>('.sw__refine-pair > figure'));
    const floats = (fig: HTMLElement) =>
      Array.from(fig.querySelectorAll<HTMLElement>('.sw__float')).map(f => `${f.textContent?.trim()}${f.classList.contains('sw__float--spent') ? ':spent' : ':gain'}`);
    const striking = (row: HTMLElement) => figures(row).map(f => f.classList.contains('is-striking'));

    // Refine slag → heartstone: only the slag row's two figures react.
    const slagButton = slagRow.querySelector('.sw__refine-btn') as HTMLButtonElement;
    expect(slagButton.disabled).toBe(false);
    slagButton.click();
    fixture.detectChanges();
    slagButton.click();
    fixture.detectChanges();
    expect(refineCalls.map(c => c.from)).toEqual(['slag-fragment']);
    const [slagSource, slagTarget] = figures(slagRow);
    expect(floats(slagSource)).toEqual(['−3:spent']);
    expect(floats(slagTarget)).toEqual(['+1:gain']);
    expect(striking(slagRow)).toEqual([true, true]);
    // The cinder row's Slag Fragment figure is the same ore id — it must stay quiet.
    expect(figures(cinderRow).flatMap(floats)).toEqual([]);
    expect(striking(cinderRow)).toEqual([false, false]);

    tick(1000); // floaters dissolve
    fixture.detectChanges();
    expect(figures(slagRow).flatMap(floats)).toEqual([]);
    expect(striking(slagRow)).toEqual([false, false]);

    // Refine cinder → slag: only the cinder row's two figures react.
    const cinderButton = cinderRow.querySelector('.sw__refine-btn') as HTMLButtonElement;
    cinderButton.click();
    fixture.detectChanges();
    cinderButton.click();
    fixture.detectChanges();
    expect(refineCalls.map(c => c.from)).toEqual(['slag-fragment', 'cinder-ore']);
    const [cinderSource, cinderTarget] = figures(cinderRow);
    expect(floats(cinderSource)).toEqual(['−3:spent']);
    expect(floats(cinderTarget)).toEqual(['+1:gain']);
    expect(striking(cinderRow)).toEqual([true, true]);
    // The slag row's source figure is the same ore id — no red '+1' there.
    expect(figures(slagRow).flatMap(floats)).toEqual([]);
    expect(striking(slagRow)).toEqual([false, false]);

    tick(1000);
    fixture.detectChanges();
    expect(el.querySelectorAll('.sw__float').length).toBe(0);
  }));
});
