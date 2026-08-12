/**
 * cloud-save.model.ts — what gets synced, and how two devices are reconciled.
 *
 * The Godforge keeps its state in ten independent localStorage blobs, each
 * owned by the service that understands it. Cloud save deliberately does *not*
 * take that ownership away: every service keeps reading and writing localStorage
 * synchronously, exactly as it does today, and this layer copies those blobs up
 * and down. That is what keeps the site working signed-out and offline, and it
 * is why adding cloud save did not require rewriting the services that own them.
 *
 * `eclipse-progress` is the exception, and only because it already had somewhere
 * better to go: `ProgressStorageService` was built against a `ProgressAdapter`
 * interface with a Firestore implementation stubbed out, so XP rides that seam
 * (see `FirestoreAdapter` in progress-storage.service.ts) rather than this one.
 * The blobs below have no such seam, and inventing one for each would have been
 * nine rewrites to reach the same place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE MERGE RULE: HIGHER WINS, NOTHING IS EVER LOST
 * ─────────────────────────────────────────────────────────────────────────────
 * Two devices are reconciled field by field, taking the larger number, the union
 * of every id set, and the later timestamp. It is deliberately generous and
 * deliberately commutative: signing in must never cost anybody progress, and
 * which device signed in first must never matter.
 *
 * The generosity has one visible edge. Gold is spendable, so a device that spent
 * 500 Gold on an upgrade and a device that still holds it merge to *both* the
 * upgrade and the Gold. That is a refund, and it is the intended trade: the
 * alternative — summing, or letting the newer write win — either mints currency
 * out of nothing or silently deletes a purchase, and a shop that occasionally
 * undercharges is a far smaller problem than one that eats an artifact somebody
 * saved a week for.
 */

// ─────────────────────────────────────────────────────────────────────────────
// The registry
// ─────────────────────────────────────────────────────────────────────────────

/** Which Firestore subcollection under `users/{uid}` a blob is filed in. */
export type SyncCollection = 'progress' | 'economy';

export interface SyncedBlob {
  /** The localStorage key the owning service reads and writes. */
  key: string;
  /** Subcollection under `users/{uid}`. */
  collection: SyncCollection;
  /** Document id within that subcollection. */
  doc: string;
  /** Human-readable, for the sync log. */
  label: string;
  /**
   * Overrides the structural merge for blobs where "higher wins" is the wrong
   * question — a first-discovery date, a bounded leaderboard, a preference.
   */
  merge?: (remote: unknown, local: unknown) => unknown;
}

/**
 * Everything synced outside of `eclipse-progress`.
 *
 * The economy gets its own subcollection because it is the one ledger with
 * spendable currency in it, and a rule that one day has to say something
 * stricter about Gold should not have to say it about the lore chapters too.
 */
export const SYNCED_BLOBS: SyncedBlob[] = [
  {
    key: 'godforge-economy',
    collection: 'economy',
    doc: 'state',
    label: 'Godforge ledger',
  },
  {
    key: 'eclipse-quests',
    collection: 'progress',
    doc: 'quests',
    label: 'quest log',
  },
  {
    key: 'eclipse-lore',
    collection: 'progress',
    doc: 'lore',
    label: 'lore chapters',
  },
  {
    key: 'eclipse-idle',
    collection: 'progress',
    doc: 'idle',
    label: 'forge flame',
  },
  {
    key: 'tool-usage-counts',
    collection: 'progress',
    doc: 'mastery',
    label: 'tool mastery',
  },
  {
    key: 'easter-eggs-found',
    collection: 'progress',
    doc: 'eggs',
    label: 'discoveries',
  },
  {
    key: 'easter-eggs-dates',
    collection: 'progress',
    doc: 'egg-dates',
    label: 'discovery dates',
    // The only blob where the larger value is the wrong one. These are the
    // moments things were *first* found, so a later date is not a better date —
    // it is the record of the same discovery made again on a second device, and
    // keeping it would quietly rewrite somebody's history forward.
    merge: mergeEarliestDates,
  },
  {
    key: 'eclipse-arena-scores',
    collection: 'progress',
    doc: 'arena',
    label: 'arena records',
    // `{ games: { id: { best, plays, cleared } } }` — the structural rules land
    // exactly right on all three: best and plays take the higher, and `cleared`
    // is a flag that stays set once either device has beaten the game.
  },
  {
    key: 'eclipse-realm-rush-board',
    collection: 'progress',
    doc: 'realm-rush-board',
    label: 'Realm Rush board',
    merge: mergeTopRuns,
  },
  {
    key: 'godforge-pinned',
    collection: 'progress',
    doc: 'pinned',
    label: 'trophy case',
    merge: mergePreference,
  },
  {
    key: 'eclipse-combo',
    collection: 'progress',
    doc: 'combo',
    label: 'combo record',
    // `{ version, best }` — a high-water mark, so the structural max is exactly
    // right. The live run is deliberately not persisted and so never syncs:
    // a combo is a rhythm being held, and there is no honest way to store
    // "mid-run" or to hand one device a streak the other earned.
  },
];

