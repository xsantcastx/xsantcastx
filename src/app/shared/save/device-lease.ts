/**
 * device-lease.ts — which device is allowed to write the account's save.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A LEASE, WHEN THE MERGE RULES ALREADY CONVERGE
 * ─────────────────────────────────────────────────────────────────────────────
 * Every blob in the save already reconciles: counters take the higher, sets take
 * the union, and the ledger replays an operation log in HLC order. Two devices
 * writing at once therefore *converge* — that was the whole subject of the two
 * releases before this one, and none of it is being replaced here.
 *
 * Converging is not the same as being understandable. A phone left open on a
 * bedside table keeps settling idle Gold and pushing it every few seconds, so a
 * visitor playing on a desktop sees numbers move that they did not move, and a
 * reset taken on one device races a push from the other. The merge is right in
 * every one of those cases and the visitor still cannot tell what is happening.
 *
 * So this narrows *who writes*, not what a write means. One device holds the
 * lease and syncs exactly as it always did; the others keep playing locally,
 * keep reading the cloud, and hold their queue until they are handed the lease.
 * Nothing here can lose data: a passive device's writes are still recorded
 * locally and still flushed — later, through the same merge that would have
 * accepted them anyway.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EXPIRY IS WALL-CLOCK, AND WHY THAT IS SAFE HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * The ledger deliberately never decides a merge on wall time — clocks disagree
 * between devices and a skewed phone would rewrite history. A lease is the one
 * place wall time is the right instrument, because the question is not "which
 * write happened first" but "has anyone touched this in the last two minutes",
 * and the fallback is benign: a device with a fast clock declares a live lease
 * expired, takes over, and the displaced device notices on its next heartbeat
 * and drops to passive. The worst case is the state this feature already
 * tolerates — two writers under a convergent merge — for one heartbeat.
 *
 * The timestamps are read from the lease document itself rather than each
 * reader's own clock wherever a comparison can be kept inside one device's
 * frame of reference; see {@link isLeaseExpired}.
 */

/** Firestore document id under `users/{uid}/meta`. */
export const LEASE_DOC = 'device-lease';
/** The subcollection both the lease and the reset tombstone live in. */
export const META_COLLECTION = 'meta';

/** localStorage key for this browser's stable identity. */
export const BROWSER_ID_KEY = 'godforge-browser-id';

/**
 * How often the holder re-stamps `heartbeatAt`.
 *
 * Four times inside the expiry window rather than two: a single missed beat —
 * a backgrounded tab, a tunnel, a throttled timer on a phone — must not be
 * enough to hand the save to another device while somebody is still playing.
 */
export const HEARTBEAT_MS = 30_000;

/**
 * How long a lease survives without a heartbeat.
 *
 * Two minutes is chosen against the failure this cannot avoid: a tab that
 * crashes or is force-quit never runs its release, so this timeout is the only
 * thing that frees the save. Shorter would steal the lease from a device that
 * merely fell asleep; longer would leave somebody staring at a read-only banner
 * on their only device.
 */
export const LEASE_TTL_MS = 120_000;

export interface DeviceLease {
  /** Stable per-browser id. Shared by every tab in the same browser profile. */
  deviceId: string;
  /** When this holder first took the lease. */
  acquiredAt: number;
  /** Last proof of life. Expiry is measured from here. */
  heartbeatAt: number;
  /** "Chrome on iPhone". Cosmetic — never used to decide anything. */
  deviceName?: string;
}

/** What this device is allowed to do with the account's save right now. */
export type LeaseRole =
  /** Not signed in, or the lease has not been resolved yet. Local play only. */
  | 'unknown'
  /** This device holds the lease: reads and writes the cloud as normal. */
  | 'active'
  /** Another device holds it: reads the cloud, queues its own writes. */
  | 'passive';

export interface LeaseState {
  role: LeaseRole;
  /** The current holder, when it is not this device. Drives the banner. */
  holder: DeviceLease | null;
}

export const IDLE_LEASE: LeaseState = { role: 'unknown', holder: null };

/**
 * Has `lease` gone stale as of `now`?
 *
 * `now` is the caller's clock, and the comparison is therefore only sound when
 * the caller is also the one that will act on the answer — which it is: the
 * only callers are a device deciding whether it may take the lease, and the
 * holder deciding whether it still has it. A `heartbeatAt` in the future (a
 * holder whose clock runs ahead) reads as "not expired", which is the safe
 * direction: it defers to the device that is plausibly still playing.
 */
export function isLeaseExpired(lease: DeviceLease | null, now: number): boolean {
  if (!lease) return true;
  const beat = Number(lease.heartbeatAt);
  if (!Number.isFinite(beat)) return true;
  return now - beat > LEASE_TTL_MS;
}

/**
 * May `deviceId` take the lease as of `now`?
 *
 * True when nobody holds it, when it is already ours — renewing is the same
 * operation as acquiring, which is what keeps the transaction body one branch —
 * or when the holder has stopped beating.
 */
export function canAcquire(
  lease: DeviceLease | null,
  deviceId: string,
  now: number,
): boolean {
  if (!lease) return true;
  if (lease.deviceId === deviceId) return true;
  return isLeaseExpired(lease, now);
}

/** Coerce a Firestore document into a lease, or null if it is not one. */
export function coerceLease(value: unknown): DeviceLease | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const deviceId = raw['deviceId'];
  if (typeof deviceId !== 'string' || deviceId.length === 0) return null;

  const acquiredAt = Number(raw['acquiredAt']);
  const heartbeatAt = Number(raw['heartbeatAt']);
  const deviceName = raw['deviceName'];

  return {
    deviceId,
    acquiredAt: Number.isFinite(acquiredAt) ? acquiredAt : 0,
    heartbeatAt: Number.isFinite(heartbeatAt) ? heartbeatAt : 0,
    ...(typeof deviceName === 'string' && deviceName.length > 0
      ? { deviceName: deviceName.slice(0, 60) }
      : {}),
  };
}

/**
 * A human name for the device holding the save, from a user-agent string.
 *
 * Deliberately coarse. This exists so a visitor can tell "the phone in my
 * pocket" from "the desktop at work" in one glance at a banner, and every extra
 * token spent on version numbers or engine names makes it worse at that job.
 * It is never parsed back, compared, or used to decide anything.
 */
export function describeDevice(ua: string, platformHint = ''): string {
  const s = `${ua} ${platformHint}`;

  const browser =
    /\bEdgA?\//.test(s) ? 'Edge'
    : /\bOPR\/|\bOpera\b/.test(s) ? 'Opera'
    : /\bFirefox\/|\bFxiOS\//.test(s) ? 'Firefox'
    // Chrome's UA contains "Safari", so Safari is only what is left after it.
    : /\bChrome\/|\bCriOS\//.test(s) ? 'Chrome'
    : /\bSafari\//.test(s) ? 'Safari'
    : 'Browser';

  const platform =
    /\biPhone\b/.test(s) ? 'iPhone'
    : /\biPad\b/.test(s) ? 'iPad'
    // iPadOS 13+ reports itself as a Mac; the touch points give it away, and
    // the caller passes `maxTouchPoints` in the hint for exactly this case.
    : /\bMacintosh\b/.test(s) && /touch:[1-9]/.test(s) ? 'iPad'
    : /\bAndroid\b/.test(s) ? 'Android'
    : /\bMacintosh\b|\bMac OS X\b/.test(s) ? 'Mac'
    : /\bWindows\b/.test(s) ? 'Windows'
    : /\bLinux\b|\bX11\b/.test(s) ? 'Linux'
    : 'Desktop';

  return `${browser} on ${platform}`;
}
