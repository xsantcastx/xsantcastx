/**
 * item-hands.spec.ts — one and two hands, the same everywhere (item-hands.ts): the table by weapon family, the card's
 * word, every equip path through InventoryService (the satchel's Equip, the compare card's, the paper doll's drag and
 * picker, a Vault piece taken out and worn — all call `equip`), the class kits' hands, the painter's off-hand, the
 * old-save mend on load, and the fight's multiplier.
 */
import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { INVENTORY_KEY, InventoryService, MAX_INVENTORY } from './inventory.service';
import type { GameItem } from './item.model';
import { BASE_HANDS, TWO_HAND_MULT, handsDisplaced, handsOf, isTwoHanded, mendHands } from './item-hands';
import { ITEM_DEFINITIONS } from './item-definition';
import { itemBase } from './item-base';
import { emptyInventoryLedger, itemToRecord } from './inventory-ops';
import { KIT_HANDS, vocationLook } from '../keeper-look/vocation-look';
import { pieceTwoHanded } from '../keeper-look/keeper-gear';
import { wornGear } from '../keeper-look/worn-gear';
import { weaponSwing, FISTS } from '../../play/td/td-melee';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function configure(memory: MemoryGateway): InventoryService {
  TestBed.configureTestingModule({
    providers: [InventoryService, EconomyService, LocalSaveRegistry, { provide: GameStateGateway, useValue: memory }],
  });
  const inventory = TestBed.inject(InventoryService);
  inventory.init();
  return inventory;
}

function piece(id: string, definitionId: string, name: string, extra: Partial<GameItem> = {}): GameItem {
  return {
    id, name, definitionId, type: 'artifact', rarity: 'rare', stats: { strikePower: 1 }, sellValue: 10,
    equipped: false, foundAt: '2026-10-21T00:00:00.000Z', soulbound: false, ...extra,
  };
}
const bow = (id = 'bow') => piece(id, 'meridian-longbow', 'Meridian Longbow');
const crossbow = (id = 'xbow') => piece(id, 'warden-crossbow', 'Canopy Warden\'s Crossbow');
const quiver = (id = 'quiver') => piece(id, 'warden-quiver', 'Canopy Warden\'s Quiver', { stats: { ward: 1 } });
const shield = (id = 'shield') => piece(id, 'rootwall-shield', 'Rootwall Shield', { stats: { ward: 1 } });
const sword = (id = 'sword') => piece(id, 'eclipse-edge', 'Eclipse Edge');

describe('item-hands: the table', () => {
  it('two hands: bows, staves, greatswords, war-hammers, polearms; one: crossbows, swords, axes, maces, wands, daggers', () => {
    expect(BASE_HANDS).toEqual(jasmine.objectContaining({ bow: 2, staff: 2, greatsword: 2, hammer: 2, spear: 2 }));
    expect(BASE_HANDS).toEqual(jasmine.objectContaining({ crossbow: 1, sword: 1, axe: 1, mace: 1, wand: 1, dagger: 1 }));
  });

  it('every authored weapon has a handedness, and armour and off-hands have none', () => {
    for (const def of ITEM_DEFINITIONS) {
      if (def.family !== 'equipment') continue;
      const hands = handsOf({ definitionId: def.id, name: def.name, type: def.type });
      if (def.slot === 'weapon') expect(hands).withContext(def.id).not.toBeNull();
      else expect(hands).withContext(def.id).toBeNull();
    }
  });

  it('reads the real bases: the longbow, the staff, the maul, the halberd are two-handed; the crossbows and the wand one', () => {
    const of = (id: string) => { const d = ITEM_DEFINITIONS.find(x => x.id === id)!; return handsOf({ definitionId: d.id, name: d.name, type: d.type }); };
    expect(of('meridian-longbow')).toBe(2);
    expect(of('nullthorn-staff')).toBe(2);
    expect(of('starfall-maul')).toBe(2);
    expect(of('radiant-halberd')).toBe(2);
    expect(of('dawnrender')).toBe(2);
    expect(of('spinerift-crossbow')).toBe(1);
    expect(of('warden-crossbow')).toBe(1);
    expect(of('cinderlatch-crossbow')).toBe(1);
    expect(of('pyreclast-wand')).toBe(1);
    expect(of('rootbreaker-mace')).toBe(1);
    expect(of('warden-quiver')).toBeNull();
  });

  it('crossbows are a family of three bases, each with its icon base', () => {
    const xbows = ITEM_DEFINITIONS.filter(d => d.slot === 'weapon' && itemBase({ definitionId: d.id, name: d.name, type: d.type }) === 'crossbow');
    expect(xbows.map(d => d.id).sort()).toEqual(['cinderlatch-crossbow', 'spinerift-crossbow', 'warden-crossbow']);
  });

  it('says what a swap moves: a two-handed weapon takes the off-hand, an off-hand takes a two-handed weapon', () => {
    expect(handsDisplaced(bow(), 'weapon', { 'off-hand': shield() }).map(i => i.id)).toEqual(['shield']);
    expect(handsDisplaced(crossbow(), 'weapon', { 'off-hand': quiver() })).toEqual([]);
    expect(handsDisplaced(quiver(), 'off-hand', { weapon: bow() }).map(i => i.id)).toEqual(['bow']);
    expect(handsDisplaced(quiver(), 'off-hand', { weapon: crossbow() })).toEqual([]);
  });
});

