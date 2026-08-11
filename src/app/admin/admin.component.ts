import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, ApplicationRef, runInInjectionContext, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth, authState, signInWithPopup, GoogleAuthProvider, signOut, User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';

import { APP_VERSION, VERSION_HISTORY } from '../version';
import {
  AdminDataService, Panel, ToolUsageRow, EggRow, Suggestion,
  GitCommit, CiRun, BuildStats, loadingPanel, unavailablePanel
} from './admin-data.service';
import { isAdminEmail, ADMIN_EMAIL } from './admin.guard';

interface Bar {
  label: string;
  sub: string;
  value: number;
  /** 0-100, relative to the largest bar in the set. */
  pct: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
  providers: [AdminDataService]
})
export class AdminComponent implements OnInit, OnDestroy {
  private auth = inject(Auth);
  private appRef = inject(ApplicationRef);
  private cdr = inject(ChangeDetectorRef);
  private data = inject(AdminDataService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;

  /** 'checking' until Firebase restores the session — drives the gate. */
  gate: 'checking' | 'signed-out' | 'denied' | 'ok' = 'checking';
  user: User | null = null;
  signInError = '';
  readonly adminEmail = ADMIN_EMAIL;

  // ── 1. Overview ────────────────────────────────────────────────────────
  readonly version = APP_VERSION;
  readonly releaseCount = VERSION_HISTORY.length;
  liveTools = 0;
  comingSoon = 0;
  categories = 0;
  activeNow: Panel<number> = loadingPanel();
  totalVisits: Panel<number> = loadingPanel();
  build: Panel<BuildStats> = loadingPanel();
  lastActivity: Panel<string> = loadingPanel();

  // ── 2. Engagement ──────────────────────────────────────────────────────
  topTools: Panel<Bar[]> = loadingPanel();
  totalToolUses = 0;
  toolsWithUsage = 0;
  /** GA4-backed panels have nothing to read until Analytics is wired. */
  pageViews: Panel<null> = unavailablePanel(
    'Page-view history, session duration, bounce rate and new-vs-returning all come from GA4. The measurement ID is already in environment.ts — what is missing is the Data API, which cannot be called from the browser because it needs a service-account credential. Add a Cloud Function that proxies runReport() and this card fills in.'
  );

  // ── 3. Gamification ────────────────────────────────────────────────────
  gamification: Panel<null> = unavailablePanel(
    'XP, levels, achievements and streaks are per-account, and the site has no accounts yet — only anonymous Firebase Auth on /guestbook. These fill in when Phase 2 ships a users/{uid}/progress document.'
  );

  // ── 4. Easter eggs & games ─────────────────────────────────────────────
  eggs: Panel<EggRow[]> = loadingPanel();
  eggsFound = 0;
  eggsTotal = 0;
  eggDiscoveryTotal = 0;

  // ── 5. Blueprint & community ───────────────────────────────────────────
  suggestions: Panel<Suggestion[]> = loadingPanel();
  guestbookCount: Panel<number> = loadingPanel();
  changelogEntries: Panel<any[]> = loadingPanel();
  busySuggestion = '';

  // ── 6. SEO ─────────────────────────────────────────────────────────────
  seo: Panel<null> = unavailablePanel(
    'Indexed-page counts and search queries come from Search Console, which has no public read API — it needs an OAuth service account. Until then, the sitemap figure on the left is the number of URLs actually submitted.'
  );

  // ── 7. System health ───────────────────────────────────────────────────
  commits: Panel<GitCommit[]> = loadingPanel();
  ciRuns: Panel<CiRun[]> = loadingPanel();

  get repoUrl(): string { return this.data.repoUrl; }
  get actionsUrl(): string { return this.data.actionsUrl; }

  ngOnInit(): void {
    this.liveTools = this.data.liveToolCount;
    this.comingSoon = this.data.comingSoonCount;
    this.categories = this.data.categoryCount;
    this.eggsTotal = this.data.eggCount;

    // On the server, leave `gate` at 'checking'. Two reasons: the prerendered
    // HTML then contains nothing but a spinner (no sign-in card, no panels),
    // and the client's first render matches it exactly — rendering the
    // signed-out card here instead would swap the DOM under hydration and
    // Angular would report a mismatch.
    if (!this.isBrowser) return;

    // authState() is an AngularFire observable; subscribing outside an
    // injection context is what produces the NG0203 warnings elsewhere in
    // this repo, so mirror the guestbook's runInInjectionContext wrapper.
    runInInjectionContext(this.appRef.injector, () => {
      this.sub = authState(this.auth).subscribe(user => {
        this.user = user;
        if (!user) {
          this.gate = 'signed-out';
        } else if (isAdminEmail(user.email)) {
          this.gate = 'ok';
          this.loadAll();
        } else {
          // The guard already bounces this case; this is the second lock, for
          // the session that changes identity while the page is open.
          this.gate = 'denied';
        }
        this.cdr.markForCheck();
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async signIn(): Promise<void> {
    this.signInError = '';
    try {
      const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());
      if (!isAdminEmail(cred.user?.email)) {
        // Signing out immediately keeps a non-owner from holding a session
        // that other parts of the site would treat as logged in.
        await signOut(this.auth);
        this.signInError = 'That account is not the owner account.';
      }
    } catch (err: any) {
      this.signInError = err?.code === 'auth/popup-closed-by-user'
        ? ''
        : 'Sign-in failed. Check that Google auth is enabled for this Firebase project.';
    }
    this.cdr.markForCheck();
  }

  async signOutNow(): Promise<void> {
    await signOut(this.auth);
    this.cdr.markForCheck();
  }

  /**
   * Every source is fired independently and settles on its own — one slow or
   * unreachable source must not hold up the whole dashboard.
   */
  private loadAll(): void {
    this.data.activeViewers().then(v => this.settle('activeNow', v));
    this.data.totalVisits().then(v => this.settle('totalVisits', v));
    this.data.lastActivityAt().then(v => this.settle('lastActivity', v));
    this.data.guestbookCount().then(v => this.settle('guestbookCount', v));

    this.data.buildStats().then(stats => {
      this.build = stats
        ? { state: 'ready', data: stats }
        : unavailablePanel('Written by scripts/generate-sitemap.js during a production build. `ng serve` has no dist/ to measure, so this is expected in dev — run `npm run build` to populate it.');
      this.cdr.markForCheck();
    });

    this.data.toolUsage().then(rows => {
      if (!rows) {
        this.topTools = { state: 'error', data: null };
      } else if (!rows.length) {
        this.topTools = { state: 'empty', data: null };
      } else {
        this.totalToolUses = rows.reduce((sum, r) => sum + r.count, 0);
        this.toolsWithUsage = rows.length;
        this.topTools = { state: 'ready', data: this.toBars(rows.slice(0, 10)) };
      }
      this.cdr.markForCheck();
    });

    this.data.eggDiscoveries().then(rows => {
      if (!rows) {
        this.eggs = { state: 'error', data: null };
      } else {
        this.eggsFound = rows.filter(r => r.discoveries > 0).length;
        this.eggDiscoveryTotal = rows.reduce((s, r) => s + r.discoveries, 0);
        this.eggs = { state: 'ready', data: rows };
      }
      this.cdr.markForCheck();
    });

    this.data.suggestions().then(rows => {
      this.suggestions = !rows
        ? { state: 'error', data: null }
        : rows.length ? { state: 'ready', data: rows } : { state: 'empty', data: null };
      this.cdr.markForCheck();
    });

    this.data.recentCommits().then(rows => {
      this.commits = rows
        ? { state: 'ready', data: rows }
        : unavailablePanel('GitHub\'s public API allows 60 unauthenticated requests per hour per IP. A 403 here usually means that budget is spent — it resets on the hour.');
      this.cdr.markForCheck();
    });

    this.data.recentCiRuns().then(rows => {
      this.ciRuns = rows
        ? { state: 'ready', data: rows }
        : unavailablePanel('Workflow runs are only public on public repos. If this repo is private, the run list needs a token — open Actions directly instead.');
      this.cdr.markForCheck();
    });

    this.sub?.add(
      this.data.recentChangelog().subscribe(entries => {
        this.changelogEntries = entries.length
          ? { state: 'ready', data: entries }
          : { state: 'empty', data: null };
        this.cdr.markForCheck();
      })
    );
  }

  /** Numbers-with-null: null means the read failed, 0 is a real zero. */
  private settle(key: 'activeNow' | 'totalVisits' | 'guestbookCount' | 'lastActivity', value: any): void {
    (this as any)[key] = value === null || value === undefined
      ? { state: 'error', data: null }
      : { state: 'ready', data: value };
    this.cdr.markForCheck();
  }

  private toBars(rows: ToolUsageRow[]): Bar[] {
    const max = Math.max(...rows.map(r => r.count), 1);
    return rows.map(r => ({
      label: r.title,
      sub: r.category,
      value: r.count,
      pct: Math.round((r.count / max) * 100)
    }));
  }

  async review(s: Suggestion, verdict: Suggestion['review']): Promise<void> {
    this.busySuggestion = s.id;
    const ok = await this.data.setSuggestionReview(s.id, verdict);
    if (ok) s.review = verdict;
    this.busySuggestion = '';
    this.cdr.markForCheck();
  }

  // ── Formatting helpers ─────────────────────────────────────────────────

  /** Relative time, because "3h ago" reads faster than a timestamp on a dashboard. */
  ago(iso: string | null | undefined): string {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (isNaN(ms)) return '—';
    const secs = Math.floor((Date.now() - ms) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    const days = Math.floor(secs / 86400);
    if (days < 30) return `${days}d ago`;
    return new Date(ms).toISOString().slice(0, 10);
  }

  num(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : n.toLocaleString('en-US');
  }

  /** Maps a CI conclusion onto the three states the dot has a colour for. */
  ciTone(run: CiRun): 'pass' | 'fail' | 'pending' {
    if (run.status !== 'completed') return 'pending';
    return run.conclusion === 'success' ? 'pass' : 'fail';
  }

  /** Share of eggs found at least once — the discoverability number. */
  get eggUnlockRate(): number {
    return this.eggsTotal ? Math.round((this.eggsFound / this.eggsTotal) * 100) : 0;
  }

  /** SVG dash offset for the unlock-rate ring (r=26 → circumference ≈ 163.4). */
  get eggRingOffset(): number {
    return 163.4 - (163.4 * this.eggUnlockRate) / 100;
  }

  trackBar = (_: number, b: Bar) => b.label;
  trackEgg = (_: number, e: EggRow) => e.id;
  trackSuggestion = (_: number, s: Suggestion) => s.id;
  trackCommit = (_: number, c: GitCommit) => c.sha;
  trackRun = (_: number, r: CiRun) => r.id;
}
