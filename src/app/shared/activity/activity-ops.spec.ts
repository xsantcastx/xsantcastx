import {
  ACTIVITY_OPS_MAX,
  BASALT_SEAMWORKS_ID,
  CINDER_ORE_ID,
  EMBER_RESIDUE_ID,
  MINING_XP_PER_ACTION,
  emptyActivityLedger,
  type ActivityLedger,
  type ActivityOperation,
  type HlcRevision,
} from './activity.model';
import {
  buildMineOperation,
  coerceActivityLedger,
  compareHlc,
  mergeActivityLedgers,
  miningEligibleCount,
  nextHlc,
  progressFromOps,
  rollDiscovery,
} from './activity-ops';

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

  it('counts seamworks mining ops for the guarantee window', () => {
    const ops = [mine('1'), mine('2'), mine('3')];
    expect(miningEligibleCount(ops, BASALT_SEAMWORKS_ID)).toBe(3);
  });

  it('rejects a corrupt blob instead of inventing operations', () => {
    expect(coerceActivityLedger({ version: 1, operations: [{ id: 1 }] })).toEqual({
      version: 1,
      currentWork: null,
      progress: emptyActivityLedger().progress,
      operations: [],
      craftedBasaltEdge: false,
      emberGranted: false,
      miningAccepted: 0,
    });
    expect(coerceActivityLedger({ version: 2 })).toBeNull();
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
