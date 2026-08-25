/**
 * onboarding.component.ts — the first sixty seconds.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR
 * ─────────────────────────────────────────────────────────────────────────────
 * A stranger who lands on /world sees a painted hero, five realm stations, a
 * pulse band and a closing call — four screens of a persistent world they have
 * no stake in yet. That is the right page for somebody with a save. For
 * somebody without one it is a wall, and the measurable consequence is that
 * they leave without ever striking anything.
 *
 * This replaces that page, once, with five screens that each ask for exactly
 * one thing. By the end the visitor has struck the forge, earned Gold, been
 * given a rank, seen where to walk next, and been told why to come back
 * tomorrow. Then it is gone forever and they get the real page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT IS A SIBLING OF <main> AND NOT PART OF /world
 * ─────────────────────────────────────────────────────────────────────────────
 * Two reasons, and the first is the one that has bitten this repo repeatedly:
 * `routeFadeIn` leaves a transform with `fill: forwards` on every routed host,
 * which makes it a containing block, so a `position: fixed` full-viewport
 * curtain mounted inside LandingComponent would be pinned to the *page* and
 * would scroll away. Every other full-viewport overlay in this app — the boot
 * curtain, the flame, the merge dialog — is mounted out here for exactly this.
 *
 * The second is that a tutorial that only exists on one route dies the moment
 * somebody's first link is to /character or a realm page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT RENDERS NOTHING ON THE SERVER
 * ─────────────────────────────────────────────────────────────────────────────
 * Whether to show this is a question about localStorage, which does not exist
 * during prerender. If the server guessed "new visitor" it would bake the
 * overlay into the prerendered HTML of /world — served to Google, served to
 * every returning visitor, and then torn down on hydration as a visible flash
 * and a hydration mismatch. So `OnboardingService.active` starts false on every
 * platform and is only ever raised from AppComponent after hydration.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { OnboardingService, ONBOARDING_STEPS } from './onboarding.service';
import { EconomyService } from '../economy/economy.service';
import { formatCurrency } from '../economy/economy.model';
import { XpService } from '../gamification/xp.service';
import { LEVELS, rankSigil } from '../gamification/gamification.model';
import { QuestService } from '../quests/quest.service';
import type { Quest } from '../quests/quest.model';
import { npcById } from '../npc/npc.model';
import { AnalyticsService } from '../../analytics.service';
import { TranslationService } from '../../translation.service';

/** One of the two places step 4 offers. Both are real, live routes. */
interface Doorway {
  /**
   * Where it goes.
   *
   * A realm doorway states its realm id and the path is composed from it, the
   * same way `landing.component.html` composes its station links and the same
   * way `REALM_ROUTES` composes the routes themselves. Two reasons, and both
   * matter: the five realm paths have exactly one author, and `audit-nav.js` —
   * which gates the build — reads `path:` string literals, so it never sees the
   * template-literal paths REALM_ROUTES generates and reports a hard-coded
   * `/world/realms/infernal` as a dead link.
   */
  realm?: string;
  /** For a doorway that is not a realm. Must be a literal route the audit can see. */
  path?: string;
  titleKey: string;
  bodyKey: string;
  /** Realm id for the accent, or 'forge' for the ember. */
  accent: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css'],
})
export class OnboardingComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly onboarding = inject(OnboardingService);
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly quests = inject(QuestService);
  private readonly analytics = inject(AnalyticsService);
  private readonly i18n = inject(TranslationService);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private questSub?: Subscription;

  readonly active = this.onboarding.active;
  readonly step = this.onboarding.step;
  readonly totalSteps = ONBOARDING_STEPS;

  /** `[1, 2, 3, 4, 5]`, for the progress dots. */
  readonly dots = Array.from({ length: ONBOARDING_STEPS }, (_, i) => i + 1);

  /**
   * Kael, read from the cast rather than restated here.
   *
   * His portrait has not been painted — `artId: 'npc-kael'` is registered in
   * ART_PENDING and resolves to null — so this renders the same placeholder orb
   * the NPC dialogue widget does, from his monogram and accent colour. Writing
   * an `assets/` path for a painting that does not exist is how this repo has
   * shipped broken images before; when the portrait lands it will arrive
   * through the asset manifest and this will pick it up with the rest.
   */
  readonly kael = npcById('kael')!;

  /** Gold earned by the tutorial's own strike. 0 until they hit it. */
  readonly struck = signal(0);
  readonly hasStruck = computed(() => this.struck() > 0);

  /** The first rank, and the one after it. Read from the table, never restated. */
  readonly rank = LEVELS[0];
  readonly nextRank = LEVELS[1];
  readonly rankArt = rankSigil(1);
  readonly nextRankArt = rankSigil(2);

  /** One daily quest to show as tomorrow's reason to return. */
  readonly previewQuest = signal<Quest | null>(null);

  /**
   * Where step 4 points.
   *
   * Both are live routes on the current product. This is where the brief asked
   * for two "hero tools" — that product was retired before this branch, its
   * components are deleted, `/tools/:slug` 301s to /world, and `audit-nav.js`
   * fails the build on any player-facing link into it. These are the two places
   * that actually reward a first-time visitor: the one realm chapter that is
   * playable, and the forge that turns the Gold they just earned into a rune.
   */
  readonly doorways: readonly Doorway[] = [
    {
      realm: 'infernal',
      titleKey: 'onboarding.door.infernal.title',
      bodyKey: 'onboarding.door.infernal.body',
      accent: 'infernal',
    },
    {
      path: '/forge/runes',
      titleKey: 'onboarding.door.forge.title',
      bodyKey: 'onboarding.door.forge.body',
      accent: 'forge',
    },
  ];

  /** The URL a doorway leads to. See the note on `Doorway.realm`. */
  private routeFor(door: Doorway): string {
    return door.realm ? '/world/realms/' + door.realm : door.path!;
  }

  constructor() {
    // Every step change is a funnel event. An effect rather than a call inside
    // next(): the step signal is also moved by the dots and by finish(), and a
    // funnel that only counts one of the three paths is worse than none.
    effect(() => {
      if (!this.active()) return;
      this.analytics.trackOnboardingStep(this.step());
    });

    // The curtain owns the scroll while it is up. Released in ngOnDestroy too,
    // so a teardown mid-run cannot leave the page permanently unscrollable.
    effect(() => this.lockScroll(this.active()));
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    // Both are idempotent and browser-guarded. The wallet has to be live before
    // step 2 can pay, and the board before step 5 can show what it is holding.
    this.economy.init();
    this.quests.init();
    this.watchCookieBanner();
    this.questSub = this.quests.board$.subscribe(board => {
      // The first daily that is not already finished. A tutorial that promises
      // "come back for this" and then shows a completed row is worse than
      // showing nothing, and on a fresh browser there is always at least one.
      this.previewQuest.set(board.daily.find(q => !q.claimed) ?? board.daily[0] ?? null);
    });
  }

  ngOnDestroy(): void {
    this.questSub?.unsubscribe();
    this.cookieWatch?.disconnect();
    this.lockScroll(false);
  }

  // ─── The cookie banner ──────────────────────────────────────────────────

  /**
   * How much room the cookie banner is taking at the bottom of the viewport.
   *
   * The banner is full-width at `bottom: 0` and it is the one piece of chrome
   * that cannot be asked to move: consent has to be answerable, and on a phone
   * it is 242px tall — a third of a 812px screen. Measured at 375×812 it covered
   * the progress dots *and* the skip button outright, which made the tutorial's
   * only escape hatch unreachable for exactly the audience this was built for.
   * Escape also skips, and a phone has no Escape.
   *
   * The install banner solves its own overlap with this thing by refusing to
   * render until the visitor has answered. That is right for a banner and wrong
   * for a takeover — a new visitor would get the dashboard first and the
   * tutorial second, which is the problem, not the fix. So this reserves the
   * space instead.
   */
  readonly cookieClear = signal(0);

  private cookieWatch?: MutationObserver;

  /**
   * Watch the banner appear and disappear.
   *
   * A MutationObserver on the banner's own host rather than a ResizeObserver on
   * the banner: the host element persists at zero height for the life of the
   * page and swaps its single child in and out, so `childList` on the host is
   * one cheap observation that catches both the arrival and the dismissal. A
   * ResizeObserver would have to be attached to a child that does not exist yet.
   */
  private watchCookieBanner(): void {
    const host = this.doc.querySelector('app-cookie-banner');
    if (!host) return;
    this.measureCookieBanner();
    this.cookieWatch = new MutationObserver(() => this.measureCookieBanner());
    this.cookieWatch.observe(host, { childList: true });
  }

  private measureCookieBanner(): void {
    const banner = this.doc.querySelector('app-cookie-banner .cookie-banner');
    const height = banner ? banner.getBoundingClientRect().height : 0;
    this.cookieClear.set(Math.round(height));
  }

  translate(key: string): string {
    return this.i18n.translate(key);
  }

  /** Gold earned so far, formatted the same way the flame formats it. */
  goldLabel(): string {
    return formatCurrency(this.struck());
  }

  /** XP needed for the next rank, formatted for the "0 / 10,000" readout. */
  nextRankXp(): string {
    return this.nextRank.minXp.toLocaleString();
  }

  // ─── The one action per screen ──────────────────────────────────────────

  /**
   * Step 2. A real strike through the real ledger, not a mimed one.
   *
   * `EconomyService.strike()` returns null when it lands inside the 500ms
   * cooldown, which is what an excited visitor hitting it four times produces —
   * those are ignored rather than counted as zero, so the readout never flickers
   * back down.
   *
   * The Gold is genuinely banked, which is the point: when the overlay comes
   * down the flame in the corner is already holding it. A tutorial that pays in
   * a number it then throws away teaches the visitor that the numbers here do
   * not mean anything.
   */
  strike(): void {
    const paid = this.economy.strike();
    if (!paid) return;
    const first = !this.hasStruck();
    this.struck.set(this.struck() + paid.gold);
    if (first) this.analytics.trackFirstForgeStrike();
  }

  /** Advance. The dots and the primary button share this. */
  next(): void {
    if (this.step() >= this.totalSteps) {
      this.complete();
      return;
    }
    this.onboarding.next();
    this.focusPanel();
  }

  /** Walked the whole thing. */
  complete(): void {
    this.analytics.trackOnboardingComplete(true, this.totalSteps);
    this.onboarding.finish(this.totalSteps);
  }

  /** The small door, bottom-right. Ends the run and never shows it again. */
  skip(): void {
    this.analytics.trackOnboardingComplete(false, this.step());
    this.onboarding.finish(this.step());
  }

  /**
   * Step 4's buttons: take the door, and end the tutorial on the way through.
   *
   * Finished rather than skipped. Somebody who left the tutorial *by walking
   * into the world* did the thing the tutorial exists to cause, and filing that
   * as an abandonment would make the funnel read the single best outcome as a
   * failure.
   */
  enter(door: Doorway): void {
    this.analytics.trackOnboardingComplete(true, this.step());
    this.analytics.trackFirstRealmVisit(door.accent);
    this.onboarding.finish(this.totalSteps);
    void this.router.navigateByUrl(this.routeFor(door));
  }

  /**
   * Step 5's button. Records the quest as picked up on the way out, so the
   * board the visitor lands on is the one they were just shown.
   */
  finishToQuest(): void {
    const quest = this.previewQuest();
    if (quest) this.analytics.trackDailyQuestStart(quest.id);
    this.complete();
  }

  // ─── Keyboard and focus ─────────────────────────────────────────────────

  /**
   * Escape skips. A full-viewport takeover with no keyboard way out is a trap,
   * and the skip button is the same door — this is only a shortcut to it.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.skip();
      return;
    }
    if (event.key !== 'Tab') return;

    // Focus containment. The overlay covers the whole viewport, so tabbing out
    // of it lands on the header and the footer underneath — controls the
    // visitor cannot see and did not mean to reach.
    const root = this.panel()?.nativeElement;
    if (!root) return;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(el => el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeEl = this.doc.activeElement as HTMLElement | null;

    if (event.shiftKey && activeEl === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeEl === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Move focus to the new screen so a screen reader announces it. */
  private focusPanel(): void {
    if (!this.isBrowser) return;
    queueMicrotask(() => this.panel()?.nativeElement?.focus());
  }

  /**
   * Hold the page still behind the curtain.
   *
   * `overflow: hidden` on <body> and nothing else: this repo has already
   * shipped a sitewide bug where `overflow-x: hidden` on body made every
   * page-level `position: sticky` inert, so the property is set and removed
   * rather than left behind, and the axis is not narrowed.
   */
  private lockScroll(locked: boolean): void {
    if (!this.isBrowser) return;
    const body = this.doc.body;
    if (!body) return;
    if (locked) body.style.setProperty('overflow', 'hidden');
    else body.style.removeProperty('overflow');
  }
}
