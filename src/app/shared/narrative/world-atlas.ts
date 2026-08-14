/**
 * world-atlas.ts — presentation contract for the World atlas.
 *
 * Source: docs/04-roadmap/eclipse-realms-world-atlas-interaction-spec.md
 * Art: Assets/Locations/Maps/01-fractured-realms-atlas.png (derived runtime
 * copies only). Lore, factions, and chapter copy stay in five-realms.narrative.ts.
 *
 * Pure data — safe on an SSR path. No saved choices or new routes.
 */
import {
  type NarrativeRealmId,
  narrativeRealmById,
  realmHref,
} from './five-realms.narrative';

export interface AtlasAnchor {
  readonly x: number;
  readonly y: number;
}

export interface AtlasHotspot {
  readonly id: NarrativeRealmId;
  readonly anchor: AtlasAnchor;
  readonly sourceAnchorPx: AtlasAnchor;
  readonly label: string;
  readonly accessibleLabel: string;
  readonly mobileOrder: number;
}

/** Runtime <picture> stem under assets/images. Not the Desktop source PNG. */
export const ATLAS_IMAGE_STEM = 'fractured-realms-atlas';

export const ATLAS_SOURCE = {
  coordinateSystem: 'normalized-percent',
  sourceDimensions: { width: 1536, height: 1024 },
  hitTarget: { desktopRadiusPercent: 12, minimumPointerTargetPx: 44 },
  /** Decorative in this phase. No click target until a destination exists. */
  godforgeAnchor: { x: 50, y: 46 } as const,
} as const;

/**
 * Canonical hotspot data. Anchors are percent of the uncropped 3:2 frame.
 * Do not convert these to pixels at authoring time.
 */
export const ATLAS_HOTSPOTS: readonly AtlasHotspot[] = [
  {
    id: 'celestial',
    anchor: { x: 27, y: 24 },
    sourceAnchorPx: { x: 415, y: 246 },
    label: 'Celestial Realm',
    accessibleLabel: 'Celestial Realm — observatory plateaus, star paths, and orbital structures',
    mobileOrder: 1,
  },
  {
    id: 'luminous',
    anchor: { x: 75, y: 24 },
    sourceAnchorPx: { x: 1152, y: 246 },
    label: 'Luminous Realm',
    accessibleLabel: 'Luminous Realm — dawn-lit terraces, prism spires, and crystal light',
    mobileOrder: 2,
  },
  {
    id: 'infernal',
    anchor: { x: 25, y: 66 },
    sourceAnchorPx: { x: 384, y: 676 },
    label: 'Infernal Realm',
    accessibleLabel: 'Infernal Realm — basalt calderas, forge channels, and ember fissures',
    mobileOrder: 3,
  },
  {
    id: 'umbral',
    anchor: { x: 76, y: 65 },
    sourceAnchorPx: { x: 1167, y: 666 },
    label: 'Umbral Realm',
    accessibleLabel: 'Umbral Realm — mirrored ravines, moonlit glass, and hidden rifts',
    mobileOrder: 4,
  },
  {
    id: 'verdant',
    anchor: { x: 50, y: 80 },
    sourceAnchorPx: { x: 768, y: 819 },
    label: 'Verdant Realm',
    accessibleLabel: 'Verdant Realm — living rootwood, bioluminescent groves, and renewal',
    mobileOrder: 5,
  },
];

export function atlasHotspotsInMobileOrder(): readonly AtlasHotspot[] {
  return [...ATLAS_HOTSPOTS].sort((a, b) => a.mobileOrder - b.mobileOrder);
}

export function atlasHref(id: NarrativeRealmId): string {
  return realmHref(id);
}

export function atlasRealmTone(id: NarrativeRealmId): { color: string; glow: string } {
  const realm = narrativeRealmById(id);
  return {
    color: realm?.color ?? '#8B5CF6',
    glow: realm?.glow ?? 'rgba(139, 92, 246, 0.6)',
  };
}
