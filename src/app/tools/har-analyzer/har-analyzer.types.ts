/**
 * har-analyzer.types.ts — the HAR 1.2 shapes we read, plus the compact
 * analysis model the UI actually renders.
 *
 * Two separate vocabularies live here on purpose:
 *
 *   `Har*`      mirrors the on-disk HAR 1.2 spec (w3c.github.io/web-performance/
 *               specs/HAR/Overview.html) plus the `_`-prefixed extensions Chrome,
 *               Firefox and Safari each add. Everything is optional because every
 *               exporter omits a different subset, and a HAR that came out of a
 *               proxy (Charles, mitmproxy, Fiddler) can be missing half the spec.
 *
 *   `Analysis*` is what crosses the worker boundary. It is deliberately flat and
 *               small: a 100 MB HAR reduces to a few hundred KB here, which is
 *               what makes it cheap to structured-clone back to the main thread.
 *               Per-request headers and bodies are NOT in it — those are fetched
 *               one at a time via the `detail` message when a row is expanded.
 */

// ─────────────────────────────────────────────────────────────
// HAR 1.2 (on-disk shape)
// ─────────────────────────────────────────────────────────────

export interface HarNameValue {
  name: string;
  value: string;
  comment?: string;
}

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface HarPostData {
  mimeType?: string;
  text?: string;
  params?: { name: string; value?: string; fileName?: string; contentType?: string }[];
}

export interface HarRequest {
  method?: string;
  url?: string;
  httpVersion?: string;
  headers?: HarNameValue[];
  queryString?: HarNameValue[];
  cookies?: HarCookie[];
  postData?: HarPostData;
  headersSize?: number;
  bodySize?: number;
}

export interface HarContent {
  size?: number;
  compression?: number;
  mimeType?: string;
  text?: string;
  encoding?: string;
}

export interface HarResponse {
  status?: number;
  statusText?: string;
  httpVersion?: string;
  headers?: HarNameValue[];
  cookies?: HarCookie[];
  content?: HarContent;
  redirectURL?: string;
  headersSize?: number;
  bodySize?: number;
  /** Chrome extension: bytes actually pulled over the wire, headers included. */
  _transferSize?: number;
}

/**
 * Per-phase timings, in milliseconds. Spec says `-1` means "not applicable to
 * this request" — a reused connection has no dns/connect/ssl, for instance.
 * `ssl` is contained *within* `connect`, which is the single most commonly
 * mis-rendered detail in HAR viewers; see `splitPhases()`.
 */
export interface HarTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  send?: number;
  wait?: number;
  receive?: number;
  ssl?: number;
}

export interface HarEntry {
  pageref?: string;
  startedDateTime?: string;
  /** Total elapsed ms. Should equal the sum of the non-negative timings. */
  time?: number;
  request?: HarRequest;
  response?: HarResponse;
  cache?: { beforeRequest?: unknown; afterRequest?: unknown };
  timings?: HarTimings;
  serverIPAddress?: string;
  connection?: string;
  /** Chrome: 'document' | 'script' | 'stylesheet' | 'image' | 'xhr' | 'fetch' | 'font' | … */
  _resourceType?: string;
  _priority?: string;
  _initiator?: { type?: string; url?: string; stack?: unknown };
  _fromCache?: string;
  _webSocketMessages?: unknown[];
}

export interface HarPage {
  id?: string;
  title?: string;
  startedDateTime?: string;
  pageTimings?: {
    onContentLoad?: number;
    onLoad?: number;
    /** Firefox/WebPageTest sometimes carry a first-paint marker here. */
    _onRender?: number;
    _firstPaint?: number;
    _firstContentfulPaint?: number;
    _largestContentfulPaint?: number;
  };
}

export interface HarLog {
  version?: string;
  creator?: { name?: string; version?: string };
  browser?: { name?: string; version?: string };
  pages?: HarPage[];
  entries?: HarEntry[];
}

export interface HarFile {
  log?: HarLog;
}

// ─────────────────────────────────────────────────────────────
// Analysis model (worker → UI)
// ─────────────────────────────────────────────────────────────

/** The seven buckets a request's wall-clock time is split into. */
export interface PhaseBreakdown {
  blocked: number;
  dns: number;
  connect: number;
  ssl: number;
  send: number;
  wait: number;
  receive: number;
}

export type ResourceType =
  | 'document'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'xhr'
  | 'media'
  | 'websocket'
  | 'other';

/** One row in the request table / one bar in the waterfall. */
export interface AnalysisRequest {
  /** Index into the original `log.entries`, so `detail` lookups stay O(1). */
  index: number;
  url: string;
  /** Last meaningful path segment, or the host for a bare origin. */
  name: string;
  domain: string;
  path: string;
  method: string;
  status: number;
  statusText: string;
  type: ResourceType;
  mimeType: string;
  /** Bytes over the wire (headers + body) as best the exporter reported. */
  transferSize: number;
  /** Decoded body size. Larger than transferSize when gzip/br was used. */
  contentSize: number;
  /** Milliseconds from navigation start to the moment this request began. */
  startOffset: number;
  /** Total wall-clock ms for this request. */
  duration: number;
  phases: PhaseBreakdown;
  /** Served from the browser/proxy cache — no bytes crossed the wire. */
  fromCache: boolean;
  /** True when the host differs from the document's registrable domain. */
  thirdParty: boolean;
  protocol: string;
  priority: string;
  initiator: string;
  serverIP: string;
  /** True when this entry has any header/cookie/body worth expanding. */
  hasDetail: boolean;
}

