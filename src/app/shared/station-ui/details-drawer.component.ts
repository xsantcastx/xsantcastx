/**
 * <app-details-drawer> — where everything that isn't the main action lives.
 *
 *   <app-details-drawer [label]="'Details'" [hint]="'Odds, history, filters'" [(open)]="open">
 *     …lore, odds tables, history, filters, secondary actions…
 *   </app-details-drawer>
 *
 * A native <details>: keyboard, screen-reader and no-JS behaviour for free, and
 * the content stays in the prerendered HTML (a crawler still reads it). Closed
 * by default. Nothing in here is deleted from the game — it is just not the
 * first thing a player has to read.
 */
import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';

import { TranslationService } from '../../translation.service';
import { STATION_UI_I18N } from './station-ui.i18n';

@Component({
  selector: 'app-details-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="dd" [open]="open()" (toggle)="onToggle($event)">
      <summary class="dd__sum">
        <span class="dd__text">
          <span class="dd__label">{{ label() || t('stationUi.details') }}</span>
          <span class="dd__hint">{{ hint() || t('stationUi.detailsHint') }}</span>
        </span>
        <span class="dd__chev" aria-hidden="true"></span>
      </summary>
      <div class="dd__body"><ng-content /></div>
    </details>
  `,
  styleUrls: ['./station-tokens.css', './details-drawer.component.css'],
})
export class DetailsDrawerComponent {
  private readonly i18n = inject(TranslationService);

  readonly label = input<string>('');
  readonly hint = input<string>('');
  /** Two-way: `[(open)]`. */
  readonly open = model(false);

  constructor() { this.i18n.register(STATION_UI_I18N); }

  t(key: string): string { return this.i18n.translate(key); }

  onToggle(event: Event): void {
    const now = (event.target as HTMLDetailsElement).open;
    if (now !== this.open()) this.open.set(now);
  }
}
