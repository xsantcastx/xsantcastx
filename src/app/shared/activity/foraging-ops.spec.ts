import { BASALT_SEAMWORKS_ID, ROOTGLASS_CANOPY_ID } from './activity.model';
import {
  FORAGING_RECOVERY_MS,
  FORAGING_TIERS,
  FORAGING_XP_PER_ACTION,
  NIGHTBLOOM_ID,
  RIFT_KEY_GUARANTEE_AT,
  RIFT_KEY_ID,
  STARLIGHT_HERB_ID,
  SUNBLOOM_ID,
  THORNROOT_ID,
  foragingTierFor,
  isForagingTierUnlocked,
} from './foraging.model';
import {
  FORAGING_RECOVERY_FLOOR_MS,
  buildForageOperation,
  effectiveForagingRecoveryMs,
  foragingSpeedupPct,
  isEnabledForage,
  rollForageDiscovery,
} from './foraging-ops';

describe('A2 foraging ops', () => {
  it('defines four growths at L1/6/14/25 with strictly rising unlock levels and XP', () => {
    expect(FORAGING_TIERS.map(t => t.herbId)).toEqual([STARLIGHT_HERB_ID, SUNBLOOM_ID, NIGHTBLOOM_ID, THORNROOT_ID]);
    expect(FORAGING_TIERS.map(t => t.unlockLevel)).toEqual([1, 6, 14, 25]);
    for (let i = 1; i < FORAGING_TIERS.length; i++) {
      expect(FORAGING_TIERS[i].unlockLevel).toBeGreaterThan(FORAGING_TIERS[i - 1].unlockLevel);
      expect(FORAGING_TIERS[i].xpPerAction).toBeGreaterThan(FORAGING_TIERS[i - 1].xpPerAction);
    }
    expect(FORAGING_TIERS[0].unlockLevel).toBe(1);
    expect(FORAGING_TIERS[0].xpPerAction).toBe(FORAGING_XP_PER_ACTION);
  });

  it('locks a growth below its level and opens it at or above', () => {
    const thornroot = foragingTierFor(THORNROOT_ID)!;
    expect(isForagingTierUnlocked(thornroot, 24)).toBe(false);
    expect(isForagingTierUnlocked(thornroot, 25)).toBe(true);
    expect(isForagingTierUnlocked(thornroot, 99)).toBe(true);
    expect(foragingTierFor('cinder-ore')).toBeUndefined();
  });

  it('builds a Starlight Herb + 2 XP foraging op by default', () => {
    const op = buildForageOperation({
      id: 'f1', deviceId: 'phone', previousHlc: null, now: 10,
      locationId: ROOTGLASS_CANOPY_ID,
      discovery: { rolled: true, result: 'none' },
    });
    expect(op.disciplineId).toBe('foraging');
    expect(op.locationId).toBe(ROOTGLASS_CANOPY_ID);
    expect(op.xpGrant).toEqual({ id: 'f1:xp', amount: FORAGING_XP_PER_ACTION });
    expect(op.inventoryGrants).toEqual([{ id: 'f1:herb', definitionId: STARLIGHT_HERB_ID, quantity: 1 }]);
  });

  it('grants the requested growth and XP, plus a Rift Key when the find lands', () => {
    const op = buildForageOperation({
      id: 'f2', deviceId: 'phone', previousHlc: null, now: 10,
      locationId: ROOTGLASS_CANOPY_ID,
      herbId: THORNROOT_ID,
      xpAmount: 15,
      discovery: { rolled: true, result: 'rift-key' },
    });
    expect(op.xpGrant).toEqual({ id: 'f2:xp', amount: 15 });
    expect(op.inventoryGrants.map(g => g.definitionId)).toEqual([THORNROOT_ID, RIFT_KEY_ID]);
    expect(op.inventoryGrants.map(g => g.id)).toEqual(['f2:herb', 'f2:rift-key']);
  });

  it('rolls 0.1% Rift Key, guarantees the first on the 600th gather, and keeps rolling after', () => {
    expect(rollForageDiscovery({ eligibleIndex: 1, previousRiftKey: false, roll: 0.0009 }).result).toBe('rift-key');
    expect(rollForageDiscovery({ eligibleIndex: 1, previousRiftKey: false, roll: 0.001 }).result).toBe('none');
    expect(rollForageDiscovery({ eligibleIndex: RIFT_KEY_GUARANTEE_AT - 1, previousRiftKey: false, roll: 0.99 }).result).toBe('none');
    expect(rollForageDiscovery({ eligibleIndex: RIFT_KEY_GUARANTEE_AT, previousRiftKey: false, roll: 0.99 }).result).toBe('rift-key-guarantee');
    // After the first key: no second guarantee, but the 0.1% roll stays live.
    expect(rollForageDiscovery({ eligibleIndex: RIFT_KEY_GUARANTEE_AT, previousRiftKey: true, roll: 0.99 }).result).toBe('none');
    expect(rollForageDiscovery({ eligibleIndex: RIFT_KEY_GUARANTEE_AT + 5, previousRiftKey: true, roll: 0.0005 }).result).toBe('rift-key');
    // A broken roll fails closed.
    expect(rollForageDiscovery({ eligibleIndex: 1, previousRiftKey: false, roll: Number.NaN }).result).toBe('none');
  });

  it('shortens regrowth 1% per level above 1, caps at 35%, and never drops under the floor', () => {
    expect(effectiveForagingRecoveryMs(1)).toBe(FORAGING_RECOVERY_MS);
    expect(effectiveForagingRecoveryMs(11)).toBe(2250);
    expect(effectiveForagingRecoveryMs(36)).toBe(1625);
    expect(effectiveForagingRecoveryMs(50)).toBe(1625);
    expect(effectiveForagingRecoveryMs(36)).toBeGreaterThanOrEqual(FORAGING_RECOVERY_FLOOR_MS);
    expect(effectiveForagingRecoveryMs(Number.NaN)).toBe(FORAGING_RECOVERY_MS);
    expect(foragingSpeedupPct(1)).toBe(0);
    expect(foragingSpeedupPct(11)).toBe(10);
    expect(foragingSpeedupPct(36)).toBe(35);
  });

  it('enables foraging only at the Canopy and only for the foraging discipline', () => {
    expect(isEnabledForage(ROOTGLASS_CANOPY_ID, 'foraging')).toBe(true);
    expect(isEnabledForage(BASALT_SEAMWORKS_ID, 'foraging')).toBe(false);
    expect(isEnabledForage(ROOTGLASS_CANOPY_ID, 'mining')).toBe(false);
    expect(isEnabledForage('celestial/nowhere', 'foraging')).toBe(false);
  });
});
