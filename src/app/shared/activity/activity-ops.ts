/**
 * activity-ops.ts — HLC order, discovery, merge, parse.
 *
 * Merge unions immutable operations by id. XP and material totals are derived
 * from unique grant IDs. A stored discovery is never rerolled.
 */
import {
  ACTIVITY_OPS_MAX,
  ACTIVITY_SCHEMA_VERSION,
  BASALT_SEAMWORKS_ID,
  CINDER_ORE_ID,
  EMBER_DISCOVERY_CHANCE,
  EMBER_GUARANTEE_AT,
  EMBER_RESIDUE_ID,
  MINING_XP_PER_ACTION,
  emptyActivityLedger,
  locationDefinition,
  type ActivityDiscovery,
  type ActivityInventoryGrant,
  type ActivityLedger,
  type ActivityOperation,
  type ActivityXpGrant,
  type CurrentWork,
  type DisciplineId,
  type DisciplineProgress,
  type DiscoveryResult,
  type HlcRevision,
} from './activity.model';

export function compareHlc(a: HlcRevision, b: HlcRevision): number {
  if (a.wallTimeMs !== b.wallTimeMs) return a.wallTimeMs - b.wallTimeMs;
  if (a.logicalCounter !== b.logicalCounter) return a.logicalCounter - b.logicalCounter;
  if (a.sequence !== b.sequence) return a.sequence - b.sequence;
  if (a.deviceId === b.deviceId) return 0;
  return a.deviceId < b.deviceId ? -1 : 1;
}

export function nextHlc(previous: HlcRevision | null, deviceId: string, wallTimeMs: number): HlcRevision {
  const wall = Math.max(0, wallTimeMs);
  if (!previous) {
    return { wallTimeMs: wall, logicalCounter: 0, deviceId, sequence: 1 };
  }
  const nextWall = Math.max(wall, previous.wallTimeMs);
  const logical = nextWall === previous.wallTimeMs ? previous.logicalCounter + 1 : 0;
  const sequence = (previous.deviceId === deviceId ? previous.sequence : 0) + 1;
  return { wallTimeMs: nextWall, logicalCounter: logical, deviceId, sequence };
}

export function newestOperation(
  ops: readonly ActivityOperation[],
  work: Pick<CurrentWork, 'disciplineId' | 'locationId'> | null,
): ActivityOperation | null {
  let best: ActivityOperation | null = null;
  for (const op of ops) {
    if (work && (op.disciplineId !== work.disciplineId || op.locationId !== work.locationId)) continue;
    if (!best || compareHlc(op.hlcRevision, best.hlcRevision) > 0) best = op;
  }
  return best;
}

export function miningEligibleCount(ops: readonly ActivityOperation[], locationId: string): number {
  let n = 0;
  for (const op of ops) {
    if (op.disciplineId === 'mining' && op.locationId === locationId) n += 1;
  }
  return n;
}

export function hasEmberBeforeCraft(ops: readonly ActivityOperation[]): boolean {
  return ops.some(op =>
    op.discovery.result === 'ember-residue' || op.discovery.result === 'first-craft-guarantee',
  );
}

export function rollDiscovery(input: {
  eligibleIndex: number;
  previousEmber: boolean;
  craftedBasaltEdge: boolean;
  roll: number;
}): ActivityDiscovery {
  const roll = Number.isFinite(input.roll) ? Math.min(1, Math.max(0, input.roll)) : 1;
  if (input.craftedBasaltEdge) {
    return { rolled: true, result: roll < EMBER_DISCOVERY_CHANCE ? 'ember-residue' : 'none' };
  }
  if (input.previousEmber) return { rolled: true, result: 'none' };
  if (input.eligibleIndex >= EMBER_GUARANTEE_AT) {
    return { rolled: true, result: 'first-craft-guarantee' };
  }
  return { rolled: true, result: roll < EMBER_DISCOVERY_CHANCE ? 'ember-residue' : 'none' };
}

