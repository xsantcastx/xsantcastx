/**
 * save-ops.ts — the market's surgical edits to a player's cloud save. Pure.
 *
 * The save is two CRDT-ish ledgers the client merges on every sync:
 *
 *   users/{uid}/progress/inventory  { v: InventoryLedger, updatedAt }
 *   users/{uid}/economy/state       { v: EconomyLedger,   updatedAt }
 *
 * The market never rewrites either wholesale. It only does the things the
 * client's own merge already understands, so a later client merge *keeps*
 * them instead of fighting them:
 *
 *   - removing an equipment instance  -> a tombstone that out-revisions it
 *   - debiting / crediting a stack    -> an idempotent stack op (unioned by id)
 *   - minting a bought instance       -> a new record under a fresh id
 *   - debiting / crediting Gold       -> an economy op with a stable id
 *
 * The client's rules these mirror live in src/app/shared/rpg/inventory-ops.ts
 * (mergeInventoryLedgers, stackQuantity) and src/app/shared/economy/economy-ops.ts
 * (parseOp, applyOps, asImport). If those change shape, this file must follow;
 * functions/test/save-ops.test.ts pins the behaviour it relies on.
 */
import {ESCROW_TOMBSTONE_LEAD_MS, MARKET_DEVICE_ID} from "./config";
import {INVENTORY_BAG_CAP, INVENTORY_ERA, REFERENCE_GOODS} from "./reference.generated";
import type {EconomyOpLite, EscrowMark, InstanceSnapshot, StackOp} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

export class SaveError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Firestore refuses `undefined` anywhere in a document. */
export function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : stripUndefined(v))) as T;
  const out: Json = {};
  for (const [k, v] of Object.entries(value as Json)) {
    if (v !== undefined) out[k] = stripUndefined(v);
  }
  return out as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────────────────────────────────────

export interface InvLedger extends Json {
  version: 2;
  records: Json[];
  tombstones: Json[];
  stackOps: StackOp[];
  stackCheckpoints?: {stackKey: string; quantity: number; upToHlc: number}[];
  hlc: number;
  era?: number;
}

export function emptyInventory(): InvLedger {
  return {
    version: 2,
    records: [],
    tombstones: [],
    stackOps: [],
    stackCheckpoints: [],
    goldFromSales: 0,
    sold: 0,
    hlc: 0,
    legacyBackup: null,
    era: INVENTORY_ERA,
  };
}

/**
 * Read the inventory ledger out of the stored envelope.
 *
 * Refuses anything that is not the current v2 shape at the current era: the
 * client would discard a lower-era copy wholesale on its next merge, taking
 * whatever the market wrote with it.
 */
export function readInventory(docData: unknown, allowMissing: boolean): InvLedger {
  if (docData === undefined || docData === null) {
    if (allowMissing) return emptyInventory();
    throw new SaveError("save-missing", "Your cloud save has no inventory yet. Open the game while signed in, then try again.");
  }
  const v = isObj(docData) && "v" in docData ? docData["v"] : docData;
  if (!isObj(v) || v["version"] !== 2 || !Array.isArray(v["records"])) {
    throw new SaveError("save-unreadable", "Your cloud inventory is in an older format. Open the game while signed in so it can update, then try again.");
  }
  if (num(v["era"]) !== INVENTORY_ERA) {
    throw new SaveError("save-era", "Your cloud inventory is from a different season. Open the game while signed in so it can update, then try again.");
  }
  return {
    ...v,
    version: 2,
    records: v["records"].filter(isObj).map((r: Json) => ({...r})),
    tombstones: Array.isArray(v["tombstones"]) ? v["tombstones"].filter(isObj).map((t: Json) => ({...t})) : [],
    stackOps: Array.isArray(v["stackOps"]) ? v["stackOps"].filter(isObj).map((o: Json) => ({...o} as StackOp)) : [],
    stackCheckpoints: Array.isArray(v["stackCheckpoints"]) ?
      v["stackCheckpoints"].filter(isObj).map((c: Json) => ({
        stackKey: String(c["stackKey"]), quantity: num(c["quantity"]), upToHlc: num(c["upToHlc"]),
      })) :
      [],
    hlc: num(v["hlc"]),
  };
}

