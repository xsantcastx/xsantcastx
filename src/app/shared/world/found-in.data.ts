/**
 * found-in.data.ts — the real index `foundIn()` reads, built from game data.
 *
 * Sources, all read rather than transcribed:
 *  - gathering sites: MINING_TIERS / FORAGING_TIERS / PROSPECTING_TIERS
 *  - every town and hunt: area drop tables, per-monster overrides, the
 *    hunting grounds' gathering nodes (AreaDef.nodes → their yields), and the
 *    Delve's terrain nodes (bands, veins, stamps and each biome's veins →
 *    TERRAIN_NODES yields)
 *  - the expedition each expedition-only material comes from (read off the
 *    Material Vendor's buyback board, which names it; the Vendor itself only
 *    buys since economy v3, so it is not a source), and the realm expeditions
 *    that return each material the board does not name (the expedition loot
 *    tables themselves)
 *  - the Delve biomes' materials (contract ids; replaced by the terrain's own
 *    biome data once the Delve engine names its biomes)
 *
 * Imports the world's town data, so only lazy surfaces (the Skills panel, the
 * Codex) should import this file. Pure. No Angular.
 */
import { MINING_TIERS } from '../activity/activity.model';
import { FORAGING_TIERS } from '../activity/foraging.model';
import { CLARITY_ELIXIR_ID, PROSPECTING_TIERS } from '../activity/prospecting.model';
import { VENDOR_SHELF } from '../vendor/material-vendor.model';
import { REALM_ARTBIBLE_MATERIALS, REALM_EXCLUSIVE_MATERIALS } from '../explorer/explorer.model';
import { realmById } from '../realms/realm.model';
import type { RealmId } from '../realms/realm.model';
import { DELVE_BIOMES, GLOWCAP, GODFORGE_FRAGMENT, SHADOW_ROOT_CUTTING, type DelveBiomeId } from '../delve/delve-lore.model';
import { KAELS_HAMMER } from '../npc/delve-missions.model';
import { TOWNS, type AreaDef } from '../../play/world/world.model';
import { TERRAIN_NODE_LIST, type TerrainSpec } from '../../play/engine/terrain';
import { deepNodes } from '../../play/engine/underhearth-gen';
import { foundIn, type AreaLike, type FoundInIndex, type FoundInPlace } from './found-in';
import { MAP_TOOLS } from '../delve/map-tools.model';
import { SLATE_ITEMS } from '../slate/slate-items.model';
import { CABINET_ITEMS } from '../cabinets/cabinets.model';
import { CLOCK_ITEMS } from '../world-clock/eclipse.model';
import { POTIONS } from '../potions/potions.model';
import { BLANK_ID, SPELLSTONE_MEANING } from '../spellstones/spellstones.model';
import { CATCHES, CRATE_IDS, LEDGER_CATCH_IDS, LODGE_CHARMS, RODS, WATERS, type WaterId } from '../fishing/fishing.model';

const DELVE_AREA = 'Ember Delve';

const biome = (id: DelveBiomeId) => DELVE_BIOMES.find(b => b.id === id)?.name ?? id;

/** Materials only the Delve's biomes hold. */
const DELVE_MATERIALS: FoundInIndex['delve'] = {
  [SHADOW_ROOT_CUTTING]: { area: DELVE_AREA, biomes: [biome('root-hollows')] },
  [KAELS_HAMMER]: { area: DELVE_AREA, biomes: [biome('basalt-caverns')] },
  [GLOWCAP]: { area: DELVE_AREA, biomes: [biome('glowcap-grotto')] },
  [GODFORGE_FRAGMENT]: { area: DELVE_AREA, biomes: [biome('magma-halls')] },
  // Wherever water meets lava (the Magma Halls' pools): a made block (liquids.ts).
  'obsidian-block': { area: DELVE_AREA, biomes: [biome('magma-halls')] },
};

