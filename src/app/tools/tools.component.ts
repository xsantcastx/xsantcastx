import { Component, OnInit, OnDestroy, AfterViewInit, inject, PLATFORM_ID, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SITE_URL } from '../seo.service';
import { TranslationService } from '../translation.service';
import { TOOLS_REGISTRY, getRelatedTools } from './tools-registry';
import { FormsModule } from '@angular/forms';
import { REALMS, REALM_ORDER, RealmDefinition, RealmId, realmForCategory } from '../shared/realms/realm.model';

export interface ToolCard {
  id: string;
  title: string;
  description: string;
  route: string;
  status: 'live' | 'coming-soon';
  tags: string[];
  category: string;
  icon: string; // SVG inner markup
  iconSafe?: SafeHtml; // pre-sanitized <svg> wrapper, built once per language (set by ToolsComponent)
}

/** One realm section in the grouped grid: the realm, and the tools inside it. */
export interface RealmGroup {
  realm: RealmDefinition;
  tools: ToolCard[];
}

/**
 * A realm as the map draws it: the definition, its art, and what it holds.
 *
 * `art` is the basename shared by the three `bg-<art>-<width>.webp` frames and
 * the sigil PNG — `realm.sigil` already carries it, and the name is repeated
 * here so the template reads as art rather than as a sigil used for two things.
 */
export interface RealmGate {
  realm: RealmDefinition;
  art: string;
  count: number;
  /** Registry categories inside this realm, for the gate's category line. */
  categories: string[];
}

/**
 * `map` is the five realms; `realm` is one realm opened; `search` is the flat
 * realm-grouped result list. Derived from the URL, never set directly, so every
 * view is deep-linkable and survives a reload.
 */
type ToolsView = 'map' | 'realm' | 'search';

