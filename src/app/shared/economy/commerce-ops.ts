/**
 * commerce-ops.ts — durable Market purchase receipts (C2).
 *
 * A mutation key is one intentional purchase. Generate a fresh id per click;
 * reuse it only when retrying that same action. Replay consults which ledger
 * ops actually applied — an id in the log is not enough, because merge can
 * skip an unaffordable spend and leave the op in place.
 *
 * Terminal receipts may be folded into `commerceApplied` at a checkpoint.
 * Keys are never dropped silently; a later retry still finds the outcome.
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

export function parseCommerceApplied(raw: unknown): Record<string, CommerceStatus> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, CommerceStatus> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'committed' || value === 'rejected' || value === 'rolled-back') out[key] = value;
  }
  return out;
}

export function findCommerceByKey(
  ops: readonly CommerceOperation[],
  appliedKeys: Record<string, CommerceStatus>,
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
    status: folded,
    createdAt: 0,
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
  a: Record<string, CommerceStatus>,
  b: Record<string, CommerceStatus>,
): Record<string, CommerceStatus> {
  const out = { ...a };
  for (const [key, status] of Object.entries(b)) {
    const held = out[key];
    if (!held || STATUS_RANK[status] > STATUS_RANK[held]) out[key] = status;
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

/** Fold old terminal receipts into the durable applied-key map. Pending stays live. */
export function compactCommerceReceipts(
  ops: readonly CommerceOperation[],
  appliedKeys: Record<string, CommerceStatus>,
  opts: { after?: number; keep?: number } = {},
): { ops: CommerceOperation[]; appliedKeys: Record<string, CommerceStatus> } {
  const after = opts.after ?? 64;
  const keep = opts.keep ?? 16;
  const pending = ops.filter(op => op.status === 'pending');
  const terminal = ops
    .filter(op => op.status !== 'pending')
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  if (terminal.length < after) {
    return { ops: [...pending, ...terminal], appliedKeys: { ...appliedKeys } };
  }
  const stay = terminal.slice(-keep);
  const fold = terminal.slice(0, terminal.length - keep);
  const nextApplied = { ...appliedKeys };
  for (const op of fold) nextApplied[op.mutationKey] = op.status;
  return { ops: [...pending, ...stay], appliedKeys: nextApplied };
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