/** Fishing (Phase 6): each water's catches, the Ledger Catch family, and what the Bench and the Lodge give. */
function fishingRows(): { place: string; materialIds: string[] }[] {
  const rows: { place: string; materialIds: string[] }[] = (Object.keys(WATERS) as WaterId[]).map(water => ({
    place: `${DELVE_AREA}: fishing ${WATERS[water].name}`,
    materialIds: CATCHES.filter(c => c.rarity !== 'quest' && c.rarity !== 'crate' && !c.when && c.waters.includes(water)).map(c => c.id)
      .concat(CATCHES.filter(c => c.rarity === 'crate' && c.waters.includes(water)).map(c => c.id)),
  }));
  rows.push({ place: `${DELVE_AREA}: the Lodge Warden's Ledger Catch, on its day`, materialIds: [...LEDGER_CATCH_IDS] });
  rows.push({ place: 'Crafting Bench (Delve kit)', materialIds: [...RODS.filter(r => r.id !== 'worn-rod').map(r => r.id), 'seam-bucket', 'lampfish-oil',
    // Phase 8: the Underhearth's kit (some of it opened by Kael's missions).
    'seam-cart', 'seam-rail', 'bark-rope', 'thornroot-grapple', 'rift-anchor',
    // The Rift Gates: the Umbral Sigil, and the Veil Lantern (Verrin's "What the Light Leaves").
    'umbral-sigil', 'veil-lantern',
    // The Root Deeps' and the Prism Mines' sigils and gear (Kesh's and Aureth's first missions open the gear).
    'verdant-sigil', 'rootsever-billhook', 'luminous-sigil', 'dawn-lens',
    // The Orrery Wells' sigil and key (Sera Quill's first mission opens the key).
    'celestial-sigil', 'orrery-key'] });
  rows.push({ place: 'Your first rod, in the satchel from the start', materialIds: ['worn-rod'] });
  rows.push({ place: `${DELVE_AREA}: a Seam Bucket filled at water or lava`, materialIds: ['seam-bucket-water', 'seam-bucket-lava'] });
  rows.push({ place: 'Rootglass Canopy: the Lodge Warden\'s gifts for Ledger Catches', materialIds: LODGE_CHARMS.map(c => c.id) });
  // Map v2's map tools (shared/delve/map-tools.model.ts).
  for (const tool of MAP_TOOLS) for (const place of tool.foundIn) rows.push({ place, materialIds: [tool.id] });
  // The Mirror Slate's two panes (shared/slate/slate-items.model.ts).
  for (const item of SLATE_ITEMS) for (const place of item.foundIn) rows.push({ place, materialIds: [item.id] });
  // The Lost Cabinets' curios and extras (shared/cabinets/cabinets.model.ts).
  for (const item of CABINET_ITEMS) for (const place of item.foundIn) rows.push({ place, materialIds: [item.id] });
  // The world clock's: the Moonwake, the Mirrorfin and the Eclipse Glass, each at its hour (shared/world-clock/eclipse.model.ts).
  for (const item of CLOCK_ITEMS) for (const place of item.foundIn) rows.push({ place, materialIds: [item.id] });
  // The potion belt (shared/potions): Edrin Kade's counter and the creatures that drop them.
  for (const item of POTIONS) for (const place of item.foundIn) rows.push({ place, materialIds: [item.id] });
  // The Basalt Blank (shared/spellstones): the creatures that drop it and Edrin Kade's counter.
  for (const place of SPELLSTONE_MEANING.blank.sources) rows.push({ place: place.replace(/^creature drops/, 'Creatures of every hunt').replace(/^Edrin Kade sells it/, 'Seamworks: Edrin Kade\'s counter'), materialIds: [BLANK_ID] });
  void CRATE_IDS;
  return rows;
}

/**
 * The Underhearth (Phase 8): what its generator lays (deepNodes) yields, read
 * off the node table; the shrines' Waystone Shards (the play view grants one
 * on the first touch of each) and the Four Hammer-Marks (Kael's reward).
 */
function underhearthRows(): { place: string; materialIds: string[] }[] {
  const yields = [...new Set(deepNodes().map(id => TERRAIN_NODE_LIST.find(n => n.id === id)?.yield?.materialId).filter((id): id is string => !!id))];
  return [
    { place: `${DELVE_AREA}: the Underhearth, below the Magma Halls`, materialIds: yields },
    { place: `${DELVE_AREA}: the first touch of each rift shrine`, materialIds: ['waystone-shard'] },
    { place: `${DELVE_AREA}: Kael's mission "Four Hammers" (the Basalt Caverns)`, materialIds: ['four-hammer-marks'] },
  ];
}

