import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  PLATFORM_ID,
  inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ─── Firestore REST API (bypasses App Check) ──────────────────────────────────

const FS_PROJECT = environment.firebase.projectId;
const FS_KEY     = environment.firebase.apiKey;
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${FS_PROJECT}/databases/(default)/documents`;

function parseDoc(doc: any): Record<string, any> {
  const id = (doc.name || '').split('/').pop() || '';
  const result: Record<string, any> = { id };
  for (const [key, val] of Object.entries(doc.fields || {})) {
    const v = val as any;
    if (v.stringValue  !== undefined) result[key] = v.stringValue;
    else if (v.integerValue  !== undefined) result[key] = parseInt(v.integerValue, 10);
    else if (v.doubleValue   !== undefined) result[key] = v.doubleValue;
    else if (v.booleanValue  !== undefined) result[key] = v.booleanValue;
    else if (v.timestampValue !== undefined) result[key] = new Date(v.timestampValue);
    else if (v.nullValue     !== undefined) result[key] = null;
  }
  return result;
}

function toFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val instanceof Date)       fields[key] = { timestampValue: val.toISOString() };
    else if (typeof val === 'string')  fields[key] = { stringValue: val };
    else if (typeof val === 'number')  fields[key] = { integerValue: String(val) };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
  }
  return fields;
}

/**
 * A bounded, ordered read of one collection.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS REPLACED A LIST CALL
 * ─────────────────────────────────────────────────────────────────────────────
 * This used to be `GET /{col}?pageSize=200` — an unordered list of up to two
 * hundred documents, run against five collections on three-to-eight-second
 * timers. Firestore bills per document returned, so a single visitor sitting on
 * this page cost roughly eleven thousand reads a minute, and a tab left open in
 * the background cost exactly the same as one being watched. That is where the
 * site's read bill was going: not the tools, not the homepage, this page.
 *
 * Two things fix it, and both need a query rather than a list:
 *
 *  - `limit` bounds the worst case. A list call has no ordering, so you cannot
 *    ask for "the newest thirty" — you take two hundred and sort client-side,
 *    which is why the old code did exactly that.
 *  - `after` makes the steady state nearly free. These feeds are append-only, so
 *    once the window is loaded every later poll only wants what arrived since,
 *    and a query that matches nothing is billed as a single read.
 *
 * Returns documents in ascending time order, which is what every caller renders.
 */
async function fsQuery(
  col: string,
  opts: { limit: number; after?: Date | null },
): Promise<Record<string, any>[]> {
  // Ascending straight from the server when we are tailing from a known point,
  // descending when we are taking the newest N of an unbounded collection —
  // "the last thirty" is only expressible as a descending limit.
  const tailing = opts.after instanceof Date;

  const structuredQuery: Record<string, any> = {
    from: [{ collectionId: col }],
    orderBy: [{
      field: { fieldPath: 'timestamp' },
      direction: tailing ? 'ASCENDING' : 'DESCENDING',
    }],
    limit: opts.limit,
  };

  if (tailing) {
    structuredQuery['where'] = {
      fieldFilter: {
        field: { fieldPath: 'timestamp' },
        op: 'GREATER_THAN',
        value: { timestampValue: opts.after!.toISOString() },
      },
    };
  }

  try {
    const res = await fetch(`${FS_BASE}:runQuery?key=${FS_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery }),
    });
    if (!res.ok) return [];

    // runQuery streams an array of results; a run that matched nothing still
    // returns one element, carrying no `document`.
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    const docs = rows
      .filter((r: any) => r?.document)
      .map((r: any) => parseDoc(r.document));

    return tailing ? docs : docs.reverse();
  } catch { return []; }
}

async function fsPost(col: string, obj: Record<string, any>): Promise<boolean> {
  try {
    const res = await fetch(`${FS_BASE}/${col}?key=${FS_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(obj) })
    });
    return res.ok;
  } catch { return false; }
}

async function fsPut(col: string, docId: string, obj: Record<string, any>): Promise<boolean> {
  try {
    const res = await fetch(`${FS_BASE}/${col}/${docId}?key=${FS_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(obj) })
    });
    return res.ok;
  } catch { return false; }
}

async function fsDeleteDoc(col: string, docId: string): Promise<boolean> {
  try {
    const res = await fetch(`${FS_BASE}/${col}/${docId}?key=${FS_KEY}`, { method: 'DELETE' });
    return res.ok;
  } catch { return false; }
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  type: 'tool_call' | 'thinking' | 'success' | 'error' | 'system' | 'output';
  text: string;
  tool?: string;
  detail?: string;
  timestamp: Date;
  isNew?: boolean;
}

export interface ChatMessage {
  id: string;
  name: string;
  message: string;
  timestamp: Date;
  color: string;
  isSystem?: boolean;
  isNew?: boolean;
}

export interface BotMessage {
  id: string;
  botName: string;
  botId: string;
  message: string;
  timestamp: Date;
  isNew?: boolean;
}

interface ToolStat {
  name: string;
  count: number;
  pct: number;
  color: string;
}

