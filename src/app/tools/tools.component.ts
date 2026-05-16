import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SITE_URL } from '../seo.service';
import { TranslationService } from '../translation.service';
import { TOOLS_REGISTRY, ToolDefinition, getCategories, getAllTags, getRelatedTools } from './tools-registry';

export interface ToolCard {
  id: string;
  title: string;
  description: string;
  route: string;
  status: 'live' | 'coming-soon';
  tags: string[];
  category: string;
  icon: string; // SVG inner markup
}

export interface Galaxy {
  name: string;
  tools: ToolCard[];
  count: number;
  hue: string;
  glow: string;
}

export interface OrbitStar {
  tool: ToolCard;
  ring: number;
  radius: number;
  duration: number;
  delay: number;
  size: number;
  direction: 1 | -1;
  zOffset: number;
}

type CosmicView = 'galaxies' | 'stars' | 'search';

const CATEGORY_PALETTE: Record<string, { hue: string; glow: string }> = {
  'CSS Tools':        { hue: '#4dffe0', glow: 'rgba(0, 255, 204, 0.65)' },
  'Email Tools':      { hue: '#ff6dd7', glow: 'rgba(255, 90, 210, 0.65)' },
  'Security Tools':   { hue: '#a48bff', glow: 'rgba(140, 110, 255, 0.65)' },
  'Code Converters':  { hue: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.65)' },
  'Productivity':     { hue: '#ffc669', glow: 'rgba(255, 180, 80, 0.65)' },
};

const DEFAULT_PALETTE = { hue: '#00ffcc', glow: 'rgba(0, 255, 204, 0.65)' };

const ORBIT_RINGS = [
  { radius: 115, duration: 46 },
  { radius: 185, duration: 78 },
  { radius: 255, duration: 112 },
  { radius: 330, duration: 156 },
  { radius: 405, duration: 210 },
];

