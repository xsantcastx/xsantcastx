/**
 * ReelsService — the Croupier's Reels on the shared play ledger.
 *
 * The outcome and the Gold are the ledger's (PlayLedgerService: one draw, one
 * payout per mutation id). This file only says what a Reels play is and hands
 * over its prizes through the gateways that already own them:
 *
 *   rune     → RuneForgeService.grant (the Rune Forge ledger; Runewords and
 *              sockets read it), seeded from the play so a re-derivation is equal
 *   material → InventoryService.grantStack, idempotent on `reels:<id>:<n>`;
 *              the satchel / Vault routing is the inventory's own
 */
import { Injectable, inject } from '@angular/core';

import { InventoryService } from '../rpg/inventory.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { runeById } from '../rune-forge/rune.model';
import { seededRng } from '../games/seeded-rng';
import { PlayLedgerService, type ChanceGame, type PlayResult } from '../games/play-ledger.service';
import { playReels, type ReelsOutcome } from './reels.model';

export const REELS_GAME_ID = 'reels';

@Injectable({ providedIn: 'root' })
export class ReelsService {
  private readonly ledger = inject(PlayLedgerService);
  private readonly inventory = inject(InventoryService);
  private readonly runes = inject(RuneForgeService);

  readonly game: ChanceGame<ReelsOutcome> = {
    id: REELS_GAME_ID,
    resolve: (rng, bet) => playReels(rng, bet),
    winOf: o => o.win,
    pay: (o, id) => this.payPrizes(o, id),
  };

  init(): void {
    this.ledger.init();
    this.inventory.init();
    this.runes.init();
  }

  spin(mutationId: string, bet: number): PlayResult<ReelsOutcome> {
    return this.ledger.play(this.game, mutationId, bet);
  }

  private payPrizes(o: ReelsOutcome, id: string): void {
    o.prizes.forEach((p, i) => {
      if (p.kind === 'material') {
        this.inventory.grantStack(`reels:${id}:${i}`, p.id, 1);
      } else {
        const rune = runeById(p.id);
        if (rune) this.runes.grant(rune, seededRng(`${id}:prize:${i}`));
      }
    });
  }
}
