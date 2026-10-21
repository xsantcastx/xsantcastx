/**
 * eclipse-ascent.component — Eclipse Ascent, the Croupier's crash game on the Archive roof.
 *
 * Idle: bet + optional auto target and ONE "Launch · N Gold". Rising: the one
 * button is "Cash out ×N" and the eclipse closes over the sun as the
 * multiplier climbs. Odds and history behind Details.
 *
 * The break point is drawn at launch and stored (EclipseAscentService). The
 * panel only reads the clock against the stored launch time, ten times a
 * second, so what it shows is where the round really is; a reload or a
 * background tab picks up exactly there. The display stops at the true break
 * point — never a fake "almost".
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
import { ECLIPSE_ASCENT_I18N } from './eclipse-ascent.i18n';
import { ASCENT_GAME_ID, EclipseAscentService, type AscentRecord } from './eclipse-ascent.service';
import {
  ASCENT_MAX,
  ASCENT_MIN_CASH,
  ASCENT_RTP,
  ASCENT_TARGETS,
  ascentStatus,
  fmtX,
  holdChance,
  type AscentOutcome,
} from './eclipse-ascent.model';

const TICK_MS = 100;
const ODDS_AT: readonly number[] = [101, 150, 200, 300, 500, 1_000, 2_000, 5_000, 10_000, 100_000];

interface HistoryRow { id: string; text: string; won: boolean }

@Component({
  selector: 'app-eclipse-ascent',
  standalone: true,
  imports: [...STATION_UI, WinCelebrationComponent, GameStepperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './eclipse-ascent.component.html',
  styleUrls: ['./eclipse-ascent.component.css'],
})
export class EclipseAscentComponent implements OnInit, OnDestroy {
  protected readonly inWorld = injectInWorldPanel();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly economy = inject(EconomyService);
  private readonly ascent = inject(EclipseAscentService);
  private readonly ledger = inject(PlayLedgerService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** Keep a one-off note (resumed) on screen until then. */
  private noteUntil = 0;

  hydrated = false;
  detailsOpen = false;
  gold = 0;
  gps = 0;
  bet = 10;
  bets: number[] = [10];
  autoIndex = 0;
  result = '';
  /** Hundredths on the dial. */
  x = 100;
  phase: 'idle' | 'rising' | 'cashed' | 'broke' = 'idle';
  round: (AscentRecord & { id: string }) | null = null;

  celebrate = { win: 0, bet: 0, seq: 0 };
  costs: StationCost[] = [];
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  actionLabel = '';
  capLine = '';
  history: HistoryRow[] = [];
  record = '';
  readonly odds = ODDS_AT.map(x => ({ x, text: '' }));
  readonly rtp = pct(ASCENT_RTP);
  /** Share of launches that break at ×1.00: 1 − RTP / 1.01. */
  readonly instant = pct(1 - holdChance(ASCENT_MIN_CASH));

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(GAMES_I18N);
    this.i18n.register(ECLIPSE_ASCENT_I18N);
    this.result = this.t('ascent.ready');
    for (const o of this.odds) o.text = this.t('ascent.oddsRow', { x: fmtX(o.x), p: pct(holdChance(o.x)) });
    this.refresh();
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  fmt(n: number): string { return Math.floor(n).toLocaleString('en-US'); }
  fx(x: number): string { return fmtX(x); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.ascent.init();
    this.hydrated = true;
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.gold = s.gold;
      this.gps = rewardRate(s);
      this.refresh();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.ledger.changed$.subscribe(() => {
      this.buildHistory();
      this.cdr.markForCheck();
    }));
    const open = this.ascent.current();
    if (open) {
      this.round = open;
      this.bet = open.bet;
      this.autoIndex = Math.max(0, ASCENT_TARGETS.indexOf(open.state?.auto ?? 0));
      this.result = this.t('ascent.resumed');
      this.noteUntil = Date.now() + 2_500;
      this.tick();
      if (this.phase === 'rising') this.startTicker();
    } else {
      const last = this.ledger.recent<AscentOutcome>(ASCENT_GAME_ID, 1)[0] as (AscentRecord & { id: string }) | undefined;
      if (last?.outcome) {
        this.bet = last.bet;
        this.autoIndex = Math.max(0, ASCENT_TARGETS.indexOf(last.state?.auto ?? 0));
        this.result = this.t('ascent.last', { bet: this.fmt(last.bet), x: fmtX(last.outcome.crash), win: this.fmt(last.win) });
      }
    }
    this.refresh();
  }

  ngOnDestroy(): void {
    this.stopTicker();
    this.subs.unsubscribe();
  }

  get rising(): boolean { return this.phase === 'rising'; }
  get auto(): number { return ASCENT_TARGETS[this.autoIndex]; }
  get autoLabel(): string { return this.auto ? fmtX(this.auto) : this.t('ascent.autoOff'); }

  /** 0 → 1 as the multiplier climbs from ×1 to the ×1,000 ceiling (log scale). */
  get progress(): number { return Math.max(0, Math.min(1, Math.log(this.x / 100) / Math.log(ASCENT_MAX / 100))); }
  /** The moon's offset from the sun's centre, in sky pixels: far at launch, centred at the ceiling. */
  get moonX(): number { return 16 + Math.round(14 * (1 - Math.sqrt(this.progress)) * (1 - 0.15 * Number(this.phase === 'broke'))); }

  stepBet(dir: 1 | -1): void {
    if (this.rising) return;
    this.bet = stepBet(this.bet, dir, this.gps, this.gold);
    this.refresh();
  }

  stepAuto(dir: 1 | -1): void {
    if (this.rising) return;
    this.autoIndex = Math.max(0, Math.min(ASCENT_TARGETS.length - 1, this.autoIndex + dir));
    this.refresh();
  }

  // ── Play ──────────────────────────────────────────────────────────────────

  /** The one button: launch, or cash out the rising round at what the dial shows. */
  act(): void {
    if (!this.hydrated) return;
    if (this.rising && this.round) {
      const done = this.ascent.cashOut(this.round.id, this.x);
      if (done && !done.open) this.closed(done);
      return;
    }
    const res = this.ascent.launch(newPlayId(ASCENT_GAME_ID), this.bet, this.auto);
    if (!res.ok) {
      this.result = this.t(res.code === 'funds' ? 'ascent.funds' : 'ascent.badBet');
      this.cdr.markForCheck();
      return;
    }
    this.round = { ...(res.record as AscentRecord), id: res.id };
    this.celebrate = { win: 0, bet: 0, seq: 0 };
    this.x = 100;
    this.tick();
    if (this.rising) this.startTicker();
  }

  /** Read the clock against the stored round; close it through the service when it is over. */
  private tick(): void {
    const r = this.round;
    if (!r?.open || !r.state) return;
    const st = ascentStatus(r.outcome, r.state, this.ascent.now());
    if (st.kind === 'rising') {
      this.phase = 'rising';
      this.x = st.x;
      if (Date.now() >= this.noteUntil) {
        this.result = r.state.auto ? this.t('ascent.risingAuto', { x: fmtX(r.state.auto) }) : this.t('ascent.rising');
      }
      this.refresh();
      this.cdr.markForCheck();
      return;
    }
    const done = this.ascent.settle(r.id);
    if (done && !done.open) this.closed(done);
  }

  private closed(done: AscentRecord): void {
    this.stopTicker();
    const id = this.round?.id ?? '';
    this.round = { ...done, id };
    const cashed = done.state?.cashedAt;
    if (cashed !== undefined && cashed <= done.outcome.crash) {
      this.phase = 'cashed';
      this.x = cashed;
      this.result = this.t('ascent.cashed', { x: fmtX(cashed), n: this.fmt(done.win) });
      if (done.win > done.bet) this.celebrate = { win: done.win, bet: done.bet, seq: this.celebrate.seq + 1 };
    } else {
      this.phase = 'broke';
      this.x = done.outcome.crash;
      this.result = this.t('ascent.broke', { x: fmtX(done.outcome.crash) });
    }
    this.refresh();
    this.cdr.markForCheck();
  }

  private startTicker(): void {
    this.stopTicker();
    this.ticker = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  private refresh(): void {
    this.bets = betsOpen(this.gps, this.gold);
    this.bet = clampBet(this.bet, this.gps, this.gold);
    const shown = this.gold;
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: shown, have: shown };
    if (this.rising) {
      this.actionLabel = this.t('ascent.cashOut', { x: fmtX(this.x) });
      this.costs = [];
    } else {
      this.actionLabel = this.t('ascent.launch');
      this.costs = [{ kind: 'gold', label: this.t('stationUi.gold'), need: this.bet, have: this.gold }];
    }
    this.capLine = this.t('games.bet.cap', { n: this.fmt(gamesBetCap(this.gps, this.gold)) });
  }

  private buildHistory(): void {
    const t = this.ledger.totals(ASCENT_GAME_ID);
    this.record = this.t('ascent.record', { n: this.fmt(t.plays), bet: this.fmt(t.wagered), paid: this.fmt(t.paid) });
    this.history = this.ledger.recent<AscentOutcome>(ASCENT_GAME_ID, 8)
      .filter(p => !p.open && p.outcome)
      .map(p => {
        const out = (p.state as AscentRecord['state'])?.cashedAt;
        return {
          id: p.id,
          text: this.t('ascent.historyRow', {
            bet: this.fmt(p.bet), crash: fmtX(p.outcome.crash),
            out: out !== undefined ? this.t('ascent.historyCash', { x: fmtX(out) }) : this.t('ascent.historyNone'),
            win: this.fmt(p.win),
          }),
          won: p.win > p.bet,
        };
      });
  }
}

function pct(x: number): string {
  const v = x * 100;
  return `${v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(1) : v.toPrecision(2)}%`;
}
