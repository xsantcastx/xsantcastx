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

/**
 * Hard invariant: the hero carousel CSS animation is hand-tuned for exactly
 * HERO_CAROUSEL_MAX cards rotating over a HERO_CAROUSEL_CYCLE_SECONDS cycle
 * with one card per (cycle / count) slice. Changing this number WITHOUT also
 * retiming hcCardCycle in landing.component.css is a bug that causes card
 * N+MAX to restart before card N finishes, producing z-index bleed-through
 * and the "flickering red/orange overlay" glitch reported on 2026-04-10.
 *
 * If you need more featured cards, build a second carousel or rework the
 * keyframes — do not just bump this constant.
 */
export const HERO_CAROUSEL_MAX = 5;

/** View model for a single hero carousel slot. Precomputing the padded labels
 *  keeps them out of the template (no pipes, no hardcoded `0` prefixes that
 *  break the moment the count crosses 10). */
interface HeroCarouselCard {
  readonly tool: Tool;
  readonly ci: number;          // slot index, fed to the CSS --ci variable
  readonly indexLabel: string;  // e.g. "01"
  readonly totalLabel: string;  // e.g. "05"
  readonly ariaLabel: string;   // "Featured tool 1 of 5: Foo"
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

  /** Tools shown in the hero carousel — capped at HERO_CAROUSEL_MAX to match the
   *  25s / 5s-per-slot CSS animation cycle. More than HERO_CAROUSEL_MAX cards
   *  causes animation collisions (card N+MAX restarts before card N exits),
   *  producing z-index bleed-through and the flickering overlay reported by
   *  the owner on 2026-04-10. Keep this derived from the constant so a future
   *  refactor can't accidentally regress the invariant. */
  readonly heroCarouselTools: Tool[] = getFeaturedTools().slice(0, HERO_CAROUSEL_MAX).map(t => ({
    id: t.id,
    name: t.title,
    desc: t.description,
    route: t.route,
    category: t.category,
    icon: t.textIcon,
    features: t.features,
  }));

  /** Precomputed view models for the hero carousel slots. Padding is done
   *  once here instead of via template math like `0{{ i + 1 }}/0{{ len }}`,
   *  which silently broke at 10+ cards and visually looked like a broken
   *  `mm:ss` timer (see [BUG] Homepage tool cards flickering, 2026-04-10). */
  readonly heroCarouselCards: HeroCarouselCard[] = this.heroCarouselTools.map((tool, i, arr) => {
    const total = arr.length;
    const indexLabel = (i + 1).toString().padStart(2, '0');
    const totalLabel = total.toString().padStart(2, '0');
    return {
      tool,
      ci: i,
      indexLabel,
      totalLabel,
      ariaLabel: `Featured tool ${i + 1} of ${total}: ${tool.name}`,
    };
  });

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
    // Belt-and-braces: if someone bumps the slice or the registry returns
    // more than expected, warn loudly in dev so we don't silently regress
    // back to the flickering overlay bug.
    if (this.heroCarouselTools.length > HERO_CAROUSEL_MAX && typeof console !== 'undefined') {
      console.warn(
        `[landing] heroCarouselTools length (${this.heroCarouselTools.length}) exceeds ` +
        `HERO_CAROUSEL_MAX (${HERO_CAROUSEL_MAX}) — this will cause CSS animation ` +
        `collisions and z-index bleed-through. Retune hcCardCycle keyframes before ` +
        `increasing the cap.`
      );
    }

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

  // Perf: trackBy fns prevent Angular from tearing down/rebuilding DOM nodes
  // on change detection. Critical for the tool grid + changelog where the
  // arrays are stable but the parent component re-renders frequently.
  trackToolById(_index: number, tool: Tool): string {
    return tool.id;
  }

  trackHeroCard(_index: number, card: HeroCarouselCard): string {
    return card.tool.id;
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
