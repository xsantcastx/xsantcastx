/**
 * CascadeService — the cascade machines on the shared play ledger
 * (docs/handoff/eclipse-cascade.md).
 *
 * The outcome and the Gold are the ledger's (PlayLedgerService: one draw from
 * `secret:nonce`, the record stored unpaid BEFORE any Gold moves, paid once per
 * mutation id). What a cascade play stores is its small summary; the full film
 * is re-derived from the stored seed (`replay`). Gold only; no prizes.
 *
 * Also the realm machines' "found" receipt (the ledger's `found` map): finding
 * the Orrery Tumbler in the Orrery Wells installs it as a Mirror Slate app.
 */
import { Injectable, inject } from '@angular/core';

import { seededRng } from '../games/seeded-rng';
import { PlayLedgerService, type ChanceGame, type PlayResult } from '../games/play-ledger.service';
import type { PlayRecord } from '../games/play-ledger';
import {
  CASCADE_MACHINES, playCascadeSummary, replayCascade,
  type CascadeMachine, type CascadeOutcome, type CascadeSummary,
} from './cascade.model';

@Injectable({ providedIn: 'root' })
export class CascadeService {
  private readonly ledger = inject(PlayLedgerService);
  private readonly games = new Map<string, ChanceGame<CascadeSummary>>();

  init(): void { this.ledger.init(); }

  machine(id: string): CascadeMachine {
    return CASCADE_MACHINES[id] ?? CASCADE_MACHINES['eclipse-cascade'];
  }

  game(id: string): ChanceGame<CascadeSummary> {
    let g = this.games.get(id);
    if (!g) {
      const m = this.machine(id);
      g = { id: m.id, resolve: (rng, bet) => playCascadeSummary(m, rng, bet), winOf: o => o.win };
      this.games.set(id, g);
    }
    return g;
  }

  /** One paid spin. The ledger refuses a bet off the ladder or over the cap, and a short purse. */
  spin(machine: string, mutationId: string, bet: number): PlayResult<CascadeSummary> {
    return this.ledger.play(this.game(machine), mutationId, bet);
  }

  /** The full play behind a stored record (null when the tables changed since: show the result, not a film). */
  replay(record: PlayRecord<CascadeSummary>): CascadeOutcome | null {
    const m = this.machine(record.game);
    return replayCascade(m, seededRng(record.seed), record.outcome);
  }

  /** True once the Keeper has found this machine in the world. */
  found(machine: string): boolean { return this.ledger.found(machine); }

  /** Note it found (once). True the first time only. */
  find(machine: string): boolean { return this.ledger.markFound(machine); }
}