/** How many runs the Realm Rush board keeps. Mirrors BOARD_SIZE in its component. */
const BOARD_SIZE = 5;

/**
 * Two local top-five boards into one top five.
 *
 * The structural union is wrong here for a reason worth naming: these entries
 * carry no id, so it would keep every distinct run from both devices and hand
 * back a board of up to ten. A leaderboard is not a set — it is the best N, and
 * merging two of them means ranking the combined runs and taking N again.
 */
function mergeTopRuns(remote: unknown, local: unknown): unknown {
  const runs = [...asArray(local), ...asArray(remote)];
  const seen = new Set<string>();
  const unique = runs.filter(r => {
    const key = JSON.stringify(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique
    .sort((a, b) => scoreOf(b) - scoreOf(a))
    .slice(0, BOARD_SIZE);
}

/**
 * A display preference, where "merging" is the wrong verb entirely.
 *
 * The trophy case holds five pins chosen by hand, and `null` means the visitor
 * has never customised it — which the owning service keeps distinct from an
 * empty array on purpose. Unioning two devices' choices would both overflow the
 * five slots and silently un-choose whatever each device had decided. So the
 * device being used wins, and a device that has never been customised inherits
 * the other one's case rather than blanking it.
 *
 * Deliberately not commutative, unlike every other rule here. A preference is
 * the one kind of state where the answer *should* depend on where you set it.
 */
function mergePreference(remote: unknown, local: unknown): unknown {
  return local ?? remote;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function scoreOf(entry: unknown): number {
  if (isPlainObject(entry) && typeof entry['score'] === 'number') return entry['score'];
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// The structural merge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconcile two parsed blobs without knowing what either of them is.
 *
 * A hand-written merge for each blob was the obvious alternative and the wrong
 * one: nine of them would have had to be kept in step with nine state shapes
 * owned by nine other files, and the failure mode of falling behind is silent
 * data loss on a field nobody remembered to add. The structural rules below are
 * stated once and hold for any shape those services grow into.
 *
 *   number   → the larger. Counters, currencies, timestamps, tallies.
 *   string   → the greater. Every string in these blobs is an ISO instant or a
 *              YYYY-MM-DD / W-prefixed period key, where lexical order *is*
 *              chronological order. For anything else it is arbitrary but
 *              harmless — the strings that are neither are cosmetic variant ids,
 *              where both devices own both variants and either answer is valid.
 *   boolean  → either. A flag that has been set stays set.
 *   array    → union. Primitives dedupe by value; objects dedupe by identity
 *              (see `entryKey`) and are merged pairwise by these same rules.
 *   object   → the union of both key sets, values merged pairwise.
 *
 * Mismatched types keep the local value, on the grounds that a shape change is a
 * client version difference and the running client is the one that can read it.
 */
export function mergeDeep(remote: unknown, local: unknown): unknown {
  if (remote === undefined || remote === null) return local;
  if (local === undefined || local === null) return remote;

  if (typeof remote === 'number' && typeof local === 'number') {
    // NaN loses to a real number rather than poisoning the field.
    if (!Number.isFinite(remote)) return local;
    if (!Number.isFinite(local)) return remote;
    return Math.max(remote, local);
  }

  if (typeof remote === 'boolean' && typeof local === 'boolean') {
    return remote || local;
  }

  if (typeof remote === 'string' && typeof local === 'string') {
    return remote > local ? remote : local;
  }

  if (Array.isArray(remote) && Array.isArray(local)) {
    return mergeArrays(remote, local);
  }

  if (isPlainObject(remote) && isPlainObject(local)) {
    const out: Record<string, unknown> = { ...local };
    for (const [k, v] of Object.entries(remote)) {
      out[k] = k in local ? mergeDeep(v, local[k]) : v;
    }
    return out;
  }

  return local;
}

/**
 * Union of two arrays, local order first.
 *
 * Order is not meaningful in any of the synced arrays — they are id sets and
 * append-only logs — so "local first, then whatever the remote had that we did
 * not" keeps the merge stable without needing a sort key the data does not have.
 */
function mergeArrays(remote: unknown[], local: unknown[]): unknown[] {
  const out: unknown[] = [];
  const index = new Map<string, number>();

  for (const item of local) {
    const key = entryKey(item);
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, out.length);
      out.push(item);
    } else {
      // Duplicate ids inside one device's own array: merge rather than drop, so
      // a blob that was already inconsistent does not lose a field on sync.
      out[at] = mergeDeep(out[at], item);
    }
  }

  for (const item of remote) {
    const key = entryKey(item);
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, out.length);
      out.push(item);
    } else {
      out[at] = mergeDeep(item, out[at]);
    }
  }

  return out;
}

/**
 * The identity two array entries are considered the same under.
 *
 * The distinction that matters is between the two kinds of object array in the
 * synced blobs:
 *
 *  - Running enchantments (`{ id, expiresAt }`) are keyed by `id` alone, so two
 *    devices running the same enchantment merge to one entry holding the later
 *    expiry rather than two timers for one purchase.
 *  - Quest log receipts (`{ id, title, type, xp, at }`) carry `at`, and clearing
 *    the same daily on Monday and again on Tuesday is genuinely two completions.
 *    Keying those on `id` alone would collapse a history into a single line.
 *
 * So: `id` plus `at` when the entry timestamps itself, `id` alone when it does
 * not, and the whole value when it has no id to be known by.
 */
function entryKey(item: unknown): string {
  if (isPlainObject(item)) {
    const id = item['id'];
    if (typeof id === 'string' || typeof id === 'number') {
      const at = item['at'];
      return typeof at === 'string' ? `${id}@${at}` : `${id}`;
    }
  }
  if (item === null || typeof item !== 'object') return `p:${String(item)}`;
  try {
    return `j:${JSON.stringify(item)}`;
  } catch {
    return `j:${String(item)}`;
  }
}

/** Keys the first time each id was seen, not the most recent. */
function mergeEarliestDates(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(remote)) return local ?? {};
  if (!isPlainObject(local)) return remote;

  const out: Record<string, unknown> = { ...local };
  for (const [id, when] of Object.entries(remote)) {
    const held = out[id];
    if (typeof held !== 'string' || (typeof when === 'string' && when < held)) {
      out[id] = when;
    }
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparing two saves
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What each side of the merge dialog shows.
 *
 * Three numbers, chosen because they are the three a person recognises their own
 * save by. The merge itself reconciles far more than this — every quest, every
 * discovery date, every arena record — but a dialog that listed all of it would
 * be asking somebody to audit a diff before they can press a button.
 */
export interface SaveSummary {
  level: number;
  xp: number;
  gold: number;
  achievements: number;
}

/** How a sign-in conflict was resolved. */
export type MergeStrategy =
  /** Take the higher of every number and the union of every set. The default. */
  | 'merge'
  /** This browser's save wins outright and is pushed over the cloud copy. */
  | 'local'
  /** The cloud save wins outright and replaces what is on this device. */
  | 'cloud';

/** Both sides of a conflict, for the dialog to render. */
export interface MergeConflict {
  local: SaveSummary;
  cloud: SaveSummary;
}

/**
 * Read the three headline numbers out of a progress blob and an economy blob.
 *
 * Deliberately total: every field is optional on the way in, because this runs
 * against whatever a second device happens to have written, including a blob
 * from a build that predates a field.
 */
export function summarise(progress: unknown, economy: unknown): SaveSummary {
  const p = isPlainObject(progress) ? progress : {};
  const e = isPlainObject(economy) ? economy : {};
  return {
    level: numberOf(p['level']),
    xp: numberOf(p['xp']),
    gold: numberOf(e['gold']),
    achievements: Array.isArray(p['achievements']) ? p['achievements'].length : 0,
  };
}

/** True when a save has anything in it worth protecting. */
export function hasProgress(summary: SaveSummary): boolean {
  return summary.xp > 0 || summary.achievements > 0 || summary.gold > 0;
}

/**
 * Is this a conflict worth stopping for?
 *
 * Only when both sides hold progress *and* neither is a superset of the other.
 * A cloud save strictly ahead of this browser on every number has nothing to ask
 * about — merging, loading the cloud and keeping the best all produce the same
 * result, and a dialog offering three buttons that do the same thing is worse
 * than no dialog. The question is only real when each side has something the
 * other does not.
 */
export function isConflict(local: SaveSummary, cloud: SaveSummary): boolean {
  if (!hasProgress(local) || !hasProgress(cloud)) return false;

  const localAhead = local.xp > cloud.xp || local.gold > cloud.gold
    || local.achievements > cloud.achievements || local.level > cloud.level;
  const cloudAhead = cloud.xp > local.xp || cloud.gold > local.gold
    || cloud.achievements > local.achievements || cloud.level > local.level;

  return localAhead && cloudAhead;
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Firestore envelope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a synced blob looks like as a document.
 *
 * The payload is nested under `v` rather than spread across the document,
 * because `easter-eggs-found` is a bare JSON array and Firestore documents are
 * maps — a top-level array has nowhere to go. Wrapping every blob the same way
 * costs one key and means the write path has no special case in it.
 */
export interface BlobEnvelope {
  v: unknown;
  updatedAt: string;
}

export function wrapBlob(value: unknown): BlobEnvelope {
  return { v: value, updatedAt: new Date().toISOString() };
}

/** The payload out of an envelope, tolerating a document written before it existed. */
export function unwrapBlob(data: unknown): unknown {
  if (isPlainObject(data) && 'v' in data) return data['v'];
  return data ?? null;
}
