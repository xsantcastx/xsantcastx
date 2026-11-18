/**
 * store.component.ts — `/`, the front door (owner's decision, 2026-11-18): an app store for
 * xsantcastx's projects. Base look is the Decanter design system; each project's slide and card
 * wear that project's own design system (data-skin, styles/tokens/_store.css).
 *
 * The featured carousel is a native scroll-snap track (so it swipes on a phone for free) that the
 * arrows, dots and a 6 s timer scroll. The timer pauses on hover, on focus, from the pause button
 * and when the tab is hidden, and never runs under prefers-reduced-motion.
 */
import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, PLATFORM_ID, ViewEncapsulation,
  afterNextRender, computed, inject, signal, viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CATEGORY_CHIPS, PROJECTS, SHELVES, StoreProject, projectUrl,
} from './projects.data';
import { CrontaMockComponent, StoreCtaComponent, StoreFooterComponent, StoreTopbarComponent } from './store-parts';

const ADVANCE_MS = 6000;

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [RouterLink, StoreCtaComponent, StoreTopbarComponent, StoreFooterComponent, CrontaMockComponent],
  templateUrl: './store.component.html',
  styleUrl: './store.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreComponent implements OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Featured order: the live game first, then the apps. */
  readonly featured: readonly StoreProject[] = PROJECTS;
  readonly chips = CATEGORY_CHIPS;
  readonly url = projectUrl;

  readonly query = signal('');
  readonly category = signal<string>('all');

  readonly index = signal(0);
  private readonly hovering = signal(false);
  private readonly focusing = signal(false);
  readonly userPaused = signal(false);
  private readonly reduced = signal(false);
  private readonly tabHidden = signal(false);
  /** True while the timer is actually allowed to advance. */
  readonly rotating = computed(() =>
    this.browser && !this.reduced() && !this.userPaused() && !this.hovering() && !this.focusing() && !this.tabHidden());

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  private timer: ReturnType<typeof setInterval> | null = null;
  private settle: ReturnType<typeof setTimeout> | null = null;
  private cleanup: (() => void)[] = [];

  readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return PROJECTS.filter(p =>
      (cat === 'all' || p.categories.includes(cat as never)) &&
      (!q || [p.name, p.pitch, p.kicker, ...p.platforms, ...p.categories].join(' ').toLowerCase().includes(q)));
  });

  readonly shelves = computed(() => {
    const ids = new Set(this.matches().map(p => p.id));
    return SHELVES
      .map(s => ({ ...s, items: PROJECTS.filter(p => p.shelves.includes(s.id) && ids.has(p.id)) }))
      .filter(s => s.items.length > 0);
  });

  readonly resultsLabel = computed(() => {
    const n = this.matches().length;
    return n === 1 ? '1 project shown' : `${n} projects shown`;
  });

  constructor() {
    afterNextRender(() => {
      window.scrollTo(0, 0);
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced.set(mq.matches);
      const onMq = () => this.reduced.set(mq.matches);
      mq.addEventListener('change', onMq);
      const onVis = () => this.tabHidden.set(document.hidden);
      document.addEventListener('visibilitychange', onVis);
      this.cleanup.push(() => { mq.removeEventListener('change', onMq); document.removeEventListener('visibilitychange', onVis); });
      this.timer = setInterval(() => { if (this.rotating()) this.step(1); }, ADVANCE_MS);
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.settle) clearTimeout(this.settle);
    this.cleanup.forEach(fn => fn());
  }

  /** Scroll to slide `i` (wrapping). Under reduced motion the jump is instant. */
  goTo(i: number): void {
    const n = this.featured.length;
    const next = (i + n) % n;
    this.index.set(next);
    const el = this.track()?.nativeElement;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: this.reduced() ? 'auto' : 'smooth' });
  }

  step(by: number): void { this.goTo(this.index() + by); }

  togglePause(): void { this.userPaused.update(v => !v); }

  /** Swipes and wheel-scrolls move the track by hand: follow them once they settle. */
  onScroll(): void {
    if (this.settle) clearTimeout(this.settle);
    this.settle = setTimeout(() => {
      const el = this.track()?.nativeElement;
      if (!el || !el.clientWidth) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== this.index()) this.index.set(Math.max(0, Math.min(this.featured.length - 1, i)));
    }, 90);
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') { event.preventDefault(); this.step(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); this.step(1); }
  }

  setHover(v: boolean): void { this.hovering.set(v); }
  setFocus(v: boolean): void { this.focusing.set(v); }

  focusOut(event: FocusEvent, host: HTMLElement): void {
    if (!host.contains(event.relatedTarget as Node | null)) this.focusing.set(false);
  }

  setCategory(id: string): void { this.category.set(id); }

  reset(): void { this.query.set(''); this.category.set('all'); }
}
