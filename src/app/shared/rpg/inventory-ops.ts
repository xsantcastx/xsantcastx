/**
 * inventory-ops.ts — C3 adapter: migrate, validate, merge, tombstones.
 *
 * Merge is commutative, associative, and idempotent. Location conflicts take
 * one complete record by revision (hlc, deviceId, sequence) — never field by
 * field. Stack counts are derived from idempotent grant/consume ops.
 *
 * A parse failure returns the legacy backup when one exists. A later retry
 * of the same stack mutation id is one grant or one consume.
 *
 * Stack ops are unioned by mutation id. Each device folds its OWN oldest ops
 * into its per-device {@link InventoryStackFold} past
 * {@link INVENTORY_STACK_OPS_MAX}; a merge never folds anything.
 */
import {
  ITEM_STAT_KEYS,
  PARSE_SLOT_IDS,
  RETIRED_CHARM_TAG,
  canonicalizeSlot,
  type GameItem,
  type GraveCurse,
  type GraveWhisper,
  type ItemType,
  type SlotId,
} from './item.model';
import { parseCurse, parseWhisper } from '../grave-goods/grave-goods.model';
import {
  INVENTORY_ERA,
  INVENTORY_FOLD_ID_MEMORY,
  INVENTORY_STACK_OPS_MAX,
  INVENTORY_TOMBSTONE_MAX,
  INVENTORY_TOMBSTONE_RETAIN_MS,
  type EconomyProjectionInput,
  type InventoryBlobV1,
  type InventoryLedger,
  type InventoryRecordSource,
  type InventoryRevision,
  type InventoryStackOp,
  type InventoryStackFold,
  type InventoryTombstone,
  type ItemLocation,
  type OwnedItemCategory,
  type OwnedItemInstance,
  type OwnedItemRecord,
  type RuneProjectionInput,
} from './inventory.model';
import { ECONOMY_VERSION, itemScaled } from '../economy/economy-curve';

export function emptyInventoryLedger(): InventoryLedger {
  return {
    version: 2,
    records: [],
    tombstones: [],
    stackOps: [],
    goldFromSales: 0,
    sold: 0,
    hlc: 0,
    legacyBackup: null,
    era: INVENTORY_ERA,
  };
}

export function compareRevision(a: InventoryRevision, b: InventoryRevision): number {
  if (a.hlc !== b.hlc) return a.hlc - b.hlc;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  return a.sequence - b.sequence;
}

export function nextHlc(previous: number, wall: number): number {
  return Math.max(wall, previous + 1);
}

export function nextRevision(
  ledger: InventoryLedger,
  deviceId: string,
  wall: number,
  previous?: InventoryRevision,
): { revision: InventoryRevision; hlc: number } {
  const hlc = nextHlc(Math.max(ledger.hlc, previous?.hlc ?? 0), wall);
  const sequence = (previous?.deviceId === deviceId ? previous.sequence : 0) + 1;
  return { revision: { hlc, deviceId, sequence }, hlc };
}

export function locationOf(item: GameItem): ItemLocation {
  if (typeof item.explorerId === 'string' && item.explorerId) {
    return { kind: 'explorer', explorerId: item.explorerId };
  }
  if (item.equipped && item.slot && PARSE_SLOT_IDS.includes(item.slot)) {
    const slot = canonicalizeSlot(item.slot);
    if (slot) return { kind: 'equipped', slotId: slot };
  }
  return { kind: 'bag' };
}

export function categoryOf(type: ItemType): OwnedItemCategory {
  if (type === 'charm') return 'equipment';
  if (type === 'rune' || type === 'runeword') return 'runes';
  return 'artifacts';
}

export function itemToRecord(item: GameItem): OwnedItemInstance {
  const acquiredAt = typeof item.foundAt === 'string' && item.foundAt
    ? item.foundAt
    : new Date(0).toISOString();
  const wall = Date.parse(acquiredAt);
  return {
    id: item.id,
    definitionId: item.definitionId || `${item.type}:${item.name}`,
    kind: 'instance',
    category: categoryOf(item.type),
    tags: [item.type],
    rarity: item.rarity,
    soulbound: item.soulbound === true,
    acquiredAt,
    revision: {
      hlc: Number.isFinite(wall) ? wall : 0,
      deviceId: 'legacy',
      sequence: 0,
    },
    source: 'inventory',
    name: item.name,
    type: item.type,
    lore: item.lore,
    stats: { ...item.stats },
    rollQuality: item.rollQuality ? { ...item.rollQuality } : undefined,
    itemLevel: item.itemLevel,
    sellValue: typeof item.sellValue === 'number' && Number.isFinite(item.sellValue) ? item.sellValue : 0,
    // Every GameItem in memory is priced in v3 Gold: minted under v3, or
    // scaled by `parseGameItem` on the way in.
    econ: ECONOMY_VERSION,
    location: locationOf(item),
    upgradeLevel: item.upgradeLevel,
    lastUpgradeAt: item.lastUpgradeAt,
    lastUpgradeMutationId: item.lastUpgradeMutationId,
    lastUpgradeOk: item.lastUpgradeOk,
    reforgeCount: item.reforgeCount,
    lastReforgeAt: item.lastReforgeAt,
    lastReforgeMutationId: item.lastReforgeMutationId,
    lastReforgeLock: item.lastReforgeLock,
    sockets: item.sockets ? [...item.sockets] : undefined,
    ...graveFields(item),
  };
}

