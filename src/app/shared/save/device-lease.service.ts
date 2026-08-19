/**
 * device-lease.service.ts — holds, renews and releases the write lease.
 *
 * The rules and the reasoning behind them are in `device-lease.ts`; this is the
 * part that talks to Firestore and to the tab lifecycle.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EVERY ACQUISITION IS A TRANSACTION
 * ─────────────────────────────────────────────────────────────────────────────
 * "Both devices open simultaneously: first one to write the lease wins" is only
 * true if the read and the write are one operation. A read-then-write would let
 * two devices both read "expired", both decide they may take it, and both write
 * — leaving each convinced it is active, which is precisely the state the lease
 * exists to prevent. `runTransaction` re-reads and retries on contention, so the
 * loser sees the winner's document and settles into passive on the same round
 * trip it tried to acquire in.
 *
 * A renewal goes through the same transaction rather than a cheaper `setDoc`,
 * because a renewal is where the lease is *lost*: a device that was asleep past
 * the TTL and wakes up must discover the takeover, not stamp over it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE HEARTBEAT IS NOT A SNAPSHOT LISTENER
 * ─────────────────────────────────────────────────────────────────────────────
 * `onSnapshot` on the lease document would tell a passive device the instant the
 * holder let go, which sounds strictly better. It costs an open stream per tab
 * for the life of the session, on a document that changes twice a minute at
 * most, for a feature whose entire purpose is to keep an idle second device from
 * being expensive. A passive device polls on the same 30s beat instead, and the
 * banner's "Play Here" button is the path for anybody who does not want to wait.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { FirestoreHandle } from '../lazy-firestore.service';
import {
  BROWSER_ID_KEY,
  DeviceLease,
  HEARTBEAT_MS,
  IDLE_LEASE,
  LEASE_DOC,
  LeaseState,
  META_COLLECTION,
  canAcquire,
  coerceLease,
  describeDevice,
} from './device-lease';

@Injectable({ providedIn: 'root' })
export class DeviceLeaseService {
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private uid: string | null = null;
  private fs: FirestoreHandle | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private id: string | null = null;
  private inFlight: Promise<void> | null = null;

  private readonly state$$ = new BehaviorSubject<LeaseState>(IDLE_LEASE);
  /** The banner renders off this; the gateway gates its cloud writes on it. */
  readonly state$: Observable<LeaseState> = this.state$$.asObservable();

  get state(): LeaseState {
    return this.state$$.value;
  }

  /**
   * True when this device may write the account's save.
   *
   * 'unknown' counts as writable on purpose. It is the state before the lease
   * has been resolved — and, more importantly, the state when Firestore could
   * not be reached at all. Refusing to sync because the lease is unreadable
   * would turn a network blip into silent data loss, which is a strictly worse
   * failure than the interleaved-writes problem the lease is here to tidy up.
   * The merge rules are still underneath, and they still converge.
   */
  get mayWrite(): boolean {
    return this.state$$.value.role !== 'passive';
  }

  /**
   * This browser's stable id.
   *
   * Deliberately its own key rather than the economy ledger's `godforge-device-id`:
   * that one is *rotated* by `EconomyService.reset()` so a wiped ledger cannot
   * have its old operations replayed onto it, and a lease that changed identity
   * every time somebody reset would release itself mid-session.
   */
  deviceId(): string {
    if (this.id) return this.id;
    if (!this.isBrowser) return '';
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(BROWSER_ID_KEY);
    } catch { /* private mode */ }

    if (!stored) {
      stored = newId();
      try {
        localStorage.setItem(BROWSER_ID_KEY, stored);
      } catch {
        // Private mode: the id lives for this session only, so this browser
        // takes the lease afresh on every load. Correct, just chattier.
      }
    }
    this.id = stored;
    return stored;
  }

  /** "Chrome on iPhone", for the banner. */
  deviceName(): string {
    if (!this.isBrowser) return '';
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const hint = `${nav.userAgentData?.platform ?? ''} touch:${nav.maxTouchPoints ?? 0}`;
    return describeDevice(nav.userAgent ?? '', hint);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Session
  // ───────────────────────────────────────────────────────────────────────────

  /** Bind to an account and try to take the lease. Called from `attach()`. */
  async begin(uid: string, fs: FirestoreHandle): Promise<LeaseState> {
    if (!this.isBrowser) return IDLE_LEASE;
    this.uid = uid;
    this.fs = fs;
    const state = await this.acquire(false);
    this.startHeartbeat();
    return state;
  }

  /**
   * Take the lease from whoever holds it. The banner's "Play Here".
   *
   * The one path that ignores an unexpired holder, because it is the one path
   * where a person has said, in as many words, that the device in their hand is
   * the one they are playing on.
   */
  async claim(): Promise<LeaseState> {
    const state = await this.acquire(true);
    this.startHeartbeat();
    return state;
  }

  /**
   * Let go, so another device does not have to wait out the TTL.
   *
   * Best-effort by nature: this runs on `pagehide`, where a promise is not
   * guaranteed to be awaited and a rejected one must not surface. A release that
   * does not land costs the next device two minutes, which is exactly the case
   * the TTL is sized for.
   */
  release(): void {
    this.stopHeartbeat();
    const { uid, fs } = this;
    const deviceId = this.deviceId();
    this.publish(IDLE_LEASE);
    if (!uid || !fs || !deviceId) return;

    this.zone.runOutsideAngular(() => {
      void fs.api
        .runTransaction(fs.db, async tx => {
          const ref = fs.api.doc(fs.db, 'users', uid, META_COLLECTION, LEASE_DOC);
          const snap = await tx.get(ref);
          const held = coerceLease(snap.exists() ? snap.data() : null);
          // Only ever release our own. A tab closing after another device has
          // already taken over must not delete the new holder's lease.
          if (held && held.deviceId === deviceId) tx.delete(ref);
        })
        .catch(() => { /* leaving; the TTL is the backstop */ });
    });
  }

  /** Unbind entirely. Sign-out and `detach()` are the callers. */
  end(): void {
    this.release();
    this.uid = null;
    this.fs = null;
  }

  /**
   * Re-check the lease now — a tab coming back into view.
   *
   * The holder renews and keeps it; a passive device finds out whether the
   * holder has gone away while this tab was hidden.
   */
  async refresh(): Promise<LeaseState> {
    if (!this.uid || !this.fs) return this.state;
    return this.acquire(false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The transaction
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Acquire, renew, or discover the holder — one transaction for all three.
   *
   * Serialised on `inFlight` so a visibility change landing on top of a
   * heartbeat cannot run two transactions against the same document.
   */
  private acquire(force: boolean): Promise<LeaseState> {
    if (this.inFlight) {
      return this.inFlight.then(() => this.runAcquire(force));
    }
    const run = this.runAcquire(force);
    this.inFlight = run.then(() => undefined, () => undefined)
      .finally(() => { this.inFlight = null; });
    return run;
  }

  private async runAcquire(force: boolean): Promise<LeaseState> {
    const uid = this.uid;
    const fs = this.fs;
    const deviceId = this.deviceId();
    if (!uid || !fs || !deviceId) return this.state;

    const name = this.deviceName();

    try {
      const outcome = await this.zone.runOutsideAngular(() =>
        fs.api.runTransaction(fs.db, async (tx): Promise<LeaseState> => {
          const ref = fs.api.doc(fs.db, 'users', uid, META_COLLECTION, LEASE_DOC);
          const snap = await tx.get(ref);
          const held = coerceLease(snap.exists() ? snap.data() : null);
          const now = Date.now();

          if (!force && !canAcquire(held, deviceId, now)) {
            // Somebody else is playing. Read-only until they stop or we claim.
            return { role: 'passive', holder: held };
          }

          const mine: DeviceLease = {
            deviceId,
            // Renewing keeps the original acquisition time, so the banner on the
            // other device can say how long this one has been playing.
            acquiredAt: held?.deviceId === deviceId ? held.acquiredAt || now : now,
            heartbeatAt: now,
            deviceName: name,
          };
          tx.set(ref, mine);
          return { role: 'active', holder: mine };
        }),
      );
      this.publish(outcome);
      return outcome;
    } catch {
      // Offline, or the rules refused. Fall back to 'unknown' rather than
      // 'passive': see `mayWrite`. A device that cannot read the lease must not
      // be locked out of its own cloud save.
      this.publish(IDLE_LEASE);
      return IDLE_LEASE;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Heartbeat
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * One interval serves both roles.
   *
   * The holder uses it to prove it is alive. A passive device uses the same beat
   * to poll for the holder going away — same transaction, same cost, and it
   * means there is one timer to reason about rather than two that can disagree.
   */
  private startHeartbeat(): void {
    if (!this.isBrowser || this.timer !== null) return;
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          // A backgrounded tab is not being played on. Skipping the beat is what
          // lets the lease expire for a phone left in a pocket, without waiting
          // for a `pagehide` that a suspended tab may never fire.
          return;
        }
        void this.acquire(false).catch(() => { /* handled in runAcquire */ });
      }, HEARTBEAT_MS);
    });
  }

  private stopHeartbeat(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private publish(next: LeaseState): void {
    const prev = this.state$$.value;
    if (prev.role === next.role && prev.holder?.deviceId === next.holder?.deviceId) return;
    // In the zone: the banner is bound to this and would otherwise appear a
    // change-detection pass late, or not at all on a device that is idle.
    this.zone.run(() => this.state$$.next(next));
  }
}

function newId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
