/**
 * local-save-registry.service.ts — the seam that lets the local save be replaced
 * underneath the services that own it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM THIS EXISTS TO SOLVE
 * ─────────────────────────────────────────────────────────────────────────────
 * Eighteen services keep their state in memory and flush it to localStorage.
 * Each of them reads its blob once, on first injection, and never looks again —
 * which is correct for a store only they write to, and catastrophic the moment
 * cloud save merges two devices and rewrites that store underneath them.
 *
 * Cloud save used to handle this by reloading the tab, on the reasoning that a
 * reload is one line and cannot be subtly wrong. It was wrong, and not subtly:
 * `location.reload()` fires `pagehide`, `EconomyService` and `XpService` both
 * flush their stale in-memory ledger on `pagehide`, and so the last write before
 * the tab restarted was always the pre-merge copy. The reload then read it back.
 * Every device adopted its own stale save, both reported "Synced", and a
 * visitor's Gold never moved between a phone and a PC. `EconomyService` did not
 * even need the unload: its one-second idle tick flushes through a five-second
 * throttle, so on most sign-ins the merged blob was overwritten inside a second,
 * long before the reload it was waiting for.
 *
 * So the services are asked directly instead. An owner registers two callbacks
 * for its blob: {@link SaveOwner.flush} settles anything it is holding so the
 * merge reads the freshest copy, and {@link SaveOwner.rehydrate} re-reads the
 * blob and republishes it so the in-memory copy *is* the merged copy. Cloud save
 * calls flush before it reads and rehydrate in the same tick as the write, which
 * leaves no window for a stale flush to land in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY AN UNREGISTERED KEY NEEDS NOTHING
 * ─────────────────────────────────────────────────────────────────────────────
 * Owners register as they hydrate, not as they are constructed. A service that
 * has not hydrated holds no copy of its blob, so there is nothing stale to
 * correct — it will read whatever is on disk the first time somebody asks it
 * for anything, and by then that is the merged value. "No owner" and "nothing to
 * do" are the same state, which is what lets the reload go away entirely rather
 * than being kept as a fallback for the blobs nobody has touched yet.
 *
 * Deliberately dependency-free. Every game service injects it, and cloud save is
 * the only consumer of the other half — a registry living in the cloud-save
 * folder would have every one of those services importing from the feature they
 * were carefully built not to know about.
 */
import { Injectable } from '@angular/core';

/** What the service that owns a blob offers the code that has to rewrite it. */
export interface SaveOwner {
  /**
   * Settle any write this service is holding, synchronously.
   *
   * Optional, because most owners write through on every mutation and have
   * nothing in flight. The ones that throttle — the ledger's five-second window,
   * progression's 800ms debounce — need it: without it the merge reads a copy
   * that is a few seconds behind memory, and those few seconds are then dropped
   * by the rehydrate that follows.
   */
  flush?(): void;
  /**
   * Re-read the blob from localStorage and republish it.
   *
   * Called immediately after cloud save has written a merged blob, in the same
   * tick as the write. Implementations must cancel any pending write of their own
   * first — a trailing timer that fires after this has re-read would put the
   * pre-merge state straight back on disk.
   */
  rehydrate(): void;
}

@Injectable({ providedIn: 'root' })
export class LocalSaveRegistry {
  private readonly owners = new Map<string, SaveOwner>();

  /**
   * Claim a localStorage key. Called by the owning service at the end of its own
   * hydration, so that being registered always means "is holding a copy".
   *
   * Last registration wins. Two services claiming one key would be a bug in the
   * services rather than something this can arbitrate, and every key in
   * `SYNCED_BLOBS` has exactly one owner — the model spec pins that list.
   */
  register(key: string, owner: SaveOwner): void {
    this.owners.set(key, owner);
  }

  /** Release a key. For owners whose lifetime is a route rather than the tab. */
  unregister(key: string, owner: SaveOwner): void {
    // Identity-checked so a component tearing down after its replacement has
    // already registered cannot unclaim the live owner.
    if (this.owners.get(key) === owner) this.owners.delete(key);
  }

  /** True when a live service is holding an in-memory copy of `key`. */
  hasOwner(key: string): boolean {
    return this.owners.has(key);
  }

  /**
   * Settle `key`'s owner so the copy on disk is current before it is read.
   *
   * A throwing owner is swallowed on purpose: this runs on the sign-in path, and
   * one service failing to flush must not abandon the sync for the other
   * seventeen. The cost of a swallowed failure is that the merge reads a slightly
   * stale blob, which the monotone merge rules then resolve upward anyway.
   */
  flush(key: string): void {
    const owner = this.owners.get(key);
    if (!owner?.flush) return;
    try {
      owner.flush();
    } catch { /* see above */ }
  }

  /**
   * Push the blob now on disk back into the service that owns it.
   *
   * Returns false when nobody owns the key — which is not a failure, it means
   * nobody is holding a stale copy either. Callers use it for logging, not for
   * control flow.
   */
  rehydrate(key: string): boolean {
    const owner = this.owners.get(key);
    if (!owner) return false;
    try {
      owner.rehydrate();
    } catch {
      // A service that cannot re-read keeps what it had, which is the state the
      // visitor is already looking at. Strictly better than a half-applied one.
      return false;
    }
    return true;
  }
}
