/**
 * delve-save.model.ts — a player's own Ember Delve, as saved. Pure: no
 * Angular, no storage. The service (delve-save.service.ts) owns the blob; the
 * cloud-save merge and the engine tests call these functions directly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS ON DISK  (localStorage `godforge-delve`, Firestore progress/delve)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   {
 *     version: 1,
 *     seed: 2894011733,          // uint32, generated once per player
 *     createdAt: 1760000000000,  // epoch ms the seed was rolled; earliest wins a merge
 *     areas: {
 *       'ember-delve': {
 *         layout: '120x56:v2:2894011733',   // terrainLayout(spec, seed)
 *         cells: 'k3.0,k4.0,1a2.0',         // base-36 "index.kind" pairs, sorted by index
 *         seen: '0,1.ff00ff00ff00ff00,2',   // explored cells (the map's fog of war; optional): see encodeSeen
 *       },
 *     },
 *     claimed: ['godforge-fragment', 'warden-defeated'],  // once-per-player finds and felled guardians
 *     chests: {                                // placed chests' contents (optional; absent = none)
 *       'ember-delve:1a2': { layout: '120x56:v2:2894011733', born: 1760000000123, n: 3, slots: { 'cinder-ore': 12 } },
 *     },
 *     // Gear in a chest is not stored here: the item's own ledger row says it
 *     // is held by `delve-chest:<born>` (see chestHolderId).
 *   }
 *
 * The Delve is regenerated from `seed` every time (generation is
 * deterministic), then `cells` is laid over it: only what the player changed
 * is stored, a few bytes per dug cell. Hand-made stamps and carved walls come
 * from the spec and are the same for everyone.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE LAYOUT KEY
 * ─────────────────────────────────────────────────────────────────────────────
 * A cell index only means something for one grid shape, one generator version
 * and one seed. If any of them changes (the Delve grows, a vein list is
 * retuned and the spec's `version` bumped, or a merge adopts another device's
 * seed) the old diff would land on the wrong rock. So the diff is filed under
 * the layout it was dug in, and a diff under any other layout is dropped on
 * load rather than misapplied. Losing a dig is recoverable; a vein moved into
 * a tunnel the player already cleared is not.
 */

export const DELVE_KEY = 'godforge-delve';
export const DELVE_SAVE_VERSION = 1;
/** Most cells one area's diff may hold: the Delve's whole grid (120 × 56) with room to grow. */
export const DELVE_MAX_CELLS = 16_384;
/** Node indices are bytes (terrain.ts TERRAIN_NODE_LIST). */
const MAX_KIND = 255;

export interface DelveAreaSave {
  layout: string;
  /** Encoded diff: see encodeCells. */
  cells: string;
  /** Explored cells (the map's fog of war), under the same layout: see encodeSeen. Absent = nothing explored. */
  seen?: string;
}

export interface DelveSave {
  version: 1;
  seed: number;
  createdAt: number;
  areas: Record<string, DelveAreaSave>;
  claimed: string[];
  /** Placed chests' contents, by `chestKey(areaId, cellIndex)`. Absent on saves with none. */
  chests?: Record<string, DelveChest>;
}

/** Distinct stacks one chest holds. Quantities are unbounded: a slot is a kind of thing. */
export const CHEST_SLOTS = 4;

/**
 * One placed chest. Its contents are satchel stacks moved through the
 * inventory ledger (a consume to put in, a grant to take out), so nothing is
 * minted or lost here: this records only where they went.
 *
 * `born` names this chest for good (a chest taken back and placed again in
 * the same cell is a new chest), and `n` counts its moves; together they make
 * each move's mutation id, so a replayed move never runs twice. `n` only grows,
 * which is what the merge keeps.
 */
export interface DelveChest {
  /** The layout the chest's cell index belongs to (see terrainLayout). */
  layout: string;
  born: number;
  n: number;
  slots: Record<string, number>;
}

/** Pieces of gear (item instances) one chest holds, on top of its CHEST_SLOTS kinds of material. */
export const CHEST_GEAR_SLOTS = 6;

/**
 * Gear in a chest is not copied anywhere: the item stays in the inventory
 * ledger and its location is set to this holder (the same `explorer`
 * location thralls and expedition explorers use), so it cannot be worn,
 * sold or dropped until it comes back to the bag. The id is fixed by the
 * chest's `born`, so a chest placed again in the same cell is a new holder.
 */
