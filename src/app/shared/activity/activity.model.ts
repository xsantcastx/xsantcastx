/**
 * activity.model.ts — C7 Current Work and activity operations.
 *
 * Data only. No Mine button, no Basalt Seamworks route, no craft.
 * Spec: eclipse-realms-active-progression-spec.md §§5–6.
 */
export type DisciplineId = 'mining' | 'foraging' | 'exploration' | 'forge' | 'hunting';

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

export type DiscoveryResult =
  | 'none'
  | 'ember-residue'
  | 'first-craft-guarantee'
  /** A2 Foraging: the Rift Key rare find, rolled or pity-granted. */
  | 'rift-key'
  | 'rift-key-guarantee';

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
  /** Missing or below REALM_ERA is prior-generation ore and is emptied. */
  era?: number;
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
  /**
   * A2 Foraging twins of the two above: accepted Canopy gathers and whether
   * the pity Rift Key has already landed. Optional on the wire — saves written
   * before A2 lack them and coerce to 0 / false — but always present in memory.
   */
  foragingAccepted: number;
  riftKeyGranted: boolean;
}

export const ACTIVITY_KEY = 'godforge-activity';
export const ACTIVITY_SCHEMA_VERSION = 1 as const;
export const ACTIVITY_OPS_MAX = 256;
/**
 * The level-1, no-weapon baseline. Not what actually gates a strike any
 * more — see mining-recovery.ts's effectiveMiningRecoveryMs, which starts
 * from this exact number and shortens it with level and weapon strikePower.
 * Kept here, not moved, so nothing importing the flat baseline for display
 * or a test fixture has to know mining-recovery.ts exists.
 */
export const MINING_RECOVERY_MS = 2500;
export const MINING_XP_PER_ACTION = 2;
export const CINDER_ORE_ID = 'cinder-ore';
export const SLAG_FRAGMENT_ID = 'slag-fragment';
export const INFERNAL_HEARTSTONE_ID = 'infernal-heartstone';
export const EMBER_RESIDUE_ID = 'ember-residue';
export const BASALT_SEAMWORKS_ID = 'infernal/basalt-seamworks';
/** A2 Foraging's site. Its tiers and drop table live in foraging.model.ts. */
export const ROOTGLASS_CANOPY_ID = 'verdant/rootglass-canopy';
export const EMBER_DISCOVERY_CHANCE = 0.0008;
export const EMBER_GUARANTEE_AT = 800;

export interface MiningTier {
  oreId: string;
  /** Mining level required to select this seam. Cinder Ore is 1 — always open. */
  unlockLevel: number;
  xpPerAction: number;
}

/**
 * A1: three ore grades gated by level, each paying more XP per strike, so
 * the reward for climbing the mining curve is a visibly better action, not
 * just a smaller number on the same rock forever.
 */
export const MINING_TIERS: readonly MiningTier[] = [
  { oreId: CINDER_ORE_ID, unlockLevel: 1, xpPerAction: MINING_XP_PER_ACTION },
  { oreId: SLAG_FRAGMENT_ID, unlockLevel: 8, xpPerAction: 5 },
  { oreId: INFERNAL_HEARTSTONE_ID, unlockLevel: 20, xpPerAction: 12 },
];

export function miningTierFor(oreId: string): MiningTier | undefined {
  return MINING_TIERS.find(tier => tier.oreId === oreId);
}

export function isMiningTierUnlocked(tier: MiningTier, level: number): boolean {
  return level >= tier.unlockLevel;
}

export const BASALT_SEAMWORKS: ActivityLocationDefinition = {
  id: BASALT_SEAMWORKS_ID,
  realmId: 'infernal',
  enabledDisciplines: ['mining'],
};

/**
 * Registered here beside BASALT_SEAMWORKS rather than in foraging.model.ts:
 * this file owns the registry locationDefinition() consults, and
 * foraging.model.ts imports from here — never the reverse.
 */
export const ROOTGLASS_CANOPY: ActivityLocationDefinition = {
  id: ROOTGLASS_CANOPY_ID,
  realmId: 'verdant',
  enabledDisciplines: ['foraging'],
};

export const ACTIVITY_LOCATIONS: readonly ActivityLocationDefinition[] = [
  BASALT_SEAMWORKS,
  ROOTGLASS_CANOPY,
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
    era: 55,
    currentWork: null,
    progress: emptyProgress(),
    operations: [],
    craftedBasaltEdge: false,
    emberGranted: false,
    miningAccepted: 0,
    foragingAccepted: 0,
    riftKeyGranted: false,
  };
}
