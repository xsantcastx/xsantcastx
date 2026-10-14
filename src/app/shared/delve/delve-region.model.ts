/**
 * delve-region.model.ts — the endless Delve's save v2: sector diffs grouped
 * into regions (docs/world/delve-and-beyond.md §3.4). Pure: no Angular, no
 * storage. Small on purpose: cloud-save.model.ts imports the merge eagerly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SHAPE
 * ─────────────────────────────────────────────────────────────────────────────
 * The core (the shipped 120 × 56 grid) stays in `godforge-delve` exactly as in
 * v1 (`areas['ember-delve']`: the spec's `core`). Everything east and west of
 * it is a sector diff, and sectors are grouped by region, 8 × 8 sectors:
 *
 *   { v: 1, seed, rx, ry, t,            // t: the region's last change, epoch ms
 *     sectors: { 'sx,sy': {
 *       g: 1,                            // generator version it was dug under
 *       t: 1760000000000,                // last change (the regrowth clock)
 *       c: 'AQIDBA',                     // changed cells: runs of (index, kind), base64url varints
 *       l: '…',                          // settled liquid unlike the generated (index → type × 16 + level)
 *       f: '00ff00ff00000000',           // explored 4 × 4 blocks, 64 bits as 16 hex digits
 *       k: '…',                          // receipts: dug finds that never regrow (index runs)
 *       h: 1760000000000,                // when it regrew, if it did
 *     } } }
 *
 * Locally every region lives in IndexedDB (delve-region-store.ts; a
 * localStorage key when IndexedDB is missing). In the cloud, the 16 regions
 * changed most recently ride in 16 slot documents (`godforge-delve-r0..15` →
 * `progress/delve-r0..15`, matched by the existing `progress/{docId}` rule):
 * owner decision, 2026-10-14. A region pushed out of the slots stays on its
 * device and goes back up the next time it changes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MERGE (two devices)
 * ─────────────────────────────────────────────────────────────────────────────
 * Per sector: cells and liquid are unioned with the local copy winning a
 * disagreeing cell (as the core always has); explored blocks are OR'd; `t` is
 * the later; a regrowth (`h`) wins over every change older than it. A slot
 * holding two different regions keeps the one changed later (the other is
 * still on the device that had it). Regions dug under another seed are never
 * mixed: the seed rule (earliest-rolled wins) lives in the index blob.
 */

/** Sectors per region edge. */
export const REGION_SECTORS = 8;
/** Region documents synced per player (owner decision). */
export const REGION_SLOTS = 16;
/** A far, unheld, unchanged sector regrows after this long (real time). */
export const REGROW_MS = 14 * 24 * 60 * 60 * 1000;
/** …and only this many sectors (Chebyshev) or more from any camp or chest. */
export const REGROW_CLEARANCE = 4;
/** Most sectors one region holds (8 × 8). */
const MAX_SECTORS = REGION_SECTORS * REGION_SECTORS;
/** Most cells a sector's diff can name (32 × 32). */
const SECTOR_CELLS = 1024;

export const REGION_SLOT_KEYS: readonly string[] = Array.from({ length: REGION_SLOTS }, (_, n) => `godforge-delve-r${n}`);

export interface SectorDiff {
  g: number;
  t: number;
  c?: string;
  l?: string;
  f?: string;
  k?: string;
  h?: number;
}

export interface DelveRegion {
  v: 1;
  seed: number;
  rx: number;
  ry: number;
  t: number;
  sectors: Record<string, SectorDiff>;
}

export function regionOf(sx: number, sy: number): { rx: number; ry: number } {
  return { rx: Math.floor(sx / REGION_SECTORS), ry: Math.floor(sy / REGION_SECTORS) };
}
export function regionKey(rx: number, ry: number): string { return `${rx}_${ry}`; }
export function sectorKey(sx: number, sy: number): string { return `${sx},${sy}`; }
export function parseSectorKey(key: string): { sx: number; sy: number } | null {
  const m = /^(-?\d{1,7}),(-?\d{1,4})$/.exec(key);
  return m ? { sx: Number(m[1]), sy: Number(m[2]) } : null;
}

// ── Runs: (index, value) pairs as base64url varints ──────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = new Map([...B64].map((ch, i) => [ch, i]));

function toBase64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}
function fromBase64(text: string): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const v = j < chunk.length ? B64_INDEX.get(chunk[j]) : 0;
      if (v === undefined) return null;
      n = (n << 6) | v;
    }
    out.push((n >> 16) & 255);
    if (chunk.length > 2) out.push((n >> 8) & 255);
    if (chunk.length > 3) out.push(n & 255);
  }
  return out;
}
function putVarint(out: number[], n: number): void {
  while (n >= 128) { out.push((n & 127) | 128); n = Math.floor(n / 128); }
  out.push(n);
}