export function recordToItem(record: OwnedItemInstance): GameItem {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    rarity: (record.rarity ?? 'common') as GameItem['rarity'],
    stats: { ...record.stats },
    rollQuality: record.rollQuality ? { ...record.rollQuality } : undefined,
    itemLevel: record.itemLevel,
    sellValue: record.sellValue,
    econ: ECONOMY_VERSION,
    equipped: record.location.kind === 'equipped',
    slot: record.location.kind === 'equipped' ? record.location.slotId : undefined,
    explorerId: record.location.kind === 'explorer' ? record.location.explorerId : undefined,
    lore: record.lore,
    foundAt: record.acquiredAt,
    soulbound: record.soulbound,
    definitionId: record.definitionId,
    upgradeLevel: record.upgradeLevel,
    lastUpgradeAt: record.lastUpgradeAt,
    lastUpgradeMutationId: record.lastUpgradeMutationId,
    lastUpgradeOk: record.lastUpgradeOk,
    reforgeCount: record.reforgeCount,
    lastReforgeAt: record.lastReforgeAt,
    lastReforgeMutationId: record.lastReforgeMutationId,
    lastReforgeLock: record.lastReforgeLock,
    sockets: record.sockets ? [...record.sockets] : undefined,
    ...graveFields(record),
  };
}

/** A grave-good's curse and whisper, copied (shared/grave-goods); nothing at all for an ordinary item. */
function graveFields(from: { curse?: GraveCurse; whisper?: GraveWhisper }): { curse?: GraveCurse; whisper?: GraveWhisper } {
  return { ...(from.curse ? { curse: { ...from.curse } } : {}), ...(from.whisper ? { whisper: { ...from.whisper } } : {}) };
}
/** A saved curse and whisper, read strictly: junk is dropped, the item still loads (grave-goods.model.ts). */
function parseGrave(raw: Record<string, unknown>): { curse?: GraveCurse; whisper?: GraveWhisper } {
  const curse = parseCurse(raw['curse']), whisper = parseWhisper(raw['whisper']);
  return { ...(curse ? { curse } : {}), ...(whisper ? { whisper } : {}) };
}

export function itemsFromLedger(ledger: InventoryLedger): GameItem[] {
  return ledger.records
    .filter((row): row is OwnedItemInstance => row.kind === 'instance' && row.source === 'inventory')
    .map(recordToItem);
}

export function migrateV1(blob: InventoryBlobV1, keepBackup = true): InventoryLedger {
  const records = blob.items.map(itemToRecord);
  return {
    version: 2,
    records: dedupeRecordSlots(records),
    tombstones: [],
    stackOps: [],
    goldFromSales: finiteNumber(blob.goldFromSales),
    sold: finiteNumber(blob.sold),
    hlc: records.reduce((max, row) => Math.max(max, row.revision.hlc), 0),
    legacyBackup: keepBackup ? cloneV1(blob) : null,
    era: 0,
  };
}

export function cloneV1(blob: InventoryBlobV1): InventoryBlobV1 {
  return {
    version: 1,
    items: blob.items.map(item => ({ ...item, stats: { ...item.stats } })),
    goldFromSales: blob.goldFromSales,
    sold: blob.sold,
  };
}

export function parseInventoryV1(raw: unknown): InventoryBlobV1 | null {
  if (!isPlainObject(raw)) return null;
  if (raw['version'] !== 1 && raw['version'] !== undefined) return null;
  if (!Array.isArray(raw['items'])) return null;
  const items: GameItem[] = [];
  for (const row of raw['items']) {
    const item = parseGameItem(row);
    if (item) items.push(item);
  }
  return {
    version: 1,
    items,
    goldFromSales: finiteNumber(raw['goldFromSales']),
    sold: finiteNumber(raw['sold']),
  };
}

/**
 * Read a persisted roll grade, dropping anything that is not a real 0..1.
 *
 * Returns undefined rather than `{}` when nothing survives, because an empty
 * object and a missing field mean different things downstream: `qualityOf`
 * reports null for both, but an empty object would make an ungraded legacy item
 * claim to have been graded and found to have no stats.
 */