type MockEntry = Omit<ActivityEntry, 'id' | 'timestamp' | 'isNew'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_COLORS: Record<string, string> = {
  Read:      '#8B5CF6',
  Grep:      '#7b61ff',
  Edit:      '#ff00ff',
  Write:     '#00ccff',
  Bash:      '#ffcc00',
  Glob:      '#ff8800',
  Agent:     '#ff3399',
  WebFetch:  '#00ff88',
  TodoWrite: '#cc99ff',
};

const BOT_COLORS: Record<string, string> = {
  ops:       '#8B5CF6',
  review:    '#7b61ff',
  analytics: '#ffcc00',
};

const USER_COLORS = ['#8B5CF6', '#7b61ff', '#ff3399', '#ffcc00', '#00ff88', '#ff8800', '#00ccff'];

const MOCK_SEQUENCES: MockEntry[][] = [
  [
    { type: 'system',    text: 'Session initialized — Claude Sonnet 4.6' },
    { type: 'system',    text: 'Workspace connected: xsantcastx.com' },
    { type: 'thinking',  text: 'Analyzing project structure and requirements...' },
    { type: 'tool_call', tool: 'Glob',  text: 'Glob("**/*.ts")',                      detail: '→ 47 files indexed' },
    { type: 'tool_call', tool: 'Read',  text: 'Read("app-routing.module.ts")',          detail: '→ 400 lines parsed' },
    { type: 'thinking',  text: 'Understanding routing module patterns...' },
    { type: 'tool_call', tool: 'Read',  text: 'Read("app.module.ts")',                  detail: '→ 149 lines parsed' },
    { type: 'tool_call', tool: 'Read',  text: 'Read("styles.css")',                     detail: '→ Theme variables extracted' },
    { type: 'thinking',  text: 'Planning neon cyberpunk UI architecture...' },
    { type: 'tool_call', tool: 'Write', text: 'Write("live/live.component.ts")',        detail: '→ 178 lines written' },
    { type: 'output',    text: 'Component class created with mock data engine' },
    { type: 'tool_call', tool: 'Write', text: 'Write("live/live.component.html")',      detail: '→ 115 lines written' },
    { type: 'tool_call', tool: 'Write', text: 'Write("live/live.component.css")',       detail: '→ 312 lines written' },
    { type: 'thinking',  text: 'Registering component in NgModule...' },
    { type: 'tool_call', tool: 'Edit',  text: 'Edit("app.module.ts")',                  detail: '→ LiveComponent declared' },
    { type: 'tool_call', tool: 'Edit',  text: 'Edit("app-routing.module.ts")',           detail: '→ /live route added' },
    { type: 'success',   text: 'Watch Live Work feature deployed successfully' },
  ],
  [
    { type: 'system',    text: 'New task received: Optimize Firestore performance' },
    { type: 'thinking',  text: 'Reviewing Firebase service implementation...' },
    { type: 'tool_call', tool: 'Read',  text: 'Read("firestore.service.ts")',            detail: '→ 42 lines analyzed' },
    { type: 'tool_call', tool: 'Grep',  text: 'Grep("collectionData", "src/")',          detail: '→ 3 matches found' },
    { type: 'thinking',  text: 'Tracing data flow from Firestore to component...' },
    { type: 'tool_call', tool: 'Bash',  text: 'Bash("firebase firestore:rules get")',    detail: '→ Security rules retrieved' },
    { type: 'output',    text: 'Rules validated — public collections allow reads' },
    { type: 'tool_call', tool: 'Edit',  text: 'Edit("firestore.service.ts")',            detail: '→ Composite index added' },
    { type: 'tool_call', tool: 'Bash',  text: 'Bash("firebase deploy --only firestore")',detail: '→ Rules deployed' },
    { type: 'success',   text: 'Firestore query latency reduced by 43%' },
  ],
  [
    { type: 'system',    text: 'Task: Improve Core Web Vitals score' },
    { type: 'thinking',  text: 'Auditing performance bottlenecks...' },
    { type: 'tool_call', tool: 'Read',  text: 'Read("angular.json")',                   detail: '→ Build config analyzed' },
    { type: 'tool_call', tool: 'Grep',  text: 'Grep("lazy.*load", "app-routing.module.ts")', detail: '→ 0 lazy routes found' },
    { type: 'thinking',  text: 'Identifying heavy components for lazy loading...' },
    { type: 'tool_call', tool: 'Edit',  text: 'Edit("app-routing.module.ts")',           detail: '→ 3 routes converted to lazy' },
    { type: 'output',    text: 'Initial bundle reduced by 34% (1.8MB → 1.2MB)' },
    { type: 'tool_call', tool: 'Bash',  text: 'Bash("ng build --stats-json")',           detail: '→ Bundle analysis complete' },
    { type: 'tool_call', tool: 'Grep',  text: 'Grep("preconnect", "index.html")',        detail: '→ Missing font preconnect' },
    { type: 'tool_call', tool: 'Edit',  text: 'Edit("index.html")',                     detail: '→ Resource hints added' },
    { type: 'success',   text: 'Lighthouse performance: 67 → 94' },
  ],
  [
    { type: 'system',    text: 'Task: Build QR Code Generator tool' },
    { type: 'thinking',  text: 'Reviewing existing tool architecture patterns...' },
    { type: 'tool_call', tool: 'Glob',  text: 'Glob("tools/**/*.ts")',                  detail: '→ 18 tool files indexed' },
    { type: 'tool_call', tool: 'Read',  text: 'Read("tools/color-palette/color-palette.component.ts")', detail: '→ Pattern extracted' },
    { type: 'thinking',  text: 'Designing component and API shape...' },
    { type: 'tool_call', tool: 'Bash',  text: 'Bash("npm install qrcode --save")',       detail: '→ v1.5.4 installed' },
    { type: 'tool_call', tool: 'Write', text: 'Write("tools/qr-generator/qr-generator.component.ts")',  detail: '→ 94 lines written' },
    { type: 'tool_call', tool: 'Write', text: 'Write("tools/qr-generator/qr-generator.component.html")',detail: '→ 68 lines written' },
    { type: 'tool_call', tool: 'Write', text: 'Write("tools/qr-generator/qr-generator.component.css")', detail: '→ 131 lines written' },
    { type: 'tool_call', tool: 'Edit',  text: 'Edit("tools/tools.component.html")',      detail: '→ Tool card added to grid' },
    { type: 'success',   text: 'QR Code Generator complete — ready for review' },
  ],
  [
    { type: 'system',    text: 'Task: Add profanity filter to Guestbook' },
    { type: 'thinking',  text: 'Reading current guestbook implementation...' },
    { type: 'tool_call', tool: 'Read',  text: 'Read("guestbook/guestbook.component.ts")', detail: '→ 87 lines analyzed' },
    { type: 'tool_call', tool: 'WebFetch', text: 'WebFetch("bad-words npm package docs")', detail: '→ API docs retrieved' },
    { type: 'thinking',  text: 'Planning client-side validation approach...' },
    { type: 'tool_call', tool: 'Edit',  text: 'Edit("guestbook/guestbook.component.ts")', detail: '→ Filter integrated' },
    { type: 'output',    text: 'Validation: blocks 2,400+ terms, supports 25 languages' },
    { type: 'tool_call', tool: 'Bash',  text: 'Bash("ng build --configuration=production")', detail: '→ Build passed, no errors' },
    { type: 'success',   text: 'Guestbook moderation active — spam rate ↓ 98%' },
  ],
];

