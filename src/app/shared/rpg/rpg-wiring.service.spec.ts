import { TestBed } from '@angular/core/testing';

import { emptyLedger, mergeEconomyLedgers } from '../economy/economy-ops';
import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { coerceInventoryLedger, mergeInventoryLedgers, retireCharms } from './inventory-ops';
import { INVENTORY_KEY, InventoryService } from './inventory.service';
import { RpgWiringService } from './rpg-wiring.service';

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

describe('RpgWiringService C5 rpgFlatGold', () => {
  it('drops retired charm gold after an economy merge restores the old rate', async () => {
    const memory = new MemoryGateway();
    memory.writeRaw(INVENTORY_KEY, JSON.stringify({
      version: 1,
      items: [
        {
          id: 'seed-helm', name: 'Helm', type: 'artifact', rarity: 'rare',
          stats: { goldPerSec: 2 }, sellValue: 30, equipped: true, slot: 'head',
          foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
        },
        {
          id: 'worn', name: 'worn', type: 'charm', rarity: 'common',
          stats: { goldPerSec: 4 }, sellValue: 12, equipped: true, slot: 'charm1',
          foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
        },
      ],
      goldFromSales: 0,
      sold: 0,
    }));

    TestBed.configureTestingModule({
      providers: [
        RpgWiringService,
        InventoryService,
        EconomyService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    const wiring = TestBed.inject(RpgWiringService);
    const economy = TestBed.inject(EconomyService);
    const inventory = TestBed.inject(InventoryService);
    const registry = TestBed.inject(LocalSaveRegistry);
    wiring.init();

    expect(inventory.snapshot.totals.goldPerSec).toBe(2);
    expect(economy.snapshot.breakdown.rpg).toBe(2);
    registry.flush(ECONOMY_KEY);

    const blob = JSON.parse(memory.readRaw(ECONOMY_KEY)!);
    blob.rpgFlatGold = 6;
    memory.writeRaw(ECONOMY_KEY, JSON.stringify(blob));
    registry.rehydrate(ECONOMY_KEY);
    await Promise.resolve();

    expect(economy.snapshot.breakdown.rpg).toBe(2);
    expect(inventory.snapshot.bag.some(row => row.id === 'worn')).toBe(true);
  });

  it('remirrors after economy-then-inventory attach order in one turn', async () => {
    const memory = new MemoryGateway();
    memory.writeRaw(INVENTORY_KEY, JSON.stringify({
      version: 1,
      items: [
        {
          id: 'seed-helm', name: 'Helm', type: 'artifact', rarity: 'rare',
          stats: { goldPerSec: 2 }, sellValue: 30, equipped: true, slot: 'head',
          foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
        },
        {
          id: 'worn', name: 'worn', type: 'charm', rarity: 'common',
          stats: { goldPerSec: 4 }, sellValue: 12, equipped: true, slot: 'charm1',
          foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
        },
      ],
      goldFromSales: 0,
      sold: 0,
    }));

    TestBed.configureTestingModule({
      providers: [
        RpgWiringService,
        InventoryService,
        EconomyService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    const wiring = TestBed.inject(RpgWiringService);
    const economy = TestBed.inject(EconomyService);
    const inventory = TestBed.inject(InventoryService);
    const registry = TestBed.inject(LocalSaveRegistry);
    wiring.init();
    registry.flush(ECONOMY_KEY);

    const high = JSON.parse(memory.readRaw(ECONOMY_KEY)!);
    high.rpgFlatGold = 6;
    memory.writeRaw(ECONOMY_KEY, JSON.stringify(high));
    const retired = JSON.parse(memory.readRaw(INVENTORY_KEY)!);
    memory.writeRaw(INVENTORY_KEY, JSON.stringify(retired));

    registry.rehydrate(ECONOMY_KEY);
    registry.rehydrate(INVENTORY_KEY);
    await Promise.resolve();

    expect(inventory.snapshot.bag.some(row => row.id === 'worn')).toBe(true);
    expect(economy.snapshot.breakdown.rpg).toBe(2);
  });

  it('two-device economy max then remirror drops retired charm gold', async () => {
    const helm = {
      id: 'seed-helm', definitionId: 'artifact:Helm', kind: 'instance' as const,
      category: 'artifacts' as const, tags: ['artifact'], rarity: 'rare',
      soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'seed', sequence: 1 }, source: 'inventory' as const,
      name: 'Helm', type: 'artifact' as const, stats: { goldPerSec: 2 }, sellValue: 30,
      location: { kind: 'equipped' as const, slotId: 'head' as const },
    };
    const charm = {
      id: 'worn', definitionId: 'charm:worn', kind: 'instance' as const,
      category: 'equipment' as const, tags: ['charm'], rarity: 'common',
      soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'seed', sequence: 2 }, source: 'inventory' as const,
      name: 'worn', type: 'charm' as const, stats: { goldPerSec: 4 }, sellValue: 12,
      location: { kind: 'equipped' as const, slotId: 'charm1' as 'head' },
    };
    const raw = {
      version: 2, records: [helm, charm], tombstones: [], stackOps: [],
      goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
    };
    const parsed = coerceInventoryLedger(raw)!;
    const deviceA = retireCharms(parsed, 'phone', 1_000).ledger;
    const deviceB = parsed;
    const mergedInv = mergeInventoryLedgers(deviceA, deviceB);
    const mergedEco = mergeEconomyLedgers(
      { ...emptyLedger(), rpgFlatGold: 2 },
      { ...emptyLedger(), rpgFlatGold: 6 },
    );
    expect(mergedEco.rpgFlatGold).toBe(6);
    expect((mergedInv.records.find(row => row.id === 'worn') as { location: unknown }).location)
      .toEqual({ kind: 'bag' });

    const memory = new MemoryGateway();
    memory.writeRaw(INVENTORY_KEY, JSON.stringify(mergedInv));
    memory.writeRaw(ECONOMY_KEY, JSON.stringify(mergedEco));
    TestBed.configureTestingModule({
      providers: [
        RpgWiringService,
        InventoryService,
        EconomyService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    TestBed.inject(RpgWiringService).init();
    await Promise.resolve();
    expect(TestBed.inject(InventoryService).snapshot.bag.some(row => row.id === 'worn')).toBe(true);
    expect(TestBed.inject(EconomyService).snapshot.breakdown.rpg).toBe(2);
  });

  it('does not advance rpgFlatGold when equip save rolls back', async () => {
    const memory = new MemoryGateway();
    TestBed.configureTestingModule({
      providers: [
        RpgWiringService,
        InventoryService,
        EconomyService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    const wiring = TestBed.inject(RpgWiringService);
    const economy = TestBed.inject(EconomyService);
    const inventory = TestBed.inject(InventoryService);
    wiring.init();
    const helm = {
      id: 'fail-helm', name: 'Fail Helm', type: 'artifact' as const, rarity: 'rare' as const,
      stats: { goldPerSec: 5 }, sellValue: 4, equipped: false,
      foundAt: '2026-08-04T00:00:00.000Z', soulbound: false,
    };
    expect(inventory.add(helm)).toBeTruthy();
    await Promise.resolve();
    const rpg = economy.snapshot.breakdown.rpg;
    memory.write = () => { /* swallow */ };
    expect(inventory.equip('fail-helm', 'off-hand')).toBe(false);
    await Promise.resolve();
    expect(economy.snapshot.breakdown.rpg).toBe(rpg);
    expect(inventory.snapshot.equipped['off-hand']).toBeUndefined();
  });
});
