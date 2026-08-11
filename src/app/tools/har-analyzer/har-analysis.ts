/**
 * har-analysis.ts — pure functions that turn a parsed HAR into the compact
 * model the UI renders. No DOM, no Angular: this module is imported by both
 * the Web Worker (the normal path) and the component (the fallback path when
 * `Worker` is unavailable), so it must stay environment-agnostic.
 *
 * Design note on why the reduction happens here rather than in the component:
 * a 100 MB HAR is roughly 250 MB of live JS objects. Structured-cloning that
 * across the worker boundary would cost more than parsing it did. Reducing to
 * `HarAnalysis` first — a few hundred KB — is what keeps the handoff cheap.
 */

import type {
  AnalysisRequest,
  AnalysisSummary,
  DomainBucket,
  Finding,
  HarAnalysis,
  HarEntry,
  HarFile,
  HarNameValue,
  PhaseBreakdown,
  RedactionReport,
  RequestDetail,
  ResourceType,
  TypeBucket,
  VitalMetric,
  VitalRating,
} from './har-analyzer.types';

/** Above this, we analyse the first N entries and report the remainder as truncated. */
export const MAX_ENTRIES = 20_000;

/** Response bodies are previewed, never held in full, in the detail panel. */
export const BODY_PREVIEW_LIMIT = 20_000;

/**
 * Public-suffix approximation. A full PSL is ~230 KB and this tool only needs
 * to answer "is this a third party?" — getting `example.co.uk` right covers the
 * long tail that a naive last-two-labels split gets wrong.
 */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in',
  'com.mx', 'com.ar', 'com.co', 'com.tr', 'com.tw', 'com.hk', 'com.sg',
  'co.za', 'co.kr', 'co.il', 'co.id', 'co.th',
  'com.es', 'com.pl', 'com.ua', 'com.vn', 'com.ph', 'com.my', 'com.pe',
  'github.io', 'pages.dev', 'workers.dev', 'vercel.app', 'netlify.app',
  'firebaseapp.com', 'web.app', 'herokuapp.com', 'cloudfront.net',
]);

const TYPE_LABELS: Record<ResourceType, string> = {
  document: 'Document',
  stylesheet: 'Stylesheet',
  script: 'Script',
  image: 'Image',
  font: 'Font',
  xhr: 'XHR / Fetch',
  media: 'Media',
  websocket: 'WebSocket',
  other: 'Other',
};

export function typeLabel(t: ResourceType): string {
  return TYPE_LABELS[t] ?? 'Other';
}

export const RESOURCE_TYPES: ResourceType[] = [
  'document', 'stylesheet', 'script', 'image', 'font', 'xhr', 'media', 'websocket', 'other',
];

/** Header names whose values are always stripped by the redactor. */
const SENSITIVE_HEADER_EXACT = new Set([
  'cookie', 'set-cookie', 'authorization', 'proxy-authorization',
  'www-authenticate', 'proxy-authenticate', 'x-api-key', 'api-key',
  'x-csrf-token', 'x-xsrf-token', 'x-amz-security-token',
]);

/** …plus anything whose name looks credential-shaped. */
const SENSITIVE_HEADER_PATTERN = /token|secret|password|passwd|credential|session|auth|signature|private/i;

/** Query parameters whose values are replaced with `[REDACTED]`. */
const SENSITIVE_PARAM_PATTERN =
  /^(.*(token|secret|password|passwd|credential|session|signature|sig|apikey|api_key|auth|access|refresh|bearer|jwt|otp|code|key).*)$/i;

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────

/** HAR uses `-1` for "phase does not apply". Everything else clamps at zero. */
function phase(v: number | undefined): number {
  return typeof v === 'number' && v > 0 ? v : 0;
}

function header(headers: HarNameValue[] | undefined, name: string): string {
  if (!headers) return '';
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h && typeof h.name === 'string' && h.name.toLowerCase() === lower) {
      return typeof h.value === 'string' ? h.value : '';
    }
  }
  return '';
}

/** Strips the leading `www.` so `www.example.com` and `example.com` group together. */
function hostOf(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url);
  if (!m) return '';
  const authority = m[1];
  const at = authority.lastIndexOf('@');
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  // IPv6 literals keep their brackets; everything else drops the :port.
  const host = hostPort.startsWith('[')
    ? hostPort.slice(0, hostPort.indexOf(']') + 1)
    : hostPort.split(':')[0];
  return host.toLowerCase();
}

