/**
 * rune-drop.component — Rune Drop, the Croupier's pin board in the Nocturne Archive.
 *
 * One board, three steppers (bet, rows, risk), one "Drop · N Gold" button;
 * pay table, odds and history behind Details (stations must be dummy-simple).
 *
 * The drop is decided and paid inside `RuneDropService.drop` before the rune
 * moves (shared play ledger). The fall is theatre over the settled path: the
 * rune visits exactly the pins its stored left/right bits say, one pin per
 * beat, the same beat for every pin and every outcome. Skip (or Escape) jumps
 * to the bin; reduced motion lands it at once. The wallet holds the post-bet
 * balance until the rune lands.
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
import { gamesBetCap } from '../economy/economy-curve';
import { injectInWorldPanel } from '../in-world-panel';
import { STATION_UI, STATION_UI_I18N, type StationCost } from '../station-ui';
import { GAMES_I18N } from '../games/games.i18n';
import { WinCelebrationComponent } from '../games/win-celebration.component';
import { GameStepperComponent } from '../games/game-stepper.component';
import { betsOpen, clampBet, stepBet } from '../games/bet-tiers';
import { newPlayId } from '../games/play-ledger';
import { PlayLedgerService } from '../games/play-ledger.service';
import { RUNE_DROP_I18N } from './rune-drop.i18n';
import { RUNE_DROP_GAME_ID, RuneDropService } from './rune-drop.service';
import {
  DROP_MAX_X,
  DROP_RISKS,
  DROP_ROWS,
  DROP_TABLES,
  binChances,
  dropPays,
  dropRtp,
  type DropOutcome,
  type DropRisk,
} from './rune-drop.model';

/** Board geometry, SVG units (one art pixel = 1 unit). */
const U = 8;
/** One pin per beat, the same beat for every pin. */
const PIN_MS = 120;

interface Pin { x: number; y: number; row: number; j: number }
interface Bin { k: number; tenths: number; label: string; tier: 'low' | 'mid' | 'high' | 'top'; chance: string }
interface HistoryRow { id: string; text: string; won: boolean }