@Component({
    selector: 'app-tools',
    templateUrl: './tools.component.html',
    styleUrls: ['./tools.component.css'],
    imports: [FormsModule, RouterLink]
})
export class ToolsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = inject(ElementRef<HTMLElement>);
  private paramSub?: Subscription;
  private langSub?: Subscription;
  private revealObserver?: IntersectionObserver;
  /** Which view the reveal observer is currently bound to. */
  private observedView: ToolsView | null = null;

  /**
   * Cached tool view-models, built ONCE per language instead of on every change
   * detection. The getters below all read `this.tools`, and the old getter
   * remapped TOOLS_REGISTRY into fresh objects (and re-sanitized every icon) on
   * each read — many times per CD pass.
   */
  private _tools: ToolCard[] = [];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Just found these free browser tools — PDF Catalog Generator, Color Palette Extractor and more. No sign-up, runs entirely in your browser 🔥')}&url=${encodeURIComponent(SITE_URL + '/tools')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools')}`;

  activeTag: string | null = null;
  searchQuery = '';

  /** The five realms, in codex order. */
  readonly realms = REALMS;
  /** Selected realm, or null for the map. Mirrors `?realm=`. */
  activeRealm: RealmId | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translationService: TranslationService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    // Rebuild cached view-models when the language changes (titles/descriptions
    // are translated). BehaviorSubject fires immediately, so this also performs
    // the initial build.
    this.langSub = this.translationService.currentLanguage$.subscribe(() => {
      this._tools = this.buildTools();
      this._filteredKey = ' '; // invalidate filter memo: titles/descriptions changed
      this._gateKey = ' ';
    });

    this.paramSub = this.route.queryParams.subscribe(params => {
      this.activeTag = params['tag'] || null;
      this.searchQuery = params['q'] || '';

      const realm = params['realm'];
      if (REALM_ORDER.includes(realm)) {
        this.activeRealm = realm;
      } else if (params['category']) {
        // The category pills are gone — realms replaced them — but links minted
        // while they existed still arrive with `?category=`. Resolve the
        // category to the realm that holds it rather than 404ing the filter.
        this.activeRealm = realmForCategory(params['category']).id;
      } else {
        this.activeRealm = null;
      }

      // Switching view swaps the whole subtree, so the previous run's targets
      // are gone. Re-bind after Angular has rendered the new one — but only on
      // an actual view change: typing in the search box rewrites `q` on every
      // keystroke, and re-running this unconditionally would build a fresh
      // IntersectionObserver per character.
      const view = this.currentView;
      if (this.isBrowser && view !== this.observedView) {
        this.observedView = view;
        setTimeout(() => this.observeReveals(), 0);
      }
    });
  }

  ngAfterViewInit(): void {
    this.observeReveals();
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    this.langSub?.unsubscribe();
    this.revealObserver?.disconnect();
  }

  /**
   * Kindle each gate's edge and sigil as it scrolls into view.
   *
   * Purely additive: the gates are fully painted without this, and `is-revealed`
   * only starts a one-shot animation (see the note on the reveal block in the
   * stylesheet). Nothing here can leave content invisible if it fails to run.
   *
   * The global cosmic engine has its own reveal observer, but it binds to a
   * fixed selector list at boot and this page's gates are created per
   * navigation, so it would only ever catch them on a cold load of /tools.
   */
  private observeReveals(): void {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.revealObserver?.disconnect();
    this.revealObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          this.revealObserver?.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    const root = this.host.nativeElement as HTMLElement;
    root.querySelectorAll('[data-reveal]').forEach(el => this.revealObserver!.observe(el));
  }

  focusSearch(): void {
    if (!this.isBrowser) return;
    const el = document.getElementById('tools-search-input') as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.focus(), 200);
    }
  }

  /** Enter a realm, or step back out to the map if it is already open. */
  setRealm(id: RealmId | null): void {
    const next = this.activeRealm === id ? null : id;
    this.activeRealm = next;
    this.activeTag = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: null, category: null, realm: next },
      queryParamsHandling: 'merge',
    });
  }

  exitRealm(): void {
    this.setRealm(null);
  }

  isRealmActive(id: RealmId): boolean {
    return this.activeRealm === id;
  }

  /** The realm currently open, or null on the map. */
  get openRealm(): RealmDefinition | null {
    return REALMS.find(r => r.id === this.activeRealm) ?? null;
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  /**
   * A realm's one-or-two-line description. Falls back to the codex `domain`
   * line so a realm added without a blurb key still renders something true
   * rather than the raw key.
   */
  realmBlurb(realm: RealmDefinition): string {
    const key = `realm.${realm.id}.blurb`;
    const copy = this.translate(key);
    return copy === key ? realm.domain : copy;
  }

  getIconHtml(tool: ToolCard): SafeHtml {
    return tool.iconSafe ?? this.wrapIcon(tool.icon);
  }

  private wrapIcon(inner: string): SafeHtml {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /** Map registry entries to ToolCard view models, resolving i18n where available.
      Called once per language (see ngOnInit), not on every change detection. */
  private buildTools(): ToolCard[] {
    return TOOLS_REGISTRY.map(t => ({
      id: t.id,
      title: t.titleKey ? this.translate(t.titleKey) : t.title,
      description: t.descriptionKey ? this.translate(t.descriptionKey) : t.description,
      route: t.route,
      status: t.status,
      category: t.category,
      tags: t.tags,
      icon: t.svgIcon,
      iconSafe: this.wrapIcon(t.svgIcon),
    }));
  }

  /** Cached, stable view-models — see _tools field doc. */
  get tools(): ToolCard[] {
    return this._tools;
  }

  // Memoize the filtered result so the getter returns a STABLE array reference
  // within a change-detection tick (the template reads filteredTools and its
  // .length several times). Recomputes only when the inputs actually change.
  private _filteredCache: ToolCard[] = [];
  private _filteredKey = ' ';

  get filteredTools(): ToolCard[] {
    const q = this.searchQuery.toLowerCase().trim();
    const key = `${this._tools.length}|${this.activeTag ?? ''}|${this.activeRealm ?? ''}|${q}`;
    if (key === this._filteredKey) {
      return this._filteredCache;
    }
    const tag = this.activeTag?.toLowerCase();
    this._filteredCache = this._tools.filter(t => {
      const matchRealm = !this.activeRealm || realmForCategory(t.category).id === this.activeRealm;
      const matchTag = !tag || t.tags.some(tg => tg.toLowerCase() === tag);
      const matchQ = !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tg => tg.toLowerCase().includes(q)) || t.category.toLowerCase().includes(q);
      return matchRealm && matchTag && matchQ;
    });
    this._filteredKey = key;
    return this._filteredCache;
  }

  get allTags(): string[] {
    const tagSet = new Set<string>();
    this.tools.forEach(t => t.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }

  /**
   * A search or a tag beats an open realm: the query is the more specific
   * intent, and its results are grouped by realm anyway, so nothing is lost.
   */
  get currentView(): ToolsView {
    if (this.searchQuery?.trim() || this.activeTag) return 'search';
    if (this.activeRealm) return 'realm';
    return 'map';
  }

  // Same memo trick as filteredTools: the template reads gates and each gate's
  // count several times per change-detection pass.
  private _gateCache: RealmGate[] = [];
  private _gateKey = ' ';

  /** The five gates of the map, each with the tools it holds counted once. */
  get gates(): RealmGate[] {
    const key = `${this._tools.length}`;
    if (key === this._gateKey) return this._gateCache;

    const counts = new Map<RealmId, number>();
    const cats = new Map<RealmId, Set<string>>();
    for (const tool of this._tools) {
      const id = realmForCategory(tool.category).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      const set = cats.get(id) ?? new Set<string>();
      set.add(tool.category);
      cats.set(id, set);
    }

    this._gateCache = REALMS.map(realm => ({
      realm,
      art: realm.sigil,
      count: counts.get(realm.id) ?? 0,
      categories: Array.from(cats.get(realm.id) ?? []),
    }));
    this._gateKey = key;
    return this._gateCache;
  }

  // Same memo trick again — see realmGroups' callers in the template.
  private _groupCache: RealmGroup[] = [];
  private _groupKey = ' ';

  /**
   * The filtered list cut into realm sections, in codex order. Empty realms are
   * dropped so a search never leaves a header standing over nothing.
   */
  get realmGroups(): RealmGroup[] {
    const tools = this.filteredTools;
    const key = `${this._filteredKey}|${tools.length}`;
    if (key === this._groupKey) return this._groupCache;

    const byRealm = new Map<RealmId, ToolCard[]>();
    for (const tool of tools) {
      const id = realmForCategory(tool.category).id;
      const list = byRealm.get(id);
      if (list) list.push(tool);
      else byRealm.set(id, [tool]);
    }

    this._groupCache = REALMS
      .map(realm => ({ realm, tools: byRealm.get(realm.id) ?? [] }))
      .filter(g => g.tools.length > 0);
    this._groupKey = key;
    return this._groupCache;
  }

  /**
   * `srcset` for a realm's painting. The 768 frame is a PORTRAIT crop rather
   * than a scaled landscape one, so it is offered at its own width and the
   * browser is told the gate is full-bleed — see the note in styles.css.
   */
  artSrcset(art: string): string {
    return [768, 1280, 1536].map(w => `assets/images/bg-${art}-${w}.webp ${w}w`).join(', ');
  }

  artSrc(art: string): string {
    return `assets/images/bg-${art}-1280.webp`;
  }

  sigilSrc(art: string): string {
    return `assets/icons/realms/${art}.png`;
  }

  onSearchInput(): void {
    // Keep the URL in step so a search is shareable and the back button works.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.searchQuery.trim() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  filterByTag(tag: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.activeTag?.toLowerCase() === tag.toLowerCase()) {
      this.clearTag();
    } else {
      this.activeTag = tag;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tag },
        queryParamsHandling: 'merge',
      });
    }
  }

  clearTag(): void {
    this.activeTag = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: null },
      queryParamsHandling: 'merge',
    });
  }

  clearAll(): void {
    this.activeTag = null;
    this.activeRealm = null;
    this.searchQuery = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: null, category: null, realm: null, q: null },
      queryParamsHandling: 'merge',
    });
  }

  isTagActive(tag: string): boolean {
    return this.activeTag?.toLowerCase() === tag.toLowerCase();
  }

  trackRealm(_i: number, gate: RealmGate): string { return gate.realm.id; }
  trackTool(_i: number, tool: ToolCard): string { return tool.id; }

  /** Get related tools that share tags with a given tool (delegates to registry) */
  static getRelatedTools(tools: ToolCard[], currentId: string, count: number = 4): ToolCard[] {
    const related = getRelatedTools(currentId, count);
    return related.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      route: t.route,
      status: t.status,
      category: t.category,
      tags: t.tags,
      icon: t.svgIcon,
    }));
  }
}
