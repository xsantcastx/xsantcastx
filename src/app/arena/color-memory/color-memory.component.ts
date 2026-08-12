import {
  Component,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  PLATFORM_ID,
  inject,
  signal,
  computed
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { XpService } from '../../shared/gamification/xp.service';

/** One eclipse fragment — a colour + glyph pair identity. */
interface Fragment {
  /** pair identity — two tiles share this */
  key: string;
  color: string;
  glow: string;
  glyph: string;
  name: string;
}

export interface Tile {
  id: number;
  fragment: Fragment;
  flipped: boolean;
  matched: boolean;
}

export type Difficulty = 'orbit' | 'eclipse';

/**
 * Fragment pool — colours come straight from the cosmic palette in CLAUDE.md §2.
 * Each entry is a unique colour+glyph combination so a 6x6 board still has
 * 18 visually distinct pairs without inventing new brand colours.
 */
const FRAGMENTS: Fragment[] = [
  { key: 'cyan-star',    color: '#4dffe0', glow: 'rgba(0, 255, 204, 0.6)',   glyph: '✦', name: 'Cyan Star' },
  { key: 'teal-moon',    color: '#6affe0', glow: 'rgba(0, 220, 220, 0.6)',   glyph: '☾', name: 'Teal Moon' },
  { key: 'magenta-sun',  color: '#ff6dd7', glow: 'rgba(255, 90, 210, 0.6)',  glyph: '☀', name: 'Magenta Sun' },
  { key: 'violet-eye',   color: '#a48bff', glow: 'rgba(140, 110, 255, 0.6)', glyph: '◉', name: 'Violet Eye' },
  { key: 'blue-comet',   color: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.6)',  glyph: '☄', name: 'Blue Comet' },
  { key: 'amber-ring',   color: '#ffc669', glow: 'rgba(255, 180, 80, 0.6)',  glyph: '◎', name: 'Amber Ring' },
  { key: 'orange-flare', color: '#ff9a5a', glow: 'rgba(255, 140, 60, 0.6)',  glyph: '✧', name: 'Orange Flare' },
  { key: 'lilac-void',   color: '#c48bff', glow: 'rgba(180, 120, 255, 0.6)', glyph: '❖', name: 'Lilac Void' },
  { key: 'mint-orbit',   color: '#7fd5a3', glow: 'rgba(100, 220, 150, 0.6)', glyph: '⬡', name: 'Mint Orbit' },
  { key: 'cyan-crux',    color: '#4dffe0', glow: 'rgba(0, 255, 204, 0.6)',   glyph: '✶', name: 'Cyan Crux' },
  { key: 'teal-arc',     color: '#6affe0', glow: 'rgba(0, 220, 220, 0.6)',   glyph: '◐', name: 'Teal Arc' },
  { key: 'magenta-halo', color: '#ff6dd7', glow: 'rgba(255, 90, 210, 0.6)',  glyph: '◍', name: 'Magenta Halo' },
  { key: 'violet-rune',  color: '#a48bff', glow: 'rgba(140, 110, 255, 0.6)', glyph: '⟁', name: 'Violet Rune' },
  { key: 'blue-shard',   color: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.6)',  glyph: '◈', name: 'Blue Shard' },
  { key: 'amber-spark',  color: '#ffc669', glow: 'rgba(255, 180, 80, 0.6)',  glyph: '✷', name: 'Amber Spark' },
  { key: 'orange-cusp',  color: '#ff9a5a', glow: 'rgba(255, 140, 60, 0.6)',  glyph: '◑', name: 'Orange Cusp' },
  { key: 'lilac-sigil',  color: '#c48bff', glow: 'rgba(180, 120, 255, 0.6)', glyph: '⧫', name: 'Lilac Sigil' },
  { key: 'mint-nova',    color: '#7fd5a3', glow: 'rgba(100, 220, 150, 0.6)', glyph: '✵', name: 'Mint Nova' }
];

/**
 * Best time is game-local and lives here; lifetime XP is not — that belongs to
 * XpService, which owns the one progression record the whole site reads.
 */
const BEST_STORAGE_KEY = 'xsantcastx-color-memory-best';
const FLIP_BACK_MS = 900;

@Component({
  selector: 'app-color-memory',
  standalone: true,
  templateUrl: './color-memory.component.html',
  styleUrls: ['./color-memory.component.css']
})
export class ColorMemoryComponent implements OnDestroy {
  /** Emitted when the player closes the game. */
  @Output() closed = new EventEmitter<void>();

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly xp = inject(XpService);

  readonly difficulty = signal<Difficulty>('orbit');
  readonly tiles = signal<Tile[]>([]);
  readonly moves = signal(0);
  readonly elapsedMs = signal(0);
  readonly started = signal(false);
  readonly won = signal(false);
  readonly xpEarned = signal(0);
  readonly totalXp = signal(0);
  readonly bestTimeMs = signal<number | null>(null);
  /** Set while a mismatched pair is showing — blocks further flips. */
  readonly busy = signal(false);

  readonly columns = computed(() => (this.difficulty() === 'orbit' ? 4 : 6));
  readonly pairCount = computed(() => (this.difficulty() === 'orbit' ? 8 : 18));
  readonly matchedCount = computed(() => this.tiles().filter(t => t.matched).length / 2);

  readonly elapsedLabel = computed(() => {
    const total = Math.floor(this.elapsedMs() / 1000);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  readonly bestLabel = computed(() => {
    const best = this.bestTimeMs();
    if (best === null) return '—';
    const total = Math.floor(best / 1000);
    return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
  });

  private firstPick: Tile | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private flipBackId: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;

  constructor() {
    this.bestTimeMs.set(this.readNumber(BEST_STORAGE_KEY, 0) || null);
    this.xp.init(); // idempotent — the header usually got here first
    this.xp.snapshot$.pipe(takeUntilDestroyed()).subscribe(s => this.totalXp.set(s.xp));
    this.deal();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.flipBackId !== null) clearTimeout(this.flipBackId);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.stopTimer();
    this.closed.emit();
  }

  setDifficulty(level: Difficulty): void {
    if (this.difficulty() === level) return;
    this.difficulty.set(level);
    this.deal();
  }

  /** Build (or rebuild) the board. */
  deal(): void {
    this.stopTimer();
    if (this.flipBackId !== null) {
      clearTimeout(this.flipBackId);
      this.flipBackId = null;
    }
    this.firstPick = null;
    this.busy.set(false);
    this.moves.set(0);
    this.elapsedMs.set(0);
    this.started.set(false);
    this.won.set(false);
    this.xpEarned.set(0);

    const chosen = FRAGMENTS.slice(0, this.pairCount());
    const deck: Tile[] = [];
    let id = 0;
    for (const fragment of chosen) {
      deck.push({ id: id++, fragment, flipped: false, matched: false });
      deck.push({ id: id++, fragment, flipped: false, matched: false });
    }
    this.tiles.set(this.shuffle(deck));
  }

  flip(tile: Tile): void {
    if (this.busy() || tile.flipped || tile.matched || this.won()) return;

    if (!this.started()) {
      this.started.set(true);
      this.startTimer();
    }

    this.patch(tile.id, { flipped: true });

    if (!this.firstPick) {
      this.firstPick = tile;
      return;
    }

    const first = this.firstPick;
    this.firstPick = null;
    this.moves.update(m => m + 1);

    if (first.fragment.key === tile.fragment.key) {
      this.patch(first.id, { matched: true });
      this.patch(tile.id, { matched: true });
      if (this.tiles().every(t => t.matched)) this.finish();
      return;
    }

    // Mismatch — show both briefly, then flip back.
    this.busy.set(true);
    this.flipBackId = setTimeout(() => {
      this.patch(first.id, { flipped: false });
      this.patch(tile.id, { flipped: false });
      this.busy.set(false);
      this.flipBackId = null;
    }, FLIP_BACK_MS);
  }

  /** Keyboard access — Enter/Space activate through the native button. */
  tileLabel(tile: Tile): string {
    if (tile.matched) return `${tile.fragment.name}, matched`;
    if (tile.flipped) return tile.fragment.name;
    return 'Hidden fragment';
  }

  private finish(): void {
    this.stopTimer();
    this.won.set(true);

    const pairs = this.pairCount();
    const seconds = Math.max(1, Math.round(this.elapsedMs() / 1000));
    const base = pairs * 10;
    // Perfect play is one move per pair; every wasted move shaves the bonus.
    const moveBonus = Math.max(0, (pairs * 2 - this.moves()) * 5);
    const timeBonus = Math.max(0, 120 - seconds) * 2;
    const earned = base + moveBonus + timeBonus;

    this.xpEarned.set(earned);
    // Colour work feeds Aether. totalXp updates through the snapshot subscription.
    this.xp.award('game-win', { amount: earned, energy: 'aether' });

    const best = this.bestTimeMs();
    if (best === null || this.elapsedMs() < best) {
      this.bestTimeMs.set(this.elapsedMs());
      this.writeNumber(BEST_STORAGE_KEY, this.elapsedMs());
    }
  }

  private patch(id: number, changes: Partial<Tile>): void {
    this.tiles.update(list => list.map(t => (t.id === id ? { ...t, ...changes } : t)));
  }

  private startTimer(): void {
    if (!this.isBrowser) return;
    this.startedAt = Date.now();
    this.timerId = setInterval(() => this.elapsedMs.set(Date.now() - this.startedAt), 250);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private shuffle<T>(list: T[]): T[] {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private readNumber(key: string, fallback: number): number {
    if (!this.isBrowser) return fallback;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw === null ? NaN : Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  private writeNumber(key: string, value: number): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* storage blocked (private mode) — score just doesn't persist */
    }
  }
}
