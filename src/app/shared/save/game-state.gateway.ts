/**
 * game-state.gateway.ts — the one place the Godforge save is read and written.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED, AND WHAT "SOURCE OF TRUTH" MEANS HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * Nineteen services used to own their own `localStorage.getItem` and
 * `localStorage.setItem`, and cloud save copied those blobs up and down around
 * them. That worked, and it put the authority in the wrong place: the browser
 * was the record and the cloud was a backup of it, so every new surface that
 * wants to read a visitor's state — a leaderboard, a Grand Exchange, a guild
 * roster — would have had to ask nineteen services for their private copies.
 *
 * Now every read and every write goes through here, and when a visitor is signed
 * in Firestore is the record. Signed out, or with Firestore unreachable, this
 * degrades to exactly the localStorage-only behaviour the site has always had,
 * which is what keeps 126 tool pages working for the anonymous majority who will
 * never sign in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY LOCALSTORAGE IS STILL THE THING SERVICES READ
 * ─────────────────────────────────────────────────────────────────────────────
 * `read()` is synchronous and answers from localStorage, and that is deliberate
 * rather than a shortcut. Every one of these services hydrates on first
 * injection — the header's XP bar, the currency rail and the Forge Flame all read
 * during first paint — and Firestore cannot answer synchronously: it is a network
 * round trip behind a ~450 kB SDK chunk that is deliberately kept out of the
 * initial bundle. An `await` on that path would put a network hop in front of the
 * first frame of every page, signed in or not.
 *
 * So this is a read-through cache, and the authority is asserted at a different
 * moment: {@link attach} pulls the cloud copy on sign-in and on every load,
 * reconciles it, writes the result into the cache, and pushes it into the live
 * services through `LocalSaveRegistry`. After that the cache *is* the
 * authoritative state, byte for byte, and reading it is reading the cloud.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY WRITES REACH THE CACHE FIRST AND THE CLOUD SECOND
 * ─────────────────────────────────────────────────────────────────────────────
 * The brief asked for writes to reach Firestore first and mirror to localStorage
 * after. This does the reverse, on purpose, and the brief's own next requirement
 * is the reason: cloud writes are debounced and batched, and a debounced write
 * cannot also be the first one. Beyond the contradiction, awaiting the network
 * before recording a purchase locally would mean a tab closed mid-round-trip
 * loses the purchase, and it would make `buyUpgrade()` and every one of its
 * callers async for no gain.
 *
 * The local write is therefore synchronous and unconditional — it is what makes
 * the game crash-safe and playable on a train — and the cloud write follows
 * within seconds. Authority is not about which store is written first; it is
 * about which store wins when they disagree, and that is settled in
 * {@link attach}.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A FLUSH STILL READS BEFORE IT WRITES
 * ─────────────────────────────────────────────────────────────────────────────
 * A batch that wrote this device's state blind would be last-writer-wins across
 * a visitor's devices, which is the bug the previous two releases were spent on.
 * So a flush reads the documents it is about to write, merges under the same
 * monotone rules `attach` uses, and writes the result. Only the dirty keys are
 * read — usually one or two — so the steady state costs a couple of reads and a
 * single batched write, rather than the nineteen reads and nineteen writes the
 * old per-blob push loop cost.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { FirestoreHandle } from '../lazy-firestore.service';
import {
  PROGRESS_KEY,
  ProgressState,
  mergeProgress,
  migrateProgress,
  withLevel,
} from '../gamification/gamification.model';
// The state registry and the merge rules live in cloud-save.model.ts and are
// imported rather than moved. It is a leaf: pure data and pure functions, no
// Angular and no services, so depending on it costs this file nothing — and the
// merge rules are the most carefully-reasoned code in the feature, with a spec
// that pins every key. Moving them to prettify the folder layout would have put
// review surface on the one part nobody should be casually re-typing.
import {
  MergeConflict,
  MergeStrategy,
  SYNCED_BLOBS,
  SyncedBlob,
  isConflict,
  mergeDeep,
  summarise,
  unwrapBlob,
  wrapBlob,
  stripUndefined,
} from '../cloud-save/cloud-save.model';
import {
  DEVICE_ID_KEY,
  acknowledgeAndMaybeCompact,
  coerceLedger,
} from '../economy/economy-ops';
import { LocalSaveRegistry } from './local-save-registry.service';
import { DeviceLeaseService } from './device-lease.service';
import {
  RESET_COLLECTION,
  RESET_DOC,
  RESET_STAMP_KEY,
  coerceResetStamp,
  resetVerdict,
} from './save-reset';

/**
 * The ledger's key, for the two-number summary the merge dialog shows.
 *
 * Spelled out rather than imported from `EconomyService`: that service injects
 * this gateway, so importing it back would be a cycle — and the constant is
 * pinned by the model spec, which fails if the registry ever stops carrying it.
 */
export const ECONOMY_STATE_KEY = 'godforge-economy';

/**
 * One unit of saved state: a localStorage key and the document it belongs in.
 *
 * `enveloped` is the one field that is not simply inherited from `SyncedBlob`,
 * and it exists for a rule rather than for a shape. Every other blob is stored
 * as `{ v, updatedAt }` because `easter-eggs-found` is a bare JSON array and a
 * Firestore document has to be a map. Progression is stored flat, because
 * `firestore.rules` enforces `request.resource.data.xp >= resource.data.xp` on
 * `users/{uid}/progress/state` and that condition reads a *top-level* `xp`.
 * Wrapping it would move the field to `v.xp`, the `!('xp' in ...)` escape in the
 * rule would quietly pass every write, and the guard against a stale device
 * deleting somebody's XP would be gone without a single error to show for it.
 */
export interface StateEntry {
  key: string;
  collection: 'progress' | 'economy';
  doc: string;
  label: string;
  merge?: (remote: unknown, local: unknown) => unknown;
  enveloped: boolean;
  /**
   * Stamp the signed-in account onto a resolved payload.
   *
   * Only progression carries an identity, and it has to be the uid this device
   * is attached to rather than whichever of the two copies happened to win the
   * merge — adopting the signed-in identity is most of what attaching means.
   */
  identify?: (value: unknown, uid: string) => unknown;
  /**
   * Fields to ignore when asking "did this actually change?".
   *
   * Progression's `updatedAt` is stamped fresh by every merge, so comparing the
   * serialised forms would report a change on *every* pull — including the
   * overwhelming majority where the two copies already agree. That was
   * previously worth one gratuitous page reload per signed-in session; here it
   * would be a Firestore write and a needless rehydrate on every page load of
   * every signed-in visitor, which is a bill rather than an annoyance.
   *
   * Only the comparison ignores these. The payload that gets written keeps them.
   */
  volatile?: readonly string[];
}

