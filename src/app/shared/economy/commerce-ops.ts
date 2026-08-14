/**
 * commerce-ops.ts — durable Market purchase receipts (C2).
 *
 * A mutation key is one intentional purchase. Generate a fresh id per click;
 * reuse it only when retrying that same action. Replay consults which ledger
 * ops actually applied — an id in the log is not enough, because merge can
 * skip an unaffordable spend and leave the op in place.
 *
 * Idempotency lives on the same Economy document as the ledger
 * (`users/{uid}/economy/state`). A single Firestore document cannot keep
 * every historical key forever and stay under the 1 MiB cap, so C2 does
 * not promise infinite exact-once replay. The guarantee is:
 *
 *   • A retry of the same mutation key is one debit and one grant while
 *     the receipt is live, or while it sits in `commerceApplied`.
 *   • Terminal receipts fold into `commerceApplied` only at the same
 *     acknowledged ledger checkpoint that folds ops — never on a lone ack.
 *   • A folded key is retained for {@link COMMERCE_RETAIN_MS} after that
 *     fold, and only forgotten once every recently-seen device has acked
 *     the fold checkpoint. A device silent for the ledger stale window
 *     (`ACK_STALE_MS` in economy-ops) does not block prune.
 *   • `commerceApplied` is also hard-capped at {@link COMMERCE_APPLIED_MAX}.
 *     If the cap is reached, the oldest acknowledged folded keys evict
 *     first so the cloud blob stays bounded.
 *   • After prune or eviction the key is gone. A later call with that
 *     same id is a new purchase, not a replay.
 *
 * Per-key server/Firestore operation records would lift the retention
 * ceiling without growing this document. That is a later gateway change;
 * C2 keeps receipts on the existing owner-writable economy blob.
 */
export type CommerceKind = 'upgrade' | 'enchantment' | 'artifact' | 'cosmetic';
export type CommerceStatus = 'pending' | 'committed' | 'rejected' | 'rolled-back';
export type CommerceCode =
  | 'ok'
  | 'queued'
  | 'stale'
  | 'ineligible'
  | 'insufficient-funds'
  | 'in-flight'
  | 'not-found'
  | 'maxed'
  | 'owned'
  | 'weaker'
  | 'conflict';

export type CommerceAppliedStatus = Exclude<CommerceStatus, 'pending'>;

/** Folded mutation-key outcome. `at` is fold time; `checkpointId` is the acked fold. */
export interface CommerceAppliedEntry {
  status: CommerceAppliedStatus;
  at: number;
  checkpointId: number;
}

export type CommerceAppliedMap = Record<string, CommerceAppliedEntry>;

/** Same window as ledger `ACK_STALE_MS`: replay is exact-once for this long after fold. */
export const COMMERCE_RETAIN_MS = 30 * 24 * 60 * 60 * 1000;
/** Hard cap on folded keys so the economy document cannot grow without bound. */
export const COMMERCE_APPLIED_MAX = 256;

export interface CommerceIntent {
  mutationKey: string;
  listingId: string;
  kind: CommerceKind;
  expectedCost: number;
}

export interface CommerceOperation {
  id: string;
  mutationKey: string;
  listingId: string;
  kind: CommerceKind;
  expectedCost: number;
  currency: 'gold' | 'essence';
  economicOpId: string | null;
  grantId: string | null;
  status: CommerceStatus;
  createdAt: number;
}

export interface CommerceReceipt {
  ok: boolean;
  code: CommerceCode;
  mutationKey: string;
  operation: CommerceOperation | null;
}

const KINDS = new Set<string>(['upgrade', 'enchantment', 'artifact', 'cosmetic']);
const STATUSES = new Set<string>(['pending', 'committed', 'rejected', 'rolled-back']);
const STATUS_RANK: Record<CommerceStatus, number> = {
  'rolled-back': 0,
  pending: 1,
  rejected: 2,
  committed: 3,
};

export function newCommerceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newPurchaseActionId(): string {
  return `buy:${newCommerceId()}`;
}

export function grantIdFor(economicOpId: string): string {
  return `grant:${economicOpId}`;
}

export function parseCommerceOp(raw: unknown): CommerceOperation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o['id'] !== 'string' || !o['id']) return null;
  if (typeof o['mutationKey'] !== 'string' || !o['mutationKey']) return null;
  if (typeof o['listingId'] !== 'string' || !o['listingId']) return null;
  if (typeof o['kind'] !== 'string' || !KINDS.has(o['kind'])) return null;
  if (typeof o['expectedCost'] !== 'number' || !Number.isFinite(o['expectedCost']) || o['expectedCost'] < 0) {
    return null;
  }
  if (o['currency'] !== 'gold' && o['currency'] !== 'essence') return null;
  if (typeof o['status'] !== 'string' || !STATUSES.has(o['status'])) return null;
  return {
    id: o['id'],
    mutationKey: o['mutationKey'],
    listingId: o['listingId'],
    kind: o['kind'] as CommerceKind,
    expectedCost: o['expectedCost'],
    currency: o['currency'],
    economicOpId: typeof o['economicOpId'] === 'string' ? o['economicOpId'] : null,
    grantId: typeof o['grantId'] === 'string' ? o['grantId'] : null,
    status: o['status'] as CommerceStatus,
    createdAt: typeof o['createdAt'] === 'number' ? o['createdAt'] : 0,
  };
}

