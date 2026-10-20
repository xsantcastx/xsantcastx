/**
 * item-requirements.spec.ts — gear asks for a level (and some bases an attribute) before it goes on.
 */
import { TestBed } from '@angular/core/testing';
import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from './inventory.service';
import { mintEquipment } from './item-definition';
import { itemRequirements, meetsRequirements, requiredLevel, unmetRequirements } from './item-requirements';

const keeper = (level: number, stats: Partial<Record<'vit' | 'ene' | 'spi' | 'agi', number>> = {}) =>
  ({ level, stats: { vit: 0, ene: 0, spi: 0, agi: 0, ...stats } });

describe('item requirements', () => {
  it('follows the curve: item level − 5, a little more for the top rarities, never above the item level', () => {
    expect(requiredLevel(undefined)).toBe(1);
    expect(requiredLevel(null)).toBe(1);
    expect(requiredLevel(1)).toBe(1);
    expect(requiredLevel(4)).toBe(1);
    expect(requiredLevel(10)).toBe(5);
    expect(requiredLevel(30)).toBe(25);
    expect(requiredLevel(30, 'rare')).toBe(25);
    expect(requiredLevel(30, 'legendary')).toBe(27);
    expect(requiredLevel(30, 'mythic')).toBe(28);
    expect(requiredLevel(30, 'singular')).toBe(29);
    expect(requiredLevel(3, 'singular')).toBe(2);
    for (let l = 1; l <= 99; l++) expect(requiredLevel(l, 'singular')).toBeLessThanOrEqual(l);
  });

  it('asks staves for Spirit, plate for Vitality, bows for Agility, robes for Energy — from required level 6', () => {
    expect(itemRequirements({ definitionId: 'nullthorn-staff', itemLevel: 30, rarity: 'rare' })).toEqual({ level: 25, attr: { key: 'spi', n: 12 } });
    expect(itemRequirements({ definitionId: 'starplate-cuirass', itemLevel: 20 }).attr).toEqual({ key: 'vit', n: 7 });
    expect(itemRequirements({ definitionId: 'meridian-longbow', itemLevel: 20 }).attr?.key).toBe('agi');
    expect(itemRequirements({ definitionId: 'voidweave-cowl', itemLevel: 20 }).attr?.key).toBe('ene');
    expect(itemRequirements({ definitionId: 'anchor-ring', itemLevel: 30 }).attr).toBeNull();
    expect(itemRequirements({ definitionId: 'nullthorn-staff', itemLevel: 8 }).attr).toBeNull();
  });

  it('lets old items (no item level) and starters be worn by anyone', () => {
    expect(itemRequirements({ definitionId: 'nullthorn-staff' })).toEqual({ level: 1, attr: null });
    expect(meetsRequirements({ definitionId: 'basalt-edge', name: 'Basalt Edge' }, keeper(1))).toBeTrue();
  });

  it('names what is missing', () => {
    const staff = { definitionId: 'nullthorn-staff', itemLevel: 30, rarity: 'rare' as const };
    expect(unmetRequirements(staff, keeper(10))).toEqual({ level: 25, attr: { key: 'spi', n: 12 } });
    expect(unmetRequirements(staff, keeper(25, { spi: 11 }))).toEqual({ level: null, attr: { key: 'spi', n: 12 } });
    expect(meetsRequirements(staff, keeper(25, { spi: 12 }))).toBeTrue();
  });
});

/** The save gateway in memory (as inventory.service.spec.ts does). */
class MemoryGateway {
  private readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

describe('InventoryService wear check', () => {
  let svc: InventoryService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InventoryService, EconomyService, LocalSaveRegistry, { provide: GameStateGateway, useValue: new MemoryGateway() }],
    });
    svc = TestBed.inject(InventoryService);
    svc.init();
  });
  afterEach(() => { svc.setWearCheck(null); TestBed.resetTestingModule(); });

  it('refuses to put on what the Keeper cannot wear yet, and never strips what is already worn', () => {
    const item = mintEquipment('astral-helm', 'rare', () => .5, '2026-10-21T00:00:00.000Z', 'req-helm', 30)!;
    expect(svc.add(item)).not.toBeNull();
    svc.setWearCheck(it => meetsRequirements(it, keeper(5)));
    expect(svc.equip(item.id)).toBeFalse();
    expect(svc.snapshot.items.find(i => i.id === item.id)?.equipped).toBeFalse();
    // With the check met it goes on; tightening the check afterwards leaves it worn.
    svc.setWearCheck(it => meetsRequirements(it, keeper(40, { vit: 99 })));
    expect(svc.equip(item.id)).toBeTrue();
    svc.setWearCheck(() => false);
    expect(svc.snapshot.items.find(i => i.id === item.id)?.equipped).toBeTrue();
  });
});