/**
 * Every key the gateway owns: the eighteen satellite blobs plus progression.
 *
 * Progression is appended here rather than added to `SYNCED_BLOBS` so that the
 * model spec's pinned key list keeps meaning what it says — it asserts what the
 * *satellite* registry holds, and a nineteenth entry appearing in it would read
 * as a blob that had been forgotten and then added rather than as the one that
 * always had its own path.
 */
/**
 * This device's save as it stood just before the last sign-in merge.
 *
 * Never synced: it is a local before picture, not part of the account.
 */
export const SAVE_BACKUP_KEY = 'godforge-save-backup';

/**
 * localStorage key holding deletions that have not reached the cloud yet.
 * See `remove()` for why this is on disk rather than in memory.
 */
const PENDING_DELETE_KEY = 'godforge-pending-deletes';

export const STATE_ENTRIES: readonly StateEntry[] = [
  ...SYNCED_BLOBS.map((b: SyncedBlob): StateEntry => ({
    key: b.key,
    collection: b.collection,
    doc: b.doc,
    label: b.label,
    merge: b.merge,
    enveloped: true,
  })),
  {
    key: PROGRESS_KEY,
    collection: 'progress',
    doc: 'state',
    label: 'progression',
    // Progression keeps its own hand-written merge rather than falling through to
    // the structural one, and the reason is a field the structural rule gets
    // quietly and permanently wrong. `mergeDeep` takes the greater of two
    // strings, which is right for the ISO instants and period keys everywhere
    // else in the save — but `createdAt` is the visitor's "first struck" date,
    // where the *earlier* value is the true one. Left to the structural rule,
    // every reconciliation would walk that date forward, and the Forge would
    // slowly forget how long somebody had been here. `mergeProgress` also
    // recomputes the denormalised rank from the merged XP, which no generic rule
    // can know to do.
    merge: (remote, local) => mergeProgress(migrateProgress(remote), migrateProgress(local)),
    identify: (value, uid) =>
      isRecord(value) ? { ...value, userId: uid } : value,
    volatile: ['updatedAt'],
    enveloped: false,
  },
];

const BY_KEY = new Map<string, StateEntry>(STATE_ENTRIES.map(e => [e.key, e]));

/** Keys the gateway owns. Anything else is not saved state and is refused. */
export function isStateKey(key: string): boolean {
  return BY_KEY.has(key);
}

/**
 * How long a write waits for company before it goes up.
 *
 * Four seconds. The Forge Flame can be struck twice a second and idle Gold
 * settles once a second, so an unbatched write-per-change would be a document
 * write per second for the life of the tab — the thing the brief specifically
 * asked not to do. Four seconds collapses a burst of clicking into one batch
 * while still being short enough that closing the tab rarely beats it, and
 * `pagehide` covers the case where it does.
 */
const FLUSH_DEBOUNCE_MS = 4_000;

/**
 * The longest a change may sit unsent while the visitor keeps playing.
 *
 * A pure trailing debounce never fires during sustained activity, and sustained
 * activity is exactly when somebody is earning the progress they would be
 * upset to lose. Twenty seconds is the ceiling: a player clicking continuously
 * still syncs three times a minute.
 */
const FLUSH_MAX_WAIT_MS = 20_000;

/** Backoff for a flush that failed. Doubles to the cap, resets on success. */
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;

/**
 * Floor on the gap between two full pulls inside one page load.
 *
 * A pull reads every document under the account, and returning to a tab is what
 * triggers one. A visitor alt-tabbing between a browser and an editor generates
 * that event far more often than their progress on another device actually
 * changes, so without a floor one restless afternoon would cost more reads than
 * the rest of the site spends in a day.
 *
 * A minute is the balance: long enough that flicking between windows costs
 * nothing after the first look, short enough that the case this exists for —
 * putting a phone down and turning to a desktop — is always outside the window.
 * Signing in does not wait on it at all; that path attaches, which pulls on the
 * spot.
 */
const REPULL_INTERVAL_MS = 60_000;

/** Where the save currently lives, for the sync chip and the HUD. */
export type CloudLink =
  /** Signed out. localStorage is the whole story, which is a fine way to live. */
  | 'local'
  /** Attached and pulling, or flushing. */
  | 'syncing'
  /** Attached, and everything on this device is up. */
  | 'synced'
  /** Attached but unreachable. Playing offline; the queue is holding. */
  | 'offline'
  /** Signed in and current, but another device holds the write lease. */
  | 'waiting';

export interface AttachResult {
  /** Keys whose local copy the cloud moved. Already pushed into their owners. */
  adopted: string[];
  /** True when the account had no save up there and this device seeded it. */
  seeded: boolean;
}

@Injectable({ providedIn: 'root' })
export class GameStateGateway {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly owners = inject(LocalSaveRegistry);
  private readonly leases = inject(DeviceLeaseService);
  private readonly zone = inject(NgZone);

  /** Set while attached to an account. Null when signed out. */
  private uid: string | null = null;
  private fs: FirestoreHandle | null = null;

  /** Keys written locally since the last successful flush. */
  private readonly dirty = new Set<string>();
  /**
   * What the cloud held for each key at the last read, serialised.
   *
   * Only used to skip a write that would change nothing. Deliberately not used
   * to skip the *read* before a write — that read is what makes concurrent
   * devices safe, and an optimisation that removed it would reintroduce
   * last-writer-wins.
   */
  private readonly lastRemote = new Map<string, string>();

  /** Epoch ms of the last full pull, so returning to a tab is throttled. */
  private lastPullAt = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the oldest currently-dirty write happened, for the max-wait cap. */
  private oldestDirtyAt = 0;
  private flushing: Promise<void> | null = null;
  private retryMs = RETRY_BASE_MS;
  /**
   * Set when the visitor overrules the structural merge. Retry, pagehide and
   * online must not silently turn Keep This Device into Merge Best.
   * Cleared once a flush lands with an empty queue, or on detach.
   */
  private overrideStrategy: MergeStrategy | null = null;
  /**
   * True from the start of attach until the merge choice is known (or attach
   * fails). `markDirty` still queues; `scheduleFlush` does not fire. That is
   * what stops a four-second upload swallowing Keep This Device, without
   * leaving the gateway unattached if the first pull is offline.
   */
  private decisionPending = false;

  private readonly link$$ = new BehaviorSubject<CloudLink>('local');
  readonly link$: Observable<CloudLink> = this.link$$.asObservable();
  get link(): CloudLink { return this.link$$.value; }

  /** True once this gateway is the cloud's local face rather than just a cache. */
  get attached(): boolean { return this.uid !== null; }

  /** How many writes are waiting to go up. Rendered by the sync chip. */
  get pending(): number { return this.dirty.size; }