export function compareRevision(
  a: {hlc: number; deviceId: string; sequence: number},
  b: {hlc: number; deviceId: string; sequence: number},
): number {
  if (a.hlc !== b.hlc) return a.hlc - b.hlc;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  return a.sequence - b.sequence;
}

function revisionOf(row: Json): {hlc: number; deviceId: string; sequence: number} {
  const r = isObj(row["revision"]) ? row["revision"] : {};
  return {hlc: num(r["hlc"]), deviceId: String(r["deviceId"] ?? ""), sequence: num(r["sequence"])};
}

/** Same arithmetic as the client's `stackQuantity`, checkpoints included. */
export function stackQuantity(ledger: InvLedger, stackKey: string): number {
  const cp = (ledger.stackCheckpoints ?? []).find((c) => c.stackKey === stackKey);
  const seen = new Set<string>();
  let qty = cp?.quantity ?? 0;
  for (const op of ledger.stackOps) {
    if (op.stackKey !== stackKey || seen.has(op.id)) continue;
    if (cp && op.hlc <= cp.upToHlc) continue;
    seen.add(op.id);
    qty += op.kind === "grant" ? op.quantity : -op.quantity;
  }
  return Math.max(0, qty);
}

/**
 * An hlc strictly above everything in the ledger, ops and checkpoints included.
 *
 * Above the checkpoints matters: the client merge drops any op at or below a
 * stack's checkpoint watermark as "already folded", so an op stamped under it
 * would silently vanish on the next sync.
 */
export function nextInventoryHlc(ledger: InvLedger, now: number): number {
  let max = Math.max(ledger.hlc, now);
  for (const op of ledger.stackOps) max = Math.max(max, num(op.hlc));
  for (const cp of ledger.stackCheckpoints ?? []) max = Math.max(max, cp.upToHlc);
  for (const r of ledger.records) max = Math.max(max, revisionOf(r).hlc);
  return max + 1;
}

/** Inventory-owned rows, which is what the client's bag cap counts. */
export function bagRoom(ledger: InvLedger): number {
  return INVENTORY_BAG_CAP - ledger.records.filter((r) => r["source"] === "inventory").length;
}

/** `eq:<definitionId>:<rarity>` for an instance record. */
export function instanceItemKey(record: Json): string {
  return `eq:${String(record["definitionId"])}:${String(record["rarity"])}`;
}

/**
 * Find an instance the player may list: theirs, in the bag, tradable, live.
 * Throws a SaveError with a plain-words reason otherwise.
 */
export function findListableInstance(ledger: InvLedger, recordId: string, itemKey: string): Json {
  const record = ledger.records.find((r) => r["id"] === recordId);
  if (!record) {
    throw new SaveError("not-owned", "That item isn't in your cloud save. If you just got it, wait a few seconds for your save to sync and try again.");
  }
  if (record["kind"] !== "instance" || record["source"] !== "inventory") {
    throw new SaveError("not-tradable", "That item can't be traded.");
  }
  if (record["soulbound"] === true) throw new SaveError("soulbound", "Soulbound items can't be traded.");
  if (!isObj(record["location"]) || record["location"]["kind"] !== "bag") {
    throw new SaveError("in-use", "Unequip that item (and recall it from any expedition) before listing it.");
  }
  const key = instanceItemKey(record);
  if (key !== itemKey) throw new SaveError("wrong-item", "That item doesn't match the market you're listing it in.");
  const good = REFERENCE_GOODS[key];
  if (!good || good.kind !== "equipment") throw new SaveError("not-tradable", "That item has no market.");
  const tomb = ledger.tombstones.find((t) => t["id"] === recordId);
  if (tomb && compareRevision(revisionOf(tomb), revisionOf(record)) >= 0) {
    throw new SaveError("not-owned", "That item is no longer in your save.");
  }
  return record;
}

