import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { ACTIVITY_KEY } from '../activity/activity.model';
import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { ForgeCraftGateway } from './forge-craft.gateway';
import { INVENTORY_KEY, InventoryService } from './inventory.service';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void {
    this.bag.set(key, JSON.stringify(value));
  }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

describe('ForgeCraftGateway', () => {
  let memory: MemoryGateway;
  let crafts: ForgeCraftGateway;
  let inventory: InventoryService;
  let activity: ActivityProgressionGateway;

  beforeEach(() => {
    memory = new MemoryGateway();
    memory.writeRaw(ECONOMY_KEY, JSON.stringify({ version: 3 }));
    TestBed.configureTestingModule({
      providers: [
        ForgeCraftGateway,
        InventoryService,
        ActivityProgressionGateway,
        EconomyService,
        LocalSaveRegistry,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    crafts = TestBed.inject(ForgeCraftGateway);
    inventory = TestBed.inject(InventoryService);
    activity = TestBed.inject(ActivityProgressionGateway);
    crafts.init();
    inventory.grantStack('ore:1', 'cinder-ore', 6);
    inventory.grantStack('ember:1', 'ember-residue', 1);
  });

  it('mints Basalt Edge and marks first craft on the activity ledger', () => {
    const result = crafts.craftBasaltEdge('loop-1', 4_000);
    expect(result.ok).toBe(true);
    expect(inventory.hasBasaltEdge()).toBe(true);
    expect(activity.snapshot.craftedBasaltEdge).toBe(true);
    const stored = JSON.parse(memory.readRaw(ACTIVITY_KEY)!);
    expect(stored.craftedBasaltEdge).toBe(true);
    expect(JSON.parse(memory.readRaw(INVENTORY_KEY)!).records.some(
      (row: { name?: string }) => row.name === 'Basalt Edge',
    )).toBe(true);
  });

  it('replays the same mutation id without a second consume', () => {
    crafts.craftBasaltEdge('loop-1', 4_000);
    inventory.grantStack('ore:2', 'cinder-ore', 6);
    inventory.grantStack('ember:2', 'ember-residue', 1);
    const replay = crafts.craftBasaltEdge('loop-1', 5_000);
    expect(replay.ok && replay.replayed).toBe(true);
    expect(inventory.stackOf('cinder-ore')).toBe(6);
    expect(inventory.snapshot.bag.filter(row => row.name === 'Basalt Edge').length).toBe(1);
  });
});
