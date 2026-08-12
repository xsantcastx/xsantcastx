/**
 * header.component.ts — the Godforge command bar.
 *
 * Replaced the portfolio navbar (scroll-spy links to #services / #projects /
 * #about / #contact, a rotating buzzword under the wordmark) with a bar that
 * navigates the game world: the realms, the arena, the codex, the war table,
 * the market, and the visitor's own standing.
 *
 * What survived from the old header, because the reasons still hold:
 *  · --nav-h is measured and published so the drawer can sit flush under a bar
 *    whose height includes env(safe-area-inset-top) on notched phones.
 *  · The scroll listener runs OUTSIDE the Angular zone and only re-enters when
 *    template-bound state actually changed. Inside the zone this fired a full
 *    CD pass ~60x/s over the whole tree.
 *  · The drawer closes on Escape, on NavigationEnd, and on a resize past the
 *    breakpoint; the body scroll lock takes the body out of flow (the only
 *    technique iOS Safari honours) and restores the offset on unlock.
 */
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
  HostListener,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TranslationService } from '../translation.service';
import { AnalyticsService } from '../analytics.service';
import { EASTER_EGGS, EasterEggService } from '../shared/easter-eggs/easter-egg.service';
import { REALMS, RealmDefinition } from '../shared/realms/realm.model';