// Bot agent mock conversations (cycles continuously)
const BOT_MOCK: { botName: string; botId: string; message: string; delay: number }[] = [
  { botName: 'ClaudeOps',       botId: 'ops',       message: 'Initializing workspace scanner',           delay: 3200 },
  { botName: 'ClaudeReview',    botId: 'review',    message: 'Review agent online. Standing by.',        delay: 2100 },
  { botName: 'ClaudeOps',       botId: 'ops',       message: '47 files indexed. Starting task.',         delay: 4000 },
  { botName: 'ClaudeOps',       botId: 'ops',       message: 'Writing live.component.ts — 178 lines',    delay: 5500 },
  { botName: 'ClaudeReview',    botId: 'review',    message: 'Received diff. Running static analysis...', delay: 1800 },
  { botName: 'ClaudeAnalytics', botId: 'analytics', message: 'Bundle delta: +14.2 KB gzipped',           delay: 1500 },
  { botName: 'ClaudeReview',    botId: 'review',    message: 'Type check: PASS. No lint errors.',        delay: 3000 },
  { botName: 'ClaudeOps',       botId: 'ops',       message: 'Updating app.module.ts + routing',         delay: 4200 },
  { botName: 'ClaudeReview',    botId: 'review',    message: 'Module changes look clean. Approved.',     delay: 2000 },
  { botName: 'ClaudeAnalytics', botId: 'analytics', message: 'Build time: 12.4s. Quality score: A+',    delay: 2000 },
  { botName: 'ClaudeOps',       botId: 'ops',       message: 'Deploying to Firebase hosting...',         delay: 5000 },
  { botName: 'ClaudeReview',    botId: 'review',    message: 'Pre-deploy checks: all passed.',           delay: 1500 },
  { botName: 'ClaudeAnalytics', botId: 'analytics', message: 'Live traffic detected. Active viewers: 7', delay: 2200 },
  { botName: 'ClaudeOps',       botId: 'ops',       message: 'Deploy complete → xsantcastx.com/live',    delay: 3000 },
  { botName: 'ClaudeReview',    botId: 'review',    message: 'Monitoring post-deploy metrics...',        delay: 2500 },
  { botName: 'ClaudeAnalytics', botId: 'analytics', message: 'LCP: 1.2s | FID: 8ms | CLS: 0.01',       delay: 3000 },
];

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-live',
  templateUrl: './live.component.html',
  styleUrls: ['./live.component.css'],
  standalone: true,
    imports: [CommonModule, FormsModule]
})
export class LiveComponent implements OnInit, OnDestroy {

  @ViewChild('feedContainer')  feedContainer!:  ElementRef;
  @ViewChild('chatContainer')  chatContainer!:  ElementRef;
  @ViewChild('botContainer')   botContainer!:   ElementRef;

