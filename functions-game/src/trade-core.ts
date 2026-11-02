/**
 * trade-core.ts — Phase 6 trading and shared ground drops (docs/design/online.md §3.8, §4c), the server half.
 *
 * Pure and dependency-free on purpose: the same file runs inside the `tradeApi` Cloud Function (trade.ts wires
 * firebase-admin to the `Db` below), under `node --test` (scripts/trade-core.test.mjs, through Node's type stripping),
 * and inside the local e2e's fake endpoint (scripts/trade-fake.mjs). One implementation, three callers.
 *
 * ── Who is the authority ──────────────────────────────────────────────────────────────────────────────────────────
 * The Hearth relays a trade's negotiation (offers, Accept) and is the only writer of `trades/{id}`'s parties: it
 * verified both ID tokens, so it binds "Keeper A in the room" to a uid. It never moves anything. This file is the only
 * thing that moves items or Gold, and it does so inside ONE Firestore transaction per verb. Each player confirms by
 * calling `execute` with the exact terms they saw; the swap happens when the second identical confirmation lands.
 *
 * ── How the writes speak the merge (memory: "Admin writes must speak the merge") ──────────────────────────────────
 * Every player save is a set of CRDT-ish ledgers that devices reconcile generously. A plain field write is undone by
 * the next device holding an older copy. So:
 *   · An item LEAVES a save as a tombstone at hlc = Number.MAX_SAFE_INTEGER (deviceId `trade`). The merge drops any
 *     record its tombstone outranks, and nothing a device can stamp later outranks this one — a stale phone that
 *     still holds the record, or even re-equips it, loses it on its next merge. The ledger's own `hlc` is NOT raised
 *     to match (the merge computes `hlc` from records and folds only), so the device clocks are untouched.
 *   · An item ARRIVES as a new record under a NEW id (derived from the trade/ground id, so a retry is the same id) at
 *     hlc = max(now, ledger.hlc + 1). The new id is what lets an item come back to a Keeper who once gave it away:
 *     the old id's MAX tombstone would otherwise eat it.
 *   · Gold leaves as a `spend-gold` op and arrives as a `receive-gold` op (a credit that is not "earned": trading
 *     Gold back and forth must not farm the all-time counters), both `trade:<seq>` with seq above every `trade` op and
 *     watermark the ledger has seen, at hlc = nextHlc(ledger.hlc). Ops union by id on every device, so each lands
 *     exactly once, forever. The debit is checked against the REPLAYED balance (origin + ops), because a replay is
 *     what every device will do: a debit the replay cannot afford is skipped there, which would mint Gold.
 *   · `serverSeq` on the inventory ledger goes up by one on every server write. The merge keeps the max, and the
 *     rule on the inventory document refuses a client write whose `v.serverSeq` is lower than the stored one — the
 *     optimistic-concurrency guard that stops a device's read-merge-setDoc (not a transaction) from overwriting this
 *     write with a copy it read a moment before. The refused device re-reads, merges, and lands. The economy document
 *     needs no such guard: the client already writes it in a transaction, which retries on contention.
 */

// ── Constants (pinned to the client's by scripts/trade-core.test.mjs) ─────────────────────────────────────────────
/** inventory.model.ts INVENTORY_ERA: a save in another era is refused (open the game once to bring it up to date). */
export const INVENTORY_ERA = 55;
/** economy-curve.ts ECONOMY_VERSION / GOLD_ERA: the ledger must be current before Gold can move. */
export const ECONOMY_VERSION = 3;
export const GOLD_ERA = 1;
/** inventory-layout.ts INSTANCE_RECORD_BUDGET: a save never holds more instance records than this. */
export const INSTANCE_RECORD_BUDGET = 700;
/** The device id on every op and revision this file writes. */
export const TRADE_DEVICE = 'trade';
/** A tombstone nothing can outrank. */
export const SERVER_TOMB_HLC = Number.MAX_SAFE_INTEGER;
export const TRADE_MAX_ITEMS = 12;
export const TRADE_MAX_GOLD = 1_000_000_000;
/** An open trade lapses (the Hearth stamps `expiresAt`; this is the ceiling it may use). */
export const TRADE_TTL_MS = 10 * 60_000;
/** A ground item goes home to its dropper after this long. */
export const GROUND_TTL_MS = 10 * 60_000;
/** At most this many items on the ground in one area. */
export const GROUND_AREA_MAX = 60;
/** At most this many drops per account per window. */
export const GROUND_RATE_MAX = 10;
export const GROUND_RATE_WINDOW_MS = 60_000;

// ── The store ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** One transaction: every read before any write (Firestore's rule, kept by every caller here). */
export interface Tx {
  get(path: string): Promise<Doc | null>;
  set(path: string, data: Doc): void;
  delete(path: string): void;
}
export type Doc = Record<string, unknown>;
export interface Db {
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Ground item ids whose `expiresAt` is at or before `now` (the scheduled sweep). */
  expiredGround(now: number, limit: number): Promise<string[]>;
}

export class TradeError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
const refuse = (status: number, code: string, message: string): never => { throw new TradeError(status, code, message); };

// ── Paths ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const CHARACTER = /^[a-z0-9]{2,16}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const AREA = /^[a-z0-9_-]{1,40}$/;
const ID = /^[A-Za-z0-9:._~-]{1,96}$/;
/** character-scope.ts characterDocPath: character #1 keeps the root paths. */
export function savePath(uid: string, character: string, collection: 'progress' | 'economy', doc: string): string {
  return character === 'c1' ? `users/${uid}/${collection}/${doc}` : `users/${uid}/characters/${character}/${collection}/${doc}`;
}
export const inventoryPath = (uid: string, character: string) => savePath(uid, character, 'progress', 'inventory');
export const economyPath = (uid: string, character: string) => savePath(uid, character, 'economy', 'state');
export const tradePath = (id: string) => `trades/${id}`;
export const groundItemPath = (id: string) => `ground-items/${id}`;
export const groundAreaPath = (area: string) => `ground/${area}`;
export const groundRatePath = (uid: string) => `ground-rate/${uid}`;
export const auditPath = (id: string) => `trade-audit/${id}`;

