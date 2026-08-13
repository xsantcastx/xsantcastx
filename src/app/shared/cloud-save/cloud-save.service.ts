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
 * HOW CLOUD STATE IS ADOPTED, AND WHY IT IS NOT A RELOAD ANY MORE
 * ─────────────────────────────────────────────────────────────────────────────
 * Eighteen services hold their state in memory and flush it to localStorage.
 * They read it once, on first injection, and never look again — which is correct
 * for a store only they write to, and exactly wrong the moment a merge rewrites
 * that store underneath them.
 *
 * This used to be handled by reloading the tab, on the reasoning that a reload is
 * one line and cannot be subtly wrong. It was wrong, and it was the whole bug:
 *
 *   `location.reload()` fires `pagehide`. `EconomyService` and `XpService` both
 *   flush their in-memory ledger on `pagehide` — the *pre-merge* ledger, because
 *   nothing had told them the disk had moved. So the last write before the tab
 *   restarted was always the stale copy, and the reload read it straight back.
 *
 * The ledger did not even need the unload to lose it. `EconomyService` settles
 * idle Gold on a one-second tick behind a five-second write throttle, so on most
 * sign-ins the merged blob was overwritten within a second of being written,
 * long before the reload it was waiting for. Both devices then reported "Synced"
 * while each kept its own Gold — and from each device's point of view it *was*
 * synced, because the cloud copy was correct and the merge really had happened.
 * Only the adoption never landed.
 *
 * So the services are now asked directly, through `LocalSaveRegistry`: flush
 * before the merge reads their blob, rehydrate in the same tick as the write.
 * That closes the window a stale flush used to land in, and it makes adoption a
 * republish rather than a restart — the numbers on screen change in place. The
 * reload, the once-per-session guard it needed, and the whole class of blobs that
 * "could not safely be adopted in this tab" all go with it.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FirestoreHandle, LazyFirestoreService } from '../lazy-firestore.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { MergeConflict, MergeStrategy } from './cloud-save.model';

/** Remembers across reloads that this browser is bound, so sync resumes itself. */
const BOUND_UID_KEY = 'cloud-save-uid';
/**
 * Left over from the adopt-reload this file no longer does.
 *
 * Removed rather than repurposed, but still cleared on unbind: a browser that
 * signed in under the old build has the flag set in sessionStorage, and leaving
 * it behind costs nothing but is untidy. Nothing reads it any more.
 */
const LEGACY_ADOPTED_FLAG = 'cloud-save-adopted';
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
  private readonly gateway = inject(GameStateGateway);
  private readonly eggs = inject(EasterEggService);
  private readonly zone = inject(NgZone);

  private readonly status$$ = new BehaviorSubject<SyncStatus>(SIGNED_OUT);
  readonly status$: Observable<SyncStatus> = this.status$$.asObservable();

  /**
   * Set when signing in found two saves that each hold something the other does
   * not, and the visitor has to say which one wins. Null the rest of the time.
   * The bind is genuinely parked on this — see {@link ask}.
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
    // finish and unwind before the detach below takes the gateway's account away.
    if (this.decide) this.resolveConflict('merge');

    // `detach` sends whatever is still inside the debounce window before letting
    // go. This is the one moment the visitor is explicitly thinking about whether
    // their progress is safe, and it is also the moment they may be handing the
    // machine to somebody else.
    await this.gateway.detach();
    this.forgetBinding();

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
   * Hand this account to the gateway, which is what actually owns the save now.
   *
   * Runs on sign-in and on every subsequent load. There is no separate
   * first-time path: the pull is the same operation whether the cloud copy is
   * absent (first device — this one seeds it), behind (this device has been doing
   * the work) or ahead (another device has). Doing it every load is what makes
   * moving between a phone and a PC mid-session work at all.
   *
   * Everything this method used to do itself — reading nineteen documents,
   * merging each against its local copy, writing both sides back, and running a
   * ten-second push loop — is now one `attach` call. What is left here is the
   * part that is genuinely about a *session*: the uid, the status the header
   * renders, and the one question the structural rules cannot answer alone.
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

    // The gateway decides whether the question is even real and calls back only
    // when it is. Parking on the dialog happens inside `ask`, so a visitor who
    // never sees one never waits on anything.
    await this.gateway.attach(user.uid, fs, conflict => this.ask(conflict));

    this.markSynced();
    void this.eggs.trigger(CLOUD_SAVE_EGG);
  }

  /**
   * Put a conflict on screen and wait for an answer.
   *
   * The bind is genuinely parked on this promise — see {@link resolveConflict}.
   * Anything other than a real choice resolves to 'merge', which is the option
   * that cannot lose anybody anything.
   */
  private ask(conflict: MergeConflict): Promise<MergeStrategy> {
    return new Promise<MergeStrategy>(resolve => {
      this.decide = resolve;
      this.zone.run(() => this.conflict$$.next(conflict));
    });
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
      await this.bind({ uid, email, displayName, photoURL });
    } catch (err) {
      this.fail(err);
    }
  }

  private clearRedirectPending(): void {
    try { sessionStorage.removeItem(REDIRECT_PENDING); } catch { /* private mode */ }
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
      sessionStorage.removeItem(LEGACY_ADOPTED_FLAG);
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