function terrainNodes(spec: TerrainSpec | undefined): string[] {
  if (!spec) return [];
  return [...new Set([
    ...spec.bands.map(b => b.node),
    ...spec.veins.map(v => v.node),
    ...spec.stamps.map(s => s.node),
    ...(spec.biomes ?? []).flatMap(b => b.veins.map(v => v.node)),
  ])];
}

function areaLike(area: AreaDef): AreaLike {
  return {
    name: area.name, drops: area.drops, monsters: area.monsters, terrainNodes: terrainNodes(area.terrain),
    // A node that keeps an hour (night, an eclipse) says so in its own Found in line (CLOCK_ITEMS).
    gatherMaterials: (area.nodes ?? []).filter(node => !node.when).map(node => node.yield.materialId),
  };
}

/** "<Realm> expeditions" for every material a realm's loot table returns that the board does not already name. */
function expeditionRows(): FoundInIndex['vendor'] {
  const named = new Set(VENDOR_SHELF.filter(row => row.source).map(row => row.materialId));
  const rows: { materialId: string; place: string; source: string }[] = [];
  for (const table of [REALM_EXCLUSIVE_MATERIALS, REALM_ARTBIBLE_MATERIALS]) {
    for (const [realm, ids] of Object.entries(table) as [RealmId, readonly string[]][]) {
      const source = `${realmById(realm)?.name ?? realm} expeditions`;
      for (const materialId of ids) if (!named.has(materialId)) rows.push({ materialId, place: '', source });
    }
  }
  return rows;
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
      // The Clarity Elixir is the Orrery's rare find, not a tier.
      { place: 'Meridian Orrery', materialIds: [...PROSPECTING_TIERS.map(t => t.mineralId), CLARITY_ELIXIR_ID] },
      ...fishingRows(),
      ...underhearthRows(),
      // The endless Delve (Phase 7): Kael's waycaches in the Basalt Caverns east and west of the core.
      { place: `${DELVE_AREA}: Kael's waycaches, in the Basalt Caverns east and west`, materialIds: ['torch'] },
      // The Rift Gates (rift-gates.model.ts): splinters in every gate's frame; the Ink Deeps behind the Umbral one.
      { place: `${DELVE_AREA}: the frames of the Rift Gates (Pickaxe IV)`, materialIds: ['rift-splinter'] },
      { place: 'The Ink Deeps: veins round the ink pools and in the Gloam Deep, behind the Umbral Rift Gate', materialIds: ['inkstone', 'nightglass', 'umbral-ink'] },
      { place: 'The Root Deeps: veins in the living wood, spore pods and graftling warrens, behind the Verdant Rift Gate', materialIds: ['rootglass', 'heart-amber', 'verdant-sap'] },
      { place: 'The Prism Mines: veins in the prism-stone, prism blooms and prism galleries, behind the Luminous Rift Gate', materialIds: ['prismite', 'dawnglass', 'luminous-prism'] },
      { place: 'The Orrery Wells: veins in the astral stone, orrery scrap, vault roofs and star-well pockets, behind the Celestial Rift Gate', materialIds: ['starsteel', 'meridian-glass', 'celestial-alloy'] },
    ],
    areas,
    nodeYields: Object.fromEntries(TERRAIN_NODE_LIST.map(n => [n.id, n.yield?.materialId])),
    delve: DELVE_MATERIALS,
    // The Vendor buys, it does not sell (economy v3): no 'Material Vendor'
    // place, only the expedition each listing names.
    vendor: [
      ...VENDOR_SHELF.filter(row => row.source).map(row => ({ materialId: row.materialId, place: '', source: row.source })),
      ...expeditionRows(),
    ],
  };
}

let cached: FoundInIndex | null = null;

/** Where `materialId` comes from, against the game's real data. */
export function foundInWorld(materialId: string): FoundInPlace[] {
  cached ??= buildFoundInIndex();
  return foundIn(materialId, cached);
}