// ── Small pure helpers ────────────────────────────────────────────────────────────────────────────────────────────
const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** cyrb53, base 36: stable ids for what a retry must write again under the same name. */
export function hashId(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
/** JSON with every object's keys sorted: two clients' copies of the same terms compare equal as strings. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
const envelope = (v: unknown, now: number): Doc => ({ v, updatedAt: new Date(now).toISOString() });
const unwrap = (d: Doc | null): Doc | null => (d && isObj(d['v']) ? d['v'] as Doc : null);

// ── An item, as offered ───────────────────────────────────────────────────────────────────────────────────────────
/**
 * What a Keeper puts in the window: enough to draw the item's real card on the other screen, and exactly the fields
 * the swap re-checks against the save ("unchanged, by id and roll"). Short keys: it rides the Hearth.
 */
export interface OfferItem {
  id: string; def: string; name: string; type: string; rarity: string;
  stats: Record<string, number>;
  roll?: Record<string, number>; ilvl?: number; up?: number; sockets?: (string | null)[]; reforged?: number;
  /** A Spellstone's charges (the grid release): re-checked like the roll, so a stone used since it was offered is refused. */
  ch?: number;
  /**
   * A satchel STACK (potions, fish, meals, logs, runes, materials; 2026-10-27): its plain stack key and how many. Its id
   * is `stack:<sk>`. The swap re-counts the stack (folds included) and moves `qty` as one consume op on the giver and
   * one grant op on the taker, so a merge can never make or lose any.
   */
  sk?: string; qty?: number;
}
export interface Offer { items: OfferItem[]; gold: number }
export interface Terms { a: Offer; b: Offer }

const STAT_KEY = /^[A-Za-z]{1,32}$/;
/** A plain satchel stack key: no `:` (Vault keys `v:<tab>:<key>`, `storage:*` entitlements) and no `|` (packed ops). */
const STACK_KEY = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const STACK_OFFER_MAX = 1_000_000;
/** inventory-layout.ts QUEST_STACKS (pinned by trade-merge.spec): quest finds stay with their Keeper. */
export const QUEST_STACK_KEYS: ReadonlySet<string> = new Set([
  'kaels-hammer', 'godforge-fragment', 'shadow-root-cutting', 'rift-key', 'worn-rod', 'mirror-slate', 'mirror-slate-ii',
  'four-hammer-marks',
  'curio-unstruck-bell', 'curio-jar-of-noon', 'curio-blank-page', 'curio-lost-moon', 'curio-stubborn-seed', 'curio-tally-stick',
  'curio-blinking-mirror', 'curio-unsigned-letter', 'curio-pressed-rose', 'curio-moss-locket', 'curio-lamp-wick', 'curio-kept-coal',
  'curio-clean-ink', 'curio-backward-rings', 'curio-folded-shadow', 'curio-last-chart', 'hatbox-of-small-crowns', 'curators-loupe',
]);
/** True for a stack offer (`sk` + `qty`). */
export const isStackOffer = (o: OfferItem): boolean => typeof o.sk === 'string';
const numMap = (raw: unknown, what: string, lo: number, hi: number): Record<string, number> => {
  if (!isObj(raw)) refuse(400, 'bad-terms', `Invalid ${what}.`);
  const out: Record<string, number> = {};
  const entries = Object.entries(raw as Doc);
  if (entries.length > 32) refuse(400, 'bad-terms', `Invalid ${what}.`);
  for (const [k, v] of entries) {
    if (!STAT_KEY.test(k) || typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) refuse(400, 'bad-terms', `Invalid ${what}.`);
    out[k] = v as number;
  }
  return out;
};
const optInt = (v: unknown, lo: number, hi: number): number | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi) refuse(400, 'bad-terms', 'Invalid item.');
  return v as number;
};
const text = (v: unknown, max: number): string => {
  if (typeof v !== 'string' || !v || v.length > max || /[\u0000-\u001f<>]/.test(v)) refuse(400, 'bad-terms', 'Invalid item.');
  return v as string;
};
export function parseOfferItem(raw: unknown): OfferItem {
  if (!isObj(raw)) refuse(400, 'bad-terms', 'Invalid item.');
  const r = raw as Doc;
  for (const k of Object.keys(r)) if (!['id', 'def', 'name', 'type', 'rarity', 'stats', 'roll', 'ilvl', 'up', 'sockets', 'reforged', 'ch', 'sk', 'qty'].includes(k)) refuse(400, 'bad-terms', 'Invalid item.');
  if (typeof r['id'] !== 'string' || !ID.test(r['id'])) refuse(400, 'bad-terms', 'Invalid item.');
  const out: OfferItem = {
    id: r['id'] as string, def: text(r['def'], 96), name: text(r['name'], 80), type: text(r['type'], 16), rarity: text(r['rarity'], 24),
    stats: numMap(r['stats'], 'stats', -1e7, 1e7),
  };
  if (r['roll'] !== undefined && r['roll'] !== null) out.roll = numMap(r['roll'], 'roll', 0, 1);
  const ilvl = optInt(r['ilvl'], 1, 99); if (ilvl !== undefined) out.ilvl = ilvl;
  const up = optInt(r['up'], 0, 100); if (up !== undefined) out.up = up;
  const reforged = optInt(r['reforged'], 0, 10000); if (reforged !== undefined) out.reforged = reforged;
  const ch = optInt(r['ch'], 1, 100); if (ch !== undefined) out.ch = ch;
  if (r['sockets'] !== undefined && r['sockets'] !== null) {
    const s = r['sockets'];
    if (!Array.isArray(s) || s.length > 8 || s.some(x => x !== null && (typeof x !== 'string' || !ID.test(x)))) refuse(400, 'bad-terms', 'Invalid item.');
    out.sockets = (s as (string | null)[]).map(x => x ?? null);
  }
  if (r['sk'] !== undefined || r['qty'] !== undefined) {
    const sk = r['sk'], qty = r['qty'];
    if (typeof sk !== 'string' || !STACK_KEY.test(sk) || out.id !== `stack:${sk}` || !Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > STACK_OFFER_MAX) refuse(400, 'bad-terms', 'Invalid item.');
    out.sk = sk as string; out.qty = qty as number;
  }
  return out;
}
export function parseOffer(raw: unknown): Offer {
  if (!isObj(raw)) refuse(400, 'bad-terms', 'Invalid offer.');
  const r = raw as Doc;
  const items = r['items'];
  if (!Array.isArray(items) || items.length > TRADE_MAX_ITEMS) refuse(400, 'bad-terms', 'Invalid offer.');
  const gold = r['gold'];
  if (!Number.isInteger(gold) || (gold as number) < 0 || (gold as number) > TRADE_MAX_GOLD) refuse(400, 'bad-terms', 'Invalid offer.');
  const parsed = (items as unknown[]).map(parseOfferItem);
  if (new Set(parsed.map(i => i.id)).size !== parsed.length) refuse(400, 'bad-terms', 'An item is offered twice.');
  return { items: parsed, gold: gold as number };
}
export function parseTerms(raw: unknown): Terms {
  if (!isObj(raw)) refuse(400, 'bad-terms', 'Invalid terms.');
  const t = { a: parseOffer((raw as Doc)['a']), b: parseOffer((raw as Doc)['b']) };
  // Both may offer the same kind of stack (each its own); an instance is only ever on one side.
  const ids = [...t.a.items, ...t.b.items].filter(i => !isStackOffer(i)).map(i => i.id);
  if (new Set(ids).size !== ids.length) refuse(400, 'bad-terms', 'An item is offered twice.');
  return t;
}

/** The record's own fields, as an offer names them. */
export function offerOf(record: Doc): OfferItem {
  const out: OfferItem = {
    id: String(record['id']), def: String(record['definitionId']), name: String(record['name']), type: String(record['type']),
    rarity: String(record['rarity'] ?? 'common'), stats: isObj(record['stats']) ? clone(record['stats'] as Record<string, number>) : {},
  };
  if (isObj(record['rollQuality']) && Object.keys(record['rollQuality'] as Doc).length) out.roll = clone(record['rollQuality'] as Record<string, number>);
  if (typeof record['itemLevel'] === 'number') out.ilvl = record['itemLevel'];
  if (num(record['upgradeLevel']) > 0) out.up = num(record['upgradeLevel']);
  if (num(record['reforgeCount']) > 0) out.reforged = num(record['reforgeCount']);
  if (Array.isArray(record['sockets']) && (record['sockets'] as unknown[]).length) out.sockets = (record['sockets'] as unknown[]).map(x => (typeof x === 'string' && x ? x : null));
  if (num(record['charges']) > 0) out.ch = num(record['charges']);
  return out;
}
/** The record still is the item that was offered: same id, same definition, same roll, same improvements. */
export function sameItem(record: Doc, offered: OfferItem): boolean {
  return canonical(offerOf(record)) === canonical({ ...offered, ...(offered.up === 0 ? { up: undefined } : {}), ...(offered.reforged === 0 ? { reforged: undefined } : {}) });
}

// ── The packed inventory: save format 3 (docs/handoff/save-compaction.md) ────────────────────────────────────────
/**
 * The inventory document as Firestore holds it, from the compaction release on. The ledger itself does not change:
 * every device still merges the same v2 ledger (inventory-ops.ts) and keeps that in localStorage. Only the cloud copy
 * is written in this denser shape, because the owner's save was ~400 KB of a 1 MiB document (Firestore bytes).
 *
 * Lossless by construction: every key of every record maps to exactly one packed key, nothing is dropped for being a
 * default, and any value the packer does not recognise is kept verbatim (under `$` + its key for a record, or as the
 * original object in a list). `unpackInventory(packInventory(v))` deep-equals `v` for every v2 ledger (key order
 * aside), which scripts/trade-core.test.mjs and inventory-codec.spec.ts check against generated and real saves.
 *
 *   records    → `R`: one map per record, short keys; revisions as `hlc.device.seq` (base 36, device by index into `D`);
 *                ISO dates as epoch ms; locations as `b` / `e:<slot>` / `x:<explorer>`; repeated long strings
 *                (names, lore, definitions, tags) by index into `S`.
 *   tombstones → `T`: `hlc device seq deletedAt id` strings.
 *   stackOps   → `O`: `±qty|hlc|device|seq|stackKey|id` strings.
 *   stackFolds → `F`: `{d, u, n, h}` with the op-id hashes as one fixed-width string (9 chars each).
 *
 * The format is the document's `version: 3`. A client from before it cannot read it, and firestore.rules refuses its
 * writes to a document already in it (inventoryFormatHolds), so an old tab can neither read a packed save as empty
 * nor write a v2 save over it. The server (this file, the Function and the Hearth) reads both and writes back the
 * format it read, so it can ship before the client.
 */
export const INVENTORY_PACKED_VERSION = 3;
const REC_KEYS: Record<string, string> = {
  id: 'i', definitionId: 'd', category: 'c', tags: 't', rarity: 'y', soulbound: 'b', acquiredAt: 'a', revision: 'r',
  source: 's', kind: 'k', stackKey: 'sk', location: 'l', name: 'n', type: 'ty', lore: 'lo', stats: 'st', rollQuality: 'q',
  itemLevel: 'il', sellValue: 'sv', econ: 'e', upgradeLevel: 'ul', lastUpgradeAt: 'lua', lastUpgradeMutationId: 'lum',
  lastUpgradeOk: 'luo', reforgeCount: 'rc', lastReforgeAt: 'lra', lastReforgeMutationId: 'lrm', lastReforgeLock: 'lrl',
  sockets: 'so', curse: 'cu', whisper: 'wh',
  // The grid (docs/design/inventory-grid.md): a place and a Spellstone's charges.
  pos: 'g', charges: 'ch',
};
const REC_LONG: Record<string, string> = Object.fromEntries(Object.entries(REC_KEYS).map(([k, v]) => [v, k]));
/** Record keys whose string value goes through the shared string table when it repeats. */
const INTERNED = new Set(['definitionId', 'name', 'lore', 'type', 'rarity', 'category', 'source', 'kind', 'location']);
/**
 * The closed vocabularies (inventory.model.ts), as one-letter codes. A code is a 1–2 character string; a value of
 * these keys that is not in its list is kept as itself only when it is longer than that (else verbatim under `$`).
 */
