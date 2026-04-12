import {
  Component,
  ElementRef,
  AfterViewInit,
  Renderer2,
  inject,
  OnInit,
  OnDestroy,
  NgZone,
  ChangeDetectorRef,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslationService } from '../translation.service';
import { AnalyticsService } from '../analytics.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: false
})
export class HeaderComponent implements AfterViewInit, OnInit, OnDestroy {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  /**
   * SSR fix: Angular's server-side DOM provides `window` and `document` stubs that
   * pass `typeof window === 'undefined'` guards, but do NOT implement
   * `CSSStyleDeclaration.setProperty()`, triggering 135× NotYetImplemented errors
   * during prerender. `isPlatformBrowser` is the canonical Angular SSR guard.
   */
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private navbarEl: HTMLElement | null = null;
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;
  private lastHeaderOffset = 96;
  private bodyOverflowBackup: string | null = null;
  // Perf: rAF throttle for scroll handler to prevent layout thrash on mobile
  private scrollRafId: number | null = null;
  // Perf: cache section offsets so scroll handler doesn't hit the DOM 5x per frame
  private sectionOffsets: Array<{ id: string; top: number }> = [];
  private cachedScrollableHeight = 0;
  // Perf Phase 2: track template-bound state so we only trigger change detection
  // when a value that actually affects the view changes. Scroll handler now runs
  // outside the Angular zone, so CD must be explicitly opted into on state change.
  private langSub?: Subscription;

  currentLang = 'en';
  mobileMenuOpen = false;
  currentSection = 'hero';

