/**
 * whereabouts.model.ts — where a character last stood, as a cloud-synced, per-character progress document.
 *
 * Owner, 2026-10-21: position followed a device, not a character (`eclipse-play-world-v1` is device-local), so a
 * Keeper picked up on a phone woke wherever the phone last left them. The play view still writes that device blob
 * every two seconds (cheap, local, exact); this is its synced twin, written far less often:
 *
 *   - `WHEREABOUTS_KEY` is a SYNCED_BLOBS entry (`users/{uid}/progress/whereabouts`, or
 *     `users/{uid}/characters/{id}/progress/whereabouts` for characters #2…#5: character-scope.ts), so it travels with
 *     the character's other `progress/*` documents through GameStateGateway.
 *   - Writes are throttled by {@link WhereaboutsThrottle}: on an area change (another continent or floor), at most once
 *     a minute while the Keeper walks, never while they stand still, and on `pagehide` through the gateway's existing
 *     owner flush (LocalSaveRegistry). Never once a frame: the cloud sees at most ~1 write a minute of play.
 *   - Two devices merge by {@link mergeWhereabouts}: the newest `at` wins, whole (a place is one fact, never mixed
 *     field by field).
 *
 * Pure: no Angular, no storage. The service (whereabouts.service.ts) owns the clock and the gateway.
 */

/** The synced key (per character: character-scope.ts maps it onto the active character). */
export const WHEREABOUTS_KEY = 'eclipse-whereabouts';

/** The longest a moving Keeper's place waits before it goes to the cloud. */
export const WHEREABOUTS_EVERY_MS = 60_000;
/** The shortest gap between two writes, even across area changes (a Keeper bouncing on a stair is not ten writes). */
export const WHEREABOUTS_MIN_GAP_MS = 5_000;
/** A tile, in world pixels: moving less than one is not moving. */
const TILE = 16;

/** Where the top-down Keeper stands: the td-engine's `whereabouts`. */
export interface Place {
  continent: string;
  level: string;
  x: number;
  y: number;
}

export interface Whereabouts {
  version: 1;
  /** The top-down place. */
  td: Place;
  /** When it was taken (epoch ms): the merge's only question. */
  at: number;
}

/** A place read from storage or the engine, or null when it is not one. */
export function coercePlace(raw: unknown): Place | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const continent = r['continent'], level = r['level'], x = r['x'], y = r['y'];
  if (typeof continent !== 'string' || !continent || typeof level !== 'string' || !level) return null;
  if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) return null;
  return { continent, level, x, y };
}

/** A whereabouts blob, or null for anything that is not one (a missing stamp is not one: it could never win a merge honestly). */
export function coerceWhereabouts(raw: unknown): Whereabouts | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const td = coercePlace(r['td']);
  const at = r['at'];
  if (!td || typeof at !== 'number' || !Number.isFinite(at) || at <= 0) return null;
  return { version: 1, td, at };
}

/** The area a place is in: a continent's surface or one of its floors. Crossing into another is worth a write. */
export function areaOf(p: Place): string {
  return `${p.continent}|${p.level}`;
}

/** The place to the tile: a change smaller than this is not a move. */
export function tileOf(p: Place): string {
  return `${areaOf(p)}|${Math.round(p.x / TILE)}|${Math.round(p.y / TILE)}`;
}

/**
 * The cross-device merge: the newest `at` wins, whole. A tie keeps the local copy (the device writing it is the one
 * being played). Garbage on either side loses to a real place; garbage on both is null.
 */
export function mergeWhereabouts(remote: unknown, local: unknown): Whereabouts | null {
  const r = coerceWhereabouts(remote), l = coerceWhereabouts(local);
  if (!r) return l;
  if (!l) return r;
  return r.at > l.at ? r : l;
}

/**
 * Which place to wake in: this device's own last place (`local`, the device blob, stamped `at` when it has one) or the
 * synced one, whichever is newer. A device blob without a stamp predates the sync, so the synced place (written from
 * some device's play) wins over it.
 */
export function pickWakePlace(local: { td?: unknown; tdAt?: unknown } | null, synced: unknown): Place | null {
  const mine = coercePlace(local?.td);
  const mineAt = typeof local?.tdAt === 'number' && Number.isFinite(local.tdAt) ? local.tdAt : 0;
  const cloud = coerceWhereabouts(synced);
  if (cloud && (!mine || cloud.at > mineAt)) return cloud.td;
  return mine;
}

/**
 * The write throttle. `offer(place, now)` is called as often as the play view likes (it calls every two seconds while
 * the Keeper moved a tile); it answers whether that place should be written to the synced key now:
 *
 *   - the first place of the page: yes (the cloud learns where this session starts);
 *   - another area than the last written one: yes, once {@link WHEREABOUTS_MIN_GAP_MS} has passed since the last write;
 *   - another tile in the same area: yes once {@link WHEREABOUTS_EVERY_MS} has passed since the last write;
 *   - the same tile as the last written one: never.
 *
 * A place it holds back stays `pending` until a later offer or `takePending()` (the pagehide flush) writes it.
 */
export class WhereaboutsThrottle {
  private lastAt = -Infinity;
  private lastArea = '';
  private lastTile = '';
  private held: { place: Place; at: number } | null = null;

  offer(place: Place, now: number): boolean {
    const tile = tileOf(place);
    if (tile === this.lastTile) {
      this.held = null;
      return false;
    }
    const since = now - this.lastAt;
    const due = !this.lastTile
      || (areaOf(place) !== this.lastArea && since >= WHEREABOUTS_MIN_GAP_MS)
      || since >= WHEREABOUTS_EVERY_MS;
    if (!due) {
      this.held = { place, at: now };
      return false;
    }
    this.sent(place, now);
    return true;
  }

  /** A place was written (by `offer` or a flush). */
  sent(place: Place, now: number): void {
    this.lastAt = now;
    this.lastArea = areaOf(place);
    this.lastTile = tileOf(place);
    this.held = null;
  }

  /** The place held back since the last write (and when it was taken), if any: the pagehide flush writes it. */
  get pending(): { place: Place; at: number } | null { return this.held; }
}