const ENUMS: Record<string, readonly string[]> = {
  source: ['inventory', 'economy', 'runes'],
  kind: ['instance', 'stack'],
  category: ['equipment', 'runes', 'materials', 'consumables', 'quest', 'artifacts'],
  type: ['artifact', 'charm', 'rune', 'runeword'],
  rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique', 'set', 'ancient'],
};
/**
 * Stat maps (`stats`, `rollQuality`) whose keys go through the key table `K`, as letters (`a`, `b`, … `ba`): never an
 * integer-like key, which JavaScript would reorder — the order a stat map was written in is the order its card shows.
 */
const STAT_MAPS = new Set(['stats', 'rollQuality']);
const STAT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const INTERN_MIN = 8;
const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const HASH_WIDTH = 9;
const PACKED_TOP = ['D', 'S', 'K', 'R', 'T', 'O', 'F'];

const letters = (n: number): string => (n < 26 ? '' : letters(Math.floor(n / 26) - 1)) + String.fromCharCode(97 + (n % 26));
const fromLetters = (s: string): number => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 96); return n - 1; };
const safeInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const b36 = (n: number) => n.toString(36);
/** A base-36 string that is exactly the canonical spelling of a safe integer (what opIdHash produces). */
const fromB36 = (s: string): number | null => {
  if (!/^[0-9a-z]{1,11}$/.test(s)) return null;
  const n = parseInt(s, 36);
  return Number.isSafeInteger(n) && n.toString(36) === s ? n : null;
};
const hashCell = (n: number): string => {
  let out = '';
  for (let i = 0; i < HASH_WIDTH; i++) { out = B64[n % 64] + out; n = Math.floor(n / 64); }
  return out;
};
const cellHash = (s: string): number => { let n = 0; for (const ch of s) n = n * 64 + B64.indexOf(ch); return n; };
const isoMs = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  if (!Number.isSafeInteger(ms) || ms < 0) return null;
  try { return new Date(ms).toISOString() === v ? ms : null; } catch { return null; }
};
const exactKeys = (o: Doc, keys: readonly string[]) => Object.keys(o).length === keys.length && keys.every(k => k in o);

/** True for a document value in the packed format. */
export function isPackedInventory(v: unknown): boolean {
  return isObj(v) && v['version'] === INVENTORY_PACKED_VERSION && Array.isArray(v['R']);
}

/** A v2 inventory ledger (plain JSON) in the packed format. Anything that is not a v2 ledger comes back unchanged. */
export function packInventory(v: unknown): unknown {
  if (!isObj(v) || v['version'] !== 2 || !Array.isArray(v['records'])) return v;
  if (PACKED_TOP.some(k => k in v)) return v;
  const devs: string[] = [];
  const devIx = new Map<string, number>();
  const dev = (id: string): number => {
    let i = devIx.get(id);
    if (i === undefined) { i = devs.length; devs.push(id); devIx.set(id, i); }
    return i;
  };
  const rev = (r: unknown): string | null => {
    if (!isObj(r) || !exactKeys(r, ['hlc', 'deviceId', 'sequence'])) return null;
    if (!safeInt(r['hlc']) || !safeInt(r['sequence']) || typeof r['deviceId'] !== 'string') return null;
    return `${b36(r['hlc'])}.${b36(dev(r['deviceId']))}.${b36(r['sequence'])}`;
  };
  // Strings worth a table entry: long enough to beat an 8-byte index, and seen at least twice.
  const counts = new Map<string, number>();
  const tally = (s: unknown) => { if (typeof s === 'string' && s.length >= INTERN_MIN) counts.set(s, (counts.get(s) ?? 0) + 1); };
  const locText = (l: unknown): string | null => {
    if (isObj(l) && l['kind'] === 'bag' && exactKeys(l, ['kind'])) return 'b';
    if (isObj(l) && l['kind'] === 'equipped' && typeof l['slotId'] === 'string' && exactKeys(l, ['kind', 'slotId'])) return `e:${l['slotId']}`;
    if (isObj(l) && l['kind'] === 'explorer' && typeof l['explorerId'] === 'string' && exactKeys(l, ['kind', 'explorerId'])) return `x:${l['explorerId']}`;
    return null;
  };
  const statKeys: string[] = [];
  const statIx = new Map<string, number>();
  for (const r of v['records'] as unknown[]) {
    if (!isObj(r)) continue;
    for (const k of INTERNED) if (k !== 'location' && !ENUMS[k]?.includes(r[k] as string)) tally(r[k]);
    tally(locText(r['location']));
    if (Array.isArray(r['tags'])) (r['tags'] as unknown[]).forEach(tally);
  }
  const strs: string[] = [];
  const strIx = new Map<string, number>();
  for (const [s, n] of counts) if (n >= 2) { strIx.set(s, strs.length); strs.push(s); }
  const str = (s: string): string | number => strIx.get(s) ?? s;
  const packStats = (m: unknown): Doc | undefined => {
    if (!isObj(m) || !Object.keys(m).every(k => STAT_NAME.test(k))) return undefined;
    const out: Doc = {};
    for (const [k, x] of Object.entries(m)) {
      let i = statIx.get(k);
      if (i === undefined) { i = statKeys.length; statKeys.push(k); statIx.set(k, i); }
      out[letters(i)] = x;
    }
    return out;
  };

  /** A grid place as `k:c0,c1:hlc.dev.seq` (cells base 36); anything else stays verbatim. */
  const packPos = (p: unknown): string | undefined => {
    if (!isObj(p) || !exactKeys(p, ['k', 'c', 'r']) || typeof p['k'] !== 'string' || !/^[a-z0-9-]{1,24}$/.test(p['k'])) return undefined;
    const c = p['c'];
    if (!Array.isArray(c) || !c.length || !c.every(safeInt)) return undefined;
    const r = rev(p['r']);
    return r === null ? undefined : `${p['k']}:${(c as number[]).map(b36).join(',')}:${r}`;
  };
  const packRecord = (r: unknown): unknown => {
    if (!isObj(r)) return r;
    const out: Doc = {};
    for (const [k, val] of Object.entries(r)) {
      if (val === undefined) continue;
      const short = REC_KEYS[k];
      let packed: unknown = undefined;
      if (short) {
        if (k === 'revision') packed = rev(val) ?? undefined;
        else if (k === 'pos') packed = packPos(val);
        else if (k === 'acquiredAt') packed = isoMs(val) ?? undefined;
        else if (k === 'location') {
          const text = locText(val);
          if (text !== null) packed = str(text);
        } else if (k === 'tags') {
          if (Array.isArray(val) && val.every(t => typeof t === 'string')) packed = (val as string[]).map(str);
        } else if (STAT_MAPS.has(k)) packed = packStats(val);
        else if (INTERNED.has(k)) {
          const code = ENUMS[k]?.indexOf(val as string) ?? -1;
          if (code >= 0) packed = b36(code);
          else if (typeof val === 'string' && (!ENUMS[k] || val.length > 2)) packed = str(val);
        } else packed = val;
      }
      if (packed === undefined) out[`$${k}`] = val;
      else out[short] = packed;
    }
    return out;
  };
  const packTomb = (t: unknown): unknown => {
    if (!isObj(t) || !exactKeys(t, ['id', 'revision', 'deletedAt']) || typeof t['id'] !== 'string' || !safeInt(t['deletedAt'])) return t;
    const r = rev(t['revision']);
    return r === null ? t : `${r.replace(/\./g, ' ')} ${b36(t['deletedAt'])} ${t['id']}`;
  };
  const packOp = (o: unknown): unknown => {
    if (!isObj(o) || !exactKeys(o, ['id', 'stackKey', 'kind', 'quantity', 'hlc', 'deviceId', 'sequence'])) return o;
    const { id, stackKey, kind, quantity, hlc, deviceId, sequence } = o;
    if (typeof id !== 'string' || typeof stackKey !== 'string' || stackKey.includes('|') || typeof deviceId !== 'string') return o;
    if ((kind !== 'grant' && kind !== 'consume') || typeof quantity !== 'number' || !Number.isFinite(quantity) || !safeInt(hlc) || !safeInt(sequence)) return o;
    const qty = String(quantity);
    if (Number(qty) !== quantity || qty.includes('|')) return o;
    return `${kind === 'grant' ? '+' : '-'}${qty}|${b36(hlc)}|${b36(dev(deviceId))}|${b36(sequence)}|${stackKey}|${id}`;
  };
  const packFold = (f: unknown): unknown => {
    if (!isObj(f) || !exactKeys(f, ['deviceId', 'upToHlc', 'net', 'ids']) || typeof f['deviceId'] !== 'string' || !Array.isArray(f['ids'])) return f;
    const cells: string[] = [];
    for (const id of f['ids'] as unknown[]) {
      const n = typeof id === 'string' ? fromB36(id) : null;
      if (n === null || n >= 64 ** HASH_WIDTH) return f;
      cells.push(hashCell(n));
    }
    return { d: f['deviceId'], u: f['upToHlc'], n: f['net'], h: cells.join('') };
  };

  const out: Doc = { version: INVENTORY_PACKED_VERSION };
  const R = (v['records'] as unknown[]).map(packRecord);
  const T = Array.isArray(v['tombstones']) ? (v['tombstones'] as unknown[]).map(packTomb) : null;
  const O = Array.isArray(v['stackOps']) ? (v['stackOps'] as unknown[]).map(packOp) : null;
  const F = Array.isArray(v['stackFolds']) ? (v['stackFolds'] as unknown[]).map(packFold) : null;
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined || k === 'version' || k === 'records') continue;
    if ((k === 'tombstones' && T) || (k === 'stackOps' && O) || (k === 'stackFolds' && F)) continue;
    out[k] = val;
  }
  out['D'] = devs;
  out['S'] = strs;
  out['K'] = statKeys;
  out['R'] = R;
  if (T) out['T'] = T;
  if (O) out['O'] = O;
  if (F) out['F'] = F;
  return out;
}