/**
 * Index → value pairs as runs: (gap from the last run's end, length, value)
 * varints, sorted by index, base64url. A tunnel is a few runs of air: a dug
 * corridor of 30 cells costs about four bytes. Deterministic for a given map.
 */
export function encodeRuns(cells: ReadonlyMap<number, number>, limit = SECTOR_CELLS): string {
  const indices = [...cells.keys()].filter(i => Number.isInteger(i) && i >= 0 && i < limit).sort((a, b) => a - b);
  const bytes: number[] = [];
  let end = 0, n = 0;
  while (n < indices.length) {
    const start = indices[n], value = cells.get(start)!;
    if (!Number.isInteger(value) || value < 0 || value > 255) { n++; continue; }
    let len = 1;
    while (n + len < indices.length && indices[n + len] === start + len && cells.get(indices[n + len]) === value) len++;
    putVarint(bytes, start - end); putVarint(bytes, len); putVarint(bytes, value);
    end = start + len; n += len;
  }
  return toBase64(bytes);
}

/** The inverse of encodeRuns. Malformed input yields what parsed before it, never a throw. */
export function decodeRuns(encoded: unknown, limit = SECTOR_CELLS): Map<number, number> {
  const out = new Map<number, number>();
  if (typeof encoded !== 'string' || !encoded || encoded.length > limit * 8) return out;
  const bytes = fromBase64(encoded);
  if (!bytes) return out;
  let p = 0, end = 0;
  const read = (): number => {
    let n = 0, scale = 1;
    for (let k = 0; k < 4 && p < bytes.length; k++) {
      const b = bytes[p++];
      n += (b & 127) * scale; scale *= 128;
      if (!(b & 128)) return n;
    }
    return -1;
  };
  while (p < bytes.length) {
    const gap = read(), len = read(), value = read();
    if (gap < 0 || len < 1 || value < 0 || value > 255) break;
    const start = end + gap;
    if (start + len > limit) break;
    for (let i = start; i < start + len; i++) out.set(i, value);
    end = start + len;
  }
  return out;
}

/** A set of indices (receipts) as runs of value 1. */
export function encodeIndexSet(set: ReadonlySet<number>): string { return encodeRuns(new Map([...set].map(i => [i, 1]))); }
export function decodeIndexSet(encoded: unknown): Set<number> { return new Set(decodeRuns(encoded).keys()); }

/** Explored blocks (8 bytes) as 16 hex digits, and back (anything malformed is unexplored). */
export function encodeFog(fog: Uint8Array): string { return [...fog.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('').padEnd(16, '0'); }
export function decodeFog(encoded: unknown): Uint8Array | null {
  if (typeof encoded !== 'string' || !/^[0-9a-f]{16}$/.test(encoded)) return null;
  const out = new Uint8Array(8);
  for (let b = 0; b < 8; b++) out[b] = parseInt(encoded.slice(b * 2, b * 2 + 2), 16);
  return out;
}
function orFog(a: string | undefined, b: string | undefined): string | undefined {
  const x = decodeFog(a), y = decodeFog(b);
  if (!x) return y ? b : undefined;
  if (!y) return a;
  for (let i = 0; i < 8; i++) x[i] |= y[i];
  return encodeFog(x);
}

// ── Coerce and merge ─────────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function coerceSector(value: unknown): SectorDiff | null {
  if (!isRecord(value) || !Number.isInteger(value['g']) || (value['g'] as number) < 0) return null;
  const out: SectorDiff = { g: value['g'] as number, t: isStamp(value['t']) ? Math.floor(value['t']) : 0 };
  for (const key of ['c', 'l', 'k'] as const) if (typeof value[key] === 'string' && (value[key] as string).length <= 8192) out[key] = value[key] as string;
  if (decodeFog(value['f'])) out.f = value['f'] as string;
  if (isStamp(value['h'])) out.h = Math.floor(value['h']);
  return out;
}

/** A region as stored, or null when it is not one. Junk sectors are dropped. */
export function coerceRegion(value: unknown): DelveRegion | null {
  if (!isRecord(value)) return null;
  const seed = value['seed'], rx = value['rx'], ry = value['ry'];
  if (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > 0xffffffff || !Number.isInteger(rx) || !Number.isInteger(ry)) return null;
  const sectors: Record<string, SectorDiff> = {};
  if (isRecord(value['sectors'])) {
    for (const [key, sector] of Object.entries(value['sectors'])) {
      const at = parseSectorKey(key);
      if (!at) continue;
      const r = regionOf(at.sx, at.sy);
      if (r.rx !== rx || r.ry !== ry) continue;
      const diff = coerceSector(sector);
      if (diff && Object.keys(sectors).length < MAX_SECTORS) sectors[key] = diff;
    }
  }
  return { v: 1, seed: (seed as number) >>> 0, rx: rx as number, ry: ry as number, t: isStamp(value['t']) ? Math.floor(value['t']) : 0, sectors };
}