  // ───────────────────────────────────────────────────────────────────────────
  // The synchronous surface every service uses
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * The parsed state for `key`, or null when there is none.
   *
   * Null and unparseable are deliberately the same answer. Every caller already
   * treats "nothing stored" as "start from the empty blob", and a blob that will
   * not parse is one the owning service is about to replace anyway — so throwing
   * here would only move a corrupt-storage failure into a template binding.
   */
  read(key: string): unknown {
    const raw = this.readRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  readRaw(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      // Safari private mode throws on read. The game runs from memory.
      return null;
    }
  }

  /**
   * Record `value` as the state for `key`.
   *
   * Synchronous into the cache, queued for the cloud. Returns immediately, so
   * every existing caller — `buyUpgrade`, `award`, `strike` — stays synchronous.
   */
  write(key: string, value: unknown): void {
    if (!this.isBrowser) return;
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch {
      // A cyclic or unserialisable blob is a bug in the caller, and dropping it
      // here is better than writing "undefined" over a good save.
      return;
    }
    this.writeRaw(key, raw);
  }

  /** As {@link write}, for a caller that already has the serialised form. */
  writeRaw(key: string, raw: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, raw);
    } catch {
      // Quota or private mode. Fall through: the cloud write below is now the
      // only copy that will survive, which makes queueing it more important
      // rather than less.
    }
    // Writing a key the visitor deleted is them starting it again. The queued
    // deletion has to go, or the next attach would delete what was just written.
    this.clearPendingDelete(key);
    this.markDirty(key);
  }

  /**
   * Drop the state for `key` — a reset, not a sync.
   *
   * The cloud copy goes too, and immediately rather than on the debounce: a
   * visitor wiping their save and closing the tab must not find it restored from
   * the cloud on the next load, which is exactly what a queued delete would do.
   */
  remove(key: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch { /* private mode */ }

    this.dirty.delete(key);
    this.lastRemote.delete(key);

    const entry = BY_KEY.get(key);
    if (!entry) return;

    // Recorded *before* the network is touched, and persisted, because the two
    // ways the cloud half fails are both silent and both leave this device in
    // the state `attach` reads as "fresh browser, adopt the cloud":
    //
    //   - not attached yet. The Firestore SDK is lazy (~450 kB kept out of the
    //     initial bundle), so on a cold mobile load `fs` is null for the first
    //     few seconds and the old code simply returned here.
    //   - offline. The `deleteDoc` rejects and the document lives on.
    //
    // Either way the wipe was real and the cloud has not heard about it, so the
    // intent is written down and `drainPendingDeletes` finishes it on the next
    // attach. Without this the deleted blob comes back on the next pull, which
    // is the bug this whole change exists to close.
    this.markPendingDelete(key);

    const uid = this.uid;
    const fs = this.fs;
    if (!uid || !fs) return;

    this.zone.runOutsideAngular(() => {
      void fs.api
        .deleteDoc(fs.api.doc(fs.db, 'users', uid, entry.collection, entry.doc))
        .then(() => this.clearPendingDelete(key))
        .catch(() => {
          // The record stands and the next attach retries it.
          this.setLink('offline');
        });
    });
  }

  /**
   * Keys whose local copy has been deleted but whose cloud copy may not have.
   *
   * Persisted rather than held in memory: the case this is built for is a
   * visitor wiping a blob and closing the tab, which is exactly when an
   * in-memory set would be lost and the deletion forgotten.
   */
  private pendingDeletes(): Set<string> {
    const raw = this.readRaw(PENDING_DELETE_KEY);
    if (raw === null) return new Set();
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(
        Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [],
      );
    } catch {
      return new Set();
    }
  }

  private writePendingDeletes(keys: Set<string>): void {
    try {
      if (keys.size === 0) localStorage.removeItem(PENDING_DELETE_KEY);
      else localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify([...keys]));
    } catch { /* private mode */ }
  }

  private markPendingDelete(key: string): void {
    const keys = this.pendingDeletes();
    if (keys.has(key)) return;
    keys.add(key);
    this.writePendingDeletes(keys);
  }

  private clearPendingDelete(key: string): void {
    const keys = this.pendingDeletes();
    if (!keys.delete(key)) return;
    this.writePendingDeletes(keys);
  }

  /**
   * Re-issue any deletion whose cloud half never landed, before the merge runs.
   *
   * The entry is dropped from `remote` as well as deleted, so this attach
   * reconciles against the absence the visitor asked for rather than against
   * the document that is on its way out. A key the visitor has since written
   * again is no longer pending — `writeRaw` clears it — so this cannot delete
   * live state.
   */
  private async drainPendingDeletes(
    uid: string,
    fs: FirestoreHandle,
    remote: Map<string, unknown>,
  ): Promise<void> {
    const keys = this.pendingDeletes();
    if (keys.size === 0) return;

    for (const key of keys) {
      const entry = BY_KEY.get(key);
      if (!entry) {
        this.clearPendingDelete(key);
        continue;
      }
      remote.delete(key);
      this.lastRemote.delete(key);
      try {
        await fs.api.deleteDoc(fs.api.doc(fs.db, 'users', uid, entry.collection, entry.doc));
        this.clearPendingDelete(key);
      } catch {
        // Still unreachable. The record stands for the next attach.
      }
    }
  }

  /**
   * Wipe every blob in the save, here and in the cloud, as one operation.
   *
   * This replaces nineteen independent `remove()` calls, and the difference is
   * not tidiness — it is the ordering, which is the whole fix. See
   * `save-reset.ts` for the failure this is shaped around.
   *
   *   1. Stamp the wipe locally. First, and before anything is destroyed, so a
   *      tab closed at any point after this still carries the intent and the
   *      next `attach()` finishes the job.
   *   2. Delete the cloud documents and publish the stamp. If this cannot be
   *      reached the local stamp survives step 1 and `reconcileReset` re-pushes
   *      it on the next attach — which is exactly the mobile case where the
   *      lazy Firestore SDK had not loaded yet and the old code silently gave up.
   *   3. Only then clear local, and rehydrate the owning services so the screen
   *      matches the disk in the same tick.
   *
   * `keepDeviceSnapshot` exists because the sign-in "before picture" is this
   * browser's undo for a *merge*, not for a wipe; a reset that left it behind
   * would leave a one-click path to restoring the save that was just deleted.
   */
  async resetAll(): Promise<void> {
    if (!this.isBrowser) return;

    const at = Date.now();
    this.writeResetStamp(at);

    // Nothing queued from before the wipe may be allowed to land after it.
    this.cancelFlush();
    this.dirty.clear();
    this.lastRemote.clear();
    this.overrideStrategy = null;
    // Every blob is going anyway, so per-key deletion records are now noise —
    // and leaving them would have the next attach re-issue deletes for keys the
    // visitor may have legitimately started again since.
    this.writePendingDeletes(new Set());

    await this.publishReset(at);

    for (const entry of STATE_ENTRIES) {
      try {
        localStorage.removeItem(entry.key);
      } catch { /* private mode */ }
    }
    try {
      localStorage.removeItem(SAVE_BACKUP_KEY);
    } catch { /* private mode */ }

    // Same tick as the removal, for the reason LocalSaveRegistry exists: the
    // owning services are holding the pre-wipe copy in memory and would flush
    // it straight back over the empty store within the second.
    this.zone.run(() => {
      for (const entry of STATE_ENTRIES) this.owners.rehydrate(entry.key);
    });
  }

  /**
   * Push a wipe to the cloud: delete every state document, then stamp.
   *
   * The stamp is written last on purpose. It is the marker that says "the cloud
   * is wiped", and writing it before the deletes would let a second device read
   * a settled stamp while the documents it describes were still up there — which
   * would make that device skip its own wipe and adopt the survivors.
   *
   * Resolves either way. A failure here is expected and handled: the local stamp
   * outlives it and the next attach retries.
   */
  private async publishReset(at: number): Promise<void> {
    const uid = this.uid;
    const fs = this.fs;
    if (!uid || !fs) return;

    try {
      await this.zone.runOutsideAngular(async () => {
        for (const entry of STATE_ENTRIES) {
          await fs.api.deleteDoc(
            fs.api.doc(fs.db, 'users', uid, entry.collection, entry.doc),
          );
        }
        await fs.api.setDoc(
          fs.api.doc(fs.db, 'users', uid, RESET_COLLECTION, RESET_DOC),
          { at, deviceId: this.leases.deviceId() },
        );
      });
    } catch {
      // Offline, or the SDK is not up. The local stamp is the durable record.
      this.setLink('offline');
      this.scheduleRetry();
    }
  }

  /** This device's last wipe, or 0. */
  private readResetStamp(): number {
    const raw = this.readRaw(RESET_STAMP_KEY);
    if (raw === null) return 0;
    const at = Number(raw);
    return Number.isFinite(at) && at > 0 ? at : 0;
  }

  private writeResetStamp(at: number): void {
    try {
      localStorage.setItem(RESET_STAMP_KEY, String(at));
    } catch { /* private mode */ }
  }

  /**
   * Settle the two wipe stamps before a single blob is merged.
   *
   * Returns true when the caller should treat the cloud as empty for the rest of
   * this attach — either because this device's wipe has not landed yet and is
   * being re-pushed, or because another device's wipe just took effect here and
   * there is nothing left on either side to merge.
   */
  private async reconcileReset(
    uid: string,
    fs: FirestoreHandle,
    remote: Map<string, unknown>,
    cloudAt: number,
  ): Promise<boolean> {
    const localAt = this.readResetStamp();

    switch (resetVerdict(localAt, cloudAt)) {
      case 'none':
        return false;

      case 'push-local':
        // The wipe happened here and the cloud still holds the old save. Finish
        // what `resetAll` started; everything `readAll` just returned is stale
        // by definition, so it is dropped rather than merged.
        await this.publishReset(localAt);
        remote.clear();
        return true;

      case 'adopt-remote': {
        // Another device wiped the account, later than anything this one did. A
        // reset is account-wide, so this device's survivors are not "state the
        // cloud is missing" — they are the save that was deleted.
        this.writeResetStamp(cloudAt);
        this.dirty.clear();
        this.lastRemote.clear();
        for (const entry of STATE_ENTRIES) {
          try {
            localStorage.removeItem(entry.key);
          } catch { /* private mode */ }
        }
        this.zone.run(() => {
          for (const entry of STATE_ENTRIES) this.owners.rehydrate(entry.key);
        });
        remote.clear();
        return true;
      }
    }
  }

  private markDirty(key: string): void {
    if (!this.attached) return;
    if (!BY_KEY.has(key)) return; // Not saved state; nothing to sync.

    if (this.dirty.size === 0) this.oldestDirtyAt = Date.now();
    this.dirty.add(key);
    this.scheduleFlush();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Session
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Make Firestore the record for this account, and adopt what it holds.
   *
   * Reads both subcollections whole rather than nineteen documents one at a
   * time. Same number of billed reads, two round trips instead of nineteen —
   * and this runs on every page load of a signed-in visitor, so the round trips
   * were the part that showed.
   *
   * Every key that moves is written to the cache and pushed straight into the
   * service holding it, in the same tick as the write. That ordering is not
   * cosmetic and is the whole subject of `LocalSaveRegistry`: the owning service
   * is holding a pre-merge copy it would otherwise flush back within the second.
   */
  async attach(
    uid: string,
    fs: FirestoreHandle,
    ask?: (conflict: MergeConflict) => Promise<MergeStrategy>,
  ): Promise<AttachResult> {
    // Attach first so an offline first pull still queues later play. Hold
    // automatic flushes until the merge choice is known — a four-second
    // upload started during the dialog is what used to swallow Keep This
    // Device / Merge Best while the header said Synced.
    this.uid = uid;
    this.fs = fs;
    this.decisionPending = true;
    this.setLink('syncing');
    this.lastPullAt = Date.now();
    this.bindLifecycle();

    // Settle every owner before reading a single blob. Most write through on
    // every mutation, but the ledger throttles to one write every five seconds
    // and progression debounces at 800ms — so without this the pull would
    // reconcile against a copy of the Gold a few seconds behind memory, and the
    // rehydrate at the far end would drop the difference.
    this.flushOwners();

    let remote: Map<string, unknown>;
    let strategy: MergeStrategy;
    try {
      const pulled = await this.readAll(uid, fs);
      remote = pulled.blobs;

      // Single-key deletions that never reached the cloud, re-issued before
      // anything is merged — the same failure as a full wipe, one blob at a time.
      await this.drainPendingDeletes(uid, fs, remote);

      // Then the account-wide wipe, still before a single blob is merged. A
      // wipe is not a conflict to be reconciled key-by-key — it decides whether
      // there is anything to reconcile at all, and asking the merge dialog
      // about a save the visitor has already deleted would be the old bug
      // wearing a dialog.
      const wiped = await this.reconcileReset(uid, fs, remote, pulled.resetAt);
      strategy = wiped ? 'merge' : await this.decideStrategy(remote, ask);
      // Idle ticks during the dialog can move memory after the first flush.
      this.flushOwners();
    } catch (err) {
      this.decisionPending = false;
      // Still this session: keep the queue and retry when the network returns.
      if (this.fs === fs && this.uid === uid) {
        this.setLink('offline');
        this.scheduleRetry();
      }
      throw err;
    }
    this.decisionPending = false;

    // signOut() answers the dialog and detaches in the same turn, without
    // awaiting this attach. If we still push, leftover drain spins forever
    // on a null Firestore handle.
    if (this.fs !== fs) return { adopted: [], seeded: false };
    if (strategy !== 'merge') this.overrideStrategy = strategy;

    // After the pull and before the push. Adopting the cloud copy is something
    // every device does — it is reading — and the lease only ever gates the
    // write half, so resolving it here keeps a passive device fully up to date
    // while still holding its own queue.
    await this.leases.begin(uid, fs);

    // Before anything of the cloud's lands on this device, keep the before
    // picture — see snapshotBeforeMerge.
    this.snapshotBeforeMerge(uid);

    const adopted: string[] = [];
    const toWrite: StateEntry[] = [];

    for (const entry of STATE_ENTRIES) {
      const localRaw = this.readRaw(entry.key);
      const local = localRaw === null ? null : safeParse(localRaw);
      const cloud = remote.get(entry.key) ?? null;

      if (cloud !== null) this.lastRemote.set(entry.key, JSON.stringify(cloud));

      const merged = applyStrategy(entry, cloud, local, strategy);
      if (merged === null || merged === undefined) continue;

      const resolved = entry.identify ? entry.identify(merged, uid) : merged;
      const resolvedRaw = JSON.stringify(resolved);
      const settled = stable(entry, resolved);

      if (settled !== stable(entry, local)) {
        // Cloud state this device did not have. Cache it and hand it to its
        // owner in the same tick — see the note above.
        this.adopt(entry.key, resolvedRaw);
        adopted.push(entry.key);
      }
      if (cloud === null || settled !== stable(entry, cloud)) {
        toWrite.push(entry);
      }
    }

    const seeded = remote.size === 0;

    // Whatever the cloud is missing goes up now rather than on the debounce.
    // This is the moment a visitor is thinking about whether their progress is
    // safe, and "signed in" should mean "it is up there" without a wait.
    if (toWrite.length > 0) {
      for (const entry of toWrite) this.dirty.add(entry.key);
      this.oldestDirtyAt = Date.now();
      // An explicit override is the one case a write can legitimately lower a
      // number, which the monotonic XP rule will refuse. Per-document writes
      // keep that refusal from failing the other eighteen with it.
      //
      // `known` is what was just read. Without it the push would `getDoc` every
      // dirty document a moment after `readAll` returned the same content —
      // paying for the account twice on every sign-in for no new information.
      await this.pushDirty({
        batched: strategy === 'merge',
        known: remote,
        strategy,
      });
    } else {
      this.setLink('synced');
    }
    return { adopted, seeded };
  }

  /**
   * Everything this device held immediately before the last sign-in merge.
   *
   * Reconciling is lossless by construction — it keeps the higher of every
   * monotone counter and replays both sides' ledger operations — so this is not
   * here to undo a mistake the merge made. It is here because "combine them" is
   * a decision the game now takes on the visitor's behalf, and a decision taken
   * for somebody should be one they can walk back. It is what makes signing in
   * safe to do without asking anything first.
   *
   * Device-local and deliberately not synced: it is this browser's before
   * picture, and pushing it would make it the account's.
   */
  private snapshotBeforeMerge(uid: string): void {
    try {
      const blobs: Record<string, string> = {};
      for (const entry of STATE_ENTRIES) {
        const raw = this.readRaw(entry.key);
        if (raw !== null) blobs[entry.key] = raw;
      }
      if (Object.keys(blobs).length === 0) return;
      localStorage.setItem(SAVE_BACKUP_KEY, JSON.stringify({
        at: new Date().toISOString(),
        uid,
        blobs,
      }));
    } catch {
      // Out of quota, or private mode. A backup is a courtesy; failing to take
      // one must never stop somebody signing in.
    }
  }

  /** The before picture, if this browser still holds one for this account. */
  deviceSnapshot(): { at: string; uid: string } | null {
    try {
      const raw = localStorage.getItem(SAVE_BACKUP_KEY);
      if (!raw) return null;
      const held = safeParse(raw);
      if (!isRecord(held) || typeof held['at'] !== 'string' || typeof held['uid'] !== 'string') return null;
      return { at: held['at'], uid: held['uid'] };
    } catch {
      return null;
    }
  }

  /**
   * Put this device back the way it was before the last merge, and make that
   * the account's save.
   *
   * Pushed with the 'local' strategy for the same reason the visitor picked it:
   * this is the one moment a write is allowed to lower a number. Lifetime XP is
   * still floored by `preserveMonotonicXp`, because the cloud rule refuses a
   * write that lowers it and taking the rest of the save back should not fail
   * on that one field.
   */
  async restoreDeviceSnapshot(): Promise<boolean> {
    const snap = this.deviceSnapshot();
    if (!snap) return false;
    const raw = localStorage.getItem(SAVE_BACKUP_KEY);
    const held = raw === null ? null : safeParse(raw);
    if (!isRecord(held) || !isRecord(held['blobs'])) return false;

    const blobs = held['blobs'] as Record<string, unknown>;
    for (const entry of STATE_ENTRIES) {
      const value = blobs[entry.key];
      if (typeof value !== 'string') continue;
      this.adopt(entry.key, value);
      this.dirty.add(entry.key);
    }
    if (this.dirty.size === 0) return true;
    this.oldestDirtyAt = Date.now();
    if (!this.attached) return true;
    await this.pushDirty({ batched: false, strategy: 'local' });
    return true;
  }

  /**
   * Stop being the cloud's face. The cache keeps everything, untouched.
   *
   * Signing out is not a request to forget months of progress, so nothing is
   * deleted — the visitor who signs back in finds it all where they left it,
   * and until then the site behaves exactly as it does for someone who never
   * signed in at all.
   */
  async detach(): Promise<void> {
    // One last flush while there is still somewhere to flush to.
    if (this.attached && this.dirty.size > 0) {
      try {
        await this.pushDirty({ batched: true });
      } catch {
        // Unreachable. The cache holds everything; the next sign-in re-merges.
      }
    }
    this.cancelFlush();
    this.unbindLifecycle();
    // Before the uid is cleared: releasing needs to know whose lease it is.
    this.leases.end();
    this.decisionPending = false;
    this.uid = null;
    this.fs = null;
    this.dirty.clear();
    this.lastRemote.clear();
    this.overrideStrategy = null;
    this.retryMs = RETRY_BASE_MS;
    this.setLink('local');
  }

  /**
   * Which way this pull reconciles, asking the visitor only when it has to.
   *
   * The structural rules take the higher of every number and the union of every
   * set, which is the right default precisely because it cannot lose anything.
   * But "cannot lose anything" is not the same as "is what somebody wanted": a
   * visitor who has been playing on a phone all week and then signs in on a
   * desktop holding its own half-finished save may well want one of them gone,
   * and the generous merge hands them a save that is neither.
   *
   * So the question is asked only when it is real — when each side holds
   * something the other does not. A cloud save simply ahead of this browser on
   * every number is not a conflict; all three answers would do the same thing,
   * and asking would be theatre.
   *
   * The gateway owns the data and the caller owns the question. `ask` is how the
   * header's merge dialog gets a say without this file knowing that a dialog is
   * what happens next.
   */
  private async decideStrategy(
    remote: Map<string, unknown>,
    ask?: (conflict: MergeConflict) => Promise<MergeStrategy>,
  ): Promise<MergeStrategy> {
    if (!ask || remote.size === 0) return 'merge';

    const local = summarise(this.read(PROGRESS_KEY), this.read(ECONOMY_STATE_KEY));
    const cloud = summarise(
      remote.get(PROGRESS_KEY) ?? null,
      remote.get(ECONOMY_STATE_KEY) ?? null,
    );
    if (!isConflict(local, cloud)) return 'merge';

    return ask({ local, cloud });
  }

  /**
   * Re-read the cloud and adopt anything new, mid-session.
   *
   * The honest moment for this is a tab coming back into view: it is exactly
   * when somebody has put a phone down and picked up a desktop. Throttled, and
   * never asks — a dialog opening because somebody alt-tabbed would be a
   * question they did not invite.
   */
  async resync(): Promise<AttachResult | null> {
    const uid = this.uid;
    const fs = this.fs;
    if (!uid || !fs) return null;
    if (Date.now() - this.lastPullAt < REPULL_INTERVAL_MS) return null;
    return this.attach(uid, fs);
  }

  /** Send everything queued, now. Used by sign-out and the retry button. */
  async flushNow(): Promise<void> {
    if (!this.attached) return;
    this.cancelFlush();
    await this.pushDirty({ batched: true });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reading the cloud
  // ───────────────────────────────────────────────────────────────────────────

  /** Every stored document for this account, keyed by localStorage key. */
  private async readAll(
    uid: string,
    fs: FirestoreHandle,
  ): Promise<{ blobs: Map<string, unknown>; resetAt: number }> {
    const out = new Map<string, unknown>();
    // Picked out of the sweep below rather than fetched separately. The reason
    // that matters is in `save-reset.ts`: a dedicated read here would be a third
    // billed round trip on every page load of every signed-in visitor.
    let resetAt = 0;
    const collections = [...new Set(STATE_ENTRIES.map(e => e.collection))];

    const byPath = new Map<string, StateEntry>(
      STATE_ENTRIES.map(e => [`${e.collection}/${e.doc}`, e]),
    );

    for (const collection of collections) {
      const snap = await fs.api.getDocs(
        fs.api.collection(fs.db, 'users', uid, collection),
      );
      snap.forEach(doc => {
        if (collection === RESET_COLLECTION && doc.id === RESET_DOC) {
          resetAt = coerceResetStamp(doc.data()).at;
          return;
        }
        const entry = byPath.get(`${collection}/${doc.id}`);
        // A document this build does not know about is left alone rather than
        // dropped: it is either a key an older client wrote or one a newer
        // client will, and deleting other versions' state is how a rollback
        // turns into data loss.
        if (!entry) return;
        const data = doc.data();
        out.set(entry.key, entry.enveloped ? unwrapBlob(data) : data);
      });
    }
    return { blobs: out, resetAt };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Writing the cloud
  // ───────────────────────────────────────────────────────────────────────────

  private scheduleFlush(): void {
    if (this.decisionPending) return;
    if (this.flushTimer !== null) {
      // Already booked. Let it stand unless the cap is due, so a burst of
      // clicking does not keep pushing the write further out.
      if (Date.now() - this.oldestDirtyAt < FLUSH_MAX_WAIT_MS) return;
      this.cancelFlush();
      void this.pushDirty({ batched: true });
      return;
    }
    // Outside Angular: a four-second timer whose job is a network write has no
    // template work behind it, and letting zone.js own it would wake change
    // detection for the life of the tab.
    this.zone.runOutsideAngular(() => {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.pushDirty({ batched: true });
      }, FLUSH_DEBOUNCE_MS);
    });
  }

  private cancelFlush(): void {
    if (this.flushTimer === null) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  /**
   * Read the dirty documents, merge, and write the results.
   *
   * Serialised on `this.flushing` so two overlapping tabs on this device cannot
   * interleave. Concurrent *devices* are a different race: the economy document
   * is written inside a Firestore transaction that re-reads, merges, and
   * retries on contention. Other blobs stay monotone and still go through the
   * batch path.
   */
  private pushDirty(opts: {
    batched: boolean;
    known?: Map<string, unknown>;
    strategy?: MergeStrategy;
  }): Promise<void> {
    const strategy = opts.strategy ?? this.overrideStrategy ?? 'merge';
    if (this.flushing) {
      // Wait for the in-flight write, then send whatever was dirtied while it
      // ran. Returning the in-flight promise itself dropped Keep This Device
      // and Merge Best: attach queued those keys, awaited a flush that had
      // already started, and marked Synced without ever writing them.
      return this.flushing.then(() => this.drainLeftover({
        batched: opts.batched,
        strategy,
      }));
    }
    this.flushing = this.runPush({
      batched: opts.batched,
      known: opts.known,
      strategy,
    }).finally(() => { this.flushing = null; });
    return this.flushing.then(() => {
      if (this.dirty.size === 0) this.overrideStrategy = null;
      else this.scheduleFlush();
    });
  }

  private drainLeftover(opts: {
    batched: boolean;
    strategy: MergeStrategy;
  }): Promise<void> | void {
    if (!this.attached || !this.fs || this.dirty.size === 0) return;
    return this.pushDirty(opts);
  }

  private async runPush(
    { batched, known, strategy }: {
      batched: boolean;
      known?: Map<string, unknown>;
      strategy: MergeStrategy;
    },
  ): Promise<void> {
    const uid = this.uid;
    const fs = this.fs;
    if (!uid || !fs || this.dirty.size === 0) return;

    // The one gate the device lease imposes, and it is deliberately the only
    // one: a passive device reads, merges and adopts exactly as before, and
    // only the upload waits. The queue is *kept*, not dropped — the keys stay
    // dirty, `onLeaseHandover` flushes them the moment this device becomes
    // active, and until then the local cache holds everything. Nothing here can
    // lose a write; it can only postpone one.
    if (!this.leases.mayWrite) {
      this.setLink('waiting');
      return;
    }

    // Claimed up front. A write that lands while this is in flight re-dirties
    // its key and books another flush, rather than being folded into this one
    // and reported as sent before it was.
    const keys = [...this.dirty];
    this.dirty.clear();
    this.setLink('syncing');

    const writes: { entry: StateEntry; payload: unknown }[] = [];

    try {
      for (const key of keys) {
        const entry = BY_KEY.get(key);
        if (!entry) continue;

        const localRaw = this.readRaw(key);
        if (localRaw === null) continue;
        const local = safeParse(localRaw);
        if (local === null) continue; // Unparseable; the owner will replace it.

        if (key === ECONOMY_STATE_KEY && typeof fs.api.runTransaction === 'function') {
          await this.commitEconomyTransactional(fs, uid, entry, local, localRaw, strategy);
          continue;
        }

        // A read this push does not have to make. `attach` hands over what it
        // just read, and that map is the *whole* account — `readAll` sweeps both
        // subcollections — so a key missing from it means the document does not
        // exist rather than that it was not looked at. Re-reading to confirm an
        // absence Firestore has already reported would be paying for the account
        // twice on every sign-in. Every other caller passes no `known` and reads,
        // which is what keeps concurrent devices safe.
        let cloud: unknown;
        if (known) {
          cloud = known.get(key) ?? null;
        } else {
          const snap = await fs.api.getDoc(
            fs.api.doc(fs.db, 'users', uid, entry.collection, entry.doc),
          );
          cloud = snap.exists()
            ? (entry.enveloped ? unwrapBlob(snap.data()) : snap.data())
            : null;
        }

        const reconciled = applyStrategy(entry, cloud, local, strategy);
        const merged = entry.identify ? entry.identify(reconciled, uid) : reconciled;
        const mergedRaw = JSON.stringify(merged);
        const settled = stable(entry, merged);

        // Nothing to say when the cloud already holds exactly this.
        if (cloud !== null && settled === stable(entry, cloud)) {
          this.lastRemote.set(key, mergedRaw);
          continue;
        }

        writes.push({ entry, payload: merged });

        // The merge pulled in something this device did not have. Take it here
        // rather than waiting for the next page load — this is the path that
        // makes a tab left open all day notice the phone's evening of Gold.
        // Skip the adopt if the cache moved during the flush: writing the
        // stale merge back would erase Gold earned while we were in flight.
        this.adoptUnlessMoved(key, localRaw, mergedRaw);
        this.lastRemote.set(key, mergedRaw);
      }

      if (writes.length > 0) {
        if (batched) await this.writeBatched(fs, uid, writes);
        else await this.writeEach(fs, uid, writes);
      }

      this.retryMs = RETRY_BASE_MS;
      this.setLink('synced');
    } catch (err) {
      // Put them back and try again later. Re-adding rather than restoring the
      // old set on purpose: anything written during the attempt is already in
      // `dirty` and must stay there.
      for (const key of keys) this.dirty.add(key);
      if (this.oldestDirtyAt === 0) this.oldestDirtyAt = Date.now();
      this.scheduleRetry();
      throw err;
    }
  }

  /**
   * Read-merge-write the Godforge ledger inside a transaction.
   *
   * Two devices that both read the same old document and then setDoc would
   * drop whichever merge finished first. The transaction re-reads, merges
   * under the op-log rule, and retries if the document moved.
   */
  private async commitEconomyTransactional(
    fs: FirestoreHandle,
    uid: string,
    entry: StateEntry,
    local: unknown,
    localRaw: string,
    strategy: MergeStrategy,
  ): Promise<void> {
    const ref = fs.api.doc(fs.db, 'users', uid, entry.collection, entry.doc);
    let adoptedRaw: string | null = null;
    let remoteRaw: string | null = null;

    await fs.api.runTransaction(fs.db, async (tx) => {
      const snap = await tx.get(ref);
      const cloud = snap.exists()
        ? (entry.enveloped ? unwrapBlob(snap.data()) : snap.data())
        : null;
      const reconciled = applyStrategy(entry, cloud, local, strategy);
      const identified = entry.identify ? entry.identify(reconciled, uid) : reconciled;
      // Compaction is the cloud's job: this transaction is the record, and
      // the ack frontier lives on the document. Local merge never folds.
      const ledger = coerceLedger(identified);
      const merged = ledger
        ? acknowledgeAndMaybeCompact(ledger, readDeviceId(), Date.now())
        : identified;
      const mergedRaw = JSON.stringify(merged);
      const settled = stable(entry, merged);

      if (cloud !== null && settled === stable(entry, cloud)) {
        remoteRaw = mergedRaw;
        adoptedRaw = null;
        return;
      }

      tx.set(ref, envelope(entry, merged));
      remoteRaw = mergedRaw;
      adoptedRaw = settled !== stable(entry, local) ? mergedRaw : null;
    });

    if (adoptedRaw) this.adoptUnlessMoved(entry.key, localRaw, adoptedRaw);
    if (remoteRaw) this.lastRemote.set(entry.key, remoteRaw);
  }

  /** One round trip for every dirty document. */
  private async writeBatched(
    fs: FirestoreHandle,
    uid: string,
    writes: { entry: StateEntry; payload: unknown }[],
  ): Promise<void> {
    const batch = fs.api.writeBatch(fs.db);
    for (const { entry, payload } of writes) {
      batch.set(
        fs.api.doc(fs.db, 'users', uid, entry.collection, entry.doc),
        envelope(entry, payload),
      );
    }
    try {
      await batch.commit();
    } catch {
      // A batch is atomic, so one refused document fails all of them — and the
      // monotonic XP rule refuses writes by design. Retrying per-document
      // isolates the refusal instead of letting it hold eighteen unrelated blobs
      // hostage until somebody notices. The batch's own error is dropped because
      // the per-document pass produces the real one: either every write lands,
      // in which case the batch was the problem and there is nothing to report,
      // or the offending document throws again and that is the error worth
      // surfacing.
      await this.writeEach(fs, uid, writes);
    }
  }

  /** A write per document, so one refusal costs only that document. */
  private async writeEach(
    fs: FirestoreHandle,
    uid: string,
    writes: { entry: StateEntry; payload: unknown }[],
  ): Promise<void> {
    let failure: unknown = null;
    for (const { entry, payload } of writes) {
      try {
        await fs.api.setDoc(
          fs.api.doc(fs.db, 'users', uid, entry.collection, entry.doc),
          envelope(entry, payload) as Record<string, unknown>,
        );
      } catch (err) {
        failure ??= err;
        // Keep it queued: a refused progression write means this device is
        // behind, and the next attach re-merges, which is what actually
        // resolves it.
        this.dirty.add(entry.key);
        this.lastRemote.delete(entry.key);
      }
    }
    if (failure) throw failure;
  }

  private scheduleRetry(): void {
    this.setLink('offline');
    const wait = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
    this.cancelFlush();
    this.zone.runOutsideAngular(() => {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.pushDirty({ batched: true }).catch(() => { /* backed off again */ });
      }, wait);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Plumbing
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Adopt a merged payload only if the cache still holds the snapshot we
   * read. A write that lands during the flush (idle Gold, an award inside
   * the debounce) must not be replaced by the stale merge we just uploaded.
   * The key stays dirty so the next pass re-merges the fresher copy.
   */
  private adoptUnlessMoved(key: string, readRaw: string, mergedRaw: string): void {
    const current = this.readRaw(key);
    if (current !== readRaw) {
      this.dirty.add(key);
      if (this.oldestDirtyAt === 0) this.oldestDirtyAt = Date.now();
      this.scheduleFlush();
      return;
    }
    if (mergedRaw !== readRaw) this.adopt(key, mergedRaw);
  }

  /** Cache a resolved payload and push it into the service that owns it. */
  private adopt(key: string, raw: string): void {
    try {
      localStorage.setItem(key, raw);
    } catch {
      // Quota or private mode. Rehydrating from a blob that was not written
      // would hand the owner back what it already has, so there is nothing to
      // do but leave it alone.
      return;
    }
    // In the zone: rehydration republishes a BehaviorSubject from a promise
    // chain, and without a change-detection pass the new Gold would be correct
    // in memory and stale on screen — which reads as the same bug.
    this.zone.run(() => this.owners.rehydrate(key));
  }

  /**
   * Called when the lease may have moved. Drains the queue if it moved to us.
   *
   * A device that spent ten minutes passive has ten minutes of play sitting in
   * `dirty`, and the merge rules on the far side are what make sending it late
   * safe rather than destructive — this is the same reconciliation any two
   * devices would have gone through, just serialised.
   */
  private onLeaseSettled(): Promise<void> | void {
    if (!this.attached || !this.leases.mayWrite) return;
    if (this.link === 'waiting') this.setLink(this.dirty.size > 0 ? 'syncing' : 'synced');
    if (this.dirty.size === 0) return;
    return this.pushDirty({ batched: true }).catch(() => { /* retried on the timer */ });
  }

  /**
   * The banner's "Play Here": take the lease, then send what is waiting.
   *
   * Awaits the drain rather than firing it off. The visitor pressed a button
   * meaning "sync this device", and a promise that resolves before the upload
   * has happened would let the banner report success while the queue was still
   * on disk — which is the shape of the bug this whole change is about.
   */
  async claimLease(): Promise<void> {
    await this.leases.claim();
    await this.onLeaseSettled();
  }

  private flushOwners(): void {
    for (const entry of STATE_ENTRIES) this.owners.flush(entry.key);
  }

  private lifecycleBound = false;

  private readonly onHide = (): void => {
    if (document.visibilityState === 'hidden') this.onLeave();
    else {
      // Renew before re-pulling. A device coming back into view is the case the
      // lease is built around — somebody has put one device down and picked
      // this one up — and discovering the handover first means the resync that
      // follows can already push.
      void this.leases.refresh()
        .then(() => this.onLeaseSettled())
        .catch(() => { /* handled in the service */ });
      void this.resync().catch(() => { /* offline; the queue holds */ });
    }
  };

  private readonly onLeave = (): void => {
    this.flushOwners();
    this.cancelFlush();
    // Hand the save on rather than making the next device wait out the TTL.
    // Ordered after `flushOwners` so the push below still carries this
    // session's last writes — releasing does not cancel the flush, it only
    // stops this device claiming the lease again.
    this.leases.release();
    // Unawaitable by definition. The SDK's offline queue lands it more often
    // than not, and when it does not the cache still holds everything and the
    // next load pushes it.
    void this.pushDirty({ batched: true }).catch(() => { /* leaving */ });
  };

  private readonly onOnline = (): void => {
    if (this.dirty.size > 0) void this.pushDirty({ batched: true }).catch(() => { /* still down */ });
  };

  private bindLifecycle(): void {
    if (this.lifecycleBound || !this.isBrowser) return;
    this.lifecycleBound = true;
    window.addEventListener('pagehide', this.onLeave);
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onHide);
  }

  private unbindLifecycle(): void {
    if (!this.lifecycleBound || !this.isBrowser) return;
    this.lifecycleBound = false;
    window.removeEventListener('pagehide', this.onLeave);
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onHide);
  }

  private setLink(next: CloudLink): void {
    if (this.link$$.value === next) return;
    this.zone.run(() => this.link$$.next(next));
  }
}

