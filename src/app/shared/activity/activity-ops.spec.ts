import {
  ACTIVITY_OPS_MAX,
  BASALT_SEAMWORKS_ID,
  CINDER_ORE_ID,
  EMBER_RESIDUE_ID,
  INFERNAL_HEARTSTONE_ID,
  MINING_TIERS,
  MINING_XP_PER_ACTION,
  ROOTGLASS_CANOPY_ID,
  SLAG_FRAGMENT_ID,
  emptyActivityLedger,
  isMiningTierUnlocked,
  miningTierFor,
  type ActivityLedger,
  type ActivityOperation,
  type HlcRevision,
} from './activity.model';
import {
  buildMineOperation,
  coerceActivityLedger,
  compareHlc,
  foragingEligibleCount,
  hasRiftKey,
  mergeActivityLedgers,
  miningEligibleCount,
  nextHlc,
  progressFromOps,
  rollDiscovery,
} from './activity-ops';
import { buildForageOperation } from './foraging-ops';
import { STARLIGHT_HERB_ID } from './foraging.model';

function hlc(wall: number, logical: number, device: string, sequence: number): HlcRevision {
  return { wallTimeMs: wall, logicalCounter: logical, deviceId: device, sequence };
}

function mine(id: string, extra: Partial<ActivityOperation> = {}): ActivityOperation {
  return buildMineOperation({
    id,
    deviceId: extra.hlcRevision?.deviceId ?? 'phone',
    previousHlc: extra.hlcRevision ? {
      ...extra.hlcRevision,
      sequence: extra.hlcRevision.sequence - 1,
    } : null,
    now: extra.hlcRevision?.wallTimeMs ?? 1_000,
    locationId: BASALT_SEAMWORKS_ID,
    discovery: extra.discovery ?? { rolled: true, result: 'none' },
  });
}

function forage(id: string, extra: Partial<ActivityOperation> = {}): ActivityOperation {
  return buildForageOperation({
    id,
    deviceId: extra.hlcRevision?.deviceId ?? 'phone',
    previousHlc: extra.hlcRevision ? {
      ...extra.hlcRevision,
      sequence: extra.hlcRevision.sequence - 1,
    } : null,
    now: extra.hlcRevision?.wallTimeMs ?? 1_000,
    locationId: ROOTGLASS_CANOPY_ID,
    discovery: extra.discovery ?? { rolled: true, result: 'none' },
  });
}

function ledger(partial: Partial<ActivityLedger> = {}): ActivityLedger {
  const operations = partial.operations ?? [];
  return {
    ...emptyActivityLedger(),
    ...partial,
    operations,
    progress: partial.progress ?? progressFromOps(operations),
  };
}