describe('item-hands: every equip path (InventoryService.equip)', () => {
  let memory: MemoryGateway;
  let inventory: InventoryService;
  beforeEach(() => { memory = new MemoryGateway(); inventory = configure(memory); });

  it('wearing a two-handed bow sends the worn off-hand to the satchel', () => {
    inventory.add(sword()); inventory.add(shield()); inventory.add(bow());
    expect(inventory.equip('sword')).toBe(true);
    expect(inventory.equip('shield')).toBe(true);
    expect(inventory.equip('bow')).toBe(true);
    expect(inventory.snapshot.equipped['weapon']?.id).toBe('bow');
    expect(inventory.snapshot.equipped['off-hand']).toBeUndefined();
    expect(inventory.snapshot.bag.map(i => i.id).sort()).toEqual(['shield', 'sword']);
    expect(inventory.offHandBlocked).toBe(true);
  });

  it('putting an off-hand on beside a two-handed weapon sends the weapon to the satchel', () => {
    inventory.add(bow()); inventory.add(quiver());
    expect(inventory.equip('bow')).toBe(true);
    expect(inventory.equip('quiver', 'off-hand')).toBe(true);
    expect(inventory.snapshot.equipped['weapon']).toBeUndefined();
    expect(inventory.snapshot.equipped['off-hand']?.id).toBe('quiver');
    expect(inventory.snapshot.bag.some(i => i.id === 'bow')).toBe(true);
  });

  it('a one-handed crossbow and a quiver are worn together', () => {
    inventory.add(crossbow()); inventory.add(quiver());
    expect(inventory.equip('xbow')).toBe(true);
    expect(inventory.equip('quiver')).toBe(true);
    expect(inventory.snapshot.equipped['weapon']?.id).toBe('xbow');
    expect(inventory.snapshot.equipped['off-hand']?.id).toBe('quiver');
    expect(inventory.offHandBlocked).toBe(false);
  });

  it('refuses with a reason when the satchel has no room for what the other hand holds', () => {
    inventory.add(sword()); inventory.add(shield()); inventory.add(bow());
    expect(inventory.equip('sword')).toBe(true);
    expect(inventory.equip('shield')).toBe(true);
    // Fill the grid to the brim (distinct names: nothing piles).
    const fill = (i: number) => ({ id: `fill-${i}`, name: `Fill ${i}`, type: 'artifact' as const, rarity: 'common' as const, stats: {}, sellValue: 1, equipped: false, foundAt: '2026-08-01T00:00:00.000Z', soulbound: false });
    for (let i = 0; inventory.canPickUp(fill(i)) && i < MAX_INVENTORY; i++) inventory.add(fill(i));
    expect(inventory.snapshot.held).toBe(0);
    expect(inventory.snapshot.bag.some(i => i.id === 'bow')).toBe(true);
    // The bow leaves the grid (6 cells), the sword (3) and the shield (4) come back: one cell too many.
    expect(inventory.equip('bow')).toBe(false);
    expect(inventory.equipRefusal).toBe('hands-full');
    expect(inventory.snapshot.equipped['weapon']?.id).toBe('sword');
    expect(inventory.snapshot.equipped['off-hand']?.id).toBe('shield');
  });

  it('a Vault piece is taken out to the satchel, then worn by the same rule', () => {
    inventory.add(shield()); inventory.add(bow());
    expect(inventory.equip('shield')).toBe(true);
    inventory.setAtVault(true);
    expect(inventory.moveTo({ kind: 'instance', ids: ['bow'] }, { container: 'general-1', cell: 0 })).toBe('ok');
    expect(inventory.equip('bow')).toBe(false); // still in the Vault: never worn from there
    expect(inventory.moveTo({ kind: 'instance', ids: ['bow'] }, { container: 'b', cell: 8 })).toBe('ok');
    inventory.setAtVault(false);
    expect(inventory.equip('bow')).toBe(true);
    expect(inventory.snapshot.equipped['off-hand']).toBeUndefined();
  });

  it('a two-handed class kit (the hunting bow) keeps the off-hand shut until a one-handed weapon is worn', () => {
    inventory.setKitHands(2);
    inventory.add(quiver()); inventory.add(crossbow());
    expect(inventory.offHandBlocked).toBe(true);
    expect(inventory.equip('quiver')).toBe(false);
    expect(inventory.equipRefusal).toBe('kit-hands');
    expect(inventory.equip('xbow')).toBe(true);
    expect(inventory.equip('quiver')).toBe(true);
    // Taking the crossbow off puts the kit's bow back in hand: the quiver comes off too.
    expect(inventory.unequip('xbow')).toBe(true);
    expect(inventory.snapshot.equipped['off-hand']).toBeUndefined();
    expect(inventory.snapshot.bag.some(i => i.id === 'quiver')).toBe(true);
  });

  it('setting a two-handed kit mends a save that wears an off-hand with no weapon', () => {
    inventory.add(shield());
    expect(inventory.equip('shield')).toBe(true);
    inventory.setKitHands(2);
    expect(inventory.snapshot.equipped['off-hand']).toBeUndefined();
    expect(inventory.snapshot.bag.some(i => i.id === 'shield')).toBe(true);
    inventory.setKitHands(1);
    expect(inventory.equip('shield')).toBe(true);
  });
});

