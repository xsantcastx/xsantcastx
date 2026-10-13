/**
 * <app-game-stepper> — the − value + control every game of chance uses for
 * its bet and its settings (rows, risk, collapses, auto target). ≥44 px
 * buttons, a small caption over the value, no free text entry.
 *
 *   <app-game-stepper [label]="t('games.bet.label')" [value]="fmt(bet)"
 *     [lessLabel]="…" [moreLabel]="…" [canLess]="…" [canMore]="…"
 *     (less)="step(-1)" (more)="step(1)" />
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-game-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gs" role="group" [attr.aria-label]="label()">
      <button type="button" class="gs__btn" [attr.aria-label]="lessLabel()" [disabled]="!canLess()" (click)="less.emit()">−</button>
      <span class="gs__val" aria-live="polite"><small>{{ label() }}</small>{{ value() }}</span>
      <button type="button" class="gs__btn" [attr.aria-label]="moreLabel()" [disabled]="!canMore()" (click)="more.emit()">+</button>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .gs { display: flex; align-items: center; gap: var(--space-1); }
    .gs__btn {
      min-width: var(--tap-min);
      min-height: var(--tap-min);
      border: 2px solid var(--edge-gold);
      background: var(--obsidian-3);
      color: var(--gold-bright);
      font: inherit;
      font-size: var(--text-lg);
      cursor: pointer;
    }
    .gs__btn:disabled { opacity: .45; cursor: default; }
    .gs__btn:focus-visible { outline: 2px solid var(--gold-bright); outline-offset: 2px; }
    .gs__val {
      display: grid;
      min-width: 76px;
      text-align: center;
      color: var(--gold);
      font-size: var(--text-lg);
      font-variant-numeric: tabular-nums;
    }
    .gs__val small { color: var(--ink-2); font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: .08em; }
  `],
})
export class GameStepperComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly lessLabel = input('');
  readonly moreLabel = input('');
  readonly canLess = input(true);
  readonly canMore = input(true);
  readonly less = output<void>();
  readonly more = output<void>();
}
