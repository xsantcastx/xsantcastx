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
import { ECONOMY_STATE_KEY, GameStateGateway } from '../save/game-state.gateway';
import { PROGRESS_KEY } from '../gamification/progress-storage.service';
import { MergeConflict, SaveSummary, summarise } from './cloud-save.model';
// Type-only, and deliberately so: a value import here would pull gm.model —
// and everything the /admin console needs from it — into the initial bundle for
// every visitor. The runtime half goes through the dynamic import in
// `publishDirectoryRow` / `readBan` below. See gm-sync.ts.
import type { BanRecord } from './gm.model';
import { whenAppCheckReady } from '../../app-check.bootstrap';
import { ACCOUNT_SEEN_KEY, GUEST_FLAG_KEY, characterStorageKey, readActiveCharacter } from '../save/character-scope';

/** Remembers across reloads that this browser is bound, so sync resumes itself. */
const BOUND_UID_KEY = 'cloud-save-uid';
/** The local e2e's fake cloud (fake-cloud.ts) is on: localhost, a WebDriver browser, `eclipse-cloud-fake` = a uid. */
function fakeCloudUid(): string | null {
  try {
    if (typeof navigator === 'undefined' || !navigator.webdriver || !['localhost', '127.0.0.1'].includes(location.hostname)) return null;
    const uid = localStorage.getItem('eclipse-cloud-fake');
    return uid && /^[A-Za-z0-9_-]{1,64}$/.test(uid) ? uid : null;
  } catch { return null; }
}
/** sessionStorage: `<uid>@<ms>` — this tab reloaded to put a signed-in page into the account's saves (never a loop). */
export const PROFILE_FIX_KEY = 'eclipse-profile-fix';
/** No second such reload in one tab within this (ms). */
const PROFILE_FIX_MS = 60_000;
/** Signed in but not attached for this long: recover (recoverAttach). */
export const ATTACH_WATCH_MS = 8_000;
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
/**
 * Was this browser signed in when it was last used (or is it on its way back from a Google redirect)? Synchronous, so
 * the play lobby can open the character list for a returning player without flashing the title screen first.
 */
