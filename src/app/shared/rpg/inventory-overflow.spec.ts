import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { STORAGE_CURVE } from '../economy/economy-curve';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { StorageService } from '../vault/storage.service';
import { INVENTORY_KEY, InventoryService } from './inventory.service';
import { coerceInventoryLedger, mergeInventoryLedgers, stackQuantityOf } from './inventory-ops';
import { INSTANCE_RECORD_BUDGET, SATCHEL_ROW_KEY, vaultHolder } from './inventory-layout';
import { INVENTORY_ERA, INVENTORY_STACK_OPS_MAX } from './inventory.model';
import type { GameItem } from './item.model';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  failWrites = false;
  write(key: string, value: unknown): void { if (!this.failWrites) this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function gear(id: string, extra: Partial<GameItem> = {}): GameItem {
  return {
    id, name: id, type: 'charm', rarity: 'common', stats: { goldPerSec: 1 }, rollQuality: { goldPerSec: 0.3 },
    sellValue: 12, equipped: false, foundAt: '2026-08-01T00:00:00.000Z', soulbound: false, ...extra,
  };
}

function bagRecord(id: string, i: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, definitionId: `charm:${id}`, kind: 'instance', category: 'equipment', tags: ['charm'], rarity: 'common',
    soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z', revision: { hlc: 1 + i, deviceId: 'old', sequence: 1 },
    source: 'inventory', name: id, type: 'charm', stats: { goldPerSec: 1 }, sellValue: 1, econ: 3,
    location: { kind: 'bag' }, ...extra,
  };
}

function seed(memory: MemoryGateway, records: Record<string, unknown>[]): void {
  memory.writeRaw(INVENTORY_KEY, JSON.stringify({
    version: 2, records, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0,
    hlc: records.length + 1, legacyBackup: null, era: INVENTORY_ERA,
  }));
}