/** A hall in the drawer: a route with a name and a one-line reason to go. */
interface TomeLink {
  route: string;
  key: string;
  hintKey: string;
}

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
  /**
   * SSR: Angular's server DOM provides `window`/`document` stubs that pass a
   * `typeof window === 'undefined'` guard but do not implement
   * `CSSStyleDeclaration.setProperty()`. `isPlatformBrowser` is the real guard.
   */
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private navbarEl: HTMLElement | null = null;
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;
  private routerSub?: Subscription;
  private langSub?: Subscription;
  private lastHeaderOffset = 96;
  private lastNavHeight = -1;
  private lockedScrollY = 0;
  private isScrollLocked = false;
  private scrollRafId: number | null = null;
  private lastScrollY = 0;

  /** Above this width the drawer is not rendered — matches the CSS breakpoint. */
  private static readonly MOBILE_NAV_BREAKPOINT = 960;

  currentLang = 'en';
  mobileMenuOpen = false;
  realmsOpen = false;
  /** Bar shrinks on the way down, returns to full height on the way up. */
  compact = false;

  readonly realms: RealmDefinition[] = REALMS;

  /**
   * Codex badge: fragments found over fragments that exist. Starts at zero on
   * both server and client so the first frame matches the prerendered HTML;
   * the real count lands after init() resolves, which is after hydration.
   */
  codexFound = 0;
  readonly codexTotal = EASTER_EGGS.length;

  /**
   * The halls that do not earn a slot in the desktop row. The row is full at
   * 1280px — this is the same constraint that kept Market and Quests out of it
   * before — so these live in the drawer and the footer instead.
   */
  readonly tomeLinks: TomeLink[] = [
    { route: '/tools',        key: 'gfnav.allArtifacts', hintKey: 'gfnav.hint.tools' },
    { route: '/arena',        key: 'gfnav.arena',        hintKey: 'gfnav.hint.arena' },
    { route: '/codex',        key: 'gfnav.codex',        hintKey: 'gfnav.hint.codex' },
    { route: '/blueprint',    key: 'gfnav.warTable',     hintKey: 'gfnav.hint.warTable' },
    { route: '/market',       key: 'gfnav.market',       hintKey: 'gfnav.hint.market' },
    { route: '/quests',       key: 'gfnav.quests',       hintKey: 'gfnav.hint.quests' },
    { route: '/forge-keeper', key: 'gfnav.keeper',       hintKey: 'gfnav.hint.keeper' },
    { route: '/live',         key: 'gfnav.live',         hintKey: 'gfnav.hint.live' },
    { route: '/mcp',          key: 'gfnav.mcp',          hintKey: 'gfnav.hint.mcp' },
    { route: '/sponsors',     key: 'gfnav.sponsors',     hintKey: 'gfnav.hint.sponsors' }
  ];

  private eggs = inject(EasterEggService);

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2,
    private translationService: TranslationService,
    private analyticsService: AnalyticsService
  ) {}

  ngOnInit(): void {
    this.langSub = this.translationService.currentLanguage$.subscribe(lang => {
      const changed = this.currentLang !== lang;
      this.currentLang = lang;
      if (changed) {
        this.cdr.markForCheck();
      }
    });
    this.setupScrollListener();

    // Back/forward and any programmatic navigation bypass the template's
    // click handler — without this the drawer stays open (and the body stays
    // scroll-locked) over the new page.
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeMobileMenu();
        this.closeRealms();
      });

    // Read once. The count only moves on a discovery, and a discovery already
    // interrupts the page with a drop toast, so a live subscription here would
    // buy a number nobody is looking at.
    if (this.isBrowser) {
      void this.eggs.init().then(() => {
        this.codexFound = this.eggs.foundCount;
        this.cdr.markForCheck();
      });
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.navbarEl = this.elRef.nativeElement.querySelector('.gfnav');
    // Measure synchronously. Deferring this to a single rAF meant a page opened
    // in a background tab (where browsers suspend rAF) finished AfterViewInit
    // with --nav-h never written, and the drawer fell back to a hardcoded top.
    this.updateHeaderOffset();
    this.ngZone.runOutsideAngular(() => {
      window.requestAnimationFrame(() => this.updateHeaderOffset());
    });
    this.setupResizeListener();
    this.ngZone.runOutsideAngular(() => this.handleScroll());
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      if (this.scrollHandler) {
        window.removeEventListener('scroll', this.scrollHandler);
        this.scrollHandler = undefined;
      }
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
        this.resizeHandler = undefined;
      }
      if (this.scrollRafId !== null) {
        window.cancelAnimationFrame(this.scrollRafId);
        this.scrollRafId = null;
      }
    }

    this.routerSub?.unsubscribe();
    this.langSub?.unsubscribe();
    this.setBodyScrollLock(false);
  }

  // ── Realms dropdown ───────────────────────────────────────────────────

  /**
   * Set when the pointer — not a click — opened the menu. Without it, hovering
   * the button and then clicking it toggled the menu shut: mouseenter had
   * already set realmsOpen, so the click read as "close" on a menu the visitor
   * was clicking to open. The first click after a hover-open is absorbed; a
   * second one closes, which is what a mouse user expects.
   */
  private openedByHover = false;

  openRealms(): void {
    if (this.isDrawerBreakpoint()) return;
    if (!this.realmsOpen) {
      this.openedByHover = true;
    }
    this.realmsOpen = true;
  }

  closeRealms(): void {
    this.openedByHover = false;
    if (!this.realmsOpen) return;
    this.realmsOpen = false;
  }

  toggleRealms(): void {
    if (this.realmsOpen && this.openedByHover) {
      this.openedByHover = false;
      return;
    }
    this.realmsOpen = !this.realmsOpen;
    this.openedByHover = false;
  }

  closeAll(): void {
    this.closeRealms();
    this.closeMobileMenu();
  }

  /** Escape closes whatever is open — WCAG 2.1.2, no keyboard trap. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.realmsOpen) {
      this.closeRealms();
      this.cdr.markForCheck();
    }
    if (this.mobileMenuOpen) {
      this.closeMobileMenu();
      this.cdr.markForCheck();
    }
  }

  /** A click anywhere outside the bar dismisses the dropdown. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.realmsOpen) return;
    const target = event.target as Node | null;
    if (target && this.elRef.nativeElement.contains(target)) return;
    this.closeRealms();
    this.cdr.markForCheck();
  }

  private isDrawerBreakpoint(): boolean {
    return this.isBrowser && window.innerWidth <= HeaderComponent.MOBILE_NAV_BREAKPOINT;
  }

  // ── Scroll ────────────────────────────────────────────────────────────

  setupScrollListener(): void {
    if (!this.isBrowser) return;

    // Outside the zone: the scroll event fires ~60x/s and every zone-patched
    // callback that touched a template-bound field ran a full CD pass over the
    // whole component tree. handleScroll() re-enters the zone only on the
    // frames where `compact` actually flips.
    this.ngZone.runOutsideAngular(() => {
      this.scrollHandler = () => {
        if (this.scrollRafId !== null) return;
        this.scrollRafId = window.requestAnimationFrame(() => {
          this.scrollRafId = null;
          this.handleScroll();
        });
      };
      window.addEventListener('scroll', this.scrollHandler!, { passive: true });
    });
  }

  private setupResizeListener(): void {
    if (!this.isBrowser) return;

    this.ngZone.runOutsideAngular(() => {
      this.resizeHandler = () => {
        this.updateHeaderOffset();
        // Rotating to landscape (or resizing past the breakpoint) hides the
        // drawer via CSS but used to leave `mobileMenuOpen` true and the body
        // scroll-locked — the page became unscrollable with no way to recover.
        if (this.mobileMenuOpen && window.innerWidth > HeaderComponent.MOBILE_NAV_BREAKPOINT) {
          this.ngZone.run(() => {
            this.closeMobileMenu();
            this.cdr.markForCheck();
          });
        }
      };
      window.addEventListener('resize', this.resizeHandler!, { passive: true });
    });
  }

  handleScroll(): void {
    if (!this.isBrowser) return;

    const scrollY = window.scrollY;
    const progress = this.updateScrollProgress(scrollY);

    // Direction-aware: compact on the way down, full again on the way up, with
    // a small deadband so a jittery trackpad does not oscillate the bar.
    const delta = scrollY - this.lastScrollY;
    let next = this.compact;
    if (scrollY <= 24) {
      next = false;
    } else if (delta > 4) {
      next = true;
    } else if (delta < -4) {
      next = false;
    }
    if (Math.abs(delta) > 1) {
      this.lastScrollY = scrollY;
    }

    if (next !== this.compact) {
      this.compact = next;
      // The bar's height changes with the class, so republish the offset the
      // page layout and the drawer both position off.
      this.ngZone.run(() => {
        this.cdr.markForCheck();
      });
      window.requestAnimationFrame(() => this.updateHeaderOffset());
    }

    void progress;
  }

  private updateScrollProgress(scrollY: number): number {
    if (!this.navbarEl || !this.isBrowser) return 0;

    const scrollable = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const progress = scrollable > 0 ? (scrollY / scrollable) * 100 : 0;
    this.navbarEl.style.setProperty('--scroll-progress', `${progress}%`);
    return progress;
  }

  private updateHeaderOffset(): void {
    if (!this.navbarEl || !this.isBrowser) return;

    const measuredHeight = this.navbarEl.offsetHeight;

    // Publish the *measured* height (which already includes the
    // env(safe-area-inset-top) padding on notched devices) so the drawer sits
    // flush under the bar rather than under a hardcoded guess.
    if (this.lastNavHeight !== measuredHeight) {
      this.lastNavHeight = measuredHeight;
      document.documentElement.style.setProperty('--nav-h', `${measuredHeight}px`);
    }

    const buffer = measuredHeight <= 60 ? 12 : 20;
    const nextOffset = Math.round(measuredHeight + buffer);
    if (this.lastHeaderOffset === nextOffset) return;

    this.lastHeaderOffset = nextOffset;
    document.documentElement.style.setProperty('--header-offset', `${nextOffset}px`);
  }

  // ── Language ──────────────────────────────────────────────────────────

  setLanguage(language: string): void {
    const previousLang = this.currentLang;
    this.translationService.setLanguage(language);

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

  // ── Drawer ────────────────────────────────────────────────────────────

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.setBodyScrollLock(this.mobileMenuOpen);
  }

  closeMobileMenu(): void {
    if (!this.mobileMenuOpen) return;
    this.mobileMenuOpen = false;
    this.setBodyScrollLock(false);
  }

  /**
   * `body { overflow: hidden }` alone does NOT stop scrolling in iOS Safari —
   * the page keeps rubber-banding behind the drawer and taps land on whatever
   * scrolled under it. Taking the body out of flow at its current offset and
   * restoring both styles and scroll position on unlock is the reliable lock.
   */
  private setBodyScrollLock(lock: boolean): void {
    if (!this.isBrowser) return;

    const bodyStyle = document.body.style;

    if (lock) {
      if (this.isScrollLocked) return;
      this.isScrollLocked = true;
      this.lockedScrollY = window.scrollY || window.pageYOffset || 0;
      bodyStyle.position = 'fixed';
      bodyStyle.top = `-${this.lockedScrollY}px`;
      bodyStyle.left = '0';
      bodyStyle.right = '0';
      bodyStyle.width = '100%';
      bodyStyle.overflow = 'hidden';
      return;
    }

    if (!this.isScrollLocked) return;
    this.isScrollLocked = false;
    bodyStyle.removeProperty('position');
    bodyStyle.removeProperty('top');
    bodyStyle.removeProperty('left');
    bodyStyle.removeProperty('right');
    bodyStyle.removeProperty('width');
    bodyStyle.removeProperty('overflow');
    // `position: fixed` reset the document to scrollTop 0 — put the reader back
    // where they were. `auto`, not `smooth`, so the restore is instantaneous.
    window.scrollTo({ top: this.lockedScrollY, behavior: 'auto' });
  }
}