describe('item-hands: an old save wearing a two-handed weapon and an off-hand', () => {
  it('mendHands moves the off-hand to the satchel, and leaves a one-handed pair alone', () => {
    let ledger = emptyInventoryLedger();
    const add = (item: GameItem, slot: 'weapon' | 'off-hand') => {
      ledger = { ...ledger, records: [...ledger.records, { ...itemToRecord({ ...item, equipped: true, slot }), location: { kind: 'equipped', slotId: slot } }] };
    };
    add(bow(), 'weapon'); add(shield(), 'off-hand');
    const mended = mendHands(ledger, 'spec', 1);
    const where = (l: typeof ledger, id: string) => l.records.find(r => r.id === id && r.kind === 'instance') as { location: { kind: string } } | undefined;
    expect(where(mended, 'shield')?.location.kind).toBe('bag');
    expect(where(mended, 'bow')?.location.kind).toBe('equipped');

    let pair = emptyInventoryLedger();
    pair = { ...pair, records: [{ ...itemToRecord({ ...crossbow(), equipped: true, slot: 'weapon' }), location: { kind: 'equipped', slotId: 'weapon' } }, { ...itemToRecord({ ...quiver(), equipped: true, slot: 'off-hand' }), location: { kind: 'equipped', slotId: 'off-hand' } }] };
    expect(mendHands(pair, 'spec', 1)).toBe(pair);
  });

  it('the load through the save gateway mends it and writes it back', () => {
    const memory = new MemoryGateway();
    memory.writeRaw(INVENTORY_KEY, JSON.stringify({
      version: 1, goldFromSales: 0, sold: 0,
      items: [{ ...bow(), equipped: true, slot: 'weapon' }, { ...shield(), equipped: true, slot: 'off-hand' }],
    }));
    const inventory = configure(memory);
    expect(inventory.snapshot.equipped['weapon']?.id).toBe('bow');
    expect(inventory.snapshot.equipped['off-hand']).toBeUndefined();
    expect(inventory.snapshot.bag.some(i => i.id === 'shield')).toBe(true);
    // Written back through the gateway: the next load reads it mended.
    expect(memory.readRaw(INVENTORY_KEY)).toContain('shield');
    const again = JSON.parse(memory.readRaw(INVENTORY_KEY)!);
    const row = (again.records as { id: string; location: { kind: string } }[]).find(r => r.id === 'shield');
    expect(row?.location.kind).toBe('bag');
  });
});