export function parseCommerceOps(raw: unknown): CommerceOperation[] {
  if (!Array.isArray(raw)) return [];
  const out: CommerceOperation[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const op = parseCommerceOp(row);
    if (!op || seen.has(op.mutationKey)) continue;
    seen.add(op.mutationKey);
    out.push(op);
  }
  return out;
}

export function parseCommerceApplied(raw: unknown): CommerceAppliedMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: CommerceAppliedMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = parseCommerceAppliedEntry(value);
    if (entry) out[key] = entry;
  }
  return out;
}

function parseCommerceAppliedEntry(value: unknown): CommerceAppliedEntry | null {
  if (value === 'committed' || value === 'rejected' || value === 'rolled-back') {
    return { status: value, at: 0, checkpointId: 0 };
  }
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  if (o['status'] !== 'committed' && o['status'] !== 'rejected' && o['status'] !== 'rolled-back') {
    return null;
  }
  return {
    status: o['status'],
    at: typeof o['at'] === 'number' && Number.isFinite(o['at']) ? o['at'] : 0,
    checkpointId: typeof o['checkpointId'] === 'number' && Number.isFinite(o['checkpointId'])
      ? o['checkpointId']
      : 0,
  };
}

export function findCommerceByKey(
  ops: readonly CommerceOperation[],
  appliedKeys: CommerceAppliedMap,
  mutationKey: string,
): CommerceOperation | null {
  const live = ops.find(op => op.mutationKey === mutationKey);
  if (live) return live;
  const folded = appliedKeys[mutationKey];
  if (!folded) return null;
  return {
    id: `folded:${mutationKey}`,
    mutationKey,
    listingId: '',
    kind: 'upgrade',
    expectedCost: 0,
    currency: 'gold',
    economicOpId: null,
    grantId: null,
    status: folded.status,
    createdAt: folded.at,
  };
}

/**
 * Derive receipt status from which ledger ops actually applied.
 * An id present in the log is not a grant — merge may have skipped it.
 */
export function reconcileCommerceOps(
  ops: readonly CommerceOperation[],
  appliedEconomicIds: ReadonlySet<string>,
  knownEconomicIds: ReadonlySet<string>,
): CommerceOperation[] {
  return ops.map(op => {
    if (!op.economicOpId) {
      return op.status === 'pending' ? rollbackCommerceOp(op) : op;
    }
    if (appliedEconomicIds.has(op.economicOpId)) {
      return { ...op, status: 'committed', grantId: op.grantId ?? grantIdFor(op.economicOpId) };
    }
    if (knownEconomicIds.has(op.economicOpId)) {
      return { ...op, status: 'rejected', grantId: null };
    }
    return op.status === 'pending' ? rollbackCommerceOp(op) : op;
  });
}

export function mergeCommerceOps(
  a: readonly CommerceOperation[],
  b: readonly CommerceOperation[],
): CommerceOperation[] {
  const byKey = new Map<string, CommerceOperation>();
  for (const op of [...a, ...b]) {
    const held = byKey.get(op.mutationKey);
    if (!held || STATUS_RANK[op.status] > STATUS_RANK[held.status]) {
      byKey.set(op.mutationKey, op);
      continue;
    }
    if (STATUS_RANK[op.status] === STATUS_RANK[held.status] && op.createdAt < held.createdAt) {
      byKey.set(op.mutationKey, op);
    }
  }
  return [...byKey.values()].sort((x, y) => x.createdAt - y.createdAt || x.id.localeCompare(y.id));
}

export function mergeCommerceApplied(
  a: CommerceAppliedMap,
  b: CommerceAppliedMap,
): CommerceAppliedMap {
  const out: CommerceAppliedMap = {};
  for (const [key, entry] of Object.entries(a)) out[key] = { ...entry };
  for (const [key, entry] of Object.entries(b)) {
    const held = out[key];
    if (!held || STATUS_RANK[entry.status] > STATUS_RANK[held.status]) {
      out[key] = { ...entry };
      continue;
    }
    if (STATUS_RANK[entry.status] === STATUS_RANK[held.status]
      && (entry.at < held.at || (entry.at === held.at && entry.checkpointId < held.checkpointId))) {
      out[key] = { ...entry };
    }
  }
  return out;
}

export function quoteIsStale(currentCost: number, expectedCost: number): boolean {
  return currentCost !== expectedCost;
}

export function beginCommerceOp(
  intent: CommerceIntent,
  currency: 'gold' | 'essence',
  now: number,
): CommerceOperation {
  return {
    id: newCommerceId(),
    mutationKey: intent.mutationKey,
    listingId: intent.listingId,
    kind: intent.kind,
    expectedCost: intent.expectedCost,
    currency,
    economicOpId: null,
    grantId: null,
    status: 'pending',
    createdAt: now,
  };
}

