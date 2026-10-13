/**
 * foraging-ops.ts — A2 Foraging: the operation builder, the location check,
 * and the recovery curve. Foraging has no rare find (the Rift Key opened no
 * route in the world and was removed), so a gather never rolls discovery.
 *
 * Mirrors activity-ops.ts's buildMineOperation / isEnabledMine
 * and mining-recovery.ts's effectiveMiningRecoveryMs, concretely and by hand.
 * Not generalised: the brief says copy Mining's vertical, and a third skill
 * gets to decide what these two actually share.
 *
 * Import direction: this file takes nextHlc from activity-ops.ts, so
 * activity-ops.ts must never import from here. That is why
 * foragingEligibleCount — which coerce/merge need — lives over there beside
 * its mining twin.
 *
 * Recovery is a level term only. Mining's cooldown also shortens with the
 * weapon slot's strikePower, because a pickaxe lives in the weapon slot and a
 * sharper edge breaks ore faster. No gathering stat exists on any item yet;
 * wiring strikePower in here would make a sword speed up herb-picking. When a
 * foraging tool stat is authored, it plugs in as a second factor exactly where
 * gearFactor sits in mining-recovery.ts. Until then the Canopy's speedup copy
 * honestly says "Your level:", not "level and weapon".
 */
import { nextHlc } from './activity-ops';
import {
  locationDefinition,
  type ActivityInventoryGrant,
  type ActivityOperation,
  type DisciplineId,
  type HlcRevision,
} from './activity.model';
import {
  FORAGING_RECOVERY_MS,
  FORAGING_XP_PER_ACTION,
  ROOTGLASS_CANOPY_ID,
  STARLIGHT_HERB_ID,
} from './foraging.model';

export function buildForageOperation(input: {
  id: string;
  deviceId: string;
  previousHlc: HlcRevision | null;
  now: number;
  locationId: string;
  /** Defaults to Starlight Herb — the always-unlocked tier. */
  herbId?: string;
  xpAmount?: number;
}): ActivityOperation {
  const herbId = input.herbId ?? STARLIGHT_HERB_ID;
  const xpAmount = input.xpAmount ?? FORAGING_XP_PER_ACTION;
  const grants: ActivityInventoryGrant[] = [{
    id: `${input.id}:herb`,
    definitionId: herbId,
    quantity: 1,
  }];
  return {
    id: input.id,
    hlcRevision: nextHlc(input.previousHlc, input.deviceId, input.now),
    kind: 'active',
    disciplineId: 'foraging',
    locationId: input.locationId,
    resolvedAt: new Date(input.now).toISOString(),
    xpGrant: { id: `${input.id}:xp`, amount: xpAmount },
    inventoryGrants: grants,
    discovery: { rolled: false, result: 'none' },
  };
}

export function isEnabledForage(locationId: string, discipline: DisciplineId): boolean {
  const def = locationDefinition(locationId);
  return !!def && def.enabledDisciplines.includes(discipline) && locationId === ROOTGLASS_CANOPY_ID;
}

/**
 * Hard backstop under today's single cap (35% → 1,625ms), same reasoning as
 * MINING_RECOVERY_FLOOR_MS: if a tool stat is ever added and the compounded
 * caps drift, this is what stops a gather becoming a blur.
 */
export const FORAGING_RECOVERY_FLOOR_MS = 1200;

const LEVEL_SPEEDUP_PER_LEVEL = 0.01;
const LEVEL_SPEEDUP_CAP = 0.35;

/** 1% shorter per level above 1, capped at 35% (reached at 36). Level 1 is the flat baseline. */
export function effectiveForagingRecoveryMs(level: number): number {
  const lvl = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const levelFactor = 1 - Math.min(LEVEL_SPEEDUP_CAP, (lvl - 1) * LEVEL_SPEEDUP_PER_LEVEL);
  return Math.max(FORAGING_RECOVERY_FLOOR_MS, Math.round(FORAGING_RECOVERY_MS * levelFactor));
}

/** Whole-percent readout for the Canopy page. 0 means hide the line, not print "0% faster". */
export function foragingSpeedupPct(level: number): number {
  const effective = effectiveForagingRecoveryMs(level);
  return Math.max(0, Math.round((1 - effective / FORAGING_RECOVERY_MS) * 100));
}