@Component({
  selector: 'app-rune-drop',
  standalone: true,
  imports: [...STATION_UI, WinCelebrationComponent, GameStepperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rune-drop.component.html',
  styleUrls: ['./rune-drop.component.css'],
})
export class RuneDropComponent implements OnInit, OnDestroy {
  protected readonly inWorld = injectInWorldPanel();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly economy = inject(EconomyService);
  private readonly drops = inject(RuneDropService);
  private readonly ledger = inject(PlayLedgerService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly still = this.isBrowser && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly U = U;
  readonly pinMs = PIN_MS;
  hydrated = false;
  detailsOpen = false;
  gold = 0;
  gps = 0;
  bet = 10;
  bets: number[] = [10];
  rows: number = DROP_ROWS.start;
  risk: DropRisk = 'medium';
  falling = false;
  result = '';
  heldGold: number | null = null;

  /** Board drawing. */
  width = 0;
  height = 0;
  pins: Pin[] = [];
  bins: Bin[] = [];
  ball: { x: number; y: number } | null = null;
  /** `row:j` of the pin the rune just struck. */
  struck = '';
  litBin: number | null = null;

  celebrate = { win: 0, bet: 0, seq: 0 };
  costs: StationCost[] = [];
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  blocked: string | null = null;
  capLine = '';
  history: HistoryRow[] = [];
  record = '';
  readonly band = (() => {
    const all = DROP_RISKS.flatMap(r => Object.keys(DROP_TABLES[r]).map(n => dropRtp(r, Number(n))));
    return { lo: pct(Math.min(...all)), hi: pct(Math.max(...all)) };
  })();
  readonly maxX = DROP_MAX_X.toLocaleString('en-US');

  private outcome: DropOutcome | null = null;

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(GAMES_I18N);
    this.i18n.register(RUNE_DROP_I18N);
    this.result = this.t('runeDrop.ready');
    this.buildBoard();
    this.refresh();
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  fmt(n: number): string { return Math.floor(n).toLocaleString('en-US'); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.drops.init();
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
    const last = this.ledger.recent<DropOutcome>(RUNE_DROP_GAME_ID, 1)[0];
    if (last?.outcome) {
      this.rows = last.outcome.rows;
      this.risk = last.outcome.risk;
      this.bet = last.bet;
      this.buildBoard();
      this.litBin = last.outcome.bin;
      this.result = this.t('runeDrop.last', { bet: this.fmt(last.bet), x: last.outcome.tenths / 10 });
    }
    this.refresh();
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.subs.unsubscribe();
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  get busy(): boolean { return this.falling; }
  get riskIndex(): number { return DROP_RISKS.indexOf(this.risk); }
  get riskLabel(): string { return this.t(`runeDrop.risk.${this.risk}`); }
  get boardRtp(): string { return pct(dropRtp(this.risk, this.rows)); }

  stepBet(dir: 1 | -1): void {
    if (this.busy) return;
    this.bet = stepBet(this.bet, dir, this.gps, this.gold);
    this.refresh();
  }

  stepRows(dir: 1 | -1): void {
    if (this.busy) return;
    this.rows = Math.max(DROP_ROWS.min, Math.min(DROP_ROWS.max, this.rows + dir));
    this.litBin = null;
    this.buildBoard();
  }

  stepRisk(dir: 1 | -1): void {
    if (this.busy) return;
    this.risk = DROP_RISKS[Math.max(0, Math.min(DROP_RISKS.length - 1, this.riskIndex + dir))];
    this.litBin = null;
    this.buildBoard();
  }

  private refresh(): void {
    this.bets = betsOpen(this.gps, this.gold);
    this.bet = clampBet(this.bet, this.gps, this.gold);
    this.costs = [{ kind: 'gold', label: this.t('stationUi.gold'), need: this.bet, have: this.gold }];
    const shown = this.heldGold ?? this.gold;
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: shown, have: shown };
    this.blocked = this.busy ? this.t('runeDrop.dropping') : null;
    this.capLine = this.t('games.bet.cap', { n: this.fmt(gamesBetCap(this.gps, this.gold)) });
  }

  /** Pins: row i holds i + 3 of them, centred; bins sit under the last row. */
  private buildBoard(): void {
    const n = this.rows;
    this.width = (n + 3) * U;
    this.height = (n + 2) * U + U / 2;
    const cx = this.width / 2;
    const pins: Pin[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i + 3; j++) pins.push({ x: cx + (j - (i + 2) / 2) * U, y: (i + 1) * U, row: i, j });
    }
    this.pins = pins;
    const chances = binChances(n);
    this.bins = dropPays(this.risk, n).map((tenths, k) => ({
      k,
      tenths,
      label: label(tenths),
      tier: tenths >= 100 ? 'top' : tenths >= 20 ? 'high' : tenths >= 10 ? 'mid' : 'low',
      chance: pct(chances[k]),
    }));
    this.ball = null;
    this.struck = '';
  }

  binX(k: number): number { return this.width / 2 + (k - this.rows / 2) * U; }

  // ── Drop ──────────────────────────────────────────────────────────────────

  drop(): void {
    if (this.busy || !this.hydrated) return;
    const before = this.gold;
    const res = this.drops.drop(newPlayId(RUNE_DROP_GAME_ID), this.bet, this.risk, this.rows);
    if (!res.ok) {
      this.result = this.t(res.code === 'funds' ? 'runeDrop.funds' : 'runeDrop.badBet');
      this.cdr.markForCheck();
      return;
    }
    const o = res.record.outcome;
    this.outcome = o;
    this.heldGold = Math.max(0, before - res.record.bet);
    this.celebrate = { win: 0, bet: 0, seq: 0 };
    this.litBin = null;
    this.falling = true;
    this.result = this.t('runeDrop.dropping');
    this.refresh();
    if (this.still) return this.finish();

    // The rune's stops: the top, then one per pin, exactly as the stored bits say.
    const cx = this.width / 2;
    let rights = 0;
    this.ball = { x: cx, y: 0 };
    this.cdr.markForCheck();
    o.path.forEach((bit, i) => this.later((i + 1) * PIN_MS, () => {
      this.struck = `${i}:${rights + 1}`;
      rights += bit;
      this.ball = { x: cx + (rights - (i + 1) / 2) * U, y: (i + 1.5) * U };
      this.cdr.markForCheck();
    }));
    this.later((o.path.length + 1) * PIN_MS, () => {
      this.ball = { x: this.binX(o.bin), y: (this.rows + 1) * U };
      this.cdr.markForCheck();
    });
    this.later((o.path.length + 2) * PIN_MS, () => this.finish());
  }

  /** Show the settled result. Safe at any point (Skip). */
  private finish(): void {
    const o = this.outcome;
    this.clearTimers();
    if (!o) return;
    this.ball = { x: this.binX(o.bin), y: (this.rows + 1) * U };
    this.struck = '';
    this.litBin = o.bin;
    // Under ×1 is said as what it is — part of the bet back — never dressed as a win.
    this.result = o.win > o.bet
      ? this.t('runeDrop.landed', { x: o.tenths / 10, n: this.fmt(o.win) })
      : this.t('runeDrop.landedBack', { x: o.tenths / 10, n: this.fmt(o.win), bet: this.fmt(o.bet) });
    this.falling = false;
    this.heldGold = null;
    if (o.win > o.bet) this.celebrate = { win: o.win, bet: o.bet, seq: this.celebrate.seq + 1 };
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

  // ── Details ───────────────────────────────────────────────────────────────

  get hitChance(): string {
    const p = binChances(this.rows);
    return pct(dropPays(this.risk, this.rows).reduce((s, t, k) => s + (t >= 10 ? p[k] : 0), 0));
  }

  private buildHistory(): void {
    const t = this.ledger.totals(RUNE_DROP_GAME_ID);
    this.record = this.t('runeDrop.record', { n: this.fmt(t.plays), bet: this.fmt(t.wagered), paid: this.fmt(t.paid) });
    this.history = this.ledger.recent<DropOutcome>(RUNE_DROP_GAME_ID, 8).map(p => ({
      id: p.id,
      text: this.t('runeDrop.historyRow', { bet: this.fmt(p.bet), x: (p.outcome?.tenths ?? 0) / 10, win: this.fmt(p.win) }),
      won: p.win >= p.bet,
    }));
  }
}

function label(tenths: number): string {
  const x = tenths / 10;
  return x >= 100 ? `${Math.round(x)}` : `${x}`;
}

function pct(x: number): string {
  const v = x * 100;
  return `${v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(1) : v.toFixed(v >= 0.01 ? 2 : 4)}%`;
}
