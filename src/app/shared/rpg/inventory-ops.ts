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
 * Stack ops are unioned by mutation id and capped at
 * {@link INVENTORY_STACK_OPS_MAX}. C4/C5 should not lean on unbounded
 * stack history without a retain/ack window like commerce receipts.
 */
import {
  PARSE_SLOT_IDS,
  RETIRED_CHARM_TAG,
  canonicalizeSlot,
  isRetiredCharmSlot,
  type GameItem,
  type ItemType,
  type SlotId,
} from './item.model';
import {
  INVENTORY_ERA,
  INVENTORY_BAG_CAP,
  INVENTORY_STACK_OPS_MAX,
  INVENTORY_TOMBSTONE_MAX,
  INVENTORY_TOMBSTONE_RETAIN_MS,
  type EconomyProjectionInput,
  type InventoryBlobV1,
  type InventoryLedger,
  type InventoryRecordSource,
  type InventoryRevision,
  type InventoryStackOp,
  type InventoryTombstone,
  type ItemLocation,
  type OwnedItemCategory,
  type OwnedItemInstance,
  type OwnedItemRecord,
  type RuneProjectionInput,
} from './inventory.model';

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
    sellValue: typeof item.sellValue === 'number' && Number.isFinite(item.sellValue) ? item.sellValue : 0,
    location: locationOf(item),
    upgradeLevel: item.upgradeLevel,
    lastUpgradeAt: item.lastUpgradeAt,
    lastUpgradeMutationId: item.lastUpgradeMutationId,
    lastUpgradeOk: item.lastUpgradeOk,
  };
}

export function recordToItem(record: OwnedItemInstance): GameItem {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    rarity: (record.rarity ?? 'common') as GameItem['rarity'],
    stats: { ...record.stats },
    sellValue: record.sellValue,
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
  };
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

function parseUpgradeFields(raw: Record<string, unknown>): Pick<
  GameItem,
  'upgradeLevel' | 'lastUpgradeAt' | 'lastUpgradeMutationId' | 'lastUpgradeOk'
