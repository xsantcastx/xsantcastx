/**
 * landing.component.ts — /world.
 *
 * Returning-player dashboard over the painted hero. Reads existing progression
 * services and stores nothing of its own. The five-realm accordion stays below
 * so crawlers still see tool links; it is no longer the hero promise.
 */
import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { getLiveTools } from '../tools/tools-registry';
import { Subscription } from 'rxjs';
import { TranslationService } from '../translation.service';
import { REALMS, RealmDefinition, realmForCategory } from '../shared/realms/realm.model';
import { EASTER_EGGS, EasterEggService } from '../shared/easter-eggs/easter-egg.service';
import { XpService, XpSnapshot } from '../shared/gamification/xp.service';
import { rankSigil } from '../shared/gamification/gamification.model';
import { EconomyService, EconomySnapshot } from '../shared/economy/economy.service';
import { formatCurrency } from '../shared/economy/economy.model';
import { RouterModule } from '@angular/router';
import { AdsenseComponent } from '../shared/adsense/adsense.component';
import { RuneForgeService } from '../shared/rune-forge/rune-forge.service';
import { RUNES, RUNEWORDS } from '../shared/rune-forge/rune.model';
import { LoreScrollService } from '../shared/rune-forge/lore-scroll.service';
import { LORE_SCROLLS } from '../shared/rune-forge/lore-scroll.model';
import { QuestBoard, QuestService } from '../shared/quests/quest.service';
import { CloudSaveService, SyncStatus } from '../shared/cloud-save/cloud-save.service';
import { CANONICAL } from '../shared/canonical-routes';
import { continueJourney, JourneyTarget } from './continue-journey';

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

export type WorldAlignment = 'solari' | 'nocturne' | 'convergent';

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
  private readonly runeForge = inject(RuneForgeService);
  private readonly scrolls = inject(LoreScrollService);
  private readonly quests = inject(QuestService);
  private readonly cloud = inject(CloudSaveService);
  private readonly eggs = inject(EasterEggService);
  private readonly subs = new Subscription();

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
  readonly routes = CANONICAL;

  /**
   * False on the browser until xp / economy / quests / runes have hydrated.
   * True on the server so prerender paints honest zeros instead of a spinner.
   */
  ready = !this.isBrowser;

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

  /** Tools live in the registry. */
  readonly artifactCount = this.tools.length;

  // ── The Rune Forge band ────────────────────────────────────────────────────
  // Totals come from the registries, so the denominators are correct on the
  // server and can never drift from the tables themselves. The numerators are
  // browser-only and read zero during prerender, which is the honest thing for
  // a crawler to index and the same contract the wallet and the rank keep.
  readonly runesTotal = RUNES.length;
  readonly scrollsTotal = LORE_SCROLLS.length;
  readonly runewordsTotal = RUNEWORDS.length;
  readonly eggsTotal = EASTER_EGGS.length;
  runesFound = 0;
  scrollsFound = 0;
  runewordsCrafted = 0;
  eggsFound = 0;

  /**
   * Wallet, for the hero's standing panel. Seeded from the service's current
   * value so the server renders a coherent zero state during prerender; the
   * visitor's real numbers arrive after hydration.
   */
  eco: EconomySnapshot = this.economyService.snapshot;
  board: QuestBoard = this.quests.board;
  cloudStatus: SyncStatus = this.cloud.status;

  get gold(): string { return formatCurrency(this.eco.gold); }
  get essence(): string { return formatCurrency(this.eco.essence); }
  /** The XP the next rank begins at, for the "1,364 / 2,500" readout. */
  get xpTarget(): number { return this.xp.next ? this.xp.next.minXp : this.xp.xp; }

  get journey(): JourneyTarget {
    return continueJourney({
      unclaimed: this.board.unclaimed,
      openCount: this.board.openCount,
      toolsUsed: this.xp.toolsUsed,
      runesFound: this.runesFound,
      gold: this.eco.gold,
    });
  }

  /**
   * Same bands as `atmosphereForAetherShare` / the keeper identity card.
   * A new profile sits at 0.5 and is Convergent.
   */
  get alignment(): WorldAlignment {
    const pct = Math.round(this.xp.aetherShare * 100);
    if (pct > 55) return 'solari';
    if (pct < 45) return 'nocturne';
    return 'convergent';
  }

  get aetherPercent(): number {
    return Math.round(this.xp.aetherShare * 100);
  }

  get standingOrders(): string[] {
    return this.board.daily
      .filter(q => q.status !== 'completed')
      .slice(0, 3)
      .map(q => q.title);
  }

  get hasStandingOrders(): boolean {
    return this.board.unclaimed > 0
      || this.board.openCount > 0
      || this.board.daily.length > 0
      || this.board.weekly.length > 0;
  }

  get lastSyncedLabel(): string {
    const at = this.cloudStatus.lastSyncedAt;
    if (at === null) return '';
    try {
      return new Date(at).toLocaleString();
    } catch {
      return '';
    }
  }

  ngOnInit(): void {
    this.addHeroPreloads();
    this.markArtRoute(true);

    this.subs.add(this.xpService.snapshot$.subscribe(snap => { this.xp = snap; }));
    this.subs.add(this.economyService.snapshot$.subscribe(eco => { this.eco = eco; }));
    this.subs.add(this.runeForge.snapshot$.subscribe(snap => {
      this.runesFound = snap.unique;
      this.runewordsCrafted = snap.crafted.length;
    }));
    this.subs.add(this.scrolls.changed$.subscribe(() => {
      this.scrollsFound = this.scrolls.foundCount;
    }));
    this.subs.add(this.quests.board$.subscribe(board => { this.board = board; }));
    this.subs.add(this.cloud.status$.subscribe(status => { this.cloudStatus = status; }));

    if (!this.isBrowser) return;

    this.economyService.init();
    this.quests.init();
    this.runeForge.init();
    this.scrolls.init();
    this.scrollsFound = this.scrolls.foundCount;
    // Resume only — do not start a sign-in or change merge/sync.
    this.cloud.init();
    void this.eggs.init().then(() => { this.eggsFound = this.eggs.foundCount; });
    void this.xpService.init().then(() => { this.ready = true; });
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
    this.subs.unsubscribe();
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

  /** Scrolls to the realm stations on this page. Secondary browse, not the CTA. */
  enterTheForge(): void {
    if (!this.isBrowser) return;
    const el = document.getElementById('world-realms');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
