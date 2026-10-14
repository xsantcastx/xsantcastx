/**
 * EclipseAscentService — Eclipse Ascent as a steered round on the shared play ledger.
 *
 *   launch   bet (+ optional auto target) → the break point is drawn and
 *            stored with the launch time (open)
 *   settle   at any moment: if the auto target was reached before the break it
 *            pays there; if the clock passed the break it closes, lost
 *   cashOut  at the multiplier the player saw (never above the clock's)
 *
 * The round lives on the wall clock, so a reload — or leaving the station —
 * resumes it exactly where time has taken it. Paid once, by the ledger.
 */
import { Injectable, inject } from '@angular/core';

import type { PlayRecord } from '../games/play-ledger';
import { PlayLedgerService, type PlayResult, type RoundGame } from '../games/play-ledger.service';
import {
  ASCENT_MAX,
  ASCENT_MIN_CASH,
  ascentAt,
  ascentStatus,
  ascentWin,
  drawAscent,
  msToReach,
  type AscentOutcome,
  type AscentState,
} from './eclipse-ascent.model';

export const ASCENT_GAME_ID = 'eclipse-ascent';
/** How old the on-screen multiplier may be when a cash-out is pressed. */
export const CASH_LAG_MS = 250;

export type AscentRecord = PlayRecord<AscentOutcome> & { state?: AscentState };

@Injectable({ providedIn: 'root' })
export class EclipseAscentService {
  private readonly ledger = inject(PlayLedgerService);
  /** The clock. Tests replace it. */
  now: () => number = () => Date.now();

  game(auto: number, startedAt: number): RoundGame<AscentOutcome, AscentState> {
    return {
      id: ASCENT_GAME_ID,
      resolve: rng => drawAscent(rng),
      start: () => ({ startedAt, auto }),
      winOf: (o, s, bet) => ascentWin(o, s, bet),
    };
  }

  init(): void {
    this.ledger.init();
  }

  current(): (AscentRecord & { id: string }) | null {
    return (this.ledger.openRounds<AscentOutcome>(ASCENT_GAME_ID)[0] as AscentRecord & { id: string }) ?? null;
  }

  launch(mutationId: string, bet: number, auto: number): PlayResult<AscentOutcome> {
    const target = auto >= ASCENT_MIN_CASH && auto <= ASCENT_MAX ? Math.floor(auto) : 0;
    if (this.current()) return { ok: false, code: 'bet' };
    return this.ledger.openRound(this.game(target, this.now()), mutationId, bet);
  }

  /** Close the round if the clock says it is over (auto target or break). Returns the record. */
  settle(id: string): AscentRecord | null {
    const rec = this.ledger.record<AscentOutcome>(id) as AscentRecord | null;
    if (!rec?.open || !rec.state) return rec;
    const st = ascentStatus(rec.outcome, rec.state, this.now());
    if (st.kind === 'rising') return rec;
    const game = this.game(rec.state.auto, rec.state.startedAt);
    return this.ledger.closeRound(game, id, { ...rec.state, cashedAt: st.kind === 'cashed' ? st.x : undefined }) as AscentRecord;
  }

  /**
   * Cash out at `seen` (the multiplier on screen when the button was pressed).
   * Never above what the clock allows, and never older than `CASH_LAG_MS`
   * (a stale number is replaced by the clock's). An auto target the round
   * already reached pays first. Paying `seen` rather than the clock means a
   * press on ×1.99 a frame before a ×2.00 break still counts, as it looked.
   */
  cashOut(id: string, seen: number): AscentRecord | null {
    const rec = this.ledger.record<AscentOutcome>(id) as AscentRecord | null;
    if (!rec?.open || !rec.state) return rec;
    const game = this.game(rec.state.auto, rec.state.startedAt);
    const elapsed = this.now() - rec.state.startedAt;
    const st = ascentStatus(rec.outcome, rec.state, this.now());
    if (st.kind === 'cashed') return this.ledger.closeRound(game, id, { ...rec.state, cashedAt: st.x }) as AscentRecord;
    const clock = ascentAt(elapsed);
    let x = Math.min(Math.floor(seen), clock);
    if (elapsed - msToReach(x) > CASH_LAG_MS) x = ascentAt(elapsed - CASH_LAG_MS);
    if (x < ASCENT_MIN_CASH) return st.kind === 'broke' ? this.settle(id) : rec;
    return this.ledger.closeRound(game, id, { ...rec.state, cashedAt: x }) as AscentRecord;
  }
}
