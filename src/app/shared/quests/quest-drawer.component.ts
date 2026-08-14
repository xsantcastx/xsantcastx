/**
 * quest-drawer.component.ts — the slide-out board, and only the board.
 *
 * Mounted in AppComponent as a sibling of the header, NOT inside it. The ⚔️
 * that opens it is QuestTriggerComponent, up in the navbar; the two talk
 * through `QuestService.drawerOpen$`.
 *
 * That separation is the whole point of this file's placement. `.navbar` is
 * `position: fixed` with `z-index: 1000`, which makes it a stacking context —
 * any positioned element inside it paints above the logo and the language
 * toggle regardless of how low its own z-index is, and swallows every click on
 * them. That is exactly the failure v2.1.0 spent a release fixing for the
 * mobile menu. Rendering the panel and its backdrop out here puts them in the
 * page's stacking context, below the navbar, where a backdrop can dim the page
 * without capturing the header.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { QuestBoard, QuestService } from './quest.service';
import { QuestCardComponent } from './quest-card.component';

@Component({
  selector: 'app-quest-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, QuestCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div class="qd__backdrop" (click)="close()" aria-hidden="true"></div>

      <aside class="qd__panel" role="dialog" aria-label="Quest log" aria-modal="false">
        <header class="qd__head">
          <div>
            <p class="qd__eyebrow"><span class="qd__pulse"></span>Mission Board</p>
            <h2 class="qd__title">Daily Quests</h2>
          </div>
          <button type="button" class="qd__close" (click)="close()" aria-label="Close quest log">&#10005;</button>
        </header>

        <p class="qd__timer">Resets in {{ dailyCountdown }}</p>

        <div class="qd__list">
          @for (q of board.daily; track q.id) {
            <app-quest-card [quest]="q" (claim)="onClaim($event)"></app-quest-card>
          } @empty {
            <p class="qd__empty">The board is being redrawn.</p>
          }
        </div>

        <h3 class="qd__section">Weekly Quests</h3>
        <p class="qd__timer">Resets in {{ weeklyCountdown }}</p>
        <div class="qd__list">
          @for (q of board.weekly; track q.id) {
            <app-quest-card [quest]="q" (claim)="onClaim($event)"></app-quest-card>
          }
        </div>

        <a routerLink="/world/quests" class="qd__all" (click)="close()">
          View your epic journey &rarr;
        </a>
      </aside>
    }
  `,
  styles: [`
    /* Below the navbar's 1000 so the header stays clickable while the board is
       open, above the page so the board is not tinted by it. */
    .qd__backdrop {
      position: fixed; inset: 0; z-index: 90;
      background:
        radial-gradient(ellipse 70% 50% at 50% 0%, rgba(139, 92, 246, 0.06), transparent 65%),
        radial-gradient(ellipse 60% 50% at 50% 100%, rgba(123, 97, 255, 0.08), transparent 65%),
        rgba(3, 2, 10, 0.72);
      animation: qdFade .3s ease;
    }
    @keyframes qdFade { from { opacity: 0; } to { opacity: 1; } }

    .qd__panel {
      position: fixed; z-index: 91;
      top: var(--nav-h, 64px); right: 0;
      width: min(380px, 100vw);
      /* dvh, not vh: on mobile vh is the *large* viewport, and the last card
         ends up behind the URL bar. */
      height: calc(100dvh - var(--nav-h, 64px));
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 18px 16px 32px;
      border-left: 1px solid rgba(139, 92, 246, 0.18);
      background:
        radial-gradient(ellipse 80% 40% at 20% 0%, rgba(139, 92, 246, 0.08), transparent 65%),
        radial-gradient(ellipse 70% 40% at 90% 100%, rgba(123, 97, 255, 0.10), transparent 65%),
        rgba(6, 4, 18, 0.96);
      box-shadow: -20px 0 60px -30px rgba(0, 0, 0, 0.95);
      animation: qdIn .32s cubic-bezier(.22, 1, .36, 1) both;
    }
    /* The "both" fill-mode on the shorthand above matters: the panel is
       position:fixed and right-anchored, so a transform left hanging by an
       interrupted animation would park it off the right edge of the viewport. */
    @keyframes qdIn {
      from { transform: translateX(20px); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }

    .qd__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .qd__eyebrow {
      display: flex; align-items: center; gap: 6px;
      margin: 0 0 4px;
      font: 600 10px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .14em; text-transform: uppercase; color: #7fd5a3;
    }
    .qd__pulse {
      width: 6px; height: 6px; border-radius: 50%;
      background: #7fd5a3; animation: qdDot 3s ease-in-out infinite;
    }
    @keyframes qdDot { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }

    .qd__title { margin: 0; font: 700 18px/1.2 'Orbitron', system-ui, sans-serif; color: #F2ECFF; }

    .qd__close {
      min-width: 44px; min-height: 44px;
      border: none; background: none; color: #9fb4ae;
      font-size: 16px; cursor: pointer;
    }
    .qd__close:hover { color: #A78BFA; }

    .qd__timer { margin: 6px 0 12px; font-size: 11px; color: #8fa09b; }

    .qd__list { display: grid; gap: 10px; }

    .qd__section {
      margin: 24px 0 0;
      font: 600 12px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .1em; text-transform: uppercase; color: #c48bff;
    }

    .qd__empty { font-size: 12px; color: #6d817c; font-style: italic; }

    .qd__all {
      display: block; margin-top: 22px; padding: 12px;
      text-align: center; border-radius: 12px;
      border: 1px solid rgba(196, 139, 255, 0.28);
      background: rgba(123, 97, 255, 0.08);
      color: #c48bff; text-decoration: none;
      font: 600 12px/1 'Orbitron', system-ui, sans-serif;
      min-height: 44px;
    }
    .qd__all:hover { background: rgba(123, 97, 255, 0.16); }

    /* On desktop the XP bar and the ⚔️ are docked just under the navbar, and
       they are inside the navbar's z-index:1000 context, so they paint over
       anything this panel puts in that band. Start below them instead of
       fighting a stacking context we deliberately stayed out of.
       Dock geometry: nav-h + 8px margin + 44px control = nav-h + 52px. */
    @media (min-width: 961px) {
      .qd__panel {
        top: calc(var(--nav-h, 64px) + 62px);
        height: calc(100dvh - var(--nav-h, 64px) - 62px);
      }
    }

    /* Full-screen on a phone — a 380px drawer in a 375px viewport is just a
       page with a seam down one side. */
    @media (max-width: 480px) {
      .qd__panel { width: 100vw; border-left: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .qd__panel, .qd__backdrop { animation: none; }
      .qd__pulse { animation: none; }
    }
  `],
})
export class QuestDrawerComponent implements OnInit, OnDestroy {
  private readonly quests = inject(QuestService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly subs = new Subscription();
  private ticker: ReturnType<typeof setInterval> | null = null;

  open = false;
  board: QuestBoard = this.quests.board;
  dailyCountdown = '—';
  weeklyCountdown = '—';

  ngOnInit(): void {
    this.quests.init();

    this.subs.add(this.quests.board$.subscribe(b => {
      this.board = b;
      this.recount();
      this.cdr.markForCheck();
    }));

    this.subs.add(this.quests.drawerOpen$.subscribe(o => {
      this.open = o;
      if (o) this.recount();
      this.cdr.markForCheck();
    }));

    // Navigating with the board open leaves it hanging over the new page.
    this.subs.add(
      this.router.events
        .pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(() => this.close()),
    );

    if (this.isBrowser) {
      this.recount();
      // Only while open — a countdown nobody is looking at does not need to run.
      this.ticker = setInterval(() => {
        if (!this.open) return;
        this.recount();
        this.cdr.markForCheck();
      }, 1000);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.ticker) clearInterval(this.ticker);
  }

  close(): void {
    this.quests.closeDrawer();
  }

  onClaim(id: string): void {
    this.quests.claim(id);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  private recount(): void {
    this.dailyCountdown = countdownTo(this.board.dailyResetAt);
    this.weeklyCountdown = countdownTo(this.board.weeklyResetAt);
  }
}

/** "4h 23m" / "2d 6h" / "48s". Coarse on purpose — this is flavour, not a timer. */
export function countdownTo(iso: string | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'moments';

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