function parseRollQuality(raw: unknown): GameItem['rollQuality'] {
  if (!isPlainObject(raw)) return undefined;
  const out: NonNullable<GameItem['rollQuality']> = {};
  let any = false;
  for (const key of ITEM_STAT_KEYS) {
    const value = raw[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[key] = Math.min(1, Math.max(0, value));
    any = true;
  }
  return any ? out : undefined;
}

/** A persisted item level: a finite integer 1..99, or nothing. */
function parseItemLevel(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 99 ? raw : undefined;
}

function parseUpgradeFields(raw: Record<string, unknown>): Pick<
  GameItem,
  'upgradeLevel' | 'lastUpgradeAt' | 'lastUpgradeMutationId' | 'lastUpgradeOk'
  | 'reforgeCount' | 'lastReforgeAt' | 'lastReforgeMutationId' | 'lastReforgeLock'
> {
  const level = raw['upgradeLevel'];
  const reforged = raw['reforgeCount'];
  const lock = raw['lastReforgeLock'];
  return {
    upgradeLevel: typeof level === 'number' && Number.isFinite(level) ? Math.max(0, Math.floor(level)) : undefined,
    lastUpgradeAt: typeof raw['lastUpgradeAt'] === 'string' ? raw['lastUpgradeAt'] : undefined,
    lastUpgradeMutationId: typeof raw['lastUpgradeMutationId'] === 'string' ? raw['lastUpgradeMutationId'] : undefined,
    lastUpgradeOk: typeof raw['lastUpgradeOk'] === 'boolean' ? raw['lastUpgradeOk'] : undefined,
    // Absent on every save written before the reforge sink shipped — all four
    // fall through to undefined, which reads as "never rerolled".
    reforgeCount: typeof reforged === 'number' && Number.isFinite(reforged) ? Math.max(0, Math.floor(reforged)) : undefined,
    lastReforgeAt: typeof raw['lastReforgeAt'] === 'string' ? raw['lastReforgeAt'] : undefined,
    lastReforgeMutationId: typeof raw['lastReforgeMutationId'] === 'string' ? raw['lastReforgeMutationId'] : undefined,
    lastReforgeLock: ITEM_STAT_KEYS.includes(lock as never) ? lock as GameItem['lastReforgeLock'] : undefined,
  };
}

export function parseGameItem(raw: unknown): GameItem | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw['id'] !== 'string' || !raw['id']) return null;
  if (typeof raw['name'] !== 'string') return null;
  if (!isItemType(raw['type'])) return null;
  if (typeof raw['rarity'] !== 'string') return null;
  if (!isPlainObject(raw['stats'])) return null;
  const stats: GameItem['stats'] = {};
  for (const [key, value] of Object.entries(raw['stats'])) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      stats[key as keyof GameItem['stats']] = value;
    }
  }
  const slot = raw['slot'];
  const equipped = raw['equipped'] === true;
  const rollQuality = parseRollQuality(raw['rollQuality']);
  return {
    id: raw['id'],
    name: raw['name'],
    type: raw['type'],
    rarity: raw['rarity'] as GameItem['rarity'],
    stats,
    rollQuality,
    itemLevel: parseItemLevel(raw['itemLevel']),
    sellValue: v3SellValue(raw),
    econ: ECONOMY_VERSION,
    equipped,
    slot: equipped && typeof slot === 'string' && PARSE_SLOT_IDS.includes(slot)
      ? (canonicalizeSlot(slot) ?? undefined)
      : undefined,
    explorerId: typeof raw['explorerId'] === 'string' ? raw['explorerId'] : undefined,
    lore: typeof raw['lore'] === 'string' ? raw['lore'] : undefined,
    foundAt: typeof raw['foundAt'] === 'string' ? raw['foundAt'] : new Date(0).toISOString(),
    soulbound: raw['soulbound'] === true,
    definitionId: typeof raw['definitionId'] === 'string' ? raw['definitionId'] : undefined,
    sockets: parseSockets(raw['sockets']),
    ...parseGrave(raw),
    ...parseUpgradeFields(raw),
  };
}

/**
 * A persisted socket array.
 *
 * Anything that is not a string reads as an empty well rather than dropping the
 * row: an unrecognised rune id in well two must not shuffle well three into
 * well two's place, because the whole point of a Socket Word is that order is
 * load-bearing. Length is capped at {@link PARSED_SOCKET_MAX} so a hand-edited
 * blob cannot put a thousand wells in a save.
 */
function parseSockets(raw: unknown): (string | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const wells = raw
    .slice(0, PARSED_SOCKET_MAX)
    .map(id => (typeof id === 'string' && id ? id : null));
  return wells.length ? wells : undefined;
}

/**
 * Hard ceiling on a parsed socket array.
 *
 * Not the live socket count — `socketCountFor` owns that and is free to move.
 * This is only the bound on what a blob may claim, kept here rather than
 * imported so `inventory-ops` stays free of the enchanting module.
 */
const PARSED_SOCKET_MAX = 8;

export function parseInventoryLedger(raw: unknown): InventoryLedger | null {
  if (!isPlainObject(raw)) return null;
  if (raw['version'] !== 2) return null;
  if (!Array.isArray(raw['records'])) return null;
  const records: OwnedItemRecord[] = [];
  const seen = new Set<string>();
  for (const row of raw['records']) {
    const record = parseOwnedRecord(row);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    records.push(record);
  }
  const stacks = parseStackHistory(raw['stackOps'], raw['stackFolds'], raw['stackCheckpoints']);
  return {
    version: 2,
    records: dedupeRecordSlots(records),
    tombstones: parseTombstones(raw['tombstones']),
    stackOps: stacks.ops,
    ...(stacks.folds.length ? { stackFolds: stacks.folds } : {}),
    goldFromSales: finiteNumber(raw['goldFromSales']),
    sold: finiteNumber(raw['sold']),
    hlc: finiteNumber(raw['hlc']),
    legacyBackup: parseInventoryV1(raw['legacyBackup']),
    era: typeof raw['era'] === 'number' && Number.isFinite(raw['era']) ? raw['era'] : 0,
    ...serverSeqOf(raw['serverSeq']),
  };
}

