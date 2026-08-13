import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LazyFirestoreService } from '../shared/lazy-firestore.service';
import { TOOLS_REGISTRY, ToolDefinition } from '../tools/tools-registry';
import { DEV_LOG, DEV_LOG_CATEGORIES, DevLogEntry, DevLogCategory } from './dev-log';
import { APP_VERSION, VERSION_HISTORY, VersionRelease } from '../version';
import {
  ECLIPSE_ROADMAP,
  EclipsePhase,
  PHASE_STATUS,
  PhaseStatus,
  phaseProgress,
} from './eclipse-roadmap';
import { ArtSceneComponent } from '../shared/art-scene/art-scene.component';

/**
 * blueprint.component.ts — the public roadmap + project documentation page.
 *
 * Everything on this page is either derived from TOOLS_REGISTRY (section 1 +
 * the stat counters) or lives in a plain array at the top of this class
 * (sections 2-4). Adding a roadmap item, a stack card, an architecture
 * decision or a changelog highlight is a one-line edit — no template surgery.
 */

/** A registry category rolled up into one of the five public-facing buckets. */
interface ToolGroup {
  /** Display name shown on the constellation panel */
  label: string;
  /** Registry `category` values that roll up into this group */
  categories: string[];
  /** Star palette (see CLAUDE.md §2 — do not invent new colors) */
  color: string;
  glow: string;
  /** Populated in the constructor from TOOLS_REGISTRY */
  tools: ToolDefinition[];
}

type RoadmapStatus = 'building' | 'planned' | 'idea';

interface RoadmapItem {
  title: string;
  description: string;
  status: RoadmapStatus;
  /**
   * Optional link to the Dev Log entry telling the story of how this was
   * built. Set it once the work ships — the card grows a "Read the story"
   * link that jumps to the entry and expands it.
   */
  devLogId?: string;
}

/** The five panels of the Blueprint mini-site. */
type BlueprintTab = 'overview' | 'roadmap' | 'devlog' | 'architecture' | 'contribute';

interface TabDefinition {
  key: BlueprintTab;
  label: string;
  hint: string;
}

interface RoadmapColumn {
  key: 'now' | 'next' | 'later';
  label: string;
  blurb: string;
  color: string;
  glow: string;
  items: RoadmapItem[];
}

interface StackCard {
  icon: string;
  name: string;
  detail: string;
  color: string;
  glow: string;
}

interface DecisionCard {
  id: string;
  question: string;
  answer: string;
}

interface UpdateItem {
  date: string;
  title: string;
  detail: string;
}

/**
 * Floor for the number of SSR-prerendered routes (see prerender-routes.txt).
 * Kept as a floor rather than an exact number so it never reads as stale —
 * the real file only ever grows as tools land.
 */
const PRERENDERED_ROUTES = 258;

const GITHUB_REPO = 'https://github.com/xsantcastx/xsantcastx';