export function hasBoundAccount(): boolean {
  try {
    return localStorage.getItem(BOUND_UID_KEY) !== null || sessionStorage.getItem(REDIRECT_PENDING) !== null;
  } catch {
    return false;
  }
}
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
   * Set just after a sign-in that actually brought cloud progress down onto
   * this device. Nothing is parked on it — it is a notice with an undo behind
   * it, not a question, and the visitor is already playing by the time they
   * see it.
   */
  private readonly merged$$ = new BehaviorSubject<MergeConflict | null>(null);
  readonly merged$: Observable<MergeConflict | null> = this.merged$$.asObservable();

  /**
   * The ban tombstone on the signed-in account, if there is one.
   *
   * A separate stream rather than a field on `SyncStatus` on purpose. Every
   * consumer of that interface would have had to grow a case for it, and the
   * two answer different questions: `SyncStatus` is "is this browser talking to
   * the cloud", and this is "is the account it is talking about allowed to".
   * A banned session is a perfectly healthy sync — the writes are what stop.
   *
   * Null means "not banned or not signed in", which are the same thing to every
   * caller. `SiteNoticeComponent` is the only reader today.
   */
  private readonly ban$$ = new BehaviorSubject<BanRecord | null>(null);
  readonly ban$: Observable<BanRecord | null> = this.ban$$.asObservable();

  get status(): SyncStatus { return this.status$$.value; }
  get signedIn(): boolean { return this.status$$.value.uid !== null; }
  get merged(): MergeConflict | null { return this.merged$$.value; }
  get ban(): BanRecord | null { return this.ban$$.value; }

  private booted = false;

  // ── Signed in ⇒ attached (owner bug 2026-10-26: "Sign in to trade" while signed in) ───────────────────────────────
  // The status can say "signed in" (a uid) while the gateway is not attached: a page still in the guest's profile
  // (character-scope "Profiles"), a bind that threw before the attach (a lazy chunk missing after a deploy, Firestore
  // out of reach), or one stuck waiting. Nothing then reaches the account — the worst failure cloud save has, because
  // the player believes it is safe. A watch notices it and recovers: a guest-profile page reloads into the account's
  // saves (the guest flag cleared first, so the next page can only be the account's); an account page binds again,
  // then reloads once. Each reload at most once per tab per minute ({@link PROFILE_FIX_KEY}): never a loop.
  private watchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Binds and resumes in flight (a resume binds inside itself). */
  private binding = 0;
  private rebinds = 0;
  private waits = 0;
  private readonly stuck$$ = new BehaviorSubject<boolean>(false);
  /** Signed in, but the save has not reached the account yet past the watch (the HUD says so plainly). */
  readonly stuck$: Observable<boolean> = this.stuck$$.asObservable();
  get stuck(): boolean { return this.stuck$$.value; }
  /** Signed in but not (yet) attached to the account: saves are not reaching it. */
  get connecting(): boolean { return this.signedIn && !this.gateway.attached; }

  private readonly watchSub = this.status$$.subscribe(st => { if (this.isBrowser) this.watchAttach(st); });

  ngOnDestroy(): void {
    this.watchSub.unsubscribe();
    if (this.watchTimer) { clearTimeout(this.watchTimer); this.watchTimer = null; }
  }

  private watchAttach(st: SyncStatus): void {
    if (!st.uid || this.gateway.attached) {
      if (this.watchTimer) { clearTimeout(this.watchTimer); this.watchTimer = null; }
      if (this.stuck$$.value) this.zone.run(() => this.stuck$$.next(false));
      return;
    }
    if (this.watchTimer) return;
    this.zone.runOutsideAngular(() => {
      this.watchTimer = setTimeout(() => { this.watchTimer = null; this.recoverAttach(); }, ATTACH_WATCH_MS);
    });
  }

  /**
   * Signed in and still not attached: put it right. Public so a caller that needs the account now (a trade, a drop)
   * can ask at once instead of waiting for the watch.
   */
  recoverAttach(): void {
    if (!this.isBrowser || !this.signedIn || this.gateway.attached) return;
    const uid = this.status.uid as string;
    if (this.gateway.profile === 'guest') {
      // The page plays the guest's saves while signed in: whatever was played here meanwhile is stamped as this
      // account's (character-scope recovery: offered back on the account's page), then into the account's profile.
      this.gateway.noteSignedIn(uid);
      if (!this.reloadIntoAccount(uid)) this.markStuck();
      return;
    }
    // Offline, or a bind still on its way (a slow network): wait a little longer before anything drastic.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline || (this.binding > 0 && this.waits < 3)) {
      this.waits += 1;
      this.watchAttach(this.status);
      return;
    }
    if (this.binding === 0 && this.rebinds < 1) {
      // The bind failed (it threw before the attach): once more, from the persisted session.
      this.rebinds += 1;
      void this.resume();
      return;
    }
    // Still not attached after a second bind (or one that hangs): a fresh page fetches fresh code and binds anew.
    if (!this.reloadIntoAccount(uid)) this.markStuck();
  }

  private markStuck(): void {
    this.zone.run(() => {
      this.stuck$$.next(true);
      if (this.status.state !== 'error') this.status$$.next({ ...this.status, state: 'error', error: 'Your save could not reach your account. Reload the page to try again.' });
    });
  }

  /**
   * Reload into the account's saves: the guest flag goes first (with it gone the next page cannot boot the guest's
   * profile, even if a write of the binding failed on a full disk). False when this tab already did so within
   * {@link PROFILE_FIX_MS} — the caller says so instead of reloading again.
   */
  private reloadIntoAccount(uid: string): boolean {
    try {
      const last = sessionStorage.getItem(PROFILE_FIX_KEY);
      const [who, at] = (last ?? '').split('@');
      if (who === uid && Date.now() - Number(at) < PROFILE_FIX_MS) return false;
      sessionStorage.setItem(PROFILE_FIX_KEY, `${uid}@${Date.now()}`);
    } catch {
      return false;
    }
    try {
      localStorage.removeItem(GUEST_FLAG_KEY);
      localStorage.setItem(BOUND_UID_KEY, uid);
    } catch { /* the flag removal is what matters; the binding is written again on the next bind */ }
    void this.gateway.settleForReload().catch(() => undefined).then(() => this.reloadPage());
    return true;
  }

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
    this.binding += 1;
    try { await this.resumeNow(); } finally { this.binding -= 1; this.watchAttach(this.status); }
  }

  private async resumeNow(): Promise<void> {
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
      // An iPhone/iPad home-screen app (standalone PWA) can open the popup but never gets its answer back — the
      // sign-in sat on "syncing" forever. Go straight to the redirect there; authDomain is our own origin, so the
      // /__/auth/handler round trip stays inside the app.
      let viaRedirect = this.popupUnreliable || isIosStandalone();

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

    // Nothing is parked on a dialog any more — signing in reconciles on its
    // own — but the notice is about an account that is going away, so it goes
    // with it.
    this.merged$$.next(null);
    // The ban belongs to the account, not the browser. Signing out of a banned
    // account has to clear the notice, or the next visitor on this machine
    // reads somebody else's sanction.
    this.ban$$.next(null);

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
    this.binding += 1;
    try { await this.bindNow(user); } finally { this.binding -= 1; this.watchAttach(this.status); }
  }

  private async bindNow(user: AuthUser): Promise<void> {
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
      // From now on this browser's unprefixed saves are an account's: a guest here gets its own (character-scope).
      localStorage.setItem(ACCOUNT_SEEN_KEY, '1');
    } catch { /* private mode; sync works for this session only */ }

    // Signed in from a guest page (character-scope "Profiles"): this page holds the guest's saves, never to be merged
    // into the account. Reload: the next page boots into the account's profile and resumes this binding. The guest
    // flag is cleared first, so the next page can only be the account's (no loop: reloadIntoAccount).
    if (this.gateway.profile === 'guest') {
      if (!this.reloadIntoAccount(user.uid)) this.markStuck();
      return;
    }

    try {
      // App Check is idle-scheduled and used to settle "ready" with null if
      // Firebase was not up yet. Wait here so the first signed-in read carries
      // a token when enforcement is on.
      await this.awaitAppCheck();
      const fs = await this.firestore();
      // Signing in does not ask. Reconciling keeps the higher of every
      // monotone counter and replays both ledgers, so combining the two saves
      // is the only answer that cannot cost anybody anything — and a dialog
      // whose other two buttons can only lose something is not a question
      // worth stopping a sign-in for. The gateway keeps a before picture of
      // this device first, and `merged$` offers the way back afterwards.
      const before = summarise(
        safeRead(PROGRESS_KEY),
        safeRead(ECONOMY_STATE_KEY),
      );
      await this.gateway.attach(user.uid, fs);
      const after = summarise(
        safeRead(PROGRESS_KEY),
        safeRead(ECONOMY_STATE_KEY),
      );
      // Only worth mentioning when the cloud actually brought something down.
      if (this.gateway.deviceSnapshot() && changed(before, after)) {
        this.zone.run(() => this.merged$$.next({ local: before, cloud: after }));
      }
    } catch (err) {
      console.error('[CloudSave] bind failed', err);
      throw err;
    }

    this.markSynced();
    void this.eggs.trigger(CLOUD_SAVE_EGG);

    // Both of these are deliberately un-awaited and individually caught. They
    // are bookkeeping for a console one person opens; a Firestore hiccup in
    // either must not turn a successful sign-in into a thrown bind, which is
    // what awaiting them here would do. `bind()` has already reported success
    // by this line, and that is the correct order: the save is synced whether
    // or not the directory hears about it.
    void this.publishDirectoryRow(user);
    void this.readBan(user.uid);
  }

  /**
   * Write this account's row in the player directory.
   *
   * Called at the end of `bind()` and nowhere else — once per sign-in, which is
   * the cadence the row's `lastActive` field is defined in terms of. Putting it
   * on the gateway's four-second flush instead would make the console's "active
   * today" column exact and cost a document write every four seconds per
   * signed-in player, which is a bill for a number nobody reads to the minute.
   *
   * It runs *after* `attach()`, and that ordering is the whole correctness
   * argument: before the merge, `PROGRESS_KEY` and `ECONOMY_STATE_KEY` hold
   * whatever this device happened to have, which on a phone that has not been
   * opened in a week is not the account's Gold. After it, both are the
   * reconciled truth.
   */
  private async publishDirectoryRow(user: AuthUser): Promise<void> {
    try {
      const fs = await this.firestore();
      const { publishDirectoryRow } = await import('./gm-sync');
      await publishDirectoryRow(
        fs,
        { uid: user.uid, email: user.email, displayName: user.displayName },
        safeRead(PROGRESS_KEY),
        // The ledger is enveloped in Firestore but plain in localStorage, which
        // is what `safeRead` returns — so this is the ledger itself, not `{ v }`.
        safeRead(ECONOMY_STATE_KEY),
      );
    } catch (err) {
      // A denied write here means the rules have not been deployed yet, which
      // is an expected state between a code deploy and a rules deploy. The
      // player loses nothing by it; the console loses one row.
      this.quietly('directory publish', err);
    }
  }

  /**
   * Read the ban tombstone for the signed-in account.
   *
   * The client cannot enforce anything — `firestore.rules` does that, and would
   * do it whether or not this method existed. What this buys is the difference
   * between a banned player seeing a reason and a banned player seeing a game
   * that silently stops saving, which from the inside is indistinguishable from
   * the site being broken.
   */
  private async readBan(uid: string): Promise<void> {
    try {
      const fs = await this.firestore();
      const { readBanRecord } = await import('./gm-sync');
      const record = await readBanRecord(fs, uid);
      this.zone.run(() => this.ban$$.next(record));
    } catch (err) {
      // Failing to read the ban must never lock anybody out — the enforcement
      // lives in the rules, so the safe direction here is "assume not banned"
      // and let the server refuse the write if that guess was wrong.
      this.quietly('ban read', err);
    }
  }

  /**
   * Log a non-fatal Firestore failure without the console noise a real error
   * deserves. House rule: a missing rule is a
   * deployment state, not a bug, and it must not look like one.
   */
  private quietly(label: string, err: unknown): void {
    const code = (err as { code?: string } | null)?.code ?? '';
    if (code === 'permission-denied' || code === 'unavailable') return;
    console.warn(`[CloudSave] ${label} skipped:`, err);
  }

  /** Dismiss the "we combined them" notice without changing anything. */
  /**
   * The signed-in player's Firebase ID token, for the Hearth room (protocol 4: it binds the room's identity to this
   * uid). Null signed out, or when the token cannot be had (the room then takes the Keeper as a guest).
   */
  async idToken(): Promise<string | null> {
    if (!this.isBrowser || !this.signedIn) return null;
    try {
      const { getAuth } = await this.auth();
      const user = getAuth(firebaseApp()).currentUser as { getIdToken?: () => Promise<string> } | null;
      return user?.getIdToken ? await user.getIdToken() : null;
    } catch { return null; }
  }

  dismissMerged(): void {
    this.merged$$.next(null);
  }

  /**
   * Wipe this visitor's save — this device and the account — as one operation.
   *
   * The single entry point for a full reset, and the reason it is here rather
   * than left to the nineteen per-service `reset()` methods: those wipe their
   * own blob and nothing else, so calling them in a loop is nineteen unordered
   * deletions racing the pull loop, which is how a reset used to come back a
   * minute after it was taken. `GameStateGateway.resetAll()` stamps the wipe
   * before it destroys anything and reconciles that stamp on every subsequent
   * attach, so the wipe survives being taken offline, on a cold mobile load
   * before the Firestore SDK has finished arriving, or on a tab that is closed
   * halfway through.
   *
   * Irreversible on purpose: the sign-in "before picture" is an undo for a
   * *merge*, and `resetAll` drops it rather than leaving a one-click path back
   * to the save that was just deleted.
   */
  async resetProgress(): Promise<void> {
    await this.gateway.resetAll();
  }

  /**
   * Put this device back the way it was before signing in, and make that the
   * account's save. The undo behind the notice.
   */
  async undoMerge(): Promise<boolean> {
    const ok = await this.gateway.restoreDeviceSnapshot();
    this.merged$$.next(null);
    return ok;
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

  /** Seam for tests: bind must not open Firestore until this settles. */
  private awaitAppCheck(): Promise<unknown> {
    if (fakeCloudUid()) return Promise.resolve(null);
    return whenAppCheckReady();
  }

  private auth(): Promise<typeof import('@angular/fire/auth')> {
    // The local e2e's stand-in (fake-cloud.ts): localhost, a WebDriver browser and a flag only, loaded only then.
    const fake = fakeCloudUid();
    if (fake) return (this.authModule ??= import('./fake-cloud').then(m => { this.exposeFake(); return m.fakeAuthModule(fake) as typeof import('@angular/fire/auth'); }));
    return (this.authModule ??= import('@angular/fire/auth'));
  }
  /** The e2e's view of the binding (fake cloud only). */
  private exposeFake(): void {
    (window as unknown as Record<string, unknown>)['__cloudFake'] = { attached: () => this.gateway.attached, profile: () => this.gateway.profile, signedIn: () => this.signedIn, stuck: () => this.stuck };
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
    if (fakeCloudUid()) return (await import('./fake-cloud')).fakeFirestore() as unknown as FirestoreHandle;
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

  /** A full reload (its own method so a spec can stand in for it). */
  reloadPage(): void { location.reload(); }

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
/** Exported so the status sentences can be pinned by a spec. */
export function describeSyncError(err: unknown): string {
  const code = codeOf(err);
  const message = messageOf(err);
  if (isAppCheckFailure(code, message)) {
    return 'Cloud security check failed. Retry in a moment.';
  }
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

function describe(err: unknown): string {
  return describeSyncError(err);
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err ?? '');
}

function isAppCheckFailure(code: string, message: string): boolean {
  const haystack = `${code} ${message}`.toLowerCase();
  return haystack.includes('app-check')
    || haystack.includes('appcheck')
    || haystack.includes('app check');
}

/**
 * One saved blob of the character this page plays, or null if it is absent or unreadable. Both keys read here are
 * per character (shared/save/character-scope.ts), so the key is mapped the way the gateway maps it.
 */
function safeRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(characterStorageKey(key, readActiveCharacter(localStorage)));
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Did reconciling actually bring anything down onto this device?
 *
 * Only the counters that can rise on a pull. Gold is left out for the same
 * reason it is left out of `isConflict`: idle earnings move it on their own,
 * and a notice that fired because a second of idle Gold ticked by would be
 * noise attached to an undo nobody wants.
 */
function changed(before: SaveSummary, after: SaveSummary): boolean {
  return after.xp > before.xp
    || after.level > before.level
    || after.achievements > before.achievements;
}

/** An iOS/iPadOS home-screen web app, where popup sign-in never reports back. */
function isIosStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const standalone = nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && standalone;
}
