/**
 * progress-storage.service.ts — where progression is persisted.
 *
 * The service talks to a `ProgressAdapter`, not to a storage API. Signed out,
 * that is localStorage. Signed in, `CloudSaveService` swaps in `FirestoreAdapter`
 * and progression follows the visitor between devices — which was the whole
 * reason for the indirection, and it did turn out to be the promised swap rather
 * than a rewrite of XpService.
 *
 * The contract is async, including in the localStorage adapter where it is not
 * strictly needed. That is the point: a synchronous interface would quietly grow
 * callers that assume `load()` resolves in the same tick, and the cloud path —
 * where loading is a network round trip — would have become a rewrite instead of
 * a swap. The cost was paid once, here, rather than across every consumer later.
 *
 * One escape hatch: `saveNow()`. Page unload does not await promises, and losing
 * the last award of every session would be a real bug. Adapters expose it when
 * they have a synchronous store to reach — for Firestore that is the localStorage
 * cache underneath it, which is the half worth saving.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, doc, getDoc, setDoc, deleteDoc } from '@angular/fire/firestore';
import {
  ProgressState,
  emptyProgress,
  mergeProgress,
  migrateProgress,
} from './gamification.model';

export const PROGRESS_KEY = 'eclipse-progress';

/**
 * Floor on the gap between two Firestore writes of the same document.
 *
 * A busy session awards XP every few seconds and each award schedules a save.
 * Ten seconds is the ceiling on how much work a crashed tab can cost — and the
 * cache write underneath it is unthrottled, so what is actually at risk is the
 * cloud copy being ten seconds behind the disk copy, not the award itself.
 */
export const CLOUD_WRITE_INTERVAL_MS = 10_000;

export interface ProgressAdapter {
  /** Human-readable, for the HUD and for logs. */
  readonly name: string;
  /**
   * The id this backend files progression under, when it has an opinion. The
   * Firestore adapter sets it to the signed-in uid; the local and null adapters
   * leave it undefined and keep whatever id the blob already carries.
   */
  readonly identity?: string;
  load(): Promise<ProgressState>;
  save(state: ProgressState): Promise<void>;
  /** Is there anything stored for this identity? Sign-in uses it to decide whether to merge. */
  exists(): Promise<boolean>;
  clear(): Promise<void>;
  /**
   * Best-effort synchronous write, for `pagehide`. Optional: a backend that
   * cannot write synchronously omits it and callers fall back to `save()`.
   */
  saveNow?(state: ProgressState): void;
}

/** Reads and writes the whole state blob as one localStorage key. */
export class LocalStorageAdapter implements ProgressAdapter {
  readonly name = 'localStorage';

  constructor(private readonly key = PROGRESS_KEY) {}