/**
 * Two copies of one sector. A regrowth wins over every change older than it;
 * otherwise cells and liquid are unioned, `local` winning a disagreement.
 * Different generator versions: the newer one's copy (the older one's cells
 * would be re-read as the newer generator's anyway).
 */
export function mergeSector(local: SectorDiff, remote: SectorDiff): SectorDiff {
  if (local.g !== remote.g) return local.g > remote.g ? { ...local, f: orFog(local.f, remote.f) } : { ...remote, f: orFog(local.f, remote.f) };
  const h = Math.max(local.h ?? 0, remote.h ?? 0);
  const fresh = (side: SectorDiff) => !h || side.t > h;
  const sides = [remote, local].filter(fresh);
  const union = (field: 'c' | 'l' | 'k') => {
    const out = new Map<number, number>();
    for (const side of sides) for (const [i, v] of decodeRuns(side[field])) out.set(i, v);
    return out;
  };
  const cells = union('c'), liquids = union('l');
  const receipts = new Map<number, number>();
  for (const side of [remote, local]) for (const [i, v] of decodeRuns(side.k)) receipts.set(i, v);
  const out: SectorDiff = { g: local.g, t: Math.max(local.t, remote.t) };
  // A regrown sector keeps its receipts dug, whatever side they came from.
  for (const i of receipts.keys()) if (!cells.has(i)) cells.set(i, 0);
  if (cells.size) out.c = encodeRuns(cells);
  if (liquids.size) out.l = encodeRuns(liquids);
  if (receipts.size) out.k = encodeRuns(receipts);
  const f = orFog(local.f, remote.f);
  if (f) out.f = f;
  if (h) out.h = h;
  return out;
}

/** Two copies of one region (same seed and place): every sector merged. */
export function mergeRegion(local: DelveRegion, remote: DelveRegion): DelveRegion {
  const sectors: Record<string, SectorDiff> = {};
  for (const key of new Set([...Object.keys(local.sectors), ...Object.keys(remote.sectors)])) {
    const a = local.sectors[key], b = remote.sectors[key];
    sectors[key] = a && b ? mergeSector(a, b) : { ...(a ?? b)! };
  }
  return { v: 1, seed: local.seed, rx: local.rx, ry: local.ry, t: Math.max(local.t, remote.t), sectors };
}

/**
 * Two devices' copies of one slot document (SYNCED_BLOBS' merge). The same
 * region under the same seed: merged. Different regions (each device filled the
 * slot with its own): the one changed later, local on a tie; the other stays on
 * its device.
 */
export function mergeRegionSlots(remote: unknown, local: unknown): unknown {
  const r = coerceRegion(remote), l = coerceRegion(local);
  if (!r) return l ?? local;
  if (!l) return r;
  if (r.seed === l.seed && r.rx === l.rx && r.ry === l.ry) return mergeRegion(l, r);
  return r.t > l.t ? r : l;
}

// ── Regrowth (§3.4 "the Delve keeps what is held") ─────────────────────────

/**
 * Whether a sector regrows now: outside the core, nothing placed in it, no
 * change for REGROW_MS, and at least REGROW_CLEARANCE sectors from every
 * anchor (a camp or a chest). `placed(kind)` says whether a node is a placed
 * or made thing (the service passes the terrain's list in; this file stays
 * free of it). Already regrown since its last change: no.
 */
export function shouldRegrow(sx: number, sy: number, diff: SectorDiff, now: number, opts: {
  coreSectors: number; placed: (kind: number) => boolean; anchors: readonly { sx: number; sy: number }[];
}): boolean {
  if (sx >= 0 && sx < opts.coreSectors) return false;
  if (diff.h && diff.h >= diff.t) return false;
  if (now - diff.t < REGROW_MS) return false;
  if (!diff.c && !diff.l) return false;
  for (const kind of decodeRuns(diff.c).values()) if (opts.placed(kind)) return false;
  return !opts.anchors.some(a => Math.max(Math.abs(a.sx - sx), Math.abs(a.sy - sy)) <= REGROW_CLEARANCE);
}

/** The sector after regrowth: only its receipts stay dug; the map remembers it was explored. */
export function regrow(diff: SectorDiff, now: number): SectorDiff {
  const out: SectorDiff = { g: diff.g, t: diff.t, h: now };
  const receipts = decodeRuns(diff.k);
  if (receipts.size) { out.k = diff.k; out.c = encodeRuns(new Map([...receipts.keys()].map(i => [i, 0]))); }
  if (diff.f) out.f = diff.f;
  return out;
}
