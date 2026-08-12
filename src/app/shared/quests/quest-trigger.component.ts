/**
 * quest-trigger.component.ts — the ⚔️ in the header.
 *
 * Only the button. The panel it opens lives in QuestDrawerComponent, which is
 * mounted next to the header rather than inside it — see the note on
 * `QuestService.drawerOpen$` for why that separation is not optional.
 *
 * Two instances are mounted, one per breakpoint (the desktop dock and the
 * mobile control row), exactly as the XP bar already does. They share one piece
 * of state, so whichever is visible is always in sync.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { QuestBoard, QuestService } from './quest.service';

@Component({
  selector: 'app-quest-trigger',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="qt__trigger"
      [class.qt__trigger--ready]="board.unclaimed > 0"
      [class.qt__trigger--open]="open"
      (click)="toggle()"
      [attr.aria-expanded]="open"
      aria-haspopup="dialog"
      [attr.aria-label]="label">
      <!-- Crossed blades, drawn. An emoji here rendered as a different icon on
           every platform and as a colour-font glyph that ignored the bar's
           palette entirely. -->
      <span class="qt__icon" aria-hidden="true">
        <span class="qt__blade"></span>
        <span class="qt__blade"></span>
      </span>
      @if (badgeCount > 0) {
        <span class="qt__badge" aria-hidden="true">{{ badgeCount }}</span>
      }
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }

    .qt__trigger {
      position: relative;
      display: grid; place-items: center;
      width: 44px; height: 44px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(10, 6, 26, 0.55);
      cursor: pointer;
      transition: border-color .25s ease, box-shadow .25s ease;
    }
    .qt__trigger:hover,
    .qt__trigger--open {
      border-color: rgba(139, 92, 246, 0.45);
      box-shadow: 0 0 20px -8px rgba(139, 92, 246, .7);
    }
    .qt__icon { position: relative; display: block; width: 18px; height: 18px; }

    /* Steel blade, gold hilt, and a crossguard at the join. The guard is what
       stops this reading as a plain X — without it the icon was the same
       shape as the Void sigil in the same bar, at the same size. */
    .qt__blade {
      position: absolute;
      top: 50%; left: 50%;
      width: 17px; height: 2px;
      margin: -1px 0 0 -8.5px;
      border-radius: 1px 1px 1px 0;
      background: linear-gradient(90deg, #C9A84C 0%, #C9A84C 26%, #e9eef7 30%, #ffffff 100%);
    }
    /* Crossguard: a short perpendicular bar at the hilt end. */
    .qt__blade::after {
      content: '';
      position: absolute;
      left: 4px; top: -2.5px;
      width: 2px; height: 7px;
      border-radius: 1px;
      background: #C9A84C;
    }
    .qt__blade:nth-child(1) { transform: rotate(45deg); }
    .qt__blade:nth-child(2) { transform: rotate(-45deg); }

    /* A reward is waiting — the only state that earns a standing animation. */
    .qt__trigger--ready { border-color: rgba(201, 168, 76, .6); animation: qtPulse 2.8s ease-in-out infinite; }
    @keyframes qtPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(201, 168, 76, .45); }
      50%      { box-shadow: 0 0 20px 2px rgba(201, 168, 76, .45); }
    }

    .qt__badge {
      position: absolute; top: -2px; right: -2px;
      min-width: 17px; height: 17px; padding: 0 4px;
      display: grid; place-items: center;
      border-radius: 999px;
      background: #C9A84C; color: #0b0716;
      font: 700 10px/1 'Orbitron', system-ui, sans-serif;
    }

    @media (prefers-reduced-motion: reduce) {
      .qt__trigger--ready { animation: none; box-shadow: 0 0 14px -4px rgba(201, 168, 76, .5); }
    }
  `],
})
export class QuestTriggerComponent implements OnInit, OnDestroy {
  private readonly quests = inject(QuestService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();

  board: QuestBoard = this.quests.board;
  open = false;

  ngOnInit(): void {
    this.quests.init();
    this.subs.add(this.quests.board$.subscribe(b => {
      this.board = b;
      this.cdr.markForCheck();
    }));
    this.subs.add(this.quests.drawerOpen$.subscribe(o => {
      this.open = o;
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /**
   * Claimable first, otherwise dailies and weeklies still in progress. One
   * number with two meanings; the accessible label says which one it is.
   */
  get badgeCount(): number {
    return this.board.unclaimed || this.board.openCount;
  }

  get label(): string {
    const { unclaimed, openCount } = this.board;
    if (unclaimed > 0) {
      return `Quest log. ${unclaimed} reward${unclaimed === 1 ? '' : 's'} ready to claim.`;
    }
    return `Quest log. ${openCount} quest${openCount === 1 ? '' : 's'} in progress.`;
  }

  toggle(): void {
    this.quests.toggleDrawer();
  }
}
