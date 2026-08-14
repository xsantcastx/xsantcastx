/**
 * header.component.ts — the Godforge command bar, the mobile tome, and the
 * mobile bottom tab bar.
 *
 * Three surfaces, one piece of nav state, because they are three views of the
 * same thing and splitting them across components would mean three copies of
 * "is the drawer open" to keep in step.
 *
 *  · Desktop: sigil + XSANTCASTX lockup, five halls, then the visitor's
 *    standing (Gold, Essence, rank) and the language toggle.
 *  · Mobile: the bar keeps the lockup and the status pills; primary
 *    navigation moves to a fixed five-tab bar at the bottom of the viewport,
 *    and the hamburger opens the tome for everything secondary.
 *
 * What survived earlier passes, because the reasons still hold:
 *  · --nav-h is measured and published so the tome can sit flush under a bar
 *    whose height includes env(safe-area-inset-top) on notched devices.
 *  · The scroll listener runs OUTSIDE the Angular zone and re-enters only on
 *    the frames where a template-bound value actually changed.
 *  · The tome closes on Escape, on NavigationEnd, and on a resize past the
 *    breakpoint; the body scroll lock takes the body out of flow, the only
 *    technique iOS Safari honours, and restores the offset on unlock.
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
import { XpService, XpSnapshot } from '../shared/gamification/xp.service';
import { rankSigil } from '../shared/gamification/gamification.model';
import { EconomyService, EconomySnapshot } from '../shared/economy/economy.service';
import { formatCurrency } from '../shared/economy/economy.model';

/** A hall: a real route with a label key and a drawn glyph id. */
interface Hall {
  route: string;
  key: string;
  /** Picks the CSS-drawn rune; see .gfrune--<glyph> in the stylesheet. */
  glyph: string;
  hintKey?: string;
  /**
   * When this hall leaves the bar as the row runs short — see the
   * `.gfnav__hall--shed-*` rules in the stylesheet.
   *
   * Only ever set on a hall the tome and the footer both carry, so a shed
   * hides a shortcut and never a destination.
   *
   * Two tiers rather than one, because seven halls do not fit a Spanish row at
   * any width a laptop actually has, and dropping both at the same threshold
   * would empty two slots at once on the widths most visitors are using.
   * 'first' goes at 1600, 'second' at 1300; between them the bar carries six.
   */
  shed?: 'first' | 'second';
}

/**
 * A bottom tab. Carries both painted states, because the tab bar cross-fades
 * between them rather than swapping one <img> src — see the note in the
 * template.
 */
interface Tab extends Hall {
  /** Omit both when no tab PNG pair exists — the template draws `.gfrune`. */
  iconInactive?: string;
  iconActive?: string;
}