/** The trade server's write count (InventoryLedger.serverSeq), kept only when it is a real positive whole number. */
function serverSeqOf(raw: unknown): { serverSeq?: number } {
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? { serverSeq: raw } : {};
}

/**
 * Load any on-disk shape. Corrupt v2 falls back to `legacyBackup` or a
 * recoverable v1 payload. Failure here returns null so the service can
 * restore empty rather than throw.
 */
export function coerceInventoryLedger(raw: unknown): InventoryLedger | null {
  if (raw == null) return emptyInventoryLedger();
  const v2 = parseInventoryLedger(raw);
  if (v2) return v2;
  if (isPlainObject(raw) && raw['version'] === 2 && isPlainObject(raw['legacyBackup'])) {
    const backup = parseInventoryV1(raw['legacyBackup']);
    if (backup) return migrateV1(backup, true);
  }
  const v1 = parseInventoryV1(raw);
  if (v1) return migrateV1(v1, true);
  return null;
}

/**
 * Undo C5's charm retirement: strip the tag that said a charm cannot be worn.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS REPLACES `retireCharms` RATHER THAN SITTING BESIDE IT
 * ─────────────────────────────────────────────────────────────────────────────
 * C5 ran the opposite of this on every load: it moved each charm to the bag and
 * stamped `RETIRED_CHARM_TAG` on it. Charms have slots again, so that pass is
 * not merely unnecessary — left in place it would fight the player, bagging
 * whatever they equipped on the next hydrate.
 *
 * Keeping both and picking one behind a flag was the other option and it is
 * worse: the two passes are exact inverses, so a build where both could run
 * would have an ordering bug waiting in it forever.
 *
 * The tag is *removed* rather than ignored because it is persisted, it is
 * public in the snapshot, and "this item cannot be worn" sitting on an item the
 * panel will happily equip is a contradiction that outlives whoever remembers
 * why it is there.
 *
 * Idempotent, and returns the ids it touched so the caller knows whether a
 * write is owed. A save that never saw C5 changes nothing and costs one pass.
 */
export function restoreCharms(
  ledger: InventoryLedger,
  deviceId: string,
  now: number,
): { ledger: InventoryLedger; restoredIds: string[] } {
  const restoredIds: string[] = [];
  let next = ledger;
  for (const row of ledger.records) {
    if (row.kind !== 'instance' || row.type !== 'charm') continue;
    if (!row.tags.includes(RETIRED_CHARM_TAG)) continue;
    const stepped = nextRevision(next, deviceId, now, row.revision);
    next = {
      ...next,
      hlc: stepped.hlc,
      records: next.records.map(entry => entry.id !== row.id ? entry : {
        ...row,
        // The location is left exactly as found. C5 already moved every charm to
        // the bag, so there is nothing to put back — and a save that somehow has
        // one in a slot is a save whose player put it there.
        tags: row.tags.filter(tag => tag !== RETIRED_CHARM_TAG),
        revision: stepped.revision,
      }),
    };
    restoredIds.push(row.id);
  }
  return { ledger: next, restoredIds };
}

export function dropLegacyBackup(ledger: InventoryLedger): InventoryLedger {
  if (!ledger.legacyBackup) return ledger;
  return { ...ledger, legacyBackup: null };
}

/**
 * A short, stable hash of an op id (53-bit cyrb53, base 36): what a fold keeps
 * of each op it folds, so a replay of that id is still recognised. A false
 * match needs two of ~10^16 values to collide among a few thousand.
 */
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

const FOLD_HASHES = new WeakMap<readonly InventoryStackFold[], ReadonlySet<string>>();

/** Every op-id hash any device has folded. Cached per folds array (they are replaced, never mutated). */
function foldedHashes(folds: readonly InventoryStackFold[]): ReadonlySet<string> {
  let set = FOLD_HASHES.get(folds);
  if (!set) {
    set = new Set(folds.flatMap(fold => fold.ids));
    FOLD_HASHES.set(folds, set);
  }
  return set;
}

/**
 * True when this op is already counted by a fold: its own device folded it
 * (`hlc <= upToHlc`), or any device folded an op with the same id (the same
 * grant issued on two devices before they synced).
 */
function foldCovers(folds: readonly InventoryStackFold[], op: InventoryStackOp): boolean {
  if (!folds.length) return false;
  const own = folds.find(fold => fold.deviceId === op.deviceId);
  if (own && op.hlc <= own.upToHlc) return true;
  return foldedHashes(folds).has(opIdHash(op.id));
}

/**
 * Net quantity held for one stack: every device's folded net plus the live
 * ops no fold already counts. Clamped at zero only here, on the total.
 */
