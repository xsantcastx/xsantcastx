import {
  Component,
  ElementRef,
  AfterViewInit,
  Renderer2,
  inject,
  OnInit,
  OnDestroy
} from '@angular/core';
import { TranslationService } from '../translation.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: false
})
export class HeaderComponent implements AfterViewInit, OnInit, OnDestroy {
  private navbarEl: HTMLElement | null = null;
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;
  private lastHeaderOffset = 96;
  private bodyOverflowBackup: string | null = null;

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
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.translationService.currentLanguage$.subscribe(lang => {
      this.currentLang = lang;
    });
    this.setupScrollListener();
  }

  ngAfterViewInit(): void {
    this.navbarEl = this.elRef.nativeElement.querySelector('.navbar');

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => this.updateHeaderOffset());
    } else {
      this.updateHeaderOffset();
    }

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

    this.setBodyScrollLock(false);
  }

  setupScrollListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.scrollHandler = () => this.handleScroll();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  private setupResizeListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.resizeHandler = () => this.updateHeaderOffset();
    window.addEventListener('resize', this.resizeHandler);
  }

  handleScroll(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.updateNavbarState(window.scrollY);
    const progress = this.updateScrollProgress();
    this.updateInspirationWord(progress);

    const sections = ['hero', 'services', 'projects', 'about', 'contact'];
    const offset = (this.navbarEl?.offsetHeight ?? 70) + 30;
    const scrollPosition = window.scrollY + offset;

    for (let i = sections.length - 1; i >= 0; i--) {
      const element = document.getElementById(sections[i]);
      if (element && scrollPosition >= element.offsetTop) {
        if (this.currentSection !== sections[i]) {
          this.currentSection = sections[i];
          this.updateBodyBackground(sections[i]);
        }
        return;
      }
    }

    if (this.currentSection !== 'hero') {
      this.currentSection = 'hero';
      this.updateBodyBackground('hero');
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

  private updateScrollProgress(): number {
    if (!this.navbarEl || typeof window === 'undefined') {
      return 0;
    }

    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;

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
    this.translationService.setLanguage(language);
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  scrollToSection(sectionId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const element = document.getElementById(sectionId);
    if (element) {
      const headerHeight = this.navbarEl?.offsetHeight ?? 70;
      const offsetPosition = element.getBoundingClientRect().top + window.scrollY - headerHeight + 1;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
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
