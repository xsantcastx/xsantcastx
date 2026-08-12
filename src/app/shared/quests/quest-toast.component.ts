/**
 * quest-toast.component.ts — the two announcements this feature owes the visitor.
 *
 * A claimed quest and a newly-opened lore chapter both happen while attention
 * is somewhere else, so both need to say so. They share one component because
 * they share one constraint: never more than one on screen, and never long
 * enough to be in the way.
 *
 * Deliberately NOT routed through AchievementDropComponent. That component is
 * bound to egg discoveries and its rarest tiers take over the viewport; a quest
 * claim is a thing the visitor just did on purpose, and interrupting someone to
 * confirm what they meant to do is a worse experience than saying nothing.
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
import { QuestService } from './quest.service';
import { LoreService } from '../lore/lore.service';
import { RARITIES } from '../rarity/rarity.model';

interface Toast {
  kind: 'quest' | 'lore';
  icon: string;
  eyebrow: string;
  title: string;
  detail: string;
  color: string;
  glow: string;
}

const DWELL_MS = 5200;

@Component({
  selector: 'app-quest-toast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (toast) {
      <div
        class="qt"
        [class.qt--on]="visible"
        [attr.data-kind]="toast.kind"
        [style.--tint]="toast.color"
        [style.--tint-glow]="toast.glow"
        role="status"
        aria-live="polite"
        (click)="dismiss()">
        <span class="qt__icon" aria-hidden="true">{{ toast.icon }}</span>
        <span class="qt__body">
          <span class="qt__eyebrow">{{ toast.eyebrow }}</span>
          <span class="qt__title">{{ toast.title }}</span>
          <span class="qt__detail">{{ toast.detail }}</span>
        </span>
      </div>
    }
  `,
  styles: [`
    .qt {
      position: fixed; z-index: 95;
      left: 50%; bottom: 24px;
      display: flex; align-items: center; gap: 12px;
      width: min(380px, calc(100vw - 28px));
      padding: 13px 16px;
      border-radius: 14px;
      border: 1px solid var(--tint);
      background:
        radial-gradient(ellipse 70% 60% at 0% 0%, color-mix(in srgb, var(--tint) 12%, transparent), transparent 70%),
        rgba(6, 4, 18, 0.96);
      box-shadow: 0 18px 48px -20px rgba(0, 0, 0, .95), 0 0 30px -14px var(--tint-glow);
      cursor: pointer;
      transform: translate(-50%, 18px);
      opacity: 0;
      transition: transform .38s cubic-bezier(.22, 1, .36, 1), opacity .38s ease;
    }
    .qt--on { transform: translate(-50%, 0); opacity: 1; }

    .qt__icon { font-size: 20px; flex: none; }
    .qt__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

    .qt__eyebrow {
      font: 600 10px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .14em; text-transform: uppercase;
      color: var(--tint);
    }
    .qt__title {
      font: 600 14px/1.3 'Orbitron', system-ui, sans-serif;
      color: #F2ECFF;
    }
    .qt__detail { font-size: 12px; color: #9fb4ae; }

    /* The codex speaks in serif everywhere else; it should here too. */
    .qt[data-kind="lore"] .qt__title,
    .qt[data-kind="lore"] .qt__detail {
      font-family: Georgia, 'Times New Roman', serif;
    }
    .qt[data-kind="lore"] .qt__title { font-weight: 600; letter-spacing: 0; }

    @media (prefers-reduced-motion: reduce) {
      .qt { transition: opacity .2s ease; transform: translate(-50%, 0); }
    }
  `],
})
export class QuestToastComponent implements OnInit, OnDestroy {
  private readonly quests = inject(QuestService);
  private readonly lore = inject(LoreService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly subs = new Subscription();
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  toast: Toast | null = null;
  visible = false;

  ngOnInit(): void {
    if (!this.isBrowser) return;

    this.subs.add(this.quests.claim$.subscribe(({ quest, xp }) => {
      const tier = RARITIES[quest.rarity] ?? RARITIES.mortal;
      // Name the energy the card named. A card promising Aether that pays out
      // "XP" reads as two different rewards.
      const energy = quest.rewards.energy;
      const banked = energy === 'aether' ? `+${xp} Aether banked.`
                   : energy === 'nox'    ? `+${xp} Nox banked.`
                   :                       `+${xp} XP banked.`;
      this.show({
        kind: 'quest',
        icon: '⚔️',
        eyebrow: `${quest.type} quest complete`,
        title: quest.title,
        detail: quest.rewards.loreFragment ?? banked,
        color: tier.color,
        glow: tier.glow,
      });
    }));

    this.subs.add(this.lore.unlock$.subscribe(({ chapter }) => {
      this.show({
        kind: 'lore',
        icon: '\u{1F4D6}',
        eyebrow: 'New lore discovered',
        title: chapter.title,
        detail: 'Open the codex at the foot of this page to read it.',
        color: '#C9A84C',
        glow: 'rgba(201, 168, 76, 0.6)',
      });
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.clearTimers();
  }

  dismiss(): void {
    this.visible = false;
    this.cdr.markForCheck();
    this.timers.push(setTimeout(() => {
      this.toast = null;
      this.cdr.markForCheck();
    }, 400));
  }

  /**
   * One toast at a time. A second announcement replaces the first rather than
   * queueing — claiming three finished quests in a row should not commit the
   * visitor to sixteen seconds of toasts.
   */
  private show(toast: Toast): void {
    this.clearTimers();
    this.toast = toast;
    this.visible = false;
    this.cdr.markForCheck();

    // One frame at opacity 0 so the entry transition has something to run from.
    this.timers.push(setTimeout(() => {
      this.visible = true;
      this.cdr.markForCheck();
    }, 20));

    this.timers.push(setTimeout(() => this.dismiss(), DWELL_MS));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
