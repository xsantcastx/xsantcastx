/**
 * <app-action-button> — THE action row of a station: what it does, what it
 * costs, and, when you can't, exactly why and how close you are.
 *
 *   <app-action-button
 *     [label]="'Craft'"
 *     [costs]="costs"                 // StationCost[] PER ONE — Gold first
 *     [blocked]="levelReason"         // optional non-cost reason, wins over costs
 *     [pending]="!hydrated"           // before the save loads: neutral, no "Need…"
 *     [loading]="striking" [progress]="0.4"
 *     [stepper]="true" [(quantity)]="qty"   // − 1 + ; costs scale by quantity
 *     [allCount]="maxAffordable" [allLabel]="'Craft all'"
 *     (act)="craft($event)" (actAll)="craft($event)" (refused)="announce = $event" />
 *
 * Unaffordable is NOT `disabled`: the button stays focusable and pressable,
 * and a refused press shakes it and the short chips — the game telling you
 * "not yet" instead of a dead grey slab. `aria-disabled` carries the state for
 * assistive tech and the reason is wired with aria-describedby.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { TranslationService } from '../../translation.service';
import { CostChipComponent } from './cost-chip.component';
import { STATION_UI_I18N } from './station-ui.i18n';
import {
  affordProgress,
  formatAmount,
  priceLine,
  shortfall,
  type StationCost,
} from './station-ui.model';

let nextId = 0;
const STEP_MAX = 99;

@Component({
  selector: 'app-action-button',
  // In the world's panel the primary action sticks to the panel's bottom edge (--ab-stick, side-scroller.component.css).
  host: { '[class.ab-host--primary]': "variant() !== 'secondary'" },
  standalone: true,
  imports: [CostChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ab" [class.ab--secondary]="variant() === 'secondary'">
      <div class="ab__row">
        @if (stepper() && !loading()) {
          <div class="ab__step" role="group" [attr.aria-label]="t('stationUi.quantity')">
            <button type="button" class="ab__stepbtn" [attr.aria-label]="t('stationUi.less')"
                    [disabled]="quantity() <= 1" (click)="step(-1)">−</button>
            <span class="ab__qty" aria-live="polite">{{ quantity() }}</span>
            <button type="button" class="ab__stepbtn" [attr.aria-label]="t('stationUi.more')"
                    [disabled]="quantity() >= stepMax()" (click)="step(1)">+</button>
          </div>
        }

        <button type="button" class="ab__btn"
                [class.is-ready]="ready()"
                [class.is-blocked]="!!reason()"
                [class.is-loading]="loading()"
                [class.is-shake-a]="!!reason() && nudge() % 2 === 1"
                [class.is-shake-b]="!!reason() && nudge() > 0 && nudge() % 2 === 0"
                [attr.aria-disabled]="ready() ? null : 'true'"
                [attr.aria-describedby]="reason() ? reasonId : null"
                [attr.aria-label]="ariaLabel()"
                (click)="press()">
          <span class="ab__label">{{ loading() ? (loadingLabel() || t('stationUi.working')) : label() }}</span>
          @if (chipCosts().length && !loading()) {
            <span class="ab__costs">
              @for (cost of chipCosts(); track $index) {
                <app-cost-chip [cost]="cost" [nudge]="nudge()" [pending]="pending()" />
              }
            </span>
          }
        </button>

        @if (allLabel() && !loading()) {
          <button type="button" class="ab__all"
                  [class.is-blocked]="allCount() === null || allCount()! < 1"
                  [attr.aria-disabled]="allReady() ? null : 'true'"
                  (click)="pressAll()">
            {{ allLabel() }}@if (allReady()) { <span class="ab__allN">×{{ allCount() }}</span> }
          </button>
        }
      </div>

      @if (loading() && progress() !== null) {
        <div class="ab__meter ab__meter--work" role="progressbar" aria-valuemin="0" aria-valuemax="100"
             [attr.aria-valuenow]="pct()">
          <span [style.width.%]="pct()"></span>
        </div>
      } @else if (reason()) {
        <p class="ab__why" [id]="reasonId">{{ reason() }}</p>
        @if (meter() !== null) {
          <div class="ab__meter" role="progressbar" aria-valuemin="0" aria-valuemax="100"
               [attr.aria-valuenow]="pct()" [attr.aria-label]="reason()">
            <span [style.width.%]="pct()"></span>
          </div>
        }
      }
    </div>
  `,
  styleUrls: ['./station-tokens.css', './action-button.component.css'],
})
export class ActionButtonComponent {
  private readonly i18n = inject(TranslationService);

  /** What happens, in plain words: "Craft", "Strike the forge", "Add Ember to Kris". */
  readonly label = input.required<string>();
  /** The price of ONE, in the order to name shortages (Gold first). Empty = free. */
  readonly costs = input<readonly StationCost[]>([]);
  /** Which cost chips to print on the button: all, Gold/Essence only, or none (a requirement grid shows them). */
  readonly chips = input<'all' | 'currency' | 'none'>('all');
  /** A reason that isn't money: "Reach crafting level 4", "Your bag is full". Wins over costs. */
  readonly blocked = input<string | null>(null);
  /** 0..1 progress to show under a `blocked` reason (costs compute their own). */
  readonly progress = input<number | null>(null);
  /** Before the save hydrates: show the price, no reason, no press. */
  readonly pending = input(false);
  /** A timed action is running. Pair with `progress` for a work bar. */
  readonly loading = input(false);
  readonly loadingLabel = input<string | null>(null);
  readonly variant = input<'primary' | 'secondary'>('primary');
  /** Show the − 1 + quantity stepper. Costs scale by `quantity`. */
  readonly stepper = input(false);
  readonly quantity = model(1);
  /** Upper bound of the stepper (default 99). */
  readonly stepMax = input(STEP_MAX);
  /** "Craft all" — how many the player can afford right now. Null/0 = can't. */
  readonly allCount = input<number | null>(null);
  readonly allLabel = input<string | null>(null);

  /** Pressed while able — carries the quantity. */
  readonly act = output<number>();
  /** "Craft all" pressed while able — carries `allCount`. */
  readonly actAll = output<number>();
  /** Pressed while unable — carries the reason, for a station's live region. */
  readonly refused = output<string>();

  readonly reasonId = `st-why-${++nextId}`;
  readonly nudge = signal(0);

  constructor() { this.i18n.register(STATION_UI_I18N); }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  /** The price of `quantity`. */
  readonly scaled = computed<StationCost[]>(() => {
    const q = this.stepper() ? this.quantity() : 1;
    return this.costs().map(cost => (q === 1 ? cost : { ...cost, need: cost.need * q }));
  });

  readonly chipCosts = computed<StationCost[]>(() => {
    const mode = this.chips();
    if (mode === 'none') return [];
    if (mode === 'currency') return this.scaled().filter(c => c.kind === 'gold' || c.kind === 'essence');
    return this.scaled();
  });

  readonly reason = computed<string | null>(() => {
    if (this.pending() || this.loading()) return null;
    const blocked = this.blocked();
    if (blocked) return blocked;
    const short = shortfall(this.scaled());
    return short ? this.t('stationUi.need', { n: formatAmount(short.short), name: short.cost.label }) : null;
  });

  readonly ready = computed(() => !this.pending() && !this.loading() && !this.reason());
  readonly allReady = computed(() => !this.pending() && !this.loading() && !this.blocked() && (this.allCount() ?? 0) >= 1);

  /** The bar under a reason: the caller's progress for a `blocked`, else affordability. */
  readonly meter = computed<number | null>(() => {
    if (this.blocked()) return this.progress();
    return this.scaled().length ? affordProgress(this.scaled()) : null;
  });

  readonly pct = computed(() => {
    const v = this.loading() ? this.progress() : this.meter();
    return Math.round(Math.max(0, Math.min(1, v ?? 0)) * 100);
  });

  readonly ariaLabel = computed(() => {
    const price = this.scaled().length && !this.loading() ? ` — ${priceLine(this.scaled())}` : '';
    return (this.loading() ? (this.loadingLabel() || this.t('stationUi.working')) : this.label()) + price;
  });

  step(delta: number): void {
    this.quantity.set(Math.max(1, Math.min(this.stepMax(), this.quantity() + delta)));
  }

  press(): void {
    if (this.pending() || this.loading()) return;
    const why = this.reason();
    if (why) {
      this.nudge.update(n => n + 1);
      this.refused.emit(why);
      return;
    }
    this.act.emit(this.stepper() ? this.quantity() : 1);
  }

  pressAll(): void {
    if (this.pending() || this.loading()) return;
    if (!this.allReady()) {
      this.nudge.update(n => n + 1);
      const why = this.blocked() ?? shortfall(this.costs());
      this.refused.emit(typeof why === 'string' ? why
        : why ? this.t('stationUi.need', { n: formatAmount(why.short), name: why.cost.label }) : '');
      return;
    }
    this.actAll.emit(this.allCount() ?? 0);
  }
}
