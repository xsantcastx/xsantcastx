/**
 * <app-station-journal> — master–detail: list LEFT, the selected thing RIGHT.
 *
 *   <app-station-journal>
 *     <app-journal-list journalList … />
 *     <div journalDetail>
 *       <app-detail-head … />
 *       <app-requirement-grid … />
 *       <app-action-button … />
 *     </div>
 *   </app-station-journal>
 *
 * ≤640px: the list stacks above the detail (and becomes an icon strip).
 * `[single]="true"` when there is no list (one action, e.g. the Rune Forge).
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-station-journal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sj" [class.sj--single]="single()">
      <div class="sj__list"><ng-content select="[journalList]" /></div>
      <div class="sj__detail"><ng-content select="[journalDetail]" /></div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .sj { display: grid; grid-template-columns: minmax(200px, 34%) minmax(0, 1fr); gap: var(--space-3); align-items: start; }
    .sj__list:empty { display: none; }
    .sj--single { grid-template-columns: minmax(0, 1fr); }
    .sj--single .sj__list { display: none; }
    .sj__detail { min-width: 0; display: grid; gap: var(--space-3); }
    @media (max-width: 640px) { .sj { grid-template-columns: minmax(0, 1fr); } }
  `],
})
export class StationJournalComponent {
  /** No list: the detail takes the full width. */
  readonly single = input(false);
}