  readonly inspirationWords: string[] = [
    'innovate',
    'iterate',
    'ship boldly',
    'solve elegantly',
    'design in code',
    'scale ideas',
    'debug with heart',
    'launch faster',
    'create delight',
    'dream in js'
  ];
  activeWord = this.inspirationWords[0];
  wordSwapToggle = false;
  private lastWordChangeProgress = 0;
  private readonly wordChangeThreshold = 6;

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2,
    private translationService: TranslationService,
    private analyticsService: AnalyticsService
  ) {}

  ngOnInit(): void {
    // Perf Phase 2: store the subscription so it tears down on destroy. Previously
    // this was a naked subscribe() that leaked every time the header was recreated.
    this.langSub = this.translationService.currentLanguage$.subscribe(lang => {
      const changed = this.currentLang !== lang;
      this.currentLang = lang;
      if (changed) {
        this.cdr.markForCheck();
      }
    });
    this.setupScrollListener();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.navbarEl = this.elRef.nativeElement.querySelector('.navbar');
    // Run one-shot measurements outside the zone so SSR hydration + initial paint
    // don't pay a change-detection tax for a single CSS variable write.
    this.ngZone.runOutsideAngular(() => {
      window.requestAnimationFrame(() => this.updateHeaderOffset());
    });
    this.setupResizeListener();
    this.ngZone.runOutsideAngular(() => this.handleScroll());
  }

  ngOnDestroy(): void {
    if (this.isBrowser && this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = undefined;
    }

    if (this.isBrowser && this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }

    if (this.scrollRafId !== null && this.isBrowser) {
      window.cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }

    this.langSub?.unsubscribe();
    this.setBodyScrollLock(false);
  }

  setupScrollListener(): void {
    if (!this.isBrowser) {
      return;
    }

    // Perf Phase 2: run the scroll listener and its rAF callback OUTSIDE the
    // Angular zone. The scroll event fires ~60×/s on mobile, and every time a
    // zone patched callback touched a template-bound field Angular ran a full
    // change-detection cycle over the entire component tree (114+ tools in the
    // registry). Over 90s of continuous scroll that's ~5,400 CD passes stacking
    // pending tasks, V8 deopts, and garbage collection pressure — exactly the
    // "lag accumulates over time" symptom the owner reported after 9f6c586.
    //
    // Inside the raf callback we call handleScroll(), which internally decides
    // whether any template-bound state (currentSection / activeWord / toggle)
    // changed and then explicitly re-enters the zone via markForCheck() only for
    // those frames. Static scroll rAFs (the common case) cost zero Angular work.
    this.ngZone.runOutsideAngular(() => {
      this.scrollHandler = () => {
        if (this.scrollRafId !== null) {
          return;
        }
        this.scrollRafId = window.requestAnimationFrame(() => {
          this.scrollRafId = null;
          this.handleScroll();
        });
      };
      window.addEventListener('scroll', this.scrollHandler!, { passive: true });
    });
  }

  private setupResizeListener(): void {
    if (!this.isBrowser) {
      return;
    }

    // Perf Phase 2: resize is also outside the zone — it mutates layout
    // (--header-offset CSS var + cached offsets), not template-bound state.
    this.ngZone.runOutsideAngular(() => {
      this.resizeHandler = () => {
        this.updateHeaderOffset();
        // Section offsets change with viewport size — recache.
        this.cacheSectionOffsets();
      };
      window.addEventListener('resize', this.resizeHandler!);
    });
  }

  /**
   * Perf: cache section offsetTop values instead of calling getElementById +
   * offsetTop on 5 sections every scroll frame. Called once on init and on resize.
   */
  private cacheSectionOffsets(): void {
    if (!this.isBrowser) {
      return;
    }
    const sectionIds = ['hero', 'services', 'projects', 'about', 'contact'];
    this.sectionOffsets = sectionIds
      .map(id => {
        const el = document.getElementById(id);
        return el ? { id, top: el.offsetTop } : null;
      })
      .filter((x): x is { id: string; top: number } => x !== null);
    this.cachedScrollableHeight = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
  }

  handleScroll(): void {
    if (!this.isBrowser) {
      return;
    }

    const scrollY = window.scrollY;
    this.updateNavbarState(scrollY);
    const progress = this.updateScrollProgress(scrollY);
    // Track whether any template-bound state changed so we can opt back into
    // change detection only when the view actually needs to update.
    let viewDirty = this.updateInspirationWord(progress);

    // Lazy-init section cache on first scroll (after hydration) if not yet populated.
    if (this.sectionOffsets.length === 0) {
      this.cacheSectionOffsets();
    }

    const offset = (this.navbarEl?.offsetHeight ?? 70) + 30;
    const scrollPosition = scrollY + offset;

    let matched = false;
    for (let i = this.sectionOffsets.length - 1; i >= 0; i--) {
      const section = this.sectionOffsets[i];
      if (scrollPosition >= section.top) {
        if (this.currentSection !== section.id) {
          this.currentSection = section.id;
          viewDirty = true;
        }
        matched = true;
        break;
      }
    }

    if (!matched && this.currentSection !== 'hero') {
      this.currentSection = 'hero';
      viewDirty = true;
    }

    // Only cross the zone boundary when the view needs to re-render. On a page
    // of static scrolling (the vast majority of rAF ticks) this is a no-op and
    // Angular does zero work. When the active section or inspiration word
    // actually flips we re-enter the zone once and flush one CD pass.
    if (viewDirty) {
      this.ngZone.run(() => this.cdr.markForCheck());
    }
  }

  private updateNavbarState(scrollY: number): void {
    if (!this.navbarEl) {
      return;
    }

    const wasCompact = this.navbarEl.classList.contains('is-compact');

    if (scrollY > 24) {
      this.renderer.addClass(this.navbarEl, 'is-compact');
    } else {
      this.renderer.removeClass(this.navbarEl, 'is-compact');
    }

    const isCompact = this.navbarEl.classList.contains('is-compact');
    if (wasCompact !== isCompact) {
      this.updateHeaderOffset();
    }
  }

  private updateScrollProgress(scrollY: number): number {
    if (!this.navbarEl || !this.isBrowser) {
      return 0;
    }

    // Perf: use cached scrollable height. scrollHeight reads are forced layout
    // calculations and are expensive on mobile. Recomputed only on resize.
    const scrollable = this.cachedScrollableHeight > 0
      ? this.cachedScrollableHeight
      : Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const progress = scrollable > 0 ? (scrollY / scrollable) * 100 : 0;

    this.navbarEl.style.setProperty('--scroll-progress', `${progress}%`);
    return progress;
  }

  private updateHeaderOffset(): void {
    if (!this.navbarEl || !this.isBrowser) {
      return;
    }

    const measuredHeight = this.navbarEl.offsetHeight;
    const buffer = measuredHeight <= 72 ? 12 : 20;
    const nextOffset = Math.round(measuredHeight + buffer);

    if (this.lastHeaderOffset === nextOffset) {
      return;
    }

    this.lastHeaderOffset = nextOffset;
    document.documentElement.style.setProperty('--header-offset', `${nextOffset}px`);
  }

  updateBodyBackground(section: string): void {
    const body = document.body;
    body.classList.remove('bg-hero', 'bg-services', 'bg-projects', 'bg-about', 'bg-contact');
    body.classList.add(`bg-${section}`);
  }

  /**
   * Returns true when a template-bound field (activeWord / wordSwapToggle)
   * was mutated, so the caller can schedule a single markForCheck instead of
   * letting every rAF tick trigger zone-driven change detection.
   */
  private updateInspirationWord(progress: number): boolean {
    if (progress < 0) {
      return false;
    }

    if (Math.abs(progress - this.lastWordChangeProgress) < this.wordChangeThreshold) {
      return false;
    }

    this.activeWord = this.pickNextWord();
    this.wordSwapToggle = !this.wordSwapToggle;
    this.lastWordChangeProgress = progress;
    return true;
  }

  private pickNextWord(): string {
    const options = this.inspirationWords.filter(word => word !== this.activeWord);
    if (!options.length) {
      return this.activeWord;
    }

    const index = Math.floor(Math.random() * options.length);
    return options[index];
  }

  setLanguage(language: string): void {
    const previousLang = this.currentLang;
    this.translationService.setLanguage(language);
    
    // Track language change
    if (previousLang !== language) {
      this.analyticsService.trackLanguageChange(
        language as 'en' | 'es',
        previousLang as 'en' | 'es'
      );
    }
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  scrollToSection(sectionId: string): void {
    if (!this.isBrowser) {
      return;
    }

    const doScroll = () => {
      const element = document.getElementById(sectionId);
      if (element) {
        const headerHeight = this.navbarEl?.offsetHeight ?? 70;
        const offsetPosition = element.getBoundingClientRect().top + window.scrollY - headerHeight + 1;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    };

    const isOnHome = this.router.url === '/home' || this.router.url === '/';
    if (isOnHome) {
      doScroll();
    } else {
      this.router.navigate(['/home']).then(() => setTimeout(doScroll, 300));
    }
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.setBodyScrollLock(this.mobileMenuOpen);
  }

  closeMobileMenu() {
    if (!this.mobileMenuOpen) {
      return;
    }

    this.mobileMenuOpen = false;
    this.setBodyScrollLock(false);
  }

  private setBodyScrollLock(lock: boolean): void {
    if (!this.isBrowser) {
      return;
    }

    const bodyStyle = document.body.style;

    if (lock) {
      if (this.bodyOverflowBackup === null) {
        this.bodyOverflowBackup = bodyStyle.overflow || '';
      }
      bodyStyle.overflow = 'hidden';
    } else {
      if (this.bodyOverflowBackup !== null) {
        bodyStyle.overflow = this.bodyOverflowBackup;
        this.bodyOverflowBackup = null;
      } else {
        bodyStyle.removeProperty('overflow');
      }
    }
  }
}