export interface TypeBucket {
  type: ResourceType;
  label: string;
  count: number;
  transferSize: number;
  contentSize: number;
  /** Sum of durations, ms — useful but note requests overlap. */
  duration: number;
}

export interface DomainBucket {
  domain: string;
  count: number;
  transferSize: number;
  duration: number;
  thirdParty: boolean;
}

/** Verdict bands borrowed from web.dev's Core Web Vitals thresholds. */
export type VitalRating = 'good' | 'needs-improvement' | 'poor' | 'unknown';

/**
 * A reconstructed metric. `source` is the honest part: a HAR records network
 * activity, not rendering, so only some of these can ever be measured. The UI
 * shows this distinction rather than pretending everything is real.
 */
export interface VitalMetric {
  id: 'ttfb' | 'fcp' | 'lcp' | 'cls' | 'dcl' | 'load';
  label: string;
  /** Milliseconds, or `null` when the HAR simply does not contain it. */
  value: number | null;
  unit: 'ms' | 'score';
  rating: VitalRating;
  /** 'measured' = read straight out of the HAR. 'estimated' = derived proxy. */
  source: 'measured' | 'estimated' | 'unavailable';
  /** One sentence on exactly how this number was arrived at. */
  method: string;
  goodBelow: number;
  poorAbove: number;
}

export type FindingSeverity = 'critical' | 'warning' | 'info';

/** An actionable observation, e.g. "4 text assets shipped uncompressed". */
export interface Finding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  /** Indices into `requests`, so the UI can filter down to the offenders. */
  requestIndices: number[];
  /** Estimated bytes recoverable, when the finding is a size problem. */
  savingsBytes?: number;
}

export interface AnalysisSummary {
  totalRequests: number;
  totalTransferSize: number;
  totalContentSize: number;
  /** Bytes saved by content-encoding, i.e. contentSize − transferSize. */
  compressionSaved: number;
  cachedRequests: number;
  failedRequests: number;
  redirects: number;
  thirdPartyRequests: number;
  thirdPartyTransferSize: number;
  uniqueDomains: number;
  /** Wall-clock span from first request start to last request end, ms. */
  totalSpan: number;
  /** Slowest single request, ms. */
  slowestDuration: number;
  /** Registrable-ish domain of the document request, if we found one. */
  primaryDomain: string;
  pageTitle: string;
  pageUrl: string;
  startedDateTime: string;
  creator: string;
  browser: string;
  harVersion: string;
  /** Requests dropped because the file exceeded MAX_ENTRIES. */
  truncatedEntries: number;
}

export interface HarAnalysis {
  summary: AnalysisSummary;
  requests: AnalysisRequest[];
  byType: TypeBucket[];
  byDomain: DomainBucket[];
  vitals: VitalMetric[];
  findings: Finding[];
  /** Navigation-relative ms of the DOMContentLoaded marker, if recorded. */
  domContentLoaded: number | null;
  /** Navigation-relative ms of the load event, if recorded. */
  onLoad: number | null;
  /** Status-class histogram keyed '2xx' | '3xx' | … */
  statusClasses: { label: string; count: number }[];
}

/** Everything the expanded-row panel shows. Fetched lazily, one row at a time. */
export interface RequestDetail {
  index: number;
  url: string;
  requestHeaders: HarNameValue[];
  responseHeaders: HarNameValue[];
  requestCookies: HarCookie[];
  responseCookies: HarCookie[];
  queryString: HarNameValue[];
  postData: string;
  postDataMime: string;
  /** Truncated to BODY_PREVIEW_LIMIT characters. */
  bodyPreview: string;
  bodyTruncated: boolean;
  bodyMime: string;
  /** Set when the body was base64 in the HAR and we could not decode it. */
  bodyBinary: boolean;
  phases: PhaseBreakdown;
  timingUnavailable: boolean;
}

/** What `redactHar()` removed, so the UI can report it honestly. */
export interface RedactionReport {
  headersRemoved: number;
  cookiesRemoved: number;
  requestBodiesRemoved: number;
  responseBodiesRemoved: number;
  queryParamsRedacted: number;
  bytesBefore: number;
  bytesAfter: number;
}

// ─────────────────────────────────────────────────────────────
// Worker protocol
// ─────────────────────────────────────────────────────────────

export type WorkerRequestMessage =
  | { type: 'parse'; file: File }
  | { type: 'parseText'; text: string }
  | { type: 'detail'; index: number }
  | { type: 'redact' };

export type WorkerResponseMessage =
  | { type: 'progress'; phase: string; pct: number }
  | { type: 'result'; analysis: HarAnalysis }
  | { type: 'detail'; detail: RequestDetail }
  | { type: 'redacted'; buffer: ArrayBuffer; report: RedactionReport }
  | { type: 'error'; message: string };