  async load(): Promise<ProgressState> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyProgress();
      // migrateProgress handles both the v1 blob (bare achievement ids, no
      // identity, no timestamps) and any field added to v2 since this
      // particular visitor last wrote.
      return migrateProgress(JSON.parse(raw));
    } catch {
      return emptyProgress();
    }
  }

  async save(state: ProgressState): Promise<void> {
    this.saveNow(state);
  }

  saveNow(state: ProgressState): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      /* quota or private mode — progression is not worth breaking a page over */
    }
  }

  async exists(): Promise<boolean> {
    try {
      return localStorage.getItem(this.key) !== null;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * No-op adapter used during server-side rendering, where there is no visitor and
 * no storage. Keeps XpService free of `isPlatformBrowser` checks at every call.
 */
export class NullAdapter implements ProgressAdapter {
  readonly name = 'null';
  async load(): Promise<ProgressState> { return emptyProgress(); }
  async save(): Promise<void> { /* no-op */ }
  async exists(): Promise<boolean> { return false; }
  async clear(): Promise<void> { /* no-op */ }
  saveNow(): void { /* no-op */ }
}

/**
 * Progression in `users/{uid}/progress/state`, with localStorage kept alongside
 * it as a cache rather than replaced by it.
 *
 * This was a deliberate stub for two releases and the notes it carried have been
 * mostly honoured; the two places this departs from them are worth stating,
 * because both were written down as certainties and only one survived contact.
 *
 * ── It writes both stores, not one ───────────────────────────────────────────
 * Every save lands in localStorage *first* and Firestore second. That is what
 * lets the site keep working signed-out, offline, and in the seconds before auth
 * has finished booting — the whole Godforge hydrates from localStorage on the
 * first frame and never waits on a network round trip. A network failure costs
 * the visitor nothing, because the write it failed to make is already on disk.
 *
 * ── It does have `saveNow` ───────────────────────────────────────────────────
 * The stub refused one, reasoning that Firestore cannot write synchronously and
 * that pretending otherwise would drop the last slice of a session. Half of that
 * is right: the Firestore half of a `pagehide` write genuinely cannot be
 * awaited. But the localStorage half can, and it is the half that matters —
 * dropping it would lose the award outright, whereas dropping the Firestore
 * write only defers it to the next load, when the cache is read back and pushed
 * up. Refusing to write either store is strictly worse than writing the one that
 * works. The Firestore write is still attempted, best effort, because the SDK's
 * offline queue often does land it.
 *
 * ── Throttling ───────────────────────────────────────────────────────────────
 * `XpService` debounces at 800ms, which is right for a disk write and far too
 * chatty for a billed one. Firestore writes are throttled to one per
 * `CLOUD_WRITE_INTERVAL_MS` here, leading-edge so the first award of a session
 * syncs immediately, with a trailing write so the last one is never the one left
 * behind.
 */
export class FirestoreAdapter implements ProgressAdapter {
  readonly name = 'firestore';

  /** The cache half of every write. */
  private readonly local = new LocalStorageAdapter();

  get identity(): string { return this.uid; }

  private lastWriteAt = 0;
  private trailing: ReturnType<typeof setTimeout> | null = null;
  /** Newest state not yet pushed. Null once the upstream write has been issued. */
  private pending: ProgressState | null = null;

  constructor(
    private readonly firestore: Firestore,
    private readonly uid: string,
    /** Called after every upstream write attempt, for the sync indicator. */
    private readonly onWrite: (error: unknown | null) => void = () => {},
  ) {}

  private ref() {
    return doc(this.firestore, 'users', this.uid, 'progress', 'state');
  }

  /**
   * Remote first, cache as the fallback.
   *
   * A remote read that succeeds also refreshes the cache, so the next cold start
   * paints this device's real progression before auth has even loaded.
   *
   * A remote read that *fails* returns the local blob rather than an empty one.
   * That distinction is the whole difference between "you are offline" and "your
   * profile was wiped", and only one of them is survivable.
   */
  async load(): Promise<ProgressState> {
    const cached = await this.local.load();
    try {
      const snap = await getDoc(this.ref());
      if (!snap.exists()) return { ...cached, userId: this.uid };
      const remote = migrateProgress(snap.data());
      const adopted = { ...remote, userId: this.uid };
      this.local.saveNow(adopted);
      return adopted;
    } catch (err) {
      this.onWrite(err);
      return { ...cached, userId: this.uid };
    }
  }

  async save(state: ProgressState): Promise<void> {
    const stamped = { ...state, userId: this.uid };
    // Cache unconditionally and synchronously. Whatever happens upstream, the
    // visitor's own device already has it.
    this.local.saveNow(stamped);
    this.pending = stamped;

    const since = Date.now() - this.lastWriteAt;
    if (since >= CLOUD_WRITE_INTERVAL_MS) {
      await this.flush();
      return;
    }
    // Inside the window: leave `pending` for the trailing write already booked,
    // or book one for whatever is left of the interval.
    if (this.trailing === null) {
      this.trailing = setTimeout(() => {
        this.trailing = null;
        void this.flush();
      }, CLOUD_WRITE_INTERVAL_MS - since);
    }
  }

  /** Push whatever is pending, now. */
  async flush(): Promise<void> {
    const state = this.pending;
    if (!state) return;
    this.pending = null;
    this.lastWriteAt = Date.now();
    try {
      // Whole-document write, not a merge: `ProgressState` is a closed shape and
      // a field removed locally should not survive in the cloud copy forever.
      await setDoc(this.ref(), state as unknown as Record<string, unknown>);
      this.onWrite(null);
    } catch (err) {
      // Put it back so the next tick retries rather than dropping it. A newer
      // state may have replaced it already, which is fine — that one is newer.
      this.pending ??= state;
      this.onWrite(err);
      throw err;
    }
  }

  saveNow(state: ProgressState): void {
    const stamped = { ...state, userId: this.uid };
    this.local.saveNow(stamped);
    this.pending = stamped;
    // Unawaitable by definition — `pagehide` will not hold the page open for it.
    // The SDK's offline queue lands it surprisingly often, and when it does not,
    // the cache write above means the next load still has it.
    void this.flush().catch(() => { /* leaving; the cache holds the truth */ });
  }

  async exists(): Promise<boolean> {
    try {
      return (await getDoc(this.ref())).exists();
    } catch {
      // Unknown is not the same as absent, and treating it as absent would let
      // `migrate()` overwrite a real cloud profile with a fresh device's empty
      // one — the exact silent clobber it exists to prevent.
      throw new Error('[FirestoreAdapter] could not reach Firestore.');
    }
  }

  /** Wipes both copies. Used by `XpService.reset()`. */
  async clear(): Promise<void> {
    await this.local.clear();
    this.pending = null;
    if (this.trailing !== null) {
      clearTimeout(this.trailing);
      this.trailing = null;
    }
    await deleteDoc(this.ref());
  }
}

@Injectable({ providedIn: 'root' })
export class ProgressStorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private adapter: ProgressAdapter = this.isBrowser
    ? new LocalStorageAdapter()
    : new NullAdapter();

  /** Which backend progression is living in. */
  get backend(): string { return this.adapter.name; }

  /** True once a real remote backend is behind the service. */
  get isRemote(): boolean { return this.adapter.name !== 'localStorage' && this.adapter.name !== 'null'; }

  /** Swap the backing store. Phase 2 calls this on sign-in. */
  useAdapter(adapter: ProgressAdapter): void {
    this.adapter = adapter;
  }

  load(): Promise<ProgressState> { return this.adapter.load(); }

  save(state: ProgressState): Promise<void> {
    return this.adapter.save({ ...state, updatedAt: new Date().toISOString() });
  }

  /**
   * Synchronous best-effort write for `pagehide`, where a promise will not be
   * awaited. Falls back to the async path when the adapter cannot do it, which
   * is better than nothing even if the browser may cut it short.
   */
  saveNow(state: ProgressState): void {
    const stamped = { ...state, updatedAt: new Date().toISOString() };
    if (this.adapter.saveNow) this.adapter.saveNow(stamped);
    else void this.adapter.save(stamped).catch(() => { /* unload; nothing to do */ });
  }

  exists(): Promise<boolean> { return this.adapter.exists(); }

  clear(): Promise<void> { return this.adapter.clear(); }

  /**
   * Move this device's progression into `target`, keeping whatever is already
   * there, and make `target` the live adapter.
   *
   * The case this is for: someone has been earning XP anonymously for weeks and
   * then signs in. Overwriting either side would be a betrayal — losing local
   * progress at sign-in is the obvious one, but clobbering a richer cloud
   * profile with a fresh device's empty one is worse, because it is silent.
   * `mergeProgress` is commutative, so the result does not depend on which
   * device signed in first.
   *
   * Local storage is deliberately left intact: if the write to `target` fails,
   * or the visitor signs out, the progression is still there. Clearing it is a
   * separate, explicit decision.
   */
  async migrate(target: ProgressAdapter): Promise<ProgressState> {
    if (!this.isBrowser) throw new Error('[ProgressStorage] migrate() is browser-only.');

    const local = await new LocalStorageAdapter().load();
    const remote = (await target.exists()) ? await target.load() : null;
    // The target's identity always wins — adopting the signed-in uid is the
    // whole point of migrating. On a first device there is no remote blob to
    // take it from, so it comes off the adapter itself.
    const userId = target.identity ?? remote?.userId ?? local.userId;
    const merged = remote
      ? { ...mergeProgress(remote, local), userId }
      : { ...local, userId };

    await target.save(merged);
    this.adapter = target;
    return merged;
  }

  /**
   * Push anything the adapter is holding back, immediately.
   *
   * The Firestore adapter throttles its uploads, so at sign-out — the one moment
   * the visitor is explicitly asking for their progress to be safe — there may
   * be up to ten seconds of awards sitting in a trailing timer that is about to
   * be thrown away with the adapter.
   */
  async flush(): Promise<void> {
    const adapter = this.adapter as ProgressAdapter & { flush?: () => Promise<void> };
    if (adapter.flush) await adapter.flush();
  }
}