/** A packed inventory back to the v2 ledger it was packed from. Anything not packed comes back unchanged. */
export function unpackInventory(v: unknown): unknown {
  if (!isPackedInventory(v)) return v;
  const p = v as Doc;
  const devs = Array.isArray(p['D']) ? p['D'] as unknown[] : [];
  const strs = Array.isArray(p['S']) ? p['S'] as unknown[] : [];
  const dev = (s: string): string => {
    const id = devs[parseInt(s, 36)];
    return typeof id === 'string' ? id : '';
  };
  const str = (x: unknown): unknown => (typeof x === 'number' && typeof strs[x] === 'string' ? strs[x] : x);
  const keys = Array.isArray(p['K']) ? p['K'] as unknown[] : [];
  const unStats = (m: unknown): unknown => {
    if (!isObj(m)) return m;
    const out: Doc = {};
    for (const [k, x] of Object.entries(m)) { const name = /^[a-z]+$/.test(k) ? keys[fromLetters(k)] : undefined; out[typeof name === 'string' ? name : k] = x; }
    return out;
  };
  const rev = (s: string) => {
    const [h, d, q] = s.split(/[. ]/);
    return { hlc: parseInt(h, 36), deviceId: dev(d), sequence: parseInt(q, 36) };
  };
  const unRecord = (r: unknown): unknown => {
    if (!isObj(r)) return r;
    const out: Doc = {};
    for (const [k, val] of Object.entries(r)) {
      if (k.startsWith('$')) { out[k.slice(1)] = val; continue; }
      const long = REC_LONG[k];
      if (!long) { out[k] = val; continue; }
      if (long === 'revision' && typeof val === 'string') out[long] = rev(val);
      else if (long === 'pos' && typeof val === 'string') {
        const [k, c, r] = val.split(':');
        out[long] = { k, c: c.split(',').map(x => parseInt(x, 36)), r: rev(r) };
      }
      else if (long === 'acquiredAt' && typeof val === 'number') out[long] = new Date(val).toISOString();
      else if (long === 'location' && (typeof val === 'string' || typeof val === 'number')) {
        const text = String(str(val));
        out[long] = text === 'b' ? { kind: 'bag' }
          : text.startsWith('e:') ? { kind: 'equipped', slotId: text.slice(2) }
            : { kind: 'explorer', explorerId: text.slice(2) };
      } else if (long === 'tags' && Array.isArray(val)) out[long] = val.map(str);
      else if (STAT_MAPS.has(long)) out[long] = unStats(val);
      else if (INTERNED.has(long)) {
        out[long] = typeof val === 'string' && val.length <= 2 && ENUMS[long] ? ENUMS[long][parseInt(val, 36)] : str(val);
      }
      else out[long] = val;
    }
    return out;
  };
  const unTomb = (t: unknown): unknown => {
    if (typeof t !== 'string') return t;
    const parts = t.split(' ');
    return { id: parts.slice(4).join(' '), revision: rev(parts.slice(0, 3).join(' ')), deletedAt: parseInt(parts[3], 36) };
  };
  const unOp = (o: unknown): unknown => {
    if (typeof o !== 'string') return o;
    const parts = o.split('|');
    const head = parts[0];
    return {
      id: parts.slice(5).join('|'), stackKey: parts[4], kind: head[0] === '+' ? 'grant' : 'consume', quantity: Number(head.slice(1)),
      hlc: parseInt(parts[1], 36), deviceId: dev(parts[2]), sequence: parseInt(parts[3], 36),
    };
  };
  const unFold = (f: unknown): unknown => {
    if (!isObj(f) || !('h' in f)) return f;
    const h = typeof f['h'] === 'string' ? f['h'] : '';
    const ids: string[] = [];
    for (let i = 0; i + HASH_WIDTH <= h.length; i += HASH_WIDTH) ids.push(b36(cellHash(h.slice(i, i + HASH_WIDTH))));
    return { deviceId: f['d'], upToHlc: f['u'], net: f['n'], ids };
  };
  const out: Doc = { version: 2, records: (p['R'] as unknown[]).map(unRecord) };
  if (Array.isArray(p['T'])) out['tombstones'] = (p['T'] as unknown[]).map(unTomb);
  if (Array.isArray(p['O'])) out['stackOps'] = (p['O'] as unknown[]).map(unOp);
  if (Array.isArray(p['F'])) out['stackFolds'] = (p['F'] as unknown[]).map(unFold);
  for (const [k, val] of Object.entries(p)) {
    if (k === 'version' || PACKED_TOP.includes(k)) continue;
    out[k] = val;
  }
  return out;
}

// ── The inventory ledger (inventory-ops.ts, raw) ──────────────────────────────────────────────────────────────────
interface Revision { hlc: number; deviceId: string; sequence: number }
const cmpRev = (a: Revision, b: Revision) => (a.hlc !== b.hlc ? a.hlc - b.hlc : a.deviceId !== b.deviceId ? (a.deviceId < b.deviceId ? -1 : 1) : a.sequence - b.sequence);
const revOf = (raw: unknown): Revision => (isObj(raw) ? { hlc: num(raw['hlc']), deviceId: String(raw['deviceId'] ?? ''), sequence: num(raw['sequence']) } : { hlc: 0, deviceId: '', sequence: 0 });

