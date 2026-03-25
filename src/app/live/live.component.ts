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

async function fsGet(col: string): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${FS_BASE}/${col}?pageSize=200&key=${FS_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.documents || []).map(parseDoc);
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
  Read:      '#00ffcc',
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
  ops:       '#00ffcc',
  review:    '#7b61ff',
  analytics: '#ffcc00',
};

const USER_COLORS = ['#00ffcc', '#7b61ff', '#ff3399', '#ffcc00', '#00ff88', '#ff8800', '#00ccff'];

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
  standalone: false
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
  private entryCounter = 0;
  private botCounter = 0;
  private static readonly STALE_MS = 5 * 60 * 1000; // 5 minutes

  // REST polling timers
  private activityPollTimer: ReturnType<typeof setInterval> | null = null;
  private chatPollTimer: ReturnType<typeof setInterval> | null = null;
  private viewerPollTimer: ReturnType<typeof setInterval> | null = null;
  private knownActivityIds = new Set<string>();
  private knownChatIds = new Set<string>();

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
      color: '#00ffcc',
      isSystem: true,
    });

    // Start mock feeds
    this.startMockSimulation();
    this.startBotMock();

    // Start REST API polling (replaces Firebase SDK listeners)
    this.startActivityPolling();
    this.startChatPolling();
    this.startViewerPolling();
  }

  ngOnDestroy(): void {
    if (this.mockTimer)         clearTimeout(this.mockTimer);
    if (this.botTimer)          clearTimeout(this.botTimer);
    if (this.clockTimer)        clearInterval(this.clockTimer);
    if (this.sessionTimer)      clearInterval(this.sessionTimer);
    if (this.activityPollTimer) clearInterval(this.activityPollTimer);
    if (this.chatPollTimer)     clearInterval(this.chatPollTimer);
    if (this.viewerPollTimer)   clearInterval(this.viewerPollTimer);

    // Remove presence record via REST
    fsDeleteDoc('live-viewers', this.sessionId);
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
    // Register own presence immediately
    this.registerPresence();

    // Poll viewer count + heartbeat every 8s
    this.viewerPollTimer = setInterval(() => this.pollViewers(), 8000);
    // First poll now
    this.pollViewers();
  }

  private async registerPresence(): Promise<void> {
    await fsPut('live-viewers', this.sessionId, {
      sessionId: this.sessionId,
      timestamp: new Date(),
    });
  }

  private async pollViewers(): Promise<void> {
    // Heartbeat — refresh own presence
    this.registerPresence();

    const docs = await fsGet('live-viewers');
    if (docs.length > 0) {
      // Prune stale viewers (older than 30s)
      const cutoff = Date.now() - 30000;
      const active = docs.filter(d => {
        const ts = d['timestamp'];
        return ts instanceof Date && ts.getTime() > cutoff;
      });
      // Clean up stale docs
      const stale = docs.filter(d => {
        const ts = d['timestamp'];
        return !(ts instanceof Date && ts.getTime() > cutoff);
      });
      for (const s of stale) fsDeleteDoc('live-viewers', s['id']);

      this.viewerCount = Math.max(1, active.length);
      this.cdr.detectChanges();
    }
  }

  // ─── Activity Feed (REST polling + mock fallback) ─────────────────────────

  private startActivityPolling(): void {
    // Poll every 4s
    this.activityPollTimer = setInterval(() => this.pollActivity(), 4000);
    // First poll now
    this.pollActivity();
  }

  private async pollActivity(): Promise<void> {
    const docs = await fsGet('claude-activity');

    // Sort by timestamp ascending
    if (docs.length > 0) {
      docs.sort((a, b) => {
        const ta = a['timestamp'] instanceof Date ? a['timestamp'].getTime() : 0;
        const tb = b['timestamp'] instanceof Date ? b['timestamp'].getTime() : 0;
        return ta - tb;
      });
    }

    // Check staleness: if newest entry is older than 5 min, fall back to mock
    const newest = docs.length > 0 ? docs[docs.length - 1] : null;
    const newestTs = newest?.['timestamp'] instanceof Date ? newest['timestamp'].getTime() : 0;
    const isStale = docs.length === 0 || (Date.now() - newestTs) > LiveComponent.STALE_MS;

    if (isStale) {
      // Switch back to mock if we were on real data
      if (this.useFirestoreActivity) {
        this.useFirestoreActivity = false;
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
      color: TOOL_COLORS[name] ?? '#00ffcc',
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
    this.chatPollTimer = setInterval(() => this.pollChat(), 3000);
    this.pollChat();
  }

  private async pollChat(): Promise<void> {
    const docs = await fsGet('live-chat');
    if (docs.length === 0) return;

    // Sort by timestamp ascending
    docs.sort((a, b) => {
      const ta = a['timestamp'] instanceof Date ? a['timestamp'].getTime() : 0;
      const tb = b['timestamp'] instanceof Date ? b['timestamp'].getTime() : 0;
      return ta - tb;
    });

    // Keep system message, replace rest with Firestore data
    const systemMsg = this.chatMessages.find(m => m.isSystem);
    const firestoreMsgs: ChatMessage[] = docs.map(d => ({
      id: d['id'],
      name: d['name'] ?? 'anonymous',
      message: d['message'] ?? '',
      timestamp: d['timestamp'] instanceof Date ? d['timestamp'] : new Date(),
      color: d['color'] ?? this.getUserColor(d['name'] ?? ''),
      isNew: !this.knownChatIds.has(d['id']),
    }));

    // Track new messages for animation
    const hadNew = firestoreMsgs.some(m => m.isNew);
    for (const d of docs) this.knownChatIds.add(d['id']);

    this.chatMessages = systemMsg ? [systemMsg, ...firestoreMsgs] : firestoreMsgs;
    this.cdr.detectChanges();
    if (hadNew) this.scrollEl(this.chatContainer);

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
    return BOT_COLORS[botId] ?? '#00ffcc';
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
