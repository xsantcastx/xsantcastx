/**
 * commerce-ops.ts — durable Market purchase receipts (C2).
 *
 * Pure functions. A mutation key is the retry identity: applying it twice
 * yields one debit and one grant. Receipts live on the economy blob so they
 * share the GameStateGateway write with the ledger op.
 */
export type CommerceKind = 'upgrade' | 'enchantment' | 'artifact' | 'cosmetic';
export type CommerceStatus = 'pending' | 'committed' | 'rolled-back';
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
  | 'weaker';

export interface CommerceIntent {
  mutationKey: string;
  listingId: string;
  kind: CommerceKind;
  expectedCost: number;
  currency: 'gold' | 'essence';
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

export interface CommerceQuote {
  listingId: string;
  kind: CommerceKind;
  cost: number;
  currency: 'gold' | 'essence';
  affordable: boolean;
  eligible: boolean;
  reason?: Exclude<CommerceCode, 'ok' | 'queued' | 'stale' | 'in-flight'>;
}

export interface CommerceReceipt {
  ok: boolean;
  code: CommerceCode;
  mutationKey: string;
  operation: CommerceOperation | null;
}

const KINDS = new Set<string>(['upgrade', 'enchantment', 'artifact', 'cosmetic']);
const STATUSES = new Set<string>(['pending', 'committed', 'rolled-back']);
const STATUS_RANK: Record<CommerceStatus, number> = {
  'rolled-back': 0,
  pending: 1,
  committed: 2,
};

export function newCommerceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export function findCommerceByKey(
  ops: readonly CommerceOperation[],
  mutationKey: string,
): CommerceOperation | null {
  return ops.find(op => op.mutationKey === mutationKey) ?? null;
}

/** Pending with a landed economy op becomes committed; otherwise rolled back. */
export function recoverCommerceOps(
  ops: readonly CommerceOperation[],
  landedEconomicIds: ReadonlySet<string>,
): CommerceOperation[] {
  return ops.map(op => {
    if (op.status !== 'pending') return op;
    if (op.economicOpId && landedEconomicIds.has(op.economicOpId)) {
      return { ...op, status: 'committed', grantId: op.grantId ?? grantIdFor(op.economicOpId) };
    }
    return { ...op, status: 'rolled-back', economicOpId: null, grantId: null };
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

export function quoteIsStale(currentCost: number, expectedCost: number): boolean {
  return currentCost !== expectedCost;
}

export function beginCommerceOp(intent: CommerceIntent, now: number): CommerceOperation {
  return {
    id: newCommerceId(),
    mutationKey: intent.mutationKey,
    listingId: intent.listingId,
    kind: intent.kind,
    expectedCost: intent.expectedCost,
    currency: intent.currency,
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

export function rollbackCommerceOp(op: CommerceOperation): CommerceOperation {
  return { ...op, status: 'rolled-back', economicOpId: null, grantId: null };
}

export function upsertCommerceOp(
  ops: readonly CommerceOperation[],
  next: CommerceOperation,
): CommerceOperation[] {
  const out = ops.filter(op => op.mutationKey !== next.mutationKey);
  out.push(next);
  return out.slice(-64);
}

export function debitGrantOnce(
  existing: CommerceOperation | null,
): 'apply' | 'replay' | 'blocked' {
  if (!existing) return 'apply';
  if (existing.status === 'committed') return 'replay';
  if (existing.status === 'pending') return 'blocked';
  return 'apply';
}
