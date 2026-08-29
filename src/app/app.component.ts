import { Component, OnInit, OnDestroy, PLATFORM_ID, NgZone, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SeoService } from './seo.service';
import { EmbedService } from './shared/embed.service';
import { VisitCounterService } from './shared/visit-counter/visit-counter.service';
import { GlobalEggTriggersService } from './shared/easter-eggs/global-egg-triggers.service';
import { XpWiringService } from './shared/gamification/xp-wiring.service';
import { RealmService } from './shared/realms/realm.service';
import { PageAtmosphereService } from './shared/atmosphere/atmosphere.service';
import { QuestWiringService } from './shared/quests/quest-wiring.service';
import { ChallengeWiringService } from './shared/challenges/challenge-wiring.service';
import { EconomyWiringService } from './shared/economy/economy-wiring.service';
import { RpgWiringService } from './shared/rpg/rpg-wiring.service';
import { CollectionWiringService } from './shared/collection/collection-wiring.service';
import { IdleService } from './shared/idle/idle.service';
import { CodexSecretsService } from './codex/codex-secrets.service';
import { InlineFlameService } from './shared/economy/inline-flame.service';
import { scheduleAppCheck } from './app-check.bootstrap';
import { GameStateGateway } from './shared/save/game-state.gateway';
import { applyRealmEra } from './shared/save/realm-era';
import { OnboardingService } from './shared/onboarding/onboarding.service';
import { OfflineService } from './shared/offline/offline.service';
import { XpService } from './shared/gamification/xp.service';
import { AnalyticsService } from './analytics.service';

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
  private ngZone = inject(NgZone);
  readonly embed = inject(EmbedService);
  private visitCounter = inject(VisitCounterService);
  private eggTriggers = inject(GlobalEggTriggersService);
  private xpWiring = inject(XpWiringService);
  private realms = inject(RealmService);
  private atmosphere = inject(PageAtmosphereService);
  private questWiring = inject(QuestWiringService);
  private challengeWiring = inject(ChallengeWiringService);
  private economyWiring = inject(EconomyWiringService);
  private rpgWiring = inject(RpgWiringService);
  private collectionWiring = inject(CollectionWiringService);
  private idle = inject(IdleService);
  private codexSecrets = inject(CodexSecretsService);
  private inlineFlame = inject(InlineFlameService);
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

  /** Funnel subscriptions, torn down with the shell. */
  private readonly funnelSubs = new Subscription();

  // Perf Phase 2: retain a handle to the glitch poll so it can be cancelled
  // and so subsequent hydrations don't stack parallel intervals. Previously
  // this was a fire-and-forget setInterval that never got cleared, which on
  // hot reload in dev (and on any future re-init of AppComponent) would leave
  // orphan DOM queries running on the main thread every 3.5s forever.
  private glitchPollId: ReturnType<typeof setInterval> | null = null;

  /** Watches whether a page has mounted its own flame. See showCornerFlame. */
  private inlineFlameSub: Subscription | null = null;

  constructor(private seo: SeoService) {}

  get isEmbedMode(): boolean {
    return this.embed.isEmbed;
  }

  get showEmbedBranding(): boolean {
    return this.embed.showBranding;
  }

  /**
   * The corner flame stands down while a page mounts its own.
   *
   * Only the Forge View does, and only because the flame is that page's focal
   * point rather than a widget beside it — two clickable flames paying into one
   * ledger is a thing the visitor would have to work out for themselves.
   *
   * Held as a field fed by a subscription rather than read straight off the
   * service in a getter: the inline flame claims during its own `ngOnInit`,
   * which runs inside the change-detection pass that would then re-read this
   * binding, and dev mode reports that as ExpressionChangedAfterItHasBeenChecked.
   * A subscription lands the change on its own pass instead.
   */
  showCornerFlame = true;

  ngOnInit() {
    this.seo.init();

    // Set before the browser guard so the prerendered HTML is correct too: an
    // embed that shipped a flame in its SSR output would paint one for a frame
    // on every embedded tool page.
    this.showCornerFlame = !this.isEmbedMode;

    // Also before the guard, and for the same reason: `data-realm` selects the
    // painted room behind all 126 tool pages. Resolved on the client only, the
    // page would prerender bare and then paint a background the instant the
    // bundle booted. RealmService touches no browser-only API.
    this.realms.init();

    if (!isPlatformBrowser(this.platformId)) return;

    applyRealmEra(this.saves);

    this.inlineFlameSub = this.inlineFlame.active$.subscribe(active => {
      // Deferred by a microtask, and not for style.
      //
      // `claim()` is called from the inline flame's own lifecycle hook, which
      // Angular runs while it is refreshing a child of this component's view —
      // i.e. after `@if (showCornerFlame)` in this template was already checked
      // for this pass. Assigning synchronously therefore changed a binding that
      // had been read a moment earlier, and dev mode reported it on every load
      // of /sanctum as `NG0100 ... Previous value: '21'. Current value: '-1'`,
      // which is the `@if`'s branch index going from "the flame" to "nothing".
      // The site's own error reporter picked it up, so it was also the only
      // console error on the route.
      //
      // A microtask runs after the synchronous change-detection pass has
      // finished and before zone.js reports the queue empty, so the flag moves
      // between passes and the next one renders it without complaint.
      // Deliberately not `requestAnimationFrame`: frames do not run in a
      // background tab, and the corner flame would stay wrong there.
      queueMicrotask(() => {
        this.showCornerFlame = !this.isEmbedMode && !active;
      });
    });

    // Queue Firebase App Check for the first idle window. Initializing it at
    // bootstrap dragged ~333 kB of reCAPTCHA into the critical path of every
    // route; see app-check.bootstrap.ts.
    scheduleAppCheck();

    // Track site visit and trigger milestone celebration if applicable
    this.visitCounter.recordVisit();

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

    // Codex: passively note the secrets that are not easter eggs — ritual mode,
    // the command palette, the unlinked routes. Global rather than page-local so
    // a secret found on /home is recorded on /home, not the next time /codex is
    // opened.
    this.codexSecrets.init();

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

    let glitchPending = false;
    const triggerRandomGlitch = () => {
      if (glitchPending) return;
      glitchPending = true;
      const keywords = Array.from(document.querySelectorAll('.keyword'));
      const candidates = keywords.filter(() => Math.random() < 0.08);
      candidates.forEach((el, i) => {
        setTimeout(() => {
          el.classList.add('glitch');
          setTimeout(() => el.classList.remove('glitch'), 800);
        }, i * 120);
      });
      setTimeout(() => { glitchPending = false; }, candidates.length * 120 + 800);
    };

    // Perf Phase 2: run the glitch poll OUTSIDE the Angular zone. Previously
    // zone-patched setInterval triggered a full change-detection pass every
    // 3.5s even when the early-return short-circuited — on a 114-tool app
    // that's a lot of wasted CD work for a purely cosmetic effect. Also cache
    // the interval id so ngOnDestroy can clear it.
    this.ngZone.runOutsideAngular(() => {
      this.glitchPollId = setInterval(() => {
        if (document.body.classList.contains('glitch-out')) {
          triggerRandomGlitch();
        }
      }, 3500);
    });
  }

  /**
   * Raise the tutorial for a new browser, and wire the three funnel events that
   * are properties of the session rather than of any one component.
   *
   * Every `track*` call below is consent- and DNT-gated inside AnalyticsService
   * and is a no-op on the server, so there is no second guard here.
   */
  private startFunnel(): void {
    if (this.isEmbedMode) return;

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
    if (this.glitchPollId !== null) {
      clearInterval(this.glitchPollId);
      this.glitchPollId = null;
    }
    this.inlineFlameSub?.unsubscribe();
    this.inlineFlameSub = null;
    this.funnelSubs.unsubscribe();
  }
}