@Component({
  selector: 'app-tools',
  templateUrl: './tools.component.html',
  styleUrls: ['./tools.component.css'],
  standalone: false
})
export class ToolsComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private paramSub?: Subscription;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Just found these free browser tools — PDF Catalog Generator, Color Palette Extractor and more. No sign-up, runs entirely in your browser 🔥')}&url=${encodeURIComponent(SITE_URL + '/tools')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools')}`;

  activeTag: string | null = null;
  activeCategory = 'All';
  searchQuery = '';
  warpingToolId: string | null = null;
  hoveredStarId: string | null = null;
  private warpTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly categories = ['All', 'CSS Tools', 'Email Tools', 'Security Tools', 'Code Converters', 'Productivity'];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translationService: TranslationService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.paramSub = this.route.queryParams.subscribe(params => {
      this.activeTag = params['tag'] || null;
      if (params['category']) {
        this.activeCategory = params['category'];
      }
      if (params['q']) {
        this.searchQuery = params['q'];
      }
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    if (this.warpTimeout) {
      clearTimeout(this.warpTimeout);
      this.warpTimeout = null;
    }
  }

  focusSearch(): void {
    if (!this.isBrowser) return;
    const el = document.getElementById('tools-search-input') as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.focus(), 200);
    }
  }

  setCategory(cat: string): void {
    this.activeCategory = cat;
    this.activeTag = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: null, category: cat === 'All' ? null : cat },
      queryParamsHandling: 'merge'
    });
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  getIconHtml(tool: ToolCard): SafeHtml {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${tool.icon}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /** Map registry entries to ToolCard view models, resolving i18n where available */
  get tools(): ToolCard[] {
    return TOOLS_REGISTRY.map(t => ({
      id: t.id,
      title: t.titleKey ? this.translate(t.titleKey) : t.title,
      description: t.descriptionKey ? this.translate(t.descriptionKey) : t.description,
      route: t.route,
      status: t.status,
      category: t.category,
      tags: t.tags,
      icon: t.svgIcon,
    }));
  }

  get filteredTools(): ToolCard[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.tools.filter(t => {
      const matchCat = this.activeCategory === 'All' || t.category === this.activeCategory;
      const matchTag = !this.activeTag || t.tags.some(tg => tg.toLowerCase() === this.activeTag!.toLowerCase());
      const matchQ = !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tg => tg.toLowerCase().includes(q)) || t.category.toLowerCase().includes(q);
      return matchCat && matchTag && matchQ;
    });
  }

  get allTags(): string[] {
    const tagSet = new Set<string>();
    this.tools.forEach(t => t.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }

  /** Determine which cosmic view to render */
  get currentView(): CosmicView {
    if (this.searchQuery?.trim() || this.activeTag) return 'search';
    if (this.activeCategory && this.activeCategory !== 'All') return 'stars';
    return 'galaxies';
  }

  /** Galaxies — one per category that has at least one tool */
  get galaxies(): Galaxy[] {
    const groups = new Map<string, ToolCard[]>();
    this.tools.forEach(t => {
      const arr = groups.get(t.category) || [];
      arr.push(t);
      groups.set(t.category, arr);
    });
    return this.categories
      .filter(c => c !== 'All')
      .map(name => {
        const tools = groups.get(name) || [];
        const palette = CATEGORY_PALETTE[name] || DEFAULT_PALETTE;
        return { name, tools, count: tools.length, hue: palette.hue, glow: palette.glow };
      })
      .filter(g => g.count > 0);
  }

  get selectedGalaxy(): Galaxy | null {
    if (this.activeCategory === 'All' || !this.activeCategory) return null;
    return this.galaxies.find(g => g.name === this.activeCategory) || null;
  }

  /** Build orbital arrangement of the stars in the selected galaxy */
  get orbitStars(): OrbitStar[] {
    const galaxy = this.selectedGalaxy;
    if (!galaxy) return [];
    const tools = galaxy.tools;
    const ringCount = Math.min(ORBIT_RINGS.length, Math.max(2, Math.ceil(tools.length / 7)));
    const rings = ORBIT_RINGS.slice(0, ringCount);

    return tools.map((tool, i) => {
      const ring = i % ringCount;
      const o = rings[ring];
      // Spread stars on the same ring evenly by phase
      const ringStarCount = Math.ceil(tools.length / ringCount);
      const positionInRing = Math.floor(i / ringCount);
      const phase = (positionInRing / Math.max(1, ringStarCount));
      const delay = -phase * o.duration; // negative delay = starting angle
      // Deterministic per-tool variability
      const hash = this.hashString(tool.id);
      const sizeVar = 0.78 + ((hash % 42) / 100); // ~0.78–1.20
      const direction: 1 | -1 = ring % 2 === 0 ? 1 : -1;
      const zOffset = ((hash >> 5) % 80) - 40;
      return {
        tool,
        ring,
        radius: o.radius,
        duration: o.duration,
        delay,
        size: sizeVar,
        direction,
        zOffset,
      };
    });
  }

  get orbitRings(): { radius: number }[] {
    const galaxy = this.selectedGalaxy;
    if (!galaxy) return [];
    const ringCount = Math.min(ORBIT_RINGS.length, Math.max(2, Math.ceil(galaxy.count / 7)));
    return ORBIT_RINGS.slice(0, ringCount).map(r => ({ radius: r.radius }));
  }

  get selectedGalaxyHue(): string {
    return this.selectedGalaxy?.hue || DEFAULT_PALETTE.hue;
  }

  get selectedGalaxyGlow(): string {
    return this.selectedGalaxy?.glow || DEFAULT_PALETTE.glow;
  }

  get hoveredTool(): ToolCard | null {
    if (!this.hoveredStarId) return null;
    return this.tools.find(t => t.id === this.hoveredStarId) || null;
  }

  enterGalaxy(name: string): void {
    this.setCategory(name);
  }

  exitGalaxy(): void {
    this.setCategory('All');
  }

  setHoveredStar(id: string | null): void {
    this.hoveredStarId = id;
  }

  filterByTag(tag: string, event: Event): void {
    event.stopPropagation();
    if (this.activeTag?.toLowerCase() === tag.toLowerCase()) {
      this.clearTag();
    } else {
      this.activeTag = tag;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tag },
        queryParamsHandling: 'merge'
      });
    }
  }

  clearTag(): void {
    this.activeTag = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: null },
      queryParamsHandling: 'merge'
    });
  }

  clearAll(): void {
    this.activeTag = null;
    this.activeCategory = 'All';
    this.searchQuery = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: null, category: null, q: null },
      queryParamsHandling: 'merge'
    });
  }

  isTagActive(tag: string): boolean {
    return this.activeTag?.toLowerCase() === tag.toLowerCase();
  }

  navigate(tool: ToolCard) {
    if (tool.status === 'live') {
      this.router.navigate([tool.route]);
    }
  }

  handleCardClick(event: MouseEvent, tool: ToolCard) {
    if (tool.status !== 'live') {
      event.preventDefault();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) {
      return;
    }
    event.preventDefault();

    if (this.warpingToolId) return;

    const prefersReducedMotion = this.isBrowser
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !this.isBrowser) {
      this.navigate(tool);
      return;
    }

    this.warpingToolId = tool.id;
    this.warpTimeout = setTimeout(() => {
      this.warpTimeout = null;
      this.navigate(tool);
    }, 780);
  }

  /** Simple deterministic string hash → positive integer, for per-tool variation */
  private hashString(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

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
