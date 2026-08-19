/**
 * challenge-panel.component.ts — the Contract Board, rendered.
 *
 * One component, mounted in two places: the Sanctum's right column and the
 * /world/quests page under the standing orders. Same board, same countdown,
 * same streak flame — the two surfaces are the same read at two sizes, and a
 * second component would be two things to keep in agreement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TICK
 * ─────────────────────────────────────────────────────────────────────────────
 * The countdown is redrawn once a second, and the interval runs *outside
 * Angular*, re-entering only to mark this component for check. That is the
 * budget every live surface on this site holds itself to — the Flame, the
 * economy, the expedition clock — and it is what keeps four of them on one page
 * from costing four change-detection passes a second.
 *
 * The interval is also the only reason this component needs `OnDestroy`: the
 * board itself is push, and a panel with no countdown would need no timer at
 * all.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { ChallengeBoard, ChallengeClaim, ChallengeService } from './challenge.service';
import {
  Challenge,
  STREAK_BOOST_MULTIPLIER,
  STREAK_CHEST_AT,
  challengeCountdown,
  challengeProgressLabel,
  formatChallengeNumber,
  streakFlameTier,
} from './challenge.model';
import { RARITIES } from '../rarity/rarity.model';

@Component({
  selector: 'app-challenge-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cp" [class.cp--compact]="compact" aria-labelledby="cp-title">

      <header class="cp__head">
        <h2 class="cp__title" id="cp-title">{{ heading }}</h2>
        <p class="cp__tagline">what the realms will pay for today</p>
      </header>

      <!-- The streak. First, because it is the reason the rest of the panel is
           worth finishing rather than cherry-picking. -->
      <div class="cp__streak" [attr.data-flame]="flameTier">
        <span class="cp__flame" aria-hidden="true">
          <span class="cp__flame-core"></span>
          <span class="cp__flame-lick"></span>
          <span class="cp__flame-lick cp__flame-lick--b"></span>
        </span>
        <div class="cp__streak-copy">
          <p class="cp__streak-count">
            <b>{{ board.streak }}</b>
            {{ board.streak === 1 ? 'day' : 'days' }}
          </p>
          <p class="cp__streak-note">{{ streakNote }}</p>
        </div>
        @if (board.chests > 0) {
          <span class="cp__chests" [attr.title]="board.chests + ' chests opened'">
            &#9670; {{ board.chests }}
          </span>
        }
      </div>

      <!-- The boost, only while it is paying. -->
      @if (boostLeft) {
        <p class="cp__boost" role="status">
          <span class="cp__boost-mult">x{{ boostMultiplier }}</span>
          Gold on everything you earn &mdash; {{ boostLeft }} left
        </p>
      }

      <!-- Daily -->
      <div class="cp__section">
        <div class="cp__section-head">
          <h3 class="cp__section-title">Daily</h3>
          <span class="cp__timer" aria-live="off">New challenges in {{ dailyCountdown }}</span>
        </div>

        <ul class="cp__list">
          @for (c of board.daily; track c.id) {
            <li class="cp__row"
                [class.cp__row--done]="c.status === 'completed'"
                [class.cp__row--claimed]="c.status === 'claimed'"
                [class.cp__row--flash]="c.id === justClaimed"
                [style.--tier]="tierColor(c)"
                [style.--tier-glow]="tierGlow(c)">
              <div class="cp__row-head">
                <p class="cp__row-title">{{ c.title }}</p>
                @if (c.status === 'claimed') {
                  <span class="cp__seal" aria-label="Collected">&#10003;</span>
                }
              </div>
              <p class="cp__row-desc">{{ c.description }}</p>
              <p class="cp__row-lore">{{ c.flavour }}</p>

              <div class="cp__track" role="progressbar"
                   [attr.aria-valuenow]="c.progress"
                   aria-valuemin="0" aria-valuemax="100"
                   [attr.aria-label]="c.title + ' progress'">
                <span class="cp__fill" [style.width.%]="c.progress"></span>
              </div>

              <div class="cp__row-foot">
                <span class="cp__count">{{ progressLabel(c) }}</span>
                @if (c.status === 'completed') {
                  <button type="button" class="cp__claim" (click)="onClaim(c)">
                    Collect {{ gold(c) }} &#9670;
                  </button>
                } @else {
                  <span class="cp__reward" [class.cp__reward--spent]="c.status === 'claimed'">
                    {{ gold(c) }} &#9670;
                  </span>
                }
              </div>
            </li>
          }
        </ul>

        <p class="cp__sweep" [class.cp__sweep--done]="board.dailySwept">
          @if (board.dailySwept) {
            All three collected &mdash; the forge pays double for the hour.
          } @else {
            Collect all three to double every Gold payout for an hour.
            {{ chestNote }}
          }
        </p>
      </div>

      <!-- Weekly -->
      <div class="cp__section">
        <div class="cp__section-head">
          <h3 class="cp__section-title">Weekly</h3>
          <span class="cp__timer">Redraws in {{ weeklyCountdown }}</span>
        </div>

        <ul class="cp__list">
          @for (c of board.weekly; track c.id) {
            <li class="cp__row cp__row--weekly"
                [class.cp__row--done]="c.status === 'completed'"
                [class.cp__row--claimed]="c.status === 'claimed'"
                [class.cp__row--flash]="c.id === justClaimed"
                [style.--tier]="tierColor(c)"
                [style.--tier-glow]="tierGlow(c)">
              <div class="cp__row-head">
                <p class="cp__row-title">{{ c.title }}</p>
                @if (c.status === 'claimed') {
                  <span class="cp__seal" aria-label="Collected">&#10003;</span>
                }
              </div>
              <p class="cp__row-desc">{{ c.description }}</p>
              <p class="cp__row-lore">{{ c.flavour }}</p>

              <div class="cp__track" role="progressbar"
                   [attr.aria-valuenow]="c.progress"
                   aria-valuemin="0" aria-valuemax="100"
                   [attr.aria-label]="c.title + ' progress'">
                <span class="cp__fill" [style.width.%]="c.progress"></span>
              </div>

              <div class="cp__row-foot">
                <span class="cp__count">{{ progressLabel(c) }}</span>
                @if (c.status === 'completed') {
                  <button type="button" class="cp__claim" (click)="onClaim(c)">
                    Collect {{ gold(c) }} &#9670;
                  </button>
                } @else {
                  <span class="cp__reward" [class.cp__reward--spent]="c.status === 'claimed'">
                    {{ gold(c) }} &#9670;
                  </span>
                }
              </div>
            </li>
          }
        </ul>
      </div>

      @if (board.goldPaid > 0) {
        <p class="cp__total">
          &#9670; {{ paidLabel }} paid out by this board
        </p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .cp {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: clamp(.9rem, 2vw, 1.25rem);
      padding: clamp(1rem, 2.5vw, 1.4rem);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, .06);
      background:
        radial-gradient(ellipse 60% 50% at 20% 20%, rgba(255, 198, 105, .06), transparent 65%),
        radial-gradient(ellipse 50% 45% at 85% 80%, rgba(123, 97, 255, .07), transparent 65%),
        rgba(10, 6, 26, .55);
    }

    /* The gradient cap line every cosmic section on this site carries. */
    .cp::before {
      content: '';
      position: absolute; top: -1px; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 198, 105, .5) 50%, transparent);
    }

    .cp__head { display: grid; gap: .25rem; }
    .cp__title {
      margin: 0;
      font-size: clamp(1.05rem, 2.4vw, 1.35rem);
      letter-spacing: .02em;
      color: #f4f0ff;
    }
    .cp__tagline {
      margin: 0;
      font-size: .78rem;
      color: rgba(228, 222, 255, .5);
      font-style: italic;
    }

    /* ── The streak ────────────────────────────────────────────────────────── */

    .cp__streak {
      display: flex; align-items: center; gap: .8rem;
      padding: .7rem .9rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, .06);
      background: rgba(6, 4, 16, .5);
    }
    .cp__streak[data-flame="lit"]      { border-color: rgba(255, 198, 105, .28); }
    .cp__streak[data-flame="burning"]  { border-color: rgba(255, 154, 90, .45); box-shadow: 0 0 26px -12px rgba(255, 154, 90, .8); }
    .cp__streak[data-flame="eternal"]  { border-color: rgba(255, 45, 77, .5);  box-shadow: 0 0 32px -10px rgba(255, 45, 77, .8); }

    .cp__flame {
      position: relative;
      display: block;
      width: 26px; height: 34px;
      flex: 0 0 auto;
    }
    .cp__flame-core, .cp__flame-lick {
      position: absolute;
      left: 50%;
      bottom: 0;
      border-radius: 50% 50% 46% 46% / 62% 62% 38% 38%;
      transform: translateX(-50%);
      opacity: .9;
    }
    .cp__flame-core {
      width: 14px; height: 20px;
      background: linear-gradient(180deg, #fff4d6, #ffc669 55%, #ff9a5a);
    }
    .cp__flame-lick {
      width: 22px; height: 30px;
      background: linear-gradient(180deg, rgba(255, 198, 105, .5), rgba(255, 90, 60, .12));
      filter: blur(2px);
    }
    .cp__flame-lick--b { width: 28px; height: 34px; opacity: .4; }

    /* A cold flame is a grey outline, not a hidden one: the streak card has to
       read as "you have not started" rather than as an empty box. */
    [data-flame="cold"] .cp__flame-core { background: linear-gradient(180deg, #4a4560, #2b2740); }
    [data-flame="cold"] .cp__flame-lick { background: linear-gradient(180deg, rgba(120, 112, 150, .25), transparent); }

    [data-flame="lit"] .cp__flame-core,
    [data-flame="burning"] .cp__flame-core,
    [data-flame="eternal"] .cp__flame-core { animation: cpFlicker 1.6s ease-in-out infinite; }
    [data-flame="burning"] .cp__flame-lick { animation: cpFlicker 2.1s ease-in-out infinite reverse; }
    [data-flame="eternal"] .cp__flame-core {
      background: linear-gradient(180deg, #ffe9f0, #ff5f7a 55%, #ff2d4d);
    }

    @keyframes cpFlicker {
      0%, 100% { transform: translateX(-50%) scaleY(1)    scaleX(1); }
      35%      { transform: translateX(-50%) scaleY(1.14) scaleX(.94); }
      70%      { transform: translateX(-50%) scaleY(.94)  scaleX(1.06); }
    }

    .cp__streak-copy { flex: 1 1 auto; display: grid; gap: .1rem; }
    .cp__streak-count { margin: 0; font-size: .8rem; color: rgba(228, 222, 255, .6); }
    .cp__streak-count b { font-size: 1.4rem; color: #ffc669; margin-right: .3rem; }
    .cp__streak-note { margin: 0; font-size: .74rem; color: rgba(228, 222, 255, .45); }
    .cp__chests {
      font-size: .78rem;
      color: #C9A84C;
      white-space: nowrap;
    }

    /* ── The boost ─────────────────────────────────────────────────────────── */

    .cp__boost {
      margin: 0;
      padding: .55rem .8rem;
      border-radius: 999px;
      border: 1px solid rgba(255, 198, 105, .35);
      background: rgba(255, 198, 105, .08);
      color: #ffdca8;
      font-size: .78rem;
      text-align: center;
      animation: cpBoostPulse 2.4s ease-in-out infinite;
    }
    .cp__boost-mult { font-weight: 700; margin-right: .35rem; color: #fff1cf; }

    @keyframes cpBoostPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 198, 105, 0); }
      50%      { box-shadow: 0 0 24px -8px rgba(255, 198, 105, .7); }
    }

    /* ── Sections ──────────────────────────────────────────────────────────── */

    .cp__section { display: grid; gap: .6rem; }
    .cp__section-head {
      display: flex; align-items: baseline; justify-content: space-between; gap: .6rem;
      flex-wrap: wrap;
    }
    .cp__section-title {
      margin: 0;
      font-size: .82rem;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: rgba(228, 222, 255, .62);
    }
    .cp__timer {
      font-size: .74rem;
      color: rgba(228, 222, 255, .42);
      font-variant-numeric: tabular-nums;
    }

    .cp__list { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }

    .cp__row {
      position: relative;
      display: grid; gap: .35rem;
      padding: .75rem .85rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, .06);
      border-left: 2px solid var(--tier, rgba(255, 255, 255, .2));
      background: rgba(6, 4, 16, .45);
      transition: border-color .25s ease, box-shadow .25s ease, opacity .25s ease;
    }
    .cp__row--done {
      border-color: var(--tier);
      box-shadow: 0 0 26px -12px var(--tier-glow);
    }
    .cp__row--claimed { opacity: .55; }

    /* The collect animation. A flare that sweeps the row once, rather than a
       particle burst: this panel can hold five rows and five bursts firing on a
       sweep would be a screen nobody can read for two seconds. */
    .cp__row--flash::after {
      content: '';
      position: absolute; inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background: linear-gradient(100deg, transparent 20%, var(--tier-glow) 50%, transparent 80%);
      background-size: 300% 100%;
      animation: cpCollect .85s ease-out 1;
    }
    @keyframes cpCollect {
      from { background-position: 140% 0; opacity: 1; }
      to   { background-position: -40% 0; opacity: 0; }
    }

    .cp__row-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
    .cp__row-title { margin: 0; font-size: .92rem; color: #f4f0ff; }
    .cp__seal { color: #7fd5a3; font-size: .85rem; }
    .cp__row-desc { margin: 0; font-size: .78rem; color: rgba(228, 222, 255, .62); }
    .cp__row-lore {
      margin: 0;
      font-size: .72rem; font-style: italic;
      color: rgba(228, 222, 255, .34);
    }

    .cp__track {
      height: 4px;
      border-radius: 999px;
      background: rgba(255, 255, 255, .07);
      overflow: hidden;
      margin-top: .2rem;
    }
    .cp__fill {
      display: block; height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--tier), color-mix(in srgb, var(--tier) 60%, #ffffff));
      box-shadow: 0 0 12px -2px var(--tier-glow);
      transition: width .4s cubic-bezier(.22, 1, .36, 1);
    }

    .cp__row-foot {
      display: flex; align-items: center; justify-content: space-between; gap: .5rem;
      margin-top: .15rem;
    }
    .cp__count {
      font-size: .74rem;
      color: rgba(228, 222, 255, .5);
      font-variant-numeric: tabular-nums;
    }
    .cp__reward { font-size: .78rem; color: #C9A84C; font-variant-numeric: tabular-nums; }
    .cp__reward--spent { color: rgba(201, 168, 76, .45); }

    .cp__claim {
      min-height: 34px;
      padding: .35rem .8rem;
      border-radius: 999px;
      border: 1px solid rgba(255, 198, 105, .5);
      background: rgba(255, 198, 105, .12);
      color: #ffdca8;
      font-size: .78rem;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      transition: background .2s ease, box-shadow .2s ease, transform .2s ease;
    }
    .cp__claim:hover {
      background: rgba(255, 198, 105, .22);
      box-shadow: 0 0 22px -8px rgba(255, 198, 105, .9);
    }
    .cp__claim:active { transform: scale(.97); }

    .cp__sweep {
      margin: 0;
      font-size: .74rem;
      color: rgba(228, 222, 255, .42);
    }
    .cp__sweep--done { color: rgba(255, 198, 105, .8); }

    .cp__total {
      margin: 0;
      padding-top: .6rem;
      border-top: 1px solid rgba(255, 255, 255, .05);
      font-size: .74rem;
      color: rgba(201, 168, 76, .65);
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    /* The Sanctum column is narrow; the /quests page is not. Compact drops the
       flavour line, which is the one thing on the card that is decoration. */
    .cp--compact .cp__row-lore { display: none; }
    .cp--compact { padding: .9rem; }

    @media (prefers-reduced-motion: reduce) {
      .cp__flame-core, .cp__flame-lick, .cp__boost { animation: none; }
      .cp__row--flash::after { animation: none; opacity: 0; }
      .cp__fill { transition: none; }
    }
  `],
})
export class ChallengePanelComponent implements OnInit, OnDestroy {
  private readonly challenges = inject(ChallengeService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Drops the flavour lines and tightens the padding for a narrow column. */
  @Input() compact = false;
  @Input() heading = 'Contract Board';

  private readonly subs = new Subscription();
  private ticker: ReturnType<typeof setInterval> | null = null;

  board: ChallengeBoard = this.challenges.board;
  dailyCountdown = '—';
  weeklyCountdown = '—';
  boostLeft = '';
  /** The row currently playing the collect sweep, cleared when it finishes. */
  justClaimed: string | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  readonly boostMultiplier = STREAK_BOOST_MULTIPLIER;

  ngOnInit(): void {
    this.challenges.init();

    this.subs.add(this.challenges.board$.subscribe(b => {
      this.board = b;
      this.recount();
      this.cdr.markForCheck();
    }));

    this.subs.add(this.challenges.claim$.subscribe(c => this.onClaimed(c)));

    if (!this.isBrowser) return;
    this.recount();
    this.zone.runOutsideAngular(() => {
      this.ticker = setInterval(() => {
        this.recount();
        this.zone.run(() => this.cdr.markForCheck());
      }, 1_000);
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.ticker) clearInterval(this.ticker);
    if (this.flashTimer) clearTimeout(this.flashTimer);
  }

  onClaim(c: Challenge): void {
    this.challenges.claim(c.id);
  }

  private onClaimed(claim: ChallengeClaim): void {
    this.justClaimed = claim.challenge.id;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    // Cleared rather than left set, so re-entering the panel does not replay a
    // sweep for a challenge collected an hour ago.
    this.flashTimer = setTimeout(() => {
      this.justClaimed = null;
      this.flashTimer = null;
      this.cdr.markForCheck();
    }, 900);
    this.cdr.markForCheck();
  }

  get flameTier(): string {
    return streakFlameTier(this.board.streak);
  }

  get streakNote(): string {
    if (this.board.streak === 0) return 'clear all three dailies to light it';
    const toChest = STREAK_CHEST_AT - (this.board.streak % STREAK_CHEST_AT);
    return toChest === STREAK_CHEST_AT
      ? 'a chest is waiting at the next sweep'
      : `${toChest} more ${toChest === 1 ? 'day' : 'days'} to the next chest`;
  }

  get chestNote(): string {
    return `${STREAK_CHEST_AT} days in a row opens a chest.`;
  }

  get paidLabel(): string {
    return formatChallengeNumber(this.board.goldPaid);
  }

  progressLabel(c: Challenge): string {
    return challengeProgressLabel(c);
  }

  gold(c: Challenge): string {
    return formatChallengeNumber(c.gold);
  }

  tierColor(c: Challenge): string {
    return RARITIES[c.rarity]?.color ?? '#8f98a8';
  }

  tierGlow(c: Challenge): string {
    return RARITIES[c.rarity]?.glow ?? 'rgba(143, 152, 168, .45)';
  }

  private recount(): void {
    const now = Date.now();
    this.dailyCountdown = challengeCountdown(this.board.dailyResetAt, now);
    this.weeklyCountdown = challengeCountdown(this.board.weeklyResetAt, now);
    this.boostLeft = this.board.boostUntil > now
      ? challengeCountdown(new Date(this.board.boostUntil).toISOString(), now)
      : '';
  }
}
