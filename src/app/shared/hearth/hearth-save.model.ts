/**
 * hearth-save.model.ts — what the Cold Hearth remembers (`godforge-hearth`, synced as progress/hearth, per character).
 *
 *   lit        every hearth the Keeper has lit (ids like `hearth:infernal-reach:pyrehold`): only grows, a union
 *   wake       the last hearth lit: where the Keeper wakes after a fall (null = the square, none lit yet)
 *   wakeAt     ms of that lighting: the later lighting wins on merge
 *   debt       the Ember debt, in Hunting XP still owed (kills pay it off, hearth-rules.ts)
 *   blessings  the Hearth Blessings held (bought at a shrine, consumed by a fall that costs anything)
 *   ledgerAt   ms of the last change to debt or blessings: the later event wins both, whole (a fall on one device
 *              and a purchase on the other cannot be split; the later one is what happened last)
 *   falls      falls ever (only grows)
 *
 * No imports beyond the pure rules: cloud-save.model.ts is eager and imports this merge.
 */
import { BLESSING_IDS, isBlessingId, type BlessingId } from './hearth-rules';

export const HEARTH_KEY = 'godforge-hearth';

export interface HearthSave {
  version: 1;
  lit: string[];
  wake: string | null;
  wakeAt: number;
  debt: number;
  blessings: BlessingId[];
  ledgerAt: number;
  falls: number;
}

/** A hearth id: `hearth:<continent>:<town>`, short and safe. */
const HEARTH_ID = /^hearth:[a-z0-9-]{1,40}:[a-z0-9-]{1,40}$/;
const MAX_LIT = 64;

export function isHearthId(v: unknown): v is string {
  return typeof v === 'string' && HEARTH_ID.test(v);
}

export function emptyHearth(): HearthSave {
  return { version: 1, lit: [], wake: null, wakeAt: 0, debt: 0, blessings: [], ledgerAt: 0, falls: 0 };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const ids = (raw: unknown): string[] => (Array.isArray(raw) ? [...new Set(raw.filter(isHearthId))].sort().slice(0, MAX_LIT) : []);
const blessings = (raw: unknown): BlessingId[] => (Array.isArray(raw) ? BLESSING_IDS.filter(id => raw.includes(id) && isBlessingId(id)) : []);

export function coerceHearth(raw: unknown): HearthSave {
  if (!isRecord(raw)) return emptyHearth();
  const lit = ids(raw['lit']);
  const wake = isHearthId(raw['wake']) ? raw['wake'] : null;
  return {
    version: 1,
    lit: wake && !lit.includes(wake) ? ids([...lit, wake]) : lit,
    wake,
    wakeAt: whole(raw['wakeAt']),
    debt: whole(raw['debt']),
    blessings: blessings(raw['blessings']),
    ledgerAt: whole(raw['ledgerAt']),
    falls: whole(raw['falls']),
  };
}

/** Two devices into one. Commutative: lit hearths unioned, the later lighting is the wake point, the later ledger event wins. */
export function mergeHearth(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceHearth(remote), l = coerceHearth(local);
  const wake = r.wakeAt > l.wakeAt || (r.wakeAt === l.wakeAt && (r.wake ?? '') > (l.wake ?? '')) ? r : l;
  const ledger = r.ledgerAt > l.ledgerAt || (r.ledgerAt === l.ledgerAt && (r.debt > l.debt || (r.debt === l.debt && r.blessings.length > l.blessings.length))) ? r : l;
  return {
    version: 1,
    lit: ids([...l.lit, ...r.lit]),
    wake: wake.wake, wakeAt: wake.wakeAt,
    debt: ledger.debt, blessings: ledger.blessings, ledgerAt: ledger.ledgerAt,
    falls: Math.max(l.falls, r.falls),
  } satisfies HearthSave;
}