/**
 * How one key's two copies become one, including the XP floor the
 * `progress/state` security rule requires.
 *
 * 'local' and 'cloud' are the visitor overruling the structural rules for a
 * single sign-in, and both still fall back to whichever side exists when the
 * other does not — "keep this device" cannot be allowed to mean "delete the
 * save". The uploader used to ignore that choice and re-merge every dirty key,
 * so Keep This Device immediately became Merge Best on the way out.
 */
function applyStrategy(
  entry: StateEntry,
  cloud: unknown,
  local: unknown,
  strategy: MergeStrategy,
): unknown {
  return preserveMonotonicXp(entry, resolve(entry, cloud, local, strategy), cloud);
}

/**
 * How one key's two copies become one.
 *
 * 'local' and 'cloud' are the visitor overruling the structural rules for a
 * single sign-in, and both still fall back to whichever side exists when the
 * other does not — "keep this device" cannot be allowed to mean "delete the
 * save".
 */
function resolve(
  entry: StateEntry,
  cloud: unknown,
  local: unknown,
  strategy: MergeStrategy,
): unknown {
  if (strategy === 'local') return local ?? cloud;
  if (strategy === 'cloud') return cloud ?? local;
  if (cloud === null || cloud === undefined) return local;
  if (local === null || local === undefined) return cloud;
  return (entry.merge ?? mergeDeep)(cloud, local);
}

