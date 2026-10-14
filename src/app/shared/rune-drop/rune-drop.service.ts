/**
 * RuneDropService — Rune Drop on the shared play ledger.
 *
 * One drop is one play: the ledger draws the rune's whole path from the seed,
 * debits the bet and pays the bin, once per mutation id (PlayLedgerService).
 * Gold only; no prizes.
 */
import { Injectable, inject } from '@angular/core';

import { PlayLedgerService, type ChanceGame, type PlayResult } from '../games/play-ledger.service';
import { playRuneDrop, validRows, type DropOutcome, type DropRisk } from './rune-drop.model';

export const RUNE_DROP_GAME_ID = 'rune-drop';

@Injectable({ providedIn: 'root' })
export class RuneDropService {
  private readonly ledger = inject(PlayLedgerService);

  /** The game for one board setting. */
  game(risk: DropRisk, rows: number): ChanceGame<DropOutcome> {
    return {
      id: RUNE_DROP_GAME_ID,
      resolve: (rng, bet) => playRuneDrop(rng, bet, risk, rows),
      winOf: o => o.win,
    };
  }

  init(): void {
    this.ledger.init();
  }

  drop(mutationId: string, bet: number, risk: DropRisk, rows: number): PlayResult<DropOutcome> {
    if (!validRows(rows)) return { ok: false, code: 'bet' };
    return this.ledger.play(this.game(risk, rows), mutationId, bet);
  }
}