export function snapshotInstance(record: Json): InstanceSnapshot {
  const numMap = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (isObj(v)) for (const [k, x] of Object.entries(v)) if (typeof x === "number" && Number.isFinite(x)) out[k] = x;
    return out;
  };
  return stripUndefined({
    sourceId: String(record["id"]),
    definitionId: String(record["definitionId"]),
    name: String(record["name"] ?? ""),
    type: String(record["type"] ?? ""),
    rarity: String(record["rarity"] ?? ""),
    stats: numMap(record["stats"]),
    rollQuality: isObj(record["rollQuality"]) ? numMap(record["rollQuality"]) : undefined,
    sellValue: num(record["sellValue"]),
    lore: typeof record["lore"] === "string" ? record["lore"] : undefined,
    upgradeLevel: typeof record["upgradeLevel"] === "number" ? record["upgradeLevel"] : undefined,
    reforgeCount: typeof record["reforgeCount"] === "number" ? record["reforgeCount"] : undefined,
    sockets: Array.isArray(record["sockets"]) ?
      record["sockets"].slice(0, 8).map((s: unknown) => (typeof s === "string" && s ? s : null)) :
      undefined,
  });
}

/**
 * Take an instance out of the save into escrow.
 *
 * The record is removed and a tombstone written whose revision is a year ahead
 * of wall-clock (see ESCROW_TOMBSTONE_LEAD_MS), so a device that has not synced
 * yet and edits the item in the meantime still loses the merge.
 */
export function escrowInstance(
  ledger: InvLedger,
  record: Json,
  now: number,
): {ledger: InvLedger; mark: EscrowMark} {
  const rev = revisionOf(record);
  const revision = {hlc: Math.max(rev.hlc, now) + ESCROW_TOMBSTONE_LEAD_MS, deviceId: MARKET_DEVICE_ID, sequence: 1};
  const mark: EscrowMark = {kind: "tombstone", recordId: String(record["id"]), revision, deletedAt: now, at: now};
  return {ledger: applyTombstone(ledger, mark), mark};
}

function applyTombstone(ledger: InvLedger, mark: Extract<EscrowMark, {kind: "tombstone"}>): InvLedger {
  const tomb = {id: mark.recordId, revision: mark.revision, deletedAt: mark.deletedAt};
  const held = ledger.tombstones.find((t) => t["id"] === mark.recordId);
  const tombstones = held && compareRevision(revisionOf(held), mark.revision) >= 0 ?
    ledger.tombstones :
    [...ledger.tombstones.filter((t) => t["id"] !== mark.recordId), tomb];
  const winning = tombstones.find((t) => t["id"] === mark.recordId) as Json;
  const records = ledger.records.filter((r) =>
    r["id"] !== mark.recordId || compareRevision(revisionOf(winning), revisionOf(r)) < 0,
  );
  return {...ledger, records, tombstones};
}

/** Append a stack op unless one with the same id is already there. */
function applyStackOp(ledger: InvLedger, op: StackOp): InvLedger {
  if (ledger.stackOps.some((o) => o.id === op.id)) return ledger;
  return {...ledger, stackOps: [...ledger.stackOps, op], hlc: Math.max(ledger.hlc, op.hlc)};
}

export function stackOp(
  ledger: InvLedger,
  kind: "grant" | "consume",
  id: string,
  stackKey: string,
  quantity: number,
  sequence: number,
  now: number,
): StackOp {
  return {id, stackKey, kind, quantity, hlc: nextInventoryHlc(ledger, now), deviceId: MARKET_DEVICE_ID, sequence};
}

/** Debit a stack into escrow. Throws when the save does not hold enough. */
export function escrowStack(
  ledger: InvLedger,
  stackKey: string,
  qty: number,
  opId: string,
  sequence: number,
  now: number,
): {ledger: InvLedger; mark: EscrowMark} {
  const held = stackQuantity(ledger, stackKey);
  if (held < qty) {
    throw new SaveError("not-enough", `Your cloud save holds ${held} of that, not ${qty}. If you just gathered more, wait a few seconds for your save to sync.`);
  }
  const op = stackOp(ledger, "consume", opId, stackKey, qty, sequence, now);
  return {ledger: applyStackOp(ledger, op), mark: {kind: "stack-op", op, at: now}};
}

