import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HubBankComponent } from './hub-bank.component';
import { CharacterHubService } from './character-hub.service';
import { InventoryService } from '../rpg/inventory.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { TranslationService } from '../../translation.service';
import { ActivatedRoute } from '@angular/router';
import { RUNES } from '../rune-forge/rune.model';

describe('HubBankComponent', () => {
  let fixture: ComponentFixture<HubBankComponent>;

  beforeEach(async () => {
    const runeId = RUNES[0].id;
    await TestBed.configureTestingModule({
      imports: [HubBankComponent],
      providers: [
        CharacterHubService,
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
        { provide: ActivatedRoute, useValue: { queryParamMap: of({ get: () => null }) } },
        {
          provide: InventoryService,
          useValue: {
            init: () => undefined,
            snapshot: {
              items: [],
              bag: [],
              stacks: [{ id: 'stack-cinder', stackKey: 'cinder-ore', quantity: 3 }],
              equipped: {},
              totals: {},
              goldFromSales: 0,
              sold: 0,
              usedRows: 1,
              full: false,
            },
            snapshot$: of({
              items: [],
              bag: [],
              stacks: [{ id: 'stack-cinder', stackKey: 'cinder-ore', quantity: 3 }],
              equipped: {},
              totals: {},
              goldFromSales: 0,
              sold: 0,
              usedRows: 1,
              full: false,
            }),
            canDrop: () => true,
            needsConfirm: () => false,
            drop: () => true,
            dropStack: () => true,
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
});
