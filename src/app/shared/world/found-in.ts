/**
 * found-in.ts — where a material can be found, derived from the game's own data.
 *
 * "Found in…" is generated, never written by hand, so it cannot drift from
 * what the world actually drops. The derivation is a pure function over a
 * small index (`FoundInIndex`); `found-in.data.ts` builds the real index from
 * the town drop tables, the Delve terrain, the gathering sites and the vendor
 * shelf. Specs build their own tiny index.
 *
 * Output is a list of place labels in a stable order — gathering sites, then
 * hunts and towns, then the Delve (with its biome when known), then the
 * vendor and expeditions — de-duplicated.
 *
 * Pure. No Angular.
 */

/** A drop table as the world model writes it; only material lines matter here. */
export interface DropTableLike {
  entries: readonly ({ kind: 'coins' } | { kind: 'material'; material: string })[];
}

export interface AreaLike {
  name: string;
  drops: DropTableLike;
  monsters: readonly { drops?: DropTableLike }[];
  /** Node ids that occur in the area's terrain (bands, veins, stamps). */
  terrainNodes?: readonly string[];
  /** Materials its gathering nodes (herb patches, trees, outcrops) yield. */
  gatherMaterials?: readonly string[];
}

export interface FoundInIndex {
  /** Gathering sites: place → materials its skill grants there. */
  gathering: readonly { place: string; materialIds: readonly string[] }[];
  areas: readonly AreaLike[];
  /** Terrain node id → the material breaking it can yield. */
  nodeYields: Readonly<Record<string, string | undefined>>;
  /** Materials the Delve's biomes add, by biome (until the terrain names its biomes). */
  delve: Readonly<Record<string, { area: string; biomes: readonly string[] }>>;
  vendor: readonly { materialId: string; place: string; source?: string }[];
}

export type FoundInKind = 'gather' | 'hunt' | 'delve' | 'vendor' | 'expedition';

export interface FoundInPlace {
  label: string;
  kind: FoundInKind;
}

function materialsOf(table: DropTableLike | undefined): string[] {
  if (!table) return [];
  const out: string[] = [];
  for (const entry of table.entries) if (entry.kind === 'material') out.push(entry.material);
  return out;
}

/** Every place `materialId` can come from, in a stable order, no duplicates. */
export function foundIn(materialId: string, index: FoundInIndex): FoundInPlace[] {
  const out: FoundInPlace[] = [];
  const seen = new Set<string>();
  const add = (label: string, kind: FoundInKind) => {
    if (!label || seen.has(label)) return;
    seen.add(label);
    out.push({ label, kind });
  };

  for (const site of index.gathering) {
    if (site.materialIds.includes(materialId)) add(site.place, 'gather');
  }

  const delve = index.delve[materialId];
  for (const area of index.areas) {
    const dropped = materialsOf(area.drops).includes(materialId)
      || area.monsters.some(m => materialsOf(m.drops).includes(materialId));
    const dug = (area.terrainNodes ?? []).some(node => index.nodeYields[node] === materialId);
    const gathered = (area.gatherMaterials ?? []).includes(materialId);
    if (dug) {
      // The Delve's biome map is more specific than "somewhere in the delve".
      if (delve && delve.area === area.name && delve.biomes.length) continue;
      add(area.name, 'delve');
    } else if (gathered) {
      // A node standing in the hunt is a surer source than a drop chance.
      add(area.name, 'gather');
    } else if (dropped) {
      add(area.name, area.terrainNodes?.length ? 'delve' : 'hunt');
    }
  }

  if (delve) {
    if (delve.biomes.length) for (const biome of delve.biomes) add(`${delve.area} · ${biome}`, 'delve');
    else add(delve.area, 'delve');
  }

  for (const row of index.vendor) {
    if (row.materialId !== materialId) continue;
    if (row.place) add(row.place, 'vendor');
    if (row.source) add(row.source, 'expedition');
  }
  return out;
}

/**
 * The one line a tooltip shows: "Glowcap — Ember Delve · Glowcap Grotto".
 * Null when nothing in the world grants it (the UI then says nothing rather
 * than something wrong).
 */
export function foundInLine(name: string, places: readonly FoundInPlace[]): string | null {
  if (!places.length) return null;
  return `${name} — ${places.map(p => p.label).join(', ')}`;
}

/** Just the places, for a "Found in: …" row. */
export function foundInPlaces(places: readonly FoundInPlace[]): string | null {
  return places.length ? places.map(p => p.label).join(', ') : null;
}