export function stackQuantity(
  ops: readonly InventoryStackOp[],
  stackKey: string,
  folds: readonly InventoryStackFold[] = [],
): number {
  let qty = 0;
  for (const fold of folds) qty += fold.net[stackKey] ?? 0;
  const seen = new Set<string>();
  for (const op of ops) {
    if (op.stackKey !== stackKey || seen.has(op.id)) continue;
    seen.add(op.id);
    if (foldCovers(folds, op)) continue;
    qty += op.kind === 'grant' ? op.quantity : -op.quantity;
  }
  return Math.max(0, qty);
}

/** {@link stackQuantity} against a whole ledger, folds included. */
export function stackQuantityOf(ledger: InventoryLedger, stackKey: string): number {
  return stackQuantity(ledger.stackOps, stackKey, ledger.stackFolds ?? []);
}

/**
 * True when a stack op with this id has landed on this ledger — live, or
 * folded by any device (within its id memory). Every replay guard reads this.
 */
export function ledgerKnowsOp(ledger: InventoryLedger, opId: string): boolean {
  if (!opId) return false;
  if (ledger.stackOps.some(op => op.id === opId)) return true;
  return !!ledger.stackFolds?.length && foldedHashes(ledger.stackFolds).has(opIdHash(opId));
}

export function applyStackOp(
  ops: readonly InventoryStackOp[],
  next: InventoryStackOp,
): InventoryStackOp[] {
  if (ops.some(op => op.id === next.id)) return [...ops];
  return [...ops, next];
}

export function mergeInventoryLedgers(remote: unknown, local: unknown): InventoryLedger {
  const a = coerceInventoryLedger(remote) ?? emptyInventoryLedger();
  const b = coerceInventoryLedger(local) ?? emptyInventoryLedger();
  const aEra = a.era ?? 0;
  const bEra = b.era ?? 0;
  // The trade server's write count survives every branch, the era short-circuit included: a lower one would make
  // the inventory rule refuse this device's writes for good.
  const seq = serverSeqOf(Math.max(a.serverSeq ?? 0, b.serverSeq ?? 0));
  if (aEra !== bEra) return aEra > bEra ? { ...a, era: aEra, ...seq } : { ...b, era: bEra, ...seq };
  const tombstones = mergeTombstones(a.tombstones, b.tombstones);
  const tombById = new Map(tombstones.map(row => [row.id, row]));
  const byId = new Map<string, OwnedItemRecord>();

  for (const record of [...a.records, ...b.records]) {
    const tomb = tombById.get(record.id);
    if (tomb && compareRevision(tomb.revision, record.revision) >= 0) continue;
    const held = byId.get(record.id);
    if (!held || compareRevision(record.revision, held.revision) > 0) {
      byId.set(record.id, record);
      continue;
    }
    if (compareRevision(record.revision, held.revision) === 0
      && canonicalRecord(record) > canonicalRecord(held)) {
      byId.set(record.id, record);
    }
  }

  const stacks = mergeStackHistory(a.stackOps, b.stackOps, a.stackFolds ?? [], b.stackFolds ?? []);
  // A pure union: a merge never tombstones a live record. The satchel's limit
  // is held by `settle` (inventory-layout.ts), which only moves things.
  const records = dedupeRecordSlots([...byId.values()]);
  return {
    version: 2,
    records,
    // Cap only. Age-pruning here would drop a winning tombstone and let a
    // stale live record resurrect on the next merge.
    tombstones: pruneTombstones(tombstones, Date.now(), Number.MAX_SAFE_INTEGER),
    stackOps: stacks.ops,
    ...(stacks.folds.length ? { stackFolds: stacks.folds } : {}),
    goldFromSales: Math.max(a.goldFromSales, b.goldFromSales),
    sold: Math.max(a.sold, b.sold),
    hlc: Math.max(a.hlc, b.hlc, ...records.map(row => row.revision.hlc), ...stacks.folds.map(fold => fold.upToHlc)),
    legacyBackup: a.legacyBackup ?? b.legacyBackup,
    era: Math.max(aEra, bEra),
    ...seq,
  };
}

export function tombstoneRecord(
  ledger: InventoryLedger,
  id: string,
  revision: InventoryRevision,
  deletedAt: number,
): InventoryLedger {
  const tombstones = mergeTombstones(ledger.tombstones, [{ id, revision, deletedAt }]);
  return {
    ...ledger,
    records: ledger.records.filter(row => row.id !== id),
    tombstones,
    hlc: Math.max(ledger.hlc, revision.hlc),
  };
}

export function upsertRecord(ledger: InventoryLedger, record: OwnedItemRecord): InventoryLedger {
  const tomb = ledger.tombstones.find(row => row.id === record.id);
  if (tomb && compareRevision(tomb.revision, record.revision) >= 0) return ledger;
  return {
    ...ledger,
    records: dedupeRecordSlots([
      ...ledger.records.filter(row => row.id !== record.id),
      record,
    ]),
    tombstones: ledger.tombstones.filter(row => row.id !== record.id),
    hlc: Math.max(ledger.hlc, record.revision.hlc),
  };
}

