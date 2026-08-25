/**
 * forged-today.service.ts — how many browsers have opened the site today.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT REUSES `site-stats` INSTEAD OF A NEW COLLECTION
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious shape for this is `stats/daily/{date}`, which would need a new
 * rule in firestore.rules and therefore a `firebase deploy --only
 * firestore:rules` before the widget could count anything — and a rules change
 * that ships in a build which then fails never deploys at all, silently, with
 * every later push skipping it.
 *
 * `site-stats/{statId}` is a wildcard whose rule already enforces exactly the
 * schema this needs: `{ count: number, lastVisit: string }`, create only at
 * `count == 1`, update only at `resource.data.count + 1`. Writing to
 * `site-stats/daily-2026-08-25` is therefore already legal, already
 * schema-checked, and already rate-shaped the same way the lifetime visit
 * counter is. This ships with no rules change and no deploy ordering to get
 * wrong. The date is in the document id rather than a field because the rule
 * pins the key set to exactly two names and would reject a third.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE NUMBER IS ALLOWED TO BE SMALL
 * ─────────────────────────────────────────────────────────────────────────────
 * This publishes whatever the real count is, including 1. Rounding it up,
 * hiding it below a threshold, or seeding it with a floor would make it a
 * decoration that asserts something untrue, and the one thing a three-visitor
 * site cannot afford to spend is its credibility. The component decides how to
 * present a small number; the service never lies about it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT "UNIQUE" MEANS HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * One browser per calendar day, in that browser's own local timezone, deduped
 * through localStorage rather than sessionStorage. sessionStorage would count a
 * visitor once per tab, so opening three realms in three tabs would report three
 * Keepers — the exact inflation this is built not to do. The trade is that a
 * visitor in incognito, or one who clears storage, counts again; both are
 * indistinguishable from a new browser by every signal available to a page with
 * no login.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from '../firestore-cache.service';
import { whenAppCheckReady } from '../../app-check.bootstrap';

/** Local-day dedupe marker: the last date this browser was counted on. */
const COUNTED_KEY = 'eclipse-forged-day';

/**
 * How often the displayed number is re-read while the tab is on screen.
 *
 * The refresh is paused entirely while the tab is hidden. Without that, every
 * background tab anybody had left open would poll Firestore for the life of the
 * session — which is how the read bill on this project has been run up before.
 */
export const FORGED_REFRESH_MS = 60_000;

/** The local calendar date, as `YYYY-MM-DD`. Not UTC: see the note on uniqueness. */
export function localDayKey(now: Date): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable({ providedIn: 'root' })
export class ForgedTodayService {
  private readonly lazyFirestore = inject(LazyFirestoreService);
  private readonly cache = inject(FirestoreCacheService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * How many browsers have opened the site today, or null while unknown.
   *
   * null and 0 are deliberately different states. null means "we have not been
   * told" — during prerender, before the first read lands, or when Firestore is
   * unreachable — and the widget renders nothing for it. 0 would be a claim,
   * and it is one this can never truthfully make: the visitor reading the number
   * is themselves in it.
   */
  readonly count$ = new BehaviorSubject<number | null>(null);

  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private day = '';

  /** Count this browser and begin publishing the total. Idempotent. */
  async start(): Promise<void> {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    this.day = localDayKey(new Date());

    // Paint the last known value before touching the network, so the widget is
    // never a blank that fills in a second later.
    const cached = this.cache.getStale<number>(this.cacheKey());
    if (cached !== null) this.count$.next(cached);

    await this.recordToday();
    await this.refresh();

    this.watchVisibility();
    this.arm();
  }

  /** Stop polling. For teardown in tests and for the hidden-tab pause. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private cacheKey(): string {
    return `site-stats/${this.docId()}`;
  }

  private docId(): string {
    return `daily-${this.day}`;
  }

  /**
   * Add this browser to today's count, at most once per local day.
   *
   * Write-only, for the same reason the lifetime counter is: `increment(1)` is
   * resolved by the server, so it costs no read and is atomic against every
   * other visitor arriving in the same second. On a document that does not exist
   * yet, the increment resolves to 1, which is exactly the value the `create`
   * branch of the `site-stats` rule requires.
   */
  private async recordToday(): Promise<void> {
    let already = false;
    try {
      already = localStorage.getItem(COUNTED_KEY) === this.day;
    } catch {
      // Unreadable storage: fall through and count. Over-counting a browser that
      // cannot remember it was counted is better than a widget stuck at zero.
    }
    if (already) return;

    // App Check initialises on idle, so an unguarded write from a service that
    // starts during bootstrap can go out before the token exists. Harmless while
    // enforcement is off and a silent breakage the day it is switched on.
    await whenAppCheckReady();

    try {
      const handle = await this.lazyFirestore.get();
      if (!handle) return;
      const { db, api } = handle;
      await api.setDoc(
        api.doc(db, 'site-stats', this.docId()),
        { count: api.increment(1), lastVisit: new Date().toISOString() },
        { merge: true },
      );
      try {
        localStorage.setItem(COUNTED_KEY, this.day);
      } catch {
        // See above — a browser that cannot record the marker counts again
        // tomorrow at worst, and the widget still works.
      }
    } catch (err: unknown) {
      // permission-denied means the rules have not been deployed to this
      // project yet, which is the normal state in a local emulator. Silent, for
      // the same reason VisitCounterService is: a red console on a decoration
      // trains people to ignore the console.
      if (!isPermissionDenied(err)) console.warn('[ForgedToday] write degraded:', err);
    }
  }

  /** Re-read the total through the cache and publish it. */
  private async refresh(): Promise<void> {
    try {
      const handle = await this.lazyFirestore.get();
      if (!handle) return;
      const { db, api } = handle;
      const ref = api.doc(db, 'site-stats', this.docId());

      const total = await this.cache.through(
        this.cacheKey(),
        CACHE_TTL.forgedToday,
        async () => {
          const snap = await api.getDoc(ref);
          return snap.exists() ? ((snap.data()['count'] as number) ?? 0) : 0;
        },
      );

      // This browser is in the server's count but not necessarily in a cached
      // copy that predates it, so the floor is 1 — the reader is looking at a
      // page they have themselves just been counted on, and a widget telling
      // them nobody has been here today would be visibly wrong.
      const shown = Math.max(1, total);

      // The read resolves outside the Angular zone; a subject pushed from there
      // updates no template.
      this.lazyFirestore.runInZone(() => this.count$.next(shown));
    } catch (err: unknown) {
      if (!isPermissionDenied(err)) console.warn('[ForgedToday] read degraded:', err);
    }
  }

  private arm(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      // Local midnight while the tab is open moves the counter to a new
      // document rather than carrying yesterday's total into today.
      const today = localDayKey(new Date());
      if (today !== this.day) {
        this.day = today;
        void this.recordToday();
      }
      void this.refresh();
    }, FORGED_REFRESH_MS);
  }

  /** Poll only while the tab is on screen, and catch up the moment it returns. */
  private watchVisibility(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else {
        void this.refresh();
        this.arm();
      }
    });
  }
}

/** True for the one Firestore failure that is an expected deployment state. */
function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? e?.message ?? '';
  return typeof code === 'string' && code.indexOf('permission-denied') >= 0;
}
