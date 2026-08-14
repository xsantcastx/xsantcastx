/**
 * arena-shell.component.ts — the frame every Arena game sits in.
 *
 * Holds the page chrome (way back to the Arena, title, lore, best-score chip)
 * and the chained-gate panel shown when the unlocking egg has not been found.
 *
 * Deliberately *not* a route guard. A guard that redirects during prerender
 * bakes a redirect stub into the built HTML and the route becomes unreachable
 * in production even for visitors who have unlocked it. The gate is a rendering
 * decision instead: the server renders the locked state (the honest default for
 * a visitor it has never met) and hydration opens it.
 *
 * The game body is *not* projected through the lock — `ng-content` is
 * instantiated eagerly even inside `@if`, so a projected game would boot its
 * loop behind the veil. Each game guards its own playfield with `@if` and only
 * hands the shell its chrome.
 */
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-arena-shell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ag-page">
      <div class="ag-aura" aria-hidden="true"></div>

      <header class="ag-head">
        <a routerLink="/world/trials" class="ag-back">&larr; The Arena</a>

        <div class="ag-title-row">
          <span class="ag-icon" aria-hidden="true">{{ icon }}</span>
          <h1 class="ag-title">{{ title }}</h1>
        </div>
        <p class="ag-lore">{{ lore }}</p>

        @if (bestLabel && !locked) {
          <p class="ag-best">
            <span class="ag-best__dot" aria-hidden="true"></span>
            Best run — {{ bestLabel }}
          </p>
        }
      </header>

      @if (locked) {
        <section class="ag-gate" role="status">
          <svg class="ag-gate__chain" viewBox="0 0 24 24" width="40" height="40" fill="none"
               stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <h2 class="ag-gate__title">This gate is chained</h2>
          <p class="ag-gate__hint">{{ unlockHint }}</p>
          <a routerLink="/tools" class="ag-btn ag-btn--primary">Go find the secret &rarr;</a>
          <a routerLink="/world/trials" class="ag-gate__alt">or look over the other gates</a>
        </section>
      }

      <ng-content />
    </div>
  `,
  styleUrls: ['./arena-game.css'],
})
export class ArenaShellComponent {
  @Input({ required: true }) title = '';
  @Input() lore = '';
  @Input() icon = '';
  /** Formatted best score, or empty when there is nothing to show. */
  @Input() bestLabel = '';
  @Input() locked = false;
  @Input() unlockHint = '';
}
