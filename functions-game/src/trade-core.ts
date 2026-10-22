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
}
export interface Offer { items: OfferItem[]; gold: number }
export interface Terms { a: Offer; b: Offer }

const STAT_KEY = /^[A-Za-z]{1,32}$/;
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
  for (const k of Object.keys(r)) if (!['id', 'def', 'name', 'type', 'rarity', 'stats', 'roll', 'ilvl', 'up', 'sockets', 'reforged'].includes(k)) refuse(400, 'bad-terms', 'Invalid item.');
  if (typeof r['id'] !== 'string' || !ID.test(r['id'])) refuse(400, 'bad-terms', 'Invalid item.');
  const out: OfferItem = {
    id: r['id'] as string, def: text(r['def'], 96), name: text(r['name'], 80), type: text(r['type'], 16), rarity: text(r['rarity'], 24),
    stats: numMap(r['stats'], 'stats', -1e7, 1e7),
  };
  if (r['roll'] !== undefined && r['roll'] !== null) out.roll = numMap(r['roll'], 'roll', 0, 1);
  const ilvl = optInt(r['ilvl'], 1, 99); if (ilvl !== undefined) out.ilvl = ilvl;
  const up = optInt(r['up'], 0, 100); if (up !== undefined) out.up = up;
  const reforged = optInt(r['reforged'], 0, 10000); if (reforged !== undefined) out.reforged = reforged;
  if (r['sockets'] !== undefined && r['sockets'] !== null) {
    const s = r['sockets'];
    if (!Array.isArray(s) || s.length > 8 || s.some(x => x !== null && (typeof x !== 'string' || !ID.test(x)))) refuse(400, 'bad-terms', 'Invalid item.');
    out.sockets = (s as (string | null)[]).map(x => x ?? null);
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
  const ids = [...t.a.items, ...t.b.items].map(i => i.id);
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
  return out;
}
/** The record still is the item that was offered: same id, same definition, same roll, same improvements. */
export function sameItem(record: Doc, offered: OfferItem): boolean {
  return canonical(offerOf(record)) === canonical({ ...offered, ...(offered.up === 0 ? { up: undefined } : {}), ...(offered.reforged === 0 ? { reforged: undefined } : {}) });
}

// ── The inventory ledger (inventory-ops.ts, raw) ──────────────────────────────────────────────────────────────────
interface Revision { hlc: number; deviceId: string; sequence: number }
const cmpRev = (a: Revision, b: Revision) => (a.hlc !== b.hlc ? a.hlc - b.hlc : a.deviceId !== b.deviceId ? (a.deviceId < b.deviceId ? -1 : 1) : a.sequence - b.sequence);
const revOf = (raw: unknown): Revision => (isObj(raw) ? { hlc: num(raw['hlc']), deviceId: String(raw['deviceId'] ?? ''), sequence: num(raw['sequence']) } : { hlc: 0, deviceId: '', sequence: 0 });

/** A save's inventory, checked current; throws a plain refusal otherwise. */
export function readInventory(doc: Doc | null, who: string): Doc {
  const v = unwrap(doc);
  if (!v || v['version'] !== 2 || !Array.isArray(v['records'])) refuse(409, 'no-save', `${who} has no saved satchel yet. Open the game signed in first.`);
  if (num(v!['era']) !== INVENTORY_ERA) refuse(409, 'stale-save', `${who}'s save is from an older build. Reload the game, then try again.`);
  return clone(v!);
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
/** Put an item into a save as a fresh record under `newId`, in the satchel. */
export function giveItem(inv: Doc, rec: Doc, newId: string, now: number): void {
  const instances = (inv['records'] as Doc[]).filter(r => r['kind'] === 'instance').length;
  if (instances >= INSTANCE_RECORD_BUDGET) refuse(409, 'full', 'That satchel and Vault hold all they can.');
  const hlc = Math.max(now, num(inv['hlc']) + 1);
  const next: Doc = { ...clone(rec), id: newId, location: { kind: 'bag' }, acquiredAt: new Date(now).toISOString(), revision: { hlc, deviceId: TRADE_DEVICE, sequence: 1 } };
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
export function moveGold(l: Doc, kind: 'spend-gold' | 'receive-gold', amount: number, now: number, who: string): Op {
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
    const nameOf = (s: 'a' | 'b') => trade[s].name || 'Keeper';
    const movesGold = terms.a.gold > 0 || terms.b.gold > 0;
    const [invA, invB, ecoA, ecoB] = [
      await tx.get(inventoryPath(trade.a.uid, chars.a)), await tx.get(inventoryPath(trade.b.uid, chars.b)),
      movesGold ? await tx.get(economyPath(trade.a.uid, chars.a)) : null, movesGold ? await tx.get(economyPath(trade.b.uid, chars.b)) : null,
    ];
    try {
      const inv = { a: readInventory(invA, nameOf('a')), b: readInventory(invB, nameOf('b')) };
      const eco = movesGold ? { a: readEconomy(ecoA, nameOf('a')), b: readEconomy(ecoB, nameOf('b')) } : null;
      const taken = { a: terms.a.items.map(i => takeItem(inv.a, i, nameOf('a'), now)), b: terms.b.items.map(i => takeItem(inv.b, i, nameOf('b'), now)) };
      taken.a.forEach((rec, i) => giveItem(inv.b, rec, `t${hashId(`${tradeId}:${terms.a.items[i].id}`)}`, now));
      taken.b.forEach((rec, i) => giveItem(inv.a, rec, `t${hashId(`${tradeId}:${terms.b.items[i].id}`)}`, now));
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
        tx.set(inventoryPath(trade.a.uid, chars.a), envelope(inv.a, now));
        tx.set(inventoryPath(trade.b.uid, chars.b), envelope(inv.b, now));
      }
      if (eco && terms.a.gold !== terms.b.gold) {
        tx.set(economyPath(trade.a.uid, chars.a), envelope(eco.a, now));
        tx.set(economyPath(trade.b.uid, chars.b), envelope(eco.b, now));
      }
      tx.set(tradePath(tradeId as string), { ...trade, status: 'done', confirms, terms, doneAt: now } as unknown as Doc);
      tx.set(auditPath(`trade-${tradeId}`), {
        kind: 'trade', at: now, trade: tradeId,
        a: { uid: trade.a.uid, character: chars.a, name: nameOf('a'), gave: terms.a.items.map(i => ({ id: i.id, name: i.name, rarity: i.rarity })), gold: terms.a.gold },
        b: { uid: trade.b.uid, character: chars.b, name: nameOf('b'), gave: terms.b.items.map(i => ({ id: i.id, name: i.name, rarity: i.rarity })), gold: terms.b.gold },
      });
      return { status: 'done', received: { items: receivedIds(tradeId as string, terms[other]), gold: terms[other].gold } };
    } catch (e) {
      if (e instanceof TradeError && e.status === 409) return voidIt(e.message);
      throw e;
    }
  });
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
    tx.set(inventoryPath(uid, character), envelope(inv, now));
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
  tx.set(inventoryPath(to.uid, to.character), envelope(inv, now));
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
