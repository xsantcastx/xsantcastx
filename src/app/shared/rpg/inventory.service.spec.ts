import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { INVENTORY_KEY, InventoryService } from './inventory.service';
import type { GameItem } from './item.model';
import { coerceInventoryLedger } from './inventory-ops';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  write(key: string, value: unknown): void {
    this.bag.set(key, JSON.stringify(value));
  }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function charm(id: string, extra: Partial<GameItem> = {}): GameItem {
  return {
    id,
    name: id,
    type: 'charm',
    rarity: 'common',
    stats: { goldPerSec: 1 },
    sellValue: 12,
    equipped: false,
    foundAt: '2026-08-01T00:00:00.000Z',
    soulbound: false,
    ...extra,
  };
}

function configure(memory: MemoryGateway): InventoryService {
  TestBed.configureTestingModule({
    providers: [
      InventoryService,
      EconomyService,
      LocalSaveRegistry,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const inventory = TestBed.inject(InventoryService);
  inventory.init();
  return inventory;
}

describe('InventoryService C3 adapter', () => {
  let memory: MemoryGateway;
  let inventory: InventoryService;

  beforeEach(() => {
    memory = new MemoryGateway();
    memory.writeRaw(INVENTORY_KEY, JSON.stringify({
      version: 1,
      items: [charm('old-charm'), charm('worn', { equipped: true, slot: 'charm1' })],
      goldFromSales: 7,
      sold: 1,
    }));
    inventory = configure(memory);
  });

  it('migrates a v1 blob on load and still exposes GameItems', () => {
    expect(inventory.snapshot.items.map(row => row.id).sort()).toEqual(['old-charm', 'worn']);
    expect(inventory.snapshot.equipped['charm1']?.id).toBe('worn');
    const stored = coerceInventoryLedger(JSON.parse(memory.readRaw(INVENTORY_KEY)!));
    expect(stored?.version).toBe(2);
    expect(stored?.legacyBackup?.version).toBe(1);
  });

  it('refuses to sell an equipped item and tombs a bag sale', () => {
    expect(inventory.sell('worn')).toBe(0);
    expect(inventory.itemById('worn')).toBeTruthy();
    const gold = inventory.sell('old-charm');
    expect(gold).toBe(12);
    expect(inventory.itemById('old-charm')).toBeUndefined();
    const stored = coerceInventoryLedger(JSON.parse(memory.readRaw(INVENTORY_KEY)!));
    expect(stored?.tombstones.some(row => row.id === 'old-charm')).toBe(true);
  });

  it('projects Economy ownership without writing it into the bag', () => {
    TestBed.resetTestingModule();
    memory.write(ECONOMY_KEY, { version: 2, artifacts: ['obsidian-heart'] });
    inventory = configure(memory);
    expect(inventory.snapshot.items.some(row => row.id.startsWith('econ:'))).toBe(false);
    expect(inventory.projectedFromEconomy().some(row => row.id === 'econ:artifact:obsidian-heart')).toBe(true);
  });

  it('reverts a sell when the cache write does not land', () => {
    const gold = TestBed.inject(EconomyService).snapshot.gold;
    memory.write = () => { /* swallow */ };
    expect(inventory.sell('old-charm')).toBe(0);
    expect(inventory.itemById('old-charm')).toBeTruthy();
    expect(TestBed.inject(EconomyService).snapshot.gold).toBe(gold);
  });

  it('keeps the v1 backup while signed out and drops it only after an attached rehydrate', () => {
    const registry = TestBed.inject(LocalSaveRegistry);
    memory.attached = false;
    registry.rehydrate(INVENTORY_KEY);
    expect(coerceInventoryLedger(JSON.parse(memory.readRaw(INVENTORY_KEY)!))?.legacyBackup).not.toBeNull();
    memory.attached = true;
    registry.rehydrate(INVENTORY_KEY);
    expect(coerceInventoryLedger(JSON.parse(memory.readRaw(INVENTORY_KEY)!))?.legacyBackup).toBeNull();
  });
});
