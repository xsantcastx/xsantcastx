/**
 * world-save.model.ts — save v3: One World (docs/design/one-world.md §4).
 * Pure: no Angular, no storage. cloud-save.model.ts is eager and imports the
 * merges; the Delve's save service (delve-save.service.ts) keeps v3 in memory in
 * the same shapes it keeps v2, and converts on the way to and from the disk.
 *
 * There are zero players, so v3 is a NEW set of keys, written only while the
 * One World preview is on. v2 is untouched until P4: flipping the gate off is
 * the old game, intact.
 *
 *   godforge-world        → progress/world
 *     { version: 3, seed, createdAt,
 *       worlds: { ember|ink|root|prism|orrery: { core: { layout, cells, seen?, wet?, liquids? } } },
 *       claimed: string[], chests?, at?: { world, col, row, t }, migrated?: 'v2' }
 *   godforge-world-r0..23 → progress/world-r0..23
 *     { v: 3, world, seed, rx, ry (signed: the sky band is sy < 0), t, sectors, p? }
 *
 * Merges: the earlier seed wins (as v2); per world the v2 core rules; claimed
 * and chests unioned; `at` the later `t`; `migrated` sticks once set. A region
 * slot merges sector by sector when both sides hold the same (world, seed,
 * rx, ry), else keeps the later one. Every merge is commutative and idempotent.
 *
 * Chest keys are `<world>:<cell id>` (v2: `<area id>:<cell id>`; the cell id
 * is the engine's stable SectorWorld.cellId either way).
 */
import { coerceDelveSave, mergeDelveSaves, DELVE_SAVE_VERSION, type DelveAreaSave, type DelveChest, type DelveSave } from './delve-save.model';
import { coerceRegion, mergeRegion, type DelveRegion } from './delve-region.model';

export const WORLD_KEY = 'godforge-world';
/** Region slots shared by every world: the 24 regions changed most recently ride in the cloud (§4.1). */
export const WORLD_SLOTS = 24;
export const WORLD_SLOT_KEYS: readonly string[] = Array.from({ length: WORLD_SLOTS }, (_, n) => `godforge-world-r${n}`);
/** This device's far regions: IndexedDB `eclipse-world`, else this localStorage key through the gateway. */
export const WORLD_DB = 'eclipse-world';
export const WORLD_FAR_KEY = 'godforge-world-far';

export type WorldName = 'ember' | 'ink' | 'root' | 'prism' | 'orrery';
/** Each world is the area its underground was (the realm Delves' ids, the Ember Delve's). */
export const WORLD_AREAS: Readonly<Record<WorldName, string>> = {
  ember: 'ember-delve', ink: 'umbral-delve', root: 'verdant-delve', prism: 'luminous-delve', orrery: 'celestial-delve',
};
const WORLD_OF_AREA: Readonly<Record<string, WorldName>> = Object.fromEntries(Object.entries(WORLD_AREAS).map(([w, a]) => [a, w as WorldName]));
export function worldOfArea(areaId: string): WorldName | null { return WORLD_OF_AREA[areaId] ?? null; }
export function areaOfWorld(world: string): string | null { return (WORLD_AREAS as Record<string, string>)[world] ?? null; }

/** Where the Keeper was when it was last safe to stand (§3.3 "you log in where you were"). */
export interface ResumePoint { world: WorldName; col: number; row: number; t: number }

export interface WorldSave {
  version: 3;
  seed: number;
  createdAt: number;
  worlds: Partial<Record<WorldName, { core: DelveAreaSave }>>;
  claimed: string[];
  chests?: Record<string, DelveChest>;
  at?: ResumePoint;
  /** Set once the v2 Delve's claims and chests have come across (delve-migration-v3.ts). */
  migrated?: 'v2';
}

/** A v3 region slot: a v2 region with the world it belongs to. */
export interface WorldRegion extends Omit<DelveRegion, 'v'> { v: 3; world: WorldName }

/** Re-key a chest map between `<area>:` and `<world>:` prefixes. */
function rekeyChests(chests: Record<string, DelveChest> | undefined, map: (prefix: string) => string | null): Record<string, DelveChest> | undefined {
  if (!chests) return undefined;
  const out: Record<string, DelveChest> = {};
  for (const [key, chest] of Object.entries(chests)) {
    const at = key.lastIndexOf(':');
    const prefix = map(key.slice(0, at));
    if (prefix) out[`${prefix}:${key.slice(at + 1)}`] = chest;
  }
  return Object.keys(out).length ? out : undefined;
}

/** v3 on disk → the service's in-memory DelveSave (areas by area id). */
export function toDelveSave(world: WorldSave): DelveSave {
  const areas: Record<string, DelveAreaSave> = {};
  for (const [name, entry] of Object.entries(world.worlds)) {
    const area = areaOfWorld(name);
    if (area && entry?.core) areas[area] = { ...entry.core };
  }
  const chests = rekeyChests(world.chests, areaOfWorld);
  return { version: DELVE_SAVE_VERSION, seed: world.seed, createdAt: world.createdAt, areas, claimed: [...world.claimed], ...(chests ? { chests } : {}) };
}