/** Saves read packed (format 3): written back packed, so the server never moves a save between formats. */
const READ_PACKED = new WeakSet<Doc>();
/** A save's inventory, checked current; throws a plain refusal otherwise. Either stored format; always the v2 ledger. */
export function readInventory(doc: Doc | null, who: string): Doc {
  const stored = unwrap(doc);
  const packed = isPackedInventory(stored);
  const v = packed ? unpackInventory(stored) as Doc : stored;
  if (!v || v['version'] !== 2 || !Array.isArray(v['records'])) refuse(409, 'no-save', `${who} has no saved satchel yet. Open the game signed in first.`);
  if (num(v!['era']) !== INVENTORY_ERA) refuse(409, 'stale-save', `${who}'s save is from an older build. Reload the game, then try again.`);
  const out = clone(v!);
  if (packed) READ_PACKED.add(out);
  return out;
}
/** The document body for an inventory `readInventory` returned: in the format it was read in. */
export function inventoryEnvelope(inv: Doc, now: number): Doc {
  return envelope(READ_PACKED.has(inv) ? packInventory(inv) : inv, now);
}
function liveRecord(inv: Doc, id: string): Doc | null {
  const rec = (inv['records'] as Doc[]).find(r => isObj(r) && r['id'] === id) ?? null;
  if (!rec) return null;
  const tomb = (Array.isArray(inv['tombstones']) ? inv['tombstones'] as Doc[] : []).find(t => isObj(t) && t['id'] === id);
  if (tomb && cmpRev(revOf(tomb['revision']), revOf(rec['revision'])) >= 0) return null;
  return rec;
}
/** Why an item cannot change hands, or null. Only loose gear in the satchel: never worn, lent, vaulted, bound or a quest piece. */
export function untradeable(rec: Doc): string | null {
  if (rec['kind'] !== 'instance' || rec['source'] !== 'inventory') return 'That cannot be traded.';
  if (!isObj(rec['location']) || (rec['location'] as Doc)['kind'] !== 'bag') return 'Take it out of the Vault and off your Keeper first.';
  if (rec['soulbound'] === true) return 'Soulbound items stay with their Keeper.';
  if (rec['category'] === 'quest') return 'Quest items stay with their Keeper.';
  if (String(rec['id']).startsWith('starter-')) return 'Every Keeper keeps their worn tools.';
  return null;
}
/** Take a held item out of a save, merge-proof (see the header). Returns the record as it was. */
export function takeItem(inv: Doc, offered: OfferItem, who: string, now: number): Doc {
  const rec = liveRecord(inv, offered.id);
  if (!rec) refuse(409, 'item-gone', `${who} no longer holds ${offered.name}.`);
  const why = untradeable(rec!);
  if (why) refuse(409, 'untradeable', why);
  if (!sameItem(rec!, offered)) refuse(409, 'item-changed', `${offered.name} changed since it was offered.`);
  inv['records'] = (inv['records'] as Doc[]).filter(r => r['id'] !== offered.id);
  const tombs = (Array.isArray(inv['tombstones']) ? inv['tombstones'] as Doc[] : []).filter(t => t['id'] !== offered.id);
  tombs.push({ id: offered.id, revision: { hlc: SERVER_TOMB_HLC, deviceId: TRADE_DEVICE, sequence: 1 }, deletedAt: now });
  inv['tombstones'] = tombs;
  return rec!;
}
// ── Stacks (2026-10-27): inventory-ops stackQuantity / grantStack, raw ────────────────────────────────────────────
/** inventory-ops.ts opIdHash (pinned by trade-merge.spec): what a fold keeps of each op id it folded. */
export function opIdHash(id: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const stackOpsOf = (inv: Doc): Doc[] => (Array.isArray(inv['stackOps']) ? (inv['stackOps'] as Doc[]).filter(isObj) : []);
const foldsOf = (inv: Doc): Doc[] => (Array.isArray(inv['stackFolds']) ? (inv['stackFolds'] as Doc[]).filter(isObj) : []);
/** inventory-ops stackQuantity: every device's folded net plus the live ops no fold already counts, clamped at zero. */
export function stackHeld(inv: Doc, stackKey: string): number {
  const folds = foldsOf(inv);
  const hashes = new Set(folds.flatMap(f => (Array.isArray(f['ids']) ? f['ids'] as string[] : [])));
  let qty = 0;
  for (const f of folds) qty += isObj(f['net']) ? num((f['net'] as Doc)[stackKey]) : 0;
  const seen = new Set<string>();
  for (const op of stackOpsOf(inv)) {
    const id = String(op['id']);
    if (op['stackKey'] !== stackKey || seen.has(id)) continue;
    seen.add(id);
    const own = folds.find(f => f['deviceId'] === op['deviceId']);
    if ((own && num(op['hlc']) <= num(own['upToHlc'])) || (folds.length && hashes.has(opIdHash(id)))) continue;
    qty += op['kind'] === 'grant' ? num(op['quantity']) : -num(op['quantity']);
  }
  return Math.max(0, qty);
}
/** True when an op with this id already landed on this save (live or folded): a retried swap never moves twice. */
function knowsOp(inv: Doc, id: string): boolean {
  if (stackOpsOf(inv).some(op => op['id'] === id)) return true;
  return foldsOf(inv).some(f => Array.isArray(f['ids']) && (f['ids'] as string[]).includes(opIdHash(id)));
}
function pushStackOp(inv: Doc, id: string, stackKey: string, kind: 'grant' | 'consume', quantity: number, now: number): void {
  if (knowsOp(inv, id)) return;
  const ops = stackOpsOf(inv);
  const hlc = Math.max(now, num(inv['hlc']) + 1);
  const sequence = Math.max(0, ...ops.filter(o => o['deviceId'] === TRADE_DEVICE).map(o => num(o['sequence']))) + 1;
  inv['stackOps'] = [...ops, { id, stackKey, kind, quantity, hlc, deviceId: TRADE_DEVICE, sequence }];
  inv['hlc'] = hlc;
}
/** Why a stack cannot change hands, or null: quest finds stay; the satchel's own key only (never a Vault key). */
export function untradeableStack(stackKey: string): string | null {
  if (!STACK_KEY.test(stackKey)) return 'That cannot be traded.';
  if (QUEST_STACK_KEYS.has(stackKey)) return 'Quest items stay with their Keeper.';
  return null;
}
/** Take `offered.qty` of a satchel stack out of a save: one consume op (`opId`), refused when it is no longer held. */
export function takeStack(inv: Doc, offered: OfferItem, who: string, opId: string, now: number): void {
  const sk = offered.sk ?? '', qty = offered.qty ?? 0;
  const why = untradeableStack(sk);
  if (why) refuse(409, 'untradeable', why);
  if (knowsOp(inv, opId)) return;
  if (stackHeld(inv, sk) < qty) refuse(409, 'item-gone', `${who} no longer holds ${qty} ${offered.name}.`);
  pushStackOp(inv, opId, sk, 'consume', qty, now);
}
/** Put `qty` of a stack into a save: one grant op (`opId`), and the stack's record if it never held that kind. */
export function giveStack(inv: Doc, stackKey: string, qty: number, opId: string, now: number): void {
  const records = inv['records'] as Doc[];
  const live = records.some(r => isObj(r) && r['kind'] === 'stack' && r['stackKey'] === stackKey && r['source'] === 'inventory');
  if (!live) {
    const hlc = Math.max(now, num(inv['hlc']) + 1);
    inv['records'] = [...records, {
      id: `stack:${stackKey}`, definitionId: stackKey, kind: 'stack', category: 'materials', tags: ['material', stackKey], soulbound: false,
      acquiredAt: new Date(now).toISOString(), revision: { hlc, deviceId: TRADE_DEVICE, sequence: 1 }, source: 'inventory', stackKey, location: { kind: 'bag' },
    }];
    inv['hlc'] = hlc;
  }
  pushStackOp(inv, opId, stackKey, 'grant', qty, now);
}

/** Put an item into a save as a fresh record under `newId`, in the satchel. */
export function giveItem(inv: Doc, rec: Doc, newId: string, now: number): void {
  const instances = (inv['records'] as Doc[]).filter(r => r['kind'] === 'instance').length;
  if (instances >= INSTANCE_RECORD_BUDGET) refuse(409, 'full', 'That satchel and Vault hold all they can.');
  const hlc = Math.max(now, num(inv['hlc']) + 1);
  // A fresh place in the new satchel: the giver's cell means nothing there (the receiving client places it, first fit).
  const { pos: _pos, ...rest } = clone(rec);
  void _pos;
  const next: Doc = { ...rest, id: newId, location: { kind: 'bag' }, acquiredAt: new Date(now).toISOString(), revision: { hlc, deviceId: TRADE_DEVICE, sequence: 1 } };
  inv['records'] = [...(inv['records'] as Doc[]).filter(r => r['id'] !== newId), next];
  inv['hlc'] = hlc;
}
const bumpServerSeq = (inv: Doc) => { inv['serverSeq'] = num(inv['serverSeq']) + 1; };

// ── The economy ledger (economy-ops.ts, raw; Gold only) ───────────────────────────────────────────────────────────
interface Op { id: string; deviceId: string; seq: number; kind: string; amount?: number; itemId?: string; hlc: number; wall: number }
const opsOf = (l: Doc): Op[] => (Array.isArray(l['ops']) ? (l['ops'] as Op[]).filter(o => isObj(o) && typeof o.id === 'string') : []);
const appliedOf = (l: Doc | null): Record<string, number> => (l && isObj(l['applied']) ? l['applied'] as Record<string, number> : {});
const sortOps = (ops: Op[]) => [...ops].sort((a, b) => a.hlc - b.hlc || (a.deviceId !== b.deviceId ? (a.deviceId < b.deviceId ? -1 : 1) : a.seq - b.seq) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
/**
 * The Gold every device will compute by replaying this ledger (economy-ops applyOps, Gold only): from the origin
 * (or, with no log at all, the snapshot itself — economy-ops asImport), every op above its device's watermark in
 * order, a debit skipped when it cannot be afforded.
 */
export function replayGold(l: Doc): number {
  const ops = opsOf(l);
  const origin = isObj(l['origin']) ? l['origin'] as Doc : null;
  const applied = appliedOf(origin ?? l);
  if (!ops.length) return num((origin ?? l)['gold']);
  const base = origin ?? l;
  let gold = num(base['gold']);
  const cosmetics = new Set(Array.isArray(base['cosmetics']) ? base['cosmetics'] as string[] : []);
  for (const op of sortOps(ops)) {
    if (op.seq <= (applied[op.deviceId] ?? 0)) continue;
    const amount = num(op.amount);
    switch (op.kind) {
      case 'credit-gold': case 'receive-gold': if (amount > 0) gold += amount; break;
      case 'spend-gold': case 'buy-upgrade': if (gold >= amount) gold -= amount; break;
      case 'buy-cosmetic': {
        const id = op.itemId ?? '';
        if (id && cosmetics.has(id)) break;
        if (amount > 0 && gold >= amount) { gold -= amount; if (id) cosmetics.add(id); }
        break;
      }
      case 'prestige': gold = 0; break;
      default: break;
    }
  }
  return gold;
}
/** A save's ledger, checked current; throws a plain refusal otherwise. */
export function readEconomy(doc: Doc | null, who: string): Doc {
  const v = unwrap(doc);
  if (!v) refuse(409, 'no-save', `${who} has no saved purse yet. Open the game signed in first.`);
  if (num(v!['version']) !== ECONOMY_VERSION || num(v!['goldEra']) !== GOLD_ERA) refuse(409, 'stale-save', `${who}'s save is from an older build. Reload the game, then try again.`);
  return clone(v!);
}
/** The Gold this save can hand over: the purse it shows, and never more than a replay can pay. */
export function spendableGold(l: Doc): number { return Math.min(num(l['gold']), replayGold(l)); }
/** Append a server op to a ledger, keeping the snapshot in step with the op (and freezing an origin first, as a device does). */
export function moveGold(l: Doc, kind: 'spend-gold' | 'receive-gold' | 'credit-gold', amount: number, now: number, who: string): Op {
  if (!(amount > 0)) refuse(400, 'bad-terms', 'Invalid Gold.');
  if (kind === 'spend-gold' && spendableGold(l) < amount) refuse(409, 'gold', `${who} does not hold that much Gold.`);
  const ops = opsOf(l);
  if (!isObj(l['origin'])) {
    // The first op on a ledger freezes its origin (economy.service recordOp): without it, the next merge would read
    // the already-moved snapshot as the origin and replay this op on top of it — twice the move.
    const { ops: _o, origin: _g, ...rest } = l;
    l['origin'] = { ...clone(rest), ops: [], origin: null };
  }
  const origin = l['origin'] as Doc;
  const seq = Math.max(0, ...ops.filter(o => o.deviceId === TRADE_DEVICE).map(o => o.seq), num(appliedOf(l)[TRADE_DEVICE]), num(appliedOf(origin)[TRADE_DEVICE])) + 1;
  const hlc = Math.max(now, num(l['hlc']) + 1);
  const op: Op = { id: `${TRADE_DEVICE}:${seq}`, deviceId: TRADE_DEVICE, seq, kind, amount, hlc, wall: now };
  l['ops'] = [...ops, op];
  l['hlc'] = hlc;
  l['gold'] = kind === 'spend-gold' ? num(l['gold']) - amount : num(l['gold']) + amount;
  // Protocol 10 (the room's hunt Gold, scripts/social-world.mjs): earned Gold counts toward the run and the all-time
  // totals, as economy-ops applyOp's credit-gold does on every device (a trade's receive-gold never does).
  if (kind === 'credit-gold') { l['runGoldEarned'] = num(l['runGoldEarned']) + amount; l['totalGoldEarned'] = num(l['totalGoldEarned']) + amount; }
  return op;
}

// ── Trades ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** What the Hearth writes when a trade opens (scripts/social-server.mjs): the two accounts, their Keepers, the clock. */
export interface TradeParty { uid: string; player: string; name: string }
export interface TradeDoc {
  a: TradeParty; b: TradeParty; status: 'open' | 'confirming' | 'done' | 'void'; openedAt: number; expiresAt: number;
  confirms?: Partial<Record<'a' | 'b', { key: string; character: string; at: number }>>;
  why?: string; terms?: Terms; doneAt?: number;
}
export interface ExecuteBody { trade: string; character: string; terms: unknown }
export type ExecuteResult = { status: 'waiting' } | { status: 'done'; received: { items: string[]; gold: number } } | { status: 'void'; why: string };

/** What each side ends up with: the new ids of the items it received (so its client can say so). */
const receivedIds = (tradeId: string, from: Offer) => from.items.map(i => `t${hashId(`${tradeId}:${i.id}`)}`);

/**
 * One confirmation. The first records the caller's terms and waits; the second, if its terms are the same, swaps
 * everything in the same transaction. Idempotent: after `done` or `void` every call reports that outcome again.
 */
export async function executeTrade(db: Db, uid: string, body: unknown, now: number): Promise<ExecuteResult> {
  if (!isObj(body)) refuse(400, 'bad-request', 'Invalid request.');
  const b = body as Doc;
  const tradeId = typeof b['trade'] === 'string' && ID.test(b['trade']) ? b['trade'] : refuse(400, 'bad-request', 'Invalid trade.');
  const character = typeof b['character'] === 'string' && CHARACTER.test(b['character']) ? b['character'] : refuse(400, 'bad-request', 'Invalid character.');
  const terms = parseTerms(b['terms']);
  const key = canonical(terms);
  return db.run(async tx => {
    const raw = await tx.get(tradePath(tradeId as string));
    if (!raw) refuse(404, 'no-trade', 'That trade is not open.');
    const trade = clone(raw) as unknown as TradeDoc;
    const side: 'a' | 'b' | null = trade.a?.uid === uid ? 'a' : trade.b?.uid === uid ? 'b' : null;
    if (!side) refuse(403, 'not-yours', 'That trade is not yours.');
    const me = side!, other: 'a' | 'b' = me === 'a' ? 'b' : 'a';
    const mine = trade.confirms?.[me];
    if (trade.status === 'done') {
      // A retry, or the first confirmer asking how it went: what this side received.
      return { status: 'done', received: { items: receivedIds(tradeId as string, trade.terms![other]), gold: trade.terms![other].gold } };
    }
    if (trade.status === 'void') return { status: 'void', why: trade.why ?? 'The trade was called off.' };
    const voidIt = (why: string): ExecuteResult => {
      tx.set(tradePath(tradeId as string), { ...trade, status: 'void', why, voidAt: now } as unknown as Doc);
      return { status: 'void', why };
    };
    if (trade.a.uid === trade.b.uid) return voidIt('A Keeper cannot trade with their own account.');
    if (now > num(trade.expiresAt)) return voidIt('The trade ran out of time.');
    if (mine && mine.key !== key) return voidIt('The offers changed after you confirmed.');
    const theirs = trade.confirms?.[other];
    if (theirs && theirs.key !== key) return voidIt('The two windows did not show the same trade.');
    const confirms = { ...(trade.confirms ?? {}), [me]: { key, character, at: now } };
    if (!theirs) {
      tx.set(tradePath(tradeId as string), { ...trade, status: 'confirming', confirms } as unknown as Doc);
      return { status: 'waiting' };
    }
    // Both confirmed the same terms. Read everything, then decide, then write — or void with the reason.
    const chars = { [me]: character, [other]: theirs.character } as Record<'a' | 'b', string>;
    return swap(tx, tradeId as string, trade, terms, chars, confirms, now, other, voidIt);
  });
}

/**
 * The swap itself, inside the caller's transaction (every read before any write): both inventories (and both ledgers
 * when Gold moves) read, every item re-checked, everything moved, the trade stamped `done` with its terms, the audit
 * written. A 409 refusal voids the trade with the reason instead. `side` names whose view `received` is told from.
 */
async function swap(
  tx: Tx, tradeId: string, trade: TradeDoc, terms: Terms, chars: Record<'a' | 'b', string>,
  confirms: TradeDoc['confirms'], now: number, other: 'a' | 'b', voidIt: (why: string) => ExecuteResult, extra: Doc = {},
): Promise<ExecuteResult> {
  const nameOf = (s: 'a' | 'b') => trade[s].name || 'Keeper';
  const movesGold = terms.a.gold > 0 || terms.b.gold > 0;
  const [invA, invB, ecoA, ecoB] = [
    await tx.get(inventoryPath(trade.a.uid, chars.a)), await tx.get(inventoryPath(trade.b.uid, chars.b)),
    movesGold ? await tx.get(economyPath(trade.a.uid, chars.a)) : null, movesGold ? await tx.get(economyPath(trade.b.uid, chars.b)) : null,
  ];
  try {
    const inv = { a: readInventory(invA, nameOf('a')), b: readInventory(invB, nameOf('b')) };
    const eco = movesGold ? { a: readEconomy(ecoA, nameOf('a')), b: readEconomy(ecoB, nameOf('b')) } : null;
    // An instance moves as its record; a stack as one consume op on the giver and one grant op (the received id) on the taker.
    const take = (s: 'a' | 'b') => terms[s].items.map(i => (isStackOffer(i)
      ? (takeStack(inv[s], i, nameOf(s), `x${hashId(`${tradeId}:${s}:${i.id}`)}`, now), null)
      : takeItem(inv[s], i, nameOf(s), now)));
    const taken = { a: take('a'), b: take('b') };
    const give = (from: 'a' | 'b', to: 'a' | 'b') => taken[from].forEach((rec, i) => {
      const o = terms[from].items[i], newId = `t${hashId(`${tradeId}:${o.id}`)}`;
      if (rec) giveItem(inv[to], rec, newId, now); else giveStack(inv[to], o.sk!, o.qty!, newId, now);
    });
    give('a', 'b'); give('b', 'a');
    if (eco) {
      // Each must hold what it offers; only the difference moves (one op a side, never a debit that cannot land).
      if (spendableGold(eco.a) < terms.a.gold) refuse(409, 'gold', `${nameOf('a')} does not hold that much Gold.`);
      if (spendableGold(eco.b) < terms.b.gold) refuse(409, 'gold', `${nameOf('b')} does not hold that much Gold.`);
      const net = terms.a.gold - terms.b.gold;
      if (net > 0) { moveGold(eco.a, 'spend-gold', net, now, nameOf('a')); moveGold(eco.b, 'receive-gold', net, now, nameOf('b')); }
      if (net < 0) { moveGold(eco.b, 'spend-gold', -net, now, nameOf('b')); moveGold(eco.a, 'receive-gold', -net, now, nameOf('a')); }
    }
    if (terms.a.items.length + terms.b.items.length > 0) {
      bumpServerSeq(inv.a); bumpServerSeq(inv.b);
      tx.set(inventoryPath(trade.a.uid, chars.a), inventoryEnvelope(inv.a, now));
      tx.set(inventoryPath(trade.b.uid, chars.b), inventoryEnvelope(inv.b, now));
    }
    if (eco && terms.a.gold !== terms.b.gold) {
      tx.set(economyPath(trade.a.uid, chars.a), envelope(eco.a, now));
      tx.set(economyPath(trade.b.uid, chars.b), envelope(eco.b, now));
    }
    tx.set(tradePath(tradeId), { ...trade, ...extra, status: 'done', confirms, terms, doneAt: now } as unknown as Doc);
    tx.set(auditPath(`trade-${tradeId}`), {
      kind: 'trade', at: now, trade: tradeId, ...extra,
      a: { uid: trade.a.uid, character: chars.a, name: nameOf('a'), gave: terms.a.items.map(i => ({ id: i.id, name: i.name, rarity: i.rarity, ...(i.qty ? { qty: i.qty } : {}) })), gold: terms.a.gold },
      b: { uid: trade.b.uid, character: chars.b, name: nameOf('b'), gave: terms.b.items.map(i => ({ id: i.id, name: i.name, rarity: i.rarity, ...(i.qty ? { qty: i.qty } : {}) })), gold: terms.b.gold },
    });
    return { status: 'done', received: { items: receivedIds(tradeId, terms[other]), gold: terms[other].gold } };
  } catch (e) {
    if (e instanceof TradeError && e.status === 409) return voidIt(e.message);
    throw e;
  }
}

// ── Trades settled by the room (Hearth protocol 8; docs/design/online.md §4d M2) ───────────────────────────────────
/**
 * The room holds both offers and both consents (each Keeper's Confirm reached it over its verified session), so it
 * settles the trade itself, as ONE transaction run by its service account: the same reads, checks and writes as the
 * second `execute` above (`swap`), with both sides' characters named by the room. The `trades/{id}` binding it wrote at
 * open is re-read inside the transaction and must name the same two accounts; a trade already `done` answers `done`
 * again (the room retrying after a lost answer), one `void` stays void. The commit is the source of truth: until it
 * lands nothing has moved, and once it lands everything has.
 */
export interface SettleBody { trade: string; a: { uid: string; character: string }; b: { uid: string; character: string }; terms: unknown }
export async function settleTrade(db: Db, body: SettleBody, now: number): Promise<{ status: 'done'; received: { a: { items: string[]; gold: number }; b: { items: string[]; gold: number } } } | { status: 'void'; why: string }> {
  const tradeId = typeof body?.trade === 'string' && ID.test(body.trade) ? body.trade : refuse(400, 'bad-request', 'Invalid trade.');
  const chars = { a: body?.a?.character, b: body?.b?.character };
  if (typeof chars.a !== 'string' || !CHARACTER.test(chars.a) || typeof chars.b !== 'string' || !CHARACTER.test(chars.b)) refuse(400, 'bad-request', 'Invalid character.');
  const terms = parseTerms(body.terms);
  const key = canonical(terms);
  const both = (t: Terms) => ({ a: { items: receivedIds(tradeId as string, t.b), gold: t.b.gold }, b: { items: receivedIds(tradeId as string, t.a), gold: t.a.gold } });
  return db.run(async tx => {
    const raw = await tx.get(tradePath(tradeId as string));
    if (!raw) refuse(404, 'no-trade', 'That trade is not open.');
    const trade = clone(raw) as unknown as TradeDoc;
    if (trade.a?.uid !== body.a.uid || trade.b?.uid !== body.b.uid) refuse(403, 'not-yours', 'That trade is not theirs.');
    if (trade.status === 'done') return { status: 'done' as const, received: both(trade.terms!) };
    if (trade.status === 'void') return { status: 'void' as const, why: trade.why ?? 'The trade was called off.' };
    const voidIt = (why: string): ExecuteResult => {
      tx.set(tradePath(tradeId as string), { ...trade, status: 'void', why, voidAt: now, room: true } as unknown as Doc);
      return { status: 'void', why };
    };
    let out: ExecuteResult;
    if (trade.a.uid === trade.b.uid) out = voidIt('A Keeper cannot trade with their own account.');
    else if (now > num(trade.expiresAt)) out = voidIt('The trade ran out of time.');
    else {
      const confirms = { a: { key, character: chars.a as string, at: now }, b: { key, character: chars.b as string, at: now } };
      out = await swap(tx, tradeId as string, trade, terms, chars as Record<'a' | 'b', string>, confirms, now, 'b', voidIt, { room: true });
    }
    return out.status === 'done' ? { status: 'done' as const, received: both(terms) } : { status: 'void' as const, why: out.status === 'void' ? out.why : 'The trade was called off.' };
  });
}
/**
 * A trade the room was settling when it stopped (a crash, a redeploy): its Keepers ask how it ended. Done stays done;
 * anything still open is voided in a transaction — so a commit still in flight from the old room and this answer can
 * never both win (Firestore serialises them on the trade document).
 */
export async function closeTrade(db: Db, tradeId: string, uid: string, now: number): Promise<{ status: 'done' | 'void'; why?: string; terms?: Terms; side?: 'a' | 'b' }> {
  if (typeof tradeId !== 'string' || !ID.test(tradeId)) refuse(400, 'bad-request', 'Invalid trade.');
  return db.run(async tx => {
    const raw = await tx.get(tradePath(tradeId));
    if (!raw) return { status: 'void' as const, why: 'That trade is not open.' };
    const trade = raw as unknown as TradeDoc;
    const side = trade.a?.uid === uid ? 'a' as const : trade.b?.uid === uid ? 'b' as const : null;
    if (!side) refuse(403, 'not-yours', 'That trade is not yours.');
    if (trade.status === 'done') return { status: 'done' as const, terms: trade.terms, side: side! };
    if (trade.status === 'void') return { status: 'void' as const, why: trade.why ?? 'The trade was called off.', side: side! };
    const why = 'The trade was interrupted. Nothing moved.';
    tx.set(tradePath(tradeId), { ...clone(raw), status: 'void', why, voidAt: now });
    return { status: 'void' as const, why, side: side! };
  });
}
/** What the side `side` of a done trade received (its new ids and Gold): the room's answer to a reconnecting Keeper. */
export function receivedBy(tradeId: string, terms: Terms, side: 'a' | 'b'): { items: string[]; gold: number } {
  const from = side === 'a' ? terms.b : terms.a;
  return { items: receivedIds(tradeId, from), gold: from.gold };
}

/** A party calls it off (the window's Cancel after it confirmed): a confirmation on record must not complete later. */
export async function cancelTrade(db: Db, uid: string, body: unknown, now: number): Promise<{ status: 'void' | 'done'; why?: string }> {
  const tradeId = isObj(body) && typeof body['trade'] === 'string' && ID.test(body['trade']) ? body['trade'] as string : refuse(400, 'bad-request', 'Invalid trade.');
  return db.run(async tx => {
    const raw = await tx.get(tradePath(tradeId as string));
    if (!raw) return { status: 'void', why: 'That trade is not open.' };
    const trade = raw as unknown as TradeDoc;
    if (trade.a?.uid !== uid && trade.b?.uid !== uid) refuse(403, 'not-yours', 'That trade is not yours.');
    if (trade.status === 'done') return { status: 'done' };
    if (trade.status === 'void') return { status: 'void', why: trade.why ?? 'The trade was called off.' };
    const who = trade.a.uid === uid ? trade.a.name : trade.b.name;
    const why = `${who || 'A Keeper'} called the trade off.`;
    tx.set(tradePath(tradeId as string), { ...clone(raw), status: 'void', why, voidAt: now });
    return { status: 'void', why };
  });
}

// ── Ground drops ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface GroundDoc {
  id: string; area: string; x: number; y: number; item: Doc; name: string; rarity: string; def: string;
  owner: { uid: string; character: string }; droppedAt: number; expiresAt: number;
}
export interface DropBody { character: string; area: string; item: unknown; x: number; y: number }
/** The id a dropped item lies under: one per (account, item), so a retried drop finds its own. */
export const groundId = (uid: string, itemId: string) => `g${hashId(`${uid}:${itemId}`)}`;
/** The id an item takes in whoever picks it up (its dropper included: the old id is tombstoned there). */
export const pickedId = (gid: string) => `p${hashId(gid)}`;

const coord = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e6 ? Math.round(v * 10) / 10 : refuse(400, 'bad-request', 'Invalid place.'));

