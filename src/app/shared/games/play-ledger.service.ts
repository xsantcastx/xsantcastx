/**
 * PlayLedgerService — places a bet, draws the outcome once, pays it once.
 *
 * Every game of chance (the Reels; next Rune Drop, Seam Sweeper, Eclipse
 * Ascent) calls `play(game, mutationId, bet)`. The order is the whole design:
 *
 *   1. A known mutation id returns its stored play. If that play was not paid
 *      yet (something threw half-way), it is paid now; a paid play pays nothing.
 *   2. The bet must be on the ladder and under the income cap (bet-tiers).
 *   3. The outcome is drawn from `secret:nonce` BEFORE any Gold moves: a pure
 *      function of the seed, so nothing can fail after the debit.
 *   4. Debit the bet. Short → nothing happened.
 *   5. Store the play (unpaid) with its seed and outcome, nonce + 1.
 *   6. Pay Gold, hand over prizes (`game.pay`), mark paid, store again.
 *
 * Steps 4–6 run in one synchronous tick, and the gateway's writes are
 * synchronous, so a reload lands either before the debit or after the payout.
 * Gold only: there is no path from any purchase, donation or sponsor to here.
 *
 * Browser-only; every method no-ops on the server render.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, type Observable } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { betAllowed } from './bet-tiers';
import { newSecret, playSeed, seededRng } from './seeded-rng';
import {
  GAMES_KEY,
  emptyGamesLedger,
  parseGamesLedger,
  prunePlays,
  recentPlays,
  type GameTotals,
  type GamesLedger,
  type PlayRecord,
} from './play-ledger';

export interface ChanceGame<O> {
  id: string;
  /** Pure: the whole outcome from one RNG stream. */
  resolve(rng: () => number, bet: number): O;
  /** Gold the outcome pays. */
  winOf(outcome: O): number;
  /** Hand over anything that is not Gold (runes, materials). Called once per play. */
  pay?(outcome: O, mutationId: string): void;
}

export type PlayRefusal = 'ssr' | 'bet' | 'funds';
export type PlayResult<O> =
  | { ok: true; id: string; record: PlayRecord<O>; replay: boolean }
  | { ok: false; code: PlayRefusal };

@Injectable({ providedIn: 'root' })
export class PlayLedgerService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);

  private ledger: GamesLedger = emptyGamesLedger();
  private loaded = false;
  private readonly changed$$ = new BehaviorSubject<number>(0);
  /** Ticks on every change (a play, a cloud pull). */
  readonly changed$: Observable<number> = this.changed$$.asObservable();

  init(): void {
    if (!this.isBrowser) return;
    this.load();
  }

  totals(game: string): GameTotals {
    return this.load().totals[game] ?? { plays: 0, wagered: 0, paid: 0 };
  }

  recent<O>(game: string, n = 8): (PlayRecord<O> & { id: string })[] {
    return recentPlays<O>(this.load(), game, n);
  }

  record<O>(id: string): PlayRecord<O> | null {
    return (this.load().plays[id] as PlayRecord<O> | undefined) ?? null;
  }

  play<O>(game: ChanceGame<O>, mutationId: string, bet: number): PlayResult<O> {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    const ledger = this.load();

    const known = ledger.plays[mutationId] as PlayRecord<O> | undefined;
    if (known) {
      if (!known.paid) this.settle(game, mutationId, known);
      return { ok: true, id: mutationId, record: this.ledger.plays[mutationId] as PlayRecord<O>, replay: true };
    }

    if (!betAllowed(bet, this.economy.snapshot.perSecond)) return { ok: false, code: 'bet' };

    const secret = ledger.secret || newSecret();
    const seq = ledger.nonce;
    const seed = playSeed(secret, seq);
    const outcome = game.resolve(seededRng(seed), bet);
    const win = Math.max(0, Math.floor(game.winOf(outcome)));

    if (!this.economy.spendGold(bet, `games:${game.id}`)) return { ok: false, code: 'funds' };

    const record: PlayRecord<O> = { game: game.id, bet, seed, seq, at: new Date().toISOString(), win, outcome, paid: false };
    const t = ledger.totals[game.id] ?? { plays: 0, wagered: 0, paid: 0 };
    this.ledger = {
      ...ledger,
      secret,
      nonce: seq + 1,
      plays: { ...ledger.plays, [mutationId]: record },
      totals: { ...ledger.totals, [game.id]: { ...t, plays: t.plays + 1, wagered: t.wagered + bet } },
    };
    this.persist();
    this.settle(game, mutationId, record);
    return { ok: true, id: mutationId, record: this.ledger.plays[mutationId] as PlayRecord<O>, replay: false };
  }

  /** Pay an unpaid play exactly once. */
  private settle<O>(game: ChanceGame<O>, id: string, record: PlayRecord<O>): void {
    if (record.win > 0) this.economy.earnGold(record.win, `games:${game.id}`);
    game.pay?.(record.outcome, id);
    const t = this.ledger.totals[game.id] ?? { plays: 0, wagered: 0, paid: 0 };
    this.ledger = {
      ...this.ledger,
      plays: prunePlays({ ...this.ledger.plays, [id]: { ...record, paid: true } }),
      totals: { ...this.ledger.totals, [game.id]: { ...t, paid: t.paid + record.win } },
    };
    this.persist();
  }

  private load(): GamesLedger {
    if (this.loaded) return this.ledger;
    this.loaded = true;
    if (!this.isBrowser) return this.ledger;
    this.saves.register(GAMES_KEY, {
      rehydrate: () => {
        this.loaded = false;
        this.load();
        this.changed$$.next(this.changed$$.value + 1);
      },
    });
    this.ledger = parseGamesLedger(this.store.read(GAMES_KEY));
    return this.ledger;
  }

  private persist(): void {
    this.store.write(GAMES_KEY, this.ledger);
    this.changed$$.next(this.changed$$.value + 1);
  }
}
