/**
 * <app-bet-chips> — quick picks beside a bet stepper: Min · ½ · ×2 · Max.
 *
 * Every chip lands on an open rung (bet-tiers `betChips`), so the bet is always
 * one the ledger will take. Max asks once when it is a high stake (more than
 * two minutes of income, economy-curve `gamesHighStake`): the first tap arms
 * it ("Max 2,000,000? Tap again"), a second tap within a few seconds sets it.
 * The spin itself stays one tap.
 *
 *   <app-bet-chips [bet]="bet" [gps]="gps" [gold]="gold" [disabled]="busy" (pick)="setBet($event)" />
 */
import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, output, signal } from '@angular/core';

import { TranslationService } from '../../translation.service';
import { betChips, highStake } from './bet-tiers';
import { GAMES_I18N } from './games.i18n';

/** How long an armed Max waits for its second tap, ms. */
export const MAX_ARM_MS = 4000;

@Component({
  selector: 'app-bet-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bc" role="group" [attr.aria-label]="t('games.chips.label')">
      <button type="button" class="bc__chip" data-chip="min" [disabled]="disabled() || chips().min === bet()" (click)="choose(chips().min)">{{ t('games.chips.min') }}</button>
      <button type="button" class="bc__chip" data-chip="half" [disabled]="disabled() || chips().half === bet()" (click)="choose(chips().half)">½</button>
      <button type="button" class="bc__chip" data-chip="double" [disabled]="disabled() || chips().double === bet()" (click)="choose(chips().double)">×2</button>
      <button type="button" class="bc__chip bc__chip--max" data-chip="max" [class.is-armed]="armed()"
              [disabled]="disabled() || chips().max === bet()" (click)="max()">
        {{ armed() ? t('games.chips.confirm', { n: fmt(chips().max) }) : t('games.chips.max') }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .bc { display: flex; gap: var(--space-1); justify-content: center; flex-wrap: nowrap; }
    .bc__chip {
      min-width: var(--tap-min);
      min-height: var(--tap-min);
      padding: 0 var(--space-2);
      border: 0;
      border-bottom: 2px solid var(--gold-deep);
      background: color-mix(in srgb, var(--obsidian-3) 70%, transparent);
      color: var(--gold);
      font: inherit;
      font-size: var(--text-sm);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      white-space: nowrap;
    }
    .bc__chip:disabled { opacity: .4; cursor: default; }
    .bc__chip:focus-visible { outline: 2px solid var(--gold-bright); outline-offset: 2px; }
    .bc__chip.is-armed { color: var(--obsidian-0); background: var(--gold-bright); border-bottom-color: var(--ember); }
  `],
})
export class BetChipsComponent implements OnDestroy {
  private readonly i18n = inject(TranslationService);

  readonly bet = input.required<number>();
  readonly gps = input(0);
  readonly gold = input(0);
  readonly disabled = input(false);
  readonly pick = output<number>();

  readonly chips = computed(() => betChips(this.bet(), this.gps(), this.gold()));
  readonly armed = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() { this.i18n.register(GAMES_I18N); }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  fmt(n: number): string { return Math.floor(n).toLocaleString('en-US'); }

  choose(bet: number): void {
    this.disarm();
    this.pick.emit(bet);
  }

  max(): void {
    const top = this.chips().max;
    if (!highStake(top, this.gps()) || this.armed()) { this.choose(top); return; }
    this.armed.set(true);
    this.timer = setTimeout(() => this.disarm(), MAX_ARM_MS);
  }

  private disarm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.armed.set(false);
  }

  ngOnDestroy(): void { this.disarm(); }
}
