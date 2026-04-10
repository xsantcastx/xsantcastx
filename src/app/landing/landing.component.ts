import { Component, OnInit, OnDestroy, inject, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { ChangelogService, ChangelogDay } from '../changelog.service';
import { Subscription } from 'rxjs';
import { TOOLS_REGISTRY, getLiveTools, getFeaturedTools, ToolDefinition } from '../tools/tools-registry';

export interface Tool {
  id: string;
  name: string;
  desc: string;
  route: string;
  category: string;
  icon: string;
  features: string[];
}

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
  private changelogSub?: Subscription;

  changelogDays: ChangelogDay[] = [];
  changelogLoading = true;

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
  }));

  /** Latest 8 tools for homepage showcase — most recently added (last in registry) */
  readonly latestTools: Tool[] = this.tools.slice(-8).reverse();

  /** Tools shown in the hero carousel — uses featured flag from registry */
  get heroCarouselTools(): Tool[] {
    return getFeaturedTools().map(t => ({
      id: t.id,
      name: t.title,
      desc: t.description,
      route: t.route,
      category: t.category,
      icon: t.textIcon,
      features: t.features,
    }));
  }

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
  }

  ngOnDestroy(): void {
    this.changelogSub?.unsubscribe();
  }

  toggleChangelogDay(day: ChangelogDay): void {
    day.expanded = !day.expanded;
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
    if (!this.subscribeEmail || !this.subscribeEmail.includes('@')) return;
    this.subscribeStatus = 'loading';
    try {
      const col = collection(this.firestore, 'homepage_subscribers');
      await addDoc(col, {
        email: this.subscribeEmail,
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
