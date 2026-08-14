import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
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
  it('drops retired charm gold after an economy merge restores the old rate', () => {
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

    expect(economy.snapshot.breakdown.rpg).toBe(2);
    expect(inventory.snapshot.bag.some(row => row.id === 'worn')).toBe(true);
  });
});
