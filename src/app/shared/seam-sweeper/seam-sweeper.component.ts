/**
 * seam-sweeper.component — Seam Sweeper, the Croupier's 5×5 Delve seam.
 *
 * Idle: bet + collapse count and ONE "Dig · N Gold" (places the bet; the whole
 * seam is drawn then). In a round: tap cells to dig; the one button becomes
 * "Cash out ×N". Multipliers, odds and history are behind Details.
 *
 * Every dig goes through SeamSweeperService, which stores it before the board
 * shows it; the board is always drawn from the stored round, so a reload
 * resumes exactly where you were. When a round ends, every collapse is shown.
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
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { gamesBetCap } from '../economy/economy-curve';
import { rewardRate } from '../economy/economy.model';
import { injectInWorldPanel } from '../in-world-panel';
import { STATION_UI, STATION_UI_I18N, type StationCost } from '../station-ui';
import { GAMES_I18N } from '../games/games.i18n';
import { WinCelebrationComponent } from '../games/win-celebration.component';
import { GameStepperComponent } from '../games/game-stepper.component';
import { betsOpen, clampBet, stepBet } from '../games/bet-tiers';
import { newPlayId } from '../games/play-ledger';
import { PlayLedgerService } from '../games/play-ledger.service';
import { SEAM_SWEEPER_I18N } from './seam-sweeper.i18n';
import { SEAM_GAME_ID, SeamSweeperService, type SeamRecord } from './seam-sweeper.service';
import {
  SEAM_CELLS,
  SEAM_COLLAPSES,
  SEAM_MAX_X,
  SEAM_RTP,
  canDigMore,
  seamDeepest,
  seamFair,
  seamMultiplier,
  seamOre,
  seamSafeChance,
  type SeamOutcome,
} from './seam-sweeper.model';

type CellView = 'rock' | 'ore' | 'hit' | 'shown-collapse' | 'shown-ore';
interface Cell { i: number; view: CellView; label: string }
interface LadderRow { k: number; text: string }
interface HistoryRow { id: string; text: string; won: boolean }

@Component({
  selector: 'app-seam-sweeper',
  standalone: true,
  imports: [...STATION_UI, WinCelebrationComponent, GameStepperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seam-sweeper.component.html',
  styleUrls: ['./seam-sweeper.component.css'],
})
export class SeamSweeperComponent implements OnInit, OnDestroy {
  protected readonly inWorld = injectInWorldPanel();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly economy = inject(EconomyService);
  private readonly seams = inject(SeamSweeperService);
  private readonly ledger = inject(PlayLedgerService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();

  hydrated = false;
  detailsOpen = false;
  gold = 0;
  gps = 0;
  bet = 10;
  bets: number[] = [10];
  collapses: number = SEAM_COLLAPSES.start;
  result = '';
  shake = false;

  /** The round on the board: open (playing) or the last one closed. */
  round: (SeamRecord & { id: string }) | null = null;
  cells: Cell[] = [];

  celebrate = { win: 0, bet: 0, seq: 0 };
  costs: StationCost[] = [];
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  blocked: string | null = null;
  actionLabel = '';
  nextLine = '';
  capLine = '';
  ladder: LadderRow[] = [];
  history: HistoryRow[] = [];
  record = '';
  readonly rtp = pct(SEAM_RTP);
  readonly maxX = SEAM_MAX_X.toLocaleString('en-US');
  private shakeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(GAMES_I18N);
    this.i18n.register(SEAM_SWEEPER_I18N);
    this.result = this.t('seam.ready');
    this.draw();
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  fmt(n: number): string { return Math.floor(n).toLocaleString('en-US'); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.seams.init();
    this.hydrated = true;
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.gold = s.gold;
      this.gps = rewardRate(s);
      this.draw();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.ledger.changed$.subscribe(() => {
      this.buildHistory();
      this.cdr.markForCheck();
    }));
    const open = this.seams.current();
    if (open) {
      this.round = open;
      this.bet = open.bet;
      this.collapses = open.outcome.collapses;
      this.result = this.t('seam.resumed', { k: open.state?.dug.length ?? 0 });
    } else {
      const last = this.ledger.recent<SeamOutcome>(SEAM_GAME_ID, 1)[0] as (SeamRecord & { id: string }) | undefined;
      if (last?.outcome) {
        this.round = last;
        this.bet = last.bet;
        this.collapses = last.outcome.collapses;
        this.result = this.t('seam.last', { bet: this.fmt(last.bet), win: this.fmt(last.win) });
      }
    }
    this.draw();
  }

  ngOnDestroy(): void {
    if (this.shakeTimer) clearTimeout(this.shakeTimer);
    this.subs.unsubscribe();
  }

  get playing(): boolean { return !!this.round?.open; }
  get dugCount(): number { return this.round?.state?.dug.length ?? 0; }

  // ── Settings ──────────────────────────────────────────────────────────────

  stepBet(dir: 1 | -1): void {
    if (this.playing) return;
    this.bet = stepBet(this.bet, dir, this.gps, this.gold);
    this.draw();
  }

  stepCollapses(dir: 1 | -1): void {
    if (this.playing) return;
    this.collapses = Math.max(SEAM_COLLAPSES.min, Math.min(SEAM_COLLAPSES.max, this.collapses + dir));
    this.round = null;
    this.draw();
  }

  // ── Play ──────────────────────────────────────────────────────────────────

  /** The one button: start a seam, or cash out the open one. */
  act(): void {
    if (!this.hydrated) return;
    if (this.playing) return this.cashOut();
    const res = this.seams.start(newPlayId(SEAM_GAME_ID), this.bet, this.collapses);
    if (!res.ok) {
      this.result = this.t(res.code === 'funds' ? 'seam.funds' : 'seam.badBet');
      this.cdr.markForCheck();
      return;
    }
    this.round = { ...(res.record as SeamRecord), id: res.id };
    this.celebrate = { win: 0, bet: 0, seq: 0 };
    this.result = this.t('seam.open');
    this.draw();
    this.cdr.markForCheck();
  }

  dig(cell: number): void {
    const r = this.round;
    if (!r?.open) return;
    const next = this.seams.dig(r.id, cell);
    if (!next) return;
    this.round = { ...next, id: r.id };
    const m = next.outcome.collapses;
    const k = next.state?.dug.length ?? 0;
    if (next.state?.hit !== undefined) {
      this.result = this.t('seam.collapse');
      this.bump();
    } else if (!next.open) {
      this.result = this.t('seam.cleared', { x: fx(seamMultiplier(m, k)), n: this.fmt(next.win) });
      this.cheer(next);
    } else if (!canDigMore(m, k)) {
      this.result = this.t('seam.ceiling', { max: this.maxX });
    } else {
      this.result = this.t('seam.ore', { x: fx(seamMultiplier(m, k)), p: pct(seamSafeChance(m, k)) });
    }
    this.draw();
    this.cdr.markForCheck();
  }

  private cashOut(): void {
    const r = this.round;
    if (!r?.open) return;
    const done = this.seams.cashOut(r.id);
    if (!done) return;
    this.round = { ...done, id: r.id };
    const k = done.state?.dug.length ?? 0;
    this.result = this.t('seam.cashed', { x: fx(seamMultiplier(done.outcome.collapses, k)), n: this.fmt(done.win) });
    this.cheer(done);
    this.draw();
    this.cdr.markForCheck();
  }

  private cheer(rec: SeamRecord): void {
    if (rec.win > rec.bet) this.celebrate = { win: rec.win, bet: rec.bet, seq: this.celebrate.seq + 1 };
  }

  private bump(): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.shake = true;
    if (this.shakeTimer) clearTimeout(this.shakeTimer);
    this.shakeTimer = setTimeout(() => { this.shake = false; this.cdr.markForCheck(); }, 420);
  }

  // ── View ──────────────────────────────────────────────────────────────────

  private draw(): void {
    this.bets = betsOpen(this.gps, this.gold);
    this.bet = clampBet(this.bet, this.gps, this.gold);
    const r = this.round;
    const dug = new Set(r?.state?.dug ?? []);
    const hit = r?.state?.hit;
    const ended = !!r && !r.open;
    const layout = new Set(r?.outcome.layout ?? []);
    this.cells = Array.from({ length: SEAM_CELLS }, (_, i) => {
      let view: CellView = 'rock';
      if (i === hit) view = 'hit';
      else if (dug.has(i)) view = 'ore';
      else if (ended) view = layout.has(i) ? 'shown-collapse' : 'shown-ore';
      const n = i + 1;
      const label = view === 'ore' || view === 'shown-ore' ? this.t('seam.cellOre', { n })
        : view === 'hit' || view === 'shown-collapse' ? this.t('seam.cellCollapse', { n }) : this.t('seam.cell', { n });
      return { i, view, label };
    });

    const m = r?.open ? r.outcome.collapses : this.collapses;
    const k = r?.open ? this.dugCount : 0;
    const shown = this.gold;
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: shown, have: shown };
    if (this.playing) {
      this.actionLabel = k ? this.t('seam.cashOut', { x: fx(seamMultiplier(m, k)) }) : this.t('seam.cashOutPlain');
      this.costs = [];
      this.blocked = k === 0 ? this.t('seam.digFirst') : null;
    } else {
      this.actionLabel = this.t('seam.dig');
      this.costs = [{ kind: 'gold', label: this.t('stationUi.gold'), need: this.bet, have: this.gold }];
      this.blocked = null;
    }
    this.nextLine = canDigMore(m, k)
      ? this.t('seam.next', { x: fx(seamMultiplier(m, k + 1)), p: pct(seamSafeChance(m, k)) })
      : '';
    this.capLine = this.t('games.bet.cap', { n: this.fmt(gamesBetCap(this.gps, this.gold)) });
    this.buildLadder(m);
  }

  canDig(cell: Cell): boolean {
    return this.playing && cell.view === 'rock' && canDigMore(this.round!.outcome.collapses, this.dugCount);
  }

  private buildLadder(m: number): void {
    const deepest = seamDeepest(m);
    const rows: LadderRow[] = [];
    for (let k = 1; k <= Math.min(deepest, seamOre(m)); k++) {
      rows.push({ k, text: this.t('seam.ladderRow', { k, x: fx(seamMultiplier(m, k)), p: pct(1 / seamFair(m, k)) }) });
    }
    this.ladder = rows;
  }

  get ladderHead(): string {
    return this.t('seam.ladder', { m: this.round?.open ? this.round.outcome.collapses : this.collapses });
  }

  private buildHistory(): void {
    const t = this.ledger.totals(SEAM_GAME_ID);
    this.record = this.t('seam.record', { n: this.fmt(t.plays), bet: this.fmt(t.wagered), paid: this.fmt(t.paid) });
    this.history = this.ledger.recent<SeamOutcome>(SEAM_GAME_ID, 8)
      .filter(p => !p.open)
      .map(p => ({
        id: p.id,
        text: this.t('seam.historyRow', {
          bet: this.fmt(p.bet), m: p.outcome?.collapses ?? 0,
          k: (p.state as SeamRecord['state'])?.dug.length ?? 0, win: this.fmt(p.win),
        }),
        won: p.win > p.bet,
      }));
  }
}

/** "1.23" for a multiplier. */
function fx(x: number): string {
  return x >= 1000 ? Math.floor(x).toLocaleString('en-US') : x.toFixed(2);
}

function pct(x: number): string {
  const v = x * 100;
  return `${v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(1) : v.toPrecision(2)}%`;
}
