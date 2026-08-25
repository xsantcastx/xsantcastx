/**
 * onboarding.service.ts — decides whether a visitor has ever been here, and
 * remembers the answer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT SAVED STATE
 * ─────────────────────────────────────────────────────────────────────────────
 * Every blob the game owns goes through `GameStateGateway`, which refuses a key
 * it does not know (`isStateKey`) and syncs the ones it does to Firestore. This
 * flag is deliberately outside that set. It is a property of a *browser*, not of
 * a player: somebody who finished the tutorial on their phone and then opens the
 * site on a laptop has never seen this laptop's screen, and syncing the flag
 * would silently drop them into a dashboard they have no context for. It is the
 * same category as the cookie decision, which is stored the same way.
 *
 * The consequence to keep in mind: clearing site data replays the tutorial. That
 * is correct — a browser with no save is a new visitor by every signal we have.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY "FIRST VISIT" IS NOT `!localStorage.getItem(...)` ON ONE KEY
 * ─────────────────────────────────────────────────────────────────────────────
 * Progression is spread across a dozen owner-per-blob keys and the list grows
 * every few releases, so "has this person played" cannot be asked of any single
 * one of them. It is asked of the two that are written the instant anything at
 * all happens — the progression ledger (any XP, any page visit) and the wallet
 * (any strike, any idle tick). A visitor with either has been here, whatever
 * else is or is not on disk, and neither can be true of a browser that has not
 * loaded the site before.
 *
 * The check runs once, at construction, and is cached. It must not be re-derived
 * later: the tutorial's own second step strikes the flame, which writes the
 * wallet, so a live re-read would report "returning visitor" halfway through the
 * tutorial and tear the overlay down mid-step.
 */
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PROGRESS_KEY } from '../gamification/gamification.model';
import { ECONOMY_KEY } from '../economy/economy.service';

/** Where the tutorial's own record lives. Not a `GameStateGateway` key. */
export const ONBOARDING_KEY = 'eclipse-onboarding';

/** How many screens the tutorial has. Drives the progress dots and the analytics step index. */
export const ONBOARDING_STEPS = 5;

/** What is written once the visitor is through, or has skipped. */
interface OnboardingRecord {
  /** True once the run ended, by either door. */
  done: boolean;
  /** Which step it ended on. 5 means completed, anything less means skipped. */
  lastStep: number;
  /** ISO instant, for a future "you joined on" line. */
  at: string;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Whether the overlay is on screen.
   *
   * Starts false on every platform including the browser, and is only ever
   * raised by {@link start}, which AppComponent calls after hydration. A signal
   * that read storage at construction would be true during the server render's
   * component tree too — where storage is unreadable and the answer is always
   * "new visitor" — and Angular would report the hydration mismatch when the
   * client disagreed.
   */
  readonly active = signal(false);

  /** 1-indexed, so it reads the same as the "step 2 of 5" it renders. */
  readonly step = signal(1);

  /** Frozen at construction. See the header note on why this is not re-read. */
  private readonly freshBrowser = this.detectFreshBrowser();

  /**
   * True when this browser has no trace of a previous session and no record of
   * having been shown the tutorial.
   */
  shouldOnboard(): boolean {
    return this.isBrowser && this.freshBrowser && !this.hasRecord();
  }

  /** Raise the overlay. No-op when it is already up. */
  start(): void {
    if (this.active()) return;
    this.step.set(1);
    this.active.set(true);
  }

  /** Advance one screen, or finish on the last one. */
  next(): void {
    const at = this.step();
    if (at >= ONBOARDING_STEPS) {
      this.finish(ONBOARDING_STEPS);
      return;
    }
    this.step.set(at + 1);
  }

  /**
   * End the run and never show it again.
   *
   * Called with the step it ended on: `ONBOARDING_STEPS` for somebody who walked
   * the whole thing, a lower number for somebody who used the skip. The record
   * is identical either way — the distinction is for the funnel, not for a
   * second chance at the tutorial.
   */
  finish(lastStep: number): void {
    this.active.set(false);
    if (!this.isBrowser) return;
    const record: OnboardingRecord = {
      done: true,
      lastStep,
      at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(record));
    } catch {
      // Quota, or Safari private mode, which throws on write. The overlay is
      // already down for this session; the cost of failing here is that it
      // returns on the next load, which is the right way round to be wrong.
    }
  }

  /** True once the visitor has been through, by either door. */
  hasRecord(): boolean {
    if (!this.isBrowser) return false;
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== null;
    } catch {
      // Unreadable storage. Treat as "no record" — a browser that cannot tell
      // us anything is indistinguishable from a new one.
      return false;
    }
  }

  /**
   * Storage-level "has anything ever happened here".
   *
   * Reads raw, rather than asking the owning services: both of them hydrate
   * lazily and publish a fully-populated zero state before they have touched
   * disk, so `xp.snapshot.xp === 0` is true for a returning visitor for as long
   * as it is true for a new one.
   */
  private detectFreshBrowser(): boolean {
    if (!this.isBrowser) return false;
    try {
      return localStorage.getItem(PROGRESS_KEY) === null
        && localStorage.getItem(ECONOMY_KEY) === null;
    } catch {
      return false;
    }
  }
}
