/**
 * eclipse-fragments.component.ts — "Eclipse Fragments", the Arena's memory game.
 *
 * Pure DOM: a CSS grid of buttons, each a two-faced card flipped with a 3D
 * transform. No canvas, no timers beyond the one-second clock, and every tile
 * is a real `<button>` so the whole board is keyboard-playable.
 *
 * Scoring normalises to higher-is-better (the Arena ledger assumes it): a
 * difficulty-scaled base, minus time, minus moves, floored at zero. A perfect
 * Eclipse Lord run lands near 2,400; a sloppy one still scores.
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

interface Fragment {
  /** Unique per tile. Two tiles share a `pair`. */
  id: number;
  pair: number;
  color: string;
  glow: string;
  glyph: string;
  name: string;
  flipped: boolean;
  matched: boolean;
}

interface Difficulty {
  id: 'apprentice' | 'convergent' | 'eclipse-lord';
  label: string;
  cols: number;
  rows: number;
  /** Score before time and move penalties. */
  base: number;
}

const DIFFICULTIES: Difficulty[] = [
  { id: 'apprentice',   label: 'Apprentice',   cols: 4, rows: 3, base: 600 },
  { id: 'convergent',   label: 'Convergent',   cols: 4, rows: 4, base: 1200 },
  { id: 'eclipse-lord', label: 'Eclipse Lord', cols: 6, rows: 5, base: 2400 },
];

/**
 * Fifteen fragments — enough for the 6x5 board. Colours are the site palette
 * plus the realm energies; each carries a glyph as well, so the board is still
 * playable without colour vision.
 */
const FRAGMENTS: ReadonlyArray<{ color: string; glow: string; glyph: string; name: string }> = [
  { color: '#A78BFA', glow: 'rgba(139, 92, 246, 0.6)',   glyph: '✦', name: 'Verge' },
  { color: '#c89868', glow: 'rgba(200, 152, 104, 0.6)',  glyph: '☀', name: 'Aether' },
  { color: '#a48bff', glow: 'rgba(140, 110, 255, 0.6)', glyph: '☾', name: 'Nox' },
  { color: '#ff6dd7', glow: 'rgba(255, 90, 210, 0.6)',  glyph: '❋', name: 'Bloom' },
  { color: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.6)',  glyph: '◈', name: 'Tide' },
  { color: '#7fd5a3', glow: 'rgba(100, 220, 150, 0.6)', glyph: '❖', name: 'Grove' },
  { color: '#ff9a5a', glow: 'rgba(255, 140, 60, 0.6)',  glyph: '⌘', name: 'Forge' },
  { color: '#c48bff', glow: 'rgba(180, 120, 255, 0.6)', glyph: '✧', name: 'Echo' },
  { color: '#e8c898', glow: 'rgba(255, 180, 80, 0.6)',  glyph: '⚚', name: 'Ember' },
  { color: '#C4B5FD', glow: 'rgba(196, 181, 253, 0.6)',   glyph: '⟁', name: 'Prism' },
  { color: '#ff2d4d', glow: 'rgba(255, 45, 77, 0.6)',   glyph: '☓', name: 'Rift' },
  { color: '#e8ecf1', glow: 'rgba(232, 236, 241, 0.5)', glyph: '◇', name: 'Mote' },
  { color: '#8affc1', glow: 'rgba(110, 255, 190, 0.6)', glyph: '⌾', name: 'Halo' },
  { color: '#ffa8d8', glow: 'rgba(255, 168, 216, 0.6)', glyph: '⁂', name: 'Veil' },
  { color: '#89b4ff', glow: 'rgba(137, 180, 255, 0.6)', glyph: '⟡', name: 'Spire' },
];

/** How long a mismatched pair stays face up before it turns back. */
const PEEK_MS = 780;