export function commitCommerceOp(
  op: CommerceOperation,
  economicOpId: string,
): CommerceOperation {
  return {
    ...op,
    economicOpId,
    grantId: grantIdFor(economicOpId),
    status: 'committed',
  };
}

export function rejectCommerceOp(op: CommerceOperation, economicOpId: string | null): CommerceOperation {
  return { ...op, status: 'rejected', economicOpId, grantId: null };
}

export function rollbackCommerceOp(op: CommerceOperation): CommerceOperation {
  return { ...op, status: 'rolled-back', economicOpId: null, grantId: null };
}

export function upsertCommerceOp(
  ops: readonly CommerceOperation[],
  next: CommerceOperation,
): CommerceOperation[] {
  return [...ops.filter(op => op.mutationKey !== next.mutationKey), next];
}

/**
 * Fold old terminal receipts into `commerceApplied`, then forget keys that
 * have both aged past the retain window and been acknowledged.
 *
 * Callers must invoke this only after the ledger checkpoint ack barrier.
 * Pending receipts stay live. Terminals beyond `keep` fold after the oldest
 * acknowledged applied keys are evicted to stay under {@link COMMERCE_APPLIED_MAX}.
 * Unacked keys are not evicted; those terminals stay live until a later ack.
 */
export function compactCommerceReceipts(
  ops: readonly CommerceOperation[],
  appliedKeys: CommerceAppliedMap,
  opts: {
    after?: number;
    keep?: number;
    now?: number;
    checkpointId?: number;
    retainMs?: number;
    maxApplied?: number;
    minAckedCheckpoint?: number;
  } = {},
): { ops: CommerceOperation[]; appliedKeys: CommerceAppliedMap } {
  const after = opts.after ?? 64;
  const keep = opts.keep ?? 16;
  const now = opts.now ?? 0;
  const checkpointId = opts.checkpointId ?? 0;
  const retainMs = opts.retainMs ?? COMMERCE_RETAIN_MS;
  const maxApplied = opts.maxApplied ?? COMMERCE_APPLIED_MAX;
  const minAckedCheckpoint = opts.minAckedCheckpoint ?? -1;

  const pending = ops.filter(row => row.status === 'pending');
  const terminal = ops
    .filter(row => row.status !== 'pending')
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const foldCount = terminal.length >= after ? Math.max(0, terminal.length - keep) : 0;

  const nextApplied = pruneCommerceApplied(appliedKeys, {
    now,
    retainMs,
    maxApplied: Math.max(0, maxApplied - foldCount),
    minAckedCheckpoint,
  });

  if (foldCount === 0) {
    return { ops: [...pending, ...terminal], appliedKeys: nextApplied };
  }

  const stay = terminal.slice(-keep);
  const candidates = terminal.slice(0, foldCount);
  const room = Math.max(0, maxApplied - Object.keys(nextApplied).length);
  const fold = candidates.slice(0, room);
  const overflow = candidates.slice(room);
  for (const row of fold) {
    if (row.status === 'pending') continue;
    nextApplied[row.mutationKey] = {
      status: row.status,
      at: now > 0 ? now : row.createdAt,
      checkpointId,
    };
  }
  return { ops: [...pending, ...overflow, ...stay], appliedKeys: nextApplied };
}

export function pruneCommerceApplied(
  appliedKeys: CommerceAppliedMap,
  opts: {
    now: number;
    retainMs: number;
    maxApplied: number;
    minAckedCheckpoint: number;
  },
): CommerceAppliedMap {
  const next: CommerceAppliedMap = {};
  for (const [key, entry] of Object.entries(appliedKeys)) {
    const acked = entry.checkpointId <= opts.minAckedCheckpoint;
    const expired = opts.now - entry.at >= opts.retainMs;
    if (acked && expired) continue;
    next[key] = { ...entry };
  }
  const keys = Object.keys(next);
  if (keys.length <= opts.maxApplied) return next;

  const ranked = keys
    .map(key => ({ key, entry: next[key] }))
    .sort((a, b) =>
      a.entry.at - b.entry.at
      || a.entry.checkpointId - b.entry.checkpointId
      || a.key.localeCompare(b.key));
  for (const row of ranked) {
    if (Object.keys(next).length <= opts.maxApplied) break;
    if (row.entry.checkpointId > opts.minAckedCheckpoint) continue;
    delete next[row.key];
  }
  return next;
}

/** UTF-8 JSON size of the commerce fields that live on the economy document. */
export function commerceSaveBytes(
  ops: readonly CommerceOperation[],
  appliedKeys: CommerceAppliedMap,
): number {
  return new TextEncoder().encode(JSON.stringify({ commerceOps: ops, commerceApplied: appliedKeys })).length;
}

export function debitGrantOnce(
  existing: CommerceOperation | null,
): 'apply' | 'replay' | 'blocked' | 'conflict' {
  if (!existing) return 'apply';
  if (existing.status === 'committed') return 'replay';
  if (existing.status === 'rejected') return 'conflict';
  if (existing.status === 'pending') return 'blocked';
  return 'apply';
}
