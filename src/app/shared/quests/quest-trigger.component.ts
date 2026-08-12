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
      <span class="qt__icon" aria-hidden="true">&#9876;&#65039;</span>
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
      border-color: rgba(0, 255, 204, 0.45);
      box-shadow: 0 0 20px -8px rgba(0, 255, 204, .7);
    }
    .qt__icon { font-size: 17px; line-height: 1; }

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
