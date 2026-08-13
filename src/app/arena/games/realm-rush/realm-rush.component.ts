/**
 * realm-rush.component.ts — "Realm Rush", the Arena's typing game.
 *
 * Incantations fall down a 2D canvas; you type them before they land. The
 * canvas draws, but the *input* is a real `<input>` parked under it — that is
 * what raises the keyboard on a phone, and it leaves IME and autocorrect
 * behaviour to the platform instead of a hand-rolled keydown handler.
 *
 * Typing locks onto one word: the first character picks the lowest word that
 * starts with it, and you stay on that word until it dies or the buffer
 * empties. Without the lock a stray character would silently retarget mid-word,
 * which reads as a bug rather than as difficulty. A wrong key is rejected and
 * the buffer is left intact, so one slip does not cost a word you had nearly
 * finished — it costs accuracy.
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GameStateGateway } from '../../../shared/save/game-state.gateway';
import { LocalSaveRegistry, SaveOwner } from '../../../shared/save/local-save-registry.service';
import { ArenaShellComponent } from '../arena-shell.component';
import { ArenaGameBase } from '../arena-game.base';
import { RunResult } from '../arena-scores.service';

type Lane = 'css' | 'js' | 'regex' | 'html';

interface FallingWord {
  text: string;
  lane: Lane;
  x: number;
  y: number;
  speed: number;
  /** Characters already matched, for the two-tone draw. */
  done: number;
  /** True once the word is destroyed or landed; it then fades and is culled. */
  fading: boolean;
  /** 1 → 0 while fading. */
  fade: number;
}

interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; color: string;
}

const LANE_COLORS: Record<Lane, string> = {
  css: '#A78BFA',
  js: '#C9A84C',
  regex: '#a48bff',
  html: '#ff6dd7',
};

const WORDS: Record<Lane, string[]> = {
  css: [
    'flex', 'grid', 'gap', 'inset', 'z-index', 'opacity', 'filter', 'blur',
    'clamp', 'minmax', 'contain', 'aspect-ratio', 'backdrop-filter', 'transform',
    'translate', 'rotate', 'position', 'sticky', 'overflow', 'baseline',
    'justify-self', 'place-items', 'will-change', 'currentColor', 'subgrid',
  ],
  js: [
    'const', 'await', 'yield', 'typeof', 'Symbol', 'Promise', 'reduce', 'flatMap',
    'Proxy', 'WeakMap', 'finally', 'structuredClone', 'queueMicrotask', 'Reflect',
    'debugger', 'instanceof', 'Generator', 'AbortController', 'globalThis',
    'freeze', 'BigInt', 'Iterator',
  ],
  regex: [
    '\\d+', '\\w*', '[a-z]+', '(?=.*)', '(?<!x)', '^\\s*$', '\\b\\w+\\b', '.*?',
    '[^"]+', '{2,4}', '(?:ab)+', '\\p{L}', '[0-9a-f]{6}',
  ],
  html: [
    '<main>', '<aside>', '<figure>', '<dialog>', '<template>', '<picture>',
    '<summary>', '<progress>', '<fieldset>', '<noscript>', '<datalist>',
    '<colgroup>', '<optgroup>', '<blockquote>',
  ],
};

const LANES: Lane[] = ['css', 'js', 'regex', 'html'];

/** Monospace so a regex fragment stays readable at speed. */
const WORD_FONT = '600 17px ui-monospace, SFMono-Regular, Menlo, monospace';

/** Missing this many incantations ends the run. */
const MAX_LIVES = 3;
/** Words destroyed before a run counts as a clear and pays its first-clear XP. */
const CLEAR_AT = 15;
/** Top runs kept on the local board. */
const BOARD_SIZE = 5;
const BOARD_KEY = 'eclipse-realm-rush-board';

export interface BoardEntry {
  score: number;
  wpm: number;
  accuracy: number;
  words: number;
}

