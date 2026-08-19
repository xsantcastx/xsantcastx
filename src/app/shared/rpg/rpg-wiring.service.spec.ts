import { TestBed } from '@angular/core/testing';

import { emptyLedger, mergeEconomyLedgers } from '../economy/economy-ops';
import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { coerceInventoryLedger, mergeInventoryLedgers, restoreCharms } from './inventory-ops';
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
  /*
   * These three used to be about charm *retirement*: a worn charm contributed
   * nothing, so a merged-in higher `rpgFlatGold` had to be corrected back down
   * to the gear-only figure. Charms have slots again and their Gold counts, so
   * the numbers changed — but the property under test did not. It is still
   * "the economy's flat-Gold mirror is re-derived from what the inventory
   * actually holds, never trusted from a merge", which is the regression these
   * exist to catch.
   */
  it('re-mirrors flat Gold after an economy merge raises the old rate', async () => {
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

    // Helm 2 + charm 4. The charm is in `charm1`, which is a real slot now, so
    // it is worn rather than bagged and its Gold is in the total.
    expect(inventory.snapshot.totals.goldPerSec).toBe(6);
    expect(economy.snapshot.breakdown.rpg).toBe(6);
    registry.flush(ECONOMY_KEY);

    const blob = JSON.parse(memory.readRaw(ECONOMY_KEY)!);
    blob.rpgFlatGold = 9;
    memory.writeRaw(ECONOMY_KEY, JSON.stringify(blob));
    registry.rehydrate(ECONOMY_KEY);
    await Promise.resolve();

    expect(economy.snapshot.breakdown.rpg).toBe(6);
    expect(inventory.snapshot.bag.some(row => row.id === 'worn')).toBe(false);
    expect(inventory.snapshot.equipped['charm1']?.id).toBe('worn');
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
    high.rpgFlatGold = 9;
    memory.writeRaw(ECONOMY_KEY, JSON.stringify(high));
    const mirrored = JSON.parse(memory.readRaw(INVENTORY_KEY)!);
    memory.writeRaw(INVENTORY_KEY, JSON.stringify(mirrored));

    registry.rehydrate(ECONOMY_KEY);
    registry.rehydrate(INVENTORY_KEY);
    await Promise.resolve();

    expect(inventory.snapshot.equipped['charm1']?.id).toBe('worn');
    expect(economy.snapshot.breakdown.rpg).toBe(6);
  });

  it('two-device economy max then remirror survives the charm un-retirement', async () => {
    const helm = {
      id: 'seed-helm', definitionId: 'artifact:Helm', kind: 'instance' as const,
      category: 'artifacts' as const, tags: ['artifact'], rarity: 'rare',
      soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'seed', sequence: 1 }, source: 'inventory' as const,
      name: 'Helm', type: 'artifact' as const, stats: { goldPerSec: 2 }, sellValue: 30,
      location: { kind: 'equipped' as const, slotId: 'head' as const },
    };
    // The shape every save carries today: C5 bagged the charm and tagged it.
    // One device has run the un-retirement migration and the other has not, so
    // the merge has to resolve a tagged copy against an untagged one.
    const charm = {
      id: 'worn', definitionId: 'charm:worn', kind: 'instance' as const,
      category: 'equipment' as const, tags: ['charm', 'retired-charm'], rarity: 'common',
      soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z',
      revision: { hlc: 1, deviceId: 'seed', sequence: 2 }, source: 'inventory' as const,
      name: 'worn', type: 'charm' as const, stats: { goldPerSec: 4 }, sellValue: 12,
      location: { kind: 'bag' as const },
    };
    const raw = {
      version: 2, records: [helm, charm], tombstones: [], stackOps: [],
      goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
    };
    const parsed = coerceInventoryLedger(raw)!;
    const deviceA = restoreCharms(parsed, 'phone', 1_000).ledger;
    const deviceB = parsed;
    const mergedInv = mergeInventoryLedgers(deviceA, deviceB);
    const mergedEco = mergeEconomyLedgers(
      { ...emptyLedger(), rpgFlatGold: 2 },
      { ...emptyLedger(), rpgFlatGold: 6 },
    );
    expect(mergedEco.rpgFlatGold).toBe(6);
    // The migrated copy wins on revision, so the tag does not come back from
    // the device that had not migrated yet.
    const merged = mergedInv.records.find(row => row.id === 'worn') as { location: unknown; tags: string[] };
    expect(merged.location).toEqual({ kind: 'bag' });
    expect(merged.tags).not.toContain('retired-charm');

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
    // Still bagged — the migration strips the tag and does not guess a well —
    // so the flat-Gold mirror is corrected back to the helm's 2, not the
    // merged-in 6.
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
