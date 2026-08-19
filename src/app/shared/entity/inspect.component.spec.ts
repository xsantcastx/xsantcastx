import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { TranslationService } from '../../translation.service';
import { ForgeAudioService } from '../economy/forge-audio.service';
import { InventoryService } from '../rpg/inventory.service';
import { RUNE_TIERS } from '../rune-forge/rune.model';
import { InspectComponent } from './inspect.component';
import { InspectService } from './inspect.service';

describe('InspectComponent', () => {
  let fixture: ComponentFixture<InspectComponent>;
  let inspect: InspectService;
  let i18n: TranslationService;
  let router: Router;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InspectComponent,
        RouterTestingModule.withRoutes([{ path: '', component: InspectComponent }]),
      ],
      providers: [TranslationService, InspectService],
    }).compileComponents();

    i18n = TestBed.inject(TranslationService);
    i18n.setLanguage('en');
    inspect = TestBed.inject(InspectService);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture = TestBed.createComponent(InspectComponent);
    fixture.detectChanges();
    inspect.start();
    root = fixture.nativeElement as HTMLElement;
  });

  async function open(type: string, id: string): Promise<void> {
    inspect.open({ type: type as 'rune', id });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders a ready rune with exact worth and no bubble copy', async () => {
    await open('rune', 'ash');
    expect(root.querySelector('#qi-title')?.textContent?.trim()).toBe('Ash');
    expect(root.textContent).toContain('Worth');
    expect(root.querySelector('.qi__facts')?.textContent).toContain('Gold');
    expect(root.textContent).not.toMatch(/bubble/i);
  });

  it('shows a missing state for unknown records', async () => {
    await open('item', 'ghost-item');
    expect(root.querySelector('#qi-title')?.textContent?.trim()).toBe('Record unavailable');
    expect(root.textContent).toContain('unavailable');
  });

  it('translates chrome to Spanish without rewriting lore', async () => {
    i18n.setLanguage('es');
    await open('realm', 'luminous');
    expect(root.querySelector('.qi__close')?.textContent?.trim()).toBe('Cerrar');
    expect(root.textContent).toContain('Heliograph Court');
    expect(root.textContent).not.toMatch(/burbuja|bubble/i);
  });

  it('traps focus inside the dialog and restores the trigger on close', async () => {
    const trigger = document.createElement('button');
    trigger.id = 'qi-trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    inspect.open({ type: 'quest', id: 'forge-three-shadows' }, { trigger });
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = root.querySelector('.qi') as HTMLElement;
    expect(dialog).toBeTruthy();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    fixture.nativeElement.dispatchEvent(tab);

    inspect.close();
    fixture.detectChanges();
    document.body.removeChild(trigger);
  });

  it('keeps Shift+Tab from the focused title inside the dialog', async () => {
    await open('rune', 'ash');
    const title = root.querySelector('#qi-title') as HTMLElement;
    const close = root.querySelector('.qi__close') as HTMLElement;
    const shell = root.querySelector('.qi-root') as HTMLElement;
    title.focus();
    expect(document.activeElement).toBe(title);

    const shiftTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    shell.dispatchEvent(shiftTab);
    expect(document.activeElement).toBe(close);
    expect(document.activeElement?.closest('.qi')).toBeTruthy();
  });

  it('redraws an already-open panel when the language changes', async () => {
    await open('rune', 'ash');
    expect(root.querySelector('.qi__kind')?.textContent?.trim()).toBe('Rune');
    expect(root.querySelector('.qi__close')?.textContent?.trim()).toBe('Close');

    i18n.setLanguage('es');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('.qi__kind')?.textContent?.trim()).toBe('Runa');
    expect(root.querySelector('.qi__close')?.textContent?.trim()).toBe('Cerrar');
    expect(root.querySelector('#qi-title')?.textContent?.trim()).toBe('Ash');
  });
});

/**
 * Temper feedback. Everything is a spy on the real services — no ledger is
 * seeded, so nothing here depends on the era stamp or on Firebase being
 * reachable. `snapshot` is spied for the resolver (it reads `snapshot.items`)
 * and for `equippedTotals`; `itemById` for the component; `temper` for the
 * result shape the panel turns into feedback.
 */