/** Credit a stack, creating its bag row if the player has never held it. */
export function grantStackTo(
  ledger: InvLedger,
  stackKey: string,
  qty: number,
  opId: string,
  sequence: number,
  now: number,
): {ledger: InvLedger; op: StackOp} | null {
  const existing = ledger.stackOps.find((o) => o.id === opId);
  if (existing) return {ledger, op: existing};
  const hasRow = ledger.records.some((r) => r["kind"] === "stack" && r["stackKey"] === stackKey && r["source"] === "inventory");
  if (!hasRow && bagRoom(ledger) <= 0) return null;
  const op = stackOp(ledger, "grant", opId, stackKey, qty, sequence, now);
  let records = ledger.records;
  if (!hasRow) {
    records = [...records, {
      id: `stack:${stackKey}`,
      definitionId: stackKey,
      kind: "stack",
      category: "materials",
      tags: ["material", stackKey],
      soulbound: false,
      acquiredAt: new Date(now).toISOString(),
      revision: {hlc: op.hlc, deviceId: MARKET_DEVICE_ID, sequence},
      source: "inventory",
      stackKey,
      location: {kind: "bag"},
    }];
  }
  return {ledger: applyStackOp({...ledger, records}, op), op};
}

/** Mint a bought (or returned) instance under a fresh id. Null when the bag is full. */
export function deliverInstance(
  ledger: InvLedger,
  snap: InstanceSnapshot,
  newId: string,
  sequence: number,
  now: number,
): InvLedger | null {
  if (ledger.records.some((r) => r["id"] === newId)) return ledger;
  if (ledger.tombstones.some((t) => t["id"] === newId)) return ledger;
  if (bagRoom(ledger) <= 0) return null;
  const hlc = nextInventoryHlc(ledger, now);
  const type = snap.type || "artifact";
  const category = type === "charm" ? "equipment" : type === "rune" || type === "runeword" ? "runes" : "artifacts";
  const record = stripUndefined({
    id: newId,
    definitionId: snap.definitionId,
    kind: "instance",
    category,
    tags: [type],
    rarity: snap.rarity,
    soulbound: false,
    acquiredAt: new Date(now).toISOString(),
    revision: {hlc, deviceId: MARKET_DEVICE_ID, sequence},
    source: "inventory",
    name: snap.name,
    type,
    lore: snap.lore,
    stats: {...snap.stats},
    rollQuality: snap.rollQuality ? {...snap.rollQuality} : undefined,
    sellValue: snap.sellValue,
    location: {kind: "bag"},
    upgradeLevel: snap.upgradeLevel,
    reforgeCount: snap.reforgeCount,
    sockets: snap.sockets ? [...snap.sockets] : undefined,
  });
  return {...ledger, records: [...ledger.records, record], hlc: Math.max(ledger.hlc, hlc)};
}

/**
 * Put back anything a client re-sync wrote over. Idempotent.
 *
 * - tombstone marks: re-add the tombstone, drop a resurrected record.
 * - stack-op marks: re-append the op unless it is present, or already folded
 *   into a checkpoint (an op at or below the watermark is counted there).
 */
export function reassertInventoryMarks(ledger: InvLedger, marks: readonly EscrowMark[]): InvLedger {
  let next = ledger;
  for (const mark of marks) {
    if (mark.kind === "tombstone") {
      next = applyTombstone(next, mark);
    } else if (mark.kind === "stack-op") {
      const cp = (next.stackCheckpoints ?? []).find((c) => c.stackKey === mark.op.stackKey);
      if (cp && mark.op.hlc <= cp.upToHlc) continue;
      next = applyStackOp(next, mark.op);
    }
  }
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Economy (Gold)
// ─────────────────────────────────────────────────────────────────────────────

const OP_KINDS = new Set([
  "credit-gold", "credit-essence", "spend-gold", "buy-upgrade", "buy-artifact", "buy-cosmetic",
  "buy-enchantment", "grant-runeword", "grant-cosmetic", "equip", "prestige",
]);
const AMOUNT_KINDS = new Set([
  "credit-gold", "credit-essence", "spend-gold", "buy-upgrade", "buy-artifact", "buy-cosmetic",
  "buy-enchantment", "prestige",
]);

/** An economy op as stored. Only the fields the Gold replay reads are typed. */
export interface RawOp {
  id: string;
  deviceId: string;
  seq: number;
  kind: string;
  amount?: number;
  itemId?: string;
  hlc: number;
  wall?: number;
}

/** Mirrors the client's `parseOp` gate, so the replay below counts the same ops. */
function validOp(raw: unknown): raw is RawOp {
  if (!isObj(raw)) return false;
  const deviceId = raw["deviceId"];
  const id = raw["id"];
  const kind = raw["kind"];
  const seq = raw["seq"];
  const amount = raw["amount"];
  const hlc = raw["hlc"];
  if (typeof deviceId !== "string" || !deviceId) return false;
  if (typeof id !== "string" || id !== `${deviceId}:${seq}`) return false;
  if (typeof kind !== "string" || !OP_KINDS.has(kind)) return false;
  if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 1) return false;
  if (amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)) return false;
  if (AMOUNT_KINDS.has(kind)) {
    const floor = kind === "buy-upgrade" ? 0 : 1;
    if (!(typeof amount === "number" && amount >= floor)) return false;
  }
  return typeof hlc === "number" && Number.isFinite(hlc) && hlc >= 0;
}

