/**
 * <app-requirement-grid> — a titled box of icon cells: "Required items",
 * "Required tools", "Additive". Each cell = icon + name + have/need, green
 * when met, red when short. Gold is a cell like any other.
 *
 *   <app-requirement-grid [title]="'Required items'" [costs]="ctaCosts" [minCells]="4" />
 *
 * `selectable` turns the cells into choices (the Additive box: which rune to
 * add) — `selected` is the chosen cell id and `(pick)` fires on press.
 * `minCells` pads with empty slots so the box keeps its shape, the way a
 * journal page does. `showCount=false` for tools (owned or not, no numbers).
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { artFor } from '../art/art';
import { costShort, formatAmount, type StationArt, type StationCost } from './station-ui.model';

interface Cell { cost: StationCost; art: StationArt | null; met: boolean; have: string; need: string }

@Component({
  selector: 'app-requirement-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rg" [class.rg--pick]="selectable()">
      <h3 class="rg__title"><span class="rg__pip" aria-hidden="true"></span>{{ title() }}</h3>
      <ul class="rg__grid">
        @for (cell of cells(); track $index) {
          <li>
            @if (selectable()) {
              <button type="button" class="rg__cell"
                      [class.is-on]="selected() === cell.cost.id"
                      [class.is-met]="cell.met" [class.is-short]="!cell.met && !pending()"
                      [attr.aria-pressed]="selected() === cell.cost.id"
                      (click)="pick.emit(cell.cost.id || '')">
                <ng-container *ngTemplateOutlet="body; context: { $implicit: cell }" />
              </button>
            } @else {
              <div class="rg__cell" [attr.title]="cell.cost.label" [class.is-met]="cell.met" [class.is-short]="!cell.met && !pending()">
                <ng-container *ngTemplateOutlet="body; context: { $implicit: cell }" />
              </div>
            }
          </li>
        }
        @for (pad of pads(); track $index) {
          <li><div class="rg__cell rg__cell--empty" aria-hidden="true"></div></li>
        }
      </ul>
      @if (!costs().length && empty()) { <p class="rg__empty">{{ empty() }}</p> }
    </section>

    <ng-template #body let-cell>
      <span class="rg__icon">
        @if (cell.art; as a) {
          <img [src]="a.src" [attr.srcset]="a.srcset || null" sizes="36px" alt="" width="36" height="36" loading="lazy" decoding="async">
        } @else {
          <span class="rg__glyph">{{ cell.cost.label.slice(0, 1) }}</span>
        }
      </span>
      <span class="rg__text">
        <span class="rg__name">{{ cell.cost.label }}</span>
        @if (showCount()) {
          <span class="rg__count">@if (pending()) { {{ cell.need }} } @else { {{ cell.have }}/<wbr>{{ cell.need }} }</span>
        }
      </span>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
  styleUrls: ['./station-tokens.css', './requirement-grid.component.css'],
})
export class RequirementGridComponent {
  readonly title = input.required<string>();
  readonly costs = input<readonly StationCost[]>([]);
  readonly minCells = input(0);
  readonly showCount = input(true);
  readonly pending = input(false);
  readonly selectable = input(false);
  readonly selected = input<string | null>(null);
  /** Text when there are no cells ("You have no runes yet"). */
  readonly empty = input<string>('');
  readonly pick = output<string>();

  readonly cells = computed<Cell[]>(() => this.costs().map(cost => ({
    cost,
    art: cost.art ?? (cost.kind === 'gold' ? artFor('gold') : cost.kind === 'essence' ? artFor('essence') : artFor(cost.id)),
    met: costShort(cost) === 0,
    have: formatAmount(cost.have),
    need: formatAmount(cost.need),
  })));
  readonly pads = computed(() => Array.from({ length: Math.max(0, this.minCells() - this.costs().length) }));
}