@Component({
  selector: 'app-eclipse-fragments',
  standalone: true,
  imports: [CommonModule, RouterLink, ArenaShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './eclipse-fragments.component.html',
  styleUrls: ['../arena-game.css', './eclipse-fragments.component.css'],
})
export class EclipseFragmentsComponent extends ArenaGameBase implements OnInit, OnDestroy {
  readonly gameId = 'color-memory';
  private readonly cdr = inject(ChangeDetectorRef);

  readonly difficulties = DIFFICULTIES;
  difficulty: Difficulty = DIFFICULTIES[1];

  phase: 'intro' | 'playing' | 'won' = 'intro';
  tiles: Fragment[] = [];
  moves = 0;
  matches = 0;
  seconds = 0;
  result: RunResult | null = null;

  /** Blocks input while a mismatched pair is being shown. */
  private busy = false;
  private firstPick: Fragment | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;
  private peek: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    await this.resolveGate();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.stopClock();
    if (this.peek) clearTimeout(this.peek);
  }

  get pairCount(): number {
    return (this.difficulty.cols * this.difficulty.rows) / 2;
  }

  get timeLabel(): string {
    const m = Math.floor(this.seconds / 60);
    const s = this.seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Live score, so the HUD can show what the run is currently worth. */
  get liveScore(): number {
    return Math.max(0, this.difficulty.base - this.seconds * 3 - this.moves * 8);
  }

  choose(d: Difficulty): void {
    this.difficulty = d;
  }

  start(): void {
    this.stopClock();
    if (this.peek) clearTimeout(this.peek);

    this.tiles = this.deal();
    this.moves = 0;
    this.matches = 0;
    this.seconds = 0;
    this.result = null;
    this.firstPick = null;
    this.busy = false;
    this.phase = 'playing';

    // The clock only exists in the browser; on the server this component never
    // reaches `start()` because the gate renders locked.
    this.clock = setInterval(() => {
      this.seconds++;
      this.cdr.markForCheck();
    }, 1000);
  }

  /**
   * Build a shuffled board. Fragments are picked from the front of the palette
   * so a 4x3 board is always the same six realms — recognisable — while the
   * *positions* are what change between runs.
   */
  private deal(): Fragment[] {
    const pairs = this.pairCount;
    const deck: Fragment[] = [];
    let id = 0;

    for (let p = 0; p < pairs; p++) {
      const f = FRAGMENTS[p % FRAGMENTS.length];
      for (let copy = 0; copy < 2; copy++) {
        deck.push({ id: id++, pair: p, ...f, flipped: false, matched: false });
      }
    }

    // Fisher-Yates. Math.random is fine here: a memory board needs to be
    // unpredictable, not cryptographically so.
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  flip(tile: Fragment): void {
    if (this.phase !== 'playing' || this.busy || tile.flipped || tile.matched) return;

    tile.flipped = true;

    if (!this.firstPick) {
      this.firstPick = tile;
      return;
    }

    this.moves++;
    const first = this.firstPick;
    this.firstPick = null;

    if (first.pair === tile.pair) {
      first.matched = tile.matched = true;
      this.matches++;
      if (this.matches === this.pairCount) this.win();
      return;
    }

    // Mismatch: hold both face up long enough to be memorised, then turn back.
    this.busy = true;
    this.peek = setTimeout(() => {
      first.flipped = tile.flipped = false;
      this.busy = false;
      this.peek = null;
      this.cdr.markForCheck();
    }, PEEK_MS);
  }

  private win(): void {
    this.stopClock();
    this.phase = 'won';
    this.result = this.finishRun(this.liveScore, true);
    this.cdr.markForCheck();
  }

  playAgain(): void {
    this.phase = 'intro';
    this.tiles = [];
    this.result = null;
  }

  private stopClock(): void {
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  label(tile: Fragment): string {
    if (tile.matched) return `${tile.name} fragment, matched`;
    if (tile.flipped) return `${tile.name} fragment, face up`;
    return 'Face-down fragment';
  }

  trackTile = (_: number, tile: Fragment) => tile.id;
}