const CHEST_HOLDER = 'delve-chest:';
export function chestHolderId(chest: Pick<DelveChest, 'born'>): string { return `${CHEST_HOLDER}${chest.born}`; }
export function isChestHolder(id: string | null | undefined): boolean { return !!id && id.startsWith(CHEST_HOLDER); }

/**
 * Items a chest holds that no chest record names any more (the record was
 * refunded, merged away by a later chest, or lost): their ids, to send back
 * to the bag. Pure.
 */
export function strayChestGear(items: readonly { id: string; explorerId?: string }[], chests: Readonly<Record<string, DelveChest>> | undefined): string[] {
  const live = new Set(Object.values(chests ?? {}).map(chestHolderId));
  return items.filter(item => isChestHolder(item.explorerId) && !live.has(item.explorerId!)).map(item => item.id);
}

/** Where a chest's contents are filed: area and cell index. */
export function chestKey(areaId: string, index: number): string {
  return `${areaId}:${index.toString(36)}`;
}

/** Put `qty` of a stack in. False when it would need a fifth slot. Mutates `chest`. */
export function chestPut(chest: DelveChest, stackKey: string, qty: number): boolean {
  if (!stackKey || !Number.isInteger(qty) || qty < 1) return false;
  if (!chest.slots[stackKey] && Object.keys(chest.slots).length >= CHEST_SLOTS) return false;
  chest.slots = { ...chest.slots, [stackKey]: (chest.slots[stackKey] ?? 0) + qty };
  chest.n++;
  return true;
}

/** Take up to `qty` of a stack out; returns how many came out. Mutates `chest`. */
export function chestTake(chest: DelveChest, stackKey: string, qty = Infinity): number {
  const have = chest.slots[stackKey] ?? 0;
  const out = Math.min(have, Math.max(0, Math.floor(qty)));
  if (out <= 0) return 0;
  const slots = { ...chest.slots };
  if (have - out > 0) slots[stackKey] = have - out; else delete slots[stackKey];
  chest.slots = slots;
  chest.n++;
  return out;
}

function coerceChest(value: unknown): DelveChest | null {
  if (!isRecord(value) || typeof value['layout'] !== 'string') return null;
  const born = value['born'], n = value['n'];
  if (typeof born !== 'number' || !Number.isFinite(born) || typeof n !== 'number' || !Number.isInteger(n) || n < 0) return null;
  const slots: Record<string, number> = {};
  if (isRecord(value['slots'])) {
    for (const [key, qty] of Object.entries(value['slots'])) {
      if (key.length > 0 && key.length <= 80 && typeof qty === 'number' && Number.isInteger(qty) && qty > 0 && Object.keys(slots).length < CHEST_SLOTS) slots[key] = qty;
    }
  }
  return { layout: value['layout'], born, n, slots };
}

/** A fresh save around a rolled seed. */
export function newDelveSave(seed: number, now: number): DelveSave {
  return { version: DELVE_SAVE_VERSION, seed: seed >>> 0, createdAt: Math.floor(now), areas: {}, claimed: [] };
}

/** A uint32 from the platform's crypto, or Math.random as a last resort. Never 0. */
export function rollSeed(source?: { getRandomValues?: (a: Uint32Array) => Uint32Array }): number {
  const out = new Uint32Array(1);
  try {
    if (source?.getRandomValues) source.getRandomValues(out);
    else out[0] = Math.floor(Math.random() * 0xffffffff);
  } catch {
    out[0] = Math.floor(Math.random() * 0xffffffff);
  }
  return out[0] || 0x9e3779b9;
}

/** "index.kind" pairs in base 36, sorted by index, comma-joined. Deterministic for a given map. */
export function encodeCells(cells: ReadonlyMap<number, number>): string {
  const indices = [...cells.keys()].filter(i => Number.isInteger(i) && i >= 0).sort((a, b) => a - b);
  const out: string[] = [];
  for (const index of indices) {
    const kind = cells.get(index)!;
    if (!Number.isInteger(kind) || kind < 0 || kind > MAX_KIND) continue;
    out.push(`${index.toString(36)}.${kind.toString(36)}`);
    if (out.length >= DELVE_MAX_CELLS) break;
  }
  return out.join(',');
}

