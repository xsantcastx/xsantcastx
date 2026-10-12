/**
 * gather-save.model.ts — when each hunting-ground gathering node was last
 * harvested, so regrowth survives a reload. Pure: no Angular, no storage. The
 * service (gather-save.service.ts) owns the blob; the cloud-save merge and the
 * engine tests call these functions directly.
 *
 *   localStorage `godforge-gathering`, Firestore progress/gathering
 *
 *   {
 *     version: 1,
 *     areas: {
 *       'rootglass-thicket': { 'starlight-clump': 1760000000000, 'sap-tree': 1760000012345 },
 *     },
 *   }
 *
 * Only the harvest time is stored (epoch ms). Whether a node is ready, and how
 * long it has left, is derived from it and the node's `respawn` every time it
 * is asked, so nothing counts down in memory and a reload, a closed tab or
 * another device all agree on the same answer.
 *
 * WHY A BLOB OF ITS OWN, NOT THE DELVE SAVE
 * `godforge-delve` is one Delve: a seed, a layout-keyed dig diff and a merge
 * built around "two seeds are two different Delves". Gathering nodes live in
 * every realm's hunting grounds, have nothing to do with that seed, and merge
 * by a much simpler rule. Folding them in would make the Delve's hand-written
 * merge carry a second, unrelated rule; a separate blob keeps both trivial.
 *
 * MERGE  Per node, the later harvest wins. That is the conservative answer: a
 * node harvested on either device is regrowing, and the max is commutative,
 * associative and idempotent, so replays and repeated merges cannot drift.
 *
 * BOUNDS  A harvest older than PRUNE_MS has long regrown (the slowest node
 * takes 75 s), so it is dropped on write: the blob holds only what is still
 * regrowing plus a day of slack, never a history.
 */

export const GATHER_KEY = 'godforge-gathering';
export const GATHER_SAVE_VERSION = 1;
/** Harvests older than this are forgotten on write (a node regrows in seconds). */
export const PRUNE_MS = 24 * 60 * 60 * 1000;
/** Ceilings so a corrupt or hostile blob cannot grow without bound. */
const MAX_AREAS = 64;
const MAX_NODES_PER_AREA = 64;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export interface GatherSave {
  version: 1;
  /** areaId → nodeId → epoch ms of the last harvest. */
  areas: Record<string, Record<string, number>>;
}

export function emptyGatherSave(): GatherSave {
  return { version: GATHER_SAVE_VERSION, areas: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validStamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Whatever was read, as a valid save. Junk ids and stamps are dropped, never thrown on. */
export function coerceGatherSave(value: unknown): GatherSave {
  const out = emptyGatherSave();
  if (!isRecord(value) || !isRecord(value['areas'])) return out;
  for (const [areaId, nodes] of Object.entries(value['areas'])) {
    if (Object.keys(out.areas).length >= MAX_AREAS) break;
    if (!ID.test(areaId) || !isRecord(nodes)) continue;
    const row: Record<string, number> = {};
    for (const [nodeId, at] of Object.entries(nodes)) {
      if (Object.keys(row).length >= MAX_NODES_PER_AREA) break;
      if (ID.test(nodeId) && validStamp(at)) row[nodeId] = Math.floor(at);
    }
    if (Object.keys(row).length) out.areas[areaId] = row;
  }
  return out;
}

/** The last harvest of a node (epoch ms), or null when there is none on record. */
export function harvestedAtIn(save: GatherSave, areaId: string, nodeId: string): number | null {
  const at = Object.prototype.hasOwnProperty.call(save.areas, areaId) ? save.areas[areaId][nodeId] : undefined;
  return validStamp(at) ? at : null;
}

/**
 * Record a harvest. Keeps the later stamp when one is already there, so a
 * replayed or out-of-order write cannot rewind a node. Returns true when the
 * save changed. Mutates `save`.
 */
export function recordHarvestIn(save: GatherSave, areaId: string, nodeId: string, at: number): boolean {
  if (!ID.test(areaId) || !ID.test(nodeId) || !validStamp(at)) return false;
  const stamp = Math.floor(at);
  const have = harvestedAtIn(save, areaId, nodeId);
  if (have !== null && have >= stamp) return false;
  save.areas = { ...save.areas, [areaId]: { ...(save.areas[areaId] ?? {}), [nodeId]: stamp } };
  return true;
}

/** Drop harvests older than PRUNE_MS before `now`, and areas left empty. Mutates `save`. */
export function pruneGatherSave(save: GatherSave, now: number): GatherSave {
  const floor = now - PRUNE_MS;
  const areas: GatherSave['areas'] = {};
  for (const [areaId, nodes] of Object.entries(save.areas)) {
    const row: Record<string, number> = {};
    for (const [nodeId, at] of Object.entries(nodes)) if (at >= floor) row[nodeId] = at;
    if (Object.keys(row).length) areas[areaId] = row;
  }
  save.areas = areas;
  return save;
}

/**
 * Seconds a node has left to regrow at `now`, 0 when it is ready. A stamp
 * from the future (another device's clock running fast) counts as "just
 * harvested", never longer, so a skewed clock cannot lock a node away.
 */
export function regrowSecondsLeft(harvestedAt: number | null, respawnSeconds: number, now: number): number {
  if (harvestedAt === null || !(respawnSeconds > 0)) return 0;
  const readyAt = Math.min(harvestedAt, now) + respawnSeconds * 1000;
  return Math.max(0, (readyAt - now) / 1000);
}

/** Two devices' copies into one: per node, the later harvest. Pure; inputs untouched. */
export function mergeGatherSaves(remote: unknown, local: unknown): GatherSave {
  const out = coerceGatherSave(remote);
  const mine = coerceGatherSave(local);
  for (const [areaId, nodes] of Object.entries(mine.areas)) {
    for (const [nodeId, at] of Object.entries(nodes)) recordHarvestIn(out, areaId, nodeId, at);
  }
  return coerceGatherSave(out);
}
