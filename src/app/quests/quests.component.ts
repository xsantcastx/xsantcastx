/**
 * quests.component.ts — /quests, the full mission board.
 *
 * The drawer is the glance; this is the read. Same cards, but with the epic
 * ladder, the history and the running totals that would make the drawer a
 * scroll rather than a summary.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { QuestBoard, QuestLogEntry, QuestService } from '../shared/quests/quest.service';
import { QuestCardComponent } from '../shared/quests/quest-card.component';
import { ChallengePanelComponent } from '../shared/challenges/challenge-panel.component';
import { countdownTo } from '../shared/quests/quest-drawer.component';

import { RelatedPagesComponent } from '../shared/seo/related-pages.component';
/** History rows are grouped under a day heading. */
interface LogDay {
  label: string;
  entries: QuestLogEntry[];
  xp: number;
}

@Component({
  selector: 'app-quests',
  standalone: true,
  imports: [RelatedPagesComponent, CommonModule, RouterLink, QuestCardComponent, ChallengePanelComponent],
  templateUrl: './quests.component.html',
  styleUrls: ['./quests.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestsComponent implements OnInit, OnDestroy {
  private readonly quests = inject(QuestService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly subs = new Subscription();
  private ticker: ReturnType<typeof setInterval> | null = null;

  board: QuestBoard = this.quests.board;
  dailyCountdown = '—';
  weeklyCountdown = '—';
  historyOpen = false;
  history: LogDay[] = [];

  ngOnInit(): void {
    this.quests.init();

    this.subs.add(this.quests.board$.subscribe(b => {
      this.board = b;
      this.history = groupLog(b.log);
      this.recount();
      this.cdr.markForCheck();
    }));

    if (this.isBrowser) {
      this.recount();
      // A minute is enough on a page you read — the drawer ticks every second
      // because it is glanced at, this one is not.
      this.ticker = setInterval(() => {
        this.recount();
        this.cdr.markForCheck();
      }, 60_000);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.ticker) clearInterval(this.ticker);
  }

  onClaim(id: string): void {
    this.quests.claim(id);
  }

  toggleHistory(): void {
    this.historyOpen = !this.historyOpen;
  }

  get epicCleared(): number {
    return this.board.epic.filter(q => q.claimed).length;
  }

  private recount(): void {
    this.dailyCountdown = countdownTo(this.board.dailyResetAt);
    this.weeklyCountdown = countdownTo(this.board.weeklyResetAt);
  }
}

/**
 * Group the log into days, newest first, and keep the last seven that have
 * anything in them. Seven *days with entries* rather than seven calendar days —
 * a week with two quiet days should still show a week of history.
 */
function groupLog(log: QuestLogEntry[]): LogDay[] {
  const byDay = new Map<string, QuestLogEntry[]>();

  for (const entry of log) {
    const d = new Date(entry.at);
    if (Number.isNaN(d.getTime())) continue;
    const key = dateKey(d);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(entry);
    else byDay.set(key, [entry]);
  }

  const todayKey = dateKey(new Date());
  const yesterdayKey = dateKey(new Date(Date.now() - 86_400_000));

  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([key, entries]) => ({
      label: key === todayKey ? 'Today' : key === yesterdayKey ? 'Yesterday' : key,
      entries,
      xp: entries.reduce((sum, e) => sum + e.xp, 0),
    }));
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