export function buildMineOperation(input: {
  id: string;
  deviceId: string;
  previousHlc: HlcRevision | null;
  now: number;
  locationId: string;
  discovery: ActivityDiscovery;
}): ActivityOperation {
  const grants: ActivityInventoryGrant[] = [{
    id: `${input.id}:ore`,
    definitionId: CINDER_ORE_ID,
    quantity: 1,
  }];
  if (input.discovery.result !== 'none') {
    grants.push({
      id: `${input.id}:ember`,
      definitionId: EMBER_RESIDUE_ID,
      quantity: 1,
    });
  }
  return {
    id: input.id,
    hlcRevision: nextHlc(input.previousHlc, input.deviceId, input.now),
    kind: 'active',
    disciplineId: 'mining',
    locationId: input.locationId,
    resolvedAt: new Date(input.now).toISOString(),
    xpGrant: { id: `${input.id}:xp`, amount: MINING_XP_PER_ACTION },
    inventoryGrants: grants,
    discovery: input.discovery,
  };
}

export function progressFromOps(ops: readonly ActivityOperation[]): DisciplineProgress {
  const seen = new Set<string>();
  const xpByDiscipline: Partial<Record<DisciplineId, number>> = {};
  for (const op of ops) {
    if (seen.has(op.xpGrant.id)) continue;
    seen.add(op.xpGrant.id);
    xpByDiscipline[op.disciplineId] = (xpByDiscipline[op.disciplineId] ?? 0) + op.xpGrant.amount;
  }
  return { version: 1, xpByDiscipline };
}

export function rebuildCurrentWork(work: CurrentWork | null, ops: readonly ActivityOperation[]): CurrentWork | null {
  if (!work) return null;
  const newest = newestOperation(ops, work);
  return {
    ...work,
    lastResolvedAt: newest?.resolvedAt ?? work.startedAt,
  };
}

export function mergeActivityLedgers(remote: unknown, local: unknown): ActivityLedger {
  const a = coerceActivityLedger(remote) ?? emptyActivityLedger();
  const b = coerceActivityLedger(local) ?? emptyActivityLedger();
  const byId = new Map<string, ActivityOperation>();
  for (const op of [...a.operations, ...b.operations]) {
    const held = byId.get(op.id);
    if (!held || compareHlc(op.hlcRevision, held.hlcRevision) > 0) byId.set(op.id, op);
  }
  let operations = [...byId.values()].sort((x, y) => compareHlc(x.hlcRevision, y.hlcRevision));
  if (operations.length > ACTIVITY_OPS_MAX) operations = operations.slice(-ACTIVITY_OPS_MAX);
  const currentWork = pickCurrentWork(a.currentWork, b.currentWork);
  return {
    version: ACTIVITY_SCHEMA_VERSION,
    currentWork: rebuildCurrentWork(currentWork, operations),
    progress: progressFromOps(operations),
    operations,
    craftedBasaltEdge: a.craftedBasaltEdge || b.craftedBasaltEdge,
  };
}

function pickCurrentWork(a: CurrentWork | null, b: CurrentWork | null): CurrentWork | null {
  if (!a) return b;
  if (!b) return a;
  return compareHlc(a.selectionRevision, b.selectionRevision) >= 0 ? a : b;
}

export function coerceActivityLedger(raw: unknown): ActivityLedger | null {
  if (!isPlain(raw)) return null;
  if (raw['version'] !== 1) return null;
  const operations: ActivityOperation[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw['operations'])) {
    for (const row of raw['operations']) {
      const op = parseOperation(row);
      if (!op || seen.has(op.id)) continue;
      seen.add(op.id);
      operations.push(op);
    }
  }
  return {
    version: 1,
    currentWork: parseCurrentWork(raw['currentWork']),
    progress: progressFromOps(operations),
    operations,
    craftedBasaltEdge: raw['craftedBasaltEdge'] === true,
  };
}

