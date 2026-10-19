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
    /* By the station's own width too: a sideways phone shows it in a half-screen side panel. */
    @container station (max-width: 640px) { .sj { grid-template-columns: minmax(0, 1fr); } }
    /* In the world: the icon grid centred over the result card; a sideways phone puts the grid LEFT and the card RIGHT (one screen, no scrolling). */
    /* In the world (docs/handoff/nice-menus.md): one column on a phone held upright (the grid as wide as the card under it,
       their edges in line); the grid LEFT and the card RIGHT wherever the window is wide enough (a sideways phone, a desktop). */
    :host-context(.place) .sj { justify-items: stretch; gap: var(--px-u, 8px); }
    :host-context(.place) .sj__detail { width: 100%; gap: var(--px-u, 8px); }
    @container station (min-width: 560px) {
      :host-context(.place) .sj:not(.sj--single) { grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 16px; }
    }
    @media (max-height: 520px) and (orientation: landscape) {
      :host-context(.place) .sj:not(.sj--single) { grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 12px; }
    }
  `],
})
export class StationJournalComponent {
  /** No list: the detail takes the full width. */
  readonly single = input(false);
}