  // Activity feed
  activityLog: ActivityEntry[] = [];
  currentTask = 'Initializing mission control...';
  currentTool = '';
  isActive = false;
  taskProgress = 0;
  currentTime = new Date();
  sessionDuration = '00:00:00';
  metrics = [
    { label: 'TOOL CALLS',    value: 0, icon: '⚡' },
    { label: 'FILES TOUCHED', value: 0, icon: '◈'  },
    { label: 'COMMANDS RUN',  value: 0, icon: '▶'  },
    { label: 'TASKS DONE',    value: 0, icon: '✓'  },
  ];
  toolStats: ToolStat[] = [];

  // Viewer count
  viewerCount = 0;

  // User chat
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  chatUsername = '';
  editingUsername = false;
  usernameInput = '';

  // Bot chat
  botMessages: BotMessage[] = [];

  // Private state
  private sessionId = Math.random().toString(36).slice(2, 10);
  private mockSeqIndex = 0;
  private mockEntryIndex = 0;
  private mockTimer: ReturnType<typeof setTimeout> | null = null;
  private botMockIndex = 0;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private sessionTimer: ReturnType<typeof setInterval> | null = null;
  private sessionStartTime = new Date();
  private toolCounts: Record<string, number> = {};
  private useFirestoreActivity = false;
  private useFirestoreComms = false;
  private entryCounter = 0;
  private botCounter = 0;
  private static readonly STALE_MS = 5 * 60 * 1000; // 5 minutes

  // REST polling timers
  private activityPollTimer: ReturnType<typeof setInterval> | null = null;
  private chatPollTimer: ReturnType<typeof setInterval> | null = null;
  private viewerPollTimer: ReturnType<typeof setInterval> | null = null;
  private statusPollTimer: ReturnType<typeof setInterval> | null = null;
  private commsPollTimer: ReturnType<typeof setInterval> | null = null;
  private knownActivityIds = new Set<string>();
  private knownChatIds = new Set<string>();
  private knownCommsIds = new Set<string>();

  /**
   * Newest timestamp already seen per feed, which is where the next poll tails
   * from. Null means the window has not been loaded yet, so the first poll takes
   * the newest N and every poll after it asks only for what arrived since.
   */
  private tailFrom: Record<string, Date | null> = {
    'claude-activity': null,
    'live-chat': null,
    'agent-comms': null,
  };

  /**
   * Poll intervals, in ms.
   *
   * Four times slower than they were. The old numbers were chosen to make the
   * feed feel live and were paid for per document; now that a quiet poll costs
   * one read, the interval only trades against latency, and ten seconds on a
   * page whose content is somebody else's build log is not a perceptible wait.
   */
  private static readonly POLL_MS = {
    activity: 10_000,
    chat: 10_000,
    comms: 15_000,
    viewers: 30_000,
    status: 15_000,
  } as const;

  /** How many documents any single poll may return. */
  private static readonly PAGE = {
    activity: 60,
    chat: 60,
    comms: 30,
    viewers: 50,
  } as const;

  /**
   * Stop polling after this long without the visitor touching the page.
   *
   * Hiding the tab already suspends everything, but a page left open and visible
   * on a second monitor never fires `visibilitychange` and would otherwise poll
   * until the browser closed. Any interaction resumes it.
   */
  private static readonly IDLE_MS = 15 * 60_000;

  private polling = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** True once idle or hidden suspended the feed, so the banner can say so. */
  paused = false;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.startClock();
    this.startSessionTimer();
    this.initChatUsername();

    // Add system welcome message to chat
    this.chatMessages.push({
      id: 'sys-0',
      name: 'SYSTEM',
      message: 'Stream is LIVE — say hello!',
      timestamp: new Date(),
      color: '#8B5CF6',
      isSystem: true,
    });

    // Start mock feeds (will be replaced by real data when available)
    this.startMockSimulation();
    this.startBotMock();

    // Presence is registered once, outside the poll loop — it is a write, and
    // it should happen even if the feed is suspended a moment later.
    this.registerPresence();

    this.startPolling();