/** `a.b.example.co.uk` → `example.co.uk`. Falls back to the host itself. */
export function registrableDomain(host: string): string {
  if (!host || host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

function pathOf(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*([^?#]*)/i.exec(url);
  return m ? (m[1] || '/') : url;
}

/** The label shown in the table's first column: filename, or the host for `/`. */
function displayName(url: string): string {
  const p = pathOf(url);
  const clean = p.split(/[?#]/)[0];
  const segments = clean.split('/').filter(Boolean);
  if (!segments.length) return hostOf(url) || url;
  const last = segments[segments.length - 1];
  return last.length > 64 ? last.slice(0, 61) + '…' : last;
}

const EXTENSION_TYPES: [RegExp, ResourceType][] = [
  [/\.(css)(\?|#|$)/i, 'stylesheet'],
  [/\.(m?js|jsx|ts|mjs|cjs)(\?|#|$)/i, 'script'],
  [/\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|apng)(\?|#|$)/i, 'image'],
  [/\.(woff2?|ttf|otf|eot)(\?|#|$)/i, 'font'],
  [/\.(mp4|webm|ogg|mp3|wav|m4a|mov|avi|flac|aac|m3u8|ts)(\?|#|$)/i, 'media'],
  [/\.(html?|xhtml)(\?|#|$)/i, 'document'],
  [/\.(json|xml)(\?|#|$)/i, 'xhr'],
];

/**
 * Resolves a resource type. Chrome's `_resourceType` is authoritative when
 * present; otherwise we fall back to the MIME type, then to the extension.
 * Proxy-captured HARs (Charles, mitmproxy) have neither `_resourceType` nor,
 * often, a useful MIME, which is why the extension pass exists at all.
 */
function resolveType(entry: HarEntry, url: string, mimeType: string): ResourceType {
  const raw = (entry._resourceType || '').toLowerCase();
  switch (raw) {
    case 'document': case 'main_frame': case 'sub_frame': case 'iframe': return 'document';
    case 'stylesheet': case 'css': return 'stylesheet';
    case 'script': case 'js': return 'script';
    case 'image': case 'img': case 'imageset': return 'image';
    case 'font': return 'font';
    case 'xhr': case 'fetch': case 'beacon': case 'ping': return 'xhr';
    case 'media': case 'audio': case 'video': return 'media';
    case 'websocket': case 'ws': return 'websocket';
    case 'manifest': case 'other': case 'texttrack': break;
  }

  if (Array.isArray(entry._webSocketMessages) || /^wss?:/i.test(url)) return 'websocket';

  const mime = mimeType.toLowerCase();
  if (mime.startsWith('text/css')) return 'stylesheet';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('font/') || mime.includes('woff') || mime.includes('opentype') || mime.includes('truetype')) return 'font';
  if (mime.startsWith('audio/') || mime.startsWith('video/')) return 'media';
  if (mime.includes('javascript') || mime.includes('ecmascript')) return 'script';
  if (mime.startsWith('text/html') || mime.includes('xhtml')) return 'document';
  if (mime.includes('json') || mime.includes('xml') || mime.includes('graphql')) return 'xhr';

  for (const [re, t] of EXTENSION_TYPES) {
    if (re.test(url)) return t;
  }
  return 'other';
}

/**
 * Splits HAR timings into non-overlapping display buckets.
 *
 * The spec nests TLS inside `connect` (`ssl` is a sub-interval of it), so
 * rendering both at face value double-counts the handshake and pushes every
 * later bar to the right. We subtract it out here so the segments sum to the
 * bar width. `send`/`wait`/`receive` are already disjoint.
 */
export function splitPhases(entry: HarEntry): PhaseBreakdown {
  const t = entry.timings || {};
  const ssl = phase(t.ssl);
  const connectTotal = phase(t.connect);
  return {
    blocked: phase(t.blocked),
    dns: phase(t.dns),
    // Never let a malformed HAR (ssl > connect) produce a negative segment.
    connect: Math.max(0, connectTotal - ssl),
    ssl,
    send: phase(t.send),
    wait: phase(t.wait),
    receive: phase(t.receive),
  };
}

function phaseTotal(p: PhaseBreakdown): number {
  return p.blocked + p.dns + p.connect + p.ssl + p.send + p.wait + p.receive;
}

/** Bytes actually pulled over the wire, reconciling the three ways HARs report it. */
function resolveTransferSize(entry: HarEntry): number {
  const res = entry.response || {};
  if (typeof res._transferSize === 'number' && res._transferSize >= 0) return res._transferSize;
  const hs = typeof res.headersSize === 'number' && res.headersSize > 0 ? res.headersSize : 0;
  const bs = typeof res.bodySize === 'number' && res.bodySize > 0 ? res.bodySize : 0;
  if (hs + bs > 0) return hs + bs;
  const size = res.content?.size;
  return typeof size === 'number' && size > 0 ? size : 0;
}

function resolveContentSize(entry: HarEntry): number {
  const size = entry.response?.content?.size;
  if (typeof size === 'number' && size > 0) return size;
  const bs = entry.response?.bodySize;
  return typeof bs === 'number' && bs > 0 ? bs : 0;
}

function isCached(entry: HarEntry, transferSize: number, contentSize: number): boolean {
  if (entry._fromCache) return true;
  if (entry.response?.status === 304) return true;
  if (entry.cache && typeof entry.cache === 'object' && entry.cache.afterRequest != null) return true;
  // No bytes on the wire but a body came back — only cache explains that.
  return transferSize === 0 && contentSize > 0 && (entry.response?.status ?? 0) > 0;
}

function normaliseProtocol(v: string): string {
  const s = (v || '').toLowerCase().trim();
  if (!s || s === 'unknown') return '';
  if (s === 'h2' || s === 'http/2.0' || s === 'http/2') return 'h2';
  if (s === 'h3' || s === 'http/3.0' || s === 'http/3') return 'h3';
  return s;
}

// ─────────────────────────────────────────────────────────────
// Core analysis
// ─────────────────────────────────────────────────────────────

/**
 * Reduces a parsed HAR to the render model.
 *
 * `onProgress` is called with a 0-100 percentage so the worker can stream
 * updates during the entry walk — on a 100 MB file that loop takes long enough
 * that a silent progress bar reads as a hang.
 */
export function analyzeHar(har: HarFile, onProgress?: (pct: number) => void): HarAnalysis {
  const log = har?.log;
  if (!log || !Array.isArray(log.entries)) {
    throw new Error('Not a valid HAR file — expected a top-level "log.entries" array.');
  }

  const allEntries = log.entries;
  const truncatedEntries = Math.max(0, allEntries.length - MAX_ENTRIES);
  const entries = truncatedEntries > 0 ? allEntries.slice(0, MAX_ENTRIES) : allEntries;

  // ── Navigation start ──
  // Prefer the first page's start; a HAR from a proxy has no pages block, so
  // fall back to the earliest request we can see.
  const pages = Array.isArray(log.pages) ? log.pages : [];
  const firstPage = pages[0];
  let navStart = firstPage?.startedDateTime ? Date.parse(firstPage.startedDateTime) : NaN;
  if (!Number.isFinite(navStart)) {
    navStart = Number.POSITIVE_INFINITY;
    for (const e of entries) {
      const t = e?.startedDateTime ? Date.parse(e.startedDateTime) : NaN;
      if (Number.isFinite(t) && t < navStart) navStart = t;
    }
    if (!Number.isFinite(navStart)) navStart = 0;
  }

  // ── The document request anchors "first party" and TTFB ──
  let documentIndex = -1;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rt = (e?._resourceType || '').toLowerCase();
    const mime = (e?.response?.content?.mimeType || '').toLowerCase();
    const status = e?.response?.status ?? 0;
    const isHtml = rt === 'document' || rt === 'main_frame' || mime.startsWith('text/html');
    if (isHtml && status >= 200 && status < 300) { documentIndex = i; break; }
    if (documentIndex < 0 && isHtml) documentIndex = i;
  }
  const documentUrl = documentIndex >= 0 ? (entries[documentIndex]?.request?.url || '') : '';
  const primaryHost = hostOf(documentUrl) || hostOf(entries[0]?.request?.url || '');
  const primaryDomain = registrableDomain(primaryHost);

  // ── Entry walk ──
  const requests: AnalysisRequest[] = [];
  const progressStep = Math.max(1, Math.floor(entries.length / 20));
  let spanEnd = 0;
  let spanStart = Number.POSITIVE_INFINITY;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i] || {};
    const req = e.request || {};
    const res = e.response || {};
    const url = typeof req.url === 'string' ? req.url : '';
    const mimeType = (res.content?.mimeType || '').split(';')[0].trim();

    const startedMs = e.startedDateTime ? Date.parse(e.startedDateTime) : NaN;
    const startOffset = Number.isFinite(startedMs) ? Math.max(0, startedMs - navStart) : 0;

    const phases = splitPhases(e);
    const summed = phaseTotal(phases);
    // `time` is authoritative when present; some exporters omit it, and some
    // report a total that disagrees with the phases. Trust the larger of the two
    // so a bar is never shorter than the segments drawn inside it.
    const reported = typeof e.time === 'number' && e.time > 0 ? e.time : 0;
    const duration = Math.max(reported, summed);

    const transferSize = resolveTransferSize(e);
    const contentSize = resolveContentSize(e);
    const host = hostOf(url);
    const domain = registrableDomain(host);

    const status = typeof res.status === 'number' ? res.status : 0;

    requests.push({
      index: i,
      url,
      name: displayName(url),
      domain: host || domain || '(unknown)',
      path: pathOf(url),
      method: (req.method || 'GET').toUpperCase(),
      status,
      statusText: res.statusText || '',
      type: resolveType(e, url, mimeType),
      mimeType: mimeType || '—',
      transferSize,
      contentSize,
      startOffset,
      duration,
      phases,
      fromCache: isCached(e, transferSize, contentSize),
      thirdParty: !!domain && !!primaryDomain && domain !== primaryDomain,
      protocol: normaliseProtocol(res.httpVersion || req.httpVersion || ''),
      priority: e._priority || '',
      initiator: e._initiator?.type || '',
      serverIP: e.serverIPAddress || '',
      hasDetail: !!(req.headers?.length || res.headers?.length || res.content?.text || req.postData?.text),
    });

    if (startOffset < spanStart) spanStart = startOffset;
    if (startOffset + duration > spanEnd) spanEnd = startOffset + duration;

    if (onProgress && i % progressStep === 0) {
      onProgress(Math.round((i / entries.length) * 100));
    }
  }
  if (!Number.isFinite(spanStart)) spanStart = 0;

  // ── Page timings ──
  const pt = firstPage?.pageTimings || {};
  const domContentLoaded = typeof pt.onContentLoad === 'number' && pt.onContentLoad > 0 ? pt.onContentLoad : null;
  const onLoad = typeof pt.onLoad === 'number' && pt.onLoad > 0 ? pt.onLoad : null;

  // ── Aggregates ──
  const byTypeMap = new Map<ResourceType, TypeBucket>();
  const byDomainMap = new Map<string, DomainBucket>();
  const statusMap = new Map<string, number>();

  let totalTransferSize = 0;
  let totalContentSize = 0;
  let cachedRequests = 0;
  let failedRequests = 0;
  let redirects = 0;
  let thirdPartyRequests = 0;
  let thirdPartyTransferSize = 0;
  let slowestDuration = 0;

  for (const r of requests) {
    totalTransferSize += r.transferSize;
    totalContentSize += r.contentSize;
    if (r.fromCache) cachedRequests++;
    if (r.status >= 400 || r.status === 0) failedRequests++;
    if (r.status >= 300 && r.status < 400) redirects++;
    if (r.thirdParty) { thirdPartyRequests++; thirdPartyTransferSize += r.transferSize; }
    if (r.duration > slowestDuration) slowestDuration = r.duration;

    const tb = byTypeMap.get(r.type) ?? { type: r.type, label: typeLabel(r.type), count: 0, transferSize: 0, contentSize: 0, duration: 0 };
    tb.count++; tb.transferSize += r.transferSize; tb.contentSize += r.contentSize; tb.duration += r.duration;
    byTypeMap.set(r.type, tb);

    const db = byDomainMap.get(r.domain) ?? { domain: r.domain, count: 0, transferSize: 0, duration: 0, thirdParty: r.thirdParty };
    db.count++; db.transferSize += r.transferSize; db.duration += r.duration;
    byDomainMap.set(r.domain, db);

    const cls = r.status === 0 ? 'failed' : `${Math.floor(r.status / 100)}xx`;
    statusMap.set(cls, (statusMap.get(cls) ?? 0) + 1);
  }

  const byType = [...byTypeMap.values()].sort((a, b) => b.transferSize - a.transferSize || b.count - a.count);
  const byDomain = [...byDomainMap.values()].sort((a, b) => b.transferSize - a.transferSize || b.count - a.count);

  const statusOrder = ['2xx', '3xx', '4xx', '5xx', '1xx', 'failed'];
  const statusClasses = statusOrder
    .filter(k => statusMap.has(k))
    .map(k => ({ label: k === 'failed' ? 'No response' : k, count: statusMap.get(k)! }));

  const summary: AnalysisSummary = {
    totalRequests: requests.length,
    totalTransferSize,
    totalContentSize,
    compressionSaved: Math.max(0, totalContentSize - totalTransferSize),
    cachedRequests,
    failedRequests,
    redirects,
    thirdPartyRequests,
    thirdPartyTransferSize,
    uniqueDomains: byDomainMap.size,
    totalSpan: Math.max(spanEnd, onLoad ?? 0, domContentLoaded ?? 0),
    slowestDuration,
    primaryDomain: primaryDomain || primaryHost || '—',
    pageTitle: firstPage?.title || documentUrl || '—',
    pageUrl: documentUrl,
    startedDateTime: firstPage?.startedDateTime || entries[0]?.startedDateTime || '',
    creator: log.creator?.name ? `${log.creator.name}${log.creator.version ? ' ' + log.creator.version : ''}` : '—',
    browser: log.browser?.name ? `${log.browser.name}${log.browser.version ? ' ' + log.browser.version : ''}` : '—',
    harVersion: log.version || '1.2',
    truncatedEntries,
  };

  const vitals = reconstructVitals(requests, documentIndex, domContentLoaded, onLoad, firstPage?.pageTimings);
  const findings = deriveFindings(requests, entries, summary);

  onProgress?.(100);

  return { summary, requests, byType, byDomain, vitals, findings, domContentLoaded, onLoad, statusClasses };
}

// ─────────────────────────────────────────────────────────────
// Core Web Vitals reconstruction
// ─────────────────────────────────────────────────────────────

function rate(value: number | null, good: number, poor: number): VitalRating {
  if (value === null) return 'unknown';
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Reconstructs what a HAR can honestly tell you about Core Web Vitals.
 *
 * A HAR is a *network* log. It records when bytes moved, not when pixels
 * painted, so LCP and FCP cannot be measured from one — only bounded. Rather
 * than quietly presenting a guess as a measurement, every metric carries a
 * `source` and a one-line `method`, and the UI renders estimates differently
 * from measurements. CLS has no network proxy at all and is reported as
 * unavailable rather than fabricated.
 *
 * Where an exporter *did* record real paint timings (WebPageTest and some
 * Lighthouse HARs put them in `pageTimings._firstContentfulPaint` /
 * `_largestContentfulPaint`), those win and are marked as measured.
 */
function reconstructVitals(
  requests: AnalysisRequest[],
  documentIndex: number,
  dcl: number | null,
  onLoad: number | null,
  pageTimings?: { _firstPaint?: number; _firstContentfulPaint?: number; _largestContentfulPaint?: number; _onRender?: number },
): VitalMetric[] {
  const doc = documentIndex >= 0 ? requests.find(r => r.index === documentIndex) : undefined;

  // ── TTFB: genuinely measured. Everything before the first response byte. ──
  let ttfb: number | null = null;
  if (doc) {
    const p = doc.phases;
    ttfb = doc.startOffset + p.blocked + p.dns + p.connect + p.ssl + p.send + p.wait;
  }

  // ── FCP: bounded below by the render-blocking chain finishing. ──
  const realFcp = typeof pageTimings?._firstContentfulPaint === 'number' && pageTimings._firstContentfulPaint > 0
    ? pageTimings._firstContentfulPaint
    : (typeof pageTimings?._firstPaint === 'number' && pageTimings._firstPaint > 0 ? pageTimings._firstPaint : null);

  const docEnd = doc ? doc.startOffset + doc.duration : 0;
  // Render-blocking approximation: stylesheets, plus scripts that started
  // before the document finished parsing (a defer/async script generally
  // starts later, so this over-selects far less than it looks like it would).
  const blockingCutoff = dcl ?? (docEnd * 2 || Number.POSITIVE_INFINITY);
  let blockingEnd = docEnd;
  for (const r of requests) {
    if (r.startOffset > blockingCutoff) continue;
    if (r.type !== 'stylesheet' && r.type !== 'script') continue;
    const end = r.startOffset + r.duration;
    if (end > blockingEnd) blockingEnd = end;
  }
  const fcpEstimate = blockingEnd > 0 ? blockingEnd : null;
  const fcp = realFcp ?? fcpEstimate;

  // ── LCP: the largest above-the-fold element usually is the biggest image
  //    that arrived before load. Without layout data that is the best bound
  //    available; text-only pages fall back to the FCP estimate. ──
  const realLcp = typeof pageTimings?._largestContentfulPaint === 'number' && pageTimings._largestContentfulPaint > 0
    ? pageTimings._largestContentfulPaint
    : null;

  let heaviestVisualEnd = 0;
  let heaviestVisualBytes = 0;
  const lcpWindow = onLoad ?? Number.POSITIVE_INFINITY;
  for (const r of requests) {
    if (r.type !== 'image' && r.type !== 'media') continue;
    const end = r.startOffset + r.duration;
    if (end > lcpWindow) continue;
    const bytes = Math.max(r.contentSize, r.transferSize);
    if (bytes > heaviestVisualBytes) { heaviestVisualBytes = bytes; heaviestVisualEnd = end; }
  }
  const lcpEstimate = fcpEstimate === null
    ? (heaviestVisualEnd || null)
    : Math.max(fcpEstimate, heaviestVisualEnd);
  const lcp = realLcp ?? lcpEstimate;

  return [
    {
      id: 'ttfb',
      label: 'TTFB',
      value: ttfb,
      unit: 'ms',
      rating: rate(ttfb, 800, 1800),
      source: ttfb === null ? 'unavailable' : 'measured',
      method: ttfb === null
        ? 'No document request found in this HAR, so there is no first byte to time.'
        : 'Measured: the document request’s queueing, DNS, connect, TLS, send and wait phases, offset from navigation start.',
      goodBelow: 800,
      poorAbove: 1800,
    },
    {
      id: 'fcp',
      label: 'FCP',
      value: fcp,
      unit: 'ms',
      rating: rate(fcp, 1800, 3000),
      source: realFcp !== null ? 'measured' : (fcp === null ? 'unavailable' : 'estimated'),
      method: realFcp !== null
        ? 'Measured: this HAR carried a real first-paint marker from the exporter.'
        : 'Estimated: when the render-blocking chain (document + stylesheets + early scripts) finished downloading. Real FCP is at or after this point.',
      goodBelow: 1800,
      poorAbove: 3000,
    },
    {
      id: 'lcp',
      label: 'LCP',
      value: lcp,
      unit: 'ms',
      rating: rate(lcp, 2500, 4000),
      source: realLcp !== null ? 'measured' : (lcp === null ? 'unavailable' : 'estimated'),
      method: realLcp !== null
        ? 'Measured: this HAR carried a real largest-contentful-paint marker from the exporter.'
        : 'Estimated: the later of the FCP estimate and the arrival of the heaviest image or media file before the load event. A HAR has no layout data, so the true LCP element cannot be identified.',
      goodBelow: 2500,
      poorAbove: 4000,
    },
    {
      id: 'cls',
      label: 'CLS',
      value: null,
      unit: 'score',
      rating: 'unknown',
      source: 'unavailable',
      method: 'Not derivable. CLS measures layout movement, and a HAR contains no layout or paint records — any number here would be invented. Capture it with the Performance panel or field data instead.',
      goodBelow: 0.1,
      poorAbove: 0.25,
    },
    {
      id: 'dcl',
      label: 'DOMContentLoaded',
      value: dcl,
      unit: 'ms',
      rating: rate(dcl, 2000, 4000),
      source: dcl === null ? 'unavailable' : 'measured',
      method: dcl === null
        ? 'This HAR has no page timings block — common in proxy captures, which never see the browser’s events.'
        : 'Measured: read directly from log.pages[0].pageTimings.onContentLoad.',
      goodBelow: 2000,
      poorAbove: 4000,
    },
    {
      id: 'load',
      label: 'Load',
      value: onLoad,
      unit: 'ms',
      rating: rate(onLoad, 3000, 6000),
      source: onLoad === null ? 'unavailable' : 'measured',
      method: onLoad === null
        ? 'This HAR has no page timings block — common in proxy captures, which never see the browser’s events.'
        : 'Measured: read directly from log.pages[0].pageTimings.onLoad.',
      goodBelow: 3000,
      poorAbove: 6000,
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Findings
// ─────────────────────────────────────────────────────────────

const TEXTUAL_MIME = /^(text\/|application\/(javascript|x-javascript|ecmascript|json|xml|xhtml|rss|atom|manifest|graphql)|image\/svg)/i;
const COMPRESSED_ENCODING = /\b(gzip|br|deflate|zstd|compress)\b/i;

/**
 * Derives the "what's actually wrong with this page" list. Each finding names
 * the offending requests so the UI can filter down to them in one click.
 * Thresholds follow Lighthouse's audits where an equivalent audit exists.
 */
function deriveFindings(requests: AnalysisRequest[], entries: HarEntry[], summary: AnalysisSummary): Finding[] {
  const findings: Finding[] = [];

  const uncompressed: number[] = [];
  let uncompressedSavings = 0;
  const noCache: number[] = [];
  const bigImages: number[] = [];
  let bigImageBytes = 0;
  const legacyImages: number[] = [];
  const failed: number[] = [];
  const redirected: number[] = [];
  const slowServer: number[] = [];
  const longBlocked: number[] = [];
  const http1: number[] = [];
  const insecure: number[] = [];
  const fatCookies: number[] = [];

  for (const r of requests) {
    const entry = entries[r.index];
    const res = entry?.response;
    const req = entry?.request;

    if (r.status >= 400 || r.status === 0) failed.push(r.index);
    if (r.status >= 300 && r.status < 400) redirected.push(r.index);
    if (/^http:\/\//i.test(r.url)) insecure.push(r.index);

    if (!r.fromCache && r.contentSize > 1400 && TEXTUAL_MIME.test(r.mimeType)) {
      const enc = header(res?.headers, 'content-encoding');
      if (!COMPRESSED_ENCODING.test(enc)) {
        uncompressed.push(r.index);
        // Brotli on text averages ~70-80% off; 65% is a conservative claim.
        uncompressedSavings += Math.round(r.contentSize * 0.65);
      }
    }

    const cacheable = r.type === 'image' || r.type === 'font' || r.type === 'script' || r.type === 'stylesheet' || r.type === 'media';
    if (cacheable && r.status === 200 && !r.thirdParty) {
      const cc = header(res?.headers, 'cache-control');
      const maxAge = /max-age=(\d+)/i.exec(cc);
      const immutable = /immutable/i.test(cc);
      const noStore = /no-store|no-cache/i.test(cc);
      const seconds = maxAge ? parseInt(maxAge[1], 10) : -1;
      if (!immutable && (noStore || seconds < 0 || seconds < 86_400)) {
        noCache.push(r.index);
      }
    }

    if (r.type === 'image') {
      if (r.transferSize > 200_000) { bigImages.push(r.index); bigImageBytes += r.transferSize; }
      if (r.transferSize > 100_000 && /image\/(jpe?g|png)/i.test(r.mimeType)) legacyImages.push(r.index);
    }

    if (!r.fromCache && r.phases.wait > 600) slowServer.push(r.index);
    if (r.phases.blocked > 250) longBlocked.push(r.index);
    if (r.protocol === 'http/1.1' || r.protocol === 'http/1.0') http1.push(r.index);

    const cookieHeader = header(req?.headers, 'cookie');
    if (cookieHeader.length > 1024) fatCookies.push(r.index);
  }

  const push = (
    id: string, severity: Finding['severity'], indices: number[],
    title: string, detail: string, savingsBytes?: number,
  ) => {
    if (indices.length) findings.push({ id, severity, title, detail, requestIndices: indices, savingsBytes });
  };

  push('failed', 'critical', failed,
    `${failed.length} request${failed.length === 1 ? '' : 's'} failed`,
    'Responses with a 4xx/5xx status, or no response at all. Broken sub-resources still cost connection setup and can block rendering.');

  push('insecure', 'critical', insecure,
    `${insecure.length} request${insecure.length === 1 ? '' : 's'} sent over plain HTTP`,
    'Mixed content is blocked or upgraded by modern browsers and leaks request contents in transit.');

  push('uncompressed', 'warning', uncompressed,
    `${uncompressed.length} text asset${uncompressed.length === 1 ? '' : 's'} shipped uncompressed`,
    'These responses are text but carry no Content-Encoding. Enabling Brotli or gzip at the origin or CDN is usually a one-line config change.',
    uncompressedSavings);

  push('slow-server', 'warning', slowServer,
    `${slowServer.length} response${slowServer.length === 1 ? '' : 's'} waited over 600 ms on the server`,
    'Time spent in the "waiting" phase is server think-time, not network. Caching, query tuning or an edge function usually moves this the most.');

  push('big-images', 'warning', bigImages,
    `${bigImages.length} image${bigImages.length === 1 ? '' : 's'} over 200 KB`,
    'Large images dominate LCP on most pages. Resize to the rendered dimensions and serve responsive `srcset` variants.',
    Math.round(bigImageBytes * 0.4));

  push('legacy-images', 'info', legacyImages,
    `${legacyImages.length} large JPEG/PNG could be AVIF or WebP`,
    'Modern formats typically cut 30-50% off a photographic image at the same perceptual quality.');

  push('no-cache', 'warning', noCache,
    `${noCache.length} static asset${noCache.length === 1 ? ' lacks' : 's lack'} a long cache lifetime`,
    'First-party static assets with a fingerprinted filename should be served `Cache-Control: public, max-age=31536000, immutable`. Repeat visits pay full download cost without it.');

  push('redirects', 'info', redirected,
    `${redirected.length} redirect${redirected.length === 1 ? '' : 's'}`,
    'Each redirect adds a full round trip before any useful byte arrives. Redirects on the document request delay everything downstream.');

  push('blocked', 'info', longBlocked,
    `${longBlocked.length} request${longBlocked.length === 1 ? '' : 's'} queued for over 250 ms`,
    'Long queueing usually means connection-limit contention (HTTP/1.1 six-per-origin) or too many requests fired at once.');

  push('http1', 'info', http1,
    `${http1.length} request${http1.length === 1 ? '' : 's'} still on HTTP/1.x`,
    'HTTP/2 multiplexes over one connection and removes the six-per-origin bottleneck. Most CDNs enable it with a toggle.');

  push('fat-cookies', 'info', fatCookies,
    `${fatCookies.length} request${fatCookies.length === 1 ? '' : 's'} carried over 1 KB of cookies`,
    'Cookies are re-sent on every matching request, including static assets. Serve assets from a cookieless domain or narrow the cookie path.');

  if (summary.totalTransferSize > 0) {
    const share = summary.thirdPartyTransferSize / summary.totalTransferSize;
    if (share > 0.3 && summary.thirdPartyRequests > 0) {
      findings.push({
        id: 'third-party',
        severity: 'warning',
        title: `Third parties account for ${Math.round(share * 100)}% of bytes`,
        detail: `${summary.thirdPartyRequests} requests to domains other than ${summary.primaryDomain}. Third-party scripts are the least controllable part of a page budget — audit whether each one still earns its weight.`,
        requestIndices: requests.filter(r => r.thirdParty).map(r => r.index),
      });
    }
  }

  const order: Record<Finding['severity'], number> = { critical: 0, warning: 1, info: 2 };
  return findings.sort((a, b) =>
    order[a.severity] - order[b.severity] ||
    (b.savingsBytes ?? 0) - (a.savingsBytes ?? 0) ||
    b.requestIndices.length - a.requestIndices.length);
}

// ─────────────────────────────────────────────────────────────
// Detail extraction
// ─────────────────────────────────────────────────────────────

function decodeBody(content: { text?: string; encoding?: string; mimeType?: string } | undefined): { text: string; binary: boolean } {
  if (!content || typeof content.text !== 'string' || !content.text) return { text: '', binary: false };
  if (content.encoding !== 'base64') return { text: content.text, binary: false };

  const mime = (content.mimeType || '').toLowerCase();
  if (!TEXTUAL_MIME.test(mime)) return { text: '', binary: true };
  try {
    // atob exists in both window and worker scopes.
    const binary = atob(content.text.slice(0, Math.ceil(BODY_PREVIEW_LIMIT * 1.4)));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return { text: new TextDecoder('utf-8', { fatal: false }).decode(bytes), binary: false };
  } catch {
    return { text: '', binary: true };
  }
}

export function extractDetail(har: HarFile, index: number): RequestDetail {
  const entry = har?.log?.entries?.[index];
  if (!entry) throw new Error(`No entry at index ${index}.`);

  const req = entry.request || {};
  const res = entry.response || {};
  const content = res.content || {};

  const decoded = decodeBody(content);
  const bodyTruncated = decoded.text.length > BODY_PREVIEW_LIMIT;

  const phases = splitPhases(entry);

  return {
    index,
    url: req.url || '',
    requestHeaders: Array.isArray(req.headers) ? req.headers : [],
    responseHeaders: Array.isArray(res.headers) ? res.headers : [],
    requestCookies: Array.isArray(req.cookies) ? req.cookies : [],
    responseCookies: Array.isArray(res.cookies) ? res.cookies : [],
    queryString: Array.isArray(req.queryString) ? req.queryString : [],
    postData: typeof req.postData?.text === 'string' ? req.postData.text.slice(0, BODY_PREVIEW_LIMIT) : '',
    postDataMime: req.postData?.mimeType || '',
    bodyPreview: bodyTruncated ? decoded.text.slice(0, BODY_PREVIEW_LIMIT) : decoded.text,
    bodyTruncated,
    bodyMime: content.mimeType || '',
    bodyBinary: decoded.binary,
    phases,
    timingUnavailable: phaseTotal(phases) === 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Redaction
// ─────────────────────────────────────────────────────────────

function isSensitiveHeader(name: string): boolean {
  const n = (name || '').toLowerCase();
  return SENSITIVE_HEADER_EXACT.has(n) || SENSITIVE_HEADER_PATTERN.test(n);
}

/** Rewrites a URL's query string, masking values whose key looks credential-shaped. */
function redactUrl(url: string, counter: { n: number }): string {
  const q = url.indexOf('?');
  if (q < 0) return url;
  const hashAt = url.indexOf('#', q);
  const base = url.slice(0, q);
  const query = url.slice(q + 1, hashAt < 0 ? undefined : hashAt);
  const hash = hashAt < 0 ? '' : url.slice(hashAt);

  const parts = query.split('&').map(pair => {
    const eq = pair.indexOf('=');
    if (eq < 0) return pair;
    const key = pair.slice(0, eq);
    let decodedKey = key;
    try { decodedKey = decodeURIComponent(key); } catch { /* keep raw key */ }
    if (SENSITIVE_PARAM_PATTERN.test(decodedKey)) {
      counter.n++;
      return `${key}=%5BREDACTED%5D`;
    }
    return pair;
  });

  return `${base}?${parts.join('&')}${hash}`;
}

/**
 * Produces a shareable copy of the HAR with credentials and payloads removed.
 *
 * This rebuilds the object graph rather than mutating in place, for two
 * reasons: the in-memory HAR must stay intact so the detail panel keeps
 * working after a redaction, and for any capture that carries response bodies
 * — which is most of them — dropping those bodies shrinks the export by an
 * order of magnitude, which is what makes it attachable to a bug report at all.
 */
export function redactHar(har: HarFile, originalBytes: number): { json: string; report: RedactionReport } {
  const report: RedactionReport = {
    headersRemoved: 0,
    cookiesRemoved: 0,
    requestBodiesRemoved: 0,
    responseBodiesRemoved: 0,
    queryParamsRedacted: 0,
    bytesBefore: originalBytes,
    bytesAfter: 0,
  };
  const paramCounter = { n: 0 };

  const filterHeaders = (headers: HarNameValue[] | undefined): HarNameValue[] => {
    if (!Array.isArray(headers)) return [];
    const out: HarNameValue[] = [];
    for (const h of headers) {
      if (!h || typeof h.name !== 'string') continue;
      if (isSensitiveHeader(h.name)) {
        report.headersRemoved++;
        out.push({ name: h.name, value: '[REDACTED]' });
      } else {
        out.push({ name: h.name, value: typeof h.value === 'string' ? h.value : '' });
      }
    }
    return out;
  };

  const log = har.log || {};
  const entries = Array.isArray(log.entries) ? log.entries : [];

  const redactedEntries = entries.map(entry => {
    const req = entry.request || {};
    const res = entry.response || {};
    const content = res.content || {};

    report.cookiesRemoved += (req.cookies?.length ?? 0) + (res.cookies?.length ?? 0);
    if (req.postData?.text) report.requestBodiesRemoved++;
    if (content.text) report.responseBodiesRemoved++;

    const queryString = Array.isArray(req.queryString)
      ? req.queryString.map(q => {
          if (q && typeof q.name === 'string' && SENSITIVE_PARAM_PATTERN.test(q.name)) {
            paramCounter.n++;
            return { name: q.name, value: '[REDACTED]' };
          }
          return { name: q?.name ?? '', value: q?.value ?? '' };
        })
      : [];

    return {
      pageref: entry.pageref,
      startedDateTime: entry.startedDateTime,
      time: entry.time,
      request: {
        method: req.method,
        url: redactUrl(req.url || '', paramCounter),
        httpVersion: req.httpVersion,
        headers: filterHeaders(req.headers),
        queryString,
        cookies: [],
        headersSize: req.headersSize,
        bodySize: req.bodySize,
        ...(req.postData
          ? { postData: { mimeType: req.postData.mimeType || '', text: '[REDACTED]' } }
          : {}),
      },
      response: {
        status: res.status,
        statusText: res.statusText,
        httpVersion: res.httpVersion,
        headers: filterHeaders(res.headers),
        cookies: [],
        content: {
          size: content.size,
          mimeType: content.mimeType,
          ...(content.compression !== undefined ? { compression: content.compression } : {}),
          ...(content.text ? { comment: 'Body removed by xsantcastx HAR Analyzer redaction' } : {}),
        },
        redirectURL: redactUrl(res.redirectURL || '', paramCounter),
        headersSize: res.headersSize,
        bodySize: res.bodySize,
        ...(typeof res._transferSize === 'number' ? { _transferSize: res._transferSize } : {}),
      },
      cache: {},
      timings: entry.timings,
      ...(entry.serverIPAddress ? { serverIPAddress: entry.serverIPAddress } : {}),
      ...(entry.connection ? { connection: entry.connection } : {}),
      ...(entry._resourceType ? { _resourceType: entry._resourceType } : {}),
      ...(entry._priority ? { _priority: entry._priority } : {}),
    };
  });

  const redacted = {
    log: {
      version: log.version || '1.2',
      creator: log.creator ?? { name: 'unknown', version: '0' },
      ...(log.browser ? { browser: log.browser } : {}),
      ...(Array.isArray(log.pages)
        ? { pages: log.pages.map(p => ({ ...p, title: p.title ? redactUrl(p.title, paramCounter) : p.title })) }
        : {}),
      entries: redactedEntries,
      comment: 'Redacted by xsantcastx HAR Analyzer — cookies, credential headers and all request/response bodies were removed before export.',
    },
  };

  report.queryParamsRedacted = paramCounter.n;
  const json = JSON.stringify(redacted, null, 2);
  report.bytesAfter = json.length;
  return { json, report };
}
