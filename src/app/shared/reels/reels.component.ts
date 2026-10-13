/**
 * reels.component — the Croupier's Reels in the Nocturne Archive.
 *
 * One cabinet, one bet stepper, one "Spin · N Gold" button; pay table, odds,
 * rules and history behind Details (stations must be dummy-simple).
 *
 * The play is decided and paid inside `ReelsService.spin` before a single
 * reel moves (shared play ledger: one draw, one payout per mutation id). What
 * follows is theatre over a settled outcome:
 *
 *   base spin   reels stop left → right; the third ALWAYS waits the same
 *               extra beat, win or lose (no near-miss manipulation)
 *   lines       winning lines light; prizes named in the result line
 *   round       if 3+ Eclipses: each free spin rolls, orbs land on runes and
 *               the multiplier meter climbs; the round pays at the end
 *   payoff      coin burst (+ tier banner at ≥10×) and a pixel shake on wins
 *
 * The wallet readout holds the pre-spin balance minus the bet until the
 * result shows, so the number never spoils the reels. Skip (or Escape) jumps
 * to the result; reduced motion shows the result at once.
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
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { injectInWorldPanel } from '../in-world-panel';
import { STATION_UI, STATION_UI_I18N, type StationCost } from '../station-ui';
import { GAMES_I18N } from '../games/games.i18n';
import { WinCelebrationComponent } from '../games/win-celebration.component';
import { betsOpen, clampBet, stepBet } from '../games/bet-tiers';
import { gamesBetCap } from '../economy/economy-curve';
import { newPlayId, type PlayRecord } from '../games/play-ledger';
import { PlayLedgerService } from '../games/play-ledger.service';
import { REELS_I18N } from './reels.i18n';
import { REELS_GAME_ID, ReelsService } from './reels.service';
import { spriteLayers, type SpriteLayer } from './reel-sprites';
import {
  FREE_SPINS,
  MAX_FREE_SPINS,
  MAX_WIN_X,
  ORB_CHANCE,
  ORB_VALUES,
  PAYLINES,
  REELS_STATS,
  REEL_SYMBOLS,
  RETRIGGER_SPINS,
  SCATTER_PAY,
  bonusChance,
  cellChance,
  goldFor,
  type ReelSpin,
  type ReelSymbol,
  type ReelsOutcome,
} from './reels.model';

type Phase = 'idle' | 'spin' | 'bonus';

interface PayRow { id: ReelSymbol; name: string; layers: SpriteLayer[]; line: string; prize: string | null; odds: string }
interface HistoryRow { id: string; text: string; bonus: boolean; won: boolean }

/** A pleasant resting window before the first spin. */
const IDLE_CELLS: ReelSymbol[] = ['ash', 'heart', 'ember', 'eclipse', 'maw', 'eclipse', 'cinder', 'ember', 'ash'];
/** Line endpoints in a 3×3 viewBox, for the payline overlay. */
const LINE_POINTS = PAYLINES.map(([a, , c]) => ({ x1: (a % 3) + 0.5, y1: Math.floor(a / 3) + 0.5, x2: (c % 3) + 0.5, y2: Math.floor(c / 3) + 0.5 }));

/** Beats, ms. The third reel's extra wait is the same on every spin. */
const BEAT = { stop: [520, 820, 1120], anticipation: 420, free: [300, 450, 600], between: 380, bonusIntro: 1100, outro: 500 } as const;

