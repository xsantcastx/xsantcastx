import { Component, OnDestroy, OnInit, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { TranslationService } from '../../translation.service';
import { analyzeHar, extractDetail, redactHar, typeLabel, RESOURCE_TYPES } from './har-analysis';
import { SAMPLE_HAR } from './har-analyzer.sample';
import type {
  AnalysisRequest,
  DomainBucket,
  HarAnalysis,
  HarFile,
  RedactionReport,
  RequestDetail,
  ResourceType,
  VitalMetric,
  WorkerResponseMessage,
} from './har-analyzer.types';

/** Rows rendered per page. 20k rows in the DOM is not a table, it is a freeze. */
const PAGE_SIZE = 150;

/** Shared snapshots carry at most this many rows, to keep the URL usable. */
const SHARE_ROW_LIMIT = 120;

/**
 * Practical ceiling for the share link. Browsers accept far more, but past this
 * a URL stops surviving a paste into Slack, Jira or an email client intact.
 */
const SHARE_URL_LIMIT = 12_000;

type SortKey = 'index' | 'name' | 'method' | 'status' | 'type' | 'domain' | 'transferSize' | 'duration' | 'startOffset';
type StatusFilter = 'all' | '2xx' | '3xx' | '4xx' | '5xx' | 'failed';

/** A request plus the geometry needed to draw its waterfall bar. */
interface RowVM extends AnalysisRequest {
  leftPct: number;
  widthPct: number;
  segments: { key: string; pct: number }[];
  sizeLabel: string;
  timeLabel: string;
  statusClass: string;
}

@Component({
  selector: 'app-har-analyzer',
  templateUrl: './har-analyzer.component.html',
  styleUrls: ['./har-analyzer.component.css'],
  imports: [ToolsSharedModule, FormsModule],
})
export class HarAnalyzerComponent implements OnInit, OnDestroy {
  private readonly translationService = inject(TranslationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free HAR File Analyzer — drop a .har and get a waterfall, Core Web Vitals and a privacy-redacted export. Runs entirely in your browser.')}&url=${encodeURIComponent(SITE_URL + '/tools/har-analyzer')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/har-analyzer')}`;

  // ── Lifecycle state ───────────────────────────────────────────
  status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  progressPhase = '';
  progressPct = 0;
  errorMessage = '';
  dragActive = false;

  fileName = '';
  fileSize = 0;

  /**
   * True when the page was opened from a share link. The HAR itself is not in
   * the URL — only a digest — so detail expansion and redaction are unavailable.
   */
  snapshotMode = false;

  // ── Analysis ──────────────────────────────────────────────────
  analysis: HarAnalysis | null = null;
  rows: RowVM[] = [];
  filtered: RowVM[] = [];
  visibleLimit = PAGE_SIZE;

  // ── Filters ───────────────────────────────────────────────────
  search = '';
  statusFilter: StatusFilter = 'all';
  domainFilter = 'all';
  activeTypes = new Set<ResourceType>();
  onlyThirdParty = false;
  onlySlow = false;
  hideCached = false;

  sortKey: SortKey = 'startOffset';
  sortDir: 'asc' | 'desc' = 'asc';

  // ── Row detail ────────────────────────────────────────────────
  expandedIndex: number | null = null;
  detail: RequestDetail | null = null;
  detailLoading = false;
  detailTab: 'headers' | 'body' | 'timing' = 'headers';

  // ── Redaction / export ────────────────────────────────────────
  redactionReport: RedactionReport | null = null;
  redacting = false;

  shareUrl = '';
  shareBuilding = false;
  shareTooLarge = false;
  copiedField: string | null = null;

  // ── Static view data ──────────────────────────────────────────
  readonly allTypes = RESOURCE_TYPES;
  readonly phaseLegend = [
    { key: 'blocked', label: 'Queued / blocked' },
    { key: 'dns', label: 'DNS lookup' },
    { key: 'connect', label: 'TCP connect' },
    { key: 'ssl', label: 'TLS handshake' },
    { key: 'send', label: 'Request sent' },
    { key: 'wait', label: 'Waiting (TTFB)' },
    { key: 'receive', label: 'Content download' },
  ];

  private worker: Worker | null = null;
  /** Kept only on the no-worker path, where analysis runs on this thread. */
  private inlineHar: HarFile | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;
  private objectUrls: string[] = [];

  // ── Lifecycle ─────────────────────────────────────────────────

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const digest = this.route.snapshot.queryParamMap.get('d');
    if (digest) void this.restoreSnapshot(digest);
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
    this.worker = null;
    if (this.copyTimer) clearTimeout(this.copyTimer);
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls = [];
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Input ─────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.loadFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.loadFile(file);
    // Reset so re-picking the same filename fires `change` again.
    input.value = '';
  }

  /** Keyboard equivalent of clicking the dropzone. */
  onDropzoneKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  }

  loadSample(): void {
    if (!this.isBrowser) return;
    this.resetAnalysis();
    this.fileName = 'sample-capture.har';
    this.fileSize = SAMPLE_HAR.length;
    this.status = 'loading';
    this.progressPhase = 'Loading sample';
    this.progressPct = 10;

    const worker = this.ensureWorker();
    if (worker) {
      worker.postMessage({ type: 'parseText', text: SAMPLE_HAR });
    } else {
      this.analyzeInline(SAMPLE_HAR);
    }
  }

  private loadFile(file: File): void {
    if (!this.isBrowser) return;

    const looksLikeHar = /\.har$|\.json$/i.test(file.name) || file.type === 'application/json';
    if (!looksLikeHar) {
      this.status = 'error';
      this.errorMessage = `“${file.name}” is not a .har file. Export one from DevTools → Network → the ⭳ download icon, or from Firefox's Network panel → Save All As HAR.`;
      return;
    }

    this.resetAnalysis();
    this.fileName = file.name;
    this.fileSize = file.size;
    this.status = 'loading';
    this.progressPhase = 'Reading file';
    this.progressPct = 2;

    const worker = this.ensureWorker();
    if (worker) {
      worker.postMessage({ type: 'parse', file });
    } else {
      // No worker support: read here and analyse on the main thread. Large
      // files will jank on this path, which is exactly why it is the fallback.
      file.text()
        .then(text => this.analyzeInline(text))
        .catch(err => this.fail(err instanceof Error ? err.message : String(err)));
    }
  }

  // ── Worker plumbing ───────────────────────────────────────────

  private ensureWorker(): Worker | null {
    if (!this.isBrowser || typeof Worker === 'undefined') return null;
    if (this.worker) return this.worker;

    try {
      const worker = new Worker(new URL('./har-analyzer.worker', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event: MessageEvent<WorkerResponseMessage>) => {
        this.handleWorkerMessage(event.data);
      });
      worker.addEventListener('error', () => {
        this.fail('The background parser crashed. Reload the page and try again.');
      });
      this.worker = worker;
      return worker;
    } catch {
      // Worker construction can be blocked outright (strict CSP, some
      // embedded webviews). Main-thread analysis still produces the same result.
      return null;
    }
  }

  private handleWorkerMessage(msg: WorkerResponseMessage): void {
    switch (msg.type) {
      case 'progress':
        this.progressPhase = msg.phase;
        this.progressPct = msg.pct;
        break;
      case 'result':
        this.applyAnalysis(msg.analysis);
        break;
      case 'detail':
        this.detail = msg.detail;
        this.detailLoading = false;
        break;
      case 'redacted':
        this.redactionReport = msg.report;
        this.redacting = false;
        this.downloadBuffer(msg.buffer, this.redactedFileName());
        break;
      case 'error':
        this.fail(msg.message);
        break;
    }
    this.cdr.markForCheck();
  }

  /** Main-thread analysis, used only when `Worker` is unavailable. */
  private analyzeInline(text: string): void {
    try {
      this.progressPhase = 'Parsing JSON';
      this.progressPct = 30;
      const har = JSON.parse(text) as HarFile;
      if (!har?.log || !Array.isArray(har.log.entries)) {
        this.fail('This is valid JSON but not a HAR archive — a HAR has a top-level "log" object containing an "entries" array.');
        return;
      }
      this.inlineHar = har;
      this.applyAnalysis(analyzeHar(har));
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  private fail(message: string): void {
    this.status = 'error';
    this.errorMessage = message;
    this.progressPct = 0;
    this.cdr.markForCheck();
  }

  private resetAnalysis(): void {
    this.analysis = null;
    this.rows = [];
    this.filtered = [];
    this.errorMessage = '';
    this.expandedIndex = null;
    this.detail = null;
    this.redactionReport = null;
    this.shareUrl = '';
    this.shareTooLarge = false;
    this.snapshotMode = false;
    this.inlineHar = null;
    this.visibleLimit = PAGE_SIZE;
    this.resetFilters();
  }

  reset(): void {
    this.resetAnalysis();
    this.status = 'idle';
    this.fileName = '';
    this.fileSize = 0;
    this.worker?.terminate();
    this.worker = null;
  }

  // ── Deriving the view model ───────────────────────────────────

  private applyAnalysis(analysis: HarAnalysis): void {
    this.analysis = analysis;
    this.rows = analysis.requests.map(r => this.toRow(r, analysis.summary.totalSpan));
    this.status = 'ready';
    this.progressPct = 100;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  private toRow(r: AnalysisRequest, span: number): RowVM {
    const safeSpan = span > 0 ? span : 1;
    const total = r.duration > 0 ? r.duration : 0;
    const phaseSum =
      r.phases.blocked + r.phases.dns + r.phases.connect + r.phases.ssl +
      r.phases.send + r.phases.wait + r.phases.receive;

    // Segment widths are a share of the bar, not of the timeline. When a HAR
    // has no timings block at all the bar renders as one flat "receive" block
    // rather than collapsing to nothing.
    const segments = phaseSum > 0
      ? this.phaseLegend
          .map(p => ({ key: p.key, pct: (r.phases[p.key as keyof typeof r.phases] / phaseSum) * 100 }))
          .filter(s => s.pct > 0)
      : [{ key: 'receive', pct: 100 }];

    return {
      ...r,
      leftPct: Math.min(100, (r.startOffset / safeSpan) * 100),
      // Sub-pixel bars are invisible; floor the width so every request is findable.
      widthPct: Math.max(0.5, Math.min(100, (total / safeSpan) * 100)),
      segments,
      sizeLabel: r.fromCache && r.transferSize === 0 ? 'cached' : this.formatBytes(r.transferSize),
      timeLabel: this.formatMs(r.duration),
      statusClass: r.status === 0 ? 'failed'
        : r.status >= 500 ? 's5'
        : r.status >= 400 ? 's4'
        : r.status >= 300 ? 's3'
        : 's2',
    };
  }

  // ── Filtering & sorting ───────────────────────────────────────

  /**
   * Recomputed imperatively rather than exposed as a template getter: with up
   * to 20 000 rows, running this on every change-detection pass is the
   * difference between a responsive table and a locked tab.
   */
  applyFilters(): void {
    const term = this.search.trim().toLowerCase();
    const types = this.activeTypes;

    let out = this.rows.filter(r => {
      if (types.size && !types.has(r.type)) return false;
      if (this.domainFilter !== 'all' && r.domain !== this.domainFilter) return false;
      if (this.onlyThirdParty && !r.thirdParty) return false;
      if (this.onlySlow && r.duration < 500) return false;
      if (this.hideCached && r.fromCache) return false;

      switch (this.statusFilter) {
        case '2xx': if (r.status < 200 || r.status >= 300) return false; break;
        case '3xx': if (r.status < 300 || r.status >= 400) return false; break;
        case '4xx': if (r.status < 400 || r.status >= 500) return false; break;
        case '5xx': if (r.status < 500) return false; break;
        case 'failed': if (r.status !== 0 && r.status < 400) return false; break;
        case 'all': break;
      }

      if (term && !r.url.toLowerCase().includes(term) && !r.mimeType.toLowerCase().includes(term)) return false;
      return true;
    });

    const dir = this.sortDir === 'asc' ? 1 : -1;
    const key = this.sortKey;
    out = out.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    this.filtered = out;
    this.visibleLimit = PAGE_SIZE;
  }

  sortBy(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      // Sizes and durations are almost always wanted largest-first.
      this.sortDir = key === 'transferSize' || key === 'duration' ? 'desc' : 'asc';
    }
    this.applyFilters();
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  toggleType(type: ResourceType): void {
    if (this.activeTypes.has(type)) this.activeTypes.delete(type);
    else this.activeTypes.add(type);
    this.applyFilters();
  }

  isTypeActive(type: ResourceType): boolean {
    return this.activeTypes.has(type);
  }

  resetFilters(): void {
    this.search = '';
    this.statusFilter = 'all';
    this.domainFilter = 'all';
    this.activeTypes.clear();
    this.onlyThirdParty = false;
    this.onlySlow = false;
    this.hideCached = false;
    if (this.rows.length) this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    return !!this.search || this.statusFilter !== 'all' || this.domainFilter !== 'all' ||
      this.activeTypes.size > 0 || this.onlyThirdParty || this.onlySlow || this.hideCached;
  }

  /** Narrows the table to one finding's offenders, then scrolls to it. */
  focusFinding(indices: number[]): void {
    const set = new Set(indices);
    this.resetFilters();
    this.filtered = this.rows.filter(r => set.has(r.index));
    this.visibleLimit = PAGE_SIZE;
    if (this.isBrowser) {
      document.getElementById('ha-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  showMore(): void {
    this.visibleLimit += PAGE_SIZE;
  }

  get visibleRows(): RowVM[] {
    return this.filtered.slice(0, this.visibleLimit);
  }

  get domains(): string[] {
    return this.analysis ? this.analysis.byDomain.map(d => d.domain) : [];
  }

  // ── Row detail ────────────────────────────────────────────────

  toggleRow(row: RowVM): void {
    if (this.expandedIndex === row.index) {
      this.expandedIndex = null;
      this.detail = null;
      return;
    }
    this.expandedIndex = row.index;
    this.detail = null;
    this.detailTab = 'headers';

    if (this.snapshotMode) return;

    if (this.worker) {
      this.detailLoading = true;
      this.worker.postMessage({ type: 'detail', index: row.index });
    } else if (this.inlineHar) {
      this.detail = extractDetail(this.inlineHar, row.index);
    }
  }

  // ── Redaction ─────────────────────────────────────────────────

  /**
   * Strips cookies, credential headers and every request/response body, then
   * downloads the result. The in-memory HAR is untouched, so the page keeps
   * working afterwards.
   */
  downloadRedacted(): void {
    if (!this.isBrowser || this.snapshotMode) return;
    this.redacting = true;

    if (this.worker) {
      this.worker.postMessage({ type: 'redact' });
      return;
    }
    if (this.inlineHar) {
      const { json, report } = redactHar(this.inlineHar, this.fileSize);
      this.redactionReport = report;
      this.redacting = false;
      this.downloadText(json, this.redactedFileName(), 'application/json');
    }
  }

  private redactedFileName(): string {
    const base = this.fileName.replace(/\.har$|\.json$/i, '') || 'capture';
    return `${base}.redacted.har`;
  }

  // ── Report export ─────────────────────────────────────────────

  /** A Markdown summary — the thing you actually paste into a bug ticket. */
  downloadReport(): void {
    if (!this.analysis || !this.isBrowser) return;
    const a = this.analysis;
    const s = a.summary;
    const lines: string[] = [];

    lines.push(`# HAR analysis — ${s.pageTitle}`);
    lines.push('');
    lines.push(`- **Source file:** ${this.fileName || '—'}`);
    lines.push(`- **Captured:** ${s.startedDateTime || '—'}`);
    lines.push(`- **Exported by:** ${s.creator}${s.browser !== '—' ? ` (${s.browser})` : ''}`);
    lines.push(`- **Primary domain:** ${s.primaryDomain}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| --- | --- |');
    lines.push(`| Requests | ${s.totalRequests} |`);
    lines.push(`| Transferred | ${this.formatBytes(s.totalTransferSize)} |`);
    lines.push(`| Uncompressed | ${this.formatBytes(s.totalContentSize)} |`);
    lines.push(`| Saved by compression | ${this.formatBytes(s.compressionSaved)} |`);
    lines.push(`| Total span | ${this.formatMs(s.totalSpan)} |`);
    lines.push(`| DOMContentLoaded | ${a.domContentLoaded !== null ? this.formatMs(a.domContentLoaded) : 'not recorded'} |`);
    lines.push(`| Load | ${a.onLoad !== null ? this.formatMs(a.onLoad) : 'not recorded'} |`);
    lines.push(`| Failed requests | ${s.failedRequests} |`);
    lines.push(`| Redirects | ${s.redirects} |`);
    lines.push(`| Served from cache | ${s.cachedRequests} |`);
    lines.push(`| Domains | ${s.uniqueDomains} |`);
    lines.push(`| Third-party bytes | ${this.formatBytes(s.thirdPartyTransferSize)} across ${s.thirdPartyRequests} requests |`);
    lines.push('');

    lines.push('## Core Web Vitals');
    lines.push('');
    lines.push('| Metric | Value | Rating | Source |');
    lines.push('| --- | --- | --- | --- |');
    for (const v of a.vitals) {
      const value = v.value === null ? 'n/a' : (v.unit === 'ms' ? this.formatMs(v.value) : String(v.value));
      lines.push(`| ${v.label} | ${value} | ${v.rating} | ${v.source} |`);
    }
    lines.push('');
    lines.push('> Only metrics marked `measured` were read from the capture. A HAR records network activity, not painting, so FCP and LCP are bounded estimates and CLS is not derivable at all.');
    lines.push('');

    lines.push('## By resource type');
    lines.push('');
    lines.push('| Type | Requests | Transferred |');
    lines.push('| --- | --- | --- |');
    for (const t of a.byType) {
      lines.push(`| ${t.label} | ${t.count} | ${this.formatBytes(t.transferSize)} |`);
    }
    lines.push('');

    if (a.findings.length) {
      lines.push('## Findings');
      lines.push('');
      for (const f of a.findings) {
        lines.push(`### ${f.severity.toUpperCase()} — ${f.title}`);
        lines.push('');
        lines.push(f.detail);
        if (f.savingsBytes) lines.push(`\nEstimated saving: **${this.formatBytes(f.savingsBytes)}**.`);
        lines.push('');
      }
    }

    const slowest = [...a.requests].sort((x, y) => y.duration - x.duration).slice(0, 15);
    lines.push('## 15 slowest requests');
    lines.push('');
    lines.push('| Time | Size | Status | URL |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of slowest) {
      lines.push(`| ${this.formatMs(r.duration)} | ${this.formatBytes(r.transferSize)} | ${r.status || '—'} | \`${r.url.slice(0, 120)}\` |`);
    }
    lines.push('');
    lines.push(`_Generated by the xsantcastx HAR Analyzer — ${SITE_URL}/tools/har-analyzer_`);

    const base = this.fileName.replace(/\.har$|\.json$/i, '') || 'capture';
    this.downloadText(lines.join('\n'), `${base}-analysis.md`, 'text/markdown');
  }

  // ── Share link ────────────────────────────────────────────────

  /**
   * Encodes a trimmed digest of the analysis — never the HAR itself, which can
   * be 100 MB and full of session cookies — into the URL. The payload is raw
   * deflate then base64url, which gets a 120-row snapshot into a few KB.
   */
  async buildShareLink(): Promise<void> {
    if (!this.analysis || !this.isBrowser) return;
    this.shareBuilding = true;
    this.shareTooLarge = false;

    try {
      const a = this.analysis;
      const digest = {
        v: 1,
        s: a.summary,
        t: a.byType,
        dm: a.byDomain.slice(0, 25),
        vi: a.vitals,
        f: a.findings.map(f => ({ ...f, requestIndices: f.requestIndices.slice(0, 50) })),
        dcl: a.domContentLoaded,
        ol: a.onLoad,
        sc: a.statusClasses,
        // Rows are rounded: sub-millisecond precision is noise here and costs
        // real bytes once there are a hundred of them.
        r: a.requests.slice(0, SHARE_ROW_LIMIT).map(r => ({
          ...r,
          startOffset: Math.round(r.startOffset),
          duration: Math.round(r.duration),
          phases: {
            blocked: Math.round(r.phases.blocked), dns: Math.round(r.phases.dns),
            connect: Math.round(r.phases.connect), ssl: Math.round(r.phases.ssl),
            send: Math.round(r.phases.send), wait: Math.round(r.phases.wait),
            receive: Math.round(r.phases.receive),
          },
        })),
        n: this.fileName,
        tr: Math.max(0, a.requests.length - SHARE_ROW_LIMIT),
      };

      const encoded = await this.deflateToBase64(JSON.stringify(digest));
      const url = `${SITE_URL}/tools/har-analyzer?d=${encoded}`;

      if (url.length > SHARE_URL_LIMIT) {
        this.shareTooLarge = true;
        this.shareUrl = '';
      } else {
        this.shareUrl = url;
        await this.copy(url, 'share');
      }
    } catch {
      this.shareTooLarge = true;
      this.shareUrl = '';
    } finally {
      this.shareBuilding = false;
      this.cdr.markForCheck();
    }
  }

  private async restoreSnapshot(encoded: string): Promise<void> {
    this.status = 'loading';
    this.progressPhase = 'Restoring shared snapshot';
    this.progressPct = 40;
    try {
      const json = await this.inflateFromBase64(encoded);
      const d = JSON.parse(json);
      const analysis: HarAnalysis = {
        summary: d.s,
        requests: d.r,
        byType: d.t,
        byDomain: d.dm,
        vitals: d.vi,
        findings: d.f,
        domContentLoaded: d.dcl,
        onLoad: d.ol,
        statusClasses: d.sc,
      };
      this.snapshotMode = true;
      this.fileName = d.n || 'shared-snapshot.har';
      this.applyAnalysis(analysis);
    } catch {
      this.fail('That share link could not be decoded — it was probably truncated in transit. Ask for the original .har file instead.');
    }
  }

  private async deflateToBase64(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    // Chunked so a large payload does not blow the argument limit on apply().
    for (let i = 0; i < compressed.length; i += 0x8000) {
      binary += String.fromCharCode(...compressed.subarray(i, i + 0x8000));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private async inflateFromBase64(encoded: string): Promise<string> {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }

  // ── Clipboard & downloads ─────────────────────────────────────

  copyShareUrl(): void {
    if (this.shareUrl) void this.copy(this.shareUrl, 'share');
    else void this.buildShareLink();
  }

  copySummary(): void {
    if (!this.analysis) return;
    const s = this.analysis.summary;
    const text = [
      `HAR: ${this.fileName}`,
      `Page: ${s.pageTitle}`,
      `${s.totalRequests} requests · ${this.formatBytes(s.totalTransferSize)} transferred · ${this.formatMs(s.totalSpan)} span`,
      `Load ${this.analysis.onLoad !== null ? this.formatMs(this.analysis.onLoad) : 'n/a'} · DCL ${this.analysis.domContentLoaded !== null ? this.formatMs(this.analysis.domContentLoaded) : 'n/a'}`,
      `${s.failedRequests} failed · ${s.redirects} redirects · ${s.thirdPartyRequests} third-party`,
    ].join('\n');
    void this.copy(text, 'summary');
  }

  private async copy(text: string, field: string): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    this.copiedField = field;
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copiedField = null;
      this.cdr.markForCheck();
    }, 1800);
    this.cdr.markForCheck();
  }

  private downloadText(text: string, filename: string, mime: string): void {
    this.triggerDownload(new Blob([text], { type: mime }), filename);
  }

  private downloadBuffer(buffer: ArrayBuffer, filename: string): void {
    this.triggerDownload(new Blob([buffer], { type: 'application/json' }), filename);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoked on destroy rather than immediately: Safari has historically
    // cancelled the download if the URL disappears in the same tick.
    setTimeout(() => {
      URL.revokeObjectURL(url);
      this.objectUrls = this.objectUrls.filter(u => u !== url);
    }, 30_000);
  }

  // ── Formatting ────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  formatMs(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1) return '<1 ms';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  formatVital(v: VitalMetric): string {
    if (v.value === null) return 'n/a';
    return v.unit === 'ms' ? this.formatMs(v.value) : v.value.toFixed(2);
  }

  typeLabelFor(type: ResourceType): string {
    return typeLabel(type);
  }

  /** Percentage of the timeline a marker sits at, for the ruler and grid lines. */
  markerPct(value: number | null): number {
    const span = this.analysis?.summary.totalSpan ?? 0;
    if (value === null || span <= 0) return 0;
    return Math.min(100, (value / span) * 100);
  }

  /**
   * The DCL and Load markers are drawn as vertical grid lines inside every
   * waterfall cell rather than as one absolutely-positioned overlay, because a
   * `<tbody>` is not a usable positioning context across browsers. Feeding the
   * percentages in as custom properties lets a single CSS rule paint the lines
   * on every row, perfectly aligned.
   */
  get dclPctCss(): string {
    const value = this.analysis?.domContentLoaded ?? null;
    // -1% parks the grid line off-canvas when the marker is unknown.
    return value === null ? '-1%' : `${this.markerPct(value)}%`;
  }

  get loadPctCss(): string {
    const value = this.analysis?.onLoad ?? null;
    return value === null ? '-1%' : `${this.markerPct(value)}%`;
  }

  /** Five evenly spaced tick labels across the waterfall timeline. */
  get rulerTicks(): { pct: number; label: string }[] {
    const span = this.analysis?.summary.totalSpan ?? 0;
    if (span <= 0) return [];
    return [0, 0.25, 0.5, 0.75, 1].map(f => ({ pct: f * 100, label: this.formatMs(span * f) }));
  }

  /** Bar width as a share of the largest bucket, for the type/domain charts. */
  barPct(value: number, max: number): number {
    if (max <= 0) return 0;
    return Math.max(1.5, (value / max) * 100);
  }

  get maxTypeBytes(): number {
    return this.analysis ? Math.max(1, ...this.analysis.byType.map(t => t.transferSize)) : 1;
  }

  get maxDomainBytes(): number {
    return this.analysis ? Math.max(1, ...this.analysis.byDomain.map(d => d.transferSize)) : 1;
  }

  get topDomains(): DomainBucket[] {
    return this.analysis ? this.analysis.byDomain.slice(0, 8) : [];
  }
}