function mergeTombstones(
  a: InventoryTombstone[],
  b: InventoryTombstone[],
): InventoryTombstone[] {
  const byId = new Map<string, InventoryTombstone>();
  for (const row of [...a, ...b]) {
    const held = byId.get(row.id);
    if (!held || compareRevision(row.revision, held.revision) > 0) byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function pruneTombstones(
  tombstones: InventoryTombstone[],
  now: number,
  retainMs = INVENTORY_TOMBSTONE_RETAIN_MS,
  max = INVENTORY_TOMBSTONE_MAX,
): InventoryTombstone[] {
  const live = tombstones.filter(row => now - row.deletedAt < retainMs || row.deletedAt === 0);
  if (live.length <= max) return live;
  return [...live]
    .sort((a, b) => a.deletedAt - b.deletedAt || compareRevision(a.revision, b.revision))
    .slice(-max);
}

/** Devices that never fold: no stable id, so their ops cannot be told apart. */
const NON_FOLDING_DEVICES: ReadonlySet<string> = new Set(['', 'unknown', 'legacy']);

/**
 * Fold THIS device's oldest ops past `live` into its fold (down to half of
 * `live`), so a device that never syncs does not grow its blob without bound.
 * Only own ops: an op is folded by the one device sure to hold it, so no other
 * device's unsynced op can be lost under a watermark. Own ops another device
 * already folded under the same id are dropped, not counted again.
 */
export function compactStackOps(
  ledger: InventoryLedger,
  deviceId: string,
  live = INVENTORY_STACK_OPS_MAX,
  memory = INVENTORY_FOLD_ID_MEMORY,
): InventoryLedger {
  if (NON_FOLDING_DEVICES.has(deviceId)) return ledger;
  const own = ledger.stackOps.filter(op => op.deviceId === deviceId);
  if (own.length <= live) return ledger;

  own.sort((x, y) => x.hlc - y.hlc || x.id.localeCompare(y.id));
  const cutHlc = own[own.length - Math.floor(live / 2) - 1].hlc;
  const folds = ledger.stackFolds ?? [];
  const others = folds.filter(fold => fold.deviceId !== deviceId);
  const previous = folds.find(fold => fold.deviceId === deviceId);
  const net: Record<string, number> = { ...(previous?.net ?? {}) };
  const ids = [...(previous?.ids ?? [])];
  const folded = new Set<string>();
  for (const op of own) {
    if (op.hlc > cutHlc) break;
    folded.add(op.id);
    // Counted already: by this fold, or by another device's under the same id.
    if (foldCovers(folds, op)) continue;
    net[op.stackKey] = (net[op.stackKey] ?? 0) + (op.kind === 'grant' ? op.quantity : -op.quantity);
    ids.push(opIdHash(op.id));
  }
  for (const key of Object.keys(net)) if (net[key] === 0) delete net[key];
  const fold: InventoryStackFold = {
    deviceId,
    upToHlc: Math.max(previous?.upToHlc ?? 0, cutHlc),
    net,
    ids: ids.slice(-memory),
  };
  return {
    ...ledger,
    stackOps: ledger.stackOps.filter(op => !folded.has(op.id)),
    stackFolds: [...others, fold].sort((x, y) => x.deviceId.localeCompare(y.deviceId)),
    hlc: Math.max(ledger.hlc, fold.upToHlc),
  };
}

/**
 * One device's fold, merged: the higher `upToHlc` is the later state of the
 * same counter and wins whole. A tie (only possible after a device lost its
 * local copy) keeps the canonical larger, so the merge stays commutative.
 */
function mergeFolds(
  a: readonly InventoryStackFold[],
  b: readonly InventoryStackFold[],
): InventoryStackFold[] {
  const byDevice = new Map<string, InventoryStackFold>();
  for (const fold of [...a, ...b]) {
    const held = byDevice.get(fold.deviceId);
    if (!held || fold.upToHlc > held.upToHlc
      || (fold.upToHlc === held.upToHlc && JSON.stringify(fold) > JSON.stringify(held))) {
      byDevice.set(fold.deviceId, fold);
    }
  }
  return [...byDevice.values()].sort((x, y) => x.deviceId.localeCompare(y.deviceId));
}

/**
 * Union stack ops by id and the folds by device. Nothing is folded here — a
 * merge does not know which device it runs on — and ops a fold already counts
 * are dropped, which is what makes repeated merges idempotent.
 */
function mergeStackHistory(
  a: readonly InventoryStackOp[],
  b: readonly InventoryStackOp[],
  foldsA: readonly InventoryStackFold[],
  foldsB: readonly InventoryStackFold[],
): { ops: InventoryStackOp[]; folds: InventoryStackFold[] } {
  const folds = mergeFolds(foldsA, foldsB);
  const byId = new Map<string, InventoryStackOp>();
  for (const op of [...a, ...b]) {
    if (foldCovers(folds, op)) continue;
    const held = byId.get(op.id);
    // The same id from two devices: keep one, deterministically (the earlier write).
    if (!held || op.hlc < held.hlc || (op.hlc === held.hlc && op.deviceId < held.deviceId)) byId.set(op.id, op);
  }
  const ops = [...byId.values()].sort((x, y) => x.hlc - y.hlc || x.id.localeCompare(y.id));
  return { ops, folds };
}

function parseOwnedRecord(raw: unknown): OwnedItemRecord | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw['id'] !== 'string' || !raw['id']) return null;
  if (typeof raw['definitionId'] !== 'string' || !raw['definitionId']) return null;
  const revision = parseRevision(raw['revision']);
  if (!revision) return null;
  const source = raw['source'];
  if (source !== 'inventory' && source !== 'economy' && source !== 'runes') return null;
  const recordSource: InventoryRecordSource = source;
  const category = raw['category'];
  if (!isCategory(category)) return null;
  const tags = Array.isArray(raw['tags'])
    ? raw['tags'].filter((tag): tag is string => typeof tag === 'string')
    : [];
  const base = {
    id: raw['id'],
    definitionId: raw['definitionId'],
    category,
    tags,
    rarity: typeof raw['rarity'] === 'string' ? raw['rarity'] : undefined,
    soulbound: raw['soulbound'] === true,
    acquiredAt: typeof raw['acquiredAt'] === 'string' ? raw['acquiredAt'] : new Date(0).toISOString(),
    revision,
    source: recordSource,
  };
  if (raw['kind'] === 'stack') {
    if (typeof raw['stackKey'] !== 'string' || !raw['stackKey']) return null;
    return { ...base, kind: 'stack', stackKey: raw['stackKey'], location: { kind: 'bag' } };
  }
  if (raw['kind'] !== 'instance') return null;
  if (typeof raw['name'] !== 'string') return null;
  if (!isItemType(raw['type'])) return null;
  const location = parseLocation(raw['location']);
  if (!location) return null;
  const stats: GameItem['stats'] = {};
  if (isPlainObject(raw['stats'])) {
    for (const [key, value] of Object.entries(raw['stats'])) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        stats[key as keyof GameItem['stats']] = value;
      }
    }
  }
  return {
    ...base,
    kind: 'instance',
    name: raw['name'],
    type: raw['type'],
    lore: typeof raw['lore'] === 'string' ? raw['lore'] : undefined,
    stats,
    rollQuality: parseRollQuality(raw['rollQuality']),
    itemLevel: parseItemLevel(raw['itemLevel']),
    sellValue: v3SellValue(raw),
    econ: ECONOMY_VERSION,
    location,
    sockets: parseSockets(raw['sockets']),
    ...parseGrave(raw),
    ...parseUpgradeFields(raw),
  };
}

