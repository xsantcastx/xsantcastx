/**
 * glim-save.model.ts — what the Keeper's companion remembers.
 *
 * Glim, the Margin-Light (docs/world/world-and-cast.md §4) keeps three things
 * about the Keeper it travels with:
 *
 *   met      the Prologue meeting happened (Glim landed on the shoulder once)
 *   ladder   how far the hint ladder has been opened, per subject (a first
 *            goal id or a Delve mission id): 1 nudge, 2 direction, 3 Show me
 *   said     which of its lines it has said and when, so a once-line is once
 *            on every device and a cooldown survives a reload
 *
 * Saved through the gateway as `godforge-glim` (synced: progress/glim). Every
 * field only grows — a meeting cannot be un-met, a hint once given cannot be
 * un-given — so two devices merge by "met if either met, the further ladder
 * step, the higher count, the later stamp", and the merge is commutative.
 *
 * No imports: cloud-save.model.ts is eager and imports this merge.
 */
export const GLIM_KEY = 'godforge-glim';

/** The ladder's top step: 1 nudge, 2 direction, 3 Show me. */
export const GLIM_LADDER_TOP = 3;

/** Ceilings so a corrupt or hostile blob cannot grow the save without bound. */
const MAX_SUBJECTS = 64;
const MAX_LINES = 128;
const ID = /^[a-z0-9][a-z0-9.-]{0,63}$/;

export interface GlimState {
  version: 1;
  met: boolean;
  /** When the meeting happened (ISO), '' before it. The earlier one wins a merge. */
  metAt: string;
  /** subject id → highest ladder step opened (1..3). */
  ladder: Record<string, number>;
  /** line id → times said. */
  said: Record<string, number>;
  /** line id → when it was last said (epoch ms), for cooldowns. */
  lastAt: Record<string, number>;
}

export function emptyGlim(): GlimState {
  return { version: 1, met: false, metAt: '', ladder: {}, said: {}, lastAt: {} };
}

function counts(raw: unknown, max: number, cap: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= cap) break;
    if (!ID.test(k) || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
    out[k] = Math.min(max, Math.floor(v));
    n++;
  }
  return out;
}

/** Anything to a valid state: junk ids, negative counts and over-long maps are dropped. */
export function coerceGlim(raw: unknown): GlimState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyGlim();
  const r = raw as Partial<Record<keyof GlimState, unknown>>;
  const metAt = typeof r.metAt === 'string' && r.metAt.length <= 40 ? r.metAt : '';
  return {
    version: 1,
    met: r.met === true || !!metAt,
    metAt,
    ladder: counts(r.ladder, GLIM_LADDER_TOP, MAX_SUBJECTS),
    said: counts(r.said, 1_000_000, MAX_LINES),
    lastAt: counts(r.lastAt, Number.MAX_SAFE_INTEGER, MAX_LINES),
  };
}

function maxOf(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/** Two devices' Glim into one. Commutative; nothing is ever lost. */
export function mergeGlim(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceGlim(remote), l = coerceGlim(local);
  const metAt = !r.metAt ? l.metAt : !l.metAt ? r.metAt : r.metAt < l.metAt ? r.metAt : l.metAt;
  return {
    version: 1,
    met: r.met || l.met,
    metAt,
    ladder: maxOf(l.ladder, r.ladder),
    said: maxOf(l.said, r.said),
    lastAt: maxOf(l.lastAt, r.lastAt),
  } satisfies GlimState;
}