/** The service's DelveSave → v3 on disk. */
export function fromDelveSave(save: DelveSave, extra: { at?: ResumePoint | null; migrated?: 'v2' | null } = {}): WorldSave {
  const worlds: WorldSave['worlds'] = {};
  for (const [areaId, core] of Object.entries(save.areas)) {
    const name = worldOfArea(areaId);
    if (name) worlds[name] = { core: { ...core } };
  }
  const chests = rekeyChests(save.chests, worldOfArea);
  return {
    version: 3, seed: save.seed >>> 0, createdAt: save.createdAt, worlds, claimed: [...save.claimed],
    ...(chests ? { chests } : {}), ...(extra.at ? { at: extra.at } : {}), ...(extra.migrated ? { migrated: extra.migrated } : {}),
  };
}

const WORLD_NAME = /^(ember|ink|root|prism|orrery)$/;
function coerceAt(raw: unknown): ResumePoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const world = o['world'], col = o['col'], row = o['row'], t = o['t'];
  if (typeof world !== 'string' || !WORLD_NAME.test(world) || !Number.isInteger(col) || !Number.isInteger(row) || typeof t !== 'number' || !Number.isFinite(t)) return null;
  if (Math.abs(col as number) > 1e7 || (row as number) < -64 || (row as number) > 512) return null;
  return { world: world as WorldName, col: col as number, row: row as number, t };
}

/** Anything → a valid v3 save, or null (junk, or not v3). The v2 core rules check every world's core. */
export function coerceWorldSave(raw: unknown): WorldSave | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o['version'] !== 3) return null;
  // Lay it out as v2 (areas by area id) and let the v2 coercion check every field it already knows.
  const areas: Record<string, unknown> = {};
  const worlds = o['worlds'] && typeof o['worlds'] === 'object' ? o['worlds'] as Record<string, unknown> : {};
  for (const [name, entry] of Object.entries(worlds)) {
    const area = areaOfWorld(name);
    if (area && entry && typeof entry === 'object') areas[area] = (entry as Record<string, unknown>)['core'];
  }
  const chests = o['chests'] && typeof o['chests'] === 'object' ? rekeyChests(o['chests'] as Record<string, DelveChest>, areaOfWorld) : undefined;
  const v2 = coerceDelveSave({ version: 2, seed: o['seed'], createdAt: o['createdAt'], areas, claimed: o['claimed'], ...(chests ? { chests } : {}) });
  if (!v2) return null;
  const at = coerceAt(o['at']);
  return fromDelveSave(v2, { at, migrated: o['migrated'] === 'v2' ? 'v2' : null });
}

/** The later resume point (a tie: the one further east, so the merge is commutative). */
function laterAt(a: ResumePoint | undefined, b: ResumePoint | undefined): ResumePoint | undefined {
  if (!a) return b; if (!b) return a;
  if (a.t !== b.t) return a.t > b.t ? a : b;
  return a.col > b.col || (a.col === b.col && a.row >= b.row) ? a : b;
}

/** Merge two v3 saves (the cloud's and this device's). Commutative and idempotent. */
export function mergeWorldSaves(remote: unknown, local: unknown): unknown {
  const r = coerceWorldSave(remote), l = coerceWorldSave(local);
  if (!r) return l ?? local;
  if (!l) return r;
  const merged = coerceDelveSave(mergeDelveSaves(toDelveSave(r), toDelveSave(l)))!;
  return fromDelveSave(merged, { at: laterAt(l.at, r.at) ?? null, migrated: l.migrated || r.migrated ? 'v2' : null });
}

/** Anything → a valid v3 region slot, or null. */
export function coerceWorldRegion(raw: unknown): WorldRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const world = o['world'];
  if (o['v'] !== 3 || typeof world !== 'string' || !WORLD_NAME.test(world)) return null;
  const region = coerceRegion({ ...o, v: 1 });
  return region ? { ...region, v: 3, world: world as WorldName } : null;
}
/** A v3 region's v2 shape (the service keeps regions as v2 in memory). */
export function regionOfWorld(region: WorldRegion): DelveRegion { const { world: _w, ...rest } = region; return { ...rest, v: 1 }; }
/** A v2 region filed under its world, for a v3 slot. */
export function worldRegion(world: WorldName, region: DelveRegion): WorldRegion { return { ...region, v: 3, world }; }

/** Merge two v3 region slots: the same world and region sector by sector, else the later one. */
export function mergeWorldRegionSlots(remote: unknown, local: unknown): unknown {
  const r = coerceWorldRegion(remote), l = coerceWorldRegion(local);
  if (!r) return l ?? local;
  if (!l) return r;
  if (r.world === l.world && r.seed === l.seed && r.rx === l.rx && r.ry === l.ry) {
    // mergeRegion keeps its first argument on a tie: order the two so the result does not depend on which is "local".
    const [a, b] = JSON.stringify(l) <= JSON.stringify(r) ? [l, r] : [r, l];
    return worldRegion(l.world, mergeRegion(regionOfWorld(a), regionOfWorld(b)));
  }
  if (r.t !== l.t) return r.t > l.t ? r : l;
  return JSON.stringify(l) <= JSON.stringify(r) ? l : r;
}
