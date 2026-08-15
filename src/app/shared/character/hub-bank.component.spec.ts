import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { HubBankComponent } from './hub-bank.component';
import { CharacterHubService } from './character-hub.service';
import { InventoryService, type InventorySnapshot } from '../rpg/inventory.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { TranslationService } from '../../translation.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { ActivatedRoute } from '@angular/router';
import { RUNES } from '../rune-forge/rune.model';

function snap(quantity: number, extra: InventorySnapshot['stacks'] = []): InventorySnapshot {
  return {
    items: [],
    bag: [],
    stacks: [{ id: 'stack-cinder', stackKey: 'cinder-ore', quantity }, ...extra],
    equipped: {},
    totals: { goldPerSec: 0, magicFind: 0, xpBonus: 0, lootBonus: 0, strikePower: 0, ward: 0 },
    goldFromSales: 0,
    sold: 0,
    usedRows: 1 + extra.length,
    full: false,
  };
}

describe('HubBankComponent', () => {
  let fixture: ComponentFixture<HubBankComponent>;
  let inv$: BehaviorSubject<InventorySnapshot>;
  const store = new Map<string, string>();

  beforeEach(async () => {
    const runeId = RUNES[0].id;
    inv$ = new BehaviorSubject(snap(3));
    store.clear();
    await TestBed.configureTestingModule({
      imports: [HubBankComponent],
      providers: [
        CharacterHubService,
        { provide: TranslationService, useValue: { translate: (key: string, vars?: Record<string, string | number>) => {
          if (key === 'hub.bank.new') return 'NEW';
          if (key === 'hub.bank.rare') return 'RARE';
          if (key === 'hub.bank.gain') return `+${vars?.['n'] ?? ''}`;
          return key;
        } } },
        { provide: ActivatedRoute, useValue: { queryParamMap: of({ get: () => null }) } },
        {
          provide: GameStateGateway,
          useValue: {
            readRaw: (key: string) => store.get(key) ?? null,
            writeRaw: (key: string, raw: string) => { store.set(key, raw); },
          },
        },
        {
          provide: InventoryService,
          useValue: {
            init: () => undefined,
            snapshot: inv$.value,
            snapshot$: inv$.asObservable(),
            canDrop: () => true,
            needsConfirm: () => false,
            drop: () => true,
            dropStack: () => true,
            dropMany: () => 0,
          },
        },
        {
          provide: RuneForgeService,
          useValue: {
            init: () => undefined,
            snapshot: { held: { [runeId]: 2 }, crafted: [] },
            snapshot$: of({ held: { [runeId]: 2 }, crafted: [] }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HubBankComponent);
    fixture.detectChanges();
  });

  it('shows material stacks and rune ledger rows together', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Cinder Ore');
    expect(text).toContain(RUNES[0].name);
    expect(text).toContain('×3');
    expect(text).toContain('×2');
  });

  it('keeps Drop on the tile so a full bag does not hide the action', () => {
    const drop = [...fixture.nativeElement.querySelectorAll('button')]
      .find((el: HTMLButtonElement) => el.textContent?.includes('loadout.drop'));
    expect(drop).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.hb__manage')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.hb__confirm')).toBeNull();
  });

  it('updates stack counts in place and marks a new rare ember', () => {
    expect(fixture.nativeElement.textContent).not.toContain('+1');
    inv$.next(snap(4, [{ id: 'stack-ember', stackKey: 'ember-residue', quantity: 1 }]));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('×4');
    expect(text).toContain('+1');
    expect(text).toContain('Ember Residue');
    expect(text).toContain('NEW');
    expect(text).toContain('RARE');
    expect(fixture.nativeElement.querySelector('.hb__tile.is-fresh')).toBeTruthy();
  });
});