/** Put an item from the satchel on the ground at the Keeper's feet (escrow): out of the save, into `ground-items`. */
export async function dropItem(db: Db, uid: string, body: unknown, now: number): Promise<{ status: 'dropped'; ground: GroundDoc }> {
  if (!isObj(body)) refuse(400, 'bad-request', 'Invalid request.');
  const b = body as Doc;
  const character = typeof b['character'] === 'string' && CHARACTER.test(b['character']) ? b['character'] as string : refuse(400, 'bad-request', 'Invalid character.');
  const area = typeof b['area'] === 'string' && AREA.test(b['area']) ? b['area'] as string : refuse(400, 'bad-request', 'Invalid area.');
  const offered = parseOfferItem(b['item']);
  // A stack on the shared ground is not built yet (verb-matrix T1): only a held instance is dropped here.
  if (isStackOffer(offered)) refuse(400, 'bad-request', 'Stacks are set down on your own ground for now.');
  const x = coord(b['x']) as number, y = coord(b['y']) as number;
  const gid = groundId(uid, offered.id);
  return db.run(async tx => {
    const already = await tx.get(groundItemPath(gid));
    const areaDoc = await tx.get(groundAreaPath(area));
    const rate = await tx.get(groundRatePath(uid));
    const invDoc = await tx.get(inventoryPath(uid, character));
    // A retry of a drop that landed: the same ground item, nothing written twice.
    if (already && (already['owner'] as Doc)?.['uid'] === uid) return { status: 'dropped', ground: already as unknown as GroundDoc };
    const count = num(areaDoc?.['count']);
    if (count >= GROUND_AREA_MAX) refuse(429, 'area-full', 'The ground here is covered. Pick something up first.');
    const windowStart = num(rate?.['start']);
    const inWindow = now - windowStart < GROUND_RATE_WINDOW_MS;
    const n = inWindow ? num(rate?.['n']) : 0;
    if (n >= GROUND_RATE_MAX) refuse(429, 'slow-down', 'You are dropping things too fast. Wait a moment.');
    const inv = readInventory(invDoc, 'You');
    const rec = takeItem(inv, offered, 'You', now);
    bumpServerSeq(inv);
    const ground: GroundDoc = {
      id: gid, area, x, y, item: rec, name: offered.name, rarity: offered.rarity, def: offered.def,
      owner: { uid, character }, droppedAt: now, expiresAt: now + GROUND_TTL_MS,
    };
    tx.set(inventoryPath(uid, character), inventoryEnvelope(inv, now));
    tx.set(groundItemPath(gid), ground as unknown as Doc);
    tx.set(groundAreaPath(area), { count: count + 1, updatedAt: now });
    tx.set(groundRatePath(uid), { start: inWindow ? windowStart : now, n: n + 1 });
    tx.set(auditPath(`drop-${gid}-${now}`), { kind: 'drop', at: now, ground: gid, area, uid, character, item: offered.id, name: offered.name, rarity: offered.rarity });
    return { status: 'dropped', ground };
  });
}