> {
  const level = raw['upgradeLevel'];
  return {
    upgradeLevel: typeof level === 'number' && Number.isFinite(level) ? Math.max(0, Math.floor(level)) : undefined,
    lastUpgradeAt: typeof raw['lastUpgradeAt'] === 'string' ? raw['lastUpgradeAt'] : undefined,
    lastUpgradeMutationId: typeof raw['lastUpgradeMutationId'] === 'string' ? raw['lastUpgradeMutationId'] : undefined,
    lastUpgradeOk: typeof raw['lastUpgradeOk'] === 'boolean' ? raw['lastUpgradeOk'] : undefined,
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
  return {
    id: raw['id'],
    name: raw['name'],
    type: raw['type'],
    rarity: raw['rarity'] as GameItem['rarity'],
    stats,
    sellValue: finiteNumber(raw['sellValue']),
    equipped,
    slot: equipped && typeof slot === 'string' && PARSE_SLOT_IDS.includes(slot)
      ? (canonicalizeSlot(slot) ?? undefined)
      : undefined,
    explorerId: typeof raw['explorerId'] === 'string' ? raw['explorerId'] : undefined,
    lore: typeof raw['lore'] === 'string' ? raw['lore'] : undefined,
    foundAt: typeof raw['foundAt'] === 'string' ? raw['foundAt'] : new Date(0).toISOString(),
    soulbound: raw['soulbound'] === true,
    definitionId: typeof raw['definitionId'] === 'string' ? raw['definitionId'] : undefined,
    ...parseUpgradeFields(raw),
  };
}

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
  return {
    version: 2,
    records: dedupeRecordSlots(records),
    tombstones: parseTombstones(raw['tombstones']),
    stackOps: parseStackOps(raw['stackOps']),
    goldFromSales: finiteNumber(raw['goldFromSales']),
    sold: finiteNumber(raw['sold']),
    hlc: finiteNumber(raw['hlc']),
    legacyBackup: parseInventoryV1(raw['legacyBackup']),
    era: typeof raw['era'] === 'number' && Number.isFinite(raw['era']) ? raw['era'] : 0,
  };
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
 * C5: bag every charm and tag it so it cannot be worn again.
 * offhand → off-hand is handled in parseLocation. Idempotent.
 */
export function retireCharms(
  ledger: InventoryLedger,
  deviceId: string,
  now: number,
): { ledger: InventoryLedger; retiredIds: string[] } {
  const retiredIds: string[] = [];
  let next = ledger;
  for (const row of ledger.records) {
    if (row.kind !== 'instance' || row.type !== 'charm') continue;
    const tagged = row.tags.includes(RETIRED_CHARM_TAG);
    const bagged = row.location.kind === 'bag';
    if (tagged && bagged) continue;
    const stepped = nextRevision(next, deviceId, now, row.revision);
    next = {
      ...next,
      hlc: stepped.hlc,
      records: next.records.map(entry => entry.id !== row.id ? entry : {
        ...row,
        location: { kind: 'bag' },
        tags: tagged ? row.tags : [...row.tags, RETIRED_CHARM_TAG],
        revision: stepped.revision,
      }),
    };
    retiredIds.push(row.id);
  }
  return { ledger: next, retiredIds };
}

export function dropLegacyBackup(ledger: InventoryLedger): InventoryLedger {
  if (!ledger.legacyBackup) return ledger;
  return { ...ledger, legacyBackup: null };
}

export function projectEconomy(
  input: EconomyProjectionInput,
): OwnedItemInstance[] {
  const out: OwnedItemInstance[] = [];
  for (const id of input.artifacts) {
    if (typeof id !== 'string' || !id) continue;
    out.push(projectionRecord(`econ:artifact:${id}`, id, 'artifact', 'artifacts', ['artifact']));
  }
  for (const id of input.cosmetics) {
    if (typeof id !== 'string' || !id) continue;
    out.push(projectionRecord(`econ:cosmetic:${id}`, id, 'artifact', 'artifacts', ['cosmetic']));
  }
  return out;
}

export function projectRunes(input: RuneProjectionInput): OwnedItemRecord[] {
  const out: OwnedItemRecord[] = [];
  for (const [id, qty] of Object.entries(input.runes)) {
    const n = finiteNumber(qty);
    if (!id || n <= 0) continue;
    out.push({
      id: `rune:${id}`,
      definitionId: id,
      kind: 'stack',
      category: 'runes',
      tags: ['rune'],
      soulbound: false,
      acquiredAt: new Date(0).toISOString(),
      revision: { hlc: 0, deviceId: 'runes', sequence: 0 },
      source: 'runes',
      stackKey: `rune:${id}`,
      location: { kind: 'bag' },
    });
  }
  for (const id of input.runewords) {
    if (typeof id !== 'string' || !id) continue;
    out.push(projectionRecord(`runeword:${id}`, id, 'runeword', 'runes', ['runeword']));
  }
  return out;
}

export function stackQuantity(ops: readonly InventoryStackOp[], stackKey: string): number {
  const seen = new Set<string>();
  let qty = 0;
  for (const op of ops) {
    if (op.stackKey !== stackKey || seen.has(op.id)) continue;
    seen.add(op.id);
    qty += op.kind === 'grant' ? op.quantity : -op.quantity;
  }
  return Math.max(0, qty);
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
  if (aEra !== bEra) return aEra > bEra ? { ...a, era: aEra } : { ...b, era: bEra };
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

  const stackOps = mergeStackOps(a.stackOps, b.stackOps);
  let records = dedupeRecordSlots([...byId.values()]);
  records = evictRecordsToCap(records, INVENTORY_BAG_CAP, tombstones, Date.now());
  return {
    version: 2,
    records,
    // Cap only. Age-pruning here would drop a winning tombstone and let a
    // stale live record resurrect on the next merge.
    tombstones: pruneTombstones(tombstones, Date.now(), Number.MAX_SAFE_INTEGER),
    stackOps,
    goldFromSales: Math.max(a.goldFromSales, b.goldFromSales),
    sold: Math.max(a.sold, b.sold),
    hlc: Math.max(a.hlc, b.hlc, ...records.map(row => row.revision.hlc)),
    legacyBackup: a.legacyBackup ?? b.legacyBackup,
    era: Math.max(aEra, bEra),
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

export function isProtectedFromEviction(record: OwnedItemRecord): boolean {
  if (record.soulbound) return true;
  if (record.kind === 'stack') return true;
  if (record.location.kind !== 'bag') return true;
  if (record.kind === 'instance' && (record as OwnedItemInstance).sellValue <= 0) return true;
  return false;
}

function evictRecordsToCap(
  records: OwnedItemRecord[],
  cap: number,
  tombstones: InventoryTombstone[],
  now: number,
): OwnedItemRecord[] {
  if (records.length <= cap) return records;
  const protectedRows = records.filter(isProtectedFromEviction);
  const loose = records
    .filter((row): row is OwnedItemInstance => !isProtectedFromEviction(row) && row.kind === 'instance')
    .sort((a, b) => {
      const value = a.sellValue - b.sellValue;
      if (value !== 0) return value;
      if (a.acquiredAt !== b.acquiredAt) return a.acquiredAt < b.acquiredAt ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  const room = Math.max(0, cap - protectedRows.length);
  const keepLoose = room === 0 ? [] : loose.slice(-room);
  const keepIds = new Set([...protectedRows, ...keepLoose].map(row => row.id));
  for (const row of records) {
    if (keepIds.has(row.id)) continue;
    tombstones.push({
      id: row.id,
      revision: {
        hlc: nextHlc(row.revision.hlc, now),
        deviceId: row.revision.deviceId,
        sequence: row.revision.sequence + 1,
      },
      deletedAt: now,
    });
  }
  return records.filter(row => keepIds.has(row.id));
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

function mergeStackOps(a: InventoryStackOp[], b: InventoryStackOp[]): InventoryStackOp[] {
  const byId = new Map<string, InventoryStackOp>();
  for (const op of [...a, ...b]) {
    if (!byId.has(op.id)) byId.set(op.id, op);
  }
  const merged = [...byId.values()].sort((x, y) => x.hlc - y.hlc || x.id.localeCompare(y.id));
  if (merged.length <= INVENTORY_STACK_OPS_MAX) return merged;
  return merged.slice(-INVENTORY_STACK_OPS_MAX);
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
    sellValue: finiteNumber(raw['sellValue']),
    location,
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
    if (isRetiredCharmSlot(raw['slotId'])) {
      return { kind: 'bag' };
    }
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
