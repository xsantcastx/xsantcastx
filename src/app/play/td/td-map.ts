/**
 * td-map.ts — what the Map window (M) shows besides the picture (owner's player notes 2026-10-21): every section of
 * the continent the Keeper is on (its surface, then each cave, dungeon, house and tower with every floor), the region
 * names painted across the surface with the level band of what lives there, and the towns. Pure: the engine hands in
 * its continent, its level table and its level links (td-seek levelLinks), and paints nothing here.
 *
 * Level bands come from the creatures each region (or floor) is drawn with (MOBS levels). The `zones` branch is adding a
 * zone table (td-zones.ts); when it lands, pass its band through `bandOverride` and the Map shows it unchanged.
 */
import type { ContinentDef } from './continent';
import type { TdMapDef } from './td-level';
import type { LevelLink } from './td-seek';

/** One place the Map can show: 'surface', or a hand-drawn level's id; `group` is its dungeon / building's name. */
export interface TdMapSection { id: string; name: string; group: string; floor: number; band: LevelBand | null }
/** A region's (or a village's) name across the surface, where it sits (0..1 of the picture), and its level band. */
export interface TdZoneLabel { name: string; u: number; v: number; band: LevelBand | null; town: boolean }
export interface LevelBand { min: number; max: number }

type MobLevels = Readonly<Record<string, { level: number } | undefined>>;
/** A hook for the zone table (td-zones.ts, `zones` branch): a band by zone name, or null to read the creatures. */
export type BandOverride = (name: string) => LevelBand | null;

function bandOf(types: Iterable<string>, mobs: MobLevels): LevelBand | null {
  let min = Infinity, max = -Infinity;
  for (const t of types) {
    const lv = mobs[t]?.level;
    if (typeof lv !== 'number' || !Number.isFinite(lv)) continue;
    min = Math.min(min, lv); max = Math.max(max, lv);
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/** A floor's band: the creatures drawn into it. */
export function floorBand(def: TdMapDef, mobs: MobLevels): LevelBand | null {
  return bandOf(Object.values(def.legend).map(e => e.mob).filter((m): m is string => !!m), mobs);
}

/** "Ember Mine · Floor 2 · The Flooded Galleries" → group "Ember Mine". */
export function groupName(name: string): string { return name.split(' · ')[0].trim(); }

/**
 * The continent's sections: its surface first, then every level linked to it, grouped by building (in the order the
 * groups are first reached), each group's floors from the top down (a tower's +2 first, a mine's −1 before its −2).
 */
export function mapSections(continent: ContinentDef, surfaceName: string, levels: Readonly<Record<string, TdMapDef>>,
  links: ReadonlyMap<string, LevelLink>, mobs: MobLevels, bandOverride: BandOverride | null = null): TdMapSection[] {
  const out: TdMapSection[] = [{ id: 'surface', name: surfaceName, group: surfaceName, floor: 0, band: null }];
  const groups = new Map<string, TdMapSection[]>();
  for (const [id, link] of links) {
    if (link.continent !== continent.id) continue;
    const def = levels[id];
    if (!def) continue;
    const group = groupName(def.name);
    const row: TdMapSection = { id, name: def.name, group, floor: link.floor, band: bandOverride?.(def.name) ?? bandOverride?.(group) ?? floorBand(def, mobs) };
    const list = groups.get(group) ?? [];
    list.push(row);
    groups.set(group, list);
  }
  for (const list of groups.values()) out.push(...list.sort((a, b) => b.floor - a.floor || a.id.localeCompare(b.id)));
  return out;
}

/**
 * The surface's labels: each named region once (its blocks' middle), with the band of the creatures it is drawn with,
 * and each village and the capital as a town. Positions are 0..1 across the continent's map picture.
 */
export function zoneLabels(def: ContinentDef, mobs: MobLevels, tileSize: { block: number }, bandOverride: BandOverride | null = null): TdZoneLabel[] {
  const rows = def.map.length, cols = Math.max(...def.map.map(r => r.length));
  const nameAt = (q: number, r: number): string | undefined => {
    const reg = def.map[r]?.[q] as keyof ContinentDef['names'] | undefined;
    return reg ? def.names[reg] : undefined;
  };
  // Each block's distance (in blocks) to the nearest block of another name: a label goes on its region's deepest
  // block, so a ring (a coast) or a lake beside the town never stacks its name on the town's.
  const depth = new Int32Array(rows * cols).fill(-1);
  const queue: number[] = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const n = nameAt(q, r);
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dq, dr]) => nameAt(q + dq, r + dr) !== n)) { depth[r * cols + q] = 0; queue.push(r * cols + q); }
  }
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i], q = k % cols, r = (k - q) / cols;
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nq = q + dq, nr = r + dr;
      if (nq < 0 || nr < 0 || nq >= cols || nr >= rows || depth[nr * cols + nq] >= 0) continue;
      depth[nr * cols + nq] = depth[k] + 1; queue.push(nr * cols + nq);
    }
  }
  const acc = new Map<string, { q: number; r: number; d: number; types: Set<string> }>();
  def.map.forEach((row, r) => {
    for (let q = 0; q < row.length; q++) {
      const reg = row[q] as keyof ContinentDef['names'];
      const name = def.names[reg];
      if (!name || name === def.townName) continue;
      const a = acc.get(name) ?? { q, r, d: -1, types: new Set<string>() };
      const d = depth[r * cols + q];
      if (d > a.d) { a.q = q; a.r = r; a.d = d; }
      for (const t of def.mobs[reg]?.types ?? []) a.types.add(t);
      acc.set(name, a);
    }
  });
  const out: TdZoneLabel[] = [];
  for (const [name, a] of acc) out.push({ name, u: (a.q + .5) / cols, v: (a.r + .5) / rows, band: bandOverride?.(name) ?? bandOf(a.types, mobs), town: false });
  const B = tileSize.block, w = cols * B, h = rows * B;
  out.push({ name: def.townName, u: (def.ox * B + def.streets.col) / w, v: (def.oy * B + def.streets.row) / h, band: null, town: true });
  for (const v of def.villages ?? []) out.push({ name: v.name, u: (def.ox * B + v.c + 8) / w, v: (def.oy * B + v.r + 6) / h, band: null, town: true });
  return out;
}
