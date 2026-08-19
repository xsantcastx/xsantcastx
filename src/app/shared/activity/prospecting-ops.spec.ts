import { BASALT_SEAMWORKS_ID, MERIDIAN_ORRERY_ID, ROOTGLASS_CANOPY_ID } from './activity.model';
import {
  CELESTIAL_ALLOY_ID,
  CLARITY_ELIXIR_CHANCE,
  CLARITY_ELIXIR_GUARANTEE_AT,
  CLARITY_ELIXIR_ID,
  LUMINOUS_PRISM_ID,
  PROSPECTING_RECOVERY_MS,
  PROSPECTING_TIERS,
  PROSPECTING_XP_PER_ACTION,
  UMBRAL_INK_ID,
  VERDANT_SAP_ID,
  VOID_SHARD_ID,
  isProspectingTierUnlocked,
  prospectingTierFor,
} from './prospecting.model';
import {
  PROSPECTING_RECOVERY_FLOOR_MS,
  buildProspectOperation,
  effectiveProspectingRecoveryMs,
  isEnabledProspect,
  prospectingSpeedupPct,
  rollProspectDiscovery,
} from './prospecting-ops';

describe('B1 prospecting ops', () => {
  // ── the tier table ────────────────────────────────────────────────────────

  it('defines five cuts at L1/7/15/24/34 with strictly rising unlock levels and XP', () => {
    expect(PROSPECTING_TIERS.map(t => t.mineralId)).toEqual([
      CELESTIAL_ALLOY_ID, LUMINOUS_PRISM_ID, VERDANT_SAP_ID, UMBRAL_INK_ID, VOID_SHARD_ID,
    ]);
    expect(PROSPECTING_TIERS.map(t => t.unlockLevel)).toEqual([1, 7, 15, 24, 34]);
    expect(PROSPECTING_TIERS.map(t => t.xpPerAction)).toEqual([2, 5, 9, 14, 19]);
    for (let i = 1; i < PROSPECTING_TIERS.length; i++) {
      expect(PROSPECTING_TIERS[i].unlockLevel).toBeGreaterThan(PROSPECTING_TIERS[i - 1].unlockLevel);
      expect(PROSPECTING_TIERS[i].xpPerAction).toBeGreaterThan(PROSPECTING_TIERS[i - 1].xpPerAction);
    }
    expect(PROSPECTING_TIERS[0].unlockLevel).toBe(1);
    expect(PROSPECTING_TIERS[0].xpPerAction).toBe(PROSPECTING_XP_PER_ACTION);
  });

  it('locks a cut below its level and opens it at or above', () => {
    const voidShard = prospectingTierFor(VOID_SHARD_ID)!;
    expect(isProspectingTierUnlocked(voidShard, 33)).toBe(false);
    expect(isProspectingTierUnlocked(voidShard, 34)).toBe(true);
    expect(isProspectingTierUnlocked(voidShard, 99)).toBe(true);
    expect(prospectingTierFor('cinder-ore')).toBeUndefined();
  });

  // ── the operation builder ─────────────────────────────────────────────────

  it('builds a Celestial Alloy + 2 XP prospecting op by default', () => {
    const op = buildProspectOperation({
      id: 'p1', deviceId: 'phone', previousHlc: null, now: 10,
      locationId: MERIDIAN_ORRERY_ID,
      discovery: { rolled: true, result: 'none' },
    });
    expect(op.disciplineId).toBe('prospecting');
    expect(op.locationId).toBe(MERIDIAN_ORRERY_ID);
    expect(op.xpGrant).toEqual({ id: 'p1:xp', amount: PROSPECTING_XP_PER_ACTION });
    expect(op.inventoryGrants).toEqual([{ id: 'p1:mineral', definitionId: CELESTIAL_ALLOY_ID, quantity: 1 }]);
  });

  it('grants the requested cut and XP, plus a Clarity Elixir when the find lands', () => {
    const op = buildProspectOperation({
      id: 'p2', deviceId: 'phone', previousHlc: null, now: 10,
      locationId: MERIDIAN_ORRERY_ID,
      mineralId: VOID_SHARD_ID,
      xpAmount: 19,
      discovery: { rolled: true, result: 'clarity-elixir' },
    });
    expect(op.xpGrant.amount).toBe(19);
    expect(op.inventoryGrants).toEqual([
      { id: 'p2:mineral', definitionId: VOID_SHARD_ID, quantity: 1 },
      { id: 'p2:clarity-elixir', definitionId: CLARITY_ELIXIR_ID, quantity: 1 },
    ]);
  });

  it('grants the elixir on a pity result too, not only a rolled one', () => {
    const op = buildProspectOperation({
      id: 'p3', deviceId: 'phone', previousHlc: null, now: 10,
      locationId: MERIDIAN_ORRERY_ID,
      discovery: { rolled: true, result: 'clarity-elixir-guarantee' },
    });
    expect(op.inventoryGrants.length).toBe(2);
    expect(op.inventoryGrants[1].definitionId).toBe(CLARITY_ELIXIR_ID);
  });

  // ── the rare-find roll ────────────────────────────────────────────────────

  it('drops the elixir just under the rate and nothing at or above it', () => {
    const under = rollProspectDiscovery({
      eligibleIndex: 5, previousClarityElixir: false, roll: CLARITY_ELIXIR_CHANCE - 1e-9,
    });
    expect(under.result).toBe('clarity-elixir');
    const at = rollProspectDiscovery({
      eligibleIndex: 5, previousClarityElixir: false, roll: CLARITY_ELIXIR_CHANCE,
    });
    expect(at.result).toBe('none');
  });

  it('guarantees the first elixir on the CLARITY_ELIXIR_GUARANTEE_AT-th survey and not before', () => {
    const before = rollProspectDiscovery({
      eligibleIndex: CLARITY_ELIXIR_GUARANTEE_AT - 1, previousClarityElixir: false, roll: 0.99,
    });
    expect(before.result).toBe('none');
    const at = rollProspectDiscovery({
      eligibleIndex: CLARITY_ELIXIR_GUARANTEE_AT, previousClarityElixir: false, roll: 0.99,
    });
    expect(at.result).toBe('clarity-elixir-guarantee');
  });

  it('keeps rolling at rate after the first find, with no second guarantee', () => {
    // The spec's default post-first-find policy (§5.2) — Foraging's, not
    // Mining's latch. The elixir is a consumable with no craft hook to gate on.
    const pastGuarantee = rollProspectDiscovery({
      eligibleIndex: CLARITY_ELIXIR_GUARANTEE_AT * 3, previousClarityElixir: true, roll: 0.99,
    });
    expect(pastGuarantee.result).toBe('none');
    const lucky = rollProspectDiscovery({
      eligibleIndex: CLARITY_ELIXIR_GUARANTEE_AT * 3, previousClarityElixir: true, roll: 0,
    });
    expect(lucky.result).toBe('clarity-elixir');
  });

  it('fails closed on a NaN or out-of-range roll', () => {
    expect(rollProspectDiscovery({ eligibleIndex: 5, previousClarityElixir: false, roll: NaN }).result).toBe('none');
    expect(rollProspectDiscovery({ eligibleIndex: 5, previousClarityElixir: false, roll: 2 }).result).toBe('none');
    expect(rollProspectDiscovery({ eligibleIndex: 5, previousClarityElixir: false, roll: -1 }).result).toBe('clarity-elixir');
  });

  // ── recovery ──────────────────────────────────────────────────────────────

  it('returns the flat baseline at level 1 and shortens 1% per level to a 35% cap', () => {
    expect(effectiveProspectingRecoveryMs(1)).toBe(PROSPECTING_RECOVERY_MS);
    expect(effectiveProspectingRecoveryMs(11)).toBe(Math.round(PROSPECTING_RECOVERY_MS * 0.9));
    expect(effectiveProspectingRecoveryMs(36)).toBe(Math.round(PROSPECTING_RECOVERY_MS * 0.65));
    expect(effectiveProspectingRecoveryMs(50)).toBe(effectiveProspectingRecoveryMs(36));
    expect(effectiveProspectingRecoveryMs(NaN)).toBe(PROSPECTING_RECOVERY_MS);
  });

  it('never returns less than the floor', () => {
    for (const level of [1, 20, 36, 999]) {
      expect(effectiveProspectingRecoveryMs(level)).toBeGreaterThanOrEqual(PROSPECTING_RECOVERY_FLOOR_MS);
    }
  });

  it('reports the speedup as a whole percent, 0 at level 1', () => {
    expect(prospectingSpeedupPct(1)).toBe(0);
    expect(prospectingSpeedupPct(11)).toBe(10);
    expect(prospectingSpeedupPct(36)).toBe(35);
    expect(prospectingSpeedupPct(99)).toBe(35);
  });

  // ── the location check ────────────────────────────────────────────────────

  it('enables prospecting only at the Orrery, and only for prospecting', () => {
    expect(isEnabledProspect(MERIDIAN_ORRERY_ID, 'prospecting')).toBe(true);
    expect(isEnabledProspect(MERIDIAN_ORRERY_ID, 'mining')).toBe(false);
    expect(isEnabledProspect(MERIDIAN_ORRERY_ID, 'foraging')).toBe(false);
    expect(isEnabledProspect(BASALT_SEAMWORKS_ID, 'prospecting')).toBe(false);
    expect(isEnabledProspect(ROOTGLASS_CANOPY_ID, 'prospecting')).toBe(false);
    expect(isEnabledProspect('celestial/nowhere', 'prospecting')).toBe(false);
  });
});
