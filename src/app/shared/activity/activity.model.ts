/**
 * activity.model.ts — C7 Current Work and activity operations.
 *
 * Data only. No Mine button, no Basalt Seamworks route, no craft.
 * Spec: eclipse-realms-active-progression-spec.md §§5–6.
 */
export type DisciplineId = 'mining' | 'exploration' | 'forge' | 'hunting';

export type ActivityLocationId = string;

export interface HlcRevision {
  wallTimeMs: number;
  logicalCounter: number;
  deviceId: string;
  sequence: number;
}

export interface ActivityLocationDefinition {
  id: ActivityLocationId;
  realmId: 'infernal' | 'celestial' | 'luminous' | 'umbral' | 'verdant';
  enabledDisciplines: readonly DisciplineId[];
}

export interface CurrentWork {
  version: 2;
  disciplineId: DisciplineId;
  locationId: ActivityLocationId;
  startedAt: string;
  lastResolvedAt: string;
  selectionRevision: HlcRevision;
}

export interface DisciplineProgress {
  version: 1;
  xpByDiscipline: Partial<Record<DisciplineId, number>>;
}

export type DiscoveryResult = 'none' | 'ember-residue' | 'first-craft-guarantee';

export interface ActivityDiscovery {
  rolled: boolean;
  result: DiscoveryResult;
}

export interface ActivityXpGrant {
  id: string;
  amount: number;
}

export interface ActivityInventoryGrant {
  id: string;
  definitionId: string;
  quantity: number;
}

export interface ActivityOperation {
  id: string;
  hlcRevision: HlcRevision;
  kind: 'active';
  disciplineId: DisciplineId;
  locationId: ActivityLocationId;
  resolvedAt: string;
  xpGrant: ActivityXpGrant;
  inventoryGrants: ReadonlyArray<ActivityInventoryGrant>;
  discovery: ActivityDiscovery;
}

export interface ActivityLedger {
  version: 1;
  currentWork: CurrentWork | null;
  progress: DisciplineProgress;
  operations: ActivityOperation[];
  /** True after a later checkpoint crafts Basalt Edge. C7 never sets this. */
  craftedBasaltEdge: boolean;
  /**
   * Totals that survive the 256-op window. Merge takes the max against
   * live ops so dropping oldest rows cannot shrink XP or re-arm ember.
   */
  emberGranted: boolean;
  miningAccepted: number;
}

export const ACTIVITY_KEY = 'godforge-activity';
export const ACTIVITY_SCHEMA_VERSION = 1 as const;
export const ACTIVITY_OPS_MAX = 256;
export const MINING_RECOVERY_MS = 2500;
export const MINING_XP_PER_ACTION = 2;
export const CINDER_ORE_ID = 'cinder-ore';
export const EMBER_RESIDUE_ID = 'ember-residue';
export const BASALT_SEAMWORKS_ID = 'infernal/basalt-seamworks';
export const EMBER_DISCOVERY_CHANCE = 0.0008;
export const EMBER_GUARANTEE_AT = 800;

export const BASALT_SEAMWORKS: ActivityLocationDefinition = {
  id: BASALT_SEAMWORKS_ID,
  realmId: 'infernal',
  enabledDisciplines: ['mining'],
};

export const ACTIVITY_LOCATIONS: readonly ActivityLocationDefinition[] = [
  BASALT_SEAMWORKS,
];

export function locationDefinition(id: string): ActivityLocationDefinition | undefined {
  return ACTIVITY_LOCATIONS.find(row => row.id === id);
}

export function emptyProgress(): DisciplineProgress {
  return { version: 1, xpByDiscipline: {} };
}

export function emptyActivityLedger(): ActivityLedger {
  return {
    version: ACTIVITY_SCHEMA_VERSION,
    currentWork: null,
    progress: emptyProgress(),
    operations: [],
    craftedBasaltEdge: false,
    emberGranted: false,
    miningAccepted: 0,
  };
}