/** Move a ground item into a save (the picker's, or home to its dropper) and off the ground, in one transaction. */
function landGround(tx: Tx, g: GroundDoc, areaDoc: Doc | null, invDoc: Doc | null, to: { uid: string; character: string }, now: number, kind: 'pickup' | 'return'): string {
  const inv = readInventory(invDoc, kind === 'return' ? 'The dropper' : 'You');
  const newId = pickedId(g.id);
  giveItem(inv, g.item, newId, now);
  bumpServerSeq(inv);
  tx.set(inventoryPath(to.uid, to.character), inventoryEnvelope(inv, now));
  tx.delete(groundItemPath(g.id));
  tx.set(groundAreaPath(g.area), { count: Math.max(0, num(areaDoc?.['count']) - 1), updatedAt: now });
  tx.set(auditPath(`${kind}-${g.id}-${now}`), { kind, at: now, ground: g.id, area: g.area, from: g.owner, to, item: newId, name: g.name, rarity: g.rarity });
  return newId;
}

export type PickupResult = { status: 'picked'; item: string; ground: string } | { status: 'gone'; ground: string; why: string };
/** Take a ground item. Only one picker can win: the transaction reads the ground document, and the loser finds it gone. */
export async function pickupItem(db: Db, uid: string, body: unknown, now: number): Promise<PickupResult> {
  if (!isObj(body)) refuse(400, 'bad-request', 'Invalid request.');
  const b = body as Doc;
  const character = typeof b['character'] === 'string' && CHARACTER.test(b['character']) ? b['character'] as string : refuse(400, 'bad-request', 'Invalid character.');
  const gid = typeof b['ground'] === 'string' && ID.test(b['ground']) ? b['ground'] as string : refuse(400, 'bad-request', 'Invalid item.');
  return db.run(async tx => {
    const g = await tx.get(groundItemPath(gid)) as unknown as GroundDoc | null;
    if (!g) return { status: 'gone', ground: gid, why: 'Someone else picked that up.' };
    const areaDoc = await tx.get(groundAreaPath(g.area));
    const mine = g.owner.uid === uid;
    const expired = now >= num(g.expiresAt);
    // Lazy expiry: past its time it belongs to its dropper again — returned right here if somebody else reaches for it.
    if (expired && !mine) {
      const home = await tx.get(inventoryPath(g.owner.uid, g.owner.character));
      try { landGround(tx, g, areaDoc, home, g.owner, now, 'return'); } catch (e) { if (!(e instanceof TradeError)) throw e; dropLost(tx, g, areaDoc, now); }
      return { status: 'gone', ground: gid, why: 'It went home to whoever dropped it.' };
    }
    const target = { uid, character };
    const invDoc = await tx.get(inventoryPath(uid, character));
    const item = landGround(tx, g, areaDoc, invDoc, target, now, 'pickup');
    return { status: 'picked', item, ground: gid };
  });
}
/** A ground item whose dropper's save is gone (a deleted character): off the ground, logged, nowhere to go. */
function dropLost(tx: Tx, g: GroundDoc, areaDoc: Doc | null, now: number): void {
  tx.delete(groundItemPath(g.id));
  tx.set(groundAreaPath(g.area), { count: Math.max(0, num(areaDoc?.['count']) - 1), updatedAt: now });
  tx.set(auditPath(`lost-${g.id}-${now}`), { kind: 'lost', at: now, ground: g.id, area: g.area, from: g.owner, name: g.name, rarity: g.rarity });
}
/** The scheduled sweep: every ground item past its time goes home to its dropper. Returns how many moved. */
export async function returnExpired(db: Db, now: number, limit = 100): Promise<number> {
  const ids = await db.expiredGround(now, limit);
  let n = 0;
  for (const id of ids) {
    const moved = await db.run(async tx => {
      const g = await tx.get(groundItemPath(id)) as unknown as GroundDoc | null;
      if (!g || now < num(g.expiresAt)) return false;
      const areaDoc = await tx.get(groundAreaPath(g.area));
      const home = await tx.get(inventoryPath(g.owner.uid, g.owner.character));
      try { landGround(tx, g, areaDoc, home, g.owner, now, 'return'); } catch (e) { if (!(e instanceof TradeError)) throw e; dropLost(tx, g, areaDoc, now); }
      return true;
    });
    if (moved) n++;
  }
  return n;
}

