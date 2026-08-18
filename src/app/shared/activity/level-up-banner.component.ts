/**
 * level-up-banner.component.ts — the moment itself.
 *
 * Top-centre, not bottom: the quest/lore toast already owns bottom-centre,
 * and the bottom-right corner already stacks the Forge Flame, the achievement
 * drop and the cookie banner three deep — a fourth tenant there has bitten
 * this project before. A level-up sits just under the header instead, on a
 * strip nothing else claims.
 *
 * One at a time, mirroring QuestToastComponent: a second level landing while
 * the first banner is still up replaces it rather than queuing, because
 * committing a Keeper to watching three sequential banners for something they
 * caused by clicking Mine three times fast is worse than showing the last one.
 *
 * Milestone levels (every tenth) get the same shape, larger and longer, with
 * the fanfare cue instead of the ding. They deliberately do NOT take the
 * screen the way a Mythic/Singular egg does — a mining milestone can land
 * mid-grind, and stopping the world to celebrate a skill number would fight
 * the very loop the level-up is supposed to reward. It never blocks Mine.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { LevelUpService, type LevelUpEvent } from './level-up.service';
import { LevelUpAudioService } from './level-up-audio.service';
import { TranslationService } from '../../translation.service';

const DWELL_MS = 3200;
const MILESTONE_DWELL_MS = 5200;

@Component({
  selector: 'app-level-up-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (event) {
      <div
        class="lu"
        [class.lu--on]="visible"
        [class.lu--milestone]="event.milestone"
        role="status"
        aria-live="polite"
        (click)="dismiss()">
        @if (event.art; as art) {
          <img class="lu__art" [src]="art.src" [attr.srcset]="art.srcset" sizes="48px"
               alt="" width="48" height="48" decoding="async">
        }
        <span class="lu__body">
          <span class="lu__eyebrow">{{ t(event.milestone ? 'levelUp.milestone' : 'levelUp.eyebrow') }}</span>
          <span class="lu__title">{{ t('levelUp.title', { skill: t(event.skillLabelKey), level: event.level }) }}</span>
        </span>
      </div>
    }
  `,
  styles: [`
    .lu {
      position: fixed;
      z-index: var(--z-toast, 1300);
      top: calc(var(--header-offset, 96px) + 14px);
      left: 50%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 18px 10px 12px;
      border-radius: 999px;
      border: 1px solid var(--gf-accent, #C9A84C);
      background:
        radial-gradient(ellipse 80% 70% at 50% 0%, rgba(201, 168, 76, 0.16), transparent 70%),
        rgba(6, 4, 18, 0.96);
      box-shadow: 0 14px 40px -16px rgba(0, 0, 0, 0.9), 0 0 26px -10px rgba(201, 168, 76, 0.6);
      cursor: pointer;
      transform: translate(-50%, -16px);
      opacity: 0;
      transition: transform 0.34s cubic-bezier(0.22, 1.28, 0.44, 1), opacity 0.3s ease;
    }
    .lu--on { transform: translate(-50%, 0); opacity: 1; }

    .lu__art { flex: none; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(0,0,0,.6)); }
    .lu__body { display: flex; flex-direction: column; gap: 1px; }
    .lu__eyebrow {
      font: 700 10px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--gf-accent-text, #E0A857);
    }
    .lu__title {
      font: 700 15px/1.2 'Orbitron', system-ui, sans-serif;
      color: #F2ECFF;
    }

    /* Every tenth level: bigger card, warmer glow, a slow ring pulse. Still no
       veil and still dismissible by a click anywhere on it — see file header
       for why this never takes the screen the way a rare egg does. */
    .lu--milestone {
      padding: 14px 26px 14px 16px;
      gap: 16px;
      border-width: 2px;
      box-shadow: 0 18px 54px -18px rgba(0, 0, 0, 0.95), 0 0 44px -8px rgba(201, 168, 76, 0.85);
    }
    .lu--milestone .lu__art { width: 56px; height: 56px; }
    .lu--milestone .lu__title { font-size: 18px; }
    @media (prefers-reduced-motion: no-preference) {
      .lu--milestone.lu--on { animation: luPulse 2.4s ease-in-out infinite; }
    }
    @keyframes luPulse {
      0%, 100% { box-shadow: 0 18px 54px -18px rgba(0,0,0,.95), 0 0 44px -8px rgba(201, 168, 76, .85); }
      50%      { box-shadow: 0 18px 54px -18px rgba(0,0,0,.95), 0 0 60px -6px rgba(201, 168, 76, 1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .lu { transition: opacity 0.2s ease; transform: translate(-50%, 0); }
      .lu--milestone.lu--on { animation: none; }
    }

    @media (max-width: 480px) {
      .lu { width: min(94vw, 360px); }
      .lu__title { font-size: 13px; }
      .lu--milestone .lu__title { font-size: 15px; }
    }
  `],
})
export class LevelUpBannerComponent implements OnInit, OnDestroy {
  private readonly levelUp = inject(LevelUpService);
  private readonly audio = inject(LevelUpAudioService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private sub?: Subscription;
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  event: LevelUpEvent | null = null;
  visible = false;

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.sub = this.levelUp.events$.subscribe(event => this.show(event));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.clearTimers();
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  dismiss(): void {
    this.visible = false;
    this.cdr.markForCheck();
    this.timers.push(setTimeout(() => {
      this.event = null;
      this.cdr.markForCheck();
    }, 400));
  }

  private show(event: LevelUpEvent): void {
    this.clearTimers();
    this.event = event;
    this.visible = false;
    this.cdr.markForCheck();

    event.milestone ? this.audio.fanfare() : this.audio.ding();

    this.timers.push(setTimeout(() => {
      this.visible = true;
      this.cdr.markForCheck();
    }, 20));

    this.timers.push(setTimeout(
      () => this.dismiss(),
      event.milestone ? MILESTONE_DWELL_MS : DWELL_MS,
    ));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