@Component({
  selector: 'app-blueprint',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ArtSceneComponent],
  templateUrl: './blueprint.component.html',
  styleUrls: ['./blueprint.component.css']
})
export class BlueprintComponent implements OnInit {
  private lazyFirestore = inject(LazyFirestoreService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly githubRepo = GITHUB_REPO;
  readonly githubIssues = `${GITHUB_REPO}/issues`;
  readonly githubDiscussions = `${GITHUB_REPO}/discussions`;
  readonly prerenderedRoutes = PRERENDERED_ROUTES;
  readonly mcpToolCount = 14;
  readonly mcpInstall = 'npm install -g xsantcastx-mcp-server';

  // ── Version ────────────────────────────────────────────────────────────────
  readonly appVersion = APP_VERSION;
  readonly versionHistory: VersionRelease[] = VERSION_HISTORY;
  readonly angularVersion = 'Angular 21';

  // ── Tabs — /blueprint behaves as a mini-site, not one long scroll ──────────
  readonly tabs: TabDefinition[] = [
    { key: 'overview',     label: 'Overview',     hint: 'version, stats and the full tool map' },
    { key: 'roadmap',      label: 'Roadmap',      hint: 'now, next and later' },
    { key: 'devlog',       label: 'Dev Log',      hint: 'what actually happened, written down' },
    { key: 'architecture', label: 'Architecture', hint: 'the stack and the decisions behind it' },
    { key: 'contribute',   label: 'Contribute',   hint: 'suggest, report, discuss' }
  ];

  activeTab: BlueprintTab = 'overview';

  // ── Section 1: the tool map ────────────────────────────────────────────────
  /**
   * The five public buckets. Registry categories map into these; anything
   * unmapped falls through into `otherGroup` so a brand-new category can never
   * silently vanish from the map.
   */
  groups: ToolGroup[] = [
    {
      label: 'CSS & Design',
      categories: ['CSS Tools', 'CSS', 'CSS Generators', 'SVG Tools'],
      color: '#A78BFA',
      glow: 'rgba(139, 92, 246, 0.6)',
      tools: []
    },
    {
      label: 'Email & Deliverability',
      categories: ['Email Tools'],
      color: '#ff6dd7',
      glow: 'rgba(255, 90, 210, 0.6)',
      tools: []
    },
    {
      label: 'Security & Networking',
      categories: ['Security Tools'],
      color: '#a48bff',
      glow: 'rgba(140, 110, 255, 0.6)',
      tools: []
    },
    {
      label: 'Code & Dev',
      categories: ['Code Converters', 'DevOps', 'Text & Data', 'Reference'],
      color: '#5fb6ff',
      glow: 'rgba(80, 180, 255, 0.6)',
      tools: []
    },
    {
      label: 'Productivity & SEO',
      categories: ['Productivity', 'SEO Tools'],
      color: '#ffc669',
      glow: 'rgba(255, 180, 80, 0.6)',
      tools: []
    }
  ];

  /** Catch-all for registry categories not claimed above. Hidden when empty. */
  otherGroup: ToolGroup = {
    label: 'More Tools',
    categories: [],
    color: '#c48bff',
    glow: 'rgba(180, 120, 255, 0.6)',
    tools: []
  };

  totalTools = 0;

  // ── Section 2: the public roadmap ──────────────────────────────────────────
  // Add / remove / move items here. Nothing else needs to change.
  roadmap: RoadmapColumn[] = [
    {
      key: 'now',
      label: 'Now',
      blurb: 'shipping this cycle',
      color: '#A78BFA',
      glow: 'rgba(139, 92, 246, 0.6)',
      items: [
        {
          title: 'Mobile polish',
          description: 'Runtime profiling on real phones — frame rate under throttled scroll, layout shift, and the composited-layer budget the static pass could not verify.',
          status: 'building',
          devLogId: 'mobile-performance'
        },
        {
          title: 'i18n expansion',
          description: 'Filling in titleKey and descriptionKey on every registry entry so the /tools grid stops being bilingual in patches.',
          status: 'building',
          devLogId: 'i18n-journey'
        },
        {
          title: 'Blueprint content',
          description: 'Writing the Dev Log out properly and keeping this roadmap honest — including moving cards backwards when that is what happened.',
          status: 'building',
          devLogId: 'open-roadmap'
        }
      ]
    },
    {
      key: 'next',
      label: 'Next',
      blurb: 'queued and specced',
      color: '#5fb6ff',
      glow: 'rgba(80, 180, 255, 0.6)',
      items: [
        {
          title: 'Regex Builder & Tester',
          description: 'Build patterns visually, test against sample text, and export to JS, Python or Go.',
          status: 'planned'
        },
        {
          title: 'HAR File Analyzer',
          description: 'Drop a HAR export and get waterfall timings, payload sizes and slow-request callouts.',
          status: 'planned'
        },
        {
          title: 'Sponsored tool slots',
          description: 'Clearly-labelled sponsorships on individual tool pages to keep the lights on without ads.',
          status: 'planned'
        },
        {
          title: 'Pro tier',
          description: 'Optional paid tier via LemonSqueezy for heavier limits and saved workspaces. Free tools stay free.',
          status: 'planned'
        }
      ]
    },
    {
      key: 'later',
      label: 'Later',
      blurb: 'ideas worth chasing',
      color: '#c48bff',
      glow: 'rgba(180, 120, 255, 0.6)',
      items: [
        {
          title: 'AI-powered tool suggestions',
          description: 'Describe the problem in a sentence and get pointed at the right tool — or a new one worth building.',
          status: 'idea'
        },
        {
          title: 'Community-built tools',
          description: 'A contribution path so anyone can ship a tool into the registry with the cosmic shell for free.',
          status: 'idea'
        },
        {
          title: 'API access',
          description: 'Programmatic endpoints for the tools that make sense server-side, for scripts and CI pipelines.',
          status: 'idea'
        },
        {
          title: 'Mobile app',
          description: 'A PWA-first companion so the whole toolbox works offline on a phone.',
          status: 'idea'
        }
      ]
    }
  ];

  // ── Section 3: how it's built ──────────────────────────────────────────────
  stack: StackCard[] = [
    { icon: '◆', name: 'Angular 21', detail: 'Standalone components, signals, lazy-loaded routes', color: '#ff6dd7', glow: 'rgba(255, 90, 210, 0.6)' },
    { icon: '▲', name: 'Firebase Hosting', detail: 'Global CDN, per-route cache headers, preview channels', color: '#ffc669', glow: 'rgba(255, 180, 80, 0.6)' },
    { icon: '◉', name: 'Angular SSR', detail: `${PRERENDERED_ROUTES}+ routes prerendered at build time`, color: '#A78BFA', glow: 'rgba(139, 92, 246, 0.6)' },
    { icon: '⬡', name: 'TypeScript', detail: 'Strict mode, one registry as the single source of truth', color: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.6)' },
    { icon: '⬢', name: 'Firestore', detail: 'Changelog, suggestions and counters — schema-enforced in rules', color: '#a48bff', glow: 'rgba(140, 110, 255, 0.6)' },
    { icon: '✦', name: 'MCP Server', detail: '14 tools exposed to AI agents over stdio', color: '#7fd5a3', glow: 'rgba(100, 220, 150, 0.6)' }
  ];

  decisions: DecisionCard[] = [
    {
      id: 'client-only',
      question: 'Why client-side only tools?',
      answer:
        'Your data never leaves the tab. Nothing is uploaded, logged or retained, so you can paste a production config or a customer CSV without thinking twice. It also means there is no server to pay for and no queue to wait in — results land the moment you stop typing, and every tool keeps working if the backend is down.'
    },
    {
      id: 'why-angular',
      question: 'Why Angular?',
      answer:
        'Server-side rendering was non-negotiable: search engines need real HTML for every one of the tool pages, and Angular SSR prerenders them all at build time. Signals keep the heavier tools responsive without manual change-detection tuning, and standalone components let each tool ship as its own lazy chunk so visiting one tool never downloads the other 125.'
    },
    {
      id: 'easter-eggs',
      question: 'Why Easter eggs?',
      answer:
        'A utility site is usually a place you leave as fast as you arrived. The hidden runes, the Konami code, the ritual mode and the drifting pulsar exist to make the site worth poking at — curiosity is what turns a one-off visit into a bookmark. They are all opt-in, respect prefers-reduced-motion, and never get in the way of the tool you actually came for.'
    },
    {
      id: 'open-roadmap',
      question: 'Why an open roadmap?',
      answer:
        'Building in public keeps the plan honest. You can see what is genuinely in progress, what is only an idea, and what quietly got dropped — and you can push back on any of it. It also means the next tool is far more likely to be one somebody actually asked for.'
    }
  ];

  /** Which accordion panel is open. `null` = all collapsed. */
  openDecision: string | null = null;

  // ── Dev Log ────────────────────────────────────────────────────────────────
  readonly devLogCategories = DEV_LOG_CATEGORIES;
  /** Newest first — sorted here so entry order in dev-log.ts can't break it. */
  readonly devLog: DevLogEntry[] = [...DEV_LOG].sort((a, b) => b.date.localeCompare(a.date));
  /** `null` = show everything. */
  devLogFilter: DevLogCategory | null = null;
  /** Ids of expanded entries — several can be open at once. */
  expandedEntries = new Set<string>();

  // ── Section 4: latest updates ──────────────────────────────────────────────
  updates: UpdateItem[] = [
    {
      date: 'Aug 2026',
      title: 'Multi-language wiring',
      detail: 'TranslationService threaded through the highest-traffic tools so EN/ES stay in sync.'
    },
    {
      date: 'Aug 2026',
      title: 'Accessibility sweep',
      detail: 'Accessible names on every icon-only button, real <button> elements, and rel="noopener" on external links.'
    },
    {
      date: 'Aug 2026',
      title: 'Bundle + dependency diet',
      detail: 'Deduped Firebase, scoped Auth/RTDB to their own routes, and dropped 9 unused dependencies.'
    },
    {
      date: 'Aug 2026',
      title: 'Security patch cycle',
      detail: 'Closed 20 dependency vulnerabilities across the app and Cloud Functions, one of them critical.'
    },
    {
      date: 'Jul 2026',
      title: 'Cosmic anchor planet',
      detail: 'A pure-CSS lit planet with ring shadows and a terminator — no 3D library, no bundle cost.'
    }
  ];

  // ── Section 5: suggestion form ─────────────────────────────────────────────
  suggestionName = '';
  suggestionDescription = '';
  suggestionEmail = '';
  suggestionStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  suggestionError = '';

  constructor() {
    const live = TOOLS_REGISTRY.filter(t => t.status === 'live');
    this.totalTools = live.length;

    const claimed = new Set<string>();
    for (const group of this.groups) {
      group.categories.forEach(c => claimed.add(c));
    }
    for (const group of this.groups) {
      group.tools = live.filter(t => group.categories.includes(t.category));
    }
    // Anything the buckets above did not claim still gets a home on the map.
    this.otherGroup.tools = live.filter(t => !claimed.has(t.category));
  }

  /** Groups that actually have tools, so an empty bucket never renders. */
  get visibleGroups(): ToolGroup[] {
    return [...this.groups, this.otherGroup].filter(g => g.tools.length > 0);
  }

  /** `data-tags` payload the cosmic engine reads to draw constellation lines. */
  tagList(tool: ToolDefinition): string {
    return tool.tags.join(',');
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Deep links: /blueprint#devlog opens that tab directly, so a link shared
    // in a thread lands where the sender meant it to.
    if (!this.isBrowser) return;
    const fragment = (window.location.hash || '').replace(/^#/, '');
    if (!fragment) return;

    // Either "#devlog" (a tab) or "#log-<entry-id>" (a specific entry).
    if (fragment.startsWith('log-')) {
      const entryId = fragment.slice(4);
      if (this.devLog.some(e => e.id === entryId)) {
        this.activeTab = 'devlog';
        this.expandedEntries.add(entryId);
      }
      return;
    }
    if (this.tabs.some(t => t.key === fragment)) {
      this.activeTab = fragment as BlueprintTab;
    }
  }

  selectTab(tab: BlueprintTab): void {
    this.activeTab = tab;
    if (!this.isBrowser) return;
    // replaceState, not a hash assignment — assigning location.hash makes the
    // browser jump-scroll to any element with that id and adds a history entry
    // per tab click, which turns Back into "cycle through five tabs".
    window.history.replaceState(null, '', `#${tab}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Dev Log ────────────────────────────────────────────────────────────────

  get filteredDevLog(): DevLogEntry[] {
    if (!this.devLogFilter) return this.devLog;
    return this.devLog.filter(e => e.category === this.devLogFilter);
  }

  setDevLogFilter(category: DevLogCategory | null): void {
    this.devLogFilter = this.devLogFilter === category ? null : category;
  }

  countFor(category: DevLogCategory): number {
    return this.devLog.filter(e => e.category === category).length;
  }

  toggleEntry(id: string): void {
    if (this.expandedEntries.has(id)) {
      this.expandedEntries.delete(id);
    } else {
      this.expandedEntries.add(id);
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedEntries.has(id);
  }

  categoryMeta(category: DevLogCategory) {
    return (
      this.devLogCategories.find(c => c.key === category) ?? this.devLogCategories[0]
    );
  }

  /** "2026-08-10" → "August 10, 2026". Parsed as UTC so the date never
   *  slips a day for visitors west of Greenwich. */
  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  /** Jump from a roadmap card to the Dev Log entry that tells its story. */
  openDevLogEntry(id: string): void {
    this.activeTab = 'devlog';
    this.devLogFilter = null;
    this.expandedEntries.add(id);
    if (!this.isBrowser) return;
    window.history.replaceState(null, '', `#log-${id}`);
    // Wait a frame so the devlog panel is laid out before measuring.
    requestAnimationFrame(() => {
      const el = document.getElementById(`log-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  devLogTitle(id: string): string {
    return this.devLog.find(e => e.id === id)?.title ?? '';
  }

  toggleDecision(id: string): void {
    this.openDecision = this.openDecision === id ? null : id;
  }

  // ── The Eclipse arc ────────────────────────────────────────────────────
  // Now/Next/Later answers "what is being worked on this month". These six
  // phases answer where all of it is going. Both live in the Roadmap panel.

  readonly eclipsePhases: EclipsePhase[] = ECLIPSE_ROADMAP;
  readonly phaseStatus = PHASE_STATUS;

  /**
   * Which phases are expanded. The one in progress starts open, because that
   * is the one a reader came to check — everything else is one click away.
   */
  private readonly openPhases = new Set<string>(
    ECLIPSE_ROADMAP.filter(p => p.status === 'in-progress').map(p => p.id)
  );

  isPhaseOpen(id: string): boolean {
    return this.openPhases.has(id);
  }

  togglePhase(id: string): void {
    if (this.openPhases.has(id)) this.openPhases.delete(id);
    else this.openPhases.add(id);
  }

  phaseProgress(phase: EclipsePhase): { done: number; total: number; percent: number } {
    return phaseProgress(phase);
  }

  phaseStatusOf(status: PhaseStatus) {
    return PHASE_STATUS[status];
  }

  statusLabel(status: RoadmapStatus): string {
    if (status === 'building') return 'building';
    if (status === 'planned') return 'planned';
    return 'idea';
  }

  async submitSuggestion(): Promise<void> {
    if (!this.isBrowser || this.suggestionStatus === 'loading') return;

    const name = this.suggestionName.trim();
    const description = this.suggestionDescription.trim();
    const email = this.suggestionEmail.trim();

    if (name.length < 2 || name.length > 120) {
      this.suggestionStatus = 'error';
      this.suggestionError = 'Give the tool a name — somewhere between 2 and 120 characters.';
      return;
    }
    if (description.length < 10 || description.length > 1000) {
      this.suggestionStatus = 'error';
      this.suggestionError = 'Tell us a little more — 10 to 1000 characters about what it should do.';
      return;
    }
    // Email is optional, but if it is there it has to be plausible. Mirrors the
    // regex in firestore.rules so a request that passes here cannot be rejected
    // server-side purely on syntax.
    if (email && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254)) {
      this.suggestionStatus = 'error';
      this.suggestionError = 'That email looks off. Leave it blank if you would rather stay anonymous.';
      return;
    }

    this.suggestionStatus = 'loading';
    this.suggestionError = '';

    try {
      // Key set is fixed (email is always present, possibly empty) so the
      // Firestore rule can use hasOnly() without branching.
      const handle = await this.lazyFirestore.get();
      if (!handle) {
        throw new Error('Firestore unavailable');
      }
      const { db, api } = handle;
      await api.addDoc(api.collection(db, 'blueprint-suggestions'), {
        name,
        description,
        email,
        submittedAt: new Date().toISOString(),
        source: 'blueprint_page'
      });
      this.suggestionStatus = 'success';
      this.suggestionName = '';
      this.suggestionDescription = '';
      this.suggestionEmail = '';
    } catch {
      this.suggestionStatus = 'error';
      this.suggestionError =
        'The signal scattered before it landed. Try again, or open an issue on GitHub instead.';
    }
  }

  resetSuggestion(): void {
    this.suggestionStatus = 'idle';
    this.suggestionError = '';
  }
}