describe('item-hands: the class kits and the painter', () => {
  it('the Thornstrider and the Lanternwright carry two-handed kits; the Ashguard and the Warlock one hand', () => {
    expect(KIT_HANDS).toEqual({ warlock: 1, ashguard: 1, lanternwright: 2, thornstrider: 2 });
  });

  it('the Thornstrider never shows a shield: his kit bow takes both hands', () => {
    const look = vocationLook('thornstrider', null);
    expect(look.gear?.weapon?.kind).toBe('bow');
    expect(pieceTwoHanded(look.gear?.weapon)).toBe(true);
    expect(look.gear?.['off-hand']).toBeUndefined();
    // Even an old save's worn shield is not drawn beside the bow.
    const old = vocationLook('thornstrider', wornGear({ 'off-hand': { ...shield(), equipped: true, slot: 'off-hand' } }));
    expect(old.gear?.['off-hand']).toBeUndefined();
  });

  it('a Thornstrider with a crossbow and a quiver: the crossbow in hand, the quiver on the back', () => {
    const look = vocationLook('thornstrider', wornGear({ weapon: { ...crossbow(), equipped: true, slot: 'weapon' }, 'off-hand': { ...quiver(), equipped: true, slot: 'off-hand' } }));
    expect(look.gear?.weapon?.kind).toBe('crossbow');
    expect(look.gear?.weapon?.hands).toBe(1);
    expect(look.gear?.['off-hand']).toBeUndefined();
    expect(look.garb?.quiver).toBeTruthy();
  });

  it('the Ashguard: a sword and the kit shield; a greatsword leaves no hand for the shield', () => {
    const kit = vocationLook('ashguard', null);
    expect(kit.gear?.weapon?.kind).toBe('sword');
    expect(kit.gear?.['off-hand']?.kind).toBe('shield');
    const great = vocationLook('ashguard', wornGear({ weapon: { ...piece('gs', 'dawnrender', 'Dawnrender'), equipped: true, slot: 'weapon' } }));
    expect(great.gear?.weapon?.hands).toBe(2);
    expect(great.gear?.['off-hand']).toBeUndefined();
  });

  it('the Lanternwright: the lamp-staff in two hands; a wand leaves the lantern to the off-hand', () => {
    const kit = vocationLook('lanternwright', null);
    expect(kit.gear?.weapon?.variant).toBe('lamp');
    expect(kit.gear?.['off-hand']).toBeUndefined();
    const wand = vocationLook('lanternwright', wornGear({ weapon: { ...piece('w', 'pyreclast-wand', 'Pyreclast Wand'), equipped: true, slot: 'weapon' } }));
    expect(wand.gear?.weapon?.kind).toBe('wand');
    expect(wand.gear?.['off-hand']?.kind).toBe('lantern');
  });

  it('the Warlock: a two-handed staff, or a wand and an off-hand', () => {
    const staff = vocationLook('warlock', wornGear({ weapon: { ...piece('s', 'nullthorn-staff', 'Nullthorn Staff'), equipped: true, slot: 'weapon' } }));
    expect(pieceTwoHanded(staff.gear?.weapon)).toBe(true);
    const pair = vocationLook('warlock', wornGear({ weapon: { ...piece('w', 'pyreclast-wand', 'Pyreclast Wand'), equipped: true, slot: 'weapon' }, 'off-hand': { ...piece('t', 'unique-mourners-ledger', "Mourner's Ledger"), equipped: true, slot: 'off-hand' } }));
    expect(pair.gear?.['off-hand']?.kind).toBe('tome');
  });
});

describe('item-hands: the fight', () => {
  it('a two-handed weapon lands the basic attack TWO_HAND_MULT harder; one hand ×1; bare hands are the fists', () => {
    expect(TWO_HAND_MULT).toBeGreaterThan(1);
    expect(weaponSwing({ strikePower: 1, hands: 2 }).mult).toBe(TWO_HAND_MULT);
    expect(weaponSwing({ strikePower: 1, hands: 1 }).mult).toBe(1);
    expect(weaponSwing({ strikePower: 1 }).mult).toBe(1);
    expect(weaponSwing(null)).toBe(FISTS);
    expect(isTwoHanded(bow())).toBe(true);
    expect(isTwoHanded(crossbow())).toBe(false);
  });
});
