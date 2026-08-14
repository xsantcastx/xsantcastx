/**
 * landing.component.ts — /world.
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
import { Subscription } from 'rxjs';
import { TranslationService } from '../translation.service';
import { FIVE_REALMS, type NarrativeRealm } from '../shared/narrative/five-realms.narrative';
import { continueFromWorld } from '../shared/narrative/continue-journey';
import { PUBLIC_CODEX_EGGS } from '../shared/easter-eggs/easter-egg.service';
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

/** One realm station on the World door. Narrative places, not tool domains. */
export interface ForgeStation {
  readonly realm: NarrativeRealm;
}

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
  private xpSub?: Subscription;
  private ecoSub?: Subscription;
  private runeSub?: Subscription;
  private scrollSub?: Subscription;

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

  /** Five narrative places, in approved opening order. */
  readonly stations: ForgeStation[] = FIVE_REALMS.map(realm => ({ realm }));
  readonly journey = continueFromWorld();

  /**
   * Which station is open. One at a time: five expanded realms is a wall of 30
   * cards, and the point of the accordion is that the visitor picks a realm.
   * Luminous opens by default so the section is never a row of shut doors.
   */
  openRealmId: string = FIVE_REALMS[0].id;

  /** Realm the pointer is over, which brightens that station. */
  hoveredRealmId: string | null = null;

  // ─── The Forge's Pulse ────────────────────────────────────────────────
  // Every stat is derived from the thing it counts, so none of them can drift
  // into a marketing number that no longer matches the site.

  /** Registered easter eggs. */
  readonly fragmentCount = PUBLIC_CODEX_EGGS.length;

  // ── The Rune Forge band ────────────────────────────────────────────────────
  // Totals come from the registries, so the denominators are correct on the
  // server and can never drift from the tables themselves. The numerators are
  // browser-only and read zero during prerender, which is the honest thing for
  // a crawler to index and the same contract the wallet and the rank keep.
  readonly runesTotal = RUNES.length;
  readonly scrollsTotal = LORE_SCROLLS.length;
  readonly runewordsTotal = RUNEWORDS.length;
  runesFound = 0;
  scrollsFound = 0;
  runewordsCrafted = 0;
  /** Realms the World introduces. */
  readonly realmCount = FIVE_REALMS.length;

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
    void this.xpService.init();
    this.xpSub = this.xpService.snapshot$.subscribe(snap => { this.xp = snap; });

    // Same shape for the wallet: idempotent init, then the hero's standing
    // panel tracks Gold and Essence as the ambient forge ticks them.
    this.economyService.init();
    this.ecoSub = this.economyService.snapshot$.subscribe(eco => { this.eco = eco; });

    // The Rune Forge band's three counts. Both services are idempotent and
    // browser-guarded, and both replay, so this is correct whether the visitor
    // has never opened the forge or has been striking it for a month.
    this.runeForge.init();
    this.runeSub = this.runeForge.snapshot$.subscribe(snap => {
      this.runesFound = snap.unique;
      this.runewordsCrafted = snap.crafted.length;
    });
    this.scrolls.init();
    this.scrollSub = this.scrolls.changed$.subscribe(() => {
      this.scrollsFound = this.scrolls.foundCount;
    });
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
    this.runeSub?.unsubscribe();
    this.scrollSub?.unsubscribe();
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

  /** Scrolls to the realm stations on this page. */
  enterTheForge(): void {
    if (!this.isBrowser) return;
    const el = document.getElementById('world-realms');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
