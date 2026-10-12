/**
 * found-in.data.ts — the real index `foundIn()` reads, built from game data.
 *
 * Sources, all read rather than transcribed:
 *  - gathering sites: MINING_TIERS / FORAGING_TIERS / PROSPECTING_TIERS
 *  - every town and hunt: area drop tables, per-monster overrides, and the
 *    Delve's terrain nodes (bands, veins and stamps → TERRAIN_NODES yields)
 *  - the Material Vendor's shelf and the expedition each listing names
 *  - the Delve biomes' materials (contract ids; replaced by the terrain's own
 *    biome data once the Delve engine names its biomes)
 *
 * Imports the world's town data, so only lazy surfaces (the Skills panel, the
 * Codex) should import this file. Pure. No Angular.
 */
import { MINING_TIERS } from '../activity/activity.model';
import { FORAGING_TIERS } from '../activity/foraging.model';
import { PROSPECTING_TIERS } from '../activity/prospecting.model';
import { VENDOR_SHELF } from '../vendor/material-vendor.model';
import { DELVE_BIOMES, GLOWCAP, GODFORGE_FRAGMENT, SHADOW_ROOT_CUTTING, type DelveBiomeId } from '../delve/delve-lore.model';
import { KAELS_HAMMER } from '../npc/delve-missions.model';
import { TOWNS, type AreaDef } from '../../play/world/world.model';
import { TERRAIN_NODE_LIST, type TerrainSpec } from '../../play/engine/terrain';
import { foundIn, type AreaLike, type FoundInIndex, type FoundInPlace } from './found-in';

const DELVE_AREA = 'Ember Delve';

const biome = (id: DelveBiomeId) => DELVE_BIOMES.find(b => b.id === id)?.name ?? id;

/** Materials only the Delve's biomes hold. */
const DELVE_MATERIALS: FoundInIndex['delve'] = {
  [SHADOW_ROOT_CUTTING]: { area: DELVE_AREA, biomes: [biome('root-hollows')] },
  [KAELS_HAMMER]: { area: DELVE_AREA, biomes: [biome('basalt-caverns')] },
  [GLOWCAP]: { area: DELVE_AREA, biomes: [biome('glowcap-grotto')] },
  [GODFORGE_FRAGMENT]: { area: DELVE_AREA, biomes: [biome('magma-halls')] },
};

function terrainNodes(spec: TerrainSpec | undefined): string[] {
  if (!spec) return [];
  return [...new Set([
    ...spec.bands.map(b => b.node),
    ...spec.veins.map(v => v.node),
    ...spec.stamps.map(s => s.node),
  ])];
}

function areaLike(area: AreaDef): AreaLike {
  return { name: area.name, drops: area.drops, monsters: area.monsters, terrainNodes: terrainNodes(area.terrain) };
}

export function buildFoundInIndex(): FoundInIndex {
  const areas: AreaLike[] = [];
  for (const town of Object.values(TOWNS)) {
    if (!town) continue;
    areas.push(areaLike(town));
    for (const hunt of town.hunts) areas.push(areaLike(hunt));
  }
  return {
    gathering: [
      { place: 'Basalt Seamworks', materialIds: MINING_TIERS.map(t => t.oreId) },
      { place: 'Rootglass Canopy', materialIds: FORAGING_TIERS.map(t => t.herbId) },
      { place: 'Meridian Orrery', materialIds: PROSPECTING_TIERS.map(t => t.mineralId) },
    ],
    areas,
    nodeYields: Object.fromEntries(TERRAIN_NODE_LIST.map(n => [n.id, n.yield?.materialId])),
    delve: DELVE_MATERIALS,
    vendor: VENDOR_SHELF.map(row => ({ materialId: row.materialId, place: 'Material Vendor', source: row.source })),
  };
}

let cached: FoundInIndex | null = null;

/** Where `materialId` comes from, against the game's real data. */
export function foundInWorld(materialId: string): FoundInPlace[] {
  cached ??= buildFoundInIndex();
  return foundIn(materialId, cached);
}