    // A hidden tab is the single cheapest read to not make: nobody is looking at
    // the feed, and every poll it fires is spent rendering to an empty room.
    document.addEventListener('visibilitychange', this.onVisibility);
    for (const evt of LiveComponent.WAKE_EVENTS) {
      window.addEventListener(evt, this.onInteraction, { passive: true });
    }
    this.armIdleTimer();
  }

  /** Anything that means somebody is still on the other side of the screen. */
  private static readonly WAKE_EVENTS = ['pointerdown', 'keydown', 'scroll', 'focus'] as const;

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      this.stopPolling();
    } else {
      this.armIdleTimer();
      this.startPolling();
    }
  };

  /**
   * Interaction resumes a suspended feed and pushes the idle deadline out.
   *
   * Deliberately cheap: on the common path — the feed is already running — this
   * resets a timer and returns, because it is bound to `scroll` and will fire
   * a great many times for every one time it has anything to do.
   */
  private readonly onInteraction = (): void => {
    this.armIdleTimer();
    if (!this.polling && document.visibilityState !== 'hidden') this.startPolling();
  };

  private armIdleTimer(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stopPolling(), LiveComponent.IDLE_MS);
  }

  /** Bring every feed up. Idempotent, so both wake paths can call it freely. */
  private startPolling(): void {
    if (this.polling) return;
    this.polling = true;
    this.paused = false;

    this.startActivityPolling();
    this.startChatPolling();
    this.startViewerPolling();
    this.startStatusPolling();
    this.startCommsPolling();
    this.cdr.detectChanges();
  }

  /** Take every feed down. The rendered feed stays on screen exactly as it was. */
  private stopPolling(): void {
    if (!this.polling) return;
    this.polling = false;
    this.paused = true;

    if (this.activityPollTimer) { clearInterval(this.activityPollTimer); this.activityPollTimer = null; }
    if (this.chatPollTimer)     { clearInterval(this.chatPollTimer);     this.chatPollTimer = null; }
    if (this.viewerPollTimer)   { clearInterval(this.viewerPollTimer);   this.viewerPollTimer = null; }
    if (this.statusPollTimer)   { clearInterval(this.statusPollTimer);   this.statusPollTimer = null; }
    if (this.commsPollTimer)    { clearInterval(this.commsPollTimer);    this.commsPollTimer = null; }
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    if (this.mockTimer)         clearTimeout(this.mockTimer);
    if (this.botTimer)          clearTimeout(this.botTimer);
    if (this.clockTimer)        clearInterval(this.clockTimer);
    if (this.sessionTimer)      clearInterval(this.sessionTimer);
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);

    this.stopPolling();

    // ngOnInit returns early on the server, so none of this was ever bound
    // there — and reaching for `document` during the prerender teardown throws
    // and takes the whole render worker down with it.
    if (this.isBrowser) {
      document.removeEventListener('visibilitychange', this.onVisibility);
      for (const evt of LiveComponent.WAKE_EVENTS) {
        window.removeEventListener(evt, this.onInteraction);
      }

      // Remove presence record via REST
      fsDeleteDoc('live-viewers', this.sessionId);
    }
  }

  // ─── TrackBy ──────────────────────────────────────────────────────────────

  trackEntry(_: number, e: ActivityEntry): string  { return e.id; }
  trackChat(_: number, m: ChatMessage): string     { return m.id; }
  trackBot(_: number, m: BotMessage): string       { return m.id; }

  // ─── Clock & Session Timer ────────────────────────────────────────────────

  private startClock(): void {
    this.clockTimer = setInterval(() => {
      this.currentTime = new Date();
      this.cdr.detectChanges();
    }, 1000);
  }

  private startSessionTimer(): void {
    this.sessionTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000);
      const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
      const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      this.sessionDuration = `${h}:${m}:${s}`;
    }, 1000);
  }

  // ─── Viewer Count (REST polling) ──────────────────────────────────────────

  private startViewerPolling(): void {
    this.viewerPollTimer = setInterval(() => this.pollViewers(), LiveComponent.POLL_MS.viewers);
    // First poll now
    this.pollViewers();
  }

  private async registerPresence(): Promise<void> {
    await fsPut('live-viewers', this.sessionId, {
      sessionId: this.sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Read whatever has been appended to `col` since the last call.
   *
   * The first call has no watermark and takes the newest `limit` documents; from
   * then on it asks only for what is newer than the last thing it saw, so a feed
   * that nobody is writing to costs one read per poll instead of `limit` of them.
   *
   * The watermark advances off the documents themselves rather than off the wall
   * clock, so a clock that disagrees with the server's cannot open a window that
   * silently skips entries.
   */
  private async tail(col: string, limit: number): Promise<Record<string, any>[]> {
    const after = this.tailFrom[col] ?? null;
    const docs = await fsQuery(col, { limit, after });
    if (docs.length === 0) return docs;

    let newest = after;
    for (const d of docs) {
      const ts = d['timestamp'];
      if (ts instanceof Date && (newest === null || ts.getTime() > newest.getTime())) {
        newest = ts;
      }
    }
    this.tailFrom[col] = newest;
    return docs;
  }

  private async pollViewers(): Promise<void> {
    // Heartbeat — refresh own presence
    this.registerPresence();

    // Presence is a count, not a feed, so this is bounded rather than tailed:
    // every live viewer has to be counted on every poll, and an entry going
    // *stale* is a change no `timestamp >` filter would ever return.
    const docs = await fsQuery('live-viewers', { limit: LiveComponent.PAGE.viewers });
    if (docs.length === 0) return;

    // Three missed heartbeats. The old cutoff was thirty seconds against an
    // eight-second heartbeat; at a thirty-second heartbeat that same number
    // would have every viewer time itself out between its own beats.
    const cutoff = Date.now() - LiveComponent.POLL_MS.viewers * 3;
    const active: Record<string, any>[] = [];
    const stale: Record<string, any>[] = [];
    for (const d of docs) {
      const ts = d['timestamp'];
      (ts instanceof Date && ts.getTime() > cutoff ? active : stale).push(d);
    }
    for (const s of stale) fsDeleteDoc('live-viewers', s['id']);

    this.viewerCount = Math.max(1, active.length);
    this.cdr.detectChanges();
  }

  // ─── Activity Feed (REST polling + mock fallback) ─────────────────────────

  private startActivityPolling(): void {
    this.activityPollTimer = setInterval(() => this.pollActivity(), LiveComponent.POLL_MS.activity);
    // First poll now
    this.pollActivity();
  }

  private async pollActivity(): Promise<void> {
    const docs = await this.tail('claude-activity', LiveComponent.PAGE.activity);

    // Staleness is a property of the newest entry that has *ever* been seen, not
    // of the ones this poll happened to return. A tailing poll returns nothing
    // whenever nothing has been written since the last one, which is the normal
    // case on a quiet feed and must not be mistaken for the feed going cold.
    const seen = this.tailFrom['claude-activity'];
    const isStale = seen === null || (Date.now() - seen.getTime()) > LiveComponent.STALE_MS;

    if (isStale) {
      // Switch back to mock if we were on real data
      if (this.useFirestoreActivity) {
        this.useFirestoreActivity = false;
        // Reloading the window is the point: the feed below is about to be
        // emptied, so the next real data has to arrive as a whole window rather
        // than as a tail onto entries that are no longer there.
        this.tailFrom['claude-activity'] = null;
        this.knownActivityIds.clear();
        this.activityLog = [];
        this.toolCounts = {};
        this.toolStats = [];
        this.metrics = [
          { label: 'TOOL CALLS',    value: 0, icon: '⚡' },
          { label: 'FILES TOUCHED', value: 0, icon: '◈'  },
          { label: 'COMMANDS RUN',  value: 0, icon: '▶'  },
          { label: 'TASKS DONE',    value: 0, icon: '✓'  },
        ];
        this.mockSeqIndex = 0;
        this.mockEntryIndex = 0;
        this.startMockSimulation();
        this.cdr.detectChanges();
      }
      return; // Mock is running
    }

    if (!this.useFirestoreActivity) {
      // First time we see fresh real data → stop mock, replace feed
      this.useFirestoreActivity = true;
      if (this.mockTimer) clearTimeout(this.mockTimer);
      this.activityLog = docs.map(d => ({
        id: d['id'],
        type: d['type'] || 'system',
        text: d['text'] || '',
        tool: d['tool'] || undefined,
        detail: d['detail'] || undefined,
        timestamp: d['timestamp'] instanceof Date ? d['timestamp'] : new Date(),
        isNew: false,
      }));
      this.knownActivityIds = new Set(docs.map(d => d['id']));
      // Rebuild metrics from real data
      this.toolCounts = {};
      this.metrics[0].value = 0; this.metrics[1].value = 0;
      this.metrics[2].value = 0; this.metrics[3].value = 0;
      for (const entry of this.activityLog) this.updateMetrics(entry);
      this.cdr.detectChanges();
      this.scrollEl(this.feedContainer);
    } else {
      // Incremental: add only new entries
      for (const d of docs) {
        if (this.knownActivityIds.has(d['id'])) continue;
        this.knownActivityIds.add(d['id']);
        const entry: ActivityEntry = {
          id: d['id'],
          type: d['type'] || 'system',
          text: d['text'] || '',
          tool: d['tool'] || undefined,
          detail: d['detail'] || undefined,
          timestamp: d['timestamp'] instanceof Date ? d['timestamp'] : new Date(),
          isNew: true,
        };
        if (entry.type === 'tool_call') this.currentTool = entry.tool ?? '';
        else if (entry.type === 'success' || entry.type === 'error') this.currentTool = '';
        this.pushEntry(entry);
      }
    }
  }

  private startMockSimulation(): void {
    this.isActive = true;
    this.currentTask = this.deriveTaskName(MOCK_SEQUENCES[this.mockSeqIndex]);
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.useFirestoreActivity) return;
    const seq = MOCK_SEQUENCES[this.mockSeqIndex];
    if (this.mockEntryIndex >= seq.length) {
      this.currentTool = '';
      this.taskProgress = 100;
      this.metrics[3].value++;
      this.mockTimer = setTimeout(() => {
        this.mockSeqIndex = (this.mockSeqIndex + 1) % MOCK_SEQUENCES.length;
        this.mockEntryIndex = 0;
        this.taskProgress = 0;
        this.currentTask = this.deriveTaskName(MOCK_SEQUENCES[this.mockSeqIndex]);
        this.scheduleNext();
      }, 4500);
      return;
    }

    const template = seq[this.mockEntryIndex];
    this.mockTimer = setTimeout(() => {
      if (template.type === 'tool_call') {
        this.currentTool = template.tool ?? '';
      } else if (template.type === 'success' || template.type === 'error') {
        this.currentTool = '';
      }
      this.pushEntry({
        id: `mock-${++this.entryCounter}`,
        type: template.type,
        text: template.text,
        tool: template.tool,
        detail: template.detail,
        timestamp: new Date(),
        isNew: true,
      });
      this.taskProgress = Math.round(((this.mockEntryIndex + 1) / seq.length) * 100);
      this.mockEntryIndex++;
      this.scheduleNext();
    }, this.getDelay(template.type));
  }

  private pushEntry(entry: ActivityEntry): void {
    entry.isNew = true;
    this.activityLog.push(entry);
    if (this.activityLog.length > 200) this.activityLog.shift();
    this.updateMetrics(entry);
    this.cdr.detectChanges();
    this.scrollEl(this.feedContainer);
    setTimeout(() => { entry.isNew = false; this.cdr.detectChanges(); }, 600);
  }

  private updateMetrics(entry: ActivityEntry): void {
    if (entry.type !== 'tool_call') return;
    this.metrics[0].value++;
    if (entry.tool && ['Read', 'Write', 'Edit', 'Glob'].includes(entry.tool)) this.metrics[1].value++;
    if (entry.tool === 'Bash') this.metrics[2].value++;
    if (entry.tool) {
      this.toolCounts[entry.tool] = (this.toolCounts[entry.tool] ?? 0) + 1;
      this.rebuildToolStats();
    }
  }

  private rebuildToolStats(): void {
    const entries = Object.entries(this.toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = entries[0]?.[1] ?? 1;
    this.toolStats = entries.map(([name, count]) => ({
      name, count,
      pct: Math.round((count / max) * 100),
      color: TOOL_COLORS[name] ?? '#8B5CF6',
    }));
  }

  // ─── User Chat (REST polling + REST send) ─────────────────────────────────

  private initChatUsername(): void {
    const stored = localStorage.getItem('live-chat-username');
    if (stored) {
      this.chatUsername = stored;
    } else {
      const num = Math.floor(Math.random() * 9000) + 1000;
      this.chatUsername = `viewer_${num}`;
      localStorage.setItem('live-chat-username', this.chatUsername);
    }
  }

  startEditUsername(): void {
    this.usernameInput = this.chatUsername;
    this.editingUsername = true;
    setTimeout(() => {
      const el = document.querySelector('.username-edit-input') as HTMLInputElement;
      if (el) el.focus();
    }, 50);
  }

  saveUsername(): void {
    const trimmed = this.usernameInput.trim().slice(0, 20);
    if (trimmed) {
      this.chatUsername = trimmed;
      localStorage.setItem('live-chat-username', trimmed);
    }
    this.editingUsername = false;
  }

  private startChatPolling(): void {
    this.chatPollTimer = setInterval(() => this.pollChat(), LiveComponent.POLL_MS.chat);
    this.pollChat();
  }

  /**
   * Append whatever has been said since the last poll.
   *
   * This used to rebuild the whole list from a full read of the collection on
   * every tick, which is why it cost what it did. Appending is both cheaper and
   * more correct: the rebuild dropped the optimistic local echo of a message the
   * visitor had just sent until the server round-tripped it back.
   */
  private async pollChat(): Promise<void> {
    const docs = await this.tail('live-chat', LiveComponent.PAGE.chat);
    if (docs.length === 0) return;

    let appended = false;
    for (const d of docs) {
      const id = d['id'];
      if (this.knownChatIds.has(id)) continue;
      this.knownChatIds.add(id);

      const name = d['name'] ?? 'anonymous';
      const message = d['message'] ?? '';

      // The sender already painted this one optimistically under a local id.
      // Reconcile onto that row rather than showing the message twice.
      const echo = this.chatMessages.find(m =>
        m.id.startsWith('local-') && m.name === name && m.message === message);
      if (echo) {
        echo.id = id;
        continue;
      }

      this.pushChatMessage({
        id,
        name,
        message,
        timestamp: d['timestamp'] instanceof Date ? d['timestamp'] : new Date(),
        color: d['color'] ?? this.getUserColor(name),
      });
      appended = true;
    }

    this.cdr.detectChanges();
    if (!appended) return;

    this.scrollEl(this.chatContainer);
    // Clear isNew after animation
    setTimeout(() => {
      for (const m of this.chatMessages) m.isNew = false;
      this.cdr.detectChanges();
    }, 600);
  }

  async sendMessage(): Promise<void> {
    const text = this.chatInput.trim();
    if (!text || !this.chatUsername) return;
    this.chatInput = '';

    const color = this.getUserColor(this.chatUsername);

    // Optimistic local add
    const localMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      name: this.chatUsername,
      message: text,
      timestamp: new Date(),
      color,
      isNew: true,
    };
    this.pushChatMessage(localMsg);

    // Send to Firestore via REST
    await fsPost('live-chat', {
      name: this.chatUsername,
      message: text,
      timestamp: new Date(),
      color,
    });
  }

  private pushChatMessage(msg: ChatMessage): void {
    msg.isNew = true;
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 100) this.chatMessages.shift();
    this.cdr.detectChanges();
    this.scrollEl(this.chatContainer);
    setTimeout(() => { msg.isNew = false; this.cdr.detectChanges(); }, 600);
  }

  getUserColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xfffffff;
    return USER_COLORS[hash % USER_COLORS.length];
  }

  // ─── Agent Status (REST polling) ─────────────────────────────────────────

  private startStatusPolling(): void {
    this.statusPollTimer = setInterval(() => this.pollStatus(), LiveComponent.POLL_MS.status);
    this.pollStatus();
  }

  private async pollStatus(): Promise<void> {
    try {
      const res = await fetch(`${FS_BASE}/agent-status/current?key=${FS_KEY}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.fields) return;

      const fields = data.fields;
      const ts = fields.timestamp?.timestampValue ? new Date(fields.timestamp.timestampValue) : null;

      // Only use real status if it's fresh (within STALE_MS)
      if (!ts || (Date.now() - ts.getTime()) > LiveComponent.STALE_MS) return;

      const task = fields.task?.stringValue || '';
      const progress = parseInt(fields.progress?.integerValue || '0', 10);
      const isActive = fields.isActive?.booleanValue ?? false;

      if (task && this.useFirestoreActivity) {
        this.currentTask = task;
        this.taskProgress = progress;
        this.isActive = isActive;
        this.cdr.detectChanges();
      }
    } catch { /* ignore */ }
  }

  // ─── Agent Comms (REST polling) ────────────────────────────────────────────

  private startCommsPolling(): void {
    this.commsPollTimer = setInterval(() => this.pollComms(), LiveComponent.POLL_MS.comms);
    this.pollComms();
  }

  private async pollComms(): Promise<void> {
    const docs = await this.tail('agent-comms', LiveComponent.PAGE.comms);

    // Same reasoning as pollActivity: a tailing poll returning nothing means
    // nothing was written, not that the feed has gone cold. Staleness is
    // measured off the newest entry ever seen.
    const seen = this.tailFrom['agent-comms'];
    const isStale = seen === null || (Date.now() - seen.getTime()) > LiveComponent.STALE_MS;

    if (isStale) {
      // Fall back to mock if we were on real comms
      if (this.useFirestoreComms) {
        this.useFirestoreComms = false;
        // The list below is about to be emptied, so the next real data has to
        // arrive as a window rather than as a tail onto messages that are gone.
        this.tailFrom['agent-comms'] = null;
        this.knownCommsIds.clear();
        this.botMessages = [];
        this.startBotMock();
        this.cdr.detectChanges();
      }
      return;
    }

    if (docs.length === 0) return;

    if (!this.useFirestoreComms) {
      // First time with fresh real data → stop mock, replace bot messages
      this.useFirestoreComms = true;
      if (this.botTimer) clearTimeout(this.botTimer);

      // Take the last 50 messages
      const recent = docs.slice(-50);
      this.botMessages = recent.map(d => ({
        id: d['id'],
        botName: d['botName'] || 'ClaudeOps',
        botId: d['botId'] || 'ops',
        message: d['message'] || '',
        timestamp: d['timestamp'] instanceof Date ? d['timestamp'] : new Date(),
        isNew: false,
      }));
      this.knownCommsIds = new Set(recent.map(d => d['id']));
      this.cdr.detectChanges();
      this.scrollEl(this.botContainer);
    } else {
      // Incremental: add only new entries
      for (const d of docs) {
        if (this.knownCommsIds.has(d['id'])) continue;
        this.knownCommsIds.add(d['id']);
        this.pushBotMessage({
          id: d['id'],
          botName: d['botName'] || 'ClaudeOps',
          botId: d['botId'] || 'ops',
          message: d['message'] || '',
          timestamp: d['timestamp'] instanceof Date ? d['timestamp'] : new Date(),
          isNew: true,
        });
      }
    }
  }

  // ─── Bot Chat ─────────────────────────────────────────────────────────────

  private startBotMock(): void {
    this.scheduleBotMessage();
  }

  private scheduleBotMessage(): void {
    const entry = BOT_MOCK[this.botMockIndex];
    this.botTimer = setTimeout(() => {
      this.pushBotMessage({
        id: `bot-${++this.botCounter}`,
        botName: entry.botName,
        botId: entry.botId,
        message: entry.message,
        timestamp: new Date(),
        isNew: true,
      });
      this.botMockIndex = (this.botMockIndex + 1) % BOT_MOCK.length;
      this.scheduleBotMessage();
    }, entry.delay + Math.random() * 600);
  }

  private pushBotMessage(msg: BotMessage): void {
    msg.isNew = true;
    this.botMessages.push(msg);
    if (this.botMessages.length > 100) this.botMessages.shift();
    this.cdr.detectChanges();
    this.scrollEl(this.botContainer);
    setTimeout(() => { msg.isNew = false; this.cdr.detectChanges(); }, 600);
  }

  getBotColor(botId: string): string {
    return BOT_COLORS[botId] ?? '#8B5CF6';
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private scrollEl(ref: ElementRef | undefined): void {
    setTimeout(() => {
      if (ref?.nativeElement) {
        ref.nativeElement.scrollTop = ref.nativeElement.scrollHeight;
      }
    }, 50);
  }

  private getDelay(type: ActivityEntry['type']): number {
    const base: Record<ActivityEntry['type'], number> = {
      system: 700, thinking: 2400, tool_call: 1400, output: 600, success: 700, error: 700,
    };
    return base[type] + Math.random() * 400;
  }

  private deriveTaskName(seq: MockEntry[]): string {
    const sys = seq.find(e => e.type === 'system');
    if (sys) return sys.text.replace(/^(New task received:|Task:|Session initialized —)\s*/i, '');
    return seq.find(e => e.type === 'success')?.text ?? 'Running task...';
  }
}
