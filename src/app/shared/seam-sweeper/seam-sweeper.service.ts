/**
 * SeamSweeperService — Seam Sweeper as a steered round on the shared play ledger.
 *
 *   start    bet + collapse count → the whole seam is drawn and stored (open)
 *   dig      ore → stored and the multiplier climbs; collapse → round closes, lost;
 *            the last ore (or the ceiling) cashes out by itself
 *   cashOut  after at least one ore → paid once
 *
 * Every move is stored before it is shown, so a reload resumes the same seam
 * with the same cells dug, and a closed round can never pay twice.
 */
import { Injectable, inject } from '@angular/core';

import type { PlayRecord } from '../games/play-ledger';
import { PlayLedgerService, type PlayResult, type RoundGame } from '../games/play-ledger.service';
import {
  SEAM_CELLS,
  canDigMore,
  drawSeam,
  isCollapse,
  seamWin,
  validCollapses,
  type SeamOutcome,
  type SeamState,
} from './seam-sweeper.model';

export const SEAM_GAME_ID = 'seam-sweeper';

export type SeamRecord = PlayRecord<SeamOutcome> & { state?: SeamState };

@Injectable({ providedIn: 'root' })
export class SeamSweeperService {
  private readonly ledger = inject(PlayLedgerService);

  /** The game for one collapse count (the outcome stores it, so pricing never needs the setting). */
  game(collapses: number): RoundGame<SeamOutcome, SeamState> {
    return {
      id: SEAM_GAME_ID,
      resolve: rng => drawSeam(rng, collapses),
      start: () => ({ dug: [] }),
      winOf: (o, s, bet) => seamWin(o, s, bet),
    };
  }

  init(): void {
    this.ledger.init();
  }

  /** The round still open, if any (resume after a reload). */
  current(): (SeamRecord & { id: string }) | null {
    return (this.ledger.openRounds<SeamOutcome>(SEAM_GAME_ID)[0] as SeamRecord & { id: string }) ?? null;
  }

  start(mutationId: string, bet: number, collapses: number): PlayResult<SeamOutcome> {
    if (!validCollapses(collapses)) return { ok: false, code: 'bet' };
    if (this.current()) return { ok: false, code: 'bet' };
    return this.ledger.openRound(this.game(collapses), mutationId, bet);
  }

  /** Dig one cell of the open round `id`. Returns the stored record, or null when nothing changed. */
  dig(id: string, cell: number): SeamRecord | null {
    const rec = this.ledger.record<SeamOutcome>(id) as SeamRecord | null;
    if (!rec?.open || !rec.state) return null;
    const o = rec.outcome;
    const s = rec.state;
    if (!Number.isInteger(cell) || cell < 0 || cell >= SEAM_CELLS || s.dug.includes(cell)) return null;
    if (!canDigMore(o.collapses, s.dug.length)) return null;
    const game = this.game(o.collapses);
    if (isCollapse(o, cell)) return this.ledger.closeRound(game, id, { dug: s.dug, hit: cell }) as SeamRecord;
    const next: SeamState = { dug: [...s.dug, cell] };
    if (!canDigMore(o.collapses, next.dug.length)) return this.ledger.closeRound(game, id, next) as SeamRecord;
    return this.ledger.updateRound(id, next) as SeamRecord;
  }

  /** Cash out the open round `id` (needs one ore). */
  cashOut(id: string): SeamRecord | null {
    const rec = this.ledger.record<SeamOutcome>(id) as SeamRecord | null;
    if (!rec?.open || !rec.state?.dug.length) return null;
    return this.ledger.closeRound(this.game(rec.outcome.collapses), id) as SeamRecord;
  }
}