function configure(memory: MemoryGateway): { inventory: InventoryService; economy: EconomyService } {
  TestBed.configureTestingModule({
    providers: [
      InventoryService, EconomyService, LocalSaveRegistry, StorageService,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const economy = TestBed.inject(EconomyService);
  economy.init();
  const inventory = TestBed.inject(InventoryService);
  inventory.init();
  return { inventory, economy };
}

function stored(memory: MemoryGateway) {
  return coerceInventoryLedger(JSON.parse(memory.readRaw(INVENTORY_KEY)!))!;
}

describe('Inventory: nothing is ever deleted for space', () => {
  let memory: MemoryGateway;

  beforeEach(() => { memory = new MemoryGateway(); });

  it('a save at 250 records keeps every new find (300 adds keep 300 records)', () => {
    seed(memory, Array.from({ length: 250 }, (_, i) => bagRecord(`old-${i}`, i)));
    const { inventory } = configure(memory);
    for (let i = 0; i < 50; i++) expect(inventory.add(gear(`new-${i}`))).toBeTruthy();
    const ledger = stored(memory);
    expect(ledger.records.filter(r => r.kind === 'instance').length).toBe(300);
    expect(ledger.tombstones.length).toBe(0);
    expect(inventory.snapshot.items.length).toBe(300);
  });

  it('grants a new stack at any record count', () => {
    seed(memory, Array.from({ length: 260 }, (_, i) => bagRecord(`old-${i}`, i)));
    const { inventory } = configure(memory);
    expect(inventory.canAcceptStackGrant('void-shard')).toBeTrue();
    expect(inventory.grantStack('g1', 'void-shard', 3)).toBeTrue();
    expect(inventory.stackOf('void-shard')).toBe(3);
  });

  it('refuses Gold purchases only at the record budget, and other arrivals still land there', () => {
    seed(memory, Array.from({ length: INSTANCE_RECORD_BUDGET }, (_, i) => bagRecord(`old-${i}`, i)));
    const { inventory } = configure(memory);
    expect(inventory.instanceRoom()).toBe(0);
    expect(inventory.canAcceptInstance()).toBeFalse();
    expect(inventory.snapshot.full).toBeTrue();
    expect(inventory.add(gear('quest-reward'))).toBeTruthy();
    expect(inventory.itemById('quest-reward')).toBeTruthy();
  });

  it('a cloud merge of two over-cap devices then a reload keeps all 500', () => {
    const a = { version: 2, records: Array.from({ length: 250 }, (_, i) => bagRecord(`a-${i}`, i)), tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 300, legacyBackup: null, era: INVENTORY_ERA };
    const b = { ...a, records: Array.from({ length: 250 }, (_, i) => bagRecord(`b-${i}`, i)) };
    memory.writeRaw(INVENTORY_KEY, JSON.stringify(mergeInventoryLedgers(a, b)));
    const { inventory } = configure(memory);
    expect(inventory.snapshot.items.length).toBe(500);
    expect(stored(memory).tombstones.length).toBe(0);
  });

  it('deletes legacy Sigil records on load and keeps every frozen-grade item', () => {
    seed(memory, [
      bagRecord('sig-1', 1, { type: 'rune', name: 'Ash Sigil', definitionId: 'rune:Ash Sigil', category: 'runes', stats: {} }),
      bagRecord('graded', 3, { type: 'rune', name: 'Ash Sigil', definitionId: 'rune:Ash Sigil', category: 'runes', stats: {}, rollQuality: { goldPerSec: 0.9 } }),
      bagRecord('charm', 4, { rollQuality: { goldPerSec: 0.2 } }),
    ]);
    const { inventory } = configure(memory);
    expect(inventory.itemById('sig-1')).toBeUndefined();
    expect(stored(memory).tombstones.map(t => t.id)).toEqual(['sig-1']);
    expect(inventory.itemById('graded')?.rollQuality).toEqual({ goldPerSec: 0.9 });
    expect(inventory.itemById('charm')?.rollQuality).toEqual({ goldPerSec: 0.2 });
  });

  it('keeps the local op log bounded without losing quantity', () => {
    const { inventory } = configure(memory);
    for (let i = 0; i < INVENTORY_STACK_OPS_MAX * 3; i++) inventory.grantStack(`f${i}`, 'cinder-ore', 1);
    const ledger = stored(memory);
    expect(ledger.stackOps.length).toBeLessThanOrEqual(INVENTORY_STACK_OPS_MAX);
    expect(stackQuantityOf(ledger, 'cinder-ore')).toBe(INVENTORY_STACK_OPS_MAX * 3);
    expect(inventory.stackOf('cinder-ore')).toBe(INVENTORY_STACK_OPS_MAX * 3);
  });

  it('hides entitlements from the bag and refuses to drop them', () => {
    const { inventory } = configure(memory);
    inventory.grantStack('buy-1', SATCHEL_ROW_KEY, 1);
    expect(inventory.snapshot.stacks.some(s => s.stackKey === SATCHEL_ROW_KEY)).toBeFalse();
    expect(inventory.dropStack(SATCHEL_ROW_KEY)).toBeFalse();
    expect(inventory.dropMany([], [SATCHEL_ROW_KEY])).toBe(0);
    expect(inventory.stackOf(SATCHEL_ROW_KEY)).toBe(1);
  });
});

describe('Inventory: the Vault (stow / take out)', () => {
  it('stows without paying "item equipped", and takes back out', () => {
    const memory = new MemoryGateway();
    const { inventory } = configure(memory);
    inventory.add(gear('helm'));
    const equipped = jasmine.createSpy('equipped');
    inventory.equipped$.subscribe(equipped);
    expect(inventory.stow('helm')).toBeTrue();
    expect(inventory.itemById('helm')?.explorerId).toBe(vaultHolder('general-1'));
    expect(inventory.snapshot.bag.some(i => i.id === 'helm')).toBeFalse();
    expect(inventory.vaultItems('general-1').map(i => i.id)).toEqual(['helm']);
    expect(inventory.stow('helm')).toBeFalse();
    expect(inventory.stow('nope', 'gear')).toBeFalse();
    expect(equipped).not.toHaveBeenCalled();
    expect(inventory.takeOut('helm')).toBeTrue();
    expect(inventory.snapshot.bag.some(i => i.id === 'helm')).toBeTrue();
  });
});

describe('StorageService: satchel rows and Vault tabs', () => {
  let memory: MemoryGateway;
  let inventory: InventoryService;
  let economy: EconomyService;
  let storage: StorageService;

  beforeEach(() => {
    memory = new MemoryGateway();
    ({ inventory, economy } = configure(memory));
    storage = TestBed.inject(StorageService);
    // Enough for rows and the first tabs, short of General IV (8.7M, twelve hours of a level-300 hunt).
    economy.earnGold(3_000_000, 'test');
  });

  it('prices from STORAGE_CURVE and is idempotent per mutation id', () => {
    expect(storage.priceOf('satchel-row')).toBe(STORAGE_CURVE.satchelRows[0]);
    const gold = economy.snapshot.gold;
    expect(storage.buy('satchel-row', 'm1')).toEqual({ ok: true, replayed: false });
    expect(storage.buy('satchel-row', 'm1')).toEqual({ ok: true, replayed: true });
    expect(economy.snapshot.gold).toBe(gold - STORAGE_CURVE.satchelRows[0]);
    expect(storage.rowsOwned()).toBe(1);
    expect(storage.priceOf('satchel-row')).toBe(STORAGE_CURVE.satchelRows[1]);
    expect(storage.buy('materials', 'm2').ok).toBeTrue();
    expect(storage.owns('materials')).toBeTrue();
    expect(storage.buy('materials', 'm3')).toEqual({ ok: false, code: 'owned' });
  });

  it('refunds the Gold when the grant does not save', () => {
    const gold = economy.snapshot.gold;
    memory.failWrites = true;
    expect(storage.buy('materials', 'm9')).toEqual({ ok: false, code: 'persist' });
    memory.failWrites = false;
    expect(economy.snapshot.gold).toBe(gold);
    expect(storage.owns('materials')).toBeFalse();
  });

  it('refuses when short of Gold, before anything is written', () => {
    expect(storage.buy('general-4', 'm4')).toEqual({ ok: false, code: 'funds' });
    expect(inventory.stackOf('storage:tab:general-4')).toBe(0);
  });

  it('a purchase synced from another device replays instead of charging again', () => {
    expect(storage.buy('gear', 'shared').ok).toBeTrue();
    const synced = stored(memory);
    TestBed.resetTestingModule();
    const other = new MemoryGateway();
    other.writeRaw(INVENTORY_KEY, JSON.stringify(mergeInventoryLedgers(synced, { ...synced, records: [], stackOps: [] })));
    const second = configure(other);
    second.economy.earnGold(300_000_000, 'test');
    const gold = second.economy.snapshot.gold;
    expect(TestBed.inject(StorageService).buy('gear', 'shared')).toEqual({ ok: true, replayed: true });
    expect(second.economy.snapshot.gold).toBe(gold);
  });
});