/** The inverse of encodeCells. Malformed pairs are skipped, never thrown on. */
export function decodeCells(encoded: unknown): Map<number, number> {
  const out = new Map<number, number>();
  if (typeof encoded !== 'string' || !encoded) return out;
  for (const pair of encoded.split(',')) {
    const dot = pair.indexOf('.');
    if (dot <= 0) continue;
    const index = parseInt(pair.slice(0, dot), 36), kind = parseInt(pair.slice(dot + 1), 36);
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(kind) || kind < 0 || kind > MAX_KIND) continue;
    out.set(index, kind);
    if (out.size >= DELVE_MAX_CELLS) break;
  }
  return out;
}

/**
 * The explored-cells bitset (one bit per cell, cell index i at byte i >> 3,
 * bit i & 7), as blocks of 64 cells: a block with nothing explored is left
 * out, a fully explored one is its base-36 number alone, anything else is
 * "number.hex" (16 hex digits, byte order). An explored cave is mostly whole
 * blocks, so a well-walked Delve costs a few hundred bytes. Deterministic.
 */
export function encodeSeen(bits: Uint8Array): string {
  const out: string[] = [];
  for (let block = 0; block * 8 < bits.length; block++) {
    let any = 0, all = 255, hex = '';
    for (let b = 0; b < 8; b++) {
      const v = bits[block * 8 + b] ?? 0;
      any |= v; all &= v;
      hex += v.toString(16).padStart(2, '0');
    }
    if (!any) continue;
    out.push(all === 255 ? block.toString(36) : `${block.toString(36)}.${hex}`);
  }
  return out.join(',');
}

/** The inverse of encodeSeen, for a grid of `cells` cells. Malformed or out-of-range blocks are skipped. */
export function decodeSeen(encoded: unknown, cells: number): Uint8Array {
  const bits = new Uint8Array((Math.max(0, cells) + 7) >> 3);
  if (typeof encoded !== 'string' || !encoded) return bits;
  for (const part of encoded.split(',')) {
    const dot = part.indexOf('.');
    const block = parseInt(dot < 0 ? part : part.slice(0, dot), 36);
    if (!Number.isInteger(block) || block < 0 || block * 8 >= bits.length) continue;
    const hex = dot < 0 ? 'ff'.repeat(8) : part.slice(dot + 1);
    if (!/^[0-9a-f]{16}$/.test(hex)) continue;
    for (let b = 0; b < 8 && block * 8 + b < bits.length; b++) bits[block * 8 + b] |= parseInt(hex.slice(b * 2, b * 2 + 2), 16);
  }
  return bits;
}

