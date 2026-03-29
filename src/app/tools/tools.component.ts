import { Component, OnInit, inject, PLATFORM_ID, HostListener } from '@angular/core';
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

@Component({
  selector: 'app-tools',
  templateUrl: './tools.component.html',
  styleUrls: ['./tools.component.css'],
  standalone: false
})
export class ToolsComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Just found these free browser tools — PDF Catalog Generator, Color Palette Extractor and more. No sign-up, runs entirely in your browser 🔥')}&url=${encodeURIComponent(SITE_URL + '/tools')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools')}`;

  activeTag: string | null = null;
  activeCategory = 'All';
  searchQuery = '';

  readonly categories = ['All', 'CSS Tools', 'Email Tools', 'Security Tools', 'Code Converters', 'Productivity'];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translationService: TranslationService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.activeTag = params['tag'] || null;
      if (params['category']) {
        this.activeCategory = params['category'];
      }
      if (params['q']) {
        this.searchQuery = params['q'];
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.focusSearch();
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

  /** Get related tools that share tags with a given tool (delegates to registry) */
  static getRelatedTools(tools: ToolCard[], currentId: string, count: number = 4): ToolCard[] {
    // Delegate to the registry helper, then map back to ToolCard format
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