function parseLocation(raw: unknown): ItemLocation | null {
  if (!isPlainObject(raw)) return null;
  if (raw['kind'] === 'bag') return { kind: 'bag' };
  if (raw['kind'] === 'explorer' && typeof raw['explorerId'] === 'string' && raw['explorerId']) {
    return { kind: 'explorer', explorerId: raw['explorerId'] };
  }
  if (raw['kind'] === 'equipped' && typeof raw['slotId'] === 'string' && PARSE_SLOT_IDS.includes(raw['slotId'])) {
    // `charm1`-`charm3` used to be shunted to the bag here. They are real slots
    // again, so a pre-C5 save that still names one gets its charm back on the
    // player rather than in the bag — see the note on `EquipmentSlotId`.
    const slot = canonicalizeSlot(raw['slotId']);
    if (slot) return { kind: 'equipped', slotId: slot };
  }
  return null;
}

function parseRevision(raw: unknown): InventoryRevision | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw['hlc'] !== 'number' || !Number.isFinite(raw['hlc'])) return null;
  if (typeof raw['deviceId'] !== 'string' || !raw['deviceId']) return null;
  if (typeof raw['sequence'] !== 'number' || !Number.isFinite(raw['sequence'])) return null;
  return { hlc: raw['hlc'], deviceId: raw['deviceId'], sequence: raw['sequence'] };
}

function parseTombstones(raw: unknown): InventoryTombstone[] {
  if (!Array.isArray(raw)) return [];
  const out: InventoryTombstone[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!isPlainObject(row) || typeof row['id'] !== 'string') continue;
    const revision = parseRevision(row['revision']);
    if (!revision || seen.has(row['id'])) continue;
    seen.add(row['id']);
    out.push({
      id: row['id'],
      revision,
      deletedAt: finiteNumber(row['deletedAt']),
    });
  }
  return out;
}

function parseFolds(raw: unknown): InventoryStackFold[] {
  if (!Array.isArray(raw)) return [];
  const out: InventoryStackFold[] = [];
  for (const row of raw) {
    if (!isPlainObject(row) || typeof row['deviceId'] !== 'string' || !row['deviceId']) continue;
    const net: Record<string, number> = {};
    if (isPlainObject(row['net'])) {
      for (const [key, value] of Object.entries(row['net'])) {
        if (key && typeof value === 'number' && Number.isFinite(value) && value !== 0) net[key] = value;
      }
    }
    const ids = Array.isArray(row['ids'])
      ? row['ids'].filter((id): id is string => typeof id === 'string' && !!id).slice(-INVENTORY_FOLD_ID_MEMORY)
      : [];
    out.push({ deviceId: row['deviceId'], upToHlc: Math.max(0, finiteNumber(row['upToHlc'])), net, ids });
  }
  return mergeFolds(out, []);
}