@Component({
  selector: 'app-reels',
  standalone: true,
  imports: [...STATION_UI, WinCelebrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reels.component.html',
  styleUrls: ['./reels.component.css'],
})
export class ReelsComponent implements OnInit, OnDestroy {
  protected readonly inWorld = injectInWorldPanel();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly economy = inject(EconomyService);
  private readonly reels = inject(ReelsService);
  private readonly ledger = inject(PlayLedgerService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly still = this.isBrowser && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly linePoints = LINE_POINTS;
  readonly rows = [0, 1, 2];
  readonly cols = [0, 1, 2];
  /** Symbols scrolled past a rolling reel. */
  readonly blur: ReelSymbol[] = ['cinder', 'ember', 'maw', 'ash', 'heart', 'eclipse', 'cinder', 'ash'];

  hydrated = false;
  detailsOpen = false;
  gold = 0;
  gps = 0;
  bet = 10;
  bets: number[] = [10];
  phase: Phase = 'idle';
  cells: ReelSymbol[] = [...IDLE_CELLS];
  rolling = [false, false, false];
  litLines: number[] = [];
  orbs: Record<number, number> = {};
  /** Free-spin HUD. */
  freeIndex = 0;
  freeTotal = 0;
  multiplier = 0;
  roundLinesGold = 0;
  result = '';
  shake = false;
  /** Gold shown in the wallet while a result is still on its way. */
  heldGold: number | null = null;

  celebrate = { win: 0, bet: 0, seq: 0 };
  costs: StationCost[] = [];
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  blocked: string | null = null;
  capLine = '';

  payRows: PayRow[] = [];
  history: HistoryRow[] = [];
  record = '';
  readonly stats = {
    rtp: pct(REELS_STATS.rtp),
    gold: pct(REELS_STATS.goldRtp),
    bonusOneIn: Math.round(1 / bonusChance()),
    hitOneIn: REELS_STATS.hitOneIn,
    maxX: MAX_WIN_X.toLocaleString('en-US'),
  };
  readonly eclipseLayers = spriteLayers('eclipse');

  private outcome: ReelsOutcome | null = null;

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(GAMES_I18N);
    this.i18n.register(REELS_I18N);
    this.result = this.t('reels.ready');
    this.buildPayTable();
    this.refresh();
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  fmt(n: number): string { return Math.floor(n).toLocaleString('en-US'); }
  layers(symbol: ReelSymbol): SpriteLayer[] { return spriteLayers(symbol); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.reels.init();
    this.hydrated = true;
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.gold = s.gold;
      this.gps = s.perSecond;
      this.refresh();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.ledger.changed$.subscribe(() => {
      this.buildHistory();
      this.cdr.markForCheck();
    }));
    const last = this.ledger.recent<ReelsOutcome>(REELS_GAME_ID, 1)[0];
    if (last) {
      this.cells = [...last.outcome.base.cells];
      this.bet = last.bet;
      this.result = this.t('reels.lastSpin', { bet: this.fmt(last.bet), win: this.fmt(last.win) });
    }
    this.refresh();
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.subs.unsubscribe();
  }

  // ── Bet ───────────────────────────────────────────────────────────────────

  get busy(): boolean { return this.phase !== 'idle'; }

  stepBet(dir: 1 | -1): void {
    if (this.busy) return;
    this.bet = stepBet(this.bet, dir, this.gps);
    this.refresh();
  }

  private refresh(): void {
    this.bets = betsOpen(this.gps);
    this.bet = clampBet(this.bet, this.gps);
    this.costs = [{ kind: 'gold', label: this.t('stationUi.gold'), need: this.bet, have: this.gold }];
    const shown = this.heldGold ?? this.gold;
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: shown, have: shown };
    this.blocked = this.busy ? this.t('reels.spinning') : null;
    this.capLine = this.t('games.bet.cap', { n: this.fmt(gamesBetCap(this.gps)) });
  }

  // ── Spin ──────────────────────────────────────────────────────────────────

  spin(): void {
    if (this.busy || !this.hydrated) return;
    const before = this.gold;
    const res = this.reels.spin(newPlayId(REELS_GAME_ID), this.bet);
    if (!res.ok) {
      this.result = this.t(res.code === 'funds' ? 'reels.funds' : 'reels.badBet');
      this.cdr.markForCheck();
      return;
    }
    this.play(res.record, before);
  }

  private play(record: PlayRecord<ReelsOutcome>, before: number): void {
    const o = record.outcome;
    this.outcome = o;
    this.heldGold = Math.max(0, before - record.bet);
    this.celebrate = { win: 0, bet: 0, seq: 0 };
    this.litLines = [];
    this.orbs = {};
    this.multiplier = 0;
    this.freeIndex = 0;
    this.freeTotal = 0;
    this.roundLinesGold = 0;
    this.phase = 'spin';
    this.result = this.t('reels.spinning');
    this.refresh();
    if (this.still) return this.finish();

    this.rolling = [true, true, true];
    this.cdr.markForCheck();
    const stops = [BEAT.stop[0], BEAT.stop[1], BEAT.stop[2] + BEAT.anticipation];
    this.land(o.base, stops, 0, () => {
      this.litLines = o.base.lines.map(l => l.line);
      if (o.bonus) this.later(BEAT.outro, () => this.runBonus(o));
      else this.later(BEAT.outro, () => this.finish());
    });
  }

  /** Roll all three, stop each at its beat on `spin`'s window, then `done`. */
  private land(spin: ReelSpin, stops: readonly number[], offset: number, done: () => void): void {
    this.rolling = [true, true, true];
    this.cdr.markForCheck();
    stops.forEach((at, col) => this.later(offset + at, () => {
      for (const row of this.rows) this.cells[row * 3 + col] = spin.cells[row * 3 + col];
      this.cells = [...this.cells];
      this.rolling = this.rolling.map((r, i) => (i === col ? false : r));
      this.cdr.markForCheck();
      if (col === 2) done();
    }));
  }

  private runBonus(o: ReelsOutcome): void {
    const bonus = o.bonus!;
    this.phase = 'bonus';
    this.freeTotal = FREE_SPINS;
    this.result = this.t('reels.bonusOpen', { n: FREE_SPINS });
    this.cdr.markForCheck();
    let i = 0;
    let lines = 0;
    let shown = FREE_SPINS;
    const next = () => {
      if (i >= bonus.spins.length) return this.later(BEAT.outro, () => this.finish());
      const s = bonus.spins[i];
      this.freeIndex = i + 1;
      this.litLines = [];
      this.orbs = {};
      this.land(s, BEAT.free, 0, () => {
        for (const orb of s.orbs) { this.orbs[orb.cell] = orb.value; this.multiplier += orb.value; }
        this.orbs = { ...this.orbs };
        lines += s.lines.reduce((sum, l) => sum + l.tenths, 0);
        this.roundLinesGold = goldFor(lines, o.bet);
        this.litLines = s.lines.map(l => l.line);
        i++;
        const extra = bonus.spins.length - shown > 0 && s.eclipses >= 3;
        if (extra) {
          const add = Math.min(RETRIGGER_SPINS, bonus.spins.length - shown);
          shown += add;
          this.freeTotal = shown;
          this.result = this.t('reels.retrigger', { n: add });
        } else {
          this.result = this.t('reels.freeSpin', { i: this.freeIndex, n: this.freeTotal });
        }
        this.cdr.markForCheck();
        this.later(BEAT.between, next);
      });
    };
    this.later(BEAT.bonusIntro, next);
  }

  /** Show the settled result. Safe to call at any point (Skip). */
  private finish(): void {
    const o = this.outcome;
    this.clearTimers();
    if (!o) return;
    const lastWindow = o.bonus ? o.bonus.spins[o.bonus.spins.length - 1] : o.base;
    this.cells = [...lastWindow.cells];
    this.rolling = [false, false, false];
    this.litLines = lastWindow.lines.map(l => l.line);
    if (o.bonus) {
      this.freeTotal = o.bonus.spins.length;
      this.freeIndex = o.bonus.spins.length;
      this.multiplier = o.bonus.orbSum;
      this.roundLinesGold = goldFor(o.bonus.lineTenths, o.bet);
      this.orbs = Object.fromEntries(lastWindow.orbs.map(x => [x.cell, x.value]));
    }
    const parts: string[] = [];
    if (o.bonus) parts.push(this.t('reels.roundPaid', { n: this.fmt(goldFor(o.bonus.tenths, o.bet)) }));
    parts.push(o.win > 0 ? this.t('reels.won', { n: this.fmt(o.win) }) : this.t('reels.lose'));
    for (const p of o.prizes) parts.push(this.t('reels.prize', { name: p.name }));
    this.result = parts.join(' ');
    this.phase = 'idle';
    this.heldGold = null;
    if (o.win > 0) {
      this.celebrate = { win: o.win, bet: o.bet, seq: this.celebrate.seq + 1 };
      if (!this.still) {
        this.shake = true;
        this.later(420, () => { this.shake = false; this.cdr.markForCheck(); });
      }
    }
    this.outcome = null;
    this.refresh();
    this.cdr.markForCheck();
  }

  skip(): void {
    if (this.busy) this.finish();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.skip(); }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  isLit(cell: number): boolean {
    return this.litLines.some(l => PAYLINES[l].includes(cell));
  }

  // ── Details ───────────────────────────────────────────────────────────────

  private buildPayTable(): void {
    this.payRows = REEL_SYMBOLS.filter(s => s.pay > 0).map(s => ({
      id: s.id,
      name: s.name,
      layers: spriteLayers(s.id),
      line: this.t('reels.payLine', { x: s.pay / 10 }),
      prize: s.prize ? this.t('reels.payPrize', { name: s.name }) : null,
      odds: pct(cellChance(s.id)),
    }));
  }

  get eclipseLine(): string {
    return this.t('reels.payEclipse', { a: SCATTER_PAY[3] / 10, b: SCATTER_PAY[4] / 10, c: SCATTER_PAY[5] / 10 });
  }
  get eclipseOdds(): string { return pct(cellChance('eclipse')); }
  get roundRules(): string { return this.t('reels.roundRules', { n: FREE_SPINS, r: RETRIGGER_SPINS, max: MAX_FREE_SPINS }); }
  get orbOdds(): string {
    const total = ORB_VALUES.reduce((s, o) => s + o.weight, 0);
    const list = ORB_VALUES.map(o => `×${o.value} ${pct(o.weight / total)}`).join(', ');
    return this.t('reels.orbOdds', { p: pct(ORB_CHANCE), list });
  }

  private buildHistory(): void {
    const t = this.ledger.totals(REELS_GAME_ID);
    this.record = this.t('reels.record', { n: this.fmt(t.plays), bet: this.fmt(t.wagered), paid: this.fmt(t.paid) });
    this.history = this.ledger.recent<ReelsOutcome>(REELS_GAME_ID, 8).map(p => ({
      id: p.id,
      text: this.t('reels.historyRow', { bet: this.fmt(p.bet), win: this.fmt(p.win) }),
      bonus: !!p.outcome?.bonus,
      won: p.win > 0,
    }));
  }
}

function pct(x: number): string {
  const v = x * 100;
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(v >= 1 ? 1 : 2)}%`;
}
