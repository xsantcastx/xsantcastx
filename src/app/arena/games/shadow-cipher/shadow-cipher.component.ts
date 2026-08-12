/**
 * shadow-cipher.component.ts — "Shadow Cipher", the Arena's ordering puzzle.
 *
 * Ten pages of the Codex, each with its lines shuffled. Put them back.
 *
 * Correctness is a *text* comparison, not a comparison of where each row came
 * from. Two rows can legitimately hold the same text — `  }` closes more than
 * one block on the later pages — and an arrangement that reads correctly must
 * be accepted no matter which of the identical rows landed where. Checking
 * identities instead would fail a page the player has visibly solved, which is
 * the worst bug a puzzle can have.
 *
 * Pure DOM, no drag-and-drop: every row moves with a pair of real buttons, and
 * tapping two rows swaps them. Drag-and-drop is the obvious idiom here and it
 * is miserable on a touch screen inside a scrolling page.
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
import { RouterLink } from '@angular/router';
import { ArenaShellComponent } from '../arena-shell.component';
import { ArenaGameBase } from '../arena-game.base';
import { RunResult } from '../arena-scores.service';
import { CODEX_PAGES, CodexPage } from './codex-pages';

interface Row {
  id: number;
  text: string;
  /** 1-based position revealed by a hint, or 0 when unhinted. */
  hintAt: number;
}

/** XP taken off the first-clear reward for each whisper from the Nocturne. */
export const HINT_COST = 15;
/** However many hints are burned, a full restoration still pays this much. */
export const MIN_REWARD = 25;

@Component({
  selector: 'app-shadow-cipher',
  standalone: true,
  imports: [CommonModule, RouterLink, ArenaShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shadow-cipher.component.html',
  styleUrls: ['../arena-game.css', './shadow-cipher.component.css'],
})
export class ShadowCipherComponent extends ArenaGameBase implements OnInit, OnDestroy {
  readonly gameId = 'shadow-cipher';
  readonly hintCost = HINT_COST;
  readonly totalPages = CODEX_PAGES.length;

  private readonly cdr = inject(ChangeDetectorRef);

  phase: 'intro' | 'playing' | 'done' = 'intro';
  pageIndex = 0;
  page: CodexPage = CODEX_PAGES[0];
  rows: Row[] = [];
  hintsUsed = 0;
  seconds = 0;
  /** Set between pages so the restored page can be shown before moving on. */
  restored = false;
  /** Index of the row waiting to be swapped, or -1. */
  selected = -1;
  result: RunResult | null = null;

  private clock: ReturnType<typeof setInterval> | null = null;
  private advance: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;

  async ngOnInit(): Promise<void> {
    await this.resolveGate();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.stopClock();
    if (this.advance) clearTimeout(this.advance);
  }

  get timeLabel(): string {
    const m = Math.floor(this.seconds / 60);
    return `${m}:${String(this.seconds % 60).padStart(2, '0')}`;
  }

  /** What a full restoration would pay right now, after hint costs. */
  get projectedReward(): number {
    const full = this.game?.xpReward ?? 100;
    return Math.max(MIN_REWARD, full - this.hintsUsed * HINT_COST);
  }

  start(): void {
    this.phase = 'playing';
    this.pageIndex = 0;
    this.hintsUsed = 0;
    this.seconds = 0;
    this.result = null;
    this.restored = false;
    this.loadPage();

    this.stopClock();
    this.clock = setInterval(() => {
      this.seconds++;
      this.cdr.markForCheck();
    }, 1000);
  }

  private loadPage(): void {
    this.page = CODEX_PAGES[this.pageIndex];
    this.selected = -1;
    this.rows = this.scramble(this.page.lines);
  }

  /**
   * Shuffle until the result is not already the answer. Re-rolling is bounded:
   * a three-line page has six arrangements and five of them are wrong, so this
   * terminates immediately in practice, and the counter stops a pathological
   * one-line page from spinning forever.
   */
  private scramble(lines: string[]): Row[] {
    const solution = lines.join('\n');
    let out = lines.slice();

    for (let attempt = 0; attempt < 20; attempt++) {
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      if (out.join('\n') !== solution) break;
    }

    return out.map(text => ({ id: this.nextId++, text, hintAt: 0 }));
  }

  // ── moving lines ────────────────────────────────────────────

  moveUp(i: number): void {
    if (i <= 0) return;
    this.swap(i, i - 1);
  }

  moveDown(i: number): void {
    if (i >= this.rows.length - 1) return;
    this.swap(i, i + 1);
  }

  /** Tap one row then another to swap them — the fast path on a phone. */
  tap(i: number): void {
    if (this.selected === -1) {
      this.selected = i;
      return;
    }
    if (this.selected === i) {
      this.selected = -1;
      return;
    }
    this.swap(this.selected, i);
    this.selected = -1;
  }

  private swap(a: number, b: number): void {
    if (this.restored) return;
    [this.rows[a], this.rows[b]] = [this.rows[b], this.rows[a]];
    this.check();
  }

  /** True when the row at `i` holds the line that belongs there. */
  isPlaced(i: number): boolean {
    return this.rows[i]?.text === this.page.lines[i];
  }

  private check(): void {
    if (this.rows.map(r => r.text).join('\n') !== this.page.lines.join('\n')) return;

    this.restored = true;
    this.selected = -1;
    this.cdr.markForCheck();

    // Hold the solved page on screen for a beat — advancing instantly reads as
    // the page having been swapped out from under you.
    this.advance = setTimeout(() => {
      this.restored = false;
      this.advance = null;
      if (this.pageIndex >= CODEX_PAGES.length - 1) {
        this.finish();
      } else {
        this.pageIndex++;
        this.loadPage();
      }
      this.cdr.markForCheck();
    }, 850);
  }

  // ── hints ───────────────────────────────────────────────────

  /**
   * The Nocturne whispers one position: the first slot that is wrong, and which
   * row belongs in it. It does not move anything — the player still has to do
   * the work, they just stop guessing.
   */
  hint(): void {
    if (this.restored) return;

    const wrongSlot = this.page.lines.findIndex((line, i) => this.rows[i]?.text !== line);
    if (wrongSlot === -1) return;

    const wanted = this.page.lines[wrongSlot];
    // With duplicate lines, prefer a row that is not already correctly placed,
    // so the hint never points at a row the player should leave alone.
    const rowIndex = this.rows.findIndex(
      (r, i) => r.text === wanted && this.page.lines[i] !== r.text
    );
    if (rowIndex === -1) return;

    if (this.rows[rowIndex].hintAt === wrongSlot + 1) return; // already whispered
    this.rows[rowIndex].hintAt = wrongSlot + 1;
    this.hintsUsed++;
    this.cdr.markForCheck();
  }

  // ── end ─────────────────────────────────────────────────────

  private finish(): void {
    this.stopClock();
    this.phase = 'done';
    // The ledger scores this game in pages restored, so a partial run and a
    // full one are comparable on the same axis.
    this.result = this.finishRun(CODEX_PAGES.length, true, this.projectedReward);
  }

  /** Leaving early still banks the pages that were restored. */
  giveUp(): void {
    this.stopClock();
    this.phase = 'done';
    this.result = this.finishRun(this.pageIndex, false);
    this.cdr.markForCheck();
  }

  playAgain(): void {
    this.phase = 'intro';
    this.result = null;
    this.cdr.markForCheck();
  }

  private stopClock(): void {
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  get cleared(): boolean {
    return this.result !== null && this.result.score >= CODEX_PAGES.length;
  }

  trackRow = (_: number, row: Row) => row.id;
}
