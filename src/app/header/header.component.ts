import {
  Component,
  ElementRef,
  AfterViewInit,
  Renderer2,
  inject,
  OnInit,
  OnDestroy
} from '@angular/core';
import { Router } from '@angular/router';
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
    this.translationService.currentLanguage$.subscribe(lang => {
      this.currentLang = lang;
    });
    this.setupScrollListener();
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    this.navbarEl = this.elRef.nativeElement.querySelector('.navbar');
    window.requestAnimationFrame(() => this.updateHeaderOffset());
    this.setupResizeListener();
    this.handleScroll();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined' && this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = undefined;
    }

    if (typeof window !== 'undefined' && this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }

    if (this.scrollRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }

    this.setBodyScrollLock(false);
  }

  setupScrollListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Perf: rAF throttle — batch all DOM reads/writes into one frame instead
    // of firing synchronously on every scroll event (which thrashes layout on mobile).
    this.scrollHandler = () => {
      if (this.scrollRafId !== null) {
        return;
      }
      this.scrollRafId = window.requestAnimationFrame(() => {
        this.scrollRafId = null;
        this.handleScroll();
      });
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  private setupResizeListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.resizeHandler = () => {
      this.updateHeaderOffset();
      // Section offsets change with viewport size — recache.
      this.cacheSectionOffsets();
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * Perf: cache section offsetTop values instead of calling getElementById +
   * offsetTop on 5 sections every scroll frame. Called once on init and on resize.
   */
  private cacheSectionOffsets(): void {
    if (typeof document === 'undefined') {
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
    if (typeof window === 'undefined') {
      return;
    }

    const scrollY = window.scrollY;
    this.updateNavbarState(scrollY);
    const progress = this.updateScrollProgress(scrollY);
    this.updateInspirationWord(progress);

    // Lazy-init section cache on first scroll (after hydration) if not yet populated.
    if (this.sectionOffsets.length === 0) {
      this.cacheSectionOffsets();
    }

    const offset = (this.navbarEl?.offsetHeight ?? 70) + 30;
    const scrollPosition = scrollY + offset;

    for (let i = this.sectionOffsets.length - 1; i >= 0; i--) {
      const section = this.sectionOffsets[i];
      if (scrollPosition >= section.top) {
        if (this.currentSection !== section.id) {
          this.currentSection = section.id;
        }
        return;
      }
    }

    if (this.currentSection !== 'hero') {
      this.currentSection = 'hero';
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
    if (!this.navbarEl || typeof window === 'undefined') {
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
    if (!this.navbarEl || typeof document === 'undefined') {
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

  private updateInspirationWord(progress: number): void {
    if (progress < 0) {
      return;
    }

    if (Math.abs(progress - this.lastWordChangeProgress) < this.wordChangeThreshold) {
      return;
    }

    this.activeWord = this.pickNextWord();
    this.wordSwapToggle = !this.wordSwapToggle;
    this.lastWordChangeProgress = progress;
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
    if (typeof window === 'undefined') {
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
    if (typeof document === 'undefined') {
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
