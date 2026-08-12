import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from '../firestore-cache.service';
import { BehaviorSubject } from 'rxjs';
import { whenAppCheckReady } from '../../app-check.bootstrap';

export interface MilestoneEvent {
  count: number;
  milestone: number;
  label: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary';
}

const MILESTONES = [
  { at: 10,     label: 'First Wave',        tier: 'bronze' as const },
  { at: 50,     label: 'Rising Signal',      tier: 'bronze' as const },
  { at: 100,    label: 'Triple Digits',      tier: 'silver' as const },
  { at: 250,    label: 'Quarter K',          tier: 'silver' as const },
  { at: 500,    label: 'Half K',             tier: 'gold' as const },
  { at: 1000,   label: 'Kilo Visitor',       tier: 'gold' as const },
  { at: 2500,   label: 'Cyber Swarm',        tier: 'gold' as const },
  { at: 5000,   label: 'Neon Legion',        tier: 'diamond' as const },
  { at: 10000,  label: 'Decawave',           tier: 'diamond' as const },
  { at: 25000,  label: 'Quantum Surge',      tier: 'legendary' as const },
  { at: 50000,  label: 'Singularity',        tier: 'legendary' as const },
  { at: 100000, label: 'Transcendence',      tier: 'legendary' as const },
];

/** Where the displayed total is cached between sessions. */
const VISITS_CACHE_KEY = 'site-stats/visits';

@Injectable({ providedIn: 'root' })
export class VisitCounterService {
  private lazyFirestore = inject(LazyFirestoreService);
  private cache = inject(FirestoreCacheService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  milestone$ = new BehaviorSubject<MilestoneEvent | null>(null);
  visitCount$ = new BehaviorSubject<number>(0);

  /**
   * Count this visit, and publish a total to display.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY THIS NO LONGER READS BEFORE IT WRITES
   * ───────────────────────────────────────────────────────────────────────────
   * This used to run a transaction: read the counter, add one, write it back.
   * That is the correct shape for a value you have to act on, and the wrong one
   * for a value you are only going to print. It cost a read on every session for
   * a number whose exact value nobody can check by looking at it.
   *
   * `increment(1)` is a write that needs no read — the server does the addition,
   * and it is atomic against every other visitor doing the same thing, which the
   * transaction was really there for. The displayed total then comes from a
   * cached read that refreshes twice an hour instead of once per visitor.
   *
   * The trade is that the number on screen can be up to half an hour behind, and
   * a milestone can be noticed slightly late. Both are fine: this is a decoration
   * on a personal site, not an analytics figure anybody reports against.
   */
  async recordVisit(): Promise<void> {
    if (!this.isBrowser) return;

    // Paint whatever the last session left behind before touching the network,
    // so the number is on screen immediately rather than after a round trip.
    const cached = this.cache.getStale<number>(VISITS_CACHE_KEY);
    if (cached !== null) this.visitCount$.next(cached);

    // Only count once per session
    if (sessionStorage.getItem('visit-counted')) {
      return;
    }

    // App Check now initializes on idle rather than at bootstrap, so this
    // write — which fires from AppComponent.ngOnInit — would otherwise race
    // ahead of it and go out without a token. Harmless while App Check
    // enforcement is off, but it would silently break the counter the moment
    // enforcement is switched on in the Firebase console. Waiting costs
    // nothing here: the visit count is not on any rendering path.
    await whenAppCheckReady();

    try {
      const handle = await this.lazyFirestore.get();
      if (!handle) return;
      const { db, api } = handle;

      const ref = api.doc(db, 'site-stats', 'visits');

      // Write-only. The server does the addition, so this costs no read and is
      // still atomic against every other visitor arriving at the same moment.
      await api.setDoc(
        ref,
        { count: api.increment(1), lastVisit: new Date().toISOString() },
        { merge: true },
      );
      sessionStorage.setItem('visit-counted', '1');

      // The total to show. Cached for half an hour, so this is a real read on
      // roughly one session in however many start inside that window, rather
      // than on every single one.
      const total = await this.cache.through(
        VISITS_CACHE_KEY,
        CACHE_TTL.visits,
        async () => {
          const snap = await api.getDoc(ref);
          return snap.exists() ? ((snap.data()['count'] as number) ?? 0) : 0;
        },
      );

      // This visit is already in the server's count but not necessarily in the
      // cached copy, which may predate it. Adding it back keeps the number from
      // going *backwards* for the visitor who just caused it to go up.
      const shown = Math.max(total, (cached ?? 0) + 1);

      // Resolved against the raw SDK, outside the Angular zone — push the
      // subjects back inside it or subscribers never repaint.
      this.lazyFirestore.runInZone(() => {
        this.visitCount$.next(shown);

        // Milestones are now noticed rather than caught exactly: the count can
        // step over one while the cache is cold. `>=` against the previous
        // displayed value fires once on the crossing instead of demanding an
        // exact equality that a cached total may never land on.
        const previous = cached ?? 0;
        const hit = MILESTONES.find(m => m.at > previous && m.at <= shown);
        if (hit) {
          this.milestone$.next({
            count: shown,
            milestone: hit.at,
            label: hit.label,
            tier: hit.tier,
          });
        }
      });
    } catch (err: any) {
      // Permission-denied means firestore.rules haven't been deployed yet
      // (common in dev). That's expected and shouldn't paint the console red.
      // Any other error is genuinely unexpected and worth surfacing as a warn.
      const code = err?.code || err?.message || '';
      if (typeof code === 'string' && code.indexOf('permission-denied') >= 0) {
        // Silent degrade — counter just doesn't increment this session.
        return;
      }
      console.warn('[VisitCounter] degraded:', err);
    }
  }
}
