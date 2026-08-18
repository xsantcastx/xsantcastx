import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { InventoryService, MAX_INVENTORY } from '../rpg/inventory.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { ActivityProgressionGateway } from './activity-progression.gateway';
import {
  ACTIVITY_KEY,
  BASALT_SEAMWORKS_ID,
  EMBER_GUARANTEE_AT,
  INFERNAL_HEARTSTONE_ID,
  MINING_RECOVERY_MS,
  MINING_XP_PER_ACTION,
  SLAG_FRAGMENT_ID,
} from './activity.model';
import { xpForLevel } from './mining-level';

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

  it('guarantees ember on the 800th eligible action', () => {
    let t = 4_000;
    for (let i = 1; i < EMBER_GUARANTEE_AT; i++) {
      const result = gateway.resolveMine({ mutationId: `m${i}`, now: t, roll: 0.99 });
      expect(result.ok).toBe(true);
      t += MINING_RECOVERY_MS + 1;
    }
    expect(inventory.stackOf('ember-residue')).toBe(0);
    const last = gateway.resolveMine({ mutationId: `m${EMBER_GUARANTEE_AT}`, now: t, roll: 0.99 });
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    expect(last.operation.discovery.result).toBe('first-craft-guarantee');
    expect(inventory.stackOf('cinder-ore')).toBe(EMBER_GUARANTEE_AT);
    expect(inventory.stackOf('ember-residue')).toBe(1);
    expect(gateway.snapshot.progress.xpByDiscipline.mining).toBe(EMBER_GUARANTEE_AT * MINING_XP_PER_ACTION);
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

  it('refuses a tier the current level has not reached', () => {
    const refused = gateway.resolveMine({ mutationId: 'm1', now: 4_000, roll: 0.9, oreId: SLAG_FRAGMENT_ID });
    expect(refused).toEqual({ ok: false, code: 'tier-locked' });
    expect(inventory.stackOf(SLAG_FRAGMENT_ID)).toBe(0);
    expect(JSON.parse(memory.readRaw(ACTIVITY_KEY)!).operations.length).toBe(0);
  });

  it('grants a higher tier\'s ore and XP once its level is reached', () => {
    // Seed straight to level 8 rather than looping ~3,600 Cinder strikes —
    // the level curve, not this test, owns how XP maps to level.
    // resolvedAt is epoch-relative so a later `now` of 10_000 reads as after
    // it — the gateway rejects any strike whose clock is behind the last op.
    const op = {
      id: 'seed-level-8',
      hlcRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 'seed', sequence: 1 },
      kind: 'active' as const,
      disciplineId: 'mining' as const,
      locationId: BASALT_SEAMWORKS_ID,
      resolvedAt: new Date(1_000).toISOString(),
      xpGrant: { id: 'seed-level-8:xp', amount: xpForLevel(8) },
      inventoryGrants: [],
      discovery: { rolled: true, result: 'none' as const },
    };
    memory.write(ACTIVITY_KEY, {
      version: 1,
      era: 55,
      currentWork: null,
      progress: { version: 1, xpByDiscipline: { mining: xpForLevel(8) } },
      operations: [op],
      craftedBasaltEdge: false,
      emberGranted: false,
      miningAccepted: 1,
    });
    TestBed.resetTestingModule();
    const levelled = configure(memory);
    expect(levelled.selectCurrentWork('mining', BASALT_SEAMWORKS_ID, 10_000)).toBeTruthy();
    const freshInventory = TestBed.inject(InventoryService);

    const result = levelled.resolveMine({ mutationId: 'm2', now: 10_000, roll: 0.9, oreId: SLAG_FRAGMENT_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.operation.xpGrant.amount).toBe(5);
    expect(result.operation.inventoryGrants.map(g => g.definitionId)).toEqual([SLAG_FRAGMENT_ID]);
    expect(freshInventory.stackOf(SLAG_FRAGMENT_ID)).toBe(1);

    // Still under level 20 — Infernal Heartstone stays out of reach.
    const tooDeep = levelled.resolveMine({
      mutationId: 'm3', now: 10_000 + MINING_RECOVERY_MS + 1, roll: 0.9, oreId: INFERNAL_HEARTSTONE_ID,
    });
    expect(tooDeep).toEqual({ ok: false, code: 'tier-locked' });
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
