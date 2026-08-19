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
  MERIDIAN_ORRERY_ID,
  MINING_XP_PER_ACTION,
  ROOTGLASS_CANOPY_ID,
  SLAG_FRAGMENT_ID,
} from './activity.model';
import {
  FORAGING_RECOVERY_MS,
  FORAGING_XP_PER_ACTION,
  RIFT_KEY_GUARANTEE_AT,
  RIFT_KEY_ID,
  STARLIGHT_HERB_ID,
  SUNBLOOM_ID,
  THORNROOT_ID,
} from './foraging.model';
import {
  CELESTIAL_ALLOY_ID,
  CLARITY_ELIXIR_GUARANTEE_AT,
  CLARITY_ELIXIR_ID,
  LUMINOUS_PRISM_ID,
  PROSPECTING_RECOVERY_MS,
  PROSPECTING_XP_PER_ACTION,
  VOID_SHARD_ID,
} from './prospecting.model';
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

  // ── A2 Foraging ──────────────────────────────────────────────────────────

  describe('foraging', () => {
    beforeEach(() => {
      expect(gateway.selectCurrentWork('foraging', ROOTGLASS_CANOPY_ID, 1_000)).toBeTruthy();
    });

    it('grants one Starlight Herb and two foraging XP, and a retry of the same id is a no-op', () => {
      const first = gateway.resolveForage({ mutationId: 'f1', now: 4_000, roll: 0.9 });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.replayed).toBe(false);
      expect(first.operation.disciplineId).toBe('foraging');
      expect(first.operation.xpGrant.amount).toBe(FORAGING_XP_PER_ACTION);
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(1);
      expect(inventory.stackOf('cinder-ore')).toBe(0);
      expect(gateway.snapshot.progress.xpByDiscipline.foraging).toBe(2);
      expect(gateway.snapshot.progress.xpByDiscipline.mining).toBeUndefined();
      expect(gateway.snapshot.foragingAccepted).toBe(1);
      expect(gateway.snapshot.miningAccepted).toBe(0);

      const again = gateway.resolveForage({ mutationId: 'f1', now: 8_000, roll: 0.0001 });
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      expect(again.replayed).toBe(true);
      expect(again.operation.discovery.result).toBe('none');
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(1);
      expect(gateway.snapshot.progress.xpByDiscipline.foraging).toBe(2);
    });

    it('rejects a second gather while regrowing, using the foraging cooldown', () => {
      expect(gateway.resolveForage({ mutationId: 'f1', now: 4_000, roll: 0.9 }).ok).toBe(true);
      const early = gateway.resolveForage({ mutationId: 'f2', now: 4_000 + FORAGING_RECOVERY_MS - 1, roll: 0.9 });
      expect(early).toEqual({ ok: false, code: 'recovering' });
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(1);
      // recoveryEndsAt follows the *current discipline*: 2,500ms at foraging level 1.
      expect(gateway.currentRecoveryMs()).toBe(FORAGING_RECOVERY_MS);
      expect(gateway.recoveryRemainingMs(4_001)).toBe(FORAGING_RECOVERY_MS - 1);
      expect(gateway.recoveryRemainingMs(4_000 + FORAGING_RECOVERY_MS + 1)).toBe(0);
      const late = gateway.resolveForage({ mutationId: 'f2', now: 4_000 + FORAGING_RECOVERY_MS, roll: 0.9 });
      expect(late.ok).toBe(true);
    });

    it('rejects a Mine at the Canopy and a Gather at the Seamworks', () => {
      const mineHere = gateway.resolveMine({ mutationId: 'm1', now: 4_000, roll: 0.9 });
      expect(mineHere).toEqual({ ok: false, code: 'location' });
      expect(gateway.selectCurrentWork('mining', BASALT_SEAMWORKS_ID, 5_000)).toBeTruthy();
      const gatherThere = gateway.resolveForage({ mutationId: 'f1', now: 6_000, roll: 0.9 });
      expect(gatherThere).toEqual({ ok: false, code: 'location' });
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(0);
      expect(inventory.stackOf('cinder-ore')).toBe(0);
    });

    it('lets Mine at the Seamworks succeed again once Mining is re-selected there after a Canopy visit', () => {
      // The round-trip a Keeper actually walks: Canopy (foraging selected) →
      // Seamworks. The Seamworks page re-selects mining on entry; this pins
      // that the gateway honours the swap rather than remembering the Canopy.
      expect(gateway.resolveForage({ mutationId: 'f1', now: 4_000, roll: 0.9 }).ok).toBe(true);
      expect(gateway.resolveMine({ mutationId: 'm0', now: 5_000, roll: 0.9 })).toEqual({ ok: false, code: 'location' });
      expect(gateway.selectCurrentWork('mining', BASALT_SEAMWORKS_ID, 6_000)).toBeTruthy();
      const mined = gateway.resolveMine({ mutationId: 'm1', now: 7_000, roll: 0.9 });
      expect(mined.ok).toBe(true);
      expect(gateway.snapshot.currentWork?.locationId).toBe(BASALT_SEAMWORKS_ID);
      expect(inventory.stackOf('cinder-ore')).toBe(1);
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(1);
      expect(gateway.snapshot.progress.xpByDiscipline.foraging).toBe(FORAGING_XP_PER_ACTION);
      expect(gateway.snapshot.progress.xpByDiscipline.mining).toBe(MINING_XP_PER_ACTION);
    });

    it('refuses a growth the current foraging level has not reached', () => {
      const refused = gateway.resolveForage({ mutationId: 'f1', now: 4_000, roll: 0.9, herbId: SUNBLOOM_ID });
      expect(refused).toEqual({ ok: false, code: 'tier-locked' });
      expect(inventory.stackOf(SUNBLOOM_ID)).toBe(0);
      expect(JSON.parse(memory.readRaw(ACTIVITY_KEY)!).operations.length).toBe(0);
    });

    it('grants a higher growth\'s herb and XP once its level is reached, off foraging XP only', () => {
      // Seed foraging straight to level 6 with one real op (progressFromOps
      // is the source of truth once any op exists) and give mining a huge
      // total too — Sunbloom must open on the *foraging* level, not mining's.
      const seed = {
        id: 'seed-foraging-6',
        hlcRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 'seed', sequence: 1 },
        kind: 'active' as const,
        disciplineId: 'foraging' as const,
        locationId: ROOTGLASS_CANOPY_ID,
        resolvedAt: new Date(1_000).toISOString(),
        xpGrant: { id: 'seed-foraging-6:xp', amount: xpForLevel(6) },
        inventoryGrants: [],
        discovery: { rolled: true, result: 'none' as const },
      };
      memory.write(ACTIVITY_KEY, {
        version: 1,
        era: 55,
        currentWork: null,
        progress: { version: 1, xpByDiscipline: { foraging: xpForLevel(6), mining: xpForLevel(40) } },
        operations: [seed],
        craftedBasaltEdge: false,
        emberGranted: false,
        miningAccepted: 0,
        foragingAccepted: 1,
        riftKeyGranted: false,
      });
      TestBed.resetTestingModule();
      const levelled = configure(memory);
      expect(levelled.selectCurrentWork('foraging', ROOTGLASS_CANOPY_ID, 10_000)).toBeTruthy();
      const freshInventory = TestBed.inject(InventoryService);

      const result = levelled.resolveForage({ mutationId: 'f2', now: 10_000, roll: 0.9, herbId: SUNBLOOM_ID });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.operation.xpGrant.amount).toBe(4);
      expect(result.operation.inventoryGrants.map(g => g.definitionId)).toEqual([SUNBLOOM_ID]);
      expect(freshInventory.stackOf(SUNBLOOM_ID)).toBe(1);

      // Foraging level 6 (mining level 40 is irrelevant) — Thornroot stays shut.
      const tooDeep = levelled.resolveForage({
        mutationId: 'f3', now: 10_000 + FORAGING_RECOVERY_MS + 1, roll: 0.9, herbId: THORNROOT_ID,
      });
      expect(tooDeep).toEqual({ ok: false, code: 'tier-locked' });
    });

    it('guarantees the first Rift Key on the 600th accepted gather and keeps rolling after', () => {
      let t = 4_000;
      for (let i = 1; i < RIFT_KEY_GUARANTEE_AT; i++) {
        const result = gateway.resolveForage({ mutationId: `f${i}`, now: t, roll: 0.99 });
        expect(result.ok).toBe(true);
        t += FORAGING_RECOVERY_MS + 1;
      }
      expect(inventory.stackOf(RIFT_KEY_ID)).toBe(0);
      expect(gateway.snapshot.riftKeyGranted).toBe(false);
      const last = gateway.resolveForage({ mutationId: `f${RIFT_KEY_GUARANTEE_AT}`, now: t, roll: 0.99 });
      expect(last.ok).toBe(true);
      if (!last.ok) return;
      expect(last.operation.discovery.result).toBe('rift-key-guarantee');
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(RIFT_KEY_GUARANTEE_AT);
      expect(inventory.stackOf(RIFT_KEY_ID)).toBe(1);
      expect(gateway.snapshot.foragingAccepted).toBe(RIFT_KEY_GUARANTEE_AT);
      expect(gateway.snapshot.riftKeyGranted).toBe(true);
      expect(gateway.snapshot.emberGranted).toBe(false);
      expect(gateway.snapshot.miningAccepted).toBe(0);
      expect(gateway.snapshot.progress.xpByDiscipline.foraging).toBe(RIFT_KEY_GUARANTEE_AT * FORAGING_XP_PER_ACTION);

      // 601st: no second guarantee, but the 0.1% roll is still live.
      t += FORAGING_RECOVERY_MS + 1;
      const after = gateway.resolveForage({ mutationId: 'f-after', now: t, roll: 0.99 });
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(after.operation.discovery.result).toBe('none');
      t += FORAGING_RECOVERY_MS + 1;
      const lucky = gateway.resolveForage({ mutationId: 'f-lucky', now: t, roll: 0.0005 });
      expect(lucky.ok).toBe(true);
      if (!lucky.ok) return;
      expect(lucky.operation.discovery.result).toBe('rift-key');
      expect(inventory.stackOf(RIFT_KEY_ID)).toBe(2);
    });

    it('refuses to create an operation when the bag cannot take herbs', () => {
      for (let i = 0; i < MAX_INVENTORY; i++) {
        expect(inventory.add({
          id: `fill-${i}`, name: `Fill ${i}`, type: 'artifact', rarity: 'common',
          stats: {}, sellValue: 1, equipped: false,
          foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
        })).toBeTruthy();
      }
      const refused = gateway.resolveForage({ mutationId: 'full', now: 4_000, roll: 0.9 });
      expect(refused).toEqual({ ok: false, code: 'capacity' });
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(0);
      expect(JSON.parse(memory.readRaw(ACTIVITY_KEY)!).operations.length).toBe(0);
    });

    it('rehydrates the merged ledger without awarding again', () => {
      expect(gateway.resolveForage({ mutationId: 'f1', now: 4_000, roll: 0.9 }).ok).toBe(true);
      TestBed.resetTestingModule();
      const again = configure(memory);
      const replay = again.resolveForage({ mutationId: 'f1', now: 20_000, roll: 0.0001 });
      expect(replay.ok).toBe(true);
      if (!replay.ok) return;
      expect(replay.replayed).toBe(true);
      expect(TestBed.inject(InventoryService).stackOf(STARLIGHT_HERB_ID)).toBe(1);
      expect(again.snapshot.currentWork?.disciplineId).toBe('foraging');
      expect(again.snapshot.foragingAccepted).toBe(1);
    });
  });

  describe('prospecting', () => {
    beforeEach(() => {
      expect(gateway.selectCurrentWork('prospecting', MERIDIAN_ORRERY_ID, 1_000)).toBeTruthy();
    });

    it('grants one Celestial Alloy and two prospecting XP, and a retry of the same id is a no-op', () => {
      const first = gateway.resolveProspect({ mutationId: 'p1', now: 4_000, roll: 0.9 });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.replayed).toBe(false);
      expect(first.operation.disciplineId).toBe('prospecting');
      expect(first.operation.xpGrant.amount).toBe(PROSPECTING_XP_PER_ACTION);
      expect(inventory.stackOf(CELESTIAL_ALLOY_ID)).toBe(1);
      expect(inventory.stackOf('cinder-ore')).toBe(0);
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(0);
      expect(gateway.snapshot.progress.xpByDiscipline.prospecting).toBe(2);
      expect(gateway.snapshot.progress.xpByDiscipline.mining).toBeUndefined();
      expect(gateway.snapshot.progress.xpByDiscipline.foraging).toBeUndefined();
      expect(gateway.snapshot.prospectingAccepted).toBe(1);
      expect(gateway.snapshot.miningAccepted).toBe(0);
      expect(gateway.snapshot.foragingAccepted).toBe(0);

      const again = gateway.resolveProspect({ mutationId: 'p1', now: 8_000, roll: 0.0001 });
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      expect(again.replayed).toBe(true);
      expect(again.operation.discovery.result).toBe('none');
      expect(inventory.stackOf(CELESTIAL_ALLOY_ID)).toBe(1);
      expect(gateway.snapshot.progress.xpByDiscipline.prospecting).toBe(2);
    });

    it('rejects a second survey while realigning, using the prospecting cooldown', () => {
      expect(gateway.resolveProspect({ mutationId: 'p1', now: 4_000, roll: 0.9 }).ok).toBe(true);
      const early = gateway.resolveProspect({ mutationId: 'p2', now: 4_000 + PROSPECTING_RECOVERY_MS - 1, roll: 0.9 });
      expect(early).toEqual({ ok: false, code: 'recovering' });
      expect(inventory.stackOf(CELESTIAL_ALLOY_ID)).toBe(1);
      // currentRecoveryMs dispatches on the *current discipline*, via the
      // RECOVERY_BY_DISCIPLINE table that replaced the two-arm ternary.
      expect(gateway.currentRecoveryMs()).toBe(PROSPECTING_RECOVERY_MS);
      expect(gateway.recoveryRemainingMs(4_001)).toBe(PROSPECTING_RECOVERY_MS - 1);
      expect(gateway.recoveryRemainingMs(4_000 + PROSPECTING_RECOVERY_MS + 1)).toBe(0);
      const late = gateway.resolveProspect({ mutationId: 'p2', now: 4_000 + PROSPECTING_RECOVERY_MS, roll: 0.9 });
      expect(late.ok).toBe(true);
    });

    it('rejects the other verbs at the Orrery and a Survey at either other site', () => {
      expect(gateway.resolveMine({ mutationId: 'm1', now: 4_000, roll: 0.9 })).toEqual({ ok: false, code: 'location' });
      expect(gateway.resolveForage({ mutationId: 'f1', now: 4_000, roll: 0.9 })).toEqual({ ok: false, code: 'location' });
      expect(gateway.selectCurrentWork('mining', BASALT_SEAMWORKS_ID, 5_000)).toBeTruthy();
      expect(gateway.resolveProspect({ mutationId: 'p1', now: 6_000, roll: 0.9 })).toEqual({ ok: false, code: 'location' });
      expect(gateway.selectCurrentWork('foraging', ROOTGLASS_CANOPY_ID, 7_000)).toBeTruthy();
      expect(gateway.resolveProspect({ mutationId: 'p2', now: 8_000, roll: 0.9 })).toEqual({ ok: false, code: 'location' });
      expect(inventory.stackOf(CELESTIAL_ALLOY_ID)).toBe(0);
      expect(inventory.stackOf('cinder-ore')).toBe(0);
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(0);
    });

    it('lets each other verb succeed again once its own work is re-selected after an Orrery visit', () => {
      expect(gateway.resolveProspect({ mutationId: 'p1', now: 4_000, roll: 0.9 }).ok).toBe(true);

      expect(gateway.selectCurrentWork('mining', BASALT_SEAMWORKS_ID, 5_000)).toBeTruthy();
      expect(gateway.resolveMine({ mutationId: 'm1', now: 6_000, roll: 0.9 }).ok).toBe(true);

      expect(gateway.selectCurrentWork('foraging', ROOTGLASS_CANOPY_ID, 7_000)).toBeTruthy();
      expect(gateway.resolveForage({ mutationId: 'f1', now: 8_000, roll: 0.9 }).ok).toBe(true);

      expect(inventory.stackOf(CELESTIAL_ALLOY_ID)).toBe(1);
      expect(inventory.stackOf('cinder-ore')).toBe(1);
      expect(inventory.stackOf(STARLIGHT_HERB_ID)).toBe(1);
      expect(gateway.snapshot.progress.xpByDiscipline.prospecting).toBe(PROSPECTING_XP_PER_ACTION);
      expect(gateway.snapshot.progress.xpByDiscipline.mining).toBe(MINING_XP_PER_ACTION);
      expect(gateway.snapshot.progress.xpByDiscipline.foraging).toBe(FORAGING_XP_PER_ACTION);
    });

    it('refuses a cut the current prospecting level has not reached', () => {
      const refused = gateway.resolveProspect({ mutationId: 'p1', now: 4_000, roll: 0.9, mineralId: LUMINOUS_PRISM_ID });
      expect(refused).toEqual({ ok: false, code: 'tier-locked' });
      expect(inventory.stackOf(LUMINOUS_PRISM_ID)).toBe(0);
      expect(JSON.parse(memory.readRaw(ACTIVITY_KEY)!).operations.length).toBe(0);
    });

    it('grants a higher cut\'s mineral and XP once its level is reached, off prospecting XP only', () => {
      // Seed prospecting to level 7 with one real op, and give BOTH other
      // skills huge totals — Luminous Prism must open on the *prospecting*
      // level, never on somebody else's climb.
      const seed = {
        id: 'seed-prospecting-7',
        hlcRevision: { wallTimeMs: 1, logicalCounter: 0, deviceId: 'seed', sequence: 1 },
        kind: 'active' as const,
        disciplineId: 'prospecting' as const,
        locationId: MERIDIAN_ORRERY_ID,
        resolvedAt: new Date(1_000).toISOString(),
        xpGrant: { id: 'seed-prospecting-7:xp', amount: xpForLevel(7) },
        inventoryGrants: [],
        discovery: { rolled: true, result: 'none' as const },
      };
      memory.write(ACTIVITY_KEY, {
        version: 1,
        era: 55,
        currentWork: null,
        progress: {
          version: 1,
          xpByDiscipline: { prospecting: xpForLevel(7), mining: xpForLevel(40), foraging: xpForLevel(40) },
        },
        operations: [seed],
        craftedBasaltEdge: false,
        emberGranted: false,
        miningAccepted: 0,
        foragingAccepted: 0,
        riftKeyGranted: false,
        prospectingAccepted: 1,
        clarityElixirGranted: false,
      });
      TestBed.resetTestingModule();
      const levelled = configure(memory);
      expect(levelled.selectCurrentWork('prospecting', MERIDIAN_ORRERY_ID, 10_000)).toBeTruthy();
      const freshInventory = TestBed.inject(InventoryService);

      const result = levelled.resolveProspect({ mutationId: 'p2', now: 10_000, roll: 0.9, mineralId: LUMINOUS_PRISM_ID });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.operation.xpGrant.amount).toBe(5);
      expect(result.operation.inventoryGrants.map(g => g.definitionId)).toEqual([LUMINOUS_PRISM_ID]);
      expect(freshInventory.stackOf(LUMINOUS_PRISM_ID)).toBe(1);

      // Prospecting level 7 — the top cut stays shut whatever the other two read.
      const tooDeep = levelled.resolveProspect({
        mutationId: 'p3', now: 10_000 + PROSPECTING_RECOVERY_MS + 1, roll: 0.9, mineralId: VOID_SHARD_ID,
      });
      expect(tooDeep).toEqual({ ok: false, code: 'tier-locked' });
    });

    it('guarantees the first Clarity Elixir on the 750th accepted survey and keeps rolling after', () => {
      let t = 4_000;
      for (let i = 1; i < CLARITY_ELIXIR_GUARANTEE_AT; i++) {
        const result = gateway.resolveProspect({ mutationId: `p${i}`, now: t, roll: 0.99 });
        expect(result.ok).toBe(true);
        t += PROSPECTING_RECOVERY_MS + 1;
      }
      expect(inventory.stackOf(CLARITY_ELIXIR_ID)).toBe(0);
      expect(gateway.snapshot.clarityElixirGranted).toBe(false);
      const last = gateway.resolveProspect({ mutationId: `p${CLARITY_ELIXIR_GUARANTEE_AT}`, now: t, roll: 0.99 });
      expect(last.ok).toBe(true);
      if (!last.ok) return;
      expect(last.operation.discovery.result).toBe('clarity-elixir-guarantee');
      expect(inventory.stackOf(CELESTIAL_ALLOY_ID)).toBe(CLARITY_ELIXIR_GUARANTEE_AT);
      expect(inventory.stackOf(CLARITY_ELIXIR_ID)).toBe(1);
      expect(gateway.snapshot.prospectingAccepted).toBe(CLARITY_ELIXIR_GUARANTEE_AT);
      expect(gateway.snapshot.clarityElixirGranted).toBe(true);
      // Neither earlier skill's pity moved.
      expect(gateway.snapshot.emberGranted).toBe(false);
      expect(gateway.snapshot.miningAccepted).toBe(0);
      expect(gateway.snapshot.riftKeyGranted).toBe(false);
      expect(gateway.snapshot.foragingAccepted).toBe(0);
      expect(gateway.snapshot.progress.xpByDiscipline.prospecting)
        .toBe(CLARITY_ELIXIR_GUARANTEE_AT * PROSPECTING_XP_PER_ACTION);

      // 751st: no second guarantee, but the 0.07% roll is still live.
      t += PROSPECTING_RECOVERY_MS + 1;
      const after = gateway.resolveProspect({ mutationId: 'p-after', now: t, roll: 0.99 });
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(after.operation.discovery.result).toBe('none');
      t += PROSPECTING_RECOVERY_MS + 1;
      const lucky = gateway.resolveProspect({ mutationId: 'p-lucky', now: t, roll: 0.0001 });
      expect(lucky.ok).toBe(true);
      if (!lucky.ok) return;
      expect(lucky.operation.discovery.result).toBe('clarity-elixir');
      expect(inventory.stackOf(CLARITY_ELIXIR_ID)).toBe(2);
    });

    it('refuses to create an operation when the bag cannot take minerals', () => {
      for (let i = 0; i < MAX_INVENTORY; i++) {
        expect(inventory.add({
          id: `fill-${i}`, name: `Fill ${i}`, type: 'artifact', rarity: 'common',
          stats: {}, sellValue: 1, equipped: false,
          foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
        })).toBeTruthy();
      }
      const refused = gateway.resolveProspect({ mutationId: 'full', now: 4_000, roll: 0.9 });
      expect(refused).toEqual({ ok: false, code: 'capacity' });
      expect(inventory.stackOf(CELESTIAL_ALLOY_ID)).toBe(0);
      expect(JSON.parse(memory.readRaw(ACTIVITY_KEY)!).operations.length).toBe(0);
    });

    it('rehydrates the merged ledger without awarding again', () => {
      expect(gateway.resolveProspect({ mutationId: 'p1', now: 4_000, roll: 0.9 }).ok).toBe(true);
      TestBed.resetTestingModule();
      const again = configure(memory);
      const replay = again.resolveProspect({ mutationId: 'p1', now: 20_000, roll: 0.0001 });
      expect(replay.ok).toBe(true);
      if (!replay.ok) return;
      expect(replay.replayed).toBe(true);
      expect(TestBed.inject(InventoryService).stackOf(CELESTIAL_ALLOY_ID)).toBe(1);
      expect(again.snapshot.currentWork?.disciplineId).toBe('prospecting');
      expect(again.snapshot.prospectingAccepted).toBe(1);
    });
  });
});
