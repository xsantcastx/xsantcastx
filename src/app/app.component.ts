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
import { IdleService } from './shared/idle/idle.service';
import { CodexSecretsService } from './codex/codex-secrets.service';
import { InlineFlameService } from './shared/economy/inline-flame.service';
import { scheduleAppCheck } from './app-check.bootstrap';
import { GameStateGateway } from './shared/save/game-state.gateway';
import { applyRealmEra } from './shared/save/realm-era';

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
  private idle = inject(IdleService);
  private codexSecrets = inject(CodexSecretsService);
  private inlineFlame = inject(InlineFlameService);
  private readonly saves = inject(GameStateGateway);

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
      this.showCornerFlame = !this.isEmbedMode && !active;
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

  ngOnDestroy(): void {
    if (this.glitchPollId !== null) {
      clearInterval(this.glitchPollId);
      this.glitchPollId = null;
    }
    this.inlineFlameSub?.unsubscribe();
    this.inlineFlameSub = null;
  }
}
