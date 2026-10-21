/**
 * <app-cascade> — a cascade machine: the Eclipse Cascade (the Mirror Slate's
 * 10×10 rune grid) or the Orrery Tumbler (7×7, found in the Orrery Wells).
 * `machine` picks which; the Slate and the play view set it.
 *
 * Frameless pixel face: the purse and "?" on top, the board (one canvas, the
 * pixel symbols baked once), the result line, then ONE row of bet and Spin and
 * one row of quick bets and Auto. ≤ 2 taps to spin; help (pay table, odds,
 * rules, record, lore) is behind "?". Nothing scrolls on a 390×844 phone.
 *
 * The play is decided and paid in `CascadeService.spin` before anything moves
 * (the shared ledger: one draw from the save's seed, the record stored before
 * the payout, paid once per mutation id). The film is re-derived from the seed
 * and only walks it: the first fall, each tumble's clusters lighting, the
 * multiplier spots growing, the burst, the fall (up or down), the free spins.
 * Skip (or Escape) jumps to the settled result; reduced motion shows it at once.
 * The purse readout holds the post-bet balance until the result shows.
 */
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit,
  PLATFORM_ID, ViewChild, inject, input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { gamesBetCap } from '../economy/economy-curve';
import { rewardRate } from '../economy/economy.model';
import { SoundService } from '../sound/sound.service';
import { GAMES_I18N } from '../games/games.i18n';
import { WinCelebrationComponent } from '../games/win-celebration.component';
import { GameStepperComponent } from '../games/game-stepper.component';
import { BetChipsComponent } from '../games/bet-chips.component';
import { AutoSpinComponent, type AutoBegin } from '../games/auto-spin.component';
import { AUTO_GAP_MS, autoAfter, autoCanSpin, startAuto, type AutoRun, type AutoStopReason } from '../games/autoplay';
import { betAllowed, betsOpen, clampBet, stepBet } from '../games/bet-tiers';
import { newPlayId, type PlayRecord } from '../games/play-ledger';
import { PlayLedgerService } from '../games/play-ledger.service';
import { winTier } from '../games/rtp-sim';
import { GlimIconComponent } from '../glim/glim-icon.component';
import { CASCADE_I18N } from './cascade.i18n';
import { CascadeService } from './cascade.service';
import { CASCADE_SPRITE, spriteGrid, spriteLayers, type SpriteLayer } from './cascade-sprites';
import {
  CASCADE_STATS, ECLIPSE_CASCADE, cellChances, codeOf, goldFor, parseWindow, roundChances,
  type CascadeMachine, type CascadeOutcome, type CascadeSpin, type CascadeStep, type CascadeSummary,
} from './cascade.model';

type Phase = 'idle' | 'spin' | 'bonus';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
interface PayRow { code: string; name: string; layers: SpriteLayer[]; pays: string[] }
interface HistoryRow { id: string; text: string; bonus: 'free' | 'super' | null; won: boolean }

/** Beats, ms (free spins run at `FREE_PACE` of these). */
const BEAT = { fall: 420, light: 380, burst: 230, refall: 340, bonusIntro: 1500, between: 260, outro: 260 } as const;
const FREE_PACE = 0.7;
/** The cluster sizes the pay table prints (the last is "and up"). */
const PAY_SIZES = [5, 6, 8, 10, 12, 15] as const;
/** A burst's sparks, per cell. */
const SPARKS = 5;

/** The ink of each symbol, for its burst sparks. */
const SPARK: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'eclipse-cascade': { a: '#f2eef8', b: '#ff8a2a', c: '#9cf06a', d: '#7af0ff', e: '#ff7ad8', f: '#f2c94c', g: '#e8f4ff', h: '#ff4a6a', W: '#c9a0ff', S: '#f2c94c' },
  'orrery-tumbler': { a: '#f2d48a', b: '#e8f0ff', c: '#7ad8f0', d: '#f2d48a', e: '#e8f0ff', f: '#efe0c0', W: '#fff4c8', S: '#9ad0ff' },
};
const BOARD = { even: '#120b1a', odd: '#170f22', lit: '#f2c94c', spot: '#a855f7', spotHot: '#ff7ad8', marked: '#5a2f8a', text: '#fff4dc' } as const;