/**
 * Ops + folds. A save from before per-device folds carries global
 * `stackCheckpoints` ({stackKey, quantity, upToHlc}): each becomes the net of
 * a `legacy` fold and the ops it covered are dropped, so the total is
 * unchanged. (Zero players then; two such saves merging is not reconciled.)
 */
function parseStackHistory(
  rawOps: unknown,
  rawFolds: unknown,
  rawCheckpoints: unknown,
): { ops: InventoryStackOp[]; folds: InventoryStackFold[] } {
  let ops = parseStackOps(rawOps);
  const folds = parseFolds(rawFolds);
  if (!Array.isArray(rawCheckpoints) || !rawCheckpoints.length || folds.some(fold => fold.deviceId === 'legacy')) {
    return { ops, folds };
  }
  const net: Record<string, number> = {};
  const floor = new Map<string, number>();
  for (const row of rawCheckpoints) {
    if (!isPlainObject(row) || typeof row['stackKey'] !== 'string' || !row['stackKey'] || floor.has(row['stackKey'])) continue;
    const qty = Math.max(0, finiteNumber(row['quantity']));
    if (qty) net[row['stackKey']] = qty;
    floor.set(row['stackKey'], Math.max(0, finiteNumber(row['upToHlc'])));
  }
  ops = ops.filter(op => op.hlc > (floor.get(op.stackKey) ?? -Infinity));
  const legacy: InventoryStackFold = { deviceId: 'legacy', upToHlc: 0, net, ids: [] };
  return { ops, folds: mergeFolds(folds, [legacy]) };
}

function parseStackOps(raw: unknown): InventoryStackOp[] {
  if (!Array.isArray(raw)) return [];
  const out: InventoryStackOp[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!isPlainObject(row)) continue;
    if (typeof row['id'] !== 'string' || !row['id'] || seen.has(row['id'])) continue;
    if (typeof row['stackKey'] !== 'string' || !row['stackKey']) continue;
    if (row['kind'] !== 'grant' && row['kind'] !== 'consume') continue;
    const qty = finiteNumber(row['quantity']);
    if (qty <= 0) continue;
    seen.add(row['id']);
    out.push({
      id: row['id'],
      stackKey: row['stackKey'],
      kind: row['kind'],
      quantity: qty,
      hlc: finiteNumber(row['hlc']),
      deviceId: typeof row['deviceId'] === 'string' ? row['deviceId'] : 'legacy',
      sequence: finiteNumber(row['sequence']),
    });
  }
  return out;
}

function dedupeRecordSlots(records: OwnedItemRecord[]): OwnedItemRecord[] {
  const bySlot = new Map<SlotId, OwnedItemInstance[]>();
  const rest: OwnedItemRecord[] = [];
  for (const record of records) {
    if (record.kind === 'instance' && record.location.kind === 'equipped') {
      const held = bySlot.get(record.location.slotId) ?? [];
      held.push(record);
      bySlot.set(record.location.slotId, held);
      continue;
    }
    rest.push(record);
  }
  const out = [...rest];
  for (const claimants of bySlot.values()) {
    claimants.sort((a, b) => {
      const rev = compareRevision(b.revision, a.revision);
      if (rev !== 0) return rev;
      return a.id.localeCompare(b.id);
    });
    out.push(claimants[0]);
    for (const loser of claimants.slice(1)) {
      out.push({ ...loser, location: { kind: 'bag' } });
    }
  }
  return out;
}

function projectionRecord(
  id: string,
  definitionId: string,
  type: ItemType,
  category: OwnedItemCategory,
  tags: string[],
): OwnedItemInstance {
  return {
    id,
    definitionId,
    kind: 'instance',
    category,
    tags,
    soulbound: true,
    acquiredAt: new Date(0).toISOString(),
    revision: { hlc: 0, deviceId: 'projection', sequence: 0 },
    source: tags.includes('rune') || tags.includes('runeword') ? 'runes' : 'economy',
    name: definitionId,
    type,
    stats: {},
    sellValue: 0,
    location: { kind: 'bag' },
  };
}

function canonicalRecord(record: OwnedItemRecord): string {
  return JSON.stringify([
    record.revision.hlc,
    record.revision.deviceId,
    record.revision.sequence,
    record.kind,
    record.kind === 'instance' ? record.location : record.stackKey,
    record.definitionId,
  ]);
}

/**
 * A stored sell value in v3 Gold. Records written before economy v3 carry no
 * `econ` marker and are scaled by ρ here, once; the parsed record is stamped
 * so the next parse leaves it alone (rebalance spec §4).
 */
function v3SellValue(raw: Record<string, unknown>): number {
  const value = finiteNumber(raw['sellValue']);
  const econ = finiteNumber(raw['econ']);
  return econ >= ECONOMY_VERSION ? value : itemScaled(value);
}

function isItemType(value: unknown): value is ItemType {
  return value === 'rune' || value === 'runeword' || value === 'charm' || value === 'artifact';
}

function isCategory(value: unknown): value is OwnedItemCategory {
  return value === 'equipment'
    || value === 'runes'
    || value === 'materials'
    || value === 'consumables'
    || value === 'quest'
    || value === 'artifacts';
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