describe('C7 activity ops', () => {
  it('orders HLC by wall, logical, sequence, then deviceId', () => {
    expect(compareHlc(hlc(1, 0, 'b', 1), hlc(2, 0, 'a', 1))).toBeLessThan(0);
    expect(compareHlc(hlc(2, 0, 'b', 1), hlc(2, 1, 'a', 1))).toBeLessThan(0);
    expect(compareHlc(hlc(2, 1, 'b', 1), hlc(2, 1, 'a', 2))).toBeLessThan(0);
    expect(compareHlc(hlc(2, 1, 'a', 2), hlc(2, 1, 'b', 2))).toBeLessThan(0);
    expect(compareHlc(hlc(2, 1, 'a', 2), hlc(2, 1, 'a', 2))).toBe(0);
  });

  it('advances logical counter when the wall clock does not move', () => {
    const first = nextHlc(null, 'phone', 50);
    const same = nextHlc(first, 'phone', 50);
    expect(same.wallTimeMs).toBe(50);
    expect(same.logicalCounter).toBe(1);
    expect(same.sequence).toBe(2);
  });

  it('rolls 0.08% ember, then guarantees on the 800th eligible action', () => {
    expect(rollDiscovery({
      eligibleIndex: 1, previousEmber: false, craftedBasaltEdge: false, roll: 0.0007,
    }).result).toBe('ember-residue');
    expect(rollDiscovery({
      eligibleIndex: 3, previousEmber: false, craftedBasaltEdge: false, roll: 0.5,
    }).result).toBe('none');
    expect(rollDiscovery({
      eligibleIndex: 800, previousEmber: false, craftedBasaltEdge: false, roll: 0.99,
    }).result).toBe('first-craft-guarantee');
    expect(rollDiscovery({
      eligibleIndex: 800, previousEmber: true, craftedBasaltEdge: false, roll: 0.0001,
    }).result).toBe('none');
    expect(rollDiscovery({
      eligibleIndex: 800, previousEmber: false, craftedBasaltEdge: true, roll: 0.99,
    }).result).toBe('none');
  });

  it('stores ore, xp, and optional ember grant ids on the operation', () => {
    const op = buildMineOperation({
      id: 'm1', deviceId: 'phone', previousHlc: null, now: 10,
      locationId: BASALT_SEAMWORKS_ID,
      discovery: { rolled: true, result: 'first-craft-guarantee' },
    });
    expect(op.xpGrant).toEqual({ id: 'm1:xp', amount: MINING_XP_PER_ACTION });
    expect(op.inventoryGrants.map(row => row.definitionId)).toEqual([CINDER_ORE_ID, EMBER_RESIDUE_ID]);
  });

  it('merges two devices commutatively and does not double a grant id', () => {
    const a = ledger({ operations: [mine('a')] });
    const b = ledger({ operations: [mine('b')] });
    const ab = mergeActivityLedgers(a, b);
    const ba = mergeActivityLedgers(b, a);
    expect(ab.operations.map(row => row.id).sort()).toEqual(['a', 'b']);
    expect(ba.operations.map(row => row.id).sort()).toEqual(['a', 'b']);
    expect(ab.progress.xpByDiscipline.mining).toBe(4);
    expect(ba.progress.xpByDiscipline.mining).toBe(4);
    expect(mergeActivityLedgers(ab, ba).operations.length).toBe(2);
  });

  it('same operation id keeps the higher revision and does not reroll discovery', () => {
    const low = mine('same', {
      hlcRevision: hlc(1, 0, 'phone', 1),
      discovery: { rolled: true, result: 'none' },
    });
    const high: ActivityOperation = {
      ...low,
      hlcRevision: hlc(9, 0, 'tablet', 1),
      discovery: { rolled: true, result: 'ember-residue' },
    };
    const ab = mergeActivityLedgers(ledger({ operations: [low] }), ledger({ operations: [high] }));
    const ba = mergeActivityLedgers(ledger({ operations: [high] }), ledger({ operations: [low] }));
    expect(ab.operations.length).toBe(1);
    expect(ab.operations[0].discovery.result).toBe('ember-residue');
    expect(ba.operations[0].discovery.result).toBe('ember-residue');
  });

  it('rebuilds lastResolvedAt from the newest accepted op, not a stale cache', () => {
    const work = {
      version: 2 as const,
      disciplineId: 'mining' as const,
      locationId: BASALT_SEAMWORKS_ID,
      startedAt: '2026-01-01T00:00:00.000Z',
      lastResolvedAt: 'stale',
      selectionRevision: hlc(1, 0, 'phone', 1),
    };
    const op = mine('n', { hlcRevision: hlc(5, 0, 'phone', 2) });
    const merged = mergeActivityLedgers(
      ledger({ currentWork: work, operations: [op] }),
      ledger({ currentWork: { ...work, lastResolvedAt: 'other-stale' } }),
    );
    expect(merged.currentWork?.lastResolvedAt).toBe(op.resolvedAt);
  });

  it('grants the requested tier\'s ore and XP, not the Cinder Ore default', () => {
    const op = buildMineOperation({
      id: 'heartstone-1', deviceId: 'phone', previousHlc: null, now: 10,
      locationId: BASALT_SEAMWORKS_ID,
      oreId: INFERNAL_HEARTSTONE_ID,
      xpAmount: 12,
      discovery: { rolled: true, result: 'none' },
    });
    expect(op.xpGrant).toEqual({ id: 'heartstone-1:xp', amount: 12 });
    expect(op.inventoryGrants.map(row => row.definitionId)).toEqual([INFERNAL_HEARTSTONE_ID]);
  });

  it('defines three mining tiers with strictly increasing unlock levels and XP', () => {
    expect(MINING_TIERS.map(t => t.oreId)).toEqual([CINDER_ORE_ID, SLAG_FRAGMENT_ID, INFERNAL_HEARTSTONE_ID]);
    for (let i = 1; i < MINING_TIERS.length; i++) {
      expect(MINING_TIERS[i].unlockLevel).toBeGreaterThan(MINING_TIERS[i - 1].unlockLevel);
      expect(MINING_TIERS[i].xpPerAction).toBeGreaterThan(MINING_TIERS[i - 1].xpPerAction);
    }
    expect(MINING_TIERS[0].unlockLevel).toBe(1);
  });

  it('locks a tier below its level and opens it at or above', () => {
    const heartstone = miningTierFor(INFERNAL_HEARTSTONE_ID)!;
    expect(isMiningTierUnlocked(heartstone, 19)).toBe(false);
    expect(isMiningTierUnlocked(heartstone, 20)).toBe(true);
    expect(isMiningTierUnlocked(heartstone, 99)).toBe(true);
  });

  it('counts seamworks mining ops for the guarantee window', () => {
    const ops = [mine('1'), mine('2'), mine('3')];
    expect(miningEligibleCount(ops, BASALT_SEAMWORKS_ID)).toBe(3);
  });

  it('rejects a corrupt blob instead of inventing operations', () => {
    expect(coerceActivityLedger({ version: 1, operations: [{ id: 1 }] })).toEqual({
      version: 1,
      era: 0,
      currentWork: null,
      progress: emptyActivityLedger().progress,
      operations: [],
      craftedBasaltEdge: false,
      emberGranted: false,
      miningAccepted: 0,
      foragingAccepted: 0,
      riftKeyGranted: false,
    });
    expect(coerceActivityLedger({ version: 2 })).toBeNull();
  });

  // ── A2 Foraging ──────────────────────────────────────────────────────────

  it('loads a pre-A2 ledger that has no foraging fields with sane defaults and its mining intact', () => {
    // Exactly the shape a save written before A2 has on disk: version 1, the
    // mining pity fields, and nothing about foraging at all.
    const old = {
      version: 1,
      era: 55,
      currentWork: null,
      progress: { version: 1, xpByDiscipline: { mining: 6 } },
      operations: [mine('a'), mine('b'), mine('c')],
      craftedBasaltEdge: false,
      emberGranted: true,
      miningAccepted: 3,
    };
    const loaded = coerceActivityLedger(JSON.parse(JSON.stringify(old)))!;
    expect(loaded).not.toBeNull();
    expect(loaded.foragingAccepted).toBe(0);
    expect(loaded.riftKeyGranted).toBe(false);
    expect(loaded.progress.xpByDiscipline.mining).toBe(6);
    expect(loaded.progress.xpByDiscipline.foraging).toBeUndefined();
    expect(loaded.emberGranted).toBe(true);
    expect(loaded.miningAccepted).toBe(3);
    expect(loaded.operations.length).toBe(3);
  });

  it('parses foraging ops, rift-key discoveries and a foraging Current Work', () => {
    const work = {
      version: 2 as const,
      disciplineId: 'foraging' as const,
      locationId: ROOTGLASS_CANOPY_ID,
      startedAt: '2026-01-01T00:00:00.000Z',
      lastResolvedAt: '2026-01-01T00:00:00.000Z',
      selectionRevision: hlc(1, 0, 'phone', 1),
    };
    const ops = [
      forage('f1', { discovery: { rolled: true, result: 'rift-key' } }),
      forage('f2', { discovery: { rolled: true, result: 'rift-key-guarantee' } }),
      forage('f3'),
    ];
    const loaded = coerceActivityLedger(JSON.parse(JSON.stringify(ledger({ currentWork: work, operations: ops }))))!;
    expect(loaded.operations.map(op => op.discovery.result)).toEqual(['rift-key', 'rift-key-guarantee', 'none']);
    expect(loaded.currentWork?.disciplineId).toBe('foraging');
    expect(loaded.currentWork?.locationId).toBe(ROOTGLASS_CANOPY_ID);
    expect(loaded.progress.xpByDiscipline.foraging).toBe(6);
    expect(loaded.progress.xpByDiscipline.mining).toBeUndefined();
    expect(loaded.foragingAccepted).toBe(3);
    expect(loaded.riftKeyGranted).toBe(true);
    // The mining pity counters do not see foraging ops.
    expect(loaded.miningAccepted).toBe(0);
    expect(loaded.emberGranted).toBe(false);
    expect(loaded.operations[0].inventoryGrants.map(g => g.definitionId)).toEqual([STARLIGHT_HERB_ID, 'rift-key']);
  });

  it('counts only Canopy foraging ops for the rift-key window, and mining ops only for ember', () => {
    const ops = [forage('f1'), forage('f2'), mine('m1')];
    expect(foragingEligibleCount(ops, ROOTGLASS_CANOPY_ID)).toBe(2);
    expect(foragingEligibleCount(ops, BASALT_SEAMWORKS_ID)).toBe(0);
    expect(miningEligibleCount(ops, BASALT_SEAMWORKS_ID)).toBe(1);
    expect(hasRiftKey(ops)).toBe(false);
    expect(hasRiftKey([...ops, forage('f3', { discovery: { rolled: true, result: 'rift-key' } })])).toBe(true);
  });

  it('keeps Foraging XP, foragingAccepted and riftKeyGranted after the 256-op window drops oldest rows', () => {
    const early = Array.from({ length: 8 }, (_, i) => forage(`early-${i}`, {
      hlcRevision: hlc(i + 1, 0, 'phone', i + 1),
      discovery: { rolled: true, result: i === 7 ? 'rift-key-guarantee' : 'none' },
    }));
    const rest = Array.from({ length: ACTIVITY_OPS_MAX }, (_, i) => forage(`late-${i}`, {
      hlcRevision: hlc(100 + i, 0, 'phone', 20 + i),
      discovery: { rolled: true, result: 'none' },
    }));
    const full = ledger({ operations: [...early, ...rest] });
    expect(full.progress.xpByDiscipline.foraging).toBe((ACTIVITY_OPS_MAX + 8) * 2);
    const other = ledger({ operations: rest.slice(-10) });
    const ab = mergeActivityLedgers(full, other);
    const ba = mergeActivityLedgers(other, full);
    expect(ab.operations.length).toBe(ACTIVITY_OPS_MAX);
    expect(ab.progress.xpByDiscipline.foraging).toBe((ACTIVITY_OPS_MAX + 8) * 2);
    expect(ba.progress.xpByDiscipline.foraging).toBe(ab.progress.xpByDiscipline.foraging);
    expect(ab.riftKeyGranted).toBe(true);
    expect(ba.riftKeyGranted).toBe(true);
    expect(ab.foragingAccepted).toBe(ACTIVITY_OPS_MAX + 8);
    expect(ba.foragingAccepted).toBe(ACTIVITY_OPS_MAX + 8);
    expect(ab.operations.some(op => op.discovery.result === 'rift-key-guarantee')).toBe(false);
    // Foraging pity never bleeds into mining's, and vice versa.
    expect(ab.emberGranted).toBe(false);
    expect(ab.miningAccepted).toBe(0);
    expect(ab.progress.xpByDiscipline.mining).toBeUndefined();
  });

  it('drops prior-era mining when the other side is the current generation', () => {
    const oldMine = ledger({ era: 0, operations: [mine('old-strike')] });
    const fresh = ledger({ era: 55 });
    const ab = mergeActivityLedgers(oldMine, fresh);
    const ba = mergeActivityLedgers(fresh, oldMine);
    expect(ab.era).toBe(55);
    expect(ab.operations).toEqual([]);
    expect(ba.operations).toEqual([]);
  });

  it('keeps Mining XP and ember after the 256-op window drops oldest rows', () => {
    const early = Array.from({ length: 8 }, (_, i) => mine(`early-${i}`, {
      hlcRevision: hlc(i + 1, 0, 'phone', i + 1),
      discovery: { rolled: true, result: i === 7 ? 'first-craft-guarantee' : 'none' },
    }));
    const rest = Array.from({ length: ACTIVITY_OPS_MAX }, (_, i) => mine(`late-${i}`, {
      hlcRevision: hlc(100 + i, 0, 'phone', 20 + i),
      discovery: { rolled: true, result: 'none' },
    }));
    const full = ledger({ operations: [...early, ...rest] });
    expect(full.progress.xpByDiscipline.mining).toBe((ACTIVITY_OPS_MAX + 8) * 2);
    const other = ledger({ operations: rest.slice(-10) });
    const ab = mergeActivityLedgers(full, other);
    const ba = mergeActivityLedgers(other, full);
    expect(ab.operations.length).toBe(ACTIVITY_OPS_MAX);
    expect(ab.progress.xpByDiscipline.mining).toBe((ACTIVITY_OPS_MAX + 8) * 2);
    expect(ba.progress.xpByDiscipline.mining).toBe(ab.progress.xpByDiscipline.mining);
    expect(ab.emberGranted).toBe(true);
    expect(ab.miningAccepted).toBe(ACTIVITY_OPS_MAX + 8);
    expect(ab.operations.some(op => op.discovery.result === 'first-craft-guarantee')).toBe(false);
  });
});
