import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore, collection, collectionData, doc, getDoc, getDocs,
  query, orderBy, limit, updateDoc
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { TOOLS_REGISTRY } from '../tools/tools-registry';
import { EASTER_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { CACHE_TTL, FirestoreCacheService } from '../shared/firestore-cache.service';

/**
 * Every panel on the dashboard is one of these. `state` is what the template
 * branches on, so a card can render a skeleton, a number, a "connect this"
 * setup note, or an error — without the template guessing from null checks.
 */
export type PanelState = 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';

export interface Panel<T> {
  state: PanelState;
  data: T | null;
  /** Shown when state is 'unavailable' — what to connect, and how. */
  note?: string;
}

export function loadingPanel<T>(): Panel<T> {
  return { state: 'loading', data: null };
}

export function unavailablePanel<T>(note: string): Panel<T> {
  return { state: 'unavailable', data: null, note };
}

export interface ToolUsageRow {
  id: string;
  title: string;
  category: string;
  count: number;
}

export interface EggRow {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  discoveries: number;
}

export interface Suggestion {
  id: string;
  name: string;
  description: string;
  email: string;
  submittedAt: string;
  source: string;
  /** Absent on every doc written before the admin panel existed. */
  review?: 'reviewed' | 'accepted' | 'rejected';
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface CiRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  date: string;
  url: string;
}

export interface BuildStats {
  generatedAt: string;
  prerenderRoutes: number;
  sitemapUrls: number;
  bundle: { mainKb: number; totalJsKb: number; chunks: number } | null;
}

const GITHUB_REPO = 'xsantcastx/xsantcastx';

/**
 * Reads for the /admin dashboard.
 *
 * House rule inherited from ChangelogService: a missing rule or an
 * SSR-hydration SDK mismatch is an expected, quiet degrade — it returns an
 * empty result, never a console.error. The dashboard's job is to render
 * something useful even when half its sources are unreachable, so every read
 * here resolves rather than rejects.
 */
/** Prefix every cached admin panel shares, so one call can drop them all. */
const ADMIN_CACHE_PREFIX = 'admin/';

@Injectable()
export class AdminDataService {
  private firestore = inject(Firestore);
  private cache = inject(FirestoreCacheService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Read a panel through the five-minute cache.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY THE DASHBOARD IS THE WORST OFFENDER PER LOAD
   * ───────────────────────────────────────────────────────────────────────────
   * Two of these panels are whole-collection scans: every tool-usage counter and
   * every easter egg. There is no `limit` that would help, because the panels
   * are totals — they have to see every document to add them up. One dashboard
   * open is therefore several hundred reads, and it used to be several hundred
   * reads *per render*.
   *
   * Five minutes, with a Refresh button next to the timestamp, is the shape that
   * fits: the numbers move slowly, the person reading them knows when they want
   * a fresh one, and nothing here is a figure anybody acts on within the minute.
   */
  private cached<T>(key: string, loader: () => Promise<T>, force = false): Promise<T> {
    return this.cache.through(ADMIN_CACHE_PREFIX + key, CACHE_TTL.admin, loader, { force });
  }

  /** Drop every cached panel, so the next load is live. Drives the Refresh button. */
  bustCache(): void {
    this.cache.bustPrefix(ADMIN_CACHE_PREFIX);
  }

  /** When the oldest cached panel was read, for the "last updated" line. */
  cachedAt(): number | null {
    return this.cache.writtenAt(ADMIN_CACHE_PREFIX + 'tool-usage');
  }

  /** True for the failure modes we treat as "not wired up yet", not as bugs. */
  private isExpectedFailure(err: any): boolean {
    const code = err?.code || '';
    const msg = typeof err?.message === 'string' ? err.message : '';
    return (
      code === 'permission-denied' ||
      code === 'unavailable' ||
      code === 'failed-precondition' ||
      msg.indexOf('Type does not match') >= 0 ||
      msg.indexOf('different Firestore SDK') >= 0
    );
  }

  private degrade<T>(err: any, fallback: T, label: string): T {
    if (!this.isExpectedFailure(err)) {
      console.warn(`[AdminData] ${label} degraded:`, err);
    }
    return fallback;
  }

  // ── Static sources (no network, always available) ───────────────────────

  /** Live tool count straight off the registry — the same number /blueprint shows. */
  get liveToolCount(): number {
    return TOOLS_REGISTRY.filter(t => t.status === 'live').length;
  }

  get totalToolCount(): number {
    return TOOLS_REGISTRY.length;
  }

  get comingSoonCount(): number {
    return TOOLS_REGISTRY.filter(t => t.status === 'coming-soon').length;
  }

  get categoryCount(): number {
    return new Set(TOOLS_REGISTRY.map(t => t.category)).size;
  }

  get eggCount(): number {
    return EASTER_EGGS.length;
  }

  // ── Firestore: real data ────────────────────────────────────────────────

  /**
   * Site-wide visit count. Written by VisitCounterService on every page view,
   * publicly readable, so this is a genuine number rather than an estimate.
   */
  async totalVisits(force = false): Promise<number | null> {
    if (!this.isBrowser) return null;
    try {
      return await this.cached('visits', async () => {
      const snap = await getDoc(doc(this.firestore, 'site-stats', 'visits'));
      return snap.exists() ? (snap.data()['count'] ?? 0) : 0;
      }, force);
    } catch (err) {
      return this.degrade(err, null, 'totalVisits');
    }
  }

  /**
   * Viewers currently on /live. The presence docs are written with a heartbeat
   * and deleted on unload, but a hard tab-close leaves one behind — so anything
   * older than five minutes is treated as gone. This is the closest thing to a
   * real "active users now" the site has without GA4.
   */
  async activeViewers(force = false): Promise<number | null> {
    if (!this.isBrowser) return null;
    try {
      return await this.cached('active-viewers', async () => {
      const snap = await getDocs(collection(this.firestore, 'live-viewers'));
      const cutoff = Date.now() - 5 * 60 * 1000;
      let live = 0;
      snap.forEach(d => {
        const ts = d.data()['timestamp'];
        const ms = typeof ts === 'number' ? ts
          : typeof ts === 'string' ? Date.parse(ts)
          : ts?.toMillis?.() ?? 0;
        if (ms >= cutoff) live++;
      });
      return live;
      }, force);
    } catch (err) {
      return this.degrade(err, null, 'activeViewers');
    }
  }

  /**
   * Per-tool usage counters, joined against the registry so the table shows
   * titles rather than slugs. Counters are session-deduped by ToolUsageService,
   * so one row is roughly one session that opened that tool.
   */
  async toolUsage(force = false): Promise<ToolUsageRow[] | null> {
    if (!this.isBrowser) return null;
    try {
      return await this.cached('tool-usage', async () => {
      const snap = await getDocs(collection(this.firestore, 'tool-usage'));
      const byId = new Map(TOOLS_REGISTRY.map(t => [t.id, t]));
      const rows: ToolUsageRow[] = [];
      snap.forEach(d => {
        const meta = byId.get(d.id);
        rows.push({
          id: d.id,
          title: meta?.title ?? d.id,
          category: meta?.category ?? 'Unknown',
          count: d.data()['count'] ?? 0
        });
      });
      return rows.sort((a, b) => b.count - a.count);
      }, force);
    } catch (err) {
      return this.degrade(err, null, 'toolUsage');
    }
  }

  /**
   * Easter-egg discovery counts, joined against the EASTER_EGGS definition so
   * eggs nobody has found still appear (at zero) — the interesting number is
   * which eggs are undiscoverable, and those have no Firestore doc at all.
   */
  async eggDiscoveries(force = false): Promise<EggRow[] | null> {
    if (!this.isBrowser) return null;
    try {
      return await this.cached('egg-discoveries', async () => {
      const snap = await getDocs(collection(this.firestore, 'easter-eggs'));
      const counts = new Map<string, number>();
      snap.forEach(d => counts.set(d.id, d.data()['discoveries'] ?? 0));
      return EASTER_EGGS.map(egg => ({
        id: egg.id,
        name: egg.name,
        icon: egg.icon,
        rarity: egg.rarity,
        discoveries: counts.get(egg.id) ?? 0
      })).sort((a, b) => b.discoveries - a.discoveries);
      }, force);
    } catch (err) {
      return this.degrade(err, null, 'eggDiscoveries');
    }
  }

  /**
   * Tool suggestions from /blueprint. Admin-only in firestore.rules — an
   * empty array here on a wrong-email session is the rules doing their job.
   */
  async suggestions(force = false): Promise<Suggestion[] | null> {
    if (!this.isBrowser) return null;
    try {
      return await this.cached('suggestions', async () => {
      const q = query(
        collection(this.firestore, 'blueprint-suggestions'),
        orderBy('submittedAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Suggestion[];
      }, force);
    } catch (err) {
      return this.degrade(err, null, 'suggestions');
    }
  }

  /** Triage a suggestion. Gated on the owner's email in firestore.rules. */
  async setSuggestionReview(id: string, review: Suggestion['review']): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      await updateDoc(doc(this.firestore, 'blueprint-suggestions', id), { review });
      return true;
    } catch (err) {
      this.degrade(err, false, 'setSuggestionReview');
      return false;
    }
  }

  /**
   * Recent dev-log entries. `changelog` is public-read but write-locked, so on
   * a project where nothing has been pushed to it this is legitimately empty
   * rather than broken.
   */
  recentChangelog(force = false): Observable<any[]> {
    if (!this.isBrowser) return of([]);
    // `collectionData` opens a standing listener, which on a dashboard left open
    // in a tab re-bills for every write to the collection for as long as it sits
    // there. Nothing on this card needs to move without the Refresh button.
    return this.cache.read$(ADMIN_CACHE_PREFIX + 'changelog', CACHE_TTL.admin, async () => {
      const q = query(collection(this.firestore, 'changelog'), orderBy('date', 'desc'), limit(10));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data() as Record<string, any>;
        return {
          id: d.id,
          ...data,
          // Timestamps do not survive the cache's JSON; flatten to ISO so the
          // card renders the same value on a hit as on a miss.
          date: data['date']?.toDate?.().toISOString() ?? data['date'] ?? null,
        };
      });
    }, { force }).pipe(
      catchError(err => of(this.degrade(err, [], 'recentChangelog')))
    );
  }

  /**
   * Activity written by the Claude Code hook that powers /live. Doubles as a
   * build-pulse indicator: if the newest entry is hours old, nothing is running.
   */
  async lastActivityAt(force = false): Promise<string | null> {
    if (!this.isBrowser) return null;
    try {
      return await this.cached('last-activity', async () => {
      const q = query(collection(this.firestore, 'claude-activity'), orderBy('timestamp', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const ts = snap.docs[0].data()['timestamp'];
      if (typeof ts === 'string') return ts;
      if (typeof ts === 'number') return new Date(ts).toISOString();
      return ts?.toDate?.().toISOString() ?? null;
      }, force);
    } catch (err) {
      return this.degrade(err, null, 'lastActivityAt');
    }
  }

  // ── Build stats (emitted by scripts/generate-sitemap.js) ────────────────

  /**
   * Written at build time next to the sitemap. Missing in `ng serve` — the
   * dev server has no dist/ to measure — which the card reports honestly
   * rather than showing a zero.
   */
  async buildStats(): Promise<BuildStats | null> {
    if (!this.isBrowser) return null;
    try {
      const res = await fetch('/assets/build-stats.json', { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ── GitHub (unauthenticated public API, 60 req/hr per IP) ───────────────

  private async github<T>(path: string): Promise<T | null> {
    if (!this.isBrowser) return null;
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      // 403 here is almost always the unauthenticated rate limit, not a real
      // failure — the card says so rather than reporting the repo as broken.
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async recentCommits(): Promise<GitCommit[] | null> {
    const raw = await this.github<any[]>('/commits?sha=main&per_page=10');
    if (!raw) return null;
    return raw.map(c => ({
      sha: (c.sha || '').slice(0, 7),
      message: (c.commit?.message || '').split('\n')[0],
      author: c.commit?.author?.name || 'unknown',
      date: c.commit?.author?.date || '',
      url: c.html_url || ''
    }));
  }

  async recentCiRuns(): Promise<CiRun[] | null> {
    const raw = await this.github<any>('/actions/runs?per_page=5');
    if (!raw?.workflow_runs) return null;
    return raw.workflow_runs.map((r: any) => ({
      id: r.id,
      name: r.name || 'workflow',
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch || '',
      date: r.created_at || '',
      url: r.html_url || ''
    }));
  }

  get repoUrl(): string {
    return `https://github.com/${GITHUB_REPO}`;
  }

  get actionsUrl(): string {
    return `https://github.com/${GITHUB_REPO}/actions`;
  }
}