function pct(x: number): string {
  const v = x * 100;
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(v >= 1 ? 1 : 2)}%`;
}

@Component({
  selector: 'app-cascade',
  standalone: true,
  imports: [WinCelebrationComponent, GameStepperComponent, BetChipsComponent, AutoSpinComponent, GlimIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cascade.component.html',
  styleUrls: ['./cascade.component.css'],
})
export class CascadeComponent implements OnInit, OnDestroy {
  /** Which machine ('eclipse-cascade' | 'orrery-tumbler'). */
  readonly machine = input<string>(ECLIPSE_CASCADE.id);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly economy = inject(EconomyService);
  private readonly cascade = inject(CascadeService);
  private readonly ledger = inject(PlayLedgerService);
  private readonly sound = inject(SoundService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly subs = new Subscription();
  private readonly still = this.isBrowser && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  @ViewChild('board', { static: true }) private boardRef!: ElementRef<HTMLCanvasElement>;

  m: CascadeMachine = ECLIPSE_CASCADE;
  hydrated = false;
  phase: Phase = 'idle';
  helpOpen = false;
  gold = 0;
  gps = 0;
  bet = 10;
  bets: number[] = [10];
  heldGold: number | null = null;
  result = '';
  /** Gold this spin (and this round) has shown so far. */
  spinGold = 0;
  roundKind: 'free' | 'super' | null = null;
  freeIndex = 0;
  freeTotal = 0;
  /** The largest spot (or the ladder's rung) on show. */
  top = 0;
  banner = '';
  shake = false;
  glimLine = '';
  celebrate = { win: 0, bet: 0, seq: 0 };
  lastWin = 0;
  windowText = '';
  capLine = '';
  auto: AutoRun | null = null;

  // Help
  payRows: PayRow[] = [];
  wildLayers: SpriteLayer[] = [];
  scatterLayers: SpriteLayer[] = [];
  history: HistoryRow[] = [];
  record = '';
  helpLines: string[] = [];

  // The board
  private cells: number[] = [];
  private spots: number[] = [];
  /** Start offset (in cells, + = below) of each cell's fall, and the fall's progress 0..1. */
  private offsets: number[] = [];
  private fallK = 1;
  private lit = new Set<number>();
  private burst = new Set<number>();
  private burstK = 0;
  private particles: Particle[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
  private cellPx = 34;
  private dpr = 1;
  private raf = 0;
  private token = 0;
  private outcome: CascadeOutcome | null = null;
  private summary: CascadeSummary | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObs: ResizeObserver | null = null;
  private readonly onVisibility = (): void => this.visibilityChanged();

  constructor() {
    this.i18n.register(GAMES_I18N);
    this.i18n.register(CASCADE_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  fmt(n: number): string { return Math.floor(n).toLocaleString('en-US'); }

  get busy(): boolean { return this.phase !== 'idle'; }
  get title(): string { return this.t(`cascade.title.${this.m.id}`); }
  get purse(): number { return this.heldGold ?? this.gold; }
  get spots2(): number { let n = 0; for (const v of this.spots) if (v >= 2) n++; return n; }
  get ladderMachine(): boolean { return this.m.boost === 'ladder'; }

  ngOnInit(): void {
    this.m = this.cascade.machine(this.machine());
    this.cells = parseWindow(this.m, this.idleWindow());
    this.spots = new Array<number>(this.m.rows * this.m.cols).fill(0);
    this.offsets = new Array<number>(this.cells.length).fill(0);
    this.windowText = this.idleWindow();
    this.result = this.t(`cascade.ready.${this.m.id}`);
    this.buildHelp();
    if (!this.isBrowser) return;
    this.economy.init();
    this.cascade.init();
    this.hydrated = true;
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.gold = s.gold;
      this.gps = rewardRate(s);
      this.refresh();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.ledger.changed$.subscribe(() => { this.buildHistory(); this.cdr.markForCheck(); }));
    document.addEventListener('visibilitychange', this.onVisibility);
    const last = this.ledger.recent<CascadeSummary>(this.m.id, 1)[0];
    if (last?.outcome?.window) {
      this.cells = parseWindow(this.m, last.outcome.window);
      this.windowText = last.outcome.window;
      this.bet = last.bet;
      this.lastWin = last.win;
      this.result = this.t('cascade.lastSpin', { bet: this.fmt(last.bet), win: this.fmt(last.win) });
    }
    this.refresh();
    this.bakeSprites();
    this.resizeObs = new ResizeObserver(() => this.layout());
    this.resizeObs.observe(this.host.nativeElement);
    this.layout();
  }

  ngOnDestroy(): void {
    // The machine closed (the Slate folded, the panel shut): an auto run ends with it, the film stops.
    this.auto = null;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.token++;
    this.clearTimers();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect();
    if (this.isBrowser) document.removeEventListener('visibilitychange', this.onVisibility);
    this.subs.unsubscribe();
  }

  /** A pleasant resting board before the first spin: every kind once, a scatter, a wild. */
  private idleWindow(): string {
    const codes = this.m.symbols.map(s => s.code);
    let out = '';
    for (let i = 0; i < this.m.rows * this.m.cols; i++) out += codes[(i * 7 + Math.floor(i / this.m.cols) * 3) % codes.length];
    const mid = Math.floor(this.m.rows / 2) * this.m.cols + Math.floor(this.m.cols / 2);
    return out.slice(0, mid) + 'S' + out.slice(mid + 1, mid + 3) + 'W' + out.slice(mid + 4);
  }

  // ── Bet ───────────────────────────────────────────────────────────────────

  stepBet(dir: 1 | -1): void {
    if (this.busy || this.auto) return;
    this.bet = stepBet(this.bet, dir, this.gps, this.gold);
    this.refresh();
  }

  setBet(bet: number): void {
    if (this.busy || this.auto) return;
    this.bet = clampBet(bet, this.gps, this.gold);
    this.refresh();
  }

  private refresh(): void {
    this.bets = betsOpen(this.gps, this.gold);
    if (!this.auto) this.bet = clampBet(this.bet, this.gps, this.gold);
    this.capLine = this.t('games.bet.cap', { n: this.fmt(gamesBetCap(this.gps, this.gold)) });
  }

  // ── Spin ──────────────────────────────────────────────────────────────────

  /** The Spin button: one tap (nothing while an auto run is going; Stop is the control then). */
  tapSpin(): void {
    if (this.auto) return;
    this.spin();
  }

  private spin(): void {
    if (this.busy || !this.hydrated) return;
    const before = this.gold;
    const res = this.cascade.spin(this.m.id, newPlayId(this.m.id), this.bet);
    if (!res.ok) {
      this.result = this.t(res.code === 'funds' ? 'cascade.funds' : 'cascade.badBet');
      if (this.auto) this.endAuto(res.code === 'funds' ? 'funds' : 'bet');
      this.cdr.markForCheck();
      return;
    }
    this.play(res.record, before);
  }

  private play(record: PlayRecord<CascadeSummary>, before: number): void {
    this.summary = record.outcome;
    this.outcome = this.cascade.replay(record);
    this.heldGold = Math.max(0, before - record.bet);
    this.celebrate = { win: 0, bet: 0, seq: this.celebrate.seq };
    this.glimLine = '';
    this.banner = '';
    this.spinGold = 0;
    this.roundKind = null;
    this.freeIndex = 0;
    this.freeTotal = 0;
    this.top = 0;
    this.phase = 'spin';
    this.result = this.t('cascade.spinning');
    this.helpOpen = false;
    this.cdr.markForCheck();
    if (this.still || !this.outcome) { this.finish(); return; }
    const token = ++this.token;
    void this.film(this.outcome, token);
  }

  private async film(o: CascadeOutcome, token: number): Promise<void> {
    await this.playSpin(o.base, token, 1, true);
    if (token !== this.token) return;
    const bonus = o.bonus;
    if (bonus) {
      this.phase = 'bonus';
      this.roundKind = bonus.kind;
      this.freeTotal = this.m.freeSpins;
      const suffix = this.ladderMachine ? '.ladder' : '';
      this.banner = this.t(bonus.kind === 'super' ? 'cascade.banner.super' : 'cascade.banner.free');
      this.result = this.t(`cascade.${bonus.kind === 'super' ? 'super' : 'free'}.open${suffix}`);
      this.sound.sfx('bigwin');
      this.kick(bonus.kind === 'super' ? 520 : 300);
      this.cdr.markForCheck();
      await this.wait(BEAT.bonusIntro);
      if (token !== this.token) return;
      this.banner = '';
      let shown = this.m.freeSpins;
      for (let i = 0; i < bonus.spins.length; i++) {
        const s = bonus.spins[i];
        this.freeIndex = i + 1;
        this.result = this.t('cascade.freeSpin', { i: this.freeIndex, n: this.freeTotal });
        this.cdr.markForCheck();
        await this.playSpin(s, token, FREE_PACE, false);
        if (token !== this.token) return;
        if (s.scatters >= this.m.freeTrigger && bonus.spins.length > shown) {
          const add = Math.min(this.m.retriggerSpins, bonus.spins.length - shown);
          shown += add;
          this.freeTotal = shown;
          this.result = this.t('cascade.retrigger', { n: add });
          this.sound.sfx('cluster', { pitch: 12 });
          this.cdr.markForCheck();
          await this.wait(BEAT.bonusIntro * 0.6);
        } else {
          await this.wait(BEAT.between);
        }
        if (token !== this.token) return;
      }
    }
    await this.wait(BEAT.outro);
    if (token === this.token) this.finish();
  }

  /** One spin's film: the first fall, then every tumble (light, spots, burst, fall). */
  private async playSpin(s: CascadeSpin, token: number, pace: number, base: boolean): Promise<void> {
    const bet = this.summary?.bet ?? this.bet;
    this.spots = [...s.spotsStart];
    if (!this.ladderMachine) for (const v of this.spots) if (v > this.top) this.top = v;
    this.lit.clear();
    this.burst.clear();
    this.cells = [...s.start];
    this.setFirstFall();
    this.sound.sfx('tumble');
    await this.animate(BEAT.fall * pace, k => { this.fallK = k; });
    if (token !== this.token) return;
    for (let n = 0; n < s.steps.length; n++) {
      const step = s.steps[n];
      for (const w of step.wins) for (const i of w.cells) this.lit.add(i);
      const tumble = step.wins.reduce((sum, w) => sum + w.tenths, 0);
      this.spinGold += goldFor(tumble, bet);
      if (this.ladderMachine) this.top = Math.max(this.top, step.rung);
      this.sound.sfx('cluster', { pitch: Math.min(12, n * 2) });
      this.markForCheck();
      await this.wait(BEAT.light * pace);
      if (token !== this.token) return;
      this.spots = [...step.spots];
      if (!this.ladderMachine) for (const v of this.spots) if (v > this.top) this.top = v;
      this.burst = new Set(this.lit);
      this.lit.clear();
      this.spark(this.burst, step);
      await this.animate(BEAT.burst * pace, k => { this.burstK = k; });
      if (token !== this.token) return;
      const next = s.steps[n + 1]?.window ?? s.final;
      this.setRefall(step, next);
      this.burst.clear();
      this.burstK = 0;
      this.sound.sfx('tumble', { pitch: n });
      this.markForCheck();
      await this.animate(BEAT.refall * pace, k => { this.fallK = k; });
      if (token !== this.token) return;
    }
    this.cells = [...s.final];
    this.windowText = base ? this.textOf(s.final) : this.windowText;
    this.draw();
  }

  /** Show the settled result. Safe at any point (Skip). */
  private finish(): void {
    this.token++;
    this.clearTimers();
    const sum = this.summary;
    if (!sum) return;
    const o = this.outcome;
    // The board ends on the last window shown: the round's last spin, or the base spin.
    const last = o?.bonus ? o.bonus.spins[o.bonus.spins.length - 1] : o?.base;
    this.cells = last ? [...last.final] : parseWindow(this.m, sum.window);
    this.spots = last ? [...last.spotsEnd] : this.spots.map(() => 0);
    this.offsets.fill(0);
    this.fallK = 1;
    this.lit.clear();
    this.burst.clear();
    this.particles = this.still ? [] : this.particles;
    this.windowText = sum.window;
    if (sum.bonus) {
      this.roundKind = sum.bonus.kind;
      this.freeTotal = sum.bonus.spins;
      this.freeIndex = sum.bonus.spins;
      this.top = sum.bonus.top;
    }
    this.spinGold = sum.win;
    this.lastWin = sum.win;
    const parts: string[] = [];
    if (sum.bonus) parts.push(this.t('cascade.roundPaid', { n: this.fmt(goldFor(sum.bonus.tenths, sum.bet)) }));
    if (sum.capped) parts.push(this.t('cascade.capped', { x: this.m.maxWinX.toLocaleString('en-US') }));
    parts.push(sum.win > 0 ? this.t('cascade.won', { n: this.fmt(sum.win) }) : this.t('cascade.lose'));
    this.result = parts.join(' ');
    this.phase = 'idle';
    this.banner = '';
    this.heldGold = null;
    if (sum.win > 0) {
      this.celebrate = { win: sum.win, bet: sum.bet, seq: this.celebrate.seq + 1 };
      const tier = winTier(sum.win, sum.bet);
      this.sound.sfx(tier ? 'bigwin' : 'coin');
      if (tier) {
        this.kick(tier === 'eclipse' ? 700 : tier === 'mega' ? 520 : 380);
        this.burstAll();
        const pick = this.celebrate.seq % 2;
        this.glimLine = this.t(`cascade.glim.${tier === 'eclipse' ? 'epic' : tier}.${pick}`);
        this.later(4200, () => { this.glimLine = ''; this.cdr.markForCheck(); });
      }
    }
    this.outcome = null;
    this.refresh();
    this.draw();
    this.cdr.markForCheck();
    this.autoSettled(sum);
  }

  skip(): void {
    if (this.busy) this.finish();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.helpOpen) { this.helpOpen = false; this.cdr.markForCheck(); return; }
    this.skip();
  }

  toggleHelp(): void {
    this.helpOpen = !this.helpOpen;
    if (this.helpOpen) this.buildHistory();
    this.cdr.markForCheck();
  }

  // ── Auto spin (games/autoplay.ts) ─────────────────────────────────────────

  startAuto(begin: AutoBegin): void {
    if (this.busy || this.auto || !this.hydrated) return;
    this.auto = startAuto(begin.count, begin.stops, this.gold);
    this.autoNext();
  }

  stopAuto(): void { this.endAuto('user'); }

  resumeAuto(): void {
    if (!this.auto?.paused) return;
    this.auto = { ...this.auto, paused: false };
    if (!this.busy) this.autoNext();
    this.cdr.markForCheck();
  }

  private autoNext(): void {
    this.autoTimer = null;
    const run = this.auto;
    if (!run || run.paused || this.busy) return;
    const stop = autoCanSpin(run, this.gold, this.bet, betAllowed(this.bet, this.gps, this.gold));
    if (stop) { this.endAuto(stop); return; }
    this.spin();
  }

  private autoSettled(sum: CascadeSummary): void {
    if (!this.auto) return;
    const { run, stop } = autoAfter(this.auto, { bet: sum.bet, win: sum.win, bonus: !!sum.bonus });
    this.auto = run;
    if (stop) { this.endAuto(stop); return; }
    const gap = sum.win >= sum.bet * 10 ? AUTO_GAP_MS * 5 : AUTO_GAP_MS;
    this.autoTimer = setTimeout(() => this.autoNext(), gap);
  }

  private endAuto(reason: AutoStopReason): void {
    const run = this.auto;
    if (!run) return;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
    this.auto = null;
    this.result = reason === 'count'
      ? this.t('games.auto.ended.count', { n: run.done, net: (run.net >= 0 ? '+' : '') + this.fmt(run.net) })
      : `${this.result} ${this.t(`games.auto.ended.${reason}`)}`.trim();
    this.cdr.markForCheck();
  }

  /** The tab hid: an auto run pauses (nothing plays out of sight); Resume carries on. */
  private visibilityChanged(): void {
    if (!this.auto || document.visibilityState !== 'hidden') return;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
    this.auto = { ...this.auto, paused: true };
    this.result = this.t('games.auto.paused');
    this.cdr.markForCheck();
  }

  // ── The board: layout, sprites, falls, sparks, drawing ─────────────────────

  /** Size the board to the room: the host's width, and what is left of the viewport under its top. */
  private layout(): void {
    if (!this.isBrowser) return;
    const host = this.host.nativeElement as HTMLElement;
    const canvas = this.boardRef?.nativeElement;
    if (!canvas) return;
    const rect = host.getBoundingClientRect();
    const landscape = innerWidth > innerHeight && innerHeight < 560;
    // Sideways the controls column keeps 272 px (four quick bets and Auto in one row); the board takes the rest.
    const width = landscape ? rect.width - 272 : rect.width;
    // The room is what is left of the scrolling pane the machine sits in (the Slate, the place panel), else the viewport.
    let bottom = innerHeight;
    for (let el = host.parentElement; el; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') { bottom = Math.min(bottom, el.getBoundingClientRect().bottom); break; }
    }
    const room = bottom - Math.max(0, rect.top) - (landscape ? 12 : 236);
    const size = Math.max(this.m.cols * 18, Math.min(width, room, this.m.cols * 52));
    this.cellPx = Math.floor(size / this.m.cols);
    this.dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
    const px = this.cellPx * this.m.cols;
    canvas.style.width = `${px}px`;
    canvas.style.height = `${this.cellPx * this.m.rows}px`;
    canvas.width = px * this.dpr;
    canvas.height = this.cellPx * this.m.rows * this.dpr;
    this.draw();
  }

  private bakeSprites(): void {
    const codes = [...this.m.symbols.map(s => s.code), 'W', 'S'];
    for (const code of codes) {
      const c = document.createElement('canvas');
      c.width = CASCADE_SPRITE;
      c.height = CASCADE_SPRITE;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      const g = spriteGrid(this.m.id, code);
      g.forEach((row, y) => row.forEach((col, x) => { if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } }));
      this.sprites.set(code, c);
    }
  }

  private textOf(grid: readonly number[]): string {
    let s = '';
    for (const c of grid) s += codeOf(this.m, c);
    return s;
  }

  /** The first fall: every column drops in from above, the left ones a beat first. */
  private setFirstFall(): void {
    const { rows, cols } = this.m;
    for (let i = 0; i < this.cells.length; i++) this.offsets[i] = -(rows + 1 + (i % cols) * 0.35);
    this.fallK = 0;
  }

  /** After a burst: where each cell of `next` fell from (same rule as cascade.model `tumble`). */
  private setRefall(step: CascadeStep, next: readonly number[]): void {
    const { rows, cols } = this.m;
    const burst = new Set<number>();
    for (const w of step.wins) for (const i of w.cells) burst.add(i);
    const dir = step.dir;
    for (let c = 0; c < cols; c++) {
      let kept = 0;
      for (let k = 0; k < rows; k++) {
        const r = dir === 1 ? rows - 1 - k : k;
        if (burst.has(r * cols + c)) continue;
        const to = dir === 1 ? rows - 1 - kept : kept;
        this.offsets[to * cols + c] = r - to;
        kept++;
      }
      const fresh = rows - kept;
      for (let k = kept; k < rows; k++) {
        const to = dir === 1 ? rows - 1 - k : k;
        this.offsets[to * cols + c] = dir === 1 ? -fresh : fresh;
      }
    }
    this.cells = [...next];
    this.fallK = 0;
  }

  private spark(cells: ReadonlySet<number>, step: CascadeStep): void {
    if (this.still) return;
    const palette = SPARK[this.m.id] ?? {};
    const cp = this.cellPx;
    const winSym = new Map<number, number>();
    for (const w of step.wins) for (const i of w.cells) winSym.set(i, w.symbol);
    for (const i of cells) {
      const sym = winSym.get(i) ?? 0;
      const color = palette[this.m.symbols[sym]?.code ?? 'a'] ?? BOARD.text;
      const cx = (i % this.m.cols + 0.5) * cp, cy = (Math.floor(i / this.m.cols) + 0.5) * cp;
      for (let k = 0; k < SPARKS; k++) {
        const a = (k / SPARKS) * Math.PI * 2 + i;
        const v = 40 + ((i * 13 + k * 29) % 60);
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.6, color, size: Math.max(2, Math.floor(cp / 12)) });
      }
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  /** A big win: sparks rise from every cell. */
  private burstAll(): void {
    if (this.still) return;
    const all = new Set<number>();
    for (let i = 0; i < this.cells.length; i += 2) all.add(i);
    this.spark(all, { window: this.cells, wins: [], spots: this.spots, dir: 1, rung: 1 });
    this.loop();
  }

  /** A pixel shake of the board (never under reduced motion). */
  private kick(ms: number): void {
    if (this.still) return;
    this.shake = true;
    this.later(ms, () => { this.shake = false; this.cdr.markForCheck(); });
  }

  /** Run `step(k)` for `ms` with frames drawn; resolves by a timer too, so a hidden tab never stalls the film. */
  private animate(ms: number, step: (k: number) => void): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      let done = false;
      const end = () => { if (done) return; done = true; step(1); this.draw(); resolve(); };
      this.later(ms, end);
      const frame = (now: number) => {
        if (done) return;
        step(Math.min(1, (now - start) / ms));
        this.draw();
        if (!done) requestAnimationFrame(frame);
      };
      this.zone.runOutsideAngular(() => requestAnimationFrame(frame));
      this.loop();
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => this.later(ms, resolve));
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private markForCheck(): void { this.cdr.markForCheck(); this.draw(); }

  /** Sparks keep drawing on their own until they fade. */
  private loop(): void {
    if (this.raf || this.still || !this.isBrowser) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0);
      this.draw();
      this.raf = this.particles.length ? requestAnimationFrame(frame) : 0;
    };
    this.zone.runOutsideAngular(() => { this.raf = requestAnimationFrame(frame); });
  }

  private draw(): void {
    if (!this.isBrowser) return;
    const canvas = this.boardRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { rows, cols } = this.m;
    const cp = this.cellPx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cp * cols, cp * rows);
    // The board: a dark checker, the spots under the runes.
    for (let i = 0; i < rows * cols; i++) {
      const x = (i % cols) * cp, y = Math.floor(i / cols) * cp;
      ctx.fillStyle = (i + Math.floor(i / cols)) % 2 ? BOARD.odd : BOARD.even;
      ctx.fillRect(x, y, cp, cp);
      const v = this.spots[i] ?? 0;
      if (v === 1) { ctx.fillStyle = BOARD.marked; ctx.fillRect(x + 1, y + 1, cp - 2, 2); ctx.fillRect(x + 1, y + cp - 3, cp - 2, 2); }
      else if (v >= 2) {
        ctx.globalAlpha = Math.min(0.85, 0.35 + Math.log2(v) * 0.05);
        ctx.fillStyle = v >= 64 ? BOARD.spotHot : BOARD.spot;
        ctx.fillRect(x + 1, y + 1, cp - 2, cp - 2);
        ctx.globalAlpha = 1;
      }
    }
    // The symbols, falling.
    const scale = Math.max(1, Math.floor((cp - 2) / CASCADE_SPRITE));
    const size = CASCADE_SPRITE * scale;
    const pad = Math.floor((cp - size) / 2);
    const ease = this.fallK * this.fallK;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cp * cols, cp * rows);
    ctx.clip();
    for (let i = 0; i < this.cells.length; i++) {
      const sprite = this.sprites.get(codeOf(this.m, this.cells[i]));
      if (!sprite) continue;
      const x = (i % cols) * cp, y0 = Math.floor(i / cols) * cp;
      const off = (this.offsets[i] ?? 0) * (1 - ease) * cp;
      let alpha = 1, grow = 0;
      if (this.burst.has(i)) { alpha = 1 - this.burstK; grow = Math.round(this.burstK * scale * 3); }
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, 0, 0, CASCADE_SPRITE, CASCADE_SPRITE, x + pad - grow, Math.round(y0 + off) + pad - grow, size + grow * 2, size + grow * 2);
      if (this.lit.has(i)) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = BOARD.lit;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y0 + 1, cp - 2, cp - 2);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // Spot values over the runes.
    const font = Math.max(8, Math.floor(cp / 3.4));
    ctx.font = `700 ${font}px ui-monospace, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i < this.spots.length; i++) {
      const v = this.spots[i];
      if (v < 2) continue;
      const x = (i % cols + 1) * cp - 2, y = (Math.floor(i / cols) + 1) * cp - 1;
      ctx.fillStyle = '#140c1c';
      ctx.fillText(`×${v}`, x + 1, y + 1);
      ctx.fillStyle = BOARD.text;
      ctx.fillText(`×${v}`, x, y);
    }
    // Sparks.
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ── Help ──────────────────────────────────────────────────────────────────

  private buildHelp(): void {
    const m = this.m;
    this.payRows = m.symbols.map(s => ({
      code: s.code, name: s.name, layers: spriteLayers(m.id, s.code),
      pays: PAY_SIZES.map(n => `×${(s.pays[Math.min(s.pays.length - 1, n - m.minCluster)] / 10).toLocaleString('en-US')}`),
    }));
    this.wildLayers = spriteLayers(m.id, 'W');
    this.scatterLayers = spriteLayers(m.id, 'S');
    const ch = roundChances(m);
    const scatter = this.t(`cascade.scatter.${m.id}`);
    const odds = cellChances(m).map(c => {
      const name = c.code === 'W' ? this.t(`cascade.wild.${m.id}`) : c.code === 'S' ? scatter : m.symbols.find(s => s.code === c.code)?.name ?? c.code;
      return `${name} ${pct(c.chance)}`;
    }).join(', ');
    const scatterList = Object.entries(m.scatterPays).map(([k, v]) => `${k} ×${(v / 10).toLocaleString('en-US')}`).join(' · ');
    const stats = CASCADE_STATS[m.id] ?? { rtp: 0, hitOneIn: 0 };
    const ladder = (xs: readonly number[]) => xs.map(x => `×${x}`).join(', ');
    this.helpLines = [
      this.t('cascade.help.clusters', { n: m.minCluster }),
      this.t('cascade.help.tumble'),
      ...(m.gravity === 'flip' ? [this.t('cascade.help.flip')] : []),
      m.boost === 'spots' ? this.t('cascade.help.spots', { cap: m.spotCap.toLocaleString('en-US') }) : this.t('cascade.help.ladder', { list: ladder(m.ladder) }),
      m.boost === 'spots'
        ? this.t('cascade.help.bonus', { t: m.freeTrigger, s: m.superTrigger, scatter, n: m.freeSpins, a: Math.round(1 / (ch.free + ch.super)), b: Math.round(1 / ch.super), r: m.retriggerSpins, max: m.maxSpins })
        : this.t('cascade.help.bonusLadder', { t: m.freeTrigger, s: m.superTrigger, scatter, n: m.freeSpins, a: Math.round(1 / (ch.free + ch.super)), b: Math.round(1 / ch.super), r: m.retriggerSpins, max: m.maxSpins, list: ladder(m.freeLadder), start: m.freeLadder[m.superLadderStart] }),
      this.t('cascade.help.scatter', { scatter, list: scatterList }),
      this.t('cascade.help.odds', { list: odds }),
      this.t('cascade.help.rtp', { rtp: pct(stats.rtp), hit: stats.hitOneIn, max: m.maxWinX.toLocaleString('en-US') }),
      this.t('cascade.help.honest'),
    ];
  }

  get paySizes(): readonly string[] { return PAY_SIZES.map((n, i) => (i === PAY_SIZES.length - 1 ? `${n}+` : `${n}`)); }

  private buildHistory(): void {
    const t = this.ledger.totals(this.m.id);
    this.record = this.t('cascade.help.record', { n: this.fmt(t.plays), bet: this.fmt(t.wagered), paid: this.fmt(t.paid) });
    this.history = this.ledger.recent<CascadeSummary>(this.m.id, 8).map(p => ({
      id: p.id,
      text: this.t('cascade.help.historyRow', { bet: this.fmt(p.bet), win: this.fmt(p.win) }),
      bonus: p.outcome?.bonus?.kind ?? null,
      won: p.win > 0,
    }));
  }
}
