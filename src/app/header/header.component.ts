/**
 * header.component.ts — the Eclipse shell: desktop sidebar, mobile tome,
 * and the mobile bottom tab bar.
 *
 * Three surfaces, one piece of nav state, because they are three views of the
 * same thing and splitting them across components would mean three copies of
 * "is the drawer open" to keep in step. Destinations come from NAV_MANIFEST.
 *
 *  · Desktop (>= 961px): persistent left sidebar — lockup, primary halls,
 *    MORE, then the visitor's standing. No top bar, no hamburger, no tabs.
 *  · Mobile: the bar keeps the lockup and the status pills; primary
 *    navigation moves to a fixed five-tab bar at the bottom of the viewport,
 *    and the hamburger opens the tome for everything secondary.
 *
 * What survived earlier passes, because the reasons still hold:
 *  · --nav-h / --header-offset / --shell-sidebar-w are published so pages
 *    that clear the chrome do not sit under a missing top bar.
 *  · The scroll listener runs OUTSIDE the Angular zone and re-enters only on
 *    the frames where a template-bound value actually changed.
 *  · The tome registers with OverlayStackService while open so Escape closes
 *    only the topmost overlay; the body scroll lock takes the body out of
 *    flow, the only technique iOS Safari honours, and restores the offset
 *    on unlock.
 */
