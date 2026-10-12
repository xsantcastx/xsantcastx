/**
 * <app-cost-chip> — one line of a price, with its art: "[coin] 12,000 Gold".
 *
 *   <app-cost-chip [cost]="{ kind: 'gold', label: 'Gold', need: 500, have: gold }" />
 *
 * Affordable → a slow glow pulse. Short → red edge; bump `nudge` (the
 * ActionButton does this on a refused press) and it shakes once. `pending`
 * (before the save has hydrated) shows a neutral chip so the prerendered page
 * never flashes "short".
 *
 * Art: `cost.art` when the caller resolved it, else `artFor(cost.id)`, else the
 * Gold / Essence currency art. Never a hand-written assets/ path.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { artFor } from '../art/art';
import { TranslationService } from '../../translation.service';
import { STATION_UI_I18N } from './station-ui.i18n';
import { costShort, formatAmount, type StationArt, type StationCost } from './station-ui.model';

@Component({
  selector: 'app-cost-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip"
          [attr.data-kind]="cost().kind"
          [attr.title]="quiet() || pending() ? null : haveLine()"
          [class.is-ok]="!pending() && short() === 0"
          [class.is-quiet]="quiet()"
          [class.is-short]="!pending() && short() > 0"
          [class.is-shake-a]="!pending() && short() > 0 && nudge() % 2 === 1"
          [class.is-shake-b]="!pending() && short() > 0 && nudge() > 0 && nudge() % 2 === 0">
      @if (art(); as a) {
        <img class="chip__art" [src]="a.src" [attr.srcset]="a.srcset || null" sizes="24px"
             alt="" width="24" height="24" decoding="async" draggable="false">
      }
      <span class="chip__n">{{ amount() }}</span>
      <span class="chip__label">{{ cost().label }}</span>
      @if (showHave() && !pending()) {
        <span class="chip__have">{{ haveLine() }}</span>
      }
    </span>
  `,
  styleUrls: ['./station-tokens.css', './cost-chip.component.css'],
})
export class CostChipComponent {
  private readonly i18n = inject(TranslationService);

  readonly cost = input.required<StationCost>();
  /** Also print what the player holds: "6 Thornroot · you have 4". */
  readonly showHave = input(false);
  /** Bump to shake a short chip once. Each change restarts the animation. */
  readonly nudge = input(0);
  /** True before the save hydrates: neutral, never "short". */
  readonly pending = input(false);
  /** A balance readout (the wallet), not a price: no pulse. Set need = have. */
  readonly quiet = input(false);

  constructor() { this.i18n.register(STATION_UI_I18N); }

  readonly short = computed(() => costShort(this.cost()));
  readonly amount = computed(() => formatAmount(this.cost().need));
  readonly haveLine = computed(() => this.i18n.translate('stationUi.have', { n: formatAmount(this.cost().have) }));
  readonly art = computed<StationArt | null>(() => {
    const c = this.cost();
    if (c.art) return c.art;
    if (c.kind === 'gold') return artFor('gold');
    if (c.kind === 'essence') return artFor('essence');
    return artFor(c.id);
  });
}