/**
 * Firestore refuses a `progress/state` write that lowers XP. Keep This Device
 * can still replace every other field; the lifetime XP floor is the one number
 * a stale device is not allowed to delete.
 */
function preserveMonotonicXp(entry: StateEntry, payload: unknown, cloud: unknown): unknown {
  if (entry.key !== PROGRESS_KEY || !isRecord(payload) || !isRecord(cloud)) return payload;
  const cloudXp = typeof cloud['xp'] === 'number' && Number.isFinite(cloud['xp']) ? cloud['xp'] : 0;
  const localXp = typeof payload['xp'] === 'number' && Number.isFinite(payload['xp']) ? payload['xp'] : 0;
  if (localXp >= cloudXp) return payload;
  const current = payload as unknown as ProgressState;
  // aether + nox always sum to xp. Put the floor delta on aether so the
  // split stays a valid progression blob rather than a rank with no energy.
  return withLevel({ ...current, xp: cloudXp, aether: current.aether + (cloudXp - localXp) });
}

/** The document body for a payload — wrapped, except for progression. */
function envelope(entry: StateEntry, payload: unknown): Record<string, unknown> {
  if (entry.enveloped) return wrapBlob(payload) as unknown as Record<string, unknown>;
  return stripUndefined(payload) as Record<string, unknown>;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDeviceId(): string {
  try {
    return localStorage.getItem(DEVICE_ID_KEY) || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * A payload serialised for comparison, with its volatile fields removed.
 *
 * Used only to answer "are these two the same save?". Never written — the
 * timestamps it drops are real fields that belong in the document.
 */
function stable(entry: StateEntry, value: unknown): string {
  if (!entry.volatile || !isRecord(value)) return JSON.stringify(value) ?? 'null';
  const copy: Record<string, unknown> = { ...value };
  for (const field of entry.volatile) delete copy[field];
  return JSON.stringify(copy) ?? 'null';
}
