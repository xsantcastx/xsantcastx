/**
 * cloud-save.service.ts — progression that follows you between devices.
 *
 * Signing in with Google binds this browser's Godforge to a Firebase uid and
 * keeps `users/{uid}` in step with it from then on. Signing out unbinds it and
 * changes nothing else: the local save stays exactly where it was, and the site
 * carries on offline the way it always has.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE AUTH SDK IS LOADED BY HAND
 * ─────────────────────────────────────────────────────────────────────────────
 * `provideAuth()` is deliberately absent from the root injector. It lives on the
 * lazy /guestbook, /admin and /pdf-generator routes so that `@firebase/auth` —
 * which is not small — stays out of the bundle every visitor downloads to read
 * one page. That decision predates this feature and is still the right one: the
 * overwhelming majority of visits are one person, one tool, never signed in.
 *
 * But cloud save lives in the header, which is on every page, so injecting
 * `Auth` would have quietly undone it. Instead the SDK is imported at the moment
 * it is first genuinely needed — the click on "Save Progress", or an idle
 * callback on a device that was already signed in — and `getAuth(firebaseApp())` is
 * called directly rather than through DI. Same SDK, same Firebase app, no
 * injector involvement, and a visitor who never signs in never downloads it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A RELOAD AFTER ADOPTING CLOUD STATE
 * ─────────────────────────────────────────────────────────────────────────────
 * Ten services hold their state in memory and flush it to localStorage. They
 * read it once, on first injection, and never look again — which is correct for
 * a store only they write to, and is exactly wrong the moment a merge rewrites
 * that store underneath them. Left alone, their next flush would overwrite the
 * merged save with the stale copy they were still holding, and the progress that
 * had just arrived from the other device would be gone within the second.
 *
 * Adding a `rehydrate()` to all ten was the alternative. It is more code in more
 * places, and it has to be got right in ten services with live timers and
 * subscriptions — for a moment that happens once per device. Reloading is one
 * line, cannot be subtly wrong, and reads to the visitor as the button they just
 * pressed finishing its job. It is guarded by a sessionStorage flag so that a
 * merge which somehow never settles can never loop.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FirestoreHandle, LazyFirestoreService } from '../lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from '../firestore-cache.service';
import {
  CLOUD_WRITE_INTERVAL_MS,
  FirestoreAdapter,
  LocalStorageAdapter,
  PROGRESS_KEY,
  ProgressStorageService,
} from '../gamification/progress-storage.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import {
  MergeConflict,
  MergeStrategy,
  SYNCED_BLOBS,
  SaveSummary,
  SyncedBlob,
  isConflict,
  mergeDeep,
  summarise,
  unwrapBlob,
  wrapBlob,
} from './cloud-save.model';

/** Remembers across reloads that this browser is bound, so sync resumes itself. */
const BOUND_UID_KEY = 'cloud-save-uid';
/** Set immediately before an adopt-reload, so a merge that never settles cannot loop. */
const ADOPTED_FLAG = 'cloud-save-adopted';
/**
 * Set on the way out to a redirect sign-in.
 *
 * Redirect is the one path that leaves the page and comes back with nothing to
 * find: the binding is only written once a uid is known, and the whole point of
 * the redirect is that the uid arrives after the navigation. Without this
 * breadcrumb the visitor returns from Google genuinely signed in, and to a
 * header that still says "Save Progress".
 */
const REDIRECT_PENDING = 'cloud-save-redirect';
/** The achievement for opening cloud save. Registered in EASTER_EGGS. */
export const CLOUD_SAVE_EGG = 'cloud-eternal-archive';

/**
 * Floor on the gap between two full reconciliations inside one page load.
 *
 * A reconciliation is not free: it reads every blob plus two for progression,
 * so roughly twenty document reads. Returning to a tab is what triggers one, and
 * a visitor alt-tabbing between a browser and an editor generates that event far
 * more often than their progress on another device actually changes — without a
 * floor, one restless afternoon would cost more reads than the rest of the site
 * spends in a day.
 *
 * A minute is the balance. Long enough that flicking between windows costs
 * nothing after the first look, short enough that the case this exists for —
 * putting a phone down and turning to a desktop — is always outside the window.
 * Opening the site fresh does not wait on this at all; that path binds, which
 * reconciles on the spot.
 */
const RESYNC_INTERVAL_MS = 60_000;

export type SyncState =
  /** Signed out. The local save is the only save, which is a fine way to live. */
  | 'off'
  /** Booting auth, merging, or pushing. */
  | 'syncing'
  /** Everything on this device is in the cloud. */
  | 'synced'
  /** A read or write failed. Retried on the next tick; retryable by hand. */
  | 'error';

