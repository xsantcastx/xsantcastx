import { Component, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SeoService } from './seo.service';
import { GlobalEggTriggersService } from './shared/easter-eggs/global-egg-triggers.service';
import { XpWiringService } from './shared/gamification/xp-wiring.service';
import { PageAtmosphereService } from './shared/atmosphere/atmosphere.service';
import { QuestWiringService } from './shared/quests/quest-wiring.service';
import { ChallengeWiringService } from './shared/challenges/challenge-wiring.service';
import { EconomyWiringService } from './shared/economy/economy-wiring.service';
import { RpgWiringService } from './shared/rpg/rpg-wiring.service';
import { CollectionWiringService } from './shared/collection/collection-wiring.service';
import { IdleService } from './shared/idle/idle.service';
import { CodexSecretsService } from './codex/codex-secrets.service';
import { scheduleAppCheck } from './app-check.bootstrap';
import { GameStateGateway } from './shared/save/game-state.gateway';
import { applyRealmEra } from './shared/save/realm-era';
import { OnboardingService } from './shared/onboarding/onboarding.service';
import { OfflineService } from './shared/offline/offline.service';
import { XpService } from './shared/gamification/xp.service';
import { AnalyticsService } from './analytics.service';
import { CloudSaveService } from './shared/cloud-save/cloud-save.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'xsantcastx';
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private eggTriggers = inject(GlobalEggTriggersService);
  private xpWiring = inject(XpWiringService);
  private atmosphere = inject(PageAtmosphereService);
  private questWiring = inject(QuestWiringService);
  private challengeWiring = inject(ChallengeWiringService);
  private economyWiring = inject(EconomyWiringService);
  private rpgWiring = inject(RpgWiringService);
  private collectionWiring = inject(CollectionWiringService);
  private idle = inject(IdleService);
  private codexSecrets = inject(CodexSecretsService);
  private readonly saves = inject(GameStateGateway);
  /*
   * Injected as a field, and that placement is load-bearing.
   *
   * OnboardingService answers "has this browser ever been here" by reading two
   * localStorage keys once, at construction. Field injection runs during
   * AppComponent's own construction — before ngOnInit, and therefore before
   * `xpWiring.init()` pays out for the landing route and `economyWiring.init()`
   * settles idle Gold. Both of those write, so a service constructed any later
   * would read a save this page load had just created and conclude the visitor
   * was a returning one. The tutorial would then never show to anybody.
   */
  private readonly onboarding = inject(OnboardingService);
  /*
   * Field-injected for the same reason OnboardingService is, and it matters
   * more here. This service reads three things at construction that everything
   * below is about to overwrite: the last-seen stamp, the quest board's day key
   * and the Contract Board's day key. `questWiring.init()` and
   * `challengeWiring.init()` roll both boards over — a service constructed any
   * later would read today's key off a board that had just been redrawn and
   * conclude nothing had reset while the visitor was away.
   */
  private readonly offline = inject(OfflineService);
  private readonly xp = inject(XpService);
  private readonly analytics = inject(AnalyticsService);
  /*
   * Cloud save has to be resumed by the shell, on every load. It used to be
   * resumed by the header's sign-in chip, which was on every page; the
   * game-only shell (86cfee98) deleted that chip, and the only remaining host,
   * <app-cloud-save-button>, lives in the lazy Account panel. So a device that
   * was already signed in never re-attached to Firestore unless the player
   * happened to open Account & settings: nothing it played was pushed, nothing
   * another device pushed was pulled, and a redirect sign-in (the phone
   * fallback) came back to a page that never read its result. See
   * docs/handoff/cross-save.md.
   */
  private readonly cloudSave = inject(CloudSaveService);

  /** Funnel subscriptions, torn down with the shell. */
  private readonly funnelSubs = new Subscription();

  constructor(private seo: SeoService) {}

  /**
   * The template reads this about twenty times per change-detection pass, and
   * on /play the HUD runs a pass ten to fifteen times a second. `router.url`
   * serialises the whole URL tree on every read, which made this getter one of
   * the biggest allocators on the game screen (docs/handoff/play-perf.md). The
   * answer only changes when the navigation or the committed router state
   * does: the router replaces `routerState` together with the URL tree it
   * serialises, so either object's identity is a sound cache key.
   */
  private playModeKey: object | null = null;
  private playModeValue = false;
  get isPlayMode(): boolean {
    const navigation = this.router.getCurrentNavigation();
    const key: object = navigation ?? this.router.routerState;
    if (key !== this.playModeKey) {
      const url = navigation?.extractedUrl.toString() ?? this.router.url;
      this.playModeValue = url.split(/[?#]/)[0].startsWith('/play');
      this.playModeKey = key;
    }
    return this.playModeValue;
  }

  ngOnInit() {
    this.seo.init();

    if (!isPlatformBrowser(this.platformId)) return;

    applyRealmEra(this.saves);

    // Queue Firebase App Check for the first idle window. Initializing it at
    // bootstrap dragged ~333 kB of reCAPTCHA into the critical path of every
    // route; see app-check.bootstrap.ts.
    scheduleAppCheck();

    // Initialize global easter egg triggers
    this.eggTriggers.init();

    // The RPG layer hydrates ahead of the economy for the same reason the
    // economy hydrates ahead of progression: the XP multiplier installed inside
    // `economyWiring.init()` now reads Wisdom and equipped `xpBonus`, and the
    // first award of a full page load happens synchronously inside
    // `xpWiring.init()` a few lines below. Stats read from an unhydrated store
    // are all zero, so a visitor with twenty points of Wisdom would be paid the
    // unbonused amount for the landing route on every reload — the same bug the
    // Fragment of the First Sun had, in the same place, for the same reason.
    //
    // It also puts the flat Gold/sec mirror in the ledger before the first idle
    // settlement prices the time since the last visit.
    this.rpgWiring.init();

    // The Godforge economy goes first, ahead of progression, because it owns
    // the XP multiplier that enchantments and artifacts are sold on. XpService
    // pays out for the landing route synchronously inside `xpWiring.init()`,
    // so a multiplier installed after it would miss the first award of every
    // full page load — measurably: a visitor holding the Fragment of the First
    // Sun was paid 5 XP for the landing page instead of 10.
    //
    // It calls `xp.init()` itself before reading the rank, so ordering it here
    // does not cost progression its own hydration; XpService.init() is
    // idempotent and the call below is then a no-op.
    this.economyWiring.init();

    // The Collection Log. After both the economy and the RPG layer, and not by
    // preference: its one-time backfill reads the bag, the material stacks, the
    // owned artifacts and the crafted Runewords, and a bag that has not hydrated
    // reports nothing held — the log would credit a two-month-old save with none
    // of it and then mark itself backfilled, permanently.
    this.collectionWiring.init();

    // Progression: hydrate XP from localStorage, settle the daily streak and
    // subscribe the ledger to route changes, copies and egg discoveries.
    this.xpWiring.init();

    // Per-route atmosphere: give every page the colour of the part of the
    // Godforge it stands in. After xpWiring.init() on purpose — /forge-keeper's
    // wash is the visitor's own realm, so the first paint should already have
    // the hydrated Aether/Nox balance rather than the 50/50 default.
    this.atmosphere.init();

    // Mission board: roll the daily and weekly quests over, and start turning
    // interactions into quest progress and lore unlocks.
    this.questWiring.init();

    // Contract Board: the Gold ladder. After questWiring on purpose — both
    // subscribe to the router, and the quest board's page set is the one that
    // has to be canonicalised first, since a challenge counting tool routes
    // reads the same canonicaliser and would otherwise seed it mid-navigation.
    this.challengeWiring.init();

    // Ambient forge: start the visible-time heartbeat. Gated on the Page
    // Visibility API, so a backgrounded tab earns nothing.
    this.idle.init();

    // Codex: load the secrets that are not easter eggs (the places with no
    // sign; the side-scroller reports each one opened). Loaded here so a find
    // is recorded the moment it happens, not the next time the Codex opens.
    this.codexSecrets.init();

    // Cloud save: resume sync on a browser that is already signed in, and
    // finish a redirect sign-in that has just come back from Google. After
    // every hydrating init() above, so the pull reconciles against loaded
    // state. A no-op (one localStorage read) for a visitor who never signed
    // in, and its network work waits for an idle callback — except straight
    // after a redirect, where the visitor is waiting on it.
    this.cloudSave.init();

    // ── Acquisition funnel and the first-run tutorial ────────────────────
    //
    // Last in ngOnInit on purpose. `shouldOnboard()` is answered from the
    // snapshot the service took at construction (see the field above), so the
    // decision is unaffected by everything that has just hydrated — but the
    // *overlay* wants a live economy, a live quest board and a hydrated rank
    // behind it, and those are what the twelve init() calls above provide.
    this.startFunnel();

    // ── While you were away ──────────────────────────────────────────────
    //
    // Dead last, after every init() above it, and that is the whole contract:
    // the Gold line on the summary is the receipt `economyWiring.init()` left
    // behind rather than a second calculation, and the two board rollovers are
    // read against keys captured before `questWiring` and `challengeWiring`
    // redrew them.
    //
    // Deliberately not awaited. It resolves two dynamic imports in the worst
    // case, and the page must not wait on a screen about rewards that are
    // already banked. Its own failures are contained — see the service.
    void this.offline.settle();
  }

  /**
   * Raise the tutorial for a new browser, and wire the three funnel events that
   * are properties of the session rather than of any one component.
   *
   * Every `track*` call below is consent- and DNT-gated inside AnalyticsService
   * and is a no-op on the server, so there is no second guard here.
   */
  private startFunnel(): void {
    if (this.isPlayMode) return;

    if (this.onboarding.shouldOnboard()) {
      this.analytics.trackOnboardingStart();
      this.onboarding.start();
    } else if (this.onboarding.hasRecord()) {
      // A return visit is a session that began with a tutorial already behind
      // it. Read from the streak the XP ledger has just settled, so "day 4" is
      // the ledger's own count rather than a second one kept here that could
      // disagree with the one the visitor sees.
      this.funnelSubs.add(
        this.xp.snapshot$.subscribe(snap => {
          if (this.returnLogged) return;
          this.returnLogged = true;
          this.analytics.trackReturnVisit(snap.streak);
        }),
      );
    }

    // Rank-ups, from the ledger's own award stream rather than by watching the
    // snapshot for a level change: `gain$` already carries the `levelUp` flag
    // and the rank that was reached, and diffing snapshots would also fire on
    // the hydration that merely *reveals* a rank earned in an earlier session.
    this.funnelSubs.add(
      this.xp.gain$.subscribe(gain => {
        if (gain.levelUp) this.analytics.trackRankUp(gain.level.title, gain.level.level);
      }),
    );
  }

  /** `return_visit` is one event per session, not one per snapshot replay. */
  private returnLogged = false;

  ngOnDestroy(): void {
    this.funnelSubs.unsubscribe();
  }
}
