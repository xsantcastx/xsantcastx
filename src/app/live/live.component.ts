import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef
} from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  deleteDoc,
  addDoc
} from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { Subscription, EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';

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
  chatFirestoreAvailable = false;

  // Bot chat
  botMessages: BotMessage[] = [];

  // Private state
  private subscriptions: Subscription[] = [];
  private sessionId = Math.random().toString(36).slice(2, 10);
  private mockSeqIndex = 0;
  private mockEntryIndex = 0;
  private mockTimer: ReturnType<typeof setTimeout> | null = null;
  private botMockIndex = 0;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private viewerTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private sessionTimer: ReturnType<typeof setInterval> | null = null;
  private sessionStartTime = new Date();
  private toolCounts: Record<string, number> = {};
  private useFirestoreActivity = false;
  private entryCounter = 0;
  private botCounter = 0;

  constructor(
    private firestore: Firestore,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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

    // Start all feeds
    this.startMockSimulation();
    this.startBotMock();
    this.startMockViewerCount();

    // Try Firestore overrides (real data replaces mock when available)
    this.tryFirestoreActivity();
    this.tryFirestoreChat();
    this.tryFirestoreBotChat();
    this.tryFirestoreViewers();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    if (this.mockTimer)    clearTimeout(this.mockTimer);
    if (this.botTimer)     clearTimeout(this.botTimer);
    if (this.clockTimer)   clearInterval(this.clockTimer);
    if (this.sessionTimer) clearInterval(this.sessionTimer);
    if (this.viewerTimer)  clearInterval(this.viewerTimer);

    // Remove presence record
    try {
      deleteDoc(doc(this.firestore, 'live-viewers', this.sessionId));
    } catch { /* ignore */ }
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

  // ─── Viewer Count ─────────────────────────────────────────────────────────

  private startMockViewerCount(): void {
    this.viewerCount = Math.floor(Math.random() * 5) + 3;
    this.viewerTimer = setInterval(() => {
      if (Math.random() < 0.4) {
        const delta = Math.random() < 0.55 ? 1 : -1;
        this.viewerCount = Math.min(15, Math.max(2, this.viewerCount + delta));
        this.cdr.detectChanges();
      }
    }, 10000);
  }

  private tryFirestoreViewers(): void {
    try {
      // Register own presence
      setDoc(doc(this.firestore, 'live-viewers', this.sessionId), {
        timestamp: serverTimestamp(),
        sessionId: this.sessionId,
      }).catch(() => {/* App Check may block — ignore */});

      // Listen to viewer count
      const viewersRef = collection(this.firestore, 'live-viewers');
      const sub = collectionData(viewersRef).pipe(catchError(() => EMPTY))
        .subscribe((docs: any[]) => {
          if (docs && docs.length > 0) {
            if (this.viewerTimer) clearInterval(this.viewerTimer);
            this.viewerCount = docs.length;
            this.cdr.detectChanges();
          }
        });
      this.subscriptions.push(sub);
    } catch { /* ignore */ }
  }

  // ─── Activity Feed (mock + Firestore override) ─────────────────────────────

  private tryFirestoreActivity(): void {
    try {
      const actRef = collection(this.firestore, 'claude-activity');
      const q = query(actRef, orderBy('timestamp', 'desc'), limit(100));
      const sub = collectionData(q, { idField: 'id' }).pipe(catchError(() => EMPTY))
        .subscribe((docs: any[]) => {
          if (!docs || docs.length === 0) return;
          if (!this.useFirestoreActivity) {
            this.useFirestoreActivity = true;
            if (this.mockTimer) clearTimeout(this.mockTimer);
            this.activityLog = docs
              .map(d => ({ ...d, timestamp: d['timestamp']?.toDate ? d['timestamp'].toDate() : new Date(), isNew: false }))
              .reverse();
            this.cdr.detectChanges();
            this.scrollEl(this.feedContainer);
          } else {
            const latest = docs[0];
            if (!this.activityLog.find(e => e.id === latest['id'])) {
              this.pushEntry({ ...latest, timestamp: latest['timestamp']?.toDate ? latest['timestamp'].toDate() : new Date() });
            }
          }
        });
      this.subscriptions.push(sub);
    } catch { /* ignore */ }
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

  // ─── User Chat ────────────────────────────────────────────────────────────

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

  sendMessage(): void {
    const text = this.chatInput.trim();
    if (!text || !this.chatUsername) return;
    this.chatInput = '';

    const msg: ChatMessage = {
      id: `local-${Date.now()}`,
      name: this.chatUsername,
      message: text,
      timestamp: new Date(),
      color: this.getUserColor(this.chatUsername),
      isNew: true,
    };

    if (this.chatFirestoreAvailable) {
      addDoc(collection(this.firestore, 'live-chat'), {
        name: msg.name,
        message: msg.message,
        timestamp: serverTimestamp(),
        color: msg.color,
      }).catch(() => this.pushChatMessage(msg));
    } else {
      this.pushChatMessage(msg);
    }
  }

  private pushChatMessage(msg: ChatMessage): void {
    msg.isNew = true;
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 100) this.chatMessages.shift();
    this.cdr.detectChanges();
    this.scrollEl(this.chatContainer);
    setTimeout(() => { msg.isNew = false; this.cdr.detectChanges(); }, 600);
  }

  private tryFirestoreChat(): void {
    try {
      const chatRef = collection(this.firestore, 'live-chat');
      const q = query(chatRef, orderBy('timestamp', 'asc'), limit(100));
      const sub = collectionData(q, { idField: 'id' }).pipe(catchError(() => EMPTY))
        .subscribe((docs: any[]) => {
          if (!docs) return;
          this.chatFirestoreAvailable = true;
          // Merge Firestore messages with local (keep system message)
          const systemMsg = this.chatMessages.find(m => m.isSystem);
          const firestoreMsgs: ChatMessage[] = docs.map(d => ({
            id: d['id'],
            name: d['name'] ?? 'anonymous',
            message: d['message'] ?? '',
            timestamp: d['timestamp']?.toDate ? d['timestamp'].toDate() : new Date(),
            color: d['color'] ?? this.getUserColor(d['name'] ?? ''),
            isNew: false,
          }));
          this.chatMessages = systemMsg ? [systemMsg, ...firestoreMsgs] : firestoreMsgs;
          this.cdr.detectChanges();
          this.scrollEl(this.chatContainer);
        });
      this.subscriptions.push(sub);
    } catch { /* ignore */ }
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

  private tryFirestoreBotChat(): void {
    try {
      const botRef = collection(this.firestore, 'bot-chat');
      const q = query(botRef, orderBy('timestamp', 'asc'), limit(100));
      const sub = collectionData(q, { idField: 'id' }).pipe(catchError(() => EMPTY))
        .subscribe((docs: any[]) => {
          if (!docs || docs.length === 0) return;
          if (this.botTimer) clearTimeout(this.botTimer);
          this.botMessages = docs.map(d => ({
            id: d['id'],
            botName: d['botName'] ?? 'Agent',
            botId: d['botId'] ?? 'ops',
            message: d['message'] ?? '',
            timestamp: d['timestamp']?.toDate ? d['timestamp'].toDate() : new Date(),
            isNew: false,
          }));
          this.cdr.detectChanges();
          this.scrollEl(this.botContainer);
        });
      this.subscriptions.push(sub);
    } catch { /* ignore */ }
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
