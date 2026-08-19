/**
 * prospecting-ops.ts — B1 Prospecting: the rare-find roll, the operation
 * builder, the location check, and the recovery curve.
 *
 * Mirrors foraging-ops.ts, which the skill authoring spec §2.1 names as the
 * layout skill N copies: all six exports in one ops file, because recovery is
 * still a single factor. It earns its own prospecting-recovery.ts the day a
 * second factor exists, and not before.
 *
 * Import direction: this file takes nextHlc from activity-ops.ts, so
 * activity-ops.ts must never import from here. That is why
 * prospectingEligibleCount and hasClarityElixir — which coerce/merge need —
 * live over there beside their mining and foraging twins.
 *
 * Recovery is a level term only. Mining's cooldown also shortens with the
 * weapon slot's strikePower because a pickaxe lives in the weapon slot. No
 * prospecting tool stat exists on any item — the spec is explicit that a gear
 * term is earned only by a stat whose *meaning* is this skill's tool, and
 * borrowing strikePower would let a sword speed up reading a star chart. So
 * the Orrery's speedup copy honestly says "Your level:", exactly like the
 * Canopy's.
 */
import { nextHlc } from './activity-ops';
import {
  locationDefinition,
  type ActivityDiscovery,
  type ActivityInventoryGrant,
  type ActivityOperation,
  type DisciplineId,
  type HlcRevision,
} from './activity.model';
import {
  CELESTIAL_ALLOY_ID,
  CLARITY_ELIXIR_CHANCE,
  CLARITY_ELIXIR_GUARANTEE_AT,
  CLARITY_ELIXIR_ID,
  MERIDIAN_ORRERY_ID,
  PROSPECTING_RECOVERY_MS,
  PROSPECTING_XP_PER_ACTION,
} from './prospecting.model';

/**
 * 0.07% Clarity Elixir on any survey; the CLARITY_ELIXIR_GUARANTEE_AT-th
 * accepted survey guarantees the first if none has landed. After the first
 * elixir, elixirs keep rolling at 0.07% with no further guarantee — the spec's
 * default (§5.2). Mining's "previousEmber → none" latch exists only because
 * Ember is a one-shot craft ingredient gated on craftedBasaltEdge; the elixir
 * is a consumable with no such story hook, so there is nothing to latch.
 *
 * Pure and total: no clock, no storage, and a NaN or out-of-range roll clamps
 * to 1 so it fails closed rather than handing out a free rare.
 */
export function rollProspectDiscovery(input: {
  eligibleIndex: number;
  previousClarityElixir: boolean;
  roll: number;
}): ActivityDiscovery {
  const roll = Number.isFinite(input.roll) ? Math.min(1, Math.max(0, input.roll)) : 1;
  if (!input.previousClarityElixir && input.eligibleIndex >= CLARITY_ELIXIR_GUARANTEE_AT) {
    return { rolled: true, result: 'clarity-elixir-guarantee' };
  }
  return { rolled: true, result: roll < CLARITY_ELIXIR_CHANCE ? 'clarity-elixir' : 'none' };
}

export function buildProspectOperation(input: {
  id: string;
  deviceId: string;
  previousHlc: HlcRevision | null;
  now: number;
  locationId: string;
  /** Defaults to Celestial Alloy — the always-unlocked tier. */
  mineralId?: string;
  xpAmount?: number;
  discovery: ActivityDiscovery;
}): ActivityOperation {
  const mineralId = input.mineralId ?? CELESTIAL_ALLOY_ID;
  const xpAmount = input.xpAmount ?? PROSPECTING_XP_PER_ACTION;
  const grants: ActivityInventoryGrant[] = [{
    id: `${input.id}:mineral`,
    definitionId: mineralId,
    quantity: 1,
  }];
  if (input.discovery.result !== 'none') {
    grants.push({
      id: `${input.id}:clarity-elixir`,
      definitionId: CLARITY_ELIXIR_ID,
      quantity: 1,
    });
  }
  return {
    id: input.id,
    hlcRevision: nextHlc(input.previousHlc, input.deviceId, input.now),
    kind: 'active',
    disciplineId: 'prospecting',
    locationId: input.locationId,
    resolvedAt: new Date(input.now).toISOString(),
    xpGrant: { id: `${input.id}:xp`, amount: xpAmount },
    inventoryGrants: grants,
    discovery: input.discovery,
  };
}

export function isEnabledProspect(locationId: string, discipline: DisciplineId): boolean {
  const def = locationDefinition(locationId);
  return !!def && def.enabledDisciplines.includes(discipline) && locationId === MERIDIAN_ORRERY_ID;
}

/**
 * Hard backstop under today's single cap (35% → 1,625ms), same reasoning as
 * MINING_RECOVERY_FLOOR_MS and FORAGING_RECOVERY_FLOOR_MS: unreachable now,
 * it exists so a widened cap or a future tool stat can never make a survey
 * a blur.
 */
export const PROSPECTING_RECOVERY_FLOOR_MS = 1200;

const LEVEL_SPEEDUP_PER_LEVEL = 0.01;
const LEVEL_SPEEDUP_CAP = 0.35;

/** 1% shorter per level above 1, capped at 35% (reached at 36). Level 1 is the flat baseline. */
export function effectiveProspectingRecoveryMs(level: number): number {
  const lvl = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const levelFactor = 1 - Math.min(LEVEL_SPEEDUP_CAP, (lvl - 1) * LEVEL_SPEEDUP_PER_LEVEL);
  return Math.max(PROSPECTING_RECOVERY_FLOOR_MS, Math.round(PROSPECTING_RECOVERY_MS * levelFactor));
}

/** Whole-percent readout for the Orrery page. 0 means hide the line, not print "0% faster". */
export function prospectingSpeedupPct(level: number): number {
  const effective = effectiveProspectingRecoveryMs(level);
  return Math.max(0, Math.round((1 - effective / PROSPECTING_RECOVERY_MS) * 100));
}