function parseCurrentWork(raw: unknown): CurrentWork | null {
  if (!isPlain(raw) || raw['version'] !== 2) return null;
  if (!isDiscipline(raw['disciplineId'])) return null;
  if (typeof raw['locationId'] !== 'string' || !locationDefinition(raw['locationId'])) return null;
  const selectionRevision = parseHlc(raw['selectionRevision']);
  if (!selectionRevision) return null;
  if (typeof raw['startedAt'] !== 'string' || !raw['startedAt']) return null;
  return {
    version: 2,
    disciplineId: raw['disciplineId'],
    locationId: raw['locationId'],
    startedAt: raw['startedAt'],
    lastResolvedAt: typeof raw['lastResolvedAt'] === 'string' ? raw['lastResolvedAt'] : raw['startedAt'],
    selectionRevision,
  };
}

function parseOperation(raw: unknown): ActivityOperation | null {
  if (!isPlain(raw)) return null;
  if (typeof raw['id'] !== 'string' || !raw['id']) return null;
  const hlcRevision = parseHlc(raw['hlcRevision']);
  if (!hlcRevision) return null;
  if (raw['kind'] !== 'active') return null;
  if (!isDiscipline(raw['disciplineId'])) return null;
  if (typeof raw['locationId'] !== 'string' || !raw['locationId']) return null;
  if (typeof raw['resolvedAt'] !== 'string' || !raw['resolvedAt']) return null;
  const xpGrant = parseXpGrant(raw['xpGrant']);
  if (!xpGrant) return null;
  if (!Array.isArray(raw['inventoryGrants'])) return null;
  const inventoryGrants: ActivityInventoryGrant[] = [];
  for (const row of raw['inventoryGrants']) {
    const grant = parseInvGrant(row);
    if (!grant) return null;
    inventoryGrants.push(grant);
  }
  const discovery = parseDiscovery(raw['discovery']);
  if (!discovery) return null;
  return {
    id: raw['id'],
    hlcRevision,
    kind: 'active',
    disciplineId: raw['disciplineId'],
    locationId: raw['locationId'],
    resolvedAt: raw['resolvedAt'],
    xpGrant,
    inventoryGrants,
    discovery,
  };
}

function parseHlc(raw: unknown): HlcRevision | null {
  if (!isPlain(raw)) return null;
  if (!Number.isFinite(raw['wallTimeMs']) || !Number.isFinite(raw['logicalCounter'])) return null;
  if (!Number.isFinite(raw['sequence'])) return null;
  if (typeof raw['deviceId'] !== 'string' || !raw['deviceId']) return null;
  return {
    wallTimeMs: raw['wallTimeMs'] as number,
    logicalCounter: raw['logicalCounter'] as number,
    deviceId: raw['deviceId'],
    sequence: raw['sequence'] as number,
  };
}

function parseXpGrant(raw: unknown): ActivityXpGrant | null {
  if (!isPlain(raw) || typeof raw['id'] !== 'string' || !raw['id']) return null;
  if (!Number.isFinite(raw['amount'])) return null;
  return { id: raw['id'], amount: raw['amount'] as number };
}

function parseInvGrant(raw: unknown): ActivityInventoryGrant | null {
  if (!isPlain(raw) || typeof raw['id'] !== 'string' || !raw['id']) return null;
  if (typeof raw['definitionId'] !== 'string' || !raw['definitionId']) return null;
  if (!Number.isFinite(raw['quantity']) || (raw['quantity'] as number) <= 0) return null;
  return { id: raw['id'], definitionId: raw['definitionId'], quantity: raw['quantity'] as number };
}

function parseDiscovery(raw: unknown): ActivityDiscovery | null {
  if (!isPlain(raw) || raw['rolled'] !== true && raw['rolled'] !== false) return null;
  const result = raw['result'];
  if (result !== 'none' && result !== 'ember-residue' && result !== 'first-craft-guarantee') return null;
  return { rolled: raw['rolled'] === true, result };
}

function isDiscipline(value: unknown): value is DisciplineId {
  return value === 'mining' || value === 'exploration' || value === 'forge' || value === 'hunting';
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isEnabledMine(locationId: string, discipline: DisciplineId): boolean {
  const def = locationDefinition(locationId);
  return !!def && def.enabledDisciplines.includes(discipline) && locationId === BASALT_SEAMWORKS_ID;
}

export { MINING_XP_PER_ACTION };
