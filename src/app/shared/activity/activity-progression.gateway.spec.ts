import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { InventoryService, MAX_INVENTORY } from '../rpg/inventory.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { ActivityProgressionGateway } from './activity-progression.gateway';
import { ACTIVITY_KEY, BASALT_SEAMWORKS_ID, MINING_RECOVERY_MS } from './activity.model';

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

function configure(memory: MemoryGateway): ActivityProgressionGateway {
  TestBed.configureTestingModule({
    providers: [
      ActivityProgressionGateway,
      InventoryService,
      EconomyService,
      LocalSaveRegistry,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const gateway = TestBed.inject(ActivityProgressionGateway);
  gateway.init();
  return gateway;
}

describe('ActivityProgressionGateway', () => {
  let memory: MemoryGateway;
  let gateway: ActivityProgressionGateway;
  let inventory: InventoryService;

  beforeEach(() => {
    memory = new MemoryGateway();
    gateway = configure(memory);
    inventory = TestBed.inject(InventoryService);
    expect(gateway.selectCurrentWork('mining', BASALT_SEAMWORKS_ID, 1_000)).toBeTruthy();
  });

  it('grants one ore and two mining XP, and a retry of the same id is a no-op', () => {
    const first = gateway.resolveMine({ mutationId: 'm1', now: 4_000, roll: 0.9 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.replayed).toBe(false);
    expect(first.operation.xpGrant.amount).toBe(2);
    expect(inventory.stackOf('cinder-ore')).toBe(1);
    expect(gateway.snapshot.progress.xpByDiscipline.mining).toBe(2);

    const again = gateway.resolveMine({ mutationId: 'm1', now: 8_000, roll: 0.01 });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.replayed).toBe(true);
    expect(again.operation.discovery.result).toBe('none');
    expect(inventory.stackOf('cinder-ore')).toBe(1);
    expect(gateway.snapshot.progress.xpByDiscipline.mining).toBe(2);
  });

  it('rejects a second mutation while recovering', () => {
    expect(gateway.resolveMine({ mutationId: 'm1', now: 4_000, roll: 0.9 }).ok).toBe(true);
    const early = gateway.resolveMine({ mutationId: 'm2', now: 4_000 + MINING_RECOVERY_MS - 1, roll: 0.9 });
    expect(early).toEqual({ ok: false, code: 'recovering' });
    expect(inventory.stackOf('cinder-ore')).toBe(1);
  });

  it('fails closed on clock rollback and a wrong location', () => {
    expect(gateway.resolveMine({ mutationId: 'm1', now: 5_000, roll: 0.9 }).ok).toBe(true);
    const rolled = gateway.resolveMine({ mutationId: 'm2', now: 4_000, roll: 0.9 });
    expect(rolled.ok).toBe(false);
    if (rolled.ok) return;
    expect(rolled.code).toBe('clock');
    const elsewhere = gateway.resolveMine({
      mutationId: 'm3', now: 9_000, locationId: 'celestial/nowhere', roll: 0.9,
    });
    expect(elsewhere.ok).toBe(false);
    if (elsewhere.ok) return;
    expect(elsewhere.code).toBe('location');
  });

  it('guarantees ember on the eighth eligible action', () => {
    let t = 4_000;
    for (let i = 1; i <= 7; i++) {
      const result = gateway.resolveMine({ mutationId: `m${i}`, now: t, roll: 0.99 });
      expect(result.ok).toBe(true);
      t += MINING_RECOVERY_MS + 1;
    }
    expect(inventory.stackOf('ember-residue')).toBe(0);
    const eighth = gateway.resolveMine({ mutationId: 'm8', now: t, roll: 0.99 });
    expect(eighth.ok).toBe(true);
    if (!eighth.ok) return;
    expect(eighth.operation.discovery.result).toBe('first-craft-guarantee');
    expect(inventory.stackOf('cinder-ore')).toBe(8);
    expect(inventory.stackOf('ember-residue')).toBe(1);
    expect(gateway.snapshot.progress.xpByDiscipline.mining).toBe(16);
  });

  it('refuses to create an operation when the bag cannot take ore', () => {
    for (let i = 0; i < MAX_INVENTORY; i++) {
      expect(inventory.add({
        id: `fill-${i}`, name: `Fill ${i}`, type: 'artifact', rarity: 'common',
        stats: {}, sellValue: 1, equipped: false,
        foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
      })).toBeTruthy();
    }
    const refused = gateway.resolveMine({ mutationId: 'full', now: 4_000, roll: 0.9 });
    expect(refused).toEqual({ ok: false, code: 'capacity' });
    expect(inventory.stackOf('cinder-ore')).toBe(0);
    expect(JSON.parse(memory.readRaw(ACTIVITY_KEY)!).operations.length).toBe(0);
  });

  it('rehydrates the merged ledger without awarding again', () => {
    expect(gateway.resolveMine({ mutationId: 'm1', now: 4_000, roll: 0.9 }).ok).toBe(true);
    TestBed.resetTestingModule();
    const again = configure(memory);
    const replay = again.resolveMine({ mutationId: 'm1', now: 20_000, roll: 0.01 });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.replayed).toBe(true);
    expect(TestBed.inject(InventoryService).stackOf('cinder-ore')).toBe(1);
  });
});