describe('InspectComponent temper feedback', () => {
  let fixture: ComponentFixture<InspectComponent>;
  let inspect: InspectService;
  let inventory: InventoryService;
  let audio: ForgeAudioService;
  let i18n: TranslationService;
  let root: HTMLElement;
  let current: any;

  const totals = { goldPerSec: 0, magicFind: 0, xpBonus: 0, lootBonus: 0, strikePower: 0, ward: 0 };
  const basalt = (over: Record<string, unknown> = {}) => ({
    id: 'i1', name: 'Basalt Edge', type: 'artifact', rarity: 'rare', definitionId: 'basalt-edge',
    stats: { goldPerSec: 1.3, strikePower: 2 },
    sellValue: 0, equipped: false, foundAt: '2026-01-01T00:00:00.000Z', soulbound: true,
    upgradeLevel: 0,
    ...over,
  }) as any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InspectComponent,
        RouterTestingModule.withRoutes([{ path: '', component: InspectComponent }]),
      ],
      providers: [TranslationService, InspectService],
    }).compileComponents();

    i18n = TestBed.inject(TranslationService);
    i18n.setLanguage('en');
    inspect = TestBed.inject(InspectService);
    inventory = TestBed.inject(InventoryService);
    audio = TestBed.inject(ForgeAudioService);
    current = basalt();
    spyOn(inventory, 'init');
    spyOnProperty(inventory, 'snapshot', 'get').and.callFake(() => ({
      items: [current], bag: [current], stacks: [], equipped: {}, totals,
      goldFromSales: 0, sold: 0, usedRows: 1, full: false,
    }) as any);
    spyOn(inventory, 'itemById').and.callFake((id: string) => (id === current.id ? current : undefined));
    spyOn(inventory, 'canUpgrade').and.returnValue(true);
    spyOn(audio, 'strike');
    spyOn(audio, 'runeReveal');

    await TestBed.inject(Router).navigateByUrl('/');
    fixture = TestBed.createComponent(InspectComponent);
    fixture.detectChanges();
    inspect.start();
    root = fixture.nativeElement as HTMLElement;
    inspect.open({ type: 'item', id: 'i1' });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function stubTemper(after: any, leveled: boolean): jasmine.Spy {
    return spyOn(inventory, 'temper').and.callFake(() => {
      current = after;
      return { ok: true, item: after, replayed: false, leveled } as any;
    });
  }

  function clickTemper(): void {
    const btn = root.querySelector('.qi__temper .qi__btn') as HTMLButtonElement;
    expect(btn).withContext('temper button present').toBeTruthy();
    btn.click();
    fixture.detectChanges();
  }

  it('lists what changed, lights the block and rings twice on a success', () => {
    stubTemper(basalt({ stats: { goldPerSec: 1.3, strikePower: 2.12 }, upgradeLevel: 1 }), true);
    clickTemper();

    const rows = root.querySelectorAll('.qi__delta');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Strike');
    expect(rows[0].textContent).toContain('2 → 2.12');
    expect(rows[0].textContent).toContain('+0.12');
    expect(root.querySelector('.qi__temper--ok')).toBeTruthy();
    expect(root.querySelector('.qi__temper-note--ok')?.textContent).toContain('Temper 1');
    expect(root.querySelector('.qi__temper-max')).toBeNull();
    // Odds and cost line still there — the preview re-renders as before.
    expect(root.querySelector('.qi__temper-cost')).toBeTruthy();
    expect(audio.strike).toHaveBeenCalledWith(RUNE_TIERS.rare.semitones);
    expect(audio.runeReveal).toHaveBeenCalledWith(RUNE_TIERS.rare.semitones, false);
  });

  it('states a failure calmly, keeps the odds line, and plays only the strike', () => {
    stubTemper(basalt({ lastUpgradeOk: false }), false);
    clickTemper();

    expect(root.querySelectorAll('.qi__delta').length).toBe(0);
    expect(root.querySelector('.qi__temper--ok')).toBeNull();
    const note = root.querySelector('.qi__temper-note')?.textContent ?? '';
    expect(note).toContain('intact');
    expect(note).not.toMatch(/so close|almost|one more/i);
    expect(root.querySelector('.qi__temper-cost')).toBeTruthy();
    expect(audio.strike).toHaveBeenCalledTimes(1);
    expect(audio.runeReveal).not.toHaveBeenCalled();
  });

  it('keeps the block up with a fully-tempered line when the final temper lands', () => {
    // basalt-edge's definition caps at 10; landing there makes previewUpgrade null.
    stubTemper(basalt({ stats: { goldPerSec: 1.41, strikePower: 2.2 }, upgradeLevel: 10 }), true);
    clickTemper();

    expect(root.querySelector('.qi__temper')).withContext('block survives max level').toBeTruthy();
    expect(root.querySelector('.qi__temper-cost')).withContext('no next-level cost at max').toBeNull();
    expect(root.querySelector('.qi__temper-max')?.textContent).toContain('10 / 10');
    expect(root.querySelectorAll('.qi__delta').length).toBe(2);
    expect(root.querySelector('.qi__temper--ok')).toBeTruthy();
    expect(audio.runeReveal).toHaveBeenCalledWith(RUNE_TIERS.rare.semitones, false);
  });

  it('turns heavy at epic', () => {
    current = basalt({ rarity: 'epic' });
    stubTemper(basalt({ rarity: 'epic', stats: { goldPerSec: 1.3, strikePower: 2.12 }, upgradeLevel: 1 }), true);
    clickTemper();
    expect(audio.strike).toHaveBeenCalledWith(RUNE_TIERS.epic.semitones);
    expect(audio.runeReveal).toHaveBeenCalledWith(RUNE_TIERS.epic.semitones, true);
  });

  it('says blocked without touching audio when the writer refuses', () => {
    spyOn(inventory, 'temper').and.returnValue({ ok: false, code: 'funds' } as any);
    clickTemper();
    expect(root.querySelector('.qi__temper-note')?.textContent).toContain('Need more Gold');
    expect(audio.strike).not.toHaveBeenCalled();
    expect(audio.runeReveal).not.toHaveBeenCalled();
  });

  it('re-creates the outcome block on a second success so the light-up runs again', () => {
    const spy = stubTemper(basalt({ stats: { goldPerSec: 1.3, strikePower: 2.12 }, upgradeLevel: 1 }), true);
    clickTemper();
    const first = root.querySelector('.qi__temper-outcome');
    spy.and.callFake(() => {
      current = basalt({ stats: { goldPerSec: 1.3, strikePower: 2.25 }, upgradeLevel: 2 });
      return { ok: true, item: current, replayed: false, leveled: true } as any;
    });
    clickTemper();
    const second = root.querySelector('.qi__temper-outcome');
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect(root.querySelector('.qi__delta')?.textContent).toContain('+0.13');
  });

  it('speaks Spanish for the calm fail line', () => {
    i18n.setLanguage('es');
    fixture.detectChanges();
    stubTemper(basalt({ lastUpgradeOk: false }), false);
    clickTemper();
    expect(root.querySelector('.qi__temper-note')?.textContent).toContain('intacta');
  });
});
