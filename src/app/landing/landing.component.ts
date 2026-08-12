import { Component, OnInit, OnDestroy, inject, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { ChangelogService, ChangelogDay, ChangelogEntry } from '../changelog.service';
import { Subscription } from 'rxjs';
import { TOOLS_REGISTRY, getLiveTools, getFeaturedTools, ToolDefinition } from '../tools/tools-registry';
import { TranslationService } from '../translation.service';
import { REALMS, RealmDefinition, realmForCategory } from '../shared/realms/realm.model';
import { EASTER_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { XpService, XpSnapshot } from '../shared/gamification/xp.service';
import { PRERENDERED_PATHS } from '../prerender-stats';

export interface Tool {
  id: string;
  name: string;
  desc: string;
  route: string;
  category: string;
  icon: string;
  features: string[];
  tags: string[];
}

/**
 * One forge station: a realm, the tools that hang in it, and the counts the
 * header needs. `shown` is a slice of `total` — the homepage is a doorway, not
 * the catalogue, and /tools?realm=<id> is where the rest live.
 */
export interface ForgeStation {
  readonly realm: RealmDefinition;
  readonly shown: Tool[];
  readonly total: number;
  readonly hidden: number;
}

/**
 * Tools listed per realm on the homepage. Five realms × this = the upper bound
 * on cards in the DOM, which is what keeps the accordion cheap: collapsed
 * stations stay in the markup (crawlers follow the links, the toggle only
 * hides them) rather than being conditionally rendered.
 */
export const FORGE_STATION_SIZE = 6;

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
  standalone: false
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private firestore = inject(Firestore);
  private router = inject(Router);
  private changelogService = inject(ChangelogService);
  private translationService = inject(TranslationService);
  private readonly xpService = inject(XpService);
  private changelogSub?: Subscription;
  private xpSub?: Subscription;

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  changelogDays: ChangelogDay[] = [];
  changelogLoading = true;

  /**
   * Progression, for the hero welcome and the closing call.
   *
   * Seeded from the service's current value so the server renders a coherent
   * level-1 state during prerender (ProgressStorageService hands back a null
   * adapter there, so nothing touches localStorage), and the real numbers
   * arrive on the client once XpService.init() has read storage.
   */
  xp: XpSnapshot = this.xpService.snapshot;

  activeCategory = 'All';
  searchQuery = '';
  spotlightIndex = 0;
  subscribeEmail = '';
  subscribeStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';

  readonly categories = ['All', 'CSS Tools', 'Email Tools', 'Security Tools', 'Code Converters', 'Productivity'];

  /** Derive landing-page Tool view models from the single registry source of truth */
  readonly tools: Tool[] = getLiveTools().map(t => ({
    id: t.id,
    name: t.title,
    desc: t.description,
    route: t.route,
    category: t.category,
    icon: t.textIcon,
    features: t.features,
    tags: t.tags,
  }));

  /** Latest 8 tools for homepage showcase — most recently added (last in registry) */
  readonly latestTools: Tool[] = this.tools.slice(-8).reverse();

  /** Featured tools, for the recommendation in the closing call. */
  private readonly featuredTools: Tool[] = getFeaturedTools().map(t => ({
    id: t.id,
    name: t.title,
    desc: t.description,
    route: t.route,
    category: t.category,
    icon: t.textIcon,
    features: t.features,
    tags: t.tags,
  }));

  /**
   * The five forge stations, in codex order.
   *
   * Each realm shows its newest tools (the registry is append-ordered, so the
   * tail is the freshest work) and reports how many more are behind the
   * "browse the realm" link. Built once at construction — the registry is a
   * compile-time constant, so there is nothing here to recompute.
   */
  readonly stations: ForgeStation[] = REALMS.map(realm => {
    const inRealm = this.tools.filter(t => realmForCategory(t.category).id === realm.id);
    const shown = inRealm.slice(-FORGE_STATION_SIZE).reverse();
    return {
      realm,
      shown,
      total: inRealm.length,
      hidden: Math.max(0, inRealm.length - shown.length),
    };
  });

  /**
   * Which station is open. One at a time: five expanded realms is a wall of 30
   * cards, and the point of the accordion is that the visitor picks a realm.
   * Luminous opens by default so the section is never a row of shut doors.
   */
  openRealmId: string = REALMS[0].id;

  /** Realm the pointer is over, which brightens that station. */
  hoveredRealmId: string | null = null;

  // ─── The Forge's Pulse ────────────────────────────────────────────────
  // Every stat is derived from the thing it counts, so none of them can drift
  // into a marketing number that no longer matches the site.

  /** Tools live in the registry. */
  readonly artifactCount = this.tools.length;
  /** Routes Angular prerenders to static HTML — regenerated at every build. */
  readonly prerenderedPaths = PRERENDERED_PATHS;
  /** Registered easter eggs. */
  readonly fragmentCount = EASTER_EGGS.length;
  /** Realms in the codex. */
  readonly realmCount = REALMS.length;

  get filteredTools(): Tool[] {
    const q = this.searchQuery.toLowerCase();
    return this.tools.filter(t => {
      const matchCat = this.activeCategory === 'All' || t.category === this.activeCategory;
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }

  get spotlightTool(): Tool {
    return this.tools[this.spotlightIndex];
  }

  ngOnInit(): void {
    this.spotlightIndex = Math.floor(Math.random() * this.tools.length);
    this.changelogSub = this.changelogService.getGroupedChangelog().subscribe({
      next: (days) => {
        this.changelogDays = days;
        this.changelogLoading = false;
      },
      error: () => {
        this.changelogLoading = false;
      }
    });

    // No-ops on the server; on the client this reads stored progress and
    // settles the daily streak, then pushes the real rank into the hero.
    this.xpService.init();
    this.xpSub = this.xpService.snapshot$.subscribe(snap => { this.xp = snap; });
  }

  ngOnDestroy(): void {
    this.changelogSub?.unsubscribe();
    this.xpSub?.unsubscribe();
  }

  // Perf: trackBy fns prevent Angular from tearing down/rebuilding DOM nodes
  // on change detection. Critical for the tool grid + changelog where the
  // arrays are stable but the parent component re-renders frequently.
  trackToolById(_index: number, tool: Tool): string {
    return tool.id;
  }

  trackStation(_index: number, station: ForgeStation): string {
    return station.realm.id;
  }

  trackChangelogDay(_index: number, day: ChangelogDay): string {
    return day.dateLabel;
  }

  trackChangelogEntry(index: number, entry: { title: string }): string {
    return `${index}-${entry.title}`;
  }

  trackFeature(index: number, feature: string): string {
    return `${index}-${feature}`;
  }

  toggleChangelogDay(day: ChangelogDay): void {
    day.expanded = !day.expanded;
  }

  // ─── The Forges ───────────────────────────────────────────────────────

  isStationOpen(station: ForgeStation): boolean {
    return this.openRealmId === station.realm.id;
  }

  /**
   * Open a station, or shut the open one.
   *
   * Closing the last open station is allowed — a visitor who wants the page
   * quiet should be able to have it quiet — so this can leave every station
   * shut, which is why `openRealmId` is a plain string and not a RealmId.
   */
  toggleStation(station: ForgeStation): void {
    this.openRealmId = this.isStationOpen(station) ? '' : station.realm.id;
  }

  /** Brightest station: the one under the pointer, else the open one. */
  isStationLit(station: ForgeStation): boolean {
    return this.hoveredRealmId
      ? this.hoveredRealmId === station.realm.id
      : this.isStationOpen(station);
  }

  /**
   * True once this visitor has actually used the tool.
   *
   * Local to this browser and never rendered on the server — it marks a card
   * the visitor has already struck, not a global usage count. The site has no
   * per-tool analytics it could show here without inventing one.
   */
  hasForged(tool: Tool): boolean {
    return this.xpService.hasUsedTool(tool.id);
  }

  /**
   * Where "Enter the Forge" goes. Scrolls rather than routes: the forges are
   * on this page, and a hash jump would fight the scroll-reveal observer.
   *
   * The target id is "services", not "forges" — the header keys its nav
   * scrolling and active-link state off a fixed id list, so the section
   * keeps that anchor even though nothing calls it Services any more.
   */
  enterTheForge(): void {
    if (!this.isBrowser) return;
    const el = document.getElementById('services');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * The tool suggested in the closing call.
   *
   * The first featured tool this visitor has not opened yet — a recommendation
   * drawn from what they have actually done, not a popularity claim we have no
   * analytics to back. Falls back to the flagship once they have used them all.
   */
  get recommendedTool(): Tool {
    return this.featuredTools.find(t => !this.xpService.hasUsedTool(t.id))
      ?? this.featuredTools[0]
      ?? this.tools[0];
  }

  // ─── The Chronicle ────────────────────────────────────────────────────

  /**
   * The realm a changelog entry touched, or null when it touched none.
   *
   * Derived by looking for a registry tool named in the entry, which is a real
   * signal — entries about a specific tool say its name. Entries about the
   * platform itself (a build fix, an SEO pass) legitimately match nothing and
   * get no realm badge rather than an invented one.
   */
  realmForEntry(entry: ChangelogEntry): RealmDefinition | null {
    const haystack = `${entry.title} ${entry.details}`.toLowerCase();
    const hit = TOOLS_REGISTRY.find(t =>
      haystack.includes(t.title.toLowerCase()) || haystack.includes(t.id.toLowerCase())
    );
    return hit ? realmForCategory(hit.category) : null;
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.focusSearch();
    }
  }

  setCategory(cat: string): void {
    this.activeCategory = cat;
    this.searchQuery = '';
  }

  focusSearch(): void {
    if (!this.isBrowser) return;
    const el = document.getElementById('tool-search-input') as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.focus(), 380);
    }
  }

  async onSubscribe(): Promise<void> {
    // RFC 5322 lite — tight enough to reject "foo@", loose enough to accept
    // weird-but-valid corporate emails. Mirrors the firestore.rules regex so
    // a request that passes here can't fail server-side just for syntax.
    const email = (this.subscribeEmail || '').trim();
    const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length >= 5 && email.length <= 254;
    if (!valid) {
      this.subscribeStatus = 'error';
      return;
    }
    this.subscribeStatus = 'loading';
    try {
      const col = collection(this.firestore, 'homepage_subscribers');
      await addDoc(col, {
        email: email,
        subscribedAt: new Date().toISOString(),
        source: 'homepage_footer_cta'
      });
      this.subscribeStatus = 'success';
      this.subscribeEmail = '';
    } catch {
      this.subscribeStatus = 'error';
    }
  }
}