// ── One door for every caller ─────────────────────────────────────────────────────────────────────────────────────
/** Route a verb: `execute`, `cancel`, `drop`, `pickup`. Returns the HTTP status and body; refusals are plain words. */
export async function handle(db: Db, verb: string, uid: string, body: unknown, now: number): Promise<{ status: number; body: unknown }> {
  if (!UID.test(uid)) return { status: 401, body: { error: 'Sign in to trade.' } };
  try {
    if (verb === 'execute') return { status: 200, body: await executeTrade(db, uid, body, now) };
    if (verb === 'cancel') return { status: 200, body: await cancelTrade(db, uid, body, now) };
    if (verb === 'drop') return { status: 200, body: await dropItem(db, uid, body, now) };
    if (verb === 'pickup') return { status: 200, body: await pickupItem(db, uid, body, now) };
    return { status: 404, body: { error: 'Not found.' } };
  } catch (e) {
    if (e instanceof TradeError) return { status: e.status, body: { error: e.message, code: e.code } };
    throw e;
  }
}

// ── An in-memory Db (the specs and the local e2e) with Firestore's optimistic concurrency ─────────────────────────
/**
 * Documents in a Map. A transaction reads freely and buffers its writes; at commit, if any document it read changed
 * since (another transaction committed in between), it runs again from the top — Firestore's server-side retry. That
 * is what the double-pickup test races against.
 */
export function memoryDb(docs: Map<string, Doc> = new Map()): Db & { docs: Map<string, Doc> } {
  const versions = new Map<string, number>();
  let clock = 0;
  return {
    docs,
    async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      for (let attempt = 0; attempt < 8; attempt++) {
        const read = new Map<string, number>();
        const writes = new Map<string, Doc | null>();
        let wrote = false;
        const tx: Tx = {
          async get(path) {
            if (wrote) throw new Error('Firestore transactions read before they write.');
            read.set(path, versions.get(path) ?? 0);
            await Promise.resolve();
            const d = docs.get(path);
            return d ? clone(d) : null;
          },
          set(path, data) { wrote = true; writes.set(path, clone(data)); },
          delete(path) { wrote = true; writes.set(path, null); },
        };
        const out = await fn(tx);
        if ([...read].some(([p, v]) => (versions.get(p) ?? 0) !== v)) continue;
        for (const [p, d] of writes) { if (d) docs.set(p, d); else docs.delete(p); versions.set(p, ++clock); }
        return out;
      }
      throw new Error('Too much contention.');
    },
    async expiredGround(now, limit) {
      const out: string[] = [];
      for (const [p, d] of docs) if (p.startsWith('ground-items/') && num(d['expiresAt']) <= now) out.push(p.slice('ground-items/'.length));
      return out.slice(0, limit);
    },
  };
}