import {
  ChangeDetectionStrategy,
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
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TranslationService } from '../translation.service';
import { AnalyticsService } from '../analytics.service';
import { EasterEggService, PUBLIC_CODEX_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { XpService, XpSnapshot } from '../shared/gamification/xp.service';
import { rankSigil } from '../shared/gamification/gamification.model';
import { EconomyService, EconomySnapshot } from '../shared/economy/economy.service';
import { formatCurrency } from '../shared/economy/economy.model';
import { MORE_NAV, NavDestination, PRIMARY_NAV } from '../shared/nav/nav.manifest';
import { OverlayStackService } from '../shared/overlay/overlay-stack.service';
import { InventoryService } from '../shared/rpg/inventory.service';
import { KeeperPanelService } from '../shared/keeper/keeper-panel.service';

interface TomeSection {
  titleKey: string;
  halls: readonly NavDestination[];
}

@Component({
  // OnPush: the scroll listener lives outside the zone and every external
  // input (language, XP, economy, inventory, keeper, router) already calls
  // markForCheck on the subscription that carries it. Without this the
  // once-per-flip ngZone.run() in handleScroll ticked the whole app.
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: false
})
export class HeaderComponent implements AfterViewInit, OnInit, OnDestroy {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);
  private xp = inject(XpService);
  private economy = inject(EconomyService);
  private inventory = inject(InventoryService);
  readonly keeper = inject(KeeperPanelService);

  private navbarEl: HTMLElement | null = null;
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;
  private routerSub?: Subscription;
  private langSub?: Subscription;
  private xpSub?: Subscription;
  private ecoSub?: Subscription;
  private invSub?: Subscription;
  private keeperSub?: Subscription;
  private lastHeaderOffset = 96;
  private lastNavHeight = -1;
  private lockedScrollY = 0;
  private isScrollLocked = false;
  private scrollRafId: number | null = null;
  private lastScrollY = 0;

  /**
   * Viewport metrics cached off the scroll path.
   *
   * `scrollHeight` and `innerHeight` are layout-forcing reads: taking them
   * inside the scroll rAF made the browser flush layout once per frame, on
   * every page, for the width of a progress bar. They only change when the
   * viewport resizes or the route swaps the document height, so they are
   * measured there instead and the scroll frame does pure arithmetic.
   */
  private cachedScrollable = 0;
  private cachedViewportW = 0;
  private tomeUnreg?: () => void;
  private readonly overlays = inject(OverlayStackService);

  /** Above this width the tome and the tab bar are not rendered. */
  private static readonly MOBILE_NAV_BREAKPOINT = 960;
  private static readonly DESKTOP_HEADER_OFFSET = 20;
  private static readonly DESKTOP_SIDEBAR_W = 236;
  private static readonly MOBILE_TAB_BAR_H = 58;

  currentLang = 'en';
  mobileMenuOpen = false;
  compact = false;

  /**
   * Progression and wallet. Both render their zero state on the server and the
   * visitor's real numbers land after hydration, which keeps the first frame
   * identical to the prerendered HTML.
   */
  snap: XpSnapshot = this.xp.snapshot;
  eco: EconomySnapshot = this.economy.snapshot;

  codexFound = 0;
  readonly codexTotal = PUBLIC_CODEX_EGGS.length;

  /** Painted rank crest for the level held — exposed for the bar and the tome. */
  readonly rankSigil = rankSigil;

  /** The five player halls. Same list as the mobile tab bar. */
  readonly primaryNav = PRIMARY_NAV;
  readonly moreNav = MORE_NAV;
  readonly tabs = PRIMARY_NAV;

  /**
   * MAIN is the same five halls as the bar. MORE is demoted product surfaces
   * that still have real pages — never a redirect stub.
   */
  readonly tomeSections: TomeSection[] = [
    { titleKey: 'gfnav.section.main', halls: PRIMARY_NAV },
    { titleKey: 'gfnav.section.more', halls: MORE_NAV },
  ];

  readonly socials = [
    { href: 'https://x.com/xsantcastx',            label: 'X',       glyph: 'x' },
    { href: 'https://github.com/xsantcastx',       label: 'GitHub',  glyph: 'github' },
    { href: 'https://www.twitch.tv/xsantcastx',    label: 'Twitch',  glyph: 'twitch' },
    { href: 'https://www.instagram.com/xsantcastx/', label: 'Instagram', glyph: 'instagram' }
  ];

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2,
    private translationService: TranslationService,
    private analyticsService: AnalyticsService
  ) {}

  // ── Readouts ──────────────────────────────────────────────────────────

  get gold(): string { return formatCurrency(this.eco.gold); }
  get essence(): string { return formatCurrency(this.eco.essence); }
  get rankTitle(): string { return this.snap.level.title; }
  get rankLevel(): number { return this.snap.level.level; }
  get xpProgress(): number { return this.snap.progress * 100; }
  get xpNow(): number { return this.snap.xp; }
  /** The XP figure the next rank starts at, for the "1,364 / 2,500" readout. */
  get xpTarget(): number { return this.snap.next ? this.snap.next.minXp : this.snap.xp; }
  get bagCount(): number {
    const snap = this.inventory.snapshot;
    return typeof snap.usedRows === 'number' ? snap.usedRows : snap.bag.length;
  }

  openCharacter(): void { this.closeMobileMenu(); this.keeper.toggle('character'); }
  openBank(): void { this.closeMobileMenu(); this.keeper.toggle('bank'); }

  get characterPanelOpen(): boolean { return this.keeper.isOpen && this.keeper.tab !== 'bank'; }
  get bankPanelOpen(): boolean { return this.keeper.isOpen && this.keeper.tab === 'bank'; }

  /** Left-click opens the side panel. Modified clicks still go to /character. */
  onHallClick(event: MouseEvent, hall: NavDestination): void {
    if (hall.id !== 'character') return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.openCharacter();
  }

  hallIsActive(hall: NavDestination): boolean {
    return hall.id === 'character' && this.keeper.isOpen;
  }

  ngOnInit(): void {
    this.langSub = this.translationService.currentLanguage$.subscribe(lang => {
      const changed = this.currentLang !== lang;
      this.currentLang = lang;
      if (changed) this.cdr.markForCheck();
    });
    this.setupScrollListener();

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeMobileMenu();
        // A new page is a new document height, and the compact bar should not
        // survive a route change that scrolled us back to the top.
        if (this.isBrowser) {
          window.requestAnimationFrame(() => {
            this.measureViewport();
            this.updateScrollProgress(window.scrollY);
          });
        }
        this.cdr.markForCheck();
      });

    if (this.isBrowser) {
      void this.eggs.init().then(() => {
        this.codexFound = this.eggs.foundCount;
        this.cdr.markForCheck();
      });

      // Both services are idempotent on init and are already initialised by
      // AppComponent; subscribing is what keeps the bar's numbers live when a
      // tool awards XP or the ambient forge ticks Gold.
      void this.xp.init();
      this.economy.init();
      this.inventory.init();
      this.xpSub = this.xp.snapshot$.subscribe(s => { this.snap = s; this.cdr.markForCheck(); });
      this.ecoSub = this.economy.snapshot$.subscribe(e => { this.eco = e; this.cdr.markForCheck(); });
      this.invSub = this.inventory.snapshot$.subscribe(() => this.cdr.markForCheck());
      this.keeperSub = this.keeper.open$.subscribe(() => this.cdr.markForCheck());
      this.keeperSub.add(this.keeper.tab$.subscribe(() => this.cdr.markForCheck()));
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.navbarEl = this.elRef.nativeElement.querySelector('.gfnav');
    this.measureViewport();
    // Measure synchronously: a page opened in a background tab has rAF
    // suspended, and deferring this left --nav-h unwritten, which the tome
    // positions off.
    this.updateHeaderOffset();
    this.ngZone.runOutsideAngular(() => {
      window.requestAnimationFrame(() => this.updateHeaderOffset());
    });
    this.setupResizeListener();
    this.ngZone.runOutsideAngular(() => this.handleScroll());
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler);
      if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
      if (this.scrollRafId !== null) window.cancelAnimationFrame(this.scrollRafId);
      this.scrollHandler = undefined;
      this.resizeHandler = undefined;
      this.scrollRafId = null;
      const root = document.documentElement.style;
      root.removeProperty('--nav-h');
      root.removeProperty('--shell-sidebar-w');
      root.removeProperty('--gftabs-h');
      root.removeProperty('--header-offset');
    }
    this.routerSub?.unsubscribe();
    this.langSub?.unsubscribe();
    this.xpSub?.unsubscribe();
    this.ecoSub?.unsubscribe();
    this.invSub?.unsubscribe();
    this.keeperSub?.unsubscribe();
    this.tomeUnreg?.();
    this.tomeUnreg = undefined;
    this.setBodyScrollLock(false);
  }

  // ── Scroll ────────────────────────────────────────────────────────────

  setupScrollListener(): void {
    if (!this.isBrowser) return;
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
        this.measureViewport();
        this.updateHeaderOffset();
        if (this.mobileMenuOpen && this.cachedViewportW > HeaderComponent.MOBILE_NAV_BREAKPOINT) {
          this.ngZone.run(() => {
            this.closeMobileMenu();
            this.cdr.markForCheck();
          });
        }
      };
      window.addEventListener('resize', this.resizeHandler!, { passive: true });
    });
  }

  /**
   * Re-measure what the scroll frame is not allowed to read. Call after a
   * resize or a navigation, never from the scroll handler.
   */
  private measureViewport(): void {
    if (!this.isBrowser) return;
    this.cachedViewportW = window.innerWidth;
    this.cachedScrollable = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
  }

  handleScroll(): void {
    if (!this.isBrowser) return;

    const scrollY = window.scrollY;
    this.updateScrollProgress(scrollY);

    // Compact on the way down, full again on the way up, with a deadband so a
    // jittery trackpad cannot oscillate the bar.
    if (this.cachedViewportW > HeaderComponent.MOBILE_NAV_BREAKPOINT) {
      if (this.compact) {
        this.compact = false;
        this.ngZone.run(() => this.cdr.markForCheck());
      }
      return;
    }

    const delta = scrollY - this.lastScrollY;
    let next = this.compact;
    if (scrollY <= 24) next = false;
    else if (delta > 4) next = true;
    else if (delta < -4) next = false;
    if (Math.abs(delta) > 1) this.lastScrollY = scrollY;

    if (next !== this.compact) {
      this.compact = next;
      this.ngZone.run(() => this.cdr.markForCheck());
      window.requestAnimationFrame(() => this.updateHeaderOffset());
    }
  }

  private updateScrollProgress(scrollY: number): number {
    if (!this.navbarEl || !this.isBrowser) return 0;
    const scrollable = this.cachedScrollable;
    const progress = scrollable > 0 ? Math.min(100, (scrollY / scrollable) * 100) : 0;
    this.navbarEl.style.setProperty('--scroll-progress', `${progress}%`);
    return progress;
  }

  private updateHeaderOffset(): void {
    if (!this.navbarEl || !this.isBrowser) return;

    const desktop = window.innerWidth > HeaderComponent.MOBILE_NAV_BREAKPOINT;
    if (desktop) {
      if (this.lastNavHeight !== 0) {
        this.lastNavHeight = 0;
        document.documentElement.style.setProperty('--nav-h', '0px');
      }
      document.documentElement.style.setProperty('--gftabs-h', '0px');
      document.documentElement.style.setProperty(
        '--shell-sidebar-w',
        `${HeaderComponent.DESKTOP_SIDEBAR_W}px`,
      );
      if (this.lastHeaderOffset !== HeaderComponent.DESKTOP_HEADER_OFFSET) {
        this.lastHeaderOffset = HeaderComponent.DESKTOP_HEADER_OFFSET;
        document.documentElement.style.setProperty(
          '--header-offset',
          `${HeaderComponent.DESKTOP_HEADER_OFFSET}px`,
        );
      }
      return;
    }

    document.documentElement.style.setProperty('--shell-sidebar-w', '0px');
    document.documentElement.style.setProperty(
      '--gftabs-h',
      `${HeaderComponent.MOBILE_TAB_BAR_H}px`,
    );

    const measuredHeight = this.navbarEl.offsetHeight;
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

  // ── Tome ──────────────────────────────────────────────────────────────

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.setBodyScrollLock(this.mobileMenuOpen);
    this.syncTomeOverlay();
  }

  closeMobileMenu(): void {
    if (!this.mobileMenuOpen) return;
    this.mobileMenuOpen = false;
    this.setBodyScrollLock(false);
    this.syncTomeOverlay();
  }

  private syncTomeOverlay(): void {
    if (this.mobileMenuOpen) {
      if (!this.tomeUnreg) {
        this.tomeUnreg = this.overlays.push('header-tome', () => this.closeMobileMenu());
      }
      return;
    }
    this.tomeUnreg?.();
    this.tomeUnreg = undefined;
  }

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
    window.scrollTo({ top: this.lockedScrollY, behavior: 'auto' });
  }
}