export interface SyncStatus {
  state: SyncState;
  uid: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** Epoch ms of the last fully successful sync, or null. */
  lastSyncedAt: number | null;
  /** Set when `state` is 'error'. Already phrased for a person to read. */
  error: string | null;
}

const SIGNED_OUT: SyncStatus = {
  state: 'off',
  uid: null,
  email: null,
  displayName: null,
  photoURL: null,
  lastSyncedAt: null,
  error: null,
};

/** The slice of a Firebase user this service needs. Avoids importing the type eagerly. */
interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

@Injectable({ providedIn: 'root' })
export class CloudSaveService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly lazyFirestore = inject(LazyFirestoreService);
  private readonly cache = inject(FirestoreCacheService);
  private readonly progress = inject(ProgressStorageService);
  private readonly eggs = inject(EasterEggService);
  private readonly zone = inject(NgZone);

  private readonly status$$ = new BehaviorSubject<SyncStatus>(SIGNED_OUT);
  readonly status$: Observable<SyncStatus> = this.status$$.asObservable();

  /**
   * Set when signing in found two saves that each hold something the other does
   * not, and the visitor has to say which one wins. Null the rest of the time.
   * The bind is genuinely parked on this — see {@link chooseStrategy}.
   */
  private readonly conflict$$ = new BehaviorSubject<MergeConflict | null>(null);
  readonly conflict$: Observable<MergeConflict | null> = this.conflict$$.asObservable();

  /** Resolves the parked bind once the dialog answers. */
  private decide: ((choice: MergeStrategy) => void) | null = null;

  get status(): SyncStatus { return this.status$$.value; }
  get signedIn(): boolean { return this.status$$.value.uid !== null; }
  get conflict(): MergeConflict | null { return this.conflict$$.value; }

  /**
   * Answer the merge dialog. Anything other than a real choice means "merge",
   * which is the option that cannot lose anybody anything.
   */
  resolveConflict(choice: MergeStrategy): void {
    const decide = this.decide;
    this.decide = null;
    this.conflict$$.next(null);
    decide?.(choice);
  }

  private booted = false;

  /**
   * A popup sign-in in this session ended without a credential. The next
   * attempt goes straight to redirect.
   *
   * `auth/popup-closed-by-user` has two causes and no way to tell them apart at
   * the call site. One is the visitor shutting the window, which is an answer
   * and not a failure. The other is COOP: `signInWithPopup` polls
   * `popupWin.closed` to notice the first case, and if the opener and the popup
   * land in different browsing context groups that read is blocked — Chrome
   * logs "Cross-Origin-Opener-Policy policy would block the window.closed
   * call" — so Firebase concludes the window is gone and rejects with the same
   * code while the visitor is still looking at Google's consent screen. Signing
   * in then completes in a popup nothing is listening to, and the page they
   * came from sits there signed out with no error, because a cancellation is
   * not something to report.
   *
   * Guessing between them on timing would get it wrong in both directions, so
   * neither attempt is reported — but the second one takes the redirect, which
   * has no opener to sever and cannot fail this way. A visitor who genuinely
   * changed their mind and later changes it back pays one full-page navigation;
   * a visitor whose browser severs the popup gets in on the second click
   * instead of never.
   *
   * Deliberately per-instance rather than persisted: the condition is a
   * property of this page's opener relationship, not of the browser, and a
   * sticky flag would push everyone onto redirect forever after one stray
   * cancellation.
   */
  private popupUnreliable = false;
  /** Resolved auth module, kept so the SDK is only ever fetched once. */
  private authModule: Promise<typeof import('@angular/fire/auth')> | null = null;
  private adapter: FirestoreAdapter | null = null;
  private pushTimer: ReturnType<typeof setInterval> | null = null;
  /** Last payload written per blob key, so an unchanged blob costs nothing. */
  private readonly pushed = new Map<string, string>();
  private pushing = false;
  /** Epoch ms of the last full reconciliation, so returning to a tab is throttled. */
  private lastReconcileAt = 0;
  private resyncing = false;

  // ───────────────────────────────────────────────────────────────────────────
  // Boot
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Resume sync on a browser that was already bound. Idempotent.
   *
   * Nothing here is on the critical path: the Godforge has already hydrated from
   * localStorage by the time this runs, and if it never ran at all the site
   * would work exactly as it did before cloud save existed. So it waits for an
   * idle callback rather than competing with first paint for the network.
   */
  init(): void {
    if (!this.isBrowser || this.booted) return;
    this.booted = true;

    let bound: string | null = null;
    let returning = false;
    try {
      bound = localStorage.getItem(BOUND_UID_KEY);
      // Set on the way out to a redirect sign-in, which is the one path that
      // leaves and comes back with no binding yet to find.
      returning = sessionStorage.getItem(REDIRECT_PENDING) !== null;
    } catch {
      // Private mode. Sign-in still works, it just will not be remembered.
    }
    if (!bound && !returning) return;

    // Optimistic: paint the signed-in chrome from what we remembered rather than
    // flashing "Save Progress" at somebody who is already signed in and making
    // them wonder whether they were logged out.
    this.status$$.next({ ...SIGNED_OUT, state: 'syncing', uid: bound });

    // A visitor who has just been bounced back from Google is waiting on this,
    // so it does not get to sit behind an idle callback the way a routine
    // resume does.
    if (returning) void this.resume();
    else this.whenIdle(() => void this.resume());
  }

  private async resume(): Promise<void> {
    try {
      const { getAuth, getRedirectResult, onAuthStateChanged } = await this.auth();
      const auth = getAuth(firebaseApp());

      // Settle any redirect first. `onAuthStateChanged` would eventually report
      // the same user, but only this call surfaces the *reason* a redirect
      // sign-in failed — an unauthorised domain, a cancelled consent screen —
      // and without it those land as a silent return to a signed-out header.
      try {
        await getRedirectResult(auth);
      } catch (err) {
        this.clearRedirectPending();
        if (!isUserCancelled(err)) this.fail(err);
        return;
      }
      this.clearRedirectPending();

      // One-shot: the persisted session either restores or it does not, and a
      // standing listener would fight `signOut()` for control of the status.
      const user = await new Promise<AuthUser | null>(resolve => {
        const stop = onAuthStateChanged(
          auth,
          u => { stop(); resolve(u as AuthUser | null); },
          () => { stop(); resolve(null); },
        );
      });

      if (!user) {
        // The Google session lapsed. Drop the binding rather than sitting in a
        // permanent "syncing" that will never resolve.
        this.forgetBinding();
        this.status$$.next(SIGNED_OUT);
        return;
      }
      await this.bind(user);
    } catch (err) {
      this.fail(err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sign in / sign out
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Google sign-in, then bind this device.
   *
   * Popup first, on every form factor — it keeps the visitor on the page and
   * survives the page being reloaded mid-flow, which redirect does not. Redirect
   * is the fallback for the environments where a popup genuinely cannot open:
   * an in-app browser, a hardened popup blocker, an embedded webview. Both land
   * in the same place, because `resume()` picks the session up on the way back.
   *
   * It is also the fallback for a popup that opened and then reported itself
   * closed without producing a credential, which is the one failure that used
   * to be terminal here — see `popupUnreliable`.
   */
  async signIn(): Promise<void> {
    if (!this.isBrowser) return;
    this.booted = true;
    this.status$$.next({ ...this.status, state: 'syncing', error: null });

    try {
      const mod = await this.auth();
      const auth = mod.getAuth(firebaseApp());
      const provider = new mod.GoogleAuthProvider();
      // Always ask which account. A shared machine that silently reuses the last
      // Google session would bind somebody else's Godforge to this browser.
      provider.setCustomParameters({ prompt: 'select_account' });

      let user: AuthUser | null = null;
      // Set when a popup in this session already came back closed without a
      // credential. See `popupUnreliable`.
      let viaRedirect = this.popupUnreliable;

      if (!viaRedirect) {
        try {
          const cred = await mod.signInWithPopup(auth, provider);
          user = cred.user as AuthUser;
        } catch (err) {
          if (!isPopupUnavailable(err)) {
            if (isUserCancelled(err)) this.popupUnreliable = true;
            throw err;
          }
          viaRedirect = true;
        }
      }

      if (viaRedirect) {
        // Hands off to a full page navigation; `resume()` completes the bind
        // when Google sends the visitor back — provided it knows to look.
        try { sessionStorage.setItem(REDIRECT_PENDING, '1'); } catch { /* private mode */ }
        await mod.signInWithRedirect(auth, provider);
        return;
      }

      await this.bind(user as AuthUser);
    } catch (err) {
      if (isUserCancelled(err)) {
        // Closing the popup is an answer, not a failure. Go quiet.
        this.status$$.next(this.signedIn ? { ...this.status, state: 'synced' } : SIGNED_OUT);
        return;
      }
      this.fail(err);
    }
  }

  /**
   * Unbind this browser. The local save is deliberately left untouched — signing
   * out of the cloud is not a request to forget months of XP, and a
   * visitor who signs back in should find everything where they left it.
   */
  async signOut(): Promise<void> {
    if (!this.isBrowser) return;

    // A bind can still be parked on the merge dialog when this is reached —
    // signing out with it open would leave that promise unresolved and the
    // dialog on screen with nothing behind it. Answering 'merge' lets the bind
    // finish and unwind before the unbind below tears its adapter away.
    if (this.decide) this.resolveConflict('merge');

    // Push whatever is still in the throttle window before letting go of the
    // adapter. This is the one moment the visitor is explicitly thinking about
    // whether their progress is safe.
    try {
      await this.pushAll();
      await this.progress.flush();
    } catch {
      // Already unreachable; the local save still holds everything.
    }

    this.stopPushing();
    this.adapter = null;
    this.pushed.clear();
    this.forgetBinding();
    // Back to the local save, which has been kept current all along — the cloud
    // adapter wrote through to it on every single save.
    this.progress.useAdapter(new LocalStorageAdapter());

    try {
      const { getAuth, signOut } = await this.auth();
      await signOut(getAuth(firebaseApp()));
    } catch {
      // Already gone as far as this device is concerned.
    }

    this.status$$.next(SIGNED_OUT);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Binding
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reconcile every blob against `users/{uid}`, then keep pushing.
   *
   * Runs on sign-in and on every subsequent load. There is no separate
   * first-time path: the merge is the same operation whether the cloud copy is
   * absent (first device — local wins by default), behind (this device has been
   * doing the work) or ahead (another device has). Doing it every load is what
   * makes moving between a phone and a PC mid-session work at all.
   */
  private async bind(user: AuthUser): Promise<void> {
    this.status$$.next({
      state: 'syncing',
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastSyncedAt: this.status.lastSyncedAt,
      error: null,
    });

    try {
      localStorage.setItem(BOUND_UID_KEY, user.uid);
    } catch { /* private mode; sync works for this session only */ }

    // Both SDKs this feature needs are loaded on demand rather than injected —
    // Firestore because it is 450 kB that first paint never touches, auth for
    // the same reason. Signing in is the moment both become worth their weight.
    const fs = await this.firestore();

    const adapter = new FirestoreAdapter(fs, user.uid, err => {
      if (err) this.fail(err);
    });

    // Decided up front, because it changes what this tab is willing to write.
    // Adopting cloud state means writing it into localStorage under ten
    // services that have already read it, and that is only safe if the tab is
    // then going to restart and let them read it again.
    const canAdopt = this.canAdopt();

    // Two saves that each hold something the other does not is the one case the
    // structural merge cannot answer on its own. Ask, and park here until the
    // dialog replies. Everything below then runs under whatever was chosen.
    const strategy = await this.chooseStrategy(fs, user.uid, adapter, canAdopt);

    this.adapter = adapter;
    const changed = await this.reconcileAll(fs, user.uid, adapter, strategy, canAdopt);

    this.markSynced();
    this.startPushing();
    void this.eggs.trigger(CLOUD_SAVE_EGG);

    if (changed) {
      // Cloud state arrived that this device did not have. Every service is now
      // holding a copy behind its own localStorage — see the note at the top.
      if (canAdopt) this.adoptAndReload();
    } else {
      // A bind that moved nothing is a fixed point: local and cloud agree, and
      // every service is holding the state that is actually on disk. Release
      // the once-per-session reload so a divergence later in this session can
      // still be adopted. A merge that somehow never settles never reaches here,
      // so the guard it is releasing stays held and the loop stays impossible.
      this.clearAdoptGuard();
    }
  }

  /**
   * One full reconciliation pass over every blob. Returns true when something on
   * this device changed, which is what decides whether the tab has to restart.
   *
   * Split out of {@link bind} so that {@link resync} can run the same pass again
   * later in the session without going back through auth — the two are the same
   * operation, and the only reason it used to live inside `bind` was that
   * binding was the only time it ever ran.
   */
  private async reconcileAll(
    fs: FirestoreHandle,
    uid: string,
    adapter: FirestoreAdapter,
    strategy: MergeStrategy,
    canAdopt: boolean,
  ): Promise<boolean> {
    this.lastReconcileAt = Date.now();

    // Progression rides the adapter seam that was built for it. `migrate()`
    // reconciles local against whatever is already up there and swaps itself in.
    const before = readRaw(PROGRESS_KEY);
    await this.progress.migrate(adapter, strategy);
    let changed = readRaw(PROGRESS_KEY) !== before;

    // The rest have no adapter seam, so they are reconciled directly.
    for (const blob of SYNCED_BLOBS) {
      if (await this.reconcile(fs, uid, blob, canAdopt, strategy)) changed = true;
    }
    return changed;
  }

  /**
   * Decide how this bind reconciles, asking the visitor when it has to.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY THIS ASKS AT ALL
   * ───────────────────────────────────────────────────────────────────────────
   * The structural merge takes the higher of every number and the union of every
   * set, which is the right default precisely because it cannot lose anything.
   * But "cannot lose anything" is not the same as "is what somebody wanted": a
   * visitor who has been playing on a phone all week and then signs in on a
   * desktop that has its own half-finished save may well want one of them gone,
   * and the generous merge hands them a save that is neither.
   *
   * So the dialog opens only when the question is real — when each side holds
   * something the other does not (see `isConflict`). A cloud save that is simply
   * ahead of this browser on every number is not a conflict; all three buttons
   * would do the same thing, and asking would be theatre.
   *
   * Returns 'merge' without asking whenever the question does not arise, which
   * is every routine page load of an already-bound device.
   */
  private async chooseStrategy(
    fs: FirestoreHandle,
    uid: string,
    adapter: FirestoreAdapter,
    canAdopt: boolean,
  ): Promise<MergeStrategy> {
    // Adopting cloud state means rewriting localStorage under ten services that
    // have already read it, which is only safe if the tab then restarts. A tab
    // that has spent its one reload cannot honour "Load Cloud", so it must not
    // offer it — it merges quietly and asks again on the next page load.
    if (!canAdopt) return 'merge';

    let local: SaveSummary;
    let cloud: SaveSummary;
    try {
      const remoteProgress = (await adapter.exists()) ? await adapter.load() : null;
      if (remoteProgress === null) return 'merge'; // First device. Nothing to weigh.

      const economyBlob = SYNCED_BLOBS.find(b => b.key === 'godforge-economy');
      const remoteEconomy = economyBlob ? await this.readRemote(fs, uid, economyBlob) : null;

      local = summarise(readParsed(PROGRESS_KEY), readParsed('godforge-economy'));
      cloud = summarise(remoteProgress, remoteEconomy);
    } catch {
      // Could not read one side. Merging is the safe answer to a question we
      // could not finish asking, and the bind's own error path handles the rest.
      return 'merge';
    }

    if (!isConflict(local, cloud)) return 'merge';

    return new Promise<MergeStrategy>(resolve => {
      this.decide = resolve;
      this.zone.run(() => this.conflict$$.next({ local, cloud }));
    });
  }

  /** One blob's cloud payload, or null when it has never been written. */
  private async readRemote(
    fs: FirestoreHandle,
    uid: string,
    blob: SyncedBlob,
  ): Promise<unknown> {
    const snap = await fs.api.getDoc(fs.api.doc(fs.db, 'users', uid, blob.collection, blob.doc));
    return snap.exists() ? unwrapBlob(snap.data()) : null;
  }

  /**
   * Merge one blob with its cloud copy and write back whichever sides moved.
   * Returns true when the local copy changed, which is what decides the reload.
   */
  private async reconcile(
    fs: FirestoreHandle,
    uid: string,
    blob: SyncedBlob,
    canAdopt: boolean,
    strategy: MergeStrategy = 'merge',
  ): Promise<boolean> {
    const ref = fs.api.doc(fs.db, 'users', uid, blob.collection, blob.doc);
    const local = readParsed(blob.key);
    const localRaw = JSON.stringify(local);

    // ─────────────────────────────────────────────────────────────────────────
    // The read this device does not have to make
    // ─────────────────────────────────────────────────────────────────────────
    // Binding reads every blob, and binding happens on every page load — eleven
    // document reads per navigation for a signed-in visitor, which on a site
    // people move around costs more than the sync itself does.
    //
    // Most of those reads answer "has anything changed?" with "no". If this
    // device pushed a blob a moment ago and the local copy has not moved since,
    // then the cloud copy is byte-for-byte what we put there, and there is
    // nothing to merge and nothing to write.
    //
    // The skip is only taken on the path where this device would write nothing.
    // That is what makes it safe: a stale read followed by a write would merge
    // against an old remote and `setDoc` the result over whatever a second
    // device had added in between — real data loss. A stale read followed by no
    // write can only ever mean this device notices another device's progress one
    // page load later than it might have.
    // An explicit choice from the dialog overrides the skip: the visitor has
    // asked for one side to win, and that has to be applied even to the blobs
    // this device already believes are in step.
    const fingerprint = this.cache.get<string>(this.blobKey(uid, blob));
    if (strategy === 'merge' && fingerprint === localRaw) {
      this.pushed.set(blob.key, localRaw);
      return false;
    }

    const snap = await fs.api.getDoc(ref);
    const remote = snap.exists() ? unwrapBlob(snap.data()) : null;

    // 'local' and 'cloud' are the visitor overruling the structural rules for
    // this one sign-in; they still fall back to whichever side exists when the
    // other does not, because "keep this device" cannot mean "delete the save".
    const merged = strategy === 'local'
      ? (local ?? remote)
      : strategy === 'cloud'
        ? (remote ?? local)
        : remote === null
          ? local
          : (blob.merge ?? mergeDeep)(remote, local);

    if (merged === null || merged === undefined) return false;

    const mergedRaw = JSON.stringify(merged);
    const moved = mergedRaw !== localRaw;

    if (moved && !canAdopt) {
      // Newer cloud state this tab has no safe way to take. Touch nothing:
      // writing it locally would be undone by the next flush from a service
      // still holding the old copy, and that stale flush would then be pushed
      // back up and undo the merge in the cloud as well. Recording it as
      // already-pushed keeps the push loop off it until the next page load,
      // which starts a fresh session and adopts it properly.
      this.pushed.set(blob.key, localRaw);
      return false;
    }

    if (moved) {
      try {
        localStorage.setItem(blob.key, mergedRaw);
      } catch { /* quota or private mode — the cloud copy is still correct */ }
    }

    // Silence when the cloud already agrees. Without this, every page load of
    // an unchanged save would cost nine writes for nothing.
    if (remote === null || mergedRaw !== JSON.stringify(remote)) {
      await fs.api.setDoc(ref, wrapBlob(merged));
    }
    this.pushed.set(blob.key, mergedRaw);
    // Local and cloud now agree on exactly this payload. Recording it lets the
    // next page load inside the TTL skip the read above — see the note there.
    this.cache.set(this.blobKey(uid, blob), mergedRaw, CACHE_TTL.cloudSave);
    return moved;
  }

  /** Cache key for one blob's agreed-with-cloud fingerprint, scoped per account. */
  private blobKey(uid: string, blob: SyncedBlob): string {
    return `cloud-save/${uid}/${blob.collection}/${blob.doc}`;
  }

  /** Is this tab still allowed to restart itself to pick up cloud state? */
  private canAdopt(): boolean {
    try {
      return sessionStorage.getItem(ADOPTED_FLAG) === null;
    } catch {
      // No sessionStorage means no loop guard, and an unguarded reload loop is a
      // far worse outcome than stale numbers until the next navigation.
      return false;
    }
  }

  private clearAdoptGuard(): void {
    try { sessionStorage.removeItem(ADOPTED_FLAG); } catch { /* private mode */ }
  }

  private clearRedirectPending(): void {
    try { sessionStorage.removeItem(REDIRECT_PENDING); } catch { /* private mode */ }
  }

  /**
   * Take the merged save and start again from it.
   *
   * The flag goes down *before* the reload, not after, so a merge that somehow
   * reports a change on every pass cannot reload twice.
   *
   * The delay is not cosmetic. The achievement fired a moment ago and its XP is
   * still inside `XpService`'s save debounce; the drop toast is also mid-
   * animation. `pagehide` flushes the award either way, but there is no reason
   * to make it do the work, and no reason to yank a drop off the screen the
   * frame after it appeared.
   */
  private adoptAndReload(): void {
    try {
      sessionStorage.setItem(ADOPTED_FLAG, '1');
    } catch {
      return;
    }
    this.zone.runOutsideAngular(() => {
      setTimeout(() => location.reload(), 1500);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Steady state
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Watch the satellite blobs and push the ones that moved.
   *
   * Polling, rather than each service announcing its own writes. The services
   * own their storage and none of them emit a "persisted" event; giving them all
   * one would mean nine edits to nine files that are otherwise untouched by this
   * feature, for a signal that a ten-second `JSON.stringify` of a few kilobytes
   * gets for free. The comparison is against what was last *uploaded*, so an
   * idle tab makes no Firestore calls at all.
   *
   * Progression is not in this loop — `FirestoreAdapter` throttles its own
   * writes on the same interval, driven by real awards rather than by a clock.
   */
  private startPushing(): void {
    this.stopPushing();
    // Outside Angular: a ten-second timer that usually finds nothing to do
    // should not wake change detection on every tick for the life of the tab.
    this.zone.runOutsideAngular(() => {
      this.pushTimer = setInterval(() => void this.pushAll(), CLOUD_WRITE_INTERVAL_MS);
    });

    window.addEventListener('pagehide', this.flushOnLeave);
    document.addEventListener('visibilitychange', this.flushOnHidden);
  }

  private stopPushing(): void {
    if (this.pushTimer !== null) {
      clearInterval(this.pushTimer);
      this.pushTimer = null;
    }
    window.removeEventListener('pagehide', this.flushOnLeave);
    document.removeEventListener('visibilitychange', this.flushOnHidden);
  }

  private readonly flushOnLeave = (): void => { void this.pushAll(); };

  /**
   * Leaving flushes; coming back pulls.
   *
   * Until this existed, a bound tab only ever pushed. Reconciling happened once,
   * at bind, and after that the desktop tab someone leaves open all day never
   * looked at the cloud again — so an evening on a phone was invisible on the
   * PC until the page happened to be reloaded, which on a site people navigate
   * by clicking around can be a very long time.
   *
   * Returning to a tab is the honest moment to check: it is exactly when
   * somebody has put one device down and picked another up, and it costs nothing
   * on the tabs nobody leaves.
   */
  private readonly flushOnHidden = (): void => {
    if (document.visibilityState === 'hidden') void this.pushAll();
    else void this.resync();
  };

  /**
   * Re-run the whole reconciliation against the cloud, mid-session.
   *
   * Push first, so the merge below runs against a cloud copy that already holds
   * this device's own work and cannot hand it back as a "change" — that would
   * reload the tab for nothing, every single time.
   */
  private async resync(): Promise<void> {
    const uid = this.status.uid;
    // A parked merge dialog is a question already on screen; a second pass would
    // ask it again underneath. An error state is left to the retry button, which
    // is the same operation with the visitor asking for it.
    if (!uid || !this.adapter || this.resyncing || this.decide) return;
    if (Date.now() - this.lastReconcileAt < RESYNC_INTERVAL_MS) return;

    this.resyncing = true;
    try {
      await this.pushAll();

      const fs = await this.firestore();
      // The read-skip exists to make routine page loads cheap. This pass is
      // asking for those reads, so its fingerprints have to go with it.
      this.cache.bustPrefix(`cloud-save/${uid}/`);

      const canAdopt = this.canAdopt();
      const changed = await this.reconcileAll(fs, uid, this.adapter, 'merge', canAdopt);
      this.markSynced();

      // Progress that arrived from the other device is now on disk under ten
      // services still holding the old copy. Same restart as at bind, same
      // once-per-session guard, and the same self-releasing exit when a later
      // pass finds nothing left to move.
      if (changed && canAdopt) this.adoptAndReload();
    } catch (err) {
      this.fail(err);
    } finally {
      this.resyncing = false;
    }
  }

  /**
   * Upload every blob whose serialised form has changed since its last upload.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY THIS READS BEFORE IT WRITES
   * ───────────────────────────────────────────────────────────────────────────
   * This used to `setDoc` the local blob outright, and that one line undid the
   * careful merge at the other end of the file. Binding reconciles both devices
   * correctly — and then, ten seconds later, this loop overwrote the result with
   * whatever one device happened to be holding.
   *
   * The shape of the bug from the visitor's side: play on a phone, earn 500
   * Gold, put it down. A desktop tab that has been open since the morning strikes
   * the anvil once, notices its economy blob moved, and uploads its own copy over
   * the phone's. The 500 Gold is gone, nothing reports an error, and both devices
   * still say "Synced" — because from each one's point of view it *is* synced.
   * Whichever device wrote last was simply the truth, which is not sync at all.
   *
   * So every push is now read-merge-write under the same rules the bind uses. The
   * merge is monotone — higher number, union of every set — so two devices
   * pushing in any order converge on the same answer, and a device that is behind
   * can no longer erase one that is ahead.
   *
   * The merged result is deliberately *not* written back to localStorage. Ten
   * services are holding their own copies in memory and would flush over it
   * within the second (see the note at the top of this file). Cloud state that
   * arrives here is left in the cloud, and the next page load — or the next
   * return to this tab, see {@link resync} — adopts it properly.
   *
   * The extra read only happens for blobs that actually moved, so an idle tab
   * still costs nothing.
   */
  private async pushAll(): Promise<void> {
    const uid = this.status.uid;
    if (!uid || this.pushing) return;
    this.pushing = true;

    try {
      // Cheap: resolves from the already-loaded handle after the first call.
      const fs = await this.firestore();

      for (const blob of SYNCED_BLOBS) {
        const raw = readRaw(blob.key);
        if (raw === null) continue;
        if (this.pushed.get(blob.key) === raw) continue;

        const local = readParsed(blob.key);
        if (local === null) {
          // Unparseable. The owning service is about to replace it; uploading a
          // blob we could not read would only spread the damage.
          this.pushed.set(blob.key, raw);
          continue;
        }

        const ref = fs.api.doc(fs.db, 'users', uid, blob.collection, blob.doc);
        const snap = await fs.api.getDoc(ref);
        const remote = snap.exists() ? unwrapBlob(snap.data()) : null;
        const merged = remote === null ? local : (blob.merge ?? mergeDeep)(remote, local);
        const mergedRaw = JSON.stringify(merged);

        // Silence when the cloud already holds exactly this.
        if (remote === null || mergedRaw !== JSON.stringify(remote)) {
          await fs.api.setDoc(ref, wrapBlob(merged));
        }
        this.pushed.set(blob.key, raw);

        // The fingerprint is what lets the next bind skip a read, so it may only
        // be recorded when the two copies genuinely agree. When the merge pulled
        // something in from another device, the cloud is now *ahead* of this
        // disk — and a fingerprint claiming otherwise would make the next bind
        // skip the very read that was going to adopt it.
        if (mergedRaw === raw) this.cache.set(this.blobKey(uid, blob), raw, CACHE_TTL.cloudSave);
        else this.cache.bust(this.blobKey(uid, blob));
      }
      this.markSynced();
    } catch (err) {
      this.fail(err);
    } finally {
      this.pushing = false;
    }
  }

  /**
   * Try again after a failure, from the button.
   *
   * A denied write is the interesting case and the reason this re-runs the whole
   * bind rather than just repeating the upload. The progress document only
   * accepts monotonic XP, so the write a second device makes after falling
   * behind is *supposed* to be rejected — pushing harder would never succeed.
   * Re-binding re-merges, which is the thing that actually resolves it.
   */
  async retry(): Promise<void> {
    if (!this.isBrowser) return;
    const { uid, email, displayName, photoURL } = this.status;
    if (!uid) return;

    this.status$$.next({ ...this.status, state: 'syncing', error: null });
    try {
      this.pushed.clear();
      // Re-merging is the whole point of retry, so every read-skip fingerprint
      // has to go with it — otherwise this would re-run the bind and skip the
      // very reads it is being asked to make again.
      this.cache.bustPrefix(`cloud-save/${uid}/`);
      await this.bind({ uid, email, displayName, photoURL });
    } catch (err) {
      this.fail(err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Plumbing
  // ───────────────────────────────────────────────────────────────────────────

  private auth(): Promise<typeof import('@angular/fire/auth')> {
    return (this.authModule ??= import('@angular/fire/auth'));
  }

  /**
   * The Firestore handle, loading the SDK on first call.
   *
   * `LazyFirestoreService` resolves to null on the server and when the SDK
   * cannot be fetched, and its other consumers silently degrade. This one
   * cannot: a cloud save that quietly does nothing is worse than one that says
   * it is not working, because the visitor believes their progress is safe.
   */
  private async firestore(): Promise<FirestoreHandle> {
    const handle = await this.lazyFirestore.get();
    if (!handle) throw new Error('[CloudSave] Firestore is unavailable.');
    return handle;
  }

  private markSynced(): void {
    this.zone.run(() => {
      this.status$$.next({ ...this.status, state: 'synced', lastSyncedAt: Date.now(), error: null });
    });
  }

  private fail(err: unknown): void {
    this.zone.run(() => {
      this.status$$.next({ ...this.status, state: 'error', error: describe(err) });
    });
  }

  private forgetBinding(): void {
    try {
      localStorage.removeItem(BOUND_UID_KEY);
      sessionStorage.removeItem(ADOPTED_FLAG);
      sessionStorage.removeItem(REDIRECT_PENDING);
    } catch { /* private mode */ }
  }

  /** Run when the browser is not busy, with a timeout so it always runs. */
  private whenIdle(fn: () => void): void {
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    }).requestIdleCallback;
    this.zone.runOutsideAngular(() => {
      if (ric) ric(fn, { timeout: 4000 });
      else setTimeout(fn, 1200);
    });
  }
}

/**
 * The Firebase app, initialising it if nothing else has yet.
 *
 * `provideFirebaseApp()` is still in the root injector so in practice the app
 * already exists — but this service reaches for auth outside of DI, and a bare
 * `getApp()` would make that correctness depend on injector ordering it has no
 * way to see. `LazyFirestoreService` guards the same call the same way.
 */
function firebaseApp() {
  return getApps().length ? getApp() : initializeApp(environment.firebase);
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readParsed(key: string): unknown {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // A blob that will not parse is a blob the owning service is about to
    // replace with a fresh one. Treating it as absent lets the cloud copy win,
    // which is the better of the two.
    return null;
  }
}

/** Popup could not open — an in-app browser, a webview, or a blocker. */
function isPopupUnavailable(err: unknown): boolean {
  const code = codeOf(err);
  return code === 'auth/popup-blocked'
    || code === 'auth/operation-not-supported-in-this-environment'
    || code === 'auth/web-storage-unsupported';
}

/** The visitor shut the popup or started a second one. Not an error to report. */
function isUserCancelled(err: unknown): boolean {
  const code = codeOf(err);
  return code === 'auth/popup-closed-by-user'
    || code === 'auth/cancelled-popup-request'
    || code === 'auth/user-cancelled';
}

function codeOf(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : '';
}

/**
 * A sentence the visitor can act on.
 *
 * Firebase error strings are written for whoever wrote the rules, not for
 * whoever hit them, and "Missing or insufficient permissions" in a header
 * dropdown tells somebody nothing except that something is broken.
 */
function describe(err: unknown): string {
  const code = codeOf(err);
  if (code === 'permission-denied' || code === 'auth/insufficient-permission') {
    return 'The cloud refused that write. Retry to re-merge.';
  }
  if (code === 'unavailable' || code === 'auth/network-request-failed') {
    return 'No connection. Your progress is safe on this device.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorised for sign-in.';
  }
  return 'Sync failed. Your progress is safe on this device.';
}