interface TomeSection {
  titleKey: string;
  halls: Hall[];
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
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);
  private xp = inject(XpService);
  private economy = inject(EconomyService);

  private navbarEl: HTMLElement | null = null;
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;
  private routerSub?: Subscription;
  private langSub?: Subscription;
  private xpSub?: Subscription;
  private ecoSub?: Subscription;
  private lastHeaderOffset = 96;
  private lastNavHeight = -1;
  private lockedScrollY = 0;
  private isScrollLocked = false;
  private scrollRafId: number | null = null;
  private lastScrollY = 0;

  /** Above this width the tome and the tab bar are not rendered. */
  private static readonly MOBILE_NAV_BREAKPOINT = 960;

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
  readonly codexTotal = EASTER_EGGS.length;

  /** Painted rank crest for the level held — exposed for the bar and the tome. */
  readonly rankSigil = rankSigil;

  /**
   * The five halls across the middle of the bar — implemented player
   * destinations only. Tools, Trials, Blueprint, Sanctum and MCP live in the
   * tome's MORE section and the footer.
   */
  readonly primaryHalls: Hall[] = [
    { route: '/world',       key: 'gfnav.world',     glyph: 'home' },
    { route: '/character',   key: 'gfnav.character', glyph: 'profile' },
    { route: '/market',      key: 'gfnav.market',    glyph: 'market' },
    { route: '/forge/runes', key: 'gfnav.forge',     glyph: 'forge' },
    { route: '/codex',       key: 'gfnav.codex',     glyph: 'codex' }
  ];

  /**
   * The five fixed destinations along the bottom of a phone. Market and Forge
   * have no tab PNG pair — those two render the hall glyph instead.
   */
  readonly tabs: Tab[] = [
    { route: '/world',     key: 'gfnav.world',     glyph: 'home',
      iconInactive: 'assets/icons/tabs/home-inactive.png',    iconActive: 'assets/icons/tabs/home-active.png' },
    { route: '/character', key: 'gfnav.character', glyph: 'profile',
      iconInactive: 'assets/icons/tabs/profile-inactive.png', iconActive: 'assets/icons/tabs/profile-active.png' },
    { route: '/market',    key: 'gfnav.market',    glyph: 'market' },
    { route: '/forge/runes', key: 'gfnav.forge',   glyph: 'forge' },
    { route: '/codex',     key: 'gfnav.codex',     glyph: 'codex',
      iconInactive: 'assets/icons/tabs/codex-inactive.png',   iconActive: 'assets/icons/tabs/codex-active.png' }
  ];

  /**
   * MAIN is the same five halls as the bar. MORE is demoted product surfaces
   * that still have real pages — never a redirect stub.
   */
  readonly tomeSections: TomeSection[] = [
    {
      titleKey: 'gfnav.section.main',
      halls: [
        { route: '/world',       key: 'gfnav.world',     glyph: 'home',    hintKey: 'gfnav.hint.world' },
        { route: '/character',   key: 'gfnav.character', glyph: 'profile', hintKey: 'gfnav.hint.keeper' },
        { route: '/market',      key: 'gfnav.market',    glyph: 'market',  hintKey: 'gfnav.hint.market' },
        { route: '/forge/runes', key: 'gfnav.forge',     glyph: 'forge',   hintKey: 'gfnav.hint.runeForge' },
        { route: '/codex',       key: 'gfnav.codex',     glyph: 'codex',   hintKey: 'gfnav.hint.codex' }
      ]
    },
    {
      titleKey: 'gfnav.section.more',
      halls: [
        { route: '/tools',           key: 'gfnav.tools',          glyph: 'tools',     hintKey: 'gfnav.hint.tools' },
        { route: '/world/quests',    key: 'gfnav.quests',         glyph: 'quests',    hintKey: 'gfnav.hint.quests' },
        { route: '/world/trials',    key: 'gfnav.trials',         glyph: 'arena',     hintKey: 'gfnav.hint.arena' },
        { route: '/sanctum',         key: 'gfnav.sanctum',        glyph: 'sanctum',   hintKey: 'gfnav.hint.sanctum' },
        { route: '/blueprint',       key: 'gfnav.warTable',       glyph: 'blueprint', hintKey: 'gfnav.hint.warTable' },
        { route: '/mcp',             key: 'gfnav.mcp',            glyph: 'mcp',       hintKey: 'gfnav.hint.mcp' },
        { route: '/mission-control', key: 'gfnav.missionControl', glyph: 'mission',   hintKey: 'gfnav.hint.missionControl' },
        { route: '/sponsors',        key: 'gfnav.sponsors',       glyph: 'sponsors',  hintKey: 'gfnav.hint.sponsors' },
        { route: '/donate',          key: 'gfnav.donate',         glyph: 'donate',    hintKey: 'gfnav.hint.donate' },
        { route: '/pro',             key: 'gfnav.pro',            glyph: 'donate',    hintKey: 'gfnav.hint.donate' }
      ]
    }
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

  ngOnInit(): void {
    this.langSub = this.translationService.currentLanguage$.subscribe(lang => {
      const changed = this.currentLang !== lang;
      this.currentLang = lang;
      if (changed) this.cdr.markForCheck();
    });
    this.setupScrollListener();

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.closeMobileMenu());

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
      this.xpSub = this.xp.snapshot$.subscribe(s => { this.snap = s; this.cdr.markForCheck(); });
      this.ecoSub = this.economy.snapshot$.subscribe(e => { this.eco = e; this.cdr.markForCheck(); });
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.navbarEl = this.elRef.nativeElement.querySelector('.gfnav');
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
    }
    this.routerSub?.unsubscribe();
    this.langSub?.unsubscribe();
    this.xpSub?.unsubscribe();
    this.ecoSub?.unsubscribe();
    this.setBodyScrollLock(false);
  }

  // ── Escape ────────────────────────────────────────────────────────────

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mobileMenuOpen) {
      this.closeMobileMenu();
      this.cdr.markForCheck();
    }
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
        this.updateHeaderOffset();
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
    this.updateScrollProgress(scrollY);

    // Compact on the way down, full again on the way up, with a deadband so a
    // jittery trackpad cannot oscillate the bar.
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
    const scrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const progress = scrollable > 0 ? (scrollY / scrollable) * 100 : 0;
    this.navbarEl.style.setProperty('--scroll-progress', `${progress}%`);
    return progress;
  }

  private updateHeaderOffset(): void {
    if (!this.navbarEl || !this.isBrowser) return;

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
  }

  closeMobileMenu(): void {
    if (!this.mobileMenuOpen) return;
    this.mobileMenuOpen = false;
    this.setBodyScrollLock(false);
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
