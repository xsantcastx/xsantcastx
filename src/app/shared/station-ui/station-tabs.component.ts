/**
 * <app-station-tabs> — the row of tabs across the top of a station journal.
 *
 *   <app-station-tabs [tabs]="tabs" [(active)]="tab" />
 *   tabs: StationTab[] = [{ id: 'ready', label: 'Ready now', badge: 3 }, { id: 'weapon', label: 'Weapons' }]
 *
 * A tab with a `route` is a link (the Forge hub: Crafting · Enchanting · Runes
 * are three routes that read as one station); without one it is a button that
 * sets `active`. One row that scrolls sideways (snap) everywhere; in the world the chosen tab is lit wood, never the
 * primary's brass (ui-pass-3 §5: one brass per window, and it belongs to the action).
 */
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface StationTab {
  id: string;
  label: string;
  /** Optional count shown as a small pill ("3 ready"). */
  badge?: number | null;
  /** When set the tab is a router link instead of a button. */
  route?: string;
}

@Component({
  selector: 'app-station-tabs',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tabs" role="tablist" [attr.aria-label]="label() || null">
      @for (tab of tabs(); track tab.id) {
        @if (tab.route) {
          <a class="tab" [routerLink]="tab.route" [class.is-on]="active() === tab.id"
             [attr.aria-current]="active() === tab.id ? 'page' : null">
            {{ tab.label }}
            @if (tab.badge) { <span class="tab__badge">{{ tab.badge }}</span> }
          </a>
        } @else {
          <button type="button" class="tab" role="tab" [class.is-on]="active() === tab.id" [attr.data-tab]="tab.id"
                  [attr.aria-selected]="active() === tab.id" (click)="pick(tab.id, $event)">
            {{ tab.label }}
            @if (tab.badge) { <span class="tab__badge">{{ tab.badge }}</span> }
          </button>
        }
      }
    </nav>
  `,
  styleUrls: ['./station-tokens.css', './station-tabs.component.css'],
})
export class StationTabsComponent {
  readonly tabs = input.required<readonly StationTab[]>();
  readonly active = model<string>('');
  /** Accessible name for the row ("Forge stations", "Recipe types"). */
  readonly label = input<string>('');

  /** Choose a tab and bring it fully into the row's view (a tab half under the row's edge reads as cut). */
  pick(id: string, ev: Event): void {
    this.active.set(id);
    const el = ev.currentTarget as HTMLElement | null;
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' as ScrollBehavior });
  }
}
