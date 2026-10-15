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
 * The bond (glim-bond.ts) adds four more, all growing too:
 *   moments  the shared moments that make the bond (a set: union on merge)
 *   answers  what the Keeper told Glim when it asked (the later answer wins)
 *   peak     the highest bond stage reached (max), so a stage never closes
 *   seenAt   the last time the two of you were out together (max), for the
 *            warm hello after a while away — never a guilt trip
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
/** Bond moment ids (glim-bond.ts): `<kind>:<id>`. */
export const MOMENT_ID = /^[a-z]+:[a-z0-9@,.-]{1,60}$/;
const MOMENT = MOMENT_ID;
const MAX_MOMENTS = 240;

export type MomentKind = 'area' | 'insc' | 'site' | 'kind' | 'mission' | 'catch' | 'depth' | 'talk' | 'back' | 'quest' | 'compass' | 'play';

/**
 * How much each kind of bond moment is worth, and how many of it ever count
 * (glim-bond.ts). Here, not there, because the merge trims each kind to its cap.
 */
export const MOMENT_RULES: Readonly<Record<MomentKind, { weight: number; cap: number }>> = {
  area: { weight: 3, cap: 12 },      // a place first visited together
  insc: { weight: 3, cap: 40 },      // a carving read
  site: { weight: 1, cap: 40 },      // a Delve structure stood in (the endless Delve)
  kind: { weight: 3, cap: 8 },       // the first of each kind of structure
  mission: { weight: 4, cap: 20 },   // a Delve or fishing mission finished
  catch: { weight: 2, cap: 30 },     // a first catch of each kind
  depth: { weight: 5, cap: 4 },      // a new stratum reached (Root Hollows … Magma Halls)
  talk: { weight: 3, cap: 12 },      // a talk with Glim, heard to the end
  back: { weight: 2, cap: 3 },       // came back after a while (a hello, not a reward loop)
  quest: { weight: 8, cap: 6 },      // a step of "The Blank Places"
  compass: { weight: 4, cap: 1 },    // the Broken Astral Compass, in hand
  play: { weight: 1, cap: 5 },       // a round of catch-the-light, one a day (glim-react.ts), five ever
};

/** Each kind trimmed to its cap (kinds this build does not know are dropped). */
function capped(ids: Iterable<string>): string[] {
  const n: Record<string, number> = {};
  const out: string[] = [];
  for (const id of ids) {
    const kind = id.slice(0, id.indexOf(':')) as MomentKind;
    const rule = Object.prototype.hasOwnProperty.call(MOMENT_RULES, kind) ? MOMENT_RULES[kind] : null;
    if (!rule || (n[kind] = (n[kind] ?? 0) + 1) > rule.cap) continue;
    out.push(id);
  }
  return out;
}
const MAX_ANSWERS = 8;

/** One remembered answer: the choice, and when (the later one wins a merge). */
export interface GlimAnswer { a: string; at: number }

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
  /** The bond's shared moments (glim-bond.ts). */
  moments: string[];
  /** question id → the Keeper's answer. */
  answers: Record<string, GlimAnswer>;
  /** Highest bond stage reached (1..5). */
  peak: number;
  /** Last time out together (epoch ms), 0 never. */
  seenAt: number;
}

export function emptyGlim(): GlimState {
  return { version: 1, met: false, metAt: '', ladder: {}, said: {}, lastAt: {}, moments: [], answers: {}, peak: 1, seenAt: 0 };
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
    moments: moments(r.moments),
    answers: answers(r.answers),
    peak: typeof r.peak === 'number' && Number.isFinite(r.peak) ? Math.max(1, Math.min(5, Math.floor(r.peak))) : 1,
    seenAt: typeof r.seenAt === 'number' && Number.isFinite(r.seenAt) && r.seenAt > 0 ? Math.floor(r.seenAt) : 0,
  };
}

function moments(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const id of raw) {
    if (out.size >= MAX_MOMENTS) break;
    if (typeof id === 'string' && MOMENT.test(id)) out.add(id);
  }
  return capped(out);
}

function answers(raw: unknown): Record<string, GlimAnswer> {
  const out: Record<string, GlimAnswer> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const [q, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_ANSWERS) break;
    const a = v && typeof v === 'object' ? (v as Record<string, unknown>)['a'] : undefined;
    const at = v && typeof v === 'object' ? (v as Record<string, unknown>)['at'] : undefined;
    if (!ID.test(q) || typeof a !== 'string' || !ID.test(a) || typeof at !== 'number' || !Number.isFinite(at) || at < 0) continue;
    out[q] = { a, at: Math.floor(at) };
    n++;
  }
  return out;
}

/** Per question, the later answer (a tie: the larger choice id, so the merge is commutative). */
function laterAnswers(a: Record<string, GlimAnswer>, b: Record<string, GlimAnswer>): Record<string, GlimAnswer> {
  const out = { ...a };
  for (const [q, v] of Object.entries(b)) {
    const mine = out[q];
    if (!mine || v.at > mine.at || (v.at === mine.at && v.a > mine.a)) out[q] = v;
  }
  return out;
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
    // The union, in a stable order (sorted) so both sides of a merge agree.
    moments: capped([...new Set([...l.moments, ...r.moments])].sort()),
    answers: laterAnswers(l.answers, r.answers),
    peak: Math.max(l.peak, r.peak),
    seenAt: Math.max(l.seenAt, r.seenAt),
  } satisfies GlimState;
}
