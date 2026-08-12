/**
 * landing.component.ts — /home.
 *
 * Four sections: the hero, the five realms, the pulse, the closing call. What
 * this component used to also own — a shop-counter row, a creed row, a featured
 * tool spotlight, a "watch AI build" panel, the changelog feed and a newsletter
 * form — went with those sections. Every one of them was a second source of
 * truth for something another page already owned, and the state they needed
 * (a Firestore changelog subscription, a lazy Firestore handle for subscriber
 * writes, a random spotlight index, a category filter and a search box that no
 * markup on this page had rendered in months) went with them.
 *
 * What is left reads from registries and two progression services and stores
 * nothing of its own.
 */
import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { getLiveTools, getFeaturedTools } from '../tools/tools-registry';
import { Subscription } from 'rxjs';
import { TranslationService } from '../translation.service';
import { REALMS, RealmDefinition, realmForCategory } from '../shared/realms/realm.model';
import { EASTER_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { XpService, XpSnapshot } from '../shared/gamification/xp.service';
import { rankSigil } from '../shared/gamification/gamification.model';
import { EconomyService, EconomySnapshot } from '../shared/economy/economy.service';
import { formatCurrency } from '../shared/economy/economy.model';
import { PRERENDERED_PATHS } from '../prerender-stats';
import { RouterModule } from '@angular/router';
import { AdsenseComponent } from '../shared/adsense/adsense.component';

export interface Tool {
  id: string;
  name: string;
  desc: string;
  route: string;
  category: string;
  icon: string;
  features: string[];
  tags: string[];
}

/**
 * One forge station: a realm, the tools that hang in it, and the counts the
 * header needs. `shown` is a slice of `total` — the homepage is a doorway, not
 * the catalogue, and /tools?realm=<id> is where the rest live.
 */
export interface ForgeStation {
  readonly realm: RealmDefinition;
  readonly shown: Tool[];
  readonly total: number;
  readonly hidden: number;
}

/**
 * Tools listed per realm on the homepage. Five realms × this = the upper bound
 * on cards in the DOM, which is what keeps the accordion cheap: collapsed
 * stations stay in the markup (crawlers follow the links, the toggle only
 * hides them) rather than being conditionally rendered.
 */
export const FORGE_STATION_SIZE = 6;

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
  standalone: true,
  imports: [RouterModule, AdsenseComponent]
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private translationService = inject(TranslationService);
  private readonly xpService = inject(XpService);
  private readonly economyService = inject(EconomyService);
  private xpSub?: Subscription;
  private ecoSub?: Subscription;

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  /**
   * Progression, for the hero welcome and the closing call.
   *
   * Seeded from the service's current value so the server renders a coherent
   * level-1 state during prerender (ProgressStorageService hands back a null
   * adapter there, so nothing touches localStorage), and the real numbers
   * arrive on the client once XpService.init() has read storage.
   */
  xp: XpSnapshot = this.xpService.snapshot;
  /** Exposed for the hero + journey rank sigils. */
  readonly rankSigil = rankSigil;

  /** Derive landing-page Tool view models from the single registry source of truth */
  readonly tools: Tool[] = getLiveTools().map(t => ({
    id: t.id,
    name: t.title,
    desc: t.description,
    route: t.route,
    category: t.category,
    icon: t.textIcon,
    features: t.features,
    tags: t.tags,
  }));

  /** Featured tools, for the recommendation in the closing call. */
  private readonly featuredTools: Tool[] = getFeaturedTools().map(t => ({
    id: t.id,
    name: t.title,
    desc: t.description,
    route: t.route,
    category: t.category,
    icon: t.textIcon,
    features: t.features,
    tags: t.tags,
  }));

  /**
   * The five forge stations, in codex order.
   *
   * Each realm shows its newest tools (the registry is append-ordered, so the
   * tail is the freshest work) and reports how many more are behind the
   * "browse the realm" link. Built once at construction — the registry is a
   * compile-time constant, so there is nothing here to recompute.
   */
  readonly stations: ForgeStation[] = REALMS.map(realm => {
    const inRealm = this.tools.filter(t => realmForCategory(t.category).id === realm.id);
    const shown = inRealm.slice(-FORGE_STATION_SIZE).reverse();
    return {
      realm,
      shown,
      total: inRealm.length,
      hidden: Math.max(0, inRealm.length - shown.length),
    };
  });

  /**
   * Which station is open. One at a time: five expanded realms is a wall of 30
   * cards, and the point of the accordion is that the visitor picks a realm.
   * Luminous opens by default so the section is never a row of shut doors.
   */
  openRealmId: string = REALMS[0].id;

  /** Realm the pointer is over, which brightens that station. */
  hoveredRealmId: string | null = null;

  // ─── The Forge's Pulse ────────────────────────────────────────────────
  // Every stat is derived from the thing it counts, so none of them can drift
  // into a marketing number that no longer matches the site.

  /** Tools live in the registry. */
  readonly artifactCount = this.tools.length;
  /** Routes Angular prerenders to static HTML — regenerated at every build. */
  readonly prerenderedPaths = PRERENDERED_PATHS;
  /** Registered easter eggs. */
  readonly fragmentCount = EASTER_EGGS.length;
  /** Realms in the codex. */
  readonly realmCount = REALMS.length;

  /**
   * Wallet, for the hero's standing panel. Seeded from the service's current
   * value so the server renders a coherent zero state during prerender; the
   * visitor's real numbers arrive after hydration.
   */
  eco: EconomySnapshot = this.economyService.snapshot;

  get gold(): string { return formatCurrency(this.eco.gold); }
  get essence(): string { return formatCurrency(this.eco.essence); }
  /** The XP the next rank begins at, for the "1,364 / 2,500" readout. */
  get xpTarget(): number { return this.xp.next ? this.xp.next.minXp : this.xp.xp; }

  ngOnInit(): void {
    this.addHeroPreloads();
    this.markArtRoute(true);

    // No-ops on the server; on the client this reads stored progress and
    // settles the daily streak, then pushes the real rank into the hero.
    // Fire-and-forget: `hasForged` and `recommendedTool` are template getters, so
    // the snapshot subscription below re-renders them once storage resolves.
    void this.xpService.init();
    this.xpSub = this.xpService.snapshot$.subscribe(snap => { this.xp = snap; });

    // Same shape for the wallet: idempotent init, then the hero's standing
    // panel tracks Gold and Essence as the ambient forge ticks them.
    this.economyService.init();
    this.ecoSub = this.economyService.snapshot$.subscribe(eco => { this.eco = eco; });
  }


  /**
   * Preload the hero art into THIS route's document.
   *
   * Not in index.html: that file backs every route, so a preload there makes
   * /tools, /codex and eighteen others fetch a 286kB hero they never paint.
   * Written here, it lands in the prerendered /home HTML and nowhere else.
   *
   * One link per breakpoint with the same `media` as the <picture>'s sources,
   * so the preload resolves to the same file the element will choose — a bare
   * href would preload the 1920 frame and then the phone would fetch the 768
   * one as well, downloading the hero twice.
   */
  private static readonly HERO_PRELOADS: ReadonlyArray<{ href: string; media: string }> = [
    { href: 'assets/images/godforge-hero-768.webp',  media: '(max-width: 768px)' },
    { href: 'assets/images/godforge-hero-1280.webp', media: '(min-width: 768.02px) and (max-width: 1280px)' },
    { href: 'assets/images/godforge-hero-1920.webp', media: '(min-width: 1280.02px)' }
  ];

  private addHeroPreloads(): void {
    const head = this.doc.head;
    if (!head || head.querySelector('link[data-gf-hero]')) return;
    for (const p of LandingComponent.HERO_PRELOADS) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'preload');
      link.setAttribute('as', 'image');
      link.setAttribute('type', 'image/webp');
      link.setAttribute('media', p.media);
      link.setAttribute('href', p.href);
      link.setAttribute('data-gf-hero', '');
      head.appendChild(link);
    }
  }

  private removeHeroPreloads(): void {
    this.doc.head?.querySelectorAll('link[data-gf-hero]').forEach(el => el.remove());
  }


  /**
   * Marks the document while the art-backed homepage is on screen.
   *
   * The site's CSS atmosphere — the body gradient, the nebula wash in
   * body::before, the starfield in body::after, the matrix layer, the pulsar,
   * the corner runes, the particle layer and the constellation canvas — is the
   * backdrop for every route that has no artwork of its own. Here it is
   * competing with the painting, so it is switched off for this route only.
   *
   * Set from the component rather than AppComponent because AppComponent's
   * ngOnInit returns early on the server; written here it lands in the
   * prerendered /home HTML, so the atmosphere never paints and then vanishes
   * on hydration.
   */
  private static readonly ART_ROUTE_CLASS = 'gf-art-route';

  private markArtRoute(add: boolean): void {
    const body = this.doc.body;
    if (!body) return;
    if (add) body.classList.add(LandingComponent.ART_ROUTE_CLASS);
    else body.classList.remove(LandingComponent.ART_ROUTE_CLASS);
  }

  ngOnDestroy(): void {
    this.removeHeroPreloads();
    this.markArtRoute(false);
    this.xpSub?.unsubscribe();
    this.ecoSub?.unsubscribe();
  }

  // Perf: trackBy fns prevent Angular from tearing down/rebuilding DOM nodes
  // on change detection. Critical for the tool grid where the arrays are stable
  // but the parent component re-renders frequently.
  trackToolById(_index: number, tool: Tool): string {
    return tool.id;
  }

  trackStation(_index: number, station: ForgeStation): string {
    return station.realm.id;
  }

  // ─── The Forges ───────────────────────────────────────────────────────

  isStationOpen(station: ForgeStation): boolean {
    return this.openRealmId === station.realm.id;
  }

  /**
   * Open a station, or shut the open one.
   *
   * Closing the last open station is allowed — a visitor who wants the page
   * quiet should be able to have it quiet — so this can leave every station
   * shut, which is why `openRealmId` is a plain string and not a RealmId.
   */
  toggleStation(station: ForgeStation): void {
    this.openRealmId = this.isStationOpen(station) ? '' : station.realm.id;
  }

  /** Brightest station: the one under the pointer, else the open one. */
  isStationLit(station: ForgeStation): boolean {
    return this.hoveredRealmId
      ? this.hoveredRealmId === station.realm.id
      : this.isStationOpen(station);
  }

  /**
   * True once this visitor has actually used the tool.
   *
   * Local to this browser and never rendered on the server — it marks a card
   * the visitor has already struck, not a global usage count. The site has no
   * per-tool analytics it could show here without inventing one.
   */
  hasForged(tool: Tool): boolean {
    return this.xpService.hasUsedTool(tool.id);
  }

  /**
   * Where "Enter the Forge" goes. Scrolls rather than routes: the forges are
   * on this page, and a hash jump would fight the scroll-reveal observer.
   *
   * The target id is "services", not "forges" — historical, and kept because
   * the anchor is linked from outside this component.
   */
  enterTheForge(): void {
    if (!this.isBrowser) return;
    const el = document.getElementById('services');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * The tool suggested in the closing call.
   *
   * The first featured tool this visitor has not opened yet — a recommendation
   * drawn from what they have actually done, not a popularity claim we have no
   * analytics to back. Falls back to the flagship once they have used them all.
   */
  get recommendedTool(): Tool {
    return this.featuredTools.find(t => !this.xpService.hasUsedTool(t.id))
      ?? this.featuredTools[0]
      ?? this.tools[0];
  }
}