@Component({
  selector: 'app-realm-rush',
  standalone: true,
  imports: [CommonModule, RouterLink, ArenaShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './realm-rush.component.html',
  styleUrls: ['../arena-game.css', './realm-rush.component.css'],
})
export class RealmRushComponent extends ArenaGameBase
  implements OnInit, AfterViewInit, OnDestroy {

  readonly gameId = 'realm-rush';
  readonly clearAt = CLEAR_AT;
  readonly maxLives = MAX_LIVES;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('typeInput') inputRef?: ElementRef<HTMLInputElement>;

  phase: 'intro' | 'playing' | 'over' = 'intro';
  lives = MAX_LIVES;
  wordsCleared = 0;
  wave = 1;
  wpm = 0;
  accuracy = 100;
  result: RunResult | null = null;
  board: BoardEntry[] = [];
  /** Set briefly when a keystroke matched nothing, to flash the input. */
  miss = false;

  private ctx: CanvasRenderingContext2D | null = null;
  private words: FallingWord[] = [];
  private sparks: Spark[] = [];
  private raf = 0;
  private last = 0;
  private spawnTimer = 0;
  private elapsed = 0;
  private active: FallingWord | null = null;
  /** The last accepted prefix. A rejected key reverts the input to this. */
  private buffer = '';
  private keystrokes = 0;
  private correctChars = 0;
  private reduced = false;
  private missTimer: ReturnType<typeof setTimeout> | null = null;
  private width = 0;
  private height = 0;
  private readonly onResize = () => this.sizeCanvas();
  /**
   * Held as a field rather than passed inline, so `ngOnDestroy` can hand the
   * same object back — the registry unregisters by identity, which is what stops
   * a component tearing down after its replacement has registered from
   * unclaiming the live one.
   */
  private readonly boardOwner: SaveOwner = { rehydrate: () => this.rehydrateBoard() };

  async ngOnInit(): Promise<void> {
    await this.resolveGate();
    if (this.isBrowser) {
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.board = this.loadBoard();
      // The only synced blob owned by a component rather than a service, so the
      // only one whose registration has a lifetime shorter than the tab's.
      // `saveBoard()` rebuilds the top five from `this.board`, so a board merged
      // in from another device while this page is open would be dropped by the
      // next game over.
      this.saves.register(BOARD_KEY, this.boardOwner);
    }
    this.cdr.markForCheck();
  }

  /** Re-read the board after cloud save merged in another device's runs. */
  private rehydrateBoard(): void {
    this.board = this.loadBoard();
    // OnPush, and this is called from outside any template event.
    this.cdr.markForCheck();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  ngOnDestroy(): void {
    this.stopLoop();
    if (this.missTimer) clearTimeout(this.missTimer);
    if (this.isBrowser) {
      window.removeEventListener('resize', this.onResize);
      // Leaving the route means nobody is holding the board any more, which is
      // exactly the state "no owner" is meant to describe — cloud save then
      // writes the merged blob and correctly rehydrates nothing.
      this.saves.unregister(BOARD_KEY, this.boardOwner);
    }
  }

  // ── run lifecycle ───────────────────────────────────────────

  start(): void {
    this.phase = 'playing';
    this.lives = MAX_LIVES;
    this.wordsCleared = 0;
    this.wave = 1;
    this.wpm = 0;
    this.accuracy = 100;
    this.keystrokes = 0;
    this.correctChars = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.buffer = '';
    this.words = [];
    this.sparks = [];
    this.active = null;
    this.result = null;
    // The canvas only exists once `playing` has rendered, and `sizeCanvas`
    // needs it laid out to measure.
    this.cdr.detectChanges();

    this.sizeCanvas();
    this.focusInput();
    this.spawn();

    this.last = performance.now();
    // Outside Angular: a 60fps loop that ticked change detection would re-run
    // the whole page's bindings every frame for a canvas Angular never paints.
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame(t => this.frame(t));
    });
  }

  private end(): void {
    this.stopLoop();
    this.phase = 'over';

    const minutes = Math.max(this.elapsed / 60000, 1 / 60);
    this.wpm = Math.round((this.correctChars / 5) / minutes);
    // Correct characters are counted per *completed* word, so a perfect run
    // types exactly as many keys as it clears characters and reads 100%.
    this.accuracy = this.keystrokes > 0
      ? Math.min(100, Math.round((this.correctChars / this.keystrokes) * 100))
      : 100;

    // Accuracy is worth up to 40 points on top of raw speed, so a careful
    // 40 WPM run beats a frantic 55 WPM one that missed half its keys.
    const score = Math.max(0, Math.round(this.wpm + (this.accuracy / 100) * 40));
    const won = this.wordsCleared >= CLEAR_AT;

    this.result = this.finishRun(score, won);
    this.board = this.saveBoard({
      score, wpm: this.wpm, accuracy: this.accuracy, words: this.wordsCleared,
    });
    this.cdr.markForCheck();
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  playAgain(): void {
    this.phase = 'intro';
    this.result = null;
    this.cdr.markForCheck();
  }

  // ── typing ──────────────────────────────────────────────────

  focusInput(): void {
    // Deferred: iOS only opens the keyboard from inside the gesture that led
    // here, and the input has to exist in the layout first.
    setTimeout(() => this.inputRef?.nativeElement.focus(), 0);
  }

  onType(event: Event): void {
    if (this.phase !== 'playing') return;
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (!value) {
      this.buffer = '';
      this.releaseActive();
      return;
    }

    // Only a longer buffer means a key was actually pressed; a shrinking one is
    // a backspace, which costs nothing but gives nothing back either.
    if (value.length > this.buffer.length) this.keystrokes++;

    const locked = this.active && !this.active.fading ? this.active : null;
    const target = locked ?? this.pick(value);

    if (!target || !target.text.startsWith(value)) {
      // Reject the character and put the buffer back the way it was.
      input.value = this.buffer;
      this.flashMiss();
      return;
    }

    this.buffer = value;
    this.active = target;
    target.done = value.length;

    if (value === target.text) {
      this.destroy(target);
      this.correctChars += target.text.length;
      this.wordsCleared++;
      input.value = '';
      this.buffer = '';
      this.active = null;
      this.cdr.markForCheck();
    }
  }

  /** The lowest on-screen word starting with `value` — the most urgent one. */
  private pick(value: string): FallingWord | null {
    let best: FallingWord | null = null;
    for (const w of this.words) {
      if (w.fading || !w.text.startsWith(value)) continue;
      if (!best || w.y > best.y) best = w;
    }
    return best;
  }

  private releaseActive(): void {
    if (this.active) this.active.done = 0;
    this.active = null;
  }

  private flashMiss(): void {
    this.miss = true;
    this.cdr.markForCheck();
    if (this.missTimer) clearTimeout(this.missTimer);
    this.missTimer = setTimeout(() => {
      this.miss = false;
      this.missTimer = null;
      this.cdr.markForCheck();
    }, 220);
  }

  private destroy(word: FallingWord): void {
    word.fading = true;
    word.fade = 1;
    if (this.reduced) return;
    const color = LANE_COLORS[word.lane];
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      this.sparks.push({
        x: word.x, y: word.y,
        vx: Math.cos(a) * (60 + Math.random() * 90),
        vy: Math.sin(a) * (60 + Math.random() * 90),
        life: 1, color,
      });
    }
  }

  // ── loop ────────────────────────────────────────────────────

  private spawn(): void {
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const pool = WORDS[lane];
    const text = pool[Math.floor(Math.random() * pool.length)];

    // Measure before placing, so a long incantation cannot spawn half off-screen.
    const w = this.ctx ? this.ctx.measureText(text).width : text.length * 11;
    const margin = 12;
    const span = Math.max(1, this.width - w - margin * 2);
    const x = margin + w / 2 + Math.random() * span;

    this.words.push({
      text, lane, x, y: -8,
      // Base 26 px/s, +14% per wave. Reduced motion starts slower, since the
      // fall is the only motion left to read.
      speed: (this.reduced ? 20 : 26) * Math.pow(1.14, this.wave - 1),
      done: 0, fading: false, fade: 1,
    });
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.elapsed += dt * 1000;

    // A new wave every 18 seconds: faster words, tighter spawns.
    const wave = 1 + Math.floor(this.elapsed / 18000);
    if (wave !== this.wave) {
      this.wave = wave;
      this.zone.run(() => this.cdr.markForCheck());
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn();
      // 2.1s at wave 1, down to a 0.75s floor.
      this.spawnTimer = Math.max(0.75, 2.1 * Math.pow(0.9, this.wave - 1));
    }

    let lost = 0;
    for (const w of this.words) {
      if (w.fading) { w.fade -= dt * 4; continue; }
      w.y += w.speed * dt;
      if (w.y >= this.height - 8) {
        w.fading = true;
        w.fade = 1;
        lost++;
        if (this.active === w) {
          this.active = null;
          this.buffer = '';
          const input = this.inputRef?.nativeElement;
          if (input) input.value = '';
        }
      }
    }
    this.words = this.words.filter(w => !w.fading || w.fade > 0);

    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 220 * dt;
      s.life -= dt * 1.8;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);

    if (lost > 0) {
      this.lives -= lost;
      if (this.lives <= 0) {
        this.zone.run(() => this.end());
        return;
      }
      this.zone.run(() => this.cdr.markForCheck());
    }

    this.draw();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // The floor: what the incantations must not reach.
    ctx.strokeStyle = this.lives === 1 ? 'rgba(255,45,77,0.8)' : 'rgba(140,110,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.height - 3);
    ctx.lineTo(this.width, this.height - 3);
    ctx.stroke();

    ctx.textBaseline = 'middle';

    for (const w of this.words) {
      const color = LANE_COLORS[w.lane];
      ctx.globalAlpha = w.fading ? Math.max(0, w.fade) : 1;

      if (!this.reduced) {
        ctx.shadowColor = color;
        ctx.shadowBlur = w === this.active ? 16 : 8;
      }

      // Two-tone: what you have typed is dim, what remains is lit. Both runs
      // are placed from the measured left edge so the word never shifts.
      const full = ctx.measureText(w.text).width;
      const left = w.x - full / 2;
      ctx.textAlign = 'left';

      if (w.done > 0) {
        const typed = w.text.slice(0, w.done);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(typed, left, w.y);
        ctx.fillStyle = color;
        ctx.fillText(w.text.slice(w.done), left + ctx.measureText(typed).width, w.y);
      } else {
        ctx.fillStyle = color;
        ctx.fillText(w.text, left, w.y);
      }
    }

    ctx.shadowBlur = 0;

    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  // ── canvas sizing ───────────────────────────────────────────

  private sizeCanvas(): void {
    const el = this.canvasRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    el.width = Math.round(rect.width * dpr);
    el.height = Math.round(rect.height * dpr);
    this.ctx = el.getContext('2d');
    if (!this.ctx) return;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Set here rather than per frame: `spawn()` measures text to place a word,
    // and it runs before the first draw. With the default 10px font the
    // measurement is wrong and long words spawn clipped.
    this.ctx.font = WORD_FONT;
  }

  // ── local high-score board ──────────────────────────────────

  private loadBoard(): BoardEntry[] {
    try {
      const raw = this.store.readRaw(BOARD_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, BOARD_SIZE) : [];
    } catch {
      return [];
    }
  }

  private saveBoard(entry: BoardEntry): BoardEntry[] {
    const next = [...this.board, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, BOARD_SIZE);
      this.store.write(BOARD_KEY, next);
    return next;
  }

  get livesArray(): number[] {
    return Array.from({ length: MAX_LIVES }, (_, i) => i);
  }
}