/** Two devices' explored cells: what either explored (a union). Encoded in, encoded out. */
export function mergeSeen(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  const parts = new Map<number, number[]>();
  for (const encoded of [a, b]) {
    for (const part of encoded.split(',')) {
      const dot = part.indexOf('.');
      const block = parseInt(dot < 0 ? part : part.slice(0, dot), 36);
      const hex = dot < 0 ? 'ff'.repeat(8) : part.slice(dot + 1);
      if (!Number.isInteger(block) || block < 0 || !/^[0-9a-f]{16}$/.test(hex)) continue;
      const bytes = parts.get(block) ?? new Array(8).fill(0);
      for (let n = 0; n < 8; n++) bytes[n] |= parseInt(hex.slice(n * 2, n * 2 + 2), 16);
      parts.set(block, bytes);
    }
  }
  const size = (Math.max(-1, ...parts.keys()) + 1) * 8;
  const bits = new Uint8Array(size);
  for (const [block, bytes] of parts) bits.set(bytes, block * 8);
  return encodeSeen(bits) || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Whatever was read, as a valid save, or null when there is no usable seed.
 * Future versions are read as far as they agree with this one; junk areas and
 * ids are dropped.
 */
export function coerceDelveSave(value: unknown): DelveSave | null {
  if (!isRecord(value)) return null;
  const seed = value['seed'];
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return null;
  const createdAt = typeof value['createdAt'] === 'number' && Number.isFinite(value['createdAt']) ? Math.floor(value['createdAt'] as number) : 0;
  const areas: Record<string, DelveAreaSave> = {};
  if (isRecord(value['areas'])) {
    for (const [id, area] of Object.entries(value['areas'])) {
      if (!isRecord(area) || typeof area['layout'] !== 'string' || typeof area['cells'] !== 'string') continue;
      areas[id] = { layout: area['layout'], cells: area['cells'] };
      if (typeof area['seen'] === 'string' && area['seen']) areas[id].seen = area['seen'];
    }
  }
  const claimed = Array.isArray(value['claimed'])
    ? [...new Set((value['claimed'] as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 80))].sort()
    : [];
  const out: DelveSave = { version: DELVE_SAVE_VERSION, seed: seed >>> 0, createdAt, areas, claimed };
  if (isRecord(value['chests'])) {
    const chests: Record<string, DelveChest> = {};
    for (const [key, chest] of Object.entries(value['chests'])) {
      const row = coerceChest(chest);
      if (row && key.length <= 120) chests[key] = row;
    }
    if (Object.keys(chests).length) out.chests = chests;
  }
  return out;
}

/** The diff saved for an area under `layout`, or an empty map when it was dug under another. */
export function cellsFor(save: DelveSave | null, areaId: string, layout: string): Map<number, number> {
  const area = save?.areas[areaId];
  return area && area.layout === layout ? decodeCells(area.cells) : new Map();
}

/** Record that a once-per-player find was paid. True the first time only. Mutates `save`. */
export function claimOnce(save: DelveSave, id: string): boolean {
  if (!id || save.claimed.includes(id)) return false;
  save.claimed = [...save.claimed, id].sort();
  return true;
}

/**
 * Two devices' Delves into one.
 *
 * The seed is not a number to take the larger of: two seeds are two different
 * Delves. The one rolled first wins (the player's original Delve, on whichever
 * device it was), ties to the lower seed so the rule is commutative. Diffs are
 * then kept only where they were dug in the same layout; per cell the local
 * dig wins a disagreement (it is the one on screen). A diff dug under the
 * losing seed is dropped: its indices name another Delve's rock.
 * `claimed` is a union: a fragment paid on either device is paid. Explored
 * cells (`seen`) are a union too, under the same layout rule as the diff.
 */
export function mergeDelveSaves(remote: unknown, local: unknown): unknown {
  const r = coerceDelveSave(remote), l = coerceDelveSave(local);
  if (!r) return l ?? local;
  if (!l) return r;
  const localWins = l.createdAt !== r.createdAt ? (l.createdAt || Infinity) < (r.createdAt || Infinity) : l.seed <= r.seed;
  const winner = localWins ? l : r;
  const areas: Record<string, DelveAreaSave> = {};
  for (const id of new Set([...Object.keys(l.areas), ...Object.keys(r.areas)])) {
    const mine = l.areas[id], theirs = r.areas[id];
    if (mine && theirs && mine.layout === theirs.layout) {
      const cells = decodeCells(theirs.cells);
      for (const [index, kind] of decodeCells(mine.cells)) cells.set(index, kind);
      areas[id] = { layout: mine.layout, cells: encodeCells(cells) };
      // Explored on either device is explored.
      const seen = mergeSeen(mine.seen, theirs.seen);
      if (seen) areas[id].seen = seen;
    } else {
      // Prefer the diff dug under the winning seed; otherwise keep whatever exists
      // (a stale one is dropped on load by its layout, so keeping it costs nothing).
      const seedTag = `:${winner.seed >>> 0}`;
      const pick = [mine, theirs].find(a => a?.layout.endsWith(seedTag)) ?? (localWins ? mine ?? theirs : theirs ?? mine);
      if (pick) areas[id] = { ...pick };
    }
  }
  const claimed = [...new Set([...l.claimed, ...r.claimed])].sort();
  const merged: DelveSave = { version: DELVE_SAVE_VERSION, seed: winner.seed, createdAt: winner.createdAt, areas, claimed };
  // Chests: per chest, the copy that has seen more moves (same chest: higher n;
  // a re-placed chest: the later `born`). Local wins a tie, as cells do.
  const chests: Record<string, DelveChest> = {};
  for (const key of new Set([...Object.keys(l.chests ?? {}), ...Object.keys(r.chests ?? {})])) {
    const mine = l.chests?.[key], theirs = r.chests?.[key];
    const pick = !mine ? theirs! : !theirs ? mine
      : mine.born !== theirs.born ? (mine.born > theirs.born ? mine : theirs)
      : theirs.n > mine.n ? theirs : mine;
    chests[key] = { ...pick, slots: { ...pick.slots } };
  }
  if (Object.keys(chests).length) merged.chests = chests;
  return merged;
}