function compareOps(a: RawOp, b: RawOp): number {
  if (a.hlc !== b.hlc) return a.hlc - b.hlc;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  if (a.seq !== b.seq) return a.seq - b.seq;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface EconLedger extends Json {
  gold: number;
  ops: RawOp[];
  origin: Json | null;
  hlc: number;
}

export function readEconomy(docData: unknown): EconLedger {
  const v = isObj(docData) && "v" in docData ? docData["v"] : docData;
  if (!isObj(v)) {
    throw new SaveError("save-missing", "Your cloud save has no Gold ledger yet. Open the game while signed in, then try again.");
  }
  return {
    ...v,
    gold: num(v["gold"]),
    ops: Array.isArray(v["ops"]) ? v["ops"].filter(validOp).map((o: RawOp) => ({...o})) : [],
    origin: isObj(v["origin"]) ? {...v["origin"]} : null,
    hlc: num(v["hlc"]),
  };
}

/**
 * Gold as the client's op-log replay will compute it.
 *
 * The stored `gold` field is the client's last answer; the replay is what the
 * next merge will recompute from `origin + ops`, and a spend that the replay
 * cannot afford is *skipped* by the client — which would hand the Gold back
 * while the market still holds it. So escrow is checked against the smaller.
 */
export function replayGold(ledger: EconLedger): number {
  const imported = ledger.ops.length > 0 || appliedCount(ledger.origin?.["applied"] ?? ledger["applied"]) > 0;
  const origin: Json = imported && ledger.origin ? ledger.origin : ledger;
  const ops = imported ? ledger.ops : [];
  const applied: Record<string, number> = isObj(origin["applied"]) ? origin["applied"] : {};
  let gold = num(origin["gold"]);
  const cosmetics = new Set<string>(Array.isArray(origin["cosmetics"]) ? origin["cosmetics"] : []);
  for (const op of [...ops].sort(compareOps)) {
    if (op.seq <= num(applied[op.deviceId])) continue;
    const amount = num(op.amount);
    if (AMOUNT_KINDS.has(op.kind) && amount <= 0 && op.kind !== "buy-upgrade") continue;
    switch (op.kind) {
    case "credit-gold": gold += amount; break;
    case "spend-gold":
    case "buy-upgrade":
      if (gold >= amount) gold -= amount;
      break;
    case "buy-cosmetic": {
      const id = typeof op.itemId === "string" ? op.itemId : "";
      if (id && cosmetics.has(id)) break;
      if (gold >= amount) {
        gold -= amount;
        if (id) cosmetics.add(id);
      }
      break;
    }
    case "grant-cosmetic":
      if (typeof op.itemId === "string" && op.itemId) cosmetics.add(op.itemId);
      break;
    case "prestige": gold = 0; break;
    default: break;
    }
  }
  return gold;
}

function appliedCount(applied: unknown): number {
  if (!isObj(applied)) return 0;
  return Object.values(applied).reduce((n: number, s) => n + num(s), 0);
}

export function spendableGold(ledger: EconLedger): number {
  return Math.max(0, Math.min(ledger.gold, replayGold(ledger)));
}

/** The next `seq` the market may use in this ledger. Never reuses a folded one. */
export function nextEconomySeq(ledger: EconLedger, stored: number): number {
  let max = stored;
  for (const src of [ledger["applied"], ledger.origin?.["applied"]]) {
    if (isObj(src)) max = Math.max(max, num(src[MARKET_DEVICE_ID]));
  }
  for (const op of ledger.ops) if (op.deviceId === MARKET_DEVICE_ID) max = Math.max(max, num(op.seq));
  return max + 1;
}

/**
 * Append a Gold op and move the stored balance with it, keeping
 * `origin + ops` and `gold` consistent so the client's "unexplained Gold"
 * reconciliation sees no difference.
 */
export function applyGoldOp(
  ledger: EconLedger,
  kind: "credit-gold" | "spend-gold",
  amount: number,
  seq: number,
  now: number,
): {ledger: EconLedger; op: EconomyOpLite} {
  if (!Number.isInteger(amount) || amount <= 0) throw new SaveError("bad-amount", "Gold amounts must be whole and positive.");
  if (ledger.origin === null && ledger.ops.length > 0) {
    throw new SaveError("save-syncing", "Your Gold ledger is mid-sync. Open the game for a few seconds, then try again.");
  }
  if (kind === "spend-gold" && spendableGold(ledger) < amount) {
    throw new SaveError("not-enough-gold", `You need ${amount.toLocaleString("en-US")} Gold in your cloud save for that.`);
  }
  let hlc = Math.max(ledger.hlc, now);
  for (const op of ledger.ops) hlc = Math.max(hlc, num(op.hlc));
  hlc += 1;
  const op: EconomyOpLite = {id: `${MARKET_DEVICE_ID}:${seq}`, deviceId: MARKET_DEVICE_ID, seq, kind, amount, hlc, wall: now};
  // A log-free (legacy or freshly compacted) ledger has no origin; the client
  // would treat the post-op snapshot as the origin and replay the op on top of
  // it, applying it twice. Pin the pre-op snapshot as the origin instead.
  const origin = ledger.origin ?? snapshotForOrigin(ledger);
  return {ledger: withOp(ledger, op, origin), op};
}

function snapshotForOrigin(ledger: EconLedger): Json {
  const copy: Json = JSON.parse(JSON.stringify(ledger));
  copy["ops"] = [];
  copy["origin"] = null;
  copy["commerceOps"] = [];
  return copy;
}

function withOp(ledger: EconLedger, op: EconomyOpLite, origin: Json): EconLedger {
  const delta = op.kind === "credit-gold" ? op.amount : -op.amount;
  const next: EconLedger = {
    ...ledger,
    origin,
    ops: [...ledger.ops, {...op}],
    hlc: Math.max(ledger.hlc, op.hlc),
    gold: ledger.gold + delta,
  };
  if (op.kind === "credit-gold") {
    next["runGoldEarned"] = num(ledger["runGoldEarned"]) + op.amount;
    next["totalGoldEarned"] = num(ledger["totalGoldEarned"]) + op.amount;
  }
  return next;
}

/**
 * Re-append any market Gold op a client re-sync dropped. Idempotent: an op
 * still in the log, or already folded under the device watermark, is skipped.
 */
export function reassertEconomyMarks(ledger: EconLedger, marks: readonly EscrowMark[]): EconLedger {
  let next = ledger;
  for (const mark of marks) {
    if (mark.kind !== "economy-op") continue;
    const op = mark.op;
    if (next.ops.some((o) => o.id === op.id)) continue;
    const watermark = Math.max(
      num(isObj(next["applied"]) ? next["applied"][op.deviceId] : 0),
      num(isObj(next.origin?.["applied"]) ? next.origin?.["applied"][op.deviceId] : 0),
    );
    if (op.seq <= watermark) continue;
    if (next.origin === null && next.ops.length > 0) continue;
    if (op.kind === "spend-gold" && spendableGold(next) < op.amount) {
      // Cannot be afforded any more; appending it would be skipped by the
      // client's replay anyway. Left for the residual-risk log.
      continue;
    }
    next = withOp(next, op, next.origin ?? snapshotForOrigin(next));
  }
  return next;
}
