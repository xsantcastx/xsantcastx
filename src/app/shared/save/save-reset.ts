/**
 * save-reset.ts — the tombstone that makes a wipe survive its own sync.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BUG THIS EXISTS TO CLOSE
 * ─────────────────────────────────────────────────────────────────────────────
 * Resetting used to be: delete the local blob, then delete the cloud document.
 * `GameStateGateway.remove()` did both, and on a desktop with a warm connection
 * it worked every time.
 *
 * On a phone it did not, for a reason that has nothing to do with phones being
 * slow. The Firestore SDK is lazy — ~450 kB that deliberately is not in the
 * initial bundle — so `remove()` reaches its `if (!entry || !uid || !fs) return`
 * guard and silently skips the cloud half whenever the SDK has not finished
 * loading, which on a cold mobile load is most of the first few seconds. The
 * offline path had the same shape: the `deleteDoc` rejects, the catch drops the
 * link to 'offline', and the cloud document lives on.
 *
 * Either way the device is left holding exactly the state that `attach()` reads
 * as "this device has nothing and the cloud has a save" — which is
 * indistinguishable from signing in on a fresh browser. So it adopted the cloud
 * copy back, and the visitor watched their progress reappear a minute after
 * they wiped it. The merge was not wrong; it was never told a wipe had happened.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A TIMESTAMP AND NOT A FLAG
 * ─────────────────────────────────────────────────────────────────────────────
 * "This device has reset" is not decidable on its own once there are two
 * devices: the other one may have reset later, and a boolean cannot say which
 * wipe is the current one. A monotone stamp can, and it makes the reconciliation
 * a single comparison that is symmetric in both directions:
 *
 *   local > cloud  → the wipe happened here and has not landed yet. Re-push it:
 *                    the cloud copy is stale by definition, so it is deleted
 *                    rather than merged, and the pull that follows finds nothing.
 *   cloud > local  → somebody wiped the account on another device. A reset is
 *                    account-wide, so this device wipes too, rather than pushing
 *                    its survivors back up and undoing the other device's reset.
 *   equal          → the wipe is settled on both sides. Ordinary merge rules.
 *
 * The stamp is written locally *before* the cloud is touched, which is what
 * makes the whole thing crash-safe: a tab closed in the middle of a reset still
 * carries the intent, and the next `attach()` finishes the job. That ordering
 * is the one part of this file that must not be rearranged for tidiness.
 *
 * Wall-clock rather than a counter, because the two sides are different devices
 * with no shared sequence to draw from. Skew is bounded by the same argument the
 * lease uses: the only thing a wrong clock can do here is decide whose *wipe*
 * won, and both answers are a wiped save.
 */

/** localStorage key holding the millisecond stamp of this device's last wipe. */
export const RESET_STAMP_KEY = 'godforge-reset-at';

/**
 * Where the tombstone lives: `users/{uid}/progress/reset`.
 *
 * In `progress` rather than alongside the device lease in `meta`, and that is a
 * cost decision rather than a taxonomic one. `readAll` already sweeps the
 * `progress` and `economy` collections with one `getDocs` each, and that pair of
 * round trips runs on *every page load of every signed-in visitor*. A tombstone
 * in its own collection would have made it three — a third billed read per page
 * load, forever, to carry one number that is almost always zero. Sitting in a
 * collection that is already being read, it costs nothing.
 *
 * It is not a `StateEntry`, so `resetAll` does not delete it along with the save
 * — which is the point: the tombstone has to outlive the thing it marks.
 */
export const RESET_COLLECTION = 'progress';
export const RESET_DOC = 'reset';

export interface ResetStamp {
  /** Wall-clock ms the wipe was taken. */
  at: number;
  /** Which browser took it. Informational; never used to decide the compare. */
  deviceId?: string;
}

/** What `attach()` should do about the two stamps it is holding. */
export type ResetVerdict =
  /** Neither side has wiped, or both agree it is settled. Merge as usual. */
  | 'none'
  /** This device wiped and the cloud has not caught up. Push the wipe. */
  | 'push-local'
  /** Another device wiped later than this one. Wipe here too. */
  | 'adopt-remote';

/**
 * Compare the two stamps.
 *
 * Absent is zero on both sides, so a brand-new account and an account nobody has
 * ever reset both fall through to 'none' without a special case.
 */
export function resetVerdict(localAt: number, cloudAt: number): ResetVerdict {
  const local = Number.isFinite(localAt) ? localAt : 0;
  const cloud = Number.isFinite(cloudAt) ? cloudAt : 0;
  if (local === cloud) return 'none';
  return local > cloud ? 'push-local' : 'adopt-remote';
}

/** Coerce a Firestore document into a stamp. Anything unreadable is "never". */
export function coerceResetStamp(value: unknown): ResetStamp {
  if (typeof value !== 'object' || value === null) return { at: 0 };
  const raw = value as Record<string, unknown>;
  const at = Number(raw['at']);
  const deviceId = raw['deviceId'];
  return {
    at: Number.isFinite(at) && at > 0 ? at : 0,
    ...(typeof deviceId === 'string' && deviceId.length > 0 ? { deviceId } : {}),
  };
}
