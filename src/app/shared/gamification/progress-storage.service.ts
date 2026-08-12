/**
 * progress-storage.service.ts — where progression is persisted.
 *
 * The service talks to a `ProgressAdapter`, not to a storage API. Today the only
 * live adapter is localStorage; the Firestore adapter is a deliberate stub so
 * that Phase 2 (progress that follows a signed-in visitor across devices) is a
 * one-line provider swap rather than a rewrite of XpService.
 *
 * The contract is async, including in the localStorage adapter where it is not
 * strictly needed. That is the point: a synchronous interface would quietly grow
 * callers that assume `load()` resolves in the same tick, and Phase 2 — where
 * loading is a network round trip — would become a rewrite instead of a swap.
 * The cost is paid once, here, rather than across every consumer later.
 *
 * One escape hatch: `saveNow()`. Page unload does not await promises, and losing
 * the last award of every session would be a real bug. Adapters that *can* write
 * synchronously expose it; Firestore cannot, and says so.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ProgressState,
  emptyProgress,
  mergeProgress,
  migrateProgress,
} from './gamification.model';

export const PROGRESS_KEY = 'eclipse-progress';

export interface ProgressAdapter {
  /** Human-readable, for the HUD and for logs. */
  readonly name: string;
  load(): Promise<ProgressState>;
  save(state: ProgressState): Promise<void>;
  /** Is there anything stored for this identity? Phase 2 uses it to decide whether to merge. */
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
 * Phase 2 stub. Signing in should sync progression to `users/{uid}/progress`,
 * with the local blob acting as an offline cache that reconciles on load
 * (highest lifetime XP wins, achievement id sets union — `mergeProgress` in
 * gamification.model.ts already implements exactly that).
 *
 * INERT ON PURPOSE. Every method throws rather than silently returning an empty
 * blob: a stub that quietly hands back zero XP would look like a wiped profile
 * the first time somebody wired it up by accident. It is a real class rather
 * than a comment block so the compiler keeps proving it satisfies the
 * interface — a stub that has drifted out of shape is worth less than no stub.
 *
 * Everything Phase 2 needs is already true of the data: `ProgressState` is
 * JSON-safe so it goes straight to `setDoc` with no converter, `userId` already
 * exists so sign-in only changes where the id comes from, and `level` is already
 * stored so a leaderboard is one `orderBy` away.
 *
 * TO ACTIVATE:
 *
 *  1. Uncomment the bodies and inject Firestore.
 *  2. Add the security rule. The important half is that XP must not be
 *     client-writable to an arbitrary value — a document the browser can set to
 *     `xp: 999999999` makes the whole ladder meaningless the moment one person
 *     opens devtools:
 *
 *       match /users/{uid}/progress/{doc} {
 *         allow read:   if request.auth != null && request.auth.uid == uid;
 *         allow create: if request.auth != null && request.auth.uid == uid
 *                       && request.resource.data.xp == 0;
 *         allow update: if request.auth != null && request.auth.uid == uid
 *                       // monotonic, and bounded per write
 *                       && request.resource.data.xp >= resource.data.xp
 *                       && request.resource.data.xp <= resource.data.xp + 2000
 *                       && request.resource.data.userId == uid;
 *       }
 *
 *     That bounds the damage rather than preventing it. If the Arena
 *     leaderboards ever become competitive, XP has to be awarded by a Cloud
 *     Function the client cannot call with an arbitrary amount, and this rule
 *     tightens to `allow write: if false`.
 *
 *  3. Call `ProgressStorageService.migrate(new FirestoreAdapter(uid))` once on
 *     first sign-in, then let the adapter take over.
 *
 * Also worth doing before this goes live: `XpService` already debounces writes,
 * but a busy session still produces one every few seconds. Batch to ~30s plus a
 * flush on sign-out, or Firestore write costs will outpace the feature.
 */
export class FirestoreAdapter implements ProgressAdapter {
  readonly name = 'firestore';

  // TODO(phase-2): inject Firestore alongside the authenticated uid.
  //   constructor(private firestore: Firestore, private uid: string) {}
  constructor(private readonly uid: string) {}

  async load(): Promise<ProgressState> {
    throw new Error('[FirestoreAdapter] Phase 2 is not implemented yet.');
    // TODO(phase-2):
    // const ref  = doc(this.firestore, 'users', this.uid, 'progress', 'state');
    // const snap = await getDoc(ref);
    // if (!snap.exists()) return { ...emptyProgress(), userId: this.uid };
    // return migrateProgress(snap.data());
  }

  async save(_state: ProgressState): Promise<void> {
    throw new Error('[FirestoreAdapter] Phase 2 is not implemented yet.');
    // TODO(phase-2):
    // const ref = doc(this.firestore, 'users', this.uid, 'progress', 'state');
    // await setDoc(ref, { ..._state, userId: this.uid }, { merge: true });
  }

  async exists(): Promise<boolean> {
    throw new Error('[FirestoreAdapter] Phase 2 is not implemented yet.');
    // TODO(phase-2):
    // return (await getDoc(doc(this.firestore, 'users', this.uid, 'progress', 'state'))).exists();
  }

  async clear(): Promise<void> {
    throw new Error('[FirestoreAdapter] Phase 2 is not implemented yet.');
  }

  // No `saveNow`. Firestore cannot write synchronously, and pretending
  // otherwise would silently drop the last unsaved slice of every session.
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
    // whole point of migrating.
    const merged = remote
      ? { ...mergeProgress(remote, local), userId: remote.userId }
      : local;

    await target.save(merged);
    this.adapter = target;
    return merged;
  }
}
