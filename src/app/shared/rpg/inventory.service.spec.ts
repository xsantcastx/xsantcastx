import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { INVENTORY_KEY, InventoryService, MAX_INVENTORY } from './inventory.service';
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
      items: [
        charm('old-charm'),
        charm('worn', { equipped: true, slot: 'charm1' as never }),
        {
          id: 'seed-helm', name: 'Helm', type: 'artifact', rarity: 'rare',
          stats: { goldPerSec: 2 }, sellValue: 30, equipped: true, slot: 'head',
          foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
        },
      ],
      goldFromSales: 7,
      sold: 1,
    }));
    inventory = configure(memory);
  });

  it('migrates a v1 blob on load and still exposes GameItems', () => {
    expect(inventory.snapshot.items.map(row => row.id).sort()).toEqual(['old-charm', 'seed-helm', 'worn']);
    expect(Object.keys(inventory.snapshot.equipped)).not.toContain('charm1');
    expect(inventory.snapshot.bag.some(row => row.id === 'worn')).toBe(true);
    const stored = coerceInventoryLedger(JSON.parse(memory.readRaw(INVENTORY_KEY)!));
    expect(stored?.version).toBe(2);
    expect(stored?.legacyBackup?.version).toBe(1);
  });

  it('refuses to sell an equipped item and tombs a bag sale', () => {
    expect(inventory.sell('seed-helm')).toBe(0);
    expect(inventory.itemById('seed-helm')).toBeTruthy();
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

  it('retires a worn charm and refuses to equip it again', () => {
    expect(Object.keys(inventory.snapshot.equipped)).not.toContain('charm1');
    expect(inventory.snapshot.totals.goldPerSec).toBe(2);
    expect(inventory.equip('worn', 'head')).toBe(false);
    expect(inventory.snapshot.bag.some(row => row.id === 'worn')).toBe(true);
  });

  it('refuses explorer-held items and empty C5 slots', () => {
    const loaned = {
      id: 'loaned', name: 'Loaned', type: 'artifact' as const, rarity: 'rare' as const,
      stats: { goldPerSec: 1 }, sellValue: 9, equipped: false, explorerId: 'scout-1',
      foundAt: '2026-08-05T00:00:00.000Z', soulbound: false,
    };
    expect(inventory.add(loaned)?.id).toBe('loaned');
    expect(inventory.equip('loaned', 'chest')).toBe(false);
    expect(inventory.itemById('loaned')?.explorerId).toBe('scout-1');
    expect(inventory.equip('seed-helm', 'hands')).toBe(false);
    expect(inventory.equip('seed-helm', 'trinket')).toBe(false);
    expect(inventory.snapshot.equipped['head']?.id).toBe('seed-helm');
  });

  it('equips into off-hand and displaces the occupant atomically', () => {
    const helm = {
      id: 'helm', name: 'Helm', type: 'artifact' as const, rarity: 'rare' as const,
      stats: { goldPerSec: 2 }, sellValue: 20, equipped: false,
      foundAt: '2026-08-03T00:00:00.000Z', soulbound: false,
    };
    const blade = {
      ...helm, id: 'blade', name: 'Blade', stats: { goldPerSec: 3 },
    };
    expect(inventory.add(helm)?.id).toBe('helm');
    expect(inventory.equip('helm', 'head')).toBe(true);
    expect(inventory.snapshot.equipped['head']?.id).toBe('helm');
    expect(inventory.add(blade)?.id).toBe('blade');
    expect(inventory.equip('blade', 'head')).toBe(true);
    expect(inventory.snapshot.equipped['head']?.id).toBe('blade');
    expect(inventory.snapshot.bag.some(row => row.id === 'helm')).toBe(true);
  });

  it('displaces at the 250-row cap without evicting the occupant', () => {
    const fillers = MAX_INVENTORY - inventory.snapshot.items.length - 1;
    for (let i = 0; i < fillers; i++) {
      expect(inventory.add({
        id: `fill-${i}`, name: `Fill ${i}`, type: 'artifact', rarity: 'common',
        stats: {}, sellValue: 1, equipped: false,
        foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
      })).toBeTruthy();
    }
    const spare = {
      id: 'spare', name: 'Spare', type: 'artifact' as const, rarity: 'rare' as const,
      stats: {}, sellValue: 5, equipped: false,
      foundAt: '2026-08-06T00:00:00.000Z', soulbound: false,
    };
    expect(inventory.add(spare)).toBeTruthy();
    expect(inventory.snapshot.items.length).toBe(MAX_INVENTORY);
    expect(inventory.equip('spare', 'head')).toBe(true);
    expect(inventory.snapshot.equipped['head']?.id).toBe('spare');
    expect(inventory.itemById('seed-helm')).toBeTruthy();
    expect(inventory.snapshot.bag.some(row => row.id === 'seed-helm')).toBe(true);
    expect(inventory.snapshot.items.length).toBe(MAX_INVENTORY);
    const stored = coerceInventoryLedger(JSON.parse(memory.readRaw(INVENTORY_KEY)!));
    expect(stored?.tombstones.some(row => row.id === 'seed-helm')).toBe(false);
  });

  it('reverts equip when the cache write does not land', () => {
    const helm = {
      id: 'fail-helm', name: 'Fail Helm', type: 'artifact' as const, rarity: 'rare' as const,
      stats: {}, sellValue: 4, equipped: false, foundAt: '2026-08-04T00:00:00.000Z', soulbound: false,
    };
    expect(inventory.add(helm)).toBeTruthy();
    memory.write = () => { /* swallow */ };
    expect(inventory.equip('fail-helm', 'off-hand')).toBe(false);
    expect(inventory.snapshot.equipped['off-hand']).toBeUndefined();
    expect(inventory.itemById('fail-helm')?.equipped).toBe(false);
  });

  it('rolls explorer kit back when the cache write misses', () => {
    const loaned = {
      id: 'kit', name: 'Kit', type: 'artifact' as const, rarity: 'rare' as const,
      stats: {}, sellValue: 3, equipped: false,
      foundAt: '2026-08-07T00:00:00.000Z', soulbound: false,
    };
    expect(inventory.add(loaned)).toBeTruthy();
    memory.write = () => { /* swallow */ };
    expect(inventory.equipOnExplorer('kit', 'scout-1', 2)).toBe(false);
    expect(inventory.itemById('kit')?.explorerId).toBeUndefined();
  });

  it('refuses a bag-growing displace when the bag already has 250 tiles', () => {
    TestBed.resetTestingModule();
    const fills = Array.from({ length: MAX_INVENTORY }, (_, i) => ({
      id: `fill-${i}`, definitionId: `artifact:fill-${i}`, kind: 'instance' as const,
      category: 'artifacts' as const, tags: ['artifact'], rarity: 'common',
      soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 't', sequence: i + 1 }, source: 'inventory' as const,
      name: `Fill ${i}`, type: 'artifact' as const, stats: {}, sellValue: 1,
      location: { kind: 'bag' as const },
    }));
    memory.writeRaw(INVENTORY_KEY, JSON.stringify({
      version: 2,
      records: [
        ...fills,
        {
          id: 'helm', definitionId: 'artifact:helm', kind: 'instance',
          category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
          acquiredAt: '2026-08-01T00:00:00.000Z',
          revision: { hlc: 2, deviceId: 't', sequence: 1 }, source: 'inventory',
          name: 'Helm', type: 'artifact', stats: {}, sellValue: 8,
          location: { kind: 'equipped', slotId: 'head' },
        },
        {
          id: 'blade', definitionId: 'artifact:blade', kind: 'instance',
          category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
          acquiredAt: '2026-08-01T00:00:00.000Z',
          revision: { hlc: 2, deviceId: 't', sequence: 2 }, source: 'inventory',
          name: 'Blade', type: 'artifact', stats: {}, sellValue: 8,
          location: { kind: 'equipped', slotId: 'chest' },
        },
      ],
      tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 2, legacyBackup: null,
    }));
    inventory = configure(memory);
    expect(inventory.snapshot.bag.length).toBe(MAX_INVENTORY);
    expect(inventory.equip('blade', 'head')).toBe(false);
    expect(inventory.snapshot.equipped['head']?.id).toBe('helm');
    expect(inventory.snapshot.equipped['chest']?.id).toBe('blade');
    expect(inventory.itemById('helm')).toBeTruthy();
    expect(inventory.equip('fill-0', 'head')).toBe(true);
    expect(inventory.snapshot.equipped['head']?.id).toBe('fill-0');
    expect(inventory.snapshot.bag.some(row => row.id === 'helm')).toBe(true);
    expect(inventory.snapshot.bag.length).toBe(MAX_INVENTORY);
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
